---
sketch: 052
name: living-step-flow
question: "In the live phase spine, how does an idle step stay quiet (no type-education, no placeholder noise, no animation) while the active step carries the signal (glow + energy-flow + running-only activity + which AI engine) and done steps fold to a calm essence — under the shipped Phase-124 soul header, within the shared harness+workflow card + a11y contract?"
winner: "A"
tags: [phase-127, wux-03, quiet-idle, phase-card, run-surface, living-flow, energized, 3d-icons, provider-engine, g5-hot-file, a11y, honesty]
---

# Sketch 052 — Living Step-Flow: Quiet Idle, Alive Active (energized)

Re-skin of the shipped live phase spine (`PhaseCard.tsx` / `PhaseTimeline.tsx`, winner
008-D / 022-A target). Today every row repeats its type label + an explainer line
("chatty at rest") and reads slug-first. WUX-03 SC#2: **idle steps stay quiet (no noisy
animation/placeholder); only the active step animates.** This sketch reconciles that with
the operator's creative push — make the run feel **alive and powerful** — by concentrating
ALL the motion on the *live* step: energy flows down into it, it glows and "builds," and it
names the AI engine on it. Quiet at rest, powerful where it's happening — both asks at once.

## Where it sits (consistency with Phase 124 — important)

The step list lives in the workspace panel **UNDER the workflow "soul" header shipped in
Phase 124** (`WorkspacePanel.tsx` mounts `<WorkflowSoul scale="run">` above
`<PhaseTimeline>`). The sketch renders that soul header (dashed violet, tagged
"soul · shipped Phase 124") so you can see 052 complements it, not contradicts it. The soul
header carries purpose + tier + the glyph-dot mini-spine + needs + output; 052 is the live
detail spine below it.

## How to View

Open `C:/Vibe Apps/Agentic RAG/.planning/sketches/052-living-step-flow/index.html`
(**internet on** for the 3D icons; emoji fallbacks render offline). Use the **Run state**
stepper (Start / Running / Needs you / Done / Failed), the **A/B/C** tabs, **▣ Today
(before)** for the current chatty cards, and **⚡ Calm⇄Energized** (bottom-right).

The storyboard is the published **Vendor-risk portfolio review** (load → research → score →
draft → confirm → emit) — the SAME storyboard as sketch 022, for continuity.

## Variants

- **A — Density-by-status ★** — the 022-A target, energized. Idle = one dim quiet line (title
  + faint "Locked", no type-lecture, no motion). Active = full bloom (amber wash + left bar +
  glowing node + energy comet flowing in + a running-only activity line + the **AI-engine
  chip**). Done = folded one-line essence (✓ + title, "expand ▸"). Failed = the honest
  failure block. Quiet at rest, comprehensive on the live step.
- **B — Uniform-quiet** — every step is a single calm line including the active one; the active
  step adds only the activity line + one pulse dot + the connector comet. No bloom wash.
  Quietest; the calmer anchor.
- **C — Spine-led tail** — idle/not-yet-run steps collapse to bare 3D glyph-dots (the 046
  essence language); only done + active render as full cards. The future of the run reads as
  a quiet dotted tail that "builds out" into cards as the run advances.
- **▣ Today (before)** — the current shipped cards (type label + explainer on every row,
  slug-first, flat glyphs) for contrast.

## What to Look For

- **(a) SC#2 — at "Start (all idle)":** do the not-yet-run steps read **quiet and still** (no
  spinner, no placeholder noise, no type-lecture)?
- **(b)** When "Running," is the **one** live step unmistakably the live thing — energy flowing
  in, glowing, telling you what it's doing + which engine? Does your eye land there instantly?
- **(c)** Do **done** steps settle calmly (folded essence) without competing?
- **(d) Energized vs calm** (toggle): exciting or too much? Which variant wins?

## Honesty + a11y contracts preserved (must not soften in build)

