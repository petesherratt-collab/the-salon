// run-judgements.js
// Replicates the salon-batch-processor React app as a command-line Node.js script.
// Usage: node run-judgements.js <input.csv> [output.csv] [concurrency]
// Node 18+ is required (built-in fetch). For older Node, install node-fetch.

const fs   = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL              = "anthropic/claude-sonnet-4-5";
const MAX_TOKENS         = 1000;
const RETRIES            = 3;

const PERSONAS = [
  { id: "machiavelli",    name: "Machiavelli",        domain: "Power & Politics",        emoji: "⚔️",  wiki: "Niccolò_Machiavelli" },
  { id: "montaigne",      name: "Montaigne",           domain: "Self & Society",           emoji: "📜",  wiki: "Michel_de_Montaigne" },
  { id: "aurelius",       name: "Marcus Aurelius",     domain: "Stoic Ethics",             emoji: "🏛️", wiki: "Marcus_Aurelius" },
  { id: "austen",         name: "Austen",              domain: "Society & Motive",         emoji: "💎",  wiki: "Jane_Austen" },
  { id: "nietzsche",      name: "Nietzsche",           domain: "Will & Value",             emoji: "⚡",  wiki: "Friedrich_Nietzsche" },
  { id: "camus",          name: "Camus",               domain: "Absurdity & Revolt",       emoji: "🌊",  wiki: "Albert_Camus" },
  { id: "basho",          name: "Bashō",               domain: "Impermanence & Presence",  emoji: "🍃",  wiki: "Matsuo_Bashō" },
  { id: "mill",           name: "Mill",                domain: "Liberty & Utility",        emoji: "⚖️",  wiki: "John_Stuart_Mill" },
  { id: "emerson",        name: "Emerson",             domain: "Self-Reliance & Nature",   emoji: "🌿",  wiki: "Ralph_Waldo_Emerson" },
  { id: "paine",          name: "Thomas Paine",        domain: "Revolution & Rights",      emoji: "🔥",  wiki: "Thomas_Paine" },
  { id: "hobbes",         name: "Hobbes",              domain: "Power & Human Nature",     emoji: "👁️", wiki: "Thomas_Hobbes" },
  { id: "suntzu",         name: "Sun Tzu",             domain: "Strategy & Deception",        emoji: "🎴",  wiki: "Sun_Tzu" },
  { id: "keynes",         name: "Keynes",              domain: "Economy & State",              emoji: "📊",  wiki: "John_Maynard_Keynes" },
  { id: "hayek",          name: "Hayek",               domain: "Freedom & Spontaneous Order",  emoji: "🏗️", wiki: "Friedrich_Hayek" },
  { id: "wollstonecraft", name: "Wollstonecraft",      domain: "Reason & Equal Rights",        emoji: "✊",  wiki: "Mary_Wollstonecraft" },
  { id: "bacon",          name: "Francis Bacon",       domain: "Knowledge & Method",           emoji: "🔬",  wiki: "Francis_Bacon" },
  { id: "hume",           name: "Hume",                domain: "Scepticism & Human Nature",    emoji: "🪞",  wiki: "David_Hume" },
  { id: "adamsmith",      name: "Adam Smith",          domain: "Markets & Moral Sentiment",    emoji: "🏪",  wiki: "Adam_Smith" },
];

