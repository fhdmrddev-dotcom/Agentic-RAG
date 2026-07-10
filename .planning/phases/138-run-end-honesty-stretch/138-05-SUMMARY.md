---
phase: 138-run-end-honesty-stretch
plan: 05
subsystem: verification
tags: [uat, run-end-honesty, live-verification, checkpoint, workspace-todos-panel, gap-closure]

# Dependency graph
requires:
  - phase: 138-04
    provides: "_reconcileTodosOnTerminal fetch-on-terminal helper wired into both StreamsProvider onTerminal handlers"
provides:
  - "Operator + Chrome-MCP live verdict for the RUN-01b live-surfacing gap (Scenario B) — PASS"
  - "SEED-094 closable (both original re-open triggers now verified fixed live)"
affects: [138-run-end-honesty-stretch, run-end-honesty, seed-094]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-UAT re-verify that a gap-closure fix actually resolves the lived-experience defect it targeted (fetch-on-terminal surfaces the backend marker live)"
    - "LESSON: Vite HMR does not hot-apply a React provider/context change — a long-lived tab silently keeps the pre-fix module; live UAT of a provider change REQUIRES a fresh load"

key-files:
  created: []
  modified: []

verdict: passed
scenarios_passed: [B, B-neg, B-xp]
scenarios_failed: []
---

# 138-05 — Live re-verify of the RUN-01b live-surfacing gap (Scenario B)

Verification-only checkpoint. No code changed. The gap from `138-03` / `138-VERIFICATION.md`
must-have #5 (the `(run ended — not completed)` marker not surfacing live in the Workspace
TODOS panel at run-end) is now **CLOSED** by the `138-04` fetch-on-terminal fix.

## Verdict

| Scenario | Result | Evidence |
|---|---|---|
| **B** — marker surfaces LIVE at run-end, no refresh | ✅ **PASS** (×2, deterministic) | Driven live via Chrome DevTools MCP on deepseek/deepseek-v4-flash. On BOTH runs the Workspace TODOS panel showed each open (in_progress/pending) item's content suffixed ` (run ended — not completed)` within a second or two of the run ending, completed item unmarked, **no thread-switch / no refresh**. `[138-DIAG]` console trace confirmed `onTerminal→reconcile` then `fetched` fired each time. |
| **B (browser == DB)** | ✅ PASS | psycopg2 (:54322) on both threads (`a3e43a20…` 10:36 UTC, `b6fcc600…` 10:38 UTC): open rows carry the exact suffix in `content`, `status` unchanged — browser panel matched DB WITHOUT a refresh. |
| **B-neg** — D-14 red line (no-todo Deep run) | ✅ PASS | Operator confirmed: normal reply, no marker text anywhere, no spurious panel change. |
| **B-xp** — cross-provider (SC#10 spirit) | ✅ PASS (by construction + live) | Shared, provider-agnostic `onTerminal`/emit path — no provider fork. Verified live on deepseek (the exact provider the gap reproduced on). |

## Root cause of the earlier live failure (operator's two runs)

The operator's initial live runs still showed unmarked open todos. Root cause: **stale frontend
code** — Vite HMR does not cleanly hot-apply a React *provider* (`StreamsProvider`) change, so a
long-lived browser tab kept the pre-`138-04` module (no fetch-on-terminal). The backend `138-02`
reconciler was correct throughout (DB carried the marker on the operator's own thread
`3fa1889e…`, psycopg2-verified). A fresh navigate (Chrome MCP) loaded the fixed module and the
marker surfaced live, deterministically, twice.

**Lesson (recorded):** live UAT of a provider/context change requires a *fresh page load*, not an
HMR update — otherwise the test silently exercises the old code.

## Disposition

- RUN-01a: verified live in `138-03` — closed.
- RUN-01b: backend correct (`138-02`) + live-surfacing fix (`138-04`) now verified live — **closed**.
- **SEED-094 closable** — both original re-open triggers verified fixed live (baseline leak closed
  in `138-03`; stuck-todo live-surfacing closed here).
- Phase 138 complete.

## Design note (operator-raised, deferred)

The operator questioned whether appending `(run ended — not completed)` to the todo *content* is
the best UX vs. a run-state-aware panel (stop the in-progress spinner at run-end, dim open rows,
show a visual "ended" pill instead of mutating text). The current text-append is the minimal
*honest* signal given the `todos.status` enum has no "abandoned" value — it meets the requirement.
The cleaner run-state-aware treatment is a genuine enhancement filed as a new SEED for a future
frontend phase (does not block this closure).

## Notes

- Two throwaway test threads created during Chrome-MCP verification (`a3e43a20…`, `b6fcc600…`,
  both titled "Create a todo list with 4 steps for") — harmless test data in the chat list.
- Temporary `[138-DIAG]` console instrumentation added to diagnose the stale-code failure was
  reverted after root-cause confirmation (working tree clean; committed `StreamsProvider.tsx` is
  the shipped `138-04` version).
