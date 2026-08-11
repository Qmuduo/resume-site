package com.resume.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resume.api.entity.Template;
import com.resume.api.entity.TemplateConfig;
import com.resume.api.model.TemplateManifest;
import com.resume.api.repository.TemplateConfigMapper;
import com.resume.api.repository.TemplateMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 模板配置服务：把模板 manifest 同步进 template_config 表，并提供缓存读取。
 *
 * <p>manifest 来源（按优先级）：
 * <ol>
 *   <li>classpath:template-manifests/*.json —— 内置占位符模板的 manifest；</li>
 *   <li>{@code resume.manifest-dir} 目录下 *.manifest.json —— 存量静态模板（默认 ../docs/template）；</li>
 *   <li>自定义模板无 manifest 时，按 template.schema 自动推导（autoDetected=false，等待人工确认）。</li>
 * </ol>
 */
@Service
public class TemplateConfigService {

    private static final Logger log = LoggerFactory.getLogger(TemplateConfigService.class);

    private final TemplateConfigMapper templateConfigMapper;
    private final TemplateMapper templateMapper;
    private final ObjectMapper objectMapper;
    private final String manifestDir;
    private final Resource[] classpathManifests;

    /** 已下架的内置模板编码：启动种子时跳过并清理其 template_config 记录 */
    private final Set<String> retiredBuiltinCodes;

    /** 模板编码 -> manifest 缓存；写操作后失效重建 */
    private volatile Map<String, TemplateManifest> cache;

    public TemplateConfigService(TemplateConfigMapper templateConfigMapper,
                                 TemplateMapper templateMapper,
                                 ObjectMapper objectMapper,
                                 @Value("${resume.manifest-dir:../docs/template}") String manifestDir,
                                 @Value("classpath*:template-manifests/*.json") Resource[] classpathManifests,
                                 @Value("classpath:template-retired-codes.json") Resource retiredCodesResource) {
        this.templateConfigMapper = templateConfigMapper;
        this.templateMapper = templateMapper;
        this.objectMapper = objectMapper;
        this.manifestDir = manifestDir;
        this.classpathManifests = classpathManifests;
        this.retiredBuiltinCodes = loadRetiredCodes(retiredCodesResource);
    }

    /** 读取已下架模板编码清单（resources/template-retired-codes.json），文件缺失时回退为空集合 */
    private Set<String> loadRetiredCodes(Resource resource) {
        try (InputStream in = resource.getInputStream()) {
            return new HashSet<>(objectMapper.readValue(in, new TypeReference<List<String>>() {
            }));
        } catch (IOException e) {
            log.warn("retired template codes resource missing, fallback to empty: {}", e.getMessage());
            return Set.of();
        }
    }

    @PostConstruct
    public void seed() {
        purgeRetiredConfigs();
        int count = 0;
        List<Resource> sorted = Arrays.stream(classpathManifests)
                .sorted(Comparator.comparing(r -> r.getFilename() == null ? "" : r.getFilename()))
                .toList();
        for (Resource resource : sorted) {
            try (InputStream in = resource.getInputStream()) {
                TemplateManifest manifest = objectMapper.readValue(in, TemplateManifest.class);
                if (manifest.getTemplateId() != null && retiredBuiltinCodes.contains(manifest.getTemplateId())) {
                    continue;
                }
                if (upsert(manifest)) {
                    count++;
                }
            } catch (IOException e) {
                log.warn("skip invalid classpath template manifest: {}", resource.getFilename(), e);
            }
        }

        try {
            Path dir = resolveManifestDir();
            if (dir != null && Files.isDirectory(dir)) {
                try (var stream = Files.list(dir)) {
                    List<Path> files = stream
                            .filter(p -> p.getFileName().toString().endsWith(".manifest.json"))
                            .sorted()
                            .toList();
                    for (Path file : files) {
                        byte[] bytes = Files.readAllBytes(file);
                        TemplateManifest manifest = objectMapper.readValue(bytes, TemplateManifest.class);
                        if (manifest.getTemplateId() == null || manifest.getTemplateId().isBlank()) {
                            manifest.setTemplateId(stripSuffix(file.getFileName().toString(), ".manifest.json"));
                        }
                        if (retiredBuiltinCodes.contains(manifest.getTemplateId())) {
                            continue;
                        }
                        if (upsert(manifest)) {
                            count++;
                        }
                    }
                }
            } else {
                log.info("template manifest dir not found, skip filesystem scan: {}", manifestDir);
            }
        } catch (IOException e) {
            log.warn("scan template manifest dir failed: {}", manifestDir, e);
        }

        invalidateCache();
        log.info("seeded {} template manifests (dir={})", count, manifestDir);
    }

    /** 启动时清理已下架模板的 manifest 配置；可重复执行 */
    private void purgeRetiredConfigs() {
        for (String code : retiredBuiltinCodes) {
            deleteConfigByCode(code);
        }
    }

    /** 按模板编码删除 template_config 记录（供内置模板下架清理使用） */
    public void deleteConfigByCode(String code) {
        int deleted = templateConfigMapper.delete(
                new LambdaQueryWrapper<TemplateConfig>().eq(TemplateConfig::getTemplateCode, code));
        if (deleted > 0) {
            log.info("removed retired template config: code={}, rows={}", code, deleted);
        }
        invalidateCache();
    }

