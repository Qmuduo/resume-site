package com.resume.api.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import com.resume.api.dto.TemplateRequest;
import com.resume.api.entity.Template;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 模板服务：内置模板在启动时从 classpath 的 resources/templates/*.json 种子进数据库，
 * 之后统一从数据库读取（含用户自定义模板）。列表带内存缓存，写操作后失效重建；
 * 后续做模板市场/版本管理时只需扩展该存储模型。
 */
@Service
public class TemplateService {

    private static final Logger log = LoggerFactory.getLogger(TemplateService.class);

    private final TemplateMapper templateMapper;
    private final ObjectMapper objectMapper;
    private final Resource[] builtinTemplateResources;

    /** 全部模板快照缓存；写操作后置空重建 */
    private volatile List<TemplateVO> cache;

    public TemplateService(TemplateMapper templateMapper,
                           ObjectMapper objectMapper,
                           @Value("classpath*:templates/template-*.json") Resource[] builtinTemplateResources) {
        this.templateMapper = templateMapper;
        this.objectMapper = objectMapper;
        this.builtinTemplateResources = builtinTemplateResources;
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
        invalidateCache();
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
        vo.setSchema(parseSchema(template.getSchemaJson()));
        vo.setHtml(template.getHtml());
        vo.setCss(template.getCss());
        vo.setBuiltin(template.getBuiltin());
        vo.setCreatedAt(template.getCreatedAt());
        return vo;
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
}
