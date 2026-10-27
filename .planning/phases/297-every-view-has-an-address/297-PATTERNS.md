# Phase 297: Every View Has an Address - Pattern Map

**Mapped:** 2026-10-27
**Base:** `develop` @ `6783c2f9c` (line numbers read at this HEAD; hot files move, re-derive before pinning)
**Files analyzed:** 14 product/config files (5 new, 9 modified) + 6 new test suites + 17 re-targeted fence suites
**Analogs found:** 19 / 20 (one partial: the router itself has no in-repo analog by design)

---

## File Classification

### New product files

| New file | Plan | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|---|
| `frontend/src/hooks/useAppNavigation.ts` | 01 (state) → 02 (URL) → 03 (blocker) | hook | event-driven (navigator callbacks) → request-response over `location` | **body:** `frontend/src/App.tsx:156-240` (moves verbatim) · **shape:** `frontend/src/hooks/useEffectiveFeatures.ts:4-15,39,84` | exact (verbatim move) |
| `frontend/src/components/layout/AppViewSwitch.tsx` | 01 (+02 arms) | component (pure render switch, no hooks) | transform (props → mount) | `frontend/src/components/layout/ChatLayout.tsx:840-1129` (moves verbatim) | exact (verbatim move) |
| `frontend/src/lib/appRoutes.ts` | 02 | utility (pure leaf, no React) | transform (`pathname+search` ↔ route) | `frontend/src/docs/router.ts:11-45` + `frontend/src/lib/runDeepLink.ts:16-33` + `frontend/src/lib/libraryTabHandoff.ts` (leaf docblock) | exact |
| `frontend/src/lib/leaveGuard.tsx` (name = discretion) | 03 | provider/context with safe default | event-driven (registry of predicates) | `frontend/src/components/workflows/fieldGuidanceContext.ts:22-45` (non-null default, non-throwing hook) + `WorkflowsPage.tsx:802-805` (predicate in a ref) + `lib/citationNav.tsx:89-101` (callbacks in refs for stable identity) | role-match |
| not-found state (inside `AppViewSwitch.tsx` or its own file; name = discretion) | 02 | component | render-only | `frontend/src/components/layout/UnknownViewFallback.tsx:14-22` | exact (same look per D-14) |

### Modified product/config files

| Modified file | Plan | Role | Change | Analog / source of pattern |
|---|---|---|---|---|
| `frontend/src/App.tsx` (FIRES 37/28/422) | 01, 02 | root component | state + navigators leave; `ActiveView` + docblock STAY (D-38); 403 bounce → `nav.bounceHome()` → `navigate(…,{replace,state:{forced}})` | self (`:156-240` out, `:99-132` stays, `:276-291` bounce) |
| `frontend/src/components/layout/ChatLayout.tsx` (FIRES 64/33/1158) | 01, 02 | layout | switch leaves; `activeRunId` + WR-05 clear effect (`:309-316`) retire in 02; passes `featuresLoading` | self |
| `frontend/src/main.tsx` (row 4/2/20) | 02 | entry | `RouterProvider` above `<App/>`, inside `ThemeProvider` | self `:14-20` |
| `frontend/src/lib/runDeepLink.ts` (row 1/1/63) | 02 | utility | delete `writeRunDeepLink`/`clearRunDeepLink`/`replaceWith` (`:35-63`); reader survives as legacy alias (or a pure `readRunParam(search)`) | self `:16-33` |
| `frontend/src/components/workflows/RunEvidenceReport.tsx` (FIRES 6/4/495) | 02 | component | delete the writer effect `:441-445` | — (deletion) |
| `frontend/src/components/settings/ConnectionsTab.tsx` (FIRES 25/9/1635) | 02 | component | delete `window.location.hash = "#chat"` at `:1145-1147` (D-37) | — (deletion) |
| `frontend/src/lib/activeViewReachability.ts` (row 1/1/159) | 01 (prose), 02 (route leg) | utility (AST checker) | add `activeViewRouteLeg(appSource, {parseAppLocation, formatAppRoute})` reusing `readMembers` | self `:69-96`, `:149-159` |
| `frontend/src/pages/WorkflowsPage.tsx` (FIRES 47/20/1462) | 03 | page | forward `canLeaveBuilderRef` into registry + one-shot latch at `:944`, `:991` (and Test Run `:950`) | self `:802-816`, `:941-948`, `:988-995` |
| `frontend/package.json` / `package-lock.json` | 02 | config | `react-router@^8.5.0`, `react`/`react-dom@^19.2.9` | — |
| `.github/workflows/frontend-tests.yml` | 02 | CI config | `node-version: "20"` → `"22"` at `:36`, `:68` | — |
| `scripts/vitest-count-gate.cjs` | 01-04 | gate config | BASELINE pin + TARGETS entry for every new suite; moved pins recorded | self `:481-482`, `:4372-4376`, `:6425-6430` |
| `docs/HOT-FILE-LEDGER.md` (+ CLAUDE.md FIRING table cells ≤ 80 chars) | 01-04 | docs | rows + sections for the 3-4 new `frontend/src` files; line deltas on App/ChatLayout | `docs/HOT-FILE-LEDGER.md:11856` (row) + `:18348` (young-file section) |
| `.claude/skills/sketch-findings-agentic-rag/SKILL.md:88` (+ `references/app-information-architecture.md`) | 02 | docs | correct "wired with NO router" BESIDE the original (D-40) | the `App.tsx:111-129` "CORRECTED … KEPT RATHER THAN OVERWRITTEN" idiom |

