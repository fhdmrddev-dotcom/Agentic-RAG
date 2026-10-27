---
phase: 297-every-view-has-an-address
plan: 02
subsystem: ui
tags: [frontend, router, react-router, deep-links, security]

requires:
  - phase: 297-01
    provides: "useAppNavigation (the one home for router hooks) and the pure AppViewSwitch, where the new arms go"
provides:
  - "react-router 8.5.0 in data mode: one module-scope createBrowserRouter([{ path: '*', Component: App }]) in main.tsx"
  - "frontend/src/lib/appRoutes.ts: a pure leaf with VIEW_PATHS: Record<ActiveView,string>, plus parseAppLocation, formatAppRoute and canonicalAddress"
  - "useAppNavigation reads the view, runId and studioSkillId from the address and adds openRun, addressNotFound and runId"
  - "AddressNotFound.tsx: the S1 not-found state, the S2 holding state, and their copy"
  - "activeViewRouteLeg: the route leg of the reachability fence"
  - "noRawHistoryWrites and navigationKeepsStreams suites"
affects: [297-03 leave guard (useBlocker goes in useAppNavigation), 297-04 parity suite (reads VIEW_PATHS / formatAppRoute), 299 tab + entity addresses]

tech-stack:
  added: ["react-router 8.5.0", "react 19.2.4 -> 19.2.9", "react-dom 19.2.4 -> 19.2.9", "CI Node 20 -> 22"]
  patterns:
    - "Parse first, then normalise: the first render already shows the target view, and one effect then REPLACEs a legacy or bare address"
    - "Navigator props, not router hooks: only useAppNavigation calls useLocation/useNavigate"
    - "The tab hand-off is spent on the render where the view changes, so a POP (Back/Forward) also spends it"

key-files:
  created:
    - frontend/src/lib/appRoutes.ts
    - frontend/src/lib/__tests__/appRoutes.test.ts
    - frontend/src/components/layout/AddressNotFound.tsx
    - frontend/src/components/layout/__tests__/AppViewSwitch.addressStates.test.tsx
    - frontend/src/__tests__/routing/noRawHistoryWrites.test.ts
    - frontend/src/__tests__/routing/navigationKeepsStreams.test.tsx
    - .planning/seeds/SEED-392-connections-try-in-chat-does-nothing.md
    - .planning/phases/297-every-view-has-an-address/evidence/297-02-provenance.json
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - .github/workflows/frontend-tests.yml
    - frontend/src/main.tsx
    - frontend/src/App.tsx
    - frontend/src/hooks/useAppNavigation.ts
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/AppViewSwitch.tsx
    - frontend/src/lib/runDeepLink.ts
    - frontend/src/lib/activeViewReachability.ts
    - frontend/src/components/workflows/RunEvidenceReport.tsx
    - frontend/src/components/settings/ConnectionsTab.tsx
    - frontend/src/pages/WorkflowRunPage.tsx
    - "8 re-targeted suites + RunOriginLine.test.tsx (see the fence table)"
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .claude/skills/sketch-findings-agentic-rag/SKILL.md
    - .claude/skills/sketch-findings-agentic-rag/references/app-information-architecture.md

key-decisions:
  - "D-39 amended by the operator (ec35fed56): the repository.url for react and react-dom may contain facebook/react OR react/react"
  - "The Library hand-off is now spent on the render where the derived view changes (React's adjust-state-on-input pattern), not in an effect"
  - "bounceHome now SPENDS the Library hand-off. This is an intentional revision of a 297-01 characterization case, with the reason written into the case"
  - "The legacy ?run= and ?connections=1 params apply only where the path itself resolves to chat"
  - "/admin/spending is not-found (base matched it with startsWith); /admin/spend and /admin/spend/* still open Spend"

requirements-completed: [LINK-01, REG-09]

duration: ~75min (excluding the checkpoint wait)
completed: 2026-10-27
---

# Phase 297 Plan 02: Router core Summary

**react-router 8.5 now runs in data mode with one catch-all route above `<App />`. Every one of the 12 views opens from its `/app/...` address, runs live at `/app/runs/<id>`, and the five legacy link shapes are replaced by their canonical address. The router is now the only thing that writes browser History. A stream that is already playing survives six navigations: the suite passes, and a planted remount turned it red.**

## Performance

