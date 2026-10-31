# Phase 305: Connect Claude Code and Cursor - Pattern Map

**Mapped:** 2026-10-31
**Files analyzed:** 52 new or modified (backend 33, frontend 12, scripts/docs/migrations 7), plus the new `test_305_*` suites
**Analogs found:** 47 / 52. The 5 without an analog are the SDK-facing `server.py`, `scripts/mcp-timeout-probe.py`, the redactor's checksum validators, the chunker and the `outbound_guard` field walker. For those, use RESEARCH.md Patterns 1-3 and Code Examples.

Inputs: `305-CONTEXT.md` (D-01..D-58; D-46..D-58 supersede earlier decisions) and `305-RESEARCH.md` (R-01..R-29, the plan split, the hot-file table). Every excerpt below was read from the tree at `51287c097`.

---

## File Classification

### Plan 305-01: foundation (wave 1, alone)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/requirements.txt` (mod) | config | — | itself, line 2 `sse-starlette==2.4.1` | exact |
| `backend/Dockerfile` (mod: `--timeout-graceful-shutdown`) | config | — | itself, line 43 CMD | exact |
| `backend/tests/integration/test_059_disconnect.py` (mod: fixture retired) | test fixture | — | `backend/tests/unit/test_189_no_egress.py:246-256` (D-206-07 conscious retirement) | exact (precedent) |
| `backend/app/mcp/__init__.py` (new: `register_mcp`, `mcp_lifespan`) | config / route registration | request-response | `main.py:963-965` include_router block + lifespan `yield` at `main.py:653` | role-match |
| `backend/app/mcp/edge.py` (new: pure-ASGI McpEdge) | middleware | request-response | `backend/app/middleware/maintenance.py` + `canvas_gate.py:223-259`; auth from `api_key_auth.resolve_api_key:316-333`; IP limit from `inbound._client_limit:263-265` | exact |
| `backend/app/mcp/transport.py` (new: allowed hosts, refuse-mount) | utility | — | `mcp_tool_catalogue.mcp_url:119-132`, `inbound._is_loopback:455-458`, `api_docs.is_production_environment:82-86` | role-match |
| `backend/app/mcp/server.py` (new: lowlevel `Server`) | service (protocol) | request-response | **none.** Use RESEARCH Pattern 3 | — |
| `backend/app/mcp/dispatch.py` (new: pipeline + maintenance guard + catch-all) | service | request-response | `inbound.start_workflow_run:291-306` ordering (`_limit` then work) + `acting_member_reads.ToolNotGranted:89-94` | role-match |
| `backend/app/mcp/access_log.py` (new: `logging.Filter`) | utility | transform | `backend/app/services/logging_sink.py:95-124` `_RedactingFilter` | exact |
| `backend/app/middleware/maintenance.py` (mod: one allowlist arm) | middleware | request-response | itself, `_is_allowlisted:64-77` | exact |
| `backend/app/services/mcp_tool_catalogue.py` (mod: `mcp_public_base()`, `mcp_url()`) | utility | — | itself, `:116-132` | exact |
| `backend/app/main.py` (mod: one register line + one lifespan block) | config | — | itself, `:653`, `:963-968` | exact |
| `supabase/migrations/222_mcp_usage_limits_and_redaction.sql` (new) | migration | — | 218 (deny-all table) + 215 §6 (CHECK-bounded knob) + 220 §4 (org boolean column) | exact (composite) |
| `scripts/full-schema-supplement.sql` (mod: append the 222 ACL block) | migration mirror | — | itself, `:868-881` (218 block), `:893-902` (220 block) | exact |
| `scripts/check-migration-222-live.py` (new) | script | read-only | `scripts/check-migration-220-live.py` | exact |
| `deploy/onebox.env.example` (mod: `BACKEND_PUBLIC_URL` comment) | config | — | itself, `:137-147` | exact |
| `backend/tests/integration/test_305_two_worker_stateless.py` (new) | test (live) | request-response | `backend/tests/integration/test_077_multi_worker.py:35-193` | exact |
| `backend/tests/unit/test_305_transport.py`, `_mount_predicate.py`, `_lifespan_reentry.py`, `_edge_refusals.py`, `_errors.py`, `_maintenance.py`, `_dockerfile_graceful.py`, `_package_fence.py` (new) | test (unit) | — | `test_147_maintenance_mw.py`, `test_304_tool_catalogue.py:120-145`, `test_304_acting_reads_fence.py`, `test_300_clean_image_imports.py` | exact |

### Plan 305-02: the three read tools and the document address

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/mcp/tools.py` (new: 3 static `types.Tool`) | config (static constants) | — | `mcp_tool_catalogue.MCP_TOOLS:39-48` (static, code-authored) | role-match |
| `backend/app/mcp/results.py` (new: Pydantic results, cursors, chunker, links, defang, render) | model / transform | transform | `models/api_key.py` (Pydantic, `ConfigDict(extra="forbid")`) + `acting_member_reads._plain/_uuid_or_none:97-116` | partial |
| `backend/app/services/acting_member_reads.py` (mod: `folder_id` on `list_documents`; IN-03) | service | CRUD (read) | itself, `list_documents:210-219`, `_page:177-193`, `search:246-281` | exact |
| `backend/tests/unit/test_304_acting_reads_fence.py` (mod, **forced by IN-03**) | test (fence) | — | itself, `:241-251` | exact |
| `frontend/src/lib/appRoutes.ts` (mod: `/app/library/<uuid>`) | utility (route table) | transform | itself, the 299 entity arms `:47-50`, `:86-89`, `:139-142` | exact |
| `frontend/src/hooks/useAppNavigation.ts` (mod: target kind `"document"`) | hook | event-driven | itself (299-02 entity kinds) | exact |
| `frontend/src/lib/citationNav.tsx` (mod, **no ledger row**: add the row first) | provider | event-driven | itself, `CitationNavProvider:81-113` | exact |
| `frontend/src/App.tsx` (mod: one prop expression, FIRES) | component | — | itself, `:316` + the 299 `entityLink={nav.entityLink}` precedent at `:337` | exact |
| `backend/tests/unit/test_305_search_shape.py`, `_paging_chunking.py`, `_tool_defs.py` (new) | test (unit) | — | `test_304_acting_reads_fence.py:291-364` (stubbed reads) | role-match |
| `backend/tests/integration/test_305_tools_live.py`, `_narrowed_tools_live.py` (new) | test (live) | CRUD (read) | `test_304_narrowed_key_live.py` + `phase304_fixtures.py` | exact |
| `frontend/src/lib/__tests__/appRoutes.test.ts` (mod) | test (vitest) | — | itself (pin `144` in count-gate `:4453`) | exact |

### Plan 305-03: audit, limits, spend

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/mcp/audit.py` (new) | utility | event-driven (write) | `inbound._refused:241-260` + `api_key_auth._refuse:304-313` | exact |
| `backend/app/mcp/limits.py` (new) | utility | request-response | `inbound._limit:268-276` + `rate_limit.enforce_key_limit:50-75` | exact |
| `backend/app/security/api_key_auth.py` (mod: `tool=` kwarg) | utility | — | itself, `_audit_args:154-186` (the `kind` field precedent at `:182-184`) | exact |
| `backend/app/services/rate_limit.py` (mod: `check_key_limit`, kinds `expensive` / `mcp_ip`) | service | request-response | itself, `hit:36-47`, `enforce_ip_limit:95-109` | exact |
| `backend/app/api/api_keys.py` (mod, FIRES: `_call_from_audit` ok expression; optional `_limits` field) | controller | request-response | itself, `:173-178`, `:206-223` | exact |
| `backend/app/models/api_key.py` (mod: `ApiKeyLimits.searches_per_minute`) | model | — | itself, `ApiKeyLimits:96-98` | exact |
| `backend/app/models/user_settings.py` (mod, FIRES ⛔: one field and one readback) | model | — | itself, `:304-307` + `:1216-1218` | exact |
| `backend/app/api/settings.py` (mod, FIRES: allowlist, response, bounds) | controller | request-response | itself, `:57-58`, `:123-124`, `:371-372`, `:476-477`, `:900-917` | exact |
| `frontend/src/components/settings/ApiKeyLimits.tsx` (mod: a third field) | component | request-response | itself, `:39-40`, `:121-170` | exact |
| `frontend/src/lib/api/skills.ts` (mod, FIRES: two optional fields) | type | — | itself, `:585`, `:743` (`api_key_reads_per_minute?: number`) | exact |
| `frontend/src/components/settings/apiKeys/apiKeyFacts.ts` (mod, FIRES ⛔: refusal words for the new reasons) | utility | transform | itself, `refusedWords:262-329` (`over_limit` arm `:315-321`) | exact |
| `backend/app/services/usage_sink.py` (new, leaf ContextVar) | utility (leaf) | event-driven | `backend/app/security/acting_org.py` (leaf ContextVar, 31 L) | exact |
| `backend/app/services/openai_service.py` (mod, FIRES ⛔: one sink call) | service | — | itself, `embed_texts:2719-2725` | exact |
| `backend/app/db/mcp_usage.py` (new: one insert) | db | CRUD (create) | `db/api_keys.set_org_mcp_enabled:268-276` (pool `fetchval`, explicit org) | role-match |
| `backend/app/db/rates.py` (mod: second `roots` leg + ledger fields) | db | batch (aggregate) | itself, `_per_root_cte:133-203`, `get_spend_runs:786-915` | exact |
| `frontend/src/components/admin/spend/ExpertSpendCard.tsx` (mod: `LedgerExpertCell` MCP branch) | component (leaf) | — | itself, `:266-305` | exact |
| `frontend/src/lib/api/spend.ts`, `frontend/src/types/spend.ts` (mod: `source`, `apiKeyId`, `apiKeyLabel`) | utility / type | transform | `spend.ts:145-166`, `types/spend.ts:98-107` | exact |
| `backend/tests/unit/test_305_audit.py`, `_limits.py`, `_spend_cte.py` (new) | test | — | `test_268_spend_rollup.py`, `phase293_inbound_fakes.FakeRedis:138-155` | exact |
| `backend/tests/integration/test_305_audit_live.py`, `_spend_live.py` (new) | test (live) | — | `test_304_narrowed_key_live.py` + `phase304_fixtures.World.cleanup:198-220` | exact |

