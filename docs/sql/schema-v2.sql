-- ============================================================
-- Resume Template Site v2 结构变更（MySQL 8）
-- 目标：数据与模板解耦
--   1. resume 表新增 common_data / extended_data / current_template_id
--   2. 新增 template_config 模板配置表（manifest）
-- 本脚本幂等，可重复执行。
-- 数据迁移脚本见 docs/sql/migrate-resume-v2.sql
-- ============================================================

USE resume;

-- 1. resume 表新增三列（MySQL 8 不支持 ADD COLUMN IF NOT EXISTS，用 information_schema 守卫）
SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `resume` ADD COLUMN common_data JSON NULL COMMENT ''公共数据（ResumeCommonData 结构）'' AFTER data',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'common_data'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `resume` ADD COLUMN extended_data JSON NULL COMMENT ''模板专属数据（key-value）'' AFTER common_data',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'extended_data'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `resume` ADD COLUMN current_template_id VARCHAR(64) NULL COMMENT ''当前模板ID（template.code）'' AFTER template_code',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'current_template_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1.4 data 列改为可空（v2 起新写入走 common_data / extended_data，旧列迁移后删除）
SET @sql := (
    SELECT IF(
        IS_NULLABLE = 'NO',
        'ALTER TABLE `resume` MODIFY COLUMN data JSON NULL COMMENT ''旧版单列数据（v2 后弃用）''',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'data'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 模板配置表：每个模板的字段定义与映射关系
CREATE TABLE IF NOT EXISTS template_config (
    id            BIGINT      NOT NULL COMMENT '主键（MyBatis-Plus ASSIGN_ID）',
    template_id   BIGINT      NULL COMMENT '关联 template.id',
    template_code VARCHAR(64) NOT NULL COMMENT '模板编码（template.code）',
    manifest      JSON        NOT NULL COMMENT 'manifest：字段列表、映射关系、示例数据',
    status        TINYINT     NOT NULL DEFAULT 0 COMMENT '状态：0 待人工确认 / 1 已确认 / 2 停用',
    created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_template_config_code (template_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '简历模板配置表（manifest）';

-- 3. 校验
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'resume'
  AND COLUMN_NAME IN ('common_data', 'extended_data', 'current_template_id')
ORDER BY ORDINAL_POSITION;