### New test files (all need BOTH count-gate knobs, unique basename)

| New suite | Plan | Analog |
|---|---|---|
| `frontend/src/hooks/__tests__/useAppNavigation.test.tsx` | 01 → 02 | `hooks/__tests__/useSourceAttention.test.tsx:21-30` (renderHook + own `?raw` fence) |
| `frontend/src/lib/__tests__/appRoutes.test.ts` | 02 | `lib/runDeepLink.test.ts:20-43` (`it.each` hostile inputs, never-throws) |
| `frontend/src/__tests__/routing/navigationKeepsStreams.test.tsx` | 02 | `providers/__tests__/StreamsProvider.capPausedDone.test.tsx:18-120` + `pages/__tests__/SetupWizard.test.tsx:18-51` |
| `frontend/src/hooks/__tests__/useAppNavigation.leaveGuard.test.tsx` | 03 | `pages/__tests__/WorkflowsPage.navGuard.test.tsx:20-77` (child stubs recording props) |
| `frontend/src/__tests__/routing/appRouteParity.test.ts` | 04 | `docs/__tests__/docsVercelRouting.test.ts:1-56` (evaluator, reuse verbatim per D-41) + `docs/__tests__/devRouting.test.ts` |
| tree-wide raw-History-write fence (D-33; inside `runDeepLink.test.ts` or its own file) | 02 | `components/layout/__tests__/ChatLayout.badge.test.tsx:295-340` (`import.meta.glob(…?raw)` + `rel()` key resolver + `isProductFile`) |

---

## Pattern Assignments

### `frontend/src/hooks/useAppNavigation.ts` (hook)

**Plan 1 body = `App.tsx:156-240`, moved byte-for-byte**, including the `NO TWELFTH` comment block (`App.tsx:196-221`) — it is `LibraryPage.initialTab.test.tsx:517-518`'s non-vacuity control and must travel with `libraryTab`.

**Initializer to move (App.tsx:156-171)** — Plan 2 replaces it with `parseAppLocation`; `:169` is one of the three raw History writers D-33 deletes:
```tsx
const [activeView, setActiveView] = useState<ActiveView>(() => {
  // Phase 257 (METER-07): /admin/spend route
  if (typeof window !== "undefined" && (window.location.pathname === "/admin/spend" || window.location.pathname.startsWith("/admin/spend"))) {
    return "admin-spend"
  }
  if (readRunDeepLink()) return "workflow-run"
  const q = new URLSearchParams(window.location.search)
  if (q.get("connections") !== "1") return "chat"
  window.history.replaceState(null, "", window.location.pathname)
  return "connections"
})
```

**Navigators to move (App.tsx:183-194, 222-240)** — keep names; ChatLayout's prop names do not change:
```tsx
const [studioSkillId, setStudioSkillId] = useState<string | null>(null)
const [studioTab, setStudioTab] = useState<StudioTab>("evals")
const handleOpenStudio = (skillId: string, tab: StudioTab = "evals") => {
  setStudioSkillId(skillId)
  setStudioTab(tab)
  setActiveView("skill-studio")
}
const handleReviewEvals = (skillId: string) => handleOpenStudio(skillId, "evals")
const handleStudioTabChange = (tab: StudioTab) => setStudioTab(tab)
const handleTuneSkill = (skillId: string) => handleOpenStudio(skillId, "triggering")
...
const [libraryTab, setLibraryTab] = useState<LibraryTab | undefined>(undefined)
const handleOpenLibraryHealth = () => {
  setLibraryTab("health")
  setActiveView("documents")
}
const handleNavigate = (next: ActiveView) => {
  setActiveView(next)
  setLibraryTab((pending) => libraryTabAfterNavigate(pending, next))
}
```
`setLibraryTab(` must stay **exactly 2** over stripped code in the hook (fence `LibraryPage.tabAttention.test.tsx:428-439`). Plan 2 (Pitfall 5) moves the clear from `handleNavigate` into `useEffect(() => setLibraryTab(p => libraryTabAfterNavigate(p, activeView)), [activeView])` so POP also spends it — still 2 writers.

**Return-shape / docblock idiom (copy from `hooks/useEffectiveFeatures.ts:4-15, 39, 84`):** exported `interface` with a JSDoc line per field, then `export function useX(...): UseX { … return { … } }`:
```ts
export interface UseEffectiveFeatures {
  /** The caller's effective feature→visible map. ... */
  features: EffectiveFeatures
  /** True until the one-shot per-session fetch resolves. */
  loading: boolean
  refetch: () => void
}
export function useEffectiveFeatures(userId: string | null): UseEffectiveFeatures {
  ...
  return { features, loading, refetch }
}
```
Target interface is RESEARCH Pattern 2 (`activeView, onNavigate, bounceHome, studioSkillId, studioTab, handleOpenStudio, handleReviewEvals, handleStudioTabChange, handleTuneSkill, libraryTab, handleOpenLibraryHealth`; Plan 2 adds `runId, addressNotFound, openRun`).

**Imports** — copy from `App.tsx:10-16` (type-only `StudioTab`, `LibraryTab`; `libraryTabAfterNavigate`; `readRunDeepLink` until Plan 2) and add `import type { ActiveView } from "@/App"` (type-only cycle; `ChatLayout.tsx:59` precedent).

