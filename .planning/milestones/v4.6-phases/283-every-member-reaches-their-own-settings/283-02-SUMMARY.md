---
phase: 283-every-member-reaches-their-own-settings
plan: 02
subsystem: settings / permissions / nav
tags: [settings, permissions, require_visible, model_management, nav, preferences, two-role-fence, tdd, security, bug-261004-02]

requires:
  - "283-01: settingsTabs.ts registry + AuditLogSection.tsx (the tab seam)"
  - "283-03: bounded Chunks list (only its count-gate pin is closed here)"
provides:
  - "backend/tests/unit/test_283_settings_two_role_fence.py — D-10 fence on the real require_visible chain"
  - "backend/tests/unit/test_283_settings_route_inventory.py — D-11 inventory of every /settings route + detector self-test"
  - "frontend/src/components/settings/PreferencesSection.tsx — the member-visible Preferences tab body"
  - "Preferences tab '6' and the first-visible-tab fallback in settingsTabs.ts (D-03..D-05)"
  - "an ungoverned Settings rail entry (D-01)"
  - "SettingsPage.member283.test.tsx — member/operator strips, landing, moved blocks, Reset, zero gated calls"
affects: [283 verification (D-13, D-22 scenarios 1-2 are orchestrator-owned and OWED), BUG-261004-02 close step]

tech-stack:
  added: []
  patterns:
    - "Two-role backend fence that mocks ONLY the asyncpg pool and routes the operator_users read on identity"
    - "Route inventory that reads the gated feature out of require_visible's closure cell, with a permanent detector self-test"
    - "Structural zero-gated-calls: operator TabsContent blocks are not rendered for a member, not merely unmounted"

key-files:
  created:
    - backend/tests/unit/test_283_settings_two_role_fence.py
    - backend/tests/unit/test_283_settings_route_inventory.py
    - frontend/src/components/settings/PreferencesSection.tsx
    - frontend/src/pages/__tests__/SettingsPage.member283.test.tsx
  modified:
    - frontend/src/components/settings/settingsTabs.ts
    - frontend/src/components/settings/__tests__/settingsTabs.test.ts
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/pages/SettingsPage.test.tsx
    - frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
    - frontend/src/landing/facts.ts
    - frontend/src/landing/__tests__/facts.test.ts
    - frontend/src/lib/nav-items.ts
    - frontend/src/lib/nav-items.test.ts
    - frontend/src/lib/__tests__/navItemsConnections.test.ts
    - docs/public/use/choosing-a-model.md
    - docs/public/get-started/navigating-syrel.md
    - docs/public/use/memory.md
    - docs/public/security/audit-trails.md
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "resolveSettingsTab now resolves ANY id the caller cannot see (governed, retired '5', unknown) to the first visible tab, and nothing-persisted lands on the fallback too (operator '0', member '6')"
  - "The three operator TabsContent blocks are wrapped in isSettingsTabVisible guards, so JudgeModelPicker / ReembedStatusCard / EngineHealthCard cannot mount for a member at all (D-07, RESEARCH Pitfall 9)"
  - "Preferences TabsContent is not guarded (everyone audience), matching Memory and Audit Log"
  - "No backend source changed (D-09); the API was already correct and is now proven on the real chain"

requirements-completed: [FIX-01]

duration: ~1h45m
completed: 2026-10-16
---

# Phase 283 Plan 02: Every member reaches their own Settings Summary

**A member now sees Settings in the rail and gets three tabs: Preferences ("Show technical names" plus their default chat model), Memory and Audit Log. The page opens on Preferences, has no Reset button, and makes no call to any operator-only endpoint. Operators see the same page as before, plus Preferences between Integrations and Memory. Two new backend fences check, on the real permission chain, that the API refuses the four operator routes to a member and serves the member's own settings. No backend code changed.**

## Base

