"""Phase 221 (D-221-05 / D-221-06 / D-221-07) — the application axis, on the backend.

Three properties, and each exists because its absence would be INVISIBLE:

  1. The `app` key TRAVELS and the execution fields do NOT. Un-stripping `capability` to
     get the grouping would have worked perfectly and quietly shipped `googleapis.com`
     hosts and HTTP verbs to every picker and grant list.

  2. The application rung sits BETWEEN the two that already exist. A rung inserted in the
     wrong place still resolves a posture — the wrong one — and nothing downstream can tell.

  3. ⚠ AN APPLICATION `allow` NEVER ARMS A WRITE (D-221-06). There is no Google write tool
     yet, so this is driven against a PLANTED spec. That is the point: the rule has to
     exist before the first write does. Retrofitting it onto a shipped `allow` that already
     cascades means silently revoking consent people believe they gave.
"""
from __future__ import annotations

import pytest

from app.services.connector_service import _sanitize_tool_grants
from app.services.connectors.grants import (
    APPLICATION_GRANT_PREFIX,
    application_grant_key,
    resolve_effective_posture,
)
from app.services.connectors.service_tools import (
    SERVICE_TOOL_SPECS,
    extra_descriptors_for_service,
)

#: The six applications and their measured action counts (2026-08-31, live probe).
EXPECTED_COUNTS = {"drive": 2, "gmail": 5, "sheets": 2, "docs": 1, "calendar": 4, "contacts": 1}

#: The keys `extra_descriptors_for_service` exists to strip. Named here rather than
#: recited inline, so widening the strip is one edit in the source and one here.
EXECUTION_FIELDS = {"capability", "http_method", "path", "api_method", "writes"}


def _conn(grants: dict, default: str | None = "ask") -> dict:
    return {"id": "c-1", "tool_grants": grants, "default_approval_posture": default}


# ── 1 · the app key travels; the execution fields do not ──────────────────────────────


def test_every_google_descriptor_carries_an_app():
    descriptors = extra_descriptors_for_service("google")
    assert len(descriptors) == 15
    assert all("app" in d for d in descriptors), [
        d["name"] for d in descriptors if "app" not in d
    ]


def test_the_applications_and_their_counts_are_exactly_the_six():
    counts: dict[str, int] = {}
    for d in extra_descriptors_for_service("google"):
        counts[d["app"]] = counts.get(d["app"], 0) + 1
    assert counts == EXPECTED_COUNTS


def test_no_descriptor_carries_an_execution_field():
    """⚠ Asserted over the EMITTED list, never over the source.

    A source read would be satisfied by this test file's own prose naming the fields —
    the 187-24 trap. Only the real projection can answer this.
    """
    leaked = {k for d in extra_descriptors_for_service("google") for k in d if k in EXECUTION_FIELDS}
    assert leaked == set(), f"execution fields reached the client: {sorted(leaked)}"


def test_a_service_with_no_app_emits_no_app_key():
    """Absent means 'one unnamed application'. It must NOT be `None`."""
    for service_id in ("slack", "jira"):
        for d in extra_descriptors_for_service(service_id):
            assert "app" not in d, f"{service_id}.{d['name']} carries an app key"


def test_every_google_spec_declares_its_app_rather_than_deriving_it():
    """A mis-keyed tool must be visible AT THE SPEC, not inside a mapping nobody reads."""
    for spec in SERVICE_TOOL_SPECS["google"]:
        assert spec.get("app") in EXPECTED_COUNTS, spec["name"]


# ── 2 · the ladder, and its order ─────────────────────────────────────────────────────


def test_application_rung_sits_between_action_and_default():
    conn = _conn({"read_file": "deny", "app:drive": "allow"}, default="ask")
    # the action grant is the most specific thing a person said — it wins
    assert resolve_effective_posture(conn, "read_file", application="drive") == "deny"
    # no action grant -> the application rung, NOT the connection default
    assert resolve_effective_posture(conn, "search_files", application="drive") == "allow"
    # no application grant for gmail -> the connection default
    assert resolve_effective_posture(conn, "search_email", application="gmail") == "ask"


def test_the_two_argument_form_is_byte_for_byte_the_pre_221_behaviour():
    """Every existing caller passes two positional arguments and must not move."""
    conn = _conn({"read_file": "deny", "app:drive": "allow"}, default="ask")
    assert resolve_effective_posture(conn, "read_file") == "deny"
    # ⚠ WITHOUT `application`, the app: key is INERT. A caller that has not been taught
    # about applications must never accidentally inherit one.
    assert resolve_effective_posture(conn, "search_files") == "ask"


@pytest.mark.parametrize(
    "conn,expected",
    [
        (None, "deny"),
        (_conn({}, default=None), "ask"),
        (_conn({"app:drive": "nonsense"}), "deny"),
        (_conn({"search_files": "nonsense"}), "deny"),
        (_conn({}, default="nonsense"), "deny"),
    ],
)
def test_every_arm_still_fails_closed(conn, expected):
    assert resolve_effective_posture(conn, "search_files", application="drive") == expected


def test_a_tool_name_can_never_collide_with_an_application_key():
    """The `app:` namespace is safe because a tool name cannot contain a colon."""
    for specs in SERVICE_TOOL_SPECS.values():
        for spec in specs:
            assert ":" not in spec["name"], spec["name"]
    assert application_grant_key("drive") == "app:drive"


# ── 3 · D-221-06 · the asymmetry, driven against a PLANTED write ──────────────────────


