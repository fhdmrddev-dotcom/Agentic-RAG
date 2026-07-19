"""Phase 162.5 Plan 02 (G-5 extraction) — workflow-kickoff machinery lifted out of
``backend/app/api/threads.py``, behavior-preserving.

This is Wave 2 of the ``threads.py`` producer extraction (D-A2/D-A4/D-A5). It owns
two harness-only surfaces that used to live inline in ``send_message`` /
``agent_runner``:

1. **Kickoff preflight** — ``_ensure_skill_snapshots`` plus
   ``preflight_workflow_kickoff`` (the anchor 409-lock check + the
   ``body.workflow_definition_id is not None`` block: the workflows kill-switch 403,
   the RLS-scoped published-definition resolve, the 098 folder-scope ⊆ assert, the
   099 skill-snapshot materialize, and the 100 template pin).
2. **Harness run-context build** — ``build_harness_run_context`` (the thread-folder /
   project-subtree scope resolution, the WR-03 bound-workflow fail-closed guard, and
   the ``SimpleNamespace`` ``wf_ctx`` the engine threads through — see Task 2 below).

**Behavior-preserving contract (byte-identical, D-A7):**

- Every ``HTTPException`` status/detail is copied VERBATIM, and the fail-closed
  ordering is unchanged: a refused kickoff (409 lock / 403 kill-switch / 404 not-found
  / 400 not-published / 400 bad-scope / 400 disabled-skill / 500 snapshot-fault) raises
  BEFORE ``send_message`` inserts the user message — no partial run row, no blank
  thread. A plain Deep send (no anchor, ``workflow_definition_id is None``) returns
  ``(None, None)`` — a byte-identical no-op that never consults the kill-switch.
- The ``app.api.threads.*`` patch surface is preserved (D-A4): ``_ensure_skill_snapshots``
  is re-imported into ``threads.py`` so ``from app.api.threads import
  _ensure_skill_snapshots`` (test_099) still resolves, and ``workflows_enabled`` /
  ``get_pg_pool`` are resolved LATE off ``app.api.threads`` inside the seam so
  ``patch("app.api.threads.workflows_enabled")`` (test_147) + the
  ``app.api.threads.get_pg_pool`` patch (test_dual_mode_wiring) still intercept.
- ``_ensure_skill_snapshots`` calls the skill-snapshot service functions THROUGH the
  ``_skill_snapshot`` module object, so a ``monkeypatch.setattr(snap_mod, ...)`` on
  ``app.services.harness.skill_snapshot`` (test_099's kickoff-wiring tests) still
  intercepts the relocated body.
"""
import json
import logging
from uuid import UUID

from fastapi import HTTPException, status

from app.utils.db import aexec
from app.services.harness.scope import assert_folder_scopes_subset
# Imported as a MODULE (not bound names) so the kickoff seam calls
# validate_skill_refs / materialize_skill_snapshots_if_needed / graft_skill_snapshots
# THROUGH the module object — keeps the seam patchable (test_099 monkeypatches
# app.services.harness.skill_snapshot.* and drives _ensure_skill_snapshots directly).
from app.services.harness import skill_snapshot as _skill_snapshot

logger = logging.getLogger(__name__)


async def _ensure_skill_snapshots(
    *, definition, run_id, supabase, user_id, definition_id=None, skill_snapshots=None
):
    """099 WFSKILL-01 (D-10 gate + D-03a lazy snapshot) — the kickoff seam.

    Delegates ALL gate/copy logic to ``skill_snapshot.py`` (G-5: the hot file gains
    only this thin wrapper + the import — no inline skill-resolution query or Storage
    call). 099-07: grafts the persisted snapshots (the ``skill_snapshots`` sibling
    column, NOT the locked ``definition`` JSONB) onto the parsed definition FIRST, so a
    2nd+ kickoff hands the materializer a fully-snapshotted definition → idempotent
    early-return (no persist, no 23514); a ``None`` map is a no-op (first kickoff).
    Then runs the D-10 publish gate (``ValueError → HTTPException 400``, the exact shape
    the 098 ``assert_folder_scopes_subset`` call-site uses — never a silent run on a
    disabled/missing/non-visible skill) and materializes the immutable snapshot at FIRST
    kickoff (idempotent, keyed by ``definition_id`` for the persist-back). An UNEXPECTED
    materializer failure (anything that is NOT the ValueError→400 gate) maps to a
    structured ``HTTPException(500)`` — never a naked ASGI traceback (the reported blank-
    thread symptom); the fail-closed ordering (before the user-message insert) is
    unchanged. Returns the (possibly snapshot-augmented) definition so the caller
    reassigns it for the downstream run. A no-skill workflow is byte-identical: graft +
    validate are no-ops and materialize returns the definition unchanged.

    The service functions are called THROUGH the module object (``_skill_snapshot.``)
    so the seam stays patchable. Structured so the Phase-103 publish endpoint can call
    the same materializer at true publish time.
    """
    # 099-07: graft persisted snapshots (sibling column) onto the parsed definition
    # BEFORE validate/materialize. On a 2nd+ kickoff every phase is already
    # snapshotted → materialize early-returns (no persist, no 23514). A None map is
    # a no-op (first kickoff). Delegated to skill_snapshot.py (G-5: thin wrapper).
    definition = _skill_snapshot.graft_skill_snapshots(definition, skill_snapshots)
    try:
        await _skill_snapshot.validate_skill_refs(
            definition, supabase=supabase, user_id=user_id
        )
    except ValueError as _skill_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(_skill_err),
        )
    try:
        return await _skill_snapshot.materialize_skill_snapshots_if_needed(
            definition,
            run_id=run_id,
            supabase=supabase,
            user_id=user_id,
            definition_id=definition_id,
        )
    except HTTPException:
        raise
    except Exception as _mat_err:   # noqa: BLE001 — structured fail-closed (099-07)
        # An unexpected materializer failure (e.g. a DB trigger edge) must return
        # structured JSON, NOT a naked ASGI traceback. 500 (not 503): a true server
        # fault, not a transient upstream — the operator wants a stable error body
        # so the kickoff dies cleanly BEFORE the user-message insert (no blank
        # thread). The fail-closed ordering is unchanged.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"skill snapshot materialization failed: {_mat_err}",
        )


