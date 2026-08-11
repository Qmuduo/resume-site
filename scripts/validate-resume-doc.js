'use strict';
const fs = require('fs');

const TOP_LEVEL = ['version', 'basics', 'summary', 'sections', 'customSections', 'picture', 'metadata'];
const SECTION_KEYS = ['profiles', 'experience', 'education', 'projects', 'skills', 'languages',
  'interests', 'awards', 'certifications', 'publications', 'volunteer', 'references'];

function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function checkSection(sec, errors, prefix) {
  if (!isObject(sec)) { errors.push(`${prefix} 必须是对象`); return; }
  for (const key of ['title', 'columns', 'hidden', 'items']) {
    if (!(key in sec)) errors.push(`${prefix} 缺少 ${key}`);
  }
  if (!Array.isArray(sec.items)) { errors.push(`${prefix}.items 必须是数组`); return; }
  sec.items.forEach((item, i) => {
    if (!isObject(item)) { errors.push(`${prefix}.items[${i}] 必须是对象`); return; }
    if (typeof item.id !== 'string' || item.id.length === 0) errors.push(`${prefix}.items[${i}].id 缺失`);
    if (typeof item.hidden !== 'boolean') errors.push(`${prefix}.items[${i}].hidden 缺失`);
  });
}

function validateDocument(doc) {
  const errors = [];
  if (!isObject(doc)) return ['文档必须是对象'];
  for (const key of TOP_LEVEL) if (!(key in doc)) errors.push(`缺少顶层字段 ${key}`);
  if (doc.version !== '1.0') errors.push(`version 必须为 1.0，实际 ${doc.version}`);
  if (!isObject(doc.basics) || typeof doc.basics.name !== 'string') errors.push('basics.name 必须是字符串');
  if (!Array.isArray(doc.customSections)) errors.push('customSections 必须是数组');
  doc.customSections.forEach((s, i) => checkSection(s, errors, `customSections[${i}]`));
  if (!isObject(doc.sections)) { errors.push('sections 必须是对象'); }
  else {
    for (const key of SECTION_KEYS) if (key in doc.sections) checkSection(doc.sections[key], errors, `sections.${key}`);
  }
  if (!isObject(doc.metadata) || typeof doc.metadata.template !== 'string') errors.push('metadata.template 必须是字符串');
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) { console.error('用法: node scripts/validate-resume-doc.js <resume.json>'); process.exit(2); }
  const doc = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  const errors = validateDocument(doc);
  if (errors.length > 0) { console.error(errors.join('\n')); process.exit(1); }
  console.log('OK: ResumeData 结构校验通过');
}

module.exports = { validateDocument };
if (require.main === module) main();
