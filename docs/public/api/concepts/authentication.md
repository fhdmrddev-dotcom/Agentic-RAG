---
title: Authentication
slug: api/concepts/authentication
section: api
audience: developer
status: written
release: shipped
covers: [H41]
summary: >-
  There are two ways in. A script can sign in as a user and send that user's Supabase access token,
  or use an API key made in Settings → API keys, which starts only the published workflows it lists.
reviewed: 2026-10-25
---

The Syrel API is the same HTTP API the Syrel app uses. There are two ways for a script to call it:

| | A user's token | An API key |
|---|---|---|
| What it is | The access token of a signed-in user | A key made in **Settings → API keys** (`srl_live_…`) |
| What it can call | Everything that user can do in the app | Only the `/inbound` endpoints: start the published workflows the key lists, and read the runs it started |
| Who the work runs as | That user | The person who made the key |
| Rate limited | No | Yes, per key (below) |

Webhooks, personal access tokens and service accounts are Not available today. [See what's planned](/docs/api/roadmap-open-platform).

## API keys

A key is made in **Settings → API keys** for one or more of your own published workflows. It starts only those workflows, and it reads back only the runs it started. To start a workflow and read its result step by step, see [Start a workflow from outside](/docs/api/guides/start-a-workflow-from-outside).

Send the key as a bearer token:

```http
Authorization: Bearer srl_live_…
```

**Shown once.** The secret is shown once, when the key is made. Syrel stores only a one-way SHA-256 digest of it, so nobody (including an administrator) can read it back later. If you lose it, revoke the key and make a new one.

**Checked on every call.** Each call re-checks the key against the live state, so a change takes effect on the next call:

| Situation | Result |
|---|---|
| No `Authorization` header | `401` "This call has no API key. Send one as `Authorization: Bearer <key>`." |
| The key is unknown, revoked or expired, or the person who made it is no longer a member of the organisation (or is disabled) | `401` "This API key is not valid. It may have been revoked or have expired." |
| A workflow the key does not list, or a run the key did not start | `404` "Not found." (the same body whatever the reason) |

A key expires after 30, 90 or 365 days, or never, as chosen when it was made. Organisation admins can see and revoke every member's keys in **Org admin → API keys**.

**Rate limits.** Each key may start **10 runs a minute** and read **120 times a minute** by default; an operator can change both in Settings. Over the limit, the call is refused with `429` and a `Retry-After` header giving the seconds until the minute resets:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 37

{"detail": "Too many starts: this key may start 10 runs a minute. Try again in 37 seconds."}
```

If Syrel cannot count calls at that moment, it refuses rather than letting calls through: `503` "Rate limiting is unavailable right now, so this call was refused. Try again in a minute."

**Recorded.** Every start, read and refused call made with a key is written to the audit log with the key's label and the run it touched. The secret is never recorded.

## A user's token

Send the user's access token as a bearer token:

```http
Authorization: Bearer <access_token>
```

Syrel checks the token with the deployment's Supabase Auth service on each request, then checks that the account is not disabled.

### Getting a token from a script

Syrel uses Supabase Auth. To act as a user from a script:

1. Read the deployment's public Supabase settings from `GET /public-config`. It returns `supabase_url` and `supabase_anon_key` — the same public values the browser uses — and needs no token.
2. Sign the user in against Supabase Auth with those values, for example with a Supabase client library or the password grant:

   ```bash
   curl -s -X POST "<supabase_url>/auth/v1/token?grant_type=password" \
     -H "apikey: <supabase_anon_key>" \
     -H "Content-Type: application/json" \
     -d '{"email": "<user email>", "password": "<password>"}'
   ```

3. Use the returned `access_token` as the bearer token. Access tokens expire (typically after about an hour); refresh them with the returned refresh token the way any Supabase client does.

The script then has exactly the access that user has — no more. It is user impersonation, so treat the credentials accordingly. If all the script needs is to start a published workflow and read its result, use an API key instead.

## Choosing the organisation: `X-Org-Id`

This section is about a user's token. An API key belongs to one organisation and needs no header.

A user can belong to several organisations. Endpoints that act inside one organisation — connections, sources, Experts, the org admin endpoints, the thread workspace and some thread actions — read the `X-Org-Id` header:

```http
X-Org-Id: <organisation id>
```

| Situation | Result |
|---|---|
| Header present and you are a member | The request acts in that organisation. |
| Header present but you are not a member (or it is malformed) | `403` "You are not a member of this organization." |
| Header absent, you belong to exactly one organisation | That organisation is used. |
| Header absent, you belong to two or more | `400` "X-Org-Id header required." |
| You belong to no organisation | `403` "You do not belong to any organization." |

The server always checks the header against your memberships; it never trusts it on its own.

## Calling from a browser

The API only accepts browser requests from the deployment's own frontend origins. A web page on another origin is refused by the browser. Server-to-server calls are not affected.

## Authentication errors for a user's token

| Status | When |
|---|---|
| `403` "Not authenticated" | No `Authorization` header at all. |
| `401` "Invalid or expired token" | The token was rejected. Sign in again or refresh it. |
| `503` "Could not verify your session right now — please retry." | Syrel could not reach the auth service. Your token may be fine; retry. |
| `403` "This account is disabled — contact your administrator." | An operator disabled the account. |

More in [Errors](/docs/api/concepts/errors).
