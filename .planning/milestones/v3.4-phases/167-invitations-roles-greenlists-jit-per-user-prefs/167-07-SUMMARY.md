---
phase: 167-invitations-roles-greenlists-jit-per-user-prefs
plan: 07
subsystem: ui
tags: [settings, model-picker, seed-116, two-layer, feature-visibility, greenlist, rbac, vis-01, vis-02, react]

# Dependency graph
requires:
  - phase: 167-04
    provides: GET/PUT /me/preferences ({default_model, effective_model, locked, allowed_models}) — the SEED-116 two-layer backend contract
  - phase: 167-03
    provides: PUT /admin/visibility accepting audience='role' + allowlist-validated roles[] (the greenlist resolver + write)
  - phase: 167-05
    provides: the Wave-3 api.ts additions this plan builds on (no api.ts merge conflict — Wave 4)
  - phase: 137.1
    provides: the JudgeModelPicker 024-A idiom (registry-only select + always-on 🔒 footer) cloned by ModelDefaultPreference
  - phase: 148
    provides: the shipped FeatureVisibility binary audience toggle extended in place with the role greenlist
provides:
  - "VIS-02 per-user model-default picker (ModelDefaultPreference) — registry-only options + honest operator-lock 🔒 footer, in Settings"
  - "api.ts client: getModelDefault/setModelDefault (/me/preferences) + setFeatureAudience (role greenlist write) + ModelDefault/GreenlistRole types"
  - "VIS-01 minimal greenlist admin surface — a 3rd 'By role' audience + 4-tier role-chip picker on the Control Room feature-visibility toggle"
