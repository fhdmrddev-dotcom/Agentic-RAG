# Phase 154: Plain-Language Layer (LANG-01) - Research

**Researched:** 2026-07-15
**Domain:** Frontend display-layer (React 19 context + a single-source term-map); UX information-architecture (two-audience plain⇄technical reveal)
**Confidence:** HIGH (all findings verified against live `frontend/src`; no external packages; no backend)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 … D-05 — research HOW, do not re-litigate)

- **D-01:** App-wide reveal state in a NEW React context (`TechnicalNamesProvider` +
  `useTechnicalNames()`), persisted to `localStorage`, **modeled on `useTheme.ts`**.
  **Default OFF (plain language).** A **"Show technical names"** toggle in **Settings**,
  available to **every user** — NO operator/VIS-01 gate (VIS-01 gates *features*, not *labels*).
  SC#3 is satisfied by any user being able to flip it.
- **D-01a:** Refactor `ControlRoomPage`'s local `showTechnical` `useState` to consume this
  ONE shared context. Leaf prop signatures (`HealthSignals`/`CapabilityGrid`/`AuditTab`/
  `ModelRegistryTab`/`FeatureVisibility`) keep working. One source of truth ⇒ no drift.
- **D-01b (rejected):** server-side `user_settings.preferences` persistence → deferred to
  SEED-117 (v3.4). localStorage is the in-scope weight.
- **D-02:** ONE glossary module `frontend/src/lib/termMap.ts` mapping each term →
  `{ plain, helper?, technical }`. A `usePlainLabel(key)` and/or `<PlainLabel term=…/>`
  consumer reads the D-01 context. Every relabeled surface routes through the term-map.
- **D-02a:** Term-map keys are DISPLAY concerns only — they NEVER replace the underlying
  enum value, API field name, or audit action string (see D-05).
- **D-03:** The global toggle is the PRIMARY app-wide mechanism. RETAIN the Phase-103 inline
  `ⓘ` + always-visible plain-helper in dense authoring forms (Builder / `PhaseFormPanel`);
  both mechanisms read the same term-map. Do NOT rip out ⓘ; do NOT force ⓘ onto every surface.
- **D-04:** Deliver the spine (D-01 context + D-02 term-map + Settings toggle + D-01a admin
  consolidation) PLUS relabeling a BOUNDED, prioritized set of highest-jargon END-USER
  surfaces: (1) chat/composer, (2) workflow user surfaces, (3) documents, (4) Settings.
- **D-04a:** Net-new admin surfaces (146–149) were built PLAIN-FIRST + already carry the ⌥
  toggle — NOT relabeled; only migrate to CONSUME the shared context. No admin re-copy.
- **D-04b:** Researcher produces the concrete term inventory + ranked surface list (this doc).
  Scope stays BOUNDED. Uncovered surfaces are a documented follow-up, not a failure.
- **D-05 (locked):** **Frontend display-only. NO backend, NO migration, NO SSE-copy change,
  NO enum/API/audit-action rename.** Term-map maps DISPLAY strings only. Deep Mode
  byte-identical by construction.
- **D-05a (verification):** grep-diff proves only DISPLAY strings + the new context/term-map/
  consumers changed; `git diff --name-only` shows ZERO backend files; `threads.py` /
  `agent_loop.py` / gateway / migrations untouched.

### Claude's Discretion
- Exact naming of context/hook (`useTechnicalNames` vs `useAdvancedMode`), the localStorage
  key, and the `<PlainLabel>` API — planner/executor choose, consistent with `useTheme` +
  the existing `TechnicalNamesToggle` vocabulary.
- Final term-map key set + ranked surface list within the D-04 boundary.

