package com.resume.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 简历创建/更新请求。
 */
public class ResumeRequest {

    @NotBlank(message = "简历标题不能为空")
    @Size(max = 128, message = "简历标题最长 128 字符")
    private String title;

    @Size(max = 64, message = "模板编码最长 64 字符")
    private String templateCode;

    @NotBlank(message = "简历内容不能为空")
    private String data;

    private Integer status;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getTemplateCode() {
        return templateCode;
    }

    public void setTemplateCode(String templateCode) {
        this.templateCode = templateCode;
    }

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }
}
