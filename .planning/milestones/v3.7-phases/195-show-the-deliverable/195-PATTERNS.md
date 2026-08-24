# Phase 195: Show the Deliverable — Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 9 (3 new source, 3 converted source, 1 widened helper, 3 new/edited test artifacts, 1 tooling file)
**Analogs found:** 7 of 9 have a real in-repo analog · **2 are NEW GROUND and are named as such**

> ⚠ **This file answers only the question RESEARCH.md did not: *what shipped code should the
> executor copy?*** It does not restate prop surfaces (`195-RESEARCH.md` § "The five presentations,
> prop by prop"), fences (§ "Test fences this phase will break") or decisions (`195-CONTEXT.md`).
>
> ⚠ **Every recommendation below carries a `file:line` excerpt. Where an expected analog does not
> exist, this file says so instead of naming the nearest unrelated thing** — the Phase-194
> `ActiveRunsTray.test.tsx` lesson (VALIDATION said "extend"; the file did not exist anywhere).

---

## The seven headline findings

| # | Finding | Planning consequence |
|---|---|---|
| **A1** | ⚠ **`components/ui/button.tsx` is the ONLY first-party `asChild` API in the entire frontend.** All ~30 other `asChild` hits are a Radix primitive's own trigger prop (`TooltipTrigger`, `DropdownMenuTrigger`, `CollapsibleTrigger`, `SelectPrimitive.Icon`) — i.e. *consuming* someone else's `asChild`, never *offering* one. `grep 'asChild?: boolean'` → **1 hit**, `button.tsx:39`. | RESEARCH's `asChild` construction is sound (Slot is a dependency, merging verified) but it will be the **second** first-party `asChild` in this tree. Copy the mechanics from `button.tsx:42-53` **verbatim** — `forwardRef`, `const Comp = asChild ? Slot : "div"`, `cn(...)` merge, `displayName`. Do not invent a variant of it. |
| **A2** | **The repo's shipped pattern for "ONE extracted row, N surfaces, per-surface behaviour" is `ingestion/NavRow.tsx` — 4 call sites, and its docblock is written for exactly this phase's situation.** It is a *pure presentational row* extracted **once** from an existing row body (`FolderNode`) so a second surface would *"build from the SAME row — never a clone of the flawed original."* | This is the analog for the SHAPE and the DISCIPLINE (ReactNode slots + callbacks, zero business logic, a docblock that records what debt was fixed *while* extracting). ⚠ **But NavRow hardcodes its root element** (`role="button"`), which 195 structurally cannot do — three pinned a11y contracts. So the construction is **NavRow's prop discipline + `button.tsx`'s `asChild` mechanics**, and each half has a shipped precedent. |
| **A3** | ⚠ **There is NO shared non-primitive component directory in this tree.** All 17 `components/*` dirs are feature/domain-scoped; there are **zero loose files** at `components/` root; `components/ui/` is 16 files, every one a shadcn primitive filename (`button` `card` `dialog` `sheet` `tabs` …) ⇒ reserved. | `components/files/` is **new ground** and is the right call. The evidence that D-06 is a real rule and not taste: `components/panel/PanelSection.tsx` is imported by `components/metadata/DocumentDetailPanel.tsx:—` — a shared primitive living in a feature dir, consumed from another feature. **That is precisely the mis-homing D-06 forbids, and it already happened once here.** |
| **A4** | ⚠ **There is no dominant test-placement convention: THREE spellings coexist** — 141 co-located `*.test.tsx`, 137 under a sibling `__tests__/`, and a central `src/__tests__/` tree of 52 (with its own `components/`, `components/chat/`, `hooks/`, `lib/`, `providers/`, `integration/` subdirs). ⚠ **The closest analog, `NavRow`, uses the THIRD spelling** — `src/__tests__/components/NavRow.test.tsx`. | Convention cannot decide this. **The count gate must.** See § "`scripts/vitest-count-gate.cjs`" — the script's own recorded house rule is **FILE-LEVEL entries, never a bare directory**, which makes the two spellings equivalent to the gate and settles the choice on readability. Recommend `src/components/files/__tests__/` because both downstream documents already name that path. |
| **A5** | ✅ **A comparator with the EXACT same two-regime problem is already shipped, and its comment states the problem in F7's own words** — `panel/PendingAskCard.tsx:608-614`: *"created_at is GET-only; fall back to the array order (store insertion order) when it is absent on the SSE path."* | The analog exists for the SHAPE and for the DOCUMENTATION duty. ⚠ **Its RESOLUTION is the opposite of what D-12 needs** (`return 0` ⇒ insertion order ⇒ appended-last ⇒ newest LAST). Copy the guard structure and the comment discipline; **do not copy the return value.** |
| **A6** | ⚠ **No comparator anywhere in the tree sorts a MISSING key FIRST.** 23 `.sort(` call sites surveyed; the only null-handling found is `indexOf` guards (`ExternalActionSection.tsx:149`, `WorkflowBuilderPage.tsx:1171`), which are not comparators. `PendingAskCard`'s is the only key-absence-aware comparator and it returns `0`. | **D-12's core requirement is NEW GROUND.** Say so in the plan rather than implying a pattern is being followed. P4's `created_at: undefined` arm has **no analog to copy** — only a positive-control shape (A7). |
| **A7** | ✅ **The two-row differing-order positive control P4 requires is shipped** — `PendingAskCard.test.tsx:205-222`. It is the only ordering test in the tree, it uses a **two-row** fixture whose two orders differ, and it asserts DOM order via `getAllByText` index. | Copy it verbatim as P4's positive control. ⚠ **It covers ONLY the both-keys-present arm** — every fixture sets `created_at`. The undefined arm is not merely uncovered here; it is uncovered repo-wide. |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `frontend/src/components/files/FileRow.tsx` **(NEW)** | presentational component | render-only (no fetch, no hook) | `components/ingestion/NavRow.tsx` (shape) + `components/ui/button.tsx:42-53` (`asChild` mechanics) | **hybrid — two exact analogs, one per half** |
| `frontend/src/components/files/fileRowUtils.ts` **(NEW)** | pure utility | transform / dispatch | `formatBytes` hoist from `OutputFileCard.tsx:25-29`; comparator from `panel/PendingAskCard.tsx:608-614`; options shape from `lib/api.ts:3064-3066` | **role-match** (comparator's *resolution* is new ground — A6) |
| `frontend/src/lib/fileIcon.tsx` (widen) | shared render helper | transform | ⚠ **no renderer in `src/lib` takes an options object** — `fileIcon(name, sizePx)`, `phaseGlyph(type)`, `providerLogo(provider)` are all positional/single-arg. Nearest: `lib/api.ts:3066` `opts: {…} = {}` (a data fn) | **partial — NEW GROUND for a renderer** |
| `frontend/src/components/chat/OutputFileCard.tsx` (convert) | component (adapter) | request-response (blob download) | itself, pre-change — a **byte-identical-public-props** refactor. Precedent: `components/admin/revertByteIdentical.test.tsx` (the repo's byte-identity guard idiom) | **exact (self)** |
| `frontend/src/components/panel/FilesSection.tsx` (convert) | component (adapter + section) | CRUD-read + event-driven (SSE flash) | itself, pre-change; its 11 shipped cases are the contract | **exact (self)** |
| `frontend/src/pages/WorkflowRunPage.tsx` (convert) | page (adapter + section) | CRUD-read + request-response | itself, pre-change; `:1041-1086` is the markup being replaced | **exact (self)** |
| `.../files/__tests__/FileRow.test.tsx` **(NEW)** | test (behaviour) | — | `src/__tests__/components/NavRow.test.tsx:1-30` (a shared-row primitive's own suite) | **exact** |
| `.../files/__tests__/FileRow.sweep.test.ts` **(NEW)** | test (source sweep) | — | `components/workflows/library/rowIdentity.test.ts:99-115` — length **+ identity** guards **+ a stripper non-vacuity case** | **exact** |
| `supersedes` characterization (P3) | test (characterization) | — | `src/__tests__/components/MessageItem.finalOutputs.test.tsx:36-48` (fixture builder) + the `.baseline.test.tsx` naming idiom (6 files) | **role-match — see the exported-type gotcha below** |
| `scripts/vitest-count-gate.cjs` | config / tooling | — | its own `TARGETS` entries at `:2158`, `:2176-2193`, `:2389-2392` | **exact** |
| `frontend/src/pages/WorkflowRunPage.test.tsx` (invert F1) | test (fence rewrite) | — | `components/chat/__tests__/StopControl.baseline.test.tsx:513-605` — the 194.1-07 invert-in-place precedent | **exact** |

---

## Pattern Assignments

### 1. `frontend/src/components/files/FileRow.tsx` (NEW — presentational component, render-only)

#### Analog half A — the `asChild` mechanics: `frontend/src/components/ui/button.tsx:36-56`

This is the **only** first-party `asChild` in the tree. Copy it structurally; change only the
fallback element and the class source.

```tsx
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
```

**What to copy:**
- `import { Slot } from "@radix-ui/react-slot"` (`:2`) — the exact specifier already in `package.json`.
- `asChild?: boolean` on the props interface, **default `false`** in the destructure (`:43`).
- `const Comp = asChild ? Slot : "<fallback>"` (`:44`) — one line, no branching JSX.
- `className={cn(...)}` (`:47`) — `cn` is `twMerge(clsx(...))`, `src/lib/utils.ts:4-6`. **This is the
  merge that lets the row own layout classes while a caller adds surface classes**; it is what makes
  the panel's `animate-fileFlash` and the run row's `w-full` composable without the row knowing them.
- `React.forwardRef` + `displayName` (`:42`, `:54`) — the panel stores row elements in a
  `Map<string, HTMLDivElement | null>` for roving focus (`FilesSection.tsx:109`, `:221-223`), so a
  row that swallows the ref **breaks arrow-key navigation**. `forwardRef` is load-bearing, not house style.

**What to change:** the fallback element is `"div"`, not `"button"`; there is **no `cva`** — 195 has
one uniform row (D-10, the 095.1 reversal), so a `cva` variants block would re-introduce the
retired hero/working split as a code shape. `variant` stays a **passthrough `data-variant`** exactly
as `OutputFileCard.tsx:95`/`:151` writes it today.

⚠ **Ref typing.** `button.tsx` pins `HTMLButtonElement`. `FileRow` is handed an `<a>`, a `<div
role="option">` and a `<button>` across the three surfaces, so the generic must be `HTMLElement`.

#### Analog half B — the extraction discipline: `frontend/src/components/ingestion/NavRow.tsx:1-66`

The docblock is the template. Quoted at length because its *reasoning* is what to copy:

```tsx
/**
 * NavRow — the single shared sidebar-row primitive (Phase 114, D-114-13 / sketch 033-A).
 *
 * Extracted ONCE from the old `FolderNode` row body so that BOTH the Folders tree
 * and the Views group (Plan 06) build from the SAME row — never a clone of the
 * flawed original. It is a PURE presentational row: it holds NO recursion and NO
 * folder/view business logic (CRUD, selection wiring, delete-confirm, subfolder
 * create all live in the caller).
 *
 * The verified folder-tree debt is fixed HERE, while extracting:
 *  - a count slot renders on EVERY row (today only Root showed one) — D-114-8/13;
 *  ...
 */
```

and its prop shape — **every prop is a value, a `ReactNode` slot, or a callback; not one is a hook
or an import of a stateful child:**

```tsx
export interface NavRowProps {
  icon: ComponentType<{ className?: string }>
  iconClassName?: string
  name: string
  count?: number
  isSelected?: boolean
  /** Leading slot before the icon (e.g. the expand chevron for folders). */
  leading?: ReactNode
  /** Row action menu (a DropdownMenu trigger + extra buttons). Rendered inside a
   *  reachable wrapper (faint at rest, revealed on hover/focus-within). */
  actions?: ReactNode
  /** Click handler for selecting the row. Ignored while editing. */
  onSelect?: () => void
  ...
}
```

**What to copy:**
- The **"extracted ONCE … never a clone"** framing, and the explicit *"it holds NO business logic —
  X, Y, Z all live in the caller"* sentence. For 195 that list is: **the preview activation, the
  `useViewingThread` read, the download call and the section-level error all live in the caller.**
  ⚠ This sentence is where F2's mechanical constraint gets recorded in the code itself.
- The **"debt fixed HERE, while extracting"** section. 195 has exactly one such item and it must be
  written down or it reads as an accident: **F8's silent dead row on the run page gains the D-08
  *"Download unavailable — this file has no link"* affordance.**
- `ReactNode` slot props for caller-supplied chrome. `trailingSlot` (the panel's Template badge +
  expiry caption, `FilesSection.tsx:246-262`) is the direct counterpart of NavRow's `actions`.

**What to change / REJECT — the SEED-148 challenge:**
> *"Any plan that proposes a new card component should be challenged."*

⚠ **NavRow is a RICHER component than 195 may build, and copying its feature surface would violate
that rule.** NavRow owns inline-rename state (`:84-101`, `:159-201`), two `Tooltip` wrappers
(`:203-224`), a hover/focus-within reveal (`:235-245`) and an indent-guide system (`:105-117`,
`:28-29`). **`FileRow` must own NONE of those.** Its whole body is the four spans already shipped at
`OutputFileCard.tsx:161-184`. Copy NavRow's *discipline*; copy the *markup* from `OutputFileCard`.

⚠ Also reject: building on `components/ui/card.tsx`. It exists, it is a shadcn primitive, and
reaching for it turns an extraction into a new card.

---

### 2. `frontend/src/components/files/fileRowUtils.ts` (NEW — pure utility)

#### `formatBytes` — a HOIST, verified byte-identical at three sites

`frontend/src/components/chat/OutputFileCard.tsx:25-29` is the origin:

```ts
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

`frontend/src/components/panel/FilesSection.tsx:36-42` carries the copy **and its own confession**:

```ts
// Copied verbatim from OutputFileCard.tsx:24-28 (the plan instructs copy, not
// re-derive — the source fn is not exported). Keep byte-for-byte identical.
function formatBytes(bytes: number): string {
```

**What to copy:** the function body, character for character. **What to change:** `export` it, and
**delete that comment along with the copy** — it is the phase's own tombstone and leaving it in a
converted file makes `FilesSection` claim a copy it no longer holds.

#### `baseName` — a hoist from `WorkflowRunPage.tsx:161-163`. Single site; nothing to reconcile.

#### `byNewestFirst` — the comparator: analog `frontend/src/components/panel/PendingAskCard.tsx:608-614`

⚠ **The only key-absence-aware comparator in the tree, and it has F7's exact problem:**

```tsx
  // Newest pinned on top (D-03). created_at is GET-only; fall back to the array
  // order (store insertion order) when it is absent on the SSE path.
  const ordered = [...asks].sort((a, b) => {
    if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at)
    return 0
  })
```

**What to copy:**
- `[...list].sort(...)` — **never a bare `.sort()`**. `canvasModel.ts:368` records why as a rule:
  *"PURE (D-183-12). The input array is never mutated — `[...phases].sort(...)` is the …"*. The
  provider hands out a stable ref (`FilesSection.tsx:12` — *"empty array is a stable ref"*), so an
  in-place sort mutates store state.
- `b.x.localeCompare(a.x)` for a DESC ISO-string sort — the house idiom (`RunHistory.tsx:533`,
  `EvalsTab.tsx:654`, `VersionsTab.tsx:72` all use it).
- The **comment naming the two data regimes explicitly**. This one names GET vs SSE in two lines and
  is the reason F7 was findable at all.

**What to CHANGE — and this is A6, the new ground:**
⚠ `return 0` is **wrong for D-12**. It preserves array order, and `StreamsProvider.tsx:2947-2954`
**appends** a live-SSE file (`[...prev, merged]`), so a stable sort places the just-produced
deliverable **LAST** — the exact inverse of D-12's intent. F7's rule is *missing `created_at` sorts
**FIRST***. **No comparator in this repository does that**; there is nothing to copy for the
resolution, only for the shape. State it as new ground in the plan.

#### `downloadFrom(src, filename)` — the dispatcher

Both seams are already `Promise<void>` throwing one `DownloadError` (RESEARCH § "The two download
seams"). The **error-handling shape to copy** is `OutputFileCard.tsx:127-140`:

```ts
    try {
      await downloadSandboxOutput(file.url!, file.filename)
    } catch (err) {
      // D-067.3-R2-04 status-specific copy; messages already set inside the helper.
      if (err instanceof DownloadError) {
        setDownloadError({ status: err.status, message: err.message })
      } else {
        setDownloadError({ status: "network", message: "Download failed — try again." })
      }
      // Auto-clear after 3s — non-blocking, lightweight feedback (no toast lib in repo).
      setTimeout(() => setDownloadError(null), 3000)
    } finally {
      setDownloading(false)
    }
```

⚠ **`downloadFrom` must NOT own the catch.** The two surfaces surface errors differently and both are
pinned — chat in-row with a 3 s auto-clear (`:136-137`, `:173-175`), the run page section-level with
**no** auto-clear (`WorkflowRunPage.tsx:1088-1092`, `data-testid="run-download-error"`). The util
does the `switch (src.kind)` and re-throws; **the catch stays in each adapter.**

⚠ **`WorkflowRunPage.test.tsx:1450-1455` pins `downloadWorkspaceFile(` at exactly ONE occurrence in
page source.** If the row/util makes that call, page source drops to 0 and the arm REDS. Keep
`onDownload` in the page (RESEARCH's recommendation) or invert that arm too — decide in the plan,
do not discover it.

---

### 3. `frontend/src/lib/fileIcon.tsx` (widen — F10's `tone` / `ribbon`)

⚠ **NEW GROUND for a renderer.** Every shared render helper in `src/lib` is positional or single-arg:

```ts
// src/lib/fileIcon.tsx:80
export function fileIcon(filename: string, sizePx: number = 24): JSX.Element

// src/lib/phaseGlyph.tsx:106
export function phaseGlyph(phaseType: string | undefined): PhaseMark | null

// src/lib/providerLogo.tsx:106
export function providerLogo(provider: string | undefined): ProviderMark | null
```

The only in-repo **default-empty-options** precedent is a data function, `frontend/src/lib/api.ts:3064-3066`:

```ts
export async function resolveView(
  id: string,
  opts: { count_only?: boolean } = {},
): Promise<{ documents?: Document[]; total: number }> {
```

**Recommendation:** `fileIcon(filename, sizePx = 24, opts: { tone?: "category" | "muted"; ribbon?: boolean } = {})`
— a **third positional with a default-`{}` options object**, which keeps `fileIcon(file.filename, 30)`
(`OutputFileCard.tsx:83`) and all 11 cases in `src/lib/__tests__/fileIcon.test.tsx` byte-unchanged.
Do **not** restructure to a single options object: that opens `OutputFileCard`'s call site for a
reason unrelated to the phase.

**What to copy — the split-brain guard idiom from `phaseGlyph.tsx:86-96`:**

```tsx
/**
 * THE SPLIT-BRAIN GUARD'S HANDLE — the mark map's key set, and nothing else.
 * ...Only the KEYS are exported: handing out the map itself would let a caller read a mark
 * without `phaseGlyph()`'s own-property guard...
 */
export const PHASE_GLYPH_MARK_KEYS: readonly string[] = Object.keys(PHASE_GLYPH_MARKS)
```

`fileIcon`'s `EXT_MAP` (`:41-70`) is likewise a plain object literal read as `EXT_MAP[ext] ?? DEFAULT_SPEC`
(`:85`). `phaseGlyph.tsx:107-122` is the recorded scar from exactly that shape:

> *"`PHASE_GLYPH_MARKS` is a plain object literal, so it INHERITS `constructor`, `toString`,
> `__proto__` and friends: `PHASE_GLYPH_MARKS["constructor"]` is the `Object` FUNCTION — never
> nullish, so `?? null` did not fire … A HARD RENDER CRASH of the whole node."*

⚠ **`fileIcon` is safe today only because `ext` is guarded by `hasDot` and `DEFAULT_SPEC` is a
spec object, not a component** — a file literally named `x.constructor` yields
`EXT_MAP["constructor"] === Object`, and `const { color, Glyph } = Object` destructures to
`undefined`/`undefined`, so `<Glyph>` would throw. **Adding an `Object.prototype.hasOwnProperty.call`
guard while this file is open is a ~2-line hardening with a shipped precedent and a recorded
crash behind it.** Optional, but name the choice rather than leaving it unexamined.

**What to change in the docblock:** `:21` reads *"NOT yet consumed — OutputFileCard imports this in
Plan 05."* That is stale (it has one consumer) and becomes wronger (four surfaces). Correct it
**beside** the original per the project rule.

---

### 4. `frontend/src/components/chat/OutputFileCard.tsx` (CONVERT — public props byte-identical)

**Analog: itself, pre-change.** The public prop shape at `:39-64` is the contract; F6 says both call
sites (`MessageItem.tsx:158`, `chat/tool-bodies/ExecuteCodeBody.tsx:358`) must stay unopened.

⚠ **GOTCHA the plan must carry: `OutputFileCardProps` is NOT exported.**

```ts
// frontend/src/components/chat/OutputFileCard.tsx:39
interface OutputFileCardProps {
```

Consequences: (a) P7(b)'s "prop-set fence" must be a **source** assertion over
`OutputFileCard.tsx?raw`, since no type is importable to pin; (b) a direct-render characterization
test must build the file object as an inline literal — there is no `OutputFileCardProps` to import;
(c) **exporting it is itself a public-surface change** and should be a recorded decision, not a
side effect of writing a test.

**What to copy into `FileRow`, verbatim:** the four-span body at `:161-184` and the dead branch's
`<span aria-disabled>` at `:107-117`. ⚠ The dead affordance being a **`<span>` and not a
`<button>`** is what keeps `WorkflowRunPage.test.tsx:991`'s `toHaveLength(0)` green after unification
(F8). Copy the element, not just the copy text.

**What to change:** nothing about behaviour. **Not the inert `variant`** (`:58-63`), **not the
unread `is_hero`** (`:52-56`), **not the `resolveOutputUrl` env read** (`:8-23` — if it moves, the
docblock's *"Lives alongside OutputFileCard because this is the only site that resolves
OutputFile.url"* moves with it and must be corrected, and RESEARCH's Runtime-State table confirms
`VITE_API_BASE_URL` is the same var with no `.env` or `onebox` edit owed).

---

### 5. `frontend/src/components/panel/FilesSection.tsx` (CONVERT)

**Analog: itself, pre-change**, guarded by 11 shipped cases.

**Stays in the section — this is the F2 boundary in concrete terms:**
`useViewingThread()` + `useWorkspaceFiles()` (`:103-104`), the `role="listbox"` wrapper (`:212`),
`rowRefs` + roving `tabIndex` + `onKeyDown` arrows (`:109`, `:164-188`, `:221-229`), `openFile` →
`setSelected` → the `<FilePreview>` full-replace (`:148-153`, `:191-193`), the fresh-write flash
(`:113-139`, `:234`), `<TemplateUpload/>` (`:203`, `:211`), and the Template badge + expiry caption
(`:246-262` → becomes the row's `trailingSlot`).

**Deleted and replaced by the shared path:** the copied `formatBytes` (`:36-42`) and the inline
`iconFor` (`:44-71`).

⚠ **`iconFor` is NOT a pure subset of `fileIcon` — it is MIME-first, and `fileIcon` is
extension-only.** `FilesSection.tsx:52-71` branches on `file.mime_type` for the three OOXML
constants, `text/markdown`, `text/csv`, `image/*`, `text/x-*`, `application/json` and a bare
`text/` fallthrough, with a 14-entry `codeExts` list. `fileIcon` (`:80-88`) reads the extension
only. **The 20-key `EXT_MAP` does not cover `sh` `bash` `sql` `yml` `yaml` `css` `jsx` `mjs`** —
each of which today resolves to `FileCode` in the panel and would fall to `DEFAULT_SPEC`/`FileText`
under `fileIcon`. This is a real behaviour delta on the panel, it is invisible to all 11 existing
cases (they test docx/pptx/xlsx only), and the plan must either extend `EXT_MAP` or record the
regression knowingly. **Do not assume "one icon path" is a no-op here.**

---

### 6. `frontend/src/pages/WorkflowRunPage.tsx` (CONVERT — the `run-deliverables` region)

**Analog: itself, pre-change** — `:1041-1086` is the markup the row replaces, and it is already
two-armed exactly as `FileRow`'s `trailing` prop needs:

```tsx
          <ul role="list" className="mt-2 flex flex-col gap-0.5">
            {files.map((file) => {
              const Icon = iconFor(file)
              const name = baseName(file.path)
              const size = formatBytes(file.size_bytes)
              const fileId = file.id
              return (
                <li key={fileId ?? file.path}>
                  {fileId ? (
                    <button
                      type="button"
                      onClick={() => onDownload(file)}
                      title={file.path}
                      aria-label={`Download ${name} (${size})`}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
```

**Stays in the page:** the `<h2>` + `COPY_DELIVERABLE_HEADING` (`:1029`), the three-way empty state
(`:1030-1039` — D-15, and `:1489-1490` pins each copy at exactly one occurrence in page source), the
`<ul role="list">`/`<li>` (`:968-971`), `onDownload`, and the section-level error (`:1088-1092`).

**Becomes the shared row:** the `<button>`/`<div>` bodies at `:1057-1064` and `:1074-1080`, plus the
`iconFor`/`formatBytes`/`baseName` locals.

⚠ **The docblock rule, from four separately-pinned RAW predicates.** A comment in this file
explaining the extraction **must not write the tokens** `FilesSection`, `FilePreview`,
`useViewingThread` or `<StopControl`. Name them in WORDS. The precedent for that discipline is
already in this codebase and is stated as a rule at
`components/workflows/library/rowIdentity.test.ts:89-98`:

```
 * ⚠ SOURCE FENCES ARE VERIFIED OVER NON-COMMENT CODE LINES, AND THAT IS THIS REPOSITORY'S OWN
 * RECORDED RESOLUTION RATHER THAN A CONVENIENCE. The 187-24 trap: a module that DOCUMENTS why a
 * symbol is absent reds a raw grep for it. It fired here on its **sixth** recorded instance...
```

⚠ Note the asymmetry the executor must hold: the four predicates above are **RAW**, so the WORDS
rule applies. `:1467-1468` is `codeOf(...)`, so it is *comment-blind*.

---

### 7. `.../files/__tests__/FileRow.sweep.test.ts` (NEW — P6's source sweep)

#### The `?raw` guard template — `components/workflows/library/rowIdentity.test.ts:99-115`

**This is the best example in the tree and it is the one that exists BECAUSE of the 192.1 finding.**
Quote it verbatim as P6's opening two cases:

```ts
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("the module's own source keeps the promises no test can see", () => {
  it("is really the file under test (non-vacuity)", () => {
    expect(source.length).toBeGreaterThan(2000)
    expect(source).toContain("export function buildIdentityIndex")
    expect(source).toContain("export function resolveIdentity")
  })

  it("the comment stripper leaves the CODE and removes the PROSE (non-vacuity)", () => {
    // Without this, every fence below could pass by stripping the whole file.
    expect(code.length).toBeGreaterThan(1500)
    expect(code).toContain("export function buildIdentityIndex")
    expect(code).toContain("export function resolveIdentity")
    expect(source).toContain("D-31")
    expect(code).not.toContain("D-31")
  })
```

**Three things to copy, each load-bearing:**
1. **Length AND identity** — `toBeGreaterThan(N)` *plus* `toContain("<unique export>")`. VALIDATION's
   P6 asks for exactly this; here is the shipped shape. A second, equally direct excerpt is
   `StopControl.baseline.test.tsx:575-582` with its inline reason: *"Identity, not just size: a
   non-empty sweep of the WRONG file is the same bug."*
2. **A stripper non-vacuity case** — the second `it()`. ⚠ **P6 as written in VALIDATION does not
   name this and it is the arm most likely to make P6 itself inert:** if `codeOf()` mis-strips and
   returns `""`, every `not.toMatch` in P6 passes. The `expect(source).toContain("D-31")` /
   `expect(code).not.toContain("D-31")` pair — a token that exists in prose only — is how the
   stripper is proved to strip. **Recommend adding it as a 27th plant.**
3. **Four `?raw` imports each guarded independently.** P6 sweeps four files; `rowIdentity` guards
   one. The multi-source precedent is `pages/__tests__/PublishedCardDelete.test.tsx:692-693` +
   `:728` (three separate `.length` guards) and `library/librarySubtree.fences.test.ts:164-184`,
   whose comment is the 192.1 incident itself: *"a module renamed, moved into a subdirectory or given
   a new extension was swept against the EMPTY STRING and passed green, one sweep at a time,
   silently … a fence that cannot fire."*

#### `codeOf()` — the definition to copy, and ⚠ THERE ARE TWO INCOMPATIBLE VERSIONS

The one P6 must use — `frontend/src/pages/WorkflowRunPage.test.tsx:1052-1063`, with its own
self-proving case:

```ts
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("WorkflowRunPage — source fence", () => {
  it("the comment stripper actually strips (the fences below depend on it)", () => {
    const sample = "/** runReadingLabel( in prose */\n// runReadingLabel( in a line\nconst x = 1\n"
    expect(codeOf(sample)).not.toMatch(/runReadingLabel\(/)
    expect(codeOf(sample)).toMatch(/const x = 1/)
    // ...and the page really does carry the token in prose, which is why this exists.
    expect(pageSource).toMatch(/runReadingLabel\(/)
  })
```

Identical body at `components/panel/__tests__/WorkspacePanel.test.tsx:1247-1249`. ⚠ **But
`components/layout/ChatLayout.launch.test.tsx:458-460` is DIFFERENT and must not be copied:**

```ts
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
}
```

Its second replace is **unanchored**, so it eats from any `//` to end of line — including the `//`
inside a string literal such as `"https://…"` or a path. P6 sweeps `OutputFileCard.tsx`, which
carries `"/sandbox-outputs/…"`-shaped strings and a `url.startsWith("/")` branch, and
`fileIcon.tsx`. **Use the line-anchored form (`/^\s*\/\/.*$/gm`) — 2 of 3 shipped copies, and the
only one safe over URL-bearing source.** No `codeOf` is exported anywhere; a fourth local copy is
the established practice, not a smell.

---

### 8. `supersedes` characterization (P3 — a state with ZERO coverage repo-wide)

#### The naming idiom: `*.baseline.test.tsx` — six shipped files

```
src/__tests__/components/chat/MessageList.runline.baseline.test.tsx
src/__tests__/providers/StreamsProvider.stopping.baseline.test.ts
src/components/chat/__tests__/StopControl.baseline.test.tsx
src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx
```

**This is the repo's word for "written to pin current behaviour before a refactor."** Name P3's
artifact `<X>.baseline.test.tsx` so a later reader knows what it is for without reading it.

#### The fixture builder for an optional/relaxed prop set — `src/__tests__/components/MessageItem.finalOutputs.test.tsx:30-48`

```tsx
const NOW = new Date().toISOString()

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "",
    created_at: NOW,
    updated_at: NOW,
    tool_calls: [],
    ...overrides,
  } as Message
}
```

then per-case, the optional field is supplied **inline with a `Partial<Message>` cast** —
`{ filename: "legacy.png" }` (no `url`) at `:112-116`, `{ filename: "report.docx", url: …, is_hero: true }`
at `:86`.

**What to copy:** `make…(overrides: Partial<T> = {}): T` + `...overrides` + the `as T` escape; the
`renderWithTooltip` wrapper (**required** — `NavRow.test.tsx:15-17` uses the identical helper, and
anything rendering a Radix `Tooltip` without a `TooltipProvider` throws); and the two-sided case
discipline visible at `:111-125` — assert the affordance **and** its copy:

```tsx
    expect(container.querySelector("[data-dead='true']")).not.toBeNull()
    expect(screen.getByText("Download unavailable")).toBeTruthy()
```

⚠ that is precisely the pair P2 says short-circuits, which is why P2 needs **two** plants.

**What to CHANGE — three concrete gotchas:**
1. ⚠ **This suite renders through `MessageItem`, not `OutputFileCard`** (`:57`). It is an *indirect*
   harness. **No `OutputFileCard.test.tsx` exists anywhere in the tree** (confirms F5). For P3(b) —
   the `supersedes` block in the **dead** branch at `OutputFileCard.tsx:101-105` — a fixture must
   omit `url` **and** set `supersedes`, which no shipped fixture does.
2. ⚠ Check `Message["finalOutputFiles"]`'s declared element type carries `supersedes` before writing
   the fixture. `OutputFileCard`'s relaxed local shape (`:39-57`) is deliberately looser than
   `@/types`' strict `OutputFile` (see `:31-38`), so an inline literal that typechecks through
   `OutputFileCard` may not typecheck through `Message`. **Measure it; `tsc` must stay at 33.**
3. ⚠ Placement is a live choice with a gate consequence: this file is **UNGATED**
   (`src/__tests__/` has no `TARGETS` entry). RESEARCH offers both doors — extend it and adopt it,
   or cover the states through `FileRow` in the dir the phase already owes an entry for. Either is
   defensible; **an unrecorded choice is not.**

#### The invert-in-place precedent (F1) — `components/chat/__tests__/StopControl.baseline.test.tsx:513-605`

Copy this structure exactly for `WorkflowRunPage.test.tsx:1467-1468`. The header:

```
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-07 — mount 4: WorkflowRunPage NOW HAS the Stop control (R3, the inversion)", () => {
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ⚠ SUPERSEDED IN PLACE BY PHASE 194.1 PLAN 07 — THE ORIGINAL IS QUOTED, NOT
   *   DELETED, because a capture that is deleted the moment it inverts leaves no
   *   record that the absence was ever real (193.2 WR-05).
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Plan 01 authored this block as an ABSENCE, with the describe title
   * *"194.1-01 — mount 4: WorkflowRunPage has NO Stop control (the R3 absence)"*
   * and these three cases, verbatim:
   *
   *     it("the swept source is non-empty and is the right file", () => {
   ...
```

and the positive control that must accompany any count assertion:

```tsx
  it("the same regex counts a SECOND mount when one is planted (positive control)", () => {
    const planted = `${runPageSource as string}\n// <StopControl threadId={null} variant="page" />`
    expect((planted.match(/<StopControl/g) ?? []).length).toBe(2)
  })
```

**Copy:** the ⚠ SUPERSEDED banner, the verbatim quotation of the retired assertions, the
*"…and only one of them was this plan's doing"* separation of causes, and a **planted positive
control string-concatenated onto the source** — which is how a `toBe(1)` is proved to be able to
read 2. ⚠ **The lesson embedded at `:560-573` is a direct warning to 195: do NOT reintroduce a line
or character pin.** *"A pin in an ungated suite is a pin nothing checks."*

---

### 9. `scripts/vitest-count-gate.cjs` (TWO knobs, ONE commit)

#### `BASELINE` — a flat object keyed by **BARE filename**

```js
// ── The pin. Keyed by BARE filename (testResults[].name is an absolute path). ──
const BASELINE = {
  ...
  "definitionOps.test.ts": 243,
  "canvasModel.fixtures.test.ts": 100,
```

the Phase-195 entry that already exists — `scripts/vitest-count-gate.cjs:919`:

```js
  "WorkflowRunPage.test.tsx": 102,
```

and the derived total, `:2113`:

```js
const BASELINE_TOTAL = Object.values(BASELINE).reduce((a, b) => a + b, 0)
```

⚠ **Bare filename ⇒ the key space is GLOBAL.** `FileRow.test.tsx` must be unique across the whole
tree, or two suites collide silently on one pin.

#### `TARGETS` — an array of paths, `:2116`

```js
// ── The Wave-0 blast radius (184-VALIDATION.md § "quick run command"). ──
const TARGETS = [
  "src/components/workflows",
  "src/pages/WorkflowBuilderPage.test.tsx",
  ...
```

**What a new entry looks like — copy the `:2158` / `:2176-2193` shape:** a comment block naming
(1) the plan that added it, (2) that it lands in the **same commit** as the file, (3) *what would be
unguarded without it*, and (4) whether it is file-level or directory-level and why. Then one string.

The rule, stated by the script itself at `:2194-2206`:

```
  //   TARGETS decides what RUNS. BASELINE decides what is PINNED. They are two knobs and
  //   a file can land outside BOTH by default...
  //
  // And the timing is not cosmetic: an entry pointing at a path that does not exist yet
  // makes the gate ERROR (exit 2), not fail — so it can only be added in the commit that
  // creates the file, never before, never after.
```

restated at `:2370-2373` with the mitigation:

```
  // ⚠ TIMING: all four files EXIST at this commit (confirmed with `ls` before the entries
  // were written), so they are adopted here rather than in a later commit.
```

**File-level, not directory-level — the script's own recorded house rule** (`:2168-2175`,
`:2187-2189`, `:2379-2384`), and note that it names `FilesSection` **by name**:

```
  // FILE-LEVEL, deliberately NOT the bare directory `src/components/panel/__tests__`. The
  // directory holds 12 suites; measured under plain vitest on 2026-08-05 it is
  // `12 passed (12) / 144 passed (144)` — i.e. 0 failing, so the directory form WOULD have
  // been admissible. It is still not taken: the gate requires 0 failing forever, and adopting
  // ten suites nobody in this phase reads makes this phase the owner of their future rot. A
  // later phase that wants CsvTablePreview / FilePreview / FilesSection / PendingAskCard /
  // Seam / TodosSection / VersionDiff / WorkspacePanel{,.derived} inside the gate should adopt
  // them deliberately, with its own measured number.
```

⇒ **Phase 195 IS that later phase for `FilesSection`.** VALIDATION's Wave-0 "gate adoption decision"
item is answered by the script's own text: adopt `src/components/panel/__tests__/FilesSection.test.tsx`
**file-level with its own measured number**, or decline **with a recorded reason**.

**Recommendation, following the house rule (⇒ A4 is settled by the gate, not by convention):**
two **file-level** entries, both in the commit that creates the files —
`src/components/files/__tests__/FileRow.test.tsx` and
`src/components/files/__tests__/FileRow.sweep.test.ts`. **Not** the bare directory
`src/components/files`: it would silently adopt every future suite in the phase's own new directory,
which is the exact ownership trap the script argues against three times. And read every BASELINE
number **from the printed `actual` column across two agreeing runs** (P10).

---

## Shared Patterns

### `cn()` — the ONE class merge
**Source:** `frontend/src/lib/utils.ts:4-6`
**Apply to:** every new component and every converted row
```ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
`twMerge` is what makes a caller-supplied `className` *override* rather than *append*, which is the
whole basis of the `asChild` construction. Already used by all three files in play
(`OutputFileCard.tsx:4`, `FilesSection.tsx:27`, `NavRow.tsx:3`).

### `TooltipProvider` in every render helper
**Source:** `src/__tests__/components/NavRow.test.tsx:15-17` ≡ `MessageItem.finalOutputs.test.tsx:32-34`
```tsx
function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}
```
Two independent suites converged on the identical helper. Any `FileRow` test whose `trailingSlot`
carries a tooltip needs it.

### The `[...list].sort()` purity rule
**Source:** `components/workflows/canvasModel.ts:368` (the rule) + 12 shipped call sites
**Apply to:** `byNewestFirst`'s consumer. Never `.sort()` on a provider-owned array.

### The correction-beside-the-original rule, in CODE not just in planning docs
**Sources:** `phaseGlyph.tsx:107-119` (*"⚠ THIS LINE'S COMMENT USED TO READ …"*),
`StopControl.baseline.test.tsx:517-520`, `rowIdentity.test.ts:89-98`
**Apply to:** `fileIcon.tsx:21`'s stale *"NOT yet consumed"*; `FilesSection.tsx:36-37`'s
copied-`formatBytes` tombstone; `WorkflowRunPage.tsx`'s deliverable-region docblock; the F1 fence.
This is a house pattern with three shipped instances, not a planning-document convention.

### Positive controls on every absence / count assertion
**Sources:** `StopControl.baseline.test.tsx:602-605`, `rowIdentity.test.ts:120-124`,
`WorkflowRunPage.test.tsx:1057-1063`
**Apply to:** P4 (a one-row fixture passes forever), P5's word-level sweep, P6's four sweep arms.

---

## No Analog Found — expected patterns that are ABSENT

| Expected | Reality | What the planner should do |
|---|---|---|
| A first-party `asChild` component outside `ui/` | ⚠ **ABSENT.** `grep 'asChild?: boolean'` → **1 hit**, `components/ui/button.tsx:39`. Every other `asChild` in the tree is consuming a Radix trigger. | Copy `button.tsx:42-53` verbatim and **state in the plan that this is the tree's second first-party `asChild`**, so a reviewer does not read it as a house idiom being followed. |
| A shared non-primitive component directory | ⚠ **ABSENT.** 17 dirs, all feature/domain-scoped; zero loose files at `components/` root; `ui/` is 16 shadcn primitives. | `components/files/` is new ground and correct. Cite `panel/PanelSection.tsx` → `metadata/DocumentDetailPanel.tsx` as the shipped instance of the mis-homing D-06 forbids. |
| A comparator that sorts a MISSING key FIRST | ⚠ **ABSENT — the phase's one genuinely new algorithm.** 23 `.sort(` sites surveyed. `PendingAskCard.tsx:608-614` is the only key-absence-aware comparator and returns `0` (⇒ insertion order ⇒ appended-last ⇒ **newest last**). | Write it as new ground. Copy `PendingAskCard`'s guard shape and its two-regime comment; do **not** copy `return 0`. |
| A test covering a comparator's undefined-key arm | ⚠ **ABSENT.** `PendingAskCard.test.tsx:205-222` is the tree's only ordering test and every fixture sets `created_at`. | P4(c) has no template. Copy `:209-219`'s two-row differing-order positive control and author the undefined arm fresh. |
| An `OutputFileCard.test.tsx` | ⚠ **ABSENT anywhere in the tree** — confirms F5. Its only coverage is indirect, through `MessageItem.finalOutputs.test.tsx`. | P3 authors the first direct coverage. ⚠ And `OutputFileCardProps` is **not exported** (`:39`), so a prop-set fence must be a source sweep. |
| A `?raw` sweep over `OutputFileCard.tsx`, `FilesSection.tsx` or `fileIcon.tsx` | ⚠ **ABSENT** — confirms RESEARCH R2. Only `WorkflowRunPage.tsx` among the four in-scope source files is swept. | P6 creates the first. Its guards are therefore the only thing standing between the sweep and vacuity. |
| An options-object param on a shared *render* helper | ⚠ **ABSENT.** `fileIcon`, `phaseGlyph`, `providerLogo` are all positional/single-arg. Nearest precedent is a data function, `lib/api.ts:3066`. | Adopt `opts: {…} = {}` as a **third positional with a default**, so every existing `fileIcon(name, 30)` call site stays byte-unchanged. |
| A dominant test-placement convention | ⚠ **ABSENT — three spellings, roughly balanced** (141 co-located / 137 `__tests__/` / 52 central `src/__tests__/`). The closest analog uses the third. | Do not argue from convention. Argue from the gate: **file-level `TARGETS` entries** make the spellings equivalent, so pick `src/components/files/__tests__/` to match the two documents downstream agents already read. |

---

## The SEED-148 challenge, applied

> *"Any plan that proposes a new card component should be challenged."*

**One analog actively tempts toward a richer component, and it is rejected here so a plan does not
have to re-litigate it.** `NavRow.tsx` is the right *shape* analog and the wrong *scope* analog: it
owns inline-rename state, two tooltips, a hover/focus-within reveal and an indent-guide system — 249
lines for a sidebar row. `FileRow`'s entire body is the four spans already shipped at
`OutputFileCard.tsx:161-184`. **Copy NavRow's discipline (pure, slots, callbacks, a docblock that
records the debt fixed while extracting); copy `OutputFileCard`'s markup.** Building on
`components/ui/card.tsx` is likewise rejected: it exists, and reaching for it converts an extraction
into a new card.

**SC#2 accounting, in analog terms:** ONE `formatBytes` (hoisted from `OutputFileCard.tsx:25-29`,
deleting `FilesSection.tsx:36-42`'s self-confessed copy and `WorkflowRunPage.tsx:154-158`), ONE icon
path (`lib/fileIcon.tsx` widened `opts`-style, deleting `FilesSection.tsx:44-71` and
`WorkflowRunPage.tsx:170-188` — ⚠ **with the MIME-vs-extension delta above measured, not assumed**),
ONE row markup (`FileRow.tsx`, `asChild` per `button.tsx`), ONE download dispatcher. Three wrapper
elements survive deliberately: three a11y contracts, each pinned.

---

## Metadata

**Analog search scope:** `frontend/src/` (all 17 `components/*` dirs, `lib/`, `pages/`, `providers/`,
`hooks/`, all four test-placement spellings), `scripts/vitest-count-gate.cjs`.
**Measurements run this session:** `asChild`/`Slot` sweep (56 hits, 1 first-party); `components/`
directory survey (17 dirs, 0 loose files, `ui/` = 16 shadcn primitives); test-placement counts
(141 / 137 / 52); `.sort(` survey (23 non-test sites); `*baseline*` / `*byteIdentical*` file list
(6); `codeOf` definitions (3, **two incompatible regexes**); `.length).toBeGreaterThan` sweep
(56 hits); cross-directory `components/panel/*` imports (8); `src/components/files` existence
(**absent**).
**Files read in full:** `ui/button.tsx`, `lib/utils.ts`, `ingestion/NavRow.tsx`, `lib/fileIcon.tsx`,
`lib/phaseGlyph.tsx`, `panel/FilesSection.tsx`, `chat/OutputFileCard.tsx`,
`__tests__/components/MessageItem.finalOutputs.test.tsx`.
**Files read in targeted ranges:** `WorkflowRunPage.tsx:1015-1100`, `WorkflowRunPage.test.tsx:1052-1063`,
`StopControl.baseline.test.tsx:505-615`, `rowIdentity.test.ts:1-40` + `:85-124`,
`librarySubtree.fences.test.ts:150-210`, `ChatLayout.launch.test.tsx:458-472`,
`PendingAskCard.tsx:595-640`, `PendingAskCard.test.tsx:203-230`, `NavRow.test.tsx:1-30`,
`lib/api.ts:3055-3080`, `vitest-count-gate.cjs:100-170` + `:2100-2220` + `:2360-2400`.

*Phase: 195 — Show the Deliverable · Pattern mapping: 2026-08-17*