**Plan 2 router wiring** — no in-repo analog (first router). Use RESEARCH Pattern 3 verbatim: `useLocation` + `useNavigate` from `"react-router"` (never `react-router-dom`), `useMemo(parseAppLocation)`, ONE canonicalize effect with `void navigate(canonical, { replace: true })`, same-address no-op guard (Pitfall 17).

**Plan 3 blocker** — RESEARCH Pattern 4 wiring (A): `useBlocker(({currentLocation,nextLocation}) => pathname differs && !nextLocation.state?.forced && !guards.canLeaveAll())` + `useEffect(() => { if (blocker.state === "blocked") blocker.reset() }, [blocker])`.

**App.tsx call site** — call the hook at the SAME position as today's `useState` (before the early returns at `:303`, `:321`, `:338`, `:342`); feed ChatLayout from `nav.*` exactly at `App.tsx:394-411`:
```tsx
<CitationNavProvider navigate={handleNavigate}>
  <ChatLayout
    onSignOut={signOut}
    activeView={activeView}
    onNavigate={handleNavigate}
    ...
    studioSkillId={studioSkillId}
    studioTab={studioTab}
    onOpenStudio={handleOpenStudio}
    onReviewEvals={handleReviewEvals}
    onStudioTabChange={handleStudioTabChange}
    onTuneSkill={handleTuneSkill}
    libraryTab={libraryTab}
    onOpenLibraryHealth={handleOpenLibraryHealth}
  />
```
Stays in App: `useEffectiveFeatures` (pinned ONE call, `WorkflowBuilderPage.header.test.tsx:1038`), `useOperatorProbe` (`:248` — Plan 2 also destructures `loading` for D-35), `prefillMessage` (`:172`), the 403 listener (`:276-291`, `setActiveView("chat")` at `:286` becomes `nav.bounceHome()`), `/setup` / `/invite` gates (`:320-340`, byte-identical, D-17).

---

### `frontend/src/components/layout/AppViewSwitch.tsx` (component, pure switch)

**Analog:** `ChatLayout.tsx:840-1129` — cut the whole `{activeView === "chat" ? (<div className="grid …">…</div>) : (<div className="flex min-h-0 …"><main className="flex-1 overflow-hidden">…<UnknownViewFallback view={activeView as never} /></main></div>)}` expression into `return (…)`.