- **Duration:** about 75 min of execution, plus a checkpoint wait for the operator
- **Started:** 2026-10-27T18:30Z (the gate ran first and failed); resumed 18:40Z
- **Completed:** 2026-10-27T19:44Z
- **Tasks:** 3/3
- **Files:** 8 created, about 30 modified

## Accomplishments

- **Route table** (`lib/appRoutes.ts`, 198 lines, a pure leaf). It implements the D-11 table, and the parser never throws. Ids must be strict UUIDs and are lowercased. A path that starts with `//`, or contains a backslash, `%`, an empty segment or a dotted segment, resolves to not-found before any lookup. `canonicalAddress` builds its result only from `formatAppRoute` plus the params it does not own, so it never echoes the input path. It returns `null` in five cases: pre-auth (`/setup`, `/invite`), bare `/`, not-found, already canonical, and unknown params only (`/app?code=x` is left alone).
- **Router mounted** (`main.tsx`). It is one module-scope `createBrowserRouter([{ path: '*', Component: App }])` inside `ThemeProvider`, with no children and no key.
- **The address is the view** (`useAppNavigation`). `useLocation` and `useNavigate` are called only here (D-08). The view, `runId` and `studioSkillId` come from one `parseAppLocation` memo. One effect does the canonical REPLACE and keeps the hash. Navigators push the new address and do nothing when it is already on screen. `bounceHome` replaces instead of pushing.
- **Runs live in the route.** ChatLayout's `activeRunId` state, the WR-05 clear effect and its `runDeepLink` import are deleted. `doRun` and `openRunSurface` call `openRun?.(workflowRunId)`. The `?run=` writers are gone from `runDeepLink.ts` and `RunEvidenceReport.tsx`, and so is the dead `#chat` hash write in `ConnectionsTab.tsx` (D-37).
- **Address states** (`AddressNotFound.tsx` plus `AppViewSwitch`). S1 is the first arm on the non-chat side, and the chat condition and the history column both exclude it. The run hold sits inside the single existing run arm, so the stripped comparison count is still 1. The admin arms show a hold while the operator probe loads, then S1 for a non-operator, with copy identical to an unknown address.
- **The reachability fence has a route leg** (D-25). Every member round-trips through the route table, and a synthetic 13th member is reported as unrouted.

## Checkpoint and operator decision (D-39)

The first provenance run failed one field, so the plan stopped. Nothing was installed (commit `23478a202`).
- **The failing field:** `react@19.2.9` and `react-dom@19.2.9` report `repository.url = git+https://github.com/react/react.git`. The gate required the value to contain `facebook/react`.
- **Evidence I collected:** `https://github.com/facebook/react` returns a 301 to `https://github.com/react/react`. The npm maintainers are the same (`fb`, `react-bot`) on 19.2.0, 19.2.7 and 19.2.9. The switch happens exactly at 19.2.8. The orchestrator verified this independently, including registry signatures.
- **Operator decision (2026-10-27):** ACCEPT. D-39 was amended on develop as `ec35fed56`: for react and react-dom, the `repository.url` may contain `facebook/react` OR `react/react`. Every other field is unchanged.
- **Re-run:** I re-ran the gate from scratch rather than trusting the saved file, and every field passed. react-router: remix-run, two maintainers, sha512, no install scripts. react and react-dom: the amended repository rule, sha512, no install scripts. react-dom's only script is `start`. The result is recorded with `"repository_rule": "facebook/react OR react/react (D-39 amended ec35fed56)"`.
- **Install:** one serialized `npm install react-router@8.5.0 react@19.2.9 react-dom@19.2.9`, into the operator's tree through the junction. The lockfile integrity for all three equals the registry `dist.integrity`, and `npm ls` reports no invalid, missing or unmet entries.

## Fences: re-targeted, not loosened

