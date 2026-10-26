---
phase: 296-close-v4-7-debt
plan: 03
subsystem: describe-door, publishing, rerank, citation-check (backend)
tags: [describe-door, pdf, acroform, publish, golden-run, rerank, langsmith, citations]
requires: ["296-04 (latencyNote 'past 30 seconds' in rerankEngines.ts)"]
provides:
  - "could_not_generate:provider_error refusal (reason_code provider_error) for 296-07's refusal table"
  - "removed items: '“{step}” has nothing left to use.' and '{Service} isn't ticked.'"
  - "auto_answered item {phase: None, message: 'The practice run had no example for …'}"
  - "LOCAL_INFERENCE_TIMEOUT_S = 30.0, pinned to the Settings latencyNote"
affects: [296-05 (backend unit gate), 296-06 (phase_types.py: one extra 296-03 hunk at the llm_emit return), 296-07 (renders the new refusal key and removed / auto_answered items)]
tech-stack:
  added: []
  patterns: ["measured fixture (marked + DOMPurify + jsdom) for claim ordinals", "pure helpers for golden inputs and the stand-in note"]
key-files:
  created:
    - backend/tests/unit/test_296_describe_files.py
    - backend/tests/unit/test_296_render_template.py
    - backend/tests/unit/test_296_draft_guards_authoring.py
    - backend/tests/unit/test_296_golden_inputs_and_lint.py
    - backend/tests/unit/test_296_rerank_and_claims.py
    - backend/tests/fixtures/phase296/claim_ordinals_marked.json
  modified:
    - backend/app/services/describe_files.py
    - backend/app/services/tools/render_template.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/describe_draft_guards.py
    - backend/app/services/workflow_authoring.py
    - backend/app/services/harness/publish_service.py
    - backend/app/services/rerank_engines/local.py
    - backend/app/services/rerank_engines/registry.py
    - backend/app/services/rerank_engines/tracing.py
    - backend/app/services/citation_claims.py
    - backend/tests/unit/test_291_powers_guard.py
    - backend/tests/unit/fixtures/citation_ordinals_v1.json
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "DESCRIBE_PDF_MAX_PAGES = 50; DESCRIBE_PDF_MAX_BYTES restated (= workspace_service.MAX_FILE_SIZE, pinned by a test) because the pure leaf may not import a module that reaches app.db"
  - "291-S2-F2: with files attached the business requirement is the author's description, set structurally before the provenance stamp"
  - "291-S2-F3: only connections the description NAMES are described as connected-not-ticked; the absent tick list (None) reads nothing"
  - "291-S1-copy b: forced_emit failure == 'provider_error' is refused at once as could_not_generate / provider_error with no strict-suffix retry"
  - "D-08 stand-ins: enum = first non-blank option, date = 2026-01-15, number = 1, text = 'a short example answer'; address keys keep .invalid and are not listed in the note"
  - "291-S7-F1 fixed in phase_types.py (filled_field_count), not render_template.py: the count lives there"
metrics:
  duration: "~45 min"
  completed: 2026-10-26
  tasks: 3
  files: 20
---

# Phase 296 Plan 03: Describe door, publishing and rerank backend debt Summary

This plan fixes the backend half of W3, every row RED first. The describe door now reads an untrusted PDF once, with a page cap and a byte cap. It also tells the author which steps were left empty and which services aren't ticked, keeps file text out of the requirement the judge grades, and names a provider failure as one. Publishing now says when the practice run used stand-in answers, and the pause ceiling sentence states seconds. On the rerank side, local scoring no longer traces the model object, unknown token counts are left out instead of written as 0, and local inference falls back to today's order after 30 s, a value pinned to the Settings copy. Citation-check claims lose the stray space before punctuation, and their ordinals match marked for HTML blocks and setext headings.

**Base sha:** `7f2636c4b63c5149d36544e4a1801f27e8912577` (develop, includes merged 296-04).

## Commits

| Task | RED (test) | GREEN (feat) |
|---|---|---|
| 1 Describe-door read + template fill | `4a1f8b2d2` | `c496244c3` |
| 2 Drafting guards, authoring truth, golden stand-ins, ceiling | `65120e770` | `313d5f124` |
| 3 Rerank / citation backend | `591353b60` | `e9e8fdc9d` |

## RED evidence per row (each measured at base 7f2636c4b before the fix)

