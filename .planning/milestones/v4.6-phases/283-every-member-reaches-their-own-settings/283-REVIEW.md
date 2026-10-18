---
phase: 283-every-member-reaches-their-own-settings
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - backend/tests/unit/test_283_settings_route_inventory.py
  - backend/tests/unit/test_283_settings_two_role_fence.py
  - frontend/src/components/metadata/DocumentChunksSection.tsx
  - frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx
  - frontend/src/components/settings/AuditLogSection.tsx
  - frontend/src/components/settings/PreferencesSection.tsx
  - frontend/src/components/settings/__tests__/settingsTabs.test.ts
  - frontend/src/components/settings/settingsTabs.ts
  - frontend/src/landing/__tests__/facts.test.ts
  - frontend/src/landing/facts.ts
  - frontend/src/lib/__tests__/navItemsConnections.test.ts
  - frontend/src/lib/nav-items.test.ts
  - frontend/src/lib/nav-items.ts
  - frontend/src/pages/SettingsPage.test.tsx
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
  - frontend/src/pages/__tests__/SettingsPage.member283.test.tsx
  - docs/public/get-started/navigating-syrel.md
  - docs/public/security/audit-trails.md
  - docs/public/use/choosing-a-model.md
  - docs/public/use/memory.md
findings:
  critical: 1
  warning: 2
  info: 6
  total: 9
status: partially_fixed
fixes:
  fixed: 7
  skipped: 2
  skipped_ids: [IN-04, IN-06]
  fixed_at: 2026-10-16
---

# Phase 283: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard (diff base `9a0b78622`)
**Files Reviewed:** 21 (plus a skim of the bookkeeping edits in CLAUDE.md, docs/HOT-FILE-LEDGER.md and scripts/vitest-count-gate.cjs)
**Status:** issues_found

## Summary

**FIX-01: the permission boundary holds.** I traced every component a member can mount:
- `PreferencesSection` uses the `TechnicalNamesProvider` (localStorage) and `ModelDefaultPreference`, which calls `/me/preferences` with no gate.
- `MemorySection` reads through the Supabase client under RLS.
- `AuditLogSection` calls `/audit-logs` and `/audit-logs/export`, both filtered to the caller's own rows by `.eq("user_id")`.

None of them calls a route gated by `require_visible("model_management")`. The three operator `TabsContent` blocks are left out of the render for a member, not just hidden by Radix, so `JudgeModelPicker` (which calls `getSettings` underneath), `ReembedStatusCard` and `EngineHealthCard` can never mount for one. The UI gate (`features.model_management === true` from `/features`) and the API gate (`feature_visible`) read the same `is_operator` + `feature_audience` seams, so they agree for the operators, everyone and role audiences.

**The backend fences are real, not vacuous.**
- `test_283_settings_two_role_fence.py` replaces only the pool. `require_visible`, `feature_visible` and `is_operator` all run for real. Each member refusal asserts both the exact 403 text and an `operator_users` read for that same caller.
- The route-inventory detector reads the `feature` value captured inside each `require_visible` dependency, and a permanent self-test plants one ungated route and one wrongly-gated route to prove the detector catches them.
- Both suites pass (14/14). The six frontend suites in scope also pass (83/83). `check-docs-coverage`, `check-landing-drift` and the hot-file-ledger gate are green.

**The frontend member fixtures are not vacuous either.** `member283` uses an explicit `{ model_management: false }`. Its spies sit on the `@/lib/api` barrel, which every gated component imports. The operator `getSettings` call serves as a positive control.

**The defect is in FIX-08.** The "one Tab stop" property (D-17) is false in current Chrome and Firefox, and the test that claims it runs in jsdom, which cannot model that behaviour (CR-01). There are also two warnings: the backend fence leaves a test-only settings row in the process-wide cache, and the features-loading window has no test.

## Critical Issues

### CR-01: The bounded chunk list is not "one Tab stop": every overflowing chunk body is its own Tab stop in Chrome 130+ and Firefox, and the jsdom fence cannot see it

**File:** `frontend/src/components/metadata/DocumentChunksSection.tsx:107-118` (region) and `:157-159` (per-chunk body). The test is at `frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx` (the "⛔ D-17: the region is ONE Tab stop" case).

