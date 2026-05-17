import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  const lines = readFileSync(join(__dirname, '.env'), 'utf8').split('\n');
  for (const line of lines) {
    const eq = line.indexOf('='); if (eq > 0 && !line.startsWith('#')) {
      const key = line.slice(0, eq).trim(), val = line.slice(eq+1).trim().replace(/^["']|["']$/g,'');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnv();
const SID = process.env.SUBSTACK_SID;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H = { 'Cookie': `substack.sid=${SID}`, 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json' };

// Try various publication-subdomain note endpoints
async function tryPost(label, url, body) {
  const r = await fetch(url, { method:'POST', headers:H, body:JSON.stringify(body) });
  const t = await r.text();
  let p; try { p=JSON.parse(t); } catch { p = null; }
  console.log(`${label}: ${r.status}`, p ? JSON.stringify(p).slice(0,200) : t.slice(0,100));
  if (r.ok && p?.id) {
    // delete if created
    await fetch(url.replace('/comment/feed','') + '/comment/' + p.id, {method:'DELETE', headers:H});
  }
  return r.status;
}

const BASE = 'https://themindshareadvisory.substack.com';
const noteBody = { bodyJson:{type:'doc',attrs:{schemaVersion:'v1'},content:[{type:'paragraph',content:[{type:'text',text:'probe'}]}]}, tabId:'for-you', replyMinimumRole:'everyone' };
const noteBodyAlt = { body_json: JSON.stringify({type:'doc',attrs:{schemaVersion:'v1'},content:[{type:'paragraph',content:[{type:'text',text:'probe'}]}]}), tab_id:'for-you' };

await tryPost('pub /api/v1/note', `${BASE}/api/v1/note`, noteBody);
await tryPost('pub /api/v1/notes', `${BASE}/api/v1/notes`, noteBody);
await tryPost('pub /api/v1/notes (alt)', `${BASE}/api/v1/notes`, noteBodyAlt);
await tryPost('pub /api/v1/comment', `${BASE}/api/v1/comment`, noteBody);
await tryPost('pub /api/v1/reader/notes', `${BASE}/api/v1/reader/notes`, noteBody);
await tryPost('pub /api/v1/feed/notes', `${BASE}/api/v1/feed/notes`, noteBody);
