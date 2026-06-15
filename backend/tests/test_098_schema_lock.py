"""Phase 098 Plan 01 — additive-optional schema-lock contracts (PROJ-01/PROJ-02 + D-08).

These tests are OFFLINE/PURE (no DB, no Redis) — they only exercise the Pydantic
layer in ``app.models.harness``. They prove the three load-bearing guarantees of
the 098 schema lock:

  1. ``test_old_rows_validate`` — the seeded-template ``definition`` JSONB shipped
     by migrations 061/065 (which predate every 098 field) still
     ``WorkflowDefinition.model_validate()``s cleanly and the new fields take
     their defaults. This IS SC#1 (zero-migration: old unbound workflows validate).
  2. ``test_new_fields_roundtrip`` — a definition WITH the new fields set survives
     a ``model_dump(mode="json")`` -> ``model_validate`` round-trip (mode="json"
     exercises the UUID->str write path — Pitfall 2).
  3. ``test_structural_scope_requires_project`` — the D-07 STRUCTURAL narrow-only
     ``@model_validator`` rejects a phase ``folder_scope`` when the workflow has no
     ``project_folder_id`` for it to be a subset of.

Analog: ``test_harness_templates.py`` (the migration-061 JSONB-extract helper at
:28-43 + the ``model_validate`` round-trip at :46-65).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.harness import AssetRef, InputFieldSpec, WorkflowDefinition

# The seeded-template "old row" JSONB sources. 061 ships the 4 full seed
# definitions; 065 patches three of them via ``jsonb_set`` (its ``::jsonb`` blobs
# are FRAGMENTS, e.g. ``["topic"]`` / ``[]`` — NOT full definitions), so we extract
# from BOTH files and keep only the full-definition blobs (a dict carrying
# ``phases``). This mirrors test_harness_templates.py:20-43.
_MIGRATIONS_DIR = (
    Path(__file__).resolve().parents[2] / "supabase" / "migrations"
)
_MIGRATION_061 = _MIGRATIONS_DIR / "061_harness_seed_templates.sql"
_MIGRATION_065 = _MIGRATIONS_DIR / "065_harness_seed_fixes.sql"


def _extract_definition_blobs(*sql_files: Path) -> list[dict]:
    """Parse every ``'{...}'::jsonb`` literal out of the given migration files and
    return only those that are full ``WorkflowDefinition`` blobs (a dict carrying a
    ``phases`` key). Un-doubles the SQL single-quote escaping (``''`` -> ``'``).

    Migration 065 contains ``jsonb_set`` fragments (a list, an empty list) rather
    than definitions; those are filtered out so they are never fed to
    ``WorkflowDefinition.model_validate()``.
    """
    definitions: list[dict] = []
    for sql_file in sql_files:
        sql = sql_file.read_text(encoding="utf-8")
        for blob in re.findall(r"'((?:[^']|'')*)'::jsonb", sql, flags=re.DOTALL):
            parsed = json.loads(blob.replace("''", "'"))
            if isinstance(parsed, dict) and "phases" in parsed:
                definitions.append(parsed)
    return definitions


def test_old_rows_validate():
    """SC#1 — the seeded-template definition JSONB (migrations 061 + 065), which
    predates every 098 field, still validates and the new fields default."""
    blobs = _extract_definition_blobs(_MIGRATION_061, _MIGRATION_065)
    # Migration 061 ships exactly the 4 canonical seed definitions.
    assert len(blobs) >= 4, f"expected >=4 seed definitions, got {len(blobs)}"

    for blob in blobs:
        wf = WorkflowDefinition.model_validate(blob)
        assert isinstance(wf, WorkflowDefinition)
        # The 098 additive-optional fields take their defaults on every old row.
        assert wf.project_folder_id is None
        assert wf.provenance == "source"
        assert wf.reingest_output is False
        assert wf.version_policy == "supersede-by-filename"
        assert wf.output_target_folder is None
        assert wf.inputs is None
        assert wf.assets is None


def test_new_fields_roundtrip():
    """A definition WITH the 098 fields set survives a model_dump(mode="json") ->
    model_validate round-trip (mode="json" exercises the UUID->str write path)."""
    project_id = uuid4()
    scope_child = uuid4()  # a child of the project subtree (subset check is Plan 03)
    out_folder = uuid4()

    wf = WorkflowDefinition.model_validate(
        {
            "slug": "bound_research",
            "version": 1,
            "name": "Bound Research",
            "status": "draft",
            "phases": [
                {
                    "slug": "research",
                    "phase_index": 0,
                    "config": {
                        "phase_type": "llm_agent",
                        "prompt": "Research the project KB.",
                        "available_tools": ["search_documents"],
                        "folder_scope": [str(scope_child)],
                    },
                }
            ],
            "project_folder_id": str(project_id),
            "output_target_folder": str(out_folder),
            "reingest_output": True,
            "version_policy": "keep-all",
            "provenance": "derived",
            "inputs": [
                {
                    "key": "topic",
                    "label": "Topic",
                    "type": "kb_auto",
                    "source": "kb_auto",
                    "folder_scope": [str(scope_child)],
                }
            ],
            "assets": [
                {
                    "asset_id": "tmpl-1",
                    "filename": "risk-register.docx",
                    "kind": "template",
                    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                }
            ],
        }
    )

    # Round-trip through the JSON serialization path (UUID -> str -> UUID).
    dumped = wf.model_dump(mode="json")
    assert isinstance(dumped["project_folder_id"], str)  # Pitfall 2: UUID serialized to str
    wf2 = WorkflowDefinition.model_validate(dumped)

    assert wf2.project_folder_id == project_id
    assert wf2.output_target_folder == out_folder
    assert wf2.reingest_output is True
    assert wf2.version_policy == "keep-all"
    assert wf2.provenance == "derived"
    assert wf2.phases[0].config.folder_scope == [scope_child]
    assert isinstance(wf2.inputs[0], InputFieldSpec)
    assert wf2.inputs[0].folder_scope == [scope_child]
    assert isinstance(wf2.assets[0], AssetRef)
    assert wf2.assets[0].filename == "risk-register.docx"


def test_structural_scope_requires_project():
    """D-07 structural half — a phase folder_scope with no project_folder_id is a
    hard ValidationError at model_validate()."""
    with pytest.raises((ValidationError, ValueError)) as exc_info:
        WorkflowDefinition.model_validate(
            {
                "slug": "orphan_scope",
                "version": 1,
                "name": "Orphan Scope",
                "status": "draft",
                "phases": [
                    {
                        "slug": "research",
                        "phase_index": 0,
                        "config": {
                            "phase_type": "llm_agent",
                            "prompt": "Search.",
                            "available_tools": ["search_documents"],
                            "folder_scope": [str(uuid4())],
                        },
                    }
                ],
                # NOTE: project_folder_id intentionally absent -> None.
            }
        )

    assert "folder_scope but the workflow has no" in str(exc_info.value)
