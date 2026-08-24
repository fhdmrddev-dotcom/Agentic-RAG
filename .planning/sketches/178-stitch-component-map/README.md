---
sketch: 178
name: stitch-component-map
kind: stitch-exploration
acceptance_bar: false
question: "If the Stitch mindset is adopted as the house style, what does EVERY component of the workflow product look like in it — not the pages, the atoms, including the canvas itself?"
winner: null
decision_requested: false
tags: [stitch, mcp, component-map, canvas, adopted-mindset, text-is-noise, calm, direction-only, seed-155, g2-sketch-gate]
seeds: [SEED-182, SEED-183, SEED-184, SEED-155]
bugs: [BUG-260815-08]
built: 2026-08-19
tool: "Google Stitch MCP · Gemini 3.1 Pro"
stitch_project: "projects/10710316306258284608"
stitch_design_system: "assets/12493500246735489470"
supersedes_language_of: 177
---

# Sketch 178: The component map

Follow-on to sketch 177, on the operator's direction: *"use Stitch to map everything — not only the
main pages but all the components in the workflow, including the canvas itself. We just want to adopt
this mindset."*

Nine component sheets. Not pages — **atoms**, each drawn with all of its states at once.

## ⚠ Still direction. Still not an acceptance bar.

These render **zero** shipped components. The next step is a normal sketch that *renders* the real
ones in this language. See `STITCH-BRIEF.md` §6.5 for the ratified four-step loop.

## What changed between 177 and 178 — and it is measurable

The adopted mindset went into the design system's `designMd`, so it is now inherited by every future
generation rather than re-typed per prompt. Three rules were added:

1. **Text is noise — cut it. But the purpose must survive the cut.**
2. **Draw the component, not the app.**
3. **Never name the mechanism to the user.**

| | sketch 177 (pages) | **sketch 178 (components)** |
|---|---|---|
| app-shell duplications | 3 pages carried a second nav/top-bar | **0 of 9** |
| stock/generated portrait photography | 3 pages | **0 of 9** |
| mechanism printed to the user | node subtitles read *"Author name" / "Derived name"* | **0** — the name ladder is invisible, as it should be |
| fabricated progress | 0 | **1** (see sheet 3 below) |

The first three were fixed by writing them down once, in the right place. That is the argument for
keeping the mindset in `designMd` rather than in prompts.

## How to view

```bash
cd .planning/sketches && python -m http.server 8899 --bind 127.0.0.1
# → http://127.0.0.1:8899/178-stitch-component-map/index.html
```

## The honest read

### Sheet 2 · The phase node — **the best artifact of either pass**

Six types with distinct line glyphs. Six interaction states (rest, hover, selected, dragging,
configuration problem, locked). Six **run** states as an overlay on the same face — waiting, running
with live elapsed `00:15` and no percentage, succeeded carrying its kept fact (*"Found 12 items"*),
failed, **skipped by a branch**, and paused awaiting human review. A hexagonal **router** node for the
branch with two labelled outputs. Three zoom sizes down to a still-readable micro.

⚠ **It fixed 177's worst mistake by itself.** In the page pass, node subtitles literally read
*"Author name" / "Derived name" / "Type description"* — printing the fallback rule to the user. Here
the three name cases are captioned only by their **text length**, and the faces are identical in kind.
The mechanism is invisible. That is the correct reading and it came directly from the rule added to
`designMd`.

### Sheet 3 · The spine — **the unification works; two flaws worth naming**

Three columns at three real widths: authoring, the 380px panel, and a chat-sized receipt that renders
as a compact **execution trace** with mono durations and a total runtime. The branch shows
`TRAVERSED` and `SKIPPED` as words, not just colour. The failure variant carries a genuine error
(*"Timeout waiting for human reviewer, exceeded 48h limit"*), and the human gateway sits inside the
spine with Approve / Reject.

