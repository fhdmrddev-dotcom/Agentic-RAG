---
phase: 135-self-improvement-loop-si-01
verified: 2026-07-02T04:52:22Z
status: gaps_found
score: 2/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The user reviews the proposed diff and explicitly approves or rejects it; on approval a new immutable skill version is created, on rejection nothing changes (SI-01 — human always in the loop)."
    status: partial
    reason: "Approve DOES insert the source='self_improve' draft version correctly (verified live + by test), but the approve action itself has no recovery path when the re-eval launch fails after status is committed to 'approved'. Confirmed live in both files: backend/app/api/evals.py commits status='approved' (step 7) BEFORE calling _launch_reeval (step 8) with no try/except; reconcile_proposal's early-return `if proposal.get('status') != 're_evaling': return proposal` means an 'approved' row is never self-healed. The frontend confirms the dead end: SkillEvalSection.tsx only renders Approve/Reject buttons when status === 'proposed' (line 663) and renders ONLY a spinner with no action for status 'approved' or 're_evaling' (line 685) — reject is not offered. A launch failure is easily reachable (the SAME eval_inflight:{skill_id} Redis claim as start_eval_run, so approving while any normal eval is running for the skill 409s from inside the launch after 'approved' is already committed), permanently locking the skill's improvement loop with zero UI escape. This breaks the 'human always in the loop' guarantee — the human has no action available."
    artifacts:
      - path: "backend/app/api/evals.py"
        issue: "approve_skill_proposal (~line 1536-1568): status='approved' committed before _launch_reeval; no except-and-revert. reconcile_proposal (~line 1155) only acts on status=='re_evaling', leaving 'approved' un-healable despite its own docstring claiming otherwise."
      - path: "frontend/src/components/skills/SkillEvalSection.tsx"
        issue: "Lines 663-690: only 'proposed' renders Approve/Reject; 'approved'/'re_evaling' render only a spinner with no action button — no way for the user to escape a wedged 'approved' proposal."
    missing:
      - "Revert the proposal to 'proposed' (or another actionable status) in an except block around _launch_reeval in approve_skill_proposal, per REVIEW.md CR-03's suggested fix."
      - "Have reconcile_proposal self-heal a stale 'approved' row with no re_eval_run_id past a grace period, matching its own docstring's claim."
      - "Frontend: an escape action (at minimum a Reject/retry) for the 'approved' status, not just a spinner."
  - truth: "An approved new version is automatically re-evaled and the result gates promotion — a version that fails re-eval is surfaced as not-promoted with honest evidence (SI-01 auto-re-eval gate)."
    status: failed
    reason: "reconcile_proposal's 'running' branch (backend/app/api/evals.py:1208-1219, confirmed live) decides orphan-vs-alive purely by `run_key not in RUN_TASKS`, a per-process in-memory dict. CLAUDE.md documents WORKER_COUNT=2 (multi-worker uvicorn) as the project DEFAULT. Under that default, a GET/reconcile that lands on a different worker than the one that spawned the re-eval task sees the run absent from ITS RUN_TASKS and persists status='interrupted' for a genuinely healthy in-flight re-eval — even though this same file already documents elsewhere that a per-process set is defeated by multi-worker. When the run later completes, the done-callback reconcile no-ops (status != 're_evaling' -> returned unchanged), so the gate is NEVER applied and a passing draft is never promoted; the user sees a false 'Interrupted' and the rerun affordance re-spends a full paid re-eval. This directly breaks the roadmap SC#3 promise ('the result gates promotion') under the project's own documented default runtime configuration, not merely a rare edge case."
    artifacts:
      - path: "backend/app/api/evals.py"
        issue: "Lines 1208-1219: orphan check uses only local-process RUN_TASKS membership, no cross-worker liveness signal (e.g. the eval_inflight:{skill_id} Redis claim or runs:active ZSET, both already used elsewhere in this file)."
    missing:
      - "Cross-worker liveness check in the 'running' orphan branch — e.g. check the Redis eval_inflight:{skill_id} claim value or runs:active membership before declaring a running re-eval orphaned, per REVIEW.md CR-02's suggested fix."
      - "A test for the reconcile 'running' branch (REVIEW.md IN-05 notes it currently has zero coverage — the exact code path carrying this bug)."
  - truth: "A failed gate surfaces status='not_promoted' with the honest gate counts on the response and is force-promotable with override_forced=true recorded (D-06)."
    status: failed
    reason: "Confirmed live: backend/app/api/evals.py:1749 declares `body: ForcePromoteBody` with NO default, which FastAPI treats as a required request body even though the model has zero fields. frontend/src/lib/api.ts's forcePromoteProposal (line 1836) sends `{ method: 'POST', headers }` with no body at all. Per REVIEW.md CR-01 this was verified against a live FastAPI probe: a body-less POST returns 422 `{'detail':[{'type':'missing','loc':['body'],'msg':'Field required'}]}`; only an explicit `{}` payload succeeds. The 'Force promote anyway' button rendered in SkillEvalSection.tsx (line 715-717, confirmed live) therefore fails on every click — the D-06 human-override escape hatch for a failed gate is completely non-functional from the shipped UI. This slipped past tests because test_skill_proposals.py calls the route function directly with ForcePromoteBody() and test_skill_proposals_router.py never exercises force-promote over HTTP."
    artifacts:
      - path: "backend/app/api/evals.py"
        issue: "Line 1749: `body: ForcePromoteBody` has no default, making an empty JSON body mandatory."
      - path: "frontend/src/lib/api.ts"
        issue: "forcePromoteProposal (~line 1836) sends no request body, so it always 422s against the current backend route."
    missing:
      - "Make the backend body optional: `body: ForcePromoteBody | None = None`, OR"
      - "Make the frontend send an explicit empty JSON body: `body: JSON.stringify({})`."
      - "An HTTP-level force-promote test in test_skill_proposals_router.py so the wire contract is covered (currently untested at the router/HTTP layer)."
