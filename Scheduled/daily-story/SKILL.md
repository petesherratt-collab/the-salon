---
name: daily-story
description: Random Writer writes a story
---

Generate a new Iron Meridian story submission and editorial verdict, then save both files to the connected Iron Meridian folder.

## STEP 0 — DISCOVER THE WORKSPACE

The Iron Meridian folder is mounted into this run. The correct location on the Windows host is:
`C:\Users\Admin\OneDrive\Documents\Claude\Iron Meridian`

To find its absolute Linux path at runtime:

1. Run `ls /*/mnt/` via the bash tool.
2. Locate the directory named `Iron Meridian` inside one of those mounts.
3. Use that absolute path for all file reads and writes. If multiple candidates exist, prefer the one that maps to `C:\Users\Admin\OneDrive\Documents\Claude\Iron Meridian` — i.e. NOT a folder nested inside a `Projects` subfolder. The correct mount will contain existing persona subfolders (Cal Brennan, Frank Gideon, Mickey Doyle, etc.).
4. If no `Iron Meridian` folder is found, abort with a clear error in the report — do not invent a path.

## STEP 1 — DISCOVER AND SELECT A WRITER

1. List all subfolders in the Iron Meridian root directory.
2. Filter to subfolders that contain both a `[Name]-system-prompt.md` and a `[Name]-backstory.md` file. Exclude `Generated` and any folder that does not match this pattern.
3. Pick one at random (genuine random — not LLM default pick).
4. Load the contents of both files into memory as `WRITER_SYSTEM_PROMPT` and `WRITER_BACKSTORY`.
5. The writer's name is the subfolder name.

## STEP 2 — ROLL THE GENRE

Pick one genre at random (weighted equally) from Walt's active shortlist:

- **Horror** — specific, unusual setting with a working logic the protagonist must understand to survive. Not a house. Not a town.
- **Western** — a crime at its center. Not a gunfight. A crime the protagonist must solve, commit, or cover.
- **Science Fiction** — the speculative element is also the source of the central problem. The thing that makes the world strange is the thing that is killing the protagonist.
- **Adventure** — a specialist protagonist whose expertise is the story's grammar. A diver, a surveyor, a telegraph operator, a locksmith. Someone whose work is unusual and whose knowledge of it decides the plot.

Record the selected genre as `SELECTED_GENRE`.

## STEP 3 — GENERATE THE STORY

Call the API with the following configuration:

**System prompt:** Use `WRITER_SYSTEM_PROMPT` verbatim, then append the following block:

---
*Additional context — this writer's life and formation:*

[WRITER_BACKSTORY — insert full contents here]

---
*Submission requirements for this story:*

You are submitting to Iron Meridian magazine, October 1947. Walt Greer is the managing editor.

IRON MERIDIAN EDITORIAL STANDARDS:
- We publish stories in which a person faces a problem they cannot avoid, the problem gets worse, and the resolution costs something.
- The problem must arrive immediately. Protagonist in trouble by end of page one.
- The threat must be physical and immediate — never abstract.
- Four-act structure required:
  - First quarter: Protagonist introduced and in trouble immediately. Mystery or threat established. Ends on a physical conflict and a surprise.
  - Second quarter: Trouble escalates. All significant characters appear. Ends on a reversal that changes what the protagonist thought they were dealing with.
  - Third quarter: Protagonist at their worst position. Everything against them. Ends at the lowest point.
  - Fourth quarter: Protagonist resolves by their own action — skill, force, knowledge, decision. Mysteries resolve. Final surprise. Clean stop.
- Do not apologise for the monster. Let threats be threats.
- Every sentence must carry the reader to the next.
- Dialogue must do two things at once: advance the situation AND reveal character under pressure.
- Description earns its place only when it establishes something the story needs.
- Length: 3,500–5,000 words. Do not deliver under 3,500 words.
- Period-accurate language and technology. Set in 1947 or earlier.
- End clean. Stop when the problem is resolved. No reflection. No explanation.

**User prompt:**

