import type {
  ResumeCommonData,
  ResumeExtendedData,
  ResumeTemplate,
  SchemaNode,
  TemplateManifest,
  TemplateMapping
} from '@/types'

/** 渲染上下文：目前只有一个保留变量 resumeTitle（简历标题，属于元数据，不放进简历 data） */
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
  data: Record<string, unknown>,
  context: RenderContext = {}
): string {
  const root: Record<string, unknown> = { ...data }
  if (context.resumeTitle !== undefined) {
    root.resumeTitle = context.resumeTitle
  }
  const rendered = renderSegment(template.html, root, root, [], template.schema ?? {})
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
    if (open === -1) {
      return -1
    }
    const close = html.indexOf('}}', open + 2)
    if (close === -1) {
      return -1
    }
    const token = html.slice(open + 2, close).trim()
    if (token.startsWith('#each ')) {
      depth++
    } else if (token === '/each') {
      depth--
      if (depth === 0) {
        return open
      }
    }
    i = close + 2
  }
  return -1
}

function isPathAllowed(schema: SchemaNode, parts: string[]): boolean {
  // 保留变量：简历标题来自渲染上下文，不参与 data 的 schema 白名单校验
  if (parts.length === 1 && parts[0] === 'resumeTitle') {
    return true
  }
  let node: SchemaNode | undefined = schema
  for (const part of parts) {
    if (!node || typeof node !== 'object') {
      return false
    }
    if (node.type === 'array') {
      node = node.items
    }
    node = node?.properties?.[part]
    if (!node) {
      return false
    }
  }
  return true
}

