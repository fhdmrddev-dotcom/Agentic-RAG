"""Phase 294 Plan 02 — the decision-engine measurement. Real search path, frozen questions, no invented numbers.

SC#3 / D-18 / D-19: each rerank engine is measured against rerank-OFF on a held-out question set
that was committed (with its sha256) before any engine ran. Per engine arm the report states:

* **recall of the right passage** vs off — gate: within 2 percentage points; every question that
  flips from found (off) to absent (arm) is named;
* **chunks sent** to the main model — gate: lower than off;
* **cost per search** — main-model input tokens saved, priced at the main model's input rate,
  minus the engine's own cost. Positive → "saves $X per search"; otherwise "costs $X more than it
  saves per search", with the break-even re-send count. Never called a saving when the engine is
  unpriced or the main model unrated;
* **latency** — p50 / p95 of the engine time added to each search.

**Why per search, when D-19 says per chat.** A chat runs a variable number of searches and
re-sends each search's passages on every later agent iteration. Per chat, the saving is
per-search saving × searches × re-sends, while the engine is paid once per search. A positive
per-search net is therefore a FLOOR for the per-chat net; a negative one is printed with the
number of re-sends at which it would break even, so a reader can judge whether real chats cross it.

**D-08: Cohere and Local reorder only.** They keep today's ``top_n`` cut, so with ``top_k`` fixed
they return exactly as many chunks as off. Their chunks and cost gates read
``"N/A (reorders only, D-08)"``: a property of the locked decision, not a missing measurement.

**The real path.** Every arm calls ``retrieval_service.search_documents`` in-process, hybrid on,
with the same cached query vectors substituted at ``app.services.retrieval_rpc.embed_texts``
(patch-where-used). Arm settings are applied with ``model_copy`` on the loaded app settings and
are never written back. A measurement that bypassed the real path (``recall_eval``'s Layer 2 is
vector-only and never reranks, RESEARCH Pitfall 5) would measure nothing about the engines.

**The refusals.** Anything that prevents an honest number for the WHOLE run (no database, a
held-out file that no longer hashes to its sidecar, a target chunk gone from the database, no
query vectors) raises :class:`RecallUnmeasurable`. Anything that prevents an honest number for
ONE arm (no key, an engine that fell back on any search, an engine that was never called, a local
model that would not load) raises :class:`ArmUnmeasured`; that arm is reported UNMEASURED with
the reason and the other arms still report. **A fallback arm is never reported as measured**,
because a fallback returns exactly the rerank-off output and would silently measure off.

**Import-safe by construction.** No module-scope DSN, connection, settings read or engine import:
every external dependency is imported lazily inside the function that needs it, as in
``recall_eval``.

Tokens are counted with tiktoken ``o200k_base``. That is exact for current OpenAI models and an
approximation for every other main model; the report says so.
"""

from __future__ import annotations

import hashlib
import json
import math
import time
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path
from typing import Any, Awaitable, Callable, Iterator, Sequence

from app.services.recall_eval import (
    EVAL_PROBES,
    RecallUnmeasurable,
    compute_metrics,
    describe_dsn,
    dsn_label,
)

__all__ = [
    "ArmUnmeasured",
    "DEFAULT_ARMS",
    "NA_REORDER_ONLY",
    "compare_arms",
    "load_heldout",
    "measure_arm",
    "run_decision_measurement",
]

MIN_ITEMS = 50
RECALL_MARGIN = 0.02                       # D-19: within 2 percentage points of off
NA_REORDER_ONLY = "N/A (reorders only, D-08)"
TOKEN_ENCODING = "o200k_base"
DEFAULT_ARMS = ("off", "local", "jev", "openai_decisions")
KNOWN_ARMS = ("off", "local", "jev", "openai_decisions", "cohere")
# Stop an arm early only when its FIRST searches all fell back (a 401 / 403 / missing access is
# not worth 50 more refused calls). Any later fallback still makes the arm unmeasured.
EARLY_STOP_SEARCHES = 3

