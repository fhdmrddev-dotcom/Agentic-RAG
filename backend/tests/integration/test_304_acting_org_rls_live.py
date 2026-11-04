"""Phase 304-01 — the acting-org GUC, proven on REAL Postgres: it narrows, it never widens, and
unset is today (D-13, D-14, D-16, D-33, D-39, D-42).

THE SUBJECT (Pitfall 10 — never an owner, never an org-only fixture). U is role ``member`` in org X
and ``org-admin`` in org Y. Co-member V (X) and W (Y) each own an ORG-SHARED folder, so the shared
arms are exercised by content U does not own. Org Z exists and U is not in it.

Seeded for U in EACH of X and Y, every INSERT with an explicit ``org_id``: a folder, two documents
(one in the folder), a chunk, a saved view, a relationship between the two documents, a published
non-system workflow definition, a thread and a run on it, a workflow API key, an org expert bundle
and a grant on it (R-05b: the routed expert policies need an org-scoped row per org).

WHAT IS DRIVEN (nothing mocked — the real ``get_user_pg_connection`` / ``acting_member_connection``
on the real pool, RLS as ``authenticated``):

  · NON-VACUITY first: unset, ``current_user_org_ids()`` = {X, Y} and every seeded table shows BOTH
    orgs' rows.
  · acting X: the function = {X}; every Y row is gone from every table; system-global rows stay.
  · acting Z (not a member): the function = {} and every org-scoped table returns 0 rows.
  · ``current_user_has_permission(Y, 'org:manage')`` is true unset, false acting X (D-39).
  · ``list_acting_folders`` acting X = U's X folder + V's shared X folder, owner masked.
  · no leak: the GUC is gone on the next transaction of the SAME physical connection, and on the
    next plain app connection.
  · a malformed GUC makes a policy-guarded SELECT raise (fails closed).
  · privileges (D-33, D-42) and the 220 CHECKs.
  · ⚠ COUNTERFACTUAL (how each routed arm was driven RED): inside ONE rolled-back transaction the
    PRE-221 function body and the six PRE-221 policies are restored, and the same "acting X hides
    Y" assertions are shown to FAIL — so none of the narrowing arms above can pass vacuously.

Everything seeded is deleted in ``finally``. Skip-guarded on :54322 and :54321 — run with ``-rs``;
a skip is NOT RUN, never a pass (D-31).
"""
from __future__ import annotations

from uuid import UUID, uuid4

import asyncpg
import pytest

from app.dependencies import _apply_rls_user_context, get_user_pg_connection
from app.security.acting_member import acting_member_connection, acting_org_scope
from app.services.acting_member_reads import list_acting_folders
from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    create_org,
    drop_org,
    memberships,
    require_gotrue,
)
from tests.integration._rls_harness import assert_auth_uid, requires_pg

pytestmark = requires_pg

# Every org-scoped table the MCP reads touch (R-01 list + the two expert tables, R-05b).
TABLES = (
    "folders",
    "documents",
    "document_chunks",
    "document_views",
    "document_relationships",
    "workflow_definitions",
    "workflow_runs",
    "api_keys",
    "expert_bundles",
    "expert_grants",
)


