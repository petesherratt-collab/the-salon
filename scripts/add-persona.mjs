#!/usr/bin/env node
// add-persona.mjs — add a Salon persona consistently across all the files that must
// agree on its `key`. Automates the error-prone data edits (the key has to match across
// personas.json, the display object, cardPersonaKeys, the longform dropdown) and prints
// the one creative bit — the .voice-card HTML — for you to paste at the END of the grid
// (the grid is order-zipped to cardPersonaKeys, so "append everywhere" keeps it aligned).
//
// Usage:
//   node scripts/add-persona.mjs <key> "<Name>" "<Era>" <chat-prompt.txt> \
//        [--longform <longform-prompt.txt>] [--portrait <url>] [--desc "..."] [--tag "..."] \
//        [--no-longform] [--no-grid]
//
// Run from the repo root. Nothing is written until all duplicate-key checks pass.
import { readFileSync, writeFileSync, existsSync } from 'fs';

const argv = process.argv.slice(2);
const pos = argv.filter(a => !a.startsWith('--'));
const flags = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : true;
}
const [key, name, era, chatFile] = pos;

function die(m) { console.error('✗ ' + m); process.exit(1); }
if (!key || !name || !era || !chatFile) {
  console.error('usage: node scripts/add-persona.mjs <key> "<Name>" "<Era>" <chat-prompt.txt> [--longform f] [--portrait url] [--desc ".."] [--tag ".."] [--no-longform] [--no-grid]');
  process.exit(1);
}
if (!/^[a-z][a-z0-9]+$/.test(key)) die(`key must be lowercase letters/digits (got "${key}")`);
if (!existsSync(chatFile)) die(`chat prompt file not found: ${chatFile}`);
const chatPrompt = readFileSync(chatFile, 'utf8').trim();
const lfPrompt = flags.longform ? readFileSync(flags.longform, 'utf8').trim() : null;

// ── existence checks (abort before writing anything) ──
const personasJson = JSON.parse(readFileSync('api/personas.json', 'utf8'));
if (personasJson[key]) die(`"${key}" already in api/personas.json`);
let indexHtml = readFileSync('index.html', 'utf8');
if (new RegExp(`\\n  ${key}: \\{`).test(indexHtml)) die(`"${key}" already in index.html personas`);
const ckLine = indexHtml.match(/const cardPersonaKeys = \[[^\]]*\];/);
if (!ckLine) die('could not find cardPersonaKeys array in index.html');
if (new RegExp(`'${key}'`).test(ckLine[0])) die(`"${key}" already in cardPersonaKeys`);
let longformHtml = readFileSync('longform.html', 'utf8');
if (new RegExp(`key: '${key}'`).test(longformHtml)) die(`"${key}" already in longform.html PERSONAS`);

const q = s => JSON.stringify(s);
const touched = [];

// ── 1. api/personas.json (chat prompt) ──
personasJson[key] = chatPrompt;
writeFileSync('api/personas.json', JSON.stringify(personasJson, null, 2) + '\n');
touched.push('api/personas.json');

// ── 2. api/personas-longform.json (only if a longform prompt was supplied) ──
if (lfPrompt && !flags['no-longform']) {
  const lf = JSON.parse(readFileSync('api/personas-longform.json', 'utf8'));
  lf[key] = lfPrompt;
  writeFileSync('api/personas-longform.json', JSON.stringify(lf, null, 2) + '\n');
  touched.push('api/personas-longform.json');
}

// ── 3. index.html: display object + cardPersonaKeys ──
{
  const s = indexHtml.indexOf('const personas = {');
  const c = indexHtml.indexOf('\n};', s);
  if (s < 0 || c < 0) die('could not locate the personas display block in index.html');
  indexHtml = indexHtml.slice(0, c) + `,\n  ${key}: { name: ${q(name)}, era: ${q(era)} }` + indexHtml.slice(c);
}
if (!flags['no-grid']) {
  const s = indexHtml.indexOf('const cardPersonaKeys = [');
  const c = indexHtml.indexOf('];', s);
  indexHtml = indexHtml.slice(0, c) + `, '${key}'` + indexHtml.slice(c);
}
writeFileSync('index.html', indexHtml);
touched.push('index.html (display' + (flags['no-grid'] ? '' : ' + cardPersonaKeys') + ')');

// ── 4. longform.html: PERSONAS dropdown ──
if (!flags['no-longform']) {
  const s = longformHtml.indexOf('const PERSONAS = [');
  const m = longformHtml.slice(s).match(/\n\s*\];/);
  if (s < 0 || !m) die('could not locate the PERSONAS array in longform.html');
  const c = s + m.index;
  longformHtml = longformHtml.slice(0, c) + `,\n      { key: '${key}', name: ${q(name)}, era: ${q(era)} }` + longformHtml.slice(c);
  writeFileSync('longform.html', longformHtml);
  touched.push('longform.html (PERSONAS)');
}

// ── done: report + print the one manual bit ──
console.log('✓ added persona "' + key + '" — ' + name);
touched.forEach(t => console.log('  · ' + t));
if (!lfPrompt && !flags['no-longform']) console.log('  · longform: no specific prompt — will use the name-based fallback');

if (!flags['no-grid']) {
  const portrait = flags.portrait || 'PORTRAIT_URL_HERE';
  const desc = flags.desc || 'One-line description.';
  const tag = flags.tag || 'Tag';
  console.log('\n── PASTE THIS .voice-card at the END of <div class="voices-grid"> in index.html ──');
  console.log('   (it must be the LAST card, to line up with the cardPersonaKeys entry just appended)\n');
  console.log(`  <div class="voice-card">
    <div class="vc-portrait"><img src="${portrait}" alt="${name}"></div>
    <div class="vc-era">${era}</div>
    <div class="vc-name">${name}</div>
    <p class="vc-desc">${desc}</p>
    <span class="vc-tag">${tag}</span>
  </div>`);
}
console.log('\nReview with `git diff`, then commit.');
