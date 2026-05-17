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

async function get(label, url) {
  const r = await fetch(url, {headers: H});
  const t = await r.text();
  let p; try { p = JSON.parse(t); } catch { p = t.slice(0,300); }
  console.log(`\n--- ${label} (${r.status}) ---`);
  if (typeof p === 'object') console.log(JSON.stringify(p, null, 2).slice(0,600));
  else console.log(p);
  return {status: r.status, data: p};
}

// Check what kind of session this is
await get('user self (v1)', 'https://substack.com/api/v1/user/login/status');
await get('me endpoint', 'https://substack.com/api/v1/me');
await get('subscriber self', 'https://themindshareadvisory.substack.com/api/v1/subscriber');
await get('publication self', 'https://themindshareadvisory.substack.com/api/v1/publication/self');

// Try to get any CSRF token from the writer dashboard
const dash = await fetch('https://themindshareadvisory.substack.com/publish/home', {headers: H, redirect:'follow'});
const html = await dash.text();
const csrf = html.match(/"csrfToken"\s*:\s*"([^"]+)"/)?.[1]
           || html.match(/csrf.+?["']([a-f0-9]{32,})/i)?.[1];
console.log('\nCSRF from dashboard HTML:', csrf ? csrf.slice(0,40) : 'not found');
console.log('Dashboard status:', dash.status, '| url:', dash.url);
