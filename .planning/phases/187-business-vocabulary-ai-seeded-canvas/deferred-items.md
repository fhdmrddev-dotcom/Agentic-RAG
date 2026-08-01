# Phase 187 — deferred items (out-of-scope discoveries)

Logged by executors during execution. Not fixed in the plan that found them.

---

## D-ITEM-01 — `npx tsc -b` is NOT clean at HEAD (33 pre-existing errors)

**Found by:** plan 187-04, task 1 (2026-08-02)
**Status:** deferred — out of scope, zero delta from this phase so far

`187-RESEARCH.md:1769` and every 187 plan's acceptance criteria state *"`npx tsc -b`
exits 0"*. **Measured: it exits 2 with 33 `error TS` lines.** The claim was inherited,
never run. (The v3.3 lesson it cites — `tsc -b` ≠ `--noEmit` — is real; the *clean*
part is not.)

**Zero of the 33 errors are in `src/components/workflows/`.** Owners:

| Area | Sample |
|---|---|
| `src/pages/SettingsPage.tsx` / `.test.tsx` | `SettingsUpdate` missing `web_search_enabled`; `FullAppSettings` optional-vs-required drift |
| `src/providers/OrgProvider.test.tsx` | `OrgPermissions.can_manage_sso` missing from a test fixture |
| `src/providers/StreamsProvider.tsx` | unused `getActiveRuns` (TS6133) |
| `src/stores/streamsStore.ts` | `StateCreator` / `viewedThreadId: null` widening |

**How 187 plans should read the criterion:** treat it as *"`tsc -b` produces no NEW
error, and none inside the files the plan touches"* — measure the count before and
after (`npx tsc -b 2>&1 | grep -c 'error TS'`) rather than gating on exit 0, which
cannot pass today for reasons no 187 plan owns.

**Re-open trigger:** a dedicated frontend type-hygiene phase, or the first 187 plan
that touches `SettingsPage` / `StreamsProvider` / `streamsStore` and can fix its own
row cheaply.
