# Phase 304: Personal MCP Keys That Act as You - Pattern Map

**Mapped:** 2026-10-30
**Files analyzed:** 58 (31 modified/created source files, 2 migrations, 4 scripts, 21 tests)
**Analogs found:** 56 / 58 (the two with no analog are the EXPLAIN evidence script and `acting_member_reads.py`'s relationship read, which has only a partial analog)
**Base read at:** `0466fdfc2` (develop)

> Read with `304-CONTEXT.md` D-35..D-45 (they supersede D-03 storage, D-10, D-16, D-24, D-25 audit).
> Where `304-RESEARCH.md` and `304-UI-SPEC.md` disagree on a file name, see **§Conflicts to resolve**
> at the bottom. The planner must pick one; this map lists both.

---

## File Classification

### Backend: migrations, scripts (ledger-EXEMPT: `supabase/migrations/`, `scripts/`, `.sql`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/220_api_keys_kind_and_mcp_switches.sql` (new) | migration | DDL + column grants | `supabase/migrations/215_api_keys_and_run_origin.sql` | exact |
| `supabase/migrations/221_acting_org_narrowing.sql` (new) | migration | DDL (fn + policies) | `supabase/migrations/181_revoke_public_secdef_functions.sql` + `194_org_plan_columns_not_client_writable.sql` | role-match |
| `scripts/full-schema-supplement.sql` (mod, FIRES 27/19/891) | config mirror | ACL mirror | its own mig-215 block, lines 860-866 | exact |
| `scripts/check-migration-220-live.py` / `-221-live.py` (new) | utility | read-only catalog check | `scripts/check-migration-215-live.py` | exact |
| `scripts/explain-acting-org.py` (new, D-39) | utility | EXPLAIN evidence | none in repo (research scratch `explain304.py`) | no analog |
| `supabase/full-schema.sql` | generated | — | `bash scripts/regenerate-full-schema.sh` (no `--reset`), never hand-edited | n/a |

### Backend: source (`backend/app/**` is WATCHED: every file needs a scan-list row, new ones too)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/security/api_key_auth.py` (mod) | middleware/auth | request-response | itself (pure-move extraction) | exact |
| `backend/app/security/acting_org.py` (new leaf) | utility (contextvar) | — | `backend/app/services/expert_scope.py` "imports nothing from `app.`" leaf rule | partial |
| `backend/app/security/acting_member.py` (new) | middleware | RLS connection | `backend/app/dependencies.py:158-177` `get_user_pg_connection` | role-match |
| `backend/app/security/mcp_principal.py` (new) | model | frozen value | `api_key_auth.py:70-84` `MintedKey` / `ResolvedKey` | exact |
| `backend/app/services/key_scope.py` (new, pure) | service (pure) | transform | `backend/app/services/expert_scope.py` | exact |
| `backend/app/services/mcp_tool_catalogue.py` (new, pure data) | config constant | — | `api/admin.py:77-90` `_FLAG_HUMAN_NAMES` code-constant allowlist | role-match |
| `mcp_url()` (D-28; inside `mcp_tool_catalogue.py` or own module) | utility | — | `backend/app/api/inbound.py:476-490` `_public_api_base` | exact |
| `backend/app/services/acting_member_reads.py` (new) | service | CRUD-read on RLS conn | `backend/app/services/retrieval_scope.py:262-268` `_rls_intersect` + `retrieval_rpc._call_as_user` | role-match |
| `backend/app/dependencies.py` (mod, FIRES 24/12/1147) | middleware | RLS context | itself, `_apply_rls_user_context` lines 127-155 | exact |
| `backend/app/db/api_keys.py` (mod, young 5/2/307) | model/db | CRUD | itself | exact |
| `backend/app/models/api_key.py` (mod, young 2/2/117) | model (wire) | request-response | itself | exact |
| `backend/app/api/api_keys.py` (mod, young 3/2/421) | controller | request-response | itself; audit via `api/org.py:822-841` | exact |
| `backend/app/api/admin.py` (mod, FIRES 44/17/2054) | controller | config write | `_FLAG_HUMAN_NAMES` line 77-89 | exact |
| `backend/app/models/user_settings.py` (mod, FIRES 62/38/1788) | model | settings read | `workflows_enabled` lines 235 / 1174 | exact |
| `backend/app/api/settings.py` (mod, FIRES 48/26/1398) | controller | settings read | `workflows_enabled` lines 168 / 505 | exact |

### Frontend (`frontend/src/**` is WATCHED)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `frontend/src/lib/api/apiKeys.ts` (mod, young 2/2/174) | API client | request-response | itself | exact |
| `frontend/src/lib/api/admin.ts` (mod, FIRES 10/5/1125) | API client type | — | `FlagKey` union lines 413-421 | exact |
| `frontend/src/lib/api/skills.ts` (mod, FIRES 10/7/779) | API client type | — | `workflows_enabled: boolean` line 639 | exact |
| `apiKeys/apiKeysCopy.ts` (mod, FIRES 5/3/283) | copy leaf | — | itself (`API_KEYS_COPY`, `fillCopy`) | exact |
| `apiKeys/apiKeyFacts.ts` (mod, FIRES 4/3/310) | pure facts | transform | itself `keyCardFacts` lines 113-133 | exact |
| `apiKeys/mcpKeyFacts.ts` (new, pure) | pure facts | transform | `apiKeyFacts.ts` + `LegalHoldDialog.tsx:86-106` `flattenFolders` | exact |
| `apiKeys/mcpSnippets.ts` (new, pure) | pure builder | transform | `apiKeys/curlExamples.ts` | exact |
| `apiKeys/ApiKeysTab.tsx` (mod, young) | component (owner) | fetch + state | itself | exact |
| `apiKeys/ApiKeyDraftCard.tsx` (mod, young) | component (form) | form | itself | exact |
| `apiKeys/ApiKeyCard.tsx` (mod, young) | component | display | itself | exact |
| `apiKeys/ApiKeySecretOnce.tsx` (mod, young) | component | display | itself | exact |
| `apiKeys/RevokeApiKeySheet.tsx` (mod, young) | component | confirm | itself | exact |
| `apiKeys/ApiKeyKindChoice.tsx` (new) | component | radiogroup | `ApiKeyDraftCard.tsx:189-210` Expires radiogroup | exact |
| `apiKeys/McpKeyFields.tsx` (new) | component | form rows | `ApiKeyDraftCard.tsx:135-182` workflows checklist row | exact |
| `apiKeys/KeyFoldersField.tsx` (new) | component | tree checklist | `retention/LegalHoldDialog.tsx` + `chat/ScopePicker.tsx` | role-match |
| `apiKeys/McpConnectSnippets.tsx` (new) | component | display + copy | `ApiKeySecretOnce.tsx:29-50` `CopyButton` + its `<pre>` blocks | role-match |
| `apiKeys/McpOffNotice.tsx` (new) | component | display | `OrgApiKeysTab.tsx:76` note line | partial |
| `frontend/src/components/org/OrgMcpSwitchCard.tsx` (new) | component | read + write | `admin/CapabilityGrid.tsx:130-264` `CapabilityCard` + `CapabilitySwitch` | exact |
| `frontend/src/components/org/OrgApiKeysTab.tsx` (mod, young) | component | fetch + list | itself | exact |
| `frontend/src/components/org/OrgSettingsTab.tsx` (mod, **NO ROW**) | component (leaf) | display | itself | exact |
| `frontend/src/components/org/OrgAdminShell.tsx` (mod, FIRES 10/6/416) | shell | mount | line 396 `RetentionTab` mount | exact |
| `frontend/src/components/org/OrgAuditTab.tsx` (mod, FIRES 5/4/416) | component | display map | `INVITE_EVENT_LABEL` lines 76-93 | exact |
| `frontend/src/components/admin/CapabilityGrid.tsx` (mod, FIRES 3/3/264) | component | data row | `workflows_enabled` entry lines 95-102 | exact |
| `frontend/src/components/admin/ControlRoomPage.tsx` (mod, **NO ROW**) | page | data wiring | line 670-675 `capabilityFlags` | exact |
| `scripts/vitest-count-gate.cjs` (mod, FIRES 406/85/6910) | gate pins | — | its own pin list | exact |

### Tests (ledger-EXEMPT)

| New File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/tests/unit/test_304_key_scope.py` | test (pure) | — | `backend/tests/unit/test_267_expert_scope.py` | exact |
| `backend/tests/unit/test_304_resolver_kind.py` | test (fakes) | — | `backend/tests/unit/test_293_key_auth.py` `world` / `client` fixtures (lines 85-163) | exact |
| `backend/tests/unit/test_304_principal_liveness.py` | test (fakes) | — | same | exact |
| `backend/tests/unit/test_304_acting_reads_fence.py` (static) | test (static fence) | — | `test_293_key_auth.py:310-315` `test_the_resolver_never_depends_on_the_jwt_user` | exact |
| `backend/tests/integration/test_304_acting_org_rls_live.py` | test (live DB) | — | `backend/tests/integration/_rls_harness.py` + `test_181_secdef_privileges.py` | exact |
| `backend/tests/integration/test_304_two_org_parity_live.py` | test (live DB) | — | `backend/tests/integration/test_298_two_org_lists_live.py` | exact |
| `backend/tests/integration/test_304_narrowed_key_live.py` | test (live DB) | — | `test_298_two_org_lists_live.py` + `test_272_rpc_document_scope.py` (chunk seeding) | exact |
| `backend/tests/unit/test_304_migration_220.py` (optional) | test (static SQL) | — | `backend/tests/unit/test_293_migration_215.py` | exact |
| `backend/tests/fixtures/phase293/api_keys_contract.json` (mod) | contract fixture | — | itself; pinned by `test_293_api_keys_routes.py` + `apiKeysContract.test.ts` | exact |
| `frontend/src/components/settings/apiKeys/__tests__/*.test.ts(x)` (new: `mcpSnippets`, `mcpKeyFacts`, `ApiKeyKindChoice`, `KeyFoldersField`, `McpConnectSnippets`; mod: `apiKeysContract`, `ApiKeyCard`, `ApiKeysTab`, `RevokeApiKeySheet`) | test | — | `__tests__/curlExamples.test.ts`, `__tests__/apiKeysContract.test.ts`, `__tests__/fixtures.ts` | exact |

---

## Pattern Assignments

### `supabase/migrations/220_*.sql` (migration, DDL + grants)

**Analog:** `supabase/migrations/215_api_keys_and_run_origin.sql`

**Header block** (lines 1-44): a WHAT / WHY / VISIBILITY / NOT A SEED / apply-discipline header. Copy its
"Apply discipline" lines verbatim (paste into the SQL editor, never `db push`/`db reset`, then
`regenerate-full-schema.sh` + `check-migration-220-live.py`) and replace the `assert_action_types_synced`
warning: **220 adds no audit literal (D-36)**, so the boot-order hazard does not apply.

**Transaction + idempotency** (lines 46, 109-111, 230): `BEGIN; … COMMIT;`, every constraint as
`DROP CONSTRAINT IF EXISTS … ; ADD CONSTRAINT …`, every column `ADD COLUMN IF NOT EXISTS`:
```sql
ALTER TABLE public.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_origin_kind_check;
ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_origin_kind_check
    CHECK (origin_kind IS NULL OR origin_kind IN ('app', 'schedule', 'key'));
```
220 re-issues this exact pair with `'mcp'` appended (D-37). The inline `workflows` CHECK from line 56 is
named `api_keys_workflows_check` (measured in research) and is replaced by the kind-conditional form.

**Column grant, REVOKE-first** (lines 85-93), re-issued with the four new columns, never `key_hash`:
```sql
REVOKE ALL ON TABLE public.api_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM authenticated;
REVOKE ALL ON TABLE public.api_keys FROM service_role;
GRANT SELECT (id, org_id, user_id, label, key_prefix, workflows, expires_at, revoked_at, revoked_by, last_used_at, created_at) ON TABLE public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_keys TO service_role;
```
Full target SQL: `304-RESEARCH.md` §"Migration 220 / 221 shape".

**Switch columns, not a seed** (lines 195-224 pattern): `ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS
mcp_enabled boolean NOT NULL DEFAULT true;` + a `COMMENT ON COLUMN` naming the phase and the writer
(`PUT /admin/flags`). Same for `organizations.mcp_enabled` (D-35). Defaults carry it: no
`docs/OPERATOR.md` Step-3 entry, no env var, `check-deploy-drift.sh` unaffected (the 215 "NOT A SEED" paragraph,
lines 32-35). Research recommends moving both switch columns into 220 so 221 is narrowing-only.

**Comment update** (line 66-67): `key_prefix` comment says "srl_live_ + 4"; rewrite to "the prefix + 4 characters".

**VERIFY block** (lines 232-284): a commented `with checks(what, ok) as (values …) select case when ok then 'PASS' …`
block. Copy its `has_column_privilege` / `has_table_privilege` rows and add: `kind`/`folder_ids`/`tools`/
`include_external` SELECT-able by authenticated; `key_hash` not; `organizations.mcp_enabled` NOT UPDATE-able by
authenticated (D-33, R-02); `'mcp'` present in `workflow_runs_origin_kind_check`.

---

### `supabase/migrations/221_*.sql` (migration, function + policy route-through)

**Analog A:** `supabase/migrations/104_org_dept_role_schema.sql:187-200` (the current `current_user_has_permission` body)
```sql
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_org_id uuid, p_permission_key text)
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members m
    JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND rp.permission_key = p_permission_key
  );
$$;
```
Re-declare with the IDENTICAL header (sql, STABLE, SECURITY DEFINER, `SET search_path TO 'public'`) and add
`AND m.org_id IN (SELECT public.current_user_org_ids())` (R-05 row 1). ⛔ Any attribute change voids R-01.

**Analog B (ACL re-issue):** `scripts/full-schema-supplement.sql:691-694` and `:701-704` (mig 181), copied verbatim
after each `CREATE OR REPLACE` (D-16 / D-39), PUBLIC first:
```sql
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO service_role;
```
`current_user_org_ids()` new body: `304-RESEARCH.md` lines 178-194 (use exactly).

**Analog C (policies):** `supabase/migrations/187_expert_bundles.sql:66-95` (`expert_bundles_read_policy` is
`FOR SELECT`, `expert_bundles_write_policy` is `FOR ALL`, both `TO authenticated, service_role`) and
`183_model_rates.sql`. Pattern: `DROP POLICY IF EXISTS "<name>" ON …; CREATE POLICY "<name>" …` with the
direct `org_members` subquery replaced by `(SELECT public.current_user_org_ids())`. All **six** policies
(both FOR ALL write policies too, D-39). Keep every other arm (`auth.role() = 'service_role' OR is_system = true …`) byte-identical.

**Analog D (BUG-261030-03, D-42):** `supabase/migrations/194_org_plan_columns_not_client_writable.sql` lines 23-25:
```sql
REVOKE INSERT, UPDATE ON TABLE public.organizations FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.organizations FROM authenticated;
REVOKE INSERT, UPDATE ON TABLE public.organizations FROM PUBLIC;
```
221 adds `REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.organizations FROM PUBLIC/anon/authenticated`
in the same style. ⚠ `organizations.mcp_enabled` is automatically outside mig 194's column grant
(`GRANT UPDATE (name, slug, settings, updated_at)`, supplement line 510); do NOT add it there.

---

### `scripts/full-schema-supplement.sql` (FIRES 27/19/891: copy of the migration's lines only)

**Analog:** its own mig-215 block, lines 860-866:
```sql
-- migration 215 — api_keys: owners READ (column grant, key_hash never granted); only the backend writes.
REVOKE ALL ON TABLE public.api_keys FROM PUBLIC;
...
GRANT SELECT (id, org_id, user_id, label, key_prefix, workflows, expires_at, revoked_at, revoked_by, last_used_at, created_at) ON TABLE public.api_keys TO authenticated;
```
Add a `-- migration 220 —` block with the widened GRANT line (or edit line 865 in place: research says
"mirror the new GRANT line in `full-schema-supplement.sql:865`") and a `-- migration 221 —` block with the
organizations REVOKEs. The 181 lines 691-694 / 701-704 already match the re-issued tuples. Gates:
`node scripts/check-schema-acl-parity.cjs`, `backend/venv/Scripts/python scripts/check-greenfield-privileges.py`.

---

### `scripts/check-migration-220-live.py` / `-221-live.py` (utility, read-only)

**Analog:** `scripts/check-migration-215-live.py` (whole file, 114 lines). Copy the skeleton exactly:
`REPO_ROOT` + `sys.path.insert`, `os.chdir(REPO_ROOT / "backend")` before `from app.config import settings`,
one `asyncpg.connect(settings.postgres_dsn)`, a `missing: list[str]` of named items, exit codes
**0 live / 1 missing / 2 unreachable**:
```python
    except (OSError, ConnectionError) as exc:
        print(f"FATAL: could not reach the local database: {type(exc).__name__}: {exc}")
        return 2
```
221's script checks via `pg_get_functiondef('public.current_user_org_ids()'::regprocedure)` containing
`app.acting_org_id`, `provolatile = 's'`, `prosecdef`, `prorows = 1000`; `has_function_privilege('anon', …)` false;
`has_table_privilege('anon','public.organizations','TRUNCATE')` false.

---

### `backend/app/security/api_key_auth.py` (auth, request-response) — extract FIRST

**Analog:** itself. **Commit 1 = pure move** of lines 286-328 into `authenticate_presented_key(...)` in the
SAME module (monkeypatch targets `auth.write_audit_entry` / `auth.get_service_role_supabase` resolve from this
module's globals; `test_293_key_auth.py:129-134`).

Current core to move (lines 289-314), unchanged in commit 1:
```python
    digest = digest_key(presented)
    if digest is None:
        raise _invalid()
    row = await api_keys_db.get_key_for_auth(pool, digest)
    ...
    if row.get("revoked_at") is not None:
        raise await _refuse(row, call=call, reason="revoked", redis=redis)
    expires_at = row.get("expires_at")
    if expires_at is not None and expires_at <= datetime.now(timezone.utc):
        raise await _refuse(row, call=call, reason="expired", redis=redis)
    if not await api_keys_db.is_org_member(pool, org_id=row["org_id"], user_id=row["user_id"]):
        raise await _refuse(row, call=call, reason="not_member", redis=redis)
    if await deps._is_banned(str(row["user_id"])):
        raise await _refuse(row, call=call, reason="banned", redis=redis)
```
`resolve_api_key` (line 279) keeps its name, signature and `Depends` identity (it is a
`dependency_overrides` key in `phase293_inbound_fakes.py`); its body becomes the `NO_KEY_DETAIL` header check
(line 286-287) + `return await authenticate_presented_key(presented, pool=pool, redis=redis, call=_call_kind(request), expected_kind="workflow")`.

**Mint pattern** (lines 87-95): add `kind` with the prefix table and `key_prefix = secret[:len(prefix) + 4]`
(keeps the pinned 13-char `srl_live_` prefix, gives 12 for `srl_mcp_`).

**Refusal pattern** (lines 267-276 `_refuse`): attributable refusals go through `refusal_audit_slot` then
`audit_key_call_now(row, "api_key.refused", call=call, reason=reason, …)`; new reasons `wrong_kind`,
`mcp_off_org`, `mcp_off_deployment` (D-36). Pass `call="read"` for MCP resolutions (research pitfall 9: 
`_call_from_audit` in `api/api_keys.py:108-125` maps only start/read).

**Frozen result** (lines 77-84 `ResolvedKey`): add `kind`, `folder_ids`, `tools`, `include_external` **with
defaults** after `expires_at`, so `phase293_inbound_fakes.py:162` keeps constructing it.

**Static constraint** (`test_293_key_auth.py:310-315`): the file must never contain the token `get_current_user`
or a `secret_cipher` import, comments stripped. Keep new code free of both.

---

### `backend/app/security/acting_org.py` (new leaf, contextvar)

**Analog (leaf rule):** `backend/app/services/expert_scope.py` docblock lines 30-40: "imports nothing from `app.`".
Body is the research sketch (`304-RESEARCH.md` §"The `dependencies.py` edit"):
```python
_acting_org: ContextVar[str | None] = ContextVar("acting_org_id", default=None)
def current_acting_org() -> str | None: return _acting_org.get()
```
The setter lives ONLY in `acting_member.py` (D-14). Needs a young ledger row.

---

### `backend/app/dependencies.py` (FIRES 24/12/1147: the one sanctioned 3-4 line edit)

**Analog:** itself, `_apply_rls_user_context` lines 148-155. The existing parameterised, `is_local=true` form to copy:
```python
    await conn.execute("SET LOCAL ROLE authenticated")
    await conn.execute(
        "SELECT set_config('request.jwt.claim.sub', $1, true)", str(uid)
    )
    await conn.execute(
        "SELECT set_config('request.jwt.claims', $1, true)",
        json.dumps({"sub": str(uid), "role": "authenticated"}),
    )
```
Append after line 155 (and a one-line import of `current_acting_org` from the leaf):
```python
    org = current_acting_org()
    if org is not None:
        await conn.execute("SELECT set_config('app.acting_org_id', $1, true)", org)
```
Signature unchanged, so `tests/integration/_rls_harness.py:35` (imports this function verbatim) picks it up.
Ledger row exists (FIRES); update triple + section in the same commit.

---

### `backend/app/security/acting_member.py` (new, RLS connection)

**Analog:** `backend/app/dependencies.py:158-177` `get_user_pg_connection` (`@asynccontextmanager`, acquire →
`conn.transaction()` → `_apply_rls_user_context` → `yield conn`) and its non-request call form in
`backend/app/services/retrieval_scope.py:266`:
```python
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        rows = await conn.fetch(_RLS_INTERSECT_SQL, list(ids))
```
`acting_as(principal)`: validate `str(UUID(principal.org_id))`, `token = _acting_org.set(...)`, `yield`,
`_acting_org.reset(token)` in `finally`. `acting_member_connection(principal)` = `acting_as` +
`get_user_pg_connection(None, {"id": principal.user_id})`. Also home of `principal_still_allowed` if the
planner keeps it beside the principal (research places it next to the resolver core in `api_key_auth.py`;
either way it must reuse `api_keys_db.is_org_member` + `deps._is_banned` so 293's monkeypatches still drive it).

**Live switch read** (R-09, never `load_app_settings()`): one SQL in `db/api_keys.py` (see below).

---

### `backend/app/security/mcp_principal.py` (new, frozen value)

**Analog:** `api_key_auth.py:70-84`:
```python
@dataclass(frozen=True)
class ResolvedKey:
    id: str
    org_id: str
    ...
```
Fields per D-20: `key_id, user_id, org_id, folder_ids: tuple[str, ...] | None, tools: tuple[str, ...],
include_external: bool, credential_kind: Literal["key"]`. Built from `ResolvedKey` only, never request data.

---

### `backend/app/services/key_scope.py` (new, pure composition)

**Analog:** `backend/app/services/expert_scope.py` (160 lines). Copy:
- the docblock contract (lines 13-15): "PURE: plain data in, a frozen value out. It performs no I/O, imports no
  database or LLM client, and never raises."
- the frozen dataclass shape (lines 47-63);
- the keyword-only signature with `visible_folders: list[dict]` passed in by the caller (lines 66-76);
- the subtree walk (lines 86-91), which D-21 says to mirror rather than re-derive:
```python
    def _get_subtree(root_id: str) -> list[str]:
        res = [root_id]
        for f in all_folders:
            if str(f.get("parent_id") or "") == root_id:
                res.extend(_get_subtree(str(f["id"])))
        return res
```
⚠ Add a visited-set (expert_scope has none; a cycle would recurse forever and the pure function must never raise).
⚠ `()` must survive as "matches nothing", never coerced to `None` (research pitfall 4; the 266 CR-01 class).
`EXTERNAL_COLUMN = "source_connection_id"` + one SQL fragment + one Python predicate live here (D-40).

---

### `backend/app/services/mcp_tool_catalogue.py` (new, pure data) + `mcp_url()`

**Analog (code-constant allowlist):** `backend/app/api/admin.py:72-90`, a dict keyed by code names with plain
human names, `_FLAG_KEYS = set(_FLAG_HUMAN_NAMES)` used as the validation set. The catalogue is
`name → {group, label, travels_with}` (D-11/D-12), with a derived `frozenset` for save-time validation (422 on unknown).

**Analog (URL):** `backend/app/api/inbound.py:484-486`:
```python
    from app.config import settings  # noqa: PLC0415
    configured = str(getattr(settings, "backend_public_url", "") or "").strip().rstrip("/")
```
`mcp_url()` = that + `MCP_PATH = "/mcp"`; return `None` when unset so the UI renders `mcp.noAddress`
(note `config.py:1686` defaults it to `http://localhost:8000`; decide whether loopback counts as "unset", as
`_public_api_base` does at line 488).

---

### `backend/app/services/acting_member_reads.py` (new, CRUD-read on the acting connection)

**Analogs:**
- connection + one-statement shape: `retrieval_scope.py:262-268` `_rls_intersect` (above);
- search reuse: `retrieval_service.search_documents(query, user_id, supabase, …, folder_ids=…)` (signature at
  `retrieval_service.py:65-73`). `document_ids` must stay `None` (D-40: post-filter, not an allow-list; an empty
  list returns `([], 0.0)` per lines 86-87);
- views reuse: `retrieval_scope.resolve_document_scope(*, user_id, conditions, folder_ids, supabase, predicates)`
  (lines 311-318; step 2 decides on the RLS connection);
- workflows reuse: `db/workflows.list_published_workflows(pool, *, user_id, project_folder_id=None, owned_only=False, org_id=None)`
  (lines 588-595), passing the acting `conn` as `pool` (it only calls `.fetch`);
- list projection: `api/documents.py:803-809` `LIST_SELECT` column list (translate to SQL columns; drop the two
  embedded PostgREST counts) against `public.library_documents`;
- relationship masking: IMPORT, never copy, from `services/document_relationship_service.py:57-69`:
```python
from app.services.document_relationship_service import _INVERSE_LABEL, _NO_ACCESS_MASK
```
- owner masking on folder rows: `utils/folder_utils.py:190` `_null_foreign_global_owner(rows, caller_id, visible_non_owned_ids=None)`.

⛔ Never `fetch_visible_folders`, `document_search_service`, `document_view_resolver`, `fetch_full_document`,
`documents_api.list_documents` (supabase-py; GUC never reaches PostgREST; R-06). ⛔ No `org_members` in the module.

---

### `backend/app/db/api_keys.py` (young 5/2/307: three-place lockstep)

**Analog:** itself.
- `_KEY_COLUMN_NAMES` (lines 38-41): append `"kind", "folder_ids", "tools", "include_external"`. `_AUTH_COLUMNS`
  (line 47) follows automatically.
- `create_api_key` (lines 56-91): add keyword args; bind jsonb as a **plain list** (docblock lines 14-17,
  "There is no `json` import in this module and there must not be one").
- Keep the owner predicate in every statement (docblock lines 6-12).
- New `mcp_switches(pool, org_id)` beside `is_org_member` (lines 207-215), same style:
```python
async def is_org_member(pool: asyncpg.Pool, *, org_id: UUID, user_id: UUID) -> bool:
    value = await pool.fetchval(
        "SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2 LIMIT 1",
        org_id, user_id,
    )
    return value is not None
```
SQL from research: `SELECT o.mcp_enabled AS org_on, (SELECT a.mcp_enabled FROM public.app_settings a WHERE a.id = 'global') AS deploy_on FROM public.organizations o WHERE o.id = $1`. A missing row / failed read refuses (fail closed).
- Org switch write: `set_org_mcp_enabled(pool, *, org_id, enabled)` (UPDATE … WHERE id = $1, returning the value).

---

### `backend/app/models/api_key.py` (young 2/2/117)

**Analog:** itself. `ApiKeyRead` (lines 43-57) gains `kind`, `tools`, `folders`, `include_external`, `org_name`,
`mcp_off` (UI-SPEC §Wire) with defaults; `ApiKeyList` (65-67) gains `mcp`. `ApiKeyCreateBody` (lines 70-93) keeps
`model_config = ConfigDict(extra="forbid")` and the `field_validator` style:
```python
    @field_validator("label")
    @classmethod
    def _label(cls, v: str) -> str:
        v = v.strip()
        if not 1 <= len(v) <= 60:
            raise ValueError("A key label must be 1 to 60 characters.")
        return v
```
Use the same `ValueError("<plain sentence>")` form for D-08 (`folder_ids == []`, `tools == []`) and D-07 (no
`null` expiry for `kind="mcp"`). The frontend strips `"Value error, "` (`lib/api/apiKeys.ts:168`), so the
sentence renders verbatim. Discriminated-union vs model-level validator is the planner's call.

---

### `backend/app/api/api_keys.py` (young 3/2/421)

**Analog:** itself.
- Capability gate (line 256) moves from `dependencies=[Depends(require_capability("workflows"))]` into the
  handler, applied only for `kind="workflow"` (D-41).
- 422 sentence pattern (lines 285-290): unknown and not-yours read the same:
```python
            raise HTTPException(
                status_code=422,
                detail=(
                    f"One of the picked workflows can't be found, or you can't start it: {wid}."
                ),
            )
```
Folder validation copies this: an unknown and a not-visible folder id get one sentence.
- 409 wording (lines 338-342): reword for both kinds (research pitfall 6: the label index spans kinds).
- Audit (lines 344-349): add `detail={"kind": …}` or metadata kind to `audit_key_call(…, "api_key.create", call="manage")`.
- `_serialize_keys` (128-197) is one of the three lockstep places; add the new fields there.
- Org switch: `GET/PUT /org/api-keys/mcp-access` on the existing `org_router` (line 64) behind
  `current_user: dict = Depends(require_org_manage)` + `active_org: str = Depends(get_active_org_id)` (lines 385-388);
  no `main.py` mount needed.

**Audit for the org switch** (D-36): copy `api/org.py:830-841` but on the asyncpg path:
```python
    await write_audit_entry(
        user_id=current_user["id"],
        action_type=_SSO_AUDIT_ACTION,          # "settings.update"
        metadata={"event": "sso.provider.create", ...},
        supabase=audit_supabase,
        org_id=str(request.state.active_org),  # EXPLICIT active_org (T-167-23)
    )
```
→ `action_type="settings.update"`, `metadata={"event": "mcp_access", "enabled": bool}`, explicit `org_id`.
`audit_supabase` there is `Depends(get_user_supabase_client)` (org.py:389); `api_key_auth.audit_key_call`
instead uses `get_service_role_supabase(org)` (lines 178-181). Pick one; the explicit `org_id` is the invariant.

---

### `backend/app/api/admin.py` (FIRES 44/17/2054: one dict entry)

**Analog:** lines 77-89:
```python
_FLAG_HUMAN_NAMES = {
    "web_search_enabled": "web search",
    ...
    "workflows_enabled": "workflows",
    ...
}
_FLAG_KEYS = set(_FLAG_HUMAN_NAMES)
```
Add `"mcp_enabled": "MCP access"`. `set_flag` (lines 648-694) then writes `flag.mcp_enabled.on|off` and
"Turned ON MCP access for everyone" through `operator_audit_floor` with no further code. ⚠ The flag write
invalidates the per-worker 30 s TTL cache; the liveness read must still be the live SQL (R-09).
Optional, documentation-only: `main.py:96` `_DIRECT_COLUMNS` (FIRES 99/73/1021) lists the flag columns for the
legacy migration path; research does not require it. Skip unless the planner wants it, because it costs a FIRING row.

### `backend/app/models/user_settings.py` (FIRES 62/38/1788: two lines) + `backend/app/api/settings.py` (FIRES 48/26/1398: two lines)

**Analog:** `user_settings.py:235` `workflows_enabled: bool = True` and `:1174`
`workflows_enabled=_val_bool(row, "workflows_enabled", None, True),`; `settings.py:168` `workflows_enabled: bool`
and `:505` `workflows_enabled=s.workflows_enabled,`. Add `mcp_enabled` in the same four positions. This is the
Control Room readback only; the access gate never reads it.

---

### `frontend/src/lib/api/apiKeys.ts` (young 2/2/174)

**Analog:** itself. Types mirror `models/api_key.py` and are pinned by `__tests__/apiKeysContract.test.ts`
(`satisfies` + key-path set equality with `backend/tests/fixtures/phase293/api_keys_contract.json`). Header
rule (lines 5-7): not re-exported from `lib/api.ts`. New calls follow `listOrgApiKeys` (lines 138-143):
```ts
export async function listOrgApiKeys(signal?: AbortSignal): Promise<ApiKeyList> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/api-keys`, { headers, signal })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as ApiKeyList
}
```
→ `getOrgMcpAccess()`, `setOrgMcpAccess(enabled)`, and the pickable-folders read. `readApiKeyFailure`
(lines 159-174) already surfaces a 422 `detail` sentence and Pydantic `msg`.

### `frontend/src/lib/api/admin.ts` (FIRES) / `frontend/src/lib/api/skills.ts` (FIRES)

**Analog:** `admin.ts:413-421` `FlagKey` union (append `| "mcp_enabled"` with a phase comment like line 419-420);
`skills.ts:639` `workflows_enabled: boolean` (add `mcp_enabled: boolean` beside it). `lib/api.ts:407` re-exports
`FlagKey` as a type: no edit to the barrel (D-24 forbids it).

---

### `apiKeys/apiKeysCopy.ts` (FIRES 5/3/283) — see §Conflicts

**Analog:** itself, lines 1-32: a TRUE LEAF ("imports nothing and exports only strings and string-builders"),
`{slot}` + `(s)` templates filled by `fillCopy` (lines 22-30). UI-SPEC adds `kind` and `mcp` blocks and rewords
four keys (`tab.description`, `tab.empty`, `admin.description`, `admin.descriptionNoOrg`); no key renamed or removed.

### `apiKeys/apiKeyFacts.ts` (FIRES 4/3/310) + new `apiKeys/mcpKeyFacts.ts` (pure)

**Analog:** `apiKeyFacts.ts` header (lines 1-11: "PURE: no React, no fetch, no storage, and it spells no copy")
and `keyCardFacts` (lines 113-133). `KeyTagKind` (line 52) gains `"off"`; `keyCardFacts` branches on `key.kind`
and calls `mcpKeyFacts` for scope chips. Tag precedence copies lines 118-122 (revoked → expired → off → active).
`lastUsed` already falls back to `C.card.neverUsed` (line 129); UI-SPEC's `mcp.notUsedYet` replaces it for MCP.

`mcpKeyFacts.ts` folder flattening copies `retention/LegalHoldDialog.tsx:86-106` (cycle-safe, name-ordered, orphan at top):
```ts
function flattenFolders(folders: readonly Folder[]): FolderRow[] {
  const ids = new Set(folders.map((f) => f.id))
  const children = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const parent = f.parent_id && ids.has(f.parent_id) ? f.parent_id : null
    children.set(parent, [...(children.get(parent) ?? []), f])
  }
  ...
}
```
plus subtree inclusion (descendants of a ticked row render checked + disabled).

### `apiKeys/mcpSnippets.ts` (new, pure builder)

**Analog:** `apiKeys/curlExamples.ts`: a PURE module with a docblock naming what is real vs placeholder, small
exported builders returning `string[].join("\n")`. ⛔ Unlike `startCurl`/`statusCurl` (which take `secret`),
the new builders take `(mcpUrl, envVarName)` only (UI-SPEC: "no `secret` parameter"). Snippet bodies:
`304-RESEARCH.md` §"Client snippets (D-27)". Test analog: `__tests__/curlExamples.test.ts`.

### `apiKeys/ApiKeyKindChoice.tsx` (new) / `McpKeyFields.tsx` (new)

**Analog:** `ApiKeyDraftCard.tsx`. Radiogroup with roving tabindex (lines 81-88 key handler, 189-210 markup):
```tsx
<div role="radiogroup" aria-labelledby={ids.exp} className="inline-flex rounded-md border border-border p-0.5">
  {EXPIRIES.map((e, i) => (
    <button key={e} ref={(el) => { radioRefs.current[i] = el }} type="button" role="radio"
      aria-checked={expiry === e} tabIndex={expiry === e ? 0 : -1}
      onClick={() => setExpiry(e)} onKeyDown={(ev) => onRadioKey(ev, i)} …>
```
Label-column row (lines 135-139: `grid gap-1 md:grid-cols-[128px_1fr] md:gap-4`) and the bordered scroll box
(line 140: `max-h-[208px] overflow-y-auto rounded-md border border-border`) with loading `role="status"` /
failed `role="alert"` + Retry (lines 141-153). Disabled-row reason on the right (lines 160-176).
The "why" line + `aria-describedby` on Create (lines 73-75, 222-238) carries the D-08 sentence.
Expires for MCP: `EXPIRIES` (line 28) without `"never"`.

### `apiKeys/KeyFoldersField.tsx` (new)

**Analog:** `chat/ScopePicker.tsx:46-66` `flattenTree` (identical shape to LegalHoldDialog; ScopePicker adds the
`min-h-[44px] sm:min-h-0` touch target, line 69) for indentation; checkbox row from `ApiKeyDraftCard.tsx:160-176`.
Data comes from the pickable-folders read (acting visibility), never from `GET /folders`.

### `apiKeys/McpConnectSnippets.tsx` (new)

**Analog:** `ApiKeySecretOnce.tsx:26-50` (`CopyId` / `CopyState`, `COPY_STATE_MS = 2000`, `CopyButton` with
`aria-label`) and its `<pre>` blocks. ⛔ Its header contract (lines 4-7) is the secret rule; `McpConnectSnippets`
gets no secret prop at all. Tabs import `@/components/ui/tabs` (ledger row: "absent for its ENTIRE LIFE"; do not edit it).

### `apiKeys/ApiKeyCard.tsx` / `ApiKeySecretOnce.tsx` / `RevokeApiKeySheet.tsx` / `ApiKeysTab.tsx` (young)

**Analog:** themselves. Card header row (ApiKeyCard lines 82-106): the kind chip goes after the label `<span>`
(line 84-86), styled like the draft tag (`ApiKeyDraftCard.tsx:111`
`rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground`). `TAG_CLASS` (lines 27-32) gains
`off: "border-warning/50 text-warning"`. ApiKeysTab owns fetch state with the `alive` ref + keep-last-known-list
pattern (lines 74-83) and reads `list.mcp` for availability; `handleCreate` (116-133) already renders server
sentences through `C.draft.createFailed`.

---

### `frontend/src/components/org/OrgMcpSwitchCard.tsx` (new)

**Analog:** `admin/CapabilityGrid.tsx:130-264`. Copy `CapabilityCard`'s busy/failed state and never-optimistic
toggle (lines 143-167), the armed-OFF classes (175-177, 184-188, 213-217) and **re-declare** `CapabilitySwitch`
(lines 230-264) locally (UI-SPEC: do not export from the FIRING grid):
```tsx
<button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={onToggle}
  className={cn("relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-primary/70" : "bg-destructive/70")}>
```
Owns its own read like `OrgApiKeysTab.tsx:40-62` (`alive` ref, `load` callback, effect cleanup), calls
`onRecorded?.()` after a successful write (OrgApiKeysTab line 128).

### `frontend/src/components/org/OrgSettingsTab.tsx` (**NO ROW**: add row + section, D-44)

**Analog:** itself (63 lines, "PURE PRESENTATIONAL LEAF", line 17). Mount `<OrgMcpSwitchCard>` under the identity
block (after line 51), same well classes `rounded-md border border-border bg-background px-4 py-3` (line 44).
Props gain `onRecorded?: () => void`.

### `frontend/src/components/org/OrgAdminShell.tsx` (FIRES 10/6/416: one prop + key)

**Analog:** line 396 `<RetentionTab key={activeOrgId ?? "none"} onRecorded={pulse} />`. Line 392
`<OrgSettingsTab orgName={orgName} />` gains the same two attributes. ⚠ Research said OrgAdminShell gets **no
edit**; UI-SPEC budgets this one. See §Conflicts.

### `frontend/src/components/org/OrgApiKeysTab.tsx` (young)

**Analog:** itself. The note line (line 76) is where `<McpOffNotice scope="org" variant="admin">` mounts; the
limits line (77-81) should render only when a workflow key exists (UI-SPEC §1a).

### `frontend/src/components/org/OrgAuditTab.tsx` (FIRES 5/4/416: one map entry)

**Analog:** lines 76-93, the `INVITE_EVENT_LABEL` `metadata.event` discriminator that wins over the generic
`settings.update` label:
```ts
const INVITE_EVENT_LABEL: Record<string, string> = {
  "invitation.send": "Invitation sent",
  ...
}
function rowLabel(row: OrgAuditRow): string {
  const meta = row.metadata
  const event = meta && typeof meta === "object" ? (meta as Record<string, unknown>).event : undefined
  if (typeof event === "string" && event in INVITE_EVENT_LABEL) return INVITE_EVENT_LABEL[event]
  return actionLabel(row.action_type)
}
```
Add `"mcp_access": …` (the label needs `enabled` for on/off wording; either a second small lookup or a label
that reads both ways). Test analog: `OrgAuditTab.test.tsx:88-124`. `AuditTab.tsx` (operator ledger) is not
required by D-36; the operator flag row already renders through the flag path.

### `frontend/src/components/admin/CapabilityGrid.tsx` (FIRES 3/3/264: union member + one entry)

**Analog:** lines 32-36 (`CapabilityKey` union) and 95-102 (`workflows_enabled` entry). Append last:
```ts
  {
    key: "mcp_enabled",
    label: "AI tool access (MCP)",
    sub: "Members can connect AI tools with personal keys.",
    fallbackImpact: "Every AI tool key is refused on its next call, in every organisation. Keys are kept.",
  },
```
No `countImpact` (lines 42-47: "a fabricated number is never shown"). Update the "four capability flags" comment (line 30).

### `frontend/src/components/admin/ControlRoomPage.tsx` (**NO ROW**: add row + section, D-44)

**Analog:** lines 670-675:
```ts
  const capabilityFlags: Record<CapabilityKey, boolean> = {
    web_search_enabled: settings?.web_search_enabled ?? true,
    ...
    workflows_enabled: settings?.workflows_enabled ?? true,
  }
```
One line `mcp_enabled: settings?.mcp_enabled ?? true,`. `impactCounts` (681-684) untouched. The toggle handler at
line 483 already routes any `CapabilityKey` to `setFlag`.

---

### Tests

**`test_304_resolver_kind.py` / `test_304_principal_liveness.py`** — copy `test_293_key_auth.py:85-163`: the
`world` fixture monkeypatching `auth.api_keys_db.get_key_for_auth / is_org_member / touch_last_used`,
`deps._is_banned`, `auth.write_audit_entry`, `auth.get_service_role_supabase`, and the `client` fixture that mounts
the dependency on a FRESH `FastAPI()` with `get_pg_pool` / `get_redis` overridden and `FakeRedis` from
`tests.unit.phase293_inbound_fakes`. ⛔ Never enter `app.main.app`'s lifespan (SEED-363, docblock line 4-5).
Add a monkeypatch for the new `api_keys_db.mcp_switches`.

**Static fence** — copy `test_293_key_auth.py:310-315` (read the module source, strip comment lines, assert
tokens absent): `acting_member_reads.py` must not contain `org_members`, `get_service_role_supabase` (outside the
two sanctioned calls), `.table(`, `fetch_visible_folders`.

**`test_304_acting_org_rls_live.py`** — `from tests.integration._rls_harness import requires_pg`
(`pytestmark = requires_pg`), `open_user_conn(pool, uid)` (line 79); privilege arms copy
`test_181_secdef_privileges.py:61-70`:
```python
cur.execute(f"SELECT has_function_privilege('anon', 'public.{fn_sig}', 'EXECUTE')")
```

**`test_304_two_org_parity_live.py` / `test_304_narrowed_key_live.py`** — copy `test_298_two_org_lists_live.py`:
imports (lines 33-57), `_request(org)` with `X-Org-Id` (lines 65-67), `_seed` with explicit `org_id` on every
INSERT (70-107), `_cleanup` in `finally` (110-133), and the `subject` fixture (136-150): `require_gotrue()`,
`create_org`, `GoTrueUsers.create_signed_in_user`, a second `org_members` INSERT with role `'member'`, and the
non-vacuity assert `memberships(pg_pool, uid) == {org_x, org_y}`. U must be `member`, never owner (D-31).
Chunk seeding with a 1536-d vector: `tests/integration/test_272_rpc_document_scope.py`. Skip ≠ pass
(docblock line 28-29). These two suites mutate the local DB: serialize (worktree rule 4).

**Contract** — extend `backend/tests/fixtures/phase293/api_keys_contract.json` and the `KEY` sample in
`frontend/src/components/settings/apiKeys/__tests__/apiKeysContract.test.ts:34-71` in the same commit (the test
docblock: "fix the type, never the fixture" applies to frontend-only drift).

---

## Shared Patterns

### RLS-enforced connection (every narrowed read)
**Source:** `backend/app/dependencies.py:158-177` + `retrieval_scope.py:266`
**Apply to:** `acting_member.py`, `acting_member_reads.py`, the parity tests
```python
async with get_user_pg_connection(None, {"id": user_id}) as conn:
    rows = await conn.fetch(SQL, ...)
```
Wrapped by `acting_as(principal)` so the GUC is set inside `_apply_rls_user_context`. Values bound as `$N`, never interpolated.

### Service-role pool + owner predicate in every statement
**Source:** `backend/app/db/api_keys.py` docblock lines 6-25
**Apply to:** every new function in `db/api_keys.py` (switch read/write, folder validation)

### One byte-identical refusal, throttled audit
**Source:** `api_key_auth.py:113-114` `_invalid()`, `:267-276` `_refuse`, `:240-264` `refusal_audit_slot`
**Apply to:** the extracted core and every new refusal reason. The switched-off org/deployment sentences are
the ONLY non-identical refusals (D-19).

### Audit without a new literal
**Source:** `api/org.py:91-98` (`_INVITE_AUDIT_ACTION = "settings.update"` + `metadata.event`) and `:830-841`
**Apply to:** the org switch write. Key create/revoke reuse `audit_key_call(... "api_key.create"/"api_key.revoke", call="manage")` (`api/api_keys.py:344-349`, `:370-375`, `:413-419`).

### REVOKE from PUBLIC first, then grant back
**Source:** `215_api_keys_and_run_origin.sql:85-93`, `:165-170`; supplement `:691-704`
**Apply to:** every grant in 220/221 and their supplement mirror.

### Plain-sentence 422s
**Source:** `api/api_keys.py:285-318`; `models/api_key.py:80-93` (`ValueError("<sentence>")`)
**Apply to:** D-07/D-08 refusals, unknown tool, unknown/foreign folder. One sentence for unknown and not-yours.

### Frontend: one copy leaf, pure facts, owner-state components
**Source:** `apiKeysCopy.ts:1-32`, `apiKeyFacts.ts:1-11`, `ApiKeysTab.tsx:72-83`
**Apply to:** every new leaf. Components spell no strings; facts modules import no React; the `alive` ref guards every setState.

### Kill-switch (capability) UI
**Source:** `CapabilityGrid.tsx:143-264`
**Apply to:** `OrgMcpSwitchCard.tsx` (re-declared, not imported) and the grid entry.

---

## Hot-file ledger status (scan list, `docs/HOT-FILE-LEDGER.md` §"Scan list", line 11512+)

The gate (`scripts/check-hot-file-ledger.cjs`) WATCHES `backend/app/**` and `frontend/src/**` and EXEMPTS tests,
`scripts/`, `supabase/migrations/`, `docs/`, `.sql/.json/.md` (lines 51-67). **New watched files need a row too.**

| File | Row? | Triple / G-5 (as recorded) |
|---|---|---|
| `backend/app/security/api_key_auth.py` | ✅ | 3 / 1 / 328 · young |
| `backend/app/db/api_keys.py` | ✅ | 5 / 2 / 307 · young |
| `backend/app/api/api_keys.py` | ✅ | 3 / 2 / 421 · young |
| `backend/app/models/api_key.py` | ✅ | 2 / 2 / 117 · young |
| `backend/app/dependencies.py` | ✅ | 24 / 12 / 1147 · **FIRES** |
| `backend/app/api/admin.py` | ✅ | 44 / 17 / 2054 · **FIRES** |
| `backend/app/api/settings.py` | ✅ | 48 / 26 / 1398 · **FIRES** |
| `backend/app/models/user_settings.py` | ✅ | 62 / 38 / 1788 · **FIRES** |
| `backend/app/main.py` (only if `_DIRECT_COLUMNS` is touched; not required) | ✅ | 99 / 73 / 1021 · **FIRES** |
| `frontend/src/lib/api/apiKeys.ts` | ✅ | 2 / 2 / 174 · young |
| `frontend/src/lib/api/admin.ts` | ✅ | 10 / 5 / 1125 · **FIRES** |
| `frontend/src/lib/api/skills.ts` | ✅ | 10 / 7 / 779 · **FIRES** |
| `apiKeys/ApiKeysTab.tsx` · `ApiKeyDraftCard.tsx` · `ApiKeyCard.tsx` · `ApiKeySecretOnce.tsx` · `RevokeApiKeySheet.tsx` · `ApiKeyActivity.tsx` | ✅ | 1 / 1 / 248 · 248 · 182 · 176 · 164 · 98 · young |
| `apiKeys/apiKeysCopy.ts` | ✅ | 5 / 3 / 283 · **FIRES** |
| `apiKeys/apiKeyFacts.ts` | ✅ | 4 / 3 / 310 · **FIRES** |
| `apiKeys/curlExamples.ts` (only if touched) | ✅ | 3 / 2 / 77 · no (2 phases) |
| `frontend/src/components/org/OrgApiKeysTab.tsx` | ✅ | 1 / 1 / 134 · young |
| `frontend/src/components/org/OrgAdminShell.tsx` | ✅ | 10 / 6 / 416 · **FIRES** |
| `frontend/src/components/org/OrgAuditTab.tsx` | ✅ | 5 / 4 / 416 · **FIRES** |
| `frontend/src/components/admin/AuditTab.tsx` (only if touched) | ✅ | 8 / 5 / 771 · **FIRES** |
| `frontend/src/components/admin/CapabilityGrid.tsx` | ✅ | 3 / 3 / 264 · **FIRES** |
| `frontend/src/components/org/OrgSettingsTab.tsx` | ❌ **NO ROW** | add row + section in the plan that first names it (D-44) |
| `frontend/src/components/admin/ControlRoomPage.tsx` | ❌ **NO ROW** | add row + section in the plan that first names it (D-44) |
| `frontend/src/pages/SettingsPage.tsx` | ✅ | 64 / 31 / 1704 · **FIRES** · NOT to be edited (D-01) |
| Reused, not edited: `retrieval_scope.py` (FIRES), `retrieval_service.py` (FIRES), `retrieval_rpc.py` (young), `db/workflows.py` (FIRES), `document_relationship_service.py` (FIRES), `utils/folder_utils.py` (FIRES), `api/org.py` (FIRES), `audit_service.py` (FIRES) | ✅ | must stay out of `files_modified` |
| **New, need young rows:** `security/acting_org.py`, `security/acting_member.py`, `security/mcp_principal.py`, `services/key_scope.py`, `services/mcp_tool_catalogue.py`, `services/acting_member_reads.py`, `apiKeys/ApiKeyKindChoice.tsx`, `McpKeyFields.tsx`, `KeyFoldersField.tsx`, `McpConnectSnippets.tsx`, `mcpSnippets.ts`, `mcpKeyFacts.ts`, `McpOffNotice.tsx`, `org/OrgMcpSwitchCard.tsx` | ❌ | add rows in the creating plan (same commit as the section) |
| `scripts/full-schema-supplement.sql`, `scripts/vitest-count-gate.cjs` | exempt (`scripts/`) | have rows anyway (FIRES 27/19/891, 406/85/6910); update by convention |

Triples above are as recorded in the ledger, not re-derived; re-derive with the CLAUDE.md recipe in the plan that edits each file.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/explain-acting-org.py` | utility | EXPLAIN evidence (rolled back) | no committed EXPLAIN-evidence script exists; research ran `explain304.py`/`explain304b.py` from scratch. Use the 215 live-check skeleton for connection/exit codes and research R-01 for the five variants (A-E) and the "plan unchanged + loops=1" assertion (never grep "InitPlan") |
| relationship read inside `acting_member_reads.py` | service | read on acting conn | the only existing relationship read is supabase-py + service role (the forbidden pattern). Partial analog: import `_NO_ACCESS_MASK` / `_INVERSE_LABEL`; SQL from research R-06 table |

---

## Conflicts to resolve (research vs UI-SPEC)

1. **Copy home.** RESEARCH §Frontend reuse map: new `mcpKeyCopy.ts` to keep MCP words out of FIRING
   `apiKeysCopy.ts`. UI-SPEC (approved, later): one additive `mcp` + `kind` block in `apiKeysCopy.ts`, "every string
   in every new leaf comes from `apiKeysCopy.ts`". Either is honest; the UI-SPEC version costs one FIRING-file edit
   that the UI-SPEC budgets.
2. **Component names.** RESEARCH: `McpKeyDraftCard.tsx`, `McpSnippets.tsx`. UI-SPEC: `ApiKeyKindChoice.tsx`,
   `McpKeyFields.tsx`, `KeyFoldersField.tsx`, `McpConnectSnippets.tsx`, `mcpKeyFacts.ts`, `McpOffNotice.tsx`,
   `OrgMcpSwitchCard.tsx`. UI-SPEC is the UI contract; this map uses its names.
3. **`OrgAdminShell.tsx`.** RESEARCH: no edit. UI-SPEC: `onRecorded={pulse}` + `key` on the existing
   `OrgSettingsTab` mount (needed for the G-4 row 3 band pulse). The RetentionTab line 396 precedent supports UI-SPEC.
4. **Org-switch audit literal.** UI-SPEC §Audit vocabulary still says "name fixed by research, e.g. `org.mcp_switch`".
   D-36 fixed it: `settings.update` + `metadata.event = "mcp_access"`, so the frontend change is an
   `OrgAuditTab` event-label entry, not an `ACTION_META` literal, and `AuditTab.tsx` needs nothing.
5. **`principal_still_allowed` home.** CONTEXT D-18 says "exported for 306/307/308"; RESEARCH puts the core
   beside the resolver in `api_key_auth.py` (monkeypatch reasons). The function can live there and be re-exported
   from `acting_member.py`, or live in `acting_member.py` calling `api_keys_db.*` / `deps._is_banned` by module
   attribute. Either keeps the 293 patches working if the attribute lookups stay module-qualified.

## Metadata

**Analog search scope:** `backend/app/{security,db,api,models,services,utils}`, `backend/tests/{unit,integration,fixtures}`, `supabase/migrations`, `scripts`, `frontend/src/components/{settings/apiKeys,org,admin,retention,chat}`, `frontend/src/lib/api`, `docs/HOT-FILE-LEDGER.md` scan list
**Files scanned:** ~45 read, plus ledger and grep sweeps
**Pattern extraction date:** 2026-10-30