// ── Portrait fetching ─────────────────────────────────────────────────────────
async function fetchPortraits(personas) {
  const portraits = {};
  await Promise.all(personas.map(async p => {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${p.wiki}`, {
        headers: { "User-Agent": "TheSalonBatchProcessor/1.0" }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.thumbnail?.source) portraits[p.id] = data.thumbnail.source;
    } catch {
      // portrait fetch failure is non-fatal — card falls back to emoji
    }
  }));
  return portraits;
}

const SYSTEM_PROMPT = (p) =>
  `You are ${p.name}, the historical thinker, operating as a Salon persona. Your domain is ${p.domain}.

Deliver a Judgement in exactly this structure (no headers, no meta-commentary):

1. FRAMING (1–2 sentences): Restate the topic through your distinctive philosophical lens.
2. REFRAME (2–3 sentences): Apply your core ideas to illuminate what is really at stake.
3. VERDICT (1 sentence): An unambiguous, declarative judgement. No hedging.
4. MAXIM (1 sentence, italicised with *asterisks*): A standalone aphorism distilling your verdict — quotable, sharp, memorable.

Total length: 120–180 words. Write in first person. Be specific, not generic. Channel your actual recorded thought where possible.`;

// ── CSV helpers ──────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { topics: [], personaIds: null, questionerId: null };

  // Optional prefix lines (any order): "personas: ..." and "questioner: ..."
  let personaIds = null;
  let questionerId = null;
  let rest = lines;
  while (rest.length) {
    const lower = rest[0].toLowerCase();
    if (lower.startsWith("personas:")) {
      const ids = rest[0].slice("personas:".length)
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      personaIds = ids.length ? ids : null;
      rest = rest.slice(1);
    } else if (lower.startsWith("questioner:")) {
      const id = rest[0].slice("questioner:".length).trim().toLowerCase();
      questionerId = id || null;
      rest = rest.slice(1);
    } else {
      break;
    }
  }

  const header = rest[0]?.toLowerCase().trim();
  const hasHeader = ["topic", "question", "prompt", "topics"].includes(header);
  const topics = (hasHeader ? rest.slice(1) : rest).map(l => l.trim()).filter(Boolean);
  return { topics, personaIds, questionerId };
}

function escapeCsvCell(val) {
  const str = String(val ?? "");
  return (str.includes(",") || str.includes('"') || str.includes("\n"))
    ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildCsvRow(cells) {
  return cells.map(escapeCsvCell).join(",");
}

// ── HTML output ───────────────────────────────────────────────────────────────
function formatJudgement(text) {
  if (!text) return '<p class="empty">No judgement generated.</p>';

  // 1. Strip numbered section labels in all their variations:
  //    "1. FRAMING —", "2. REFRAME:", "4. MAXIM (1 sentence...)", etc.
  //    Also strip bare labels on their own line: "FRAMING", "VERDICT"
  let cleaned = text
    .replace(/^\s*\d+\.\s+[A-Z][A-Z\s]+[\-—:(].*/gm, "")  // "1. FRAMING — ..." whole line
    .replace(/^\s*\d+\.\s+[A-Z][A-Z\s]+\s*$/gm, "")        // "1. FRAMING" alone
    .replace(/^\s*[A-Z]{4,}[\-—:]\s*/gm, "");               // "FRAMING —" bare label

  // 2. Clean up stray asterisks that the model left without proper wrapping
  //    e.g. "*thingsAbundance..." or "sameness the sentence.*"
  //    Strategy: find clean *...* spans first, then strip remaining lone asterisks
  let maxim = "";

  // Try to find a well-formed *maxim* — must be at least 10 chars, no line breaks
  const maximMatch = cleaned.match(/\*([^*\n]{10,})\*/);
  if (maximMatch) {
    maxim = maximMatch[1].trim();
    cleaned = cleaned.replace(/\*([^*\n]{10,})\*/, "");
  }

  // Strip any remaining lone asterisks (malformed markup)
  cleaned = cleaned.replace(/\*/g, "");

  // 3. Split into paragraphs, clean up, filter empties
  const paragraphs = cleaned
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 1); // filter stray punctuation lines

  // 4. If no clean *maxim* found, treat the last paragraph as the maxim
  //    (the model always puts the aphorism last)
  if (!maxim && paragraphs.length > 1) {
    maxim = paragraphs.pop();
  }

  // 5. Render: prose paragraphs first, then maxim with gold border
  const prose = paragraphs.map(p => `<p>${p}</p>`).join("");
  const maximHtml = maxim
    ? `<p><em class="maxim">${maxim}</em></p>`
    : "";

  return prose + maximHtml;
}

// ── Split judgement into labelled prose + maxim ───────────────────────────────
function splitJudgement(text) {
  if (!text) return { prose: '<p class="empty">No judgement generated.</p>', maxim: "" };

  // Extract maxim first (asterisk-wrapped) — most reliable signal
  let cleaned = text;
  let maxim = "";
  const maximMatch = cleaned.match(/\*([^*\n]{15,})\*/);
  if (maximMatch) {
    maxim = maximMatch[1].trim();
    cleaned = cleaned.replace(/\*([^*\n]{15,})\*/, "");
  }
  cleaned = cleaned.replace(/\*/g, "");

  // Map section labels to display names and classes
  const LABEL_MAP = {
    "FRAMING":  { display: "Framing",  cls: "" },
    "REFRAME":  { display: "Reframe",  cls: "" },
    "VERDICT":  { display: "Verdict",  cls: "prose-verdict" },
    "MAXIM":    { display: "Maxim",    cls: "" },
  };

  const segments = [];
  const lines = cleaned.split(/\n/);
  let currentLabel = null;
  let currentLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const labelMatch = trimmed.match(/^(?:\d+\.\s+)?([A-Z]{4,})[\s\-—:(]*(.*)/);
    if (labelMatch && LABEL_MAP[labelMatch[1]]) {
      if (currentLines.some(l => l.trim())) {
        segments.push({ label: currentLabel, text: currentLines.join("\n").trim() });
      }
      currentLabel = labelMatch[1];
      currentLines = labelMatch[2] ? [labelMatch[2]] : [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.some(l => l.trim())) {
    segments.push({ label: currentLabel, text: currentLines.join("\n").trim() });
  }

  // If a MAXIM segment was found and no asterisk maxim, use it
  if (!maxim) {
    const maximSeg = segments.find(s => s.label === "MAXIM");
    if (maximSeg && maximSeg.text.split(/\s+/).length >= 6) {
      maxim = maximSeg.text;
    }
  }

  // Remove MAXIM segment from prose
  const proseSegments = segments.filter(s => s.label !== "MAXIM");

  // If no labels found at all, fall back to plain paragraphs
  if (!proseSegments.length || proseSegments.every(s => !s.label && !s.text)) {
    const paragraphs = cleaned.split(/\n+/).map(p => p.trim()).filter(p => p.length > 10);
    // Only use last paragraph as maxim fallback if it looks complete (8+ words, ends with punctuation)
    if (!maxim && paragraphs.length > 1) {
      const last = paragraphs[paragraphs.length - 1];
      const wordCount = last.split(/\s+/).length;
      if (wordCount >= 8 && /[.!"]$/.test(last)) {
        maxim = paragraphs.pop();
      }
    }
    const prose = paragraphs.map(p => `<p>${p}</p>`).join("");
    return { prose, maxim };
  }

  // Build HTML with labels
  let proseHtml = "";
  for (const seg of proseSegments) {
    if (!seg.text) continue;
    const info = seg.label ? LABEL_MAP[seg.label] : null;
    if (info) {
      proseHtml += `<span class="prose-label">${info.display}</span>`;
    }
    const paraClass = info?.cls ? ` class="${info.cls}"` : "";
    const paraText = seg.text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 1).join(" ");
    if (paraText) proseHtml += `<p${paraClass}>${paraText}</p>`;
  }

  return { prose: proseHtml, maxim };
}

function buildHtml(topics, results, date, personas, portraits, questioner) {
  const posedByLine = questioner
    ? `<p class="posed-by" data-questioner-id="${questioner.id}">Posed by <span class="posed-by-name">${questioner.name}</span></p>`
    : "";
  const topicBlocks = topics.map(topic => {
    const cards = personas.map(p => {
      const raw = results.get(`${topic}::${p.id}`) ?? "";
      const portraitHtml = portraits[p.id]
        ? `<div class="portrait-oval"><img src="${portraits[p.id]}" alt="${p.name}" /></div>`
        : `<span class="emoji">${p.emoji}</span>`;
      const { prose, maxim } = splitJudgement(raw);
      return `
        <div class="card" data-persona="${p.id}">
          <div class="card-header" role="button" aria-expanded="false">
            ${portraitHtml}
            <div class="card-meta">
              <span class="persona-name">${p.name}</span>
              <span class="domain">${p.domain}</span>
            </div>
            <span class="expand-icon">＋</span>
          </div>
          <div class="card-body">
            <div class="card-prose">${prose}</div>
            ${maxim ? `<p><em class="maxim">${maxim}</em></p>` : ""}
          </div>
        </div>`;
    }).join("");

    return `
      <section class="topic-section">
        ${posedByLine}
        <h2 class="topic-heading">
          <span class="topic-label">The Question</span>
          ${topic}
        </h2>
        <div class="cards-grid">${cards}</div>
      </section>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en" data-theme="parchment">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Salon — Judgements ${date}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Parchment theme (default) ── */
    [data-theme="parchment"] {
      --ink:        #1a1510;
      --parchment:  #f7f2e8;
      --cream:      #fdfaf4;
      --gold:       #b8924a;
      --gold-light: #d4aa6a;
      --crimson:    #8b1a1a;
      --rule:       #d6c9a8;
      --shadow:     rgba(26,21,16,0.08);
      --body-text:  #2c2418;
      --header-bg:  #1a1510;
    }

    /* ── Medici theme ── */
    [data-theme="medici"] {
      --ink:        #f0e6d0;
      --parchment:  #1a0a06;
      --cream:      #2a1208;
      --gold:       #c9962a;
      --gold-light: #e8b84b;
      --crimson:    #c0362a;
      --rule:       #5a2a18;
      --shadow:     rgba(0,0,0,0.4);
      --body-text:  #e8d8b8;
      --header-bg:  #0e0502;
    }

    body {
      background: var(--parchment);
      color: var(--ink);
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 17px;
      line-height: 1.7;
      transition: background 0.4s ease, color 0.4s ease;
      position: relative;
    }

    /* ── Medici velvet texture overlay ── */
    [data-theme="medici"] body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cdefs%3E%3CradialGradient id='b' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.03'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.12'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='60' height='60' fill='none'/%3E%3Cellipse cx='30' cy='30' rx='18' ry='18' fill='url(%23b)'/%3E%3Cline x1='30' y1='12' x2='0' y2='30' stroke='%23000' stroke-opacity='0.08' stroke-width='0.5'/%3E%3Cline x1='30' y1='12' x2='60' y2='30' stroke='%23000' stroke-opacity='0.08' stroke-width='0.5'/%3E%3Cline x1='0' y1='30' x2='30' y2='48' stroke='%23000' stroke-opacity='0.08' stroke-width='0.5'/%3E%3Cline x1='60' y1='30' x2='30' y2='48' stroke='%23000' stroke-opacity='0.08' stroke-width='0.5'/%3E%3C/svg%3E");
      background-size: 60px 60px;
      pointer-events: none;
      z-index: 0;
      opacity: 1;
    }

    /* Ensure content sits above texture */
    [data-theme="medici"] .site-header,
    [data-theme="medici"] main,
    [data-theme="medici"] footer,
    [data-theme="medici"] .masthead-controls {
      position: relative;
      z-index: 1;
    }

    /* ── Theme switcher — lives in the masthead nav, always visible ── */
    .theme-switcher {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .theme-btn {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3);
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .theme-btn:hover { transform: scale(1.2); }
    .theme-btn.active { border-color: rgba(255,255,255,0.9); }
    .theme-btn[data-t="parchment"] { background: #f7f2e8; border-color: #b8924a; }
    .theme-btn[data-t="medici"]    { background: #6b0f0f; border-color: #c9962a; }

    .texture-btn {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      color: rgba(255,255,255,0.5);
      background: rgba(255,255,255,0.08);
      transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      user-select: none;
    }
    .texture-btn:hover { transform: scale(1.2); }
    .texture-btn.active { border-color: var(--gold-light); color: var(--gold-light); background: rgba(180,130,50,0.15); }

    /* ── Header ── */
    .site-header {
      background: var(--header-bg);
      color: var(--parchment);
      text-align: center;
      padding: 1.5rem 2rem 2rem;
      border-bottom: 3px solid var(--gold);
      position: relative;
    }

    .masthead-dateline {
      font-family: 'Cormorant Garamond', serif;
      font-size: 0.65rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 1rem;
    }

    .masthead-dateline span { margin: 0 0.6em; opacity: 0.5; }

    .masthead-rule {
      border: none;
      border-top: 1px solid var(--gold);
      opacity: 0.4;
      margin: 0 auto 1rem;
      width: 60%;
    }

    .masthead-title {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: clamp(3rem, 8vw, 5.5rem);
      font-weight: 400;
      letter-spacing: 0.02em;
      line-height: 1;
      color: var(--gold-light);
      margin-bottom: 0.4rem;
    }

    .masthead-title em {
      font-style: italic;
      color: var(--crimson);
    }

    .masthead-subtitle {
      font-family: 'Cormorant Garamond', serif;
      font-size: 0.95rem;
      font-style: italic;
      font-weight: 300;
      color: var(--gold);
      opacity: 0.6;
      letter-spacing: 0.04em;
      margin-bottom: 1.25rem;
    }

    .masthead-controls {
      position: absolute;
      top: 1rem;
      right: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* ── Site Nav ── */
    .site-nav {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0;
      background: var(--header-bg);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      position: relative;
      z-index: 10;
    }

    .site-nav a {
      font-family: 'Cinzel', serif;
      font-size: 0.58rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--gold);
      opacity: 0.65;
      padding: 0.75rem 1.6rem;
      border-bottom: 2px solid transparent;
      transition: color 0.2s, border-color 0.2s, opacity 0.2s;
      white-space: nowrap;
    }
    .site-nav a:hover      { opacity: 1; border-bottom-color: rgba(200,150,40,0.4); }
    .site-nav a.active     { opacity: 1; border-bottom-color: var(--gold); }
    .site-nav .nav-divider { width: 1px; height: 0.9rem; background: var(--rule); opacity: 0.4; flex-shrink: 0; }

    /* ── Prose section labels ── */
    .prose-label {
      font-family: 'Cinzel', serif;
      font-size: 0.52rem;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
      opacity: 0.7;
      margin-top: 1.1rem;
      margin-bottom: 0.35rem;
      display: block;
    }
    .prose-label:first-child { margin-top: 0; }

    .prose-verdict {
      font-style: italic;
      font-weight: 400;
      color: var(--ink) !important;
      border-left: 2px solid var(--crimson);
      padding-left: 0.8rem;
      margin-bottom: 0.75em !important;
    }

    /* ── Layout ── */
    main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 3rem 2rem 5rem;
    }

    /* ── Topic section ── */
    .topic-section { margin-bottom: 5rem; }

    .posed-by {
      font-family: 'Cinzel', serif;
      font-size: 0.62rem;
      font-weight: 400;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 0.6rem;
      opacity: 0.85;
    }
    .posed-by-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 0.95rem;
      font-style: italic;
      font-weight: 400;
      letter-spacing: 0.04em;
      text-transform: none;
      color: var(--crimson);
      margin-left: 0.35em;
    }

    .topic-heading {
      font-family: 'Cinzel', serif;
      font-weight: 400;
      font-size: clamp(1.1rem, 2.5vw, 1.6rem);
      letter-spacing: 0.05em;
      color: var(--ink);
      border-top: 2px solid var(--gold);
      border-bottom: 1px solid var(--rule);
      padding: 1.25rem 0 1rem;
      margin-bottom: 2.5rem;
      display: flex;
      align-items: baseline;
      gap: 1.25rem;
    }

    .topic-label {
      font-family: 'Cormorant Garamond', serif;
      font-size: 0.7rem;
      font-style: italic;
      font-weight: 300;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--gold);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Cards grid ── */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
      align-items: start;
    }

    .card {
      background: var(--cream);
      border: 1px solid var(--rule);
      border-top: 3px solid var(--gold);
      padding: 1.75rem;
      box-shadow: 0 2px 12px var(--shadow);
      transition: box-shadow 0.2s ease, transform 0.2s ease, background 0.4s ease;
    }

    .card:hover {
      box-shadow: 0 6px 24px var(--shadow);
      transform: translateY(-2px);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      margin-bottom: 0;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--rule);
      cursor: pointer;
      user-select: none;
    }

    .card-header:hover .persona-name { color: var(--gold); }

    .expand-icon {
      margin-left: auto;
      font-size: 1.1rem;
      color: var(--gold);
      opacity: 0.6;
      transition: transform 0.25s ease, opacity 0.2s ease;
      flex-shrink: 0;
      line-height: 1;
    }

    .card.open .expand-icon {
      transform: rotate(45deg);
      opacity: 1;
    }

    /* Prose hidden by default, maxim always visible */
    .card-prose {
      display: none;
    }

    .card.open .card-prose {
      display: block;
    }

    .card-body {
      padding-top: 1rem;
    }

    .emoji { font-size: 1.6rem; line-height: 1; flex-shrink: 0; }

    .portrait-oval {
      width: 62px;
      height: 74px;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid var(--gold);
      box-shadow: 0 0 0 3px var(--cream), 0 0 0 4px var(--rule);
      position: relative;
    }

    .portrait-oval img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      filter: sepia(25%) contrast(1.05) brightness(0.95);
    }

    .card-meta { display: flex; flex-direction: column; gap: 0.1rem; }

    .persona-name {
      font-family: 'Cinzel', serif;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: var(--ink);
    }

    .domain {
      font-size: 0.78rem;
      font-style: italic;
      color: var(--gold);
      letter-spacing: 0.03em;
    }

    /* ── Card body ── */
    .card-body p {
      margin-bottom: 0.85em;
      font-size: 0.97rem;
      line-height: 1.75;
      color: var(--body-text);
    }

    .card-body p:last-child { margin-bottom: 0; }

    .card-body em.maxim {
      display: block;
      font-style: italic;
      font-weight: 300;
      font-size: 1.05rem;
      color: var(--ink);
      border-left: 3px solid var(--gold);
      padding-left: 1rem;
      margin-top: 1rem;
      line-height: 1.6;
    }

    .empty { color: #999; font-style: italic; }

    /* ── Footer ── */
    footer {
      text-align: center;
      padding: 2rem;
      font-size: 0.8rem;
      font-style: italic;
      color: var(--gold);
      border-top: 1px solid var(--rule);
    }

    @media (max-width: 600px) {
      .cards-grid { grid-template-columns: 1fr; }
      main { padding: 2rem 1rem 3rem; }
    }

    /* ── Persona card textures (active when data-textures="on") ── */

    /* Machiavelli — crimson tufted velvet */
    [data-textures="on"] .card[data-persona="machiavelli"] {
      background-color: #2d0a0a;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cdefs%3E%3CradialGradient id='v' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.05'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.25'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cellipse cx='30' cy='30' rx='20' ry='20' fill='url(%23v)'/%3E%3Cline x1='30' y1='10' x2='0' y2='30' stroke='%23000' stroke-opacity='0.15' stroke-width='0.8'/%3E%3Cline x1='30' y1='10' x2='60' y2='30' stroke='%23000' stroke-opacity='0.15' stroke-width='0.8'/%3E%3Cline x1='0' y1='30' x2='30' y2='50' stroke='%23000' stroke-opacity='0.15' stroke-width='0.8'/%3E%3Cline x1='60' y1='30' x2='30' y2='50' stroke='%23000' stroke-opacity='0.15' stroke-width='0.8'/%3E%3C/svg%3E");
      background-size: 60px 60px;
      --body-text: #e8c8a0;
      --ink: #f0dfc0;
      --rule: #6b2020;
    }

    /* Montaigne — bare limestone / rough plaster */
    [data-textures="on"] .card[data-persona="montaigne"] {
      background-color: #c8b99a;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='50'%3E%3Crect width='80' height='50' fill='none'/%3E%3Crect x='1' y='1' width='36' height='22' rx='1' fill='none' stroke='%23888070' stroke-opacity='0.35' stroke-width='0.8'/%3E%3Crect x='41' y='1' width='37' height='22' rx='1' fill='none' stroke='%23888070' stroke-opacity='0.35' stroke-width='0.8'/%3E%3Crect x='21' y='27' width='36' height='21' rx='1' fill='none' stroke='%23888070' stroke-opacity='0.35' stroke-width='0.8'/%3E%3Crect x='1' y='27' width='18' height='21' rx='1' fill='none' stroke='%23888070' stroke-opacity='0.35' stroke-width='0.8'/%3E%3Crect x='61' y='27' width='17' height='21' rx='1' fill='none' stroke='%23888070' stroke-opacity='0.35' stroke-width='0.8'/%3E%3C/svg%3E");
      background-size: 80px 50px;
      --body-text: #2a1f10;
      --ink: #1a1008;
      --rule: #8a7a60;
    }

    /* Marcus Aurelius — white marble veining */
    [data-textures="on"] .card[data-persona="aurelius"] {
      background-color: #ede8e0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cpath d='M0 40 Q50 20 100 60 T200 40' fill='none' stroke='%23b0a898' stroke-opacity='0.4' stroke-width='1.2'/%3E%3Cpath d='M0 80 Q70 55 130 100 T200 80' fill='none' stroke='%23c8c0b0' stroke-opacity='0.3' stroke-width='0.8'/%3E%3Cpath d='M20 0 Q40 80 10 160 T30 200' fill='none' stroke='%23a89880' stroke-opacity='0.25' stroke-width='1'/%3E%3Cpath d='M100 0 Q120 60 90 140 T110 200' fill='none' stroke='%23b8b0a0' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Cpath d='M0 140 Q80 110 160 150 T200 140' fill='none' stroke='%23a09080' stroke-opacity='0.3' stroke-width='0.9'/%3E%3C/svg%3E");
      background-size: 200px 200px;
      --body-text: #2a2820;
      --ink: #1a1810;
      --rule: #c0b8a8;
    }

    /* Austen — sprigged muslin / pale Georgian wallpaper */
    [data-textures="on"] .card[data-persona="austen"] {
      background-color: #f0ede4;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='2' fill='%23a0b090' fill-opacity='0.4'/%3E%3Cpath d='M20 14 Q22 17 20 20 Q18 17 20 14Z' fill='%23a0b090' fill-opacity='0.3'/%3E%3Cpath d='M20 20 Q23 22 20 26 Q17 22 20 20Z' fill='%23a0b090' fill-opacity='0.3'/%3E%3Cpath d='M14 20 Q17 22 20 20 Q17 18 14 20Z' fill='%23a0b090' fill-opacity='0.25'/%3E%3Cpath d='M20 20 Q23 18 26 20 Q23 22 20 20Z' fill='%23a0b090' fill-opacity='0.25'/%3E%3C/svg%3E");
      background-size: 40px 40px;
      --body-text: #2a2418;
      --ink: #1a1810;
      --rule: #c0b8a0;
    }

    /* Nietzsche — dark storm, diagonal rain */
    [data-textures="on"] .card[data-persona="nietzsche"] {
      background-color: #1a1e28;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='80'%3E%3Cline x1='10' y1='0' x2='0' y2='80' stroke='%23607090' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Cline x1='25' y1='0' x2='15' y2='80' stroke='%23506080' stroke-opacity='0.15' stroke-width='0.4'/%3E%3Cline x1='40' y1='0' x2='30' y2='80' stroke='%23607090' stroke-opacity='0.2' stroke-width='0.6'/%3E%3C/svg%3E");
      background-size: 40px 80px;
      --body-text: #c8d0e0;
      --ink: #e0e8f0;
      --rule: #384058;
    }

    /* Camus — Mediterranean whitewash rough plaster */
    [data-textures="on"] .card[data-persona="camus"] {
      background-color: #e8e0d0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.08'/%3E%3Ccircle cx='30' cy='25' r='18' fill='none' stroke='%23c0b090' stroke-opacity='0.15' stroke-width='0.5'/%3E%3Ccircle cx='75' cy='65' r='22' fill='none' stroke='%23c0b090' stroke-opacity='0.12' stroke-width='0.5'/%3E%3C/svg%3E");
      background-size: 100px 100px;
      --body-text: #282010;
      --ink: #181408;
      --rule: #b8a888;
    }

    /* Bashō — ink wash, faint reed suggestion on rice paper */
    [data-textures="on"] .card[data-persona="basho"] {
      background-color: #f2ede0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='180'%3E%3Cline x1='60' y1='180' x2='58' y2='40' stroke='%23708060' stroke-opacity='0.2' stroke-width='1.2'/%3E%3Cpath d='M58 80 Q40 70 35 60' fill='none' stroke='%23708060' stroke-opacity='0.18' stroke-width='1'/%3E%3Cpath d='M58 100 Q75 88 80 76' fill='none' stroke='%23708060' stroke-opacity='0.15' stroke-width='0.8'/%3E%3Cpath d='M59 120 Q42 108 38 94' fill='none' stroke='%23708060' stroke-opacity='0.18' stroke-width='1'/%3E%3Cline x1='20' y1='180' x2='19' y2='80' stroke='%23708060' stroke-opacity='0.1' stroke-width='0.6'/%3E%3Cpath d='M19 110 Q10 102 8 95' fill='none' stroke='%23708060' stroke-opacity='0.1' stroke-width='0.5'/%3E%3C/svg%3E");
      background-size: 120px 180px;
      --body-text: #282018;
      --ink: #181008;
      --rule: #b8b098;
    }

    /* Mill — pale Georgian library panelling */
    [data-textures="on"] .card[data-persona="mill"] {
      background-color: #e8e0cc;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='120'%3E%3Crect x='4' y='4' width='72' height='112' rx='3' fill='none' stroke='%23a09070' stroke-opacity='0.25' stroke-width='0.8'/%3E%3Crect x='10' y='10' width='60' height='100' rx='2' fill='none' stroke='%23a09070' stroke-opacity='0.15' stroke-width='0.5'/%3E%3Cline x1='4' y1='60' x2='76' y2='60' stroke='%23a09070' stroke-opacity='0.2' stroke-width='0.6'/%3E%3C/svg%3E");
      background-size: 80px 120px;
      --body-text: #28200f;
      --ink: #18100a;
      --rule: #b0a888;
    }

    /* Emerson — dappled forest light, New England woodland */
    [data-textures="on"] .card[data-persona="emerson"] {
      background-color: #e8ede0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ccircle cx='20' cy='15' r='8' fill='%23688050' fill-opacity='0.12'/%3E%3Ccircle cx='65' cy='30' r='12' fill='%23688050' fill-opacity='0.09'/%3E%3Ccircle cx='40' cy='60' r='10' fill='%23688050' fill-opacity='0.11'/%3E%3Ccircle cx='80' cy='75' r='7' fill='%23688050' fill-opacity='0.1'/%3E%3Ccircle cx='10' cy='80' r='9' fill='%23688050' fill-opacity='0.08'/%3E%3Cline x1='20' y1='100' x2='22' y2='23' stroke='%23507040' stroke-opacity='0.12' stroke-width='0.8'/%3E%3Cline x1='60' y1='100' x2='63' y2='42' stroke='%23507040' stroke-opacity='0.1' stroke-width='0.6'/%3E%3C/svg%3E");
      background-size: 100px 100px;
      --body-text: #1e2810;
      --ink: #141c08;
      --rule: #a8b890;
    }

    /* Thomas Paine — rough broadsheet newsprint, revolutionary pamphlet */
    [data-textures="on"] .card[data-persona="paine"] {
      background-color: #d8ceb0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='160'%3E%3Cline x1='0' y1='20' x2='120' y2='20' stroke='%23806040' stroke-opacity='0.18' stroke-width='0.6'/%3E%3Cline x1='0' y1='36' x2='120' y2='36' stroke='%23806040' stroke-opacity='0.12' stroke-width='0.4'/%3E%3Cline x1='0' y1='52' x2='120' y2='52' stroke='%23806040' stroke-opacity='0.18' stroke-width='0.6'/%3E%3Cline x1='0' y1='68' x2='120' y2='68' stroke='%23806040' stroke-opacity='0.12' stroke-width='0.4'/%3E%3Cline x1='0' y1='84' x2='120' y2='84' stroke='%23806040' stroke-opacity='0.18' stroke-width='0.6'/%3E%3Cline x1='0' y1='100' x2='120' y2='100' stroke='%23806040' stroke-opacity='0.12' stroke-width='0.4'/%3E%3Cline x1='0' y1='116' x2='120' y2='116' stroke='%23806040' stroke-opacity='0.18' stroke-width='0.6'/%3E%3Cline x1='0' y1='132' x2='120' y2='132' stroke='%23806040' stroke-opacity='0.12' stroke-width='0.4'/%3E%3Cline x1='0' y1='148' x2='120' y2='148' stroke='%23806040' stroke-opacity='0.18' stroke-width='0.6'/%3E%3C/svg%3E");
      background-size: 120px 160px;
      --body-text: #201808;
      --ink: #140e04;
      --rule: #907858;
    }

    /* Hobbes — cold stone dungeon, leviathan grey */
    [data-textures="on"] .card[data-persona="hobbes"] {
      background-color: #2a2e38;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect x='0' y='0' width='38' height='18' rx='1' fill='none' stroke='%23607080' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Crect x='42' y='0' width='38' height='18' rx='1' fill='none' stroke='%23607080' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Crect x='20' y='22' width='38' height='18' rx='1' fill='none' stroke='%23607080' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Crect x='0' y='22' width='18' height='18' rx='1' fill='none' stroke='%23607080' stroke-opacity='0.15' stroke-width='0.5'/%3E%3Crect x='62' y='22' width='18' height='18' rx='1' fill='none' stroke='%23607080' stroke-opacity='0.15' stroke-width='0.5'/%3E%3C/svg%3E");
      background-size: 80px 40px;
      --body-text: #c0ccd8;
      --ink: #dce8f0;
      --rule: #485868;
    }

    /* Sun Tzu — black ink on bamboo scroll, sparse brushwork */
    [data-textures="on"] .card[data-persona="suntzu"] {
      background-color: #e8e0c8;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='120'%3E%3Crect x='18' y='0' width='4' height='120' rx='2' fill='%23806040' fill-opacity='0.15'/%3E%3Crect x='0' y='0' width='3' height='120' rx='1' fill='%23806040' fill-opacity='0.08'/%3E%3Crect x='37' y='0' width='3' height='120' rx='1' fill='%23806040' fill-opacity='0.08'/%3E%3Cline x1='0' y1='30' x2='40' y2='30' stroke='%23806040' stroke-opacity='0.1' stroke-width='0.4'/%3E%3Cline x1='0' y1='60' x2='40' y2='60' stroke='%23806040' stroke-opacity='0.1' stroke-width='0.4'/%3E%3Cline x1='0' y1='90' x2='40' y2='90' stroke='%23806040' stroke-opacity='0.1' stroke-width='0.4'/%3E%3C/svg%3E");
      background-size: 40px 120px;
      --body-text: #1a1408;
      --ink: #100c04;
      --rule: #a89868;
    }

    /* Keynes — financial ledger, ruled columns */
    [data-textures="on"] .card[data-persona="keynes"] {
      background-color: #e4eef0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='30'%3E%3Cline x1='0' y1='29' x2='120' y2='29' stroke='%234080a0' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Cline x1='30' y1='0' x2='30' y2='30' stroke='%234080a0' stroke-opacity='0.12' stroke-width='0.4'/%3E%3Cline x1='90' y1='0' x2='90' y2='30' stroke='%234080a0' stroke-opacity='0.12' stroke-width='0.4'/%3E%3C/svg%3E");
      background-size: 120px 30px;
      --body-text: #0e1e2a;
      --ink: #081420;
      --rule: #90b8c8;
    }

    /* Hayek — engineering blueprint, precise grid */
    [data-textures="on"] .card[data-persona="hayek"] {
      background-color: #dce8f0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cline x1='0' y1='0' x2='40' y2='0' stroke='%232060a0' stroke-opacity='0.12' stroke-width='0.4'/%3E%3Cline x1='0' y1='20' x2='40' y2='20' stroke='%232060a0' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Cline x1='0' y1='40' x2='40' y2='40' stroke='%232060a0' stroke-opacity='0.12' stroke-width='0.4'/%3E%3Cline x1='0' y1='0' x2='0' y2='40' stroke='%232060a0' stroke-opacity='0.12' stroke-width='0.4'/%3E%3Cline x1='20' y1='0' x2='20' y2='40' stroke='%232060a0' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Cline x1='40' y1='0' x2='40' y2='40' stroke='%232060a0' stroke-opacity='0.12' stroke-width='0.4'/%3E%3C/svg%3E");
      background-size: 40px 40px;
      --body-text: #0a1828;
      --ink: #061020;
      --rule: #80a8c8;
    }

    /* Wollstonecraft — pale rose silk, Georgian feminine */
    [data-textures="on"] .card[data-persona="wollstonecraft"] {
      background-color: #f0e4e8;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Ccircle cx='25' cy='25' r='2' fill='%23c07080' fill-opacity='0.25'/%3E%3Cpath d='M25 18 Q28 21 25 25 Q22 21 25 18Z' fill='%23c07080' fill-opacity='0.18'/%3E%3Cpath d='M25 25 Q28 28 25 32 Q22 28 25 25Z' fill='%23c07080' fill-opacity='0.18'/%3E%3Cpath d='M18 25 Q21 28 25 25 Q21 22 18 25Z' fill='%23c07080' fill-opacity='0.14'/%3E%3Cpath d='M25 25 Q28 22 32 25 Q28 28 25 25Z' fill='%23c07080' fill-opacity='0.14'/%3E%3C/svg%3E");
      background-size: 50px 50px;
      --body-text: #28101a;
      --ink: #1a0810;
      --rule: #c898a8;
    }

    /* Francis Bacon — dark oak panelling, candlelit study */
    [data-textures="on"] .card[data-persona="bacon"] {
      background-color: #2a2010;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='80'%3E%3Crect x='2' y='2' width='56' height='76' rx='2' fill='none' stroke='%23806040' stroke-opacity='0.2' stroke-width='0.8'/%3E%3Crect x='6' y='6' width='48' height='34' rx='1' fill='none' stroke='%23806040' stroke-opacity='0.12' stroke-width='0.5'/%3E%3Crect x='6' y='44' width='48' height='30' rx='1' fill='none' stroke='%23806040' stroke-opacity='0.12' stroke-width='0.5'/%3E%3Cline x1='2' y1='42' x2='58' y2='42' stroke='%23806040' stroke-opacity='0.15' stroke-width='0.6'/%3E%3C/svg%3E");
      background-size: 60px 80px;
      --body-text: #d8c8a0;
      --ink: #f0e0b8;
      --rule: #604820;
    }

    /* Hume — Scottish grey mist, soft diagonal crosshatch */
    [data-textures="on"] .card[data-persona="hume"] {
      background-color: #d8dce0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cline x1='0' y1='0' x2='40' y2='40' stroke='%23708090' stroke-opacity='0.12' stroke-width='0.5'/%3E%3Cline x1='40' y1='0' x2='0' y2='40' stroke='%23708090' stroke-opacity='0.12' stroke-width='0.5'/%3E%3Cline x1='20' y1='0' x2='60' y2='40' stroke='%23708090' stroke-opacity='0.07' stroke-width='0.4'/%3E%3Cline x1='-20' y1='0' x2='20' y2='40' stroke='%23708090' stroke-opacity='0.07' stroke-width='0.4'/%3E%3C/svg%3E");
      background-size: 40px 40px;
      --body-text: #181c20;
      --ink: #0e1214;
      --rule: #a0a8b0;
    }

    /* Adam Smith — Edinburgh merchant ledger, warm tan */
    [data-textures="on"] .card[data-persona="adamsmith"] {
      background-color: #e8dcc8;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='28'%3E%3Cline x1='0' y1='27' x2='100' y2='27' stroke='%23806040' stroke-opacity='0.2' stroke-width='0.6'/%3E%3Cline x1='70' y1='0' x2='70' y2='28' stroke='%23806040' stroke-opacity='0.15' stroke-width='0.5'/%3E%3Cline x1='85' y1='0' x2='85' y2='28' stroke='%23806040' stroke-opacity='0.12' stroke-width='0.4'/%3E%3C/svg%3E");
      background-size: 100px 28px;
      --body-text: #201408;
      --ink: #140c04;
      --rule: #a08860;
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="masthead-controls">
      <div class="theme-btn active" data-t="parchment" title="Parchment"></div>
      <div class="theme-btn" data-t="medici" title="Medici"></div>
      <div class="texture-btn" data-on="false" title="Persona textures">✦</div>
    </div>
    <p class="masthead-dateline">Vol. I <span>·</span> The Age of Reflection <span>·</span> Established 2025</p>
    <hr class="masthead-rule">
    <h1 class="masthead-title">The <em>Salon</em></h1>
    <p class="masthead-subtitle">Voices across time, written exclusively for you</p>
  </header>
  <nav class="site-nav">
    <a href="../index.html">The Salon</a>
    <span class="nav-divider"></span>
    <a href="../salon-index.html" class="active">The Judgement</a>
    <span class="nav-divider"></span>
    <a href="../voices.html">The Voices</a>
  </nav>
  <main>${topicBlocks}</main>
  <footer>Generated by The Salon Batch Processor · ${date}</footer>
  <script>
    const btns = document.querySelectorAll('.theme-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', btn.dataset.t);
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('salon-theme', btn.dataset.t);
      });
    });
    const saved = localStorage.getItem('salon-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      btns.forEach(b => b.classList.toggle('active', b.dataset.t === saved));
    }

    const texBtn = document.querySelector('.texture-btn');
    const applyTextures = (on) => {
      document.documentElement.setAttribute('data-textures', on ? 'on' : 'off');
      texBtn.classList.toggle('active', on);
      texBtn.dataset.on = on;
      localStorage.setItem('salon-textures', on);
    };
    texBtn.addEventListener('click', () => applyTextures(texBtn.dataset.on === 'false'));
    const savedTex = localStorage.getItem('salon-textures');
    applyTextures(savedTex === 'true');

    // Card expand/collapse
    document.querySelectorAll('.card-header').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.card');
        card.classList.toggle('open');
        header.setAttribute('aria-expanded', card.classList.contains('open'));
      });
    });
  </script>
