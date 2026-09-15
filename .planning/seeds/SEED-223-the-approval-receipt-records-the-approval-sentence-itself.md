---
seed_id: SEED-223
title: "The governance approval receipt writes the approval SENTENCE into `metadata[\"finding\"]` — D-213-14's *shown once, recorded never* holds for the send receipt and FAILS for the approval receipt, and Phase 214 widened what that sentence contains"
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, from plan `214-06`'s threat-model row `T-214-06-03`, which it recorded as PARTIAL rather than mitigated
surface: Agentic-RAG
severity: major
category: governance / information disclosure
priority: high
scope: >
  ONE assignment, and an operator decision about what a governance ledger is for. The receipt is
  the audit record of an armed checkpoint; the question is whether its `finding` may carry the
  argument values the pause displayed, or must carry only a reference to them.
affected_areas: [backend/harness, workflows/approval, admin/control-room, observability]
related_seeds: []
related_bugs: [BUG-260828-01]
relates_to:
  - backend/app/services/harness_engine.py — `_resolve_failure_with_ask_user`
  - backend/app/services/harness/publish_service.py — `_write_send_receipt`, which DOES obey D-213-14
  - .planning/phases/214-a-step-names-its-service-and-its-action/214-06-SUMMARY.md — T-214-06-03
re_open_trigger: >
  ⚠ ALREADY TRUE AT PLANTING, and PRE-EXISTING SINCE PHASE 187 — but Phase 214 changed its blast
  radius, which is why it is planted now rather than left. Re-open at whichever comes first:
  (1) THE NEXT OPERATOR CONVERSATION ABOUT THE AUDIT LEDGER — this is a decision, not a bug, and
  it must be settled `--to operator`, never agent-to-agent; (2) any phase whose `files_modified`
  names `harness_engine.py`'s approval path; (3) any phase that widens what an approval pause
  DISPLAYS — every such phase silently widens what this receipt RECORDS; (4) before
  `live_connectors` is flipped on for anyone, since a real outbound send makes the recorded
  sentence a record of real recipients.
trigger_when: unset
---

# SEED-223: the approval receipt records the sentence it was only supposed to show

## What was measured

`214-06` drove `T-214-06-03` (*an argument value in the ledger*) and reported it **PARTIAL**, not
mitigated. The measurement:

- The `action_risk_pending` row carries `{phase, timing}` and nothing else. ✅
- `_write_send_receipt`'s key set is AST-derived and unchanged. ✅
- **`_resolve_failure_with_ask_user`'s governance receipt writes `metadata["finding"] =
  error_message`** — and for an ARMED checkpoint, that string is **the entire approval sentence**. ❌

So **D-213-14's *"shown once, recorded never"* holds for one receipt and fails for the other.**

## Why it matters, and why now

⚠ **It is pre-existing since Phase 187 — and Phase 214 WIDENED its content.** Before this phase the
approval sentence was thin. After it, the sentence names the service, the action and **all three
arguments**, including one supplied by the LAUNCHER at run time and one produced by an LLM in an
earlier phase. The same assignment now records launcher-supplied and model-produced text into a
governance ledger that was designed to record that an approval happened, not what it said.

⚠ **The improvement and the exposure are the same change.** `BUG-260828-01` asked for the pause to
name the service and list its arguments; that is exactly what now lands in `finding`. Reverting the
disclosure would revert the fix, which is why this is an operator decision and not a defect to
auto-fix under Rule 2.

⚠ **`live_connectors` is still `off`, and that is load-bearing.** While it is off, the arguments in
the recorded sentence are for a *record, do not send* path. **The day it is flipped, this receipt
begins recording real recipients** — so this seed should be settled before that flip, not after.

## What the decision is

Three shapes, for an operator to choose between:

1. **Record a reference, not the text** — `finding` carries the phase id and a pointer; the sentence
   stays in the pause and dies with it. Strictest reading of D-213-14.
2. **Record a redacted sentence** — service and action named, argument VALUES elided. Keeps the
   ledger legible for an auditor asking *what was approved* without keeping the payload.
3. **Record it verbatim, deliberately** — and say so in D-213-14, so the rule stops being quoted as
   *shown once, recorded never* while one of its two receipts does the opposite.

⛔ **Phase 214 took none of them.** It bounded and pinned the behaviour and recorded it as an open
finding, because choosing between these three is a governance decision.
