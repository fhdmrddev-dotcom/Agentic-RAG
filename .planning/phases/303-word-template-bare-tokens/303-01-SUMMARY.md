---
phase: 303-word-template-bare-tokens
plan: 01
subsystem: template-fill (sealed sandbox driver + in-app service)
tags: [backend, sandbox-driver, docx, template-fill, integrity-gate, bug-fix, no-db, tdd]
requires: []
provides:
  - "_CitedCell: a cited cell whose str() is its value, in both copies"
  - "run_replace key match for {{key}} / {{ key }} / {{ key.value }}, in both copies"
  - "nested-table and header/footer-variant reach for the run_replace walk and the docx residual scan"
  - "record-text residual hits (prefix 'record text: ') and a worded not-delivered clause"
  - "test_303_driver_service_parity.py: the D-10 pin between the driver copy and the service copy"
affects:
  - backend/app/services/tools/render_template.py
  - backend/app/services/template_render_service.py
tech-stack:
  added: []
  patterns:
    - "dict subclass with only __str__ to coerce bare Jinja output without changing item lookup, equality or escaping"
    - "per-key regex with re.escape + function replacement (literal backslashes)"
    - "is_linked_to_previous guard before touching optional header/footer variants (no part added on save)"
key-files:
  created:
    - backend/tests/unit/test_303_bare_tokens.py
    - backend/tests/unit/test_303_driver_service_parity.py
    - .planning/phases/303-word-template-bare-tokens/303-VALIDATION.md
    - .planning/phases/303-word-template-bare-tokens/evidence/golden/after/
    - .planning/phases/303-word-template-bare-tokens/evidence/green/
  modified:
    - backend/app/services/tools/render_template.py
    - backend/app/services/template_render_service.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "303-01: a bare {{ name }} is fixed by coercion (_CitedCell.__str__) AND detection (record-text residual hit); no __repr__/__html__ override so whole records stay detectable and escaping is unchanged"
  - "303-01: run_replace matches {{key}}, {{ key }}, {{ key.value }} by re.escape(key) with a function replacement; unknown placeholder tokens are still blanked"
  - "303-01: first-page / even-page header and footer are walked and scanned only when defined (is_linked_to_previous), keeping golden renders byte-identical with equal part sets"
  - "303-01: the G test for |default uses {{ name.nope|default(..) }} / {{ missing|default(..) }}; {{ missing.value|default(..) }} raises UndefinedError in Jinja at base, so the plan's form could not be a pass-at-base guard"
metrics:
  duration: "17 min (2026-11-06T03:18Z to 03:36Z)"
  completed: 2026-11-06
  tasks: 3
  files: 8
---

# Phase 303 Plan 01: Word template bare tokens Summary

A bare `{{ name }}` in a Word template now prints the cited value in body, headers, footers, cells, nested tables and loop rows, through both the sealed sandbox driver and the in-app service. The uploaded-template engine fills `{{ name }}`, `{{  name  }}` and `{{ name.value }}`, not only `{{name}}`, everywhere python-docx reaches, including nested tables and first-page / even-page headers and footers. If a whole cited record still ends up as text, the integrity check flags it as `record text: …` and the file is not delivered, with a sentence saying so. `.value`, `|default` and `score` templates render byte-for-byte as before, and a new parity test fails if the two copies drift.

## What was built

| Task | Commit | What |
|---|---|---|
| 1 RED | `44ae07a4b` | `test_303_bare_tokens.py` (both copies, including the real driver run as a script) and `test_303_driver_service_parity.py` (D-10), observed failing at base |
| 2 GREEN | `af4b57eac` | the fix in `render_template.py` (driver string + one handler clause) and `template_render_service.py`; ledger rows, detail sections and CLAUDE.md FIRING rows in the same commit |
| 3 evidence | `4881ab1f2` | `evidence/golden/after/`, `evidence/green/`, `303-VALIDATION.md` with U-1 / U-2 |

The four changes, made the same way in both copies:

