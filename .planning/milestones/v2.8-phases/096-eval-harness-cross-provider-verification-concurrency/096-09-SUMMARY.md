---
phase: 096-eval-harness-cross-provider-verification-concurrency
plan: 09
subsystem: harness-engine
tags: [restart-resumability, graceful-shutdown, resume-sweep, ask_user, lifespan, F2-backstop]

# Dependency graph
requires:
  - phase: 096-07
    provides: "scripts/restart_smoke.py — the 3-kill-point harness that exposed and then verified this gap"
  - phase: 091-harness-engine
    provides: "find_resumable_runs + claim_run + harness_resume_lease_seconds — the boot-time resume sweep this fix feeds"
  - phase: 092-dual-mode-wiring
    provides: "F2 backstop terminalize site (threads.py ~1531) + finish_run anchor-clearing semantics"
provides:
  - "Graceful-shutdown resumability: harness runs interrupted by uvicorn SIGINT/restart stay status='active' with anchor intact, so the next-boot resume sweep claims and re-drives them (previously F2 terminalized them to 'failed' and cleared the anchor — never resumable)"
  - "_APP_SHUTTING_DOWN flag in harness_engine.py (set_app_shutting_down/is_app_shutting_down), set in main.py as the FIRST shutdown step before task.cancel()"
  - "F2 terminalize gated on not is_app_shutting_down() — harness branch only; Deep + non-shutdown paths byte-identical"
  - "ask_user shutdown sentinel option A: _exec_llm_human_input escapes on {kind:shutdown} payload; engine skips _expire_pending_ask_user on shutdown so the pending prompt survives for resume_pending_prompt re-emit (BUG-260605-01)"
affects: [096-verification, restart-smoke, harness-resume, production-deploys]

# Tech tracking
tech-stack:
  added: []
  patterns: ["shutdown-vs-user-Stop disambiguation via process-level flag (shutdown = stay resumable; Stop/crash/timeout = terminalize as before)", "shell runs row is disposable — workflow_runs anchor governs resume, not shell status"]

key-files:
  created: []
  modified:
    - backend/app/main.py
    - backend/app/api/threads.py
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/phase_types.py

key-decisions:
  - "Option A for the ask_user/sentinel interaction (operator-approved): skip the shutdown sentinel finalize for HARNESS runs (stay pending+active for resume); Deep runs keep the Phase 085 D-085-07 sentinel behavior unchanged"
  - "Genuine crash (SIGKILL/no code runs) was never broken — rows stay active; this fix targets GRACEFUL shutdown specifically (dev Ctrl+C + production deploy/restart path)"
  - "Full eval re-run not required for closure: fix is shutdown-path-only (flag False during normal runs → byte-identical) and Deep is structurally untouched (_active_workflow_run_id is None on Deep)"

patterns-established:
  - "Restart-resumability verification ritual: all 3 restart_smoke kill points (programmatic / llm_agent / ask_user) must PASS live before a shutdown-path change closes"

# One-liner for /gsd:progress
one_liner: "Graceful-shutdown restart resumability fixed (UAT Test 2 blocker): SHUTTING_DOWN flag gates the F2 terminalize so harness runs survive uvicorn restarts and the boot sweep re-claims them; all 3 restart_smoke legs PASS live (commit e5c2a1f2)"
---

# 096-09 SUMMARY — Restart resumability fix (UAT Test 2 gap closure)

**Status: VERIFIED ✅ — commit `e5c2a1f2`, all 3 restart_smoke legs PASS live 2026-06-07.**

Insert-plan created from 096-HUMAN-UAT.md Test 2 (restart smoke, blocker severity).
This SUMMARY was backfilled 2026-06-07 after live verification; the full root-cause
analysis, fix design, safety analysis, and task log live in `096-09-PLAN.md`
(self-documenting — status and T1–T5 completion recorded inline there).

## What was broken

Graceful uvicorn shutdown (Ctrl+C / production restart) cancelled the harness
producer → the F2 backstop terminalized the workflow to `failed` AND cleared
`threads.active_workflow_run_id` → `find_resumable_runs` could never re-claim it.
Hard kills were fine; the bug was specific to the graceful path — exactly what
deploys use. Evidence: workflow_run `432bb144` (status=failed, anchor NULL,
flip timestamped at the Ctrl+C moment).

## What shipped (commit e5c2a1f2)

1. **`_APP_SHUTTING_DOWN` flag** (harness_engine.py) — set in main.py lifespan as
   the first shutdown step, before the `task.cancel()` loop.
2. **F2 gate** (threads.py) — on shutdown, SKIP `finish_run` for harness runs
   (leave `active` + anchor + active phase row for the boot sweep); user-Stop /
   crash / timeout terminalize exactly as before.
3. **ask_user option A** (phase_types.py + harness_engine.py) — on a
   `{kind:shutdown}` sentinel payload, `_exec_llm_human_input` escapes via
   CancelledError and the engine skips `_expire_pending_ask_user`, so the pending
   prompt survives for the sweep's `resume_pending_prompt` re-emit.

**Red-line compliance:** Deep mode byte-identical (F2 only runs when
`_active_workflow_run_id is not None`); provider-uniform (shared finalizer, no
provider branch touched); no new stranding (resume sweep + lease already handle
runs left active).

## Live verification (operator-driven, 2026-06-07)

| Leg | Run | Result |
|---|---|---|
| `--kill-at programmatic` | `fa5ba738` | SMOKE_RESULT PASS — claimed, 5/5 phases, no dup subagents |
| `--kill-at llm_agent` | `834b6a7e` | SMOKE_RESULT PASS — claimed, 5/5 phases |
| `--kill-at ask_user` | `14cdb490` | SMOKE_RESULT PASS — prompt_reemitted + answer_reached_engine (BUG-260605-01 live-verified), 5/5 phases |

Regression: 4 files py_compile clean; affected suites green in isolation;
net-new failures vs baseline = 0.

## Deferred (captured in PLAN follow-up note)

- restart_smoke ergonomics: non-ask_user legs don't auto-answer the `confirm`
  phase (operator click or 300s timeout still yields PASS) — optional test-tooling
  polish, not blocking.
