/**
 * 生成模板市场目录：为所有内置模板（cv2/p03–p13 + docs/template 110 份静态模板）
 * 生成中文名称、分类与标签，并提取主色/风格信息供市场卡片使用。
 *
 * 输出：
 *   backend/com.resume.api/src/main/resources/template-market-catalog.json
 *   docs/template-market-catalog.json（同内容，便于人工核对）
 *
 * 用法：node scripts/build-market-catalog.js
 */
'use strict'

const fs = require('fs')
const path = require('path')

const TEMPLATE_DIR = path.join(__dirname, '..', 'docs', 'template')
const BUILTIN_DIR = path.join(
  __dirname,
  '..',
  'backend',
  'com.resume.api',
  'src',
  'main',
  'resources',
  'templates'
)
const OUT_BACKEND = path.join(
  __dirname,
  '..',
  'backend',
  'com.resume.api',
  'src',
  'main',
  'resources',
  'template-market-catalog.json'
)
const OUT_DOCS = path.join(__dirname, '..', 'docs', 'template-market-catalog.json')

/** 内置占位符模板 -> 对应静态 HTML 模板（用于取名与分类） */
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

const STYLE_SEGMENTS = [
  '极简', '极简灰度', '简约', '暗色', '终端暗色', '庄重', '庄重正式版', '正式', '正式庄重',
  '传统商务', '传统商务深蓝', '商务深蓝', '黑白灰', '黑白', '金棕', '深墨绿', '低调硬核',
  '硬核', '手绘留白风格', '手绘', '留白', '清爽', '清爽留白', '现代', '几何', '几何撞色版',
  '杂志', '代码风', '等宽', '时间轴', '活力', '年轻活力版', '年轻活力', '动态非对称设计',
  '动态', '非对称', '非对称设计', '撞色', '简洁现代', '灰度', '视觉方案', '庄重无彩色',
  '保守专业深灰基调', '高对比度黑白', '终端', '暗色终端', '传统', '严肃', '专业', '艺术',
  '商业', '商务', '大厂校招', '校招', '社交', '社交媒体', '设计', '严谨稳重', '严谨稳重版',
  '严谨稳重黑白灰', '极简灰调等宽', '极简灰度等宽', '时间轴排版', '简约现代'
]

const NAME_STOPWORDS = ['简历', '模板', '视觉方案', '作品集', '更新']

function isPureCjkName(seg) {
  return /^[\u4e00-\u9fa5]{2,3}$/.test(seg)
}

function cleanName(raw) {
  if (!raw) return ''
  let name = String(raw)
  for (const w of NAME_STOPWORDS) {
    name = name.split(w).join('')
  }
  name = name.replace(/[【】\[\]]/g, ' ').replace(/[·|｜\-—]/g, '·')
  let segments = name
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
  // 去掉开头/结尾的风格描述词
  while (segments.length > 1 && STYLE_SEGMENTS.includes(segments[segments.length - 1])) {
    segments.pop()
  }
  // 去掉结尾的人名（2-3 个纯中文，且前一段像职位名）
  while (
    segments.length > 1 &&
    isPureCjkName(segments[segments.length - 1]) &&
    /[师员理监顾官设开编策运店主主院教组]/.test(segments[segments.length - 2])
  ) {
    segments.pop()
  }
  // 去掉开头的人名（2-4 个纯中文且后面还有内容）
  while (segments.length > 1 && isPureCjkName(segments[0])) {
    segments.shift()
  }
  return segments.join(' · ').replace(/^[·\s]+|[·\s]+$/g, '').trim()
}

