# Phase 217: The Library — One Home for Documents · Research

**Researched:** 2026-08-28
**Domain:** React 18 + Vite frontend (tab shell, panel sections, selection state) · FastAPI +
supabase-py read endpoints · the shipped RLS/threadpool/Realtime conventions of this repo
**Confidence:** HIGH — every claim below carries a file path and a line number read in this session.
Nothing is inherited from a prior phase's prose.

---

## Summary

The phase is **not** a re-skin. It is (a) one file rename with a small import fan-out, (b) a net-new
tab shell inside a page that has never had one, (c) **five new backend read routes plus two new
fields on `DocumentResponse`**, and (d) a shared-primitive contrast fix that lands on three surfaces.
The ROADMAP's ⭐ "ZERO schema, ZERO backend" is half false and CONTEXT already records that; this
research does **not** re-derive it, it extends it with the concrete route shapes, the auth split, and
**three measured facts that change how the work must be planned**.

The three that matter most, all measured in this session and none of them in CONTEXT:

1. **`document_tables` and `document_images` RLS is OWNER-ONLY** (`108_*.sql:180-188`), while
   `document_chunks` was widened to *owner OR globally-visible folder* (`110_*.sql:215-223`). CONTEXT
   says the user-JWT client "suffices for four of the five routes" — it does, but **two of those four
   return a strictly narrower set than the other two** for a document the user can see but does not
   own. That is not a defect, and it is internally consistent with today's `table_count`, but a plan
   that assumes all four behave alike will write a wrong test.
2. **`ingestion_step` is never cleared.** The terminal `completed` write (`documents.py:2266-2273`)
   does not touch it, and neither does the `failed` write (`:2292-2295`). Only `/reextract`
   (`:1308`) resets it to `None`. So the column is a **last-step-reached marker, not a live cursor**,
   and it holds `"metadata"` forever on every completed document. `DocumentStatusBadge` only survives
   this because it consults `ingestionStep` **only while `status === "processing"`**
   (`DocumentStatusBadge.tsx:27-32`). The strip must inherit that same guard or every completed row
   lights all six segments.
3. **There is no stored signal for "this stage was skipped."** The two conditional writes sit inside
   ONE `if raw and mime_type:` (`documents.py:2074-2091`) — so they are skipped as a *pair*, never
   independently — and both markers are written **before** the extractor call, which itself
   `return`s immediately for unsupported mime types (`multimodal_service.py:502`, `:759`). A
   strike-through therefore has to be **derived from `mime_type`**, and D-217-18's own principle
   (one list, not two) says that derivation belongs on the server beside the constants, not
   hand-copied into TypeScript.

**Primary recommendation:** Wave the phase as **backend-first** — `DocumentResponse` +
five routes + the derived stage-applicability booleans land before any tab or panel work, because
four of the five success criteria depend on data that does not currently reach the browser, and
because the frontend's honesty rules (D-217-19) cannot be implemented at all without fact #3.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Guardrails**

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

**The wire — SC#4's six buried facts**

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

**The ingestion strip — SC#3**

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

**Views — SC#5's one selection truth**

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

**The tab set — what 217 actually ships**

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

**The front door — SC#2**

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

**The tab-bar inversion**

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

### Claude's Discretion

- Tailwind class choices, spacing, hover/focus states, and the exact `PanelSection` titles for the
  five new detail sections. ⚠ Sketch 218 §7 explicitly leaves pixel spacing to a human comparison —
  **a G-4 row must name `.planning/sketches/218-the-library-and-its-tabs/index.html` as its reference
  and be driven BY LOOKING.**
- How "tables as tables" renders inside the fixed **430px** panel track (horizontal scroll container
  vs. column shedding) — not discussed; the panel's own width is fixed by its host.

### Deferred Ideas (OUT OF SCOPE)

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
- **Connected-source ingestion** — the Sources tab, the dry run's three arms, "checked every 15
  minutes" never "instantly", and the `CLAUDE.md` manual-upload-only rule changing **in the same
  commit** (`SEED-142`). → **Phase 219.**
- **A `retrieval_events` table at per-query grain** — SEED-224's substrate. **Not this milestone.**
- **Classification folding into the Library** — ⚠ **deliberately NOT folded.** It is *rules
  authoring*, not a view of documents. Re-open trigger: an operator asks for it, or a phase scopes
  the rules surface in its own right.
- **Upload byte progress** — ⛔ blocked by measurement: `onUploadProgress` is absent from the upload
  path. Re-open trigger: the upload client gains a progress channel.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

⚠ **LIB-01…LIB-04 are ABSENT from `.planning/REQUIREMENTS.md`.** Verified 2026-08-28:
`grep -n "LIB-0" .planning/REQUIREMENTS.md` returns **nothing**, and the Traceability table at
`REQUIREMENTS.md:184-217` lists 32 rows, none of them `LIB-*`. The wording below is taken verbatim
from `ROADMAP.md:352-360`, which is the only place it exists. **D-217-03 requires the LIB block be
added to `REQUIREMENTS.md` in the phase's first commit** — including a Traceability row per ID with
`Phase 217` and status `Planned`, and a note that the counts line ("32 / 32 mapped") changes.

| ID | Description (ROADMAP wording) | Research support |
|----|-------------------------------|------------------|
| **LIB-01** | The surface is called **Library** in the nav and on the page, and `IngestionPage.tsx` is renamed `LibraryPage.tsx` in the same commit. ⚠ The `ActiveView` key stays `"documents"` | § *SC#1 — the rename's true blast radius* — exactly **15 non-test + 6 test reference sites**, enumerated with line numbers; `nav-items.ts:37` is label-only; `ActiveView` at `App.tsx:102` untouched |
| **LIB-02** | A person lands on the Library and can **start an upload without hunting for it**: a full-width dropzone, the real accepted formats, and the folder it will land in | § *SC#2 — the front door*: the shipped `accept` string measured verbatim (`DocumentUpload.tsx:132`), the backend's `ALLOWED_MIME_TYPES` at `documents.py:91`, and the two-list drift the constant closes |
| **LIB-03** | A file being ingested shows **the six stages the pipeline actually writes**, two of them conditional and struck through when skipped — never a three-segment bar, never a percentage, never an ETA | § *SC#3 — the six-stage strip*: write order confirmed at all six line numbers, plus the **three measured facts** that decide what "skipped" can honestly mean |
| **LIB-04** | A document's detail panel shows **what we already store and never showed**: the parsed text, extracted tables **as tables**, image descriptions, its chunks, and the questions that found it | § *SC#4 — the five new routes* (auth split, threadpool shape, response envelopes, the RLS asymmetry) and § *The lazy-fetch section pattern* |
| **SC#5** *(no REQ id in ROADMAP)* | A saved View is reachable as a tab **and** from the sidebar, from **one source of selection truth** | § *SC#5 — the `librarySelection` blast radius*: every consumer named with a line number |

⚠ SC#5 carries **no requirement ID** in the ROADMAP (`Requirements: LIB-01, LIB-02, LIB-03, LIB-04`
is four IDs for five criteria). The planner should either map SC#5 under LIB-01 explicitly or plant a
`LIB-04b`; leaving it unmapped is how a criterion goes unverified.
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Directives that bind this phase, extracted 2026-08-28. Treat with the same authority as a locked
decision.

| Directive | Where it binds this phase |
|---|---|
| Python backend must use a `venv` | all five new routes + their pytest suites |
| No LangChain / LangGraph; Pydantic for structured outputs | the five new response models |
| **All tables need Row-Level Security** | ⚠ **read § *The RLS asymmetry***: the three child tables have policies, but they are **not the same policy**. No new table, so no new policy — but the plan must not assume symmetry |
| **Stateless / no provider-side state** | n/a — no provider call in this phase |
| **D-v2.5-01** — no blocking I/O in an async handler; wrap `supabase-py` with `run_in_threadpool` | **all five new routes.** ⚠ The nearest sibling (`list_documents`, `documents.py:711-769`) **violates this** — it calls `.execute()` four times bare inside an `async def`. Do not copy it. Copy `read_path` (`kb.py:397-461`), which uses `await aexec(...)` |
| **D-v2.5-03** — Realtime is a hint, not truth; reconcile via fetch | D-217-10 is precisely this. `useDocuments.ts:44-58` is the reconcile site |
| Schema changes ship as numbered migrations, applied by SQL editor, never `db push` / `db reset` | **no migration in this phase** — verified: every column SC#4 needs already exists (§ *ZERO schema, verified*) |
| Settings live in `user_settings` / `app_settings`, not env | tab 4's active embedding model reads `app_settings.embedding_model` (already read at `documents.py:2043-2049`) |
| **CLAUDE.md 150,000-char gate** | if the phase adds a hot-file-ledger row, run `node scripts/check-claude-md-size.cjs`; disposition cells cap at 200 chars |
| **Deployment-artifact parity (same-commit)** | ⚠ **not triggered** — this phase adds no env var, no seed row, no bundled service, no sandbox-image change. State that explicitly rather than leaving it ambiguous |
| **Hot-file ledger same-commit sync rule** | a row here and its section in `docs/HOT-FILE-LEDGER.md` change in the same commit. ⚠ **The rename `IngestionPage.tsx` → `LibraryPage.tsx` invalidates the row's PATH and its anchor** (`#frontendsrcpagesingestionpagetsx`) — both must move in the rename commit or the ledger points at a file that no longer exists |
| **Reported-bugs cross-check at `/gsd:plan-phase`** | verify every report with `folded_into: 217` is covered. ⚠ **Measured: there are none** — CONTEXT's `<deferred>` records that the sweep found no open `surface: Agentic-RAG` report whose `affected_areas` overlaps this domain |
| **G-2 / G-4 / G-5 / G-7** | G-2 satisfied by sketch 218 (D-217-02); G-5 honoured by construction (D-217-01) — **five ledger sections must be read before writing tasks**; G-4 rows are mandatory (this is a user-visible UI phase) |

---

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| The Library tab shell + which tab is active | Browser / client | — | No URL router exists (`SEED-185`); navigation is `ActiveView` + a branch chain. Tab state is component-local by construction |
| `librarySelection` (folder ⊕ view ⊕ tab) | Browser / client | — | It is a *selection*, not a persisted preference. Nothing server-side owns it today (`IngestionPage.tsx:79-103`) |
| Which documents match a saved view | API / backend | — | Already `POST /document-views/resolve*` (`resolveView` / `resolveAdHoc`, `api/knowledge.ts:271,293`). The client never filters a view itself |
| Full parsed text of a document | API / backend | — | `documents.full_markdown` never leaves Postgres today. A line-range slice is a server concern (the client must not download a megabyte to show 40 lines) |
| Extracted tables / images / chunks | API / backend | — | RLS-gated child tables; the browser has no direct DB access |
| "The questions that found it" | API / backend | — | `audit_log` has **no** authenticated SELECT policy (`108_*.sql` adds none). Only the server can read it |
| The six ingestion stage markers | API / backend (write) → Realtime + fetch (read) | Browser (render) | The column is written by a `BackgroundTask`; the browser gets it two ways and **must reconcile by fetch** (D-v2.5-03) |
| Whether a conditional stage is *applicable* | **API / backend (recommended)** | Browser (fallback) | It is derived from mime-type constants that live in `multimodal_service.py`. Deriving it client-side duplicates the list — the exact drift D-217-18 forbids for the accept list |
| Upload byte progress | ⛔ nowhere | — | `onUploadProgress` does not exist in the path. No tier can supply it |
| Re-embed coverage | API / backend | Browser | `getReembedProgress` already returns `{re_embedded, total, remaining, status}` derived live from `document_chunks` |
| Tab-bar contrast tokens | CDN / static (CSS) | — | `frontend/src/index.css` `:root` / `.dark` blocks; Tailwind maps them in `tailwind.config.js:20-95` |

---

## The measurement that changes the plan — EXTENDED

CONTEXT already carries the six-fact table. **Do not re-derive it.** What follows is new, measured
this session, and each item changes a task the planner would otherwise write.

### ZERO schema — verified independently, and it holds

| Column | Exists | Evidence |
|---|---|---|
| `documents.full_markdown` | ✅ | written `documents.py:2270`; `supabase/full-schema.sql` carries the column |
| `documents.extractor` | ✅ | written `documents.py:2272`; reset to NULL on reextract `:1308` |
| `documents.ingestion_step` | ✅ | added by `supabase/migrations/032_phase56_realtime.sql:13`; `full-schema.sql:1002` |
| `document_chunks.content` | ✅ | `full-schema.sql:865` (`content text NOT NULL`) |
| `document_chunks.embedding_model` | ✅ | `full-schema.sql:870` (nullable `text`) |
| `document_tables.headers` / `.rows` | ✅ | `full-schema.sql:941-942` (`jsonb NOT NULL DEFAULT '[]'`) |
| `document_images.description` | ✅ | `full-schema.sql:893` (`text NOT NULL DEFAULT ''`) |
| `audit_log` `search.query` rows | ✅ | written `tool_dispatcher.py:798` and `:961` |

