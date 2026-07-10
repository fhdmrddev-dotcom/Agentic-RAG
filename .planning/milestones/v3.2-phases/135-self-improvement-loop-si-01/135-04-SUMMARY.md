---
phase: 135-self-improvement-loop-si-01
plan: 04
subsystem: api
tags: [self-improvement, si-01, proposals, fastapi, pydantic, owner-scoping, idor, d-13-gate]

# Dependency graph
requires:
  - phase: 135-self-improvement-loop-si-01
    plan: 01
    provides: "public.skill_proposals table (mig 083) — the durable owner-scoped write target + 7-value lifecycle status"
  - phase: 135-self-improvement-loop-si-01
    plan: 03
    provides: "skill_proposer_service.propose() + assemble_evidence() — the forced-emission proposer core"
  - phase: 133-eval-runner
    provides: "evals.py /skills router + _verify_owned_skill + eval_runs (source run = diff base)"
  - phase: 134-eval-results-verdict-ratings
    provides: "rate_eval_result IDOR gate (owner-verify row BEFORE write, 404-not-403) — copied for reject"
provides:
  - "LOCKED SkillProposalResponse contract (with nullable D-13 gate + base_instructions) — Plan 05 WRITES gate, Plan 06 frontend consumes, Plan 07 DISPLAYS"
  - "ProposeBody + ForcePromoteBody (Plan 05 import) + PromotionGate (8 D-13 count keys) Pydantic models"
  - "POST /skills/{id}/proposals — on-demand draft (D-01/D-04) with one-open-proposal concurrency + honest 424 floor"
  - "GET /skills/{id}/proposals (list) + GET .../{pid} (single) + POST .../{pid}/reject (pure audit) — all owner-scoped 404-not-403"