### Deferred Ideas (OUT OF SCOPE)
- Server-side persistence of the reveal preference (`user_settings.preferences`) → SEED-117 (v3.4).
- Exhaustive app-wide term coverage — this phase covers spine + worst offenders only.
- Nav / thread-list layout & crowding → Phase 156 (POLISH-01).
- Chat-banner honesty/timing (`setting-up-agent-hides-model-activity`) → 128-class work, not wording.
- Accessibility of the new toggle + relabeled surfaces → Phase 155 (A11Y-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LANG-01 | User-facing surfaces speak plain language with technical terms behind an admin/advanced reveal (two-audience layer extending the shipped Phase-124 two-door pattern app-wide); renames never break enum/API/audit contracts | Provider shape (§Context/Provider Shape) + single-source `termMap.ts` (§Term-Map Module) deliver the spine; the Term Inventory (§) supplies the raw material; the Contract-Safety Recipe (§) proves the "renames never break contracts" invariant (D-05); the ControlRoomPage consolidation (§) unifies the admin ⌥ toggle onto the same state (SC#1/SC#3). SC#2 (Deep byte-identical) holds by construction — zero backend files touched. |
</phase_requirements>

## Summary

This is a **frontend-only, no-new-dependency** phase. The entire deliverable is (1) a new React
**context provider** that holds one boolean ("show technical names"), persisted to localStorage;
(2) a single-source **term-map module** mapping technical strings → `{ plain, helper, technical }`;
(3) tiny consumers (`usePlainLabel` / `<PlainLabel>`); (4) consolidating the admin Control Room's
existing local `showTechnical` `useState` onto that context; and (5) relabeling a **bounded** set
of the highest-jargon end-user surfaces so they read plainly by default.

The critical implementation nuance the CONTEXT under-specifies: **`useTheme.ts` is a bare hook
with per-consumer `useState`** (verified — `frontend/src/hooks/useTheme.ts:12`, currently only ONE
consumer at `ChatLayout.tsx:91`). Copying its shape verbatim would give each of the many new
consumers its OWN independent state — the Settings toggle, the Control-Room toggle, and every
relabeled surface would not share one value, which is exactly the "two toggles disagree" G-6
failure. The correct pattern is a **React context Provider** (model the *persistence* on `useTheme`,
model the *provider structure* on the in-repo `frontend/src/lib/citationNav.tsx` — a shipped
`createContext` + throwing-hook + `localStorage`-adjacent pattern). This is the single most likely
mistake and the plan must call it out.

The good news for scope: the **worst remaining jargon is concentrated**. The workflow authoring
forms (Phase 103), the admin surfaces (146–149), the confidence chips (112), and the run-status
words (094/095) are ALREADY plain-first. The single highest-value target — a surface every uploader
sees that currently shows **raw** technical terms by default — is the document ingestion status
badge ("Chunking", "Embedding", "Extracting metadata"). That plus the composer, the document detail
"Metadata" header, and a slice of Settings labels is the bounded set.

**Primary recommendation:** Build the spine as a **context Provider** (NOT a bare hook) mounted in
`App.tsx` wrapping `<ChatLayout>` (covers chat, documents, workflows, settings, AND `/admin` — the
Control Room renders inside ChatLayout's view switch). Route every relabel through `termMap.ts`.
Consolidate `ControlRoomPage` by swapping its `useState` for the context while leaving **all leaf
prop signatures untouched** (zero-edit leaves). Prove D-05 with a `git diff --name-only` that shows
zero backend files.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reveal-state storage (plain⇄technical boolean) | Browser / Client (localStorage) | — | It is a per-device display preference; D-01b explicitly rejects server persistence for this phase. |
| Reveal-state sharing across surfaces | Frontend (React context) | — | Many consumers must share ONE value; a bare hook cannot. |
| Term glossary (plain ↔ technical ↔ helper) | Frontend (static module) | — | Pure display strings; D-02a bars any backend coupling. |
| Underlying enum / API field / audit action values | API / Backend | Database | Untouched by this phase (D-05). The term-map maps DISPLAY only; the wire/DB values keep flowing. |
| Ingestion status enum + granular step | API / Backend | Frontend renders plain | Backend emits `chunking`/`embedding`/…; frontend relabels the DISPLAY only. |
| Deep Mode / agent-loop behavior | API / Backend | — | Byte-identical by construction — zero backend edits. |

## Standard Stack

### Core (all already in-repo — NO new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | `createContext` + `useContext` + `useState` + `useEffect` for the provider | Already the app's UI runtime `[VERIFIED: package.json]` |
| Browser `localStorage` | native | Persist the boolean across reloads | Exactly the `useTheme` model D-01 mandates `[VERIFIED: useTheme.ts:7,22]` |
| Vitest | 4.1.0 | Unit-test the context + term-map + per-surface render | Project test runner `[VERIFIED: package.json, vitest.config.ts]` |
| @testing-library/react | (installed) | Render context + probe consumer in jsdom | Used throughout `frontend/src/**/__tests__` `[VERIFIED: setupTests.ts, existing tests]` |

### Supporting (in-repo patterns to reuse verbatim)
| Asset | Path | Purpose |
|-------|------|---------|
| `citationNav.tsx` | `frontend/src/lib/citationNav.tsx` | The in-repo **Provider** template: `createContext<T\|null>(null)` + throwing `useXxx()` hook + optional non-throwing accessor `[VERIFIED: citationNav.tsx:25-64]` |
| `useTheme.ts` | `frontend/src/hooks/useTheme.ts` | The localStorage-persist + `typeof window` guard model (D-01) `[VERIFIED: useTheme.ts:5-23]` |
| `TechnicalNamesToggle.tsx` | `frontend/src/components/admin/TechnicalNamesToggle.tsx` | The `⌥ Technical names` control — already prop-controlled (`enabled`+`onToggle`), reuse verbatim in Settings + Control Room `[VERIFIED: TechnicalNamesToggle.tsx:14-38]` |
| `FieldLabel`/`InfoHint` | `frontend/src/components/workflows/PhaseFormPanel.tsx:88-139` | The Phase-103 plain-label + always-visible helper + `ⓘ` raw-term primitive (D-03 retain/generalize) `[VERIFIED]` |
| `TechName` | `frontend/src/components/admin/ModelRegistryTab.tsx:216` | Inline `<code>` technical-name renderer — the shape `<PlainLabel>` generalizes `[VERIFIED]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React context Provider | Bare `useTheme`-style hook | REJECTED — per-consumer `useState` does not share state → two-toggle disagreement (G-6). D-01a requires ONE source of truth. |
| localStorage | `user_settings.preferences` (server) | REJECTED for this phase (D-01b) — adds schema/API surface fighting "display-only"; deferred to SEED-117. |
| New term-map module | Reuse scattered local maps (`PHASE_TYPE_FRIENDLY`, `friendlyToolName`, `PLATFORM_ACTION_META`) | Those STAY where they are (D-04a: no admin re-copy); `termMap.ts` is the single source for NEW relabels. Workflow-authoring maps MAY migrate opportunistically (D-03 "both read the same term-map"). |

**Installation:** None. No `npm install`. No `package.json` change.

## Package Legitimacy Audit

**Not applicable — this phase installs ZERO external packages.** The entire deliverable is built
from React (already installed), the browser `localStorage` API, and in-repo modules. The Package
Legitimacy Gate is not triggered (consistent with every 148–153 frontend-only plan, which all
recorded "Package Legitimacy Gate not triggered"). If the planner discovers a package need during
planning, re-run the Gate before adding it — but none is anticipated.

## Term Inventory (Deliverable #1)

Raw material for `termMap.ts`. Every row is a term ACTUALLY shown to a user, with `file:line`,
proposed plain label, and a one-line helper. **All proposed plain strings are `[ASSUMED]`** (Claude's
copy suggestions — the planner/UAT confirms exact wording). Every `file:line` is
`[VERIFIED: codebase grep]`. Grouped by surface, highest-jargon first.

> **Direction-of-change note:** For most surfaces the CURRENTLY-SHOWN string IS the technical term
> (these surfaces predate the two-audience contract). This phase flips the DEFAULT to plain, with
> the current string becoming the `technical` side revealed by the toggle. So `technical` in the
> table = today's shipped string; `plain` = the new default.

### Surface A — Document ingestion status badge  ⭐ TOP PRIORITY
`frontend/src/components/ingestion/DocumentStatusBadge.tsx` — every user who uploads a file sees
this; it currently shows **raw** technical step names by default.

| term key | file:line | technical (today) | proposed plain `[ASSUMED]` | helper `[ASSUMED]` |
|----------|-----------|-------------------|----------------------------|--------------------|
| `ingest.extracting` | `:17` | "Extracting" | "Reading the file" | Pulling the text out of your document. |
| `ingest.extracting_tables` | `:18` | "Extracting tables" | "Reading tables" | Pulling structured tables out. |
| `ingest.extracting_images` | `:19` | "Extracting images" | "Reading images" | Pulling images/figures out. |
| `ingest.chunking` | `:20` | "Chunking" | "Splitting into sections" | Breaking the text into searchable pieces. |
| `ingest.embedding` | `:21` | "Embedding" | "Making it searchable" | Building the search index for this document. |
| `ingest.metadata` | `:22` | "Extracting metadata" | "Reading document details" | Detecting title, author, dates, etc. |
| `status.pending` | `:4,:27` | "pending" | "Waiting" | Queued, not started yet. |
| `status.processing` | `:4` | "processing" | "Working…" | Being read and indexed now. |
| `status.completed` | `:4,:27` | "completed" | "Ready" | Indexed and searchable. |
| `status.failed` | `:4,:27` | "failed" | "Couldn't process" | Something went wrong reading this file. |

### Surface B — Document detail / metadata  (mostly plain from Phase 112 — light touch)
`frontend/src/components/metadata/DocumentDetailPanel.tsx`, `ConfidenceChip.tsx`

| term key | file:line | technical (today) | proposed plain `[ASSUMED]` | helper `[ASSUMED]` |
|----------|-----------|-------------------|----------------------------|--------------------|
| `doc.metadata_section` | `DocumentDetailPanel.tsx:230` | "Metadata" | "Details" | Facts about this document. |
| `chip.extracted` | `ConfidenceChip.tsx:88` | "Extracted" | (keep — already plain) | Filled in by the AI. |
| `chip.confidence` | `ConfidenceChip.tsx` (High/Med/Low) | "confidence" (concept) | (keep chip; helper only) | How sure the AI is about this value. |

*ConfidenceChip states ("Edited", "Extracted", "High/Med/Low · score") are already honest + plain
(Phase 112) — do NOT relabel the words; at most add a helper for the *concept* of confidence.*

### Surface C — Chat composer  (`frontend/src/components/chat/MessageInput.tsx`)
The in-chat Deep/Harness mode toggle was **removed** (Phase 094/095 — `ChatAreaMode.test.tsx:5-15`
confirms `workflow-mode-selector` is GONE). Remaining composer terms:

| term key | file:line | technical (today) | proposed plain `[ASSUMED]` | helper `[ASSUMED]` |
|----------|-----------|-------------------|----------------------------|--------------------|
| `agentmode.default` | `MessageInput.tsx:327,337` | "General" (enum `"default"`) | (keep "General") | Quick, direct answers. |
| `agentmode.explorer` | `MessageInput.tsx:327,345` | "Explorer" (enum `"explorer"`) | (keep "Explorer") | Digs deeper — searches + multiple steps. |
| model id display | `MessageInput.tsx:299,247` | raw model id (e.g. `gpt-4o`) | friendly model name (optional) | The AI model answering. |

*General/Explorer are already plain LABELS over the `"default"`/`"explorer"` enum — the technical
reveal here is the ENUM value, and mostly this surface needs HELPERS, not relabels.*

### Surface D — Settings  (`frontend/src/pages/SettingsPage.tsx`) — most technical-audience
D-04 says "provider/model/embedding jargon where a real user reads it." Bounded slice:

| term key | file:line | technical (today) | proposed plain `[ASSUMED]` | helper `[ASSUMED]` |
|----------|-----------|-------------------|----------------------------|--------------------|
| `settings.tab.retrieval` | `:855` | "Search & Retrieval" | "Search" | How the app searches your documents. |
| `settings.temperature` | (temperature field) | "temperature" | "Creativity" | Higher = more varied; lower = more focused. |
| `settings.context_window` | `:938` | "context window max tokens" | "How much it reads at once" | Max text the model considers per reply. |
| `settings.embedding` | `EMBEDDING_PRESETS` import `:17` | "embedding" | "search index" | The model that makes documents searchable. |
| `settings.reembed` | (re-embed flow) | "re-embed" | "rebuild the search index" | Re-index all docs with a new model. |

*Deep provider/model-config knobs (sub-agent max output tokens, OpenRouter tool strategy) are
legitimately technical-audience — leave them as-is and let the toggle reveal nothing extra, OR add
a helper only. Do not over-plain-ify config an everyday user never opens.*

### Surface E — Workflow authoring forms  (`PhaseFormPanel.tsx`) — ALREADY plain-first (D-03: KEEP ⓘ)
These are the REFERENCE pattern, not new relabels. The raw schema terms already reachable via `ⓘ`
(and are candidate `termMap.ts` KEYS to unify the D-03 "both read the same term-map"):

`prompt`→"Instructions"; `folder_scope`→"Folders it can read"; `available_tools`→"What this step
can do"; `citation_policy`→"Sourcing strictness"; `integrity_policy`→"File check"; `emitter`→
"Output type"; `skill_ref`→"Skill"; `max_steps`→"Max steps"; `temperature`→"Creativity";
`merge_strategy`→"How to combine results"; `wall_clock_seconds`→"Time limit"; `phase_type`→friendly
type (`PHASE_TYPE_FRIENDLY` map `:79-86`); tool ids (`friendlyToolName` map `:370-379`);
`citation_policy` captions (`CITATION_CAPTIONS` `:71-76`). `[VERIFIED: PhaseFormPanel.tsx]`

**Recommendation:** migrate `PHASE_TYPE_FRIENDLY`, `friendlyToolName`, and the raw-term `hint`
strings into `termMap.ts` so the Builder ⓘ and any future surface share one source (D-03). This is
OPTIONAL polish, not the spine — plan it as a low-priority wave if budget allows.

### Surface F — Admin Control Room (146–149)  — CONSUME ONLY (D-04a: no relabel)
`AuditTab.tsx` already carries a raw→plain map (`PLATFORM_ACTION_META` `:66-86`,
`OPERATOR_ACTION_LABELS` `:96-109`) and a `showTechnical`-gated `<code>` raw-term reveal. Per D-04a
these stay byte-identical — **do NOT re-copy into termMap**. The only change: the surface reads
`showTechnical` from the shared context (D-01a). The audit action keys (`document.upload`, etc.)
are **backend `audit_log.action_type` values — must NOT be renamed** (D-05 / Pitfall 15).

## Ranked Surface List (Deliverable #2)

Highest-jargon end-user first, with a clear cut line. "Relabel" = author plain default + technical
reveal via termMap. "Consume" = read the shared context, no copy change.

| Rank | Surface | File(s) | Action | Why |
|------|---------|---------|--------|-----|
| 1 | Ingestion status badge | `ingestion/DocumentStatusBadge.tsx` | **Relabel** | Every uploader sees it; currently shows RAW technical terms by default. Biggest win. |
| 2 | Document detail "Metadata" + confidence helper | `metadata/DocumentDetailPanel.tsx`, `ConfidenceChip.tsx` | **Relabel (light)** | High-traffic; "Metadata" header is jargon; confidence needs a helper. |
| 3 | Chat composer helpers | `chat/MessageInput.tsx` | **Relabel (helpers)** | Highest-traffic surface; mostly helpers (labels already plain). Watch G-5. |
| 4 | Settings user-facing labels | `pages/SettingsPage.tsx` | **Relabel (bounded)** | Real users read the Search/Memory tabs; deep config stays technical. |
| — | **CUT LINE — spine + ranks 1–4 = this phase's bar** | | | |
| 5 | Workflow authoring maps → termMap | `workflows/PhaseFormPanel.tsx` | **Consume/migrate (optional)** | Already plain (Phase 103); migrate local maps to single source if budget allows. |
| 6 | Admin Control Room | `admin/ControlRoomPage.tsx` + 5 leaves | **Consume (D-01a, required)** | Already plain-first; ONLY swap local state for shared context. Required for SC#1/SC#3, but zero copy change. |
| — | Deferred | every other low-traffic surface | none this phase | Inherits termMap cheaply later (D-04 documented follow-up). |

**Note:** Rank 6 (the D-01a consolidation) is REQUIRED even though it is "consume only" — it is the
spine's proof that the toggle went app-wide (G-6 failure #2). Ranks 1–4 are the relabel budget.

## Context / Provider Shape (Deliverable #3)

### The module (recommended: `frontend/src/providers/TechnicalNamesProvider.tsx`)

```tsx
// Model persistence on useTheme.ts; model provider structure on citationNav.tsx.
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

const STORAGE_KEY = "technical-names"          // [ASSUMED] key name — no collision with "theme"

function getInitial(): boolean {
  if (typeof window === "undefined") return false          // SSR/first-paint guard (useTheme:6)
  return window.localStorage.getItem(STORAGE_KEY) === "true"   // default OFF (D-01)
}

interface TechnicalNamesValue {
  showTechnical: boolean
  toggle: () => void
  setShowTechnical: (v: boolean) => void
}
const Ctx = createContext<TechnicalNamesValue | null>(null)

export function TechnicalNamesProvider({ children }: { children: ReactNode }) {
  const [showTechnical, setShowTechnical] = useState<boolean>(getInitial)
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, showTechnical ? "true" : "false")   // persist (useTheme:22)
  }, [showTechnical])
  const toggle = useCallback(() => setShowTechnical((v) => !v), [])
  return <Ctx.Provider value={{ showTechnical, toggle, setShowTechnical }}>{children}</Ctx.Provider>
}