TOKEN_NOTE = (
    "tokens are tiktoken o200k_base counts over the returned passages' content: exact for current "
    "OpenAI models, an approximation for other main models"
)
COST_UNIT_NOTE = (
    "cost is per search: a chat re-sends each search's passages on later agent iterations, so the "
    "per-chat saving is per-search saving x searches x re-sends while the engine is paid once per "
    "search; a positive per-search net is a floor for the per-chat net, a negative one is printed "
    "with its break-even re-send count"
)
THRESHOLD_NOTE = (
    "the D-07 prune (floor 0.1, keep at least 3) was fixed in rerank_engines.prune before this "
    "held-out set was frozen and was not tuned after seeing these results (D-18)"
)


class ArmUnmeasured(Exception):
    """One arm could not be measured honestly. ``reason`` is what the report prints."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


# ─────────────────────────────────────────────────────────────────────────────
# The frozen held-out set (D-18)
# ─────────────────────────────────────────────────────────────────────────────

def load_heldout(path: Path, sha_path: Path) -> dict:
    """Load the held-out set, or refuse. The bytes must hash to the committed sidecar."""
    path, sha_path = Path(path), Path(sha_path)
    try:
        data = path.read_bytes()
        recorded = sha_path.read_text(encoding="ascii").split()[0].strip().lower()
    except (OSError, IndexError, UnicodeDecodeError) as exc:
        raise RecallUnmeasurable(
            f"could not measure: the held-out set or its sha256 sidecar is unreadable ({type(exc).__name__})"
        ) from exc
    digest = hashlib.sha256(data).hexdigest()
    if digest != recorded:
        raise RecallUnmeasurable(
            f"could not measure: the held-out set's sha256 {digest} differs from the committed "
            f"sidecar {recorded}; the frozen questions were changed (D-18)"
        )
    try:
        payload = json.loads(data.decode("utf-8"))
    except ValueError as exc:
        raise RecallUnmeasurable("could not measure: the held-out set is not valid JSON") from exc
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list) or len(items) < MIN_ITEMS:
        count = len(items) if isinstance(items, list) else 0
        raise RecallUnmeasurable(
            f"could not measure: the held-out set has {count} items; D-18 needs at least {MIN_ITEMS}"
        )
    seen: set[str] = set()
    for item in items:
        item_id = item.get("id")
        target = item.get("target") or {}
        if not item_id or item_id in seen or not item.get("query") or not target.get("document_id"):
            raise RecallUnmeasurable(f"could not measure: held-out item {item_id!r} is malformed or duplicated")
        seen.add(item_id)
        if item.get("kind") == "chunk":
            if not target.get("chunk_sha256") or not isinstance(target.get("chunk_index"), int):
                raise RecallUnmeasurable(
                    f"could not measure: chunk item {item_id} lacks chunk_sha256 / chunk_index, so its "
                    "target cannot be identified exactly"
                )
        elif item.get("kind") != "probe":
            raise RecallUnmeasurable(f"could not measure: held-out item {item_id} has unknown kind {item.get('kind')!r}")
    return {**payload, "sha256": digest}


# ─────────────────────────────────────────────────────────────────────────────
# Scoring helpers (pure)
# ─────────────────────────────────────────────────────────────────────────────

_encoder: Any = None


def count_tokens(text: str) -> int:
    global _encoder
    if _encoder is None:
        import tiktoken

        _encoder = tiktoken.get_encoding(TOKEN_ENCODING)
    return len(_encoder.encode(text or ""))


def _content_sha(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def target_rank(item: dict, rows: Sequence[dict]) -> int | None:
    """1-based position of the target among the returned rows, or None (absent is the only miss).

    A probe is found by any row of its target document. A chunk item is found only by the exact
    chunk: same document, same chunk_index AND the same content hash, because
    ``(document_id, chunk_index)`` is not unique in this corpus.
    """
    target = item["target"]
    for position, row in enumerate(rows, start=1):
        if str(row.get("document_id")) != str(target["document_id"]):
            continue
        if item["kind"] == "probe":
            return position
        if row.get("chunk_index") == target["chunk_index"] and _content_sha(row.get("content", "")) == target["chunk_sha256"]:
            return position
    return None


def _percentile(values: Sequence[float], q: float) -> float | None:
    """Nearest-rank percentile; None for an empty list."""
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(q * len(ordered)))
    return float(ordered[rank - 1])


def _mean(values: Sequence[float]) -> float | None:
    return (sum(values) / len(values)) if values else None


def _is_reorder_only(arm: str) -> bool:
    from app.services.rerank_engines import get_engine

    spec = get_engine(arm)
    return spec is not None and not spec.probabilistic


# ─────────────────────────────────────────────────────────────────────────────
# One arm
# ─────────────────────────────────────────────────────────────────────────────

def arm_settings(base_settings: Any, arm: str, *, pool: int, top_k: int) -> Any:
    """The arm's settings as a COPY of the loaded settings. Nothing is ever written back."""
    update: dict[str, Any] = {
        "rerank_enabled": arm != "off",
        "rerank_top_n": pool,
        "retrieval_top_k": top_k,
        # RESEARCH Pitfall 5: the vector-only path never reranks; every arm runs hybrid.
        "hybrid_search_enabled": True,
        # The pool is max(top_k, rerank_top_n) cut from the fused candidates, so the candidate
        # count must be at least the pool.
        "hybrid_candidate_count": max(int(getattr(base_settings, "hybrid_candidate_count", pool) or pool), pool),
    }
    if arm != "off":
        from app.services.rerank_engines import get_engine

        spec = get_engine(arm)
        if spec is None:
            raise ArmUnmeasured(f"unknown engine {arm!r}")
        update["rerank_provider"] = arm
        update["rerank_model"] = spec.default_model
    return base_settings.model_copy(update=update)


