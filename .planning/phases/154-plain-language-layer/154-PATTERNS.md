# Phase 154: Plain-Language Layer (LANG-01) - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 11 (2 NEW spine + 2 NEW tests + 7 MODIFIED)
**Analogs found:** 11 / 11 (every file has an in-repo analog — zero external patterns needed)

> **Frontend-only phase.** All analogs live under `frontend/src`. The spine is one
> React context Provider + one const-map module + tiny consumers; the surfaces route
> DISPLAY strings through the map. NO backend, enum, API-field, or audit-action rename
> (D-05). Every excerpt below is verbatim from the current tree.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `frontend/src/providers/TechnicalNamesProvider.tsx` | provider (context + hook) | event-driven (one shared boolean broadcast to N consumers) | `frontend/src/lib/citationNav.tsx` (structure) + `frontend/src/hooks/useTheme.ts` (localStorage persist) | exact (structure) + role-match (persist) |
| NEW `frontend/src/lib/termMap.ts` | utility / config (single-source const-map + `usePlainLabel`/`<PlainLabel>`) | transform (term key → display string) | `AuditTab.tsx` `PLATFORM_ACTION_META` + `PhaseFormPanel.tsx` `PHASE_TYPE_FRIENDLY` | role-match |
| NEW `frontend/src/providers/__tests__/TechnicalNamesProvider.test.tsx` | test | request-response (renderHook + act) | `frontend/src/lib/__tests__/citationNav.test.tsx` | exact |
| NEW `frontend/src/lib/__tests__/termMap.test.tsx` | test | request-response | `frontend/src/lib/__tests__/citationNav.test.tsx` | role-match |
| MOD `frontend/src/App.tsx` | provider mount (root wiring) | event-driven | itself (`CitationNavProvider` seam, L189) | exact (self) |
| MOD `frontend/src/components/admin/ControlRoomPage.tsx` | container (state owner → leaf props) | event-driven (D-01a consolidation) | itself (L218 `useState` → context; L618–749 toggle threads) | exact (self) |
| MOD `frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx` | test | request-response | `citationNav.test.tsx` wrapper idiom (add `<TechnicalNamesProvider>` to `renderPage`) | role-match |
| MOD `frontend/src/components/ingestion/DocumentStatusBadge.tsx` ⭐ | component (leaf) | transform (status/step enum → plain label) | itself (`ingestionStepLabel` L16–24) + `AuditTab` reveal pattern | exact (self) |
| MOD `frontend/src/components/metadata/DocumentDetailPanel.tsx` | component (leaf) | transform (section header relabel) | `AuditTab.tsx` raw→plain + `PhaseFormPanel` `InfoHint` (helper) | role-match |
| MOD `frontend/src/components/chat/MessageInput.tsx` | component (composer, **G-5-adjacent**) | transform (helpers, labels already plain) | `PhaseFormPanel.tsx` `InfoHint`/`FieldLabel` | role-match |
| MOD `frontend/src/pages/SettingsPage.tsx` | page (toggle host + bounded relabels) | request-response | `TechnicalNamesToggle.tsx` (reuse verbatim) + `SettingsPage` `Tabs` (L852) | role-match |

---

## Pattern Assignments

### NEW `frontend/src/providers/TechnicalNamesProvider.tsx` (provider, event-driven)

**Analog for STRUCTURE:** `frontend/src/lib/citationNav.tsx` — the shipped Phase-153
`createContext<T | null>(null)` + throwing hook + optional non-throwing accessor.
**Analog for PERSISTENCE:** `frontend/src/hooks/useTheme.ts` — `typeof window` guard +
`getItem`/`setItem`.