</body>
</html>`;
}

// ── API call ─────────────────────────────────────────────────────────────────
async function fetchJudgement(topic, persona) {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT(persona) },
          { role: "user",   content: topic },
        ],
      }),
    });

    if (res.status === 429 && attempt < RETRIES) {
      const wait = 2000 * (attempt + 1);
      console.log(`  Rate-limited — waiting ${wait / 1000}s before retry ${attempt + 1}…`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }
  throw new Error("Rate limit — max retries exceeded");
}

// ── Index page builder ────────────────────────────────────────────────────────
function buildIndex(scriptDir) {
  const judgementsDir = path.join(scriptDir, "judgements");
  if (!fs.existsSync(judgementsDir)) return;

  const files = fs.readdirSync(judgementsDir)
    .filter(f => f.match(/^salon-.*\.html$/))
    .sort()
    .reverse(); // newest first

  if (!files.length) return;

  const entries = files.map((f, i) => {
    const html   = fs.readFileSync(path.join(judgementsDir, f), "utf8");
    const issue  = files.length - i;

    const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
    const rawDate   = dateMatch ? dateMatch[1] : "Unknown";
    const displayDate = rawDate !== "Unknown"
      ? new Date(rawDate).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })
      : rawDate;

    // Extract questions — try both with and without nested span
    let questions = [...html.matchAll(/class="topic-heading"[^>]*>[\s\S]*?<\/span>\s*([\s\S]*?)\s*<\/h2>/g)]
      .map(m => m[1].trim().replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);

    // Fallback: grab text directly between topic-label span and </h2>
    if (!questions.length) {
      questions = [...html.matchAll(/<\/span>\s*\n?\s*([^\n<]{10,})\s*\n?\s*<\/h2>/g)]
        .map(m => m[1].trim())
        .filter(Boolean);
    }

    const maximMatch = html.match(/class="maxim">([\s\S]*?)<\/em>/);
    const maxim = maximMatch ? maximMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    const attrMatch = html.match(/class="persona-name">(.*?)<\/span>[\s\S]*?class="maxim"/);
    const attribution = attrMatch ? attrMatch[1].trim() : "";

    const posedByMatch = html.match(/class="posed-by-name">(.*?)<\/span>/);
    const posedBy = posedByMatch ? posedByMatch[1].trim() : "";

    const cardCount = (html.match(/class="card"/g) || []).length;
    const personaCount = Math.round(cardCount / Math.max(questions.length, 1));

    console.log(`  Index: ${f} → ${questions.length} question(s), ${cardCount} cards, maxim: ${maxim ? "✓" : "✗"}${posedBy ? `, posed by: ${posedBy}` : ""}`);

    return { file: f, issue, displayDate, questions, maxim, attribution, posedBy, personaCount };
  });

  const cards = entries.map(e => {
    const questionList = e.questions.map(q =>
      `<p class="idx-question">${q}</p>`
    ).join("");

    const dots = Array.from({ length: Math.min(e.personaCount, 8) }, () =>
      `<span class="idx-dot"></span>`
    ).join("") + (e.personaCount > 8 ? `<span class="idx-dot-more">+${e.personaCount - 8}</span>` : "");

    return `
    <a class="idx-card" href="judgements/${e.file}">
      <div class="idx-issue">Issue ${toRoman(e.issue)} · ${e.displayDate}</div>
      ${e.posedBy ? `<div class="idx-posed-by">Posed by <span class="idx-posed-by-name">${e.posedBy}</span></div>` : ""}
      <div class="idx-questions">${questionList}</div>
      ${e.maxim ? `
      <div class="idx-maxim-block">
        <div class="idx-maxim">"${e.maxim}"</div>
        ${e.attribution ? `<div class="idx-attr">— ${e.attribution}</div>` : ""}
      </div>` : ""}
      <div class="idx-footer">
        <div class="idx-dots">${dots}<span class="idx-voice-count">${e.personaCount} voice${e.personaCount !== 1 ? "s" : ""}</span></div>
        <span class="idx-read">Read →</span>
      </div>
    </a>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="medici">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Salon — Archive</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    [data-theme="parchment"] {
      --ink: #1a1510; --parchment: #f7f2e8; --card: #f2ece0;
      --gold: #b8924a; --gold-light: #d4aa6a; --crimson: #8b1a1a;
      --rule: #d6c9a8; --shadow: rgba(26,21,16,0.08); --muted: #9a8870;
      --header-bg: #1a1510;
    }

    [data-theme="medici"] {
      --ink: #f0e6d0; --parchment: #1a0a06; --card: #2a1208;
      --gold: #c9962a; --gold-light: #e8b84b; --crimson: #c0362a;
      --rule: #5a2a18; --shadow: rgba(0,0,0,0.4); --muted: #c8a870;
      --header-bg: #0e0502;
    }

    [data-theme="medici"][data-textures="on"] body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cdefs%3E%3CradialGradient id='b' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.03'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.12'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='60' height='60' fill='none'/%3E%3Cellipse cx='30' cy='30' rx='18' ry='18' fill='url(%23b)'/%3E%3C/svg%3E");
      background-size: 60px 60px;
      pointer-events: none;
      z-index: 0;
    }

    body {
      background: var(--parchment);
      color: var(--ink);
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 16px;
      line-height: 1.6;
      min-height: 100vh;
      transition: background 0.4s, color 0.4s;
    }

    .site-header {
      background: var(--header-bg);
      color: var(--ink);
      text-align: center;
      padding: 1.5rem 2rem 0;
      border-bottom: 3px solid var(--gold);
      position: relative;
      z-index: 10;
    }

    .masthead-controls {
      position: absolute;
      top: 1rem; right: 1.5rem;
      display: flex; align-items: center; gap: 0.5rem;
      z-index: 10;
    }

    .theme-btn {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3); cursor: pointer;
      transition: transform 0.2s, border-color 0.2s;
    }
    .theme-btn:hover { transform: scale(1.2); }
    .theme-btn.active { border-color: rgba(255,255,255,0.9); }
    .theme-btn[data-t="parchment"] { background: #f7f2e8; border-color: #b8924a; }
    .theme-btn[data-t="medici"]    { background: #6b0f0f; border-color: #c9962a; }

    .texture-btn {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.65rem; color: rgba(255,255,255,0.5);
      background: rgba(255,255,255,0.08);
      transition: transform 0.2s, border-color 0.2s, color 0.2s;
      user-select: none;
    }
    .texture-btn:hover { transform: scale(1.2); }
    .texture-btn.active { border-color: var(--gold-light); color: var(--gold-light); background: rgba(180,130,50,0.15); }

    .masthead-dateline {
      font-family: 'Cormorant Garamond', serif;
      font-size: 0.65rem; letter-spacing: 0.25em;
      text-transform: uppercase; color: var(--gold); margin-bottom: 1rem;
    }
    .masthead-dateline span { margin: 0 0.6em; opacity: 0.5; }

    .masthead-rule { border: none; border-top: 1px solid var(--gold); opacity: 0.4; margin: 0 auto 1rem; width: 60%; }

    .masthead-title {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: clamp(3rem, 8vw, 5.5rem);
      font-weight: 400; letter-spacing: 0.02em;
      line-height: 1; color: var(--gold-light); margin-bottom: 0.4rem;
    }
    .masthead-title em { font-style: italic; color: var(--crimson); }

    .masthead-subtitle {
      font-family: 'Cormorant Garamond', serif;
      font-size: 0.95rem; font-style: italic;
      font-weight: 300; color: var(--gold);
      opacity: 0.6; letter-spacing: 0.04em; margin-bottom: 0;
    }

    .masthead-archive-label {
      font-family: 'Cinzel', serif;
      font-size: 0.6rem; letter-spacing: 0.3em;
      color: var(--gold); opacity: 0.6;
      text-transform: uppercase;
      padding-bottom: 0.75rem; display: block;
    }

    .site-nav {
      display: flex; justify-content: center; align-items: center;
      gap: 0; background: var(--header-bg);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      position: relative; z-index: 10;
    }
    .site-nav a {
      font-family: 'Cinzel', serif; font-size: 0.58rem;
      letter-spacing: 0.22em; text-transform: uppercase;
      text-decoration: none; color: var(--gold); opacity: 0.65;
      padding: 0.75rem 1.6rem; border-bottom: 2px solid transparent;
      transition: color 0.2s, border-color 0.2s, opacity 0.2s;
      white-space: nowrap;
    }
    .site-nav a:hover      { opacity: 1; border-bottom-color: rgba(200,150,40,0.4); }
    .site-nav a.active     { opacity: 1; border-bottom-color: var(--gold); }
    .site-nav .nav-divider { width: 1px; height: 0.9rem; background: var(--rule); opacity: 0.4; flex-shrink: 0; }

    main {
      max-width: 1200px; margin: 0 auto;
      padding: 3rem 2rem 5rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem; position: relative; z-index: 1;
    }

    .idx-card {
      display: block; text-decoration: none;
      background: var(--card); border: 1px solid var(--rule);
      border-top: 3px solid var(--crimson); padding: 1.5rem;
      color: var(--ink); transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .idx-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px var(--shadow); border-top-color: var(--gold); }

    .idx-issue { font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); margin-bottom: 0.35rem; }
    .idx-posed-by { font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--gold); opacity: 0.75; margin-bottom: 0.75rem; }
    .idx-posed-by-name { font-family: 'Cormorant Garamond', serif; font-size: 0.85rem; font-style: italic; letter-spacing: 0.04em; text-transform: none; color: var(--crimson); margin-left: 0.3em; }
    .idx-questions { margin-bottom: 0.9rem; }
    .idx-question { font-size: 0.95rem; font-style: italic; color: var(--ink); line-height: 1.45; margin-bottom: 0.3rem; }
    .idx-question::before { content: '"'; }
    .idx-question::after  { content: '"'; }
    .idx-maxim-block { border-top: 1px solid var(--rule); padding-top: 0.75rem; margin-bottom: 0.9rem; }
    .idx-maxim { font-size: 0.82rem; font-style: italic; color: var(--muted); line-height: 1.55; border-left: 2px solid var(--gold); padding-left: 0.65rem; margin-bottom: 0.3rem; }
    .idx-attr { font-size: 0.68rem; color: var(--gold); padding-left: 0.65rem; }
    .idx-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--rule); padding-top: 0.75rem; margin-top: 0.25rem; }
    .idx-dots { display: flex; align-items: center; gap: 4px; }
    .idx-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); opacity: 0.5; display: inline-block; }
    .idx-dot-more { font-size: 0.6rem; color: var(--gold); opacity: 0.5; margin-left: 2px; }
    .idx-voice-count { font-size: 0.65rem; color: var(--muted); margin-left: 6px; font-style: italic; }
    .idx-read { font-size: 0.68rem; color: var(--gold); letter-spacing: 0.05em; }

    footer {
      text-align: center; padding: 2rem; font-size: 0.75rem;
      font-style: italic; color: var(--gold); opacity: 0.5;
      border-top: 1px solid var(--rule); position: relative; z-index: 1;
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="masthead-controls">
      <div class="theme-btn" data-t="parchment" title="Parchment"></div>
      <div class="theme-btn" data-t="medici"    title="Medici"></div>
      <div class="texture-btn" data-on="false"  title="Toggle textures">✦</div>
    </div>
    <p class="masthead-dateline">Vol. I <span>·</span> The Age of Reflection <span>·</span> Established 2025</p>
    <hr class="masthead-rule">
    <h1 class="masthead-title">The <em>Salon</em></h1>
    <p class="masthead-subtitle">Voices across time, written exclusively for you</p>
    <span class="masthead-archive-label">Archive</span>
  </header>
  <nav class="site-nav">
    <a href="index.html">The Salon</a>
    <span class="nav-divider"></span>
    <a href="salon-index.html" class="active">The Judgement</a>
    <span class="nav-divider"></span>
    <a href="voices.html">The Voices</a>
  </nav>
  <main>${cards}</main>
  <footer>The Salon · ${entries.length} issue${entries.length !== 1 ? "s" : ""} in the archive</footer>
  <script>
    const themeBtns = document.querySelectorAll('.theme-btn');
    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', btn.dataset.t);
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('salon-theme', btn.dataset.t);
      });
    });
    const savedTheme = localStorage.getItem('salon-theme') || 'medici';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeBtns.forEach(b => b.classList.toggle('active', b.dataset.t === savedTheme));

    const texBtn = document.querySelector('.texture-btn');
    const applyTexture = (on) => {
      document.documentElement.setAttribute('data-textures', on ? 'on' : 'off');
      texBtn.classList.toggle('active', on);
      texBtn.dataset.on = on;
      localStorage.setItem('salon-textures', on);
    };
    texBtn.addEventListener('click', () => applyTexture(texBtn.dataset.on === 'false'));
    applyTexture(localStorage.getItem('salon-textures') === 'true');
  </script>
