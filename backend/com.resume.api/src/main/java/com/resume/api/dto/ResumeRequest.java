package com.resume.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** 简历请求体：整份 ResumeData 文档 + 标题/状态。 */
public class ResumeRequest {

    @NotBlank(message = "标题不能为空")
    private String title;

    @NotNull(message = "data 不能为空")
    private JsonNode data;

    private Integer status;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public JsonNode getData() { return data; }
    public void setData(JsonNode data) { this.data = data; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
