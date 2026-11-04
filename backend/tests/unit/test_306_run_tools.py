"""Phase 306-05 (MCP-06; D-10..D-15 / D-05 / D-35; T-306-07 / -09 / -10 / -13 / -15 / -18 / -32) — the
three workflow tools over fakes.

* ``list_workflows`` — every row of ``acting_member_reads.list_workflows`` for a key not narrowed by
  folder; for a narrowed key a workflow is listed only when its bound folders
  (``foreign_folder_refusal.bound_folder_ids``) are non-empty and all inside the key's composed scope
  (an unbound workflow is OUTSIDE a narrowed key, A6 / Pitfall 8).
* ``run_workflow`` — narrowed-list check, then claim, then ``validate_key_start`` (listed ids = the
  narrowed list), then the owner's provider, then the admission lease, then the launch in a FRESH
  context with ``origin_kind="mcp"`` and the thread stamped through ``thread_origin``. It returns the
  run id AT ONCE: the drive is still pending when the result comes back (D-11).
* ``get_workflow_run`` — ONE access statement binding id + member + this key + org on mcp-origin
  runs; anything else is ONE sentence (D-12 / T-306-07). The shape is ``read_key_run`` with
  ``files_base=None``: file NAMES and the /app/runs link, never an /inbound/files link (Pitfall 13).
  A paused run names WHO it waits on and never the question (D-13).
* ``unattended_launch``: ``thread_origin=None`` keeps the thread INSERT byte-identical (the
  scheduler and /inbound), a dict adds exactly its three keys.
* ``outside_ask.composed_folder_ids``: the one composition run_tools and ask_scope share.
"""
from __future__ import annotations

import asyncio
import contextvars
import uuid
from dataclasses import replace
from types import SimpleNamespace

import pytest

from app.mcp import results, run_tools
from app.services import key_run_read
from app.services import outside_admission as adm
from app.services import outside_ask as oa
from app.services import unattended_launch
from app.services.key_run_read import InboundFile, InboundRunRead, InboundStep, InboundWaitingOn
from app.services.key_run_start import KeyStartOk, KeyStartRefusal
from app.services import rate_limit
from tests.unit import _mcp305_harness as h

RUN3 = ("list_workflows", "run_workflow", "get_workflow_run")
PRINCIPAL = replace(h.PRINCIPAL, tools=RUN3, label="Laptop", include_external=True)
F1, F2 = str(uuid.uuid4()), str(uuid.uuid4())
W_F1, W_F1F2, W_NONE = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
RUN = uuid.UUID("44444444-4444-4444-8444-444444444444")
ORIGIN = "https://app.example"
RUN_LINK = f"{ORIGIN}/app/runs/{RUN}"


def _wf(wid, name, folders=(), inputs=(), version=3):
    definition = {"version": version, "name": name, "phases": [],
                  "inputs": [{"key": k, "label": k, "type": "text", "required": r} for k, r in inputs]}
    if folders:
        definition["project_folder_id"] = folders[0]
        definition["phases"] = [{"slug": "a", "phase_index": 0,
                                 "config": {"phase_type": "llm_agent", "folder_scope": list(folders[1:])}}]
    return {"id": wid, "name": name, "definition": definition, "is_mine": True}


ROWS = [
    _wf(W_F1, "Brief", folders=(F1,), inputs=(("topic", True), ("tone", False))),
    _wf(W_F1F2, "Wide", folders=(F1, F2)),
    _wf(W_NONE, "Anywhere"),
]

_PROBE: contextvars.ContextVar[str | None] = contextvars.ContextVar("probe_306_05", default=None)


