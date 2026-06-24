#!/usr/bin/env node
// redteam/orchestrate.mjs
//
// A multi-agent adversarial loop ("red team").
//
//   input  ──►  PROPOSER (writes / revises a draft)
//                  ▲                       │ draft
//                  │ critiques             ▼
//               ADVERSARIES  ◄──  (Gemini, GPT/Codex, … attack the draft)
//
// The proposer drafts, every adversary critiques, the critiques feed back into
// the next proposer round, and so on for N rounds or until every adversary
// returns a PASS verdict (convergence). A full transcript is written to disk.
//
// Each agent is reached through a pluggable *adapter* (see ADAPTERS below):
//   - "cli"        spawn a local command (e.g. the `claude` CLI), prompt on stdin
//   - "openrouter" POST to OpenRouter chat/completions (Claude, Gemini, GPT, …)
//
// Usage:
//   node redteam/orchestrate.mjs --task "Design a rate limiter" [options]
//   node redteam/orchestrate.mjs --file ./brief.md
//
// Options:
//   --task   <text>   The task / artifact to work on (or use --file)
//   --file   <path>   Read the task from a file
//   --config <path>   Agent config JSON (default: redteam/agents.local.json)
//   --rounds <n>      Max proposer/critique rounds (default: 3)
//   --out    <path>   Transcript output path (default: redteam/runs/<ts>.md)
//   --quiet           Less console chatter

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── tiny arg parser ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("\n").filter(l => l.startsWith("//")).map(l => l.slice(3)).join("\n"));
  process.exit(0);
}

// ── resolve the task ─────────────────────────────────────────────────────────
let task = typeof args.task === "string" ? args.task : null;
if (!task && typeof args.file === "string") task = readFileSync(args.file, "utf8");
if (!task) {
  console.error("Error: provide a task with --task \"...\" or --file <path>. Use --help.");
  process.exit(1);
}

const maxRounds = Number(args.rounds) || 3;
const configPath = resolve(typeof args.config === "string" ? args.config : join(__dir, "agents.local.json"));
const quiet = !!args.quiet;

if (!existsSync(configPath)) {
  console.error(`Error: config not found: ${configPath}`);
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, "utf8"));

const log = (...m) => { if (!quiet) console.log(...m); };

// ── adapters: how we actually call a model ──────────────────────────────────
const ADAPTERS = {
  // Spawn a local CLI and read the reply from stdout. Tools differ in how they
  // accept the prompt, so agent.promptVia selects:
  //   "stdin" (default) — pipe the prompt in   (e.g. ["claude", "-p"])
  //   "arg"             — append it as the last argument
  //                       (e.g. ["gemini", "-p"] or ["codex", "exec"])
  // agent.command is the base command as an array.
  async cli(agent, system, user) {
    const cmd = [...(agent.command || ["claude", "-p"])];
    const prompt = (system ? `${system}\n\n` : "") + user;
    const via = agent.promptVia || "stdin";
    if (via === "arg") cmd.push(prompt);
    // On Windows the CLIs are .cmd shims, which require a shell to launch.
    // (Prefer promptVia "stdin" there: a piped prompt is immune to the
    // argument mangling cmd.exe does to multi-line strings.)
    const useShell = process.platform === "win32";
    return await new Promise((res, rej) => {
      const ps = spawn(cmd[0], cmd.slice(1), { stdio: ["pipe", "pipe", "pipe"], shell: useShell });
      let out = "", err = "";
      ps.stdout.on("data", d => (out += d));
      ps.stderr.on("data", d => (err += d));
      ps.on("error", rej);
      ps.on("close", code => code === 0
        ? res(out.trim())
        : rej(new Error(`${(agent.command || []).join(" ")} exited ${code}: ${err.slice(0, 500)}`)));
      if (via === "stdin") ps.stdin.write(prompt);
      ps.stdin.end();
    });
  },

  // OpenRouter chat/completions — one key, many models (Claude / Gemini / GPT …).
  async openrouter(agent, system, user) {
    const key = process.env[agent.apiKeyEnv || "OPENROUTER_API_KEY"];
    if (!key) throw new Error(`Missing API key: set ${agent.apiKeyEnv || "OPENROUTER_API_KEY"} in your environment / .env`);
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: user });
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://the-salon-ten.vercel.app",
        "X-Title": "the-salon redteam",
      },
      body: JSON.stringify({
        model: agent.model,
        messages,
        ...(agent.max_tokens ? { max_tokens: agent.max_tokens } : {}),
        ...(agent.temperature != null ? { temperature: agent.temperature } : {}),
      }),
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 500)}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content?.trim() ?? "";
  },
};

async function callAgent(agent, system, user) {
  const adapter = ADAPTERS[agent.adapter];
  if (!adapter) throw new Error(`Unknown adapter "${agent.adapter}" for agent "${agent.name}"`);
  return adapter(agent, system, user);
}

