"""Phase 241 Plan 01 — the recall measurement. Two layers, one refusal, no invented numbers.

Replaces the Phase 230 harness IN PLACE (D-01). What was here measured nothing: its sibling
CLI ran ``content ILIKE`` over ``document_chunks`` — no embedding, no ``match_document_chunks``,
no filter, no vector — scored every un-found target as a top hit, and on a connection failure
printed a hardcoded synthetic benchmark and returned 0. Against the real corpus it printed
``MRR 1.000``, and it was structurally incapable of printing anything else (241-CONTEXT F-1).

Two layers, because SC#1 and SC#2 are different questions (D-04):

  **Layer 1 — mechanical.** For each query vector × each entry in :data:`FILTER_SHAPES`, call
  ``public.match_document_chunks`` TWICE with *identical* arguments: an **exact** arm with the
  planner forbidden the index (true k-NN), and an **ann** arm with the planner untouched.
  Report ``recall_at_k = |ann ∩ exact| / |exact|`` on chunk ids and ``underfill = 1 − |ann|/k``.

  ⚠ **D-05: the exact arm is exact k-NN UNDER THE SAME PREDICATE, never an unfiltered query.**
  ``match_document_chunks`` applies SEVEN predicates inside its ``ORDER BY … <=> … LIMIT`` scan
  (org gate, the three-arm visibility predicate, threshold, ``is_latest``, ``metadata @>``,
  ``p_folder_ids``, ``p_embedding_model``) and the last two always fire. **There is no unfiltered
  path in this product** (F-4), so SC#2 cannot be read as filtered-vs-unfiltered. The two arms
  differ in exactly one thing: whether the planner may use the HNSW index.

  ⚠ ``|exact|`` can legitimately be SMALLER than ``k`` — the ``match_threshold`` predicate cuts
  before ``LIMIT``. Divide by ``|exact|``; when ``|exact|`` is 0 emit ``None`` with the reason,
  never ``1.0``. A ratio with an empty denominator is the shape that made the old harness perfect.

  **Layer 2 — semantic.** The ten :data:`EVAL_PROBES` driven through the real path, the target's
  1-based first-occurrence DOCUMENT position scored — **or ``None`` when it is absent. There is
  no other outcome** (D-02).

**The refusal (D-03).** Every failure to reach the database, to establish the caller's role, or
to obtain query vectors raises :class:`RecallUnmeasurable`. No function here returns metrics on
an error path and none prints. *Could not measure* and *measured, and it was fine* never share an
exit code — the third application of a rule this codebase already holds twice
(``retrieval_unavailable`` in ``tool_dispatcher.py``; Phase 193.1's
``resolve_template_placeholders``).

**Import-safe by construction.** No module-scope DSN, no module-scope connection, no side effect
at import: ``backend/tests/unit/test_241_recall_harness_honesty.py`` imports this module with no
database, no network and no environment variable present.
"""

from __future__ import annotations

import json
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator, Sequence

import asyncpg

# ─────────────────────────────────────────────────────────────────────────────
# The probe set — the ONE definition site (D-01)
#
# It used to be duplicated VERBATIM across this module and scripts/measure-recall.py, which is
# drift waiting to happen. The CLI now imports this name; a source fence in the honesty guard
# asserts it owns no second copy.
# ─────────────────────────────────────────────────────────────────────────────