async def _seed(pool, *, uid: str, org: str, tag: str) -> dict:
    u, o = UUID(uid), UUID(org)
    s: dict = {}
    s["folders"] = await pool.fetchval(
        "INSERT INTO public.folders (user_id, org_id, name) VALUES ($1, $2, $3) RETURNING id",
        u, o, f"304-{tag}-folder-{uuid4().hex[:6]}",
    )
    d1 = await pool.fetchval(
        "INSERT INTO public.documents (user_id, org_id, folder_id, filename, file_path, file_size,"
        " mime_type, status) VALUES ($1, $2, $3, $4, $5, 1, 'text/plain', 'completed') RETURNING id",
        u, o, s["folders"], f"304-{tag}-in-folder.txt", f"{uid}/304-{tag}-{uuid4().hex[:8]}.txt",
    )
    d2 = await pool.fetchval(
        "INSERT INTO public.documents (user_id, org_id, folder_id, filename, file_path, file_size,"
        " mime_type, status) VALUES ($1, $2, NULL, $3, $4, 1, 'text/plain', 'completed') RETURNING id",
        u, o, f"304-{tag}-root.txt", f"{uid}/304-{tag}-{uuid4().hex[:8]}.txt",
    )
    s["documents"] = (d1, d2)
    s["document_chunks"] = await pool.fetchval(
        "INSERT INTO public.document_chunks (document_id, user_id, org_id, content, chunk_index)"
        " VALUES ($1, $2, $3, $4, 0) RETURNING id",
        d1, u, o, f"304 {tag} chunk",
    )
    s["document_views"] = await pool.fetchval(
        "INSERT INTO public.document_views (user_id, org_id, name) VALUES ($1, $2, $3) RETURNING id",
        u, o, f"304 {tag} view {uuid4().hex[:6]}",
    )
    s["document_relationships"] = await pool.fetchval(
        "INSERT INTO public.document_relationships (user_id, org_id, source_doc_id, target_doc_id, rel_type)"
        " VALUES ($1, $2, $3, $4, 'references') RETURNING id",
        u, o, d1, d2,
    )
    s["workflow_definitions"] = await pool.fetchval(
        "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
        " VALUES ($1, $2, $3, $4, 'published') RETURNING id",
        f"p304-{tag}-{uuid4().hex[:8]}", f"304 {tag} published", u, o,
    )
    thread = await pool.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, $3) RETURNING id",
        u, o, f"304 {tag} thread",
    )
    s["threads"] = thread
    s["workflow_runs"] = await pool.fetchval(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, org_id, user_id)"
        " VALUES ($1, $2, $3, $4) RETURNING id",
        thread, s["workflow_definitions"], o, u,
    )
    s["api_keys"] = await pool.fetchval(
        "INSERT INTO public.api_keys (org_id, user_id, label, key_prefix, key_hash, workflows)"
        " VALUES ($1, $2, $3, 'srl_live_abcd', $4, $5) RETURNING id",
        o, u, f"304 {tag} key", uuid4().hex + uuid4().hex,
        [{"id": str(s["workflow_definitions"]), "name": f"304 {tag} published"}],
    )
    s["expert_bundles"] = await pool.fetchval(
        "INSERT INTO public.expert_bundles (created_by, org_id, name, slug, visibility, is_system)"
        " VALUES ($1, $2, $3, $4, 'org', false) RETURNING id",
        u, o, f"304 {tag} expert", f"p304-{tag}-{uuid4().hex[:8]}",
    )
    s["expert_grants"] = await pool.fetchval(
        "INSERT INTO public.expert_grants (expert_id, grantee_type, grantee_id)"
        " VALUES ($1, 'user', $2) RETURNING id",
        s["expert_bundles"], uid,
    )
    return s


async def _cleanup(pool, uids: list[str]) -> None:
    for uid in uids:
        if not uid:
            continue
        u = UUID(uid)
        for sql in (
            "DELETE FROM public.expert_grants WHERE expert_id IN"
            " (SELECT id FROM public.expert_bundles WHERE created_by = $1)",
            "DELETE FROM public.expert_bundles WHERE created_by = $1",
            "DELETE FROM public.api_keys WHERE user_id = $1",
            "DELETE FROM public.workflow_runs WHERE user_id = $1",
            "DELETE FROM public.threads WHERE user_id = $1",
            "DELETE FROM public.workflow_definitions WHERE created_by = $1",
            "DELETE FROM public.document_relationships WHERE user_id = $1",
            "DELETE FROM public.document_views WHERE user_id = $1",
            "DELETE FROM public.document_chunks WHERE user_id = $1",
            "DELETE FROM public.documents WHERE user_id = $1",
            "DELETE FROM public.folders WHERE user_id = $1",
            "DELETE FROM public.audit_log WHERE user_id = $1",
        ):
            try:
                await pool.execute(sql, u)
            except Exception:
                pass