// ── prompt builders ──────────────────────────────────────────────────────────
function proposerPrompt(task, draft, critiques) {
  if (!draft) {
    return `# Task\n${task}\n\nProduce the best possible response to the task above. ` +
      `Be concrete and complete. Output only the response itself.`;
  }
  const crit = critiques.map((c, i) =>
    `## Critique ${i + 1} — from ${c.name}\n${c.text}`).join("\n\n");
  return `# Task\n${task}\n\n# Your previous draft\n${draft}\n\n` +
    `# Red-team critiques of that draft\n${crit}\n\n` +
    `Revise your draft to address every valid critique above. Keep what was strong, ` +
    `fix what was weak, and do not introduce new problems. Output only the revised response.`;
}

function adversaryPrompt(task, draft) {
  return `# Task that was given\n${task}\n\n# Draft answer to attack\n${draft}\n\n` +
    `You are an adversarial reviewer. Find the real weaknesses: factual errors, ` +
    `flawed reasoning, missed requirements, security or safety issues, edge cases, ` +
    `and unsupported claims. Be specific and actionable — cite the part you mean.\n\n` +
    `End your reply with EXACTLY ONE of these lines:\n` +
    `VERDICT: PASS   (no significant issues remain)\n` +
    `VERDICT: REVISE (issues above should be fixed)`;
}

const passed = (text) => /VERDICT:\s*PASS/i.test(text);

// ── the loop ─────────────────────────────────────────────────────────────────
const proposer = config.proposer;
const adversaries = config.adversaries || [];
if (!proposer) { console.error("Config error: missing `proposer`."); process.exit(1); }
if (!adversaries.length) { console.error("Config error: need at least one `adversaries` entry."); process.exit(1); }

const transcript = [
  `# Red-team run — ${new Date().toISOString()}`,
  ``,
  `**Config:** \`${configPath}\`  ·  **Max rounds:** ${maxRounds}`,
  `**Proposer:** ${proposer.name} (${proposer.adapter}${proposer.model ? ` · ${proposer.model}` : ""})`,
  `**Adversaries:** ${adversaries.map(a => `${a.name} (${a.adapter}${a.model ? ` · ${a.model}` : ""})`).join(", ")}`,
  ``,
  `## Task`,
  task.trim(),
  ``,
];

let draft = null;
let critiques = [];
let convergedRound = null;

for (let round = 1; round <= maxRounds; round++) {
  log(`\n▶ Round ${round}/${maxRounds}`);
  transcript.push(`\n---\n\n## Round ${round}`);

  // 1) Proposer drafts / revises.
  log(`  ${proposer.name} (proposer) drafting…`);
  draft = await callAgent(proposer, proposer.system, proposerPrompt(task, draft, critiques));
  transcript.push(`\n### Draft — ${proposer.name}\n\n${draft}`);

  // 2) Every adversary attacks the new draft (in parallel).
  log(`  Red team attacking…`);
  const results = await Promise.allSettled(
    adversaries.map(a => callAgent(a, a.system, adversaryPrompt(task, draft)))
  );

  critiques = [];
  let allPass = true;
  results.forEach((res, i) => {
    const a = adversaries[i];
    if (res.status === "fulfilled") {
      const text = res.value;
      critiques.push({ name: a.name, text });
      const ok = passed(text);
      if (!ok) allPass = false;
      log(`    ${a.name}: ${ok ? "PASS" : "REVISE"}`);
      transcript.push(`\n### Critique — ${a.name}  ·  ${ok ? "✅ PASS" : "🔧 REVISE"}\n\n${text}`);
    } else {
      allPass = false;
      log(`    ${a.name}: ERROR — ${res.reason.message}`);
      transcript.push(`\n### Critique — ${a.name}  ·  ⚠️ ERROR\n\n\`\`\`\n${res.reason.message}\n\`\`\``);
    }
  });

  if (allPass) {
    convergedRound = round;
    log(`\n✓ Converged — all adversaries returned PASS in round ${round}.`);
    transcript.push(`\n> **Converged in round ${round}** — all adversaries returned PASS.`);
    break;
  }
}

transcript.push(`\n---\n\n## Final output\n\n${draft}`);
transcript.push(`\n---\n\n_${convergedRound
  ? `Converged after ${convergedRound} round(s)._`
  : `Stopped at the ${maxRounds}-round limit without full consensus._`}`);

// ── write transcript ─────────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = resolve(typeof args.out === "string" ? args.out : join(__dir, "runs", `${ts}.md`));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, transcript.join("\n") + "\n");

log(`\n📄 Transcript: ${outPath}`);
console.log("\n" + "═".repeat(60) + "\nFINAL OUTPUT\n" + "═".repeat(60) + "\n");
console.log(draft);
