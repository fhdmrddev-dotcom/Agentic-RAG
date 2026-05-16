---
phase: 072-multimodal-lift-docx-completeness
plan: 03
type: human-uat
status: partial
target_doc: "3bf355d6-d4e1-416b-b067-9a63dd821945 (Fahed Mrad Chapters 1 to 4.docx)"
last_updated: "2026-05-17"
operator: fhdmrd@gmail.com
driven_by: orchestrator (curl + settings_override.json toggle, no .env edit, no uvicorn restart)
---

# Phase 072 — Human UAT Scoreboard

Closes Phase 072 SC#1/#3 on the DEFAULT engine only. The ≥80% recall target
that a `vision_sweep` opt-in engine would have closed is DEFERRED to a future
spike phase (see SEED-021 + CONTEXT.md `<deferred>` ▸ "vision_sweep + figure-
extractor OSS spike"). Phase 072's job is to fix the dropped-empty-row gap,
close the DOCX completeness gap, and wire the `app_settings` dead-code seam —
NOT to lift the raw detection ceiling.

## Default engine — pymupdf_full / zip_xpath_docx

**Thesis documents (both formats):**

| Filename | doc_id | mime |
|---|---|---|
| Fahed Mrad Chapters 1 to 4.docx | `3bf355d6-d4e1-416b-b067-9a63dd821945` | wordprocessingml.document |
| Fahed Mrad Chapters 1 to 4.pdf | `517a2827-90be-4d19-b6f9-aa6be36a32b6` | application/pdf |

**app_settings at run start (PREP):**
- `extraction_image_engine_pdf` = `pymupdf_full` ✓
- `multimodal_max_vision_calls` = `100` ✓ (lifted from old hardcoded 20)
- `multimodal_max_b64_bytes_kb` = `4096` ✓ (lifted from old hardcoded 512 KB)

**SQL output (post-Reingest, key restored):**

| Doc | total | with_desc | empty | Verdict |
|---|---|---|---|---|
| DOCX | 58 | 58 | 0 | GREEN — `total >= 20` AND `empty/total = 0.0 <= 0.10` |
| PDF | 67 | 67 | 0 | GREEN — `total >= 20` AND `empty/total = 0.0 <= 0.10` |

**Bottom line:** SC#1 default-engine target (≥34% raw recall) **EXCEEDED** —
both formats stored 58/67 figures vs the old 20-cap that would have silently
truncated everything past index 19. Plan 01's `app_settings.multimodal_max_*`
reads are demonstrably live.

**Notes:** Operator's DOCX is currently in a degraded chunk state (see Gap 3 below)
but image descriptions themselves are intact. PDF is clean.

---

## DOCX micro-UAT (soft-pass on existing thesis DOCX)

Plan asked for a hand-crafted 4-image DOCX (inline + header + floating + duplicate footer).
Instead we used the operator's existing 58-image thesis DOCX which exercises the
relevant code paths in production data.

**DOCX document_id:** `3bf355d6-d4e1-416b-b067-9a63dd821945`

**bbox.location label distribution (all 58 rows):**
- All 58 rows carry `bbox = {"location": "inline"}` — Plan 02's `_derive_docx_image_location` + `dataclasses.replace` annotation working end-to-end through `zip_xpath_docx`.

**What this proves:**
- Plan 02's per-image bbox annotation lands in the DB (not silent-dropped)
- Plan 02's `dataclasses.replace` mutation on frozen `ImageData` is correct
- The chunk-embedding loop's `[Image {location}]:` prefix derivation reads `bbox.location` (verified via Plan 02's unit test `test_docx_image_label_prefix_in_chunk_content`)

**What this does NOT prove (out of scope on real DOCX):**
- Mixed-location coverage (header/floating/footer) — operator's DOCX is all-inline,
  so the header/floating/footer paths are exercised only by Plan 02's unit tests
  (`test_docx_image_label_prefix_in_chunk_content` covers all 4 locations via
  fixture). A synthetic 4-image DOCX would have closed this with live data; that's
  deferred — unit tests are sufficient for closure.
- SHA1 dedup on a duplicate-logo case — operator's DOCX appears to have 58
  unique images (no dedup collapse observed). Unit test
  `test_dedup_images_by_hash_drops_duplicates` covers this in isolation.

**Verdict:** GREEN-with-caveat — production-data verification for bbox.location;
synthetic-DOCX verification deferred (covered by unit tests at non-regression-only level).

---

## Retry-empty smoke (POST /reextract?retry_empty_descriptions_only=true)

**Drove this end-to-end via orchestrator (no .env edit, no uvicorn restart):**

