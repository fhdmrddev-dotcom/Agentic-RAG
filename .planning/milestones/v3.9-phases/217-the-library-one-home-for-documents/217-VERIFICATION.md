---
phase: 217-the-library-one-home-for-documents
verified: 2026-08-29T07:17:17Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "G4-1 — Land on the Library cold; upload a real PDF without hunting"
    expected: "The dropzone is the first thing seen; the target folder is unambiguous"
    why_human: "'first thing seen' is a perceptual claim jsdom cannot render a viewport for"
  - test: "G4-2 — Watch a real PDF ingest end to end on the Ingestion tab"
    expected: "Segments light in order (extracting → chunking → embedding → tables/images → metadata), no percentage, no ETA, no stage stuck pending forever"
    why_human: "A unit test asserts one snapshot of state; only a live ingest proves the sequence over time"
  - test: "G4-3 — Upload a .txt and watch its strip"
    expected: "Tables/Images render struck through (skipped), never merely pending"
    why_human: "Needs a real .txt through the real pipeline"
  - test: "G4-10 — Ingest a file that FAILS"
    expected: "Segments after the failure point render dimmed/not-reached, never pending"
    why_human: "Needs a genuinely failing ingest (the .csv/.xls MIME defect is one cheap way to produce one)"
  - test: "G4-5 — Open a document with tables in the 430px detail panel"
    expected: "The table scrolls horizontally rather than clipping or pushing the panel wider"
    why_human: "jsdom's getBoundingClientRect is always zero — no automated test in this repo can prove scroll behavior"
  - test: "G4-6 — Select a saved view from the sidebar, then click a folder"
    expected: "The tab and the list beneath it never disagree, even for one frame"
    why_human: "The reducer is proven exhaustively (25 cases); the rendered frame is not"
  - test: "G4-7 — Toggle Deep Midnight ↔ light theme with the tab bar visible"
    expected: "The active tab never reads as a visual 'hole' in either theme"
    why_human: "tabsContrast.test.ts proves L(active) > L(track) from tokens; it cannot prove human perception"
  - test: "G4-8 — Open Settings and Library Health after this phase's tabs change"
    expected: "Their tab bars are not collateral damage from the shared ui/tabs.tsx ring change"
    why_human: "ui/tabs.tsx is a shared cross-surface primitive; three mounts, one code change"
  - test: "M-1 — A document already mid-ingest when the Library first opens"
    expected: "Its stage shows immediately, not only after the next realtime transition"
    why_human: "Needs a true integration test (real backend response_model serialization feeding real useDocuments reconcile) that this repo's suite does not run"
  - test: "M-5 — The three empty-tables/empty-images sentences read as distinct claims"
    expected: "'No tables' / 'No tables were extracted' / 'This file type has no tables' are not confusable"
    why_human: "Copy-quality judgment; the sentences are enumerated in 217-11-SUMMARY.md but not human-read yet"
  - test: "M-6 — The RLS asymmetry as experienced (shared document, two accounts)"
    expected: "Text + chunks return, tables/images return empty, and this does not read as broken to a real user"
    why_human: "Needs two accounts + a shared folder; a test can assert the empty result is correct but not that it reads as intentional"
---

# Phase 217: The Library — One Home for Documents Verification Report

