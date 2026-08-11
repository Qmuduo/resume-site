# 对齐 Reactive-Resume 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有简历应用改造成 reactive-resume 式架构：ResumeData 单文档数据模型 + 语义化 HTML/CSS 模板体系 + 三栏编辑体验。

**Architecture:** 后端先行分层推进。阶段一落地 `resume.data` 单文档与 JSON Schema 校验（含存量数据迁移）；阶段二把模板体系升级为语义区块 + 主题变量并改造 13 份内置模板；阶段三重写编辑器为三栏（区块列表 / 表单 / 预览+设计）。前后端共用 docs/resume.schema.json 契约。

**Tech Stack:** Spring Boot 3.2 + Java 17 + MyBatis-Plus + MySQL 8（JSON 函数）+ networknt json-schema-validator；Vue 3.5 + Vite + TypeScript + Pinia + Element Plus + Tiptap + SortableJS/vuedraggable + ESLint。

## Global Constraints

- 本机 shell 为 Windows PowerShell 5.1，不支持 `&&`；多命令一律用 `;` 连接。
- 后端改动后必须 `cd backend; mvn -q test` 全绿；前端改动后必须 `cd frontend; npm run build` 全绿（ESLint 配置完成后加 `npm run lint`）。
- 简历数据只存 `resume.data` 单 JSON 列，契约以 docs/resume.schema.json 为准；禁止在文档外另建列/表存简历字段。
- 模板只允许 HTML/CSS：禁止 `<script>`、`on*` 事件、`javascript:`；前端渲染必须二次消毒（sanitizeHtml/sanitizeCss）。
- 模板强制语义类名（resume-page/resume-header/resume-main/resume-sidebar、section/section-title/section-items、entry/entry-header/entry-meta/entry-body、contact-item、skill-tag、edu-*、proj-*），主题用 CSS 变量（--color-primary 等）。
- 已批准新增依赖：@tiptap/*、vuedraggable、ESLint + eslint-plugin-vue、com.networknt:json-schema-validator。除此之外新增依赖必须先问用户。
- 演示数据姓名一律取名单：屈原、陶渊明、李白、杜甫、白居易、王维、李商隐、苏轼、辛弃疾、李清照。
- 分支命名 codex/*；每个任务独立 commit，信息按约定（feat/fix/refactor/style/docs/chore）。
- AI 本期只落校验器接口（ResumeSchemaValidator / TemplateSchemaValidator），不实现 LLM 调用。

## 文件结构总览

- docs/resume.schema.json：ResumeData v1.0 唯一契约（新建）
- docs/sql/schema-v3.sql：`resume.data` 列 DDL（新建）
- docs/sql/migrate-resume-v3.sql：备份+迁移+校验 SQL（新建）
- docs/sql/generated/extended-mapping.sql：manifest 字段映射（由脚本生成）
- scripts/migrate-resume-v3.js：读取 manifest 生成映射 SQL（新建）
- scripts/validate-resume-doc.js：ResumeData 轻量结构校验（新建）
- backend ai/ 包：ResumeSchemaValidator / TemplateSchemaValidator 接口与实现（新建）
- backend entity/Resume.java、dto/ResumeRequest.java、vo/ResumeVO.java、service/ResumeService.java（改写）
- backend pom.xml（加 networknt 依赖）
- docs/template-schema.json：manifest v2 白名单（改写）
- scripts/analyze-templates.js、validate-template.js、semanticize-template.js（改写/新建）
- docs/template/*.html + *.manifest.json：13 份模板语义化（改写）
- frontend/src/types/resume.ts、index.ts（改写）
- frontend/src/template-engine/index.ts（改写为语义渲染器）
- frontend/src/stores/resumeStore.ts、api/resume.ts（改写）
- frontend/src/components/builder/*（三栏编辑器，新建）
- frontend/package.json、eslint.config.js（新增依赖与配置）

---

# Phase 1：数据模型与迁移

## Task 1: docs/resume.schema.json（ResumeData v1.0 契约）

**Files:**
- Create: `docs/resume.schema.json`
- Create: `scripts/validate-resume-doc.js`
- Create: `docs/sample-resume-data.json`

**Interfaces:**
- Produces: `docs/resume.schema.json`（draft 2020-12）；版本号 `"1.0"`；顶层键 version/basics/summary/sections/customSections/picture/metadata。

- [ ] **Step 1: 写轻量校验脚本（测试载体）**

Create `scripts/validate-resume-doc.js`：

```javascript
'use strict';
const fs = require('fs');

const TOP_LEVEL = ['version', 'basics', 'summary', 'sections', 'customSections', 'picture', 'metadata'];
const SECTION_KEYS = ['profiles', 'experience', 'education', 'projects', 'skills', 'languages',
  'interests', 'awards', 'certifications', 'publications', 'volunteer', 'references'];

function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function checkSection(sec, errors, prefix) {
  if (!isObject(sec)) { errors.push(`${prefix} 必须是对象`); return; }
  for (const key of ['title', 'columns', 'hidden', 'items']) {
    if (!(key in sec)) errors.push(`${prefix} 缺少 ${key}`);
  }
  if (!Array.isArray(sec.items)) { errors.push(`${prefix}.items 必须是数组`); return; }
  sec.items.forEach((item, i) => {
    if (!isObject(item)) { errors.push(`${prefix}.items[${i}] 必须是对象`); return; }
    if (typeof item.id !== 'string' || item.id.length === 0) errors.push(`${prefix}.items[${i}].id 缺失`);
    if (typeof item.hidden !== 'boolean') errors.push(`${prefix}.items[${i}].hidden 缺失`);
  });
}

function validateDocument(doc) {
  const errors = [];
  if (!isObject(doc)) return ['文档必须是对象'];
  for (const key of TOP_LEVEL) if (!(key in doc)) errors.push(`缺少顶层字段 ${key}`);
  if (doc.version !== '1.0') errors.push(`version 必须为 1.0，实际 ${doc.version}`);
  if (!isObject(doc.basics) || typeof doc.basics.name !== 'string') errors.push('basics.name 必须是字符串');
  if (!Array.isArray(doc.customSections)) errors.push('customSections 必须是数组');
  doc.customSections.forEach((s, i) => checkSection(s, errors, `customSections[${i}]`));
  if (!isObject(doc.sections)) { errors.push('sections 必须是对象'); }
  else {
    for (const key of SECTION_KEYS) if (key in doc.sections) checkSection(doc.sections[key], errors, `sections.${key}`);
  }
  if (!isObject(doc.metadata) || typeof doc.metadata.template !== 'string') errors.push('metadata.template 必须是字符串');
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) { console.error('用法: node scripts/validate-resume-doc.js <resume.json>'); process.exit(2); }
  const doc = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  const errors = validateDocument(doc);
  if (errors.length > 0) { console.error(errors.join('\n')); process.exit(1); }
  console.log('OK: ResumeData 结构校验通过');
}

module.exports = { validateDocument };
if (require.main === module) main();
```

- [ ] **Step 2: 运行脚本确认失败**

Run: `node scripts/validate-resume-doc.js docs/resume.schema.json`
Expected: FAIL（schema 文件不是合法 ResumeData 文档，报缺少 version 等字段）

- [ ] **Step 3: 写完整 schema 文件**

Create `docs/resume.schema.json`：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://resume-site.local/schemas/resume.schema.json",
  "title": "ResumeData",
  "description": "简历单文档模型，对齐 reactive-resume v5；后端保存校验与前端类型定义的唯一契约。",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "version": { "const": "1.0" },
    "picture": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "hidden": { "type": "boolean" },
        "url": { "type": "string" },
        "size": { "type": "number", "minimum": 32, "maximum": 512 },
        "borderRadius": { "type": "number", "minimum": 0, "maximum": 100 }
      },
      "required": ["hidden", "url", "size", "borderRadius"]
    },
    "basics": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string" },
        "headline": { "type": "string" },
        "email": { "type": "string" },
        "phone": { "type": "string" },
        "location": { "type": "string" },
        "website": {
          "type": "object",
          "additionalProperties": false,
          "properties": { "url": { "type": "string" }, "label": { "type": "string" } },
          "required": ["url", "label"]
        },
        "customFields": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "id": { "type": "string" },
              "icon": { "type": "string" },
              "text": { "type": "string" },
              "link": { "type": "string" }
            },
            "required": ["id", "icon", "text", "link"]
          }
        }
      },
      "required": ["name", "headline", "email", "phone", "location", "website", "customFields"]
    },
    "summary": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "title": { "type": "string" },
        "columns": { "type": "integer", "minimum": 1, "maximum": 6 },
        "hidden": { "type": "boolean" },
        "content": { "type": "string", "description": "受控 HTML" }
      },
      "required": ["title", "columns", "hidden", "content"]
    },
    "sections": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "profiles": { "$ref": "#/$defs/section" },
        "experience": { "$ref": "#/$defs/section" },
        "education": { "$ref": "#/$defs/section" },
        "projects": { "$ref": "#/$defs/section" },
        "skills": { "$ref": "#/$defs/section" },
        "languages": { "$ref": "#/$defs/section" },
        "interests": { "$ref": "#/$defs/section" },
        "awards": { "$ref": "#/$defs/section" },
        "certifications": { "$ref": "#/$defs/section" },
        "publications": { "$ref": "#/$defs/section" },
        "volunteer": { "$ref": "#/$defs/section" },
        "references": { "$ref": "#/$defs/section" }
      }
    },
    "customSections": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "columns": { "type": "integer", "minimum": 1, "maximum": 6 },
          "hidden": { "type": "boolean" },
          "items": { "type": "array" }
        },
        "required": ["id", "title", "columns", "hidden", "items"]
      }
    },
    "metadata": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "template": { "type": "string" },
        "layout": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "main": { "type": "array", "items": { "type": "string" } },
            "sidebar": { "type": "array", "items": { "type": "string" } },
            "sidebarWidth": { "type": "number", "minimum": 20, "maximum": 80 }
          },
          "required": ["main", "sidebar", "sidebarWidth"]
        },
        "page": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "format": { "enum": ["A4", "Letter"] },
            "margin": { "type": "number", "minimum": 0, "maximum": 100 }
          },
          "required": ["format", "margin"]
        },
        "design": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "colors": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "primary": { "type": "string" },
                "text": { "type": "string" },
                "background": { "type": "string" },
                "sidebarBackground": { "type": "string" },
                "sidebarForeground": { "type": "string" }
              },
              "required": ["primary", "text", "background"]
            }
          },
          "required": ["colors"]
        },
        "typography": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "headingFont": { "type": "string" },
            "bodyFont": { "type": "string" },
            "fontSize": { "type": "number", "minimum": 8, "maximum": 20 }
          },
          "required": ["headingFont", "bodyFont", "fontSize"]
        },
        "notes": { "type": "string" },
        "stylesheet": { "type": "string", "description": "自定义 CSS（渲染前消毒）" }
      },
      "required": ["template", "layout", "page", "design", "typography", "notes", "stylesheet"]
    }
  },
  "required": ["version", "basics", "summary", "sections", "customSections", "picture", "metadata"],
  "$defs": {
    "section": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "title": { "type": "string" },
        "columns": { "type": "integer", "minimum": 1, "maximum": 6 },
        "hidden": { "type": "boolean" },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true,
            "required": ["id", "hidden"]
          }
        }
      },
      "required": ["title", "columns", "hidden", "items"]
    }
  }
}
```

- [ ] **Step 4: 建立最小合法样例并跑通测试**

Create `docs/sample-resume-data.json`：

```json
{
  "version": "1.0",
  "picture": { "hidden": true, "url": "", "size": 128, "borderRadius": 50 },
  "basics": { "name": "苏轼", "headline": "全栈工程师", "email": "sushi@example.com", "phone": "13800000000", "location": "杭州", "website": { "url": "", "label": "" }, "customFields": [] },
  "summary": { "title": "个人简介", "columns": 1, "hidden": false, "content": "" },
  "sections": {
    "experience": { "title": "工作经历", "columns": 1, "hidden": false, "items": [ { "id": "exp-1", "hidden": false, "company": "示例公司", "position": "工程师", "period": "2020-01 - 至今", "description": "" } ] }
  },
  "customSections": [],
  "metadata": {
    "template": "prompt_013",
    "layout": { "main": ["experience"], "sidebar": [], "sidebarWidth": 30 },
    "page": { "format": "A4", "margin": 48 },
    "design": { "colors": { "primary": "#4F46E5", "text": "#1A1A1A", "background": "#FFFFFF" } },
    "typography": { "headingFont": "sans-serif", "bodyFont": "sans-serif", "fontSize": 12 },
    "notes": "",
    "stylesheet": ""
  }
}
```

Run: `node scripts/validate-resume-doc.js docs/sample-resume-data.json`
Expected: PASS（"OK: ResumeData 结构校验通过"）

- [ ] **Step 5: Commit**

```powershell
git add docs/resume.schema.json docs/sample-resume-data.json scripts/validate-resume-doc.js
git commit -m "feat: add ResumeData v1.0 schema contract and sample document"
```

## Task 2: docs/sql/schema-v3.sql（resume.data 列）

**Files:**
- Create: `docs/sql/schema-v3.sql`

**Interfaces:**
- Consumes: Task 1 的 `docs/resume.schema.json`
- Produces: 幂等 DDL：`resume` 表新增 `data JSON` 列。

- [ ] **Step 1: 写 DDL（幂等）**

Create `docs/sql/schema-v3.sql`：

```sql
-- ============================================================
-- Resume Template Site v3 结构变更（MySQL 8）
-- 目标：resume.data 单文档 JSON 列（ResumeData v1.0）
-- 旧列 common_data / extended_data / current_template_id / template_code / template_id 退役
-- 本脚本幂等，可重复执行；数据迁移见 migrate-resume-v3.sql
-- ============================================================

USE resume;

-- 1. 新增 data 列（MySQL 8 无 ADD COLUMN IF NOT EXISTS，用 information_schema 守护）
SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `resume` ADD COLUMN data JSON NULL COMMENT ''ResumeData 单文档（version 1.0）'' AFTER title',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'data'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 校验
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'resume'
  AND COLUMN_NAME = 'data'
ORDER BY ORDINAL_POSITION;
```

- [ ] **Step 2: 验证 SQL 可重复执行**

Run: `mysql -uroot -p123456 resume < docs/sql/schema-v3.sql` 连续两遍
Expected: 两遍都成功，最后查询返回 1 行 `data JSON YES ResumeData 单文档（version 1.0）`

- [ ] **Step 3: Commit**

```powershell
git add docs/sql/schema-v3.sql
git commit -m "feat: add resume.data single-document column DDL"
```

## Task 3: scripts/migrate-resume-v3.js（manifest → 映射 SQL 生成器）

**Files:**
- Create: `scripts/migrate-resume-v3.js`
- Create: `docs/sql/generated/extended-mapping.sql`（脚本输出）

**Interfaces:**
- Consumes: `docs/template/*.manifest.json`、`backend/com.resume.api/src/main/resources/template-manifests/*.json`
- Produces: `docs/sql/generated/extended-mapping.sql`，内容是 `INSERT INTO ext_map (template_code, field_name, common_path) VALUES ...`（Task 4 先建 ext_map 临时表再 source 本文件）。
- 说明：v2 迁移已把可映射的公共键移入 common_data；本映射表只用于把 extended_data 中**仍可**按旧 manifest 回填的键标出来，其余键由 Task 4 无损放入 customSections。

- [ ] **Step 1: 写脚本**

Create `scripts/migrate-resume-v3.js`：

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

function loadManifests(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.manifest.json')) continue;
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (Array.isArray(raw.fields)) out.push(raw);
    }
  }
  return out;
}

function main() {
  const dirs = [
    path.resolve(__dirname, '../docs/template'),
    path.resolve(__dirname, '../backend/com.resume.api/src/main/resources/template-manifests')
  ];
  const manifests = loadManifests(dirs);
  const rows = [];
  for (const manifest of manifests) {
    for (const field of manifest.fields || []) {
      if (field.commonPath) rows.push({ templateCode: manifest.templateId, fieldName: field.name, commonPath: field.commonPath });
    }
  }
  const lines = rows.map((r) =>
    `INSERT INTO ext_map (template_code, field_name, common_path) VALUES ('${r.templateCode}', '${r.fieldName}', '${r.commonPath}');`
  );
  const dir = path.resolve(__dirname, '../docs/sql/generated');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'extended-mapping.sql');
  fs.writeFileSync(file, `-- generated by scripts/migrate-resume-v3.js\n${lines.join('\n')}\n`, 'utf8');
  console.log(`written ${file} (${rows.length} mappings)`);
}

main();
```

- [ ] **Step 2: 运行并核对输出**

Run: `node scripts/migrate-resume-v3.js`
Expected: 输出 `written ...\extended-mapping.sql (N mappings)`，N > 0；文件每行形如 `INSERT INTO ext_map ...`

- [ ] **Step 3: Commit**

```powershell
git add scripts/migrate-resume-v3.js docs/sql/generated/extended-mapping.sql
git commit -m "feat: generate extended-data mapping SQL from template manifests"
```

## Task 4: docs/sql/migrate-resume-v3.sql（备份 + 迁移 + 校验）

**Files:**
- Create: `docs/sql/migrate-resume-v3.sql`

**Interfaces:**
- Consumes: Task 2 的 `data` 列、Task 3 的 `docs/sql/generated/extended-mapping.sql`
- Produces: 备份表 `resume_backup_pre_v3`；把 common_data/extended_data/current_template_id 合并进 `resume.data`；末尾注释保留旧列 DROP（人工确认后执行）。

- [ ] **Step 1: 写迁移 SQL**

Create `docs/sql/migrate-resume-v3.sql`：

```sql
-- ============================================================
-- Resume v3 数据迁移：common_data + extended_data + current_template_id -> resume.data
-- 使用前必须：1) 全量备份；2) 先跑 schema-v3.sql；3) 先跑 scripts/migrate-resume-v3.js 生成映射
-- 回滚：ALTER TABLE resume RENAME TO resume_v3_broken; ALTER TABLE resume_backup_pre_v3 RENAME TO resume;
-- ============================================================

USE resume;

-- 0. 备份（阻塞级，勿跳过）
CREATE TABLE IF NOT EXISTS resume_backup_pre_v3 LIKE resume;
INSERT IGNORE INTO resume_backup_pre_v3 SELECT * FROM resume;
SELECT (SELECT COUNT(*) FROM resume) AS resume_rows, (SELECT COUNT(*) FROM resume_backup_pre_v3) AS backup_rows;

-- 1. 数据列与映射表
CREATE TEMPORARY TABLE ext_map (
  template_code VARCHAR(64) NOT NULL,
  field_name    VARCHAR(128) NOT NULL,
  common_path   VARCHAR(255) NOT NULL,
  PRIMARY KEY (template_code, field_name)
);
SOURCE docs/sql/generated/extended-mapping.sql;

-- 2. 合并生成 data 文档（仅处理 data IS NULL 且旧列有数据的行，可重复执行）
UPDATE resume r
LEFT JOIN ext_map em
  ON em.template_code = r.current_template_id
SET r.data = JSON_OBJECT(
  'version', '1.0',
  'picture', JSON_OBJECT('hidden', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.avatar')), 'null'), '') = '', 'url', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.avatar')), 'null'), ''), 'size', 128, 'borderRadius', 50),
  'basics', JSON_OBJECT(
    'name', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.name')), 'null'), ''),
    'headline', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.title')), 'null'), ''),
    'email', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.email')), 'null'), ''),
    'phone', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.phone')), 'null'), ''),
    'location', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.location')), 'null'), ''),
    'website', JSON_OBJECT('url', '', 'label', ''),
    'customFields', IF(
      JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.address')) IS NULL
        OR JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.address')) = '',
      JSON_ARRAY(),
      JSON_ARRAY(JSON_OBJECT('id', UUID(), 'icon', '', 'text', JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.basic.address')), 'link', ''))
    )
  ),
  'summary', JSON_OBJECT('title', '个人简介', 'columns', 1, 'hidden', FALSE,
    'content', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.common_data, '$.summary')), 'null'), '')),
  'sections', JSON_OBJECT(
    'profiles', JSON_OBJECT('title', '社交链接', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'network', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.platform')),
        'username', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.url')),
        'website', JSON_OBJECT('url', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.url')), ''), 'label', '', 'inlineLink', FALSE)))
      FROM JSON_TABLE(r.common_data, '$.socials[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY())),
    'experience', JSON_OBJECT('title', '工作经历', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'company', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.company')),
        'position', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.position')),
        'location', '', 'period', CONCAT_WS(' - ', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.start')), JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.end'))),
        'website', JSON_OBJECT('url', '', 'label', '', 'inlineLink', FALSE),
        'description', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.description')), '')))
      FROM JSON_TABLE(r.common_data, '$.experiences[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY())),
    'education', JSON_OBJECT('title', '教育背景', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'school', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.school')),
        'degree', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.degree')),
        'major', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.major')),
        'period', CONCAT_WS(' - ', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.start')), JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.end'))),
        'description', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.description')), '')))
      FROM JSON_TABLE(r.common_data, '$.education[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY())),
    'skills', JSON_OBJECT('title', '技能清单', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
        'level', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.level')), '')))
      FROM JSON_TABLE(r.common_data, '$.skills[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY())),
    'projects', JSON_OBJECT('title', '项目经验', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
        'role', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.role')),
        'period', CONCAT_WS(' - ', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.start')), JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.end'))),
        'description', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.description')), ''),
        'website', JSON_OBJECT('url', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.link')), ''), 'label', '', 'inlineLink', FALSE)))
      FROM JSON_TABLE(r.common_data, '$.projects[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY())),
    'certifications', JSON_OBJECT('title', '证书', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
        'issuer', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.issuer')),
        'date', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.date'))))
      FROM JSON_TABLE(r.common_data, '$.certifications[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY())),
    'languages', JSON_OBJECT('title', '语言能力', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
        'level', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.level')), '')))
      FROM JSON_TABLE(r.common_data, '$.languages[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY())),
    'awards', JSON_OBJECT('title', '荣誉奖项', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
        'date', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.date')),
        'description', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.description')), '')))
      FROM JSON_TABLE(r.common_data, '$.awards[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY())),
    'interests', JSON_OBJECT('title', '兴趣爱好', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
      SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE, 'name', JSON_UNQUOTE(x.`value`)))
      FROM JSON_TABLE(r.common_data, '$.interests[*]' COLUMNS (`value` JSON PATH '$')) x
    ), JSON_ARRAY()))
  ),
  'customSections', COALESCE((
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
      'id', UUID(), 'title', CONCAT('模板专属：', k.`key`), 'columns', 1, 'hidden', FALSE,
      'items', JSON_ARRAY(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
        'name', k.`key`,
        'description', CAST(JSON_EXTRACT(r.extended_data, CONCAT('$."', k.`key`, '"')) AS CHAR)))))
    FROM JSON_TABLE(JSON_KEYS(COALESCE(r.extended_data, JSON_OBJECT())), '$[*]' COLUMNS (`key` VARCHAR(255) PATH '$')) k
    LEFT JOIN ext_map em
      ON em.template_code = r.current_template_id AND em.field_name = k.`key`
    WHERE em.common_path IS NULL
  ), JSON_ARRAY()),
  'metadata', JSON_OBJECT(
    'template', COALESCE(r.current_template_id, 'cv2'),
    'layout', JSON_OBJECT('main', JSON_ARRAY('profiles','experience','education','skills','projects','certifications','languages','awards','interests'), 'sidebar', JSON_ARRAY(), 'sidebarWidth', 30),
    'page', JSON_OBJECT('format', 'A4', 'margin', 48),
    'design', JSON_OBJECT('colors', JSON_OBJECT('primary', '#4F46E5', 'text', '#1A1A1A', 'background', '#FFFFFF')),
    'typography', JSON_OBJECT('headingFont', 'sans-serif', 'bodyFont', 'sans-serif', 'fontSize', 12),
    'notes', '', 'stylesheet', ''
  )
)
WHERE r.data IS NULL AND r.common_data IS NOT NULL;

-- 3. 校验（必须全部通过）
SELECT
  (SELECT COUNT(*) FROM resume) AS total_rows,
  SUM(data IS NULL) AS null_data,
  SUM(JSON_VALID(data) = 0) AS invalid_json,
  SUM(JSON_UNQUOTE(JSON_EXTRACT(data, '$.version')) <> '1.0') AS bad_version
FROM resume;

-- 3.1 无损抽查：旧姓名/摘要 与 新文档对应字段一致
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(common_data, '$.basic.name')) AS old_name,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.basics.name')) AS new_name,
  JSON_UNQUOTE(JSON_EXTRACT(common_data, '$.summary')) AS old_summary,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.summary.content')) AS new_summary
FROM resume
WHERE common_data IS NOT NULL
LIMIT 20;

-- 3.2 模板专属字段不丢：extended_data 有键的行，customSections 数量应等于其键数
SELECT
  COUNT(*) AS rows_with_extended,
  SUM(JSON_LENGTH(JSON_EXTRACT(data, '$.customSections')) <> JSON_LENGTH(JSON_KEYS(COALESCE(extended_data, JSON_OBJECT())))) AS extended_keys_lost
FROM resume
WHERE extended_data IS NOT NULL;

-- 4. 确认无误后手动执行（默认注释）：
-- ALTER TABLE `resume` DROP COLUMN `common_data`;
-- ALTER TABLE `resume` DROP COLUMN `extended_data`;
-- ALTER TABLE `resume` DROP COLUMN `current_template_id`;
-- ALTER TABLE `resume` DROP COLUMN `template_code`;
-- ALTER TABLE `resume` DROP COLUMN `template_id`;
```

- [ ] **Step 2: 在测试库执行并核对校验输出**

Run: 先 `mysql -uroot -p123456 resume < docs/sql/schema-v3.sql`，再 `node scripts/migrate-resume-v3.js`，再 `mysql -uroot -p123456 resume < docs/sql/migrate-resume-v3.sql`
Expected: 备份行数 = 原行数；`null_data = 0`、`invalid_json = 0`、`bad_version = 0`；3.1 抽查 name/summary 一致；3.2 `extended_keys_lost = 0`

- [ ] **Step 3: Commit**

```powershell
git add docs/sql/migrate-resume-v3.sql
git commit -m "feat: add resume v3 migration with backup and validation"
```

## Task 5: 后端 JSON Schema 校验依赖与校验器接口

**Files:**
- Modify: `backend/com.resume.api/pom.xml`
- Create: `backend/com.resume.api/src/main/java/com/resume/api/ai/ResumeSchemaValidator.java`
- Create: `backend/com.resume.api/src/main/java/com/resume/api/ai/TemplateSchemaValidator.java`
- Create: `backend/com.resume.api/src/main/java/com/resume/api/ai/impl/ResumeSchemaValidatorImpl.java`
- Create: `backend/com.resume.api/src/main/java/com/resume/api/ai/impl/TemplateSchemaValidatorImpl.java`
- Create: `backend/com.resume.api/src/main/resources/schema/resume.schema.json`（从 docs 复制）
- Test: `backend/com.resume.api/src/test/java/com/resume/api/ai/SchemaValidatorTest.java`

**Interfaces:**
- Produces:
  - `ResumeSchemaValidator.validate(JsonNode document)` — 文档不合法抛 `BusinessException(ErrorCode.BAD_REQUEST, ...)`
  - `TemplateSchemaValidator.validateManifest(JsonNode manifest)` / `validateContent(String html, String css)`
- Consumes: docs/resume.schema.json（复制进 classpath `schema/resume.schema.json`）

- [ ] **Step 1: 加依赖**

In `backend/com.resume.api/pom.xml` 的 `<dependencies>` 内追加：

```xml
<dependency>
    <groupId>com.networknt</groupId>
    <artifactId>json-schema-validator</artifactId>
    <version>1.5.6</version>
</dependency>
```

- [ ] **Step 2: 复制 schema 进 classpath**

Run: `Copy-Item docs/resume.schema.json backend/com.resume.api/src/main/resources/schema/resume.schema.json; Copy-Item docs/template-schema.json backend/com.resume.api/src/main/resources/schema/template.schema.json`
Expected: 两个文件就位（template.schema.json 先复制旧版占位，Task 8 会覆盖为 v2，保证 Spring 上下文在 Task 8 前可加载）

- [ ] **Step 3: 写接口与实现**

Create `backend/com.resume.api/src/main/java/com/resume/api/ai/ResumeSchemaValidator.java`：

```java
package com.resume.api.ai;

import com.fasterxml.jackson.databind.JsonNode;

/** ResumeData 文档校验：以 docs/resume.schema.json 为准。 */
public interface ResumeSchemaValidator {

