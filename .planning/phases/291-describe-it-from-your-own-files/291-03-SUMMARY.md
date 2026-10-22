---
phase: 291-describe-it-from-your-own-files
plan: 03
subsystem: workflow-run / template fill
tags: [render-template, pdf, acroform, fill-back, sandbox]
requires:
  - "291-01: describe_files.read_acroform_fields / acroform_oracle"
provides:
  - "render_template acroform engine: a fillable PDF filled by field name in the sealed sandbox, validated, XFA-stripped, read back"
  - "harness/form_inputs.overlay_user_inputs: the person's launch answers reach the fill with server-minted input:<key> citations"
  - "_template_oracle .pdf arm (the form's own field names reach the forced emit and the gate)"
affects:
  - "291-04 / 291-05 (UAT S6/S7: the filled form comes back with the asked fields written)"
tech-stack:
  added: []
  patterns:
    - "answers validated against the field's OWN states/options; refused in words, field left blank, run continues"
    - "write then read back (/V, and /AS on every button widget) before delivery"
    - "server-minted citation ids for person-supplied values; KB citations unchanged"
key-files:
  created:
    - backend/app/services/harness/form_inputs.py
    - backend/tests/unit/test_291_pdf_fill_driver.py
    - backend/tests/unit/test_291_acroform_reader_parity.py
    - backend/tests/unit/test_291_form_inputs_overlay.py
  modified:
    - backend/app/services/tools/render_template.py
    - backend/app/services/harness/phase_types.py
    - backend/tests/unit/test_278_pure_move.py
decisions:
  - "A refused PDF answer is a documented blank: residual_tags lists the refused field names, residual_clean stays True, documented_limit carries the sentences (golden-run safe)"
  - "The fill result reaches residual_tags_in/assert_integrity through an in-process dict keyed by out_path (_FILL_RESULTS), never a sidecar file in /sandbox/output (execute_code harvests that directory)"
  - "A .pdf template's output name is forced to .pdf whatever the model asked for (the fmt and the mime follow the file)"
  - "A PDF with no fillable fields fails in words instead of being handed back blank as 'filled'"
  - "The overlay call sits after placeholder_keys and before check_coverage, inside the retry loop (idempotent union)"
metrics:
  duration: "~1h40m (incl. one full backend gate at head and one at base)"
  completed: 2026-10-22
  tasks: 2
  files: 7
---

# Phase 291 Plan 03: Fill the form back Summary

A run bound to a fillable PDF now returns that same PDF filled. Inside the existing `render_template` emitter, a new `acroform` engine in the sealed driver writes each answer into its own AcroForm field by name with pypdf. Answers are checked against the field's own states and options first: one that matches none is refused in words, its field stays blank, and the run goes on. Then every written value is read back. The person's own launch answers now reach the fill too, because a pure overlay leaf writes each one with a server-minted `input:<key>` citation that both citation gates accept.

## What was built

**Task 1: the acroform engine (render_template.py).**
- Inside `_RENDER_DRIVER_SRC`:
  - `_read_acroform` is an inlined copy of `describe_files.read_acroform_fields`, because the sandbox cannot import the backend package. It also returns `/V` and every widget's `/AS`.
  - `_match_choice` trims and casefolds the answer and returns the field's own spelling. That handles `" de "` → `DE` and `Invoice` → `/invoice`.
  - Checkbox truthy words (`yes y true x checked on 1`) select the first non-`/Off` state, so `/1` on a W-9-shaped box works. Falsy words (`no n false unchecked off 0` and the empty string) select `/Off`. The on-state's own name also checks the box. Any other value is refused.
  - `fill_acroform` does `PdfWriter(clone_from=…)`, then `update_page_form_field_values(None, values, auto_regenerate=False)` (behind a `_write_values` seam), then `set_need_appearances_writer(True)`, then deletes `/XFA`. It then re-opens the file and compares `/V` for every field, plus `/AS` for button widgets. Any value outside Latin-1 sets `non_latin`.
- In `main()`, a new `elif engine == "acroform"` arm forces `fmt = "pdf"`. `residual_tags_in(out, "pdf")` returns the refused field names.
- `assert_integrity(out, "pdf")`:
  - re-opens the PDF;
  - returns `opened: False` with the sentence "The filled form did not read back as written for: … It was not delivered." on a mismatch;
  - keeps `residual_clean` True;
  - puts the refusal sentences and the non-Latin font limit in `documented_limit`.
