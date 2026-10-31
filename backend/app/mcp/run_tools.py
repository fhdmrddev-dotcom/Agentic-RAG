"""Phase 306-05 (MCP-06; D-10..D-15 / D-05 / D-35 / D-28) — the workflow tools.

A THIN wrapper with no visibility rule of its own (the ``read_tools.py`` shape). The list is
``acting_member_reads.list_workflows`` (304); the start checks are ``key_run_start.validate_key_start``
(306-01, the SAME order /inbound runs); the launch is ``unattended_launch.launch_unattended_run`` (the
scheduler's and /inbound's shared door); the read shape is ``key_run_read.read_key_run`` (306-01);
admission and idempotency are ``outside_admission`` (306-02). This module only puts them in order.

* ``list_workflows`` — the published workflows the member may run in the key's org. A key narrowed
  by folder lists a workflow only when EVERY folder it binds (``bound_folder_ids``, D-34) is inside
  the key's composed scope; a workflow that binds NO folder reads the whole knowledge base, so it is
  OUTSIDE a narrowed key (A6 / Pitfall 8 / T-306-18).
* ``run_workflow`` — in this order: the narrowed list → ``claim`` (only with an idempotency key) →
  ``validate_key_start`` (listed ids = the narrowed list) → the owner's provider → ``acquire`` → the
  launch, AWAITED in a task with a FRESH ``contextvars.Context`` (T-306-15: nothing the MCP request
  set rides into the run) → ``bind``. The launch returns once the run row exists; the drive runs in
  the background and its ``on_finish`` gives the lease back (D-35). It never waits for the run (D-11).
  A missing, unpublished, other-org, unrunnable or outside-the-key workflow is ONE sentence (D-10).
* ``get_workflow_run`` — ONE access statement binds the run id, the member, this key, the org and
  the mcp origin together (D-12 / T-306-07); any other run is ONE sentence. A paused run names WHO
  it waits on and never the question, and no tool answers it (D-13 / T-306-13). File NAMES only:
  the one-time file door serves key-origin runs, so the caller is pointed at /app/runs/<id>.

D-28 is not touched here: the run's phases keep their own published tool lists. The outside-run
allow-list is an ASK's (``outside_ask``), and a phase dispatch carries ``phase_whitelist``.
"""
from __future__ import annotations

import asyncio
import contextvars
import hashlib
import json
import uuid
from typing import Any

from app.dependencies import get_pg_pool, get_redis
from app.mcp import results as R
from app.services import acting_member_reads as reads
from app.services import outside_admission as _adm
from app.services import outside_ask as _ask
from app.services.foreign_folder_refusal import bound_folder_ids
from app.services.inbound_inputs import UNTRUSTED_FLAG, _is_fenced, declared_fields, inbound_kickoff
from app.services.key_run_read import read_key_run
from app.services.key_run_start import KeyStartRefusal, validate_key_start
from app.services.rate_limit import UNAVAILABLE_DETAIL
from app.services.run_model_resolution import resolve_owner_run_model

TOOL = "run_workflow"

NO_WORKFLOW_SENTENCE = "No workflow with that id is available to this key."
NO_RUN_SENTENCE = "No run with that id is available to this key."
DIFFERENT_REQUEST_SENTENCE = (
    "This idempotency key was already used for a different request; here is the first run."
)
ALREADY_STARTING_SENTENCE = (
    "This run is already being started. Send the same call again in a few seconds."
)
ENTITLEMENT_SENTENCE = "This organisation's plan doesn't include starting workflows."

# Every reason that means "this workflow is not one this key can start": one sentence (D-10).
_NOT_AVAILABLE = {"not_on_key", "cannot_run", "unpublished"}

# THE access statement (D-12): id, member, key, org and the mcp origin travel together, so every
# miss is one miss. Explicit columns: the pool bypasses RLS (the /inbound shape, 293).
_RUN_ACCESS_SQL = (
    "SELECT id, thread_id, status, user_id, org_id, definition_snapshot FROM workflow_runs "
    "WHERE id = $1 AND user_id = $2 AND origin_kind = 'mcp' AND origin_ref = $3 AND org_id = $4"
)

_WAIT_STATES = {"waiting_for_person", "paused"}
_STOP_STATES = {"cancelled", "stopped"}


def _uuid(value: Any) -> uuid.UUID | None:
    try:
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def _definition(value: Any) -> dict:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return {}
    return value if isinstance(value, dict) else {}


# ── list_workflows ──────────────────────────────────────────────────────────────────────────


