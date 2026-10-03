"""Phase 267 (PACK-21 / D-267-01..04, D-267-29, D-267-32) — an Expert only ever ADDS.

An Expert thread advertises every tool a plain thread would for the same context, PLUS the
Expert's own resolver-approved connections, and its skill catalog is the normal catalog PLUS the
Expert's member skills. There is no tool filter, no tool-floor constant and no toggle left that
could strip a tool again.

(b) and (c) drive the REAL setup block of ``agent_loop.run_agent_loop`` — the smallest real entry
that runs the connector block and the skill catalog. The block is driven up to the moment history
is reconstructed (every tool and catalog decision is made by then); a stand-in for
``_reconstruct_history`` reads the loop's ``active_tools`` / ``active_system_prompt`` locals and
stops the run. Only I/O is replaced: the Supabase query results, the connection list, the pg pool,
the attachment read and the embedding call. ``get_tools``, ``build_chat_tools_for_connectors``,
``resolve_connector_org``, ``build_skill_catalog_block`` and the admission predicate are real.

The Expert-side context is built by calling the real ``run_producer._resolve_thread_scoping`` with
a mocked resolver, so the fence measures what the producer actually hands the loop.
"""
from __future__ import annotations

import ast
import pathlib
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.models.message import MessageCreate
from app.services import agent_loop as _loop_mod
from app.services.agent_loop import RunContext
from app.services.expert_service import ResolvedExpertBundle
from app.services.openai_service import get_tools

APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"

ORG_ID = str(uuid4())
USER_ID = str(uuid4())
HUBSPOT_ID = uuid4()
NOTION_ID = uuid4()
SMTP_ID = uuid4()


# ── the Expert context, from the real producer ────────────────────────────────────────────────

def _bundle(*, connections: list[str], skills: list[str], tool_floor_enabled: bool = True) -> ResolvedExpertBundle:
    return ResolvedExpertBundle(
        bundle_id=uuid4(),
        name="RFP Responder",
        slug="rfp-responder",
        description="Produces RFP proposals",
        scope_mode="biased",
        is_system=False,
        org_id=UUID(ORG_ID),
        tool_floor_enabled=tool_floor_enabled,
        effective_skills=skills,
        effective_folder_ids=[],
        effective_connections=connections,
    )


async def _scoping(resolved: ResolvedExpertBundle | None, *, active: bool = True):
    from app.services.run_producer import _resolve_thread_scoping  # noqa: PLC0415

    thread = MagicMock(
        data={"active_expert_id": str(resolved.bundle_id) if (resolved and active) else None, "folder_id": None}
    )
    with patch("app.utils.db.aexec", AsyncMock(return_value=thread)), \
         patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=resolved)), \
         patch("app.utils.folder_utils.fetch_visible_folders", AsyncMock(return_value=[])):
        return await _resolve_thread_scoping(
            supabase=MagicMock(),
            thread_id=str(uuid4()),
            current_user={"id": USER_ID, "org_id": ORG_ID},
            pool=MagicMock(),
        )


def _ctx_kwargs(scoping) -> dict:
    """Map what the producer returned onto RunContext keywords, exactly as run_producer does.

    The positional branch reproduces the PHASE-BASE producer (``785c03274``: a bare 5-tuple of
    folders, tools, skill override, path, born-for). It exists so this fence can be driven RED
    against the old behaviour, which is how it was proven able to fire (267-01-SUMMARY).
    """
    if hasattr(scoping, "_asdict"):
        return dict(scoping._asdict())
    folders, tools, skills, path, born_for = scoping
    return {
        "effective_folder_ids": folders,
        "effective_tools": tools,
        "skill_catalog_override": skills,
        "scoped_folder_path": path,
        "born_for_bundle_id": born_for,
    }


# ── (a) the producer hands the loop DATA, never a tool list ────────────────────────────────────

@pytest.mark.asyncio
async def test_expert_thread_scoping_carries_connections_and_skills_and_no_tool_list():
    from app.services.run_producer import ThreadScoping  # noqa: PLC0415

    scoping = await _scoping(_bundle(connections=["hubspot"], skills=["deal-review"]))
    assert isinstance(scoping, ThreadScoping)
    assert scoping.scoped_connection_keys == ("hubspot",)
    assert scoping.skill_catalog_additions == (
        {"name": "deal-review", "description": "Expert member skill: deal-review"},
    )
    assert not hasattr(scoping, "effective_tools")
    assert "effective_tools" not in ThreadScoping._fields
    assert "skill_catalog_override" not in ThreadScoping._fields