**Props:** the 37 same-named identifiers listed in RESEARCH Pattern 1 (destructure, so the body is byte-identical and every regex fence still matches). Props-interface idiom to copy: `ChatLayout.tsx:96-141` (JSDoc'd `interface Props`, optional props for anything new — the 235-08 precedent at `:130-133`: *"BOTH ARE OPTIONAL ON PURPOSE. Four shipped suites mount `<ChatLayout {...baseProps} />`"*).

**Imports that move with it** (from `ChatLayout.tsx:12-47, 67`): `ChatArea`, `ThreadNavigationProvider`, `WorkspacePanel`, `LibraryPage`, `SettingsPage`, `SETTINGS_TAB_STORAGE_KEY`, `writeApiKeyPrepick`, `ConnectionsPage`, `SkillsPage`, `WorkflowsPage`, `UnknownViewFallback`, `SkillStudioPage`, `ControlRoomPage`, `OrgAdminShell`, `WorkflowRunPage`, `AdminSpendPage`, `ExpertCatalogPage`, `startScopedChat`, `setThreadActiveExpert`, `Menu`. Leave behind in ChatLayout what it still uses (`noUnusedLocals` is on). Types `type ThreadNavigation`, `type PanelState`, `type StudioTab`, `type LibraryTab`, `type ActiveView`, `type OperatorIdentity` as needed.

**Fence-critical text that must survive the move unchanged** (each is a regex/indexOf in a suite):
- `className="grid min-w-0 min-h-0 flex-1 overflow-hidden …"` and `<main className="min-w-0 min-h-0 overflow-hidden">` (`:858`, `:864`; scrollFrame fence)
- `<main className="flex-1 overflow-hidden">` (`:922`; launch split-point fence)
- `onThreadUpdated={patchThread}` (`:870`; ChatArea.expertThread fence)
- `activeView === "documents" ? (` immediately followed (≤120 chars, no comment in the gap) by `<LibraryPage onNavigate={onNavigate} … attentionConditions={attentionConditions}` (`:929-930`; renameFence + tabAttention)
- `onOpenRun={canvasEnabled ? openRunSurface : undefined}` (`:904`, `:952`, `:967`)
- stripped `activeView === "workflow-run"` count **=== 1** (`:1014`)
- `<UnknownViewFallback view={activeView as never} />` LAST (`:1125`)

**Plan 2 arms (Pitfall 6):** not-found = first arm INSIDE the non-chat ternary; outer condition becomes `activeView === "chat" && !addressNotFound`; the run holding state goes inside the EXISTING run arm (`:1014`) so the stripped count stays 1:
```tsx
activeView === "workflow-run" && (canvasEnabled || featuresLoading) ? (canvasEnabled ? <WorkflowRunPage …/> : <RunHolding/>) : …
```
Holding copy source: `WorkflowRunPage.tsx:157` `COPY_LOADING = "Opening the run…"` and its markup `:1134-1140`:
```tsx
<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
  <p className="text-sm text-muted-foreground">{COPY_LOADING}</p>
</div>
```
`featuresLoading` comes from ChatLayout's ONE context read (`ChatLayout.tsx:334-335` — `featuresCtx?.loading ?? false`), passed down; never re-read in the switch (D-34).

---

### `frontend/src/lib/appRoutes.ts` (pure leaf)

**Analog 1 — pure resolver shape (`frontend/src/docs/router.ts:11-45`):** normalise, early-return by literal, unknown → `{ kind: "not-found" }`, never throws:
```ts
export function resolveRoute(pathname: string, manifest: RouteManifest): Route {
  let p = pathname.split(/[?#]/)[0]
  if (p.length > 1) p = p.replace(/\/+$/, "")
  if (p === "/docs") return { kind: "home" }
  if (!p.startsWith("/docs/")) return { kind: "not-found" }
  const rest = p.slice("/docs/".length)
  ...
  return { kind: "not-found" }
}
```
⚠ Do NOT copy `router.ts:52-55` (`navigate` via `window.history.pushState`) — that is the docs app's own writer and is exactly what D-33 forbids in the product tree.

**Analog 2 — strict id rule (`frontend/src/lib/runDeepLink.ts:16, 23-33`):** move or re-export `UUID_RE`; strict match or `null`, lowercase, wrapped in `try`:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function readRunDeepLink(): string | null {
  try {
    if (!hasWindow()) return null
    const raw = new URLSearchParams(window.location.search).get(PARAM)
    if (raw === null || !UUID_RE.test(raw)) return null
    return raw.toLowerCase()
  } catch {
    return null
  }
}
```
`appRoutes.ts` takes `(pathname, search)` as ARGUMENTS (no `window` read) — the D-11 contract.

**Analog 3 — leaf docblock + "no import cycle" rule (`frontend/src/lib/libraryTabHandoff.ts` header, `:39-46`):** "⛔ THIS MODULE IS A STRICT LEAF. No React, no runtime imports". `appRoutes.ts` may import `type { ActiveView } from "@/App"` (type-only, erased under `verbatimModuleSyntax`) — the only import.

**Compile-time exhaustiveness:** `VIEW_PATHS: Record<ActiveView, string>` (RESEARCH Code Examples) — a missing member is TS2741, which backs the AST route leg.

**Legacy aliases owned by the parser** (D-16, RESEARCH §Legacy Shapes): `/app?run=<uuid>` → `workflow-run`; `?connections=1` → `connections` (drop the whole query — nothing reads `oauth_*`); `/admin/spend[/…]` → `admin-spend`; bare known prefix → view; `/setup`, `/invite` → `pre-auth` (never canonicalised); `/` → chat; every other path → not-found. Canonicaliser strips only the params it owns, never the hash (Pitfall 10).

---

### `frontend/src/lib/leaveGuard.tsx` (context, safe no-op default)

**Analog 1 — non-null default + non-throwing hook (`frontend/src/components/workflows/fieldGuidanceContext.ts:22-28, 43-45`):**
```ts
import { createContext, useContext } from "react"
/** ⚠ DEFAULT `true` — ... Outside a provider every consumer renders its guidance ... */
export const FieldGuidanceContext = createContext<boolean>(true)
/** NON-THROWING, the `useSelectedPhaseSlug` idiom: there is no "no provider" error state to
 *  report, because the absence of a provider has a correct answer ... */
export function useFieldGuidance(): boolean {
  return useContext(FieldGuidanceContext)
}
```
Every other context in the tree is `createContext<T | null>(null)` + a throwing hook (`citationNav.tsx:64`, `OrgProvider.tsx:74`, `EffectiveFeaturesProvider.tsx:52`) — do NOT copy those: D-21 requires that tenants (WorkflowsPage) work with no provider so their suites need no wrapper. Default = a registry whose `register` is a no-op returning a no-op unregister.

**Analog 2 — predicate held in a ref, read at decision time (`WorkflowsPage.tsx:802-805, 812`):**
```tsx
const canLeaveBuilderRef = useRef<(() => boolean) | null>(null)
const registerCanLeave = useCallback((canLeave: (() => boolean) | null) => {
  canLeaveBuilderRef.current = canLeave
}, [])
...
if (canLeaveBuilderRef.current !== null && !canLeaveBuilderRef.current()) return
```

**Analog 3 — injected callbacks in refs for a stable value (`lib/citationNav.tsx:89-110`):** `navigateRef.current = navigate` each render, `useCallback(..., [])`, `useMemo` value.

**Analog 4 — register/unregister effect lifetime (`WorkflowBuilderPage.tsx:1886-1890`, NOT edited under wiring A):**
```tsx
useEffect(() => {
  if (!registerCanLeave) return
  registerCanLeave(() => (dirty ? window.confirm(UNSAVED_LEAVE_PROMPT) : true))
  return () => registerCanLeave(null)
}, [registerCanLeave, dirty])
```
The tenant hook `useLeaveGuard(predicate)` copies this effect shape (register on mount/change, unregister on cleanup).

---

### `frontend/src/pages/WorkflowsPage.tsx` (Plan 3 tenant + latch)

Forward the existing ref (no second dirty source, D-23/D-31) and add the one-shot latch (D-32) at the two in-page sites that already prompt (`:943-946`, `:990-993`):
```tsx
onOpenSettings={
  onOpenConnections
    ? () => {
        if (canLeaveBuilderRef.current !== null && !canLeaveBuilderRef.current()) return
        onOpenConnections()
      }
    : undefined
}
...
onOpenRun={
  onOpenRun
    ? (id: string) => {
        if (canLeaveBuilderRef.current !== null && !canLeaveBuilderRef.current()) return
        onOpenRun(id)
      }
    : undefined
}
```
Insert `leaveApprovedRef.current = true` between the passing check and the outbound call; tenant predicate per RESEARCH Pitfall 7. `onTestRun` (`:950-966`) gets the same pre-check + latch if the planner accepts Open Question 4. Correct the `:791` "THERE IS NO ROUTER HERE" prose beside the original.

---

### Not-found state (D-14 / D-35 / D-36)

**Analog:** `frontend/src/components/layout/UnknownViewFallback.tsx:14-22` — same classes, fixed copy, plus a way home (an `onNavigate("chat")` button); never echo the requested path as trusted UI (Security: content spoofing):
```tsx
export function UnknownViewFallback({ view }: { view: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <p className="text-muted-foreground text-sm">
        This view has no screen: <code className="text-foreground font-mono text-xs">{view}</code>
      </p>
    </div>
  )
}
```
`UnknownViewFallback.tsx` has **no ledger row**; touching it (e.g. correcting `:9`'s stale "`satisfies never`" claim) needs one. A new component file needs a row + section too. `react-refresh/only-export-components`: a component file must not also export a hook (see `fieldGuidanceContext.ts:9-14`).

---

### `frontend/src/main.tsx` (Plan 2)

**Today (`:14-20`):**
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
```
Replace `<App />` with `<RouterProvider router={router} />`; `const router = createBrowserRouter([{ path: "*", Component: App }])` at MODULE scope (`createBrowserRouter` from `"react-router"`, `RouterProvider` from `"react-router/dom"`). Keep the single-quote style of this file and the 200-06 ThemeProvider docblock.

---

### `frontend/src/lib/activeViewReachability.ts` (Plan 2 route leg)

**Reuse `readMembers` (`:69-96`)** so the vacuity throw is inherited; mirror the report/function shape of `:35-47` + `:149-159`:
```ts
export interface ReachabilityReport { members: string[]; branched: string[]; unbranched: string[]; fallbackIsLast: boolean }
export function activeViewReachability(appSource: string, layoutSource: string): ReachabilityReport {
  const members = readMembers(appSource)
  const { branched, lastComparisonPos, fallbackPos } = readLayout(layoutSource)
  return { members, branched, unbranched: members.filter((m) => !branched.includes(m)), fallbackIsLast: … }
}
```
New `activeViewRouteLeg(appSource, { parseAppLocation, formatAppRoute })` returns `{ unrouted: string[] }` — functions are passed IN, so the module stays free of a runtime import of `appRoutes.ts` (its "nothing in the app bundle imports this file" property, `:23-24`). Plan 1 changes only the docblock's "a render branch in `ChatLayout.tsx`" (`:6`) — optional.

---

### Deletions (Plan 2, D-18 / D-33 / D-37)

| Site | Code to delete |
|---|---|
| `RunEvidenceReport.tsx:441-445` | `useEffect(() => { writeRunDeepLink(runId); return () => clearRunDeepLink() }, [runId])` + its import |
| `ChatLayout.tsx:309-316` | `useState(() => readRunDeepLink())` (→ `runId` prop from the hook) + the WR-05 `clearRunDeepLink()` effect + import `:39` |
| `App.tsx:169` (by then in the hook) | `window.history.replaceState(null, "", window.location.pathname)` |
| `runDeepLink.ts:35-63` | `replaceWith`, `writeRunDeepLink`, `clearRunDeepLink` |
| `ConnectionsTab.tsx:1145-1147` | the `onSelect={() => { window.location.hash = "#chat" }}` body (D-37; seed the dead "Try in Chat" control) |

---

## Test Patterns

### Shared: the `?raw` comment stripper (use the LINE-ANCHORED form)

There are three strippers in the tree; they are NOT equivalent:

| Form | Where | Use for |
|---|---|---|
| `src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")` | `renameFence.test.ts:89-91`, `LibraryPage.initialTab.test.tsx:510`, `LibraryPage.tabAttention.test.tsx:432-434` | **default for every re-targeted fence** ("⚠ The `^\s*` is load-bearing: the unanchored variant eats live code") |
| `stripComments` from `@/lib/stripComments.testutil` (`:28-29`, `^[ \t]*\/\/`) | shared helper (244-14) | new suites; ⛔ never on class-list/string-content assertions |
| `codeOf` unanchored `/\/\/[^\n]*/g` | `ChatLayout.launch.test.tsx:543-545` | keep only where it already is (launch fence), re-pointed at the switch source |

Every re-target keeps its **self-guard identity + non-vacuity pair** (renameFence `:101-123` idiom):
```ts
expect(APP.length).toBeGreaterThan(4000)
expect(LAYOUT).toContain("export function ChatLayout")   // → "export function AppViewSwitch" / "export function useAppNavigation"
expect(APP).toContain("the three-homes contract holds")   // prose-only token…
expect(APP_CODE).not.toContain("the three-homes contract holds") // …proves the stripper did not return ""
```
CRLF normalisation first: `const lf = (s: string) => s.replace(/\r\n/g, "\n")` (`activeViewReachability.test.ts:35`).

### Re-target recipe (Plan 1 fences — change the SOURCE, never an `expect` value)

Pattern — add a second `?raw` import for the new home, keep the old one for what stays:
```ts
import appSourceRaw from "@/App.tsx?raw"
import layoutSourceRaw from "@/components/layout/ChatLayout.tsx?raw"      // keep for flatMap === 1, doRun cases, hand-off props
import switchSourceRaw from "@/components/layout/AppViewSwitch.tsx?raw"   // NEW: branch/fallback/key-link cases
import navSourceRaw from "@/hooks/useAppNavigation.ts?raw"                // NEW: setLibraryTab === 2, NO TWELFTH pair
```
Write the `D-297-NN` id into each changed test (D-02). Per-suite target table: RESEARCH §Fence Inventory rows 1-8 (Plan 1) and 5, 11-14, 17 (Plan 2). Pitfall 1 warning sign: a diff that changes an `expect(...)` value instead of an import path. "Moved, not duplicated" arms: `setLibraryTab(` **0** in stripped `App.tsx`, **2** in stripped hook; `<UnknownViewFallback` **0** in ChatLayout code, present in switch.

### `useAppNavigation.test.tsx` (renderHook characterization)

**Analog:** `hooks/__tests__/useSourceAttention.test.tsx:21-30` — `renderHook, act, cleanup` from `@testing-library/react`, import the hook AND its own `?raw` for a source fence in the same suite:
```ts
import { renderHook, act, cleanup } from "@testing-library/react"
import { useSourceAttention } from "../useSourceAttention"
import hookSource from "../useSourceAttention.ts?raw"
```
Plan 1 cases: initializer (`/admin/spend`, `?run=<uuid>`, `?connections=1` drops query), `handleOpenStudio` default tab `"evals"`, `handleTuneSkill` → `"triggering"`, library hand-off spent by next navigate. Set the URL with `window.history.replaceState(null, "", path)` (`runDeepLink.test.ts:11-13`) — test-side only. Plan 2 re-targets to a memory router wrapper (RESEARCH Code Examples: `createMemoryRouter([{ path: "*", Component: Shell }], { initialEntries })` + `<StrictMode><RouterProvider/></StrictMode>`, `await act(() => router.navigate(-1))` for POP). Add a POP case for the libraryTab clear (Pitfall 5).

### `appRoutes.test.ts` (pure)

**Analog:** `lib/runDeepLink.test.ts:20-43` — `it.each` over hostile inputs, a "never throws" case:
```ts
it.each([
  ["missing", "/app"],
  ["empty", "/app?run="],
  ["not a uuid", "/app?run=run-1"],
  ["a path", "/app?run=../x"],
  ["a uuid with a tail", `/app?run=${UUID}x`],
  ["an encoded script", "/app?run=%3Cscript%3E"],
])("returns null when the value is %s", (_label, path) => { … })
```
Extend with the Security-Domain property cases (`//evil.com`, `\`, `%2e%2e`, very long, unicode), `/app?code=x` → no rewrite (Pitfall 10), round-trip for every `VIEW_PATHS` key, "no `.` in any segment". The 4 write/clear cases deleted from `runDeepLink.test.ts:46-70` must be replaced by ≥ equal executions (pinned **12**, gate `:4372`).

### `navigationKeepsStreams.test.tsx` (D-10)

**Analog A — mocked subscribe + `Capture` child (`StreamsProvider.capPausedDone.test.tsx:18-39, 53, 68-81, 100-115`):**
```ts
const { mockPostMessage, mockSubscribeToRun, … } = vi.hoisted(() => ({ mockPostMessage: vi.fn(), mockSubscribeToRun: vi.fn(), … }))
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, postMessage: mockPostMessage, subscribeToRun: mockSubscribeToRun, … }
})
function Capture() { actions = useStreamActions(); return null }
function reset() { useStreamsStore.setState({ bucketsBySurface: new Map(), streamingThreads: new Set(), … }) }
mockSubscribeToRun.mockImplementation(async (_rid, _since, cbs) => { callbacks = cbs; return new Promise<void>(() => {}) })
```
Capture the 4th argument (`signal`) instead of ignoring it.

**Analog B — the real `<App/>` with auth/setup mocked (`SetupWizard.test.tsx:18-51`):** `vi.mock("@/hooks/useAuth", …)` (signed-in user here), partial `@/lib/api` (`getSetupStatus`), partial `@/lib/supabase` (`hydrateSupabaseFromRuntime: vi.fn().mockResolvedValue(undefined)`). Then `vi.mock("@/components/layout/ChatLayout")` with a probe that starts the stream, counts mounts/unmounts and renders `activeView`. Assertions + the `key={location.pathname}` RED plant: RESEARCH §Stream-Survival Test steps 1-5.

### `SetupWizard.test.tsx` (Plan 2 re-target, the one `<App/>` mount)

Wrap each `render(<App />)` (`:64`, `:75`, `:81`, …) in `<RouterProvider router={createMemoryRouter([{ path: "*", Component: App }], { initialEntries: [path] })} />`; keep `setPath` (`:49-51`, `window.history.pushState`) because App's `/setup`/`/invite` checks still read `window.location.pathname`. Add: at `/setup` the router location stays `/setup` (D-17).

### `useAppNavigation.leaveGuard.test.tsx` (Plan 3)

**Analog:** `WorkflowsPage.navGuard.test.tsx:20-77` — `vi.hoisted` `seen` record, child stubs that capture the props the page hands them (so the test CHOOSES the predicate's answer), partial `@/lib/api` list mocks:
```tsx
const { seen } = vi.hoisted(() => ({ seen: { door: null as DoorProps | null, gauntlet: null as GauntletProps | null } }))
vi.mock("@/components/workflows/WorkflowDoorSwitch", () => ({
  WorkflowDoorSwitch: (props: DoorProps) => { seen.door = props; return <div data-testid="door-stub">…</div> },
}))
```
`window.confirm` stubbed with `vi.spyOn(window, "confirm").mockReturnValue(false|true)` and **call-count** asserted (D-24 clean → 0 calls; dirty Back → 1; in-page connect + app blocker → exactly 1, Pitfall 7; forced 403 bounce → 0). Run under `<StrictMode>` (Assumption A2). `WorkflowsPage.navGuard.test.tsx` and `WorkflowBuilderPage.session.test.tsx` ("← Workflows breadcrumb REFUSES to leave a DIRTY Builder") stay green unmodified.

### `appRouteParity.test.ts` (Plan 4)

**Analog (reuse verbatim, D-41):** `docs/__tests__/docsVercelRouting.test.ts:1-56` — `// @vitest-environment node`, `?raw` read (not `node:fs`, `:12-13`), unique-basename note (`:8-10`), and the evaluator:
```ts
import vercelRaw from "../../../vercel.json?raw"
const config = JSON.parse(vercelRaw) as VercelConfig
function sourceRegex(source: string): RegExp { return new RegExp("^" + source + "$") }
function hostMatches(rule: Rule, host: string): boolean {
  if (!rule.has) return true
  return rule.has.every((h) => h.type !== "host" || new RegExp("^(?:" + h.value + ")$").test(host))
}
function resolve(host: string, pathname: string): Outcome {
  for (const r of config.redirects ?? []) { if (sourceRegex(r.source).test(pathname) && hostMatches(r, host)) return { kind: "redirect", to: r.destination } }
  const filePath = pathname === "/" ? "/index.html" : pathname
  if (FILESYSTEM.has(filePath)) return { kind: "file", path: filePath }
  for (const r of config.rewrites ?? []) { if (sourceRegex(r.source).test(pathname) && hostMatches(r, host)) return { kind: "rewrite", to: r.destination } }
  return { kind: "404" }
}
const LANDING = "syrel.example"
const APP = "app.syrel.example"
```
Path depth from `src/__tests__/routing/` is the same `../../../` as from `src/docs/__tests__/` (both three levels under `frontend/`). Note `src/__tests__/routing/vercelRouting.test.ts` (Phase 228) uses `node:fs` — do NOT copy that read style.

