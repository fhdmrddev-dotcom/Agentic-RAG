---
id: BUG-260828-06
title: The email body is delivered as flattened raw markdown
surface: Agentic-RAG
severity: medium
status: open
folded_into: null
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [smtp-adapter, backend/app/services/connectors]
re_open_trigger: n/a — open
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
