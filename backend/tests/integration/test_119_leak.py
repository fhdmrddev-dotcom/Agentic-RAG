"""Phase 119 — DGOV-01 — the two-user LIVE leak proof for all three governance signals.

THE mandatory live proof of T-119-01-01/02 owner-scoping. ``get_supabase()`` is the
SERVICE-ROLE client (RLS bypassed), so the app-code ``.eq("user_id", _uid(caller))`` on
EVERY governance query is the SOLE owner-scoping gate. This test drives the REAL HTTP routes
(``/document-governance/{broken-relationships,unclassified,low-confidence}``) via a FastAPI
``TestClient`` with ``get_current_user`` overridden to inject A vs B and ``get_supabase``
overridden to the REAL service-role client — so the WHOLE handler runs (auth boundary →
threadpool-wrapped fetch → response), not just an in-process fn.

NON-VACUITY (the D-102 / D-110-5 "static would false-green" lesson): each user is seeded at
least ONE true positive PER signal so an "all clear" pass cannot false-green:

  * broken      — an edge whose target was hard-deleted (no readable latest → broken).
  * unclassified — a doc with ``metadata._classification.status == "suggested"``.
  * low-conf    — a doc with a ``0.4`` confidence field (< the 0.5 ConfidenceChip cutoff).

Two-user assertion: A's three lists NEVER contain B's docs/edges, and vice-versa. Each user's
list IS non-empty (their own seeded true positive), so a blanket-empty bug cannot pass.

MASKED-NOT-BROKEN twin (D-119-3): a target that is masked "linked document (no access)" to a
caller (present-but-unreadable) is NOT a break — masking != deletion. The non-vacuity twin is
that the OWNER of that doc (who CAN read it) also does not see it as broken (it resolves).

This clones ``test_117_route_leak.py``'s harness VERBATIM (asyncpg pool, ``_pg_reachable``
skip-guard, ``_supabase_or_skip``, FK-safe seed/teardown, OWN-scoped per-user rows). Imports
are inside the test bodies so collection never errors before Task 2 ships the router.
"""
import asyncio
import json
import os
from uuid import uuid4

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_MASK = "linked document (no access)"


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    if asyncpg is None:
        return False
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 119 leak test",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


def _read_local_supabase_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return None
    url = key = None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k == "SUPABASE_URL":
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY":
                    key = v
    except OSError:
        return None
    if not url or not key:
        return None
    return url, key


def _supabase_or_skip():
    """Build a service-role supabase client against the REAL local Supabase, or skip."""
    creds = _read_local_supabase_env()
    if creds is None:
        pytest.skip("local SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in backend/.env")
    url, key = creds
    try:
        from supabase import create_client
        client = create_client(url, key)
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"supabase service-role client unavailable: {type(e).__name__}: {e}")
    try:
        client.table("documents").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate unreachable: {type(e).__name__}: {e}")
    return client


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


async def _seed_user(pool, label):
    user_id = uuid4()
    await pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-119-leak-{label}-{user_id}@test.local",
    )
    return user_id


async def _seed_doc(pool, user_id, *, title, folder_id=None, metadata=None,
                    is_latest=True, version=1, filename=None):
    doc_id = uuid4()
    fname = filename or f"{title}-{doc_id}.txt"
    await pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, "
        "status, metadata, created_at, is_latest, version_number, folder_id) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10, $11)",
        doc_id, user_id, fname,
        f"{user_id}/{doc_id}.txt", 100, "text/plain", "completed",
        metadata if metadata is not None else {"title": title}, is_latest, version, folder_id,
    )
    return doc_id


async def _seed_relationship(pool, owner_id, source_id, target_id, rel_type="references"):
    rel_id = uuid4()
    await pool.execute(
        "INSERT INTO public.document_relationships "
        "(id, user_id, source_doc_id, target_doc_id, rel_type) VALUES ($1, $2, $3, $4, $5)",
        rel_id, owner_id, source_id, target_id, rel_type,
    )
    return rel_id


