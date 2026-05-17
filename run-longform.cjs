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

// ── Persona categories ────────────────────────────────────────────────────────

const PERSONA_CATEGORIES = {
  machiavelli:    "Power &amp; Politics",
  montaigne:      "Essay &amp; Self-Knowledge",
  aurelius:       "Stoic Philosophy",
  nietzsche:      "Will &amp; Culture",
  hobbes:         "Power &amp; Human Nature",
  paine:          "Liberty &amp; Revolution",
  mill:           "Liberty &amp; Ethics",
  marx:           "Economy &amp; Class",
  keynes:         "Economy &amp; State",
  hayek:          "Liberty &amp; Markets",
  wollstonecraft: "Rights &amp; Feminist Thought",
  hume:           "Empiricism &amp; Scepticism",
  emerson:        "Self-Reliance &amp; Nature",
  suntzu:         "Strategy &amp; Conflict",
  camus:          "Absurdism &amp; Revolt",
  gracian:        "Wisdom &amp; Prudence",
  woolf:          "Modernism &amp; Feminist Thought",
  schopenhauer:   "Will &amp; Pessimism",
  dante:          "Justice &amp; Moral Taxonomy",
  bacon:          "Science &amp; Method",
  smith:          "Economy &amp; Moral Sentiment",
  clausewitz:     "War &amp; Strategy",
  james:          "Pragmatism &amp; Psychology",
  erasmus:        "Humanism &amp; Reform",
  suzuki:         "Zen &amp; Eastern Thought",
  austen:         "Society &amp; Manners",
  basho:          "Nature &amp; Impermanence",
};

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildEpisodeHtml(personaId, subject, text, date, portrait) {
  const persona   = PERSONAS[personaId];
  const name      = persona.name;
  const category  = PERSONA_CATEGORIES[personaId] || "Long Form";

  const portraitEl = portrait
    ? `<div class="portrait-oval"><img src="${portrait}" alt="${name}" /></div>`
    : `<div class="portrait-oval portrait-placeholder"></div>`;

  // Extract SUBJECT line if persona chose topic
  let displaySubject = subject;
  let rawBody = text;
  if (!subject) {
    const match = text.match(/^SUBJECT:\s*(.+)\n/);
    if (match) {
      displaySubject = match[1].trim();
      rawBody = text.slice(match[0].length).trim();
    }
  }

  // Convert markdown to rich HTML
  const paras = rawBody.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  let firstPara = true;
  const bodyHtml = paras.map(p => {
    // # Heading → section-head
    if (/^#+\s+/.test(p)) {
      return `<span class="section-head">${p.replace(/^#+\s+/, "")}</span>`;
    }
    // **standalone bold** → principle-head
    if (/^\*\*.+\*\*$/.test(p)) {
      return `<span class="principle-head">${p.replace(/^\*\*|\*\*$/g, "")}</span>`;
    }
    // Regular paragraph
    const html = p
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, " ");
    if (firstPara) { firstPara = false; return `<p class="drop-cap">${html}</p>`; }
    return `<p>${html}</p>`;
  }).join("\n");

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dateStr = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  const byline  = `${name} · ${dateStr}`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="parchment">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Salon — ${name}: ${displaySubject || "Long Form"}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  [data-theme="parchment"] {
    --ink: #1a1510; --parchment: #f7f2e8; --cream: #fdfaf4;
    --gold: #b8924a; --gold-light: #d4aa6a; --crimson: #8b1a1a;
    --rule: #d6c9a8; --body-text: #2c2418; --header-bg: #1a1510;
    --muted: #9a8870; --aged: #e8dfc8; --amber: #b8924a;
  }
  [data-theme="medici"] {
    --ink: #f0e6d0; --parchment: #1a0a06; --cream: #2a1208;
    --gold: #c9962a; --gold-light: #e8b84b; --crimson: #c0362a;
    --rule: #5a2a18; --body-text: #e8d8b8; --header-bg: #0e0502;
    --muted: #c8a870; --aged: #3a1a0a; --amber: #c9962a;
  }
  [data-theme="medici"] body::before {
    content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cdefs%3E%3CradialGradient id='b' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.03'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.12'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='60' height='60' fill='none'/%3E%3Cellipse cx='30' cy='30' rx='18' ry='18' fill='url(%23b)'/%3E%3C/svg%3E");
    background-size:60px 60px;
  }
  html { scroll-behavior: smooth; }
  body { background: var(--parchment); color: var(--ink); font-family: 'Cormorant Garamond', serif; font-size: 18px; transition: background 0.4s, color 0.4s; }

  .site-header { background: var(--header-bg); color: var(--ink); text-align: center; padding: 1.5rem 2rem 0; border-bottom: 3px solid var(--gold); position: relative; z-index: 10; }
  .masthead-controls { position: absolute; top: 1rem; right: 1.5rem; display: flex; gap: 0.5rem; }
  .theme-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.4); font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.15em; padding: 0.3rem 0.7rem; cursor: pointer; text-transform: uppercase; transition: all 0.2s; }
  .theme-btn:hover, .theme-btn.active { border-color: var(--gold); color: var(--gold); }
  .masthead-rule { width: 60px; height: 1px; background: var(--gold); margin: 0 auto 1rem; opacity: 0.6; }
  .masthead-title { font-family: 'Cinzel', serif; font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 400; letter-spacing: 0.15em; color: var(--gold-light); margin-bottom: 0.3rem; }
  .masthead-subtitle { font-family: 'Cormorant Garamond', serif; font-size: 0.85rem; letter-spacing: 0.2em; color: var(--muted); text-transform: uppercase; margin-bottom: 1rem; }

  .site-nav { display: flex; justify-content: center; align-items: center; gap: 2rem; padding: 0.8rem 2rem; background: var(--header-bg); border-bottom: 1px solid var(--rule); position: sticky; top: 0; z-index: 20; }
  .site-nav a { font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); text-decoration: none; border-bottom: 1px solid transparent; padding-bottom: 2px; transition: all 0.2s; }
  .site-nav a:hover { color: var(--gold-light); }
  .site-nav a.active { color: var(--gold-light); border-bottom-color: var(--gold); }
  .site-nav .nav-divider { width: 1px; height: 0.9rem; background: var(--rule); opacity: 0.4; }

  .episode-wrap { max-width: 720px; margin: 0 auto; padding: 4rem 2rem 6rem; position: relative; z-index: 1; }

  .episode-header { border-bottom: 2px solid var(--gold); padding-bottom: 2rem; margin-bottom: 3rem; display: flex; gap: 2rem; align-items: flex-start; }
  .portrait-oval { width: 90px; height: 90px; border-radius: 50%; overflow: hidden; border: 2px solid var(--amber); flex-shrink: 0; margin-top: 0.3rem; }
  .portrait-oval img { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
  .portrait-placeholder { background: var(--aged); }
  .episode-meta { flex: 1; }
  .episode-eyebrow { font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.35em; text-transform: uppercase; color: var(--amber); margin-bottom: 0.7rem; display: block; }
  .episode-title { font-family: 'IM Fell English', serif; font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 400; line-height: 1.25; color: var(--ink); margin-bottom: 0.5rem; }
  .episode-byline { font-family: 'Cormorant Garamond', serif; font-size: 0.9rem; font-style: italic; color: var(--muted); }

  .episode-body { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; line-height: 1.9; color: var(--body-text); }
  .episode-body p { margin-bottom: 1.5rem; }
  .episode-body p.drop-cap::first-letter { font-family: 'IM Fell English', serif; font-size: 4.2em; float: left; line-height: 0.75; margin: 0.1em 0.1em 0 0; color: var(--amber); }
  .section-head { display: block; font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--amber); margin: 2.8rem 0 1rem; }
  .principle-head { display: block; font-family: 'Cormorant Garamond', serif; font-size: 1rem; font-weight: 600; color: var(--gold-light); margin: 1.8rem 0 0.5rem; }

  .episode-footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
  .footer-label { font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); font-style: italic; }
  .footer-link { font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.15em; text-transform: uppercase; padding: 0.5rem 1.2rem; border: 1px solid var(--rule); color: var(--muted); text-decoration: none; transition: all 0.2s; }
  .footer-link:hover { border-color: var(--gold); color: var(--gold); }

  footer { text-align: center; padding: 2rem; font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); opacity: 0.5; border-top: 1px solid var(--rule); position: relative; z-index: 1; }

  @media (max-width: 600px) {
    .episode-wrap { padding: 2rem 1rem 4rem; }
    .episode-header { flex-direction: column; }
  }