async def _runnable(principal: Any) -> list[dict]:
    """The rows this key may start, in the feed's order (narrowed by folder for a narrowed key)."""
    rows = await reads.list_workflows(principal)
    if principal.folder_ids is None:
        return rows
    allowed = set(await _ask.composed_folder_ids(principal) or ())
    out = []
    for row in rows:
        bound = bound_folder_ids(row.get("definition"))
        if bound and set(bound) <= allowed:
            out.append(row)
    return out


def _entry(row: dict) -> R.WorkflowEntry:
    definition = _definition(row.get("definition"))
    version = definition.get("version")
    return R.WorkflowEntry(
        workflow_id=str(row["id"]),
        name=R.defang(str(row.get("name") or definition.get("name") or "")),
        version=version if isinstance(version, int) and not isinstance(version, bool) else None,
        inputs=[R.WorkflowInput(key=f.key, required=bool(f.required))
                for f in declared_fields(row.get("definition")) if not _is_fenced(f.key)],
    )


async def list_workflows(principal: Any, args: R.ListWorkflowsArgs) -> R.WorkflowList:
    return R.WorkflowList(workflows=[_entry(r) for r in await _runnable(principal)])


# ── run_workflow ────────────────────────────────────────────────────────────────────────────


def _refusal(checked: KeyStartRefusal) -> R.HandlerRefusal:
    if checked.reason in _NOT_AVAILABLE:
        return R.HandlerRefusal(NO_WORKFLOW_SENTENCE, checked.reason)
    detail = checked.detail
    if isinstance(detail, dict):  # an entitlement refusal: its hint, never the raw dict
        hint = detail.get("upgrade_hint")
        detail = hint if isinstance(hint, str) and hint else ENTITLEMENT_SENTENCE
    if not isinstance(detail, str) or not detail:
        detail = NO_WORKFLOW_SENTENCE
    return R.HandlerRefusal(detail, checked.reason, checked.extra)


async def _access(pool: Any, principal: Any, run_id: uuid.UUID) -> dict | None:
    row = await pool.fetchrow(
        _RUN_ACCESS_SQL, run_id, _uuid(principal.user_id), _uuid(principal.key_id), _uuid(principal.org_id)
    )
    return dict(row) if row is not None else None


async def _existing(pool: Any, principal: Any, held: _adm.Existing) -> R.RunStarted | str:
    """The first run an idempotency key started, as its start result (no second start)."""
    rid = _uuid(held.run_id)
    row = await _access(pool, principal, rid) if rid is not None else None
    if row is None:
        return NO_RUN_SENTENCE
    name = str(_definition(row.get("definition_snapshot")).get("name") or "workflow")
    return R.RunStarted(
        run_id=str(rid), name=R.defang(name), link=R.run_link(str(rid)),
        note=None if held.same_request else DIFFERENT_REQUEST_SENTENCE,
    )


