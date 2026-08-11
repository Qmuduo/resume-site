# AGENTS.md — Resume Template Site

## Stack
- Backend: Spring Boot 3.2 + Java 17 + MyBatis-Plus + MySQL 8 + Redis + RabbitMQ
- Frontend: Vue 3 + Vite + TypeScript + Pinia + Vue Router + Element Plus
- AI: LLM 调用走后端 ai 包，模板输出必须过 JSON Schema 校验，禁止 AI 直接写 JS 到库
- Resume data: MySQL JSON column; Template = JSON Schema + HTML/CSS 描述

## Layout
- backend/com.resume.api/ : 后端根包
  - controller/ : 接口层，统一返回 Result<T>
  - service/ : 业务层
  - repository/ : 数据访问层（MyBatis-Plus）
  - ai/ : LLM 调用与 JSON Schema 校验
  - mq/ : RabbitMQ 消息处理
  - config/ : 配置类
- frontend/src/ : 前端源码
  - api/ : HTTP 请求封装
  - views/ : 页面
  - components/ : 组件
  - stores/ : Pinia 状态
  - types/ : TypeScript 类型定义
  - template-engine/ : 简历模板渲染引擎
- docs/template-schema.json : 简历模板受控 schema 定义（AI 生成 template 的字段白名单依据）

## Commands
- 环境前提：Spring Boot 3.2 需要 Java 17；本机默认 JAVA_HOME 指向 JDK 17
- 本机默认 shell 为 Windows PowerShell 5.1，不支持 `&&`，命令统一用 `;` 连接
- 后端启动：`cd backend; mvn -q spring-boot:run`
- 后端测试：`cd backend; mvn -q test`
- 前端启动：`cd frontend; npm install; npm run dev`
- 前端构建：`cd frontend; npm run build`
- 前端 lint：`cd frontend; npm run lint`
- 注意：以上命令需在工程文件（backend/pom.xml、frontend/package.json）就绪后执行

## Rules
- 后端 DTO 用 JSR-380 校验；统一响应体 Result<T>
- 前端禁止在 v-html 里渲染未 sanitize 的 AI 输出
- AI 生成 template 只许输出 docs/template-schema.json 内白名单字段
- 不改代码风格；新增依赖先问用户
- 改完后端跑 `mvn -q test`，改完前端跑 `npm run build`，都过再算完成

## Do NOT
- 不要碰 docs/ 外的 SQL 初始化文件以外的 DB 手动改表
- 不要把 secret 写进代码或 AGENTS.md
- 不要用 full-auto 在主干直接跑

## Per-Module Rules
- Backend: see [backend/AGENTS.md](backend/AGENTS.md)
- Frontend: see [frontend/AGENTS.md](frontend/AGENTS.md)

## 模板接入规范（v2：数据与模板解耦）

### 数据分层（强制）
- 公共字段统一存 `resume.common_data`，结构以 [docs/resume-common.schema.json](docs/resume-common.schema.json) 为准（basic/summary/experiences/education/skills/socials/projects/certifications/languages/awards/interests）。
- 模板专属字段存 `resume.extended_data`（key-value），由模板 manifest 声明。
- `resume.current_template_id` 记录当前模板编码（template.code）。
- 禁止把模板专属字段写进 common_data；禁止删改用户 extended_data 中未映射的键（切模板时只能暂存/迁移，不能丢弃）。

### 新模板接入流程（目标 ≤15 分钟）
1. 把模板 HTML 放入 `docs/template/<template_id>.html`（命名小写字母/数字/下划线，如 `prompt_101.html`）。
2. 运行分析脚本自动生成 manifest：
   ```powershell
   node scripts/analyze-templates.js
   ```
   该脚本会扫描全部 HTML，生成 `docs/template/<template_id>.manifest.json` 与 `docs/template-analysis-report.json`。
3. 人工核对 manifest：
   - 打开 `docs/template/<template_id>.manifest.json`，检查 `fields` 中 `commonPath` 是否准确；
   - `pendingManual` 中的字段必须人工确认后填写 `commonPath`（能映射的）或保留 `null`（模板专属），并把 `autoDetected` 置为 `true`；
   - 联系方式/头像等标量映射的 `selector` 必须能命中页面元素。
