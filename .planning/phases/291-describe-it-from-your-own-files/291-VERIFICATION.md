---
phase: 291-describe-it-from-your-own-files
verified: 2026-10-23T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 - NEVER "reviewed". No independent reviewer exists.
status: human_needed
score: 3/5 code-verified (SC#1, SC#2, SC#3); SC#4 and SC#5 owed to human
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "SC#3 execute_code missing from POWER_TOOLS (CR-01)"
    - "SC#1 oversize or % forms silently dropped (CR-02)"
  gaps_remaining: []
  regressions: []
requirements: {AUTH-02: code-side satisfied; closure blocked on owed human items}
human_verification:
  - test: "SC#4 - RUN_291_AUTHORING_ROSTER=1 pytest backend/tests/unit/test_291_authoring_roster.py across the full native roster plus OpenRouter. Include a 'calculate the totals -> no execute_code' row."
    expected: "Every provider row passes, or is recorded as blocked with a reason and issue id"
    why_human: "Paid and opt-in; not run"
  - test: "G-4 Chrome UAT rows S1-S7 in 291-VALIDATION.md (run S1 first)"
    expected: "Template, form and reference upload; arrival card; launch; fillable-PDF and Word fill all behave as specified"
    why_human: "Lived-experience and visual behaviour"
  - test: "SC#5 live: run a workflow on an author's fillable PDF and on a confirmed Word copy"
    expected: "The author's own form comes back filled, with no author-added placeholders"
    why_human: "No end-to-end run has been driven; only unit suites"
---

# Phase 291 Verification (re-verification after gap-closure round 1)

**Goal:** an author hands the describe door a template, form or reference docs and gets a draft whose inputs, phases and tools come from them.
**Status:** human_needed. No code gaps remain against the five success criteria. The owed human items are all that stand between this phase and AUTH-02 being marked satisfied.

**Re-verification note:** the previous status was `gaps_found` (SC#3 failed, SC#1 partial). Both are closed in the working tree, and I read the code rather than the SUMMARY.

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Declared inputs match uploaded form fields | VERIFIED (code) | `useTemplateFirstDraft.ts:1012-1027`: a blocked form now stops the draft with `FORM_NOT_SENDABLE_KEY` set through `setErrorState`. It is no longer dropped silently, and the only exception is the `template_fields` placeholders fallback. The `FORM_ENUM_MAX` cap is now 500 and the client caps mirror the server. `stamp_input_origins` (`describe_draft_guards.py:253-286`) restores the FULL option list from the read for model-declared enum inputs (R1-CR-01 fix is present in the working tree). The server-added path keeps full options too. |
| 2 | Tools and phase types come from the closed set; unknown tool refused | VERIFIED (code) | `test_291_generate_closed_set.py` passes. No change this round. |
| 3 | Hidden instructions in an asset do not change tools or grants | VERIFIED (code) | `POWER_TOOLS` at `describe_draft_guards.py:313` now contains `execute_code`. The `DescribePowers.tools` Literal (line 322) and the powers instruction (line 344) carry it, and `_TOOL_LEAD` has an entry (line 426), so no KeyError. "or calculations" is gone from the instruction (R1-WR-01 partial fix). `test_291_powers_guard.py` passes. |
| 4 | Full roster plus OpenRouter, blocked rows recorded | UNCERTAIN (owed) | The roster test exists but has not been run. |
| 5 | Run returns the author's own form filled | VERIFIED at unit level, UNCERTAIN end-to-end | `test_291_pdf_fill_driver`, `test_291_word_copy` and `test_291_form_inputs_overlay` pass. No live run. |

## Behavioural spot-checks

| Check | Result |
|---|---|
| Backend targeted: powers_guard, generate_coverage, generate_degraded, untrusted_names_fence, describe_read, generate_closed_set, pdf_fill_driver, word_copy, form_inputs_overlay | 207 passed |
| Frontend: `useTemplateFirstDraft.test.tsx` and `describeRefusalVocabulary.test.ts` | 138 passed |

I did not run the full backend unit suite or the vitest count gate (the orchestrator does).

## Requirements

AUTH-02 (REQUIREMENTS.md:21, mapped to Phase 291 at line 83, still "Pending"). It is the only ID declared and the only one mapped, so none is orphaned. The code-side capability is delivered. REQUIREMENTS.md should flip only after the human items are run, as the deferred-items file already says.

## Residual non-blocking findings (warnings, not gaps)

None of these makes a success criterion false, and all are triaged in `deferred-items.md`.
- **R1-WR-01 (residual):** once the description itself asks to run code, every `execute_code` step in the draft is kept, including one planted by a file. The author's own `execute_code` also runs with default-bridge egress. Trigger: the sandbox `network_mode` decision.
- **R1-WR-02:** a fillable PDF's field names reach the generate prompt raw through `grounding.py`. The powers guard re-checks tools after drafting, so SC#3 holds.
- **R1-WR-03:** `describe_files._fence` can be bypassed with `< /document_content>`. This is pre-existing and affects only the read-time proposal.
- Also deferred: WR-05 (security: a minted `input:<key>` id is a valid citation for any leaf), plus WR-01 through WR-07 and IN-01 through IN-08. WR-03 and WR-05 are scheduled for `/gsd:fast`. WR-05 is flagged as a security item in the deferred-items file. It should be done before AUTH-02 is closed or any prod push.
- IN-01 through IN-03 from the R1 review (client cap mirrors unpinned, 255-character filename, `fetch_document_file` left on a step) are accepted as info.

## Anti-patterns

I did not run a debt-marker scan. The anti-pattern scan was limited to what the two reviews already cover, and they report no TBD, FIXME or XXX.

## Gates (reported by the orchestrator, not re-run here)

Per the previous report: backend unit 70 failed against the ceiling of 71 (inherited), no migrations. The `test_S7` pin was fixed by value in 291-06.

## Routing

G-7: two gap-closure rounds are not yet used up (this was round 1), but no success criterion is unmet in code, so do not open another round. Run the owed items: S1 first, then S2 to S7, the SC#5 live fill, then the SC#4 roster. Do the scheduled `/gsd:fast` (WR-03, WR-05, R1-WR-02, R1-WR-03) before promoting anywhere.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
