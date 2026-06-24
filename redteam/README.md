# redteam — a multi-agent adversarial loop

Pipe a task through a **proposer** that drafts an answer, then a **red team** of
adversary models that attack it, then back to the proposer to revise — for N
rounds or until every adversary signs off (PASS).

```
input ──► PROPOSER (drafts / revises)
             ▲                  │ draft
             │ critiques        ▼
          ADVERSARIES ◄── attack the draft (Gemini, GPT/Codex, …)
          loop until PASS or round limit
```

Every round is written to a Markdown transcript in `redteam/runs/`.

## Quick start (no setup)

Runs entirely on the local `claude` CLI:

```bash
node redteam/orchestrate.mjs --task "Design a fair rate limiter for a public API"
# or: npm run redteam -- --task "..."
```

## True multi-model red team (Claude vs Gemini vs GPT)

Uses [OpenRouter](https://openrouter.ai) — one key, many models. Set
`OPENROUTER_API_KEY` (the same key this repo already uses), then:

```bash
node redteam/orchestrate.mjs \
  --task "Write a function to merge overlapping intervals" \
  --config redteam/agents.openrouter.json \
  --rounds 4
```

## Options

| flag | meaning |
|------|---------|
| `--task "<text>"` | the task / artifact to work on |
| `--file <path>` | read the task from a file instead |
| `--config <path>` | agent config (default `agents.local.json`) |
| `--rounds <n>` | max proposer/critique rounds (default 3) |
| `--out <path>` | transcript path (default `redteam/runs/<timestamp>.md`) |
| `--quiet` | less console output |

## Configuring agents

A config has one `proposer` and one or more `adversaries`. Each agent picks an
**adapter**:

- **`cli`** — spawn a local command; prompt goes in on stdin, reply read from
  stdout. `"command": ["claude", "-p"]`. Add `gemini`/`codex` here once their
  CLIs are installed.
- **`openrouter`** — POST to OpenRouter. Set `"model"` to any ID from
  <https://openrouter.ai/models> (e.g. `anthropic/claude-sonnet-4.5`,
  `google/gemini-2.5-pro`, `openai/gpt-5`). Reads `OPENROUTER_API_KEY` (override
  per-agent with `"apiKeyEnv"`).

```jsonc
{
  "proposer":   { "name": "Claude", "adapter": "openrouter", "model": "anthropic/claude-sonnet-4.5" },
  "adversaries": [
    { "name": "Gemini", "adapter": "openrouter", "model": "google/gemini-2.5-pro" },
    { "name": "Codex",  "adapter": "openrouter", "model": "openai/gpt-5" }
  ]
}
```

### Adding a new transport

Adapters live in the `ADAPTERS` map in `orchestrate.mjs`. Each is
`async (agent, system, user) => string`. Add a key (e.g. a direct Anthropic or
Gemini SDK call) and reference it by name from any agent's `"adapter"` field.

## How convergence works

Each adversary is asked to end with `VERDICT: PASS` or `VERDICT: REVISE`. When
every adversary returns PASS in the same round, the loop stops early. Otherwise
it runs until `--rounds`. The final draft and a full per-round transcript are
saved under `redteam/runs/`.