export function useTechnicalNames(): TechnicalNamesValue {
  const v = useContext(Ctx)
  if (!v) throw new Error("useTechnicalNames must be used within TechnicalNamesProvider")  // citationNav idiom
  return v
}
```

### The term-map + consumer (`frontend/src/lib/termMap.ts` + `PlainLabel`)

```ts
export interface Term { plain: string; helper?: string; technical: string }
export const TERM_MAP = {
  "ingest.chunking":  { plain: "Splitting into sections", helper: "Breaking the text into searchable pieces.", technical: "Chunking" },
  "ingest.embedding": { plain: "Making it searchable",    helper: "Building the search index.",                technical: "Embedding" },
  // …one entry per Term Inventory row
} as const satisfies Record<string, Term>
export type TermKey = keyof typeof TERM_MAP
```
```tsx
// usePlainLabel(key) → the display string for the current reveal state.
export function usePlainLabel(key: TermKey): string {
  const { showTechnical } = useTechnicalNames()
  const t = TERM_MAP[key]
  return showTechnical ? t.technical : t.plain
}
// <PlainLabel term="ingest.chunking" /> → renders usePlainLabel + optional ⓘ helper (reuse InfoHint).
```

### Mount point (name the file + line)

**`frontend/src/App.tsx` — wrap `<ChatLayout>` at the existing provider seam (currently line
189–206, inside `CitationNavProvider`).** ControlRoomPage renders inside ChatLayout's view switch
(`ActiveView` includes `"control-room"`, `App.tsx:74`; `ChatLayout` receives `isOperator`/
`operatorIdentity`), so wrapping `<ChatLayout>` covers **chat, documents, workflows, settings, AND
`/admin`** in one mount. Recommended nesting (order not load-bearing — no cross-dependency):

```
<StreamsProvider>            // App.tsx:165 (existing)
  <TooltipProvider>          // :166 (existing — PlainLabel ⓘ helpers may use it)
    <TechnicalNamesProvider> // NEW — wrap here
      <CitationNavProvider>  // :189 (existing)
        <ChatLayout … />
