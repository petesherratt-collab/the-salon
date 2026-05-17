// Probe the Substack Notes API to understand the quote card structure
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const lines = readFileSync(join(__dirname, '.env'), 'utf8').split('\n');
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnv();

const SID = process.env.SUBSTACK_SID;
const HEADERS = {
  'Content-Type': 'application/json',
  'Cookie': `substack.sid=${SID}`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

// Step 1: confirm session works — fetch our own profile
console.log('--- Step 1: own profile ---');
const profileRes = await fetch('https://substack.com/api/v1/user/profile/self', { headers: HEADERS });
console.log('status:', profileRes.status);
const profile = await profileRes.json();
console.log('handle:', profile.handle, '| id:', profile.id, '| name:', profile.name);

// Step 2: fetch an existing note from our pub to see its structure
const POST_ID = 197254948; // from state
console.log('\n--- Step 2: fetch published post to get its metadata ---');
const postRes = await fetch(`https://themindshareadvisory.substack.com/api/v1/posts/${POST_ID}`, { headers: HEADERS });
console.log('status:', postRes.status);
if (postRes.ok) {
  const post = await postRes.json();
  console.log('id:', post.id, '| slug:', post.slug, '| type:', post.type, '| audience:', post.audience);
}

// Step 3: fetch our Notes feed to see what an existing Note looks like
console.log('\n--- Step 3: our recent notes (to see structure) ---');
const notesRes = await fetch('https://substack.com/api/v1/comment/feed?types[]=feed_item', { headers: HEADERS });
console.log('status:', notesRes.status);
if (notesRes.ok) {
  const notes = await notesRes.json();
  const items = notes?.items || [];
  console.log('total items:', items.length);
  if (items[0]) {
    console.log('first item type:', items[0].type);
    console.log('first item keys:', Object.keys(items[0]));
    const comment = items[0]?.comment || items[0];
    console.log('comment keys:', Object.keys(comment));
    if (comment.body_json) {
      console.log('\nbody_json sample:');
      console.log(JSON.stringify(JSON.parse(comment.body_json || '{}'), null, 2).slice(0, 1000));
    }
  }
}
