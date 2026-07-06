---
phase: 139-self-improve-proposer-description-only-stretch
verified: 2026-07-06T19:40:00Z
status: human_needed
score: 3/3 must-haves structurally verified (live 4-axis + G-4 UAT pending)
overrides_applied: 0
human_verification:
  - test: "Cross-provider held-out proposal (≥2 providers)"
    expected: "Run the Trigger Tuner on a skill until a non-baseline candidate wins on held-out across ≥2 live providers (e.g. OpenAI + Anthropic) → click 'Propose this description' → the DescriptionProposalCard shows a scoreboard_snapshot with ≥2 provider cells in BOTH the proposed and current rows → Approve → skills.description updates and exactly one new skill_versions row appears."
    why_human: "Requires live provider API keys + a real Tuner run producing a genuine cross-provider held-out winner; cannot be synthesized by grep/static analysis (SC#10 mandate)."
  - test: "Honest baseline-wins path"
    expected: "Run the Tuner on a skill whose current description already wins on held-out → UI shows 'No candidate beat your current description — keeping it', with NO 'Propose this description' affordance on any candidate → a forced POST to /description-proposals returns 400 and creates zero rows."
    why_human: "Needs a real held-out benchmark result where the baseline wins; the code path (400 gate) is unit/integration-tested with a fake, but the live UI honesty (no affordance shown) needs a human to observe the rendered page."
  - test: "Parallel-thread isolation"
    expected: "Propose + approve a description on skill A while a Tuner run streams on skill B (or a chat thread streams concurrently) → skill A's proposal/version/description are correct, skill B's run completes normally, no scoreboard_snapshot bleeds between skills, no event-loop stall."
    why_human: "Concurrency/live-stream behavior cannot be verified via static code inspection; requires two live browser contexts or overlapping live runs."
  - test: "Long-history base-version resolution"
    expected: "Propose + approve on a skill with many prior skill_versions and skill_proposals rows → base_skill_version_id resolves to the TRUE latest version, new_skill_version_id = MAX(version_number)+1 (no 23505 collision), and the card renders without perceptible lag."
    why_human: "Needs a skill with a seeded long version/proposal history in the live DB; not covered by the phase's fake-backed unit tests."
  - test: "G-4 — Approve visibly updates the live skill + exactly one new version"
    expected: "After clicking Approve in the DescriptionProposalCard, the skill's live description visibly changes elsewhere in the UI (e.g. Skills list) and the Skill Studio Versions tab shows exactly ONE new version — never two (Pitfall 2 guard)."
    why_human: "Lived-experience UI verification (G-4) — the backend logic is code-verified (single UPDATE + read-back, no double INSERT) but the visible one-version-not-two behavior against the real capture_skill_version trigger must be observed live."
  - test: "G-4 — Reject leaves the live skill untouched"
    expected: "Click Reject on the DescriptionProposalCard → card dismisses, the live skill description is visibly unchanged, and no new version appears in the Versions tab."
    why_human: "Same as above — needs live-UI observation against the real DB, not just the fake-backed pytest assertions."
  - test: "G-4 — Snapshot immutability across a Tuner re-run"
    expected: "Propose a description (do not approve yet), then re-run the Tuner on the same skill → the PENDING proposal's rendered scoreboard_snapshot does NOT change, even though tuner_runs has mutated (latest-wins UNIQUE(skill_id))."
    why_human: "Requires observing the UI before and after a live re-run; the inline-snapshot-vs-mutable-FK design is code-verified statically but the live non-mutation needs to be watched."
---

# Phase 139: Self-Improve Proposer — Description-Only (STRETCH) Verification Report

