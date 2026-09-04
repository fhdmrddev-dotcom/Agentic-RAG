# Phase 225 — One Way to Hold a Secret Mid-Handshake

**Proposed 2026-09-02**, on the operator's decision at `BUS-048`. Scoping only — it stops where
`/gsd:discuss-phase` takes over.

---

## The one sentence

> The OAuth handshake keeps its secrets **on the server** instead of in the URL bar — because Phase 215
> puts the client secret and the PKCE verifier into the `state` parameter, and Phase 222 already ships
> the correct shape beside it.

## Why now

⭐ **This is a security finding in shipped, live code, and it was reported rather than silently
patched.** `BUS-048`, 2026-09-01, answered by the operator 2026-09-02.

`generate_oauth_state` (`oauth_service.py:139`) builds a payload, base64url-encodes it, and HMAC-signs
it. **Signing proves the blob was not TAMPERED WITH. It does nothing to HIDE it, and base64 is an
encoding, not a cipher.** Driven, not reasoned — the real function was called with a real secret and
the result decoded. The payload contains:

| key | what it is |
|---|---|
| `cid_ovr` | the OAuth client id |
| **`sec_ovr`** | ⛔ **the OAuth client secret, verbatim** |
| **`cv`** | ⛔ **the PKCE code verifier** |

That blob is placed in the authorize URL as `?state=…` by `build_authorization_url` (`:265`), so it
travels to the authorization server, into browser history, and into any proxy or access log on the
path — and is echoed back on the redirect.

⭐ **The `cv` one defeats the entire purpose of PKCE.** PKCE exists so that an intercepted
authorization `code` cannot be redeemed without the verifier. **If the verifier rides in the same URL
as the code, whoever sees one sees both**, and the protection is nominal rather than real. OAuth 2.1
requires PKCE for exactly the interception case this re-opens.

## Severity, stated honestly in both directions rather than inflated

- **On the shipped Google path the authorization server is Google**, and the secret is the customer's
  own application secret — so Google seeing it is **not a leak to a third party**. The real exposure
  there is **browser history, logs and proxies**: genuine, but not catastrophic.
- **It would be much worse with a pasted MCP server**, where the AS is a URL a stranger supplied. That
  is why it was found, and why **Phase 222 deliberately did not reuse this design.**

⚠ **Nothing here is a new hole. It is a hole that has been open since Phase 215 shipped.** The
severity is `major`, not `blocking`, and the reason it is not a hotfix is below.

## The target design already exists in this repo

Phase 222's `mcp_oauth.py` is the reference implementation, and its docblock (`:20-32`) states the rule
this phase generalises:

> *"the state here is an **OPAQUE RANDOM HANDLE** and nothing else. The verifier, the client credentials
> and the discovered endpoints stay server-side in Redis, keyed by that handle. Nothing sensitive enters
> a URL."*

Its mechanics, already shipped and already reviewed:

- an opaque handle from `secrets`, and **nothing else** in the URL;
- the sensitive material in **Redis via `setex`** (`:216`) — ⚠ deliberately `setex` rather than
  `set` + `expire`, because two commands leave a window where a crash strands a non-expiring secret;
- **single-use by construction** — `_take_pending` (`:241`) does `get` then `delete`;
- a **10-minute TTL**, chosen to match `generate_oauth_state`'s own default so the two flows expire
  alike.

**So this phase does not design anything. It ports one flow onto a shape that is already here.**

## Success criteria (what must be TRUE)

1. **No secret appears in any URL the browser sees.** The authorize URL's `state` is an opaque handle
   and nothing more — no client id, no client secret, no verifier. ⚠ **A test must decode the real
   emitted state and assert the absence**, not assert that a helper was called.
2. **There is ONE state implementation, not two.** `mcp_oauth.py` and the Google path use the same
   mechanism. ⭐ **This is the actual point of the phase** — `BUS-048`'s argument is that *a second
   implementation is how the safe path and the unsafe path drift apart*.