@pytest.fixture
async def world(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org_x = org_y = org_z = None
    uids: list[str] = []
    try:
        org_x = await create_org(pg_pool, "304-x")
        org_y = await create_org(pg_pool, "304-y")
        org_z = await create_org(pg_pool, "304-z")
        uid, _tok = await users.create_signed_in_user(org_x, role="member", label="p304u")
        uids.append(uid)
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'org-admin')",
            UUID(org_y), UUID(uid),
        )
        assert await memberships(pg_pool, uid) == {org_x, org_y}, "U is not in exactly X and Y"
        roles = {str(r["org_id"]): r["role"] for r in await pg_pool.fetch(
            "SELECT org_id, role FROM public.org_members WHERE user_id = $1", UUID(uid))}
        assert roles == {org_x: "member", org_y: "org-admin"}, roles  # never an owner (Pitfall 10)

        v_uid, _ = await users.create_signed_in_user(org_x, label="p304v")
        w_uid, _ = await users.create_signed_in_user(org_y, label="p304w")
        z_uid, _ = await users.create_signed_in_user(org_z, label="p304z")
        uids += [v_uid, w_uid, z_uid]
        shared_x = await pg_pool.fetchval(
            "INSERT INTO public.folders (user_id, org_id, name, is_org_shared) VALUES ($1, $2, $3, true)"
            " RETURNING id", UUID(v_uid), UUID(org_x), f"304-shared-x-{uuid4().hex[:6]}",
        )
        shared_y = await pg_pool.fetchval(
            "INSERT INTO public.folders (user_id, org_id, name, is_org_shared) VALUES ($1, $2, $3, true)"
            " RETURNING id", UUID(w_uid), UUID(org_y), f"304-shared-y-{uuid4().hex[:6]}",
        )
        yield {
            "uid": uid, "v": v_uid, "w": w_uid,
            "x": org_x, "y": org_y, "z": org_z,
            "shared_x": str(shared_x), "shared_y": str(shared_y),
            "seed_x": await _seed(pg_pool, uid=uid, org=org_x, tag="x"),
            "seed_y": await _seed(pg_pool, uid=uid, org=org_y, tag="y"),
        }
    finally:
        await _cleanup(pg_pool, uids)
        await users.drop_all()
        for org in (org_x, org_y, org_z):
            await drop_org(pg_pool, org)


# ── helpers ────────────────────────────────────────────────────────────────────


def _ids(seed: dict, table: str) -> set[str]:
    v = seed[table]
    vals = v if isinstance(v, tuple) else (v,)
    return {str(x) for x in vals}


def _all_ids(w: dict, table: str) -> list[UUID]:
    return [UUID(i) for i in _ids(w["seed_x"], table) | _ids(w["seed_y"], table)]


async def _visible(conn, w: dict) -> dict[str, set[str]]:
    """For every table, which of the SEEDED ids this connection can see (one SELECT each)."""
    out: dict[str, set[str]] = {}
    for table in TABLES:
        rows = await conn.fetch(f"SELECT id FROM public.{table} WHERE id = ANY($1::uuid[])", _all_ids(w, table))
        out[table] = {str(r["id"]) for r in rows}
    return out


def _expected(w: dict, *orgs: str) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {t: set() for t in TABLES}
    for org in orgs:
        seed = w["seed_x"] if org == w["x"] else w["seed_y"]
        for t in TABLES:
            out[t] |= _ids(seed, t)
    return out


async def _org_ids(conn) -> set[str]:
    return {str(r[0]) for r in await conn.fetch("SELECT public.current_user_org_ids()")}


