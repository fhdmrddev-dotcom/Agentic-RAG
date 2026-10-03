import asyncio, asyncpg, json, time, pathlib
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/recall_bench"
UID = "7fcfb80e-d25c-4705-8916-a81f257deb17"
MIG = pathlib.Path(r"C:/Vibe Apps/Agentic RAG/supabase/migrations")
def fn170kw():
    t = (MIG / "170_documents_source_state.sql").read_text(encoding="utf-8")
    s = t.index("CREATE OR REPLACE FUNCTION public.keyword_search_chunks(")
    e = t.index("$function$;", s) + len("$function$;")
    return t[s:e]
QS = ["bench chunk filler", "filler", "chunk 347", "bench filler 12", "chunk", "bench"]
async def run(label, setup, old=False, ids=None, n=12):
    conn = await asyncpg.connect(DSN); assert await conn.fetchval("select current_database()")=="recall_bench"
    tr = conn.transaction(); await tr.start()
    try:
        for s in setup: await conn.execute(s)
        ms=[]; rows=[]
        for i in range(n):
            await conn.execute("SAVEPOINT s"); await conn.execute("SET LOCAL ROLE authenticated")
            await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", UID)
            await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", json.dumps({"sub":UID,"role":"authenticated"}))
            t=time.perf_counter()
            if old: r = await conn.fetch("SELECT id FROM public.keyword_search_chunks($1,$2::uuid,20,NULL,NULL)", QS[i%len(QS)], UID)
            else: r = await conn.fetch("SELECT id FROM public.keyword_search_chunks($1,$2::uuid,20,NULL,NULL,$3::uuid[])", QS[i%len(QS)], UID, ids)
            ms.append(round((time.perf_counter()-t)*1000,1)); rows.append(len(r))
            await conn.execute("RESET ROLE"); await conn.execute("RELEASE SAVEPOINT s")
        print(f"{label:<55} {ms} rows={rows}", flush=True)
    finally:
        await tr.rollback(); await conn.close()
async def main():
    DROP_IDX="DROP INDEX public.idx_document_chunks_document_id"
    DROP200="DROP FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[])"
    CUSTOM="ALTER FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[], uuid[]) SET plan_cache_mode = force_custom_plan"
    await run("KA kw unfiltered | mig200 + btree (as applied)", [])
    await run("KD kw unfiltered | mig170 no btree (PRE-272)", [DROP200, fn170kw(), DROP_IDX], old=True)
    await run("KC kw unfiltered | mig170 + btree", [DROP200, fn170kw()], old=True)
    await run("KE kw unfiltered | mig200 + btree + force_custom", [CUSTOM])
asyncio.run(main())
