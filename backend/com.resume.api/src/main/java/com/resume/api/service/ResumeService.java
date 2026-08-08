package com.resume.api.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resume.api.dto.ResumeRequest;
import com.resume.api.entity.Resume;
import com.resume.api.repository.ResumeMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 简历 CRUD 服务。
 */
@Service
public class ResumeService {

    private final ResumeMapper resumeMapper;
    private final ObjectMapper objectMapper;

    public ResumeService(ResumeMapper resumeMapper, ObjectMapper objectMapper) {
        this.resumeMapper = resumeMapper;
        this.objectMapper = objectMapper;
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

    public Resume create(Long userId, ResumeRequest request) {
        validateDataJson(request.getData());
        Resume resume = new Resume();
        resume.setUserId(userId);
        resume.setTitle(request.getTitle().trim());
        resume.setTemplateCode(request.getTemplateCode());
        resume.setData(request.getData());
        resume.setStatus(request.getStatus() == null ? 0 : request.getStatus());
        resumeMapper.insert(resume);
        return resume;
    }

    public Resume update(Long userId, Long id, ResumeRequest request) {
        Resume resume = getByUser(userId, id);
        if (resume == null) {
            return null;
        }
        validateDataJson(request.getData());
        resume.setTitle(request.getTitle().trim());
        resume.setTemplateCode(request.getTemplateCode());
        resume.setData(request.getData());
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

    private void validateDataJson(String data) {
        try {
            objectMapper.readTree(data);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("data 不是合法 JSON");
        }
    }
}
