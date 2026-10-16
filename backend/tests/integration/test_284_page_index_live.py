"""Phase 284-06 (SEED-357 / D-22) — the Library's FIRST PAGE must not grow with the library.

Root page 1 (``GET /documents?folder_id=root``) and Find page 1 (``POST /document-search``) were
measured at 2.54x / 2.59x from 10k to 50k documents. 284-06 Task 1 located the time at the
STATEMENT level (``pg_stat_statements`` around real API calls): of a 445 ms Root request, the one
PostgREST statement was 408 ms; of a 466 ms Find request, 417 ms. Two causes, both linear in the
library:

  1. The page has no ordered path. The view's ``user_id = uid OR folder_id IN (shared)`` predicate
     forces a Bitmap Heap Scan over every visible row, then a top-N sort — and PostgREST's
     ``document_tables(count)`` / ``document_images(count)`` embeds are LEFT JOIN LATERALs
     evaluated for EVERY one of those rows before the sort (29,808 loops each at 50k).
  2. The documents SELECT policy calls ``auth.uid()`` bare, so it is evaluated PER ROW — and
     PostgREST sets only ``request.jwt.claims`` (the whole JWT payload), so every evaluation
     re-parses that JSON. The earlier 284 EXPLAINs used ``_apply_rls_user_context``, which ALSO sets
     ``request.jwt.claim.sub`` and so took the cheap branch of ``auth.uid()``'s COALESCE: they read
     25-37 ms for what PostgREST runs in ~400 ms.

So this suite runs the statements the way PostgREST does: ``SET LOCAL ROLE authenticated`` and
``request.jwt.claims`` = the decoded payload of a REAL GoTrue access token, and nothing else. It
pins three things for Root page 1 and Find page 1 at the seeded scale (≥ 10,000 latest documents):

  (a) PLAN SHAPE — EXPLAIN (ANALYZE, FORMAT JSON) of the PAGE statement (select list, embeds,
      order, LIMIT 25): no plan node produces more than ``4 × 25`` rows in total
      (Actual Rows × Actual Loops) — so neither the scan, the sort nor the embeds visit the
      library. Checked under a custom plan AND a forced generic plan (PostgREST prepares its
      statements, so after five executions Postgres may switch to the generic plan).
  (b) PAGE TIME — the page statement executes in under 20 ms (median of 3), independent of size.
  (c) STATEMENT TIME — the full PostgREST statement (page + the exact ``count(*)`` CTE) executes
      under ``30 ms + 2 µs × visible rows``. The exact count is linear BY DESIGN (FIX-11 keeps
      it exact); the bound is ~4x the post-fix cost (~0.45 µs/row measured) and ~1/4 of the
      pre-fix cost (~8 µs/row), so it fails on the regression and not on host noise.

Runs ONLY against the local stack; unreachable or unseeded (< 10,000) → SKIP with the reason.
Read-only: every statement runs inside a rolled-back transaction. ⛔ Run under the local-DB lock.
"""
from __future__ import annotations

import asyncio
import base64
import json
import statistics
import time

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from app.api.documents import LIST_SELECT
from app.services.document_search_service import FIND_SELECT
from tests.integration._271_gotrue_users import require_gotrue
from tests.integration._284_scale_account import SCALE_OWNER_EMAIL, sign_in, uid_for_email

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PAGE = 25
ROW_FACTOR = 4
PAGE_MS = 20.0
MIN_SEEDED = 10_000


def _pg_ok() -> bool:
    if asyncpg is None:
        return False

    async def _probe():
        c = await asyncio.wait_for(asyncpg.connect(DSN), timeout=2.0)
        await c.close()

    try:
        asyncio.run(_probe())
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pg_ok(), reason=f"local Postgres not reachable at {DSN}")


# ── the statements, in PostgREST 14's shape (captured from pg_stat_statements, 284-06 Task 1) ──

V = '"public"."library_documents"'


def _cols(select: str) -> list[str]:
    return [c for c in select.split(",") if "(" not in c]


