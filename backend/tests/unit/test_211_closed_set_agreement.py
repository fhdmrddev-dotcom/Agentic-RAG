"""Phase 211 (CONN-05) — THE SEVEN SPELLINGS OF ONE CLOSED SET, ENUMERATED IN ONE PLACE.

⚠ **NOTHING IN THIS FILE EDITS A CLOSED-SET SPELLING, AND THAT IS SAID RATHER THAN LEFT TO
SILENCE.** Phase 211 makes the three capability verbs stop ORGANISING the connections
surface — which is a UI property. The verbs are not deleted, not opened, and not made
optional; they were already optional (``| None = None``, Phase 206). In particular
``backend/app/models/harness.py``'s ``capability`` annotation is **not edited by Phase 211,
in any plan**, and this file's job is to make that a measurement instead of an assumption.

── WHY THIS FILE EXISTS WHEN FIVE IMPORT-TIME ASSERTS ALREADY EXIST ──────────────────────
The five module-scope asserts are strictly better than a test at STOPPING the app: they fire
at import, so a disagreement cannot ship. They are strictly worse at TELLING YOU WHAT
HAPPENED: an ``AssertionError`` during collection takes the whole suite down and names one
file. The cases below duplicate them on purpose, so a drift reports as *"this spelling
disagreed"* rather than as *"the app will not start"*.

⭐ **AND THEY CANNOT COVER THE SEVENTH SPELLING AT ALL.** Migration 116's SQL
``CHECK (capability IN (...))`` is held by **nothing executable** — the migration file says
so itself, in as many words: *"SQL cannot import the Python frozenset"*. A Python assert
cannot reach into a ``.sql`` file, so the one place the set is written in another language
has been guarded by a comment since Phase 190. Closing that hole is the only NEW guarantee
this file adds; everything else here is enumeration.

── THE DISCIPLINE THE SQL EXTRACTOR IS HELD TO ───────────────────────────────────────────
Modelled on the cross-language ``?raw`` fence: **the extractor is falsified on synthetic
input BEFORE the real file is read.** A regex that silently matches nothing would pass
forever while proving nothing, which is the single most likely way a cross-language fence
ships dead. Two controls, both required: a synthetic CHECK clause carrying a deliberately
WRONG member must yield that wrong member (so the extractor is reading, not guessing), and a
line of prose that merely mentions ``capability`` must yield no match (so a green is not
noise). The walk's own non-vacuity — the file exists, and the regex matched — is asserted as
two separate assertions with distinct messages.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from pydantic import ValidationError
from typing import get_args

from app.models.connector import (
    CONFIG_MODEL_FOR_CAPABILITY,
    ConnectorCapability,
)
from app.models.harness import ExternalActionPhaseConfig
from app.services.connectors.descriptors import descriptor_for
from app.services.connectors.registry import _ADAPTERS
from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES, KB_TOOLS
from app.services.harness.phase_types import (
    _BODY_ARG_FOR_CAPABILITY,
    _PRE_CREDENTIAL_DESTINATION,
    PHASE_TYPE_REGISTRY_ENTRIES,
    _exec_external_action,
)

# backend/tests/unit/<this file>  ->  parents[2] == backend/, parents[3] == repo root
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BACKEND_ROOT.parent
_MIGRATION_116 = _REPO_ROOT / "supabase" / "migrations" / "116_connector_connections.sql"


#: ⚠ **THE ENUMERATION IS THE POINT.** A RED here should print a list of sites a person can
#: walk, not a boolean. Each entry is ``(site, what holds it)`` — and the last column is
#: where the honesty lives: two of the seven are held by nothing at import time.
_SPELLINGS: tuple[tuple[str, str], ...] = (
    (
        "app/services/harness/grounding.py :: EXTERNAL_ACTION_CAPABILITIES",
        "THE RUNTIME HOME — every other spelling is checked against this one",
    ),
    (
        "app/models/connector.py :: ConnectorCapability (Literal)",
        "module-scope assert vs the frozenset",
    ),
    (
        "app/models/connector.py :: CONFIG_MODEL_FOR_CAPABILITY",
        "module-scope assert vs the frozenset",
    ),
    (
        "app/models/harness.py :: ExternalActionPhaseConfig.capability (Literal | None)",
        "NOT held by an assert — a bare Literal, fenced by test_189_external_action_model.py",
    ),
    (
        "supabase/migrations/116_connector_connections.sql :: CHECK (capability IN (...))",
        "⭐ HELD BY NOTHING EXECUTABLE BEFORE PHASE 211 — SQL cannot import a Python frozenset",
    ),
    (
        "app/services/connectors/registry.py :: _ADAPTERS",
        "module-scope assert vs the frozenset (D-04)",
    ),
    (
        "app/services/harness/phase_types.py :: _PRE_CREDENTIAL_DESTINATION"
        " + _BODY_ARG_FOR_CAPABILITY",
        "one module-scope assert holding BOTH against the frozenset",
    ),
)


def test_the_enumeration_names_all_seven_spellings():
    """A floor on this file's own coverage.

    If an eighth spelling is added and this table is not, the enumeration silently stops
    being an enumeration — which is the failure mode the whole file is written against.
    """
    assert len(_SPELLINGS) == 7, (
        "the closed set was spelled in SEVEN places when Phase 211 measured it. This table "
        f"now names {len(_SPELLINGS)}:\n"
        + "\n".join(f"  - {site}  ({held_by})" for site, held_by in _SPELLINGS)
    )
    assert len({site for site, _ in _SPELLINGS}) == 7, "a site is listed twice"


# ── 1 · ONE CASE PER PYTHON SPELLING ─────────────────────────────────────────────────────
#
# These duplicate the five module-scope asserts DELIBERATELY. An assert fires at import and
# stops the app; a test names WHICH spelling drifted.


def test_the_connector_capability_literal_is_the_closed_set():
    members = set(get_args(ConnectorCapability))
    assert members == set(EXTERNAL_ACTION_CAPABILITIES), (
        "models/connector.py :: ConnectorCapability disagrees with the runtime home "
        f"({sorted(members ^ set(EXTERNAL_ACTION_CAPABILITIES))})"
    )


def test_the_config_model_map_is_keyed_by_the_closed_set():
    assert set(CONFIG_MODEL_FOR_CAPABILITY) == set(EXTERNAL_ACTION_CAPABILITIES), (
        "models/connector.py :: CONFIG_MODEL_FOR_CAPABILITY disagrees with the runtime home "
        f"({sorted(set(CONFIG_MODEL_FOR_CAPABILITY) ^ set(EXTERNAL_ACTION_CAPABILITIES))})"
    )


def test_the_external_action_phase_config_literal_is_the_closed_set():
    """⚠ The spelling with NO import-time assert behind it.

    It read ``Literal[...] | str | None`` for the length of one phase and the ``| str`` made
    the Literal completely inert — any string was accepted, so the closed set existed only as
    documentation. That incident is why this spelling is listed separately from the four
    that an assert holds.
    """
    annotation = ExternalActionPhaseConfig.model_fields["capability"].annotation
    members = {arg for arg in get_args(annotation) if isinstance(arg, str)}
    # The Literal sits inside `X | None`, so unwrap one level when needed.
    if not members:
        for arg in get_args(annotation):
            members |= {inner for inner in get_args(arg) if isinstance(inner, str)}
    assert members == set(EXTERNAL_ACTION_CAPABILITIES), (
        "models/harness.py :: ExternalActionPhaseConfig.capability disagrees with the "
        f"runtime home ({sorted(members ^ set(EXTERNAL_ACTION_CAPABILITIES))}). ⚠ If this "
        "reads as an EMPTY set, the Literal has gone inert again — check for a `| str` arm"
    )
    assert members, (
        "no string members were extracted from the capability annotation at all, so the "
        "assertion above is vacuous — the annotation shape changed"
    )


def test_the_adapter_registry_is_keyed_by_the_closed_set():
    assert set(_ADAPTERS) == set(EXTERNAL_ACTION_CAPABILITIES), (
        "connectors/registry.py :: _ADAPTERS disagrees with the runtime home "
        f"({sorted(set(_ADAPTERS) ^ set(EXTERNAL_ACTION_CAPABILITIES))})"
    )


def test_the_executors_two_capability_maps_are_keyed_by_the_closed_set():
    assert set(_PRE_CREDENTIAL_DESTINATION) == set(EXTERNAL_ACTION_CAPABILITIES), (
        "phase_types.py :: _PRE_CREDENTIAL_DESTINATION disagrees with the runtime home "
        f"({sorted(set(_PRE_CREDENTIAL_DESTINATION) ^ set(EXTERNAL_ACTION_CAPABILITIES))})"
    )
    assert set(_BODY_ARG_FOR_CAPABILITY) == set(EXTERNAL_ACTION_CAPABILITIES), (
        "phase_types.py :: _BODY_ARG_FOR_CAPABILITY disagrees with the runtime home "
        f"({sorted(set(_BODY_ARG_FOR_CAPABILITY) ^ set(EXTERNAL_ACTION_CAPABILITIES))})"
    )


# ── 2 · ⭐ THE SEVENTH SPELLING — SQL, AND THE HOLE THIS FILE EXISTS TO CLOSE ─────────────

#: Matches ``CHECK (capability IN ('a', 'b'))`` and ``capability = ANY (ARRAY['a','b'])``,
#: across newlines, and captures the LIST BODY as ``members``. Named group, so a failure
#: message can quote what it read rather than a group index.
_SQL_CAPABILITY_LIST = re.compile(
    r"capability\s*(?:text\s*(?:NOT\s+NULL\s*)?)?"
    r"(?:CHECK\s*\(\s*capability\s+IN\s*\(|IN\s*\(|=\s*ANY\s*\(\s*ARRAY\s*\[)"
    r"(?P<members>[^)\]]*)",
    re.IGNORECASE | re.DOTALL,
)

#: Pulls each single-quoted literal out of the captured list body.
_SQL_STRING_LITERAL = re.compile(r"'([^']*)'")


def _capabilities_declared_in_sql(sql_text: str) -> set[str] | None:
    """Return the capability members named by the CHECK clause, or ``None`` if none matched.

    ``None`` rather than ``set()`` is load-bearing: an empty set and "the regex did not
    match" are different facts, and conflating them is exactly how a cross-language fence
    ships green while reading nothing.
    """
    match = _SQL_CAPABILITY_LIST.search(sql_text)
    if match is None:
        return None
    return set(_SQL_STRING_LITERAL.findall(match.group("members")))


def test_the_sql_extractor_is_falsified_on_synthetic_input_first():
    """⚠ CONTROL — run before the real file is read anywhere in this module.

    An extractor that silently matched nothing would make the case below pass forever while
    proving nothing about the migration. So it is driven against a clause carrying a
    deliberately WRONG member, and against prose, before it is trusted.
    """
    wrong = _capabilities_declared_in_sql(
        """
        capability text NOT NULL CHECK (capability IN (
            'send_email',
            'wire_transfer'
        )),
        """
    )
    assert wrong == {"send_email", "wire_transfer"}, (
        "the control clause carries a deliberately wrong member and the extractor must "
        f"REPORT it rather than normalise it away; it returned {wrong!r}. An extractor that "
        "cannot see a wrong member cannot see a drifted one either"
    )

    ansi_form = _capabilities_declared_in_sql(
        "capability text NOT NULL CHECK (capability = ANY (ARRAY['post_message']))"
    )
    assert ansi_form == {"post_message"}, (
        f"the `= ANY (ARRAY[...])` spelling of the same constraint was not read: {ansi_form!r}"
    )

    prose = _capabilities_declared_in_sql(
        "-- The CLOSED capability set D-04 pins. SQL cannot import the Python frozenset"
    )
    assert prose is None, (
        f"the extractor matched a line of prose about `capability` and returned {prose!r}; a "
        "fence that fires on English is a fence that gets loosened away"
    )


def test_migration_116s_sql_check_agrees_with_the_python_frozenset():
    """⭐ THE ONE NEW GUARANTEE — the cross-language half of the closed set.

    Migration 116 spells the three verbs in SQL because, in its own words, *"SQL cannot
    import the Python frozenset"*. Until Phase 211 that comment WAS the guard. A fourth verb
    added to the frozenset without the DDL is a row the app will happily construct and the
    database will refuse with a constraint violation at insert time; a verb removed from the
    frozenset but left in the DDL is a value the database still admits and no Python reader
    can resolve.
    """
    assert _MIGRATION_116.exists(), (
        f"{_MIGRATION_116} does not exist — the walk found nothing to check, so a green "
        "here would mean the file moved rather than that the constraint agrees"
    )

    declared = _capabilities_declared_in_sql(
        _MIGRATION_116.read_text(encoding="utf-8", errors="replace")
    )
    assert declared is not None, (
        f"the capability CHECK clause was not found in {_MIGRATION_116.name}. The extractor "
        "is proved non-vacuous by the control above, so this means the DDL's shape changed "
        "— re-derive the matcher rather than deleting this case"
    )
    assert declared == set(EXTERNAL_ACTION_CAPABILITIES), (
        f"{_MIGRATION_116.name}'s CHECK admits {sorted(declared)!r} while "
        f"EXTERNAL_ACTION_CAPABILITIES is {sorted(EXTERNAL_ACTION_CAPABILITIES)!r}. These "
        "are the same closed set written in two languages; a disagreement is either a row "
        "the database will refuse or a value no Python reader can resolve"
    )


# ── 3 · THE INVARIANTS THE SPELLINGS SIT ON ──────────────────────────────────────────────


def test_the_capability_set_is_disjoint_from_kb_tools():
    """The invariant with the quietest failure mode in this whole area.

    Grounding detection is ``available_tools ∩ KB_TOOLS``. A collision would make EVERY
    external-action step report grounding-``detected``, so each would gain a governance seal
    it must not carry — and because ``detected`` is RECOMPUTED on every read and never
    persisted, the change would be both unattributable and un-revertable from the UI. There
    is no representable value that says a detected step is free to think.
    """
    collision = EXTERNAL_ACTION_CAPABILITIES & KB_TOOLS
    assert collision == frozenset(), (
        f"an external-action capability collides with KB_TOOLS ({sorted(collision)})"
    )


def test_the_phase_type_registry_still_has_exactly_seven_executors():
    """D-14's red line: seven executors in, seven out.

    Phase 211 adds no phase type and removes none. The count is read from the registry at
    run time rather than retyped, and the keys are printed on failure so a RED is a work
    item.
    """
    assert PHASE_TYPE_REGISTRY_ENTRIES.get("external_action") is _exec_external_action, (
        "the `external_action` key no longer dispatches to `_exec_external_action`: "
        f"{PHASE_TYPE_REGISTRY_ENTRIES.get('external_action')!r}"
    )
    assert len(PHASE_TYPE_REGISTRY_ENTRIES) == 7, (
        f"the phase-type registry holds {len(PHASE_TYPE_REGISTRY_ENTRIES)} executors, not "
        f"seven: {sorted(PHASE_TYPE_REGISTRY_ENTRIES)!r}"
    )


def test_a_capability_outside_the_closed_set_is_still_refused():
    """Restated here beside the six spellings it protects.

    The authoritative case is ``test_189_external_action_model.py::
    test_a_capability_outside_the_closed_set_is_refused``, which Phase 211 does not touch and
    which is observed green in this plan's summary. This one lives here so the enumeration is
    complete: an assertion about a set is worth little without a demonstration that the set
    is CLOSED at the boundary a client actually reaches.
    """
    with pytest.raises(ValidationError):
        ExternalActionPhaseConfig(
            phase_type="external_action",
            capability="wire_transfer",
            action_risk_armed=True,
        )


# ── 4 · THE NEW SURFACE INTRODUCED NOTHING ───────────────────────────────────────────────


def test_the_static_descriptors_name_exactly_the_closed_set():
    """Phase 211's own addition, held to the same rule as the seven before it.

    A descriptor whose ``name`` were anything but a capability id would be an eighth
    spelling arriving through the front door — and, because ``name`` is the grant key the
    executor reads, an action that could never be granted.
    """
    names = {descriptor_for(capability)["name"] for capability in EXTERNAL_ACTION_CAPABILITIES}
    assert names == set(EXTERNAL_ACTION_CAPABILITIES), (
        f"the static descriptors advertise {sorted(names)!r}, which is not the closed set "
        f"{sorted(EXTERNAL_ACTION_CAPABILITIES)!r}"
    )
