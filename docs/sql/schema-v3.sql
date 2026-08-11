-- ============================================================
-- Resume Template Site v3 结构变更（MySQL 8）
-- 目标：resume.data 单文档 JSON 列（ResumeData v1.0）
-- 旧列 common_data / extended_data / current_template_id / template_code / template_id 退役
-- 本脚本幂等，可重复执行；数据迁移见 migrate-resume-v3.sql
-- ============================================================

USE resume;

-- 1. 新增 data 列（MySQL 8 无 ADD COLUMN IF NOT EXISTS，用 information_schema 守护）
SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `resume` ADD COLUMN data JSON NULL COMMENT ''ResumeData 单文档（version 1.0）'' AFTER title',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'data'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 校验
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'resume'
  AND COLUMN_NAME = 'data'
ORDER BY ORDINAL_POSITION;
