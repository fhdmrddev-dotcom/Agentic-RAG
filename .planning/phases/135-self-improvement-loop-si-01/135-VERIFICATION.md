---
phase: 135-self-improvement-loop-si-01
verified: 2026-07-02T15:35:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "The user reviews the proposed diff and explicitly approves or rejects it; on approval a new immutable skill version is created, on rejection nothing changes (SI-01 — human always in the loop)."
    - "An approved new version is automatically re-evaled and the result gates promotion — a version that fails re-eval is surfaced as not-promoted with honest evidence (SI-01 auto-re-eval gate)."
    - "A failed gate surfaces status='not_promoted' with the honest gate counts on the response and is force-promotable with override_forced=true recorded (D-06)."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run the SC#10 4-axis UAT rows U1-U11 authored in 135-VALIDATION.md live: propose -> review diff -> approve -> auto re-eval -> promote/not-promote, on at least OpenAI + Anthropic + Google source runs, plus the multi-tool (U5), parallel-thread (U6), long-message (U7), interrupted (U9), and failed-gate+override (U10) scenarios."
    expected: "The full loop holds cross-provider with no shared-path fork. U9 (interrupted) and U10 (force-promote) should now behave honestly given CR-01/CR-02 are code- and test-verified fixed in this re-verification pass — live confirmation is the remaining gate."
    why_human: "D-15 mandates live cross-provider UAT; VALIDATION.md's own sign-off checklist still marks 'SC#10 4-axis UAT (U1-U11) executed live before phase close (D-15) — pending /gsd:verify-work' as unchecked, and no evidence in this codebase (logs, LangSmith runs, or a completed UAT doc) shows it has been run since the gap-closure commits landed."
---

# Phase 135: Self-Improvement Loop (SI-01) Verification Report

**Phase Goal:** The system closes the loop — it proposes instruction-body edits from eval results + Tuner signal, the user reviews the diff and approves, a new immutable version is created and automatically re-evaled before promotion; the system never auto-applies.
**Verified:** 2026-07-02T15:35:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 135-08 backend + 135-09 frontend, commits `36bdbf60`, `959ab873`, `13d718dc`, `d4a06223`, `14347160`, merged via `bfc3f25e` + `b70dbe2b` onto `develop`)

## What Changed Since the Prior Verification