def _suggested_meta(title, *, folder_name="Contracts"):
    """The Phase 118 `_classification` shape with status 'suggested' (D-118-5/D-119-4)."""
    return {
        "title": title,
        "_classification": {
            "rule_id": str(uuid4()),
            "rule_name": "rule",
            "condition_summary": "document_type == contract",
            "suggested_folder_id": str(uuid4()),
            "suggested_folder_name": folder_name,
            "status": "suggested",
        },
    }


def _low_conf_meta(title, *, score=0.4):
    """A doc with one POPULATED below-cutoff `_confidence` field (the < 0.5 low signal, D-119-5).

    The scored field MUST carry a real value: an empty/unextracted field is MISSING metadata,
    not LOW-confidence metadata (BUG-260620), so the scan excludes score-only fields. A
    `document_type` value here keeps this a genuine low-confidence true-positive.
    """
    return {"title": title, "document_type": "report", "_confidence": {"document_type": score}}


@pytest_asyncio.fixture
async def two_users_with_signals(pg_pool):
    """Seed each user a NON-VACUOUS true positive per signal (own-scoped):

      A: broken edge (orphaned old-version target) · suggested doc · low-conf doc (0.4 field)
      B: broken edge (orphaned old-version target) · suggested doc · low-conf doc (0.4 field)

    Every doc/edge is owned by its user. A's lists must NEVER contain any of B's ids and
    vice-versa, AND each user's lists are non-empty (own positives) so empty-everywhere
    cannot false-green.

    BROKEN seed reflects the A1 live finding: ``document_relationships`` FKs are ON DELETE
    CASCADE, so hard-deleting an endpoint takes its edge with it — the ONLY dangling state is an
    edge keyed on a now-orphaned OLD version whose lineage has no ``is_latest=True`` row. We seed
    v1 (is_latest=False) + v2 (is_latest=True) of a target, link the edge to v1, then delete v2 →
    the v1 row + the edge survive, but the lineage has no current latest → broken.
    """
    for tbl in ("documents", "document_relationships"):
        if not await _table_exists(pg_pool, tbl):
            pytest.skip(f"{tbl} table absent")

    ctx = {}
    for label in ("a", "b"):
        uid = await _seed_user(pg_pool, label)

        # --- BROKEN signal: an edge keyed on an orphaned OLD version (no current latest). ---
        src = await _seed_doc(pg_pool, uid, title=f"{label}-broken-src", folder_id=None)
        tgt_fname = f"{label}-broken-target-{uuid4()}.txt"
        tgt_v1 = await _seed_doc(
            pg_pool, uid, title=f"{label}-broken-tgt-v1",
            folder_id=None, filename=tgt_fname, is_latest=False, version=1,
        )
        tgt_v2 = await _seed_doc(
            pg_pool, uid, title=f"{label}-broken-tgt-v2",
            folder_id=None, filename=tgt_fname, is_latest=True, version=2,
        )
        rel = await _seed_relationship(pg_pool, uid, src, tgt_v1, "references")
        # Delete the current latest (v2) → its edges cascade, but our edge keyed on v1 survives;
        # the lineage now has NO is_latest=True row → genuinely broken (not masked).
        await pg_pool.execute("DELETE FROM documents WHERE id = $1", tgt_v2)

        # --- UNCLASSIFIED signal: a doc with status:'suggested'. ---
        unclass = await _seed_doc(
            pg_pool, uid, title=f"{label}-unclassified",
            folder_id=None, metadata=_suggested_meta(f"{label}-unclassified"),
        )

        # --- LOW-CONF signal: a doc with a 0.4 confidence field. ---
        lowc = await _seed_doc(
            pg_pool, uid, title=f"{label}-lowconf",
            folder_id=None, metadata=_low_conf_meta(f"{label}-lowconf"),
        )

        ctx[label] = {
            "uid": str(uid),
            "broken_src": str(src),
            "broken_rel": str(rel),
            "dead_target": str(tgt_v1),  # the orphaned old-version row the edge dangles to
            "unclassified": str(unclass),
            "lowconf": str(lowc),
        }

    try:
        yield ctx
    finally:
        for label in ("a", "b"):
            uid = ctx[label]["uid"]
            for sql in (
                "DELETE FROM public.document_relationships WHERE user_id = $1",
                "DELETE FROM public.documents WHERE user_id = $1",
                "DELETE FROM public.folders WHERE user_id = $1",
                "DELETE FROM audit_log WHERE user_id = $1",
                "DELETE FROM auth.users WHERE id = $1",
            ):
                try:
                    await pg_pool.execute(sql, uid)
                except Exception:
                    pass


