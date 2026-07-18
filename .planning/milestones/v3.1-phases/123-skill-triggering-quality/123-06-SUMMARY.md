---
phase: 123-skill-triggering-quality
plan: 06
subsystem: frontend
tags: [skills, lint, trig-03, tune-this-handoff, builder-model, d-08, settings, react, no-spof]

# Dependency graph
requires:
  - phase: 123-01 skill_lint + SkillResponse.lint_warnings
    provides: "the {code, message} warnings the POST/PATCH /skills response carries (the inline lint renders these)"
  - phase: 123-03 skill_builder_model + resolve_skill_builder_model
    provides: "the D-08 app_settings field + resolver the Settings picker reads/writes"
  - phase: 123-05 onTuneSkill navigator + skill-tuner ActiveView
    provides: "the verified App -> ChatLayout -> 'skill-tuner' navigator the 'Tune this' handoff reuses"
provides:
  - "SkillLintWarning + Skill.lint_warnings types (mirror Plan 01's response shape)"
  - "Inline never-block weak-description lint under the Description textarea in the SHARED SkillForm (covers SkillFormDialog modal + SkillDetailPanel 3-pane from ONE place) with the SPECIFIC reason codes; silent-when-healthy (D-09)"
  - "One-click 'Tune this' handoff reusing the verified onTuneSkill navigator (D-12 -> TRIG-03->TRIG-01 one flow)"
  - "The D-08 skill_builder_model picker in Settings (full provider list incl. local, strong default, always-on cloud/local footer, decoupled-from-targets note, no paid-provider SPOF)"
  - "skill_builder_model + resolved_skill_builder_model wired through the /settings router (FullSettingsResponse + SettingsUpdate) + the api.ts types — the read/write path the picker needs"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render the save-time lint in the SHARED inner SkillForm (one mount point) so both the modal and the 3-pane detail panel get the warning + 'Tune this' for free"
    - "Widen onSave to Promise<Skill | void> so the form can capture the returned lint_warnings; the save ALWAYS proceeds (warn-never-block, D-09) — the modal stays OPEN only when warnings fire"
    - "Reuse the verified upstream navigator (onTuneSkill) for the 'Tune this' handoff — never a parallel navigation path"
    - "The builder-model picker mirrors the Phase-111.1 provider-picker always-on cloud/local footer; options span cloud + local so no paid provider is a single point of failure (the 111.1 embedding-SPOF removal pattern)"

key-files:
  created:
    - frontend/src/components/skills/SkillFormDialog.test.tsx
    - frontend/src/pages/SettingsPage.test.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/components/skills/SkillFormDialog.tsx
    - frontend/src/pages/SkillsPage.tsx
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/lib/api.ts
    - backend/app/api/settings.py

key-decisions:
  - "The inline lint renders in the SHARED inner SkillForm directly under the Description Textarea (variant A) — ONE mount covers both SkillFormDialog (modal) and SkillDetailPanel (3-pane)."
  - "onSave widened to Promise<Skill | void> so the form captures the returned lint_warnings. The save NEVER blocks (D-09); the MODAL stays open only when warnings fire (so 'Tune this' is reachable), the 3-pane panel already stays open after a save."
  - "[Rule 3] Wired skill_builder_model through the /settings router (response + update model + handler) + api.ts. Plan 03 added the UserEffectiveSettings field + resolver but NOT the router surface, so getSettings/updateSettings could not read/write it — the must-have (the control reads/writes the app_settings field) was unsatisfiable without it. Minimal additive change; no migration, no new package."
  - "The picker offers cloud + LOCAL options (Ollama/LM Studio/OpenAI-compat/DeepSeek-on-own-infra); the no-SPOF contract is test-PROVEN (SettingsPage.test.tsx asserts >=1 local option), not just a source grep."

requirements-completed: [TRIG-03, TRIG-01]

# Metrics
duration: ~30min
completed: 2026-06-24
---

# Phase 123 Plan 06: Inline Lint + "Tune this" + Builder-Model Picker Summary

