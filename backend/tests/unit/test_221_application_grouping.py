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

#: The six applications and their READ counts (2026-08-31, live probe).
READ_COUNTS = {"drive": 2, "gmail": 5, "sheets": 2, "docs": 1, "calendar": 4, "contacts": 1}

#: ⚠ TOTALS AFTER STEP 2 (2026-09-01). Kept as a separate constant from `READ_COUNTS`
#: rather than edited over it: several assertions below are about the READ surface
#: specifically — the backfill heals a cache written when only reads existed — and a single
#: constant serving both questions would have silently changed what those tests assert.
EXPECTED_COUNTS = {"drive": 4, "gmail": 6, "sheets": 4, "docs": 3, "calendar": 6, "contacts": 3}

#: The keys `extra_descriptors_for_service` exists to strip. Named here rather than
#: recited inline, so widening the strip is one edit in the source and one here.
EXECUTION_FIELDS = {"capability", "http_method", "path", "api_method", "writes"}


def _conn(grants: dict, default: str | None = "ask") -> dict:
    return {"id": "c-1", "tool_grants": grants, "default_approval_posture": default}


# ── 1 · the app key travels; the execution fields do not ──────────────────────────────


def test_every_google_descriptor_carries_an_app():
    descriptors = extra_descriptors_for_service("google")
    assert len(descriptors) == 26  # 15 reads + 11 writes
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


# ── 6 · THE CAP IS REACHABLE — the half that was missing ──────────────────────────────
#
# ⚠ D-221-06 shipped TESTED AND UNREACHABLE. Every enforcement site called
# `resolve_effective_posture(connection, tool_name)` with two positional arguments, so
# `application` was None, the middle rung never ran, and an application `allow` would have
# armed a write for real. Section 3 above proved the RULE; nothing proved it was CALLED.
#
# A guard nobody has seen fire is not a guard — and a guard nothing invokes is not even that.


def test_tool_facet_resolves_the_pair_both_gates_need():
    from app.services.connectors.service_tools import tool_facet

    assert tool_facet("google", "search_files") == ("drive", False)
    assert tool_facet("google", "read_email") == ("gmail", False)


def test_tool_facet_fails_closed_on_anything_it_does_not_know():
    """⚠ Unknown ⇒ (no application, IS a write).

    `application=None` makes the rung a no-op rather than letting an unrelated `app:` grant
    answer for a tool nobody declared. `is_write=True` is the MCP spec's own instruction and
    the only safe default for a cap whose whole job is to withhold `allow`.
    """
    from app.services.connectors.service_tools import tool_facet

    for args in [("google", "not_a_tool"), ("nosuchservice", "x"), (None, None), ("", "")]:
        assert tool_facet(*args) == (None, True), args


def test_tool_facet_cannot_read_the_cache_because_it_is_never_handed_one():
    """`discovered_tools` is a CACHE — a stale copy must never decide a permission.

    ⚠ ASSERTED ON THE SIGNATURE, NOT ON THE SOURCE TEXT. The first cut of this test grepped
    the function body for the word and went RED against its own docstring — the 187-24 trap,
    where a source-reading criterion counts its own prose. The signature is the real
    property and no comment can satisfy it: a function handed only a service id and a tool
    name has no cache to consult.
    """
    import inspect

    from app.services.connectors.service_tools import tool_facet

    params = list(inspect.signature(tool_facet).parameters)
    assert params == ["service_id", "tool_name"], params


@pytest.mark.parametrize(
    "module_path,symbol",
    [
        ("app.services.tool_dispatcher", "tool_facet"),
        ("app.services.harness.phase_types", "tool_facet"),
        ("app.services.workflow_authoring", "tool_facet"),
    ],
)
def test_every_enforcement_gate_resolves_the_application(module_path, symbol):
    """⚠ THE REACHABILITY ASSERTION, and it is deliberately a SOURCE read.

    A runtime assertion would need each gate's whole context (a live connection, a phase, an
    org); this asserts the property that was actually missing — that the site resolves the
    pair at all — and it goes RED the moment somebody reverts a call to the two-argument
    form, which is exactly how the cap became unreachable the first time.
    """
    import importlib
    import inspect

    module = importlib.import_module(module_path)
    src = inspect.getsource(module)
    assert symbol in src, f"{module_path} never resolves the application/direction pair"
    # ...and it must actually PASS them, not merely import them.
    assert "application=" in src and "is_write=" in src, module_path


