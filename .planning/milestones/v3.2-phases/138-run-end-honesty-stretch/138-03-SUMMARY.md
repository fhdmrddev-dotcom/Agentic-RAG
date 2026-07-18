---
phase: 138-run-end-honesty-stretch
plan: 03
subsystem: verification
tags: [uat, run-end-honesty, live-verification, checkpoint, workspace-todos-panel]

# Dependency graph
requires:
  - phase: 138-01
    provides: "RUN-01a leftover-file exclusion (final_output_files hash filter)"
  - phase: 138-02
    provides: "RUN-01b run-end todo honesty reconciler + two guarded finalizer call sites"
provides:
  - "Operator live verdict for RUN-01 (Scenarios A–F) recorded"
  - "One gap identified: RUN-01b marker not surfaced LIVE in the Workspace TODOS panel at run-end (backend correct; frontend live-update gap)"
affects: [138-run-end-honesty-stretch, run-end-honesty, seed-094]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-UAT checkpoint that caught a lived-experience gap static tests + code-level must_haves would pass through (the exact failure mode this phase's live check was designed for)"

key-files:
  created: []
  modified: []

verdict: gaps_found
scenarios_passed: [A, C, D, E, F]
scenarios_failed: [B]
routed_to: "/gsd:plan-phase 138 --gaps"
---

# 138-03 — Live verification of RUN-01 (Scenarios A–F)

Verification-only checkpoint. No code changed. Driven live via Chrome MCP against the
running dev app (deepseek / deepseek-v4-flash), cross-checked against Postgres :54322
with psycopg2. Operator confirmed Scenario A directly.

## Verdict

| Scenario | Result | Evidence |
|---|---|---|
| **A** — RUN-01a leftover file exclusion | ✅ PASS | Operator confirmed: second code-generating run in a reused sandbox thread shows only its own new file(s); no dead "Download unavailable" card, no re-surfaced prior-run file. |
| **B** — RUN-01b marker on clean completion | ⚠️ GAP | **Backend correct** (DB carries the exact `(run ended — not completed)` marker on every open todo, completed item untouched, statuses unchanged — psycopg2-verified on two separate runs; marker renders correctly once the panel reconciles). **BUT the live TODOS panel does NOT update at run-end** — the marker only appears after a thread-switch/refresh. |
| **C** — no-stack (D-04) | ✅ Pass (evidence) | DB shows exactly one marker per open item (no doubling); locked by `test_085_todos_service.py`. |
| **D** — cap_paused stays unmarked + Continue marks | ✅ Pass (by construction) | SITE 1 two-clause gate `_terminal_status == "completed" and cap_disposition != "cap_paused"` + SITE 2 finalizer sets `_terminal_status = "cap_paused"` before its plain gate — both verified in merged code + unit tests. Live cap-hit repro deferred (hard to trigger deterministically). |
| **E** — D-14 red line (normal Deep run) | ✅ PASS live | "Explain what RAG means in two sentences" → normal answer, NO todo panel, NO marker text anywhere. Red line intact. |
| **F** — cross-provider parity | ✅ Pass | Shared, provider-agnostic finalizer/emit path; exercised on deepseek. Marker behaviour (and the live gap) is identical across providers — no provider fork. |

## The gap (Scenario B) — root cause

- The `138-02` reconciler fires correctly on clean completion and `replace_todos` commits the
  marked list to the DB **before** the terminal sentinel (threads.py `_shielded_finalize` line
  ~1636, before `finalize_run` ~1684 and the `done` sentinel ~1700). DB is the source of truth
  and is correct.
- The finalize-time `todo_updated` SSE emit is **not applied to the live Workspace TODOS panel**,
  and the frontend's `onTerminal` handler (`StreamsProvider.tsx` ~1797–1833) flips run status +
  cleans up subscriptions but **never reconciles the todos panel**. There is no fetch-on-terminal
  to compensate, so the panel keeps showing the pre-marker todos until a manual reconcile
  (thread-switch / refresh), at which point the GET `/threads/{id}/todos` pulls the correct
  marked state and it renders fine.
- Reproduced live: 12+ seconds after run-end the panel still showed unmarked open todos (not a
  timing lag); navigating into the thread surfaced the markers immediately.

## Recommended fix (for the gap plan)

Reconcile the todos panel when a run reaches a terminal state — consistent with the project's
own architecture rule (CLAUDE.md: *"Realtime is a best-effort hint, not a source of truth —
always reconcile via fetch on (re)connect"*, decision D-v2.5-03). Since the DB already holds the
correct markers by the time the terminal sentinel fires, a fetch-on-terminal for the todos panel
guarantees the marker surfaces live with no manual refresh — robust regardless of whether the
finalize SSE emit is delivered/applied. Small, additive frontend change on `StreamsProvider.tsx`
(a G-5 hot file — satisfied at 075.7); must ship with a test and re-verify live.

## Disposition

- RUN-01a: fully verified live — closable.
- RUN-01b: backend fully correct; ONE frontend live-surfacing gap remains → routed to
  `/gsd:plan-phase 138 --gaps`.
- SEED-094 stays OPEN until the gap plan verifies (both original re-open triggers: baseline leak
  = fixed & verified; stuck todos = fixed in DB, live-surfacing pending).

## Notes

- Two throwaway test threads were created during live verification (a Scenario-B re-run titled
  "Create a todo list with 4 st…" and an "Explain what RAG means…" red-line run) — harmless test
  data in the chat list.
