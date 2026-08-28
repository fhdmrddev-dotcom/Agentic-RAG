---
id: BUG-260828-05
title: The send receipt names the SMTP host instead of the recipient
surface: Agentic-RAG
severity: medium
status: open
folded_into: null
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [backend/app/services/harness/phase_types.py, run-surfaces]
re_open_trigger: n/a — open
---
# "Destination: smtp.gmail.com" answers the wrong question

`workflow_phases['act'].output.text` from a successful send:

```
What this step did
  Action     : Sends an email
  Destination: smtp.gmail.com
  content    : ## Knowledge Base Library — Summary …
```

`smtp.gmail.com` is the **transport**, not the destination. The recipient — the one fact that decides
whether the step did the right thing — appears nowhere in the record, so neither the receipt, the run
log nor an audit can answer *"who was this sent to?"*.

This is the STEP-04 honesty property applied to the argument that matters most on an outbound step.
It also sharpens `SEED-223`: the approval sentence carries recipients while the receipt does not.
