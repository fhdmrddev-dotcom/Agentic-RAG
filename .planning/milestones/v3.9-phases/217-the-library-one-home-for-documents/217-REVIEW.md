---
phase: 217-the-library-one-home-for-documents
reviewed: 2026-08-29T06:52:15Z
depth: standard
diff_base: 9a3808697
files_reviewed: 26
files_reviewed_list:
  - backend/app/api/document_queries.py
  - backend/app/api/documents.py
  - backend/app/api/kb.py
  - backend/app/main.py
  - backend/app/models/document.py
  - backend/app/services/multimodal_service.py
  - frontend/src/components/ingestion/acceptedFormats.ts
  - frontend/src/components/ingestion/DocumentUpload.tsx
  - frontend/src/components/ingestion/ingestionStages.ts
  - frontend/src/components/ingestion/IngestionStrip.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/library/IndexingTab.tsx
  - frontend/src/components/library/IngestionTab.tsx
  - frontend/src/components/library/ViewsTab.tsx
  - frontend/src/components/metadata/DocumentChunksSection.tsx
  - frontend/src/components/metadata/DocumentContentSection.tsx
  - frontend/src/components/metadata/DocumentImagesSection.tsx
  - frontend/src/components/metadata/DocumentQueriesSection.tsx
  - frontend/src/components/metadata/DocumentTablesSection.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/components/panel/CsvTablePreview.tsx
  - frontend/src/components/panel/DataTableView.tsx
  - frontend/src/components/ui/tabs.tsx
  - frontend/src/hooks/useDocuments.ts
  - frontend/src/index.css
  - frontend/tailwind.config.js
  - frontend/src/lib/api.ts
  - frontend/src/lib/api/documents.ts
  - frontend/src/lib/nav-items.ts
  - frontend/src/pages/LibraryPage.tsx
  - frontend/src/pages/librarySelection.ts
  - frontend/src/types/index.ts
  - scripts/vitest-count-gate.cjs
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: issues_found
---

# Phase 217: Code Review Report

**Reviewed:** 2026-08-29T06:52:15Z
**Depth:** standard (per-file, language-aware, against `git diff 9a3808697..HEAD`)
**Files Reviewed:** 26 non-test source files (+ the count-gate script and the new backend/frontend suites read for what they assert)
**Status:** issues_found

## Summary

The security posture of the phase's highest-risk surface holds up under attack. I traced
`document_queries.py`'s owner gate end-to-end: `.eq("user_id", user_id)` is the first filter,
`user_id` comes only from `get_current_user`, and the attacker-controlled `document_id` reaches
PostgREST through `contains()` → `json.dumps()` → `httpx.QueryParams` (verified in
`backend/venv/Lib/site-packages/postgrest/base_request_builder.py:465-477`), so it is JSON-escaped
and URL-encoded and cannot break out of the `cs.` filter grammar. A crafted or foreign
`document_id` yields `[]`. The four new detail routes in `documents.py` are user-JWT + RLS and
404-before-read through one shared gate, with no 404/200 existence asymmetry. Every surface that
renders untrusted content (`DataTableView`, `DocumentContentSection`, `DocumentChunksSection`,
`DocumentImagesSection`, `DocumentQueriesSection`) uses React text children — no
`dangerouslySetInnerHTML`, no `innerHTML`, no unsanitized URL, no `<img>` on model-authored text.
`CONTENT_MAX_LINES` does bound an explicitly requested span, not just the default.

What did not hold up is the state machine around those reads. One defect is a shipped, permanent
user-facing lie (CR-01: three of the five new count badges are never reset when the panel switches
documents). Beyond that, the five sections share a stale-response race the docblocks explicitly
claim to prevent, the new Indexing tab exposes an operators-only capability to every user, the
shared `ui/tabs.tsx` primitive now has an active-state ring that collides with its own focus ring
on three surfaces, and `/chunks` / `/tables` / `/images` shipped with no bound at all while
`/content` was carefully capped.

Excluded from scope per the brief: `cronPlain*`, `GovernanceSection*`, `WorkflowScheduleModal.tsx`,
`definitionOps.ts`, `PhaseFormPanel.test.tsx`. The four already-recorded items (the
`application/vnd.ms-excel` CSV routing, the `documents.py:559` fifteen-vs-fourteen comment, the 16
owed UAT rows, the 33 pre-existing `tsc` errors) are not re-reported — I checked the CSV one and
found it no worse than described.

