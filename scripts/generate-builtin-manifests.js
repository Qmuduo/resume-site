/**
 * 为后端内置占位符模板（backend/resources/templates/*.json）生成 manifest，
 * 输出到 backend/com.resume.api/src/main/resources/template-manifests/<code>.json。
 *
 * 用法：node scripts/generate-builtin-manifests.js
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { resolveCommonPath } = require('./common-model')

const SRC_DIR = path.join(__dirname, '..', 'backend', 'com.resume.api', 'src', 'main', 'resources', 'templates')
const OUT_DIR = path.join(__dirname, '..', 'backend', 'com.resume.api', 'src', 'main', 'resources', 'template-manifests')

function typeOf(node) {
  const type = node?.type
  if (type === 'array') return 'array'
  if (type === 'object') return 'object'
  return 'string'
}

function buildManifest(source) {
  const manifest = {
    templateId: source.code,
    name: source.name,
    sourceFile: `template-${source.code}.json`,
    renderMode: 'placeholder',
    fields: [],
    mappings: [],
    sampleData: {},
    pendingManual: []
  }
  const properties = source.schema?.properties ?? {}
  for (const [name, node] of Object.entries(properties)) {
    const commonPath = resolveCommonPath(name)
    const field = {
      name,
      label: name,
      type: typeOf(node),
      commonPath,
      autoDetected: true
    }
    if (name === 'skills' && commonPath === 'skills') {
      field.transform = 'name'
    }
    manifest.fields.push(field)
  }
  return manifest
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const files = fs.readdirSync(SRC_DIR).filter((n) => n.endsWith('.json')).sort()
  let count = 0
  for (const file of files) {
    const source = JSON.parse(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'))
    if (!source.code) continue
    const manifest = buildManifest(source)
    // 保留已有 manifest 中的 sampleData（演示数据由 build-placeholder-sample-data.js 维护），
    // 避免重新生成时清空已填充的示例内容。
    const outFile = path.join(OUT_DIR, `${manifest.templateId}.json`)
    if (fs.existsSync(outFile)) {
      const existing = JSON.parse(fs.readFileSync(outFile, 'utf8'))
      if (existing.sampleData && Object.keys(existing.sampleData).length > 0) {
        manifest.sampleData = existing.sampleData
      }
    }
    fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), 'utf8')
    count++
  }
  console.log(`generated ${count} builtin manifests -> ${OUT_DIR}`)
}

main()
