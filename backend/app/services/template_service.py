"""Phase 100 (TMPL-01) — ephemeral-template lifecycle plumbing.

Two thin async-service functions + one pure helper, mirroring the 099 skill_snapshot.py
thin-seam shape (all logic here; main.py / threads.py gain only delegating call-throughs
so the G-5 hot file threads.py never grows inline query/Storage logic):

- ``sweep_expired`` (D-07) — the in-process janitor: GC every expired template row +
  ALL its Storage version bytes. Pure garbage collection — the *guarantee* is the
  read filter from Plans 03/04 (``expires_at`` gate), NOT this sweep. Idempotent by
  construction (a sibling worker's deleted row isn't in the next SELECT; an already-
  removed Storage object is a no-op remove) → WORKER_COUNT=2 safe with no lock.
- ``pin_templates_for_run`` (D-09) — the kickoff run-pin: extend-only (GREATEST) so a
  run never dies mid-flight from template expiry. A templateless thread → 0 rows →
  literal no-op (D-11). The single exception to fixed-from-upload TTL (D-08).
- ``run_cap_seconds`` — the conservative whole-run wall-clock cap (Pitfall 4 / A2):
  ``harness_phase_wall_clock_seconds`` (3600) is PER-PHASE; no whole-run cap exists,
  so sum the per-phase caps + a margin.
"""

from __future__ import annotations

import logging
from uuid import UUID

import asyncpg
from starlette.concurrency import run_in_threadpool

from app.db.workspace import get_storage_paths_for_file
from app.services.workspace_service import BUCKET_NAME

logger = logging.getLogger(__name__)


async def sweep_expired(pool: asyncpg.Pool, supabase) -> int:
    """D-07: GC expired template rows + ALL their Storage version bytes. Idempotent.

    The sweep uses the SERVICE-ROLE ``get_supabase()`` for Storage (passed in by
    main.py — RLS-bypassed but scoped to ``expires_at <= now()`` rows ONLY, never
    reads/returns user content; mirrors the harness_engine.py:1134 request-less
    service-role precedent). ``get_storage_paths_for_file`` is reused verbatim (the
    file + ALL version Storage paths) — do NOT hand-roll a Storage walk.

    Idempotency (WORKER_COUNT=2 safe, no lock):
      - a row a sibling worker already deleted isn't in THIS SELECT
      - the DELETE RETURNING / rowcount check skips a row another worker raced us to
      - an already-removed Storage object is a no-op ``remove`` (best-effort)
    """
    expired = await pool.fetch(
        "SELECT id FROM workspace_files "
        "WHERE expires_at IS NOT NULL AND expires_at <= now()"
    )
    deleted = 0
    for r in expired:
        file_id = r["id"]
        # Gather ALL version + file Storage paths BEFORE deleting the row (Pitfall 3:
        # the CASCADE drops workspace_file_versions, so the paths must be read first).
        paths = await get_storage_paths_for_file(pool, file_id)
        # DELETE the row (FK ON DELETE CASCADE drops workspace_file_versions).
        res = await pool.execute("DELETE FROM workspace_files WHERE id = $1", file_id)
        if res.endswith("0"):  # already deleted by a sibling worker — idempotent
            continue
        deleted += 1
        for sp in paths:
            try:
                await run_in_threadpool(
                    supabase.storage.from_(BUCKET_NAME).remove, [sp]
                )
            except Exception:
                logger.warning(
                    "Template sweep: failed to remove storage object %s", sp
                )
    return deleted


async def pin_templates_for_run(
    pool: asyncpg.Pool, *, thread_id: UUID, run_wall_clock_cap: int
) -> int:
    """D-09: extend (never shorten) each template_input file's expiry to cover the run.

    GREATEST ensures the pin only ever EXTENDS (D-08 fixed-from-upload preserved — a
    long-pinned template never gets its expiry shortened by a later, shorter run).
    The WHERE requires ``kind = 'template_input' AND expires_at IS NOT NULL`` so
    agent/NULL-expiry rows are never matched (D-11 / T-100-05-04 — a non-template file
    can never acquire an expiry via the pin). A thread with no template_input row →
    0 rows → literal no-op (D-11).
    """
    res = await pool.execute(
        "UPDATE workspace_files "
        "SET expires_at = GREATEST(expires_at, now() + ($2 || ' seconds')::interval) "
        "WHERE thread_id = $1 AND kind = 'template_input' AND expires_at IS NOT NULL",
        thread_id, str(run_wall_clock_cap),
    )
    # res like 'UPDATE 0' / 'UPDATE 1'
    try:
        return int(res.split()[-1])
    except Exception:
        return 0


def run_cap_seconds(definition, margin_seconds: int = 600) -> int:
    """Conservative whole-run wall-clock cap (Pitfall 4 / A2).

    ``harness_phase_wall_clock_seconds`` (3600) is PER-PHASE; no whole-run cap exists.
    Sum the per-phase caps (each phase's ``config.wall_clock_seconds`` or the default)
    + a margin — a safe upper bound so the run can't die mid-flight from template
    expiry (T-100-05-03). Defensive getattr: phase configs without a
    ``wall_clock_seconds`` field (programmatic / llm_single / llm_human_input) fall
    back to the per-phase default.
    """
    from app.config import settings

    default_phase = getattr(settings, "harness_phase_wall_clock_seconds", 3600)
    total = 0
    for ph in getattr(definition, "phases", []) or []:
        config = getattr(ph, "config", None)
        total += getattr(config, "wall_clock_seconds", None) or default_phase
    return total + margin_seconds


# ── TDD-contract alias ─────────────────────────────────────────────────────────
# The Wave 0 scaffold (test_workspace_template.py::test_sweep_deletes_rows_and_bytes)
# imports the symbol under the name ``sweep_expired_templates``. Keep ``sweep_expired``
# as the canonical short name (plan must_haves / verify command / acceptance greps)
# and expose the longer alias so the cross-plan TDD contract resolves to the same fn.
sweep_expired_templates = sweep_expired
