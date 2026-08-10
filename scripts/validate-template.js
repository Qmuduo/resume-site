/**
 * 模板验证脚本：新模板接入时校验 HTML + manifest 是否合规。
 *
 * 用法：
 *   node scripts/validate-template.js <template.html> [manifest.json]
 *   node scripts/validate-template.js <directory>          # 校验目录下全部 html + manifest
 *   node scripts/validate-template.js --report              # 生成 docs/template-validation-report.json
 *
 * 校验项：
 *  1. HTML 可读、含 <body>、不含 <script>
 *  2. manifest 为合法 JSON，必填字段齐全
 *  3. 字段 commonPath 必须存在于 docs/resume-common.schema.json
 *  4. 静态模板 mappings.selector 必须能在 HTML 中找到对应选择器
 *  5. attribute / type / renderMode 取值白名单
 */
'use strict'

const fs = require('fs')
const path = require('path')
const {
  COMMON_SCHEMA,
  resolveCommonPath,
  pathExistsInSchema
} = require('./common-model')

const VALID_RENDER_MODES = ['static', 'placeholder']
const VALID_TYPES = ['string', 'number', 'boolean', 'string[]', 'object', 'object[]', 'array']
const VALID_ATTRIBUTES = ['textContent', 'href', 'src', 'children']

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    return { __error: error.message }
  }
}

function selectorExistsInHtml(html, selector) {
  if (!selector) return false
  if (selector.startsWith('.')) {
    const cls = selector.slice(1)
    const re = new RegExp(`class=["'][^"']*\\b${escapeRegExp(cls)}\\b[^"']*["']`, 'i')
    return re.test(html)
  }
  if (selector.startsWith('#')) {
    return new RegExp(`id=["']${escapeRegExp(selector.slice(1))}["']`, 'i').test(html)
  }
  return new RegExp(`<${escapeRegExp(selector.replace(/[>]*$/, ''))}(\\s|>)`, 'i').test(html)
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function validateOne(htmlFile, manifestFile) {
  const errors = []
  const warnings = []
  const fileName = path.basename(htmlFile)

  if (!fs.existsSync(htmlFile)) {
    return { file: fileName, valid: false, errors: ['HTML 文件不存在'] }
  }
  const html = fs.readFileSync(htmlFile, 'utf8')
  if (!/<body[\s>]/i.test(html)) {
    errors.push('HTML 缺少 <body>')
  }
  if (/<script[\s>]/i.test(html)) {
    errors.push('HTML 包含 <script>，禁止执行脚本')
  }

  if (!manifestFile || !fs.existsSync(manifestFile)) {
    errors.push('manifest.json 不存在')
    return { file: fileName, valid: errors.length === 0, errors, warnings }
  }

  const manifest = readJson(manifestFile)
  if (manifest.__error) {
    errors.push(`manifest 不是合法 JSON: ${manifest.__error}`)
    return { file: fileName, valid: false, errors, warnings }
  }

  const required = ['templateId', 'renderMode', 'fields', 'mappings']
  for (const key of required) {
    if (manifest[key] === undefined) errors.push(`manifest 缺少必填字段 ${key}`)
  }
  if (manifest.templateId === '') errors.push('templateId 不能为空')
  if (manifest.renderMode && !VALID_RENDER_MODES.includes(manifest.renderMode)) {
    errors.push(`renderMode 非法: ${manifest.renderMode}，允许 ${VALID_RENDER_MODES.join('/')}`)
  }

  const fields = Array.isArray(manifest.fields) ? manifest.fields : []
  const fieldNames = new Set()
  for (const field of fields) {
    if (!field.name) {
      errors.push('存在缺少 name 的字段定义')
      continue
    }
    if (fieldNames.has(field.name)) warnings.push(`字段 ${field.name} 重复定义`)
    fieldNames.add(field.name)
    if (field.type && !VALID_TYPES.includes(field.type)) {
      warnings.push(`字段 ${field.name} type 不在白名单: ${field.type}`)
    }
    if (field.commonPath !== undefined && field.commonPath !== null) {
      if (!pathExistsInSchema(COMMON_SCHEMA, field.commonPath)) {
        errors.push(`字段 ${field.name} 的 commonPath 不存在于公共模型: ${field.commonPath}`)
      }
    } else {
      warnings.push(`字段 ${field.name} 未映射公共模型（模板专属字段，需人工确认）`)
    }
  }

  const mappings = Array.isArray(manifest.mappings) ? manifest.mappings : []
  for (const mapping of mappings) {
    if (mapping.attribute && !VALID_ATTRIBUTES.includes(mapping.attribute)) {
      errors.push(`mapping ${mapping.selector} attribute 非法: ${mapping.attribute}`)
    }
    if (mapping.commonPath && !pathExistsInSchema(COMMON_SCHEMA, mapping.commonPath)) {
      errors.push(`mapping ${mapping.selector} 的 commonPath 不存在: ${mapping.commonPath}`)
    }
    if (mapping.commonPath && !mapping.selector) {
      warnings.push(`mapping ${mapping.commonPath} 缺少 selector，预览无法回填`)
    }
    if (manifest.renderMode === 'static' && mapping.selector) {
      if (!selectorExistsInHtml(html, mapping.selector)) {
        warnings.push(`mapping selector 未在 HTML 中找到: ${mapping.selector}`)
      }
    }
  }

  if (manifest.renderMode === 'static' && mappings.length === 0) {
    warnings.push('静态模板没有 mappings，用户数据无法回填（仅展示示例数据）')
  }
  if (manifest.templateId && path.basename(htmlFile).startsWith(manifest.templateId)) {
    // OK
  }

  return { file: fileName, valid: errors.length === 0, errors, warnings, fields: fields.length, mappings: mappings.length }
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
