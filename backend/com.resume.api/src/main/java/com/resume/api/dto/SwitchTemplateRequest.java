package com.resume.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 切换模板请求：接收新模板ID，内部处理字段映射。
 */
public class SwitchTemplateRequest {

    @NotBlank(message = "newTemplateId 不能为空")
    @Size(max = 64, message = "模板ID最长 64 字符")
    private String newTemplateId;

    public String getNewTemplateId() {
        return newTemplateId;
    }

    public void setNewTemplateId(String newTemplateId) {
        this.newTemplateId = newTemplateId;
    }
}
