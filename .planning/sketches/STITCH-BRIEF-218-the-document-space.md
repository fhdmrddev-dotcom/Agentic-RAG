# STITCH BRIEF — the document space (SEED-224 / BUS-026)

**Step 1 of the ratified method** (`feedback_stitch_plus_sketch_is_the_design_method`): Stitch for
the LANGUAGE, then sketch 218 re-expresses it against components that ship. ⚠ **The two are never
collapsed** — Stitch renders zero shipped components (`SEED-155`).

- Source direction: Stitch `projects/6647337692456837497` ("RAG Document Manager V1", 12 screens).
- This pass: **`projects/1499725583457226910`** — the same journey, corrected to what this app can
  actually do, with the operator's 2026-08-28 direction applied.

## Operator direction, 2026-08-28 (verbatim intent)

> *"exactly as referenced but with the correct elements of the tabs — I like the colors, the
> presentation to the user, the simplicity, not many text pollution, good user journey, a lot of
> charts bars visuals."*

So: **keep** the reference's composition, palette feel and calm; **cut** its prose; **add** charts,
bars and visual density — but only over numbers the system can actually produce.

---

## ⚠ THREE MEASURED CORRECTIONS TO SEED-224 / BUS-026 — re-derived 2026-08-28, not inherited

### 1. ⛔ "Exactly ONE migration is needed … nothing logs retrieval today" is **FALSE**

BUS-026 grepped `retrieval_event|search_event|query_log|retrieval_log` and got nothing, then
concluded the substrate is missing. **The retrieval log exists under a different name.**

`backend/app/services/tool_dispatcher.py:797` fires, on every `search_documents` call:

```python
write_audit_entry(action_type="search.query",
                  metadata={"query_text": args["query"], "document_ids": _audit_doc_ids})
```

and `backend/app/api/knowledge_health.py` **already aggregates it** into
`most-retrieved` · `never-retrieved` · `retrieval-trend` · `coverage` · `low-confidence`
over a 30-day window (`WINDOW_DAYS = 27`→`30`, `_fetch_most_retrieved:52`).

| Retrieval fact the redesign wants | Backed today? | Where |
|---|---|---|
| times retrieved (per doc, 30 d) | ✅ **yes** | `audit_log` → `metadata.document_ids` |
| last retrieved at | ✅ **yes** | `audit_log.created_at` |
| the last query text | ✅ **yes** | `metadata.query_text` |
| never-retrieved set | ✅ **yes** | `_fetch_never_retrieved` |
| **per-document relevance score** | ❌ **no** | `similarity` is computed and **dropped** before the audit write |
| **retrieval latency** | ❌ **no** | `search_documents` returns a float it does not persist |

⭐ **The two missing facts are `metadata` keys on a jsonb column — adding them is a ZERO-MIGRATION
change to one dict literal.** A `retrieval_events` table is a *choice about query-grain analytics*,
not a prerequisite. The sketch must settle which, and say what each buys.

### 2. ⛔ "There is NO DocumentsPage … a rename touches the route + the three-homes contract" is **FALSE**

There is **no router** — navigation is `useState<ActiveView>` (`App.tsx:102`).

- `ActiveView` already contains **`"documents"`**, not `"ingestion"`.
- `lib/nav-items.ts:37` already reads `{ view: "documents", icon: FileText, label: "Documents" }`.
- `ChatLayout.tsx:757` mounts it on `activeView === "documents"`.
- `IngestionPage.tsx:337` already renders `<h1>Documents</h1>`.

**Only the FILE NAME is stale.** The IA decision BUS-026 reserves for the sketch is already made
and shipped; what is left is a file rename plus ~8 import sites, with zero nav-contract impact.
⚠ The sketch should NOT spend a variant on it.

### 3. ⚠ Tab 5 (Retrieval) **overlaps a shipped top-level home**, and BUS-026 does not mention it

`Library Health` is its own nav entry (`nav-items.ts`, `KnowledgeHealthPage.tsx`) and **already has
a four-tab shell**: `Most Retrieved · Never Retrieved · Stale · Low Confidence`. That is most of the
proposed Retrieval tab, already built, already reachable.

**So the real design question is not "how do we build a Retrieval tab" — it is "where does retrieval
honesty live: inside Documents, or in Library Health, and what happens to the other?"** The sketch
must answer it; a fifth tab that duplicates a nav home is the single biggest waste in this seed.