# ══════════════════════════════════════════════════════════════════════════════════════
# 7 · WRITES (Phase 221 step 2, operator 2026-09-01)
#
# ⚠ Section 3 proved D-221-06 against a PLANTED write because no real one existed. Eleven
# now do, so the same rule is re-proved against the SHIPPED specs — a rule that holds for a
# fixture and not for production is not a rule.
# ══════════════════════════════════════════════════════════════════════════════════════

WRITE_COUNTS = {"drive": 2, "gmail": 1, "sheets": 2, "docs": 2, "calendar": 2, "contacts": 2}


def _google(name: str) -> dict:
    for spec in SERVICE_TOOL_SPECS["google"]:
        if spec["name"] == name:
            return spec
    raise AssertionError(f"no google spec named {name!r}")


def test_the_eleven_writes_exist_with_their_applications():
    writes = [s for s in SERVICE_TOOL_SPECS["google"] if s["writes"]]
    counts: dict[str, int] = {}
    for s in writes:
        counts[s["app"]] = counts.get(s["app"], 0) + 1
    assert counts == WRITE_COUNTS
    assert len(SERVICE_TOOL_SPECS["google"]) == 26  # 15 reads + 11 writes


def test_every_write_declares_its_own_write_egress_key():
    """⚠ A read tool must be structurally unable to name a write key, and vice versa."""
    for spec in SERVICE_TOOL_SPECS["google"]:
        key = spec["capability"]
        assert key.endswith("_write" if spec["writes"] else "_read"), (spec["name"], key)
        assert key.startswith(spec["app"]), (spec["name"], key)


def test_the_write_keys_are_registered_in_all_three_egress_tables():
    """A key the egress guard does not know refuses at send time, not at import."""
    from app.security.egress import ALLOWED_HOST_SUFFIXES, _HOST_MATCH, _TLS_SCHEMES

    for spec in SERVICE_TOOL_SPECS["google"]:
        if not spec["writes"]:
            continue
        key = spec["capability"]
        assert key in ALLOWED_HOST_SUFFIXES, key
        assert key in _HOST_MATCH, key
        assert _TLS_SCHEMES[key] == frozenset({"https"}), key


def test_every_write_resolves_to_a_real_callable():
    """Phase 190's lesson: three module paths were registered when one adapter existed."""
    import importlib

    from app.services.connectors.service_tools import _GOOGLE_READ_CALLS

    for spec in SERVICE_TOOL_SPECS["google"]:
        if not spec["writes"]:
            continue
        module_path, func_name = _GOOGLE_READ_CALLS[spec["capability"]][spec["name"]]
        module = importlib.import_module(module_path)
        assert callable(getattr(module, func_name, None)), spec["name"]


@pytest.mark.parametrize("tool", sorted(s["name"] for s in SERVICE_TOOL_SPECS["google"] if s["writes"]))
def test_no_shipped_write_is_armed_by_an_application_allow(tool):
    """⭐ D-221-06 AGAINST THE REAL SPECS, every one of them.

    Section 3 used a planted `create_file` because nothing real existed. This parametrises
    over what actually ships, so a twelfth write added without thought is covered the day
    it lands rather than the day somebody remembers to extend a fixture.
    """
    from app.services.connectors.service_tools import tool_facet

    spec = _google(tool)
    application, is_write = tool_facet("google", tool)
    assert is_write is True, tool
    assert application == spec["app"]

    conn = _conn({application_grant_key(application): "allow"}, default="ask")
    posture = resolve_effective_posture(conn, tool, application=application, is_write=is_write)
    assert posture == "ask", f"{tool} was armed by an application-level allow"

    # ...and an explicit per-action grant still works, so the cap withholds rather than blocks.
    conn_explicit = _conn(
        {application_grant_key(application): "allow", tool: "allow"}, default="ask"
    )
    assert (
        resolve_effective_posture(
            conn_explicit, tool, application=application, is_write=is_write
        )
        == "allow"
    )