**Closes the TRIG-03 authoring loop in the UI (sketch 044-A): a never-block weak-description lint renders inline under the Description textarea in the SHARED `SkillForm` (so both the modal `SkillFormDialog` and the 3-pane `SkillDetailPanel` get it from one place) with the specific reason codes and a one-click "Tune this" that reuses the verified Plan-05 `onTuneSkill` navigator into the Trigger Tuner (D-12); plus the D-08 `skill_builder_model` picker in Settings — full provider list incl. local, strong default, always-on cloud/local footer, decoupled from the benchmark targets, no paid-provider SPOF (test-proven).**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (Task 1 TDD on the render; Task 2 TDD on the local-option contract)
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- **Task 1 — inline lint + "Tune this" (`50c1c02b`):**
  - Added `SkillLintWarning` + `Skill.lint_warnings?` to `types/index.ts` (mirrors the Plan-01 `SkillResponse.lint_warnings` `{code, message}` shape — no `api.ts` skill edit needed; `createSkill`/`updateSkill` already return the payload).
  - The shared inner `SkillForm` now renders the warning DIRECTLY under the Description `<Textarea>` (variant A) — each warning's SPECIFIC message + a "Tune this" button — when `lint_warnings` are present; renders nothing when empty/absent (silent-when-healthy). The save ALWAYS proceeds (warn-never-block, D-09); the MODAL stays open only when warnings fire so "Tune this" is reachable.
  - `onSave` widened to `Promise<Skill | void>`; the form captures the returned skill's `lint_warnings` + id. `SkillsPage.handleSave` now RETURNS the saved skill, and threads `onTuneSkill` the last hop into `SkillDetailPanel`. "Tune this" fires `onTuneSkill(skillId)` — the exact verified navigator, no parallel path.
  - `SkillFormDialog.test.tsx`: 4 behaviors GREEN — specific-reason render + "Tune this" present on warnings; NO warning when empty (silent-when-healthy); the save still completes with warnings present (never blocks); clicking "Tune this" fires `onTuneSkill` with the skill's id.
- **Task 2 — the D-08 builder-model picker (`2378b20d`):**
  - Added a "Skill Trigger Tuner" SectionCard to the AI Model tab with a `skill_builder_model` `<select>` spanning cloud + LOCAL options (Ollama / LM Studio / OpenAI-compat / DeepSeek-on-own-infra). Shows the strong resolved default when unset (`Auto · {resolved} (recommended)`); an always-on cloud/local footer (mirrors the 111.1 endpoint footer); and the explicit "the builder writes; the targets measure — decoupled by design" note. A non-preset persisted id stays selectable (round-trip never drops it).
  - State + hydrate (`skill_builder_model` / `resolved_skill_builder_model`) + save-body (`skill_builder_model`) wired through `handleSaveAIModel`.
  - **[Rule 3] Wired the field through the `/settings` router** — Plan 03 added `skill_builder_model` to `UserEffectiveSettings` + `resolve_skill_builder_model()`, but the router's `FullSettingsResponse` + `SettingsUpdate` did NOT surface it, so `getSettings`/`updateSettings` could not read/write it. Added `skill_builder_model` + `resolved_skill_builder_model` to `FullSettingsResponse`, `skill_builder_model` to `SettingsUpdate` + the update handler, and the matching `api.ts` types. Minimal additive change; no migration, no new package; backend imports clean (no cycle).
  - `SettingsPage.test.tsx` (TDD): asserts the picker offers >=1 LOCAL-provider option (no paid-only SPOF, T-123-06-02) + the strong default renders when unset.

## Task Commits

1. **Task 1: inline never-block lint + "Tune this" handoff (TRIG-03)** — `50c1c02b` (feat)
2. **Task 2: D-08 skill-builder model picker in Settings, no SPOF (TRIG-01)** — `2378b20d` (feat)

**Plan metadata:** (final docs commit — this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md)

## Files Created/Modified

- `frontend/src/types/index.ts` (modified) — `SkillLintWarning` + `Skill.lint_warnings?`.
- `frontend/src/components/skills/SkillFormDialog.tsx` (modified) — inline lint under Description in the shared `SkillForm` + "Tune this"; `onTuneSkill` prop on both `SkillFormDialog` + `SkillDetailPanel`; `onSave` widened to capture `lint_warnings`.
- `frontend/src/components/skills/SkillFormDialog.test.tsx` (created) — 4 behaviors (specific-reason render, silent-when-healthy, save-never-blocks, Tune-this fires `onTuneSkill`).
- `frontend/src/pages/SkillsPage.tsx` (modified) — `handleSave` returns the saved skill; threads `onTuneSkill` into `SkillDetailPanel`.
- `frontend/src/pages/SettingsPage.tsx` (modified) — the D-08 builder-model picker + state/hydrate/save wiring + `SKILL_BUILDER_MODEL_OPTIONS`.
- `frontend/src/pages/SettingsPage.test.tsx` (created) — the no-SPOF local-option assertion + strong-default render.
- `frontend/src/lib/api.ts` (modified) — `skill_builder_model` + `resolved_skill_builder_model` on `FullAppSettings`; `skill_builder_model` on `SettingsUpdate`.
- `backend/app/api/settings.py` (modified) — `skill_builder_model` + `resolved_skill_builder_model` on `FullSettingsResponse`, `skill_builder_model` on `SettingsUpdate` + the update handler, `resolve_skill_builder_model` import.

## Deviations from Plan

**Auto-fixed Issues**

