"""Phase 196 Plan 06 (AUTH-04 / SC#2 / D-09 / D-08 / D-04 / D-10) — the SAVE-PATH refusal.

Driven RED before either the leaf helpers or the two route hooks exist. What these cases
defend, named for the PROPERTY rather than for the patch that satisfies them:

  R1  a NEW unregistered ``config.model`` is refused **400** with an OBJECT detail carrying
      ``code == "unknown_model"``, the offending ``phase_slug`` and the offending ``model``
  R2  that refusal reaches **NO WRITE** — the recording pool's ``.calls`` is empty and the
      db-layer writer was never called
  R3  a BLANK model still saves (D-04 — 239 of 257 stored phases carry none; every one of
      them must round-trip untouched)
  R4  a registered-and-enabled model still saves
  R5  a registered but **DISABLED** model still saves (D-10 — disabled is a RUN-time
      concern with a fallback and a notice, never a save-time refusal; membership, not
      availability)
  R6  PATCH introducing a NEW unregistered value is refused with the SAME shape
  R7  PATCH whose STORED definition already carries that exact value on that same phase
      slug SUCCEEDS — D-08's grandfather
  R8  a PATCH from a NON-OWNER carrying an unregistered model returns the SAME dull 404 it
      returns today — the refusal is never an existence oracle (T-196-ORACLE)
  R9  the known-id set is the ``build_model_registry_rows`` UNION (disabled + DB-only rows
      INCLUDED), not the narrower offerable set (T-196-SEMANTIC)
  R10 a definition with no phases, and a phase with an empty-string model, are no-ops

⚠ ``not-a-real-model`` is the refusal fixture and ``gpt-5.2`` (seeded DISABLED) is the
disabled-still-saves fixture. A file that only ever exercised ``gpt-5.4`` would prove
nothing: it is registry-known AND enabled, so it passes every branch.

NOTHING HERE TOUCHES A DATABASE. ``get_pg_pool`` hands back a recording stand-in, the two
db-layer writers are patched, and the registry union is seeded through the same
``_reset_override_caches`` / settings-stub posture ``test_149_registry_read.py`` uses. The
file therefore runs on a machine with no Postgres, and a grep over it for the two SQL write
verbs against the definitions table must come back EMPTY — this sentence names them
descriptively rather than quoting them, because a fence a comment can trip is a fence that
gets waived the next time it fires (the 196-04 finding, reproduced).
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

import app.models.user_settings as us
from app.api import workflows as wf_api
from app.models.harness import WorkflowDefinition
from app.services import model_registry as mr


# ── fixtures: the pool that records, and the registry that is seeded ──────────


class _RecordingPool:
    """asyncpg-pool stand-in recording EVERY call — the ``test_149_default_guard.py`` shape.

    A refusal must leave ``.calls`` empty. ``fetch``/``fetchrow`` are recorded too (not just
    ``execute``), because "no write reached" is only evidence if the stand-in would have
    noticed one going past.
    """

    def __init__(self):
        self.calls: list[tuple] = []

    async def execute(self, sql, *args):
        self.calls.append(("execute", sql, args))
        return "UPDATE 1"

    async def fetch(self, sql, *args):
        self.calls.append(("fetch", sql, args))
        return []

    async def fetchrow(self, sql, *args):
        self.calls.append(("fetchrow", sql, args))
        return None


def _seed_registry(monkeypatch, override_rows: list[dict] | None = None) -> None:
    """Seed the union ``build_model_registry_rows`` composes, with zero DB access.

    Both collaborators are imported FUNCTION-LOCALLY inside the union builder, so patching
    the ``app.models.user_settings`` module attributes is what the builder actually resolves
    at call time.
    """
    rows = list(override_rows or [])

    async def _fake_settings():
        return {"llm_model": "gpt-5.4", "llm_model_locked": False}

    async def _fake_overrides():
        return {r["model_id"]: r for r in rows}

    monkeypatch.setattr(us, "_load_settings_from_db", _fake_settings)
    monkeypatch.setattr(us, "load_all_model_overrides", _fake_overrides)
    us._settings_cache = None
    us._settings_cache_time = 0.0
    us._model_overrides_cache = {}
    us._model_overrides_cache_time = 0.0
    us._all_model_overrides_cache = {}
    us._all_model_overrides_cache_time = 0.0


#: ``gpt-5.2`` seeded DISABLED (R5) plus a DB-only row absent from the built-in registry
#: (R9). Both must be MEMBERS of the known set.
_OVERRIDES = [
    {"model_id": "gpt-5.2", "provider": "openai", "enabled": False, "deprecated": False},
    {"model_id": "db-only-model", "provider": "openai", "enabled": True, "deprecated": False},
]


def _definition(model: str | None = None, *, slug: str = "answer") -> dict:
    """A one-phase ``llm_single`` draft. ``model=None`` omits the key entirely (the 93 % case)."""
    config: dict = {"phase_type": "llm_single", "prompt": "Answer."}
    if model is not None:
        config["model"] = model
    return {
        "slug": "p196-save-refusal",
        "version": 1,
        "name": "Save Refusal",
        "status": "draft",
        "phases": [
            {"slug": slug, "phase_index": 0, "config": config, "validators": [], "name": "Answer"}
        ],
    }


def _body(model: str | None = None, *, slug: str = "answer") -> WorkflowDefinition:
    return WorkflowDefinition.model_validate(_definition(model, slug=slug))


def _assert_unknown_model_detail(exc: HTTPException, *, model: str, phase_slug: str) -> None:
    """The wire SHAPE, asserted once so both doors cannot drift apart."""
    assert exc.status_code == 400
    detail = exc.detail
    assert isinstance(detail, dict), "the refusal is an OBJECT — the client branches on code"
    assert detail["code"] == "unknown_model"
    assert detail["phase_slug"] == phase_slug
    assert detail["model"] == model
    # A human-actionable line EXISTS and names the model + the remedy; nothing asserts its
    # exact wording (the D-186-09 rule: the code is the contract, the prose is for a log).
    assert isinstance(detail["message"], str)
    assert model in detail["message"]


# ── R9 / R10: the leaf, on its own ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_registered_ids_are_the_union_including_disabled_and_db_only(monkeypatch):
    """T-196-SEMANTIC: MEMBERSHIP, not availability, and the SAME union the picker reads.

    A disabled row and a DB-only row are both KNOWN. If this set were the narrower
    offerable one, the save path would refuse models the engine happily runs.
    """
    _seed_registry(monkeypatch, _OVERRIDES)
    known = await mr.registered_model_ids()

    assert "gpt-5.2" in known, "a DISABLED model is still a registry MEMBER (D-10)"
    assert "db-only-model" in known, "a DB-only override row is a member of the union"
    assert "gpt-5.4" in known
    assert "not-a-real-model" not in known
    # Non-vacuity: the built-in registry is genuinely in there, so a passing assertion
    # above cannot be satisfied by an accidentally-empty set.
    assert len(known) > len(_OVERRIDES)


@pytest.mark.asyncio
async def test_blank_and_empty_and_phaseless_definitions_are_no_ops(monkeypatch):
    """R10 / D-04: absence has no offender. Asserted for absent, empty-string, and no phases."""
    _seed_registry(monkeypatch, _OVERRIDES)

    assert await mr.unregistered_phase_models(_body(None)) == []
    assert await mr.unregistered_phase_models(_body("")) == []
    empty = WorkflowDefinition.model_validate(
        {"slug": "p196-empty", "version": 1, "name": "Empty", "status": "draft", "phases": []}
    )
    assert await mr.unregistered_phase_models(empty) == []
    # And the asserting form raises for none of them.
    await mr.assert_phase_models_registered(_body(None))
    await mr.assert_phase_models_registered(_body(""))
    await mr.assert_phase_models_registered(empty)


# ── R1 / R2 / R3 / R4 / R5: POST /workflows ──────────────────────────────────


@pytest.mark.asyncio
async def test_create_refuses_a_new_unregistered_model_before_any_write(monkeypatch):
    """R1 + R2 (T-196-IV1): the 400 shape AND the empty write log, in one case.

    A status-code-only assertion proves an error was raised, not that the write was
    prevented — which is the whole claim. The recording pool and the un-called db writer
    are the evidence.
    """
    _seed_registry(monkeypatch, _OVERRIDES)
    pool = _RecordingPool()
    writer = AsyncMock(return_value={"id": uuid.uuid4(), "version": 1, "token": "T"})

    with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
        with patch("app.api.workflows.create_workflow_definition", writer):
            with pytest.raises(HTTPException) as exc:
                await wf_api.create_draft(
                    body=_body("not-a-real-model"), current_user={"id": str(uuid.uuid4())}
                )

    _assert_unknown_model_detail(exc.value, model="not-a-real-model", phase_slug="answer")
    assert not writer.await_args_list, "the refusal must fire BEFORE the definition is written"
    assert not pool.calls, "the refusal must 400 BEFORE any statement reaches the pool"


@pytest.mark.asyncio
async def test_create_with_a_blank_model_still_saves(monkeypatch):
    """R3 / D-04: the 93 % case. Zero data change — a blank model round-trips untouched."""
    _seed_registry(monkeypatch, _OVERRIDES)
    new_id = uuid.uuid4()
    writer = AsyncMock(return_value={"id": new_id, "version": 1, "token": "T"})

    with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=_RecordingPool())):
        with patch("app.api.workflows.create_workflow_definition", writer):
            res = await wf_api.create_draft(
                body=_body(None), current_user={"id": str(uuid.uuid4())}
            )

    assert res.id == new_id
    assert writer.await_args_list, "a blank model must reach the writer"


@pytest.mark.asyncio
async def test_create_with_a_registered_enabled_model_still_saves(monkeypatch):
    """R4: the ordinary happy path the picker produces."""
    _seed_registry(monkeypatch, _OVERRIDES)
    writer = AsyncMock(return_value={"id": uuid.uuid4(), "version": 1, "token": "T"})

    with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=_RecordingPool())):
        with patch("app.api.workflows.create_workflow_definition", writer):
            await wf_api.create_draft(
                body=_body("gpt-5.4"), current_user={"id": str(uuid.uuid4())}
            )

    assert writer.await_args_list


@pytest.mark.asyncio
async def test_create_with_a_registered_but_disabled_model_still_saves(monkeypatch):
    """R5 / D-10: saving is about registry MEMBERSHIP, never about availability.

    ``gpt-5.2`` is seeded ``enabled=false``. If this saved-path refused it, then disabling a
    model would retroactively break every workflow naming it — the same brittleness D-08
    forbids for a RETIRED row.
    """
    _seed_registry(monkeypatch, _OVERRIDES)
    writer = AsyncMock(return_value={"id": uuid.uuid4(), "version": 1, "token": "T"})

    with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=_RecordingPool())):
        with patch("app.api.workflows.create_workflow_definition", writer):
            await wf_api.create_draft(
                body=_body("gpt-5.2"), current_user={"id": str(uuid.uuid4())}
            )

    assert writer.await_args_list, "a DISABLED but REGISTERED model must still save"


# ── R6 / R7 / R8: PATCH /workflows/{id} ──────────────────────────────────────


async def _patch(*, body, stored, user_id, owner_id, writer):
    """Drive ``update_draft`` with the owner-scoped read and the db writer both mocked.

    ``stored`` is the raw JSONB definition the owner-scoped read returns (or ``None`` for a
    row the caller cannot see); ``owner_id`` is that row's ``created_by``.
    """
    pool = _RecordingPool()
    row = None if stored is None else {"created_by": owner_id, "definition": stored}
    with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
        with patch("app.api.workflows.get_definition", AsyncMock(return_value=row)):
            with patch("app.api.workflows.update_workflow_definition", writer):
                return await wf_api.update_draft(
                    definition_id=uuid.uuid4(),
                    body=body,
                    current_user={"id": str(user_id)},
                    if_match="T-OLD",
                )


@pytest.mark.asyncio
async def test_patch_refuses_a_newly_introduced_unregistered_model(monkeypatch):
    """R6: the same shape as the create door — one refusal, two doors."""
    _seed_registry(monkeypatch, _OVERRIDES)
    uid = uuid.uuid4()
    writer = AsyncMock(return_value={"ok": True, "id": uuid.uuid4(), "version": 1, "token": "T"})

    with pytest.raises(HTTPException) as exc:
        await _patch(
            body=_body("not-a-real-model"),
            stored=_definition(None),  # the stored row carries NO model — this is NEW
            user_id=uid,
            owner_id=uid,
            writer=writer,
        )

    _assert_unknown_model_detail(exc.value, model="not-a-real-model", phase_slug="answer")
    assert not writer.await_args_list, "the PATCH refusal must fire BEFORE the UPDATE"


@pytest.mark.asyncio
async def test_patch_grandfathers_an_already_stored_unregistered_value(monkeypatch):
    """R7 / D-08: retiring a registry row must never make an existing workflow unsaveable.

    The stored definition already carries ``retired-model`` on the SAME phase slug, so the
    save is not INTRODUCING it and the refusal does not apply. Measured today: zero phases
    are in this state, so this branch is currently dead — it exists so that D-08's promise
    is true the day it stops being dead.
    """
    _seed_registry(monkeypatch, _OVERRIDES)
    uid = uuid.uuid4()
    writer = AsyncMock(return_value={"ok": True, "id": uuid.uuid4(), "version": 1, "token": "T"})

    res = await _patch(
        body=_body("retired-model"),
        stored=_definition("retired-model"),
        user_id=uid,
        owner_id=uid,
        writer=writer,
    )

    assert res.token == "T"
    assert writer.await_args_list, "a grandfathered value must reach the UPDATE"


@pytest.mark.asyncio
async def test_patch_grandfather_is_scoped_to_the_same_phase_slug(monkeypatch):
    """R7's fence: the same value stored on a DIFFERENT phase does not grandfather.

    Without this, one retired model anywhere in a definition would license it everywhere,
    and the "newly-introduced" scoping D-08/D-09 are reconciled by would be vacuous.
    """
    _seed_registry(monkeypatch, _OVERRIDES)
    uid = uuid.uuid4()
    writer = AsyncMock(return_value={"ok": True, "id": uuid.uuid4(), "version": 1, "token": "T"})

    with pytest.raises(HTTPException) as exc:
        await _patch(
            body=_body("retired-model", slug="summarise"),
            stored=_definition("retired-model", slug="answer"),
            user_id=uid,
            owner_id=uid,
            writer=writer,
        )

    _assert_unknown_model_detail(exc.value, model="retired-model", phase_slug="summarise")
    assert not writer.await_args_list


@pytest.mark.asyncio
async def test_a_non_owner_patch_carrying_an_unregistered_model_is_the_same_dull_404(monkeypatch):
    """R8 / T-196-ORACLE: the refusal fires AFTER ownership, so a 400 is never an oracle.

    ``update_draft``'s ``not_found`` is deliberately "the dullest of them" — a coded refusal
    would let a stranger tell "no such workflow" from "someone else's workflow". A 400 that
    fired before ownership resolved would be exactly that oracle, wearing a different
    status code. Asserted DIRECTLY here, never left to a comment in the route.
    """
    _seed_registry(monkeypatch, _OVERRIDES)
    writer = AsyncMock(return_value={"ok": False, "cause": "not_found"})

    with pytest.raises(HTTPException) as exc:
        await _patch(
            body=_body("not-a-real-model"),
            stored=None,  # the owner-scoped read sees nothing — not ours / not there
            user_id=uuid.uuid4(),
            owner_id=uuid.uuid4(),
            writer=writer,
        )

    assert exc.value.status_code == 404, "a non-owner must NOT learn that the model was bad"
    assert exc.value.detail == "draft not found"
    # A plain string: a dict detail is where a machine code would live, i.e. the oracle.
    assert isinstance(exc.value.detail, str)


@pytest.mark.asyncio
async def test_the_ordering_holds_for_a_blank_model_too(monkeypatch):
    """The lazy shape's own fence: a save with NO offender must not read the stored row.

    239 of 257 stored phases carry no model, so the ordinary autosave is this path. If the
    owner-scoped read ran unconditionally, every autosave would pay for a grandfather
    lookup that can never apply.
    """
    _seed_registry(monkeypatch, _OVERRIDES)
    reader = AsyncMock(return_value=None)
    writer = AsyncMock(return_value={"ok": True, "id": uuid.uuid4(), "version": 1, "token": "T"})

    with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=_RecordingPool())):
        with patch("app.api.workflows.get_definition", reader):
            with patch("app.api.workflows.update_workflow_definition", writer):
                await wf_api.update_draft(
                    definition_id=uuid.uuid4(),
                    body=_body(None),
                    current_user={"id": str(uuid.uuid4())},
                    if_match="T-OLD",
                )

    assert not reader.await_args_list, "no offender -> no grandfather read"
    assert writer.await_args_list
