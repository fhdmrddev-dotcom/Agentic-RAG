---
seed_id: SEED-233
title: "`connector_tokens` has RLS ENABLED and ZERO POLICIES, so every user-JWT read of it returns empty — the OAuth token endpoint 404s on rows that exist"
created: 2026-09-01
planted_during: Phase 221 plan 02 — while wiring the per-application availability probe onto the Check action
status: fixed_local_only
folded_into: 222
surface: Agentic-RAG
severity: high
category: security / data-access / shipped-endpoint-broken
priority: high
relates_to:
  - reference_connector_connections_column_grant_trap (memory) — the SAME family, one table over: migration 118 granted SELECT column-by-column on `connector_connections`, so a new column was unreadable and the failure looked like an outage
  - SEED-146 (the full integration capability surface) — the auth/ops dimension
  - Phase 215 (OAUTH-01 / OAUTH-02) — the phase that introduced `connector_tokens`
trigger_when:
  - Anyone reads `connector_tokens` from a user-JWT Supabase client and gets an empty result they cannot explain
  - Anyone touches `GET /connectors/connections/{id}/oauth/token`, which cannot succeed today
  - The next migration on the connectors schema — this is a policy, and it belongs with one
  - Any surface wants per-application availability to SURVIVE A RELOAD (see the note below)
  - ⚠ THE CLOUD DATABASE STILL HAS THE DEFECT — migration 151 is LOCAL ONLY. Re-open the moment a cloud deploy is proposed, and note the failure is SILENT: a read against a policy-less table returns EMPTY rather than erroring
---

# SEED-233 — a table nobody can read, and a grant that says otherwise

## What was measured (2026-09-01, live local schema)

```
relrowsecurity = true          pg_policy rows for connector_tokens = 0
column privileges: authenticated -> SELECT on
    id, connection_id, account_email, account_name, token_type, scopes,
    expires_at, created_at, updated_at
```

**RLS enabled with no policy denies everything.** So the nine column grants held by
`authenticated` are decoration: a user-JWT read of `connector_tokens` returns EMPTY, always, for
every row, for every user.

## What it actually breaks today

- **`GET /connectors/connections/{id}/oauth/token` 404s on rows that exist.** Driven live: the
  row is in the table (`account_email = fhdmrd@gmail.com`, 15 scopes, valid `expires_at`) and the
  endpoint answers `{"detail":"No OAuth tokens found for connection"}`. That endpoint has a
  client function (`getConnectionOAuthToken`) and has presumably never worked.
- **It is why Phase 221 plan 02's Check arm first answered 409** about a Google connection
  holding a live token. `connector_service.get_oauth_token_status` was called with the user's
  client, returned `None`, and the route honestly reported "nothing to check".

## The workaround that shipped, and its exact scope

`check_connection` reads the token metadata on the **service-role client**, having ALREADY
resolved and org-verified the connection. It widens nothing:

- the route is `require_org_manage` (org admins only, API-enforced);
- `resolve_connection` proved the row belongs to the active org, or raised;
- `get_oauth_token_status` re-applies `.eq("org_id", org_id)` itself;
- the projection names only non-secret metadata — no ciphertext column.

`oauth_refresh_service.get_valid_oauth_token` already reads the same table the same way, for the
same reason.

## What the real fix is

**An RLS policy on `connector_tokens`, in a numbered migration**, scoping SELECT to members of
the owning connection's org — the shape every other table on this schema already uses. It was
NOT done here for two reasons, both recorded rather than assumed: Phase 221 plan 02's fence
explicitly forbids a migration, and a policy on a credential-bearing table is an operator
decision, not an autonomous one.

⚠ **Until it lands, do not add a second user-JWT reader of this table.** It will return empty and
the failure will look like missing data rather than a missing policy — which is exactly how the
`connector_connections` column-grant trap cost a session before it was understood.

## A consequence worth knowing before it surprises someone

Per-application availability is currently **session-scoped**: it is produced by the Check action
and held in `ConnectionsTab` state, never stored. That is honest (an unmeasured application is
not a blocked one), but if it should survive a reload, the natural home is a column — and any
such column on `connector_tokens` inherits this defect on day one.
