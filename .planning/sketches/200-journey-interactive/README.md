---
sketch: 200
name: journey-interactive
kind: interactive-prototype
acceptance_bar: true
question: "What does the whole workflow product look like in the adopted design language — as a journey a person walks, not a set of component sheets — and what does each change COST to build?"
built: 2026-08-19
tool: "Google Stitch MCP · Gemini 3.1 Pro"
stitch_project: "projects/7797685529205337277 (Aether Journey v2)"
supersedes_language_of: 178
seeds: [SEED-155, SEED-168, SEED-184, SEED-185, SEED-144, SEED-145, SEED-146]
---

# Sketch 200: the workflow journey, now vs proposed

**Open `index.html` by double-clicking it.** No server needed. `←` `→` to move, `space` to flip
between the shipped product and the proposal.

## ⚠ This one IS an acceptance bar, and 178 was not

Sketch 178 rendered **zero** shipped components and said so: *"still direction, not an acceptance
bar."* This one is the follow-on it asked for. It pairs every proposed screen with a **real capture
of the running product at 1440×900** — evidence on the left, proposal on the right — and attaches a
per-screen ledger of what each change COSTS.

## Why it exists

Phase 199 re-presented ten of 178's eleven sheets across ten plans and **verified 5/5 on its own
success criteria** — while the operator's verdict was *"nothing changed from a UI perspective."*
Both were true. Measured across the phase's verdict tables:

| Verdict | Count |
|---|---|
| BUILT | **17** — and most were subtractions or test fences |
| REFUSED / DECLINED / CANNOT-EXPRESS | **31** |
| ALREADY-SHIPPED | **57** |

The cause was the charter, in `ROADMAP.md`'s own words: *"PRESENTATION ONLY — no data, no endpoint,
no migration, no new capability."* Every one of 178's richest sheets needed more on screen and more
on the wire, so the phase refused them **correctly**, then passed criteria that required it not to
look like the sketches. **The work was honest; the charter was wrong.**

## What is here

**Nine journey steps** — library · the two doors · the draft arrives · the authoring spine · the
canvas · the step panel · the publish gauntlet · the run dialog · the run surface.

**Four specimen sheets** — the step node (every kind, every state) · the run panel's mid-run parts ·
connections · fork + delete.

⚠ **The journey was found to START IN THE MIDDLE.** Sheets `c9` (the two doors) and `c5` (the draft
arrival) were uncovered entirely by the first pass — and they are not extras, they are the **first
two steps of authoring**. Nobody arrives at a five-step spine; they choose a door, describe what they
want, and receive a draft. That finding reordered the whole walk.

## The ledger, and the number that decides the next phase

> **21 changes are frontend-only · 7 need the wire to carry something new · 13 already ship · 1 still to capture.**

**The 7 amber rows are the argument.** Per-step timings, per-step counts, per-connection payload
labels and lock-holder attribution all need data the wire does not carry — measured:
`WorkflowRunPhase` carries exactly `slug`, `phase_index`, `status`, `phase_type`, and **no
timestamps at all**. No presentation-only phase can close them.

## Four operator corrections, and what each one caught

1. **"The first version was better."** The screens were structurally right but **thinner** than 178 —
   which had a selected step showing its own detail, a router with named paths, a human gateway with
   controls, grounding locks, armed actions. Folded back in without re-importing 178's machine
   vocabulary (`VECTOR`/`ROUTER`/`TRAVERSED` → `THIS WAY`/`NOT THIS WAY`).
2. **"Icons and animation are cleaner in 178."** Measured: **identical icon font** — the difference
   was consistency (six screens mixed `FILL 1` with `FILL 0`) and motion (**14** animations in 178 vs
   4 here, with the canvas at **zero**). Now zero filled icons, and the canvas carries `march` +
   `borderPulse`. ⚠ 178's `pulseGlow` was deliberately NOT imported — it breaks the calm rule.
3. **"Do not build around one specific case."** Already recorded as **`SEED-168`**: *"planning from
   one instance builds a risk-register feature."* Three of five decision-list rows were
   contract-specific **slots**, not fixture text. Now domain-neutral and demonstrated on HR
   onboarding; the spine shows **two** endings instead of only fill-a-template — the single position
   on `SEED-168`'s output axis that every domain hits as a wall.
4. **"The connection inside the canvas and spine."** The connections sheet had answered the wrong
   question (settings, not nodes). Settled a real decision: **the brand mark wins the node's leading
   slot**, the type is carried by words, and the node frame stays identical to its neighbours.

## Measured tool limits, recorded so they are not re-diagnosed

- ⚠ **`generate_screen_from_text` fails 100% through the MCP for the assistant** — clean project,
  `GEMINI_3_1_PRO` set explicitly, four-word prompt and long prompt alike. The operator's manual runs
  with the identical text succeed. **The whole pack was therefore driven by the operator pasting and
  the assistant pulling, auditing and wiring.**
- ⚠ **Stitch answers an EDIT by creating a NEW screen** — observed **seven** times. The original stays
  untouched, which is why a landed change can look like nothing happened. **Always look for the newest
  title, never the one you edited.**
- ⚠ **Stitch substitutes a grey placeholder for third-party logos on a standalone list** (nine hits on
  the connections sheet) but **emits real brand artwork when the mark sits in a node's icon slot**
  (four marks on the spine). Not worth re-running the list sheet: `@lobehub/icons` is installed,
  `providerLogo.tsx` is the single-source seam, and `icon-convention.md` §1 already mandates real
  single-sourced marks at build time.

## Known nits, carried rather than re-run

- The spine's fork lanes still name `Confirm the QBR before rendering` / `Fill the QBR template` —
  the pre-rename step names. A two-string fix in real code; not worth another generation round.
- The draft-arrival card's footer controls read `How long it looks back` ×2 where
  `Open in the builder` / `See the steps` belong — a relabel instruction applied too broadly.
- The run surface has **no "now" capture** — it needs a live run to photograph honestly, and was left
  explicitly empty rather than drawn from imagination.

## Files

| File | What |
|---|---|
| `index.html` | the prototype — double-click it |
| `screens/*.html` | the 13 generated screens, each with a navigation bridge injected |
| `PROMPTS.md` | every prompt used, with the generality rule and the motion/icon rules at the top |
| `COVERAGE.md` | sketch 178's eleven sheets vs this journey, element by element |
| `FORWARD-CHECK.md` | the sweep of 45 seeds + roadmap for decisions this design must not contradict |
| `../200-journey-now/` | the six real captures of the shipped product, and `DESIGN-journey.md` |
| `tools/fetch-screen.cjs` | pulls one screen and wires its controls to the player |
