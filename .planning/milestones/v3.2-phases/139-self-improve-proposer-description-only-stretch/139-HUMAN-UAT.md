---
status: complete
phase: 139-self-improve-proposer-description-only-stretch
source: [139-VERIFICATION.md]
started: 2026-07-06T19:45:00Z
updated: 2026-07-06T20:10:00Z
---

## Current Test

[testing complete — 4/7 passed live, 3/7 deferred per operator (2026-07-06)]

## Tests

### 1. Cross-provider held-out proposal (≥2 providers)
expected: Run the Trigger Tuner on a skill until a non-baseline candidate wins on held-out across ≥2 live providers (e.g. OpenAI + Anthropic) → click "Propose this description" → the DescriptionProposalCard shows a scoreboard_snapshot with ≥2 provider cells in BOTH the proposed and current rows → Approve → skills.description updates and exactly one new skill_versions row appears. (SC#10 mandate — requires live provider keys + a real Tuner run.)
result: pass
evidence: |
  Claude-driven live UAT 2026-07-06 (operator watching). To create a beatable baseline I hand-edited risk-lens_099uat's description down to "General helper." (v7) and curated the Triggering benchmark to real Risk-Lens prompts (5 should-fire / 11 should-NOT). Tuner run 3d2f97b5 = ALL 8 live providers (openai, anthropic, google, openrouter, deepseek, moonshot, minimax, zhipu) × 14 cases × 3 repeats.
  - Baseline "General helper." scored held-out 0.9375 (google fires 0.00, openai no-false 0.80) — genuinely beatable.
  - Winner = candidate 1 held-out 1.00 across all 8 providers → non-baseline winner (winner_index=1).
  - "Propose this description" → DescriptionProposalCard rendered the base→proposed diff (`- General helper.` → `+ Analyze and identify potential risks…`) AND a scoreboard_snapshot with BOTH rows populated: PROPOSED = 8 provider cells all 1.00, CURRENT(BASELINE) = 8 provider cells (google 0.50). DB skill_proposals row: kind=description, status=proposed, scoreboard_snapshot has {run_id, winner, baseline} with 8 providers in each.
  - Approve → card flipped to "Promoted to the live skill — this description now drives triggering." DB: skills.description = winner text; skill_versions 7→8 (exactly ONE new, v8 — Pitfall 2 guard holds, never two); proposal status=promoted, new_skill_version_id set, base_skill_version_id = prior latest (v7).
  Note: SC#10 satisfied with the FULL native roster (8 providers), not just the big-4.

### 2. Honest baseline-wins path
expected: Run the Tuner on a skill whose current description already wins on held-out → UI shows "No candidate beat your current description — keeping it", with NO "Propose this description" affordance on any candidate → a forced POST to /description-proposals returns 400 and creates zero rows.
result: pass
evidence: Claude-driven live UAT 2026-07-06 (operator watching). Tuner run fd1103d9 on risk-lens_099uat: 8 providers × 14 cases × 3 repeats, all 4 candidates tied baseline at held-out 1.0 → winner_index=0. UI rendered "No candidate beat your current description — keeping it." with zero propose affordances (find over a11y tree). Forced POST /description-proposals → HTTP 400 "Nothing to propose — the current description already wins"; skill_proposals count stayed 0, skill_versions stayed 1.

### 3. Parallel-thread isolation
expected: Propose + approve a description on skill A while a Tuner run streams on skill B (or a chat thread streams concurrently) → skill A's proposal/version/description are correct, skill B's run completes normally, no scoreboard_snapshot bleeds between skills, no event-loop stall.
result: skipped
reason: Deferred per operator decision (2026-07-06) — accept the core lifecycle as live-verified (Tests 1/2/4/5) rather than spend another live ~15-20 min all-provider Tuner run. Isolation logic is owner-scoped by construction (skill_id from path, user_id from auth) and covered by unit tests + the CR-01 code-review wave. NOTE (partial live evidence): during Test 1, backend /health probes intermittently returned 000 with ~10s latency while the all-provider Tuner run streamed — consistent with the known multi-worker event-loop pressure under concurrent live-provider fan-out; no cross-skill data bleed was observed and both runs completed with correct per-skill results.

### 4. Long-history base-version resolution
expected: Propose + approve on a skill with many prior skill_versions and skill_proposals rows → base_skill_version_id resolves to the TRUE latest version, new_skill_version_id = MAX(version_number)+1 (no 23505 collision), and the card renders without perceptible lag.
result: pass
evidence: |
  Directly exercised by the Test 1 approve (not a separate run). risk-lens_099uat carried 7 prior skill_versions (v1–v7, from the hand-edit series) when the proposal was approved:
  - base_skill_version_id resolved to the TRUE latest = v7 (0c7c2d96-99ab-47e2-80c0-c1ed7695a1c6) — confirmed against the versions table.
  - new_skill_version_id = v8 = MAX(version_number)+1; no 23505 unique-collision (a wrong base pick would have collided).
  - DescriptionProposalCard rendered the diff + dual 8-provider scoreboard with no perceptible lag.
  Caveat: this skill had 1 proposal row (not "many"); the base-version + MAX+1 + no-collision path is nonetheless proven on a multi-version skill.

### 5. G-4 — Approve visibly updates the live skill + exactly one new version
expected: After clicking Approve in the DescriptionProposalCard, the skill's live description visibly changes elsewhere in the UI (e.g. Skills list) and the Skill Studio Versions tab shows exactly ONE new version — never two (Pitfall 2 guard).
result: pass
evidence: |
  Same live UAT (approve of run 3d2f97b5's winner, 2026-07-06).
  - Live description changed elsewhere: Skills list row + the edit-panel Description field + the Triggering-tab "CURRENT · LIVE · DRIVES FIRING" label all show the new "Analyze and identify potential risks…" text (WR-05 loadSkills refetch — reconciled in-place without reload).
  - Versions tab shows exactly ONE new version (v8), total 8 — never two (Pitfall 2 guard). On a fresh load the header reads "v8 LIVE" and the LIVE badge sits on v8.
  MINOR OBSERVATION (not a test failure): immediately after Approve, the in-Studio header version number + Versions-tab LIVE badge still showed "v7 LIVE" while the card already said "Promoted…". WR-05's handleApproveDescription refetches the SKILLS list (description text) but does NOT invalidate the skill_versions query, so the version pointer (header vN + LIVE badge) only reconciles on the next page load. Description text + DB are correct; exactly-one-version holds. Candidate for a follow-up polish (refetch versions on approve), severity cosmetic.

### 6. G-4 — Reject leaves the live skill untouched
expected: Click Reject on the DescriptionProposalCard → card dismisses, the live skill description is visibly unchanged, and no new version appears in the Versions tab.
result: skipped
reason: Deferred per operator decision (2026-07-06) — reproducing a beatable proposal to reject requires another live ~15-20 min all-provider Tuner run. The reject route is a pure-audit status flip (no skills write, no skill_versions INSERT, new_skill_version_id stays NULL) verified by unit tests + the CR-01 kind-gated review. Not driven live this session.

### 7. G-4 — Snapshot immutability across a Tuner re-run
expected: Propose a description (do not approve yet), then re-run the Tuner on the same skill → the PENDING proposal's rendered scoreboard_snapshot does NOT change, even though tuner_runs has mutated (latest-wins UNIQUE(skill_id)).
result: skipped
reason: Deferred per operator decision (2026-07-06) — needs a pending (un-approved) proposal plus a second live ~15-20 min all-provider Tuner run to prove the snapshot doesn't mutate. The immutability is structural (RESEARCH Pitfall 1 — the proposal SNAPSHOTS tuner_runs.scoreboard inline at propose-time into skill_proposals.scoreboard_snapshot rather than FK-referencing the latest-wins tuner_runs row); confirmed present in the DB this session (the promoted proposal carried its own {run_id, winner, baseline} snapshot). Not driven live across a re-run this session.

## Summary

total: 7
passed: 4
issues: 0
pending: 0
skipped: 3
blocked: 0

Passed: 1 (full lifecycle), 2 (honest baseline-wins gate), 4 (base-version resolution), 5 (G-4 approve).
Skipped (deferred per operator 2026-07-06): 3 (parallel-thread isolation), 6 (reject leaves untouched), 7 (snapshot immutability across re-run) — each needs another live ~15-20 min all-provider Tuner run (real provider $); backend logic covered by unit tests + CR-01 code-review wave.
Minor observation filed as BUG-260706-01 (not a test failure): post-approve, the Studio version pointer (header vN + Versions LIVE badge) reconciles only on page reload; description text + DB are correct. See Test 5.

## Gaps
