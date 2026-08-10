package com.resume.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 模板创建/更新请求。
 * <p>
 * 字段与 docs/template-schema.json 白名单一致（code/name/description/schema/html/css），
 * AI 生成模板输出也必须先过该白名单校验。
 */
public class TemplateRequest {

    @NotBlank(message = "模板编码不能为空")
    @Pattern(regexp = "^[a-zA-Z0-9_-]{1,64}$", message = "模板编码需为 1-64 位字母、数字、下划线或中划线")
    private String code;

    @NotBlank(message = "模板名称不能为空")
    @Size(max = 64, message = "模板名称不能超过 64 字")
    private String name;

    @Size(max = 512, message = "模板描述不能超过 512 字")
    private String description;

    /** 简历数据 JSON Schema，必须是 object */
    @NotNull(message = "模板 schema 不能为空")
    private JsonNode schema;

    @NotBlank(message = "模板 HTML 不能为空")
    @Size(max = 200_000, message = "模板 HTML 过长")
    private String html;

    @NotBlank(message = "模板 CSS 不能为空")
    @Size(max = 200_000, message = "模板 CSS 过长")
    private String css;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public JsonNode getSchema() {
        return schema;
    }

    public void setSchema(JsonNode schema) {
        this.schema = schema;
    }

    public String getHtml() {
        return html;
    }

    public void setHtml(String html) {
        this.html = html;
    }

    public String getCss() {
        return css;
    }

    public void setCss(String css) {
        this.css = css;
    }
}
