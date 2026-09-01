# Phase 222 — the crypto half

**Claude's half of the operator-ruled split (BUS-045).** Gemini builds the door; this is the
PKCE join, RFC 9728/8414 discovery, RFC 7591 registration, pinned egress and token storage.

**Status: complete and driven end to end against real Notion.** The door does not exist yet,
so the feature is not shippable — see §7.

---

## 1 · The headline

⭐ **Notion returns 41 tools.** That connection has answered `403 restricted_resource` since
Phase 212, and the recorded reason was right: its endpoint is OAuth-only and refuses an
internal-integration token no matter what is granted to it in Notion's console.

⭐ **And no console visit was needed at all.** Notion advertises RFC 7591 dynamic client
registration, so the application registered itself. The operator's only action was clicking
*Approve* on Notion's own consent screen.

**The cost anchor this phase exists for, now measured on this install rather than quoted:**

| door | tools | lines of tool code |
|---|---|---|
| OAuth, hand-written (Google, Phase 221) | 26 | ~96 per tool — 786 spec + 1,719 adapter |
| **MCP + OAuth (Notion, this phase)** | **41** | **zero** |

---

## 2 · What shipped

| Commit | What |
|---|---|
| `5bd9d8392` | RFC 9728 / 8414 discovery — four verdicts, no credential sent (17 tests) |
| `91688ef1a` | `POST /connectors/mcp/probe-auth` — the wire contract (9 seam tests) |
| `12f7de7de` | The PKCE join — opaque state, pinned token exchange (12 tests) |
| `60995cb3c` | `/mcp/oauth/authorize` + `/mcp/oauth/callback` (9 tests) |
| `29152a983` | RFC 7591 registration + the `McpConfig` fix (4 tests) |
| `f4b1ee9be` | Resolve the auth scheme instead of guessing it (11 tests) |
| `428467477` | Migration 151 — `connector_tokens` RLS policy |
| `c35c29151` | An SSRF refusal was a 500, not the 422 it wrote |
| `02ddf7929` | `aexec` undefined — broke two shipped routes |

**62 new tests.** Every one of them was driven RED against a planted defect, and every
planted file restored md5-identical.

---

## 3 · Five defects found in code that had already shipped

⚠ **None was visible to 3,392 passing tests.** Each sits on a path needing live DNS, a real
OAuth round trip, or one specific refusal branch to reach.

### 3.1 `aexec` was an undefined name — two shipped routes