async def run_workflow(principal: Any, args: R.RunWorkflowArgs) -> R.RunStarted | R.HandlerRefusal | str:
    from app.api.inbound import _DEFAULT_MAX_DURATION, _DEFAULT_MAX_TOKENS  # noqa: PLC0415 — A1 defaults
    from app.services import unattended_launch  # noqa: PLC0415 — the inbound door's late import

    listed = {str(r["id"]) for r in await _runnable(principal)}
    wid = _uuid(args.workflow_id)
    if wid is None or str(wid) not in listed:
        return R.HandlerRefusal(NO_WORKFLOW_SENTENCE, "not_on_key")

    pool = await get_pg_pool()
    redis = get_redis()
    request_sha = hashlib.sha256(
        json.dumps({"workflow_id": str(wid), "inputs": args.inputs}, sort_keys=True, default=str)
        .encode("utf-8")
    ).hexdigest()
    idem = None
    if args.idempotency_key:
        idem = {"credential_id": principal.key_id, "tool": TOOL, "idempotency_key": args.idempotency_key}
        try:
            held = await _adm.claim(redis, **idem, request_sha=request_sha)
        except _adm.OutsideStartUnavailable:
            return R.HandlerRefusal(UNAVAILABLE_DETAIL, _adm.UNAVAILABLE_REASON)
        if isinstance(held, _adm.Starting):
            return ALREADY_STARTING_SENTENCE
        if isinstance(held, _adm.Existing):
            return await _existing(pool, principal, held)

    async def _drop() -> None:
        if idem is not None:
            await _adm.drop(redis, **idem)

    org_id, owner_id = _uuid(principal.org_id), _uuid(principal.user_id)
    try:
        checked = await validate_key_start(
            pool, workflow_id=str(wid), listed_ids=listed, org_id=org_id, owner_id=owner_id,
            inputs=args.inputs, log_ref=f"mcp key {principal.key_id}",
        )
        if isinstance(checked, KeyStartRefusal):
            await _drop()
            return _refusal(checked)
        _model, provider = await resolve_owner_run_model(owner_id)
    except BaseException:
        await _drop()
        raise

    # One lease identity for the take and the give-back (the provider is the owner's resolved one).
    lease = {"org_id": principal.org_id, "credential_id": principal.key_id, "provider": provider,
             "lease_id": uuid.uuid4().hex}
    try:
        admitted = await _adm.acquire(redis, **lease, ttl_s=_adm.RUN_LEASE_TTL_S, retry_s=_adm.RUN_RETRY_S)
    except _adm.OutsideStartUnavailable:
        await _drop()
        return R.HandlerRefusal(UNAVAILABLE_DETAIL, _adm.UNAVAILABLE_REASON)
    if isinstance(admitted, _adm.Full):
        await _drop()
        return R.HandlerRefusal(
            _adm.MCP_FULL_SENTENCE[admitted.scope].format(retry=admitted.retry_s),
            _adm.REASON[admitted.scope],
            {"retry_s": admitted.retry_s},
        )

    async def _release(_status: Any = None, _run_id: Any = None) -> None:
        await _adm.release(redis, **lease)

    label = principal.label or "AI tool key"
    name, values = checked.name, checked.values
    launch = unattended_launch.launch_unattended_run(
        owner_id=owner_id,
        org_id=org_id,
        workflow_id=checked.wid,
        definition=checked.definition,
        # Validated declared fields, then the two server-set keys (the /inbound bag, T-306-32).
        inputs={**values, "kickoff_prompt": inbound_kickoff(name, values), UNTRUSTED_FLAG: True},
        title=f"{name} · via AI tool key {label}",
        max_tokens=_DEFAULT_MAX_TOKENS,
        max_duration=_DEFAULT_MAX_DURATION,
        pool=pool,
        redis=redis,
        run_label="mcp-started",
        log_ref=f"mcp key {principal.key_id}",
        origin_kind="mcp",
        origin_label=principal.label,
        origin_ref=_uuid(principal.key_id),
        thread_origin={"origin_kind": "mcp", "origin_label": principal.label,
                       "origin_ref": str(principal.key_id)},
        on_finish=_release,
    )
    try:
        run_id = await asyncio.create_task(launch, context=contextvars.Context())
    except unattended_launch.UnattendedLaunchDisabled as off:  # switched off mid-request
        await _release()
        await _drop()
        return R.HandlerRefusal(str(off), "workflows_disabled")
    except BaseException:  # the drive never started, so on_finish never fires: release now
        await _release()
        await _drop()
        raise

    if idem is not None:
        await _adm.bind(redis, **idem, run_id=run_id, request_sha=request_sha)
    return R.RunStarted(run_id=str(run_id), name=R.defang(name), link=R.run_link(str(run_id)))


# ── get_workflow_run ────────────────────────────────────────────────────────────────────────


def _shape(read: Any, link: str) -> R.RunRead:
    status = str(read.status)
    if status in _WAIT_STATES:
        from app.services.harness.run_read_words import waiting_who  # noqa: PLC0415

        who = read.waiting_on.who if read.waiting_on is not None else waiting_who(
            is_owner=False, display_name=None, viewer_email=None)
        return R.RunRead(run_id=read.run_id, status="waiting", waiting_on=R.defang(who), link=link)
    if status == "completed":
        return R.RunRead(
            run_id=read.run_id, status="completed", link=link,
            output=R.defang(read.output_text) if read.output_text else None,
            files=[R.defang(f.name) for f in read.files],
        )
    if status == "failed":
        return R.RunRead(run_id=read.run_id, status="failed", end_reason=read.end_reason, link=link)
    if status in _STOP_STATES:
        return R.RunRead(run_id=read.run_id, status="stopped", end_reason=read.end_reason, link=link)
    step_name = None
    if read.step_index is not None and 0 < read.step_index <= len(read.steps):
        step_name = R.defang(read.steps[read.step_index - 1].name) or None
    return R.RunRead(run_id=read.run_id, status="running", step_index=read.step_index,
                     step_count=read.step_total, step_name=step_name, link=link)


async def get_workflow_run(principal: Any, args: R.GetRunArgs) -> R.RunRead | str:
    rid = _uuid(args.run_id)
    if rid is None:
        return NO_RUN_SENTENCE
    pool = await get_pg_pool()
    run = await _access(pool, principal, rid)
    if run is None:
        return NO_RUN_SENTENCE
    read = await read_key_run(pool, None, run=run, key=None, files_base=None)
    return _shape(read, R.run_link(str(rid)))
