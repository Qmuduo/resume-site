'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.resolve(__dirname, '../docs/template');
const CATALOG = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../backend/com.resume.api/src/main/resources/template-market-catalog.json'), 'utf8'));

// 旧类名 -> 语义类名 映射（按 v2 模板 HTML 的常见命名）
const CLASS_MAP = {
  'resume': 'resume-page',
  'name-section': 'resume-header',
  'contact-info': 'contact-list',
  'contact-item': 'contact-item',
  'section': 'section',
  'section-title': 'section-title',
  'skills-container': 'section-items',
  'skill-tag': 'skill-tag',
  'entry': 'entry',
  'entry-header': 'entry-header',
  'date-location': 'entry-meta',
  'details': 'entry-body',
  'edu-entry': 'entry edu-entry',
  'project-item': 'entry project-item'
};

const THEME_DEFAULTS = {
  '--color-primary': '#4F46E5',
  '--color-background': '#FFFFFF',
  '--color-text': '#1A1A1A',
  '--font-heading': 'sans-serif',
  '--font-body': 'sans-serif',
  '--font-size-base': '12pt',
  '--page-margin': '48px',
  '--section-gap': '16px'
};

function injectDataSection(html) {
  return html
    .replace(/class="([^"]*)section-title[^"]*"/g, 'data-section-holder="$1"')
    .replace(/<div([^>]*)class="([^"]*)section-title([^"]*)"([^>]*)>/g,
      (all, pre, c1, c2, post, tail) => `<section data-section="__title__"${pre}class="${c1}section-title${c2}"${tail}>`)
    .replace(/data-section-holder="/g, 'class="');
}

function ensureThemeVars(css) {
  if (/--color-primary/.test(css)) return css;
  const defaults = Object.entries(THEME_DEFAULTS)
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n  ');
  return `:root {\n  ${defaults}\n}\n${css}`;
}

function main() {
  const id = process.argv[2];
  if (!id) { console.error('用法: node scripts/semanticize-template.js <templateId>'); process.exit(2); }
  const htmlFile = path.join(TEMPLATE_DIR, `${id}.html`);
  const manifestFile = path.join(TEMPLATE_DIR, `${id}.manifest.json`);
  let html = fs.readFileSync(htmlFile, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const [oldCls, newCls] of Object.entries(CLASS_MAP)) {
    html = html.split(`class="${oldCls}"`).join(`class="${newCls}"`);
    html = html.split(`class="${oldCls} `).join(`class="${newCls} `);
  }
  html = injectDataSection(html);
  html = html.replace(/<style[^>]*>/i, (tag) => `${tag}\n${ensureThemeVars('')}`);
  fs.writeFileSync(htmlFile, html, 'utf8');
  const primary = CATALOG[id] && CATALOG[id].primaryColor ? CATALOG[id].primaryColor : THEME_DEFAULTS['--color-primary'];
  manifest.renderMode = 'semantic';
  manifest.theme = [
    { key: '--color-primary', default: primary, control: 'color' },
    { key: '--color-background', default: THEME_DEFAULTS['--color-background'], control: 'color' },
    { key: '--color-text', default: THEME_DEFAULTS['--color-text'], control: 'color' },
    { key: '--font-heading', default: THEME_DEFAULTS['--font-heading'], control: 'font' },
    { key: '--font-body', default: THEME_DEFAULTS['--font-body'], control: 'font' },
    { key: '--font-size-base', default: THEME_DEFAULTS['--font-size-base'], control: 'number' },
    { key: '--page-margin', default: THEME_DEFAULTS['--page-margin'], control: 'number' },
    { key: '--section-gap', default: THEME_DEFAULTS['--section-gap'], control: 'number' }
  ];
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`semanticized ${id}`);
}

main();
