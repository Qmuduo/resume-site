'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.resolve(__dirname, '../docs/template');
const REGION_CLASSES = {
  header: 'resume-header',
  main: 'resume-main',
  sidebar: 'resume-sidebar'
};
const SECTION_TYPES = ['profiles', 'experience', 'education', 'projects', 'skills', 'languages',
  'interests', 'awards', 'certifications', 'publications', 'volunteer', 'references', 'custom'];

function cssVars(css) {
  const vars = [];
  const re = /--([a-z0-9-]+)\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    vars.push({ key: `--${m[1].trim()}`, default: m[2].trim() });
  }
  return vars.filter((v, i, arr) => arr.findIndex((x) => x.key === v.key) === i);
}

function blocksFromHtml(html) {
  const blocks = [];
  const re = /<([a-zA-Z][\w-]*)[^>]*data-section=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!SECTION_TYPES.includes(m[2])) continue;
    if (blocks.find((b) => b.type === m[2])) continue;
    blocks.push({ type: m[2], selector: `[data-section="${m[2]}"]`, placement: 'main' });
  }
  return blocks;
}

function regionsFromHtml(html) {
  const regions = [];
  for (const [name, cls] of Object.entries(REGION_CLASSES)) {
    if (html.includes(`class="${cls}`) || html.includes(` ${cls} `)) {
      regions.push({ name, placement: name === 'sidebar' ? 'sidebar' : 'main', origins: [] });
    }
  }
  return regions;
}

function sampleText(html) {
  const out = {};
  const name = /<h1[^>]*>\s*([^<]+)\s*<\/h1>/i.exec(html);
  if (name) out.name = name[1].trim();
  const headline = /class=["'][^"']*\bjob-title\b[^"']*["'][^>]*>\s*([^<]+)\s*</i.exec(html)
    || /class=["'][^"']*\bsubhead\b[^"']*["'][^>]*>\s*([^<]+)\s*</i.exec(html);
  if (headline) out.headline = headline[1].trim();
  const summary = /class=["'][^"']*\bsection-title\b[^"']*["'][^>]*>[^<]*<\/[^>]+>\s*<p[^>]*>\s*([^<]+)\s*<\/p>/i.exec(html);
  if (summary) out.summary = summary[1].trim();
  return out;
}

function main() {
  const report = { generatedAt: new Date().toISOString(), templates: [] };
  for (const file of fs.readdirSync(TEMPLATE_DIR)) {
    if (!file.endsWith('.html')) continue;
    const id = file.replace(/\.html$/, '');
    const html = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8');
    const cssMatch = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html);
    const css = cssMatch ? cssMatch[1] : '';
    const manifest = {
      templateId: id,
      name: id,
      sourceFile: file,
      renderMode: 'semantic',
      regions: regionsFromHtml(html),
      blocks: blocksFromHtml(html),
      theme: cssVars(css),
      sampleData: sampleText(html),
      customFields: []
    };
    fs.writeFileSync(path.join(TEMPLATE_DIR, `${id}.manifest.json`), JSON.stringify(manifest, null, 2), 'utf8');
    report.templates.push({ id, blocks: manifest.blocks.length, themeVars: manifest.theme.length });
  }
  fs.writeFileSync(path.resolve(__dirname, '../docs/template-analysis-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`analyzed ${report.templates.length} templates`);
}

main();
