"""Phase 305-04 (GUARD-03; D-35 / D-36 / D-56; T-305-24 / T-305-35) — the org's PII redaction switch
over HTTP, and the guard on every MCP result in ``dispatch``.

Routes: ``GET/PUT /org/api-keys/pii-redaction`` on the EXISTING ``org_router``, behind
``require_org_manage`` for the ACTIVE org. A flip writes ONE ``settings.update`` audit row with
``metadata = {event: "pii_redaction", enabled}`` and an explicit ``org_id``, AFTER the write
returned; a failed write is an error and no audit row. Fresh ``FastAPI()`` apps with dependency
overrides — never ``app.main.app``'s lifespan (SEED-363).

Dispatch: every handler MODEL passes ``outbound_guard.guard`` before ``results.render``, with the
switch read live for ``principal.org_id`` on every call; ``WITHHELD`` answers the D-35 sentence as a
tool error and audits ``outcome: redaction_blocked``; a read chunk carries its overlap window.
"""
from __future__ import annotations

import inspect
import json
import re
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import api_keys as route
from tests.unit import _mcp305_harness as h

ORG = "44444444-4444-4444-8444-444444444444"
ADMIN = "66666666-6666-4666-8666-666666666666"
MEMBER = "33333333-3333-4333-8333-333333333333"
DOC = "dddddddd-0000-4000-8000-000000000001"

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[1] / "fixtures" / "phase293" / "api_keys_contract.json")
    .read_text(encoding="utf-8")
)


class _State:
    def __init__(self):
        self.on: bool | None = False
        self.is_admin = True
        self.caller = ADMIN
        self.writes: list[tuple[str, bool]] = []
        self.audits: list[dict] = []
        self.fail_write: Exception | None = None
        self.missing_org = False
        self.order: list[str] = []


@pytest.fixture
def st(monkeypatch):
    from app.db import outbound_policy

    s = _State()

    async def pii_redaction_enabled(pool, org_id):
        return None if s.missing_org else s.on

    async def set_pii_redaction_enabled(pool, *, org_id, enabled):
        if s.fail_write is not None:
            raise s.fail_write
        if s.missing_org:
            return None
        s.writes.append((str(org_id), enabled))
        s.order.append("write")
        s.on = enabled
        return enabled

    monkeypatch.setattr(outbound_policy, "pii_redaction_enabled", pii_redaction_enabled)
    monkeypatch.setattr(outbound_policy, "set_pii_redaction_enabled", set_pii_redaction_enabled)

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        s.order.append("audit")
        s.audits.append({"user_id": user_id, "action_type": action_type, "metadata": metadata,
                         "org_id": org_id})

    monkeypatch.setattr(route, "write_audit_entry", _write)
    monkeypatch.setattr(route, "get_service_role_supabase", lambda org_id: object())

    async def _perm(request, current_user, active_org, perm):
        return s.is_admin

    monkeypatch.setattr(deps, "_has_org_permission", _perm)
    return s


@pytest.fixture
def client(st):
    app = FastAPI()
    app.include_router(route.router)
    app.include_router(route.org_router)

    async def _user():
        return {"id": st.caller, "email": "t@example.com"}

    async def _org():
        return ORG

    async def _pool():
        return object()

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_active_org_id] = _org
    app.dependency_overrides[deps.get_pg_pool] = _pool
    return TestClient(app, raise_server_exceptions=False)


# ── the routes ────────────────────────────────────────────────────────────────────────────────


def test_an_org_admin_reads_off_by_default(client, st):
    r = client.get("/org/api-keys/pii-redaction")
    assert r.status_code == 200, r.text
    assert r.json() == {"enabled": False}


def test_the_payload_matches_the_contract_fixture(client, st):
    assert set(client.get("/org/api-keys/pii-redaction").json()) == set(CONTRACT["OrgPiiRedaction"])


