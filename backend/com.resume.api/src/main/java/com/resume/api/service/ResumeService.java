package com.resume.api.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import com.resume.api.dto.ResumeRequest;
import com.resume.api.entity.Resume;
import com.resume.api.model.TemplateManifest;
import com.resume.api.repository.ResumeMapper;
import com.resume.api.vo.ResumeVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 简历服务：公共数据、扩展数据、当前模板ID 三列存储；
 * 切换模板时按 manifest 做字段映射，无法映射的扩展字段暂存保留、不丢弃。
 */
@Service
public class ResumeService {

    private static final Logger log = LoggerFactory.getLogger(ResumeService.class);

    private final ResumeMapper resumeMapper;
    private final ObjectMapper objectMapper;
    private final TemplateConfigService templateConfigService;

    public ResumeService(ResumeMapper resumeMapper,
                         ObjectMapper objectMapper,
                         TemplateConfigService templateConfigService) {
        this.resumeMapper = resumeMapper;
        this.objectMapper = objectMapper;
        this.templateConfigService = templateConfigService;
    }

    public List<Resume> listByUser(Long userId) {
        return resumeMapper.selectList(Wrappers.<Resume>lambdaQuery()
                .eq(Resume::getUserId, userId)
                .orderByDesc(Resume::getUpdatedAt));
    }

