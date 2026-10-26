"""Phase 296-06 Task 1 — kickoff required inputs, kickoff provider, inbound and key fixes.

Rows, each driven RED first (D-19):

* **287-T01.** The browser was the only thing refusing a launch with a required input left blank.
  ``inbound_inputs.missing_required`` is now the ONE predicate (key calls AND in-app kickoffs), and
  the in-app kickoff refuses with 422 in ``preflight_workflow_kickoff``, before the user-message
  INSERT, the runs row and the workflow_runs row. Parity with ``soulData.missingRequiredFields``
  is pinned by the shared ``launch_fields_cases.json`` (``expected_missing`` cases).
* **SEED-362 (kickoff half).** The in-app kickoff records its provider on the run
  (``create_workflow_run(provider=...)``), so a resume continues on the same provider.
* **293-IN-01.** A limiter refusal on the file link leaves the token unconsumed.
* **293-IN-03.** An oversize inbound body is refused 413 before FastAPI reads or parses it.
* **293-IN-06.** A workflow that declares no launch field starts from a typed task, which a key
  cannot send: it reads ``needs_task``, the picker greys it, ``create_key`` refuses it (and any
  workflow the picker hides, globals included), and an inbound start refuses it.
* **293-IN-08.** Re-revoking a revoked key writes no second ``api_key.revoke`` audit row.

Nothing here touches Postgres or Redis: routes are mounted on a fresh ``FastAPI()`` with
dependency overrides (SEED-363), or the handler is called with patched collaborators.
"""
from __future__ import annotations

import json
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.services import inbound_inputs as ii

FIXTURE = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "phase293" / "launch_fields_cases.json")
    .read_text(encoding="utf-8")
)


# ── 287-T01: the one predicate ──────────────────────────────────────────────────────────────


MISSING_CASES = [c for c in FIXTURE["cases"] if "expected_missing" in c]


def test_the_shared_fixture_carries_missing_required_cases():
    assert len(MISSING_CASES) >= 4


@pytest.mark.parametrize("case", MISSING_CASES, ids=[c["name"] for c in MISSING_CASES])
def test_missing_required_matches_the_shared_fixture(case):
    assert ii.missing_required(case["definition"], case["inputs"]) == case["expected_missing"]


def test_missing_required_reads_a_model_and_a_json_string_too():
    from app.models.harness import WorkflowDefinition

    raw = {
        "slug": "s", "version": 1, "name": "Send it", "phases": [],
        "inputs": [{"key": "recipient", "label": "Recipient", "type": "text"}],
    }
    assert ii.missing_required(WorkflowDefinition.model_validate(raw), {}) == ["recipient"]
    assert ii.missing_required(json.dumps(raw), None) == ["recipient"]
    assert ii.missing_required(raw, {"recipient": 7}) == []


def test_key_calls_and_kickoffs_share_the_predicate():
    src = Path(ii.__file__).read_text(encoding="utf-8")
    body = src.split("def validate_inbound_inputs", 1)[1].split("\ndef ", 1)[0]
    assert "missing_required(" in body
    assert "f.required and out.get" not in body


# ── 287-T01: the in-app kickoff refuses before any write ────────────────────────────────────


_SEND_DEF = {
    "slug": "send-it", "version": 1, "name": "Send it",
    "phases": [{"slug": "write", "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Write."}}],
    "inputs": [
        {"key": "recipient", "label": "Recipient", "type": "text"},
        {"key": "notes", "label": "Notes", "type": "text", "required": False},
    ],
}


async def _preflight(inputs, *, definition=None):
    from app.services import workflow_kickoff
    from app.services.entitlement_service import EntitlementResult

    user = {"id": str(uuid4()), "org_id": str(uuid4())}
    body = SimpleNamespace(workflow_definition_id=uuid4(), inputs=inputs)
    row = {
        "id": str(uuid4()), "definition": definition or _SEND_DEF, "status": "published",
        "is_system_global": False, "created_by": user["id"], "skill_snapshots": None,
    }
    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")
    pool = MagicMock()

    async def _passthrough(**kw):
        return kw["definition"]

    with (
        patch("app.api.threads.workflows_enabled", return_value=True),
        patch("app.api.threads.get_pg_pool", new_callable=AsyncMock, return_value=pool),
        patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
              return_value=allowed),
        patch.object(workflow_kickoff, "aexec", AsyncMock(return_value=SimpleNamespace(data=row))),
        patch.object(workflow_kickoff, "assert_folder_scopes_subset", AsyncMock()),
        patch.object(workflow_kickoff, "_ensure_skill_snapshots", side_effect=_passthrough) as snap,
        patch("app.services.template_service.pin_templates_for_run", AsyncMock()) as pin,
    ):
        try:
            out = await workflow_kickoff.preflight_workflow_kickoff(
                request=MagicMock(), body=body, thread_id=str(uuid4()),
                thread_row={"active_workflow_run_id": None}, supabase=MagicMock(),
                current_user=user,
            )
            return out, snap, pin, None
        except HTTPException as exc:
            return None, snap, pin, exc


