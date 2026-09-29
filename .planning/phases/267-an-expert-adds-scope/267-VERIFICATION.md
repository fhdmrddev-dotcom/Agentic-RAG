---
phase: 267-an-expert-adds-scope
verified: 2026-09-29T00:00:00Z
verification_mode: self-verified   # independent review was fresh-context but the SAME model family; not a different-vendor or human review
status: passed
score: 8/8 roadmap-level truths verified; 0 human items owed; 1 known Critical (CR-01) deferred by decision
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 8/8 with 4 owed
  gaps_closed:
    - "Independent review owed -> ran (267-REVIEW-INDEPENDENT.md, 3C/8W/5I), fresh-context subagent"
    - "Operator G-4 confirmation owed -> recorded verbatim 'all pass' (267-UAT-LOG.md)"
    - "Member-view catalog requires-state never driven in Chrome -> driven (evidence/g4-07-catalog-requires-member-view.png)"
    - "F-4 undiagnosed -> root cause identified from code + captured request: CR-01 / SEED-327 (exact failing first-attempt cap still unmeasured)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "CR-01 — forced_emit's system prompt is dropped by the OpenAI-compat and Responses adapters (6 of 8 providers), so the handoff summariser (SC#4) can 502 on those providers"
    addressed_in: "SEED-327 (planted, not scheduled)"
    evidence: "SEED-327 exists, status: planted, trigger_paths name forced_emit.py / openai_compat.py / openai_responses.py / threads.py"
  - truth: "WR-01..08 / IN-* items from the independent review"
    addressed_in: "SEED-328"
    evidence: "SEED-328-phase-267-review-warnings-deferred.md exists"
  - truth: "CR-03(b)"
    addressed_in: "deferred (recorded in 267-FIX-CR02-CR03-LIVE.md)"
    evidence: "not fixed; (a)(c)(d) fixed and live-driven"
  - truth: "Exact first-attempt cap that makes F-4 fail"
    addressed_in: "unmeasured; folds into SEED-327 fix"
    evidence: "root cause found by code reading, not by reproduction"
---

# Phase 267: An Expert Adds Scope — Re-Verification Report

**Phase Goal:** Inviting an Expert only ever adds to what a thread can do, and whenever an Expert costs the user something or changes scope, the product says so before or as it happens.
**Status:** passed (self-verified)
**Re-verification:** Yes — previous status `human_needed`, 4 owed items.

## Changes since last run

1. Independent review ran: `267-REVIEW-INDEPENDENT.md` (3 Critical / 8 Warning / 5 Info). Fresh-context, but same model family as the builder — treat as a second look, not a different-vendor review.
2. CR-02 and CR-03 (a)(c)(d) fixed (a95a19881, 0cbf5d282, f54c5284c), live-driven against a restarted backend: `evidence/cr02-cr03-live-drive.txt` carries four `VERDICT: PASS` lines (D1–D4).
3. Member-view catalog requires-state driven in Chrome; `evidence/g4-07-catalog-requires-member-view.png` exists.
4. Operator G-4 confirmation recorded verbatim `all pass` (UAT-LOG line ~361). It covers G4-1/2/3 only; O-1 and SEED-327/328 were disclosed and are explicitly NOT waived by it.
5. F-4 root cause attributed to CR-01 (SEED-327).

## Re-derived evidence (this run)

| Check | Result |
|---|---|
| `pytest` 267 + 266 + 268 unit files, `test_sql_scope_or_precedence.py`, `test_075_1_observability.py` (from `backend/`, venv) | 470 passed, 0 failed |
| CR-02 fix line `effective_folder_ids = _scope.effective_folder_ids or None` | present, `run_producer.py:589` |
| CR-03: `insert_expert_changed_row` | present, `expert_scope.py:388` |
| CR-03: `is_enabled` guard in experts GET | present, `experts.py:592` |
| CR-03: snapshot states `active_expert_id` | present, `threads.py:640, 701` |
| Live-drive VERDICT lines | 4 x PASS (D1 shows expert-scoped thread searched only its folder set, control thread searched all) |
| SEED-327 / SEED-328 | both exist; SEED-327 `status: planted` |
| `node scripts/check-seeds-register.cjs` | OK — 335/335 parsed, 0 duplicate ids |

I did not re-run the frontend suites, the backend baseline gate (71-ceiling), or the RLS integration test this pass; those stand on the earlier verification.

## Truths

All eight truths from the prior report (SC#1–5, RLS write fence, closed-core 7/1/29/2, review fixes) remain VERIFIED; the test re-run and code confirmations above show no regression. SC#3/SC#5 gain additional live evidence from the CR-02/CR-03 drive.

## Deferred / inherited (legitimately open, none needs a human to close phase 267)

- **CR-01 / SEED-327 (Critical, unfixed).** The handoff summariser's forced-emit instructions never reach 6 of 8 providers. SC#4 is verified live on deepseek (201 on retry) and F-4 was a 502 there; the roster-wide handoff reliability is therefore NOT proven and is likely poor on the affected providers. This is a real known defect in 267-owned behaviour, accepted as a deferral by operator decision. Note the tension: if the operator reads SC#4 as "works on every provider", this is unmet and warrants `/gsd:fast`-class or G-7 triage rather than silence.
- **SEED-328**: WR/IN items accepted.
- **CR-03(b)**: deferred.
- **F-4 exact cap** unmeasured.
- BUG-260929-01 closed.
- Prior IN-01/03/04/05/07/08 deferrals stand.

## Gaps Summary

No must-have truth failed and nothing owed to a human remains. Status is `passed` with the CR-01 caveat above stated plainly, not padded away.

_Verifier: Claude (gsd-verifier), self-verified_
