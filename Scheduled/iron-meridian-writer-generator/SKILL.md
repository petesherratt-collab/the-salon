---
name: iron-meridian-writer-generator
description: Generate writers for Iron Meridian
---

Generate a new Iron Meridian fiction writer persona and save both files to the connected Iron Meridian folder.

## STEP 0 — DISCOVER THE WORKSPACE

The Iron Meridian folder is mounted into this run. The correct location on the Windows host is:
`C:\Users\Admin\OneDrive\Documents\Claude\Iron Meridian`

To find its absolute Linux path at runtime:

1. Run `ls /sessions/*/mnt/` via the bash tool.
2. Locate the directory named `Iron Meridian` inside one of those mounts.
3. Use that absolute path for all file writes. If multiple candidates exist, prefer the one that maps to `C:\Users\Admin\OneDrive\Documents\Claude\Iron Meridian` — i.e. NOT a folder nested inside a `Projects` subfolder. The correct mount will contain existing persona subfolders (Cal Brennan, Frank Gideon, Mickey Doyle, etc.).
4. If no `Iron Meridian` folder is found, abort with a clear error in the report — do not invent a path.

## STEP 1 — RANDOMISE THE PROFILE

Pick each of the following randomly (genuine random, not LLM-default-pick):

**Genre** (weighted equally):
Literary Fiction, Noir/Hardboiled, Gothic Horror, Pulp Adventure, Psychological Thriller, Historical Fiction, Crime Fiction, Science Fiction, Dark Fantasy

**Era**:
Contemporary (2000s–present), Late 20th Century (1970s–1990s), Mid 20th Century (1940s–1960s), Early 20th Century (1900s–1930s), 19th Century

**Influence Camp**:
Literary (Woolf/Flaubert/James), Pulp (Chandler/Hammett/Dent), Bridge Figure (Orwell/Chandler — both camps), Gothic/Weird (Poe/Lovecraft)

**Biographical Seed** (pick one or invent in similar register):
ex-journalist · recluse · war correspondent · failed academic · lapsed priest · merchant marine · physician who left medicine · disbarred lawyer · immigrant who lost the language · railway worker · sanatorium patient · nightclub pianist · advertising copywriter who quit · ghost-writer · itinerant teacher · former soldier · widow/widower · drifter · pawnshop clerk · secretary to someone famous

**Name**: Invent a period-appropriate name fitting the genre, era, and biographical seed.

## STEP 2 — PARAMETER MATRIX (BIAS TOWARD EXTREMES)

Roll the 22 parameters using this method — NOT uniform 0–5 random:

1. **Pick 3–5 "defining" parameters at random** from the list below.
2. Push each defining parameter to **0 or 5** (the extreme — flip a coin).
3. Roll the remaining parameters at **2, 3, or 4** (middling).

This produces internally-consistent, vivid personas instead of bland 3/3/3 averages. A persona with five 0/5 extremes and seventeen middling values reads as a real person with a few defining obsessions.

**Parameters (code · name · 0 vs 5 meaning):**

*Process:*
- A1 Output speed/volume (0=leisurely · 5=prolific machine)
- A2 Revision intensity (0=ship first draft · 5=revise indefinitely)
- A3 Pre-planning/outlining (0=pure discovery · 5=full blueprint)
- A4 Use of formula/template (0=organic · 5=rigid template)

*Structure:*
- B1 Working backwards from effect (0=discovery writer · 5=effect-first architect)
- B2 Beat/quarter structure (0=intuitive · 5=mechanical beats)
- B4 Story vs plot — interiority (0=pure plot · 5=psychological depth)
- B5 Escalating jeopardy per beat (0=contemplative · 5=relentless escalation)

*Character:*
- C1 Round vs flat characters (0=flat archetypal · 5=psychologically round)
- C2 Hero as competent specialist (0=ordinary · 5=expert)
- C5 Villain/antagonist complexity (0=pure antagonist · 5=understandable villain)

*Style:*
- D1 Le mot juste / sentence perfectionism (0=good enough · 5=obsessive precision)
- D2 Plain/colloquial prose (0=ornate literary · 5=plain colloquial)
- D3 Atmospheric/mood-first writing (0=scene-action · 5=atmosphere first)
- D5 Defining simile / striking image (0=functional · 5=image-driven)
- D6 Prose rhythm / sentence musicality (0=flat · 5=highly musical)

*Motivation:*
- E1 Writing as trade/craft (0=not a tradesperson · 5=pure craftsperson)
- E2 Writing as spiritual vocation (0=pragmatic · 5=spiritual necessity)
- E4 Egoism / desire to be remembered (0=humble · 5=must leave a mark)
- E5 Reader satisfaction as primary goal (0=self-expression · 5=reader experience first)

*Conditions:*
- F1 Solitude as prerequisite (0=writes anywhere · 5=needs total isolation)
- F4 Financial pressure as motivator (0=secure · 5=deadline as oxygen)

## STEP 3 — DETECT AND USE CONFLICTS

After rolling, check these conflict pairs. If both members are ≥4, the conflict fires:

- **A1 ≥ 4 AND A2 ≥ 4** → Speed/revision conflict. Resolve biographically: trained in revision but necessity forced speed — a psychological tension, not a contradiction.
- **D1 ≥ 4 AND D2 ≥ 4** → Style conflict. Resolve as Orwell/Chandler bridge: plainness understood as accuracy, not laziness.
- **E1 ≥ 4 AND E2 ≥ 4** → Philosophy conflict: trade dominant, with a suppressed vocational impulse that never quite died.

