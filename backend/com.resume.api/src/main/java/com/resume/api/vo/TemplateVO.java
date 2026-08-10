package com.resume.api.vo;

import java.time.LocalDateTime;

/**
 * 模板视图对象：schema_json 已解析为对象返回。
 */
public class TemplateVO {

    private Long id;
    private Long userId;
    private String code;
    private String name;
    private String description;
    private Object schema;
    private String html;
    private String css;
    private Integer builtin;
    /** 模板 manifest（字段定义与映射关系），无 manifest 时为 null */
    private Object manifest;
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

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

    public Object getSchema() {
        return schema;
    }

    public void setSchema(Object schema) {
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

    public Integer getBuiltin() {
        return builtin;
    }

    public void setBuiltin(Integer builtin) {
        this.builtin = builtin;
    }

    public Object getManifest() {
        return manifest;
    }

    public void setManifest(Object manifest) {
        this.manifest = manifest;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
