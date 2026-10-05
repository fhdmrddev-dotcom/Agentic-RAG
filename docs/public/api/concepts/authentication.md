---
title: Authentication
slug: api/concepts/authentication
section: api
audience: developer
status: written
release: shipped
covers: [H41]
summary: >-
  Every request carries a signed-in user's Supabase access token. Syrel has no API keys, personal
  access tokens or service accounts today.
reviewed: 2026-10-04
---

The Syrel API is the same HTTP API the Syrel app uses. It authenticates people, not applications.

> **Note:** Syrel has no API keys, personal access tokens or service accounts today. A script signs in as a user and sends that user's token. API keys, webhooks and rate limits are Not available today. [See what's planned](/docs/api/roadmap-open-platform).

## How a request is authenticated

Send the user's access token as a bearer token:

```http
Authorization: Bearer <access_token>
```

Syrel checks the token with the deployment's Supabase Auth service on each request, then checks that the account is not disabled.

## Getting a token from a script

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

The script then has exactly the access that user has — no more. It is user impersonation, not a supported integration path, so treat the credentials accordingly.

## Choosing the organisation: `X-Org-Id`

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

## Authentication errors

| Status | When |
|---|---|
| `403` "Not authenticated" | No `Authorization` header at all. |
| `401` "Invalid or expired token" | The token was rejected. Sign in again or refresh it. |
| `503` "Could not verify your session right now — please retry." | Syrel could not reach the auth service. Your token may be fine; retry. |
| `403` "This account is disabled — contact your administrator." | An operator disabled the account. |

More in [Errors](/docs/api/concepts/errors).
