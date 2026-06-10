"""Phase 099 — the skill-snapshot host service (WFSKILL-01 / SC#2).

Two owner-scoped, server-side functions that make a published workflow run
*identically regardless of what happens to the source skill afterward* — the
load-bearing decision (D-01/D-02/D-03a): determinism beats freshness.

  1. ``validate_skill_refs`` — the D-10 PUBLISH GATE. For every phase whose config
     carries a ``skill_ref``, resolve it against the OWNED-OR-GLOBAL + ``is_enabled``
     predicate. A ref that resolves to nothing (missing/deleted), to another user's
     PRIVATE skill (not visible), or to a DISABLED skill raises ``ValueError`` (the
     run-start callers in Plan 04 map it to a 400). This is a definition-VALIDITY
     gate — a different failure class from the structural ``@model_validator`` on
     ``WorkflowDefinition`` (which needs no DB), and the only place skill existence /
     visibility / enabled-state is proven against the real ``skills`` table.

  2. ``materialize_skill_snapshots`` — the D-01/D-02/D-03a MATERIALIZER. For every
     phase with a ``skill_ref`` but no ``skill_snapshot`` yet, copy the live skill's
     instructions/name/description into the phase config's ``skill_snapshot`` JSONB
     AND Storage-copy each skill file from the live skill prefix to a workflow-owned
     snapshot prefix. IDEMPOTENT (D-03a / Pitfall 3): a definition whose skill-bearing
     phases already carry a snapshot is returned unchanged — the snapshot lives in the
     DB JSONB + Storage (shared across workers), never an in-process cache.

THREAT (T-099-02 / Elevation / IDOR): the resolve query is OWNED-OR-GLOBAL
(``.or_(user_id.eq…,is_global.eq.true)``); a non-visible id resolves to no row and
the ``ValueError`` message is GENERIC — it never confirms another user's skill
exists (no existence leak). Both functions are OWNER-scoped via ``user_id``; the
harness runs as service role (bypasses RLS), so the caller MUST pass the durable
run owner's id — never widen across users (the ``scope.py`` threat posture).

THREAT (T-099-03 / Information Disclosure, ACCEPTED — documented for Phase 109):
snapshot copies live under ``{user_id}/_snapshots/{def-slug}-v{version}/{skill_id}``.
The leading ``{user_id}`` segment keeps the existing ``skill-files`` first-segment
SELECT RLS (``017_skills.sql``) scoping reads to the author, and the run-time read
runs as service role. There is NO self-serve global publish today (Phase 109); when
one lands, global publish needs a global-readable prefix variant — the snapshot
prefix is the seam to revisit. Do NOT widen the prefix here.

THREAT (T-099-10 / Denial of Service): every Storage ``.download()``/``.upload()``
in the materializer is wrapped in ``run_in_threadpool`` (D-v2.5-01 / Pitfall 1) so
a multi-file copy never stalls the async worker.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from starlette.concurrency import run_in_threadpool

from app.utils.db import aexec

if TYPE_CHECKING:  # pragma: no cover — typing only
    from supabase import Client

    from app.models.harness import WorkflowDefinition


# The OWNED-OR-GLOBAL + enabled resolve predicate (adapted from
# tool_dispatcher.py:346-353 _handle_load_skill, .eq("name")→.eq("id") per D-09).
# NOTE: there is NO ``files`` column on the ``skills`` table — the file MANIFEST is
# fetched SEPARATELY from the ``skill_files`` table inside materialize_skill_snapshots
# (D-06 — names, not contents), exactly as _handle_load_skill does. Do NOT add a
# ``files`` token here.
_SKILL_SELECT = "id, name, description, instructions, user_id, is_enabled, is_global"


def _resolve_skill_query(supabase, *, skill_ref, user_id):
    """Build the owned-or-global + enabled resolve query for a skill_ref (D-09/D-10)."""
    return (
        supabase.table("skills")
        .select(_SKILL_SELECT)
        .or_(f"user_id.eq.{user_id},is_global.eq.true")   # D-10 owned-or-global (T-099-02 IDOR)
        .eq("id", str(skill_ref))                          # D-09 by UUID, not name
        .eq("is_enabled", True)                            # D-10 enabled gate (T-099-01)
        .maybe_single()
    )


def _is_resolvable(row) -> bool:
    """A row is usable only if it is enabled AND visible.

    The owned-or-global VISIBILITY decision is enforced by the DB ``.or_`` clause in
    ``_resolve_skill_query`` (production); a non-visible skill simply resolves to no
    row. We re-check ``is_enabled`` (the DB also filters it, but a defensive re-check
    keeps the gate correct if the row is ever fetched outside that predicate) and
    honor an explicit ``visible`` flag (a test-only construct standing in for the
    ``.or_`` visibility the offline fakes do not model). A missing field defaults to
    the permissive value a real selected row would carry.
    """
    if not row:
        return False
    if not row.get("is_enabled", True):       # disabled → reject (T-099-01)
        return False
    if not row.get("visible", True):          # not visible (another user's private) → reject (T-099-02)
        return False
    return True


async def validate_skill_refs(
    definition: "WorkflowDefinition",
    *,
    supabase: "Client",
    user_id: str,
) -> None:
    """D-10 publish gate — raise ``ValueError`` on a missing/not-visible/disabled skill_ref.

    For every phase whose config carries a ``skill_ref``, resolve it against the
    owned-or-global + enabled predicate. If it resolves to no usable row, raise
    ``ValueError`` with a GENERIC message (never leak whether another user's skill
    exists — T-099-02). Owner-scoped via ``user_id`` (the run owner).
    """
    for phase in definition.phases:
        skill_ref = getattr(phase.config, "skill_ref", None)
        if skill_ref is None:
            continue
        resp = await aexec(_resolve_skill_query(supabase, skill_ref=skill_ref, user_id=user_id))
        row = resp.data if resp is not None else None
        if isinstance(row, list):
            row = row[0] if row else None
        if not _is_resolvable(row):
            raise ValueError(
                f"phase '{phase.slug}' references skill {skill_ref} which is not "
                f"found, not visible to you, or disabled"
            )


async def materialize_skill_snapshots(
    definition: "WorkflowDefinition",
    *,
    run_id=None,
    supabase: "Client",
    user_id: str,
    definition_id: str | None = None,
) -> "WorkflowDefinition":
    """D-01/D-02/D-03a — copy each referenced skill into an immutable per-phase snapshot.

    IDEMPOTENT (D-03a / Pitfall 3): if EVERY skill-bearing phase already carries a
    ``skill_snapshot`` this returns ``definition`` unchanged (the snapshot lives in
    DB JSONB + Storage, shared across workers — never an in-process cache). Otherwise,
    for each phase with a ``skill_ref`` but no ``skill_snapshot``:

      - resolve the live skill row (re-running the gate inline so this is safe to call
        without a prior ``validate_skill_refs`` — the Plan 04 kickoff caller validates
        first regardless);
      - copy the live skill's filenames + Storage-copy each file from the live prefix
        ``{owner}/{skill_id}/{filename}`` to the snapshot prefix
        ``{user_id}/_snapshots/{slug}-v{version}/{skill_id}`` (Pitfall 7: ``{user_id}``
        first segment keeps the existing skill-files RLS granting the author read);
      - write a :class:`SkillSnapshot` onto ``phase.config.skill_snapshot``.

    Every Storage call is wrapped in ``run_in_threadpool`` (D-v2.5-01 / Pitfall 1 /
    T-099-10) — blocking HTTP that would otherwise stall the event loop on a multi-file
    copy. ``run_id`` keys nothing here (the prefix is def slug+version per D-03a) but is
    accepted so the kickoff caller can pass it; ``definition_id`` (optional) persists the
    materialized definition back to the DB row — skipped when ``None`` (keeps unit tests
    offline; the lazy first-kickoff re-materializes in-memory each run otherwise).

    Local import of :class:`SkillSnapshot` inside the function to avoid any harness
    model import cycle at module load (the ``scope.py`` import discipline).
    """
    from app.models.harness import SkillSnapshot

    skill_phases = [
        p for p in definition.phases if getattr(p.config, "skill_ref", None) is not None
    ]
    # Idempotency first (D-03a / Pitfall 3): nothing to do if every skill phase is snapshotted.
    # RE-MATERIALIZATION LIMITATION (CR-01 / VERIFICATION.md): the empty-manifest snapshots
    # persisted BEFORE this fix (when ``filenames`` always came back ``[]`` from the phantom
    # ``skills.files`` read) are LOCKED by this idempotency check — a definition whose phases
    # already carry a ``skill_snapshot`` with ``files: []`` will NOT auto-heal. A one-off
    # re-materialization sweep is a future concern, NOT this gap's scope (it would change the
    # idempotency semantics); the dev DB likely has no such rows.
    if skill_phases and all(
        getattr(p.config, "skill_snapshot", None) is not None for p in skill_phases
    ):
        return definition

    changed = False
    for phase in skill_phases:
        if getattr(phase.config, "skill_snapshot", None) is not None:
            continue  # already materialized (mixed-state definition) — leave it
        skill_ref = phase.config.skill_ref

        resp = await aexec(_resolve_skill_query(supabase, skill_ref=skill_ref, user_id=user_id))
        row = resp.data if resp is not None else None
        if isinstance(row, list):
            row = row[0] if row else None
        if not _is_resolvable(row):
            raise ValueError(
                f"phase '{phase.slug}' references skill {skill_ref} which is not "
                f"found, not visible to you, or disabled"
            )

        owner = row.get("user_id")
        # CR-01 — files live in the skill_files table, NOT a skills column (mirrors
        # _handle_load_skill, tool_dispatcher.py:375-383). Keyed by the resolved
        # (validated) skill id; .eq("skill_id", str(skill_ref)) has no injection surface
        # (skill_ref is a Pydantic-validated UUID). T-099-CR01-01.
        _files_resp = await aexec(
            supabase.table("skill_files")
            .select("filename")
            .eq("skill_id", str(skill_ref))
            .order("filename")
        )
        filenames = [f["filename"] for f in (_files_resp.data or [])]
        storage_prefix = (
            f"{user_id}/_snapshots/{definition.slug}-v{definition.version}/{skill_ref}"
        )

        # Storage-copy each file: download from the live prefix, upload to the snapshot
        # prefix. BOTH wrapped in run_in_threadpool (Pitfall 1 / T-099-10).
        for filename in filenames:
            src_path = f"{owner}/{skill_ref}/{filename}"
            raw = await run_in_threadpool(
                lambda p=src_path: supabase.storage.from_("skill-files").download(p)
            )
            dst_path = f"{storage_prefix}/{filename}"
            await run_in_threadpool(
                lambda p=dst_path, b=raw: supabase.storage.from_("skill-files").upload(
                    path=p,
                    file=b,
                    file_options={"content-type": "application/octet-stream", "upsert": "true"},
                )
            )

        snap = SkillSnapshot(
            skill_id=skill_ref,
            name=row.get("name") or "",
            description=row.get("description"),
            instructions=row.get("instructions") or "",
            files=filenames,
            storage_prefix=storage_prefix,
        )
        # Declared field on a non-frozen _StrictBase → direct assignment (the snapshot
        # is the in-memory authority for this run; persistence below is optional).
        phase.config.skill_snapshot = snap
        changed = True

    # PERSISTENCE (D-03a / 099-07): persist the materialized snapshots to the
    # skill_snapshots SIBLING column (migration 067) — NOT the definition JSONB,
    # which is locked by the published-immutability trigger (056). Keyed by phase
    # slug. The `.is_("skill_snapshots", "null")` CAS guard means a concurrent
    # double-kickoff LOSER updates 0 rows and proceeds with its identical in-memory
    # snapshot (deterministic storage_prefix → same content); closes IN-03 (no-CAS
    # race, REVIEW.md). Skipped when no definition_id (keeps unit tests offline).
    if changed and definition_id is not None:
        snapshots_map = {
            p.slug: p.config.skill_snapshot.model_dump(mode="json")
            for p in skill_phases
            if getattr(p.config, "skill_snapshot", None) is not None
        }
        await run_in_threadpool(
            lambda: supabase.table("workflow_definitions")
            .update({"skill_snapshots": snapshots_map})
            .eq("id", definition_id)
            .is_("skill_snapshots", "null")
            .execute()
        )

    return definition


def graft_skill_snapshots(definition, snapshots_map):
    """Re-attach persisted snapshots (099-07) onto a freshly-parsed definition.

    The materialized snapshots live in the workflow_definitions.skill_snapshots
    sibling column (NOT the locked definition JSONB), so a definition parsed from
    the DB carries None on every phase.config.skill_snapshot. This grafts each
    persisted snapshot back, keyed by phase slug, BEFORE validate/materialize at the
    read points (kickoff + run-definition load). For a phase that has a skill_ref but
    no snapshot yet, if `snapshots_map` carries its slug, validate + assign a
    SkillSnapshot. A None/empty/missing-slug map is a no-op (graft is safe to call
    unconditionally). Malformed stored JSON raises pydantic.ValidationError
    (fail-closed — never silently runs a half-grafted definition).
    """
    if not snapshots_map:
        return definition
    from app.models.harness import SkillSnapshot

    for phase in definition.phases:
        if getattr(phase.config, "skill_ref", None) is None:
            continue
        if getattr(phase.config, "skill_snapshot", None) is not None:
            continue
        stored = snapshots_map.get(phase.slug)
        if stored is None:
            continue
        phase.config.skill_snapshot = SkillSnapshot.model_validate(stored)
    return definition


# Plan-prose alias (D-03a "if needed"): the idempotency check lives INSIDE
# materialize_skill_snapshots, so this is the same call. Kept so callers and the
# plan's "materialize_skill_snapshots_if_needed" naming both resolve.
materialize_skill_snapshots_if_needed = materialize_skill_snapshots
