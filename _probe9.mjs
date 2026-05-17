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

// Check if there's a CSRF endpoint
async function probe(label, url, method='GET', body=null) {
  const opts = {method, headers:H};
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const t = await r.text();
  let p; try { p=JSON.parse(t); } catch { p=t.slice(0,200); }
  console.log(`${label}: ${r.status}`, typeof p==='object' ? JSON.stringify(p).slice(0,200) : p);
  return {status:r.status, data:p, headers: Object.fromEntries(r.headers)};
}

await probe('CSRF endpoint', 'https://substack.com/api/v1/csrf');
await probe('login status', 'https://substack.com/api/v1/login/status');
await probe('prelogin', 'https://substack.com/api/v1/prelogin');

// Look at what error message we actually get from the POST 
const postR = await fetch('https://substack.com/api/v1/comment/feed', {
  method:'POST',
  headers:{...H,'Content-Type':'application/json','Origin':'https://substack.com','Referer':'https://substack.com/notes'},
  body: JSON.stringify({bodyJson:{type:'doc',attrs:{schemaVersion:'v1'},content:[{type:'paragraph',content:[{type:'text',text:'test'}]}]},tabId:'for-you',replyMinimumRole:'everyone'})
});
console.log('\nPOST status:', postR.status);
// Get response headers for clues
for (const [k,v] of postR.headers) {
  if (!k.includes('cache') && !k.includes('x-amz') && !k.includes('cf-') && !k.includes('strict')) {
    console.log(' header:', k, '=', v.slice(0,80));
  }
}