function resolveValue(path: string, scope: unknown, root: Record<string, unknown>): unknown {
  if (path === '.') {
    return scope
  }
  const parts = path.split('.')
  for (const source of [scope, root]) {
    const value = lookup(source, parts)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

function lookup(source: unknown, parts: string[]): unknown {
  let node: unknown = source
  for (const part of parts) {
    if (node === null || typeof node !== 'object') {
      return undefined
    }
    node = (node as Record<string, unknown>)[part]
    if (node === undefined) {
      return undefined
    }
  }
  return node
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(stringify).join(', ')
  }
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

/**
 * DOM 消毒：移除脚本类标签、事件属性、危险协议属性与 style 属性。
 * 不新增第三方依赖（AGENTS.md 要求新增依赖先问用户），后续可替换为 DOMPurify。
 */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return ''
  }
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

/**
 * 占位符模板：把公共数据 + 扩展数据按 manifest 字段定义拍平成模板插值所需的扁平对象。
 * 例如 commonData.basic.name -> { name }；skills（对象数组）按 transform='name' 转为字符串数组。
 */
export function buildViewModel(
  commonData: ResumeCommonData,
  extendedData: ResumeExtendedData,
  manifest?: TemplateManifest | null
): Record<string, unknown> {
  const viewModel: Record<string, unknown> = {}
  for (const field of manifest?.fields ?? []) {
    const value = field.commonPath
      ? getPath(commonData as unknown as Record<string, unknown>, field.commonPath)
      : extendedData?.[field.name]
    viewModel[field.name] = applyTransform(value, field.transform)
  }
  return viewModel
}

function applyTransform(value: unknown, transform?: string): unknown {
  if (!transform || !Array.isArray(value)) {
    return value
  }
  if (transform === 'name') {
    return value.map((item) =>
      item !== null && typeof item === 'object'
        ? (item as Record<string, unknown>).name ?? ''
        : item
    )
  }
  return value
}

/**
 * 静态模板渲染：保留原 HTML（示例数据），再把公共数据/扩展数据按 manifest 映射回填到 DOM。
 * - selector 精确命中；sectionTitle + itemSelector 按区块标题定位列表；
 * - 数组数据按 children 模式克隆首个子元素填充；
 * - 最终结果仍经过 sanitizeHtml 消毒。
 */
export function renderStaticTemplate(
  template: ResumeTemplate,
  commonData: ResumeCommonData,
  extendedData: ResumeExtendedData
): string {
  const manifest = template.manifest
  if (!manifest) {
    return sanitizeHtml(template.html)
  }
  if (typeof DOMParser === 'undefined') {
    return ''
  }
  const doc = new DOMParser().parseFromString(`<div id="__resume_static">${template.html}</div>`, 'text/html')
  const root = doc.getElementById('__resume_static')
  if (!root) {
    return sanitizeHtml(template.html)
  }
  applyMappings(doc, manifest, commonData, extendedData)
  return sanitizeHtml(root.innerHTML)
}

function applyMappings(
  doc: Document,
  manifest: TemplateManifest,
  commonData: ResumeCommonData,
  extendedData: ResumeExtendedData
) {
  for (const mapping of manifest.mappings) {
    const value = mapping.commonPath
      ? getPath(commonData as unknown as Record<string, unknown>, mapping.commonPath)
      : extendedData?.[mapping.field ?? mapping.commonPath ?? '']
    if (isEmptyValue(value)) {
      continue
    }
    const targets = resolveTargets(doc, mapping)
    if (targets.length === 0) {
      continue
    }
    fillTargets(targets, mapping, value)
  }
}

function resolveTargets(doc: Document, mapping: TemplateMapping): Element[] {
  if (mapping.selector) {
    return Array.from(doc.querySelectorAll(mapping.selector))
  }
  if (mapping.sectionTitle) {
    const titleEl = Array.from(
      doc.querySelectorAll('.section-title, .section h2, .section h3')
    ).find((el) => normalizeText(el.textContent) === normalizeText(mapping.sectionTitle))
    if (!titleEl) {
      return []
    }
    if (mapping.itemSelector) {
      return collectSectionItems(titleEl, mapping.itemSelector)
    }
    const blocks: Element[] = []
    let node = titleEl.nextElementSibling
    while (node && !isSectionHeading(node)) {
      blocks.push(node)
      node = node.nextElementSibling
    }
    return blocks.slice(0, 1)
  }
  return []
}

function collectSectionItems(titleEl: Element, itemSelector: string): Element[] {
  const items: Element[] = []
  let node = titleEl.nextElementSibling
  while (node) {
    if (isSectionHeading(node)) {
      break
    }
    if (node.matches(itemSelector)) {
      items.push(node)
    }
    if (node.querySelectorAll) {
      node.querySelectorAll(itemSelector).forEach((el) => {
        if (!items.includes(el)) {
          items.push(el)
        }
      })
    }
    node = node.nextElementSibling
  }
  return items
}

function isSectionHeading(el: Element): boolean {
  return (
    el.classList.contains('section-title') ||
    ((el.tagName === 'H2' || el.tagName === 'H3') &&
      el.parentElement?.classList.contains('section') === true)
  )
}

function fillTargets(targets: Element[], mapping: TemplateMapping, value: unknown) {
  if (Array.isArray(value) && mapping.attribute === 'children') {
    for (const container of targets) {
      fillList(container, mapping, value)
    }
    return
  }
  const index = mapping.index != null ? mapping.index - 1 : -1
  const itemValue = Array.isArray(value)
    ? resolveArrayItem(value, index, mapping.attribute)
    : value
  const target = index >= 0 ? targets[index] ?? targets[0] : targets[0]
  if (!target) {
    return
  }
  setElementValue(target, mapping.attribute, stringifyValue(itemValue))
}

function resolveArrayItem(value: unknown[], index: number, attribute: string): unknown {
  const item = index >= 0 && index < value.length ? value[index] : value[0]
  if (item !== null && typeof item === 'object') {
    const obj = item as Record<string, unknown>
    if (attribute === 'href' || attribute === 'src') {
      return obj.url ?? obj.link ?? ''
    }
    return obj.url ?? obj.platform ?? obj.name ?? ''
  }
  return item
}

function fillList(container: Element, mapping: TemplateMapping, value: unknown[]) {
  const firstChild = mapping.itemSelector
    ? container.querySelector(mapping.itemSelector)
    : firstElementChild(container)
  if (!firstChild) {
    return
  }
  container.innerHTML = ''
  for (const item of value) {
    const clone = firstChild.cloneNode(true) as Element
    if (typeof item === 'string') {
      clone.textContent = item
    } else if (item !== null && typeof item === 'object') {
      fillObjectInto(clone, item as Record<string, unknown>)
    }
    container.appendChild(clone)
  }
}

function fillObjectInto(el: Element, item: Record<string, unknown>) {
  const aliasMap: Record<string, string[]> = {
    school: ['school', 'edu-school'],
    company: ['company', 'institution', 'entry-org'],
    position: ['position', 'role', 'job-title', 'entry-subtitle'],
    degree: ['degree', 'edu-degree'],
    name: ['name', 'project-name', 'project-title'],
    date: ['date', 'date-location', 'date-range', 'entry-date', 'edu-date', 'time'],
    description: ['desc', 'description', 'desc-list', 'entry-details', 'details', 'bullet', 'summary'],
    level: ['level', 'lang-level', 'proficiency']
  }
  let filled = false
  for (const [key, tokens] of Object.entries(aliasMap)) {
    const raw = item[key]
    if (isEmptyValue(raw)) {
      continue
    }
    const targetEl = findByToken(el, tokens)
    if (targetEl) {
      if (key === 'description' && targetEl.tagName === 'UL') {
        fillDescriptionList(targetEl, raw)
      } else {
        targetEl.textContent = stringifyValue(raw)
      }
      filled = true
    }
  }
  if (!filled) {
    const description = item.description ?? item.name ?? ''
    el.textContent = stringifyValue(description)
  }
}

function fillDescriptionList(ul: Element, raw: unknown) {
  const values = Array.isArray(raw) ? raw.map(stringifyValue) : [stringifyValue(raw)]
  ul.innerHTML = ''
  for (const text of values) {
    const li = document.createElement('li')
    li.textContent = text
    ul.appendChild(li)
  }
}

function findByToken(el: Element, tokens: string[]): Element | null {
  const candidates = [el, ...Array.from(el.querySelectorAll('*'))]
  for (const candidate of candidates) {
    for (const token of tokens) {
      if (candidate.classList.contains(token)) {
        return candidate
      }
    }
  }
  return null
}

function setElementValue(el: Element, attribute: string, value: string) {
  if (attribute === 'href' || attribute === 'src') {
    if (value) {
      el.setAttribute(attribute, value)
    }
  } else if (attribute === 'children') {
    el.textContent = value
  } else {
    el.textContent = value
  }
}

function getPath(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let node: unknown = root
  for (const part of parts) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      return undefined
    }
    node = (node as Record<string, unknown>)[part]
    if (node === undefined) {
      return undefined
    }
  }
  return node
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true
  }
  if (typeof value === 'string') {
    return value.trim() === ''
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return false
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(', ')
  }
  return ''
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function firstElementChild(el: Element): Element | null {
  let node: Element | null = el.firstElementChild
  while (node) {
    return node
  }
  return null
}
