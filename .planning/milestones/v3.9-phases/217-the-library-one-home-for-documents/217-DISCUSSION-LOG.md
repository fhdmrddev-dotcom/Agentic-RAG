# Phase 217: The Library — One Home for Documents - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 217-the-library-one-home-for-documents
**Areas discussed:** G-5 handling, The backend SC#4 needs, Views selection truth, What tabs 4 & 5 contain, The tab-bar inversion, Two loose ends

---

## G-5 handling

| Option | Description | Selected |
|--------|-------------|----------|
| Honour by construction | 217 takes the seams as part of the feature; each plan reads its file's `docs/HOT-FILE-LEDGER.md` section | ✓ |
| Insert a refactor phase first | Block 217 until a dedicated refactor splits `DocumentList.tsx` / `IngestionPage.tsx` | |
| Honour by construction + record the debt | Same, plus a named seam and re-open trigger written back per row | |

**User's choice:** Honour by construction.
**Notes:** Surfaced per the orchestrator protocol before any command was run. Five files fire G-5 in
this blast radius; all ten document-space rows were added at `8b99c19b2`.

---

## The backend SC#4 needs

**Framing measurement presented first:** the ROADMAP's ⭐ *"ZERO schema, ZERO backend — every fact
already flows"* is half false. All six facts are in Postgres; **none is reachable by the browser**.
`grep '@router\.' backend/app/api/documents.py` returns 11 routes, none reading any of the six.
`CREATE POLICY … FOR SELECT TO authenticated` already exists on all three child tables (migs
`108`/`110`), so ZERO SCHEMA does hold.

### Q1 — how the six facts reach the wire

| Option | Description | Selected |
|--------|-------------|----------|
| Per-section routes, lazy on expand | Five routes; each `PanelSection` fetches its own on EXPAND, `defaultOpen={false}` | ✓ |
| One composite `/documents/{id}/detail` | Single route returning all six | |
| Per-section routes, all fetch on mount | Copies `RelationshipsSection` exactly — 5+ requests per document open | |

**Notes:** `PanelSection` defaults to `defaultOpen = true` and `RelationshipsSection.tsx:96` fetches
in a bare `useEffect` — the shipped pattern, copied verbatim, is the expensive arm.

### Q2 — `full_markdown` size

| Option | Description | Selected |
|--------|-------------|----------|
| Paged by line range | `?from=&to=`, reusing the shape `backend/app/api/kb.py:404` already implements | ✓ |
| Truncate with an honest marker | First N KB + a visible marker | |
| Send it whole | One field, no paging | |

### Q3 — "the questions that found it"

| Option | Description | Selected |
|--------|-------------|----------|
| `audit_log` `search.query` rows, per document | Same source `knowledge_health.py` already derives from, at document grain | ✓ |
| Only the shipped aggregate count | "found by 12 searches", no question text | |
| A new `retrieval_events` table | SEED-224's substrate, per-query grain | |

### Q4 — authorizing the `/queries` route

| Option | Description | Selected |
|--------|-------------|----------|
| Same classified exception, `user_id` filtered in SQL | Service-role client + docstring exception, exactly the shipped precedent | ✓ |
| Add an authenticated SELECT policy on `audit_log` | Root-cause fix; a migration, and widens read access product-wide | |
| Route it through `knowledge_health.py` instead | Keeps the exception in one file; splits the panel's reads across two routers | |

### Q5 — `extractor` and `embedding_model`

| Option | Description | Selected |
|--------|-------------|----------|
| `extractor` on `DocumentResponse`; `embedding_model` on the chunks route | One scalar on the row everyone fetches; per-chunk variation where it varies | ✓ |
| Both inside one "How this was processed" section | More coherent story, another route | |
| Defer both to Phase 218 | Ship only the four visible facts | |

---

## Views: one selection truth

**Framing measurement presented first:** `IngestionPage.tsx:83` already owns `selectedViewId` and
passes it DOWN to the sidebar `ViewsGroup`; `:242` keeps it mutually exclusive with
`selectedFolderId` (UX-01 / D-114-1). So the page is already one source of truth — the disagreement
SC#5 forbids is between `activeTab` and `selectedViewId`, not between two view lists.