class World:
    def __init__(self):
        self.calls: list[str] = []
        self.rows = list(ROWS)
        self.scope: tuple[str, ...] | None = (F1,)
        self.claim: object = adm.Claimed()
        self.claim_raises = False
        self.acquire: object = None
        self.acquire_raises = False
        self.validate: object = None
        self.validate_kw: dict = {}
        self.launch_kw: dict = {}
        self.launch_raises: BaseException | None = None
        self.seen_probe: object = "unset"
        self.drive_gate = asyncio.Event()
        self.drive: asyncio.Task | None = None
        self.released: list[dict] = []
        self.acquired: list[dict] = []
        self.dropped = 0
        self.bound: list[str] = []
        self.access_args: tuple | None = None
        self.access_sql: str | None = None
        self.access_row: dict | None = None
        self.read: InboundRunRead | None = None
        self.read_kw: dict = {}


@pytest.fixture
def world(monkeypatch):
    w = World()

    async def list_workflows(principal):
        w.calls.append("list_workflows")
        return [dict(r) for r in w.rows]

    async def composed(principal):
        w.calls.append("composed_folder_ids")
        return w.scope

    async def validate(pool, **kw):
        w.calls.append("validate_key_start")
        w.validate_kw = kw
        if w.validate is not None:
            return w.validate
        row = next(r for r in w.rows if r["id"] == kw["workflow_id"])
        return KeyStartOk(wid=uuid.UUID(kw["workflow_id"]), raw=row["definition"], row=row,
                          definition=SimpleNamespace(name=row["name"]), values=dict(kw["inputs"]),
                          name=row["name"])

    async def owner_model(owner_id):
        w.calls.append("resolve_owner_run_model")
        return "gpt-x", "openai"

    async def launch(**kw):
        w.calls.append("launch")
        w.launch_kw = kw
        w.seen_probe = _PROBE.get()
        if w.launch_raises is not None:
            raise w.launch_raises

        async def _drive():
            await w.drive_gate.wait()
            await kw["on_finish"]("completed", RUN)

        w.drive = asyncio.get_running_loop().create_task(_drive())
        return RUN

    async def claim(redis, **kw):
        w.calls.append("claim")
        if w.claim_raises:
            raise adm.OutsideStartUnavailable()
        return w.claim

    async def acquire(redis, **kw):
        w.calls.append("acquire")
        w.acquired.append(kw)
        if w.acquire_raises:
            raise adm.OutsideStartUnavailable()
        return w.acquire or adm.Admitted(lease_id=kw["lease_id"])

    async def release(redis, **kw):
        w.calls.append("release")
        w.released.append(kw)

    async def bind(redis, **kw):
        w.calls.append("bind")
        w.bound.append(str(kw["run_id"]))

    async def drop(redis, **kw):
        w.calls.append("drop")
        w.dropped += 1

    class Pool:
        async def fetchrow(self, sql, *args):
            w.calls.append("access")
            w.access_sql, w.access_args = sql, args
            return w.access_row

    pool = Pool()

    async def _pool():
        return pool

    async def read(pool_, redis, **kw):
        w.calls.append("read_key_run")
        w.read_kw = kw
        return w.read

    monkeypatch.setattr(run_tools.reads, "list_workflows", list_workflows)
    monkeypatch.setattr(run_tools._ask, "composed_folder_ids", composed)
    monkeypatch.setattr(run_tools, "validate_key_start", validate)
    monkeypatch.setattr(run_tools, "resolve_owner_run_model", owner_model)
    monkeypatch.setattr(unattended_launch, "launch_unattended_run", launch)
    for name, fn in (("claim", claim), ("acquire", acquire), ("release", release),
                     ("bind", bind), ("drop", drop)):
        monkeypatch.setattr(adm, name, fn)
    monkeypatch.setattr(run_tools, "get_pg_pool", _pool)
    monkeypatch.setattr(run_tools, "get_redis", lambda: object())
    monkeypatch.setattr(run_tools, "read_key_run", read)
    import app.config as config

    monkeypatch.setattr(config, "primary_frontend_origin", lambda: ORIGIN)
    return w


def _narrowed(**kw):
    return replace(PRINCIPAL, folder_ids=(F1,), **kw)


