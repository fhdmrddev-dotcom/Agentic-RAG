---
phase: 217-the-library-one-home-for-documents
plan: 02
subsystem: backend-api
tags: [library, documents, kb, rls, paging, LIB-04, fastapi]

# Dependency graph
requires:
  - phase: 217-01
    provides: "`DocumentChunkRow` / `DocumentTableRow` / `DocumentImageRow` / `DocumentContentResponse` in `app/models/document.py`"
  - "backend/app/api/kb.py — `read_path`, the shipped owner→global-folder two-step + line slicer"
  - "backend/app/utils/db.py — `aexec` (D-v2.5-01)"
  - "supabase/migrations/108_rls_membership_rewrite.sql:180-189 and 110_secdef_org_scope_audit.sql:215-223 — the RLS policies the routes inherit"
provides:
  - "GET /documents/{id}/content — the parsed text, line-range sliced, UNNUMBERED, 200 on empty"
  - "GET /documents/{id}/chunks — chunks with their per-chunk embedding lineage (D-217-08)"
  - "GET /documents/{id}/tables — extracted tables as headers + rows"
  - "GET /documents/{id}/images — image DESCRIPTIONS (the table stores no bytes)"
  - "`read_path(..., numbered: bool = True)` — ONE slicer, TWO callers (D-217-05)"
  - "`read_path` error returns carry `error_kind` (`not_found` / `empty` / `range`) + `total_lines`"
  - "`_assert_document_visible` — the shared 404-before-read gate for all four routes"
  - "`CONTENT_PAGE_LINES` = 500 / `CONTENT_MAX_LINES` = 2000 — the measured paging bound"
affects:
  - "217-05 / 217-07 — the five detail-panel sections consume these four routes"
  - "GET /kb/read — byte-identical by construction; guarded by a case in the new suite"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a shared private visibility helper as the ONE 404 gate for a family of sibling routes"
    - "an additive `error_kind` discriminator on an existing dict-returning helper, so a second caller can split error arms the first caller deliberately folds together"
    - "a test double that resolves per (table, select) — the shared conftest builder returns ONE result and cannot express a route that reads the same table three ways"

key-files:
  created:
    - backend/tests/test_217_document_detail_routes.py
  modified:
    - backend/app/api/documents.py
    - backend/app/api/kb.py

key-decisions:
  - "`/content` calls `read_path` for the slice (D-217-05 literally), and `read_path` gained an additive `error_kind` rather than `/content` sniffing error strings"
  - "A page that starts PAST the end is a 200 with the honest `total_lines`, not a 404 and not `total_lines=0`"
  - "`CONTENT_MAX_LINES` caps an EXPLICIT span, not only the default — otherwise T-217-07's 'a caller cannot request an unbounded body' is false"
  - "The plan's task-2 fence regex was corrected, not weakened: it scanned the whole file where `b64` is shipped code since Phase 036"

patterns-established:
  - "Both halves of a two-caller invariant live in the SAME suite, so an edit cannot satisfy one by breaking the other — proven by a driven RED that reddened exactly one of the two"
  - "A source fence is scoped to the region the plan authored, plus a whole-file COUNT comparison against the base blob, so pre-existing debt neither breaks the fence nor hides inside it"

requirements-completed: [LIB-04]

# Metrics
metrics:
  duration: "~50 min"
  completed: "2026-08-29"
  tasks: 3
  commits: 3
  files_created: 1
  files_modified: 2
---

# Phase 217 Plan 02: The four buried facts, put on the wire — Summary

**The parsed text, the chunks, the tables and the image descriptions have been in Postgres since migration 002 and no route read any of them; four `GET`s now do — all user-JWT, all threadpooled, all 404-before-read — and `read_path` became one slicer with two callers instead of two slicers.**

## The measured paging bound (the plan's required numbers)

Run against the live local DB via `psycopg2` on `127.0.0.1:54322`, 2026-08-29:

```sql
SELECT max(length(full_markdown)),
       max(array_length(string_to_array(full_markdown, chr(10)), 1)) FROM documents;
```

| | value |
|---|---|
| documents | 64 (61 with non-null text) |
| **max chars in one document** | **266,773** (`FMrad_FT_Approved_06062026.docx`) |
| **max lines in one document** | **6,402** (`KDP_PRINT_BOOK_PUBLISHER_INTERIOR.pdf`) |
| mean | 14,684 chars / **201 lines** |

**Chosen from those numbers, not from a round one:**

- `CONTENT_PAGE_LINES = 500` — the default page when `end_line` is omitted. The **mean** document (201 lines) arrives whole in one request, so paging is invisible for the common case; the worst case needs 13 pages.
- `CONTENT_MAX_LINES = 2000` — a hard cap on any **explicitly requested** span. The worst case needs 4 requests.

