---
phase: 297-every-view-has-an-address
verified: 2026-10-28T01:45:00Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
status: passed
score: 5/5 roadmap success criteria verified; 49/49 plan must_have truths verified (1 refined by review fix WR-02, override suggested)
overrides_applied: 0
head_verified: 7717dfe9e
---

# Phase 297: Every View Has an Address. Verification Report

**Phase goal:** Every top-level view opens from its own `/app/...` address. A refresh or Back/Forward lands on the same view on every host the app ships to. The app root and the chat layout were split along their named seams before any routing code landed, with behaviour unchanged.
**Verified:** 2026-10-28, against develop at `7717dfe9e`
**Status:** passed
**Re-verification:** No. This is the first verification.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The `ActiveView` mount switch and the view/tab navigators live in their own modules, and behaviour is unchanged. Every fence is re-targeted under a decision id, none is deleted, and there is no unexplained per-file count decrease (REG-09). | VERIFIED | `components/layout/AppViewSwitch.tsx` (523 lines, `export function AppViewSwitch`) and `hooks/useAppNavigation.ts` (364 lines) exist. App calls `useAppNavigation()` before every early return (`App.tsx:167`). ChatLayout went from 1158 to 902 lines and App from 422 to 355. `git diff --diff-filter=D 246d62750 HEAD` deletes **no** file. The `?raw` fences now read the new homes: `activeViewReachability.test.ts:38`, `ChatLayout.fallback.test.tsx:13`, `renameFence.test.ts:70`, `LibraryPage.tabAttention.test.tsx:58,61`, `LibraryPage.initialTab.test.tsx:47`. D-297-01..17 ids appear in the suites. `runDeepLink.test.ts` lost its write/clear cases because those writers were deliberately retired (D-18 / D-297-11), and the replacement asserts that they are gone. Count gate: 531/531, 0 failing (measured by the orchestrator). |
| 2 | Each of the 12 top-level views opens from its `/app/...` address, a refresh lands on it, and Back/Forward step between views. A run opens at `/app/runs/<id>` (LINK-01). | VERIFIED | `lib/appRoutes.ts:47` `VIEW_PATHS: Record<ActiveView,string>` covers all 12 members. The parser is total (try/catch) and takes strict UUIDs only. `main.tsx:22` has one catch-all `createBrowserRouter([{ path: '*', Component: App }])`. View, run id and skill id are derived from `useLocation` (`useAppNavigation.ts:96-105`). Navigators push, normalisation replaces, and a same-address move is a no-op (`go`, `isOnScreen`). The reachability route leg round-trips every member (`activeViewReachability.ts:169`). G-4 G1 (paste plus reload on `/app/workflows`) and G2 (six-step Back/Forward) were driven in Chrome: PASS. |
| 3 | Old links still open what they opened before: `/app?run=<id>`, `?connections=1&...`, `/admin/spend`, `/setup`, `/invite`. A stream keeps going across six navigations. | VERIFIED | `appRoutes.ts:146-153` handles `?run=` and `?connections=1` on chat paths only. `appRoutes.ts:136` handles `/admin/spend`. `PRE_AUTH_PATHS` is never rewritten, and App still branches on `/setup` and `/invite` (`App.tsx:240,255`). Dropping the connections query matches the base behaviour: the base App initializer did `replaceState(null,"",pathname)`. `navigationKeepsStreams.test.tsx` runs the real App, OrgProvider and StreamsProvider. `subscribeToRun` is called once, the signal is not aborted, and the probe never unmounts. A no-key fence covers all 8 providers, including `LeaveGuardContext.Provider`. G-4 G4 (`/app?run=` becomes `/app/runs/<id>`) PASS. The four-axis board has 7 of 8 provider rows plus multi-tool, parallel-thread (load-bearing) and long-message all PASS. |
| 4 | Leaving a dirty workflow builder by Back/Forward asks first. OK leaves and Cancel keeps the edits (LINK-07). | VERIFIED | There is exactly one `useBlocker`, at `useAppNavigation.ts:213`. `lib/leaveGuard.ts` holds the registry, a no-op default context and the one-shot latch. `App.tsx:309` has the `LeaveGuardContext.Provider` with no key. WorkflowsPage registers the tenant (`WorkflowsPage.tsx:819`) and latches the connect, golden-run and Test Run sites (`:960`, `:993`, `:1025`). `WorkflowBuilderPage.tsx` is unchanged since base. The leaveGuard suites (26 + 15 cases) pass. G-4 G3 was driven with `confirm` stubbed: dirty+Cancel gives 1 call and stays; dirty+OK gives 1 call and leaves; clean gives 0 calls. |
| 5 | The same addresses work in dev, on the cloud app domain and on the one-box. An automated check across devRouting / vercel.json / nginx.conf fails when they disagree, and it was driven RED (LINK-08). | VERIFIED | `__tests__/routing/appRouteParity.test.ts` builds its inputs from `formatAppRoute` over `VIEW_PATHS`, plus the legacy and pre-auth shapes. It evaluates the Vite rewrite, Vercel (app host, and the apex redirect followed through), nginx and the middleware matcher. Every evaluator has a permanent negative control. `evidence/297-04-planted-red.txt` records one plant per layer with md5 and `git diff --quiet` restores. vercel.json, nginx.conf, devRouting.ts and middleware.ts are byte-unchanged since base. |

