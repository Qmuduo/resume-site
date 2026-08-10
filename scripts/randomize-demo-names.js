/**
 * 演示数据姓名随机化：把所有模板演示数据中的姓名统一替换为指定名单中的随机姓名。
 *
 * 规则：
 *   - 名单：屈原、陶渊明、李白、杜甫、白居易、王维、李商隐、苏轼、辛弃疾、李清照
 *   - 同一模板内姓名保持一致；不同模板按模板编码哈希随机分布，不要求去重；
 *   - cv2 / p03–p13 与其对应的静态模板（prompt_002 / prompt_03–13）保持同名。
 *
 * 处理范围：
 *   - docs/template/*.html 内的示例姓名
 *   - docs/template/*.manifest.json 的 sampleData / name / title
 *   - scripts/data/placeholder-sample-data.json（内置占位符模板演示数据源）
 *   - 重新生成 backend/.../template-manifests/*.json 的 sampleData
 *
 * 用法：node scripts/randomize-demo-names.js
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const TEMPLATE_DIR = path.join(__dirname, '..', 'docs', 'template')
const PLACEHOLDER_SOURCE = path.join(__dirname, 'data', 'placeholder-sample-data.json')

const NAMES = ['屈原', '陶渊明', '李白', '杜甫', '白居易', '王维', '李商隐', '苏轼', '辛弃疾', '李清照']

/** 内置占位符模板 -> 对应静态模板（保证同名） */
const BUILTIN_SOURCE = {
  cv2: 'prompt_002',
  p03: 'prompt_03',
  p04: 'prompt_04',
  p05: 'prompt_05',
  p06: 'prompt_06',
  p07: 'prompt_07',
  p08: 'prompt_08',
  p09: 'prompt_09',
  p10: 'prompt_10',
  p11: 'prompt_11',
  p12: 'prompt_12',
  p13: 'prompt_13'
}

function pickName(code) {
  let hash = 0
  for (const ch of String(code)) {
    hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  }
  return NAMES[hash % NAMES.length]
}

function extractNameFromHtml(code) {
  const html = fs.readFileSync(path.join(TEMPLATE_DIR, `${code}.html`), 'utf8')
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)
  if (title) {
    const m = title[1].match(/[\u4e00-\u9fa5]{2,4}/)
    if (m) return m[0]
  }
  const nameEl = /class="name"[^>]*>([\s\S]*?)</.exec(html) || /<h1[^>]*>([\s\S]*?)</.exec(html)
  if (nameEl) {
    const m = nameEl[1].match(/[\u4e00-\u9fa5]{2,4}/)
    if (m) return m[0]
  }
  return null
}

function replaceDeep(value, oldName, newName) {
  if (typeof value === 'string') {
    return value.split(oldName).join(newName)
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceDeep(item, oldName, newName))
  }
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = replaceDeep(v, oldName, newName)
    }
    return out
  }
  return value
}

function main() {
  const manifestFiles = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.manifest.json')).sort()
  const codes = manifestFiles.map((f) => f.replace(/\.manifest\.json$/, ''))

  // 1. 决定每个模板的新姓名（内置模板跟随其静态对应模板）
  const assigned = {}
  for (const code of codes) {
    assigned[code] = pickName(code)
  }
  for (const [builtin, source] of Object.entries(BUILTIN_SOURCE)) {
    assigned[builtin] = assigned[source] || pickName(source)
  }

  // 2. 更新静态 HTML 与 manifest（先替换长者，避免前缀误伤）
  const ordered = codes.slice().sort((a, b) => {
    const la = oldNameOf(a)?.length ?? 0
    const lb = oldNameOf(b)?.length ?? 0
    return lb - la
  })

  let updated = 0
  for (const code of ordered) {
    const oldName = oldNameOf(code)
    const newName = assigned[code]
    if (!oldName || oldName === newName) continue
    // 去掉装饰符号后的"裸姓名"（如 "❯ 陈亦凡" -> "陈亦凡"、"$ CHEN WEI_" -> "CHEN WEI"）
    const bareName = String(oldName)
      .replace(/^[^A-Za-z\u4e00-\u9fa5]+|[^A-Za-z\u4e00-\u9fa5]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const htmlFile = path.join(TEMPLATE_DIR, `${code}.html`)
    if (fs.existsSync(htmlFile)) {
      const html = fs.readFileSync(htmlFile, 'utf8')
      let next = html.split(oldName).join(newName)
      if (bareName && bareName !== oldName) {
        next = next.split(bareName).join(newName)
      }
      if (next !== html) {
        fs.writeFileSync(htmlFile, next, 'utf8')
      }
    }

    const manifestFile = path.join(TEMPLATE_DIR, `${code}.manifest.json`)
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    let nextManifest = replaceDeep(manifest, oldName, newName)
    if (bareName && bareName !== oldName) {
      nextManifest = replaceDeep(nextManifest, bareName, newName)
    }
    fs.writeFileSync(manifestFile, JSON.stringify(nextManifest, null, 2) + '\n', 'utf8')
    updated++
    console.log(`${code}: ${oldName} -> ${newName}`)
  }

  // 3. 更新内置占位符模板演示数据源并重新生成 manifest
  const placeholder = JSON.parse(fs.readFileSync(PLACEHOLDER_SOURCE, 'utf8'))
  for (const [builtin, source] of Object.entries(BUILTIN_SOURCE)) {
    const oldName = placeholder[builtin]?.name
    const newName = assigned[builtin]
    if (oldName && oldName !== newName) {
      placeholder[builtin] = replaceDeep(placeholder[builtin], oldName, newName)
    }
  }
  fs.writeFileSync(PLACEHOLDER_SOURCE, JSON.stringify(placeholder, null, 2) + '\n', 'utf8')

  console.log(`updated ${updated} static templates + placeholder sample source`)
  execFileSync('node', [path.join(__dirname, 'build-placeholder-sample-data.js')], {
    stdio: 'inherit'
  })
}

function oldNameOf(code) {
  const manifestFile = path.join(TEMPLATE_DIR, `${code}.manifest.json`)
  if (!fs.existsSync(manifestFile)) return null
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  const name = manifest.sampleData?.name
  return name && String(name).trim() ? String(name).trim() : extractNameFromHtml(code)
}

main()