```

### Hydration / guards — confirmed against `useTheme`
- **`typeof window === "undefined"` guard** in `getInitial` — matches `useTheme.ts:6`. jsdom
  provides `window`+`localStorage`, so tests work without a mock.
- **`window.matchMedia` NOT needed** — the default is a hard `false` (D-01), not a system-derived
  value, so unlike `useTheme` (which reads `prefers-color-scheme`) this provider needs no
  matchMedia. (Relevant: `setupTests.ts` does NOT mock matchMedia — avoid depending on it.)
- **No first-paint flash** — default OFF means the plain labels render immediately; the only state
  that survives reload is an explicit user opt-in to technical.

## ControlRoomPage Consolidation Plan (Deliverable #4)

Exact, minimal-diff edits to `frontend/src/components/admin/ControlRoomPage.tsx`. **All five leaf
prop signatures stay `showTechnical: boolean` — ZERO leaf edits.**

| Step | Line(s) today | Change |
|------|---------------|--------|
| 1 | `:218` `const [showTechnical, setShowTechnical] = useState(false)` | **Delete.** Replace with `const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()` (near the top of the component). |
| 2 | `:620` `onToggle={() => setShowTechnical((v) => !v)}` (pinned-vitals `TechnicalNamesToggle`) | → `onToggle={toggleTechnical}` |
| 3 | `:697` `onToggleTechnical={() => setShowTechnical((v) => !v)}` (AuditTab) | → `onToggleTechnical={toggleTechnical}` |
| 4 | `:706-707` (users-access `TechnicalNamesToggle`) | → `onToggle={toggleTechnical}` |
| 5 | `:740-741` (model-registry `TechnicalNamesToggle`) | → `onToggle={toggleTechnical}` |
| 6 | `:636,:655,:696,:722,:748` `showTechnical={showTechnical}` prop threads | **UNCHANGED** — `showTechnical` now comes from context but the variable name + all threads are identical. |

**Net effect:** the operator's behavior is unchanged (same toggle control, same reveal), but the
state is now the shared app-wide value — flipping it in Settings and flipping it in the Control Room
are the SAME switch (one source of truth, D-01a). The four `TechnicalNamesToggle` instances in the
Control Room all read/write the same context value automatically because they now render inside the
App-level `TechnicalNamesProvider`.

**Test impact:** the five leaf tests (`CapabilityGrid.test`, `ModelRegistryTab.test`, etc.) pass
`showTechnical` as a direct prop and are UNAFFECTED. Any test that renders the whole
`ControlRoomPage` must now wrap it in `<TechnicalNamesProvider>` (or the `useTechnicalNames` hook
throws). Grep for a `ControlRoomPage.test` before executing; if one exists, add the wrapper.

## Contract-Safety Verification Recipe (Deliverable #5)

The concrete checks proving D-05 / D-05a — run at the end of the phase. This is the cardinal
LANG-01 gate (Pitfall 15). All `[VERIFIED: recipe against repo layout]`.

```bash
# 1. ZERO backend files touched (the D-05a headline check).
git diff --name-only <phase-base>..HEAD | grep -E '^backend/'            # → must print NOTHING
git diff --name-only <phase-base>..HEAD | grep -E '^supabase/migrations/' # → must print NOTHING

