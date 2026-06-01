---
phase: 092-dual-mode-wiring-continue-button
plan: 07
subsystem: backend
tags: [harness, task-service, runs, workflow_runs, parent_run_id, fk, sse, resume, continue, id-routing]

# Dependency graph
requires:
  - phase: 092-06
    provides: F3 lock-UX code-complete + the live UAT that surfaced F4 (harness sub-agent parent_run_id FK mismatch) — the blocker this plan closes
  - phase: 092-05
    provides: F1/F2 closed (workflow_runs.user_id, write_audit owner, failure-path terminalize, lock_is_stale self-heal) — a harness run is created + persisted so its phases can attempt to execute
  - phase: 091
    provides: the harness engine + task() sub-agent path whose parked execution layer F4 exposes
provides:
  - "F4 id-routing closed across 3 facets: (A) sub-agent parent_run_id FK — producer_run_id minted as a real runs row on the engine ctx + fail-closed guard; (B) SSE routing — stream_run_id threaded through run_workflow + _run_phase_with_gates so all 9 _emits + the ask_user_prompt transport reach the watched producer stream while write_audit stays workflow-run-keyed; (C) resume — BOTH resume ctx sites mint + terminalize a non-null producer runs row + Continue-404 owner-scoped repair + latest_producer_run_id pure-read surfacing + frontend re-subscribe on both paths"
  - "F5/F6/F7/F8 closed as in-plan deviations (resume ctx tools/supabase; final-only output surfacing; sources+confidence chip; kickoff_prompt threading) — the full document-grounded loop renders a grounded answer end-to-end on OpenAI"
