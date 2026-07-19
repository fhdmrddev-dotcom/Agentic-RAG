"""Phase 111.1 Plan 05 — live re-embed test harness.

A thin asyncpg-backed adapter that implements the SLICE of the supabase-py fluent
surface the re-embed job calls:

    supabase.table(name).select(cols).eq(c, v).neq(c, v).limit(n).execute()
    supabase.table(name).update(values).eq(c, v).execute()
    supabase.rpc(fn, params).execute()

Each terminal `.execute()` is SYNCHRONOUS (supabase-py is sync; the job wraps every
call in `run_in_threadpool`). Under `run_in_threadpool`, `.execute()` runs in a worker
thread, so it schedules the real asyncpg coroutine back onto the test's event loop via
`run_coroutine_threadsafe` and blocks on the result. The SQL therefore runs against the
LIVE :54322 inside the test's rollback transaction — the job's WHERE clauses (the RLS
`eq(user_id)` scope, the stale `neq(embedding_model)` predicate) hit real rows. This is
NOT a behavior mock: the real job logic + real SQL execute; only the embedding HTTP call
is a deterministic local stub (no API key — the cross-embedder round-trip is the manual
UAT axis).
"""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace


# ── deterministic local embedder (no network / no API key) ──────────────────────

def deterministic_embed_texts(texts, model=None, user_settings=None):
    """Stand-in for openai_service.embed_texts: a fixed 1536-dim vector per text,
    derived from the text's hash so it is stable + non-zero. Matches the live
    document_chunks.embedding column shape (vector(1536))."""
    out = []
    for t in texts:
        h = abs(hash(t)) % 997 + 1
        vec = [0.0] * 1536
        # a couple of non-zero slots so the vector literal is meaningful + distinct.
        vec[h % 1536] = 1.0
        vec[(h * 7) % 1536] = 0.5
        out.append(vec)
    return out


def make_app_settings(model: str, dims: int = 1536):
    """A minimal stand-in for UserEffectiveSettings carrying just what the job reads."""
    return SimpleNamespace(embedding_model=model, embedding_dimensions=dims)


# ── seed helper: a real is_latest document + N stale chunks for a user ───────────

