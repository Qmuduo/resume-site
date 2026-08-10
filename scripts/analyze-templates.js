/**
 * 存量模板自动分析脚本：
 *   - 扫描 docs/template 下所有 HTML；
 *   - 自动识别公共模型字段（姓名/联系方式/简介/工作经历/教育/技能/项目/证书/语言/奖项/兴趣等）；
 *   - 检测未在公共模型中的自定义字段；
 *   - 生成 docs/template/<name>.manifest.json 与 docs/template-analysis-report.json。
 *
 * 用法：node scripts/analyze-templates.js
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { resolveCommonPath, stripTags, collapse } = require('./common-model')

const TEMPLATE_DIR = path.join(__dirname, '..', 'docs', 'template')
const REPORT_PATH = path.join(__dirname, '..', 'docs', 'template-analysis-report.json')

/** 区块标题 -> 公共模型类别 */
function classifySection(title) {
  const t = String(title).toLowerCase()
  if (/项目|作品|案例|竞赛|比赛|portfolio|project/.test(t)) return 'projects'
  if (/教育|学历|school|education/.test(t)) return 'education'
  if (/语言|language/.test(t)) return 'languages'
  if (/证书|认证|资质|资格|执照|cert|license/.test(t)) return 'certifications'
  if (/荣誉|奖项|获奖|表彰|award|honor/.test(t)) return 'awards'
  if (/兴趣|爱好|hobby|interest/.test(t)) return 'interests'
  if (/技能|能力|技术|工具|专长|掌握|skills?|technolog|competenc|expertise|stack/.test(t)) return 'skills'
  if (/摘要|概要|概述|简介|概览|综述|总结|自我评价|profile|summary|objective|about|highlight/.test(t)) return 'summary'
  if (/工作|经历|经验|职业|实习|employment|experience|work|career/.test(t)) return 'experiences'
  return null
}

/** 提取 <body> 内容 */
function bodyOf(html) {
  const m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)
  return m ? m[1] : html
}

/** 类名是否包含指定 token（按空格边界精确匹配） */
function hasClassToken(classValue, token) {
  return new RegExp(`(?:^|\\s)${token}(?:\\s|$)`).test(String(classValue).trim())
}

/** 查找下一个 class 含指定 token 的元素开始标签 */
function matchElement(html, fromIndex, classToken) {
  const re = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*class=["']([^"']*)["'][^>]*>/gi
  re.lastIndex = fromIndex
  const m = re.exec(html)
  if (!m) return null
  return hasClassToken(m[2], classToken)
    ? { index: m.index, tag: m[1], classes: m[2], full: m[0] }
    : matchElement(html, m.index + m[0].length, classToken)
}

/** 从开始标签位置提取完整元素（按同名标签深度） */
function extractByTag(html, openIndex) {
  const tagRe = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(openIndex))
  if (!tagRe) return null
  const tag = tagRe[1]
  const openEnd = html.indexOf('>', openIndex)
  if (openEnd === -1) return null
  let depth = 1
  const re = new RegExp(`<(/?)${tag}[\\s>]`, 'gi')
  re.lastIndex = openEnd
  let m
  while ((m = re.exec(html))) {
    depth += m[1] === '/' ? -1 : 1
    if (depth === 0) return html.slice(openIndex, m.index + m[0].length)
  }
  return null
}

/** 提取开始标签之后、最近同名闭合标签之前的内容文本 */
function elementInnerText(html, openIndex, tag) {
  const openEnd = html.indexOf('>', openIndex)
  if (openEnd === -1) return ''
  const closeRe = new RegExp(`</${tag}>`, 'i')
  const rest = html.slice(openEnd + 1)
  const close = closeRe.exec(rest)
  if (!close) return collapse(rest)
  return collapse(rest.slice(0, close.index))
}

