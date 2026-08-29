# Phase 217: The Library — One Home for Documents - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The document space stops being three pages and a stale filename. It becomes **Library** — one home
with a tab shell, **upload as a real front door**, the six ingestion stages the pipeline actually
writes, and the facts already stored in Postgres finally rendered.

**In scope:** the `Documents` → `Library` rename (`IngestionPage.tsx` → `LibraryPage.tsx`, same
commit); the tab shell; the front-door dropzone; the six-stage ingestion strip; the document detail
panel's five new sections; one source of selection truth for saved Views.

**Out of scope, by ROADMAP boundary:** the Library Health + Governance merge and the nav retirement
(**Phase 218**); connected-source ingestion (**Phase 219**); classification rules (deliberately not
folded — see `<deferred>`).

⚠ **The ROADMAP's ⭐ "ZERO schema, ZERO backend — every fact already flows" is HALF FALSE and was
MEASURED at discuss-time, not inherited.** ZERO schema is TRUE. ZERO backend is FALSE: none of
SC#4's six facts is reachable by the browser. See `<code_context>` → *The measurement that changes
the plan*.

</domain>

<decisions>
## Implementation Decisions

### Guardrails

- **D-217-01 — G-5 is honoured BY CONSTRUCTION, not by an inserted refactor phase.** G-5 fires on
  five files here (`DocumentList.tsx` 12ph, `IngestionPage.tsx` 9ph, `DocumentDetailPanel.tsx` 5ph,
  `useDocuments.ts` 3ph, `retrieval_service.py` 9ph — rows added `8b99c19b2`). The operator's ruling:
  217 takes the seams as part of the feature — SC#1 already renames the host page and SC#5 already
  forces a single-source-of-truth extraction. **Every plan touching one of the five MUST read that
  file's section in `docs/HOT-FILE-LEDGER.md` before writing tasks**, and must state which side of
  the vitest count gate its file sits on.
- **D-217-02 — G-2 is satisfied by sketch 218**, `.planning/sketches/218-the-library-and-its-tabs/`
  (variant **A**, operator-chosen 2026-08-28, 190 assertions passing, 31 of them reading the LIVE
  source tree). `BUILD-CONTRACT.generated.md` is the acceptance bar. ⚠ **It is GENERATED — never
  hand-edit it.** Where a decision below contradicts it, the contract is **regenerated with
  `node drive.cjs --emit` in the same commit** (see D-217-11).
- **D-217-03 — LIB-01…LIB-04 do not exist in `REQUIREMENTS.md`.** They appear only in `ROADMAP.md`,
  so the traceability register cannot see this phase's requirements at all. **Planning adds the LIB
  block to `.planning/REQUIREMENTS.md`** using the ROADMAP wording, in the phase's first commit.

### The wire — SC#4's six buried facts

- **D-217-04 — Per-section read routes, fetched LAZILY ON EXPAND.**
  `GET /documents/{id}/content` · `/chunks` · `/tables` · `/images` · `/queries`.
  Each new `PanelSection` owns its own fetch (the shipped `RelationshipsSection` ownership pattern)
  **but ships `defaultOpen={false}` and fetches on expand, not on mount**. ⚠ `PanelSection` defaults
  to `defaultOpen = true` and `RelationshipsSection.tsx:96` fetches in a bare `useEffect` — copying
  that verbatim would fire five requests, one of them a possibly-megabyte blob, the instant a
  document opens. Rejected: one composite `/documents/{id}/detail` (pays for the markdown every time,
  grows a god-response).
