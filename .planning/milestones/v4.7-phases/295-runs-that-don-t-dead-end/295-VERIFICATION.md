---
phase: 295-runs-that-don-t-dead-end
verified: 2026-10-21T06:00:00Z
verification_mode: self-verified   # OV-SOLO-01 - NEVER "reviewed". No independent reviewer exists.
status: passed
score: 5/5 success criteria verified in code and live (SC#4 and SC#5 with stated caveats); 4/4 requirements satisfied
overrides_applied: 0
re_verification:
  previous_status: none
gaps: []
deferred:
  - truth: "A followed run keeps the Unsourced mark in the same tab (BUG-261021-03 / D-r2-02)"
    addressed_in: "none scheduled (re-open trigger in BUG-261021-03)"
    evidence: "status: deferred; trigger: next phase naming StreamsProvider.tsx or PhaseCard.tsx, or any report of a missing mark"
human_verification:
  - test: "G-4 operator recognition pass on 295-HUMAN-UAT.md (S1 both homes, S2 four places, S3 locked, S4, S6, S7 plus the composer-while-paused line)"
    expected: "Operator recognises none of the failure scenarios in 295-VALIDATION.md G-4 table"
    why_human: "G-4 is the operator's own sign-off; the agent drives are evidence, not sign-off. Status is `pending` in 295-HUMAN-UAT.md."
---

# Phase 295: Runs That Don't Dead-End Verification Report

**Phase Goal:** A workflow run does not dead-end. When a KB step finds nothing or forgets its citations the run pauses and asks the person instead of failing; misconfigurations are refused before a run starts; every run ends in a true state that says why.
**Verified:** 2026-10-21 (HEAD `0c1d60d53`, base `7fdf86e70`)
**Status:** human_needed (every success criterion is met in code and in live evidence; the operator's G-4 sign-off is OWED)
**Re-verification:** No, initial verification.

## Goal Achievement

### Success criteria

| # | Success criterion | Verdict | Code | Live evidence |
|---|---|---|---|---|
| SC#1 | Found-nothing / zero-citation KB step pauses with a worded choice (search another folder / continue unsourced, marked on step, run page, receipt / stop); locked workflow offers no continue | **VERIFIED** | `harness/engine_ask.py` (`engine_pause` L912, `compose_engine_choices` L771, `is_locked` L740, `permitted_folder_options` L828 org-narrowed, `consume_engine_answer` L1199, `engine_answer_refusal` L1105); `api/runs.py` L1008-1030 (CR-01 409 + allow-list refusal before persist); `PendingAskCard.tsx` + `panel/enginePause.ts` + `AskFolderChoice.tsx`; `unsourced` read in 4 places (295-05) | S1 run page `b8a3e6f3` PASS; S1 chat panel FAIL in 295-07, then fixed (295-08) and re-driven PASS (round 1, `61eedca76`); S2 `d5d77eed` (step, evidence page, export, receipt carry Unsourced); S3 locked `b9c4635d` (no Continue in DOM, four forged answers got 422, no row written); round 2 rows 1, 4, 5 and D-r2-01 re-drive (`80f7d411`, `77c91d0b`) PASS. Caveat: in the same tab that followed a Continue run to its end the Unsourced mark is missing until reopen (D-r2-02, deferred as BUG-261021-03) |
| SC#2 | Report step with no template refused at save/publish, message names the template | **VERIFIED** | `reachability.py` L335-362 (`no_template_bound`, one sentence from `emit_cause`); `lint_workflow` is called by `publish_service` and `workflow_kickoff.py` L268-285 (HTTP 400 with the lint sentence, only when no staged template); `phase_types.py` L1564-1568 keeps the run-time arm distinct | S4 PASS: Builder save warns (save succeeds), publish route refused, Run modal and thread entry show the server words; `/validate` returned `no_template_bound` with the named step |
| SC#3 | Recorded-not-sent action can pass publish judge; DMT 2026-08-26 shape | **VERIFIED** | `validator_kinds.py` L189-300 (`_RECORDED_INTENT_NOTE` in the system prompt, graded data fenced by hash, full recorded inputs rendered; WR-05); `publish_service.py` L834-902 feeds `recorded_intent` | S5: `edd81b32` published v1, judge graded the email content, not the envelope. Honest caveat in VALIDATION: the before-shape did NOT reproduce a block locally (4 of 4 published at base, 95-100), so the "was blocked" half is not locally re-provable; one sample of a stochastic judge. D-47 pause plant 4 of 4 published (`validator_kinds.py`/`publish_service.py` otherwise unchanged by 295-07) |
| SC#4 | No run `active` after phases terminal; no failed run without a reason; approval wait reads waiting; the 2 stuck + 20 reasonless runs reconciled or explained | **VERIFIED** (caveats below) | `run_reconciler.py` `_reconcile_workflow_runs` L282-330 (cancelled arm, else failed with `_REASON_WORKFLOW`, one `run_failed`); `run_handoff.py` (`end_run`, `record_failed_end`, `finish_golden_run`, `resume_with_terminalize`, `record_stop`, `fail_unloadable_definition`); `engine_pause` pauses durably so an approval wait is `paused`; end reason on every run read (295-05) | Fresh stuck plant `ef53f1fc` ended `failed` with ONE `run_failed` 23 s after planting by the periodic sweep (log line quoted); armed run `15fadac6` read "Paused for your answer", Stop gave `cancelled` with "Stopped by..."; round 2 row 3 "Do not run it" failed with the reason in 0.6 s. The 2 stuck runs were already `cancelled` before the merged code was live (SEED-363, explained in S7); the 20 reasonless runs: 15 fixtures deleted by the operator, 5 June runs stay failed with null reason and their pages say "No reason was recorded when this run failed" (explained, by D-22). Chat-home SC#4 gap (D-r1-02, D-r2-01) fixed and re-driven live (40 of 40 samples) |
| SC#5 | Re-measure citations_required failure share with the 2026-10-20 queries; before/after recorded | **VERIFIED** (as a mechanism measurement, not a production rate) | n/a (measurement) | VALIDATION "SC#5 baseline" (live 6.1%, golden 24.1%, combined 10.0%; since 2026-09-01 combined 8.3%) vs "SC#5 after" (combined 0.0%, 23 runs, same query verbatim, read-only transaction, window start stated). A behaviour-level query shows 15 engine-gate firings, 0 ended in a citation failure. The file itself says the 0.0% is not a production rate (window is the plan's own deliberately-empty-folder UAT runs) |

### Requirements

| Req | Verdict | Evidence |
|---|---|---|
| RUN-01 | **SATISFIED** | SC#1 above; BUG-261020-07 folded; BUG-261021-01 (provider error offered as found-nothing) closed live (`evidence/r1_wr01_*`); eight-provider scoreboard 7 PASS + Anthropic blocked |
| RUN-02 | **SATISFIED** | SC#2 above; BUG-261020-08 folded |
| RUN-03 | **SATISFIED** | SC#3 above; BUG-261020-09 folded |
| RUN-04 | **SATISFIED** | SC#4 above; BUG-261020-10, -11, -12 folded; plus BUG-261020-01 / BUG-261015-01 (answer reaches next step, one failure one message; S6 `dda11389` wrap quotes the real answer) |

No ORPHANED requirements: REQUIREMENTS.md maps RUN-01..04 to 295 and all four appear in the plans.

### Review findings

| Finding | Status | Where |
|---|---|---|
| CR-01 answer bound to current question | Fixed `40b466e1b` (test first `ce87882d3`); `api/runs.py` L1008 `_is_current_question` 409; human step keys on its own prompt row | Live: r1_cr01 evidence, round 2 row 4 (stale send gets 409) |
| WR-01 provider error offered as found-nothing | Fixed `b48036bce`; `sub_agent_error_mark` in `run_handoff.py`, `phase_types.py` L936/L1077, `validator_kinds.py` L402, `engine_ask.py` L757 | Live closed (BUG-261021-01 `status: closed`) |
| WR-02 searched folder re-offered | Fixed `7a2745bb1` | Live pass in round 1 |
| WR-03 new chat failure message on skip_to | Fixed `667358056` | Live pass in round 1 |
| WR-04 free-text on an engine ask, refusal words dropped | Fixed `3ad8f8ee4` (295-08) | `PendingAskCard.tsx`, `lib/api/threads.ts` |
| WR-05 judge note inside untrusted data | Fixed `77714a2ef` (`judge_system_prompt`, hash-keyed fence) | Live pass; IN-08 (operator decision) still open |
| WR-06 folder list not org-narrowed | Fixed `c61972669` + 295-10 `b9eb997fe` (own folders too) | `engine_ask.py` L858 `restrict_org_ids`; round 2 row 5 PASS both directions |
| WR-07 second pause write | Fixed `ec0951f1e` | Live pass |
| IN-01..IN-08 | Recorded in `295-REVIEW.md` L211-233, not fixed, by decision (STATE round-1 record) | Not silently dropped |

### Folded reported bugs and seeds

| Item | Status | Note |
|---|---|---|
| BUG-261020-07, -08, -09, -10, -11, -12 | `folded`, `folded_into: "295"` | Live evidence above; closure belongs to `/gsd:complete-milestone`. Awaiting closure |
| human-step-answer-never-reaches-the-next-step (BUG-261020-01) | `folded` | S6 PASS; awaiting closure |
| BUG-261015-01 | `folded` | Fixed in 295-04, awaiting closure |
| BUG-261021-01 | **closed**, `verified_closed_by: "295"` | Live re-drive after gap round 1 |
| SEED-361 | `folded` into 295; fixed by 295-08, re-driven live | Awaiting closure |
| SEED-360 (F-2) | `partially-answered`, `folded_into: "289, 295 (F-2)"` | D-47 plant 4 of 4 published |

### Deferred items and re-open triggers

| Item | Trigger present? |
|---|---|
| BUG-261021-02 (folder/workflow create ignore X-Org-Id, a tenancy bug) | **NO. `status: open`, `folded_into: null`, `re_open_trigger: null`.** Routed in prose only ("next phase that touches org scoping or the folder/workflow create routes"). Not recorded in STATE. See Warnings |
| BUG-261021-03 (D-r2-02, Unsourced mark lost in followed tab) | Yes, `status: deferred` with trigger |
| SEED-367 (open thread does not see an API-started run) | Yes (`planted`, trigger_when) |
| SEED-366 (author lock on a detected KB step) | Yes |
| SEED-363 (TestClient test claims a live run) | Yes |
| Plan-04 residual: duplicate `action_risk_pending` | Yes, in 295-04-SUMMARY "Residuals" (phase that takes the armed-block seam, or a UAT row reading the duplicate) and STATE |
| Plan-04 residual: Stop on a live producer records no reason | Yes, in 295-04-SUMMARY (user id on the Redis cancel broadcast) and STATE; observed live on `b0a8203a` |
| Paused-composer F2 lock disagreement | Handled by wording (D-r1-03, fixed in 295-10 `88698c121`, live PASS round 2 row 6). The underlying server-path disagreement is recorded in 295-08-SUMMARY but carries no seed or trigger |
| D-r2-03 (refusal words visible 209 ms) | Accepted, recorded |

### Scoreboard (CLAUDE.md UAT recipe)

295-VALIDATION.md carries all eight roster rows, derived from `MODEL_CAPABILITIES` plus registry rows, each driven with per-request model and provider: OpenAI, Google, DeepSeek, Zhipu, MiniMax, Moonshot, OpenRouter PASS; **Anthropic marked blocked (billing), re-tested, with the reason and its finding** (which became WR-01 / BUG-261021-01). Multi-tool PASS (`1880cf56`), parallel-thread PASS (`7efbc5cf` / `a61e9ee1`), long-message PASS (7,009-byte prompt, `126f1adf`). Blocked rows are marked, not omitted. Note: the roster was driven at 295-07, before gap rounds 1-2; the later rounds were driven on the default model plus cross-thread rows, not the full roster again.

### Gates and tests (run by me)

| Check | Result |
|---|---|
| `check-hot-file-ledger.cjs` on the phase dir | `ledger gate OK`, 622 scan rows, 105 subject files, 44 watched |
| `check-claude-md-size.cjs` | OK, 96,904 chars (64.6% of limit) |
| `check-seeds-register.cjs` | OK, 374/374 parsed, 0 duplicate ids; unswept: 130 no trigger, 113 prose-only |
| `check-gap-closure-rounds.cjs 295` | `G-7 clear`, reads 0 gap-closure plans. **Expected under-read**: 295-08/09/10 have SUMMARYs but no PLAN.md. Consistency with the hand record: 295-08 and 295-09 carry `gap_closure_round: 1`, 295-10 carries `gap_closure_round: 2`, matching STATE's "round 1 of 2" then "round 2 (the LAST allowed)". The record is consistent; the script cannot see it. Two rounds are spent; no round 3 |
| Backend `tests/unit/test_295_*.py test_256_*.py test_281_*.py` | **467 passed**, 0 failed |
| Frontend `src/components/panel src/__tests__/providers` | **43 files, 684 tests passed** |
| Full backend unit gate / full vitest count gate | NOT re-run. Recorded: 295-07 backend 70 failed, 8638 passed (ceiling 71); 295-10 base 70 failed / HEAD 70 failed, 8682 passed, 0 collection errors. Count gate in 295-07: `COUNT GATE VIOLATED (1 failing, inherited, since fixed)`; "count gate OK" was never claimed; 295-10 did not run the full gate either |
| Debt markers (TBD/FIXME/XXX) in added non-test lines base..HEAD | none |

## Anti-patterns / warnings (no BLOCKER)

- WARNING: BUG-261021-02 is a major tenancy bug with no `re_open_trigger` and no `folded_into`; CLAUDE.md requires `deferred` + trigger. Fast-fix (frontmatter, 3 lines). Not a ROADMAP criterion.
- WARNING: the vitest count gate has not been shown `OK` since the 295 changes; the last full run was red on one inherited failure that was then fixed and re-run alone only. Recorded honestly; re-derive at phase close.
- WARNING: SC#5's 0.0% is a mechanism proof over 23 deliberately engineered runs, not a rate; SC#3's "was blocked 4 times" did not reproduce locally. Both are stated in VALIDATION itself.
- WARNING: D-r2-02 (Unsourced mark missing in the same tab that followed a Continue run to its end) is deferred; drives on the later build twice showed it present, so it is unproven either way.
- WARNING: bookkeeping not done yet (orchestrator): ROADMAP Phase 295 plan checkboxes and Progress row still read "0/TBD Not started"; REQUIREMENTS RUN-01..04 still `Pending`.
- INFO: Anthropic roster row blocked on billing (not a code defect).
- INFO: SEED-366: the locked step shows the "Must prove it" label beside a choice set that omits Continue; the G-4 pass is the place the operator may find it misleading.

## Human verification required

1. **G-4 operator recognition pass** (295-HUMAN-UAT.md, `status: pending`): run S1 (both homes), S2 (four places), S3 (locked), S4, S6, S7 and the composer-while-paused line. Expected: none of the failure scenarios in the G-4 table is recognised. Why human: G-4 is the operator's own sign-off and cannot be delegated to the agent drives.

## Gaps summary

No ROADMAP success criterion is unmet in code or live evidence. The only live-reproducible defect left is D-r2-02, deferred with a trigger, plus the unrouted BUG-261021-02 (fast-fix to its frontmatter). The G-7 cap is reached; nothing here justifies a round 3.

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier)_

## Re-verification (2026-10-24)

S1-S7 driven PASS (2026-10-21, 295-VALIDATION.md); the Anthropic roster row re-run PASS 2026-10-24 (`84de63beb`); operator signed 2026-10-24 and accepted the known D-r2-02 same-tab display quirk. **Status: passed.**
