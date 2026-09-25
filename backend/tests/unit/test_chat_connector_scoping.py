"""2026-08-31 — AN EMPTY CONNECTOR SELECTION MEANS NONE, AND IT MEANS IT AT THE BOUNDARY.

⚠ WHAT WENT WRONG. `agent_loop.py` selected the connections a chat turn may use with:

    if getattr(body, "active_connector_ids", None):
        active_conns = [c for c in conns if str(c.id) in allowed_ids and c.is_enabled]
    else:
        active_conns = [c for c in conns if c.is_enabled and (...)]     # <- EVERY ONE

`MessageInput.tsx` sent the field only when at least one chip was lit, `api/threads.ts`
dropped an empty array on the floor, and the composer's initial state is `[]`. So the
composer's OFF state arrived here as ABSENT, and absent meant ALL. **Every message ever
sent from a fresh composer had the full connector set live**, and the operator caught it
the honest way: a conversation about local files searched Google Drive on a connection
they had never switched on.

⚠ IT FAILED OPEN ON A GRANT SURFACE. The posture gate still held — an `ask` tool still
paused for a click — so nothing ran unwatched. But *which services this conversation may
touch at all* is the person's decision, and it was being made for them, in the permissive
direction, by a falsy check on a list.

⚠ AND THE FRONTEND FIX IS NOT THE FIX. Three layers each collapsed empty into absent;
patching the two client ones leaves the boundary trusting a client we do not control.
These cases pin the SERVER: absent and empty both mean none, here.
"""
from __future__ import annotations

import ast
import inspect
from pathlib import Path
from types import SimpleNamespace

AGENT_LOOP = Path(__file__).resolve().parents[2] / "app" / "services" / "agent_loop.py"


def _selection_source() -> str:
    """The source of the block that chooses `active_conns`, isolated by its own names."""
    text = AGENT_LOOP.read_text(encoding="utf-8")
    start = text.index("allowed_ids =")
    end = text.index("if active_conns:", start)
    return text[start:end]


# ══════════════════════════════════════════════════════════════════════════════════════
# The permissive arm is GONE, not merely unreachable
# ══════════════════════════════════════════════════════════════════════════════════════
def test_there_is_no_all_enabled_fallback_left_in_the_selection():
    """⚠ THE DELETED ARM IS THE WHOLE DEFECT. A conditional that can still resolve to
    "every enabled connection" is one refactor away from being reachable again, so this
    asserts the SHAPE: the selection filters by `allowed_ids` and has no else."""
    block = _selection_source()
    assert "allowed_ids" in block
    assert "in allowed_ids" in block, "the selection must filter by the named ids"
    # The exact fallback comprehension that shipped the bug, in any spacing.
    normalised = " ".join(block.split())
    assert "else:" not in normalised, (
        "the selection block regained an else arm — the last one meant 'every enabled "
        "connection', which is how an empty selection became a full one"
    )
    assert "c.discovered_tools or c.capability" not in normalised, (
        "that predicate belonged to the all-enabled fallback and has no other caller here"
    )


def test_the_selection_is_reached_and_not_dead_code():
    """A fence on a block nobody runs guards nothing — the Phase 216 lesson, where the
    whole wiring sat inside an `except` arm and 6929 green tests could not see it."""
    tree = ast.parse(AGENT_LOOP.read_text(encoding="utf-8"))
    assigns = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        and any(getattr(t, "id", None) == "active_conns" for t in node.targets)
    ]
    assert assigns, "`active_conns` is not assigned anywhere in agent_loop.py"
    # It must not sit inside an exception handler — that is exactly how it died before.
    handlers = [n for n in ast.walk(tree) if isinstance(n, ast.ExceptHandler)]
    for handler in handlers:
        for node in ast.walk(handler):
            if node in assigns:
                raise AssertionError(
                    "`active_conns` is assigned inside an `except` arm — the c0a09c728 "
                    "failure, where the connector wiring became unreachable on the "
                    "success path and vacuous on the failure path"
                )


# ══════════════════════════════════════════════════════════════════════════════════════
# The behaviour, driven against the real predicate
# ══════════════════════════════════════════════════════════════════════════════════════
def _conn(cid: str, *, enabled: bool = True, tools: bool = True, status: str = "active"):
    # `status` mirrors ConnectorConnectionResponse, which always carries it (default "active").
    return SimpleNamespace(
        id=cid, is_enabled=enabled,
        discovered_tools=[{"name": "t"}] if tools else [],
        capability=None, name=cid, service_id=cid, status=status,
    )