### Plan 305-04: redaction and the org card

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/services/outbound_guard.py` (new) | service (choke point) | transform | **none for the walker**. Use the RESEARCH "Fail-closed guard (shape)" example. Fail-safe read from `maintenance._read_maintenance:48-61` (inverted: here the failure means redact) | partial |
| `backend/app/services/pii_redactor.py` (new) | utility | transform | `logging_sink._REDACTION_PATTERNS` + `_RedactingFilter:85-124` (an ordered `(compiled, replacement)` chain) | role-match |
| `backend/app/db/outbound_policy.py` (new) | db | CRUD (read/update) | `db/api_keys.mcp_switches:254-265` + `set_org_mcp_enabled:268-276` | exact |
| `backend/app/api/api_keys.py` (mod: `GET`/`PUT /org/api-keys/pii-redaction`) | controller | request-response | itself, `get_org_mcp_access` / `set_org_mcp_access:676-719` | exact |
| `backend/app/models/api_key.py` (mod: `OrgPiiRedaction`, `OrgPiiRedactionUpdate`) | model | — | itself, `OrgMcpAccess:256-265` | exact |
| `frontend/src/components/org/OrgPiiRedactionCard.tsx` (new) | component | request-response | `frontend/src/components/org/OrgMcpSwitchCard.tsx` (173 L) | exact |
| `frontend/src/components/org/OrgSettingsTab.tsx` (mod: one mount) | component | — | itself, `:26`, `:61` | exact |
| `frontend/src/lib/api/apiKeys.ts` (mod, FIRES: two functions + one interface) | utility (API client) | request-response | itself, `:146-148`, `:244-261` | exact |
| copy strings for the card | config (copy) | — | `apiKeys/mcpKeyCopy.ts:159-166` (`orgSwitch*` keys) | exact |
| `scripts/measure-redaction.py` (new, read-only) | script | batch (read) | `scripts/check-migration-220-live.py` (asyncpg on `settings.postgres_dsn`, exit codes 0/1/2) | role-match |
| `scripts/mcp-timeout-probe.py` (new, never mounted) | script | request-response | **none** (a standalone SDK server; R-26) | — |
| `frontend/src/components/org/__tests__/OrgPiiRedactionCard.test.tsx` (new) | test (vitest) | — | `OrgMcpSwitchCard.test.tsx` | exact |
| `backend/tests/unit/test_305_redaction.py`, `_outbound_guard.py`, `_pii_routes.py` (new) | test | — | `test_304_mcp_switches_routes.py` | exact |
| `backend/tests/integration/test_305_pii_switch_live.py` (new; anon arm) | test (live) | — | `test_300_rls_anon_live.py:38-85` | exact |

### Bookkeeping (same commit as each edit, no plan of its own)

| File | Analog |
|---|---|
| `docs/HOT-FILE-LEDGER.md` (row + section for `maintenance.py`, `citationNav.tsx`; updated sections for every FIRING file touched) | section `backend/app/models/schedule.py:11506-11510`; the "row added at threshold" section `circuit_breaker.py:16847-16871`; scan-list rows `:11857`, `:11925`, `:12195` |
| `CLAUDE.md` FIRING table rows (cell cap **80 chars**) | e.g. the `backend/app/api/api_keys.py` row: `6 / 3 / 719 (was ...) \| 304-REVIEW WR-02: ...` |
| `scripts/vitest-count-gate.cjs` (BASELINE pins + FILE-LEVEL TARGETS, **both knobs, same commit**) | `:4518-4529` (304 pins) and `:6643-6652` (304 TARGETS) |

---

## Pattern Assignments

### `backend/app/mcp/edge.py` (middleware, request-response)

**Analog:** `backend/app/middleware/maintenance.py` (structure) + `canvas_gate.py` (byte-identity contract) + `api_key_auth.py` (resolver) + `inbound.py` (IP limit first)

**Pure-ASGI skeleton** (`maintenance.py:33-36`, `:80-113`). Copy the shape, never `BaseHTTPMiddleware` (SSE byte-transparency):
```python
from __future__ import annotations

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send
...
class MaintenanceMiddleware:
    """Pure-ASGI write-block for D-06 maintenance/read-only mode."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only guard HTTP requests — websocket / lifespan scopes pass through untouched.
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = str(scope.get("method", "GET")).upper()
        path = scope.get("path", "")
        ...
            response = JSONResponse(status_code=503, content={...})
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
```
For McpEdge the inner app is `StreamableHTTPASGIApp(session_manager)` rather than the next middleware. The edge is the `Route(endpoint=edge)` callable (RESEARCH R-05), not an `add_middleware` entry.

**Byte-identity rule** (`canvas_gate.py:250-257`). One constant response, no extra headers:
```python
            # Byte-identity with an unbuilt path IS the contract: exactly the payload
            # ``dependencies._NOT_FOUND`` produces ... No custom
            # message, no extra headers, no WWW-Authenticate.
            response = JSONResponse(status_code=404, content={"detail": "Not Found"})
            await response(scope, receive, send)
            return
```
For 305, build the 401 bytes once at import (RESEARCH "The one 401") and send them raw. Do **not** build a `JSONResponse` per request. Body bytes, `content-type`, `www-authenticate: Bearer` and `content-length` stay fixed.

**One resolver, every `KeyRefused` collapsed** (`api_key_auth.py:316-333`). The `/inbound` wrapper is the model. The MCP edge calls `mcp_principal.resolve_mcp_principal` (`mcp_principal.py:32-49`) instead:
```python
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail=NO_KEY_DETAIL)
    presented = credentials.credentials
    try:
        return await authenticate_presented_key(
            presented, pool=pool, redis=redis, call=_call_kind(request),
            expected_kind="workflow",
        )
    except KeyRefused:
        # Every credential failure is the one byte-identical 401 at /inbound (D-06, SC5).
        raise _invalid() from None
```
305 difference (D-50): `refusal.sentence is not None` (reasons `mcp_off_org` / `mcp_off_deployment`) → 403 JSON `{"error":"mcp_off","error_description": refusal.sentence}`. Every other reason, a missing header and a non-Bearer header → the one 401. The sentences live in `principal_liveness.py:42-43` and are imported, never retyped.

**The key is header-only.** `digest_key` already refuses a JWT before any read (`api_key_auth.py:128-142`: wrong prefix → `None` → `KeyRefused("unknown")`), so D-09 needs no JWT branch. Pin it with a test.

**IP limit before the key is read** (`inbound.py:263-265`):
```python
async def _client_limit(request: Request, redis=Depends(get_redis)) -> None:
    """293-REVIEW CR-02: the per-client limit, on every /inbound route, BEFORE the key is read."""
    await enforce_ip_limit(redis, client=(request.client.host if request.client else "unknown"))
```
In ASGI form: `client = (scope.get("client") or ("unknown",))[0]`, with a separate bucket kind `"mcp_ip"` (R-19, Pitfall 12). `enforce_ip_limit` raises `HTTPException(429|503)`. The edge catches it and writes the response bytes itself, because no FastAPI handler runs inside a raw `Route` endpoint.

**Pool / redis outside FastAPI DI.** The edge is not a FastAPI dependency, so call `get_pg_pool()` / `get_redis()` from `app.dependencies` directly (they are what `Depends(get_pg_pool)` resolves; see the `api_key_auth.py:52` import).

**Principal into scope** (R-03): `scope.setdefault("state", {})["mcp_principal"] = principal`. Nothing from headers, query or body feeds `org_id` (D-10, T-305-02).

---

### `backend/app/middleware/maintenance.py` (middleware, one allowlist arm)

**Analog:** itself, `_is_allowlisted` (`:64-77`):
```python
def _is_allowlisted(method: str, path: str) -> bool:
    """True if ``method``+``path`` must pass even under maintenance (Pitfall 4)."""
    # Reads + CORS preflight always pass.
    if method in _PASSTHROUGH_METHODS:
        return True
    # Login + ALL /admin/* (the off-switch) stay reachable. Match on a path-segment
    # boundary so a sibling like ``/administrate`` is NOT falsely allowlisted.
    for prefix in _ALLOWLIST_PREFIXES:
        if path == prefix or path.startswith(prefix + "/"):
            return True
    # Users self-cancelling their own in-flight run (DELETE /runs/{id}).
    if method == "DELETE" and path.startswith("/runs/"):
        return True
    return False
```
Add one arm with the same boundary rule: `path == MCP_PATH or path.startswith(MCP_PATH + "/")`. Import `MCP_PATH` from `app.services.mcp_tool_catalogue`, which is pure (no `app.` import at module load, `mcp_tool_catalogue.py:20-21`). **This file has no ledger row:** add the row and its section in the same commit (D-25).

**Test analog:** `backend/tests/test_147_maintenance_mw.py:33-152`. It builds a tiny app with only this middleware and forces the flag with `monkeypatch.setattr(mw, "_read_maintenance", lambda: True)`. Copy `test_admin_prefix_boundary_not_over_allowlisted` (`:142-152`) as `POST /mcpx` → 503.

---

### `backend/app/services/mcp_tool_catalogue.py` (utility; `mcp_public_base()` + `mcp_url()`)

**Analog:** itself (`:116-132`). This is the lazy-settings idiom to keep:
```python
MCP_PATH = "/mcp"


def mcp_url() -> str | None:
    """The address an MCP client connects to, or ``None`` when ``BACKEND_PUBLIC_URL`` is unset.
    ...
    """
    from app.config import settings  # noqa: PLC0415 — lazy: this module stays importable bare

    base = str(getattr(settings, "backend_public_url", "") or "").strip().rstrip("/")
    if not base:
        return None
    return base + MCP_PATH
```
Helpers to reuse, never copy-paste divergently:
- `inbound._is_loopback` (`inbound.py:455-458`): `(urlsplit(base).hostname or "").lower() in _LOOPBACK_HOSTS`.
- `api_docs.is_production_environment()` (`api_docs.py:82-86`): `_environment() in ("production", "prod")`.

**Pinned tests that must stay green:** `test_304_tool_catalogue.py:123-145`. These cover the public base + path, a path-prefixed base keeping its prefix (`https://example.com/api` → `/api/mcp`), unset → `None`, and loopback served as-is **outside production**. New production arms go in `test_305_mount_predicate.py`, using the same `_set_url(monkeypatch, value)` helper (`:120`).

---

### `backend/app/mcp/__init__.py` + `backend/app/main.py` (one register line, one lifespan block)

**Analog:** `main.py:963-968` (router block, one trailing comment per line):
```python
app.include_router(api_keys.router)  # Phase 293 D-18 — /api-keys: a member's own API keys (create, list, revoke)
app.include_router(api_keys.org_router)  # Phase 293 D-03 — /org/api-keys: org admins see and revoke every key
app.include_router(inbound.router)  # Phase 293 START-02 — /inbound: outside systems start a published workflow ...
app.include_router(notifications.router)  # Phase 301 NOTE-01/05 — GET /notifications: ...
```
Add `register_mcp(app)  # Phase 305 MCP-01 — /mcp and /mcp/ (stateless, key edge; never canvas-gated)` beside them.

**Lifespan:** `main.py:278-279` (`@asynccontextmanager async def lifespan(app_instance)`). The single `yield` is at `:653`, followed by shutdown steps at `:655+`. The one block is:
```python
    async with mcp_lifespan():
        yield
```
The shutdown code after `yield` stays outside the `async with`, so the SDK manager exits before the shutdown hooks run. Use RESEARCH Pattern 1 for the body of `mcp_lifespan()`: a fresh `streamable_http_app(...)` on every entry, because 13 test modules enter the lifespan.

⚠ `main.py` FIRES (`99 / 73 / 1021`): update the CLAUDE.md row and the HOT-FILE-LEDGER section in the same commit.

---

### `backend/app/mcp/access_log.py` (utility, `logging.Filter`)

**Analog:** `backend/app/services/logging_sink.py:95-124`:
```python
class _RedactingFilter(logging.Filter):
    """Rewrite each record so the FORMATTED message has secrets removed. ... Always
    returns True — it redacts, never drops.
    """

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003 - logging API
        try:
            message = record.getMessage()
        except Exception:
            # If interpolation itself fails, leave the record untouched rather
            # than risk dropping a diagnostic line.
            return True
        ...
```
For `uvicorn.access`, `record.args` is `(client_addr, method, full_path, http_version, status_code)`. Rewrite `args[2]` to drop `?…` when the path starts with `MCP_PATH`, and return `True` (never drop the line). `register_mcp` installs it once; make it idempotent so a second lifespan entry adds no second filter.

---

### `backend/app/mcp/dispatch.py` + `server.py` (service pipeline)

**Ordering analog:** `inbound.start_workflow_run` (`inbound.py:291-306`) runs the limit first, then the work, and audits refusals before raising:
```python
@router.post(..., dependencies=[Depends(_client_limit)])
async def start_workflow_run(..., key: ResolvedKey = Depends(resolve_api_key), ...):
    await _limit(redis, key, "start", workflow_id=workflow_id)
```
**Grant check analog** (`acting_member_reads.py:89-111`). The reads raise `ToolNotGranted(tool)` before any SQL. Dispatch must check `params.name in principal.tools` too (D-21: list and call both). The reads' own `_require` is the second wall:
```python
class ToolNotGranted(Exception):
    """The key does not carry the catalogue tool this read serves (KEY-03)."""

    def __init__(self, tool: str):
        super().__init__(tool)
        self.tool = tool
...
def _require(principal: Any, read: str) -> None:
    tool = READ_TOOL[read]
    if tool not in tuple(principal.tools or ()):
        raise ToolNotGranted(tool)
```
**Maintenance flag read:** reuse `maintenance._read_maintenance()` (`maintenance.py:48-61`, fail-open, in-memory) or `models.user_settings.maintenance_mode()`. Never a second reader.

**Catch-all / unknown tool / MCPError:** no codebase analog. Use RESEARCH Pattern 3 verbatim. Its sentences: `GENERIC_FAILURE_SENTENCE`, `"No document with that id is available to this key."` (D-16), and the D-35 withheld sentence.

---

### `backend/app/mcp/tools.py` (static tool definitions)

**Analog:** `mcp_tool_catalogue.MCP_TOOLS` (`:31-48`). These are frozen, code-authored, and carry no user text:
```python
@dataclass(frozen=True)
class McpTool:
    name: str
    group: ToolGroup
    label: str
    travels_with: str | None = None
...
MCP_TOOLS: tuple[McpTool, ...] = (
    McpTool("search_knowledge_base", "read", "Search your knowledge base"),
    McpTool("list_documents", "read", "List documents and folders"),
    McpTool("read_document", "read", "Read a document"),
```
**Reuse `McpTool.label` as `types.Tool.title`. Never retype it**, so the key screen and `tools/list` cannot drift. `REGISTERED` = these three names only; the 306 names are never listed (D-21). Annotations come from the RESEARCH "Tool definitions" example. `_TOOL_REGISTRY` stays at 30 (`test_259_closed_core_inventory.py:54`).

---

### `backend/app/services/acting_member_reads.py` (service; `folder_id` + IN-03)

**`list_documents` today** (`:210-219`) and the `_page` WHERE builder (`:177-193`):
```python
async def list_documents(principal: Any, *, limit: int = 50, offset: int = 0) -> dict:
    _require(principal, "list_documents")
    async with _acting(principal) as (conn, scope, _folders):
        if _nothing(scope):
            return {"items": [], "total": 0}
        return await _page(conn, scope, limit=limit, offset=offset)
...
async def _page(conn, scope, *, limit, offset, ids=None) -> dict:
    args: list = []
    where = ["d.is_latest", "d.retrievable"]  # D-46: the agent rule (mig 205), not Library parity
    if ids is not None:
        args.append(ids)
        where.append(f"d.id = ANY(${len(args)}::uuid[])")
    where += _scope_clauses(scope, args)
```
Add `folder_id: str | None` as one more bound predicate appended to `where`, using the same `$N`-index pattern. The value is validated with `_uuid_or_none` (`:101-105`), and only placeholder indices are built into the SQL. R-15 semantics: `None` → `d.folder_id IS NULL` (Root, un-narrowed keys only). The `KeyScope` clauses still apply.

**IN-03 (search builds the service-role client on the loop)** (`:268-272`):
```python
    with acting_as(principal):
        rows, _avg = await retrieval_service.search_documents(
            query, principal.user_id, get_service_role_supabase(principal.org_id),
            user_settings=user_settings, folder_ids=folder_ids,
        )
```
Move it to `client = await run_in_threadpool(get_service_role_supabase, principal.org_id)`. The precedent is `api_keys.py:711`: `audit_supabase = await run_in_threadpool(get_service_role_supabase, str(org))`.

⛔ **This breaks the 304 fence, and the fence must move in the same commit.** `test_304_acting_reads_fence.py:241-251` counts `get_service_role_supabase (` call sites (== 2) and asserts each is a **direct argument** of `search_documents` / `resolve_document_scope`:
```python
    calls = re.findall(r"get_service_role_supabase \(", code)
    assert len(calls) == 2, calls
    for callee in ("search_documents", "resolve_document_scope"):
        assert re.search(callee + r" \([^()]*get_service_role_supabase \(", code), callee
```
Rewrite the search arm to assert that the threadpooled client variable is passed to `search_documents`, and keep the intent (exactly two sanctioned service-role uses). `FORBIDDEN_IN_READS` (`:213-229`) is unaffected by `folder_id`.

---

### `backend/app/mcp/results.py` (model / transform)

**Pydantic conventions analog:** `models/api_key.py:256-265`:
```python
class OrgMcpAccess(BaseModel):
    """The org's MCP switch (D-35), read and written by an org admin."""

    enabled: bool


class OrgMcpAccessUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool
```
Tool argument models use `extra="forbid"`. Result models carry a `RedactableText` annotation on text fields (R-21) so `outbound_guard` walks by type, never by pattern.

**Row → plain dict / id validation** (`acting_member_reads.py:97-116`): `_uuid_or_none` and `_plain` (UUID → str). Import them; do not copy them.

**Link origin:** `config.primary_frontend_origin()` is the one origin. Precedent `api/connectors.py:1434-1436`:
```python
    from app.config import settings, primary_frontend_origin
    frontend_url = primary_frontend_origin()  # BUG-260904-04: FRONTEND_URL is a LIST
```
The link is `primary_frontend_origin() + "/app/library/" + document_id` (D-52).

**No analog:** the chunker (8,000-character budget, boundary rules), the base64url cursor and the defang rules. Use R-13 / R-15 / D-19.

---

### `backend/app/mcp/audit.py` (per-call audit)

**Analog:** `inbound._refused` (`inbound.py:241-260`), the throttled refusal row:
```python
async def _refused(
    key: ResolvedKey | dict, *, call: str, reason: str, exc: HTTPException, redis,
    workflow_id: str | None = None, run_id: str | None = None, detail: dict | None = None,
) -> HTTPException:
    key_id = key.id if isinstance(key, ResolvedKey) else key.get("id")
    suppressed = await refusal_audit_slot(redis, key_id=str(key_id), reason=reason)
    if suppressed is None:
        return exc
    if suppressed:
        detail = {**(detail or {}), "suppressed": suppressed}
    await audit_key_call_now(
        key, "api_key.refused", call=call, workflow_id=workflow_id, run_id=run_id,
        outcome="refused", reason=reason, detail=detail,
    )
    return exc
