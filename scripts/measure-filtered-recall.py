#!/usr/bin/env python3
"""Phase 272 (272-05, SC#3 / D-14) — the FILTERED recall ladder (SEED-273 checklist).

Run it with the backend virtualenv, from ``backend/`` (so ``app.config`` finds ``backend/.env``)::

    venv/Scripts/python ../scripts/measure-filtered-recall.py \\
        --dsn postgresql://postgres:postgres@127.0.0.1:54322/recall_bench \\
        --user-id 7fcfb80e-d25c-4705-8916-a81f257deb17 --prepare-sets \\
        --json-out ../.planning/phases/272-close-means-wrong/evidence/recall-ladder.json

What it measures, per filtered set size (500 / 1000 / 2000 / 5000 / 10000 chunks):

* **ground truth** — an independent exact statement (owner connection, index scans OFF,
  ``ORDER BY … + 0``) over the set's chunks. It shares no code with the function.
* **the EXACT branch** of ``match_document_chunks`` (migration 200), called the way production
  calls it (``SET LOCAL ROLE authenticated`` + both claim GUCs, ``p_exact_max_chunks`` ≥ the set).
* **the INDEX branch** (``p_exact_max_chunks`` NULL) at ``hnsw.iterative_scan`` ∈
  {strict_order, relaxed_order} × ``hnsw.ef_search`` ∈ {40, 60, 80, 100}, plus ``off`` at 40 as the
  pre-272 reference — knobs applied by the SHIPPED ``apply_hnsw_session_knobs``.
* **an unfiltered control** at the global knobs (``settings.hnsw_ef_search`` /
  ``settings.hnsw_iterative_scan``, unchanged by this phase).

Every point records recall@k vs ground truth, underfill, p50/p95 ms, and — for ONE
representative query vector — the BODY statement's ``EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)``
as a CUSTOM plan and as a GENERIC plan (``PREPARE`` + ``plan_cache_mode``), with every node type,
every ``Index Name`` and the root's shared read/hit blocks. ⛔ The cumulative
``pg_stat_user_indexes.idx_scan`` counter is NEVER read (Pitfall 9).

The body statements are COPIED out of ``pg_get_functiondef`` at run time, never retyped.

⛔ SAFETY. ``--prepare-sets`` WRITES ``metadata.date`` onto bench documents. The script refuses
to run unless the DSN names exactly the loopback database ``recall_bench`` (the
``build-recall-bench.py`` guard rule) and the connected ``current_database()`` agrees.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import statistics
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import asyncpg  # noqa: E402

from app.config import settings  # noqa: E402
from app.services.recall_eval import (  # noqa: E402
    _apply_measuring_context,
    describe_dsn,
    read_server_facts,
)
from app.services.retrieval_tuning import apply_hnsw_session_knobs  # noqa: E402

BENCH_DB_NAME = "recall_bench"
EMBEDDING_MODEL = "text-embedding-3-small"
FILTERED_MATCH_FLOOR = -2.0  # retrieval_rpc.FILTERED_MATCH_FLOOR (D-10) — the filtered call's threshold
SIZES = (500, 1000, 2000, 5000, 10000)
# A larger set, measured separately (--sizes 15000), to find where the planner first picks HNSW.
ALL_SIZES = SIZES + (15000,)
# Disjoint bench-only months: a set is resolved by a date RANGE, the way a filter resolves it.
SET_MONTH = {500: "2031-01", 1000: "2031-02", 2000: "2031-03", 5000: "2031-04", 10000: "2031-05",
             15000: "2031-06"}
INDEX_GRID = [("strict_order", ef) for ef in (40, 60, 80, 100)] + [
    ("relaxed_order", ef) for ef in (40, 60, 80, 100)
] + [("off", 40)]
_LOOPBACK = {"127.0.0.1", "localhost", "::1"}

_PARAM_ORDER = (
    "query_embedding",
    "match_threshold",
    "metadata_filter",
    "p_folder_ids",
    "p_embedding_model",
    "p_document_ids",
    "match_count",
)
_PARAM_TYPES = "public.vector, double precision, jsonb, uuid[], text, uuid[], integer"


def assert_bench_target(dsn: str) -> None:
    parts = urlsplit(dsn)
    if "," in (parts.netloc or ""):
        raise SystemExit("refusing: multi-host DSN")
    if (parts.hostname or "") not in _LOOPBACK:
        raise SystemExit(f"refusing: host {parts.hostname!r} is not loopback")
    if (parts.path or "").lstrip("/") != BENCH_DB_NAME:
        raise SystemExit(f"refusing: database must be exactly {BENCH_DB_NAME!r}")
    if parts.query:
        raise SystemExit("refusing: DSN carries a query string")


def _vec(text: str) -> str:
    return text  # already a pgvector literal from embedding::text


def _pct(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return round(ordered[int(round(p * (len(ordered) - 1)))], 2)


# ── set preparation (bench-only write) ─────────────────────────────────────────────────────────

async def prepare_sets(conn: asyncpg.Connection, user_id: str) -> dict:
    """Write disjoint bench-only ``metadata.date`` months onto latest 25-chunk documents."""
    async with conn.transaction():
        cleared = await conn.execute(
            """UPDATE public.documents SET metadata = metadata - 'date'
               WHERE user_id = $1 AND metadata ? 'date' AND metadata->>'date' LIKE '2031-%'""",
            user_id,
        )
        rows = await conn.fetch(
            """SELECT d.id::text AS id
               FROM public.documents d
               WHERE d.user_id = $1 AND d.is_latest = true
                 AND NOT (d.metadata ? 'date')
                 AND (SELECT count(*) FROM public.document_chunks c WHERE c.document_id = d.id) = 25
                 AND NOT EXISTS (SELECT 1 FROM public.document_chunks c
                                 WHERE c.document_id = d.id AND c.embedding_model <> $2)
               ORDER BY md5(d.id::text || '272-05')""",
            user_id,
            EMBEDDING_MODEL,
        )
        need = sum(s // 25 for s in ALL_SIZES)
        if len(rows) < need:
            raise SystemExit(f"bench has only {len(rows)} eligible documents, need {need}")
        cursor = 0
        assigned: dict[int, int] = {}
        for size in ALL_SIZES:
            n_docs = size // 25
            ids = [r["id"] for r in rows[cursor : cursor + n_docs]]
            cursor += n_docs
            for i, doc_id in enumerate(ids):
                day = (i % 28) + 1
                await conn.execute(
                    """UPDATE public.documents
                       SET metadata = metadata || jsonb_build_object('date', $2::text)
                       WHERE id = $1::uuid""",
                    doc_id,
                    f"{SET_MONTH[size]}-{day:02d}",
                )
            assigned[size] = len(ids)
    await conn.execute("ANALYZE public.documents")
    return {"cleared": cleared, "documents_assigned": assigned}


async def resolve_set(conn: asyncpg.Connection, user_id: str, size: int) -> tuple[list[str], int]:
    month = SET_MONTH[size]
    ids = [
        r["id"]
        for r in await conn.fetch(
            """SELECT id::text AS id FROM public.documents
               WHERE user_id = $1 AND is_latest = true
                 AND date_typed BETWEEN ($2 || '-01')::date
                                    AND (($2 || '-01')::date + interval '1 month' - interval '1 day')::date
               ORDER BY id""",
            user_id,
            month,
        )
    ]
    n_chunks = await conn.fetchval(
        """SELECT count(*) FROM public.document_chunks
           WHERE document_id = ANY($1::uuid[]) AND embedding_model = $2""",
        ids,
        EMBEDDING_MODEL,
    )
    return ids, int(n_chunks)


# ── ground truth (independent of the function) ────────────────────────────────────────────────

async def ground_truth(conn, qvec: str, ids: list[str] | None, user_id: str, k: int) -> list[str]:
    async with conn.transaction():
        for guc in ("enable_indexscan", "enable_indexonlyscan", "enable_bitmapscan"):
            await conn.execute(f"SET LOCAL {guc} = off")
        if ids is not None:
            rows = await conn.fetch(
                """SELECT dc.id::text AS id
                   FROM public.document_chunks dc JOIN public.documents d ON d.id = dc.document_id
                   WHERE dc.document_id = ANY($2::uuid[]) AND d.is_latest = true
                     AND dc.embedding_model = $3
                   ORDER BY (dc.embedding OPERATOR(public.<=>) $1::public.vector) + 0
                   LIMIT $4""",
                qvec, ids, EMBEDDING_MODEL, k,
            )
        else:
            # Control: the caller's whole visible corpus, via the function with the index forbidden
            # (the recall_eval Layer-1 method) — threshold as production's unfiltered call.
            await _apply_measuring_context(conn, user_id)
            rows = await conn.fetch(
                """SELECT id::text AS id FROM public.match_document_chunks(
                       $1::public.vector, $2::uuid, $3, $4, NULL, NULL, $5)""",
                qvec, user_id, k, settings.retrieval_match_threshold, EMBEDDING_MODEL,
            )
    return [r["id"] for r in rows]


# ── the production-shaped call ─────────────────────────────────────────────────────────────────

async def call_rpc(
    conn, *, qvec: str, user_id: str, k: int, ids: list[str] | None, exact_max: int | None,
    ef: int | None, mode: str | None, threshold: float,
) -> tuple[list[str], float]:
    async with conn.transaction():
        await _apply_measuring_context(conn, user_id)
        await apply_hnsw_session_knobs(conn, ef_search=ef, iterative_scan=mode)
        t0 = time.perf_counter()
        rows = await conn.fetch(
            """SELECT id::text AS id FROM public.match_document_chunks(
                   $1::public.vector, $2::uuid, $3, $4, NULL, NULL, $5, $6::uuid[], $7)""",
            qvec, user_id, k, threshold, EMBEDDING_MODEL, ids, exact_max,
        )
        ms = (time.perf_counter() - t0) * 1000.0
    return [r["id"] for r in rows], ms


# ── body-statement EXPLAIN (custom + generic) ─────────────────────────────────────────────────

def extract_body_statements(functiondef: str) -> dict[str, str]:
    """The two RETURN QUERY statements, copied from pg_get_functiondef, params → $n."""
    no_comments = re.sub(r"--[^\n]*", "", functiondef)
    stmts = re.findall(r"RETURN QUERY\s+(SELECT.*?);", no_comments, flags=re.S)
    if len(stmts) != 2:
        raise SystemExit(f"expected 2 RETURN QUERY statements in the function body, found {len(stmts)}")
    out = {}
    for name, stmt in zip(("exact", "index"), stmts):
        for i, param in enumerate(_PARAM_ORDER, start=1):
            stmt = re.sub(rf"\b{param}\b", f"${i}", stmt)
        out[name] = " ".join(stmt.split())
    return out


def _walk(node: dict, acc: list[dict]) -> None:
    acc.append({
        "node": node.get("Node Type"),
        "index": node.get("Index Name"),
        "relation": node.get("Relation Name"),
    })
    for child in node.get("Plans", []) or []:
        _walk(child, acc)


async def explain_body(
    conn, *, stmt: str, plan_mode: str, qvec: str, user_id: str, ids: list[str] | None, k: int,
    threshold: float, ef: int | None, mode: str | None,
) -> dict:
    """EXPLAIN the body statement as the DEFINER sees it (owner connection, caller's claims set).

    The function is SECURITY DEFINER, so its body runs as the owner: no RLS policy quals are added.
    Running the EXPLAIN under ``SET ROLE authenticated`` would add policy quals the body never
    sees, so the claims are set WITHOUT the role switch (recorded in the UAT log).
    """
    name = f"p272_{uuid.uuid4().hex[:8]}"
    ids_lit = "NULL::uuid[]" if ids is None else "ARRAY[" + ",".join(
        f"'{uuid.UUID(i)}'" for i in ids) + "]::uuid[]"
    args = (
        f"'{qvec}'::public.vector, {float(threshold)!r}::double precision, NULL::jsonb, NULL::uuid[], "
        f"'{EMBEDDING_MODEL}', {ids_lit}, {int(k)}"
    )
    async with conn.transaction():
        await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", user_id)
        await conn.execute(
            "SELECT set_config('request.jwt.claims', $1, true)",
            json.dumps({"sub": user_id, "role": "authenticated"}),
        )
        await apply_hnsw_session_knobs(conn, ef_search=ef, iterative_scan=mode)
        await conn.execute(f"SET LOCAL plan_cache_mode = {plan_mode}")
        await conn.execute(f"PREPARE {name}({_PARAM_TYPES}) AS {stmt}")
        try:
            raw = await conn.fetchval(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) EXECUTE {name}({args})")
        finally:
            await conn.execute(f"DEALLOCATE {name}")
    data = json.loads(raw) if isinstance(raw, str) else raw
    root = data[0]
    top = root["Plan"]
    nodes: list[dict] = []
    _walk(top, nodes)
    return {
        "plan_cache_mode": plan_mode,
        "nodes": nodes,
        "index_names": sorted({n["index"] for n in nodes if n["index"]}),
        "hnsw_node": any(n["index"] == "document_chunks_embedding_idx" for n in nodes),
        "uses_document_id_btree": any(n["index"] == "idx_document_chunks_document_id" for n in nodes),
        "seq_scan_on_chunks": any(
            n["node"] == "Seq Scan" and n["relation"] == "document_chunks" for n in nodes),
        "shared_read_blocks": top.get("Shared Read Blocks"),
        "shared_hit_blocks": top.get("Shared Hit Blocks"),
        "execution_time_ms": root.get("Execution Time"),
        "planning_time_ms": root.get("Planning Time"),
        "actual_rows": top.get("Actual Rows"),
    }


def _short(plan: dict) -> str:
    kinds = [n["node"] + (f"[{n['index']}]" if n["index"] else "") for n in plan["nodes"]
             if n["node"] in ("Seq Scan", "Index Scan", "Bitmap Index Scan", "Bitmap Heap Scan",
                              "Index Only Scan")]
    return " · ".join(kinds)


# ── one ladder point ───────────────────────────────────────────────────────────────────────────

async def measure_point(
    conn, *, label: str, branch: str, size: int | None, ids: list[str] | None, n_chunks: int | None,
    qvecs: list[str], gts: list[list[str]], user_id: str, k: int, exact_max: int | None,
    ef: int | None, mode: str | None, threshold: float, stmt: str,
) -> dict:
    recalls, underfills, lat = [], [], []
    for qvec, gt in zip(qvecs, gts):
        got, ms = await call_rpc(conn, qvec=qvec, user_id=user_id, k=k, ids=ids,
                                 exact_max=exact_max, ef=ef, mode=mode, threshold=threshold)
        lat.append(ms)
        underfills.append(1 - len(got) / k)
        if gt:
            recalls.append(len(set(got) & set(gt)) / len(gt))
    custom = await explain_body(conn, stmt=stmt, plan_mode="force_custom_plan", qvec=qvecs[0],
                                user_id=user_id, ids=ids, k=k, threshold=threshold, ef=ef, mode=mode)
    generic = await explain_body(conn, stmt=stmt, plan_mode="force_generic_plan", qvec=qvecs[0],
                                 user_id=user_id, ids=ids, k=k, threshold=threshold, ef=ef, mode=mode)
    point = {
        "label": label, "branch": branch, "set_chunks_target": size, "set_chunks": n_chunks,
        "set_documents": None if ids is None else len(ids),
        "iterative_scan": mode, "ef_search": ef, "k": k, "threshold": threshold,
        "query_vectors": len(qvecs), "scored": len(recalls),
        "recall_at_k": round(statistics.mean(recalls), 4) if recalls else None,
        "recall_min": round(min(recalls), 4) if recalls else None,
        "underfill": round(statistics.mean(underfills), 4),
        "p50_ms": _pct(lat, 0.50), "p95_ms": _pct(lat, 0.95),
        "explain_custom": custom, "explain_generic": generic,
    }
    print(
        f"{label:<34} recall {point['recall_at_k']!s:<6} min {point['recall_min']!s:<6} "
        f"p50 {point['p50_ms']!s:>8} p95 {point['p95_ms']!s:>8} | custom: {_short(custom)} "
        f"read={custom['shared_read_blocks']} | generic: {_short(generic)} read={generic['shared_read_blocks']}",
        flush=True,
    )
    return point


async def main_async(args: argparse.Namespace) -> int:
    assert_bench_target(args.dsn)
    conn = await asyncpg.connect(args.dsn, timeout=10)
    try:
        if await conn.fetchval("SELECT current_database()") != BENCH_DB_NAME:
            raise SystemExit("refusing: connected database is not recall_bench")
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
        server = await read_server_facts(conn)
        prep = await prepare_sets(conn, args.user_id) if args.prepare_sets else None
        fdef = await conn.fetchval(
            "SELECT pg_get_functiondef('public.match_document_chunks(public.vector, uuid, integer, "
            "double precision, jsonb, uuid[], text, uuid[], integer)'::regprocedure)")
        stmts = extract_body_statements(fdef)
        # Migration 201: the function pins custom plans, so the GENERIC EXPLAIN below is what the
        # body WOULD run without the pin (recorded as the hazard), the CUSTOM one is what it runs.
        proconfig = await conn.fetchval(
            "SELECT proconfig FROM pg_proc WHERE oid = 'public.match_document_chunks(public.vector, "
            "uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)'::regprocedure")

        qrows = await conn.fetch(
            """SELECT dc.embedding::text AS vec
               FROM public.document_chunks dc JOIN public.documents d ON d.id = dc.document_id
               WHERE d.user_id = $1 AND dc.embedding_model = $2
               ORDER BY md5(dc.id::text || $3) LIMIT $4""",
            args.user_id, EMBEDDING_MODEL, args.seed, args.query_vectors,
        )
        qvecs = [_vec(r["vec"]) for r in qrows]
        k = args.k

        # Warm the caches once (an untimed pass over every set at the exact branch + control).
        sizes = tuple(int(x) for x in args.sizes.split(",")) if args.sizes else SIZES
        sets = {s: await resolve_set(conn, args.user_id, s) for s in sizes}
        for s, (ids, n) in sets.items():
            for q in qvecs[:3]:
                await call_rpc(conn, qvec=q, user_id=args.user_id, k=k, ids=ids, exact_max=n,
                               ef=None, mode=None, threshold=FILTERED_MATCH_FLOOR)
                await call_rpc(conn, qvec=q, user_id=args.user_id, k=k, ids=ids, exact_max=None,
                               ef=40, mode="relaxed_order", threshold=FILTERED_MATCH_FLOOR)

        points: list[dict] = []
        # Unfiltered control at the GLOBAL knobs (unchanged by 272).
        gts_control = [await ground_truth(conn, q, None, args.user_id, k) for q in qvecs]
        points.append(await measure_point(
            conn, label="control unfiltered (global knobs)", branch="index", size=None, ids=None,
            n_chunks=None, qvecs=qvecs, gts=gts_control, user_id=args.user_id, k=k, exact_max=None,
            ef=settings.hnsw_ef_search, mode=settings.hnsw_iterative_scan,
            threshold=settings.retrieval_match_threshold, stmt=stmts["index"]))

        for s in sizes:
            ids, n = sets[s]
            gts = [await ground_truth(conn, q, ids, args.user_id, k) for q in qvecs]
            points.append(await measure_point(
                conn, label=f"{s} exact", branch="exact", size=s, ids=ids, n_chunks=n, qvecs=qvecs,
                gts=gts, user_id=args.user_id, k=k, exact_max=n, ef=None, mode=None,
                threshold=FILTERED_MATCH_FLOOR, stmt=stmts["exact"]))
            for mode, ef in INDEX_GRID:
                points.append(await measure_point(
                    conn, label=f"{s} index {mode} ef{ef}", branch="index", size=s, ids=ids,
                    n_chunks=n, qvecs=qvecs, gts=gts, user_id=args.user_id, k=k, exact_max=None,
                    ef=ef, mode=mode, threshold=FILTERED_MATCH_FLOOR, stmt=stmts["index"]))

        report = {
            "measured_at": datetime.now(timezone.utc).isoformat(),
            "database": describe_dsn(args.dsn),
            "user_id": args.user_id,
            "server": server,
            "corpus_chunks": await conn.fetchval("SELECT count(*) FROM public.document_chunks"),
            "prepare_sets": prep,
            "k": k,
            "query_vectors": len(qvecs),
            "seed": args.seed,
            "global_knobs": {"hnsw_ef_search": settings.hnsw_ef_search,
                             "hnsw_iterative_scan": settings.hnsw_iterative_scan,
                             "hnsw_max_scan_tuples": settings.hnsw_max_scan_tuples},
            "explain_method": (
                "body statements copied from pg_get_functiondef; PREPARE + EXPLAIN (ANALYZE, BUFFERS, "
                "FORMAT JSON) EXECUTE under plan_cache_mode force_custom_plan and force_generic_plan; "
                "owner connection with the caller's claim GUCs set (DEFINER-faithful, no RLS quals); "
                "pg_stat_user_indexes.idx_scan never read"),
            "function_proconfig": proconfig,
            "body_statements": stmts,
            "points": points,
        }
        if args.json_out:
            args.json_out.parent.mkdir(parents=True, exist_ok=True)
            args.json_out.write_text(json.dumps(report, indent=2), encoding="utf-8")
            print(f"wrote {args.json_out}")
        return 0
    finally:
        await conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(prog="measure-filtered-recall.py")
    parser.add_argument("--dsn", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--k", type=int, default=20)
    parser.add_argument("--query-vectors", type=int, default=25)
    parser.add_argument("--seed", default="272")
    parser.add_argument("--prepare-sets", action="store_true",
                        help="bench-only write: assign the disjoint 2031 months to document subsets")
    parser.add_argument("--sizes", default="", help="comma list of set sizes (default 500..10000)")
    parser.add_argument("--json-out", type=Path, default=None)
    return asyncio.run(main_async(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