⚠ **It printed `Processing liability caps section (4/12)`.** That is a determinate count and it is
exactly the class of fabricated precision this project forbids. It is arguably knowable *within* a
phase — but nothing in our system emits it today, so drawing it is a promise we cannot keep.

⚠ **The authoring column over-writes.** Every phase carries a two-line description under its name.
That is the "text is noise" rule drifting on the widest column — the one place there is room to be
lazy.

### Sheet 1 · The canvas plane and its connections — **RE-RUN 2026-08-19, and it is now the sheet that answers the note**

The first attempt was the weakest of the batch: a flat undecided ground, three connection states drawn
so faintly they were invisible, and `Id: n_4f92` printed on every step. All three were named as failures
and re-run against the new business-language direction. The second attempt fixes all three.

**Connections now carry their payload, and this is the idea worth keeping from the whole exploration.**
Between the steps the sheet prints what actually moves: **`312 contracts` → `48 extracted` →
`12 flagged`** on the escalation path and **`36 routine`** on the other. A connection stops being "A then
B" and becomes a statement about the work. That single move is what makes a workflow legible to a
business reader — you can audit the arithmetic of your own process at a glance.

**Five connection states, drawn large and each distinguishable without colour:** at rest (thin solid,
carrying its label) · hovered (brighter) · selected (indigo, weighted) · **flowing** (dashed, alive,
indeterminate) · **not taken** (faint dotted, still legible — a skipped path is information, not an
absence). Every one is captioned with its word.

**It committed to a ground:** a 24px dot grid, quiet enough that a step at rest is still the loudest
thing on the plane.

**The steps are named as business work:** *Find this quarter's vendor contracts* · *Pull out renewal
dates and liability caps* · *Weigh each contract against our risk policy* · *Over £2m?* → *Escalate to
the risk committee* / *File as routine*. **No ids anywhere** — measured, `0` occurrences.

⚠ Two flaws remain: the plane **overflows on the right**, clipping the two branch outcomes at this
viewport; and the fork node carries a small `Fork Logic` label, which is machine vocabulary that slipped
past the rule.

### Sheet 10 · The builder chrome — **generated at last, and it designs out the reported defect**

Requested twice and apparently failed twice; in fact **all three attempts eventually completed, more
than twenty minutes late.** Take the newest — it is the one generated under the business-language rules.

**The header bar carries the workflow's NAME as the headline, never a slug** — which is the defect on
the board. Five cases drawn: clean saved draft · unsaved changes · published and locked · **empty name**
(degrades to a dimmed *Untitled Workflow*, never blank) · **a name too long** (truncates without pushing
the controls off the row).

**The save region has four arms**, and the one that matters is unmistakable: *Save failed — Check
connection*, in danger colour, never confusable with saved. **Publish is gated in four states** with its
refusal stated (*"Needs 2 grounded phases"*). **The step picker is a colleague's verbs**, not node types:
*Find documents · Pull out specific details · Weigh against policy · Decide which way to go · Write a
document · Send or file result.*

⚠ **The problems tray drifts back into engineer language** — *"Phase 5: Output schema invalid / JSON
schema definition contains syntax errors"*, *"Retrieve step requires at least one connected datastore"*.
Those are error codes wearing a sentence. The rule was explicit and this is where it broke, which is
useful to know: **the business-language rule holds on labels and titles, and fails on error text.**

### Sheet 11 · The journey — ⚠ **FAILED, RE-RUNNING**

The first attempt laid the six moments out as one horizontal row, overflowed the page, and **rendered
only three of six** — then never drew its three lower sections at all. It also added an app header,
against the rule. Re-running with a vertical stack. What survives from the attempt is one good idea: the
connector between moments is labelled **"CARRIES — the request & knowledge sources"**, which is the same
payload-bearing-connection idea the canvas sheet landed properly.

### Sheets 4–9 — solid, and closest to buildable

- **The phase form panel** holds a real density ceiling: collapsed-to-essentials and fully-open, with
  the grounding control drawn as something that visibly refuses, and a model picker that can say *"I
  could not read the registry"* rather than showing an empty dropdown.