```
Success rows: `await audit_key_call_now(key, "api_key.read", call="read", outcome=<ok|error|redaction_blocked>, tool=<name>)`. **Never `audit_key_call` (BackgroundTasks):** there is no FastAPI handler here, and `api_key_auth.py:206-209` records that a background task added before a raise is discarded.

`audit_key_call_now` takes a `ResolvedKey | dict`. Pass a dict built from the principal (`{"id": p.key_id, "label": …, "user_id": p.user_id, "org_id": p.org_id, "kind": "mcp"}`). The principal has no `label` field (`mcp_principal.py:21-29`), so either carry the label through the edge or accept that `api_key_label` is dropped. Note the decision.

**`api_key_auth._audit_args` (`:154-186`), the additive-field precedent for `tool=`:**
```python
    metadata: dict[str, Any] = {
        ...
        "detail": detail,
        # D-36: no new audit literal — an MCP key's rows say so here. A workflow key's metadata
        # stays byte-identical to 293's (no ``kind`` key at all).
        "kind": "mcp" if kind == "mcp" else None,
    }
    return str(user_id), {k: v for k, v in metadata.items() if v is not None}, str(org_id)
```
Add `"tool": tool` the same way. Because of the None filter, 293/304 rows stay byte-identical. IN-03 also applies here: `audit_key_call_now:241-243` builds `get_service_role_supabase(org)` inline. Fix it in the helper (young file) with `run_in_threadpool`.

**Readback fix (Pitfall 7), `api_keys._call_from_audit:206-223`:**
```python
        ok=action != "api_key.refused",
        outcome=md.get("outcome"),
        reason=md.get("reason"),
```
This becomes the one expression from R-18: `ok = action != "api_key.refused" and not (md.get("kind") == "mcp" and md.get("outcome") not in (None, "ok"))`.

**Frontend words for the new reasons, `apiKeyFacts.ts:315-327`.** An unknown reason falls through to `default: return call.reason` (raw code). Add arms for `rate_limited:read` / `rate_limited:expensive` / `tool_not_granted` beside `over_limit`, plus the outcome `redaction_blocked` / `error` for a not-ok `api_key.read`. ⚠ This file FIRES ⛔: read its HOT-FILE-LEDGER section first, then do the CLAUDE.md row + section in the same commit.

---

### `backend/app/mcp/limits.py` + `backend/app/services/rate_limit.py`

**Analog:** `rate_limit.py:29`, `:36-75`:
```python
Kind = Literal["start", "read", "citation"]
...
async def hit(redis, *, key_id: str, kind: Kind, limit: int) -> int | None:
    now = int(time.time())
    bucket = f"apikey:rl:{kind}:{key_id}:{now // 60}"
    async with redis.pipeline(transaction=True) as pipe:
        pipe.incr(bucket)
        pipe.expire(bucket, 120)
        count, _ = await pipe.execute()
    if count <= limit:
        return None
    return (60 - (now % 60)) or 1


async def enforce_key_limit(redis, *, key_id: str, kind: Kind) -> None:
    settings = await load_app_settings_async()
    ...
    try:
        retry = await hit(redis, key_id=key_id, kind=kind, limit=limit)
    except Exception:  # noqa: BLE001 — any Redis failure refuses; see the module docblock
        logger.warning("api key rate limiter unavailable; refusing the call", exc_info=True)
        raise HTTPException(status_code=503, detail=UNAVAILABLE_DETAIL)
```
Changes:
- Extend `Kind` with `"expensive"` and `"mcp_ip"`.
- Add `check_key_limit(redis, *, key_id, kind) -> (limit, retry | None)`, raising a typed `LimiterUnavailable`. **`enforce_key_limit` stays byte-unchanged.**
- MCP turns `retry` into an `isError` sentence ("…Try again in N seconds."), and turns `LimiterUnavailable` into a tool error with the existing `UNAVAILABLE_DETAIL`.
- The `/inbound` mapping to copy for audit reasons is `inbound._limit:268-276` (`reason = "over_limit" if exc.status_code == 429 else "limiter_unavailable"`). R-18 names the MCP reasons `rate_limited:<bucket>`, so pick one vocabulary and make the frontend words match it.

**Test fake:** `tests/unit/phase293_inbound_fakes.py:138-155` `FakeRedis` / `FakePipeline`.

---

### Settings knob `api_key_searches_per_minute` (user_settings.py ⛔, settings.py, ApiKeyLimits.tsx, skills.ts)

**Field + readback (`user_settings.py:304-307`, `:1216-1218`). One line each, mirroring:**
```python
    # 293 D-14 (migration 215): per-key API limits, counted in Redis across every worker by
    #   `services/rate_limit.py`. App-wide, bounded 1..60 and 10..600 (API + CHECK).
    api_key_starts_per_minute: int = 10
    api_key_reads_per_minute: int = 120