affects: [092-verification, 093, 092.5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two distinct run identities on one ctx: ctx.run_id = workflow_run id (audit/SSE/resume key) vs ctx.producer_run_id = a real runs row (the FK target for runs.parent_run_id) — the harness keeps workflow-run identity for everything user-facing while satisfying the runs FK"
    - "stream_run_id is threaded separately from the audit key so SSE re-attaches to the watched producer stream without re-keying audit rows (workflow-run-keyed audit preserved)"
    - "Resume + Continue both mint AND terminalize a non-null producer runs row so the FK holds on the resume path too (not just the live producer path)"
    - "get_thread_workflow stays a PURE READ; latest_producer_run_id surfacing is read-only (no write in the reconcile path)"

key-files:
  created:
    - backend/tests/integration/test_092_harness_fk_live.py
  modified:
    - backend/app/api/threads.py
    - backend/app/services/task_service.py
    - backend/app/services/harness_engine.py
    - frontend/src/providers/StreamsProvider.tsx

key-decisions:
  - "Thread a distinct producer_run_id (a real runs row) into the engine ctx for runs.parent_run_id, keeping ctx.run_id = workflow_run id for audit/SSE/resume — fixes the FK at the source instead of relaxing the constraint"
  - "Cover BOTH the live producer ctx (threads.py harness branch) AND the resume ctx (harness_engine._build_resume_context) — the resume path was a second FK landmine"
  - "Additive + harness-scoped: Deep byte-identical, get_thread_workflow stays a pure read, no provider streaming branch touched (075.x cascade + SC#3 rules honored)"
  - "F5/F6/F7/F8 closed as in-plan deviations because each was the next domino blocking a visible end-to-end answer; all additive, all on the harness path"

patterns-established:
  - "Harness id-routing rule: workflow_run id is the user-facing/audit/SSE/resume identity; a separate producer runs row is the FK anchor for sub-agent runs — never conflate them"

requirements-completed: [MODE-01, MODE-02, CONT-01]  # Validated at phase close (passed_with_overrides); F9/F10 → Phase 093

# Metrics
duration: ~multi-session (Tasks 1-5 code 2026-05-31; Task 6 binding UAT resolved by operator close decision 2026-06-01)
completed: 2026-06-01
---

# Phase 092 Plan 07: Gap-Closure (F4 harness sub-agent id-routing) + Binding UAT Gate Summary

**Closed F4 (the harness sub-agent `parent_run_id` FK mismatch) across 3 id-routing facets, then closed the F5→F8 dominoes it unblocked — so a Harness workflow now runs end-to-end and renders a grounded, sources+confidence answer over the user's documents (proven live on OpenAI). The Task 6 binding 4-axis native-7 UAT surfaced two further BINDING defects — F9 (harness works on OpenAI only) and F10 (ask_user round-trip broken) — which the operator routed to a comprehensive follow-on phase (093) rather than more single-domino fixes. Phase 092 closes `passed_with_overrides`; MODE-01/MODE-02/CONT-01 are Validated; F9/F10 carry to Phase 093 (built on the Phase 092.5 provider gateway).**

## Performance

- **Duration:** Tasks 1–5 (code + tests) shipped 2026-05-31 in a sequential exec; Task 6 (binding UAT gate) resolved by operator close decision 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 5 code/test tasks + 1 `checkpoint:human-action` binding UAT gate
- **Backend full-suite:** ZERO net-new failures vs the 092-03 baseline; frontend tsc -b = 54 baseline (0 net-new) + vite build clean

## Accomplishments

- **F4 (CRITICAL) closed — id-routing across 3 facets:**
  - **Facet A — sub-agent `parent_run_id` FK** (`fa14a1c3`): the engine ctx gains a distinct `producer_run_id` (a real `runs` row); `run_task_sub_agent` uses THAT as `runs.parent_run_id`, keeping `ctx.run_id = workflow_run id`; a fail-closed guard prevents a workflow-run id from ever reaching the FK.
  - **Facet B — SSE routing** (`ca0ee5c5`): `stream_run_id` threaded through `run_workflow` + `_run_phase_with_gates` so all 9 `_emit`s and the `ask_user_prompt` transport reach the watched producer stream; `write_audit` stays workflow-run-keyed.
  - **Facet C — resume** (`0f6a66df` + `cdd775f6`): BOTH resume ctx sites mint + terminalize a non-null producer `runs` row; Continue-404 owner-scoped repair; `latest_producer_run_id` pure-read surfacing; frontend re-subscribe on both the startup-sweep and `/continue` paths.
  - **Live FK regression test** (`ec9dd4f4`): `test_092_harness_fk_live` — 4 green vs local Postgres (:54322), closing the 091 mock blind spot.
- **F5/F6/F7/F8 closed as in-plan deviations (the dominoes F4 unblocked):** resume ctx tools/supabase (`a7be6423`); final-only output surfacing → the grounded answer renders as the assistant message (`803aafd3`); sources+confidence chip persisted (`ba5949c4`); `kickoff_prompt` (SEED-047) threaded into wf_ctx + both resume ctxs + the first phase's user turn (`95da3032`). The full RAG loop closes: ask → search the user's docs → grounded answer with visible sources.
- **Test-pollution fixes** (`69e01300`, `2aa25777`): isolation repairs so the suite stays at zero net-new failures.

## Task Commits

1. **Task 1: Facet A — producer_run_id FK fix + fail-closed guard** - `fa14a1c3`
2. **Task 2: Facet B — stream_run_id SSE routing (9 emits + ask_user transport)** - `ca0ee5c5`
3. **Task 3: Facet C — resume ctx producer runs row (both sites)** - `0f6a66df`
4. **Task 4: Facet C — Continue-404 repair + latest_producer_run_id surfacing + frontend re-subscribe** - `cdd775f6`
5. **Task 5: live-DB FK regression test + test-pollution fixes** - `ec9dd4f4`, `69e01300`, `2aa25777`
6. **Task 6: binding 4-axis native-7 UAT gate** — `checkpoint:human-action`, resolved by operator close decision (no source commit; results in `092-07-UAT-FINDINGS.md` UPDATE 1–6).

_In-plan deviation commits (F5–F8): `a7be6423`, `803aafd3`, `ba5949c4`, `95da3032`, `27b12c37` (resume current_user)._

## UAT Gate (Task 6) — resolved: passed_with_overrides

Full detail in [`092-07-UAT-FINDINGS.md`](./092-07-UAT-FINDINGS.md) (UPDATE 1–6). Verdict summary:

| Row | Verdict |
|-----|---------|
| **F4 — sub-agent FK (CRITICAL)** | ✅ VERIFIED CLOSED — no `runs_parent_run_id_fkey`; harness_audit workflow-run-keyed; live FK test green |
| **F5 — resume ctx tools/supabase** | ✅ VERIFIED live — `search_documents` runs in-phase |
| **F6 — output surfacing** | ✅ VERIFIED live — grounded answer renders as the assistant reply, persists, survives reload |
| **F7 — grounding visible** | ✅ VERIFIED live — "● Medium confidence" + "5 sources" chip; `source_refs`/`confidence_level` persisted |
| **F8 — kickoff_prompt threaded** | ✅ VERIFIED live — on-topic grounded synthesis (2536 chars, source_refs=5) |
| **MODE-01 / MODE-02 / SC#2 (failure path)** | ✅ VERIFIED live (carried from 092-06) |
| **F9 — cross-provider harness parity** | ⏭ OVERRIDE → Phase 093 (harness OpenAI-only; Deep robust on all 7 — UPDATE 6 evidence table) |
| **F10 — ask_user round-trip + draft** | ⏭ OVERRIDE → Phase 093 (runs vs workflow_runs id mismatch → 404; draft blocked by F6 ceiling) |
| **F3 lock-during-run / SC#3 / SC#5 / CONT-01 cap-drive** | Accepted as code-verified at close (single-provider owed rows; re-exercised under 093/096) |

### Operator close decision (2026-06-01)

Per `092-07-UAT-FINDINGS.md` UPDATE 5: **"NOTE these for a separate comprehensive phase rather than continue ad-hoc fixing."** The two remaining BINDING defects (F9 cross-provider, F10 ask_user) are routed to **Phase 093** (Harness Cross-Provider Parity), built on **Phase 092.5** (Provider Gateway Extraction). Phase 092 closes `passed_with_overrides` — see `092-VERIFICATION.md`.

## Decisions Made

- Two distinct run identities on the engine ctx: `ctx.run_id` = workflow_run id (audit/SSE/resume); `ctx.producer_run_id` = a real `runs` row (the `runs.parent_run_id` FK target). Fix the FK at the source, don't relax the constraint.
- Cover BOTH the live producer ctx (`threads.py`) and the resume ctx (`harness_engine._build_resume_context`) — the resume path was a second FK landmine.
- Close F5–F8 in-plan because each was the next domino blocking a visible end-to-end answer; all additive, all harness-path, Deep byte-identical.
- Stop at F9/F10: they are a harness-substrate architecture problem (OpenAI-SDK-only phase path + missing per-run model resolution), not a single-domino fix — route to the comprehensive phase.

## Deviations from Plan

In-plan deviations F5/F6/F7/F8 + resume-current_user were closed as successive unblocked dominoes (each gated the next visible behavior). All additive, all on the harness path, Deep byte-identical, build-clean. No scope creep into Deep or shared provider branches. The F9/F10 defects were deliberately NOT fixed here (operator directive) — routed to Phase 093.

## Phase Verification Status

**passed_with_overrides.** The phase goal (dual-mode wiring: Deep↔Harness per-thread, server-enforced lock, Cancel, Continue) is met and a Harness workflow runs end-to-end with a grounded answer (proven live on OpenAI). MODE-01 / MODE-02 / CONT-01 are **Validated**. The two cross-provider/transport defects (F9/F10) are operator-routed to **Phase 093** with full evidence; Phase 092.5 (the prerequisite gateway) is planned. See `092-VERIFICATION.md`.

## Next Phase Readiness

- **Phase 092.5 (NEXT)** — Provider Gateway Extraction (the shared provider boundary the harness must consume). Planned 2026-06-01 (6 plans / 5 waves).
- **Phase 093** — Harness Cross-Provider Parity (closes F9/F10 + the 3 never-run phase-types + ask_user round-trip), built on the 092.5 gateway.

## Self-Check: PASSED

- Modified files present: `backend/app/api/threads.py`, `backend/app/services/task_service.py`, `backend/app/services/harness_engine.py`, `frontend/src/providers/StreamsProvider.tsx`, `backend/tests/integration/test_092_harness_fk_live.py`
- Task commits in git log: `fa14a1c3`, `ca0ee5c5`, `0f6a66df`, `cdd775f6`, `ec9dd4f4`, `69e01300`, `2aa25777`
- UAT findings referenced: `092-07-UAT-FINDINGS.md` present (UPDATE 1–6)

---
*Phase: 092-dual-mode-wiring-continue-button*
*Completed: 2026-06-01 — phase closed passed_with_overrides; F9/F10 → Phase 093*