    /** 校验整份 ResumeData，不合法抛 BusinessException(BAD_REQUEST)。 */
    void validate(JsonNode document);
}
```

Create `backend/com.resume.api/src/main/java/com/resume/api/ai/TemplateSchemaValidator.java`：

```java
package com.resume.api.ai;

import com.fasterxml.jackson.databind.JsonNode;

/** 模板校验：manifest v2 白名单 + HTML/CSS 危险内容检查。 */
public interface TemplateSchemaValidator {

    /** 校验 manifest v2 结构，不合法抛 BusinessException(BAD_REQUEST)。 */
    void validateManifest(JsonNode manifest);

    /** 校验 HTML/CSS 不含 script/on*/javascript: 等危险内容。 */
    void validateContent(String html, String css);
}
```

Create `backend/com.resume.api/src/main/java/com/resume/api/ai/impl/ResumeSchemaValidatorImpl.java`：

```java
package com.resume.api.ai.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.resume.api.ai.ResumeSchemaValidator;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class ResumeSchemaValidatorImpl implements ResumeSchemaValidator {

    private final JsonSchema schema;

    public ResumeSchemaValidatorImpl(@Value("classpath:schema/resume.schema.json") Resource resource) throws Exception {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        try (InputStream in = resource.getInputStream()) {
            String source = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            this.schema = factory.getSchema(source);
        }
    }

    @Override
    public void validate(JsonNode document) {
        Set<ValidationMessage> errors = schema.validate(document);
        if (!errors.isEmpty()) {
            String detail = errors.stream().map(ValidationMessage::getMessage).collect(Collectors.joining("; "));
            throw new BusinessException(ErrorCode.BAD_REQUEST, "ResumeData 校验失败: " + detail);
        }
    }
}
```

Create `backend/com.resume.api/src/main/java/com/resume/api/ai/impl/TemplateSchemaValidatorImpl.java`：

```java
package com.resume.api.ai.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.resume.api.ai.TemplateSchemaValidator;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class TemplateSchemaValidatorImpl implements TemplateSchemaValidator {

    private static final Pattern DANGEROUS_HTML =
            Pattern.compile("(?is)<script|\\son\\w+\\s*=|javascript:|data:\\s*text/html|vbscript:");
    private static final Pattern DANGEROUS_CSS =
            Pattern.compile("(?i)expression\\s*\\(|@import|javascript:|url\\s*\\(");

    private final JsonSchema manifestSchema;

    public TemplateSchemaValidatorImpl(@Value("classpath:schema/template.schema.json") Resource resource) throws Exception {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        try (InputStream in = resource.getInputStream()) {
            this.manifestSchema = factory.getSchema(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    @Override
    public void validateManifest(JsonNode manifest) {
        Set<ValidationMessage> errors = manifestSchema.validate(manifest);
        if (!errors.isEmpty()) {
            String detail = errors.stream().map(ValidationMessage::getMessage).collect(Collectors.joining("; "));
            throw new BusinessException(ErrorCode.BAD_REQUEST, "模板 manifest 校验失败: " + detail);
        }
    }

    @Override
    public void validateContent(String html, String css) {
        if (html != null && DANGEROUS_HTML.matcher(html).find()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "模板 HTML 包含危险内容");
        }
        if (css != null && DANGEROUS_CSS.matcher(css).find()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "模板 CSS 包含危险内容");
        }
    }
}
```

> 注：Task 10 会把 docs/template-schema.json 升级为 manifest v2 并复制为 classpath `schema/template.schema.json`；在此之前 TemplateSchemaValidatorImpl 的构造依赖该文件，本任务测试只覆盖 ResumeSchemaValidator 与危险内容校验，构造测试用 FileSystemResource 指向 `../docs/template-schema.json`（旧 schema 仍存在，能解析即可）。

- [ ] **Step 4: 写测试**

Create `backend/com.resume.api/src/test/java/com/resume/api/ai/SchemaValidatorTest.java`：

```java
package com.resume.api.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resume.api.ai.impl.ResumeSchemaValidatorImpl;
import com.resume.api.ai.impl.TemplateSchemaValidatorImpl;
import com.resume.api.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;

import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SchemaValidatorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private ResumeSchemaValidator resumeValidator() throws Exception {
        return new ResumeSchemaValidatorImpl(new FileSystemResource(
                Paths.get("../../docs/resume.schema.json").toAbsolutePath().normalize().toFile()));
    }

    private TemplateSchemaValidator templateValidator() throws Exception {
        return new TemplateSchemaValidatorImpl(new FileSystemResource(
                Paths.get("../../docs/template-schema.json").toAbsolutePath().normalize().toFile()));
    }

    @Test
    void acceptsValidResumeDocument() throws Exception {
        ObjectNode doc = mapper.createObjectNode();
        doc.put("version", "1.0");
        doc.putObject("picture").put("hidden", true).put("url", "").put("size", 128).put("borderRadius", 50);
        ObjectNode basics = doc.putObject("basics");
        basics.put("name", "苏轼").put("headline", "全栈工程师").put("email", "a@b.c")
                .put("phone", "13800000000").put("location", "杭州");
        basics.putObject("website").put("url", "").put("label", "");
        basics.putArray("customFields");
        doc.putObject("summary").put("title", "个人简介").put("columns", 1).put("hidden", false).put("content", "");
        doc.putObject("sections");
        doc.putArray("customSections");
        ObjectNode metadata = doc.putObject("metadata");
        metadata.put("template", "prompt_013");
        ObjectNode layout = metadata.putObject("layout");
        layout.putArray("main").add("experience");
        layout.putArray("sidebar");
        layout.put("sidebarWidth", 30);
        metadata.putObject("page").put("format", "A4").put("margin", 48);
        metadata.putObject("design").putObject("colors")
                .put("primary", "#4F46E5").put("text", "#1A1A1A").put("background", "#FFFFFF");
        metadata.putObject("typography")
                .put("headingFont", "sans-serif").put("bodyFont", "sans-serif").put("fontSize", 12);
        metadata.put("notes", "").put("stylesheet", "");
        assertDoesNotThrow(() -> resumeValidator().validate(doc));
    }

    @Test
    void rejectsMissingVersion() {
        assertThrows(BusinessException.class, () -> resumeValidator().validate(mapper.createObjectNode()));
    }

    @Test
    void rejectsScriptInHtml() throws Exception {
        assertThrows(BusinessException.class,
                () -> templateValidator().validateContent("<script>alert(1)</script>", ""));
        assertThrows(BusinessException.class,
                () -> templateValidator().validateContent("<a onclick=\"x()\">x</a>", ""));
        assertThrows(BusinessException.class,
                () -> templateValidator().validateContent("", "body { background: url(javascript:alert(1)); }"));
    }
}
```

- [ ] **Step 5: 跑后端测试**

Run: `cd backend; mvn -q test -Dtest=SchemaValidatorTest`
Expected: PASS（3 个测试全绿）

- [ ] **Step 6: Commit**

```powershell
git add backend/com.resume.api/pom.xml backend/com.resume.api/src/main/resources/schema/resume.schema.json backend/com.resume.api/src/main/java/com/resume/api/ai backend/com.resume.api/src/test/java/com/resume/api/ai/SchemaValidatorTest.java
git commit -m "feat: add resume and template schema validators"
```

## Task 6: Resume 实体/DTO/VO/Service 改造为单文档

**Files:**
- Modify: `backend/com.resume.api/src/main/java/com/resume/api/entity/Resume.java`
- Modify: `backend/com.resume.api/src/main/java/com/resume/api/dto/ResumeRequest.java`
- Modify: `backend/com.resume.api/src/main/java/com/resume/api/vo/ResumeVO.java`
- Modify: `backend/com.resume.api/src/main/java/com/resume/api/service/ResumeService.java`
- Modify: `backend/com.resume.api/src/main/java/com/resume/api/controller/ResumeController.java`
- Test: `backend/com.resume.api/src/test/java/com/resume/api/service/ResumeServiceTest.java`

**Interfaces:**
- Consumes: `ResumeSchemaValidator`（Task 5）
- Produces: `Resume{id,userId,title,data(String),status,createdAt,updatedAt}`；`ResumeRequest{title,data(JsonNode),status}`；`ResumeVO{id,userId,title,data(Map),status,createdAt,updatedAt}`；create/update 前校验；删除 `switchTemplate`。

- [ ] **Step 1: 改实体**

Rewrite `entity/Resume.java`（删除 templateId/templateCode/currentTemplateId/commonData/extendedData 字段，保留 data）：

```java
package com.resume.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/** 简历实体：元数据列 + data JSON 单文档（ResumeData v1.0）。 */
@TableName("resume")
public class Resume {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long userId;

