"""Phase 211 (CONN-04 / D-211-05 / D-211-06) — the static descriptors, and the one property
that keeps them from becoming a fourth spelling of anything.

**What is asserted here is DERIVATION, not agreement.** A test that compared a descriptor's
``required`` array against a literal list retyped in this file would pass forever while the
adapter it claims to describe drifted underneath it — that is the *"eighth spelling with
nothing holding it in agreement"* RESEARCH §I rules out by name. So every schema assertion
below reads the adapter's own ``INPUT_SCHEMA`` at run time and compares against THAT.

⚠ **THIS FILE IS THE ONLY PLACE PERMITTED TO IMPORT THE ADAPTER MODULES EAGERLY.** The
production module resolves them through ``registry.get_adapter`` inside a function body, so
that no vendor module enters the import graph of anything that merely asks which
capabilities exist (``test_190_connector_source_fence.py::
test_no_vendor_module_enters_the_import_graph_until_a_send_happens``). A test process has
already paid that cost by the time it runs, and reading the class attribute directly is what
makes the comparison independent rather than circular.

⚠ **THE PARAMETRISATION IS DERIVED AND ITS SIZE IS ASSERTED**, in the shape
``test_the_walk_is_not_vacuous`` uses: a hand-typed list of three capability names would
silently skip a fourth the day one is registered, and a skipped case is a green that means
nothing.
"""

from __future__ import annotations

import json
from types import MappingProxyType
from typing import Any

import pytest

from app.services.connectors.descriptors import (
    descriptor_for,
    static_descriptors_for_capability,
)
from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

# ── the closed set, DERIVED at runtime — never a hand-typed parameter list ────────────────
_CAPABILITIES: list[str] = sorted(EXTERNAL_ACTION_CAPABILITIES)

#: The four keys ``descriptor_for`` emits. This IS a literal, deliberately: it is the shape
#: contract with the sanitizer (D-211-05), and a derived version would compare the module
#: against itself.
_DESCRIPTOR_KEYS = {"name", "title", "description", "inputSchema"}

#: Every key the sanitizer emits or MAY emit after D-211-09 widens it. A descriptor key
#: outside this set would be a key no discovered tool can carry, which is the one way a
#: static descriptor stops being indistinguishable from a discovered one.
_SANITIZER_EMITTABLE_KEYS = {
    "name",
    "title",
    "description",
    "inputSchema",
    "outputSchema",
    "annotations",
}

#: capability -> the adapter module that declares it. The VALUES duplicate
#: ``registry._ADAPTERS`` on purpose: an independent statement of the same mapping is what
#: lets this file catch a mis-wired registry instead of inheriting its answer.
_ADAPTER_MODULE_FOR_CAPABILITY = {
    "send_email": "app.services.connectors.smtp_adapter",
    "create_ticket": "app.services.connectors.jira_adapter",
    "post_message": "app.services.connectors.slack_adapter",
}


def _adapter_input_schema(capability: str) -> Any:
    """Import the adapter module EAGERLY and return its class-level ``INPUT_SCHEMA``.

    Deliberately not routed through ``registry.get_adapter`` — that is the very function the
    module under test uses, and a comparison that went through it would be measuring the
    module against its own input rather than against the adapter's declaration.
    """
    import importlib

    module = importlib.import_module(_ADAPTER_MODULE_FOR_CAPABILITY[capability])
    return module.Adapter.INPUT_SCHEMA


def _plain(value: Any) -> Any:
    """Deep-convert ``MappingProxyType`` to ``dict`` so the expectation is comparable."""
    if isinstance(value, (MappingProxyType, dict)):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    return value


# ── 0 · NON-VACUITY — the parametrisation covers the whole closed set ─────────────────────


