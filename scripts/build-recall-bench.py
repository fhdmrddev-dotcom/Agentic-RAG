#!/usr/bin/env python
"""Phase 241 (241-02 / QUEUE-06 / D-07 / D-08) — build a throwaway ``recall_bench``
database on the LOCAL Docker Postgres, big enough and SKEWED enough for
``hnsw.ef_search = 40`` to starve a small tenant.

Why a bench at all. The live corpus is 7,953 chunks whose tenant skew is roughly one
third each — 241-CONTEXT F-5 calls that *"precisely the shape SEED-076 says hides the
defect"*. The collapse is driven by SELECTIVITY, not by raw size: a tenant owning 0.2%
of a corpus starves a 40-candidate global scan whether the corpus is 250k chunks or
20M. This builder creates the skew the real corpus cannot show, at a size a laptop can
hold.

Fidelity, by construction:
  * The schema is the project's own bootstrap artifact ``supabase/full-schema.sql``, so
    ``match_document_chunks`` here is the REAL function, not a hand-copied one.
  * The 7,953 real chunks are copied in VERBATIM — real ids, real content, real
    embeddings — so the Layer-2 probes resolve to real targets and "before / after" is
    the same probes against the same targets at two corpus sizes.
  * Every synthetic vector is a PERTURBATION of a real embedding. Nothing here calls
    the embedding service and nothing here makes a provider or network call, so
    SEED-197's 2048-input exposure is removed rather than merely stayed under.
    (The acceptance grep for that is literal, so the function name is deliberately not
    written anywhere in this file — not even in prose.)

⛔⛔ THE DOCUMENTED DELTAS FROM PRODUCTION. ``full-schema.sql`` is a
``pg_dump --schema=public`` plus a cross-schema supplement; a brand-new database has
neither the Supabase ``auth`` schema, nor the ``storage`` schema, nor the
``supabase_realtime`` publication that the supplement writes into. The prelude below
supplies the minimum of each. The security-bearing one is the first:

  **The hand-rolled ``auth.uid()`` stub exists ONLY inside `recall_bench`; it must never
  be copied into `supabase/migrations/` nor into `full-schema.sql`, because production's
  `auth.uid()` is Supabase Auth's own and a hand-rolled one would be an authentication
  bypass on 156 call sites.**

That sentence is repeated verbatim as a refusal comment directly above the stub, so it
cannot be lifted without it.

⛔ SAFETY, which is this script's whole point. It issues irreversible database-level
drop and create statements against a local Postgres cluster that also holds the
operator's live Supabase development data -- 159 documents and 7,953 chunks that no
migration, no backup and no fixture can restore. Two independent properties keep that
safe: ``assert_bench_target`` runs before every one of them (database name EQUAL to
``recall_bench``, never a substring; host loopback), and the statements themselves
interpolate the ``BENCH_DB_NAME`` constant rather than any name parsed from a flag.
The source database is opened READ ONLY at the server, so a stray write there fails at
the server rather than by convention.
``backend/tests/unit/test_241_bench_safety.py`` drives both arms RED against planted
defects and fences the source so no destructive statement can be reached without the
guard running first.

Usage
-----
    python scripts/build-recall-bench.py \\
        --source-dsn postgresql://postgres:postgres@127.0.0.1:54322/postgres \\
        --bench-dsn  postgresql://postgres:postgres@127.0.0.1:54322/recall_bench \\
        --chunks 250000 --skew 0.002,0.02,0.2 --report recall-bench-report.json

    python scripts/build-recall-bench.py --teardown
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import io
import json
import math
import pathlib
import random
import sys
import time
import urllib.parse
import uuid
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

# ── the ONE safe target ───────────────────────────────────────────────────────

BENCH_DB_NAME = "recall_bench"
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})
_ACCEPTED_SCHEMES = frozenset({"postgres", "postgresql"})


class BenchTargetRefused(RuntimeError):
    """The requested target is not a loopback ``recall_bench`` database."""


def assert_bench_target(dsn: str) -> None:
    """Refuse anything that is not the throwaway bench on this machine.

    The comparison on the database name is ``==`` and never ``in``:
    ``recall_bench_prod`` and ``myrecall_bench`` are somebody's databases, and a
    substring match would hand them to an irreversible drop. The host must be loopback,
    because the right database name on the wrong cluster is still the wrong cluster.

    Raises ``BenchTargetRefused`` naming the offending host or database, so the refusal
    is readable in a terminal without re-reading this file.
    """
    parsed = urllib.parse.urlparse(dsn)

    if parsed.scheme.lower() not in _ACCEPTED_SCHEMES:
        raise BenchTargetRefused(
            f"refusing target {dsn!r}: scheme {parsed.scheme!r} is not a postgres URL "
            "(a keyword or unix-socket DSN cannot be proven loopback)"
        )

    host = parsed.hostname
    if not host:
        raise BenchTargetRefused(
            f"refusing target {dsn!r}: no host in the DSN, so it cannot be proven "
            f"loopback (allowed: {sorted(LOOPBACK_HOSTS)})"
        )
    if host.lower() not in LOOPBACK_HOSTS:
        raise BenchTargetRefused(
            f"refusing host {host!r}: the recall bench is LOCAL-ONLY and this host is "
            f"not loopback (allowed: {sorted(LOOPBACK_HOSTS)}). The right database "
            "name on the wrong cluster is still the wrong cluster."
        )

    database = parsed.path.lstrip("/")
    if "/" in database:
        raise BenchTargetRefused(
            f"refusing target {dsn!r}: the path {parsed.path!r} does not name exactly "
            "one database"
        )
    if database != BENCH_DB_NAME:
        raise BenchTargetRefused(
            f"refusing database {database!r}: only the throwaway {BENCH_DB_NAME!r} "
            "database may be built or dropped by this script. The check is equality, "
            f"never a substring, so {BENCH_DB_NAME}_prod is refused too."
        )


def maintenance_dsn(bench_dsn: str) -> str:
    """The same server, ``postgres`` database — the only place a database can be made.

    Derived from an already-validated bench DSN. Every destructive statement issued on
    this connection names the ``BENCH_DB_NAME`` constant, never a value parsed from a
    flag, so this helper cannot widen the target even if it were called with something
    unvalidated.
    """
    parsed = urllib.parse.urlparse(bench_dsn)
    return urllib.parse.urlunparse(parsed._replace(path="/postgres"))


# ── the prelude: THE DOCUMENTED DELTAS FROM PRODUCTION ────────────────────────

# ⛔⛔ REFUSAL COMMENT — do not lift the `auth` block below without this paragraph.
#
# The hand-rolled `auth.uid()` stub exists ONLY inside `recall_bench`; it must never be
# copied into `supabase/migrations/` nor into `full-schema.sql`, because production's
# `auth.uid()` is Supabase Auth's own and a hand-rolled one would be an authentication
# bypass on the 156 call sites that ask it who the caller is. It is created here, at
# build time, by a throwaway harness, precisely so that it can never reach a deploy
# artifact.
#
# It reads the exact GUC `_apply_rls_user_context` already sets in
# `backend/app/dependencies.py:150-155`, so the seven predicates inside
# `match_document_chunks` resolve in the bench the way they resolve in the app.
#
# The `storage` and publication blocks are NOT security-bearing: nothing in the
# retrieval path reads them. They exist because full-schema.sql's cross-schema
# supplement writes into objects a fresh database does not have, and a partial apply
# would poison every number downstream.
PRELUDE_SQL = """
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    email text,
    raw_user_meta_data jsonb
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(
           current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
           ''
         )::uuid;
