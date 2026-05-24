The Salon
A parliament of the dead, convened nightly to judge the present.
Live site → the-salon-ten.vercel.app

What this is
The Salon is a publication where twenty-odd historical thinkers — Machiavelli, Hobbes, Wollstonecraft, Keynes, Adam Smith, Voltaire, Marx, Hayek, Sun Tzu, Austen and others — render verdicts on contemporary questions. Each persona has been built from a research factsheet and a paired system prompt, then wired to an LLM via OpenRouter. The result reads like a leader column written by a committee that has been dead for two hundred years and is none too pleased about the state of things.
There are two formats:

The Judgement — a single question put to a category-appropriate panel. Each persona delivers a 350-word verdict in four movements: Framing · Reframe · Verdict · Maxim. One persona is named as the questioner and credited above the responses.
The Long Form — a single persona at length on a subject of their own choosing. Roughly 1,500 words, in their own analytical voice.

A new Judgement is generated and published every night. Long Form pieces drop every few days. The archive grows on its own.

How it works
Topics.csv  ──►  run-judgements.js   ──►  HTML pages  ──►  GitHub  ──►  Vercel
                 run-longform.js                              (auto-deploy)
A nightly batch processor reads a queue, picks the questioner and panel, calls the model for each persona in parallel, formats the responses into a single page, and updates the archive index. The files are static HTML — no database, no backend, no build step. Push to main and Vercel serves it.
Stack
LayerChoiceModelClaude (Anthropic) via OpenRouterOrchestrationNode.js batch scriptsHostingVercel (static)StorageFlat HTML in this repoFontsCormorant Garamond (display), Inter (body)

The personas
Each voice in The Salon is built from two paired documents:

A factsheet (.rtf) — biography, formative experiences, vocabulary, intellectual positions, contemporaries, blind spots
A system prompt (.md) — the operating instructions: voice, format, what they will and won't engage with

The Salon's working principle: more data, same analytical instrument. Each persona has full contemporary knowledge — they know what blockchain is, what a hedge fund is, what social media is — but their analytical framework remains fixed to their formation period. Hobbes can read a tweet. He still reads it as a Hobbesian.
See CONTRIBUTING.md for the persona development workflow.

Repository structure
public/
├── salon.html              The Salon — converse with a single persona
├── salon-index.html        The Archive — browse past Judgements
├── voices.html             The Voices — full persona roster with filters
├── judgements/             Generated Judgement pages, one per question
│   └── salon-YYYY-MM-DD-HHMM.html
└── longform/               Generated Long Form essays
    └── index.html          Long Form archive
Generation scripts (run-judgements.js, run-longform.cjs) live outside the repo on the machine that produces the nightly output. They write into public/ and then a git push carries the result to Vercel.

Reading recommendations
If you've never been here before, start with:

The Archive — pick any Judgement and read it through. The format reveals itself.
The Voices — find someone you know well, see whether the voice rings true. Then find someone you don't, and let them surprise you.
The Long Form — the personas at length. More room to think.


Why
Most AI writing is shaped by the assumption that the model should sound like itself — competent, balanced, faintly corporate. The Salon takes the opposite bet: that the interesting thing an LLM can do is sustain a sharply specific voice with a fixed analytical framework, applied to material the original thinker never saw. Whether that succeeds is a matter for the reader.

Licence
Code: MIT (see LICENSE).
Generated text (the Judgements and Long Form pieces) is published as-is and not licensed for redistribution. The factsheets and system prompts that produced them remain the author's work.

Editor and architect: Peter Sherratt.