@pytest.mark.asyncio
async def test_a_kickoff_missing_a_required_input_is_refused_with_one_worded_sentence():
    out, snap, pin, exc = await _preflight({"notes": "x"})
    assert out is None and exc is not None
    assert exc.status_code == 422
    assert exc.detail == "Missing required input(s): recipient."
    snap.assert_not_called()
    pin.assert_not_called()


@pytest.mark.asyncio
async def test_a_blank_required_value_is_missing_and_no_inputs_at_all_is_too():
    for inputs in ({"recipient": "   "}, None, {}):
        _out, _snap, _pin, exc = await _preflight(inputs)
        assert exc is not None and exc.status_code == 422, inputs


@pytest.mark.asyncio
async def test_a_complete_kickoff_and_a_field_less_workflow_pass():
    out, _snap, pin, exc = await _preflight({"recipient": "a@example.com"})
    assert exc is None and out[0] is not None
    pin.assert_awaited_once()
    bare = dict(_SEND_DEF, inputs=[])
    out, _snap, _pin, exc = await _preflight(None, definition=bare)
    assert exc is None and out[0] is not None


# ── send_message: the refusal writes nothing; the kickoff records its provider ──────────────


def _send_harness(*, kickoff, preflight_exc=None):
    from tests.unit.test_268_send_path_stamp import _SendHarness

    h = _SendHarness(active_org=None, kickoff=kickoff)
    h.create_run = AsyncMock(return_value=uuid4())
    h.preflight = AsyncMock(
        side_effect=preflight_exc,
        return_value=(kickoff, str(uuid4()) if kickoff else None),
    )
    return h


async def _send(h, *, inputs=None):
    import app.api.threads as threads_mod
    from app.models.message import MessageCreate

    with ExitStack() as stack:
        for p in h.patches():
            stack.enter_context(p)
        stack.enter_context(patch.object(threads_mod, "create_workflow_run", h.create_run))
        stack.enter_context(patch.object(threads_mod, "preflight_workflow_kickoff", h.preflight))
        return await threads_mod.send_message(
            "33333333-3333-3333-3333-333333333333",
            MessageCreate(content="go", inputs=inputs),
            SimpleNamespace(headers={}, state=SimpleNamespace()),
            current_user={"id": "11111111-1111-1111-1111-111111111111", "email": "u@example.com"},
            supabase=h.supabase(),
            service_supabase=MagicMock(name="service_supabase"),
            redis=MagicMock(),
        )


@pytest.mark.asyncio
async def test_a_refused_kickoff_writes_no_message_no_run_row_and_no_workflow_run():
    exc = HTTPException(status_code=422, detail="Missing required input(s): recipient.")
    h = _send_harness(kickoff=_SEND_DEF, preflight_exc=exc)
    with pytest.raises(HTTPException) as ei:
        await _send(h)
    assert ei.value.status_code == 422
    assert h.inserted_rows == []
    h.register.assert_not_called()
    h.create_run.assert_not_called()


@pytest.mark.asyncio
async def test_the_in_app_kickoff_records_its_provider_on_the_run():
    h = _send_harness(kickoff=_SEND_DEF)
    await _send(h, inputs={"recipient": "a@example.com"})
    h.create_run.assert_awaited_once()
    assert h.create_run.await_args.kwargs["provider"] == "openai"


# ── 293-IN-01: a limiter refusal never burns the file link ──────────────────────────────────


@pytest.fixture
def file_env(monkeypatch):
    from tests.unit.phase293_inbound_fakes import (
        FILE_ID, KEY_ID, ORG_ID, RUN_ID, THREAD_ID, USER_ID, FakePool, FakeRedis, audit_spies,
        build_app, make_key,
    )

    events: list = []
    pool = FakePool(events)
    redis = FakeRedis()
    audit_spies(monkeypatch, events)
    token = "tok_" + "b" * 28
    redis.store[f"apikey:dl:{token}"] = json.dumps(
        {"key_id": KEY_ID, "run_id": RUN_ID, "file_id": FILE_ID}
    )
    pool.key_row = {"id": KEY_ID, "org_id": ORG_ID, "user_id": USER_ID, "label": "n8n-prod",
                    "revoked_at": None, "expires_at": None}
    pool.run_row = {"thread_id": THREAD_ID}
    monkeypatch.setattr("app.db.workspace.get_file_by_id", AsyncMock(return_value={
        "id": FILE_ID, "thread_id": THREAD_ID, "path": "/out/digest.docx", "mime_type": "text/plain",
        "content_inline": b"bytes", "content_storage_path": None, "kind": "agent",
        "is_expired": False,
    }))
    monkeypatch.setattr("app.db.api_keys.is_org_member", AsyncMock(return_value=True))
    monkeypatch.setattr("app.dependencies._is_banned", AsyncMock(return_value=False))
    monkeypatch.setattr("app.dependencies.get_service_role_supabase", lambda *_a, **_k: object())
    client = TestClient(build_app(key=make_key(), pool=pool, redis=redis))
    return SimpleNamespace(client=client, redis=redis, token=token,
                           url=f"/inbound/files/{token}", stored=f"apikey:dl:{token}")