async def seed_stale_chunks(conn, user_id, n: int, stale_model: str):
    """Insert one is_latest document + N chunks tagged with `stale_model`, all with a
    (non-null) stale vector, inside the caller's rollback txn. Returns (doc_id, [chunk_ids])."""
    doc_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO public.documents
          (id, user_id, filename, file_path, file_size, mime_type, status,
           version_number, is_latest, created_at, updated_at)
        VALUES ($1, $2, '111_1_reembed_fixture.txt', 'fixtures/111_1_reembed.txt',
                10, 'text/plain', 'completed', 1, true, now(), now())
        """,
        doc_id, user_id,
    )
    chunk_ids = []
    for i in range(n):
        cid = uuid.uuid4()
        # distinct hot index per chunk so the stale vectors are not all identical.
        vec = "[" + ",".join("1" if j == (i % 1536) else "0" for j in range(1536)) + "]"
        await conn.execute(
            """
            INSERT INTO public.document_chunks
              (id, document_id, user_id, content, chunk_index, embedding,
               created_at, embedding_model, embedding_dimensions)
            VALUES ($1, $2, $3, $4, $5, $6::vector, now(), $7, 1536)
            """,
            cid, doc_id, user_id, f"reembed fixture chunk {i}", i, vec, stale_model,
        )
        chunk_ids.append(cid)
    return doc_id, chunk_ids


# ── asyncpg-backed supabase-py fluent surface (rollback-txn scoped) ──────────────

class _Query:
    """A builder accumulating filters; .execute() runs real SQL on the bound conn."""

    def __init__(self, adapter: "SupabaseTxnAdapter", table: str):
        self._a = adapter
        self._table = table
        self._mode = None          # "select" | "update"
        self._select_cols = "*"
        self._update_values: dict = {}
        self._eq: list[tuple[str, object]] = []
        self._neq: list[tuple[str, object]] = []
        self._or_groups: list[str] = []
        self._limit = None

    # -- builder verbs (chainable) --
    def select(self, cols="*"):
        self._mode = "select"
        self._select_cols = cols
        return self

    def update(self, values: dict):
        self._mode = "update"
        self._update_values = dict(values)
        return self

    def eq(self, col, val):
        self._eq.append((col, val))
        return self

    def neq(self, col, val):
        self._neq.append((col, val))
        return self

    def or_(self, filter_str):
        # PostgREST or() filter: comma-separated `col.op.val` conditions combined with OR.
        # The re-embed job uses exactly `embedding_model.is.null,embedding_model.neq."<model>"`
        # (its D-10 stale predicate) — supported here so the LIVE adapter exercises the real
        # WHERE (a bare .neq drops NULL-model chunks). Rendered in _where alongside eq/neq.
        self._or_groups.append(filter_str)
        return self

    def limit(self, n):
        self._limit = n
        return self

    # -- SQL assembly --
    def _where(self, start_idx: int):
        clauses, params = [], []
        i = start_idx
        for col, val in self._eq:
            clauses.append(f"{col} = ${i}")
            params.append(val)
            i += 1
        for col, val in self._neq:
            # supabase .neq excludes equal rows; SQL `<>` also excludes NULLs, so use
            # IS DISTINCT FROM to MATCH the stale predicate semantics (NULL counts as
            # distinct-from-current — a NULL-tagged chunk IS stale and must be picked up).
            clauses.append(f"{col} IS DISTINCT FROM ${i}")
            params.append(val)
            i += 1
        for group in self._or_groups:
            or_parts: list[str] = []
            for cond in group.split(","):
                col, op, val = (cond.strip().split(".", 2) + ["", ""])[:3]
                if op == "is" and val == "null":
                    or_parts.append(f"{col} IS NULL")
                elif op == "neq":
                    or_parts.append(f"{col} IS DISTINCT FROM ${i}")
                    params.append(val.strip().strip('"'))
                    i += 1
                elif op == "eq":
                    or_parts.append(f"{col} = ${i}")
                    params.append(val.strip().strip('"'))
                    i += 1
                else:
                    raise ValueError(f"_reembed_adapter or_() unsupported op: {op!r}")
            if or_parts:
                clauses.append("(" + " OR ".join(or_parts) + ")")
        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        return where, params

    async def _run_select(self):
        cols = self._select_cols if self._select_cols == "*" else self._select_cols
        where, params = self._where(1)
        sql = f"SELECT {cols} FROM public.{self._table}{where}"
        if self._limit is not None:
            sql += f" LIMIT {int(self._limit)}"
        rows = await self._a._conn.fetch(sql, *params)
        return [dict(r) for r in rows]

    async def _run_update(self):
        cols = list(self._update_values.keys())
        params = list(self._update_values.values())
        set_clause = ", ".join(f"{c} = ${i+1}" for i, c in enumerate(cols))
        # cast the embedding param to vector when present (asyncpg sends list as array).
        for i, c in enumerate(cols):
            if c == "embedding":
                # convert list -> pgvector literal so the column type matches.
                params[i] = "[" + ",".join(str(x) for x in params[i]) + "]"
                set_clause = set_clause.replace(f"embedding = ${i+1}", f"embedding = ${i+1}::vector")
        where, wparams = self._where(len(cols) + 1)
        sql = f"UPDATE public.{self._table} SET {set_clause}{where}"
        await self._a._conn.execute(sql, *(params + wparams))
        return []

    def execute(self):
        """SYNCHRONOUS terminal — the job calls this inside run_in_threadpool."""
        if self._mode == "select":
            coro = self._run_select()
        elif self._mode == "update":
            coro = self._run_update()
        else:
            raise RuntimeError("query mode not set (need .select() or .update())")
        data = self._a._run_on_loop(coro)
        return SimpleNamespace(data=data)


class _Rpc:
    def __init__(self, adapter: "SupabaseTxnAdapter", fn: str, params: dict):
        self._a = adapter
        self._fn = fn
        self._params = params or {}

    def execute(self):
        # Only resize_embedding_column is exercised by the job. To stay A4-safe inside
        # the rollback txn (USING NULL would wipe live vectors if the conn ever escaped
        # the txn), record the call instead of running it against document_chunks; the
        # resize MECHANICS are proven separately in test_111_1_resize_column.py.
        self._a.rpc_calls.append((self._fn, dict(self._params)))
        return SimpleNamespace(data=[])


class SupabaseTxnAdapter:
    """Implements supabase.table(...).<verbs>.execute() + supabase.rpc(...).execute()
    against an asyncpg connection bound to the test's rollback transaction."""

    def __init__(self, conn):
        self._conn = conn
        self._loop = asyncio.get_event_loop()
        self.rpc_calls: list[tuple[str, dict]] = []

    def _run_on_loop(self, coro):
        # .execute() runs in a run_in_threadpool worker thread; schedule the asyncpg
        # coroutine back onto the test's event loop and block on the result.
        import threading

        if threading.current_thread() is threading.main_thread():
            # Defensive: if called directly on the loop thread (no threadpool), run inline.
            return self._loop.run_until_complete(coro)
        fut = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return fut.result()

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, fn: str, params: dict | None = None) -> _Rpc:
        return _Rpc(self, fn, params or {})
