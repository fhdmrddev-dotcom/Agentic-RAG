"""Phase 147 Plan 03 Task 2 (ADMIN-02 + FLAG-01) — operator Kill + flag-write suite.

Proves:
  - ``POST /admin/runs/{id}/kill`` cancels ANY user's chat run — the operator-scoped
    SELECT has NO ownership filter (the D-02 difference) — returns 204 and delegates to
    the SHARED ``_cancel_run_internals`` (never a copy-paste of the cancel discipline);
  - the kill writes ONE ``operator_audit_log`` row naming the victim + model
    ("Ended {victim}'s run on {model}", action ``run.kill``) — 064-B;
  - a zombie-heal OUTCOME reads "Recovered a stuck run …", NEVER "Ended/killed" (064-B);
  - an already-terminal run → 204 idempotent, NO finalize / no double side-effect;
  - an eval/tuner internal job → 409 refusal (D-01, no Kill for bounded internal jobs);
  - a non-operator → byte-identical 404 (inherited router gate);
  - the victim's terminal cancel carries ONLY the ordinary cancelled/cancelled_by_user
    state — no operator attribution reaches anything the victim reads (D-03); who/why
    lives ONLY in ``operator_audit_log``;
  - ``PUT /admin/flags`` validates ``key`` against the code-constant allowlist (unknown →
    422, never a write — T-147-01), else ``save_app_settings`` + a ``flag.*`` /
    ``maintenance.set`` audit row.

Boundary mocking (MEMORY lesson): the operator gate is driven via the asyncpg pool mock
(``set_fetchrow_result``); the kill endpoint's own SELECTs drain the pool ``fetch`` queue
(``set_fetch_results``); the shared cancel helper's ``finalize_run_terminal`` is patched
so no real DB is touched; Redis is a purpose-built async fake patched onto
``app.api.admin.get_redis``; the audit floor writes through the shared supabase mock
(``mock_builder``).
"""
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

# Valid UUIDs so any ::uuid cast in production never chokes.
CHAT_ID = "11111111-1111-1111-1111-111111111111"
EVAL_ID = "33333333-3333-3333-3333-333333333333"
THREAD_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
VICTIM_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"


class _FakeRedis:
    """Async Redis stand-in for the cancel helper's best-effort ops.

    ``exists`` returns 0 so the synthetic-sentinel _emit_terminal branch is skipped;
    ``publish`` swallows the ask_user cancel sentinel; ``set``/``expire``/``zrem`` no-op
    truthily. None of these paths are load-bearing for the discriminator this suite
    asserts — they only must not raise out of the helper's try/except (RedisError/OSError).
    """

    def __init__(self):
        self.calls: list = []

    async def set(self, *a, **k):
        self.calls.append("set")
        return True

    async def exists(self, *a, **k):
        self.calls.append("exists")
        return 0

    async def expire(self, *a, **k):
        self.calls.append("expire")
        return True

    async def zrem(self, *a, **k):
        self.calls.append("zrem")
        return 1

    async def publish(self, *a, **k):
        self.calls.append("publish")
        return 1


def _op(mock_asyncpg_pool, monkeypatch):
    """Force the operator-present branch of the /admin gate (asyncpg pool fetchrow)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})


def _run_row(status="streaming", model="gpt-5"):
    return {
        "run_id": CHAT_ID,
        "status": status,
        "thread_id": THREAD_ID,
        "user_id": VICTIM_ID,
        "model": model,
        "provider": "openai",
    }


def _audit_inserts(mock_builder):
    return [
        c for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict)
        and "action" in c.args[0] and "label" in c.args[0]
    ]


# ── POST /admin/runs/{id}/kill ────────────────────────────────────────────────

def test_kill_chat_run_names_victim_and_records_run_kill(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """Operator kills another user's LIVE chat run → 204 + a run.kill row naming victim+model."""
    _op(mock_asyncpg_pool, monkeypatch)
    monkeypatch.setattr("app.api.admin.get_redis", lambda: _FakeRedis())
    # run SELECT, eval SELECT (not eval), email SELECT
    mock_asyncpg_pool.set_fetch_results([[_run_row()], [], [{"email": "maria@x.co"}]])

    # A LIVE producer in RUN_TASKS → the shared helper's task-cancel happy path fires.
    from app.api.threads import RUN_TASKS
    rid = UUID(CHAT_ID)
    fake_task = MagicMock()
    fake_task.done.return_value = False
    RUN_TASKS[rid] = fake_task
    try:
        res = client.post(f"/admin/runs/{CHAT_ID}/kill", headers=auth_headers)
        assert res.status_code == 204, f"expected 204; got {res.status_code} {res.text}"
        fake_task.cancel.assert_called_once()  # delegated to the SHARED cancel discipline
    finally:
        RUN_TASKS.pop(rid, None)

    inserts = _audit_inserts(mock_builder)
    assert len(inserts) == 1, "kill must write exactly one operator_audit_log row"
    row = inserts[0].args[0]
    assert row["action"] == "run.kill"
    assert "maria@x.co" in row["label"], f"label must name the victim; got {row['label']!r}"
    assert "gpt-5" in row["label"], f"label must name the model; got {row['label']!r}"
    assert row["is_write"] is True


