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

// Step 1: GET the notes page to get Cloudflare and other cookies
const warmup = await fetch('https://substack.com/api/v1/user/profile/self', {
  headers: { 'Cookie': `substack.sid=${SID}`, 'User-Agent': UA }
});
const warmupCookies = warmup.headers.getSetCookie?.() ?? [];
console.log('Warmup status:', warmup.status);

// Parse all set-cookies into a cookie jar string
const jar = {};
jar['substack.sid'] = SID;
for (const c of warmupCookies) {
  const [kv] = c.split(';');
  const eq = kv.indexOf('=');
  if (eq > 0) {
    const k = kv.slice(0, eq).trim();
    const v = kv.slice(eq+1).trim();
    jar[k] = v;
  }
}

// Step 2: Also get the notes page to pick up __cf_bm
const notesWarmup = await fetch('https://substack.com/notes', {
  headers: { 'Cookie': Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '), 'User-Agent': UA },
  redirect: 'follow'
});
const notesCookies = notesWarmup.headers.getSetCookie?.() ?? [];
for (const c of notesCookies) {
  const [kv] = c.split(';');
  const eq = kv.indexOf('=');
  if (eq > 0) {
    const k = kv.slice(0, eq).trim(), v = kv.slice(eq+1).trim();
    jar[k] = v;
  }
}
console.log('Cookie keys acquired:', Object.keys(jar).join(', '));

const cookieStr = Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ');

// Step 3: POST the note with full cookie jar
const H = {
  'Content-Type': 'application/json',
  'Cookie': cookieStr,
  'User-Agent': UA,
  'Origin': 'https://substack.com',
  'Referer': 'https://substack.com/notes',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
};

const body = {
  bodyJson: { type:'doc', attrs:{schemaVersion:'v1'}, content:[{type:'paragraph',content:[{type:'text',text:'[API probe — delete me]'}]}] },
  tabId: 'for-you',
  replyMinimumRole: 'everyone'
};

console.log('\n--- POST to substack.com/api/v1/comment/feed ---');
const r = await fetch('https://substack.com/api/v1/comment/feed', {
  method:'POST', headers:H, body:JSON.stringify(body)
});
const t = await r.text();
console.log('status:', r.status);
if (r.ok) {
  const p = JSON.parse(t);
  console.log('SUCCESS:', JSON.stringify(p, null, 2).slice(0, 500));
  const del = await fetch(`https://substack.com/api/v1/comment/${p.id}`, {method:'DELETE', headers:H});
  console.log('Deleted:', del.status);
} else {
  console.log(t.slice(0, 300));
}