def test_a_flip_on_writes_then_audits_one_settings_update_row(client, st):
    r = client.put("/org/api-keys/pii-redaction", json={"enabled": True})
    assert r.status_code == 200, r.text
    assert r.json() == {"enabled": True}
    assert st.writes == [(ORG, True)]
    assert st.order == ["write", "audit"]
    (entry,) = st.audits
    assert entry == {
        "user_id": ADMIN,
        "action_type": "settings.update",
        "metadata": {"event": "pii_redaction", "enabled": True},
        "org_id": ORG,
    }
    assert client.get("/org/api-keys/pii-redaction").json() == {"enabled": True}


def test_switching_off_is_audited_too(client, st):
    st.on = True
    r = client.put("/org/api-keys/pii-redaction", json={"enabled": False})
    assert r.status_code == 200 and r.json() == {"enabled": False}
    (entry,) = st.audits
    assert entry["metadata"] == {"event": "pii_redaction", "enabled": False}


def test_a_member_gets_the_same_403_on_read_and_write(client, st):
    st.is_admin = False
    st.caller = MEMBER
    for r in (client.get("/org/api-keys/pii-redaction"),
              client.put("/org/api-keys/pii-redaction", json={"enabled": True})):
        assert r.status_code == 403
        assert r.json() == {"detail": "You do not have permission to manage this organization."}
    assert st.writes == [] and st.audits == []


def test_an_extra_body_field_is_422_and_nothing_is_written(client, st):
    r = client.put("/org/api-keys/pii-redaction", json={"enabled": True, "org_id": "x"})
    assert r.status_code == 422
    assert client.put("/org/api-keys/pii-redaction", json={}).status_code == 422
    assert st.writes == [] and st.audits == []


def test_a_write_that_finds_no_org_is_404_with_no_audit_row(client, st):
    st.missing_org = True
    assert client.put("/org/api-keys/pii-redaction", json={"enabled": True}).status_code == 404
    assert client.get("/org/api-keys/pii-redaction").status_code == 404
    assert st.audits == []


def test_a_raising_write_is_5xx_with_no_audit_row(client, st):
    st.fail_write = RuntimeError("connection reset")
    r = client.put("/org/api-keys/pii-redaction", json={"enabled": True})
    assert r.status_code >= 500
    assert st.audits == []


def test_no_new_audit_literal_and_the_existing_router_carries_the_routes():
    src = inspect.getsource(route)
    assert src.count('"event": "pii_redaction"') == 1
    assert "org.pii" not in src and "pii.update" not in src
    paths = {getattr(r, "path", "") for r in route.org_router.routes}
    assert "/org/api-keys/pii-redaction" in paths
    from app.services import audit_service

    assert "settings.update" in inspect.getsource(audit_service)


# ── the guard in dispatch ────────────────────────────────────────────────────────────────────


def _search_model():
    from app.mcp import results as R

    return R.SearchResult(passages=[R.Passage(
        document_id=DOC, title="Notes for jane.doe@example.com",
        passage="Call +44 20 7946 0958 or write jane.doe@example.com.",
        citation=R.Citation(passage=1), link=R.doc_link(DOC), origin="library")])


@pytest.fixture
def mcp(monkeypatch):
    """A registered tool returning a model, the real dispatch, the audit recorder, and a switch
    whose live reads are counted."""
    import app.mcp.dispatch as dispatch
    import app.mcp.tools as tools

    rows = h.stub_accounting(monkeypatch)
    state = {"on": True, "reads": [], "model": _search_model}

    async def _pii_on(org_id):
        state["reads"].append(org_id)
        if isinstance(state["on"], Exception):
            raise state["on"]
        return state["on"]

    monkeypatch.setattr(dispatch, "_pii_on", _pii_on)

    async def handler(principal, args):
        return state["model"]()

    monkeypatch.setitem(tools.REGISTERED, "t_read", h.make_spec("t_read", handler))
    state["rows"] = rows
    return state


async def _call(name="t_read"):
    from app.mcp.dispatch import dispatch

    return await dispatch(replace(h.PRINCIPAL, tools=(name,)), name, {})


