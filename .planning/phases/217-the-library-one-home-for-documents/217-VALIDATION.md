---
phase: 217
slug: the-library-one-home-for-documents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-29
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

| Req / SC | Behaviour | Test Type | Automated Command | File Exists |
|---|---|---|---|---|
| LIB-01 | Page exports `LibraryPage`, renders `Library`, `nav-items` label reads `Library` | unit | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | ❌ W0 (git-mv of the 158 L suite) |
| LIB-01 | `ActiveView` still contains `"documents"`; `ChatLayout`'s trailing `else` is still `<KnowledgeHealthPage />` | source fence (`?raw`) | `npx vitest run src/__tests__/library/renameFence.test.ts --maxWorkers=2` | ❌ W0 |
| LIB-02 | ONE constant drives both `accept` and the displayed list; displayed ⊆ server `ALLOWED_MIME_TYPES` (`documents.py:91`) | unit + source fence | `npx vitest run src/components/ingestion/__tests__/acceptFormats.test.ts --maxWorkers=2` | ❌ W0 |
| LIB-02 | Dropzone mounted on the Documents tab, full-width, names its target folder | component | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | ❌ W0 |
| LIB-03 | Six segments in **backend write order**, asserted against `documents.py`'s LIVE source | unit + `?raw` source fence | `npx vitest run src/components/ingestion/__tests__/IngestionStrip.test.tsx --maxWorkers=2` | ❌ W0 |
| LIB-03 (D-217-23) | `completed` does NOT read `ingestion_step`; `failed` renders later segments as **dimmed / not reached**; skipped conditionals **struck through**; **no `%`, no ETA** | unit + negative fence | same file | ❌ W0 |
| LIB-03 (D-217-24) | `tables_stage_applies` / `images_stage_applies` derive from `multimodal_service.py`'s frozensets; `skipped` iff `!applies && count === 0` | backend unit + FE unit | `pytest tests/test_217_document_response_fields.py -x` | ❌ W0 |
| LIB-03 (D-217-10) | `ingestion_step` survives `GET /documents` | **backend** unit | same file | ❌ W0 |
| LIB-04 | Each of five routes: 200 shape · 404 for a foreign doc · empty-not-error when no rows | **backend** unit | `pytest tests/test_217_document_detail_routes.py -x` | ❌ W0 |
| LIB-04 (D-217-07) | `/queries` scopes by `user_id` **in the SQL**, never from the request | backend unit (assert `.eq("user_id", …)` on the mock) | same file | ❌ W0 |
| LIB-04 (D-217-05) | `/content` slices by line range, reports `total_lines`, returns **UNNUMBERED** content | backend unit | same file | ❌ W0 |
| LIB-04 (D-217-04) | Sections fetch **on expand, not on mount** (zero calls before the accordion is clicked) | component | `npx vitest run src/components/metadata/__tests__/DetailSections.lazy.test.tsx --maxWorkers=2` | ❌ W0 |
| LIB-04 | A table renders as a table, scrolls horizontally in the 430px track, escapes HTML in cells | component | same file | ❌ W0 |
| SC#5 (D-217-12) | Folder click while a view is loaded yields `{tab:'documents', folderId}`; **no reachable state where tab and list disagree** | unit over the reducer (pure — exhaustive) | `npx vitest run src/pages/__tests__/librarySelection.test.ts --maxWorkers=2` | ❌ W0 |
| SC#5 | Sidebar `ViewsGroup` and the Views tab read the **same** selection | component | `npx vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | ❌ W0 |
| D-217-20/21 | Active trigger is **lighter than its track in BOTH themes**, measured from `index.css` tokens | source-token fence | `npx vitest run src/components/ui/__tests__/tabsContrast.test.ts --maxWorkers=2` | ❌ W0 |
| D-217-11 | The sketch's assertions still pass against the moved tree | sketch drive | `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | ✅ exists (193/193 at HEAD) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/pages/__tests__/LibraryPage.test.tsx` — git-mv of the existing 158 L `IngestionPage.test.tsx` + new cases
- [ ] `frontend/src/__tests__/library/renameFence.test.ts` — `?raw` fences on `ActiveView` and `ChatLayout:879`
- [ ] `frontend/src/components/ingestion/__tests__/acceptFormats.test.ts`
- [ ] `frontend/src/components/ingestion/__tests__/IngestionStrip.test.tsx`
- [ ] `frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx`
- [ ] `frontend/src/pages/__tests__/librarySelection.test.ts`
- [ ] `frontend/src/components/ui/__tests__/tabsContrast.test.ts`
- [ ] `backend/tests/test_217_document_response_fields.py`
- [ ] `backend/tests/test_217_document_detail_routes.py`
- [ ] **TARGETS + BASELINE entries for every file above, PLUS the four pre-existing orphans** (`useDocuments.test.ts`, `DocumentList.test.tsx`, `DocumentDetailPanel.a11y.test.tsx`, `ViewsGroup.test.tsx`) — `scripts/vitest-count-gate.cjs`
- [ ] Extend `frontend/src/lib/__tests__/apiBarrel.test.ts` to cover `api/documents.ts` (currently `connectors.ts` only)

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

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all ❌ references above
- [ ] Every new suite is in **BOTH** `TARGETS` and `BASELINE`, in the commit that creates it
- [ ] No watch-mode flags; `GSD_VITEST_MAX_WORKERS=2` carried on every gate run
- [ ] Feedback latency < 20 s per task
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
