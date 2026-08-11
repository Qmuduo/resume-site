-- ============================================================
-- Resume v3 数据迁移：common_data + extended_data + current_template_id -> resume.data
-- 使用前必须：1) 全量备份；2) 先跑 schema-v3.sql；3) 先跑 scripts/migrate-resume-v3.js 生成映射
-- 回滚：ALTER TABLE resume RENAME TO resume_v3_broken; ALTER TABLE resume_backup_pre_v3 RENAME TO resume;
-- 实现说明：先用派生表把每行的新文档算好（避免 MySQL 对更新目标表/临时表的重复引用限制），再 JOIN 更新。
-- ============================================================

USE resume;

-- 0. 备份（阻塞级，勿跳过）
CREATE TABLE IF NOT EXISTS resume_backup_pre_v3 LIKE resume;
INSERT IGNORE INTO resume_backup_pre_v3 SELECT * FROM resume;
SELECT (SELECT COUNT(*) FROM resume) AS resume_rows, (SELECT COUNT(*) FROM resume_backup_pre_v3) AS backup_rows;

-- 1. 数据列与映射表
CREATE TEMPORARY TABLE ext_map (
  template_code VARCHAR(64) NOT NULL,
  field_name    VARCHAR(128) NOT NULL,
  common_path   VARCHAR(255) NOT NULL,
  PRIMARY KEY (template_code, field_name)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SOURCE docs/sql/generated/extended-mapping.sql;

-- 2. 合并生成 data 文档（仅处理 data IS NULL 且旧列有数据的行，可重复执行）
UPDATE resume r
JOIN (
  SELECT r2.id,
    JSON_OBJECT(
      'version', '1.0',
      'picture', JSON_OBJECT('hidden', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.avatar')), 'null'), '') = '', 'url', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.avatar')), 'null'), ''), 'size', 128, 'borderRadius', 50),
      'basics', JSON_OBJECT(
        'name', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.name')), 'null'), ''),
        'headline', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.title')), 'null'), ''),
        'email', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.email')), 'null'), ''),
        'phone', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.phone')), 'null'), ''),
        'location', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.location')), 'null'), ''),
        'website', JSON_OBJECT('url', '', 'label', ''),
        'customFields', IF(
          JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.address')) IS NULL
            OR JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.address')) = '',
          JSON_ARRAY(),
          JSON_ARRAY(JSON_OBJECT('id', UUID(), 'icon', '', 'text', JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.basic.address')), 'link', ''))
        )
      ),
      'summary', JSON_OBJECT('title', '个人简介', 'columns', 1, 'hidden', FALSE,
        'content', COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r2.common_data, '$.summary')), 'null'), '')),
      'sections', JSON_OBJECT(
        'profiles', JSON_OBJECT('title', '社交链接', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'network', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.platform')),
            'username', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.url')),
            'website', JSON_OBJECT('url', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.url')), ''), 'label', '', 'inlineLink', FALSE)))
          FROM JSON_TABLE(r2.common_data, '$.socials[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY())),
        'experience', JSON_OBJECT('title', '工作经历', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'company', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.company')),
            'position', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.position')),
            'location', '', 'period', CONCAT_WS(' - ', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.start')), JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.end'))),
            'website', JSON_OBJECT('url', '', 'label', '', 'inlineLink', FALSE),
            'description', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.description')), '')))
          FROM JSON_TABLE(r2.common_data, '$.experiences[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY())),
        'education', JSON_OBJECT('title', '教育背景', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'school', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.school')),
            'degree', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.degree')),
            'major', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.major')),
            'period', CONCAT_WS(' - ', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.start')), JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.end'))),
            'description', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.description')), '')))
          FROM JSON_TABLE(r2.common_data, '$.education[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY())),
        'skills', JSON_OBJECT('title', '技能清单', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
            'level', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.level')), '')))
          FROM JSON_TABLE(r2.common_data, '$.skills[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY())),
        'projects', JSON_OBJECT('title', '项目经验', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
            'role', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.role')),
            'period', CONCAT_WS(' - ', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.start')), JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.end'))),
            'description', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.description')), ''),
            'website', JSON_OBJECT('url', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.link')), ''), 'label', '', 'inlineLink', FALSE)))
          FROM JSON_TABLE(r2.common_data, '$.projects[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY())),
        'certifications', JSON_OBJECT('title', '证书', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
            'issuer', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.issuer')),
            'date', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.date'))))
          FROM JSON_TABLE(r2.common_data, '$.certifications[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY())),
        'languages', JSON_OBJECT('title', '语言能力', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
            'level', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.level')), '')))
          FROM JSON_TABLE(r2.common_data, '$.languages[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY())),
        'awards', JSON_OBJECT('title', '荣誉奖项', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'name', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.name')),
            'date', JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.date')),
            'description', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.`value`, '$.description')), '')))
          FROM JSON_TABLE(r2.common_data, '$.awards[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY())),
        'interests', JSON_OBJECT('title', '兴趣爱好', 'columns', 1, 'hidden', FALSE, 'items', COALESCE((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', UUID(), 'hidden', FALSE, 'name', JSON_UNQUOTE(x.`value`)))
          FROM JSON_TABLE(r2.common_data, '$.interests[*]' COLUMNS (`value` JSON PATH '$')) x
        ), JSON_ARRAY()))
      ),
      'customSections', COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', UUID(), 'title', CONCAT('模板专属：', k.`key`), 'columns', 1, 'hidden', FALSE,
          'items', JSON_ARRAY(JSON_OBJECT('id', UUID(), 'hidden', FALSE,
            'name', k.`key`,
            'description', CAST(JSON_EXTRACT(r2.extended_data, CONCAT('$."', k.`key`, '"')) AS CHAR)))))
        FROM JSON_TABLE(JSON_KEYS(COALESCE(r2.extended_data, JSON_OBJECT())), '$[*]' COLUMNS (`key` VARCHAR(255) PATH '$')) k
        LEFT JOIN ext_map em
          ON em.template_code = r2.current_template_id AND em.field_name = k.`key`
        WHERE em.common_path IS NULL
      ), JSON_ARRAY()),
      'metadata', JSON_OBJECT(
        'template', COALESCE(r2.current_template_id, 'cv2'),
        'layout', JSON_OBJECT('main', JSON_ARRAY('profiles','experience','education','skills','projects','certifications','languages','awards','interests'), 'sidebar', JSON_ARRAY(), 'sidebarWidth', 30),
        'page', JSON_OBJECT('format', 'A4', 'margin', 48),
        'design', JSON_OBJECT('colors', JSON_OBJECT('primary', '#4F46E5', 'text', '#1A1A1A', 'background', '#FFFFFF')),
        'typography', JSON_OBJECT('headingFont', 'sans-serif', 'bodyFont', 'sans-serif', 'fontSize', 12),
        'notes', '', 'stylesheet', ''
      )
    ) AS doc
  FROM resume r2
  WHERE r2.data IS NULL AND r2.common_data IS NOT NULL
) t ON t.id = r.id
SET r.data = t.doc;

-- 3. 校验（必须全部通过）
SELECT
  (SELECT COUNT(*) FROM resume) AS total_rows,
  SUM(data IS NULL) AS null_data,
  SUM(JSON_VALID(data) = 0) AS invalid_json,
  SUM(JSON_UNQUOTE(JSON_EXTRACT(data, '$.version')) <> '1.0') AS bad_version
FROM resume;

-- 3.1 无损抽查：旧姓名/摘要 与 新文档对应字段一致
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(common_data, '$.basic.name')) AS old_name,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.basics.name')) AS new_name,
  JSON_UNQUOTE(JSON_EXTRACT(common_data, '$.summary')) AS old_summary,
  JSON_UNQUOTE(JSON_EXTRACT(data, '$.summary.content')) AS new_summary
FROM resume
WHERE common_data IS NOT NULL
LIMIT 20;

-- 3.2 模板专属字段不丢：extended_data 有键的行，customSections 数量应等于其键数
SELECT
  COUNT(*) AS rows_with_extended,
  SUM(JSON_LENGTH(JSON_EXTRACT(data, '$.customSections')) <> JSON_LENGTH(JSON_KEYS(COALESCE(extended_data, JSON_OBJECT())))) AS extended_keys_lost
FROM resume
WHERE extended_data IS NOT NULL;

-- 4. 确认无误后手动执行（默认注释）：
-- ALTER TABLE `resume` DROP COLUMN `common_data`;
-- ALTER TABLE `resume` DROP COLUMN `extended_data`;
-- ALTER TABLE `resume` DROP COLUMN `current_template_id`;
-- ALTER TABLE `resume` DROP COLUMN `template_code`;
-- ALTER TABLE `resume` DROP COLUMN `template_id`;
