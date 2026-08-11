-- ============================================================
-- Resume Template Site v4：模板精简为 13 份（保留清单见下方 KEEP_CODES）
-- 变更内容：
--   1. 删除非保留内置模板（builtin=1）与对应 template_config（幂等）
--   2. 保留 13 份内置模板：cv2 + prompt_013/03/021/026/057/044/04/05/063/09/10/089
-- 说明：本脚本可重复执行；全新库无需执行（启动种子只写入保留模板），
--       存量库在 template-market-v3.sql 之后执行本脚本即可。
-- ============================================================

USE resume;

-- 1. 清理非保留内置模板（只删 builtin=1 的系统记录，用户自定义同名模板不受影响）
DELETE t FROM template t
WHERE t.builtin = 1
  AND t.code NOT IN (
      'cv2',
      'prompt_013',
      'prompt_03',
      'prompt_021',
      'prompt_026',
      'prompt_057',
      'prompt_044',
      'prompt_04',
      'prompt_05',
      'prompt_063',
      'prompt_09',
      'prompt_10',
      'prompt_089'
  );

-- 2. 同步清理非保留模板的 template_config（自动生成的配置；用户自定义模板配置不受影响）
DELETE c FROM template_config c
WHERE c.template_code NOT IN (
      'cv2',
      'prompt_013',
      'prompt_03',
      'prompt_021',
      'prompt_026',
      'prompt_057',
      'prompt_044',
      'prompt_04',
      'prompt_05',
      'prompt_063',
      'prompt_09',
      'prompt_10',
      'prompt_089'
  )
  AND (
      c.template_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM template t WHERE t.id = c.template_id)
  );

-- 3. 存量简历策略：保留 resume.current_template_id 指向已下架模板的引用（不删除、不静默改写），
--    前端在预览/编辑时检测到模板不存在会明确提示"模板已下架，请重新选择模板"；
--    公共数据与扩展数据全程保留，切换模板时按 manifest 迁移，无数据丢失。
--    如需强制迁移（注意：仅当所有非保留模板都是内置模板时执行，存在用户自定义模板请勿整批迁移），
--    可手动执行（示例迁移到 cv2）：
--    UPDATE resume SET current_template_id = 'cv2', template_code = 'cv2'
--    WHERE current_template_id NOT IN (
--      'cv2', 'prompt_013', 'prompt_03', 'prompt_021', 'prompt_026',
--      'prompt_057', 'prompt_044', 'prompt_04', 'prompt_05', 'prompt_063',
--      'prompt_09', 'prompt_10', 'prompt_089'
--    );

-- 4. 校验：剩余内置模板应为 13 份，且不含已下架编码
SELECT code, name, builtin FROM template
WHERE builtin = 1
ORDER BY code;

SELECT COUNT(*) AS kept_builtin_count FROM template WHERE builtin = 1;