def _embed(table: str, alias: str) -> str:
    # PostgREST renders `table(count)` as a LEFT JOIN LATERAL whose inner select is the
    # attribute-notation aggregate `"alias"."count"` (= count("alias")).
    return (f'LEFT JOIN LATERAL ( SELECT json_agg("{alias}_1")::jsonb AS "{alias}_1" FROM '
            f'(SELECT "{alias}"."count" FROM "public"."{table}" AS "{alias}" '
            f'WHERE "{alias}"."document_id" = {V}."id" LIMIT ALL OFFSET 0 ) AS "{alias}_1" ) '
            f'AS "{alias}_1" ON TRUE')


def _root_page() -> str:
    cols = ", ".join(f'{V}."{c}"' for c in _cols(LIST_SELECT))
    assert "document_tables(count)" in LIST_SELECT and "document_images(count)" in LIST_SELECT
    return (
        f'SELECT {cols}, COALESCE("t_1"."t_1", \'[]\') AS "document_tables", '
        f'COALESCE("i_1"."i_1", \'[]\') AS "document_images" FROM {V} '
        f'{_embed("document_tables", "t")} {_embed("document_images", "i")} '
        f'WHERE {V}."is_latest" = $1 AND {V}."folder_id" IS NULL AND {V}."archived_at" IS NULL '
        f'ORDER BY {V}."created_at" DESC, {V}."id" DESC LIMIT $2 OFFSET $3'
    )


def _root_where() -> str:
    return f'{V}."is_latest" = $4 AND {V}."folder_id" IS NULL AND {V}."archived_at" IS NULL'


def _find_page() -> str:
    cols = ", ".join(f'{V}."{c}"' for c in FIND_SELECT.split(","))
    return (
        f'SELECT {cols} FROM {V} WHERE {V}."is_latest" = $1 AND {V}."archived_at" IS NULL '
        f'ORDER BY {V}."created_at" DESC NULLS LAST, {V}."id" ASC LIMIT $2 OFFSET $3'
    )


def _find_where() -> str:
    return f'{V}."is_latest" = $4 AND {V}."archived_at" IS NULL'


def _full(page: str, where: str) -> str:
    """The whole statement PostgREST sends for a `count=exact` ranged read."""
    return (
        f"WITH pgrst_source AS ( {page} ) , pgrst_source_count AS (SELECT 1 FROM {V} WHERE {where}) "
        "SELECT (SELECT pg_catalog.count(*) FROM pgrst_source_count) AS total_result_set, "
        "pg_catalog.count(_postgrest_t) AS page_total, "
        "coalesce(json_agg(_postgrest_t), '[]') AS body FROM ( SELECT * FROM pgrst_source ) _postgrest_t"
    )


CASES = {
    "root": (_root_page, _root_where),
    "find": (_find_page, _find_where),
}


# ── fixtures ─────────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def conn():
    c = await asyncpg.connect(DSN)
    try:
        yield c
    finally:
        await c.close()


@pytest_asyncio.fixture
async def owner(conn):
    require_gotrue()
    uid = await uid_for_email(conn, SCALE_OWNER_EMAIL)
    if uid is None:
        pytest.skip("the scale account is not seeded (run scripts/seed-scale-284.py)")
    n = await conn.fetchval(
        "SELECT count(*) FROM public.documents WHERE user_id = $1::uuid AND is_latest", uid)
    if n < MIN_SEEDED:
        pytest.skip(f"the scale account holds {n} latest documents; this suite needs ≥ {MIN_SEEDED}")
    token = sign_in(SCALE_OWNER_EMAIL)
    seg = token.split(".")[1]
    claims = base64.urlsafe_b64decode(seg + "=" * (-len(seg) % 4)).decode()
    assert json.loads(claims)["sub"] == uid
    return {"uid": uid, "claims": claims, "latest": n}


async def _as_postgrest(conn, claims: str, *, generic: bool = False):
    """Inside an open transaction: the role and the ONE GUC PostgREST sets (no claim.sub)."""
    await conn.execute("SET LOCAL ROLE authenticated")
    await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", claims)
    await conn.execute(
        f"SET LOCAL plan_cache_mode = {'force_generic_plan' if generic else 'force_custom_plan'}")