Used at three call sites in `api/connectors.py`, imported at none. Proven by AST: unbound at
module level, no local import in any of them. It broke `create_oauth_authorize_url` (Phase
215's OAuth Connect) and `import_connection_file` (Phase 216).

⚠ **Second time in this file.** `BUS-037` recorded `logger` undefined here on 2026-08-31 — six
uses, zero definitions. A `NameError` lands *after* the response begins, so there is no
status, no CORS header and nothing in the log; the operator sees only *"Failed to fetch"*.

**So the fence is static and walks EVERY router** for called names nothing binds. A pin on
`logger` would not have caught `aexec`, and a pin on `aexec` will not catch the third. 36
routers clean, plus two positive controls reconstructing both recorded shapes.

### 3.2 An SSRF refusal was a 500, not a 422

`discover_tools_from_url` read `exc.detail` inside `except EgressRefused`. That attribute does
not exist — `EgressRefused.__init__` assigns `reason_code`/`host`/`capability`/`ip` and nothing
else, deliberately, so that no body or secret can ride on it. Reading it raised `AttributeError`
inside the handler.

⚠ **The security sentence a person most needs to see was the only one that broke**, and only on
the refusal path.

### 3.3 `connector_tokens` — RLS on, ZERO policies (migration 151)

Migration 129 enabled RLS *and* carefully granted the nine non-secret columns, withholding both
ciphertext columns. It never created a policy. **RLS with no policy is deny-all — it overrides
grants rather than falling back to them**, so that column list had never once been reachable and
`GET /oauth/token` 404s on rows that exist.

⚠ **The policy is NARROWER than the workaround it replaces**, which is worth stating because
"adding a policy to a credential table" reads like a widening:

| | reads |
|---|---|
| service-role workaround (Phase 221) | **every org, both ciphertext columns** — bypasses RLS entirely |
| migration 151 | caller's own orgs, SELECT only, nine non-secret columns |

### 3.4 The OAuth state carries the client secret and PKCE verifier in the clear

**Reported, not fixed — `BUS-048`.** `generate_oauth_state` base64s its payload and HMAC-*signs*
it. Signing proves no tampering; it hides nothing. The decoded payload contains `cid_ovr`,
`sec_ovr` (the client secret) and `cv` (the PKCE verifier), and that blob goes into the authorize
URL as `?state=`.

⚠ **It defeats the purpose of PKCE**, which exists so an intercepted `code` cannot be redeemed
without the verifier. On the Google path the AS is Google; here the AS is a URL a stranger
pasted, which is why this half does not reuse it.

Not patched because Phase 215 is live and changing the state encoding mid-flight would break
consent already in progress.

### 3.5 The auth scheme was inferred from the token's characters

`_build_auth_headers` treated any colon-bearing credential as a `user:token` Basic pair. Right
for Jira, wrong for an OAuth token containing one. **Notion's does.** A valid, freshly minted
token was base64'd into `Basic` and the server answered `401 invalid_token`; the same token with
an explicit `Bearer` returned **HTTP 200 and 41 tools**.

⚠ **The wrong diagnosis was the expensive part.** `invalid_token` reads as *"your credential is
bad"* — it sends somebody to re-authorize, re-consent, or hunt for a scope, and every one of
those mints another colon-bearing token and fails identically. **A heuristic that is confidently
wrong costs more than an absent one.**

Fixed by resolving the scheme where it is *known*: `ResolvedConnection.auth_scheme`. `auto` is
byte-unchanged, because every shipped `static_key` row was stored against exactly those rules.

---

## 4 · A defect I introduced, on a live database

⚠ **The registered `client_id` broke the Connections page for the entire org.**

It went through the shipped `store_oauth_client_credentials`, which writes `custom_client_id`
into `config` — an *OAuth-row-shaped* key. Notion is an **MCP** row, `McpConfig` declares only
`headers`, and every config model is `extra='forbid'`. The row matched no member of the
`ConnectorConfig` union.

⚠ **The blast radius is the finding.** `_to_response` validates each row *inside* the list
comprehension, so **one bad key made all eight other connections unreadable** — API 503, page
*"Could not load connections. Nothing is wrong with them — this page could not read them."*

⭐ **That copy was exactly true, which is what made it hard to place.** Eight rows were fine;
one key on a ninth stopped the projection.

Repaired by hand, `McpConfig` widened to carry the id (**never** a secret — migration 150's rule
holds), 4 tests with 3 driven RED.

⚠ **My first diagnosis was wrong and I nearly acted on it.** The 503 and the error text match the
Phase 212 column-grant trap exactly. I measured it: columns and grants were *fine* and the select
worked as `authenticated`. Only calling `list_connections` directly gave the real answer. Acting
on the first hypothesis would have meant rewriting grants that were not broken.

**Still open, and bigger than my bug:** one malformed `config` from ANY past or future migration
takes down every connection in the org. Not a Phase 222 question; not fixed here.

---

## 5 · Design decisions a later reader should not re-derive

- **Discovery is a separate module.** `McpClient._post` raises on any status ≥ 400, so the 401
  and its `WWW-Authenticate` header — RFC 9728's entire entry point — are discarded. Reusing
  `_send_jsonrpc` would have meant reading the one response it is built to throw away.
  `mcp_client.py` is byte-unchanged by discovery.

- **`egress.send_pinned_http` is unusable here.** It is allow-list keyed, and an MCP host is
  uncurated by definition. ⚠ Worse: **RFC 9728 lets the resource server name its own
  authorization server**, so an allow-list built from what it told us would be the attacker
  approving themselves. Every hop is re-validated instead. What this does *not* do is decide a
  discovered AS is *trustworthy* — that is an authorization decision, and it belongs where the
  token is minted.

- **S256 is hardcoded.** Notion offers `['plain', 'S256']`; the code refuses the downgrade
  rather than reading the server's preference.

- **Three fields are deliberately off the wire** (`BUS-047`): `authorization_endpoint`,
  `token_endpoint` and the raw metadata. The browser never calls them; exposing them invites a
  frontend to start the flow and move the PKCE verifier out of the backend. `/authorize`
  enforces the same rule from the other side by re-discovering rather than accepting them.

- **`/callback` has no auth dependency, correctly** — a third-party redirect carries no JWT.
  Org and user come from the pending record bound at authorize time under `require_org_manage`.

- **The pending handle is single-use and burns even on a failed exchange** — a failure sends the
  person back through consent rather than leaving a handle to retry redemption with.

---

## 6 · Gates

| Gate | Result |
|---|---|
| `tsc` | 66 — baseline (no frontend change in this half) |
| count gate | 183/183 · 7125 · 0 failing — unchanged |
| backend unit | **see §8** — 70 was the baseline before the resolver change |
| Connector + 222 suites | 178 passed |
| Migration 151 | applied by the operator, verified live, `full-schema.sql` regenerated (no `--reset`) |

---

## 7 · ⛔ What is NOT done

1. **The door does not exist.** Gemini's half. The live drive ran through a temporary button
   injected into the page — **not product UI, nothing committed**. There is no way for a normal
   user to do any of this.
2. **`BUS-048`** — the Phase 215 state exposure, reported and untouched.
3. **Cloud parity** — migration 151 is LOCAL only. Code reading that table against a
   policy-less one does not error; it reads **empty**, which is the silent half of the defect.
4. **Refresh is unexercised.** A refresh token was stored; nothing has used it. The Notion
   access token expires ~8h after mint.
5. **No frontend tests**, because this half touched no frontend file.
6. **The `403`→`401`→`200` progression was driven by hand**, not by anything in CI.

---

## 8 · Environment notes worth not rediscovering

- ⚠ **Two Supabase sessions live in the browser** — `sb-plmab…` (cloud) and `sb-127` (local).
  The backend validates against **local**. Picking the wrong one yields `Invalid or expired
  token` and looks like an auth defect.
- ⚠ **`window.open` is blocked without a user gesture**, so the consent redirect must originate
  from a real click. The door has to account for that.
- ⚠ **`redirect_uri` is `http://localhost:8000`**, so the consent must complete in a browser on
  the same machine. A deployed instance needs `BACKEND_PUBLIC_URL` set *and a client registered
  against that redirect* — servers bind the redirect URI at registration time.
- ⚠ **`scripts/restart-backend.ps1` earned its keep**: it killed **two** uvicorn trees. A plain
  kill leaves one serving stale code, which is the exact Phase 075.5 trap its header records.
