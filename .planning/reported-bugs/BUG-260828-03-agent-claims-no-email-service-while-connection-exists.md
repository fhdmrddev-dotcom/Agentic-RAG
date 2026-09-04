---
id: BUG-260828-03
title: The agent wrote "no email service is connected" into a delivered summary while the SMTP connection existed
surface: Agentic-RAG
severity: high
status: closed
folded_into: 214.1
verified_closed_by: 214.1 # ✅ operator-driven 2026-08-29 — library door 00:14 and schedule door 00:19, both carrying `to` on v2
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


---

# ✅ CLOSED 2026-08-29 — the launch half is driven, on both doors that exist

The blocker on this record was never the fix; it was that **no live launch had ever carried a
declared input end to end**. That was driven tonight on `phase 214.1 validation` v2, and read
back out of Postgres rather than off the screen:

| door | run | `workflow_runs.inputs` |
|---|---|---|
| **library** | `2026-08-29 00:14:47` · completed | `{"to": "fhdmrd@gmail.com", "kickoff_prompt": "suumarize "}` |
| **schedule** | `2026-08-29 00:19:18` · completed | `{"to": "fhdmrd@gmail.com", "_schedule_id": …}` |

The schedule run ran all three steps, stopped at its armed approval, was approved, and
**completed** — so the declared recipient reached a real `send_email`, unattended.

⚠ **The value appearing in the form was never the bar.** It is read here off the run row, because
a field that renders and a value that arrives are different facts — that distinction is what
`BUG-260826-01` was about one record over.