⚠ **The cap on the explicit span is the load-bearing half, and the plan did not ask for it.** Without it, `?start_line=1&end_line=999999` returns the whole document and T-217-07's mitigation — *"a caller cannot request an unbounded body without paging"* — is simply false. The truncation is honest rather than silent: `end_line` in the envelope reports what was actually served and `has_more` is `True`.

Also worth carrying forward: **`read_path` has never sliced at the DB.** It fetches `full_markdown` entirely and slices in Python, both before and after this plan. So paging bounds the *response body*, not the read. Slicing server-side would be a different change.

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | One `numbered` flag on kb.py's slicer, and `GET /{id}/content` | `17bf26894` | `app/api/kb.py`, `app/api/documents.py` |
| 2 | `/chunks`, `/tables`, `/images` — one shared visibility helper, three list routes | `4710bf8c8` | `app/api/documents.py` |
| 3 | The route suite — including the shared-folder case asserted as CORRECT | `1a13312c2` | `tests/test_217_document_detail_routes.py` |

## What shipped

### `read_path` — one slicer, two callers (D-217-05), and one addition the plan did not name

`numbered: bool = True` gates the `f"{start_line + i}: {line}"` prefixing. The default keeps `GET /kb/read` byte-identical: an **agent** needs addressable lines to cite and re-read; a **person** reading their own document must not get `42: ` glued to every line, and Markdown breaks outright.

⚠ The local variable at the old `kb.py:446` was itself named `numbered` — the parameter would have shadowed it. It is now `body`, and the prefixing sits under an explicit `if numbered:` / `else:`.

**The addition:** `read_path`'s three error returns now carry `error_kind` (`"not_found"` / `"empty"` / `"range"`), plus `filename` and `total_lines` where known. This was not in the plan and is the one design call worth defending:

- `/content` must tell *"you cannot see this document"* (404) from *"this document has no text"* (200 + `content=""`) from *"that page starts past the end"* (200 + the **real** `total_lines`). `read_path` folded all three into an `{"error": str}` dict.
- The alternative was **sniffing the error strings** in `documents.py` — fragile, and it still could not recover `total_lines` for the range arm without a second full read.
- It is purely **additive**: `/kb/read` reads only `result["error"]` and raises 404, and `ReadResponse(**result)` is only constructed on the success path. `50 passed` on the `-k kb` arm confirms it.

### `_assert_document_visible` — one gate, four routes

Copies `list_document_versions`' parent-check shape and the shipped `detail="Document not found"` string, but **not** its bare `.execute()`. It applies the owner-**OR**-globally-visible-folder rule that `list_documents` uses, so the detail panel cannot 404 a document the list just rendered.

### The RLS asymmetry, encoded rather than discovered

The comment above `/tables` and `/images` names both migrations verbatim, and a test pins the behaviour as **correct**:

| table | SELECT predicate | source |
|---|---|---|
| `document_chunks` | owner **OR** globally-visible folder | `110_secdef_org_scope_audit.sql:215-223` (PRAG-01 / D-164-07) |
| `document_tables` | **owner-only**, one `FOR ALL` policy, no folder branch | `108_rls_membership_rewrite.sql:186-189` |
| `document_images` | **owner-only**, same shape | `108_rls_membership_rewrite.sql:180-183` |

So a document reachable only through **someone else's** globally-visible folder returns text and chunks and an **empty list** of tables and images. The panel does not lie about it — `list_documents`' `table_count` / `image_count` aggregate runs through the same user-JWT client, so the row's badge already reads `0`. Widening those two policies is a migration and a security decision, explicitly out of this phase.

## Verification