- **The worktree landed on `a248672f0`** (the master merge). Its merge-base with the expected base was `60ce3797c`, so **it was reset** with `git reset --hard 8a06baca5d1fb18a595a60756e8980bd03fe539a` and then bootstrapped (`BOOTSTRAP OK`: venv and node_modules junctioned, both .env files copied).
- **PLAN_BASE = `8a06baca5`** (`docs(phase-283): update tracking after wave 1`, with 283-01 and 283-03 merged).
- **PHASE_BASE = `9a0b78622`** (from 283-01's SUMMARY). `git diff --stat 9a0b78622 HEAD -- backend` printed nothing at the start, and `git diff 9a0b78622 HEAD -- backend/app supabase/migrations` printed nothing at the end. **No backend source file and no migration changed (D-09).**
- Base files are in `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-283/`:
  - `backend_base_8a06baca5.txt` and `base_failed_8a06baca5.txt`: backend unit gate at PLAN_BASE, 71 failed / 7565 passed / 0 errors
  - `root_base_8a06baca5.txt`: `test_148_carveouts` + `test_148_require_visible` + `test_148_visibility_cold_default` + `test_249_unverified_at_pick_time` → 20 passed
  - `tsc_base_8a06baca5_02.txt`: 103 lines; `eslint_base_02.txt` and `eslint_a11y_base_02.txt` are both empty
  - `vitest_base_8a06baca5_02.json` / `.txt`: the neighbour set (`src/pages src/components/settings src/landing src/docs src/providers src/lib src/components/layout`), 151 files, 2610 passed / 4 failed. All 4 failures are in `ChatHistoryColumn.test.tsx`: "Unable to find an element with the text: Today", a date-bucket fixture inherited at base.

## Task Commits

| # | Commit | Message |
|---|---|---|
| 1 | `f24cd7206` | `test(283-02): the settings wall holds on the real gate — two roles and every route (D-10, D-11)` |
| 2 RED | `12471d1c6` | `test(283-02): a member's Settings opens on Preferences and calls nothing gated` |
| 2 GREEN | `af13d877b` | `fix(283-02): every member reaches their own Settings — Preferences tab, derived fallback, no dead Reset (FIX-01)` |
| 3 RED | `2dd9df62b` | `test(283-02): the Settings door stands for a member` |
| 3 GREEN | `aec0d23e1` | `fix(283-02): the Settings door is ungoverned — the API is the wall (FIX-01, D-01)` |
| 3 ledger | `180466d9d` | `docs(283-02): hot-file ledger — Phase 283 close on the merged tree` |
| 3 pins | `918501fca` | `chore(283-02): pin the suites Phase 283 grew` |

The Task 2 GREEN commit contains `SettingsPage.tsx`, `facts.ts` and `choosing-a-model.md` together (`git show --stat af13d877b`), as orchestrator ruling 6 requires.

## Task 1: the wall holds (D-09, D-10, D-11)

Both files passed against the unmodified backend (14 passed), because the gates already existed. The two-role fence mocks **only** `app.dependencies._pg_pool`. The `operator_users` read returns a row only for `OP`, and identity comes in through `get_current_user`. No `require_visible`, `feature_visible`, `is_operator` or `feature_audience` is overridden (acceptance grep: 0).

**What is proven:**
- **Member:** 403 with `"This feature is available to administrators only."` on `GET /settings`, `PUT /settings`, `GET /settings/reembed-progress` and `POST /settings/reembed`. Each case also checks that `operator_users` was read with `(MEMBER,)`, so the refusal came from the real `is_operator`.
- **Member:** 200 on `GET /settings/providers`. `PUT /me/preferences {"default_model":"gpt-4o"}` returns 200, and `pool.calls` holds `SET LOCAL ROLE authenticated` and `INSERT INTO public.user_settings`. `GET /me/preferences` returns 200 and reads back `gpt-4o`. `PUT` with `"not-a-model"` returns 400 and makes no INSERT. `GET /audit-logs` returns 200 with `mock_builder.eq("user_id", MEMBER)`.
- **Operator:** 200 on `GET /settings`.
- **Not widened:** `_GOVERNED_FEATURES["model_management"] == "operators"`, now pinned inside the unit gate.
- **Inventory:** the inventory is the union of routes from module `app.api.settings` and routes whose path starts with `/settings`. It has at least 5 routes, exactly 4 of them gated on `model_management`, and the only allow-listed route is `("GET", "/settings/providers")`, which must carry no gate. A permanent detector self-test builds a throwaway router and checks that the detector reports the ungated route and the one gated on `skill_studio`.

**RED (a): `dependencies=[Depends(require_visible("model_management"))]` removed from `GET /settings` only:**
```
E       AssertionError: GET /settings -> 200: {"active_provider":"openai","llm_model":"gpt-4o",...}
E       assert 200 == 403
E       assert ([])                      <- operator arm: no operator_users read happened at all
E       AssertionError: expected exactly 4 model_management-gated settings routes, got [('GET', '/settings/reembed-progress'), ('POST', '/settings/reembed'), ('PUT', '/settings')]
E       assert 3 == 4
FAILED tests/unit/test_283_settings_two_role_fence.py::test_member_is_refused_every_operator_settings_route[GET-/settings-None]
FAILED tests/unit/test_283_settings_two_role_fence.py::test_operator_reaches_get_settings
FAILED tests/unit/test_283_settings_route_inventory.py::test_every_settings_route_is_gated_on_model_management_except_the_run_carve_out
3 failed, 11 passed
```
I restored the line with the editor, not `git checkout` (autocrlf). `git diff --exit-code backend/app/api/settings.py` → exit 0.

**RED (b): an ungated `@router.get("/_planted")` added to `settings.py`:**
```
E       AssertionError: /settings route(s) reachable by EVERY member - add Depends(require_visible('model_management')) or justify an allow-list entry: [('GET', '/settings/_planted')]
FAILED tests/unit/test_283_settings_route_inventory.py::test_every_settings_route_is_gated_on_model_management_except_the_run_carve_out
1 failed, 2 passed
```
I removed it with the editor. `git diff --exit-code backend/app/api/settings.py` → exit 0.

**Green re-run:** the two new files + `test_148_carveouts.py` + `test_249_unverified_at_pick_time.py` → **28 passed**.

**Backend unit gate after the commit** (local-DB lock taken and released): `71 failed, 7579 passed, 2 xfailed, 2 xpassed, Errors: 0`. Passed went up by 14, which are the two new files. **`comm -3 base_failed_8a06baca5.txt after_failed_02.txt` is EMPTY**, so the failing set is identical to base. (The raw `FAILED` lines needed normalising, because pytest appends unraisable-exception warnings to two of them without a newline. Those are the same test ids at base and after.) Root `test_148_*` + `249`: 20 passed at base; with the new files, 28 passed.

## Task 2: the page is ready for a member (D-02..D-08, D-12)

**Plan-checker warning answered first.** SettingsPage.tsx has exactly ONE page-level `useEffect`, the `getSettings()` hydrate at the top of the component, and it already returns early for `!canManageModels`. No other page-level effect calls a gated function. The gated callers are all inside tab bodies (`JudgeModelPicker` → `getJudgeModel` → `getSettings`, `ReembedStatusCard`, `EngineHealthCard`, and `void getReembedProgress()` in the Search save handler). Those are now behind the `isSettingsTabVisible` guards on `TabsContent` "0", "1" and "2".

**RED (`12471d1c6`), run against PLAN_BASE source: 29 failed | 31 passed (60):**
- `SettingsPage.test.tsx` 2/24 failed: "lands an operator with a persisted Connections tab on AI Model" and "lands a member … on Preferences" (`Unable to find role="tab" and name /preferences/i`).
- `facts.test.ts` 1/5: `expected [ 'AI Model', …(4) ] to have a length of 6 but got 5`.
- `SettingsPage.a11y.test.tsx` 4/4: `Unable to find role="button" and name /technical names/i` (tab "6" did not exist yet).
- `settingsTabs.test.ts` 8/11, for example `expected [ '0','1','2','3','4' ] to deeply equal [ '0','1','2','6','3','4' ]`, `expected '3' to be '0'`, `expected '3' to be '6'`, `expected '9' to be '0'`, and `expected 5 to be greater than or equal to 6`.
- `SettingsPage.member283.test.tsx` 14/16: every member case (`Unable to find role="tab" and name "Preferences"`), the operator strip (`expected [ 'AI Model', 'Search', …(3) ] to deeply equal [ …(4) ]`), the moved-blocks case (`expected <p …(1)></p> to be null`: the toggle was still under AI Model), and both operator persisted-"5"/"9" cases. The two that passed at base are the operator Reset case and the `getSettings` positive control, which is expected: both check that the operator page is unchanged.

**GREEN (`af13d877b`):**
- `settingsTabs.ts`: `{ id: "6", audience: "everyone", name: "Preferences" }` sits between Integrations and Memory. `settingsTabFallback` returns `visibleSettingsTabs(canManageModels)[0].id`. `resolveSettingsTab` passes an id through only when `isSettingsTabVisible` accepts it; anything else goes to the fallback.
- `PreferencesSection.tsx`: the toggle row markup and `<ModelDefaultPreference />` are copied from tab "0". The component calls `useTechnicalNames()` itself and has no heading.
- `SettingsPage.tsx`:
  - Imports `PreferencesSection`. `ModelDefaultPreference`, `TechnicalNamesToggle`, `useTechnicalNames` and the destructure are gone. Their Phase 154/167 comments became one dated note, which quotes the "so every user can reach it (SC#3)" claim as SUPERSEDED.
  - Adds the literal `<TabsTrigger className={SETTINGS_TAB_CLASS} value="6">Preferences</TabsTrigger>` between the Integrations and Memory triggers (source lines 971 < 981 < 982), and a `<TabsContent value="6">` panel.
  - Removes the two moved blocks from tab "0".
  - Wraps TabsContent "0", "1" and "2" in `isSettingsTabVisible(...)`, and the Reset button in `canManageModels`.
  - Rewrites the page-level comment with the measured gated-route lines `:578, 587, 1004, 1033` and the `:1067` carve-out, and quotes the old `:331,341,560,589` citation as stale.
  - Leaves the `getSettings` skip, `handleReset` and the subtitle untouched.
- `facts.ts` reads `["AI Model","Search & Retrieval","Integrations","Preferences","Memory","Audit Log"]`. `choosing-a-model.md` has `covers: [E20, settings-tab:preferences]`, and its summary mentions Settings → Preferences.

**Verify set: all green.** SettingsPage.test 24/24, a11y 4/4, changedFields 23/23, sourceCeiling 9/9, member283 16/16, settingsTabs 11/11, facts 5/5, docsCoverageGate 8/8. `check-docs-coverage.cjs` exit 0 (`113 code keys`, up from 112, because `settings-tab:preferences` is now covered). `check-landing-drift.cjs` exit 0 (`zero drift`).

**What the tests see:**
- **Member tab strip:** `["Preferences", "Memory", "Audit Log"]`, with Preferences `aria-selected="true"`. Persisted "0", "1", "2", "5" and "9" all land on Preferences.
- **Operator tab strip:** `["AI Model", "Search", "Integrations", "Preferences", "Memory", "Audit Log"]` ("Search" is the term-map plain default), landing on AI Model. Persisted "5" and "9" land on AI Model.
- **Zero gated calls:** a member clicks Memory, Audit Log and Preferences, and the test asserts that none of these was called: `getSettings, updateSettings, getReembedProgress, kickReembed, getJudgeModel, setJudgeModel, getEngineHealth, runEngineSweep`. It also waits until `getAuditLogs` has been called, so the clicks really did mount the tab bodies. **The positive control is the operator render calling `getSettings`.**

**Neighbours** (`src/pages src/components/settings src/landing src/docs src/providers`, 93 files), compared per file with PLAN_BASE: **0 issues**. The only change is `SettingsPage.member283.test.tsx`, 0 → 16.

## Task 3: the door opens, the ledger closes (D-01, D-08, D-12, D-15)

**RED (`2dd9df62b`):**
```
× now leaves a member the Settings door too (Phase 283, FIX-01)
× is UNGOVERNED, so a member whose map denies model_management still sees it
AssertionError: expected 'model_management' to be undefined
AssertionError: expected false to be true // Object.is equality
Test Files  2 failed | 1 passed (3)      Tests  2 failed | 14 passed (16)
```
(`navItemsUnknownIsNotDenied.test.ts` passed without edits.)

**GREEN (`aec0d23e1`):**
- The settings entry is now `{ view: "settings", icon: Settings, label: "Settings" }`, with no `feature` property.
- The Phase 148 note is replaced by "⚠ UNGOVERNED SINCE 2026-10-15 (Phase 283, FIX-01 / BUG-261004-02)", which says where the gating lives now and that the audience is not widened.
- The Connections note's "WRONG fix" paragraph is kept and marked SUPERSEDED. Its `api/settings.py:331,341` citation is re-measured as `:578, :587`.
- `visibleNavItems` is unchanged.
- Docs:
  - `navigating-syrel.md`: the Settings row now reads "Everyone — the AI Model, Search & Retrieval and Integrations tabs only for people with model management …"; the operator sentence now refers to "the model-management tabs in Settings"; the technical-names sentence now says "Anyone … from Settings → Preferences".
  - `memory.md` and `audit-trails.md`: both now say Settings is in everyone's rail. "ask your administrator" appears 0 times.

**Nav, layout and docs** (`src/lib src/components/layout src/docs`, 76 files) vs base: `nav-items.test.ts` 5 → 6. The only red is the 4 `ChatHistoryColumn.test.tsx` failures that are also red at base. That file is **provably unmodified**: `git diff --numstat 9a0b78622 HEAD -- frontend/src/components/layout/` prints nothing and there are no working-tree changes there. The failing titles are the same four as at base (date-bucket "Today"). This run does not prove it is otherwise healthy; it is an inherited red.

**Ledger close (`180466d9d`).** Triples re-derived with the CLAUDE.md recipe, no six-digit buckets:

| File | Triple | Replaced scan-list cell (verbatim in the ledger's `## Phase 283 close`) |
|---|---|---|
| `frontend/src/pages/SettingsPage.tsx` | `53 / 27 / 1658` (was `47 / 24 / 1773`; CLAUDE.md `47 / 24 / 1814`) | "⚠ STALE for the THIRD close running at `44 / 23 / 1738`. ⭐ SHRANK — 242 moved the payload helpers out; the tab-registration seam stays OWED" |
| `frontend/src/lib/nav-items.ts` | `13 / 9 / 173` (was `12 / 8 / 153`) | "⚠ STALE (`9/6/118`). **271-02**: the Classification entry REMOVED (7 entries); `Wand2` moved to the Filing rules link. 271-05 G4-3: the rail has none" |
| `frontend/src/components/settings/settingsTabs.ts` | `2 / 1 / 123` (was `0 / 0 / 0`) | "young (created 283-01). Row added AT CREATION. The ONE home of …" |
| `frontend/src/components/settings/AuditLogSection.tsx` | `1 / 1 / 221` (was `0 / 0 / 0`) | "young (created 283-01). Row added AT CREATION. The Audit Log tab body …" |
| `frontend/src/components/settings/PreferencesSection.tsx` | `1 / 1 / 39` (was `0 / 0 / 0`) | "young (created 283-02). Row added AT CREATION. Preferences tab body …" |
| `frontend/src/landing/facts.ts` | `5 / 2 / 546` (was `4 / 1 / 546`) | "⚠ absent its ENTIRE LIFE — row added 283 planning. **283-02**: …" |
| `frontend/src/components/metadata/DocumentChunksSection.tsx` | `2 / 2 / 161` (was `1 / 1 / 147`) | text kept; only the triple moved |

- **SettingsPage.tsx's new cell:** "⚠ STALE a FOURTH close. **283**: tab-registration seam TAKEN (283-01, `settingsTabs.ts`); Audit Log + Preferences extracted. Per-tab state / hydrate / save split OWED (D-15)". It contains "OWED" and does not contain "DISCHARGED".
- **CLAUDE.md FIRING cells** (both ≤ 80 chars, both old cells quoted verbatim in the ledger):
  - `SettingsPage.tsx` → `tab seam TAKEN (283-01); per-tab state split OWED (D-15) · ⛔`
  - `nav-items.ts` → `last touch 283-02: Settings door ungoverned (FIX-01)`
- **FIRING rows:** no file newly fires, so no FIRING row was added.
- `git diff --stat` showed only the intended line counts, so CRLF was preserved.

**Merged-tree gates:**
- `node scripts/check-hot-file-ledger.cjs .planning/phases/283-every-member-reaches-their-own-settings` → `scan list: 547 rows · subject: 24 files · watched: 7` / `ledger gate OK`, exit 0
- `node scripts/check-claude-md-size.cjs` → `CLAUDE.md 92663 chars 61.8% of limit … [OK]`, exit 0
- `node scripts/check-docs-coverage.cjs` exit 0; `node scripts/check-landing-drift.cjs` exit 0
- **tsc:** 103 lines before and after. The raw `comm -13` shows one line, `SettingsPage.tsx(808,9) TS2561 'web_search_enabled'`. That is the base error at `(794,9)`, moved down by the added comment lines. **With line numbers stripped, `comm -13` and `comm -23` are both empty.**
- **eslint** (default and `eslint.a11y.config.js`) over SettingsPage.tsx, nav-items.ts, settingsTabs.ts, facts.ts, PreferencesSection.tsx and the touched tests: no output, exit 0. The base was empty too.
- **Count-gate pins (`chore(283-02)`):** `nav-items.test.ts` 5 → 6 and `DetailSections.lazy.test.tsx` 14 → 20 (283-03's measured count). `SettingsPage.member283.test.tsx` 16 was registered in both knobs in the RED commit. `settingsTabs.test.ts` stays 11. SettingsPage.test 24, a11y 4, facts 5 and navItemsConnections 6 are unchanged.

**Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root, run once on the merged tree after the pin commit `918501fca`, exit 0):
```
total                                      9471   10340    +869
total 10340  ·  failed 0  ·  pinned total 9471
count gate OK — 438/438 pinned files present, no per-file decrease, 0 failing.
```
This phase's rows (pin / actual / delta):
```
SettingsPage.test.tsx                        24      24       0
DetailSections.lazy.test.tsx                 20      20       0
SettingsPage.changedFields.test.tsx          17      23      +6   (inherited: 283-01 recorded the same)
SettingsPage.member283.test.tsx              16      16       0
settingsTabs.test.ts                         11      11       0
SettingsPage.sourceCeiling.test.tsx           9       9       0
nav-items.test.ts                             6       6       0
navItemsConnections.test.ts                   6       6       0
facts.test.ts                                 5       5       0
SettingsPage.a11y.test.tsx                    4       4       0
```
**Nothing was red, so no file needed attributing.** The gate's TARGETS do not include `ChatHistoryColumn.test.tsx` (the 4 inherited reds above come from the wider neighbour run). 438/438 pinned files is one more than 283-01's 437, which is the new member283 suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Acceptance fidelity] Docstring reworded in the two-role fence**
- **Found during:** Task 1, before the commit.
- **Issue:** the module docstring said the anti-pattern "patches ``is_operator`` / ``feature_visible``". That matched the plan's own forbidden-pattern grep (`patch.*is_operator`), so the grep read 1 on a file that does no such thing.
- **Fix:** it now reads "stubs out any link of the chain above". The grep reads 0. Same meaning.

**2. [Rule 1 - Acceptance fidelity] PreferencesSection header comment**
- **Issue:** the header named the toggle by its label, so `grep -c "Show technical names" PreferencesSection.tsx` read 2, while the plan expects 1.
- **Fix:** the comment now says "the technical-names reveal". The rendered label is the only occurrence. Fixed before the GREEN commit.

**3. [Note] The settingsTabs case count stays 11.** The cases were rewritten in place, one assertion block per existing `it`, so the BASELINE pin needed no change.

**4. [Note] Two-role operator arm also went RED under plant (a).** It checks that `operator_users` was read for the operator (non-vacuity). With the gate removed, no read happens, so it reads `assert ([])`. That is a stricter outcome than the plan asked for, not a defect.

No package was installed. No backend source, migration, STATE.md or ROADMAP.md was touched.

## Orchestrator-owned, OWED to `283-LIVE-EVIDENCE.md` (not run here, not claimed)

- **D-13 live two-role check:** real local JWTs. Operator is `fhdmrd@gmail.com`. Member is `fhdmrd.dev@gmail.com` in org `22f9c615`; prove the active org first, because the dev account is in two orgs. As the member, `GET /settings`, `PUT /settings`, `GET /settings/reembed-progress` and `POST /settings/reembed` must each return 403. As the operator, `GET /settings` must return 200. `PUT /me/preferences` as the member must return 200, and the value must read back after a reload.
- **D-22 scenario 1, a member's first visit** (Chrome MCP): the Settings door is on the rail; the page opens on Preferences; flip "Show technical names", pick a default model, reload, and both persist; Memory and Audit Log show the member's own data; no operator tab; no Reset. Check the network log of a fresh load that goes **straight to Settings**. Filter it to the Settings session, because `LibraryStatTiles` already gets a 403 from `/settings/reembed-progress` for members on the Library page. That is a pre-existing defect outside this phase (RESEARCH Pitfall 7).
- **D-22 scenario 2, the operator's view is unchanged:** Settings opens on AI Model; six tabs in order; AI Model saves as before; Preferences holds the toggle and the default-model picker.
- **D-21:** record the sketch skip as a decision (no new door; two existing components moved verbatim).
- **BUG-261004-02:** flip to closed only after D-13 and scenarios 1-2 pass.
- `graphify update .` was not run inside the worktree. Run it after the merge.

## Threat Flags

None. No new endpoint, auth path or schema. T-283-04, -05, -06, -10, -11, -12, -13 and -14 are mitigated and fenced as the register specifies. T-283-15, -16 and -17 are accepted and unchanged.

## Known Stubs

None. `choosing-a-model.md` keeps `status: stub` by design (the plan says to keep it).

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_283_settings_two_role_fence.py, backend/tests/unit/test_283_settings_route_inventory.py, frontend/src/components/settings/PreferencesSection.tsx, frontend/src/pages/__tests__/SettingsPage.member283.test.tsx
- FOUND commits: f24cd7206, 12471d1c6, af13d877b, 2dd9df62b, aec0d23e1, 180466d9d, 918501fca (`git log --oneline 8a06baca5..HEAD`)
- TDD gate order: `test(283-02)` RED 12471d1c6 precedes `fix(283-02)` af13d877b; `test(283-02)` RED 2dd9df62b precedes `fix(283-02)` aec0d23e1. Task 1 is test-only by design (the API already refused; RED came from the two plants).
- STATE.md and ROADMAP.md untouched.
