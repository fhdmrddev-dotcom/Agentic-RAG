# Phase 297: Every View Has an Address - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning
**Mode:** `--auto` (operator: "proceed end to end by yourself") — every gray area resolved to the
research-recommended option, logged in `297-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

Every one of the 12 top-level `ActiveView` members opens from its own `/app/...` address; a refresh
lands on the same view; browser Back/Forward step between views; a workflow run opens at
`/app/runs/<id>` (the link contract phases 299–301 point at); shipped legacy links keep working;
leaving the workflow Builder with unsaved edits by Back/Forward asks first; and one automated check
proves dev, Vercel and one-box nginx agree on every address.

**Before any routing code lands**, `App.tsx` and `ChatLayout.tsx` are split along their named seams
with zero user-visible change (REG-09).

**Not this phase (owned by 299):** per-thread `/app/chat/:id`, per-Expert URL, Skill Studio /
Settings / Org *tab* addresses, the plain "can't be opened" page, the cross-org switch prompt,
sign-in return-to-link, copy-link, document titles. **Not 298:** lists following the active org.

Requirements: REG-09, LINK-01, LINK-07, LINK-08.

</domain>

<decisions>
## Implementation Decisions

### Order of work (G-5 extraction first)
- **D-01:** Plan 1 is a behaviour-neutral extraction and ships alone, before any router code:
  ChatLayout's `activeView` mount ternary moves **verbatim** into
  `frontend/src/components/layout/AppViewSwitch.tsx`, and App's view/tab `useState` pairs plus their
  navigators (`activeView`, `studioSkillId`/`studioTab`, `libraryTab` + `libraryTabAfterNavigate`,
  `handleNavigate`, `handleOpenStudio`, `handleOpenLibraryHealth`, the boot initializer) move into
  `frontend/src/hooks/useAppNavigation.ts`. Still `useState` inside the hook — no URL yet. The hook's
  return shape is what ChatLayout already receives as props, so the ~40 `onNavigate("…")` call sites
  do not change.
- **D-02:** Every fence that reads `App.tsx` / `ChatLayout.tsx` as `?raw` source or asserts the
  no-router architecture is **re-targeted to the new home in the same commit**, each under a
  `D-297-NN` decision id written into the test. None is deleted or loosened. The `setLibraryTab(`
  two-writer pin moves with its writer (still exactly 2, counted over stripped code). The `NO TWELFTH`
  non-vacuity phrase keeps a home the `LibraryPage.initialTab.test.tsx` control can still find.
  `renameFence.test.ts`'s `"the three-homes contract holds"` needle is preserved verbatim. The planner
  inventories the full fence set first (scout: 7 `?raw` readers, 9 "no router" suites, 1 `<App/>`
  mount; research says ~19 total) and lists each as re-targeted or, only under a named decision,
  retired.
- **D-03:** The vitest count gate (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`)
  shows no unexplained per-file decrease after Plan 1. A moved test is a pin move, recorded in both
  count-gate knobs.

### Router choice
- **D-04:** **react-router 8.5.0 in data mode** (`createBrowserRouter` + `RouterProvider` from
  `react-router/dom`), used for routing ONLY — no `loader`, `action` or `<Form>`. Chosen over
  hand-rolled because `useBlocker` (a POP-capable navigation blocker, data mode only) is what LINK-07
  needs and hand-rolling it is a known bug farm. Verified 2026-10-27: `npm view react-router` → 8.5.0,
  engines `node >=22.22.0`, peer `react >=19.2.7`.
- **D-05:** Costs accepted, all in the router plan (not Plan 1): React/react-dom 19.2.4 → 19.2.9;
  `.github/workflows/frontend-tests.yml` Node 20 → 22 (both jobs, lines 36 and 68); ~+18 KB gzipped
  in the `app.html` chunk only. Imports come from `react-router` / `react-router/dom` — never
  `react-router-dom` (removed in v8).
- **D-06:** Vercel's project Node version is checked (read-only) during research. If it is below 22,
  that is an operator setting change recorded on the deploy parity checklist — never a silent change.
  **RESOLVED 2026-10-27 at plan-phase:** the Vercel project `agentic-rag` reads `nodeVersion: "24.x"`
  (Vercel MCP `get_project`, read-only) — above the 22.22 floor, no operator action needed.

