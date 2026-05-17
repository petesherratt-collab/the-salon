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

// Try fetching Substack home to get CSRF token from cookies/response
const initRes = await fetch('https://substack.com/', {
  headers: {
    'Cookie': `substack.sid=${SID}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  redirect: 'follow'
});
const setCookies = initRes.headers.get('set-cookie') || '';
const csrfMatch = setCookies.match(/substack\.csrf=([^;]+)/);
const csrf = csrfMatch?.[1] || '';
console.log('CSRF from set-cookie:', csrf ? 'found' : 'not found');
console.log('set-cookie header:', setCookies.slice(0, 300));

// Also look for csrf in the HTML
const html = await initRes.text();
const csrfInHtml = html.match(/"csrf_token"\s*:\s*"([^"]+)"/)?.[1]
  || html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
console.log('CSRF in HTML:', csrfInHtml ? csrfInHtml.slice(0,20)+'...' : 'not found');

// Try posting with all browser-like headers including referer and origin
const cookieStr = `substack.sid=${SID}${csrf ? `; substack.csrf=${csrf}` : ''}`;
const H = {
  'Content-Type': 'application/json',
  'Cookie': cookieStr,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://substack.com',
  'Referer': 'https://substack.com/notes',
  'X-Requested-With': 'XMLHttpRequest',
  ...(csrf ? { 'X-Substack-CSRF': csrf } : {})
};

console.log('\n--- POST note with browser headers ---');
const body = {
  bodyJson: { type:'doc', attrs:{schemaVersion:'v1'}, content:[{type:'paragraph',content:[{type:'text',text:'[API TEST — will delete]'}]}] },
  tabId: 'for-you', replyMinimumRole: 'everyone'
};
const res = await fetch('https://substack.com/api/v1/comment/feed', {
  method:'POST', headers:H, body:JSON.stringify(body)
});
const text = await res.text();
console.log('status:', res.status);
if (res.ok) {
  const p = JSON.parse(text);
  console.log('SUCCESS! id:', p.id, 'keys:', Object.keys(p));
  // delete immediately
  const del = await fetch(`https://substack.com/api/v1/comment/${p.id}`, {method:'DELETE',headers:H});
  console.log('delete:', del.status);
} else {
  console.log(text.slice(0,400));
}
