---
phase: 132-skill-versioning-eval-test-case-persistence
plan: 03
subsystem: frontend-skills
tags: [react, vite, fetch-client, skills, eval, skill-versioning, thin-surface, skip-ui, owner-scoping]

# Dependency graph
requires:
  - phase: 132-02
    provides: "Owner-scoped test-case CRUD API (GET/POST /skills/{id}/test-cases, PATCH/DELETE /test-cases/{id}) + read-only version-history API (GET /skills/{id}/versions, version_number DESC)"
  - phase: 132-01
    provides: "public.skill_test_cases + public.skill_versions tables (live), capture trigger, append-only immutability, owner-only RLS, v1 backfill"
  - phase: 017-skills
    provides: "SkillFormDialog / SkillDetailPanel skill-edit surface + listSkills/createSkill/updateSkill/deleteSkill api.ts client pattern (mirrored here)"
provides:
  - "Test-case CRUD + version-list client functions in api.ts (listTestCases/createTestCase/updateTestCase/deleteTestCase/listSkillVersions)"
  - "TestCase/TestCaseCreate/TestCaseUpdate/SkillVersion TS wire-mirror types"
  - "SkillTestCasesSection — thin/non-designed test-case editor + read-only version-history list, mounted in SkillDetailPanel for an existing skill"
  - "EVAL-01 + VER-01 observable end-to-end in the app (the usable 132 foundation surface)"