# ── list_workflows ────────────────────────────────────────────────────────────────────────────


async def test_a_key_not_narrowed_lists_every_runnable_workflow(world):
    out = await run_tools.list_workflows(PRINCIPAL, results.ListWorkflowsArgs())
    assert [w.workflow_id for w in out.workflows] == [W_F1, W_F1F2, W_NONE]
    assert "composed_folder_ids" not in world.calls


async def test_a_narrowed_key_lists_only_workflows_bound_inside_its_scope(world):
    out = await run_tools.list_workflows(_narrowed(), results.ListWorkflowsArgs())
    assert [w.workflow_id for w in out.workflows] == [W_F1]


async def test_the_list_renders_names_versions_and_inputs(world):
    out = await run_tools.list_workflows(PRINCIPAL, results.ListWorkflowsArgs())
    text = results.render(out)
    assert text.splitlines()[0] == "3 workflow(s) this key can run."
    assert "[1] Brief (v3)" in text
    assert f"workflow_id: {W_F1}" in text
    assert "Inputs: topic (required), tone" in text
    assert "[3] Anywhere (v3)" in text
    assert text.count("Inputs: none") == 2


async def test_an_empty_list_says_so(world):
    world.rows = []
    out = await run_tools.list_workflows(PRINCIPAL, results.ListWorkflowsArgs())
    assert results.render(out) == "No published workflows are available to this key."


def test_list_args_take_nothing():
    with pytest.raises(Exception):
        results.ListWorkflowsArgs.model_validate({"folder_id": "x"})


# ── run_workflow ──────────────────────────────────────────────────────────────────────────────


def _run(wid=W_F1, inputs=None, key=None):
    return results.RunWorkflowArgs(workflow_id=wid, inputs=inputs or {"topic": "x"}, idempotency_key=key)


async def test_the_start_order_and_the_launch_arguments(world):
    out = await run_tools.run_workflow(PRINCIPAL, _run(key="k-1"))
    assert world.calls == ["list_workflows", "claim", "validate_key_start", "resolve_owner_run_model",
                           "acquire", "launch", "bind"]
    assert isinstance(out, results.RunStarted)
    assert out.run_id == str(RUN) and out.link == RUN_LINK and out.name == "Brief"
    kw = world.launch_kw
    assert kw["origin_kind"] == "mcp"
    assert kw["origin_label"] == "Laptop"
    assert str(kw["origin_ref"]) == PRINCIPAL.key_id
    assert kw["thread_origin"] == {"origin_kind": "mcp", "origin_label": "Laptop",
                                   "origin_ref": PRINCIPAL.key_id}
    assert kw["run_label"] == "mcp-started"
    assert kw["title"] == "Brief · via AI tool key Laptop"
    assert str(kw["owner_id"]) == PRINCIPAL.user_id and str(kw["org_id"]) == PRINCIPAL.org_id
    from app.services.inbound_inputs import UNTRUSTED_FLAG
    assert kw["inputs"][UNTRUSTED_FLAG] is True and kw["inputs"]["topic"] == "x"
    assert "<external_input" in kw["inputs"]["kickoff_prompt"]
    assert world.bound == [str(RUN)]
    assert world.validate_kw["listed_ids"] == {W_F1, W_F1F2, W_NONE}
    assert world.validate_kw["log_ref"] == f"mcp key {PRINCIPAL.key_id}"


async def test_the_result_renders_the_run_id_and_the_link(world):
    out = await run_tools.run_workflow(PRINCIPAL, _run())
    assert results.render(out) == (
        f"Started Brief. Run id: {RUN}. Check it with get_workflow_run.\nOpen in Syrel: {RUN_LINK}"
    )


async def test_it_returns_while_the_drive_is_still_running(world):
    out = await run_tools.run_workflow(PRINCIPAL, _run())
    assert isinstance(out, results.RunStarted)
    assert world.drive is not None and not world.drive.done(), "run_workflow must never wait for the run"
    assert world.released == []
    world.drive_gate.set()
    await world.drive
    assert world.released[0]["lease_id"] == world.acquired[0]["lease_id"]