**No migration is required by this phase.** [VERIFIED: read from `supabase/full-schema.sql` and the
migration files in this session]

### ⚠ NEW — the RLS asymmetry the "four routes need no exception" claim hides

CONTEXT says *"the user-JWT client suffices for four of the five routes."* True — but the four are
**not equivalent**, measured verbatim:

| Table | SELECT predicate | Source |
|---|---|---|
| `documents` | owner **OR** in a globally-visible folder (app-level merge) | `documents.py:723-736` — `list_documents` fetches own rows *and* `get_globally_visible_folder_ids` rows |
| `document_chunks` | `org_id ∈ current_user_org_ids() AND (auth.uid() = user_id OR EXISTS(documents d WHERE d.id=…, d.folder_id IS NOT NULL, folder_is_globally_visible(d.folder_id)))` | `110_*.sql:215-223` (widened by PRAG-01 / D-164-07) |
| `document_images` | `org_id ∈ current_user_org_ids() AND user_id = auth.uid()` — **OWNER-ONLY, no folder branch** | `108_*.sql:180-183` (`FOR ALL`) |
| `document_tables` | `org_id ∈ current_user_org_ids() AND user_id = auth.uid()` — **OWNER-ONLY, no folder branch** | `108_*.sql:186-189` (`FOR ALL`) |
| `audit_log` | ⛔ **no authenticated SELECT policy at all** | `108_*.sql` adds INSERT only — this is why D-217-07 exists |

**Consequence a plan must encode, not discover:** open a document that lives in someone else's
**globally-visible folder**. `/content` and `/chunks` return data; `/tables` and `/images` return an
**empty list**. That is *internally consistent with today's UI* — `list_documents`'s `table_count` /
`image_count` aggregate is computed through the same user-JWT client (`documents.py:747-770`), so the
row already reads `0 tables` for such a document. **So the panel does not lie.** But:

- A test that seeds a global-folder document and asserts tables come back **will fail correctly**,
  and a planner who has not read this will call it a defect.
- The honest copy for the empty arm is *"No tables"* — not *"You cannot see these"* — because the
  count badge on the same row already says `0`.
- ⚠ **Widening those two policies is OUT OF SCOPE** (it is a migration and a security decision; it is
  also not required by any success criterion). If a plan reaches for it, it has left the phase.

[VERIFIED: `supabase/migrations/108_*.sql:166-189`, `110_*.sql:209-223`, read 2026-08-28]

---

## SC#4 — the five new routes, concretely

### The auth split

| Route | Client dependency | Why |
|---|---|---|
| `GET /documents/{id}/content` | `Depends(get_user_supabase_client)` | RLS on `documents` covers owner + global folder; `read_path` already proves the shape |
| `GET /documents/{id}/chunks` | `Depends(get_user_supabase_client)` | mig 110 widened `document_chunks` SELECT to match |
| `GET /documents/{id}/tables` | `Depends(get_user_supabase_client)` | owner-only policy; see asymmetry above |
| `GET /documents/{id}/images` | `Depends(get_user_supabase_client)` | owner-only policy |
| `GET /documents/{id}/queries` | **`Depends(get_supabase)` — SERVICE-ROLE (classified)** | `audit_log` has no authenticated SELECT policy (D-217-07) |

`get_user_supabase_client` is defined at `backend/app/dependencies.py:291-296`. The service-role
dependency is `get_supabase`. [VERIFIED]

### The classified service-role exception — the exact shipped precedent to copy

`backend/app/api/knowledge_health.py:1-12` is the **module docstring** carrying the exception. Read it
verbatim; the pattern has three parts, all three of which the `/queries` work must reproduce:

1. **A module-level docstring** naming (a) which table forces it, (b) that the table's RLS is
   INSERT-only so a user-JWT client would *silently read back an empty set*, (c) that every query
   stays owner-scoped **in app code** via `.eq("user_id", user_id)` as the **sole gate**, and (d) that
   it is read-only and parameterized.
2. **A trailing comment on every `Depends(get_supabase)` parameter**, repeated per route, verbatim:
   `# SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring`
   (`knowledge_health.py:559, 576, 594, 613, 631, 649, 667, 684`).
3. **`user_id` taken from `current_user["id"]`, never from the request**, and applied as
   `.eq("user_id", user_id)` in the query itself (`knowledge_health.py:57`).

⚠ **`/queries` will live in `documents.py`, which is otherwise a user-JWT module.** A module docstring
there cannot say "the module is uniformly service-role" — the honest form is a **route-level
docstring** stating the carve-out plus the same inline comment, and saying explicitly that this is
the *only* service-role route in the module. Consider instead a small dedicated module (e.g.
`backend/app/api/document_queries.py`) so the exception has ONE auditable rationale exactly as
`knowledge_health.py` argues for. **Recommend the dedicated module** — `knowledge_health.py`'s own
docstring gives the reason: *"the module is kept uniformly service-role so the surface has ONE
auditable rationale rather than a per-handler split."*

### The `audit_log` `search.query` row shape — measured, not assumed

Two writers, both `write_audit_entry(...)` fire-and-forget:

- `tool_dispatcher.py:796-801` — `metadata={"query_text": args["query"], "document_ids": [...]}`
- `tool_dispatcher.py:958-965` — `metadata={**via_meta, "document_ids": [...]}` where `via_meta`
  carries `via: "view"|"filter"` (D-115-10). `query_text` may therefore be **absent** on these rows.

Columns available: `user_id`, `action_type`, `metadata` (jsonb), `created_at`.
`knowledge_health.py:55-61` is the canonical read.

**Two ways to filter per document; both are shipped patterns:**

| Approach | Shape | Trade-off |
|---|---|---|
| **Fetch-then-filter in Python** (the `knowledge_health` precedent) | `.eq("user_id", uid).eq("action_type","search.query").gte("created_at", cutoff)` then `if doc_id in row["metadata"]["document_ids"]` | Reads every search row in the window for that user. Matches the shipped code exactly. `knowledge_health.py:52-77` |
| **PostgREST jsonb containment** | `.contains("metadata", {"document_ids": [doc_id]})` — uses `@>` | Filters in Postgres. ⚠ **Shipped precedent exists** at `document_view_resolver.py:243`. ⚠ No GIN index on `audit_log.metadata` was found — verify before claiming a performance win |

**Recommendation:** use `.contains(...)` **in addition to** the three `.eq`/`.gte` filters, then still
guard in Python (`doc_id in meta.get("document_ids", [])`), because containment on a jsonb array of
strings is exact and cheap to double-check. Fall back to the `knowledge_health` shape if containment
misbehaves against the local DB. Either way: the window constant is **`WINDOW_DAYS = 30`**
(`knowledge_health.py:28`) and sketch 218's fence `A6e` asserts every retrieval count on the surface
is labelled *30 days* — **using a different window here breaks a live assertion.**

⚠ `query_text` can be `None` on `via:"view"` rows. The empty arm must say something honest
(*"a saved view returned it"*), never render `undefined`.

### `/content` — what `kb.py` actually does, and what it should NOT copy

⚠ **CONTEXT cites `kb.py:404`. Measured line numbers are different, and the difference matters:**

| Thing | Measured location |
|---|---|
| `read_path(document_id, user_id, supabase, start_line, end_line)` | `backend/app/api/kb.py:397-461` |
| The owner-then-global-folder two-step fetch | `kb.py:405-425` |
| The slice + **line-number prefixing** | `kb.py:437-451` |
| `GET /kb/read` route | `kb.py:464-481` |
| `ReadResponse` model | `backend/app/models/kb.py:70-76` |

The params are **`start_line` / `end_line`** (1-based, inclusive, `Query(ge=1)`), **not** `from` /
`to`. `ReadResponse` = `{document_id, filename, total_lines, content, start_line?, end_line?}`.

⚠ **THE ONE THING NOT TO COPY:** when sliced, `read_path` returns content **with a line-number prefix
on every line** — `f"{start_line + i}: {line}"` (`kb.py:446`). That exists because an agent needs
addressable lines. **A human reading their own document must not get `42: ` glued to every line**, and
Markdown rendering would break outright. So:

- **Reuse:** the function signature, the 1-based inclusive semantics, the out-of-bounds error string,
  `total_lines` in the envelope, the owner→global-folder fallback.
- **Do not reuse:** the numbering. Either add a `numbered: bool = False` parameter to `read_path` (one
  function, two callers — the D-217-05 "one pattern, not two" spirit) or have the new route call
  `read_path` and strip. **Recommend the parameter**, defaulted to today's behaviour so `/kb/read` is
  byte-identical.

**Envelope for `/documents/{id}/content`:** `{document_id, filename, total_lines, start_line,
end_line, content, has_more}`. `has_more` is `end_line < total_lines` — derivable client-side from
`total_lines`, but returning it makes the "Load more" button's condition unambiguous and costs
nothing. `ReadResponse` already carries everything except `has_more`.

⚠ `read_path` returns `{"error": ...}` and the route converts it (`kb.py:478-480`):
`if "error" in result: raise HTTPException(404, detail=result["error"])`. **That folds "no content
available" into a 404**, which for the Library is wrong — a document that ingested with empty text is
not a missing document. Return **200 with `content: "", total_lines: 0`** and let the section render
its empty arm. This is a real difference from the tool route and must be a task, not a footnote.

### The threadpool shape — copy `aexec`, not `list_documents`

```python
from app.utils.db import aexec  # backend/app/utils/db.py:47-58 — run_in_threadpool(query.execute)

res = await aexec(
    supabase.table("document_chunks")
    .select("id, chunk_index, content, embedding_model, embedding_dimensions")
    .eq("document_id", document_id)
    .order("chunk_index")
)
rows = res.data or []
```

⚠ **`list_documents` (`documents.py:711-769`) is a D-v2.5-01 violation in shipped code** — four bare
`.execute()` calls inside an `async def`. `documents.py` uses `run_in_threadpool` **55 times**
elsewhere (measured `grep -c`), so this is an outlier, not the house style. **Copying the nearest
neighbour would be copying the bug.** Fixing `list_documents` is out of scope for this phase; adding
five more instances of it is not acceptable.

### Response models — the convention

`documents.py` declares small `BaseModel`s inline near the top (`ReextractRequest` at `:60`). The
document models live in `backend/app/models/document.py` (48 lines). Recommend **new models in
`backend/app/models/document.py`** beside `DocumentResponse`, since they are document-shaped:

```python
class DocumentChunkRow(BaseModel):
    id: UUID
    chunk_index: int
    content: str
    embedding_model: str | None = None
    embedding_dimensions: int | None = None

class DocumentTableRow(BaseModel):
    id: UUID
    page: int | None = None
    table_index: int
    headers: list[str] = []
    rows: list[list[str]] = []
    extractor: str | None = None

class DocumentImageRow(BaseModel):
    id: UUID
    page: int | None = None
    image_index: int
    description: str = ""

class DocumentQueryRow(BaseModel):
    query_text: str | None = None
    asked_at: datetime
    via: str | None = None       # "view" | "filter" | None (a direct search)

class DocumentContentResponse(BaseModel):
    document_id: UUID
    filename: str
    total_lines: int
    content: str
    start_line: int | None = None
    end_line: int | None = None
    has_more: bool = False
```

⚠ **`document_images` has NO image bytes.** Measured columns: `id, document_id, user_id, page,
image_index, description, created_at, bbox, org_id` (`full-schema.sql:887-897`). The b64 PNG is fed
to the vision model and **discarded**. So SC#4's *"image descriptions"* is exactly what can ship —
**a thumbnail cannot**, and a plan that draws one has drawn a thing that does not exist.

### 404 shape

`documents.py` uses `raise HTTPException(status_code=404, detail="Document not found")` after a
`maybe_single()` ownership check (`documents.py:783-791` is the cleanest instance). All five new
routes should do the parent-document existence check first, in one shared private helper, so a
document the caller cannot see returns **404, never an empty 200** (an empty 200 for a forbidden
document is an information leak of the weakest kind, but it also makes the panel say *"no chunks"*
about a document it should not be showing at all).

### Router / registration

`router = APIRouter(prefix="/documents", tags=["documents"])` at `documents.py:89`; registered
`app.include_router(documents.router)` at `main.py:755`. A new `document_queries.py` module needs its
own `include_router` line and an import on `main.py:751`. [VERIFIED]

### Frontend client functions

New client fns belong in **`frontend/src/lib/api/documents.ts`** (where `listDocuments` /
`uploadDocument` / `deleteDocument` live, `:15-40`), following the shipped shape:

