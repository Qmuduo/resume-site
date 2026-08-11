package com.resume.api.ai.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.resume.api.ai.TemplateSchemaValidator;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class TemplateSchemaValidatorImpl implements TemplateSchemaValidator {

    private static final Pattern DANGEROUS_HTML =
            Pattern.compile("(?is)<script|\\son\\w+\\s*=|javascript:|data:\\s*text/html|vbscript:");
    private static final Pattern DANGEROUS_CSS =
            Pattern.compile("(?i)expression\\s*\\(|@import|javascript:|url\\s*\\(");

    private final JsonSchema manifestSchema;

    public TemplateSchemaValidatorImpl(@Value("classpath:schema/template.schema.json") Resource resource) throws Exception {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        try (InputStream in = resource.getInputStream()) {
            this.manifestSchema = factory.getSchema(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    @Override
    public void validateManifest(JsonNode manifest) {
        Set<ValidationMessage> errors = manifestSchema.validate(manifest);
        if (!errors.isEmpty()) {
            String detail = errors.stream().map(ValidationMessage::getMessage).collect(Collectors.joining("; "));
            throw new BusinessException(ErrorCode.BAD_REQUEST, "模板 manifest 校验失败: " + detail);
        }
    }

    @Override
    public void validateContent(String html, String css) {
        if (html != null && DANGEROUS_HTML.matcher(html).find()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "模板 HTML 包含危险内容");
        }
        if (css != null && DANGEROUS_CSS.matcher(css).find()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "模板 CSS 包含危险内容");
        }
    }
}