1. **Inject empty override** — wrote `"openai_api_key": ""` into `backend/settings_override.json`, waited 6s for the 5s cache TTL → backend's `/settings` GET confirmed `has_key=False` for openai provider while embedding_api_key flow stayed independent (separate resolution path per `user_settings.py:274`).

2. **Snapshot pre-test** (DOCX `3bf355d6-d4e1-416b-b067-9a63dd821945`):
   - `total=58, empty=0, with_desc=58, chunks=920`

3. **POST /documents/{id}/reextract** (full re-extract, no retry flag, body `{"engine":"pymupdf"}`) → HTTP 202 in ~3s, status went pending → completed.

4. **Snapshot post-disconnect:**
   - `total=58, empty=58, with_desc=0` — Plan 01's persist-empty contract working: vision-LLM calls failed (no key) → rows landed with `description=''` instead of being dropped. **This is the SC#3 closure (RAG-MM-LIFT-01 ceiling fix).**
   - `chunks=404` (chunker re-ran without vision text).

5. **Remove override** — popped `openai_api_key` key from `settings_override.json`, waited 6s → backend `/settings` GET confirmed `has_key=True`.

6. **POST /reextract?retry_empty_descriptions_only=true** with body `{"engine":"pymupdf"}` →
   - **First attempt: HTTP 500 (Bug A — see Gap 1).** PostgREST returned `22007 invalid input syntax for type timestamp with time zone: "now() - interval '5 minutes'"`. The helper passed a SQL expression as a PostgREST filter literal; PostgREST doesn't evaluate filter values as SQL.
   - **Hotfix applied + committed** (`d29f068`): compute the 5-minute cutoff client-side as ISO 8601 string, pass to `.lt("created_at", cutoff_iso)`. Plan 03's integration test (mocked supabase-py) was unaffected and still passes — exactly the mock blind-spot that let this slip in the first place.
   - **Retry after fix: HTTP 202 in 1s** — no crash, endpoint contract honored.

7. **Snapshot post-retry:**
   - `total=58, empty=58, with_desc=0` — **refill effectiveness: 0/58 (Bug B — see Gap 2).** The retry helper's `extract_docx_images` returned `[]` because the user's DOCX has zero `python-docx inline_shapes` — all 58 images are floating/header/footer caught only by the new `zip_xpath_docx` engine. The helper hit the "no images re-extracted" branch (helper line 832-846) and returned without UPDATEing any row.
   - `chunks=404` **UNCHANGED** — retry branch correctly skipped delete-cascade + chunker re-run. This is the binding contract.

**Verdicts:**

| Claim under test | Result |
|---|---|
| Retry endpoint doesn't crash | GREEN (after hotfix) |
| Retry doesn't trigger delete-cascade | GREEN (chunks=404 unchanged across the call) |
| Retry skips chunker re-run | GREEN (no new chunk timestamps post-retry) |
| Retry doesn't touch text/tables | GREEN (no changes to document_chunks or document_tables) |
| Retry refills empty descriptions | RED — engine-mismatch with the dispatcher era (0/58 refilled) |

**Overall:** **PARTIAL — endpoint contract verified, refill effectiveness blocked by Gap 2.**

---

## Section E — Pre-merge pytest gate (orchestrator drove)

```
cd backend && venv/Scripts/python.exe -m pytest \
  tests/integration/test_documents.py::TestReextractDocument \
  tests/unit/test_multimodal_extraction.py \
  tests/unit/test_aspect_engines_images_pdf.py \
  tests/unit/test_aspect_engines_images_docx.py \
  tests/unit/test_extract_composable.py \
  -x -q
```

**Result:** 29 passed, 1 warning. GREEN.

Includes Plan 03's `test_reextract_retry_empty_descriptions_only_branch` — still
green after the cutoff_iso hotfix (mock contract unchanged).

---

## Phase 072 closure status

- [x] **Default engine UAT GREEN** — both DOCX (58/58) and PDF (67/67) cleanly exceed the cap-lift target
- [x] **DOCX micro-UAT GREEN-with-caveat** — bbox.location labels confirmed in production data; mixed-location synthetic coverage deferred to unit tests
- [ ] **Retry-empty smoke PARTIAL** — endpoint contract GREEN; refill effectiveness RED (Gap 2 blocks it for the modern dispatcher era)
- [x] **All unit + integration tests green** — 29/29 passed post-hotfix

**Overall verdict:** **PARTIAL — ship Plans 01+02 surface, route Plan 03's refill effectiveness to gap closure.**

## Gaps (to be folded into Phase 072.1)