async def test_the_launch_runs_in_a_fresh_context(world):
    token = _PROBE.set("mcp-request")
    try:
        await run_tools.run_workflow(PRINCIPAL, _run())
    finally:
        _PROBE.reset(token)
    assert world.seen_probe is None, "the MCP request's ContextVars must not ride into the run"


async def test_a_narrowed_key_cannot_start_a_workflow_outside_it(world):
    for wid in (W_F1F2, W_NONE, str(uuid.uuid4()), "not-a-uuid"):
        world.calls.clear()
        out = await run_tools.run_workflow(_narrowed(), _run(wid=wid, key="k"))
        assert out == results.HandlerRefusal(run_tools.NO_WORKFLOW_SENTENCE, "not_on_key")
        assert "claim" not in world.calls and "launch" not in world.calls


@pytest.mark.parametrize("reason", ["not_on_key", "cannot_run", "unpublished"])
async def test_missing_unpublished_and_unrunnable_are_one_sentence(world, reason):
    world.validate = KeyStartRefusal(reason, 404, None, None, W_F1)
    out = await run_tools.run_workflow(PRINCIPAL, _run(key="k"))
    assert out == results.HandlerRefusal(run_tools.NO_WORKFLOW_SENTENCE, reason)
    assert "launch" not in world.calls and world.dropped == 1


async def test_bad_inputs_get_293s_sentence(world):
    world.validate = KeyStartRefusal("missing_input", 422, "Missing required input(s): topic.",
                                     {"names": ["topic"]}, W_F1)
    out = await run_tools.run_workflow(PRINCIPAL, _run(inputs={"tone": "dry"}))
    assert out == results.HandlerRefusal("Missing required input(s): topic.", "missing_input",
                                         {"names": ["topic"]})


async def test_workflows_switched_off_gets_its_sentence(world):
    world.validate = KeyStartRefusal("workflows_disabled", 403, unattended_launch.WORKFLOWS_DISABLED_DETAIL,
                                     None, W_F1)
    out = await run_tools.run_workflow(PRINCIPAL, _run())
    assert out.sentence == unattended_launch.WORKFLOWS_DISABLED_DETAIL
    assert out.reason == "workflows_disabled"


async def test_an_entitlement_refusal_never_shows_a_raw_dict(world):
    world.validate = KeyStartRefusal("entitlement", 403, {"error": "entitlement_required",
                                                          "upgrade_hint": "Upgrade to Pro to use workflows."},
                                     None, W_F1, exc=object())
    out = await run_tools.run_workflow(PRINCIPAL, _run())
    assert out.reason == "entitlement" and out.sentence == "Upgrade to Pro to use workflows."


async def test_the_same_idempotency_key_returns_the_first_run(world):
    world.claim = adm.Existing(run_id=str(RUN), same_request=True)
    world.access_row = {"id": RUN, "thread_id": uuid.uuid4(), "status": "active", "user_id": PRINCIPAL.user_id,
                        "org_id": PRINCIPAL.org_id, "definition_snapshot": {"name": "Brief"}}
    out = await run_tools.run_workflow(PRINCIPAL, _run(key="k"))
    assert isinstance(out, results.RunStarted) and out.run_id == str(RUN) and out.note is None
    assert "launch" not in world.calls and "acquire" not in world.calls


async def test_the_same_idempotency_key_with_another_request_says_so(world):
    world.claim = adm.Existing(run_id=str(RUN), same_request=False)
    world.access_row = {"id": RUN, "thread_id": uuid.uuid4(), "status": "active", "user_id": PRINCIPAL.user_id,
                        "org_id": PRINCIPAL.org_id, "definition_snapshot": {"name": "Brief"}}
    out = await run_tools.run_workflow(PRINCIPAL, _run(key="k"))
    assert out.note == run_tools.DIFFERENT_REQUEST_SENTENCE
    assert results.render(out).startswith(run_tools.DIFFERENT_REQUEST_SENTENCE + "\n\n")


