"""Diagnose: does a pooled session's plpgsql plan cache switch match_document_chunks to a whole-table
generic plan? Bench only; every DDL change is inside a transaction that is ROLLED BACK."""
import asyncio, asyncpg, json, re, time, pathlib, sys
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/recall_bench"
UID = "7fcfb80e-d25c-4705-8916-a81f257deb17"
M = "text-embedding-3-small"
ROOT = pathlib.Path(__file__).resolve()
MIG = pathlib.Path(r"C:/Vibe Apps/Agentic RAG/supabase/migrations")

def fn170():
    t = (MIG / "170_documents_source_state.sql").read_text(encoding="utf-8")
    s = t.index("CREATE OR REPLACE FUNCTION public.match_document_chunks(")
    e = t.index("$function$;", s) + len("$function$;")
    return t[s:e]

async def calls(conn, n, ids, exact_max, ef, mode, thr):
    out = []
    for i in range(n):
        async with conn.transaction():
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", UID)
            await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", json.dumps({"sub": UID, "role": "authenticated"}))
            if ef: await conn.execute(f"SET LOCAL hnsw.ef_search = {int(ef)}")
            if mode: await conn.execute(f"SET LOCAL hnsw.iterative_scan = '{mode}'")
            t = time.perf_counter()
            if ids is None and exact_max is None and scenario_old[0]:
                await conn.fetch("SELECT id FROM public.match_document_chunks($1::public.vector,$2::uuid,20,$3,NULL,NULL,$4)", qv[i % len(qv)], UID, thr, M)
            else:
                await conn.fetch("SELECT id FROM public.match_document_chunks($1::public.vector,$2::uuid,20,$3,NULL,NULL,$4,$5::uuid[],$6)", qv[i % len(qv)], UID, thr, M, ids, exact_max)
            out.append(round((time.perf_counter() - t) * 1000, 1))
    return out

scenario_old = [False]
qv = []

async def run(label, setup_sql, *, old=False, ids=None, exact_max=None, ef=None, mode=None, thr=0.3, n=12):
    conn = await asyncpg.connect(DSN)
    assert await conn.fetchval("select current_database()") == "recall_bench"
    tr = conn.transaction(); await tr.start()
    try:
        for s in setup_sql: await conn.execute(s)
        scenario_old[0] = old
        # calls() opens nested transactions -> savepoints; SET LOCAL reverts per savepoint? use plain execution instead
        ms = []
        for i in range(n):
            await conn.execute("SAVEPOINT s")
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", UID)
            await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", json.dumps({"sub": UID, "role": "authenticated"}))
            if ef: await conn.execute(f"SET LOCAL hnsw.ef_search = {int(ef)}")
            if mode: await conn.execute(f"SET LOCAL hnsw.iterative_scan = '{mode}'")
            t = time.perf_counter()
            if old:
                await conn.fetch("SELECT id FROM public.match_document_chunks($1::public.vector,$2::uuid,20,$3,NULL,NULL,$4)", qv[i % len(qv)], UID, thr, M)
            else:
                await conn.fetch("SELECT id FROM public.match_document_chunks($1::public.vector,$2::uuid,20,$3,NULL,NULL,$4,$5::uuid[],$6)", qv[i % len(qv)], UID, thr, M, ids, exact_max)
            ms.append(round((time.perf_counter() - t) * 1000, 1))
            await conn.execute("RESET ROLE")
            await conn.execute("RELEASE SAVEPOINT s")
        print(f"{label:<62} {ms}", flush=True)
    finally:
        await tr.rollback(); await conn.close()

async def main():
    global qv
    c = await asyncpg.connect(DSN)
    qv = [r["v"] for r in await c.fetch("SELECT dc.embedding::text v FROM public.document_chunks dc JOIN public.documents d ON d.id=dc.document_id WHERE d.user_id=$1 AND dc.embedding_model=$2 ORDER BY md5(dc.id::text||'272') LIMIT 12", UID, M)]
    ids500 = [r["id"] for r in await c.fetch("SELECT id::text id FROM public.documents WHERE user_id=$1 AND date_typed BETWEEN '2031-01-01' AND '2031-01-31'", UID)]
    print("set500 docs", len(ids500))
    await c.close()
    DROP_IDX = "DROP INDEX public.idx_document_chunks_document_id"
    DROP200 = "DROP FUNCTION public.match_document_chunks(public.vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer)"
    CUSTOM = "ALTER FUNCTION public.match_document_chunks(public.vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) SET plan_cache_mode = force_custom_plan"
    which = sys.argv[1:] or ["A","B","C","D","E","F","G"]
    if "A" in which: await run("A unfiltered | mig200 fn + btree (as applied)", [])
    if "B" in which: await run("B unfiltered | mig200 fn, btree dropped", [DROP_IDX])
    if "C" in which: await run("C unfiltered | mig170 fn + btree", [DROP200, fn170()], old=True)
    if "D" in which: await run("D unfiltered | mig170 fn, no btree (PRE-272)", [DROP200, fn170(), DROP_IDX], old=True)
    if "E" in which: await run("E unfiltered | mig200 fn + btree + force_custom_plan", [CUSTOM])
    if "F" in which: await run("F set500 index relaxed ef40 | mig200 as applied", [], ids=ids500, ef=40, mode="relaxed_order", thr=-2.0)
    if "G" in which: await run("G set500 index relaxed ef40 | + force_custom_plan", [CUSTOM], ids=ids500, ef=40, mode="relaxed_order", thr=-2.0)

asyncio.run(main())
