package com.resume.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import com.resume.api.dto.TemplateRequest;
import com.resume.api.entity.Template;
import com.resume.api.model.TemplateManifest;
import com.resume.api.repository.TemplateMapper;
import com.resume.api.vo.TemplateVO;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 模板服务：内置模板在启动时种子进数据库——
 * 1. classpath 的 resources/templates/*.json（占位符模板）；
 * 2. resume.manifest-dir 下的 *.html + *.manifest.json（存量静态模板）。
 * 之后统一从数据库读取（含用户自定义模板）。列表带内存缓存，写操作后失效重建。
 */
@Service
public class TemplateService {

    private static final Logger log = LoggerFactory.getLogger(TemplateService.class);

    private final TemplateMapper templateMapper;
    private final ObjectMapper objectMapper;
    private final Resource[] builtinTemplateResources;
    private final Resource marketCatalogResource;
    private final TemplateConfigService templateConfigService;
    private final String manifestDir;

    private static final Pattern BODY_PATTERN = Pattern.compile("(?is)<body[^>]*>(.*)</body>");
    private static final Pattern STYLE_PATTERN = Pattern.compile("(?is)<style[^>]*>(.*?)</style>");

    /** 已下架的内置模板编码：不再从资源文件种子，并在启动时从库中清除 builtin 记录 */
    private static final Set<String> RETIRED_BUILTIN_CODES = Set.of("classic", "minimal", "modern");

    /** 全部模板快照缓存；写操作后置空重建 */
    private volatile List<TemplateVO> cache;

    public TemplateService(TemplateMapper templateMapper,
                           ObjectMapper objectMapper,
                           @Value("classpath*:templates/template-*.json") Resource[] builtinTemplateResources,
                           @Value("classpath:template-market-catalog.json") Resource marketCatalogResource,
                           TemplateConfigService templateConfigService,
                           @Value("${resume.manifest-dir:../docs/template}") String manifestDir) {
        this.templateMapper = templateMapper;
        this.objectMapper = objectMapper;
        this.builtinTemplateResources = builtinTemplateResources;
        this.marketCatalogResource = marketCatalogResource;
        this.templateConfigService = templateConfigService;
        this.manifestDir = manifestDir;
    }

    /**
     * 启动时把 resources/templates/template-*.json 种子进数据库。
     * 内置模板以 resources 文件为准：缺失则插入，已存在且是内置模板则刷新内容；
     * 若 code 被用户自定义模板占用则跳过并告警。
     */
    @PostConstruct
    public void seedBuiltinTemplates() {
        for (Map<String, Object> source : loadBuiltinTemplateResources()) {
            String code = str(source.get("code"));
            Template existing = templateMapper.selectOne(
                    new LambdaQueryWrapper<Template>().eq(Template::getCode, code));
            if (existing == null) {
                templateMapper.insert(toEntity(source, null, 1));
            } else if (Integer.valueOf(1).equals(existing.getBuiltin())) {
                existing.setName(str(source.get("name")));
                existing.setDescription(str(source.get("description")));
                existing.setSchemaJson(jsonString(source.get("schema")));
                existing.setHtml(str(source.get("html")));
                existing.setCss(str(source.get("css")));
                existing.setBuiltin(1);
                existing.setUserId(null);
                templateMapper.updateById(existing);
            } else {
                log.warn("Skip builtin template '{}': code already used by a custom template", code);
            }
        }
        seedLegacyHtmlTemplates();
        applyMarketCatalog();
        // 最后统一清理已下架内置模板，避免过期 classpath 资源（如旧构建产物）再次种子
        purgeRetiredBuiltinTemplates();
        templateConfigService.syncTemplateIds();
        invalidateCache();
    }