```ts
const headers = await getAuthHeaders()
const res = await fetch(`${API_BASE}/documents/${id}/chunks`, { headers })
if (!res.ok) throw new Error("Failed to load chunks")
return res.json() as Promise<DocumentChunkRow[]>
```

⚠ They must be **re-exported from the barrel `frontend/src/lib/api.ts`** — every consumer imports
from `@/lib/api`, and 196-08 measured 249 red tests from one mis-handled export. ⚠ **The barrel
completeness test only covers `connectors.ts`** (`frontend/src/lib/__tests__/apiBarrel.test.ts:11`),
so a missing `documents.ts` re-export is **not caught by any test today**. Either extend
`apiBarrel.test.ts` to loop over `documents.ts` too (cheap, and it is already in TARGETS **and**
BASELINE at 3) or accept that this is an unguarded step.

---

## The lazy-fetch section pattern — answered from the source

### What `PanelSection` actually does

`frontend/src/components/panel/PanelSection.tsx` (101 L):

- `defaultOpen = true` is the **prop default** (`:47`).
- `const [open, setOpen] = useState(defaultOpen)` (`:49`) — state is **fully internal**.
- **There is no `onOpenChange` / `onToggle` prop.** The `PanelSectionProps` interface
  (`:23-30`) is exactly `{title, count?, warn?, defaultOpen?, children}`.
- ⭐ **The body is conditionally rendered: `{open && (<div …>{children}</div>)}` (`:93`).**

That last line is the whole answer. **React does not mount `children` while `open` is false.** So a
child component's `useEffect` fires **on first expand**, not on parent mount — *for free*, with no
new prop.

### Why the shipped Relationships section still fetches on mount

`DocumentDetailPanel.tsx:265-275` mounts it as `<PanelSection title="Relationships" count={…}>` —
**no `defaultOpen` prop**, so it inherits `true`, so it is open, so
`RelationshipsSection.tsx:96-99`'s bare `useEffect` fires immediately. Same for Classification
(`:279-289`) and Metadata (`:242-248`, which passes `defaultOpen` explicitly). [VERIFIED]

### The minimal correct shape

**Pass `defaultOpen={false}`.** That alone converts fetch-on-mount into fetch-on-first-expand. No
change to `PanelSection` is required.

What it does **not** give you is *once*: collapsing unmounts the child, re-expanding remounts it and
refetches. Three options, in order of preference:

1. **Accept the refetch.** It is a GET, it is cheap for chunks/tables/images/queries, and it means the
   data is fresh. ⚠ **Not acceptable for `/content`** — that is the possibly-megabyte blob.
2. **Hoist the loaded state into `DocumentDetailPanel`**, keyed by `doc.id`, and pass it down. The
   panel already hoists `relTotal` and `classCount` (`:139`, `:265-273`) for the count badges, so the
   lifting pattern is established. This is the recommendation **for `/content` only**.
3. **Add `onOpenChange?: (open: boolean) => void` to `PanelSection`** and render children always,
   hiding with CSS. ⚠ **Rejected** — it changes the primitive for three other consumers and defeats
   the free lazy behaviour the current implementation gives.

**Recommended state machine for each new section** (four arms, all four distinct — the D-117-10
honesty rule the shipped `RelationshipsSection` already follows):

```
idle → loading (role="status" aria-live="polite")
     → ready & rows.length > 0   → the content
     → ready & rows.length === 0 → the EMPTY arm, worded ("No tables in this document.")
     → error (role="alert")      → the ERROR arm, distinct from empty
```

Key on `docId` in the `useCallback` dependency (`RelationshipsSection.tsx:73-91` is the shipped
shape) so switching documents re-fetches. Lift the loaded total via `onTotalChange` so the
`PanelSection` count badge is populated — ⚠ but note the badge then reads `—` until first expand,
which is honest (unknown ≠ zero) and should be *stated in the plan* rather than fixed by an eager
count query.

---

## SC#3 — the six-stage strip

### The write order — CONFIRMED at all six line numbers

| # | Line | Value written | Conditional? |
|---|---|---|---|
| 1 | `documents.py:1834` | `"extracting"` | always (inside `try`, immediately after `status='processing'` at `:1831`) |
| 2 | `documents.py:2014` | `"chunking"` | always |
| 3 | `documents.py:2042` | `"embedding"` | always |
| 4 | `documents.py:2080` | `"extracting_tables"` | **inside `if raw and mime_type:` (`:2074`)** |
| 5 | `documents.py:2091` | `"extracting_images"` | **same `if` block** |
| 6 | `documents.py:2201` | `"metadata"` | always |

D-217-09's order is confirmed exactly. [VERIFIED 2026-08-28]

### Where it reaches the browser

- **Type:** `frontend/src/types/index.ts:499` carries `ingestion_step`.
- **Only path today:** the Supabase Realtime `UPDATE` payload, spread-merged at
  `useDocuments.ts:56-58` (`prev.map(d => d.id === newDoc.id ? {...d, ...newDoc} : d)`).
- **Consumer:** `DocumentList.tsx:422` → `<DocumentStatusBadge status={doc.status}
  ingestionStep={doc.ingestion_step} />`.
- **Badge behaviour:** `DocumentStatusBadge.tsx:27-32` builds the term key as
  `status === "processing" ? ("ingest.<step>" if in TERM_MAP else "status.processing") :
  "status.<status>"`. **It ignores `ingestion_step` entirely unless `status === "processing"`.**
- **Labels:** all six have plain-language entries — `termMap.ts:38,43,48,53,58,63`
  (`"Reading the file"`, `"Reading tables"`, `"Reading images"`, `"Splitting into sections"`,
  `"Making it searchable"`, `"Reading document details"`), each with a `helper` and a `technical`
  form for the ⌥ reveal. ⚠ **These are already written; the strip should render `usePlainLabel`, not
  invent a seventh vocabulary.** Sketch fence `A5c` asserts termMap carries all six.

### ⚠ THE THREE MEASURED FACTS THAT DECIDE WHAT "SKIPPED" CAN HONESTLY MEAN

**Fact 1 — the column is never cleared.** The terminal write
(`documents.py:2266-2273`) sets `status, chunk_count, metadata, full_markdown, extractor`; it does
**not** null `ingestion_step`. The failure write (`:2292-2295`) sets `status, error_message` only.
The **only** reset is `/reextract` (`:1308`). So:

- A `completed` document permanently reads `ingestion_step = "metadata"`.
- A `failed` document permanently reads the last step it reached. ⚠ **This is load-bearing
  elsewhere** — `text_sanitize.py:9` diagnoses the BUG-260825-01 NUL defect by reading
  `status=failed / ingestion_step=embedding`. **Do not "fix" it by nulling the column**; that would
  delete a diagnostic.

**Fact 2 — the two conditional stages are one condition, not two.** They are both inside
`if raw and mime_type:` (`documents.py:2074`). They can never be skipped independently.

**Fact 3 — the marker is written even when the extractor does nothing.** Both markers are set
*before* the call, and `extract_and_store_tables` / `extract_and_store_images` `return` immediately
for an unsupported mime (`multimodal_service.py:502` and `:759`). So observing
`ingestion_step="extracting_tables"` proves **nothing** about whether tables were looked for.

**Which mime types actually reach an extractor** (`multimodal_service.py:26-32, 491-501, 755-758`):

| Stage | Applies when `mime_type` ∈ |
|---|---|
| **Tables** | `application/pdf` · the DOCX mime · `text/csv`, `application/csv` · the XLSX mime, `application/vnd.ms-excel` |
| **Images** | `application/pdf` · the DOCX mime **only** |

⚠ The `extracted_doc` fast path (`:479`) can supply tables/images for **any** mime when Docling
pre-extracted them — so the mime list is *"where a legacy pass will look"*, and a truthful strike-out
rule is **"strike only when the mime is outside the set AND no rows exist"**, i.e. a stage is
`skipped` iff `!appliesToMime(mime) && count === 0`.

**Recommendation (this is Claude's-discretion territory — D-217-19 fixes the *rendering*, not the
*derivation*):** add two derived booleans to `DocumentResponse`, computed on the server from the same
`multimodal_service` frozensets:

```python
tables_stage_applies: bool   # mime in {PDF, DOCX} | CSV_MIMES | EXCEL_MIMES
images_stage_applies: bool   # mime in {PDF, DOCX}
```

This is D-217-18's principle applied to a second list: **one list, so the strip cannot advertise a
stage the pipeline would never run.** It costs two lines in `models/document.py` and one small helper
in `multimodal_service.py`; it costs nothing at query time. The alternative — hardcoding the mime
sets in TypeScript — creates the exact drift D-217-18 exists to prevent, and nothing would catch it.

**The strip's honest render, per document status:**

| `status` | Render |
|---|---|
| `pending` | all six segments *pending* — the file has not started |
| `processing` | segments **up to and including** `ingestion_step` = done; the current one = active; later = pending; inapplicable conditionals = **struck through** |
| `completed` | all applicable segments done; inapplicable conditionals **struck through**. ⚠ Do **not** read `ingestion_step` here — it is `"metadata"` by residue, not by observation |
| `failed` | segments up to `ingestion_step` = done; **the step itself = the failure point** (this is the diagnostic `text_sanitize.py` relies on); later segments = *not reached*, a **third** visual state that is neither pending nor skipped |

⚠ **`failed` needs a third state and nothing in CONTEXT or the sketch names one.** "Struck through =
skipped" and "empty = pending" leaves *"never got there because it broke"* with no rendering. Flag
this to the operator at plan time; the cheapest honest answer is to dim later segments and let the
row's existing `error_message` carry the reason (`DocumentList` already renders it).

---

## SC#4 — `DocumentResponse` + the Realtime reconcile

### The model change

`backend/app/models/document.py:30-48` — `DocumentResponse` (48-line file). Add:

```python
    extractor: str | None = None          # D-217-08
    ingestion_step: str | None = None     # D-217-10
    tables_stage_applies: bool = False    # recommended, see SC#3
    images_stage_applies: bool = False
```

**All four MUST have defaults.** Measured: of the eleven routes returning `DocumentResponse`, the
`select("*")` ones (`:718`, `:731`, `:794`, `:813`, `:875`) will carry the columns automatically, and
the INSERT at `:667-669` returns the full representation — but the narrow-select routes (`:1506`
`select("id")`, `:1519`, `:1572` `select("metadata")`, `:1671`, `:1757`) **build their responses from
partial rows**. A required field would 500 those routes. [VERIFIED — this is the single most likely
way to break `/move`, `/metadata`, `/classification/*`]

⚠ **Which routes construct the response is worth one grep at plan time**, because the narrow selects
above are *reads before a write*; the final response may still come from a full row. The safe rule
stands regardless: **default every new field.**

### Does the Realtime merge need changing?

**No — measured, and the reasoning matters.**

`useDocuments.ts:56-58` spread-merges `{...d, ...newDoc}` because `table_count` / `image_count` are
**app-computed aggregates absent from the payload** (`documents.py:747-770`), so a naive replace would
zero them. `ingestion_step`, `extractor` and `chunk_count` are **real `documents` columns**, so they
ARE in `payload.new` and the merge propagates them correctly. The two new derived booleans
(`tables_stage_applies`, `images_stage_applies`) are **not** columns — they behave like
`table_count`, and the spread-merge protects them **exactly as it protects the counts**. No change.

⚠ **What DOES need care:** the `INSERT` arm (`useDocuments.ts:63-69`) casts `payload.new as Document`
with **no merge**, so a freshly inserted row arrives without the derived booleans. In practice the
optimistic `upload()` add (`:88-95`) inserts the API's own `DocumentResponse` first and the INSERT
arm short-circuits (`if (prev.some(d => d.id === newDoc.id)) return prev`) — but a document uploaded
in *another tab* takes the raw path. The derived booleans must therefore be **optional on the
frontend type** and the strip must tolerate `undefined` (render the conditional stage as *pending*,
not *skipped* — the honest arm when applicability is unknown).

### The D-217-10 fix, end to end

Adding `ingestion_step` to `DocumentResponse` is sufficient. `list_documents` already does
`select("*")` (`:718`), so the value is in the dict; FastAPI's `response_model` was the only thing
stripping it. **Two lines of backend change close a defect that no mocked-fetch test can see.**

---

## SC#5 — the `librarySelection` blast radius

`frontend/src/pages/IngestionPage.tsx` — **601 lines, measured 2026-08-28.** There is **no
`activeTab` today**; `grep -n activeTab` returns nothing. The tab shell is net-new (SEED-224 §3
measured the same).

### Every consumer of the three pieces of state D-217-12 collapses

**`selectedFolderId`** — declared `:79`.

