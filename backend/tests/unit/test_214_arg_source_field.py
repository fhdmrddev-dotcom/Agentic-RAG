"""Phase 214 Wave 1 — the STORED per-argument source (`ExternalActionPhaseConfig.arg_sources`).

D-214-01: a step's per-argument source is a stored, VALIDATED enum with three arms, not an
inferred one. This suite drives:

1. round-trip through the strict config, and `extra='forbid'` still refusing an unknown key
   on BOTH models;
2. the two refusal validators, driven RED against a planted URL-shaped `ask_key` and against
   a both-arms-set spec (T-214-01-01 and T-214-01-05 in the plan's threat register);
3. D-214-12 — a legacy config with `tool_args` set and NO `arg_sources` still validates;
4. the two spellings of the three-arm closed set agreeing MECHANICALLY.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.harness import (
    ArgumentSourceSpec,
    ExternalActionPhaseConfig,
    _ARGUMENT_KEY_PATTERN,
)


def _config(**overrides):
    base = {
        "phase_type": "external_action",
        "capability": "send_email",
        "connection_id": "11111111-1111-1111-1111-111111111111",
    }
    base.update(overrides)
    return ExternalActionPhaseConfig(**base)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Round trip
# ═══════════════════════════════════════════════════════════════════════════════

def test_the_three_arms_round_trip_through_the_strict_config():
    cfg = _config(
        tool_args={"to": "ops@example.com"},
        arg_sources={
            "to": {"source": "fixed"},
            "subject": {"source": "ask", "ask_key": "subject_line"},
            "body": {"source": "upstream", "upstream_slug": "draft"},
        },
    )
    assert set(cfg.arg_sources) == {"to", "subject", "body"}
    assert cfg.arg_sources["to"].source == "fixed"
    assert cfg.arg_sources["subject"].ask_key == "subject_line"
    assert cfg.arg_sources["body"].upstream_slug == "draft"

    dumped = cfg.model_dump(mode="json")
    assert dumped["arg_sources"]["body"] == {
        "source": "upstream", "ask_key": None, "upstream_slug": "draft",
    }
    assert ExternalActionPhaseConfig(**dumped).arg_sources["body"].upstream_slug == "draft"


def test_an_unknown_key_is_refused_on_both_models():
    """`extra='forbid'` (D-07) is unchanged by this addition, on the parent AND the new leaf."""
    with pytest.raises(ValidationError):
        _config(arg_sourcez={"to": {"source": "fixed"}})
    with pytest.raises(ValidationError):
        ArgumentSourceSpec(source="fixed", ask_ky="typo")
    with pytest.raises(ValidationError):
        _config(arg_sources={"to": {"source": "fixed", "default": "silently ignored"}})


def test_a_fourth_arm_is_refused_at_parse_time():
    with pytest.raises(ValidationError):
        _config(arg_sources={"to": {"source": "prior_run"}})
    with pytest.raises(ValidationError):
        ArgumentSourceSpec(source="literal")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. T-214-01-01 — a key is a NAME, never a destination. Driven RED.
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("planted", [
    "https://evil.example/x",
    "http://evil.example",
    "//evil.example/x",
    "evil.example:8080",
    "user@evil.example",
    "a key with spaces",
    "with\ttab",
    "with\nnewline",
    "-leading-dash",
    ".leading-dot",
    "",
    "x" * 65,
    "path/segment",
    "back\\slash",
])
def test_a_url_shaped_or_otherwise_non_name_ask_key_is_refused(planted):
    """The pattern structurally excludes a URL, so this field cannot become a second
    destination the `_pre_credential_destination` egress guard does not read."""
    with pytest.raises(ValidationError) as exc:
        _config(arg_sources={"to": {"source": "ask", "ask_key": planted}})
    assert "ask_key" in str(exc.value)

    with pytest.raises(ValidationError):
        _config(arg_sources={"to": {"source": "upstream", "upstream_slug": planted}})


@pytest.mark.parametrize("legal", [
    "subject_line", "topic", "draft", "phase.2", "a-b-c", "X9", "_private", "x" * 64,
])
def test_a_plain_name_is_accepted(legal):
    """A positive control: the fence refuses destinations, not the names authors actually use."""
    assert _ARGUMENT_KEY_PATTERN.match(legal)
    assert _config(arg_sources={"to": {"source": "ask", "ask_key": legal}}).arg_sources["to"].ask_key == legal


def test_the_refusal_message_names_the_field_and_the_offending_key():
    with pytest.raises(ValidationError) as exc:
        _config(arg_sources={"to": {"source": "ask", "ask_key": "https://evil.example/x"}})
    message = str(exc.value)
    assert "ask_key" in message
    assert "evil.example" in message


# ═══════════════════════════════════════════════════════════════════════════════
# 3. T-214-01-05 — two mutually exclusive arms are never storable at once. Driven RED.
# ═══════════════════════════════════════════════════════════════════════════════

def test_ask_with_an_upstream_slug_is_refused():
    with pytest.raises(ValidationError) as exc:
        _config(arg_sources={"to": {"source": "ask", "ask_key": "k", "upstream_slug": "s"}})
    assert "upstream_slug" in str(exc.value)


def test_upstream_with_an_ask_key_is_refused():
    with pytest.raises(ValidationError) as exc:
        _config(arg_sources={"to": {"source": "upstream", "upstream_slug": "s", "ask_key": "k"}})
    assert "ask_key" in str(exc.value)


def test_fixed_may_carry_neither_and_that_is_the_common_case():
    spec = ArgumentSourceSpec(source="fixed")
    assert spec.ask_key is None and spec.upstream_slug is None


def test_ask_with_no_key_defaults_to_the_property_name_at_resolution_not_at_parse():
    """The model stores the ABSENCE; the resolver reads `spec.ask_key or <property name>`.
    A parse-time default would need the property name, which the model does not have."""
    spec = ArgumentSourceSpec(source="ask")
    assert spec.ask_key is None


# ═══════════════════════════════════════════════════════════════════════════════
# 4. D-214-12 — nothing retroactive
# ═══════════════════════════════════════════════════════════════════════════════

def test_a_legacy_config_with_tool_args_and_no_arg_sources_still_validates():
    """Every definition published before this phase keeps parsing, and reads as the EMPTY map
    — which is the branch `resolve_arguments` handles as the pre-cut projection."""
    cfg = _config(tool_args={"to": "ops@example.com", "subject": "Renewal"})
    assert cfg.arg_sources == {}
    assert cfg.tool_args == {"to": "ops@example.com", "subject": "Renewal"}


def test_an_mcp_shaped_legacy_config_still_validates():
    cfg = ExternalActionPhaseConfig(
        phase_type="external_action",
        tool_name="create_page",
        tool_args={"title": "Q3"},
        connection_id="22222222-2222-2222-2222-222222222222",
    )
    assert cfg.arg_sources == {}
    assert cfg.available_tools == ["create_page"]


def test_the_available_tools_derivation_is_untouched_by_the_new_field():
    """D-03's one-fact-one-derivation still holds with `arg_sources` present."""
    cfg = _config(
        available_tools=["search_documents"],
        arg_sources={"to": {"source": "fixed"}},
    )
    assert cfg.available_tools == ["send_email"]


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Two spellings of one closed set — agreed MECHANICALLY, never by memory
# ═══════════════════════════════════════════════════════════════════════════════