async def _system_counts(conn) -> tuple[int, int]:
    wd = await conn.fetchval("SELECT count(*) FROM public.workflow_definitions WHERE is_system_global")
    eb = await conn.fetchval("SELECT count(*) FROM public.expert_bundles WHERE is_system")
    return wd, eb


# ── non-vacuity + unset == today ───────────────────────────────────────────────


async def test_unset_sees_both_orgs(world):
    w = world
    async with get_user_pg_connection(None, {"id": w["uid"]}) as conn:
        await assert_auth_uid(conn, w["uid"])
        assert await conn.fetchval("SELECT current_setting('app.acting_org_id', true)") in (None, "")
        assert await _org_ids(conn) == {w["x"], w["y"]}
        assert await _visible(conn, w) == _expected(w, w["x"], w["y"])


async def test_acting_in_x_hides_every_y_row_and_keeps_system_rows(world):
    w = world
    async with get_user_pg_connection(None, {"id": w["uid"]}) as conn:
        system_unset = await _system_counts(conn)
    async with acting_member_connection(user_id=w["uid"], org_id=w["x"]) as conn:
        await assert_auth_uid(conn, w["uid"])
        assert await conn.fetchval("SELECT current_setting('app.acting_org_id', true)") == w["x"]
        assert await _org_ids(conn) == {w["x"]}
        assert await _visible(conn, w) == _expected(w, w["x"])
        system_acting = await _system_counts(conn)
    assert system_acting == system_unset
    assert system_unset[0] > 0, "non-vacuity: the local DB must carry system-global workflows"


async def test_acting_in_y_is_the_mirror(world):
    w = world
    async with acting_member_connection(user_id=w["uid"], org_id=w["y"]) as conn:
        assert await _org_ids(conn) == {w["y"]}
        assert await _visible(conn, w) == _expected(w, w["y"])


async def test_acting_in_a_non_member_org_sees_nothing(world):
    w = world
    async with acting_member_connection(user_id=w["uid"], org_id=w["z"]) as conn:
        await assert_auth_uid(conn, w["uid"])
        assert await _org_ids(conn) == set()
        assert await _visible(conn, w) == {t: set() for t in TABLES}
        # Not only the seeded ids: every org-scoped table is empty for U acting in Z.
        for table in ("folders", "documents", "document_chunks", "workflow_runs", "api_keys", "threads"):
            assert await conn.fetchval(f"SELECT count(*) FROM public.{table}") == 0, table
        assert await conn.fetchval(
            "SELECT count(*) FROM public.workflow_definitions WHERE NOT is_system_global") == 0
        assert await conn.fetchval("SELECT count(*) FROM public.expert_bundles WHERE NOT is_system") == 0


async def test_current_user_has_permission_narrows(world):
    w = world
    sql = "SELECT public.current_user_has_permission($1, 'org:manage')"
    async with get_user_pg_connection(None, {"id": w["uid"]}) as conn:
        assert await conn.fetchval(sql, UUID(w["y"])) is True
        assert await conn.fetchval(sql, UUID(w["x"])) is False  # a member, not an admin, in X
    async with acting_member_connection(user_id=w["uid"], org_id=w["y"]) as conn:
        assert await conn.fetchval(sql, UUID(w["y"])) is True
    async with acting_member_connection(user_id=w["uid"], org_id=w["x"]) as conn:
        assert await conn.fetchval(sql, UUID(w["y"])) is False


async def test_list_acting_folders_returns_only_the_acting_org(world):
    w = world
    fx, fy = str(w["seed_x"]["folders"]), str(w["seed_y"]["folders"])
    async with acting_member_connection(user_id=w["uid"], org_id=w["x"]) as conn:
        rows = await list_acting_folders(conn)
    by_id = {r["id"]: r for r in rows}
    assert set(by_id) == {fx, w["shared_x"]}
    assert by_id[fx]["user_id"] == w["uid"]
    assert by_id[w["shared_x"]]["user_id"] is None  # a co-member's shared folder: owner masked
    assert {r["org_id"] for r in rows} == {w["x"]}
    async with get_user_pg_connection(None, {"id": w["uid"]}) as conn:
        unset = {r["id"] for r in await list_acting_folders(conn)}
    assert unset == {fx, fy, w["shared_x"], w["shared_y"]}


