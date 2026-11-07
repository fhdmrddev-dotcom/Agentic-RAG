---
phase: 303-word-template-bare-tokens
status: owed
written_by: 303-01 (D-03, D-12)
written: 2026-11-06
driven_by: Claude through the app at phase verification if the backend is up, else owed
---

# Phase 303 — Validation: the automated map, and the two live rows that are owed

The fill code is deterministic and runs in the sealed sandbox, so most of this phase is proven by
tests and by running the real driver script at the real docxtpl pin (`0.20.2`, the same pin as
`backend/Dockerfile.sandbox`). What a test cannot prove is a run **through the app**, with a run id.
Two rows cover that. Both are owed to verification. **Run U-1 first.**

## Automated validation map

| SC | What proves it | Where |
|---|---|---|
| SC#1 — the defect is reproduced through the real driver, before the fix | `test_303_bare_tokens.py::test_driver_script_docxtpl_bare_tokens_render_values` (runs `_RENDER_DRIVER_SRC` as `python -u render_driver.py docxtpl <tpl> <field_map.json> <out>`; observed RED at base, GREEN after); the discuss-time repro and its post-fix re-run | `evidence/red-base/` (base `6ca60a1f7`), `evidence/green/` (fix `af4b57eac`) |
| SC#2 — the value shows everywhere, or the run stops with a worded reason | `test_service_docxtpl_bare_tokens_render_values`, `test_whole_record_printed_is_not_delivered[driver/service]`, `test_bare_name_escapes_exactly_like_value[...]`, `test_run_replace_fills_spaced_tight_and_value_forms[...]`, `test_run_replace_fills_nested_table_and_header_variants[...]`, `test_residual_scan_reaches_nested_header_footer_and_first_page[...]`, `test_handler_names_record_text_in_failure_message` | `backend/tests/unit/test_303_bare_tokens.py` |
| SC#3 — `.value`, `|default` and `score` templates render byte-for-byte as before | golden base vs after: `RESULT: ALL IDENTICAL` over `word/document.xml` and every header/footer part, plus equal zip part-name sets (6 / 6); `test_value_default_if_forms_unchanged[driver/service]`; `test_run_replace_adds_no_header_footer_part[...]` | `evidence/golden/base`, `evidence/golden/after` |
| SC#4 — the two copies behave the same | `test_303_driver_service_parity.py` (`_replace_in_paragraph` on 8 token forms, `_cell`, the residual scan on a record in header / footer / first-page header / nested cell, `run_replace_docx` output, `_RECORD_TEXT_PREFIX`) | `backend/tests/unit/test_303_driver_service_parity.py` |

## UAT rows (D-03, D-12)

| # | Row | Steps | Expected | Evidence to capture | Result |
|---|---|---|---|---|---|
| U-1 | **A bare-token library template, through the app (SC#1) — run FIRST** | Build a .docx with bare `{{ name }}` in the body, the header and a nested table (use `evidence/red-base/repro.py`'s `build()`). Upload it as a library (trusted, docxtpl) template, bind it to a fill workflow, and run that workflow once through the app with any configured provider. Keep the run id. | The produced document shows the cited value in all three places and no `'source_chunk_id'` text anywhere. If the field map carried a whole record instead, the run reports `reason: residual_tokens` and the message says a field printed as raw record text and was not delivered. | the run id; the `workflow_runs` row and the render tool-result verdict JSON; the produced document's text read with python-docx (body, header, nested cell) | owed |
| U-2 | **A published template workflow, unchanged (SC#3)** | Re-run the golden run of one already-published template workflow (one of the pm-pack templates: compliance gap report, risk register or weekly status report) through the app. | The output document's text is identical to the last pre-303 run of that same workflow. | both run ids (the pre-303 run and the new one) and a text diff of the two documents | owed |

**I'd recognise failure here if:** a produced document contains `{'value':` text; a position where a
value belongs reads blank; a `.value` template's output changes.

**D-15:** no cross-provider scoreboard, and no G-2 / G-4 rows. This is not a UI, streaming, agent-loop
or provider-routing phase: the render is deterministic code in the sandbox, and the model's only part
is the field map, which this phase does not change.
