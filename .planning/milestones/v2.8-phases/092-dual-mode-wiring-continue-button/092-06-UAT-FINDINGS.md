---
status: gaps_found
phase: 092-dual-mode-wiring-continue-button
plan: 06
source: [092-06-PLAN.md Task 3, 092-VALIDATION.md Manual-Only]
gate: lived-experience UAT (phase verification gate)
tested: 2026-05-31
tester: orchestrator (Chrome DevTools MCP) + operator (live Supabase + uvicorn console)
verdict: BLOCKED — F1 & F2 verifiably closed; a NEW blocker (F4) prevents a Harness workflow from running end-to-end, blocking all downstream rows
---

## Environment

- Backend: live uvicorn (restarted post-092-05), local Supabase :54322 (migration 064 applied), Redis local.
- Frontend: `npm run dev` http://localhost:5173/, logged in fhdmrd@gmail.com.
- Run under test: thread `91410835-f409-49fb-ac97-e37ef897795a`, producer run `b5e85c73-08c9-4a22-aed7-a61337f6feae`, workflow_run `e358e5f7-60ca-4d32-bd6a-6a8ce05b11be`, definition `Research → Summarize` (`00000000-…-b1`), provider OpenAI / gpt-5.4-mini, agent_mode default.

## Result summary

| # | Row | Verdict | Evidence |
|---|-----|---------|----------|
| 1 | **F1 — harness audit user_id (CRITICAL, 092-05)** | ✅ **CLOSED** | `workflow_runs` row `e358e5f7` created with **non-null** `user_id=d8a54002…`; `harness_audit` has a `phase_started` row with that **non-null** user_id. The write that previously raised `NotNullViolationError` succeeded. No crash on the audit path. |
| 2 | **F2 — wedged lock (HIGH, 092-05)** | ✅ **CLOSED** | The run failed (see F4) and `workflow_runs.status='failed'` **and** `threads.active_workflow_run_id=NULL`. Failure-path terminalize + anchor-clear worked. No wedged lock. |
| 3 | **SC#2 — anchor → NULL** | ✅ **PASS (failure path)** | `SELECT active_workflow_run_id … = NULL` after the failed run. (Natural-completion + explicit-Cancel variants still owed once F4 lets a workflow finish/stream.) |
| 4 | **F4 — harness LLM-agent phase sub-agent insert (NEW BLOCKER)** | ❌ **FAIL** | First phase executor crashes: `asyncpg.ForeignKeyViolationError: runs_parent_run_id_fkey — Key (parent_run_id)=(e358e5f7…) is not present in table "runs"`. Workflow cannot execute its phases. |
| 5 | **F3 — composer disable + 409 (092-06 frontend)** | ⚠️ **CODE-COMPLETE, LIVE-UNVERIFIED** | Tasks 1–2 shipped (typed 409 ApiError, kickoff+reconcile lock seed, textarea/Send disable, 409 dual-bubble rollback, per-thread error banner); tsc + build clean. Live lock-honored / 409-rollback could NOT be observed because the workflow dies in ~2s (F4) so no thread stays locked long enough. Composer correctly showed **unlocked** for the already-terminal run (anchor NULL) — consistent, not a defect. |
| 6 | **SC#3 — parallel-thread lock** | ⛔ **BLOCKED by F4** | Needs a thread that stays locked while another is free. |
| 7 | **SC#5 — reload-reconcile + Stop-unlock** | ⛔ **BLOCKED by F4** | Needs a live mid-workflow run to reload into / Stop. |
| 8 | **CONT-01 — cap-drive → Continue → 3-cap** | ⛔ **BLOCKED by F4** | Needs a workflow/Deep run that reaches a step cap. |
| 9 | **SC#10 — native-7 4-axis scoreboard** | ⛔ **BLOCKED by F4** | A workflow_run is created + persisted with non-null user_id (F1 satisfied for Phase 091's parked concern), but no provider can complete a workflow until F4 is fixed. |
| 10 | **Deep byte-identical** | ⬜ **NOT RUN** | Deferred to the F4 gap-closure UAT (cheap to run alongside). |

## F4 — root cause (NEW; harness phase-execution substrate)

**Symptom:** Selecting Harness + a published workflow and sending kicks off a real `workflow_runs` row, the F1 audit write succeeds, the engine enters its first phase — then the phase's LLM-agent sub-agent insert fails and the whole run is marked `failed` within ~2s. UI shows "setting up agent…" then blank (operator screenshot `screenshots/Screenshot 2026-05-31 195547.png`).