| Check | Result |
|---|---|
| Task 1 automated gate (plan's, verbatim) | `task 1 source gate OK` |
| Task 2 automated gate (corrected — see deviation 1) | `OK — helper occurrences: 5 · fenced tokens 14 (unchanged) · bare .execute() 76 (unchanged)` |
| `pytest tests/test_217_document_detail_routes.py -q` | **22 passed** (plan asks ≥ 12) |
| `pytest tests/test_217_document_detail_routes.py tests/test_217_document_response_fields.py -q` | **31 passed** |
| `python -c "import app.main"` | `main OK` — the new `from app.api.kb import read_path` forms no cycle |
| `pytest tests/ -q -k "kb"` | **50 passed**, 5262 deselected |

### The `-k kb` non-vacuity arm, re-derived

The plan records **49 selected / 5223 deselected of 5272** and says to re-derive rather than trust it. Measured now with `--collect-only`: **`50/5312 tests collected (5262 deselected)`**. The `+1` is this plan's own `test_kb_read_still_numbers_lines` (the name matches `-k kb`); the `+40` in the denominator is the rest of wave 1 plus this plan. **The arm collects, so it is evidence.**

### Backend baseline — MEASURED at this base, not inherited

⚠ **Wave 1 recorded `68 failed / 3110 passed` and this plan measures `67 / 3111`. That delta is NOT caused by this plan, and it was proven rather than assumed.**

| | `pytest tests/unit -q` |
|---|---|
| With all three tasks applied (run 1) | `67 failed, 3111 passed, 2 xfailed, 2 xpassed` in 180s |
| With all three tasks applied (run 2) | `67 failed` — deterministic |
| **`documents.py` + `kb.py` reverted to base `1c6c4c905`, everything else intact** | **`67 failed`** |
| `diff before.txt after.txt` over the sorted `FAILED` lines | **IDENTICAL FAILING SETS** |

So the base at **this** commit (`1c6c4c905`, the post-wave-1 merge) is 67, while wave 1 measured 68 at **its** base (`9a3808697`). One of wave 1's own plans closed a failure between the two commits. **This plan moves nothing** — same count, same set, name for name. The revert was per-file (`git checkout <sha> -- app/api/documents.py app/api/kb.py`) and reversed with `git checkout HEAD -- …`; `git status` is clean and the suite is green afterwards.

### ⚠ The RED control was DRIVEN, not described

The plan asks that `/content`-is-unnumbered and `/kb/read`-still-numbers live in the same file "so a future edit cannot satisfy one by breaking the other". That claim was **executed**: `read_path`'s default was flipped to `numbered: bool = False` and the suite re-run.

```
FAILED tests/test_217_document_detail_routes.py::test_kb_read_still_numbers_lines
1 failed, 21 passed
```

**Exactly one case reddened, and it was the agent arm** — `test_content_200_returns_unnumbered_text` stayed green, because breaking the agent path does not break the human path. That is the property the two-arm design claims, measured rather than asserted. `kb.py` was restored from a backup and `git diff` is empty.

The task-2 image-bytes fence was **also** driven: `thumbnail` was planted into the `/images` select, and **both** arms fired (`REGION FENCE FIRED`, `COUNT FENCE FIRED: 14 -> 15`) before the file was restored to a byte-identical state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] The task-2 verify gate was unsatisfiable against the shipped file**

- **Found during:** Task 2
- **Issue:** The plan's arm asserts `not re.search(r'image_data|b64|thumbnail', d)` over **all of `documents.py`**, but the acceptance criterion it encodes is *"returns nothing **new**"*. `documents.py` has carried `b64` / `b64_png` / `_downscale_b64_for_vision` in the `_reingest_images` path since Phase 036/072 (10 lines, 14 occurrences at the base commit). No correct implementation could ever satisfy the arm as written.
- **Fix:** The check was **corrected to its intent, not weakened** — and made stronger:
  1. the tokens must be absent from the **region this plan authored** (extracted between the `# ── Phase 217 · LIB-04` marker and the `/restore` decorator);
  2. the **whole-file occurrence count must equal the base blob's** — `14 → 14`;
  3. plus the same two-way treatment for `.execute()` — `76 → 76`, and none inside the region;
  4. plus a non-vacuity control asserting the region is > 2000 chars and contains all four route decorators.
- **Verification:** all four arms driven RED against a planted `thumbnail` in the `/images` select; file restored byte-identical. The corresponding suite cases are `test_new_route_region_extracts_non_vacuously` and `test_no_blocking_query_inside_the_four_new_routes`.

**2. [Rule 1 — Bug] My own comment diluted the fence it was explaining**

- **Found during:** Task 2
- **Issue:** The header comment read *"the two nearest neighbours above call `.execute()` bare"*. That literal pushed the file-wide count `76 → 77`, so a **correct comment failed the check that exists to catch the thing it warns about**. This is the identical collision `217-01` recorded (its deviation 2), one fence over.
- **Fix:** Reworded to *"run the sync builder bare"*, with an explicit note in the comment saying **why** the literal is not written there. The fence itself was not weakened.
- **Verification:** `bare .execute() 76 (unchanged)`.

**3. [Rule 3 — Blocking] Worktree forked from the wrong base — again**

- **Found during:** startup, before Task 1
- **Issue:** `git merge-base HEAD 1c6c4c905` returned `f7cfa4a53`; the worktree was created off the v3.8 `master` merge, not the dispatched wave-1 tip.
- **Fix:** `git reset --hard 1c6c4c90595666e3b942d4da8ad5437cd4be938a` per the branch-check protocol, on `worktree-agent-a0d5a5942eb095f92` (in-namespace, never a protected ref). Verified: HEAD reads `docs(phase-217): update tracking after wave 1` and `backend/app/api/document_queries.py` exists.
- **Note:** the dispatch brief PREDICTED this ("expect the reset to be needed"), and `217-01` recorded the same fault. **Three for three** — it is the standing behaviour, not an incident.