$$;

CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    public boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1 : array_length(_parts, 1) - 1];
END
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
"""

# full-schema.sql installs `on_auth_user_created`, which provisions a personal org for
# every new auth.users row. The bench provisions its tenants EXPLICITLY, by design — the
# skew ladder is the whole point — so leaving that trigger installed would silently give
# every real and synthetic user a second org, and `current_user_org_ids()` would return
# two. Dropped after the apply, never before: the apply must still exercise it.
DROP_SIGNUP_TRIGGER_SQL = (
    "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users"
)

# Same operator class and same parameters as
# supabase/migrations/002_module2_byo_retrieval.sql:35-37. Built ONCE, after the bulk
# load — never incrementally, which would both be slower and give a different graph.
HNSW_INDEX_NAME = "document_chunks_embedding_idx"
HNSW_INDEX_SQL = (
    f"CREATE INDEX {HNSW_INDEX_NAME} ON public.document_chunks "
    "USING hnsw (embedding public.vector_cosine_ops) "
    "WITH (m='16', ef_construction='64')"
)

REQUIRED_ROUTINES = (
    "match_document_chunks",
    "keyword_search_chunks",
    "connection_doc_is_visible",
)

# Copied VERBATIM, parents first. `auth.users` carries ids only — see copy_auth_users.
VERBATIM_TABLES: tuple[tuple[str, str], ...] = (
    ("public", "organizations"),
    ("public", "org_members"),
    ("public", "folders"),
    ("public", "connector_connections"),
    ("public", "documents"),
    ("public", "document_chunks"),
)

# Never copied into the bench: a throwaway harness has no business holding ciphertext.
REDACTED_COLUMNS: dict[tuple[str, str], tuple[str, ...]] = {
    ("public", "connector_connections"): (
        "secret_ciphertext",
        "oauth_client_secret_ciphertext",
    ),
}

DOC_TYPES = ("invoice", "contract", "report", "email", "spec")
SOURCE_SYSTEMS = ("google", "microsoft", "notion", None)
VISIBILITIES = ("private", "org", "dept")
DEFAULT_MODEL = "text-embedding-3-small"
STALE_MODEL = "text-embedding-ada-002"

DOC_COPY_COLUMNS = (
    "id",
    "user_id",
    "filename",
    "file_path",
    "file_size",
    "mime_type",
    "status",
    "metadata",
    "folder_id",
    "is_latest",
    "org_id",
    "source_connection_id",
    "ingest_visibility",
)
CHUNK_COPY_COLUMNS = (
    "document_id",
    "user_id",
    "content",
    "chunk_index",
    "embedding",
    "embedding_model",
    "org_id",
)


@dataclass
class StageTimings:
    stages: list[tuple[str, float]] = field(default_factory=list)

    def record(self, name: str, seconds: float) -> None:
        self.stages.append((name, round(seconds, 3)))

    def as_dict(self) -> dict[str, float]:
        return dict(self.stages)


# ── driver plumbing ───────────────────────────────────────────────────────────


def _require_asyncpg():
    try:
        import asyncpg  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - environment, not logic
        raise SystemExit(
            "asyncpg is required and is already a backend dependency; run this with "
            "backend/venv/Scripts/python"
        ) from exc
    return asyncpg


async def connect(dsn: str, *, read_only: bool = False):
    asyncpg = _require_asyncpg()
    conn = await asyncpg.connect(dsn)
    if read_only:
        # T-241-08: the source is protected by the SERVER, not by convention. Any write
        # attempted against it fails with 25006 read_only_sql_transaction.
        await conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
        await conn.execute("SET default_transaction_read_only = on")
    return conn


def _line_of_offset(text: str, offset: int) -> int:
    return text.count("\n", 0, max(offset - 1, 0)) + 1


# ── create / teardown (both guarded) ──────────────────────────────────────────


async def create_bench_database(bench_dsn: str) -> None:
    """Recreate the bench from scratch. Guarded before anything irreversible runs."""
    assert_bench_target(bench_dsn)
    conn = await connect(maintenance_dsn(bench_dsn))
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{BENCH_DB_NAME}" WITH (FORCE)')
        await conn.execute(f'CREATE DATABASE "{BENCH_DB_NAME}"')
    finally:
        await conn.close()


async def teardown_bench_database(bench_dsn: str) -> None:
    """Remove the bench through the same guard, then prove it is gone."""
    assert_bench_target(bench_dsn)
    conn = await connect(maintenance_dsn(bench_dsn))
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{BENCH_DB_NAME}" WITH (FORCE)')
        still_there = await conn.fetchval(
            "SELECT count(*) FROM pg_database WHERE datname = $1", BENCH_DB_NAME
        )
        if still_there:
            raise RuntimeError(
                f"{BENCH_DB_NAME} is still present in pg_database after teardown"
            )
    finally:
        await conn.close()


# ── schema apply ──────────────────────────────────────────────────────────────


async def apply_full_schema(conn, schema_path: pathlib.Path) -> None:
    """Apply the project's own bootstrap artifact wholesale, failing loudly.

    This is the first thing that has ever exercised ``full-schema.sql`` end to end; a
    silent partial apply would poison every number downstream, so the first error is
    raised with the offending statement's LINE NUMBER in the artifact.
    """
    asyncpg = _require_asyncpg()
    sql = schema_path.read_text(encoding="utf-8")
    await conn.execute(PRELUDE_SQL)
    try:
        await conn.execute(sql)
    except asyncpg.PostgresError as exc:
        position = getattr(exc, "position", None)
        where = ""
        if position:
            line = _line_of_offset(sql, int(position))
            where = (
                f" at {schema_path.name}:{line}: {sql.splitlines()[line - 1].strip()!r}"
            )
        raise RuntimeError(
            f"full-schema.sql failed to apply{where} -- {type(exc).__name__}: {exc}"
        ) from exc
    await conn.execute(DROP_SIGNUP_TRIGGER_SQL)


async def assert_bench_schema_is_real(conn) -> dict[str, Any]:
    """The RPCs under measurement, and the HNSW index, are the real ones."""
    missing = [
        routine
        for routine in REQUIRED_ROUTINES
        if not await conn.fetchval(
            "SELECT count(*) FROM pg_proc p "
            "JOIN pg_namespace n ON n.oid = p.pronamespace "
            "WHERE n.nspname = 'public' AND p.proname = $1",
            routine,
        )
    ]
    if missing:
        raise RuntimeError(
            "the bench schema is not the real one -- missing routines: "
            + ", ".join(missing)
        )

    indexdef = await conn.fetchval(
        "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname=$1",
        HNSW_INDEX_NAME,
    )
    if not indexdef or "hnsw" not in indexdef:
        raise RuntimeError(f"{HNSW_INDEX_NAME} is missing or is not an HNSW index")
    normalised = indexdef.replace('"', "'")
    for expected in ("m='16'", "ef_construction='64'"):
        if expected not in normalised:
            raise RuntimeError(f"{HNSW_INDEX_NAME} does not carry {expected}: {indexdef}")
    return {"routines_present": list(REQUIRED_ROUTINES), "hnsw_indexdef": indexdef}


# ── verbatim copy of the real corpus ──────────────────────────────────────────


async def copyable_columns(conn, schema: str, table: str) -> list[tuple[str, str]]:
    """``(name, udt_name)`` for every column an INSERT may supply.

    Generated columns (``document_type_norm``, ``date_typed``) and tsvector columns
    (``search_vector``, filled by ``trg_update_search_vector``) are excluded so the
    bench computes them exactly as production does rather than carrying copies.
    """
    rows = await conn.fetch(
        """
        SELECT column_name, udt_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
          AND is_generated = 'NEVER'
          AND identity_generation IS NULL
          AND udt_name <> 'tsvector'
        ORDER BY ordinal_position
        """,
        schema,
        table,
    )
    return [(r["column_name"], r["udt_name"]) for r in rows]


def _select_expr(column: str, udt: str) -> str:
    # `vector` has no asyncpg codec; move it as text and cast back on the way in.
    return f'"{column}"::text' if udt == "vector" else f'"{column}"'


def _insert_placeholder(index: int, udt: str) -> str:
    return f"${index}::text::public.vector" if udt == "vector" else f"${index}"


async def copy_auth_users(source, bench) -> int:
    """Only the ids. No password hash, no email, no identity metadata.

    43 foreign keys point at ``auth.users``; the bench needs ids and nothing else, so
    nothing else crosses over.
    """
    rows = await source.fetch("SELECT id FROM auth.users")
    await bench.executemany(
        "INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING",
        [(r["id"],) for r in rows],
    )
    return len(rows)


async def copy_table_verbatim(
    source, bench, schema: str, table: str, batch_size: int
) -> int:
    """Stream one table across unchanged, in batches, through a server-side cursor."""
    columns = await copyable_columns(bench, schema, table)
    redacted = set(REDACTED_COLUMNS.get((schema, table), ()))
    select_list = ", ".join(
        "NULL::text" if c in redacted else _select_expr(c, u) for c, u in columns
    )
    placeholders = ", ".join(
        _insert_placeholder(i, u) for i, (_, u) in enumerate(columns, start=1)
    )
    collist = ", ".join(f'"{c}"' for c in (name for name, _ in columns))
    insert_sql = (
        f'INSERT INTO "{schema}"."{table}" ({collist}) VALUES ({placeholders}) '
        "ON CONFLICT DO NOTHING"
    )

    copied = 0
    batch: list[tuple] = []
    async with source.transaction():
        async for row in source.cursor(
            f'SELECT {select_list} FROM "{schema}"."{table}"', prefetch=batch_size
        ):
            batch.append(tuple(row))
            if len(batch) >= batch_size:
                await bench.executemany(insert_sql, batch)
                copied += len(batch)
                batch.clear()
    if batch:
        await bench.executemany(insert_sql, batch)
        copied += len(batch)
    return copied


async def copy_real_corpus(source, bench, batch_size: int) -> dict[str, int]:
    counts = {"auth.users": await copy_auth_users(source, bench)}
    for schema, table in VERBATIM_TABLES:
        counts[f"{schema}.{table}"] = await copy_table_verbatim(
            source, bench, schema, table, batch_size
        )
    return counts


# ── synthesis: perturbation, never a provider call ────────────────────────────


def parse_vector(text: str) -> list[float]:
    return [float(v) for v in text.strip()[1:-1].split(",")]


def format_vector(values: Sequence[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in values) + "]"


def perturb(vector: Sequence[float], sigma: float, rng: random.Random) -> list[float]:
    """A real embedding + per-dimension Gaussian noise, L2-renormalised.

    ⛔ This is the whole reason no provider is called. Uniform random vectors would make
    HNSW recall unrepresentative — there would be no cluster geometry for the graph to
    reflect — while a real embedding nudged by noise keeps the geometry and costs
    nothing. ``random.gauss`` is deliberate: numpy is not a declared dependency of this
    project and is imported nowhere under ``backend/app``.
    """
    noisy = [v + rng.gauss(0.0, sigma) for v in vector]
    norm = math.sqrt(sum(v * v for v in noisy))
    if norm == 0.0:
        return list(vector)
    return [v / norm for v in noisy]


def parse_skew(raw: str) -> list[float]:
    shares = [float(part) for part in raw.split(",") if part.strip()]
    if not shares:
        raise argparse.ArgumentTypeError("--skew needs at least one share")
    if any(s <= 0 for s in shares) or sum(shares) >= 1.0:
        raise argparse.ArgumentTypeError(
            f"--skew shares must be positive and sum to < 1.0 (got {shares})"
        )
    return sorted(shares)


def plan_tenants(
    total_chunks: int, real_chunks: int, shares: Sequence[float]
) -> list[dict]:
    """Chunk budget per synthetic tenant, plus the filler tenant that owns the rest.

    The filler is a SEPARATE org: its rows sit in the corpus and in the HNSW graph but
    outside a small tenant's org gate. That is the starvation mechanism, made concrete —
    a 40-candidate global scan spends its budget on rows the caller may not see.
    """
    tenants = [
        {
            "label": f"skew_{share:g}",
            "requested_share": share,
            "chunks": int(round(total_chunks * share)),
        }
        for share in shares
    ]
    assigned = sum(t["chunks"] for t in tenants)
    filler = total_chunks - real_chunks - assigned
    if filler < 0:
        raise SystemExit(
            f"--chunks {total_chunks} is too small for the requested skew plus the "
            f"{real_chunks} real chunks (need at least {real_chunks + assigned})"
        )
    tenants.append(
        {
            "label": "filler",
            "requested_share": round(filler / total_chunks, 6),
            "chunks": filler,
        }
    )
    return tenants


async def seed_tenant(bench, rng: random.Random, label: str) -> dict:
    """One synthetic org + user + membership + two folders + one connection."""
    org_id = await bench.fetchval(
        "INSERT INTO public.organizations (name, slug) VALUES ($1, $2) RETURNING id",
        f"bench-{label}",
        f"bench-{label}-{rng.randrange(10**9)}",
    )
    user_id = uuid.UUID(int=rng.getrandbits(128), version=4)
    await bench.execute("INSERT INTO auth.users (id) VALUES ($1)", user_id)
    await bench.execute(
        "INSERT INTO public.org_members (org_id, user_id, role) "
        "VALUES ($1, $2, 'member')",
        org_id,
        user_id,
    )
    folders = [
        await bench.fetchval(
            "INSERT INTO public.folders (user_id, name, is_org_shared, org_id) "
            "VALUES ($1, $2, $3, $4) RETURNING id",
            user_id,
            f"{label}-{name}",
            shared,
            org_id,
        )
        for name, shared in (("shared", True), ("private", False))
    ]
    connection_id = await bench.fetchval(
        "INSERT INTO public.connector_connections "
        "(org_id, created_by, name, service_id, auth_type) "
        "VALUES ($1, $2, $3, 'bench_source', 'static_key') RETURNING id",
        org_id,
        user_id,
        f"bench-{label}-connection",
    )
    return {
        "label": label,
        "org_id": org_id,
        "user_id": user_id,
        "folders": folders,
        "connection_id": connection_id,
    }


def synthetic_metadata(index: int, rng: random.Random) -> str:
    """Varied so `metadata @>` and the nested `source.system` axis both discriminate."""
    system = SOURCE_SYSTEMS[index % len(SOURCE_SYSTEMS)]
    payload: dict[str, Any] = {
        "title": f"bench synthetic document {index}",
        "document_type": DOC_TYPES[index % len(DOC_TYPES)],
        "language": "en" if index % 7 else "de",
    }
    if system is not None:
        payload["source"] = {
            "system": system,
            "path": f"/bench/{system}/{index}",
            "version": rng.randrange(1, 4),
            "external_id": f"bench-{index}",
        }
    return json.dumps(payload, separators=(",", ":"))


def _csv_batch(rows: Iterable[Sequence[Any]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    for row in rows:
        writer.writerow(["" if value is None else value for value in row])
    return buffer.getvalue().encode("utf-8")


async def _copy_csv(conn, table: str, columns: Sequence[str], rows: list[Sequence[Any]]):
    if not rows:
        return
    await conn.copy_to_table(
        table,
        schema_name="public",
        columns=list(columns),
        source=io.BytesIO(_csv_batch(rows)),
        format="csv",
    )


def _document_row(tenant: dict, index: int, rng: random.Random) -> tuple:
    """One synthetic document, varied so ALL SEVEN predicates actually discriminate.

    A bench where every row passes every predicate measures nothing about filtering.
    """
    foldered = index % 3 != 0
    from_connection = index % 2 == 0
    return (
        str(uuid.UUID(int=rng.getrandbits(128), version=4)),
        str(tenant["user_id"]),
        f"bench-{tenant['label']}-{index}.txt",
        f"/bench/{tenant['label']}/{index}.txt",
        1024,
        "text/plain",
        "completed",
        synthetic_metadata(index, rng),
        str(tenant["folders"][index % len(tenant["folders"])]) if foldered else None,
        "f" if index % 20 == 0 else "t",  # ~5% superseded -> is_latest = false
        str(tenant["org_id"]),
        str(tenant["connection_id"]) if from_connection else None,
        VISIBILITIES[index % len(VISIBILITIES)] if from_connection else "private",
    )


async def synthesize_tenant_chunks(
    bench,
    tenant: dict,
    chunk_budget: int,
    vector_pool: Sequence[str],
    sigma: float,
    rng: random.Random,
    chunks_per_doc: int,
    batch_size: int,
) -> int:
    """Fill a tenant's chunk budget by perturbing real embeddings. No provider call."""
    inserted = 0
    doc_index = 0
    doc_batch: list[Sequence[Any]] = []
    chunk_batch: list[Sequence[Any]] = []

    while inserted < chunk_budget:
        document = _document_row(tenant, doc_index, rng)
        doc_batch.append(document)
        document_id = document[0]
        for chunk_index in range(min(chunks_per_doc, chunk_budget - inserted)):
            base = parse_vector(rng.choice(vector_pool))
            chunk_batch.append(
                (
                    document_id,
                    str(tenant["user_id"]),
                    f"bench chunk {tenant['label']} {doc_index}/{chunk_index}",
                    chunk_index,
                    format_vector(perturb(base, sigma, rng)),
                    # ~2% carry a stale model so the D-10 filter has something to reject
                    STALE_MODEL if inserted % 50 == 0 else DEFAULT_MODEL,
                    str(tenant["org_id"]),
                )
            )
            inserted += 1
        doc_index += 1

        if len(chunk_batch) >= batch_size:
            await _copy_csv(bench, "documents", DOC_COPY_COLUMNS, doc_batch)
            await _copy_csv(bench, "document_chunks", CHUNK_COPY_COLUMNS, chunk_batch)
            doc_batch.clear()
            chunk_batch.clear()

    await _copy_csv(bench, "documents", DOC_COPY_COLUMNS, doc_batch)
    await _copy_csv(bench, "document_chunks", CHUNK_COPY_COLUMNS, chunk_batch)
    return inserted


