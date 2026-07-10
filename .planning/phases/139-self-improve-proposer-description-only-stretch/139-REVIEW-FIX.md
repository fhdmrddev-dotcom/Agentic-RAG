---
phase: 139-self-improve-proposer-description-only-stretch
fixed_at: 2026-07-06T15:59:19Z
review_path: .planning/phases/139-self-improve-proposer-description-only-stretch/139-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 139: Code Review Fix Report

**Fixed at:** 2026-07-06T15:59:19Z
**Source review:** .planning/phases/139-self-improve-proposer-description-only-stretch/139-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical + 6 Warnings; fix_scope=critical_warning — the 6 Info findings were not attempted)
- Fixed: 7
- Skipped: 0

All fixes were applied in an isolated git worktree on a temp branch and fast-forwarded onto `develop` (`d2760b08` → `59f5ba44`). Locked phase decisions respected: propose/approve/reject stay synchronous, reject stays a pure audit flip, approve still writes `skills.description` once (079/132 trigger cuts the version), owner-scoping stays 404-not-403, and `backend/app/api/threads.py` / the agent loop were NOT touched (D-13 red line).

## Fixed Issues

### CR-01: SI-01 proposal routes are kind-blind — description proposals leak into the Studio Evals tab

**Files modified:** `backend/app/api/evals.py`, `backend/tests/test_skill_proposals.py`, `backend/tests/test_skill_proposals_router.py`
**Commit:** dc699455
**Applied fix:** Kind-scoped every SI-01 read/write on the shared `skill_proposals` table: `list_skill_proposals._read`, `get_skill_proposal._read`, the SI-01 propose step-5 `_read_open` + `_supersede` (a pending description proposal can no longer be auto-rejected by drafting an instruction proposal), the SI-01 reject `_verify` + `_reject`, and the SI-01 approve `_read_proposal` — all now filter `.eq("kind", "instruction")` (wrong-kind → 404, "indistinguishable from absent", T-139-10 symmetry). `_proposal_response` now forwards the stored `kind` (defense-in-depth), and the SI-01 insert stamps `kind='instruction'` explicitly (matches migration 090's DEFAULT). Both SI-01 test-fake seeds were updated to carry `kind='instruction'`, mirroring the migrated schema (090 backfill).

### WR-01: SkillTunerPage never resets `runId`/`descProposal` on cancel, error, re-run, or skill switch

**Files modified:** `frontend/src/pages/SkillTunerPage.tsx`
**Commit:** 37f0e3cb
**Applied fix:** The `[skillId]` mount/switch effect now resets `runId`, `runPhase`, `lanes`, `runError`, `runBackgroundNote`, `descProposal`, `descError` (scoreboard/latestRun are left to the authoritative `getTunerLatest` reconcile). `cancelRun` and all four hard-error terminals (dead-run, durable-poll-failed, genuine error terminal, kickoff catch) now `setRunId(null)`, so `handleConfirmWinner` falls back to the durable `latestRun.run_id` — the id matching the scoreboard actually displayed (no more misleading stale-run 409). A fresh `startRun` dismisses the previous run's open review card (`setDescProposal(null)` + `setDescError(null)`).

### WR-02: Approve is blind last-write-wins — clobbers a post-propose manual edit / links a version it did not create

**Files modified:** `backend/app/api/evals.py`
**Commit:** f4789f84
**Applied fix:** `approve_description_proposal` now (a) hydrates the stored diff base and 409s when the LIVE `skills.description` (from `_verify_owned_skill`, one already-available read) no longer equals it — a manual edit since propose is never silently clobbered; (b) 409s the no-op case (live already equals the proposal) instead of fabricating a version link the 079/132 trigger never created (it fires only on `IS DISTINCT FROM` changes). The hydrated base is reused for the response (the base version row is immutable), dropping the redundant tail read.

### WR-03: Description reject has no status guard — a `promoted` proposal can be flipped to `rejected`

**Files modified:** `backend/app/api/evals.py`, `frontend/src/components/skills/studio/DescriptionProposalCard.tsx`, `frontend/src/components/skills/studio/DescriptionProposalCard.test.tsx`
**Commit:** daec8a8d
**Applied fix:** Backend: `reject_description_proposal` now 409s when the verified row's status is not `proposed` (mirrors approve's guard), and the update itself also filters `.eq("status", "proposed")` so a read-write race with a landing approve cannot corrupt a just-promoted row. Frontend: `DescriptionProposalCard` disables BOTH Approve and Reject while either mutation is in flight (a `busy` guard mirroring CandidateCard's `proposing`); the card's prop types now accept async handlers. Test 2 of the card suite was rewritten to lock the new contract (it previously asserted the racy Approve→Reject double-fire as correct): in-flight approve disables both buttons, the reject click is a no-op, and reject fires normally after settle.

### WR-04: Rehydration-on-open built but never wired — a durable `proposed` proposal is invisible after reload

**Files modified:** `frontend/src/pages/SkillTunerPage.tsx`, `frontend/src/pages/SkillTunerPage.test.tsx`
**Commit:** 8dc3e687
**Applied fix:** The `[skillId]` mount effect now calls `getLatestDescriptionProposal` (previously zero call sites) as its fourth authoritative fetch, seeding `descProposal` from the durable row (ignoring `rejected` rows; a read failure is non-fatal). After a reload the pending review card is visible and actionable WITHOUT re-proposing (which superseded the original to `rejected`). New test locks the contract: a durable `proposed` row mounts the review card with `proposeDescription` never called; the api-module test mock now exports `getLatestDescriptionProposal` (default `null`).

### WR-05: After approve, "current · live · drives firing" still shows the OLD description

**Files modified:** `frontend/src/pages/SkillTunerPage.tsx`, `frontend/src/pages/SkillTunerPage.test.tsx`
**Commit:** 59f5ba44
**Applied fix:** `handleApproveDescription` now calls `useSkills().loadSkills()` on success (reconcile-via-fetch — D-v2.5-03, the server already wrote the row), with its own non-fatal catch so a refetch failure never mislabels a successful approve as an error. The live-description header and the baseline "current description" label now reconcile on the same screen as the promoted card. The SI-02 flow test asserts the refetch (`listSkills` called a second time after approve).

### WR-06: Propose 500s (unhandled CHECK violation) when the winner candidate has no description

**Files modified:** `backend/app/api/evals.py`
**Commit:** 9aa95973
**Applied fix:** Added the honest 400 guard ("The tuner winner has no description to propose") between winner resolution and the INSERT, so a malformed/legacy durable scoreboard can no longer drive `proposed_description=None` into the `skill_proposals_kind_fields` CHECK (an unguarded PostgREST raise → opaque 500).

## Verification

Per-fix: every backend edit passed `ast.parse` + the affected pytest suites before commit; every frontend edit passed the project `tsc --noEmit` + the affected vitest suite before commit. Rollback was never needed.

**Final full-suite run (post all fixes, in the isolated worktree at `59f5ba44`):**

| Suite | Result |
|---|---|
| Backend: `tests/integration/test_139_description_proposals.py`, `tests/test_139_migration_090.py`, `tests/test_skill_proposals.py`, `tests/test_skill_proposals_router.py`, `tests/test_evals_router.py` | **33 passed** (includes the live-DB migration-090 gate against 127.0.0.1:54322) |
| Frontend: `src/components/skills/studio/**`, `src/components/skills/tuner/**`, `src/pages/SkillTunerPage.test.tsx` | **14 files / 123 tests passed** |
| Frontend: `npx tsc --noEmit -p tsconfig.app.json` | 29 errors — **identical to the pre-existing SEED-056 baseline**; zero errors in any phase-139 or fix-touched file, zero new errors |

**Human-verification notes for `/gsd:verify-work 139` (live UAT):**
- WR-01's cancel/error/skill-switch resets have no automated coverage of those exact paths (the suites pass, but the reset behavior itself is a live-UAT item: cancel a run → Propose should use the durable run and not 409; switch skills → no stale review card).
- WR-02's two new 409s (manual-edit staleness, no-op) are guard paths without dedicated tests (the review's IN-05 test-gap finding is Info-scope and was not attempted).
- CR-01's leak closure (a description proposal no longer appearing in the Studio Evals tab) is best confirmed live: Triggering tab → Propose → switch to Evals tab → no bogus all-red instruction diff.

---

_Fixed: 2026-07-06T15:59:19Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
