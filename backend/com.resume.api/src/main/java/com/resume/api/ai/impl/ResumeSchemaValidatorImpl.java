package com.resume.api.ai.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.resume.api.ai.ResumeSchemaValidator;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class ResumeSchemaValidatorImpl implements ResumeSchemaValidator {

    private final JsonSchema schema;

    public ResumeSchemaValidatorImpl(@Value("classpath:schema/resume.schema.json") Resource resource) throws Exception {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        try (InputStream in = resource.getInputStream()) {
            String source = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            this.schema = factory.getSchema(source);
        }
    }

    @Override
    public void validate(JsonNode document) {
        Set<ValidationMessage> errors = schema.validate(document);
        if (!errors.isEmpty()) {
            String detail = errors.stream().map(ValidationMessage::getMessage).collect(Collectors.joining("; "));
            throw new BusinessException(ErrorCode.BAD_REQUEST, "ResumeData 校验失败: " + detail);
        }
    }
}