def test_the_parametrisation_covers_the_whole_closed_set():
    """The cases below are derived from ``EXTERNAL_ACTION_CAPABILITIES``, not typed out.

    Two floors, for the reason ``test_the_walk_is_not_vacuous`` records: a count alone would
    be satisfied by three names that were not these three, and a name list alone would not
    notice the set growing to four while this file's helper map stayed at three.
    """
    assert len(_CAPABILITIES) == 3, (
        f"the closed capability set has {len(_CAPABILITIES)} members ({_CAPABILITIES!r}); "
        "it had three at Phase 211. A fourth is not a failure — it means this file's "
        "adapter-module map below owes it an entry, and a silently-skipped capability is a "
        "descriptor nobody ever checked"
    )
    assert set(_ADAPTER_MODULE_FOR_CAPABILITY) == set(EXTERNAL_ACTION_CAPABILITIES), (
        "this file's capability -> adapter-module map disagrees with the closed set "
        f"({sorted(set(_ADAPTER_MODULE_FOR_CAPABILITY) ^ set(EXTERNAL_ACTION_CAPABILITIES))})"
    )


# ── 1 · THE SHAPE ────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("capability", _CAPABILITIES)
def test_the_descriptor_carries_exactly_the_four_keys(capability: str):
    descriptor = descriptor_for(capability)
    assert set(descriptor) == _DESCRIPTOR_KEYS, (
        f"{capability}: the descriptor's key set is {sorted(descriptor)!r}, expected "
        f"{sorted(_DESCRIPTOR_KEYS)!r}. A fifth key is a key no discovered tool carries, "
        "and D-211-05 is the claim that the two shapes are indistinguishable"
    )


@pytest.mark.parametrize("capability", _CAPABILITIES)
def test_the_name_is_the_capability_and_the_prose_is_real(capability: str):
    """``name`` is the GRANT KEY and the executor's tool name — it must equal the capability.

    ``title`` and ``description`` are hand-authored, so the only thing worth asserting about
    them mechanically is that somebody actually wrote one: an empty string here would render
    as a blank row in Phase 212's catalog.
    """
    descriptor = descriptor_for(capability)
    assert descriptor["name"] == capability, (
        f"the descriptor's name is {descriptor['name']!r} but the capability is "
        f"{capability!r}. The name is the grant key `phase_types` reads; a descriptor whose "
        "name is not the capability advertises an action that can never be granted"
    )
    for key in ("title", "description"):
        value = descriptor[key]
        assert isinstance(value, str), f"{capability}: {key} is {type(value).__name__}"
        assert value.strip() == value, f"{capability}: {key} carries surrounding whitespace"
        assert value.strip(), (
            f"{capability}: {key} is empty. `title` is Phase 212's catalog label and "
            "`description` is what an author reads before granting an outbound action"
        )


# ── 2 · ⭐ THE DERIVED AGREEMENT — the whole point of this file ───────────────────────────


@pytest.mark.parametrize("capability", _CAPABILITIES)
def test_the_input_schema_is_the_adapters_own_declaration(capability: str):
    """``inputSchema`` IS ``Adapter.INPUT_SCHEMA``, JSON-ified — not a parallel copy.

    D-211-06 asks for each adapter's REQUIRED arguments to be declared as data. It is
    satisfied by DERIVATION rather than by a synchronised constant, so there is nothing to
    keep in sync and no eighth spelling to hold in agreement.
    """
    descriptor = descriptor_for(capability)
    expected = json.loads(json.dumps(_plain(_adapter_input_schema(capability))))
    assert descriptor["inputSchema"] == expected, (
        f"{capability}: the descriptor's inputSchema is not this adapter's own "
        "INPUT_SCHEMA. It must be derived from the adapter, never retyped — a descriptor "
        "that advertises an argument the adapter refuses, or hides one it requires, is a "
        "lie told at the moment an author is deciding whether to grant an outbound action."
        f"\n  descriptor: {descriptor['inputSchema']!r}\n  adapter:    {expected!r}"
    )


