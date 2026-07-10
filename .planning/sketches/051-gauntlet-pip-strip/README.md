---
sketch: 051
name: gauntlet-pip-strip
question: "How does the publish gauntlet read at a glance — an energized pip-strip + plain-worded pass/block, with the raw 5-field verdict on demand — without breaking the verbatim-honesty / judge-hard-wall / 4-HTTP-outcome contracts?"
winner: "A"
tags: [phase-127, wux-03, publish-gauntlet, pip-strip, worded-verdict, raw-on-demand, energized, 3d-icons, provider-engine, honesty]
---

# Sketch 051 — Gauntlet: Pip-Strip + Worded Verdict (energized)

Re-skin of the shipped publish gauntlet (`PublishGauntlet.tsx`, winner 020-B). Today it
renders the 8 checks as **verbose boxes that wrap into a grid** and leads the resolved
state with a **raw 5-field `PublishVerdict` mono grid** ("debugger output to a business
user"). WUX-03 SC#1: render as a **pip-strip + worded verdict with the raw detail on
demand**. This sketch also answers the operator's creative push — make it **visually
engaging**: imported 3D icons, an Asian-tech energy language, and the test reading as a
*living, powerful* sequence.

## Design Question

How does the publish moment read at a glance — a compact, **alive** energy-spine of the 8
stages + a **plain-language** pass/block result, with the raw verbatim verdict one click
away — while keeping every honesty contract intact?

## How to View

Open `C:/Vibe Apps/Agentic RAG/.planning/sketches/051-gauntlet-pip-strip/index.html`
in a browser (**internet on** for the imported 3D icons; emoji fallbacks render offline).
Use the **Lifecycle** stepper (Resting → Golden run → Published → Judge block → Early
block) to walk every state, the **A/B/C** tabs to compare compositions, **▣ Today
(before)** to see the current cluttered version, and the bottom-right **⚡ Calm⇄Energized**
toggle to feel the calm anchor vs. the energized direction.

## Variants

- **A — Recipe-literal ★** — the energy-spine on top (passed stages glow green, the golden
  run pulses with energy flowing into it), then a one-line **worded verdict**; on a block
  the judge's "why" criteria stay first-class; the raw 5-field grid hides behind **"Show
  raw verdict."** The literal WUX-03 prescription.
- **B — Verdict-first** — a big plain-language result card is the hero; the spine demotes to
  a thin pip-rail beneath; criteria + raw fold into one "Details" expander.
- **C — Progressive-strip** — the spine *is* the centerpiece across all states; a contextual
  bubble drops from the live/blocked node with the worded reason + criteria + raw-on-demand.
- **▣ Today (before)** — the current shipped surface (8 wrapping boxes + a default raw grid)
  for contrast.

## What's new visually (operator direction)

- **Imported 3D icons** — Iconify `fluent-emoji` set per stage (🛡️✅🎯🔎✋🚀🔒⚖️), 3D-rendered
  and colorful, replacing the flat glyphs.
- **Asian-tech energy language** — deep-space grid, gradient/glow accents, a comet of energy
  that travels the spine into the live stage, an animated golden-run hero.
- **Which AI engine** — hand-built provider marks show the workflow running on **DeepSeek**
  and being graded by an independent **Claude** (the cross-provider story, Asian natives
  featured). Swap-ready for Kimi / GLM / MiniMax / Gemini.

## What to Look For

- **(a)** Does the 8-stage test read in ~3 seconds — and does the **golden-run wait** feel
  like the powerful hero moment (a real run on your KB), not a spinner?
- **(b)** Is the **worded verdict** enough on its own, with the raw grid happily hidden? Does
  hiding it ever feel like lost honesty? (The `▦ rendered verbatim` cap stays inside.)
- **(c)** On a **judge block**, do the per-criterion "why" rows carry the explanation while
  the 5-field grid stays on-demand?
- **(d)** Energized vs. calm: is the motion *exciting* or *too much*? (Toggle bottom-right.)
  Which variant composition wins?

## Honesty contracts preserved (must not soften in build)

- The 5-field `PublishVerdict` renders **verbatim, never re-derived** (now behind "Show raw
  verdict," with the provenance cap kept).
- Judge = **hard wall**, no override (the absent "publish anyway" rendered struck-through).
- **4 distinct HTTP outcomes** (200-with-block / 400 / 404 / 409) — not collapsed to ok/err.
- Run link gates on `golden_run_id != null`; a pre-run block shows the explicit no-run note.
- The judge per-criterion `{criterion, score, evidence}` rows stay first-class on a block;
  only the raw 5-field grid is demoted to on-demand.

## ⚠ Icon sourcing (build note — operator-flagged 2026-06-27)

Two different icon sources, do not conflate them:

- **Provider / model logos** (the "engine" chips): the BUILD MUST use the **installed
  `@lobehub/icons`** package (Phase 128 / sketch 048 — it has all 8: OpenAI, Claude, Gemini,
  DeepSeek, Kimi/Moonshot, GLM/Zhipu, MiniMax, OpenRouter). In THIS mockup, the chips use the
  **real** Iconify `logos:` marks where they exist (DeepSeek, Claude, Gemini) and **hand-built
  placeholders** for the ones Iconify lacks (Kimi/GLM/MiniMax) — those placeholders are NOT
  accurate and must be replaced by the `@lobehub/icons` marks at build.
- **Phase / stage icons** (the 3D `fluent-emoji` set): the Goal stage used the non-existent
  `fluent-emoji:direct-hit` (rendered empty) — **fixed to `fluent-emoji:bullseye`**. If the 3D
  vocabulary is adopted for the build, verify each slug exists in the chosen set (or bundle the
  SVGs) so no icon renders empty.

## Build Handover (reuse vs net-new)

| Real component | What this sketch implies |
|---|---|
| `workflows/PublishGauntlet.tsx` `GauntletSpine` | **Replace** the wrapping-box ladder with the compact pip/energy-spine (icon per stage + state tone). Server `blocked_stage` still drives the highlight (visual only). |
| `VerdictFields` (5-field grid) | **Demote** behind a `<details>` "Show raw verdict" — keep verbatim render + the `▦ rendered verbatim` cap. Lead with a worded headline instead. |
| `renderFailure` / `CriterionRow` | **Reuse as-is** — the judge criteria rows are the worded "why" and stay first-class. |
| `PublishingNotice` | **Restyle** into the golden-run hero (already wait-as-hero in spirit). Optional: an engine chip (`message`/run model) — real field. |
| Provider engine marks / 3D icons | **Net-new presentation.** Icons via `@lobehub/icons` (already added Phase 128) or an icon set; the energy/glow motion is CSS. No new wire. |