### Q1 — activeTab ↔ selectedViewId

| Option | Description | Selected |
|--------|-------------|----------|
| `activeTab` DERIVED from `selectedViewId` | One state, two renderings — they cannot disagree | ✓ |
| Independent state, synced by effects | Two `useState` reconciled in `useEffect` | |
| Tab 2 is a picker; the sidebar is the launcher | Tab 2 shows view cards; picking loads into the Documents tab | |

### Q2 — tab 2 with no view selected

| Option | Description | Selected |
|--------|-------------|----------|
| The list of saved views, as the picker | Tab 2's own real content; answers the sketch §1 objection | ✓ |
| An empty state pointing at the sidebar | Honest but hollow | |
| The tab is hidden until a view exists | Conditional tab count; undiscoverable | |

### Q3 — the actual single value (derivation cannot be total)

| Option | Description | Selected |
|--------|-------------|----------|
| A discriminated union: one `librarySelection` | Makes D-114-1's mutual exclusion structural | ✓ |
| `activeTab` + a rule that tab 2 requires a `viewId` | Invariant enforced by convention | |
| Current `useState` shape plus `activeTab` | Three independent values — the shape SC#5 forbids | |

**Notes:** Raised because "derived" cannot cover tabs 3–5, which have no selection to derive from.

### Q4 — folder click while a view is loaded

| Option | Description | Selected |
|--------|-------------|----------|
| Switches to the Documents tab, showing that folder | The tab follows the selection; automatic under the union | ✓ |
| The folder loads but the tab stays on Views | The same disagreement wearing a different hat | |
| Folders are disabled while a view is loaded | Surprising restriction | |

---

## What tabs 4 & 5 contain

**Framing:** Phase 218 owns the Health/Governance merge, so during 217 `KnowledgeHealthPage.tsx`
(571 L) and `GovernancePage.tsx` (355 L) are still mounted as their own nav entries.

### Q1 — tab 5 (Health) in Phase 217

| Option | Description | Selected |
|--------|-------------|----------|
| Ship 4 tabs in 217; 218 adds the 5th | No window where two Health surfaces coexist | ✓ |
| Mount the existing `KnowledgeHealthPage` inside tab 5 now | Five tabs day one; same page in two places until 218 | |
| A Health tab that links out to the page | Preserves the shape; hollow | |

**Notes:** This **sequences** sketch 218's variant A rather than reversing it — five tabs remains the
destination.

### Q2 — tab 4 (Indexing)

| Option | Description | Selected |
|--------|-------------|----------|
| Compose the shipped `ReembedStatusCard` + real counts | Zero new mechanism; numerator and denominator, never a percentage | ✓ |
| Counts only; leave re-embed in Settings | Read-only tab with no verb | |
| Defer tab 4 to 218 as well | Indexing needs nothing from 218 — deferring buys nothing | |

### Q3 — the six-stage strip's order

**Framing measurement:** the backend writes `extracting`(:1834) → `chunking`(:2014) →
`embedding`(:2042) → `extracting_tables`(:2080) → `extracting_images`(:2091) → `metadata`(:2201).
The sketch's BUILD-CONTRACT draws `Reading → Tables? → Images? → Splitting → Indexing → Labelling`,
so the strip **would jump backwards**.

| Option | Description | Selected |
|--------|-------------|----------|
| Draw the strip in the order the backend writes | Frontend-only; contract regenerated in the same commit | ✓ |
| Reorder the backend to match the sketch | Reorders a shipped pipeline for a visual | |
| Draw stages as a completed-set, not a sequence | Cannot lie about direction; gives up the "where is my file" story | |

### Q4 — `ingestion_step` on load

**Framing measurement:** `ingestion_step` appears in `frontend/src/types/index.ts:499` and in **no
backend response model**. It reaches the browser only via the Realtime row payload
(`useDocuments.ts:44-58`) — the D-v2.5-03 failure, invisible to any test that mocks the fetch.