# ── report ────────────────────────────────────────────────────────────────────


async def measure_sizes(conn) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        SELECT pg_total_relation_size('public.document_chunks') AS chunks_bytes,
               pg_relation_size($1::regclass)                   AS hnsw_bytes,
               (SELECT count(*) FROM public.document_chunks)    AS chunk_count,
               (SELECT count(*) FROM public.documents)          AS document_count
        """,
        f"public.{HNSW_INDEX_NAME}",
    )
    return {
        "document_chunks_bytes": row["chunks_bytes"],
        "document_chunks_mb": round(row["chunks_bytes"] / 1024 / 1024, 1),
        "hnsw_index_bytes": row["hnsw_bytes"],
        "hnsw_index_mb": round(row["hnsw_bytes"] / 1024 / 1024, 1),
        "chunk_count": row["chunk_count"],
        "document_count": row["document_count"],
    }


async def measure_tenant_shares(conn) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT o.name AS org,
               count(*) AS chunks,
               count(*)::float
                 / NULLIF((SELECT count(*) FROM public.document_chunks), 0) AS share
        FROM public.document_chunks dc
        JOIN public.organizations o ON o.id = dc.org_id
        GROUP BY o.name
        ORDER BY chunks
        """
    )
    return [
        {"org": r["org"], "chunks": r["chunks"], "achieved_share": round(r["share"] or 0.0, 6)}
        for r in rows
    ]


