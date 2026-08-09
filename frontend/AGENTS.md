# AGENTS.md — Frontend (Vue 3 + Vite)

## Tech Stack
- Vue 3.5（Composition API + `<script setup lang="ts">`）
- TypeScript 5.x（strict），Vite 5.x，Node 18+（本机 Node 22）
- Pinia、Vue Router 4、Element Plus、Axios（均已安装）
- dayjs、marked、DOMPurify 未引入（按根 AGENTS.md 规则，新增依赖需先问用户）

## Directory Structure（现状）
src/
- api/                # 接口层
  - http.ts           # Axios 实例（baseURL='/api'，超时 10s；拦截器/Token 注入待接入）
  - template.ts       # 模板接口（fetchTemplates）
  - resume.ts         # 简历 CRUD 接口
- components/
  - SchemaForm.vue    # 按 schema 递归生成表单
- stores/
  - app.ts            # 应用基础 store
- types/
  - index.ts          # ApiResult、SchemaNode、ResumeTemplate、ResumeRecord、ResumePayload
- template-engine/
  - index.ts          # 受控渲染引擎（schema 白名单 + 转义 + sanitizeHtml/sanitizeCss）
- views/
  - HomeView.vue
  - TemplateList.vue  # 模板卡片列表
  - ResumeEditor.vue  # 左表单右预览编辑器
- router/
  - index.ts          # 路由：/、/templates、/editor、/editor/:id
- App.vue、main.ts、env.d.ts

### 待建（目标目录）
- api/user.ts、api/ai.ts；views/Login.vue、Register.vue、Dashboard.vue、TemplateMarket.vue、AiAssistant.vue
- components/common/、components/resume/（FormPanel/PreviewPane/SectionEditor）、components/template/、components/ai/
- stores/userStore.ts、resumeStore.ts、templateStore.ts、aiStore.ts
- types/user.ts、resume.ts、template.ts、api.ts；utils/（validation/sanitize/storage）；composables/
- router/guards.ts（路由守卫）；assets/styles/、assets/images/

## Coding Rules
1. **命名规范**
   - 组件/文件名 PascalCase（HomeView.vue、ResumeEditor.vue）；变量/函数 camelCase；常量 UPPER_SNAKE_CASE
   - 类型/接口 PascalCase，不强制 Interface 后缀（现状：ApiResult、ResumeTemplate）

2. **组件规范**
   - Composition API + `<script setup lang="ts">`；一个 .vue 文件只导出一个组件
   - Props/Emits 用 defineProps/defineEmits 带类型
   - 复杂逻辑抽 composables/（待建）

3. **状态管理**
   - 跨组件共享数据用 Pinia store（useXxxStore）；组件内部状态用 ref()/reactive()

4. **API 调用**
   - 所有请求走 src/api/，不在组件里直接写 axios（现状一致）
   - Token 注入、401 自动刷新重试、刷新失败跳登录已在 http.ts 拦截器实现（见 src/api/http.ts）

5. **模板渲染安全（现状已落实）**
   - v-html 只允许渲染 template-engine 消毒后的输出（schema 白名单 + HTML 转义 + sanitizeHtml）
   - CSS 注入前过 sanitizeCss；模板 HTML 结构由受控 schema 驱动，不执行任意字符串
   - DOMPurify 未引入；如需替换自研消毒器，先按根 AGENTS.md 确认依赖

6. **Vue SFC 模板样式注入（禁止 <style> 标签）**
   - Vue SFC 模板里禁止直接写 `<style>`（含 `<style ref>`）标签，会触发 vite:vue "Tags with side effect" 编译错误（ResumeEditor 曾踩坑）
   - 动态注入预览 CSS：onMounted 时 document.createElement('style') 挂到目标容器，watchEffect 同步消毒后的 CSS，onBeforeUnmount 时 remove 防止路由切换样式残留
   - 参照 frontend/src/views/ResumeEditor.vue 的实现方式

7. **路由规范**
   - 懒加载：component: () => import('@/views/Xxx.vue')（现状一致）
   - 路由守卫 guards.ts 已实现：未登录 → /login（带 redirect 回跳）、ADMIN-only 页面拦截非 ADMIN 用户
   - path 用 kebab-case（现状：/templates、/editor；目标 /resume-editor/:id 可后续统一）

8. **样式规范**
   - 使用 scoped style，避免全局污染（现状一致）
   - 全局样式 assets/styles/global.scss、主题变量 variables.scss 待建
   - 颜色值用 CSS 变量（var(--primary-color)）

## Build & Run
- 开发：npm run dev（端口 5173，proxy /api → localhost:8080）
- 构建：npm run build（vue-tsc --noEmit + vite build，输出 dist/）
- 类型检查：npx vue-tsc --noEmit
- lint：package.json 暂无 lint 脚本（ESLint 未配置，待加）

## Environment Variables
- 现状未使用 .env 文件：baseURL 写死在 src/api/http.ts（'/api'）
- 目标：.env.development 设 VITE_API_BASE_URL=/api，.env.production 设线上地址；后端若启用 /api/v1 再同步调整

## Commit Convention
- feat: 新功能；fix: 修复；refactor: 重构；style: 样式；docs: 文档；chore: 构建/配置（现状提交已按此约定）