</body>
</html>`;

  const indexFile = path.join(scriptDir, "salon-index.html");
  fs.writeFileSync(indexFile, html, "utf8");
  return indexFile;
}

function toRoman(n) {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}
async function runPool(tasks, concurrency, onDone) {
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i   = idx++;
      const res = await tasks[i]();
      onDone(i, res);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const [,, inputArg, outputArg, concArg] = process.argv;

  if (!inputArg) {
    console.error("Usage: node run-judgements.js <input.csv> [output.csv] [concurrency]");
    process.exit(1);
  }

  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set. Export it before running:");
    console.error("  export OPENROUTER_API_KEY=sk-or-v1-...");
    process.exit(1);
  }

  const scriptDir    = __dirname;
  const inputFile    = path.resolve(scriptDir, inputArg);
  const now          = new Date();
  const datestamp    = now.toISOString().slice(0, 10);
  const timestamp    = now.toTimeString().slice(0, 5).replace(":", "");
  const judgementsDir = path.join(scriptDir, "judgements");
  if (!fs.existsSync(judgementsDir)) fs.mkdirSync(judgementsDir);
  const defaultBase  = `salon-${datestamp}-${timestamp}`;
  const outputFile   = outputArg
    ? path.resolve(scriptDir, outputArg)
    : path.join(judgementsDir, `${defaultBase}.csv`);
  const htmlFile     = outputFile.replace(/\.csv$/i, ".html");
  const date         = datestamp;
  const concurrency  = Math.max(1, Math.min(8, parseInt(concArg ?? "4", 10)));

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const { topics, personaIds, questionerId } = parseCsv(fs.readFileSync(inputFile, "utf8"));
  if (!topics.length) {
    console.error("No topics found in input file.");
    process.exit(1);
  }

  // Filter personas if a "personas:" line was present in the CSV
  const activePersonas = personaIds
    ? PERSONAS.filter(p => personaIds.includes(p.id))
    : PERSONAS;

  if (personaIds && !activePersonas.length) {
    console.error(`No matching personas found for: ${personaIds.join(", ")}`);
    console.error(`Valid ids: ${PERSONAS.map(p => p.id).join(", ")}`);
    process.exit(1);
  }

  // Resolve the questioner (editorial framing only — they do not respond)
  const questioner = questionerId
    ? PERSONAS.find(p => p.id === questionerId) || null
    : null;
  if (questionerId && !questioner) {
    console.error(`Unknown questioner id: ${questionerId}`);
    console.error(`Valid ids: ${PERSONAS.map(p => p.id).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nSalon Batch Processor`);
  console.log(`  Topics   : ${topics.length}`);
  console.log(`  Personas : ${activePersonas.length}${personaIds ? ` (selected: ${activePersonas.map(p => p.name).join(", ")})` : ""}`);
  if (questioner) console.log(`  Posed by : ${questioner.name}`);
  console.log(`  Total    : ${topics.length * activePersonas.length} Judgements`);
  console.log(`  Workers  : ${concurrency}`);
  console.log(`  Output   : ${outputFile}`);
  console.log(`             ${htmlFile}\n`);

  // Fetch portraits from Wikipedia in parallel with judgements
  process.stdout.write("  Fetching portraits… ");
  const portraits = await fetchPortraits(activePersonas);
  const fetched = Object.keys(portraits).length;
  process.stdout.write(`${fetched}/${activePersonas.length} found\n\n`);

  const pairs = [];
  topics.forEach(t => activePersonas.forEach(p => pairs.push([t, p])));

  const results = new Map();
  const errors  = [];
  let done = 0;

  const tasks = pairs.map(([topic, persona]) => async () => {
    process.stdout.write(`  [${done + 1}/${pairs.length}] ${persona.name} × "${topic.slice(0, 40)}"… `);
    try {
      const text = await fetchJudgement(topic, persona);
      results.set(`${topic}::${persona.id}`, text);
      process.stdout.write("✓\n");
    } catch (err) {
      results.set(`${topic}::${persona.id}`, "");
      errors.push({ topic, persona: persona.name, msg: err.message });
      process.stdout.write(`✗ ${err.message}\n`);
    }
    done++;
  });

  await runPool(tasks, concurrency, () => {});

  // Write CSV
  const header = buildCsvRow(["Topic", ...activePersonas.map(p => `${p.name} — Judgement`)]);
  const rows   = topics.map(t =>
    buildCsvRow([t, ...activePersonas.map(p => results.get(`${t}::${p.id}`) ?? "")])
  );
  fs.writeFileSync(outputFile, [header, ...rows].join("\n"), "utf8");

  // Write HTML
  fs.writeFileSync(htmlFile, buildHtml(topics, results, date, activePersonas, portraits, questioner), "utf8");

  // Rebuild archive index
  const indexFile = buildIndex(scriptDir);

  console.log(`\nDone. ${done - errors.length} succeeded, ${errors.length} failed.`);
  if (errors.length) {
    console.log("Errors:");
    errors.forEach(e => console.log(`  • ${e.persona} / ${e.topic.slice(0, 40)}: ${e.msg}`));
  }
  console.log(`\nResults saved to:`);
  console.log(`  ${outputFile}`);
  console.log(`  ${htmlFile}`);
  if (indexFile) console.log(`  ${indexFile} (archive updated)\n`);
})();
