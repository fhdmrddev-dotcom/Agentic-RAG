"""Skill publish gate read-model (Phase 136, GATE-01).

``compute_publish_gate(supabase, skill_id, user_id)`` is the ONE gate-compute helper every
enforcement + UI surface reads (the gated ``toggle_global`` in Plan 02, the gate readout in
Plan 03). It is a pure READ over ``skills`` / ``eval_runs`` / ``skill_versions`` /
``skill_publish_overrides`` — recompute-on-read, no schema writes (the ``evals.py``
``_compute_gate`` contract).

The two load-bearing rules:

* **D-03 (authoritative pass rule):** a run satisfies the gate only when it is a COMPLETED
  ``eval_runs`` row with ``measured_count >= 1 AND passed_count == measured_count`` — the
  byte-identical boolean migration 081 writes at finalize (``eval_runner_service.py:687-690``),
  recomputed here from the NUMERIC columns. ``verdict_summary`` display text is NEVER trusted.
  Interrupted / cancelled / non-completed runs carry the honest NULL rollup and are excluded
  by the ``status == "completed"`` filter (adversarially: even a non-completed row carrying
  counts is excluded).

* **D-04 (current-version binding by CONTENT-EQUALITY):** a passing run counts only when the
  instructions text pinned by its ``skill_version_id`` equals the LIVE ``skills.instructions``.
  Version-id equality would be wrong twice over: a manual edit after a pass must reset the
  gate (content differs → unmet), while a Phase-135 promotion that creates a near-duplicate
  version row with IDENTICAL text must still read "current version passed" (content matches →
  met, even though the run pins the OLDER version id).

Read strategy: eval_runs and their pinned version instructions are fetched as two owner-scoped
queries (runs, then ``skill_versions.in_("id", …)``) and joined in Python — the RESEARCH
Pattern-1 equivalent of the PostgREST FK-embed
(``select("…, skill_versions(instructions)")``), chosen so the exact production code path is
exercised by the in-memory test store (which cannot resolve embeds).

Owner-scoping: every read filters ``.eq("user_id", user_id)`` on the service-role client — the
REAL gate (RLS is bypassed by service-role; owner-only SELECT RLS on
``skill_publish_overrides`` is defense-in-depth) (T-136-04). All blocking supabase-py calls are
wrapped in ``run_in_threadpool`` (D-v2.5-01 — this NEW code follows the evals.py wrap pattern
even though the legacy skills.py handlers do not).
"""
import logging

from fastapi.concurrency import run_in_threadpool

from app.models.skill import PublishGate

logger = logging.getLogger(__name__)

# The four honest gate states (PublishGate.state).
STATE_PASSED = "passed"
STATE_NEVER_EVALED = "never_evaled"
STATE_LATEST_FAILED = "latest_failed"
STATE_PASSED_ON_OLDER_VERSION = "passed_on_older_version"


def _passes_d03(run: dict) -> bool:
    """The authoritative per-run pass predicate (D-03) — NUMERIC columns only, never
    ``verdict_summary`` text: ``measured_count >= 1 AND passed_count == measured_count``."""
    measured_count = run.get("measured_count")
    passed_count = run.get("passed_count")
    return (
        measured_count is not None
        and measured_count >= 1
        and passed_count == measured_count
    )