### Design divergences (recorded, not auto-fixes)

**A. `read_path` gained `error_kind` — additive, and the plan named only `numbered`.** Reasoned above. Without it `/content` would have to parse English error strings to tell three different outcomes apart, and could not recover `total_lines` for the out-of-range arm without a second full read of a document up to 266 KB.

**B. `CONTENT_MAX_LINES` — a cap on an EXPLICIT span, which the plan did not specify.** T-217-07 is a `mitigate` disposition and its stated claim is *"a caller cannot request an unbounded body without paging"*. Defaulting `end_line` alone does not make that claim true. This is Rule 2 (a threat-register mitigation is a correctness requirement, not a feature).

**C. `_assert_document_visible` swallows an exception from the parent lookup and treats it as invisible.** This mirrors `read_path`'s shipped `try/except` around the identical two-step. It **fails closed** (a broken lookup answers 404, never an empty 200), and it is logged at DEBUG rather than silently discarded. The alternative — matching `list_document_versions`, which does not guard — turns a transient DB error into a 500.

**D. The test file installs its own supabase double instead of using `mock_builder`.** `conftest`'s shared builder returns ONE `execute_result` for every query, and these routes read the **same** `documents` table up to three times per request with different `select` lists (the visibility gate, then `read_path`'s owner arm, then its global-folder arm). A single-result mock cannot express that, so the file resolves payloads per `(table, select, filters)` and overrides `get_supabase` — which `conftest`'s `_user_supabase_override` mirrors onto the user-JWT dep automatically. **Nothing in the shared `conftest.py` was edited**, per the wave-1 hand-off note.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug) + 4 recorded design divergences
**Impact on plan:** No scope creep. Four routes, one parameter, one helper, one suite — exactly the plan's surface. No migration, no policy change, no package installed.

## Issues Encountered

**The three-way split of `read_path`'s single error channel is the subtle part of this plan, and it is easy to get quietly wrong.** The natural implementation — call `read_path`, and on any error return `200` with `total_lines=0` — passes every acceptance criterion the plan lists and is **wrong for one case**: a client that asks for a page past the end would be told the document has no text at all, and would render an empty document rather than correcting its offset. `test_content_page_past_the_end_is_200_with_honest_total` is the case that separates the two implementations; it is the only reason `error_kind` carries `total_lines`.

## Known Stubs

None. All four routes read real tables and return real rows; nothing returns a hardcoded empty value.

## Threat Flags

None beyond the plan's own register. The four routes are new **network endpoints**, which is exactly what `<threat_model>` scopes:

- **T-217-04 / T-217-05** — mitigated: `Depends(get_user_supabase_client)` so RLS applies, **plus** `_assert_document_visible` filtering on `current_user["id"]` in app code, **plus** 404-never-empty-200 asserted on all four routes. Pinned from the client's own call log (`test_visibility_gate_filters_on_the_caller_id`), positionally, so the owner filter cannot be demoted.
- **T-217-06** — accepted and pinned as correct (the shared-folder case).
- **T-217-07** — mitigated, with the cap on explicit spans added (divergence B) and the worst case measured.
- **T-217-08** — mitigated and fenced two ways (region + whole-file count), both driven RED.
- **T-217-09** — no string interpolation into SQL anywhere in the four routes; every filter is `.eq()` / `.in_()`. No `.or_()` was needed, so `coerce_uid` has no call site here.
- **T-217-SC** — inapplicable by measurement: no `requirements.txt`, npm or sandbox-tag change in this plan's diff.

## Next Phase Readiness

**Ready for plans 05 / 07 (the detail-panel sections).** Carry-forward:

1. **`/tables` and `/images` legitimately return `[]` for a shared-folder document.** The empty-arm copy must be *"No tables"* — never *"You cannot see these"* — because the count badge on the same row already reads `0` and the two must agree.
2. **`has_more` is on the envelope; do not re-derive it.** `end_line` reports what was actually served, which is **not** always what was asked for (the cap truncates silently-but-honestly).
3. **An empty document is `200` with `content: ""` and `total_lines: 0`.** The section renders its own empty arm; a 404 handler will never fire for it.
4. **`embedding_model` varies PER CHUNK** mid-re-embed (D-217-08). A section that reads the first chunk's model and labels the document with it will be wrong exactly when the fact is interesting.
5. ⚠ **M-1 stays owed.** This is the backend half; no page has loaded against these routes.

---
*Phase: 217-the-library-one-home-for-documents*
*Plan: 02*
*Completed: 2026-08-29*