    private String title;

    /** ResumeData 单文档 JSON（version 1.0）。 */
    private String data;

    private Integer status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getData() { return data; }
    public void setData(String data) { this.data = data; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 2: 改 DTO**

Rewrite `dto/ResumeRequest.java`：

```java
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
```

- [ ] **Step 3: 改 VO**

Rewrite `vo/ResumeVO.java`：

```java
package com.resume.api.vo;

import java.time.LocalDateTime;
import java.util.Map;

public class ResumeVO {

    private Long id;
    private Long userId;
    private String title;
    private Map<String, Object> data;
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 4: 改 Service**

Rewrite `service/ResumeService.java`（核心逻辑：create/update 先校验再存单文档；删除 switchTemplate 与旧字段处理）：

```java
package com.resume.api.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resume.api.ai.ResumeSchemaValidator;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.common.exception.ErrorCode;
import com.resume.api.dto.ResumeRequest;
import com.resume.api.entity.Resume;
import com.resume.api.repository.ResumeMapper;
import com.resume.api.vo.ResumeVO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 简历服务：resume.data 单文档存取，写入前过 ResumeSchemaValidator。 */
@Service
public class ResumeService {

    private final ResumeMapper resumeMapper;
    private final ObjectMapper objectMapper;
    private final ResumeSchemaValidator resumeSchemaValidator;

    public ResumeService(ResumeMapper resumeMapper,
                         ObjectMapper objectMapper,
                         ResumeSchemaValidator resumeSchemaValidator) {
        this.resumeMapper = resumeMapper;
        this.objectMapper = objectMapper;
        this.resumeSchemaValidator = resumeSchemaValidator;
    }

    public List<Resume> listByUser(Long userId) {
        return resumeMapper.selectList(Wrappers.<Resume>lambdaQuery()
                .eq(Resume::getUserId, userId)
                .orderByDesc(Resume::getUpdatedAt));
    }

    public Resume getByUser(Long userId, Long id) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !userId.equals(resume.getUserId())) {
            return null;
        }
        return resume;
    }

    @Transactional(rollbackFor = Exception.class)
    public Resume create(Long userId, ResumeRequest request) {
        resumeSchemaValidator.validate(request.getData());
        Resume resume = new Resume();
        resume.setUserId(userId);
        resume.setTitle(request.getTitle().trim());
        resume.setData(writeJson(request.getData()));
        resume.setStatus(request.getStatus() == null ? 0 : request.getStatus());
        resumeMapper.insert(resume);
        return resume;
    }

    @Transactional(rollbackFor = Exception.class)
    public Resume update(Long userId, Long id, ResumeRequest request) {
        Resume resume = getByUser(userId, id);
        if (resume == null) {
            return null;
        }
        resumeSchemaValidator.validate(request.getData());
        resume.setTitle(request.getTitle().trim());
        resume.setData(writeJson(request.getData()));
        if (request.getStatus() != null) {
            resume.setStatus(request.getStatus());
        }
        resumeMapper.updateById(resume);
        return resume;
    }

    public boolean delete(Long userId, Long id) {
        Resume resume = getByUser(userId, id);
        if (resume == null) {
            return false;
        }
        resumeMapper.deleteById(id);
        return true;
    }

    public ResumeVO toVO(Resume resume) {
        ResumeVO vo = new ResumeVO();
        vo.setId(resume.getId());
        vo.setUserId(resume.getUserId());
        vo.setTitle(resume.getTitle());
        vo.setData(parseObjectMap(resume.getData()));
        vo.setStatus(resume.getStatus());
        vo.setCreatedAt(resume.getCreatedAt());
        vo.setUpdatedAt(resume.getUpdatedAt());
        return vo;
    }