...
        # 293 D-14 — a database without migration 215 still reads 10 / 120.
        api_key_starts_per_minute=int(_val(row, "api_key_starts_per_minute", None, 10)),
        api_key_reads_per_minute=int(_val(row, "api_key_reads_per_minute", None, 120)),
```
**Bounds on write (`settings.py:900-917`):**
```python
    if body.api_key_reads_per_minute is not None:
        if not 10 <= body.api_key_reads_per_minute <= 600:
            raise HTTPException(
                status_code=400,
                detail=await _range_refusal_detail(
                    field="api_key_reads_per_minute",
                    label="Status reads per minute, per key",
                    submitted=body.api_key_reads_per_minute,
                    lo=10,
                    hi=600,
                    typed_detail=(...),
                ),
            )
        updates["api_key_reads_per_minute"] = body.api_key_reads_per_minute
```
Plus the allowlist entry (`:57-58`), the response field (`:123-124`), the update-body field (`:371-372`) and `_build_response` (`:476-477`). Bounds are 1..120 (R-19) in **three places that agree**: mig CHECK, API 400, UI clamp.

**UI (`ApiKeyLimits.tsx:39-40`, `:121-170`).** Add `const SEARCHES = { min: 1, max: 120, fallback: 30 } as const`, a third draft, a third `changes()` line and a third `adopt()` field. Keep the "changed fields only" and "nothing shown before the read answers" invariants (`:25-34`). `frontend/src/lib/api/skills.ts:585` and `:743` gain `api_key_searches_per_minute?: number` (type-only).

---

### `backend/app/services/usage_sink.py` (leaf ContextVar) + the `embed_texts` hook

**Analog:** `backend/app/security/acting_org.py` (whole file, 31 L):
```python
"""Phase 304 (D-13, D-14) — the org a personal MCP key acts in, as a ContextVar. A LEAF.

This module imports nothing from ``app.``, on purpose: ...
"""

from __future__ import annotations

from contextvars import ContextVar

_acting_org: ContextVar[str | None] = ContextVar("acting_org_id", default=None)


def current_acting_org() -> str | None:
    """The canonical org UUID string the current context acts in, or None (= every org, today)."""
    return _acting_org.get()
```
Same leaf shape: a `ContextVar[list | None]`, a `collecting()` context manager that sets and resets the token (the setter discipline of `acting_member.acting_org_scope`), and `record(model, prompt_tokens)` as a no-op when unset. A leaf fence test (`test_304_acting_reads_fence.py:186-188`) applies:
```python
def test_acting_org_is_a_leaf():
    src = ACTING_ORG.read_text(encoding="utf-8")
    assert not re.search(r"^\s*(from|import)\s+app\b", src, re.M)
```

**Hook site (`openai_service.py:2719-2725`, FIRES ⛔). One additive call after `create`:**
```python
    for batch in batches:
        response = client.embeddings.create(
            model=effective_model,
            input=batch,
        )
        for item in response.data:
            all_embeddings.append(item.embedding)
```
Add `usage_sink.record(getattr(response, "model", effective_model), getattr(getattr(response, "usage", None), "prompt_tokens", None))`. It must never raise (wrap it, because a usage miss must not fail an embedding). Honoured by construction: update the CLAUDE.md row and the ledger section in the same commit.

---

### `backend/app/db/mcp_usage.py` + `backend/app/db/outbound_policy.py` (db)

**Analog:** `db/api_keys.py:254-276`:
```python
async def mcp_switches(pool: asyncpg.Pool, org_id: UUID | str) -> dict | None:
    """``{org_on, deploy_on, org_name}`` for one org, in ONE statement; ``None`` when the org row
    is missing. ..."""
    row = await pool.fetchrow(
        "SELECT o.mcp_enabled AS org_on, "
        ...
        "FROM public.organizations o WHERE o.id = $1",
        org_id,
    )
    return dict(row) if row is not None else None


async def set_org_mcp_enabled(pool: asyncpg.Pool, *, org_id: UUID | str, enabled: bool) -> bool | None:
    """Flip one org's MCP switch; returns the stored value, ``None`` for a missing org. The
    route that calls this is behind ``require_org_manage`` and writes the audit row."""
    return await pool.fetchval(
        "UPDATE public.organizations SET mcp_enabled = $2, updated_at = now() "
        "WHERE id = $1 RETURNING mcp_enabled",
        org_id,
        enabled,
    )
```
- `outbound_policy.pii_redaction_enabled(pool, org_id) -> bool | None` and `set_pii_redaction_enabled(pool, *, org_id, enabled) -> bool | None` are exact copies with the column name swapped. This keeps `db/api_keys.py` (FIRES) untouched (R-22).
- `mcp_usage.insert_usage(pool, *, org_id, user_id, api_key_id, tool, model, provider, input_tokens, output_tokens, status)` is one `INSERT … RETURNING id`, with every `$N` bound and the org explicit.
- Module docstring rules from `db/api_keys.py:1-26`: the service-role pool is BYPASSRLS, so the org predicate goes in every statement, and lists are bound plain, never `json.dumps`.

---

### `backend/app/db/rates.py` (the second `roots` leg)

**Analog:** itself, `_per_root_cte:133-203`. The leg goes inside `roots` as `UNION ALL`, and `members` gains a matching `UNION ALL` (RESEARCH Pattern 4). Current `roots`:
```python
        WITH roots AS (
            SELECT
                r.run_id, r.org_id, r.thread_id, r.user_id, r.status, r.model, r.provider,
                r.started_at, r.completed_at, r.expert_id, r.expert_attributed,
                (r.model = 'unknown' AND r.provider = 'unknown') AS is_box_shell
            FROM public.runs r
            WHERE r.org_id = $1
              AND r.parent_run_id IS NULL
              """ + window_sql + """
              """ + _expert_filter_sql(expert_param) + """
        ),
        members AS (
            SELECT
                ro.run_id AS root_run_id, ro.org_id AS root_org_id, ro.is_box_shell,
                (m.run_id = ro.run_id) AS is_root,
                m.model, m.provider, m.started_at, m.input_tokens, m.output_tokens
            FROM roots ro
            JOIN public.runs m ON m.run_id = ro.run_id OR m.parent_run_id = ro.run_id
        ),
```
⛔ **Pins in `test_268_spend_rollup.py` the leg must survive (read them before editing):**
- `:120-125`: `"parent_run_id IS NULL"` appears on **exactly one source line** of `rates.py`. The mcp leg must not repeat the root predicate (it has no `parent_run_id`).
- `:96-117`: every spend SQL contains `"per_root AS ("`, `"r.parent_run_id IS NULL"`, the exact `"m.run_id = ro.run_id OR m.parent_run_id = ro.run_id"`, `cost_usd_sql("m", "rate")`, and **`"m.org_id" not in sql`**. Alias the usage leg so no `m.org_id` text appears.
- `:128-130`: the `is_box_shell` text and `FILTER (WHERE is_root OR NOT is_box_shell)` stay verbatim.
- `:428-443`: the ledger COUNT carries the same CTE and joins as the rows, which is the 257 LATERAL lesson at `rates.py:844-849`.

The window and Expert texts are reused verbatim. `_expert_filter_sql` reads `r.expert_attributed` / `r.expert_id`, so the usage subselect aliases itself `r` and synthesises them (Pattern 4).

**Ledger select (`:852-912`).** Add `ro.source`, `ro.api_key_id`, `k.label AS api_key_label` via `LEFT JOIN public.api_keys k ON k.id = ro.api_key_id AND k.org_id = ro.org_id`. The org-constrained name join follows `test_268:356` "the name join is org-constrained". Add the three keys to the returned dict beside `"expert_attributed": bool(r["expert_attributed"]), "subagent_count": int(r["subagent_count"] or 0)` (`:911-912`).

---

### Spend frontend: `ExpertSpendCard.tsx` `LedgerExpertCell`, `lib/api/spend.ts`, `types/spend.ts`

**Analog:** `ExpertSpendCard.tsx:266-305`:
```tsx
type LedgerAttribution = Pick<SpendRunItem, "expertId" | "expertName" | "expertDeleted" | "expertAttributed">

const LEDGER_PILL = "rounded-full px-2 text-[11px] inline-flex items-center gap-1"
const LEDGER_DASHED = `${LEDGER_PILL} border border-dashed border-border bg-transparent text-muted-foreground italic`

