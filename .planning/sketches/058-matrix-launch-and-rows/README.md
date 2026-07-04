---
sketch: 058
name: matrix-launch-and-rows
question: "How does ONE click fan a skill's eval across N providers as N parallel run rows — launcher + gate-feeder designation, the matrix group in RunHistory, and the history-derived mean±stddev/delta aggregation + deterministic analyst notes?"
winner: "A"
tags: [phase-137.1, eval-05, matrix-runs, run-history, gate-feeder, aggregation, analyst-notes, 055-b-extension]
---

# Sketch 058: Matrix Launch & Rows

## Design Question

EVAL-05b: one click runs a skill's eval across all configured providers as N parallel
run rows. Three sub-questions live in this sketch:

1. **Launcher** — how does the matrix launch sit next to the unchanged single-run
   RunBar, and how is the D-05 gate-feeder designated (default: your active provider)?
   The bounded discretion item "all-configured default vs checkboxes" is deliberately
   varied across the three variants — the launcher model is part of what you're picking.
2. **The matrix group in RunHistory** — how do N rows read as ONE matrix without
   breaking the locked 055-B row grammar (provider logo + model + ver + honest rollup,
   expand-in-place)? Exactly one row carries "▣ feeds gate"; the group states the D-05
   semantics once ("other arms are analysis-only").
3. **Aggregation + analyst notes (D-07/D-08)** — mean±stddev per config comes from
   accumulated run HISTORY (stddev only at ≥2 runs — google honestly shows "first run —
   no spread yet"); Δ = with − without mean judge score; the three analyst notes are
   deterministic rules with fixed phrasing (non-discriminating case / flaky variance /
   time-score tradeoff), never an LLM paragraph.

All variants share one wire-shaped data model: 8 configs (native-7 + OpenRouter), 3
cases × 2 arms + judge = 7 units per config, one config (OpenRouter) carrying an honest
`not_measured` arm with the VERBATIM provider error — excluded, never failed.

## How to View

open .planning/sketches/058-matrix-launch-and-rows/index.html

Use **▶ Launch live matrix** (top right) to watch the group run live in any variant
(G-4 scenario: no mid-run verdicts, per-config determinate units, aggregation lands
only at finalize; RunBar disables with the one-claim-per-skill note). **⏩ Finish now**
jumps to the resting state.

## Variants

- **A: Grouped matrix card** — the matrix is ONE card in the history; expand → 8
  sub-rows inside it; aggregation + analyst notes live in the card footer. Launcher =
  one-click "Run matrix (8 configured)" + inline gate-feeder select.
- **B: Flat rows on a spine** — the 8 runs stay top-level 055-B rows, joined by a thin
  primary spine + a mono group cap; a dashed "Σ Across runs" summary row expands to the
  aggregation. Launcher = "Run matrix ▾" checkbox popover (include ☑ + gate ◉ + cost
  line "8 configs · 3 cases · ≈56 LLM calls").
- **C: Scoreboard grid** — the matrix renders as a compact table (config | this run |
  mean±σ | Δ lift | ⏱); a row click expands the per-case body beneath it; analyst
  notes under the table. Launcher = provider logo-chip toggles (amber ring = feeds gate).

## What to Look For

- **Which grammar keeps 055-B recognizable?** A nests rows inside a card (2 levels of
  border); B keeps rows flat but the group is quieter; C is densest but the rows stop
  looking like run rows.
- **Find the gate-feeder in 3 seconds.** The ▣ chip + the one-line gate semantics — is
  it instantly clear the other 7 arms can never flip the publish gate?
- **Does aggregation read as HISTORY-derived?** "×1 run per click — spread accumulates
  from history" + google's "first run — no spread yet". It must not read as if one
  click bought 3 repeats.
- **Do analyst notes read as deterministic observations** (tagged rules) rather than
  LLM prose?
- **Live launch:** per-config unit bars advance at different speeds (kimi slowest);
  verdicts appear only as each arm finalizes; the earlier single runs stay untouched
  below.

## Build Handover (reuse vs net-new)

- **Reuse:** `RunHistory` row anatomy + expand-in-place (055-B, shipped); `providerLogo`
  048 map (sketch marks are placeholders, NOT shipped art); the Redis `SET NX` claim
  (D-06 — acquired once per matrix group, 409 contract unchanged); eval SSE + heartbeat
  re-attach per arm (N rows = N existing per-run subscriptions).
- **Net-new:** matrix launch affordance on RunBar + gate-feeder designation (D-05);
  matrix group schema (group id + gate-feeder flag — the phase's migration); group
  rendering in RunHistory; the aggregation strip (D-07 math is per-config across
  history); the three deterministic analyst rules (D-08, backend-computed or
  frontend-derived — planner's call); per-arm duration column (feeds sketch 059).
- **Honesty locks:** no mid-run verdicts; `not_measured` excluded-never-failed with the
  verbatim provider error; stddev renders only at n≥2; exactly ONE gate-feeder chip per
  group; the launcher shows the call cost before launch (B variant).