**Issue:**
- **The code.** Each chunk body is `<p className="max-h-32 overflow-auto ...">`. That makes it a scroll container whenever the text is taller than 8rem, which is true for almost any real chunk (8rem at `text-[0.7rem] leading-relaxed` is about 7 lines). The body has no focusable children.
- **The browsers.** Chrome 130+ ships "keyboard-focusable scrollers": a scroll container with no focusable children joins the sequential Tab order. Firefox has done the same for years.
- **The result on a ~1,000-chunk document.** Pressing Tab from the region moves into chunk body #0, then #1, and so on for up to about 1,000 stops. Reaching "the next menu" by keyboard therefore still takes about 1,000 presses, which is the exact complaint in BUG-260908-01, just for keyboard users. D-17 ("Tab moves on past it — no focus trap") and G-4 scenario 3 ("Tab moves past the list") are not met.
- **Why the fence passes anyway.** It asserts `region.querySelectorAll("[tabindex]")` has length 0 and that `user.tab()` leaves the region. jsdom has no layout, no overflow and no implicit scroller focusability, so this test is green no matter how the browser behaves. Its own comment ("1,000 of them would be the trap") names the failure it cannot detect.
- **The header comment is wrong too.** "one Tab stop (the bodies stay unfocusable)" is false in the target browsers.

**Verify (G-4, Chrome):** open a document whose chunks are longer than about 400 characters, expand Chunks, focus the region, press Tab, then read `document.activeElement`. Expected result: the first chunk's `<p>`, not the next section header.

**Fix:** keep exactly one scroller in the list. Either remove the inner scroll container now that the list is bounded:
```tsx
<p className="whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-relaxed text-foreground">
  {row.content}
</p>
```
or, to keep the per-chunk cap, opt each body out of sequential focus explicitly:
```tsx
<p tabIndex={-1} className="max-h-32 overflow-auto ...">{row.content}</p>
```
The second option leaves a body's overflow unreachable by keyboard, so the first is better. Either way:
- Correct the header comment.
- Replace the jsdom assertion with one that can fail. For example, assert that no element inside the region has a class containing `overflow-auto`, `overflow-y-auto` or `overflow-scroll` (a source/DOM fence on the mechanism), and keep the real-browser Tab check in the G-4 drive.

## Warnings

### WR-01: The two-role fence leaves a test-only `app_settings` row in the process-wide settings cache

**File:** `backend/tests/unit/test_283_settings_two_role_fence.py:57-64, 88`

**Issue:**
- `_reset_caches()` runs only at the start of each test.
- Every request in these tests goes through `ensure_settings_fresh()` → `_load_settings_from_db()`. That fills `us._settings_cache` with `_SETTINGS_ROW` (including `openai_api_key: "sk-test"` and `provider_model_lists`) and stamps it as fresh. The override caches fill up the same way.
- Nothing clears these afterwards. conftest's autouse `reset_mocks` does not touch `app.models.user_settings`, and `load_app_settings()` (the sync reader) has **no TTL at all** (see the `ensure_settings_fresh` docstring).
- So any later test in the same process that reads settings without resetting first gets this row instead of its own setup. That makes failures depend on test order, and the backend gate has zero headroom (71). The six older suites that reset this cache assign it directly in the same way, so this file repeats an existing hazard rather than inventing one, but it adds one more source of leaked state.

**Fix:** let pytest restore the cache module after each test:
```python
def _reset_caches(monkeypatch):
    for name, cold in [("_settings_cache", None), ("_settings_cache_time", 0.0),
                       ("_model_overrides_cache", {}), ("_model_overrides_cache_time", 0.0),
                       ("_all_model_overrides_cache", {}), ("_all_model_overrides_cache_time", 0.0),
                       ("_removed_model_ids_cache", set()), ("_removed_model_ids_cache_time", 0.0)]:
        monkeypatch.setattr(us, name, cold)
```
`monkeypatch` puts the original objects back at teardown. Note that it restores the binding, not the contents: the loader rebinds `_settings_cache`, so this works. As an alternative, add a `yield` fixture that cold-resets the caches after the test.

### WR-02: The features-loading window that FIX-01 depends on has no test

**File:** `frontend/src/pages/SettingsPage.tsx:677-687` (the `if (featuresLoading) return` guard); `frontend/src/pages/__tests__/SettingsPage.member283.test.tsx:63-71`

**Issue:**
- Every render in `member283`, `SettingsPage.test.tsx` and the a11y suite passes `loading: false`. No test drives `loading: true` and then a resolved map.
- Since D-05, the decision "operator lands on `0`, member lands on `6`" depends on that guard. It holds the page spinner until the map arrives, because the map fails closed to `{}` and makes an operator look like a member while it loads.
- If the guard is removed or reordered, an operator briefly gets the member strip and lands on Preferences. A tab click inside that window persists the wrong tab. The page would also render once before `getSettings` runs, against an empty provider state.
- That is precisely the "the page waits for the map (spinner) before deciding" pattern in CONTEXT, and nothing pins it.