| Id | Suite | Change |
|---|---|---|
| D-297-09 | `ChatLayout.launch.test.tsx`, `ChatLayoutLaunch.test.tsx` | A run launch calls the `openRun` prop with the ANCHOR id, never the producer id. `onNavigate` is never called with "chat". The ANCHOR render case uses the id `openRun` received as `activeRunId`. No case was removed. |
| D-297-10 | `ChatLayout.runDeepLink.test.tsx` | Now in route form, through the hook plus ChatLayout under a memory router. A cold `/app/runs/<id>` stays put. "Back to Workflows" lands on `/app/workflows` with no run in the address. A legacy `?run=` is replaced and `keep=1` is kept. 2 → 3 cases. |
| D-297-11 | `runDeepLink.test.ts` | The reader cases moved onto `readRunParam(search)`. The 4 write/clear cases were replaced by 5 legacy-alias cases, one of which asserts the retired exports are gone. 12 → 13. |
| D-297-12 | `RunEvidenceReport.test.tsx` | Mounting and unmounting now leave `window.location` unchanged. The count is the same. |
| D-297-12 | **`RunOriginLine.test.tsx`** (not in the plan's inventory) | The report's exact `useEffect(` count went from 2 to 1, because the D-18 writer effect was deleted. Its purpose, "no NEW hook", is still an exact match, not a floor. The full count gate found this one. |
| D-297-13 | `SetupWizard.test.tsx` | Every `render(<App />)` is now wrapped in a memory router at the same path, and the `pushState` setPath is kept. Added a case: at `/setup`, the router location stays `/setup` (POP). |
| D-297-14 | `activeViewReachability.test.ts` | Four route-leg cases (7a)-(7d) added; the original eleven are kept. 11 → 15. |
| D-297-15 | `noRawHistoryWrites.test.ts` (new) | Tree-wide check over comment-stripped product code outside `src/docs/`. A planted fixture is caught, and the sweep covers more than 200 files. |
| (D-01 / D-05) | `useAppNavigation.test.tsx` | All 13 cases from 297-01 are now in URL form, under a memory router in StrictMode, plus the router behaviours. 13 → 30. **One case was revised on purpose and is named here:** "bounceHome routes to chat and does NOT spend the hand-off" became "bounceHome routes to /app with a REPLACE and SPENDS the hand-off". The dated reason in the case body: the clear must run on POP (Pitfall 5), so it is keyed on the derived view, and that key cannot tell a forced bounce apart from any other move to chat. The "no router import" case became "imports come from react-router, never react-router-dom". |

## D-10 RED drive (stream survival)

- **Plant:** I added `import { useLocation } from "react-router"`, `const location = useLocation()` and `key={location.pathname}` on `<StreamsProvider>` in `App.tsx`. Pre-plant md5: `412b9219a023dde0e9af78e830d2c9c6`.
- **RED output:** both cases went red. The runtime case failed with `AssertionError: expected true to be false` on `signal.aborted`. The source case failed with `expected '…' not to match /<(OrgProvider|StreamsProvider|…)\b[^>]*\bkey=/`. A one-off instrumented run, reverted afterwards, printed `{"subscribeCalls":1,"aborted":true,"mounts":7,"unmounts":6}`: the probe remounted on every navigation and the live subscription was aborted.
- **Restore:** I copied back the pre-plant file. `git diff --quiet -- frontend/src/App.tsx` exited 0, and the md5 is again `412b9219a023dde0e9af78e830d2c9c6`. The instrumented suite was restored the same way (`git diff --quiet` exited 0).
- **Green on the real tree:** with the real App, OrgProvider and StreamsProvider, six navigations (Library → Workflows → Back → Forward → Settings → Back) left `subscribeToRun` called once, the signal not aborted, the store's subscription size unchanged, the thread still streaming, mounts at 1 and unmounts at 0. The final address is `/app/workflows`.

## Gates (wave 2, run once)

- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`):
  - **First run:** 1 failing test, with no per-file decrease. I took the failing file from the persisted JSON report (`vitest-count-gate-96552-…json`) before re-running anything: `RunOriginLine.test.tsx`, "the run page and the evidence report mount it exactly once, with no new hook", `expected 1 to be 2`. The cause is this plan's own D-18 deletion, so the red is new, not inherited. I re-targeted the count (above).
  - **Second run:** `count gate OK — 528/528 pinned files present, no per-file decrease, 0 failing.` Total 12406, pinned total 11233.
  - **Per-file (pin → actual):** appRoutes 111 → 111 · useAppNavigation 30 → 30 · AppViewSwitch.addressStates 16 → 16 · activeViewReachability 15 → 15 · runDeepLink 13 → 13 · ChatLayout.runDeepLink 3 → 3 · navigationKeepsStreams 3 → 3 · noRawHistoryWrites 3 → 3 · RunOriginLine 6 → 6 · renameFence 15 → 15 · LibraryPage.tabAttention 15 → 15 · ChatLayout.fallback 5 → 5 · ChatLayout.launch 38 → 39 · RunEvidenceReport 26 → 42 · LibraryPage.initialTab 6 → 15. The last three were already above their pins at base.
- **Typecheck** (`npx tsc -p tsconfig.app.json --noEmit`, compared as a set against the 62-line base captured before the first edit): 62 → 62. One line differs in text only. It is the inherited `ChatLayoutLaunch.test.tsx` TS2740 (that suite has always omitted 9 required props), which moved from `(173,8)` to `(175,8)` and now lists `openRun` in its type. No new error.
- **vite build:** it succeeds. `check-landing-first-paint`: `landing first paint OK — 14 first-paint files from index.html, none carries …`. I also scanned every chunk reachable from each entry for router markers (`react-router`, `RouterProvider`). They appear only in the app.html closure; index.html and docs.html have none.
- **Bundle size** (sum of gzip over each entry's static-import closure; base built in a throwaway worktree at `2765ad85b` that was torn down with the script, and the source venv and node_modules reported intact):

  | Entry | Base `2765ad85b` | After | Delta |
  |---|---|---|---|
  | app.html | 951,281 B | 983,892 B | **+32,611 B (+31.8 KiB)** |
  | index.html (landing) | 120,725 B | 120,721 B | −4 B (chunk-hash noise) |
  | docs.html | 171,186 B | 171,186 B | 0 |

  ⚠ That is **larger than the ~18 KB D-05 expected.** The delta includes react-router 8's data-mode router (middleware is always on in v8) plus this plan's own modules, which are small. Both builds used React 19.2.9, because the shared node_modules is already bumped. A follow-up could check whether a lighter import path exists; this plan only records the number.
- **Other gates:** `check-hot-file-ledger 297` OK · `check-claude-md-size` OK (102,264 chars) · `check-docs-coverage` OK · `check-seeds-register` OK (399/399).
- **Protected files:** `git diff --stat 2765ad85b HEAD` over StreamsProvider.tsx, WorkflowBuilderPage.tsx, NavPanel.tsx, vercel.json, nginx.conf, middleware.ts and devRouting.ts is empty. That covers D-09 (StreamsProvider untouched; `setViewingThread` keeps its only writer) and D-43.

## Task Commits

1. Gate failed, evidence recorded: `23478a202` (docs)
2. **Task 1:** install `ad0f627b3` (chore) · RED `0bd078c75` (test) · GREEN `ae0cdb514` (feat)
3. **Task 2:** RED `651ca6ce4` (test) · GREEN `320716981` (feat, the single routing commit for D-18/D-33)
4. **Task 3:** RED `5cf7c7a7e` (test) · GREEN `31b224785` (feat) · `e2a23ee9c` (refactor) · `6fd16ad11` (test, the RunOriginLine re-target) · docs `591815d97`

## Deviations from Plan

### Checkpoint (D-39), resolved by the operator
- Documented above. The rule was amended by the operator (`ec35fed56`). I did not substitute or reinterpret anything; the gate was re-run from scratch under the amended rule.

### Auto-fixed issues

**1. [Rule 1 - Bug] A fence outside the plan's inventory broke under D-18**
- **Found during:** the Task 3 wave gate
- **Issue:** `RunOriginLine.test.tsx` pins RunEvidenceReport's exact `useEffect(` count at 2. Deleting the `?run=` writer effect made it 1.
- **Fix:** re-targeted the count from 2 to 1 under D-297-12, with the dated reason in the test. It is still an exact count.
- **Commit:** `6fd16ad11`

**2. [Rule 1 - Lint/quality] The hand-off clear moved from an effect into render**
- **Issue:** the plan's `useEffect(() => setLibraryTab(...), [activeView])` trips `react-hooks/set-state-in-effect` and paints one frame with a stale tab.
- **Fix:** React's adjust-state-on-input pattern: a `viewSeen` state plus a guarded set during render. The rule, its POP behaviour and the exact count of 2 `setLibraryTab(` writers are unchanged. All hook, LibraryPage and stream suites pass.
- **Commit:** `e2a23ee9c`

**3. [Rule 2 - Robustness] The stream-survival suite timed out under a cold parallel run**
- **Issue:** one cold mixed run reported one red that four re-runs did not reproduce. The setup `waitFor` calls (App boot through the setup probe and providers) can exceed the 1 s default on a cold transform.
- **Fix:** the three setup waits now use `{ timeout: 5000 }`. The assertions themselves are unchanged.
- **Commit:** `31b224785`

### Literal acceptance greps that read differently
- `grep -c "createBrowserRouter" frontend/src/main.tsx` returns **2**, not 1: one is the import line and one is the call. The code has exactly one router, and `navigationKeepsStreams` fences one route object with `path: '*'` and no children.
- The CI's only lint gate is `lint:a11y`. A full eslint run over the changed files reports these inherited findings: the ChatLayout `_loading` noted at 297-01, ConnectionsTab `:346`/`:376`, RunEvidenceReport's fetch effect `:428`, and WorkflowRunPage `:1158`. It also reports `react-hooks/immutability` on the module-level probe boxes in two new test harnesses (`navigationKeepsStreams`, `useAppNavigation.test`). Those are test-only and outside CI lint.

### Decisions inside the plan's latitude
- `/admin/spending` is not-found, as the plan's behaviour list requires. At base the initializer's `startsWith("/admin/spend")` matched it.
- The `?run=` and `?connections=1` aliases apply only when the path itself resolves to chat (`/app`, `/app/chat`, `/`).
- `onNavigate("workflow-run" | "skill-studio")` with no id goes to the last id seen, or does nothing.

## D-43: the rail while S1 shows

`NavPanel.tsx` is not edited. While S1 is on screen, the derived view is "chat", so the rail highlights Chat. This is accepted for 297; Phase 299 corrects the rail state.

## Deploy parity

There is no env var, migration, bundled service or sandbox-image change. The CI Node version moved from 20 to 22 in both jobs of `frontend-tests.yml`. The Vercel project Node is 24.x (D-06, so no operator action is owed), and the `node:22-alpine` Dockerfile is unchanged. vercel.json and nginx.conf are unchanged; 297-04's parity suite proves they need no change.

## Owed UAT (not run here, by plan)

The D-27 four-axis board (8 provider rows, multi-tool, parallel-thread, long-message) and G-4 rows 1, 2, 4 (D-28) and 5 (D-44) are seeded as unchecked rows in `297-VALIDATION.md` by 297-04 Task 3. They run, driven through Chrome MCP, at verification.

## Known Stubs

- The Connections "Try in Chat" item renders and does nothing, as it did before (D-37). This is intentional and tracked as `SEED-392`.

## Threat Flags

None beyond the plan's register. T-297-05..11 and T-297-SC are each mitigated by an executable case: hostile-input `it.each`, the strict-UUID cases, S1 copy identical for an admin refusal and an unknown address, `/app?code=x` → null, no path prop, the D-10 RED drive, the noRawHistoryWrites check, and the D-39 gate.

## TDD Gate Compliance

All three tasks have a RED `test(...)` commit before their GREEN `feat(...)` commit: `0bd078c75` → `ae0cdb514`, `651ca6ce4` → `320716981`, `5cf7c7a7e` → `31b224785`. Every RED run was confirmed failing. For Task 3, `navigationKeepsStreams` already passed at RED, because the property it guards was delivered by Task 2's router. Its non-vacuity comes from the planted-key RED drive above, not from the RED commit.

## Self-Check: PASSED

- FOUND: appRoutes.ts, AddressNotFound.tsx, appRoutes.test.ts, AppViewSwitch.addressStates.test.tsx, noRawHistoryWrites.test.ts, navigationKeepsStreams.test.tsx, SEED-392, 297-02-provenance.json
- FOUND commits: 23478a202, ad0f627b3, 0bd078c75, ae0cdb514, 651ca6ce4, 320716981, 5cf7c7a7e, 31b224785, e2a23ee9c, 6fd16ad11, 591815d97

## Next Phase Readiness

- **297-03:** `useBlocker` goes in `useAppNavigation`, the only router-hook home. `bounceHome` is the forced-exit path; it currently REPLACEs with no state, so add `state: { forced: true }` there (Pitfall 8). The router is the only History writer, so a POP carries a delta.
- **297-04:** the parity suite can import `VIEW_PATHS` and `formatAppRoute` from `lib/appRoutes.ts` as its input set. Every canonical path starts with `/app` and has no dotted segment.
