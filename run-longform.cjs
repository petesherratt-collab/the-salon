// run-longform.js
// The Salon — Long Form Episode Generator
// Usage: node run-longform.js <persona-id> ["subject"]
// If subject is omitted, the persona nominates their own topic.

const fs   = require("fs");
const path = require("path");
const https = require("https");

// ── Config ────────────────────────────────────────────────────────────────────

// Locate .env in the git repo root — works from any worktree
(function loadEnv() {
  const { execSync } = require("child_process");
  try {
    const gitCommonDir = execSync("git rev-parse --git-common-dir", { cwd: __dirname, encoding: "utf8" }).trim();
    const repoRoot = path.resolve(__dirname, gitCommonDir, "..");
    require("dotenv").config({ path: path.join(repoRoot, ".env") });
  } catch {
    require("dotenv").config();
  }
})();
const API_KEY  = process.env.OPENROUTER_API_KEY;
const MODEL    = "anthropic/claude-sonnet-4-6";
const BASE_URL = "https://openrouter.ai/api/v1";

// ── Persona roster ────────────────────────────────────────────────────────────

const PERSONAS = {
  machiavelli:    { name: "Niccolò Machiavelli",   wiki: "Niccolò_Machiavelli" },
  montaigne:      { name: "Michel de Montaigne",   wiki: "Michel_de_Montaigne" },
  aurelius:       { name: "Marcus Aurelius",        wiki: "Marcus_Aurelius" },
  nietzsche:      { name: "Friedrich Nietzsche",    wiki: "Friedrich_Nietzsche" },
  hobbes:         { name: "Thomas Hobbes",          wiki: "Thomas_Hobbes" },
  paine:          { name: "Thomas Paine",           wiki: "Thomas_Paine" },
  mill:           { name: "John Stuart Mill",       wiki: "John_Stuart_Mill" },
  marx:           { name: "Karl Marx",              wiki: "Karl_Marx" },
  keynes:         { name: "John Maynard Keynes",    wiki: "John_Maynard_Keynes" },
  hayek:          { name: "Friedrich Hayek",        wiki: "Friedrich_Hayek" },
  wollstonecraft: { name: "Mary Wollstonecraft",    wiki: "Mary_Wollstonecraft" },
  hume:           { name: "David Hume",             wiki: "David_Hume" },
  emerson:        { name: "Ralph Waldo Emerson",    wiki: "Ralph_Waldo_Emerson" },
  suntzu:         { name: "Sun Tzu",                wiki: "Sun_Tzu" },
  camus:          { name: "Albert Camus",           wiki: "Albert_Camus" },
  gracian:        { name: "Baltasar Gracián",       wiki: "Baltasar_Gracián" },
  woolf:          { name: "Virginia Woolf",         wiki: "Virginia_Woolf" },
  schopenhauer:   { name: "Arthur Schopenhauer",    wiki: "Arthur_Schopenhauer" },
  dante:          { name: "Dante Alighieri",        wiki: "Dante_Alighieri" },
  bacon:          { name: "Francis Bacon",          wiki: "Francis_Bacon" },
  smith:          { name: "Adam Smith",             wiki: "Adam_Smith" },
  clausewitz:     { name: "Carl von Clausewitz",    wiki: "Carl_von_Clausewitz" },
  james:          { name: "William James",          wiki: "William_James" },
  erasmus:        { name: "Desiderius Erasmus",     wiki: "Desiderius_Erasmus" },
  suzuki:         { name: "D.T. Suzuki",            wiki: "D._T._Suzuki" },
  austen:         { name: "Jane Austen",            wiki: "Jane_Austen" },
  basho:          { name: "Matsuo Bashō",           wiki: "Matsuo_Bashō" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pad(n) { return String(n).padStart(2, "0"); }

function dateStamp(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function timeStamp(d) {
  return `${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? require("https") : require("http");
    proto.get(url, { headers: { "User-Agent": "TheSalon/1.0" } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(httpGet(res.headers.location));
      }
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function fetchPortrait(wikiSlug) {
  try {
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiSlug)}`;
    const body   = await httpGet(apiUrl);
    const json   = JSON.parse(body);
    return json.thumbnail ? json.thumbnail.source : null;
  } catch {
    return null;
  }
}

async function fetchEpisode(personaId, subject) {
  const persona = PERSONAS[personaId];
  const name    = persona.name;

  const systemPrompt = subject
    ? `You are ${name}. You are delivering a long-form essay for The Salon — a journal of historical thinkers applied to contemporary affairs. Your voice is your own: shaped by your era, your philosophy, your habits of mind. You have full knowledge of events up to the present day, but you analyse them through your own intellectual framework.

Write a single sustained essay of approximately 1,800–2,200 words on the following subject: "${subject}". 

The essay should:
- Open with a strong, opinionated statement — no preamble, no throat-clearing
- Develop a sustained argument across several sections (use bold headings sparingly, or none at all — this is an essay, not a listicle)
- Draw on your own historical experience and intellectual tradition
- Apply your genuine analytical framework to the contemporary evidence
- Close with a maxim, verdict, or arresting final line — something the reader will carry away

Write for an educated general reader who does not require explanation of your historical context but will benefit from your perspective on theirs.`

    : `You are ${name}. You are delivering a long-form essay for The Salon — a journal of historical thinkers applied to contemporary affairs. Your voice is your own: shaped by your era, your philosophy, your habits of mind. You have full knowledge of events up to the present day, but you analyse them through your own intellectual framework.

Choose a subject that you — ${name} — find genuinely pressing in the current moment. It should be a question or theme where your particular perspective yields insight that a modern commentator could not easily provide.

Then write a single sustained essay of approximately 1,800–2,200 words on that subject.

The essay should:
- Open with a strong, opinionated statement — no preamble, no throat-clearing
- Develop a sustained argument across several sections (use bold headings sparingly, or none at all — this is an essay, not a listicle)
- Draw on your own historical experience and intellectual tradition
- Apply your genuine analytical framework to the contemporary evidence
- Close with a maxim, verdict, or arresting final line — something the reader will carry away

Begin with one line that states the subject you have chosen, formatted as: SUBJECT: [your chosen subject]
Then begin the essay immediately on the next line.`;

  const payload = JSON.stringify({
    model: MODEL,
    max_tokens: 3000,
    messages: [{ role: "user", content: systemPrompt }]
  });

  const data = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "openrouter.ai",
      path: "/api/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "https://the-salon-ten.vercel.app",
        "X-Title": "The Salon"
      }
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });

  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildEpisodeHtml(personaId, subject, text, date, portrait) {
  const persona    = PERSONAS[personaId];
  const name       = persona.name;
  const portraitEl = portrait
    ? `<img src="${portrait}" alt="${name}" class="portrait">`
    : `<div class="portrait-placeholder"></div>`;

  // Extract SUBJECT line if persona chose topic
  let displaySubject = subject;
  let body = text;
  if (!subject) {
    const match = text.match(/^SUBJECT:\s*(.+)\n/);
    if (match) {
      displaySubject = match[1].trim();
      body = text.slice(match[0].length).trim();
    }
  }

  // Convert **bold** and line breaks
  body = body
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => p.startsWith("<strong>") && p.endsWith("</strong>")
      ? `<h3>${p.replace(/<\/?strong>/g, "")}</h3>`
      : `<p>${p.replace(/\n/g, " ")}</p>`)
    .join("\n");

  const dateStr = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} — ${displaySubject || "Long Form"} | The Salon</title>
