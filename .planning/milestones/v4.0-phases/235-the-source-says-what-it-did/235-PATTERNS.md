# Phase 235: The Source Says What It Did — Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 24 (11 create · 13 modify)
**Analogs found:** 21 / 24 (18 exact-or-near · 3 role-match · 3 with NO analog)

> Every excerpt below was READ in this session and carries a `path:line` anchor.
> Where `235-RESEARCH.md` and `235-CONTEXT.md` disagree, **RESEARCH wins** and the conflict is
> named inline. Three claims in the orchestrator's own assignment were measured FALSE and are
> corrected in §"Corrections to the assignment".

---

## File Classification

### Backend

| New/Modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `supabase/migrations/172_connector_sync_runs.sql` | migration | schema DDL | `supabase/migrations/168_connector_watches.sql` | **exact** |
| `backend/app/services/sources/failure_cause.py` | service data leaf | transform | `backend/app/services/sources/preview_service.py:48-79,153` (`Literal` + module tables + one classify fn) | partial |
| `backend/app/db/watches.py` (M) | DAL / model | CRUD + batch | **itself** — `release_watch:249-273`, `claim_due_watches:193-246` | exact (self) |
| `backend/app/services/watch_service.py` (M) | service | event-driven / batch | **itself** — the four `release_watch` sites | exact (self) |
| `backend/app/api/sources.py` (M) | controller | request-response | **itself** — `trigger_watch_sync:261-295`, `_enrich_watch_rows:55-88` | exact (self) |
| `backend/app/config.py` (M) | config | — | `config.py:1200-1207` (the three `watch_*` siblings) | exact |
| `backend/tests/unit/services/test_watch_sync_runs.py` | test | — | `backend/tests/unit/db/test_watches_db.py` + `tests/unit/services/test_watch_service.py` | exact |
| `backend/tests/unit/services/test_source_health_verdict.py` | test | — | same | exact |
| `backend/tests/unit/api/test_sources_sync_honesty.py` | test | — | `backend/tests/unit/api/test_sources_watches_api.py` | **exact** |
| `backend/tests/unit/api/test_sources_degraded_row.py` | test | — | same | exact |

### Frontend

| New/Modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | utility (vocabulary leaf) | pure transform | `frontend/src/components/library/ingestionErrorVocabulary.ts` | **exact** |
| `…/sources/sourceHealthVocabulary.test.ts` | test | — | `frontend/src/components/library/__tests__/ingestionFailureCopy.test.ts` | **exact** |
| `…/sources/sourceComposition.test.tsx` | test (composition fence) | — | `frontend/src/components/library/__tests__/sketchComposition.test.tsx` | **exact** |
| `…/sources/__generated__/sourceComposition.json` | generated fixture | — | `frontend/src/components/library/__generated__/sketchComposition.json` | **exact** |
| `.planning/sketches/233-…/drive.cjs` (M — `--emit-json`) | script | file-I/O | the same file's `--emit` arm `:335-449` + `region()` `:74-80` | exact (self) |
| `…/layout/__tests__/NavPanel.badge.test.tsx` | test | — | `frontend/src/components/layout/__tests__/NavPanel.test.tsx` | **exact** |
| `…/sources/WatchedFoldersSection.tsx` (M) | component | request-response | **itself** | exact (self) |
| run-history component(s) under `…/sources/` | component | rendering | ⚠ **no analog** (see §"No Analog Found") | none |
| `…/library/SourcesAttentionSection.tsx` | component | request-response | `…/library/HealthTab.tsx:70-110` (self-fetch + `.catch(()=>null)` + `animate-pulse`) | role-match |
| `…/layout/NavPanel.tsx` (M — badge slot) | component | presentational | `RailItem` `NavPanel.tsx:61-98` | exact (self) |
| `frontend/src/App.tsx` (M — `libraryTab`) | provider / state root | event-driven | `App.tsx:146-157` `studioSkillId`/`studioTab` | **exact ⭐** |
| `…/layout/ChatLayout.tsx` (M — thread prop) | layout | — | `ChatLayout.tsx:95-99,103,817-822` | **exact ⭐** |
| `frontend/src/pages/LibraryPage.tsx` (M — `initialTab`) | page | — | `LibraryPage.tsx:127-137` `pageReducer` boundary composition | **exact ⭐** |
| `…/library/IngestionTab.tsx` (M — instance statement) | component | — | `IngestionTab.tsx:224-230` (static sibling mounts) | exact (self) |
| `…/library/HealthTab.tsx` (M — attention section) | component | — | `HealthTab.tsx:12,22-26,103` | exact (self) |
| `frontend/src/lib/api/sources.ts` (M) | api client | request-response | **itself** — `listWatches:80-87` | exact (self) |
| `scripts/vitest-count-gate.cjs` (M) | config / gate | — | its own Phase-233/234 blocks | exact (self) |

---

## ⭐ Pattern Assignment 1 — `App.tsx` → `ChatLayout.tsx` → `LibraryPage.tsx`: the `initialTab` threading

**This is the single most important pattern in the phase.** RESEARCH §14.2 measured that an
external caller **cannot** open the Library Health tab today. The precedent to copy is
`studioSkillId` / `studioTab`, and it has four parts.

### Part A — App holds the state + the navigator (`App.tsx:146-157`)

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
```

⭐ **The shape to copy verbatim:** one `useState` beside `activeView`, and **ONE navigator that
sets both the payload and the view in the same function**. The badge popover's action is
`handleOpenLibraryHealth()` → `setLibraryTab("health"); setActiveView("documents")`.

⚠ `activeView` for the Library is **`"documents"`**, not `"library"` (`ChatLayout.tsx:762`). The
`ActiveView` union at `App.tsx:102` has 11 members and **must not gain a twelfth** — the comment
at `App.tsx:91-101` records that the union member alone is not reachability and that the acceptance
fence counts occurrences of the literal in that file.

### Part B — App passes them down (`App.tsx:301-316`)

```tsx
            <ChatLayout
              onSignOut={signOut}
              activeView={activeView}
              onNavigate={setActiveView}
              navItems={navItems}
              …
              studioSkillId={studioSkillId}
              studioTab={studioTab}
              onOpenStudio={handleOpenStudio}
              onReviewEvals={handleReviewEvals}
              onStudioTabChange={handleStudioTabChange}
              onTuneSkill={handleTuneSkill}
            />
```

### Part C — ChatLayout declares them and forwards, nothing more (`ChatLayout.tsx:95-100`, `:103`, `:817-822`)

```tsx
  studioSkillId: string | null
  studioTab: StudioTab
  onOpenStudio: (skillId: string, tab?: StudioTab) => void
  onReviewEvals: (skillId: string) => void
  onStudioTabChange: (tab: StudioTab) => void
  onTuneSkill: (skillId: string) => void
}