**Score:** 5/5 roadmap success criteria.

### Plan must_have truths (merged)

| Plan | Truths | Status | Notes |
|------|--------|--------|-------|
| 297-01 (REG-09) | 9 | 9/9 VERIFIED | The `setLibraryTab(` two-writer pin is in `useAppNavigation.ts`. The `NO TWELFTH` phrase travelled with it verbatim. `ActiveView` is still one line in `App.tsx:139`. No product file imports a router (the only match is the pre-existing comment in `librarySelection.ts:63`). |
| 297-02 (LINK-01) | 19 | 19/19 VERIFIED | `react-router` is pinned at `8.5.0`, React is `^19.2.9`, and CI runs Node 22 in both jobs. No `react-router-dom` import. S1 and S2 live in `AddressNotFound.tsx`; S1 is the first non-chat arm (`AppViewSwitch.tsx:295`), and the chat arm excludes `addressNotFound`. Admin and spend hold while the probe loads, then show S1 to a non-operator. The cold-run hold is inside the run arm. The only raw History write left is the WR-01 idx stamp, which `noRawHistoryWrites.test.ts` pins by exact text. `StreamsProvider.tsx` is not edited, and `setViewingThread(` still has its 2 base call sites in ChatArea. Provenance evidence is recorded (operator-amended D-39). Vercel Node 24.x was read, so no setting change is owed. |
| 297-03 (LINK-07) | 10 | 10/10 VERIFIED (1 refined) | D-32 "Test Run never prompts" was refined by WR-02 (`935aa2871`). Test Run now passes the Builder guard first, so it prompts **only** when the Builder is still dirty after its own save was refused. The latch is armed at the launch's own navigation through `beforeNavigate` (`ChatLayout.tsx:488,493`) and cleared in `finally`. A normal Test Run (save succeeded, Builder clean) still never asks. Override suggested below. |
| 297-04 (LINK-08) | 11 | 11/11 VERIFIED | The evaluator moved to `routingLayers.testutil.ts`, and `docsVercelRouting.test.ts` imports it (D-41). Known-fact rows are pinned. VALIDATION carries the D-27 board and G-4 rows 1-5. |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend/src/lib/appRoutes.ts` | VERIFIED | Strict leaf with `parseAppLocation`, `formatAppRoute`, `canonicalAddress` and `VIEW_PATHS`. Imported by the hook, the parity suite and the reachability test. |
| `frontend/src/hooks/useAppNavigation.ts` | VERIFIED | The only caller of the router hooks. App uses it (`App.tsx:167`). |
| `frontend/src/lib/leaveGuard.ts` | VERIFIED | Consumed by App (provider), the hook (registry) and WorkflowsPage (tenant). |
| `frontend/src/components/layout/AppViewSwitch.tsx` | VERIFIED | Rendered by ChatLayout as `<AppViewSwitch`. |
| `frontend/src/components/layout/AddressNotFound.tsx` | VERIFIED | Its 5 arms are in the switch. The copy is the UI-SPEC S1 text. |
| `frontend/src/main.tsx` | VERIFIED | One route, no children, no key. |
| `frontend/src/__tests__/routing/*` (3 suites + util) | VERIFIED | All pass. |

### Key Link Verification

| From | To | Status |
|------|----|--------|
| App.tsx | useAppNavigation | WIRED (`const nav = useAppNavigation()`) |
| ChatLayout.tsx | AppViewSwitch.tsx | WIRED |
| useAppNavigation | appRoutes (`parseAppLocation(`) | WIRED |
| ChatLayout doRun / openRunSurface | `openRun?.(` | WIRED |
| AppViewSwitch | `<AddressNotFound` | WIRED |
| useAppNavigation | leaveGuard (`useBlocker(`) | WIRED |
| WorkflowsPage | `useLeaveGuard(` | WIRED |
| App | `LeaveGuardContext.Provider` | WIRED |
| appRouteParity | `formatAppRoute`, `nginx.conf?raw` | WIRED |
| docsVercelRouting | `routingLayers.testutil` | WIRED |
| activeViewReachability.test | `AppViewSwitch.tsx?raw` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Status |
|----------|------|--------|--------|
| AppViewSwitch | `activeView`, `activeRunId`, `studioSkillId`, `addressNotFound` | `useLocation()` → `parseAppLocation` (memo) | FLOWING (no view state; it is derived from the address) |
| WorkflowRunPage arm | `runId` | the route `/app/runs/:uuid` → `nav.runId` → `activeRunId` prop | FLOWING (G4 drove a real run whose heading matched its `definition_snapshot.name`) |

### Behavioral Spot-Checks (run by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase suites + re-targeted fences | `vitest run` over 20 files (routing/*, appRoutes, runDeepLink, useAppNavigation ×2, WorkflowsPage.leaveGuard, AppViewSwitch.addressStates, activeViewReachability, docsVercelRouting, renameFence, LibraryPage ×2, ChatLayout launch/fallback/runDeepLink, WorkflowBuilderPage.header, SetupWizard) | 20 files, 504 tests passed | PASS |
| Remaining re-targeted suites | `vitest run` over ChatLayout.scrollFrame, ChatLayoutLaunch, RunEvidenceReport, RunOriginLine, ChatArea.expertThread | 5 files, 83 passed | PASS |
| Hot-file ledger gate | `node scripts/check-hot-file-ledger.cjs <297 dir>` | `ledger gate OK`: 48 subject files, 14 watched | PASS |
| CLAUDE.md size gate | `node scripts/check-claude-md-size.cjs` | 102,274 chars, OK | PASS |
| Seeds register gate | `node scripts/check-seeds-register.cjs` | 399/399 parsed, OK | PASS |

Cited, not re-run (the orchestrator measured these): the post-merge count gate was OK at 531/531 with 0 failing. The post-review header pin was fixed in `3e73d3730` (71/71). The tsc set diff is 0 new errors against the 62-line base. 297 touched 0 backend/ or supabase/ files, so the backend baseline is unaffected. A final full count gate was still running when this report was written.

### Probe Execution

There are no `scripts/*/tests/probe-*.sh` probes for this phase. Step 7c does not apply.

### Requirements Coverage

| Requirement | Plan | Status | Evidence |
|-------------|------|--------|----------|
| REG-09 | 297-01, 297-02 | SATISFIED | SC1 |
| LINK-01 | 297-02 | SATISFIED | SC2, SC3 |
| LINK-07 | 297-03 | SATISFIED | SC4 |
| LINK-08 | 297-04 | SATISFIED | SC5 |

No requirement is orphaned. REQUIREMENTS.md maps exactly these four ids to Phase 297.

### Routing and register checks requested by the orchestrator

- **SEED-185:** the frontmatter reads `status: folded`, `partial: true`, `folded_into: "297"`. The status_note names the entity half that is left (Phase 299 owns it) and the flip-to-shipped condition. CORRECT.
- **SEED-392** was planted for the dead "Try in Chat" item (IN-06). Its trigger_paths name ConnectionsTab and ConnectionsPage. CORRECT.
- **Deploy parity:** the parity suite covers all 12 canonical addresses plus the legacy and pre-auth shapes on dev, Vercel (app host and apex) and nginx, and every case passes. No config file changed. Bare `/workflows` is pinned as a known fact: the apex returns 404 and the one-box serves the landing page. It is not a canonical address.
- **G-5 ledger:** the gate is OK. The App.tsx and ChatLayout.tsx extraction rows are present, and main.tsx gained a FIRING row. See Info items 2-3 for drift after the review fixes.
- **G-4 rows:** G1-G5 are all PASS, each with its own DOM or DB evidence in `297-VALIDATION.md`. They were run on `1e5a54680 + 3e73d3730`, after the review fixes.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| (all modified product files) | TBD / FIXME / XXX | none found | The debt-marker gate is clear. |
| `ConnectionsTab.tsx:1147` | "Try in Chat" item with no handler | Info | It already did nothing at base: it wrote `#chat`, which nothing read. It is deferred as SEED-392 and recorded. |