### Tree shape — streams survive navigation
- **D-07:** `RouterProvider` mounts in `main.tsx` above `<App/>` (inside `ThemeProvider`), with ONE
  catch-all route (`path: "*"`) whose component is the existing `App`. No child routes, no `<Outlet>`,
  no path-derived `key` anywhere, so `OrgProvider` → `StreamsProvider` → `ChatLayout` never remount on
  navigation. `activeView` is **derived** from the location by the pure parser.
- **D-08:** Router hooks are called only inside `useAppNavigation` (App level). ChatLayout and
  everything below keep receiving navigator callbacks as props — no `useNavigate` in leaf components,
  so existing suites need no router wrapper. The one `<App/>` test mount gets a memory-router wrapper.
- **D-09:** The router never calls `StreamsProvider`; `setViewingThread` keeps its sole writer
  (L-068-03 gate unchanged). `StreamsProvider.tsx` is NOT edited.
- **D-10:** Acceptance: a stream live in thread A, then six navigations (Library → Workflows → Back →
  Forward → Settings → Back) → `subscriptionsRef.size` unchanged and no `AbortError`. Proven as a
  vitest with a mocked subscribe AND as a live G-4 row.

### Route table and URL rules
- **D-11:** A pure leaf `frontend/src/lib/appRoutes.ts` (no React) owns `parseAppLocation(pathname,
  search)` and `formatAppRoute(route)` and is the one place path vocabulary is spelled. Canonical
  addresses, always `/app/...`:

  | View | Address |
  |---|---|
  | chat | `/app` (also `/app/chat`; bare `/` on an `app.*` host) |
  | documents | `/app/library` |
  | skills | `/app/skills` |
  | skill-studio | `/app/skills/:skillId` (tab not in URL until 299; defaults as today) |
  | settings | `/app/settings` |
  | workflows | `/app/workflows` |
  | connections | `/app/connections` |
  | control-room | `/app/admin` |
  | admin-spend | `/app/admin/spend` |
  | org-admin | `/app/org` |
  | workflow-run | `/app/runs/:runId` |
  | experts | `/app/experts` |

- **D-12:** Ids in the path are strict UUIDs (the `runDeepLink.ts` rule: strict match or `null`, never
  throws). No dots in any segment. The org is never in the path.
- **D-13:** Bare paths with a known prefix (`/workflows`, `/library`, …) are parsed and `replace`d to
  the canonical `/app/...` form — the exact case SEED-185 was planted on. Bare `/` is left as-is (chat
  home) — no `/` → `/app` redirect (SEED-242 keeps the root clean on `app.*`).
- **D-14:** An unknown `/app/...` path renders a minimal in-layout "This address doesn't open
  anything" state with a way home — **never chat silently**. Phase 299 replaces it with the full
  `LinkNotFound`. Keep it to the existing `UnknownViewFallback` look (no new design → no sketch).
- **D-15:** `push` for top-level view changes and opening a run. `replace` for legacy-alias
  normalization, the bare-path normalization, the 403 visibility bounce (`App.tsx` feature-forbidden
  handler becomes `navigate(chat, {replace:true})`), and any home-reset.

### Legacy links and the `?run=` writers
- **D-16:** Legacy shapes are read forever and `replace`d to canonical: `/app?run=<uuid>` →
  `/app/runs/<uuid>`; `/admin/spend` → `/app/admin/spend`; `/app?connections=1&…` → Connections with
  today's exact behaviour preserved (what is read, and when the query is dropped, stays byte-identical
  — research confirms what the Connections tab reads). Each legacy shape gets a cold-load test.
- **D-17:** `/setup` and `/invite` keep their pre-auth short-circuits byte-for-byte. The parser
  ignores them; the router's first parse must never `replaceState` them away.
