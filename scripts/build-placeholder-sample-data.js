/**
 * 为内置占位符模板（cv2、p03–p13）生成 manifest.sampleData。
 *
 * 数据来源：scripts/data/placeholder-sample-data.json，
 * 内容取自 docs/template/prompt_002.html、prompt_03.html–prompt_13.html 的示例数据，
 * 并按各内置模板 schema 结构转换（公共字段尽量映射到 resume-common.schema.json）。
 *
 * 用法：node scripts/build-placeholder-sample-data.js
 */
'use strict'

const fs = require('fs')
const path = require('path')

const SOURCE_FILE = path.join(__dirname, 'data', 'placeholder-sample-data.json')
const MANIFEST_DIR = path.join(
  __dirname,
  '..',
  'backend',
  'com.resume.api',
  'src',
  'main',
  'resources',
  'template-manifests'
)

function main() {
  const samples = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'))
  let updated = 0
  for (const [code, sampleData] of Object.entries(samples)) {
    const manifestFile = path.join(MANIFEST_DIR, `${code}.json`)
    if (!fs.existsSync(manifestFile)) {
      console.warn(`skip ${code}: manifest not found`)
      continue
    }
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    manifest.sampleData = sampleData
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    updated++
    console.log(`updated ${code}.json sampleData (${Object.keys(sampleData).length} fields)`)
  }
  console.log(`done, updated ${updated} manifests -> ${MANIFEST_DIR}`)
}

main()