---

## Critical Issues

### CR-01: Switching documents leaves three count badges showing the PREVIOUS document's numbers, permanently

**File:** `frontend/src/components/metadata/DocumentDetailPanel.tsx:185-190`

**Issue:** The panel is not remounted when the user picks another document — `LibraryPage.tsx:474`
renders `<DocumentDetailPanel doc={selectedDoc} …/>` with no `key`, so only the `doc` prop changes.
That is exactly why the file carries a per-`doc.id` reset effect. Plan 10 wrote it for the two
sections it added; plan 11 added three more sections (lines 343, 347, 351) and did not extend it:

```ts
useEffect(() => {
  setRelTotal(null)
  setClassCount(null)
  setContentLines(null)
  setChunkTotal(null)     // ← stops here
}, [doc.id])
```

`tableTotal`, `imageTotal` and `queryTotal` (declared at `:154-156`) survive the document switch.

Concrete failure, all in-product state:

1. Open document A. Expand **Tables** — `DocumentTablesSection` loads and calls
   `onTotalChange(3)`, so `PanelSection` badges `3`.
2. Collapse the accordion. `PanelSection.tsx:94` renders children only when open, so
   `DocumentTablesSection` unmounts. `tableTotal` stays `3` in the parent.
3. Click document B in the list — a `.txt` with no tables.
4. The **Tables** header still reads `3`. Nothing will ever correct it: the section is closed, so
   it never remounts and never fetches. Same for **Images** and **Found by**.

A second path reaches the same lie even with the section open: if the refetch for document B fails,
`onTotalChange` is never called (`DocumentTablesSection.tsx:96-100` sets `state = "error"` only), so
document A's count stays on document B's header beside an error message.

This contradicts the panel's own stated contract at `:149-151` — *"`null` = never loaded → no badge,
which is the honest state for a lazy section"* — and is the class of defect (`a user-facing lie
3176 passing tests could not see`) this project treats as blocking. `DetailSections.lazy.test.tsx`'s
doc-switch case covers only the OPEN-section refetch, so nothing red.

**Fix:**
```ts
useEffect(() => {
  setRelTotal(null)
  setClassCount(null)
  setContentLines(null)
  setChunkTotal(null)
  setTableTotal(null)
  setImageTotal(null)
  setQueryTotal(null)
}, [doc.id])
```
Add a case that opens Tables on doc A, **collapses it**, rerenders with doc B, and asserts the
`Tables` header carries no count — the existing test cannot catch this because it never collapses.

---

## Warnings

### WR-01: All five detail sections have an unguarded stale-response race — the docblocks claim it is prevented

**File:** `frontend/src/components/metadata/DocumentContentSection.tsx:79-97` ·
`DocumentChunksSection.tsx:51-66` · `DocumentTablesSection.tsx:87-102` ·
`DocumentImagesSection.tsx:69-82` · `DocumentQueriesSection.tsx:95-108`

**Issue:** Each `load` is a `useCallback` keyed on `docId` driven by `useEffect(() => void load(), [load])`,
and every one writes its result unconditionally:

```ts
const res = await listDocumentChunks(docId)
setRows(res); setState("ready"); onTotalChange?.(res.length)
```

There is no generation counter, no `AbortController`, and no unmount guard. Because the component
is not remounted on a document switch (see CR-01), a slow request for document A resolves *after*
the request for document B and overwrites it: document A's chunks/tables/text render under document
B's filename, and the parent badge is set to A's count.

`DocumentChunksSection.tsx:48-49` states the opposite — *"Keyed on `docId` — switching documents
re-reads rather than leaving the previous document's chunks under a new filename"* — and
`DocumentContentSection.tsx:76-77` makes the same claim. Keying re-*issues* the read; it does not
order the *writes*. `DetailSections.lazy.test.tsx:369` cannot detect this: both mocks are
`mockResolvedValue`, so responses always settle in request order.

`LibraryPage.tsx:277-303` already has the correct idiom for this in `resolveFilterIntoList`
(`filterReqId` ref + `if (myReq === filterReqId.current)`).

**Fix:** in each section,
```ts
const reqId = useRef(0)
const load = useCallback(async () => {
  const mine = ++reqId.current
  setState("loading"); setRows([])
  try {
    const res = await listDocumentChunks(docId)
    if (mine !== reqId.current) return
    setRows(res); setState("ready"); onTotalChange?.(res.length)
  } catch {
    if (mine === reqId.current) setState("error")
  }
}, [docId, onTotalChange])
```
Drive it RED with `mockImplementationOnce` returning a promise resolved on a later tick than the
second call.

---

### WR-02: The new Indexing tab is ungated, but its only data source is operators-only — every non-operator gets a permanently broken tab

**File:** `frontend/src/pages/LibraryPage.tsx:611` (the trigger) and `:697-702` (the body) ·
`frontend/src/components/library/IndexingTab.tsx:55-64`

**Issue:** `IndexingTab` calls `getReembedProgress()` and mounts `ReembedStatusCard`. Both hit
`GET /settings/reembed-progress`, which is declared
`dependencies=[Depends(require_visible("model_management"))]` (`backend/app/api/settings.py:560`),
and `model_management` defaults to **`"operators"`** (`backend/app/models/user_settings.py:1194`).
The Library itself carries no feature gate (`nav-items.ts:37` — `{ view: "documents", … }` has no
`feature`), and the tab is rendered unconditionally.

So for every non-operator the Indexing tab is a first-class, always-visible tab that renders
`Model — Not known yet`, `Chunks indexed — Not known yet`, and *"Could not read the indexing facts
just now."* — copy that describes a transient outage for a permanent authorization condition.
There is no data leak (the API enforces correctly), but this is a reachability regression against
the project's own precedent: `nav-items.ts:58` gates the entire **Settings** entry on that same
`model_management` key, precisely so this capability is not shown to people who cannot use it.

**Fix:** gate the trigger and the body on the same feature key the Settings nav entry uses:
```tsx
const { features } = useFeatures()            // the hook nav-items already feeds from
const showIndexing = features?.model_management ?? false
…
{showIndexing && <TabsTrigger value="indexing">Indexing</TabsTrigger>}
```
and make `libraryReducer`'s `SELECT_TAB` land on `documents` when `indexing` is unavailable, so a
persisted/deep-linked tab value cannot select a hidden arm. If the tab must stay visible, replace
the error line with a permission-specific sentence rather than *"just now"*.

---

### WR-03: The new active-tab ring collides with the focus ring on the SAME element, in a shared cross-surface primitive

**File:** `frontend/src/components/ui/tabs.tsx:55`

**Issue:** The trigger's class list now contains both of these on one element:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-border
```