| Line | Use |
|---|---|
| `:171-174` | `selectedFolderName` memo (drives the upload button's label) |
| `:177-179` | `selectedFolder` memo |
| `:181` | `canUploadToFolder` — ownership gate on the dropzone |
| `:184-186` | `folderDocuments` memo (feeds `FolderDetail`) |
| `:189-191` | `subfolderCount` memo |
| `:241` | `setSelectedFolderId(id)` in `handleSelectFolder` |
| `:252` | `setSelectedFolderId(null)` in `handleSelectView` — **the mutual exclusion** |
| `:263` | `setSelectedFolderId(null)` in `handleEditView` |
| `:307` | `<FolderTree selectedFolderId={selectedViewId === null ? selectedFolderId : null} …>` — ⚠ **the exclusion is ALSO expressed here, a second time, as a render-time ternary.** Two places already encode one invariant |
| `:332` | `listFolderId = filteredDocs !== null ? undefined : selectedFolderId` |
| `:479`, `:488`, `:492` | header-band render branches (Root / breadcrumb) |
| `:521` | `<DocumentUpload folderId={selectedFolderId} …>` |

**`selectedViewId`** — declared `:83`.

| Line | Use |
|---|---|
| `:242` | `setSelectedViewId(null)` in `handleSelectFolder` — **the second half of the pair CONTEXT cites** |
| `:251` | `setSelectedViewId(view.id)` |
| `:262` | `setSelectedViewId(view.id)` in edit |
| `:275` | `setSelectedViewId(null)` in `handleFilterChange` — ⚠ **editing the filter bar silently drops the view selection.** A tab that shows "Views" would have to follow this too, or the tab lies |
| `:281` | `setSelectedViewId(view.id)` after save |
| `:293-297` | delete cleanup |
| `:307` | the `FolderTree` ternary above |
| `:319` | `<ViewsGroup selectedViewId={selectedViewId} …>` |
| `:479`, `:488`, `:504`, `:507`, `:516` | header-band + upload-visibility branches |

**Coupled state D-217-12 must not forget** — these are *not* in the union but change with it:

| State | Line | Coupling |
|---|---|---|
| `editingView` | `:87` | cleared at `:243`, `:252`, `:264`, `:282`, `:292` — every selection transition |
| `filter` | `:100` | set at `:244` (EMPTY), `:253`, `:265`, `:274`, `:295` |
| `filteredDocs` | `:103` | set at `:217`, `:228`, `:233`, `:245`, `:296`; **it is the real list switch** at `:331-332` |
| `matchCount` | `:107` | paired with `filteredDocs` |
| `filterReqId` | `:108` | the stale-resolve guard (`:222`, `:226`) |
| `folderSheetOpen` | `:94` | closed at `:246`, `:254` |

**Blast-radius verdict:** the union in D-217-12 owns three fields, but **six more pieces of state
transition in lockstep with it** across five handlers (`handleSelectFolder` `:240-247`,
`handleSelectView` `:250-257`, `handleEditView` `:259-267`, `handleFilterChange` `:272-276`,
`handleDeletedView` `:290-298`). A reducer that owns only `{tab, folderId, viewId}` and leaves the
other six as `useState` **has not created one source of truth** — it has created a seventh. The
recommendation is a **single `useReducer` over a `LibraryState` covering selection + filter +
resolved-list identity**, with `filteredDocs` / `matchCount` remaining separate (they are *async
results*, not selection). ⚠ This is precisely the ledger's named seam for this file: *"extract the
shell first and let each tab own its body — otherwise the tab bar becomes the tenth conditional
branch."*

---

## SC#1 — the rename's true blast radius

`grep -rn "IngestionPage"` over `frontend/src`, `scripts`, `.planning/sketches`, measured
2026-08-28. **Only ONE import site.**

### Must change (code)

| File | Line | What |
|---|---|---|
| `frontend/src/pages/IngestionPage.tsx` | — | **git mv → `LibraryPage.tsx`** |
| `frontend/src/pages/IngestionPage.tsx` | `:75` | `export function IngestionPage(` → `LibraryPage` |
| `frontend/src/pages/IngestionPage.tsx` | `:338` | `<h1 …>Documents</h1>` → `Library` |
| `frontend/src/pages/IngestionPage.tsx` | `:339-341` | the subtitle — `BUILD-CONTRACT` pins the new one: *"What the agent can read, and how well it reads it."* |
| `frontend/src/components/layout/ChatLayout.tsx` | `:8` | `import { IngestionPage } from "@/pages/IngestionPage"` — **the only import** |
| `frontend/src/components/layout/ChatLayout.tsx` | `:758` | `<IngestionPage onNavigate={onNavigate} />` |
| `frontend/src/lib/nav-items.ts` | `:37` | `label: "Documents"` → `"Library"`. ⚠ **`view: "documents"` is UNCHANGED** — confirmed the entry is `{ view: "documents", icon: FileText, label: "Documents" }` |

### Must change (tests)

| File | Lines |
|---|---|
| `frontend/src/__tests__/components/IngestionPage.test.tsx` (158 L) | `:2`, `:106`, `:124-125`, `:130-131`, `:135`, `:144-145`, `:151-152` — the file itself should be renamed `LibraryPage.test.tsx` |

### Comment-only references (should change, cannot break the build)

`App.tsx:288,290` · `ClassificationRulesPage.tsx:29` · `FilterBar.test.tsx:127` ·
`DocumentDetailPanel.tsx:307` · `RelationshipsSection.tsx:9` · `citationNav.tsx:11,56,129` ·
`GovernancePage.tsx:95` · `types/index.ts:328`.

### Must NOT change

- **`ActiveView`** — `frontend/src/App.tsx:102` keeps `"documents"`. The comment at `:96-101`
  explains why a union member with no branch silently renders Knowledge Health. Untouched.
- **`ChatLayout.tsx:879`** — `) : ( <KnowledgeHealthPage /> )`, the positional fallback. **Phase 218
  owns replacing it.** Sketch fence `A8` reads this exact shape from the live tree; **changing it in
  217 breaks a live assertion.**
- `nav-items.ts:49-50` — the `library-health` and `governance` entries stay.

### ⚠ The ledger row moves with the file

`docs/HOT-FILE-LEDGER.md` has a section `### \`frontend/src/pages/IngestionPage.tsx\`` and CLAUDE.md
carries a table row linking `#frontendsrcpagesingestionpagetsx`. **A git rename invalidates both the
path and the anchor.** Per the same-commit sync rule, both must change in the rename commit,
preserving the section's content (the named seam and the "already named Documents everywhere the user
can see" finding).

---

## SC#2 — the front door, and the ONE format list

### The shipped `accept` string, verbatim

`frontend/src/components/ingestion/DocumentUpload.tsx:132` — a single inline literal on the hidden
`<input type="file" multiple accept="…">`:

```
.txt,.md,.pdf,.docx,.pptx,.xlsx,.csv,.epub,
text/plain,text/markdown,text/csv,application/pdf,application/epub+zip,
<docx mime>,<pptx mime>,<xlsx mime>
```

⚠ **`.msg` and `.eml` are absent** — which is exactly the drift the sketch's own fence caught. ⚠ Note
`application/vnd.ms-excel` (legacy `.xls`) is in the **backend's** table extractor set
(`multimodal_service.py:29-32`) but **not** in the input's accept list.

**The server's gate** is `ALLOWED_MIME_TYPES` at `backend/app/api/documents.py:91`, enforced at
`:555-559` with `detail=f"Unsupported file type: {mime_type}. Allowed: PDF, DOCX, Markdown, plain
text."` ⚠ **That error string is itself stale** — it names four types while the set allows more.
Worth a one-line fix in this phase; it is the same class of lie D-217-18 targets.

**D-217-18's constant should therefore carry three things, not one:** the extension list (for
`accept`), the mime list (for `accept`), and the **human-readable display list**. One export, three
consumers, so a format cannot be advertised that the input refuses.

