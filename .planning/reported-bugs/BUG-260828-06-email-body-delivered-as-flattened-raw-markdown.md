---
id: BUG-260828-06
title: The email body is delivered as flattened raw markdown
surface: Agentic-RAG
severity: medium
status: folded  # 2026-10-30: fixed in code by 300; live check (300 G4-8) owed until a mail provider exists — 300 closed by decision
folded_into: "300"
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [smtp-adapter, backend/app/services/connectors]
re_open_trigger: n/a — open
verified_closed_by: null  # added 2026-10-30 (302 REG-08): the key was absent; the TEMPLATE requires it
related_seeds: []  # added 2026-10-30 (302 REG-08): absent before
reproduces_on:  # added 2026-10-30 (302 REG-08): the observation commit was not recorded; this is the commit that filed the report
  branch: develop
  commit: de4d7e69c
  date: 2026-08-28
status_note: >
  2026-10-30 (302 REG-08): stays folded -> 300. Fixed in code by 300-03 (D-24, rendered markdown with line
  breaks). NOT closed: the live check is 300 G4-8 (email step: rendered markdown), owed to the operator with
  a real mailbox, and Resend is deferred (300-HUMAN-UAT.md:43). 300 is human_needed.
  Previous status line, verbatim: `status: folded  # 2026-10-29: folded into Phase 300 at discuss-phase (300-CONTEXT.md)`.
---
# The recipient receives source, not a document

Recorded content of a successful send:

```
## Knowledge Base Library — Summary ### Folder organization - The library root has **12 top-level
folders** plus about **30 loose documents** directly at the root. - Folders cover several purposes: …
```

Two separate faults:

1. **Markdown is sent as literal source** — the recipient sees `##`, `**` and backticks.
2. **The structure is flattened onto one line** — headings and list items lost their newlines, so it
   does not even read as plain text.

The agent produces markdown by design; the adapter should render it (HTML body with a plain-text
alternative) rather than pasting it. Fixing (2) without (1) still delivers visible syntax.
