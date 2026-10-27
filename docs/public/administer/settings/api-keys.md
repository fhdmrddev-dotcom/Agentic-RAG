---
title: API keys settings
slug: administer/settings/api-keys
section: administer
audience: user
status: written
release: shipped
covers: [settings-tab:api-keys]
summary: >-
  The API keys tab lets you make a key so another system, such as n8n or a script, can start
  your published workflows and read their results. You pick the workflows and the expiry, copy
  the secret once, watch each key's calls, and revoke it at any time.
reviewed: 2026-10-25
---

**Settings → API keys** is where you make a key so another system, such as n8n, Zapier or a script, can start your published workflows and read back what they produced. Every member has this tab.

## Make a key

Choose **New key**, then:

| Field | What to put |
|---|---|
| Label | A name you will recognise in logs, such as `n8n-prod`. It must be unique among your active keys. |
| Workflows | Tick the published workflows the key may start. Only your own published workflows are listed, with their launch fields beside each. A workflow that needs a file upload at launch is shown disabled: a key cannot send a file yet. |
| Expires | 30 days, 90 days (the default), 365 days or Never. |

**Runs as you.** A run started with your key is your run. It uses your access, appears in your chat history and counts against your organisation's plan.

A key starts the exact version of each workflow you ticked. Publishing a new version later does not move the key to it; make a new key for the new version.

You can also start from a workflow card: its **⋯** menu has **New API key…**, which opens this tab with that workflow already ticked.

## Copy the secret once

When the key is made, the card shows its secret (`srl_live_…`), a ready-to-paste `curl` command that starts the workflow, and one that reads the run's status. **This is the only time the secret is shown.** Syrel stores only a one-way digest of it, so it cannot be shown again. Copy it into your secret store, then choose **I've saved the secret**.

In the start command only the input values are placeholders; the address, the workflow id and the field names are already filled in. The full round trip is in [Start a workflow from outside](/docs/api/guides/start-a-workflow-from-outside).

## Watch a key

Each key card shows:

- its state: **active**, a warning when one of its workflows can no longer be started (for example it was unpublished or deleted), **expired** or **revoked**;
- its workflows, with any that can no longer be started marked;
- when it expires, when it was last used and when it was made;
- a strip of its last calls, and **Show activity** for the last 30 days: each start and read, the run it touched, and, for a refused call, the reason (for example "over the limit: 10 starts a minute").

Every call is also in the audit log, under **API keys**.

## Revoke a key

Choose **Revoke** on the card and confirm. The next call with that key is refused. Runs it already started keep going in the app, but the outside system can no longer read their results. Revoking can't be undone; a replacement is a new key with a new secret. A revoked key stays listed, dimmed, with who revoked it and when.

Organisation admins can see every member's keys, with their owners, and revoke any of them in **Org admin → API keys**.

## Limits

Each key may start 10 runs a minute and read 120 times a minute by default. The line under the tab's title shows the limits in force. An operator changes them in **Settings → Integrations**.

## Related

- [Authentication](/docs/api/concepts/authentication)
- [Start a workflow from outside](/docs/api/guides/start-a-workflow-from-outside)