@pytest.mark.parametrize(
    "capability,expected_required",
    [
        ("send_email", ["to", "subject", "body"]),
        ("create_ticket", ["summary", "description"]),
        ("post_message", ["text"]),
    ],
)
def test_the_required_array_is_the_adapters_own(capability: str, expected_required: list[str]):
    """The same property again, spelled so a RED reads as a sentence rather than a diff.

    ⚠ The literal in the parameters is a READABILITY aid and is checked against the adapter
    in the same breath — so if the adapter changes, BOTH sides of this case move together
    and the case still cannot pass by agreeing with a stale copy of itself.
    """
    adapter_required = list(_adapter_input_schema(capability)["required"])
    assert adapter_required == expected_required, (
        f"{capability}: the adapter now requires {adapter_required!r}, not "
        f"{expected_required!r} — update this case's literal, which exists so the assertion "
        "below reads as a sentence"
    )
    assert descriptor_for(capability)["inputSchema"]["required"] == adapter_required, (
        f"{capability}: the descriptor's required arguments are not the adapter's"
    )


# ── 3 · BYTE-COMPATIBILITY — SC#1's "indistinguishable" ──────────────────────────────────


@pytest.mark.parametrize("capability", _CAPABILITIES)
def test_the_descriptor_survives_a_json_round_trip_unchanged(capability: str):
    """⚠ A leaked ``MappingProxyType`` raises HERE and nowhere else until a jsonb write.

    ``MappingProxyType`` is not JSON-serialisable. The descriptor is written into a jsonb
    column in plan 211-02, so the conversion is load-bearing rather than cosmetic — and the
    earliest honest place to prove it is at the point the value is produced (T-211-06).
    """
    descriptor = descriptor_for(capability)
    encoded = json.dumps(descriptor)  # raises TypeError on a MappingProxyType
    assert json.loads(encoded) == descriptor, (
        f"{capability}: the descriptor does not survive a JSON round trip unchanged"
    )
    assert "mappingproxy" not in encoded.lower()


@pytest.mark.parametrize("capability", _CAPABILITIES)
def test_every_descriptor_key_is_a_key_the_sanitizer_may_emit(capability: str):
    """D-211-05: a static descriptor must be indistinguishable from a sanitized discovered
    tool. That is only true if it carries no key the sanitizer could never produce."""
    stray = set(descriptor_for(capability)) - _SANITIZER_EMITTABLE_KEYS
    assert stray == set(), (
        f"{capability}: the descriptor carries {sorted(stray)!r}, which the MCP tool "
        "sanitizer neither emits nor may emit. Every downstream reader of "
        "`discovered_tools` was written against the sanitizer's shape"
    )


# ── 4 · THE LIST FORM ────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("capability", _CAPABILITIES)
def test_the_list_form_is_one_element_and_is_the_descriptor(capability: str):
    """``discovered_tools`` is a LIST and every downstream reader iterates it — SEED-207's
    *"present a native connection as a connection with exactly ONE available tool"*."""
    descriptors = static_descriptors_for_capability(capability)
    assert isinstance(descriptors, list), (
        f"{capability}: static_descriptors_for_capability returned "
        f"{type(descriptors).__name__}, but `discovered_tools` is a JSON array"
    )
    assert len(descriptors) == 1, (
        f"{capability}: expected exactly one advertised action, got {len(descriptors)}"
    )
    assert descriptors[0] == descriptor_for(capability)
    assert json.loads(json.dumps(descriptors)) == descriptors


# ── 5 · THE NEGATIVE CONTROL — an outside name resolves to NOTHING ───────────────────────


@pytest.mark.parametrize(
    "outside_name", ["wire_transfer", "send_email ", "SEND_EMAIL", "", "search_documents"]
)
def test_a_capability_outside_the_closed_set_raises_rather_than_stubbing(outside_name: str):
    """The lookup is CLOSED and fails at a named site — never a stub, never a default.

    ``registry.get_adapter`` raises ``KeyError`` for an unregistered capability and this
    module copies that shaped raise, so a reader who has met one has met both. A returned
    stub would put an action nobody implemented into a picker.
    """
    with pytest.raises(KeyError):
        descriptor_for(outside_name)
    with pytest.raises(KeyError):
        static_descriptors_for_capability(outside_name)
