---
phase: 136-skill-publish-gate-gate-01
plan: 04
subsystem: frontend
tags: [react, typescript, vitest, publish-gate, skills, eval-surface, thin-ux]

# Dependency graph
requires:
  - phase: 136-01
    provides: "PublishGate JSON contract (met/state/measured/passed/passing_run_id/reason/last_override) + the GET /skills/{id}/publish-gate read-model this line renders"
  - phase: 136-03
    provides: "PublishGate TS interface (types/index.ts) + getPublishGate(skillId) api client — reused verbatim, zero new client plumbing"
provides:
  - "SkillEvalSection D-06 gate-status line — plain publish-readiness at a glance (met X/N vs honest per-state unmet), hydrated from getPublishGate on mount"
  - "Owner-visible override record (D-02) — 'Published without a passing eval on <date>' from PublishGate.last_override"
affects: [137-skill-evals-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render server-computed gate status only — no client-side gate math (D-07); reads publishGate.met/passed/measured/state/reason/last_override, never recomputes"
    - "Mount-hydrate via getPublishGate inside the existing useEffect [skillId] init block (same place proposals load); reset on skill switch like the eval/proposal state (skill-switch safe)"
    - "Additive/undesigned status line reusing the surface's own honest-counts text style (text-xs, muted) — no new design-system chrome (137 fence)"

key-files:
  created:
    - frontend/src/components/skills/SkillEvalSection.test.tsx
  modified:
    - frontend/src/components/skills/SkillEvalSection.tsx

key-decisions:
  - "Placed the gate line at the TOP of the section (right under the 'Eval runner' header, before the picker) so publish readiness reads at a glance, per D-06"
  - "Rendered the honest per-state unmet copy AND echoed the server publishGate.reason as a secondary muted sub-line — honest server evidence without duplicating the state pointer"
  - "last_override renders in BOTH met and unmet branches (a skill can be force-published and later pass an eval) — the override trail persists regardless of current met state (D-02)"

requirements-completed: [GATE-01]

# Metrics
duration: 6min
completed: 2026-07-03
---

# Phase 136 Plan 04: Publish-Gate Status Line + Override Record Summary

**The thin eval surface now shows publish readiness at a glance: a plain server-computed D-06 gate-status line (met "eval passed X/N on the current version" vs the honest per-state unmet copy) plus the owner-visible D-02 override record ("Published without a passing eval on <date>"), both hydrated from getPublishGate on mount — server fields only, no client-side gate math (D-07), additive/undesigned (137 fence).**

## Performance

- **Duration:** ~6 min
- **Tasks:** 1 (`type="auto"`)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **D-06 gate-status line.** Added `publishGate` local state (`PublishGate | null`) hydrated on mount by calling `getPublishGate(skillId)` inside the existing `useEffect [skillId]` init block (the same place proposals load), refetch-not-optimistic, and reset on skill switch alongside the eval/proposal state (skill-switch safe). Rendered a plain status line near the top of the section (right under the "Eval runner" header): **met** → "Publish ready — eval passed {passed}/{measured} on the current version"; **unmet** → the honest per-`state` copy via a `unmetGateLine` helper (`never_evaled` → "Not publishable yet — run an eval on the current version"; `latest_failed` → "Not publishable — the latest eval on the current version failed"; `passed_on_older_version` → "Not publishable — the last passing eval was on an older version; re-eval to publish"), echoing the server `reason` as a secondary muted sub-line.
- **D-02 owner-visible override record.** When `publishGate.last_override` is present, a plain "Published without a passing eval on {toLocaleDateString(created_at)}" line renders — the honest force-publish trail, straight from the owner-scoped server read (`last_override` comes from the owner-only `skill_publish_overrides` via `getPublishGate`, Plans 01/02). Renders in both branches so the record persists even after a later passing eval.
- **Server-computed only (D-07).** The component reads `publishGate.met/passed/measured/state/reason/last_override` and never recomputes the gate client-side (grep-confirmed no `met`/pass recomputation). Zero new design-system imports — only plain `<div>`/`<p>` elements added (137 fence held); the only new imports are `getPublishGate` (api) and the `PublishGate` type (both shipped by Plan 03).
- **3 green component tests.** New `SkillEvalSection.test.tsx` fully mocks `@/lib/api` (getProviders/listEvalRuns/listProposals resolve empty + subscribeToRun a no-op) so the component mounts with `getPublishGate` as the unit under test: (a) met passed=2 measured=2 → the "passed 2/2" publish-ready line; (b) unmet never_evaled → the "Not publishable yet — run an eval" pointer; (c) last_override set → the "Published without a passing eval" override record.

## Task Commits

1. **Task 1: Gate-status line + override record in SkillEvalSection + test** — `69f2dca1` (feat)

## Files Created/Modified

- `frontend/src/components/skills/SkillEvalSection.tsx` — added `getPublishGate`/`PublishGate` imports, a `unmetGateLine(state)` helper (honest per-state copy), `publishGate` local state + its skill-switch reset + mount hydration inside the `useEffect [skillId]` init block, and the plain gate-status line + override record render near the top of the section
- `frontend/src/components/skills/SkillEvalSection.test.tsx` — NEW: 3 vitest cases (met X/N; unmet never_evaled pointer; last_override record) with `@/lib/api` fully mocked

## Decisions Made

1. **Line placement at the top of the section.** The gate line renders directly under the "Eval runner" header (before the provider/model picker) so publish readiness reads at a glance — the D-06 intent.
2. **Honest state copy + echoed server reason.** The unmet branch renders the fixed per-`state` pointer AND the server `publishGate.reason` as a secondary muted sub-line — honest server evidence without the two duplicating each other.
3. **Override record renders in both branches.** `last_override` is not gated on `met`, because a skill can be force-published and later pass an eval; the honest override trail must persist regardless of the current met state (D-02).

## Deviations from Plan

None — plan executed exactly as written. (One environment-only setup step, not a code change: the git worktree ships without `frontend/node_modules`, so a Windows directory junction was created to the main checkout's `frontend/node_modules` to run `vitest`/`tsc`. `node_modules` is gitignored — the junction is not tracked and does not appear in the diff.)

## Known Stubs

None. Every rendered value in the gate line is server-sourced from `getPublishGate`; there are no hardcoded empty values flowing to the UI. The `unmetGateLine` `default` case returns the `never_evaled` copy defensively — the `"passed"` state never reaches it (the met branch renders the satisfied X/N line), so it is a safety fallback, not a stub.

## Threat Surface Scan

No new threat surface. Frontend-only diff (verified: `git diff --name-only` vs base shows exactly the 2 planned `frontend/**` files — no backend / agent-loop / `threads.py` touch, D-10). The plan's registered mitigations hold: **T-136-03** (forged gate) — the line renders server `PublishGate` fields only, no client-side met/pass math; **T-136-04** (IDOR on the override record) — `last_override` comes from the owner-scoped `getPublishGate` (server `.eq(user_id)` + owner-only RLS on `skill_publish_overrides`, Plans 01/02); the client only renders what the owner is entitled to see. No new network endpoints, auth paths, or schema changes. No threat flags.

## Verification

- `npm run test -- SkillEvalSection --run` → **3 passed** (1 file, 3 tests)
- `npx tsc --noEmit -p tsconfig.json` → **clean (exit 0)** across the whole project incl. the new files
- `git diff --name-only` vs base = exactly `SkillEvalSection.tsx` + `SkillEvalSection.test.tsx` (D-10 red line held; frontend-only, additive, 137 fence — no redesign, no new design-system chrome)
- grep confirms `getPublishGate(skillId)` is called inside the `useEffect [skillId]` hydration (not on every render) and no client-side `met`/pass recomputation exists
- G-4 lived UAT of the status line + override record is a phase-gate manual check (136-VALIDATION.md Manual-Only), not automated here

## Next Phase Readiness

- **Phase 137 (PANEL-01, G-2)** owns the designed publish/evals panel; this gate line is deliberately thin (plain text, reusing the surface's honest-counts style) and is the seam it will re-skin. The `getPublishGate` client + `PublishGate` type + this render together are the read-model 137 inherits.
- No blockers. This is the final plan of Phase 136 (GATE-01) — the server gate (Plans 01/02), the thin publish UX + SkillCard intercept (Plan 03), and the owner-visible readiness/override line (this plan) are all in place.

## Self-Check: PASSED

- Both files exist on disk (verified via `git diff --name-only` vs base): `SkillEvalSection.tsx` (modified), `SkillEvalSection.test.tsx` (created)
- Task commit exists in git log: `69f2dca1` (feat)
- Test suite green (3/3 SkillEvalSection) + tsc clean at HEAD

---
*Phase: 136-skill-publish-gate-gate-01*
*Completed: 2026-07-03*