- **D-18:** `activeRunId` becomes route-held. `writeRunDeepLink` / `clearRunDeepLink` and their call
  sites (`RunEvidenceReport.tsx`, ChatLayout's WR-05 clear effect) are **retired in the same commit**
  that routes runs, so `?run=` never has a second writer. `readRunDeepLink` survives only as the
  parser's legacy alias. `ChatLayout.runDeepLink.test.tsx` is re-targeted to the route form.
- **D-19:** A cold `/app/runs/<id>` waits for `featuresLoading === false` before deciding — it shows
  the existing holding state, never a fallback flash or a refusal while the canvas gate loads.
- **D-20:** The dead `window.location.hash = "#chat"` (`ConnectionsTab.tsx:1146`) is rewired to the
  navigator if a callback is in reach, else deleted — under a browser router a hash write adds a
  history entry. One line; honoured by construction on that hot file.

### Unsaved-edit guard (LINK-07)
- **D-21:** ONE app-level `useBlocker` in `useAppNavigation` consults a small leave-guard registry
  (React context with a safe no-op default, so components stay router-free and their tests need no
  provider). It blocks every route change away — browser Back/Forward AND rail clicks — while a
  registered guard reports dirty.
- **D-22:** The prompt **reuses the existing pattern**: `window.confirm(UNSAVED_LEAVE_PROMPT)` (the
  Builder's 184-11 copy). Confirm → `proceed()`; cancel → `reset()`, edits kept. No new UI, so G-2 is
  not triggered.
- **D-23:** Tenants: the Workflow Builder is mandatory — WorkflowsPage forwards its existing
  `canLeaveBuilderRef` / `registerCanLeave` guard into the registry (no second dirty source). Settings
  is a tenant only if its pending-changes state is readable without new state (research confirms;
  otherwise deferred). The in-page breadcrumb guard keeps working; it is not a route change, so there
  is no double prompt. The existing `beforeunload` covers refresh/tab-close and is unchanged.
- **D-24:** The guard must not fire on a clean editor. Tested both ways: dirty → asked; clean → no ask.

### Reachability and parity (LINK-08)
- **D-25:** `activeViewReachability.ts` gains a route leg: every `ActiveView` member must have a
  `formatAppRoute` ↔ `parseAppLocation` round-trip, alongside its render branch and navigator. It
  still throws on a vacuous parse and still fails a member with no branch.
- **D-26:** A vitest parity suite drives the route table's prefixes through `rewriteDevUrl`
  (`frontend/devRouting.ts`), an evaluator of `frontend/vercel.json` rewrites/redirects, and the
  `location` rules of `frontend/nginx.conf`, failing when any canonical address does not resolve to
  `app.html`. It is **driven RED against a planted mismatch** and the file restored byte-identical.
  Expectation: no change to `vercel.json` or `nginx.conf`.

### Verification
- **D-27:** Four-axis UAT applies (UI state + streaming): full native roster + OpenRouter (8 rows,
  each = a chat answer from that provider keeps streaming across six navigations, via per-request
  `model`/`provider`), multi-tool, parallel-thread (load-bearing: thread A streams while thread B is
  opened by address), long-message. Rows live in VALIDATION.md.
- **D-28:** G-4 lived-experience scenarios, set now at scope time:
  1. Paste `/app/workflows` into a fresh tab → Workflows opens; refresh stays on Workflows.
  2. Start a chat answer, then Library → Workflows → Back → Back → Forward → Back → the answer is
     intact and still streaming or complete, no gap.
  3. Edit a workflow draft, press browser Back → asked; Cancel keeps the edit; OK leaves.
  4. An old `/app?run=<id>` link → the run opens and the bar reads `/app/runs/<id>`.
  Chrome MCP drives them. For row 3 it stubs `window.confirm` (count calls, return false/true) rather
  than raising a native dialog, which would wedge the extension; the operator may run the native
  dialog by hand.

### Plan shape (G-8)
- **D-29:** Target 4 plans: (1) extraction + fence re-target [wave 1]; (2) router core — install +
  React/Node bumps, `appRoutes.ts`, hook derives from URL, legacy aliases, `?run=` retirement,
  `/app/runs/:id`, unknown-path state, reachability route leg [wave 2]; (3) leave guard [wave 3];
  (4) parity suite [wave 3, parallel with 3]. Targeted suites per task, full gates once per wave.

### Amendments from research (2026-10-27, `--auto`, recommended option each time)
- **D-30:** The Workflow Builder is the ONLY leave-guard tenant in 297. `SettingsPage.tsx` has no
  readable dirty value (`:851` confirms unconditionally), so Settings is deferred under D-23. SC#4's
  "or another editor" is met by the registry accepting further tenants; none exists yet.
- **D-31:** Wiring (A): the registry reuses the Builder's existing prompting `canLeave()` check
  (`window.confirm(UNSAVED_LEAVE_PROMPT)` inside it), so `WorkflowBuilderPage.tsx` stays untouched.
  The blocker calls the guard; true → `proceed()`, false → `reset()`.
- **D-32:** A one-shot "already confirmed" latch: an in-page caller that has already run the guard
  (`WorkflowsPage.tsx:944`, `:991`) sets it before it navigates, so the app-level blocker does not ask
  a second time. Test Run never prompts after a run has started: it keeps today's behaviour and the
  latch covers its route change.
- **D-33:** Every raw History write outside `useAppNavigation` is removed when the router mounts
  (`App.tsx:169`, `RunEvidenceReport.tsx:443-444`, `ChatLayout.tsx:315`), because they erase React
  Router's per-entry index and make Back-blocking fail silently. A tree-wide fence pins it (only
  `useAppNavigation` / the router, and the separate `docs/` app, may touch `history`).
- **D-34:** The cold `/app/runs/<id>` wait for `featuresLoading === false` lives INSIDE
  `AppViewSwitch`, never in App's boot splash: `refetch()` flips loading back to true, and holding at
  App level would unmount `StreamsProvider` on every 403 re-sync.
- **D-35:** `/app/admin` and `/app/admin/spend` typed by a non-operator show the D-14 not-found state
  once the operator probe resolves (holding state until then). Never the console, never chat.
- **D-36:** Unknown paths — under `/app/` or bare, with no known prefix — show the D-14 not-found
  state. Only bare `/` is chat.
- **D-37:** D-20 resolves to DELETE: the `#chat` hash write goes, and the "Try in Chat" item's
  missing behaviour (it does nothing today) is filed as a seed, not built here.
- **D-38:** `ActiveView` stays exported from `App.tsx` on ONE line (the docs-coverage gate regex at
  `scripts/lib/docs-content.cjs:701`, the `renameFence` needle and 7 `@/App` importers depend on it).
- **D-39:** Before `npm install react-router@8.5.0`, an automated provenance check
  (`npm view react-router@8.5.0 repository.url maintainers dist.integrity`, expect `remix-run`) stands
  in for the slopcheck the researcher could not run. The install runs once, serialized — worktree
  `node_modules` is a junction to the operator's real tree.
- **D-40:** The IA skill's "wired with NO router" line is amended (corrected beside the original,
  never deleted) in the router plan.
