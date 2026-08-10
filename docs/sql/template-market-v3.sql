-- ============================================================
-- Resume Template Site v3：模板市场改版 + 内置模板下架（MySQL 8）
-- 变更内容：
--   1. template 表新增 category（分类）与 tags（标签，JSON 数组）
--   2. 删除已下架内置模板 classic / minimal / modern（幂等）
-- 说明：本脚本可重复执行；全新库可直接执行 init.sql 后执行本脚本，
--       存量库在 schema-v2.sql 之后执行本脚本。
-- ============================================================

USE resume;

-- 1. template 表新增 category / tags（MySQL 8 不支持 ADD COLUMN IF NOT EXISTS，用 information_schema 守卫）
SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `template` ADD COLUMN category VARCHAR(64) NULL COMMENT ''模板分类（如：金融/咨询/互联网技术）'' AFTER description',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'template' AND COLUMN_NAME = 'category'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `template` ADD COLUMN tags JSON NULL COMMENT ''模板标签（JSON 字符串数组）'' AFTER category',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'template' AND COLUMN_NAME = 'tags'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 清理已下架内置模板（只删 builtin=1 的系统记录，用户自定义同名模板不受影响）
DELETE t FROM template t
WHERE t.builtin = 1
  AND t.code IN ('classic', 'minimal', 'modern');

DELETE c FROM template_config c
WHERE c.template_code IN ('classic', 'minimal', 'modern')
  AND (
      c.template_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM template t WHERE t.id = c.template_id)
  );

-- 3. 存量简历策略：保留 resume.current_template_id 指向已下架模板的引用（不删除、不静默改写），
--    前端在预览/编辑时检测到模板不存在会明确提示"模板已下架，请重新选择模板"；
--    公共数据与扩展数据全程保留，切换模板时按 manifest 迁移，无数据丢失。
--    如需强制迁移到默认模板，可手动执行（示例迁移到 p03）：
--    UPDATE resume SET current_template_id = 'p03', template_code = 'p03'
--    WHERE current_template_id IN ('classic', 'minimal', 'modern');

-- 4. 校验
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'template'
  AND COLUMN_NAME IN ('category', 'tags')
ORDER BY ORDINAL_POSITION;

SELECT code, name, builtin FROM template
WHERE code IN ('classic', 'minimal', 'modern');