def test_kill_zombie_outcome_reads_recovered_not_killed(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """A streaming run with NO live producer → zombie heal → 'Recovered a stuck run' (064-B)."""
    _op(mock_asyncpg_pool, monkeypatch)
    monkeypatch.setattr("app.api.admin.get_redis", lambda: _FakeRedis())
    fake_finalize = AsyncMock()
    monkeypatch.setattr("app.services.run_lifecycle.finalize_run_terminal", fake_finalize)
    mock_asyncpg_pool.set_fetch_results([[_run_row()], [], [{"email": "maria@x.co"}]])

    from app.api.threads import RUN_TASKS
    RUN_TASKS.pop(UUID(CHAT_ID), None)  # ensure the happy path can't fire → zombie

    res = client.post(f"/admin/runs/{CHAT_ID}/kill", headers=auth_headers)
    assert res.status_code == 204, f"expected 204; got {res.status_code} {res.text}"

    # D-03: the victim's terminal cancel carries ONLY the ordinary self-cancel state —
    # no operator identity threaded into the run finalize.
    fake_finalize.assert_awaited_once()
    fk = fake_finalize.await_args.kwargs
    assert fk["status"] == "cancelled"
    assert fk["error"] == "cancelled_by_user"
    assert "operator" not in fk and "operator_user_id" not in fk, \
        "D-03: no operator attribution may reach the victim's run finalize"

    inserts = _audit_inserts(mock_builder)
    assert len(inserts) == 1
    label = inserts[0].args[0]["label"]
    assert "Recovered a stuck run" in label, f"a zombie heal must NOT read 'killed'; got {label!r}"
    assert "Ended" not in label
    assert inserts[0].args[0]["action"] == "run.kill"


def test_kill_already_terminal_is_idempotent_no_side_effect(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Killing an already-terminal run → 204 idempotent, NO finalize (no double side-effect)."""
    _op(mock_asyncpg_pool, monkeypatch)
    monkeypatch.setattr("app.api.admin.get_redis", lambda: _FakeRedis())
    fake_finalize = AsyncMock()
    monkeypatch.setattr("app.services.run_lifecycle.finalize_run_terminal", fake_finalize)
    mock_asyncpg_pool.set_fetch_results([[_run_row(status="completed")], [], [{"email": "maria@x.co"}]])

    from app.api.threads import RUN_TASKS
    RUN_TASKS.pop(UUID(CHAT_ID), None)

    res = client.post(f"/admin/runs/{CHAT_ID}/kill", headers=auth_headers)
    assert res.status_code == 204
    fake_finalize.assert_not_awaited()  # terminal short-circuit: no re-cancel side effect


def test_kill_eval_run_refused_409(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A kill on an eval/tuner internal job → 409 refusal (D-01, no Kill affordance)."""
    _op(mock_asyncpg_pool, monkeypatch)
    monkeypatch.setattr("app.api.admin.get_redis", lambda: _FakeRedis())
    # run SELECT returns the row; eval SELECT finds the companion (eval_runs.id == run_id).
    mock_asyncpg_pool.set_fetch_results([[_run_row()], [{"id": CHAT_ID}]])

    res = client.post(f"/admin/runs/{CHAT_ID}/kill", headers=auth_headers)
    assert res.status_code == 409, f"expected 409 refusal for an internal job; got {res.status_code}"


def test_kill_missing_run_404_non_discoverable(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A missing run → 404 (non-discoverable, T-147-04): the operator SELECT found no row."""
    _op(mock_asyncpg_pool, monkeypatch)
    monkeypatch.setattr("app.api.admin.get_redis", lambda: _FakeRedis())
    mock_asyncpg_pool.set_fetch_results([[]])  # no runs row

    res = client.post(f"/admin/runs/{CHAT_ID}/kill", headers=auth_headers)
    assert res.status_code == 404


def test_kill_non_operator_404(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A non-operator gets a byte-identical 404 from the inherited router gate."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # no operator row → gate 404
    res = client.post(f"/admin/runs/{CHAT_ID}/kill", headers=auth_headers)
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}


# ── PUT /admin/flags ──────────────────────────────────────────────────────────

def test_flag_unknown_key_422_no_write(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """T-147-01: a key outside the code-constant allowlist → 422, save_app_settings NEVER called."""
    _op(mock_asyncpg_pool, monkeypatch)
    fake_save = AsyncMock()
    monkeypatch.setattr("app.api.admin.save_app_settings", fake_save)

    res = client.put("/admin/flags", json={"key": "drop_table; --", "value": True}, headers=auth_headers)
    assert res.status_code == 422
    fake_save.assert_not_awaited(), "an unknown key must never reach save_app_settings"


def test_flag_valid_capability_key_writes_and_records(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """A valid capability flag → save_app_settings({key: value}) + a flag.<key>.<on|off> row."""
    _op(mock_asyncpg_pool, monkeypatch)
    fake_save = AsyncMock()
    monkeypatch.setattr("app.api.admin.save_app_settings", fake_save)

    res = client.put("/admin/flags", json={"key": "sandbox_enabled", "value": False}, headers=auth_headers)
    assert res.status_code == 204
    fake_save.assert_awaited_once_with({"sandbox_enabled": False})

    inserts = _audit_inserts(mock_builder)
    assert len(inserts) == 1
    row = inserts[0].args[0]
    assert row["action"] == "flag.sandbox_enabled.off"
    assert row["label"], "flag write must carry a plain-language label"


def test_flag_maintenance_records_maintenance_set(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """maintenance_mode uses the dedicated ``maintenance.set`` action (066 linkage)."""
    _op(mock_asyncpg_pool, monkeypatch)
    fake_save = AsyncMock()
    monkeypatch.setattr("app.api.admin.save_app_settings", fake_save)

    res = client.put("/admin/flags", json={"key": "maintenance_mode", "value": True}, headers=auth_headers)
    assert res.status_code == 204
    fake_save.assert_awaited_once_with({"maintenance_mode": True})

    inserts = _audit_inserts(mock_builder)
    assert len(inserts) == 1
    assert inserts[0].args[0]["action"] == "maintenance.set"
