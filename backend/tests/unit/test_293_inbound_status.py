"""Phase 293 (START-02 SC#1/SC#3; D-08, D-10, D-12, D-14, D-16; A2) — the status read and file link.

``GET /inbound/runs/{run_id}`` answers ONLY to the key that started the run: the access query is
``origin_kind = 'key' AND origin_ref = <this key>`` plus the owner, so another key, even the same
person's, an app run and an unknown id are one and the same 404. Files come back as one-time
links valid 300 s, served by ``GET /inbound/files/{token}``.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.api import inbound
from tests.unit.phase293_inbound_fakes import (
    FILE_ID,
    KEY_ID,
    ORG_ID,
    OTHER_KEY_ID,
    RUN_ID,
    THREAD_ID,
    USER_ID,
    FakePool,
    FakeRedis,
    all_audits,
    audit_spies,
    build_app,
    make_key,
    no_secret_in,
)

URL = f"/inbound/runs/{RUN_ID}"
SNAPSHOT = {
    "name": "Weekly digest",
    "slug": "weekly-digest",
    "version": 1,
    "phases": [
        {"slug": "gather", "name": "Gather the news", "phase_index": 0, "phase_type": "llm_agent"},
        {"slug": "write", "name": "Write the digest", "phase_index": 1, "phase_type": "llm_single"},
    ],
}


def _run(**kw):
    row = {"id": RUN_ID, "thread_id": THREAD_ID, "status": "completed", "user_id": USER_ID,
           "org_id": ORG_ID, "definition_snapshot": SNAPSHOT}
    row.update(kw)
    return row


def _phase(slug, idx, status, output=None):
    return {"slug": slug, "phase_index": idx, "status": status, "started_at": None,
            "completed_at": None, "output": output}


@pytest.fixture
def env(monkeypatch):
    events: list = []
    pool = FakePool(events)
    redis = FakeRedis()
    now, later, limiter = audit_spies(monkeypatch, events)
    unanswered = AsyncMock(return_value=None)
    monkeypatch.setattr("app.db.workflows.get_unanswered_ask_user", unanswered)
    key = make_key()
    client = TestClient(build_app(key=key, pool=pool, redis=redis))
    return {"client": client, "pool": pool, "redis": redis, "now": now, "later": later,
            "limiter": limiter, "events": events, "unanswered": unanswered, "key": key}


def _access_call(env):
    return next(c for c in env["pool"].calls if "FROM workflow_runs" in c[0])


def test_the_access_query_is_the_d12_predicate_with_explicit_columns(env):
    env["pool"].run_row = None
    env["client"].get(URL)
    sql, args = _access_call(env)
    assert "WHERE id = $1 AND origin_kind = 'key' AND origin_ref = $2 AND user_id = $3" in sql
    assert "*" not in sql
    assert [str(a) for a in args] == [RUN_ID, KEY_ID, USER_ID]
    src = inbound.__file__
    assert "origin_ref = $2" in open(src, encoding="utf-8").read()


def test_every_run_this_key_did_not_start_is_the_same_404(env):
    env["pool"].run_row = None  # another key's run, an app run, an unknown id: the query misses
    bodies = [env["client"].get(URL).content, env["client"].get("/inbound/runs/not-a-uuid").content,
              env["client"].get("/inbound/runs/99999999-9999-4999-8999-999999999999").content]
    assert bodies[0] == bodies[1] == bodies[2] == b'{"detail":"Not found."}'
    reasons = [a[1]["reason"] for a in all_audits(env["now"], env["later"])]
    assert reasons == ["run_not_found"] * 3


def test_the_same_owners_other_key_cannot_read_the_run(monkeypatch):
    """D-12 is about the KEY, not the person: the predicate binds this key's id."""
    events: list = []
    pool = FakePool(events)
    audit_spies(monkeypatch, events)
    client = TestClient(build_app(key=make_key(id=OTHER_KEY_ID), pool=pool, redis=FakeRedis()))
    assert client.get(URL).status_code == 404
    _sql, args = next(c for c in pool.calls if "FROM workflow_runs" in c[0])
    assert str(args[1]) == OTHER_KEY_ID


