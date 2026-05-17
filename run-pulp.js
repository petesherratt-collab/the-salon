// run-pulp.js
// Usage: node run-pulp.js
//
// Picks a random writer, has them write a story, submits to Walt.
// Walt accepts, rejects, or requests revisions (max 2 rounds).
// Full correspondence saved to correspondence/YYYY-MM-DD-<writer-id>.md

const fs   = require('fs');
const https = require('https');
const path  = require('path');

const PROXY   = 'the-salon-ten.vercel.app';
const MODEL   = 'anthropic/claude-sonnet-4-5';
const MAX_REVISIONS = 2;
const OUTPUT_DIR    = path.join(__dirname, 'correspondence');

// ── Load personas ──────────────────────────────────────────────────────────
const { walt, writers } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'personas.json'), 'utf8')
);

// ── Pick a random writer ───────────────────────────────────────────────────
const writer = writers[Math.floor(Math.random() * writers.length)];
console.log(`\n${'═'.repeat(60)}`);
console.log(`  Writer : ${writer.name}`);
console.log(`  Editor : ${walt.name}`);
console.log(`${'═'.repeat(60)}\n`);

// ── API call ───────────────────────────────────────────────────────────────
function chat(systemPrompt, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, max_tokens: 3000, messages, system: systemPrompt });
    const req  = https.request(
      { hostname: PROXY, path: '/api/chat', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(raw);
            if (j.error) return reject(new Error(JSON.stringify(j.error)));
            resolve(j.choices[0].message.content.trim());
          } catch (e) { reject(new Error('Bad response: ' + raw.slice(0, 200))); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Section header helper ─────────────────────────────────────────────────
function section(label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'─'.repeat(60)}\n`);
}

// ── Main loop ──────────────────────────────────────────────────────────────
async function run() {
  const transcript = [];

  // Step 1: Writer drafts a story
  section(`${writer.name} — Writing story…`);
  const story = await chat(
    writer.systemPrompt,
    [{ role: 'user', content:
      'Write a short story for submission to a pulp monthly magazine. ' +
      'Choose your own subject, genre, and title. ' +
      'Aim for 1500–2500 words. Write the full story now.' }]
  );
  console.log(story);
  transcript.push({ speaker: writer.name, text: story });

  let currentStory = story;

  // Step 2+: Walt reads and responds; writer revises if asked
  for (let round = 1; round <= MAX_REVISIONS + 1; round++) {
    section(`Walt — Editorial response (round ${round})…`);
    const waltResponse = await chat(
      walt.systemPrompt,
      [{ role: 'user', content:
        `You have received the following story submission:\n\n${currentStory}\n\n` +
        `Read it as Walt, editor of the monthly. Respond in character with your editorial assessment. ` +
        `End your response on its own line with exactly one of:\n` +
        `VERDICT: ACCEPT\nVERDICT: REVISE\nVERDICT: REJECT` }]
    );
    console.log(waltResponse);
    transcript.push({ speaker: 'Walt', text: waltResponse });

    const verdict = waltResponse.match(/VERDICT:\s*(ACCEPT|REVISE|REJECT)/i)?.[1]?.toUpperCase();

    if (!verdict || verdict === 'ACCEPT' || verdict === 'REJECT' || round > MAX_REVISIONS) {
      console.log(`\n  ► Final verdict: ${verdict ?? '(none — treating as REJECT)'}`);
      break;
    }

    // Writer revises
    section(`${writer.name} — Revision ${round}…`);
    const revised = await chat(
      writer.systemPrompt,
      [{ role: 'user', content:
        `Your story was returned with the following editorial notes:\n\n${waltResponse}\n\n` +
        `Here is your original story:\n\n${currentStory}\n\n` +
        `Revise the story in response to Walt's notes. Write the full revised story now.` }]
    );
    console.log(revised);
    transcript.push({ speaker: `${writer.name} (revision ${round})`, text: revised });
    currentStory = revised;
  }

  // ── Save output ────────────────────────────────────────────────────────
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  const date     = new Date().toISOString().slice(0, 10);
  const time     = new Date().toTimeString().slice(0, 5).replace(':', '');
  const filename = path.join(OUTPUT_DIR, `${date}-${time}-${writer.id}.md`);

  const md = [
    `# ${writer.name} → Walt  (${date})`,
    '',
    ...transcript.map(t => `## ${t.speaker}\n\n${t.text}`)
  ].join('\n\n---\n\n');

  fs.writeFileSync(filename, md);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Saved: ${filename}`);
  console.log(`${'═'.repeat(60)}\n`);
}

run().catch(err => { console.error('\nERROR:', err.message); process.exit(1); });