**Dev layer:** `import { rewriteDevUrl } from "../../../devRouting"` (`devRouting.test.ts:8`); `frontend/devRouting.ts:14-31` returns `"/app.html" + search` for any dot-less non-root path.

**nginx layer:** `frontend/nginx.conf` `location` blocks at `:16-44` (`= /app`, `/app/`, `= /setup`, `= /invite`, `/admin/spend`, `/` → `/index.html`; `/api/` at `:52` has `proxy_pass`, skip). Evaluator = exact `=` first, else longest prefix; `try_files` last argument (RESEARCH §Routing Layers step 4).

**Inputs from the route table**, not a hand list (`formatAppRoute` over every `ActiveView`), plus legacy shapes and pre-auth paths; known-fact rows (bare `/workflows`: dev/app-host `app.html`, apex 404, one-box `index.html`); permanent negative controls over a synthetic config; one-time planted RED with `git diff --quiet -- frontend/nginx.conf` + `md5sum` restore proof (memory: `git checkout -- <dir>` is NOT a restore here, autocrlf).

### Tree-wide raw-History-write fence (D-33)

**Analog:** `ChatLayout.badge.test.tsx:295-340`:
```ts
const RAW = import.meta.glob("../../../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>
const HERE = "src/components/layout/__tests__"
const rel = (key: string): string => {
  const out = HERE.split("/")
  for (const seg of key.replace(/\\/g, "/").split("/")) {
    if (seg === "..") out.pop()
    else if (seg !== "." && seg !== "") out.push(seg)
  }
  return out.join("/").replace(/^src\//, "")
}
const isProductFile = (key: string) => { const p = rel(key); if (/\.test\.tsx?$/.test(p)) return false; if (p.includes("__tests__/")) return false; … return true }
```
("⚠ MEASURED: Vite normalises each key to the SHORTEST relative path … the key has to be RESOLVED against this file's own directory.") Exempt `docs/` (its own router, `docs/router.ts:52-55`) and the hook; count `history.replaceState(` / `history.pushState(` / `location.hash =` over **stripped** code; assert 0; include a non-vacuity control (glob found > N files; a planted fixture string is caught).