1. **D-06 coercion.** `_cell` returns `_CitedCell(dict)` with `__slots__ = ()` and only `__str__` (the value, `""` for None). No repr, html, getattr or format hook. `_build_row`, `render_docx_template` and `SandboxedEnvironment(autoescape=True)` are unchanged.
2. **D-08 key match.** `_replace_in_paragraph` uses `re.compile(r"\{\{\s*" + re.escape(key) + r"(?:\.value)?\s*\}\}")` and `pat.sub(lambda _m, _v=value: _v, …)`. The `matched` / `touched` structure and both return shapes are kept.
3. **D-09 reach.** `run_replace_docx` gains a recursive `_walk_tables`, walks header/footer tables, and walks first-page / even-page variants only when `not hf.is_linked_to_previous`. The existing default header/footer paragraph walks are unchanged.
4. **D-07 + D-09 scan.** `_RECORD_TEXT_MARK = "'source_chunk_id':"`, `_RECORD_TEXT_PREFIX = "record text: "`, `_hits(texts, mark_records=False)` (prefix added after the 80-char cut), and `_docx_texts(doc)` (body, cells recursively, every defined header/footer variant). Only the docx arm sets `mark_records=True`. `assert_integrity` is unchanged.

Plus the handler clause in `_handle_render_template`: when `reason == "residual_tokens"` and a residual tag starts with the module-level `_RECORD_TEXT_PREFIX`, the message gains " A field printed as raw record text (a whole cited record instead of its value), so the file was not delivered."

## TDD: RED / GREEN split per test id

RED run against base source (`8226f8703`, no backend/app edit): **31 failed, 10 passed, 0 collection errors**. Every failure was an assertion failure for the expected reason (dict text in the document, `residual_clean: true`, blanked spaced tokens, surviving nested/header tokens, missing prefix).

**Failed at base (R):**
- `test_driver_script_docxtpl_bare_tokens_render_values`: dict text `Body: {'value': 'Ann', 'source_chunk_id': 'c1', …}`
- `test_service_docxtpl_bare_tokens_render_values`
- `test_whole_record_printed_is_not_delivered[driver]`, `[service]`: `residual_clean: True`, `residual_tags: []`
- `test_bare_name_escapes_exactly_like_value[driver]`, `[service]`: `{&#39;value&…` instead of `A &amp; &lt;b&gt;`
- `test_run_replace_fills_spaced_tight_and_value_forms[driver]`, `[service]`: `['A Ann', 'B ', 'C ', 'D ']`
- `test_run_replace_fills_nested_table_and_header_variants[driver]`, `[service]`: `Nested: {{name}}`, `HeaderCell: {{name}}`, first/even variants unfilled
- `test_run_replace_inserts_backslash_values_literally[driver]`, `[service]`: `['V: ']`
- `test_residual_scan_reaches_nested_header_footer_and_first_page[nested|header|footer|first_header × driver|service]` (8 ids): no hits
- `test_service_run_replace_reports_spaced_keys_as_replaced`: `replaced_keys: []`, `unmatched_keys: ['name']`
- `test_handler_names_record_text_in_failure_message`
- parity: `test_replace_in_paragraph_parity[spaced|wide|value|run-split-spaced|backslash]`, `test_cell_parity`, `test_residual_scan_parity`, `test_run_replace_docx_parity`, `test_record_text_prefix_parity`

**Passed at base (G, and token forms that already worked):**
- `test_value_default_if_forms_unchanged[driver]`, `[service]`
- `test_run_replace_still_blanks_unknown_tokens[driver]`, `[service]`
- `test_run_replace_adds_no_header_footer_part[driver]`, `[service]`
- `test_handler_plain_residual_message_has_no_record_clause`
- parity `test_replace_in_paragraph_parity[tight|unknown|run-split-tight]` (forms that work at base; recorded as G ids, not bent to fail)

Every R-marked parity function had at least one failing id.