@pytest.mark.asyncio
async def test_plain_thread_scoping_is_all_none():
    from app.services.run_producer import ThreadScoping  # noqa: PLC0415

    scoping = await _scoping(_bundle(connections=[], skills=[]), active=False)
    assert scoping == ThreadScoping(None, None, None, None, None)


@pytest.mark.asyncio
async def test_expert_with_no_connections_or_skills_hands_none_not_empty():
    """None => byte-identical to a plain run on those two axes (the default-off contract)."""
    scoping = await _scoping(_bundle(connections=[], skills=[]))
    assert scoping.scoped_connection_keys is None
    assert scoping.skill_catalog_additions is None


@pytest.mark.asyncio
@pytest.mark.parametrize("floor", [True, False])
async def test_tool_floor_enabled_changes_nothing_the_run_receives(floor):
    """D-267-02: the column is kept and read by nothing in the run path."""
    a = await _scoping(_bundle(connections=["hubspot"], skills=["x"], tool_floor_enabled=floor))
    b = await _scoping(_bundle(connections=["hubspot"], skills=["x"], tool_floor_enabled=not floor))
    assert a._replace(born_for_bundle_id=None) == b._replace(born_for_bundle_id=None)


# ── (b)/(c) harness: the real setup block of run_agent_loop ────────────────────────────────────

class _Stop(Exception):
    pass


class _Query:
    """A chainable stand-in for a supabase-py query that remembers its table."""

    def __init__(self, table: str):
        self.table = table

    def __getattr__(self, _name):
        return lambda *a, **k: self


def _conn(cid, service_id, name, *, capability=None, enabled=True, tools=("search",)):
    return SimpleNamespace(
        id=cid,
        service_id=service_id,
        capability=capability,
        name=name,
        is_enabled=enabled,
        # 267-REVIEW WR-05: ConnectorConnectionResponse always carries `status`; a key admits only
        # an 'active' connection, so the fake carries the field the real row has.
        status="active",
        tool_grants={},
        default_approval_posture="ask",
        discovered_tools=[{"name": t, "description": f"{t} on {name}"} for t in tools],
    )


DEFAULT_CONNS = [
    _conn(HUBSPOT_ID, "hubspot", "HubSpot"),
    _conn(NOTION_ID, "notion", "Notion"),
    _conn(SMTP_ID, "smtp", "Mail", capability="send_email", tools=("send",)),
]

USER_SETTINGS = SimpleNamespace(
    web_search_enabled=True,
    sandbox_enabled=True,
    self_improve_enabled=True,
    llm_model="gpt-4o",
    active_provider="openai",
    embedding_model="text-embedding-3-small",
)


