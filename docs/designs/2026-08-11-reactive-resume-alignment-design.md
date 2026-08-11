# 对齐 Reactive-Resume 重构设计（数据模型 / 模板体系 / 编辑器）

- 日期：2026-08-11
- 状态：已与用户逐节确认，待用户审阅定稿文件
- 参考上游：[amruthpillai/reactive-resume](https://github.com/amruthpillai/reactive-resume)（v5，TanStack Start + React 19 + @react-pdf/renderer）
- 本设计只对齐其**数据模型规范、模板组织方式与编辑体验**，技术栈保持本项目现状：Spring Boot 3.2 + MySQL 8 + Vue 3 + Element Plus

## 决策记录

| # | 问题 | 结论 |
|---|------|------|
| 1 | 借鉴深度 | 全面对齐（重写式）：数据模型、模板体系、编辑器整体对齐 |
| 2 | 模板载体 | 语义化 HTML+CSS + 主题变量，禁止 JS，AI 可继续输出同构 HTML/CSS |
| 3 | 数据存储 | `resume` 表单文档 JSON 列，存完整 ResumeData（带 version） |
| 4 | 编辑器范围 | 完整对齐：三栏 + 拖拽 + 富文本 + 设计面板 + 撤销重做 + 快捷键 |
| 5 | 存量资产 | 存量数据一次性迁移 + 13 份内置模板全量语义化改造 |
| 6 | AI 能力 | 本期只预留校验器接口与 schema 白名单，不实现 AI 功能 |
| 7 | 落地顺序 | 后端先行、分层推进：数据模型 → 模板体系 → 编辑器 |

---

## 1. 目标与范围

本次重构把应用改造成 reactive-resume 式的"内容与展示彻底分离"架构，分三层落地：数据模型（ResumeData 单文档）、模板体系（语义化 HTML+CSS+主题变量）、编辑器（三栏完整体验）。范围包括后端 DDL/API/迁移脚本、13 份内置模板语义化改造与市场适配、前端渲染引擎和编辑器重写。

本期不做 AI 功能，只预留校验器接口与 schema 白名单；权限/登录等已有能力不动；PDF 导出沿用现有浏览器打印路径（print CSS），不引入新依赖。

成功标准：存量数据迁移后逐字段核对无损；13 份模板改造后预览与改造前视觉一致；编辑器支持区块拖拽排序、富文本、设计设置、撤销重做；后端 `mvn -q test` 与前端 `npm run build` 全绿。

## 2. 数据模型：ResumeData 单文档

每份简历存一个带版本号的 JSON 文档，顶层结构对齐 reactive-resume v5：`version`（当前 1.0）、`basics`、`summary`、`sections`、`customSections`、`picture`、`metadata`。

- `basics`：name / headline / email / phone / location / website，以及 `customFields`（图标+文本+链接，承接微信、地址等国内习惯联系方式）。
- `summary`：独立成节，内容为受控 HTML。
- `sections`：统一结构 `{title, columns, hidden, items[]}`，条目必带 `id` 与 `hidden`；标准区块 12 类：profiles、experience、education、projects、skills、languages、interests、awards、certifications、publications、volunteer、references。
- `customSections`：用户自定义任意区块，结构与 sections 一致。
- `picture`：头像及圆角/边框等配置。
- `metadata`：template、layout（区块顺序与分栏）、page（A4/Letter、页边距）、design（主题色）、typography（字体/字号）、notes、stylesheet（自定义 CSS）。

规范以 `docs/resume.schema.json`（draft 2020-12）为唯一契约；后端 Jackson 反序列化 + JSR-380 双重校验；前端类型定义由 schema 对齐生成。

## 3. 存储与 API

`resume` 表收敛为元数据列（id、user_id、title、status、created_at、updated_at）+ 一个 `data` JSON 列存完整 ResumeData；`common_data`、`extended_data`、`current_template_id`、`template_code` 全部退役。模板选择不再单独存列，写进 `data.metadata.template`；切换模板只是修改该字段，不再做字段搬运。

API 保持 `Result<T>` 与现有路由风格：

- 简历 `GET/PUT /api/resumes/{id}` 直接收发整份文档（title/status 并列传）；新增简历同样传整份文档。
- 本期不做按区块的部分更新接口，编辑器每次保存整份文档。
- 模板列表接口返回 manifest v2（语义区块声明、主题变量默认值、示例数据）；`/api/templates` 的创建/更新仅面向自定义模板，内置模板不可改。

后端在写入前用 `docs/resume.schema.json` 做 JSON Schema 校验 + JSR-380 字段校验，拒绝脏文档。`template_id` 等旧字段从实体、VO、前端类型中同步移除。

## 4. 存量数据迁移

迁移把 `common_data + extended_data + current_template_id` 合并为 ResumeData v1.0 文档，映射规则：

| 旧字段 | 新文档位置 |
|--------|-----------|
| basic.name / title / phone / email / location | basics.name / headline / phone / email / location |
| basic.address、basic.avatar | basics.customFields（地址文本）、picture.url（头像） |
| summary | summary.content |
| experiences / education / skills / projects / certifications / languages / awards / interests | 对应标准区块（sections.*），每条补 `id` |
| socials | sections.profiles |
| extended_data 中可按旧 manifest.commonPath 映射的键 | 回填对应区块字段 |
| extended_data 中无法映射的模板专属字段 | customSections 或 basics.customFields（不丢数据） |
| current_template_id | metadata.template；其余 metadata 用默认值（A4、模板默认主题/字体） |

做法沿用现有迁移规范：先建备份表 `resume_backup_pre_v3`；迁移用 Node 脚本（读取旧列与 `docs/template/*.manifest.json` 反查映射）生成新文档；完成后跑校验——行数一致、每行 JSON 能按新版 schema 校验、抽样核对关键字段、customFields 无丢失——全部通过才退役旧列。脚本与校验 SQL 存 `docs/sql/` 与 `scripts/`。

## 5. 模板语义规范与主题变量

模板仍是受控 HTML+CSS（无 script、无 on*、无 javascript:），但引入强制语义结构，让共享渲染器不再依赖逐模板手写 selector 映射：

- 页面骨架：`resume-page` / `resume-header` / `resume-main` / `resume-sidebar`（侧栏可选）。
- 区块：`section` + `section-title` + `section-items`，区块类型用 data-section 或类名声明（experience、education、skills 等）。
- 条目：`entry`（内部 `entry-header` / `entry-meta` / `entry-body`）；联系信息 `contact-item`；技能 `skill-tag`；教育/项目沿用 `edu-*`、`proj-*` 前缀。

主题定制通过 CSS 变量暴露：`--color-primary/background/text/sidebar-*`、`--font-heading/body`、`--font-size-base`、`--page-margin`、`--section-gap` 等。manifest v2 声明可调参数表（变量名、默认值、控件类型与步长），编辑器右侧设计面板据此自动生成控件。

manifest v2 结构：templateId、regions（header/main/sidebar）、blocks（区块类型→容器选择器）、theme 变量表、sampleData、模板专属字段声明。`validate-template.js` 同步升级：校验语义类名齐全、CSS 变量有默认值、无危险内容。

## 6. 渲染引擎与模板改造

前端 `template-engine` 重写为语义渲染器：输入为模板 HTML/CSS、ResumeData 与 manifest v2，输出经过消毒的 HTML。

流程：解析模板骨架 → 按 `metadata.layout` 决定区块顺序与分栏（header/main/sidebar）→ 对每个区块调用共享渲染逻辑填充条目 → 注入主题 CSS 变量（用户 design/typography 覆盖模板默认值，自定义 stylesheet 消毒后追加）→ sanitizeHtml/sanitizeCss。

内容分两类处理：summary/description 等富文本字段按白名单渲染（允许的标签与 text-align 等样式）；其余字段一律 HTML 转义。空数据预览沿用现有机制：用 manifest.sampleData 展示完整演示内容，有用户数据即切换。

编辑器、预览页、模板市场卡片共用同一渲染器，保证"所见即所得"。13 份模板全部改造成 `renderMode: semantic` 后移除旧 static DOM 映射路径；`placeholder`（`{{}}`）模式保留，供后续 AI 生成的占位模板使用。PDF 导出继续走浏览器打印，A4/Letter 与页边距由 metadata.page 控制。

## 7. 编辑器体验

编辑器重写为三栏：

- 左栏：区块列表（标准 12 类 + 自定义区块），支持拖拽排序、添加/删除、显隐开关。
- 中栏：按当前选中区块渲染表单——basics 用字段表单；summary 与条目描述用富文本（Tiptap Vue）；列表条目用卡片式编辑并可拖拽排序。
- 右栏：两个标签——**预览**（画板，缩放/平移、A4/Letter 切换，与市场/预览页共用渲染器）与**设计**（模板选择、区块分栏版式、主题色、字体字号、页边距、自定义 CSS、导出 PDF）。

所有修改实时反映在预览；支持撤销/重做（Ctrl+Z / Ctrl+Shift+Z）、Ctrl+S 保存、Ctrl+P 导出；保存仍为整份文档 PUT，模板切换只改 `metadata.template`。本期以桌面为主，不做移动端专属布局。

需要新增三个前端依赖：Tiptap（富文本）、SortableJS/vuedraggable（拖拽）、状态快照（撤销重做）——按 AGENTS.md 规则，须用户批准后才允许引入（见附录 A）。

## 8. AI 预留接口

本期不实现 AI 功能，但把边界定好：

- 后端 `ai/` 包新增两个校验器接口：`ResumeSchemaValidator`（校验整份 ResumeData）、`TemplateSchemaValidator`（校验模板 HTML/CSS + manifest v2）；本期只落接口与 schema 文件，不实现 LLM 调用。
- `docs/resume.schema.json` 与升级后的 `docs/template-schema.json` 同时作为 AI 输出的白名单依据（AGENTS.md 引用同步更新）。
- AI 生成模板仍只允许输出 HTML/CSS + manifest v2，必须过 schema 校验与 `validate-template.js`；"禁止 AI 写 JS 到库"规则不变。
- `ai_session` 表保留不动，预留 resume_generate / template_generate 的 DTO 与状态枚举，本期不建接口。
- 需要新增一个后端依赖：JSON Schema 校验库（如 networknt json-schema-validator）——须用户批准；若不批准，退化为自研轻量结构校验（只查必需字段与类型）。

## 9. 实施顺序与验收

按思路 1 分三个阶段，每阶段独立验收，通过后才进下一阶段：

**阶段一 · 数据模型与迁移**：DDL（`data` JSON 列 + 旧列退役脚本）、docs/resume.schema.json、后端实体/DTO/API 改造、Node 迁移脚本 + 校验 SQL、种子与演示数据换新结构。验收：备份表存在、迁移校验全过、`mvn -q test` 绿。

**阶段二 · 模板体系**：语义规范与 manifest v2 schema、渲染引擎重写、analyze/validate 脚本升级、13 份模板语义化 + 市场适配。验收：`validate-template.js --report` 0 错误、`npm run build` 绿、13 份模板新旧预览逐份对比一致。

**阶段三 · 编辑器**：三栏布局、拖拽、富文本、设计面板、撤销重做、快捷键、接真实 API。验收：`npm run build` 绿 + 手工清单（见附录 C）。

错误处理贯穿全程：保存前 schema 校验拒绝脏文档、渲染层消毒兜底、迁移脚本失败可回滚备份表。全部完成后跑端到端回归（登录→建简历→填数据→切模板→导出）。

## 10. 风险与回退

| 风险 | 对策 |
|------|------|
| 13 份模板语义化后视觉偏差 | 每份新旧预览截图逐份对比，偏差单独修模板 CSS 后再验收 |
| 迁移丢字段 | 备份表 + 校验 SQL + 抽样人工核对；无法映射的旧 extended_data 键一律进 customFields/customSections，不静默丢弃 |
| 富文本 XSS | 渲染层白名单消毒 + 保存层 schema/结构校验双保险，禁止 on*/javascript: |
| 编辑器体量大 | 三阶段交付，每阶段有可用版本；若阶段三排期吃紧，先交付三栏+拖拽+富文本核心，设计面板作为增量 |
| 依赖审批 | Tiptap / SortableJS / json-schema-validator 需用户批准；拒绝时有降级方案（轻量富文本、原生拖拽、自研结构校验） |

回退路径：数据迁移可整表回滚备份表；模板改造完成前保留旧渲染路径；各阶段代码分支化，任一阶段不过验收不合并。阶段一上线后旧 commonData/extendedData 接口即停用，回滚以恢复备份表 + 回退发布为准。

---

## 附录 A：待批准新增依赖

| 依赖 | 用途 | 降级方案 |
|------|------|----------|
| @tiptap/vue-3（及 core/starter-kit 等） | 富文本 | textarea + 预览（无格式） |
| vuedraggable / SortableJS | 区块与条目拖拽 | 上下移按钮 |
| networknt json-schema-validator（后端） | ResumeData / 模板 schema 校验 | 自研轻量结构校验 |

## 附录 B：契约与文件清单

- 新增：`docs/resume.schema.json`（ResumeData 唯一契约）、`docs/designs/2026-08-11-reactive-resume-alignment-design.md`（本文档）
- 升级：`docs/template-schema.json`（manifest v2 白名单）、`docs/template/*.manifest.json`（13 份语义化）、`scripts/analyze-templates.js`、`scripts/validate-template.js`、`frontend/src/template-engine/`、`frontend/src/types/`、`frontend/src/views/ResumeEditor.vue`、后端 `entity/Resume`、`dto/ResumeRequest`、`vo/ResumeVO`、`service/ResumeService`、`service/TemplateService`、`ai/` 包接口骨架
- 新增 SQL：`docs/sql/schema-v3.sql`（data 列）、`docs/sql/migrate-resume-v3.sql`（含备份表与校验）
- 同步更新：`AGENTS.md`（模板接入规范 v2→v3 语义区块、数据分层描述改为单文档）、`backend/AGENTS.md`、`frontend/AGENTS.md`

## 附录 C：阶段三手工验收清单

1. 登录 → 新建简历 → 选模板，预览与市场卡片一致；
2. 填写 basics / summary / 各标准区块，预览实时更新；
3. 拖拽排序区块与条目，保存后刷新顺序保留；
4. 显隐开关生效，隐藏数据不丢失；
5. 新建自定义区块并填写内容，预览正确渲染；
6. 富文本加粗/列表/对齐，导出与预览一致；
7. 设计面板改主题色/字体/页边距/自定义 CSS，预览即时生效；
8. 切换模板后数据完整保留，仅展示样式变化；
9. Ctrl+Z / Ctrl+Shift+Z 撤销重做生效，Ctrl+S 保存、Ctrl+P 导出；
10. 存量迁移的简历打开、编辑、保存、导出均正常。
