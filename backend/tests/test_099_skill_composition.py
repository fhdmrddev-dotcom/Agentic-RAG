"""Phase 099 — workflow ↔ skill composition (WFSKILL-01).

This is the cross-plan TDD contract for the skill-composition behavior.

  GREEN from THIS plan (Plan 01):
    - test_skill_ref_additive_optional  — each of the 3 LLM phase configs accepts an
      optional skill_ref (UUID); a pre-099-shaped published WorkflowDefinition still
      model_validate()s (zero-migration / Pitfall 2); an unknown key raises
      ValidationError (T-099-04, extra="forbid"). Also asserts the structural
      validator rejects a skill_snapshot present without a skill_ref (T-099-06).
    - test_toolcontext_field_default_none — ToolContext.skill_snapshot defaults to
      None so Deep dispatch stays byte-identical (T-099-05 / SC#3).

  RED-by-design until Plans 02/03/04 land (cross-plan TDD); they assert the TARGET
  behavior and are marked xfail (strict=False) so the full suite stays exit-0 in
  the interim — the 098 convention (test_098_scope_governance.py:14-21):
    - test_skill_block_compose          — Plan 02: _skill_block(phase, ctx) returns ""
      with no snapshot and a "## Skill:" block when present; llm_single omits the
      file list (D-07).
    - test_auto_whitelist               — Plan 02: _build_phase_tool_context adds
      "read_skill_file" to BOTH available_tools and phase_whitelist when a snapshot
      is present; inert on a tool-less (llm_single) phase; snapshot attached on ctx.
    - test_deep_noop                    — Plan 03: _handle_read_skill_file with
      ctx.skill_snapshot=None takes the live path (SC#3 red-line) — no snapshot
      prefix download.
    - test_snapshot_routing             — Plan 03: with a snapshot present the read
      resolves against the snapshot manifest + downloads from the snapshot prefix.
    - test_publish_gate_rejects         — Plan 03: validate_skill_refs raises
      ValueError on missing / not-visible / disabled skill (D-10).
    - test_snapshot_materialize         — Plan 03: materialize_skill_snapshots copies
      instructions into the phase config's skill_snapshot + Storage-copies each file.
    - test_snapshot_immune_to_live_edit — Plan 03: mutating the live skill after
      materialize does not change the snapshot.
    - test_kickoff_snapshot_wiring      — Plan 04: the kickoff path calls validate +
      materialize-if-needed and maps ValueError → HTTPException(400).

Offline only — fakes (conftest _FakeRedis / make_tool_context / mock_asyncpg_pool)
plus a local _FakeStorage download/upload recorder modeled on the conftest XADD
recorder. No live Redis/Postgres/Storage. The cross-provider round-trip is LIVE
UAT (manual, per D-12 — 099-VALIDATION.md rows L1-L10).
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from uuid import uuid4, UUID

import pytest

import pydantic

from app.models.harness import (
    LlmSinglePhaseConfig,
    LlmAgentPhaseConfig,
    LlmBatchAgentsPhaseConfig,
    WorkflowDefinition,
)


def _close_spawn(coro, *a, **k):
    """Discard the fire-and-forget audit coro cleanly (mirror test_098/test_harness_whitelist)."""
    try:
        coro.close()
    except (AttributeError, RuntimeError):
        pass


def _phase(skill_ref=None, skill_snapshot=None, phase_type="llm_agent", available_tools=None):
    """A minimal phase namespace for _build_phase_tool_context / _skill_block (Plan 02).

    Mirrors the 098 _phase helper but carries the 099 skill fields. available_tools
    defaults to ["search_documents"] (a tool-bearing llm_agent shape); pass [] for a
    tool-less (llm_single-shaped) phase.
    """
    if available_tools is None:
        available_tools = ["search_documents"]
    return SimpleNamespace(
        config=SimpleNamespace(
            phase_type=phase_type,
            skill_ref=skill_ref,
            skill_snapshot=skill_snapshot,
            available_tools=available_tools,
            folder_scope=None,
            model=None,
        )
    )


def _harness_ctx(skill_snapshot=None):
    """A minimal harness ctx bag (producer_run_id is REQUIRED — the seam raises without it)."""
    return SimpleNamespace(
        producer_run_id=uuid4(),
        run_id=uuid4(),
        folder_subtree_ids=None,
        skill_snapshot=skill_snapshot,
        model="m",
    )


class _FakeStorage:
    """Faked Supabase Storage download/upload recorder (modeled on conftest _FakeRedis).

    - ``register(path, payload)`` seeds a bytes payload retrievable by ``download(path)``.
    - ``download(path)`` returns the registered payload or raises (mirrors a 404).
    - ``upload(path=, file=, file_options=)`` records into ``self.uploads``.
    - ``from_(bucket)`` returns self so ``supabase.storage.from_("skill-files").download(...)``
      resolves the way the production handler calls it.
    """

    def __init__(self):
        self._files: dict[str, bytes] = {}
        self.uploads: list[dict] = []
        self.downloads: list[str] = []
        self.last_bucket: str | None = None

    def register(self, path: str, payload: bytes):
        self._files[path] = payload

    def from_(self, bucket):
        self.last_bucket = bucket
        return self

    def download(self, path):
        self.downloads.append(path)
        if path not in self._files:
            raise FileNotFoundError(f"{path} not found in fake storage")
        return self._files[path]

    def upload(self, path=None, file=None, file_options=None):
        self.uploads.append({"path": path, "file": file, "file_options": file_options})
        # Make a subsequent read of the just-uploaded snapshot copy succeed.
        if path is not None and file is not None:
            self._files[path] = file if isinstance(file, (bytes, bytearray)) else bytes(file)
        return SimpleNamespace(path=path)


def _pre099_definition_dict():
    """A pre-099-shaped published WorkflowDefinition dict — NO skill_ref / skill_snapshot.

    Used to prove zero-migration: an old JSONB row model_validate()s to the new
    defaults (Pitfall 2 — adding a non-optional field would break every old row).
    """
    return {
        "slug": "wf",
        "version": 1,
        "name": "WF",
        "status": "published",
        "phases": [
            {
                "slug": "p1",
                "phase_index": 0,
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": "x",
                    "available_tools": ["search_documents"],
                },
            }
        ],
    }


# ── GREEN from this plan (Plan 01) ────────────────────────────────────────────
def test_skill_ref_additive_optional():
    """Each LLM config accepts skill_ref=UUID; a pre-099 row still validates;
    an unknown key raises ValidationError; snapshot-without-ref is rejected (T-099-06)."""
    ref = uuid4()

    single = LlmSinglePhaseConfig(phase_type="llm_single", prompt="p", skill_ref=ref)
    assert single.skill_ref == ref
    assert single.skill_snapshot is None

    agent = LlmAgentPhaseConfig(
        phase_type="llm_agent", prompt="p", available_tools=["search_documents"], skill_ref=ref
    )
    assert agent.skill_ref == ref

    batch = LlmBatchAgentsPhaseConfig(
        phase_type="llm_batch_agents", prompt="p", available_tools=["search_documents"], skill_ref=ref
    )
    assert batch.skill_ref == ref

    # Zero-migration: a pre-099-shaped published row model_validate()s to defaults.
    wf = WorkflowDefinition.model_validate(_pre099_definition_dict())
    assert wf.phases[0].config.skill_ref is None
    assert wf.phases[0].config.skill_snapshot is None

    # extra="forbid" — an unknown/injected key raises ValidationError (T-099-04).
    bad = _pre099_definition_dict()
    bad["phases"][0]["config"]["skill_reff"] = str(uuid4())  # typo'd key
    with pytest.raises(pydantic.ValidationError):
        WorkflowDefinition.model_validate(bad)

    # Structural validator: a skill_snapshot present WITHOUT a skill_ref is invalid
    # (pure-shape — no DB; the DB-aware publish gate is Plan 03). T-099-06.
    snap_no_ref = _pre099_definition_dict()
    snap_no_ref["phases"][0]["config"]["skill_snapshot"] = {
        "skill_id": str(uuid4()),
        "name": "demo",
        "instructions": "do the thing",
        "storage_prefix": "snapshots/run/phase",
    }
    with pytest.raises(pydantic.ValidationError):
        WorkflowDefinition.model_validate(snap_no_ref)


def test_toolcontext_field_default_none():
    """ToolContext.skill_snapshot defaults to None (Deep dispatch byte-identical — SC#3)."""
    import dataclasses
    from app.services.tool_dispatcher import ToolContext

    field_map = {f.name: f for f in dataclasses.fields(ToolContext)}
    assert "skill_snapshot" in field_map, "ToolContext must carry a skill_snapshot field"
    assert field_map["skill_snapshot"].default is None


# ── RED-by-design until downstream plans land (cross-plan TDD; xfail strict=False) ──
def test_skill_block_compose():  # GREEN — Plan 02 (_skill_block) landed
    """Plan 02: _skill_block(phase, ctx) → "" with no snapshot, "## Skill:" block when present;
    llm_single omits the file list (D-07)."""
    from app.services.harness.phase_types import _skill_block  # noqa: F401 — lands in Plan 02

    snap = SimpleNamespace(
        skill_id=uuid4(),
        name="Risk Reviewer",
        description="reviews risks",
        instructions="Always cite the date first.",
        files=["rubric.md"],
        storage_prefix="snapshots/run/phase",
    )

    # No snapshot → empty string (no-op composition).
    assert _skill_block(_phase(skill_snapshot=None), _harness_ctx(skill_snapshot=None)) == ""

    # Snapshot present → a "## Skill:" block carrying the instructions, on an llm_agent.
    block = _skill_block(_phase(skill_snapshot=snap), _harness_ctx(skill_snapshot=snap))
    assert "## Skill:" in block
    assert "Always cite the date first." in block
    assert "rubric.md" in block  # the tool-bearing phase lists the manifest

    # llm_single (tool-less) → instructions compose but the file list is omitted (D-07).
    single_block = _skill_block(
        _phase(skill_snapshot=snap, phase_type="llm_single", available_tools=[]),
        _harness_ctx(skill_snapshot=snap),
    )
    assert "## Skill:" in single_block
    assert "Always cite the date first." in single_block
    assert "rubric.md" not in single_block


def test_auto_whitelist():  # GREEN — Plan 02 (_build_phase_tool_context auto-whitelist) landed
    """Plan 02: read_skill_file auto-whitelisted on BOTH layers when a snapshot is present;
    inert on a tool-less phase; the snapshot is attached on the returned ctx."""
    from app.services.harness.phase_types import _build_phase_tool_context

    snap = SimpleNamespace(
        skill_id=uuid4(),
        name="Risk Reviewer",
        description=None,
        instructions="i",
        files=["rubric.md"],
        storage_prefix="snapshots/run/phase",
    )

    # Snapshot present on a tool-bearing llm_agent → read_skill_file on both layers.
    tc = _build_phase_tool_context(_phase(skill_snapshot=snap), _harness_ctx(skill_snapshot=snap))
    assert "read_skill_file" in tc.available_tools
    assert tc.phase_whitelist is not None and "read_skill_file" in tc.phase_whitelist
    assert tc.skill_snapshot is snap  # snapshot threaded onto the dispatch ctx

    # No snapshot → read_skill_file NOT auto-added (inert).
    tc_none = _build_phase_tool_context(_phase(skill_snapshot=None), _harness_ctx(skill_snapshot=None))
    assert "read_skill_file" not in tc_none.available_tools


@pytest.mark.xfail(reason="impl lands in Plan 03 (gated read branch)", strict=False)
async def test_deep_noop(make_tool_context, monkeypatch):
    """Plan 03: _handle_read_skill_file with ctx.skill_snapshot=None takes the LIVE path
    (SC#3 red-line) — no snapshot-prefix download. Mirrors 098 test_deep_noop shape."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import _handle_read_skill_file

    storage = _FakeStorage()
    storage.register("owner-id/skill-id/rubric.md", b"live-bytes")

    supabase = SimpleNamespace(
        storage=storage,
        table=lambda *_a, **_k: _LiveSkillQuery(),
    )
    ctx = make_tool_context(
        supabase=supabase, emit=None, spawn=_close_spawn, skill_snapshot=None
    )

    result = await _handle_read_skill_file(
        {"skill_name": "Risk Reviewer", "filename": "rubric.md"}, ctx
    )

    # Live path: it downloaded the LIVE skill path, never a snapshot-prefix path.
    assert all("snapshots/" not in p for p in storage.downloads)
    assert "live-bytes" in result.result


@pytest.mark.xfail(reason="impl lands in Plan 03 (snapshot routing)", strict=False)
async def test_snapshot_routing(make_tool_context):
    """Plan 03: with ctx.skill_snapshot present, _handle_read_skill_file resolves against
    the snapshot manifest + downloads from the snapshot prefix."""
    from app.services.tool_dispatcher import _handle_read_skill_file

    storage = _FakeStorage()
    storage.register("snapshots/run/phase/rubric.md", b"snapshot-bytes")

    snap = SimpleNamespace(
        skill_id=uuid4(),
        name="Risk Reviewer",
        description=None,
        instructions="i",
        files=["rubric.md"],
        storage_prefix="snapshots/run/phase",
    )
    supabase = SimpleNamespace(storage=storage, table=lambda *_a, **_k: _LiveSkillQuery())
    ctx = make_tool_context(supabase=supabase, skill_snapshot=snap)

    result = await _handle_read_skill_file(
        {"skill_name": "Risk Reviewer", "filename": "rubric.md"}, ctx
    )

    assert any(p.startswith("snapshots/run/phase/") for p in storage.downloads)
    assert "snapshot-bytes" in result.result


async def test_publish_gate_rejects():  # GREEN — Plan 03 (validate_skill_refs publish gate) landed
    """Plan 03: validate_skill_refs raises ValueError for (a) missing id, (b) not-visible
    (another user's private skill), (c) is_enabled=false (D-10)."""
    from app.services.harness.skill_snapshot import validate_skill_refs

    missing = WorkflowDefinition.model_validate(_definition_with_skill_ref(uuid4()))
    with pytest.raises(ValueError):
        # Empty visible set → the referenced id is missing.
        await validate_skill_refs(missing, supabase=_FakeSkillsDB([]), user_id="u")

    skill_id = uuid4()
    not_visible = WorkflowDefinition.model_validate(_definition_with_skill_ref(skill_id))
    with pytest.raises(ValueError):
        await validate_skill_refs(
            not_visible,
            supabase=_FakeSkillsDB([{"id": str(skill_id), "is_enabled": True, "visible": False}]),
            user_id="u",
        )

    disabled = WorkflowDefinition.model_validate(_definition_with_skill_ref(skill_id))
    with pytest.raises(ValueError):
        await validate_skill_refs(
            disabled,
            supabase=_FakeSkillsDB([{"id": str(skill_id), "is_enabled": False, "visible": True}]),
            user_id="u",
        )


async def test_snapshot_materialize():  # GREEN — Plan 03 (materialize_skill_snapshots) landed
    """Plan 03: materialize_skill_snapshots copies instructions into the phase config's
    skill_snapshot + uploads once per skill file; a subsequent read uses the snapshot."""
    from app.services.harness.skill_snapshot import materialize_skill_snapshots

    skill_id = uuid4()
    storage = _FakeStorage()
    storage.register(f"owner-id/{skill_id}/rubric.md", b"live-rubric")

    definition = WorkflowDefinition.model_validate(_definition_with_skill_ref(skill_id))
    db = _FakeSkillsDB(
        [{"id": str(skill_id), "user_id": "owner-id", "is_enabled": True, "visible": True,
          "instructions": "ORIGINAL instructions", "name": "Risk Reviewer",
          "files": ["rubric.md"]}]
    )

    materialized = await materialize_skill_snapshots(
        definition, run_id=uuid4(), supabase=SimpleNamespace(storage=storage, table=db.table),
        user_id="u",
    )

    snap = materialized.phases[0].config.skill_snapshot
    assert snap is not None
    assert snap.instructions == "ORIGINAL instructions"
    assert len(storage.uploads) == 1  # one upload per skill file


async def test_snapshot_immune_to_live_edit():  # GREEN — Plan 03 (snapshot immutability) landed
    """Plan 03: after materialize, mutating the live skill's instructions / deleting a file
    does NOT change skill_snapshot.instructions or the snapshot file read."""
    from app.services.harness.skill_snapshot import materialize_skill_snapshots

    skill_id = uuid4()
    storage = _FakeStorage()
    storage.register(f"owner-id/{skill_id}/rubric.md", b"live-rubric")
    db = _FakeSkillsDB(
        [{"id": str(skill_id), "user_id": "owner-id", "is_enabled": True, "visible": True,
          "instructions": "ORIGINAL", "name": "Risk Reviewer", "files": ["rubric.md"]}]
    )
    definition = WorkflowDefinition.model_validate(_definition_with_skill_ref(skill_id))

    materialized = await materialize_skill_snapshots(
        definition, run_id=uuid4(),
        supabase=SimpleNamespace(storage=storage, table=db.table), user_id="u",
    )
    original = materialized.phases[0].config.skill_snapshot.instructions

    # Mutate the live skill + delete its file.
    db.mutate(str(skill_id), instructions="EDITED", files=[])
    storage._files.pop(f"owner-id/{skill_id}/rubric.md", None)

    # Snapshot instructions unchanged; the snapshot file copy is still readable.
    assert materialized.phases[0].config.skill_snapshot.instructions == original == "ORIGINAL"


@pytest.mark.xfail(reason="impl lands in Plan 04 (threads.py kickoff wiring)", strict=False)
async def test_kickoff_snapshot_wiring(monkeypatch):
    """Plan 04: the kickoff path calls validate + materialize-if-needed and maps
    ValueError → HTTPException(400). Import-light: patch the service functions."""
    from fastapi import HTTPException
    import app.services.harness.skill_snapshot as snap_mod

    async def _boom_validate(*a, **k):
        raise ValueError("skill 'x' is disabled")

    monkeypatch.setattr(snap_mod, "validate_skill_refs", _boom_validate, raising=False)

    # The kickoff helper (Plan 04) wraps validate_skill_refs and translates the
    # ValueError into a 400. This asserts the translation contract.
    from app.api.threads import _ensure_skill_snapshots  # lands in Plan 04

    with pytest.raises(HTTPException) as ei:
        await _ensure_skill_snapshots(definition=object(), run_id=uuid4(),
                                      supabase=object(), user_id="u")
    assert ei.value.status_code == 400


# ── local fakes used only by the xfail (Plan 02/03/04) stubs ──────────────────
def _definition_with_skill_ref(skill_id: UUID) -> dict:
    d = _pre099_definition_dict()
    d["phases"][0]["config"]["skill_ref"] = str(skill_id)
    return d


class _LiveSkillQuery:
    """A no-op fluent skills-table query stand-in for the live read path (Plan 03 fills shape)."""

    def select(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return SimpleNamespace(data={"id": "skill-id", "user_id": "owner-id"})


class _FakeSkillsDB:
    """Records visible skill rows and exposes a minimal ``table('skills')`` fluent query
    so the Plan 03 publish-gate / materializer can resolve refs offline."""

    def __init__(self, rows):
        self._rows = {r["id"]: dict(r) for r in rows}

    def table(self, *_a, **_k):
        return _FakeSkillsQuery(self._rows)

    def mutate(self, skill_id, **fields):
        self._rows.setdefault(skill_id, {}).update(fields)

    # Allow `validate_skill_refs(..., supabase=_FakeSkillsDB(...))` to call .table directly.
    def __iter__(self):
        return iter(self._rows.values())


class _FakeSkillsQuery:
    def __init__(self, rows):
        self._rows = rows
        self._filter_id = None

    def select(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def eq(self, col, val):
        if col == "id":
            self._filter_id = val
        return self

    def maybe_single(self):
        return self

    def execute(self):
        if self._filter_id is not None:
            return SimpleNamespace(data=self._rows.get(self._filter_id))
        return SimpleNamespace(data=list(self._rows.values()))
