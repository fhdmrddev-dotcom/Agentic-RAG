---
title: Errors
slug: api/concepts/errors
section: api
audience: developer
status: written
release: shipped
covers: [H44, H48]
summary: >-
  What each status code means in the Syrel API — 401 versus 503, the two kinds of 403, 404 used in
  place of 403, 409 conflicts with If-Match, and 422 validation errors.
reviewed: 2026-10-04
---

Errors come back as JSON with a `detail` field. Most `detail` values are a sentence you can show a person; a few are objects with machine-readable fields, noted below.

## Status codes

| Status | Meaning in Syrel |
|---|---|
| `400` | The request is ambiguous or malformed in a way validation does not cover — for example "X-Org-Id header required." when you belong to several organisations and sent no header. |
| `401` | Your token was rejected: "Invalid or expired token". Refresh it or sign in again. |
| `403` | A refusal you are meant to understand — see the table below. |
| `404` | Not found — **or not yours**. See "404, not 403". |
| `409` | A conflict with the current state — see "Conflicts and If-Match". |
| `422` | The body or a parameter failed validation, including a malformed id in the path. The response lists each problem with its location. |
| `503` | Syrel could not check something it needs, and refused rather than guessing. See below. |

## The kinds of 403

| `detail` | Cause |
|---|---|
| "Not authenticated" | No `Authorization` header was sent. |
| "This account is disabled — contact your administrator." | An operator disabled the account. |
| "You are not a member of this organization." | The `X-Org-Id` header names an organisation you do not belong to. |
| "This feature is available to administrators only." | The feature is hidden from you by the operator's feature visibility settings. |
| An object with `"error": "entitlement_required"` | Your organisation's plan does not include this action. The object names the `capability`, the `required_tier`, your `current_tier` and an `upgrade_hint`. |

## 404, not 403

Syrel answers `404` when the thing you asked for is not yours, so a response never confirms that something exists:

- another user's or another organisation's object (a draft workflow answers "draft not found" whether it does not exist or belongs to someone else);
- any operator endpoint, when you are not an operator;
- visual-canvas endpoints, when an operator has switched the canvas off.

## Conflicts and If-Match

Updating a draft workflow uses optimistic concurrency:

1. Each successful create or update of a draft returns `{id, version, token}`.
2. Send that token back on the next update in an `If-Match` header: `PATCH /workflows/{definition_id}` with `If-Match: <token>`.
3. If someone (or another tab) saved since, the update is refused with `409`, and the response carries the current token so you can re-apply your change deliberately.

Other `409` responses you may meet: updating a workflow that is already published ("workflow is already published"), and sharing a skill that has not passed its evaluation (`"error": "publish_gate_unmet"`).

> **Note:** `If-Match` is optional for now — a request without it is not checked for conflicts. It is expected to become required, so send it.

## 503: could not check, so refused

| `detail` | Cause |
|---|---|
| "Could not verify your session right now — please retry." | The auth service was unreachable. Your token may be fine. |
| "Streaming infrastructure unavailable" | A run's event stream could not be opened. |
| An object naming the capability, "temporarily unavailable" | Your plan could not be checked. Syrel fails closed rather than allowing the action. |

Retry a `503` after a short wait.

## Related

- [Authentication](/docs/api/concepts/authentication)
- [Organisations and row-level security](/docs/api/concepts/orgs-and-rls)