export const LedgerExpertCell: React.FC<{ run: LedgerAttribution }> = ({ run }) => {
  if (!run.expertAttributed) {
    return (<span className="text-[11px] text-muted-foreground" data-testid="ledger-expert-cell">{C.ledgerNotRecorded}</span>)
  }
  if (run.expertId === null) {
    return (<span className={LEDGER_DASHED} data-testid="ledger-expert-cell">{C.noExpert}</span>)
  }
```
Extend the `Pick` with `source` / `apiKeyLabel`, and add a first arm, `if (run.source === "mcp")`, that renders "MCP · <label>" with the same `data-testid`. Words go in `expertSpendCopy.ts` (its test is pinned at count-gate `:4209`). **`AdminSpendPage.tsx` is not touched** (D-55).

**Mapper (`spend.ts:145-166`):** add `source: r.source ?? "run"`, `apiKeyId: r.api_key_id ?? null`, `apiKeyLabel: r.api_key_label ?? null`, in the same style as `expertId: r.expert_id ?? null`. **Type (`types/spend.ts:98-107`):** add three documented fields beside the 268 block.

Tests: `components/admin/spend/__tests__/ExpertSpendCard.test.tsx:208-224` (the `base` attribution object; add MCP cases). Note that `AdminSpendPage.test.tsx:107,125,442` builds `SpendRunItem` literals, so the new fields must be optional or defaulted or those literals stop type-checking.

---

### `supabase/migrations/222_mcp_usage_limits_and_redaction.sql` (migration)

Three precedents, one per section:

**(a) Deny-all service-role table:** `218_run_waiting_notifications.sql:104-148`:
```sql
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
    created_at          timestamptz NOT NULL DEFAULT now(),
);
COMMENT ON TABLE public.notification_deliveries IS '... Deny-all to every client role (RLS on, no policy); ...';
CREATE INDEX IF NOT EXISTS notification_deliveries_due_idx ON public.notification_deliveries (status, due_at) ...;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE public.notification_deliveries FROM anon;
REVOKE ALL ON TABLE public.notification_deliveries FROM authenticated;
REVOKE ALL ON TABLE public.notification_deliveries FROM service_role;
GRANT ALL ON TABLE public.notification_deliveries TO service_role;

-- No policy at all on the outbox: deny-all to clients (D-19).
```
Columns for `mcp_usage` are listed in R-20, with the index `(org_id, started_at)`.

**(b) CHECK-bounded app_settings knob:** `215_api_keys_and_run_origin.sql:199-224`:
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS api_key_reads_per_minute integer NOT NULL DEFAULT 120;
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_api_key_reads_per_minute_bound;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_api_key_reads_per_minute_bound
  CHECK (api_key_reads_per_minute >= 10 AND api_key_reads_per_minute <= 600);
COMMENT ON COLUMN public.app_settings.api_key_reads_per_minute IS
  'Phase 293 (D-14). ... Bounded 10..600 by the API (app/api/settings.py) and by '
  'app_settings_api_key_reads_per_minute_bound.';
```
**(c) Per-org boolean outside the UPDATE grant:** `220_api_keys_kind_and_mcp_switches.sql:22-28`, `:111`, `:115-116`:
```sql
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mcp_enabled boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.organizations.mcp_enabled IS
    'Phase 304 (D-35, KEY-06). Per-org MCP switch. Only writer: PUT /org/api-keys/mcp-access (org admin, audited as settings.update). Deliberately OUTSIDE the mig 194 client UPDATE grant.';
```
`pii_redaction_enabled` uses `DEFAULT false`.

**Header block** copies `220:1-47`: WHAT, NO AUDIT LITERAL, VISIBILITY, NOT A SEED, and the apply discipline (paste into the SQL editor, idempotent, then `bash scripts/regenerate-full-schema.sh` with no `--reset`, then `check-migration-222-live.py`; ⚠ PRODUCTION paste order 220 → 221 → 222 under per-action approval, then `get_advisors(security)`). Wrap the statements in `BEGIN; … COMMIT;` and end with a commented `VERIFY` CTE that prints PASS/FAIL (`220:120-154`).

**Supplement (`scripts/full-schema-supplement.sql:868-881`, FIRES)**: append a `-- migration 222 — mcp_usage: deny-all to every client role` block copying the 218 notification_deliveries lines, and one comment line saying `organizations.pii_redaction_enabled needs no line` (the `:896` precedent).

---

### `scripts/check-migration-222-live.py` (script, read-only)

**Analog:** `scripts/check-migration-220-live.py` (whole file). Copy the frame verbatim:
- `REPO_ROOT` + `sys.path.insert(0, backend)`;
- `os.chdir(backend)` before `from app.config import settings`;
- one `asyncpg.connect(settings.postgres_dsn)` and catalog SELECTs only;
- a `missing: list[str]` collector;
- exit **0** `222 live` / **1** list missing / **2** unreachable.

Checks to carry over, renamed for 222:
```python
            if await conn.fetchval(
                "SELECT has_column_privilege('anon', 'public.api_keys', $1, 'SELECT')", col
            ):
                missing.append(f"anon can SELECT api_keys.{col}")
...
        if await conn.fetchval(
            "SELECT has_column_privilege('authenticated', 'public.organizations', 'mcp_enabled', 'UPDATE')"
        ):
            missing.append("authenticated may write organizations.mcp_enabled (D-35)")
```
222 version:
- anon / authenticated have no table privilege on `mcp_usage`;
- RLS is on;
- the `pii_redaction_enabled` column is `boolean NOT NULL DEFAULT false` and not UPDATE-able by authenticated;
- `app_settings_api_key_searches_per_minute_bound` exists.

`scripts/measure-redaction.py` uses the same connect/exit frame. It is read-only over `document_chunks` / `documents.full_markdown` and commits aggregates only.

---

### `backend/app/api/api_keys.py` (pii-redaction routes) + models

**Analog:** `api_keys.py:676-719`, copied with the noun swapped:
```python
_MCP_ACCESS_AUDIT_ACTION = "settings.update"
_ORG_NOT_FOUND = "Organization not found."


@org_router.get("/mcp-access", response_model=OrgMcpAccess)
async def get_org_mcp_access(
    current_user: dict = Depends(require_org_manage),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> OrgMcpAccess:
    """The active org's MCP switch, read live (never the settings cache)."""
    switches = await api_keys_db.mcp_switches(pool, _uuid(active_org))
    if switches is None:
        raise HTTPException(status_code=404, detail=_ORG_NOT_FOUND)
    return OrgMcpAccess(enabled=switches.get("org_on") is True)


@org_router.put("/mcp-access", response_model=OrgMcpAccess)
async def set_org_mcp_access(body: OrgMcpAccessUpdate, current_user=..., active_org=..., pool=...) -> OrgMcpAccess:
    """Flip the active org's MCP switch. The audit row is written only AFTER the write returned;
    a failed write raises (an error status and no audit row), never a fake success."""
    org = _uuid(active_org)
    stored = await api_keys_db.set_org_mcp_enabled(pool, org_id=org, enabled=body.enabled)
    if stored is None:
        raise HTTPException(status_code=404, detail=_ORG_NOT_FOUND)
    audit_supabase = await run_in_threadpool(get_service_role_supabase, str(org))
    await write_audit_entry(
        user_id=str(current_user["id"]),
        action_type=_MCP_ACCESS_AUDIT_ACTION,
        metadata={"event": "mcp_access", "enabled": bool(stored)},
        supabase=audit_supabase,
        org_id=str(org),
    )
    return OrgMcpAccess(enabled=bool(stored))
```
Paths are `/pii-redaction`, metadata `{"event": "pii_redaction", "enabled": …}`, and helpers come from `db/outbound_policy` (imported as a module so tests can monkeypatch it). These go on the existing `org_router` (`:100`). **No new `include_router` in `main.py`.**

**Route test analog:** `tests/unit/test_304_mcp_switches_routes.py:39-186`:
- fresh `FastAPI()` + overrides, never `app.main.app` (SEED-363);
- `monkeypatch.setattr(route, "write_audit_entry", _write)`;
- `monkeypatch.setattr(deps, "_has_org_permission", _perm)`;
- arms: admin reads, a member gets the same 403, a flip writes one `settings.update` row, an extra field is 422, a failed write gives 5xx with no audit row, a missing org gives 404, and no new audit literal appears (`:180-185`).

---

### `frontend/src/components/org/OrgPiiRedactionCard.tsx` (component)

