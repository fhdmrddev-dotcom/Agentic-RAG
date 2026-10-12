---
phase: 273-agent-authored-artifacts
plan: 06
subsystem: live-stack verification (board, G-4 lived scenarios, registers)
tags: [artifacts, uat, sc10-board, cross-provider, g4, reload, structured-holdback, ledger-close, seeds]
requires:
  - phase: 273-01..05
    provides: "show_artifact tool, migration 202 message_artifacts, persistence + reload attach, STRUCTURED holdback, chart/table/metric components, rail arms"
provides:
  - "scripts/run-273-board.py — effective-roster derivation (seed overlaid by model_capabilities_overrides), fixture seeding, per-row board runs, persisted-data verdicts, leak probe"
  - "frontend/uat/273-board-render.test.ts — parseArtifactRecord over every board evidence JSON (verdict 2b), non-vacuous, skipped when env unset"
  - "273-VALIDATION.md filled: SC#10 board, structured-path observations, G4-1..G4-4, 4-axis, operator sign-off"
  - "273-UAT-LOG.md: location assertion, merged-tree gates verbatim, roster derivation, board method, OWED list"
  - "evidence/ board (18 run JSONs + summary), structured (3), g4 (7 screenshots)"
affects: [phase-273-verification, SEED-193, SEED-335, docs/HOT-FILE-LEDGER.md]
tech-stack:
  added: []
  patterns:
    - "Board roster derived from the EFFECTIVE registry and proven read (overlay count == direct SQL count, DB-only anthropic row selected)"
    - "Verdicts from persisted rows keyed by run_id, never from transcripts"
key-files:
  created:
    - scripts/run-273-board.py
    - frontend/uat/273-board-render.test.ts
    - .planning/phases/273-agent-authored-artifacts/273-UAT-LOG.md
    - .planning/phases/273-agent-authored-artifacts/evidence/
  modified:
    - .planning/phases/273-agent-authored-artifacts/273-VALIDATION.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/seeds/SEED-193-agent-authored-interactive-artifacts-closed-component-vocabulary.md
key-decisions:
  - "No derived roster row routes STRUCTURED (OpenRouter is NATIVE under openrouter_tool_strategy=quality); operator ruled the live SC#2 holdback check runs on lmstudio nemotron-nano-9b — it never completed a turn, so the check is OWED (unit-test proof only)"
  - "CLAUDE.md abridged hot-file rows left stale BY DECISION — file was 476 chars under the 120,000 warn band"
  - "deepseek V3 FAIL recorded as finding F-1 (refusal detail should name where `chart` belongs), not fixed in this plan"
requirements-completed: [ART-01, ART-02, ART-03, ART-04, ART-05]
duration: ~26 h wall-clock across two checkpoints (2026-10-03 22:43 → 2026-10-04)
completed: 2026-10-04
---

# Phase 273 Plan 06: Live-stack proof — SC#10 board, G-4 lived scenarios, register close — Summary

**Agent-authored artifacts proven on the running stack: 8/8 provider rows emit and reload a chart
identically, 7/8 re-encode by reference with no retrieval, G4-1..G4-4 pass in a real browser with
tooltip values equal to the fixture, operator approved — the live STRUCTURED-path holdback check is
the one thing still OWED.**

## Performance

- **Tasks:** 4/4 (Task 2 and Task 4 were operator checkpoints; Task 3's live drives were run by the
  orchestrator and recorded here)
- **Commits:** e643b6c36, 7f5651543, d159f1ef8, 24bae1fc4, f7d2ca38b

## Board (SC#10 / D-21) — 8 required rows + 1 extra

Roster derived from the effective registry (`--roster`): openai `gpt-5.6-luna`, anthropic
`claude-opus-5-5` (DB-only overlay row — proves the overlay is read), google `gemini-3.8-flash`,
deepseek `deepseek-v4-pro`, zhipu `glm-5.3-flash`, minimax `MiniMax-M3`, moonshot `kimi-k3`,
openrouter `z-ai/glm-5.3-flash`; extra self-hosted lmstudio `qwen-agentworld-35b-a3b`. Seed: 16 rows
read back by `query_tables`, all equal to the fixture.

| Verdict | Required rows (8) |
|---|---|
| V1 emitted | **8/8 PASS** |
| V2 rendered (a board / b `uat/273-board-render.test.ts` 19 passed / c Chrome 2 blocks · 0 notices) | **8/8 PASS** |
| V3 by-reference, zero retrieval | **7/8 PASS** — deepseek FAIL (F-1) |
| Leak probe (NATIVE path) | `none` on all 8 (+ extra) |
| Empty / fallback answer | 0 runs |

Extra lmstudio row: V1/V2/V3 FAIL (chose `execute_code`; no artifact) — not a required row.

**F-1 (deepseek V3):** turn B's `show_artifact(from_artifact=a_v99qzkgrki, …)` was refused —
*"`transform.chart` is not a show_artifact field. Use only the documented fields."* — and the retry
re-sent 4 rows inline, so chart 2's `parent_id` is NULL. Zero retrieval / code calls held.

## Structured-leak result (SC#2 / OV-273-04) — OWED