Tailwind's ring utilities are CSS-variable-based and compose rather than replace:
`ring-inset` sets `--tw-ring-inset: inset`, and **nothing in the `focus-visible:` group resets it** —
`ring-2` only sets the width. `--tw-ring-color` is set by both `ring-border` (at
`[data-state=active]`) and `ring-ring` (at `:focus-visible`), which have equal specificity (0,2,0),
so the winner is decided purely by emitted stylesheet order.

Consequence for a keyboard user on the **selected** tab: the focus indicator is drawn *inset*
instead of outside (so `ring-offset-2` eats 2px of it rather than separating it) and may take
`--tw-ring-color: var(--border)` — a near-invisible ring on the one tab that is always focusable
first. `tabsContrast.test.ts` reads this file and `index.css` as text and measures token lightness;
it asserts nothing about the focused-and-active combination, and no other suite does either.

This is not Library-local: `pages/SettingsPage.tsx` and `pages/KnowledgeHealthPage.tsx` mount the
same primitive and inherit the change.

**Fix:** make the new ring not a ring — the goal was a second non-colour cue, and `outline` does
not share Tailwind's ring variable slots:
```
data-[state=active]:outline data-[state=active]:outline-1 data-[state=active]:-outline-offset-1 data-[state=active]:outline-border
```
(or keep the ring and add `focus-visible:ring-inset-0`-equivalent by re-declaring
`focus-visible:[--tw-ring-inset:_]`). Then add a case to `tabsContrast.test.ts` that renders an
active trigger, focuses it, and asserts both cues are present and distinguishable.

---

### WR-04: `/chunks`, `/tables` and `/images` have no bound at all, while `/content` was carefully capped

**File:** `backend/app/api/documents.py:966-973` (chunks) · `:1004-1011` (tables) · `:1028-1035` (images)

**Issue:** `get_document_content` reasons explicitly about a measured worst case and enforces
`CONTENT_PAGE_LINES` / `CONTENT_MAX_LINES` so *"a caller cannot ask for an unbounded body"*
(`:836-843`). The three sibling routes added in the same plan carry no `.limit()`, no `range()`,
no page parameter, and no `has_more`:

