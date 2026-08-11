package com.resume.api.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 模板 manifest v2：语义区块声明 + 主题变量 + 示例数据。
 * JSON 原样透传（regions/blocks/theme/customFields 均为通用 Map 结构）。
 */
public class TemplateManifest {

    private String templateId;
    private String name;
    private String sourceFile;
    /** semantic | placeholder */
    private String renderMode;
    private List<Map<String, Object>> regions = new ArrayList<>();
    private List<Map<String, Object>> blocks = new ArrayList<>();
    private List<Map<String, Object>> theme = new ArrayList<>();
    private Map<String, Object> sampleData = new LinkedHashMap<>();
    private List<Map<String, Object>> customFields = new ArrayList<>();

    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSourceFile() { return sourceFile; }
    public void setSourceFile(String sourceFile) { this.sourceFile = sourceFile; }
    public String getRenderMode() { return renderMode; }
    public void setRenderMode(String renderMode) { this.renderMode = renderMode; }
    public List<Map<String, Object>> getRegions() { return regions; }
    public void setRegions(List<Map<String, Object>> regions) { this.regions = regions; }
    public List<Map<String, Object>> getBlocks() { return blocks; }
    public void setBlocks(List<Map<String, Object>> blocks) { this.blocks = blocks; }
    public List<Map<String, Object>> getTheme() { return theme; }
    public void setTheme(List<Map<String, Object>> theme) { this.theme = theme; }
    public Map<String, Object> getSampleData() { return sampleData; }
    public void setSampleData(Map<String, Object> sampleData) { this.sampleData = sampleData; }
    public List<Map<String, Object>> getCustomFields() { return customFields; }
    public void setCustomFields(List<Map<String, Object>> customFields) { this.customFields = customFields; }
}
