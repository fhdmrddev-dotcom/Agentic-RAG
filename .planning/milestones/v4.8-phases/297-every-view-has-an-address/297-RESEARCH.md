# Phase 297: Every View Has an Address - Research

**Researched:** 2026-10-27
**Domain:** Client-side routing retrofit (react-router 8.5 data mode) onto a no-router React 19 SPA with G-5 hot files, source fences and live SSE streams
**Confidence:** HIGH for every claim about existing code (read directly at `develop` @ `eaa23c335`, `file:line` cited). MEDIUM for react-router internals beyond the published docs (read from the `main` source on GitHub, not from an installed 8.5.0). LOW items are flagged inline and listed in the Assumptions Log.

> Line numbers are at `eaa23c335` (2026-10-27). Hot files move fast; re-derive before a plan pins a number.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Order of work (G-5 extraction first)
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

#### Router choice
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

#### Tree shape — streams survive navigation
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

#### Route table and URL rules
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

#### Legacy links and the `?run=` writers
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

#### Unsaved-edit guard (LINK-07)
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

#### Reachability and parity (LINK-08)
- **D-25:** `activeViewReachability.ts` gains a route leg: every `ActiveView` member must have a
  `formatAppRoute` ↔ `parseAppLocation` round-trip, alongside its render branch and navigator. It
  still throws on a vacuous parse and still fails a member with no branch.
- **D-26:** A vitest parity suite drives the route table's prefixes through `rewriteDevUrl`
  (`frontend/devRouting.ts`), an evaluator of `frontend/vercel.json` rewrites/redirects, and the
  `location` rules of `frontend/nginx.conf`, failing when any canonical address does not resolve to
  `app.html`. It is **driven RED against a planted mismatch** and the file restored byte-identical.
  Expectation: no change to `vercel.json` or `nginx.conf`.

#### Verification
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

#### Plan shape (G-8)
- **D-29:** Target 4 plans: (1) extraction + fence re-target [wave 1]; (2) router core — install +
  React/Node bumps, `appRoutes.ts`, hook derives from URL, legacy aliases, `?run=` retirement,
  `/app/runs/:id`, unknown-path state, reachability route leg [wave 2]; (3) leave guard [wave 3];
  (4) parity suite [wave 3, parallel with 3]. Targeted suites per task, full gates once per wave.

### Claude's Discretion
- No `ScrollRestoration`: views scroll inside fixed layout containers, so window scroll restoration
  does nothing useful here.
- Focus-on-navigate and `document.title` per route are left to 299 (Pitfalls 22/23).
- Exact names of the registry context/hook and the not-found component.

### Deferred Ideas (OUT OF SCOPE)
- Per-thread, per-Expert, Skill Studio/Settings/Org tab addresses; `LinkNotFound`; cross-org switch
  prompt; sign-in return-to-link; copy-link; `document.title`; focus-on-navigate → **Phase 299**.
- Builder draft URLs (`/app/workflows/drafts/:id`) and per-document links → candidate route members
  after 299; never inside the router-core plan.
- Leave-guard tenants beyond Builder (and Settings if cheap): `ConnectionFormPanel`, `ModelRegistryTab`,
  `AgentRoundLimits`, `InlineEdit` → a later phase once each exposes a dirty flag.
- `settings_active_tab` localStorage and `api_keys_prepick` sessionStorage handoffs → become URL state in 299.
- `*.vercel.app` previews cannot open `/app` (apex redirect regex matches `vercel.app`) → filed by
  REG-08 in Phase 302; LINK-08 does not cover previews.

#### Reported bugs reviewed (not folded)
- `BUG-260610-01` (navigating away/back during a streaming workflow run: duplicate avatar half still
  open) — left open. Not a routing defect, but D-10/D-28 row 2 exercise the same path; if it shows up
  in UAT, record it there rather than fixing it inside this phase.
- `BUG-260923-01` (nav rail density) — out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REG-09 | The G-5 extractions on `App.tsx` and `ChatLayout.tsx` ship behaviour-neutral before the router lands, and their guard tests are re-targeted, not deleted. | §Extraction boundaries (exact prop list for `AppViewSwitch`, return shape for `useAppNavigation`); §Fence inventory (17 suites, each with its re-target for Plan 1 and Plan 2); Pitfalls 1-4 |
| LINK-01 | Every top-level view has its own `/app/...` address. Opening it directly, refreshing, or pressing Back/Forward lands on that view. | §Standard Stack (react-router 8.5.0 data mode, verified), §Architecture patterns 1-3, §Legacy shapes at HEAD, §Feature-gate timing, §Stream survival test |
| LINK-07 | Leaving a page with unsaved edits by Back/Forward asks before discarding them. | §Leave guard (useBlocker POP semantics read from source; Builder wiring today; the double-prompt trap; Settings has no dirty value) |
| LINK-08 | Every address works in local dev, on the cloud app domain and on the self-hosted one-box. An automated check fails if the routing layers disagree. | §Routing layers and the parity suite (evaluator design per layer, existing `docsVercelRouting.test.ts` evaluator to reuse, plant-RED recipe, measured host matrix) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives that bind this phase (authority equal to locked decisions):