</style>
</head>
<body>

<header class="site-header">
  <div class="masthead-controls">
    <button class="theme-btn" data-t="parchment">Parchment</button>
    <button class="theme-btn" data-t="medici">Medici</button>
  </div>
  <hr class="masthead-rule">
  <h1 class="masthead-title">The Salon</h1>
  <p class="masthead-subtitle">Voices across time</p>
</header>

<nav class="site-nav">
  <a href="../index.html">The Salon</a>
  <span class="nav-divider"></span>
  <a href="../salon-index.html">The Judgement</a>
  <span class="nav-divider"></span>
  <a href="../voices.html">The Voices</a>
  <span class="nav-divider"></span>
  <a href="../longform.html">The Long Form</a>
  <span class="nav-divider"></span>
  <a href="index.html" class="active">The Archive</a>
</nav>

<article class="episode-wrap">
  <div class="episode-header">
    ${portraitEl}
    <div class="episode-meta">
      <span class="episode-eyebrow">The Salon — Long Form · ${category}</span>
      <h1 class="episode-title">${displaySubject || "An Essay"}</h1>
      <div class="episode-byline">${byline}</div>
    </div>
  </div>

  <div class="episode-body">
${bodyHtml}
  </div>

  <div class="episode-footer">
    <span class="footer-label">The Salon · Long Form</span>
    <a href="index.html" class="footer-link">← All episodes</a>
  </div>
