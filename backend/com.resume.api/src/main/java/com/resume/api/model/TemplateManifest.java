package com.resume.api.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 模板 manifest：字段定义 + 公共字段映射 + 示例数据。
 *
 * <p>来源约定：
 * <ul>
 *   <li>docs/template/*.manifest.json：存量静态 HTML 模板（analyze-templates.js 自动生成）；</li>
 *   <li>resources/template-manifests/*.json：内置占位符模板；</li>
 *   <li>自定义模板无 manifest 时，由 TemplateConfigService 按 schema 自动推导。</li>
 * </ul>
 */
public class TemplateManifest {

    /** 模板标识（template.code） */
    private String templateId;
    /** 模板名称 */
    private String name;
    /** 源文件名 */
    private String sourceFile;
    /** static=静态 HTML（含示例数据）；placeholder={{}} 占位符模板 */
    private String renderMode;
    /** 字段定义列表 */
    private List<FieldDef> fields = new ArrayList<>();
    /** 公共字段到 DOM 的映射（静态模板使用） */
    private List<MappingDef> mappings = new ArrayList<>();
    /** 自动提取的示例数据（静态模板用于还原原版预览） */
    private Map<String, Object> sampleData = new LinkedHashMap<>();
    /** 无法自动识别、等待人工确认的字段 */
    private List<FieldDef> pendingManual = new ArrayList<>();

    public String getTemplateId() {
        return templateId;
    }

    public void setTemplateId(String templateId) {
        this.templateId = templateId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSourceFile() {
        return sourceFile;
    }

    public void setSourceFile(String sourceFile) {
        this.sourceFile = sourceFile;
    }

    public String getRenderMode() {
        return renderMode;
    }

    public void setRenderMode(String renderMode) {
        this.renderMode = renderMode;
    }

    public List<FieldDef> getFields() {
        return fields;
    }

    public void setFields(List<FieldDef> fields) {
        this.fields = fields;
    }

    public List<MappingDef> getMappings() {
        return mappings;
    }

    public void setMappings(List<MappingDef> mappings) {
        this.mappings = mappings;
    }

    public Map<String, Object> getSampleData() {
        return sampleData;
    }

    public void setSampleData(Map<String, Object> sampleData) {
        this.sampleData = sampleData;
    }

    public List<FieldDef> getPendingManual() {
        return pendingManual;
    }

    public void setPendingManual(List<FieldDef> pendingManual) {
        this.pendingManual = pendingManual;
    }

    /** 字段定义 */
    public static class FieldDef {
        /** 字段名（模板内部使用） */
        private String name;
        /** 展示名 */
        private String label;
        /** string | number | boolean | string[] | object | object[] */
        private String type;
        /** 映射到的公共模型路径，如 basic.name；null 表示模板专属字段 */
        private String commonPath;
        /** 是否自动识别 */
        private boolean autoDetected;
        /** 取值转换，如 skills 取 name */
        private String transform;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getCommonPath() {
            return commonPath;
        }

        public void setCommonPath(String commonPath) {
            this.commonPath = commonPath;
        }

        public boolean isAutoDetected() {
            return autoDetected;
        }

        public void setAutoDetected(boolean autoDetected) {
            this.autoDetected = autoDetected;
        }

        public String getTransform() {
            return transform;
        }

        public void setTransform(String transform) {
            this.transform = transform;
        }
    }

    /** DOM 映射定义 */
    public static class MappingDef {
        /** 公共模型路径 */
        private String commonPath;
        /** CSS 选择器 */
        private String selector;
    /** textContent | href | src 等 */
    private String attribute;
    /** 列表项选择器（attribute=children 时使用） */
    private String itemSelector;
    /** 区块标题（无 selector 时按标题定位区块） */
    private String sectionTitle;
    /** 同选择器命中多个元素时取第几个（1 基） */
    private Integer index;
    /** 是否自动识别 */
    private boolean autoDetected;

        public String getCommonPath() {
            return commonPath;
        }

        public void setCommonPath(String commonPath) {
            this.commonPath = commonPath;
        }

        public String getSelector() {
            return selector;
        }

        public void setSelector(String selector) {
            this.selector = selector;
        }

        public String getAttribute() {
            return attribute;
        }

        public void setAttribute(String attribute) {
            this.attribute = attribute;
        }

        public String getItemSelector() {
            return itemSelector;
        }

        public void setItemSelector(String itemSelector) {
            this.itemSelector = itemSelector;
        }

        public String getSectionTitle() {
            return sectionTitle;
        }

        public void setSectionTitle(String sectionTitle) {
            this.sectionTitle = sectionTitle;
        }

        public Integer getIndex() {
            return index;
        }

        public void setIndex(Integer index) {
            this.index = index;
        }

        public boolean isAutoDetected() {
            return autoDetected;
        }

        public void setAutoDetected(boolean autoDetected) {
            this.autoDetected = autoDetected;
        }
    }
}