def test_reads_in_the_same_application_are_unaffected():
    """The cap is about DIRECTION, not about the application. Drive reads still inherit."""
    conn = _conn({"app:drive": "allow"}, default="ask")
    assert resolve_effective_posture(conn, "search_files", application="drive", is_write=False) == "allow"
    assert resolve_effective_posture(conn, "create_file", application="drive", is_write=True) == "ask"


# ── the two absences the operator chose, asserted rather than trusted ─────────────────


def test_nothing_sends_mail_and_nothing_deletes():
    """⛔ The operator chose drafts-only and creates-and-updates-only.

    ⚠ Asserted over the SPEC NAMES, which is the surface an audit greps and the surface a
    model is handed. A scope wide enough to delete is not the same as an action that does.
    """
    names = {s["name"] for s in SERVICE_TOOL_SPECS["google"]}
    forbidden = {
        "send_email", "send_message", "send_mail",
        "delete_event", "delete_file", "trash_file", "delete_contact", "clear_values",
    }
    assert names & forbidden == set(), sorted(names & forbidden)
    assert "draft_email" in names


def test_the_send_scope_is_absent_and_drive_is_narrow():
    from app.services.oauth_service import OAUTH_PROVIDERS

    scopes = set(OAUTH_PROVIDERS["google"]["default_scopes"])
    assert "https://www.googleapis.com/auth/gmail.send" not in scopes
    assert "https://www.googleapis.com/auth/gmail.compose" in scopes
    # ⚠ `drive.file` (app-created only), never the full `drive` scope.
    assert "https://www.googleapis.com/auth/drive.file" in scopes
    assert "https://www.googleapis.com/auth/drive" not in scopes


def test_create_event_cannot_invite_anybody():
    """⚠ Adding an attendee makes Google email a person who never used this product.

    That is a different consent conversation, and an action worded "create an event" must
    not smuggle it in. The absence is asserted on the SCHEMA the model is handed.
    """
    props = set(_google("create_event")["inputSchema"]["properties"])
    assert "attendees" not in props and "guests" not in props


def test_a_write_cannot_be_sent_under_a_read_capability():
    """`write_json` refuses a `*_read` key outright — a wiring error, named at the seam."""
    import asyncio

    from app.services.google._http import GoogleReadError, write_json

    async def go():
        await write_json(
            "drive_read", "c-1", "POST", "https://www.googleapis.com/drive/v3/files",
            {}, what="create_file",
        )

    with pytest.raises(GoogleReadError, match="read-only capability"):
        asyncio.run(go())


# ── 8 · the two write defects, and the assertions that would have caught them ─────────


def test_create_file_actually_sends_the_bytes():
    """⭐ THE TEST THAT WAS MISSING. `create_file` shipped writing NOTHING.

    The media call went through `write_json`, which sends a JSON document, while Drive's
    upload endpoint wants the file's bytes AS the body. Both calls returned 2xx, every test
    was green, and the only observable was the file itself.

    ⚠ SO THIS ASSERTS THE BYTES, NOT THE CALL COUNT. A test that counted requests — the
    obvious one to write — would have passed against the broken version.
    """
    import asyncio

    from app.services.google import writes

    sent: dict[str, object] = {}

    async def fake_write_json(cap, conn, method, url, payload=None, params=None, **kw):
        return {"id": "file-1", "name": "notes.txt", "mimeType": "text/plain"}

    async def fake_upload_media(cap, conn, method, url, body, content_type, params=None, **kw):
        sent["body"] = body
        sent["content_type"] = content_type
        sent["capability"] = cap
        return {}

    original_write, original_upload = writes.write_json, writes.upload_media
    writes.write_json, writes.upload_media = fake_write_json, fake_upload_media
    try:
        result = asyncio.run(
            writes.create_file("c-1", name="notes.txt", content="hello world")
        )
    finally:
        writes.write_json, writes.upload_media = original_write, original_upload

    assert sent["body"] == b"hello world", sent
    assert sent["capability"] == "drive_write"
    assert result["bytes_written"] == 11


