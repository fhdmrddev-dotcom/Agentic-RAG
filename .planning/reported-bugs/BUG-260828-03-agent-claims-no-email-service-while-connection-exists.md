---
id: BUG-260828-03
title: The agent wrote "no email service is connected" into a delivered summary while the SMTP connection existed
surface: Agentic-RAG
severity: high
status: folded
folded_into: 214.1
verified_closed_by: null   # ⚠ NOT closed — the LAUNCH half was never driven live
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [backend/app/services/harness/phase_types.py, agent-honesty]
re_open_trigger: n/a — open
---
# The model invented a capability refusal that was false, and it was delivered

During the G-4 drive the `write-summary` phase produced, inside the summary body:

> **Note:** The requested email could not be sent because no email service is connected to this
> workspace; this summary is delivered here as text instead., subject: Library summary.

Every clause is false:

- `connector_connections` holds **`Email (SMTP)` / `service_id: smtp`** (`f7884ce6-…`).
- The very next phase (`act`) then **sent successfully** — `accepted for delivery by smtp.gmail.com`.

The model asserted a missing capability it had no way to check, and the claim was carried into the
delivered email body AND into the approval sentence the operator was asked to approve.

## Why this is worse than a wrong sentence

1. It reached a **recipient**, not just a screen.
2. It appeared **inside the approval pause**, so the human gate was asked to approve text containing
   a false statement about the system's own configuration.
3. A reader who believes it goes looking for a connection that is already there.

## The shape of the fix

The model must not be the source of truth for whether a service is connected — that is a lookup, not
a generation. Either the prompt withholds the invitation to speculate, or the emitted text is checked
against the real connection set before it can be approved or sent. Prompting alone is already
measured insufficient one surface over: STEP-06 enforces its vocabulary on the emitted definition
rather than by asking for it.
