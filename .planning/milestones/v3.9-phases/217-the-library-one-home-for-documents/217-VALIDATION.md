---
phase: 217
slug: the-library-one-home-for-documents
status: signed-off
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-29
closed: 2026-08-29
closed_by: 217-12
---

# Phase 217 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `217-RESEARCH.md` § *Validation Architecture* (measured 2026-08-28).
> ⚠ Every figure here was RE-DERIVED that session. Re-derive again rather than quote.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend)** | vitest + `@testing-library/react` (jsdom) |
| **Framework (backend)** | pytest + `fastapi.TestClient`, `unittest.mock.MagicMock` |
| **Config file (frontend)** | `frontend/vitest.config.*` |
| **Config file (backend)** | `backend/pytest.ini` — `asyncio_mode = auto`, `testpaths = tests` |
| **Backend fixtures** | `backend/tests/conftest.py:111-180` — `app.dependency_overrides` for `get_current_user`, `get_supabase`, **and** `get_user_supabase_client` (`_user_supabase_override` `:117-131`) |
| **Quick run command (frontend)** | `cd frontend && npx vitest run <path> --maxWorkers=2` |
| **Quick run command (backend)** | `cd backend && venv/Scripts/python -m pytest tests/test_217_*.py -x -q` |
| **Full suite command** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **from the repo root** |
| **Sketch gate (G-2 acceptance bar)** | `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` |
| **Estimated runtime** | full gate ~5–8 min · a single suite ~5–20 s · backend `test_217_*` ~10 s |

### ⭐ Count-gate baseline, re-derived 2026-08-28 (repo root, quiet tree, cap 2)

```
  total                                      5710    6438    +728
  total 6438  ·  failed 0  ·  pinned total 5710
count gate OK — 136/136 pinned files present, no per-file decrease, 0 failing.
```

| | CLAUDE.md's latest correction (Phase 214-15) | **measured 2026-08-28** |
|---|---|---|
| grand total | 6355 | **6438** |
| pinned total | 5266 | **5710** |
| pinned files | 120/120 | **136/136** |

⚠ **The SIXTH rot, on the same calendar day as the fifth.** The gate's contract is *no per-file
DECREASE* and *zero failing* — **never a fixed grand total**. Adopting a suite RAISES the totals;
that is the desirable direction. State the arithmetic per plan so each `+n` is attributable.

### ⚠ The document space is almost entirely OUTSIDE the gate

Only **one** doc-space suite sits in both knobs: `DocumentDetailPanel.images.test.tsx` (pinned at 3).
`IngestionPage.test.tsx`, `useDocuments.test.ts`, `DocumentList.test.tsx`, `ViewsGroup.test.tsx`,
`DocumentStatusBadge.test.tsx`, `FilterBar.test.tsx`, `CsvTablePreview.test.tsx` and
`DocumentDetailPanel.a11y.test.tsx` are in **neither** — the gate has never executed them.

**Mechanism (exact):** **TARGETS** entries are paths handed to `vitest run`
(`scripts/vitest-count-gate.cjs:4045-4051`); a **directory** entry recurses into `__tests__/`.
**BASELINE** keys are **bare filenames** (`bareName()` `:4099-4101`). Only ONE directory entry exists
(`src/components/workflows`) — everything else is an explicit file path. **A new suite needs BOTH, in
the same commit that creates the file.**

---

## Sampling Rate

- **After every task commit:** the one or two suites that task touches, at `--maxWorkers=2`
- **After every plan wave:** full gate from repo root **plus** `node .planning/sketches/218-…/drive.cjs` **plus** `cd backend && venv/Scripts/python -m pytest tests/test_217_*.py`
- **Before `/gsd:verify-work`:** full frontend gate green (≥ 6438 total, 0 failing, no per-file decrease), `drive.cjs` green, backend `tests/` at or above baseline
- **Max feedback latency:** ~20 s per task; ~8 min per wave