**Analog:** `OrgMcpSwitchCard.tsx` (whole file). Copy the state machine exactly:
```tsx
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [writeFailed, setWriteFailed] = useState(false)
  const alive = useRef(true)

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      const res = await getOrgMcpAccess()
      if (!alive.current) return
      setEnabled(Boolean(res.enabled))
    } catch {
      if (alive.current) setLoadFailed(true)
    }
  }, [])
  ...
  async function handleToggle() {
    if (busy || enabled === null) return
    setBusy(true)
    setWriteFailed(false)
    try {
      const res = await setOrgMcpAccess(!enabled)
      if (!alive.current) return
      setEnabled(Boolean(res.enabled))
      onRecorded?.()
    } catch {
      if (alive.current) setWriteFailed(true)
    } finally {
      if (alive.current) setBusy(false)
    }
  }
```
Invariants from its docblock (`:9-18`): never optimistic, no switch on a failed read, direct flip with no confirm. The `McpSwitch` look is **re-declared** (`:137-173`), not imported (`CapabilityGrid.tsx` FIRES). The armed visual differs: OFF is the default here, so do not reuse `armed = enabled === false` blindly. The UI-SPEC decides which state is calm.

**Mount (`OrgSettingsTab.tsx:61`):** `<OrgMcpSwitchCard orgName={orgName} onRecorded={onRecorded} />`. Add `<OrgPiiRedactionCard orgName={orgName} onRecorded={onRecorded} />` directly beneath it, plus one import line, and update the file's header comment (the `:20-22` style).

**API (`apiKeys.ts:244-261`):**
```ts
export async function getOrgMcpAccess(signal?: AbortSignal): Promise<OrgMcpAccess> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/api-keys/mcp-access`, { headers, signal })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as OrgMcpAccess
}
export async function setOrgMcpAccess(enabled: boolean): Promise<OrgMcpAccess> {
  ...method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ enabled }),
```
Add `getOrgPiiRedaction` / `setOrgPiiRedaction` and an `OrgPiiRedaction` interface (the `:146-148` shape). FIRES: update the row and section.

**Copy:** the `orgSwitch*` keys in `mcpKeyCopy.ts:159-166` (`Title`, `Sub`, `OffTag`, `Impact`, `Failed`, `Loading`, `LoadFailed`). Add `pii*` keys with the D-37 words: what it covers, that names are **not** covered, and that an unchecked result is withheld.

**Test analog:** `OrgMcpSwitchCard.test.tsx:1-80`. It hoists `vi.mock("@/lib/api/apiKeys", …)` and keeps `importOriginal`, and its assertions read **rendered words** and `aria-checked`, never `data-testid` alone (presence assertions cannot see content drift).

---

### Document address: `appRoutes.ts`, `useAppNavigation.ts`, `citationNav.tsx`, `App.tsx`

**Route union + parse + format** (`appRoutes.ts:44-51`, `:83-90`, `:137-142`):
```ts
  // Phase 299-02 (D-01): the entity variants. The id-less forms below stay id-free.
  | { view: "chat"; threadId: string }
  | { view: "workflows"; definitionId: string }
  | { view: "experts"; bundleId: string }
...
  if ("bundleId" in route) return `${VIEW_PATHS.experts}/${route.bundleId.toLowerCase()}`
...
  if (head === "experts" && isStrictUuid(id)) return { view: "experts", bundleId: id.toLowerCase() }
```
Add `| { view: "documents"; documentId: string }`, a `"documentId" in route` format arm → `${VIEW_PATHS.documents}/<id>`, and `if (head === "library" && isStrictUuid(id))`. Same strict-UUID rule, lowercased, never throws.

**Open hand-off** (`citationNav.tsx:94-101`; consumer `LibraryPage.tsx:427-433`):
```tsx
  const openDocument = useCallback((documentId: string) => {
    setPendingDocumentId(documentId)
    navigateRef.current?.("documents")
    selectDocumentRef.current?.(documentId)
  }, [])
```
The route-arrival plumbing is one optional prop on `CitationNavProvider` (for example `initialDocumentId`), passed from `App.tsx:316` as one expression. The 299 precedent is `entityLink={nav.entityLink}` at `App.tsx:337`. `citationNav.tsx` **has no ledger row**: add it first. `App.tsx` FIRES (`44 / 30 / 350`).

The refusal for others already exists: `LibraryPage.tsx:888` renders `libDocs.selectedDocError` on the uniform 404.

---

### `backend/tests/integration/test_059_disconnect.py` (fixture retirement)

**Current fixture** (`:63-94`):
```python
@pytest.fixture(autouse=True)
def _reset_sse_starlette_app_status():
    """Reset sse-starlette's module-level AppStatus.should_exit_event before each test.
    ...
    WR-07: assert the sse-starlette version we validated this against ...
    """
    import sse_starlette
    assert sse_starlette.__version__.startswith("2.4."), (...)
    from sse_starlette.sse import AppStatus
    AppStatus.should_exit_event = None
    AppStatus.should_exit = False
    yield
    AppStatus.should_exit_event = None
    AppStatus.should_exit = False
```
**Retirement precedent** (`test_189_no_egress.py:246-256`): a comment block names the phase and D-NN and explains why the retirement is conscious, and the docstring says "Retired gate … remains as a documented milestone record". For 305:
- keep the fixture **name**, since 26 modules import it (R-23);
- assert `startswith("3.0.")` and `not hasattr(AppStatus, "should_exit_event")`;
- reset only `should_exit`;
- the docstring cites D-48 / D-206-07 and upstream #149.

**Dockerfile pin** (`Dockerfile:41-43`):
```dockerfile
# Multi-worker is the production default (WORKER_COUNT=2, decision D-PRD-12).
# exec so uvicorn is PID 1 and receives signals for clean shutdown.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WORKER_COUNT:-2}"]
```
Add `--timeout-graceful-shutdown 5` inside the same `exec` string, with a comment naming D-48. `test_305_dockerfile_graceful.py` reads the CMD line, using the source-reading style of `test_300_clean_image_imports.py:24-26`.

---

### `backend/tests/integration/test_305_two_worker_stateless.py` (live, serialized)

**Analog:** `test_077_multi_worker.py`. Infra guard (`:35-83`), free port (`:90-95`) and the subprocess fixture (`:102-193`):
```python
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", str(port), "--workers", "2"],
        cwd=backend_dir, env=env, stdout=subprocess.DEVNULL, stderr=stderr_file,
    )
    ...
        while time.monotonic() < deadline:
            try:
                r = httpx.get(f"{base_url}/health", timeout=2.0)
    ...
    finally:
        # Threat T-077-05: unconditional cleanup
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
```
Changes for 305:
- `env` adds `BACKEND_PUBLIC_URL=http://127.0.0.1:<port>` and a non-production `ENVIRONMENT`. **No `MOCK_LLM_MODE`**: auth must be the real edge.
- Add `--log-config tests/fixtures/phase305/uvicorn_pid_log.json` so access lines carry `%(process)d`.
- stderr goes to a temp file (`:126-132`, avoids the pipe deadlock), and the PIDs are parsed from it.
- Mint the key through `phase304_fixtures.World.mint` (`:168-189`) and clean up with `World.cleanup` (`:198-220`).
- Each request runs on a fresh `httpx.Client` connection.

---

### Live tool / narrowed / audit / spend suites

**Analog:** `test_304_narrowed_key_live.py:19-66` + `phase304_fixtures.py`:
```python
from app.services import acting_member_reads as reads
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    patch_search,
    search_settings,
    world,
)

pytestmark = requires_pg
...
async def test_narrowed_read_document_refuses_outside_the_subtree(world):
    w = world
    wide = await w.principal(include_external=True)
    p = await w.principal(folder_ids=[w.f])
    ...
        assert await reads.read_document(wide, w.docs[label]) is not None  # non-vacuity
        assert await reads.read_document(p, w.docs[label]) is None, label
```
Rules that carry over:
- every arm also shows the wide key reaching the thing (non-vacuity);
- principals come from a real minted key (`World.principal:191-194`);
- `patch_search(monkeypatch, w)` stubs the embedder (`:243-260`). For the spend suite, that stub must also call `usage_sink.record`, or the token capture goes untested;
- run with `-rs`;
- ⛔ `phase304_fixtures.py:27-28` says **no role-`anon` call to any function here** (BUG-261031-01).

**Anon arm (pii column, `mcp_usage` table):** `test_300_rls_anon_live.py:38-85`. This is a savepoint that always rolls back, with `SET LOCAL ROLE anon` and a `SELECT * FROM <table>` that expects `InsufficientPrivilegeError` or `[]`. **Table SELECTs only, never a function call as anon.**

---

### Package fence: `backend/tests/unit/test_305_package_fence.py`