deferred: []
human_verification:
  - test: "Run the SC#10 4-axis UAT rows U1-U11 authored in 135-VALIDATION.md live: propose -> review diff -> approve -> auto re-eval -> promote/not-promote, on at least OpenAI + Anthropic + Google source runs, plus the multi-tool (U5), parallel-thread (U6), long-message (U7), interrupted (U9), and failed-gate+override (U10) scenarios."
    expected: "The full loop holds cross-provider with no shared-path fork; U9 (interrupted) and U10 (force-promote) behave honestly. NOTE: U10 will currently fail at the force-promote click (CR-01 above) and U9's honest-interrupted claim is unreliable under WORKER_COUNT=2 (CR-02 above) — both should be fixed before this UAT is expected to pass."
    why_human: "D-15 mandates live cross-provider UAT; VALIDATION.md itself marks 'SC#10 4-axis UAT (U1-U11) executed live before phase close (D-15) — pending /gsd:verify-work' as unchecked, and this has not been run (confirmed by the task context: 'live cross-provider UAT has NOT been run yet')."
  - test: "Confirm WR-02 (135-REVIEW.md) does not affect the live proposer flow: propose an improvement, rename the skill, then approve — check whether the re-eval's WITH arm measures the draft or silently reverts to the live (renamed) instructions."
    expected: "The re-eval should measure the DRAFT regardless of an intervening rename."
    why_human: "The override map is keyed only on the live skill name at approve time (`skill.get('name')`) while the WITH-arm catalog injects the draft version's name; a rename between propose/approve is a live-state race that automated tests using fixed names cannot easily reproduce — this is exactly the 'silent no-op gate' failure mode Pitfall #1 targets."
---

# Phase 135: Self-Improvement Loop (SI-01) Verification Report