- **G-5 refactor before feature wave.** `App.tsx` (37/28/422) and `ChatLayout.tsx` (64/33/1158) FIRE. Extraction first (Plan 1 alone).
- **Hot-file ledger gate.** Every non-test `frontend/src/**` file in a plan's `files_modified` needs a row in `docs/HOT-FILE-LEDGER.md` § Scan list, plus its own section, **in the same commit** (`node scripts/check-hot-file-ledger.cjs <phase>`, run by a PostToolUse hook when PLAN.md is written). Disposition cell ≤ 200 chars; CLAUDE.md FIRING-table cell ≤ 80 chars.
- **G-8:** 3-5 plans; a plan is a wave-sized unit. Never cut verifier, TDD RED drives, security review, code review.
- **Fences are re-targeted, never deleted or loosened**; retirement only under a named decision written into the test.
- **The 187-24 rule:** a grep proving absence must not be answerable by a comment. Count over comment-stripped code; prose never spells a fenced literal (JSX tags `<ChatArea`, `<WorkspacePanel`, the twelfth member literal, the location API in `App.tsx`'s `NO TWELFTH` block).
- **Vitest count gate:** per-file no-decrease, 0 failing; run `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from repo root. A new test file outside a directory TARGET runs in no gate until named in `TARGETS` **and** pinned in `BASELINE` (both knobs, same commit). `BASELINE` keys by **basename**, so a new suite needs a unique basename (precedent: `docsVercelRouting` vs `vercelRouting`).
- **Frontend typecheck:** `npx tsc -p tsconfig.app.json --noEmit` as a **set diff** against base (`npx tsc --noEmit` checks zero files). `noUnusedLocals`/`noUnusedParameters` are on, so imports moved with the switch must leave ChatLayout.
- **Worktrees:** bootstrap first (`bash scripts/bootstrap-worktree.sh "$(pwd)"`); `node_modules` is a **junction** to the operator's real tree; never `rm -rf` a worktree; ≤ 2 concurrent test-running agents.
- **No secrets in URL; env vars for secrets/infra only.**
- **UI phase:** G-4 lived-experience UAT (Chrome MCP), four-axis UAT rows in VALIDATION.md (full native roster + OpenRouter).
- **Supabase Realtime/RLS/backend:** untouched by this phase (frontend only).
- **IA skill:** "three homes" is the WORKFLOW concern triad (Builder / Workflows page / Chat thread), not a count of views. The skill's "wired with NO router" sentence becomes stale with this phase (see Open Question 6).

## Summary

The phase is two moves on two G-5 files and then a router. Both moves are mechanically well-defined at HEAD. ChatLayout's mount switch is `ChatLayout.tsx:840-1129` (the whole `activeView === "chat" ? <grid/> : <non-chat main/>` expression, ~19 KB). It owns no hooks. It reads 37 identifiers from ChatLayout's scope, listed below, so `AppViewSwitch` is a hook-free component with 37 same-named props and the body moves byte-for-byte. App's navigation state is four `useState`s and six navigators (`App.tsx:156-240`). They move into `useAppNavigation` with the `NO TWELFTH` comment block attached. The `ActiveView` union and its docblock **must stay in `App.tsx`**: `scripts/lib/docs-content.cjs:701` regex-reads it there on a single line, `renameFence.test.ts` needs the `"the three-homes contract holds"` needle there, and seven product files import it from `@/App`.

The fence inventory is **17 suites**, not 19. Plan 1 breaks 8 of them; each re-target is one constant or one import path, listed in the inventory table. Plan 2 breaks 6 more. The "no router" phrases in 9 other suites are prose, or assertions about leaf components that stay router-free under D-08, so they keep passing untouched. React Router's POP blocker works by reverting the URL with `history.go(-delta)` and replaying it on `proceed()`. It needs the router's `idx` in `history.state`, and any raw `history.replaceState(null, …)` erases it. So **every raw History write must be gone once the router mounts**. That covers `App.tsx:169`, `RunEvidenceReport.tsx:443-444` and `ChatLayout.tsx:315`. Otherwise Back/Forward desyncs `useLocation` and blocking fails silently.

Three findings change the plan:
- **Nothing reads `oauth_error` or `oauth_connected`.** The `?connections=1` initializer drops the whole query synchronously, so "today's exact behaviour" is just "land on Connections, query gone".
- **Settings has no readable dirty value.** `SettingsPage.tsx:851` confirms unconditionally, so Settings stays deferred under D-23.
- **D-23's "no double prompt" holds for the breadcrumb only.** WorkflowsPage already prompts before two route changes (`WorkflowsPage.tsx:944`, `:991`, pinned by `WorkflowsPage.navGuard.test.tsx`). An app-level blocker would ask a second time unless the forwarded tenant carries a one-shot "already confirmed" latch.

**Primary recommendation:** Plan 1 moves code verbatim and re-targets 8 fences by changing the `?raw` source they read. In Plan 2, `parseAppLocation` handles every legacy shape (so the first render is already right), and one hook-owned `navigate(…, {replace:true})` effect rewrites the address. React Router becomes the only History writer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| URL ↔ view parsing/formatting | Browser (pure leaf `lib/appRoutes.ts`) | — | No React, unit-testable, the one place path vocabulary is spelled (D-11) |
| History reads/writes, Back/Forward, blocking | Browser (`useAppNavigation`, App level) | react-router data router | D-08: router hooks only at App level; leaves get callbacks |
| Which view renders | Browser (`AppViewSwitch`) | — | Pure render switch, no state (ledger seam) |
| SPA fallback (address → `app.html`) | CDN/Static (Vercel rewrites, nginx `location`, Vite dev plugin) | — | Already correct for `/app/*` on all three; parity suite proves it |
| Access to a run/view's data | API/Backend (owner/org 404s, `require_visible`, canvas flag) | Browser render gate (`canvasEnabled`, operator probe) | The client gate is render-only; the server is the wall (T-148-FAILCLOSED) |
| Stream lifetime | Browser (`StreamsProvider`, unchanged) | — | Must sit above nothing route-keyed (D-07, D-09) |
| Unsaved-edit guard | Browser (leave-guard registry + one `useBlocker`) | `beforeunload` (unchanged) | Client-only concern |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-router` | **8.5.0** (published 2026-10-19; v8.0.0 2026-06-17) | Data router: `createBrowserRouter`, `RouterProvider` (from `react-router/dom`), `useLocation`, `useNavigate`, `useBlocker`; `createMemoryRouter` for tests | Locked (D-04). `useBlocker` is data-mode only [CITED: reactrouter.com/api/hooks/useBlocker]. [VERIFIED: npm registry] version/engines/peers |
| `react` / `react-dom` | **19.2.9** (2026-10-14) | Peer of react-router 8 (`>=19.2.7`) | Locked (D-05). [VERIFIED: npm registry] `react-dom@19.2.9` peer `react ^19.2.9` |

**Not new:** `@types/react` 19.2.14 / `@types/react-dom` 19.2.3 already satisfy react-router's optional peers `>=19.2.0` [VERIFIED: package-lock]. TypeScript 5.9.3, Vite 8.0.0, Vitest 4.1.0, jsdom 29, @testing-library/react 16.3.2 are installed [VERIFIED: package-lock.json].

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | | Route-param validation | Project-owned strict-UUID check (the `runDeepLink.ts:16` regex), no zod |

### Alternatives Considered
Locked by D-04. Not re-litigated.

**Installation (Plan 2, ONE place, see Pitfall 9):**
```bash
cd frontend
npm install react-router@^8.5.0 react@^19.2.9 react-dom@^19.2.9
# .npmrc has legacy-peer-deps=true, so npm will NOT enforce the >=19.2.7 peer — the explicit React bump is mandatory.
```

**Version verification (run 2026-10-27):**
- `npm view react-router@8.5.0`: engines `node >=22.22.0`; peers `react >=19.2.7`, `react-dom >=19.2.7` (optional), `@types/react >=19.2.0` (optional); deps `cookie-es ^3.1.1`, `@remix-run/route-pattern ^0.22.1`; exports `.`, `./dom`, `./route-pattern`, …; dist-tag `latest: 8.5.0`. [VERIFIED: npm registry]
- `npm view react@19.2.9` published 2026-10-14T16:54Z. [VERIFIED: npm registry]
- Local Node v24.19.0, npm 11.4.0 (meets `>=22.22.0`). [VERIFIED: shell]

## Package Legitimacy Audit

slopcheck could not run: the `pip install slopcheck` step was **denied by the session's permission classifier** ("Code from External"). Under the protocol, every package below is therefore `[ASSUMED]` for slopcheck purposes, and the planner gates the install behind a `checkpoint:human-verify`. Registry facts were gathered with `npm view` (read-only):

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-router | npm | created 2014-02-02; 8.5.0 on 2026-10-19 | not measured (de-facto standard router) | github.com/remix-run/react-router | unavailable | Approved pending human-verify; **no `postinstall`** (scripts: build/watch/typecheck only) |
| @remix-run/route-pattern (transitive) | npm | resolves `^0.22.1` (latest 1.0.0) | not measured | github.com/remix-run/remix | unavailable | Transitive of react-router; no install scripts |
| cookie-es (transitive) | npm | 3.1.1 | not measured | (unjs) | unavailable | Transitive; no install scripts |
| react / react-dom | npm | 19.2.9 patch on the installed line | — | github.com/facebook/react | unavailable | Patch bump of an installed dependency |

**Packages removed due to slopcheck [SLOP] verdict:** none (not run)
**Packages flagged as suspicious [SUS]:** none (not run). The planner adds one `checkpoint:human-verify` before the Plan 2 install.

## Architecture Patterns

### System Architecture Diagram

```
 address bar / Back / Forward / rail click
            │
            ▼
 ┌─ main.tsx ────────────────────────────────────────────────────────────────┐
 │ StrictMode → ThemeProvider → RouterProvider(router = createBrowserRouter( │
 │                               [{ path: "*", Component: App }]))           │
 └───────────────────────────────┬───────────────────────────────────────────┘
                                 ▼
 ┌─ App (the ONLY route component; never keyed) ─────────────────────────────┐
 │ useAppNavigation():                                                       │
 │   location ──► parseAppLocation(pathname, search) ──► AppRoute | notFound │
 │      │            (legacy aliases parsed here: ?run=, ?connections=1,     │
 │      │             /admin/spend, bare /workflows …; /setup /invite ignored)│
 │      ├─► canonical ≠ current? ──► navigate(canonical, {replace:true})     │
 │      ├─► useBlocker(shouldBlock) ◄── LeaveGuard registry (Builder tenant)  │
 │      └─► returns { activeView, studioSkillId, runId, notFound, onNavigate, │
 │                    openRun, handleOpenStudio, handleOpenLibraryHealth, …} │
 │ pre-auth gates: /setup, /invite (window.location reads, byte-identical)   │
 │ OrgProvider → StreamsProvider → … → ChatLayout(props from the hook)       │
 └───────────────────────────────┬───────────────────────────────────────────┘
                                 ▼
 ChatLayout (threads, doRun, panel, drawer, attention read) ──► AppViewSwitch
   (pure: activeView ternary → page mounts; workflow-run waits on featuresLoading;
    notFound → "This address doesn't open anything" + way home)
                                 │
                 page callbacks ─┘ (onNavigate / openRun) → back up to the hook → navigate(push)

 Serving layers (must agree, parity suite): Vite dev rewriteDevUrl · Vercel vercel.json
 (+ middleware.ts for "/") · one-box nginx.conf ──► /app/* → app.html
```

### Recommended Project Structure (new files)
```
frontend/src/
├── lib/appRoutes.ts                     # Plan 2 — pure: AppRoute, parse/format, VIEW_PATHS: Record<ActiveView,…>, canonicalize
├── lib/__tests__/appRoutes.test.ts       # Plan 2
├── hooks/useAppNavigation.ts             # Plan 1 (useState) → Plan 2 (router-derived)
├── hooks/__tests__/useAppNavigation.test.tsx  # Plan 1 characterization → Plan 2 re-target to URL
├── components/layout/AppViewSwitch.tsx   # Plan 1 (verbatim move)
├── lib/leaveGuard.tsx (name: discretion) # Plan 3 — context + useLeaveGuard(predicate) with no-op default
└── __tests__/routing/appRouteParity.test.ts   # Plan 4 — unique basename
```

### Pattern 1: Verbatim extraction with same-named props (Plan 1)
**What:** Cut `ChatLayout.tsx:840-1129` into `AppViewSwitch`'s `return (…)`. Destructure exactly the identifiers it reads, so the body is byte-identical and every regex fence over it still matches.

**The 37 identifiers the switch reads (exhaustive, read from `ChatLayout.tsx:840-1129`), so 37 props:**

| Group | Identifiers |
|---|---|
| view | `activeView`, `onNavigate` |
| chat grid | `panelState`, `togglePanel`, `expand`, `threadNavigation`, `selectedThread`, `newThread`, `patchThread`, `handleTitleUpdate`, `folders`, `prefillMessage`, `onSetPrefillMessage`, `setDrawerOpen`, `showAttention`, `attentionCount`, `historyCollapsed`, `setHistoryCollapsedPersisted` |
| run / canvas | `canvasEnabled`, `openRunSurface`, `activeRunId`, `doRun` |
| library | `libraryTab`, `attentionConditions`, `handleAskInChat` |
| skills / studio | `handleTryInChat`, `onTuneSkill`, `onOpenStudio`, `onReviewEvals`, `studioSkillId`, `studioTab`, `onStudioTabChange` |
| admin | `operatorIdentity` |
| threads | `threads`, `selectThread`, `loadThreads`, `deleteThread` |

The switch also needs 4 module imports: `writeApiKeyPrepick`, `SETTINGS_TAB_STORAGE_KEY`, `setThreadActiveExpert`, `startScopedChat`. These imports **move** to `AppViewSwitch.tsx`, along with the 14 component imports used only inside the switch: `ChatArea`, `ThreadNavigationProvider`, `WorkspacePanel`, `LibraryPage`, `SkillsPage`, `ConnectionsPage`, `SettingsPage`, `WorkflowsPage`, `SkillStudioPage`, `ControlRoomPage`, `OrgAdminShell`, `WorkflowRunPage`, `AdminSpendPage`, `ExpertCatalogPage`, `UnknownViewFallback`, plus `Menu`. Otherwise `noUnusedLocals` reds ChatLayout. `askInChat` stays in ChatLayout because `handleAskInChat` is defined there.

**What stays in ChatLayout:** `useThreads`, `useFolders`, the org effects, the drawer and history state, the ⌘K/⌘. listeners, `doRun`, `openRunSurface`, `canvasEnabled` (the ONE `useEffectiveFeaturesOptional` read; pass it down, never re-read it in the switch), the single `ATTENTION_PRODUCERS.flatMap` line (fenced `toBe(1)` in `ChatLayout.badge.test.tsx:398` and `LibraryPage.tabAttention.test.tsx`), NavPanel, `ChatHistoryColumn` (its `activeView === "chat"` guard at `:633`), the palette, the mobile drawer (`:756-835`) and `ChatLaunchForm`.

### Pattern 2: `useAppNavigation` return shape (Plan 1 → Plan 2)
Plan 1 (state; verbatim bodies from `App.tsx:156-240`):
```ts
// frontend/src/hooks/useAppNavigation.ts  (Plan 1)
export interface AppNavigation {
  activeView: ActiveView
  onNavigate: (next: ActiveView) => void          // = today's handleNavigate (sets view + spends libraryTab)
  bounceHome: () => void                           // = today's 403 `setActiveView("chat")` (does NOT spend libraryTab — keep neutral)
  studioSkillId: string | null
  studioTab: StudioTab
  handleOpenStudio: (skillId: string, tab?: StudioTab) => void
  handleReviewEvals: (skillId: string) => void
  handleStudioTabChange: (tab: StudioTab) => void
  handleTuneSkill: (skillId: string) => void
  libraryTab: LibraryTab | undefined
  handleOpenLibraryHealth: () => void
}
```
App keeps `useEffectiveFeatures` (the `WorkflowBuilderPage.header.test.tsx:1038` fence pins exactly ONE call, in `App.tsx`), `useOperatorProbe`, `prefillMessage`, the 403 listener (which calls `nav.bounceHome()`), and the provider stack. The hook is called **at the same position** as today's `useState`, before App's early returns (rules of hooks). App's union type and its 99-131 docblock stay. The `NO TWELFTH` block (`App.tsx:196-221`) moves **with** `libraryTab`.

Plan 2 adds `runId: string | null`, `addressNotFound: boolean`, and `openRun(runId)`. `activeView`/`studioSkillId`/`runId` become derived from `useLocation()`; `onNavigate`/`openRun`/`handleOpenStudio` push. `studioTab` and `libraryTab` stay `useState` (tabs are 299).

### Pattern 3: one catch-all route, parse-first legacy handling (Plan 2)
```tsx
// frontend/src/main.tsx (Plan 2) — Source: reactrouter.com/start/data/installation (imports), D-07
import { createBrowserRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
const router = createBrowserRouter([{ path: "*", Component: App }])   // module scope, never in React state
createRoot(document.getElementById("root")!).render(
  <StrictMode><ThemeProvider><RouterProvider router={router} /></ThemeProvider></StrictMode>,
)
```
```ts
// inside useAppNavigation (Plan 2) — sketch, names are discretion
const location = useLocation()
const navigate = useNavigate()                       // data mode: stable identity (useNavigateStable)
const parsed = useMemo(() => parseAppLocation(location.pathname, location.search), [location.pathname, location.search])
useEffect(() => {
  const canonical = canonicalAddress(location.pathname, location.search)   // null when already canonical or pre-auth path
  if (canonical !== null) void navigate(canonical, { replace: true })
}, [location.pathname, location.search, navigate])
```
- The **parser** maps legacy shapes to their route (`/app?run=<uuid>` gives `workflow-run`, `?connections=1` gives `connections`, `/admin/spend[/…]` gives `admin-spend`, bare `/workflows` gives `workflows`). The first render is therefore already correct (no flash), and the effect only fixes the address.
- `navigate` is never called during render: the effect form is required [ASSUMED: RR warns on render-time navigate; HIGH from long-standing RR behaviour]. 8.5.0's "Fix router state recovery when updates occur before `RouterProvider` subscribes" [CITED: react-router CHANGELOG v8.5.0] covers the child-effect-before-parent-subscribe ordering, so **pin `^8.5.0`, never lower**.
- Same-address navigations are no-ops: `onNavigate("chat")` is called while already on chat by the palette, `threadNavigation.openThread`, `handleTryInChat` and others. If the formatted target equals the current `pathname+search`, do nothing; otherwise every thread pick pushes a duplicate entry (Pitfall 17 history spam).

### Pattern 4: leave guard (Plan 3)
```ts
// Source: reactrouter.com/api/hooks/useBlocker + router.ts POP handling (history.go(-delta) revert, proceed → history.go(delta))
const guards = useLeaveGuardRegistry()               // context; default = no tenants
const blocker = useBlocker(({ currentLocation, nextLocation }) =>
  currentLocation.pathname !== nextLocation.pathname &&
  !(nextLocation.state as { forced?: boolean } | null)?.forced &&   // 403 bounce bypass (see Pitfall 8)
  !guards.canLeaveAll())                              // tenant predicate; Builder's predicate itself confirms
useEffect(() => { if (blocker.state === "blocked") blocker.reset() }, [blocker])
```
There are two wirings. The planner records the choice as a `D-297-NN`:
- **(A) Recommended: reuse the predicate that already prompts.** WorkflowBuilderPage registers `() => (dirty ? window.confirm(UNSAVED_LEAVE_PROMPT) : true)` (`WorkflowBuilderPage.tsx:1888`). WorkflowsPage forwards `() => canLeaveBuilderRef.current?.() ?? true` into the registry: one `useLeaveGuard(...)` call. The confirm runs inside `shouldBlock`. Cancel blocks, and the effect calls `reset()` (edits kept). OK means not blocked, so the navigation proceeds and `proceed()` is never needed. **Zero edits to `WorkflowBuilderPage.tsx`** (27 phases), one source of dirty, one prompt string. It deviates from D-22's literal "Confirm → proceed()" but not from what the user sees.
- **(B) D-22 literal:** the tenant reports pure dirtiness, and the effect does `window.confirm(UNSAVED_LEAVE_PROMPT) ? proceed() : reset()`. This needs a **second registration** in `WorkflowBuilderPage.tsx` that exposes `dirty` without the confirm. That edit lands in a FIRING file, and the dirty source is the same but the prompt is now duplicated.

### Anti-Patterns to Avoid
- **Keyed or nested routes, or `<Outlet>` above the providers.** Any of these remounts StreamsProvider and aborts every SSE (Pitfall 3 of milestone research).
- **`useNavigate` in leaves.** It throws outside a router and forces wrappers into many suites (D-08).
- **Any raw `history.pushState`/`replaceState`/`location.hash =` after the router mounts.** These erase `state.idx` and desync `useLocation` (Pitfall 2 below).
- **Holding the router in React state or creating it in render** [CITED: reactrouter.com/api/data-routers/createMemoryRouter "should not be held in React state"].
- **Importing `react-router-dom`.** It was removed in v8 [CITED: CHANGELOG v8.0.0].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Back/Forward blocking | popstate interception + `history.go` bookkeeping | `useBlocker` | POP revert needs per-entry `idx` deltas and a replay after the revert settles (`router.ts`: `history.go(delta * -1)` then `nextHistoryUpdatePromise.then(() => history.go(delta))`) |
| History listening / location state | `useSyncExternalStore` over popstate | `useLocation` | Router already tracks PUSH/REPLACE/POP and idx |
| A vercel.json evaluator | a new one | copy `resolve(host, pathname)` from `src/docs/__tests__/docsVercelRouting.test.ts` (redirects → filesystem → rewrites, host `has` regexes) | Already models Vercel precedence; proven on this file |
| Strict UUID check | a new regex | `runDeepLink.ts:16` `UUID_RE` (move or re-export into `appRoutes.ts`) | One rule, already reviewed (T-289-21) |

**Key insight:** the router must be the only History writer. Each of today's three raw writers is small, but any one left alive breaks POP blocking silently.

## Fence Inventory (Research Question 1)

Legend: **P1** = Plan 1 (extraction) breaks it; **P2** = Plan 2 (router) breaks it; **—** = neither. "Re-target" = the exact change, written into the test under a `D-297-NN` id.

| # | Suite | What it asserts (at HEAD) | Breaks | Re-target |
|---|---|---|---|---|
| 1 | `src/lib/__tests__/activeViewReachability.test.ts` (11 cases, pinned 11) | AST: every `ActiveView` member (from `App.tsx?raw`) has an `activeView === "…"` comparison in `ChatLayout.tsx?raw`; `UnknownViewFallback` is last; vacuity throws; self-guard `LAYOUT` contains `export function ChatLayout` | **P1** (after the move ChatLayout has only `chat` (`:633`), `org-admin`/`control-room` (drawer `:804-828`) and no fallback, so (3) and (4) red) | Read `@/components/layout/AppViewSwitch.tsx?raw` as the layout source; self-guard becomes `export function AppViewSwitch`. Keep `App.tsx?raw` for members. **P2:** add the route leg (D-25) as new cases (see §Reachability route leg); the count rises, never falls |
| 2 | `src/__tests__/library/renameFence.test.ts` (15) | `APP` has `export type ActiveView` + needle `"the three-homes contract holds"` (prose, absent from code); `LAYOUT.length > 20000`; (b) LAYOUT has no `<KnowledgeHealthPage />`, has `UnknownViewFallback`, `as never`; key link `/activeView === "documents" \?[\s\S]{0,120}<LibraryPage onNavigate=\{onNavigate\}/` | **P1** for (b) and the key link (ChatLayout stays ~51 KB, so the length floor holds) | Add a `SWITCH` import (`AppViewSwitch.tsx?raw`) with self-guard `export function AppViewSwitch`; point (b) and the key link at `SWITCH`; keep the `APP` needle **verbatim in `App.tsx`** (it lives in the union docblock, which does not move) |
| 3 | `src/components/layout/__tests__/ChatLayout.fallback.test.tsx` (4) | `LAYOUT` contains `UnknownViewFallback` and `as never`, not `<KnowledgeHealthPage />` | **P1** | Read `AppViewSwitch.tsx?raw`. Optionally add: ChatLayout no longer contains `<UnknownViewFallback` (the switch has ONE home) |
| 4 | `src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx` | Link 2: `className="(grid min-w-0[^"]*)"` has `flex-1 min-h-0`; link 3: first `<main className="…">` has `min-w-0 min-h-0 overflow-hidden` | **P1** (both strings move) | Links 2-3 read `AppViewSwitch.tsx?raw`; rename the `it` titles "AppViewSwitch's grid track/main" (keep counts) |
| 5 | `src/components/layout/ChatLayout.launch.test.tsx` (38) | Source fence over stripped `ChatLayout?raw`: `activeView === "workflow-run"` appears raw > stripped, stripped **=== 1**; branch before `<UnknownViewFallback`; `<ChatArea`/`<WorkspacePanel` only before `<main className="flex-1 overflow-hidden">`; `onOpenRun=\{canvasEnabled \? openRunSurface : undefined\}`; doRun fences (`opts?.inputs === undefined`, `createThread(def.name)`, `active_workflow_run_id`, no wrong-id tokens) | **P1** for the 4 switch-shape cases; **P2** for the `onNavigate("workflow-run")` assertions (`:341`, `:420`, `:466`) and the `showView("workflow-run")` ANCHOR-id case (`:369-384`), because the local `activeRunId` is gone | **P1:** add `switchSource` (`./AppViewSwitch?raw`); `SWITCH_CODE = codeOf(switchSource)` for the stripper NEEDLE, branch-order, split-point and `onOpenRun=` cases; doRun cases stay on `CHAT_LAYOUT_CODE`. **P2:** assert the new run navigator prop is called with `ANCHOR_RUN_ID` (never `PRODUCER_RUN_ID`) and that `onNavigate` is never called with `"chat"`; the ANCHOR render case renders with `activeRunId={ANCHOR_RUN_ID}`. ⚠ Keep the stripped `activeView === "workflow-run"` count at **1** in AppViewSwitch (see Pitfall 6) |
| 6 | `src/components/chat/__tests__/ChatArea.expertThread.test.tsx` case (10) | `ChatLayout.tsx?raw` matches `onThreadUpdated=\{patchThread\}` | **P1** | Read `AppViewSwitch.tsx?raw` for that regex; add `ChatLayout.tsx?raw` matching `patchThread=\{patchThread\}` (the hand-off into the switch), so the "the list's own updater" link stays two-ended |
| 7 | `src/pages/__tests__/LibraryPage.initialTab.test.tsx` "App.tsx — the clearing rule is wired" (4 cases) | Stripped `App.tsx`: length > 4000, contains `handleOpenLibraryHealth`; raw has `NO TWELFTH`, code does not; code contains `libraryTabAfterNavigate`; no `onNavigate={setActiveView}`; `setLibraryTab(` ≥ 2 | **P1** (the writers and `NO TWELFTH` move to the hook) | Read `@/hooks/useAppNavigation.ts?raw` (the `NO TWELFTH` block moves with `libraryTab`, so the non-vacuity pair keeps its home); self-guard anchor becomes `export function useAppNavigation` + `handleOpenLibraryHealth`. Keep an `App.tsx` arm: `not.toContain("onNavigate={setActiveView}")` |
| 8 | `src/pages/__tests__/LibraryPage.tabAttention.test.tsx` (15) | Stripped `App.tsx`: `setLibraryTab(` **exactly 2**, contains `export type ActiveView` + `libraryTabAfterNavigate`; `ChatLayout?raw`: `<LibraryPage[\s\S]{0,200}attentionConditions=\{attentionConditions\}` and `ATTENTION_PRODUCERS.flatMap` === 1 | **P1** | Count `setLibraryTab(` over stripped `useAppNavigation.ts` (**=== 2**) and assert **0** in stripped `App.tsx` (moved, not duplicated); non-vacuity anchors become `export function useAppNavigation` + `libraryTabAfterNavigate`. `<LibraryPage…attentionConditions` reads `AppViewSwitch.tsx?raw`; `flatMap === 1` stays on `ChatLayout?raw`; add ChatLayout `attentionConditions={attentionConditions}` (hand-off into the switch) |
| 9 | `src/components/layout/__tests__/ChatLayout.badge.test.tsx` | Glob inventory: `useSourceAttention(` call sites; `ChatLayout.tsx` has `ATTENTION_PRODUCERS` and `flatMap` === 1 | — | None (the read stays in ChatLayout). Re-run it in Plan 1 |
| 10 | `src/pages/WorkflowBuilderPage.header.test.tsx` "App.tsx is the fetch's ONLY call site" | `useEffectiveFeatures(` count in stripped `App.tsx` === 1 | — if `useEffectiveFeatures` stays in App (recommended) | None. ⚠ If any plan moves it into the hook, re-target to the hook **and** assert App = 0 |
| 11 | `src/components/layout/__tests__/ChatLayout.runDeepLink.test.tsx` (2) | Harness with `?run=` + `&keep=1`; leaving a LIVE run clears `run`, keeps `keep` | **P2** (D-18 retires the writer) | Re-target (D-18) with a memory-router harness through the hook: cold `/app/runs/<uuid>` shows the live run and the address stays; "Back to Workflows" lands at `/app/workflows` with no `run` anywhere. 2 → ≥ 2 cases |
| 12 | `src/lib/runDeepLink.test.ts` (pinned **12** executions) | read strict-UUID; write/clear via replaceState | **P2** (write/clear deleted) | Keep the reader cases; replace the 4 write/clear cases with ≥ equal executions over the legacy-alias contract (e.g. a pure `readRunParam(search)`: valid, junk, upper→lower, extra params ignored) plus a tree-wide stripped-code glob fence: no product file names the retired writers or calls `history.replaceState(`/`pushState(` outside the router. Record the change under D-18 in both count-gate knobs |
| 13 | `src/components/workflows/RunEvidenceReport.test.tsx` "writes ?run=<id> while shown and clears it on unmount" | address gains/loses `run` | **P2** | Re-target (D-18): mount + unmount leave `window.location` **unchanged** (pathname+search identical); the route owns the address |
| 14 | `src/pages/__tests__/SetupWizard.test.tsx` (5 `render(<App />)`, not pinned) | `/setup`, finalized lock-out, AuthPage on a configured box | **P2** (`useLocation`/`useBlocker` throw outside a router) | Wrap: `render(<RouterProvider router={createMemoryRouter([{path:"*",Component:App}],{initialEntries:[path]})}/>)`; keep `window.history.pushState` so App's `window.location.pathname` reads still see `/setup`. Add a case: at `/setup` the router location stays `/setup` (D-17 never replaced) |
| 15 | `src/pages/__tests__/WorkflowsPage.navGuard.test.tsx` | Refusing guard ⇒ gauntlet `onOpenRun` / door `onOpenSettings` never reach the page callbacks | — (Plan 3 must keep it green) | None. Plan 3 adds cases: dirty + confirm ⇒ `confirm` called **exactly once** across the in-page check and the app blocker (Pitfall 7) |
| 16 | `src/pages/WorkflowBuilderPage.session.test.tsx` "← Workflows breadcrumb REFUSES to leave a DIRTY Builder" | Breadcrumb guard with stubbed `confirm` | — | None; reuse its harness for D-24 |
| 17 | `src/components/layout/__tests__/ChatLayoutLaunch.test.tsx:213` | `onNavigate` called with `"workflow-run"` after a library Run | **P2** | Same re-target as #5 (the run navigator prop with the anchor id) |

**Reviewed and found safe (prose or leaf-only "no router" assertions):** `WatchedFoldersSection.test.tsx:742` (`not.toContain("window.location")` over two leaves, which stay router-free); `ConnectionPicker.test.tsx:255` (no `<a>` in a Builder leaf); `WorkflowDoorSwitch.test.tsx:1221`, `WorkspacePanel.test.tsx:612/716`, `ClassificationRulesPage.test.tsx:7/125`, `revertByteIdentical.test.tsx:11`, `ThinkingBlock.characterization.test.tsx:59`, `AcceptInvitePage.test.tsx:5` and `LibraryPage.initialTab.test.tsx:12-17` (comments only). The other ChatLayout mounts (`ChatLayout.orgRefetch`, `ChatLayout.startChat`, `ChatLayout.badge` render cases): `vi.mock` is keyed by resolved module, so page stubs still apply when `AppViewSwitch` imports them. They are safe for Plan 1. For Plan 2, any new ChatLayout props must be **optional** (the 235-08 precedent at `ChatLayout.tsx:130-133`), or these suites red `tsc`.

**Non-test readers of `App.tsx` that bind Plan 1:** `scripts/lib/docs-content.cjs:656,701` regex-reads `export type ActiveView = …` on **one line** of `frontend/src/App.tsx` (the docs-coverage gate, CI `docs-coverage.yml`). `docsCoverageGate.test.ts:55` copies `App.tsx` into a temp tree for that gate. So **`ActiveView` stays exported from `App.tsx`, on one line**. All 7 product importers (`ChatLayout`, `NavPanel`, `ThreadCommandPalette`, `EmbeddingModelCard`, `IndexingTab`, `nav-items`, `LibraryPage`) and 4 test importers keep `from "@/App"`. The hook and the switch use `import type { ActiveView } from "@/App"`. That is a type-only cycle with App, erased under `verbatimModuleSyntax`.

### `activeViewReachability.ts`: how it parses, and the route leg
- `readMembers(appSource)` walks the AST for `type ActiveView = …` and collects string-literal union members; it throws when there is none (`:68-98`). `readLayout(layoutSource)` collects every `activeView === "<lit>"` BinaryExpression (sub-expressions included, so `… && canvasEnabled` counts) and the max `pos` of any `UnknownViewFallback` JSX tag; it throws on zero comparisons (`:107-145`). `fallbackIsLast` = fallback pos > last comparison pos.
- **Plan 1:** the module needs no code change (it takes sources as arguments); only its docblock says "a render branch in `ChatLayout.tsx`" (update the prose, optional). The test passes `AppViewSwitch.tsx?raw`.
- **Plan 2 (D-25):** add an exported `activeViewRouteLeg(appSource, { parseAppLocation, formatAppRoute })` that reuses `readMembers` (and so the vacuity throw). For each member it builds a sample route (a fixed fixture UUID for `workflow-run`/`skill-studio`), formats it, parses it back, and returns `{ unrouted: string[] }` for members whose round-trip does not return the same `view`. Back it at compile time with `VIEW_PATHS: Record<ActiveView, …>` in `appRoutes.ts` (a missing member is a TS2741 error). New cases: shipped members → `unrouted: []`; the synthetic 13th member → `[synthetic]`; zero-member app source throws; every formatted path starts `/app` and has no `.` in any segment. `appRoutes.ts` stays a leaf (type-only import of `ActiveView`).

## Extraction Boundaries (Research Question 2): App side

| Today (`App.tsx`) | Moves to `useAppNavigation` (Plan 1) | Stays in App |
|---|---|---|
| `:156-171` `activeView` + initializer (`/admin/spend`, `readRunDeepLink`, `?connections=1` + `replaceState`) | yes, verbatim (Plan 2 replaces it with the parser) | — |
| `:173-194` `studioSkillId`/`studioTab` + `handleOpenStudio`/`handleReviewEvals`/`handleStudioTabChange`/`handleTuneSkill` | yes | — |
| `:196-226` `NO TWELFTH` block + `libraryTab` + `handleOpenLibraryHealth` | yes, comment block included | — |
| `:227-240` hand-off lifetime comment + `handleNavigate` | yes | — |
| `:172` `prefillMessage` | — | yes (not view state) |
| `:248-265` operator probe, effective features, nav filter | — | yes |
| `:275-298` 403 bounce (`setActiveView("chat")`) | the setter becomes `nav.bounceHome()` | listener stays |
| `:303-344` spinner, `/setup`, `/invite`, AuthPage | — | yes, byte-identical (D-17) |
| `:394-412` `CitationNavProvider navigate={handleNavigate}` + ChatLayout props | — | props read `nav.*` |

`ChatLayout` gets the same 16 props, fed from `nav.*`, so the ~29 `onNavigate("…")` product call sites (grep at HEAD) are untouched.

## Settings Dirty State (Research Question 3)

**No.** `SettingsPage.tsx` has no dirty or pending-changes value. `handleReset` (`:845-855`) re-hydrates from the last server snapshot `s`, and it shows `window.confirm("Reset all unsaved changes across all tabs?")` whenever the shown tab is not `"0"`, **unconditionally**: it never checks whether anything changed. Deriving dirtiness would mean diffing ~15 `useState` values plus two child refs (`roundLimitsRef.changes()`, `apiKeyLimitsRef.changes()` at `:723`, `:832`) against `s`, which is new state logic. Under D-23, **Settings is deferred**. ConnectionFormPanel, ModelRegistryTab and AgentRoundLimits likewise expose no dirty flag (grep: only comments mention "dirty"). **The Builder is the only tenant.** Note that ROADMAP SC#4 says "a workflow builder or another editor". See Open Question 1.

## Builder Leave Guard Wiring Today (Research Question 4)

- **Registration:** `WorkflowBuilderPage.tsx:1886-1890` registers `() => (dirty ? window.confirm(UNSAVED_LEAVE_PROMPT) : true)` through `registerCanLeave` (passed via `WorkflowDoorSwitch`), re-registers on `dirty` change and unregisters on unmount. The prompt copy is at `builderCopy.ts:173-174`: "This draft has unsaved changes. Leave without saving?".
- **Host:** `WorkflowsPage.tsx:802-805` keeps the predicate in a ref. It consults it in three places: the breadcrumb `backToLibrary` (`:812`, in-page), the describe door's connect control (`:944`, then `onOpenConnections()`, an **app-level** route change) and the gauntlet's golden-run link (`:991`, then `onOpenRun(id)`, an **app-level** route change).
- **A nav-rail click today does NOT prompt.** The rail calls ChatLayout's `onNavigate`, then App's `handleNavigate`, then `setActiveView`. That unmounts `WorkflowsPage` silently. The Builder's Test Run (`:950-963` → `doRun` → `onNavigate("workflow-run")`) does not prompt either.
- **An edit is lost on that unmount.** `useDraftPersistence.ts:777` clears the pending autosave debounce timer on cleanup with no flush. An edit inside the debounce window, or a refused/held write, is never sent. `beforeunload` (`WorkflowBuilderPage.tsx:1902-1910`) covers only reload and tab close.
- **So D-21 fixes a real defect.** Once every route change goes through the router, rail clicks are blocked too.

## react-router 8.5 Data-Mode Specifics (Research Question 5)

| Question | Answer | Confidence |
|---|---|---|
| Bootstrap | `createBrowserRouter` from `react-router`, `RouterProvider` from `react-router/dom`; router created once at module scope | HIGH [CITED: reactrouter.com/start/data/installation; CHANGELOG v8.0.0 "RouterProvider/HydratedRouter should be imported from react-router/dom"] |
| Single `path:"*"` route keeps App mounted across navigations | Yes: the same route matches, so React reconciles the same element type at the same position and there is no remount (the classic "component does not remount on param change") | MEDIUM [ASSUMED from long-standing RR behaviour; **proven** by the D-10 mount-count test] |
| `useNavigate` identity | Stable in data mode (`useNavigateStable`); returns `void \| Promise<void>`, so write `void navigate(...)` | MEDIUM [CITED: reactrouter.com/api/hooks/useNavigate via search; unpkg 8.2.0 hooks.js] |
| `useBlocker` signature | `useBlocker(shouldBlock: boolean \| ({currentLocation,nextLocation,historyAction}) => boolean): Blocker`; `state` is `unblocked`/`blocked`/`proceeding`, with `proceed()`, `reset()` and `location`; data and framework modes only; does not handle hard reloads | HIGH [CITED: reactrouter.com/api/hooks/useBlocker] |
| POP semantics | In `history.listen`, if a blocker matches and `delta != null`, the router runs `init.history.go(delta * -1)` ("Restore the URL to match the current UI, but don't update router state") and sets `blocked`. `proceed()` sets `proceeding` and replays with `history.go(delta)` once the revert settles. `reset()` returns the blocker to idle. PUSH/REPLACE are checked in `navigate()`, and `proceed()` re-sends the same navigation | MEDIUM [VERIFIED: github.com/remix-run/react-router `main` `lib/router/router.ts`, read 2026-10-27] |
| When POP blocking silently fails | When `delta` is null, because the entry's `history.state.idx` is missing. The router seeds `idx: 0` once at init (`globalHistory.replaceState({...state, idx})` when null) and writes `{usr,key,idx}` on every push/replace. A foreign `replaceState(null, …)` erases it | MEDIUM [VERIFIED: `lib/router/history.ts` on `main`] |
| One blocker | `shouldBlockNavigation` warns "A router only supports one blocker at a time" and uses the most recent blocker, which matches D-21 (ONE app-level blocker) | MEDIUM [VERIFIED: router.ts on `main`] |
| StrictMode | Blockers register in render (`getBlocker`) and delete in effect cleanup; the StrictMode double mount was fixed in 6.x (PR #10030 inverted the warning condition) | LOW-MEDIUM: test the hook **under `<StrictMode>`** |
| Testing | `createMemoryRouter(routes, { initialEntries, initialIndex })` + `<RouterProvider>`; `router.navigate(-1)` produces a POP with a delta, so blocking is testable in jsdom; `router.state.location` is readable | MEDIUM [CITED: reactrouter.com/api/data-routers/createMemoryRouter]; import path `react-router` [ASSUMED] |
| Middleware | Always on in v8 data mode; harmless with no loaders | HIGH [CITED: CHANGELOG v8.0.0] |
| `ScrollRestoration` | Not used (D-Discretion) | — |
| Peer and engines | React 19.2.9 exists; `@types/react` 19.2.14 OK; `.npmrc` `legacy-peer-deps=true` means peers are **not enforced**, so the explicit React bump is load-bearing | HIGH [VERIFIED: npm registry, package-lock] |

## Legacy Shapes at HEAD (Research Question 6)

| Shape / site | What happens today (file:line) | Under the router (Plan 2) |
|---|---|---|
| `/app?connections=1&oauth_error=…` / `&oauth_connected=1` (built at `backend/app/api/connectors.py:1443-1479`, `:1638-1770`, 12 redirect sites) | `App.tsx:167-170`: reads `connections` once, `window.history.replaceState(null, "", window.location.pathname)`, **drops the entire query**, lands on Connections. **Nothing in `frontend/src` reads `oauth_error` or `oauth_connected`** (grep: zero hits outside App's initializer) | Parser gives `connections`; canonical `/app/connections`, query dropped; the same visible outcome. Milestone research's "keep the query so the Connections tab can read `oauth_error`" is **refuted**: nothing reads it |
| `/app?run=<uuid>` (shared since 289) | `App.tsx:163` → `workflow-run`; `ChatLayout.tsx:309` seeds `activeRunId` from `readRunDeepLink()`; query kept | Parser gives `{workflow-run, runId}`; canonical `/app/runs/<uuid>` (replace). Junk value: not a run, so unknown/not-found (strict UUID, D-12) |
| `?run=` writers | `RunEvidenceReport.tsx:441-445` `writeRunDeepLink(runId)` + cleanup `clearRunDeepLink()`; `ChatLayout.tsx:311-316` WR-05 effect clears when `activeView !== "workflow-run"` | **Both deleted in the Plan 2 commit that routes runs** (D-18); `runDeepLink.ts` keeps only the reader (or a pure `readRunParam(search)` used by the parser) |
| `/admin/spend` (+ `/admin/spend/*`) | `App.tsx:158` pathname check → `admin-spend` | Parser gives `admin-spend`; canonical `/app/admin/spend` (replace). The view is **not** probe-gated today (`ChatLayout.tsx:1061-1062` renders it for anyone; the backend 404s) |
| `/setup` | `App.tsx:320-326` (`window.location.pathname === "/setup"`) | Unchanged; the parser returns "pre-auth, do not touch", so the effect never replaces it |
| `/invite?token=` | `App.tsx:337-340`; `AcceptInvitePage.tsx:54` reads `token`; success does `window.location.assign("/app")` (`:112`, `:131`), a full reload | Unchanged (D-17) |
| 403 bounce | `App.tsx:276-291`: `FEATURE_FORBIDDEN_EVENT` with `status === 403 && message === VISIBILITY_REFUSAL` → refusal banner + `setActiveView("chat")` + `refetchFeatures()` | `navigate("/app", { replace: true, state: { forced: true } })`; `forced` lets the leave guard pass a server-forced exit (Pitfall 8). Same-address check prevents a loop when already home |
| `CitationNavProvider` | `App.tsx:394` `navigate={handleNavigate}`; `citationNav.tsx:98` only ever calls it with `"documents"` | Gets `nav.onNavigate`, so it now pushes `/app/library` (intended) |
| `ConnectionsTab.tsx:1142-1150` "Try in Chat" | `onSelect={() => { window.location.hash = "#chat" }}`, a dead control (nothing reads `#chat`). `ConnectionsTab()` (`:1415`) is mounted by `ConnectionsPage` with **no props** (`ConnectionsPage.tsx:65`, `AppViewSwitch` mounts `<ConnectionsPage />`), so **no navigator is in reach** | D-20 "else deleted": delete the hash write. ⚠ The item then still does nothing (it does nothing today either). See Open Question 3 |
| `frontend/middleware.ts` | matcher `"/"` only; on an `app.` host, `rewrite(new URL("/app.html", …))` keeps `/` in the bar | Parser: `/` gives chat; no redirect (D-13, SEED-242) |
| Other full-page loads | `FinalizedLockout onGoToApp` → `window.location.assign("/app")` (`App.tsx:325`); `ConnectionFormPanel.tsx:1007` / `useAuth.ts:77` / `McpAuthDoor.tsx:206` leave for OAuth/IdP | Unchanged (full reloads are not History writes) |

## Routing Layers and the Parity Suite (Research Question 7)

**Measured layer behaviour:**

| Address | Dev (`rewriteDevUrl`) | Vercel `app.` host | Vercel apex | One-box nginx |
|---|---|---|---|---|
| `/app`, `/app/library`, `/app/runs/<uuid>`, `/app/admin/spend`, every canonical | `/app.html` (`devRouting.ts:30`, dot-less) | rewrite `/(.*)` (host `app\.(.*)`) → `/app.html` | redirect `/app` and `/app/(.*)` → `https://app.:host/app/$1` (308) | `location = /app` and `location /app/` → `try_files $uri /app.html` |
| `/admin/spend` (legacy) | `/app.html` | `/app.html` | redirect `/admin/(.*)` → app host | `location /admin/spend` → `/app.html` |
| `/setup`, `/invite` | `/app.html` | `/app.html` | redirect → app host | `location = /setup` / `= /invite` → `/app.html` |
| `/` | passthrough (landing) | `middleware.ts` → `/app.html` | filesystem `index.html` (landing) | `index.html` (landing) |
| bare `/workflows` (D-13) | `/app.html` | `/app.html` | **404** (no redirect, no file, no rewrite) | **`/index.html` = the LANDING page** |

**State plainly for D-13:** bare-path normalization only helps where `app.html` is already served for the bare path, which means **Vite dev and the Vercel `app.` host**. On the apex a bare path 404s, and on the one-box it opens the marketing landing. That is why the formatter, emails and copy-link always emit `/app/...`. The SEED-185 repro (`localhost:5173/workflows`) is dev, so it is covered.

**`vercel.json` and `nginx.conf` need no change** for any canonical address (all `/app/*`). Prediction: the parity suite is green on first run, with zero config edits.

**Parity suite design (`src/__tests__/routing/appRouteParity.test.ts`, `// @vitest-environment node`):**
1. **Inputs come from the route table, not a hand list.** For each `ActiveView`, `formatAppRoute(sample)` with fixture UUIDs; plus the legacy shapes (`/app?run=<uuid>`, `/app?connections=1&oauth_error=x`, `/admin/spend`) and the pre-auth paths (`/setup`, `/invite?token=x`).
2. **Dev:** import `rewriteDevUrl` from `../../../devRouting` (precedent: `src/docs/__tests__/devRouting.test.ts`). Expect `/app.html` (query kept).
3. **Vercel:** read `../../../vercel.json?raw` (precedent `docsVercelRouting.test.ts:16`, which keeps node types out of `tsconfig.app.json`). Reuse its `resolve(host, pathname)`: redirects first (`^source$`, host `has` as `^(?:value)$`), then the filesystem (`/index.html`, `/app.html`, `/docs.html`), then rewrites in order. On host `app.syrel.example` expect `rewrite → /app.html`. On host `syrel.example` expect a redirect whose destination starts `https://app.:host/` and keeps the path. Then feed the substituted target back through `resolve` on the app host and expect `/app.html`. Add `middleware.ts?raw`: matcher is exactly `"/"` and rewrites to `/app.html` when the hostname starts with `app.`.
4. **nginx:** read `../../../nginx.conf?raw` and parse `location (=\s*)?(\S+)\s*\{[^}]*try_files ([^;]+);`. Implement nginx precedence: an exact `=` match wins, otherwise the longest matching prefix (there are no regex locations in this file). Evaluate `try_files` as "no such file" (route paths are not files), so the result is the last argument. Expect `/app.html`. `location /api/` has `proxy_pass`, not `try_files`, so skip it.
5. **Shape rules:** every canonical path starts `/app`; no segment contains `.` (`devRouting.ts:28` and nginx `$uri` would serve it as a file).
6. **Known-fact rows** (so a change is noticed, not prevented): bare `/workflows` gives dev `app.html`, app host `app.html`, apex 404 and one-box `index.html`.
7. **Permanent negative controls:** run each evaluator over a synthetic config with the `/app/` rule removed and expect a non-`app.html` result, proving the evaluator is not vacuous.
8. **The D-26 RED drive (one-time, recorded in SUMMARY):** delete `location /app/ { … }` from `frontend/nginx.conf` (and, separately, the `/app/(.*)` rewrite in `vercel.json`). Run the suite and capture the RED line. Restore and prove `md5sum` identical before and after (on Windows/autocrlf use `git diff --quiet -- frontend/nginx.conf`, plus `md5sum`; memory: `git checkout -- <dir>` is not a restore here).
9. Both count-gate knobs (TARGETS + BASELINE, unique basename).

## Feature-Gate Timing (Research Question 8)

- `useEffectiveFeatures` (`hooks/useEffectiveFeatures.ts:39-85`): `loading` starts `true`; on **every** `refetch()` it sets `features = {}` and `loading = true` again (`:63-64`). `canvasEnabled = featuresCtx?.features.visual_workflow_canvas === true` (`ChatLayout.tsx:334-335`). So during a cold `/app/runs/<id>` load, `canvasEnabled` is false and today's branch (`activeView === "workflow-run" && canvasEnabled`, `:1014`) falls to `UnknownViewFallback` ("This view has no screen: …"). That is the flash D-19 forbids.
- **Holding state that exists:** `WorkflowRunPage.tsx:1134-1140` renders `COPY_LOADING = "Opening the run…"` (`:157`, a module-local const) when `!runId || loadPhase === "loading"`. App's Iris splash (`App.tsx:303-313`) is **not usable**: it renders in place of the providers, and because `refetch()` flips `loading` back to true, holding there would **unmount StreamsProvider** on every 403 re-sync.
- **Recommendation:** hold inside the switch, in the **same** branch, so the stripped `activeView === "workflow-run"` count stays 1 (launch fence #5). Pass `featuresLoading` from ChatLayout (`featuresCtx?.loading ?? false`, still the one context read). Example shape: `activeView === "workflow-run" && (canvasEnabled || featuresLoading) ? (canvasEnabled ? <WorkflowRunPage …/> : <RunHolding/>) : …`, where `RunHolding` reuses the same markup and copy (export `COPY_LOADING` or copy the sentence into run vocabulary, the planner's choice). Never redirect on features; the switch only renders.
- **Operator probe:** `useOperatorProbe` returns `{ isOperator, identity, loading }` (`hooks/useOperatorProbe.ts`); App destructures only the first two. Today `control-room` and `admin-spend` render for **anyone** who reaches the view (`ChatLayout.tsx:1004`, `:1062`; the backend is the wall), and only the shield gates reaching it. By address, a member can now open `/app/admin`. See Open Question 2.

## Stream-Survival Test (Research Question 9), without editing StreamsProvider

Reuse two existing harnesses:
- `src/providers/__tests__/StreamsProvider.capPausedDone.test.tsx`: `vi.mock("@/lib/api")` partial with `subscribeToRun: mockSubscribeToRun` returning a never-resolving promise; a `Capture` child reading `useStreamActions()`; `setViewingThread(THREAD)` then `sendMessage(THREAD, …)`; resets `useStreamsStore`.
- `src/pages/__tests__/SetupWizard.test.tsx`: the real `App` with `useAuth`, `getSetupStatus` and `hydrateSupabaseFromRuntime` mocked.

**Recommended suite** (`src/__tests__/routing/navigationKeepsStreams.test.tsx`, both knobs):
1. Mount the **real App** in `RouterProvider(createMemoryRouter([{ path: "*", Component: App }], { initialEntries: ["/app"] }))`. Mock `useAuth` to a signed-in user, mock setup status, the operator probe, features and the org fetches, and `vi.mock("@/components/layout/ChatLayout")` with a probe. The probe (a) calls `useStreamActions()` to start a Deep turn in thread A, (b) records mounts and unmounts in `useEffect`, and (c) renders `activeView`. The real `OrgProvider` and `StreamsProvider` sit above it, which is exactly the tree D-07 protects.
2. Capture `signal` = the **4th argument** of `mockSubscribeToRun` (`subscribeToRun(runId, since, callbacks, signal)`, `lib/api/threads.ts:887-892`; called with `controller.signal`, `StreamsProvider.tsx:2042`).
3. Drive six navigations through the hook's navigators and `router.navigate(-1)` / `(1)`: Library → Workflows → Back → Forward → Settings → Back.
4. Assert: `mockSubscribeToRun` called **once**; `signal.aborted === false`; `useStreamsStore.getState().subscriptionsByThread.get(THREAD_A)?.size` unchanged (the store mirrors `subscriptionsRef` in lockstep, `StreamsProvider.tsx:1820`, `:1866`, `:1963`); `streamingThreads.has(THREAD_A)`; probe mounts 1, unmounts 0; `router.state.location.pathname` ends at `/app/workflows`.
5. Add a stripped-code source fence over `main.tsx` and `useAppNavigation.ts`: exactly one route object, `path: "*"`, no `children`, no `key=` in App's provider JSX. RED-drive it by planting `key={location.pathname}` on `<StreamsProvider>` (the mount counter goes to 2 and the signal is aborted), then restore.

## CI / Docker / Vercel Node (Research Question 10)

| Place | Node today | Change |
|---|---|---|
| `.github/workflows/frontend-tests.yml:36` (job 1) and `:68` (job 2, e2e) | `node-version: "20"` | `"22"` (D-05) |
| Other workflows (`docs-coverage`, `landing-drift`, `public-openapi`) | runner default; run `node scripts/*.cjs` only, no frontend install | none |
| `frontend/Dockerfile:16` | `FROM node:22-alpine` (floating 22.x) + `npm install -g npm@11.4.0` + `npm install` (lockfile-drift tolerant, `:49-50`) | none; `node:22-alpine` currently resolves ≥ 22.22 [ASSUMED: floating tag is current] |
| `frontend/package.json` | no `engines` | none (npm only warns on engines) |
| `frontend/vercel.json` | no `nodeVersion`; `buildCommand: "vite build"` | none. **Vercel project Node setting not checked here** (no Vercel tool in this session); the orchestrator checks it (D-06) |

## Common Pitfalls

### Pitfall 1: The reachability fence silently reads the wrong file after Plan 1
**What goes wrong:** If `activeViewReachability.test.ts` keeps reading `ChatLayout.tsx`, (6c) still passes (ChatLayout keeps three comparisons in the drawer and history column), while (3) and (4) red. A careless fix "relaxes" (3).
**How to avoid:** Point the layout leg at `AppViewSwitch.tsx?raw` in the same commit, and change the self-guard identity to `export function AppViewSwitch`.
**Warning sign:** a diff that changes an `expect(...)` value in this suite instead of an import path.

### Pitfall 2: A raw History write survives beside the router
**What goes wrong:** `App.tsx:169` (`replaceState(null, …)`) or the `?run=` writers run after `createBrowserRouter` has seeded `state.idx`. They wipe `idx`, so a later POP to or from that entry has `delta == null`. The blocker cannot revert (the guard fails silently on Back), and `useLocation()` does not see the write.
**How to avoid:** Plan 2 deletes all three raw writers in the commit that adds the router. Add a stripped-code glob fence (fence #12): no `history.replaceState(` or `history.pushState(` and no `location.hash =` in `frontend/src` product code outside `src/docs/` (the docs app has its own router, `docs/router.ts:52-55`).
**Warning sign:** Back/Forward lands on the right URL but the wrong view.

### Pitfall 3: Remounting the provider stack
**What goes wrong:** A `key` from the path, a child route, or the Iris splash used as a feature-loading hold (see Q8) unmounts `StreamsProvider`, and its cleanup aborts every subscription.
**How to avoid:** One `path:"*"` route; holding state only inside `AppViewSwitch`; the D-10 test with the mount counter and signal.

### Pitfall 4: `NO TWELFTH` and the three-homes needle lose their homes
**What goes wrong:** Tidying App's comments deletes the non-vacuity phrase, or the union docblock is rewritten and loses the `"the three-homes contract holds"` substring.
**How to avoid:** Move the `NO TWELFTH` block verbatim with `libraryTab` into the hook, and re-target fence #7 to the hook. Leave the union docblock in App and add any correction **beside** the needle, never through it (the 262 P-11 precedent).

### Pitfall 5: Moving the libraryTab clear into `navigate` misses Back/Forward
**What goes wrong:** If Plan 2 keeps the clear inside `onNavigate`, a POP never runs it. The sequence badge → Health, then Back to chat, then Forward to Library opens Health again, a variant of the 235-15 defect.
**How to avoid:** Move the clear to an effect keyed on the derived `activeView`: `useEffect(() => setLibraryTab(p => libraryTabAfterNavigate(p, activeView)), [activeView])`. The writer count stays **exactly 2** (the write in `handleOpenLibraryHealth`, the clear in the effect). Add a POP case to the hook test.

### Pitfall 6: The not-found and holding arms break the split-point and NEEDLE fences
**What goes wrong:** An early `return` in `AppViewSwitch` that renders a second `<main className="flex-1 overflow-hidden">` before the chat grid moves the launch test's split point ahead of `<ChatArea`. A second `activeView === "workflow-run"` comparison makes the stripped count 2.
**How to avoid:** Put the not-found arm **inside** the non-chat ternary, as its first arm. Gate the outer condition `activeView === "chat" && !addressNotFound` (and `ChatLayout.tsx:633`'s history-column condition the same way). Keep the run holding state in the existing run arm.

### Pitfall 7: Double prompt on WorkflowsPage's two outbound navigations
**What goes wrong:** D-23 says "no double prompt", which is true for the breadcrumb. But `WorkflowsPage.tsx:944` (connect control → `onOpenConnections`) and `:991` (golden-run link → `onOpenRun`) prompt **and then** perform an app-level route change. The new blocker asks the registry again, and the Builder's predicate confirms again (it is still dirty). The user is asked twice.
**How to avoid:** Keep the in-page checks (they are pinned by `WorkflowsPage.navGuard.test.tsx`) and add a one-shot latch. The forwarded tenant is `() => leaveApprovedRef.current ? (leaveApprovedRef.current = false, true) : (canLeaveBuilderRef.current?.() ?? true)`, and both in-page sites set `leaveApprovedRef.current = true` after a passing check, just before calling out. Test it as "confirm called exactly once". This also fits D-28 row 3's call counting.
**Also:** the Builder's Test Run (`:950`) has no in-page check. Under the blocker the prompt fires **after** `doRun` has already created a thread and started the run. Recommend the same pre-check + latch on `onTestRun` (record the decision; see Open Question 4).

### Pitfall 8: The leave guard blocks a server-forced exit
**What goes wrong:** A 403 visibility bounce with a dirty Builder (workflows audience tightened mid-edit) opens "Leave without saving?". Cancel strands the user on a refused surface.
**How to avoid:** The bounce navigates with `state: { forced: true }`, and `shouldBlock` ignores `nextLocation.state?.forced` [ASSUMED: `Location.state` carries `navigate`'s `state` option; standard RR API, MEDIUM].

### Pitfall 9: `npm install` in a worktree mutates the operator's node_modules
**What goes wrong:** `frontend/node_modules` in every worktree is a **junction** to the real tree. Installing react-router or React 19.2.9 there changes the operator's (and any parallel session's) runtime mid-run.
**How to avoid:** Run the install once, as a serialized, announced step (the local-DB lock-file convention), commit `package.json` + `package-lock.json`, and only then run gates. Put the human-verify checkpoint before it.

### Pitfall 10: Normalization strips an auth callback
**What goes wrong:** A "canonicalize everything" effect rewrites `/app?code=…` or `/app#access_token=…` (Supabase SSO/OAuth return) to `/app` before supabase-js has read it.
**How to avoid:** The canonicalizer changes the address only for (a) a non-canonical **path** or (b) a legacy alias param it owns (`run`, `connections`). It removes only those params, preserves every other search param, and never touches the hash. `/setup` and `/invite` are never touched [ASSUMED re: supabase-js URL-read timing; LOW, cover with a unit case `/app?code=x` gives null (no rewrite)].

### Pitfall 11: The `?raw` cross-tree import and node types
Read `vercel.json`, `nginx.conf` and `middleware.ts` with `?raw` (typed by `vite/client`), not `node:fs`, so the app typecheck set does not grow (precedent comment at `docsVercelRouting.test.ts:12-13`).

## Code Examples

### Pure route leaf (shape)
```ts
// frontend/src/lib/appRoutes.ts — pure, no React. Pattern: docs/router.ts:11-55, runDeepLink.ts:16
import type { ActiveView } from "@/App"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type AppRoute =
  | { view: "workflow-run"; runId: string }
  | { view: "skill-studio"; skillId: string }
  | { view: Exclude<ActiveView, "workflow-run" | "skill-studio"> }
export type ParsedLocation = AppRoute | { view: "not-found" } | { view: "pre-auth" }   // /setup, /invite
const VIEW_PATHS: Record<ActiveView, string> = {                // compile-time exhaustive (TS2741 on a missing member)
  chat: "/app", documents: "/app/library", skills: "/app/skills", "skill-studio": "/app/skills",
  settings: "/app/settings", workflows: "/app/workflows", connections: "/app/connections",
  "control-room": "/app/admin", "admin-spend": "/app/admin/spend", "org-admin": "/app/org",
  "workflow-run": "/app/runs", experts: "/app/experts",
}
export function formatAppRoute(r: AppRoute): string { /* VIEW_PATHS + "/" + id (lowercased) */ }
export function parseAppLocation(pathname: string, search: string): ParsedLocation { /* never throws */ }
export function canonicalAddress(pathname: string, search: string): string | null { /* null = leave the bar alone */ }
```

### Memory-router test harness
```tsx
// Source: reactrouter.com/api/data-routers/createMemoryRouter (options); D-08
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
const router = createMemoryRouter([{ path: "*", Component: Shell }], { initialEntries: ["/app?run=229f45ae-c85e-4707-a46c-bf4787541547"] })
render(<StrictMode><RouterProvider router={router} /></StrictMode>)
await waitFor(() => expect(router.state.location.pathname).toBe("/app/runs/229f45ae-c85e-4707-a46c-bf4787541547"))
await act(() => router.navigate(-1))      // POP with a delta → blocker-testable
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-router-dom` package | `react-router` + `react-router/dom` | v8.0.0 (2026-06-17) | Training data and most web examples are wrong for v8 |
| `future.v8_middleware` flag | Middleware always on | v8.0.0 | No flag to set |
| RR view-transition APIs | Deprecated for React 19.3 `<ViewTransition>` | v8.5.0 | Do not adopt either |
| Blocker state lost on revalidation | Preserved | v8.2.0 | n/a (no loaders) |

**Deprecated/outdated in this repo after the phase:** the "no router" prose in `App.tsx:103` (keep the needle; correct beside it), `ChatLayout.tsx:880-884` / `:972-973` / `WorkflowsPage.tsx:791` / `WorkflowBuilderPage.tsx:1880-1881` comments, the IA skill's "wired with NO router" sentence (`SKILL.md:88`, `references/app-information-architecture.md`), and `UnknownViewFallback.tsx:9`'s "`satisfies never`" claim (the caller uses `as never`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A single `path:"*"` route never remounts its component across navigations | Q5, Pattern 3 | Streams abort on navigation; mitigated by the D-10 mount-count test which would red |
| A2 | `useBlocker` + StrictMode double-mount is clean in 8.5 | Q5 | Spurious "one blocker" warning or a lost blocker in dev; test the hook under `<StrictMode>` |
| A3 | `nextLocation.state` carries `navigate(…, {state})` for the forced-bounce bypass | Pitfall 8 | Bounce prompts on a dirty Builder; fallback: a ref flag set just before the bounce |
| A4 | supabase-js reads `?code=`/`#access_token` before any app effect could rewrite the URL, and the canonicalizer never touches unknown params anyway | Pitfall 10 | SSO return broken; mitigated by "never strip unknown params" |
| A5 | `createMemoryRouter` is exported from `react-router` (not only `/dom`) | Code Examples | Import path tweak only |
| A6 | `node:22-alpine` resolves to ≥ 22.22.0 today | Q10 | Docker build warns (engines is advisory); pin `node:22.22-alpine` if needed |
| A7 | Calling `navigate` during render warns/misbehaves, so normalization belongs in an effect | Pattern 3 | Low; effect form is correct regardless |
| A8 | slopcheck verdicts for react-router and its two transitive deps (tool denied) | Package Audit | Planner adds human-verify checkpoint before install |