**Analog:** `test_304_acting_reads_fence.py:39-55` (`_code_only` tokenizer: comments and docstrings stripped so prose cannot satisfy or break a fence) and `:213-238` (banned-token list):
```python
FORBIDDEN_IN_READS = (
    "org_members", "fetch_visible_folders", ".rpc(", ". rpc (", ".table(", ". table (",
    "get_current_user", "Request", ".headers", ". headers", ...
)

def test_the_reads_module_is_fenced_from_every_unnarrowed_path():
    code = _code_only(READS)
    for banned in FORBIDDEN_IN_READS:
        assert banned not in code, banned
```
For every `app/mcp/*.py`, ban:
- `org_members`;
- `get_service_role_supabase` (except, if needed, the audit wrapper);
- `get_current_user`;
- `SET ROLE` / `anon`;
- `X-Org-Id`;
- `_acting_org`.

Import-the-function, never copy it. Image-closure check: extend `test_300_clean_image_imports.py:29-50`. Add the `app/mcp` modules to a module list and map `"mcp": "mcp"` in `IMPORT_TO_DIST`.

---

## Shared Patterns

### One resolver, one refusal
**Source:** `backend/app/security/api_key_auth.py:342-396` (`authenticate_presented_key`) via `security/mcp_principal.py:32-49`
**Apply to:** `app/mcp/edge.py` only. No other module in `app/mcp/` digests or looks up a key (W-1 drift class).
The core already audits attributable refusals through the CR-02 throttle (`_refused:336-339` → `_refuse:304-313`), so **the edge must not audit credential refusals a second time.**

### Audit: no new literal, refusals throttled
**Source:** `api_key_auth.audit_key_call_now:221-243`, `refusal_audit_slot:277-301`, `inbound._refused:241-260`
**Apply to:** `app/mcp/audit.py`, the pii route (`settings.update` + `metadata.event`, as at `api_keys.py:712-718`).
`audit_service.py` and the audit CHECK are untouched (D-26). Never put query text in metadata.

### Blocking I/O off the loop (D-v2.5-01)
**Source:** `api_keys.py:709-711` (`await run_in_threadpool(get_service_role_supabase, str(org))`), `acting_member_reads.py:266` (`await run_in_threadpool(load_user_settings, principal.user_id)`)
**Apply to:** every supabase-py client build on the MCP path (IN-03), including `audit_key_call_now`.

### Fail closed vs fail open: pick deliberately
- Limiter: **fail closed** (`rate_limit.py:58-62`, Redis error → refuse).
- Maintenance flag: **fail open** (`maintenance.py:56-61`).
- Redactor: **fail closed** (withhold). The switch read failing → **redact** (R-21).
Each new module states which of these it is, in its docblock, in the style of `rate_limit.py:10-11`.

### Pure-ASGI only
**Source:** `maintenance.py:9-13` rationale, `canvas_gate.py:223-259`
**Apply to:** `app/mcp/edge.py`. Never `BaseHTTPMiddleware`.

### Static, code-authored tool text
**Source:** `mcp_tool_catalogue.py:1-6` ("Static and code-authored: no user text reaches a tool name, label or description")
**Apply to:** `app/mcp/tools.py`, the server `instructions`, every tool error sentence.

### Live-test hygiene
**Source:** `phase304_fixtures.py` (real minted keys, `finally` cleanup, explicit `org_id` on every insert), `test_077_multi_worker.py` (skip guard + unconditional teardown), `test_300_rls_anon_live.py` (rolled-back savepoints)
**Apply to:** every `tests/integration/test_305_*`. These all mutate the local DB, so they **serialize** (worktree rule 4, D-58).

### Fresh-app route tests
**Source:** `test_304_mcp_switches_routes.py:10`, `:86-104` ("Fresh `FastAPI()` apps with dependency overrides — never `app.main.app`'s lifespan (SEED-363)")
**Apply to:** all route/unit tests. The exceptions are `test_305_lifespan_reentry.py` and `test_305_transport.py`, which need the real `register_mcp` mount; give them a tiny app with `register_mcp` + `mcp_lifespan`, not `app.main.app`.

### Same-commit bookkeeping
**Sources:** ledger section format `docs/HOT-FILE-LEDGER.md:11506-11510` (heading `## \`path\``, sub-heading `### \`path\` — <plan> (<date>)`, bold triple, one paragraph of what changed and why); the scan-list row `:12195` (`| [\`path\`](docs/HOT-FILE-LEDGER.md#anchor) | c / p / l | ⚠ **FIRES** | verdict ≤ 200 chars |`); the CLAUDE.md FIRING row (verdict ≤ **80 chars**, `was \`old triple\``, trailing `· ⛔` if hard-constrained); the count-gate BASELINE pin plus a FILE-LEVEL TARGETS entry with a one-line suite description, **both knobs in the same commit** (`vitest-count-gate.cjs:4518-4529` + `:6643-6652`).
**Apply to:** every FIRING or row-less file above (`main.py`, `maintenance.py` new row, `citationNav.tsx` new row, `user_settings.py`, `settings.py`, `api_keys.py`, `openai_service.py`, `apiKeys.ts`, `skills.ts`, `apiKeyFacts.ts`, `App.tsx`, `full-schema-supplement.sql`) and every new vitest file (`OrgPiiRedactionCard.test.tsx`; raised pins on `appRoutes.test.ts` `:4453`, `ExpertSpendCard.test.tsx` `:4207`, `expertSpendCopy.test.ts` `:4209`). Re-derive triples with the CLAUDE.md recipe; never copy them forward.

---

## No Analog Found

| File | Role | Data Flow | Reason / use instead |
|---|---|---|---|
| `backend/app/mcp/server.py` | service (protocol) | request-response | No MCP server exists in the repo (only the outbound `services/mcp_client.py`). Use RESEARCH Patterns 1-3 and R-02/R-03/R-11 |
| `scripts/mcp-timeout-probe.py` | script | request-response | A standalone lowlevel SDK server, never mounted (R-26) |
| `backend/app/services/outbound_guard.py` (field walker + deadline) | service | transform | Nothing walks Pydantic fields by annotation today. Use the RESEARCH "Fail-closed guard (shape)" example + R-21 |
| `backend/app/services/pii_redactor.py` (Luhn, mod-97, IIN tables) | utility | transform | `logging_sink.py`'s pattern chain is the shape, but there is no checksum validator anywhere. Use R-21 / Pitfall 9 and gate with `scripts/measure-redaction.py` |
| `backend/app/mcp/results.py` (chunker, cursor, defang) | transform | transform | No bounded-chunk reader or opaque cursor exists. Use R-13 / R-15 / D-19 |

## Traps found while mapping (planner must carry these into task actions)

1. **IN-03 trips the 304 fence.** `test_304_acting_reads_fence.py:241-251` requires `get_service_role_supabase (` as a direct argument of `search_documents`. Moving it to `run_in_threadpool` breaks the regex and the count, so update the fence in the same task, keeping "exactly two sanctioned service-role uses".
2. **The spend leg must not repeat `parent_run_id IS NULL` or emit `m.org_id`.** `test_268_spend_rollup.py:110-125` pins both. Alias the usage leg accordingly.
3. **`McpPrincipal` has no `label`.** `audit_key_call_now` writes `api_key_label` from the key dict, so either thread the `ResolvedKey.label` through the edge into scope state beside the principal, or record that MCP rows omit it (the spend ledger joins `api_keys.label` separately, so it does not depend on this).
4. **The edge sits outside FastAPI DI.** `HTTPException` raised by `enforce_ip_limit` is not rendered by FastAPI inside a raw `Route` ASGI endpoint. The edge must catch it and write the 429/503 bytes itself.
5. **`SpendRunItem` literals in `AdminSpendPage.test.tsx`** (`:107,125,442`) mean the new type fields must be optional, or that test file needs edits. Editing it is allowed, because D-31 forbids touching the page, not its test.
6. **`apiKeyFacts.ts` (FIRES ⛔) shows raw reason codes by default.** Without new arms, a limited MCP call reads `✕ refused: rate_limited:expensive`. Decide one reason vocabulary (`over_limit` + `detail.bucket`, or R-18's `rate_limited:<bucket>`) before writing either side.

## Metadata

**Analog search scope:** `backend/app/{middleware,security,services,api,db,models}`, `backend/tests/{unit,integration}`, `backend/tests/test_147_maintenance_mw.py`, `supabase/migrations/215,218,220,221`, `scripts/` (check-migration-220-live.py, full-schema-supplement.sql, vitest-count-gate.cjs), `frontend/src/{components/org,components/settings,components/admin/spend,lib,lib/api,types,pages}`, `docs/HOT-FILE-LEDGER.md`, `backend/Dockerfile`, `backend/requirements.txt`, `deploy/onebox.env.example`
**Files scanned:** ~45 read (targeted ranges for files over 400 lines)
**Pattern extraction date:** 2026-10-31