export function ChatLayout({ onSignOut, activeView, onNavigate, navItems, isOperator, operatorIdentity, prefillMessage, onSetPrefillMessage, studioSkillId, studioTab, onOpenStudio, onReviewEvals, onStudioTabChange, onTuneSkill }: Props) {
```

```tsx
            <SkillStudioPage
              skillId={studioSkillId}
              tab={studioTab}
              onTabChange={onStudioTabChange}
              onBack={() => onNavigate("skills")}
            />
```

**The site to edit is `ChatLayout.tsx:762-763`, which today reads:**

```tsx
          {activeView === "documents" ? (
            <LibraryPage onNavigate={onNavigate} />
```

⚠ `ChatLayout`'s props are a **flat destructured parameter list on ONE line (`:103`)** — adding a
prop means editing the interface AND that line. The type import idiom is
`import { SkillStudioPage, type StudioTab } from "@/pages/SkillStudioPage"` (`ChatLayout.tsx:15`);
`LibraryTab` is already exported from `@/pages/librarySelection`.

### Part D — the page composes its initial state at the boundary, and adds NO seventh action

`LibraryPage.tsx:169` today:

```tsx
export function LibraryPage({ onNavigate }: { onNavigate?: (view: ActiveView) => void } = {}) {
```

`LibraryPage.tsx:177-178`:

```tsx
  const [lib, dispatch] = useReducer(pageReducer, initialLibraryState)
  const tab = lib.selection.tab
```

⭐ **The precedent for composing at the boundary rather than editing the leaf is already in this
file** — `pageReducer` (`LibraryPage.tsx:127-137`) and its docblock (`:120-126`):

```tsx
// ⚠ WHY THE WRAPPER EXISTS, MEASURED RATHER THAN ASSUMED: `LibraryState.folderSheetOpen` is
// declared by the leaf and CLEARED by `SELECT_FOLDER` / `SELECT_VIEW`, but **no action in
// `LibraryAction` sets it to `true`** … The opener is composed HERE, at the page boundary,
// rather than by editing the leaf — whose 25-case suite asserts the action set is exactly
// six. The state stays ONE object; nothing about the selection is decided outside the leaf.
type LibState = LibraryState<ViewFilter, SavedView>
type PageAction =
  | LibraryAction<ViewFilter, SavedView>
  | { type: "SET_FOLDER_SHEET"; open: boolean }

function pageReducer(state: LibState, action: PageAction): LibState {
  if (action.type === "SET_FOLDER_SHEET") {
    return { ...state, folderSheetOpen: action.open }
  }
  return libraryReducer<ViewFilter, SavedView>(state, action)
}
```

**The leaf's six actions (`librarySelection.ts:159-168`) — do not add a seventh:**

```ts
export type LibraryAction<F …, V …> =
  | { type: "SELECT_FOLDER"; folderId: string | null }
  | { type: "SELECT_VIEW"; view: V }
  | { type: "EDIT_VIEW"; view: V }
  | { type: "CHANGE_FILTER"; filter: F }
  | { type: "DELETE_VIEW"; viewId: string }
  | { type: "SELECT_TAB"; tab: LibraryTab }
```

**The suite that pins them** — `frontend/src/pages/__tests__/librarySelection.test.ts:9-13` (the
docblock states the contract) and `:75-85` (the enumeration):

```ts
 * ── ⚠ THE ENUMERATION CARRIES A NON-VACUITY CONTROL ──────────────────────────────────
 * The mutual-exclusion invariant is asserted as a PROPERTY over every reachable state, and
 * a loop over an empty set satisfies every property for free. The reachable set is
 * therefore asserted non-empty AND larger than one BEFORE any claim rests on it, and the
 * action list is asserted to cover all six action types.
```

```ts
const TABS: readonly LibraryTab[] = ["documents", "views", "ingestion", "indexing"]

/** Every action the reducer accepts, at more than one payload each where payload matters. */
const ACTIONS: readonly Action[] = [
  { type: "SELECT_FOLDER", folderId: "f9" },
  …
  ...TABS.map((tab): Action => ({ type: "SELECT_TAB", tab })),
]
```

⚠ **Measured and worth naming:** `TABS` in that suite is **four members**, not five — `"health"`
is absent, even though `LibraryTab` (`librarySelection.ts:94`) is a five-member union and
`selectionForTab` (`:285-296`) has a `health` arm. Adding `"health"` to `TABS` is a *free* coverage
win for this phase and costs one line.

**The initial-state composition (RESEARCH §14.2's recommended edit, unchanged):**

```tsx
export function LibraryPage({ onNavigate, initialTab }: {
  onNavigate?: (view: ActiveView) => void
  initialTab?: LibraryTab                         // ← net-new
} = {}) {
  const [lib, dispatch] = useReducer(pageReducer,
    initialTab ? { ...initialLibraryState, selection: { tab: initialTab, folderId: null } }
               : initialLibraryState)
```

⚠ `initialLibraryState` is typed `LibraryState<never, never>` (`librarySelection.ts:143`) — a
spread that replaces `selection` keeps that assignability; check the type at the call site rather
than casting.

⚠ `TAB_LABELS` (`LibraryPage.tsx:99-105`) is the single source for the tab strip and `LIBRARY_TABS`
(`:110-112`) is **derived from it, never re-typed**. Nothing new is needed there for Health — it is
already the fifth member.

**The dispatch sites that already exist** (`LibraryPage.tsx:705`, `:708`, `:719`, `:735`):

```tsx
            onSelectTab={(next) => dispatch({ type: "SELECT_TAB", tab: next as LibraryTab })}
            …
            onOpenQueue={() => dispatch({ type: "SELECT_TAB", tab: "ingestion" })}
```

⭐ `onOpenQueue` (`:708`) is the **in-page deep-link precedent** the Health→Ingestion "Go to source"
hop should copy; `ReembedSearchPointer`'s handler (`:717-726`) adds the scroll-into-view half:

```tsx
            onViewProgress={() => {
              dispatch({ type: "SELECT_TAB", tab: "indexing" })
              setTimeout(() => {
                document
                  .getElementById("reembed-status-card")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }, 100)
            }}
```

---

## ⭐ Pattern Assignment 2 — `sourceHealthVocabulary.ts` (utility, pure transform)

**Analog:** `frontend/src/components/library/ingestionErrorVocabulary.ts` (206 L, read in full).

### The five binding rules + the two structural ones (`ingestionErrorVocabulary.ts:13-50`)

```ts
 * ── THE FIVE BINDING RULES (Shared Pattern E — `publishRefusalVocabulary.ts`'s precedent) ──
 *
 *   1. A sentence is PRESENTATION, never a rule. Nothing branches on the text below.
 *   2. NO SEVERITY WORD. The row is already under a heading that says something is wrong;
 *      spending a second word on alarm buys nothing and costs trust.
 *   3. NO EXCLAMATION.
 *   4. NO MECHANISM. It names what is TRUE OF THE FILE and what to DO — never what the code
 *      experienced. …
 *   5. The dash is an EM DASH (U+2014), asserted by codepoint over the whole table.
 *
 * ── ⚠ THE DEFAULT ARM NEVER INVENTS A CAUSE (T-217.1-07b) ─────────────────────────────
 * An unrecognised DRIVER-SHAPED message resolves to the shipped honest fallback —
 * `"It stopped, and no reason was recorded."` — word for word as it shipped. …
 * ── ⛔ ZERO IMPORTS ───────────────────────────────────────────────────────────────────
 * A strict leaf: a fence can read it, and a cycle through it is impossible by construction.
```

### The exported surface to mirror (`:67-90`, `:99-128`, `:137-143`, `:149-206`)

```ts
export type IngestionFailureKind = "nul_in_text" | "duplicate" | "not_a_zip" | "unknown"

/** The shipped fallback, WORD FOR WORD as `IngestionTab` shipped it. Do not reword. */
export const UNKNOWN_FAILURE_SENTENCE = "It stopped, and no reason was recorded."

/**
 * ⭐ The table. `kind → sentence`, and the ORDER of `MATCHERS` below is the resolution order.
 * Keyed by the union so a new kind cannot be added without a sentence.
 */
export const SENTENCE_FOR_KIND: Record<IngestionFailureKind, string> = { … }
```

```ts
const MATCHERS: ReadonlyArray<{ kind: Exclude<IngestionFailureKind, "unknown">; test: RegExp }> = [
  { kind: "nul_in_text", test: /22P05|\\u0000|\\x00|unsupported Unicode escape/i },
  …
]

const MACHINE_TELLS: readonly RegExp[] = [
  /[{}]/, //                                    a dict / JSON repr
  /['"](?:message|code|hint|details)['"]\s*:/i, // ... its keys, even without braces
  /\b\d{2}[A-Z0-9]{3}\b/, //                    a SQLSTATE (22P05, 23505, 42501, ...)
  /\b\w*(?:Error|Exception)\b/, //              a Python / JS exception class
  /Traceback|File "|site-packages|\.py\b/i, //  a stack or a source path
  /psycopg|postgrest|asyncpg|supabase|httpx/i, // a driver / client package
  …
]
```

**`looksHumanWritten` — positive proof, deny by default (`:130-143`):**

```ts
/**
 * ⚠ The question is asked in the positive on purpose. "Does it look machine-y?" fails open — a
 * driver message with no tell would be shown verbatim. This asks for proof and refuses without
 * it, so the worst case of an unrecognised message is the honest fallback, never a leak.
 */
export function looksHumanWritten(message: string): boolean {
  const trimmed = message.trim()
  if (trimmed.length < 10 || trimmed.length > 300) return false
  if (!/[.?]$/.test(trimmed)) return false
  return !MACHINE_TELLS.some((tell) => tell.test(trimmed))
}
```

**The ONE entry point and its resolution order (`:158-206`):**

```ts
/**
 * ⭐ THE ONE ENTRY POINT. A raw `error_message` in; ONE sentence a person can read out.
 *
 * Resolution order, and it matters:
 *   1. a RECOGNISED failure    → its own sentence (a driver-shaped string never survives here)
 *   2. provably human prose    → itself, unchanged (the backend's own authored sentences)
 *   3. anything else           → the shipped honest fallback, never a guess
 */
export function classifyIngestionError(errorMessage: string | null | undefined, filename?: string | null): string {
  const kind = classifyIngestionFailure(errorMessage)
  if (kind === "not_a_zip") return notAZipSentence(filename)
  if (kind !== "unknown") return SENTENCE_FOR_KIND[kind]
  const raw = (errorMessage ?? "").trim()
  if (raw && looksHumanWritten(raw)) return raw
  return UNKNOWN_FAILURE_SENTENCE
}
```

⭐ **`notAZipSentence(filename)` (`:176-192`) is the precedent for a SENTENCE THAT IS A FUNCTION OF
A RUNTIME VALUE.** That is exactly the shape RESEARCH C-11 requires for
`cause.token_revoked.says` / `.action`, which in the sketch bake in the fixture's connection name
("Legal SharePoint"). Copy this arm's structure, including its final rule:

```ts
  // No extension, or one we have no advice for: fall back rather than guess. A wrong instruction
  // is worse than a general one.
  if (!named) return SENTENCE_FOR_KIND.not_a_zip
```

### The contract this leaf must carry (from BUILD-CONTRACT §1 / §1b / §1c)

`BUILD-CONTRACT.generated.md:16-52` — 18 emitted COPY keys, the four causes with their `hard` flag
and their ONE control, and three per-file kinds. ⚠ RESEARCH C-11 measured the sketch's live `COPY`
object at **27 keys** (`index.html:309-390`) vs the table's 18; the nine missing keys are named in
C-11. ⭐ Note `cause.unknown.says` and `fileFail.unknown` are **byte-identical to
`UNKNOWN_FAILURE_SENTENCE`** (`BUILD-CONTRACT…:44`, `:52` vs `ingestionErrorVocabulary.ts:70`).

⚠ `BUILD-CONTRACT…:50` ships a `too_big` sentence; RESEARCH §3.5 measured that `skipped_size` /
`skipped_type` are **written by nothing**, so that sentence has no producer today.

---

## ⭐ Pattern Assignment 3 — `sourceComposition.test.tsx` (the composition fence)

**Analog:** `frontend/src/components/library/__tests__/sketchComposition.test.tsx` (527 L, read in
full). Copy its structure section by section.

### The `data-block` prohibition — the exact lines the assignment asked for

`sketchComposition.test.tsx:34-38`:

```ts
 * ── THE HOOK CONVENTION ────────────────────────────────────────────────────────────────
 * `data-testid="<screen>-<block-kind>"`, e.g. `documents-stat-tiles`, `health-coverage-ring`.
 * `data-testid` is the house convention at ~1500 occurrences and the Library surface already
 * uses it this way (`views-tab`, `ingestion-tab`, `indexing-tab`, `library-sidebar`).
 * ⚠ `data-block` is the SKETCH's marker and must never appear in the build.
```

⚠ **This CONTRADICTS `BUILD-CONTRACT.generated.md:56`** (*"Every entry is a `data-block` the React
build must emit under the same name"*). RESEARCH C-9 resolves it: **follow the shipped
convention**, record the deviation in the plan. Both `VALIDATION.md:136-139` and RESEARCH agree.

### Why it lands RED and stays out of the gate (`:12-21`)

```ts
 * ⚠ IT IS SUPPOSED TO BE RED WHEN IT LANDS, AND ITS RED RUN IS THE DELIVERABLE.
 *   `.planning/phases/217.1-the-library-exactly-as-sketched/217.1-BASELINE.md` records that
 *   run verbatim. A guard nobody has seen fire is not a guard, and a guard adopted green on
 *   a tree it never failed on has proved nothing about its own wiring.
 *
 * ⛔ IT IS **NOT** IN `scripts/vitest-count-gate.cjs` — neither `TARGETS` nor `BASELINE`.
 *   The gate's contract is *zero failing, forever*; adopting a deliberately-red suite would
 *   make every subsequent plan's gate red for reasons it did not cause. The phase's FINAL
 *   wave (217.1-18) adopts it, once each wave has turned its own blocks green.
```

### The in-package import rule (`:22-33`, `:46`)

```ts
 * ── THE CONTRACT IS IMPORTED, NEVER TRANSCRIBED ────────────────────────────────────────
 * `sketchComposition.json` is written by `node .planning/sketches/218-…/drive.cjs --emit`
 * from the sketch's OWN `data-block="…"` markers. Hand-listing the blocks here would
 * reintroduce exactly the staleness the emitter exists to prevent.
 *
 * ⚠ THE IMPORT IS THE IN-PACKAGE COPY, not a `?raw` reach across the repo boundary into
 *   `.planning/sketches/` — which `/gsd:complete-milestone` ARCHIVES.
```

```ts
import composition from "../__generated__/sketchComposition.json"
```

### The mock idiom — PARTIAL mock of the barrel (`:48-91`)

```ts
// ⚠ PARTIAL mock of `@/lib/api`. It is a re-export barrel with ~12 domain modules behind
// it; a full replacement has to declare every symbol every child imports, and the one it
// forgets throws at MOUNT with a message about a missing export rather than about the
// missing block — the failure mode Phase 196-08 recorded across nine suites, and the one
// thing that would make this suite's RED unreadable.
const { mockUseDocuments, … } = vi.hoisted(() => ({ mockUseDocuments: vi.fn(), … }))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, listViews: mockListViews, … }
})
```

⚠ **P-10 (RESEARCH):** `@/lib/api/sources` is **not** in that barrel — mock it separately. The
shipped template is `WatchedFoldersSection.test.tsx:20-31` (quoted in Assignment 8 below).

### §1 the non-vacuity floor (`:229-252`)

```ts
describe("sketch-composition fence — §1 the contract itself", () => {
  // ⚠ THE NON-VACUITY CONTROL. A moved or misnamed JSON import can resolve to an empty
  // object rather than throwing, and an empty contract makes every case below vacuously
  // green — a fence that fires on nothing, which is the failure this whole phase exists
  // to stop happening a second time.
  it("resolves to a non-empty object", () => {
    expect(CONTRACT).toBeTypeOf("object")
    expect(Object.keys(CONTRACT).length).toBeGreaterThan(0)
  })
  it("carries all five screens", () => { … })
  it("carries a character floor of real content", () => {
    expect(JSON.stringify(CONTRACT).length).toBeGreaterThan(1200)
  })
  it("names at least three blocks on every screen", () => { … })
})
```

### §2 the positive controls (`:314-335`)

```ts
  // ⭐ THE SUITE MUST FAIL ON MISSING COMPOSITION, NEVER ON A BROKEN IMPORT PATH. A run in
  // which EVERY case is red is indistinguishable from a run whose mount harness is wrong,
  // so these two must be green in the RED baseline or the baseline proves nothing.
  it("the page renders its heading — the mount harness works", async () => {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderUI(<LibraryPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Library")
  })
  …
  it("the shipped tab-body hooks render — `data-testid` is the right convention", async () => {
    const { IngestionTab } = await import("../IngestionTab")
    renderUI(<IngestionTab documents={sampleDocuments} />)
    expect(screen.getByTestId("ingestion-tab")).toBeInTheDocument()
  })
```

### §3 the per-block loop + the hook helper + the mount harness (`:205-227`, `:398-419`)

```ts
/** `data-testid="<screen>-<kind>"` — the one hook convention, stated once. */
const hook = (screen: string, kind: string) => `${screen}-${kind}`

const TAB_BY_SCREEN: Record<string, string> = { documents: "Documents", …, health: "Health" }

/** ⚠ Ingestion's blocks live across its FOUR SUB-TABS (add-files / in-progress /
 *  needs-attention / history). A fresh mount lands on add-files, so the block loop passes
 *  the kind and this activates the sub-tab that hosts it. */
const INGESTION_SUBTAB_BY_BLOCK: Record<string, string> = { … }
```

```ts
  async function mountScreen(screenName: string, blockKind?: string) {
    const { LibraryPage } = await import("@/pages/LibraryPage")
    renderUI(<LibraryPage />)
    // Radix Tabs needs pointer events — userEvent.click, not fireEvent.click (measured).
    const user = userEvent.setup()
    await user.click(screen.getByRole("tab", { name: TAB_BY_SCREEN[screenName] }))
    if (screenName === "ingestion" && blockKind && INGESTION_SUBTAB_BY_BLOCK[blockKind]) {
      await user.click(screen.getByRole("tab", { name: INGESTION_SUBTAB_BY_BLOCK[blockKind] }))
    }
  }

  for (const screenName of SCREENS) {
    describe(`${screenName}`, () => {
      const blocks = CONTRACT[screenName]?.blocks ?? []
      for (const block of blocks) {
        it(`renders the \`${block.kind}\` block as [data-testid="${hook(screenName, block.kind)}"]`, async () => {
          await mountScreen(screenName, block.kind)
          expect(screen.getByTestId(hook(screenName, block.kind))).toBeInTheDocument()
        })
      }
```

⚠ `WatchedFoldersSection` mounts inside the **`add-files`** sub-tab (`IngestionTab.tsx:196`,
`:228-230`), so `INGESTION_SUBTAB_BY_BLOCK` must map every source block to `"Add files"`.

### §4 the per-control loop (`:494-527`)

```ts
  for (const screenName of SCREENS) {
    const buttons = CONTRACT[screenName]?.buttons ?? []
    for (const label of buttons) {
      it(`${screenName} · offers the "${label}" control`, async () => {
        …
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
      })
    }
  }
```

**Phase 235's control set, from `BUILD-CONTRACT.generated.md:531` (variant B, the winner):**

```
badge · open-health · fix · sync-now · toggle-history · toggle-quiet · report-source · go-to-source
```

**§5 the counts — variant B, from `BUILD-CONTRACT.generated.md:533-540`:**

```
- **A**: one `source-card` per watched source — **12**, including the unreadable one
- **B**: **9** `source-line` + **3** `source-card` — every source accounted for exactly once
- one `attention-row` per stopped source — **2**
- `run` rows **per open card** — collapsed: **3**, expanded: **17** (fixture has 17 ticks, 14 quiet)
- `instance-statement` appears **exactly once**, never per row
```

**The variant-B distinct block set — `BUILD-CONTRACT.generated.md:494-528`** (the honest
distinct-kind contract; ⚠ RESEARCH C-8 proved §2's long ordered lists are an unscoped-emitter
artifact, so do **not** transcribe the 104-entry list):

`rail-item · rail-item-library · badge · popover · pop-item · instance-statement · tab-ingestion ·
tab-health · body-ingestion · source-line · source-card · outcome · stopped-sentence · history ·
run · quiet-fold · fail-reason · body-health · attention-list · attention-row` — **20 kinds**,
matching the non-vacuity floor of ≥ 15 that `VALIDATION.md:107` requires.

---

## Pattern Assignment 4 — `172_connector_sync_runs.sql` (migration, schema DDL)

**Analog:** `supabase/migrations/168_connector_watches.sql` (122 L, read in full). Copy **five**
idioms verbatim.

**Header + transaction idiom (`168:1-17`):**

```sql
-- 168_connector_watches.sql
-- Phase 234: The Watch Loop — The Library Reads By Itself (LIB-08 / QUEUE-03 / D-234-01..10)
--
-- …
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.connector_watches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id uuid NOT NULL REFERENCES public.connector_connections(id) ON DELETE CASCADE,
```

**COMMENT idiom — table then per-column (`168:44-66`):**

```sql
COMMENT ON TABLE public.connector_watches IS
  'Phase 234 (LIB-08): Scheduled folder watches mapping external cloud folders to Library folders.';

COMMENT ON COLUMN public.connector_watches.next_run_at IS
  'Timestamp when this watch is next due for polling. Indexed for rapid SKIP LOCKED claim.';

COMMENT ON COLUMN public.connector_watches.last_status IS
  'Status of the latest sync run: success, failed, running, skipped_still_running, or partial.';
```

⚠ **That last COMMENT is the C-6 defect** — it documents `partial` and `skipped_still_running`
which nothing writes, and omits `paused` which `watch_service.py:143` does write. RESEARCH's
recommendation is to correct it to the measured set in the same commit and to add **no CHECK**.

**Index idiom (`168:68-80`) — a comment per index, `IF NOT EXISTS`, `USING btree`:**

```sql
-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Poller read index: partial on is_active to make due claims fast and cheap.
CREATE INDEX IF NOT EXISTS idx_connector_watches_due
  ON public.connector_watches USING btree (next_run_at)
  WHERE is_active;

-- Tenant & owner lookup
CREATE INDEX IF NOT EXISTS idx_connector_watches_org_user
  ON public.connector_watches USING btree (org_id, user_id);
```

**⭐ RLS "Shape A: Tenant membership AND owner" — copy all four policies verbatim (`168:82-104`):**

```sql
-- ── RLS (Shape A: Tenant membership AND owner) ──────────────────────────────
ALTER TABLE public.connector_watches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_watches_select ON public.connector_watches;
CREATE POLICY connector_watches_select ON public.connector_watches
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watches_insert ON public.connector_watches;
CREATE POLICY connector_watches_insert ON public.connector_watches
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watches_update ON public.connector_watches;
CREATE POLICY connector_watches_update ON public.connector_watches
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));

DROP POLICY IF EXISTS connector_watches_delete ON public.connector_watches;
CREATE POLICY connector_watches_delete ON public.connector_watches
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));
```

**Trigger + grant idiom (`168:106-122`):**

```sql
-- ── Triggers ─────────────────────────────────────────────────────────────────
-- Autofill org_id from user_id if omitted
DROP TRIGGER IF EXISTS connector_watches_autofill_org_id ON public.connector_watches;
CREATE TRIGGER connector_watches_autofill_org_id BEFORE INSERT ON public.connector_watches
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

-- Touch updated_at on row mutation
DROP TRIGGER IF EXISTS connector_watches_set_updated_at ON public.connector_watches;
CREATE TRIGGER connector_watches_set_updated_at BEFORE UPDATE ON public.connector_watches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Grants ───────────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.connector_watches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_watches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_watches TO service_role;

COMMIT;
```

⚠ **Two stated deviations from RESEARCH §3.4 / §5.4, to be recorded in the plan rather than made
silently:** (1) `connector_sync_runs` is append-only, so `updated_at` + its trigger are skipped and
`authenticated` gets `SELECT` only; (2) RESEARCH **A1** flags the pool-role/grant link as the one
unverified assumption — *keep the 168 grant block verbatim unless the pool role is verified first*,
because `release_watch`'s swallow (`db/watches.py:272-273`) would hide a silently-failing INSERT.

⛔ **D-235-20 is CONFIRMED** by RESEARCH §5: highest existing migration is `171`, so `172` is right
and ROADMAP's `161` is stale.

---

## Pattern Assignment 5 — `backend/app/db/watches.py` (DAL, asyncpg only)

**Analog:** itself. ⚠ **RESEARCH C-2 overrides CONTEXT.md here.** CONTEXT's "Established patterns"
section says the run-row insert must be wrapped in `run_in_threadpool`. **It must not.** The file
imports `asyncpg` at `:20` and **no** Supabase client and **no** `run_in_threadpool`.

**Module-constant + `_as_uuid` idiom (`watches.py:24-43`):**

```python
_WATCH_COLUMNS = (
    "id, org_id, user_id, connection_id, source_folder_id, source_folder_name, "
    "source_drive_id, library_folder_id, interval_minutes, next_run_at, leased_until, "
    "is_active, last_run_at, last_status, last_error, created_at, updated_at"
)
…
def _as_uuid(value: Any) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))
```

→ a new `_SYNC_RUN_COLUMNS` constant is the matching shape.

**The plain read idiom (`watches.py:299-314`) — this is what a history read copies:**

```python
async def get_watch_items(
    pool: asyncpg.Pool,
    watch_id: UUID,
) -> list[dict]:
    """List all tracked items for a given watch."""
    async with pool.acquire() as con:
        rows = await con.fetch(
            f"""
            SELECT {_WATCH_ITEM_COLUMNS}
            FROM connector_watch_items
            WHERE watch_id = $1
            ORDER BY name ASC
            """,
            _as_uuid(watch_id),
        )
        return [dict(r) for r in rows]
```

⚠ **Security note (RESEARCH V4):** `get_watch_items` carries **no owner predicate** — the API
route checks ownership first (`sources.py:172-183`). The run-history read must carry
`AND user_id = $2` in SQL, matching `get_watch:96-103` / `update_watch:166` / `delete_watch:183`,
because the pool path is **not** RLS-gated.

**⭐ The best-effort writer to copy for `insert_sync_run` (`watches.py:249-273`):**

```python
async def release_watch(
    pool: asyncpg.Pool,
    watch_id: UUID,
    *,
    status: str,
    error: str | None = None,
) -> None:
    """Clear lease and write terminal outcome hint."""
    try:
        async with pool.acquire() as con:
            await con.execute(
                """
                UPDATE connector_watches
                SET leased_until = NULL,
                    last_status = $2,
                    last_error = $3,
                    updated_at = now()
                WHERE id = $1
                """,
                _as_uuid(watch_id),
                status,
                error,
            )
    except Exception:  # noqa: BLE001
        logger.exception("release_watch failed for %s", watch_id)
```

⭐ **RESEARCH C-3's recommended shape is to fold the run-row write INSIDE this function**, taking
counts + cause as optional kwargs — then all four release arms get a row by construction, and the
insert inherits the swallow-and-log policy for free (history must never turn a successful sync into
a failed one).

**The multi-statement-in-transaction precedent, if the prune CTE proves awkward
(`watches.py:210-246`):**

```python
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(
                f"""
                SELECT {_WATCH_CLAIM_COLUMNS}
                FROM connector_watches
                WHERE is_active = true
                  AND next_run_at <= COALESCE($2::timestamptz, now())
                  AND (leased_until IS NULL OR leased_until < COALESCE($2::timestamptz, now()))
                ORDER BY next_run_at
                LIMIT $1
                FOR UPDATE SKIP LOCKED
                """,
                limit, now,
            )
```

⚠ `claim_due_watches:232-244` sets `last_run_at = now(), last_status = 'running'` **at claim time**
— so `last_run_at` means *"when the tick STARTED"*. The run row needs both `started_at` and
`finished_at` (RESEARCH §2.5).

**Return-shape idiom (RESEARCH §2.3, verified in file):** `dict(row) if row else {}` for
inserts/upserts · `dict(row) if row else None` for reads · `[dict(r) for r in rows]` for lists ·
`None` for the two best-effort writers · `tag.rsplit(" ", 1)[-1] != "0"` for `delete_watch:187`.

---

## Pattern Assignment 6 — `backend/app/services/watch_service.py`: the FOUR `release_watch` seams

⚠ **RESEARCH C-3 overrides CONTEXT D-235-06**, which says *"on both the success and failure arms"*.
There are **four**, and one is outside `sync_watch` entirely. All four read in this session:

**Site 1 — `tick()`'s per-watch `except`, `watch_service.py:107-117`. ⛔ OUTSIDE `sync_watch`:**

```python
        for watch in claimed:
            watch_id = UUID(str(watch["id"]))
            # SEED-239: Error isolation per watch — one failing watch never crashes the tick
            try:
                await self.sync_watch(watch)
                processed += 1
            except Exception as exc:
                logger.exception("Watch %s failed during sync: %s", watch_id, exc)
                await release_watch(self.pool, watch_id, status="failed", error=str(exc))
```

⚠ `await self.sync_watch(watch)` at `:111` **discards the returned counts dict** — `processed += 1`
is the next line. That discard is what migration 172 exists to stop.

**Site 2 — connection disabled, `watch_service.py:142-144`. ⚠ writes `"paused"`, which is NOT in
migration 168's COMMENT:**

```python
        if not conn.get("is_enabled", True):
            await release_watch(self.pool, watch_id, status="paused", error="Connection is disabled")
            return {"status": "paused", "reason": "Connection disabled"}
```

**Site 3 — the happy path + the discard, `watch_service.py:433-439`:**

```python
        # 7. Release watch upon successful sync
        await release_watch(self.pool, watch_id, status="success")
        logger.info(
            "Watch %s sync complete: %d new, %d modified, %d renamed, %d missing, %d restored, %d errors",
            watch_id, counts["new"], counts["modified"], counts["renamed"], counts["missing"], counts["restored"], counts["errors"],
        )
        return {"status": "success", "counts": counts}
```

**Site 4 — the VIS-04 403 arm, `watch_service.py:458` (carries the token_revoked/folder_gone
evidence):**

```python
        await release_watch(self.pool, watch_id, status="failed", error=f"Source access unauthorized: {exc}")
```

**The counts dict, exactly (`watch_service.py:203`):**

```python
        counts = {"new": 0, "modified": 0, "renamed": 0, "missing": 0, "restored": 0, "errors": 0}
```

**⭐ The `listing.complete` suppression the run row must record (`watch_service.py:412-424`):**

```python
        # ── STRUCTURAL ASSERTION (H-5 / SRC-06) ───────────────────────────────────────
        # Onyx #1161 guard: If the listing did NOT complete exhaustively (e.g. mid-pagination error),
        # missing state transitions are STRICTLY FORBIDDEN.
        if not listing.complete:
            if deleted_candidates:
                logger.warning(
                    "Watch %s listing incomplete; suppressing missing state transitions for %d item(s) (H-5)",
                    watch_id, len(deleted_candidates),
                )
        else:
            for it in deleted_candidates:
                counts["missing"] += 1
```

**The only failure classification that exists today — a substring sniff (`watch_service.py:189-197`):**

```python
        except Exception as list_exc:
            listing.complete = False
            listing.error = str(list_exc)
            err_str = str(list_exc).lower()
            if "403" in err_str or "permission" in err_str or "unauthorized" in err_str:
                # VIS-04: Authorization revoked at source
                await self._handle_unauthorized_watch(watch, list_exc)
                return {"status": "unauthorized", "error": str(list_exc)}
            raise list_exc
```

**The late-binding-closure discipline any new in-loop lambda must follow
(`watch_service.py:426-431`, five sites total — P-9):**

```python
                if it.get("document_id"):
                    await run_in_threadpool(
                        lambda doc_id=it["document_id"]: supabase.table("documents")
                        .update({"source_state": "missing_at_source"})
                        .eq("id", str(doc_id))
                        .execute()
                    )
```

---

## Pattern Assignment 7 — `backend/app/api/sources.py` (controller, request-response)

**Router + module helper (`sources.py:46-52`):**

```python
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sources", tags=["sources"])


def _as_uuid(val: Any) -> UUID:
    return val if isinstance(val, UUID) else UUID(str(val))
```

⚠ Registered **twice** in `main.py` (`:861` `/sources`, `:862` `/api/sources`) — a new route is
automatically at both. The client uses `${API_BASE}/sources/watches` (`lib/api/sources.ts:82`).

**The auth / org / pool dependency idiom (`sources.py:96-107`):**

```python
async def create_folder_watch(
    req: WatchCreateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    pool=Depends(get_pg_pool),
):
    """Create a new folder watch for an external connection."""
    user_id = _as_uuid(current_user["id"])
    active_org_str = await resolve_active_org_or_none(request, current_user)
    org_id = _as_uuid(active_org_str) if active_org_str else None
```

**The response-model + 404-not-403 idiom (`sources.py:147-159`, `:174-178`):**

```python
@router.get(
    "/watches",
    response_model=list[WatchResponse],
)
async def list_folder_watches(
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """List all watches owned by the current user."""
    user_id = _as_uuid(current_user["id"])
    rows = await list_watches(pool, user_id=user_id)
    enriched = await _enrich_watch_rows(pool, rows)
    return enriched
```

```python
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found.",
        )
```

**⛔ SEED-239's live blast radius — `_enrich_watch_rows` has NO per-row boundary (`sources.py:55-88`):**

```python
async def _enrich_watch_rows(pool: Any, rows: list[dict]) -> list[dict]:
    """Attach item_count, connection_name, and service_id to watch records."""
    if not rows or not pool:
        return rows

    enriched = []
    async with pool.acquire() as con:
        for r in rows:
            record = dict(r)
            wid = record.get("id")
            conn_id = record.get("connection_id")

            # 1. Count items
            count = await con.fetchval(
                "SELECT COUNT(*) FROM connector_watch_items WHERE watch_id = $1", wid,
            )
            record["item_count"] = count or 0

            # 2. Lookup connection details
            if conn_id:
                conn_row = await con.fetchrow(
                    "SELECT name, service_id FROM connector_connections WHERE id = $1", conn_id,
                )
                if conn_row:
                    record["connection_name"] = conn_row["name"]
                    record["service_id"] = conn_row["service_id"]

            if not record.get("last_status"):
                record["last_status"] = "pending"

            enriched.append(record)
    return enriched
```

⭐ **D-235-13's degraded-row boundary goes inside this `for r in rows:` loop.** ⚠ `:84-85` is where
`"pending"` is **synthesised at read time** and never stored (RESEARCH C-6) — the pending state
(D-235-16) must not collide with it.

**⛔ THE `/sync` ENDPOINT IN FULL, as it stands today (`sources.py:261-295`) — the three-part
honesty fix edits exactly this:**

```python
@router.post(
    "/watches/{watch_id}/sync",
    response_model=WatchSyncResponse,
)
async def trigger_watch_sync(
    watch_id: UUID,
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """Trigger an immediate check for the watch by setting next_run_at = now()."""
    user_id = _as_uuid(current_user["id"])
    existing = await get_watch(pool, watch_id, user_id=user_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found or unauthorized.",
        )

    async with pool.acquire() as con:
        await con.execute(
            """
            UPDATE connector_watches
            SET next_run_at = now(),
                leased_until = NULL,
                updated_at = now()
            WHERE id = $1 AND user_id = $2
            """,
            watch_id,
            user_id,
        )

    return WatchSyncResponse(
        status="scheduled",
        message=f"Watch {watch_id} scheduled for immediate sync.",
    )
```

⛔ **D-235-15 binding:** the `UPDATE … next_run_at = now()` poke stays. Only the **reply** and a
pre-flight refusal change. The forbidden word lives at `:293` **and** at
`WatchedFoldersSection.tsx:78` (RESEARCH C-7) — a fence over one file leaves the other broken.

**Best-effort side-effect idiom for anything that must not fail the request (`sources.py:243-251`):**

```python
            try:
                await run_in_threadpool(
                    lambda: supabase.table("documents").delete().in_("id", doc_ids).execute()
                )
            except Exception as err:
                logger.warning("Error purging documents for watch %s: %s", watch_id, err)
```

**Where the verdict route belongs:** `api/sources.py`, **not** `knowledge_health.py` (RESEARCH
§6.2 — `connector_watches` has a working `authenticated` SELECT policy and does not need that
module's uniform service-role carve-out; `knowledge_health.py` also has no pool dependency).
⚠ Its `reader_running` field reads `request.app.state.watch_service is not None` (C-4 / P-3), never
`settings.watch_process_enabled` — `main.py:587-589` swallows a failed start.

---

## Pattern Assignment 8 — the frontend suites' mock idiom (`@/lib/api/sources` is NOT in the barrel)

**Analog and template:** `frontend/src/components/sources/WatchedFoldersSection.test.tsx:12-46`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { WatchedFoldersSection } from "./WatchedFoldersSection"
import * as sourcesApi from "@/lib/api/sources"
import type { ConnectorWatch } from "@/lib/api/sources"

vi.mock("@/lib/api/sources", () => ({
  listWatches: vi.fn(),
  triggerWatchSync: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  purgeWatchFiles: vi.fn(),
  createWatch: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listConnectorConnections: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/hooks/useFolders", () => ({
  useFolders: () => ({ folders: [ … ] }),
})) 

const mockListWatches = vi.mocked(sourcesApi.listWatches)
```

⚠ **Two separate `vi.mock` calls — that is P-10's point.** A new function added to
`lib/api/sources.ts` must be added to this factory too, or the mount throws about a missing export.

⚠ The shipped fixture uses `last_status: "completed"` (`:60`) and `"disconnected"` (`:74`) — **two
statuses production never writes** (RESEARCH C-6). Any new suite should use the measured set
`{running, success, failed, paused}`.

**`lib/api/sources.ts` client idiom to copy for a new call (`:80-87`):**

```ts
export async function listWatches(signal?: AbortSignal): Promise<ConnectorWatch[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/sources/watches`, { headers, signal })
  if (!res.ok) {
    throw new ApiError(`Failed to load watches (status ${res.status})`, res.status)
  }
  return (await res.json()) as ConnectorWatch[]
}
```

Import line: `import { API_BASE, ApiError, getAuthHeaders } from "./_core"` (`:5`). Interfaces are
declared in the same file and re-exported by name (`ConnectorWatch:26-47`), never through
`@/lib/api`.

---

## Pattern Assignment 9 — `NavPanel.tsx`: the badge slot on `RailItem`

**`RailItem` in FULL (`NavPanel.tsx:57-98`) — pure presentational, two renderings:**

```tsx
// One rail control, two renderings. Collapsed → a 40px icon square wrapped in a
// hover tooltip (the label lives in the tip). Expanded → a full-width row with the
// icon + a visible label, tooltip dropped (redundant). `className` carries the
// tone-specific colours (primary New-Chat wash, active highlight, amber shield, …).
function RailItem({
  expanded,
  icon: Icon,
  label,
  active,
  onClick,
  className,
}: {
  expanded: boolean
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
  className?: string
}) {
  const button = (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        expanded ? "w-full justify-start gap-3 px-3" : "w-10 justify-center",
        className,
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {expanded && <span className="text-sm font-medium truncate">{label}</span>}
    </button>
  )
  if (expanded) return button
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className="ml-2">{label}</TooltipContent>
    </Tooltip>
  )
}
```

**The rail widths the badge must survive (`NavPanel.tsx:118-123`):**

```tsx
    <div
      className={cn(
        "hidden md:flex flex-col h-full shrink-0 bg-sidebar border-r border-border/20 py-3 motion-safe:transition-[width] motion-safe:duration-300",
        expanded ? "w-[210px] items-stretch px-2" : "w-[58px] items-center",
      )}
    >