# 2. The RED-LINE agent-loop / gateway / threads files are untouched (D-05a).
git diff --name-only <phase-base>..HEAD | grep -E \
  'agent_loop\.py|threads\.py|gateway|run_lifecycle\.py'                  # → NOTHING

# 3. Every changed file is under frontend/src (display-only).
git diff --name-only <phase-base>..HEAD | grep -vE '^frontend/src/|^\.planning/'  # → NOTHING

# 4. No enum / API-field / audit-action string was RENAMED. These tokens may appear
#    ONLY as term-map KEYS or on the `technical:` side of a Term — never renamed at a
#    call site that sends them to the API. Eyeball each hit against the diff:
git diff <phase-base>..HEAD -- frontend/src | grep -nE \
  'folder_scope|phase_type|citation_policy|available_tools|integrity_policy|merge_strategy|skill_ref|action_type|document\.upload|control_plane\.visit'

# 5. TS baseline: exactly 30 pre-existing SEED-056/049 errors, 0 NET-NEW.
cd frontend && npx tsc -b 2>&1 | grep -cE 'error TS'                      # → 30 (documented below)
cd frontend && npx vite build                                            # → exit 0
```

**G-5 hot-file handling (`MessageItem.tsx`, `StreamsProvider.tsx`):** the term inventory shows NO
top-jargon label that must live inside `MessageItem` internals or `StreamsProvider` — the composer
relabels (Surface C) live in `MessageInput.tsx`/`ChatArea.tsx` shells, not `MessageItem`. **Target
outcome: both G-5 hot files UNTOUCHED** (best case). If a relabel unavoidably lands in either, change
ONLY the display string additively (no render/stream-logic edit) and re-run `MessageItem.test.tsx` +
the StreamsProvider suites as non-regression (per CONTEXT G-5).

## Architecture Patterns

### System Architecture Diagram

```
                        localStorage["technical-names"]  (per-device, default OFF)
                                     │  read on init / write on change
                                     ▼
   App.tsx ──> TechnicalNamesProvider (React context: { showTechnical, toggle })
                                     │  one shared value
        ┌────────────────────────────┼───────────────────────────────┐
        ▼                            ▼                                 ▼
  Settings toggle            Relabeled surfaces               ControlRoomPage
  (TechnicalNamesToggle)     via usePlainLabel/<PlainLabel>   (D-01a: reads context,
   writes context               │                              threads showTechnical
                                ▼                              to 5 leaves — unchanged)
                        termMap.ts  { key → {plain, helper, technical} }
                                │  DISPLAY strings ONLY (D-02a)
                                ▼
                    plain (default)  ⇄  technical (toggle on)
                                │
                                ▼
   Underlying enum / API field / audit action values  ── UNTOUCHED (D-05) ──> backend/DB
