---
phase: 291-describe-it-from-your-own-files
verified: 2026-10-23T00:00:00Z
status: gaps_found
score: 2/5 must-haves verified (SC#2, SC#5 code-side; SC#1 partial, SC#3 failed, SC#4 operator-owed)
requirements: {AUTH-02: partially satisfied}
gaps:
  - truth: "SC#3 - Instructions hidden inside an uploaded asset do not change the draft's tools or grants"
    status: failed
    reason: "POWER_TOOLS in describe_draft_guards.py:280 = {web_search, save_skill, attach_skill_file, remember}. execute_code is absent, but the draft tool registry (harness/grounding.py get_tools(None) - CHAT_ONLY_TOOLS; tool_dispatcher.py:115,202 gated only by sandbox_enabled) includes it. draft_powers() reports nothing for an execute_code step, so the guard never strips a file-planted one. The sandbox is created with no network restriction (per review), so it is a stronger egress channel than web_search, which IS in the set. Verified by reading the code; not driven live."
    artifacts:
      - path: "backend/app/services/describe_draft_guards.py"
        issue: "POWER_TOOLS, DescribePowers.tools Literal and _TOOL_LEAD omit execute_code"
    missing:
      - "Add execute_code to POWER_TOOLS, the DescribePowers.tools Literal, the powers instruction and _TOOL_LEAD; add a planted-injection test that uses execute_code"
  - truth: "SC#1 - declared inputs match the fields found in the uploaded form"
    status: partial
    reason: "formBodyFor (useTemplateFirstDraft.ts:549-565) returns null when any field has >50 enum options (FORM_ENUM_MAX), >200 fields, or a key containing %. The PDF is still bound as template, and the template_placeholders fallback (lines 995-1000) only applies to arm template_fields, not an AcroForm. So for a common class of PDF (state or country dropdown) no fields reach the generator, with no notice. Confirmed by reading code."
    artifacts:
      - path: "frontend/src/components/workflows/useTemplateFirstDraft.ts"
        issue: "silent null from formBodyFor for oversize or % forms while the PDF stays bound"
    missing:
      - "Truncate or relax caps (client and server in workflow_authoring_doors.py) or surface a visible refusal and unbind"
human_verification:
  - test: "SC#4 - run RUN_291_AUTHORING_ROSTER=1 backend/tests/integration/test_291_authoring_roster.py across the full native roster plus OpenRouter; record blocked rows, never omit"
    expected: "Every provider row passes or is recorded as blocked with a reason and issue id"
    why_human: "Paid, opt-in; not run. Not evidenced."
  - test: "G-4 Chrome UAT rows S1-S7 in 291-VALIDATION.md (lines ~73-80)"
    expected: "Lived-experience scenarios pass: template, form, reference upload; arrival card; launch; fillable-PDF and Word fill"
    why_human: "Visual and real-run behaviour; owed and not run"
  - test: "SC#5 live: run a workflow on an author's fillable PDF and a confirmed Word copy"
    expected: "Author's own form comes back filled, with no author-added placeholders"
    why_human: "Unit suites (pdf_fill_driver 33 cases, word_copy) pass per the review, but no end-to-end run was driven"
---

# Phase 291 Verification

**Goal:** an author hands the describe door a template, form or reference docs and gets a draft whose inputs, phases and tools come from them.
**Status:** gaps_found. This is not a goal-achieved phase: one success criterion fails on a security-relevant hole, and one is only partial.

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Declared inputs match uploaded form fields | PARTIAL | Read door, `form` body, and unit suites (`test_291_describe_read*`, `generate_coverage`, `acroform_reader_parity`) exist. CR-02 confirmed: oversize or `%` forms silently send nothing while the PDF stays bound. |
| 2 | Tools and phase types from the closed set; unknown tool refused | VERIFIED (code-level) | `test_291_generate_closed_set.py` exists; the registry is the closed set built in `grounding.py`. I did not re-run it. |
| 3 | Hidden instructions do not change tools or grants | FAILED (BLOCKER) | `execute_code` is not in `POWER_TOOLS` (CR-01 confirmed at line 280). The guard otherwise works for external_action steps and the four listed tools: the description-only powers call never sees file text, and fencing is in place (`test_291_fence`, `test_291_powers_guard`). |
| 4 | Full roster plus OpenRouter, blocked rows recorded | UNCERTAIN (owed) | `test_291_authoring_roster.py` exists; it has not been run. No evidence. |
| 5 | Run returns the author's own form filled | VERIFIED at unit level, UNCERTAIN end-to-end | `test_291_pdf_fill_driver.py`, `test_291_word_copy.py`, `test_291_form_inputs_overlay.py` exist and pass in the unit gate. No live run was driven. CR-02 also weakens the PDF path for large forms. |

## Requirements
AUTH-02 (REQUIREMENTS.md:21, mapped to Phase 291, still "Pending"): the only ID declared for this phase and the only one mapped to it, so none is orphaned. It is **not yet satisfied**, because SC#3 fails and SC#4 is unevidenced.

## Gates (as reported by the orchestrator, not re-run)
Vitest count gate OK; tsc file set identical to base; backend unit 70 failed against ceiling 71 (all inherited); no migrations. `test_214_argument_seams.py::test_S7` is red, an integration-only pin (4 `"reason_code":` against an expected 3). It is a stale pin from 291-02 and I found no behavioural cause. It should be updated.

## Other review findings
The 10 warnings and 8 info items in 291-REVIEW.md (file editing during composition, references listed as "used" though unread, chat-path output filename regression, an unkept trust claim in `form_inputs.py`, `removed_powers_broke_draft` falling back to the generic refusal) were not individually re-verified here. Triage them under G-7 / G-3 rules.

## Routing
Both gaps are small: CR-01 is a one-line set addition plus a Literal and a test. Under G-3 and G-7, `/gsd:fast` or a single closure round is appropriate rather than a new capability. Check `node scripts/check-gap-closure-rounds.cjs 291` first. The human items (roster, S1-S7) remain owed regardless.