async def _drive(
    ctx_kwargs: dict,
    *,
    conns=None,
    skills_rows=None,
    budget: int = 0,
    active_connector_ids=(HUBSPOT_ID,),
) -> dict:
    """Run the real setup block; return {"names": [...], "prompt": str}."""
    tables = {
        "threads": {"folder_id": None},
        "messages": [],
        "skills": list(skills_rows or []),
        "user_memory": [],
    }

    async def _fake_aexec(q):
        return SimpleNamespace(data=tables.get(getattr(q, "table", None)))

    supabase = MagicMock()
    supabase.table.side_effect = _Query
    captured: dict = {}

    def _capture(history_rows, active_provider="", **_kw):  # 268 D-268-27 added `resuming=`
        frame = sys._getframe(1)
        captured["tools"] = frame.f_locals.get("active_tools")
        captured["prompt"] = frame.f_locals.get("active_system_prompt")
        raise _Stop()

    body = MessageCreate(content="draft the proposal", active_connector_ids=list(active_connector_ids))
    ctx = RunContext(
        run_id=uuid4(),
        thread_id=str(uuid4()),
        current_user={"id": USER_ID, "org_id": ORG_ID},
        user_settings=USER_SETTINGS,
        body=body,
        redis=MagicMock(),
        supabase=supabase,
        resolved_model="gpt-4o",
        resolved_provider="openai",
        **ctx_kwargs,
    )

    def _no_embed(*_a, **_k):
        raise RuntimeError("no embedding in unit tests")

    with patch.object(_loop_mod, "aexec", _fake_aexec), \
         patch.object(_loop_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch.object(_loop_mod, "resolve_skill_catalog_budget", lambda _s: budget), \
         patch.object(_loop_mod, "embed_texts", _no_embed), \
         patch.object(_loop_mod, "_reconstruct_history", _capture), \
         patch("app.services.connector_service.list_connections",
               AsyncMock(return_value=list(DEFAULT_CONNS if conns is None else conns))), \
         patch("app.db.workspace.list_files_in_thread", AsyncMock(return_value=[])):
        with pytest.raises(_Stop):
            await _loop_mod.run_agent_loop(
                ctx, emit=AsyncMock(), emit_terminal=AsyncMock(), spawn=MagicMock()
            )

    tools = captured["tools"] if captured["tools"] is not None else get_tools(USER_SETTINGS)
    names = [t["function"]["name"] for t in tools if isinstance(t, dict)]
    return {"names": names, "prompt": captured["prompt"]}


# ── (b) the UNION fence ────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_expert_tools_are_a_superset_of_the_plain_threads():
    plain = await _drive({})
    expert = await _drive(_ctx_kwargs(await _scoping(_bundle(connections=["notion"], skills=[]))))

    assert set(expert["names"]) >= set(plain["names"]), (
        f"an Expert thread lost tools: {sorted(set(plain['names']) - set(expert['names']))}"
    )
    for t in ("web_search", "workspace_read", "query_tables", "recall", "task", "save_skill"):
        assert t in expert["names"], f"{t} is missing from the Expert thread"
    # the composer-armed connection is in BOTH (the bare-slug filter dropped it before 267)
    assert "hubspot__search" in plain["names"]
    assert "hubspot__search" in expert["names"]
    # the Expert's OWN approved connection is ADDED, with no chip
    assert "notion__search" in expert["names"]
    assert "notion__search" not in plain["names"]


@pytest.mark.asyncio
async def test_a_keyed_connection_is_admitted_by_capability_too():
    expert = await _drive({"scoped_connection_keys": ("send_email",)}, active_connector_ids=())
    assert "smtp__send" in expert["names"]


@pytest.mark.asyncio
async def test_a_disabled_connection_is_not_admitted_even_when_keyed():
    conns = [_conn(HUBSPOT_ID, "hubspot", "HubSpot"), _conn(NOTION_ID, "notion", "Notion", enabled=False)]
    expert = await _drive({"scoped_connection_keys": ("notion",)}, conns=conns)
    assert "notion__search" not in expert["names"]
    assert "hubspot__search" in expert["names"]


@pytest.mark.asyncio
async def test_no_keys_and_no_chips_still_means_no_connector_tools():
    """ABSENT AND EMPTY BOTH MEAN NONE — the 2026-08-31 grant-surface fix is not reopened."""
    plain = await _drive({}, active_connector_ids=())
    assert not [n for n in plain["names"] if "__" in n]


@pytest.mark.asyncio
async def test_a_denied_tool_stays_hidden_on_a_keyed_connection():
    """Per-tool grant posture is unchanged by the widened admission (D-267-29)."""
    notion = _conn(NOTION_ID, "notion", "Notion", tools=("search", "delete"))
    notion.tool_grants = {"delete": "deny"}
    expert = await _drive({"scoped_connection_keys": ("notion",)}, conns=[notion], active_connector_ids=())
    assert "notion__search" in expert["names"]
    assert "notion__delete" not in expert["names"]


# ── (c) the skill UNION ────────────────────────────────────────────────────────────────────────

DB_SKILLS = [{"id": "s1", "name": "a", "description": "A skill the user owns"}]


@pytest.mark.asyncio
async def test_skill_catalog_is_the_normal_catalog_plus_the_experts_skills():
    ctx = _ctx_kwargs(await _scoping(_bundle(connections=[], skills=["deal-review"])))
    out = await _drive(ctx, skills_rows=DB_SKILLS)
    assert "- **a**: A skill the user owns" in out["prompt"]
    assert "- **deal-review**: Expert member skill: deal-review" in out["prompt"]


@pytest.mark.asyncio
async def test_expert_skills_survive_the_relevance_trim():
    many = [{"id": f"s{i}", "name": f"skill-{i:03d}", "description": "x" * 200} for i in range(60)]
    out = await _drive(
        {"skill_catalog_additions": ({"name": "deal-review", "description": "Expert member skill: deal-review"},)},
        skills_rows=many,
        budget=50,
    )
    assert "additional skill(s) exist" in out["prompt"], "the trim did not run — the case proves nothing"
    assert "- **deal-review**: Expert member skill: deal-review" in out["prompt"]


@pytest.mark.asyncio
async def test_an_addition_named_like_a_db_row_appears_once_with_the_db_row_winning():
    rows = [{"id": "s9", "name": "deal-review", "description": "The real body"}]
    out = await _drive(
        {"skill_catalog_additions": ({"name": "deal-review", "description": "Expert member skill: deal-review"},)},
        skills_rows=rows,
    )
    assert out["prompt"].count("- **deal-review**:") == 1
    assert "- **deal-review**: The real body" in out["prompt"]


@pytest.mark.asyncio
async def test_a_plain_run_catalog_is_unchanged():
    out = await _drive({}, skills_rows=DB_SKILLS)
    assert "- **a**: A skill the user owns" in out["prompt"]
    assert "deal-review" not in out["prompt"]


# ── (d) AST fences — nothing left that could strip a tool ────────────────────────────────────

def _tree(rel: str) -> ast.Module:
    path = APP_DIR / rel
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


@pytest.mark.parametrize(
    "rel", ["services/run_producer.py", "services/agent_loop.py", "services/task_service.py"]
)
def test_effective_tools_is_neither_passed_nor_read(rel):
    offenders = [
        f"{rel}:{n.lineno}"
        for n in ast.walk(_tree(rel))
        if (isinstance(n, ast.keyword) and n.arg == "effective_tools")
        or (isinstance(n, ast.Attribute) and n.attr == "effective_tools")
    ]
    assert offenders == [], offenders


def test_run_context_has_no_tool_filter_field():
    assert "effective_tools" not in RunContext.__dataclass_fields__
    assert RunContext.__dataclass_fields__["scoped_connection_keys"].default is None
    assert RunContext.__dataclass_fields__["skill_catalog_additions"].default is None


def test_the_tool_floor_constants_are_gone():
    from app.services import tool_dispatcher  # noqa: PLC0415

    assert not hasattr(tool_dispatcher, "EXPERT_CORE_TOOLS")
    assert not hasattr(tool_dispatcher, "EXPERT_DELIVERABLE_TOOLS")


def test_run_producer_never_reads_tool_floor_enabled():
    offenders = [
        n.lineno
        for n in ast.walk(_tree("services/run_producer.py"))
        if (isinstance(n, ast.Attribute) and n.attr == "tool_floor_enabled")
        or (isinstance(n, ast.Constant) and n.value == "tool_floor_enabled")
    ]
    assert offenders == [], f"run_producer.py reads tool_floor_enabled at {offenders}"


def test_run_producer_never_sets_the_eval_catalog_override():
    """D-267-32: the Expert's skills ADD; the replacing override is the eval seam's alone."""
    offenders = [
        n.lineno
        for n in ast.walk(_tree("services/run_producer.py"))
        if isinstance(n, ast.keyword) and n.arg == "skill_catalog_override"
    ]
    assert offenders == []


# ── (e) the closed core is unchanged ──────────────────────────────────────────────────────────

def test_closed_core_inventory_is_unchanged():
    from app.services.harness.emitters import EMITTER_REGISTRY  # noqa: PLC0415
    from app.services.harness.phase_types import PHASE_TYPE_REGISTRY_ENTRIES  # noqa: PLC0415
    from app.services.harness.programmatic import PROGRAMMATIC_PHASE_REGISTRY  # noqa: PLC0415
    from app.services.tool_dispatcher import _TOOL_REGISTRY  # noqa: PLC0415

    assert len(_TOOL_REGISTRY) == 30  # Phase 273: 29 → 30, the deliberate show_artifact
    assert len(EMITTER_REGISTRY) == 1
    assert len(PHASE_TYPE_REGISTRY_ENTRIES) == 7
    assert len(PROGRAMMATIC_PHASE_REGISTRY) == 2
