---
seed_id: SEED-137
title: "The engine-appended armed action-risk gate can be preempted by an author-declared pre-gate that fails first — run_gates returns on the first failure and an ask_user Proceed falls through to the body without re-running the remaining pre-gates, so the armed approval is never asked and action_risk_pending is never emitted"
status: folded
planted: 2026-07-31
folded: 2026-07-31
phase_origin: "Phase 185 security re-audit (/gsd:secure-phase 185, second pass after quick task 260731-3y4 closed BLOCKER T-185-04-01). Surfaced by the auditor while adversarially probing whether the new armed allow-list could be reached with is_action_risk False. Deliberately NOT folded into 185: the phase's registered threat is closed, this is a distinct structural weakness in gate PRECEDENCE, and the durable fix touches the attachment seam (D-185-05) rather than the disposition."
folded_into: 187
category: "Governance enforcement / gate precedence — the armed checkpoint's guarantee is positional, not structural. Not currently exploitable (two upstream gates fence it), but the fence is a publish-time refusal that is explicitly slated for relaxation, and when it relaxes this becomes a silent governance bypass with no audit trace."
related_seeds: [SEED-131, SEED-132]
related_decisions:
  - "D-185-05 (185-CONTEXT.md) — the engine's gate spec is APPENDED, never substituted: `[*phase.validators, *extra]` at `backend/app/services/harness/grounding.py:951-953`. Append-not-substitute is what makes a weak author spec unable to DISPLACE the engine's gate (verified as T-185-03-01, still true). This seed is the other half of the same design: appending guarantees the engine's gate cannot be REPLACED, but it does not guarantee the engine's gate is ever REACHED, because run_gates short-circuits on the first failure."
  - "D-185-12/13 — `action_risk_approval` always 'fails' precisely so the shipped ask_user disposition owns the wait. That is why the armed gate is a validator at all; it also means it competes for the same first-failure slot as every other pre-gate."
  - "T-185-04-01 (185-SECURITY.md) — the BLOCKER this re-audit closed. Distinct defect: that one was a decline READ AS a proceed. This one is the armed gate never being ASKED. The allow-list fix does not and cannot address it (the allow-list is gated on `is_action_risk`, which is False on this path)."
  - "D-14 / the byte-identity discipline — any fix must not change routing for workflows that carry no armed phase."
confirmed:
  - "Attachment is an append. `backend/app/services/harness/grounding.py:951-953` builds `[*phase.validators, *extra]`, so the engine's armed spec lands at the END of the validator list."
  - "run_gates returns on the FIRST failure. `backend/app/services/harness/validators.py:230` enumerates the full list but returns the first failing GateResult, so a validator earlier in the list preempts everything after it."
  - "An ask_user Proceed falls through WITHOUT re-running the pre-gates. `backend/app/services/harness_engine.py:694-739`: `pre = await run_gates(phase, ..., timing='pre')` runs ONCE; on `outcome is None` the comment reads `# outcome is None → ask_user Proceed: fall through and run the body.` The remaining pre-gates — including the appended armed spec — are never evaluated."
  - "The armed branch is keyed on the finding, not on the phase. `harness_engine.py:706` (`_is_action_risk_finding(pre.error_message)`) and `:1194` (`is_action_risk`) both read the `action_risk:approval|` prefix off whichever validator failed FIRST. When an author-declared validator owns the failure, `is_action_risk` is False on both call sites."
  - "Reproduced by the auditor against the REAL `_run_phase_with_gates`, REAL `run_gates` and REAL `grounding.effective_phase`, with effective validators `[('regex_match','pre','ask_user'), ('action_risk_approval','pre','ask_user')]`: answering 'no' (and 'Proceed anyway') yielded `outcome: completed`, `BODY RAN: True`, events `['gate_failed', 'ask_user_prompt']`, and the options shown were `['Proceed anyway', 'Abort']` — the armed pair was NEVER presented and `action_risk_pending` was NEVER emitted."
  - "The fence is real. `backend/app/services/harness/publish_service.py:464-503` (`_interactive_phase_failures`) blocks publish for any phase carrying an author-declared validator with `on_failure == 'ask_user'` (or `phase_type == 'llm_human_input'`), and `workflow_kickoff.py:205-219` refuses to kick off anything not `status='published'`. Reaching the bypass today requires a direct DB write to `workflow_definitions`."
  - "The fence is explicitly slated for relaxation. `publish_service.py:478-479` docstring: 'The full background-job publish that COULD validate interactive phases (a human subscriber, a durable resume) is the DEFERRED Phase-103 rework — out of scope here.' That rework's whole purpose is to let interactive phases through publish."