**Phase Goal:** The system closes the loop — it proposes instruction-body edits from eval results + Tuner signal, the user reviews the diff and approves, a new immutable version is created and automatically re-evaled before promotion; the system never auto-applies.
**Verified:** 2026-07-02T04:52:22Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | From an eval result + Tuner signal, the system proposes a concrete instruction-body edit as a reviewable diff — it never edits the live skill and never auto-applies (roadmap SC#1) | VERIFIED | `skill_proposer_service.propose()` forces one `SkillProposal` emission via `resolve_skill_builder_model` + `forced_emit`; `assemble_evidence` joins `skill_test_cases` for prompt/expected (verified: `test_bundle_includes_prompt_and_expected` passes), places judge-PASS×human-DOWN disagreements first (`test_disagreement_is_top_cue` passes), returns honest `None` on no builder model (`test_honest_none_when_no_builder_model` passes). `POST /skills/{id}/proposals` only INSERTs `skill_proposals` (status='proposed') — no `skills` write anywhere in the propose path (grep confirms). 4/4 `test_skill_proposer.py` tests pass live. |
| 2 | The user reviews the proposed diff and explicitly approves or rejects it; on approval a new immutable skill version is created, on rejection nothing changes (SI-01 — human always in the loop) | FAILED | Version creation + reject-as-pure-audit both work and are tested. BUT approve has no recovery path when `_launch_reeval` fails after `status='approved'` is committed — confirmed live in `evals.py` (no except/revert) and in `SkillEvalSection.tsx` (no action button for `approved`, only a spinner). See gap 1 (CR-03). |
| 3 | An approved new version is automatically re-evaled and the result gates promotion — a version that fails re-eval is surfaced as not-promoted with honest evidence (SI-01 auto-re-eval gate) | FAILED | `reconcile_proposal`'s orphan check for a `running` re-eval uses only the per-process `RUN_TASKS` dict (confirmed live at `evals.py:1208-1219`), which the project's own documented default (`WORKER_COUNT=2`, multi-worker uvicorn) defeats — a healthy in-flight re-eval landing a GET on the other worker gets falsely persisted `interrupted`, and the gate never applies. See gap 2 (CR-02). |
| 4 | A failed gate surfaces `not_promoted` with honest counts and is force-promotable with `override_forced=true` recorded (D-06, Plan 04/05 must-have tied to SC#3's human-override contract) | FAILED | `force_promote_skill_proposal` requires a non-optional `ForcePromoteBody`; the frontend `forcePromoteProposal` sends no body — confirmed by direct code read at both sites; REVIEW.md verified this 422s against a live FastAPI probe. The "Force promote anyway" button (rendered live in the `not_promoted` branch) is non-functional. See gap 3 (CR-01). |
| 5 | The proposer + re-eval behavior holds across providers (reuses the existing gateway; SC#10) with no shared-path fork | UNCERTAIN | Structural evidence is strong: additive default-off `skill_instructions_override` seam verified at all wiring sites (both `agent_loop.py` ToolContext builds, `task_service.py` sub-agent copy, `eval_runner_service.run_eval_job`); `run_eval_job` itself is unmodified in logic, only an additive kwarg added; Deep-mode guard `test_deep_mode_unchanged` stays green. However the MANDATORY live 4-axis UAT (U1-U11, D-15) authored in `135-VALIDATION.md` has NOT been executed — its own sign-off checklist marks this item unchecked, and the task context confirms "live cross-provider UAT has NOT been run yet." Routed to human verification. |

**Score:** 2/5 truths fully verified (1 VERIFIED, 3 FAILED as BLOCKERS, 1 UNCERTAIN as WARNING/human-needed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/083_skill_proposals.sql` | Owner-scoped `skill_proposals` table, 7-value status CHECK, FKs, owner-only RLS SELECT, no write policies | VERIFIED | Confirmed via grep: `CREATE TABLE public.skill_proposals`, the exact 7-value CHECK, `FOR SELECT USING (auth.uid() = user_id)`, no `FOR INSERT/UPDATE/DELETE`. |
| Live local DB (`:54322`) | Migration 083 applied | VERIFIED | psycopg2 probe: table exists, 1 owner-only SELECT policy (`Users can view own skill proposals`), 6/6 sentinel columns present. |
| `supabase/full-schema.sql` | Regenerated, contains `skill_proposals` | VERIFIED | `grep -c skill_proposals` = 38 (well above the ≥1 threshold). |
| `backend/app/services/agent_loop.py` | `skill_instructions_override` field + unpack + both ToolContext builds (:2279-equiv primary, :1501-equiv resume) | VERIFIED | 4 occurrences: field def (:210), unpack (:1117), resume build (:1534), primary build (:2326). |
| `backend/app/services/tool_dispatcher.py` | `ToolContext` field + `_handle_load_skill` override branch | VERIFIED | Field def (:141) + override read/branch (:713). |
| `backend/app/services/task_service.py` | Sub-agent ctx carries `parent_ctx.skill_instructions_override` | VERIFIED | Line 644. |
| `backend/app/services/eval_runner_service.py` | `run_eval_job` additive param threaded to `_run_arm_body` | VERIFIED | Param at :380/:429/:596, forwarded at :408/:458/:661. |
| `backend/tests/test_load_skill_override.py` | Override-honored + None=>byte-identical guard tests | VERIFIED | Exists, part of the 23 passing phase tests. |
| `backend/app/services/skill_proposer_service.py` | Evidence bundle + forced-emission `propose()` | VERIFIED | `propose`, `assemble_evidence`, `SkillProposal` all present; 4/4 tests pass. |
| `backend/app/models/eval_run.py` | `ProposeBody` + `PromotionGate` + `SkillProposalResponse` (with nullable `gate`) + `ForcePromoteBody` | VERIFIED | Confirmed via import assertions in Plan 04's own verify command; `PromotionGate` has exactly the 8 D-13 keys. |
| `backend/app/api/evals.py` | POST propose/list/get/reject/approve/rerun/force-promote routes + `promotion_gate()` + `reconcile_proposal()` | VERIFIED (exists) / **WIRING GAPS** | All 6 route paths registered (confirmed via router introspection). Routes exist and function for the happy path (tests pass), but 3 Critical wiring/logic defects are live in this file — see gaps 1-3. |
| `backend/tests/test_promotion_gate.py`, `test_skill_proposals.py`, `test_skill_proposals_router.py` | D-13 gate math + lifecycle + owner-scoping tests | VERIFIED | All pass (9 + 5 + 9 = 23 tests across the phase's new test files, confirmed by direct pytest run). |
| `frontend/src/lib/lineDiff.ts` + `.test.ts` | Pure LCS unified line diff, no new dependency | VERIFIED | 7/7 vitest tests pass; `package.json`/`package-lock.json` unchanged. |
| `frontend/src/types/index.ts`, `frontend/src/lib/api.ts` | `SkillProposal` type (incl. `gate`) + full lifecycle api helpers | VERIFIED | All 7 helper names present; tsc clean on touched files. |
| `frontend/src/components/skills/SkillEvalSection.tsx` | Propose button + proposal card (diff, rationale, approve/reject/rerun/force-promote, gate counts, interrupted state) | VERIFIED (exists+wired) / **BEHAVIORAL GAP** | All helpers wired (`lineDiff`, `proposeImprovement`, `approveProposal`, `rejectProposal`, `rerunProposalReeval`, `forcePromoteProposal`); `renderGateCounts` called in both `promoted` and `not_promoted` branches (D-13 honored). BUT the `approved` status renders no action button (confirms gap 1) and the `not_promoted` "Force promote anyway" button calls a route that always 422s (confirms gap 3). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `agent_loop.py` RunContext | `tool_dispatcher.py` `_handle_load_skill` | additive kwarg at both build sites | WIRED | Both primary + resume builds pass the field; `getattr` duck-typed read; Deep-mode byte-identical guard green. |
| `task_service.py` sub-agent ctx | `tool_dispatcher.py` `_handle_load_skill` on sub_ctx | `parent_ctx.skill_instructions_override` copy | WIRED | Confirmed at task_service.py:644. |
| `eval_runner_service.run_eval_job` | RunContext build (WITH arm) | additive optional param | WIRED | Confirmed threaded through `_run_arm` -> `_run_arm_body`. |
| `evals.py POST propose` | `skill_proposer_service.propose` + `skill_proposals` INSERT | owner-verify -> evidence -> propose -> INSERT | WIRED | Route registered, source assertions pass, router tests green. |
| `evals.py POST approve` | `skill_versions` INSERT (`source='self_improve'`) + `_launch_reeval` | direct service-role INSERT + companion-run reuse | WIRED, but **UNSAFE ON FAILURE** | The version INSERT + status='approved' write succeed; if `_launch_reeval` then raises, the wiring produces a dead-end state (gap 1). |
| `evals.py reconcile_proposal` | `skills.instructions` UPDATE / status transitions / `gate` population | `promotion_gate()` -> promote/not_promoted/interrupted | WIRED, but **FALSE-POSITIVE UNDER MULTI-WORKER** | The promotion math itself is correct and tested; the orphan-detection input (`RUN_TASKS` only) is not cross-worker safe (gap 2). |
| `frontend forcePromoteProposal` | `evals.py force_promote_skill_proposal` | `POST .../force-promote` | **NOT WIRED (422)** | Confirmed live: required Pydantic body vs body-less fetch (gap 3). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SkillEvalSection.tsx` proposal card | `proposal` (state) | `listProposals`/`getProposal` (DB re-fetch, never optimistic) | Yes — hydrated from `skill_proposals` via the real routes | FLOWING |
| `SkillEvalSection.tsx` gate counts | `proposal.gate` | `_compute_gate` (recompute-on-read from two `eval_results` sets) | Yes — real DB query, not a static return | FLOWING |
| `SkillEvalSection.tsx` diff render | `lineDiff(base_instructions, proposed_instructions)` | `base_instructions` hydrated server-side from the base `skill_versions` row | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration 083 applied to live DB | psycopg2 probe (table + policies + sentinel columns) | table=1, 1 SELECT policy, 6/6 columns | PASS |
| Phase test suite green | `pytest tests/test_load_skill_override.py tests/test_skill_proposer.py tests/test_skill_proposals_router.py tests/test_promotion_gate.py tests/test_skill_proposals.py -q` | 23 passed | PASS |
| Broader regression (+ Deep-mode guard + eval runner) | `pytest ... tests/test_agent_loop_catalog_override.py tests/test_eval_runner.py -q` | 39 passed | PASS |
| lineDiff util | `npx vitest run src/lib/lineDiff.test.ts` | 7 passed | PASS |
| Touched-file tsc cleanliness | `npx tsc --noEmit \| grep -Ei "SkillEvalSection\|lib/api\|types/index\|lineDiff"` | no matches (exit 1 on grep = clean) | PASS |
| Force-promote route/body contract | direct source read of `evals.py:1749` + `api.ts` `forcePromoteProposal` | required body vs body-less fetch confirmed | **FAIL** (CR-01) |
| Reconcile orphan check cross-worker safety | direct source read of `evals.py:1208-1219` | uses only local-process `RUN_TASKS`, no Redis/cross-worker check | **FAIL** (CR-02) |
| Approve failure recovery | direct source read of `evals.py` approve flow + `SkillEvalSection.tsx` action-row rendering | status='approved' committed before launch, no except/revert; no frontend action for 'approved' | **FAIL** (CR-03) |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files declared or discovered for this phase (backend/frontend unit + router tests are the phase's automated verification surface; no probe-based migration/CLI harness applies here).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| SI-01 | 135-01..07 (all) | The system proposes instruction-body edits based on eval results + Tuner signal → user reviews the diff and approves → a new immutable skill version is created and auto-re-evaled before promotion — the human is always in the loop, the system never auto-applies. | **BLOCKED** | The propose/diff/approve/version-creation/never-auto-applies half is solidly delivered (Truth 1, 2-partial). The auto-re-eval-gates-promotion half and the human-override escape hatch are both broken under realistic conditions (Truths 3, 4 FAILED — CR-02, CR-03, CR-01). SC#10 cross-provider claim unverified live (Truth 5 UNCERTAIN). REQUIREMENTS.md still lists SI-01 as "Pending" — this verification confirms it is not yet ready to flip to Complete. |

No orphaned requirements — SI-01 is the only requirement ID mapped to Phase 135 in REQUIREMENTS.md, and it is declared in all 7 plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/evals.py` | 1749 | Required Pydantic body (`ForcePromoteBody`, no default) paired with a body-less frontend fetch | Blocker | Force-promote (D-06) 422s on every real click — CR-01 |
| `backend/app/api/evals.py` | 1208-1219 | Per-process `RUN_TASKS` used as the sole liveness signal in `reconcile_proposal`'s orphan check, under a documented multi-worker default | Blocker | False "interrupted" on healthy re-evals — CR-02 |
| `backend/app/api/evals.py` | 1536-1568 | `status='approved'` committed before `_launch_reeval`, no except/revert | Blocker | Permanently wedged proposal, no UI escape — CR-03 |
| `backend/app/api/evals.py` | 1369 | Override map keyed only on the LIVE skill name (`skill.get("name")`), not the draft/base version name the re-eval catalog actually injects | Warning | Silent no-op-gate risk if the skill is renamed between propose and approve (WR-02, REVIEW.md) — the exact failure mode Pitfall #1 was designed to close, not fully closed |
| `backend/app/api/evals.py` | multiple (`_mark_approved`, `_mark_reevaling`, reconcile `_persist`, `_mark_promoted`) | No compare-and-swap predicate on status-transition UPDATEs | Warning | Concurrent double-approve/double-promote races (WR-03, REVIEW.md) — not exercised by current tests |
| `frontend/src/lib/api.ts` | `proposalError` | Assumes `detail` is always a string; FastAPI 422s return an array | Warning | Renders `"[object Object]"` on validation errors — directly reachable today via CR-01 (WR-04, REVIEW.md) |
| `backend/app/api/evals.py` | 774-812 | Lingering `proposed` draft is superseded (rejected) BEFORE the new proposer call succeeds | Warning | A failed re-propose destroys the user's previous reviewable draft with nothing to replace it (WR-01, REVIEW.md) |

No `TBD`/`FIXME`/`XXX` debt markers found in any of the 19 files reviewed (grep across all touched services/routes/components returned zero matches).

### Human Verification Required

### 1. SC#10 4-axis live cross-provider UAT (U1-U11)

**Test:** Execute the manual UAT rows authored in `135-VALIDATION.md` (propose → diff → approve → auto re-eval → promote/not-promote on OpenAI, Anthropic, Google source runs; plus multi-tool U5, parallel-thread U6, long-message U7, interrupted U9, failed-gate+override U10, lived-experience U11).
**Expected:** The loop holds cross-provider with no shared-path fork. Note: U10 (force-promote) will currently fail at the button click (CR-01) and U9 (interrupted honesty) is unreliable under the project's WORKER_COUNT=2 default (CR-02) — both should be fixed first.
**Why human:** D-15 mandates live execution; VALIDATION.md's own sign-off checklist marks this unchecked, and it has not been run per the task's own status context.

### 2. WR-02 rename-between-propose-and-approve override-miss

**Test:** Propose an improvement, rename the skill, then approve; observe whether the re-eval's WITH arm measures the draft instructions or silently falls back to the live (renamed) instructions.
**Expected:** The draft should be measured regardless of an intervening rename.
**Why human:** This is a live-state race between two DB writes (rename vs. approve) with a narrow window; automated tests using fixed names don't exercise it, and it is exactly the "silent no-op gate" scenario Pitfall #1 was built to prevent.

### Gaps Summary

The propose → diff → approve → immutable-version-creation → never-auto-applies half of the loop (roadmap SC#1, most of SC#2) is genuinely solid: 39 backend tests pass (23 phase-specific + Deep-mode guard + eval-runner regression all green), 7/7 frontend lineDiff tests pass, tsc is clean on touched files, migration 083 is live-applied with the correct RLS/FK shape, and the `skill_instructions_override` seam is wired at every documented call site (both `agent_loop.py` ToolContext builds, the `task_service.py` sub-agent copy, and `eval_runner_service.run_eval_job`).

However, the code review (`135-REVIEW.md`, committed as the phase's LATEST commit with no fixes applied afterward — confirmed by `git log`) found, and this verification independently re-confirmed by direct source reading, three Critical defects that break the back half of the loop under realistic/default conditions:

1. **Force-promote (D-06) is completely non-functional from the shipped UI** — every click 422s (CR-01). This is the human's only override when a gate fails, and it doesn't work.
2. **The auto-re-eval gate (SC#3's core promise) is unreliable under the project's own documented default (`WORKER_COUNT=2`)** — a healthy in-flight re-eval can be falsely marked "interrupted" and the gate is silently never applied, even for a draft that would have passed (CR-02).
3. **Approve can permanently wedge a proposal with zero UI escape** if the re-eval launch fails after `status='approved'` is committed — an easily reachable state (e.g., approving while any normal eval is running for the same skill) that breaks the "human always in the loop" guarantee, since the human is left with no available action (CR-03).

All three were verified directly against the live codebase in this session (not merely trusted from REVIEW.md's narrative): the exact required-body-vs-bodyless-fetch mismatch, the exact `RUN_TASKS`-only orphan check, and the exact missing except/revert plus the frontend's spinner-only rendering for `approved` were each independently confirmed by reading the current source.

Additionally, the mandatory SC#10 4-axis live UAT (D-15) has not been executed, leaving the cross-provider claim (roadmap SC#4) unverified beyond structural/static evidence.

**Recommendation:** This phase should NOT be marked complete as-is. The three Critical fixes are scoped and already have concrete patches suggested in `135-REVIEW.md` (small, targeted changes — an optional Pydantic body, a Redis-liveness check in the orphan branch, and an except/revert around the launch). A short gap-closure plan addressing CR-01/02/03 (and ideally WR-02, the closest-to-Pitfall-#1 warning) followed by the live SC#10 UAT should be sufficient to close this out.

---

_Verified: 2026-07-02T04:52:22Z_
_Verifier: Claude (gsd-verifier)_
