# Phase 307: Sign In From Claude.ai and Claude Desktop - Pattern Map

**Mapped:** 2026-11-03
**Files analyzed:** 58 (24 new, 34 modified, incl. tests and docs)
**Analogs found:** 56 / 58 (2 with no in-repo analog: the PostgREST-refusal live test, the refresh-rotation state machine)

Every analog below was read this session; line numbers are from the working tree at `565d6ac1f`.

---

## Read these first: six findings that change a plan

These came out of reading the analogs. Five contradict or sharpen RESEARCH.md. The planner should act on them before writing tasks.

| # | Finding | Evidence | What the plan must do |
|---|---|---|---|
| P-1 | **A `client_metadata` egress key with an empty host tuple will fail an existing test.** RESEARCH says extra keys are allowed if they are fully wired. The test also requires a **non-empty** host tuple for every key outside the capability set. Only `send_email` (a capability) may be empty. | `backend/tests/unit/test_190_egress.py:576-583`: `assert ALLOWED_HOST_SUFFIXES[key], (f"{key} is a non-capability key with an EMPTY host tuple; only the caller-supplied arm (send_email) may be empty ...")` | The plan that adds `"client_metadata": ()` + `_CALLER` must also amend that assertion in the same task, so that a `_CALLER`-mode key may be empty, and say why in the test body (the 189/206 rule: retire a fence on purpose, never trip it by accident). Otherwise the 71-failure baseline breaks. |
| P-2 | **The existing pending-state "take" is not atomic, so do not copy it.** `oauth_state.take_pending_state` runs `GET`, then `DELETE` as a separate command. Two workers can both read the same code. D-45 needs MULTI GET+DEL. | `backend/app/services/oauth_state.py:81-84` (`raw = await redis.get(key)` / `await redis.delete(key)`) | Take the **atomic** shape from `api_key_auth.refusal_audit_slot` (`api_key_auth.py:303-306`). Take only the `setex` write from `oauth_state.save_pending_state:59-64`. |
| P-3 | **`register_mcp(app)` also runs against a bare `Starlette` app in tests.** `app.include_router` exists only on FastAPI. Calling it unguarded inside `register_mcp` breaks every `test_305_*` unit test that uses `fresh_app()`. | `backend/tests/unit/_mcp305_harness.py:47-59` (`Starlette(routes=[], lifespan=lifespan); register_mcp(application)`) | Register the `/oauth/*` and `.well-known` routes as Starlette `Route(..., include_in_schema=False)` appended to `app.router.routes`, as `mcp/__init__.py:51-54` does. Include the FastAPI routers (consent, operator allowlist) only `if hasattr(app, "include_router")`, or have them included separately. |
| P-4 | **`/app/connect/<uuid>` cannot be a new `ActiveView`.** `VIEW_PATHS: Record<ActiveView, string>` requires an entry per member. The parity suite pins `expect(VIEWS.length).toBe(12)`. `activeViewReachability.ts` checks every view is reachable inside ChatLayout. The consent page renders *outside* ChatLayout. | `frontend/src/lib/appRoutes.ts:48-79`; `frontend/src/__tests__/routing/appRouteParity.test.ts:116` | Add a separate `AppRoute` member `{ view: "connect"; requestId: string }` that is **not** in `ActiveView`. Add one `viewOf` arm (`head === "connect" && isStrictUuid(id)`) and one `formatAppRoute` arm. Today `parseAppLocation("/app/connect/<uuid>")` returns `not-found` (`viewOf`'s `default`). |
| P-5 | **The 297 routing evaluator cannot see a proxy location or a header.** `resolveNginx` skips any block without `try_files`, so the `/.well-known/oauth-` proxy and the `return 404` block both resolve to `location /` → `/index.html`. `VercelConfig` has no `headers` field, and `vercel.json` has no `headers` key yet. | `frontend/src/__tests__/routing/routingLayers.testutil.ts:13-14, 92-101` | The routing-parity plan adds evaluator helpers: nginx location → `{ kind: "proxy" \| "return" \| "try_files", headers }`, plus Vercel `headers` matching. It also adds a negative control (remove the location, the row flips to SPA). Without these helpers the new rows would pass vacuously. |
| P-6 | **`getAuthHeaders()` stamps the active org.** The consent page renders before `OrgProvider`, and it must read folders for the org the member *picks*. | `frontend/src/lib/api/_core.ts:283-293` (`...(orgId ? { "X-Org-Id": orgId } : {})`) | `lib/api/oauth.ts` sets the header explicitly: `{ ...(await getAuthHeaders()), "X-Org-Id": pickedOrgId }` on `GET /api-keys/folders`. The server already re-validates membership (`get_active_org_id`). |

Also: the redirect-host allowlist is a new `app_settings` column, and RESEARCH leaves `models/user_settings.py` (FIRES) untouched. So it is **not** in `load_app_settings()`. Read and write it live through asyncpg, the way `db/api_keys.mcp_switches` reads `app_settings.mcp_enabled` (`db/api_keys.py:254-265`). That also avoids the 30 s per-worker cache.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/224_mcp_oauth_grants.sql` (NEW) | migration | DDL | `supabase/migrations/222_mcp_usage_limits_and_redaction.sql` + `220_…` (api_keys ALTER/CHECK) + `215_…:73-93` (label index, column grant) | exact |
| `scripts/full-schema-supplement.sql` (FIRES ⛔) | config | DDL mirror | its own mig-222 block, lines 911-919 | exact |
| `backend/app/mcp/oauth_metadata.py` (NEW) | utility | transform (pure) | `services/mcp_tool_catalogue.py:116-160` (`mcp_public_base`, `mcp_url`) | role-match |
| `backend/app/mcp/oauth_server.py` (NEW) | controller | request-response (raw Starlette routes) | `backend/app/mcp/edge.py` (raw send, limiter, import-time responses) + `api/connectors.py:1417-1461` (OAuth redirect, never echo) | role-match |
| `backend/app/mcp/oauth_store.py` (NEW) | store | single-use KV (Redis) | `security/api_key_auth.py:286-310` (atomic MULTI) + `services/oauth_state.py:48-64` (setex only) | exact (with P-2) |
| `backend/app/mcp/oauth_clients.py` (NEW) | utility | validation (pure) | `security/egress.py:380-404, 536-584` (host rules, strict parse) | role-match |
| `backend/app/db/oauth.py` (NEW) | model/db | CRUD | `backend/app/db/api_keys.py` | exact |
| `backend/app/api/oauth_consent.py` (NEW) | controller | request-response (member session) | `backend/app/api/api_keys.py:431-511` (`create_key` → `_create_mcp_key`) | exact |
| `backend/app/api/oauth_admin.py` (NEW) | controller | request-response (operator) | `backend/app/api/admin_spend.py` (sub-router) + `api/admin.py:633-693` (`set_flag` + audit floor) | exact |
| `backend/app/mcp/__init__.py` | config/route registration | — | itself, lines 37-55 | exact |
| `backend/app/mcp/edge.py` | middleware (pure ASGI) | request-response | itself, lines 52-61 | exact |
| `backend/app/mcp/access_log.py` | utility | log filter | itself, lines 22-39 | exact |
| `backend/app/security/mcp_principal.py` | service | auth resolve | itself, lines 21-52 | exact |
| `backend/app/security/api_key_auth.py` (FIRES ⛔) | service | auth resolve | itself, lines 370-424 | exact |
| `backend/app/security/egress.py` (FIRES) | utility | outbound HTTP | itself, `send_email` `_CALLER` arm (lines 236, 247, 334, 386-397) | exact |
| `backend/app/services/rate_limit.py` (FIRES ⛔) | service | Redis counter | itself, `check_ip_limit` (lines 149-160) | exact |
| `backend/app/middleware/maintenance.py` | middleware | request filter | itself, lines 80-84 | exact |
| `backend/app/db/api_keys.py` (FIRES ⛔) | model/db | CRUD | itself | exact |
| `backend/app/api/api_keys.py` (FIRES ⛔) | controller | CRUD | itself, lines 605-676 | exact |
| `backend/app/models/api_key.py` (FIRES) | model | DTO | itself, `McpAvailability` lines 112-119 | exact |
| `backend/tests/unit/test_307_metadata.py`, `test_307_redirect_match.py`, `test_307_token_*.py`, `test_307_edge_oauth.py` (NEW) | test | unit | `tests/unit/test_305_edge_refusals.py` + `_mcp305_harness.py` | exact |
| `backend/tests/integration/test_307_oauth_roundtrip_live.py`, `test_307_removal_live.py` (NEW) | test | live | `tests/integration/test_305_refusals_live.py` + `_305_live.py` | exact |
| `backend/tests/integration/test_307_schema_privileges_live.py` (NEW) | test | live catalog | `tests/integration/test_305_schema_privileges_live.py` | exact |
| `backend/tests/integration/test_307_postgrest_refuses_token_live.py` (NEW) | test | live HTTP to :54321 | — | **no analog** |
| `backend/tests/unit/test_305_edge_refusals.py`, `tests/integration/test_305_refusals_live.py`, `tests/unit/test_190_egress.py` | test | pin update | themselves | exact |
| `frontend/src/components/connect/ConsentPage.tsx` (NEW) | component (page) | request-response | `components/auth/AuthCardShell.tsx` (shell) + `settings/apiKeys/ApiKeysTab.tsx` (alive-ref reads) | role-match |
| `frontend/src/components/connect/ConsentWhoIsAsking.tsx`, `ConsentOrgField.tsx` (NEW) | component | render | `settings/apiKeys/McpKeyFields.tsx` (rows + `Segments` radiogroup) | role-match |
| `frontend/src/components/connect/consentFacts.ts` (NEW) | utility | pure | `settings/apiKeys/mcpKeyFacts.ts` + `mcpSnippets.safeMcpUrl` | exact |
| `frontend/src/components/connect/oauthCopy.ts` (NEW) | config (copy leaf) | — | `settings/apiKeys/mcpKeyCopy.ts` / `apiKeysCopy.ts` (`fillCopy`) | exact |
| `frontend/src/lib/api/oauth.ts` (NEW) | service (client) | request-response | `frontend/src/lib/api/apiKeys.ts:185-241` | exact |
| `frontend/src/components/settings/apiKeys/ConnectedAppsSection.tsx` (NEW) | component | CRUD list | `components/org/OrgApiKeysTab.tsx` | exact |
| `frontend/src/components/settings/apiKeys/ConnectedAppCard.tsx` (NEW) | component | render | `settings/apiKeys/ApiKeyCard.tsx` | exact |
| `frontend/src/components/settings/apiKeys/DisconnectAppSheet.tsx` (NEW) | component | destructive confirm | `settings/apiKeys/RevokeApiKeySheet.tsx` | exact |
| `frontend/src/components/org/OrgConnectedApps.tsx` (NEW) | component | CRUD list + bulk revoke | `components/org/OrgApiKeysTab.tsx` + `RevokeApiKeySheet.tsx` | exact |
| `frontend/src/components/admin/McpSignInHostsCard.tsx` (NEW) | component | read/write setting | `components/org/OrgMcpSwitchCard.tsx` (own read/write) + `admin/MaintenancePanel.tsx` (arm-to-confirm) | exact |
| `frontend/src/App.tsx` (FIRES) | route branch | — | itself, `/invite` branch lines 246-262 | exact |
| `frontend/src/lib/appRoutes.ts` (FIRES ⛔) | utility (route table) | pure | itself, lines 48-151 | exact (see P-4) |
| `frontend/src/lib/returnTo.ts` | utility | pure | itself, lines 47-55 | exact |
| `frontend/src/components/settings/apiKeys/ApiKeysTab.tsx` (FIRES ⛔) | component | mount | itself, line 199 grid | exact |
| `frontend/src/components/org/OrgApiKeysTab.tsx` | component | mount | itself, lines 76-94 | exact |
| `frontend/src/components/settings/apiKeys/McpKeyFields.tsx` | component | prop variant | itself, lines 84-139 | exact |
| `frontend/src/components/settings/apiKeys/McpConnectSnippets.tsx`, `mcpSnippets.ts`, `mcpKeyCopy.ts` (FIRES) | component/utility/copy | pure | themselves | exact |
| `frontend/src/components/admin/ControlRoomPage.tsx` (FIRES), `CapabilityGrid.tsx` (FIRES ⛔) | component | mount / data | themselves, lines 787-801 / 107-110 | exact |
| `frontend/src/components/admin/AuditTab.tsx`, `org/OrgAuditTab.tsx` (FIRES) | component | data read | `OrgAuditTab.tsx:85-104` (`rowLabel` event arms) | exact |
| `frontend/src/lib/api/apiKeys.ts` (FIRES ⛔) | service (client) | type only | itself, `McpAvailability` lines 99-104 | exact |
| `frontend/nginx.conf` (FIRES ⛔) | config | routing | itself, `/api/` block lines 49-75 | exact |
| `frontend/vercel.json`, `frontend/devRouting.ts`, `frontend/vite.config.ts` | config | routing / headers | themselves | role-match (no `headers` yet) |
| `frontend/src/__tests__/routing/appRouteParity.test.ts`, `routingLayers.testutil.ts` | test | parity | themselves | exact (see P-5) |
| `docs/OPERATOR.md`, `docs/DEPLOYMENT-WORKFLOW.md`, `docs/DEPLOYMENT-LESSONS.md`, `docs/HOT-FILE-LEDGER.md` | docs | — | existing sections | n/a |

---

## Pattern Assignments — backend

### `supabase/migrations/224_mcp_oauth_grants.sql` (migration)

**Analog:** `supabase/migrations/222_mcp_usage_limits_and_redaction.sql`

**Header shape** (lines 1-45): number + phase + decision ids; the WHAT list; the `NO AUDIT LITERAL` paragraph; VISIBILITY; `NOT A SEED`; apply discipline (`paste … NEVER db push / db reset … Then: bash scripts/regenerate-full-schema.sh (no --reset)`); the PRODUCTION paste order. For 224 that order is `220 -> 221 -> 222 -> 223 -> 224`, then `get_advisors(security)`.

**Deny-all table block** (lines 47-80). Copy it once per new table (`oauth_clients`, `oauth_tokens`):
```sql
BEGIN;
CREATE TABLE IF NOT EXISTS public.mcp_usage (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
    api_key_id      uuid NULL REFERENCES public.api_keys(id) ON DELETE SET NULL,
    status          text NOT NULL CHECK (status IN ('completed', 'failed')),
    started_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.mcp_usage IS '... Only writer: app/db/mcp_usage.py (service-role pool) ... Deny-all to every client role (RLS on, no policy).';
ALTER TABLE public.mcp_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_usage FROM PUBLIC;
REVOKE ALL ON TABLE public.mcp_usage FROM anon;
REVOKE ALL ON TABLE public.mcp_usage FROM authenticated;
REVOKE ALL ON TABLE public.mcp_usage FROM service_role;
GRANT ALL ON TABLE public.mcp_usage TO service_role;
-- No policy at all on mcp_usage: deny-all to clients (D-55).
...
COMMIT;
```

**Idempotent api_keys column + CHECK** (`220_api_keys_kind_and_mcp_switches.sql:52-68`):
```sql
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'workflow';
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_kind_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_kind_check CHECK (kind IN ('workflow', 'mcp'));
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_mcp_expiry_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_mcp_expiry_check CHECK (kind <> 'mcp' OR expires_at IS NOT NULL);
```
→ `oauth_client_id uuid NULL REFERENCES public.oauth_clients(id) ON DELETE RESTRICT` and `api_keys_oauth_kind_check CHECK (oauth_client_id IS NULL OR kind = 'mcp')`.

**Label index, recreated under the SAME name** (D-53). Original at `215_api_keys_and_run_origin.sql:73-74`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_owner_label_active_uq
    ON public.api_keys (org_id, user_id, lower(btrim(label))) WHERE revoked_at IS NULL;
```
→ `DROP INDEX IF EXISTS public.api_keys_owner_label_active_uq;` then recreate it with `WHERE revoked_at IS NULL AND oauth_client_id IS NULL`. The name must not change: `db/api_keys.py:52` (`_LABEL_INDEX`) catches it by name.

**Column grant: do NOT widen.** `215:92` and supplement `:901` list the `authenticated` SELECT columns explicitly. `oauth_client_id` stays out of that list.

**app_settings allowlist column.** Use the `222:83-96` shape (`ADD COLUMN IF NOT EXISTS … NOT NULL DEFAULT …` + named `DROP/ADD CONSTRAINT` + `COMMENT ON COLUMN`), with the jsonb default `'[{"host":"claude.ai"},{"host":"claude.com"}]'::jsonb`.

---

### `scripts/full-schema-supplement.sql` (FIRES ⛔)

**Analog:** its own mig 222 block (lines 911-919). Add a `-- migration 224 —` block with the same five REVOKE/GRANT lines for each of `oauth_clients` and `oauth_tokens`. The api_keys column grant line (`:901`) is unchanged. No function, so no EXECUTE lines.

---

### `backend/app/mcp/oauth_metadata.py` (utility, pure)

**Analog:** `backend/app/services/mcp_tool_catalogue.py:116-160`

**The one-predicate rule** (lines 119-145): every absolute URL derives from `mcp_public_base()` and never from `Host`. Lazy imports keep the module importable bare:
```python
def mcp_public_base() -> str | None:
    from urllib.parse import urlsplit  # noqa: PLC0415
    from app.config import settings  # noqa: PLC0415 — lazy: this module stays importable bare
    base = str(getattr(settings, "backend_public_url", "") or "").strip().rstrip("/")
    if not base:
        return None
    ...
    return base

def mcp_url() -> str | None:
    base = mcp_public_base()
    if base is None:
        return None
    return base + MCP_PATH
```
`issuer()` returns `mcp_public_base()` as it is. `prm_url()` builds `origin + "/.well-known/oauth-protected-resource" + path(base) + MCP_PATH`. Build the bodies with `mcp.shared.auth.OAuthMetadata` / `ProtectedResourceMetadata`, `model_dump(exclude_none=True)` (RESEARCH §Code Examples). The test asserts byte equality across PRM `authorization_servers[0]`, AS `issuer`, `iss` and `mcp_public_base()` for the three bases.

---

### `backend/app/mcp/oauth_server.py` (controller, raw routes)

**Analog A:** `backend/app/mcp/edge.py`

**Import-time response constants** (lines 48-61). Use these for token-endpoint errors and the 503 text page:
```python
def _json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, separators=(",", ":")).encode()

_INVALID_BODY = _json_bytes({"error": "invalid_token", "error_description": "..."})
_INVALID_HEADERS = [
    (b"content-type", b"application/json"),
    (b"www-authenticate", b"Bearer"),
    (b"content-length", str(len(_INVALID_BODY)).encode()),
]
```

**Limiter before anything else, fail closed** (lines 124-139):
```python
client = (scope.get("client") or ("unknown",))[0] or "unknown"
try:
    retry = await rate_limit.check_ip_limit(get_redis(), client=str(client))
except rate_limit.LimiterUnavailable:
    await _send_json(send, 503, {"error": "unavailable", "error_description": rate_limit.UNAVAILABLE_DETAIL})
    return
if retry is not None:
    await _send_json(send, 429, {...}, [(b"retry-after", str(retry).encode())])
    return
```
Swap `check_ip_limit` for a per-kind `check_oauth_limit(redis, client=..., kind="oauth_token")` (see rate_limit below). Token answers add `cache-control: no-store` and `pragma: no-cache`.

**No traceback, ever** (lines 155-159): `except Exception: logger.exception(...); 503`.

**Analog B — OAuth browser redirects:** `backend/app/api/connectors.py:1436-1461`
```python
frontend_url = primary_frontend_origin()  # BUG-260904-04: FRONTEND_URL is a LIST
# ⚠ `error_description` IS LOGGED AND NEVER PUT IN THE REDIRECT ...
except (RedisError, ConnectionError, TimeoutError, OSError) as exc:
    logger.error("mcp oauth: redis outage during authorization: %s", exc)
    return RedirectResponse(url=f"{frontend_url}/app?...redis_unavailable", status_code=307)
```
`/oauth/authorize` sends the browser to `f"{primary_frontend_origin()}/app/connect/{uuid}"`. That covers the valid case and the stored-refused case (D-10, UI-SPEC wire). Build query strings with `urllib.parse.urlencode` (the `mcp_oauth.begin_authorization:185-201` shape, `separator = "&" if "?" in … else "?"`).

**PKCE literal rule.** Inbound mirror of `services/mcp_oauth.py:190-195`: S256 is hardcoded and never negotiated. Refuse a missing `code_challenge_method` and refuse `plain`.

**Body parsing.** `/token` and `/revoke` read `await request.form()` (python-multipart is installed). `/register` reads JSON with a 16 KB cap.

---

### `backend/app/mcp/oauth_store.py` (store, Redis single-use)

**Analog for the atomic take (copy this):** `backend/app/security/api_key_auth.py:303-306`
```python
async with redis.pipeline(transaction=True) as pipe:  # GET + DEL in one MULTI (Redis 5+)
    pipe.get(pending)
    pipe.delete(pending)
    suppressed, _ = await pipe.execute()
```
**Analog for the write (copy only this half):** `backend/app/services/oauth_state.py:55-63`
```python
# ⚠ `setex`, not `set` + `expire`: a crash between two commands parks a
# credential-bearing record in Redis with no expiry, forever.
await redis.setex(key, ttl_seconds, payload_json)
```
⛔ Do not copy `take_pending_state` (`oauth_state.py:81-84`): it is non-atomic (P-2). Keys follow RESEARCH §Redis keys: `oauth:req:{uuid}` (600 s), `oauth:code:{sha256}` (60 s), `oauth:codeused:{sha256}`, `oauth:cimdfail:{sha256}`. The page read of a request is a plain GET, not consuming. Approve and deny consume it.

---

### `backend/app/mcp/oauth_clients.py` (utility, pure validation)

**Analog:** `backend/app/security/egress.py`

**Label-boundary host rule + normalisation** (lines 380-404):
```python
def _normalise_host(host: str) -> str:
    return host.lower().rstrip(".")

def _host_is_allowed(capability: str, host: str, allowed_host: str | None) -> bool:
    mode = _HOST_MATCH[capability]
    if mode is _CALLER or mode == _CALLER:
        if not allowed_host:
            return False  # fail closed: no configured host means no permitted destination
        return host == _normalise_host(allowed_host)
```
**Strict parse refusals** (`validate_mcp_destination`, lines 536-570): unparseable, non-https scheme, no host, and non-ASCII host are each refused with a reason code. Redirect matching (RESEARCH §Redirect matching) compares **raw strings after a strict parse**, never `pydantic.AnyUrl` (it normalises). Frontend twin for the same idea: `mcpSnippets.safeMcpUrl` (`mcpSnippets.ts:49-61`) refuses query and hash.

---

### `backend/app/db/oauth.py` (db, CRUD)

**Analog:** `backend/app/db/api_keys.py`

**Module docblock rules to restate** (lines 6-25): the owner predicate in every statement, with one documented owner-agnostic exception (the token digest lookup, like `get_key_for_auth`); jsonb bound as a plain `list` with no `json` import (the mig 123 defect); and the digest never leaving the module toward a client.

**Owner-agnostic auth lookup** (lines 152-164). Model `get_access_token_for_auth(pool, digest)` on it, joining the grant's `_AUTH_COLUMNS`:
```python
async def get_key_for_auth(pool: asyncpg.Pool, key_hash: str) -> dict | None:
    """The resolver's lookup, by digest. ⚠ OWNER-AGNOSTIC BY DESIGN — the one statement here
    without an ``org_id`` / ``user_id`` predicate. ..."""
    row = await pool.fetchrow(f"SELECT {_AUTH_COLUMNS} FROM api_keys WHERE key_hash = $1", key_hash)
    return dict(row) if row is not None else None
```
**Revoke that reports whether THIS call revoked** (lines 193-207). Use it for revoke-all (`RETURNING id, user_id`) and family revoke:
```python
status = await pool.execute(
    f"UPDATE api_keys SET revoked_at = now(), revoked_by = {by} "
    f"WHERE {scope} AND revoked_at IS NULL", *args, revoked_by)
...
return {**dict(row), "revoked_now": str(status or "").strip() == "UPDATE 1"}
```
Refresh rotation uses `async with pool.acquire() as conn, conn.transaction():` with `SELECT … FROM api_keys WHERE id=$1 FOR UPDATE` and then the refresh row `FOR UPDATE` (RESEARCH §Token lifecycle). There is no in-repo `FOR UPDATE` rotation analog. Follow RESEARCH.

---

### `backend/app/api/oauth_consent.py` (controller, member session)

**Analog:** `backend/app/api/api_keys.py:454-511` (`_create_mcp_key`). Factor this validator so both routes call it (RESEARCH §Don't Hand-Roll):
```python
switches = await api_keys_db.mcp_switches(pool, org)   # live, never the settings cache
off = _mcp_off(switches)
if off == "unknown":
    raise HTTPException(status_code=403, detail=MCP_STATE_UNKNOWN_SENTENCE)
if off == "deployment":
    raise HTTPException(status_code=403, detail=MCP_OFF_DEPLOYMENT_SENTENCE)
if off == "org":
    raise HTTPException(status_code=403, detail=MCP_OFF_ORG_SENTENCE)

selection = normalise_tool_selection(body.tools)
if selection.refusal is not None or selection.tools is None:
    raise HTTPException(status_code=422, detail=selection.refusal)

folder_ids: list[str] | None = None
if body.folder_ids is not None:
    async with acting_member_connection(user_id=str(caller), org_id=str(org)) as conn:
        visible = {f["id"] for f in await list_acting_folders(conn)}
    folder_ids = [str(f) for f in body.folder_ids]
    if any(f not in visible for f in folder_ids):
        raise HTTPException(status_code=422, detail=_FOLDER_NOT_VISIBLE)
```
The grant insert reuses `api_keys_db.create_api_key(..., kind="mcp", ...)` (lines 487-500) with a `mint_key("mcp")`-shaped never-shown secret. The function needs one new `oauth_client_id` kwarg. Audit through `audit_key_call(..., "api_key.create", call="manage")` (lines 504-509) with `detail={"credential": "oauth", "client_name": …, "redirect_host": …}` (D-28).

**Auth dependency:** `current_user: dict = Depends(get_current_user)` (line 349). The org is the body's explicit `org_id`, validated against membership. It is never `get_active_org_id` (RESEARCH §Integration Points).

---

### `backend/app/api/oauth_admin.py` (controller, operator)

**Analog A:** `backend/app/api/admin_spend.py`. It is a separate module, so it is G-5-isolated from `admin.py` ⛔. Lines 1-4 and 31: `router = APIRouter()`. It inherits `require_operator` through `admin.router`. Because 307 must not edit `admin.py`, declare the gate on the new router itself, as `admin.py:250-254` does:
```python
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_operator)])
```
This keeps the route under `/admin`, so `maintenance.py`'s `/admin` allowlist already covers it. Mark it `include_in_schema=False`.

**Analog B — operator audit floor on a write** (`api/admin.py:633-693`, `set_flag`):
```python
@router.put("/flags", status_code=status.HTTP_204_NO_CONTENT)
async def set_flag(request: Request, body: FlagUpdate, _floor: None = Depends(operator_audit_floor)):
    ...
    request.state.audit_action = f"flag.{body.key}.{'on' if body.value else 'off'}"
    request.state.audit_label = f"Turned {on} {_FLAG_HUMAN_NAMES[body.key]} for everyone"
```
Floor semantics are at `dependencies.py:526-556`. Resolve RESEARCH Open Question 2 here: the floor writes `operator_audit_log` with free `action` strings. That is a different table from `audit_log`, whose CHECK must stay untouched.

---

### `backend/app/mcp/__init__.py` (route registration)

**Analog:** itself, lines 37-55. The refuse-mount guard comes first. Routes are `Route(..., include_in_schema=False)` appended to `app.router.routes`, never a `Mount`:
```python
base = mcp_public_base()
if base is None:
    logger.critical("MCP: NOT MOUNTED — ...")
    return
...
for path in (MCP_PATH, MCP_PATH + "/"):
    app.router.routes.append(Route(path, endpoint=mcp_edge, methods=["POST"], include_in_schema=False))
access_log.install()
```
OAuth routes go inside the same guard (D-02: no base means no OAuth either). Apply the P-3 rule to the FastAPI routers. Every route carries a real `methods=[…]` (test_284 walks `route.methods`).

---

### `backend/app/mcp/edge.py` (the one 401)

**Analog:** itself, lines 52-61 and 141-154. Keep the single constant. Change only the header value to `Bearer resource_metadata="<prm_url()>"`, built once per base (import time is too early if tests reconfigure the base, so build it inside `register_mcp`, or memoise on the base). Every branch that sends `_INVALID_BODY, _INVALID_HEADERS` stays byte-identical across key and token failures (T-307-16).

**Pins to update in the same task** (RESEARCH Pitfall 8):
- `backend/tests/unit/test_305_edge_refusals.py:126`: `assert (b"www-authenticate", b"Bearer") in ...`
- `backend/tests/integration/test_305_refusals_live.py` (the `assert (b"www-authenticate", b"Bearer") in first[2]` line, about line 79)

---

### `backend/app/mcp/access_log.py`

**Analog:** itself, lines 22-23. Widen `_is_mcp_path` to include `/oauth/` (keep the segment-boundary rule: `path == p or path.startswith(p + "/")`). The filter class is unchanged.

---

### `backend/app/security/mcp_principal.py` + `api_key_auth.py` (FIRES ⛔): the one resolver

**Analog:** `mcp_principal.py:21-52` and `api_key_auth.py:370-424`.

The swap point already exists (`mcp_principal.py:29`): `credential_kind: Literal["key"] = "key"` → `Literal["key", "oauth"]`.

Split `authenticate_presented_key` at line 396. Lines 380-394 are the **lookup** (digest → `get_key_for_auth` → `hmac.compare_digest`). Lines 396-424 are the **shared admission tail**:
```python
if row.get("kind", "workflow") != expected_kind:
    raise await _refused(row, call=call, reason="wrong_kind", redis=redis)
refusal = await principal_still_allowed(pool, key_row=row)
if refusal is not None:
    raise await _refused(row, call=call, reason=refusal.reason, redis=redis, sentence=refusal.sentence)
...
await api_keys_db.touch_last_used(pool, row["id"], org_id=row["org_id"])
return ResolvedKey(...)
```
Add to the tail: on the key path, `oauth_client_id` must be absent (else `wrong_kind`, D-15); on the token path, it must be present. **Digest shape** for `srl_oat_` is `digest_key` (lines 129-143: prefix check, ≤ 128 chars, `_KEY_BODY` urlsafe). Unknown or expired tokens raise `KeyRefused("unknown")` unaudited (lines 384-392 pattern). `wrong_resource` is audited through `_refused`.

`principal_liveness.py` stays a leaf and is untouched (`principal_still_allowed`, lines 56-86).

---

### `backend/app/security/egress.py` (FIRES): `client_metadata` capability

**Analog:** the `send_email` `_CALLER` arm: `ALLOWED_HOST_SUFFIXES["send_email"] = ()` (line 247), `_HOST_MATCH["send_email"] = _CALLER` (line 334), plus a `_TLS_SCHEMES` entry (`frozenset({"https"})`, lines 353-371). Wire all three tables in one edit and add a comment block in the house style ("⚠ A NEW KEY, ADDED DELIBERATELY …"). The caller passes `allowed_host=<host of the client_id URL>`:
```python
await asyncio.wait_for(
    egress.send_pinned_http("client_metadata", "GET", client_id_url, allowed_host=host,
                            timeout=4.0, max_bytes=16_384,
                            headers={"Accept": "application/json", "User-Agent": "Syrel-OAuth/1"}),
    5.0)
```
`wait_for` is required because `getaddrinfo` is not bounded by the httpx timeout (`egress.py:741-749`). **⚠ P-1:** amend `test_190_egress.py:580-583` in the same task.

---

### `backend/app/services/rate_limit.py` (FIRES ⛔)

**Analog:** itself, lines 141-160 (`mcp_ip`: its own bucket kind, raises `LimiterUnavailable`):
```python
Kind = Literal["start", "read", "citation", "mcp_ip", "expensive"]
...
async def check_ip_limit(redis, *, client: str) -> int | None:
    try:
        return await hit(redis, key_id=client, kind="mcp_ip", limit=int(IP_CALLS_PER_MINUTE))
    except Exception as exc:  # noqa: BLE001
        logger.warning("mcp per-address limiter unavailable; refusing the call", exc_info=True)
        raise LimiterUnavailable() from exc
```
Add four `Kind` literals (`oauth_register|authorize|token|revoke`), module constants for the limits (the `IP_CALLS_PER_MINUTE` / `CITATION_CHECKS_PER_MINUTE` precedent: no env var, no setting), and one `check_oauth_limit(redis, *, client, kind)`.

---

### `backend/app/middleware/maintenance.py`

**Analog:** itself, lines 80-84 (the `MCP_PATH` arm):
```python
if path == MCP_PATH or path.startswith(MCP_PATH + "/"):
    return True
```
Add an exact-path set `{"/oauth/token", "/oauth/revoke", "/oauth/register"}` (RESEARCH Pitfall 13). Approve stays blocked. GETs already pass (`_PASSTHROUGH_METHODS`, line 42). Test analog: `tests/unit/test_305_maintenance.py`.

---

### `backend/app/db/api_keys.py` (FIRES ⛔) + `api/api_keys.py` (FIRES ⛔) + `models/api_key.py`

- `_KEY_COLUMN_NAMES` / `_AUTH_COLUMNS` (`db/api_keys.py:38-50`): add `oauth_client_id` to `_AUTH_COLUMNS` only, or to both under the **three-place lockstep** (lines 23-25: `_KEY_COLUMNS`, `ApiKeyRead`, serializer in one commit).
- `list_keys_for_owner` / `list_keys_for_org` (lines 128-149): append `AND k.oauth_client_id IS NULL` (D-25: grants never in a key list).
- Connected-apps routes copy `list_my_keys` (`api/api_keys.py:347-359`) and `revoke_org_key` (`:650-676`). The existing `revoke_my_key` (`:605-629`) gains the `credential='oauth'` detail when the row has `oauth_client_id`:
```python
if row.get("revoked_now"):  # 296-06 (293-IN-08): a repeat revoke writes no second row
    audit_key_call(background_tasks, {"id": row["id"], "label": row["label"], "user_id": caller,
                   "org_id": org, "kind": row.get("kind")}, "api_key.revoke", call="manage",
                   detail={"by_admin": True, "owner_id": str(row["user_id"])})
```
- `McpAvailability` (`models/api_key.py:112-119`) gains `oauth: bool = False`. Mirror it in `frontend/src/lib/api/apiKeys.ts:99-104`. Regenerate the public OpenAPI snapshot (`scripts/build-public-openapi.cjs`) in the same commit (RESEARCH Pitfall 12).

---

## Pattern Assignments — backend tests

### Unit (`test_307_*.py`)

**Analog:** `backend/tests/unit/test_305_edge_refusals.py` + `_mcp305_harness.py`.
- `h.configure(monkeypatch, base=...)` (harness lines 40-44) switches `backend_public_url` and `environment`. Use it for the three-topology metadata test (`http://localhost:8000`, `https://api.example`, `https://h/api`).
- `TestClient(h.fresh_app(), base_url=h.BASE)` (edge test line 98) is the per-test app. This is why P-3 matters.
- Identical-401 fingerprint (lines 72-73, 119-129): `(r.status_code, r.content, sorted(r.headers.raw))`. Extend `CASES` with token cases (unknown `srl_oat_`, expired, revoked grant, wrong resource).
- "Pool must not be used" stub (lines 32-34) proves a malformed token is refused before any read.

### Live (`test_307_oauth_roundtrip_live.py`, `test_307_removal_live.py`)

**Analog:** `backend/tests/integration/test_305_refusals_live.py` + `_305_live.py`.
```python
@pytest.fixture(scope="module")
def server():
    with live.serve(workers=1) as srv:
        yield srv

async with live.mcp_world(pg_pool) as w:   # real GoTrue member + org, cleaned up
    key, _ = await w.mint()
    ...
    await pg_pool.execute("UPDATE public.organizations SET mcp_enabled = false WHERE id = $1::uuid", w.org)
```
`McpWorld.cleanup` (`_305_live.py:209-223`) deletes `audit_log` and then `api_keys` by user. Extend it to delete `oauth_tokens` / `oauth_clients` (FK `ON DELETE RESTRICT` from `api_keys.oauth_client_id`: delete grants first, then clients). Every removal case follows the 305 "call OK → apply removal → next call refused" shape (`test_305_refusals_live.py` `test_an_org_that_switched_mcp_off…`).

### `test_307_schema_privileges_live.py`

**Analog:** `backend/tests/integration/test_305_schema_privileges_live.py` (whole file). Copy:
- `has_table_privilege` parametrised over `("anon","authenticated") × ("SELECT","INSERT","UPDATE","DELETE")` (lines 64-78);
- RLS on, zero policies (lines 54-61);
- the ONE transaction-local `SET LOCAL ROLE anon` against a **policy-less** table, rolled back via `_Rollback` (lines 81-101). Use `oauth_tokens`. ⛔ Never against `api_keys` (BUG-261031-01);
- `has_column_privilege('authenticated','public.api_keys','oauth_client_id','SELECT') is False` (lines 124-130 shape).

### `test_307_postgrest_refuses_token_live.py`: no analog

No existing test calls local PostgREST (`:54321/rest/v1`) with a foreign bearer. Use RESEARCH §Verification map: `httpx.get(f"{SUPABASE_URL}/rest/v1/api_keys?select=id", headers={"apikey": anon, "Authorization": f"Bearer {token}"})` → 401, no rows. Same against `/auth/v1/user`. Guard it like `requires_pg` with a `:54321` reachability skip.

---

## Pattern Assignments — frontend

### `frontend/src/components/connect/ConsentPage.tsx` (page)

**Shell analog:** `frontend/src/components/auth/AuthCardShell.tsx:30-56`. It takes `title`, `subhead` and `children` and is pure presentational. The consent page renders **inside** it, never inside ChatLayout (UI-SPEC):
```tsx
export function AuthCardShell({ title, subhead, children }: AuthCardShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      ...
      <Card className="w-full max-w-md ghost-border bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 relative z-10">
```
**Read analog (alive ref, keep last-known on failure):** `ApiKeysTab.tsx:88-100, 143-151`:
```tsx
const alive = useRef(true)
const load = useCallback(async () => {
  try {
    const res = await listApiKeys()
    if (!alive.current) return
    setList(res); setLoadError(null)
  } catch (err) {
    if (alive.current) setLoadError(messageOf(err)) // keep the last-known list
  }
}, [])
useEffect(() => { alive.current = true; void load(); return () => { alive.current = false } }, [load])
```
Navigation away: `consentFacts` host check, then `window.location.replace(url)` (UI-SPEC §Interaction). Add the framed-page guard `window.top !== window.self`.

### `ConsentOrgField.tsx` / `ConsentWhoIsAsking.tsx` / `McpKeyFields.tsx` (`variant` prop)

**Analog:** `McpKeyFields.tsx:84-139`. The props block and row grid (`grid gap-1 md:grid-cols-[128px_1fr] md:gap-4`) and the `Segments` radiogroup (`labelledBy/options/value/label/onChange`, lines 43-47). For the new optional prop `variant?: "draft" | "consent"` (default byte-identical), "consent" hides the Organisation row (lines 129-139), the Expires row and the acts-as note.

### `consentFacts.ts` / `oauthCopy.ts`

**Analogs:** `mcpKeyFacts.ts` (pure exported helpers, e.g. `mcpCreateBlocker` at `:121`, `mcpScopeChips` at `:206`) and `mcpKeyCopy.ts` / `apiKeysCopy.ts` (import-free copy leaf + `fillCopy(template, slots)`). The host-match guard reuses the `safeMcpUrl` parse discipline (`mcpSnippets.ts:49-61`).

### `frontend/src/lib/api/oauth.ts`

**Analog:** `frontend/src/lib/api/apiKeys.ts:185-241`:
```ts
export async function revokeApiKey(keyId: string): Promise<ApiKeyRead> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api-keys/${encodeURIComponent(keyId)}/revoke`, { method: "POST", headers })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as ApiKeyRead
}
```
A per-org override is required (P-6). D-40 keeps `frontend/src/lib/api.ts` (the barrel) untouched: import from `@/lib/api/oauth` directly.

### `ConnectedAppsSection.tsx` / `OrgConnectedApps.tsx`

**Analog:** `frontend/src/components/org/OrgApiKeysTab.tsx` (whole file): its own read, the `alive` ref, loading `role="status"`, the failure `role="alert"` with Retry (lines 96-111), the empty state card (lines 113-120), and `onRecorded?.()` + reload after a server-confirmed revoke (lines 141-144). Header card classes: `ghost-border rounded-xl bg-card/60 p-6 shadow-sm` (line 77).

### `DisconnectAppSheet.tsx` and the "Disconnect all" sheet

**Analog:** `frontend/src/components/settings/apiKeys/RevokeApiKeySheet.tsx`. It is never optimistic (lines 84-98): `await revoke(id); onDone(); onClose()`, and a failure keeps the sheet open with the server's words. Radix `AlertDialog` with the destructive top border (line 115: `max-w-[480px] border-destructive/45 border-t-[3px] border-t-destructive`). Victim facts sit in a bulleted list with bold slots (lines 135-177). Cancel holds focus (`AlertDialogCancel`, line 195). `RevokeApiKeySheet` itself stays unchanged (UI-SPEC).

### `McpSignInHostsCard.tsx` (Control Room)

**Analog A:** `frontend/src/components/org/OrgMcpSwitchCard.tsx`. Its own read and write, the `alive` ref, never optimistic, no control on a failed read (lines 9-14, 44-77), and `onRecorded?.()` after a successful write.
**Analog B (remove = arm-to-confirm):** `frontend/src/components/admin/MaintenancePanel.tsx:38-125`. The first click arms and Confirm acts. Cancel disarms. `busy` and `failed` state, direction-aware wording.
**Mount:** `ControlRoomPage.tsx:789-799`, between `<CapabilityGrid … />` and `<MaintenancePanel … />`, with `onRecorded={pulseRecording}` (`pulseRecording` defined at line 499).

### `App.tsx` / `appRoutes.ts` / `returnTo.ts`

- **App branch analog:** the `/invite` branch (`App.tsx:255-262`). This one is placed *after* `if (!user) return <AuthPage …/>` (UI-SPEC) and before the `<OrgProvider>` stack:
```tsx
const atInvitePath = window.location.pathname === "/invite"
if (atInvitePath) {
  return <AcceptInvitePage user={user} onSignIn={signIn} onSignUp={signUp} />
}
if (!user) {
  return <AuthPage onSignIn={signIn} onSignUp={signUp} />
}
```
- **Route arm analog:** `appRoutes.ts:144-151` (`if (head === "runs" && isStrictUuid(id)) return { view: "workflow-run", runId: id.toLowerCase() }`) plus a `formatAppRoute` arm (lines 92-96 shape). **P-4:** add the member outside `ActiveView`.
- **returnTo analog:** `returnTo.ts:47-55`. Widen the `ReturnKind` union and add `["requestId", "the page that connects your app"]` to `KIND_BY_KEY`. `RETURN_LINE.signin(kind)` (line 73) then yields the UI-SPEC sentence.

### `ApiKeysTab.tsx` / `OrgApiKeysTab.tsx`: one mount each

- `ApiKeysTab.tsx:199`: insert `<ConnectedAppsSection mcpUrl={mcp?.url ?? null} mcpTools={mcp?.tools} oauthAvailable={mcp?.oauth ?? false} />` as the grid's first child, before the header card at line 200. `mcp` is already in scope (line 186).
- `OrgApiKeysTab.tsx:94-96`: insert `<OrgConnectedApps orgName={orgName} mcpTools={mcpTools} onRecorded={onRecorded} />` between the header card's closing `</div>` (line 94) and the loading line (line 96).

### `mcpSnippets.ts` / `McpConnectSnippets.tsx` / `mcpKeyCopy.ts` (D-29)

- `mcpSnippets.ts:30-33, 95-120`: delete `MCP_REMOTE_VERSION`, `mcpRemotePackage` and `desktopBridgeSnippet`. Change the `desktop` builder in `MCP_SNIPPET_BUILDERS` to a URL-only text (still `(mcpUrl, envVarName) => string`, so no key parameter exists).
- `McpConnectSnippets.tsx:136-156`: remove the `workaroundChip`, `desktopLead` and `desktopUnverified` branches. The Claude.ai warning note (line 167) stays.
- Tests to update together: `__tests__/mcpSnippets.test.ts`, `__tests__/McpConnectSnippets.test.tsx`.

### `CapabilityGrid.tsx` (FIRES ⛔): data only

`CapabilityGrid.tsx:107-110`, the `mcp_enabled` entry: reword `sub` and `fallbackImpact` only. No element, prop or union change.

### `AuditTab.tsx` / `OrgAuditTab.tsx`: one event read each

**Analog:** `OrgAuditTab.tsx:85-104` (`rowLabel` reads `metadata.event` before falling back to `actionLabel`). Add an arm for `metadata.credential === "oauth"` on `api_key.create` / `api_key.revoke`. The literal maps (`AuditTab.tsx:89-90`, `OrgAuditTab.tsx:59-60`) are unchanged (D-28: no new literal).

### `nginx.conf` (FIRES ⛔) / `vercel.json` / `devRouting.ts` / `vite.config.ts`

- **nginx analog:** the `/api/` block (`nginx.conf:52-69`): the variable upstream, the `proxy_set_header` set, and placement **after** `set $backend_upstream` (line 50). The new `location ^~ /.well-known/oauth-` uses `proxy_pass $backend_upstream;` with **no** rewrite (the path passes unchanged). The consent `location ^~ /app/connect/` uses `try_files /app.html =404;` so `add_header … always` survives (RESEARCH F-10). The exact blocks are in RESEARCH §Routing per topology.
- **vercel.json:** no `headers` key exists today (keys: `redirects` at line ~5, `rewrites` at line 94). Add a top-level `headers: [{ source: "/app/connect/(.*)", headers: [...] }]`.
- **devRouting.ts:** pure function (lines 14-31). Add a pure `devHeadersFor(pathname)` helper beside it. `vite.config.ts:19-23` (`configureServer` → `server.middlewares.use`) is the only caller that sets them.

### Routing suite (`appRouteParity.test.ts`, `routingLayers.testutil.ts`)

**Analog:** the existing `it.each(ALL)` blocks (`appRouteParity.test.ts:136-158`) and the `LEGACY` / `PRE_AUTH` literal arrays (lines 57-58). Add the consent route as a literal (like `LEGACY`), not via `VIEWS`. **P-5:** extend `resolveNginx` (lines 87-108, which currently skips non-`try_files` blocks) and the `VercelConfig` type (line 14) before adding header and proxy rows.

---

## Shared Patterns

### One identical refusal (credential failures)
**Source:** `backend/app/mcp/edge.py:52-61` (built once), `api_key_auth.py:105-114` (`KeyRefused(reason, sentence)`).
**Apply to:** the edge (keys and tokens alike), `/oauth/token` `invalid_grant` (one body for every dead code or refresh), `/oauth/revoke` (always 200, D-20).

### Audit without a new literal
**Source:** `api_key_auth.audit_key_call` (`:194-224`, returns normally) / `audit_key_call_now` (`:227-252`, before a raise) / `_refused` throttle (`:364-367`).
**Apply to:** grant create/revoke (`api_key.create` / `api_key.revoke` + `detail.credential="oauth"`), `refresh_reuse` / `wrong_resource` (`api_key.refused`), and org revoke-all (one row with a count). ⚠ The `audit_key_call` docblock (`:212-215`) says a BackgroundTask added before a raise never runs. Any path that audits and then raises must use `audit_key_call_now`.

### Fail-closed Redis
**Source:** `rate_limit.py:10-11, 149-160`; `connectors.py:1453-1458`.
**Apply to:** every OAuth limiter, the request and code store (503 / `temporarily_unavailable`), and the CIMD negative cache.

### Owner predicate in every SQL statement (service-role pool)
**Source:** `db/api_keys.py:6-12, 167-207`.
**Apply to:** `db/oauth.py`, connected-apps lists, revoke-all (`WHERE org_id=$1 AND oauth_client_id IS NOT NULL`).

### Absolute URLs from one predicate
**Source:** `mcp_tool_catalogue.mcp_public_base` (`:119-145`) and `config.primary_frontend_origin()` (used at `connectors.py:1436`).
**Apply to:** issuer, PRM URL, the 401 header, endpoints, and the consent redirect. Never `request.url`, `Host` or `X-Forwarded-*`.

### Blocking I/O off the loop
**Source:** `api_key_auth.audit_key_call_now:251` (`await run_in_threadpool(get_service_role_supabase, org)`), `egress.send_pinned_http:761`.
**Apply to:** any supabase-py client build in OAuth handlers. Bound the CIMD fetch with `asyncio.wait_for`.

### Frontend: never optimistic, alive ref, copy leaf
**Source:** `RevokeApiKeySheet.tsx:10-13, 84-98`; `OrgMcpSwitchCard.tsx:9-14`; `ApiKeysTab.tsx:88-100`; `mcpKeyCopy.ts` / `fillCopy`.
**Apply to:** every new component. Every new string lives in `oauthCopy.ts` (the 293/304 stray-literal sweeps extend to the new files).

### Migration discipline
**Source:** `222_…:35-45` header; supplement `:911-919`; `test_305_schema_privileges_live.py`.
**Apply to:** mig 224. Paste it locally, then run `bash scripts/regenerate-full-schema.sh` (no `--reset`) and `python scripts/check-greenfield-privileges.py`. Cloud paste needs per-action approval.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/tests/integration/test_307_postgrest_refuses_token_live.py` | test | live HTTP to local Supabase API | No suite calls `:54321/rest/v1` or `/auth/v1` with a foreign bearer. Use RESEARCH §Verification map. |
| Refresh rotation + 60 s grace + family revoke (inside `oauth_server.py` / `db/oauth.py`) | service | transactional state machine | No `SELECT … FOR UPDATE` rotation exists in the repo. Use RESEARCH §Token lifecycle verbatim (D-46/D-48). |

---

## Metadata

**Analog search scope:** `backend/app/{mcp,security,services,db,api,middleware,models}`, `backend/tests/{unit,integration}`, `supabase/migrations/{215,220,222,223}`, `scripts/full-schema-supplement.sql`, `frontend/src/{components/{settings/apiKeys,org,admin,auth},lib,__tests__/routing}`, `frontend/{nginx.conf,vercel.json,devRouting.ts,vite.config.ts}`
**Files read or grepped:** 45
**Pattern extraction date:** 2026-11-03