3. **A consent already in progress is not broken by the deploy** — see the migration note below.
4. **The handle is single-use and expires.** A replayed handle is refused, and an abandoned one
   disappears on its own.
5. **The Google connection still works end to end**, driven in a browser against the real Google
   consent screen — not a mocked exchange.

## How we'd know this failed (G-6)

- The new flow ships **beside** the old one and `generate_oauth_state` keeps a live caller, so there
  are still two implementations and SC#2 is met on paper only. ⭐ **This is the most likely way this
  phase ships hollow.**
- The state is shortened but still carries *something* — an org id, a connection id, a provider name.
  ⚠ The criterion is **opaque**, not *smaller*.
- The Redis entry is written with `set` + `expire` rather than `setex`, re-opening the stranded-secret
  window 222's docblock explicitly names.
- A cutover breaks a consent in flight, and the failure surfaces to a person as a generic
  "connection failed" with no way to tell that a retry would work.
- The tests assert on the helper's inputs rather than **decoding the emitted URL**, so a regression
  that re-adds a field passes.

## The cutover is the hard part, and it is not code

⚠ **`state` is round-tripped through a third party.** A consent started before the deploy comes back
*after* it, carrying an **old-format** state to a callback that only understands the new one. So the
callback must accept **both formats during a transition window**, and `verify_oauth_state` cannot
simply be deleted in the same commit that stops producing its output.

⭐ **That is the whole reason this is a phase and not a patch** — and it is also why it should not be
folded into a busy phase: the correctness of a cutover is easy to assert and hard to prove.

⚠ **There is no migration and no schema change here**, so nothing gates on cloud parity — but the
deploy has an ordering constraint of its own: the callback must understand the new format **before**
anything starts emitting it.

## Not in scope, deliberately

- **`mcp_oauth.py` itself.** It is already correct. This phase moves the *other* flow onto it.
- ⚠ **The raw `httpx` token exchange.** `oauth_service.exchange_code_for_tokens` (`:300`) uses a bare
  `httpx.AsyncClient` with no scheme check, no DNS pin, no redirect refusal and no size cap.
  `mcp_oauth.py:38-45` records this and judges it **defensible on the 215 path**, because `token_url`
  there is a constant from a hardcoded registry rather than a stranger's URL. **It is named here so
  the exclusion is a decision rather than an oversight**, and so a future phase that widens that
  registry knows to revisit it.
- **Token storage and refresh.** `oauth_refresh_service.py` is untouched.
- **Re-consenting existing connections.** The token minted 2026-08-31 must keep working.

## What makes this small

The dangerous fields have somewhere to go **today**: `mcp_oauth.py` already holds verifier, client
credentials and endpoints server-side under a handle. The call sites are few — `generate_oauth_state`
has **one** producer (`oauth_service.py:241`) and `verify_oauth_state` **one** consumer
(`api/connectors.py:1439`).

⚠ **The risk is not the size of the change. It is the round trip through a third party**, which is why
SC#3 and the cutover section exist.

## Flags

- ⚠ **Security-bearing.** `AGENTS.md` §3.1's criteria include "credentials"; who builds it is the
  operator's call and should be stated out loud.
- ⚠ **Same family as three prior findings, which is the argument for fixing the SHAPE rather than the
  instance:** `CR-01` (anon *and* authenticated both holding column-level SELECT on
  `connector_connections.secret_ciphertext`, found at Phase 190 after nineteen plans of RED-first
  self-checking missed it); the 2026-08-31 finding that `OAuthConnectionConfig` declared
  `custom_client_secret` inside the authenticated-readable `config` column (closed by migration 150);
  and this. **Three times a customer credential has turned out to be readable somewhere nobody looked,
  and all three were invisible to every gate.**
- ⚠ **`backend/app/api/connectors.py` is a G-5 hot file** — the ledger row reads `17 / 7 / 1338` and
  **was already found stale once**. Re-derive at discuss-phase.
- **No G-2.** There is no user-visible surface here; the success of this phase is that nothing changes
  on screen.