/** 提取自 start 起的完整同级 div 元素（含嵌套） */
function extractDiv(html, start) {
  const openEnd = html.indexOf('>', start)
  if (openEnd === -1) return null
  if (!/^<div[\s>]/i.test(html.slice(start, openEnd + 1))) {
    const close = html.indexOf('</div>', openEnd)
    return close === -1 ? null : { html: html.slice(start, close + 6), end: close + 6 }
  }
  let depth = 1
  let i = openEnd
  const re = /<\/?div[\s>]/gi
  re.lastIndex = openEnd
  let m
  while ((m = re.exec(html))) {
    depth += m[0].startsWith('</') ? -1 : 1
    if (depth === 0) {
      const end = m.index + m[0].length
      return { html: html.slice(start, end), end }
    }
  }
  return null
}

/** 在元素片段内按类名关键词提取文本（关键词优先级即对象键顺序） */
function collectFields(segment, keyMap) {
  const result = {}
  const tagRe = /<[a-zA-Z][a-zA-Z0-9]*[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/[a-zA-Z][a-zA-Z0-9]*>/gi
  let m
  const used = new Set()
  while ((m = tagRe.exec(segment))) {
    const classes = m[1]
    const text = collapse(m[2])
    if (!text) continue
    for (const [key, tokens] of Object.entries(keyMap)) {
      if (used.has(key)) continue
      const lower = classes.toLowerCase()
      if (tokens.some((token) => hasClassToken(lower, token))) {
        result[key] = text
        used.add(key)
        break
      }
    }
  }
  return result
}

/** 提取列表项文本（class 匹配某关键词的元素） */
function collectListTexts(segment, classToken) {
  const texts = []
  const re = /<[a-zA-Z][a-zA-Z0-9]*[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/[a-zA-Z][a-zA-Z0-9]*>/gi
  let m
  while ((m = re.exec(segment))) {
    if (!hasClassToken(m[1], classToken)) continue
    const text = collapse(m[2])
    if (text) texts.push(text)
  }
  return texts
}

/** 检测所有区块标题与区间 */
function collectSections(html) {
  const markers = []
  const re1 = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/\1>/gi
  let m
  while ((m = re1.exec(html))) {
    if (!hasClassToken(m[2], 'section-title')) continue
    const title = collapse(m[3])
    if (title) markers.push({ start: m.index, end: m.index + m[0].length, title, bodyStart: m.index + m[0].length })
  }
  const re2 = /<div[^>]*class=["']([^"']*)["'][^>]*>\s*<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi
  while ((m = re2.exec(html))) {
    if (!hasClassToken(m[1], 'section')) continue
    const title = collapse(m[2])
    if (title) markers.push({ start: m.index, end: m.index + m[0].length, title, bodyStart: m.index + m[0].length })
  }
  markers.sort((a, b) => a.start - b.start)
  return markers.map((marker, i) => ({
    title: marker.title,
    body: html.slice(marker.bodyStart, i + 1 < markers.length ? markers[i + 1].start : html.length)
  }))
}

/** 检测联系方式条目 */
function detectContacts(html) {
  const items = []
  const re = /<[a-zA-Z][a-zA-Z0-9]*[^>]*class=["']([^"']*)["'][^>]*>/gi
  let m
  let index = 0
  while ((m = re.exec(html))) {
    if (!hasClassToken(m[1], 'contact-item')) continue
    index += 1
    const element = extractByTag(html, m.index)
    if (!element) continue
    const content = element.replace(/^<[^>]*>/, '').replace(/<\/[^>]*>$/, '')
    const classes = m[1].toLowerCase()
    const innerIconMatch = /class=["'][^"']*icon-([a-z]+)["']/i.exec(content)
    const innerIcon = innerIconMatch ? innerIconMatch[1].toLowerCase() : ''
    const text = collapse(content)
    const hrefMatch = /href=["']([^"']+)["']/i.exec(content)
    const href = hrefMatch ? hrefMatch[1] : ''
    items.push({ index, text, href, classes, innerIcon })
  }
  return items
}

function detectName(html) {
  const el = matchElement(html, 0, 'name')
  if (el) {
    const text = elementInnerText(html, el.index, el.tag)
    if (text && text.length <= 20) {
      return { field: 'name', selector: '.name', text: text.replace(/\s+/g, ' ').trim(), confidence: 'high' }
    }
  }
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  if (h1) {
    const raw = collapse(h1[1])
    if (raw && raw.length <= 12 && !/简历|resume/i.test(raw)) {
      return { field: 'name', selector: 'h1', text: raw, confidence: 'medium' }
    }
    const first = raw.split(/[·|]/)[0].trim()
    if (first && first.length <= 6 && !/简历|resume|职位|工程师|经理|设计师|顾问|分析师/i.test(first)) {
      return { field: 'name', selector: 'h1', text: first, confidence: 'low' }
    }
  }
  return null
}

function detectTitle(html) {
  const tokens = ['title-sub', 'title-role', 'subtitle', 'job-title', 'position-title', 'headline', 'header-role', 'role-title']
  for (const token of tokens) {
    const el = matchElement(html, 0, token)
    if (el) {
      const text = elementInnerText(html, el.index, el.tag)
      if (text && text.length > 1) {
        return { field: 'title', selector: `.${token}`, text, confidence: 'high' }
      }
    }
  }
  return null
}

function detectSummary(html, sections) {
  const tokens = ['summary', 'profile', 'about', 'intro', 'objective', 'professional-summary']
  for (const token of tokens) {
    const el = matchElement(html, 0, token)
    if (el) {
      const text = elementInnerText(html, el.index, el.tag)
      if (text && text.length > 5) {
        return { field: 'summary', selector: `.${token}`, text, confidence: 'high' }
      }
    }
  }
  const summarySection = sections.find((s) => classifySection(s.title) === 'summary')
  if (summarySection) {
    const p = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(summarySection.body)
    if (p) {
      const text = collapse(p[1])
      const classMatch = /class=["']([^"']*)["']/i.exec(p[0])
      if (text.length > 5) {
        return {
          field: 'summary',
          selector: classMatch ? `.${classMatch[1].trim().split(/\s+/)[0]}` : null,
          text,
          confidence: classMatch ? 'medium' : 'low'
        }
      }
    }
  }
  return null
}

function detectAvatar(html) {
  const re = /<img[^>]*class=["']([^"']*)["'][^>]*>/gi
  let m
  while ((m = re.exec(html))) {
    if (/avatar|photo|headshot|profile-image/i.test(m[1])) {
      const src = /src=["']([^"']+)["']/i.exec(m[0])
      return {
        field: 'avatar',
        selector: `.${m[1].trim().split(/\s+/)[0]}`,
        text: src ? src[1] : '',
        attribute: 'src',
        confidence: 'high'
      }
    }
  }
  return null
}

/** 按类别提取列表区块示例数据与映射 */
function extractListSection(section, category) {
  const body = section.body
  const result = {
    items: [],
    selector: null,
    itemSelector: null,
    found: false
  }
  if (category === 'summary') return result
  const itemTokens = {
    education: ['edu-item', 'education-item', 'education-entry', 'edu-entry', 'entry'],
    experiences: ['experience-item', 'exp-item', 'exp-entry', 'entry'],
    projects: ['project-item', 'project-entry', 'entry'],
    certifications: ['cert-item', 'certification-item', 'skill-item', 'skill-tag', 'entry'],
    awards: ['award-item', 'honor-item', 'entry'],
    languages: ['lang-item', 'language-item', 'lang', 'language', 'entry'],
    interests: ['tag', 'interest', 'interest-item'],
    skills: ['skill-item', 'skill-tag', 'skill-name', 'skill']
  }
  const keyMaps = {
    education: {
      school: ['school', 'institution', 'edu-school'],
      degree: ['degree', 'edu-degree', 'role', 'major'],
      date: ['date', 'date-location', 'date-range', 'edu-date', 'time'],
      description: ['desc', 'detail', 'bullet', 'edu-detail']
    },
    experiences: {
      company: ['company', 'institution', 'company-name', 'entry-org', 'org', 'organization'],
      position: ['position', 'role', 'job-title', 'title', 'entry-subtitle', 'entry-title', 'subtitle'],
      date: ['date', 'date-location', 'date-range', 'time', 'entry-date'],
      description: ['desc', 'detail', 'bullet', 'summary', 'entry-details', 'details', 'desc-list', 'description-list']
    },
    projects: {
      name: ['project-name', 'project-title', 'name', 'institution'],
      role: ['role', 'position'],
      date: ['date', 'date-location', 'date-range', 'time', 'entry-date'],
      description: ['desc', 'detail', 'bullet', 'project-desc', 'desc-list', 'details']
    },
    certifications: {
      name: ['cert-name', 'cert-title', 'name', 'institution', 'skill-item', 'skill-tag'],
      date: ['date', 'cert-date', 'time', 'entry-date'],
      issuer: ['issuer', 'org', 'institution']
    },
    awards: {
      name: ['award-name', 'award-title', 'honor-name', 'name'],
      date: ['date', 'award-date', 'time', 'entry-date'],
      description: ['desc', 'detail', 'details']
    },
    languages: {
      name: ['lang-name', 'language-name', 'name', 'lang'],
      level: ['level', 'lang-level', 'proficiency']
    },
    interests: {
      name: ['tag', 'interest', 'name']
    }
  }

  if (category === 'skills') {
    const tags = []
    let source = null
    for (const token of ['skill-tag', 'skill-item', 'skill-name']) {
      const found = collectListTexts(body, token)
      if (found.length > 0) {
        tags.push(...found)
        source = token
        break
      }
    }
    if (source === null) {
      for (const listText of collectListTexts(body, 'skill-list')) {
        listText.split(/[,，、]/).map((t) => t.trim()).filter(Boolean).forEach((t) => tags.push(t))
      }
      source = tags.length > 0 ? 'skill-list' : null
    }
    if (tags.length > 0) {
      result.items = tags.map((t) => ({ name: t, level: '' }))
      result.selector = source ? `.${source}` : null
      result.itemSelector = source
      result.found = true
    }
    return result
  }

  if (category === 'languages') {
    const strongRe = /<strong[^>]*>([\s\S]*?)<\/strong>\s*\(([^)]*)\)/gi
    let sm
    while ((sm = strongRe.exec(body))) {
      const name = collapse(sm[1])
      if (name) {
        result.items.push({ name, level: collapse(sm[2]) })
        result.found = true
      }
    }
    if (result.found) {
      result.selector = firstClassSelector(body, ['lang-item', 'language-item', 'lang', 'language'])
      result.itemSelector = result.selector ? result.selector.slice(1) : 'strong'
    }
    return result
  }

  const tokens = itemTokens[category]
  const keyMap = keyMaps[category]
  const itemRe = /<[a-zA-Z][a-zA-Z0-9]*[^>]*class=["']([^"']*)["'][^>]*>/gi
  let m
  while ((m = itemRe.exec(body))) {
    const classes = m[1].toLowerCase()
    const matched = tokens.find((token) => hasClassToken(classes, token))
    if (!matched) continue
    const extracted = extractDiv(body, m.index)
    if (!extracted) continue
    const fields = collectFields(extracted.html, keyMap)
    if (Object.keys(fields).length > 0) {
      result.items.push(fields)
      result.found = true
    }
  }
  if (result.found) {
    result.selector = firstClassSelector(body, tokens.filter((t) => t !== 'entry'))
    result.itemSelector = result.selector ? result.selector.slice(1) : null
  }
  return result
}

function firstClassSelector(segment, tokens) {
  for (const token of tokens) {
    const re = /class=["']([^"']*)["']/gi
    let m
    while ((m = re.exec(segment))) {
      if (hasClassToken(m[1], token)) return `.${token}`
    }
  }
  return null
}

function detectSocials(contacts) {
  const socials = []
  for (const item of contacts) {
    let platform = null
    const hint = item.classes + item.text + (item.innerIcon ? ` icon-${item.innerIcon}` : '')
    if (/linkedin/i.test(hint)) platform = 'linkedin'
    else if (/github/i.test(hint)) platform = 'github'
    else if (/website|web|portfolio|作品集/i.test(hint)) platform = 'website'
    if (platform) {
      socials.push({ platform, url: item.href || item.text })
    }
  }
  return socials
}

function buildManifest(base, html) {
  const manifest = {
    templateId: base,
    name: '',
    sourceFile: `${base}.html`,
    renderMode: 'static',
    fields: [],
    mappings: [],
    sampleData: {},
    pendingManual: []
  }
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  manifest.name = titleMatch ? collapse(titleMatch[1]) : base

  const body = bodyOf(html)
  const sections = collectSections(body)

  const addField = (field, mapping) => {
    manifest.fields.push(field)
    if (mapping) manifest.mappings.push(mapping)
    else manifest.pendingManual.push(field)
  }

  // 标量字段
  const name = detectName(body)
  if (name) {
    manifest.sampleData.name = name.text
    addField(
      { name: 'name', label: '姓名', type: 'string', commonPath: 'basic.name', autoDetected: name.confidence !== 'low' },
      { commonPath: 'basic.name', selector: name.selector, attribute: 'textContent', autoDetected: name.confidence !== 'low' }
    )
  } else {
    manifest.pendingManual.push({ name: 'name', label: '姓名', type: 'string', commonPath: 'basic.name', autoDetected: false, reason: '未定位到姓名元素' })
  }

  const title = detectTitle(body)
  if (title) {
    manifest.sampleData.title = title.text
    addField(
      { name: 'title', label: '求职意向/职位', type: 'string', commonPath: 'basic.title', autoDetected: title.confidence !== 'low' },
      { commonPath: 'basic.title', selector: title.selector, attribute: 'textContent', autoDetected: title.confidence !== 'low' }
    )
  }

  const avatar = detectAvatar(body)
  if (avatar) {
    manifest.sampleData.avatar = avatar.text
    addField(
      { name: 'avatar', label: '头像', type: 'string', commonPath: 'basic.avatar', autoDetected: true },
      { commonPath: 'basic.avatar', selector: avatar.selector, attribute: 'src', autoDetected: true }
    )
  }

  // 联系方式
  const contacts = detectContacts(body)
  const contactFields = []
  for (const item of contacts) {
    const mapping = { commonPath: null, selector: '.contact-item', attribute: 'textContent', autoDetected: true, index: item.index }
    let field = null
    const iconHint = item.classes + (item.innerIcon ? ` icon-${item.innerIcon}` : '')
    const cleanText = item.text
      .replace(/[📞✉️📍🔗🌐📱📧🏠💬]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const isLink = /^(https?:\/\/|www\.|linkedin\.com|github\.com|[\w-]+\.(com|cn|net|io|org|cc|me)(\/|\s|$))/i.test(cleanText)
    const digits = (cleanText.match(/\d/g) || []).length
    if (/icon-phone|\bphone\b|\bmobile\b|\btel\b|电话|手机/.test(iconHint) ||
        (!item.text.includes('@') && !isLink && digits >= 7)) {
      field = { name: 'phone', label: '电话', type: 'string', commonPath: 'basic.phone', autoDetected: true }
      manifest.sampleData.phone = cleanText
    } else if (/icon-email|email|mail|邮箱/.test(iconHint) || item.text.includes('@')) {
      field = { name: 'email', label: '邮箱', type: 'string', commonPath: 'basic.email', autoDetected: true }
      manifest.sampleData.email = item.text
      mapping.attribute = 'textContent'
    } else if (item.text.includes('📍') ||
               /icon-location|location|address|addr|地址|位于|城市/.test(iconHint + item.text)) {
      field = { name: 'location', label: '所在城市', type: 'string', commonPath: 'basic.location', autoDetected: true }
      manifest.sampleData.location = cleanText
    } else if (/icon-linkedin|linkedin|领英/.test(iconHint + item.text) || (item.text.includes('🔗') && /linkedin|领英/i.test(item.text))) {
      field = { name: 'linkedin', label: '领英', type: 'string', commonPath: 'socials', autoDetected: true }
      mapping.attribute = 'href'
    } else if (/icon-github|github/.test(iconHint + item.text) || (item.text.includes('🔗') && /github/i.test(item.text))) {
      field = { name: 'github', label: 'GitHub', type: 'string', commonPath: 'socials', autoDetected: true }
      mapping.attribute = 'href'
    } else if (/icon-website|website|web|portfolio|作品集|个人网站/.test(iconHint + item.text) || isLink) {
      field = { name: 'website', label: '个人网站', type: 'string', commonPath: 'socials', autoDetected: true }
      mapping.attribute = 'href'
    }
    if (field) {
      if (field.commonPath === 'socials') {
        manifest.sampleData.socials = detectSocials(contacts)
        field = { ...field, name: `social_${item.index}`, autoDetected: true }
        mapping.commonPath = 'socials'
      } else {
        mapping.commonPath = field.commonPath
      }
      contactFields.push({ field, mapping })
    }
  }
  for (const { field, mapping } of contactFields) {
    addField(field, mapping)
  }

  // 简介
  const summary = detectSummary(body, sections)
  if (summary) {
    manifest.sampleData.summary = summary.text
    if (summary.selector) {
      addField(
        { name: 'summary', label: '个人简介', type: 'string', commonPath: 'summary', autoDetected: summary.confidence !== 'low' },
        { commonPath: 'summary', selector: summary.selector, attribute: 'textContent', autoDetected: summary.confidence !== 'low' }
      )
    } else {
      const summarySection = sections.find((s) => classifySection(s.title) === 'summary')
      if (summarySection) {
        manifest.fields.push({ name: 'summary', label: '个人简介', type: 'string', commonPath: 'summary', autoDetected: true })
        manifest.mappings.push({
          commonPath: 'summary',
          attribute: 'textContent',
          autoDetected: true,
          sectionTitle: summarySection.title
        })
      } else {
        manifest.pendingManual.push({ name: 'summary', label: '个人简介', type: 'string', commonPath: 'summary', autoDetected: false, reason: '定位到简介但无可用选择器' })
      }
    }
  }

  // 列表区块
  const categoryAgg = {}
  for (const section of sections) {
    const category = classifySection(section.title)
    if (!category) {
      const key = normalizeFieldName(section.title)
      const existing = manifest.fields.find((f) => f.name === key)
      if (!existing) {
        manifest.fields.push({ name: key, label: section.title, type: 'array', commonPath: null, autoDetected: false })
        manifest.pendingManual.push({ name: key, label: section.title, type: 'array', commonPath: null, autoDetected: false, reason: '未识别的自定义区块' })
        manifest.sampleData[key] = collapse(section.body).slice(0, 200)
      }
      continue
    }
    if (!categoryAgg[category]) {
      categoryAgg[category] = { title: section.title, items: [], selector: null, itemSelector: null, found: false }
    }
    const agg = categoryAgg[category]
    const extracted = extractListSection(section, category)
    agg.items.push(...extracted.items)
    agg.found = agg.found || extracted.found
    if (!agg.selector) {
      agg.selector = extracted.selector
      agg.itemSelector = extracted.itemSelector
    }
  }

  for (const [category, agg] of Object.entries(categoryAgg)) {
    const labelByCategory = {
      education: '教育背景',
      experiences: '工作经历',
      projects: '项目经验',
      skills: '技能清单',
      certifications: '证书',
      awards: '荣誉奖项',
      languages: '语言能力',
      interests: '兴趣爱好'
    }
    const field = {
      name: category,
      label: labelByCategory[category] || agg.title,
      type: 'array',
      commonPath: category,
      autoDetected: agg.found,
      transform: category === 'skills' ? 'name' : undefined
    }
    if (agg.found && agg.selector) {
      manifest.fields.push(field)
      manifest.mappings.push({
        commonPath: category,
        selector: agg.selector,
        attribute: 'children',
        autoDetected: true,
        itemSelector: agg.itemSelector
      })
    } else if (agg.found) {
      manifest.fields.push(field)
      manifest.mappings.push({
        commonPath: category,
        attribute: 'children',
        autoDetected: true,
        sectionTitle: agg.title,
        itemSelector: 'entry'
      })
    } else {
      field.autoDetected = false
      manifest.fields.push(field)
      manifest.pendingManual.push({ ...field, reason: '区块存在但未提取到条目或选择器' })
    }
    if (agg.items.length > 0) {
      manifest.sampleData[category] = agg.items
    }
  }

  manifest.fields = manifest.fields.filter(
    (f, i, arr) => arr.findIndex((x) => x.name === f.name) === i
  )
  const uniquePending = new Map()
  for (const p of manifest.pendingManual) {
    if (!uniquePending.has(p.name)) uniquePending.set(p.name, p)
  }
  manifest.pendingManual = [...uniquePending.values()]
  return manifest
}

function normalizeFieldName(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'customSection'
}

function main() {
  const files = fs.readdirSync(TEMPLATE_DIR).filter((name) => name.endsWith('.html')).sort()
  const report = {
    generatedAt: new Date().toISOString(),
    tool: 'scripts/analyze-templates.js',
    summary: {
      totalTemplates: files.length,
      totalFields: 0,
      autoDetectedFields: 0,
      pendingManualFields: 0,
      autoDetectionRate: 0,
      commonPathUsage: {}
    },
    templates: [],
    manualReview: []
  }

  for (const file of files) {
    const base = file.replace(/\.html$/, '')
    const html = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8')
    const manifest = buildManifest(base, html)
    const out = path.join(TEMPLATE_DIR, `${base}.manifest.json`)
    fs.writeFileSync(out, JSON.stringify(manifest, null, 2), 'utf8')

    const fields = manifest.fields
    const autoCount = fields.filter((f) => f.autoDetected).length
    const pendingCount = manifest.pendingManual.length
    const commonPaths = new Set(fields.map((f) => f.commonPath).filter(Boolean))
    for (const p of commonPaths) {
      report.summary.commonPathUsage[p] = (report.summary.commonPathUsage[p] || 0) + 1
    }
    report.summary.totalFields += fields.length
    report.summary.autoDetectedFields += autoCount
    report.summary.pendingManualFields += pendingCount

    report.templates.push({
      file,
      title: manifest.name,
      fields: fields.map((f) => ({
        name: f.name,
        commonPath: f.commonPath,
        autoDetected: f.autoDetected
      })),
      pendingManual: manifest.pendingManual.map((f) => f.name),
      mappings: manifest.mappings.length
    })
    if (pendingCount > 0) {
      report.manualReview.push({
        file,
        fields: manifest.pendingManual.map((f) => ({ name: f.name, label: f.label, reason: f.reason || '待人工确认' }))
      })
    }
  }

  report.summary.autoDetectionRate = report.summary.totalFields
    ? Number((report.summary.autoDetectedFields / report.summary.totalFields).toFixed(4))
    : 0
  report.summary.autoDetectionPercent = `${(report.summary.autoDetectionRate * 100).toFixed(1)}%`

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify({
    generated: REPORT_PATH,
    manifests: `${files.length} 份`,
    totalFields: report.summary.totalFields,
    autoDetected: report.summary.autoDetectedFields,
    pendingManual: report.summary.pendingManualFields,
    autoDetectionRate: report.summary.autoDetectionPercent,
    commonPathUsage: report.summary.commonPathUsage
  }, null, 2))
}

main()