affects: [135-05-approval-promotion, 135-06-frontend, 135-07-display, 136-skill-publish-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Response-model field ownership: declare a downstream-written nullable field (gate) on the LOCKED response model in the OWNING plan so FastAPI does not strip it before Plan 05 can populate it"
    - "App-side id mint + payload-over-echo overlay ({**payload, **db_echo}) so the response is correct under both the real DB (echoes generated columns) and a non-echoing test fake"
    - "Reuse the eval-domain IDOR gate verbatim (owner-verify row on id AND user_id BEFORE any write; 404 never 403) — rate_eval_result -> reject"
    - "Pure-audit status flip: reject = ONE .update(status='rejected'), NO version/skills write (D-10 re-draft path)"

key-files:
  created:
    - backend/tests/test_skill_proposals_router.py
  modified:
    - backend/app/models/eval_run.py
    - backend/app/api/evals.py

key-decisions:
  - "created_at/updated_at typed nullable on SkillProposalResponse — the response is assembled in-app (id minted app-side, mirroring start_eval_run's run_id); timestamps are hydrated from the DB insert/update echo when present (always, in production) and are None only under a non-echoing test fake. Interface listed them as plain fields; nullable is the pragmatic Rule-3 resolution that keeps the route correct under the hermetic test."
  - "D-04 concurrency blocks on BOTH 'approved' AND 're_evaling' (the in-flight set) and supersedes only 'proposed' — an approved-but-not-yet-re-evaling proposal is genuinely in-flight (a re-eval is committed/imminent), so clobbering it would orphan Plan 05's approve->re-eval chain (Rule 2 defensive extension of the plan's explicit block-on-re_evaling)."
  - "No-builder-model honest floor -> 424 FAILED_DEPENDENCY (the plan offered 424/502) — a missing resolved builder is a real dependency failure, never a fabricated proposal."
  - "user_id intentionally OMITTED from SkillProposalResponse — the interface field list omits it (it's the caller's own id; not part of the frontend contract), keeping the locked contract minimal."

patterns-established:
  - "The whole SI-01 loop response contract is born in ONE plan (04) so eval_run.py stays single-owner and the D-13 gate field survives serialization end-to-end"

requirements-completed: [SI-01]

# Metrics
duration: 18min
completed: 2026-07-02
---

# Phase 135 Plan 04: Proposal Control Surface (propose / review / reject) Summary

**The front half of the self-improvement loop: POST propose drafts ONE instruction-body edit on demand from a source eval run (D-01), enforcing one-open-proposal concurrency (D-04) and an honest no-builder-model floor; GET list/single + POST reject give owner-scoped review with 404-not-403 (D-07) and a pure-audit rejection (D-10); the LOCKED SkillProposalResponse carries the nullable D-13 `gate` honest-counts field (declared here so FastAPI does not strip it — Plan 05 writes it, Plan 07 displays it).**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-07-02
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- **eval_run.py (LOCKED contract):** added `ProposeBody { source_eval_run_id }`, empty `ForcePromoteBody` (Plan 05 imports it — keeps eval_run.py single-owner), `PromotionGate` (exactly the 8 D-13 count keys: passed/no_regression/improved/prev_pass/prev_fail/still_pass/newly_pass/excluded_not_measured), and `SkillProposalResponse` mirroring the mig-083 columns PLUS `base_instructions` (hydrated base-version body for the diff) AND `gate: PromotionGate | None = None` (declared here so FastAPI does not strip the field Plan 05 populates at reconcile).
- **evals.py POST propose (D-01/D-04):** owner-verify the skill FIRST (404 cross-user), read the SOURCE eval run owner-scoped to resolve the evaluated version (the diff base), read that base version's instructions, guard D-01 (400 if the source run has no results), enforce D-04 (supersede a lingering `proposed` draft / 409 on an in-flight `approved`/`re_evaling` one), assemble the D-02 evidence, force ONE proposal via the Plan-03 service (honest 424 if no builder model resolves — never fabricated), and INSERT a `status='proposed'` row. Returns the locked response with `base_instructions` set and `gate=None`.
- **evals.py GET list / GET single / POST reject:** list is owner-scoped newest-first with bounded (`.in_`) base-instructions hydration; single owner-verifies on `id AND user_id AND skill_id` (404 not 403); reject copies `rate_eval_result`'s IDOR gate then does exactly ONE `.update(status='rejected')` — NO `skill_versions` INSERT, NO `skills` write (pure audit, D-10).
- **test_skill_proposals_router.py:** 3 hermetic router tests through the REAL FastAPI app with `propose` patched (AsyncMock, no live LLM) and the reused `_FilterSupabase` fake — owner-can-draft (asserts `gate` serialized as null), cross-user 404-not-403 for propose/get/reject with no IDOR write, and pure-audit reject (status flip only, no version/skills write).

## Task Commits

Each task committed atomically:

1. **Task 1: proposal models (PromotionGate + gate) + POST propose route** — `ce5143a7` (feat)
2. **Task 2: GET list/single + POST reject proposal routes** — `485dceef` (feat)
3. **Task 3: proposal router owner-scoping / cross-user 404 / pure-audit reject** — `ce2f5f87` (test)

## Files Created/Modified
- `backend/app/models/eval_run.py` — added the 4 SI-01 proposal models (ProposeBody, ForcePromoteBody, PromotionGate, SkillProposalResponse with nullable gate + base_instructions) — the LOCKED loop response contract.
- `backend/app/api/evals.py` — added the 4 proposal routes + 3 helpers (`_read_base_instructions`, `_base_instructions_map`, `_proposal_response`) on the existing `/skills` router; imports the Plan-03 `skill_proposer_service`.
- `backend/tests/test_skill_proposals_router.py` — NEW: 3 owner-scoping / IDOR router tests (no live LLM/DB).

## Decisions Made
- **Nullable `created_at`/`updated_at`.** The response is assembled in-app (id minted app-side, mirroring `start_eval_run`'s `run_id`), so the timestamps come from the DB insert/update echo when present (always, in production) and are `None` only under the non-echoing test fake. Interface listed them as plain fields; nullable is the pragmatic resolution that keeps the route correct end-to-end.
- **D-04 blocks on `approved`+`re_evaling`, supersedes `proposed`.** The plan explicitly named block-on-`re_evaling`; I extended the block to `approved` too (both are genuinely in-flight — a re-eval is committed or imminent) so a new propose can never orphan Plan 05's approve->re-eval chain. A lingering `proposed` draft the user never acted on is superseded to `rejected` (one open proposal — D-04).
- **424 for the no-builder floor** (the plan offered 424/502) — a missing resolved builder model is a real Failed Dependency, surfaced honestly, never a fabricated proposal.
- **`user_id` omitted from the response** — the interface field list omits it (caller's own id; not part of the frontend contract).

## Deviations from Plan

### Auto-added / clarified (no behavior loss)

**1. [Rule 2 - Defensive] D-04 concurrency also blocks `approved` (not just `re_evaling`)**
- **Found during:** Task 1 (propose route concurrency policy)
- **Rationale:** An `approved` proposal is past the draft stage — Plan 05 approve creates the new version and kicks off the re-eval, transiting `approved`->`re_evaling`. Blocking a new propose against BOTH keeps the one-open-proposal invariant honest across that transition window. Superseding only `proposed` (a lingering draft) is unchanged.
- **Files:** `backend/app/api/evals.py` (`_INFLIGHT_PROPOSAL_STATUSES`)
- **Commit:** `ce5143a7`

**2. [Clarification] `created_at`/`updated_at` nullable on the response model**
- **Found during:** Task 1 (response construction under the hermetic test fake)
- **Rationale:** documented above — hydrated from the DB echo in production, `None` only under a non-echoing fake. No frontend impact (production always echoes real timestamps).
- **Files:** `backend/app/models/eval_run.py` (`SkillProposalResponse`)
- **Commit:** `ce5143a7`

## Issues Encountered
- **Worktree has no venv/.env** (same as Wave 1). Ran the MAIN checkout's venv Python (`C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe`) with `PYTHONPATH` pointed at the worktree backend so imports + pytest exercise the WORKTREE source (verified the resolved `evals.py` path is under the worktree). Copied the gitignored `backend/.env` into the worktree backend for the app-import env; `git check-ignore` confirmed it is ignored and it was never staged/committed (clean `git status`).

## Verification
- Task 1 import/route assertion prints `PROPOSE_ROUTE_OK` (models + gate + the 8 PromotionGate keys + a `proposals` route registered).
- Task 2 route assertion prints `ROUTES_OK` (both `/proposals` GET and `/reject` POST registered).
- `pytest tests/test_skill_proposals_router.py -x` — **3 passed**.
- Sibling eval-domain suite (`test_evals_router` + `test_eval_runner` + `test_skill_proposer` + `test_skill_proposals_router`) — **22 passed** (no regressions from the eval_run.py / evals.py changes).

## Known Stubs
None — the propose path calls the real Plan-03 proposer (patched only in tests); the `gate` field is intentionally `None` at this plan's stage (no re-eval has reconciled yet — Plan 05 computes/populates it, documented in the plan as the owned-but-not-yet-written D-13 field, NOT a stub).

## Threat Flags
None — no NEW security surface beyond the plan's threat register. All 4 proposal routes are owner-scoped (`.eq("user_id")`), the request bodies carry no owner/skill ids (T-135-02), and the reject IDOR gate copies the verified `rate_eval_result` pattern (T-135-01). T-135-01/-02/-06/-07 are all mitigated as planned and covered by `test_cross_user_404`.

## Next Phase Readiness
- Plan 05 (approval + promotion) can now import `ForcePromoteBody` + `PromotionGate` from `eval_run.py`, add its approve/force-promote routes on the same `/skills` router, and WRITE the `gate` field at reconcile-on-read (the response model already carries it — no serialization change needed).
- Plan 06 (frontend) has the LOCKED endpoint paths + `SkillProposalResponse` shape (incl. `base_instructions` for the diff and `gate` for the honest-counts render).
- The load-bearing `skill_instructions_override` re-eval seam is Plan 02's responsibility (independent of this control surface).

## Self-Check: PASSED
- FOUND: `backend/app/models/eval_run.py` (SkillProposalResponse + PromotionGate + ProposeBody + ForcePromoteBody)
- FOUND: `backend/app/api/evals.py` (4 proposal routes registered)
- FOUND: `backend/tests/test_skill_proposals_router.py`
- FOUND: commit `ce5143a7` (Task 1)
- FOUND: commit `485dceef` (Task 2)
- FOUND: commit `ce2f5f87` (Task 3)

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*
