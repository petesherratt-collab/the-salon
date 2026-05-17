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

// Step 1: post a plain test note to confirm the endpoint and auth work
console.log('--- POST plain note ---');
const body = {
  bodyJson: {
    type: 'doc',
    attrs: { schemaVersion: 'v1' },
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '[API TEST — will delete]' }] }]
  },
  tabId: 'for-you',
  replyMinimumRole: 'everyone'
};
const res = await fetch('https://substack.com/api/v1/comment/feed', {
  method: 'POST', headers: H, body: JSON.stringify(body)
});
const text = await res.text();
console.log('status:', res.status);
let parsed;
try { parsed = JSON.parse(text); } catch { parsed = text.slice(0,500); }
console.log(JSON.stringify(parsed, null, 2).slice(0, 1200));

// If success, print the note id so we can delete it
if (parsed?.id) {
  console.log('\nNOTE ID:', parsed.id, '— delete it at: https://substack.com/notes/' + parsed.id);
  // Immediately delete
  const del = await fetch(`https://substack.com/api/v1/comment/${parsed.id}`, { method: 'DELETE', headers: H });
  console.log('delete status:', del.status);
}