---

## Shared Patterns

### Fences are re-targeted, never loosened (D-02, CLAUDE.md, 187-24)
**Apply to:** all 17 inventory suites. Change the `?raw` import, add a second source for the new home, keep every count, add a "moved, not duplicated" zero-arm on the old file, write `D-297-NN` in the test. Prose in product files never spells a fenced literal (`<ChatArea`, `<WorkspacePanel`, the twelfth member, the location API) — see `App.tsx:99-103`, `:216-221`, `ChatLayout.tsx:1048-1051`.

### Corrections sit BESIDE the original
**Apply to:** `App.tsx:103` "NO ROUTER" prose (keep the `"the three-homes contract holds"` needle intact), `ChatLayout.tsx:880-884`/`:972-973`, `WorkflowsPage.tsx:791`, `WorkflowBuilderPage.tsx:1880-1881` (if touched — wiring A leaves it), `UnknownViewFallback.tsx:9`, IA skill `SKILL.md:88`. Source idiom `App.tsx:111-129`:
```
// ⚠ CORRECTED 2026-09-22 (Phase 262 / RESEARCH R-1) — THE PARAGRAPH ABOVE IS KEPT RATHER THAN
// OVERWRITTEN, BECAUSE THE CLAIM THAT ROTTED IS THE FINDING …
```