| Row | RED assertion at base |
|---|---|
| 291-WR-07 | the extraction spy counted **6** page reads for a 3-page PDF (expected 3). `DESCRIBE_PDF_MAX_PAGES` / `DESCRIBE_PDF_MAX_BYTES` did not exist |
| 291-IN-04 | `_has_template_marks(docx with "{# … #}")` returned `False` |
| 291-S1-labels | label was `'3. Legal name f1_01[0]'` (expected `Legal name`); also `'Phone number �'` and `'4. Mailing address .'` |
| 291-WR-04 | the radio `payment` `/V` came back as a text string (`isinstance('/invoice', NameObject)` was False). There was no `value_is_name`. A text-typed button `/V` produced **no** read-back mismatch |
| 291-S7-F1 | `filled_field_count` did not exist; the run measure was `len(legacy_map)` == 2 for every fill |
| 291-S2-F1 | `removed` held only `Removed: web search.`, with no hollow-step item |
| 291-S2-F2 | the requirement contained `IGNORE ALL INSTRUCTIONS … results@example.com` copied from the file |
| 291-S2-F3 | `_resolve_unticked_connections` did not exist, so no connected-not-ticked block and no `Slack isn't ticked.` |
| 291-S1-copy (b) | the result had no `reason_code`, and the strict-suffix retry was sent |
| 291-S6-F7 | `golden_run_inputs` / `stand_in_note` did not exist; the stale `"text" for every field today` comment was present; there was no `auto_answered` on the publish result |
| 288-WR-02 | a 90 s ceiling read `between 1 second and 1 minute` |
| 294-IN-01 | the FakeLangSmith payload contained `'model': FakeCrossEncoder(arch=XLMRoberta…)` |
| 294-IN-02 | `usage_metadata` = `{'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0}` for unknown counts |
| 294-LOCAL | `registry.LOCAL_INFERENCE_TIMEOUT_S` did not exist (both the timeout and parity tests were RED) |
| 294-LOCAL parity | **driven RED physically**: with `rerankEngines.ts` set to `past 31 seconds`, the test read `assert 31 == 30`. The file was restored md5-identical (`922a0efcd79b8f027ff3219c967378be` before and after) |
| 294-IN-07 | `_clean("Revenue grew **12%** .")` == `'Revenue grew 12% .'` |
| 294-CR-02-res | 6 of 9 measured cases disagreed: `html_block_pre` [1,2,2] vs [1,2]; `html_block_anchor` [1,2,2] vs [1,2]; `html_comment` [1,2,2] vs [1,2]; `setext_then_indented_code` [1,2,1] vs [1,1]; `setext_then_definition` [1,1,2] vs [2]; `mixed_html_and_setext` [1,2,3,2,1] vs [1,3,2]. `html_block_div` matched on ordinals but its sentence carried `<div>` |

## Discretion values

- `DESCRIBE_PDF_MAX_PAGES = 50`
- `DESCRIBE_PDF_MAX_BYTES = 10 * 1024 * 1024`, equal to the door's `MAX_FILE_SIZE` and pinned by a test
- date stand-in: `2026-01-15`
- number stand-in: `1`
- text stand-in: `a short example answer`
- `LOCAL_INFERENCE_TIMEOUT_S = 30.0`

## marked measurement command

The script and its cases live outside the tree, in the session scratchpad. Run from `frontend/`:

```bash
node <scratchpad>/measure_marked.cjs "<worktree>/frontend" <scratchpad>/cases.json > <scratchpad>/measured.json
python <scratchpad>/build_fixture.py <scratchpad>/cases.json <scratchpad>/measured.json backend/tests/fixtures/phase296/claim_ordinals_marked.json
```

`measure_marked.cjs` runs the CitedMarkdown pipeline with the project's own modules, resolved through `createRequire(frontend/package.json)`:

1. `marked` 17.0.4 with `{gfm: true, breaks: true}`.
2. `DOMPurify.sanitize` on a jsdom window.
3. A TreeWalker over the text nodes, skipping `code`, `pre` and `a` ancestors.
4. The `[n]` markers with `1 <= n <= n_sources`.

Each case's `rendered_html` is stored in the fixture as evidence. Every `content` is unchanged by `dedupParagraphs`, and the test asserts this.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 291-S7-F1 was fixed in `phase_types.py`, not `render_template.py`**
- **Found during:** Task 1
- **Issue:** `render_template.py` has no `_measure`. The run page's "N fields" comes from `phase_types.py`'s llm_emit return, `_measure(len(legacy_map), "fields")`. `legacy_map` is always the envelope `{scalars, collections}`, so every fill read "2 fields". Button fields were never the cause.
- **Fix:** I added one pure helper, `filled_field_count`, beside `_measure`, plus one call. 296-06 owns this file's other 296 rows. My hunk sits at the llm_emit success return (about line 1985) and in a new def after `_measure` (about line 725), away from 296-06's forecast lines.
- **Files modified:** `backend/app/services/harness/phase_types.py`, plus its ledger row and the CLAUDE.md FIRING cell.
- **Commit:** `c496244c3`