- **D-217-05 — `full_markdown` is served PAGED BY LINE RANGE**, reusing the `?from=&to=` shape
  `backend/app/api/kb.py:404` already implements for the agent tool. **One pattern, not two.**
  Rejected: truncate-with-marker (a person cannot reach the end of their own document — the exact gap
  SC#4 closes) and send-whole (no measurement here of the worst case).
- **D-217-06 — "the questions that found it" reads `audit_log` `search.query` rows, filtered per
  document.** `backend/app/api/knowledge_health.py` already derives retrieval analytics from that
  source; it simply never exposes them at document grain. Zero schema. Rejected: a new
  `retrieval_events` table (SEED-224's substrate — that is Phase 218's LIB-07 and a migration).
- **D-217-07 — the `/queries` route inherits `knowledge_health.py`'s CLASSIFIED SERVICE-ROLE
  EXCEPTION**, with **`user_id` applied in the SQL, never trusted from the request**, and the
  exception restated in the module docstring exactly as the shipped precedent does. ⚠ `audit_log` has
  **no authenticated SELECT policy**. Rejected: adding one (a migration, and it widens read access to
  an audit table used far outside the Library — a security decision, not a tidy-up).
- **D-217-08 — `extractor` is added to `DocumentResponse`** (one scalar per document, on the row
  everyone already fetches — no new request); **`embedding_model` rides the `/chunks` route**, where
  its per-chunk variation mid-re-embed is the whole point.

### The ingestion strip — SC#3

- **D-217-09 — the strip draws in the order the backend WRITES, not the order the sketch drew:**
  `Reading → Splitting → Indexing → Tables? → Images? → Labelling`.
  ⚠ **MEASURED CONTRADICTION.** `backend/app/api/documents.py` writes `extracting`(:1834) →
  `chunking`(:2014) → `embedding`(:2042) → `extracting_tables`(:2080) → `extracting_images`(:2091) →
  `metadata`(:2201). The sketch's contract draws `Reading → Tables? → Images? → Splitting → Indexing
  → Labelling`, so **rendered against the real sequence the strip would jump backwards** — a file
  reaches segment 5, then lights segment 2. Frontend-only fix, zero pipeline risk. Rejected:
  reordering a shipped ingestion pipeline for a visual (table/image chunks feed chunking).
- **D-217-10 — `ingestion_step` is added to `DocumentResponse`.** ⚠ **MEASURED:** it appears in
  `frontend/src/types/index.ts:499` and in **no backend response model** — it reaches the browser
  ONLY through the Supabase Realtime row payload (`useDocuments.ts:44-58`). A file already mid-ingest
  when the Library opens shows **no stage at all** until the next transition fires. That is exactly
  the **D-v2.5-03** failure (*Realtime is a hint, not a source of truth — reconcile via fetch*), and
  **no test that mocks the fetch could catch it.** Rejected: polling; leaving it Realtime-only.
- **D-217-11 — the BUILD-CONTRACT is REGENERATED, not edited.** D-217-09 contradicts its
  `Ingestion stages` block. Run `node drive.cjs --emit` from
  `.planning/sketches/218-the-library-and-its-tabs/` **in the same commit** as the strip, after
  updating the sketch's own stage order. ⚠ A transcribed contract is the thing that goes stale.

### Views — SC#5's one selection truth

- **D-217-12 — ONE `librarySelection` discriminated union owns folder, view and tab:**
  `{tab:'documents', folderId} | {tab:'views', viewId} | {tab:'ingestion'|'indexing'}`.
  The folder/view mutual exclusion (**UX-01 / D-114-1**) becomes **structural** instead of the two
  `setState` calls at `IngestionPage.tsx:242`. One reducer, one auditable place. ⚠ Today
  `selectedViewId` (`:83`) is already single-owner and passed DOWN to the sidebar `ViewsGroup` — so
  the disagreement SC#5 forbids is between **`activeTab` and `selectedViewId`**, not between two view
  lists. Rejected: `activeTab` + an enforced-by-convention invariant; three independent `useState`.
- **D-217-13 — tab 2 renders the SAVED-VIEW PICKER when no view is selected** — its own real content
  (the list of saved views with counts), which answers the sketch §1 objection that Views has no
  content of its own. Rejected: an empty state pointing at the sidebar (the hollow tab §1 argued
  against); hiding the tab conditionally (undiscoverable).
- **D-217-14 — clicking a FOLDER while a view is loaded produces `{tab:'documents', folderId}`** —
  the tab follows the selection. There is no state in which the tab lies about the list beneath it.

### The tab set — what 217 actually ships

- **D-217-15 — 217 ships FOUR tabs: `Documents · Views · Ingestion · Indexing`. The Health tab
  arrives in Phase 218** with the content that justifies it and the nav entries it retires, in one
  commit. ⚠ **This SEQUENCES sketch 218's variant A rather than reversing it** — five tabs is still
  the destination. Reason: 218 owns the merge, so a Health tab built in 217 would sit beside a
  `KnowledgeHealthPage.tsx` (571 L) that is still mounted as its own nav entry AND is still
  `ChatLayout.tsx:879`'s positional fallback. Rejected: mounting the existing page inside tab 5 (same
  page in two places until 218); a tab that links out (hollow).
- **D-217-16 — tab 4 (Indexing) COMPOSES the shipped `ReembedStatusCard`** (278 L, already imported
  by `IngestionPage` via `ReembedSearchPointer`) beside the active embedding model and a real
  chunk/document count. Zero new mechanism. **The coverage figure prints numerator AND denominator
  ("87 of 224"), never a percentage** — a coverage count must not read as a quality grade.

### The front door — SC#2

- **D-217-17 — the full-width dropzone lives on the DOCUMENTS tab (the landing tab); the queue, the
  stage-card aggregate row and the six-stage strips live on the INGESTION tab.** SC#2 asks that a
  person landing on the Library can start an upload without hunting — tab 3 is hunting. **One
  dropzone component, mounted once**, so the accepted formats cannot diverge.
- **D-217-18 — ONE exported constant feeds both the `accept` attribute and the displayed format
  list.** A format cannot be advertised that the input refuses, because there is one list.
  ⚠ The sketch's own fence caught its older dropzone advertising `MSG`, which the shipped input
  rejects — **a dropzone listing a format the input refuses sends the user to a dead end.**
- **D-217-19 — NO upload percentage and NO ETA, anywhere.** ⛔ **MEASURED:** there is no
  `onUploadProgress` in the upload path (`DocumentUpload.tsx`, 144 L) — the client reports only
  *"Uploading N files…"*. And two of the six stages are decided *while the file runs*, so there is no
  honest denominator when the strip first renders. **A skipped stage is STRUCK THROUGH, never left as
  an empty box** — an absent thing that looks pending is the failure this avoids.

### The tab-bar inversion

- **D-217-20 — the SHARED `components/ui/tabs.tsx` primitive is fixed; the change lands on three
  surfaces.** ⚠ **MEASURED blast radius is smaller than the sketch implied:**
  `grep -rln 'from "@/components/ui/tabs"'` returns exactly **two** non-test mounts —
  `KnowledgeHealthPage.tsx` and `SettingsPage.tsx`; the Library is the third. Rejected: a
  Library-local variant (two tab bars that disagree on one theme is how a design system stops being
  one); a `variant` prop (it makes the WRONG rendering the default).
- **D-217-21 — the active tab becomes LIGHTER than its track on Deep Midnight, plus a visible
  border.** ⚠ Today `data-[state=active]:bg-background` over `bg-muted` measures **4% over 11%
  lightness (−7, DARKER)** — a hole, not a raised chip — and its only other cue is a **5%-opacity
  shadow, invisible at 4% lightness**. Two independent cues, and it matches what every reference
  image drew. Rejected: an accent underline (changes the silhouette); raising the shadow opacity
  (trades one theme's legibility for the other's).

### Rulings added at plan-time (2026-08-29) — raised by 217-RESEARCH.md, decided by the operator

⚠ **These three were NOT in the discuss-phase set.** Research measured that the 21 locked decisions
do not rule on them, and each changes what gets built. They are recorded here rather than in a plan
so the decision-coverage gate can see them.

- **D-217-22 — D-217-19's "no percentage, no ETA" scopes the INGESTION STRIP and the UPLOAD PATH
  only; tab 4's `ReembedStatusCard` keeps its determinate bar and its `~3 min` remaining.**
  ⚠ **MEASURED CONFLICT:** `ReembedStatusCard.tsx:163` prints `"~3 min"` under the label `remaining`
  and `:146` renders a width-percentage bar — so D-217-19 ("anywhere") and D-217-16 ("composes this
  card unchanged") could not both hold. The distinction is real: D-217-19's stated reason is that two
  of six stages are decided *while the file runs*, so there is **no honest denominator**. Re-embed
  **has** one — `total chunks`, live from `document_chunks`. **The card is NOT edited.** ⚠ The
  sketch's own fence `B4c` (`drive.cjs`, `!/ETA|remaining.*minutes?/i`) would fire if
  this card's copy ever reached the sketch surface — so the ruling must be stated in the plan, not
  left implicit. Rejected: rewriting `:163` to a chunk count (edits a shipped 278 L component
  D-217-16 said to compose unchanged).

- **D-217-23 — a `failed` document's segments after the failure point render as a THIRD state:
  dimmed "not reached".** The strip therefore has three non-done renderings, not two:
  **done · struck-through (skipped) · dimmed (never reached)**. The failing step itself renders as
  the failure point, and the row's existing `error_message` carries the reason (`DocumentList`
  already renders it). ⚠ **`ingestion_step` is NEVER CLEARED** — the terminal write
  (`documents.py:2266-2273`) does not null it, so a `completed` document reads `"metadata"` by
  RESIDUE, not by observation, and a `failed` one permanently reads the last step it reached.
  ⛔ **Do not "fix" that by nulling the column: `text_sanitize.py:9` DIAGNOSES the BUG-260825-01 NUL
  defect by reading `status=failed / ingestion_step=embedding`. Nulling it deletes a diagnostic.**
  Consequence: on `completed`, the strip must NOT read `ingestion_step` at all. Rejected: rendering
  later segments as *pending* (a stalled file then looks like it is still working — the exact
  "absent thing that looks pending" failure D-217-19 exists to avoid).

- **D-217-24 — conditional-stage applicability is DERIVED ON THE SERVER, as two booleans on
  `DocumentResponse`: `tables_stage_applies` and `images_stage_applies`**, computed from
  `multimodal_service.py`'s own frozensets (`:26-32, 491-501, 755-758`). This is **D-217-18's
  one-list principle applied a second time** — the strip cannot advertise a stage the pipeline would
  never run. ⚠ **MEASURED, and it is why the marker cannot be trusted:** both `ingestion_step`
  markers are written *before* the extractor call (`documents.py:2080, 2091`), and
  `extract_and_store_tables`/`_images` `return` immediately for an unsupported mime
  (`multimodal_service.py:502`, `:759`) — so observing `ingestion_step="extracting_tables"` proves
  **nothing**. ⚠ Also measured: the two conditionals sit inside ONE `if raw and mime_type:`
  (`:2074`) — they can never be skipped independently. ⚠ And the `extracted_doc` fast path (`:479`)
  can supply tables/images for ANY mime when Docling pre-extracted them, so the truthful rule is
  **`skipped` iff `!applies_to_mime && count === 0`**, never mime alone. Rejected: hardcoding the
  mime sets in TypeScript (duplicates a list that lives in `multimodal_service.py`, and nothing
  would catch the drift — the exact failure D-217-18 exists to prevent).

⚠ **A fourth research finding needs no ruling but binds the plan:** `D-217-05`'s cited `kb.py:404`
is inside `read_path`'s owner fetch, not the slicing. The real function is `read_path` (`:397-461`),
the params are **`start_line` / `end_line`** (not `?from=&to=`), and it **prefixes every line with
its line number** (`kb.py:446`) — which must not reach a human reader. The decision (*reuse the
line-range shape*) is unchanged; a plan that copies `read_path` verbatim ships numbered prose.

⚠ **And a fifth: `BUILD-CONTRACT.generated.md` IS ALREADY STALE AT HEAD**, before this phase changes
anything — its mtime (20:37) predates `drive.cjs` (20:52), and it claims **190** assertions where
`node drive.cjs` measures **193**. D-217-11's regeneration obligation therefore starts from a stale
artifact, and D-217-02's "190 assertions / 31 reading the live tree" figures are stale in this file
too. **Re-derive; do not quote them.**

### D-217-25 — the eight-section panel: order, names, and the `Details` collision (2026-08-29, operator: "proceed")

⚠ **Raised by the operator BEFORE execution, and it was a real gap:** *"did we consider the metadata
somewhere, because I see that it was not designed"*, then *"document relationship, metadata and
classification?"*. The three shipped sections were **protected** by `217-10`'s fence but the resulting
panel was **designed by nobody** — no artifact said what an eight-section panel looks like.

**What is already true and is NOT changed here:** the three shipped mounts
(`DocumentDetailPanel.tsx:242` Details/Metadata · `:265` Relationships · `:279` Classification) keep
their props, exactly as `217-10` already asserts. Phase 112's editable fields + per-field
`ConfidenceChip` + low-confidence warn badge, Phase 117's relationships + create-link picker, and
Phase 118's suggestion chips with accept/dismiss/Undo all survive untouched. **217 only ADDS.**

- **D-217-25a — the section ORDER is fixed at eight, and the five new ones are INSERTED, not appended:**

  | # | Section | Origin | Mount |
  |---|---|---|---|
  | 1 | **Details** (*Metadata* under ⌥) | shipped, Phase 112 | eager — no fetch, reads `doc` |
  | 2 | **Text** | NEW (`217-10`) | `defaultOpen={false}` |
  | 3 | **Chunks** | NEW (`217-10`) | `defaultOpen={false}` |
  | 4 | **Tables** | NEW (`217-11`) | `defaultOpen={false}` |
  | 5 | **Images** | NEW (`217-11`) | `defaultOpen={false}` |
  | 6 | **Found by** | NEW (`217-11`) | `defaultOpen={false}` |
  | 7 | **Relationships** | shipped, Phase 117 | eager — ⚠ fetches on mount |
  | 8 | **Classification** | shipped, Phase 118 | eager — no fetch |

  **Reading order, and it is the reason:** *what we know about it* (1) → *what is in it* (2–5) →
  *how it is actually used* (6) → *how it relates to everything else* (7–8). The five new sections go
  **between Details and Relationships**, so the document's own content sits next to the facts about
  it, and the two cross-document sections stay together at the end. ⚠ **The shipped mounts MOVE but
  their PROPS do not change** — `217-10`'s fence is *"no hunk altering their props"*, which a
  relocation satisfies; the plan must say so explicitly rather than let an executor read the fence as
  *"do not move"*. Rejected: appending the five after Classification (puts the document's own text
  below two sections about other documents); interleaving by plan-landing order (`217-11` would have
  to insert into `217-10`'s block, and the order would be an artefact of the wave graph).

- **D-217-25b — ⛔ the new text section is called `Text`, and the word `Details` is FORBIDDEN for it.**
  ⚠ **MEASURED COLLISION:** the shipped metadata section's plain label IS `Details`
  (`termMap.ts:90` — `{plain: "Details", helper: "Facts about this document.", technical: "Metadata"}`,
  Phase 154 LANG-01), and **sketch 218's detail screen draws a caption also called `Details`** over a
  flat read-only `Type · Size · Added · Chunks · Version` list. Building both puts **the word
  "Details" on the panel twice**, over two unrelated surfaces — one editable with confidence chips,
  one five static rows.
  **Resolution: the sketch's `Details` block is ALREADY SATISFIED by the shipped section**, which does
  that job strictly better (it is editable and it grades its own confidence). **It is not built.** The
  five new titles are literal strings — `Text` · `Chunks` · `Tables` · `Images` · `Found by` —
  matching the shipped `title="Relationships"` / `title="Classification"` convention.
  ⚠ **`Found by`, never `Queries` or `Retrieval`** — the sketch's own `SIGNAL_RENAMES` already renames
  `Most Retrieved` → `Most found` and `Never Retrieved` → `Never found`; a third word for the same
  concept on the same product is how a vocabulary stops being one. Rejected: routing the five new
  titles through `termMap.ts` (the map exists to carry a *technical* string that predates the plain
  one — these have no shipped technical name to reveal, so an entry would be a fabricated one).

- **D-217-25c — ⚠ "opening a document fires ZERO requests" is FALSE and must not be written as a
  phase-level truth.** `217-10`'s must-have is true of the **five new** sections only.
  `DocumentDetailPanel.tsx:265` omits `defaultOpen`, so `RelationshipsSection` inherits `true` and
  **fetches on mount today** (`RelationshipsSection.tsx:96`, a bare `useEffect`). A cold open fires
  **exactly one** request before this phase and **exactly one** after. That is shipped behaviour the
  phase deliberately leaves alone (it is `DocumentDetailPanel`'s ledger seam, owed to a later phase).
  **State the count as one, not zero** — a must_have that claims zero is refuted by the first person
  who opens the network tab, and the fix would be a props change the `217-10` fence forbids.

### Claude's Discretion

- Tailwind class choices, spacing, hover/focus states, and the exact `PanelSection` titles for the
  five new detail sections. ⚠ Sketch 218 §7 explicitly leaves pixel spacing to a human comparison —
  **a G-4 row must name `.planning/sketches/218-the-library-and-its-tabs/index.html` as its reference
  and be driven BY LOOKING.**
- How "tables as tables" renders inside the fixed **430px** panel track (horizontal scroll container
  vs. column shedding) — not discussed; the panel's own width is fixed by its host.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The acceptance bar (G-2)
- `.planning/sketches/218-the-library-and-its-tabs/README.md` — the full design record: the borrowed
  vs. ours split, the four chart types, the two rendered-only findings, the ⛔ cut list, the
  variant-A ruling, and §5's `ChatLayout` fallback seam.
- `.planning/sketches/218-the-library-and-its-tabs/BUILD-CONTRACT.generated.md` — **the contract.**
  ⚠ GENERATED by `node drive.cjs --emit`; regenerate, never hand-edit (D-217-11).
- `.planning/sketches/218-the-library-and-its-tabs/drive.cjs` — 190 assertions, **31 of which read
  the LIVE source tree**. If the repo moves, they fail. That is the point.
- `.planning/sketches/218-the-library-and-its-tabs/COPY.js` — the vocabulary, incl. `SIGNAL_RENAMES`.

### The origin and its measurements
- `.planning/seeds/SEED-224-document-space-redesign-five-tab-rag-honesty.md` — §*Measured at planting
  time* carries four measurements a plan must not re-derive, incl. that chunk text is already stored
  and returned, and that there is **no `DocumentsPage`**.
- `docs/DOCUMENT-SPACE-REDESIGN.md` — the durable per-screen gap table and cut list. ⚠ The Stitch
  project is mutable and privately scoped; **it is not the contract.**

### The guardrail the phase is under
- `docs/HOT-FILE-LEDGER.md` — **read the section for each of the five G-5 files before planning**
  (`#frontendsrccomponentsingestiondocumentlisttsx`, `#frontendsrcpagesingestionpagetsx`,
  `#frontendsrccomponentsmetadatadocumentdetailpaneltsx`, `#frontendsrchooksusedocumentsts`,
  `#backendappservicesretrievalservicepy`). Each carries the named seam and the binding invariants.
