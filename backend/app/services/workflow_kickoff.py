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
import asyncio
import json
import logging
from types import SimpleNamespace
from uuid import UUID

from fastapi import HTTPException, status

from app.config import settings
from app.utils.db import aexec
from app.utils.folder_utils import fetch_visible_folders
from app.services.harness.scope import (
    assert_folder_scopes_subset,
    resolve_project_subtree,
    resolve_run_scope_root,
)
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


async def preflight_workflow_kickoff(*, request, body, thread_id, thread_row, supabase, current_user):
    """Phase 162.5 Plan 02 — the ``send_message`` workflow-kickoff preflight, moved verbatim.

    Holds the anchor 409-lock check + the ``body.workflow_definition_id is not None``
    block. Returns ``(kickoff_definition, kickoff_definition_id)`` — the parsed
    ``WorkflowDefinition`` (skill-snapshot-augmented) + its ``workflow_definitions.id``
    when kicking off, else ``(None, None)``. ``thread_row`` is the already-fetched
    thread-ownership row (``thread_resp.data``) — NO re-fetch here (test_147 asserts the
    refused-launch path makes exactly ONE DB call: the thread-ownership SELECT in the
    caller). ``workflows_enabled`` / ``get_pg_pool`` resolve LATE off ``app.api.threads``
    so the test patch surface still intercepts (D-A4). Byte-identical to the inline block.

    Phase 163 (D-02/D-03): ``request`` is threaded in from ``send_message`` so the anchor
    lock-check ``workflow_runs`` status read runs under RLS on the per-request user-JWT
    connection (T-163-06c — the BLOCKER fix). ``supabase`` is send_message's swapped
    user-JWT client, so the ``workflow_definitions`` resolve + the 098/099 gates already
    run under RLS.
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
        # Phase 163 (D-02 / T-163-06c — THE BLOCKER FIX): this ``workflow_runs`` status
        # read is called SYNCHRONOUSLY request-scoped from send_message (threads.py:753)
        # BEFORE any INSERT, so after the Wave-4 client swap it MUST run under RLS — a raw
        # ``get_pg_pool().fetchval`` here read a TEN-01 table as postgres/BYPASSRLS (the
        # D-02 / Pitfall-6 cross-org leak signature). Run it on the per-request user-JWT
        # connection (SET LOCAL ROLE authenticated + both GUC forms); request/current_user
        # are threaded from send_message. A run currently holds the lock — still live?
        from app.dependencies import get_user_pg_connection
        async with get_user_pg_connection(request, current_user) as _conn:
            _anchor_status = await _conn.fetchval(
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
            .select("id, definition, status, is_system_global, created_by, skill_snapshots")
            .eq("id", str(body.workflow_definition_id))
            .or_(f"is_system_global.eq.true,created_by.eq.{current_user['id']}")
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
        # Phase 163 (D-05 — CLASSIFIED request-scoped exception, RLS conversion DEFERRED):
        # this is a best-effort "extend expiry to cover the run" UPDATE on the caller's OWN
        # template_input rows, keyed by thread_id — and the thread was ALREADY RLS-ownership-
        # gated upstream in send_message (the user-JWT thread SELECT ran before this preflight).
        # pin_templates_for_run lives in template_service.py, which is OUT OF THIS PLAN'S SCOPE
        # (no swap plan owns it); it takes a raw ``pool``. It stays on the service-role pool
        # here (resolved LATE off app.api.threads so patch("app.api.threads.get_pg_pool") in
        # test_dual_mode_wiring still intercepts). Full RLS conversion rides along when
        # template_service is swapped (a later Wave-4 plan) — the single pool.execute is
        # already conn-duck-typed for it.
        from app.api.threads import get_pg_pool
        await _template_service.pin_templates_for_run(
            pool=await get_pg_pool(),
            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            run_wall_clock_cap=_template_service.run_cap_seconds(_kickoff_definition),
        )

    return _kickoff_definition, _kickoff_definition_id


async def build_harness_run_context(
    *,
    active_workflow_run_id,
    producer_run_id,
    kickoff_definition,
    thread_id,
    body,
    current_user,
    user_settings,
    supabase,
    redis,
    pool,
    harness_emit,
    spawn,
):
    """Phase 162.5 Plan 02 — the ``agent_runner`` harness run-context/scope BUILD, moved verbatim.

    Assembles the loose ``SimpleNamespace`` ``wf_ctx`` the harness engine threads through:
    the thread-folder / project-subtree scope resolution (``resolve_run_scope_root`` →
    ``resolve_project_subtree`` → ``fetch_visible_folders`` path-walk producing
    ``folder_subtree_ids`` + ``scoped_folder_path``), the WR-03 bound-workflow fail-closed
    guard (``scope_resolution_failed`` emit + ``RuntimeError`` for a BOUND workflow; UNBOUND
    falls through to unscoped), and the ``wf_ctx`` field assembly. Byte-identical to the
    inline block. Only the BUILD moves — the ``run_workflow`` call itself STAYS in the
    producer (threads.py, Plan 03 owns it). ``run_workflow`` / ``_load_run_definition`` /
    ``_harness_emit`` are loaded in threads.py and ``_harness_emit`` + the module-level
    ``_spawn`` are threaded IN (``harness_emit`` / ``spawn``); ``resolve_workflow_ctx_model``
    stays a LOCAL lazy import (dodges the import cycle, matches the original inline lazy import).
    ``run_id`` in the SimpleNamespace stays the workflow_run id (``active_workflow_run_id``);
    ``producer_run_id`` is the producer ``runs.run_id`` (Facet A).

    Phase 163 (D-05/D-09 — CLASSIFIED background/producer path): this runs INSIDE the
    detached agent-loop producer task (invoked from ``run_producer``), NOT request-scoped —
    no auth.uid() off-request. So its injected ``supabase`` + ``pool`` are the SERVICE-ROLE
    clients the producer holds, and are deliberately NOT converted to the per-request
    user-JWT client / get_user_pg_connection. Retrieval stays owner-scoped via the
    ``.eq("user_id")`` belt-and-suspenders inside the scope helpers (D-14). No connectionless
    ``pool.fetch``/``get_pg_pool()`` lives here — it reads via ``aexec(supabase…)`` + the
    scope helpers and only threads ``pool`` onto ``wf_ctx``.
    """
    # D-04 (site 1): the shared resolve-never-mutate (D-05) wrapper —
    # resolve the effective ctx model from the run owner's active
    # provider (a stale cross-provider llm_model falls back to the
    # provider default rather than leaking to the wrong client). Lazy
    # import inside the harness branch (matches the pattern above);
    # threaded onto wf_ctx.model below. Phase-level precedence is
    # unchanged downstream: phase.config.model or ctx.model.
    from app.services.sub_agent_models import resolve_workflow_ctx_model
    # F5 (092-07) + 098 (GOV-01/PROJ-02 — site 1 kickoff): resolve the
    # run-start retrieval scope. For a BOUND workflow
    # (kickoff_definition.project_folder_id set) the scope is the
    # PROJECT subtree, sourced from the binding the model cannot supply
    # (GOV-01) — NOT the thread folder. For an UNBOUND/legacy workflow
    # the scope stays the thread-folder subtree (unchanged — SC#1). Both
    # branches resolve through the shared scope.resolve_project_subtree
    # helper, so the inline recursive subtree walk is REMOVED
    # (G-5: threads.py must shrink, not grow). The scoped_folder_path is
    # the human-readable ls/tree/grep default-path hint (display only —
    # the real scope enforcement is folder_subtree_ids).
    _wf_folder_subtree_ids: list[str] | None = None
    _wf_scoped_folder_path: str | None = None
    try:
        _wf_thread_data = await aexec(
            supabase.table("threads").select("folder_id").eq("id", thread_id).single()
        )
        _wf_thread_folder = _wf_thread_data.data.get("folder_id") if _wf_thread_data.data else None
        # 152 WFIN-02: owned-override > author > thread precedence + D-05 gate in the helper (G-5).
        _wf_scope_root = await resolve_run_scope_root(
            kickoff_definition,
            run_inputs={"folder_id": str(body.folder_id)} if body.folder_id else None,
            thread_folder_id=_wf_thread_folder,
            supabase=supabase, user_id=current_user["id"],
        )
        if _wf_scope_root:
            _wf_folder_subtree_ids = await resolve_project_subtree(
                _wf_scope_root, supabase=supabase, user_id=current_user["id"]
            )
            _wf_all_folders = await fetch_visible_folders(
                supabase, current_user["id"]
            )
            _wf_folder_map = {f["id"]: f for f in _wf_all_folders}
            _wf_path_parts: list[str] = []
            _wf_current_fid = _wf_scope_root
            while _wf_current_fid:
                _f = _wf_folder_map.get(_wf_current_fid)
                if not _f:
                    break
                _wf_path_parts.append(_f.get("name", ""))
                _wf_current_fid = _f.get("parent_id")
            _wf_scoped_folder_path = (
                "/" + "/".join(reversed(_wf_path_parts))
                if _wf_path_parts else None
            )
    except Exception:
        # WR-03 (098 secure-phase): a scope-resolution failure must not
        # silently widen a BOUND workflow to the whole KB. The Plan-05
        # clip + scope_violation emit are gated on
        # `folder_subtree_ids is not None`, so on a None fallback neither
        # narrows nor fires — the degradation would be INVISIBLE. Kickoff
        # is the one site where the run has NOT started yet, so for a
        # bound workflow we fail CLOSED (emit + raise → a clean `failed`
        # terminal via the producer's outer `except Exception` below)
        # rather than run unscoped. An UNBOUND/legacy workflow keeps the
        # historical fall-through to whole-KB (SC#1 — losing the
        # thread-folder default hint is not a governance violation).
        _wf_bound = kickoff_definition.project_folder_id is not None
        logger.exception(
            "harness run-start scope resolution failed for thread %s "
            "(bound=%s)", thread_id, _wf_bound,
        )
        if _wf_bound:
            try:
                await harness_emit(
                    redis,
                    active_workflow_run_id,
                    "scope_resolution_failed",
                    site="kickoff",
                    bound=True,
                    detail=(
                        "project-scope resolution failed at run start; "
                        "failing closed to avoid whole-KB retrieval"
                    ),
                )
            except Exception:  # noqa: BLE001 — emit is best-effort
                logger.debug(
                    "kickoff: scope_resolution_failed emit failed for run %s",
                    active_workflow_run_id,
                )
            raise RuntimeError(
                "bound workflow scope resolution failed at run start "
                "(failing closed to avoid whole-KB retrieval)"
            )
        # unbound → fall through to unscoped (None) search (unchanged)
    wf_ctx = SimpleNamespace(
        run_id=active_workflow_run_id,
        # Facet A (092-07): the producer runs.run_id is the FK target
        # for sub-agent parent_run_id; ctx.run_id stays the workflow_run
        # id for audit/terminal/definition/resume-match.
        producer_run_id=producer_run_id,
        thread_id=thread_id,
        current_user=current_user,
        user_settings=user_settings,
        # D-04 (site 1): the effective ctx model resolved from the run
        # owner's active provider (resolve-never-mutate, D-05). user_settings
        # is the live request's effective settings — resolve from it so a
        # stale cross-provider llm_model cannot leak to the wrong client.
        # Phase-level precedence stays phase.config.model or ctx.model
        # (phase_types._effective_model) — this only sets ctx.model.
        model=resolve_workflow_ctx_model(user_settings),
        # F8 (092-07): the consumption half of SEED-047. create_workflow_run
        # STORED the user's kickoff question in workflow_runs.inputs.kickoff_prompt
        # (:995 above) but the phase executors never read it — the FIRST phase
        # (research) ran with an empty user turn and asked "send me the topic…".
        # Mirror EXACTLY what was persisted so live ctx.inputs == the durable
        # inputs jsonb the resume builders read back (152: mirror the folder
        # override too). ctx.inputs["kickoff_prompt"] is the first phase's user
        # turn / sub-agent task; programmatic split_topic reads ctx.inputs at :178.
        inputs={"kickoff_prompt": body.content, **({"folder_id": str(body.folder_id)} if body.folder_id else {})},
        redis=redis,
        pool=pool,
        emit=harness_emit,
        retry_feedback=None,
        # F5 (092-07): the tool-context fields every Supabase tool
        # reads via ctx.<field> (search_documents/hybrid/ls/tree/grep/
        # glob/fetch_document/skills/code-exec logging). Sourced from
        # the SAME in-scope values the Deep RunContext + run_agent_loop
        # use: supabase=supabase (threads.py:1190), spawn=_spawn
        # (threads.py:1198, the module-level _spawn — threaded in here).
        # Without these _build_phase_tool_context forwards None →
        # ctx.supabase.rpc raises AttributeError on the first search_documents (F5).
        supabase=supabase,
        folder_subtree_ids=_wf_folder_subtree_ids,
        scoped_folder_path=_wf_scoped_folder_path,
        spawn=spawn,
        # Per-run task() concurrency gate — mirrors the Deep
        # run_agent_loop local (_per_run_task_semaphore,
        # agent_loop.py:1234). A fresh per-run semaphore is correct
        # (this is a fresh top-level workflow run).
        per_run_task_semaphore=asyncio.Semaphore(
            settings.task_per_run_concurrency
        ),
    )
    return wf_ctx