⚠ **The constant must be checked against `ALLOWED_MIME_TYPES`**, not just against itself. A frontend
constant that is internally consistent and disagrees with the server produces a 422 the user cannot
explain. A `?raw` source fence over `documents.py:91-…` (the sketch's own technique) is the cheap way
to pin it.

### No progress, confirmed

`DocumentUpload.tsx` is 144 lines and contains **no** `XMLHttpRequest`, no `onUploadProgress`, no
`ReadableStream` progress. `uploadDocument` (`lib/api/documents.ts:22-40`) is a plain `fetch` with
`FormData`. The only status is `uploadingCount` → `"Uploading N files…"` (`:53-58`). D-217-19 is
correct and this research adds nothing to it. [VERIFIED]

---

## D-217-20/21 — the tabs primitive, measured in tokens

### Today, verbatim

`frontend/src/components/ui/tabs.tsx` (53 L) — a thin wrapper over `@radix-ui/react-tabs`:

- `TabsList` (`:14-17`): `inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground`
- `TabsTrigger` (`:28-31`): `… rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:… data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm`

### The token values, both themes

`frontend/src/index.css`, `:root` block starts `:17`, `.dark` block starts `:104`.

| Token | `:root` (light) | `.dark` (Deep Midnight) |
|---|---|---|
| `--background` | `220 20% 97%` → **L 97%** (`:19`) | `216 45% 4%` → **L 4%** (`:106`) |
| `--muted` | `220 14% 94%` → **L 94%** (`:29`) | `220 30% 11%` → **L 11%** (`:116`) |
| `--card` | `0 0% 100%` → **L 100%** (`:21`) | `220 30% 7%` → **L 7%** (`:108`) |
| `--accent` | `220 14% 92%` → **L 92%** (`:31`) | `220 25% 14%` → **L 14%** (`:118`) |
| `--border` | `220 13% 89%` → **L 89%** (`:49`) | `220 20% 16%` → **L 16%** (`:142`) |

**Light: active 97% over track 94% = +3 (lighter, correct). Dark: active 4% over track 11% = −7
(DARKER — the inversion).** D-217-21's measurement is confirmed exactly. [VERIFIED]

### ⚠ No existing token is lighter-than-muted in BOTH themes

- `bg-card`: dark 7% < 11% ✗
- `bg-accent`: dark 14% > 11% ✓ but light 92% < 94% ✗ (it inverts the other way)
- `bg-background`: light ✓, dark ✗ (today's bug)

**So the fix requires a NEW token**, not a swap. Recommended shape, matching the repo's own
precedent (`--panel-muted-foreground`, `--panel-status-done`, `--accent-violet` are all
theme-paired variables mapped in `tailwind.config.js:47-64`):

```css
/* :root  — light */   --tab-active: 0 0% 100%;      /* L 100% > muted 94% : +6 */
/* .dark  — deep midnight */ --tab-active: 220 25% 16%; /* L 16% > muted 11% : +5 */
```

```js
// tailwind.config.js, beside the panel-* entries
"tab-active": "hsl(var(--tab-active))",
```

```
data-[state=active]:bg-tab-active
data-[state=active]:text-foreground
data-[state=active]:border data-[state=active]:border-border   // the SECOND, independent cue
data-[state=active]:shadow-sm                                   // keep — it still helps in light
```

⚠ Adding a `border` to the active trigger **changes its box size** unless the inactive state carries
a transparent border of the same width, or `box-shadow: inset 0 0 0 1px` is used instead. The sketch's
own remedy uses `box-shadow: inset` (`drive.cjs:141` asserts `\.tabslist\.remedy[^}]*box-shadow:\s*inset`)
— **follow the sketch: an inset ring, not a border**, so nothing reflows.

### The two other mounts, and what they inherit

`grep -rln 'from "@/components/ui/tabs"' frontend/src` returns exactly:

- `frontend/src/pages/KnowledgeHealthPage.tsx` — four `TabsTrigger`s (`most-retrieved` /
  `never-retrieved` / `stale` / `low-confidence`), pinned by sketch fence `A9`
- `frontend/src/pages/SettingsPage.tsx`

D-217-20's measurement confirmed. Both inherit a **lighter, ringed active tab in dark mode** and a
**slightly lighter (100% vs 97%) active tab in light mode**. ⚠ **`SettingsPage.tsx` fires G-5 at 21
phases** and CLAUDE.md's ledger row for it says its re-open trigger has *already fired* — the plan
must state that this change is a shared-primitive edit, not a Settings edit, and that no
Settings-local branch is touched.

⚠ **Sketch fence `A3b` (`drive.cjs:121-123`) asserts the SHIPPED trigger contains
`data-[state=active]:bg-background`.** Changing it to `bg-tab-active` **fires A3b**. That is
correct behaviour — the fence exists to notice — and it means `drive.cjs` must be updated in the same
commit (see below).

---

## D-217-11 — regenerating the BUILD-CONTRACT is bigger than running `--emit`

### The mechanics

- `node drive.cjs --emit` — plain Node, **zero dependencies** (`fs`, `path` only, `drive.cjs:15-16`).
  Node **v24.19.0** on this box; nothing version-sensitive.
- **cwd-independent**: `DIR = __dirname`, `REPO = path.resolve(DIR, "..","..","..")`
  (`drive.cjs:18-19`), and the output is written to `path.join(DIR, "BUILD-CONTRACT.generated.md")`
  (`drive.cjs:900`). Running it from the repo root works.
- The emitted header stamps `new Date().toISOString().slice(0,10)` — **the date changes on every
  emit**, so the file is never byte-identical across days. That is by design.

### ⚠ MEASURED: the contract is ALREADY STALE at HEAD, before this phase changes anything

| | value |
|---|---|
| `BUILD-CONTRACT.generated.md:6` says | **190 assertions, 0 failing** |
| `node drive.cjs` measured 2026-08-28 | **193 passed · 0 failed · 193 assertions** |
| file mtimes | `BUILD-CONTRACT.generated.md` 20:37 · `drive.cjs` **20:52** |

`drive.cjs` was edited **after** the last emit. **CONTEXT's "190 assertions" is a stale figure, and
the regeneration D-217-11 mandates is owed for a second, independent reason.** Re-derive with
`node drive.cjs` rather than quoting a number.

### ⚠ The live-source assertions that BREAK, named

`src()` reads the live tree at 24 call sites (`drive.cjs:79, 85-98, 239, 434, 494, 500, 506, 551-552,
648, 669, 744, 772`). CONTEXT says "31 of them read the LIVE source tree" — that is an assertion
count, not a `src()` count, and it is stale alongside the 190.

**These fail the moment the phase's work lands:**

| Assertion | Line | Why it fails | Fix |
|---|---|---|---|
| `control · the repo is reachable from the sketch` | `:78-80` | reads `frontend/src/pages/IngestionPage.tsx`; after `git mv` it is `null` | point at `LibraryPage.tsx` |
| `const PAGE = src("…/IngestionPage.tsx")` | `:85` | becomes `""`, which silently breaks **every** `PAGE.*` assertion | update the path |
| `A2 · IngestionPage sheds nth-child(n+3)..(-n+5)` | `:111-112` | `PAGE` is empty → false | update path + name |
| `A7b · the nav entry ships as label "Documents" today` | `:197-198` | `nav-items.ts:37` becomes `label: "Library"` | this is a **shipped-state** fence; rewrite it as a rename map the way `A9c` was rewritten (*a verbatim check cannot tell a RENAME from a LOSS*) |
| `A7c · the page h1 ships as "Documents" today` | `:199-201` | the `<h1>` becomes `Library` | same |
| `A3b · shipped TabsTrigger … goes bg-background when active` | `:121-123` | D-217-21 replaces that class | re-pin to the new token; **keep the A4/A4b lightness fences, which still measure `--muted` vs `--background` and stay true** |
| `A5e · the sketch draws the 3-stage version as the REJECTED arm` | `:164-167` | its regex requires `Read…Tbl…Img…Split…Index…Label` **in the sketch's drawn order**, which D-217-09 reverses | edit `index.html`'s stage order **and** this regex **and** `COPY.STAGES` order |

⚠ **`COPY.js:71-78` `STAGES` is ordered `extracting, extracting_tables, extracting_images, chunking,
embedding, metadata`** — the drawn order. `--emit` renders `stageRow` **from `COPY.STAGES`
(`drive.cjs:817`)** while the *"Measured against the live tree"* table renders `uniqueSteps` — which
is the **backend write order** (`drive.cjs:154`, regex-ordered over `documents.py`). **The generated
contract already prints both orders, in two places, disagreeing.** That is the D-217-09 contradiction
made visible inside one file; fixing `COPY.STAGES`'s order makes them agree. ⚠ `A5b` sorts before
comparing, so it will not fire on a reorder — **only `A5e` and the human eye will.**

**So the same-commit obligation is FOUR edits, not one:** `COPY.js` stage order · `index.html` stage
order · `drive.cjs` (5 assertions above) · then `node drive.cjs --emit`. A plan that writes only
*"run --emit"* will discover the rest at execution time.

---

## "Tables as tables" inside 430px — answered from precedent

**Claude's discretion, so it was researched rather than guessed.**

### The two shipped patterns, and they are for different problems

| Pattern | Where | When it is right |
|---|---|---|
| **Column shedding by `nth-child`** | `IngestionPage.tsx:449-452` — `[&_table_th:nth-child(n+3):nth-child(-n+5)]:hidden` when the panel opens or `isMobile` | The hidden columns are **redundant metadata** (Type / Size / Chunks) that the user can get elsewhere. ⚠ It is positional and load-bearing: `DocumentList.tsx:349-355` fixes the order `chevron·Filename·Type·Size·Chunks·Status·Actions`, and the ledger warns *"reordering these columns silently breaks a rule written in a file this one does not import."* |
| **Horizontal scroll container** | `frontend/src/components/panel/CsvTablePreview.tsx:144-145` — `<div className="overflow-x-auto"><table className="w-full border-collapse font-mono text-[13px]">` with `whitespace-nowrap` cells (`:167`) | The table is **user data** whose columns are all meaningful and unknown in advance |

### Recommendation: `CsvTablePreview`'s pattern, not `IngestionPage`'s

An extracted `document_tables` row is arbitrary user data. **Shedding a column of it deletes
information the user opened the panel to see** — the opposite of SC#4. `CsvTablePreview` already
solves exactly this problem **inside the panel**, is 178 lines, and ships four things worth reusing:

1. `overflow-x-auto` + `whitespace-nowrap` (`:144, :167`) — the container scrolls, the data survives.
2. **Size caps before DOM construction** (`:28-29`): `MAX_BYTES = 256_000`, `MAX_ROWS = 2000`, with a
   worded *"File too large to preview"* arm. A `document_tables.rows` jsonb has no size bound; the
   same guard applies.
3. **A graceful "no preview available" arm** for ragged/zero-row data (`:107-115`) — a `headers: []`
   / `rows: []` row is legal in the schema (both default `'[]'::jsonb`).
4. **The security note (`:14-17`)**: every cell renders as a React text child, so a cell containing
   `<img src=x onerror=…>` renders literally. Extracted table content is **untrusted document
   content** and must never reach `dangerouslySetInnerHTML`.

⚠ **`CsvTablePreview` takes a CSV *string*, not `{headers, rows}`.** Do not shoehorn — extract the
table *rendering* (the `overflow-x-auto` wrapper + `<thead>`/`<tbody>` shape + the caps + the empty
arm) into a shared presentational component and let `CsvTablePreview` keep its parser. That is a
small, honest extraction of a component the ledger has not yet flagged.

---

## Don't hand-roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| A tab bar | a custom `role="tablist"` with keyboard handling | `@/components/ui/tabs` (Radix) | D-217-20 locks it; Radix already gives arrow-key roving focus, `aria-controls`, and `data-[state=active]` |
| A collapsible detail section | a new accordion | `PanelSection` | It already gives `aria-expanded`, the mono count badge, the `warn` amber arm, **and free lazy-mount** (`:93`) |
| The saved-views list on tab 2 | a second view list | `ViewsGroup` (`components/ingestion/ViewsGroup.tsx`, 259 L) | D-217-13. It already ships per-view lazy+cached counts, the `G` global pill, and Edit/Rename/Delete. ⚠ Two lists **is** the disagreement SC#5 forbids |
| Re-embed status on tab 4 | a new progress card | `ReembedStatusCard` (`components/settings/ReembedStatusCard.tsx`, 278 L) | D-217-16. It already reconciles-by-fetch, polls only while running, and collapses to nothing when idle |
| A wide table in a narrow panel | a bespoke scroll shim | `CsvTablePreview`'s `overflow-x-auto` + caps + empty arm | see above |
| Line-range paging of `full_markdown` | a new slicer | `kb.py`'s `read_path` (`:397-461`) | D-217-05: one pattern, not two |
| Reading `audit_log` search rows | a new query helper | `knowledge_health.py:52-77`'s shape | D-217-06/07 |
| Wrapping supabase-py off the loop | `run_in_threadpool(lambda: q.execute())` inline | `from app.utils.db import aexec` | It is the shared helper (`utils/db.py:47-58`) and it reads better |
| Stage labels | new strings | `termMap.ts:38-68` + `usePlainLabel` | All six already have plain / helper / technical forms, and the ⌥ reveal works |
| Ingestion status colours | a new palette | `DocumentStatusBadge`'s `styles` map (`:10-14`) | one status vocabulary |

**Key insight:** this phase's honest work is *plumbing already-stored facts to already-built
components*. Almost every net-new artifact is either a **route**, a **response model**, or a **state
reducer**. If a plan is drawing a new component, check the panel and ingestion folders first.

---

## Common pitfalls

### Pitfall 1 — Copying `list_documents`' threadpool discipline
**What goes wrong:** five new async handlers block the event loop.
**Why:** `list_documents` (`documents.py:711-769`) is the nearest neighbour to the new routes and it
calls `.execute()` bare, four times. It is an outlier: `documents.py` uses `run_in_threadpool` 55
times elsewhere.
**Avoid:** `await aexec(...)` on every query. **Warning sign:** any `.execute()` not preceded by
`await` inside an `async def`.

### Pitfall 2 — `defaultOpen` inherited as `true`
**What goes wrong:** five fetches, one of them potentially megabytes, on every document open.
**Why:** `PanelSection.tsx:47` defaults `defaultOpen = true`, and the three shipped mounts
(`DocumentDetailPanel.tsx:242, 265, 279`) rely on that default.
**Avoid:** `defaultOpen={false}` on all five new sections. **Warning sign:** a network panel showing
five requests when a row is clicked.

### Pitfall 3 — Reading `ingestion_step` on a completed document
**What goes wrong:** every finished document renders as if it just finished the *Labelling* stage.
**Why:** the column is never cleared (`documents.py:2266-2273`).
**Avoid:** gate on `status === "processing"` exactly as `DocumentStatusBadge.tsx:27` does.

### Pitfall 4 — A required new field on `DocumentResponse`
**What goes wrong:** `/move`, `/metadata`, `/classification/accept|dismiss` return 500.
**Why:** several routes fetch narrow selects (`documents.py:1506, 1519, 1572, 1671, 1757`).
**Avoid:** default every new field to `None` / `False`.

### Pitfall 5 — Reordering the document-list columns
**What goes wrong:** the wrong columns vanish when the 430px panel opens.
**Why:** the shedding rule lives in `IngestionPage.tsx:449-452` and is **positional**; the columns
live in `DocumentList.tsx:349-355`. Neither file imports the other.
**Avoid:** treat the seven-column order as frozen. Sketch fence `A1` asserts it from the live tree.

### Pitfall 6 — Assuming the four "no-exception" routes behave alike
**What goes wrong:** a test seeds a globally-visible-folder document and expects tables.
**Why:** `document_tables` / `document_images` are owner-only; `document_chunks` is not.
**Avoid:** § *The RLS asymmetry*. Test the global-folder case explicitly and assert the **empty**
result as correct.

### Pitfall 7 — Treating "run `--emit`" as the whole D-217-11 obligation
**What goes wrong:** the contract regenerates and still disagrees with the strip.
**Why:** four artifacts encode the stage order and `--emit` reads two of them.
**Avoid:** § *D-217-11* — four edits, then emit, then `node drive.cjs` must read green.

### Pitfall 8 — A new test file on the wrong side of exactly one gate knob
**What goes wrong:** a suite runs but guards nothing, or is pinned but never executed.
**Why:** `TARGETS` decides what RUNS (paths passed to `vitest run`, `vitest-count-gate.cjs:3295-3984`);
`BASELINE` decides what is GUARDED (keys are **bare filenames**, `:122-2925`, resolved by
`bareName()` at `:4099`). **Only ONE directory entry exists** — `src/components/workflows` — so every
new suite outside it needs an **explicit TARGETS path AND a BASELINE filename key**.
**Avoid:** § *Validation Architecture → the count gate*.

### Pitfall 9 — Deriving conditional-stage applicability in TypeScript
**What goes wrong:** the strip strikes through a stage the pipeline would actually have run, or
leaves one pending forever.
**Why:** the mime sets live in `multimodal_service.py:26-32` and change with the extractor.
**Avoid:** derive server-side (§ SC#3 recommendation). This is D-217-18's principle, one list over.

### Pitfall 10 — Disturbing `ChatLayout.tsx:879`
**What goes wrong:** an unmatched `ActiveView` renders a blank screen.
**Why:** `KnowledgeHealthPage` is the trailing `else`, not a `default:` that throws
(`App.tsx:96-101`). Sketch fence `A8` reads its exact shape.
**Avoid:** 217 touches `:757-758` only.

---

## ⚠ Decisions this research contradicts

**None of the 21 is refuted.** Three need a ruling the decision text does not give, and one carries a
stale figure. All four are raised loudly rather than planned around.

### 1. D-217-16 vs D-217-19 — the shipped `ReembedStatusCard` prints an ETA

**Measured:** `ReembedStatusCard.tsx:31-34` computes `remainingEta()` → `"~3 min"` and renders it at
`:163` under the label **`remaining`**. It also renders a width-percentage bar at `:146`
(`style={{width: \`${pct(progress)}%\`}}`) — the number is *not printed*, but the bar is a percentage.

D-217-19 says *"NO upload percentage and NO ETA, **anywhere**"* and D-217-16 says tab 4 **composes
this card unchanged**. Those two sentences cannot both be satisfied without an edit.

**The distinction is real and defensible:** D-217-19's stated reason is that *"two of the six stages
are decided while the file runs, so there is no honest denominator."* Re-embed **has** an honest
denominator — `total chunks`, derived live from `document_chunks`. So the ETA there is a different
class of claim.

**Recommendation:** rule explicitly at plan time that **D-217-19 scopes the ingestion strip and the
upload path**, and that tab 4's re-embed card keeps its determinate bar. If the operator prefers the
literal reading, the change is `ReembedStatusCard.tsx:163` → print `remaining` as a **count**
(`{remaining.toLocaleString()}` chunks), which is also more consistent with D-217-16's *"numerator
AND denominator, never a percentage."* ⚠ Either way it must be **decided**, because the sketch's own
fence `B4c` (`drive.cjs`, `!/\bETA\b|remaining\b.*\bminutes?\b/i`) would fire if this card's copy
ever reached the sketch surface.

### 2. D-217-19 — "struck through when skipped" has no rendering for `failed`

Four document statuses exist; the decision names two segment states (done/pending) plus
strike-through. A `failed` document's segments **after** the failure point are neither pending nor
skipped — they were *never reached*. See § SC#3. **Needs a third visual state or an explicit ruling
that "pending" is close enough.**

### 3. D-217-05 — the cited line and the numbering behaviour

`kb.py:404` is inside `read_path`'s owner fetch, not the slicing. The params are `start_line` /
`end_line`, not `?from=&to=`. And the reused function **prefixes every line with its number**
(`kb.py:446`), which must not reach a human reader. Neither point changes the decision — *reuse the
line-range shape* — but a plan that copies `read_path` verbatim ships numbered prose. See § `/content`.

### 4. Stale figures in D-217-02 (and therefore in the phase brief)

- "**190 assertions**" — `node drive.cjs` measures **193** (2026-08-28, this session).
- "**31 of them reading the LIVE source tree**" — unverifiable at that number; `src()` is called at
  **24** sites and the §A block that reads the tree contains **~40** `ok(` calls.
- ⚠ `BUILD-CONTRACT.generated.md` (mtime 20:37) **predates** `drive.cjs` (20:52). **The contract is
  already stale at HEAD**, independently of anything this phase changes.

---

## Runtime State Inventory

This phase renames a file and a label. Applying the rename/refactor checklist:

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | **None.** The string being renamed (`IngestionPage`, the label `"Documents"`) exists in no database. `ActiveView`'s `"documents"` **is** persisted nowhere — `useState<ActiveView>("chat")` at `App.tsx:126`, no localStorage, no server. Verified by grepping `frontend/src` for `sessionStorage`/`localStorage` near the view state: the only persisted key on this surface is `"documents.sidebar.pinnedExpanded"` (`IngestionPage.tsx:47`) | ⚠ **`SIDEBAR_PIN_KEY = "documents.sidebar.pinnedExpanded"` (`:47`, read/written `:125,:129`) is a stored key containing the word `documents`.** **Do NOT rename it** — renaming silently resets every user's pin. Add a comment saying so |
| **Live service config** | **None** — verified by inspection: no n8n workflow, Datadog service, Tailscale tag or Cloudflare tunnel references a documents page | none |
| **OS-registered state** | **None** — no Task Scheduler entry, pm2 process or systemd unit names this surface | none |
| **Secrets / env vars** | **None** — this phase adds no env var and reads none. Confirmed against the deployment-artifact parity rule: `deploy/onebox.env.example`, `docs/OPERATOR.md` and `docker-compose.prod.yml` need **no** change | none |
| **Build artifacts / installed packages** | **None** — no `pip` package, no sandbox image tag, no compiled binary carries the name. Vite resolves `@/pages/*` at build time from source | none |
| **Documentation / registers carrying the path** | ⚠ **THREE**: `docs/HOT-FILE-LEDGER.md` (section heading **and** its anchor), `CLAUDE.md`'s hot-file table row (link target `#frontendsrcpagesingestionpagetsx`), and `.planning/sketches/218-…/drive.cjs:79,85` | **Same-commit** rename in all three, or the ledger's sync rule is violated and a sketch fence goes red |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | frontend build, vitest, `drive.cjs` | ✓ | **v24.19.0** | — |
| `node scripts/vitest-count-gate.cjs` | the phase gate | ✓ | ran green this session | — |
| `node drive.cjs` / `--emit` | D-217-11 | ✓ | 193/193 green, zero deps | — |
| Python `venv` + pytest | backend route tests | ✓ | `backend/pytest.ini` → `asyncio_mode = auto`, `testpaths = tests` | — |
| Local Supabase (`:54322`) | manual UAT of the five routes | assumed running — **not probed this session** | — | ⚠ if the Windows port-reservation trap has re-rolled, run `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1` (CLAUDE.md § *Local dev infrastructure*) |
| Docker | Supabase containers only | assumed | — | — |
| Chrome MCP | G-4 lived-experience UAT | ⚠ known to hang; `take_screenshot` times out | — | read DOM geometry via `evaluate_script`; **the operator drives browser UAT** (standing preference) |

**Missing dependencies with no fallback:** none.
**Nothing new is installed by this phase** — no npm package, no pip package, no sandbox rebuild. **The
Package Legitimacy Audit section is therefore omitted by measurement, not by oversight.**

---

## Validation Architecture

`workflow.nyquist_validation` is **`true`** in `.planning/config.json:8`. This section is required.

### Test framework

| Property | Value |
|---|---|
| Frontend framework | **vitest** + `@testing-library/react` (jsdom) |
| Frontend config | `frontend/vitest.config.*` (via `npm run test` in `frontend/`) |
| Backend framework | **pytest** + `fastapi.TestClient`, `unittest.mock.MagicMock` |
| Backend config | `backend/pytest.ini` — `asyncio_mode = auto`, `testpaths = tests` |
| Backend fixtures | `backend/tests/conftest.py:111-180` — `app.dependency_overrides` for `get_current_user`, `get_supabase`, **and** `get_user_supabase_client` (the `_user_supabase_override` at `:117-131` mirrors the `get_supabase` override so a route switched to the user-JWT client is still mocked by the same seam) |
| Quick run — frontend | `cd frontend && npx vitest run <path> --maxWorkers=2` |
| Quick run — backend | `cd backend && venv/Scripts/python -m pytest tests/test_217_*.py -x -q` |
| Full gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **from the repo root** |
| Sketch gate | `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` |

### ⭐ The count-gate baseline, RE-DERIVED THIS SESSION

Run 2026-08-28, repo root, quiet tree, `GSD_VITEST_MAX_WORKERS=2`, verdict line read verbatim:

```
  total                                      5710    6438    +728
  total 6438  ·  failed 0  ·  pinned total 5710
count gate OK — 136/136 pinned files present, no per-file decrease, 0 failing.
```

| | CLAUDE.md's latest correction (2026-08-28, Phase 214-15) | **measured 2026-08-28, this session** |
|---|---|---|
| grand total | 6355 | **6438** |
| pinned total | 5266 | **5710** |
| pinned files | 120/120 | **136/136** |

⚠ **This is the SIXTH rot, and it happened on the same calendar day as the fifth** — Phase 214.1's
close pinned 16 further files and `+444` pinned cases. **A growing number is the gate WORKING**; its
contract is *no per-file DECREASE* and *zero failing*. Re-derive rather than quote.

### ⚠ The document space is almost entirely OUTSIDE the gate

Measured by extracting the clean `TARGETS` entries (`vitest-count-gate.cjs:3295-3984`) and the
`BASELINE` keys (`:122-2925`, keys are **bare filenames** resolved by `bareName()` at `:4099`):

| Suite | In TARGETS? | In BASELINE? | Verdict |
|---|---|---|---|
| `src/components/metadata/DocumentDetailPanel.images.test.tsx` | ✅ | ✅ pinned at **3** | the **only** document-space suite fully guarded |
| `src/components/metadata/DocumentDetailPanel.a11y.test.tsx` | ❌ | ❌ | **never executed by the gate** |
| `src/__tests__/components/IngestionPage.test.tsx` (158 L) | ❌ | ❌ | **never executed** — the page this phase renames |
| `src/__tests__/hooks/useDocuments.test.ts` (201 L) | ❌ | ❌ | **never executed** — the hook D-217-10 changes |
| `src/components/ingestion/DocumentList.test.tsx` (175 L) | ❌ | ❌ | never executed |
| `src/__tests__/components/DocumentList.test.tsx` | ❌ | ❌ | never executed |
| `src/__tests__/components/DocumentStatusBadge.test.tsx` | ❌ | ❌ | never executed |
| `src/components/ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx` | ❌ | ❌ | never executed |
| `src/components/ingestion/ViewsGroup.test.tsx` | ❌ | ❌ | never executed |
| `src/components/ingestion/FilterBar.test.tsx` | ❌ | ❌ | never executed |
| `src/components/panel/__tests__/CsvTablePreview.test.tsx` | ❌ | ❌ | never executed |
| `src/lib/__tests__/apiBarrel.test.ts` | ✅ | ✅ pinned at **3** | guarded, but **only covers `connectors.ts`** |

**Only ONE directory entry exists in TARGETS** (`src/components/workflows`). Everything else is an
explicit file path. **So the entire document surface is unguarded except for three assertions about
image truncation.**

**Mechanism, stated exactly:**
- **TARGETS** entries are paths handed to `vitest run` (`:4045-4051`). A **directory** entry recurses
  and picks up `__tests__/` subfolders — that is how `WorkflowScheduleModal.test.tsx` ran for a whole
  phase without being pinned (Phase 214's close finding).
- **BASELINE** keys are **bare filenames** (`bareName()` strips the path, `:4099-4101`) mapped to an
  expected case count. A key naming a file the gate never runs pins nothing.
- **A new suite therefore needs BOTH**: an explicit TARGETS path *and* a BASELINE filename key, added
  in the **same commit that creates the file**.

**Recommended gate work for this phase** (Wave 0):

| Add to TARGETS | Add to BASELINE key | Reason |
|---|---|---|
| `src/pages/__tests__/LibraryPage.test.tsx` (renamed from `src/__tests__/components/IngestionPage.test.tsx`) | `LibraryPage.test.tsx` | SC#1 + SC#5's host |
| `src/__tests__/hooks/useDocuments.test.ts` | `useDocuments.test.ts` | D-217-10's reconcile is here |
| `src/components/ingestion/DocumentList.test.tsx` | `DocumentList.test.tsx` | the strip's host row |
| `src/components/metadata/DocumentDetailPanel.a11y.test.tsx` | `DocumentDetailPanel.a11y.test.tsx` | five new sections need a11y coverage |
| *(each new suite this phase writes)* | *(its bare filename)* | — |

⚠ **Adopting a suite RAISES the totals.** That is the desirable direction and must not be read as
drift; state the arithmetic in the plan so each `+n` is attributable.

### Requirements → test map

| Req | Behaviour | Test type | Automated command | File exists? |
|---|---|---|---|---|
| **LIB-01** | The page exports `LibraryPage`, renders `<h1>Library</h1>`, and `nav-items` label reads `Library` | unit | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | ❌ Wave 0 (rename of the existing 158 L suite) |
| **LIB-01** | `ActiveView` still contains `"documents"` and `ChatLayout`'s trailing `else` is still `<KnowledgeHealthPage />` | source fence (`?raw`) | `npx vitest run src/__tests__/library/renameFence.test.ts --maxWorkers=2` | ❌ Wave 0 |
| **LIB-02** | One constant drives both `accept` and the displayed list; the displayed list is a subset of the server's `ALLOWED_MIME_TYPES` | unit + source fence over `documents.py:91` | `npx vitest run src/components/ingestion/__tests__/acceptFormats.test.ts --maxWorkers=2` | ❌ Wave 0 |
| **LIB-02** | The dropzone is mounted on the Documents tab and is full-width | component | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | ❌ Wave 0 |
| **LIB-03** | The strip renders six segments in **backend write order** | unit | `npx vitest run src/components/ingestion/__tests__/IngestionStrip.test.tsx --maxWorkers=2` | ❌ Wave 0 |
| **LIB-03** | Order is asserted **against `documents.py`'s live source**, not a transcript | source fence (`?raw` over the backend file, the `drive.cjs` A5 technique) | same file | ❌ Wave 0 |
| **LIB-03** | A `completed` doc does not read `ingestion_step`; a skipped conditional is struck through; **no `%` and no ETA appear** | unit + negative fence | same file | ❌ Wave 0 |
| **LIB-03** | `ingestion_step` survives `GET /documents` (the D-217-10 defect) | **backend** unit | `venv/Scripts/python -m pytest tests/test_217_document_response_fields.py -x` | ❌ Wave 0 |
| **LIB-04** | Each of the five routes: 200 shape · 404 for a foreign document · empty-not-error for a document with no rows | **backend** unit | `venv/Scripts/python -m pytest tests/test_217_document_detail_routes.py -x` | ❌ Wave 0 |
| **LIB-04** | `/queries` scopes by `user_id` **in the SQL** and never trusts the request | **backend** unit (assert the `.eq("user_id", …)` call on the mock) | same file | ❌ Wave 0 |
| **LIB-04** | `/content` slices by line range, reports `total_lines`, and returns **unnumbered** content | **backend** unit | same file | ❌ Wave 0 |
| **LIB-04** | Sections fetch **on expand, not on mount** | component (assert zero calls before the accordion is clicked) | `npx vitest run src/components/metadata/__tests__/DetailSections.lazy.test.tsx --maxWorkers=2` | ❌ Wave 0 |
| **LIB-04** | A table renders as a table, scrolls horizontally, and escapes HTML in cells | component | same file | ❌ Wave 0 |
| **SC#5** | Selecting a folder while a view is loaded yields `{tab:'documents', folderId}`; there is **no** reachable state where the tab and the list disagree | unit over the reducer (pure function — exhaustive) | `npx vitest run src/pages/__tests__/librarySelection.test.ts --maxWorkers=2` | ❌ Wave 0 |
| **SC#5** | The sidebar `ViewsGroup` and the Views tab read the **same** selection | component | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | ❌ Wave 0 |
| **D-217-20/21** | The active trigger is **lighter than its track in both themes**, measured from `index.css` tokens | source-token fence (the `drive.cjs` A4 technique, ported into vitest) | `npx vitest run src/components/ui/__tests__/tabsContrast.test.ts --maxWorkers=2` | ❌ Wave 0 |
| **D-217-11** | The sketch's assertions still pass against the moved tree | sketch drive | `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | ✅ exists (193/193 today) |

### Sampling rate

- **Per task commit:** the one or two suites the task touches, at `--maxWorkers=2`.
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo
  root **plus** `node .planning/sketches/218-…/drive.cjs` **plus** `cd backend && pytest tests/test_217_*.py`.
- **Phase gate:** full frontend gate green (**≥ 6438 total, 0 failing, no per-file decrease**),
  `drive.cjs` green, backend `tests/` at or above its baseline, then `/gsd:verify-work`.

⚠ **`count gate OK` is not reliably reachable on demand** (SEED-171: five suites flake independently
of the worker cap). If it reds: capture failing filenames from the gate's own JSON **before**
re-running, check each against `git diff --numstat`, and do **not** touch the cap.

### Wave 0 gaps

- [ ] `frontend/src/pages/__tests__/LibraryPage.test.tsx` — git-mv of the existing 158 L suite + new cases
- [ ] `frontend/src/__tests__/library/renameFence.test.ts` — `?raw` fences on `ActiveView` and `ChatLayout:879`
- [ ] `frontend/src/components/ingestion/__tests__/acceptFormats.test.ts`
- [ ] `frontend/src/components/ingestion/__tests__/IngestionStrip.test.tsx`
- [ ] `frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx`
- [ ] `frontend/src/pages/__tests__/librarySelection.test.ts`
- [ ] `frontend/src/components/ui/__tests__/tabsContrast.test.ts`
- [ ] `backend/tests/test_217_document_response_fields.py`
- [ ] `backend/tests/test_217_document_detail_routes.py`
- [ ] **TARGETS + BASELINE entries for all of the above, plus the four already-existing orphans named
      in the table above** — `scripts/vitest-count-gate.cjs`
- [ ] Extend `frontend/src/lib/__tests__/apiBarrel.test.ts` to cover `api/documents.ts` (currently
      `connectors.ts` only)

*No framework install is required — vitest and pytest are both already configured and green.*

### ⭐ What NO automated layer can prove

Named explicitly, because a validation section that lists only what it covers is not a validation
section.

1. **⭐ The D-217-10 defect is invisible to any test that mocks the fetch.** The failure is *"a
   document already mid-ingest when the Library opens shows no stage until the next Realtime
   transition."* A component test that mocks `listDocuments` supplies whatever shape the test author
   chose — including `ingestion_step` — so it passes both before and after the fix. **The validation
   requirement is an integration test that mocks NEITHER side**: a real `GET /documents` response
   (backend TestClient, real `response_model` serialization) fed into the real `useDocuments`
   reconcile path, asserting the field survives. The backend half
   (`test_217_document_response_fields.py`) is the load-bearing one, because it is the
   `response_model` — not the query — that strips the field today.
2. **⭐ Pixel spacing, hover and focus states.** Sketch 218 §7 explicitly leaves these to a human
   comparison. **A G-4 row MUST name
   `.planning/sketches/218-the-library-and-its-tabs/index.html` as its reference and be driven BY
   LOOKING**, side by side with the running app.
3. **The tab-bar contrast as *perceived*.** A token fence proves L(active) > L(track). It cannot prove
   the chip reads as *raised* rather than *different*. A human must look at **both themes**.
4. **That the strip does not "jump backwards."** A unit test asserts render order for one snapshot of
   state. Only watching a real file ingest end-to-end proves the sequence never regresses on screen.
5. **Whether the empty arms are honest.** *"No tables"* vs *"No tables were extracted"* vs *"This file
   type has no tables"* are three different claims; only a human reading them against a real document
   can say which is true.
6. **The RLS asymmetry as experienced.** A test can assert the empty result. Only a person with two
   accounts and a shared folder can say whether the resulting screen is confusing.

### The 4-axis UAT bandwidth rule — DOES NOT APPLY, stated explicitly

CLAUDE.md's SC#10 requires the **full 8-row native provider roster + multi-tool + parallel-thread +
long-message** rows for *"any phase touching streaming, agent loop, provider routing, or UI state."*

**This phase touches none of the first three.** It makes no provider call, adds no model routing, and
changes nothing in the agent loop or the SSE path. Verified: none of the phase's files appears in the
streaming/agent-loop set, and no new code reads `MODEL_CAPABILITIES`.

⚠ **"UI state" is arguably touched** (D-217-12 rewrites the page's selection state). The honest
reading is that SC#10's *UI state* clause targets **streaming UI state** — the run/thread surfaces the
rule was written for (Phases 067.5–075.4). The Library's selection state is not on that path.

**Ruling for this phase: the cross-provider roster is NOT required. The parallel-thread and
long-message axes are NOT required.** What IS required is G-4: **operator-defined
"I'd-recognize-failure-here" scenarios, defined at scope time**, driven against the running app,
including the by-looking sketch comparison in item 2 above. Record this ruling in `VALIDATION.md`
rather than leaving the roster question open.

**Recommended G-4 rows** (operator-defined at plan time; these are candidates, not a substitute):

| # | Scenario | How failure would be recognised |
|---|---|---|
| G4-1 | Land on the Library cold. Upload a real PDF without hunting | the dropzone is not the first thing seen, or the target folder is unclear |
| G4-2 | Watch that PDF ingest end to end on the Ingestion tab | a segment lights out of order, a percentage appears, or a stage stays pending forever |
| G4-3 | Upload a `.txt` and watch its strip | Tables/Images are **not** struck through, i.e. an absent thing looks pending |
| G4-4 | **Reload the page mid-ingest** | the strip shows nothing until the next transition — **the D-217-10 defect, and this row is the only thing that catches it live** |
| G4-5 | Open a document with tables and read them in the 430px panel | the table is clipped rather than scrollable, or a wide table pushes the panel |
| G4-6 | Select a saved view from the sidebar, then click a folder | the tab and the list beneath it disagree, even for one frame |
| G4-7 | Toggle Deep Midnight ↔ light with the tab bar visible | the active tab reads as a hole in either theme |
| G4-8 | Open Settings and Library Health after the tabs change | their tab bars regressed as collateral |
| G4-9 | Side-by-side with `.planning/sketches/218-…/index.html` | spacing/rhythm visibly diverges from the approved sketch |

---

## Code examples

### The lazy section — the whole change is one prop

```tsx
// frontend/src/components/metadata/DocumentDetailPanel.tsx
// PanelSection.tsx:93 renders `{open && (<div …>{children}</div>)}`, so children
// do not MOUNT until first expand. defaultOpen={false} is the entire mechanism.
<PanelSection title="Extracted tables" count={doc.table_count} defaultOpen={false}>
  <TablesSection docId={doc.id} onTotalChange={setTableTotal} />
</PanelSection>
```

### A route, in the house style

```python
# backend/app/api/documents.py — the aexec + 404 + threadpool shape
# Source: kb.py:397-461 (line-range), knowledge_health.py:52-77 (audit reads),
#         utils/db.py:47-58 (aexec)
@router.get("/{document_id}/tables", response_model=list[DocumentTableRow])
async def list_document_tables(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Extracted tables for one document (LIB-04).

    ⚠ RLS on `document_tables` is OWNER-ONLY (mig 108:186-189) — unlike
    `document_chunks`, which mig 110:215 widened to include globally-visible
    folders. A document visible via a shared folder returns [] here, which
    matches the `table_count` aggregate the list already shows for it.
    """
    doc = await aexec(
        supabase.table("documents").select("id").eq("id", document_id).maybe_single()
    )
    if not doc or not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    res = await aexec(
        supabase.table("document_tables")
        .select("id, page, table_index, headers, rows, extractor")
        .eq("document_id", document_id)
        .order("page")
        .order("table_index")
    )
    return res.data or []
```

### The strip's honesty guard

```tsx
// Mirrors DocumentStatusBadge.tsx:27-32 — ingestion_step is a RESIDUE on any
// non-processing row (documents.py:2266 never clears it), so it is only read
// while the document is actually processing.
const reached = doc.status === "processing" ? doc.ingestion_step : null

function segmentState(stage: Stage): "done" | "active" | "pending" | "skipped" | "unreached" {
  if (!stage.always && stage.appliesToThisDoc === false) return "skipped"   // struck through
  if (doc.status === "completed") return "done"
  if (doc.status === "failed") {
    if (stage.key === doc.ingestion_step) return "unreached"   // the failure point
    return ORDER.indexOf(stage.key) < ORDER.indexOf(doc.ingestion_step ?? "") ? "done" : "unreached"
  }
  if (!reached) return "pending"
  const i = ORDER.indexOf(stage.key), j = ORDER.indexOf(reached)
  return i < j ? "done" : i === j ? "active" : "pending"
}

// ORDER is the BACKEND WRITE ORDER (D-217-09), asserted against documents.py by a ?raw fence:
const ORDER = ["extracting", "chunking", "embedding",
               "extracting_tables", "extracting_images", "metadata"] as const
```

### The audit read, per document

```python
# Source: knowledge_health.py:52-77 (the shipped shape) +
#         document_view_resolver.py:243 (the shipped .contains() precedent)
res = await aexec(
    supabase.table("audit_log")                     # SERVICE-ROLE (classified) — see docstring
    .select("metadata, created_at")
    .eq("user_id", current_user["id"])              # the SOLE owner gate, in the SQL (D-14)
    .eq("action_type", "search.query")
    .gte("created_at", _window_cutoff(30))          # knowledge_health.py:28 — the shipped window
    .contains("metadata", {"document_ids": [document_id]})
    .order("created_at", desc=True)
)
rows = [
    {"query_text": (r.get("metadata") or {}).get("query_text"),
     "via":        (r.get("metadata") or {}).get("via"),
     "asked_at":   r["created_at"]}
    for r in (res.data or [])
    # belt-and-braces: containment already filtered, but the guard is cheap
    if document_id in ((r.get("metadata") or {}).get("document_ids") or [])
]
```

---

## State of the art

| Old approach (in this tree) | Current approach | When it changed | Impact here |
|---|---|---|---|
| Bare `.execute()` in async handlers | `await aexec(...)` | Phase 058 / D-058-03 | all five new routes; `list_documents` is a surviving outlier |
| `lib/api.ts` as one file | domain modules under `lib/api/` re-exported by the barrel | Phase 207 | new client fns go in `api/documents.ts`; the barrel re-export is **unguarded** for that module |
| Raw ingestion step names on the badge | `termMap` plain / helper / technical + ⌥ reveal | Phase 154 (LANG-01) | the strip renders `usePlainLabel`, never a new string |
| `document_chunks` owner-only SELECT | owner **OR** globally-visible folder | mig 110 (PRAG-01 / D-164-07) | `/chunks` is wider than `/tables` and `/images` |
| Full-width upload block above the list | a compact button in the header's right corner | (undated, in `DocumentUpload.tsx:78-84`'s own comment) | ⭐ **SC#2 reverses this deliberately.** The comment says the block *"pushed the file list below the fold"* — the plan must answer that objection, not re-create it |

**Deprecated / stale in the phase's blast radius:**
- `documents.py:558` — `"Allowed: PDF, DOCX, Markdown, plain text."` understates
  `ALLOWED_MIME_TYPES`. One-line fix, same class as D-217-18.
- `BUILD-CONTRACT.generated.md`'s "190 assertions" — stale at HEAD (193).
- CLAUDE.md's count-gate figures — stale at HEAD (6438 / 5710 / 136).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `.contains("metadata", {"document_ids": [id]})` performs acceptably on `audit_log` without a GIN index | `/queries` | Slow route on a large audit table. **Mitigation is free:** the `knowledge_health` fetch-then-filter shape is the proven fallback and needs no index either |
| A2 | Adding `ingestion_step` / `extractor` to `DocumentResponse` does not break the narrow-select routes | `DocumentResponse` | 500s on `/move`, `/metadata`, `/classification/*`. **Mitigated by construction** — default every field. Verify with one pytest per route |
| A3 | `full_markdown` can be large enough to matter | D-217-05 | If it never exceeds a few hundred KB, paging is over-engineering. **No measurement of the worst case exists in this repo** (D-217-05 says so itself). One `SELECT max(length(full_markdown))` against the local DB would settle it and is worth a plan task |
| A4 | The `document_tables` / `document_images` owner-only asymmetry is acceptable rather than a defect | RLS asymmetry | If the operator considers it a bug, it becomes a migration and leaves this phase. **Surface it at plan time** |
| A5 | Sketch fences `A7b` / `A7c` should be rewritten as a rename map rather than deleted | D-217-11 | A deleted fence is a lost guarantee. The `A9c` precedent (*"a verbatim check cannot tell a RENAME from a LOSS"*) is the shipped answer |
| A6 | The recommended `--tab-active` token values (`0 0% 100%` light, `220 25% 16%` dark) hit AA contrast for the trigger's `--foreground` text | D-217-21 | Illegible active tab. **Must be measured**, not assumed — a contrast fence in the same commit |
| A7 | Local Supabase is up and its ports are not swallowed by the Windows reservation trap | Environment | Manual UAT blocked. Diagnosis is one command (`netsh int ipv4 show excludedportrange protocol=tcp`) |
| A8 | No open reported bug routes into this phase | Project constraints | CONTEXT records the sweep result; **it was not independently re-run this session** |

---

## Open questions

1. **What does a `failed` document's strip show after the failure point?**
   - Known: `ingestion_step` holds the failure step and is load-bearing for diagnosis
     (`text_sanitize.py:9`). Known: D-217-19 defines *done*, *pending* and *struck-through*.
   - Unclear: whether "never reached" gets its own state.
   - **Recommendation:** dim later segments as a fourth state and let `error_message` carry the
     reason. Put it to the operator; it is a one-line ruling.

2. **Does the derived stage-applicability belong on the wire?**
   - Known: it must come from `multimodal_service.py`'s frozensets or it will drift.
   - Unclear: whether the operator wants two more fields on the hottest response model in the app.
   - **Recommendation:** yes — two booleans. Duplicating the mime lists in TypeScript re-creates
     exactly the failure D-217-18 was written to prevent, and nothing would catch it.

3. **Does `ReembedStatusCard` keep its ETA on tab 4?** See § *Decisions this research contradicts* #1.
   - **Recommendation:** rule that D-217-19 scopes ingestion, and that the re-embed card keeps its
     determinate bar — but change *"~3 min"* to a chunk **count**, which satisfies both decisions.

4. **How large can `full_markdown` actually get here?** (A3.)
   - **Recommendation:** one query against the local DB as the first task of the `/content` plan.
     If the max is small, the paging still ships (D-217-05 is locked) but the default page size can
     be generous.

5. **Should `/queries` live in `documents.py` or its own module?**
   - Known: `knowledge_health.py` argues explicitly for a uniformly-service-role module so the
     exception has ONE auditable rationale.
   - **Recommendation:** a new `backend/app/api/document_queries.py`. One route, one docstring, one
     rationale — and `documents.py` (238 commits, the second-hottest backend file) does not grow a
     service-role branch it has never had.

6. **SC#5 has no requirement ID.** LIB-01..04 is four IDs for five criteria.
   - **Recommendation:** add `LIB-04b` (or extend LIB-01's wording) when the LIB block lands in
     `REQUIREMENTS.md` per D-217-03, so the traceability register can see it.

---

## Sources

### Primary (HIGH confidence) — read in this session, 2026-08-28

**Backend**
- `backend/app/api/documents.py` — 11 routes (`:524,710,773,803,847,1163,1396,1495,1549,1646,1739`);
  the six `ingestion_step` writes (`:1834,2014,2042,2080,2091,2201`); the terminal write
  (`:2266-2273`); the failure write (`:2292-2295`); the reextract reset (`:1308`);
  `ALLOWED_MIME_TYPES` (`:91`, enforced `:555-559`); the router prefix (`:89`)
- `backend/app/api/kb.py` — `read_path` (`:397-461`), the line-number prefix (`:446`), `/read`
  (`:464-481`)
- `backend/app/models/kb.py:70-76` — `ReadResponse`
- `backend/app/models/document.py` — the whole 48-line file
- `backend/app/api/knowledge_health.py` — the classified-exception docstring (`:1-12`), the eight
  inline route comments, `_fetch_most_retrieved` (`:52-77`), `WINDOW_DAYS` (`:28`)
- `backend/app/services/tool_dispatcher.py:790-801, 952-965` — the `search.query` metadata shape
- `backend/app/api/audit.py:65-69` — the `query_text` read
- `backend/app/services/multimodal_service.py:26-32, 461-520, 719-775` — the mime gating
- `backend/app/utils/db.py` — `aexec`, `coerce_uid`
- `backend/app/dependencies.py:291-296` — `get_user_supabase_client`
- `backend/app/main.py:751-761` — router registration
- `backend/tests/conftest.py:111-180` — the dependency-override seam
- `backend/tests/test_knowledge_health.py:1-40` — the backend test convention
- `backend/pytest.ini`

**Schema**
- `supabase/full-schema.sql:861-947, 1002` — the three child tables + `ingestion_step`
- `supabase/migrations/032_phase56_realtime.sql:13`
- `supabase/migrations/108_*.sql:156-189` — the RLS policies
- `supabase/migrations/110_*.sql:209-235` — the `document_chunks` widening

**Frontend**
- `frontend/src/pages/IngestionPage.tsx` — the full 601 lines
- `frontend/src/components/panel/PanelSection.tsx` — the full 101 lines
- `frontend/src/components/relationships/RelationshipsSection.tsx:1-130`
- `frontend/src/components/metadata/DocumentDetailPanel.tsx:230-300, 307`
- `frontend/src/hooks/useDocuments.ts` — the full file
- `frontend/src/components/ingestion/DocumentUpload.tsx` — the full 144 lines
- `frontend/src/components/ingestion/DocumentStatusBadge.tsx` — the full file
- `frontend/src/components/ingestion/DocumentList.tsx:349-355, 410-435`
- `frontend/src/components/ingestion/ViewsGroup.tsx:1-60`
- `frontend/src/components/settings/ReembedStatusCard.tsx:1-60, 130-175`
- `frontend/src/components/panel/CsvTablePreview.tsx:1-60, 144-170`
- `frontend/src/components/ui/tabs.tsx` — the full 53 lines
- `frontend/src/index.css:16-49, 104-142` — the token blocks
- `frontend/tailwind.config.js:20-95`
- `frontend/src/lib/nav-items.ts:25-60`
- `frontend/src/lib/termMap.ts:30-70`
- `frontend/src/App.tsx:96-102`
- `frontend/src/components/layout/ChatLayout.tsx:8, 750-765, 870-890`
- `frontend/src/lib/api/documents.ts:15-40`, `frontend/src/lib/api/knowledge.ts:1-20`,
  `frontend/src/lib/api.ts:174-227`
- `frontend/src/lib/__tests__/apiBarrel.test.ts`
- `frontend/src/__tests__/components/IngestionPage.test.tsx`

**Tooling and planning**
- `scripts/vitest-count-gate.cjs:122-2926 (BASELINE)`, `:3292-3984 (TARGETS)`, `:4035-4101`
  — **and the gate was RUN**: `total 6438 · failed 0 · pinned total 5710 · 136/136`
- `.planning/sketches/218-the-library-and-its-tabs/drive.cjs` — the full §A block; **RUN: 193/193**
- `.planning/sketches/218-the-library-and-its-tabs/COPY.js:59-79`
- `.planning/sketches/218-the-library-and-its-tabs/BUILD-CONTRACT.generated.md`
- `.planning/sketches/218-the-library-and-its-tabs/README.md:192-250`
- `docs/HOT-FILE-LEDGER.md` — all five G-5 sections, read in full
- `.planning/seeds/SEED-224-*.md:55-110`
- `.planning/ROADMAP.md:350-362`
- `.planning/REQUIREMENTS.md` — the full Traceability block
- `.planning/config.json`
- `CLAUDE.md` — project instructions

### Secondary (MEDIUM confidence)
- Seed-register sweep: `grep -rln` over `.planning/seeds/` surfaced 18 seeds naming a blast-radius
  file. The ones whose `trigger_when` plausibly fires here — **SEED-005** (document management),
  **SEED-046** (library health enrichment), **SEED-149** (CSV never table-extracted), **SEED-224**
  (this phase's origin) — were **not** individually read. ⚠ **Per CLAUDE.md's mandatory seeds sweep,
  `/gsd:plan-phase` must route each of these explicitly** and write the routing back into the seed's
  frontmatter.

### Tertiary (LOW confidence)
- None. No claim in this document rests on a web search or on training data; every one carries a file
  path read this session.

---

## Metadata

**Confidence breakdown**

| Area | Level | Reason |
|---|---|---|
| The five routes (auth, threadpool, envelopes) | **HIGH** | Every pattern read from shipped code with line numbers; the shipped precedents (`read_path`, `knowledge_health`, `aexec`) were read in full |
| The RLS asymmetry | **HIGH** | Policy predicates read verbatim from migrations 108 and 110 |
| The ingestion strip's three facts | **HIGH** | All six write sites, the terminal writes, the mime gating and the badge guard read directly |
| `DocumentResponse` + Realtime reconcile | **HIGH** | The model, the merge, and the narrow-select routes all measured |
| `librarySelection` blast radius | **HIGH** | Every consumer enumerated by grep with line numbers over the full 601-line file |
| The rename blast radius | **HIGH** | Exactly one import site; full grep across `frontend/src`, `scripts`, `.planning/sketches` |
| Tab tokens | **HIGH** | Lightness values read from `index.css`; the two mounts confirmed by grep |
| Count-gate mechanism + baseline | **HIGH** | TARGETS/BASELINE extracted mechanically; the gate was RUN and its verdict line read verbatim |
| `drive.cjs` breakage list | **HIGH** | Assertions read individually; `drive.cjs` was RUN (193/193) |
| Tables-in-430px recommendation | **MEDIUM-HIGH** | Both shipped patterns read; the recommendation is a judgement between them, and it is Claude's discretion by CONTEXT |
| `.contains()` performance on `audit_log` | **MEDIUM** | The pattern is shipped elsewhere; no index was verified. A named fallback exists (A1) |
| `full_markdown` worst case | **LOW** | Not measured anywhere in this repo, including by D-217-05 itself. Flagged as A3 with a one-query fix |
| Seeds routing | **MEDIUM** | Candidates identified by grep; not individually read. Explicitly handed to plan-phase |

**Research date:** 2026-08-28
**Valid until:** ⚠ **7 days for the numeric figures, 30 for the structural ones.** This repo's own
repeated finding is that a figure written at a phase's close goes stale on the next commit — the
count gate rotted **six times** and twice within a single day. **Re-derive the gate totals and
`drive.cjs`'s assertion count rather than quoting the numbers above.** The structural findings (RLS
predicates, write order, the `PanelSection` mount mechanism, the rename blast radius) are stable
until a commit touches those files.