async def compute_publish_gate(supabase, skill_id: str, user_id: str) -> PublishGate:
    """Compute the honest publish-gate state for one skill, owner-scoped (GATE-01).

    Returns a :class:`PublishGate`. Raises ``LookupError`` when the skill does not exist or
    is not owned by ``user_id`` (callers owner-verify before compute — evals.py
    ``_verify_owned_skill`` precedent — so this is a defense-in-depth backstop, T-136-04).
    """
    # (1) Owner-scoped read of the skills row — the REAL gate (service-role bypasses RLS).
    def _read_skill():
        return (
            supabase.table("skills")
            .select("id, instructions, is_global")
            .eq("id", skill_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

    skill_rows = list((await run_in_threadpool(_read_skill)).data or [])
    if not skill_rows:
        raise LookupError("skill not found")
    current_instructions = skill_rows[0].get("instructions")

    # (2) Completed eval runs for this skill, owner-scoped. Non-completed runs (interrupted /
    # cancelled / running) are excluded HERE — they carry the honest NULL rollup (D-03
    # finalize guard) and must never satisfy the gate.
    def _read_completed_runs():
        return (
            supabase.table("eval_runs")
            .select("id, status, passed_count, measured_count, skill_version_id, created_at")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .eq("status", "completed")
            .execute()
        )

    completed = list((await run_in_threadpool(_read_completed_runs)).data or [])
    completed.sort(key=lambda r: r.get("created_at") or "")

    # (2b) Pinned version instructions for those runs (owner-scoped) — joined in Python
    # (the RESEARCH Pattern-1 two-query equivalent of the FK-embed).
    instructions_by_version_id: dict[str, str] = {}
    version_ids = sorted({str(r["skill_version_id"]) for r in completed if r.get("skill_version_id")})
    if version_ids:

        def _read_versions():
            return (
                supabase.table("skill_versions")
                .select("id, instructions")
                .eq("skill_id", skill_id)
                .eq("user_id", user_id)
                .in_("id", version_ids)
                .execute()
            )

        for row in list((await run_in_threadpool(_read_versions)).data or []):
            instructions_by_version_id[str(row["id"])] = row.get("instructions")

    # (3) Most-recent owner-visible override record (D-02) — {gate_state, created_at} or None.
    def _read_last_override():
        return (
            supabase.table("skill_publish_overrides")
            .select("gate_state, created_at")
            .eq("skill_id", skill_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

    override_rows = list((await run_in_threadpool(_read_last_override)).data or [])
    last_override = None
    if override_rows:
        last_override = {
            "gate_state": override_rows[0].get("gate_state"),
            "created_at": override_rows[0].get("created_at"),
        }

    # (4) Per-run predicate: D-03 numeric pass AND D-04 content-equality with the LIVE text.
    def _on_current_version(run: dict) -> bool:
        pinned = instructions_by_version_id.get(str(run.get("skill_version_id")))
        return pinned is not None and pinned == current_instructions

    d03_passing = [r for r in completed if _passes_d03(r)]
    current_passing = [r for r in d03_passing if _on_current_version(r)]

    # (5) Honest state — most-recent relevant run supplies the counts. Precedence when mixed
    # history exists: "passed_on_older_version" beats "latest_failed" (the more actionable
    # pointer — re-eval the current version).
    if current_passing:
        best = current_passing[-1]
        return PublishGate(
            met=True,
            state=STATE_PASSED,
            measured=best.get("measured_count"),
            passed=best.get("passed_count"),
            passing_run_id=str(best["id"]),
            reason=(
                f"{best.get('passed_count')}/{best.get('measured_count')} measured cases "
                "passed on the current version"
            ),
            last_override=last_override,
        )

    if d03_passing:
        stale = d03_passing[-1]
        return PublishGate(
            met=False,
            state=STATE_PASSED_ON_OLDER_VERSION,
            measured=stale.get("measured_count"),
            passed=stale.get("passed_count"),
            passing_run_id=None,
            reason=(
                f"A passing eval ({stale.get('passed_count')}/{stale.get('measured_count')} "
                "measured cases) exists, but for older instructions — re-run the eval on the "
                "current version"
            ),
            last_override=last_override,
        )

    if completed:
        latest = completed[-1]
        return PublishGate(
            met=False,
            state=STATE_LATEST_FAILED,
            measured=latest.get("measured_count"),
            passed=latest.get("passed_count"),
            passing_run_id=None,
            reason=(
                f"Latest completed eval passed {latest.get('passed_count') or 0}/"
                f"{latest.get('measured_count') or 0} measured cases — not a full pass"
            ),
            last_override=last_override,
        )

    return PublishGate(
        met=False,
        state=STATE_NEVER_EVALED,
        measured=None,
        passed=None,
        passing_run_id=None,
        reason="No completed eval has measured this skill yet — run an eval before publishing",
        last_override=last_override,
    )
