---
phase: 297
slug: every-view-has-an-address
status: verified
threats_open: 0
asvs_level: 1
block_on: open
register_authored_at_plan_time: true
created: 2026-10-28
audited_at_head: 7717dfe9e
---

# Phase 297 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Every `mitigate` row below was verified against implementation code at HEAD `7717dfe9e` (develop),
> not against SUMMARY prose. The suites cited were re-run during this audit in two batches (9 files / 299 tests and 9 files / 140 tests; 17 distinct files, `navigationKeepsStreams` ran in both), all green
> (`src/__tests__/routing/*`, `appRoutes.test.ts`, both `useAppNavigation*` suites,
> `WorkflowsPage.leaveGuard`, `AppViewSwitch.addressStates`, and the 8 re-targeted 297-01 fences).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| address bar → `parseAppLocation` | pathname + search are attacker-controlled (shared links, emails, typed URLs) | path segments, run/skill ids, legacy query aliases |
| `canonicalAddress` → `navigate` | any value built here becomes a client navigation target (open-redirect surface) | same-origin path + carried query + hash |
| client render gates → API | `canvasEnabled` and the operator probe are render-only; server owner/org 404 and `require_visible` 403 are the wall | feature flags, operator identity |
| browser History (Back/Forward) → the one blocker | POP events arrive outside React; the blocker must revert, not lose, unsaved Builder edits | History entries + router `idx` |
| server 403 → forced exit | server withdraws access; client must leave without stranding the user | visibility refusal event |
| npm registry → `node_modules` | new runtime dependency (react-router) + React patch bump | package tarballs |
| repo config → production edge | `vercel.json` / `nginx.conf` / `devRouting.ts` decide which document an address gets | routing rules |
| test → config files (plant) | the one-time plant edited deploy config in the working tree | config bytes |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|-----------------------|--------|
| T-297-01 | Tampering | 8 re-targeted fence suites | mitigate | `git diff 246d62750 45d7e3ba6` over the 8 suites: every removed assertion has a same-valued counterpart re-pointed at `AppViewSwitch.tsx?raw` / `useAppNavigation.ts?raw` (e.g. `setLibraryTab(` ×2 now on NAV_CODE plus a new ×0 arm on App). "Moved, not duplicated" arms present (`ChatLayout.fallback`: ChatLayout has no `<UnknownViewFallback`). All 8 suites green at HEAD. | closed |
| T-297-02 | Tampering (behaviour integrity) | AppViewSwitch / useAppNavigation move | mitigate | Re-derived independently: base `246d62750` ChatLayout.tsx:840-1129 vs `9401ae3fe` AppViewSwitch.tsx return body → `diff -w` shows exactly 2 differing lines (the enclosing `{`/`}` braces). Characterization RED `53cd0c903` before GREEN `c868b317e`. | closed |
| T-297-03 | Elevation of privilege | canvas gate + operator gates moved into the switch | mitigate | `ChatLayout.tsx:320` is the single `visual_workflow_canvas === true` read (count = 1), passed as a prop (`ChatLayout.tsx:850`). AppViewSwitch reads no features context itself. `onOpenRun={canvasEnabled ? openRunSurface : undefined}` at `AppViewSwitch.tsx:270, 320, 335`. Run arm `:390` requires `canvasEnabled \|\| featuresLoading` and inside `:433` renders the page only when `canvasEnabled`, else a hold. | closed |
| T-297-04 | Information disclosure | `?connections=1` initializer | accept | Rationale holds: the initializer is gone (no `window.location.search` reader remains in App/hook); the alias is now owned by `appRoutes.ts:157` and the canonical rewrite drops the WHOLE query (`appRoutes.ts:183-184`; tests `appRoutes.test.ts:132-138` incl. `oauth_error`). See Accepted Risks AR-297-01. | closed |
| T-297-05 | Spoofing / Tampering (open redirect) | `canonicalAddress` + the replace effect | mitigate | `appRoutes.ts:78-89` rejects `//`, `\`, `%`, empty and dotted segments, >2048 chars before any lookup; `canonicalAddress` builds only from `formatAppRoute` (`:179`) + unowned params and guards `out.startsWith("/app")` (`:194`); never echoes pathname. Effect `useAppNavigation.ts:152-161` splits at `?` and passes `{pathname, search, hash}` separately. Hostile `it.each` (`appRoutes.test.ts:210-263`, 20 inputs incl. `//evil.com`, `/\evil.com`, `%2F%2F`, `/https://evil.com`) asserts not-found, null, and no `//` / `://` output. | closed |
| T-297-06 | Tampering (input validation) | `/app/runs/:id`, `/app/skills/:id`, `?run=` | mitigate | One rule: `runDeepLink.ts:23` anchored `UUID_RE`; `isStrictUuid` used at `appRoutes.ts:121-122`, `readRunParam` at `:154`; ids lowercased; partial/extra-segment → not-found (`appRoutes.test.ts:94-103`); parser total via try/catch (`:163-169`). Review IN-01: `go()` refuses non-UUID ids (`useAppNavigation.ts:182-183`; test `useAppNavigation.test.tsx:274`). | closed |
| T-297-07 | Information disclosure | `/app/admin(/spend)` for a non-operator | mitigate | `AppViewSwitch.tsx:374-379` and `:448-453`: `operatorLoading` → neutral hold `ADMIN_HOLD_COPY = "Opening…"`; non-operator → the same `<AddressNotFound>` the unknown-address arm renders (`:295-296`), so copy is byte-identical (test `addressStates.test.tsx:209`). Review WR-03 fixed: `useOperatorProbe.ts` returns `loading: loading \|\| answeredFor !== userId`, so the first render after sign-in or a user switch holds rather than painting S1 or a prior user's identity (test `addressStates.test.tsx:276`). Backend 404 remains the wall. | closed |
| T-297-08 | Information disclosure | tokens/auth params in URLs | mitigate | Unknown params alone never rewrite (`appRoutes.ts:190`; `/app?code=x` → null, `appRoutes.test.ts:188-191`); hash carried untouched (`useAppNavigation.ts:160`); `/setup`, `/invite` are pre-auth and never touched (`appRoutes.ts:64,134,178`; tests `:175-185` incl. `?token=x`). Canonical forms are built from VIEW_PATHS + UUIDs only. | closed |
| T-297-09 | Spoofing (content) | S1 not-found state | mitigate | `AddressNotFound.tsx:32` takes only `onGoHome`; copy is the constant `ADDRESS_NOT_FOUND_COPY` (`:22-26`); no path is rendered. Test `addressStates.test.tsx:151` asserts no requested path shown. | closed |
| T-297-10 | DoS (stream teardown) | router tree shape | mitigate | `main.tsx:24` `createBrowserRouter([{ path: '*', Component: App }])` at module scope, no children/key; the only router-hook caller is `useAppNavigation.ts:4` (tree grep). `navigationKeepsStreams.test.tsx` green; non-vacuity from the recorded planted `key={location.pathname}` RED drive (297-02-SUMMARY §D-10: `aborted: true, mounts 7 / unmounts 6`). | closed |
| T-297-11 | Tampering (history integrity) | raw History writers | mitigate | Tree grep of non-test `src/` (excl. `src/docs/`, separate entry): the ONLY `pushState`/`replaceState`/`location.hash =` is `useAppNavigation.ts:144`. Post-planning change (WR-01) audited: fence `noRawHistoryWrites.test.ts:58-62,96-106` exempts that exact text in that one file, asserts it occurs exactly once in comment-stripped code, re-sweeps the file with it removed (must be `[]`), proves non-vacuity (`hits(code)` = `["history.replaceState("]`), and asserts the text appears in no other file. The write itself (`:133-146`) runs only when the on-screen entry has no numeric `idx` AND `window.location.pathname === routerPathname`; it omits the URL argument (same URL), keeps existing state, and adds only a numeric `idx`. It cannot overwrite a router-written entry. | closed |
| T-297-SC | Tampering (supply chain) | npm install react-router / react / react-dom | mitigate | `evidence/297-02-provenance.json` vs `frontend/package-lock.json`: sha512 integrity identical for `react-router@8.5.0`, `react@19.2.9`, `react-dom@19.2.9`; all resolve to `registry.npmjs.org`; no `hasInstallScript` on any of the three or on react-router's two new transitive deps (`@remix-run/route-pattern@0.22.1`, `cookie-es@3.1.1`). Repository rule per D-39 AS AMENDED (`ec35fed56`, operator decision): react/react-dom name `react/react`, accepted with recorded evidence (301 from `facebook/react`, maintainers `fb` / `react-bot` unchanged, switch at 19.2.8). `package.json:51` pins `"react-router": "8.5.0"` exactly (IN-05, `71237ea8e`). | closed |
| T-297-12 | Tampering (integrity of user edits) | the one blocker + WorkflowsPage tenant | mitigate | Exactly one `useBlocker` in the tree (`useAppNavigation.ts:213`); blocks only on pathname change with tenants present (`:208-212`); `reset()` on blocked (`:214-220`). POP integrity relies on router `idx` → T-297-11 (incl. the WR-01 stamp). Confirm-count both ways: `useAppNavigation.leaveGuard.test.tsx:113-240` (dirty asks exactly once under StrictMode; clean asks 0) and WR-01 regression `:423-424` (Back onto an idx-less entry + Cancel keeps the Builder's address). | closed |
| T-297-13 | EoP (bypass) | one-shot latch | mitigate | `leaveGuard.ts` `canLeaveAll` consumes the latch on first evaluation; `useAppNavigation.ts:224-226` clears it on every `location.key` change. WR-02: Test Run arms it only via `beforeNavigate` immediately before the launch's own navigation (`ChatLayout.tsx:488, 493`; `WorkflowsPage.tsx:993`) and disarms in `finally` (`:995-996`); a dirty (save-refused) Builder must pass the guard first (`:983`). Tests: stale-latch `leaveGuard.test.tsx:279`, one-shot `:263`, not armed across the await `WorkflowsPage.leaveGuard.test.tsx:284`, non-navigating launch leaves nothing armed `:312`. | closed |
| T-297-14 | DoS (stranded) | 403 bounce with a dirty Builder | mitigate | `bounceHome` (`useAppNavigation.ts:339-345`) arms the latch only when the bounce changes the pathname, then `go(home, { replace: true })`; wired from the visibility-403 listener (`App.tsx:208-210`). Tests `leaveGuard.test.tsx:243` (0 confirm calls, REPLACE to `/app`) and `:252` (no armed latch when already home). | closed |
| T-297-15 | Repudiation | n/a | accept | Rationale holds: 297-03 adds no server write and no audit-bearing action; the guard is client-only UX. See AR-297-02. | closed |
| T-297-16 | DoS | Vercel/nginx/dev routing drift | mitigate | `appRouteParity.test.ts` evaluates every `formatAppRoute` output on dev, Vercel app host, Vercel apex, middleware and nginx; permanent negative controls (`:161-195`) prove each evaluator can fail. Plants recorded RED in `evidence/297-04-planted-red.txt` (12 / 8 / devRouting failures). Green at HEAD. | closed |
| T-297-17 | Tampering | planted mismatch left in config | mitigate | Evidence records md5 before/after match and `git diff --quiet` exit 0 per file plus a final combined gate. Re-checked now: `git diff --quiet -- frontend/nginx.conf frontend/vercel.json frontend/devRouting.ts` exit 0; `vercel.json` and `devRouting.ts` md5 equal the evidence; nginx.conf's evidence md5 `30ec4d…` is the CRLF form of the current LF bytes (`3d8667…` = HEAD blob), i.e. the worktree's autocrlf checkout, not drift. No 297 commit touches any of the three configs (last: `f3c9fe655` / `eb43e0b75`). | closed |
| T-297-18 | Spoofing (open redirect via apex redirect) | `vercel.json` apex → app host | accept | Rationale holds: rule unchanged by 297 (no 297 commit on `frontend/vercel.json`); destinations are all `https://app.:host/<same path>` where `:host` is the request's own host (excluding `app.`); suite asserts each apex redirect lands on `app.<same host>` with the path kept and then on `app.html` (`appRouteParity.test.ts:85-90,129-130`). See AR-297-03. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-297-01 | T-297-04 | The verbatim-moved `?connections=1` initializer was transitional for 297-01 only; 297-02 replaced it with the route table, whose canonical rewrite drops the entire query (OAuth `oauth_error` / `oauth_connected` included) by REPLACE. Residual: none beyond the pre-existing OAuth return shape. | Plan 297-01 register (operator-approved plan) | 2026-10-27 |
| AR-297-02 | T-297-15 | The leave guard is a client-side UX control; no server state is written and no audit-bearing action exists in 297-03, so there is nothing to repudiate. | Plan 297-03 register | 2026-10-27 |
| AR-297-03 | T-297-18 | Existing apex redirect rule, unchanged in 297. Destination host is derived from the request's own host (always a domain attached to the Vercel project) prefixed `app.`, never a user-supplied host; the parity suite pins this. | Plan 297-04 register | 2026-10-27 |

---

## Post-planning changes audited (review fixes)

| Change | Commit | Effect on register | Verdict |
|--------|--------|--------------------|---------|
| WR-01 sanctioned `replaceState` idx stamp | `a75cef7a7` | T-297-11 / T-297-12 | No hole: exemption is exact-text, single-file, counted once, remainder re-swept, non-vacuity asserted; the write only adds `idx` to an idx-less entry at the router's own pathname, same URL. |
| WR-02 Test Run latch armed at the launch's own navigation | (297-REVIEW-FIX) | T-297-13 | Strengthens the mitigation; tests `WorkflowsPage.leaveGuard.test.tsx:257-312`. |
| WR-03 probe `loading` until the answer is for THIS user | (297-REVIEW-FIX) | T-297-07 | Closes the one-frame S1 flash and a prior-user identity frame. |
| IN-01 `go()` refuses non-UUID ids | `86d2ffebf` | T-297-06 | Two-sided UUID guarantee. |
| IN-05 exact pin `react-router@8.5.0` | `71237ea8e` | T-297-SC | Prevents caret drift past the vetted version. |
| D-39 amendment (react/react repository) | `ec35fed56` | T-297-SC | Operator decision with recorded evidence; lockfile integrity matches the gated tarballs. |

---

## Informational notes (non-blocking)

1. **Fence spelling limit (pre-existing shape, not introduced by WR-01).** `noRawHistoryWrites` matches `history.pushState(` / `history.replaceState(` / `location.hash =` by spelling. An aliased handle (`const h = window.history; h.replaceState(…)`) or bracket access would not be caught. A tree grep at HEAD finds no such alias, so this is a hardening note only.
2. **`://` in a carried query.** `canonicalAddress` keeps an unowned query when rewriting a bare prefix, so `/workflows?x=https://e.com` becomes `/app/workflows?x=https://e.com`. The test's "never contains `://`" claim only holds for its own inputs. It is NOT an open redirect: the path is always `formatAppRoute` output starting `/app`, and the effect passes `pathname` and `search` to `navigate` separately.
3. **Transitive dependencies** of react-router (`@remix-run/route-pattern`, `cookie-es`) fall outside the D-39 field set. The lockfile shows registry-resolved tarballs with no install scripts.

## Unregistered flags

None. All four SUMMARY `## Threat Flags` sections report no new attack surface. The audit found none beyond the register (see the post-planning table).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-28 | 19 | 19 | 0 | gsd-security-auditor (Claude), HEAD `7717dfe9e` |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-28