</article>

<footer>The Salon · Long Form · ${name} · ${dateStr}</footer>

<script>
  const themeBtns = document.querySelectorAll('.theme-btn');
  const savedTheme = localStorage.getItem('salon-theme') || 'parchment';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeBtns.forEach(b => b.classList.toggle('active', b.dataset.t === savedTheme));
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.documentElement.setAttribute('data-theme', btn.dataset.t);
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('salon-theme', btn.dataset.t);
    });
  });
</script>
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

  // Extract display subject (needed if persona self-nominated)
  let displaySubject = subject;
  if (!subject) {
    const match = text.match(/^SUBJECT:\s*(.+)\n/);
    if (match) displaySubject = match[1].trim();
  }
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dateStr = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  const category = PERSONA_CATEGORIES[personaId] || "Long Form";
  const portraitTag = portrait
    ? `<img src="${portrait}" alt="" />`
    : "";

  console.log(`\n  ── Paste into longform/index.html ──────────────────────────`);
  console.log(`
    <a class="episode-card" href="${filename}">
      <div class="card-portrait-wrap"><div class="card-portrait">${portraitTag}</div></div>
      <div class="card-content">
        <span class="card-eyebrow">The Salon — Long Form · ${category}</span>
        <h2 class="card-title">${displaySubject || "An Essay"}</h2>
        <p class="card-byline">${persona.name} · ${dateStr}</p>
      </div>
      <span class="card-arrow">→</span>
    </a>`);
  console.log(`\n  Also update the episode count in the page-count and footer lines.`);
  console.log(`  ────────────────────────────────────────────────────────────\n`);
})();
