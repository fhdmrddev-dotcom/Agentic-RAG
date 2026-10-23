# Phase 291 — deferred items (out of scope for the plan that found them)

## Found during 291-04

- **`backend/tests/integration/test_214_argument_seams.py::test_S7_the_generate_refusal_returns_the_new_code_from_the_real_service` is RED, inherited from 291-02.**
  It counts `"reason_code":` occurrences in `backend/app/services/workflow_authoring.py` and expects exactly 3 (the three `connection_not_allowed` returns); 291-02 added a fourth (`grounding_unavailable` / `removed_powers_broke_draft` refusals). Measured RED at the 291-04 base `73107e648` in a throwaway worktree, so 291-04 did not cause it (291-04 changed no backend source). It lives in `tests/integration`, outside the unit gate. Owner: whoever closes 291-02's review — re-derive the pinned count with a written reason, as 288-04 / 291-01 did for their pins. → closed by 291-06 (WR-10: the pin now asserts by value — 3 `CONNECTION_REFUSAL_*` + 1 `"grounding_unavailable"`; both S7 cases pass).

## Found during 291-05

- **`could_not_generate:removed_powers_broke_draft` reads the GENERIC refusal on the describe door.** 291-02 returns this reason code (`describe_draft_guards.py:395`, detail `_BROKE_DRAFT_DETAIL`: "Your attached files asked for actions only your description can add. Removing them left a workflow that cannot run, so no draft was made. Describe the steps you want and try again."). `describeRefusalVocabulary.ts` has no row for it, so `describeRefusal` falls back to the bare `could_not_generate` words ("The model couldn't produce a usable draft.") and the server's own sentence shows only under the technical-names reveal. That blames the model for what the powers guard did. UI-SPEC says this refusal renders the server's sentence. 291-05's plan scoped only `grounding_unavailable`, and Task 3 may not edit source, so it is recorded here. Size: one table row or one key routed like `ENTITLEMENT_REFUSED_KEY` (G-3 `/gsd:fast`). Owner: verify-work / code review for 291. → closed by 291-06 (WR-08: the table row carries `_BROKE_DRAFT_DETAIL` verbatim, split at its last sentence).

## Deferred at 291-06 (gap round 1, G-7 triage)

Every finding below is either not a ROADMAP success-criterion gap (G-7: a closure round fixes
SC gaps only) or would add a capability inside a closure round. Each carries its own re-open
trigger or schedule. 291-06 closed CR-01, CR-02, WR-08, WR-09 and WR-10.

- **WR-01** — the attached files stay editable while a draft is composing, and the bind reads the live files, not the ones the draft was built from. Deferred: not an SC gap, and the fix touches a G-5 file that owes its extraction first.
  Trigger: the next phase whose `files_modified` names `useTemplateFirstDraft.ts` or `WorkflowBuilderPage.tsx` (that phase owes the G-5 extraction first).
- **WR-02** — references that were never read are bound and listed as "Used to write this draft". Deferred: not an SC gap.
  Trigger: the next phase whose `files_modified` names `useTemplateFirstDraft.ts`, `WorkflowBuilderPage.tsx` or `decisionsVocabulary.ts`.
- **WR-03** — chat `render_template` with a Word template and a model-chosen `.pdf` out_filename fails integrity instead of delivering. Deferred: a chat-path defect outside AUTH-02's SCs; not folded into this plan.
  **DONE 2026-10-23 (/gsd:fast):** `_safe_out_filename` keeps the model's stem and always uses the template's extension ("report.pdf" on a Word template → "report.docx"). Pinned in `test_291_pdf_fill_driver.py::test_safe_out_filename_accepts_pdf`.
- **WR-04** — a button `/V` is written as a text string, and the read-back cannot see it. Deferred: not an SC gap.
  Trigger: the next phase touching `render_template.py`'s acroform engine, or a viewer report of an unset checkbox or radio.
- **WR-05 — ⚠ SECURITY** — a minted `input:<key>` id is a valid citation for ANY leaf, so the overlay's "can never weaken it" claim does not hold. Deferred by orchestrator decision; not folded into this plan.
  **DONE 2026-10-23 (/gsd:fast):** `overlay_user_inputs` strips any `input:` citation from every leaf except the overlaid scalar for that same key (KB scalars and collection cells), so the gate counts it as uncited and takes the normal reject/retry path. Pinned in `test_291_form_inputs_overlay.py::test_a_minted_id_cited_by_any_other_leaf_counts_as_uncited` (RED first). IN-01 and IN-06 were NOT done here; their trigger moves to the next touch of `form_inputs.py`.