async def test_on_masks_both_the_structure_and_the_text_and_keeps_ids_and_links(mcp):
    from app.mcp import results as R

    out = await _call()
    assert out.is_error is not True
    p = out.structured_content["passages"][0]
    assert p["title"] == "Notes for [email removed]"
    assert p["passage"] == "Call [phone removed] or write [email removed]."
    assert p["document_id"] == DOC and p["link"] == R.doc_link(DOC) and p["citation"] == {"passage": 1}
    text = out.content[0].text
    assert "[email removed]" in text and "[phone removed]" in text
    assert "jane.doe" not in text and "7946" not in text
    assert DOC in text and R.doc_link(DOC) in text
    assert mcp["reads"] == [h.PRINCIPAL.org_id]
    assert mcp["rows"][-1]["metadata"]["outcome"] == "ok"


async def test_off_passes_the_result_through_unchanged(mcp):
    mcp["on"] = False
    out = await _call()
    assert "jane.doe@example.com" in out.content[0].text
    assert out.structured_content["passages"][0]["passage"].startswith("Call +44 20 7946 0958")


async def test_the_switch_is_read_live_on_every_call(mcp):
    await _call()
    mcp["on"] = False
    second = await _call()
    assert mcp["reads"] == [h.PRINCIPAL.org_id, h.PRINCIPAL.org_id]
    assert "jane.doe@example.com" in second.content[0].text


async def test_an_unreadable_switch_redacts(mcp):
    mcp["on"] = ConnectionError("pool closed")
    out = await _call()
    assert out.is_error is not True
    assert "[email removed]" in out.content[0].text and "jane.doe" not in out.content[0].text


async def test_a_redactor_failure_withholds_and_audits_redaction_blocked(mcp, monkeypatch):
    from app.services import outbound_guard

    class _Boom:
        name = "boom"

        def spans(self, text):
            raise RuntimeError("recognizer blew up")

    monkeypatch.setattr(outbound_guard, "DEFAULT", _Boom())
    out = await _call()
    assert out.is_error is True
    assert out.content[0].text == outbound_guard.WITHHELD_SENTENCE
    assert out.structured_content is None
    assert "jane.doe" not in json.dumps(out.model_dump(mode="json"))
    row = mcp["rows"][-1]
    assert row["action_type"] == "api_key.read"
    assert row["metadata"]["outcome"] == "redaction_blocked"


async def test_a_read_chunk_is_guarded_over_its_overlap_window(mcp):
    from app.mcp import results as R

    full = "Ops desk: please call +44 20 7946 0958 before noon."
    cut = full.index("79") + 2

    def _model():
        model = R.ReadResult(document_id=DOC, title="Ops", link=R.doc_link(DOC), origin="library",
                             text=full[:cut], offset=0, end=cut, total_chars=len(full),
                             next_cursor=R.encode_read_cursor(DOC, cut))
        return R.with_window(model, full, 0, cut)

    mcp["model"] = _model
    out = await _call()
    s = out.structured_content
    assert s["text"] == "Ops desk: please call [phone removed]"
    assert set(s) == set(R.ReadResult.model_fields)  # the window is never serialised
    assert R.decode_read_cursor(s["next_cursor"], DOC, len(full)) == cut


async def test_a_handler_sentence_is_never_guarded(mcp):
    mcp["model"] = lambda: "No document with that id is available to this key."
    out = await _call()
    assert out.is_error is True and mcp["reads"] == []


def test_the_guard_sits_before_the_only_render_in_dispatch():
    src = (Path(__file__).resolve().parents[2] / "app" / "mcp" / "dispatch.py").read_text(encoding="utf-8")
    assert src.count("outbound_guard.guard(") == 1
    lines = src.splitlines()
    guard_at = next(i for i, ln in enumerate(lines) if "outbound_guard.guard(" in ln)
    render_at = [i for i, ln in enumerate(lines) if re.search(r"_results\.render\(|results\.render\(", ln)]
    assert len(render_at) == 1 and guard_at < render_at[0]


def test_results_window_helper_takes_128_chars_each_side():
    from app.mcp import results as R

    text = "a" * 300 + "CHUNK" + "b" * 300
    start, end = 300, 305
    before, after = R.window_around(text, start, end)
    assert before == "a" * R.REDACTION_WINDOW and after == "b" * R.REDACTION_WINDOW
    assert R.REDACTION_WINDOW == 128
    assert R.window_around("xyz", 0, 3) == ("", "")
