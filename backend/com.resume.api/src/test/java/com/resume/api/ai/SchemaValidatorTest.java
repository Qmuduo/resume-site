package com.resume.api.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resume.api.ai.impl.ResumeSchemaValidatorImpl;
import com.resume.api.ai.impl.TemplateSchemaValidatorImpl;
import com.resume.api.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;

import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SchemaValidatorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private ResumeSchemaValidator resumeValidator() throws Exception {
        return new ResumeSchemaValidatorImpl(new FileSystemResource(
                Paths.get("../../docs/resume.schema.json").toAbsolutePath().normalize().toFile()));
    }

    private TemplateSchemaValidator templateValidator() throws Exception {
        return new TemplateSchemaValidatorImpl(new FileSystemResource(
                Paths.get("../../docs/template-schema.json").toAbsolutePath().normalize().toFile()));
    }

    @Test
    void acceptsValidResumeDocument() throws Exception {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("version", "1.0");
        doc.putObject("picture").put("hidden", true).put("url", "").put("size", 128).put("borderRadius", 50);
        ObjectNode basics = doc.putObject("basics");
        basics.put("name", "苏轼").put("headline", "全栈工程师").put("email", "a@b.c")
                .put("phone", "13800000000").put("location", "杭州");
        basics.putObject("website").put("url", "").put("label", "");
        basics.putArray("customFields");
        doc.putObject("summary").put("title", "个人简介").put("columns", 1).put("hidden", false).put("content", "");
        doc.putObject("sections");
        doc.putArray("customSections");
        ObjectNode metadata = doc.putObject("metadata");
        metadata.put("template", "prompt_013");
        ObjectNode layout = metadata.putObject("layout");
        layout.putArray("main").add("experience");
        layout.putArray("sidebar");
        layout.put("sidebarWidth", 30);
        metadata.putObject("page").put("format", "A4").put("margin", 48);
        metadata.putObject("design").putObject("colors")
                .put("primary", "#4F46E5").put("text", "#1A1A1A").put("background", "#FFFFFF");
        metadata.putObject("typography")
                .put("headingFont", "sans-serif").put("bodyFont", "sans-serif").put("fontSize", 12);
        metadata.put("notes", "").put("stylesheet", "");
        assertDoesNotThrow(() -> resumeValidator().validate(doc));
    }

    @Test
    void rejectsMissingVersion() {
        assertThrows(BusinessException.class, () -> resumeValidator().validate(mapper.createObjectNode()));
    }

    @Test
    void allowsScriptInHtmlAndRejectsDangerousCss() throws Exception {
        // 模板 HTML 允许 script/on*（沙箱 iframe 隔离执行）
        assertDoesNotThrow(() -> templateValidator().validateContent(
                "<script>alert(1)</script><a onclick=\"x()\">x</a>", ""));
        // CSS 仍拦截 url(javascript:) 等危险内容
        assertThrows(BusinessException.class,
                () -> templateValidator().validateContent("", "body { background: url(javascript:alert(1)); }"));
    }
}