⚠ **`count gate OK` is not reliably reachable on demand** (SEED-171 — five suites flake independently
of the worker cap). If it reds: capture failing filenames from the gate's own persisted JSON
**before** re-running anything, check each against `git diff --numstat`, and **do not touch the cap**.

---

## Per-Task Verification Map

> Requirement-grain map. The planner fills the Task-ID column when plans are written; every task must
> land on one of these rows or add its own.

| Req / SC | Behaviour | Test Type | Automated Command | Plan | Verdict |
|---|---|---|---|---|---|
| LIB-01 | Page exports `LibraryPage`, renders `Library`, `nav-items` label reads `Library` | unit | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | 217-04, 217-09 | ✅ 12 cases |
| LIB-01 | `ActiveView` still contains `"documents"`; `ChatLayout`'s trailing `else` is still `<KnowledgeHealthPage />` | source fence (`?raw`) | `npx vitest run src/__tests__/library/renameFence.test.ts --maxWorkers=2` | 217-04 | ✅ 15 cases |
| LIB-02 | ONE constant drives both `accept` and the displayed list; displayed ⊆ server `ALLOWED_MIME_TYPES` (`documents.py:91`) | unit + source fence | `npx vitest run src/components/ingestion/__tests__/acceptFormats.test.ts --maxWorkers=2` | 217-07 | ✅ 19 cases |
| LIB-02 | Dropzone mounted on the Documents tab, full-width, names its target folder | component | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | 217-07, 217-09 | ✅ |
| LIB-03 | Six segments in **backend write order**, asserted against `documents.py`'s LIVE source | unit + `?raw` source fence | `npx vitest run src/components/ingestion/__tests__/IngestionStrip.test.tsx --maxWorkers=2` | 217-08 | ✅ 25 cases |
| LIB-03 (D-217-23) | `completed` does NOT read `ingestion_step`; `failed` renders later segments as **dimmed / not reached**; skipped conditionals **struck through**; **no `%`, no ETA** | unit + negative fence | same file | 217-08 | ✅ |
| LIB-03 (D-217-24) | `tables_stage_applies` / `images_stage_applies` derive from `multimodal_service.py`'s frozensets; `skipped` iff `!applies && count === 0` | backend unit + FE unit | `pytest tests/test_217_document_response_fields.py -x` | 217-01, 217-08 | ✅ |
| LIB-03 (D-217-10) | `ingestion_step` survives `GET /documents` | **backend** unit | same file | 217-01 | ✅ |
| LIB-04 | Each of five routes: 200 shape · 404 for a foreign doc · empty-not-error when no rows | **backend** unit | `pytest tests/test_217_document_detail_routes.py -x` | 217-02, 217-03 | ✅ |
| LIB-04 (D-217-07) | `/queries` scopes by `user_id` **in the SQL**, never from the request | backend unit (assert `.eq("user_id", …)` on the mock) | ⚠ **CORRECTED** → `pytest tests/test_217_document_queries.py -x` | 217-03 | ✅ `test_user_id_filter_is_applied_in_the_sql:82` |
| LIB-04 (D-217-05) | `/content` slices by line range, reports `total_lines`, returns **UNNUMBERED** content | backend unit | `pytest tests/test_217_document_detail_routes.py -x` | 217-02 | ✅ |
| LIB-04 (D-217-04) | Sections fetch **on expand, not on mount** (zero calls before the accordion is clicked) | component | `npx vitest run src/components/metadata/__tests__/DetailSections.lazy.test.tsx --maxWorkers=2` | 217-10 | ✅ 14 cases |
| LIB-04 | A table renders as a table, scrolls horizontally in the 430px track, escapes HTML in cells | component | `npx vitest run src/components/metadata/__tests__/DetailSections.tables.test.tsx --maxWorkers=2` | 217-11 | ⚠ **PARTIAL** — the table/escaping half is ✅ (15 cases); the **scrolls** half is **M/G4-5 OWED**: jsdom's `getBoundingClientRect` is always zero, so no test in this repo can prove a table scrolls |
| SC#5 (D-217-12) | Folder click while a view is loaded yields `{tab:'documents', folderId}`; **no reachable state where tab and list disagree** | unit over the reducer (pure — exhaustive) | `npx vitest run src/pages/__tests__/librarySelection.test.ts --maxWorkers=2` | 217-05 | ✅ 25 cases |
| SC#5 | Sidebar `ViewsGroup` and the Views tab read the **same** selection | component | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | 217-09 | ✅ |
| D-217-20/21 | Active trigger is **lighter than its track in BOTH themes**, measured from `index.css` tokens | source-token fence | `npx vitest run src/components/ui/__tests__/tabsContrast.test.ts --maxWorkers=2` | 217-06 | ✅ 14 cases — ⚠ proves L(active) > L(track), NOT perception (M-3 owed) |
| D-217-11 | The sketch's assertions still pass against the moved tree | sketch drive | `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | 217-04, 217-06, 217-08 | ✅ **200 passed · 0 failed** at `217-12` |
| GATE (D-217-01) | Every suite this phase wrote RUNS and is GUARDED | two-knob adoption | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | 217-12 | ✅ `153/153` · total 6664 · pinned 5930 · 0 failing |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `frontend/src/pages/__tests__/LibraryPage.test.tsx` — git-mv of the existing 158 L `IngestionPage.test.tsx` + new cases
- [x] `frontend/src/__tests__/library/renameFence.test.ts` — `?raw` fences on `ActiveView` and `ChatLayout:879`
- [x] `frontend/src/components/ingestion/__tests__/acceptFormats.test.ts`
- [x] `frontend/src/components/ingestion/__tests__/IngestionStrip.test.tsx`
- [x] `frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx`
- [x] `frontend/src/pages/__tests__/librarySelection.test.ts`
- [x] `frontend/src/components/ui/__tests__/tabsContrast.test.ts`
- [x] `backend/tests/test_217_document_response_fields.py`
- [x] `backend/tests/test_217_document_detail_routes.py`
- [x] **TARGETS + BASELINE entries for every file above, PLUS the four pre-existing orphans** (`useDocuments.test.ts`, `DocumentList.test.tsx`, `DocumentDetailPanel.a11y.test.tsx`, `ViewsGroup.test.tsx`) — `scripts/vitest-count-gate.cjs`
- [x] Extend `frontend/src/lib/__tests__/apiBarrel.test.ts` to cover `api/documents.ts` (currently `connectors.ts` only)