- `CLAUDE.md` § *Workflow guardrails* (G-2, G-4, G-5, G-7) and § *Parallel execution* — carry
  `GSD_VITEST_MAX_WORKERS=2`; run `bash scripts/bootstrap-worktree.sh "$(pwd)"` first in any worktree.
- `.planning/ROADMAP.md` §*Phase 217* — the five success criteria, verbatim, are the goal.

### The code the phase is built on
- `backend/app/api/kb.py:404` — the line-range slicing shape D-217-05 reuses.
- `backend/app/api/knowledge_health.py` — the classified service-role exception D-217-07 inherits,
  and the `audit_log` `search.query` derivation D-217-06 reuses.
- `backend/app/api/documents.py:1834,2014,2042,2080,2091,2201` — the six `ingestion_step` write sites
  that fix the strip's order (D-217-09).
- `frontend/src/components/panel/PanelSection.tsx` + `relationships/RelationshipsSection.tsx` — the
  section-ownership pattern D-217-04 follows, and the `defaultOpen`/on-mount trap it must not.

### Prior art whose decisions bind here
- `.planning/phases/114-*/` — **D-114-1 / UX-01**: ad-hoc filtering and a loaded saved view are the
  SAME surface; folders and views are mutually exclusive. D-217-12 makes it structural.