# ── no leak + fail closed ──────────────────────────────────────────────────────


async def test_the_guc_never_survives_the_transaction(world, pg_pool):
    w = world
    async with pg_pool.acquire() as conn:  # ONE physical connection, two transactions
        async with conn.transaction():
            with acting_org_scope(w["x"]):
                await _apply_rls_user_context(conn, w["uid"])
            assert await _org_ids(conn) == {w["x"]}
        async with conn.transaction():
            await _apply_rls_user_context(conn, w["uid"])
            assert await conn.fetchval("SELECT current_setting('app.acting_org_id', true)") in (None, "")
            assert await _org_ids(conn) == {w["x"], w["y"]}
    async with acting_member_connection(user_id=w["uid"], org_id=w["x"]):
        pass
    async with get_user_pg_connection(None, {"id": w["uid"]}) as conn:
        assert await conn.fetchval("SELECT current_setting('app.acting_org_id', true)") in (None, "")
        assert await _org_ids(conn) == {w["x"], w["y"]}


async def test_a_malformed_guc_fails_closed(world, pg_pool):
    w = world
    async with pg_pool.acquire() as conn:
        with pytest.raises(asyncpg.exceptions.InvalidTextRepresentationError):
            async with conn.transaction():
                await _apply_rls_user_context(conn, w["uid"])
                await conn.execute("SELECT set_config('app.acting_org_id', 'not-a-uuid', true)")
                await conn.fetch(
                    "SELECT id FROM public.folders WHERE id = ANY($1::uuid[])", _all_ids(w, "folders"))


# ── privileges (D-33, D-42) ────────────────────────────────────────────────────

API_KEY_COLUMNS = (
    "id", "org_id", "user_id", "label", "key_prefix", "key_hash", "workflows", "expires_at",
    "revoked_at", "revoked_by", "last_used_at", "created_at", "kind", "folder_ids", "tools",
    "include_external",
)


async def test_privileges(pg_pool):
    f = pg_pool.fetchval
    for col in API_KEY_COLUMNS:
        assert await f("SELECT has_column_privilege('anon', 'public.api_keys', $1, 'SELECT')", col) is False, col
    assert await f("SELECT has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'SELECT')") is False
    for col in ("kind", "folder_ids", "tools", "include_external"):
        assert await f("SELECT has_column_privilege('authenticated', 'public.api_keys', $1, 'SELECT')", col), col
    assert await f("SELECT has_column_privilege('authenticated', 'public.organizations', 'mcp_enabled', 'UPDATE')") is False
    for role in ("anon", "authenticated"):
        assert await f("SELECT has_column_privilege($1, 'public.app_settings', 'mcp_enabled', 'UPDATE')", role) is False
        for priv in ("DELETE", "TRUNCATE", "TRIGGER", "REFERENCES"):
            assert await f("SELECT has_table_privilege($1, 'public.organizations', $2)", role, priv) is False, (role, priv)
    for fn in ("public.current_user_org_ids()", "public.current_user_has_permission(uuid, text)"):
        assert await f("SELECT has_function_privilege('anon', $1, 'EXECUTE')", fn) is False, fn
        assert await f("SELECT has_function_privilege('authenticated', $1, 'EXECUTE')", fn) is True, fn