```

A reader traces: user flips the Settings toggle → context boolean changes → every `usePlainLabel`
consumer re-renders with the technical string → the underlying enum/API values never move.

### Recommended Project Structure
```
frontend/src/
├── providers/
│   └── TechnicalNamesProvider.tsx   # NEW — context + hook (or lib/ if planner prefers)
├── lib/
│   └── termMap.ts                   # NEW — single-source glossary + usePlainLabel + <PlainLabel>
├── App.tsx                          # EDIT — mount provider around <ChatLayout>
├── pages/SettingsPage.tsx           # EDIT — add the "Show technical names" toggle row
├── components/admin/ControlRoomPage.tsx   # EDIT — swap useState → useTechnicalNames (D-01a)
├── components/ingestion/DocumentStatusBadge.tsx   # EDIT — route labels through termMap
├── components/metadata/DocumentDetailPanel.tsx    # EDIT — "Metadata" → PlainLabel
└── components/chat/MessageInput.tsx / SettingsPage.tsx  # EDIT — bounded relabels/helpers
```

### Pattern 1: Provider + throwing hook (in-repo template)
**What:** `createContext<T | null>(null)` + a `useXxx()` that throws outside the provider.
**When to use:** any app-wide shared UI state with many consumers.
**Example:** `frontend/src/lib/citationNav.tsx:25-100` (shipped Phase 153) — copy its shape.

### Pattern 2: Prop-controlled leaf, provider-owned state (already the admin idiom)
**What:** leaves take `showTechnical: boolean`; a parent owns the state.
**When to use:** the D-01a consolidation — the parent's state source changes (useState→context) but
the leaf contract does not.
**Example:** `ControlRoomPage.tsx:218` (owner) → `HealthSignals`/`CapabilityGrid`/… (leaves).

### Anti-Patterns to Avoid
- **Bare per-consumer hook** (copying `useTheme` verbatim): each consumer gets its own state → the
  Settings toggle and Control-Room toggle disagree. USE A CONTEXT PROVIDER.
- **Hardcoding a plain label at a call site** instead of routing through `termMap.ts`: guarantees
  drift (D-02). Every relabel goes through the map.
- **Renaming an enum/field to its plain form** (e.g. changing `"chunking"` the wire value): the
  cardinal Pitfall-15 contract break. Map DISPLAY only.
- **Forcing an ⓘ onto every surface** (D-03): simple surfaces use the toggle; only dense authoring
  forms keep the ⓘ.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared reveal state | A custom event bus / window global / duplicated `useState` | React `createContext` provider | The idiomatic + tested in-repo pattern (`citationNav.tsx`); one value, real-time flip. |
| The ⌥ toggle control | A new button | `TechnicalNamesToggle.tsx` (reuse verbatim) | Already prop-controlled + operator-approved styling. |
| Plain-label + helper + raw-term row | A new label component | `FieldLabel`/`InfoHint` (PhaseFormPanel) | Shipped Phase-103 primitive; D-03 says keep it. |
| localStorage read/write + SSR guard | Custom storage wrapper | `useTheme`'s `typeof window` + `getItem/setItem` shape | Proven, minimal. |
| Persistence across devices | A new settings table/API | (defer — SEED-117) | Out of scope (D-01b); localStorage suffices this phase. |

**Key insight:** Everything this phase needs already exists in-repo. The work is *composition +
copywriting*, not new infrastructure. The single new mechanism is one small context provider.

## Common Pitfalls (Deliverable #7)

### Pitfall 1: Contract break (Pitfall 15 — the cardinal LANG-01 failure)
**What goes wrong:** a relabel silently changes an underlying enum, API field, or audit-action
string, so a downstream API call, filter, or audit row breaks.
**Why it happens:** conflating the DISPLAY string with the wire value — e.g. renaming the
`"chunking"` status the backend emits, or the `"document.upload"` audit key, instead of just its
label.
**How to avoid:** term-map maps DISPLAY only (D-02a); the `technical:` field holds the real string
verbatim; run the Contract-Safety Recipe. Audit keys (`AuditTab.tsx:66-109`) are backend
`action_type` values — NEVER edit them.
**Warning signs:** any diff hunk that changes an enum literal at a call site that posts to the API,
or renames a key in `PLATFORM_ACTION_META`/`OPERATOR_ACTION_LABELS`.

### Pitfall 2: Per-hook state instead of a shared context (G-6 failure #2 + #4)
**What goes wrong:** the Settings toggle flips, but the Control Room (or a relabeled surface) does
not — two toggles disagree; or the reveal only affects one surface.
**Why it happens:** D-01 says "modeled on `useTheme`," and `useTheme` is a bare hook with local
`useState` (verified — one consumer today). Copied verbatim, each consumer holds independent state.
**How to avoid:** build a context PROVIDER (this doc's §Context/Provider Shape). Model the
*persistence* on `useTheme`; model the *sharing* on `citationNav`.
**Warning signs:** the provider file exports only a `useXxx()` hook with no `createContext`/`<Provider>`.

### Pitfall 3: Label drift (D-02)
**What goes wrong:** a surface hardcodes a plain label instead of routing through `termMap.ts`; later
surfaces re-introduce a different plain word for the same concept.
**How to avoid:** every relabel calls `usePlainLabel`/`<PlainLabel>`; add a test asserting the
surface renders the term-map value (not a literal).
**Warning signs:** a plain string literal in a component that is ALSO a term-map key.

### Pitfall 4: A "plain" label that is MORE confusing (G-6 failure #6)
**What goes wrong:** an over-clever plain word ("Vectorizing"→"Making magic") loses meaning, or
contradicts the ⓘ raw term.
**How to avoid:** prefer concrete verbs/outcomes ("Making it searchable", not "Semanticizing"); keep
the technical term reachable; these strings are `[ASSUMED]` — confirm at UAT. When unsure, keep the
current word + add a helper rather than invent.
**Warning signs:** a plain label a non-technical reader can't map back to what's happening.

### Pitfall 5: G-5 hot files (`MessageItem.tsx`, `StreamsProvider.tsx`)
**What goes wrong:** a composer relabel is placed inside MessageItem/StreamsProvider render/stream
logic, risking a regression on the two most-touched files.
**How to avoid:** relabel in composer/ChatArea SHELLS; keep MessageItem/StreamsProvider untouched
(target). If unavoidable, additive display-string-only + re-run their suites.

### Pitfall 6: localStorage first-paint flash / SSR
**What goes wrong:** reading storage after mount causes a plain→technical flicker, or `window` is
undefined.
**How to avoid:** initialize state from `getInitial()` with a `typeof window` guard (useTheme model);
default OFF means plain renders first with no flash. No matchMedia dependency.

## Code Examples

### Relabeling `DocumentStatusBadge` through the term-map (Surface A)
```tsx
// Source: pattern from frontend/src/components/metadata/… PlainLabel consumer.
// BEFORE (today): raw technical default.
function ingestionStepLabel(step) { if (step === "chunking") return "Chunking" /* … */ }
// AFTER: route the DISPLAY through the term-map; the backend still emits "chunking".
const label = usePlainLabel(`ingest.${step}` as TermKey)   // plain by default, "Chunking" when toggled
```

### The Settings toggle row (Surface D spine)
```tsx
// Source: reuse frontend/src/components/admin/TechnicalNamesToggle.tsx verbatim.
const { showTechnical, toggle } = useTechnicalNames()
<FieldRow label="Show technical names">
  <TechnicalNamesToggle enabled={showTechnical} onToggle={toggle} />
</FieldRow>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-surface friendly-label afterthought (Phase 103 local maps) | One app-wide two-audience contract + single-source term-map | Phase 154 (this) | Future surfaces inherit plain-by-default for free (SEED-085 generalization). |
| Admin `showTechnical` local `useState` (Phase 146) | Shared context, app-wide (D-01a) | Phase 154 | Operator toggle + user toggle become one switch. |
| In-chat Deep/Harness mode toggle | Removed; 2-pill composer (Model + General/Explorer) | Phase 094/095 | "Deep Mode"/"Harness" wording is largely gone from the composer — smaller relabel surface than the CONTEXT's illustrative list implies. |

