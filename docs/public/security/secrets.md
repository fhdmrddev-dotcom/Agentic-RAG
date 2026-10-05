---
title: Secrets and keys
slug: security/secrets
section: security
audience: operator
status: written
release: shipped
covers: [A50, I12]
summary: >-
  Provider keys saved in Syrel are encrypted at rest when SECRETS_ENCRYPTION_KEY is set, connection
  credentials are kept out of reach of app users, and a secret pasted into the wrong field is refused.
reviewed: 2026-10-04
---

Syrel holds two kinds of secret: the API keys operators save for model providers and services, and the credentials behind each connection to an outside service. This page explains how each is protected and what you, as an operator, have to set.

## Provider keys: encrypted at rest

Keys you save in Settings — model provider keys, the embedding and reranking keys, the web search key and similar — are stored in the database. When the `SECRETS_ENCRYPTION_KEY` environment variable is set, Syrel encrypts each of them before storing it.

| `SECRETS_ENCRYPTION_KEY` | What happens |
|---|---|
| Not set | Keys are stored **unencrypted**. Syrel still starts, so an existing deployment keeps working. |
| Set to a valid key | Keys are encrypted at rest. Existing unencrypted keys are encrypted when the server starts. |
| Set but malformed | The server refuses to start, so a typo cannot silently disable encryption. |

To rotate, set a comma-separated list: the first key encrypts, and every key in the list can still decrypt. Values not yet under the first key are re-encrypted when the server starts.

Generate the key once, keep it with your other infrastructure secrets, and set it on every server process. Environment variables are for secrets and infrastructure; everything else lives in Settings.

> **Warning:** If you lose the key, encrypted values cannot be read. Syrel then treats those keys as unset and falls back to any key provided in the environment.

## Connection credentials

The credentials behind a connection — tokens, OAuth secrets, static keys — are treated more strictly than provider keys, because they belong to an organisation rather than to the operator:

- They are **always** encrypted. Without `SECRETS_ENCRYPTION_KEY`, Syrel refuses to store a connection secret at all, and refuses to use one that is not encrypted.
- The database columns that hold them cannot be read by signed-in app users.
- OAuth tokens refresh on their own; a revoked connection says so plainly instead of failing silently.

## A secret in the wrong field is refused

If someone pastes a credential into a connection field that is not meant for secrets, Syrel refuses to save it, names the field that does take secrets, and keeps the value out of the server log.

## The Secrets tab

The Control Room shows a **Secrets** tab as coming soon. There is no secrets-management screen behind it today: you manage keys through Settings and the environment as described above.

## Related

- [What Syrel can reach](/docs/security/egress-controls)
- [Audit trails](/docs/security/audit-trails)
