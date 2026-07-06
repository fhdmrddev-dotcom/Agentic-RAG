---
phase: 138-run-end-honesty-stretch
verified: 2026-07-06T08:30:00Z
status: gaps_found
score: 4/5 must-have themes verified (RUN-01b live-surfacing gap)
overrides_applied: 0
requirements: [RUN-01]
---

# Phase 138: Run-End Honesty (STRETCH) — Verification Report

**Phase Goal:** A run's `final_output_files` lists only files genuinely new to that run (no
baseline/leftover leak), and open todos are honestly marked `(run ended — not completed)` on a
genuinely-clean run end — never silently auto-completed — with the Deep Mode red line intact and
no provider fork. Closes SEED-094 (BUG-260626-02 baseline leak + BUG-260626-03 stuck todos).

**Verified:** 2026-07-06 — code-level must_haves cross-checked against the merged tree; behaviour
confirmed live via Chrome MCP + psycopg2 (see `138-03-SUMMARY.md` for the full Scenario A–F verdict).

**Status:** gaps_found — one live-surfacing gap in RUN-01b (backend is fully correct).

## Must-haves — result

| # | Must-have | Result |
|---|---|---|
| 1 | RUN-01a: `final_output_files` filtered to content-hashes genuinely new to the run; baseline/leftover excluded; all-leftover run emits nothing | ✅ Verified (unit tests `test_120`/`test_075_4` green; Scenario A live PASS; `sandbox_service.py` untouched — D-07/D-08) |
| 2 | RUN-01b: open todos get the exact `(run ended — not completed)` marker on a genuinely-clean run end; status never flipped; never stacks | ✅ Verified in the DB (psycopg2, two runs) + unit tests `test_085`; marker persists and renders correctly once the panel reconciles |
| 3 | RUN-01b fires at BOTH clean finalizers; never on cancelled/failed/timed_out/cap_paused (two-clause gate) | ✅ Verified in merged code + unit tests (LOCK-1 / LOCK-2 / D-05) |
| 4 | D-14 red line: normal Deep run (no todos / no leftover files) byte-identical — no spurious marker, output renders normally | ✅ Verified live (Scenario E PASS) |
| 5 | **RUN-01b is visible LIVE in the Workspace TODOS panel at run-end** (lived-experience honesty — the whole point of the marker) | ❌ **GAP** — marker only appears after a manual reconcile (thread-switch / refresh); the live panel keeps showing un-marked open todos at run-end |

## The gap

**RUN-01b marker is not surfaced live.** The `138-02` reconciler is correct — it commits the marked
todos to the DB before the terminal sentinel — but the frontend does not reflect it live. The
`onTerminal` handler in `StreamsProvider.tsx` (~1797–1833) flips run status and tears down the run
subscription but never reconciles the todos panel, and the finalize-time `todo_updated` SSE emit is
not applied to the live panel. So a user watching their run finish still sees the open todos looking
"stuck" (un-marked) until they switch threads or refresh — the exact perception the phase set out to
fix. This is a lived-experience gap that code-level must_haves (all met) pass straight through — the
reason this phase mandated a live UAT.

- **Reproduced live:** 12+ seconds post run-end the panel still showed unmarked open todos; a
  thread-switch surfaced the markers immediately (GET `/threads/{id}/todos` = correct).
- **Scope:** frontend only — outside `138-02`'s deliberately backend-only scope.

## Recommended remediation

Reconcile the todos panel on run-terminal (fetch-on-terminal), consistent with CLAUDE.md decision
D-v2.5-03 ("Realtime is a best-effort hint; reconcile via fetch is the source of truth"). Small
additive change on `StreamsProvider.tsx` (G-5 hot file — satisfied at 075.7); ship with a test and
re-verify Scenario B live. Track via `/gsd:plan-phase 138 --gaps`.

## Disposition

- RUN-01a: fully verified — no gap.
- RUN-01b: backend correct + persistent; ONE live-surfacing gap → gap closure.
- SEED-094 stays OPEN until the gap plan verifies.