- **D-41:** The parity suite reuses the Vercel evaluator already in `docsVercelRouting.test.ts`.

### Claude's Discretion
- No `ScrollRestoration`: views scroll inside fixed layout containers, so window scroll restoration
  does nothing useful here.
- Focus-on-navigate and `document.title` per route are left to 299 (Pitfalls 22/23).
- Exact names of the registry context/hook and the not-found component.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (v4.8)
- `.planning/research/SUMMARY.md` — router recommendation, route shapes, open questions
- `.planning/research/ARCHITECTURE.md` §0, §1, §3, §7–9, §12 — route table, source-of-truth split,
  incremental migration, anti-patterns AP-1/AP-2/AP-7, build order
- `.planning/research/STACK.md` §(a), §(b), Version Compatibility — router evidence, React Router 8
  facts, SPA fallback measured against production
- `.planning/research/PITFALLS.md` Pitfalls 1, 2, 3, 17, 18, 19 — dev-only links, fence weakening,
  stream teardown, push/replace, deploy skew, permission-load bounce

### Requirements and roadmap
- `.planning/ROADMAP.md` § Phase 297 — goal, 5 success criteria, "How we'd know this failed", Flags
- `.planning/REQUIREMENTS.md` — REG-09, LINK-01, LINK-07, LINK-08 (and LINK-02..06 to know what 299 owns)
- `.planning/seeds/SEED-185-the-app-has-no-router-twelve-views-zero-addressable.md` — folded here (partial)
- `.planning/seeds/SEED-242-product-at-app-subdomain-on-production.md` — why `/` stays clean on `app.*`

### Hot-file ledger (G-5 — read before planning)
- `docs/HOT-FILE-LEDGER.md` § `frontend/src/App.tsx` (+ 262-05, 289-04 subsections) — `useAppNavigation`
  seam, `setLibraryTab` two-writer pin, `NO TWELFTH`, the 187-24 "absence grep not answerable by a comment" rule