    private Map<String, Object> parseObjectMap(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            if (!node.isObject()) {
                return new LinkedHashMap<>();
            }
            return objectMapper.convertValue(node,
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { });
        } catch (JsonProcessingException e) {
            return new LinkedHashMap<>();
        }
    }

    private String writeJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "数据序列化失败");
        }
    }
}
```

- [ ] **Step 5: 删 switch-template 接口**

In `controller/ResumeController.java`：删除 `switchTemplate` 方法与 `SwitchTemplateRequest` import；其余不变。

- [ ] **Step 6: 写单测**

Create `backend/com.resume.api/src/test/java/com/resume/api/service/ResumeServiceTest.java`：

```java
package com.resume.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resume.api.ai.ResumeSchemaValidator;
import com.resume.api.ai.impl.ResumeSchemaValidatorImpl;
import com.resume.api.common.exception.BusinessException;
import com.resume.api.dto.ResumeRequest;
import com.resume.api.entity.Resume;
import com.resume.api.repository.ResumeMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.FileSystemResource;

import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class ResumeServiceTest {

    private ResumeMapper mapper;
    private ResumeService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws Exception {
        mapper = mock(ResumeMapper.class);
        ResumeSchemaValidator validator = new ResumeSchemaValidatorImpl(new FileSystemResource(
                Paths.get("../../docs/resume.schema.json").toAbsolutePath().normalize().toFile()));
        service = new ResumeService(mapper, objectMapper, validator);
    }

    private ResumeRequest validRequest() {
        ObjectNode data = objectMapper.createObjectNode();
        data.put("version", "1.0");
        data.putObject("picture").put("hidden", true).put("url", "").put("size", 128).put("borderRadius", 50);
        ObjectNode basics = data.putObject("basics");
        basics.put("name", "苏轼").put("headline", "工程师").put("email", "a@b.c")
                .put("phone", "1").put("location", "杭州");
        basics.putObject("website").put("url", "").put("label", "");
        basics.putArray("customFields");
        data.putObject("summary").put("title", "简介").put("columns", 1).put("hidden", false).put("content", "");
        data.putObject("sections");
        data.putArray("customSections");
        ObjectNode metadata = data.putObject("metadata");
        metadata.put("template", "prompt_013");
        ObjectNode layout = metadata.putObject("layout");
        layout.putArray("main");
        layout.putArray("sidebar");
        layout.put("sidebarWidth", 30);
        metadata.putObject("page").put("format", "A4").put("margin", 48);
        metadata.putObject("design").putObject("colors")
                .put("primary", "#4F46E5").put("text", "#1A1A1A").put("background", "#FFFFFF");
        metadata.putObject("typography").put("headingFont", "sans-serif").put("bodyFont", "sans-serif").put("fontSize", 12);
        metadata.put("notes", "").put("stylesheet", "");
        ResumeRequest req = new ResumeRequest();
        req.setTitle("测试简历");
        req.setData(data);
        return req;
    }

    @Test
    void createAcceptsValidDocument() {
        service.create(1L, validRequest());
        verify(mapper).insert(any(Resume.class));
    }

    @Test
    void createRejectsInvalidDocument() {
        ResumeRequest req = validRequest();
        ((ObjectNode) req.getData()).remove("version");
        assertThrows(BusinessException.class, () -> service.create(1L, req));
        verify(mapper, never()).insert(any(Resume.class));
    }

    @Test
    void toVOCarriesSingleDocument() throws Exception {
        Resume resume = new Resume();
        resume.setId(1L);
        resume.setUserId(1L);
        resume.setTitle("t");
        resume.setData(objectMapper.writeValueAsString(validRequest().getData()));
        assertEquals("prompt_013",
                ((java.util.Map<?, ?>) service.toVO(resume).getData().get("metadata")).get("template"));
    }
}
```

- [ ] **Step 7: 跑全量后端测试**

Run: `cd backend; mvn -q test`
Expected: 全部 PASS（既有 5 个测试类 + 新增 2 个）

- [ ] **Step 8: Commit**

```powershell
git add backend/com.resume.api/src/main/java/com/resume/api/entity/Resume.java backend/com.resume.api/src/main/java/com/resume/api/dto/ResumeRequest.java backend/com.resume.api/src/main/java/com/resume/api/vo/ResumeVO.java backend/com.resume.api/src/main/java/com/resume/api/service/ResumeService.java backend/com.resume.api/src/main/java/com/resume/api/controller/ResumeController.java backend/com.resume.api/src/test/java/com/resume/api/service/ResumeServiceTest.java
git commit -m "refactor: store resume as single ResumeData document"
```

## Task 7: 前端最小适配（类型 / store / API / 临时渲染）

**Files:**
- Modify: `frontend/src/types/resume.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/resume.ts`
- Modify: `frontend/src/stores/resumeStore.ts`
- Modify: `frontend/src/views/ResumeEditor.vue`
- Modify: `frontend/src/views/ResumePreview.vue`
- Modify: `frontend/src/components/TemplateSwitcher.vue`
- Test: `cd frontend; npm run build`

**Interfaces:**
- Produces: `ResumeData` TS 类型；`ResumeVO.data`；`ResumePayload.data`；store 直接持有 `ResumeData`；本阶段预览为临时 JSON 渲染（阶段二换语义渲染）。

- [ ] **Step 1: 重写类型**

In `frontend/src/types/resume.ts`，用以下类型替换旧 ResumeCommonData/ResumeExtendedData 等（保留 TemplateManifest 旧定义供阶段二替换）：

```ts
export interface ResumeBasics {
  name: string
  headline: string
  email: string
  phone: string
  location: string
  website: { url: string; label: string }
  customFields: { id: string; icon: string; text: string; link: string }[]
}

export interface ResumeSectionItem {
  id: string
  hidden: boolean
  [key: string]: unknown
}

export interface ResumeSection {
  title: string
  columns: number
  hidden: boolean
  items: ResumeSectionItem[]
}

export interface ResumeCustomSection extends ResumeSection {
  id: string
}

export interface ResumeSections {
  profiles?: ResumeSection
  experience?: ResumeSection
  education?: ResumeSection
  projects?: ResumeSection
  skills?: ResumeSection
  languages?: ResumeSection
  interests?: ResumeSection
  awards?: ResumeSection
  certifications?: ResumeSection
  publications?: ResumeSection
  volunteer?: ResumeSection
  references?: ResumeSection
  [key: string]: ResumeSection | undefined
}

export interface ResumeMetadata {
  template: string
  layout: { main: string[]; sidebar: string[]; sidebarWidth: number }
  page: { format: 'A4' | 'Letter'; margin: number }
  design: {
    colors: {
      primary: string
      text: string
      background: string
      sidebarBackground?: string
      sidebarForeground?: string
    }
  }
  typography: { headingFont: string; bodyFont: string; fontSize: number }
  notes: string
  stylesheet: string
}

export interface ResumeData {
  version: '1.0'
  picture: { hidden: boolean; url: string; size: number; borderRadius: number }
  basics: ResumeBasics
  summary: { title: string; columns: number; hidden: boolean; content: string }
  sections: ResumeSections
  customSections: ResumeCustomSection[]
  metadata: ResumeMetadata
}

export interface ResumeVO {
  id: string
  userId: string
  title: string
  data: ResumeData | string | Record<string, unknown>
  status: number
  createdAt?: string
  updatedAt?: string
}

export interface ResumePayload {
  title: string
  data: ResumeData | string
  status?: number
}
```

- [ ] **Step 2: 更新 index.ts 导出**

In `frontend/src/types/index.ts`：改为导出 `ResumeData/ResumeVO/ResumePayload/ResumeSection/ResumeCustomSection/ResumeMetadata/ResumeBasics/ResumeSectionItem/ResumeSections`，删除旧类型导出；编译报错点逐个改为新类型。

- [ ] **Step 3: 改 API**

In `frontend/src/api/resume.ts`：删除 `switchResumeTemplate`，create/update 签名改为：

```ts
export async function createResume(payload: ResumePayload): Promise<ResumeVO> {
  const response = await http.post<ApiResult<ResumeVO>>('/resumes', payload)
  return response.data.data
}

export async function updateResume(id: string | number, payload: ResumePayload): Promise<ResumeVO> {
  const response = await http.put<ApiResult<ResumeVO>>(`/resumes/${id}`, payload)
  return response.data.data
}
```

- [ ] **Step 4: 改 store**

Rewrite `frontend/src/stores/resumeStore.ts`：

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { createResume, fetchResume, updateResume } from '@/api/resume'
import type { ResumeData, ResumeVO } from '@/types'

export function emptyResumeData(): ResumeData {
  return {
    version: '1.0',
    picture: { hidden: true, url: '', size: 128, borderRadius: 50 },
    basics: { name: '', headline: '', email: '', phone: '', location: '', website: { url: '', label: '' }, customFields: [] },
    summary: { title: '个人简介', columns: 1, hidden: false, content: '' },
    sections: {},
    customSections: [],
    metadata: {
      template: '',
      layout: { main: [], sidebar: [], sidebarWidth: 30 },
      page: { format: 'A4', margin: 48 },
      design: { colors: { primary: '#4F46E5', text: '#1A1A1A', background: '#FFFFFF' } },
      typography: { headingFont: 'sans-serif', bodyFont: 'sans-serif', fontSize: 12 },
      notes: '',
      stylesheet: ''
    }
  }
}

export function parseData(raw: unknown): ResumeData {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...emptyResumeData(), ...(raw as Partial<ResumeData>) } as ResumeData
  }
  if (typeof raw === 'string') {
    try {
      return parseData(JSON.parse(raw))
    } catch {
      return emptyResumeData()
    }
  }
  return emptyResumeData()
}

export const useResumeStore = defineStore('resume', () => {
  const id = ref<string | null>(null)
  const title = ref('')
  const data = ref<ResumeData>(emptyResumeData())
  const status = ref(0)
  const saving = ref(false)
  const hasChanges = computed(() => true)

  function applyVO(vo: ResumeVO) {
    id.value = vo.id
    title.value = vo.title ?? ''
    status.value = vo.status ?? 0
    data.value = parseData(vo.data)
  }

  async function load(resumeId: string) {
    applyVO(await fetchResume(resumeId))
  }

  async function save(): Promise<ResumeVO> {
    saving.value = true
    try {
      const payload = {
        title: title.value.trim(),
        data: JSON.stringify(data.value),
        status: status.value
      }
      const vo = id.value ? await updateResume(id.value, payload) : await createResume(payload)
      applyVO(vo)
      return vo
    } finally {
      saving.value = false
    }
  }

  function reset() {
    id.value = null
    title.value = ''
    data.value = emptyResumeData()
    status.value = 0
  }

  return { id, title, data, status, saving, hasChanges, applyVO, load, save, reset }
})
```

- [ ] **Step 5: 编辑器/预览临时渲染与模板切换**

`ResumeEditor.vue` / `ResumePreview.vue`：删除 `store.commonData/store.extendedData/store.currentTemplateId` 引用；预览区临时渲染：

```ts
const previewHtml = computed(() => {
  if (!store.data.metadata.template) {
    return '<p class="hint">请先选择模板（阶段二启用语义渲染）</p>'
  }
  return `<pre class="json-preview">${escapeHtml(JSON.stringify(store.data, null, 2))}</pre>`
})
```

`TemplateSwitcher.vue`：选中后只写 `store.data.metadata.template = code`，不再调用 switch API。

- [ ] **Step 6: 前端构建验证**

Run: `cd frontend; npm run build`
Expected: PASS（vue-tsc + vite build 全绿）

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/types/resume.ts frontend/src/types/index.ts frontend/src/api/resume.ts frontend/src/stores/resumeStore.ts frontend/src/views/ResumeEditor.vue frontend/src/views/ResumePreview.vue frontend/src/components/TemplateSwitcher.vue
git commit -m "refactor: adapt frontend to single ResumeData document"
```

---

# Phase 2：模板体系

## Task 8: docs/template-schema.json（manifest v2 白名单）

**Files:**
- Modify: `docs/template-schema.json`
- Create: `backend/com.resume.api/src/main/resources/schema/template.schema.json`（复制）
- Test: `node scripts/validate-template.js --report`（Task 10 升级后）

**Interfaces:**
- Produces: manifest v2 的 JSON Schema（draft 2020-12），字段：templateId/name/sourceFile/renderMode/regions/blocks/theme/sampleData/customFields。

- [ ] **Step 1: 改写 schema**

Rewrite `docs/template-schema.json`：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://resume-site.local/schemas/template.schema.json",
  "title": "TemplateManifestV2",
  "description": "语义化模板 manifest v2 白名单：AI 生成 template 只允许输出以下字段。",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "templateId": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "sourceFile": { "type": "string" },
    "renderMode": { "enum": ["semantic", "placeholder"] },
    "regions": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": { "enum": ["header", "main", "sidebar"] },
          "placement": { "enum": ["main", "sidebar"] },
          "origins": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["name", "placement", "origins"]
      }
    },
    "blocks": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "type": { "type": "string", "minLength": 1 },
          "selector": { "type": "string", "minLength": 1 },
          "placement": { "enum": ["main", "sidebar"] }
        },
        "required": ["type", "selector", "placement"]
      }
    },
    "theme": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "key": { "type": "string", "pattern": "^--[a-z0-9-]+$" },
          "default": { "type": "string" },
          "control": { "enum": ["color", "number", "font", "select"] }
        },
        "required": ["key", "default", "control"]
      }
    },
    "sampleData": { "type": "object" },
    "customFields": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": { "type": "string" },
          "label": { "type": "string" },
          "type": { "enum": ["string", "boolean", "array"] },
          "selector": { "type": "string" }
        },
        "required": ["name", "label", "type"]
      }
    }
  },
  "required": ["templateId", "name", "sourceFile", "renderMode", "regions", "blocks", "theme", "sampleData", "customFields"]
}
```

- [ ] **Step 2: 复制到后端 classpath**