```

⚠ **`hidden md:flex` — DESKTOP ONLY.** `VALIDATION.md:169-173` and RESEARCH A4 both flag this as
the most likely place SURF-03 gets closed against its own sentence. **The plan must decide mobile
explicitly.**

**The nav loop the badge attaches through (`NavPanel.tsx:163-177`):**

```tsx
        {navItems.map(({ view, icon, label }) => (
          <RailItem
            key={view}
            expanded={expanded}
            icon={icon}
            label={label}
            active={activeView === view}
            onClick={() => onNavigate(view)}
            className={
              activeView === view
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40"
            }
          />
        ))}
```

⭐ **The precedent for the generic-slot-with-one-tenant shape (D-235-03)** is `className` itself:
one optional prop, the *caller* decides the tone, the component branches on nothing. `badge?:
React.ReactNode` follows it exactly. RESEARCH's §"Code Examples" adds that `button`'s `cn(...)`
needs `relative` for absolute positioning at the 40px collapsed size, and that the badge must live
**inside** `button` so it survives both the bare (`:91`) and Tooltip-wrapped (`:92-97`) returns.

**Analog test file — `frontend/src/components/layout/__tests__/NavPanel.test.tsx:24-56`:**

```tsx
const navItems: NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "documents", icon: FileText, label: "Documents" },
]