**1. [Rule 3 - Blocking] Wired `skill_builder_model` through the `/settings` router**
- **Found during:** Task 2 (the must-have "The control reads/writes the app_settings skill_builder_model field").
- **Issue:** The plan's `<interfaces>` + the orchestrator's verified-upstream-seams note both assert "the existing settings read/write api (getSettings/updateSettings) handles it." It does NOT — Plan 03 added the field to `UserEffectiveSettings` + `resolve_skill_builder_model()`, but the settings ROUTER (`backend/app/api/settings.py`) uses its own `FullSettingsResponse` + `SettingsUpdate` models that never included the field (same pattern as `extraction_model`, which IS in the router). Without wiring, the picker could render but could never persist or read back its value — the must-have was unsatisfiable.
- **Fix:** Added `skill_builder_model` + `resolved_skill_builder_model` to `FullSettingsResponse` (the resolved label via `resolve_skill_builder_model(s)`), `skill_builder_model` to `SettingsUpdate` + the update handler (no provider-list validation — the resolver owns the default + honest-None floor; decoupled from the targets), and the matching `api.ts` types. Minimal, additive, no migration, no new package.
- **Files modified:** `backend/app/api/settings.py`, `frontend/src/lib/api.ts`.
- **Commit:** `2378b20d`.
- **Verified:** backend imports clean (no cycle); `test_settings.py` + `test_settings_cache.py` 11/11 green; `test_skill_builder_model.py` 5/5 green.

The plan said "This plan does NOT edit `frontend/src/lib/api.ts`" — that scope note was predicated on the (incorrect) assumption that the settings contract already carried the field. The api.ts + settings.py edits are the minimal Rule-3 closure of that gap; the api.ts skill calls were NOT touched (the lint_warnings path needed only the TS type, exactly as planned).

## Threat Surface

All trust boundaries from the plan's `<threat_model>` are honored:
- **T-123-06-01 (silent/non-specific lint):** the inline warning renders the SPECIFIC reason codes from `lint_warnings` (each `{message}` verbatim); silent ONLY when the list is empty. Tests assert specific-reason render + silent-when-healthy. Never-block by design (D-09).
- **T-123-06-02 (paid-provider SPOF):** the picker offers cloud + LOCAL options; `SettingsPage.test.tsx` asserts >=1 local option is present (not just a source grep). The resolver (Plan 03) keeps the honest-None floor.
- **T-123-06-03 (builder-model id as secret):** a model id is a VALUE not a secret -> it rides the settings contract (CLAUDE.md). No API key is rendered or echoed by this control.
- **T-123-06-SC (npm/pip installs):** zero new packages this plan.

No new security surface beyond the plan's threat model. No threat flags.

## Known Stubs

None. The `SKILL_BUILDER_MODEL_OPTIONS` list is an explicit, honest preset roster (a non-preset persisted id stays selectable, so a custom local id is never dropped); the lint warnings render from the live server response; "Tune this" navigates via the real Plan-05 seam. No hardcoded empty data flows to the UI.

## Issues Encountered

- The current `onSave` callback returned `Promise<void>` and the modal closed on save, so neither surface could see `lint_warnings`. Resolved by widening `onSave` to `Promise<Skill | void>`, having `SkillsPage.handleSave` return the saved skill, and keeping the modal open only when warnings fire — none of this changes the healthy-save UX (the modal still closes when clean).

## Verification

- `npx vitest run src/components/skills/SkillFormDialog.test.tsx` — 4/4 GREEN.
- `npx vitest run src/pages/SettingsPage.test.tsx` — 2/2 GREEN (the no-SPOF local-option gate + strong-default render).
- Adjacent-suite regression spot-check: `src/components/skills/tuner/ProviderScoreboard.test.tsx` — 7/7 GREEN (the SkillsPage/types edits did not regress Plan 05).
- `npx tsc --noEmit` — clean (exit 0) after each task.
- Backend: `test_settings.py` + `test_settings_cache.py` 11/11 GREEN; `test_skill_builder_model.py` 5/5 GREEN; settings.py imports clean (no cycle, all 3 new fields present).
- Grep gates: `lint_warnings/lintWarnings/SkillLintWarning` >=1 in SkillFormDialog.tsx (15) + types/index.ts (3); `Tune this|onTuneSkill|onTuneThis` >=2 in SkillFormDialog.tsx (18); `skill_builder_model|skillBuilderModel|SKILL_BUILDER_MODEL` in SettingsPage.tsx (11). All pass.
- SC#10 4-axis cross-provider UAT remains the phase-verification DEV gate authored in `123-VALIDATION.md` (not runtime code).

## Self-Check: PASSED

- All 2 created files + the SUMMARY exist on disk.
- Both task commits present in git history (`50c1c02b`, `2378b20d`).
- All plan tests GREEN; tsc clean; all acceptance grep gates pass.

---
*Phase: 123-skill-triggering-quality*
*Completed: 2026-06-24*
