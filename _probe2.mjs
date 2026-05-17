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
const H = { 'Content-Type':'application/json', 'Cookie':`substack.sid=${SID}`, 'User-Agent':'Mozilla/5.0' };

async function probe(label, url, opts={}) {
  const res = await fetch(url, { headers: H, ...opts });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 300); }
  console.log(`\n--- ${label} (${res.status}) ---`);
  console.log(JSON.stringify(parsed, null, 2).slice(0, 800));
  return { status: res.status, data: parsed };
}

// Try various note feed endpoints
await probe('reader notes feed', 'https://substack.com/api/v1/reader/feeds/notes?filter=all&limit=5');
await probe('profile notes', 'https://substack.com/api/v1/notes/profile/467796228?limit=5');
await probe('comment feed GET', 'https://substack.com/api/v1/comment/feed?limit=5');
await probe('publication feed', 'https://themindshareadvisory.substack.com/api/v1/reader/feeds/note?limit=3');