- `CLAUDE.md` **D-v2.5-03** — Realtime is a hint, never truth; reconcile by fetch. This is the whole
  reason for D-217-10.
- `CLAUDE.md` **D-v2.5-01** — no blocking I/O in an async handler; wrap `supabase-py` calls with
  `run_in_threadpool`. Applies to all five new routes.

</canonical_refs>

<code_context>
## Existing Code Insights

### ⛔ The measurement that changes the plan

The ROADMAP says *"every fact already flows"*. Measured 2026-08-28 — **the data is in Postgres; none
of it is reachable by the browser:**

| SC#4 fact | in Postgres | on the wire |
|---|---|---|
| `documents.full_markdown` | ✅ written `documents.py:2270` | ⛔ absent from `DocumentResponse` (`models/document.py:30-49`) |
| `documents.extractor` | ✅ | ⛔ absent from `DocumentResponse` |
| `document_tables.headers` / `.rows` | ✅ | ⛔ no route — `documents.py:747` aggregates a COUNT only |
| `document_images.description` | ✅ | ⛔ no route — count only |
| `document_chunks.content` | ✅ since mig `002:24` | ⛔ no `/documents/{id}/chunks` route |
| the questions that found it | ✅ `audit_log` | ⛔ `knowledge_health` exposes AGGREGATES only |