- Status = **glyph + word + colour** together, never colour-alone (WCAG 1.4.1).
- LINE 3 **running-phase only** — idle/done steps show no activity line, no fabricated counts.
- **Gate chip only when a real `PhaseSpec.validator` exists** (here: the emit phase's `cited ·
  structure`), never a fabricated badge.
- **Failed-as-failed** — the closed-taxonomy reason + where-line (never an empty "done").
- The `phase.name` human title is flagged **NET-NEW** (a Phase-103 authoring output, same as
  sketch 022). `slug` stays demoted, mono.
- The APG accordion / `role=alert` failure / indeterminate `progressbar` a11y from the shipped
  card carry forward (the re-skin is visual, not a behavior rewrite).

## ⚠ G-5 + the one cross-sketch consistency decision (icon vocabulary)

`PhaseCard.tsx` / `PhaseTimeline.tsx` are **G-5 hot files shared with the live harness run**
(touched 094 / 101.1) — the density change must keep harness-run legibility and re-run the
replay tests.

The icon question is the real consistency call: today the shipped soul (`PHASE_GLYPHS` in
`soulData.ts`) uses **flat glyphs** ⚙✎🤖⛓☺◆ across the workflows-page card, the run soul
header, and the publish soul. 051 + 052 introduce **3D `fluent-emoji` icons**. To stay
consistent (not have 3D cards under a flat-glyph soul header), the 3D set should become the
**shared vocabulary** — one `PHASE_GLYPHS` map swap propagates to ALL soul surfaces + the new
cards at once. That is an *additive* upgrade of the 124 surfaces (same data, richer icons),
not a contradiction — and it's the decision to confirm at plan time.

## ⚠ Icon sourcing (build note — operator-flagged 2026-06-27)

Two different icon sources, do not conflate them:

- **Provider / model logos** (the "engine" chip on the active step): the BUILD MUST use the
  **installed `@lobehub/icons`** package (Phase 128 / sketch 048 — all 8 providers). In THIS
  mockup the chips use the **real** Iconify `logos:` marks where they exist (DeepSeek, Claude,
  Gemini) and **hand-built placeholders** for Kimi/GLM/MiniMax (Iconify lacks them) — the
  placeholders are NOT accurate and must be the `@lobehub/icons` marks at build.
- **Phase-type icons** (the 3D `fluent-emoji` set): all slugs used here exist (gear / memo /
  robot / busts-in-silhouette / raised-hand / package — verified). If the 3D vocabulary is
  adopted as the shared `PHASE_GLYPHS` upgrade, verify every slug resolves (or bundle SVGs) so
  none render empty (the 051 Goal stage hit exactly this — `direct-hit` didn't exist).

## Build Handover (reuse vs net-new)

| Real component | What this sketch implies |
|---|---|
| `panel/PhaseCard.tsx` (**G-5**) | Re-skin density: idle = quiet single line (drop the always-on `oneLiner` + demote the type label); active = bloom + running-only activity line + engine chip; done = folded essence. Keep the APG accordion, status atoms, failure taxonomy, gate-chip-when-validator. |
| `panel/PhaseTimeline.tsx` (**G-5**) | Unchanged structurally (still `<ol>` of `PhaseCard`); the energy-connector spine is presentational. Re-run harness replay tests. |
| `soulData.ts` `PHASE_GLYPHS` | **Shared icon-vocabulary upgrade** (flat → 3D). One map; propagates to soul card/run/pub + 052 cards. Confirm at plan time. |
| `WorkspacePanel.tsx` soul header | **Unchanged** — 052 sits below it. The sketch shows it for context only. |
| provider engine chip | Net-new presentation on the active step (`@lobehub/icons` from Phase 128 / hand-built marks). The running phase's model is real wire (`phase_started` / sub-agent). |
| `phase.name` (human title) | NET-NEW wire (same as sketch 022) — flagged in-surface. |