def test_reads_are_limited_before_any_other_work(env):
    env["pool"].run_row = _run()
    env["client"].get(URL)
    assert env["events"][0] == ("limit", "read")


def test_a_finished_run_reads_back_status_output_steps_and_files(env):
    env["pool"].run_row = _run()
    env["pool"].phase_rows = [
        _phase("gather", 0, "completed", {"text": "notes"}),
        _phase("write", 1, "completed", {"text": "This week: prices fell 4%."}),
    ]
    env["pool"].file_rows = [{"id": FILE_ID, "path": "/out/digest.docx", "size_bytes": 2048}]
    r = env["client"].get(URL)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "completed"
    assert body["output_text"] == "This week: prices fell 4%."
    assert body["steps"] == [
        {"name": "Gather the news", "state": "completed"},
        {"name": "Write the digest", "state": "completed"},
    ]
    assert body["waiting_on"] is None and body["end_reason"] is None
    [f] = body["files"]
    assert f["name"] == "digest.docx" and f["size_bytes"] == 2048 and f["expires_in"] == 300
    token = f["url"].rsplit("/", 1)[1]
    assert f["url"] == f"/inbound/files/{token}"
    [(rkey, payload, ex)] = env["redis"].sets
    assert rkey == f"apikey:dl:{token}" and ex == 300
    assert json.loads(payload) == {"key_id": KEY_ID, "run_id": RUN_ID, "file_id": FILE_ID}
    # the file list read excludes template inputs and expired rows, NULL kind included
    files_sql = next(c for c in env["pool"].calls if "FROM workspace_files" in c[0])[0]
    assert "IS DISTINCT FROM 'template_input'" in files_sql and "expires_at" in files_sql
    audits = all_audits(env["now"], env["later"])
    assert [(a[0], a[1]["outcome"]) for a in audits] == [("api_key.read", "completed")]
    assert no_secret_in(audits)


def test_an_active_run_reads_running_with_its_step(env):
    env["pool"].run_row = _run(status="active")
    env["pool"].phase_rows = [_phase("gather", 0, "completed"), _phase("write", 1, "active")]
    body = env["client"].get(URL).json()
    assert body["status"] == "running"
    assert (body["step_index"], body["step_total"]) == (2, 2)
    assert body["output_text"] == "" or body["output_text"] is None


def test_a_run_waiting_on_a_person_names_the_owner_and_never_the_prompt(env):
    env["pool"].run_row = _run(status="paused")
    env["pool"].phase_rows = [_phase("gather", 0, "active")]
    env["unanswered"].return_value = {"prompt": "Approve the secret pricing memo?",
                                      "timeout_seconds": None, "created_at": None}
    body = env["client"].get(URL).json()
    assert body["status"] == "waiting_for_person"
    assert body["waiting_on"] == {"who": "Sam Rivera"}
    assert "pricing memo" not in json.dumps(body)


@pytest.mark.parametrize("status", ["cap_paused", "paused"])
def test_other_pauses_read_paused(env, status):
    env["pool"].run_row = _run(status=status)
    assert env["client"].get(URL).json()["status"] == "paused"


@pytest.mark.parametrize("status", ["failed", "cancelled"])
def test_ended_runs_read_verbatim_with_their_recorded_reason(env, status):
    env["pool"].run_row = _run(status=status)
    env["pool"].phase_rows = [_phase("gather", 0, "failed", {"_failure_reason": "The source was empty."})]
    body = env["client"].get(URL).json()
    assert body["status"] == status
    assert body["end_reason"] == "The source was empty."
    assert body["steps"] == [{"name": "Gather the news", "state": "failed"}]


def test_a_file_list_failure_degrades_never_500s(env):
    env["pool"].run_row = _run()
    env["pool"].raise_on_files = True
    r = env["client"].get(URL)
    assert r.status_code == 200 and r.json()["files"] == []


# ── the one-time file link ──────────────────────────────────────────────────────────────────


