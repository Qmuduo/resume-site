package com.resume.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resume.api.ai.ResumeSchemaValidator;
import com.resume.api.ai.impl.ResumeSchemaValidatorImpl;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.dto.ResumeRequest;
import com.resume.api.entity.Resume;
import com.resume.api.repository.ResumeMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;

import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class ResumeServiceTest {

    private ResumeMapper mapper;
    private ResumeService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        mapper = mock(ResumeMapper.class);
        ResumeSchemaValidator validator = new ResumeSchemaValidatorImpl(new FileSystemResource(
                Paths.get("../../docs/resume.schema.json").toAbsolutePath().normalize().toFile()));
        service = new ResumeService(mapper, objectMapper, validator);
    }

    private ResumeRequest validRequest() {
        ObjectNode data = objectMapper.createObjectNode();
        data.put("version", "1.0");
        data.putObject("picture").put("hidden", true).put("url", "").put("size", 128).put("borderRadius", 50);
        ObjectNode basics = data.putObject("basics");
        basics.put("name", "苏轼").put("headline", "工程师").put("email", "a@b.c")
                .put("phone", "1").put("location", "杭州");
        basics.putObject("website").put("url", "").put("label", "");
        basics.putArray("customFields");
        data.putObject("summary").put("title", "简介").put("columns", 1).put("hidden", false).put("content", "");
        data.putObject("sections");
        data.putArray("customSections");
        ObjectNode metadata = data.putObject("metadata");
        metadata.put("template", "prompt_013");
        ObjectNode layout = metadata.putObject("layout");
        layout.putArray("main");
        layout.putArray("sidebar");
        layout.put("sidebarWidth", 30);
        metadata.putObject("page").put("format", "A4").put("margin", 48);
        metadata.putObject("design").putObject("colors")
                .put("primary", "#4F46E5").put("text", "#1A1A1A").put("background", "#FFFFFF");
        metadata.putObject("typography").put("headingFont", "sans-serif").put("bodyFont", "sans-serif").put("fontSize", 12);
        metadata.put("notes", "").put("stylesheet", "");
        ResumeRequest req = new ResumeRequest();
        req.setTitle("测试简历");
        req.setData(data);
        return req;
    }

    @Test
    void createAcceptsValidDocument() {
        service.create(1L, validRequest());
        verify(mapper).insert(any(Resume.class));
    }

    @Test
    void createAcceptsTextualDocument() throws Exception {
        ObjectNode data = (ObjectNode) validRequest().getData();
        ResumeRequest req = new ResumeRequest();
        req.setTitle("字符串文档");
        // 模拟前端 JSON.stringify(data)：data 字段是一个 JSON 字符串
        req.setData(objectMapper.getNodeFactory().textNode(objectMapper.writeValueAsString(data)));
        service.create(1L, req);
        verify(mapper).insert(any(Resume.class));
    }

    @Test
    void createRejectsInvalidDocument() {
        ResumeRequest req = validRequest();
        ((ObjectNode) req.getData()).remove("version");
        assertThrows(BusinessException.class, () -> service.create(1L, req));
        verify(mapper, never()).insert(any(Resume.class));
    }

    @Test
    void toVOCarriesSingleDocument() throws Exception {
        Resume resume = new Resume();
        resume.setId(1L);
        resume.setUserId(1L);
        resume.setTitle("t");
        resume.setData(objectMapper.writeValueAsString(validRequest().getData()));
        assertEquals("prompt_013",
                ((java.util.Map<?, ?>) service.toVO(resume).getData().get("metadata")).get("template"));
    }
}