const CATEGORY_RULES = [
  {
    category: '金融',
    keywords: ['投行', '投资银行', 'PE/VC', 'PE', 'VC', '量化', '交易员', '保险精算', '精算',
      '财务', '审计', '税务', '对公客户', '财富管理', '融资', '并购', '证券', '基金', '资管',
      '风控', '信贷', '会计师', '财务总监', '估值', '股权投资', '投后']
  },
  {
    category: '法律合规',
    keywords: ['法务', '律师', '律所', '合规']
  },
  {
    category: '互联网技术',
    keywords: ['后端', '前端', '全栈', '开发', '数据科学', '算法', 'DevOps', 'SRE', '测试',
      '数据库', '运维', '嵌入式', '软件', '工程师', 'AI 研究员', '量化开发',
      '航天器控制系统', '军工软件', '网络安全', '渗透', 'DevOps/SRE']
  },
  {
    category: '设计创意',
    keywords: ['UI/UX', 'UI', 'UX', '设计师', '品牌', '视觉', '插画', '动画', '建筑', '室内',
      '空间设计', '室内建筑', '时尚', '服装', '买手', '原画', '影视美术', '摄影师', '摄影',
      '花艺', '创意', '艺术', '工业设计', '美术']
  },
  {
    category: '学术科研',
    keywords: ['高校', '教师', '副教授', '教授', '学术', '研究', '实验室', '科研']
  },
  {
    category: '市场营销',
    keywords: ['招聘', 'HR', '人力资源', '薪酬', '绩效', '营销', '新媒体', '公关', '电商', '运营',
      '增长', '记者', '编辑', '产品经理', '产品总监', '品牌策划', '培训', '教育', '留学顾问',
      '讲师', '课程产品', '游戏运营', '体育营销', '本地化', '筹款', '传播']
  },
  {
    category: '销售服务',
    keywords: ['销售', '客户经理', '酒店', '餐厅', '餐饮', '零售', '旅游', '奢侈品', '医械',
      '医疗器械销售', '运动员经纪人', '大堂经理', '店长', '区域经理', '商品',
      '甜品', '主厨', '厨师']
  },
  {
    category: '政府行政',
    keywords: ['公务员', '国企', '政府事务', '军官', '医院行政', '行政', '物业', '工程项目',
      '工程造价', '生产', '质量', '供应链', '物流', '农技', '农业', '厂长', '总经理']
  },
  {
    category: '咨询',
    keywords: ['咨询', '顾问', 'MBB', '商业分析', '战略', '分析师', '咨询总监']
  }
]

function classify(name, rawName) {
  const text = (name + ' ' + cleanName(rawName)).toLowerCase()
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        return rule.category
      }
    }
  }
  return '通用商务'
}

function extractColors(css) {
  const hexes = []
  const re = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
  let m
  while ((m = re.exec(css || '')) && hexes.length < 6) {
    hexes.push(m[0])
  }
  // 去掉近似白色/黑色背景后取前几个
  const meaningful = hexes.filter(
    (h) => !['#ffffff', '#fff', '#000000', '#000'].includes(h.toLowerCase())
  )
  return meaningful.length >= 2 ? meaningful.slice(0, 2) : (meaningful.length === 1 ? [meaningful[0], meaningful[0]] : [])
}

