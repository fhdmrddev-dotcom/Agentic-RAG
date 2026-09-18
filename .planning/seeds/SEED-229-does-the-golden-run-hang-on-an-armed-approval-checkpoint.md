---
seed_id: SEED-229
title: Does the golden run hang on an armed approval checkpoint? Two pause kinds are handled and a third is unaccounted for
status: planted
planted: 2026-08-28
planted_by: operator question during Phase 214.1 UAT — "how will it pass the golden gate because it will stop anyway"
surface: Agentic-RAG
severity: major
category: unverified risk / publish gate
priority: high
scope: >
  Publish's golden run accounts for exactly two ways a run can pause on a human. The D-19 armed
  governance checkpoint on an external action is neither of them, and whether a golden run hits it
  and hangs is UNTESTED. This seed asks the question; it does not assert the answer.
affected_areas: [backend/app/services/harness/publish_service.py, backend/app/services/harness/grounding.py, backend/app/services/harness_engine.py]
relates_to:
  - SEED-164 / Phase 200.3 (llm_human_input auto-continue during a golden run)
  - D-11 (the ask_user validator disposition)
  - D-19 (the armed action-risk checkpoint)
re_open_trigger: >
  The next phase touching the publish golden run, the approval checkpoint, or external-action
  governance — OR the first report of a publish that never returns.
trigger_when: unset
---

# SEED-229 — two pause kinds are accounted for, and a third is not

## The operator's question

Asked while driving Phase 214.1's UAT, about a workflow with an external `send_email` step:

> *"how will it pass the golden gate because it will stop anyway and the golden gate will not
> proceed — did you consider this case?"*

It is a good question and the answer is **partly yes, and one case is unaccounted for.**

## The two that ARE handled

| Pause | Behaviour at publish | Where |
|---|---|---|
| **`llm_human_input`** step | Golden run **auto-continues** with the first configured choice, or `"Approved"`, gated on `ctx.is_golden_run`. Live runs still pause properly. | `_exec_llm_human_input`; SEED-164 / 200.3 |
| **A validator with `on_failure: "ask_user"`** | **Refused before the run starts**, as an `interactive_phase` verdict — it *would* dead-end the golden run waiting on a human who is not there. | `publish_service._interactive_phase_failures` |

That design is coherent: one kind is answerable automatically, the other is not, so the second is
refused up front rather than allowed to hang.

## ⚠ The third, which neither covers

The **D-19 armed action-risk checkpoint** on an external action — the pause the operator saw in
their own run, rendering *"Approve this step / Do not run it"* with a REASON field.

It is **not** an `llm_human_input` step, so `_exec_llm_human_input`'s golden-run auto-continue does
not apply to it. It is **not** a validator with `on_failure: "ask_user"`, so
`_interactive_phase_failures` does not refuse it. `_interactive_phase_failures`' docstring
enumerates exactly one blocking condition and this is not it.

**So: does a golden run over a workflow with an armed external step reach that checkpoint, and if it
does, does it hang?** Unknown. Three outcomes are all plausible and they need different answers:

1. The golden run never arms the checkpoint (e.g. `live_connectors` off, or `is_golden_run`
   suppresses the guard) — **fine, and worth pinning so it stays true.**
2. It arms and auto-approves like `llm_human_input` — **fine, but then a publish silently approves
   an outbound action, which deserves saying out loud.**
3. It arms and **waits forever** — a publish that never returns.

## Why this is a seed and not a bug

Nothing is known to be broken. What is missing is a **test that says which of the three is true**.
⚠ The operator's own workflow could not reach this question, because it has **zero validators** on
all three phases — so their drive would not have found it either way. That is exactly why it is
written down rather than left to be discovered by a hanging publish.

## The check that closes it

A golden run over a definition with an external action carrying an armed checkpoint, asserting
which of the three outcomes occurs — and, if (2), asserting that the auto-approval is RECORDED,
since an approval nobody gave should never look like one somebody did.