**Mechanism (verified in code):**
- `backend/app/api/threads.py:1158` — the harness producer branch builds `wf_ctx = SimpleNamespace(run_id=_active_workflow_run_id, …)`. So the engine ctx's `run_id` is the **workflow_run** id (lives in `workflow_runs`).
- `backend/app/services/harness/phase_types.py:225` `_exec_llm_agent` → `run_task_sub_agent(parent_ctx=phase_ctx)` where `phase_ctx` inherits that `run_id`.
- `backend/app/services/task_service.py:264-273` `insert_run(..., parent_run_id=parent_ctx.run_id)`.
- `runs.parent_run_id` FK references `runs(run_id)`. The workflow_run id is **not** a `runs` row → `ForeignKeyViolationError`.
- The valid producer-shell `runs` id (`b5e85c73`, the run_id returned by `POST /messages`, which *is* in `runs` and is finalized by `_shielded_finalize`) is in scope at `agent_runner` but is **never threaded into `wf_ctx`**.

**Why it surfaced only now:** before 092-05, F1 killed the run on the FIRST audit write (`phase_started`) before any phase executor ran. Fixing F1 let the run advance into `_exec_llm_agent`, exposing this next-layer FK mismatch. This is precisely Phase 091's parked harness-execution path — never exercised live because no `INSERT INTO workflow_runs` previously succeeded.

**Fix shape (for the gap plan — NOT applied here):** thread the producer-shell `runs` id into the engine ctx as a distinct field (e.g. `producer_run_id`) and use THAT for `runs.parent_run_id`, keeping `ctx.run_id = workflow_run id` for audit/SSE/`_build_resume_context`. Must cover BOTH the live producer ctx (`threads.py` harness branch) AND the resume ctx (`harness_engine._build_resume_context`). Cross-provider + agent-loop-adjacent → needs its own scoped UAT (the rows blocked above become its gate). Out of scope for 092-05 (F1/F2 audit/lock) and 092-06 (F3 frontend).

## Disposition

- **092-05 (F1/F2): VERIFIED CLOSED** by this live run.
- **092-06 (F3 frontend): code-complete, tsc/build clean; live behavior blocked by F4.**
- **MODE-01 / MODE-02 / CONT-01: REMAIN OPEN** — the binding criterion "a Harness workflow runs end-to-end" is not met.
- **Route:** new gap-closure plan **092-07** for F4 (harness sub-agent `parent_run_id`), whose verification re-runs rows 4–10 (+ the SC#2 natural-completion/Cancel variants).

## Regression guardrails for 092-07 (operator directive — do NOT regress accumulated stability)

The F4 fix touches a G-5 hot file (`threads.py`, 9+ phases) + the harness ctx threading + `task_service`/`phase_types`/`harness_engine._build_resume_context`. It MUST be additive + harness-scoped and preserve everything already stabilized. The 092-07 plan + its UAT gate MUST explicitly protect, at minimum (not limited to):

1. **Deep mode byte-identical** — change lives ONLY in the harness branch (`_active_workflow_run_id is not None`); the Deep `else` stays untouched (089 run1-vs-run1 structural-diff-empty). Never touch a provider streaming branch (075.x cascade rule).
2. **All providers' functionality (native-7 + OpenRouter)** — the sub-agent path runs through `resolve_sub_agent_model_safely` + provider routing; re-verify OpenAI / Anthropic / Google / DeepSeek / Moonshot / GLM / MiniMax (+ OpenRouter best-effort). Honor the zhipu/minimax MODEL_CAPABILITIES registry-trap (correct model IDs → native tools, not structured fallback). Provider-scoped/additive only — NO shared-path changes (`feedback_no_cross_provider_regressions`).
3. **Thread-switch mid-run** — per-thread keying (BUG-260523-01); Thread A locked + streaming while Thread B composer stays free (SC#3); switch A↔B mid-run without bleed or stale-id race.
4. **Refresh / reload mid-run** — lock + run state reconcile from GET `/threads/{id}/workflow` and the run snapshot (Realtime-as-hint, reconcile-on-fetch — D-v2.5-03); no ghost/stale lock after reload.
5. **Sub-agent SSE demux + panel** — Phase 086 demux contract (R9): sub-agent events on the sub-agent stream, `sub_agent_start`/`sub_agent_done` on the PARENT stream, panel drill-down intact. Changing `parent_run_id` must not break the panel timeline.
6. **F1 + F2 stay closed** — harness_audit non-null user_id; failed/timeout run still terminalizes workflow_runs + clears the anchor (no wedged lock); `lock_is_stale` self-heal.
7. **CONT-01 Continue** — cap-drive → Continue runs dropped tools on the SAME run_id; 3-cap then refused — unaffected.
8. **Test baselines** — backend full-suite zero net-new failures vs the 092-03 baseline; frontend tsc 54-baseline / 0 net-new; build clean. Cover the new FK path with a live-DB test (mirror `test_092_harness_audit_live.py`) so the mock blind spot can't re-hide it.

These are the binding UAT axes for 092-07 — the same 4-axis scoreboard (cross-provider × multi-tool × parallel-thread × long-message) plus reload + thread-switch, run LIVE (no "if data permits" deferrals).