---

## The shipped shell the sketch must render (measured, `IngestionPage.tsx`)

| Thing | Shipped value |
|---|---|
| page frame | `flex flex-col h-full overflow-y-auto p-8` |
| h1 | `Documents` · `text-2xl font-headline font-bold` |
| sub | *"Upload documents to give the AI context for your conversations."* |
| sidebar | `w-72` (288 px) · collapses to a `w-[50px]` rail when the panel opens |
| detail panel track | fixed **430 px**, grid `minmax(0,1fr) 430px` |
| list table | **7 fixed columns**: chevron · Filename · Type · Size · Chunks · Status · Actions |
| column shedding | cols 3–5 hidden when the panel is open or < 768 px |
| **the tab component** | shadcn `Tabs/TabsList/TabsTrigger` — shipped on `SettingsPage` and `KnowledgeHealthPage`; a content-width segmented pill, **not** full-bleed |

Theme tokens (`frontend/src/index.css`): light `--background 220 20% 97%` · `--card 0 0% 100%` ·
`--primary 239 84% 67%` (indigo) · `--radius 0.625rem`. Dark = *Deep Midnight* (`216 45% 4%`).
**The app ships BOTH** — which is why this pass draws the hub twice.

---

## What Stitch is asked to draw, and what it must NOT

**Draw (grounded — a real number exists or can exist with no schema change):**
per-file 3-stage ingestion progress (parse → chunk → embed) · chunk list with text + index
(`document_chunks.content`, migration 002, already returned by both RPC arms of migration 023) ·
retrieval count + last query + last-retrieved, as **bars over time** · never-retrieved as a share ·
embedding model + live vector count · re-index (single + all) · golden-sample marking.

