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

## True multi-model red team with local CLIs (Claude + Gemini + Codex)

If you'd rather drive the vendors' own terminal agents than go through
OpenRouter — handy on your own machine, where you install once and reuse your
existing ChatGPT/Google logins instead of per-token API keys:

```bash
# install (Node 18+)
npm i -g @google/gemini-cli      # provides `gemini`
npm i -g @openai/codex           # provides `codex`

# auth once
gemini                           # Google login, or set GEMINI_API_KEY
codex login                      # ChatGPT account, or set OPENAI_API_KEY

# run the loop across all three
node redteam/orchestrate.mjs --task "..." --config redteam/agents.cli.json
```

| CLI | install | non-interactive call | auth |
|-----|---------|----------------------|------|
| Claude | (this tool) | `claude -p` (stdin) | already signed in |
| Gemini | `npm i -g @google/gemini-cli` | `gemini -p "<prompt>"` | `gemini` login or `GEMINI_API_KEY` |
| Codex  | `npm i -g @openai/codex` | `codex exec "<prompt>"` | `codex login` or `OPENAI_API_KEY` |

> Note: these CLIs take the prompt as a command **argument**, while `claude -p`
> reads **stdin**. The config handles this with `"promptVia"` (`"arg"` vs the
> default `"stdin"`) — see `agents.cli.json`.

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

- **`cli`** — spawn a local command; reply read from stdout. Set `"command"`
  (e.g. `["claude", "-p"]`, `["gemini", "-p"]`, `["codex", "exec"]`) and
  `"promptVia"`: `"stdin"` (default, pipe the prompt in) or `"arg"` (append it as
  the last argument). See `agents.cli.json` for a Claude+Gemini+Codex setup.
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
