---
name: Aether Intelligence — Deep Midnight (Journey)
colors:
  surface: '#060a0f'
  surface-dim: '#060a0f'
  surface-bright: '#343945'
  surface-container-lowest: '#080b11'
  surface-container-low: '#0d1117'
  surface-container: '#0f141b'
  surface-container-high: '#151b24'
  surface-container-highest: '#212631'
  on-surface: '#f4f6fe'
  on-surface-variant: '#9aa3b5'
  inverse-surface: '#dee2f1'
  inverse-on-surface: '#2b303c'
  outline: '#6b7383'
  outline-variant: '#212631'
  surface-tint: '#a3a5ff'
  primary: '#a3a5ff'
  on-primary: '#0800a3'
  primary-container: '#635bff'
  on-primary-container: '#e1e0ff'
  inverse-primary: '#5355a9'
  secondary: '#895af6'
  on-secondary: '#23005c'
  secondary-container: '#571ac2'
  on-secondary-container: '#c3abff'
  tertiary: '#21c45d'
  on-tertiary: '#003915'
  tertiary-container: '#26c760'
  on-tertiary-container: '#004c1e'
  error: '#dc2626'
  on-error: '#ffffff'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  background: '#060a0f'
  on-background: '#f4f6fe'
  surface-variant: '#151b24'
typography:
  headline-lg:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  machine-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
---

# Aether Intelligence — Deep Midnight · JOURNEY PASS

This is an internal **agentic workflow platform**: an AI agent that reads a knowledge base, runs
code, and executes multi-phase workflows. These surfaces are where a knowledge worker authors a
workflow, watches one run, and finds one again among hundreds. NOT a marketing site, NOT a consumer
app, NOT a generic SaaS dashboard.

## ⭐ THE ADOPTED MINDSET — READ THIS FIRST, IT OUTRANKS EVERYTHING BELOW

The operator reviewed a first pass and adopted its language as the house style. Their words:

> *"It is reducing the text — that is noise — but also keeping the focus of the purpose of the
> workflows for users. We want to adopt this mindset."*

So two rules, held together, and neither one alone:

**1. TEXT IS NOISE. CUT IT.** Every word must earn its place. Prefer a state word over a sentence, a
number over a phrase, one line over two. Delete helper text that explains what the control already
shows. Delete captions under labels. If a label and its value say the same thing, keep the value. A
screen that reads as an instruction manual has failed.

**2. BUT THE PURPOSE MUST SURVIVE THE CUT.** The one thing a user must never lose is **what this
workflow is FOR and what it is doing for them right now**. That line stays, in plain human language,
at full weight.

⚠ **NEVER NAME THE MECHANISM TO THE USER.** Do not print rule names, internal state names, resolver
names, table columns, or the reason a value was computed. Show the value; hide how it was derived.

### ⛔ The mechanism strings that are currently shipping and MUST NOT appear in any screen

These are real strings from the running product. They are the reason this pass exists. **Every one of
them is banned**, and each has a required human replacement:

| ⛔ NEVER DRAW | ✅ DRAW INSTEAD |
|---|---|
| `phase_index 0` | nothing — position is carried by the spine's own order |
| `llm_agent` · `llm_single` · `llm_emit` · `llm_human_input` | `AI agent step` · `One-shot writer` · `Produces the file` · `Waits for a person` |
| `READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · on-fail branch (skip_to_phase) · no depends_on · no parallel lanes` | `View only — this is the order it will run in.` |
| `skip_to_phase` · `depends_on` · `on_failure` | `If this fails → go to <step name>` |
| `analyze_document` `query_documents_by_view` `workspace_write` `write_todos` `attach_skill_file` (and every other snake_case tool id) | `Read a document` · `Search a saved view` · `Write a file` · `Track its to-dos` · `Attach a skill file` — **every tool gets a human name; a list where 3 of 27 are named reads worse than none** |
| `kickoff_prompt` | the input's authored label, e.g. `What should this run work on?` |
| `NET-NEW` · `net-new` | nothing, or `New workflow` |

## ⚠ DRAW THE FULL SCREEN — THIS IS A JOURNEY PASS, NOT A COMPONENT PASS

**The previous pass drew components in isolation and forbade app chrome. That rule is REVERSED here
and the reversal is the whole point.** Every screen in this pass is a real, complete application
screen that a person navigates to. It MUST carry the app shell, and the shell MUST be the one below —
never an invented one.

### The shell, exactly as it ships

- A **left icon rail, 56px wide**, collapsed to icons only, on `#080B11`. It is the ONLY navigation.
  Top to bottom: expand, new chat, **Chat**, **Workflows**, Documents, Classification, Library Health,
  Governance, Skills, Settings, Organization admin, Control Room — then the account mark pinned at the
  bottom. The active item carries a soft indigo fill; the rest are dim outlines.
