"""Phase 300-05 (NOTE-04 / D-09, D-29; T-300-35, T-300-36) — the member's own email switch.

⛔ THE SWITCH HAS ITS OWN WRITE. ``PUT /me/preferences`` treats a missing or null
``default_model`` as "clear my default model". A switch that saved through it would wipe the
member's default chat model every time they turned email off. So the switch saves through
``PUT /me/preferences/notification-email``, which runs ONE statement — an RLS-scoped ``||``
merge of ``{"notification_email_enabled": <bool>}`` keyed on ``auth.uid()`` — and the existing
PUT stays byte-identical to the plan base (pinned by hash below).

⛔ D-29: Phase 301 owns ``GET /notifications``. No route under ``/notifications`` ships here.
"""
from __future__ import annotations

import asyncio
import hashlib
import inspect
from contextlib import asynccontextmanager

import pytest

from app.api import me_preferences as mp
from app.dependencies import get_current_user
from app.main import app
from app.models.user_settings import _build_settings_from_row

USER = {"id": "33333333-3333-3333-3333-333333333333", "email": "m@x.test"}

# The base text of ``put_my_preferences`` (decorator included), captured at the plan base
# 250b79d78 with ``inspect.getsource``. Any edit to the default_model PUT reds this.
_PUT_MY_PREFERENCES_BASE_SHA256 = "c17044aa7c67f77a1486690570f1451a9092d0dcf26771979500ee77ee4f4ddd"


class _RecordingConn:
    def __init__(self):
        self.statements: list[tuple[str, tuple]] = []

    async def execute(self, sql, *args):
        self.statements.append((sql, args))
        return "INSERT 0 1"


@pytest.fixture
def recorded(monkeypatch):
    conn = _RecordingConn()
    seen: dict = {}

    @asynccontextmanager
    async def _user_conn(request, current_user):
        seen["user"] = current_user
        yield conn

    state = {"stored": {"default_model": "gpt-4o"}}

    async def _app_settings():
        return _build_settings_from_row({})

    async def _allowed():
        return {"gpt-4o"}

    async def _locked():
        return False

    async def _model_default(user_id):
        return state["stored"].get("default_model")

    async def _email_enabled(user_id):
        value = state["stored"].get("notification_email_enabled")
        return True if value is None else bool(value)

    monkeypatch.setattr(mp, "get_user_pg_connection", _user_conn)
    monkeypatch.setattr(mp, "load_app_settings_async", _app_settings)
    monkeypatch.setattr(mp, "enabled_model_allowed_set", _allowed)
    monkeypatch.setattr(mp, "operator_model_default_locked", _locked)
    monkeypatch.setattr(mp, "load_user_model_default", _model_default)
    monkeypatch.setattr(mp, "load_user_notification_email_enabled", _email_enabled, raising=False)
    monkeypatch.setattr(mp, "configured_provider", lambda: "resend", raising=False)
    return {"conn": conn, "seen": seen, "state": state}


def _get():
    return asyncio.run(mp.get_my_preferences(request=None, current_user=USER))


# ── GET /me/preferences gains three keys ────────────────────────────────────────────────────


def test_an_unset_preference_reads_on_with_the_default_delay_in_words(recorded):
    out = _get()
    assert out["notification_email_enabled"] is True
    assert out["notification_email_delay_words"] == "2 minutes"
    assert out["email_configured"] is True
    # The four shipped keys are unchanged.
    assert out["default_model"] == "gpt-4o"
    assert out["effective_model"] == "gpt-4o"
    assert out["locked"] is False
    assert out["allowed_models"] == ["gpt-4o"]


def test_the_delay_words_follow_the_operator_knob(recorded, monkeypatch):
    async def _app_settings():
        return _build_settings_from_row({"notification_email_delay_seconds": 300})

    monkeypatch.setattr(mp, "load_app_settings_async", _app_settings)
    assert _get()["notification_email_delay_words"] == "5 minutes"


def test_email_configured_is_false_when_no_provider(recorded, monkeypatch):
    monkeypatch.setattr(mp, "configured_provider", lambda: "none")
    assert _get()["email_configured"] is False


def test_the_stored_opt_out_reads_back_off(recorded):
    recorded["state"]["stored"]["notification_email_enabled"] = False
    assert _get()["notification_email_enabled"] is False