**Base output part names** for the header-part guard (`arbitrary-split-token.docx` through run_replace at base, both copies): `[Content_Types].xml, _rels/.rels, customXml/_rels/item1.xml.rels, customXml/item1.xml, customXml/itemProps1.xml, docProps/app.xml, docProps/core.xml, docProps/thumbnail.jpeg, word/_rels/document.xml.rels, word/document.xml, word/fontTable.xml, word/footer1.xml, word/header1.xml, word/numbering.xml, word/settings.xml, word/styles.xml, word/stylesWithEffects.xml, word/theme/theme1.xml, word/webSettings.xml` (the template itself has no header/footer part; today's default access adds one of each).

GREEN: the eight targeted files (`test_303_bare_tokens.py`, `test_303_driver_service_parity.py`, `test_template_render.py`, `test_296_render_template.py`, `test_291_pdf_fill_driver.py`, `test_291_acroform_reader_parity.py`, `test_278_pure_move.py`, `test_190_ssti_fence.py`): **153 passed**.

No REFACTOR commit was needed.

## TDD Gate Compliance

`test(303-01)` RED commit `44ae07a4b` precedes `fix(303-01)` GREEN commit `af4b57eac`. The GREEN gate commit uses the `fix` type because this is a bug fix (FIX-15), as the plan names it.

## Golden gate (D-11)

Run after the fix with the backend directory as working directory (`Settings()` reads `backend/.env`):

```
pm-compliance {"rendered": true, "opened": true, "residual_clean": true, "residual_tags": [], "documented_limit": null, "rows": 4, "error": null}
pm-risk {"rendered": true, "opened": true, "residual_clean": true, "residual_tags": [], "documented_limit": null, "rows": 4, "error": null}
pm-weekly {"rendered": true, "opened": true, "residual_clean": true, "residual_tags": [], "documented_limit": null, "rows": 0, "error": null}
fixture-risk-score {"rendered": true, "opened": true, "residual_clean": true, "residual_tags": [], "documented_limit": null, "rows": 4, "error": null}
default-filter {"rendered": true, "opened": true, "residual_clean": true, "residual_tags": [], "documented_limit": null, "rows": 0, "error": null}
arbitrary-split {"rendered": true, "opened": true, "residual_clean": true, "residual_tags": [], "documented_limit": null, "rows": 0, "error": null}
arbitrary-split.docx         word/document.xml      IDENTICAL
arbitrary-split.docx         word/header1.xml       IDENTICAL
arbitrary-split.docx         word/footer1.xml       IDENTICAL
default-filter.docx          word/document.xml      IDENTICAL
fixture-risk-score.docx      word/document.xml      IDENTICAL
pm-compliance.docx           word/document.xml      IDENTICAL
pm-risk.docx                 word/document.xml      IDENTICAL
pm-weekly.docx               word/document.xml      IDENTICAL
RESULT: ALL IDENTICAL
arbitrary-split.docx PART-SET EQUAL 19
default-filter.docx PART-SET EQUAL 17
fixture-risk-score.docx PART-SET EQUAL 17
pm-compliance.docx PART-SET EQUAL 17
pm-risk.docx PART-SET EQUAL 17
pm-weekly.docx PART-SET EQUAL 17
PART SETS: ALL EQUAL
```

The sorted `*.docx` basename lists of `base/` and `after/` diff empty (6 files each).

## GREEN repro (D-01, evidence/green)

`repro.py` re-run at the fix commit (`GREEN_COMMIT.txt` = `af4b57eacccf9f5f2b9faa0d6e303704ff27421f`):

```
== docxtpl_bare verdict: {"rendered": true, "opened": true, "residual_clean": true, "residual_tags": [], ...}
    {"body": ["Body: Ann"], "header": ["Header: Ann"], "footer": ["Footer: Ann"], "cells": ["Cell: Ann\n", "NESTED>Nested: Ann", "Late vendor", ""]}
== run_replace_bare_spaced verdict: {"rendered": true, "opened": true, "residual_clean": true, ...}
    {"body": ["Body: Ann"], "header": ["Header: Ann"], "footer": ["Footer: Ann"], "cells": ["Cell: Ann\n", "NESTED>Nested: Ann"]}
```

`source_chunk_id` occurs 0 times, `NESTED>Nested: Ann` occurs in all 6 cases, and `residual_clean": true` occurs 6 times. The `docxtpl_value` and `docxtpl_default` lines are identical to `repro-output-base.txt`.

## Ledgers (D-13), re-derived after the commit

| File | Triple | Was |
|---|---|---|
| `backend/app/services/tools/render_template.py` | `7 / 4 / 1231` | `6 / 3 / 1163` |
| `backend/app/services/template_render_service.py` | `9 / 4 / 1064` | `8 / 3 / 988` |

Both scan-list rows and both detail sections in `docs/HOT-FILE-LEDGER.md` were updated, the CLAUDE.md FIRING row for `render_template.py` was updated, and a FIRING row for `template_render_service.py` was added. All of it is in the code commit `af4b57eac`. `check-claude-md-size.cjs` exits 0 (110,247 chars) and `check-hot-file-ledger.cjs` exits 0.

## Backend baseline (D-16)

Run once at the end, under the shared local-DB lock (taken with noclobber, then deleted): `node scripts/check-backend-unit-baseline.cjs` gave **70 failed, 12885 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 errors** (589 s). `[GATE PASSED] failed: 70 <= 71, errors: 0`. The 70 failures are in unrelated suites (for example `test_sql_service.py` and `test_streaming_reliability.py`), and none is in a template-fill suite.

## Seeds sweep

`node scripts/check-seeds-register.cjs --phase 303` matched the same 5 seeds measured at plan time, and none was folded or edited. SEED-368 (fill documents with no blanks) is a new capability outside this phase's scope. SEED-177, SEED-188 and SEED-198 match only through a broad `backend/app/**` or `backend/tests/**` glob. SEED-284 matches only `docs/HOT-FILE-LEDGER.md`. No other seed was named.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan] `{{ missing.value|default('N/A') }}` cannot be a pass-at-base guard**
- **Found during:** Task 1
- **Issue:** Jinja raises `UndefinedError: 'missing' is undefined` for an attribute of an undefined name, both at base and after. The plan's G test would have failed for a reason that has nothing to do with this phase.
- **Fix:** `test_value_default_if_forms_unchanged` tests the missing-key `|default` forms Jinja does support, `{{ name.nope|default('N/A') }}` and `{{ missing|default('N/A') }}` (both `N/A`), and adds a loop over `rows` for `.value` and `score`. The docstring says why.
- **Files:** `backend/tests/unit/test_303_bare_tokens.py`
- **Commit:** `44ae07a4b`

**2. [Rule 3 - Precision] The nested/header-variant run_replace test uses the tight `{{name}}`**
- **Found during:** Task 1
- **Issue:** with `{{ name }}`, the test would fail at base because of the spaced-key defect, so it could not show the walk-reach defect on its own.
- **Fix:** the test uses `{{name}}`, which base already matches. The spaced form is covered by `test_run_replace_fills_spaced_tight_and_value_forms`, and by the parity test's `run_replace_docx` case, which uses spaced tokens in body, nested cell and first-page header.
- **Commit:** `44ae07a4b`

**3. [Rule 3 - Blocking] golden.py must run from `backend/`**
- **Found during:** Task 2
- **Issue:** run from the repo root, importing `render_template` builds `Settings()`, which reads `backend/.env` relative to the working directory, and fails with missing `supabase_url`.
- **Fix:** golden.py and compare.py were run with `backend/` as the working directory. Neither script was edited.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema surface. T-303-01 through T-303-06 are mitigated as the plan says: `SandboxedEnvironment(autoescape=True)` count is unchanged in both files, `test_190_ssti_fence.py` passes, the escaping test pins `A &amp; &lt;b&gt;`, `re.escape` plus a function replacement handles backslashes, record text is not delivered, `select_engine` is unedited, and the golden renders are identical.

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_303_bare_tokens.py, backend/tests/unit/test_303_driver_service_parity.py, 303-VALIDATION.md, evidence/green/repro-output-green.txt, evidence/golden/after/*.docx (6)
- FOUND commits: 44ae07a4b (RED), af4b57eac (GREEN + ledgers), 4881ab1f2 (evidence)
- Scope fence: `git diff 6ca60a1f7 HEAD --name-only -- backend/app frontend supabase backend/Dockerfile.sandbox` lists only render_template.py and template_render_service.py
