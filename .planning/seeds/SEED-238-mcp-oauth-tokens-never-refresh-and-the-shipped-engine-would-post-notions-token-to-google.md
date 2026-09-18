---
seed_id: SEED-238
title: "MCP OAuth tokens NEVER refresh — `resolve_connection` reads the ciphertext straight out of storage; and the shipped refresh engine cannot be reused as-is, because its provider inference DEFAULTS TO GOOGLE and would POST Notion's refresh token to accounts.google.com"
created: 2026-09-01
planted_during: Phase 222 crypto half — diagnosing an operator-reported Notion 403 that turned out to be a stale uvicorn, and reading the token path properly while there
status: closed
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: fixed

  Mapped `fixed` -> `closed`. Reason: a defect that stopped reproducing is closed.
folded_into: 222
surface: Agentic-RAG
severity: high
category: connectors / oauth / token-lifecycle / cross-vendor-credential-exposure
priority: high
relates_to:
  - Phase 222 (222-CRYPTO-SUMMARY.md §7.4) — "refresh is unexercised" was recorded there as an untested path; it is measured here as an ABSENT one
  - Phase 215 (OAUTH-03) — `oauth_refresh_service.get_valid_oauth_token`, the claim-based refresh engine this path does not use
  - SEED-233 / migration 151 — the same table, the read side
  - BUS-048 — the third finding in this family: a customer credential reachable somewhere nobody looked
trigger_when:
  - Any MCP OAuth connection reports `401 invalid_token` after having worked — that is this, and §3.5 of the crypto summary records how expensive that particular misdiagnosis is
  - Anyone wires MCP refresh — read finding 2 BEFORE routing it through `get_fresh_access_token`
  - Any NON-Google, NON-Microsoft service_id is given a `connector_tokens` row
  - `oauth_refresh_service.py:158`'s provider ladder is edited for any reason
trigger_paths:
  - "**/oauth_refresh_service.py"
---

# SEED-238 — the token is read, never renewed; and the obvious reuse is a credential leak

Both findings were **measured at HEAD (`a3df2d577`)**, not reasoned about.

## Finding 1 — the MCP path has no refresh at all

`resolve_connection` (`connector_service.py:788`) obtains the OAuth credential through
`read_oauth_access_token` (`:614`). That function's projection is one column:

```python
.select("access_token_ciphertext")
```

It never reads `expires_at`, never consults `refresh_token_ciphertext`, and calls nothing in
`oauth_refresh_service`. **So an MCP OAuth connection hands the transport whatever token was
minted at consent, forever.**

Measured on the live row (connection `1a8ac306…`, service `notion`):

| | |
|---|---|
| access token | present |
| refresh token | **present, and nothing has ever read it** |
| `expires_at` | `2026-09-02T02:28:38Z` — 8 h after mint |

⚠ **The failure this produces is the one the crypto summary already names as the most
expensive to diagnose.** §3.5 records that Notion answers `401 invalid_token` for a credential
problem, and that `invalid_token` reads as *"your credential is bad"* — it sends somebody to
re-authorize, re-consent, or hunt a scope, and every one of those mints a fresh token that
works for eight hours and then fails identically. **An expiry presenting as a rejection is a
loop, not an error.**

⚠ **It is invisible to every gate.** No test can observe it without waiting eight hours or
back-dating a row, and the tolerant `except` added at `7b009d685` — correct in itself — means a
token that cannot be read degrades to the stored credential rather than raising.

## Finding 2 — ⚠ do NOT simply route this through `get_fresh_access_token`

That is the obvious fix and it is **wrong in a way that leaks a credential to a third party.**
`oauth_refresh_service.py:158`, verbatim:

```python
provider: OAuthProvider = "google" if "google" in service_id or "gmail" in service_id else (
    "microsoft" if "microsoft" in service_id or "onedrive" in service_id else "google")
```

**The final `else` is `"google"`, not an error.** `service_id` for this connection is
`"notion"`. So `get_valid_oauth_token` would resolve provider `google`, read
`OAUTH_PROVIDERS["google"]["token_url"]`, and POST to Google:

- **Notion's refresh token**, and
- `client_id` = `bD78Ksp3xBJew1kL` — the id Notion issued us under RFC 7591 — with
- `client_secret` = our Google client secret, via `resolve_client_credentials`.

That is a Notion credential and a Google secret sent in one request to a vendor with no part in
either.

⚠ **STATED PRECISELY, BECAUSE THE DISTINCTION IS THE WHOLE POINT: it is NOT reachable at HEAD.**
Every production caller of `get_fresh_access_token` is Google-specific (`cloud_storage.py`,
`google/_http.py`, `google/availability.py`), and the one general route — the Check action —
refuses MCP rows at `api/connectors.py:716` (`if connection.mcp_server_url: raise
_CHECK_NOT_AVAILABLE_FOR_MCP`) **before** the token-row dispatch at `:812` that would reach the
OAuth arm. **This is a measurement of what the call sites are today, not a claim of a live
exploit.** It is a landmine for the next person, and the next person is whoever fixes finding 1.

## What the fix has to be

An MCP connection's token endpoint is **discovered per server** (RFC 8414), it is not a member
of a hardcoded three-vendor registry, and it is **a stranger's URL** — so it needs
`_PinnedFetch`, exactly as `mcp_oauth.exchange_code_for_tokens` already does for the initial
exchange. The refresh is the *same* request shape against the *same* endpoint with
`grant_type=refresh_token`.

⚠ **And the provider ladder should raise rather than default.** A silent `else "google"` is what
turns "this service is unknown to the refresh engine" into "send its secrets to Google". That
one-line change is independently worth making whether or not MCP refresh is built.

---

## ✅ CLOSED 2026-09-02 (Phase 222)

Both findings fixed and **driven against real Notion**, not asserted.

- **Finding 1** — `mcp_token.ensure_fresh_mcp_token` renews inside a 5-minute skew window,
  re-discovering the token endpoint (never reading a stored one) over the pinned fetch. Wired
  into `resolve_connection` keyed on `mcp_server_url`, so non-MCP OAuth rows keep their existing
  read and no credential gets two renewal engines. It **never raises** — a failed renewal degrades
  to the stored token, which is the previous behaviour rather than a fail-open.
- **Finding 2** — `resolve_refresh_provider` REFUSES an unknown service by name. The
  `else "google"` default is gone.

**Driven live:** the expiry was back-dated into the skew window, `ensure_fresh_mcp_token` renewed
against Notion, the new token persisted, `expires_at` advanced to the server's own value, and
**41 tools resolved afterwards**. 11 tests, driven RED first.