The 2026-07-02T04:52:22Z verification (score 2/5, `gaps_found`) identified three BLOCKER defects (CR-01, CR-02, CR-03) and one Warning (WR-02) in `backend/app/api/evals.py` / `frontend/src/components/skills/SkillEvalSection.tsx` / `frontend/src/lib/api.ts`. Gap-closure plans 135-08 (backend) and 135-09 (frontend) executed later the same day and are now merged to `develop` (current branch, confirmed via `git log`/`git branch --show-current`). This re-verification re-read the live source at every previously-cited line, re-ran the full backend test suite fresh in this session (not trusted from SUMMARY.md), and independently confirmed the DB migration and frontend type-check — all three BLOCKERs are now closed with direct code + test evidence.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | From an eval result + Tuner signal, the system proposes a concrete instruction-body edit as a reviewable diff — it never edits the live skill and never auto-applies (SI-01 SC#1) | VERIFIED (unchanged) | `skill_proposer_service.propose()` unchanged since prior verification; `POST /skills/{id}/proposals` only INSERTs `skill_proposals`; no `skills` write in the propose path. `test_skill_proposer.py` untouched by this gap wave, still green (part of the 43-test broad regression run below). |
| 2 | The user reviews the proposed diff and explicitly approves or rejects it; on approval a new immutable skill version is created, on rejection nothing changes (SI-01 — human always in the loop) | **VERIFIED (was FAILED)** | Backend: `approve_skill_proposal` (evals.py:1620-1647) now wraps `_launch_reeval` in try/except; on failure it CAS-guard reverts (`.eq("status","approved")`) to `status='proposed'`, unlinks `new_skill_version_id`, and re-raises — confirmed by direct source read. `reconcile_proposal` (evals.py:1185-1197) self-heals a stale `approved` row (no `re_eval_run_id`, `updated_at` past `_APPROVED_STALE_GRACE_S=120`) to `interrupted`, reachable via extended reconcile triggers on both `list_skill_proposals` (:900) and `get_skill_proposal` (:965) which now fire on `("re_evaling","approved")`. Frontend: `SkillEvalSection.tsx` (:697-715) now renders a dedicated `approved` branch with a Reject button wired to `handleReject`, distinct from the spinner-only `re_evaling` branch (:685-690). Locked by 4 new backend tests, all green: `test_approve_reverts_on_launch_failure`, `test_reconcile_self_heals_stale_approved` (both stale + fresh cases). |
| 3 | An approved new version is automatically re-evaled and the result gates promotion — a version that fails re-eval is surfaced as not-promoted with honest evidence (SI-01 auto-re-eval gate) | **VERIFIED (was FAILED)** | `reconcile_proposal`'s `running` branch (evals.py:1249-1269) now reads the shared `eval_inflight:{skill_id}` Redis claim (`_inflight_key`) and only marks `interrupted` when BOTH the task is absent from local `RUN_TASKS` AND the claim value no longer names `str(re_eval_run_id)` — confirmed by direct source read (`isinstance(claim, bytes)` decode + value-compare, not presence-only). `test_reconcile_running_cross_worker` (new) exercises exactly the cross-worker case with `RUN_TASKS` empty in both branches: claim-present -> stays `re_evaling`; claim-absent -> `interrupted`. Green. |
| 4 | A failed gate surfaces `not_promoted` with honest gate counts and is force-promotable with `override_forced=true` recorded (D-06) | **VERIFIED (was FAILED)** | Backend: `force_promote_skill_proposal`'s `body` parameter is now `ForcePromoteBody \| None = None` (evals.py:1828), confirmed by direct source read — a body-less POST no longer 422s. Frontend: `forcePromoteProposal` (api.ts:1839-1853) now sends `body: JSON.stringify({})` (belt-and-suspenders per REVIEW.md). New router-level test `test_force_promote_over_http` POSTs with **no `json=` argument** (the exact shape the shipped frontend originally sent) against the real FastAPI app via `httpx.AsyncClient` + `ASGITransport`, and asserts `resp.status_code == 200` (explicitly not 422), `override_forced is True`, `status == "promoted"`, the live `skills.instructions` write landed, and the FAILED gate counts are still attached. Run fresh in this session — passed. |
| 5 | The proposer + re-eval behavior holds across providers (reuses the existing gateway; SC#10) with no shared-path fork | UNCERTAIN — routed to human verification (unchanged) | No provider-specific code was touched by the gap-closure plans (confirmed: all edits are in the shared `evals.py`/`api.ts`/`SkillEvalSection.tsx` proposal path; `eval_runner_service.run_eval_job` and the provider gateway are untouched). Structural evidence remains strong (unchanged from prior pass). The MANDATORY live SC#10 4-axis UAT (U1-U11, D-15) is still marked unchecked in `135-VALIDATION.md`'s own sign-off checklist, and no evidence (logs, LangSmith, or a completed UAT doc) shows it has run since the gap-closure commits landed. Routed to human verification — this is the ONLY remaining item blocking `passed`. |

**Score:** 4/5 truths fully verified (up from 2/5), 1 routed to human verification (unchanged from prior pass — no regression).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/evals.py` | `ForcePromoteBody \| None = None`, cross-worker Redis-claim liveness in reconcile, approve except/revert, reconcile stale-`approved` self-heal, override map keyed on draft version name | VERIFIED | All five present, confirmed by direct source read at every cited line (:82 `_APPROVED_STALE_GRACE_S`, :91 `_approved_is_stale`, :1185-1197 self-heal, :1266-1268 claim check, :1424-1428 override map, :1620-1647 approve revert, :1828 optional body). |
| `backend/tests/test_skill_proposals_router.py` | HTTP-level body-less force-promote wire-contract test | VERIFIED | `test_force_promote_over_http` (line 249) exists, POSTs with no `json=`, asserts 200 + `override_forced` + live write + gate. Passed fresh in this session. |
| `backend/tests/test_skill_proposals.py` | Reconcile running-branch cross-worker test + approve launch-failure revert test + stale-approved self-heal test | VERIFIED | `test_reconcile_running_cross_worker` (:312), `test_approve_reverts_on_launch_failure` (:343), `test_reconcile_self_heals_stale_approved` (:375) — all exist, all substantive (drive real route functions over the `_FilterSupabase` fake, assert on persisted store state, not just return values), all pass fresh in this session. |
| `frontend/src/lib/api.ts` | `forcePromoteProposal` sends `JSON.stringify({})`; `proposalError` string-guards `detail` | VERIFIED | :1849 `body: JSON.stringify({})`; :1745-1746 `{ detail?: unknown }` + `typeof j?.detail === "string"` guard. `npx tsc --noEmit` clean on this file. |
| `frontend/src/components/skills/SkillEvalSection.tsx` | Dedicated `approved` branch with a Reject escape, distinct from `re_evaling` spinner-only | VERIFIED | :697-715 renders spinner text + a Reject button (`onClick={() => void handleReject()}`); :685-690 `re_evaling` retains spinner-only (no regression). `npx tsc --noEmit` clean on this file. |
| Live local DB (`:54322`) | Migration 083 applied (`skill_proposals` table + RLS) | VERIFIED | Independent psycopg2 probe this session: table exists (count=1), 1 owner-only SELECT RLS policy (`Users can view own skill proposals`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `frontend forcePromoteProposal` | `evals.py force_promote_skill_proposal` | `POST .../force-promote` with `body: JSON.stringify({})` matched against `body: ForcePromoteBody \| None = None` | **WIRED (was NOT_WIRED — 422)** | Confirmed by both source read and a fresh HTTP-level test (`test_force_promote_over_http`) exercising the exact body-less shape the shipped frontend originally sent — 200, not 422. |
| `evals.py reconcile_proposal` running branch | `eval_inflight:{skill_id}` Redis claim | `redis.get(_inflight_key(proposal["skill_id"]))` compared to `str(re_eval_run_id)` | **WIRED (was FALSE-POSITIVE under multi-worker)** | Confirmed by source read + `test_reconcile_running_cross_worker` (claim-present -> stays `re_evaling`; claim-absent -> `interrupted`, `RUN_TASKS` empty in both — the multi-worker "other worker" condition). |
| `evals.py approve_skill_proposal` step 8 | `status='proposed'` revert | try/except around `_launch_reeval` + CAS `.eq("status","approved")` UPDATE, re-raise | **WIRED (was UNSAFE ON FAILURE)** | Confirmed by source read + `test_approve_reverts_on_launch_failure` (HTTPException from `_launch_reeval` -> proposal reverts to `proposed`, draft unlinked, original exception re-raised). |
| `evals.py _launch_reeval` override map | draft version name | `skill_instructions_override` keyed on the set of `{skill.get("name"), draft_version.get("name")}` | **WIRED (was single-key, rename-vulnerable)** | Confirmed by source read (:1424-1428) and cross-checked against `eval_runner_service.py`'s WITH-arm catalog (:627-632, injects `skill_version["name"]` = the draft's name) and `tool_dispatcher.py`'s `_handle_load_skill` lookup (:713, keyed on that same catalog name) — the override map now deterministically contains the exact name the catalog injects regardless of an intervening rename. No dedicated automated test for the rename race (not required by the gap-closure plan's must-haves); folded into the U5 UAT row per `135-VALIDATION.md` line 105 ("U5 doubles as live proof of the Pitfall #1 fix"). |
| `evals.py reconcile_proposal` early-return | stale `approved` self-heal | `_approved_is_stale(updated_at)` -> `interrupted` via the shared `_persist` path | **WIRED (new)** | Confirmed by source read (:1185-1197, :91-103) + `test_reconcile_self_heals_stale_approved` (stale Z-suffix `updated_at` past grace -> `interrupted`; fresh `updated_at` within grace -> stays `approved`, not clobbered). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SkillEvalSection.tsx` proposal card (`approved` branch) | `proposal.status` | `listProposals`/`getProposal` (DB re-fetch, never optimistic) — now reconciled on read for `approved` too | Yes — hydrated from `skill_proposals` via the real reconcile-extended routes | FLOWING |
| `evals.py force_promote_skill_proposal` response | `override_forced`, `status`, `gate` | Real `skills.instructions` UPDATE + `_compute_gate` recompute-on-read | Yes — confirmed by `test_force_promote_over_http` asserting the live `skills` row's `instructions` changed | FLOWING |
| `evals.py reconcile_proposal` running branch | `new_status` | Real `redis.get()` claim read (not a static/mocked always-true value) | Yes — `_ClaimRedis` test fake exercises both the present and absent cases distinctly | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration 083 applied to live DB | fresh psycopg2 probe (table + policy) this session | table=1, 1 SELECT policy | PASS |
| Phase test suite (proposals + router) green | `backend/venv/Scripts/python.exe -m pytest backend/tests/test_skill_proposals.py backend/tests/test_skill_proposals_router.py -q --tb=short` | 12 passed | PASS |
| Broader phase regression (incl. promotion gate, override seam, eval runner) | `pytest tests/test_load_skill_override.py tests/test_skill_proposer.py tests/test_skill_proposals_router.py tests/test_promotion_gate.py tests/test_skill_proposals.py tests/test_agent_loop_catalog_override.py tests/test_eval_runner.py -q` | 43 passed | PASS |
| lineDiff util | `npx vitest run src/lib/lineDiff.test.ts` | 7 passed | PASS |
| Touched-file tsc cleanliness | `npx tsc --noEmit \| grep -Ei "SkillEvalSection\|lib/api\|types/index\|lineDiff"` | no matches | PASS |
| Force-promote route/body contract (CR-01) | `test_force_promote_over_http` (fresh HTTP-level, no json= arg) | 200, `override_forced=true`, live write confirmed | PASS (was FAIL) |
| Reconcile orphan check cross-worker safety (CR-02) | `test_reconcile_running_cross_worker` (fresh) | claim-present stays `re_evaling`; claim-absent -> `interrupted` | PASS (was FAIL) |
| Approve failure recovery (CR-03) | `test_approve_reverts_on_launch_failure` + `test_reconcile_self_heals_stale_approved` (fresh) | reverts to `proposed` on launch failure; stale `approved` self-heals; fresh `approved` untouched | PASS (was FAIL) |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files declared or discovered for this phase (unchanged from prior pass; backend/frontend unit + router/HTTP-level tests are the phase's automated verification surface).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| SI-01 | 135-01..09 (all, incl. gap-closure 08/09) | The system proposes instruction-body edits based on eval results + Tuner signal → user reviews the diff and approves → a new immutable skill version is created and auto-re-evaled before promotion — the human is always in the loop, the system never auto-applies. | **SATISFIED** (structurally + by automated test; live cross-provider confirmation pending) | All 4 of the truths that map to concrete backend/frontend behavior (Truths 1-4) are now VERIFIED with direct code reads and fresh, passing, substantive automated tests. The only remaining gap is Truth 5 — live SC#10 cross-provider UAT — which is a human-verification item, not a code defect. `.planning/REQUIREMENTS.md` still lists SI-01 as "Pending" (line 76); that flag is orchestrator-owned and expected to flip after the SC#10 UAT closes, per this phase's own workflow — not evidence of an unresolved code gap. |

No orphaned requirements — SI-01 is the only requirement ID mapped to Phase 135 in REQUIREMENTS.md, declared in all 9 plans' frontmatter (including both gap-closure plans).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/evals.py` | `_mark_approved`, `_mark_reevaling` (both call sites), `_mark_promoted` | No compare-and-swap predicate on these specific status-transition UPDATEs (only the NEW revert-on-failure UPDATE added in this gap wave carries a `.eq("status","approved")` CAS) | Warning (unchanged from prior pass — WR-03, not in gap-closure scope) | Concurrent double-approve/double-promote races remain theoretically possible; not exercised by current tests; explicitly out of scope for the 135-08/09 gap-closure plans (their threat models call this "WR-03-adjacent hardening on the touched path", not a full fix). Does not block phase goal achievement — SI-01's core promise (human-in-the-loop, never-auto-applies, honest gating) does not depend on concurrent-request hardening. |

No `TBD`/`FIXME`/`XXX` debt markers found in any of the 5 gap-closure-touched files (`evals.py`, `api.ts`, `SkillEvalSection.tsx`, `test_skill_proposals.py`, `test_skill_proposals_router.py`) — confirmed by direct grep this session.

### Human Verification Required

### 1. SC#10 4-axis live cross-provider UAT (U1-U11)

**Test:** Execute the manual UAT rows authored in `135-VALIDATION.md` (propose → diff → approve → auto re-eval → promote/not-promote on OpenAI, Anthropic, Google source runs; plus multi-tool U5 — which also doubles as live proof of the WR-02 rename fix — parallel-thread U6, long-message U7, interrupted U9, failed-gate+override U10, lived-experience U11).
**Expected:** The loop holds cross-provider with no shared-path fork. U9 (interrupted honesty under multi-worker) and U10 (force-promote button) should now pass live, since CR-02 and CR-01 are code- and test-verified fixed in this re-verification pass (both were previously expected to fail this exact UAT).
**Why human:** D-15 mandates live execution; `135-VALIDATION.md`'s own sign-off checklist still marks this unchecked, and no evidence (logs, LangSmith runs, or a completed UAT doc) in this codebase shows it has been run since the gap-closure commits (`36bdbf60`, `959ab873`, `13d718dc`, `d4a06223`, `14347160`) landed.

### Gaps Summary

All three BLOCKER gaps from the prior verification are closed with direct evidence gathered fresh in this session (not trusted from SUMMARY.md claims):

1. **CR-01 (force-promote 422)** — closed. Backend body is now optional; frontend sends an explicit empty body (belt-and-suspenders); a new HTTP-level test proves the exact body-less request the shipped frontend originally sent now returns 200 with `override_forced=true`.
2. **CR-02 (false "interrupted" under multi-worker)** — closed. `reconcile_proposal`'s `running` branch now cross-checks the shared Redis `eval_inflight:{skill_id}` claim value before declaring an orphan; a new test exercises both the claim-present (stays `re_evaling`) and claim-absent (`interrupted`) cases with `RUN_TASKS` empty in both, modeling the genuine multi-worker condition.
3. **CR-03 (wedged `approved` with no UI escape)** — closed on both halves. Backend: a launch failure now CAS-reverts the proposal to `proposed`; a stale `approved` row self-heals to `interrupted` on read. Frontend: the `approved` status now renders a Reject escape button, not just a spinner. Four tests lock this (two backend behavioral, plus the frontend source assertions + clean `tsc`).

The WR-02 override-map warning (silent no-op gate on a rename between propose and approve) is also closed by source-code proof: the override map is now keyed on the draft version's name, which is exactly the name the WITH-arm catalog injects and `_handle_load_skill` looks up — this is a deterministic fix, not merely a race mitigation, so it no longer needs a separate live confirmation (folded into the existing U5 UAT row).

The WR-04 warning (`"[object Object]"` on FastAPI 422 errors) is also closed — `proposalError` now string-guards the `detail` field.

**The only remaining item is Truth 5 / SC#10** — the mandatory live cross-provider 4-axis UAT (U1-U11) has still not been executed, per `135-VALIDATION.md`'s own unchecked sign-off line. This is unchanged from the prior verification (not a regression) and is exactly the kind of item that requires a human/live browser, not a code check — it is routed to human verification, not reported as a failed truth.

**Recommendation:** Run the SC#10 4-axis UAT (`135-VALIDATION.md` U1-U11) live, focusing extra attention on U9 (interrupted, now cross-worker-safe) and U10 (force-promote, now body-optional) since those are the two rows the prior verification explicitly predicted would fail and that this pass's code/test evidence says should now succeed. Once that UAT is signed off, the phase is ready for `/gsd:secure-phase 135` (still owed — no `135-SECURITY.md` exists yet) and then completion.

---

_Verified: 2026-07-02T15:35:00Z_
_Verifier: Claude (gsd-verifier)_
