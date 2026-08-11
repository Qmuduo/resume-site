import type {
  ResumeData,
  ResumeSection,
  ResumeSectionItem,
  ResumeTemplate,
  SchemaNode,
  TemplateBlock,
  TemplateManifestV2
} from '@/types'

/** 渲染上下文：简历标题等元数据，不放进简历 data */
export interface RenderContext {
  resumeTitle?: string
}

/**
 * 受控模板渲染引擎。
 *
 * 安全约束：
 * 1. 只允许模板 HTML 中引用 schema 白名单内的字段路径；
 * 2. 所有插值值做 HTML 转义；
 * 3. 最终 HTML 经 sanitizeHtml 消毒后才会被 v-html 渲染，不允许执行任意 JS。
 */

export function renderTemplate(
  template: ResumeTemplate,
  data: unknown,
  context: RenderContext = {}
): string {
  const manifest = template.manifest
  if (manifest && 'renderMode' in manifest && manifest.renderMode === 'semantic') {
    return renderSemanticTemplate(template, data as ResumeData)
  }
  return renderPlaceholder(template, data as Record<string, unknown>, context)
}

// ============ 语义渲染（manifest v2） ============

/** 语义区块 -> 条目字段类名别名表 */
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'project-name', 'company', 'network', 'school', 'organization', 'issuer', 'project-title'],
  headline: ['headline', 'job-title', 'position', 'role', 'degree', 'major', 'entry-subtitle'],
  school: ['school', 'edu-school'],
  degree: ['degree', 'edu-degree'],
  period: ['period', 'date', 'entry-meta', 'date-location', 'entry-date', 'time'],
  description: ['description', 'entry-body', 'details', 'summary', 'desc', 'bullet'],
  level: ['level', 'lang-level', 'proficiency']
}

function findByToken(el: Element, tokens: string[]): Element | null {
  for (const token of tokens) {
    const hit = el.classList.contains(token) ? el : el.querySelector(`.${token}`)
    if (hit) return hit
  }
  return null
}

function setText(el: Element | null, value: unknown) {
  if (!el) return
  const text = Array.isArray(value)
    ? value.map((v) => String(v ?? '')).join(', ')
    : String(value ?? '')
  el.textContent = text
}

function fillItem(itemEl: Element, item: ResumeSectionItem) {
  for (const [key, tokens] of Object.entries(FIELD_ALIASES)) {
    setText(findByToken(itemEl, tokens), item[key])
  }
  const description = item['description']
  const body = findByToken(itemEl, ['entry-body', 'details', 'description'])
  if (body && typeof description === 'string' && description.includes('<')) {
    body.innerHTML = sanitizeRichText(description)
  }
}

function fillSection(
  container: Element,
  section: { title: string; items: ResumeSectionItem[] }
) {
  setText(container.querySelector('.section-title'), section.title)
  const itemsEl = container.querySelector('.section-items') ?? container
  const skillTag = itemsEl.querySelector('.skill-tag')
  if (skillTag) {
    itemsEl.innerHTML = ''
    for (const item of section.items) {
      const clone = skillTag.cloneNode(true) as Element
      clone.textContent = [item['name'], item['level']].filter(Boolean).join(' · ')
      itemsEl.appendChild(clone)
    }
    return
  }
  const first = itemsEl.querySelector('.entry, [data-entry]')
  if (!first) return
  itemsEl.innerHTML = ''
  for (const item of section.items) {
    const clone = first.cloneNode(true) as Element
    fillItem(clone, item)
    itemsEl.appendChild(clone)
  }
}

function fillSummary(container: Element, summary: ResumeData['summary']) {
  if (!summary) return
  setText(container.querySelector('.section-title'), summary.title)
  const body = container.querySelector('.entry-body, .section-items, p')
  if (!body) return
  if (summary.content.includes('<')) {
    body.innerHTML = sanitizeRichText(summary.content)
  } else {
    body.textContent = summary.content
  }
}