4. 运行验证脚本（必须 0 错误）：
   ```powershell
   node scripts/validate-template.js docs/template/<template_id>.html
   ```
5. 重启后端，模板会在启动时自动种子进 `template` 与 `template_config` 表。
6. 前端刷新模板市场，检查预览效果与原版一致；用编辑器填一次公共数据并切换模板验证数据保留。

### 模板 HTML 要求
- 允许 `<style>`；禁止 `<script>`、`on*` 事件、`javascript:` 等可执行内容（前端渲染会二次消毒）。
- 推荐语义化类名：`name`、`contact-item`、`section-title`、`entry`、`school`/`degree`/`date`、`skill-tag`、`project-item` 等，便于自动分析。
- 静态模板可内嵌示例数据（分析脚本自动提取为 `sampleData`，保证原版预览不变）；占位符模板用 `{{field}}` / `{{#each list}}`。

### manifest 结构
```json
{
  "templateId": "prompt_101",
  "name": "模板名",
  "sourceFile": "prompt_101.html",
  "renderMode": "static | placeholder",
  "fields": [{ "name": "name", "label": "姓名", "type": "string",
               "commonPath": "basic.name", "autoDetected": true, "transform": "name" }],
  "mappings": [{ "commonPath": "basic.name", "selector": ".name",
                 "attribute": "textContent", "autoDetected": true }],
  "sampleData": {},
  "pendingManual": []
}
```
- `commonPath` 必须能在 [docs/resume-common.schema.json](docs/resume-common.schema.json) 中找到；找不到的字段必须 `commonPath: null` 并进入 `pendingManual`。
- 列表映射用 `attribute: "children"` + `itemSelector`（或 `sectionTitle` 按区块标题定位）。

### 常用命令
```powershell
# 全量分析（重新生成 docs/template 全部 manifest 与报告，当前为 12 份）
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
- 结构变更：`docs/sql/schema-v2.sql`（幂等）。
- 旧 `resume.data` 拆分：`docs/sql/migrate-resume-v2.sql`（必须先备份 `resume_backup_pre_v2`，迁移后跑脚本内校验 SQL，全部通过再删旧列）。
- 模板市场 v3（分类/标签列 + 下架模板清理）：`docs/sql/template-market-v3.sql`（幂等，全新库与存量库均可执行）。
- 内置模板精简 v4（保留 13 份、清理其余内置模板）：`docs/sql/retire-template-v4.sql`（幂等，存量库执行；全新库启动种子即只写入保留模板）。

### 模板市场与分类标签（v3）
- `template` 表新增 `category VARCHAR(64)` 与 `tags JSON`（标签为字符串数组）。
- 市场中文名/分类/标签/主色以 `backend/com.resume.api/src/main/resources/template-market-catalog.json` 为准，
  后端启动种子时自动写入 template 表；前端市场页从模板 CSS 提取主色/字体/版式渲染风格化卡片，并按分类/标签筛选。
- 内置模板精简为 13 份：`cv2`、`prompt_013`、`prompt_03`、`prompt_021`、`prompt_026`、`prompt_057`、
  `prompt_044`、`prompt_04`、`prompt_05`、`prompt_063`、`prompt_09`、`prompt_10`、`prompt_089`。
  已下架内置模板编码清单见 `backend/com.resume.api/src/main/resources/template-retired-codes.json`，
  启动种子后统一清理 builtin 记录与 template_config；存量简历仍指向下架模板时保留引用，
  前端预览/编辑给出明确提示"模板已下架，请重新选择模板"，数据不丢失。
- 内置占位符模板（cv2）的 `manifest.sampleData` 来自对应静态 HTML 的示例数据；
  市场预览与编辑器空数据预览直接可见完整演示内容。
- 演示数据姓名一律取自名单：屈原、陶渊明、李白、杜甫、白居易、王维、李商隐、苏轼、辛弃疾、李清照
  （同一模板内保持一致；`scripts/randomize-demo-names.js` 负责批量替换）。