async def test_a_claim_still_starting_answers_the_sentence(world):
    world.claim = adm.Starting()
    out = await run_tools.run_workflow(PRINCIPAL, _run(key="k"))
    assert out == run_tools.ALREADY_STARTING_SENTENCE
    assert "launch" not in world.calls


@pytest.mark.parametrize("scope", ["credential", "org", "provider"])
async def test_a_full_scope_drops_the_claim_and_launches_nothing(world, scope):
    world.acquire = adm.Full(scope=scope, retry_s=adm.RUN_RETRY_S)
    out = await run_tools.run_workflow(PRINCIPAL, _run(key="k"))
    assert out == results.HandlerRefusal(adm.MCP_FULL_SENTENCE[scope].format(retry=30),
                                         f"admission:{scope}", {"retry_s": 30})
    assert "launch" not in world.calls and world.dropped == 1


async def test_the_lease_names_the_owners_provider(world):
    await run_tools.run_workflow(PRINCIPAL, _run())
    (kw,) = world.acquired
    assert kw["provider"] == "openai" and kw["ttl_s"] == adm.RUN_LEASE_TTL_S
    assert kw["retry_s"] == adm.RUN_RETRY_S


@pytest.mark.parametrize("where", ["claim", "acquire"])
async def test_redis_unavailable_refuses_the_start(world, where):
    setattr(world, f"{where}_raises", True)
    out = await run_tools.run_workflow(PRINCIPAL, _run(key="k"))
    assert out == results.HandlerRefusal(rate_limit.UNAVAILABLE_DETAIL, adm.UNAVAILABLE_REASON)
    assert "launch" not in world.calls


async def test_a_launch_that_raises_releases_and_drops_then_propagates(world):
    world.launch_raises = RuntimeError("insert failed")
    with pytest.raises(RuntimeError):
        await run_tools.run_workflow(PRINCIPAL, _run(key="k"))
    assert world.released and world.dropped == 1


async def test_a_launch_switched_off_mid_request_is_refused_and_released(world):
    world.launch_raises = unattended_launch.UnattendedLaunchDisabled(unattended_launch.WORKFLOWS_DISABLED_DETAIL)
    out = await run_tools.run_workflow(PRINCIPAL, _run(key="k"))
    assert out == results.HandlerRefusal(unattended_launch.WORKFLOWS_DISABLED_DETAIL, "workflows_disabled")
    assert world.released and world.dropped == 1


def test_run_args_have_no_model_and_forbid_extras():
    schema = results.RunWorkflowArgs.model_json_schema()
    assert set(schema["properties"]) == {"workflow_id", "inputs", "idempotency_key"}
    assert schema.get("additionalProperties") is False
    with pytest.raises(Exception):
        results.RunWorkflowArgs.model_validate({"workflow_id": "w", "model": "gpt-x"})
    with pytest.raises(Exception):
        results.RunWorkflowArgs.model_validate({"workflow_id": "w", "inputs": {str(i): "v" for i in range(101)}})


# ── get_workflow_run ──────────────────────────────────────────────────────────────────────────


def _row(**kw):
    base = {"id": RUN, "thread_id": uuid.uuid4(), "status": "active", "user_id": uuid.UUID(PRINCIPAL.user_id),
            "org_id": uuid.UUID(PRINCIPAL.org_id), "definition_snapshot": {}}
    base.update(kw)
    return base


def _readout(status, **kw):
    return InboundRunRead(run_id=str(RUN), status=status, **kw)


