# Contributing — Adding a Voice to The Salon

The Salon is curated rather than open. Personas are not added by pull request — each one is built deliberately, then tested in conversation before being added to the roster. This document records the method, both as guidance for collaborators and as an instruction manual for the project's future self.

---

## The principle

A persona in The Salon is not a prompt. It is a paired pair of documents — a **factsheet** and a **system prompt** — that together constitute an editorial design. The factsheet is the raw material; the system prompt is the instrument. Neither works without the other.

A good persona is one where:

- You can quiz it on the figure's life and it answers consistently and in voice
- You can put a contemporary question to it that the original thinker never saw, and the response feels like *what they would have thought* rather than *what a modern person thinks they should have thought*
- Its blind spots and prejudices are preserved, not edited out
- Its analytical framework is fixed to its formation period, even though its knowledge of the world is contemporary

This last point is the core working principle of The Salon: **more data, same analytical instrument.** Hobbes can read a tweet. He still reads it as a Hobbesian.

---

## The pair

Every persona consists of two files with the same stem:

```
machiavelli.md     ← system prompt (operating instructions)
machiavelli.rtf    ← factsheet (research)
```

### The factsheet (`.rtf`)

A research document, typically 4,000–10,000 words, covering:

- Biography — birth, formation, key events, death
- Intellectual formation — who they read, what they reacted against
- Vocabulary — characteristic words, phrases, rhetorical moves
- Positions — what they argued, what they opposed
- Contemporaries — peers, rivals, the conversation they were part of
- Blind spots — the things they could not see or refused to engage with
- Voice — how they wrote, what register, what cadence

The factsheet is not edited for the persona's benefit. It includes things the persona would never say of themselves.

### The system prompt (`.md`)

The instrument. Typically 400–1,200 words. Specifies:

- Identity — who they are, in their own framing
- Voice — register, cadence, characteristic moves
- Format — for Judgements: Framing / Reframe / Verdict / Maxim, 350 words. For Long Form: the persona's own structural habits.
- Operating principle — *contemporary knowledge, formation-period framework*
- Refusals — what they will not engage with, and how they decline

The system prompt does not reproduce the factsheet. It refers to it. The model will draw on both at generation time.

---

## The workflow

### 1. Research

Build the factsheet first. Read primary sources where possible. Cross-reference biographies. Note the characteristic moves of the figure's writing — not just the content but the *shape* of how they argue. If you can't quote them in their own cadence by the end of the research, you don't have enough yet.

### 2. Draft the system prompt

Use the existing personas as templates for structure, not voice. The voice has to come from the factsheet.

### 3. Audit the pair

Run the `persona-analyst` workflow: feed both files to a model and ask it to audit the system prompt against the factsheet. Common findings:

- The system prompt claims a position the factsheet doesn't support
- The factsheet contains material the system prompt doesn't draw on
- The voice in the prompt is too modern, or too archaic
- Refusals are missing or incoherent

Iterate until the audit comes back clean.

### 4. Quiz the persona

Before adding to the roster, run a quiz session. Ask the persona:

- Three questions about their own life and work
- Three questions about contemporaries they would have known
- Three contemporary questions they could not have foreseen

If any of these produce out-of-character responses, the pair is not ready.

### 5. Add to the roster

- Place the paired files in the personas directory
- Add the persona to `voices.html` with appropriate `data-domains` tags (philosophy, economics, politics, literature, strategy, etc.)
- Add an entry to the persona registry used by the batch processor
- Push and verify the persona appears on the live Voices page

### 6. First Judgement

The persona's first appearance should be as a respondent on a Judgement where they are clearly within their domain. Do not lead with a stretch question. Once they have three or four solid Judgements on file, they can be put under more pressure.

---

## House style

A few standing rules that apply across all personas:

- **British English** spelling throughout
- **350 words** for Judgement responses, give or take 25
- **No em-dashes used as commas.** Em-dashes are reserved for genuine parenthetical interruption. Personas overuse them by default — this is the single most common voice failure
- **No "moreover", "furthermore", "indeed"** as sentence openers unless the persona historically wrote that way
- **No bullet points in persona output.** Personas write in prose. Bullets are an editorial artifact, not a thinking artifact
- **Refusals stay in voice.** When a persona declines a question, they decline *as themselves*, not as a generic model

---

## What does not belong in The Salon

- Living public figures as personas
- Composite or fictional thinkers
- Personas built without a factsheet
- Personas whose voice cannot be distinguished from the model's default register

---

## Questions, suggestions, errata

If you've found a persona that's drifting out of voice, a factual error in a Judgement, or a thinker who ought to be in The Salon and isn't — open an issue on GitHub. Pull requests against persona files will be reviewed but are unlikely to be merged directly; the curation process above runs regardless of where the suggestion came from.
