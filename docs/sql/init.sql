-- Resume Template Site 初始化脚本（MySQL 8）

CREATE DATABASE IF NOT EXISTS resume
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE resume;

CREATE TABLE IF NOT EXISTS `user` (
    id          BIGINT       NOT NULL COMMENT '主键（MyBatis-Plus ASSIGN_ID 生成）',
    username    VARCHAR(64)  NOT NULL COMMENT '登录名',
    password    VARCHAR(128) NOT NULL COMMENT '密码（加密后存储）',
    email       VARCHAR(128) NULL COMMENT '邮箱',
    nickname    VARCHAR(64)  NULL COMMENT '昵称',
    role        VARCHAR(16)  NOT NULL DEFAULT 'USER' COMMENT '角色：USER / ADMIN',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '用户表';

-- 存量库升级：为已有 user 表补充 role 列
-- ALTER TABLE `user`
--     ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'USER'
--     COMMENT '角色：USER / ADMIN' AFTER nickname;

CREATE TABLE IF NOT EXISTS resume (
    id          BIGINT       NOT NULL COMMENT '主键',
    user_id     BIGINT       NOT NULL COMMENT '所属用户',
    template_id BIGINT       NULL COMMENT '使用的模板',
    template_code VARCHAR(64) NULL COMMENT '内置模板编码（resources/templates/*.json 的 code）',
    current_template_id VARCHAR(64) NULL COMMENT '当前模板ID（template.code）',
    title       VARCHAR(128) NOT NULL COMMENT '简历标题',
    data        JSON         NULL COMMENT '旧版单列数据（v2 后建议用 common_data / extended_data 代替）',
    common_data JSON         NULL COMMENT '公共数据（ResumeCommonData 结构）',
    extended_data JSON       NULL COMMENT '模板专属数据（key-value）',
    status      TINYINT      NOT NULL DEFAULT 0 COMMENT '状态：0 草稿 / 1 已发布',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_resume_user_id (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '简历表';

CREATE TABLE IF NOT EXISTS template (
    id          BIGINT       NOT NULL COMMENT '主键',
    user_id     BIGINT       NULL COMMENT '创建者（NULL=系统内置）',
    code        VARCHAR(64)  NOT NULL COMMENT '模板编码',
    name        VARCHAR(64)  NOT NULL COMMENT '模板名称',
    description VARCHAR(512) NULL COMMENT '模板描述',
    category    VARCHAR(64)  NULL COMMENT '模板分类（如：金融/咨询/互联网技术）',
    tags        JSON         NULL COMMENT '模板标签（JSON 字符串数组）',
    schema_json JSON         NULL COMMENT '简历数据 JSON Schema',
    html        MEDIUMTEXT   NULL COMMENT '模板 HTML 描述',
    css         MEDIUMTEXT   NULL COMMENT '模板 CSS 描述',
    builtin     TINYINT      NOT NULL DEFAULT 0 COMMENT '是否内置：0 否 / 1 是',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_template_code (code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '简历模板表';

CREATE TABLE IF NOT EXISTS template_config (
    id            BIGINT      NOT NULL COMMENT '主键（MyBatis-Plus ASSIGN_ID 生成）',
    template_id   BIGINT      NULL COMMENT '关联 template.id',
    template_code VARCHAR(64) NOT NULL COMMENT '模板编码（template.code）',
    manifest      JSON        NOT NULL COMMENT 'manifest：字段定义、映射关系、示例数据',
    status        TINYINT     NOT NULL DEFAULT 0 COMMENT '状态：0 待人工确认 / 1 已确认 / 2 停用',
    created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_template_config_code (template_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '简历模板配置表（manifest）';

CREATE TABLE IF NOT EXISTS ai_session (
    id            BIGINT      NOT NULL COMMENT '主键',
    user_id       BIGINT      NOT NULL COMMENT '所属用户',
    resume_id     BIGINT      NULL COMMENT '关联简历',
    scene         VARCHAR(32) NOT NULL COMMENT '会话场景：resume_generate / template_generate 等',
    status        VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT '状态：pending / running / success / failed',
    request_data  JSON        NULL COMMENT 'AI 请求负载（JSON）',
    response_data JSON        NULL COMMENT 'AI 响应负载（JSON）',
    created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_ai_session_user_id (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 生成会话表';