<style>
  :root {
    --parchment: #f5f0e8;
    --ink: #1a1208;
    --muted: #6b5e45;
    --accent: #8b1a1a;
    --border: #c8b89a;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--parchment);
    color: var(--ink);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.75;
  }
  .site-nav {
    background: var(--ink);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .site-nav a {
    color: var(--parchment);
    text-decoration: none;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .site-nav a:hover { opacity: 1; }
  .nav-divider { color: var(--border); opacity: 0.4; }
  header.episode-header {
    max-width: 740px;
    margin: 48px auto 0;
    padding: 0 24px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 32px;
  }
  .rubric {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 16px;
  }
  .persona-row {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
  }
  .portrait {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border);
    filter: sepia(30%);
  }
  .portrait-placeholder {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--border);
  }
  .persona-name {
    font-size: 14px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h1.episode-title {
    font-size: 2rem;
    line-height: 1.25;
    margin-bottom: 12px;
    color: var(--ink);
  }
  .episode-date {
    font-size: 13px;
    color: var(--muted);
  }
  article {
    max-width: 740px;
    margin: 40px auto 80px;
    padding: 0 24px;
  }
  article p {
    margin-bottom: 1.4em;
  }
  article h3 {
    font-size: 1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 2em 0 0.8em;
  }
  article p:last-child {
    font-style: italic;
    border-top: 1px solid var(--border);
    padding-top: 1.2em;
    margin-top: 2em;
  }
  .back-link {
    display: inline-block;
    margin: 32px 24px 0;
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
    text-decoration: none;
  }
  .back-link:hover { text-decoration: underline; }
</style>
</head>
<body>
<nav class="site-nav">
  <a href="../index.html">The Salon</a>
  <span class="nav-divider">|</span>
  <a href="../salon-index.html">Archive</a>
  <span class="nav-divider">|</span>
  <a href="../voices.html">Voices</a>
  <span class="nav-divider">|</span>
  <a href="index.html">Long Form</a>
</nav>

<a class="back-link" href="index.html">← Long Form</a>

<header class="episode-header">
  <div class="rubric">Long Form Essay</div>
  <div class="persona-row">
    ${portraitEl}
    <span class="persona-name">${name}</span>
  </div>
  <h1 class="episode-title">${displaySubject || "An Essay"}</h1>
  <div class="episode-date">${dateStr}</div>
</header>

<article>
${body}
</article>

</body>
</html>`;
}

function buildIndex(longformDir) {
  const files = fs.readdirSync(longformDir)
    .filter(f => f.endsWith(".html") && f !== "index.html")
    .sort()
    .reverse();

  const items = files.map(f => {
    const content = fs.readFileSync(path.join(longformDir, f), "utf8");

    // New format
    const titleMatch   = content.match(/<h1 class="episode-title">(.+?)<\/h1>/);
    const personaMatch = content.match(/<span class="persona-name">(.+?)<\/span>/);
    const dateMatch    = content.match(/<div class="episode-date">(.+?)<\/div>/);

    // Old format fallbacks
    const bylineMatch  = content.match(/<div class="episode-byline">(.+?)<\/div>/);
    const htmlTitleMatch = content.match(/<title>(.+?)<\/title>/);

    let title  = titleMatch  ? titleMatch[1]  : null;
    let persona = personaMatch ? personaMatch[1] : "";
    let date   = dateMatch   ? dateMatch[1]   : "";

    if (!title && htmlTitleMatch) {
      // "The Salon — Hobbes: Trump and Iran" → "Trump and Iran"
      title = htmlTitleMatch[1].replace(/^The Salon\s*[—–-]\s*[^:]+:\s*/i, "").replace(/\s*\|\s*The Salon$/, "").trim();
    }
    if (!title) title = f;

    if (!persona && !date && bylineMatch) {
      const parts = bylineMatch[1].split(/\s*[·•]\s*/);
      persona = parts[0] ? parts[0].trim() : "";
      date    = parts[1] ? parts[1].trim() : "";
    }

    return `<li><a href="${f}"><span class="li-title">${title}</span><span class="li-meta">${persona} &mdash; ${date}</span></a></li>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Long Form | The Salon</title>
<style>
  :root {
    --parchment: #f5f0e8;
    --ink: #1a1208;
    --muted: #6b5e45;
    --accent: #8b1a1a;
    --border: #c8b89a;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--parchment);
    color: var(--ink);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 17px;
    line-height: 1.7;
  }
  .site-nav {
    background: var(--ink);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .site-nav a {
    color: var(--parchment);
    text-decoration: none;
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .site-nav a:hover { opacity: 1; }
  .nav-divider { color: var(--border); opacity: 0.4; }
  main {
    max-width: 740px;
    margin: 48px auto 80px;
    padding: 0 24px;
  }
  h1 {
    font-size: 1.8rem;
    margin-bottom: 8px;
  }
  .intro {
    color: var(--muted);
    font-size: 15px;
    margin-bottom: 40px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 24px;
  }
  ul { list-style: none; }
  ul li {
    border-bottom: 1px solid var(--border);
    padding: 16px 0;
  }
  ul li a {
    text-decoration: none;
    color: var(--ink);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  ul li a:hover .li-title { color: var(--accent); }
  .li-title { font-size: 1.1rem; }
  .li-meta {
    font-size: 13px;
    color: var(--muted);
    letter-spacing: 0.04em;
  }
</style>
</head>
<body>
<nav class="site-nav">
  <a href="../index.html">The Salon</a>
  <span class="nav-divider">|</span>
  <a href="../salon-index.html">Archive</a>
  <span class="nav-divider">|</span>
  <a href="../voices.html">Voices</a>
  <span class="nav-divider">|</span>
  <a href="index.html">Long Form</a>
</nav>
<main>
  <h1>Long Form</h1>
  <p class="intro">Extended essays from the voices of The Salon — one thinker, one subject, uninterrupted.</p>
  <ul>
${items}
  </ul>
</main>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const [,, personaId, subject] = process.argv;

  if (personaId === "--rebuild-index") {
    const longformDir = path.join(__dirname, "longform");
    const indexFile = path.join(longformDir, "index.html");
    fs.writeFileSync(indexFile, buildIndex(longformDir), "utf8");
    console.log("  Index rebuilt: longform/index.html");
    process.exit(0);
  }

  if (!personaId || !PERSONAS[personaId]) {
    console.log("\nUsage: node run-longform.js <persona-id> [\"subject\"]\n");
    console.log("       node run-longform.js --rebuild-index\n");
    console.log("Available personas:", Object.keys(PERSONAS).join(", "));
    process.exit(1);
  }

  if (!API_KEY) {
    console.error("Error: OPENROUTER_API_KEY not found in .env");
    process.exit(1);
  }

  const persona = PERSONAS[personaId];
  const date    = new Date();
  const ds      = dateStamp(date);
  const ts      = timeStamp(date);
  const slug    = subject ? slugify(subject) : "self-nominated";
  const filename = `${ds}-${ts}-${personaId}-${slug}.html`;

  const longformDir = path.join(__dirname, "longform");
  if (!fs.existsSync(longformDir)) fs.mkdirSync(longformDir);

  const outFile = path.join(longformDir, filename);

  console.log(`\n  The Salon — Long Form Generator`);
  console.log(`  ${"─".repeat(40)}`);
  console.log(`  Persona  : ${persona.name}`);
  console.log(`  Subject  : ${subject || "(persona chooses)"}`);

  // Fetch portrait
  process.stdout.write(`  Portrait : `);
  const portrait = await fetchPortrait(persona.wiki);
  console.log(portrait ? "found" : "not found (using placeholder)");

  // Generate episode
  process.stdout.write(`  Generating episode… `);
  let text;
  try {
    text = await fetchEpisode(personaId, subject);
    console.log("✓");
  } catch (err) {
    console.log(`✗\n  Error: ${err.message}`);
    process.exit(1);
  }

  // Write episode HTML
  const episodeHtml = buildEpisodeHtml(personaId, subject, text, date, portrait);
  fs.writeFileSync(outFile, episodeHtml, "utf8");

  const wordCount = text.split(/\s+/).length;
  console.log(`\n  Done. ~${wordCount} words.`);
  console.log(`  Episode : longform/${filename}`);
  console.log(`\n  Add the entry manually to longform/index.html, then push.\n`);
})();
