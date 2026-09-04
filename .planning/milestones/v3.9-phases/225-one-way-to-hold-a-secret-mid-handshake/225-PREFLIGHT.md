---
phase: 225
reviewer: claude
builder: gemini
reviewed: 2026-09-03
plans_reviewed: [225-01, 225-02]
plans_at: ae7aac884
verdict: "execute — 3 BLOCKING gaps and 11 advisory gaps to close INSIDE the two existing plans; no re-plan. One AGENTS.md §3.1 seat-assignment flag for the operator."
---

# Phase 225 — Pre-flight review (gap pass, not a re-plan)

Read: `225-01-PLAN.md`, `225-02-PLAN.md`, `225-CONTEXT.md`, `225-PROPOSAL.md`, the ROADMAP entry,
`BUS-048`, and the four files the plans touch at HEAD `ae7aac884`. Every claim below was checked
against the tree, not the plan text.

## 0 · Seat assignment — for the OPERATOR, not the builder

`AGENTS.md` §3.1 criterion 1 (*"Credentials or secrets — storing, encrypting, or granting access to
them"*) is hit squarely: the phase moves the OAuth client secret and the PKCE verifier from a URL
into Redis. By the written rule that makes 225 **Claude-built, Gemini-reviewed**, with the operator
running `/code-review ultra` as the real gate. The ROADMAP entry flagged exactly this (*"who builds
it is the operator's call"*).

The operator directed on 2026-09-03 that Gemini discusses, plans and executes and Claude monitors.
That is the operator's call to make and it is recorded in `STATE.md → Guardrail overrides`, not
argued with here. **What compensates:** (a) this pre-flight, (b) a DRIVEN post-execution check by
Claude in a real browser (SC#5), and (c) the operator launching `/code-review ultra` on the 225 diff
before it merges — §3.1 says that is the gate on credential phases regardless of who built.

## 1 · Verified correct — do not re-check

- **Opaque vs legacy disambiguation is sound.** `secrets.token_urlsafe` emits only `[A-Za-z0-9_-]`,
  so an opaque handle can never contain `.`; every legacy state has exactly one. *Redis first, then
  legacy only if `"." in state`* (D-225-03) is the right order and cannot misroute.
- **Only one production caller of `build_authorization_url`** (`connectors.py:1392`) and only one of
  `verify_oauth_state` (`connectors.py:1439`). No other service consumes either. The `async` change
  to `build_authorization_url` therefore has ONE production call site.
- **`get_redis()`** (`dependencies.py:36`) is a sync accessor returning an `redis.asyncio` client;
  the MCP routes already call it inline (`connectors.py:1234`, `:1289`). Same pattern, no new wiring.
- **The frontend needs no change.** `ConnectionFormPanel.tsx:954` reads only `authorization_url`
  and navigates; `state` on `OAuthAuthorizeResponse` is unread by any TS file. Frontend tests stub
  the URL string.
- **`PendingAuthorization` → `PendingOAuthState` is field-compatible.** The MCP callback reads
  `pending.connection_id` / `org_id`; `complete_authorization` reads `redirect_uri`, `client_id`,
  `code_verifier`, `client_secret`, `token_endpoint`. All exist on the new dataclass.
  `test_222_mcp_oauth_routes.py:260` plants a legacy-shape payload (no `provider`, no
  `created_at`) — the defaults in D-225-01 absorb it.
- **No migration, no new env var.** `check-deploy-drift.sh` and cloud parity are unaffected. The
  cutover needs no deploy ordering: the same commit teaches the callback both formats.
- **`connectors.py` G-5 triple re-derived today: `24 / 10 / 1643`** — the ledger row is current.
  `oauth_service.py`: `4 / 1 / 362`, no row needed.

## 2 · BLOCKING gaps — close inside the plans before marking a task done

### B-1 · SC#5 cannot pass today: the return leg lands on the MARKETING page (Phase 226 regression)

Since `4bb022c23`, `localhost:5173/` is the public landing and the app is at `/app`. Every redirect
in `oauth_callback` (`connectors.py:1432`, `:1435`, `:1503`, `:1510`) and in `mcp_oauth_callback`
(`:1277`, `:1281`, `:1291`, `:1305`) targets `{frontend_url}/?connections=1&…` — so a person who
completes a Google consent is dropped on the landing page with a *Sign in* link and no indication
anything happened. `VERIFICATION.md` for 226 records D-226-02 as *"a logged-in bookmark to `/`
lands on marketing → by design"*; the OAuth return leg was not in that phase's scope and nobody
measured it.

**Also measured:** NOTHING in the app reads `?connections=1`, `oauth_connected` or `oauth_error`
— `grep location.search|URLSearchParams` over `frontend/src` hits only API param builders. This is
pre-existing (`SEED-185`: no router) and means the NEW `oauth_error=invalid_or_expired_state` plan 02
introduces is unreachable to a person; it is a log line wearing a URL. Do not build a toast for it
here — record it.

**Close inside 225-02 Task 2 — OPERATOR DECIDED 2026-09-03: take BOTH callbacks.** Every redirect
built by `oauth_callback` AND by `mcp_oauth_callback` (eight sites, listed above) must target the app
path (`{frontend_url}/app?connections=1&…`), not the root. `BUG-260903-01` is `folded_into: 225`.
Add one test per callback that the redirect `Location` starts with `{frontend_url}/app`. The MCP
callback is still bounded to its redirect strings — D-225-04's *"strictly bounded to
`create_oauth_authorize_url` and `oauth_callback`"* widens by exactly those lines and nothing else. **SC#5 is judged by the `connector_connections` row flipping
to connected and the person landing inside the app**, since no toast can fire.

### B-2 · Four existing suites go red and NONE is in any plan's `files_modified`

| Suite | Why it breaks | Owner |
|---|---|---|
| `backend/tests/unit/test_oauth_service.py::test_build_authorization_url_google` / `_microsoft` | call `build_authorization_url` **synchronously** with no `redis`; plan 02 makes it `async` with a required `redis` | 225-02 |
| `backend/tests/integration/test_oauth_e2e.py::test_oauth_full_authorization_and_token_storage_lifecycle` | same sync call, then `verify_oauth_state(state_token)` on what is now an opaque handle — fails **by design** | 225-02 |
| `backend/tests/unit/test_222_mcp_oauth.py:188` | pins `key.startswith("mcp_oauth:pending:")`; plan 01 moves MCP writes to `oauth:pending:` | 225-01 |
| `225-01` Task 2 `<verify>` | names **`backend/tests/test_222_mcp_oauth_seam.py`, which does not exist**; the real suites are `backend/tests/unit/test_222_mcp_oauth.py` and `test_222_mcp_oauth_routes.py` | 225-01 |

Plan 01's must-have *"existing MCP tests pass without behavioral change"* is false as written.
Either the shared key prefix stays `mcp_oauth:pending:` (the rename is cosmetic) or the pin is
updated in the same plan — both are fine; **neither is fine silently.** Add the test files to
`files_modified` and rewrite the two legacy tests to assert the NEW contract (a 43-char handle with
no `.`; `verify_oauth_state` still verifies a `generate_oauth_state` token — that pair stays).

### B-3 · One key namespace, two callbacks — a handle can be redeemed by the wrong flow

`oauth:pending:{handle}` will hold both Google/BYO and MCP records. Nothing in either plan checks
which flow minted the handle a callback is holding:

- MCP handle → `/connectors/oauth/callback`: resolves, `provider=None`, `exchange_code_for_tokens`
  raises, the broad `except` redirects `token_exchange_failed`. Handle burnt. Harmless but wrong.
- Google handle → `/connectors/mcp/oauth/callback`: resolves with `server_url=None` and
  `token_endpoint` = Google's token URL (plan 02 stores it). `complete_authorization` POSTs the
  Google **client secret** through `_PinnedFetch` to that endpoint and, on success, writes tokens via
  the MCP path. Exploiting it needs a valid `code` for that verifier, so severity is low — but *"one
  implementation"* must not become *"one bucket"*.

**Close inside 225-01:** a `flow: Literal["provider", "mcp"]` field on `PendingOAuthState`, set by
each minting site, and asserted by each `take_*` caller (raise `OAuthStateError` on mismatch —
the handle is still burnt, which is the safe direction). One test per direction in
`test_oauth_state.py`.

## 3 · Advisory gaps — close inside the plans, none blocks

- **A-1** `@deprecated` is `warnings.deprecated`, **Python 3.13**; the venv is **3.12.6**. Use
  `warnings.warn(..., DeprecationWarning)` or a docstring. Also give `verify_oauth_state` and the
  `mcp_oauth:pending:` fallback a dated removal trigger (*"delete after the first prod deploy has
  been live 24 h"*) written in the code, so the transition window closes on purpose.
- **A-2** `mcp_oauth.py:8-20` explains why it *does not* reuse `generate_oauth_state`. After this
  phase the sentence inverts — `oauth_service` now consumes THIS design. Update the header in 225-01,
  same commit, or the file argues with itself.
- **A-3** Redis becomes a hard dependency of the Google flow. A Redis outage raises a connection
  error out of `build_authorization_url`; `create_oauth_authorize_url` catches only `ValueError`, so
  the route 500s. Fail-closed is correct; a 503 with a sentence is better. Record if not taken.
- **A-4** Plan 02 logs the rejected `state` verbatim (`"invalid or expired opaque handle: %s"`).
  A string that is neither opaque nor legacy is attacker-supplied; log its length, not its content.
- **A-5** Threat-model mitigations → tests, the mapping the plans must be able to name:

  | Mitigation | Test that proves it | Status in plans |
  |---|---|---|
  | No secret / verifier in the URL | `test_sc1` **decodes the real emitted `state`** (raw + base64 attempt), asserts no `cv` / `sec_ovr` / `cid_ovr` / secret substring | present |
  | Single use | `test_sc4` second callback → `invalid_or_expired_state` | present |
  | 600 s TTL via ONE `setex` | plan 01 test 1 asserts the 43-char handle but **not the TTL** — pin `setex_calls[0] == (key, 600)` the way `test_222_mcp_oauth.py:181` does | **add** |
  | Fail closed on unknown / expired handle | `test_expired_or_missing_handle_fails` | present |
  | Legacy path still verifies HMAC **and** expiry | `test_sc3` positive only — **add the negative**: tampered legacy state → `invalid_or_expired_state`, never an exchange | **add** |
  | Wrong-flow handle refused | B-3 | **add** |

- **A-6** The *mocks-neither-side* integration test: `test_sc5` must go through the real
  `oauth_callback` route with `get_redis` patched to **one** `FakeRedis` instance shared with the
  authorize call, `take_pending_state` **unpatched**, and only `httpx` mocked. The plan text allows
  this; make it explicit so a hand-constructed `PendingOAuthState` cannot satisfy it. Reuse the
  `FakeRedis` from `test_222_mcp_oauth.py:33` (lift it to `tests/conftest.py` rather than copying).
- **A-7** No `225-VALIDATION.md`. SC#5 says *"driven in a real browser"*; write the manual row now:
  operator connects Google on local → (1) the authorize URL's `state` is 43 chars with no `.`,
  (2) `redis-cli keys 'oauth:pending:*'` is non-empty during consent and **empty** after the
  callback, (3) the connection row reads connected, (4) the browser lands **inside the app** (B-1).
  Claude drives this after execution; the row exists so it cannot be forgotten.
- **A-8** `docs/HOT-FILE-LEDGER.md` section for `connectors.py` + the CLAUDE.md row disposition:
  update in the 225-02 commit (same-commit rule) — *"honoured by construction (225): dual-mode state
  resolution inside the two functions it already owns"*. Run `node scripts/check-claude-md-size.cjs`.
- **A-9** Backend gate reading: record the failing count before and after (224 read **71**), so the
  two new suites' arrival is attributable and B-2's red suites cannot hide in the baseline.
- **A-10** `oauth_service.py` keeps `generate_oauth_state` reachable. Add one test that it is called
  by **nothing in `app/`** (`grep` in a test, the `landingBundleFence` shape) so the unsafe producer
  cannot be quietly re-wired later.
- **A-11** `PendingOAuthState.org_id` is now available in the Google callback; the current code
  fetches `org_id` through the service role from the connection row. Keep the DB read (it also proves
  the connection still exists) — do not swap to the pending value without a test that the two agree.

## 4 · Cross-plan seam audit (derived by grep, not recalled)

| Value | Written by | Read by | Path files | All owned? |
|---|---|---|---|---|
| `oauth:pending:{handle}` → JSON of `PendingOAuthState` | `oauth_state.save_pending_state` (01) ← `oauth_service.build_authorization_url` (02) ← `connectors.create_oauth_authorize_url` (02); `mcp_oauth.begin_authorization` (01) | `oauth_state.take_pending_state` (01) ← `connectors.oauth_callback` (02); `mcp_oauth._take_pending` (01) | `oauth_state.py`, `oauth_service.py`, `mcp_oauth.py`, `connectors.py` | ✅ all four in a plan |
| legacy `payload.sig` state | `generate_oauth_state` (kept) | `verify_oauth_state` (kept) ← `oauth_callback` fallback (02) | `oauth_service.py`, `connectors.py` | ✅ |
| `state` field of `OAuthAuthorizeResponse` | `connectors.py` (02) | frontend: **nobody** | — | n/a |
| redirect target after callback | `connectors.py` both callbacks | frontend: **nobody** (B-1) | `ChatLayout.tsx`, `App.tsx` | ⚠ unowned, pre-existing |

Wave 2 depends on wave 1 by import; a wave-1 unit test cannot green wave 2 by mocking, because
`oauth_callback` imports the real module. The seam risk here is B-3 (shape), not `inputs`-vs-`metadata`
(name).

## 5 · What Claude does after execution

1. Re-run the four suites in B-2 plus the two new ones; read the backend count verbatim.
2. Drive SC#5 in Chrome on local against the real Google project; copy the authorize URL from the
   network log and decode `state` by hand.
3. Replay the callback URL once → expect `invalid_or_expired_state` in the redirect and an empty
   `oauth:pending:*` keyspace.
4. Re-derive the `connectors.py` triple and confirm the ledger row + section moved together.
5. Recommend the operator run `/code-review ultra` on `git diff ae7aac884..HEAD` before merge.
