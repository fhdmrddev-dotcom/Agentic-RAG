# Phase 134: Eval Results, Honest Verdict + Ratings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 134-eval-results-honest-verdict-ratings
**Areas discussed:** Cross-provider baseline bug routing, Verdict engine, What's graded, Ratings shape
**Mode:** interactive (AskUserQuestion, grounded recommendations) — at user's explicit request

---

## Cross-provider baseline bug routing (mandatory reported-bugs cross-check)

Two open `surface: Agentic-RAG` bugs break the WITHOUT-skill baseline arm on newer models —
BUG-260701-01 (assistant-prefill 400 on claude-sonnet-5 / Claude 4.6+5) + BUG-260630-01
(DeepSeek reasoning_content 400). Both live in the shared agent-loop/gateway path; SEED-100
already exists as their dedicated phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Defer both to SEED-100 | 134 surfaces honestly ("baseline errored — not computable"); fixes land in SEED-100 (shared-path/D-14 → own full-roster SC#10 pass); keeps 134 net-new-only | ✓ |
| Pull sonnet-5 fix forward | Fix BUG-260701-01 alongside 134 (newest-model priority); still a shared-loop change needing its own cross-provider check | |
| Fold both fixes into 134 | Fix both inside this phase; 134 stops being net-new-only, edits the shared path mid-eval-phase | |

**User's choice:** Defer both to SEED-100 (Recommended).
**Notes:** Both bug reports re-routed to `status: deferred` with SEED-100 `re_open_trigger`s.
134 surfaces the errored arm honestly (CONTEXT D-04/D-11). BUG-260701-01 trigger also re-opens
if the prefill 400 reproduces in Deep/Explorer chat (shared-loop, not eval-only).

---

## Verdict engine — what computes pass/fail

Test cases store a free-text `expected_behavior` (migration 079 — NOT a code assertion), so
something must grade each answer.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the LLM judge | Reuse `validator_kinds.py` (resolve_judge_model + forced, schema-bound JudgeVerdict); adapt rubric to "did this answer show the expected behavior?"; gives 136/135 their automated "passed"; fixed judge model, never the provider under test | ✓ |
| Human marks pass/fail | You read the side-by-side and mark it; simpler, but 136/135 can't automate and EVAL-03 says the run "produces" the verdict | |
| Heuristic, no judge | Mechanical check (errored? differs from baseline?); cheap but hollow pass/fail | |

**User's choice:** Reuse the LLM judge (Recommended).
**Notes:** CONTEXT D-01/D-03/D-04. Independent judge model via `resolve_judge_model`; errored
arms carry `not_measured`, never a fabricated score.

---

## What's graded — one arm or both

| Option | Description | Selected |
|--------|-------------|----------|
| Grade both arms | Judge with-skill AND without-skill vs expected behavior → with=pass / without=fail; best SI-01 signal + cleanest A/B; 2 judge calls/case | ✓ |
| Grade with-skill only | Only with-skill scored; without-skill stays an unscored baseline; cheaper, but "did it help?" left to the eye | |
| Comparative better/worse | One better/same/worse judgment; good for "did it help" but no absolute "passed" the publish gate needs | |

**User's choice:** Grade both arms (Recommended). Preview confirmed (side-by-side with=PASS /
without=FAIL, "Run verdict: 4/5 with-skill passed").
**Notes:** CONTEXT D-02.

---

## Ratings shape + SI-01 signal (EVAL-04)

Migration 080 already reserved "Phase 134 ratings FK eval_results.id".

| Option | Description | Selected |
|--------|-------------|----------|
| Per-answer, new table | New eval_ratings table (mig 081); one thumb per individual answer (eval_result row), re-ratable, owner-scoped, backend endpoint; 135 joins to version+case+verdict; gold signal = thumbs-down on a judge-PASSED answer | ✓ |
| Per-case preference | Rate the case (prefer with vs without); simpler, loses single-answer rating + human-vs-judge disagreement signal | |
| Column on eval_results | Add a column instead of a table; rejected — eval_results is service-role-write-only/append-only | |

**User's choice:** Per-answer, new table (Recommended).
**Notes:** CONTEXT D-08/D-09. Minimal row `(id, eval_result_id, user_id, rating, created_at,
updated_at)`; 135 does the joins.

---

## Claude's Discretion

- Exact verdict/rating column + enum names; the eval rubric prompt text (adapt `JUDGE_RUBRIC_CORE`
  to `expected_behavior`, keep anti-injection — expected_behavior as DATA not instruction).
- Reuse `_validate_llm_judge_rubric` directly vs a thin eval-specific judge wrapper around
  `resolve_judge_model` + the forced `JudgeVerdict` schema.
- Judge calls sequential vs concurrent per case; the verdict SSE event shape (additive on `eval_*`).
- The rollup boolean rule within D-07's honest-count framing (publish threshold owned by Phase 136).

## Deferred Ideas

- Cross-provider baseline-arm hardening (BUG-260701-01 + BUG-260630-01) → SEED-100.
- Designed/role-gated/plain-language Skill Evals panel → Phase 137 (PANEL-01, G-2) + SEED-100/099.
- Publish pass/fail threshold → Phase 136 (GATE-01).
- Re-grade without re-running; multi-provider verdict in one run → later, additive.
- Reviewed-not-folded: `spike-nl-workflow-authoring` todo (keyword-only match; already satisfied in Phase 103).
