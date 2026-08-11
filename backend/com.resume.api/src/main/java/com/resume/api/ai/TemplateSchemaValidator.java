package com.resume.api.ai;

import com.fasterxml.jackson.databind.JsonNode;

/** 模板校验：manifest v2 白名单 + HTML/CSS 危险内容检查。 */
public interface TemplateSchemaValidator {

    /** 校验 manifest v2 结构，不合法抛 BusinessException(BAD_REQUEST)。 */
    void validateManifest(JsonNode manifest);

    /** 校验 HTML/CSS 不含 script、on 事件、javascript: 等危险内容。 */
    void validateContent(String html, String css);
}