type NavProps = React.ComponentProps<typeof NavPanel>

function renderRail(overrides: Partial<NavProps> = {}) {
  const props: NavProps = {
    activeView: "chat",
    onNavigate: vi.fn(),
    navItems,
    isOperator: false,
    onNewThread: vi.fn(),
    onSignOut: vi.fn(),
    theme: "dark",
    onToggleTheme: vi.fn(),
    expanded: false,
    onToggleExpanded: vi.fn(),
    ...overrides,
  }
  // Only a TooltipProvider — deliberately NO StreamsProvider …
  const utils = render(
    <TooltipProvider>
      <NavPanel {...props} />
    </TooltipProvider>,
  )
  return { ...utils, props }
}
```

⭐ **The both-states loop `NavPanel.badge.test.tsx` copies for V-11 (`NavPanel.test.tsx:59-65`):**

```tsx
  it("renders a New Chat button reachable by role name /new chat/i on every activeView", () => {
    for (const view of ["chat", "documents", "settings", "workflows"] as ActiveView[]) {
      const { unmount } = renderRail({ activeView: view })
      expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument()
      unmount()
    }
  })
```

⚠ **The `aria-hidden` badge lesson, already learned one directory over
(`IngestionTab.tsx:176-188`)** — a badge that is not `aria-hidden` RENAMES its control and broke
six cases:

```tsx
              <span
                data-testid="in-progress-badge"
                /* ⛔ aria-hidden, and that is deliberate rather than lazy. Without it the tab's
                   ACCESSIBLE NAME becomes "In progress 3" and every `getByRole("tab", {name:
                   "In progress"})` breaks — six cases did, measured. … A badge
                   may decorate a control's name; it may not RENAME it. */
                aria-hidden="true"
