---
id: BUG-260903-02
title: "`POST /connectors/oauth/authorize` accepts a connection_id from another org, and the callback writes tokens to it"
reported: 2026-09-03
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/connectors/oauth, security/authorization, backend/app/api/connectors.py]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 7b2534fd4
  date: 2026-09-03
---

# BUG-260903-02: OAuth authorize accepts another org's connection id; the callback writes tokens to it

Found by the scoped `/security-review` of the Phase 225 diff (`review-base-225..HEAD`), 2026-09-03.
**Pre-existing since Phase 215** — byte-identical at `review-base-225`; NOT introduced by 225. Filed
rather than folded because 225 is closed and this is authorization, not state handling.

## What we observed (by code read, not yet driven)

- `create_oauth_authorize_url` (`backend/app/api/connectors.py:1320-1405`) puts `payload.connection_id`
  into the pending record **without checking it belongs to `active_org`**. The only org-scoped query in
  the route (`:1360-1366`) is the optional stored-config read, and its miss is non-fatal.
- `oauth_callback` (`:1511-1525`) resolves `org_id` from the `connector_connections` row **through the
  service role** and calls `save_oauth_tokens` with it. `pending.org_id` — which Phase 225 now stores
  (`oauth_service.py:265`) — is never compared to the row.
- Contrast: the MCP authorize route checks ownership (`:1149-1157`, `.eq("org_id", active_org)` → 404)
  and the MCP callback writes with `pending.org_id` (`:1295-1297`).

## Exploit scenario

An `org_manage` user in org X who knows a connection UUID from org Y calls `/connectors/oauth/authorize`
with that id and their own `custom_client_id` / `custom_client_secret`, completes Google consent with
their own Google account, and org Y's connector now holds the attacker's tokens and `account_email`.
Everything org Y's agent reads or sends through that connector then goes through the attacker's account.
UUIDs are unguessable, so the precondition is a leaked or previously-shared id (a user who moved orgs,
a screenshot, a log). Confidence it is exploitable given the id: 8/10.

## Fix (≤ 10 lines, one file — G-3 candidate)

1. In `create_oauth_authorize_url`, when `payload.connection_id` is set, require the row to exist under
   `active_org` (the MCP route's shape) → 404 otherwise.
2. In `oauth_callback`, assert `conn_res.data[0]["org_id"] == pending.org_id` before `save_oauth_tokens`;
   refuse with `oauth_error=invalid_or_expired_state` on mismatch. (Legacy-state path has no `org_id`;
   it sunsets at the announced 24-h mark.)
3. One test per arm, driven RED first.

## Also noted by the same review (not bugs, recorded)

- `_get_signing_key()` (`oauth_service.py:127-130`) falls back to a literal default when both secrets
  are unset; the legacy `verify_oauth_state` branch is forgeable in that misconfiguration. Deleting
  `verify_oauth_state` and the `"." in state` branch at the 24-h mark closes it for good.
- `take_pending_state` uses `GET` then `DEL`; Redis ≥ 6.2 `GETDEL` would make single-use atomic under a
  concurrent double-callback. Theoretical; the provider rejects the second `code` redemption.