def test_the_models_three_arms_equal_the_services_three_arms():
    """`models/harness.py` must not import a service (its own stated rule), so the arms are
    spelled twice. The agreement is asserted rather than remembered — the same mechanism the
    `capability` Literal / `EXTERNAL_ACTION_CAPABILITIES` pair already uses."""
    from typing import get_args

    from app.models.harness import ArgumentSourceKind as ModelKind
    from app.services.connectors.args import ArgumentSourceKind as ServiceKind

    assert set(get_args(ModelKind)) == set(get_args(ServiceKind))

    from app.services.connectors.args import _LEGAL_SOURCE_KINDS
    assert set(get_args(ModelKind)) == set(_LEGAL_SOURCE_KINDS)


def test_the_stored_spec_is_readable_by_the_resolver_it_was_built_for():
    """The seam that mocks neither side: a REAL parsed config through the REAL resolver."""
    from app.services.connectors.args import resolve_arguments, schema_for_bound_tool

    cfg = _config(
        tool_args={"to": "ops@example.com"},
        arg_sources={
            "to": {"source": "fixed"},
            "subject": {"source": "ask", "ask_key": "subject_line"},
            "body": {"source": "upstream", "upstream_slug": "draft"},
        },
    )
    schema = schema_for_bound_tool(capability="send_email", tool_name=None, discovered_tools=None)
    out = resolve_arguments(
        config=cfg,
        schema=schema,
        upstream_outputs={"draft": "the drafted text"},
        run_inputs={"subject_line": "Renewal"},
    )
    assert out == {
        "to": "ops@example.com",
        "subject": "Renewal",
        "body": "the drafted text",
    }