```py
supabase.table("document_chunks")
  .select("id, chunk_index, content, embedding_model, embedding_dimensions")
  .eq("document_id", document_id)
  .order("chunk_index")          # no limit
```

`/chunks` returns every chunk's **full text**, so its payload is ≈ the whole document again — the
same 266,773-char worst case the `/content` cap was derived from, delivered in one uncapped
response. `document_tables.rows` is unbounded jsonb, and `/tables` returns *every* table of a
document at once; `DataTableView`'s `MAX_ROWS`/`MAX_BYTES` caps are per-table and apply only after
the whole payload has crossed the wire and been parsed. The clients render every row at once with
no paging affordance, unlike `DocumentContentSection`'s *Load more*.

(PostgREST's server-side `max-rows` will silently truncate large results — `reembed_service.py:252-256`
records exactly that trap at 1000 rows — so a >1000-chunk document would show a *silently* partial
list with no indication, which is the correctness half of this.)

**Fix:** give the three routes the same treatment `/content` got — an explicit `.limit(N)` plus
either a `has_more` envelope or `offset`/`range` query params, and a client *Load more*. At minimum
add `.limit(CHUNKS_PAGE_SIZE)` and surface "showing first N" so the list cannot silently truncate.

---

### WR-05: The "Found by" footer reports a capped count as if it were the total, contradicting its own docblock

**File:** `frontend/src/components/metadata/DocumentQueriesSection.tsx:143-147` ·
`backend/app/api/document_queries.py:38` (`MAX_ROWS = 100`)

**Issue:** The route returns at most 100 rows. The section prints:

```tsx
{rows.length} {rows.length === 1 ? "search" : "searches"} in the last {QUERIES_WINDOW_DAYS} days
```

For a heavily-retrieved document that renders **"100 searches in the last 30 days"** as a complete
census when the true figure may be thousands. The parent badge (`onTotalChange(res.length)`) carries
the same capped number. The file's own docblock at `:13-17` claims the opposite: *"the footer says
so rather than implying a complete census."* It does not — there is no cap disclosure anywhere in
the render.

**Fix:** have the route report the cap (e.g. add `capped: bool` or return `count="exact"` alongside
the capped rows), or, without a wire change, word the footer honestly at the boundary:
```tsx
{rows.length === QUERIES_MAX_ROWS
  ? `The most recent ${QUERIES_MAX_ROWS} searches in the last ${QUERIES_WINDOW_DAYS} days`
  : `${rows.length} …`}
```
with `QUERIES_MAX_ROWS` pinned to the backend constant the same way `QUERIES_WINDOW_DAYS` is.

---

### WR-06: Every failure mode in the new backend reads is collapsed into a misleading terminal answer

**File:** `backend/app/api/documents.py:846-874` · `backend/app/api/document_queries.py:93-97`

**Issue:** Two separate over-broad handlers:

1. `_assert_document_visible` wraps *both* visibility queries in bare `except Exception: … res = None`
   and then raises `404 "Document not found"`. A connection reset, a PostgREST 500, an expired JWT
   mid-request or a schema error is therefore reported to the user as **"this document does not
   exist"** — while the row is sitting right there in the list they clicked it from. The only trace
   is a `log.debug`, which is below the default level. Every one of the four detail routes inherits
   this. `read_path` (`kb.py:439-441`) has the same shape and now additionally stamps
   `error_kind: "not_found"` on it, so the content route's `error_kind` branch will 404 a
   transient DB fault too.

2. `list_document_queries` wraps the query **and** the row loop **and** the Pydantic construction
   in one `except Exception → 502`. A single malformed `audit_log` row (e.g. `created_at` absent,
   which `DocumentQueryRow.asked_at: datetime` requires) kills the whole list rather than skipping
   the row, and a genuine programming error is indistinguishable from an outage.

**Fix:** in `_assert_document_visible`, re-raise rather than swallow, and log at `warning`:
```py
except Exception:
    log.warning("visibility check failed for document %s", document_id, exc_info=True)
    raise HTTPException(status_code=503, detail="Couldn't check access to this document") from None
```
In `list_document_queries`, narrow the `try` to the `aexec` call and skip unparseable rows
individually inside the loop rather than failing the response.

---

## Info