def _select(body_ids, conns, scoped_keys=None):
    """The shipped selection, evaluated exactly as `agent_loop` evaluates it.

    ⚠ COMPILED FROM THE FILE, NOT RETYPED. A copy of the logic in a test proves the copy
    is correct and nothing else — these are the same lines the loop runs, so an edit
    there is an edit here.

    Phase 267 (D-267-29): a third deciding line, `scoped_keys = …`, reads the run's
    `ctx.scoped_connection_keys` — the Expert's resolver-approved connection keys. `ctx` is
    supplied with that one field; None (every non-Expert run) must behave exactly as before.
    """
    body = SimpleNamespace(active_connector_ids=body_ids)
    ctx = SimpleNamespace(scoped_connection_keys=scoped_keys)
    src = _selection_source()
    # Keep the three statements that decide; drop the logging tail.
    lines = [
        ln for ln in src.splitlines()
        if ln.strip().startswith(("allowed_ids", "scoped_keys", "active_conns"))
    ]
    scope: dict = {"body": body, "ctx": ctx, "conns": conns, "getattr": getattr, "str": str, "set": set}
    exec(compile("\n".join(l.strip() for l in lines), "<selection>", "exec"), scope)
    return scope["active_conns"]


def test_an_ABSENT_field_selects_NOTHING():
    conns = [_conn("a"), _conn("b")]
    assert _select(None, conns) == []


def test_an_EMPTY_LIST_selects_NOTHING():
    """The state the composer starts in, and the one the operator had switched everything
    off into. It must not be a synonym for 'all'."""
    conns = [_conn("a"), _conn("b")]
    assert _select([], conns) == []


def test_a_NAMED_id_selects_exactly_that_one():
    conns = [_conn("a"), _conn("b"), _conn("c")]
    picked = _select(["b"], conns)
    assert [c.id for c in picked] == ["b"]


def test_a_named_but_DISABLED_connection_is_still_refused():
    """Naming a connection does not override `is_enabled` — the org-level switch wins."""
    conns = [_conn("a", enabled=False)]
    assert _select(["a"], conns) == []


def test_an_id_that_is_not_the_caller_s_is_simply_absent():
    """The list is a FILTER over connections already scoped to the caller's org by
    `list_connections`, never a lookup — so an id from elsewhere selects nothing rather
    than reaching for a row."""
    conns = [_conn("a")]
    assert _select(["someone-elses-connection"], conns) == []


def test_uuid_objects_and_strings_both_match():
    """The wire type is `list[UUID]`; the connection id is a string. A comparison that
    missed this would select nothing for every real request — failing closed, but uselessly."""
    from uuid import UUID

    cid = "11111111-1111-1111-1111-111111111111"
    conns = [_conn(cid)]
    assert [c.id for c in _select([UUID(cid)], conns)] == [cid]


# ══════════════════════════════════════════════════════════════════════════════════════
# Phase 267 (D-267-29) — the Expert's approved keys are a SECOND way to be named
# ══════════════════════════════════════════════════════════════════════════════════════
def test_a_scoped_key_admits_its_connection_by_service_id_or_capability():
    conns = [_conn("hubspot"), _conn("notion")]
    conns[1].capability = "send_email"
    assert [c.id for c in _select(None, conns, scoped_keys=("hubspot",))] == ["hubspot"]
    assert [c.id for c in _select(None, conns, scoped_keys=("send_email",))] == ["notion"]


def test_a_scoped_key_does_not_override_is_enabled():
    assert _select(None, [_conn("hubspot", enabled=False)], scoped_keys=("hubspot",)) == []


def test_no_keys_still_means_absent_and_empty_select_nothing():
    """The 2026-08-31 rule survives the widening: no ids and no keys is NONE."""
    conns = [_conn("a"), _conn("b")]
    assert _select(None, conns, scoped_keys=None) == []
    assert _select([], conns, scoped_keys=()) == []


def test_keys_and_named_ids_union():
    conns = [_conn("a"), _conn("hubspot"), _conn("c")]
    assert [c.id for c in _select(["a"], conns, scoped_keys=("hubspot",))] == ["a", "hubspot"]


# 267-REVIEW WR-05 — the resolver approves a KEY when ANY connection of that service is enabled AND
# active; the loop then admitted EVERY enabled connection matching the key, including a revoked or
# errored one, whose tools were advertised to the model and failed at call time (a revoked OAuth
# connection offered again as if it were live). A key admits only ACTIVE connections.
def test_WR05_a_scoped_key_does_not_admit_a_revoked_or_errored_connection():
    conns = [_conn("hubspot"), _conn("hubspot-old", status="revoked"), _conn("hubspot-bad", status="error")]
    for c in conns:
        c.service_id = "hubspot"
    assert [c.id for c in _select(None, conns, scoped_keys=("hubspot",))] == ["hubspot"]
