# Worked example — 3-way data-pipeline comparison

The run this skill was extracted from. Same prompt (a 12-point adversarial review of a
self-contained React "data analysis pipeline" artifact) was given to **Claude**, **Codex**, and
**Gemini**; each returned a corrected implementation. Goal: rank them, vendor-blind, by evidence.

## 1. Rubric (extracted from the review)

| # | Criterion | Type |
|---|-----------|------|
| 1 | Move LLM auth server-side (proxy), not direct browser → Anthropic | judgment |
| 2 | Guard `!res.ok` so HTTP errors throw, not yield `""` | mechanical-ish |
| 3 | CSV tokenizer: quoted newlines, mid-field quotes, leading-ws-before-quote | **mechanical** |
| 4 | De-duplicate repeated headers | **mechanical** |
| 5 | Surface + render raw output when tier JSON won't parse; extract first `{…}` | **mechanical** |
| 6 | Raise `max_tokens` (truncation risk) | judgment |
| 7 | Pin a **current** model id | judgment |
| 8 | Reject oversized files before reading | mechanical-ish |
| 9 | Don't average ID-like columns; handle Euro decimals | **mechanical** |
| 10 | Prompt-injection: delimiters + "treat as data" instruction + cap strings | judgment |
| 11 | Dropzone keyboard/SR accessibility | judgment |
| 12 | Quote-aware delimiter detection | **mechanical** |

Acceptance inputs lifted into the harness: `12" Monitor`, `2"x4" Lumber`, `"Smith, John\n123 Main St"`,
`1, "Smith, John"`, header row `Amount,Region,Amount`, and the header set
`{customer_id, zip, humidity, paid_amount, order_total, …}` for #9.

## 2. Mechanical results (executed, see `../harness.mjs` for #9)

#9 ID-column heuristic, scored against expected:

```
Claude 10/10   Codex 7/10   Gemini 5/10
```

- **Gemini** ❌ — bare `/id/` substring matches "hum**id**ity", "p**aid**_amount", "width" → destroys
  stats on real measures. Shipped under a confident `// Fix #9` comment.
- **Codex** ⚠️ — over-broad list excludes `order_total` / `invoice_amount` / `account_balance`
  (money you'd want averaged). Has the only Euro-decimal handling, though.
- **Claude** ✅ — anchored regex + `allInt` gate; only one to pass all 10.

#3/#4/#12 (parsers): Claude ✅, Codex ✅ (+ BOM strip, full delimiter state machine), Gemini ✅ on
#3/#4 but **left #12 unchanged** (still counts delimiters inside quotes).

## 3. Judgment results (vendor-blind)

- **#7 model:** Claude pinned a *current* id; Codex kept a *stale snapshot*; Gemini **downgraded to
  `claude-3-5-sonnet-latest`** — older *and* a floating alias (opposite of "pin"). Worst miss.
- **Regression the review forbade:** Codex stripped the UI polish the review said to leave
  (`✓`→`OK`, glyphs/arrows gone). Cleanest logic, most regressed surface.
- **Beyond-spec wins:** Claude = 429 retry + wired to a *real* backend; Codex = BOM strip + only
  top-2 tiers re-serialized to Quill.

## 4. Scorecard → verdict

**Codex ≈ Claude > Gemini.** Codex is deeper inside the parser; Claude is stronger on cross-cutting
concerns (retry, real wiring, model currency, didn't break the UI, best-targeted ID regex). Gemini
covers headline points but ships three genuine regressions (#7, #9, #12) plus the weakest injection.

**Best composite (the actually-useful output):** take **Claude as the base**, port Codex's
`extractFirstJsonObject` (depth/string-aware) and BOM strip. Beats all three.

## Lesson this example teaches

Every file's `// Fix #9` comment asserted success; the harness showed two were wrong. The skill's
value is executing the mechanical claims — and being honest that #7/#10/UI are judgment, not tests.