## Open Questions

1. **SC#4 says "a workflow builder or another editor".** Settings has no dirty value (verified), and the other editors expose none either.
   - Recommendation: Builder-only tenant per D-23, recorded as satisfying SC#4 by decision. Consider asking the operator at plan time whether "another editor" is binding.
2. **Members opening `/app/admin` or `/app/admin/spend` by address.** Today only the probe-gated shield reaches them. By address, a non-operator gets `ControlRoomPage`/`AdminSpendPage` making 404ing reads.
   - Recommendation: in the switch, hold while `operatorLoading`, then render the same not-found state as an unknown address for `!isOperator`. This mirrors the backend's no-oracle 404, needs `operatorLoading` threaded from App, and is render-only. It extends D-14 and needs a `D-297-NN`.
3. **"Try in Chat" after D-20.** Deleting the hash write leaves a menu item that does nothing (as it does today).
   - Recommendation: delete the line per D-20 (byte-minimal, ConnectionsTab FIRES) and plant a SEED/BUG for the dead control. Do not plumb a navigator through `ConnectionsPage → ConnectionsTab → View` here.
4. **Test Run from a dirty Builder.** The app blocker would prompt after the run has started.
   - Recommendation: pre-check + latch before `onLaunch` (Pitfall 7); record it as a deliberate behaviour change (a dirty Test Run now asks first).