    /**
     * 市场目录：为模板补充规范中文名、分类与标签（来源 template-market-catalog.json）。
     * 可重复执行，只更新目录中存在的模板，不影响用户自定义模板。
     */
    private void applyMarketCatalog() {
        Map<String, MarketCatalogEntry> catalog = loadMarketCatalog();
        if (catalog.isEmpty()) {
            return;
        }
        int updated = 0;
        for (Map.Entry<String, MarketCatalogEntry> entry : catalog.entrySet()) {
            Template template = templateMapper.selectOne(
                    new LambdaQueryWrapper<Template>().eq(Template::getCode, entry.getKey()).last("LIMIT 1"));
            if (template == null) {
                continue;
            }
            MarketCatalogEntry meta = entry.getValue();
            boolean changed = false;
            if (meta.getName() != null && !meta.getName().isBlank() && !meta.getName().equals(template.getName())) {
                template.setName(meta.getName().trim());
                changed = true;
            }
            if (meta.getCategory() != null && !meta.getCategory().equals(template.getCategory())) {
                template.setCategory(meta.getCategory());
                changed = true;
            }
            if (meta.getTags() != null) {
                String tagsJson = jsonString(meta.getTags());
                if (tagsJson != null && !tagsJson.equals(template.getTags())) {
                    template.setTags(tagsJson);
                    changed = true;
                }
            }
            if (changed) {
                templateMapper.updateById(template);
                updated++;
            }
        }
        if (updated > 0) {
            log.info("applied market catalog to {} templates", updated);
        }
    }

    private Map<String, MarketCatalogEntry> loadMarketCatalog() {
        try (InputStream in = marketCatalogResource.getInputStream()) {
            return objectMapper.readValue(in, new TypeReference<Map<String, MarketCatalogEntry>>() {
            });
        } catch (IOException e) {
            log.warn("market catalog resource missing, skip: {}", e.getMessage());
            return Map.of();
        }
    }

    /**
     * 清理已下架内置模板：仅删除 builtin=1 的记录（用户自定义的同名模板不受影响），
     * 并同步清理 template_config；有存量简历引用时保留引用，由前端提示重新选择模板。
     */
    private void purgeRetiredBuiltinTemplates() {
        for (String code : RETIRED_BUILTIN_CODES) {
            List<Template> existing = templateMapper.selectList(
                    new LambdaQueryWrapper<Template>().eq(Template::getCode, code));
            boolean removed = false;
            for (Template template : existing) {
                if (Integer.valueOf(1).equals(template.getBuiltin())) {
                    templateMapper.deleteById(template.getId());
                    removed = true;
                    log.info("removed retired builtin template from db: code={}, id={}", code, template.getId());
                }
            }
            if (removed) {
                templateConfigService.deleteConfigByCode(code);
            }
        }
    }