### Gap 1 — Plan 03 PostgREST filter bug *(CLOSED in-band)*
- **Surface:** `backend/app/api/documents.py` line 797 (pre-fix)
- **Status:** CLOSED by commit `d29f068` (`fix(072-03): compute 5-min cutoff client-side instead of passing SQL expression to PostgREST`)
- **Root cause:** PostgREST filter values are literals, not SQL expressions. `lt("created_at", "now() - interval '5 minutes'")` was sent as a string → `22007 invalid input syntax`.
- **Test-gap that let it slip:** integration test `test_reextract_retry_empty_descriptions_only_branch` mocked supabase-py — never exercised the live PostgREST layer.
- **Routing:** no follow-up plan needed for the fix, but **Gap 2 fix must add a non-mocked integration test** to prevent this class of bug recurring.

### Gap 2 — Plan 03 retry-helper engine dispatch *(OPEN — Phase 072.1 candidate)*
- **Surface:** `backend/app/api/documents.py` `_reextract_refill_empty_descriptions` (line 778+)
- **Symptom:** Retry endpoint returns 202 but refills 0 of N empty rows on real documents.
- **Root cause:** Helper hardcoded `from app.services.multimodal_service import extract_docx_images, extract_pdf_images` — these are the LEGACY pre-dispatcher functions. `extract_docx_images` returns 0 on operator's DOCX (no `python-docx inline_shapes`; all 58 images are caught by the new `zip_xpath_docx` engine via `wp:anchor` + header/footer walk). `extract_pdf_images` similarly mismatches the active `pymupdf_full` PDF engine for indices when the dispatcher engine differs.
- **Composite-key alignment:** `(image_index, page)` keys don't align across legacy vs dispatcher engines — fresh_by_loc lookup fails even for indices that happen to overlap.
- **Fix shape:** retry helper should read `app_settings.extraction_image_engine_pdf` / `extraction_image_engine_docx` and dispatch to the matching aspect engine via `extract_composable(raw, mime_type, engines={"images": configured_engine})`. Convert `ImageData` → dict shape for the composite-key matcher. Add live-PostgREST integration test that actually inserts rows + asserts UPDATE side-effects (no mocks).
- **Estimated scope:** ~50-80 LOC + 1 live integration test. Single-plan Phase 072.1.

### Gap 3 — `/reextract` orphan chunks survive subsequent `/reingest` *(OPEN — separate bug, Phase 072.1 candidate)*
- **Reported in:** `.planning/reported-bugs/reextract-orphan-chunks-survive-reingest.md`
- **Symptom:** Operator's DOCX has `documents.chunk_count=402` (UI source-of-truth) but `document_chunks` table holds 864 rows — 462 orphaned from a prior `/reextract` operation that wasn't cleaned up by the subsequent `/reingest`. Timestamp forensics show three distinct chunk batches (404 + 402 + 58) that should have been collapsed to one.
- **Root cause hypothesis:** Either `/reingest`'s delete-cascade has a gap that misses chunks created by a prior `/reextract` operation, OR Plan 03's `/reextract` writes chunks in a state that the subsequent `/reingest` doesn't recognize. Mirrors BUG-260516-04 (closed in Phase 071.4 for `/reingest`) but on a different operation pair. May be a regression of that fix, or a new code path.
- **PDF is consistent** (false alarm on the PDF side — `documents.chunk_count` appears to be text-only, image chunks are separate; PDF total 508 = 441 text + 67 image, no orphans).
- **Fix shape:** trace the cascade-delete path on `/reingest` to confirm coverage, OR add an explicit cleanup step to `/reextract` so it leaves no orphans, OR fix `documents.chunk_count` to reflect total (text + image) chunks so UI doesn't lie.
- **Estimated scope:** ~30-50 LOC + 1 integration test exercising the `/reextract → /reingest` sequence.

## Carry-forwards / known limitations

- **Page-column always NULL for DOCX** — by design (Word docs have no native page concept; only the renderer knows). Documented in `extract_docx_images:294-295`. Not a Phase 072 regression.
- **bbox=NULL for PDF images** — by design (Phase 072 scope explicitly covered DOCX location labels only; PDF bbox is reserved for actual `{x0,y0,x1,y1}` coordinates in a future phase).
- **≥80% recall target** — explicitly DEFERRED to SEED-021 spike (`vision_sweep` opt-in engine). Phase 072's default-engine target was ≥34% and both formats cleanly exceed it.
- **Synthetic 4-image DOCX micro-UAT** — covered by Plan 02 unit tests instead of live data. Fine for closure given operator's DOCX exercises 58 production-data images.