    public Resume getByUser(Long userId, Long id) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !userId.equals(resume.getUserId())) {
            return null;
        }
        return resume;
    }

    @Transactional(rollbackFor = Exception.class)
    public Resume create(Long userId, ResumeRequest request) {
        ObjectNode common = normalizeJsonObject(request.getCommonData(), "commonData");
        ObjectNode extended = normalizeJsonObject(request.getExtendedData(), "extendedData");
        Resume resume = new Resume();
        resume.setUserId(userId);
        resume.setTitle(request.getTitle().trim());
        String templateId = trimToNull(request.getCurrentTemplateId());
        resume.setCurrentTemplateId(templateId);
        resume.setTemplateCode(templateId);
        resume.setCommonData(writeJson(common));
        resume.setExtendedData(writeJson(extended));
        resume.setStatus(request.getStatus() == null ? 0 : request.getStatus());
        resumeMapper.insert(resume);
        return resume;
    }

    @Transactional(rollbackFor = Exception.class)
    public Resume update(Long userId, Long id, ResumeRequest request) {
        Resume resume = getByUser(userId, id);
        if (resume == null) {
            return null;
        }
        ObjectNode common = normalizeJsonObject(request.getCommonData(), "commonData");
        ObjectNode extended = normalizeJsonObject(request.getExtendedData(), "extendedData");
        resume.setTitle(request.getTitle().trim());
        String templateId = trimToNull(request.getCurrentTemplateId());
        resume.setCurrentTemplateId(templateId);
        resume.setTemplateCode(templateId);
        resume.setCommonData(writeJson(common));
        resume.setExtendedData(writeJson(extended));
        if (request.getStatus() != null) {
            resume.setStatus(request.getStatus());
        }
        resumeMapper.updateById(resume);
        return resume;
    }

    /**
     * 切换模板：公共数据保持不变；扩展数据按新模板 manifest 尽量映射，
     * 新模板不支持的字段保留在 extended_data（暂存不丢弃），切回后数据恢复原样。
     */
    @Transactional(rollbackFor = Exception.class)
    public Resume switchTemplate(Long userId, Long id, String newTemplateId) {
        Resume resume = getByUser(userId, id);
        if (resume == null) {
            return null;
        }
        if (newTemplateId.equals(resume.getCurrentTemplateId())) {
            return resume;
        }

        TemplateManifest target = templateConfigService.getManifestByCode(newTemplateId);
        if (target == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "目标模板不存在或未配置 manifest");
        }
        String oldTemplateId = resume.getCurrentTemplateId();
        TemplateManifest source = oldTemplateId == null
                ? null
                : templateConfigService.getManifestByCode(oldTemplateId);

        ObjectNode common = parseObjectNode(resume.getCommonData());
        ObjectNode extended = parseObjectNode(resume.getExtendedData());

        // 扩展字段迁移：目标模板或源模板 manifest 声明该字段映射到公共模型时，迁入 common_data；
        // 其余字段保留在 extended_data（新模板不展示但不丢失）。
        List<String> movedKeys = new ArrayList<>();
        Iterator<String> names = extended.fieldNames();
        while (names.hasNext()) {
            String key = names.next();
            String commonPath = findCommonPath(target, key);
            if (commonPath == null && source != null) {
                commonPath = findCommonPath(source, key);
            }
            if (commonPath != null) {
                setByPath(common, commonPath, extended.get(key));
                movedKeys.add(key);
            }
        }
        for (String key : movedKeys) {
            extended.remove(key);
        }

        resume.setCurrentTemplateId(newTemplateId);
        resume.setTemplateCode(newTemplateId);
        resume.setCommonData(writeJson(common));
        resume.setExtendedData(writeJson(extended));
        resumeMapper.updateById(resume);
        log.info("resume switched: userId={}, resumeId={}, from={}, to={}, movedExtendedKeys={}",
                userId, id, oldTemplateId, newTemplateId, movedKeys);
        return resume;
    }

    public boolean delete(Long userId, Long id) {
        Resume resume = getByUser(userId, id);
        if (resume == null) {
            return false;
        }
        resumeMapper.deleteById(id);
        return true;
    }

    public ResumeVO toVO(Resume resume) {
        ResumeVO vo = new ResumeVO();
        vo.setId(resume.getId());
        vo.setUserId(resume.getUserId());
        vo.setTemplateId(resume.getTemplateId());
        vo.setTemplateCode(resume.getTemplateCode());
        vo.setCurrentTemplateId(resume.getCurrentTemplateId());
        vo.setTitle(resume.getTitle());
        vo.setCommonData(parseObjectMap(resume.getCommonData()));
        vo.setExtendedData(parseObjectMap(resume.getExtendedData()));
        vo.setStatus(resume.getStatus());
        vo.setCreatedAt(resume.getCreatedAt());
        vo.setUpdatedAt(resume.getUpdatedAt());
        return vo;
    }

    private ObjectNode normalizeJsonObject(JsonNode node, String fieldName) {
        if (node == null || node.isNull()) {
            return objectMapper.createObjectNode();
        }
        if (node.isTextual()) {
            try {
                JsonNode parsed = objectMapper.readTree(node.asText());
                if (!parsed.isObject()) {
                    throw new IllegalArgumentException(fieldName + " 必须是 JSON 对象");
                }
                return (ObjectNode) parsed;
            } catch (JsonProcessingException e) {
                throw new IllegalArgumentException(fieldName + " 不是合法 JSON");
            }
        }
        if (node.isObject()) {
            return (ObjectNode) node;
        }
        throw new IllegalArgumentException(fieldName + " 必须是 JSON 对象");
    }

    private ObjectNode parseObjectNode(String json) {
        if (json == null || json.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            return node.isObject() ? (ObjectNode) node : objectMapper.createObjectNode();
        } catch (JsonProcessingException e) {
            return objectMapper.createObjectNode();
        }
    }

    private Map<String, Object> parseObjectMap(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            if (!node.isObject()) {
                return new LinkedHashMap<>();
            }
            return objectMapper.convertValue(node, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException e) {
            return new LinkedHashMap<>();
        }
    }

    private String writeJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "数据序列化失败");
        }
    }

    private static String findCommonPath(TemplateManifest manifest, String key) {
        if (manifest == null) {
            return null;
        }
        for (TemplateManifest.FieldDef field : manifest.getFields()) {
            if (field.getName().equals(key) && field.getCommonPath() != null) {
                return field.getCommonPath();
            }
        }
        for (TemplateManifest.FieldDef field : manifest.getPendingManual()) {
            if (field.getName().equals(key) && field.getCommonPath() != null) {
                return field.getCommonPath();
            }
        }
        return null;
    }

    private static void setByPath(ObjectNode root, String path, JsonNode value) {
        String[] parts = path.split("\\.");
        ObjectNode node = root;
        for (int i = 0; i < parts.length - 1; i++) {
            JsonNode child = node.get(parts[i]);
            if (child == null || !child.isObject()) {
                child = node.putObject(parts[i]);
            }
            node = (ObjectNode) child;
        }
        node.set(parts[parts.length - 1], value);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