    /**
     * 存量静态模板：扫描 manifest-dir 下的 *.html，配套 *.manifest.json 存在时注册为内置模板。
     * HTML 拆分为 css（<style> 内容）与 html（<body> 内容），schema 由 manifest 字段推导。
     */
    private void seedLegacyHtmlTemplates() {
        Path dir = resolveManifestDir();
        if (dir == null || !Files.isDirectory(dir)) {
            log.info("legacy template dir not found, skip: {}", manifestDir);
            return;
        }
        int count = 0;
        try (var stream = Files.list(dir)) {
            List<Path> htmlFiles = stream
                    .filter(p -> p.getFileName().toString().endsWith(".html"))
                    .sorted()
                    .toList();
            for (Path htmlFile : htmlFiles) {
                String base = stripSuffix(htmlFile.getFileName().toString(), ".html");
                Path manifestFile = dir.resolve(base + ".manifest.json");
                if (!Files.isRegularFile(manifestFile)) {
                    continue;
                }
                TemplateManifest manifest;
                try {
                    manifest = objectMapper.readValue(Files.readAllBytes(manifestFile), TemplateManifest.class);
                } catch (IOException e) {
                    log.warn("skip legacy template {}: invalid manifest", htmlFile.getFileName(), e);
                    continue;
                }
                String code = manifest.getTemplateId() == null || manifest.getTemplateId().isBlank()
                        ? base
                        : manifest.getTemplateId();
                String name = manifest.getName() == null || manifest.getName().isBlank()
                        ? base
                        : manifest.getName();
                String html = extractBody(htmlFile);
                String css = extractStyles(htmlFile);
                if (html == null || html.isBlank()) {
                    log.warn("skip legacy template {}: empty body", htmlFile.getFileName());
                    continue;
                }
                upsertLegacyTemplate(code, name, html, css, manifest);
                count++;
            }
        } catch (IOException e) {
            log.warn("scan legacy template dir failed: {}", manifestDir, e);
        }
        log.info("seeded {} legacy static templates from {}", count, manifestDir);
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

    private void upsertLegacyTemplate(String code, String name, String html, String css,
                                      TemplateManifest manifest) {
        Template existing = templateMapper.selectOne(
                new LambdaQueryWrapper<Template>().eq(Template::getCode, code));
        if (existing == null) {
            Template template = new Template();
            template.setCode(code);
            template.setName(name);
            template.setDescription("存量静态模板：" + code + "（manifest 自动生成，待人工确认字段见 manifest.pendingManual）");
            template.setSchemaJson(jsonString(buildSchemaFromManifest(manifest)));
            template.setHtml(html);
            template.setCss(css);
            template.setBuiltin(1);
            template.setUserId(null);
            templateMapper.insert(template);
        } else if (Integer.valueOf(1).equals(existing.getBuiltin())) {
            existing.setName(name);
            existing.setDescription("存量静态模板：" + code + "（manifest 自动生成，待人工确认字段见 manifest.pendingManual）");
            existing.setSchemaJson(jsonString(buildSchemaFromManifest(manifest)));
            existing.setHtml(html);
            existing.setCss(css);
            existing.setBuiltin(1);
            existing.setUserId(null);
            templateMapper.updateById(existing);
        } else {
            log.warn("Skip legacy template '{}': code already used by a custom template", code);
        }
    }

    private String extractBody(Path htmlFile) {
        try {
            String content = Files.readString(htmlFile, StandardCharsets.UTF_8);
            Matcher matcher = BODY_PATTERN.matcher(content);
            return matcher.find() ? matcher.group(1) : null;
        } catch (IOException e) {
            log.warn("read html failed: {}", htmlFile.getFileName(), e);
            return null;
        }
    }

    private String extractStyles(Path htmlFile) {
        try {
            String content = Files.readString(htmlFile, StandardCharsets.UTF_8);
            Matcher matcher = STYLE_PATTERN.matcher(content);
            StringBuilder css = new StringBuilder();
            while (matcher.find()) {
                css.append(matcher.group(1)).append('\n');
            }
            return css.toString();
        } catch (IOException e) {
            log.warn("read html styles failed: {}", htmlFile.getFileName(), e);
            return "";
        }
    }

    /** 由 manifest 字段列表推导 JSON Schema（静态模板的表单/预览兼容旧渲染器） */
    private JsonNode buildSchemaFromManifest(TemplateManifest manifest) {
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode properties = schema.putObject("properties");
        for (TemplateManifest.FieldDef field : manifest.getFields()) {
            properties.set(field.getName(), fieldSchemaNode(field));
        }
        return schema;
    }

    private JsonNode fieldSchemaNode(TemplateManifest.FieldDef field) {
        ObjectNode node = objectMapper.createObjectNode();
        String type = field.getType() == null ? "string" : field.getType();
        if ("array".equals(type)) {
            node.put("type", "array");
            node.set("items", objectMapper.createObjectNode().put("type", "string"));
        } else if ("object".equals(type)) {
            node.put("type", "object");
            node.set("properties", objectMapper.createObjectNode());
        } else {
            node.put("type", type);
        }
        return node;
    }

    private static String stripSuffix(String name, String suffix) {
        if (name.endsWith(suffix)) {
            return name.substring(0, name.length() - suffix.length());
        }
        return name;
    }

    /**
     * 模板列表：匿名只看到内置模板；登录用户额外看到自己创建的自定义模板。
     * 后续做模板市场时，可在该查询上叠加 visibility/发布状态条件。
     */
    public List<TemplateVO> list(Long userId) {
        List<TemplateVO> all = cachedAll();
        if (userId == null) {
            return all.stream().filter(t -> Integer.valueOf(1).equals(t.getBuiltin())).toList();
        }
        return all.stream()
                .filter(t -> Integer.valueOf(1).equals(t.getBuiltin()) || userId.equals(t.getUserId()))
                .toList();
    }

    public TemplateVO create(Long userId, TemplateRequest request) {
        validateRequest(request);
        ensureCodeAvailable(request.getCode().trim(), null);
        Template template = new Template();
        template.setUserId(userId);
        fillEntity(template, request);
        template.setBuiltin(0);
        templateMapper.insert(template);
        invalidateCache();
        return toVO(template);
    }

    public TemplateVO update(Long userId, Long id, TemplateRequest request, boolean admin) {
        Template existing = requireCustomTemplate(userId, id, admin);
        validateRequest(request);
        ensureCodeAvailable(request.getCode().trim(), id);
        fillEntity(existing, request);
        templateMapper.updateById(existing);
        invalidateCache();
        return toVO(existing);
    }

    public void delete(Long userId, Long id, boolean admin) {
        Template existing = requireCustomTemplate(userId, id, admin);
        templateMapper.deleteById(existing.getId());
        invalidateCache();
    }

    private Template requireCustomTemplate(Long userId, Long id, boolean admin) {
        Template existing = templateMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "模板不存在");
        }
        if (Integer.valueOf(1).equals(existing.getBuiltin())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "内置模板不允许修改或删除");
        }
        if (!admin && !userId.equals(existing.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权限操作该模板");
        }
        return existing;
    }

    private void ensureCodeAvailable(String code, Long excludeId) {
        Template existing = templateMapper.selectOne(
                new LambdaQueryWrapper<Template>().eq(Template::getCode, code));
        if (existing != null && (excludeId == null || !existing.getId().equals(excludeId))) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN, "模板编码已存在");
        }
    }

    private void validateRequest(TemplateRequest request) {
        if (request.getSchema() == null || !request.getSchema().isObject()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "schema 必须是 JSON 对象");
        }
    }

    private void fillEntity(Template template, TemplateRequest request) {
        template.setCode(request.getCode().trim());
        template.setName(request.getName().trim());
        template.setDescription(trimToNull(request.getDescription()));
        template.setSchemaJson(jsonString(request.getSchema()));
        template.setHtml(request.getHtml());
        template.setCss(request.getCss());
    }

    private List<TemplateVO> cachedAll() {
        List<TemplateVO> current = cache;
        if (current == null) {
            synchronized (this) {
                current = cache;
                if (current == null) {
                    current = templateMapper.selectList(null).stream().map(this::toVO).toList();
                    cache = current;
                }
            }
        }
        return current;
    }

    private void invalidateCache() {
        cache = null;
    }

    private TemplateVO toVO(Template template) {
        TemplateVO vo = new TemplateVO();
        vo.setId(template.getId());
        vo.setUserId(template.getUserId());
        vo.setCode(template.getCode());
        vo.setName(template.getName());
        vo.setDescription(template.getDescription());
        vo.setCategory(template.getCategory());
        vo.setTags(parseTags(template.getTags()));
        vo.setSchema(parseSchema(template.getSchemaJson()));
        vo.setHtml(template.getHtml());
        vo.setCss(template.getCss());
        vo.setBuiltin(template.getBuiltin());
        vo.setManifest(templateConfigService.getManifestByCode(template.getCode()));
        vo.setCreatedAt(template.getCreatedAt());
        return vo;
    }

    private Object parseTags(String tagsJson) {
        if (tagsJson == null || tagsJson.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(tagsJson, new TypeReference<List<String>>() {
            });
        } catch (IOException e) {
            log.warn("template tags parse failed: {}", e.getMessage());
            return null;
        }
    }

    private Object parseSchema(String schemaJson) {
        if (schemaJson == null || schemaJson.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(schemaJson, new TypeReference<Map<String, Object>>() {
            });
        } catch (IOException e) {
            log.warn("template schema_json parse failed, return raw string: {}", e.getMessage());
            return schemaJson;
        }
    }

    private Template toEntity(Map<String, Object> source, Long userId, int builtin) {
        Template template = new Template();
        template.setUserId(userId);
        template.setCode(str(source.get("code")));
        template.setName(str(source.get("name")));
        template.setDescription(str(source.get("description")));
        template.setSchemaJson(jsonString(source.get("schema")));
        template.setHtml(str(source.get("html")));
        template.setCss(str(source.get("css")));
        template.setBuiltin(builtin);
        return template;
    }

    private List<Map<String, Object>> loadBuiltinTemplateResources() {
        List<Resource> sorted = Arrays.stream(builtinTemplateResources)
                .sorted(Comparator.comparing(r -> r.getFilename() == null ? "" : r.getFilename()))
                .toList();
        List<Map<String, Object>> templates = new ArrayList<>();
        for (Resource resource : sorted) {
            try (InputStream in = resource.getInputStream()) {
                templates.add(objectMapper.readValue(in, new TypeReference<Map<String, Object>>() {
                }));
            } catch (IOException e) {
                log.warn("Skip invalid builtin template file: {}", resource.getFilename(), e);
            }
        }
        return templates;
    }

    private String jsonString(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "schema 不是合法 JSON");
        }
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** 市场目录条目：template-market-catalog.json 中单个模板的元信息 */
    public static class MarketCatalogEntry {

        private String name;
        private String category;
        private List<String> tags;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public List<String> getTags() {
            return tags;
        }

        public void setTags(List<String> tags) {
            this.tags = tags;
        }
    }
}