```

⛔ `RailItem` sets `aria-label={label}` (`:79`), so the rail badge **must** be `aria-hidden` or
every `getByRole("button", { name: "Library" })` in `NavPanel.test.tsx` keeps working only by luck.

---

## Pattern Assignment 10 — `WatchedFoldersSection.tsx` (component, request-response)

**Analog:** itself. The measured anchors (all read this session):

| What | Line(s) | Excerpt / note |
|---|---|---|
| ⛔ the forbidden word | `:78` | `setFeedbackMessage(\`Sync scheduled for ${watch.source_folder_name}.\`)` |
| `isDisconnected` derivation | `:209-212` | substring-sniffs `last_error` — the mechanism D-235-10's classifier replaces |
| disconnect banner | `:230-257` | `data-testid="watch-disconnected-banner"` |
| ⛔ the no-router fallback | `:246-252` | `window.location.href = "/settings/connections"` — the LIVE path, because `IngestionTab:228-230` passes no `onNavigateToConnections` |
| status pill | `:265-288` | **two parallel 5-arm ternaries** over the same conditions |
| ⭐ SURF-01 pinned sentence | `:302-306` | see below |
| actions toolbar | `:311-368` | Sync now `:312-325` · Pause/Resume `:327-341` · Purge `:344-354` · Delete `:356-367` |
| raw error render | `:371-375` | `Last check error: {watch.last_error}` — the `ingestionErrorVocabulary` defect verbatim |

**⛔ THE PINNED SURF-01 INVARIANT — quoted exactly, do not reword (`:302-306`):**

```tsx
                      {/* SURF-01: Exact copy 'checked every N minutes' */}
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>checked every {watch.interval_minutes} minutes</span>
                      </span>
```

**The card root the history expansion appends inside (`:216-228`):**

```tsx
              <div
                key={watch.id}
                data-testid={`watch-card-${watch.id}`}
                className={cn(
                  "rounded-lg border p-4 transition-all bg-card/90 space-y-3",
                  isDisconnected
                    ? "border-amber-500/40 bg-amber-500/5 shadow-sm"
                    : watch.is_active
                    ? "border-border/80 hover:border-border"
                    : "border-border/40 opacity-75 bg-muted/20",
                )}
              >
```

**The loading + feedback arms, reusable for the pending state (`:163-187`):**

```tsx
      {feedbackMessage && (
        <div className="p-2.5 text-xs text-emerald-600 … flex items-center justify-between">
          <span>{feedbackMessage}</span>
          <button type="button" onClick={() => setFeedbackMessage(null)} …>Dismiss</button>
        </div>
      )}
      …
      {loading ? (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading watched folders...
        </div>
```

**The action-handler idiom every new control copies (`:74-85`):**

```tsx
  const handleSyncNow = async (watch: ConnectorWatch) => {
    setActionInProgress(watch.id)
    try {
      await triggerWatchSync(watch.id)
      setFeedbackMessage(`Sync scheduled for ${watch.source_folder_name}.`)   // ⛔ C-7
      await loadWatches()
    } catch (err: any) {
      setError(err?.message || "Failed to trigger sync.")
    } finally {
      setActionInProgress(null)
    }
  }
```

⚠ **`data-*` hooks this file emits TODAY: exactly two** (`:219`, `:232`). All 20 BUILD-CONTRACT
block names are net-new.

---

## Pattern Assignment 11 — `HealthTab.tsx` / `IngestionTab.tsx` sibling mounts

⚠ **CORRECTION to the assignment.** It asks for "the lazy/Suspense sibling-mount idiom". Measured:
the **siblings are static imports**; `lazy`/`Suspense` is used for exactly one chart.

**`HealthTab.tsx:11-26` — the only lazy in the file:**

```tsx
import { useEffect, useState } from "react"
import { lazy, Suspense } from "react"
import { ChartSkeleton } from "@/components/health/ChartSkeleton"
import { getHealthOverview, getRetrievalTrend } from "@/lib/api"
import type { HealthOverview, RetrievalTrendPoint } from "@/lib/api"
import { CoverageRing } from "./CoverageRing"
import { HealthSignalChips } from "./HealthSignalChips"
import { HealthDocumentBars } from "./HealthDocumentBars"
import { CheckedQueriesSection } from "./CheckedQueriesSection"
…
const RetrievalTrendChart = lazy(() =>
  import("@/components/health/RetrievalTrendChart").then((m) => ({
    default: m.RetrievalTrendChart,
  })),
)
```

**The self-fetch + fail-quiet + skeleton idiom a new attention section copies
(`HealthTab.tsx:70-110`):**

```tsx
export function HealthTab() {
  const [overview, setOverview] = useState<HealthOverview | null>(null)
  …
  useEffect(() => {
    getHealthOverview().then(setOverview).catch(() => setOverview(null))
  }, [])
  …
        <div data-testid="health-coverage-ring">
          {overview ? ( <CoverageRing … /> ) : (
            <div className="h-44 w-44 animate-pulse bg-muted/30 rounded-lg" />
          )}
        </div>
        <div className="min-w-0" data-testid="health-searches-chart">
          <Suspense fallback={<ChartSkeleton />}>
```

⭐ **The block-hook convention is already live in this file** — `data-testid="health-coverage-ring"`
(`:91`) is literally `<screen>-<block-kind>`, which is what the composition fence reads.

**`IngestionTab.tsx:157-160` — where the `instance-statement` belongs (once, above the sub-tabs):**

```tsx
  return (
    <section data-testid="ingestion-tab" className="flex flex-col gap-6 overflow-y-auto">
      {/* ── THE FOUR SUB-TABS ──────────────────────────────────────────────────── */}
      <Tabs value={subTab} onValueChange={setSubTab} data-testid="ingestion-subnav">
```

**`IngestionTab.tsx:220-231` — the sibling-mount precedent, and the one-child rule stated in prose:**

```tsx
            {/* Phase 233 (D-233-06) — the connected-source door. ONE child element: the section
                owns the connection picker, the source folder tree and the preview, so this tab
                gains a mount and no branch. It renders NOTHING when no source-capable connection
                exists, so a person with no connections sees exactly the surface they saw before. */}
            <ConnectedSourceSection
              destinationFolderId={uploadFolderId}
              destinationFolderName={uploadFolderName}
            />
            <WatchedFoldersSection
              destinationFolderId={uploadFolderId}
            />
```

⭐ That comment IS the G-5-honoured-by-construction argument, ready to be reused verbatim for the
reader-off statement: **one import, one mount, zero branches.**

---

## Pattern Assignment 12 — `backend/app/services/sources/failure_cause.py`

⚠ **Partial match — there is no existing hard/soft failure classifier in this backend.** The
closest structural analog is `backend/app/services/sources/preview_service.py`, which is the same
package, the same "one classifier, table-driven, writes nothing" shape.

**Its `Literal` + module-table idiom (`preview_service.py:48-79`):**

```python
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Literal

log = logging.getLogger(__name__)

Bucket = Literal["add", "here", "uns", "unk"]

#: The four buckets, in the order the surface renders them. ⚠ There is deliberately no fifth and
#: no way to remove one — SC#1 is met BY CONSTRUCTION, never by audit (D-233-04).
BUCKETS: tuple[Bucket, ...] = ("add", "here", "uns", "unk")

#: ⭐ `outcome` has exactly THREE values (D-233-05). There is deliberately no fourth, so SC#5's
#: *"silently in neither"* is **unrepresentable** rather than merely unlikely.
Outcome = Literal["added", "here", "refused"]

GOOGLE_NATIVE_EXPORTABLE = { … }
OPAQUE_MIMES = {"application/octet-stream", ""}
```

**Its single entry point (`preview_service.py:150-159`):**

```python
# ── the classifier ─────────────────────────────────────────────────────────────────────────


def classify_source_file(
    *,
    name: str,
    mime_type: str,
    …
```

⭐ **Copy:** `Cause = Literal["token_revoked","folder_gone","unreachable","unknown"]`, a module
table `HARD_CAUSES: frozenset[Cause]` (or `CAUSE_IS_HARD: dict[Cause, bool]`), an ordered
`MATCHERS` list mirroring `ingestionErrorVocabulary.ts:99-112`, and ONE
`classify_failure_cause(message: str | None, status_code: int | None = None) -> Cause`.

⚠ **The frontend suite binds to this file's LIVE SOURCE** (RESEARCH §9.5), so the cause literals
must be greppable in plain text — a `Literal[...]` union and a table, not a computed set.

⛔ `preview_service.py`'s docblock rule applies here too: *"`build_preview` writes **nothing**"*.
`failure_cause.py` must be import-free of the DB and write nothing.

---

## Shared Patterns

### S-1 · `?raw` cross-language binding (frontend suite ⇄ live backend source)

**Source:** `frontend/src/components/library/__tests__/ingestionFailureCopy.test.ts:34-37`, `:190-194`
**Apply to:** `sourceHealthVocabulary.test.ts` (V-09), the `"scheduled"` fence (V-16)

```ts
// The live source this suite is BOUND to — `documents.py` writes the human sentences the
// pass-through arm must recognise, so a sentence edited there cannot silently stop being
// shown here. Same `?raw` cross-language idiom as `IngestionStrip.test.tsx:39`.
import documentsPySource from "../../../../../backend/app/api/documents.py?raw"
```

```ts
  // Non-vacuity: the ?raw import carries the backend module.
  it("non-vacuity — the ?raw import carries documents.py", () => {
    expect(documentsPySource.length).toBeGreaterThan(20000)
    expect(documentsPySource).toContain("empty_text_message")
  })
```

⚠ **Every `?raw` regex extraction is paired with a non-vacuity assertion** — see `:250-254`:

```ts
  it("⚠ NON-VACUITY — the constant was actually found in the live backend source", () => {
    // A regex that matched nothing yields "", and "" would satisfy nothing meaningfully
    // while looking green. This is the assertion that reds if the constant is renamed.
    expect(imageSentence().length).toBeGreaterThan(40)
  })
```

⚠ Path depth differs: `library/__tests__/` needs five `../`; a suite at
`frontend/src/components/sources/` needs **four** (`../../../../backend/…`).

### S-2 · The whole-table five-rule property, with the em dash computed at runtime

**Source:** `ingestionFailureCopy.test.ts:19-21`, `:39-96`
**Apply to:** `sourceHealthVocabulary.test.ts` (V-08)

```ts
 * ⚠ THE EM-DASH CHECK IS ASSEMBLED AT RUNTIME (Pitfall 8). A counted literal spelled inside a
 * docblock comment is itself a string the fence would match — so the codepoint is computed
 * and the docblock avoids the character itself.
…
const EM_DASH = String.fromCharCode(0x2014)
```

```ts
  it("non-vacuity — the table has at least the four named kinds", () => {
    // Asserted BEFORE the property: an empty table would satisfy every "for each" vacuously.
    expect(allKinds).toContain("nul_in_text")
    …
  })

  it("rule 2 — NO severity word in any sentence", () => {
    const forbidden = /\b(error|failed|failure|broken|fatal|critical)\b/i
    for (const s of allSentences) expect(s).not.toMatch(forbidden)
  })

  it("rule 3 — NO exclamation in any sentence", () => { … expect(s).not.toMatch(/!/) … })

  it("rule 4 — NO mechanism in any sentence (no SQLSTATE, no exception class, no driver)", () => {
    const mechanism = /\b\d{2}[A-Z0-9]{3}\b|Error|Exception|Traceback|psycopg|postgrest|asyncpg|supabase|httpx|site-packages|SELECT |INSERT INTO|<class '|object at 0x/i
    for (const s of allSentences) expect(s).not.toMatch(mechanism)
  })

  it("rule 5 — where a dash appears it is an EM DASH (U+2014), never a hyphen-minus", () => {
    for (const s of allSentences) {
      if (/[-‐-―−]/.test(s)) {
        const dashes = s.match(/[-‐-―−]/g) ?? []
        for (const d of dashes) expect(d).toBe(EM_DASH)
      }
    }
  })
```

⚠ **Rule 2 vs the BUILD-CONTRACT:** `readerOffOperator` is the literal `WATCH_PROCESS_ENABLED`
(`BUILD-CONTRACT…:30`) — a **mechanism**, exempted deliberately by §4 (`:440`) as the *marked
operator half*. The suite must carve it out explicitly, not silently loosen rule 4.

### S-3 · Backend unit-test doubles (asyncpg pool + FastAPI probe app)

**Source A — the pool double (`backend/tests/unit/db/test_watches_db.py:34-43`):**

```python
@pytest.mark.asyncio
async def test_create_watch_mock():
    pool = MagicMock()
    con = AsyncMock()
    pool.acquire.return_value.__aenter__.return_value = con
    …
    con.fetchrow.return_value = expected_row
```

…and the SQL-shape assertion idiom (`:77-81`, `:98-107`):

```python
    assert con.fetchrow.called
    call_args = con.fetchrow.call_args[0]
    assert "INSERT INTO connector_watches" in call_args[0]
…
    sql = con.fetchrow.call_args[0][0]
    assert "user_id = $2" in sql
```

**Source B — the API probe app (`backend/tests/unit/api/test_sources_watches_api.py:19-29`,
`:60-76`):**

```python
@pytest.fixture
def client():
    probe = FastAPI()
    probe.include_router(sources.router)
    probe.include_router(sources.router, prefix="/api")
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


def _auth_headers():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ORG_ID}
```

```python
    conn_builder = MagicMock()
    conn_builder.select.return_value = conn_builder
    conn_builder.eq.return_value = conn_builder
    conn_builder.maybe_single.return_value = conn_builder
    conn_builder.execute.return_value = MagicMock(data={…})

    sb_mock = MagicMock()
    sb_mock.table.return_value = conn_builder
    real_app.dependency_overrides[deps.get_user_supabase_client] = lambda: sb_mock

    create_mock = AsyncMock(return_value=watch_row)
    monkeypatch.setattr("app.api.sources.create_watch", create_mock)
```

⭐ `monkeypatch.setattr("app.api.sources.<dal_fn>", AsyncMock(...))` is how the DAL is faked at the
route boundary — that is how `test_sources_degraded_row.py` plants a malformed row and how
`test_sources_sync_honesty.py` drives the refusal.

⚠ **The mock row fixture (`:32-57`) is the shape a `WatchResponse` must satisfy** — a new required
field on that model means editing `_mock_watch_row`.

### S-4 · `config.py` knob block (retention `N`)

**Source:** `backend/app/config.py:1200-1207`

```python
    # ── Phase 234 (LIB-08 / QUEUE-03) — the background connector watch loop ─────────────
    # OFF BY DEFAULT, matching scheduler_process_enabled: makes outbound cloud provider calls
    # autonomously, so it must be explicitly enabled by the operator.
    watch_process_enabled: bool = False
    # Poll interval in seconds for the watch loop (default 60s).
    watch_poll_interval_seconds: int = 60
    # Lease duration in seconds for in-flight watch passes (default 600s).
    watch_lease_seconds: int = 600
```

→ `watch_run_history_retention: int = 200` goes here, with the `SEED-250` note. ⚠ Adding an env
var the app reads triggers `scripts/check-deploy-drift.sh`: `deploy/onebox.env.example` +
`backend/.env.example` in the **same commit**.

### S-5 · The vitest count gate — BOTH knobs, same commit

**`BASELINE` — insert after `scripts/vitest-count-gate.cjs:3197`; the object closes at `:3198`:**

```js
  // ── Phase 234 (234-05 / LIB-08 / SURF-01 / VIS-05) — Watched folders surface ──
  "WatchedFoldersSection.test.tsx": 6,
}
```

**`TARGETS` — insert after `:4492`; the array closes at `:4493`:**

```js
  // ── Phase 233 (233-02) — the preview's two suites. See the BASELINE block for why each ──
  // ── needs its own line: `src/components/sources` is not a directory entry here. ────────
  "src/components/sources/previewVocabulary.test.ts",
  "src/components/sources/SourcePreviewPanel.test.tsx",
  // ── Phase 234 (234-05) — watched folders surface ──
  "src/components/sources/WatchedFoldersSection.test.tsx",
]
```

**The exemplar commit shape** — Phase 233's own comment block (`:3165-3184`) is the template for
what a new pin must say:

```js
  // ── Phase 233 (233-02 / PREV-01…03 / LIB-09) — THE PREVIEW. Two suites, and BOTH knobs ──
  // ── are set in the SAME COMMIT that creates them, because a BASELINE key naming a path ──
  // ── that does not yet exist makes this gate ERROR (exit 2) rather than fail. ───────────
  //
  // ⚠ Neither file is covered by an existing TARGETS entry: `src/components/sources` is NOT a
  // directory entry — `SourceFolderPicker.test.tsx` is pinned by an explicit PATH above, and a
  // path entry recurses into nothing. So both suites needed a TARGETS line of their own, and
  // that was CHECKED against the array rather than assumed. …
```

…and Phase 233's `LibraryHeaderBar` block (`:3185-3192`) records the same lesson for
`src/components/library`:

```js
  // ⚠ BOTH knobs, same commit, AND THE CHECK MATTERED: this comment first read
  // "`src/components/library` IS a directory entry so the file already runs". **It is not.**
```

⚠ **RESEARCH §10.2 measured only TWO directory entries in the whole `TARGETS` array**
(`src/landing`, `src/components/workflows`). So `src/components/sources`, `src/components/library`
**and `src/components/layout`** are all file-level — CONTEXT flags only `sources`.

**Keys are BASENAMES; TARGETS values are full paths.** The composition fence goes in **neither**
while red (`sketchComposition.test.tsx:17-21`) and is adopted in the final wave at the gate's own
printed `— N new` figure.

---

## No Analog Found

| File | Role | Data flow | Why no analog |
|---|---|---|---|
| the run-history list + quiet-run fold (`…/sources/` — `RunHistoryList.tsx` / `runHistoryFold.ts`) | component + pure fold | rendering | **Nothing in this repo collapses a run sequence into a summary line.** The nearest neighbours are *presentational* only: `WatchedFoldersSection`'s card body (`:259-375`) has no list, and `frontend/src/components/workflows/RunStepList.tsx` renders per-step rows without folding. D-235-07's "N stored rows → one `quiet-fold` line, expandable" is a **net-new pure function**; give it its own leaf + suite (the `librarySelection.ts` strict-leaf shape is the right container, `libraryReducer`'s totality the right test posture). |
| the rail badge popover surface (`…/layout/AttentionPopover.tsx` or similar) | component | request-response | **No in-app notification surface exists** (RESEARCH's own SURF-03 note). The closest shapes are the `Tooltip` wrap in `RailItem:92-97` and `ProfileMenu` (`NavPanel.tsx:228-233`, a rail-anchored popover) — but neither is a *list of app-level conditions*, and neither is a registry. D-235-03's "general-purpose surface, one tenant" has no precedent to copy; the nearest *architectural* precedent is `NAV_ITEMS`/`visibleNavItems` (a data array filtered at the boundary, `App.tsx:173`). |
| `drive.cjs --emit-json` | script | file-I/O | The **emitter arm** has a self-analog (`--emit` at `drive.cjs:335-449`, and `region()` at `:74-80` already exists and is unused by it) — but **no sketch in this repo has ever emitted a JSON companion**. 218's `sketchComposition.json` exists as an artifact; its producing code is in sketch 218's `drive.cjs`, which was not read this session. ⭐ The output SHAPE is fixed by `frontend/src/components/library/__generated__/sketchComposition.json`: `{ "<screen>": { "blocks": [ { "kind": string, "heading": string\|null, "atoms": string[] } ], "buttons": string[] } }` — verified by reading its first 900 bytes and by `sketchComposition.test.tsx:194-199`'s type. |

**Partial (role-match, honest about the gap):**

- `SourcesAttentionSection.tsx` — `HealthTab.tsx`'s siblings are the right role and the right
  fetch/skeleton idiom, but I did **not** read `CheckedQueriesSection.tsx` (the closest structural
  twin: a self-fetching section that lifts a count to its parent via `onTotalChange`,
  `HealthTab.tsx:182`). A planner wanting the internal composition should read that file.
- `failure_cause.py` — `preview_service.py` gives the package, the `Literal` table and the
  one-entry-point shape, but it classifies **files**, not **failures**, and has no hard/soft axis.

---

## Corrections to the assignment (measured this session)

| # | The assignment said | Measured |
|---|---|---|
| A-1 | "`HealthTab.tsx` + `IngestionTab.tsx` — the lazy/Suspense sibling-mount idiom" | ⚠ **`IngestionTab` uses NO `lazy`/`Suspense` at all** (static imports throughout, `:220-231`). `HealthTab` uses `lazy` for exactly one chart (`:22-26`); its four section siblings are static. The idiom to copy is **static import + one mount + self-fetch**, not lazy. |
| A-2 | "`src/components/sources` is not a TARGETS directory entry" | ✅ true — **and so are `src/components/library` and `src/components/layout`** (RESEARCH §10.2: only `src/landing` and `src/components/workflows` are directory entries). |
| A-3 | "the `studioSkillId`/`studioTab` threading … `App.tsx:138-151`" | Actual lines are **`App.tsx:146-157`** (state + navigators) and **`:310-315`** (the props). ChatLayout's half is **`:95-100`, `:103`, `:817-822`**, and the edit site is **`:762-763`**. |
| A-4 | CONTEXT: "`run_in_threadpool` … the run-row insert must too" | ⛔ **FALSE for `db/watches.py`** (RESEARCH C-2, re-verified: `import asyncpg` at `:20`, no Supabase, no `run_in_threadpool` anywhere in 439 lines). It remains TRUE for `watch_service.py`'s eight Supabase calls. |
| A-5 | CONTEXT D-235-06: "the insert belongs next to `release_watch`, on both the success and failure arms" | ⛔ **FOUR arms** (RESEARCH C-3, re-verified at `:115`, `:143`, `:434`, `:458`). Fold the write INSIDE `release_watch` so a fifth arm cannot forget. |
| A-6 | BUILD-CONTRACT §2: "Every entry is a `data-block`" | ⛔ Contradicted by the shipped fence at `sketchComposition.test.tsx:38`. Follow `data-testid`; record the deviation (RESEARCH C-9, `VALIDATION.md:136-139`). |
| A-7 | — (not in the assignment) | ⭐ `librarySelection.test.ts:72` `TABS` has **four** members and omits `"health"`, while `LibraryTab` has five. Free coverage for this phase. |

---

## Metadata

**Analog search scope:** `backend/app/{api,db,services,models}`, `backend/tests/unit/{api,db,services}`,
`frontend/src/{components/{sources,library,layout},pages,lib/api}`, `supabase/migrations`,
`scripts/`, `.planning/sketches/233-the-source-says-what-it-did/`.

**Files read in full or in targeted non-overlapping ranges (24):**
`235-CONTEXT.md` · `235-RESEARCH.md` · `235-VALIDATION.md` · `BUILD-CONTRACT.generated.md` (§1-2,
variant-B list, counts) · `drive.cjs:48-88,330-451` · `supabase/migrations/168_connector_watches.sql` ·
`backend/app/db/watches.py` · `backend/app/api/sources.py` · `backend/app/services/watch_service.py:60-209,405-458` ·
`backend/app/services/sources/preview_service.py:40-159` · `backend/app/config.py:1190-1211` ·
`backend/tests/unit/db/test_watches_db.py:1-120` · `backend/tests/unit/api/test_sources_watches_api.py:1-120` ·
`frontend/src/components/library/ingestionErrorVocabulary.ts` ·
`frontend/src/components/library/__tests__/ingestionFailureCopy.test.ts:1-110,190-270` ·
`frontend/src/components/library/__tests__/sketchComposition.test.tsx` ·
`frontend/src/components/library/HealthTab.tsx:1-110` · `IngestionTab.tsx:150-235` ·
`frontend/src/components/sources/WatchedFoldersSection.tsx` · `WatchedFoldersSection.test.tsx:1-100` ·
`frontend/src/components/layout/NavPanel.tsx` · `__tests__/NavPanel.test.tsx:1-95` ·
`frontend/src/components/layout/ChatLayout.tsx:700-880` · `frontend/src/App.tsx:90-327` ·
`frontend/src/pages/LibraryPage.tsx:92-216,690-820` · `frontend/src/pages/librarySelection.ts` ·
`frontend/src/pages/__tests__/librarySelection.test.ts:1-130` · `frontend/src/lib/api/sources.ts` ·
`scripts/vitest-count-gate.cjs:3160-3204,4470-4499`.

**Pattern extraction date:** 2026-09-06
