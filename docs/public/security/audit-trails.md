---
title: Audit trails
slug: security/audit-trails
section: security
audience: user
status: written
release: shipped
covers: [A38, settings-tab:audit-log]
summary: >-
  Syrel records what happens at three levels — your own activity, your organisation's, and the
  whole platform's — plus a step-by-step record of every workflow run and every outside call.
reviewed: 2026-10-04
---

Syrel writes an audit record as things happen. Records are insert-only for users: nobody can edit or delete an entry from the app.

## Your own activity

The **Audit Log** tab in Settings lists your own actions: document uploads and deletes, searches (with the query and the documents it returned), code runs, skills loaded, chats created and deleted, settings changes, and more. Filter by date range (all, 7, 30 or 90 days) and by action type, and export the filtered view as CSV.

> **Note:** Settings appears in the rail for people with model management, which is platform operators by default. If you do not see Settings, ask your administrator.

## Your organisation's activity

Organisation admins have an **Audit** tab in the org admin area showing what happened inside the organisation.

## The whole platform

Platform operators have an audit browser in the Control Room over two ledgers:

- **Operator actions** — every action taken in the Control Room, such as stopping a run, flipping a kill switch or changing who sees a feature. This ledger is append-only.
- **Platform activity** — activity across the deployment.

Both can be filtered, and exporting a CSV is itself recorded.

## Workflows and outside calls

- **Workflow runs.** Every move from one step to the next, every check result and every refused tool call is written to an insert-only audit trail.
- **Connection calls.** Each call through a connection leaves a receipt naming the connection, the destination host, the tool and the result. Each chat message records which connections were active when it was sent.
- **Expert and scope changes.** Swapping an Expert, handing off to another Expert, or changing a chat's folder scope writes a note into the chat that stays there after reload.
- **Document corrections.** A person's correction to a document's details is recorded and marked as made by a person.

## What is not available

Per-organisation retention and legal hold are not available today; the Retention tab in org admin is shown as coming soon.

## Related

- [How your data is isolated](/docs/security/data-isolation)
- [What Syrel can reach](/docs/security/egress-controls)