async def preflight_workflow_kickoff(*, body, thread_id, thread_row, supabase, current_user):
    """Phase 162.5 Plan 02 — the ``send_message`` workflow-kickoff preflight, moved verbatim.

    Holds the anchor 409-lock check + the ``body.workflow_definition_id is not None``
    block. Returns ``(kickoff_definition, kickoff_definition_id)`` — the parsed
    ``WorkflowDefinition`` (skill-snapshot-augmented) + its ``workflow_definitions.id``
    when kicking off, else ``(None, None)``. ``thread_row`` is the already-fetched
    thread-ownership row (``thread_resp.data``) — NO re-fetch here (test_147 asserts the
    refused-launch path makes exactly ONE DB call: the thread-ownership SELECT in the
    caller). ``workflows_enabled`` / ``get_pg_pool`` resolve LATE off ``app.api.threads``
    so the test patch surface still intercepts (D-A4). Byte-identical to the inline block.
    """
    # ── Phase 092 MODE-01 / MODE-02 — server-side lock + workflow kickoff ──────
    # This is the AUTHORITATIVE workflow lock (the grayed client toggle is courtesy
    # only — D-05). The anchor + its run's terminal-state decide whether a send is
    # allowed and whether it kicks off a workflow. Done BEFORE the user-message
    # INSERT so a refused send writes nothing.
    _existing_anchor = (thread_row or {}).get("active_workflow_run_id")
    _kickoff_definition = None          # parsed WorkflowDefinition when kicking off
    _kickoff_definition_id = None       # workflow_definitions.id for the kickoff
    if _existing_anchor is not None:
        # get_pg_pool resolved LATE off threads so patch("app.api.threads.get_pg_pool")
        # (test_dual_mode_wiring) still intercepts the relocated body (D-A4).
        from app.api.threads import get_pg_pool
        # A run currently holds the lock — is it still live (non-terminal)?
        _pool = await get_pg_pool()
        _anchor_status = await _pool.fetchval(
            "SELECT status FROM workflow_runs WHERE id = $1",
            UUID(_existing_anchor) if isinstance(_existing_anchor, str) else _existing_anchor,
        )
        _TERMINAL_WORKFLOW = ("completed", "failed", "cancelled")
        if _anchor_status is not None and _anchor_status not in _TERMINAL_WORKFLOW:
            # The lock holds. Refuse a Deep send AND a different-workflow send
            # (SC#2 / MODE-02 — the binding 409, not just a grayed button). A
            # send is only allowed if it targets THE SAME active run (continuation
            # of the locked workflow). Since the kickoff field carries a
            # *definition* id (not the run id), any kickoff against a locked thread
            # is a different-workflow attempt → refuse. The lock is cleared by
            # cancel / natural terminal (Plan 03), never by this handler.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Thread is workflow-locked — cancel the active workflow to "
                    "switch back to Deep mode."
                ),
            )
        # else: anchor is set but its run is terminal/absent (a stale lock). We do
        # NOT clear it here (the GET reconcile reports lock_is_stale; cancel/terminal
        # owns the clear). A fresh kickoff below will re-point the anchor atomically.

    if body.workflow_definition_id is not None:
        # workflows_enabled resolved LATE off threads so patch("app.api.threads.
        # workflows_enabled") (test_147) still intercepts. Imported HERE (inside the
        # NEW-launch branch), so a plain Deep send never even imports it and — more to
        # the point — never CALLS it (test_147 asserts wf_gate.assert_not_called()).
        from app.api.threads import workflows_enabled
        # ── Phase 147 (FLAG-01 / D-05) — workflows kill-switch: block NEW launches ──
        # Fires ONLY here (inside the NEW-launch branch) and BEFORE any definition
        # resolve / user-message insert / create_workflow_run, so a refused launch
        # leaves NO partial run row and NO blank message (the same fail-closed-before-
        # insert discipline the kickoff already follows). Scope is deliberately narrow:
        #   * in-flight workflow runs are UNTOUCHED (Kill is the tool for those — D-05);
        #     a locked-thread kickoff already 409s above, so we never reach here for one.
        #   * a plain Deep send (workflow_definition_id is None) never enters this branch
        #     → Deep chat is byte-identical regardless of the flag.
        # workflows_enabled() reads the plan-01 last-known-good TTL cache (default-ON on a
        # blip — D-Q4), so a transient settings-read failure never blocks a legit launch.
        if not workflows_enabled():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Workflows are currently disabled by the administrator",
            )
        # Resolve+parse the published definition UNDER THE USER'S RLS (T-092-05 IDOR
        # mitigation): only a published, owned-or-global definition may be kicked
        # off. A non-owned / private / unpublished id is refused 404 (never leaks
        # existence) — a user cannot start another user's private workflow.
        _def_resp = await aexec(
            supabase.table("workflow_definitions")
            .select("id, definition, status, is_global, created_by, skill_snapshots")
            .eq("id", str(body.workflow_definition_id))
            .or_(f"is_global.eq.true,created_by.eq.{current_user['id']}")
            .maybe_single()
        )
        _def_row = _def_resp.data if _def_resp is not None else None
        if not _def_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found",
            )
        if _def_row.get("status") != "published":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow is not published",
            )
        from app.models.harness import WorkflowDefinition
        _raw_def = _def_row["definition"]
        if isinstance(_raw_def, str):
            _raw_def = json.loads(_raw_def)
        _kickoff_definition = WorkflowDefinition.model_validate(_raw_def)
        _kickoff_definition_id = _def_row["id"]
        # 099-07: the materialized snapshots live in the skill_snapshots SIBLING column
        # (not the locked definition JSONB) → load them so the kickoff seam can graft
        # them back onto the parsed definition (idempotent 2nd-kickoff). May arrive as a
        # JSON string via PostgREST — mirror the definition parse (json imported above).
        _kickoff_skill_snapshots = _def_row.get("skill_snapshots")
        if isinstance(_kickoff_skill_snapshots, str):
            _kickoff_skill_snapshots = json.loads(_kickoff_skill_snapshots)
        # 098 (D-07 DB half — GOV-01): a non-⊆ declared phase scope is a definition
        # VALIDITY error that must fail LOUDLY at run-start (NOT a silent runtime
        # clip — Pitfall 5). Resolve the project subtree and assert every per-phase
        # folder_scope ⊆ it; surface the ValueError as a 400 (a bad definition, not
        # a runtime degrade). Owner-scoped via current_user["id"].
        try:
            await assert_folder_scopes_subset(
                _kickoff_definition, supabase=supabase, user_id=current_user["id"]
            )
        except ValueError as _scope_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(_scope_err),
            )

        # 099 WFSKILL-01 (D-10 gate + D-03a lazy snapshot): validate every phase
        # skill_ref resolves to a visible, enabled skill (ValueError → 400, same as the
        # 098 scope assert — never a silent run on a disabled/missing skill), then
        # materialize the immutable snapshot at FIRST kickoff (idempotent: subsequent
        # runs reuse the persisted snapshot, keyed by definition id). Drafts can't reach
        # here (status='published' enforced above), so first-kickoff IS the first moment
        # a snapshot is needed. The seam delegates ALL gate/copy logic to
        # skill_snapshot.py (G-5: no inline query/Storage call in this hot file). The
        # materialized definition rides the phase configs the downstream run reads.
        _kickoff_definition = await _ensure_skill_snapshots(
            definition=_kickoff_definition,
            run_id=None,
            supabase=supabase,
            user_id=current_user["id"],
            definition_id=str(_kickoff_definition_id),
            skill_snapshots=_kickoff_skill_snapshots,
        )

        # 100 D-09 run-pin: extend each template_input file's expiry to cover this
        # run's wall-clock cap so it can't die mid-flight from template expiry (D-09).
        # Thin delegating call — ALL logic (the extend-only expiry write + the cap
        # formula) lives in template_service (G-5: no inline query/Storage call in this
        # hot file). D-11: a thread with no template_input row → the write no-ops.
        from app.services import template_service as _template_service
        from app.api.threads import get_pg_pool
        await _template_service.pin_templates_for_run(
            pool=await get_pg_pool(),
            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            run_wall_clock_cap=_template_service.run_cap_seconds(_kickoff_definition),
        )

    return _kickoff_definition, _kickoff_definition_id