- **NO top navigation bar. NO breadcrumb bar. NO global search field in the shell.** The app has none.
- The main region fills the remaining width on `#060A0F`.
- On run and chat surfaces there is a **right-hand workspace panel, 380px**, separated by a 1px
  `#212631` border. It is a push/split panel, never an overlay.
- Desktop only, 1440×900. Never draw a phone.

## Colour tokens — use these EXACT values, invent no new hex

These are read from the shipped stylesheet, not chosen:

- page background `#060A0F` · icon rail `#080B11` · card `#0D1117` · raised `#0F141B` · muted fill `#151B24`
- border `#212631` (soft: 50% opacity)
- text `#F4F6FE` · secondary `#9AA3B5` · dim `#6B7383`
- **primary** soft indigo `#A3A5FF` (strong `#635BFF`), tint 15%
- **violet** `#895AF6` · **success** `#21C45D` · **warning** `#F5A524` · **danger** `#DC2626`, each with a 15% tint

Manrope for headlines, Inter for body/labels, JetBrains Mono **only** for durations, counts and
elapsed times — never for a name a person chose, and never for a machine identifier, because machine
identifiers must not be on screen at all.

## Iconography — ONE vocabulary, and no invented category glyphs

- Line icons only, 1.5px stroke, 16–20px, in `#9AA3B5` at rest.
- Step-type glyphs come from ONE fixed set — search, extract, reason, branch, human, emit — and a
  step's glyph is the same mark everywhere it appears (canvas, spine, receipt).
- **NO emoji. NO 3D. NO filled illustration. NO avatar photography. NO decorative marks.**
- A glyph never appears without its word beside it, except where the word is one line below it.
- Governance is drawn as a **corner mark** in the top-right of a node, never as a third badge.

## CALM

A **calm instrument with selective signal-density at the live moment** — quiet at rest; dense and
alive only where something is happening right now.

- Large areas of flat dark background. Negative space is the primary material.
- Borders and elevation over colour. A card is a 1px `#212631` border on `#0D1117`.
- **NO gradients, NO glassmorphism, NO neon, NO glow.**
- Motion is a 200ms ease-out fade or a 4px rise. Nothing bounces.

## Progressive disclosure

Every repeated element shows **the one line that decides whether you care** and defers the rest behind
one obvious control. A card showing eight facts has decided nothing for the reader. When something is
deferred, the control that reveals it says what it reveals — `Explain each field`, not `More`.

## Colour carries meaning, and is NEVER the only carrier

Colour is spent on **state**, never decoration. Every coloured state ALSO says its word in text. A
green dot alone is a bug; a green dot beside `Ready to run` is correct. At most one accent per card;
at most three state colours visible at once.

## Three measurements that have already killed design ideas

1. **The name cannot be the differentiator.** 285 workflow rows, 39 distinct names — **93% carry a
   REPEATED name.** Any design whose scanning strategy is "read the title" fails on real data.
2. **Project cannot be the differentiator either.** 11 of 18 rows are **Unbound**.
3. **There is no progress signal.** Generation is one non-streaming request. **Any determinate
   progress bar or percentage is a fabricated number and is FORBIDDEN.** Elapsed time only.

## Honesty rules

- Never draw a number the system cannot know. **No `Estimated time: ~45s`. No `(4/12)`. No
  `Processing… 60%`. No `Target nodes: production-cluster`.**
- Never draw a control that would do nothing; a disabled control visibly says why.
- An unknown value renders as an explicit "unknown" — never blank, never zero, never a green tick.
  **Silence is not success.**
- A state that can be unknown has THREE arms, never two. A boolean cannot express it.
- Destructive weight is spent on the ACTION, never as a wash over the notice.

### What the system genuinely knows today (draw these freely)

Per step: its authored name, its type, its chosen model, its knowledge-base scope, its tool
whitelist, its governance tier, its ordering, and its on-failure branch target. Per run: each step's
status, and the run's own start. Per workflow: version, project, last run outcome and when, whether
anyone has ever run it, and how many rows share its name.

### What it does NOT know (mark these as PROPOSED-NEEDS-DATA if you draw them)

Per-step timings and total runtime · per-step row/document counts · per-connection payload counts ·
who holds a governance lock, by name. **If a screen needs one of these, draw it and label the screen
`NEEDS DATA` — do not silently invent it and do not silently omit it.**

## Density

Desktop 1440×900. Comfortable but not airy: 12–16px inside cards, 8px between related rows, 24–32px
between sections. Body 14–15px. Labels 11–12px uppercase, letter-spaced, dim.
