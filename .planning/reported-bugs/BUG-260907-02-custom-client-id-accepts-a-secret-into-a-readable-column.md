---
id: BUG-260907-02
title: custom_client_id accepts any string into config — a client SECRET pasted there is stored in plaintext in a column every org member can read
reported: 2026-09-07
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/models/connector, connections, oauth, security, frontend/settings]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 7370fe543
  date: 2026-09-07
---

# BUG-260907-02: A client secret pasted into the client-ID field is stored in plaintext, readable org-wide

## What we observed

While setting up the Phase 238 Microsoft connection, the operator used *Settings → Connections →
Microsoft 365 → **Advanced: Custom OAuth App Credentials (Optional)*** and pasted their Entra
**client secret** into the field backing `custom_client_id`.

Read back from the live database:

```sql
select config from connector_connections where service_id = 'microsoft';
-- {"headers": {}, "custom_client_id": "<40 chars, contains '~', not a GUID>"}
```

Confirmed by hashing rather than by eye: the stored value's SHA-256 prefix **matched
`MICROSOFT_OAUTH_CLIENT_SECRET` exactly**, and did not match `MICROSOFT_OAUTH_CLIENT_ID`.

**Nothing rejected it.** `ServiceId`-style validation does not apply here; `custom_client_id` is
`str | None` on `OAuthConnectionConfig` with no pattern, no length bound, and no shape check. The
API returned success and the value was written to `config`.

⚠ **`config` is exactly the column this codebase documents as org-readable.** From
`backend/app/models/connector.py`, in the docstring of the model that holds this field:

> *"Measured 2026-08-31 against the live database: `has_column_privilege('authenticated', …,
> 'config', 'SELECT')` is TRUE while the same call for `secret_ciphertext` is FALSE — so a client
> secret written here is returned to every member of the org by the ordinary connections list."*

That comment exists because `custom_client_secret` was **removed** from this model in Phase 215
for precisely this reason, and moved to `oauth_client_secret_ciphertext` (migration 150),
encrypted and ungranted. The hole was closed for the field *named* secret and left open for the
field beside it.

**Remediated for this incident:** the operator rotated the Entra secret, the key was deleted from
`config` (`config = config - 'custom_client_id'`), and a token refresh was re-driven successfully
afterwards, proving the connection runs on the install-wide env credentials.

## Why it matters

**Major.** A live OAuth client secret sat in plaintext in a column readable by every member of
the organisation, on a row returned by the ordinary connections list. In a single-person org the
blast radius was one person; in the B2B deployment this product targets it is every colleague.

⭐ **The deeper point: the existing protection is name-based, not shape-based.** A reviewer
checking "are secrets kept out of `config`?" finds the answer *yes* — there is no field called
secret. The exposure arrives through a **user typo into an adjacent free-text field**, which no
amount of care in the model review catches.

It is also a silent failure in a second way: because `resolve_client_credentials` only uses the
custom pair when **both** id and secret are present, and no custom secret was stored, the
connection worked perfectly off the env vars. **The paste had no visible consequence at all** —
nothing degraded, nothing errored, so nobody would have looked.

## Hypothesized cause

`OAuthConnectionConfig.custom_client_id: str | None = None` (`backend/app/models/connector.py`)
carries no validator. Every other constrained field in that module has one — `NonEmpty`, `Port`,
`ServiceId` with its `AfterValidator` — and the file's header explains the posture: the
per-capability models exist so that *"a password key in `config` is UNCONSTRUCTABLE rather than
merely discouraged"*. This field is the gap in that posture.

## Suggested fix

1. **Shape-check `custom_client_id`.** Every provider in `OAuthProvider` uses a GUID (Microsoft)
   or a structured id (Google's `….apps.googleusercontent.com`). At minimum refuse a value that
   looks like a credential — e.g. an Entra secret's `<prefix>~<body>` shape — with a 422 naming
   the mistake: *"that looks like a client secret, not a client ID"*.
2. **Refuse it at the API too, not only in the panel.** The model is the gate; the panel is the
   kindness (the same rule `NonEmpty` records for `host`/`from_address`).
3. **Consider a sweep**: any existing `config->>'custom_client_id'` that fails the shape check is
   a credential to rotate, not just a bad row.

⚠ Whatever check lands must be driven RED against a real Entra-secret-shaped string, or it is a
guard nobody has seen fire.

## Surface classification

`Agentic-RAG` — our model, our column, our API.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 238 is committed.
- **Defer to future phase / milestone:** the next phase touching `models/connector.py` or the
  connection form. ⚠ It should **not** wait for a convenient phase — it is a credential-exposure
  path, and the fix is a validator plus a test.
- **Plant as seed:** n/a — concrete and small enough to fix directly.
- **External — note only:** no

## Workarounds

Leave *Advanced: Custom OAuth App Credentials* empty and use the install-wide env vars
(`<PROVIDER>_OAUTH_CLIENT_ID` / `_SECRET`). Anyone who has already used that field should check
`connector_connections.config` for a value that is not a plausible client ID and **rotate the
secret** — clearing the column is not sufficient on its own.

## Reference / evidence links

- `backend/app/models/connector.py` — `OAuthConnectionConfig`, and the docstring recording the
  identical exposure that `custom_client_secret` was removed to close (Phase 215 / migration 150)
- `backend/app/services/oauth_service.py` → `resolve_client_credentials` — requires **both**
  custom values, which is why the paste was invisible
- `.planning/phases/238-microsoft-graph-onedrive/238-VERIFICATION.md`
- Commit `7370fe543`
