"""Phase 287 / START-03 -- DB-free static gauntlet over EVERY shipped starter.

The set of starters is DERIVED from migrations 094 + 210 (never a constant), so a starter added by
a later migration cannot dodge the gauntlet and a migration that stops parsing collapses the set
below the floor and fails loudly (collapse guard).

Each starter must pass the static publish stages (shape, business requirement, reachability lint,
interactive-phase refusal, grounding gate). Four planted-defect counterfactuals prove the stages
are not vacuous: each must report a defect.

The bijection test (migration-derived slugs == the slugs ``list_starter_workflows`` returns) is the
delivery of D-10 "the shelf lists only starters that pass": the starters on the shelf ARE the ones
this file proves pass. It skips cleanly when the local DB is down.

Imports live inside bodies (Phase 102 posture) so ``--collect-only`` stays clean.
"""

from __future__ import annotations

import copy
import json
import os
import re
from pathlib import Path

import pytest

_REPO = Path(__file__).resolve().parents[3]
_MIGRATIONS = _REPO / "supabase" / "migrations"
_STARTER_MIGRATIONS = (
    "094_starter_workflows.sql",
    "210_starter_workflows_v2.sql",
)
_NEW_SLUGS = (
    "meeting-notes-to-actions",
    "policy-change-impact",
    "stakeholder-update",
)
_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)

_JSON_BLOCK = re.compile(r"'(\{.*?\})'::jsonb", re.DOTALL)


def _starters_from_migrations() -> dict[str, dict]:
    """slug -> definition, parsed from the INSERT ... '{json}'::jsonb blocks of each migration."""
    out: dict[str, dict] = {}
    for name in _STARTER_MIGRATIONS:
        path = _MIGRATIONS / name
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for m in _JSON_BLOCK.finditer(text):
            d = json.loads(m.group(1))
            if d.get("category") == "starter":
                out[d["slug"]] = d
    return out


def _tools() -> set[str]:
    from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES
    from app.services.openai_service import CHAT_ONLY_TOOLS, get_tools

    return ({t["function"]["name"] for t in get_tools(None)} - CHAT_ONLY_TOOLS) | set(
        EXTERNAL_ACTION_CAPABILITIES
    )


async def _static_verdict(raw: dict) -> dict:
    from app.models.harness import WorkflowDefinition
    from app.services.harness import grounding, publish_service
    from app.services.harness.reachability import lint_workflow

    wd = WorkflowDefinition.model_validate(raw)  # shape tier (extra='forbid')
    return {
        "business_requirement_missing": grounding.business_requirement_missing(wd),
        "lint": [(e.code, e.message) for e in lint_workflow(wd)],
        "interactive": publish_service._interactive_phase_failures(wd),
        "grounding": [
            v["code"]
            for v in await grounding.grounding_verdicts(
                wd,
                supabase=None,
                user_id="u",
                tool_names=_tools(),
                skill_ids=set(),
            )
        ],
    }


def _clean(v: dict) -> bool:
    return (
        v["business_requirement_missing"] is False
        and not v["lint"]
        and not v["interactive"]
        and not v["grounding"]
    )


def _base() -> dict:
    return copy.deepcopy(_starters_from_migrations()["meeting-notes-to-actions"])


# -- the set ----------------------------------------------------------------------------------


def test_starter_set_is_derived_and_large_enough():
    starters = _starters_from_migrations()
    assert len(starters) >= 5, f"collapse guard: only {sorted(starters)} parsed from migrations"
    for slug in _NEW_SLUGS:
        assert slug in starters, f"migration 210 must ship {slug}"


def test_no_starter_carries_folder_scope():
    """Justifies supabase=None in the grounding call: rule 1 reads folders only for folder_scope."""
    for slug, d in _starters_from_migrations().items():
        assert "folder_scope" not in json.dumps(d), slug
        assert not d.get("project_folder_id"), slug


@pytest.mark.asyncio
async def test_every_starter_passes_the_static_stages():
    starters = _starters_from_migrations()
    assert len(starters) >= 5
    for slug, raw in starters.items():
        verdict = await _static_verdict(raw)
        assert _clean(verdict), f"{slug}: {verdict}"


def test_new_starters_are_template_less_two_phase_chat_answers():
    starters = _starters_from_migrations()
    for slug in _NEW_SLUGS:
        d = starters[slug]
        assert d["category"] == "starter"
        assert not d.get("assets"), f"{slug} must declare no assets (template-less)"
        assert not d.get("inputs"), f"{slug} must declare no inputs"
        types = [p["config"]["phase_type"] for p in sorted(d["phases"], key=lambda p: p["phase_index"])]
        assert types == ["llm_agent", "llm_single"], f"{slug}: {types}"
        write = d["phases"][1]
        kinds = {v["kind"]: v for v in write["validators"]}
        assert "citations_required" in kinds and "structure_check" in kinds, slug
        cite = kinds["citations_required"]["config"]
        assert cite.get("mode") == "presence", f"{slug}: llm_single cannot use retrieved_and_cited"
        assert d["phases"][0]["config"]["available_tools"] == ["search_documents"]


# -- counterfactuals: the stages must FAIL on a planted defect --------------------------------


@pytest.mark.asyncio
async def test_counterfactual_unregistered_tool_is_caught():
    raw = _base()
    raw["phases"][0]["config"]["available_tools"] = ["definitely_not_a_tool"]
    v = await _static_verdict(raw)
    assert "unregistered_tool" in v["grounding"], v


@pytest.mark.asyncio
async def test_counterfactual_empty_business_requirement_is_caught():
    raw = _base()
    raw["business_requirement"] = ""
    v = await _static_verdict(raw)
    assert v["business_requirement_missing"] is True, v


@pytest.mark.asyncio
async def test_counterfactual_phase_index_gap_is_caught():
    raw = _base()
    raw["phases"][1]["phase_index"] = 3
    v = await _static_verdict(raw)
    codes = {c for c, _ in v["lint"]}
    assert codes, v
    assert codes & {"bad_index", "orphan_phase", "no_terminal"}, v


@pytest.mark.asyncio
async def test_counterfactual_interactive_validator_is_caught():
    raw = _base()
    raw["phases"][1]["validators"][0]["on_failure"] = "ask_user"
    v = await _static_verdict(raw)
    assert v["interactive"], v


# -- bijection with the shelf -----------------------------------------------------------------


def _pg_reachable() -> bool:
    try:
        import psycopg2

        psycopg2.connect(_DSN, connect_timeout=2).close()
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _pg_reachable(), reason="local Postgres not reachable")
@pytest.mark.asyncio
async def test_shelf_slugs_equal_migration_derived_slugs():
    import asyncpg

    from app.db.workflows import list_starter_workflows

    pool = await asyncpg.create_pool(_DSN, min_size=1, max_size=1)
    try:
        rows = await list_starter_workflows(pool)
    finally:
        await pool.close()
    shelf = {r["slug"] for r in rows}
    derived = set(_starters_from_migrations())
    assert len(derived) >= 5
    assert shelf == derived, f"shelf-only={shelf - derived} migration-only={derived - shelf}"