The roster predicts no STRUCTURED row. On the operator's ruling, `lmstudio:nvidia_nvidia-nemotron-nano-9b-v2`
was driven per request: every run hit the 600 s timeout NOT TERMINAL, the model never called
`show_artifact`, no `delta` carried call text. **No live STRUCTURED `show_artifact` turn was
observed** — the holdback is proven by `test_273_structured_holdback.py` only. Observations (i) search
turn and (ii) non-tool ```json reply are OWED too.

## G-4 lived scenarios — all PASS, operator approved 2026-10-04

- **G4-1 (D-17):** line chart from `query_tables` (multi-tool turn); Q3 hover East 1,459 · North 1,342
  · West 1,203 · South 1,076 = fixture; legend click → `aria-pressed=false`, series hidden; "make it a
  bar chart" → new block, "Redrawn from chart 1 · same 4 rows · …", tools `[show_artifact]`; "only Q3"
  → "From chart 2 · filtered to quarter = Q3 · 1 of 4 rows", two show_artifact steps (first refused,
  D-12 self-correction), zero retrieval/code.
- **G4-2 (D-18):** mid-session reload and after backend restart (PID 62784) — 3/3 blocks
  `innerText`-identical, 0 notices, no raw JSON.
- **G4-3 (D-19):** fetch-rewrite of `/snapshot` (`gauge_widget`, `pie`) → both catalogue notices
  verbatim, sibling chart and answer intact, no JSON. Missing-column arm and migration-202 CHECK not
  driven live.
- **G4-4 (D-20):** PNG request → `execute_code` output card `q3_revenue_by_region.png` (69.7 KB), no
  artifact; chart request → artifact.
- **4-axis:** cross-provider (board), multi-tool (G4-1), parallel-thread (G4-1 while the board
  streamed), long-message (6,567-byte prompt A) — all PASS.

## Merged-tree gates (Task 1), verbatim

```
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).   (failed SET identical to 273-BASELINES.md)
218 passed, 1 warning in 3.61s                                                  (tests/unit/test_273_*.py)
HEAD  _TOOL_REGISTRY=30 get_tools(web/sandbox off)=26 get_tools(all on)=29
BASE  _TOOL_REGISTRY=29 get_tools(web/sandbox off)=25 get_tools(all on)=28
SYSTEM_PROMPT … byte-identical=True
count gate OK — 389/389 pinned files present, no per-file decrease, 0 failing.  (total 9620 · pinned 8865)
tsc exit=2 · 70 errors now · 70 at base — new ∅, gone ∅
ledger gate OK — every watched file has a row.
RESULT: PASS — the one-box deploy artifacts are in sync.
seeds register gate OK — 343/343 parsed, 0 duplicate ids, 343/343 carry all 5 required keys.
```

## Deviations from Plan

1. **[Plan assumption refuted] OpenRouter is NATIVE, not STRUCTURED.** The plan's live SC#2 check
   and WARNING 9 observations were written for an OpenRouter STRUCTURED row; the effective roster has
   none. Escalated, operator ruled (lmstudio nemotron); that model could not complete a turn → OWED.
2. **Per-row reload screenshots:** saved for the openai row only; the other seven were measured by
   DOM count (2 blocks / 0 notices / no JSON), not screenshotted.
3. **G4-3 method:** both arms were driven by in-page fetch rewrite rather than crafted DB rows, so the
   missing-column notice and the migration-202 CHECK refusal were not exercised live; no DB rows were
   written, so no deletion was needed.
4. **G4-1 follow-up "only Q3"** produced two rail steps (refused + corrected) rather than exactly one;
   caption counts read "4 rows" because the agent's query returned the table pivoted per quarter.

No source code was changed after Task 1; the ledger close (e643b6c36) therefore stands.

## Observations

- **O-1** hidden-tab only: chart end-of-line labels absent while `visibilityState=hidden`; cosmetic.
- **O-2** a thread's first open after page load sometimes blank up to 7 s (not artifact-specific).
- **SEED-335 watch:** no "Unmarked claims" footer observed on artifact-led answers (seed not edited).

## OWED

- **Live STRUCTURED-path holdback check (SC#2 / OV-273-04)** + observations (i) and (ii).
- **F-1** deepseek by-reference refusal detail.
- G4-3 missing-column arm and migration-202 CHECK refusal, live.
- Production: **migration 202 BEFORE the backend deploy**, then `get_advisors(security)`.
- **OV-273-02** tool_dispatcher registry/handler split; **OV-273-03** prompt-assembly seam (SEED-192).
- CLAUDE.md split (warn band; abridged rows stale by decision).

## Requirements

ART-01..05 marked complete on the evidence above and the operator's approval, with two caveats
carried forward rather than hidden: ART-03's by-reference path failed on deepseek (F-1, rows still
re-encoded without retrieval), and ART-02's STRUCTURED-path "nothing raw" property is unit-proven only.

## Threat Flags

None — no new network endpoint, auth path or schema surface; the plan wrote no DB rows beyond board
fixture/thread data in the local dev org, and made no production write.

## Self-Check: PASSED

- FOUND: scripts/run-273-board.py, frontend/uat/273-board-render.test.ts, 273-UAT-LOG.md,
  273-VALIDATION.md, evidence/board (19 files), evidence/structured (3), evidence/g4 (7)
- FOUND commits: e643b6c36, 7f5651543, d159f1ef8, 24bae1fc4, f7d2ca38b