Run: `Copy-Item docs/template-schema.json backend/com.resume.api/src/main/resources/schema/template.schema.json`

- [ ] **Step 3: 后端 TemplateManifest 模型升级为 v2**

Rewrite `backend/com.resume.api/src/main/java/com/resume/api/model/TemplateManifest.java` 的字段（保留 getter/setter 风格，与现有代码一致）：

```java
private String templateId;
private String name;
private String sourceFile;
private String renderMode; // semantic | placeholder
private List<Map<String, Object>> regions = new ArrayList<>();
private List<Map<String, Object>> blocks = new ArrayList<>();
private List<Map<String, Object>> theme = new ArrayList<>();
private Map<String, Object> sampleData = new LinkedHashMap<>();
private List<Map<String, Object>> customFields = new ArrayList<>();
```

删除旧 `fields/mappings/pendingManual/FieldDef/MappingDef` 结构；`TemplateConfigService` 解析 manifest 时直接 `objectMapper.convertValue(json, TemplateManifest.class)`，无需逐字段搬运。

Run: `cd backend; mvn -q test`
Expected: 全绿（TemplateManifest 只作透传载体，manifest JSON 入库/出参保持原样）

- [ ] **Step 4: Commit**

```powershell
git add docs/template-schema.json backend/com.resume.api/src/main/resources/schema/template.schema.json backend/com.resume.api/src/main/java/com/resume/api/model/TemplateManifest.java backend/com.resume.api/src/main/java/com/resume/api/service/TemplateConfigService.java
git commit -m "feat: add manifest v2 whitelist schema"
```

## Task 9: scripts/analyze-templates.js 升级（语义提取）

**Files:**
- Modify: `scripts/analyze-templates.js`
- Test: `node scripts/analyze-templates.js` 后检查 `docs/template-analysis-report.json`

**Interfaces:**
- Consumes: `docs/template/*.html`（含 `data-section` 属性与 CSS 变量）
- Produces: `docs/template/<id>.manifest.json`（manifest v2）+ `docs/template-analysis-report.json`

- [ ] **Step 1: 重写脚本（保留 sampleData 文本提取）**

Rewrite `scripts/analyze-templates.js`：

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.resolve(__dirname, '../docs/template');
const REGION_CLASSES = {
  header: 'resume-header',
  main: 'resume-main',
  sidebar: 'resume-sidebar'
};
const SECTION_TYPES = ['profiles', 'experience', 'education', 'projects', 'skills', 'languages',
  'interests', 'awards', 'certifications', 'publications', 'volunteer', 'references', 'custom'];

function cssVars(css) {
  const vars = [];
  const re = /--([a-z0-9-]+)\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    vars.push({ key: `--${m[1].trim()}`, default: m[2].trim() });
  }
  return vars.filter((v, i, arr) => arr.findIndex((x) => x.key === v.key) === i);
}

function blocksFromHtml(html) {
  const blocks = [];
  const re = /<([a-zA-Z][\w-]*)[^>]*data-section=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!SECTION_TYPES.includes(m[2])) continue;
    if (blocks.find((b) => b.type === m[2])) continue;
    blocks.push({ type: m[2], selector: `[data-section="${m[2]}"]`, placement: 'main' });
  }
  return blocks;
}

function regionsFromHtml(html) {
  const regions = [];
  for (const [name, cls] of Object.entries(REGION_CLASSES)) {
    if (html.includes(`class="${cls}`) || html.includes(` ${cls} `)) {
      regions.push({ name, placement: name === 'sidebar' ? 'sidebar' : 'main', origins: [] });
    }
  }
  return regions;
}

