# AGENTS.md — Frontend (Vue 3 + Vite)

## Tech Stack
- Vue 3.5（Composition API + `<script setup lang="ts">`），TypeScript 5.x（strict），Vite 5.x，Node 18+（本机 Node 22）
- Pinia、Vue Router 4、Element Plus、Axios（均已安装）
- Tiptap（富文本）、SortableJS/vuedraggable（拖拽）、ESLint + eslint-plugin-vue（lint）：本期实施计划中引入，引入后按本文件规则使用
- dayjs、marked、DOMPurify 未引入（按根 AGENTS.md 规则，新增依赖需先问用户）

## Directory Structure（现状）
src/
- api/                # HTTP 封装：http.ts（Axios 实例 + token 注入 + 401 刷新重试）、template.ts、resume.ts、user.ts、admin.ts
- components/         # CommonForm、SchemaForm、SectionListEditor、TemplateFieldsForm、TemplateSwitcher 等
- composables/        # usePageScale 等
- stores/             # userStore、resumeStore、app
- types/              # index.ts、resume.ts、user.ts（与 docs/resume.schema.json 对齐）
- template-engine/    # 语义渲染器：输入模板 HTML/CSS + ResumeData + manifest v2，输出消毒后 HTML
- views/              # HomeView、TemplateList、ResumeEditor、ResumePreview、Login、Register、AdminUsers
- router/             # index.ts、guards.ts（未登录跳 /login + ADMIN-only 拦截，已实现）
- assets/styles/      # global.css（设计 token）

### 编辑器（三栏，实施计划阶段三落地）
- 左栏：区块列表（拖拽排序、增删、显隐、自定义区块）
- 中栏：按选中区块渲染表单 + 富文本（Tiptap）
- 右栏：预览（缩放/平移）与设计面板（模板/版式/主题/字体/页边距/导出）两个标签

## Coding Rules
1. **命名规范**：组件/文件 PascalCase；变量/函数 camelCase；常量 UPPER_SNAKE_CASE
2. **组件规范**：Composition API + `<script setup lang="ts">`；一个 .vue 文件只导出一个组件；Props/Emits 带类型
3. **状态管理**：跨组件共享用 Pinia store；组件内部状态用 ref()/reactive()
4. **API 调用**：所有请求走 src/api/，不在组件里直接写 axios
5. **模板渲染安全（已落实）**：
   - v-html 只允许渲染 template-engine 消毒后的输出（schema 白名单 + HTML 转义 + sanitizeHtml）
   - CSS 注入前过 sanitizeCss；富文本内容渲染走白名单消毒
   - 设计面板通过 CSS 变量注入主题，不直接改写模板 CSS 文件
6. **Vue SFC 模板样式注入**：禁止在 SFC 模板里直接写 `<style>` 标签（会触发 vite:vue 编译错误）；动态注入预览 CSS 用 document.createElement('style') 挂到目标容器，onBeforeUnmount 时 remove（参照 ResumeEditor.vue 现有实现）
7. **路由规范**：懒加载 component: () => import('@/views/Xxx.vue')；path 用 kebab-case；guards.ts 已实现
8. **样式规范**：scoped style；颜色值用 CSS 变量（以 global.css 设计 token 为准）
9. **UI 风格**：现代极简 SaaS，设计 token 唯一来源 frontend/src/assets/styles/global.css（背景 #F7F8FA、主文字 #1A1A1A、强调色 #4F46E5、辅助文字 #6B7280、圆角 12px）；hover 过渡统一 transition-all duration-200 ease-out，只允许 translateY(-4px)+阴影加深

## Build & Run
- 开发：npm run dev（端口 5173，proxy /api → localhost:8080）
- 构建：npm run build（vue-tsc --noEmit + vite build，输出 dist/）
- 类型检查：npx vue-tsc --noEmit
- lint：npm run lint（ESLint 配置完成后可用；验证以 build 为准）

## Environment Variables
- 暂未使用 .env 文件：baseURL 写死在 src/api/http.ts（'/api'）
- 目标：.env.development 设 VITE_API_BASE_URL=/api，.env.production 设线上地址

## Commit Convention
- feat: 新功能；fix: 修复；refactor: 重构；style: 样式；docs: 文档；chore: 构建/配置（现状提交已按此约定）