async def test_one_access_statement_binds_the_key_member_and_org(world):
    world.access_row = None
    out = await run_tools.get_workflow_run(PRINCIPAL, results.GetRunArgs(run_id=str(RUN)))
    assert out == run_tools.NO_RUN_SENTENCE
    sql = world.access_sql
    assert "origin_kind = 'mcp'" in sql and "origin_ref = $3" in sql and "org_id = $4" in sql
    assert "user_id = $2" in sql and "id = $1" in sql
    assert world.access_args == (RUN, uuid.UUID(PRINCIPAL.user_id), uuid.UUID(PRINCIPAL.key_id),
                                 uuid.UUID(PRINCIPAL.org_id))
    assert "read_key_run" not in world.calls


async def test_a_malformed_run_id_is_the_same_sentence_without_a_read(world):
    out = await run_tools.get_workflow_run(PRINCIPAL, results.GetRunArgs(run_id="nope"))
    assert out == run_tools.NO_RUN_SENTENCE and "access" not in world.calls


async def test_the_read_uses_no_file_links(world):
    world.access_row = _row()
    world.read = _readout("completed", output_text="Done.")
    await run_tools.get_workflow_run(PRINCIPAL, results.GetRunArgs(run_id=str(RUN)))
    assert world.read_kw["files_base"] is None


@pytest.mark.parametrize("read, expected", [
    (_readout("running", step_index=2, step_total=3,
              steps=[InboundStep(name="Gather", state="completed"), InboundStep(name="Draft", state="active"),
                     InboundStep(name="Check", state="pending")]),
     "Running · step 2 of 3: Draft."),
    (_readout("running"), "Running."),
    (_readout("waiting_for_person", waiting_on=InboundWaitingOn(who="Fahad")),
     f"Waiting on Fahad. It can only be answered in Syrel: {RUN_LINK}"),
    (_readout("paused"),
     f"Waiting on the person who started this run. It can only be answered in Syrel: {RUN_LINK}"),
    (_readout("failed", end_reason="The step ran out of time."),
     f"Failed: The step ran out of time.\nOpen in Syrel: {RUN_LINK}"),
    (_readout("failed"), f"Failed.\nOpen in Syrel: {RUN_LINK}"),
    (_readout("cancelled"), f"Stopped.\nOpen in Syrel: {RUN_LINK}"),
])
async def test_each_status_reads_in_the_ui_spec_words(world, read, expected):
    world.access_row = _row()
    world.read = read
    out = await run_tools.get_workflow_run(PRINCIPAL, results.GetRunArgs(run_id=str(RUN)))
    assert results.render(out) == expected


async def test_a_completed_run_reads_its_output_and_file_names(world):
    world.access_row = _row(status="completed")
    world.read = _readout("completed", output_text="The brief.", files=[
        InboundFile(name="a.docx", url="", expires_in=0), InboundFile(name="b.pdf", url="", expires_in=0)])
    out = await run_tools.get_workflow_run(PRINCIPAL, results.GetRunArgs(run_id=str(RUN)))
    text = results.render(out)
    assert text == f"Completed.\n\nThe brief.\n\nFiles: a.docx, b.pdf. Download them in Syrel: {RUN_LINK}"
    assert "/inbound/files/" not in text and "/inbound/files/" not in str(out.model_dump())


async def test_a_paused_run_never_shows_the_question(world):
    world.access_row = _row(status="paused")
    world.read = _readout("waiting_for_person", waiting_on=InboundWaitingOn(who="Fahad"))
    out = await run_tools.get_workflow_run(PRINCIPAL, results.GetRunArgs(run_id=str(RUN)))
    assert out.status == "waiting" and out.output is None


def test_run_tools_never_builds_an_inbound_link():
    from pathlib import Path
    src = Path(run_tools.__file__).read_text(encoding="utf-8")
    assert "/inbound/files" not in src
    assert src.count("origin_kind = 'mcp'") == 1


# ── key_run_read: the MCP file arm (files_base=None) ─────────────────────────────────────────


