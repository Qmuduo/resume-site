package com.resume.api.ai;

import com.fasterxml.jackson.databind.JsonNode;

/** ResumeData 文档校验：以 docs/resume.schema.json 为准。 */
public interface ResumeSchemaValidator {

    /** 校验整份 ResumeData，不合法抛 BusinessException(BAD_REQUEST)。 */
    void validate(JsonNode document);
}