**Phase Goal:** The document space stops being three pages and a stale filename. It becomes **Library** — one home, four tabs shipped this phase (a fifth, Health, is explicitly sequenced into Phase 218), with upload as a real front door instead of a button in a folder header's corner, and with the facts this app already stores finally rendered.
**Verified:** 2026-08-29T07:17:17Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (roadmap SC) | Status | Evidence |
|---|---|---|---|
| 1 | SC#1 — surface is called Library in nav + on page; `IngestionPage.tsx` renamed `LibraryPage.tsx` in the same commit; `ActiveView` key stays `"documents"` | ✓ VERIFIED | `frontend/src/pages/LibraryPage.tsx` exists, `IngestionPage.tsx` does not (`find` returns none). `nav-items.ts:38`: `{ view: "documents", icon: FileText, label: "Library" }` — key unchanged, label renamed. Page renders `<h1>Library</h1>` at `LibraryPage.tsx:575`. Rename landed in commit `dbd9b8c0b` (`refactor(217-04)`). |
| 2 | SC#2 — a person lands on the Library and can start an upload without hunting: full-width dropzone, real accepted formats, target folder named | ✓ VERIFIED | `frontend/src/components/ingestion/DocumentUpload.tsx` rewritten by 217-07 (`50050df23`); `acceptAttribute()` computed from single `acceptedFormats.ts` constant, cross-checked against server `ALLOWED_MIME_TYPES` by a source fence (`acceptFormats.test.ts`, 19 cases). Mounted on the Documents tab in `LibraryPage.tsx`. |
| 3 | SC#3 — ingestion shows the six stages the pipeline actually writes, two conditional and struck through when skipped; never a % or ETA | ✓ VERIFIED | `INGESTION_STAGES` in `ingestionStages.ts` lists `extracting, chunking, embedding, extracting_tables, extracting_images, metadata` — matches the live write order in `backend/app/api/documents.py` byte-for-byte (grepped both; identical sequence and identical six string literals at lines 2069/2249/2277/2315/2326/2436). `IngestionStrip.tsx` derives `skipped` from `!applies && count===0`, `not-reached` distinctly from `skipped`. No `%`/ETA literal in the file (fence-guarded). |
| 4 | SC#4 — detail panel shows parsed text, tables as tables, image descriptions, chunks, and the queries that found it | ✓ VERIFIED | Five new sections (`DocumentContentSection`, `DocumentChunksSection`, `DocumentTablesSection`, `DocumentImagesSection`, `DocumentQueriesSection`) all imported and mounted in `DocumentDetailPanel.tsx:314-359`. Tables render through `DataTableView` (an actual table, not a count). Images render descriptions (no bytes are ever stored — documented design decision, not a shortcut). Queries pull `search.query` audit rows scoped by `user_id` in SQL (`test_217_document_queries.py::test_user_id_filter_is_applied_in_the_sql`, passing). Five backend routes (`/content`,`/chunks`,`/tables`,`/images`,`/queries`) all exist and registered in `main.py:786`. |
| 5 | SC#5 — a saved View is reachable as a tab and from the sidebar from one source of selection truth; the two renderings can never disagree | ✓ VERIFIED | `librarySelection.ts` is a strict, dependency-free discriminated union + total pure reducer; `LibraryPage.tsx:153-154` reads `activeFolderId(lib)`/`activeViewId(lib)` as the ONLY selection accessors, used by both the sidebar `ViewsGroup` and the `ViewsTab`. Exhaustive reducer suite: 25 cases, passing. |

**Score:** 5/5 roadmap success criteria verified in the codebase (not merely claimed by SUMMARY.md).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| LIB-01 | 217-04, 217-05, 217-09 | Library rename + single selection truth | ✓ SATISFIED | See truths #1, #5 above |
| LIB-02 | 217-07, 217-09 | Real front-door upload | ✓ SATISFIED | See truth #2 |
| LIB-03 | 217-01, 217-08 | Six-stage ingestion strip in backend write order | ✓ SATISFIED | See truth #3 |
| LIB-04 | 217-01, 217-02, 217-03, 217-10, 217-11 | Five buried facts rendered | ✓ SATISFIED | See truth #4 |