**⛔ Never draw (the cut list — decorative or ungrounded):**
"Embedding Quality 92%" and its trend line · a "98% healthy" donut · a static "Semantic Match %"
column · token pie charts · the section-level retrieval heatmap with a narrative executive summary
(the reference's weakest screen: four walls of prose in coloured blocks) · connector cards
(`SEED-142`) · any determinate progress bar over a non-streaming request.

**House rules inherited from `assets/12493500246735489470`:** text is noise, cut it — but the purpose
must survive the cut. Never print the mechanism. Colour carries state and is never the only carrier.
An unknown value says "unknown", never blank, never zero, never a green tick.

### 4. ⚠ "Stage-level ingestion status … add stage transitions if not already recorded" — ALREADY RECORDED, and there are SIX stages, not three

`documents.ingestion_step` is written at every transition by `backend/app/api/documents.py`
(Phase 56, D-10/D-11) and is already **Realtime-driven into the badge**
(`DocumentStatusBadge.tsx` → `lib/termMap.ts`). The ordered set, measured from the write sites:

```
extracting → extracting_tables? → extracting_images? → chunking → embedding → metadata
```

⚠ **SEED-224's "3-stage (parse → chunk → embed)" strip would UNDER-REPORT a real ingestion** — it
drops metadata entirely and collapses three distinct extract phases into one. Two of the six
(`extracting_tables`, `extracting_images`) are **conditional**, so the strip has a variable length
and a fixed 3-segment bar is a fabricated shape.

⭐ **Consequence: the per-file stage strip is ZERO-SCHEMA *and* ZERO-BACKEND** — the data already
flows. It is a pure render change, and it is the cheapest honest win in this whole seed.

---

## ⚠ Net effect of the four corrections on BUS-026's cost model

| BUS-026 said | Measured |
|---|---|
| "Exactly ONE migration is needed" (`retrieval_events`) | **Possibly ZERO.** The two missing facts are jsonb `metadata` keys. |
| "the five-tab shell has no home … an IA decision" | **Already decided and shipped** — `ActiveView` is `"documents"`. A file rename. |
| tab 5 = "Retrieval" | **Collides with the shipped `Library Health` nav home + its 4 tabs.** |
| "add stage transitions if not already recorded" | **Recorded since Phase 56**, and there are 6, not 3. |

**None of this shrinks the DESIGN work — it shrinks the BACKEND work and moves the risk into the
IA.** The expensive question is no longer *"what must we build to be honest?"* but *"how many homes
does document-plus-retrieval deserve, and which one loses?"* That is the question the sketch exists
to answer.

### 5. ⛔ "Golden-sample marking **wired to the existing eval runner**" — the eval runner CANNOT take the row, and the word is already taken

This is the correction that moves cost the other way, so it is recorded as loudly as the four that
made things cheaper.

**(a) The eval schema is skill-scoped at the CONSTRAINT level, not by convention**
(`supabase/migrations/080_eval_runs_and_results.sql:42-88`):

```sql
eval_runs.skill_id          uuid NOT NULL REFERENCES public.skills(id)
eval_runs.skill_version_id  uuid NOT NULL REFERENCES public.skill_versions(id)
eval_results.test_case_id   uuid NOT NULL REFERENCES public.skill_test_cases(id)
eval_results.variant        text NOT NULL CHECK (variant IN ('with_skill','without_skill'))
```

A retrieval golden sample has **no skill, no skill version, no `skill_test_cases` row, and no
with-skill/without-skill variant.** Every one of those four refuses the insert. So this is **not
"wiring to the existing runner"** — it is either a new table in the 140–149 block, or three
`NOT NULL` FKs dropped and a CHECK widened on a schema whose own COMMENT says the tightness is
deliberate (`T-133-EoP`, service-role-writes-only).

⚠ **`SEED-224` lists this under "Ship" as if it were free.** It is the most expensive item in the seed.

**(b) The word "golden" is already spent on a different thing.** `workflow_runs.is_golden_run`
(`backend/app/api/runs.py:526`, `workflows.py:1004`) is the publish gauntlet's one live run before a
workflow may be published — *"a golden run is never resumable"*. Calling a retrieval fixture a
"golden sample" puts two unrelated meanings on one word in one product. **The sketch must name this
thing, and must not name it that.**

### 6. The chunk list needs exactly one new route, and no schema

`document_chunks.content` exists (`002_module2_byo_retrieval.sql:28`) and both RPC arms of
migration 023 return it — but `grep document_chunks backend/app/api/` shows **only deletes, an
insert and a count**. There is **no chunk-read endpoint**. One `GET`, owner-scoped, plus a component.

---

## ⭐ OPERATOR DECISIONS — 2026-08-28, mid-pass. These SETTLE two open questions.

> *"consider that existing library health will be merged in this document space, and I prefer to
> rename this at least in frontend to Library instead of Documents"*

### D-1 · `Library Health` MERGES INTO this surface — it does not stay a peer nav home

This answers correction §3 (the collision) in the direction of **one home, not two**. Consequences,
all measured against the shipped page:

- `KnowledgeHealthPage.tsx` ships **4 stat cards** — `Total Docs · Coverage % · Retrieval Score ·
  Active This Month` — a **Coverage Trend** chart, and **4 tabs**: `Most Retrieved · Never Retrieved ·
  Stale · Low Confidence`, the last with a `By Document / By Query` sub-tab.
- ⚠ Those 4 tabs cannot become 4 more TOP-LEVEL tabs — that would make a 9-tab bar. They become a
  **sub-filter chip row inside tab 5**, which is what this pass draws.
- The `library-health` entry leaves `NAV_ITEMS` (`lib/nav-items.ts`). ⚠ It is **ungoverned** (no
  `feature` key), so removing it is a plain deletion — but `ActiveView` still carries
  `"library-health"` and `ChatLayout` still switches on it. **A dead ActiveView arm is the reachability
  failure Phase 148 exists to prevent** — the rename plan must delete the arm, not orphan it.
- ⚠ `Retrieval Score` is a **percentage-shaped tile** and this brief's cut list forbids one. It is not
  decorative (it is derived from real avg-similarity thresholds in `knowledge_health.py`), but it
  survives the merge only if it says what it measures. **The sketch must rule on it explicitly rather
  than silently dropping a shipped tile.**

### D-2 · The surface is renamed **Library**, front-end only

- User-visible: `nav-items.ts` label `Documents` → **`Library`**; the page `<h1>Documents</h1>`
  (`IngestionPage.tsx:337`) → **`Library`**.
- ⚠ **The internal `ActiveView` key stays `"documents"`** unless the operator asks otherwise — it is
  never printed to a user, and renaming it touches `citationNav.tsx`'s `CitationTargetView`, the
  `ChatLayout` switch and `App.tsx` for zero user-visible gain. *Show the value, hide the mechanism.*
- ⭐ **The rename resolves the "tab 3 is named after the page" problem for free** — with the page
  called `Library`, `Ingestion` is an ordinary tab, and correction §2's file rename becomes
  `IngestionPage.tsx` → `LibraryPage.tsx` with the h1 and the nav label changing in the same commit.
- ⚠ **`Library` now collides with nothing, but it DID:** the entry being deleted is literally called
  `Library Health`. The merge and the rename must land together or the app briefly shows `Library`
  and `Library Health` as two different homes.

### The tab set this pass now draws

`Library` › **Documents · Views · Ingestion · Indexing · Health**

Tab 5 is named **Health**, not `Retrieval` — because after the merge it carries `Stale` and
`Low confidence`, which are not retrieval facts. The journey reads as a pipeline: *what I have →
how I slice it → how it gets in → how it is indexed → how well it works.*

### ⚠ D-1 CARRIES ONE NON-OBVIOUS HAZARD — `KnowledgeHealthPage` is the app's POSITIONAL FALLBACK

`ChatLayout.tsx:879` renders `<KnowledgeHealthPage />` as the **trailing `else`** of the view chain —
it is not a matched branch. `App.tsx:98-101` states the consequence in its own words:

> *"ChatLayout's trailing `<KnowledgeHealthPage />` is a **POSITIONAL FALLBACK**, not a `default:`
> that throws, so a union member with no branch **silently renders Knowledge Health** (the Phase-118
> built-but-unreachable lesson)."*

⚠ **So deleting the Library Health page does not merely remove a nav entry — it removes the thing the
app renders when nothing matches.** Every `ActiveView` member whose branch is missing today lands
there today and would land on **nothing** after the merge.

**The merge must therefore replace the fallback in the same commit** — either the Library page becomes
the new trailing `else`, or the chain gains a real `default:` arm. ⚠ **Silently deleting it turns a
known-safe mis-route into a blank screen**, which is strictly worse than the bug the fallback was
covering for.

⭐ **This is exactly the class of finding the ratified pre-flight says lives in the SEAM between two
plans** — one plan deletes a nav entry, another builds a tab, both green, and the fallback nobody
owned disappears between them.

### 7. ⚠ Tab 2 ("Views") DUPLICATES the sidebar it sits beside — and SEED-224 calls it "no change"

Tab 1's sidebar already renders **both** groups: `Folders` **and** `ViewsGroup`
(`IngestionPage.tsx` → `sidebarGroupsEl`). `ViewsGroup.tsx` ships the whole feature — per-view
document count, the `G` pill on system-global seeds, Edit / Rename / Delete, and a deliberate absence
of "New subfolder".

So a top-level **Views** tab is not free, it is one of two things and the sketch must pick:

| Arm | Cost |
|---|---|
| **Tab 2 duplicates the sidebar group** | The same list in two places; selecting a view in one must select it in the other or they disagree. |
| **Views LEAVES the sidebar and lives only in tab 2** | A saved view stops being a one-click filter over the list and becomes a tab-switch away. ⚠ That is a **regression** of Phase 114's whole point (D-114-1: *ad-hoc filtering and a loaded saved view are the SAME surface*). |

⭐ **A third arm the reference does not have: drop tab 2.** Views are a *lens on the Documents tab*,
not a destination. Four tabs (`Documents · Ingestion · Indexing · Health`) may be the honest set, with
Views staying exactly where it already works. **The sketch must draw 5-tab and 4-tab side by side** —
this is the cheapest place to discover that a tab has no content of its own.

---

## What this Stitch pass produced

Project **`projects/1499725583457226910`**. ⚠ A Stitch project is mutable and privately scoped — the
PNGs committed under `218-the-library-and-its-tabs/stitch/` are the durable pixels, exactly as
`SEED-224` warns about the reference project.

| Screen | File | Verdict |
|---|---|---|
| Documents (tab 1) | `stitch/01-documents-tab.png` | ⭐ the language: content-width pill tabs, 288px sidebar, 7 fixed columns, inline chunk bars, letter-mark type chips, stage strip on in-flight rows |
| Health (tab 5, MERGED) | `stitch/05-health-tab-merged.png` | ⭐ **the strongest screen** — the merge reads as ONE surface, the bar chart carries the honesty, the four shipped Library-Health tabs survive as chips with counts |
| Retrieval (tab 5, pre-merge) | `stitch/05-retrieval-tab-premerge.png` | superseded by D-1; kept because its `Most retrieved` / `Never retrieved` split is the better *list* treatment |

⚠ **Stitch drew the chart empty on its first two attempts and correctly on the third**, from a
byte-identical prompt. A generative tool is not a reliable renderer of the thing you asked for —
which is the whole reason step 1 is *direction* and step 3 is the acceptance bar.

**Not yet drawn:** Ingestion (tab 3), Indexing (tab 4), the document detail panel with its Chunks
and Retrieval sections. The language is established enough that the sketch can express them
directly; a further Stitch pass is optional, not blocking.

### ⚠ Three things the sketch must FIX rather than inherit from these screens

1. **"Golden queries" must be renamed** — `is_golden_run` collides (§5b). `COPY.js` uses
   **"Checked queries"**.
2. **The stage strip is drawn with three segments and the pipeline has six** (§4). The sketch draws
   the real six with the two conditional ones marked.
3. **"RETRIEVED (7d)" / "returned by a search in 30 days"** — the shipped window is
   `WINDOW_DAYS = 30`. Any other number on that tile is a fabricated one.

---

## ⭐ THE BURIED-CAPABILITY AUDIT — operator direction, 2026-08-28

> *"I want you to think about what capabilities, what information we can have from our application,
> because I believe that we have a lot of things that we can show but it is hidden and buried inside
> and not considered to be surfaced in the UI."*

**That belief is correct, and it is bigger than the redesign.** Measured against
`supabase/full-schema.sql` and a grep of `frontend/src` — a column with **zero** frontend references
is stored on every document and shown to nobody.

| Stored today | Where | Surfaced? | What it would give the user |
|---|---|---|---|
| **`documents.full_markdown`** | every document | ⛔ **ZERO frontend references** | ⭐ **The reference's "Document Content Viewer", buildable with no new extraction.** The whole parsed text of every file is already in the database. |
| **`document_tables.headers` + `.rows`** | per table | ⛔ only a count (*"3 tables"*) | The extracted tables **as tables**. We store the real cell data and render a number. |
| **`document_images.description`** | per image | ⛔ only a count (*"5 imgs"*) | Written descriptions of every figure — what the agent actually reads for an image. |
| **`documents.extractor`** | every document | ⛔ never shown | Which engine parsed this file. **The single most useful fact when an extraction looks wrong.** |
| **`document_chunks.embedding_model` + `.embedding_dimensions`** | per chunk | ⛔ never shown | Which chunks are on the old model mid-re-embed — the honest answer to *"is search caught up?"* |
| `document_tables.page` / `document_images.page` / `.bbox` | per element | ⛔ never shown | Where in the document it came from. |
| `documents.version_number` / `is_latest` | every document | partly | Version history exists; the panel shows a version table. |
| `audit_log` `search.query` `metadata.query_text` | per search | ⛔ aggregated only | ⭐ **"Which questions found this document"** — a per-document question list, already stored. |

⚠ **Six of those eight are stored on every single document and reach no screen.** That is not a
missing feature; it is a rendering gap over data that already exists — the cheapest richness in the
whole seed, and precisely what the operator suspected.

### ⚠ Two honesty limits found in the same pass

1. **There is no byte-level upload progress.** `DocumentUpload.tsx` reports only
   `Uploading N files…` — no `onUploadProgress`. So the reference's per-file **85% / 25% / 5%**
   upload bars would be **fabricated**. Either the upload gains real progress reporting, or the queue
   shows *stages*, not a percentage. **Drawn as stages.**
2. **The accepted types are measured, not guessed:**
   `.txt .md .pdf .docx .pptx .xlsx .csv .epub` — and ⚠ **`.msg` is NOT in the accept list**, though a
   real `.msg` reached ingestion and failed. The dropzone must state the real set.

### What the reference's screen 07 gives us that IS honest

Its four **stage cards** (*Text Extraction / Cleaning / Chunking / Embedding*, each with a count and a
state) are a **library-wide** view, not per-file — and a count of documents currently at each
`ingestion_step` is a real aggregate we can produce today. ⛔ Its **token pie chart** is not: ingestion
token accounting does not exist.