def _route_client(caller_id: str, sb):
    """A FastAPI TestClient hitting the REAL routes, authed as `caller_id` against the REAL
    service-role supabase. Overrides ONLY the two boundary deps (auth + client). Returns
    `(client, teardown)`; the caller MUST call `teardown()`."""
    from fastapi.testclient import TestClient

    from app.dependencies import get_current_user, get_supabase
    from app.main import app

    prev = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = lambda: {"id": caller_id, "email": f"{caller_id}@test.local"}
    app.dependency_overrides[get_supabase] = lambda: sb

    def _teardown():
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev)

    return TestClient(app), _teardown


def _all_ids(body):
    """Every doc id surfaced anywhere in a governance list response."""
    ids = set()
    for it in body.get("items", []):
        for k in ("document_id", "readable_doc_id", "broken_doc_id"):
            v = it.get(k)
            if v:
                ids.add(v)
    return ids


def _fetch_all_three(client, params=None):
    return {
        "broken": client.get("/document-governance/broken-relationships", params=params or {}),
        "unclassified": client.get("/document-governance/unclassified", params=params or {}),
        "low": client.get("/document-governance/low-confidence", params=params or {}),
    }


@pytest.mark.asyncio
async def test_user_a_never_sees_user_b_signals(pg_pool, two_users_with_signals):
    """A's three governance lists NEVER contain any of B's docs/edges; A DOES see its own
    seeded positives (non-vacuous — empty-everywhere cannot pass)."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    sb = _supabase_or_skip()
    ctx = two_users_with_signals
    a, b = ctx["a"], ctx["b"]

    client, teardown = _route_client(a["uid"], sb)
    try:
        resp = _fetch_all_three(client)
    finally:
        teardown()

    for key in ("broken", "unclassified", "low"):
        assert resp[key].status_code == 200, f"{key}: {resp[key].status_code} {resp[key].text}"

    blob = json.dumps({k: v.json() for k, v in resp.items()})

    # B's ids/filenames must NEVER appear in A's lists (own-scoping is the sole gate).
    for bid in (b["broken_src"], b["broken_rel"], b["unclassified"], b["lowconf"], b["dead_target"]):
        assert bid not in blob, f"A must never see B's id {bid} in any governance list"

    # NON-VACUITY: A genuinely sees its OWN positives in each list.
    assert a["unclassified"] in _all_ids(resp["unclassified"].json()), (
        "A must see its own suggested doc (non-vacuous)"
    )
    assert a["lowconf"] in _all_ids(resp["low"].json()), (
        "A must see its own low-conf doc (non-vacuous)"
    )
    assert resp["broken"].json().get("total", 0) >= 1, (
        "A must see its own broken edge (non-vacuous)"
    )


@pytest.mark.asyncio
async def test_user_b_never_sees_user_a_signals(pg_pool, two_users_with_signals):
    """The symmetric direction — B never sees A's docs/edges, and B sees its own positives."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    sb = _supabase_or_skip()
    ctx = two_users_with_signals
    a, b = ctx["a"], ctx["b"]

    client, teardown = _route_client(b["uid"], sb)
    try:
        resp = _fetch_all_three(client)
    finally:
        teardown()

    for key in ("broken", "unclassified", "low"):
        assert resp[key].status_code == 200, f"{key}: {resp[key].status_code} {resp[key].text}"

    blob = json.dumps({k: v.json() for k, v in resp.items()})
    for aid in (a["broken_src"], a["broken_rel"], a["unclassified"], a["lowconf"], a["dead_target"]):
        assert aid not in blob, f"B must never see A's id {aid} in any governance list"

    assert b["unclassified"] in _all_ids(resp["unclassified"].json())
    assert b["lowconf"] in _all_ids(resp["low"].json())
    assert resp["broken"].json().get("total", 0) >= 1


