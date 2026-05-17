#!/usr/bin/env node
// post-to-substack.js — posts {title, body, personaId} to Substack, saves rotation state
// Usage: node post-to-substack.js <json-file>

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.columnist-state.json');

function loadEnv() {
  try {
    const lines = readFileSync(join(__dirname, '.env'), 'utf8').split('\n');
    for (const line of lines) {
      const eq = line.indexOf('=');
      if (eq > 0 && !line.startsWith('#')) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {}
}

loadEnv();

const SUBSTACK = 'themindshareadvisory';
const SID      = process.env.SUBSTACK_SID;

if (!SID) { console.error('Missing SUBSTACK_SID in .env'); process.exit(1); }

const HEADERS = {
  'Content-Type': 'application/json',
  'Cookie': `substack.sid=${SID}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

function inlineNodes(text) {
  const nodes = [];
  const re = /\*([^*\n]+)\*/g;
  let cursor = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) nodes.push({ type: 'text', text: text.slice(cursor, m.index) });
    nodes.push({ type: 'text', text: m[1], marks: [{ type: 'italic' }] });
    cursor = re.lastIndex;
  }
  if (cursor < text.length) nodes.push({ type: 'text', text: text.slice(cursor) });
  return nodes.length ? nodes : [{ type: 'text', text }];
}

function buildDoc(body) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map(s => s.replace(/\n/g, ' ').trim())
    .filter(Boolean);
  return JSON.stringify({
    type: 'doc',
    content: paragraphs.map(p => ({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: inlineNodes(p)
    }))
  });
}

async function createDraft(title, subtitle, docJson) {
  const res = await fetch(`https://${SUBSTACK}.substack.com/api/v1/drafts`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      type: 'newsletter',
      draft_title: title,
      draft_subtitle: subtitle,
      draft_body: docJson,
      draft_bylines: [],
      audience: 'everyone',
      section_chosen: true
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Draft failed ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function publishDraft(draftId) {
  const res = await fetch(`https://${SUBSTACK}.substack.com/api/v1/drafts/${draftId}/publish`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ send_email: true, paywalled: false, audience: 'everyone' })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Publish failed ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function main() {
  const jsonFile = process.argv[2];
  if (!jsonFile) throw new Error('Usage: node post-to-substack.js <json-file>');

  const input = JSON.parse(readFileSync(jsonFile, 'utf8'));
  const { title, body, personaId, personaName } = input;
  if (!title || !body) throw new Error('JSON file must have title and body fields');
  const subtitle = personaName ? `By A. I. ${personaName}` : '';

  const docJson   = buildDoc(body);
  const draft     = await createDraft(title, subtitle, docJson);
  const published = await publishDraft(draft.id);
  const url       = published.canonical_url
    ?? `https://${SUBSTACK}.substack.com/p/${draft.slug || draft.id}`;

  const state = {
    lastPersonaId: personaId ?? null,
    lastPostId: draft.id,
    lastTitle: title,
    lastUrl: url,
    updatedAt: new Date().toISOString()
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log(url);
}

main().catch(err => { console.error(err.message); process.exit(1); });
