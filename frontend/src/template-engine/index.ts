import type { ResumeTemplate, SchemaNode } from '@/types'

/**
 * 受控模板渲染引擎。
 *
 * 安全约束：
 * 1. 只允许模板 HTML 中引用 schema 白名单内的字段路径；
 * 2. 所有插值值做 HTML 转义；
 * 3. 最终 HTML 经 sanitizeHtml 消毒后才会被 v-html 渲染，不允许执行任意 JS。
 */

export function renderTemplate(template: ResumeTemplate, data: Record<string, unknown>): string {
  const rendered = renderSegment(template.html, data, data, [], template.schema)
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