> ⚠️ **THE #1 MISTAKE (from RESEARCH Pitfall 2 + Anti-Patterns):** `useTheme.ts` is a
> BARE hook with per-consumer `useState` — copying its shape verbatim gives each
> consumer its OWN state, so the Settings toggle and the Control-Room toggle would
> **disagree** (G-6 failure #2/#4). Copy `useTheme` ONLY for the localStorage
> read/write + `typeof window` guard. Copy `citationNav.tsx` for the Provider +
> `createContext` + throwing-hook SHARING. This file is NOT a hooks-folder bare hook.

**Provider structure — copy from `citationNav.tsx:64,81–125`:**
```tsx
// citationNav.tsx:64 — the nullable context
const CitationNavContext = createContext<CitationNavValue | null>(null)

// citationNav.tsx:81 — the Provider owns useState, memoizes the value
export function CitationNavProvider({ children, navigate, selectDocument }: CitationNavProviderProps) {
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)
  // ...
  const value = useMemo<CitationNavValue>(() => ({ openDocument, pendingDocumentId, consumePendingDocument }), [...])
  return <CitationNavContext.Provider value={value}>{children}</CitationNavContext.Provider>
}

// citationNav.tsx:119 — the throwing hook (copy this error idiom verbatim)
export function useCitationNav(): CitationNavValue {
  const ctx = useContext(CitationNavContext)
  if (ctx === null) {
    throw new Error("useCitationNav must be used within a CitationNavProvider")
  }
  return ctx
}
```

**localStorage persist — copy the guard + get/set from `useTheme.ts:5–23`:**
```ts
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark"          // SSR/first-paint guard → your getInitial()
  const saved = localStorage.getItem("theme") as Theme | null
  if (saved === "light" || saved === "dark") return saved
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"  // ← DROP matchMedia; default is a hard false (D-01)
}
// useTheme.ts:15 — persist on change
useEffect(() => { /* ... */ localStorage.setItem("theme", theme) }, [theme])
// useTheme.ts:25 — the toggle callback
const toggleTheme = useCallback(() => setThemeState((prev) => (prev === "dark" ? "light" : "dark")), [])
```

**Target shape (from RESEARCH §Context/Provider Shape — the executor's blueprint):**
`STORAGE_KEY = "technical-names"` (avoid colliding with `"theme"`); `getInitial()` returns
`window.localStorage.getItem(STORAGE_KEY) === "true"` (default OFF); value =
`{ showTechnical, toggle, setShowTechnical }`; **no `matchMedia`** (default is a hard
`false`, unlike `useTheme` which derives from `prefers-color-scheme` — `setupTests.ts`
does NOT mock matchMedia, so do not depend on it).

---

### NEW `frontend/src/lib/termMap.ts` (utility / config, transform)

**Analog A (the const-map shape):** `frontend/src/components/admin/AuditTab.tsx:64–86`
— `PLATFORM_ACTION_META` maps a raw backend code → `{ label, group }`. This is the
canonical in-repo "raw key → display object" const-map. `termMap.ts` generalizes it to
`{ plain, helper?, technical }`.

```ts
// AuditTab.tsx:64 — "the ONLY place the raw code → plain-language mapping lives" — YOUR model
const PLATFORM_ACTION_META: Record<string, { label: string; group: ActionGroup }> = {
  "document.upload": { label: "Uploaded a document", group: "Documents" },
  "document.delete": { label: "Deleted a document", group: "Documents" },
  // ...
}
// AuditTab.tsx:90 — the accessor falls back to the RAW code (honest — never invents)
function platformLabel(code: string): string {
  return PLATFORM_ACTION_META[code]?.label ?? code
}
```

**Analog B (friendly-label const-maps):** `frontend/src/components/workflows/PhaseFormPanel.tsx:70–86`
— `CITATION_CAPTIONS` + `PHASE_TYPE_FRIENDLY` are `Record<string, string>` display maps
(D-03 flags these as optional migration candidates into `termMap.ts`, rank 5).

**Target shape (RESEARCH §Term-Map Module — use `as const satisfies`):**
```ts
export interface Term { plain: string; helper?: string; technical: string }
export const TERM_MAP = {
  "ingest.chunking":  { plain: "Splitting into sections", helper: "Breaking the text into searchable pieces.", technical: "Chunking" },
  // ...one row per Term Inventory entry (RESEARCH Surfaces A–D)
} as const satisfies Record<string, Term>
export type TermKey = keyof typeof TERM_MAP
```

**The consumer (`usePlainLabel` reads the D-01 context):**
```tsx
export function usePlainLabel(key: TermKey): string {
  const { showTechnical } = useTechnicalNames()
  const t = TERM_MAP[key]
  return showTechnical ? t.technical : t.plain     // ← reveal-state branch
}
// <PlainLabel term="ingest.chunking" /> renders usePlainLabel + an optional ⓘ helper (reuse InfoHint below).
```

> **Contract guard (D-02a / Pitfall 15):** the `technical:` side MUST hold the real
> shipped string VERBATIM (e.g. `"Chunking"`, `"Metadata"`) — it is a DISPLAY string,
> never the wire enum. The keys (`ingest.chunking`) are display keys, NOT the backend's
> `"chunking"` status value. Nothing in this file is ever posted to an API.

---

### NEW test files (test, request-response)

**Analog:** `frontend/src/lib/__tests__/citationNav.test.tsx` — the shipped provider-test
template (Vitest + `@testing-library/react` `renderHook`/`act`, jsdom).

```tsx
// citationNav.test.tsx:25–38 — imports + the throwing-hook assertion
import { renderHook, act } from "@testing-library/react"
// citationNav.test.tsx:52 — "throws outside a provider" (silence the console.error)
it("throws a clear error when used outside a provider", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {})
  expect(() => renderHook(() => useCitationNav())).toThrow(/CitationNavProvider/i)
  spy.mockRestore()
})
// citationNav.test.tsx:60 — the wrapper idiom for "inside a provider"
const wrapper = ({ children }: { children: ReactNode }) => (
  <CitationNavProvider navigate={vi.fn()}>{children}</CitationNavProvider>
)
const { result } = renderHook(() => useCitationNav(), { wrapper })
```

**`TechnicalNamesProvider.test.tsx` must cover (RESEARCH Wave 0):** default OFF · toggle
flips the shared value · persists across remount (write to `localStorage`, re-render,
assert) · throws outside provider.
**`termMap.test.tsx` must cover:** `usePlainLabel` = plain when OFF / technical when ON ·
**every term's `technical` === the real shipped enum/field string** (the contract guard).

---

### MOD `frontend/src/App.tsx` (provider mount)

**Analog:** itself — the existing `CitationNavProvider` seam. Wrap `<ChatLayout>` so
chat, documents, workflows, settings, AND `/admin` (ControlRoomPage renders inside
ChatLayout's view switch) all read one context.

**Mount here — nest OUTSIDE `CitationNavProvider` at `App.tsx:189`:**
```tsx
// App.tsx:165–189 (current)
<StreamsProvider>
  <TooltipProvider>              {/* :166 — PlainLabel ⓘ helpers may use it */}
    {/* NEW: <TechnicalNamesProvider> wraps here */}
    <CitationNavProvider navigate={setActiveView}>   {/* :189 (existing) */}
      <ChatLayout ... />         {/* :190 */}
    </CitationNavProvider>
    {/* NEW: </TechnicalNamesProvider> */}
  </TooltipProvider>
</StreamsProvider>
```
(Nesting order is not load-bearing — no cross-dependency; put `TechnicalNamesProvider`
between `TooltipProvider` and `CitationNavProvider` per RESEARCH §Mount point.)

---

### MOD `frontend/src/components/admin/ControlRoomPage.tsx` (container, D-01a consolidation)

**Analog:** itself — minimal diff. This is a **state-source swap**, not a behavior
change. All 5 leaf prop signatures stay `showTechnical: boolean` (ZERO leaf edits).

**Step 1 — replace the local state at `ControlRoomPage.tsx:218`:**
```tsx
// BEFORE (L216–218):
// This shell owns the two-audience toggle state (LANG-01); it threads
// showTechnical down to HealthSignals + CapabilityGrid + the Audit tab.
const [showTechnical, setShowTechnical] = useState(false)
// AFTER:
const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()
```

**Step 2 — rewire the 4 `TechnicalNamesToggle` / AuditTab `onToggle` call sites** (the
inline `() => setShowTechnical((v) => !v)` closures → `toggleTechnical`):
- L618–621 pinned-vitals toggle: `onToggle={() => setShowTechnical((v) => !v)}` → `onToggle={toggleTechnical}`
- L696–697 AuditTab: `onToggleTechnical={() => setShowTechnical((v) => !v)}` → `onToggleTechnical={toggleTechnical}`
- L705–708 users-access toggle → `onToggle={toggleTechnical}`
- L739–742 model-registry toggle → `onToggle={toggleTechnical}`

**Step 3 — the `showTechnical={showTechnical}` prop threads at L636, L655, L696, L721,
L748 stay UNCHANGED** (same variable name, now sourced from context). The 5 leaves
(`HealthSignals`/`CapabilityGrid`/`AuditTab`/`FeatureVisibility`/`ModelRegistryTab`) are
untouched — this is the "prop-controlled leaf, provider-owned state" pattern where only
the owner's state SOURCE changes.

---

### MOD `frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx` (test — REQUIRED)

**Concrete break to fix:** the test's `renderPage()` helper (L92–94) renders
`<ControlRoomPage>` BARE:
```tsx
function renderPage() {
  return render(<ControlRoomPage identity={null} onBack={() => {}} />)
}
```
After D-01a, `ControlRoomPage` calls `useTechnicalNames()`, which THROWS outside a
provider — **every one of the ~8 tests that call `renderPage()` will fail** unless you
wrap it:
```tsx
function renderPage() {
  return render(
    <TechnicalNamesProvider>
      <ControlRoomPage identity={null} onBack={() => {}} />
    </TechnicalNamesProvider>,
  )
}
```
(This is the `citationNav.test.tsx:60` wrapper idiom applied at the render helper.)

---

### MOD `frontend/src/components/ingestion/DocumentStatusBadge.tsx` ⭐ TOP PRIORITY (Surface A)

**Analog:** itself — the `ingestionStepLabel` switch is the exact relabel site. Route its
output through `usePlainLabel` so the DISPLAY flips plain⇄technical; the backend keeps
emitting `"chunking"`/`"embedding"`.

**Current relabel site (`DocumentStatusBadge.tsx:16–27`):**
```tsx
function ingestionStepLabel(step: string | null | undefined): string {
  if (step === "extracting") return "Extracting"
  if (step === "chunking") return "Chunking"
  if (step === "embedding") return "Embedding"
  if (step === "metadata") return "Extracting metadata"
  return "processing"
}
// L27 — the enum status ("pending"/"completed"/"failed") is shown RAW today:
const label = status === "processing" ? ingestionStepLabel(ingestionStep) : status
```
**After (RESEARCH Code Examples):** map each `step`/`status` to a term key and read the
context — plain by default, today's string under the toggle:
```tsx
const label = usePlainLabel(`ingest.${step}` as TermKey)   // e.g. "Splitting into sections" / "Chunking"
```
Term keys + copy are in RESEARCH §Surface A (`ingest.chunking`, `ingest.embedding`,
`status.pending`, …). **The `status` string still drives `styles[status]` (L27,30) —
that keyed lookup uses the ENUM, not the label; keep it enum-keyed (do NOT swap the
style key to the plain label).**

**Existing test to extend:** `frontend/src/__tests__/components/DocumentStatusBadge.test.tsx`
— add "plain default + technical under toggle" (wrap render in `<TechnicalNamesProvider>`).

---

### MOD `frontend/src/components/metadata/DocumentDetailPanel.tsx` (Surface B, light touch)

**Analog A (the relabel):** `AuditTab.tsx` "raw stored, plain displayed". The section
header `title="Metadata"` at `DocumentDetailPanel.tsx:230` becomes a term-map value
(`doc.metadata_section` → "Details", technical "Metadata").
```tsx
// DocumentDetailPanel.tsx:229 (current)
<PanelSection title="Metadata" warn={lowPlusEmpty > 0} count={lowPlusEmpty} defaultOpen>
// After: title={usePlainLabel("doc.metadata_section")}  (or <PlainLabel/> if PanelSection accepts a node)
```
**Analog B (the confidence helper):** do NOT relabel `ConfidenceChip.tsx` words —
"Extracted"/"High/Med/Low" are already honest + plain (Phase 112, `ConfidenceChip.tsx:88`).
At most add a helper for the *concept* via the `InfoHint` primitive (below).

---

### MOD `frontend/src/components/chat/MessageInput.tsx` (Surface C — ⚠️ G-5-adjacent)

**Analog:** `PhaseFormPanel.tsx` `InfoHint` — add HELPERS (labels are already plain).
The composer's `General`/`Explorer` are plain labels over the `"default"`/`"explorer"`
enum (`MessageInput.tsx:327,337,345`); the enum is the technical side. This surface
mostly needs a helper on the mode dropdown, NOT relabels.
```tsx
// MessageInput.tsx:327 (current — KEEP these labels)
<span>{agentMode === "explorer" ? "Explorer" : "General"}</span>
// MessageInput.tsx:337 / :345 — the dropdown items "General" / "Explorer" (keep; helpers optional)
```
> **G-5 discipline (CLAUDE.md + RESEARCH Pitfall 5):** `MessageInput.tsx` is composer
> shell (acceptable), but `MessageItem.tsx` + `StreamsProvider.tsx` are hot files —
> **target: UNTOUCHED.** Any change here is additive display-string-only, no render/stream
> logic. Do NOT push relabels into `MessageItem` internals.

---

### MOD `frontend/src/pages/SettingsPage.tsx` (Surface D — toggle HOST + bounded relabels)

**Analog A (the toggle — reuse verbatim):** `frontend/src/components/admin/TechnicalNamesToggle.tsx`
is already prop-controlled (`enabled` + `onToggle`); wire it to the context:
```tsx
// TechnicalNamesToggle.tsx:22 — the whole control (reuse as-is)
export function TechnicalNamesToggle({ enabled, onToggle }: TechnicalNamesToggleProps) {
  return <button type="button" onClick={onToggle} aria-pressed={enabled} className={cn("... px-3 py-1 ...", enabled ? "..." : "...")}>
    <span aria-hidden="true">⌥</span> Technical names
  </button>
}
// The Settings host (RESEARCH §Settings toggle row):
const { showTechnical, toggle } = useTechnicalNames()
<TechnicalNamesToggle enabled={showTechnical} onToggle={toggle} />
```
**Analog B (where it lives):** the `Tabs`/`TabsTrigger` list at `SettingsPage.tsx:852–858`
(AI Model / Search & Retrieval / Integrations / Memory / Audit Log). Open Question #1:
planner picks the tab — a small row near the top of "AI Model" or a lightweight
"Preferences" section (not blocking; the toggle is tab-agnostic).
**Bounded relabels:** RESEARCH §Surface D (`settings.tab.retrieval` "Search & Retrieval"→"Search",
`settings.embedding`, `settings.temperature`→"Creativity"). Deep config knobs stay
technical-audience (add a helper only — do NOT invent plain labels for expert config,
Pitfall 4).

---

## Shared Patterns

### 1. Provider + throwing hook (the spine's sharing mechanism)
**Source:** `frontend/src/lib/citationNav.tsx:64,81–125` (shipped Phase 153).
**Apply to:** `TechnicalNamesProvider.tsx`. `createContext<T | null>(null)` + a
`useXxx()` that throws outside the provider. This is what makes ONE value shared across
Settings + Control Room + every relabeled surface (defeats the two-toggle-disagreement
G-6 failure). **Do NOT build a bare `useTheme`-style hook.**

### 2. localStorage persist + SSR guard
**Source:** `frontend/src/hooks/useTheme.ts:5–23`.
**Apply to:** `TechnicalNamesProvider.tsx` persistence only (`typeof window` guard +
`getItem`/`setItem`). Drop the `matchMedia` line — default is a hard `false` (D-01).

### 3. Prop-controlled leaf, provider-owned state
**Source:** `ControlRoomPage.tsx:218` (owner) → `HealthSignals`/`CapabilityGrid`/… leaves
take `showTechnical: boolean`.
**Apply to:** the D-01a consolidation. Only the OWNER's state source changes
(`useState` → context); the leaf contract is byte-identical.

### 4. Raw stored, plain displayed — the reveal render (D-05 reference)
**Source:** `frontend/src/components/admin/AuditTab.tsx:64–92` (the `PLATFORM_ACTION_META`
map + `platformLabel` fallback-to-raw) and the reveal render at `AuditTab.tsx:532,686,722`:
```tsx
// AuditTab.tsx:721–724 — plain label ALWAYS shown; raw code revealed ONLY under the toggle
<span className="text-foreground">{platformLabel(row.action_type)}</span>
{showTechnical && (
  <code className="... font-mono text-[10px] ...">{row.action_type}</code>   // ← raw NEVER renamed
)}
```
**Apply to:** every relabeled surface. The plain label is the default; the toggle reveals
the verbatim technical string. `<PlainLabel>` generalizes exactly this. The audit
`action_type` keys are backend values — **NEVER edit** (Pitfall 15).

### 5. ⓘ + always-visible helper primitive (D-03 — retain, generalize)
**Source:** `frontend/src/components/workflows/PhaseFormPanel.tsx:88–139` (`InfoHint` +
`FieldLabel`). Zero-dep native `title` + tabbable span for the ⓘ; a `help` line rendered
underneath (no hover needed).
```tsx
// PhaseFormPanel.tsx:91 — InfoHint (reuse for <PlainLabel>'s optional helper)
function InfoHint({ text }: { text: string }) {
  return <span tabIndex={0} role="img" aria-label={text} title={text} className="... rounded-full border ...">ⓘ</span>
}
```
**Apply to:** `<PlainLabel>`'s optional helper affordance and the Surface B/C helpers.
Keep it in the Builder forms; do NOT force an ⓘ onto simple surfaces (D-03).

### 6. Inline `<code>` technical-name renderer
**Source:** `frontend/src/components/admin/ModelRegistryTab.tsx:216`:
```tsx
function TechName({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[9px] text-muted-foreground/70">{children}</span>
}
```
**Apply to:** the styling of the technical string when `<PlainLabel>` renders in
"technical" mode (mono, muted) — consistent with the admin surfaces users may also see.

---

## No Analog Found

None. Every file has a strong in-repo analog. The single genuinely-new mechanism —
the `TechnicalNamesProvider` — is a direct composition of two shipped patterns
(`citationNav.tsx` structure + `useTheme.ts` persistence). No RESEARCH-only fallback
patterns are needed; no external packages (Package Legitimacy Gate not triggered).

---

## Contract-Safety Reminder (D-05 — the cardinal LANG-01 gate, from RESEARCH)

The planner/executor must run at phase end (RESEARCH §Contract-Safety Recipe):
- `git diff --name-only <base>..HEAD | grep -E '^backend/'` → **NOTHING**
- `... | grep -E '^supabase/migrations/'` → **NOTHING**
- `... | grep -vE '^frontend/src/|^\.planning/'` → **NOTHING** (all changes display-only)
- Eyeball every hit of `folder_scope|phase_type|citation_policy|action_type|document\.upload|…`
  — these tokens may appear ONLY as term-map KEYS or on the `technical:` side, never
  renamed at an API call site.
- `cd frontend && npx tsc -b` → **exactly 30** pre-existing SEED-056/049 errors, 0 net-new;
  `npx vite build` → exit 0.

---

## Metadata

**Analog search scope:** `frontend/src/{lib,hooks,providers,pages,components/{admin,ingestion,metadata,chat,workflows}}` + `frontend/src/**/__tests__`.
**Files scanned/read:** 13 (citationNav.tsx, useTheme.ts, TechnicalNamesToggle.tsx, DocumentStatusBadge.tsx, App.tsx, ControlRoomPage.tsx ×2 ranges, PhaseFormPanel.tsx, AuditTab.tsx ×2 ranges, ModelRegistryTab.tsx, DocumentDetailPanel.tsx, ConfidenceChip.tsx, MessageInput.tsx, SettingsPage.tsx, citationNav.test.tsx, ControlRoomPage.test.tsx) + 2 Glob sweeps.
**Pattern extraction date:** 2026-07-15
