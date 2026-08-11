# AGENTS.md — Resume Template Site

## Stack
- Backend: Spring Boot 3.2 + Java 17 + MyBatis-Plus + MySQL 8 + Redis + RabbitMQ
- Frontend: Vue 3 + Vite + TypeScript + Pinia + Vue Router + Element Plus + Tiptap（富文本）+ SortableJS/vuedraggable（拖拽）
- AI: LLM 调用走后端 ai 包，输出必须过 JSON Schema 校验；禁止 AI 直接写 JS 到库
- Resume data: `resume.data` 单 JSON 列存完整 ResumeData 文档（带 version）；Template = 语义化 HTML/CSS + manifest v2（主题变量）

## Layout
- backend/com.resume.api/ : 后端根包
  - controller/ : 接口层，统一返回 Result<T>
  - service/ : 业务层
  - repository/ : 数据访问层（MyBatis-Plus）
  - ai/ : LLM 调用与 JSON Schema 校验（本期含 ResumeSchemaValidator / TemplateSchemaValidator 接口）
  - mq/ : RabbitMQ 消息处理
  - config/ : 配置类
- frontend/src/ : 前端源码
  - api/ : HTTP 请求封装
  - views/ : 页面
  - components/ : 组件
  - stores/ : Pinia 状态
  - types/ : TypeScript 类型定义（与 docs/resume.schema.json 对齐）
  - template-engine/ : 语义化模板渲染引擎
- docs/resume.schema.json : ResumeData 唯一契约（后端校验与 AI 生成简历数据的依据）
- docs/template-schema.json : 模板与 manifest v2 受控 schema（AI 生成 template 的白名单依据）

## Commands
- 环境前提：Spring Boot 3.2 需要 Java 17；本机默认 JAVA_HOME 指向 JDK 17
- 本机默认 shell 为 Windows PowerShell 5.1，不支持 `&&`，命令统一用 `;` 连接
- 后端启动：`cd backend; mvn -q spring-boot:run`
- 后端测试：`cd backend; mvn -q test`
- 前端启动：`cd frontend; npm install; npm run dev`
- 前端构建：`cd frontend; npm run build`
- 前端 lint：`cd frontend; npm run lint`（ESLint 配置完成后可用；前端验证以 `npm run build` 为准）
- 注意：以上命令需在工程文件（backend/pom.xml、frontend/package.json）就绪后执行

## Rules
- 后端 DTO 用 JSR-380 校验；`resume.data` 写入前还必须通过 docs/resume.schema.json 的 JSON Schema 校验
- 统一响应体 Result<T>
- 前端禁止在 v-html 里渲染未 sanitize 的 AI 输出
- AI 生成 template 只许输出 docs/template-schema.json 内白名单字段（HTML/CSS + manifest v2）
- 不改代码风格；新增依赖先问用户
- 改完后端跑 `mvn -q test`，改完前端跑 `npm run build`（lint 可用后一并跑），都过再算完成

## Do NOT
- 不要碰 docs/ 外的 SQL 初始化文件以外的 DB 手动改表
- 不要把 secret 写进代码或 AGENTS.md
- 不要用 full-auto 在主干直接跑
- 不要在 `resume.data` 文档之外另建列/表存简历字段

## Per-Module Rules
- Backend: see [backend/AGENTS.md](backend/AGENTS.md)
- Frontend: see [frontend/AGENTS.md](frontend/AGENTS.md)

## 模板接入规范（v3：ResumeData 单文档 + 语义化模板）

### 数据模型（强制）
- 简历数据统一存 `resume.data`（JSON），结构以 [docs/resume.schema.json](docs/resume.schema.json) 为准：顶层含 version（当前 1.0）、basics、summary、sections、customSections、picture、metadata。
- 模板编码记录在 `data.metadata.template`；切换模板只改该字段，数据不搬移、不丢弃。
- 禁止在 data 文档之外另存简历字段；用户自定义区块走 `customSections`，模板专属信息走对应区块/自定义字段。

### 新模板接入流程（目标 ≤15 分钟）
1. 把模板 HTML 放入 `docs/template/<template_id>.html`（命名小写字母/数字/下划线，如 `prompt_101.html`）。
2. 运行分析脚本自动生成 manifest：
   ```powershell
   node scripts/analyze-templates.js
   ```
3. 人工核对 manifest v2：语义类名齐全、`blocks` 选择器能命中区块容器、`theme` 变量都有默认值、模板专属字段声明准确。
4. 运行验证脚本（必须 0 错误）：
   ```powershell
   node scripts/validate-template.js docs/template/<template_id>.html
   ```