async def test_anon_reads_no_key_and_no_switch(world, pg_pool):
    """As the anon ROLE, not just a catalog read: a SELECT of api_keys is refused outright."""
    async with pg_pool.acquire() as conn:
        with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
            async with conn.transaction():
                await conn.execute("SET LOCAL ROLE anon")
                await conn.fetch("SELECT id, kind FROM public.api_keys")
    # ⛔ NOT driven as the anon ROLE: on local Postgres 17.6, `SET LOCAL ROLE anon; SELECT
    # public.current_user_org_ids()` crashed a backend and put the whole cluster into recovery
    # (measured 2026-10-31, 304-01 — see 304-01-SUMMARY "Findings"). The EXECUTE arm is pinned by
    # catalog in test_privileges (has_function_privilege('anon', ..., 'EXECUTE') is false) instead.
    # authenticated (U) can never select the digest, even of its own key.
    async with get_user_pg_connection(None, {"id": world["uid"]}) as conn:
        with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
            async with conn.transaction():
                await conn.fetch("SELECT key_hash FROM public.api_keys")


# ── 220 CHECKs ─────────────────────────────────────────────────────────────────


async def _refused(conn, sql: str, *args) -> bool:
    try:
        async with conn.transaction():
            await conn.execute(sql, *args)
    except asyncpg.exceptions.CheckViolationError:
        return True
    return False


async def test_the_220_checks(world, pg_pool):
    w = world
    o, u = UUID(w["x"]), UUID(w["uid"])
    ins = ("INSERT INTO public.api_keys (org_id, user_id, label, key_prefix, key_hash, workflows, kind,"
           " folder_ids, tools, expires_at) VALUES ($1, $2, $3, 'srl_mcp_abcd', $4, $5, $6, $7, $8, $9)")
    later = "now() + interval '30 days'"
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            expires = await conn.fetchval(f"SELECT {later}")

            def h():
                return uuid4().hex + uuid4().hex

            assert await _refused(conn, ins, o, u, "f[]", h(), [], "mcp", [], ["search_knowledge_base"], expires)
            assert await _refused(conn, ins, o, u, "t[]", h(), [], "mcp", None, [], expires)
            assert await _refused(conn, ins, o, u, "nx", h(), [], "mcp", None, ["search_knowledge_base"], None)
            assert await _refused(conn, ins, o, u, "w[]", h(), [], "workflow", None, None, None)
            assert await _refused(conn, ins, o, u, "wf", h(), [{"id": "a", "name": "b"}], "workflow",
                                  [str(w["seed_x"]["folders"])], None, None)
            assert not await _refused(conn, ins, o, u, "ok", h(), [], "mcp", None, ["search_knowledge_base"], expires)
            assert not await _refused(conn, ins, o, u, "okf", h(), [], "mcp", [str(w["seed_x"]["folders"])],
                                      ["search_knowledge_base"], expires)
            assert not await _refused(
                conn,
                "INSERT INTO public.workflow_runs (thread_id, definition_id, org_id, user_id, origin_kind)"
                " VALUES ($1, $2, $3, $4, 'mcp')",
                w["seed_x"]["threads"], w["seed_x"]["workflow_definitions"], o, u,
            )
            assert await _refused(
                conn,
                "INSERT INTO public.workflow_runs (thread_id, definition_id, org_id, user_id, origin_kind)"
                " VALUES ($1, $2, $3, $4, 'webhook')",
                w["seed_x"]["threads"], w["seed_x"]["workflow_definitions"], o, u,
            )
        finally:
            await tx.rollback()


# ── the counterfactual: every routed arm FAILS under the pre-221 schema ────────