async def _explain(conn, claims: str, sql: str, args: tuple, *, generic: bool) -> dict:
    tr = conn.transaction()
    await tr.start()
    try:
        await _as_postgrest(conn, claims, generic=generic)
        await conn.execute(f"PREPARE p284_06 AS {sql}")
        placeholders = ", ".join(repr(a) if not isinstance(a, bool) else str(a).lower() for a in args)
        raw = await conn.fetchval(f"EXPLAIN (ANALYZE, FORMAT JSON) EXECUTE p284_06({placeholders})")
        return (json.loads(raw) if isinstance(raw, str) else raw)[0]
    finally:
        await tr.rollback()


async def _time_ms(conn, claims: str, sql: str, args: tuple, runs: int = 3) -> float:
    out = []
    for _ in range(runs):
        tr = conn.transaction()
        await tr.start()
        try:
            await _as_postgrest(conn, claims)
            t = time.perf_counter()
            await conn.fetch(sql, *args)
            out.append((time.perf_counter() - t) * 1000.0)
        finally:
            await tr.rollback()
    return statistics.median(out)


def _nodes(plan: dict, path: str = ""):
    here = f"{path}/{plan['Node Type']}"
    if plan.get("Relation Name"):
        here += f"[{plan['Relation Name']}]"
    yield here, plan
    for child in plan.get("Plans", []) or []:
        yield from _nodes(child, here)


def _over(plan: dict, cap: int) -> list[str]:
    bad = []
    for path, node in _nodes(plan):
        produced = node.get("Actual Rows", 0) * node.get("Actual Loops", 1)
        if produced > cap:
            bad.append(f"{path}: {node.get('Actual Rows')} rows x {node.get('Actual Loops')} loops")
    return bad


# ── (a) plan shape: the page never visits the library ───────────────────────────────────────

@pytest.mark.parametrize("generic", [False, True], ids=["custom-plan", "generic-plan"])
@pytest.mark.parametrize("case", sorted(CASES))
async def test_first_page_plan_visits_only_the_page(conn, owner, case, generic):
    page, _ = CASES[case]
    out = await _explain(conn, owner["claims"], page(), (True, PAGE, 0), generic=generic)
    plan = out["Plan"]
    assert plan.get("Actual Rows") == PAGE, f"{case}: the page returned {plan.get('Actual Rows')} rows"
    bad = _over(plan, ROW_FACTOR * PAGE)
    assert not bad, (
        f"{case} page 1 ({'generic' if generic else 'custom'} plan) visits the library "
        f"({owner['latest']} latest documents): nodes producing > {ROW_FACTOR * PAGE} rows:\n  "
        + "\n  ".join(bad))


# ── (b) page time is independent of the library size ────────────────────────────────────────

@pytest.mark.parametrize("case", sorted(CASES))
async def test_first_page_statement_time_is_flat(conn, owner, case):
    page, _ = CASES[case]
    ms = await _time_ms(conn, owner["claims"], page(), (True, PAGE, 0))
    assert ms < PAGE_MS, (
        f"{case} page 1 took {ms:.1f} ms as authenticated (PostgREST claims) at "
        f"{owner['latest']} latest documents; the bound is {PAGE_MS} ms at any size")


# ── (c) the whole PostgREST statement: page + exact count ───────────────────────────────────

@pytest.mark.parametrize("case", sorted(CASES))
async def test_full_postgrest_statement_is_bounded_by_the_count_alone(conn, owner, case):
    page, where = CASES[case]
    sql = _full(page(), where())
    tr = conn.transaction()
    await tr.start()
    try:
        await _as_postgrest(conn, owner["claims"])
        row = await conn.fetchrow(sql, True, PAGE, 0, True)
    finally:
        await tr.rollback()
    visible = row["total_result_set"]
    assert row["page_total"] == PAGE
    bound = 30.0 + 0.002 * visible
    ms = await _time_ms(conn, owner["claims"], sql, (True, PAGE, 0, True))
    assert ms < bound, (
        f"{case}: the full PostgREST statement (page + exact count over {visible} rows) took "
        f"{ms:.1f} ms; the bound is {bound:.1f} ms (30 ms + 2 µs/row)")
