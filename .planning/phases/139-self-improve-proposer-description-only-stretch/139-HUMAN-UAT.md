---
status: partial
phase: 139-self-improve-proposer-description-only-stretch
source: [139-VERIFICATION.md]
started: 2026-07-06T19:45:00Z
updated: 2026-07-06T19:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-provider held-out proposal (≥2 providers)
expected: Run the Trigger Tuner on a skill until a non-baseline candidate wins on held-out across ≥2 live providers (e.g. OpenAI + Anthropic) → click "Propose this description" → the DescriptionProposalCard shows a scoreboard_snapshot with ≥2 provider cells in BOTH the proposed and current rows → Approve → skills.description updates and exactly one new skill_versions row appears. (SC#10 mandate — requires live provider keys + a real Tuner run.)
result: [pending]

### 2. Honest baseline-wins path
expected: Run the Tuner on a skill whose current description already wins on held-out → UI shows "No candidate beat your current description — keeping it", with NO "Propose this description" affordance on any candidate → a forced POST to /description-proposals returns 400 and creates zero rows.
result: [pending]

### 3. Parallel-thread isolation
expected: Propose + approve a description on skill A while a Tuner run streams on skill B (or a chat thread streams concurrently) → skill A's proposal/version/description are correct, skill B's run completes normally, no scoreboard_snapshot bleeds between skills, no event-loop stall.
result: [pending]

### 4. Long-history base-version resolution
expected: Propose + approve on a skill with many prior skill_versions and skill_proposals rows → base_skill_version_id resolves to the TRUE latest version, new_skill_version_id = MAX(version_number)+1 (no 23505 collision), and the card renders without perceptible lag.
result: [pending]

### 5. G-4 — Approve visibly updates the live skill + exactly one new version
expected: After clicking Approve in the DescriptionProposalCard, the skill's live description visibly changes elsewhere in the UI (e.g. Skills list) and the Skill Studio Versions tab shows exactly ONE new version — never two (Pitfall 2 guard).
result: [pending]

### 6. G-4 — Reject leaves the live skill untouched
expected: Click Reject on the DescriptionProposalCard → card dismisses, the live skill description is visibly unchanged, and no new version appears in the Versions tab.
result: [pending]

### 7. G-4 — Snapshot immutability across a Tuner re-run
expected: Propose a description (do not approve yet), then re-run the Tuner on the same skill → the PENDING proposal's rendered scoreboard_snapshot does NOT change, even though tuner_runs has mutated (latest-wins UNIQUE(skill_id)).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