Conflicts are FEATURES, not bugs — they make the persona psychologically real. Dramatise them in the backstory.

## STEP 4 — GENERATE THE SYSTEM PROMPT

**Adopt this voice for this step:** *You are the Project Architect — a specialist in creating high-performance system prompts for AI writing personas. Be concrete, specific, testable. No vague instructions. Every rule must be falsifiable.*

Produce a complete Markdown system prompt with exactly this structure:

```
# [Persona Name] — [Genre] Writer

## Role & Identity
One sharp paragraph. Who is this writer? What do they uniquely do? Voice should be implied, not described.

## Core Objectives
What this Project exists to do. 2–3 tight sentences.

## Internal Logic
How the writer thinks before generating. Chain of thought: what they assess first, how they handle ambiguity, what they verify before writing a word.

## Style & Voice
A DO / DON'T table with at least 6 rows. Map directly from the parameter values. Specific and testable.

| DO | DON'T |
|---|---|
| ... | ... |
| Run all four beats to their full weight — 875 words minimum per quarter, 3,500 words minimum total | Compress four acts into three pages; that's a pitch, not a manuscript |

## Hard Constraints
The absolute NEVER list. 5–7 items max. After each, one-line reason. Include parameter code in parentheses where relevant.

NEVER deliver a complete story under 3,500 words. Four beats, minimum 875 words each. A story that resolves before page eight didn't put the hero in enough trouble. (A1, B2, B5)

## Conflict Resolution Protocol
If any parameter conflicts fired, explain in 2–3 sentences how the persona navigates this psychologically. Omit this section entirely if no conflicts fired.
```

## STEP 5 — GENERATE THE BACKSTORY

**Adopt this voice for this step:** *You are a literary biographer creating a rich, convincing backstory document. Write as if for a library archive — specific, vivid, opinionated. Avoid generic praise.*

Produce a Markdown backstory with exactly this structure:

```
# [Name] — A Life in Writing

## The Writer at a Glance
A vivid 2–3 sentence portrait. An impression, not a summary.

## Origins & Formation
Where they came from. What made them a writer. The early influences that lodged permanently. Ground this in the parameter values and biographical seed — high F4 suggests poverty/necessity; high E2 suggests a calling discovered young.

## The Working Method
How they actually write. Translate A-parameter values into biographical habits and rituals. Specific: routines, tools, superstitions, disciplines.

## Voice & Obsessions
What they always come back to. Recurring images, preoccupations, stylistic fingerprints. Derive from D and C parameters.

## The Conflict at the Heart
Every great writer has an irresolvable tension. Identify and dramatise theirs (drawn from any parameter conflicts that fired).

## Critical Reception (Fictional)
2–3 invented quotes from fictional contemporaries or reviewers. Calibrate to the influence camp.

## Late Career / Legacy
How the career ended or what the work left behind. Should feel earned, not generic.
```

## STEP 6 — SAVE THE FILES

1. Create a new subfolder inside the Iron Meridian folder from STEP 0: `[Iron Meridian path]/[Writer Name]/`
2. If a folder with that name already exists, append a digit or year to disambiguate (e.g. `Mickey Doyle 2`).
3. Save the system prompt as: `[Writer Name]-system-prompt.md`
4. Save the backstory as: `[Writer Name]-backstory.md`

## STEP 7 — UPDATE THE INDEX

After the persona files are saved, append a new card to the master `INDEX.md` in the Iron Meridian folder so the roster stays current. Do this BEFORE the final report.

1. Read `INDEX.md` from the Iron Meridian root (the folder from STEP 0, NOT the writer subfolder from STEP 6).
2. If `INDEX.md` doesn't exist, skip this step entirely and note it in the report. Do NOT create it from scratch — its hand-built structure should not be reconstructed by the daily generator.
3. Find the line containing `<!-- AUTO-APPEND-MARKER -->`.
4. Build a new writer card matching this exact format (mirror the existing entries):

```
---

## [Writer Name]
**[Genre] · [Era] · [Camp]** · *[Bio Seed]*

> [The "Writer at a Glance" portrait — copy the first sentence of the backstory verbatim if 30 words or less; otherwise condense to a single 25–35 word sentence capturing the same impression.]

**Defining parameters:** [Code1=Value1 (Short Name1) · Code2=Value2 (Short Name2) · ...]

**Stories:** —

```

Format rules:
- Use ` · ` (space-bullet-space) as the separator throughout.
- Only list the 3–5 parameters rolled to 0 or 5 — not the middling ones.
- "Short Name" should be 2–4 words (e.g. "Output speed/volume", "Plain prose", "Solitude required", "Reader satisfaction").
- The card already begins with `---` on its own line — do not add an extra one.

5. Insert the new card immediately ABOVE the `<!-- AUTO-APPEND-MARKER -->` line.
6. Update the line near the top reading `*Last refreshed: [date] · [N] writers on the books*` — replace `[date]` with today's date in `D Month YYYY` format (e.g. `2 May 2026`), and increment `[N]` by one.
7. Save `INDEX.md` back.

## STEP 8 — REPORT TO USER

In the chat report:
- The writer's name, genre, era, influence camp, biographical seed
- The 3–5 defining parameters that shaped them (the ones rolled to 0 or 5), each with its value
- Any parameter conflicts detected and how they were resolved
- Both persona file paths as `computer://` links the user can click to open
- Confirmation that `INDEX.md` was updated, with the new writer count (or a note if STEP 7 was skipped)
