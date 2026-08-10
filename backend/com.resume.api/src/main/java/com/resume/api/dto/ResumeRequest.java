package com.resume.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 简历创建/更新请求：公共数据、扩展数据、模板ID 三参数分别入库。
 *
 * <p>commonData / extendedData 兼容两种提交方式：
 * <ul>
 *   <li>JSON 对象（如 {"basic": {...}}）；</li>
 *   <li>JSON 字符串（如 "{\"basic\": {...}}"）。</li>
 * </ul>
 */
public class ResumeRequest {

    @NotBlank(message = "简历标题不能为空")
    @Size(max = 128, message = "简历标题最长 128 字符")
    private String title;

    @Size(max = 64, message = "模板ID最长 64 字符")
    private String currentTemplateId;

    /** 公共数据（JSON 对象或 JSON 字符串） */
    private JsonNode commonData;

    /** 模板专属数据（JSON 对象或 JSON 字符串） */
    private JsonNode extendedData;

    private Integer status;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCurrentTemplateId() {
        return currentTemplateId;
    }

    public void setCurrentTemplateId(String currentTemplateId) {
        this.currentTemplateId = currentTemplateId;
    }

    public JsonNode getCommonData() {
        return commonData;
    }

    public void setCommonData(JsonNode commonData) {
        this.commonData = commonData;
    }

    public JsonNode getExtendedData() {
        return extendedData;
    }

    public void setExtendedData(JsonNode extendedData) {
        this.extendedData = extendedData;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }
}
