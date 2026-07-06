---
phase: 139-self-improve-proposer-description-only-stretch
reviewed: 2026-07-06T15:30:10Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - backend/app/api/evals.py
  - backend/app/models/eval_run.py
  - backend/tests/integration/test_139_description_proposals.py
  - backend/tests/test_139_migration_090.py
  - frontend/src/components/skills/studio/DescriptionProposalCard.test.tsx
  - frontend/src/components/skills/studio/DescriptionProposalCard.tsx
  - frontend/src/components/skills/studio/ProposalCard.test.tsx
  - frontend/src/components/skills/studio/VersionsTab.test.tsx
  - frontend/src/components/skills/tuner/CandidateCard.test.tsx
  - frontend/src/components/skills/tuner/CandidateCard.tsx
  - frontend/src/lib/api.ts
  - frontend/src/pages/SkillTunerPage.test.tsx
  - frontend/src/pages/SkillTunerPage.tsx
  - frontend/src/types/index.ts
  - supabase/full-schema.sql
  - supabase/migrations/090_skill_proposals_description_kind.sql
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: issues_found
---

# Phase 139: Code Review Report

**Reviewed:** 2026-07-06T15:30:10Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 139 (SI-02 description-only proposer) was reviewed against diff base `5c53c567`: four new backend routes in `evals.py`, the `ProposeDescriptionBody`/extended `SkillProposalResponse` contract, migration 090 + regenerated `full-schema.sql`, the migration live-DB gate test, the router integration tests, and the frontend propose→review→approve wiring (SkillTunerPage, CandidateCard, DescriptionProposalCard, api.ts, types).

The locked decisions are mostly honored and verifiable: propose reads the durable `tuner_runs` scoreboard (no LLM call, D-01), the baseline winner refuses with 400 (D-02), the scoreboard is snapshotted inline with the literal `{winner, baseline, run_id}` keys, approve writes `skills.description` once and reads back the trigger-captured version (D-04/D-07), reject is a kind-gated audit flip (D-05), every new supabase-py call is `run_in_threadpool`-wrapped, owner-scoping is 404-not-403, `user_id` never comes from the body, and the card renders text nodes only (T-139-14, proven by test 4). The tuner upsert omits `id`, so the new `source_tuner_run_id` FK survives latest-wins re-runs (verified against `skill_tuner.py:601-626`).

However, migration 090 changed the meaning of the SHARED `skill_proposals` table without updating the pre-existing SI-01 routes that read it — description rows now leak into the SI-01 surface mislabeled as instruction proposals (Critical). Several lifecycle edges around stale client state, approve/reject races, and rehydration are also broken.

## Critical Issues

### CR-01: SI-01 proposal routes are kind-blind — description proposals leak into the Studio Evals tab as bogus instruction proposals (and can be silently destroyed there)

**File:** `backend/app/api/evals.py:672-692` (`_proposal_response`), `:788-815` (SI-01 propose supersede), `:892-900` (`list_skill_proposals`), `:956-965` (`get_skill_proposal`), `:1009-1036` (SI-01 reject)
**Issue:** Migration 090 added the `kind` discriminator to the shared `skill_proposals` table, and the new `/description-proposals` routes are correctly kind-scoped — but the pre-existing SI-01 routes on the same table were left kind-blind. Three concrete consequences, all reachable in the normal shipped flow:

1. **Mislabeled leak.** `list_skill_proposals` and `get_skill_proposal` read `select("*")` with no kind filter and serialize via `_proposal_response`, which does NOT forward `kind` (or the description fields) — so `SkillProposalResponse.kind` falls back to its `"instruction"` default with `proposed_instructions=""`. The Studio Evals tab (`EvalsTab.tsx:342-345` → `pickActiveProposal`, which picks the newest non-rejected row with no kind filter; same in `SkillEvalSection.tsx:362-364`) will therefore surface a freshly-proposed description proposal as an *instruction* proposal whose diff renders the entire instruction body as deleted (`base_instructions` vs `""`) — a scary, wholly false all-red diff. Repro: Skill Studio → Triggering tab → "Propose this description" → switch to the Evals tab of the same Studio.
2. **Silent cross-kind destruction.** Clicking Reject on that bogus card hits the SI-01 reject route (no kind gate at `:1009-1036`) and flips the pending description proposal to `rejected` — the user's Tuner-side review silently vanishes. Likewise, `propose_skill_improvement` step 5 (`:788-815`) supersedes ALL open `proposed` rows kind-blind, so drafting an SI-01 instruction proposal auto-rejects a pending description proposal.
3. **Confusing dead-end approve.** Clicking Approve on the bogus card enters `approve_skill_proposal` (no kind gate at `:1919-1970`); it fails at `:2012-2016` with 400 "Source eval run provider/model unavailable — cannot re-eval" (description rows have `source_eval_run_id` NULL). No corruption, but a nonsense error for the user.