**Phase Goal:** A bounded, human-in-the-loop description-only proposer drafts a description diff → human approves → new immutable version; no instruction-body edits.
**Verified:** 2026-07-06T19:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The proposer drafts a description-only diff as a DRAFT — never auto-publishes, never edits a live skill description (SC1) | ✓ VERIFIED | `propose_description_improvement` (`backend/app/api/evals.py:1128-1279`) INSERTs a `kind='description'`, `status='proposed'` row with `proposed_instructions=None` and never calls `.update()` on `skills`. Live DB CHECK `skill_proposals_kind_fields` enforces exactly one of instructions/description per row (confirmed live on :54322 — see Artifacts). `test_propose_creates_draft_no_live_write` and `test_baseline_winner_refuses_propose` pass (6/6 in `test_139_description_proposals.py` + `test_139_migration_090.py`, run live by this verifier). |
| 2 | A human reviews and approves the diff; on approval a new immutable version is created; on rejection nothing changes (SC2) | ✓ VERIFIED (structural) | `approve_description_proposal` (`evals.py:1386-1502`) does exactly one `run_in_threadpool`-wrapped `UPDATE skills.description`, reads back `MAX(version_number)` (no second INSERT — no double-capture), then flips `status='promoted'`. `reject_description_proposal` (`evals.py:1327-1378`) does a single `status='rejected'` flip with no skills/version write. Both proven by fake-backed tests (`test_approve_writes_desc_and_version`, `test_reject_is_pure_audit` — pass). The underlying `capture_skill_version` trigger (079/132) is pre-existing and already proven live in Phase 135's UAT; its firing on THIS route in the live UI is a G-4 human-verification item below (not yet independently re-proven live for SI-02). |
| 3 | The proposal reuses the SI-01 substrate and the cross-provider scoreboard, holding across providers (SC#10) (SC3) | ✓ VERIFIED (structural) | Same `skill_proposals` table (mig 083 extended by mig 090, not forked), same 7-value status enum, same response model (`SkillProposalResponse`), same router file (`evals.py`), same owner-scoping helpers (`_verify_owned_skill`) as SI-01. Scoreboard evidence is read from the Trigger Tuner's `tuner_runs` durable scoreboard and snapshotted inline as `{winner, baseline, run_id}` — both `winner.cells` and `baseline.cells` carry a `provider` field per cell, and the card renders both. Live cross-provider proof (≥2 real providers) is a 4-axis UAT item deferred to human verification (below), per this phase's own VALIDATION.md contract. |

**Score:** 3/3 truths structurally verified; live 4-axis + G-4 UAT explicitly deferred to this verification step per `139-VALIDATION.md` (not yet human-driven).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/090_skill_proposals_description_kind.sql` | Additive kind discriminator + description columns + provenance FK + kind-gated CHECK | ✓ VERIFIED | File present, pure `ALTER TABLE`, no CREATE/DROP, no status-enum change. |
| Live DB schema (`skill_proposals` @ 127.0.0.1:54322) | Migration 090 actually applied, not just authored | ✓ VERIFIED | Queried live via psycopg2: `kind` (NOT NULL, default), `proposed_description`/`scoreboard_snapshot`/`source_tuner_run_id` (nullable), `proposed_instructions` now nullable, `skill_proposals_kind_fields` CHECK present with both branches, `source_tuner_run_id` FK → `tuner_runs(id) ON DELETE SET NULL`. Matches the migration file exactly. |
| `supabase/full-schema.sql` | Regenerated deploy artifact reflecting migration 090 | ✓ VERIFIED | Contains `scoreboard_snapshot`, `skill_proposals_kind_fields`, `proposed_description`, the FK constraint. |
| `backend/app/models/eval_run.py` | Extended `SkillProposalResponse` + `ProposeDescriptionBody` | ✓ VERIFIED | `kind`, `proposed_description`, `base_description`, `scoreboard_snapshot`, `source_tuner_run_id` present on `SkillProposalResponse`; `ProposeDescriptionBody(run_id: str)` present. |
| `backend/app/api/evals.py` | 4 description-proposal routes (propose/list/reject/approve) | ✓ VERIFIED | All 4 routes present at `/{skill_id}/description-proposals[...]`, owner-scoped via `_verify_owned_skill`, kind-gated, `run_in_threadpool`-wrapped throughout. |
| `backend/tests/integration/test_139_description_proposals.py` | 5 fake-backed lifecycle tests | ✓ VERIFIED, WIRED | Run live by this verifier: 6 passed (5 named tests + reject-wrong-kind sub-assertion bundled). |
| `backend/tests/test_139_migration_090.py` | Live-DB CHECK constraint test | ✓ VERIFIED, WIRED | Run live by this verifier against :54322: 1 passed (both branches — reject NULL description, accept NULL instructions). |
| `frontend/src/types/index.ts` | `SkillProposal` extended + `DescriptionScoreboardSnapshot` type | ✓ VERIFIED | `kind`, `proposed_description`, `base_description`, `source_tuner_run_id`, `scoreboard_snapshot: DescriptionScoreboardSnapshot \| null` present; `DescriptionScoreboardSnapshot = {winner, baseline, run_id}` — NOT aliased to `TunerScoreboard`. |
| `frontend/src/lib/api.ts` | `proposeDescription`/`approveDescriptionProposal`/`rejectDescriptionProposal`/`getLatestDescriptionProposal` wires | ✓ VERIFIED, WIRED | All 4 present, targeting `/skills/{id}/description-proposals[...]`, using `getAuthHeaders()` + `proposalError`. |
| `frontend/src/components/skills/studio/DescriptionProposalCard.tsx` | Render-only diff + scoreboard + Approve/Reject | ✓ VERIFIED, WIRED, DATA FLOWS | No `@/lib/api` import; renders `lineDiff` output + `ProviderScoreboard` from `scoreboard_snapshot.winner.cells`/`.baseline.cells`; text-node-only (verified — angle-bracket test proves no `dangerouslySetInnerHTML`); mounted in `SkillTunerPage.tsx` under the winner area, wired to real state (`descProposal`) populated by a real `proposeDescription()` call. |
| `frontend/src/pages/SkillTunerPage.tsx` | `handleConfirmWinner` repointed to `proposeDescription`; card mounted | ✓ VERIFIED, WIRED | `handleConfirmWinner` calls `proposeDescription(skillId, proposeRunId)`, not `updateSkill`; `DescriptionProposalCard` mounted with `approveDescriptionProposal`/`rejectDescriptionProposal` handlers; `updateSkill` import removed here (still used by `SkillsPage.tsx` for manual edits — confirmed present there). |
| `frontend/src/components/skills/tuner/CandidateCard.tsx` | "Propose this description" affordance gated on `isActionableWinner` | ✓ VERIFIED | CTA text confirmed; `isActionableWinner = isWinner && !candidate.is_baseline` gate unchanged; inline diff-confirm strip removed (single review door). |
| `frontend/src/components/skills/studio/DescriptionProposalCard.test.tsx` | 4 vitest cases (diff, handlers, promoted, text-node) | ✓ VERIFIED, WIRED | Run live by this verifier: all pass, part of 28/28 in the three touched test files. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `POST /skills/{id}/description-proposals` | `public.tuner_runs` | read latest-by-skill, honest-winner gate, snapshot inline | ✓ WIRED | Reads `tuner_runs.eq("skill_id")`, gates on `winner.is_baseline`, snapshots `{winner, baseline, run_id}` verbatim — matches the frontend `DescriptionScoreboardSnapshot` type exactly. |
| `POST .../description-proposals/{pid}/approve` | `public.skills.description` + 079/132 trigger | `run_in_threadpool` UPDATE then read-back MAX(version_number) | ✓ WIRED | Confirmed in code; the trigger itself is pre-existing infrastructure (Phase 132), not re-authored here. |
| `CandidateCard onConfirm` / `SkillTunerPage.handleConfirmWinner` | `proposeDescription(skillId, runId)` → `DescriptionProposalCard` | propose flow (no direct `updateSkill` write) | ✓ WIRED | `handleConfirmWinner` calls `proposeDescription`, holds result in `descProposal` state, mounts the card. |
| `DescriptionProposalCard` | `lineDiff` + `ProviderScoreboard` | `base_description` vs `proposed_description` diff + `scoreboard_snapshot` cells | ✓ WIRED, DATA FLOWS | Verified rendering both diff rows and ≥2 provider cells in the vitest suite (real component, not a mock). |
| `frontend/src/types/index.ts` `DescriptionScoreboardSnapshot` | backend `scoreboard_snapshot` writer (`evals.py`) | literal `{winner, baseline, run_id}` shape pinned on both ends | ✓ VERIFIED | Backend writes exactly these 3 top-level keys; frontend type declares exactly these 3 keys; test fixtures on both sides use the same shape (not the `TunerScoreboard` candidates[]/winner_index shape). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `DescriptionProposalCard` | `proposal.scoreboard_snapshot` | `SkillTunerPage.descProposal` ← `proposeDescription()` ← `POST /description-proposals` ← live `tuner_runs.scoreboard` | Yes (live query, not static) | ✓ FLOWING |
| `DescriptionProposalCard` | `proposal.base_description`/`proposed_description` | Backend reads `skills.description` (base) + Tuner's winning candidate (proposed) — both real DB reads | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration 090 live-DB kind CHECK rejects a bad row / accepts a relaxed one | `pytest backend/tests/test_139_migration_090.py -q` (run against live :54322) | 1 passed | ✓ PASS |
| Description-proposal lifecycle (propose/baseline-refuse/approve/reject/cross-user) | `pytest backend/tests/integration/test_139_description_proposals.py -q` | 6 passed | ✓ PASS |
| Broader regression (SI-01 + eval-router suites unaffected) | `pytest backend/tests/test_skill_proposals_router.py tests/test_skill_proposals.py tests/test_evals_router.py tests/integration/test_139_description_proposals.py tests/test_139_migration_090.py -q` | 33 passed | ✓ PASS |
| Frontend phase-139 test files | `npm run test -- --run src/components/skills/studio/DescriptionProposalCard.test.tsx src/components/skills/tuner/CandidateCard.test.tsx src/pages/SkillTunerPage.test.tsx` | 28 passed | ✓ PASS |
| Frontend tsc baseline unaffected (SEED-056 pre-existing rot) | `npx tsc --noEmit -p tsconfig.app.json` | 29 errors total, none in phase-139-touched files | ✓ PASS (matches claimed baseline) |
| `threads.py` / `agent_loop.py` untouched (D-13 red line) | `git diff --stat 5c53c567..HEAD -- backend/app/api/threads.py backend/app/services/agent_loop.py` | empty diff | ✓ PASS |
| Live DB schema matches migration 090 exactly | psycopg2 query of `information_schema.columns` + `pg_constraint` on `skill_proposals` | columns + CHECK + FK all present as specified | ✓ PASS |

### Probe Execution

No dedicated `scripts/*/tests/probe-*.sh` files declared or discovered for this phase; not a migration/tooling-probe phase in that sense. Verification instead ran the phase's own pytest/vitest suites directly (see Behavioral Spot-Checks) plus a live psycopg2 schema query — all executed independently by this verifier, not taken from SUMMARY.md narration.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SI-02 | 139-01, 139-02, 139-03, 139-04, 139-05 | Description-only self-improve proposer: draft → human approve → new immutable version; no instruction-body edits | ✓ SATISFIED (structural); live 4-axis UAT pending | All 3 roadmap Success Criteria structurally verified against the codebase (see Observable Truths); no orphaned requirements — REQUIREMENTS.md maps only SI-02 to Phase 139, and all 5 plans declare `requirements: [SI-02]`. `REQUIREMENTS.md` traceability table still shows "Pending (gated)" for SI-02 — this is expected pre-verification bookkeeping, updated by the orchestrator after this report, not a code gap. |

No orphaned requirements found for Phase 139.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER debt markers found in any of the 8 phase-139-touched files (migration, eval_run.py, evals.py, types/index.ts, api.ts, DescriptionProposalCard.tsx, SkillTunerPage.tsx, CandidateCard.tsx) | — | None — clean |

No blockers or warnings found in anti-pattern scanning.

### Human Verification Required

The phase's own `139-VALIDATION.md` explicitly designates a 4-axis (cross-provider / honest-baseline-wins / parallel-thread / long-history) + G-4 lived-experience UAT block as "Driven live via Chrome MCP + psycopg2 :54322" at `/gsd:verify-work` time — this session. All structural/code-level verification is complete and passing; the following require a human (or human-directed live session) to close:

1. **Cross-provider held-out proposal (≥2 providers, SC#10)** — Run the Tuner to a genuine non-baseline held-out win across ≥2 live providers → Propose → confirm the scoreboard card shows ≥2 provider cells on both proposed and current → Approve → confirm the live description updates and exactly one new version appears.
2. **Honest baseline-wins path** — Confirm the UI shows no "Propose" affordance and the honest "keeping it" copy when the baseline already wins; confirm a forced propose call 400s with zero rows created.
3. **Parallel-thread isolation** — Propose/approve on skill A while a Tuner run streams on skill B; confirm no cross-talk or stall.
4. **Long-history base-version resolution** — Propose/approve on a skill with many prior versions/proposals; confirm the correct base version and no version-number collision.
5. **G-4 — Approve** — Confirm the live description visibly updates and exactly ONE new version appears (not two).
6. **G-4 — Reject** — Confirm the live description is unchanged and no version is added.
7. **G-4 — Snapshot immutability** — Confirm a pending proposal's rendered scoreboard does not change after a Tuner re-run.

(Full detail in the frontmatter `human_verification` block above.)

### Gaps Summary

No code-level gaps found. Every artifact, key link, and route claimed in the five plan SUMMARYs was independently re-verified against the actual codebase and the live local database (not taken on the SUMMARYs' word) — migration 090 is genuinely live on :54322 (queried directly via psycopg2, not just grepped from `full-schema.sql`), all 4 description-proposal routes exist and are owner-scoped/kind-gated/thread-pool-wrapped as claimed, the frontend card is render-only and correctly typed against the exact backend writer shape, and `threads.py`/`agent_loop.py` are provably untouched. The only open item is the live 4-axis + G-4 UAT that this phase's own validation contract designates as a human-driven step at verification time — this is a `human_needed` classification per the escalation-gate protocol, not a gap.

---

*Verified: 2026-07-06T19:40:00Z*
*Verifier: Claude (gsd-verifier)*