    /** 解析 manifest 目录：兼容不同启动目录（项目根/backend/模块目录） */
    private Path resolveManifestDir() {
        Path direct = Paths.get(manifestDir);
        if (Files.isDirectory(direct)) {
            return direct;
        }
        for (String prefix : new String[]{"..", "../.."}) {
            Path candidate = Paths.get(prefix, manifestDir);
            if (Files.isDirectory(candidate)) {
                return candidate;
            }
        }
        return direct;
    }

    /**
     * 按模板编码读取 manifest；无 manifest 时回退到按 schema 推导。
     */
    public TemplateManifest getManifestByCode(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        TemplateManifest manifest = cachedAll().get(code);
        if (manifest != null) {
            return manifest;
        }
        Template template = templateMapper.selectOne(
                new LambdaQueryWrapper<Template>().eq(Template::getCode, code).last("LIMIT 1"));
        if (template == null) {
            return null;
        }
        return deriveFromSchema(template);
    }

    /** 模板表种子完成后，回填 template_config.template_id */
    public void syncTemplateIds() {
        for (TemplateConfig config : templateConfigMapper.selectList(null)) {
            Template template = templateMapper.selectOne(
                    new LambdaQueryWrapper<Template>().eq(Template::getCode, config.getTemplateCode()).last("LIMIT 1"));
            if (template != null && (config.getTemplateId() == null || !template.getId().equals(config.getTemplateId()))) {
                config.setTemplateId(template.getId());
                templateConfigMapper.updateById(config);
            }
        }
        invalidateCache();
    }

    /**
     * 由模板 schema 推导 manifest v2（自定义模板兜底：renderMode=placeholder，字段进 customFields）。
     */
    public TemplateManifest deriveFromSchema(Template template) {
        TemplateManifest manifest = new TemplateManifest();
        manifest.setTemplateId(template.getCode());
        manifest.setName(template.getName());
        manifest.setSourceFile("schema://" + template.getCode());
        manifest.setRenderMode("placeholder");
        manifest.setRegions(new ArrayList<>());
        manifest.setBlocks(new ArrayList<>());
        manifest.setTheme(new ArrayList<>());
        manifest.setSampleData(new LinkedHashMap<>());
        List<Map<String, Object>> customFields = new ArrayList<>();
        try {
            JsonNode schema = objectMapper.readTree(template.getSchemaJson());
            if (schema != null && schema.isObject()) {
                JsonNode properties = schema.get("properties");
                if (properties != null && properties.isObject()) {
                    properties.fields().forEachRemaining(entry -> {
                        Map<String, Object> field = new LinkedHashMap<>();
                        field.put("name", entry.getKey());
                        field.put("label", entry.getKey());
                        field.put("type", nodeType(entry.getValue()));
                        customFields.add(field);
                    });
                }
            }
        } catch (JsonProcessingException e) {
            log.warn("derive manifest from schema failed for {}", template.getCode(), e);
        }
        manifest.setCustomFields(customFields);
        return manifest;
    }

    private boolean upsert(TemplateManifest manifest) {
        String code = manifest.getTemplateId();
        if (code == null || code.isBlank()) {
            log.warn("skip manifest without templateId");
            return false;
        }
        TemplateConfig existing = templateConfigMapper.selectOne(
                new LambdaQueryWrapper<TemplateConfig>().eq(TemplateConfig::getTemplateCode, code).last("LIMIT 1"));
        Template template = templateMapper.selectOne(
                new LambdaQueryWrapper<Template>().eq(Template::getCode, code).last("LIMIT 1"));
        try {
            String manifestJson = objectMapper.writeValueAsString(manifest);
            if (existing == null) {
                TemplateConfig config = new TemplateConfig();
                config.setTemplateId(template == null ? null : template.getId());
                config.setTemplateCode(code);
                config.setManifest(manifestJson);
                config.setStatus(0);
                templateConfigMapper.insert(config);
            } else {
                existing.setTemplateId(template == null ? existing.getTemplateId() : template.getId());
                existing.setManifest(manifestJson);
                if (existing.getStatus() == null || existing.getStatus() == 0) {
                    existing.setStatus(0);
                }
                templateConfigMapper.updateById(existing);
            }
            return true;
        } catch (JsonProcessingException e) {
            log.warn("serialize manifest failed for {}", code, e);
            return false;
        }
    }

    private Map<String, TemplateManifest> cachedAll() {
        Map<String, TemplateManifest> current = cache;
        if (current == null) {
            synchronized (this) {
                current = cache;
                if (current == null) {
                    Map<String, TemplateManifest> map = new LinkedHashMap<>();
                    for (TemplateConfig config : templateConfigMapper.selectList(null)) {
                        try {
                            map.put(config.getTemplateCode(),
                                    objectMapper.readValue(config.getManifest(), TemplateManifest.class));
                        } catch (JsonProcessingException e) {
                            log.warn("parse manifest failed for template {}", config.getTemplateCode(), e);
                        }
                    }
                    current = map;
                    cache = map;
                }
            }
        }
        return current;
    }

    private void invalidateCache() {
        cache = null;
    }

    private static String nodeType(JsonNode node) {
        if (node == null) {
            return "string";
        }
        if ("array".equals(node.path("type").asText())) {
            return "array";
        }
        if ("object".equals(node.path("type").asText())) {
            return "object";
        }
        return "string";
    }

    private static String stripSuffix(String name, String suffix) {
        if (name.endsWith(suffix)) {
            return name.substring(0, name.length() - suffix.length());
        }
        return name;
    }
}
