---
title: Organisations and row-level security
slug: api/concepts/orgs-and-rls
section: api
audience: developer
status: written
release: shipped
covers: [H42]
summary: >-
  A token sees exactly what its user sees. The database enforces it with row-level security, and
  a miss on someone else's data answers 404, not 403.
reviewed: 2026-10-04
---

The API does not have a separate permission model for scripts. A request sees exactly the data its user could see in the app, because the same rules apply in the database.

## What a token can read

| Scope | Readable by |
|---|---|
| The user's own rows | The user. |
| Folders and skills shared with an organisation | Every member of that organisation. Documents in a shared folder come with it. |
| Built-in platform content (`is_system_global`) | Everyone. Set only by migrations, never through the API. |

Workflow definitions are readable only by the user who created them, plus the built-in starter workflows.

## How it is enforced

Every table that holds user data has row-level security. Most requests reach the database with the caller's own credentials, so the database itself filters out rows the caller may not see — a missing filter in application code cannot widen what comes back. Where the server must use its own service credentials (background ingestion, schedules, workflow definitions), each query is limited to the caller in code.

Search obeys the same rules: document search, keyword search and skill matching return only content the caller may see.

## Sharing through the API

- `PATCH /folders/{folder_id}/toggle-global` and `PATCH /skills/{skill_id}/toggle-global` flip a folder or skill you own between private and shared with your organisation. (The name is historical: "global" now means your organisation.)
- Sharing a skill is refused with `409` and `publish_gate_unmet` until the skill has passed an evaluation, unless the owner explicitly overrides; an override is recorded.
- Only the owner can share or unshare.

## Organisation-scoped endpoints

Endpoints that act inside one organisation read the `X-Org-Id` header and check it against the caller's memberships. Writes to organisation settings need the matching org admin permission. See [Authentication](/docs/api/concepts/authentication#choosing-the-organisation-x-org-id).

## 404, not 403

When you ask for something that exists but is not yours — another user's draft, another organisation's connection, an operator endpoint — the API answers `404 Not Found`. A `403` would confirm the thing exists. `403` is reserved for refusals you are meant to understand, such as a feature hidden from you or a plan that does not include an action. See [Errors](/docs/api/concepts/errors).