- **WR-06** — "Look it up" (`source: "kb_auto"`) has no engine-side lookup. Deferred: building it is a new capability, not a closure fix.
  Trigger: the next phase touching `declaredInputsVocabulary.ts`, `soulData.ts` kb_auto or `form_inputs.py`, or a G-4 S-row showing a kb_auto field come back blank.
- **WR-07** — untrusted PDFs are fully text-extracted twice in the API process, with no page or decompression bound. Deferred: not an SC gap; the describe door is author-only today.
  Trigger: the next phase touching `describe_files.py`'s PDF read, or before the describe door is reachable by any non-author or public-API caller.
- **IN-01** — the citation-gate retry fires with no KB evidence, and its feedback names `<doc>` blocks that do not exist.
  Trigger: the next touch of `form_inputs.py` or the emit citation gate (WR-05 fast batch shipped without it, 2026-10-23).
- **IN-02** — the reference door has no server-side count cap (judged not a defect for model input).
  Trigger: storage-quota work.
- **IN-03** — a partial Word-copy placement at bind time returns 201 and drops the unplaced sentences.
  Trigger: the next touch of the template door (`upload_workflow_template`).
- **IN-04** — `_has_template_marks` does not refuse `{#`.
  Trigger: the next touch of `describe_files.py`'s Word copy (`make_fillable_copy` / `_has_template_marks`).
- **IN-05** — `fields_report` can return `covered_by: null`, which the client type forbids, and the fold then shows a dead switch.
  Trigger: the next touch of `DraftInputsFold.tsx` or `frontend/src/lib/api/knowledge.ts`.
- **IN-06** — unanswered optional user inputs are not overlaid as explicit nulls.
  Trigger: the next touch of `form_inputs.py` or the emit citation gate (WR-05 fast batch shipped without it, 2026-10-23).
- **IN-07** — `grounding_unavailable` on every generate; transient DB errors are now hard refusals (judged safe).
  Trigger: the next touch of `workflow_authoring.py` grounding (`_assemble_grounding`).
- **IN-08** — `bindFailed` reports only the last failed file, and the inputs fold's filename reads the live template file.
  Trigger: with WR-01.
- **network_mode (sandbox egress for workflow runs)** — a capability decision, not a 291 defect. 291-06 closed the FILE-planted path (CR-01: execute_code is now a power a file cannot grant), but an execute_code the AUTHOR asks for still runs in a container with default-bridge egress (`sandbox_service.py` sets no network restriction).
  Trigger: the next phase touching `backend/app/services/sandbox_service.py`, any phase that gives workflow runs execute_code by default, or SEED-013 / Open Platform getting a phase number.
- **Owed human items — NOT closed by this round.**
  - **SC#4** — `RUN_291_AUTHORING_ROSTER=1 pytest tests/unit/test_291_authoring_roster.py` across the full native roster plus OpenRouter, blocked rows recorded as ⛔ with their reason.
    Trigger: owed before AUTH-02 can be marked satisfied; run at 291 verify-work.
  - **S1-S7** — the G-4 Chrome rows in `291-VALIDATION.md`. Run **S1** first.
    Trigger: owed before AUTH-02 can be marked satisfied; run at 291 verify-work.
  - **SC#5** — the live fill run on a fillable PDF and on a confirmed Word copy.
    Trigger: owed before AUTH-02 can be marked satisfied; run at 291 verify-work, after S1.

## Found by 291-REVIEW-R1 (review of gap round 1)

- **R1-CR-01: FIXED inline (G-3).** A model-declared enum input kept only the 25 options the prompt showed. `stamp_input_origins` now restores the full option list from the read result. Test: `test_a_MODEL_declared_enum_input_gets_the_full_read_list_back`.
- **R1-WR-01: FIXED inline (G-3), partly.** The powers instruction no longer says "or calculations", so "calculate the totals" should not grant `execute_code`. Still true: once the description itself asks for running code, every `execute_code` step in the draft is kept, including one planted by a file.
  Trigger: the sandbox `network_mode` decision above (that is where egress is actually closed). Add a "calculate the totals → no execute_code" row to the SC#4 roster run.