- `main()` copies `integ["error"]` and `integ["refused"]` into the verdict when present. The docx, pptx and xlsx arms never set them.
- Allow-lists: `_SAFE_OUT_FILENAME_RE` and `_safe_out_filename` now accept `pdf`, and `_VALID_RENDER_ENGINES` includes `"acroform"`. In the handler, when `template_ext == "pdf"` the engine is set to `"acroform"` and the output name is forced to `.pdf`. `select_engine` is unchanged (its file has an empty diff).
- The workspace mime comes from `mimetypes`, so `.pdf` becomes `application/pdf` with no table edit.
- `test_278_pure_move.py` has five `RETIRED` entries, each giving its reason ("Phase 291 (291-03, D-25, 2026-10-22): deliberate post-move edit…").

**Task 2: the person's answers reach the form.**
- New file `harness/form_inputs.py` with `overlay_user_inputs(legacy_map, definition, run_inputs, placeholder_keys) -> (map, ids)`:
  - It acts only on declared inputs where `source == "user"`, whose key is a template placeholder, and whose launch value is a non-blank string, number or bool.
  - Each matching scalar becomes `{"value": str(v), "source_chunk_id": "input:<key>", "source_doc": None, "source_page": None}`.
  - `kb_auto` and `template_derived` inputs are ignored.
  - Arguments are never mutated: the scalars are deep-copied.
  - Dict-shaped definitions also work.
- `phase_types.py` changed by **+10 / −0**, call lines only:
  - one `.pdf` branch in `_template_oracle` calling `describe_files.acroform_oracle`;
  - one overlay call after `placeholder_keys` and before `check_coverage`;
  - `retrieved_ids = set(retrieved_ids) | input_ids`, which is the set that already flows to `resolved["retrieved_ids"]` (the handler gate) and to the success output's `retrieved_ids` (the post-phase `citations_required` validator).

## Verification

- Plan suites:
  - `test_291_pdf_fill_driver.py` (33 cases), `test_291_acroform_reader_parity.py` (5) and `test_291_form_inputs_overlay.py` (20) all pass.
  - `test_278_pure_move.py`, `test_259_closed_core_inventory.py` and `test_255_extension_contract_guard.py` are green. test_259 and test_255 have empty diffs, so the closed core recounts unchanged: 7 phase types, 1 emitter, 30 tools.
  - Neighbouring suites are green: `test_template_render`, `test_llm_emit_executor`, `test_citation_policy`, `test_emitters`, `test_tool_dispatcher`, `test_190_ssti_fence`, `test_189_no_egress`, `test_274`, `test_278_registry_pin`, `test_282_open_off_loop`, `test_295_template_lint` and `test_261_closed_core_inventory` (181 + 108 + 127 passed across runs).
- **Driven under the sandbox's pinned pypdf 5.1.0**, not only the venv's 5.9.0. I built fixtures in the backend venv, dumped `_RENDER_DRIVER_SRC` to a file, and ran its `main()` in an existing scratch `pypdf==5.1.0` venv (nothing was installed). All six cases (all kinds, refusals, falsy, XFA, `/1` on-state, CJK/Arabic) produced the same verdicts as under 5.9.0:
  - `/V` and `/AS` read back as written;
  - `/XFA` is gone;
  - `NeedAppearances` is true.
