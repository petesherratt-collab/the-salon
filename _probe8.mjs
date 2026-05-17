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
const H = { 'Cookie': `substack.sid=${SID}`, 'User-Agent': UA, 'Accept': 'application/json' };

// Get the dashboard page and look for any useful data
const dash = await fetch('https://themindshareadvisory.substack.com/publish/home', {headers: H});
const html = await dash.text();

// Find all meta tags
const metas = [...html.matchAll(/<meta[^>]+>/g)].map(m=>m[0]).filter(m=>m.includes('token')||m.includes('csrf'));
console.log('Meta tags with token/csrf:', metas.length ? metas : 'none');

// Find all script vars that might have tokens
const scriptData = html.match(/window\.__(?:NEXT_DATA__|PAGE_DATA__|INITIAL_STATE__)\s*=\s*(\{.+?\});/s)?.[1];
if (scriptData) {
  // Look for token/csrf fields
  const tokens = [...scriptData.matchAll(/"(?:csrf|token|sid|auth)[^"]*"\s*:\s*"([^"]+)"/gi)];
  console.log('\nToken-like fields in page data:');
  for (const [,v] of tokens.slice(0,10)) console.log(' ', v.slice(0,60));
}

// Grab set-cookies from dashboard
const setCookies = dash.headers.getSetCookie?.() ?? [];
console.log('\nSet-Cookie from dashboard:');
for (const c of setCookies) console.log(' ', c.split(';')[0].slice(0,80));

// Try the POST with more varied headers — maybe we need to match what browser sends
// Try the notes endpoint with content-type: application/json;charset=UTF-8
const H2 = {
  ...H,
  'Content-Type': 'application/json;charset=UTF-8',
  'Accept': '*/*',
  'Origin': 'https://themindshareadvisory.substack.com',
  'Referer': 'https://themindshareadvisory.substack.com/publish/home',
};
const body = { bodyJson:{type:'doc',attrs:{schemaVersion:'v1'},content:[{type:'paragraph',content:[{type:'text',text:'probe'}]}]}, tabId:'for-you', replyMinimumRole:'everyone' };
const r = await fetch('https://themindshareadvisory.substack.com/api/v1/comment/feed', {method:'POST',headers:H2,body:JSON.stringify(body)});
console.log('\nPOST pub-subdomain/comment/feed:', r.status);
const t = await r.text();
console.log(t.slice(0,200));