### Info items (non-blocking)

1. **D-32 refinement (WR-02).** The 297-03 truth says "Test Run never prompts". Since `935aa2871`, Test Run asks once, but only when the Builder is still dirty after its own save was refused. This is the intended fix for a latch that a Back during the launch form could skip. To make the audit trail explicit, add this to the frontmatter:
   ```yaml
   overrides:
     - must_have: "Test Run never prompts and its latch is cleared in a finally"
       reason: "297-REVIEW WR-02: Test Run asks only when the Builder is still dirty after a refused save; the latch is armed at the launch's own navigation (beforeNavigate) and still cleared in finally. A clean Test Run never asks."
       accepted_by: "<operator>"
       accepted_at: "<ISO timestamp>"
   ```
2. **The ledger triples went stale after the review-fix commits.** These are cosmetic and no verdict changes. `ChatLayout.tsx` row reads `67 / 34 / 897` (CLAUDE.md:446) but measures `68 / 34 / 902`. `WorkflowsPage.tsx` reads `48 / 21 / 1484` (CLAUDE.md:424) but measures `49 / 21 / 1496`. The phase counts are unchanged.
3. **`hooks/useOperatorProbe.ts` and `hooks/useEffectiveFeatures.ts` have no ledger row.** The WR-03 fix (`dfa78855c`) changed both, outside every plan's `files_modified`, so the ledger gate could not see them. They measure `3/2/95` and `2/2/95`, which is below the G-5 threshold of 3 phases, so this is not a FIRING miss. Add rows at the next phase that touches them.
4. **P7 Moonshot/Kimi is BLOCKED (⛔).** The live `--probe` returned 429: the account is suspended for insufficient balance (BUG-261024-01). The row is recorded rather than omitted, as the roster rule requires. The behaviour it would test does not depend on the provider: the router sits above StreamsProvider and nothing remounts. That is proven on the real provider tree in jsdom and by 7 live provider rows. Re-run P7 once the Moonshot account is funded.
5. **G-4 G3 stubbed `window.confirm`,** as D-28 allows. The operator may still try the native dialog by hand. This is optional.
6. While S1 shows, the rail highlights Chat. This is accepted under D-43, and Phase 299 corrects it.

### Human Verification Required

None is required for this phase's goal. The only owed item is the P7 Moonshot re-run, which needs a funded account. It is recorded under Info item 4 as a blocked row with its issue id, not as an open verification.

### Gaps Summary

There are no gaps. All five ROADMAP success criteria hold in the code. They are confirmed by the targeted suites run here (587 tests across 25 files), the three-layer parity suite with planted-RED evidence, and the G-4 and four-axis rows driven live after the review fixes. The extraction landed before any router code (297-01 RED/GREEN, then 297-02). No fence was deleted, and none of the protected files (StreamsProvider, NavPanel, WorkflowBuilderPage, vercel.json, nginx.conf, devRouting.ts, middleware.ts) changed.

---

_Verified: 2026-10-28T01:45:00Z_
_Verifier: Claude (gsd-verifier)_