- `node scripts/check-extension-contract.cjs`: OK, 17 files, 0 violations.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/291-describe-it-from-your-own-files`: exit 0.
- Acceptance greps all hold:
  - `grep -c "Phase 291 (291-03"` in test_278 returns 5.
  - `overlay_user_inputs(` appears once in phase_types and `acroform_oracle` appears twice.
  - `Dockerfile.sandbox`, `template_render_service.py` and `publish_service.py` have empty diffs from base.
- **Full backend unit gate**, re-derived this session:
  - **Head: 71 failed, 8815 passed, 0 collection errors.** One of the 71 is `test_291_pdf_fill_driver::test_a_pdf_with_no_fillable_fields_is_never_delivered_as_filled`. I added and fixed that test while the gate was running, after the driver module had already been imported. Re-run on its own it passes, so it is a race in that run, not a defect. **That leaves 70 genuine failures.**
  - **Base `b5e772612`, in a throwaway worktree: 71 failed, 8757 passed.**
  - Set diff, head minus base, is only the race test above. Base minus head is `test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery`, a flaky live-DB test that failed at base and passed at head.
  - So every genuine failure at head is inherited, and the count is under the 71 ceiling.
  - Two `test_cross_worker_cancellation` tests fail in the full run and pass alone. They depend on test order and fail at base too.
  - The base worktree was removed with `scripts/teardown-worktree.sh`; the source venv and node_modules are intact.

## TDD Gate Compliance

Both tasks have a `test(291-03)` RED commit before the `feat(291-03)` GREEN commit: c3ff39dd9 → 61f734760, and 618ac1556 → e8d80641b. Each RED run failed for the stated reason:
- Task 1: `fill_acroform` and `_read_acroform` were missing and the allow-lists were too narrow.
- Task 2: `form_inputs` did not exist, the oracle returned None for `.pdf`, and `emit_rejected` fired three times for the user-sourced key.

Some tests passed at RED, as expected. They are behaviour-preservation controls: the docx residual and handler tests, and the pdf-without-fields and docx oracle cases.

The extra fix (e2c6f59b2) also went red first: the test was added and observed failing (`rendered True`) before the guard was written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] A PDF with no fillable fields would have been delivered blank as "filled"**
- **Found during:** Task 2, while checking the bind door
- **Issue:** `upload_workflow_template` accepts any `.pdf` without requiring AcroForm fields. For such a file the acroform arm would have copied it unchanged and reported success.
- **Fix:** `fill_acroform` returns `rendered: False` with "This PDF has no fillable fields, so none of the answers could be written into it." The handler then fails the run and nothing is persisted.
- **Files modified:** backend/app/services/tools/render_template.py, backend/tests/unit/test_291_pdf_fill_driver.py
- **Commit:** e2c6f59b2

**2. [Rule 2 - Correctness] A PDF template's output name is forced to `.pdf`**
- **Found during:** Task 1
- **Issue:** the model-supplied `out_filename` (for example `filled.docx`) decides the driver's `fmt` and the workspace mime. A PDF written under a `.docx` name would fail the docx integrity re-open, or be stored with the wrong mime.
- **Fix:** inside the handler's `template_ext == "pdf"` block, a non-`.pdf` name has its extension replaced. The basename has already passed `_safe_out_filename`. The driver's acroform arm also pins `fmt = "pdf"`.
- **Commit:** 61f734760

**3. [Rule 1 - Bug] A comment tripped an existing self-containment fence**
- **Found during:** Task 1
- **Issue:** `test_template_render::test_render_driver_is_self_contained` asserts that the substring `import app.` never appears in the driver source. My comment "cannot import app.*" matched it.
- **Fix:** I reworded the comment and left the fence unchanged.
- **Commit:** 61f734760

### Design notes (within the plan)
- `residual_clean` stays True for pdf even when fields were refused, as the plan says ("a refused field is a documented blank, not a residual failure"). The refused names appear in `residual_tags`, and their sentences in `documented_limit` and `verdict.refused`.
- The plan writes the documented limit as `"{n} answers weren't one of the form's choices…"`. A single refusal reads "1 answer wasn't … and was left blank:".
- Placing the overlay inside the retry loop has one side effect. With no KB evidence and only `input:` ids, a gate rejection now retries with feedback (up to the existing 3 attempts) instead of failing fast. A plain no-evidence run without user inputs still fails fast (`test_citation_reject_no_evidence_fails_fast` stays green).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-291-20 through T-291-24 are mitigated as planned:
- `input:` ids are minted only for declared user inputs that the template names, and an invented KB citation is still rejected (tested).
- Enum and checkbox answers are validated before they are written.
- Every write is read back.
- `/XFA` is dropped inside the existing network-less sandbox.
- The filename allow-list was widened only by `pdf`, and `shlex.quote` argv is unchanged.

## Notes for the orchestrator

- The `docs/HOT-FILE-LEDGER.md` and CLAUDE.md FIRING rows for `tools/render_template.py` and `harness/phase_types.py` were not re-derived here. This plan added content to both (+325 and +10 lines), so their triples need the phase-close ledger pass. `harness/form_inputs.py` was one of the young rows 291-01 created, and the ledger gate exits 0.
- `graphify update .` was not run in the worktree.
- `.omc/` is untracked and was already there before this plan started. It was left alone.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | c3ff39dd9 | test(291-03): failing acroform fill + parity tests |
| 1 GREEN | 61f734760 | feat(291-03): fillable PDF comes back filled (acroform arm) |
| 2 RED | 618ac1556 | test(291-03): failing overlay tests |
| 2 GREEN | e8d80641b | feat(291-03): person's answers reach the filled form |
| fix | e2c6f59b2 | fix(291-03): a PDF with no fillable fields is never delivered as filled |

## Self-Check: PASSED

- All four created files are present; all five commits are in `git log`.
- The plan verify suites pass; the extension-contract and ledger gates exit 0.
- Full backend gate: 70 genuine failures at head, all in the base set.
