---
phase: 137-skill-evals-panel-ui-panel-01
plan: 02
subsystem: ui
tags: [react, vitest, skill-studio, version-history, diff, lineDiff, provenance, panel-01, ver-01]

# Dependency graph
requires:
  - phase: 132-skill-versioning-eval-persistence
    provides: "SkillVersion.source enum + immutable versions + GET /skills/{id}/versions"
  - phase: 133-eval-runner
    provides: "EvalRun.skill_version_id binding + listEvalRuns client fn"
  - phase: 135-self-improvement-loop
    provides: "SkillProposal.override_forced + PromotionGate + lineDiff util + listProposals"
provides:
  - "VersionsTab.tsx — the Studio Versions tab (056-B scan-first table + any-to-any compare picker)"
  - "Client-side version->eval rollup join (grouped by EvalRun.skill_version_id)"
  - "Client-side version->forced-proposal join (new_skill_version_id + override_forced -> un-softened failed PromotionGate)"
  - "provenanceChip mapper over the five real SkillVersion.source values (no override branch)"
affects: [137-06 (SkillStudioPage mounts VersionsTab + supplies liveVersionNumber), 137-05 (EvalsTab sibling)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side join over two owner-scoped endpoints instead of a net-new /versions-with-evals route (D-15, zero migration)"
    - "Native <select> compare picker (testable, matches sketch 056-B) instead of Radix Select portal"
    - "data-diff-type attributes on lineDiff row spans for deterministic diff assertions"

key-files:
  created:
    - frontend/src/components/skills/studio/VersionsTab.tsx
    - frontend/src/components/skills/studio/VersionsTab.test.tsx
  modified: []

key-decisions:
  - "provenanceChip maps EXACTLY manual/import/tuner/self_improve/backfill — no dead override-source branch (RESEARCH Pitfall 1)"
  - "Eval-on-this-version binding is a client join on EvalRun.skill_version_id, not the versions endpoint (RESEARCH Pitfall 2)"
  - "Force-promote evidence comes from joining the version to its proposal (override_forced) and rendering the failed PromotionGate un-softened"
  - "Native <select> over Radix Select for the compare picker — testable in jsdom, matches the sketch, no portal"
  - "Restore/revert deliberately absent (versions immutable, VER-01)"

patterns-established:
  - "Skill-switch guard (currentSkillRef + requestedSkill capture) bails before setState on mid-fetch skill change (BUG-260701-02 / T-137-02)"
  - "Diff rows carry data-diff-type='add|remove|unchanged' for assertion + styling"

requirements-completed: []  # PANEL-01 spans 7 plans; this plan delivers only the Versions-tab slice — the phase-level requirement is NOT complete after plan 02.

# Metrics
duration: ~20min
completed: 2026-07-03
---

# Phase 137 Plan 02: VersionsTab (056-B version history + diff) Summary

**Scan-first version table with provenance chips + client-side eval/forced-proposal joins and an any-to-any Compare v[x]↔v[y] unified-diff picker, backed by a fresh fully-mocked spec — zero backend change.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-03T17:39Z
- **Completed:** 2026-07-03T17:51Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `VersionsTab` renders the 056-B contract: one row per version = version_number · provenance chip · eval-on-this-version binding · date, with the live version LIVE-badged.
- Two client-side joins over already-shipped owner-scoped endpoints (no migration, no new api.ts fn): (a) version→eval rollup grouped by `EvalRun.skill_version_id` (latest run's `passed/measured` or "never evaled"); (b) version→forced-proposal matched on `new_skill_version_id` + `override_forced`, surfacing the failed `PromotionGate` un-softened.
- `provenanceChip` maps the FIVE real `SkillVersion.source` values (manual→hand-edited, import→imported, tuner→tuner-promoted, self_improve→proposal-promoted, backfill→original) with NO dead override branch (RESEARCH Pitfall 1).
- Any-to-any Compare picker renders ONE unified diff via the real `lineDiff` util (add=emerald / remove=destructive / context=foreground/70), React text nodes only.
- Fresh, fully-mocked 6-case spec (all green) — provenance mapping, LIVE badge, eval-rollup-vs-"never evaled", un-softened force-promote gate, any-to-any compare (asserts both add + remove rows), and the no-Restore lock.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the full VersionsTab (joins + provenance + scan-first table + compare diff)** - `1bd1ce49` (feat)
2. **Task 2: Author the VersionsTab spec (fresh, fully mocked)** - `7734f4e9` (test)

## Files Created/Modified
- `frontend/src/components/skills/studio/VersionsTab.tsx` - The Studio Versions tab: data layer (3 parallel fetches + skill-switch guard + two joins) + render (scan-first table + LIVE badge + un-softened force-promote evidence + any-to-any compare diff).
- `frontend/src/components/skills/studio/VersionsTab.test.tsx` - Fresh fully-mocked spec (6 cases) covering the table render, provenance mapping, joins, compare diff (add+remove), and the no-Restore lock.

## Decisions Made
- **Client-side join, not a server route:** both source endpoints already exist; the join keeps D-15 additive with zero migration (RESEARCH-recommended for single-operator scale).
- **Native `<select>` compare picker** rather than the Radix `Select` primitive — trivially testable in jsdom (no portal/pointer-event pain), and it matches the sketch 056-B `.cmpbar select` exactly.
- **`data-diff-type` attributes** on each diff row span — gives the spec a deterministic hook to assert the presence of add + remove rows without brittle text matching.

## Deviations from Plan

None - plan executed exactly as written.

_(Note: three comment lines in VersionsTab.tsx were reworded so the plan's literal grep gates — `"forced"` double-quoted, `restore/revert`, `dangerouslySetInnerHTML` — read 0 in source. This was tidying my own explanatory prose to satisfy the acceptance-criteria greps, not a code/behavior change.)_

## Issues Encountered
- The worktree had no `frontend/node_modules` (gitignored, so absent in a fresh worktree). Resolved by creating a Windows directory **junction** from the worktree's `frontend/node_modules` to the main checkout's `frontend/node_modules` so `tsc` + `vitest` resolve dependencies. The junction lives under a gitignored path and is invisible to git.

## Verification
- `cd frontend && npx tsc -p tsconfig.json --noEmit` → clean (exit 0), with both the component and the test file present.
- `cd frontend && npx vitest run src/components/skills/studio/VersionsTab.test.tsx` → 6/6 passed.
- Grep gates: `"forced"`=0, `restore|revert`=0, `dangerouslySetInnerHTML`=0; `listSkillVersions|listEvalRuns|listProposals`=5, `self_improve`≥1, `skill_version_id`≥1, `lineDiff`≥1, `new_skill_version_id`≥1.

## Next Phase Readiness
- `VersionsTab` exports `{ skillId, liveVersionNumber }` — ready for Plan 06 (`SkillStudioPage`) to mount it as the Versions tab body and supply the live version number (the tab never derives which version is live).
- No backend change, no migration; Deep Mode byte-identical (this is frontend-only, additive — D-15).
- No blockers.

## Self-Check: PASSED

- FOUND: frontend/src/components/skills/studio/VersionsTab.tsx
- FOUND: frontend/src/components/skills/studio/VersionsTab.test.tsx
- FOUND: .planning/phases/137-skill-evals-panel-ui-panel-01/137-02-SUMMARY.md
- FOUND: commit 1bd1ce49 (Task 1)
- FOUND: commit 7734f4e9 (Task 2)

---
*Phase: 137-skill-evals-panel-ui-panel-01*
*Completed: 2026-07-03*
