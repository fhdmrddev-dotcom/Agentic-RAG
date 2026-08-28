---
id: BUG-260828-10
title: The golden run supplies no declared inputs, so any argument sourced "Asked when this runs" can never publish
surface: Agentic-RAG
severity: blocking
status: closed
verified_closed_by: 214.1 # ✅ operator-driven 2026-08-28 18:00 — run inputs carried {topic:"test", to:"fhdmrd@gmail.com"} from a library launch
folded_into: null
reported: 2026-08-28
reported_by: operator, driving Phase 214.1's UAT to the structural gate
affected_areas:
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness/reachability.py
  - backend/app/services/connectors/args.py
re_open_trigger: any publish of a workflow whose argument is sourced `ask` that blocks on `no_source` again
relates_to:
  - BUG-260826-01 (⚠ this is now ITS blocker — -01 cannot close while this is open)
  - BUG-260828-02 (the authoring half, closed by 214.1 — this is the half nobody had reached)
  - SEED-228 (same pattern: satisfying one correct gate lands you in front of the next)
---

# The publish reaches the last gate and dies on the argument it was told to ask for

Measured 2026-08-28 17:30, `harness_audit` → `publish_blocked`:

```json
{ "blocked_stage": "structural_gate",
  "named_failures": [{
    "code": "no_source", "phase": "act", "argument": "to", "step_name": "act",
    "message": "step 'act': the required argument 'to' resolved to nothing when the workflow actually ran"
  }]}
```

The golden run itself **succeeded** — all three phases ran, `citations_required` passed, and the
external step correctly recorded rather than sent (*"NOT SENT — recorded only… a record of an
intention, not a receipt"*). Only the structural gate afterwards blocked.

# The cause is one literal, and it is not a bug in the gate

`backend/app/services/harness/publish_service.py:1320` and `:1368` start the golden run with:

```python
inputs={"kickoff_prompt": golden_input},
```

**and nothing else.** Declared inputs are never fabricated. So an argument sourced *"Asked when this
runs"* resolves to nothing during validation — because a golden run has no launcher and nobody to
ask — and the structural gate honestly reports that it resolved to nothing.

⚠ **The gate is right about what it saw.** What is wrong is what it was shown: validating *"does
this argument resolve"* against a run that is structurally incapable of supplying it tests the
harness, not the workflow. The gate can never return anything but `no_source` for this source kind.

# Consequence

**`"Asked when this runs"` is unpublishable for every author.** Phase 214.1 closed the authoring
half — an input can now be declared, and `workflow_definitions.definition.inputs` proves the
declaration persists — but publishing then fails at a gate **nobody had ever reached before**,
because before 214.1 no author could get past the earlier refusal.

⚠ **`BUG-260826-01` therefore does NOT close.** Its `verified_closed_by` must stay `null`: a launch
cannot be driven, because a workflow with a launch-time argument cannot be published.

# The third instance of one pattern, in one evening

| # | Gate | Correct? | Satisfying it caused |
|---|---|---|---|
| 1 | `unbound_retrieval` | yes | binding to a folder |
| 2 | `citations_required` | yes | 0 sources from a 1-document folder |
| 3 | `no_source` (structural) | yes, about what it saw | this bug |

Each gate is individually right. The author experiences three correct refusals and zero publishes.
**That is a system property, not three separate defects**, and it is the thing worth designing
against.

# The fix, as a property

The golden run must supply a **placeholder for every declared input**, exactly as it already
fabricates `kickoff_prompt`. Then `no_source` means what it is supposed to mean: *no source is
declared for this argument*, rather than *no launcher was present*.

⚠ Two things the fix must not do:
- **Do not weaken the gate.** An argument with genuinely no source must still be refused —
  that is `BUG-260826-02`, and it is the reason the gate exists.
- **Do not let a placeholder leave the machine.** The golden run already records instead of sends;
  a fabricated recipient must never become a real one. `live_connectors` being off is not a
  sufficient guarantee to rely on silently — state it where the placeholder is minted.
