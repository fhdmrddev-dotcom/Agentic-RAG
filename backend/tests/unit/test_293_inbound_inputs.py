"""Phase 293-01 (START-02; D-11, D-13; assumption A4) — the declared launch fields, server side.

``declared_fields`` is the Python twin of the browser's ``soulData.launchInputFields``. Both are
pinned by ONE fixture (``tests/fixtures/phase293/launch_fields_cases.json``), which 293-04's
frontend test also reads, so the two rules cannot drift apart silently.

``validate_inbound_inputs`` is the server-side enforcement the browser used to be the only home
of (287-01): unknown keys, missing required values, file fields, non-string values, oversize
bodies. And the fence: a caller can never set a reserved run key or an ``_``-prefixed one (the
schedule path's ``_schedule_*`` keys arm a run's budget) — those are refused as unknown, never
silently dropped and never accepted.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.models.message import RESERVED_RUN_INPUT_KEYS
from app.services import inbound_inputs as ii

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "phase293" / "launch_fields_cases.json"
CASES = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_declared_fields_match_the_shared_fixture(case):
    fields = ii.declared_fields(case["definition"])
    assert [f.key for f in fields] == case["expected_keys"]
    assert [f.required for f in fields] == case["expected_required"]
    assert ii.needs_file_upload(fields) is bool(case.get("needs_file_upload", False))


def test_the_fixture_has_at_least_six_cases():
    assert len(CASES) >= 6


def test_a_label_falls_back_to_the_key():
    fields = ii.declared_fields({"input_keys": ["account"]})
    assert fields[0].label == "account"
    fields = ii.declared_fields({"inputs": [{"key": "a", "label": "  Account  ", "type": "text"}]})
    assert fields[0].label == "Account"


def test_the_caps_are_assumption_a4():
    assert ii.MAX_VALUE_CHARS == 8000
    assert ii.MAX_FIELDS == 50


DEF = {
    "inputs": [
        {"key": "customer", "label": "Customer", "type": "text"},
        {"key": "notes", "label": "Notes", "type": "text", "required": False},
    ]
}


def test_valid_inputs_return_only_declared_string_values():
    assert ii.validate_inbound_inputs(DEF, {"customer": "Acme", "notes": "x"}) == {
        "customer": "Acme",
        "notes": "x",
    }
    assert ii.validate_inbound_inputs(DEF, {"customer": "Acme"}) == {"customer": "Acme"}


def test_an_unknown_key_is_refused_naming_it():
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(DEF, {"customer": "Acme", "colour": "red"})
    assert exc.value.code == "unknown_input"
    assert exc.value.names == ["colour"]
    assert exc.value.detail == (
        "Unknown input field(s): colour. This workflow accepts: customer, notes."
    )


def test_an_unknown_key_on_a_no_input_workflow_says_no_inputs():
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs({}, {"x": "1"})
    assert exc.value.detail == "Unknown input field(s): x. This workflow accepts: no inputs."


@pytest.mark.parametrize("value", [None, "", "   "])
def test_a_missing_or_blank_required_value_is_refused(value):
    inputs = {} if value is None else {"customer": value}
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(DEF, inputs)
    assert exc.value.code == "missing_input"
    assert exc.value.names == ["customer"]
    assert exc.value.detail == "Missing required input(s): customer."


def test_a_blank_optional_value_is_allowed():
    assert ii.validate_inbound_inputs(DEF, {"customer": "Acme", "notes": " "}) == {
        "customer": "Acme",
        "notes": " ",
    }


def test_a_file_field_refuses_the_whole_call():
    d = {"inputs": [{"key": "contract", "label": "Contract", "type": "file"}]}
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(d, {"contract": "base64..."})
    assert exc.value.code == "file_upload"
    assert exc.value.detail == (
        "This workflow needs a file upload, which a key can't send yet. Start it in the app."
    )


@pytest.mark.parametrize("value", [3, 1.5, True, ["a"], {"a": "b"}])
def test_a_non_string_value_is_an_invalid_body(value):
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(DEF, {"customer": value})
    assert exc.value.code == "invalid_body"


def test_a_value_over_8000_chars_is_an_invalid_body():
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(DEF, {"customer": "a" * 8001})
    assert exc.value.code == "invalid_body"
    ii.validate_inbound_inputs(DEF, {"customer": "a" * 8000})


def test_more_than_50_keys_is_an_invalid_body():
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(DEF, {f"k{i}": "v" for i in range(51)})
    assert exc.value.code == "invalid_body"


def test_a_non_object_body_is_an_invalid_body():
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(DEF, ["customer"])  # type: ignore[arg-type]
    assert exc.value.code == "invalid_body"


@pytest.mark.parametrize(
    "key", sorted(RESERVED_RUN_INPUT_KEYS) + ["_schedule_id", "_schedule_max_tokens", "_anything"]
)
def test_reserved_and_underscore_keys_are_refused_as_unknown(key):
    """A caller can never set the folder, the kickoff prompt or a run cap through a key."""
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(DEF, {"customer": "Acme", key: "x"})
    assert exc.value.code == "unknown_input"
    assert key in exc.value.names


def test_a_definition_that_declares_an_underscore_key_still_refuses_it():
    d = {"inputs": [{"key": "_budget", "label": "Budget", "type": "text"}]}
    with pytest.raises(ii.InboundInputRefused) as exc:
        ii.validate_inbound_inputs(d, {"_budget": "9999"})
    assert exc.value.code == "unknown_input"
