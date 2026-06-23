---
sketch: 043
name: case-editor-and-live-run
question: "How do the hybrid auto-seeded benchmark cases read and get edited (should-fire / should-NOT), how does the 60/40 train/held-out split show, and how does the multi-minute background run render live progress?"
winner: "A"
tags: [phase-123, skill-triggering, trigger-tuner, case-editor, benchmark, held-out-split, background-run, sse, trig-01]
---

# Sketch 043: Case Editor & Live Run

## Design Question

TRIG-01's benchmark is **hybrid auto-seed + author edits** (D-04): the Tuner generates a starter set
(should-fire = paraphrases of the description; should-NOT = sibling catalog skills + generic off-topic
prompts), the author edits/approves/adds, then runs **60/40 train/held-out · 3 repeats · ≤5 iterations**.
The run itself is **cases × 4 models × 3 repeats** of live LLM calls — multi-minute, so it's a **background
job** with live progress (D-06, reuse the run-buffer + SSE). Two questions: how do the cases read/edit, and
how does the run show progress honestly?

## How to View

`open .planning/sketches/043-case-editor-and-live-run/index.html`
(Use **"▶ cycle run state"** in the nav / toolbar to toggle the live-progress card.)

## Variants

- **A: Two-column should-fire / should-NOT lists ★** — the cleanest read of the two expectation classes side by
  side; the should-NOT column is visually tied to the "false-fire rail." Per-row `held` / `seeded` / `sibling`
  provenance tags. Generous room for verbose prompts.
- **B: Unified tagged table** — one table, a segmented `fire` / `no` toggle per row, origin + held-out as columns.
  Denser; the completed-run state resolves into a "Open scoreboard →" handoff.
- **C: Chip strip** — cases as compact chips (echoes the 029/037 condition-builder language already in the app).
  Fastest to scan many short prompts; long prompts truncate.

All three share the **run bar** (cases × models × repeats counter + the 60/40 split bar) and the **live progress
card** (per-provider progress, elapsed timer, "runs in the background — reconciles on return", Cancel).

## What to Look For

- **Is the should-NOT set legible as the safety rail?** (A ties it to a column; the sibling-skill auto-seed is
  what generates realistic false-fire bait.)
- **Is the 60/40 split honest and visible** without lecturing? The held-out 40% is what the winner is picked by.
- **Does the live run feel trustworthy at minute 2** — per-provider progress, a never-vanishing elapsed timer,
  and an explicit "you can leave; it reconciles on return" (the run-buffer/SSE promise)?
- **Auto-seed provenance:** `seeded` / `sibling` / `you` / `held` tags — the author should see what the Tuner
  wrote vs what they own.

## Targets are config-driven, not a fixed four (added 2026-06-23)

The run bar's "4 models" is illustrative. The benchmark **targets = the org's enabled models** (default: one
representative per enabled provider), chosen in the run config. A **single-provider org runs 1 model** (the live
card shows one provider lane, not four); a **self-hosted org** runs against their own endpoint; OpenRouter is a
**gateway target distinct from native** DeepSeek / GLM / Kimi / MiniMax. So the live-progress lanes, the
"cases × N models × 3 repeats" count, and the splitbar all scale to N — N=1 is the clean baseline, not a stub.
See sketch 042's provider-set adaptivity band. The 60/40 split / 3 repeats / ≤5 iter mechanics are unchanged.

## Build Notes (reuse vs net-new)

- **Reuse:** the Phase-061+ run-buffer (`run:{run_id}` stream + `runs_by_thread` + `runs:active`) + SSE for the
  background job and live progress; `forced_emit` for per-case trigger classification; the sibling-skill
  auto-seed pulls from the owner-scoped catalog query (`agent_loop.py:1090`, preserve leak-safe scope).
- **Net-new:** the case-editor CRUD + provenance tags, the 60/40 split + 3-repeat run orchestration, the
  per-provider live-progress render.
- **Honesty (load-bearing):** the run never shows a fake percent for a provider that hasn't started (queued ≠
  0%-running); the elapsed timer derives from a stable start-ts (the 095 never-vanishes lesson).
