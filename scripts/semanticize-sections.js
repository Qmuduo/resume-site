'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.resolve(__dirname, '../docs/template');

// 区块标题 -> ResumeData section 类型
const TITLE_MAP = [
  [/个人简介|专业摘要|专业概述|个人概述|核心优势|自我评价|职业概述|个人总结|职业概要/, 'summary'],
  [/工作经历|工作经验|专业经历|职业经历|实习经历|相关经历/, 'experience'],
  [/教育背景|教育经历|^教育$/, 'education'],
  [/技能清单|核心能力|专业技能|专业能力|技术能力|技能栈|技能/, 'skills'],
  [/项目经验|项目成果|参与项目|重点项目|精选项目|项目实践|开源项目|竞赛与开源项目|^项目$/, 'projects'],
  [/证书与语言|语言与证书|资格证书|资质证书|证书|资质|培训与表彰|表彰/, 'certifications'],
  [/语言能力|^语言$/, 'languages'],
  [/兴趣爱好|兴趣/, 'interests'],
  [/荣誉奖项|获奖|奖项/, 'awards'],
  [/研究领域|研究经历|学术经历|科研成果|论文/, 'publications']
];

function typeOfTitle(title) {
  const text = title.trim();
  for (const [re, type] of TITLE_MAP) {
    if (re.test(text)) return type;
  }
  return null;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 把 section-title 的直接外层包装 div 改为 <div class="section" data-section="TYPE"> */
function markSections(html) {
  const matches = [];
  const titleRe = /<((?:div|h[1-4]))[^>]*class="[^"]*section-title[^"]*"[^>]*>\s*([^<]+?)\s*<\/\1>/gi;
  let m;
  while ((m = titleRe.exec(html)) !== null) {
    const type = typeOfTitle(m[2]);
    if (!type) continue;
    const before = html.slice(0, m.index);
    const wrapperMatch = /<div(?![^>]*class=)[^>]*>\s*$/.exec(before);
    if (wrapperMatch) {
      const start = before.length - wrapperMatch[0].length;
      matches.push({ start, type, sectionTitle: null });
    } else {
      matches.push({ start: null, type, sectionTitle: m[2].trim() });
    }
  }
  let out = html;
  for (const { start, type } of matches.filter((x) => x.start !== null).sort((a, b) => b.start - a.start)) {
    const tag = /^<div(?![^>]*class=)[^>]*>/.exec(out.slice(start))[0];
    out = out.slice(0, start)
      + `<div class="section" data-section="${type}">`
      + out.slice(start + tag.length);
  }
  return {
    html: out,
    types: [...new Set(matches.map((x) => x.type))],
    titleBlocks: matches.filter((x) => x.sectionTitle !== null)
  };
}

function main() {
  const id = process.argv[2];
  if (!id) { console.error('用法: node scripts/semanticize-sections.js <templateId>'); process.exit(2); }
  const htmlFile = path.join(TEMPLATE_DIR, `${id}.html`);
  const manifestFile = path.join(TEMPLATE_DIR, `${id}.manifest.json`);
  let html = fs.readFileSync(htmlFile, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

  const { html: markedHtml, types, titleBlocks } = markSections(html);
  html = markedHtml;
  fs.writeFileSync(htmlFile, html, 'utf8');

  const regions = [];
  if (html.includes('resume-header')) regions.push({ name: 'header', placement: 'main', origins: [] });
  if (html.includes('resume-sidebar')) regions.push({ name: 'sidebar', placement: 'sidebar', origins: ['sidebar'] });
  if (html.includes('resume-main')) regions.push({ name: 'main', placement: 'main', origins: ['main'] });
  if (regions.length === 0) regions.push({ name: 'main', placement: 'main', origins: ['main'] });

  manifest.renderMode = 'semantic';
  manifest.regions = regions;
  const blocks = types.map((type) => ({
    type,
    selector: `[data-section='${type}']`,
    placement: 'main'
  }));
  for (const tb of titleBlocks) {
    if (!blocks.some((b) => b.type === tb.type)) {
      blocks.push({ type: tb.type, selector: null, sectionTitle: tb.sectionTitle, placement: 'main' });
    }
  }
  manifest.blocks = blocks;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`sections marked for ${id}: ${types.join(', ')}`);
}

main();