def test_create_file_with_no_content_says_so_rather_than_implying_content():
    import asyncio

    from app.services.google import writes

    uploaded = []

    async def fake_write_json(cap, conn, method, url, payload=None, params=None, **kw):
        return {"id": "file-1", "name": "empty.txt"}

    async def fake_upload_media(*a, **kw):
        uploaded.append(a)
        return {}

    original_write, original_upload = writes.write_json, writes.upload_media
    writes.write_json, writes.upload_media = fake_write_json, fake_upload_media
    try:
        result = asyncio.run(writes.create_file("c-1", name="empty.txt"))
    finally:
        writes.write_json, writes.upload_media = original_write, original_upload

    assert uploaded == []
    assert result["bytes_written"] == 0
    assert "EMPTY" in result["note"]


def test_the_drive_write_is_named_rename_not_update():
    """⚠ A model picks a tool by NAME. `update_file` read as 'replace the contents'.

    The function only ever changed the file's name, so a model asked to update a document
    would have chosen it, received a 200, and changed the title while the content sat
    untouched — a silent wrong answer with a success shape.
    """
    names = {s["name"] for s in SERVICE_TOOL_SPECS["google"]}
    assert "rename_file" in names
    assert "update_file" not in names

    from app.services.connectors.service_tools import _GOOGLE_READ_CALLS, spec_for

    assert "rename_file" in _GOOGLE_READ_CALLS["drive_write"]
    assert "update_file" not in _GOOGLE_READ_CALLS["drive_write"]
    assert spec_for("google", "rename_file")["title"].lower().startswith("rename")


def test_an_upload_cannot_go_out_under_a_read_capability():
    import asyncio

    from app.services.google._http import GoogleReadError, upload_media

    with pytest.raises(GoogleReadError, match="read-only capability"):
        asyncio.run(
            upload_media(
                "drive_read", "c-1", "PATCH", "https://example.invalid",
                b"x", "text/plain", what="create_file",
            )
        )


def test_the_transport_refuses_a_request_carrying_two_bodies():
    """`json` and `content` together: httpx would let one win silently."""
    import asyncio

    from app.security.egress import send_pinned_http

    with pytest.raises(ValueError, match="both 'json' and 'content'"):
        asyncio.run(
            send_pinned_http(
                "drive_write", "POST", "https://www.googleapis.com/x",
                json={"a": 1}, content=b"bytes", timeout=1.0, max_bytes=1024,
            )
        )


# ── 9 · answering a DEAD run (operator-reported, 2026-09-01) ──────────────────────────


def test_the_terminal_status_set_matches_the_live_table():
    """⚠ Read from `select distinct status from runs`, not transcribed from memory."""
    from app.api.runs import _TERMINAL_RUN_STATUSES, _TERMINAL_RUN_WORDS

    assert _TERMINAL_RUN_STATUSES == {"completed", "failed", "cancelled", "timed_out"}
    # Every terminal status must have a human word — "timed_out" is not a sentence.
    for status_name in _TERMINAL_RUN_STATUSES:
        assert _TERMINAL_RUN_WORDS.get(status_name), status_name
        assert "_" not in _TERMINAL_RUN_WORDS[status_name], status_name


def test_an_unknown_status_is_treated_as_ALIVE():
    """⚠ The asymmetry is deliberate and is the safe direction.

    Refusing a live answer loses work a person did; accepting a dead one only writes a
    message nobody reads. So anything not provably terminal is answerable.
    """
    from app.api.runs import _TERMINAL_RUN_STATUSES

    for alive in ("running", "paused", "queued", "", "streaming"):
        assert alive not in _TERMINAL_RUN_STATUSES
