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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Fetch /notes page and inspect all set-cookie headers
const r1 = await fetch('https://substack.com/notes', {
  headers: { 'Cookie': `substack.sid=${SID}`, 'User-Agent': UA },
  redirect: 'follow'
});
console.log('notes page status:', r1.status, '| final url:', r1.url);
const cookies1 = r1.headers.getSetCookie ? r1.headers.getSetCookie() : [r1.headers.get('set-cookie') || ''];
console.log('set-cookies:', cookies1.map(c => c.split(';')[0]).join('\n'));

// Grab the CSRF from HTML
const html = await r1.text();
// Look for csrf anywhere
const csrfPatterns = [
  /"csrf[_-]token"\s*:\s*"([^"]+)"/i,
  /name="csrf-token" content="([^"]+)"/i,
  /"_csrf"\s*:\s*"([^"]+)"/i,
  /window\.__csrf\s*=\s*["']([^"']+)["']/i,
  /"csrfToken"\s*:\s*"([^"]+)"/i,
];
for (const p of csrfPatterns) {
  const m = html.match(p);
  if (m) { console.log('CSRF in page (' + p.source.slice(0,30) + '):', m[1].slice(0,40)); }
}

// Now try posting to the PUB subdomain instead
console.log('\n--- POST note to publication subdomain ---');
const H2 = {
  'Content-Type': 'application/json',
  'Cookie': `substack.sid=${SID}`,
  'User-Agent': UA,
  'Origin': 'https://themindshareadvisory.substack.com',
  'Referer': 'https://themindshareadvisory.substack.com/notes',
};
const body = { bodyJson:{type:'doc',attrs:{schemaVersion:'v1'},content:[{type:'paragraph',content:[{type:'text',text:'[API TEST]'}]}]}, tabId:'for-you', replyMinimumRole:'everyone' };
const r2 = await fetch('https://themindshareadvisory.substack.com/api/v1/comment/feed', {
  method:'POST', headers:H2, body:JSON.stringify(body)
});
console.log('status:', r2.status);
const t2 = await r2.text();
if (r2.ok) {
  const p = JSON.parse(t2);
  console.log('SUCCESS note id:', p.id, '| keys:', Object.keys(p).join(', '));
  const del = await fetch(`https://themindshareadvisory.substack.com/api/v1/comment/${p.id}`, {method:'DELETE', headers:H2});
  console.log('deleted:', del.status);
} else {
  console.log(t2.slice(0,300));
}
