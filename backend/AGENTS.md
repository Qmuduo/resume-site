# AGENTS.md — Backend (Spring Boot 3)

## Tech Stack
- JDK 17，Spring Boot 3.2.x，Maven 3.9+（本机 Maven 3.9.9）
- MyBatis-Plus 3.5.x，MySQL 8（JSON 列），Redis，RabbitMQ
- Hibernate Validator（JSR-380）已引入；JWT 鉴权为占位（jjwt 未引入）
- Lombok、MapStruct 未引入（按根 AGENTS.md 规则，新增依赖需先问用户）

## Package Convention（com.resume.api.*）
实际代码根包为 `com.resume.api`（src/main/java/com/resume/api/）。

- config/        # 配置类（已建：MybatisPlusConfig、RedisConfig、RabbitConfig、WebConfig；Security/CORS/Swagger 待建）
- controller/    # REST 接口，路径 /api/*（已建：TemplateController、ResumeController）
- service/       # 服务类（已建：TemplateService、ResumeService；接口+impl 分离待建）
- repository/    # MyBatis-Plus Mapper，继承 BaseMapper（已建：User/Resume/Template/AiSession）
- entity/        # 数据库实体，@TableName 映射（已建 4 个）
- dto/           # 请求 DTO，带 JSR-380 校验（已建：ResumeRequest）
- common/        # 统一响应体 Result<T>（已建）；exception/、util/ 待建
- mq/            # RabbitMQ（已建空包）；producer/consumer/config 子包待建
- ai/            # LLM 调用层（已建空包）；client/schema/prompt 子包待建
- model/、vo/、enums/   # 待建
- security/      # JwtAuthInterceptor（JWT 占位，已建）
- resources/
  - templates/   # 内置简历模板 JSON（已建 3 个：modern/classic/minimal）
  - application.yml（现状仅此一个；application-dev.yml / application-prod.yml 待建）
- 初始化 DDL 位于 docs/sql/init.sql（不在 backend resources 下）

## Coding Rules
1. **命名规范**
   - 类名 PascalCase、方法名 camelCase、常量 UPPER_SNAKE_CASE、包名全小写（现状一致）

2. **分层调用约束**
   - Controller 只做参数校验 + 调 Service，不写业务逻辑（现状一致）
   - Service 层事务：@Transactional(rollbackFor = Exception.class) 待按需补充
   - Repository 只写 SQL 映射；禁止 Controller 直接注入 Repository（现状一致）

3. **API 规范**
   - 路径前缀现状为 `/api/*`（/api/templates、/api/resumes）；统一升级 /api/v1 待定
   - 统一响应体 Result<T>，现状 code=0 成功、非 0 失败（与现有 Result 实现一致）
   - 分页 PageParam/PageVO 待建
   - POST/PUT 请求体用 @Valid 触发 JSR-380 校验（现状一致）
   - 全局 @RestControllerAdvice 待建（现状为 Controller 内局部 @ExceptionHandler）

4. **数据库规范**
   - 表名 snake_case 单数：user、resume、template、ai_session（见 docs/sql/init.sql）
   - 主键：Long，MyBatis-Plus ASSIGN_ID 生成（非数据库自增）
   - 时间字段：created_at、updated_at（datetime，默认当前时间）
   - 逻辑删除 deleted 未实现
   - JSON 字段：resume.data 等用 MySQL JSON 类型，实体以 String 存取（未用 TypeHandler）

5. **安全规范**
   - JWT 为占位：JwtAuthInterceptor 固定 userId=1L；Spring Security + jjwt 待接入
   - 密码 BCrypt 存储未实现
   - 敏感接口校验 userId 归属（现状已按占位 userId 校验）
   - 禁止拼接 SQL，全部走 MyBatis-Plus Wrapper（现状一致）

6. **AI 输出约束**
   - 模板字段白名单以 docs/template-schema.json 为准（code/name/description/schema/html/css）
   - ai/schema/TemplateSchemaValidator.java 待建；BusinessException(AI_OUTPUT_INVALID) 待建
   - 禁止输出 <script>、on* 事件、javascript: 等危险内容（前端渲染层已消毒）

7. **日志规范**
   - 使用 SLF4J + Logback，生产环境 INFO 级别
   - 关键操作 log.info("userId={}, action={}", userId, action)；异常 log.error("msg", e)（现状一致）

## Configuration
- application.yml：现状公共配置（端口 8080、数据源 localhost:3306、Redis、RabbitMQ）
- application-dev.yml / application-prod.yml：待建（dev 本地调试、prod 用外部环境变量 ${DB_URL} 等）
- 敏感信息走环境变量（如 DB_PASSWORD），不进 Git

## Test
- 现状仅 ResumeApiApplicationTests.contextLoads（Spring 上下文冒烟）
- JUnit 5 + Mockito 单测、Service 核心单测、@WebMvcTest + MockMvc 待补
- 运行：mvn -q test（全部通过才算完成）

## Commands
- 前置：切 JDK 17：`$env:JAVA_HOME='F:\Environment\java\jdk-17.0.12_windows-x64_bin\jdk-17.0.12'`
- 启动：`cd backend; mvn spring-boot:run`（当前无 profile，默认直接起，端口 8080）
- 打包：`mvn clean package -DskipTests`
- 测试：`mvn -q test`
- checkstyle 未配置

## Auth & User System（目标设计，当前未实现）
> 现状：JwtAuthInterceptor 为占位，固定 userId=1L；无登录/注册接口，无 Spring Security。
> 以下为认证模块目标设计；实现前需按根 AGENTS.md 确认新增依赖（spring-security、jjwt 等）。

- 认证：Spring Security 6 + jjwt 0.12.x；AccessToken 30min，RefreshToken 7d
- 密钥：对称 HS256，jwt.secret 由 openssl rand -base64 64 生成，生产走环境变量，不进 Git
- 密码：BCryptPasswordEncoder，cost=10，禁止明文/MD5/SHA 裸存
- 传输：Authorization: Bearer <accessToken>；refreshToken 存 Redis（key=rt:{userId}:{jti}，TTL=7d）
- 注销：jti 加入 Redis 黑名单（key=bl:{jti}，TTL=剩余 access 时长）
- 角色：user 表 role（USER/ADMIN）轻量 RBAC；@PreAuthorize("hasRole('ADMIN')") 控后台
- 白名单：/api/v1/auth/login、/register、/captcha、静态资源、/actuator/health 免鉴权（路径前缀届时统一 /api/v1）
- 统一：SecurityContext 注入 CustomUserDetails（id, username, role）；Controller 用 @AuthenticationPrincipal 取当前用户，禁止从 JSON 解析 userId
- 防爆破：登录失败计数存 Redis（login_fail:{username}，5 次/10min 锁 15min）
- 响应：AuthController 返回 Result<LoginVO>{ accessToken, expiresIn, refreshToken, user: UserVO }
- 禁止：不写 WebSecurityConfigurerAdapter（SB3 已删）、用 jakarta.* 不用 javax.*、Filter 不重复查库、Token 不塞进 URL
