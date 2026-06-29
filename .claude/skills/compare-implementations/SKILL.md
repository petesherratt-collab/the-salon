---
name: compare-implementations
description: Rank N implementations of one spec or code review, vendor-blind, by RUNNING each against acceptance criteria instead of trusting its own "fixed it" comments. Use when comparing multiple AI/model outputs (Claude vs Codex vs Gemini, etc.) or candidate PRs that all claim to satisfy the same review or requirements, and you want a scorecard + verdict + best-composite recommendation.
---

# Compare Implementations

Rank several implementations of **one** spec/review and say which is best — and why — without
being fooled by self-congratulatory `// Fix #N` comments. The whole point of this skill over a
casual read-through: **the mechanical claims get executed, not believed.** In the worked example
below, three files all carried a `// Fix #9` comment; running them showed two were buggy.

## When to use

- Multi-model bake-offs: the same prompt sent to Claude / Codex / Gemini / etc.
- Several candidate PRs or branches that all claim to satisfy the same review or issue.
- Any "which of these N did it best?" where the answer should be evidence-based and neutral.

Not for reviewing a single diff — use `/code-review` for that. This skill is specifically
N-implementations-of-one-spec, ranked.

## Inputs you need

1. **The spec or review** the implementations were built against (the list of requirements /
   defects). If the user only gives you the candidate files, reconstruct the criteria from them
   first and confirm the list.
2. **The N candidate files/branches.** Label them by origin (model/author) but stay vendor-blind
   in judgment — never let "this model also wrote the review" tilt the score.

## Procedure

### 1. Extract the rubric
Turn the spec/review into a flat checklist of **acceptance criteria**, each with a concrete,
checkable test where possible. Pull the *failing inputs* named in the review into the harness —
they are the requirement. (e.g. `12" Monitor`, `1, "Smith, John"`, duplicate headers, a `humidity`
column that must NOT be misclassified.) Confirm the checklist with the user if it's non-obvious.

Tag each criterion **mechanical** (runnable: parsers, regexes, JSON extraction, numeric output) or
**judgment** (not unit-testable: model choice, UI/aesthetic regressions, architecture, "is this
exclusion semantically right?").

### 2. Harness the mechanical criteria — this is the part that earns its keep
Extract the relevant pure functions from each candidate and run them against the shared inputs.
Produce pass/fail per candidate per criterion. Do NOT read the candidate's comments and mark it
passed — execute it. See `harness.mjs` for the pattern: isolate the function, feed adversarial
inputs, print a per-candidate table.

If a function can't be isolated cleanly (tangled in component state), say so and downgrade that
cell to a manual judgment with a note — don't fake a green check.

### 3. Judge the rest, vendor-blind
For judgment criteria, reason explicitly and briefly. Common high-value ones:
- **Model currency / pinning** — did they pin a *current* id, keep a *stale snapshot*, or
  *downgrade* / use a *floating alias*? (Check against the claude-api skill / provider docs; never
  assert from memory.)
- **Regressions the review told them NOT to make** — stripped styling, removed features, broke
  working behavior while "fixing" something else. These cost points heavily.
- **Robustness beyond the review** — BOM stripping, retries, configurable endpoints. Credit these.
- **Did it wire to something real**, or reference an endpoint/file that doesn't exist yet?

### 4. Emit the scorecard
A markdown table: rows = criteria, columns = candidates, cells = ✅ / ⚠️ / ❌ with a 2-4 word
note. Mark beyond-the-spec wins and explicit regressions. Then:
- **Per-candidate** strengths/weaknesses paragraph.
- **Verdict** — ranked, with the deciding factors stated.
- **Best composite** — "take X as the base, port Y and Z from the others." This is usually the most
  useful output: the best *shippable* result is rarely any single candidate.

## Honest scope

This skill makes the mechanical ~60% rigorous and repeatable and disciplines the subjective ~40%
into a fixed format. It does **not** fully automate the judgment calls, and it must not pretend to:
a green harness cell means "this input produced the right output," not "this file is correct."
State residual uncertainty plainly.

## Anti-patterns

- ❌ Trusting `// Fix #N` / "✓ handled" comments. Run it.
- ❌ Letting authorship tilt the verdict (the model that wrote the review doesn't get a bonus).
- ❌ Faking a pass when a function couldn't actually be isolated and run.
- ❌ Declaring one file the winner when a 10-minute composite beats all of them — say that instead.

See `examples/data-pipeline-review.md` for a full worked run (the 3-way CSV pipeline comparison
this skill was extracted from), and `harness.mjs` for the runnable test pattern.
