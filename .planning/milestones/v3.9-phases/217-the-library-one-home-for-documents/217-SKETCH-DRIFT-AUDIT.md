# 217 — sketch-drift audit: what shipped vs sketch 218

**Raised by**: operator, 2026-08-29, on screenshots `1–4` (shipped) vs `FireShot 003–013` (sketch).
**Sketch**: `.planning/sketches/218-the-library-and-its-tabs/index.html` (committed 2026-08-28, one day
before 217 was planned — so it IS this phase's acceptance bar, not a later idea).
**Shipped**: `develop` @ `43a2cecd6`. 12 plans, 6 waves, 5/5 success criteria marked verified.

---

## Verdict

Two different things happened. Only one of them is drift, and it is the larger one.

**1. Some of the gap is deliberate ROADMAP scoping, and is not a defect.**
The sketch's five-tab variant A ends in **Health**. `ROADMAP.md:418-431` splits that off as
**Phase 218** ("The Library Knows How It Is Used"): the Health tab, the `Library Health` +
`Governance` nav retirement, the `governance_health` gate move and the fallback replacement are
218's five success criteria, not 217's. `LibraryPage.tsx:111` and `:613-620` say so in the source.
So: four tabs instead of five, and a sidebar that still lists `Library Health` / `Governance`, are
**correct by plan**. Nothing to fix there — 218 fixes it.

**2. The rest is real drift, and it has one cause: the phase was built to the CONTRACT, not to the SKETCH.**

`BUILD-CONTRACT.generated.md` — the artifact the plans were written from — carries **200 assertions
about vocabulary, ordering and honesty**: the page title, the tab set, the fixed column order, the six
stage names, the Health filter words, the empty-arm sentences, the light/dark tab-contrast finding.
It carries **zero assertions about composition**. No card. No stat tile. No table anatomy. No row
expansion. No pagination. No button.

Grepped every one of the 12 plans plus CONTEXT / RESEARCH / PATTERNS for the sketch's own composition
strings:

| sketch string | hits across all 217 planning docs |
|---|---|
| `Vector store` | **0** |
| `Embedding model` / `Re-index everything` | **0** |
| `Found by a search` | **0** |
| `In progress` (the ingestion queue table) | **0** |
| `Rows per page` | **0** |
| `Documents with no vectors` | **0** |

None of it was ever planned. So none of it could be found missing by a plan-checker, a code review, a
verification pass or a green gate — **every gate was green and every gate was blind**, because the only
executable acceptance bar asserted words and order, and the picture was never converted into anything
assertable. This is the failure mode already recorded as `feedback_sketch_to_build_drift.md`, arriving
from the opposite direction: the last time, a sketch hand-wrote its own CSS and could not bind; this
time the sketch bound perfectly — but only its **text**.

⭐ **The tell that this diagnosis is right**: every honesty rule in the contract *did* ship, precisely.
No percentage. No ETA. `87 of 224` as numerator-and-denominator. `Not known yet` instead of a zero.
Struck-through skipped stages. The phase executed its contract faithfully. The contract was the wrong
size.

---

## Per-tab diff

### Documents tab (shipped `1.png` · sketch `FireShot 003`)

| the sketch draws | shipped |
|---|---|
| breadcrumb `Library › Engineering › Documents` | ✗ absent |
| three stat cards — **CHUNKS** `1,284 across 24 documents` · **VECTORS** `12,847 text-embedding-3-small` · **FOUND BY A SEARCH** `31 last 30 days`, each with a sparkline | ✗ absent |
| per-row expand chevron | ✗ absent |
| folder tag pill under the filename (`Engineering`, `Planning`) | ✗ absent |
| chunk count with a proportion bar under it | plain number |
| an in-flight row shows the **six-stage strip inline in the Status cell** | ✗ status badge only |
| a failed row shows its reason as a **sentence** under the badge | ✗ (reason lives in the panel / Ingestion tab) |
| footer `Rows per page: 25 · 1–5 of 24 · ‹ ›` | ✗ absent |
| — | shipped adds a `Where + condition` filter bar the sketch does not draw (Phase 114 inheritance, defensible) |

✅ Correct: page title, subtitle, the fixed column order `Filename · Type · Size · Chunks · Status ·
Actions`, the `4 tables` / `1 imgs` pills, the dropzone band and its printed format list.

### Views tab (shipped `2.png` · sketch `FireShot 010`)

⛔ **This is the one the sketch predicted in writing and shipped anyway.** The sketch's own annotation:
*"This tab had no design until now… it needs content of its own — otherwise it is the sidebar again with
more clicks."*

Shipped is the sidebar again with more clicks: a `VIEWS` panel with one row and a `…` menu.

| the sketch draws | shipped |
|---|---|
| a 2-column grid of **view cards** | a single list row |
| each card: name · match count · **the rule in plain words** (`type is contract · added in the last 30 days`) · rule bar · `8 of 224 documents` · `…` | name · count · `…` |
| `New view` button | ✗ absent |
| ⭐ the zero-match card — amber outline, `0`, **`Matches nothing right now`** — *"the fourth card is what makes this a tab rather than a list"* | ✗ absent |

### Ingestion tab (shipped `3.png` · sketch `FireShot 006`)

The shapes are not the same shape.

| the sketch draws | shipped |
|---|---|
| the **dropzone** leads the tab | ✗ absent (dropzone is on Documents only) |
| **`In progress`** card — a table: `Filename · Stage · Size · Actions`, `3 files` | six **stage-count cards** the sketch never draws, then a bare `<ul>` |
| the strip's six segments carry **visible labels** `READ · TBL · IMG · SPLIT · INDEX · LABEL` | ⛔ **six blank boxes** — the labels are `sr-only` |
| a waiting file reads `Waiting` under its strip | ✗ absent |
| **`Needs attention`** — `● Failed` badge · **`The file had a character we could not store.`** · size · **`Try again`** button | ⛔ prints the **raw Postgres error dict**; no badge, no size, no action |

### Indexing tab (shipped `4.png` · sketch `FireShot 005`)

Shipped is one card with two rows. The sketch is three cards.

| the sketch draws | shipped |
|---|---|
| **Vector store** card — `Vectors` · `Chunks indexed` · `Documents with no vectors` · `Last indexed` | ✗ |
| **Embedding model** card — `Model` · `Dimensions` · `Provider` · `Change model` · `Re-index everything` + the consequence sentence *"Search keeps working on the old vectors until it finishes."* | `Model` + `Chunks indexed` only |
| **Folders** table — `Folder · Documents · Chunks · Vectors · Last indexed · Actions` + `Re-index selected`, whose whole point is the `Uncategorized / – / – / never` row | ✗ absent |

---

## Defects (not merely absences)

| id | where | what |
|---|---|---|
| **D-1** | `IngestionStrip.tsx:151-152` | Every stage label is `sr-only` plus a `title`. The strip renders as six unlabeled boxes — a sighted user cannot read the pipeline this phase exists to make readable. The sketch draws the words. |
| **D-2** | `IngestionTab.tsx:122` | `doc.error_message` is rendered verbatim, so a duplicate-key failure prints `{'message': 'duplicate key value violates unique constraint "documents_completed_hash_unique_idx"', 'code': '23505', …}` to the operator. The sketch's arm is one sentence. Visible in `3.png`. |
| **D-3** | `IngestionTab.tsx` | The failed row's only failure cue is a 1px ring on an unlabeled box (compounds D-1). |
| **D-4** | Ingestion tab | No dropzone. A tab named *Ingestion* cannot start an ingestion. |

---

## What is buildable today, and what is not

Checked against the live tree, so the fix plan does not promise a number nobody stores.

**Free — front-end only, data already in hand or already fetched:**

- Documents `CHUNKS` tile — sum `chunk_count` over the documents the page already holds.
- Documents `VECTORS` tile + Indexing `Chunks indexed` / `Model` — `GET /settings/reembed-progress`, already called by `IndexingTab`.
- Documents `FOUND BY A SEARCH` tile — `GET /knowledge-health/overview` already returns `retrieved_this_month`, `total_documents`, `never_retrieved_count` over a 30-day window (`knowledge_health.py:399-530`).
- Views cards, the rule-in-words line, the counts, `New view`, the zero-match card — `listViews()` already returns the filter; `ViewsGroup` already renders counts.
- The Ingestion `In progress` / `Needs attention` tables, `Try again`, the visible strip labels, the `Waiting` line — all from `useDocuments` + the shipped reingest endpoint.
- The Ingestion dropzone — mount the existing `DocumentUpload`.
- Row expansion, folder pill, chunk bar, pagination footer, breadcrumb — client-side over data already loaded.

**Needs a backend read (scope it honestly, do not fake it):**

- `Documents with no vectors` and `Last indexed` on the Vector store card.
- The **Folders** index table (`Documents · Chunks · Vectors · Last indexed` per folder) — one new aggregate endpoint. This is the table whose `Uncategorized / – / – / never` row is the point of the tab.
- `Dimensions` / `Provider` on the Embedding model card — check whether `reembed-progress` already carries them before adding a field.

**Do not build (the sketch already cut these, with reasons):** a `Semantic Match %` column, free-text
tags with an `✕`, a `Vector Database Health 98%` donut, `Query Latency p99`, a `Source` column, a token
pie, S3 / Google Drive connector cards.

---

## Fix plan — Phase 217.1, "the Library looks like the Library"

Front-end composition only. No new vocabulary, no new honesty rule, no schema. Everything below is a
CHILD component mounted into the four bodies that already exist — `LibraryPage.tsx` keeps its reducer
and its four triggers untouched.

### Wave 0 — close the gate that let this through (do this first, or 217.1 drifts too)

- **0-A** Regenerate the sketch's build contract with **composition assertions**: for each of the four
  tab bodies, the ordered list of blocks the sketch renders (`stat-cards → table → footer`), each
  block's required child atoms, and each named button. Emit them from `drive.cjs` the same way the 200
  text assertions are emitted — a hand-transcribed list is the thing that goes stale.
- **0-B** Add a `sketch-composition` fence suite that mounts each tab body and asserts the emitted block
  list by `data-*` hook, driven RED against the current tree first. A guard nobody has seen fire is not
  a guard.

### Wave 1 — the four defects (user-visible today)

- **1-A** `IngestionStrip`: render the stage label as visible text inside each segment; keep an
  `sr-only` copy only where the visible text is insufficient. Pin the six words in the suite.
- **1-B** `IngestionTab`: route `error_message` through a plain-language mapper (reason sentence for the
  user, raw string behind ⌥ Technical-names). Never print a driver dict.
- **1-C** `IngestionTab`: `Needs attention` becomes the sketch's row — badge · sentence · size ·
  `Try again` wired to the shipped reingest endpoint.
- **1-D** Mount `DocumentUpload` at the top of the Ingestion tab.

### Wave 2 — the Ingestion tab's real shape

- **2-A** Replace the six stage-count cards with the sketch's **`In progress`** table
  (`Filename · Stage · Size · Actions`, `N files` in the header, `Waiting` under a not-started strip).
  ⚠ The stage-count cards are an invented surface — delete them, do not hide them.

### Wave 3 — the Documents tab's furniture

- **3-A** The three stat cards (`CHUNKS` · `VECTORS` · `FOUND BY A SEARCH`), from the three sources
  named above. A tile whose source is unreachable says so; it never renders `0`.
- **3-B** Breadcrumb, folder tag pill, chunk proportion bar, per-row expand chevron.
- **3-C** The pagination footer. ⚠ Confirm the shipped list is actually paginated before drawing a pager
  over a full fetch.
- **3-D** In-flight rows carry the strip inline in the Status cell; failed rows carry the reason sentence.
  ⚠ `nth-child(3–5)` shedding when the 430px panel opens is load-bearing — re-verify after any cell change.

### Wave 4 — the Views tab stops being the sidebar

- **4-A** The card grid: name · count · rule in plain words · rule bar · `N of M documents` · `…`.
- **4-B** `New view`.
- **4-C** ⭐ The zero-match card — amber outline, `0`, `Matches nothing right now`. This is the one the
  sketch says makes it a tab.
  ⚠ Selection stays on `librarySelection`'s single reducer (217-05 / SC#5). Two renderings, one truth —
  do not add a second piece of selection state here.

### Wave 5 — the Indexing tab's three cards

- **5-A** Split the current card into **Vector store** and **Embedding model**, with `Change model` and
  `Re-index everything` + the consequence sentence. `ReembedStatusCard` stays composed unchanged
  (D-217-16).
- **5-B** The **Folders** table + `Re-index selected`. Needs the aggregate endpoint — scope it in this
  wave or defer the table with a named trigger, but do not ship an empty tab and call it done.
  ⚠ `Uncategorized` must read `– / – / never`, never `0` and never a green tick.

### Guardrails that apply

- **G-2 fires** on every wave — this is live UI against an approved mockup. The sketch **is** that
  mockup, so no new `/gsd:sketch` is needed; the acceptance bar is Wave 0's emitted composition contract.
- **G-5** on `LibraryPage.tsx` (10 phases), `DocumentList.tsx` (12), `IngestionTab` / `IndexingTab` /
  `ViewsTab` (young). Honour by construction: every wave adds a CHILD, no wave adds a branch to
  `LibraryPage.tsx`.
- **G-4** — the operator drives the four tabs in a browser at close. Wire-format green is what shipped this.
- ⚠ **Health is NOT in this phase.** It is Phase 218. A 217.1 that grows a fifth tab has repeated the
  mistake in the other direction.