function styleTags(css, name) {
  const cssLower = (css || '').toLowerCase()
  const nameLower = (name || '').toLowerCase()
  const tags = []
  const add = (t) => {
    if (!tags.includes(t)) tags.push(t)
  }
  if (/monospace|consolas|menlo|jetbrains|courier|fira code/.test(cssLower)) add('等宽字体')
  if (/(terminal|#0d0d0d|#0a0a0a|#111111|#16181d)/.test(cssLower) && /(consolas|monospace|menlo)/.test(cssLower)) add('终端暗色')
  if (/georgia|times new roman|serif/.test(cssLower)) add('杂志报刊')
  if (/linear-gradient/.test(cssLower)) add('渐变')
  if (/grid-template-columns|float:\s*left|width:\s*(28|30|32|35|38|40)%/.test(cssLower)) add('双栏')
  if (/sidebar|aside/.test(cssLower)) add('侧栏')
  if (/timeline|::before[\s\S]{0,120}(circle|dot)/.test(cssLower) || /\.timeline/.test(cssLower)) add('时间轴')
  if (/doodle|sketch|hand|wobbly|rotate\(-?[123]/i.test(cssLower)) add('手绘')
  if (/^#1a3c34|#1a3c34|teal/.test(cssLower) || /#1a3c34/.test(cssLower)) add('深墨绿')
  if (/b8864a|#b8864a|#c9a063|#b08d57/.test(cssLower)) add('金棕')
  if (/(#1a2b3c|#0f172a|#1e293b|#16324a|#1c2b3a)/.test(cssLower)) add('商务深蓝')
  if (/(#f5f5f5|#fafafa|#e5e5e5|#d1d5db)/.test(cssLower) && /(#333333|#444|#111|#1a1a1a)/.test(cssLower)) add('极简灰度')
  if (/#ff6b6b|#f25c54|#ff4d6d|#f94144|#ff595e/.test(cssLower)) add('高饱和撞色')
  if (/#e63946|#d62828/.test(cssLower)) add('红黑')
  if (/grain|noise|texture|paper/.test(cssLower)) add('纸质纹理')
  if (/(#fdf6ec|#faf3e8|#f6efe6)/.test(cssLower)) add('米白纸感')
  if (/['"]楷体|['"]kaiti|['"]宋体|['"]songti|serif/.test(cssLower) && /#e63946|#b01e1e/.test(cssLower)) add('中国风')
  if (/(#0e7490|#0891b2|#06b6d4|#0ea5e9)/.test(cssLower)) add('清新蓝')
  if (/(#84cc16|#65a30d|#4d7c0f|#3f6212)/.test(cssLower)) add('自然绿')
  if (/黑金|black.?gold|#d4af37/.test(cssLower) || /#d4af37/.test(cssLower)) add('黑金')
  if (/terminal|prompt|>\s|λ|❯/.test(nameLower)) add('终端风格')
  if (tags.length === 0) {
    const colors = extractColors(css)
    if (colors.length) add('色彩鲜明')
    else add('简约')
  }
  return tags
}

function industryTags(category, name, rawName) {
  const text = (name + ' ' + rawName).toLowerCase()
  const tags = []
  const map = [
    [/投行|投资银行|PE|VC|并购|融资/i, '投行'],
    [/量化|交易员/, '量化交易'],
    [/财务|审计|税务|会计师/, '财会审计'],
    [/精算|保险/, '保险精算'],
    [/银行|对公/, '银行'],
    [/咨询|顾问|MBB|商业分析/, '咨询'],
    [/前端/, '前端'],
    [/后端|全栈|软件|开发/, '后端'],
    [/数据科学|数据/, '数据科学'],
    [/算法/, '算法'],
    [/DevOps|SRE|运维|部署/i, 'DevOps'],
    [/测试/, '测试'],
    [/安全|渗透/, '网络安全'],
    [/UI|UX|界面|交互/i, 'UI/UX'],
    [/品牌|视觉/, '品牌视觉'],
    [/插画/, '插画'],
    [/建筑|室内/, '空间设计'],
    [/时尚|买手|服装/, '时尚买手'],
    [/摄影/, '摄影'],
    [/动画|原画/, '动画/原画'],
    [/教师|高校|学术|研究/, '学术科研'],
    [/人力资源|HR|招聘|薪酬|绩效/i, '人力资源'],
    [/营销|新媒体|公关|市场/, '市场营销'],
    [/运营|增长/, '运营增长'],
    [/产品/, '产品'],
    [/销售/, '销售'],
    [/公务员|政府/, '政府'],
    [/法务|律师|合规/, '法律合规'],
    [/工程|造价/, '工程'],
    [/供应链|物流/, '供应链'],
    [/教育|培训|讲师|留学/, '教育培训']
  ]
  for (const [re, tag] of map) {
    if (re.test(text) && !tags.includes(tag)) tags.push(tag)
  }
  if (tags.length === 0) {
    tags.push(category)
  }
  return tags.slice(0, 4)
}

function readManifests() {
  const out = {}
  const files = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.manifest.json')).sort()
  for (const f of files) {
    const manifest = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, f), 'utf8'))
    out[manifest.templateId || f.replace(/\.manifest\.json$/, '')] = {
      rawName: manifest.name || f,
      sourceFile: manifest.sourceFile || f,
      css: fs.readFileSync(
        path.join(TEMPLATE_DIR, (manifest.sourceFile || f).replace(/\.manifest\.json$/, '.html')),
        'utf8'
      )
    }
  }
  return out
}

function readBuiltins() {
  const out = {}
  const files = fs.readdirSync(BUILTIN_DIR).filter((f) => f.startsWith('template-') && f.endsWith('.json')).sort()
  for (const f of files) {
    const t = JSON.parse(fs.readFileSync(path.join(BUILTIN_DIR, f), 'utf8'))
    out[t.code] = { rawName: t.name, sourceFile: f, css: t.css || '' }
  }
  return out
}

function main() {
  const templates = { ...readBuiltins(), ...readManifests() }
  const catalog = {}
  for (const [code, tpl] of Object.entries(templates)) {
    const sourceCode = BUILTIN_SOURCE[code]
    const sourceName = sourceCode && templates[sourceCode] ? templates[sourceCode].rawName : tpl.rawName
    const name = cleanName(sourceName) || code
    const category = classify(name, sourceName)
    const tags = [...new Set([...styleTags(tpl.css, name), ...industryTags(category, name, sourceName)])]
    const colors = extractColors(tpl.css)
    catalog[code] = {
      name,
      category,
      tags,
      colors
    }
  }
  const payload = JSON.stringify(catalog, null, 2) + '\n'
  fs.mkdirSync(path.dirname(OUT_BACKEND), { recursive: true })
  fs.writeFileSync(OUT_BACKEND, payload, 'utf8')
  fs.writeFileSync(OUT_DOCS, payload, 'utf8')
  console.log(`catalog generated: ${Object.keys(catalog).length} templates -> ${OUT_BACKEND}`)
}

main()