- `docs/HOT-FILE-LEDGER.md` § `frontend/src/components/layout/ChatLayout.tsx` (+ 289-04, 289-REVIEW WR-05,
  262-05) — positional-fallback mount switch, `AppViewSwitch` seam, the `?run=` clear effect
- `docs/HOT-FILE-LEDGER.md` § `frontend/src/lib/activeViewReachability.ts` — the triad the route leg extends
- `docs/HOT-FILE-LEDGER.md` § `NavPanel.tsx`, `nav-items.ts`, `WorkflowBuilderPage.tsx`,
  `RunEvidenceReport.tsx`, `frontend/nginx.conf`

### Gates
- `docs/VITEST-COUNT-GATE.md` — per-file no-decrease contract
- `scripts/check-hot-file-ledger.cjs` — runs on PLAN.md write

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/lib/runDeepLink.ts`: strict-UUID reader (never throws) — becomes the `?run=` legacy alias.
- `frontend/src/docs/router.ts`: hand-rolled pure resolver precedent; `appRoutes.ts` copies its pure-leaf shape.
- `frontend/src/lib/activeViewReachability.ts`: parses the union + layout; gains the route leg.
- `WorkflowsPage.tsx:802-812` `canLeaveBuilderRef` / `registerCanLeave` + `WorkflowBuilderPage.tsx:1888`
  `window.confirm(UNSAVED_LEAVE_PROMPT)`: the leave guard D-21..23 reuse.
- `frontend/devRouting.ts` + `devRouting.test.ts`: the three-layer agreement the parity suite extends.

### Established Patterns
- View state is `useState<ActiveView>` in `App.tsx:156` with a boot initializer reading `/admin/spend`,
  `?run=` and `?connections=1`; navigators are passed down as props (no context).
- ChatLayout's mount switch (`ChatLayout.tsx:840-1063`) ends in a positional `UnknownViewFallback`;
  `workflow-run` is gated on `canvasEnabled`.
- Canvas-gated callbacks are passed as `undefined`, never as no-ops.
- Counts in fences are taken over comment-stripped code; prose never spells a fenced literal.

### Integration Points
- `frontend/src/main.tsx` — where `RouterProvider` mounts (above `<App/>`, inside `ThemeProvider`).
- `App.tsx:394-414` — `CitationNavProvider navigate={handleNavigate}` and ChatLayout's navigator props.
- `App.tsx:276-287` — the 403 visibility bounce.
- `RunEvidenceReport.tsx:443-444`, `ChatLayout.tsx:309-316` — the `?run=` writers to retire.
- `ConnectionsTab.tsx:1146` — the dead `#chat` hash write.

</code_context>

<specifics>
## Specific Ideas

- SEED-185 was planted when `localhost:5173/workflows` showed the chat page. After this phase that exact
  URL opens Workflows (D-13) — use it as the first G-4 smoke check.
- Old `/app?run=` links have been shared in production since 2026-10-20 (Phase 289). They must keep working.

</specifics>

<deferred>
## Deferred Ideas

- Per-thread, per-Expert, Skill Studio/Settings/Org tab addresses; `LinkNotFound`; cross-org switch
  prompt; sign-in return-to-link; copy-link; `document.title`; focus-on-navigate → **Phase 299**.
- Builder draft URLs (`/app/workflows/drafts/:id`) and per-document links → candidate route members
  after 299; never inside the router-core plan.
- Leave-guard tenants beyond Builder (and Settings if cheap): `ConnectionFormPanel`, `ModelRegistryTab`,
  `AgentRoundLimits`, `InlineEdit` → a later phase once each exposes a dirty flag.
- `settings_active_tab` localStorage and `api_keys_prepick` sessionStorage handoffs → become URL state in 299.
- `*.vercel.app` previews cannot open `/app` (apex redirect regex matches `vercel.app`) → filed by
  REG-08 in Phase 302; LINK-08 does not cover previews.

### Reported bugs reviewed (not folded)
- `BUG-260610-01` (navigating away/back during a streaming workflow run: duplicate avatar half still
  open) — left open. Not a routing defect, but D-10/D-28 row 2 exercise the same path; if it shows up
  in UAT, record it there rather than fixing it inside this phase.
- `BUG-260923-01` (nav rail density) — out of scope.

</deferred>

---

*Phase: 297-every-view-has-an-address*
*Context gathered: 2026-10-27*
