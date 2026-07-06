"""Phase 140 (TRIG-02 / Plan 02) — skill-vector embed source + backfill lifecycle.

The smart-dispatch pre-filter (Plan 04) ranks the ``## Available Skills`` catalog by
semantic relevance when it exceeds the token budget. That ranking needs ONE vector per
skill, kept fresh OFF the hot path — this module owns that data-population half.

  * ``build_skill_embed_source`` — the D-01 signal set: a skill's ``description`` +
    its owner-authored ``should_fire`` test-case prompts (``skill_test_cases.prompt``,
    migration 079), falling back to the skill ``name`` when both are absent. A huge
    test-suite can't dominate one embed — 4000-char cap.
  * ``skill_source_text_hash`` — a deterministic sha256 staleness fingerprint (a
    non-crypto fast hash; ASVS V6 confirms no crypto boundary — Pitfall 2 / D-10 pairs
    it with the embedding_model tag).
  * ``skill_reembed_job`` — a ``reembed_service``-shaped background backfill: each pass
    reads the owner's enabled skills (+ their test-case prompts + current vector),
    selects the STALE ones (absent row OR ``source_text_hash`` mismatch OR
    ``embedding_model`` != current), embeds the batch, and NON-DESTRUCTIVELY upserts one
    row per skill. Every blocking call — ``embed_texts`` AND every supabase-py read AND
    write — runs through ``run_in_threadpool`` (D-v2.5-01 / SEED-065 / Warning-1: the
    reembed precedent wraps EVERY supabase call, not just the embed). Owner hand-scoped
    ``.eq("user_id", …)`` under the service-role client (RLS is bypassed — the app scope
    is the only gate, V4). Fail-open: a failed pass logs + returns an honest partial,
    never crashes the caller.
  * ``kick_skill_backfill`` — the fire-and-forget self-heal primitive Plan 04 fires from
    the over-budget branch (Blocker-1) whenever ``match_skills`` returns an in-scope skill
    with a missing/NULL-similarity vector. It spawns ``skill_reembed_job`` as a background
    task (strong-ref'd against GC — evals.py ``_RECONCILE_TASKS`` pattern) and returns
    IMMEDIATELY, so the hot path never blocks on the embed/DB round-trip. Double-wrapped
    fail-open: NEITHER a spawned-job failure NOR a spawn failure ever reaches the caller
    (D-05). It is NOT called on the fits-budget fast path and does NOT touch threads.py.

Migration 091 (the real ``skill_embeddings`` table + ``match_skills`` RPC) is applied in
the [BLOCKING] Plan 05, where the REAL vector round-trip is exercised. This module's tests
(``tests/integration/test_140_skill_embedding_service.py``) are mock/unit level.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from starlette.concurrency import run_in_threadpool

from app.services.openai_service import embed_texts

if TYPE_CHECKING:  # pragma: no cover - typing only
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)

# Mirror reembed_service: a bounded slice per pass keeps the embed batch under provider
# input caps while amortizing the per-batch round-trip. Skills are tens–hundreds of rows,
# so one pass usually suffices — the loop stays for resumability parity.
BATCH: int = 64

# The default embedding model, mirroring reembed_service.DEFAULT_MODEL — text-embedding-3
# vectors are L2-normalized, so cosine (<=>) ranks identically to a dot product.
DEFAULT_MODEL = "text-embedding-3-small"

# The maximum embed-source length. A modest cap so a pathological test-suite (dozens of
# long should_fire prompts) can't dominate one skill's single vector.
MAX_SOURCE_CHARS = 4000

# Strong references to fire-and-forget backfill tasks so an ``asyncio.create_task`` is
# never garbage-collected mid-flight (the sanctioned retention pattern — mirrors
# evals.py._RECONCILE_TASKS / eval_runner_service._BACKGROUND_TASKS). NOT run state.
_BACKFILL_TASKS: set[asyncio.Task] = set()


def _current_model(app_settings) -> str:
    """The currently-configured embedding model (mirrors reembed_service._current_model)."""
    return getattr(app_settings, "embedding_model", "") or DEFAULT_MODEL


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── D-01 embed-source builder + staleness fingerprint (pure) ──────────────────


def build_skill_embed_source(skill: dict, test_case_prompts: list[str]) -> str:
    """Build the single embed-source string for a skill (D-01 signal set).

    Concatenate the skill ``description`` with each non-empty ``should_fire``
    test-case prompt (``skill_test_cases.prompt``), one per line. If BOTH are absent
    (no description AND no cases), fall back to the skill ``name`` so a bare skill still
    produces a non-empty, embeddable source. Truncate to ``MAX_SOURCE_CHARS`` so a huge
    test-suite can't dominate one vector.
    """
    parts = [(skill.get("description") or "").strip()]
    parts += [(p or "").strip() for p in (test_case_prompts or [])]
    text = "\n".join(p for p in parts if p)
    if not text:  # no description AND no non-empty test cases
        text = (skill.get("name") or "").strip()
    return text[:MAX_SOURCE_CHARS]


def skill_source_text_hash(text: str) -> str:
    """Deterministic staleness fingerprint (sha256 hexdigest).

    A non-security fast hash — it only detects "did the embed source change?" so the
    job re-embeds a skill whose description/cases changed. NOT a crypto boundary
    (ASVS V6); D-10 pairs it with the ``embedding_model`` tag for cross-vector-space
    safety.
    """
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _is_stale(skill: dict, source_hash: str, current_model: str) -> bool:
    """A skill is stale when it has NO current vector row, OR its stored
    ``source_text_hash`` no longer matches the freshly-computed source hash, OR its
    vector was embedded with a different model (RESEARCH Pattern 2 / D-10). Absence of a
    row == stale, so an un-backfilled skill degrades cleanly to D-05 fail-open."""
    existing = skill.get("skill_embeddings")
    # PostgREST returns an embedded to-one resource as a list (possibly EMPTY when the
    # skill has no vector row yet) or as a single object — handle both, empty == absent.
    if isinstance(existing, list):
        row = existing[0] if existing else None
    else:
        row = existing
    if not row:
        return True
    return (
        row.get("source_text_hash") != source_hash
        or row.get("embedding_model") != current_model
    )


# ── the reembed-shaped backfill job ───────────────────────────────────────────


async def skill_reembed_job(
    supabase,
    user_id: str,
    app_settings: "UserEffectiveSettings",
    *,
    batch_size: int | None = None,
    max_batches: int | None = None,
    only_skill_ids: list[str] | None = None,
) -> dict:
    """Backfill/refresh this owner's stale skill vectors (reembed_service shape).

    Each pass reads the owner's enabled skills (+ their ``skill_test_cases.prompt``s +
    current ``skill_embeddings`` row), selects the STALE ones, embeds the batch, and
    NON-DESTRUCTIVELY upserts one row per skill keyed on ``skill_id`` (+ ``user_id`` in
    the payload — the V4 hand-scope). When ``only_skill_ids`` is provided (the self-heal
    kick), the read narrows to just those ids.

    CRITICAL (Warning-1 / D-v2.5-01): EVERY blocking call runs through
    ``run_in_threadpool`` — ``embed_texts`` AND the supabase ``.select`` read AND each
    ``.upsert`` write — never on the event loop. A failure logs a warning and returns an
    honest partial/resumable snapshot; it never crashes the caller (fail-open, D-05).
    """
    limit = batch_size if batch_size is not None else BATCH
    current = _current_model(app_settings)
    dims = getattr(app_settings, "embedding_dimensions", None)
    embedded = 0
    skipped = 0

    try:
        def _read():
            q = (
                supabase.table("skills")
                .select(
                    "id, name, description, "
                    "skill_test_cases(prompt), "
                    "skill_embeddings(source_text_hash, embedding_model)"
                )
                .eq("user_id", user_id)  # V4 owner hand-scope on the READ
                .eq("is_enabled", True)
            )
            if only_skill_ids:
                q = q.in_("id", list(only_skill_ids))
            return q.execute()

        resp = await run_in_threadpool(_read)  # threadpool-wrapped read (Warning-1)
        skills = resp.data or []

        # Compute staleness in Python: the hash-mismatch arm needs the embed source, which
        # SQL cannot derive (it requires the concatenation) — so filter here, not in the DB.
        stale: list[tuple[dict, str, str]] = []
        for s in skills:
            prompts = [c.get("prompt") for c in (s.get("skill_test_cases") or [])]
            source = build_skill_embed_source(s, prompts)
            source_hash = skill_source_text_hash(source)
            if _is_stale(s, source_hash, current):
                stale.append((s, source, source_hash))
            else:
                skipped += 1

        passes = 0
        for start in range(0, len(stale), limit):
            if max_batches is not None and passes >= max_batches:
                break
            passes += 1
            chunk = stale[start : start + limit]

            # Embed the batch OFF the event loop (SEED-065) — NEVER call embed_texts direct.
            vectors = await run_in_threadpool(
                embed_texts,
                [source for (_s, source, _h) in chunk],
                user_settings=app_settings,
            )

            # NON-DESTRUCTIVE per-skill upsert (no bulk DELETE of valid vectors). The old
            # vector is only ever overwritten by its replacement. user_id in the payload is
            # the V4 write scope; on_conflict=skill_id keeps exactly one row per skill.
            for (s, _source, source_hash), vec in zip(chunk, vectors):
                await run_in_threadpool(
                    lambda s=s, vec=vec, h=source_hash: supabase.table("skill_embeddings")
                    .upsert(
                        {
                            "skill_id": s["id"],
                            "user_id": user_id,  # V4 hand-scope on the WRITE
                            "embedding": vec,
                            "embedding_model": current,
                            "embedding_dimensions": dims,
                            "source_text_hash": h,
                            "updated_at": _now_iso(),
                        },
                        on_conflict="skill_id",
                    )
                    .execute()
                )
                embedded += 1

        status = "complete" if embedded == len(stale) else "partial"
        return {
            "status": status,
            "embedded": embedded,
            "skipped": skipped,
            "stale": len(stale),
        }

    except Exception:  # noqa: BLE001 — a failed backfill must leave an HONEST partial, never crash.
        logger.warning(
            "skill_reembed_job failed for user_id=%s; returning honest partial",
            user_id,
            exc_info=True,
        )
        return {"status": "failed", "embedded": embedded, "skipped": skipped}


# ── the fire-and-forget self-heal primitive (Blocker-1, consumed by Plan 04) ───


def kick_skill_backfill(
    supabase,
    user_id: str,
    app_settings: "UserEffectiveSettings",
    *,
    only_skill_ids: list[str] | None = None,
) -> None:
    """Fire-and-forget: spawn ``skill_reembed_job`` and return IMMEDIATELY.

    Plan 04's over-budget branch calls this whenever ``match_skills`` returns an in-scope
    skill with a missing/NULL-similarity vector, so a newly-created/edited skill
    re-vectorizes within ~one turn instead of being silently starved (Blocker-1). It must
    NEVER block or crash the hot path — so it double-wraps fail-open (D-05):
      * the inner coroutine wraps ``skill_reembed_job`` in try/except (a run failure is
        logged, never raised), and
      * the spawn itself (``create_task``) is wrapped in try/except (a spawn failure is
        logged, never raised).
    The spawned task is strong-ref'd in ``_BACKFILL_TASKS`` so it survives GC mid-flight.
    """

    async def _run() -> None:
        try:
            await skill_reembed_job(
                supabase, user_id, app_settings, only_skill_ids=only_skill_ids
            )
        except Exception:  # noqa: BLE001 — self-heal failure must never surface to the turn.
            logger.warning(
                "kick_skill_backfill job failed for user_id=%s (swallowed, fail-open)",
                user_id,
                exc_info=True,
            )

    coro = _run()
    try:
        task = asyncio.create_task(coro)
        _BACKFILL_TASKS.add(task)  # strong-ref against GC (evals.py:608-611 pattern)
        task.add_done_callback(_BACKFILL_TASKS.discard)
    except Exception:  # noqa: BLE001 — even a spawn failure must not reach the caller.
        coro.close()  # never scheduled → close it so no coroutine leaks (fail-open cleanup)
        logger.warning(
            "kick_skill_backfill could not spawn for user_id=%s (swallowed, fail-open)",
            user_id,
            exc_info=True,
        )