**Fix:** add two cases to `member283`:
1. Render with `{ features: {}, loading: true }` and assert that no `tab` role is present (spinner only) and that `getSettings` was not called.
2. Re-render with `{ features: { model_management: true }, loading: false }` and assert the six-tab strip, `aria-selected` on AI Model, and that `getSettings` was called once.

Re-render under a single provider with `rerender` so the component instance is kept.

## Info

### IN-01: The stale "Land them on Memory" rationale survives above the derived fallback

**File:** `frontend/src/pages/SettingsPage.tsx:446-457`
**Issue:** The opening paragraph still says "Land them on Memory instead … Memory is the first tab every caller can still use". The D-05 note appended below it contradicts that. Readers meet the false rule first.
**Fix:** Strike it through or re-word it to "land them on their first visible tab (`settingsTabFallback`)", keeping the "5" rationale.

### IN-02: `handleReset` keys its confirm prompt on `activeTab`, not on the tab actually shown

**File:** `frontend/src/pages/SettingsPage.tsx:827-833`
**Issue:** `activeTab === "0"` reads the raw persisted value. Now that D-05 redirects retired and unknown ids to `"0"` for an operator, an operator with `"5"` or `"9"` persisted is looking at AI Model but gets the cross-tab `window.confirm`.
**Fix:** `if (effectiveTab === "0" || window.confirm(...))`.

### IN-03: The `SettingsPage.test.tsx` "member" helper renders the not-yet-told state and labels it a member

**File:** `frontend/src/pages/SettingsPage.test.tsx:77-80`
**Issue:** `renderAsMember()` passes `{}`, and its docblock calls that "the shape a member has". The `member283` docblock correctly says `{}` means "not told yet". The 283-edited case "lands a member with a persisted Connections tab on Preferences" passes for the fail-closed reason, not the member reason. It is not vacuous, since both fail closed the same way, but the label is wrong.
**Fix:** Pass `{ model_management: false }` and fix the docblock.

### IN-04: Nothing stops a retired id from being reused in the registry

**File:** `frontend/src/components/settings/settingsTabs.ts:45-62`; `__tests__/settingsTabs.test.ts`
**Issue:** If someone adds `{ id: "5", ... }` to `SETTINGS_TABS`, `isSettingsTabVisible` hides it from everyone with no error, because the `RETIRED_SETTINGS_TABS` check runs first. D-03's "never reuse" is stated but not tested.
**Fix:** `expect(SETTINGS_TABS.filter(t => RETIRED_SETTINGS_TABS.includes(t.id))).toEqual([])`.

### IN-05: The `visibleNavItems` docstring still says "Fail-CLOSED by construction"

**File:** `frontend/src/lib/nav-items.ts` (the JSDoc above `visibleNavItems`)
**Issue:** The body fails open on `undefined` (correctly, per the 2026-09-09 correction). The new 283 test comment also calls it fail-OPEN, but the docstring above the function says the opposite. This predates 283, but 283 edited this file and now relies on this distinction in two comments.
**Fix:** Re-word the JSDoc to say "hides only a KNOWN `false`; unknown/loading shows (the API is the wall)".

### IN-06: The UI and API disagree on `audience: "off"` for `model_management` (pre-existing, now more visible)

**File:** `backend/app/api/features.py:61-78` vs `backend/app/dependencies.py:630-631`
**Issue:**
- `/features` checks `"off"` before the operator short-circuit, so an operator's `model_management` reads `false`.
- `feature_visible` returns `True` for an operator before it ever reads the audience.
- `PUT /admin/visibility` accepts `"off"` (`admin.py:131`). If `model_management` is set to off, every operator loses the three tabs in the UI while the API keeps serving them.
- The mismatch is in the safe direction (the UI is stricter) and is not introduced by 283. But Settings is now the place where it shows: the page renders with only Preferences, Memory and Audit Log for operators too.
**Fix:** No change needed for 283. Either refuse `"off"` for non-kill-switch keys in `PUT /admin/visibility`, or make `feature_visible` honour `"off"` the same way `/features` does. Record the choice as a decision.

## Fixes applied

Applied 2026-10-16 on `develop` from base `e4c543a37`, one commit per finding, scope per the orchestrator's ruling (every Critical and Warning, plus the cheap Info items; IN-04 and IN-06 skipped). Every new or changed test was **driven RED** against a planted regression before it was counted, and each planted file was restored and checked by md5.