async def source_corpus_counts(source) -> dict[str, int]:
    row = await source.fetchrow(
        "SELECT (SELECT count(*) FROM public.documents) AS documents, "
        "       (SELECT count(*) FROM public.document_chunks) AS chunks"
    )
    return {"documents": row["documents"], "chunks": row["chunks"]}


# ── entry point ───────────────────────────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="build-recall-bench.py",
        description=(
            "Build (or tear down) the throwaway recall_bench database on the local "
            "Docker Postgres. Never writes to the operator's real database."
        ),
    )
    parser.add_argument(
        "--source-dsn",
        default="postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        help="the operator's real local database -- opened READ ONLY at the server",
    )
    parser.add_argument(
        "--bench-dsn",
        default=f"postgresql://postgres:postgres@127.0.0.1:54322/{BENCH_DB_NAME}",
        help=f"the bench target -- must be a loopback {BENCH_DB_NAME} database",
    )
    parser.add_argument("--chunks", type=int, default=250000, help="target chunk count")
    parser.add_argument(
        "--skew",
        type=parse_skew,
        default="0.002,0.02,0.2",
        help="comma-separated tenant chunk shares of the WHOLE corpus",
    )
    parser.add_argument(
        "--sigma", type=float, default=0.15, help="perturbation noise sigma"
    )
    parser.add_argument(
        "--seed", type=int, default=241, help="fixed by default so two builds compare"
    )
    parser.add_argument("--chunks-per-doc", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument(
        "--vector-pool",
        type=int,
        default=2000,
        help="how many real embeddings to hold in memory as perturbation sources",
    )
    parser.add_argument(
        "--schema",
        type=pathlib.Path,
        default=pathlib.Path(__file__).resolve().parents[1]
        / "supabase"
        / "full-schema.sql",
        help="the bootstrap artifact the bench is built from",
    )
    parser.add_argument(
        "--teardown", action="store_true", help="remove the bench and exit"
    )
    parser.add_argument("--report", type=pathlib.Path, help="write the report as JSON")
    return parser


async def _run_teardown(args: argparse.Namespace) -> int:
    source = await connect(args.source_dsn, read_only=True)
    try:
        before = await source_corpus_counts(source)
        await teardown_bench_database(args.bench_dsn)
        after = await source_corpus_counts(source)
    finally:
        await source.close()
    print(f"torn down: {BENCH_DB_NAME} is absent from pg_database")
    print(f"source before: {before}")
    print(f"source after : {after}")
    if before != after:
        print("FAIL: the source corpus changed across teardown", file=sys.stderr)
        return 1
    return 0


async def run(args: argparse.Namespace) -> int:
    assert_bench_target(args.bench_dsn)
    if args.teardown:
        return await _run_teardown(args)

    rng = random.Random(args.seed)
    timings = StageTimings()
    shares = args.skew if isinstance(args.skew, list) else parse_skew(args.skew)

    source = await connect(args.source_dsn, read_only=True)
    try:
        source_before = await source_corpus_counts(source)
        source_read_only = await source.fetchval("SHOW default_transaction_read_only")

        t0 = time.perf_counter()
        await create_bench_database(args.bench_dsn)
        timings.record("create_database", time.perf_counter() - t0)

        bench = await connect(args.bench_dsn)
        try:
            t0 = time.perf_counter()
            await apply_full_schema(bench, args.schema)
            schema_facts = await assert_bench_schema_is_real(bench)
            timings.record("apply_full_schema", time.perf_counter() - t0)

            await bench.execute(f"DROP INDEX IF EXISTS public.{HNSW_INDEX_NAME}")

            t0 = time.perf_counter()
            copied = await copy_real_corpus(source, bench, args.batch_size)
            timings.record("copy_real_corpus", time.perf_counter() - t0)

            vector_pool = [
                r["embedding"]
                for r in await bench.fetch(
                    "SELECT embedding::text AS embedding FROM public.document_chunks "
                    "WHERE embedding IS NOT NULL ORDER BY id LIMIT $1",
                    args.vector_pool,
                )
            ]
            if not vector_pool:
                raise RuntimeError(
                    "no real embeddings were copied -- every synthetic vector is a "
                    "PERTURBATION of a real one, so there is nothing to perturb"
                )

            real_chunks = copied.get("public.document_chunks", 0)
            tenants = plan_tenants(args.chunks, real_chunks, shares)

            t0 = time.perf_counter()
            for plan in tenants:
                if plan["chunks"] <= 0:
                    continue
                tenant = await seed_tenant(bench, rng, plan["label"])
                await synthesize_tenant_chunks(
                    bench,
                    tenant,
                    plan["chunks"],
                    vector_pool,
                    args.sigma,
                    rng,
                    args.chunks_per_doc,
                    args.batch_size,
                )
            timings.record("synthesize", time.perf_counter() - t0)

            t0 = time.perf_counter()
            await bench.execute(HNSW_INDEX_SQL)
            await bench.execute("ANALYZE public.document_chunks")
            timings.record("build_hnsw_index", time.perf_counter() - t0)

            await assert_bench_schema_is_real(bench)
            sizes = await measure_sizes(bench)
            achieved = await measure_tenant_shares(bench)
        finally:
            await bench.close()

        source_after = await source_corpus_counts(source)
    finally:
        await source.close()

    report = {
        "bench_database": BENCH_DB_NAME,
        "seed": args.seed,
        "sigma": args.sigma,
        "requested_chunks": args.chunks,
        "requested_skew": shares,
        "tenant_plan": tenants,
        "copied_verbatim": copied,
        "schema": schema_facts,
        "sizes": sizes,
        "achieved_tenant_shares": achieved,
        "stage_seconds": timings.as_dict(),
        "source_corpus_before": source_before,
        "source_corpus_after": source_after,
        "source_default_transaction_read_only": source_read_only,
        "provider_calls": 0,
    }
    print(json.dumps(report, indent=2, default=str))
    if args.report:
        args.report.write_text(
            json.dumps(report, indent=2, default=str), encoding="utf-8"
        )
        print(f"report written: {args.report}")

    if source_before != source_after:
        print("FAIL: the operator's corpus changed during the build", file=sys.stderr)
        return 1
    return 0


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(list(argv) if argv is not None else None)
    return asyncio.run(run(args))


if __name__ == "__main__":
    raise SystemExit(main())