OLD_SCHEMA = (
    """CREATE OR REPLACE FUNCTION public.current_user_org_ids()
 RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid();
$function$""",
    """CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_org_id uuid, p_permission_key text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.org_members m JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.org_id = p_org_id AND m.user_id = auth.uid() AND rp.permission_key = p_permission_key);
$function$""",
    'DROP POLICY "expert_bundles_read_policy" ON public.expert_bundles',
    """CREATE POLICY "expert_bundles_read_policy" ON public.expert_bundles FOR SELECT TO authenticated, service_role
  USING (auth.role() = 'service_role' OR is_system = true OR (org_id IN (SELECT m.org_id FROM public.org_members m
    WHERE m.user_id = auth.uid()) AND (visibility IN ('org', 'public') OR created_by = auth.uid())))""",
    'DROP POLICY "expert_bundles_write_policy" ON public.expert_bundles',
    """CREATE POLICY "expert_bundles_write_policy" ON public.expert_bundles FOR ALL TO authenticated, service_role
  USING (auth.role() = 'service_role' OR (is_system = false AND org_id IN (SELECT m.org_id FROM public.org_members m
    WHERE m.user_id = auth.uid())))""",
    'DROP POLICY "expert_grants_read_policy" ON public.expert_grants',
    """CREATE POLICY "expert_grants_read_policy" ON public.expert_grants FOR SELECT TO authenticated, service_role
  USING (auth.role() = 'service_role' OR expert_id IN (SELECT eb.id FROM public.expert_bundles eb
    JOIN public.org_members m ON m.org_id = eb.org_id WHERE m.user_id = auth.uid()))""",
    'DROP POLICY "expert_grants_write_policy" ON public.expert_grants',
    """CREATE POLICY "expert_grants_write_policy" ON public.expert_grants FOR ALL TO authenticated, service_role
  USING (auth.role() = 'service_role' OR expert_id IN (SELECT eb.id FROM public.expert_bundles eb
    JOIN public.org_members m ON m.org_id = eb.org_id WHERE m.user_id = auth.uid()))""",
)


async def test_counterfactual_every_routed_arm_fails_under_the_old_schema(world, pg_pool):
    """Drive RED: restore the pre-221 function + policies in ONE rolled-back transaction and show the
    acting-X assertions above would FAIL. Then prove the live schema is untouched afterwards."""
    w = world
    before = await pg_pool.fetchval("SELECT pg_get_functiondef('public.current_user_org_ids()'::regprocedure)")
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            for stmt in OLD_SCHEMA:
                await conn.execute(stmt)
            with acting_org_scope(w["x"]):
                await _apply_rls_user_context(conn, w["uid"])
            assert await conn.fetchval("SELECT current_setting('app.acting_org_id', true)") == w["x"]
            # RED 1 — the function ignores the GUC: Y is still in the set.
            assert await _org_ids(conn) == {w["x"], w["y"]}
            seen = await _visible(conn, w)
            # RED 2 — every table that reads the function leaks Y while "acting in X".
            for table in TABLES:
                assert seen[table] == _expected(w, w["x"], w["y"])[table], table
            # RED 3 — the permission check still answers for Y.
            assert await conn.fetchval(
                "SELECT public.current_user_has_permission($1, 'org:manage')", UUID(w["y"])) is True
        finally:
            await tx.rollback()
    after = await pg_pool.fetchval("SELECT pg_get_functiondef('public.current_user_org_ids()'::regprocedure)")
    assert after == before and "app.acting_org_id" in after


async def test_counterfactual_routing_only_the_function_still_leaks_experts(world, pg_pool):
    """R-05b, driven: with the NEW function but the OLD expert policies, acting in X still shows Y's
    expert bundle and grant — the direct org_members read is what the route-through removes."""
    w = world
    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            for stmt in OLD_SCHEMA[2:]:  # policies only; keep the 221 function
                await conn.execute(stmt)
            with acting_org_scope(w["x"]):
                await _apply_rls_user_context(conn, w["uid"])
            assert await _org_ids(conn) == {w["x"]}  # the function DOES narrow...
            seen = await _visible(conn, w)
            # ...but both expert tables still leak Y (RED for the policy arms).
            assert seen["expert_bundles"] == _expected(w, w["x"], w["y"])["expert_bundles"]
            assert seen["expert_grants"] == _expected(w, w["x"], w["y"])["expert_grants"]
            assert seen["folders"] == _expected(w, w["x"])["folders"]
        finally:
            await tx.rollback()