function fillHeader(header: Element, data: ResumeData) {
  if (!data || !data.basics) return
  setText(header.querySelector('.name'), data.basics.name)
  setText(header.querySelector('.headline'), data.basics.headline)
  const list = header.querySelector('.contact-list')
  if (!list) return
  const first = list.firstElementChild
  const items = [
    data.basics.email,
    data.basics.phone,
    data.basics.location,
    ...data.basics.customFields.map((f) => f.text)
  ].filter(Boolean)
  list.innerHTML = ''
  for (const text of items) {
    const el = first ? (first.cloneNode(true) as Element) : document.createElement('span')
    el.classList.add('contact-item')
    el.textContent = text
    list.appendChild(el)
  }
}

function resolveContainer(root: Element, block: TemplateBlock): Element | null {
  if (block.selector) {
    try {
      return root.querySelector(block.selector)
    } catch {
      return null
    }
  }
  if (block.sectionTitle) {
    const titleEl = Array.from(root.querySelectorAll('.section-title')).find(
      (el) => normalizeText(el.textContent) === normalizeText(block.sectionTitle ?? '')
    )
    return titleEl?.parentElement ?? null
  }
  return null
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function themeCss(data: ResumeData, templateCss: string): string {
  const c = data.metadata.design.colors
  const t = data.metadata.typography
  const p = data.metadata.page
  const vars = [
    `--color-primary:${c.primary};`,
    `--color-background:${c.background};`,
    `--color-text:${c.text};`,
    `--font-heading:${t.headingFont};`,
    `--font-body:${t.bodyFont};`,
    `--font-size-base:${t.fontSize}pt;`,
    `--page-margin:${p.margin}px;`
  ].join('')
  const custom = data.metadata.stylesheet ? sanitizeCss(data.metadata.stylesheet) : ''
  return `:root{${vars}}${custom}${templateCss}`
}

export function renderSemanticTemplate(template: ResumeTemplate, data: ResumeData): string {
  if (!data || !data.basics || !data.metadata) {
    return sanitizeHtml(template.html ?? '')
  }
  const manifest = template.manifest as TemplateManifestV2 | null
  if (!manifest || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div id="__resume_root">${template.html ?? ''}</div>`, 'text/html')
  const root = doc.getElementById('__resume_root')
  if (!root) return ''

  const header = root.querySelector('.resume-header')
  if (header) fillHeader(header, data)

  for (const block of manifest.blocks ?? []) {
    const container = resolveContainer(root, block)
    if (!container) continue
    if (block.type === 'summary') {
      fillSummary(container, data.summary)
    } else {
      const section = data.sections[block.type]
      if (section) fillSection(container, section)
    }
  }

  const customHost = root.querySelector('[data-section="custom"]')
  if (customHost && data.customSections.length > 0) {
    for (const cs of data.customSections) {
      const sectionEl = document.createElement('div')
      sectionEl.className = 'section'
      sectionEl.innerHTML = '<div class="section-title"></div><div class="section-items"></div>'
      fillSection(sectionEl, cs as unknown as ResumeSection)
      customHost.appendChild(sectionEl)
    }
  }

  const html = root.innerHTML
  const css = themeCss(data, template.css ?? '')
  return `<style>${sanitizeCss(css)}</style>${sanitizeHtml(html)}`
}

// ============ 占位符渲染（{{field}} / {{#each}}，供 AI 占位模板使用） ============

export function renderPlaceholder(
  template: ResumeTemplate,
  data: Record<string, unknown>,
  context: RenderContext = {}
): string {
  const root: Record<string, unknown> = { ...data }
  if (context.resumeTitle !== undefined) {
    root.resumeTitle = context.resumeTitle
  }
  const rendered = renderSegment(template.html ?? '', root, root, [], template.schema ?? {})
  return sanitizeHtml(rendered)
}

function renderSegment(
  html: string,
  root: Record<string, unknown>,
  scope: unknown,
  scopePath: string[],
  schema: SchemaNode
): string {
  let out = ''
  let i = 0

  while (i < html.length) {
    const open = html.indexOf('{{', i)
    if (open === -1) {
      out += html.slice(i)
      break
    }
    const close = html.indexOf('}}', open + 2)
    if (close === -1) {
      out += html.slice(i)
      break
    }
    out += html.slice(i, open)

    const token = html.slice(open + 2, close).trim()
    if (token.startsWith('#each ')) {
      const path = token.slice('#each '.length).trim()
      const bodyStart = close + 2
      const bodyEnd = findEachEnd(html, bodyStart)
      if (bodyEnd === -1) {
        out += html.slice(open)
        break
      }
      const nextScopePath = [...scopePath, ...path.split('.')]
      if (isPathAllowed(schema, nextScopePath)) {
        const items = resolveValue(path, scope, root)
        if (Array.isArray(items)) {
          for (const item of items) {
            out += renderSegment(html.slice(bodyStart, bodyEnd), root, item, nextScopePath, schema)
          }
        }
      }
      const closeTokenEnd = html.indexOf('}}', bodyEnd)
      i = closeTokenEnd === -1 ? bodyEnd + '{{/each}}'.length : closeTokenEnd + 2
    } else {
      if (token === '.' || isPathAllowed(schema, [...scopePath, ...token.split('.')])) {
        out += escapeHtml(stringify(resolveValue(token, scope, root)))
      }
      i = close + 2
    }
  }

  return out
}

function findEachEnd(html: string, from: number): number {
  let depth = 1
  let i = from
  while (i < html.length) {
    const open = html.indexOf('{{', i)
    if (open === -1) return -1
    const close = html.indexOf('}}', open + 2)
    if (close === -1) return -1
    const token = html.slice(open + 2, close).trim()
    if (token.startsWith('#each ')) {
      depth++
    } else if (token === '/each') {
      depth--
      if (depth === 0) return open
    }
    i = close + 2
  }
  return -1
}

function isPathAllowed(schema: SchemaNode, parts: string[]): boolean {
  if (parts.length === 1 && parts[0] === 'resumeTitle') {
    return true
  }
  let node: SchemaNode | undefined = schema
  for (const part of parts) {
    if (!node || typeof node !== 'object') return false
    if (node.type === 'array') {
      node = node.items
    }
    node = node?.properties?.[part]
    if (!node) return false
  }
  return true
}

function resolveValue(path: string, scope: unknown, root: Record<string, unknown>): unknown {
  if (path === '.') return scope
  const parts = path.split('.')
  for (const source of [scope, root]) {
    const value = lookup(source, parts)
    if (value !== undefined) return value
  }
  return undefined
}

function lookup(source: unknown, parts: string[]): unknown {
  let node: unknown = source
  for (const part of parts) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
    if (node === undefined) return undefined
  }
  return node
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) return value.map(stringify).join(', ')
  return ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ============ 消毒 ============

/**
 * DOM 消毒：移除脚本类标签、事件属性、危险协议属性与 style 属性。
 * 不新增第三方依赖（AGENTS.md 要求新增依赖先问用户），后续可替换为 DOMPurify。
 */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const removeTags = [
    'script',
    'iframe',
    'object',
    'embed',
    'link',
    'meta',
    'style',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'template',
    'base',
    'frame',
    'frameset'
  ]
  doc.querySelectorAll(removeTags.join(',')).forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((el) => {
    const element = el as Element
    Array.from(element.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || name === 'style') {
        element.removeAttribute(attr.name)
        return
      }
      if (name === 'href' || name === 'src' || name === 'xlink:href') {
        if (
          value.startsWith('javascript:') ||
          value.startsWith('data:') ||
          value.startsWith('vbscript:')
        ) {
          element.removeAttribute(attr.name)
        }
      }
    })
  })
  return doc.body.innerHTML
}

/** CSS 消毒：防止通过样式字符串逃逸出 style 元素或执行脚本。 */
export function sanitizeCss(css: string): string {
  return css
    .replace(/<\/style/gi, '')
    .replace(/<script/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/@import/gi, '')
    .replace(/url\s*\(/gi, '')
    .replace(/>/g, '')
}

/** 富文本消毒：白名单外标签一律移除，仅保留基础排版。 */
export function sanitizeRichText(html: string): string {
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const allowed = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a'])
  doc.querySelectorAll('*').forEach((node) => {
    const el = node as Element
    if (!allowed.has(el.tagName.toLowerCase())) {
      el.replaceWith(...Array.from(el.childNodes))
      return
    }
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || (name === 'href' && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name)
      }
      if (name !== 'href' && name !== 'target') el.removeAttribute(attr.name)
    })
  })
  return doc.body.innerHTML
}

/** 兼容旧静态模板预览（阶段二后仅模板市场在用，Task 26 移除）。 */
export function renderStaticTemplate(template: ResumeTemplate): string {
  return sanitizeHtml(template.html ?? '')
}