@pytest.mark.parametrize("code", [429, 503])
def test_a_limiter_refusal_leaves_the_file_token_unconsumed(file_env, monkeypatch, code):
    from app.api import inbound

    async def _refuse(_redis, *, key_id, kind):
        raise HTTPException(status_code=code, detail="over", headers={"Retry-After": "30"})

    monkeypatch.setattr(inbound, "enforce_key_limit", _refuse)
    r = file_env.client.get(file_env.url)
    assert r.status_code == code
    assert file_env.stored in file_env.redis.store, "a refused request must not burn the link"


def test_after_the_limit_clears_the_same_link_still_works_once(file_env):
    first = file_env.client.get(file_env.url)
    assert first.status_code == 200, first.text
    assert file_env.stored not in file_env.redis.store
    assert file_env.client.get(file_env.url).status_code == 404


def test_the_limiter_runs_before_the_token_is_consumed():
    from app.api import inbound

    src = Path(inbound.__file__).read_text(encoding="utf-8")
    body = src.split("async def download_inbound_file", 1)[1]
    assert body.index("await _limit(") < body.index("pipe.delete(")


# ── 293-IN-03: an oversize body is refused before it is read ────────────────────────────────


def test_the_body_cap_is_derived_from_the_field_caps():
    assert ii.INBOUND_MAX_BODY_BYTES >= ii.MAX_FIELDS * ii.MAX_VALUE_CHARS
    assert ii.INBOUND_MAX_BODY_BYTES < 8 * 1024 * 1024


