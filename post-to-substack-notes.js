#!/usr/bin/env node
// post-to-substack-notes.js — posts a quote card to Substack Notes for discovery
// Usage: node post-to-substack-notes.js <json-file>
// json-file: same as post-to-substack.js {title, body, personaId, personaName}
// Reads .columnist-state.json for the postId written by post-to-substack.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';

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

const SUBSTACK   = 'themindshareadvisory';
const PUB_ID     = 8147836;
const REF_CODE   = '7qihvo';
const SID        = process.env.SUBSTACK_SID;
const PUB_BASE   = `https://${SUBSTACK}.substack.com`;

if (!SID) { console.error('Missing SUBSTACK_SID in .env'); process.exit(1); }

const CURL_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15';

function curlJSON(method, url, body) {
  const args = ['-s', '-X', method, url,
    '-H', 'Content-Type: application/json',
    '-H', `Cookie: substack.sid=${SID}`,
    '-H', `User-Agent: ${CURL_UA}`
  ];
  if (body) args.push('-d', JSON.stringify(body));
  const out = execFileSync('curl', args, { encoding: 'utf8' });
  try { return JSON.parse(out); }
  catch { throw new Error(`${method} ${url} non-JSON: ${out.slice(0, 200)}`); }
}

function titleToSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getParagraphs(body) {
  return body.split(/\n{2,}/).map(s => s.replace(/\n/g, ' ').trim()).filter(Boolean);
}

// Pick the most aphoristic/quotable sentence from the column body
function selectQuote(body) {
  const paragraphs = getParagraphs(body);

  const candidates = [];
  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    const sentRe = /[^.!?]*[.!?]+/g;
    let m;
    while ((m = sentRe.exec(para)) !== null) {
      const sent = m[0].trim();
      if (sent.length < 45 || sent.length > 190) continue;

      let score = 0;
      if (pIdx > 0 && pIdx < paragraphs.length - 2) score += 2; // middle paragraphs
      if (sent.length < 110) score += 2;                         // shorter = more punchy
      if (!/^(I |We |There |It |This |That )/.test(sent)) score += 2; // not hedged opener
      if (/\b(is|are|was|were|will|must|never|always)\b/.test(sent)) score += 1;
      if (/\b(machine|sentiment|feeling|language|truth|grief|love|death|credit|honest|real|lie|cost|price)\b/i.test(sent)) score += 1;
      // Avoid meta-sentences about the essay structure
      if (/\b(will tell|have been|I notice|I find|Let me)\b/.test(sent)) score -= 1;

      candidates.push({ sent, pIdx, startOffset: m.index, endOffset: m.index + m[0].length, score });
    }
  }

  if (candidates.length === 0) {
    const pIdx = Math.min(1, paragraphs.length - 1);
    const para = paragraphs[pIdx];
    return { quote: para.slice(0, 100), pIdx, startOffset: 0, endOffset: 100 };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return { quote: best.sent, pIdx: best.pIdx, startOffset: best.startOffset, endOffset: best.endOffset };
}

async function main() {
  const jsonFile = process.argv[2];
  if (!jsonFile) throw new Error('Usage: node post-to-substack-notes.js <json-file>');

  const input = JSON.parse(readFileSync(jsonFile, 'utf8'));
  const { title, body, personaName } = input;
  if (!title || !body) throw new Error('JSON must have title and body');

  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const postId = state.lastPostId;
  if (!postId) throw new Error('No lastPostId in .columnist-state.json — run post-to-substack.js first');

  const slug = titleToSlug(title);
  const { quote, pIdx, startOffset, endOffset } = selectQuote(body);
  console.error(`Quote [para ${pIdx}, ${startOffset}-${endOffset}]: "${quote.slice(0, 70)}..."`);

  // Step 1: register the text selection
  const selRes = curlJSON('PUT', `${PUB_BASE}/api/v1/post_selection`, {
    postId,
    publication_id: PUB_ID,
    startParagraph: pIdx,
    endParagraph:   pIdx,
    startOffset,
    endOffset
  });
  const selectionId = (selRes.selection || selRes).id;
  if (!selectionId) throw new Error('post_selection returned no id: ' + JSON.stringify(selRes));

  // Step 2: create link attachment referencing the selection
  const attachUrl = `${PUB_BASE}/p/${slug}?r=${REF_CODE}&selection=${selectionId}&utm_campaign=post-share-selection&utm_medium=web`;
  const attachRes = curlJSON('POST', `${PUB_BASE}/api/v1/comment/attachment`, {
    url:  attachUrl,
    type: 'link'
  });
  const attachId = attachRes.id;
  if (!attachId) throw new Error('comment/attachment returned no id: ' + JSON.stringify(attachRes));

  // Step 3: set dark quote-card theme
  curlJSON('PATCH', `${PUB_BASE}/api/v1/comment/attachment/${attachId}/post_selection_theme`, {
    theme_name:      'DarkMuted',
    theme_alignment: 'left'
  });

  // Step 4: post to Notes (substack.com, not pub subdomain — requires curl for Cloudflare bypass)
  const byline = personaName ? `A. I. ${personaName} · ` : '';
  const noteText = `${byline}Today in The Mindshareadvisory.`;
  const noteBody = {
    type: 'doc',
    attrs: { schemaVersion: 'v1', title: null },
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: noteText }]
    }]
  };

  const feedRes = curlJSON('POST', 'https://substack.com/api/v1/comment/feed', {
    bodyJson:          noteBody,
    attachmentIds:     [attachId],
    replyMinimumRole:  'everyone'
  });

  const noteUrl = feedRes.url ?? feedRes.canonical_url ?? ('note id: ' + feedRes.id);
  console.log(noteUrl);
}

main().catch(err => { console.error(err.message); process.exit(1); });