*No framework install required — vitest and pytest are both configured and green.*

---

## Manual-Only Verifications

⚠ **A validation section that lists only what it covers is not a validation section.** These six
facts are provable by NO automated layer.

| # | Behaviour | Req | Why Manual | Test Instructions |
|---|---|---|---|---|
| M-1 | ⭐ A document already mid-ingest when the Library opens shows its stage | LIB-03 / D-217-10 | **Invisible to any test that mocks the fetch** — a component test supplies whatever shape the author chose, so it passes before AND after the fix | An integration test that mocks **NEITHER** side: a real `GET /documents` response (backend TestClient, real `response_model` serialization) fed into the real `useDocuments` reconcile. ⚠ The **backend** half is load-bearing — it is the `response_model`, not the query, that strips the field today |
| M-2 | ⭐ Pixel spacing, rhythm, hover and focus states | all UI | Sketch 218 §7 explicitly leaves these to a human comparison | **G-4 row, driven BY LOOKING**, side by side with `.planning/sketches/218-the-library-and-its-tabs/index.html` and the running app |
| M-3 | The tab chip reads as **raised**, not merely *different* | D-217-21 | A token fence proves L(active) > L(track); it cannot prove perception | Look at **both themes** with the tab bar visible |
| M-4 | The strip never **jumps backwards** | LIB-03 | A unit test asserts one snapshot of state; only a real ingest proves the sequence | Watch a real PDF ingest end to end |
| M-5 | The empty arms are **honest** | LIB-04 | *"No tables"* / *"No tables were extracted"* / *"This file type has no tables"* are three different claims | Read them against a real document of each kind |
| M-6 | The RLS asymmetry as **experienced** | LIB-04 | A test asserts the empty result; only a person can say whether the screen is confusing | Two accounts + a shared folder: `document_chunks` SELECT was widened by mig `110:215-223` to owner-OR-globally-visible-folder, but `document_tables` / `document_images` are **owner-only** (`108:180-189`). A shared document returns text + chunks but **empty** tables/images |

