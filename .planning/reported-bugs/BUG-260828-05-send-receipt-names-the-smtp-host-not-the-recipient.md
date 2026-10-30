---
id: BUG-260828-05
title: The send receipt names the SMTP host instead of the recipient
surface: Agentic-RAG
severity: medium
status: folded  # 2026-10-30: fixed in code by 300; live check (300 G4-8) owed until a mail provider exists — 300 closed by decision
folded_into: "300"
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [backend/app/services/harness/phase_types.py, run-surfaces]
re_open_trigger: "A phase whose scope is the external_action receipt or SEED-223. Reviewed at 295 discuss (2026-10-20) and left: RUN-03 changes what the judge is told, not what the receipt records."
verified_closed_by: null  # added 2026-10-30 (302 REG-08): the key was absent; the TEMPLATE requires it
related_seeds: []  # added 2026-10-30 (302 REG-08): absent before
reproduces_on:  # added 2026-10-30 (302 REG-08): the observation commit was not recorded; this is the commit that filed the report
  branch: develop
  commit: de4d7e69c
  date: 2026-08-28
status_note: >
  2026-10-30 (302 REG-08): stays folded -> 300. Fixed in code by 300-03 (D-23, the receipt names the
  recipient). NOT closed: the live check is 300 G4-8 (email step: receipt names the recipient), owed to the
  operator with a real mailbox, and Resend is deferred (300-HUMAN-UAT.md:43). 300 is human_needed.
  Previous status line, verbatim: `status: folded  # 2026-10-29: folded into Phase 300 at discuss-phase (300-CONTEXT.md)`.
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