affects: [SEED-117, settings-ui, operator-visibility-ui, greenlist-groups-future-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SEED-116 two-layer UI proof: registry-only select over allowed_models + an always-on lock footer that disables the control + names the governed default when the operator lock is on"
    - "Server-derived picker (no optimistic store): every read/write returns the full {default_model, effective_model, locked, allowed_models} view and the component renders off it"
    - "Extend-never-fork audience control: the SEED-115 enum forward-compat contract let the `role` greenlist drop in as a 3rd segment with the binary path byte-identical"

key-files:
  created:
    - frontend/src/components/settings/ModelDefaultPreference.tsx
    - frontend/src/components/settings/ModelDefaultPreference.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/components/admin/FeatureVisibility.tsx
    - frontend/src/components/admin/ControlRoomPage.tsx

key-decisions:
  - "ModelDefaultPreference is self-fetching (no props): getModelDefault returns allowed_models, so the picker needs no page state — mirrors the self-contained EngineHealthCard/JudgeModelPicker infra cards"
  - "The locked 🔒 footer goes amber + says 'Set by your administrator: <model>' (operator-governance vocabulary); unlocked reads calm org-indigo 'Effective model: <model>' — never blank"
  - "Mounted the per-user picker at the top of the Settings AI Model tab (the SEED-116 personal-preferences home), NOT the operator Control Room"
  - "Role greenlist reuses org-indigo (a targeted grant), distinct from operators-only amber (a lock-down) and everyone/neutral — location + colour carry meaning (069-A rule)"
  - "Role flips route through setFeatureAudience; everyone/operators keep the binary setFeatureVisibility path (TS narrows audience to the binary enum in the else-branch)"

patterns-established:
  - "Two-layer per-user preference UI (SEED-116): the reusable picker shape SEED-117's broader prefs bundle will follow"
  - "The audience segmented control is now a 3-position enum (everyone|operators|role) — the SEED-115 extensible-audience contract realized"

requirements-completed: [VIS-01, VIS-02]

# Metrics
duration: 35min
completed: 2026-07-22
---

# Phase 167 Plan 07: Access-Projection Pickers (VIS-01 + VIS-02) Summary

**Shipped the two access-projection surfaces by cloning shipped idioms — the VIS-02 per-user default-model picker (registry-only `<select>` over the operator/org-allowed set + an always-on 🔒 footer that disables the control and names the governed default when the operator lock is on) in Settings, and the minimal VIS-01 greenlist admin surface (a 3rd "By role" audience + a 4-tier role-chip picker extending the shipped Control Room feature-visibility toggle) — zero new packages, no new design.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-21T20:25Z (approx)
- **Completed:** 2026-07-21T21:00Z
- **Tasks:** 3 (Task 2 was TDD: RED → GREEN)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- **VIS-02 two-layer model-default picker** — `ModelDefaultPreference` clones the 024-A JudgeModelPicker: a registry-only `<select>` offering ONLY `allowed_models` (dedupe+sort; an unknown persisted value stays selectable as "(current)" so a round-trip never drops it), save-on-select that re-reads the server-derived `{default_model, effective_model, locked, allowed_models}` view, and an ALWAYS-ON 🔒 footer that never reads blank. When the operator lock is on, the select is DISABLED and the footer names the governed default (the SEED-116 two-layer proof, T-167-14b — the disable is courtesy, the server is the wall). Mounted at the top of the Settings AI Model tab (the personal-preferences home).
- **VIS-01 minimal greenlist admin surface** — extended the shipped `FeatureVisibility` toggle (the leaf ControlRoomPage renders) with a 3rd "By role" audience segment + a 4-tier role-chip picker (member / dept-admin / org-admin / super-admin). Role flips route through `setFeatureAudience(feature, 'role', roles[])`; the server allowlist-validates roles ⊆ the 4-tier set (Plan 03, 400 on a bad role) — the control is render-only. Rich group management stays deferred.
- **api.ts client** — `getModelDefault`/`setModelDefault` (GET/PUT `/me/preferences`, server-derived, `?? fallback` unwrap), the `ModelDefault` interface, `setFeatureAudience` (the greenlist write), and the `GreenlistRole` 4-tier type. Each uses `getAuthHeaders()` (auto-carries `X-Org-Id`).
- **No new package, no new design** — cloned JudgeModelPicker + ProviderPicker's 🔒 footer and extended the shipped Control Room toggle in place (the SEED-115 enum contract made the 3rd audience a drop-in).

## Task Commits

Each task was committed atomically:

1. **Task 1: api.ts prefs + greenlist client fns** — `b1e66a33` (feat)
2. **Task 2 (RED): failing VIS-02 picker test** — `03820582` (test)
3. **Task 2 (GREEN): ModelDefaultPreference + Settings mount** — `db2cf75a` (feat)
4. **Task 3: role greenlist audience on the Control Room toggle** — `1e9887c6` (feat)

_TDD gate satisfied for Task 2: `test(...)` RED (component-missing import failure) → `feat(...)` GREEN (6/6). No REFACTOR commit needed._

## Files Created/Modified
- `frontend/src/components/settings/ModelDefaultPreference.tsx` (created) — the VIS-02 registry-only picker + always-on 🔒 lock footer; self-fetching + self-persisting via `/me/preferences`.
- `frontend/src/components/settings/ModelDefaultPreference.test.tsx` (created) — 6 tests: allowed-only options, save-on-select re-read, clear-to-Auto → `setModelDefault(null)`, locked→disabled+footer, unset→effective footer never blank, unknown persisted value kept as "(current)".
- `frontend/src/lib/api.ts` — `ModelDefault` interface + `getModelDefault`/`setModelDefault` (server-derived, defensive unwrap); `GreenlistRole` type + `setFeatureAudience` (role greenlist PUT /admin/visibility).
- `frontend/src/pages/SettingsPage.tsx` — mount `<ModelDefaultPreference />` at the top of the AI Model tab (personal-preferences home) + the import.
- `frontend/src/components/admin/FeatureVisibility.tsx` — widened the audience prop/handler to `everyone|operators|role`; added the "By role" segment, the 4-tier `GREENLIST_ROLES` chip picker, the role consequence line + enforcement-detail roles row; org-indigo tint for the role state.
- `frontend/src/components/admin/ControlRoomPage.tsx` — widened the `visibility` state to include `role`, added the per-feature `greenlist` map, branched `handleSetVisibility` (role → `setFeatureAudience`, else `setFeatureVisibility`), passed `greenlist` to `FeatureVisibility`.

## Decisions Made
- **`ModelDefaultPreference` is self-fetching (no props).** `getModelDefault` returns `allowed_models`, so the picker is fully self-contained — mirrors the shipped self-fetching EngineHealthCard/JudgeModelPicker infra cards rather than threading page state.
- **Locked footer goes amber + "Set by your administrator: <model>"** (the operator-governance vocabulary); unlocked reads calm org-indigo "Effective model: <model>". The effective value falls back `effective_model || default_model || "your organization's default"` so it is NEVER blank.
- **Mounted in the Settings AI Model tab**, not the operator Control Room — the SEED-116 personal-preferences home (this picker is a per-user preference every user can set, distinct from the operator/global "Active Model" default on the same tab).
- **Role greenlist uses org-indigo** (a targeted grant), distinct from operators-only amber (a lock-down) — location + colour carry meaning (the 069-A rule; amber stays reserved for operator).
- **Binary path unchanged.** `setFeatureAudience` handles only the `role` audience; everyone/operators keep the byte-identical `setFeatureVisibility` path, and TS narrows the audience to the binary enum in the else-branch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The greenlist toggle control lives in the `FeatureVisibility` leaf, not `ControlRoomPage.tsx` directly**
- **Found during:** Task 3 (minimal greenlist admin surface)
- **Issue:** The plan's Task 3 `<files>` / `files_modified` named only `frontend/src/components/admin/ControlRoomPage.tsx`, but the shipped feature-visibility audience control it says to "extend" is rendered by the `FeatureVisibility.tsx` pure leaf (ControlRoomPage owns only the audience map + the server write). Adding the role option ONLY in ControlRoomPage (the handler) with no UI would be a dead-code stub.
- **Fix:** Extended `FeatureVisibility.tsx` in place (3rd "By role" segment + 4-tier role-chip picker + role consequence line) AND wired the `setFeatureAudience` handler + greenlist state in `ControlRoomPage.tsx`. The acceptance criterion (`grep setFeatureAudience` in ControlRoomPage.tsx) holds; the honest UI lives in its child leaf.
- **Files modified:** frontend/src/components/admin/FeatureVisibility.tsx (added to the plan's named ControlRoomPage.tsx)
- **Verification:** `tsc --noEmit` exits 0; the shipped `FeatureVisibility.a11y.test.tsx` (radiogroup + the two named radios) + `ControlRoomPage.test.tsx` still pass (13/13); the full admin+settings sweep passes 188/188.
- **Committed in:** `1e9887c6` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — file-scope under-specification)
**Impact on plan:** The extension is the minimal honest implementation of the plan's stated intent ("extends the shipped ControlRoomPage feature-visibility toggle"); the plan's file list named the parent shell but the control lives in its child leaf. No scope creep — rich group management stays deferred as specified; no new package.

## Issues Encountered
- **`ControlRoomPage.test.tsx` factory-mocks `@/lib/api` with only the render-path fns.** `setFeatureAudience` (like the already-imported `setFeatureVisibility`, `disableUser`, etc.) is imported but resolves to `undefined` from the mock — safe because it is only invoked on interaction (a role flip on the Users & Access tab), which the existing suite never triggers. Confirmed by re-running: 6/6 ControlRoomPage tests green.
- **`SettingsPage.test.tsx` spreads the real `@/lib/api` (`...actual`).** The newly-mounted `ModelDefaultPreference` calls the real `getModelDefault` on mount, which throws "Not authenticated" (no session) — caught by the component's `try/catch` (error state, no fetch, no unhandled rejection). Confirmed: SettingsPage tests stay 7/7 green.

## User Setup Required
None — no external service configuration; no new env var; no migration (both backend contracts shipped in Plans 03/04).

## Next Phase Readiness
- **VIS-02 cross-provider live UAT** (OpenAI/Anthropic/Google/OpenRouter model-default routing) is authored in `167-VALIDATION.md` per the CLAUDE.md UAT recipe — to be exercised at phase verification (the picker is registry-only; routing correctness is server-side, Plan 04).
- The greenlist admin surface writes role audiences; a future groups phase only needs to populate `caller_groups` (the resolver already unions against `groups[]`, Plan 03). Rich group-management UI stays deferred.
- No blockers introduced.

## Self-Check: PASSED
- Files verified present: `ModelDefaultPreference.tsx`, `ModelDefaultPreference.test.tsx`, `api.ts`, `SettingsPage.tsx`, `FeatureVisibility.tsx`, `ControlRoomPage.tsx`.
- Commits verified in git log: `b1e66a33` (Task 1), `03820582` (RED), `db2cf75a` (GREEN), `1e9887c6` (Task 3).
- `npx vitest run src/components/settings/ModelDefaultPreference.test.tsx` → 6/6 green; `npx tsc --noEmit` → exit 0; acceptance greps satisfied (`getModelDefault|setModelDefault|setFeatureAudience` + `me/preferences` in api.ts; `locked`/`(current)`/`allowed_models` in the picker; `setFeatureAudience` + the 4-tier roles in the admin surface); no new package import.

---
*Phase: 167-invitations-roles-greenlists-jit-per-user-prefs*
*Completed: 2026-07-22*