`grep '@router\.' backend/app/api/documents.py` → **11 routes, none reading any of the six.**

⭐ **ZERO SCHEMA still holds, and this was checked rather than assumed:** `CREATE POLICY … FOR SELECT
TO authenticated` exists on `document_chunks` (mig `108:169`, `110:216`), `document_images`
(`108:181`) and `document_tables` (`108:187`). **No migration, and no service-role exception** — the
user-JWT client suffices for four of the five routes. Only `/queries` needs the `audit_log`
exception (D-217-07).

### Reusable Assets
- **`ReembedStatusCard`** (`components/settings/ReembedStatusCard.tsx`, 278 L) — owns the whole
  re-embed lifecycle; already reachable from the page via `ReembedSearchPointer`. Tab 4 composes it.
- **`PanelSection`** — the accordion with a mono count badge and a `warn` amber arm; `count` accepts
  a flat number or a `{done,total}` fraction. The five new sections plug straight in.
- **`ViewsGroup`** (`components/ingestion/ViewsGroup.tsx`) — already renders the complete saved-view
  list with per-view counts, the `G` pill on system-global seeds, and Edit/Rename/Delete. **Tab 2
  reuses it; it does not reimplement it.**
- **`DocumentStatusBadge`** — already consumes `doc.ingestion_step` (`DocumentList.tsx:422`). The
  strip is a second rendering of a value the badge already reads.