- **The draft arrival cluster** reproduces our shipped `decisionsVocabulary` contract: three arms per
  row, an explicit *not reported*, and only the grounding row claiming a publish requirement.
- **The library sheet** draws the hard cases nobody draws — an **empty name**, a **failed** run on the
  card, and three identical titles adjacent — plus the toolbar on one shared baseline.
- **The gauntlet** is one compact strip, indeterminate while running, with the judge's wall carrying
  **no override control anywhere** because there is no override.
- **The run panel** keeps discipline at 380px, and an unknown file time says so instead of blanking.
- **The doors** design out the duplicated describe box via a persistent header strip, and show the box
  **refusing** an input too short to act on rather than just disabling a button.

## ⚠ One artifact defect, found and fixed

**Sheet 6 rendered on a white page** and was nearly unreadable — dark-on-dark text on white. Cause: its
`<style>` block used Tailwind's `theme('colors.background')` and `@apply`, but was not tagged
`type="text/tailwindcss"`, so the Play CDN never processed it and the **entire ruleset was dropped** —
taking the body background *and* the `.aether-card` border/surface styling with it. One-attribute fix,
applied; the sheet now renders as generated and is one of the stronger ones. Its thumbnail was
re-captured from the corrected render.

⚠ **Worth carrying forward: a Stitch sheet can be silently broken and still look like a finished
artifact in its own thumbnail.** Open every generated file before reading anything into it.

## ⚠ What is owed

- **Sheet 11, the journey**, is re-running after a truncated first attempt.
- **A canvas layout fix**: the plane overflows right and clips both branch outcomes.
- **Error text in business language** — the problems tray is the one place the rule measurably failed.

## ⚠ The panel is NOT a workflow component — a correction to this sketch's own framing

The operator flagged on 2026-08-19 that the live panel *"is in the chat area, not in the workflow
space"*. **Checked against the code, and it is stronger than stated:**

- `WorkspacePanel` is mounted by **`components/layout/ChatLayout.tsx:673`** and has **no mount in any
  workflow page**.
- `PausedRunCue` is rendered by **`components/chat/MessageItem.tsx`**.
- `panel/panelOpenSignal.ts` exists *only* so chat-side affordances can open the panel — a deliberate
  "chat-side seam" from Phase 087-02.
- `components/metadata/DocumentDetailPanel.tsx` **reuses the WorkspacePanel sheet shape**, so the shell
  already spans a **third** surface.

⚠ **So sheet 8's title — "the live run panel" — is wrong in a way that matters.** It is a cross-surface
shell, and **a change to it lands in chat first**. Any sketch redesigning it must be judged against the
chat surface, and any UAT that only exercises the workflow surface will miss it.

⚠ **And the coverage of this whole mapping is a known gap:** it is workflow-only. The next passes should
cover **the chat surface** (`ChatArea`, `MessageItem`, `MessageList`, `MessageInput`, `RunCard`,
`ToolCallPanel`, `ActiveRunsTray`, `StopControl`), then documents / settings / admin — so one language
runs through the whole application instead of stopping at the workflow door. See `STITCH-BRIEF.md` §6.6.

## Tool notes added this pass

- **A concurrency cap of about two.** Sending three `generate_screen_from_text` calls at once reliably
  returns `Request contains an invalid argument` for one of them. Send **two at a time**.
- **`list_screens` is intermittently broken**, not permanently — it returned `invalid argument` twice
  and worked three times on the same project id. Fall back to `get_project` → `screenInstances`.
- **A timeout still usually means success.** Every sheet here reported a timeout; nine of ten had
  completed. Poll, never retry.
- **`generate_variants` remains unused.** Every sheet is a single take.
- ⚠ **A "failed" generation can complete more than TWENTY MINUTES later.** Both builder-chrome runs that
  were recorded as failed had in fact produced screens by the next poll. **Never conclude a generation
  failed from one poll** — re-list before re-requesting, or you pay for the same sheet three times.