affects: [137-evals-panel-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wire-mirror TS types match backend Pydantic shapes byte-for-byte (snake_case); no client-side reshape"
    - "fetch client mirrors the existing skill funcs exactly (getAuthHeaders → fetch → typed json cast); owner-scoping enforced server-side, client is not a security boundary"
    - "Thin/non-designed surface on purpose (--skip-ui operator scope fence): reuses existing Input/Textarea/Button only, no panel/tab chrome — Phase 137 (PANEL-01, G-2) owns the designed Evals panel"
    - "Mount gated on savedSkillId so the section only renders for an existing/saved skill (never during brand-new-skill creation)"

key-files:
  created:
    - "frontend/src/components/skills/SkillTestCasesSection.tsx"
  modified:
    - "frontend/src/types/index.ts (TestCase/TestCaseCreate/TestCaseUpdate/SkillVersion)"
    - "frontend/src/lib/api.ts (5 client funcs + type import)"
    - "frontend/src/components/skills/SkillFormDialog.tsx (import + savedSkillId-gated mount in SkillDetailPanel)"

key-decisions:
  - "Mount gated on savedSkillId (not skill?.id) so a just-saved new skill also shows the section — uniform with the existing lint/Tune-this gating in the same panel"
  - "createTestCase seeds an empty prompt/expected_behavior row that the user fills inline + Saves (matches the plain add-then-edit thin-surface intent; no separate add-dialog that would pre-empt the Phase 137 design)"
  - "Kept the surface deliberately plain (no tabs, no panel chrome, no new design-system primitives) per the operator scope fence — Phase 137 (PANEL-01, G-2) is the sketch-gated designed Evals panel"

patterns-established:
  - "Net-new thin frontend section mounted into an existing edit surface, gated on a saved id, reusing the established api.ts fetch/typed-cast client pattern"

requirements-completed: [EVAL-01, VER-01]

# Metrics
duration: ~30min
completed: 2026-06-30
---

# Phase 132 Plan 03: Thin Test-Case Editor + Version-History Surface Summary

**A deliberately thin, non-designed frontend surface makes the 132 persistence foundation usable end-to-end: typed fetch-client functions over the Plan 02 owner-scoped routes, plus a `SkillTestCasesSection` (add/edit/delete test cases + a read-only version-history list) mounted in the existing skill detail panel for a saved skill — EVAL-01 and VER-01 are now observable in the app, with the designed Evals panel intentionally reserved for Phase 137 (PANEL-01, G-2).**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 (Task 1 client+types autonomous; Task 2 component+mount autonomous; Task 3 operator human-verify gate)
- **Files:** 4 (1 created + 3 modified)

## Accomplishments

- **Wire-mirror types** (`frontend/src/types/index.ts`): `TestCase` / `TestCaseCreate` / `TestCaseUpdate` / `SkillVersion`, matching the Plan 02 Pydantic shapes byte-for-byte (snake_case, `expected_behavior` free text, no provider/model fields — D-06/D-08).
- **Five client functions** (`frontend/src/lib/api.ts`), each mirroring the existing `listSkills`/`createSkill`/`updateSkill`/`deleteSkill` pattern (`getAuthHeaders` → `fetch` → typed `json()` cast):
  - `listTestCases(skillId)` → GET `/skills/{id}/test-cases`
  - `createTestCase(skillId, body)` → POST `/skills/{id}/test-cases`
  - `updateTestCase(caseId, body)` → PATCH `/test-cases/{id}`
  - `deleteTestCase(caseId)` → DELETE `/test-cases/{id}`
  - `listSkillVersions(skillId)` → GET `/skills/{id}/versions`
  - Owner-scoping is enforced server-side on every route (Plan 02 `.eq("user_id", …)`); this is a thin client and not itself a security boundary.
- **`SkillTestCasesSection.tsx`** (new, ~230 lines incl. the post-UAT fix): loads cases + versions on mount, renders an add/edit/delete test-case list (inline `Input` prompt + `Textarea` expected-behavior, per-row Save + Delete, reload after each mutation) and a read-only version-history list showing `v{version_number} · {source} · {created_at}` newest-first. Deliberately non-designed (no tabs, no panel chrome, no new design-system primitives — only the existing `Input`/`Textarea`/`Button`), with a header comment marking it as the thin 132 foundation superseded by Phase 137 (PANEL-01, G-2).
- **Mounted in `SkillDetailPanel`** (`SkillFormDialog.tsx`) below the existing form fields, gated on `savedSkillId` so it renders only for an existing/saved skill (never during brand-new-skill creation).
- **Operator end-to-end UAT (G-4, Task 3) PASSED** — see Authentication / Verification Gates below.

## Task Commits

1. **Task 1: API client + types** — `24c2dfed` (feat) — 4 wire-mirror types + 5 fetch-client funcs; `npx tsc --noEmit` clean.
2. **Task 2: thin SkillTestCasesSection mounted** — `00a36a58` (feat) — new component + `savedSkillId`-gated mount in SkillDetailPanel; deferred-items log of pre-existing build rot.
3. **Post-UAT fix: transient "Saved ✓" confirmation** — `b529af46` (fix) — see Deviations.

## Files Created/Modified

- `frontend/src/components/skills/SkillTestCasesSection.tsx` — thin add/edit/delete test-case editor + read-only version-history list (created)
- `frontend/src/types/index.ts` — `TestCase` / `TestCaseCreate` / `TestCaseUpdate` / `SkillVersion`
- `frontend/src/lib/api.ts` — 5 client funcs + type import
- `frontend/src/components/skills/SkillFormDialog.tsx` — `SkillTestCasesSection` import + `savedSkillId`-gated mount in `SkillDetailPanel`

## Decisions Made

- **Mount gated on `savedSkillId`** (not `skill?.id`) so a just-saved new skill also shows the section — uniform with the existing lint / "Tune this" gating already in the same panel.
- **`createTestCase` seeds an empty row** the user fills inline + Saves (plain add-then-edit), rather than a separate add-dialog that would pre-empt the Phase 137 design.
- **Kept the surface deliberately plain** (no tabs/panel chrome/new primitives) per the operator scope fence — Phase 137 (PANEL-01, G-2) is the sketch-gated designed Evals panel.

## Deviations from Plan

### Auto-fixed / post-UAT polish

**1. [G-4 lived-experience UAT] Transient "Saved ✓" confirmation on the test-case Save button** — `b529af46` (fix)
- **Found during:** Task 3 operator UAT.
- **Issue:** A successful Save only signaled by the button greying out (`disabled` once `!dirty`), which read as "stuck" rather than "saved".
- **Fix:** Added an ~8-line transient indicator (`savedId` state + 2 s timeout + a green "Saved ✓" span shown when `savedId === tc.id && !dirty`). Stays within the plain-on-purpose thin surface; introduces no designed structure (Phase 137 still owns the designed Evals panel). `tsc` clean for the file.
- **Files modified:** `frontend/src/components/skills/SkillTestCasesSection.tsx`.

## Authentication / Verification Gates

**Task 3 — operator end-to-end human-verify gate (G-4): PASSED (operator confirmed "verified", 2026-06-30).**
- "Eval test cases" section appears in the skill detail panel. ✓
- Add test case persists across reload; edit persists; delete removes. ✓ (independently confirmed via live HTTP API: POST 201 / PATCH 200 / DELETE 204, owner-scoped token.)
- Version history shows `v1 · backfill`; changing instructions adds a new version (`v2 · manual`); toggling enabled/global adds NO version (D-02). ✓ (independently confirmed against the live applied DB via the capture trigger, rolled back — no dev data mutated; immutability UPDATE blocked SQLSTATE 23514.)

## Deferred Issues

- **Pre-existing frontend build rot (NOT a Plan 03 regression):** `npm run build` (`tsc -b && vite build`) reports **29 pre-existing `tsc -b` errors** across 16 unrelated files (`streamsStore.ts` zustand typing, `SkillFormDialog.tsx` lines 369/520 `fileInputRef` React-19 ref-typing, `SettingsPage.tsx`, `NavPanel.tsx`, ~9 `*.test.ts(x)`, etc.). Verified pre-existing by stash-comparing against HEAD: the error count is **identical (29) with and without Plan 03's changes** — Plan 03's own files add **zero** new errors, and Task 1 `npx tsc --noEmit` (root config) passed clean. This matches the project's `CLAUDE.md` note that `vercel.json`'s `vite build` deliberately skips `tsc` because local `tsc -b` is known-red (SEED-056 frontend rot). Logged to `deferred-items.md`; out of this plan's scope to fix.
- **Context (no action):** the "Weak trigger description" hint the operator saw is the pre-existing Phase 123 skill-triggering lint feature, unrelated to Plan 03.

## Threat Flags

None — no new security surface beyond the planned threat model. Owner-scoping is enforced server-side (Plan 02 T-132-06/07/08); the UI is a thin client that only renders what the owner-scoped API returns (T-132-10 mitigate; T-132-11 / T-132-SC accept — no new packages, fetch + existing primitives only).

## Next Phase Readiness

- EVAL-01 (define/save/edit/delete cases that persist) and VER-01 (read version history) are now observable end-to-end in the app — the usable 132 foundation. Phase 137 (Skill Evals Panel UI, PANEL-01, G-2) is the sketch-gated designed consolidation that supersedes this thin surface; Phase 133 (eval runner, EVAL-02) consumes the stable `skill_test_cases` / `skill_versions` PKs.
- **Deploy-time note (not now):** pure app-code (frontend) — no new migration. Migration 079 cloud-apply remains pending the next operator-gated deploy (per Plan 01).

## Self-Check: PASSED

- `frontend/src/components/skills/SkillTestCasesSection.tsx` — FOUND
- `frontend/src/types/index.ts` contains TestCase/TestCaseCreate/TestCaseUpdate/SkillVersion — FOUND
- `frontend/src/lib/api.ts` contains listTestCases/createTestCase/updateTestCase/deleteTestCase/listSkillVersions — FOUND
- `frontend/src/components/skills/SkillFormDialog.tsx` mounts SkillTestCasesSection — FOUND
- Commits `24c2dfed` / `00a36a58` / `b529af46` — all FOUND in git history
- Task 1 `npx tsc --noEmit` clean; Task 2 `npm run build` adds zero new `tsc -b` errors (29 == 29 stash-compare); Task 3 operator UAT verified

---
*Phase: 132-skill-versioning-eval-test-case-persistence*
*Completed: 2026-06-30*