needs_confirmation:
  - "Which fix shape. Option A — graft the armed spec at index 0 (`[*extra, *phase.validators]`) so it always fails first. Cheapest, but it INVERTS D-185-05's ordering guarantee for the grounding gate, whose append-at-end position is load-bearing for T-185-03-01 (a weak author spec passes at index 0 and the real gate still runs at index N). The two appended specs may need different positions, which means the attachment seam stops being one uniform append. Option B — re-run the remaining pre-gates after an ask_user Proceed, so a proceed resumes gate evaluation instead of skipping to the body. More faithful to 'every declared gate is asked', but changes control flow on a path shared with non-armed workflows and needs a re-entrancy story (a validator that already paused must not pause twice). Option C — hoist the armed check out of the validator list entirely into an explicit pre-body checkpoint keyed on `spec.action_risk_armed`, leaving the validator only as the finding producer. Most structural, most work. Decide with the D-185-05 index assertion (`test_185_engine_attachment.py:153-165`) open in front of you — whatever ships must keep it green."
  - "Whether `validator_index` accounting stays correct under the chosen fix. T-185-03-03 accepted a doubled gate row on hand-strict steps on the basis that `run_gates` enumerates the full list and the spec is appended. Re-ordering or re-running changes that arithmetic; the audit trail must not start naming the wrong validator."
  - "Whether the same precedence hazard applies to the appended `citations_required` grounding gate (GOVERN-01/02), not just the armed one. The grounding gate is a `timing='post'` concern and the reproduction above is `timing='pre'`, so it likely does not — but confirm rather than assume, because both specs ride the same append."
re_open_triggers:
  - "PRIMARY — the deferred Phase-103 background-job publish ships, or `_interactive_phase_failures` (`publish_service.py:464-503`) is relaxed in any way that lets an author-declared `on_failure='ask_user'` validator through publish. That single change converts this from latent to live, and it is a change the codebase already intends to make."
  - "Any new code path that can set `workflow_definitions.status='published'` without going through `publish_service`'s gauntlet — a seed/fixture script, an admin override, a migration that flips status, or an import path."
  - "Phase 188's run surface adds a consumer for `action_risk_pending` (harness_engine.py:721 already names Phase 188 as THE CONSUMER). The moment an operator-visible surface promises 'this step is waiting for a person', a phase that silently skips the armed pause becomes a visible honesty defect, not just a latent one."
  - "Any phase that makes the armed dial available on a phase type that already carries author-declared pre-gates, or that lets authors add validators to an armed phase through the canvas — the canvas currently has no such affordance, which is part of why this is Low today."
  - "Any proposal to change the attachment order at `grounding.py:951-953`. If someone reaches for that seam for an unrelated reason, this seed's Option A is already half-done and should be decided deliberately rather than as a side effect."
priority: medium
suggested_phase: "**FOLDED INTO PHASE 187 as SC#6 on 2026-07-31** (operator direction: plan it ahead, land it in any phase before 188). Originally suggested for 188 alongside the `action_risk_pending` consumer; the operator moved it EARLIER deliberately. Phase 187 is the right home on merit, not just on timing: its SC#3 claims the AI seed is 'safe-by-construction' and that a seeded grounded node auto-gets its gate — this seed is precisely the case where a governance gate is silently NOT applied, so shipping 187's claim over an unfixed precedence bypass would make that claim false in the one direction that matters. Phase 186 (Concurrency & Autosave) was the alternative on earliest-lands grounds and was NOT chosen: folding a governance-precedence fix into an autosave phase is off-topic scope-add, and there is no race between 186 and 187 because the re-open trigger (the Phase-103 background-job publish) is not scheduled in this milestone at all."
---

# SEED-137 — the armed checkpoint's guarantee is positional, not structural

## The gap

Phase 185 shipped an armed action-risk checkpoint: an author flips a switch on a phase and a
person must approve before that step runs. The enforcement is an engine-synthesized validator
appended to the phase's validator list at `grounding.py:951-953`.

Appending is deliberate and correct for the threat it was designed against — D-185-05 —
**an author cannot write a weak spec that DISPLACES the engine's gate**, because the engine's
spec runs after theirs regardless. That property is real and still verified (T-185-03-01).

But appending guarantees the engine's gate cannot be *replaced*. It does not guarantee the
engine's gate is ever *reached*:

| Step | Location | Behaviour |
|---|---|---|
| The armed spec lands last | `grounding.py:951-953` | `[*phase.validators, *extra]` |
| Gates return on the first failure | `validators.py:230` | anything earlier preempts everything later |
| An ask_user Proceed skips the rest | `harness_engine.py:737-739` | `# outcome is None → ask_user Proceed: fall through and run the body.` |
| The armed branch reads the *failing* finding | `harness_engine.py:706`, `:1194` | `is_action_risk` is False when someone else failed first |

So an author-declared `timing="pre"` validator with `on_failure="ask_user"` that fails first
**owns the pause**. The person is shown that validator's choices, not the armed pair. Answering
proceed falls through to the body. The armed approval is never asked, `action_risk_pending` is
never emitted, and there is no ledger row saying the checkpoint was skipped.

Reproduced against the real engine, real `run_gates` and real `grounding.effective_phase`:

```
effective validators : [('regex_match','pre','ask_user'), ('action_risk_approval','pre','ask_user')]
answer               : "no"          (also reproduces with "Proceed anyway")
outcome              : completed
BODY RAN (risky step): True
events               : ['gate_failed', 'ask_user_prompt']
options shown        : ['Proceed anyway', 'Abort']      <-- the armed pair NEVER shown
```

## Why this is NOT T-185-04-01 again

T-185-04-01 (closed by quick task `260731-3y4`, commit `417728bd`) was a **decline read as a
proceed**: the armed gate ran, asked correctly, and then mis-classified a typed refusal. The fix
was an allow-list on the armed disposition.

This is the armed gate **never being asked**. The allow-list cannot help, because it is gated on
`is_action_risk` — which is False on this path by construction. The two findings share a phase and
a component and nothing else; conflating them would make the closed one look reopened and this one
look already handled.

## Why it is Low today, and exactly what changes that

Two upstream gates that were not designed for this fence it off:

1. `publish_service.py:464-503` refuses to publish any phase carrying an author-declared
   `on_failure == "ask_user"` validator — the precise shape needed to preempt.
2. `workflow_kickoff.py:205-219` refuses to run anything not `status='published'`.

Reaching the bypass today needs a direct DB write to `workflow_definitions`. That is a real fence
and it is why this is a seed rather than a blocker.

It is also a fence the codebase has already announced it will remove. From
`publish_service.py:478-479`:

> The full background-job publish that COULD validate interactive phases (a human subscriber, a
> durable resume) is the DEFERRED Phase-103 rework — out of scope here.

That rework exists specifically to let interactive phases through publish. When it lands, the
only thing holding this closed goes away — and nothing in the harness will notice, because the
bypass produces no distinguishing audit event. **The fix should land before that rework, not after.**

## The design tension the fix has to resolve

The obvious fix — graft the armed spec at index 0 so it always fails first — collides with the
reason the append exists. T-185-03-01's guarantee is that a deliberately weak author spec
(`mode: presence, min_markers: 0`) passes at index 0 and **the engine's real gate still runs at
index N**, asserted at `test_185_engine_attachment.py:153-165`. Move the engine's spec to the
front and that assertion's shape changes.

It may be that the two appended specs want different positions — the armed checkpoint first
(nothing should be allowed to preempt "a person decides"), the grounding gate last (nothing
should be allowed to satisfy it early). If so, the attachment seam stops being one uniform append
and that is a decision worth making deliberately, with the index assertion open, rather than
discovering it mid-implementation.

## How we would know this is closed

1. A test builds a phase with `action_risk_armed: True` AND an author-declared `timing="pre"`,
   `on_failure="ask_user"` validator, drives it through the **real** `_run_phase_with_gates`, and
   asserts the armed pair (`["Approve and run this step", "Do not run it"]`) is what the person is
   shown — regardless of validator order in the authored definition. This test must be observed
   **RED** against today's code before it is trusted; the reproduction above is the expected
   failure.
2. A second test asserts `action_risk_pending` IS written for that phase. Today it is not — that
   missing row is the audit-trail half of the bypass, and it is what would make the skip invisible
   in the ledger even if someone went looking.
3. Answering the armed pair with anything but the exact approve label still routes to `fail_run`
   with zero `validator_ask_user_approved` receipts — i.e. T-185-04-01's allow-list is now
   genuinely reachable on this path, not dead code.
4. `test_185_engine_attachment.py:153-165` (the D-185-05 index assertion) is still **green**, or
   has been deliberately and visibly re-shaped with the reasoning recorded. A fix that quietly
   retires append-not-substitute has traded one governance property for another.
5. Workflows with no armed phase route byte-identically — a positive control proves the fence
   would notice if they didn't.
