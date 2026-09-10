# Phase 233 — The Preview: See It Before It Lands · CONTEXT

**Authored:** 2026-09-05 · **Builder + reviewer:** Claude (Gemini is out for this phase — operator).
**Requirements:** PREV-01, PREV-02, PREV-03, LIB-09
**Migrations:** none.

## G-2 is DISCHARGED before planning, not waived

Two sketches shipped and were **locked by the operator on 2026-09-05**:

| Sketch | Question | Winner |
|---|---|---|
| `229-the-four-buckets` | how four buckets read so the fourth's uncertainty is FELT | **C — the proportional spine** |
| `230-nothing-has-been-written-yet` | what the confirm looks like, and where a NAMED refusal lives | **A — the bar dissolves** |

**The sketches ARE the acceptance bar.** Their `drive.cjs` files (68 + 52 assertions) encode the
honesty invariants; this phase's vitest suites re-assert the same invariants against the React
build, so the sketch and the shipped surface cannot drift.

## Decisions taken at planning (D-233-nn)

- **D-233-01 — Tier-1 identity lives in `documents.metadata`, not a new column.** ROADMAP says
  *"none expected"* for migrations, and it is right: `metadata` is `jsonb` and already carries
  generated-column reads. Tier 1 is `metadata.source = {system, external_id, version}`, compared
  for **equality**. ⛔ It is **never** called a hash. Tier 2 `sha256` is unchanged and still runs
  inside `mint_document_row`.
- **D-233-02 — the preview IS the diff pass.** One function, `build_preview()`, classifies every
  listed file. Confirm calls the SAME classifier and imports only what it returned in `add`. A
  preview built as its own path is guaranteed to eventually disagree with the ingest.
- **D-233-03 — `source_version` is Drive's `modifiedTime`.** Already returned by `list_files`
  (`SourceFile.modified_at`). No adapter change, no second API call, and it is honest: it says the
  file moved, never that the bytes differ.
- **D-233-04 — four buckets are STRUCTURE, not state.** The React surface renders four accordion
  sections unconditionally. There is no filter chip, no "collapse all", and collapsing a section
  hides its **files**, never its **count**. That is the one risk 229-C carries over 229-A, and it
  is fenced by a test rather than by discipline.
- **D-233-05 — `outcome` has exactly three values** — `added` · `here` · `refused`. There is
  deliberately no fourth, so *"silently in neither"* (SC#5) is **unrepresentable**, not merely
  unlikely.
- **D-233-06 — the home is the Library's Ingestion tab.** `SourceFolderPicker` shipped at 232-04
  and is **mounted nowhere** (`grep -rl SourceFolderPicker frontend/src` = the component + its own
  test). ⛔ Not a sixth tab. The preview inherits `LibraryPage`'s measure.
- **D-233-07 — `LibraryPage` adopts `max-w-6xl` (1152px).** It is unconstrained today (`:641`,
  `p-8` and no max-width) and is the app's actual inconsistency. 1152 is the operator's own
  2026-08-28 adoption, already used by `SettingsPage.tsx:950` and `ConnectionsPage`. A precedent
  taken, not a fifth number invented. ⚠ `WorkflowsPage`'s 1200 is named and out of scope.
- **D-233-08 — rules are evaluated as a READ.** `classification_matcher.match_metadata` against the
  metadata the preview actually has (filename, mime, modified date). ⛔ **No folder is minted.**
  A rule that needs extracted metadata cannot fire yet, and the preview says so rather than guessing.

## Fences that must survive a later "simplification"

- ⛔ **No hash claim in the *Already here* copy.** `PROJECT.md`'s *"a `content_hash` lookup, not a
  guess"* is FALSE for a list-only pass: `documents.py:620` hashes raw **bytes**, Drive publishes
  **no** hash for native Docs/Sheets/Slides, and Graph populates hashes **after** download.
  The qualifier *"by source file, not content"* travels with the label.
- ⛔ **The preview writes nothing.** No document, no chunk, no job, no folder, no audit entry that
  reads like an import. The footer prints the zeros; Cancel's toast prints the zeros.
- ⛔ **A refusal is a NAME, never a colour.** 230-B failed SC#5 on exactly that.

## Blast radius (G-5 read before planning)

| File | Ledger | Verdict |
|---|---|---|
| `frontend/src/pages/LibraryPage.tsx` | 35/11/814 — FIRES | **honoured by construction** — one container class; each tab body is already a CHILD (217-09 seam taken) |
| `frontend/src/components/ingestion/DocumentList.tsx` | 24/13/294 — FIRES | **not modified** — its 7-column order stays load-bearing and untouched |
| `backend/app/api/connectors.py` | 32/15/1757 — FIRES, extraction OWED | two routes added; ⚠ **the owed extraction is neither taken nor obstructed** |
| `backend/app/services/sources/*` | young (232) | the new `preview_service.py` is a LEAF beside `import_service.py` |

⚠ `scripts/vitest-count-gate.cjs` needs **TARGETS *and* BASELINE** for every new suite, in this
phase. TARGETS decides what runs; BASELINE decides what is guarded; a suite can sit on the wrong
side of exactly one of them.

## Plans

| Plan | Wave | What |
|---|---|---|
| `233-01` | 1 | the diff pass — classifier, preview service, tier-1 identity at mint, two routes, backend suites |
| `233-02` | 2 | the surface — 229-C bar + 230-A dissolve, mounted in the Ingestion tab, vocabulary, vitest suites + gate pins |
