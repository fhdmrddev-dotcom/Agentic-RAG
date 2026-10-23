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
  Scheduled: /gsd:fast immediately after 291 round 1 (fix spec: 291-REVIEW WR-03).
- **WR-04** — a button `/V` is written as a text string, and the read-back cannot see it. Deferred: not an SC gap.
  Trigger: the next phase touching `render_template.py`'s acroform engine, or a viewer report of an unset checkbox or radio.
- **WR-05 — ⚠ SECURITY** — a minted `input:<key>` id is a valid citation for ANY leaf, so the overlay's "can never weaken it" claim does not hold. Deferred by orchestrator decision; not folded into this plan.
  Scheduled: /gsd:fast immediately after 291 round 1 (fix spec: 291-REVIEW WR-05).
- **WR-06** — "Look it up" (`source: "kb_auto"`) has no engine-side lookup. Deferred: building it is a new capability, not a closure fix.
  Trigger: the next phase touching `declaredInputsVocabulary.ts`, `soulData.ts` kb_auto or `form_inputs.py`, or a G-4 S-row showing a kb_auto field come back blank.
- **WR-07** — untrusted PDFs are fully text-extracted twice in the API process, with no page or decompression bound. Deferred: not an SC gap; the describe door is author-only today.
  Trigger: the next phase touching `describe_files.py`'s PDF read, or before the describe door is reachable by any non-author or public-API caller.
- **IN-01** — the citation-gate retry fires with no KB evidence, and its feedback names `<doc>` blocks that do not exist.
  Trigger: with WR-05's scheduled /gsd:fast.
- **IN-02** — the reference door has no server-side count cap (judged not a defect for model input).
  Trigger: storage-quota work.
- **IN-03** — a partial Word-copy placement at bind time returns 201 and drops the unplaced sentences.
  Trigger: the next touch of the template door (`upload_workflow_template`).
- **IN-04** — `_has_template_marks` does not refuse `{#`.
  Trigger: the next touch of `describe_files.py`'s Word copy (`make_fillable_copy` / `_has_template_marks`).
- **IN-05** — `fields_report` can return `covered_by: null`, which the client type forbids, and the fold then shows a dead switch.
  Trigger: the next touch of `DraftInputsFold.tsx` or `frontend/src/lib/api/knowledge.ts`.
- **IN-06** — unanswered optional user inputs are not overlaid as explicit nulls.
  Trigger: with WR-05's scheduled /gsd:fast.
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