- **R1-WR-02: DEFERRED.** For a fillable PDF, its field names reach the generate prompt raw, as `template_placeholders`, in `grounding.py`'s "fills EXACTLY the fields named on the next line". The fix changes the shared grounding section that every template draft uses (pinned by `test_193_1_grounding_wire.py` and `test_182_extraction_parity.py`), so it needs its own cross-provider check. SC#3 holds regardless, because the powers guard re-checks tools after drafting. The risk is limited to how steps are shaped.
  **DONE 2026-10-23 (/gsd:fast):** when the placeholders come from a fillable form, `render_grounding_prompt(placeholders_in_form_block=True)` keeps the D-26 heading but points its next line at the form's escaped `<form_fields>` block instead of relisting the names raw. A form key can no longer close `<form_fields>` (every `<`/`>` escaped). The docx template path is byte-identical (the 193.1 pins are untouched). Tests: `test_291_untrusted_names_fence.py` (e), `test_291_generate_coverage.py::test_R1_WR02_*`. ⚠ Not driven against a live provider: the SC#4 roster run must confirm a form-arm draft still picks `render_template` with the exact keys.
- **R1-WR-03: DEFERRED (existing before 291-06).** `describe_files._fence` lets `< /document_content>` and `</document_content foo>` through. The generate-path escaper catches both.
  **DONE 2026-10-23 (/gsd:fast):** `_fence` now escapes every `<`/`>`. Test: `test_a_lookalike_close_tag_in_the_body_cannot_close_the_fence` (3 cases).
- **R1-IN-01..03: ACCEPTED as info.** The client mirrors of the caps and sentence have no test tying them to the server. The 255-character filename limit isn't mirrored on the client. `fetch_document_file` stays on a step after `execute_code` is stripped.
  Trigger: next phase touching `useTemplateFirstDraft.ts`.

## Found by the G-4 / SC#4 / SC#5 UAT (2026-10-23 → 2026-10-24)

The owed human items above are now RUN (see `291-HUMAN-UAT.md`, `291-S5-ROSTER.md`). Fixed during
the UAT: S3-F1 `6f3311262`, S3-F4 `d01547f50`, the fill path `183cac200`, the Run dialogs
`34f643ce7`, refused choices `e03c3c88e`. Still open, each with its trigger:

- **S1 labels (text fields)** — page-text labels for text fields are still poor on a tooltip-less form ("3.", "�", instruction sentences). Checkboxes are fixed. The model writes good labels into its inputs, and the card shows those, but the door's grid shows the page guesses.
  Trigger: the next phase touching `describe_files._page_labels` or the describe door grid.
- **S1 copy** — "Nothing is saved or published yet" after Save; a billing failure reads as "describe the work in more detail"; a model-overridden enum can carry an empty option (seen again in a launch hint: "one of: C, S, P, ").
  Trigger: the next phase touching `DraftArrivalCard.tsx` / `workflow_authoring` error copy.
- **S2-F1 / S6-F8 (hollow steps)** — removing a power can leave a step that existed only to use it; and an AI-drafted LLM step that "validates the inputs" cannot see launch answers (an LLM step's user turn is the prior output or the kickoff only), so it says "None were included".
  Trigger: the next phase touching `phase_types._first_phase_user_turn` or the authoring prompt.
- **S2-F2** — file text reaches the restated requirement the judge grades against. **S2-F3** — "no Slack connection is configured" when it is connected but not ticked.
  Trigger: the next phase touching `describe_draft_guards` or the describe services picker.
- **S3-F2 / S3-F3** — the step panel lists raw AcroForm names; "Replace this template" under a bound PDF only accepts Office files.
  Trigger: the next phase touching `PhaseFormPanel.tsx` / the template replace control.
- **S6-F7 (publish gate)** — the golden run answers every launch input with "golden run placeholder for <key>", writes those into a form, and the grader passed it. Publish does not prove a real fill.
  Trigger: the next phase touching `publish_service._run_golden` inputs; consider deriving golden inputs from the author's test instruction.
- **S6-F9 / S7-F1 (minor)** — the run record squeezes the title into a one-word column at 1536px; a Word fill reports "2 fields" when 4 were filled.
  Trigger: the next phase touching `WorkflowRunPage.tsx` / the render `_measure`.
- **BUG-261024-01** — Moonshot rejects the emit schema; no workflow drafts on Kimi (pre-dates 291).