---

## G-4 lived-experience rows (operator-defined at scope time)

⚠ CLAUDE.md **G-4** requires operator-defined *"I'd recognise failure here"* scenarios, defined at
scope time and driven against the running app. These are the researched candidates.

| # | Scenario | How failure would be recognised |
|---|---|---|
| G4-1 | Land on the Library cold; upload a real PDF without hunting | the dropzone is not the first thing seen, or the target folder is unclear |
| G4-2 | Watch that PDF ingest end to end on the Ingestion tab | a segment lights out of order, a percentage appears, or a stage stays pending forever |
| G4-3 | Upload a `.txt` and watch its strip | Tables/Images are **not** struck through — an absent thing looks pending |
| G4-4 | **Reload the page mid-ingest** | the strip shows nothing until the next transition — **the D-217-10 defect; this row is the only thing that catches it live** |
| G4-5 | Open a document with tables and read them in the 430px panel | the table is clipped rather than scrollable, or a wide table pushes the panel |
| G4-6 | Select a saved view from the sidebar, then click a folder | the tab and the list beneath it disagree, even for one frame |
| G4-7 | Toggle Deep Midnight ↔ light with the tab bar visible | the active tab reads as a hole in either theme |
| G4-8 | Open Settings and Library Health after the tabs change | their tab bars regressed as collateral (the two other `ui/tabs` mounts) |
| G4-9 | Side by side with `.planning/sketches/218-…/index.html` | spacing/rhythm visibly diverges from the approved sketch |
| G4-10 | Ingest a file that FAILS | later segments render as *pending* (looks like it is still working) rather than **dimmed / not reached** — D-217-23 |

---

## The 4-axis UAT bandwidth rule — RULED NOT APPLICABLE

CLAUDE.md SC#10 requires the full 8-row native provider roster + multi-tool + parallel-thread +
long-message rows for *"any phase touching streaming, agent loop, provider routing, or UI state."*

**This phase touches none of the first three** — no provider call, no model routing, nothing in the
agent loop or the SSE path, and no new code reads `MODEL_CAPABILITIES`.