class _FilesPool:
    async def fetch(self, sql, *args):
        return [{"id": uuid.uuid4(), "path": "out/a.docx", "size_bytes": 10},
                {"id": uuid.uuid4(), "path": "b.pdf", "size_bytes": None}]


class _NoRedis:
    async def set(self, *a, **k):  # pragma: no cover - must never run
        raise AssertionError("an MCP read mints no one-time link")


async def test_the_mcp_file_arm_lists_names_and_mints_no_link():
    files = await key_run_read._file_links(_FilesPool(), _NoRedis(), key=None,
                                           run={"id": RUN, "thread_id": uuid.uuid4()}, base=None)
    assert [f.name for f in files] == ["a.docx", "b.pdf"]
    assert all(f.url == "" and f.expires_in == 0 for f in files)


# ── unattended_launch: thread_origin ─────────────────────────────────────────────────────────


@pytest.fixture
def launch_world(monkeypatch):
    seen: dict = {}

    class _Table:
        def insert(self, row):
            seen["thread_row"] = row
            return self

        def execute(self):
            return SimpleNamespace(data=[{"id": str(uuid.uuid4())}])

    sb = SimpleNamespace(table=lambda name: _Table())
    import app.db.workflows as wdb
    import app.dependencies as deps
    import app.services.run_model_resolution as rmr

    async def _model(owner):
        return None, None

    async def _create(pool, **kw):
        return RUN

    async def _arm(*a, **k):
        return None

    async def _drive(**kw):
        return None

    monkeypatch.setattr(deps, "get_service_role_supabase", lambda org_id=None: sb)
    monkeypatch.setattr(rmr, "resolve_owner_run_model", _model)
    monkeypatch.setattr(wdb, "create_workflow_run", _create)
    monkeypatch.setattr(wdb, "arm_run_budget", _arm)
    monkeypatch.setattr(unattended_launch, "_drive_run", _drive)
    monkeypatch.setattr(unattended_launch, "workflows_disabled", lambda: False)
    return seen


def _launch_kw(**extra):
    return dict(owner_id=uuid.uuid4(), org_id=uuid.UUID(PRINCIPAL.org_id), workflow_id=uuid.uuid4(),
                definition=None, inputs={}, title="T", max_tokens=1, max_duration=1, pool=None,
                redis=None, **extra)


async def test_no_thread_origin_keeps_the_thread_insert_byte_identical(launch_world):
    kw = _launch_kw()
    await unattended_launch.launch_unattended_run(**kw)
    assert launch_world["thread_row"] == {"user_id": str(kw["owner_id"]), "title": "T",
                                          "org_id": PRINCIPAL.org_id}


async def test_a_thread_origin_stamps_its_three_keys(launch_world):
    origin = {"origin_kind": "mcp", "origin_label": "Laptop", "origin_ref": PRINCIPAL.key_id}
    kw = _launch_kw(thread_origin=origin)
    await unattended_launch.launch_unattended_run(**kw)
    assert launch_world["thread_row"] == {"user_id": str(kw["owner_id"]), "title": "T",
                                          "org_id": PRINCIPAL.org_id, **origin}


# ── outside_ask.composed_folder_ids ──────────────────────────────────────────────────────────


@pytest.fixture
def folders(monkeypatch):
    sub = str(uuid.uuid4())
    rows = [{"id": F1, "parent_id": None}, {"id": sub, "parent_id": F1}, {"id": F2, "parent_id": None}]

    class _Conn:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, *a):
            return False

    async def _list(conn):
        return rows

    monkeypatch.setattr(oa, "acting_member_connection", lambda **kw: _Conn())
    monkeypatch.setattr(oa, "list_acting_folders", _list)
    return sub


async def test_composed_folder_ids_is_none_for_a_key_not_narrowed(folders):
    assert await oa.composed_folder_ids(PRINCIPAL) is None


async def test_composed_folder_ids_is_the_visible_subtree_for_a_narrowed_key(folders):
    assert set(await oa.composed_folder_ids(_narrowed())) == {F1, folders}