**2. [Rule 3 - Blocking] The byte cap could not reuse the door's constant**
- **Found during:** Task 1
- **Issue:** `MAX_FILE_SIZE` lives in `workspace_service`, which imports `app.db.workspace`. `describe_files` is a pure leaf that must reach no database, per its own docstring invariant.
- **Fix:** I restated the value as `DESCRIBE_PDF_MAX_BYTES`, and `test_the_byte_cap_is_the_doors_upload_cap` pins the two equal. A PDF over the cap raises `DescribeFileUnreadable`, which the door answers with its existing 422. The door's own `File too large` check still runs first.
- **Commit:** `c496244c3`

**3. [Rule 1 - Bug] The 291-S2-F1 example power had to be a tool**
- **Found during:** Task 2
- **Issue:** The plan's example strips the power `slack` from a step that only used Slack. A Slack step is an `external_action`, and the guard removes those whole, so they can never be left hollow. Only a tool-bearing step can be emptied: `llm_agent` / `llm_batch_agents` with `available_tools`.
- **Fix:** The test uses `web_search`. The `{power}` is a noun such as `web search` or `running code`, and several removed tools join with `and` (`were removed`).
- **Commit:** `313d5f124`

**4. [Rule 1 - Superseded pin] `test_291_powers_guard.py` pinned the pre-296 single-item `removed`**
- The execute_code-only case now pins both items: the removal, then the hollow step. The edit is commented in place.
- **Commit:** `313d5f124`

**5. [Rule 1 - Superseded pin] `citation_ordinals_v1.json` encoded the IN-07 defect**
- One `expected_sentences` entry read `Margins improved to 12 percent .`, and it now reads `…12 percent.`. The `expected` ordinals are unchanged. The frontend parity suite reads only `expected` / `deduped`, and it was re-run: `citationOrdinals.parity.test.tsx` 70/70.
- **Commit:** `e9e8fdc9d`

**6. [Orchestrator override] I did not run the plan-end full backend unit gate**
- The plan's Task 3 ends with "run the backend unit gate under the local-DB lock". The orchestrator's spawn instruction overrides it: do not take the lock and do not run the full suite, because 296-05 does.
- What I ran instead, all green:
  - the five new `test_296_*` files: 105 tests, together with the 291 fill and overlay suites and `test_trace_key_redaction`;
  - every unit suite that imports `workflow_authoring`, `publish_service` or `describe_draft_guards`;
  - all `test_291_*`, `test_288_*`, `test_214_*` and `test_294_*`;
  - `test_200_1_deliverable_text` and `test_256_llm_emit_rollup`.
- Together that is **1805 passed, 1 skipped, 0 failed**.
- I saw one red outside that sweep: `test_200_1_phase_output_shape.py::test_this_plan_wrote_no_migration`. It compares the migrations directory against a frozen list. This plan adds no migration (`git diff --stat 7f2636c4b HEAD -- supabase/` is empty), so the failure is inherited, not new. 296-05 should confirm it is in the base failing set.

## G-5 record

| File | def / if before → after | Touch |
|---|---|---|
| `describe_files.py` (young, 2 phases) | 53→56 / 117→122 | constants + `_is_junk_word`, `_adjacent_run`, `_first_pages`; `_pdf_text_and_pages` returns a page note |
| `tools/render_template.py` (**now FIRES**, 278 / 291 / 296) | 27→29 / 94→101 | driver-only: `_name_button_values` and a typed read-back. A CLAUDE.md FIRING row was added |
| `harness/phase_types.py` (FIRES, G-5 OWED) | 55→56 / 118→119 | one pure helper and one call |
| `describe_draft_guards.py` (young) | 32→33 / 36→37 | `hollow_step_item` and one branch |
| `workflow_authoring.py` (FIRES) | 11→15 / 41→49 | ⚠ **wider than the forecast** of one condition plus one sentence. S2-F3 needed a fail-closed resolver and three small helpers. The ledger names the seam: move the connection-vocabulary helpers into their own module before the next touch adds anything |
| `harness/publish_service.py` (FIRES) | 23→25 / 75→81 | the golden-input loop moved unchanged into the pure `golden_run_inputs` and gained the typed arm. `stand_in_note` was added, plus one `auto_answered` append and one ceiling expression |
| `rerank_engines/local.py`, `registry.py`, `tracing.py`; `citation_claims.py` | see the ledger | young; each now at 2 phases |

