/**
 * 模板验证脚本（manifest v2 语义校验）：
 *   node scripts/validate-template.js <template.html> [manifest.json]
 *   node scripts/validate-template.js <directory>
 *   node scripts/validate-template.js --report
 *
 * 校验项：
 *  1. HTML/CSS 无 script、on*、javascript: 等危险内容
 *  2. HTML 含语义类名：resume-page / section-title / entry
 *  3. manifest v2：renderMode 白名单、regions/blocks 非空、block 有 type+selector、
 *     theme key 形如 --xxx 且有默认值
 */
'use strict'

const fs = require('fs')
const path = require('path')

const VALID_RENDER_MODES = ['semantic', 'placeholder']
const REQUIRED_SEMANTIC_CLASSES = ['resume-page', 'section-title', 'entry']
const DANGEROUS_HTML = /<script|on\w+\s*=|javascript:|data:\s*text\/html/i
const DANGEROUS_CSS = /expression\s*\(|@import|javascript:|url\s*\(/i

function validateManifestV2(manifest) {
  const errors = []
  if (!manifest || !manifest.templateId) errors.push('manifest.templateId 缺失')
  if (!manifest || !manifest.name) errors.push('manifest.name 缺失')
  if (!manifest || !['semantic', 'placeholder'].includes(manifest.renderMode)) {
    errors.push(`renderMode 非法: ${manifest && manifest.renderMode}`)
  }
  if (!Array.isArray(manifest.regions) || manifest.regions.length === 0) {
    errors.push('regions 不能为空')
  }
  if (!Array.isArray(manifest.blocks) || manifest.blocks.length === 0) {
    errors.push('blocks 不能为空')
  }
  for (const b of manifest.blocks || []) {
    if (!b.type || !b.selector) errors.push(`block 缺 type/selector: ${JSON.stringify(b)}`)
  }
  for (const t of manifest.theme || []) {
    if (!/^--[a-z0-9-]+$/.test(t.key || '')) errors.push(`theme key 非法: ${t.key}`)
    if (t.default === undefined) errors.push(`theme ${t.key} 缺默认值`)
  }
  return errors
}

function validateContent(html, css) {
  const errors = []
  if (DANGEROUS_HTML.test(html)) errors.push('HTML 含危险内容')
  if (DANGEROUS_CSS.test(css)) errors.push('CSS 含危险内容')
  for (const cls of REQUIRED_SEMANTIC_CLASSES) {
    if (!html.includes(cls)) errors.push(`缺少语义类名 ${cls}`)
  }
  return errors
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    return { __error: error.message }
  }
}

function validateOne(htmlFile, manifestFile) {
  const errors = []
  const warnings = []
  const fileName = path.basename(htmlFile)

  if (!fs.existsSync(htmlFile)) {
    return { file: fileName, valid: false, errors: ['HTML 文件不存在'], warnings }
  }
  const html = fs.readFileSync(htmlFile, 'utf8')
  const cssMatch = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html)
  const css = cssMatch ? cssMatch[1] : ''
  errors.push(...validateContent(html, css))

  if (!manifestFile || !fs.existsSync(manifestFile)) {
    errors.push('manifest.json 不存在')
    return { file: fileName, valid: errors.length === 0, errors, warnings }
  }

  const manifest = readJson(manifestFile)
  if (manifest.__error) {
    errors.push(`manifest 不是合法 JSON: ${manifest.__error}`)
    return { file: fileName, valid: false, errors, warnings }
  }
  errors.push(...validateManifestV2(manifest))

  return { file: fileName, valid: errors.length === 0, errors, warnings }
}

function main() {
  const args = process.argv.slice(2)
  const onlyReport = args.includes('--report')
  const target = args.find((a) => !a.startsWith('-')) || path.join(__dirname, '..', 'docs', 'template')

  let files = []
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    files = fs
      .readdirSync(target)
      .filter((name) => name.endsWith('.html'))
      .sort()
      .map((name) => ({
        html: path.join(target, name),
        manifest: path.join(target, name.replace(/\.html$/, '.manifest.json'))
      }))
  } else if (fs.existsSync(target)) {
    const htmlFile = target
    const manifestFile = args.find((a) => a !== target && a !== '--report')
      || htmlFile.replace(/\.html$/, '.manifest.json')
    files = [{ html: htmlFile, manifest: manifestFile }]
  } else {
    console.error(`目标不存在: ${target}`)
    process.exit(2)
  }

  const results = files.map((f) => validateOne(f.html, f.manifest))
  const validCount = results.filter((r) => r.valid).length
  const errorCount = results.reduce((sum, r) => sum + r.errors.length, 0)
  const warningCount = results.reduce((sum, r) => sum + r.warnings.length, 0)

  if (onlyReport) {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: results.length,
        valid: validCount,
        invalid: results.length - validCount,
        errors: errorCount,
        warnings: warningCount
      },
      results
    }
    const out = path.join(__dirname, '..', 'docs', 'template-validation-report.json')
    fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8')
    console.log(`校验完成：${validCount}/${results.length} 通过，${errorCount} 个错误，${warningCount} 个警告 -> ${out}`)
  } else {
    for (const r of results) {
      if (!r.valid) {
        console.log(`[FAIL] ${r.file}`)
        for (const e of r.errors) console.log(`  - ${e}`)
      } else if (r.warnings.length > 0) {
        console.log(`[WARN] ${r.file}`)
        for (const w of r.warnings) console.log(`  - ${w}`)
      }
    }
    console.log(`结果：${validCount}/${results.length} 通过，${errorCount} 个错误，${warningCount} 个警告`)
  }

  process.exit(validCount === results.length && errorCount === 0 ? 0 : 1)
}

main()