5. 重启后端，模板会在启动时自动种子进 `template` 与 `template_config` 表。
6. 前端刷新模板市场，检查预览与原版一致；用编辑器填一次数据并切换模板验证数据保留。

### 模板 HTML 要求
- 允许 `<style>`；禁止 `<script>`、`on*` 事件、`javascript:` 等可执行内容（前端渲染会二次消毒）。
- 强制语义类名：页面骨架 `resume-page` / `resume-header` / `resume-main` / `resume-sidebar`；区块 `section` + `section-title` + `section-items`；条目 `entry`（内部 `entry-header` / `entry-meta` / `entry-body`）；联系信息 `contact-item`；技能 `skill-tag`；教育/项目 `edu-*`、`proj-*`。
- 主题定制用 CSS 变量：`--color-primary`、`--color-background`、`--color-text`、`--color-sidebar-background`、`--color-sidebar-foreground`、`--font-heading`、`--font-body`、`--font-size-base`、`--page-margin`、`--section-gap` 等（manifest 声明默认值与控件类型）。

### manifest v2 结构
```json
{
  "templateId": "prompt_101",
  "name": "模板名",
  "sourceFile": "prompt_101.html",
  "renderMode": "semantic",
  "regions": [{ "name": "header", "placement": "main" }],
  "blocks": [{ "type": "experience", "selector": ".section[data-section='experience']" }],
  "theme": [{ "key": "--color-primary", "default": "#4F46E5", "control": "color" }],
  "sampleData": {},
  "customFields": []
}
```
- `renderMode`：semantic（内置模板）| placeholder（`{{field}}` 占位符，供 AI 生成模板）。
- `blocks` 的 `type` 必须能在 [docs/resume.schema.json](docs/resume.schema.json) 的 sections/customSections 中找到；找不到的进 `customFields` 或 `customSections`。
- 校验脚本同时检查：语义类名齐全、CSS 变量有默认值、无危险内容。

### 常用命令
```powershell
# 全量分析（重新生成 docs/template 全部 manifest 与报告，当前为 13 份）
node scripts/analyze-templates.js
# 验证单个/全部模板
node scripts/validate-template.js docs/template/prompt_101.html
node scripts/validate-template.js --report
# 重新生成内置占位符模板 manifest
node scripts/generate-builtin-manifests.js
# 为内置占位符模板（cv2）生成 sampleData（数据源 scripts/data/placeholder-sample-data.json）
node scripts/build-placeholder-sample-data.js
# 生成模板市场目录（中文名/分类/标签/主色，输出 backend resources/template-market-catalog.json）
node scripts/build-market-catalog.js
# 演示数据姓名随机化（写入 HTML/manifest/占位符演示数据源，并重新生成占位符 manifest）
node scripts/randomize-demo-names.js
```

### 数据迁移
- 结构变更：`docs/sql/schema-v3.sql`（幂等）：resume 表新增 `data` JSON 列，退役 common_data / extended_data / current_template_id / template_code。
- 存量迁移：`docs/sql/migrate-resume-v3.sql` + `scripts/migrate-resume-v3.js`（必须先备份 `resume_backup_pre_v3`，迁移后跑脚本内校验 SQL——行数一致、schema 校验通过、抽样核对——全部通过再删旧列）。
- 模板市场 v3（分类/标签列 + 下架模板清理）：`docs/sql/template-market-v3.sql`（幂等，保持现状）。
- 内置模板精简 v4（保留 13 份）：`docs/sql/retire-template-v4.sql`（幂等，保持现状）。

### 模板市场与分类标签（v3，保持现状）
- `template` 表 `category VARCHAR(64)` 与 `tags JSON`（字符串数组）；市场中文名/分类/标签/主色以 `backend/com.resume.api/src/main/resources/template-market-catalog.json` 为准，后端启动种子时自动写入。
- 内置模板 13 份：`cv2`、`prompt_013`、`prompt_03`、`prompt_021`、`prompt_026`、`prompt_057`、`prompt_044`、`prompt_04`、`prompt_05`、`prompt_063`、`prompt_09`、`prompt_10`、`prompt_089`。
- 已下架内置模板编码清单见 `backend/com.resume.api/src/main/resources/template-retired-codes.json`；存量简历仍指向下架模板时保留引用，前端提示"模板已下架，请重新选择模板"，数据不丢失。
- 演示数据姓名一律取自名单：屈原、陶渊明、李白、杜甫、白居易、王维、李商隐、苏轼、辛弃疾、李清照（同一模板内保持一致；`scripts/randomize-demo-names.js` 负责批量替换）。