5. **Unknown bare (non-`/app`) paths on an `app.` host**, e.g. `/foo` or `/docs/x` (the app host's catch-all serves `app.html` for `/docs/*`, `docsVercelRouting.test.ts`).
   - D-14 scopes the not-found state to `/app/...`. Recommendation: render not-found for unknown bare paths too ("never chat silently"), with no rewrite. The planner decides and records it.
6. **The IA skill says "wired with NO router".**
   - Recommendation: amend beside the original in Plan 2 (docs only; the three-homes *concern* triad is unchanged).
7. **Leave-guard wiring (A) vs (B)** (Pattern 4).
   - Recommendation: (A) (no edit to `WorkflowBuilderPage.tsx`), written down as a D-297 note against D-22's literal "proceed()".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/tests, react-router engines ≥ 22.22 | ✓ | v24.19.0 | — |
| npm | install | ✓ | 11.4.0 | — |
| react-router | Plan 2+ | ✗ (not installed) | — | install in Plan 2 (Pitfall 9) |
| react / react-dom 19.2.9 | Plan 2+ | ✗ (19.2.4 installed) | — | bump in Plan 2 |
| Vitest / jsdom / TL | all tests | ✓ | 4.1.0 / 29.0.0 / 16.3.2 | — |
| GitHub Actions Node 22 | CI | change in Plan 2 | 20 today | — |
| Vercel project Node | prod build | not checked here | — | orchestrator (D-06) |
| Chrome MCP | G-4 rows | operator session | — | operator drives by hand |
| slopcheck | package audit | ✗ (install denied) | — | human-verify checkpoint |

**Missing dependencies with no fallback:** none blocking research. **With fallback:** react-router/React (install), slopcheck (human-verify).

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: false`; this section is included because the orchestrator asked for it explicitly. UAT rows (D-27 four-axis, D-28 G-4) belong in VALIDATION.md, not PLAN.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 (jsdom 29), @testing-library/react 16.3.2; node-env suites via `// @vitest-environment node` |
| Config file | `frontend/vitest.config.ts` (setup `src/setupTests.ts`, alias `@` → `src`) |
| Quick run command | `cd frontend && npx vitest run <file…> --maxWorkers=2` |
| Typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` → **set diff** vs base (base has pre-existing errors; never "zero") |
| Full suite (once per wave) | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **from repo root**; read the verdict line; per-file no-decrease + 0 failing |
| Other gates | `node scripts/check-hot-file-ledger.cjs 297`; `node scripts/check-docs-coverage.cjs` (reads App.tsx's ActiveView line); after Plan 2 build: `cd frontend && npx vite build && node ../scripts/check-landing-first-paint.cjs` (router must not reach the landing chunk) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-09 | Extraction behaviour-neutral; fences re-targeted | unit/source | `npx vitest run src/lib/__tests__/activeViewReachability.test.ts src/__tests__/library/renameFence.test.ts src/components/layout/__tests__/ChatLayout.fallback.test.tsx src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx src/components/layout/ChatLayout.launch.test.tsx src/components/chat/__tests__/ChatArea.expertThread.test.tsx src/pages/__tests__/LibraryPage.initialTab.test.tsx src/pages/__tests__/LibraryPage.tabAttention.test.tsx src/components/layout/__tests__/ChatLayout.badge.test.tsx --maxWorkers=2` | ✅ (re-target) |
| REG-09 | Hook characterization (initializer, studio, library hand-off) | unit (renderHook) | `npx vitest run src/hooks/__tests__/useAppNavigation.test.tsx --maxWorkers=2` | ❌ Wave 0 (Plan 1) |
| LINK-01 | parse/format round-trip, legacy aliases, strict UUID, no dots | unit (pure) | `npx vitest run src/lib/__tests__/appRoutes.test.ts` | ❌ Plan 2 |
| LINK-01 | Cold load per legacy shape; Back/Forward; `/setup` untouched; unknown → not-found; run waits on features | integration (memory router) | `npx vitest run src/hooks/__tests__/useAppNavigation.test.tsx src/pages/__tests__/SetupWizard.test.tsx src/components/layout/__tests__/ChatLayout.runDeepLink.test.tsx --maxWorkers=2` | partial |
| LINK-01 | Streams survive 6 navigations (D-10) | integration | `npx vitest run src/__tests__/routing/navigationKeepsStreams.test.tsx` | ❌ Plan 2 |
| LINK-01 | Reachability route leg (D-25) | unit/AST | `npx vitest run src/lib/__tests__/activeViewReachability.test.ts` | ✅ (extend) |
| LINK-07 | dirty → asked once; cancel keeps; OK leaves; clean → no ask; POP blocked; forced bounce passes | integration | `npx vitest run src/hooks/__tests__/useAppNavigation.leaveGuard.test.tsx src/pages/__tests__/WorkflowsPage.navGuard.test.tsx src/pages/WorkflowBuilderPage.session.test.tsx --maxWorkers=2` | partial (❌ new file) |
| LINK-08 | dev/Vercel/nginx agree; planted mismatch reds | unit (node env) | `npx vitest run src/__tests__/routing/appRouteParity.test.ts src/docs/__tests__/devRouting.test.ts src/__tests__/routing/vercelRouting.test.ts src/docs/__tests__/docsVercelRouting.test.ts` | ❌ Plan 4 |
| LINK-01/07 | G-4 rows 1-4 + four-axis UAT (8 providers, multi-tool, parallel-thread, long-message) | manual / Chrome MCP | VALIDATION.md | ❌ |

### Sampling Rate
- **Per task commit:** the task's targeted files above + `tsc -p tsconfig.app.json` set diff.
- **Per wave merge:** full count gate once (`GSD_VITEST_MAX_WORKERS=2`), ledger gate, docs-coverage gate; Plan 2 also `vite build` + landing first-paint.
- **Phase gate:** count gate green, all RED drives recorded (reachability synthetic member, parity planted mismatch, stream `key` plant, leave-guard clean/dirty), G-4 rows driven.

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useAppNavigation.test.tsx` (Plan 1 characterization, then re-targeted to URL in Plan 2)
- [ ] `src/lib/__tests__/appRoutes.test.ts` (Plan 2)
- [ ] `src/__tests__/routing/navigationKeepsStreams.test.tsx` (Plan 2)
- [ ] `src/hooks/__tests__/useAppNavigation.leaveGuard.test.tsx` (Plan 3; name discretion)
- [ ] `src/__tests__/routing/appRouteParity.test.ts` (Plan 4)
- [ ] Every new suite added to **both** count-gate knobs (TARGETS + BASELINE) with a unique basename

## Security Domain

`security_enforcement: true`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | indirect | Pre-auth `/setup` and `/invite` untouched; auth callback params never stripped (Pitfall 10) |
| V3 Session Management | yes | No token or session id ever in a route path; the parser ignores and preserves unknown params; the invite `token` stays on `/invite` (pre-existing) |
| V4 Access Control | yes (render-only) | Client gates (`canvasEnabled`, operator probe) are render-only; the server's owner/org 404 and `require_visible` 403 stay the wall; not-found for an unknown address and (recommended) for non-operators on `/app/admin*` gives no existence oracle |
| V5 Input Validation | yes | Path ids are strict-UUID or `null`, never a partial match, never thrown (`runDeepLink.ts` rule, D-12); parser total over arbitrary strings (property cases: `//evil.com`, `\`, `%2e%2e`, very long, unicode) |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via legacy-alias normalization | Spoofing/Tampering | Navigation targets are built only by `formatAppRoute` from the route table plus validated UUIDs; never echo `pathname`, `search` or `next=`-style input into a destination; `//host` and backslash paths parse as not-found; RR 8.3.1 also added client-side URL validation [CITED: CHANGELOG v8.3.1] |
| Content spoofing on the not-found state | Spoofing | Render fixed copy; do not echo the requested path as trusted UI (if shown at all, plain React text) |
| Attacker-crafted `/app/runs/<id>` | Information disclosure | Strict UUID gate before any request; server 404 for every refusal (T-289-21/24) |
| Leave-guard bypass leading to data loss | Tampering (integrity of user edits) | Single app-level blocker; no raw History writers (Pitfall 2); forced-exit only for server 403 |
| Token in URL via shared links | Information disclosure | Canonical forms carry no query; copy-link (299) formats from route, not from `location.href` |

## Recommended Plan Breakdown (D-29: 4 plans, waves 1 → 2 → {3, 4})

| Plan | Wave | Scope | `files_modified` (non-test, ledger-watched) | Tests | Ledger notes |
|---|---|---|---|---|---|
| **297-01** Extraction + fence re-target (REG-09) | 1 | Verbatim move into `AppViewSwitch`; App state + navigators into `useAppNavigation` (useState); App feeds ChatLayout from `nav.*`; zero visible change | `frontend/src/App.tsx` **FIRES 37/28/422** · `frontend/src/components/layout/ChatLayout.tsx` **FIRES 64/33/1158** · `frontend/src/components/layout/AppViewSwitch.tsx` **NEW, needs row + section** · `frontend/src/hooks/useAppNavigation.ts` **NEW, needs row + section** · (optional docblock) `frontend/src/lib/activeViewReachability.ts` row exists 1/1/159 | fences #1-8 re-targeted; new `useAppNavigation.test.tsx`; badge #9 re-run | Takes both named seams (App: "at the fifth pair, extract `useAppNavigation()`"; ChatLayout: "the `ActiveView` mount switch"); record the line deltas in both sections |
| **297-02** Router core (LINK-01, part of LINK-08's precondition) | 2 | human-verify, then install; React 19.2.9; CI Node 22; `appRoutes.ts`; `main.tsx` RouterProvider; hook derives from URL; legacy aliases + canonical replace; retire `?run=` writers; `/app/runs/:id`; holding state; not-found arm; reachability route leg; D-20; 403 → navigate replace | `frontend/src/main.tsx` (row 4/2/20) · `frontend/src/App.tsx` · `frontend/src/hooks/useAppNavigation.ts` · `frontend/src/components/layout/ChatLayout.tsx` · `frontend/src/components/layout/AppViewSwitch.tsx` · `frontend/src/lib/appRoutes.ts` **NEW, needs row** · `frontend/src/lib/runDeepLink.ts` (row 1/1/63) · `frontend/src/components/workflows/RunEvidenceReport.tsx` (row, FIRES 6/4/495) · `frontend/src/components/settings/ConnectionsTab.tsx` (row, FIRES 25/9/1635) · `frontend/src/lib/activeViewReachability.ts` · if a new not-found component file: **needs row** (`UnknownViewFallback.tsx` has **no row**, add one if touched) · non-watched: `frontend/package.json`, `package-lock.json`, `.github/workflows/frontend-tests.yml` | fences #5, #11-14, #17 re-targeted; new `appRoutes.test.ts`, `navigationKeepsStreams.test.tsx`; reachability extended | Largest plan; G-8 permits; split only if a worktree boundary demands it |
| **297-03** Leave guard (LINK-07) | 3 | registry context (no-op default) + one `useBlocker` in the hook; WorkflowsPage forwards `canLeaveBuilderRef` with the one-shot latch; Test Run pre-check (if accepted); forced-bounce bypass | `frontend/src/hooks/useAppNavigation.ts` · `frontend/src/pages/WorkflowsPage.tsx` (row, FIRES 47/20/1462) · `frontend/src/lib/leaveGuard.tsx` (name discretion) **NEW, needs row** · (option B only) `frontend/src/pages/WorkflowBuilderPage.tsx` (FIRES 65/27/2940) | new leave-guard suite; `WorkflowsPage.navGuard.test.tsx` + `WorkflowBuilderPage.session.test.tsx` stay green, with added "confirm once" cases | Under option A, WorkflowBuilderPage is not touched |
| **297-04** Parity suite (LINK-08) | 3 (parallel with 03: disjoint files) | evaluators for dev/Vercel/nginx/middleware over the route table; known-fact rows; negative controls; one-time planted RED with byte-identical restore | none expected (`devRouting.ts`, `vercel.json`, `nginx.conf` unchanged; they are outside `frontend/src`, so not ledger-watched; nginx has a row anyway) | new `appRouteParity.test.ts` | If a layer **does** need a change, that becomes a decision, not a silent edit |

Every new test file goes into both count-gate knobs in its plan's commit. Plans 03 and 04 share no files, so they can run in parallel worktrees. Neither mutates the local DB (worktree rule 4 does not apply).

## Sources

### Primary (HIGH confidence)
- Repository at `eaa23c335`: `frontend/src/App.tsx`, `components/layout/ChatLayout.tsx`, `main.tsx`, `lib/activeViewReachability.ts` + test, `lib/runDeepLink.ts` + test, `components/workflows/RunEvidenceReport.tsx` + test, `pages/WorkflowsPage.tsx`, `pages/WorkflowBuilderPage.tsx`, `components/workflows/builderCopy.ts`, `hooks/useDraftPersistence.ts`, `pages/SettingsPage.tsx`, `components/settings/ConnectionsTab.tsx`, `hooks/useEffectiveFeatures.ts`, `hooks/useOperatorProbe.ts`, `pages/WorkflowRunPage.tsx`, `providers/__tests__/StreamsProvider.capPausedDone.test.tsx`, `pages/__tests__/SetupWizard.test.tsx`, all 17 fence suites in the inventory, `frontend/devRouting.ts`, `vercel.json`, `nginx.conf`, `middleware.ts`, `package.json`, `package-lock.json`, `.npmrc`, `tsconfig.app.json`, `vitest.config.ts`, `vite.config.ts`, `Dockerfile`, `.github/workflows/frontend-tests.yml`, `scripts/lib/docs-content.cjs`, `scripts/check-hot-file-ledger.cjs` (run in `--files` mode), `scripts/vitest-count-gate.cjs` (pins), `backend/app/api/connectors.py` (redirect sites), `docs/HOT-FILE-LEDGER.md` sections.
- npm registry (`npm view`, 2026-10-27): react-router 8.5.0 metadata/engines/peers/deps/exports/scripts/time; react 19.2.9; react-dom 19.2.9 peers; @remix-run/route-pattern, cookie-es scripts.
- https://reactrouter.com/api/hooks/useBlocker (signature, states, modes)
- https://reactrouter.com/start/data/installation (imports, module-scope router)
- https://reactrouter.com/api/data-routers/createMemoryRouter (options; "should not be held in React state")
- https://raw.githubusercontent.com/remix-run/react-router/main/packages/react-router/CHANGELOG.md (v8.0.0-v8.5.0)

### Secondary (MEDIUM confidence)
- https://raw.githubusercontent.com/remix-run/react-router/main/packages/react-router/lib/router/router.ts (POP revert/proceed, one-blocker warning). This is `main`, not the 8.5.0 tag.
- https://raw.githubusercontent.com/remix-run/react-router/main/packages/react-router/lib/router/history.ts (`idx` seeding, delta null)
- https://reactrouter.com/api/hooks/useNavigate.md and https://app.unpkg.com/react-router@8.2.0/files/dist/development/lib/hooks.js (stable navigate in data mode, via search)
- https://redirect.github.com/remix-run/react-router/pull/10030 (blocker warning condition)
- Milestone research `.planning/research/{ARCHITECTURE,STACK,PITFALLS}.md` (built on, line numbers re-derived)

### Tertiary (LOW confidence)
- supabase-js URL-read timing on auth return (Pitfall 10), not verified this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions, peers and engines are registry-verified; the install/peer behaviour comes from `.npmrc`.
- Architecture / extraction boundaries / fence inventory: HIGH. Read line-by-line at HEAD.
- react-router blocker internals: MEDIUM. Read from `main` source plus the docs; StrictMode is LOW-MEDIUM.
- Pitfalls: HIGH for repo-derived ones (double prompt, raw writers, holding state, libraryTab POP); MEDIUM for router-internal ones.

**Research date:** 2026-10-27
**Valid until:** 2026-11-10 for line numbers (hot files); 2026-11-26 for the react-router facts.