# Standard 10-query evaluation probe set over the 77 baseline documents
EVAL_PROBES = [
    {
        "query": "Northwind quarterly business review September 2026",
        "target_filename": "northwind-qbr-notes-sept-2026.md",
    },
    {
        "query": "commercial contract renewal Northwind pricing terms",
        "target_filename": "northwind-commercials-renewal.md",
    },
    {
        "query": "UAE Credit Reports BNPL buy now pay later and micro loan",
        "target_filename": "Update UAE Credit Reports now include BNPL and micro-loan information.eml",
    },
    {
        "query": "Project risks, mitigations and probability impact log",
        "target_filename": "risk-log.md",
    },
    {
        "query": "Triangulation research methodology with visuals",
        "target_filename": "Triangulation_Research_Complete_with_Visuals.docx",
    },
    {
        "query": "metrics decisions knowledge base document 3",
        "target_filename": "kb_doc3_metrics_decisions.md",
    },
    {
        "query": "uat111 axisa minimax integration testing",
        "target_filename": "uat111_axisa_minimax.md",
    },
    {
        "query": "uat111 axisa zhipu provider evaluation",
        "target_filename": "uat111_axisa_zhipu.md",
    },
    {
        "query": "supplier rate card and master rate sheet takeoff",
        "target_filename": "sample_master_rate_sheet.xlsx",
    },
    {
        "query": "board pack presentation 2026 Q3 agenda and governance",
        "target_filename": "2026 Q3 board pack.pdf",
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# The kept arithmetic
#
# ⭐ KEPT BYTE-IDENTICAL. This is the one part of the Phase 230 work that does its job: it
# already treats ``None`` as a miss and its Hit@K / MRR arithmetic is already correct. The defect
# was entirely in what FED it. Do not "improve" this function — the honesty guard ports the three
# cases that used to prove it, and the plan proves the body's md5 across this rewrite.
# ─────────────────────────────────────────────────────────────────────────────

def compute_metrics(ranks: Sequence[int | None]) -> dict[str, float]:
    """Compute Hit@1, Hit@3, Hit@5, and MRR from a sequence of 1-indexed ranks."""
    if not ranks:
        return {"hit_at_1": 0.0, "hit_at_3": 0.0, "hit_at_5": 0.0, "mrr": 0.0}

    hit_1 = sum(1 for r in ranks if r is not None and r <= 1) / len(ranks)
    hit_3 = sum(1 for r in ranks if r is not None and r <= 3) / len(ranks)
    hit_5 = sum(1 for r in ranks if r is not None and r <= 5) / len(ranks)
    mrr = sum(1.0 / r for r in ranks if r is not None and r > 0) / len(ranks)

    return {
        "hit_at_1": round(hit_1, 4),
        "hit_at_3": round(hit_3, 4),
        "hit_at_5": round(hit_5, 4),
        "mrr": round(mrr, 4),
    }


# ─────────────────────────────────────────────────────────────────────────────
# The refusal
# ─────────────────────────────────────────────────────────────────────────────

class RecallUnmeasurable(RuntimeError):
    """Raised whenever a number cannot be honestly produced.

    Nothing in this module returns metrics on an error path. A caller that sees this exception
    has learned *could not measure* — which is a different fact from *measured, and it was fine*,
    and must never be collapsed into the same exit code (D-03).
    """


# ─────────────────────────────────────────────────────────────────────────────
# DSN handling — T-241-01: host and database travel, the credential never does
# ─────────────────────────────────────────────────────────────────────────────

def describe_dsn(dsn: str) -> dict[str, Any]:
    """Summarise a DSN as host + port + database. **The user and password are dropped.**

    This is the ONLY shape of a DSN allowed into a printed line, a report field or an exception
    message. The DSN crosses on ``argv`` carrying a password; nothing downstream needs it.
    """
    from urllib.parse import urlsplit

    parts = urlsplit(dsn)
    return {
        "host": parts.hostname or "",
        "port": parts.port,
        "database": (parts.path or "").lstrip("/"),
    }


def dsn_label(dsn: str) -> str:
    """A one-line, credential-free label for the target database."""
    described = describe_dsn(dsn)
    port = described["port"]
    host = described["host"] + (f":{port}" if port else "")
    return f"{host}/{described['database']}"


def _redact(text: str, dsn: str) -> str:
    """Blank the DSN's password out of arbitrary text before it is surfaced.

    Driver exceptions quote the connection they failed on. Rather than trust that they never
    echo the credential, remove it explicitly — a redaction that runs is worth more than an
    assumption that does not.
    """
    from urllib.parse import urlsplit

    password = urlsplit(dsn).password
    cleaned = text
    if password:
        cleaned = cleaned.replace(password, "***")
    return cleaned


# ─────────────────────────────────────────────────────────────────────────────
# Scoring — a miss is None, and it is the ONLY other outcome (D-02)
# ─────────────────────────────────────────────────────────────────────────────

def rank_target(rows: Sequence[Any], target_document_id: str | None) -> int | None:
    """1-based position of ``target_document_id`` in first-occurrence DOCUMENT order, or ``None``.

    The RPC returns CHUNKS, so a document with three hits must not occupy three ranks. Collapse
    to the order in which each document first appears, then read the target's position.

    ⛔ There is no third branch. An absent target is ``None``; it is never scored as a hit, and
    a probe whose target does not exist in this database at all is excluded upstream rather than
    given a number here.
    """
    if target_document_id is None:
        return None

    order: list[str] = []
    for row in rows:
        document_id = str(row["document_id"])
        if document_id not in order:
            order.append(document_id)

    target = str(target_document_id)
    return order.index(target) + 1 if target in order else None


def score_probe_ranks(
    rows_per_probe: Sequence[Sequence[Any]],
    target_ids: Sequence[str | None],
) -> list[int | None]:
    """Score a whole probe set. Pure: no database, no I/O, no clock."""
    if len(rows_per_probe) != len(target_ids):
        raise ValueError(
            f"probe/target arity mismatch: {len(rows_per_probe)} result sets, {len(target_ids)} targets"
        )
    return [rank_target(rows, tid) for rows, tid in zip(rows_per_probe, target_ids)]


# ─────────────────────────────────────────────────────────────────────────────
# SC#2's filter axes, as DATA (D-13)
#
# Three axes are reachable through the shipped RPC and are measured. Two that SC#2 names —
# connection-by-id and saved View — are NOT metadata keys and no surface would invoke them, so
# they are not built here: a filter exercised by the harness and by nothing else is a green fence
# beside no behaviour. SC#2 is scored honestly-partial, with the reason, in VALIDATION.md.
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class FilterShape:
    """One SC#2 axis: the two RPC arguments it varies, and how to bind a live value to them."""

    name: str
    description: str
    metadata_key: str | None = None
    metadata_nested_key: str | None = None
    needs_folder: bool = False


FILTER_SHAPES: tuple[FilterShape, ...] = (
    FilterShape(
        name="none",
        description="baseline — metadata_filter and p_folder_ids both NULL",
    ),
    FilterShape(
        name="folder",
        description="p_folder_ids bound to one real folder id",
        needs_folder=True,
    ),
    FilterShape(
        name="metadata",
        description="metadata @> {document_type: <a live value>}",
        metadata_key="document_type",
    ),
    FilterShape(
        name="source_system",
        description="metadata @> {source: {system: <a live value>}} — nested jsonb containment",
        metadata_key="source",
        metadata_nested_key="system",
    ),
)


# ─────────────────────────────────────────────────────────────────────────────
# Defaults. None of these is a DSN, and none of them is secret.
# ─────────────────────────────────────────────────────────────────────────────

# The migration-073 backfill tagged pre-existing chunks with this model, and retrieval_service
# defaults to it when no model is configured (D-10). Measuring under a different model would
# silently compare across vector spaces.
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"

# The RPC's own default, and the value production passes.
DEFAULT_MATCH_THRESHOLD = 0.3

# ``hybrid_candidate_count`` (config.py) — the k the product actually asks for.
DEFAULT_K = 20

DEFAULT_QUERY_VECTOR_COUNT = 25
DEFAULT_QUERY_VECTOR_SEED = "241"

# ``hnsw.iterative_scan`` is a GUC whose value cannot be a bind parameter, so it is interpolated
# — and therefore it is ALLOW-LISTED rather than validated (T-241-02). An unknown value is a
# refusal, never a pass-through.
ITERATIVE_SCAN_VALUES = ("off", "relaxed_order", "strict_order")

_PLANNER_GUCS = ("enable_indexscan", "enable_indexonlyscan", "enable_bitmapscan")

# The production call shape, verbatim from retrieval_service._vector_search. Positional args map
# the migration-073 signature order; the embedding is a pgvector LITERAL cast ``$1::public.vector``
# because the asyncpg connection registers a jsonb codec only and has NO vector codec.
_MATCH_SQL = """SELECT id::text AS id, document_id::text AS document_id, similarity
   FROM public.match_document_chunks($1::public.vector, $2, $3, $4, $5, $6, $7)"""


def vector_literal(embedding: Sequence[float]) -> str:
    """Format a float embedding as a pgvector literal — the ``retrieval_service`` rule."""
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


# ─────────────────────────────────────────────────────────────────────────────
# The measuring connection
# ─────────────────────────────────────────────────────────────────────────────

async def _apply_measuring_context(conn: asyncpg.Connection, user_id: str) -> None:
    """Impersonate a real caller so the DEFINER body resolves a real identity.

    ⚠ **A measurement taken as ``postgres``/owner returns ZERO ROWS and would read as total
    recall failure.** ``match_document_chunks`` is ``SECURITY DEFINER`` with ``search_path``
    emptied, and its org gate + visibility predicate both call ``auth.uid()`` /
    ``current_user_org_ids()``. On an owner connection ``auth.uid()`` is NULL, the org set is
    empty, and every query honestly returns nothing — which is indistinguishable from a broken
    index unless you know to look.

    ⛔ The idiom is COPIED from ``dependencies.py:145-155`` and must never be re-derived: role
    first, then BOTH GUC forms (the per-claim ``request.jwt.claim.sub`` and the JSON blob
    ``request.jwt.claims``), both parameterized, all with ``is_local := true`` so they revert at
    transaction end.
    """
    await conn.execute("SET LOCAL ROLE authenticated")
    await conn.execute(
        "SELECT set_config('request.jwt.claim.sub', $1, true)", str(user_id)
    )
    await conn.execute(
        "SELECT set_config('request.jwt.claims', $1, true)",
        json.dumps({"sub": str(user_id), "role": "authenticated"}),
    )


@asynccontextmanager
async def measuring_connection(
    dsn: str, user_id: str, *, timeout: float = 10.0
) -> AsyncIterator[asyncpg.Connection]:
    """Open ONE read-only measuring transaction, or refuse.

    Registers the same jsonb codec the app's pool registers, so ``metadata_filter`` crosses as a
    bind parameter encoded ONCE by the driver (T-241-02). A pre-encoded string would double-encode
    — the recorded jsonb string-scalar trap.
    """
    try:
        conn = await asyncpg.connect(dsn, timeout=timeout)
    except Exception as exc:
        raise RecallUnmeasurable(
            f"could not measure: no usable connection to {dsn_label(dsn)} "
            f"({type(exc).__name__}: {_redact(str(exc), dsn)})"
        ) from exc

    try:
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
        )
        async with conn.transaction():
            try:
                await _apply_measuring_context(conn, user_id)
            except Exception as exc:
                raise RecallUnmeasurable(
                    f"could not measure: reached {dsn_label(dsn)} but failed to establish the "
                    f"caller's role and claims ({type(exc).__name__}: {_redact(str(exc), dsn)})"
                ) from exc
            yield conn
    finally:
        await conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Server + corpus provenance — T-241-06: a number without its configuration is an anecdote
# ─────────────────────────────────────────────────────────────────────────────

async def read_server_facts(conn: asyncpg.Connection) -> dict[str, Any]:
    """The live configuration this measurement was taken under.

    Read BEFORE any ``SET LOCAL`` in the layers, so these are the server's own values and not
    the ones this run asked for.
    """
    return {
        "postgresql_version": await conn.fetchval("SHOW server_version"),
        "pgvector_version": await conn.fetchval(
            "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
        ),
        "hnsw_ef_search": await conn.fetchval("SELECT current_setting('hnsw.ef_search', true)"),
        "hnsw_iterative_scan": await conn.fetchval(
            "SELECT current_setting('hnsw.iterative_scan', true)"
        ),
    }


async def read_corpus_counts(conn: asyncpg.Connection) -> dict[str, int]:
    """Corpus size AS THIS CALLER SEES IT. Reported, never asserted.

    ⛔ These numbers belong in the report and nowhere else. ``assert count == 77`` was RED
    against 159 live documents and invisible to the canonical gate — pinning an environment fact
    in a test is the mistake this whole rewrite exists to retire (D-06).
    """
    return {
        "documents_visible": await conn.fetchval("SELECT count(*) FROM public.documents"),
        "documents_latest": await conn.fetchval(
            "SELECT count(*) FROM public.documents WHERE is_latest = true"
        ),
        "chunks_visible": await conn.fetchval("SELECT count(*) FROM public.document_chunks"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Layer 1 — mechanical: exact k-NN vs ANN, under the SAME predicate
# ─────────────────────────────────────────────────────────────────────────────

async def sample_query_vectors(
    conn: asyncpg.Connection,
    *,
    count: int = DEFAULT_QUERY_VECTOR_COUNT,
    seed: str = DEFAULT_QUERY_VECTOR_SEED,
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
) -> list[str]:
    """Sample N real embeddings as pgvector literals. **No provider call, no cost.**

    Real vectors, not uniform random ones: HNSW recall is a function of the corpus's cluster
    geometry, so a synthetic query vector would measure an index that nobody queries.

    The ordering is a deterministic hash of the row id and the seed, so two runs against the same
    database draw the SAME sample and a before/after pair is comparable. The seed and the size are
    both written into the report.
    """
    rows = await conn.fetch(
        """SELECT dc.embedding::text AS vec
           FROM public.document_chunks dc
           WHERE dc.embedding IS NOT NULL
             AND ($3::text IS NULL OR dc.embedding_model = $3)
           ORDER BY md5(dc.id::text || $1)
           LIMIT $2""",
        str(seed),
        int(count),
        embedding_model,
    )
    if not rows:
        raise RecallUnmeasurable(
            "could not measure: no embedded chunks are visible to this caller, so there is "
            "nothing to sample a query vector from. Check --user-id names a user with documents."
        )
    return [row["vec"] for row in rows]


async def resolve_filter_shape(
    conn: asyncpg.Connection, shape: FilterShape
) -> tuple[dict | None, list[str] | None, str | None]:
    """Bind a shape's live values. Returns ``(metadata_filter, folder_ids, skip_reason)``.

    A shape whose axis has no live value in this database is SKIPPED with a stated reason — it is
    never silently dropped and never scored. An axis that could not be exercised is a different
    fact from an axis that was exercised and passed.
    """
    if shape.needs_folder:
        folder_id = await conn.fetchval(
            """SELECT d.folder_id::text
               FROM public.documents d
               WHERE d.folder_id IS NOT NULL AND d.is_latest = true
               ORDER BY d.folder_id
               LIMIT 1"""
        )
        if folder_id is None:
            return None, None, "no foldered document is visible to this caller"
        return None, [folder_id], None

    if shape.metadata_key and shape.metadata_nested_key:
        value = await conn.fetchval(
            """SELECT d.metadata -> $1 ->> $2
               FROM public.documents d
               WHERE d.is_latest = true AND d.metadata -> $1 ? $2
               ORDER BY d.metadata -> $1 ->> $2
               LIMIT 1""",
            shape.metadata_key,
            shape.metadata_nested_key,
        )
        if value is None:
            return (
                None,
                None,
                f"no visible document carries metadata->{shape.metadata_key}->{shape.metadata_nested_key}",
            )
        return {shape.metadata_key: {shape.metadata_nested_key: value}}, None, None

    if shape.metadata_key:
        value = await conn.fetchval(
            """SELECT d.metadata ->> $1
               FROM public.documents d
               WHERE d.is_latest = true AND d.metadata ? $1
               ORDER BY d.metadata ->> $1
               LIMIT 1""",
            shape.metadata_key,
        )
        if value is None:
            return None, None, f"no visible document carries metadata->{shape.metadata_key}"
        return {shape.metadata_key: value}, None, None

    return None, None, None


async def _set_planner(conn: asyncpg.Connection, *, use_index: bool) -> None:
    """Force the exact arm off the index, or hand the ann arm back to the planner.

    ⚠ ``SET LOCAL`` only — T-241-04. These revert at transaction end, so a forced sequential scan
    cannot leak onto another connection or outlive this measurement.
    """
    value = "on" if use_index else "off"
    for guc in _PLANNER_GUCS:
        await conn.execute(f"SET LOCAL {guc} = {value}")


async def _apply_hnsw_knobs(
    conn: asyncpg.Connection, *, ef_search: int | None, iterative_scan: str | None
) -> None:
    """Apply the two remedy knobs to the ann arm, if the caller asked for them.

    A GUC value cannot be a bind parameter, so both are interpolated — and both are therefore
    constrained first: ``ef_search`` through ``int()`` and a range, ``iterative_scan`` through a
    closed allow-list. An unknown value refuses (T-241-02).

    ⛔ THAT SENTENCE USED TO BE FALSE OF THIS FUNCTION (241-REVIEW WR-08). ``validate_knobs``
    was called only by :func:`run_measurement`, while :func:`measure_layer1` and
    :func:`measure_layer2` are PUBLIC, take ``iterative_scan: str | None`` and passed it
    straight through -- so::

        measure_layer1(conn, ..., iterative_scan="'; DROP TABLE public.documents --")

    executed ``SET LOCAL hnsw.iterative_scan = ''; DROP TABLE public.documents --'``
    verbatim, on a connection carrying ``SET LOCAL ROLE authenticated``. Measured through the
    public entry point, not supposed.

    The fix is to validate WHERE THE INTERPOLATION HAPPENS, which is also what makes the
    docstring true. ``validate_knobs`` is idempotent, so ``run_measurement`` -- which already
    validates before it gets here -- is unchanged by it.
    """
    checked_ef, checked_scan = validate_knobs(ef_search, iterative_scan)
    if checked_ef is not None:
        await conn.execute(f"SET LOCAL hnsw.ef_search = {checked_ef}")
    if checked_scan is not None:
        await conn.execute(f"SET LOCAL hnsw.iterative_scan = '{checked_scan}'")


def validate_knobs(ef_search: Any, iterative_scan: Any) -> tuple[int | None, str | None]:
    """Constrain the two interpolated GUC values, or refuse. T-241-02."""
    checked_ef: int | None = None
    if ef_search is not None:
        try:
            checked_ef = int(ef_search)
        except (TypeError, ValueError) as exc:
            raise RecallUnmeasurable(f"--ef-search must be an integer, got {ef_search!r}") from exc
        if not 1 <= checked_ef <= 10000:
            raise RecallUnmeasurable(
                f"--ef-search must be between 1 and 10000, got {checked_ef}"
            )

    checked_scan: str | None = None
    if iterative_scan is not None:
        checked_scan = str(iterative_scan)
        if checked_scan not in ITERATIVE_SCAN_VALUES:
            raise RecallUnmeasurable(
                f"--iterative-scan must be one of {ITERATIVE_SCAN_VALUES}, got {checked_scan!r}"
            )

    return checked_ef, checked_scan


async def _match(
    conn: asyncpg.Connection,
    *,
    query_vector: str,
    user_id: str,
    k: int,
    match_threshold: float,
    metadata_filter: dict | None,
    folder_ids: list[str] | None,
    embedding_model: str | None,
) -> list[Any]:
    """One call to the shipped RPC. Every filter value is a BIND PARAMETER (T-241-02).

    No f-string ever builds a ``WHERE`` clause here; the only interpolated text in this module is
    the two allow-listed GUC values in :func:`_apply_hnsw_knobs` -- and that function performs
    the allow-listing itself, so this is a claim about the MODULE and not about one caller of it
    (241-REVIEW WR-08).
    """
    return await conn.fetch(
        _MATCH_SQL,
        query_vector,
        user_id,
        k,
        match_threshold,
        metadata_filter if metadata_filter else None,
        folder_ids if folder_ids else None,
        embedding_model,
    )


async def measure_layer1(
    conn: asyncpg.Connection,
    *,
    k: int = DEFAULT_K,
    filter_shape: FilterShape,
    query_vectors: Sequence[str],
    user_id: str,
    match_threshold: float = DEFAULT_MATCH_THRESHOLD,
    embedding_model: str | None = DEFAULT_EMBEDDING_MODEL,
    ef_search: int | None = None,
    iterative_scan: str | None = None,
) -> dict[str, Any]:
    """Measure one SC#2 axis: ``recall@k`` and ``underfill`` of the ANN arm against exact k-NN."""
    started = time.monotonic()
    metadata_filter, folder_ids, skip_reason = await resolve_filter_shape(conn, filter_shape)

    if skip_reason is not None:
        return {
            "shape": filter_shape.name,
            "description": filter_shape.description,
            "k": k,
            "recall_at_k": None,
            "underfill": None,
            "skipped": skip_reason,
            "per_vector": [],
            "elapsed_seconds": round(time.monotonic() - started, 3),
        }

    per_vector: list[dict[str, Any]] = []
    for index, query_vector in enumerate(query_vectors):
        await _set_planner(conn, use_index=False)
        exact_rows = await _match(
            conn,
            query_vector=query_vector,
            user_id=user_id,
            k=k,
            match_threshold=match_threshold,
            metadata_filter=metadata_filter,
            folder_ids=folder_ids,
            embedding_model=embedding_model,
        )

        await _set_planner(conn, use_index=True)
        await _apply_hnsw_knobs(conn, ef_search=ef_search, iterative_scan=iterative_scan)
        ann_rows = await _match(
            conn,
            query_vector=query_vector,
            user_id=user_id,
            k=k,
            match_threshold=match_threshold,
            metadata_filter=metadata_filter,
            folder_ids=folder_ids,
            embedding_model=embedding_model,
        )

        exact_ids = {str(row["id"]) for row in exact_rows}
        ann_ids = {str(row["id"]) for row in ann_rows}

        entry: dict[str, Any] = {
            "index": index,
            "exact_size": len(exact_ids),
            "ann_size": len(ann_ids),
            "underfill": round(1 - (len(ann_ids) / k), 4) if k else None,
        }
        if not exact_ids:
            # ⚠ An empty denominator. The match_threshold predicate legitimately cuts everything
            # for some query vectors — that is NOT total recall, and it is NOT 1.0 either.
            entry["recall_at_k"] = None
            entry["reason"] = "exact arm returned 0 rows under this predicate (match_threshold)"
        else:
            entry["recall_at_k"] = round(len(ann_ids & exact_ids) / len(exact_ids), 4)
        per_vector.append(entry)

    scored = [e["recall_at_k"] for e in per_vector if e["recall_at_k"] is not None]
    underfills = [e["underfill"] for e in per_vector if e["underfill"] is not None]

    result: dict[str, Any] = {
        "shape": filter_shape.name,
        "description": filter_shape.description,
        "k": k,
        "query_vectors": len(query_vectors),
        "scored_vectors": len(scored),
        "recall_at_k": round(sum(scored) / len(scored), 4) if scored else None,
        "underfill": round(sum(underfills) / len(underfills), 4) if underfills else None,
        "per_vector": per_vector,
        "elapsed_seconds": round(time.monotonic() - started, 3),
    }
    if not scored:
        result["reason"] = "every query vector's exact arm returned 0 rows under this predicate"
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Layer 2 — semantic: the ten probes, scored honestly
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_probe_targets(
    conn: asyncpg.Connection, probes: Sequence[dict]
) -> list[str | None]:
    """Map each probe's ``target_filename`` to a ``documents.id``. Exact match, then stem fallback.

    A probe whose target is not in THIS database returns ``None`` and is excluded from the metric
    upstream — reported as ``target_missing``, never scored as a miss. "The document is not here"
    and "retrieval did not find the document" are different facts.
    """
    rows = await conn.fetch(
        "SELECT id::text AS id, filename FROM public.documents WHERE is_latest = true"
    )
    by_filename = {row["filename"].lower(): row["id"] for row in rows if row["filename"]}

    resolved: list[str | None] = []
    for probe in probes:
        target = probe["target_filename"].lower()
        document_id = by_filename.get(target)
        if document_id is None:
            stem = target.rsplit(".", 1)[0]
            for filename, candidate in by_filename.items():
                if stem and stem in filename:
                    document_id = candidate
                    break
        resolved.append(document_id)
    return resolved


async def measure_layer2(
    conn: asyncpg.Connection,
    *,
    k: int = DEFAULT_K,
    probes: Sequence[dict],
    query_vectors: Sequence[str],
    user_id: str,
    match_threshold: float = DEFAULT_MATCH_THRESHOLD,
    embedding_model: str | None = DEFAULT_EMBEDDING_MODEL,
    ef_search: int | None = None,
    iterative_scan: str | None = None,
) -> dict[str, Any]:
    """Drive the probes through the real path and score the target's position — or ``None``."""
    started = time.monotonic()
    if len(query_vectors) != len(probes):
        raise RecallUnmeasurable(
            f"could not measure: {len(query_vectors)} query vectors for {len(probes)} probes"
        )

    targets = await resolve_probe_targets(conn, probes)

    await _set_planner(conn, use_index=True)
    await _apply_hnsw_knobs(conn, ef_search=ef_search, iterative_scan=iterative_scan)

    rows_per_probe: list[list[Any]] = []
    for query_vector in query_vectors:
        rows_per_probe.append(
            await _match(
                conn,
                query_vector=query_vector,
                user_id=user_id,
                k=k,
                match_threshold=match_threshold,
                metadata_filter=None,
                folder_ids=None,
                embedding_model=embedding_model,
            )
        )

    ranks = score_probe_ranks(rows_per_probe, targets)

    detail: list[dict[str, Any]] = []
    scored_ranks: list[int | None] = []
    target_missing: list[str] = []
    for probe, target, rank, rows in zip(probes, targets, ranks, rows_per_probe):
        entry = {
            "query": probe["query"],
            "target_filename": probe["target_filename"],
            "target_document_id": target,
            "chunk_hits": len(rows),
            "rank": rank,
        }
        if target is None:
            entry["excluded"] = "target document is not in this database"
            target_missing.append(probe["target_filename"])
        else:
            scored_ranks.append(rank)
        detail.append(entry)

    return {
        "k": k,
        "probes": detail,
        "target_missing": target_missing,
        "scored_probes": len(scored_ranks),
        "metrics": compute_metrics(scored_ranks),
        "elapsed_seconds": round(time.monotonic() - started, 3),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Probe query vectors — embedded ONCE, then cached
# ─────────────────────────────────────────────────────────────────────────────

_PROBE_CACHE_VERSION = 1


def _read_probe_cache(cache_path: Path, probes: Sequence[dict]) -> list[list[float]] | None:
    """Return cached probe vectors, or ``None`` when the cache is absent or does not cover them."""
    if not cache_path.is_file():
        return None
    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    vectors = payload.get("vectors") or {}
    try:
        return [list(vectors[probe["query"]]) for probe in probes]
    except (KeyError, TypeError):
        return None


def _write_probe_cache(
    cache_path: Path, probes: Sequence[dict], vectors: Sequence[Sequence[float]], model: str | None
) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps(
            {
                "version": _PROBE_CACHE_VERSION,
                "embedding_model": model,
                "vectors": {
                    probe["query"]: list(vector) for probe, vector in zip(probes, vectors)
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )


async def ensure_probe_vectors(
    cache_path: Path | str | None,
    probes: Sequence[dict] = tuple(EVAL_PROBES),
    *,
    embedding_model: str | None = DEFAULT_EMBEDDING_MODEL,
    allow_embedding: bool = True,
) -> list[list[float]]:
    """Load the probe query vectors from cache, embedding them ONCE if the cache is cold.

    ⭐ **Identical query vectors are what makes before/after and local/cloud comparable at all.**
    A cloud run that re-embedded would measure a different question than the local run it is being
    compared with. So the ten probe strings are embedded in ONE request (ten inputs — nowhere near
    SEED-197's 2048-input cap) and persisted; every later run reuses the file.

    ⛔ When the cache is absent and embedding is unavailable or refused, this REFUSES. It never
    falls back to a random vector or to a stored chunk vector: a query vector that is not the
    probe's own would produce a number that means nothing while looking exactly like one that does.
    """
    path = Path(cache_path) if cache_path is not None else None

    if path is not None:
        cached = _read_probe_cache(path, probes)
        if cached is not None:
            return cached

    if not allow_embedding:
        where = f" at {path}" if path is not None else ""
        raise RecallUnmeasurable(
            f"could not measure: no probe-vector cache{where} and embedding was refused. "
            "Run once with embedding permitted to build the cache, then reuse it."
        )

    try:
        # Imported lazily: this module must stay importable with no provider configuration, and
        # openai_service pulls in settings.
        from starlette.concurrency import run_in_threadpool

        from app.services.openai_service import embed_texts

        vectors = await run_in_threadpool(
            embed_texts, [probe["query"] for probe in probes], embedding_model
        )
    except RecallUnmeasurable:
        raise
    except Exception as exc:
        raise RecallUnmeasurable(
            "could not measure: the probe queries could not be embedded and no cache is present "
            f"({type(exc).__name__}: {exc})"
        ) from exc

    if len(vectors) != len(probes):
        raise RecallUnmeasurable(
            f"could not measure: embedded {len(vectors)} vectors for {len(probes)} probes"
        )

    if path is not None:
        _write_probe_cache(path, probes, vectors, embedding_model)

    return [list(vector) for vector in vectors]


# ─────────────────────────────────────────────────────────────────────────────
# The one entry point the CLI drives
# ─────────────────────────────────────────────────────────────────────────────

async def run_measurement(
    *,
    dsn: str,
    user_id: str,
    layers: Sequence[str] = ("1", "2"),
    k: int = DEFAULT_K,
    match_threshold: float = DEFAULT_MATCH_THRESHOLD,
    embedding_model: str | None = DEFAULT_EMBEDDING_MODEL,
    ef_search: int | None = None,
    iterative_scan: str | None = None,
    query_vector_count: int = DEFAULT_QUERY_VECTOR_COUNT,
    query_vector_seed: str = DEFAULT_QUERY_VECTOR_SEED,
    probes: Sequence[dict] = tuple(EVAL_PROBES),
    probe_cache: Path | str | None = None,
    allow_embedding: bool = True,
    timeout: float = 10.0,
) -> dict[str, Any]:
    """Take the measurement, or raise :class:`RecallUnmeasurable`. **Returns metrics or nothing.**

    Never prints. Never returns a partial report on an error path. The caller owns the exit code.
    """
    checked_ef, checked_scan = validate_knobs(ef_search, iterative_scan)
    started = time.monotonic()

    report: dict[str, Any] = {
        "dsn": describe_dsn(dsn),
        "user_id": str(user_id),
        "k": k,
        "match_threshold": match_threshold,
        "embedding_model": embedding_model,
        "requested": {"ef_search": checked_ef, "iterative_scan": checked_scan},
        "layer1": None,
        "layer2": None,
    }

    async with measuring_connection(dsn, user_id, timeout=timeout) as conn:
        try:
            report["server"] = await read_server_facts(conn)
            report["corpus"] = await read_corpus_counts(conn)
        except RecallUnmeasurable:
            raise
        except Exception as exc:
            raise RecallUnmeasurable(
                f"could not measure: reached {dsn_label(dsn)} but could not read its "
                f"configuration ({type(exc).__name__}: {_redact(str(exc), dsn)})"
            ) from exc

        if "1" in layers:
            query_vectors = await sample_query_vectors(
                conn,
                count=query_vector_count,
                seed=query_vector_seed,
                embedding_model=embedding_model,
            )
            shapes = [
                await measure_layer1(
                    conn,
                    k=k,
                    filter_shape=shape,
                    query_vectors=query_vectors,
                    user_id=user_id,
                    match_threshold=match_threshold,
                    embedding_model=embedding_model,
                    ef_search=checked_ef,
                    iterative_scan=checked_scan,
                )
                for shape in FILTER_SHAPES
            ]
            report["layer1"] = {
                "query_vector_sample": len(query_vectors),
                "query_vector_seed": query_vector_seed,
                "shapes": shapes,
            }

        if "2" in layers:
            probe_vectors = await ensure_probe_vectors(
                probe_cache,
                probes,
                embedding_model=embedding_model,
                allow_embedding=allow_embedding,
            )
            report["layer2"] = await measure_layer2(
                conn,
                k=k,
                probes=probes,
                query_vectors=[vector_literal(vector) for vector in probe_vectors],
                user_id=user_id,
                match_threshold=match_threshold,
                embedding_model=embedding_model,
                ef_search=checked_ef,
                iterative_scan=checked_scan,
            )

    report["elapsed_seconds"] = round(time.monotonic() - started, 3)
    return report