@contextmanager
def _cached_query_vectors(vectors: dict[str, list[float]] | None) -> Iterator[None]:
    """Substitute the cached vectors at the embedding call the search path uses (patch-where-used)."""
    if vectors is None:
        yield
        return
    from unittest import mock

    def embed_from_cache(texts, model=None, user_settings=None):  # noqa: ARG001 — same signature
        try:
            return [list(vectors[text]) for text in texts]
        except KeyError as exc:
            raise RecallUnmeasurable("could not measure: a query has no cached vector") from exc

    with mock.patch("app.services.retrieval_rpc.embed_texts", embed_from_cache):
        yield


async def _real_search_documents(*args, **kwargs):
    from app.services import retrieval_service

    return await retrieval_service.search_documents(*args, **kwargs)


async def measure_arm(
    arm: str,
    items: list[dict],
    base_settings: Any,
    *,
    pool: int,
    top_k: int,
    user_id: str,
    vectors: dict[str, list[float]] | None,
    search: Callable[..., Awaitable[tuple[list[dict], float]]] | None = None,
    supabase: Any = None,
) -> dict:
    """Run every held-out item through the search path under one arm's settings.

    Raises :class:`ArmUnmeasured` (key missing; any engine fallback; an engine never called) and
    lets :class:`RecallUnmeasurable` through (the run's infrastructure failed).
    """
    from app.services.rerank_engines import get_engine, resolve_credentials
    from app.services.rerank_engines.tracing import capture_engine_calls

    settings_for_arm = arm_settings(base_settings, arm, pool=pool, top_k=top_k)
    if arm != "off":
        spec = get_engine(arm)
        if spec.hosted and resolve_credentials(spec, settings_for_arm) is None:
            raise ArmUnmeasured("key_missing")

    run_search = search or _real_search_documents
    searches: list[dict] = []
    fallbacks: list[str] = []
    never_called = 0
    with _cached_query_vectors(vectors):
        for index, item in enumerate(items, start=1):
            with capture_engine_calls() as calls:
                started = time.perf_counter()
                # The real path: retrieval_service.search_documents(query, user_id, supabase, ...)
                rows, _avg = await run_search(
                    item["query"], user_id, supabase, user_settings=settings_for_arm
                )
                search_ms = (time.perf_counter() - started) * 1000
            engine_calls = list(calls)
            failed = [call for call in engine_calls if not call.ok]
            if failed:
                fallbacks.extend(call.reason or "unknown" for call in failed)
            if arm != "off" and rows and not engine_calls:
                never_called += 1
            costs = [call.cost_usd for call in engine_calls]
            engine_cost = None if (not engine_calls or any(c is None for c in costs)) else sum(costs, Decimal("0"))
            if arm == "off":
                engine_cost = Decimal("0")
            rank = target_rank(item, rows)
            searches.append({
                "id": item["id"],
                "query": item["query"],
                "kind": item["kind"],
                "found": rank is not None,
                "rank": rank,
                "chunks": len(rows),
                "tokens": sum(count_tokens(row.get("content", "")) for row in rows),
                "engine_cost_usd": None if engine_cost is None else str(engine_cost),
                "engine_latency_ms": round(sum(call.latency_ms for call in engine_calls), 3),
                "engine_input_tokens": (
                    sum(call.input_tokens for call in engine_calls)
                    if engine_calls and all(call.input_tokens is not None for call in engine_calls) else None
                ),
                "search_ms": round(search_ms, 3),
                "fell_back": bool(failed),
            })
            fell_back_searches = sum(1 for s in searches if s["fell_back"])
            if index == EARLY_STOP_SEARCHES and fell_back_searches == index and len(items) > index:
                reasons = ", ".join(sorted(set(fallbacks)))
                raise ArmUnmeasured(
                    f"engine fell back on {fell_back_searches} of {index} searches (stopped after the "
                    f"first {index} of {len(items)} all fell back); reasons: {reasons}"
                )

    fell_back_searches = sum(1 for s in searches if s["fell_back"])
    if fell_back_searches:
        reasons = ", ".join(sorted(set(fallbacks)))
        raise ArmUnmeasured(
            f"engine fell back on {fell_back_searches} of {len(searches)} searches; reasons: {reasons}"
        )
    if never_called:
        raise ArmUnmeasured(
            f"engine was never called on {never_called} of {len(searches)} searches that returned "
            "passages (the arm would measure rerank-off)"
        )

    found = [s["found"] for s in searches]
    return {
        "arm": arm,
        "status": "measured",
        "searches": searches,
        "recall": (sum(found) / len(found)) if found else None,
        "metrics": compute_metrics([s["rank"] for s in searches]),
        "mean_chunks": _mean([s["chunks"] for s in searches]),
        "mean_tokens": _mean([s["tokens"] for s in searches]),
        "settings_applied": {
            "rerank_enabled": settings_for_arm.rerank_enabled,
            "rerank_provider": settings_for_arm.rerank_provider if arm != "off" else None,
            "rerank_model": settings_for_arm.rerank_model if arm != "off" else None,
            "rerank_top_n": settings_for_arm.rerank_top_n,
            "retrieval_top_k": settings_for_arm.retrieval_top_k,
            "hybrid_search_enabled": settings_for_arm.hybrid_search_enabled,
            "hybrid_candidate_count": settings_for_arm.hybrid_candidate_count,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# The gates (D-19)
# ─────────────────────────────────────────────────────────────────────────────

def _usd(value: Decimal) -> str:
    return f"{value:.8f}"


def compare_arms(off: dict, arm: dict, *, main_rate: Any) -> dict:
    """Every D-19 gate for one arm against off, plus the named flips. Pure."""
    from app.services.pricing_service import compute_token_cost_usd_unquantized

    name = arm["arm"]
    off_by_id = {s["id"]: s for s in off["searches"]}
    paired = [(off_by_id[s["id"]], s) for s in arm["searches"] if s["id"] in off_by_id]
    if len(paired) != len(off["searches"]) or len(paired) != len(arm["searches"]):
        raise RecallUnmeasurable(f"could not compare {name} with off: the two arms searched different items")

    n = len(paired)
    recall_off = sum(1 for o, _ in paired if o["found"]) / n
    recall_arm = sum(1 for _, a in paired if a["found"]) / n
    recall_gate = "pass" if recall_arm + 1e-9 >= recall_off - RECALL_MARGIN else "fail"
    flips = [{"id": a["id"], "query": a["query"]} for o, a in paired if o["found"] and not a["found"]]
    gains = [{"id": a["id"], "query": a["query"]} for o, a in paired if a["found"] and not o["found"]]

    chunks_off = _mean([o["chunks"] for o, _ in paired])
    chunks_arm = _mean([a["chunks"] for _, a in paired])
    tokens_off = _mean([o["tokens"] for o, _ in paired])
    tokens_arm = _mean([a["tokens"] for _, a in paired])
    latencies = [float(a["engine_latency_ms"]) for _, a in paired]
    latency = {"p50": _percentile(latencies, 0.50), "p95": _percentile(latencies, 0.95)}

    result: dict[str, Any] = {
        "arm": name,
        "items": n,
        "recall_off": recall_off,
        "recall_arm": recall_arm,
        "recall_delta_pp": round((recall_arm - recall_off) * 100, 4),
        "recall_gate": recall_gate,
        "flips": flips,
        "gains": gains,
        "mean_chunks_off": chunks_off,
        "mean_chunks_arm": chunks_arm,
        "mean_tokens_off": tokens_off,
        "mean_tokens_arm": tokens_arm,
        "latency_ms": latency,
        "saved_usd_per_search": None,
        "engine_usd_per_search": None,
        "net_usd_per_search": None,
        "break_even_resends": None,
    }

    if _is_reorder_only(name):
        engine_costs = [a["engine_cost_usd"] for _, a in paired]
        result["chunks_gate"] = NA_REORDER_ONLY
        result["cost_gate"] = NA_REORDER_ONLY
        result["engine_usd_per_search"] = (
            None if any(c is None for c in engine_costs)
            else _usd(sum((Decimal(c) for c in engine_costs), Decimal("0")) / n)
        )
        result["cost_sentence"] = f"{NA_REORDER_ONLY}: sends as many passages as off, so it saves no main-model tokens"
        return result

    result["chunks_gate"] = "pass" if chunks_arm < chunks_off else "fail"

    if main_rate is None:
        result["cost_gate"] = "unrated"
        result["cost_sentence"] = "unrated: the main model has no input rate, so no saving can be computed"
        return result
    if any(a["engine_cost_usd"] is None for _, a in paired):
        result["cost_gate"] = "unpriced"
        result["cost_sentence"] = "unpriced: at least one engine call has no cost figure, so no saving can be computed"
        return result

    saved: list[Decimal] = []
    engine: list[Decimal] = []
    for o, a in paired:
        priced = compute_token_cost_usd_unquantized(o["tokens"] - a["tokens"], 0, main_rate)
        saved.append(priced.cost_usd if priced.cost_usd is not None else Decimal("0"))
        engine.append(Decimal(a["engine_cost_usd"]))
    mean_saved = sum(saved, Decimal("0")) / n
    mean_engine = sum(engine, Decimal("0")) / n
    net = mean_saved - mean_engine
    result["saved_usd_per_search"] = _usd(mean_saved)
    result["engine_usd_per_search"] = _usd(mean_engine)
    result["net_usd_per_search"] = _usd(net)
    if net > 0:
        result["cost_gate"] = "pass"
        result["cost_sentence"] = f"saves ${_usd(net)} per search (a floor for the per-chat saving)"
        return result

    result["cost_gate"] = "fail"
    if mean_saved > 0:
        resends: int | str = int(math.ceil(mean_engine / mean_saved))
        tail = f"breaks even if a search's passages are re-sent {resends} times in a chat"
    else:
        resends = "never"
        tail = "never breaks even, because it saves no main-model tokens"
    result["break_even_resends"] = resends
    result["cost_sentence"] = f"costs ${_usd(-net)} more than it saves per search; {tail}"
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Query vectors — embedded ONCE, cached, identical for every arm
# ─────────────────────────────────────────────────────────────────────────────

_VECTOR_CACHE_VERSION = 1


async def ensure_query_vectors(
    cache_path: Path | None, queries: Sequence[str], *, embedding_model: str, user_settings: Any
) -> dict[str, list[float]]:
    """The cached vector per query (keyed by query + embedding model), embedding the missing ones once."""
    cached: dict[str, list[float]] = {}
    if cache_path is not None and Path(cache_path).is_file():
        try:
            payload = json.loads(Path(cache_path).read_text(encoding="utf-8"))
            if payload.get("embedding_model") == embedding_model:
                cached = {k: list(v) for k, v in (payload.get("vectors") or {}).items()}
        except (OSError, ValueError):
            cached = {}
    missing = [q for q in dict.fromkeys(queries) if q not in cached]
    if missing:
        try:
            from starlette.concurrency import run_in_threadpool

            from app.services.openai_service import embed_texts

            fresh = await run_in_threadpool(embed_texts, list(missing), None, user_settings)
        except RecallUnmeasurable:
            raise
        except Exception as exc:
            raise RecallUnmeasurable(
                f"could not measure: the held-out queries could not be embedded ({type(exc).__name__})"
            ) from exc
        if len(fresh) != len(missing):
            raise RecallUnmeasurable(f"could not measure: embedded {len(fresh)} vectors for {len(missing)} queries")
        cached.update({q: list(v) for q, v in zip(missing, fresh)})
        if cache_path is not None:
            Path(cache_path).parent.mkdir(parents=True, exist_ok=True)
            Path(cache_path).write_text(
                json.dumps({"version": _VECTOR_CACHE_VERSION, "embedding_model": embedding_model, "vectors": cached}),
                encoding="utf-8",
            )
    return {q: cached[q] for q in queries}


# ─────────────────────────────────────────────────────────────────────────────
# The one entry point the CLI drives
# ─────────────────────────────────────────────────────────────────────────────

async def _verify_targets(dsn: str, items: Sequence[dict]) -> None:
    """Every frozen target still exists, byte-identical. A read-only SELECT per run."""
    import asyncpg

    try:
        conn = await asyncpg.connect(dsn, timeout=10)
    except Exception as exc:
        raise RecallUnmeasurable(
            f"could not measure: no usable connection to {dsn_label(dsn)} ({type(exc).__name__})"
        ) from exc
    try:
        missing: list[str] = []
        for item in items:
            target = item["target"]
            if item["kind"] == "probe":
                ok = await conn.fetchval(
                    "SELECT count(*) FROM public.documents WHERE id = $1::uuid AND is_latest", target["document_id"]
                )
                if not ok:
                    missing.append(item["id"])
                continue
            rows = await conn.fetch(
                "SELECT content FROM public.document_chunks WHERE document_id = $1::uuid AND chunk_index = $2",
                target["document_id"], target["chunk_index"],
            )
            if not any(_content_sha(row["content"]) == target["chunk_sha256"] for row in rows):
                missing.append(item["id"])
    finally:
        await conn.close()
    if missing:
        raise RecallUnmeasurable(
            f"could not measure: {len(missing)} frozen target(s) are no longer in {dsn_label(dsn)} "
            f"({', '.join(missing)}); the held-out set no longer describes this database"
        )


def _same_database(a: str, b: str) -> bool:
    da, db = describe_dsn(a), describe_dsn(b)
    loopback = {"127.0.0.1", "localhost", "::1"}
    host_a = "loopback" if da["host"] in loopback else da["host"]
    host_b = "loopback" if db["host"] in loopback else db["host"]
    return (host_a, da["port"], da["database"]) == (host_b, db["port"], db["database"])


async def run_decision_measurement(
    *,
    heldout: Path,
    arms: Sequence[str] = DEFAULT_ARMS,
    pool: int = 20,
    top_k: int = 5,
    main_model: str | None = None,
    dsn: str | None = None,
    sha_path: Path | None = None,
    vector_cache: Path | None = None,
    local_warm_timeout_s: float | None = None,
) -> dict:
    """Measure every requested arm, or raise :class:`RecallUnmeasurable`. Never prints."""
    started = time.monotonic()
    heldout = Path(heldout)
    payload = load_heldout(heldout, Path(sha_path) if sha_path else heldout.with_suffix(".sha256"))
    items = payload["items"]
    user_id = str(payload["user_id"])
    unknown = [arm for arm in arms if arm not in KNOWN_ARMS]
    if unknown:
        raise RecallUnmeasurable(f"could not measure: unknown arm(s) {unknown}; known arms are {list(KNOWN_ARMS)}")
    ordered_arms = ["off"] + [arm for arm in dict.fromkeys(arms) if arm != "off"]

    try:
        from app.config import settings as app_config
    except Exception as exc:
        raise RecallUnmeasurable(f"could not measure: the backend configuration did not load ({type(exc).__name__})") from exc
    search_dsn = app_config.postgres_dsn
    if dsn and not _same_database(dsn, search_dsn):
        raise RecallUnmeasurable(
            f"could not measure: the search path reads {dsn_label(search_dsn)} (POSTGRES_DSN) but --dsn "
            f"names {dsn_label(dsn)}; refusing to measure one database and report another"
        )
    await _verify_targets(search_dsn, items)

    try:
        from app.dependencies import get_pg_pool, get_supabase
        from app.models.user_settings import load_app_settings_async

        base_settings = await load_app_settings_async()
        supabase = get_supabase()
        pg_pool = await get_pg_pool()
    except RecallUnmeasurable:
        raise
    except Exception as exc:
        raise RecallUnmeasurable(f"could not measure: the app settings could not be loaded ({type(exc).__name__})") from exc

    main_model = main_model or base_settings.llm_model
    try:
        from app.db.rates import get_rate_for_model

        main_rate = await get_rate_for_model(pg_pool, main_model)
    except Exception as exc:
        raise RecallUnmeasurable(f"could not measure: the main model's rate could not be read ({type(exc).__name__})") from exc

    embedding_model = getattr(base_settings, "embedding_model", "") or "text-embedding-3-small"
    vectors = await ensure_query_vectors(
        vector_cache, [item["query"] for item in items],
        embedding_model=embedding_model, user_settings=base_settings,
    )

    arm_reports: dict[str, dict] = {}
    warmups: dict[str, dict] = {}
    for arm in ordered_arms:
        arm_started = time.monotonic()
        try:
            if arm == "local":
                from app.services.rerank_engines import get_engine
                from app.services.rerank_engines import local as local_engine

                model = get_engine("local").default_model
                warm_started = time.monotonic()
                try:
                    ready = local_engine.warm(model, wait=True, timeout_s=local_warm_timeout_s)
                except Exception as exc:  # noqa: BLE001 — the arm is unmeasured, never a fallback
                    raise ArmUnmeasured(f"local model {model} did not load ({type(exc).__name__})") from exc
                warmups["local"] = {"model": model, "seconds": round(time.monotonic() - warm_started, 1)}
                if not ready:
                    raise ArmUnmeasured(
                        f"local model {model} was not resident after warm-up "
                        f"({warmups['local']['seconds']} s); the arm would have fallen back on every search"
                    )
            report = await measure_arm(
                arm, items, base_settings, pool=pool, top_k=top_k, user_id=user_id,
                vectors=vectors, supabase=supabase,
            )
        except ArmUnmeasured as exc:
            if arm == "off":
                raise RecallUnmeasurable(f"could not measure: the rerank-off arm failed ({exc.reason})") from exc
            report = {"arm": arm, "status": "unmeasured", "reason": exc.reason}
        report["elapsed_seconds"] = round(time.monotonic() - arm_started, 3)
        arm_reports[arm] = report

    comparisons = {
        arm: compare_arms(arm_reports["off"], report, main_rate=main_rate)
        for arm, report in arm_reports.items()
        if arm != "off" and report["status"] == "measured"
    }

    try:
        await pg_pool.close()
    except Exception:  # noqa: BLE001 — closing is best-effort; the numbers are already taken
        pass

    probe_queries = {probe["query"] for probe in EVAL_PROBES}
    return {
        "heldout": {
            "path": heldout.name,
            "sha256": payload["sha256"],
            "items": len(items),
            "chunk_items": sum(1 for i in items if i["kind"] == "chunk"),
            "probe_items": sum(1 for i in items if i["kind"] == "probe"),
            "probe_items_are_eval_probes": all(i["query"] in probe_queries for i in items if i["kind"] == "probe"),
            "unresolved_probes": payload.get("unresolved_probes", []),
            "created_at": payload.get("created_at"),
        },
        "dsn": describe_dsn(search_dsn),
        "user_id": user_id,
        "pool": pool,
        "top_k": top_k,
        "hybrid_search_enabled": True,
        "embedding_model": embedding_model,
        "main_model": main_model,
        "main_rate_input_usd_per_million": None if main_rate is None else str(main_rate.input_cost_per_million),
        "token_encoding": TOKEN_ENCODING,
        "token_note": TOKEN_NOTE,
        "cost_unit_note": COST_UNIT_NOTE,
        "threshold_note": THRESHOLD_NOTE,
        "warmups": warmups,
        "arms": arm_reports,
        "comparisons": comparisons,
        "elapsed_seconds": round(time.monotonic() - started, 3),
    }
