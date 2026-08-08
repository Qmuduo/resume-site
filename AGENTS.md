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