def _file_env(env, monkeypatch, *, key_row=None, file_row=None):
    token = "tok_" + "a" * 28
    env["redis"].store[f"apikey:dl:{token}"] = json.dumps(
        {"key_id": KEY_ID, "run_id": RUN_ID, "file_id": FILE_ID}
    )
    env["pool"].key_row = key_row if key_row is not None else {
        "id": KEY_ID, "org_id": ORG_ID, "user_id": USER_ID, "label": "n8n-prod",
        "revoked_at": None, "expires_at": None,
    }
    env["pool"].run_row = {"thread_id": THREAD_ID}
    row = file_row if file_row is not None else {
        "id": FILE_ID, "thread_id": THREAD_ID, "path": "/out/digest.docx",
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content_inline": b"PK\x03\x04exact-bytes\x00\xff", "content_storage_path": None,
        "kind": "agent", "is_expired": False,
    }
    monkeypatch.setattr("app.db.workspace.get_file_by_id", AsyncMock(return_value=row))
    monkeypatch.setattr("app.db.api_keys.is_org_member", AsyncMock(return_value=True))
    monkeypatch.setattr("app.dependencies._is_banned", AsyncMock(return_value=False))
    monkeypatch.setattr("app.dependencies.get_service_role_supabase", lambda *_a, **_k: object())
    return f"/inbound/files/{token}"


def test_a_valid_link_streams_the_exact_bytes_once(env, monkeypatch):
    url = _file_env(env, monkeypatch)
    r = env["client"].get(url)
    assert r.status_code == 200, r.text
    assert r.content == b"PK\x03\x04exact-bytes\x00\xff"
    assert 'filename="digest.docx"' in r.headers["content-disposition"]
    assert env["redis"].pipelines == [{"transaction": True}]
    second = env["client"].get(url)
    assert second.status_code == 404 and second.content == b'{"detail":"Not found."}'
    run_sql = next(c for c in env["pool"].calls if "FROM workflow_runs" in c[0])[0]
    assert "origin_ref = $2" in run_sql
    ok = [a for a in all_audits(env["now"], env["later"]) if a[0] == "api_key.read"]
    assert len(ok) == 1 and ok[0][1]["call"] == "file"
    assert ("limit", "read") in env["events"]


def test_an_unknown_token_is_404(env):
    r = env["client"].get("/inbound/files/" + "z" * 32)
    assert r.status_code == 404 and r.content == b'{"detail":"Not found."}'


def test_a_link_whose_key_was_revoked_since_is_404(env, monkeypatch):
    url = _file_env(env, monkeypatch, key_row={
        "id": KEY_ID, "org_id": ORG_ID, "user_id": USER_ID, "label": "n8n-prod",
        "revoked_at": datetime.now(timezone.utc), "expires_at": None,
    })
    assert env["client"].get(url).status_code == 404


def test_a_link_whose_key_expired_since_is_404(env, monkeypatch):
    url = _file_env(env, monkeypatch, key_row={
        "id": KEY_ID, "org_id": ORG_ID, "user_id": USER_ID, "label": "n8n-prod",
        "revoked_at": None, "expires_at": datetime.now(timezone.utc) - timedelta(minutes=1),
    })
    assert env["client"].get(url).status_code == 404


def test_a_file_from_another_thread_is_404(env, monkeypatch):
    url = _file_env(env, monkeypatch, file_row={
        "id": FILE_ID, "thread_id": "88888888-8888-4888-8888-888888888888", "path": "/x.txt",
        "mime_type": "text/plain", "content_inline": b"x", "content_storage_path": None,
        "kind": "agent", "is_expired": False,
    })
    assert env["client"].get(url).status_code == 404


def test_the_file_route_needs_no_bearer_and_uses_no_session(monkeypatch):
    """A signed link: the token is the credential. Mounted with NO key override at all."""
    events: list = []
    pool = FakePool(events)
    audit_spies(monkeypatch, events)
    client = TestClient(build_app(key=None, pool=pool, redis=FakeRedis()))
    r = client.get("/inbound/files/" + "q" * 32)
    assert r.status_code == 404  # not 401: no bearer is asked for