| Finding | Result | Commit | What changed |
|---|---|---|---|
| CR-01 | fixed | `ba3aacdde` | Removed the per-chunk `max-h-32 overflow-auto` from the chunk body in `DocumentChunksSection.tsx`. Each chunk now shows its full text, and the `max-h-96` region is the only scroll container, so it is one Tab stop and all of its text stays keyboard-scrollable. `tabIndex={-1}` was rejected because it would leave overflowing text unreachable. The header comment's "one Tab stop" claim is struck through and corrected (736 of 764 bodies overflowed in the live drive). The jsdom-vacuous case in `DetailSections.lazy.test.tsx` was replaced with two checks that can fail: (a) a DOM sweep finding no `overflow-auto/-y-auto/-scroll/-y-scroll` or `max-h-*` class inside the region, and (b) a comment-stripped source fence finding no `overflow-*` or `max-h-*` utility in `ChunkRowView`. Both have non-vacuity guards. The region focus and `user.tab()` lines are kept as a secondary jsdom-level check. **RED:** with the old body, (a) failed listing the two `<p class="max-h-32 overflow-auto …">` elements, and (b), driven on its own, failed with `['max-h-32', 'overflow-auto']`. `283-UI-SPEC.md` §4's keyboard line is struck through and annotated. ⚠ The real-browser Tab walk is still owed to G-4: the jsdom fence checks the mechanism, not Chrome's behaviour. |
| WR-01 | fixed | `191d34098` | `_reset_caches(monkeypatch)` now uses `monkeypatch.setattr` for all eight `user_settings` cache globals, including the `_removed_model_ids_cache` pair the original reset did not touch. pytest restores each binding at teardown. That is enough because the loaders rebind these names through `global` and never mutate them in place. **RED:** a throwaway probe test that ran after the suite read the leaked `sk-test` row with the old file and a clean cache with the new one. The probe was deleted. Both 283 backend suites pass, 14/14. |
| WR-02 | fixed | `f5239abe7` | Two cases in `SettingsPage.member283.test.tsx` render `{ features: {}, loading: true }`, then `rerender` the same tree with a resolved map. While loading: no tab, no tabpanel, no `getSettings`/`getJudgeModel` call, and nothing written to `settings_active_tab`. After resolving: an operator gets six tabs, lands on AI Model, and `getSettings` runs exactly once; a member gets three tabs, lands on Preferences, and makes zero gated calls. **RED:** with `if (featuresLoading) return` planted out, both cases failed on the empty-strip assertion. |
| IN-01 | fixed | `9545e3a5f` | The "Land them on Memory" sentence is struck through and annotated with the D-05 rule (first visible tab via `settingsTabFallback`). The "5" rationale is kept. |
| IN-02 | fixed | `88fcaa9c3` | `handleReset` now compares `effectiveTab === "0"`. New cases (persisted `"5"` and `"9"`, operator) assert that Reset on AI Model fires no `window.confirm`, with a positive control on Preferences where it fires once. **RED:** both cases failed with `activeTab` planted back. |
| IN-03 | fixed | `326676e94` | `renderAsMember()` in `SettingsPage.test.tsx` now passes `{ model_management: false }`, and its docblock is corrected (append-only). All 24 cases stay green. |
| IN-04 | skipped | — | Out of scope by the orchestrator's ruling (no retired-id reuse fence added). Still open. |
| IN-05 | fixed | `e2346e446` | Added an append-only correction under the `visibleNavItems` JSDoc: the filter hides only a known `false` and fails OPEN on unknown or loading; the fail-closed decision lives per tab in `settingsTabs.ts`. |
| IN-06 | skipped | — | Out of scope by the orchestrator's ruling. This is a pre-existing UI/API disagreement on `audience: "off"`, which the review itself rated "no change needed for 283". It still needs a recorded decision. |
| (gate) | — | `044485a0f` | Raised the `SettingsPage.member283.test.tsx` count-gate pin from 16 to 20 (+2 WR-02, +2 IN-02). Raised only, never lowered. |

**Gates after the fixes:**
- **Targeted vitest** (`src/pages src/components/settings src/components/metadata src/lib`): 114 files, 2308 passed, 0 failed.
- **`npx tsc -p tsconfig.app.json --noEmit`:** 66 errors at base `e4c543a37` (bootstrapped throwaway worktree, torn down with `teardown-worktree.sh`) and 66 at HEAD. The set diff is empty, so there are no new errors.
- **`lint:a11y`** on the six touched files: 0 errors at both base and HEAD.
- **`check-hot-file-ledger.cjs`:** OK.
- **`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`:** `count gate OK`, 438/438 pinned files present, 0 failing, total 10344.

⚠ **Still owed:**
- **CONTEXT D-16's wording.** It still says "same pattern as the per-chunk `max-h-32` one level down". It was left untouched because it is a decision record, and this correction lives in the UI-SPEC and the component instead.
- **The G-4 real-browser Tab walk on the chunk region.** The MCP tab was hidden during the live drive, so no key presses were delivered.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