@pytest_asyncio.fixture
async def masked_not_broken(pg_pool):
    """A masked-but-present target (Phase 117 semantics) is NOT a break (D-119-3).

      * SUBJECT — A's GLOBAL-folder doc → BOTH A and B can read it.
      * TARGET — A's PRIVATE doc (folder_id=NULL, owned by A) → only A can read it.
      * B's edge subject→target → B cannot read the target, so the relationship view masks it
        ("linked document (no access)"). But the target STILL EXISTS and resolves for its
        owner — so it must NOT be reported as a BROKEN relationship on B's governance card.
      * NON-VACUITY twin: A (who owns the target) also does NOT see it as broken (it resolves).
    """
    if not await _table_exists(pg_pool, "folders"):
        pytest.skip("folders table absent")

    user_a = await _seed_user(pg_pool, "mask-a")
    user_b = await _seed_user(pg_pool, "mask-b")

    global_folder = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.folders (id, user_id, name, is_global) VALUES ($1, $2, $3, true)",
        global_folder, user_a, "A-shared-119",
    )
    subject = await _seed_doc(pg_pool, user_a, title="A-mask-subject", folder_id=global_folder)
    target = await _seed_doc(pg_pool, user_a, title="A-mask-secret-target", folder_id=None)

    # B owns an edge subject→target. B can read the subject (global) but NOT the target.
    rel_b = await _seed_relationship(pg_pool, user_b, subject, target, "references")
    # A owns an edge too (so A also exercises the broken card over the SAME resolvable target).
    rel_a = await _seed_relationship(pg_pool, user_a, subject, target, "references")

    ctx = {
        "user_a": str(user_a), "user_b": str(user_b),
        "subject": str(subject), "target": str(target),
        "rel_a": str(rel_a), "rel_b": str(rel_b),
        "target_real_title": "A-mask-secret-target",
    }
    try:
        yield ctx
    finally:
        for uid in (user_a, user_b):
            for sql in (
                "DELETE FROM public.document_relationships WHERE user_id = $1",
                "DELETE FROM public.documents WHERE user_id = $1",
                "DELETE FROM public.folders WHERE user_id = $1",
                "DELETE FROM audit_log WHERE user_id = $1",
                "DELETE FROM auth.users WHERE id = $1",
            ):
                try:
                    await pg_pool.execute(sql, uid)
                except Exception:
                    pass


@pytest.mark.asyncio
async def test_masked_target_not_reported_as_broken_for_either_viewer(pg_pool, masked_not_broken):
    """A present-but-masked target is NOT a break for B (masking != deletion), and the
    OWNER A (who can read it) does not see it as broken either — the non-vacuity twin."""
    if not await _table_exists(pg_pool, "document_relationships"):
        pytest.skip("document_relationships table absent")

    sb = _supabase_or_skip()
    ctx = masked_not_broken

    # B's broken card: the masked-but-present target must NOT surface as broken.
    client_b, teardown_b = _route_client(ctx["user_b"], sb)
    try:
        resp_b = client_b.get("/document-governance/broken-relationships")
    finally:
        teardown_b()
    assert resp_b.status_code == 200, f"{resp_b.status_code}: {resp_b.text}"
    body_b = resp_b.json()
    blob_b = json.dumps(body_b)
    # The target exists (masked to B), so it is NOT a deletion → not broken; B must not see
    # the rel reported as broken, and must never see the private target id/title.
    assert ctx["rel_b"] not in blob_b, (
        "a masked-but-present target is NOT broken (masking != deletion) — B must not report it"
    )
    assert ctx["target"] not in blob_b, "B must never see the masked private target id"
    assert ctx["target_real_title"] not in blob_b, "B must never see the masked private target title"

    # NON-VACUITY twin: A owns the target (it resolves) → A's broken card must NOT report it.
    client_a, teardown_a = _route_client(ctx["user_a"], sb)
    try:
        resp_a = client_a.get("/document-governance/broken-relationships")
    finally:
        teardown_a()
    assert resp_a.status_code == 200, f"{resp_a.status_code}: {resp_a.text}"
    assert ctx["rel_a"] not in json.dumps(resp_a.json()), (
        "A's edge to a resolvable target must NOT be broken (the resolver returns the row)"
    )