### IN-01: The CSV preview lost its Download affordance on one cap path, and gained a second, differently-worded cap

**File:** `frontend/src/components/panel/CsvTablePreview.tsx:130` · `DataTableView.tsx:88-101`

`CsvTablePreview` used to apply `MAX_BYTES` once, on the raw string, and every fallback carried the
`onDownload` button. It now delegates to `<DataTableView headers={header} rows={body} />` **without
forwarding `onDownload`**, and `DataTableView` re-applies `MAX_BYTES` to the summed parsed-cell
lengths. A file that passes the raw cap but trips the parsed cap now renders *"Too large to
preview"* (not *"File too large to preview"*) **with no Download button** — the user's only escape
hatch from an unpreviewable file. Narrow window, but it is a real behavioural change in a file whose
docblock asserts *"every one of its behaviours are unchanged"*. Fix: `<DataTableView … onDownload={onDownload} />`.

### IN-02: Dead field and a hand-typed constant in the "Found by" section

**File:** `frontend/src/components/metadata/DocumentQueriesSection.tsx:69-71, 85, 51`

`GroupedQuery.lastAsked` is computed in `groupQueries` and rendered nowhere — dead weight carrying a
comment explaining an ordering assumption nothing depends on. Separately, `QUERIES_EMPTY` hardcodes
the literal `"…in the last 30 days"` two lines below `QUERIES_WINDOW_DAYS = 30`, which is exactly
the two-copies-of-one-number drift the constant was introduced to prevent. Fix: drop `lastAsked` (or
render it), and build `QUERIES_EMPTY` from the constant.

### IN-03: `DocumentTableRow.rows: list[list[str]]` fails the whole document on one bad cell

**File:** `backend/app/models/document.py:112-119`

Verified against the installed pydantic (2.12): `list[list[str]]` does **not** coerce `int`/`None` in
lax mode — `M(rows=[[1]])` raises `string_type`. Every current writer stringifies
(`multimodal_service.py:149-150, 172, 263, 279-280`; `extractors/aspects/tables.py:83-87`), so this is
latent rather than live — but `document_tables.rows` is untyped jsonb, a legacy row or a future
extractor with a `None` cell makes `GET /documents/{id}/tables` return **500 for every table on the
document**, not just the bad one. Fix: type it `list[list[str | None]]` and coerce at the boundary,
or build the rows with a per-row `try` that skips a malformed table.

### IN-04: `data-[state=inactive]:hidden` on all four `TabsContent` is dead code

**File:** `frontend/src/pages/LibraryPage.tsx:679, 686, 693, 700`

Radix `@radix-ui/react-tabs@1.1.13` renders `<Presence present={forceMount || isSelected}>`
(`dist/index.mjs:157`), so inactive content is **unmounted**, not hidden — the class can never
apply. Harmless, but it reads as an intentional keep-mounted decision and it is not one: switching
tabs genuinely unmounts `DocumentList`, `DocumentUpload` (losing its batch result banner) and
`DocumentDetailPanel`. Fix: delete the class, or add `forceMount` if keeping state across tabs was
the intent.

### IN-05: `segmentState` has no default arm

**File:** `frontend/src/components/ingestion/IngestionStrip.tsx:117-141`

The `switch (doc.status)` covers the four members of the `Document["status"]` union and returns
nothing otherwise. A status the backend adds later (or any row where `status` is `null`) returns
`undefined`, so `SEGMENT_CLASS[state]` is `undefined`, `data-state` is dropped, and the segment
renders as an unstyled box — the silent-degradation shape the rest of this file works hard to avoid.
Fix: `default: return "pending"` with a comment naming it as the unknown arm.

### IN-06: Hand-typed count in the count-gate comment block

**File:** `scripts/vitest-count-gate.cjs:4143-4148`

The comment reads *"The four pre-existing doc-space ORPHANS this gate had NEVER executed"* and then
lists **five** paths (`useDocuments.test.ts`, `DocumentList.moveToFolder.test.tsx`,
`DocumentList.test.tsx`, `ViewsGroup.test.tsx`, `DocumentDetailPanel.a11y.test.tsx`). Cosmetic, but
it is a hand-typed count inside the block whose entire thesis is that counts must be read from the
gate's own printed rows — the same class the phase itself flags at `acceptedFormats.ts:37-41`.

---

_Reviewed: 2026-08-29T06:52:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Diff base: 9a3808697_