- **`kb.py:404`'s line-range slice** — the `/content` route's shape, already written.

### Established Patterns
- **Three homes, no router.** `SEED-185`: the app has no URL router; `ActiveView` + a branch chain in
  `ChatLayout.tsx` is the navigation. ⚠ **`ActiveView` stays `"documents"`** — it is never printed to
  a user (ROADMAP SC#1). The rename is **front-end label + filename only**.
- **A section owns its own fetch**, keyed on the open document (`RelationshipsSection.tsx:7,96`).
- **Realtime merges, fetch reconciles.** `useDocuments.ts:44-58` spread-merges the Realtime payload
  because `table_count`/`image_count`/`chunk_count` are server-side aggregates absent from it, then
  refetches on terminal transitions. Any new per-document count must follow that rule or be blown
  away mid-transition.
- **The 6-column table order is load-bearing.** `Filename · Type · Size · Chunks · Status · Actions`;
  `IngestionPage` sheds columns 3–5 **by `nth-child`** when the 430px panel opens. **Reordering the
  columns silently sheds the wrong ones.**

### Integration Points
- `frontend/src/lib/nav-items.ts:37` — `{ view: "documents", … label: "Documents" }` → `"Library"`.
  ⚠ 217 changes **the label only**. The `library-health` (`:49`) and `governance` (`:50`) entries
  stay until Phase 218.
- `frontend/src/components/layout/ChatLayout.tsx:757` — the `activeView === "documents"` branch, and
  **`:879`, where `KnowledgeHealthPage` is the trailing `else`**. 217 must not disturb the fallback;
  218 owns replacing it.
- `frontend/src/pages/IngestionPage.tsx` → `LibraryPage.tsx` — a git rename plus every importer.
- `backend/app/models/document.py` `DocumentResponse` — gains `extractor` and `ingestion_step`.
- `scripts/vitest-count-gate.cjs` — **new suites must be pinned in BASELINE and reachable from
  TARGETS.** ⚠ TARGETS decides what RUNS; BASELINE decides what is GUARDED, and a suite can sit on
  the wrong side of exactly one of them (Phase 214's close).

</code_context>

<specifics>
## Specific Ideas

- **"I did not see for example where I can upload documents."** — the operator, 2026-08-28. Today
  upload is a small button in the top-right corner of a folder header. **That observation is SC#2.**
- **"we have a lot of things that we can show but it is hidden and buried."** — measured and true.
  Six columns written for every document reach no screen. **That observation is SC#4.**
- **"exactly as referenced but with the correct elements of the tabs… not many text pollution, good
  user journey, a lot of charts bars visuals"**, later refined to *"not the colors, the CONTENT, the
  types of charts, the JOURNEY, the SIMPLICITY, the FUNCTIONALITY."* → content/charts/journey come
  from the reference; **palette, typography, spacing and component shapes are ours**, every value a
  token from `frontend/src/index.css`.
- **Colour must have a job.** One colour per series; but every bar splits **found something /
  found nothing**, because a search that returned nothing is the single most important RAG fact and
  it is already written. ⚠ **Colour never carries alone — every swatch prints its word and its
  count.** (Health-tab detail; lands in 218, recorded here so it is not re-litigated.)
- **The word `golden` is taken.** `workflow_runs.is_golden_run` means the publish gauntlet's live
  run. One product must not carry two unrelated meanings on one word → **`Checked queries`**.
- **Animation:** one 700 ms ease-out entrance with a per-item stagger, **fully disabled under
  `prefers-reduced-motion`** — the sketch asserts it.

</specifics>

<deferred>
## Deferred Ideas

- **The `Retrieval Score` tile ruling** (bare `0.61` as shipped vs. qualified `MATCH STRENGTH —
  average similarity of what searches returned` vs. absent). **Deferred to Phase 218 with the Health
  tab** — the ruling travels with the surface. Sketch 218 §7 records it as owed; it is now routed,
  not silent.
- **The five-tab set's fifth tab (Health)** and the Library Health + Governance merge, its seven
  grouped chips, the `Low Confidence` name collision (**0.38 retrieval similarity vs. 0.5 extracted
  field confidence** → `Weak matches` / `Unsure metadata`), the feature-gate migration
  (`governance_health` must move with the signals — **a merge that drops a permission is a leak**),
  and the `ChatLayout.tsx:879` fallback replacement. → **Phase 218.**
- **Per-hit relevance recording** (LIB-07) — `retrieval_service.py` computes a per-hit similarity and
  **drops it**. A jsonb key on an existing column, not a new table. → **Phase 218.**
- **Connected-source ingestion** — the Sources tab, the dry run's three arms (*will be added /
  already here (a `content_hash` lookup) / type not supported*), "checked every 15 minutes" never
  "instantly", and the `CLAUDE.md` manual-upload-only rule changing **in the same commit**
  (`SEED-142`). → **Phase 219.**
- **A `retrieval_events` table at per-query grain** — SEED-224's substrate. The sketch's own §7 notes
  the two missing facts are keys on an existing jsonb column; a per-query-grain table is a separate,
  larger question. **Not this milestone.**
- **Classification folding into the Library** — ⚠ **deliberately NOT folded, and named rather than
  left silent.** It is *rules authoring*, not a view of documents; folding it unasked is the scope
  creep the guardrails exist to stop. Re-open trigger: an operator asks for it, or a phase scopes the
  rules surface in its own right.
- **Upload byte progress** — ⛔ blocked by measurement, not by choice: `onUploadProgress` is absent
  from the upload path, so any percentage is unknowable. Re-open trigger: the upload client gains a
  progress channel.

### Reviewed Todos (not folded)
- Open `surface: Agentic-RAG` reported bugs were swept; **none has `affected_areas` overlapping the
  document/ingestion/library domain.** `BUG-260823-03` is tagged `RAG/retrieval` but is an
  agent-loop prompting defect (follow-up KB queries not self-contained), not a Library surface.
  Nothing folded, nothing deferred from that register.

</deferred>

---

*Phase: 217-the-library-one-home-for-documents*
*Context gathered: 2026-08-28*