**Deprecated/outdated (vs the CONTEXT's illustrative examples):**
- The CONTEXT lists "Deep Mode"/"Harness" as composer relabel candidates — **these were removed from
  the composer** (`ChatAreaMode.test.tsx:5-15`). Remaining trace: a code COMMENT in `ChatArea.tsx:161,177`
  ("Deep mode") — not user-visible. Do not budget composer relabel work for them.
- The CONTEXT lists `emit_tier`/`origin`/`kind` as document/run terms — `kind` appears only in code
  (`ControlRoomPage.tsx:550` `r.kind === "workflow"`), not as a user-visible label;
  `deriveTier`/tier is already plain (STRICT/MIDDLE/LOOSE with real-vocab descriptions,
  `deriveTier.ts:35-79`). These are NOT top relabel targets.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Proposed plain labels ("Splitting into sections", "Making it searchable", "Reading the file", etc.) | Term Inventory | LOW — copy is easily adjusted; UAT/planner confirms exact wording. Wrong plain word = Pitfall 4 (confusing), caught at UAT. |
| A2 | localStorage key `"technical-names"` | Provider Shape | LOW — any unique key works; just avoid colliding with `"theme"`. |
| A3 | Context/hook names (`TechnicalNamesProvider`/`useTechnicalNames`/`usePlainLabel`/`<PlainLabel>`) | Provider Shape | LOW — Claude's Discretion per CONTEXT; consistent with `TechnicalNamesToggle` vocabulary. |
| A4 | Settings tab that hosts the toggle (AI Model vs a general spot) | Ranked Surfaces | LOW — planner picks; the toggle is small and tab-agnostic. |
| A5 | Migrating `PhaseFormPanel` local maps into termMap is optional polish | Surface E | LOW — if skipped, D-03 "both read same map" is partially met (forms keep their own maps); documented follow-up. |
| A6 | Surfaces C's composer needs helpers, not relabels (labels already plain) | Term Inventory C | LOW — if the planner wants relabels, the termMap absorbs them; no contract risk. |

**All `file:line` references and the 30-error tsc baseline are VERIFIED, not assumed.**

## Open Questions

1. **Which Settings tab hosts the "Show technical names" toggle?**
   - What we know: SettingsPage has 5 tabs (AI Model / Search & Retrieval / Integrations / Memory /
     Audit Log, `SettingsPage.tsx:854-858`). The toggle is app-wide, not tab-specific.
   - What's unclear: best home — a new "Display"/"Preferences" spot, or appended to an existing tab.
   - Recommendation: planner picks; a small row near the top of "AI Model" or a lightweight new
     "Preferences" section. Not blocking.

2. **How far to plain-ify deep Settings config (sub-agent tokens, OpenRouter tool strategy)?**
   - What we know: these are legitimately technical-audience knobs a casual user never opens.
   - Recommendation: leave as-is or add a helper only; do NOT invent plain labels for expert config
     (avoids Pitfall 4). Keep the relabel budget on Surfaces A–C.

3. **Do the workflow-authoring local maps migrate to termMap this phase?**
   - Recommendation: OPTIONAL (rank 5, below the cut line). Ship the spine + ranks 1–4 first; migrate
     if budget remains. Document uncovered as follow-up (D-04b).

## Environment Availability

Skipped — this phase has **no external dependencies** (React + browser localStorage + Vitest, all
already installed; no CLI tools, services, or runtimes beyond the existing frontend toolchain).

## Validation Architecture

`.planning/config.json` `workflow.nyquist_validation` is treated as enabled (not explicitly false).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + jsdom + @testing-library/react (React 19.2.4) `[VERIFIED: package.json, vitest.config.ts]` |
| Config file | `frontend/vitest.config.ts` (setupFiles: `./src/setupTests.ts`; globals: true; jsdom) |
| Quick run command | `cd frontend && npx vitest run <path>` (single file) |
| Full suite command | `cd frontend && npm test` (= `vitest run`) |
| Build gate | `cd frontend && npx tsc -b` (baseline = exactly **30** SEED-056/049 errors — `[VERIFIED: ran tsc -b, 2026-07-15]`) + `npx vite build` (exit 0) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| LANG-01 | Provider default OFF | unit | `npx vitest run src/providers/__tests__/TechnicalNamesProvider.test.tsx` | ❌ Wave 0 |
| LANG-01 | Toggle flips shared value | unit | same file | ❌ Wave 0 |
| LANG-01 | Preference persists across remount (localStorage) | unit | same file | ❌ Wave 0 |
| LANG-01 | `useTechnicalNames` throws outside provider | unit | same file | ❌ Wave 0 |
| LANG-01 | termMap round-trip: `usePlainLabel` = plain when OFF, technical when ON | unit | `npx vitest run src/lib/__tests__/termMap.test.tsx` | ❌ Wave 0 |
| LANG-01 | Every term's `technical` === the real enum/field string (no rename) | unit | same file | ❌ Wave 0 |
| LANG-01 | DocumentStatusBadge renders plain default + technical under toggle | unit | `npx vitest run src/components/ingestion/__tests__/DocumentStatusBadge.test.tsx` | ❌ Wave 0 (extend existing `DocumentStatusBadge.test.tsx`) |
| LANG-01 (D-01a) | ControlRoomPage toggle reads/writes shared context | integration | wrap in provider; `npx vitest run` the ControlRoomPage test if present | ⚠️ check for existing `ControlRoomPage.test` |
| LANG-01 (D-05) | Zero backend files changed | manual/CI | Contract-Safety Recipe `git diff --name-only` | n/a (recipe) |

### Sampling Rate
- **Per task commit:** the touched surface's suite + the provider/termMap suites (`npx vitest run <file>`).
- **Per wave merge:** `npm test` (full frontend suite) + `npx tsc -b` (assert 30 baseline, 0 net-new).
- **Phase gate:** full suite green + `npx vite build` exit 0 + Contract-Safety Recipe clean, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/providers/__tests__/TechnicalNamesProvider.test.tsx` — default/flip/persist/throw (LANG-01)
- [ ] `src/lib/__tests__/termMap.test.tsx` — round-trip + technical===real-value (LANG-01, contract guard)
- [ ] Extend `src/__tests__/components/DocumentStatusBadge.test.tsx` — plain default + technical toggle
- [ ] If a `ControlRoomPage.test` exists: add `<TechnicalNamesProvider>` wrapper (else the hook throws)
- [ ] No framework install needed — Vitest already configured.

*Baseline rot note: `npx tsc -b` emits exactly 30 pre-existing SEED-056/049 errors (`StreamsProvider`
`viewedThreadId` typing, etc.) — documented across 153-01..05. Do NOT attribute these to this phase;
assert 0 NET-NEW only.*

## Security Domain

`security_enforcement` is enabled (absent = enabled), but this phase is a display-only relabel with
**no new attack surface**: no backend, no new endpoint, no auth/session/data-access change, no new
package, no user-supplied string reaching a sink.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change; the toggle is available to every user by design (D-01). |
| V3 Session Management | no | localStorage preference only; not a session token. |
| V4 Access Control | no | **Labels are not secrets** (D-01) — no gate. VIS-01 (feature access) is untouched; the term-map never reveals a feature, only a field NAME. |
| V5 Input Validation | minimal | term-map values are static literals rendered as React text nodes (auto-escaped); no user input, no `dangerouslySetInnerHTML`. |
| V6 Cryptography | no | No secrets, no crypto. |

### Known Threat Patterns for {React display layer}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Contract break leaking wrong value to API/audit (Pitfall 15) | Tampering | Term-map maps DISPLAY only (D-02a); Contract-Safety Recipe; `technical` field holds the verbatim real string. |
| A "technical name" reveal exposing a sensitive field name | Information Disclosure | N/A by design — technical field/enum names are not secret (D-01); no keys/secrets/PII in the term-map. |
| XSS via injected label | Tampering | Static literals only; React text-node escaping; no `dangerouslySetInnerHTML`. |

## Project Constraints (from CLAUDE.md)

- **Frontend stack:** React + Vite + Tailwind + shadcn/ui (Aether / Deep Midnight). This phase stays
  within it; no new libraries.
- **No LangChain / raw SDK / Pydantic / SSE / RLS rules:** N/A — this phase touches NO backend
  (D-05). Explicitly: no migration, no `app_settings`/`user_settings` write, no SSE-copy change.
- **G-2 (sketch-before-plan for UX):** CONTEXT resolved — NO new sketch (reuses 3 shipped
  operator-approved patterns: ⌥ toggle / ⓘ+helper / two-door). Re-raise ONLY if a genuinely new
  visual surface emerges.
- **G-5 (hot files):** `MessageItem.tsx` + `StreamsProvider.tsx` are hot — target: UNTOUCHED. If a
  relabel lands there, additive display-string-only + re-run their suites.
- **G-3 (lightweight):** N/A — multi-file phase (spine + several surfaces).
- **D-14 shared-path red line:** honored trivially — no backend/agent-loop path touched.
- **Reported-bugs cross-check:** CONTEXT swept 15 open `surface: Agentic-RAG` reports — none overlap
  the labeling domain; none folded. Planner: verify no `folded_into: 154` report exists (there is none).
- **Migrations:** none this phase (frontend-only). No cloud parity work generated.

## Sources

### Primary (HIGH confidence — verified in this session against live code)
- `frontend/src/hooks/useTheme.ts` — localStorage-persist + `typeof window` guard model (D-01).
- `frontend/src/lib/citationNav.tsx` — the in-repo `createContext` + throwing-hook provider template.
- `frontend/src/components/admin/ControlRoomPage.tsx:190-757` — the D-01a consolidation target (local
  `showTechnical` useState + 4 toggle instances + 5 leaf threads).
- `frontend/src/components/admin/TechnicalNamesToggle.tsx` — the reusable ⌥ control.
- `frontend/src/components/admin/AuditTab.tsx:66-114,443,532,686-726` — the "raw stored, plain
  displayed" reference + the audit-action keys that must NOT be renamed.
- `frontend/src/components/workflows/PhaseFormPanel.tsx:71-379` — the Phase-103 ⓘ+helper primitive +
  the local friendly maps (D-03).
- `frontend/src/components/ingestion/DocumentStatusBadge.tsx` — Surface A (top relabel target).
- `frontend/src/components/metadata/ConfidenceChip.tsx` + `DocumentDetailPanel.tsx` — Surface B.
- `frontend/src/components/chat/MessageInput.tsx:304-350` — composer General/Explorer (Surface C).
- `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx:5-53` — proof the Deep/Harness toggle
  was removed.
- `frontend/src/App.tsx:74,164-209` — the provider mount seam + ChatLayout view switch.
- `frontend/vitest.config.ts`, `frontend/src/setupTests.ts`, `frontend/package.json` — test harness.
- `.planning/REQUIREMENTS.md` (LANG-01 row + Out-of-Scope table); `.planning/seeds/SEED-085…`;
  `154-CONTEXT.md` (D-01…D-05).
- `npx tsc -b` run 2026-07-15 → 30 baseline errors (SEED-056/049).

### Secondary (MEDIUM)
- `.planning/STATE.md` 153-01..05 execution notes — the frontend-only convention, the "30 baseline
  tsc errors / 0 net-new" pattern, and the D-08/G-5 red-line discipline this phase mirrors.

### Tertiary (LOW)
- None — no WebSearch needed; the domain is fully in-repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external packages; all in-repo, verified.
- Architecture (provider shape, mount point, consolidation): HIGH — verified against `App.tsx`,
  `ControlRoomPage.tsx`, `citationNav.tsx`, `useTheme.ts`.
- Term inventory: HIGH for `file:line` + technical strings (grepped); the plain-label COPY is
  `[ASSUMED]` (A1) — confirm at UAT.
- Pitfalls: HIGH — the per-hook-vs-context trap and Pitfall-15 contract break are grounded in the
  actual `useTheme` shape + the audit-key coupling.

**Research date:** 2026-07-15
**Valid until:** ~2026-08-14 (stable — frontend-only, no fast-moving external deps). Re-verify only
if `App.tsx` provider seam or `ControlRoomPage` `showTechnical` wiring is refactored before planning.
