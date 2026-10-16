"""BUG-261015-03: ask_user's ``timeout_seconds`` is REQUIRED (strict mode needs every property in
``required``) but was described as "Optional", so models picked ~60 s and the question expired
before a person could answer (5/5 native rows in the Phase 282 board, pass 1).

Fix: a server floor (``ask_user_min_timeout_seconds``, default 300 = the null default) and a
schema description that tells the model to pass null unless the user asked for a deadline.
"""
from __future__ import annotations

import pytest

from app.config import settings
from app.services.openai_service import ASK_USER_TOOL
from app.services.tools.agent_control import _resolve_ask_timeout


def test_floor_default_equals_the_null_default():
    assert settings.ask_user_min_timeout_seconds == 300


@pytest.mark.parametrize("picked", [1, 30, 60, 299])
def test_a_model_picked_short_wait_is_raised_to_the_floor(picked):
    assert _resolve_ask_timeout(picked) == 300


def test_null_waits_the_default():
    assert _resolve_ask_timeout(None) == 300


def test_values_between_floor_and_cap_are_kept_and_the_cap_still_binds():
    assert _resolve_ask_timeout(1200) == 1200
    assert _resolve_ask_timeout(99999) == settings.ask_user_max_timeout_seconds


def test_non_integer_is_still_refused():
    assert _resolve_ask_timeout("soon") is None


def test_the_schema_tells_the_model_to_pass_null():
    params = ASK_USER_TOOL["function"]["parameters"]
    assert "timeout_seconds" in params["required"], "strict mode: every property stays required"
    desc = params["properties"]["timeout_seconds"]["description"]
    assert not desc.lower().startswith("optional"), desc
    assert "null" in desc.lower()
    assert str(settings.ask_user_min_timeout_seconds) in desc
