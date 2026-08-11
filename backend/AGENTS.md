# AGENTS.md — Backend (Spring Boot 3)

## Tech Stack
- JDK 17，Spring Boot 3.2.x，Maven 3.9+（本机 Maven 3.9.9）
- MyBatis-Plus 3.5.x，MySQL 8（JSON 列），Redis，RabbitMQ
- Spring Security 6 + JWT（jjwt）已实现；Hibernate Validator（JSR-380）已引入
- Lombok、MapStruct 未引入（按根 AGENTS.md 规则，新增依赖需先问用户）

## Package Convention（com.resume.api.*）
- controller/    # REST 接口，路径 /api/*，统一返回 Result<T>（Auth/AdminUser/Template/Resume）
- service/       # 业务层（AuthService/UserService/TemplateService/TemplateConfigService/ResumeService）
- repository/    # MyBatis-Plus Mapper，继承 BaseMapper（User/Resume/Template/TemplateConfig/AiSession）
- entity/        # 数据库实体，@TableName 映射
- dto/           # 请求 DTO，带 JSR-380 校验
- vo/            # 响应 VO（ResumeVO/TemplateVO/UserVO/LoginVO）
- model/         # 领域模型（TemplateManifest 升级为 v2；旧 ResumeCommonData 已废弃）
- common/        # 统一响应 Result<T>、GlobalExceptionHandler、ErrorCode
- security/      # Spring Security + JWT（SecurityConfig/JwtTokenService/JwtAuthenticationFilter/CustomUserDetails/RestAuthEntryPoint/RestAccessDeniedHandler）
- config/        # 配置类（MybatisPlus/Redis/Rabbit/Jackson/Security/AdminInitializer/LoginFailProperties/JwtProperties）
- ai/            # LLM 调用与 JSON Schema 校验（本期仅 ResumeSchemaValidator / TemplateSchemaValidator 接口，LLM 后续接入）
- mq/            # RabbitMQ（空包，待建）
- resources/
  - template-manifests/           # 内置模板 manifest v2（cv2 等）
  - template-market-catalog.json  # 市场中文名/分类/标签/主色
  - template-retired-codes.json   # 下架模板编码清单
  - application.yml

## Coding Rules
1. **命名规范**：类名 PascalCase、方法名 camelCase、常量 UPPER_SNAKE_CASE、包名全小写。
2. **分层调用约束**：
   - Controller 只做参数校验 + 调 Service，不写业务逻辑
   - Service 层事务：@Transactional(rollbackFor = Exception.class)
   - Repository 只写 SQL 映射；禁止 Controller 直接注入 Repository
3. **API 规范**：
   - 统一响应体 Result<T>（code=0 成功，非 0 失败）
   - POST/PUT 请求体用 @Valid 触发 JSR-380 校验
   - `resume.data` 写入前必须通过 docs/resume.schema.json 的 JSON Schema 校验，失败返回 400 + 明确错误信息
   - 全局异常处理已由 GlobalExceptionHandler 统一接管
4. **数据库规范**：
   - 表名 snake_case 单数：user、resume、template、template_config、ai_session
   - 主键 Long，MyBatis-Plus ASSIGN_ID 生成（非数据库自增）
   - 时间字段 created_at / updated_at（datetime，默认当前时间）
   - JSON 字段（resume.data、template.tags、template_config.manifest）实体以 String 存取
   - 简历数据只存 resume.data 单文档，禁止在文档外另建列/表
5. **安全规范（已实现，勿回退为占位）**：
   - Spring Security 6 + JWT：accessToken 30min，refreshToken 7d，refresh 存 Redis
   - 密码 BCrypt 存储；登出走 Redis 黑名单；登录失败计数限流（5 次/10 分钟窗口，锁 15 分钟）
   - 敏感接口校验 userId 归属；@AuthenticationPrincipal 取当前用户，禁止从 JSON 解析 userId
   - AdminInitializer 按 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量播种管理员
6. **AI 输出约束**：
   - 模板字段白名单以 docs/template-schema.json 为准（HTML/CSS + manifest v2）
   - ai/ 包接口：ResumeSchemaValidator / TemplateSchemaValidator（本期仅接口，不实现 LLM 调用）
   - 禁止输出 <script>、on* 事件、javascript: 等危险内容（前端渲染层已消毒）
7. **日志规范**：SLF4J + Logback；关键操作 log.info("userId={}, action={}", userId, action)；异常 log.error("msg", e)

## Configuration
- application.yml：公共配置（端口 8080、数据源 localhost:3306、Redis、RabbitMQ、JWT、resume.manifest-dir）
- 敏感信息走环境变量（DB_PASSWORD、JWT_SECRET、ADMIN_PASSWORD 等），不进 Git
- JWT 密钥 HS256，生产走环境变量，禁止硬编码

## Test
- 现有测试：ResumeApiApplicationTests / AuthServiceTest / UserServiceTest / SecurityLayerTest / JwtTokenServiceTest
- 新增核心逻辑（schema 校验、迁移映射等）必须补单测
- 运行：`mvn -q test`（全部通过才算完成）

## Commands
- 前置：切换 JDK 17：`$env:JAVA_HOME='F:\Environment\java\jdk-17.0.12_windows-x64_bin\jdk-17.0.12'`
- 启动：`cd backend; mvn -q spring-boot:run`（端口 8080）
- 打包：`mvn clean package -DskipTests`
- 测试：`mvn -q test`