def test_the_opt_out_reader_treats_only_false_as_off(monkeypatch):
    """The reader agrees with the drainer's SQL: ``coalesce(..., 'true') <> 'false'``."""
    answers = iter(["false", "true", None, "gpt-4o"])

    class _Pool:
        async def fetchval(self, sql, *args):
            assert "notification_email_enabled" in sql
            assert args == (USER["id"],)
            return next(answers)

    async def _pool():
        return _Pool()

    monkeypatch.setattr("app.dependencies.get_pg_pool", _pool)
    reads = [asyncio.run(mp.load_user_notification_email_enabled(USER["id"])) for _ in range(4)]
    assert reads == [False, True, True, True]


# ── PUT /me/preferences/notification-email ──────────────────────────────────────────────────


def test_the_switch_writes_one_merge_on_the_callers_rls_connection(recorded):
    out = asyncio.run(
        mp.put_my_notification_email(
            body=mp.NotificationEmailBody(enabled=False), request=None, current_user=USER
        )
    )
    statements = recorded["conn"].statements
    assert len(statements) == 1, statements
    sql, args = statements[0]
    assert "auth.uid()" in sql
    assert "||" in sql
    assert "default_model" not in sql
    assert args == ({"notification_email_enabled": False},)
    assert recorded["seen"]["user"] is USER
    # The response is the full GET view; the default model is what it was before.
    assert out["default_model"] == "gpt-4o"
    assert set(out) >= {
        "default_model",
        "effective_model",
        "locked",
        "allowed_models",
        "notification_email_enabled",
        "notification_email_delay_words",
        "email_configured",
    }


def test_the_switch_response_is_the_servers_value(recorded, monkeypatch):
    """The response is a fresh read, never an echo of the body: the server here says ON even
    though the body said off, and the response must carry ON."""
    async def _email_enabled(user_id):
        return True

    monkeypatch.setattr(mp, "load_user_notification_email_enabled", _email_enabled)
    out = asyncio.run(
        mp.put_my_notification_email(
            body=mp.NotificationEmailBody(enabled=False), request=None, current_user=USER
        )
    )
    assert out["notification_email_enabled"] is True


def test_the_switch_body_carries_no_user_id():
    assert set(mp.NotificationEmailBody.model_fields) == {"enabled"}


def test_the_default_model_put_is_byte_identical_to_the_plan_base():
    src = inspect.getsource(mp.put_my_preferences).replace("\r\n", "\n")
    assert hashlib.sha256(src.encode()).hexdigest() == _PUT_MY_PREFERENCES_BASE_SHA256


def test_a_null_default_model_still_issues_the_clear_statement(recorded):
    asyncio.run(
        mp.put_my_preferences(
            body=mp.ModelDefaultBody(default_model=None), request=None, current_user=USER
        )
    )
    statements = recorded["conn"].statements
    assert len(statements) == 1
    sql, args = statements[0]
    assert sql == (
        "INSERT INTO public.user_settings (user_id, preferences) "
        "VALUES (auth.uid(), '{}'::jsonb) "
        "ON CONFLICT (user_id) DO UPDATE "
        "SET preferences = coalesce(public.user_settings.preferences, '{}'::jsonb) - 'default_model', "
        "    updated_at = now()"
    )
    assert args == ()


# ── the route table ─────────────────────────────────────────────────────────────────────────


def _route(path: str, method: str):
    for route in app.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route
    return None


def test_the_switch_route_is_ungated():
    route = _route("/me/preferences/notification-email", "PUT")
    assert route is not None, "PUT /me/preferences/notification-email is not mounted"
    names = []
    for dep in route.dependant.dependencies:
        call = getattr(dep, "call", None)
        names.append(getattr(call, "__qualname__", repr(call)))
    joined = " ".join(names)
    assert "require_visible" not in joined
    assert "require_capability" not in joined
    assert "get_current_user" in joined


def test_the_switch_route_refuses_a_caller_with_no_token(client):
    """It depends on ``get_current_user`` like the GET beside it, so an unsigned caller is refused
    by the shared bearer scheme exactly as ``GET /me/preferences`` is."""
    saved = app.dependency_overrides.pop(get_current_user)
    try:
        res = client.put("/me/preferences/notification-email", json={"enabled": False})
        sibling = client.get("/me/preferences")
    finally:
        app.dependency_overrides[get_current_user] = saved
    assert res.status_code in (401, 403), res.text
    assert res.status_code == sibling.status_code


def test_no_notifications_route_ships_in_this_phase():
    """D-29 — the in-app waiting list is Phase 301's."""
    paths = [getattr(r, "path", "") for r in app.routes]
    assert not [p for p in paths if p.startswith("/notifications")]