### Canvas-gated callbacks are `undefined`, never no-ops
**Source:** `ChatLayout.tsx:900-904` ("withholding it removes the affordance entirely"). **Apply to:** any new `openRun` prop passed from the hook through ChatLayout/AppViewSwitch.

### New ChatLayout / AppViewSwitch props are OPTIONAL
**Source:** `ChatLayout.tsx:130-133`. **Apply to:** `runId`, `addressNotFound`, `featuresLoading`, `operatorLoading`, `openRun` — four shipped suites mount `<ChatLayout {...baseProps}/>` and a required prop reds `tsc -p tsconfig.app.json` in files the plan does not own.

### Render-only client gates; server is the wall
**Source:** `App.tsx:87-96`, `ChatLayout.tsx:318-335` (STRICT `=== true`, null context = hidden). **Apply to:** D-19 holding state, D-35 operator not-found, `/app/runs/<id>` strict-UUID gate.

### Count-gate adoption (both knobs, same commit)
**Source:** `scripts/vitest-count-gate.cjs:4374-4376` (BASELINE, keyed by basename, with a dated comment) + `:6427-6430` (TARGETS file-level entry with "FILE-LEVEL (no `<dir>` directory entry), in the SAME commit as its BASELINE pin"):
```js
// 289-REVIEW WR-05 (2026-10-20) — created by the review fix, adopted in BOTH knobs in one commit.
"ChatLayout.runDeepLink.test.tsx": 2, // ?run= is cleared when a LIVE run page is left
...
// 289-REVIEW WR-05 — FILE-LEVEL (no `src/components/layout` directory entry), in the SAME
// commit as its BASELINE pin.
"src/components/layout/__tests__/ChatLayout.runDeepLink.test.tsx",
```
`src/__tests__/routing/vercelRouting.test.ts` is a FILE-LEVEL TARGETS entry (`:5865`); grep finds NO directory entry for `src/__tests__/routing`, `src/hooks` or `src/lib`, so every new suite in this phase needs its own file-level TARGETS line plus its BASELINE pin. Basenames `appRouteParity.test.ts`, `navigationKeepsStreams.test.tsx`, `appRoutes.test.ts`, `useAppNavigation.test.tsx`, `useAppNavigation.leaveGuard.test.tsx` are new (unique-basename precedent: `docsVercelRouting.test.ts:8-10`). Pin changes on moved suites (`runDeepLink.test.ts: 12`, `ChatLayout.runDeepLink.test.tsx: 2`, `activeViewReachability.test.ts: 11`) are raised, never lowered.