Write a complete [SELECTED_GENRE] story for Iron Meridian magazine.

Genre requirement: [Insert the full genre description from STEP 2 for the selected genre.]

Begin your response with:
- Line 1: The story title (no markup, no prefix)
- Line 2: Cover letter (one sentence only): genre / word count / central problem / what the protagonist stands to lose
- Line 3: Blank
- Line 4 onwards: The story itself

## STEP 4 — WALT'S VERDICT

Call the API a second time with the following configuration:

**System prompt:**

You are Walt Greer, Managing Editor of Iron Meridian magazine, Chicago, 1947. You have been editing pulp fiction for twenty-two years. You served in France 1917–18 and the experience calibrated everything that came after. You are direct, demanding, and not unkind — you respect craft and have no patience for sloppiness. You buy problems, not stories. You keep the magazine alive by making sure every page earns its place.

A writer has submitted a manuscript. Give your editorial verdict. Structure your response with these five sections, each on its own line as a plain heading:

FIRST READ
One or two sentences. Gut reaction only. No diplomacy.

STRUCTURE
Map the manuscript against the four-act diagnostic. Where does it hold? Where does it fail? Be specific — reference the actual text.

PROSE
Does it move? Call out one sentence that works and explain why. Call out one sentence that doesn't and say what you'd do with it.

THREAT
Is the threat immediate and physical? Or does it apologise for itself? Reference the specific threat in this manuscript.

DECISION
State one of: ACCEPT / REVISE AND RESUBMIT / REJECT
Then give the writer one concrete thing: either what to fix (if revising) or the single reason for rejection (if rejecting) or what earned it (if accepting).

Write in first person as Walt. Be specific. Reference the manuscript directly. No generalities. Do not use bold or markdown formatting in your response — plain prose only.

**User prompt:**

Writer: [WRITER NAME]
Genre: [SELECTED_GENRE]

Manuscript submitted:

[Full text of the story from STEP 3]

## STEP 5 — SAVE THE FILES

1. Construct the output folder path:
   `[Iron Meridian path]/Generated/[YYYY-MM-DD]-[Writer Name]/`
   Use today's date in YYYY-MM-DD format.

2. If a folder with that name already exists (writer already generated today), append `-2`, `-3` etc.

3. Create the folder.

4. Save the story as `story.md` with this structure:

```
# [Story Title]

**Writer:** [Writer Name]  
**Genre:** [Selected Genre]  
**Date generated:** [D Month YYYY]  

---

[Cover letter line]

---

[Full story text]
```

5. Save Walt's verdict as `verdict.md` with this structure:

```
# Walt's Verdict — [Story Title]

**Writer:** [Writer Name]  
**Genre:** [Selected Genre]  
**Date:** [D Month YYYY]  

---

[Full verdict text]
```

6. Both files saved to the same folder from step 1.

## STEP 6 — UPDATE THE WRITER'S STORY INDEX

1. Open the writer's own subfolder: `[Iron Meridian path]/[Writer Name]/`
2. Open their `[Writer Name]-backstory.md` — do not modify it.
3. Open `INDEX.md` in the Iron Meridian root.
4. Find the writer's card in `INDEX.md` (the `## [Writer Name]` heading).
5. Find the `**Stories:**` line in that card.
6. Append the new story as a link: `[Story Title](Generated/[YYYY-MM-DD]-[Writer Name]/story.md)`
   - If the Stories line currently reads `—`, replace the `—` with the link.
   - If stories already exist, append with ` · ` as separator.
7. Update the `*Last refreshed:*` line with today's date. Do not change the writer count.
8. Save `INDEX.md`.

## STEP 7 — REPORT TO USER

In the chat report:

- Writer selected and their genre/era/camp (one line)
- Genre drawn (one line)
- Story title
- Cover letter (the one-sentence summary)
- Walt's decision (ACCEPT / REVISE AND RESUBMIT / REJECT) and his one concrete note
- Both file paths as `computer://` links the user can click to open
- Confirmation that INDEX.md was updated