def test_application_allow_does_not_reach_a_write():
    """⚠ THE SAFETY PROPERTY OF THIS PHASE.

    `create_file` does not exist yet — it is step 2 of the operator's order. The rule is
    built and tested now precisely because it cannot be added later without revoking
    consent people already believe they gave.
    """
    conn = _conn({"app:drive": "allow"}, default="ask")
    assert resolve_effective_posture(conn, "search_files", application="drive", is_write=False) == "allow"
    assert resolve_effective_posture(conn, "create_file", application="drive", is_write=True) == "ask"


def test_only_an_explicit_action_grant_can_allow_a_write():
    conn = _conn({"app:drive": "allow", "create_file": "allow"}, default="ask")
    assert resolve_effective_posture(conn, "create_file", application="drive", is_write=True) == "allow"


def test_the_cap_only_ever_tightens():
    """An application `deny` still denies a write — the asymmetry is not symmetric."""
    conn = _conn({"app:drive": "deny"}, default="allow")
    assert resolve_effective_posture(conn, "create_file", application="drive", is_write=True) == "deny"
    conn_ask = _conn({"app:drive": "ask"}, default="allow")
    assert resolve_effective_posture(conn_ask, "create_file", application="drive", is_write=True) == "ask"


def test_the_write_cap_does_not_touch_the_connection_default():
    """⚠ The cap lives on the APPLICATION rung only.

    A connection-level default of `allow` is a separate decision with its own surface, and
    narrowing it here would be a silent behaviour change to every pre-221 connection.
    """
    conn = _conn({}, default="allow")
    assert resolve_effective_posture(conn, "create_file", application="drive", is_write=True) == "allow"


# ── 4 · the sanitizer's key shape ─────────────────────────────────────────────────────


def test_an_application_key_survives_the_sanitizer():
    """This is why D-221-05 needs no migration: the key already passed through."""
    assert _sanitize_tool_grants({"read_file": "allow", "app:drive": "ask"}) == {
        "read_file": "allow",
        "app:drive": "ask",
    }


def test_an_unknown_namespace_is_refused_rather_than_stored():
    with pytest.raises(ValueError, match="unknown namespace"):
        _sanitize_tool_grants({"foo:bar": "allow"})


def test_an_empty_application_key_is_refused():
    with pytest.raises(ValueError, match="names no application"):
        _sanitize_tool_grants({APPLICATION_GRANT_PREFIX: "allow"})


def test_the_value_refusal_is_unchanged():
    """Phase 213's refuse-never-coerce stance must survive the key check being added."""
    with pytest.raises(ValueError, match="not one of"):
        _sanitize_tool_grants({"delete_repository": True})


# ── 5 · the cache heals at READ time (operator-reported, 2026-08-31) ──────────────────
#
# ⚠ *"I see Google Drive Google Contacts Google Gmail when I refresh actions but once I
# navigate away it is all gone and I have to refresh action again."*
#
# `discovered_tools` is a CACHE, and every Google row written before this phase holds
# fifteen descriptors with no `app`. The client groups on `app`, so a stale cache degrades
# to a single unnamed application — correct behaviour (D-221-09) reading as a disappearance.


def _stale(tools: list[dict]) -> list[dict]:
    """The pre-221 shape: byte-identical minus the key that did not exist yet."""
    return [{k: v for k, v in t.items() if k != "app"} for t in tools]


def test_a_cache_written_before_the_key_existed_still_groups():
    from app.services.connectors.service_tools import backfill_application_keys

    stale = _stale(extra_descriptors_for_service("google"))
    assert not any("app" in t for t in stale), "the fixture must actually be stale"

    healed = backfill_application_keys("google", stale)
    counts: dict[str, int] = {}
    for t in healed:
        counts[t["app"]] = counts.get(t["app"], 0) + 1
    assert counts == EXPECTED_COUNTS


def test_the_backfill_adds_and_never_overwrites():
    """A descriptor that already names an application is returned untouched."""
    from app.services.connectors.service_tools import backfill_application_keys

    already = [{"name": "search_files", "app": "somewhere_else"}]
    assert backfill_application_keys("google", already) == already


def test_a_name_the_spec_table_does_not_know_is_left_alone():
    """No guessing. An unknown tool keeps exactly the shape it arrived with."""
    from app.services.connectors.service_tools import backfill_application_keys

    out = backfill_application_keys("google", [{"name": "not_a_real_tool"}])
    assert out == [{"name": "not_a_real_tool"}]


def test_a_service_with_no_applications_is_untouched():
    from app.services.connectors.service_tools import backfill_application_keys

    tools = [{"name": "post_message"}, {"name": "read_channel"}]
    assert backfill_application_keys("slack", tools) == tools
    assert backfill_application_keys(None, tools) == tools
    assert backfill_application_keys("google", []) == []
    assert backfill_application_keys("google", None) == []


def test_the_response_projection_heals_a_stale_row():
    """⭐ END TO END: the row is stale, the API answer is not.

    This is the assertion that would have caught the operator's report. It runs through
    `_to_response` — the ONE place a row becomes output — rather than through the helper,
    because a helper nobody calls heals nothing.
    """
    from app.services.connector_service import _to_response

    row = {
        "id": "c-1",
        "org_id": "o-1",
        "service_id": "google",
        "name": "Google Workspace",
        "auth_type": "oauth_byo",
        "status": "active",
        "is_enabled": True,
        "discovered_tools": _stale(extra_descriptors_for_service("google")),
    }
    resp = _to_response(row)
    counts: dict[str, int] = {}
    for t in resp.discovered_tools:
        counts[t["app"]] = counts.get(t["app"], 0) + 1
    assert counts == EXPECTED_COUNTS