### Hot-file ledger rows (same commit)
**Source row:** `docs/HOT-FILE-LEDGER.md:11856` (young file: `1 / 1 / 159 | no (created 262-01) | …`); **section:** `:18348` ("— the `262-01` build detail", measured in its creating commit). **Apply to:** `AppViewSwitch.tsx`, `useAppNavigation.ts` (Plan 1), `appRoutes.ts` + not-found component if separate (Plan 2), `leaveGuard.tsx` (Plan 3). Disposition cell ≤ 200 chars; CLAUDE.md FIRING-table cell ≤ 80 chars. Run `node scripts/check-hot-file-ledger.cjs 297`.

---

## No Analog Found

| File / concern | Role | Data flow | Reason | Use instead |
|---|---|---|---|---|
| react-router wiring inside `useAppNavigation` (`useLocation`/`useNavigate`/`useBlocker`) and `main.tsx` `RouterProvider` | hook / entry | request-response over history | The repo has never had a router (SEED-185); the docs app's hand-rolled `docs/router.ts:52-55` writer is the anti-pattern D-33 forbids in the product tree | RESEARCH Patterns 3-4 + Code Examples (memory-router harness); pin `react-router@^8.5.0`; imports from `react-router` / `react-router/dom` only |

---

## Metadata

**Analog search scope:** `frontend/src/{App.tsx,main.tsx,docs,lib,hooks,providers,components/layout,components/workflows,components/settings,pages}`, `frontend/{devRouting.ts,vercel.json,nginx.conf,middleware.ts}`, `scripts/vitest-count-gate.cjs`, `docs/HOT-FILE-LEDGER.md`
**Files read:** 28 (plus targeted greps)
**Pattern extraction date:** 2026-10-27