| Option | Description | Selected |
|--------|-------------|----------|
| Add `ingestion_step` to `DocumentResponse` | Fetch becomes truth, Realtime stays the hint | ✓ |
| Poll while any document is processing | Adds a timer; still blank for the first interval | |
| Leave it — Realtime only | Mid-ingest page load shows no stage, possibly for minutes | |

### Q5 — where the dropzone lives

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width dropzone on Documents; queue on Ingestion | The front door is on the tab you land on — what SC#2 literally asks | ✓ |
| Only on the Ingestion tab | Landing on Documents and finding tab 3 is the hunting SC#2 removes | |
| On both tabs | Two mount points for one component; two partial truths | |

### Q6 — the accepted-formats list

| Option | Description | Selected |
|--------|-------------|----------|
| One exported constant, read by both input and label | A refused format cannot be advertised — there is one list | ✓ |
| A test asserting label matches `accept` | Catches drift at CI; a test can be updated alongside the break | |
| Derive the label from the backend's supported MIME list | Most honest source; costs a route, input still needs a literal | |

**Notes:** the sketch's own fence caught its older dropzone advertising `MSG`, which the shipped
input rejects.

---

## The tab-bar inversion

**Framing measurement:** `grep -rln 'from "@/components/ui/tabs"'` returns exactly two non-test
mounts — `KnowledgeHealthPage.tsx` and `SettingsPage.tsx`. Active state is
`data-[state=active]:bg-background … shadow-sm` over `bg-muted` = **4% over 11% lightness (−7)** on
Deep Midnight, with a 5%-opacity shadow as its only other cue.

### Q1 — shared primitive or local variant

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the shared primitive; lands on 3 surfaces | Both other mounts are ours and both benefit | ✓ |
| A Library-local variant | Two tab bars that disagree on one theme | |
| Fix the primitive behind a `variant` prop | Makes the WRONG rendering the default | |

### Q2 — the second cue

| Option | Description | Selected |
|--------|-------------|----------|
| Lighter surface + a visible border | Two independent cues; matches every reference image | ✓ |
| Lighter surface + an accent underline | Changes the component's silhouette | |
| Keep the shape, raise the shadow opacity | Trades one theme's legibility for the other's | |

---

## Two loose ends

### Q1 — the `Retrieval Score` tile ruling (owed per sketch 218 §7)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to 218 with the Health tab | The ruling travels with the surface | ✓ |
| Rule now: qualified `MATCH STRENGTH` | Settles it while fresh | |
| Rule now: keep it bare as it ships | Least churn; the number still does not say what it measures | |

### Q2 — LIB-01…LIB-04 absent from `REQUIREMENTS.md`

| Option | Description | Selected |
|--------|-------------|----------|
| Add the LIB block to `REQUIREMENTS.md` during planning | In the phase's first commit, ROADMAP wording | ✓ |
| Add all ten LIB requirements now | Writes requirements for 218/219 too — out of 217's scope | |
| Leave it — `ROADMAP.md` is enough | Accepts an incomplete traceability register | |

---

## Claude's Discretion

- Tailwind class choices, spacing, hover/focus states, and the exact `PanelSection` titles for the
  five new detail sections. Sketch 218 §7 leaves pixel spacing to a human comparison, so a G-4 row
  must name the sketch's `index.html` and be driven by looking.
- How "tables as tables" renders inside the fixed 430px panel track — not discussed.

## Deferred Ideas

- The `Retrieval Score` tile ruling → Phase 218.
- Tab 5 (Health), the Library Health + Governance merge, the seven grouped chips, the
  `Low Confidence` name collision (0.38 vs 0.5), the `governance_health` feature-gate migration, and
  the `ChatLayout.tsx:879` fallback replacement → Phase 218.
- Per-hit relevance recording (LIB-07) → Phase 218.
- Connected-source ingestion, the dry run's three arms, and the `CLAUDE.md` manual-upload-only rule
  change → Phase 219.
- A `retrieval_events` table at per-query grain → not this milestone.
- Classification folding into the Library → deliberately not folded; named rather than left silent.
- Upload byte progress → blocked by measurement (`onUploadProgress` absent from the upload path).