No orphaned requirements — `.planning/REQUIREMENTS.md`'s traceability table maps all four LIB-IDs to Phase 217 with none left unmapped, and every plan's `requirements:` frontmatter is accounted for above.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/pages/LibraryPage.tsx` | Renamed page, four-tab shell, one reducer | ✓ VERIFIED | Exists, 724 lines, imports `librarySelection`, mounts all four `TabsContent` bodies |
| `frontend/src/components/ingestion/IngestionStrip.tsx` | Six-segment strip, no progress bar | ✓ VERIFIED | Exists, `segmentState()` pure function exported for testing, stage order matches backend |
| `frontend/src/components/ingestion/ingestionStages.ts` | The six-stage ordered constant | ✓ VERIFIED | Matches `documents.py` write order exactly (checked both files directly) |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | Mounts five new detail sections | ✓ VERIFIED | All five imported and rendered at lines 314-359 |
| `frontend/src/components/metadata/Document{Content,Chunks,Tables,Images,Queries}Section.tsx` | Five lazy-loaded detail sections | ✓ VERIFIED | All five files exist, all fetch via real `lib/api` client functions, all lazy (fetch on expand, `DetailSections.lazy.test.tsx` 14 cases) |
| `backend/app/api/documents.py` (`/content`,`/chunks`,`/tables`,`/images`) | Four user-JWT read routes | ✓ VERIFIED | All four `@router.get` handlers present, tested (`test_217_document_detail_routes.py`) |
| `backend/app/api/document_queries.py` | `/queries` in its own service-role module | ✓ VERIFIED | Registered in `main.py:786` after `documents.router`, owner-gated in SQL (tested) |
| `frontend/src/pages/librarySelection.ts` | Discriminated union + pure reducer | ✓ VERIFIED | Strict leaf (zero imports asserted by suite), 25 exhaustive test cases |
| `frontend/src/components/ui/tabs.tsx` | Shared tab primitive, contrast-safe active state | ✓ VERIFIED | `tabsContrast.test.ts` 14 cases; shared by Library, Settings, Library Health |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `NavPanel` / `nav-items.ts` | `LibraryPage` | `ActiveView === "documents"` switch in `ChatLayout.tsx:758` | WIRED | `<LibraryPage onNavigate={onNavigate} />` mounted directly, not a stub |
| `LibraryPage` (Ingestion tab) | `IngestionTab` → `IngestionStrip` | component composition | WIRED | `IngestionTab.tsx` imports and mounts `IngestionStrip` twice (list row + detail) |
| `DocumentDetailPanel` | five detail sections | component composition, `docId`/`doc` props | WIRED | all five imported and mounted with real props, not placeholders |
| `DocumentContentSection` etc. | backend read routes | `lib/api` client fns → `fetch` | WIRED | `getDocumentContent`, `listDocumentChunks/Tables/Images`, queries client fn all call the real endpoints; backend routes query real Postgres tables (verified route bodies, not static returns) |
| sidebar `ViewsGroup` + `ViewsTab` | `librarySelection` reducer | `activeViewId(lib)` shared accessor | WIRED | both consumers read the same derived accessor, no independent state |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `DocumentContentSection` | `content` (full_markdown) | `GET /documents/{id}/content` → real DB column, paged | Yes | ✓ FLOWING |
| `DocumentTablesSection` | `tables` | `GET /documents/{id}/tables` → real `document_tables` rows, rendered via `DataTableView` | Yes | ✓ FLOWING |
| `DocumentImagesSection` | `images` | `GET /documents/{id}/images` → real `document_images.description` (no bytes stored, by design) | Yes | ✓ FLOWING |
| `DocumentQueriesSection` | `queries` | `GET /documents/{id}/queries` → real `audit_log` `search.query` rows | Yes | ✓ FLOWING |
| `IngestionStrip` | `doc.ingestion_step`, `tables_stage_applies`, `images_stage_applies` | `GET /documents` response model, computed fields derived from `mime_type` at `backend/app/models/document.py:70-95` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend LIB-01..04 route/model suite | `pytest tests/test_217_document_detail_routes.py tests/test_217_document_queries.py tests/test_217_document_response_fields.py -q` | `40 passed, 1 warning` | ✓ PASS |
| Owner-gate SQL scoping (`/queries`) | `test_user_id_filter_is_applied_in_the_sql` | passed | ✓ PASS |
| Stage-order fence vs live backend source | `IngestionStrip.test.tsx` (source fence reads `documents.py` directly) | pinned, gated | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| Phase 218 sketch drive (the acceptance-bar fences for this build) | `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | `200 passed · 0 failed · 200 assertions` | PASS |
| Gap-closure round cap | `node scripts/check-gap-closure-rounds.cjs 217` | `G-7 clear — no gap-closure plans in this phase` | PASS |
| CLAUDE.md size gate | `node scripts/check-claude-md-size.cjs` | `102,974 chars, [OK], exit 0` | PASS |
| Frontend count gate (informational — inherited nondeterminism, not a phase defect) | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | previously measured `154/154 pinned, total 6666, 0 failing`; SEED-171 named suites can flake independent of this phase | PASS (see note) |
| `tsc -p tsconfig.app.json` | typecheck | `33 errors` — identical to pre-phase baseline, none added | PASS |
| Backend full unit suite | `pytest tests/unit` | `68 failed / 3110 passed` — identical to pre-phase baseline | PASS (no regression) |

