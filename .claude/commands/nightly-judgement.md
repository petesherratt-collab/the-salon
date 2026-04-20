---
description: Generate, commit, and push a nightly Salon Judgement
---

# Nightly Judgement

You are running an automated routine for The Salon. Generate one new Judgement, commit it, and push to `main`. Vercel will deploy.

## Preconditions

- Current working directory is the repo root (contains `run-judgements.js`, `voices.html`, `salon-index.html`, `judgements/`).
- `node` is on PATH.
- Current branch is `main` with a clean working tree.
- Network access to `https://the-salon.vercel.app/api/chat` (the proxy endpoint — key lives in Vercel env).

No OpenRouter key is needed: `run-judgements.js` defaults to the Vercel proxy, and the question-generation step in this routine also goes through the proxy.

If any precondition fails, report what's missing and stop. Do not attempt to fix environment issues.

## Steps

### 1. Parse `voices.html` for personas and their domains

For each `<div class="voice-card" data-domains="...">`, extract:
- The persona ID from the adjacent `<a class="btn-converse" href="index.html#<id>">` anchor.
- The domains list from `data-domains` (space-separated).

### 2. Intersect with `run-judgements.js` PERSONAS array

Open `run-judgements.js` and read the `PERSONAS` array (starts at the `const PERSONAS = [` line). Keep only IDs that appear in both `voices.html` and that array — those are the only personas the script can actually generate Judgements for.

### 3. Select questioner + domain

- Pick one persona at random from the intersected list as the **questioner**.
- Pick one of the questioner's `data-domains` at random as the **topic domain**.

### 4. Generate the question via the Vercel proxy

POST to `https://the-salon.vercel.app/api/chat` (no auth header — Vercel holds the key):

```json
{
  "model": "anthropic/claude-sonnet-4-5",
  "max_tokens": 200,
  "messages": [
    {"role": "system", "content": "You are <questioner name>, the historical thinker. In character, pose one sharp, specific question within the domain of <domain>. One sentence. No preamble, no greeting, no quotation marks around the output."},
    {"role": "user", "content": "Pose your question now."}
  ]
}
```

Parse `choices[0].message.content`. Strip surrounding quotes/whitespace. If the call fails or the response has no content, log the error and stop — do not commit.

### 5. Pick respondents

From the intersected list, filter to personas whose domains include the chosen topic domain, then remove the questioner.

- If more than 7 remain, pick 7 at random.
- If fewer than 3 remain, widen by adding random personas from the intersected list (excluding the questioner) until there are at least 3 respondents. This avoids thin Judgements.

### 6. Write the temp CSV

Write a file at `./nightly-input.csv` with this exact shape:

```
questioner: <questioner-id>
personas: <id1>, <id2>, <id3>, ...
Topic
<the generated question>
```

The `questioner:` and `personas:` lines are parsed as prefix directives by `run-judgements.js`.

### 7. Run the script

```
node run-judgements.js nightly-input.csv
```

The script writes:
- `judgements/salon-<YYYY-MM-DD>-<HHMM>.csv`
- `judgements/salon-<YYYY-MM-DD>-<HHMM>.html`
- `salon-index.html` (archive rebuilt)

If the script exits non-zero, log its output and stop.

If the script succeeds but reports some persona failures, continue **only if at least 3 respondents succeeded**. Parse stdout for the "N succeeded, M failed" line. If fewer than 3 succeeded, stop and do not commit.

### 8. Delete the temp CSV

`rm nightly-input.csv`. Do not commit it.

### 9. Commit and push

```
git add judgements/ salon-index.html
git status
```

Confirm that only `judgements/salon-*.csv`, `judgements/salon-*.html`, and `salon-index.html` are staged. If anything else is staged, unstage it.

Commit with this message shape:

```
Issue — "<question truncated to 60 chars, with trailing ellipsis if truncated>" posed by <Questioner Name>
```

Then `git push origin main`.

### 10. Report

Print a one-paragraph summary: questioner, domain, question, respondent names, successes/failures, commit SHA.

## Failure handling

- Proxy failure at step 4: report and stop. No commit.
- Script non-zero exit at step 7: report and stop. No commit.
- Script succeeded but fewer than 3 respondents completed: report and stop. No commit, no push. Leave the generated files on disk for inspection.
- Git push failure: report the error. The files are already committed locally, so a human can retry the push.

## Do not

- Do not modify `run-judgements.js`, `voices.html`, `index.html`, or any persona research file.
- Do not retry a failed run — exit and let the next scheduled run try again.
- Do not `git add -A`; stage only the judgement outputs and the rebuilt index.
- Do not skip git hooks.