⚠ **"UI state" is arguably touched** (D-217-12 rewrites the page's selection state). The honest
reading is that SC#10's *UI state* clause targets **streaming** UI state — the run/thread surfaces the
rule was written for (Phases 067.5–075.4). The Library's selection state is not on that path.

**Ruling: the cross-provider roster, the parallel-thread axis and the long-message axis are NOT
required for Phase 217.** What IS required is **G-4** — the rows above, driven against the running
app, including the by-looking sketch comparison (M-2). Recorded here rather than left open.


---

## ⭐ The mechanical seam audit (added by `217-12`)

> Phase 214 shipped **five blockers** whose planted tests all PASSED, because each side's suite
> supplied the other side's half. `STATE.md` names the instrument: *"deriving the seam list
> mechanically — grep every introduced field for its producer and every consumer, and require that
> every file on the path appears in some plan's `files_modified`."* This section is that grep, run
> as a command rather than as a reading.

**Method, so it can be re-run rather than believed.** The owner map is parsed from the eleven plans'
`files_modified` frontmatter (union = **57** paths, of which `217-12`'s own four are excluded because
this plan ships no product code). Every symbol below is grepped across `backend/app`,
`frontend/src`, `frontend/tailwind.config.js` and `scripts`, with `*.test.*` and `__tests__/`
excluded, and each hit classified **USE** vs **mention** — ⚠ because *the mention-vs-use trap has
already fired four times in this phase*, twice on an agent that had been warned.

| Field / symbol | Producer | Consumers | Owning plans | Verdict |
|---|---|---|---|---|
| `extractor` | `documents.py:2507` + `multimodal_service.py:553` (the two write sites) · declared `models/document.py` | `DocumentContentSection` · `DocumentDetailPanel` · `DocumentTablesSection` · `types/index.ts` | 217-01, 217-02, 217-08, 217-10, 217-11 | ✅ |
| `ingestion_step` | `documents.py` (six write sites) · declared `models/document.py` | `IngestionStrip` · `IngestionTab` · `types/index.ts` · **`DocumentList.tsx:422`** | 217-01, 217-08, 217-09 · ⚠ **`DocumentList.tsx` — NO PLAN** | ⚠ see §*The one real finding* |
| `tables_stage_applies` | `models/document.py` `@computed_field` ← `multimodal_service.py` frozensets | `IngestionStrip` · `ingestionStages.ts` · `DocumentDetailPanel` · `DocumentTablesSection` · `types/index.ts` | 217-01, 217-08, 217-10, 217-11 | ✅ |
| `images_stage_applies` | same pair | `IngestionStrip` · `ingestionStages.ts` · `DocumentImagesSection` · `types/index.ts` | 217-01, 217-08, 217-11 | ✅ |
| route `/content` | `documents.py:882` | `lib/api/documents.ts` → `DocumentDetailPanel` → `DocumentContentSection` | 217-02, 217-10 | ✅ |
| route `/chunks` | `documents.py:952` | `lib/api/documents.ts` → `DocumentChunksSection` | 217-02, 217-10 | ✅ |
| route `/tables` | `documents.py:991` | `lib/api/documents.ts` → `DocumentTablesSection` | 217-02, 217-10, 217-11 | ✅ |
| route `/images` | `documents.py:1014` | `lib/api/documents.ts` → `DocumentImagesSection` | 217-02, 217-10, 217-11 | ✅ |
| route `/queries` | `document_queries.py:59` (own module, own service-role rationale) | `lib/api/documents.ts` → `DocumentQueriesSection` | 217-03, 217-10, 217-11 | ✅ |
| `getDocumentContent` | `lib/api/documents.ts:320` | `lib/api.ts` (barrel) · `DocumentContentSection` | 217-10 | ✅ |
| `listDocumentChunks` | `lib/api/documents.ts:338` | `lib/api.ts` · `DocumentChunksSection` | 217-10 | ✅ |
| `listDocumentTables` | `lib/api/documents.ts:349` | `lib/api.ts` · `DocumentTablesSection` | 217-10, 217-11 | ✅ |
| `listDocumentImages` | `lib/api/documents.ts:359` | `lib/api.ts` · `DocumentImagesSection` | 217-10, 217-11 | ✅ |
| `listDocumentQueries` | `lib/api/documents.ts:369` | `lib/api.ts` · `DocumentQueriesSection` | 217-10, 217-11 | ✅ |
| `ACCEPTED_FORMATS` | `ingestion/acceptedFormats.ts` | `DocumentUpload.tsx` — the ONE constant driving both `accept` and the displayed list | 217-07 | ✅ |
| `INGESTION_STAGES` | `ingestion/ingestionStages.ts` | `IngestionStrip.tsx` · `library/IngestionTab.tsx` | 217-08, 217-09 | ✅ |
| `--tab-active` | `index.css` | `tailwind.config.js` (`ui/tabs.tsx` consumes it as the Tailwind class, not the raw var) | 217-06 | ✅ |
| `LibrarySelection` | `pages/librarySelection.ts:105` | `pages/LibraryPage.tsx` | 217-04, 217-05, 217-09 | ✅ ⚠ name collision, below |
| `libraryReducer` | `pages/librarySelection.ts` | `pages/LibraryPage.tsx` | 217-04, 217-05, 217-09 | ✅ |

### ⚠ The one real finding — reported, not absorbed

**`frontend/src/components/ingestion/DocumentList.tsx:422` consumes `doc.ingestion_step` and belongs
to NO plan's `files_modified`.**

```tsx
<DocumentStatusBadge status={doc.status} ingestionStep={doc.ingestion_step} />
```

It is a **deliberate no-change, not a gap** — and both halves of that sentence are measured:

- `git diff --stat 9a3808697..HEAD -- .../DocumentList.tsx` is **EMPTY**. The file is byte-unchanged
  by this phase; it last moved at Phase 155.
- `ingestion_step` was **already** on the frontend `Document` type before 217 (the diff of
  `types/index.ts` *edits* its docblock rather than adding the field).

⭐ **But the seam is real and is the more interesting half.** `217-01` (D-217-10) made the backend
**serialize** `ingestion_step` on `DocumentResponse` — so this pre-existing consumer had been
receiving `undefined` from `GET /documents` and now receives a value. **A consumer whose input
changed while its own bytes did not is exactly the Phase 214 shape**, and here it is caught by the
audit rather than by a user.

⛔ **And its render path is guarded by a suite this gate still does not execute.**
`DocumentStatusBadge.test.tsx` is in **neither** count-gate knob, and `217-12` deliberately declined
to adopt it (217 modifies neither `DocumentStatusBadge.tsx` nor `FilterBar.tsx` — adopting them would
make this phase the owner of rot it did not cause; the decline is recorded in
`scripts/vitest-count-gate.cjs`, never left silent). **This is precisely why `M-1` and `G4-4` are the
first owed rows and why `G4-4` is named as the row to drive first.**

### Two false positives, recorded because each is a real trap

| Apparent seam | Reality |
|---|---|
| `frontend/src/components/workflows/library/libraryFilter.ts` exports `LibrarySelection` | ⚠ **A genuine NAME COLLISION**, not a seam. Two *unrelated* exported types called `LibrarySelection` live in one tree — the workflow-library filter's (`:49`, Phase 192.x) and this phase's tab/folder union (`pages/librarySelection.ts:105`). Neither imports the other. Named here so the next grep does not mistake them for one symbol. |
| `frontend/src/lib/api/threads.ts` matches `/content` | A different route: `GET /threads/{tid}/workspace/files/{id}/content` (`:1063`). Unrelated to `/documents/{id}/content`. |

⚠ **THE MENTION-VS-USE TRAP FIRED A FIFTH TIME, inside this audit's own first pass.**
`extraction_service.py`, `document_governance.py:288` and `scripts/calibrate_confidence.py` were each
reported as an unowned `extractor` **USE**. All three are prose — `extractor_name`, `get_extractor`,
and the sentence *"the extractor left them blank"*. A file-wide `\bextractor\b` cannot tell a use
from a mention; only reading the matched line can. Recorded rather than quietly dropped, because *an
audit that silently discards its own false positives has no way to show it was discriminating.*

---

## Closing Evidence (`217-12`, 2026-08-29)

Every command below was executed at this commit, from the repo root unless stated, in a bootstrapped
worktree with `GSD_VITEST_MAX_WORKERS=2`.

| Gate | Result |
|---|---|
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | ✅ `count gate OK` — **153/153** pinned, **total 6664 · pinned total 5930 · failed 0**, no per-file decrease |
| `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | ✅ **200 passed · 0 failed · 200 assertions** |
| `pytest tests/test_217_document_response_fields.py tests/test_217_document_detail_routes.py tests/test_217_document_queries.py -q` | ✅ **40 passed** |
| `npx tsc -p tsconfig.app.json --noEmit` | ✅ **33** errors — **exactly** the re-derived pre-phase baseline; **zero new** |
| `node scripts/check-claude-md-size.cjs` | ✅ exit 0 — `102,379` chars, 68.3% of limit |
| `bash scripts/check-deploy-drift.sh` | ✅ `RESULT: PASS` (2 pre-existing non-blocking WARNs, neither introduced here) |

### The count-gate arithmetic, attributed file by file

⚠ **THE SEVENTH ROT.** The figures at the head of this file (`6438 / 5710 / 136`, 2026-08-28) are one
day old and already stale. Re-derived here; **a growing number is the gate WORKING** — its contract is
*no per-file DECREASE* and *zero failing*, never a fixed grand total.

| | this file said (2026-08-28) | **measured 2026-08-29 at `217-12`** |
|---|---|---|
| grand total | 6438 | **6664** |
| pinned total | 5710 | **5930** |
| pinned files | 136/136 | **153/153** |

Three runs, in order, so every `+n` is attributable:

1. **BEFORE** any edit: `total 6482 · pinned total 5746 · 139/139`.
2. **After the TARGETS block** (RUNS half only): `total 6664 · pinned total 5746 · 139/139` — **+182**.
3. **After the BASELINE pins** (GUARDED half): `total 6664 · pinned total 5930 · 153/153` — the
   grand total did **not** move, which is the proof that pinning guards rather than adds.

The `+182` decomposes with **zero residual** across the fourteen newly-executed suites:
`IngestionStrip` 25 · `librarySelection` 25 · `acceptFormats` 19 · `renameFence` 15 ·
`DetailSections.tables` 15 · `DetailSections.lazy` 14 · `tabsContrast` 14 · `LibraryPage` 12 ·
`ViewsGroup` 10 · `CsvTablePreview` 8 · `DocumentList` 7 · `DocumentDetailPanel.a11y` 7 ·
`useDocuments` 7 · `DocumentList.moveToFolder` 4 = **182**.
Pinned total moved `5746 → 5930` = `+182` **+ 2** for the `apiBarrel.test.ts` re-baseline `3 → 5`.

⚠ **Five other pinned files also grew on the BEFORE run** (`apiRunFields.fences` +13,
`WorkflowSoul` +10, `CanvasToolbar` +4, `BuilderSaveRegion` +3, `McpToolPicker.reachability` +2,
`WorkflowBuilderPage` +1, `ConnectionGrantsList` +1). **None is Phase 217's** — they arrived with
other work merged into this window, and none was re-pinned here, because re-baselining another
phase's file inside this commit would make 217 the owner of a delta it did not cause.

---

## Two discharges, recorded with their evidence

**D-217-03 — the traceability register can see this phase.** `LIB-01`…`LIB-04` are present in
`.planning/REQUIREMENTS.md` (added at `b435bb812`). Without them a `requirements mark-complete` at
close would have been a no-op and the phase would have shipped invisible to the register.

**D-217-15 — 217 ships FOUR tabs; the Health tab is Phase 218's.** This **SEQUENCES** sketch 218's
variant A rather than reversing it. ⚠ And the reason it does not fire the sketch gate is mechanical,
not lucky: the sketch's `B1` / `B1b` variant assertions read the **SKETCH surface**, not the shipped
page, so shipping four tabs cannot red them. Recorded so a later reader does not mistake a green
`drive.cjs` for evidence that five tabs shipped.

---

## ⛔ OWED at close — stated as a DECISION, never as a claim that everything ran

CLAUDE.md is explicit: *"Closing a phase with owed manual UAT rows is legitimate, and is often the
right call — but state it as a DECISION, never as a claim that everything ran."* Every automated
layer above is green. **Nothing below was driven**, because driving it requires a running app, a real
browser and a human eye, and this executor has none of the three.

### ⭐ Drive `G4-4` FIRST — it is the only live catch for the D-217-10 defect

A component test supplies whatever shape its author chose, so it passes **before and after** the fix.
`G4-4` (upload a large PDF, press F5 while it is still processing) is the only thing in this project
that can observe whether the strip shows a stage after a reload. **The seam audit above independently
lands on the same row**: `DocumentList.tsx` is a pre-existing `ingestion_step` consumer whose input
this phase changed, guarded by a suite the gate does not execute.

| Row | What it proves that no gate can | Status |
|---|---|---|
| **G4-4** ⭐ | the strip shows a stage after a mid-ingest reload | ⛔ **OWED — DRIVE FIRST** |
| G4-1 | the dropzone is the first thing seen; the target folder is clear | ⛔ OWED |
| G4-2 | segments light in order; no `%`, no stage stuck pending | ⛔ OWED (`M-4` — only a real ingest proves the sequence) |
| G4-3 | Tables/Images **struck through** on a `.txt`, not left looking pending | ⛔ OWED |
| G4-10 | a FAILED ingest dims later segments rather than showing them pending | ⛔ OWED |
| G4-5 | the table **scrolls** in the 430px track. ⚠ jsdom `getBoundingClientRect` is always zero — **only a human can prove this** | ⛔ OWED |
| G4-6 | tab and list never disagree, even for one frame | ⛔ OWED |
| G4-7 / M-3 | the active chip reads as **raised** in BOTH themes (the token fence proves L(active) > L(track), never perception) | ⛔ OWED |
| G4-8 | Settings and Library Health tab bars did not regress as collateral (the two other `ui/tabs` mounts) | ⛔ OWED |
| G4-9 / M-2 | pixel spacing, rhythm, hover, focus — **driven BY LOOKING** against `.planning/sketches/218-the-library-and-its-tabs/index.html`; sketch 218 §7 explicitly leaves this to a human | ⛔ OWED |
| M-1 | a document already mid-ingest when the Library opens shows its stage (an integration test mocking **NEITHER** side) | ⛔ OWED |
| M-5 | the three empty arms are **honest** — *"No tables"* / *"No tables were extracted"* / *"This file type has no tables"* are three different claims | ⛔ OWED (`217-11-SUMMARY.md` tabulates all ten sentences verbatim so it can be driven) |
| M-6 | the RLS asymmetry as **experienced** — a shared doc returns text + chunks but empty tables/images | ⛔ OWED |
| **CHAT-SURFACE row** | ⚠ **NOT in the original G-4 list, added here.** `DocumentDetailPanel` is a CROSS-SURFACE shell reusing `WorkspacePanel`'s sheet, so this phase's five new sections land on **chat** too. Chat UAT has not been run. | ⛔ OWED — **NEW** |
| **strip-label row** | ⚠ `217-08` recorded a real divergence from the drawn sketch: the strip's segment labels are `title` / `aria-label` / `sr-only`, **not visible text** (the sketch's short words would have been a forbidden seventh vocabulary). jsdom cannot say whether a wordless six-segment strip reads as informative or decorative. | ⛔ OWED — **NEW** |

**The artefact these verdicts belong in is `217-UAT.md`**, one row per id, each `PASS` / `FAIL` / `⛔`
with a named reason. `217-12` creates it pre-populated with every row at `⛔ OWED` and its reason —
⛔ **never omitted, and never reported as passing.**

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all ❌ references above
- [~] Every new suite is in **BOTH** `TARGETS` and `BASELINE` — ⚠ **NOT in the commit that
  creates it.** All fourteen landed in `217-12`'s single closing commit. The constraint is
  mechanical: a BASELINE key naming a file that does not yet exist makes the gate ERROR
  (exit 2), and pinning per plan would have made `scripts/vitest-count-gate.cjs` a shared
  artifact across six parallel worktrees and forced the whole phase serial. ⛔ **The cost is
  real and is stated rather than hidden: every one of those suites was UNGUARDED for the
  length of the phase.** Ticked as `~` — partially satisfied — rather than `x`, because a
  box that reads green for a thing that did not happen is worse than an unticked one.
- [x] No watch-mode flags; `GSD_VITEST_MAX_WORKERS=2` carried on every gate run
- [x] Feedback latency < 20 s per task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ signed off by `217-12` (2026-08-29) — see the
*Closing Evidence* and *OWED at close* sections above. This sign-off covers the AUTOMATED
layers only. ⛔ The G-4 lived-experience rows and M-1..M-6 are recorded as **OWED, by
DECISION**, never as a claim that they ran.