### Hot-File Ledger Sync Check

All four owed rows are present in CLAUDE.md's ledger table AND have a matching `###` section in `docs/HOT-FILE-LEDGER.md`:

| File | CLAUDE.md row | Detail section | Disposition cell |
|---|---|---|---|
| `frontend/src/pages/LibraryPage.tsx` | present (line 686) | `docs/HOT-FILE-LEDGER.md:6458` | under 200 chars (gate passes) |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | present (line 688) | `docs/HOT-FILE-LEDGER.md:6488` | under 200 chars |
| `frontend/src/components/ui/tabs.tsx` | present (line 695) | `docs/HOT-FILE-LEDGER.md:6508` | under 200 chars |
| `frontend/src/components/panel/CsvTablePreview.tsx` | present (line 696) | `docs/HOT-FILE-LEDGER.md:6524` | under 200 chars |

`node scripts/check-claude-md-size.cjs` exits 0 — no `[disposition-too-long]`, `[duplicate-row]`, or `[malformed-row]` finding.

### VALIDATION.md Filename Correction Check

Confirmed: `217-VALIDATION.md` line 95 reads `pytest tests/test_217_document_queries.py -x` (marked "⚠ CORRECTED"), and the actual test `test_user_id_filter_is_applied_in_the_sql` lives in `backend/tests/test_217_document_queries.py:82` — not in `test_217_document_detail_routes.py`. The correction is accurate and matches the codebase.

### Anti-Patterns Found

None in phase-modified non-test source files. Scanned all 35 non-test `.tsx`/`.ts`/`.py` files changed since merge base `9a3808697`: zero `TBD`/`FIXME`/`XXX`, zero `TODO`/`HACK`/`PLACEHOLDER`, zero "coming soon"/"not yet implemented" strings.

**Not re-reported here (already recorded with re-open triggers in `deferred-items.md` and the phase REVIEW):**
- CR-01 (stale count badges) — FIXED in commit `6b5cd9682`, fence driven RED and confirmed catching the reverted defect.
- WR-01..WR-06 — six code-review Warnings, explicitly deferred under G-7 (closing them here would be an unbounded gap-closure round; none is a security hole; each exceeds G-3's fast-fix bar).
- Pre-existing `.csv`/`.xls` MIME-routing defect — predates this phase, recorded with a re-open trigger.
- Three doc-space suites still outside the count-gate's two knobs — recorded, Phase 218 named as the owner.
- Twelve comment-only `IngestionPage` string references — declined at close with a specific reason (comment content is load-bearing to a sketch fence in one of the twelve files) and a re-open trigger.

## Gaps Summary

No unmet must-haves. All five roadmap Success Criteria are independently verifiable in the codebase, not merely asserted by SUMMARY.md — I traced the six-stage order against the live backend write sites, confirmed the five new read routes exist and query real tables, confirmed the rename removed `IngestionPage.tsx` entirely, confirmed the nav label reads "Library", confirmed the single-selection-truth reducer is a genuine strict leaf with no parallel state, and confirmed CR-01 (the one Critical finding) was fixed with a fence that was driven red against the reverted code.

The phase's own operator decision to close with 16 UAT rows owed is honored here as a DECISION, not treated as an unmet must-have — but per the Escalation Gate contract, `human_needed` is the correct status because those rows are real, unclosed verification debt on user-visible behavior (ingest sequencing over time, 430px table scroll, theme contrast perception, cross-surface tab collateral). `G4-4` is named by the phase itself as the row to drive first.

---

_Verified: 2026-08-29T07:17:17Z_
_Verifier: Claude (gsd-verifier)_