def test_an_oversize_inbound_body_is_413_before_it_is_parsed(monkeypatch):
    from app.api import inbound
    from tests.unit.phase293_inbound_fakes import (
        WF_ID, FakePool, FakeRedis, audit_spies, build_app, make_key,
    )

    audit_spies(monkeypatch)
    limiter = AsyncMock()
    monkeypatch.setattr(inbound, "_limit", limiter)
    client = TestClient(build_app(key=make_key(), pool=FakePool(), redis=FakeRedis()))
    n = ii.INBOUND_MAX_BODY_BYTES
    # Not even JSON: a parse would answer 422; the cap must answer first, from the header alone.
    r = client.post(
        f"/inbound/workflows/{WF_ID}/runs", content=b"x" * (n + 1),
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 413
    assert r.json() == {"detail": f"This request is too large: send at most {n // 1024} KB of inputs."}
    limiter.assert_not_called()


def test_a_normal_inbound_body_passes_the_cap(monkeypatch):
    from tests.unit.test_293_inbound_start import URL

    env = _inbound_start_env(monkeypatch)
    r = env["client"].post(URL, json={"inputs": {"topic": "EU energy prices"}})
    assert r.status_code == 201, r.text


def _inbound_start_env(monkeypatch, definition=None):
    from uuid import UUID

    from app.db import api_keys as api_keys_db
    from tests.unit.phase293_inbound_fakes import (
        DEFINITION, RUN_ID, WF_ID, FakePool, FakeRedis, audit_spies, build_app, make_key,
    )

    events: list = []
    now, later, _limiter = audit_spies(monkeypatch, events)
    rows = [{"id": UUID(WF_ID), "readable": True, "name": "Weekly digest", "status": "published",
             "definition": json.dumps(definition if definition is not None else DEFINITION)}]

    async def _key_workflows(_pool, *, workflow_ids, user_id, org_id):
        return rows

    monkeypatch.setattr(api_keys_db, "get_key_workflows", _key_workflows)
    launch = AsyncMock(return_value=UUID(RUN_ID))
    monkeypatch.setattr("app.services.unattended_launch.launch_unattended_run", launch)
    monkeypatch.setattr("app.services.entitlement_service.enforce_entitlement",
                        AsyncMock(return_value=None))
    client = TestClient(build_app(key=make_key(), pool=FakePool(events), redis=FakeRedis()))
    return {"client": client, "launch": launch, "now": now, "later": later}


# ── 293-IN-06: a field-less workflow needs a typed task ─────────────────────────────────────


_TASK_ONLY = {"name": "Literature review", "slug": "lit", "version": 1, "phases": []}


def test_a_field_less_workflow_needs_a_typed_task():
    assert ii.needs_typed_task(ii.declared_fields(_TASK_ONLY)) is True
    assert ii.needs_typed_task(ii.declared_fields({"input_keys": ["kickoff_prompt"]})) is True
    assert ii.needs_typed_task(
        ii.declared_fields({"inputs": [{"key": "topic", "type": "text"}]})
    ) is False


def test_an_inbound_start_of_a_task_only_workflow_is_refused_in_words(monkeypatch):
    from tests.unit.phase293_inbound_fakes import all_audits
    from tests.unit.test_293_inbound_start import URL

    env = _inbound_start_env(monkeypatch, definition=_TASK_ONLY)
    r = env["client"].post(URL, json={"inputs": {}})
    assert r.status_code == 422
    assert r.json()["detail"] == ii.NEEDS_TASK_DETAIL
    env["launch"].assert_not_called()
    refused = [a for a in all_audits(env["now"], env["later"]) if a[0] == "api_key.refused"]
    assert [a[1]["reason"] for a in refused] == ["needs_task"]


# api key management: reuse the 293 in-memory store and its fresh-app client.
from tests.unit.test_293_api_keys_routes import (  # noqa: E402
    WF_GLOBAL,
    WF_PUB,
    _create,
    _wf,
    client,  # noqa: F401 — fixture
    store,  # noqa: F401 — fixture
)

WF_TASK = "55555555-5555-4555-8555-000000000005"


def _add_task_only(store):
    store.workflows[WF_TASK] = _wf(WF_TASK, "Literature review", definition=dict(_TASK_ONLY))


def test_the_picker_greys_a_task_only_workflow(client, store):  # noqa: F811
    _add_task_only(store)
    by_id = {w["id"]: w for w in client.get("/api-keys/startable-workflows").json()["workflows"]}
    assert by_id[WF_TASK]["startable"] is False
    assert by_id[WF_TASK]["reason"] == "needs_task"
    assert by_id[WF_PUB]["startable"] is True


def test_create_key_refuses_a_task_only_workflow(client, store):  # noqa: F811
    _add_task_only(store)
    r = _create(client, workflow_ids=[WF_TASK])
    assert r.status_code == 422
    assert r.json()["detail"] == (
        "Literature review starts from a typed task, which a key can't send yet."
    )
    assert store.keys == []


def test_create_key_refuses_a_workflow_the_picker_hides(client, store):  # noqa: F811
    r = _create(client, workflow_ids=[WF_PUB, WF_GLOBAL])
    assert r.status_code == 422
    assert r.json()["detail"] == (
        "Starter summary isn't one of your published workflows in this organization, "
        "so a key can't start it."
    )
    assert store.keys == []


def test_an_existing_key_reads_needs_task_on_its_card(client, store):  # noqa: F811
    assert _create(client).status_code == 201
    store.workflows[WF_PUB]["definition"] = dict(_TASK_ONLY)
    refs = client.get("/api-keys").json()["keys"][0]["workflows"]
    assert [(w["id"], w["state"]) for w in refs] == [(WF_PUB, "needs_task")]


# ── 293-IN-08: re-revoking is quiet ─────────────────────────────────────────────────────────


@pytest.mark.parametrize("path", ["/api-keys/{id}/revoke", "/org/api-keys/{id}/revoke"])
def test_revoking_twice_writes_one_audit_row(client, store, path):  # noqa: F811
    key_id = _create(client).json()["key"]["id"]
    store.is_admin = True
    store.audits.clear()
    first = client.post(path.format(id=key_id))
    second = client.post(path.format(id=key_id))
    assert first.status_code == second.status_code == 200
    assert second.json()["state"] == "revoked"
    assert [a["action_type"] for a in store.audits] == ["api_key.revoke"]


@pytest.mark.asyncio
async def test_revoke_key_reports_whether_this_call_revoked():
    from app.db import api_keys as db

    class _Pool:
        def __init__(self, status):
            self.status = status

        async def execute(self, sql, *args):
            return self.status

        async def fetchrow(self, sql, *args):
            return {"id": "k", "label": "L", "revoked_at": "t"}

    org, user = uuid4(), uuid4()
    first = await db.revoke_key(_Pool("UPDATE 1"), key_id=uuid4(), org_id=org, owner_id=user,
                                revoked_by=user)
    again = await db.revoke_key(_Pool("UPDATE 0"), key_id=uuid4(), org_id=org, owner_id=user,
                                revoked_by=user)
    assert first["revoked_now"] is True
    assert again["revoked_now"] is False