function sampleText(html) {
  const out = {};
  const name = /<h1[^>]*>\s*([^<]+)\s*<\/h1>/i.exec(html);
  if (name) out.name = name[1].trim();
  const headline = /class=["'][^"']*\bjob-title\b[^"']*["'][^>]*>\s*([^<]+)\s*</i.exec(html)
    || /class=["'][^"']*\bsubhead\b[^"']*["'][^>]*>\s*([^<]+)\s*</i.exec(html);
  if (headline) out.headline = headline[1].trim();
  const summary = /class=["'][^"']*\bsection-title\b[^"']*["'][^>]*>[^<]*<\/[^>]+>\s*<p[^>]*>\s*([^<]+)\s*<\/p>/i.exec(html);
  if (summary) out.summary = summary[1].trim();
  return out;
}

function main() {
  const report = { generatedAt: new Date().toISOString(), templates: [] };
  for (const file of fs.readdirSync(TEMPLATE_DIR)) {
    if (!file.endsWith('.html')) continue;
    const id = file.replace(/\.html$/, '');
    const html = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8');
    const cssMatch = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html);
    const css = cssMatch ? cssMatch[1] : '';
    const manifest = {
      templateId: id,
      name: id,
      sourceFile: file,
      renderMode: 'semantic',
      regions: regionsFromHtml(html),
      blocks: blocksFromHtml(html),
      theme: cssVars(css),
      sampleData: sampleText(html),
      customFields: []
    };
    fs.writeFileSync(path.join(TEMPLATE_DIR, `${id}.manifest.json`), JSON.stringify(manifest, null, 2), 'utf8');
    report.templates.push({ id, blocks: manifest.blocks.length, themeVars: manifest.theme.length });
  }
  fs.writeFileSync(path.resolve(__dirname, '../docs/template-analysis-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`analyzed ${report.templates.length} templates`);
}

main();
```

- [ ] **Step 2: 运行并核对报告**

Run: `node scripts/analyze-templates.js`
Expected: 输出 `analyzed 12 templates`（docs/template 下 12 份静态模板；cv2 内置模板在 backend resources，由 Task 12 单独处理）；每份 manifest 是 v2 结构，theme 变量数 > 0（模板 CSS 有自定义属性时）

- [ ] **Step 3: Commit**

```powershell
git add scripts/analyze-templates.js docs/template/*.manifest.json docs/template-analysis-report.json
git commit -m "feat: upgrade template analyzer to semantic manifest v2"
```

## Task 10: scripts/validate-template.js 升级（语义校验）

**Files:**
- Modify: `scripts/validate-template.js`
- Test: `node scripts/validate-template.js --report`

**Interfaces:**
- Consumes: manifest v2 校验规则（Task 8 schema 的要点）、docs/template/*.html
- Produces: 0 错误才通过；错误列表输出到控制台与 `docs/template-validation-report.json`

- [ ] **Step 1: 重写校验逻辑**

Rewrite `scripts/validate-template.js` 的校验函数为：

```javascript
function validateManifestV2(manifest) {
  const errors = [];
  if (!manifest || manifest.templateId !== manifest.templateId) errors.push('manifest.templateId 缺失');
  if (!['semantic', 'placeholder'].includes(manifest.renderMode)) errors.push(`renderMode 非法: ${manifest.renderMode}`);
  if (!Array.isArray(manifest.regions) || manifest.regions.length === 0) errors.push('regions 不能为空');
  if (!Array.isArray(manifest.blocks) || manifest.blocks.length === 0) errors.push('blocks 不能为空');
  for (const b of manifest.blocks || []) {
    if (!b.type || !b.selector) errors.push(`block 缺 type/selector: ${JSON.stringify(b)}`);
  }
  for (const t of manifest.theme || []) {
    if (!/^--[a-z0-9-]+$/.test(t.key || '')) errors.push(`theme key 非法: ${t.key}`);
    if (t.default === undefined) errors.push(`theme ${t.key} 缺默认值`);
  }
  return errors;
}

function validateContent(html, css) {
  const errors = [];
  if (/<script|\son\w+\s*=|javascript:|data:\s*text\/html/i.test(html)) errors.push('HTML 含危险内容');
  if (/expression\s*\(|@import|javascript:|url\s*\(/i.test(css)) errors.push('CSS 含危险内容');
  const required = ['resume-page', 'section-title', 'entry'];
  for (const cls of required) {
    if (!html.includes(cls)) errors.push(`缺少语义类名 ${cls}`);
  }
  return errors;
}
```

保留单文件与 `--report` 两种入口：单文件校验 html+manifest；`--report` 全量校验并输出 `docs/template-validation-report.json`，任一模板错误数 > 0 则 exit 1。

- [ ] **Step 2: 跑全量校验**

Run: `node scripts/validate-template.js --report`
Expected: 在 Task 11-24 完成前会有失败（旧模板缺语义类名）；本任务验收为"脚本能输出每个模板的错误清单"，Task 24 后必须 0 错误

- [ ] **Step 3: Commit**

```powershell
git add scripts/validate-template.js docs/template-validation-report.json
git commit -m "feat: upgrade template validator with semantic checks"
```

## Task 11: scripts/semanticize-template.js（旧模板机械转换）

**Files:**
- Create: `scripts/semanticize-template.js`
- Test: 对单份模板运行后 `node scripts/validate-template.js <html>` 错误数下降

**Interfaces:**
- Consumes: `docs/template/<id>.html`、旧 `docs/template/<id>.manifest.json`、`docs/template-market-catalog.json`
- Produces: 改写后的 HTML（注入 data-section、语义类名、CSS 变量默认值）+ manifest v2

- [ ] **Step 1: 写转换脚本**

Create `scripts/semanticize-template.js`：

```javascript
'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.resolve(__dirname, '../docs/template');
const CATALOG = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backend/com.resume.api/src/main/resources/template-market-catalog.json'), 'utf8'));

// 旧类名 -> 语义类名 映射（按 v2 模板 HTML 的常见命名）
const CLASS_MAP = {
  'resume': 'resume-page',
  'name-section': 'resume-header',
  'contact-info': 'contact-list',
  'contact-item': 'contact-item',
  'section': 'section',
  'section-title': 'section-title',
  'skills-container': 'section-items',
  'skill-tag': 'skill-tag',
  'entry': 'entry',
  'entry-header': 'entry-header',
  'date-location': 'entry-meta',
  'details': 'entry-body',
  'edu-entry': 'entry edu-entry',
  'project-item': 'entry project-item'
};

const THEME_DEFAULTS = {
  '--color-primary': '#4F46E5',
  '--color-background': '#FFFFFF',
  '--color-text': '#1A1A1A',
  '--font-heading': 'sans-serif',
  '--font-body': 'sans-serif',
  '--font-size-base': '12pt',
  '--page-margin': '48px',
  '--section-gap': '16px'
};

function ensureThemeVars(css) {
  if (/--color-primary/.test(css)) return css;
  const defaults = Object.entries(THEME_DEFAULTS)
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n  ');
  return `:root {\n  ${defaults}\n}\n${css}`;
}

function main() {
  const id = process.argv[2];
  if (!id) { console.error('用法: node scripts/semanticize-template.js <templateId>'); process.exit(2); }
  const htmlFile = path.join(TEMPLATE_DIR, `${id}.html`);
  const manifestFile = path.join(TEMPLATE_DIR, `${id}.manifest.json`);
  let html = fs.readFileSync(htmlFile, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const [oldCls, newCls] of Object.entries(CLASS_MAP)) {
    html = html.split(`class="${oldCls}"`).join(`class="${newCls}"`);
    html = html.split(`class="${oldCls} `).join(`class="${newCls} `);
  }
  html = html.replace(/<style[^>]*>/i, (tag) => `${tag}\n${ensureThemeVars('')}`);
  fs.writeFileSync(htmlFile, html, 'utf8');
  const primary = CATALOG[id] && CATALOG[id].primaryColor ? CATALOG[id].primaryColor : THEME_DEFAULTS['--color-primary'];
  manifest.renderMode = 'semantic';
  manifest.theme = [
    { key: '--color-primary', default: primary, control: 'color' },
    { key: '--color-background', default: THEME_DEFAULTS['--color-background'], control: 'color' },
    { key: '--color-text', default: THEME_DEFAULTS['--color-text'], control: 'color' },
    { key: '--font-heading', default: THEME_DEFAULTS['--font-heading'], control: 'font' },
    { key: '--font-body', default: THEME_DEFAULTS['--font-body'], control: 'font' },
    { key: '--font-size-base', default: THEME_DEFAULTS['--font-size-base'], control: 'number' },
    { key: '--page-margin', default: THEME_DEFAULTS['--page-margin'], control: 'number' },
    { key: '--section-gap', default: THEME_DEFAULTS['--section-gap'], control: 'number' }
  ];
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`semanticized ${id}`);
}

main();
```

> 注：`injectDataSection` 是保守的自动占位；真正把 `section-title` 容器改成 `data-section="experience"` 等需要人工按每份模板的实际结构补（Tasks 12-24 第 2 步）。

- [ ] **Step 2: 运行示例（prompt_013）**

Run: `node scripts/semanticize-template.js prompt_013`
Expected: 输出 `semanticized prompt_013`；HTML 出现 `:root { --color-primary: ... }` 与语义类名

- [ ] **Step 3: Commit**

```powershell
git add scripts/semanticize-template.js
git commit -m "feat: add semantic template converter script"
```

## Task 12: cv2 内置模板语义化（占位符 → 语义骨架）

**Files:**
- Modify: `backend/com.resume.api/src/main/resources/templates/template-cv2.json`
- Modify: `backend/com.resume.api/src/main/resources/template-manifests/cv2.json`

**Interfaces:**
- Produces: cv2 的 html 改为语义骨架（无示例文本），manifest renderMode=semantic，blocks 含 experience/education/skills。

- [ ] **Step 1: 重写 template-cv2.json 的 html 为语义骨架**

把 `template-cv2.json` 中 `html` 字段替换为：

```html
<div class="resume-page">
  <header class="resume-header">
    <h1 class="name"></h1>
    <div class="headline"></div>
    <div class="contact-list"></div>
  </header>
  <main class="resume-main">
    <section class="section" data-section="summary">
      <div class="section-title">个人简介</div>
      <div class="section-items"><p class="entry-body"></p></div>
    </section>
    <section class="section" data-section="experience">
      <div class="section-title">工作经历</div>
      <div class="section-items">
        <div class="entry">
          <div class="entry-header"><span class="company"></span><span class="entry-meta"></span></div>
          <div class="entry-body"></div>
        </div>
      </div>
    </section>
    <section class="section" data-section="education">
      <div class="section-title">教育背景</div>
      <div class="section-items">
        <div class="entry edu-entry">
          <div class="entry-header"><span class="school"></span><span class="entry-meta"></span></div>
          <div class="entry-body"></div>
        </div>
      </div>
    </section>
    <section class="section" data-section="skills">
      <div class="section-title">技能清单</div>
      <div class="section-items"><span class="skill-tag"></span></div>
    </section>
    <section class="section" data-section="custom"></section>
  </main>
</div>
```

把 `css` 字段开头补上主题变量默认值（`:root { --color-primary:#4F46E5; --color-background:#FFFFFF; --color-text:#1A1A1A; --font-heading:sans-serif; --font-body:sans-serif; --font-size-base:12pt; --page-margin:48px; --section-gap:16px; }`）。

- [ ] **Step 2: 重写 template-manifests/cv2.json**

```json
{
  "templateId": "cv2",
  "name": "CV 经典",
  "sourceFile": "template-cv2.json",
  "renderMode": "semantic",
  "regions": [
    { "name": "header", "placement": "main", "origins": [] },
    { "name": "main", "placement": "main", "origins": ["main"] }
  ],
  "blocks": [
    { "type": "experience", "selector": "[data-section='experience']", "placement": "main" },
    { "type": "education", "selector": "[data-section='education']", "placement": "main" },
    { "type": "skills", "selector": "[data-section='skills']", "placement": "main" }
  ],
  "theme": [
    { "key": "--color-primary", "default": "#4F46E5", "control": "color" },
    { "key": "--color-background", "default": "#FFFFFF", "control": "color" },
    { "key": "--color-text", "default": "#1A1A1A", "control": "color" },
    { "key": "--font-heading", "default": "sans-serif", "control": "font" },
    { "key": "--font-body", "default": "sans-serif", "control": "font" },
    { "key": "--font-size-base", "default": "12pt", "control": "number" },
    { "key": "--page-margin", "default": "48px", "control": "number" },
    { "key": "--section-gap", "default": "16px", "control": "number" }
  ],
  "sampleData": {},
  "customFields": []
}
```

- [ ] **Step 3: 验证**

Run: `node scripts/validate-template.js --report`；随后 `cd backend; mvn -q test`（启动种子校验）
Expected: cv2 无错误；后端测试全绿

- [ ] **Step 4: Commit**

```powershell
git add backend/com.resume.api/src/main/resources/templates/template-cv2.json backend/com.resume.api/src/main/resources/template-manifests/cv2.json
git commit -m "feat: convert cv2 to semantic template skeleton"
```

## Tasks 13-24: 12 份 prompt_* 模板语义化（每份一个任务）

模板清单与任务编号：

| 任务 | 模板 | 主要 data-section |
|------|------|-------------------|
| 13 | prompt_013 | experience / education / skills / certifications |
| 14 | prompt_03 | experience / education / skills / certifications |
| 15 | prompt_021 | experience / education / skills / projects |
| 16 | prompt_026 | experience / education / skills / projects |
| 17 | prompt_057 | experience / education / skills / certifications |
| 18 | prompt_044 | experience / education / skills / projects |
| 19 | prompt_04 | experience / education / skills |
| 20 | prompt_05 | experience / education / skills / projects |
| 21 | prompt_063 | experience / education / skills / certifications |
| 22 | prompt_09 | experience / education / skills |
| 23 | prompt_10 | experience / education / skills / projects |
| 24 | prompt_089 | experience / education / skills / certifications |

每份执行同一套步骤（以 prompt_013 为例，其余把模板 id 替换即可）：

- [ ] **Step 1: 机械转换**

Run: `node scripts/semanticize-template.js prompt_013`
Expected: 输出 `semanticized prompt_013`

- [ ] **Step 2: 人工核对 data-section 与 blocks**

打开 `docs/template/prompt_013.html`，把区块标题所在容器标注正确 data-section：

```html
<!-- 原“工作经历”区块 -->
<section class="section" data-section="experience">
  <div class="section-title">工作经历</div>
  ...
</section>
<!-- 原“教育背景” -->
<section class="section" data-section="education">...</section>
<!-- 原“核心能力/技能清单” -->
<section class="section" data-section="skills">...</section>
<!-- 原“资质证书” -->
<section class="section" data-section="certifications">...</section>
```

同步修改 `docs/template/prompt_013.manifest.json` 的 `blocks`，每个 data-section 对应一条 `{ "type": "...", "selector": "[data-section='...']", "placement": "main" }`；summary/联系方式由 header 填充，不建 block。随后重跑 `node scripts/analyze-templates.js` 并核对生成结果与手改一致（不一致以手改为准）。

- [ ] **Step 3: 单模板校验**

Run: `node scripts/validate-template.js docs/template/prompt_013.html`
Expected: 0 错误

- [ ] **Step 4: 视觉对比验收**

用 `docs/template/prompt_013.html` 在浏览器打开新旧两份（转换前后各存一份截图到 `docs/template/qa/prompt_013-old.png` 与 `prompt_013-new.png`），逐项比对：姓名/联系方式/摘要/经历条目/技能标签位置与样式一致；不一致则修该模板 CSS 后重跑 Step 3-4。

- [ ] **Step 5: Commit**

```powershell
git add docs/template/prompt_013.html docs/template/prompt_013.manifest.json
git commit -m "feat: semanticize template prompt_013"
```

> 完成后跑一次 `node scripts/validate-template.js --report`，必须 0 错误（Task 24 验收点）。

## Task 25: 前端语义渲染器重写

**Files:**
- Modify: `frontend/src/types/resume.ts`（TemplateManifest 替换为 v2）
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/template-engine/index.ts`（重写为语义渲染器）
- Test: `cd frontend; npm run build`

**Interfaces:**
- Produces:
  - `TemplateManifestV2` 类型（regions/blocks/theme/sampleData/customFields）
  - `renderTemplate(template, data, context)`：placeholder 模式走旧 {{}} 引擎；semantic 模式走 `renderSemanticTemplate`
  - `renderSemanticTemplate(template, data)`：填充语义区块 + 注入主题 CSS 变量 + 消毒
  - 保留导出 `sanitizeHtml / sanitizeCss`

- [ ] **Step 1: 类型替换**

In `frontend/src/types/resume.ts`，把旧 `TemplateManifest` 相关定义替换为：

```ts
export interface TemplateRegion {
  name: 'header' | 'main' | 'sidebar'
  placement: 'main' | 'sidebar'
  origins: string[]
}

export interface TemplateBlock {
  type: string
  selector: string
  placement: 'main' | 'sidebar'
}

export interface TemplateThemeVar {
  key: string
  default: string
  control: 'color' | 'number' | 'font' | 'select'
}

export interface TemplateManifestV2 {
  templateId: string
  name: string
  sourceFile: string
  renderMode: 'semantic' | 'placeholder'
  regions: TemplateRegion[]
  blocks: TemplateBlock[]
  theme: TemplateThemeVar[]
  sampleData: Record<string, unknown>
  customFields: { name: string; label: string; type: string; selector?: string }[]
}
```

`types/index.ts` 的 `ResumeTemplate` 增加 `manifest?: TemplateManifestV2 | null`。

- [ ] **Step 2: 重写渲染器**

Rewrite `frontend/src/template-engine/index.ts`（保留 placeholder 引擎与 sanitize 函数，新增语义渲染）：

```ts
import type { ResumeData, ResumeTemplate, ResumeSectionItem, TemplateManifestV2 } from '@/types'

/** 语义区块 -> 条目字段类名别名表 */
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'project-name', 'company'],
  headline: ['headline', 'job-title', 'position', 'role'],
  school: ['school', 'edu-school'],
  degree: ['degree', 'edu-degree'],
  period: ['period', 'date', 'entry-meta', 'date-location'],
  description: ['description', 'entry-body', 'details', 'summary']
}

function findByToken(el: Element, tokens: string[]): Element | null {
  for (const token of tokens) {
    const hit = el.classList.contains(token) ? el : el.querySelector(`.${token}`)
    if (hit) return hit
  }
  return null
}

function setText(el: Element | null, value: unknown) {
  if (!el) return
  const text = Array.isArray(value) ? value.map((v) => String(v ?? '')).join(', ') : String(value ?? '')
  el.textContent = text
}

function fillItem(itemEl: Element, item: ResumeSectionItem) {
  for (const [key, tokens] of Object.entries(FIELD_ALIASES)) {
    setText(findByToken(itemEl, tokens), item[key])
  }
  const description = item['description']
  const body = findByToken(itemEl, ['entry-body', 'details', 'description'])
  if (body && typeof description === 'string' && description.includes('<')) {
    body.innerHTML = sanitizeRichText(description)
  }
}

function fillSection(container: Element, section: { title: string; items: ResumeSectionItem[] }, manifest: TemplateManifestV2) {
  setText(container.querySelector('.section-title'), section.title)
  const itemsEl = container.querySelector('.section-items') ?? container
  const skillTag = itemsEl.querySelector('.skill-tag')
  if (skillTag) {
    itemsEl.innerHTML = ''
    for (const item of section.items) {
      const clone = skillTag.cloneNode(true) as Element
      clone.textContent = [item['name'], item['level']].filter(Boolean).join(' · ')
      itemsEl.appendChild(clone)
    }
    return
  }
  const first = itemsEl.querySelector('.entry, [data-entry]')
  if (!first) return
  itemsEl.innerHTML = ''
  for (const item of section.items) {
    const clone = first.cloneNode(true) as Element
    fillItem(clone, item)
    itemsEl.appendChild(clone)
  }
}

function fillHeader(header: Element, data: ResumeData) {
  setText(header.querySelector('.name'), data.basics.name)
  setText(header.querySelector('.headline'), data.basics.headline)
  const list = header.querySelector('.contact-list')
  if (list) {
    const first = list.firstElementChild
    const items = [
      data.basics.email,
      data.basics.phone,
      data.basics.location,
      ...data.basics.customFields.map((f) => f.text)
    ].filter(Boolean)
    list.innerHTML = ''
    for (const text of items) {
      const el = first ? (first.cloneNode(true) as Element) : document.createElement('span')
      el.classList.add('contact-item')
      el.textContent = text
      list.appendChild(el)
    }
  }
}

function themeCss(data: ResumeData, templateCss: string): string {
  const c = data.metadata.design.colors
  const t = data.metadata.typography
  const p = data.metadata.page
  const vars = [
    `--color-primary:${c.primary};`,
    `--color-background:${c.background};`,
    `--color-text:${c.text};`,
    `--font-heading:${t.headingFont};`,
    `--font-body:${t.bodyFont};`,
    `--font-size-base:${t.fontSize}pt;`,
    `--page-margin:${p.margin}px;`
  ].join('')
  const custom = data.metadata.stylesheet ? `<style>${sanitizeCss(data.metadata.stylesheet)}</style>` : ''
  return `:root{${vars}}${custom}${templateCss}`
}

export function renderSemanticTemplate(template: ResumeTemplate, data: ResumeData): string {
  const manifest = template.manifest
  if (!manifest || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div id="__resume_root">${template.html ?? ''}</div>`, 'text/html')
  const root = doc.getElementById('__resume_root')
  if (!root) return ''
  const header = root.querySelector('.resume-header')
  if (header) fillHeader(header, data)
  for (const block of manifest.blocks) {
    const container = root.querySelector(block.selector)
    if (!container) continue
    const section = block.type === 'custom'
      ? undefined
      : data.sections[block.type]
    if (section) fillSection(container, section, manifest)
  }
  for (const custom of data.customSections) {
    const container = root.querySelector(`[data-section="custom"]`)
    if (container) {
      const sectionEl = document.createElement('section')
      sectionEl.className = 'section'
      sectionEl.innerHTML = `<div class="section-title"></div><div class="section-items"></div>`
      fillSection(sectionEl, custom as unknown as { title: string; items: ResumeSectionItem[] }, manifest)
      container.appendChild(sectionEl)
    }
  }
  const html = root.innerHTML
  const css = themeCss(data, template.css ?? '')
  return `${sanitizeCss(css) ? `<style>${sanitizeCss(css)}</style>` : ''}${sanitizeHtml(html)}`
}

export function renderTemplate(
  template: ResumeTemplate,
  data: unknown,
  context: Record<string, unknown> = {}
): string {
  if (template.manifest?.renderMode === 'semantic') {
    return renderSemanticTemplate(template, data as ResumeData)
  }
  return renderPlaceholder(template, data as Record<string, unknown>, context)
}
```

保留 `renderPlaceholder`（原 `renderSegment` 逻辑封装）、`sanitizeHtml`、`sanitizeCss`，并新增 `sanitizeRichText`：

```ts
/** 富文本消毒：白名单外标签一律移除，仅保留基础排版。 */
export function sanitizeRichText(html: string): string {
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const allowed = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a'])
  doc.querySelectorAll('*').forEach((node) => {
    const el = node as Element
    if (!allowed.has(el.tagName.toLowerCase())) {
      el.replaceWith(...Array.from(el.childNodes))
      return
    }
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || (name === 'href' && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name)
      }
      if (name !== 'href' && name !== 'target') el.removeAttribute(attr.name)
    })
  })
  return doc.body.innerHTML
}
```

- [ ] **Step 3: 编辑器/预览接入**

`ResumeEditor.vue` / `ResumePreview.vue` 预览改为：

```ts
const previewHtml = computed(() => {
  const tpl = selectedTemplate.value
  if (!tpl) return ''
  return renderTemplate(tpl, store.data, { resumeTitle: store.title })
})
const previewCss = computed(() => sanitizeCss(selectedTemplate.value?.css ?? ''))
```

删掉临时 JSON 渲染。

- [ ] **Step 4: 构建验证**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/types/resume.ts frontend/src/types/index.ts frontend/src/template-engine/index.ts frontend/src/views/ResumeEditor.vue frontend/src/views/ResumePreview.vue
git commit -m "feat: rewrite template engine with semantic renderer"
```

## Task 26: 模板市场卡片适配 manifest v2

**Files:**
- Modify: `frontend/src/views/TemplateList.vue`
- Test: `cd frontend; npm run build`

**Interfaces:**
- Consumes: `ResumeTemplate.manifest.theme`（主色默认值）

- [ ] **Step 1: 主色改用 manifest.theme**

`TemplateList.vue` 中主色取值改为：

```ts
function primaryColor(tpl: ResumeTemplate): string {
  const primary = tpl.manifest?.theme?.find((t) => t.key === '--color-primary')
  return primary?.default ?? '#4F46E5'
}
```

其余卡片交互不变。

- [ ] **Step 2: 构建验证**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/views/TemplateList.vue
git commit -m "feat: use manifest v2 theme default for template market cards"
```

---

# Phase 3：编辑器

## Task 27: 前端依赖安装与 ESLint 配置

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/eslint.config.js`
- Test: `cd frontend; npm run lint`

**Interfaces:**
- Produces: Tiptap / vuedraggable 运行时依赖；eslint + eslint-plugin-vue + typescript-eslint 开发依赖；`npm run lint` 可用。

- [ ] **Step 1: 安装依赖**

Run:

```powershell
cd frontend
npm install @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-text-align vuedraggable
npm install -D eslint eslint-plugin-vue typescript-eslint vue-eslint-parser
```

package.json 增加脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  }
}
```

- [ ] **Step 2: 写 ESLint 配置**

Create `frontend/eslint.config.js`：

```js
import eslintPluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' }
    }
  }
)
```

- [ ] **Step 3: 修 lint 报错**

Run: `cd frontend; npm run lint`
Expected: 通过；如有既有报错（未使用变量等），逐个修复后重跑，不得使用 eslint-disable 掩盖

- [ ] **Step 4: Commit**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/eslint.config.js
git commit -m "chore: add tiptap, vuedraggable and eslint setup"
```

## Task 28: resumeStore 草稿化 + useResumeDraft（撤销/重做）

**Files:**
- Modify: `frontend/src/stores/resumeStore.ts`
- Create: `frontend/src/composables/useResumeDraft.ts`
- Test: `cd frontend; npm run build`

**Interfaces:**
- Produces: `useResumeDraft(store)` 返回 `{ snapshot(), undo(), redo(), canUndo, canRedo }`；store 暴露 `applyData(patch)` 用于原地修改后拍快照。

- [ ] **Step 1: store 增加 applyData**

`resumeStore.ts` 增加：

```ts
function applyData(mutator: (draft: ResumeData) => void) {
  mutator(data.value)
}
```

并在返回对象中加入 `applyData`。

- [ ] **Step 2: 写 useResumeDraft**

Create `frontend/src/composables/useResumeDraft.ts`：

```ts
import { computed, ref } from 'vue'

import type { ResumeData } from '@/types'

export function useResumeDraft(data: { value: ResumeData }) {
  const past = ref<string[]>([])
  const future = ref<string[]>([])
  const MAX = 50

  function snapshot() {
    const current = JSON.stringify(data.value)
    const last = past.value[past.value.length - 1]
    if (last === current) return
    past.value.push(current)
    if (past.value.length > MAX) past.value.shift()
    future.value = []
  }

  function undo() {
    const prev = past.value.pop()
    if (prev === undefined) return
    future.value.push(JSON.stringify(data.value))
    data.value = JSON.parse(prev) as ResumeData
  }

  function redo() {
    const next = future.value.pop()
    if (next === undefined) return
    past.value.push(JSON.stringify(data.value))
    data.value = JSON.parse(next) as ResumeData
  }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  return { snapshot, undo, redo, canUndo, canRedo }
}
```

- [ ] **Step 3: 构建验证**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/stores/resumeStore.ts frontend/src/composables/useResumeDraft.ts
git commit -m "feat: add draft snapshot with undo/redo composable"
```

## Task 29: 三栏编辑器外壳

**Files:**
- Modify: `frontend/src/views/ResumeEditor.vue`
- Create: `frontend/src/components/builder/BuilderSectionSidebar.vue`
- Create: `frontend/src/components/builder/BuilderFormPane.vue`
- Create: `frontend/src/components/builder/BuilderPreviewPane.vue`
- Create: `frontend/src/components/builder/BuilderDesignPane.vue`
- Test: `cd frontend; npm run build`

**Interfaces:**
- Produces: 三栏布局；`selectedSection`（当前编辑区块 key，'basics' | 'summary' | section key | customSections[i]）。

- [ ] **Step 1: 改 ResumeEditor.vue 为三栏外壳**

Rewrite 模板主体：

```vue
<template>
  <main class="editor">
    <header class="editor-header">
      <h1>{{ editId ? '编辑简历' : '新建简历' }}</h1>
      <el-input v-model="store.title" class="title-input" placeholder="简历标题" />
      <el-button type="primary" :loading="store.saving" @click="save">保存</el-button>
      <el-button @click="undo">撤销</el-button>
      <el-button @click="redo">重做</el-button>
      <el-button @click="router.push('/resumes')">返回列表</el-button>
    </header>
    <div class="editor-body">
      <BuilderSectionSidebar
        v-model:selected="selectedSection"
        :data="store.data"
        @change="draft.snapshot()"
      />
      <BuilderFormPane :section="selectedSection" :data="store.data" @change="draft.snapshot()" />
      <div class="builder-right">
        <el-tabs v-model="rightTab">
          <el-tab-pane label="预览" name="preview">
            <BuilderPreviewPane :template="selectedTemplate" :data="store.data" />
          </el-tab-pane>
          <el-tab-pane label="设计" name="design">
            <BuilderDesignPane :template="selectedTemplate" :templates="templates" :data="store.data" @change="draft.snapshot()" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </main>
</template>
```

`script setup` 中：`const draft = useResumeDraft(store.data)`；`onMounted` 注册快捷键（Task 33）；保存前 `draft.snapshot()` 后调用 `store.save()`。

`templates` 沿用现有 `fetchTemplates()` 加载的列表，供设计面板模板选择使用。

- [ ] **Step 2: 布局样式**

`ResumeEditor.vue` 样式：`.editor-body { display: grid; grid-template-columns: 280px 1fr 420px; gap: 16px; }`，右栏 `min-height: 70vh`。

- [ ] **Step 3: 占位组件先建空壳**

四个 builder 组件先建可编译的空壳（props/emits 按本任务 Interfaces），保证 build 绿后再逐个填充（Tasks 30-32）。

- [ ] **Step 4: 构建验证**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/views/ResumeEditor.vue frontend/src/components/builder
git commit -m "feat: scaffold three-pane resume editor shell"
```

## Task 30: 左栏区块列表（拖拽/增删/显隐/自定义）

**Files:**
- Modify: `frontend/src/components/builder/BuilderSectionSidebar.vue`
- Test: `cd frontend; npm run build`

**Interfaces:**
- Consumes: `useResumeDraft`（父组件在 change 时 snapshot）
- Produces: 标准区块列表（来自 sections）+ 自定义区块（customSections）；emit `update:selected`、`change`。

- [ ] **Step 1: 列表与拖拽**

`BuilderSectionSidebar.vue` 模板（核心）：

```vue
<template>
  <aside class="builder-sidebar">
    <div class="sidebar-head">
      <span>区块</span>
      <el-button size="small" type="primary" plain @click="addCustom">+ 自定义区块</el-button>
    </div>
    <el-select
      v-model="pendingStandard"
      size="small"
      class="add-standard"
      placeholder="+ 添加标准区块"
      @update:model-value="onAddStandard"
    >
      <el-option v-for="[key, label] in availableStandard" :key="key" :label="label" :value="key" />
    </el-select>
    <draggable :list="orderedKeys" item-key="key" @end="$emit('change')">
      <template #item="{ element }">
        <div
          class="section-row"
          :class="{ active: element.key === selected }"
          @click="$emit('update:selected', element.key)"
        >
          <span class="drag-handle">⠿</span>
          <span class="section-label">{{ element.label }}</span>
          <el-switch
            size="small"
            :model-value="element.hidden"
            @update:model-value="toggleHidden(element.key, $event)"
          />
          <el-button v-if="element.custom" size="small" text type="danger" @click.stop="removeCustom(element.key)">删</el-button>
        </div>
      </template>
    </draggable>
  </aside>
</template>
```

`script` 中：

```ts
import draggable from 'vuedraggable'
import { ElMessageBox } from 'element-plus'
import { computed } from 'vue'

import { ref } from 'vue'

import type { ResumeCustomSection, ResumeData, ResumeSection } from '@/types'

const props = defineProps<{ selected: string; data: ResumeData }>()
const emit = defineEmits<{
  (e: 'update:selected', value: string): void
  (e: 'change'): void
}>()

const STANDARD_LABELS: Record<string, string> = {
  basics: '基本信息', summary: '个人简介', profiles: '社交链接', experience: '工作经历',
  education: '教育背景', projects: '项目经验', skills: '技能清单', languages: '语言能力',
  interests: '兴趣爱好', awards: '荣誉奖项', certifications: '证书', publications: '发表',
  volunteer: '志愿经历', references: '推荐人'
}

const orderedKeys = computed(() => {
  const list: { key: string; label: string; hidden: boolean; custom: boolean }[] = [
    { key: 'basics', label: '基本信息', hidden: false, custom: false },
    { key: 'summary', label: '个人简介', hidden: props.data.summary.hidden, custom: false }
  ]
  const layout = props.data.metadata.layout
  for (const key of [...layout.main, ...layout.sidebar]) {
    const section = props.data.sections[key]
    if (section) list.push({ key, label: section.title || STANDARD_LABELS[key] || key, hidden: section.hidden, custom: false })
  }
  for (const cs of props.data.customSections) {
    list.push({ key: cs.id, label: cs.title, hidden: cs.hidden, custom: true })
  }
  return list
})

const pendingStandard = ref('')

const availableStandard = computed(() => {
  const existing = new Set([
    ...props.data.metadata.layout.main,
    ...props.data.metadata.layout.sidebar,
    'basics',
    'summary'
  ])
  return Object.entries(STANDARD_LABELS).filter(([key]) => !existing.has(key))
})

function onAddStandard(key: string) {
  pendingStandard.value = ''
  if (!key) return
  const label = STANDARD_LABELS[key]
  if (!props.data.sections[key]) {
    const section: ResumeSection = { title: label, columns: 1, hidden: false, items: [] }
    props.data.sections[key] = section
  }
  if (!props.data.metadata.layout.main.includes(key)) {
    props.data.metadata.layout.main.push(key)
  }
  emit('update:selected', key)
  emit('change')
}

function findSection(key: string): { section: { hidden: boolean }; index?: number } {
  const customIndex = props.data.customSections.findIndex((c) => c.id === key)
  if (customIndex >= 0) return { section: props.data.customSections[customIndex], index: customIndex }
  if (key === 'summary') return { section: props.data.summary }
  return { section: props.data.sections[key] as { hidden: boolean } }
}

function toggleHidden(key: string, value: boolean) {
  findSection(key).section.hidden = value
  emit('change')
}

async function addCustom() {
  const { value } = await ElMessageBox.prompt('区块名称', '新建自定义区块')
  if (!value) return
  const cs: ResumeCustomSection = { id: crypto.randomUUID(), title: value, columns: 1, hidden: false, items: [] }
  props.data.customSections.push(cs)
  emit('update:selected', cs.id)
  emit('change')
}

async function removeCustom(key: string) {
  const index = props.data.customSections.findIndex((c) => c.id === key)
  if (index < 0) return
  await ElMessageBox.confirm('删除该自定义区块（数据不可恢复）？', '删除区块', { type: 'warning' })
  props.data.customSections.splice(index, 1)
  emit('update:selected', 'basics')
  emit('change')
}
```

拖拽 `@end` 后重排 `metadata.layout.main/sidebar` 与 `customSections` 顺序并 `$emit('change')`。

- [ ] **Step 2: 构建验证**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/components/builder/BuilderSectionSidebar.vue
git commit -m "feat: add draggable section sidebar with custom sections"
```

## Task 31: 中栏表单面板与富文本

**Files:**
- Modify: `frontend/src/components/builder/BuilderFormPane.vue`
- Create: `frontend/src/components/builder/RichTextEditor.vue`
- Create: `frontend/src/components/builder/SectionItemsEditor.vue`
- Test: `cd frontend; npm run build`

**Interfaces:**
- Consumes: `selected`（'basics' | 'summary' | section key | custom index）；`ResumeData`
- Produces: 按区块渲染表单；每次变更 `$emit('change')`。

- [ ] **Step 1: 富文本组件**

Create `frontend/src/components/builder/RichTextEditor.vue`：

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

let editor: Editor

onMounted(() => {
  editor = new Editor({
    content: props.modelValue,
    extensions: [StarterKit, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    onUpdate: ({ editor }) => emit('update:modelValue', editor.getHTML())
  })
})

onBeforeUnmount(() => editor?.destroy())
</script>

<template>
  <div class="rich-text-editor">
    <div class="rich-toolbar">
      <button type="button" @mousedown.prevent="editor.chain().focus().toggleBold().run()">B</button>
      <button type="button" @mousedown.prevent="editor.chain().focus().toggleItalic().run()">I</button>
      <button type="button" @mousedown.prevent="editor.chain().focus().toggleBulletList().run()">• 列表</button>
      <button type="button" @mousedown.prevent="editor.chain().focus().setTextAlign('left').run()">左</button>
      <button type="button" @mousedown.prevent="editor.chain().focus().setTextAlign('center').run()">中</button>
      <button type="button" @mousedown.prevent="editor.chain().focus().setTextAlign('right').run()">右</button>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>
```

- [ ] **Step 2: 条目编辑器**

Create `frontend/src/components/builder/SectionItemsEditor.vue`：

```vue
<script setup lang="ts">
import draggable from 'vuedraggable'
import { computed } from 'vue'

import type { ResumeSectionItem } from '@/types'

const props = defineProps<{ modelValue: ResumeSectionItem[]; fields: { key: string; label: string; type?: 'input' | 'textarea' }[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: ResumeSectionItem[]): void; (e: 'change'): void }>()

const items = computed(() => props.modelValue)

function setField(index: number, key: string, value: unknown) {
  const list = [...items.value]
  list[index] = { ...list[index], [key]: value }
  emit('update:modelValue', list)
  emit('change')
}

function addItem() {
  emit('update:modelValue', [...items.value, { id: crypto.randomUUID(), hidden: false }])
  emit('change')
}

function removeItem(index: number) {
  const list = [...items.value]
  list.splice(index, 1)
  emit('update:modelValue', list)
  emit('change')
}
</script>

<template>
  <div class="items-editor">
    <draggable :list="items" item-key="id" @end="$emit('change')">
      <template #item="{ element, index }">
        <div class="item-card">
          <div class="item-card-head">
            <span>{{ (element as Record<string, unknown>).name || (element as Record<string, unknown>).company || `条目 ${index + 1}` }}</span>
            <el-button size="small" text type="danger" @click="removeItem(index)">删除</el-button>
          </div>
          <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
            <el-input
              v-if="field.type !== 'textarea'"
              :model-value="(element as Record<string, unknown>)[field.key] as string | undefined"
              @update:model-value="setField(index, field.key, $event)"
            />
            <el-input
              v-else
              type="textarea"
              :rows="3"
              :model-value="(element as Record<string, unknown>)[field.key] as string | undefined"
              @update:model-value="setField(index, field.key, $event)"
            />
          </el-form-item>
        </div>
      </template>
    </draggable>
    <el-button size="small" type="primary" plain @click="addItem">添加条目</el-button>
  </div>
</template>
```

- [ ] **Step 3: 表单面板**

`BuilderFormPane.vue` 核心：

```vue
<script setup lang="ts">
import { computed } from 'vue'

import RichTextEditor from './RichTextEditor.vue'
import SectionItemsEditor from './SectionItemsEditor.vue'
import type { ResumeData } from '@/types'

const props = defineProps<{ section: string; data: ResumeData }>()
const emit = defineEmits<{ (e: 'change'): void }>()

const FIELD_MAP: Record<string, { key: string; label: string; type?: 'textarea' }[]> = {
  experience: [{ key: 'company', label: '公司' }, { key: 'position', label: '职位' },
    { key: 'period', label: '时间' }, { key: 'location', label: '地点' }, { key: 'description', label: '描述', type: 'textarea' }],
  education: [{ key: 'school', label: '学校' }, { key: 'degree', label: '学位' },
    { key: 'major', label: '专业' }, { key: 'period', label: '时间' }, { key: 'description', label: '描述', type: 'textarea' }],
  skills: [{ key: 'name', label: '技能' }, { key: 'level', label: '熟练度' }],
  projects: [{ key: 'name', label: '项目' }, { key: 'role', label: '角色' }, { key: 'period', label: '时间' },
    { key: 'description', label: '描述', type: 'textarea' }],
  languages: [{ key: 'name', label: '语言' }, { key: 'level', label: '水平' }],
  awards: [{ key: 'name', label: '奖项' }, { key: 'date', label: '时间' }, { key: 'description', label: '说明', type: 'textarea' }]
}

const currentSection = computed(() => props.data.sections[props.section])
const fields = computed(() => FIELD_MAP[props.section] ?? [{ key: 'name', label: '名称' }, { key: 'description', label: '描述', type: 'textarea' }])
</script>

<template>
  <div class="form-pane">
    <template v-if="section === 'basics'">
      <el-form label-width="88px">
        <el-form-item label="姓名"><el-input :model-value="data.basics.name" @update:model-value="data.basics.name = $event; $emit('change')" /></el-form-item>
        <el-form-item label="头衔"><el-input :model-value="data.basics.headline" @update:model-value="data.basics.headline = $event; $emit('change')" /></el-form-item>
        <el-form-item label="邮箱"><el-input :model-value="data.basics.email" @update:model-value="data.basics.email = $event; $emit('change')" /></el-form-item>
        <el-form-item label="电话"><el-input :model-value="data.basics.phone" @update:model-value="data.basics.phone = $event; $emit('change')" /></el-form-item>
        <el-form-item label="所在地"><el-input :model-value="data.basics.location" @update:model-value="data.basics.location = $event; $emit('change')" /></el-form-item>
      </el-form>
    </template>
    <template v-else-if="section === 'summary'">
      <RichTextEditor :model-value="data.summary.content" @update:model-value="data.summary.content = $event; $emit('change')" />
    </template>
    <template v-else-if="currentSection">
      <el-input :model-value="currentSection.title" @update:model-value="currentSection.title = $event; $emit('change')" />
      <SectionItemsEditor
        :model-value="currentSection.items"
        :fields="fields"
        @update:model-value="currentSection.items = $event"
        @change="$emit('change')"
      />
    </template>
  </div>
</template>
```

custom 区块的编辑复用 `currentSection` 分支（在 `data.customSections` 中按 selected id 查找后传入同构对象）。

- [ ] **Step 3: 构建验证**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/components/builder/BuilderFormPane.vue frontend/src/components/builder/RichTextEditor.vue frontend/src/components/builder/SectionItemsEditor.vue
git commit -m "feat: add section form pane with rich text editor"
```

## Task 32: 预览面板与设计面板

**Files:**
- Modify: `frontend/src/components/builder/BuilderPreviewPane.vue`
- Modify: `frontend/src/components/builder/BuilderDesignPane.vue`
- Modify: `frontend/src/composables/usePageScale.ts`
- Test: `cd frontend; npm run build`

**Interfaces:**
- Consumes: `renderTemplate`（Task 25）、`ResumeTemplate.manifest.theme`
- Produces: 预览支持缩放/平移/A4|Letter 切换；设计面板修改 `metadata.design/typography/page/stylesheet` 后 `$emit('change')`。

- [ ] **Step 1: 预览面板**

`BuilderPreviewPane.vue`：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

import { renderTemplate, sanitizeCss } from '@/template-engine'
import { usePageScale } from '@/composables/usePageScale'
import type { ResumeData, ResumeTemplate } from '@/types'

const props = defineProps<{ template: ResumeTemplate | null; data: ResumeData }>()
const stageRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const format = ref<'A4' | 'Letter'>('A4')
const zoom = ref(1)

const { viewportStyle, scalerStyle } = usePageScale(stageRef, contentRef)

const previewHtml = computed(() => (props.template ? renderTemplate(props.template, props.data) : ''))
const previewCss = computed(() => sanitizeCss(props.template?.css ?? ''))
const pageStyle = computed(() => {
  const w = format.value === 'A4' ? 794 : 816
  return { width: `${w}px`, minHeight: '1122px', transform: `scale(${zoom.value})`, transformOrigin: 'top left' }
})
</script>

<template>
  <div class="preview-pane">
    <div class="preview-toolbar">
      <el-radio-group v-model="format" size="small">
        <el-radio-button value="A4">A4</el-radio-button>
        <el-radio-button value="Letter">Letter</el-radio-button>
      </el-radio-group>
      <el-input-number v-model="zoom" :min="0.5" :max="2" :step="0.1" size="small" />
    </div>
    <div ref="stageRef" class="preview-stage">
      <div class="preview-viewport" :style="viewportStyle">
        <div ref="contentRef" class="preview-scaler" :style="scalerStyle">
          <div class="preview-html" :style="pageStyle" v-html="previewHtml"></div>
        </div>
      </div>
    </div>
    <style>{{ previewCss }}</style>
  </div>
</template>
```

`usePageScale` 增加 scale/translate 状态以支持鼠标滚轮缩放与拖拽平移。

- [ ] **Step 2: 设计面板**

`BuilderDesignPane.vue` 渲染：

```vue
<template>
  <div class="design-pane">
    <el-divider content-position="left">主题色</el-divider>
    <el-form label-width="88px">
      <el-form-item label="主色"><el-color-picker :model-value="colors.primary" @update:model-value="setColor('primary', $event)" /></el-form-item>
      <el-form-item label="正文"><el-color-picker :model-value="colors.text" @update:model-value="setColor('text', $event)" /></el-form-item>
      <el-form-item label="背景"><el-color-picker :model-value="colors.background" @update:model-value="setColor('background', $event)" /></el-form-item>
    </el-form>
    <el-divider content-position="left">排版</el-divider>
    <el-form label-width="88px">
      <el-form-item label="标题字体"><el-input :model-value="typography.headingFont" @update:model-value="setType('headingFont', $event)" /></el-form-item>
      <el-form-item label="正文字体"><el-input :model-value="typography.bodyFont" @update:model-value="setType('bodyFont', $event)" /></el-form-item>
      <el-form-item label="字号"><el-input-number :model-value="typography.fontSize" :min="8" :max="20" @update:model-value="setType('fontSize', $event)" /></el-form-item>
      <el-form-item label="页边距"><el-input-number :model-value="page.margin" :min="0" :max="100" @update:model-value="setPageMargin($event)" /></el-form-item>
      <el-form-item label="自定义 CSS"><el-input type="textarea" :rows="6" :model-value="stylesheet" @update:model-value="setStylesheet($event)" /></el-form-item>
    </el-form>
    <el-divider content-position="left">模板</el-divider>
    <el-select :model-value="metadata.template" @update:model-value="setTemplate($event)">
      <el-option v-for="t in templates" :key="t.code" :label="t.name" :value="t.code" />
    </el-select>
  </div>
</template>
```

`script` 中：

```ts
import { computed } from 'vue'

import type { ResumeData, ResumeTemplate } from '@/types'

const props = defineProps<{ template: ResumeTemplate | null; templates: ResumeTemplate[]; data: ResumeData }>()
const emit = defineEmits<{ (e: 'change'): void }>()

const colors = computed(() => props.data.metadata.design.colors)
const typography = computed(() => props.data.metadata.typography)
const page = computed(() => props.data.metadata.page)
const stylesheet = computed(() => props.data.metadata.stylesheet)
const metadata = computed(() => props.data.metadata)

function setColor(key: 'primary' | 'text' | 'background', value: string) {
  colors.value[key] = value
  emit('change')
}

function setType(key: 'headingFont' | 'bodyFont' | 'fontSize', value: string | number) {
  typography.value[key] = value as never
  emit('change')
}

function setPageMargin(value: number) {
  page.value.margin = value
  emit('change')
}

function setStylesheet(value: string) {
  props.data.metadata.stylesheet = value
  emit('change')
}

function setTemplate(code: string) {
  metadata.value.template = code
  emit('change')
}
```

模板切换只改 `metadata.template`（数据不搬移）。

- [ ] **Step 3: 构建验证**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/components/builder/BuilderPreviewPane.vue frontend/src/components/builder/BuilderDesignPane.vue frontend/src/composables/usePageScale.ts
git commit -m "feat: add preview and design panes"
```

## Task 33: 快捷键（保存/撤销/重做/导出）

**Files:**
- Modify: `frontend/src/views/ResumeEditor.vue`
- Test: `cd frontend; npm run build`

**Interfaces:**
- Consumes: `useResumeDraft`（Task 28）

- [ ] **Step 1: 注册快捷键**

`ResumeEditor.vue` onMounted 增加：

```ts
function onKeydown(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  if (e.key.toLowerCase() === 's') { e.preventDefault(); save() }
  if (e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); redo() }
  else if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
  if (e.key.toLowerCase() === 'p') { e.preventDefault(); window.print() }
}

window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
```

`save()` 内：`draft.snapshot(); await store.save(); ElMessage.success('已保存')`。

- [ ] **Step 2: 构建验证**

Run: `cd frontend; npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/views/ResumeEditor.vue
git commit -m "feat: add keyboard shortcuts for save undo redo export"
```

## Task 34: 预览页/导出与端到端回归

**Files:**
- Modify: `frontend/src/views/ResumePreview.vue`
- Test: 端到端手工验收（附录清单）

- [ ] **Step 1: 预览页接入语义渲染**

`ResumePreview.vue`：`import { parseData } from '@/stores/resumeStore'`，加载 `ResumeVO` 后 `data.value = parseData(vo.data)`，`previewHtml` 用 `renderTemplate(template, data)`；保留 `window.print()` 导出与"模板已下架"提示。

- [ ] **Step 2: 全量回归**

Run: `cd backend; mvn -q test`；`cd frontend; npm run build`；`cd frontend; npm run lint`
Expected: 全部 PASS

- [ ] **Step 3: 端到端手工验收（附录 C 清单）**

按设计文档附录 C 的 10 项逐条验收：新建→选模板→填 basics/summary/各区块→拖拽排序→显隐→自定义区块→富文本→主题/字体/页边距/CSS→切模板数据保留→撤销重做→快捷键→导出 PDF→存量迁移简历编辑保存导出。任何一项失败回对应任务修复。

- [ ] **Step 4: Commit（若 Step 3 有修复则一并提交）**

```powershell
git add -A
git commit -m "feat: complete resume editor end-to-end"
```
