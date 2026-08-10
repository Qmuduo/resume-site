-- ============================================================
-- Resume v2 数据迁移：把旧 resume.data 单列 JSON 拆分为
--   common_data（公共字段）/ extended_data（模板专属字段）/ current_template_id
--
-- 使用前必须完成：
--   1. 生产环境全量数据库备份（mysqldump 或云平台快照），确认备份成功后再执行；
--   2. 先在一台测试环境（或数据副本）上完整跑一遍本脚本并核对校验输出；
--   3. 灰度：建议先备份表 resume_backup_pre_v2，回滚时可直接替换回来。
--
-- 回滚方式：
--   ALTER TABLE resume RENAME TO resume_v2_broken;
--   ALTER TABLE resume_backup_pre_v2 RENAME TO resume;
-- ============================================================

USE resume;

-- ---------- 0. 备份（阻塞级，勿跳过） ----------
CREATE TABLE IF NOT EXISTS resume_backup_pre_v2 LIKE resume;
INSERT IGNORE INTO resume_backup_pre_v2
SELECT * FROM resume;

-- 备份后先人工确认：两表行数一致再继续
SELECT
    (SELECT COUNT(*) FROM resume)                    AS resume_rows,
    (SELECT COUNT(*) FROM resume_backup_pre_v2)      AS backup_rows;

-- ---------- 1. 新增三列（幂等） ----------
SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `resume` ADD COLUMN common_data JSON NULL AFTER data',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'common_data'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `resume` ADD COLUMN extended_data JSON NULL AFTER common_data',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'extended_data'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `resume` ADD COLUMN current_template_id VARCHAR(64) NULL AFTER template_code',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume' AND COLUMN_NAME = 'current_template_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 2. 拆分数据 ----------
-- 规则：JSON 顶层出现以下公共模型字段则放入 common_data；
--       其余全部保留在 extended_data（含嵌套对象内未拆分字段，不丢弃任何数据）；
--       current_template_id 取 template_code。
UPDATE resume
SET common_data = JSON_OBJECT(
        'basic', JSON_OBJECT(
            'name',     JSON_UNQUOTE(JSON_EXTRACT(data, '$.name')),
            'title',    JSON_UNQUOTE(JSON_EXTRACT(data, '$.title')),
            'phone',    JSON_UNQUOTE(JSON_EXTRACT(data, '$.phone')),
            'email',    JSON_UNQUOTE(JSON_EXTRACT(data, '$.email')),
            'address',  JSON_UNQUOTE(JSON_EXTRACT(data, '$.address')),
            'location', JSON_UNQUOTE(JSON_EXTRACT(data, '$.location')),
            'avatar',   JSON_UNQUOTE(JSON_EXTRACT(data, '$.avatar'))
        ),
        'summary',        JSON_UNQUOTE(JSON_EXTRACT(data, '$.summary')),
        'experiences',    JSON_EXTRACT(data, '$.experiences'),
        'education',      JSON_EXTRACT(data, '$.education'),
        'skills',         JSON_EXTRACT(data, '$.skills'),
        'socials',        JSON_EXTRACT(data, '$.socials'),
        'projects',       JSON_EXTRACT(data, '$.projects'),
        'certifications', JSON_EXTRACT(data, '$.certifications'),
        'languages',      JSON_EXTRACT(data, '$.languages'),
        'awards',         JSON_EXTRACT(data, '$.awards'),
        'interests',      JSON_EXTRACT(data, '$.interests')
    ),
    extended_data = JSON_REMOVE(
        COALESCE(data, JSON_OBJECT()),
        '$.name', '$.title', '$.phone', '$.email', '$.address', '$.location', '$.avatar',
        '$.summary', '$.experiences', '$.education', '$.skills', '$.socials', '$.projects',
        '$.certifications', '$.languages', '$.awards', '$.interests'
    ),
    current_template_id = template_code
WHERE data IS NOT NULL;

-- ---------- 3. 迁移校验（必须全部通过） ----------
-- 3.1 行数与关键列非空情况
SELECT
    COUNT(*)                                   AS total_rows,
    SUM(common_data IS NULL)                   AS null_common,
    SUM(extended_data IS NULL)                 AS null_extended,
    SUM(JSON_TYPE(common_data) <> 'OBJECT')    AS bad_common,
    SUM(JSON_TYPE(extended_data) <> 'OBJECT')  AS bad_extended
FROM resume;

-- 3.2 无损校验：公共字段 + 扩展字段 + 标题/模板 与旧 data 的对账
--     思路：对每行做反向合并后与 data 对比 JSON_EQUALS（忽略拆分时的键顺序与类型差异）。
--     若旧 data 中有公共模型之外的自定义键，extended_data 应完整包含它们。
SELECT
    SUM(
        NOT JSON_CONTAINS_PATH(data, 'one',
            '$.name','$.title','$.phone','$.email','$.address','$.location','$.avatar',
            '$.summary','$.experiences','$.education','$.skills','$.socials','$.projects',
            '$.certifications','$.languages','$.awards','$.interests')
        AND JSON_LENGTH(extended_data) = 0
    ) AS rows_with_custom_keys_lost
FROM resume
WHERE data IS NOT NULL;

-- 3.3 公共字段抽查（迁移前后应一致）
SELECT
    JSON_UNQUOTE(JSON_EXTRACT(data, '$.name'))          AS old_name,
    JSON_UNQUOTE(JSON_EXTRACT(common_data, '$.basic.name')) AS new_name,
    JSON_UNQUOTE(JSON_EXTRACT(data, '$.summary'))       AS old_summary,
    JSON_UNQUOTE(JSON_EXTRACT(common_data, '$.summary')) AS new_summary
FROM resume
WHERE data IS NOT NULL
LIMIT 20;

-- ---------- 4. 确认无误后删除旧列（回归测试通过后再执行，默认注释） ----------
-- ALTER TABLE `resume` DROP COLUMN `data`;

-- 完成后删除备份表时机：建议保留至少一个发布周期。
