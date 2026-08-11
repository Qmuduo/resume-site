package com.resume.api.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resume.api.ai.ResumeSchemaValidator;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import com.resume.api.dto.ResumeRequest;
import com.resume.api.entity.Resume;
import com.resume.api.repository.ResumeMapper;
import com.resume.api.vo.ResumeVO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 简历服务：resume.data 单文档存取，写入前过 ResumeSchemaValidator。 */
@Service
public class ResumeService {

    private final ResumeMapper resumeMapper;
    private final ObjectMapper objectMapper;
    private final ResumeSchemaValidator resumeSchemaValidator;

    public ResumeService(ResumeMapper resumeMapper,
                         ObjectMapper objectMapper,
                         ResumeSchemaValidator resumeSchemaValidator) {
        this.resumeMapper = resumeMapper;
        this.objectMapper = objectMapper;
        this.resumeSchemaValidator = resumeSchemaValidator;
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
        JsonNode document = normalizeDocument(request.getData());
        resumeSchemaValidator.validate(document);
        Resume resume = new Resume();
        resume.setUserId(userId);
        resume.setTitle(request.getTitle().trim());
        resume.setData(writeJson(document));
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
        JsonNode document = normalizeDocument(request.getData());
        resumeSchemaValidator.validate(document);
        resume.setTitle(request.getTitle().trim());
        resume.setData(writeJson(document));
        if (request.getStatus() != null) {
            resume.setStatus(request.getStatus());
        }
        resumeMapper.updateById(resume);
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
        vo.setTitle(resume.getTitle());
        vo.setData(parseObjectMap(resume.getData()));
        vo.setStatus(resume.getStatus());
        vo.setCreatedAt(resume.getCreatedAt());
        vo.setUpdatedAt(resume.getUpdatedAt());
        return vo;
    }

    /** 兼容 data 传对象或 JSON 字符串两种形态，统一归一化为对象节点。 */
    private JsonNode normalizeDocument(JsonNode node) {
        if (node == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "data 不能为空");
        }
        if (node.isTextual()) {
            try {
                JsonNode parsed = objectMapper.readTree(node.asText());
                if (!parsed.isObject()) {
                    throw new BusinessException(ErrorCode.BAD_REQUEST, "data 必须是 JSON 对象");
                }
                return parsed;
            } catch (JsonProcessingException e) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "data 不是合法 JSON");
            }
        }
        if (!node.isObject()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "data 必须是 JSON 对象");
        }
        return node;
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
            return objectMapper.convertValue(node,
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { });
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
}