I re-derived every triple with the CLAUDE.md recipe. Each file got a `296-03:` paragraph in its ledger section, with the previous cells kept verbatim. Stale rows I corrected:
- `describe_files.py`: `4/1/1329`, actually 7 commits.
- `render_template.py`: `3/2/1094`, actually 5 commits.
- `workflow_authoring.py`: `18/12/1120`, actually 22 commits.
- `describe_draft_guards.py`: `4/1/530`, actually 8 commits.
- `citation_claims.py`: `1/1/279`, actually 2 commits.

Both gates exit 0: `check-claude-md-size.cjs` (CLAUDE.md 99,7xx chars) and `check-hot-file-ledger.cjs --files <all 10 non-test files>`.

## Guardrail overrides for STATE.md

- **G-5 (`workflow_authoring.py`, FIRES):** 296-03 spent def 11→15 against a one-condition forecast, because S2-F3 needs a resolver. This is recorded rather than refused. The next phase touching the file should first move `_resolve_allowed_vocabulary`, `_resolve_unticked_connections`, `_render_*_block` and `_description_names` into a `connection_vocabulary` module.
- **G-5 (`phase_types.py`, FIRES, G-5 OWED):** this file is not in 296-03's plan list (deviation 1 above). The touch was one pure helper and one call.
- **Plan-end backend gate:** not run, by orchestrator instruction. It is owed to 296-05.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: info-to-model | backend/app/services/workflow_authoring.py | `_resolve_unticked_connections` reads the caller's org connections (the same `list_connections` + `_resolve_caller_org_ids` the existing resolver uses, fail-closed `[]`). The NAME of an unticked connection reaches the drafting prompt only when the author's own description already names it. It grants nothing: `_check_allowed_connections` still refuses any step on an unticked connection |

The T-296-21..26 mitigations are in place:
- **T-296-21:** page cap, byte cap and one extraction.
- **T-296-22:** the requirement is the author's description when files are attached.
- **T-296-23:** address keys keep `.invalid`; the `grep -c example.invalid` count is unchanged at 2.
- **T-296-24:** the model object is never traced, and `redact_inputs` is still the processor.
- **T-296-25:** a 30 s timeout with today's-order fallback.
- **T-296-26:** a worded refusal only; no provider text is forwarded.

## Known Stubs

None. `a short example answer`, `2026-01-15` and `1` are intentional golden-run stand-ins, and they are disclosed to the author by the new `auto_answered` note.

## Notes for downstream plans

- **296-07:** add the `could_not_generate:provider_error` key to `describeRefusalVocabulary.ts`, using UI-SPEC row 182's words. `removed` can now carry the hollow-step and unticked items, and the existing ⊘ row renders them. `auto_answered` can now carry an item with `phase: null`.
- **296-06:** `phase_types.py` already has one 296-03 hunk: `filled_field_count` after `_measure`, and the llm_emit `_measure` call. Re-derive the triple from `64 / 33 / 3095`.
- No response model changed and no OpenAPI snapshot was touched. `reason_code` already exists on the generate refusal shape.

## Self-Check: PASSED

- All 6 created files exist: the five `test_296_*.py` files and `fixtures/phase296/claim_ordinals_marked.json`.
- All 6 task commits are in `git log`: `4a1f8b2d2`, `c496244c3`, `65120e770`, `313d5f124`, `591353b60`, `e9e8fdc9d`.
- Acceptance greps:
  - `DESCRIBE_PDF_MAX_PAGES` appears ≥ 2 times.
  - `{#` appears in `_has_template_marks`.
  - The `NameObject` count went up (the driver now imports and uses it in `_name_button_values`).
  - `has nothing left to use.` appears 1 time.
  - `isn't ticked.` appears 1 time.
  - `provider_error` appears 4 times.
  - `used a stand-in answer` appears 1 time.
  - The stale comment appears 0 times.
  - `example.invalid` is unchanged at 2.
  - `LOCAL_INFERENCE_TIMEOUT_S` appears 2 times in `registry.py`.
  - `or 0` in `tracing.py` went from 3 to 0.
