---
sketch: 060
name: engine-health-card
question: "How does the Settings Engine-health board answer 'how do I know the eval engine works for each provider without hand-running all 8' — per-provider ✓/✗, staleness always shown, Run sweep, links to the smoke runs — plus the shared judge-model knob?"
winner: "A"
tags: [phase-137.1, eval-05a, smoke-sweep, engine-health, settings, staleness, judge-model-knob, d-11, d-12]
---

# Sketch 060: Engine Health Card (Settings)

## Design Question

EVAL-05a's home: the operator's verbatim trust bar is *"how do I know it reflects
reality for each model without hand-running all 8."* The answer is a per-provider,
honest, timestamped board in Settings (D-03):

- The sweep IS a matrix run over a built-in smoke case (D-01/D-02): 1 case × 2 arms +
  judge = 3 units per provider, ≈24 LLM calls, no user data, the smoke skill hidden
  from the Skills list.
- **✓ = ENGINE healthy** — both arms + judge completed. A model may honestly FAIL the
  smoke case and still be a healthy row (engine health ≠ model quality — the card
  subtitle says so explicitly).
- **✗ = a provider-level failure shown VERBATIM** (MiniMax `401 Unauthorized…` in the
  exemplar) — never an engine-shaped error.
- **Staleness always shown** (D-04): "last sweep 3 days ago" in amber when old, green
  when fresh; on-demand only, no scheduler, no nudge.
- Each provider links to its smoke run detail (the run rows are watchable in the
  Studio like any eval run — D-01).

Also composed here: the **judge-model knob** (D-11/D-12) — identical across all three
variants (a settled pattern, not a variant axis): the 024-A picker with a registry-only
model list and an always-on 🔒 footer showing the EFFECTIVE judge (`claude-opus-4-8`
when unset) and its double duty (eval verdicts + publish-gauntlet judge).

## How to View

open .planning/sketches/060-engine-health-card/index.html

**▶ Run sweep** animates the board through a live sweep (per-provider unit progress,
staleness flips to "just now" on completion). Change the judge select to see the
effective-judge footer + Save appear.

## Variants

- **A: Tile board** — 8 compact logo tiles in a 4×2 grid (logo + ✓/✗ + model), failing
  tile tinted red with the verbatim error in a note below the grid. Most glanceable;
  the 8-provider posture reads in one saccade.
- **B: Row list** — one row per provider with the result text inline ("✓ engine healthy
  — both arms + judge completed" / the verbatim 401). Most detailed at rest; tallest.
- **C: Posture strip** — ONE summary line ("7/8 engines healthy — MiniMax needs
  attention", 038/040 posture-hero echo) that expands to a compact per-provider list.
  Calmest; detail is one tap away.

## What to Look For

- **The 3-second read:** A tells you the posture fastest; C tells you ONLY the posture
  until expanded; B makes you scan 8 rows. Which fits a Settings page you visit
  occasionally?
- **Engine ≠ model quality:** the subtitle carries the semantics ("a model may honestly
  fail the case and still be a healthy row"). Is it enough, or does the board need the
  distinction per-row?
- **The verbatim provider error:** A demotes it below the grid, B shows it inline, C
  shows it in the expansion. Where does it read best without shouting?
- **Staleness:** amber "3 days ago" → green "just now" after a sweep. Honest without a
  nudge (D-04 — no config-change re-run prompt, deliberately deferred).
- **Judge knob:** does the 🔒 effective-judge footer make the unset-default state
  legible (the SEED-100 picker↔registry drift lesson)?

## Build Handover (reuse vs net-new)

- **Reuse:** the sweep rides the 058 matrix machinery 1:1 (D-01 — one machinery for
  EVAL-05a+b); `harness_judge_model` already exists end-to-end (`config.py:1006` +
  `user_settings.py:157` + `validator_kinds.py:61-70`) — the knob is UI-only, NO new
  setting, NO migration (D-11); the picker pattern = `ProviderPicker.tsx`/
  `ModelPillRow.tsx` (024-A); provider marks = the 048 `providerLogo` map (sketch marks
  are placeholders).
- **Net-new:** the Engine-health card component + its "latest smoke sweep" query (smoke
  matrix-group lookup — bounded discretion); the built-in hidden smoke skill + case
  fixture (D-02, planner designs content); the "view smoke run" deep-link into the
  Studio run row; registry-validation on the judge picker options (D-12 — offer ONLY
  MODEL_CAPABILITIES-known models).
- **Honesty locks:** ✗ carries a REAL provider error verbatim, never engine-shaped;
  engine-health ✓ is never presented as model pass/fail; staleness is always visible;
  the effective default renders when unset (never a blank implying "configured").