The reverse direction was gated (description reject 404s on an instruction row, description approve 409s), so this asymmetry is an implementation gap, not a design choice — T-139-10's intent ("a proposal can never be flipped through the wrong-kind route") is only half-enforced.
**Fix:**
```python
# 1. Scope every SI-01 read/supersede to its own kind:
#    list_skill_proposals._read / get_skill_proposal._read / propose step-5 _read_open:
        .eq("kind", "instruction")
# 2. Forward the stored kind in _proposal_response (defense-in-depth):
        kind=row.get("kind", "instruction") or "instruction",
# 3. Kind-gate the SI-01 reject + approve reads (mirror the description routes):
        .eq("kind", "instruction")   # in _verify / _read_proposal
```

## Warnings

### WR-01: SkillTunerPage never resets `runId`/`descProposal` on cancel, error, re-run, or skill switch — propose 409s and stale/wrong-skill proposal cards render

**File:** `frontend/src/pages/SkillTunerPage.tsx:145-146, 166-168, 277-449, 451-467, 476-482, 827-833`
**Issue:** Phase 139 gives two pieces of pre-existing state new, load-bearing consumers, without resetting them:
- `runId` now feeds `handleConfirmWinner` (`const proposeRunId = runId ?? latestRun?.run_id`). It is never cleared on `cancelRun`, on a run error, or on `skillId` switch (the `[skillId]` effect only aborts the stream). After canceling a run (durable scoreboard from the *previous* run still displayed), or after switching skills (old skill's `runId` retained), the Propose click sends a run_id that cannot match `tuner_runs.run_id` → the backend 409s with the misleading "The tuner has re-run since — review the latest result", even though `latestRun.run_id` would have been valid.
- `descProposal` is never cleared on `skillId` switch or on a fresh `startRun`. Skill A's proposal card (diff + Approve/Reject) renders inside skill B's results (approve then 404s server-side — safe but broken), and after a re-run the OLD run's proposal card stays mounted next to NEW candidates; approving applies the old winner while the user looks at fresh evidence — and the backend approve has no staleness gate, so it succeeds.
**Fix:** In the `[skillId]` effect (or a dedicated reset), null out `runId`, `descProposal`, `descError` (and lanes/runPhase) on skill switch; set `setRunId(null)` in `cancelRun` and on the hard-error terminal; call `setDescProposal(null)` at the top of `startRun`. Alternatively derive the propose run-id from the run that produced the *displayed* scoreboard rather than the raw `runId`.

### WR-02: Approve is blind last-write-wins — clobbers a post-propose manual edit and can link a version it did not create

**File:** `backend/app/api/evals.py:1450-1480`
**Issue:** `approve_description_proposal` has no staleness or no-op guard between propose-time and approve-time:
1. If the user manually edits `skills.description` after proposing (SkillsPage PATCH — still live per the CandidateCard docstring), approve silently overwrites that newer edit with a winner that was measured against the OLD description. The review card can't warn them: its diff base is hydrated from the *stored* `base_skill_version_id` (`_read_base_description`), not the live row — so the approved diff is not the change that actually happens (lost update).
2. If the live description already EQUALS `proposed_description`, the 079/132 trigger does NOT fire (it captures only `IS DISTINCT FROM` changes — `full-schema.sql:63-71`), so `_read_max_version` returns a pre-existing version and `new_skill_version_id` links a version this approval never created — the "self-improve audit anchor" points at the wrong artifact. (The propose-side D-02 gate only protects the propose moment, not the approve moment.)
**Fix:** Before the live write, re-read the live `skills.description`: 409 when it no longer equals the hydrated base (mirror the propose route's stale-run 409), and short-circuit the no-op case (flip `promoted` without fabricating a version link, or refuse). Cheap: one extra owner-scoped read already available from `_verify_owned_skill` (it selects `description`).

### WR-03: Description reject has no status guard — a `promoted` (applied) proposal can be flipped to `rejected`, and the card's buttons allow the race

**File:** `backend/app/api/evals.py:1363-1374`; `frontend/src/pages/SkillTunerPage.tsx:486-506`; `frontend/src/components/skills/studio/DescriptionProposalCard.tsx:190-205`
**Issue:** `reject_description_proposal` verifies ownership + kind but not status; the update unconditionally sets `status='rejected'`. A proposal already `promoted` (description applied, version captured) can be flipped to `rejected` — the audit trail then claims the winning description was never applied while it is live and driving triggering. This is reachable from the shipped UI: `handleApproveDescription`/`handleRejectDescription` have no in-flight guard and the card's Approve/Reject buttons are never disabled while a mutation is pending, so a quick Approve→Reject double-click sends both — approve promotes, reject then corrupts the promoted row. (Approve DOES guard `status == 'proposed'` with 409; reject is the asymmetric hole.)
**Fix:** Add `.eq("status", "proposed")` to the `_reject` update (or pre-check and 409 like approve does), and disable/`disabled={busy}` the card's Approve + Reject buttons while either request is in flight (mirror CandidateCard's `proposing` guard).

### WR-04: Rehydration-on-open is documented and built but never wired — a durable `proposed` proposal is invisible after reload

**File:** `frontend/src/lib/api.ts:2004-2018` (`getLatestDescriptionProposal` — zero call sites); `frontend/src/pages/SkillTunerPage.tsx:180-271`; `backend/app/api/evals.py:1282-1319`
**Issue:** The GET list route exists explicitly "for rehydration-on-open" and `getLatestDescriptionProposal` was written to serve it, but nothing calls it — SkillTunerPage's mount effect fetches seeded cases, the durable scoreboard, and settings, never the proposals. After a reload/navigation, a durable `status='proposed'` description proposal cannot be seen, approved, or rejected from the UI; the only recovery is clicking "Propose this description" again, which supersedes the original to `rejected` (audit clutter) and re-snapshots. Relatedly, `DescriptionProposalCard`'s `onPropose` null-proposal affordance (lines 87-103) is dead code in the app — no mount passes it.
**Fix:** In the `[skillId]` mount effect, call `getLatestDescriptionProposal(skillId)` and seed `setDescProposal(...)` (ignore `rejected` rows, as the card already does); or remove the unused export + the dead affordance branch if rehydration is deliberately deferred — but then correct the route/api docstrings, which currently promise it.

### WR-05: After approve, the page contradicts itself — "current · live · drives firing" still shows the OLD description

**File:** `frontend/src/pages/SkillTunerPage.tsx:486-495, 632-643`
**Issue:** `handleApproveDescription` sets the card to the `promoted` row ("Promoted to the live skill — this description now drives triggering.") but never refreshes `useSkills()` (it fetches once on mount — `useSkills.ts:30,37`). The top section, explicitly honesty-labeled "current · live · drives firing", keeps rendering the pre-approve description, and the baseline scoreboard section still labels the old text "current description". Two adjacent surfaces on the same screen now disagree about which description is live — the exact honesty class this phase exists to protect.
**Fix:** On approve success, refetch skills (expose/reuse the hook's fetch) or locally patch the displayed skill: e.g. keep a `useState` override, or call the hook's existing update path with the promoted `proposed_description` (no network write needed — the server already wrote it; a refetch is the reconcile-via-fetch-honest option per D-v2.5-03).

### WR-06: Propose 500s (unhandled CHECK violation) when the winner candidate has no description

**File:** `backend/app/api/evals.py:1216, 1259-1277`
**Issue:** `winner_description = winner.get("description") or scoreboard.get("winner_description")` can resolve to `None`/`""` if the durable scoreboard is malformed or from an older writer. The INSERT then carries `proposed_description=None` with `kind='description'`, violating the new `skill_proposals_kind_fields` CHECK — PostgREST raises inside `_insert`, and unlike every read in this route, the insert is not exception-guarded → an opaque 500. The route defensively coalesces everything else in the scoreboard (`or {}`, `or []`, winner-None → 400) but trusts this one field right before the write.
**Fix:**
```python
if not winner_description:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="The tuner winner has no description to propose",
    )
```

## Info

### IN-01: `_read_latest_tuner` is the one proposal-path read without `.eq("user_id", …)` — intentional-looking but undocumented

**File:** `backend/app/api/evals.py:1178-1185`
**Issue:** The SI-02 block's own header says the app-code `.eq("user_id")` is applied "on EVERY read/write", but the `tuner_runs` read filters only on `skill_id`. It is safe (skill ownership is verified first; `tuner_runs.user_id` is documented as last-runner attribution, not an access gate, and adding the filter would wrongly 404 an owner proposing from a global-skill consumer's run) — but the deviation from the stated doctrine deserves a one-line comment so a future hardening pass doesn't "fix" it into a bug, and so an auditor doesn't flag it as a miss.
**Fix:** Add a comment citing the tuner_runs table comment (T-123.1-05) explaining why user_id is deliberately not filtered here.

### IN-02: CandidateCard success copy points the wrong way — the review card mounts ABOVE the candidates

**File:** `frontend/src/components/skills/tuner/CandidateCard.tsx:131`; `frontend/src/pages/SkillTunerPage.tsx:823-846`
**Issue:** After propose, the card says "Proposed · review the diff & per-provider scoreboard below." — but SkillTunerPage mounts `DescriptionProposalCard` before the `sortedCandidates` list, i.e. visually above the winner card the user just clicked.
**Fix:** Change the copy to "above", or mount the review card directly beneath the winning CandidateCard.

### IN-03: Wrong-kind miss semantics differ between approve (409) and reject (404)

**File:** `backend/app/api/evals.py:1343-1361` vs `:1433-1437`
**Issue:** Sending an instruction proposal to the description-reject route yields 404 ("not found"), while the description-approve route yields 409 ("Not a description proposal"). Both are owner-verified first so nothing leaks cross-user, but the inconsistent contract complicates clients and tests.
**Fix:** Pick one (the reject-side 404 matches T-139-10's "indistinguishable from absent" framing) and align the approve guard.

### IN-04: `handleConfirmWinner`'s silent early-return lets CandidateCard show a false "Proposed" success

**File:** `frontend/src/pages/SkillTunerPage.tsx:476-482`; `frontend/src/components/skills/tuner/CandidateCard.tsx:52-66`
**Issue:** When `skillId`/`proposeRunId` is null the handler resolves without doing anything; CandidateCard's `handlePropose` then sets `proposed=true` and renders "Proposed · review the diff…" even though no proposal exists and no review card mounts. Hard to reach today (a displayed scoreboard implies `runId` or `latestRun`), but it converts a wiring regression into a silent lie.
**Fix:** `throw new Error("No tuner run to propose from")` instead of returning, so the card's inline error path (WR-04 honesty) fires.

### IN-05: Test coverage gaps on the new lifecycle edges

**File:** `backend/tests/integration/test_139_description_proposals.py`
**Issue:** The five tests are meaningful (real app, filtering fake, IDOR + kind-gate + no-live-write all asserted), but three server behaviors this phase introduced are untested: (a) the stale-run 409 (`body.run_id` ≠ durable `tuner_runs.run_id`), (b) the D-04 supersede (a second propose flips the lingering `proposed` draft to `rejected`), and (c) `GET /description-proposals` (list/rehydration — its `base_description` hydration and kind filter). The wrong-kind APPROVE 409 guard is also uncovered (only reject's kind gate is tested).
**Fix:** Add one test each; the existing `_seed` helper already supports all three with minor parameters.

### IN-06: `snapshot.winner.cells` is read unguarded from a jsonb payload

**File:** `frontend/src/components/skills/studio/DescriptionProposalCard.tsx:165-183`
**Issue:** The card guards `snapshot &&` and `snapshot.baseline &&` but dereferences `snapshot.winner.cells` unconditionally; `ProviderScoreboard` immediately `cells.map(...)`. The TS type promises `winner: TunerCandidate`, but the value round-trips through a `jsonb` column written by whatever code version persisted it — a malformed/legacy snapshot would crash the whole Tuner results pane.
**Fix:** Guard the winner block like the baseline one: `{snapshot?.winner?.cells && (…)}`.

---

_Reviewed: 2026-07-06T15:30:10Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
