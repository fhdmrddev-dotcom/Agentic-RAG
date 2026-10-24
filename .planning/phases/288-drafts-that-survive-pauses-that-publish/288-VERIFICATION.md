---
phase: 288-drafts-that-survive-pauses-that-publish
verified: 2026-10-19
verification_mode: self-verified   # OV-SOLO-01 - never "reviewed"
status: passed
score: 3/4 success criteria met, 1 met-with-defect (SC#4 line present; its paused-state wording untrue)
re_verification: false
gaps:
  - truth: "SC#4 / failure criterion: a paused run's surface must not promise a resume that does not happen"
    status: partial
    reason: "workflow_runs.py:782 emits 'Still waiting on {who}; the run continues as soon as they answer.' for status=paused. Plan-04 live finding F-3 (VALIDATION.md line 86, observed twice, one run stuck 17 min) shows answering a paused run returns 200 but the run stays active and never completes. The shipped sentence is therefore untrue for paused runs."
    artifacts:
      - path: "backend/app/api/workflow_runs.py"
        issue: "line ~781-782 paused-state sentence promises continuation"
    missing:
      - "Either fix the paused-run re-drive (separate defect, code not touched by 288) or change the paused-state sentence to a truthful one (fast-fix, 1 line + its test in backend/tests/test_288_waiting_on.py and WorkflowRunPage tests)"
human_verification:
  - test: "S1 generate-then-dismiss arm of SC#1 (describe door produces name+config, dismiss, navigate away/back)"
    expected: "name and node config all present"
    why_human: "Blocked by Anthropic billing; needs a working authoring model"
  - test: "Visual sign-off of the Draft settings row and the waiting-on line (G-2 sketch skipped)"
    expected: "operator recognises it as acceptable"
    why_human: "visual"
  - test: "Non-owner view of the waiting-on line"
    expected: "wording names owner for a non-owner viewer"
    why_human: "Only unit-tested; no second account driven live"
---

# Phase 288 Verification

**Goal:** An author's work in progress does not disappear, and a workflow that legitimately waits for a person is a normal publishable workflow.
**Mode:** initial. Evidence below was read from code and targeted test re-runs, not taken from SUMMARYs.

## Targeted re-runs (mine)

| Suite | Result |
|---|---|
| backend `tests/test_288_waiting_on.py` + `tests/unit/test_288_pause_lint.py` | 36 passed |
| frontend `WaitingOnLine.test.tsx` + `pages/__tests__/WorkflowBuilderPage.draftSettings.test.tsx` | 10 passed (2 files) |

Full gates not run, per instruction. Diff 266e344c9..HEAD for source is 13 files (+373/-5), consistent with the claimed scope.

## Success criteria

| SC | Verdict | Evidence |
|---|---|---|
| SC#1 config survives navigate away/back | **MET, one arm owed** | The fix is `DraftArrivalCard` closed branch rendering a collapsed "Draft settings" row (`settingsRow` prop, `data-testid=draft-settings-row`) wrapping `DecisionsList`, mounted with `settingsRow` in `WorkflowBuilderPage.tsx:2178`; before, `!open` returned null so name/decisions were unreachable. Unit-pinned in draftSettings test. Live (UAT/VALIDATION): planted draft, name input count 0 -> 1, rename and node text survive library round trip and hard reload; screenshots in evidence/. Generate-then-dismiss arm not driven (billing). Note the live drive was headless Playwright by the executor, not claude-in-chrome as the user. |
| SC#2 no cross-draft bleed | **MET (live only)** | Driven A/B/A, B/A/B, save in flight, after reload, DB cross-checked: not reproduced. Phase added no persistence-keying code, so this rests on the live drive and the draftSettings test, not on a new guard. Acceptable: nothing was broken to fix, per RESEARCH. |
| SC#3 pause publishes, planted unbounded wait refused | **MET** | `publish_service._interactive_phase_failures` adds, alongside the ask_user check, a bound check for `llm_human_input` (int, >0, <= `ask_user_max_timeout_seconds`); model default `timeout_seconds=300` so ordinary pause workflows pass. Pause lint tests green (my run). Live: 300 and 1800 published; 0, -5, 99999, 1801 refused by `/validate`, publish route (`blocked_stage: interactive_phase`) and Builder UI. Check was added, not a check removed. |
| SC#4 run surface says who it waits on, same after reload | **MET for the line, with a defect in its paused wording** | `WaitingOnLine` mounted at `WorkflowRunPage.tsx:1289`; sentence composed server-side from the durable unanswered-prompt row (`workflow_runs.py` ~762-842), no ids, so reload-stable by construction; live in-window and post-window, same after reload; non-owner variant unit-tested only. But see gap. |

## F-1..F-4 judged against the SCs

- **F-3 (paused answer returns 200, run never completes): makes the shipped paused-run copy untrue.** `workflow_runs.py:782` says "the run continues as soon as they answer" for `status=="paused"`, and the executor's own observation (twice, 17 min stuck) contradicts it. The roadmap's failure list says "a published pause workflow makes a run that never resumes and nothing says so"; here something says the opposite. The re-drive code is untouched by 288 and was not checked at base, so the *non-resumption* is not proven a 288 regression and does not by itself fail SC#4, but 288 authored the false sentence. This is the one gap. Route: **fast-fix under G-3 / not a G-7 round** (truthful paused wording, or fix re-drive as its own item). Not yet a phase-gate-closing round: no new capability.
- **F-1 (expired card, no answer control, beside "run continues" line):** pre-existing, PendingAskCard.tsx untouched. Not an SC failure; compounds F-3 (the line promises an answer path the UI does not offer). Defer, bundle with F-3.
- **F-2 (judge often blocks planted pause workflow):** the refusal lint path itself works (SC#3 met); judge variance is a grounding/judge matter outside the SCs. Accept/defer. Note it makes "publishes" depend on judge outcome, which was achieved live for 300/1800.
- **F-4 (auto_answered note unmounted on publish):** wired backend (`publish_service` returns `auto_answered`, derived from persisted `_golden_run_mock` outputs) and frontend (PublishGauntlet), but author never sees it. Not an SC; D-07 value is not delivered. Defer or fast-fix (keep gauntlet mounted / carry note to library toast).

## Other checks

- Artifacts exist, substantive, wired: `WaitingOnLine.tsx` (leaf, renders server string as text, no HTML), `decisionsVocabulary.ts` consts, `workflow_wire.py`/`knowledge.ts`/`workflows.ts` additive fields, `db/workflows.py` helper.
- Anti-patterns: no TBD/FIXME in changed source observed in diff.
- Billing blocks (S1 arm, Anthropic roster row) are recorded as blocked rows, not omitted; accepted as human-owed.
- Probes: none declared.

## Status: gaps_found

Reason: one shipped statement (paused-run copy) is contradicted by live evidence the phase itself recorded. Everything else is met. Recommended: `/gsd:fast` the wording (do not run a gap-closure round), then close as human_needed for the three owed rows above (S1 dismiss arm, visual sign-off, non-owner live view). F-1/F-3 re-drive and F-2/F-4 go to a named later item or seed.

_Verifier: Claude (gsd-verifier)_

## Re-check 2026-10-24 (orchestrator)

- **SC#4 gap (paused-state sentence):** closed by Phase 295 — a paused human-input step now resumes on answer and the run completes (295 S2 run `74493c29`, S6 `6b4afbc0`), so `Still waiting on {who}; the run continues as soon as they answer.` is true. No 288 code change needed.
- **S1 generate arm:** PASS (288-UAT.md row 1). **Roster row 2 (Anthropic):** PASS (`f23299748`).
- **Owed:** operator visual sign-off of the Draft settings row and the waiting-on line; non-owner view stays unit-tested only (no second account driven).

**Operator signed 2026-10-24** ("signed 288 and 295"): Draft settings row and waiting-on line accepted visually; non-owner view accepted on unit tests; the untouched-generated-draft finding tracked as BUG-261024-02. **Status: passed.**
