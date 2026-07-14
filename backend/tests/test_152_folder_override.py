"""Phase 152 (WFIN-02) — per-run folder-scope OVERRIDE resolution.

Unit contract for ``resolve_run_scope_root`` (harness/scope.py) — the precedence
+ owner-reachability gate that layers a per-run override on top of the author
default. Offline only (patches ``fetch_visible_folders`` / ``resolve_project_subtree``
the same way test_098_scope_governance.py does). Measured against the captured
SEED-056 baseline (~63 backend pre-existing ROT), NOT zero-fail.

Behaviors under test:
  - override owned by the user → helper returns str(override) (WFIN-02).
  - D-05: override NOT owner-reachable → dropped, falls back to author default.
  - D-06: no override → author default; project_folder_id None → thread fallback → None.
  - A4: a workflow declaring a per-phase folder_scope drops an override that is NOT
    within the project subtree (would silently empty the phase intersection); an
    override within the subtree is honored.
  - WR-03 (A4 corrected): an override that IS inside the project subtree but empties
    ANY declared phase's folder_scope ∩ (its OWN subtree) is DROPPED — the P/A/B
    two-phase case (override=A, phase2 folder_scope=[B]) degrades to the author default.
  - the helper NEVER returns a set (str | None), and consults fetch_visible_folders
    exactly once when an override is present.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.models.harness import WorkflowDefinition
from app.models.message import MessageCreate
from app.services.harness import scope as scope_mod
from app.services.harness.scope import resolve_run_scope_root


def _def(project_folder_id, *, phase_scope=None):
    """Build a WorkflowDefinition; optionally give its single phase a folder_scope.

    A per-phase folder_scope structurally REQUIRES a project_folder_id (the
    @model_validator on WorkflowDefinition), so callers pass both together.
    """
    if phase_scope is not None:
        config = {
            "phase_type": "llm_agent",
            "prompt": "x",
            "available_tools": ["search_documents"],
            "folder_scope": phase_scope,
        }
    else:
        config = {"phase_type": "llm_single", "prompt": "x"}
    return WorkflowDefinition.model_validate(
        {
            "slug": "wf",
            "version": 1,
            "name": "WF",
            "project_folder_id": project_folder_id,
            "phases": [{"slug": "p", "phase_index": 0, "config": config}],
        }
    )


def _def_two_phase(project_folder_id, *, scope1, scope2):
    """A definition with TWO retrieval phases carrying DISTINCT per-phase folder_scopes.

    WR-03 / A4: phase1.folder_scope=scope1, phase2.folder_scope=scope2. Both structurally
    require a project_folder_id (the @model_validator on WorkflowDefinition). This models
    the empty-intersection gap — an override whose OWN subtree intersects one phase's scope
    but NOT the other's must be dropped (else that phase silently retrieves nothing).
    """
    def _cfg(scope):
        return {
            "phase_type": "llm_agent",
            "prompt": "x",
            "available_tools": ["search_documents"],
            "folder_scope": scope,
        }

    return WorkflowDefinition.model_validate(
        {
            "slug": "wf",
            "version": 1,
            "name": "WF",
            "project_folder_id": project_folder_id,
            "phases": [
                {"slug": "p1", "phase_index": 0, "config": _cfg(scope1)},
                {"slug": "p2", "phase_index": 1, "config": _cfg(scope2)},
            ],
        }
    )


def _fake_visible(*ids):
    async def _fetch(supabase, user_id):
        return [{"id": i, "parent_id": None} for i in ids]

    return _fetch


# ── override honored when owner-reachable ────────────────────────────────────
async def test_override_owned_resolves(monkeypatch):
    """An owned override wins over the author default; the returned root is str(override)."""
    author = str(uuid4())
    override = str(uuid4())
    monkeypatch.setattr(scope_mod, "fetch_visible_folders", _fake_visible(author, override))

    captured = {}

    async def _fake_resolve(root, *, supabase, user_id):
        captured["root"] = root
        return [str(root)]

    monkeypatch.setattr(scope_mod, "resolve_project_subtree", _fake_resolve)

    root = await resolve_run_scope_root(
        _def(author),
        run_inputs={"folder_id": override},
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    assert root == override
    # the caller composition: resolve_project_subtree(root) binds the override subtree
    subtree = await scope_mod.resolve_project_subtree(root, supabase=object(), user_id="u")
    assert subtree == [override]
    assert captured["root"] == override


# ── D-05: a never-owned / unreachable override is refused ────────────────────
async def test_override_unowned_refused(monkeypatch):
    """D-05: an override NOT in the owner's visible folders is dropped (no narrowing)."""
    author = str(uuid4())
    override = str(uuid4())  # NOT in the visible set
    monkeypatch.setattr(scope_mod, "fetch_visible_folders", _fake_visible(author))

    root = await resolve_run_scope_root(
        _def(author),
        run_inputs={"folder_id": override},
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    # falls back to the author default — never scopes into the unowned id
    assert root == author
    assert root != override


# ── D-06: absent override = today's behavior ─────────────────────────────────
async def test_absent_override_returns_author_default(monkeypatch):
    """D-06: no override key → the author default project_folder_id."""
    author = str(uuid4())
    # fetch_visible_folders must NOT be consulted when there is no override
    called = {"n": 0}

    async def _boom(supabase, user_id):
        called["n"] += 1
        return []

    monkeypatch.setattr(scope_mod, "fetch_visible_folders", _boom)

    root = await resolve_run_scope_root(
        _def(author),
        run_inputs={},  # no folder_id key
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    assert root == author
    assert called["n"] == 0  # owner gate skipped when no override present


async def test_absent_override_unbound_falls_to_thread_then_whole_kb(monkeypatch):
    """D-06: project_folder_id None → thread fallback; both None → None (whole-KB)."""
    async def _boom(supabase, user_id):  # must not be consulted (no override)
        raise AssertionError("fetch_visible_folders consulted without an override")

    monkeypatch.setattr(scope_mod, "fetch_visible_folders", _boom)

    thread_folder = str(uuid4())
    # unbound workflow, no override, thread folder present → thread fallback
    root = await resolve_run_scope_root(
        _def(None),
        run_inputs=None,
        thread_folder_id=thread_folder,
        supabase=object(),
        user_id="u",
    )
    assert root == thread_folder

    # unbound, no override, no thread folder → None = whole-KB (byte-identical to today)
    root_none = await resolve_run_scope_root(
        _def(None),
        run_inputs=None,
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    assert root_none is None


# ── A4 composition: per-phase folder_scope constrains the override ───────────
async def test_a4_override_outside_subtree_dropped(monkeypatch):
    """A4: a scoped workflow drops an override whose OWN subtree misses the phase scope.

    WR-03: the override is an isolated leaf OUTSIDE the project subtree — subtree(override)
    = {override} does not intersect the phase's folder_scope=[child], so the override empties
    that phase's intersection and is dropped, degrading to the author default.
    """
    author = str(uuid4())
    child = str(uuid4())
    override = str(uuid4())  # owned, but OUTSIDE the project subtree
    monkeypatch.setattr(
        scope_mod, "fetch_visible_folders", _fake_visible(author, child, override)
    )

    async def _fake_subtree(root, *, supabase, user_id):
        # WR-03: resolve the OVERRIDE's OWN subtree. The out-of-project override is an
        # isolated leaf (subtree = {override}); the author subtree stays {author, child}.
        if str(root) == override:
            return [override]
        return [author, child]

    monkeypatch.setattr(scope_mod, "resolve_project_subtree", _fake_subtree)

    root = await resolve_run_scope_root(
        _def(author, phase_scope=[child]),  # declares a per-phase folder_scope
        run_inputs={"folder_id": override},
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    # override dropped (would empty the phase intersection) → author default
    assert root == author


async def test_a4_override_inside_subtree_honored(monkeypatch):
    """A4: a scoped workflow honors an override that IS within the project subtree."""
    author = str(uuid4())
    child = str(uuid4())
    monkeypatch.setattr(scope_mod, "fetch_visible_folders", _fake_visible(author, child))

    async def _fake_subtree(root, *, supabase, user_id):
        return [author, child]

    monkeypatch.setattr(scope_mod, "resolve_project_subtree", _fake_subtree)

    root = await resolve_run_scope_root(
        _def(author, phase_scope=[child]),
        run_inputs={"folder_id": child},  # within the subtree
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    assert root == child


# ── WR-03: in-subtree override empties ANOTHER phase's scope → dropped ────────
async def test_a4_two_phase_empty_intersection_dropped(monkeypatch):
    """WR-03 / A4: an IN-subtree override that empties ANY phase's folder_scope ∩ is dropped.

    Project P has two DISTINCT children A, B (both ⊆ P's subtree). phase1 folder_scope=[A],
    phase2 folder_scope=[B]. An override of A is INSIDE P's subtree — but subtree(A)={A} does
    NOT intersect phase2's [B], so at phase_types.py:326 phase2 would retrieve NOTHING. The
    override MUST be dropped, degrading to the author default P (no phase silently retrieves
    nothing). Membership in the project subtree is necessary but NOT sufficient.

    This is RED against the pre-WR-03 A4 branch (which resolved the AUTHOR subtree {P,A,B} and
    honored A because A ∈ {P,A,B}); it goes GREEN once the branch resolves the OVERRIDE's subtree.
    """
    p = str(uuid4())
    a = str(uuid4())
    b = str(uuid4())
    # P, A, B all owner-visible (A and B are children of P)
    monkeypatch.setattr(scope_mod, "fetch_visible_folders", _fake_visible(p, a, b))

    # root-aware subtree stub: subtree(P)={P,A,B}, subtree(A)={A}, subtree(B)={B}
    subtrees = {p: [p, a, b], a: [a], b: [b]}

    async def _fake_subtree(root, *, supabase, user_id):
        return subtrees.get(str(root), [str(root)])

    monkeypatch.setattr(scope_mod, "resolve_project_subtree", _fake_subtree)

    definition = _def_two_phase(p, scope1=[a], scope2=[b])

    # override = A: inside subtree(P) but empties phase2's [B] ∩ subtree(A)={A} → DROPPED → P
    root = await resolve_run_scope_root(
        definition,
        run_inputs={"folder_id": a},
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    assert root == p  # dropped to the author default — no phase silently retrieves nothing

    # good path (regression lock): override = P (project root, subtree covers A AND B) →
    # every phase scope still intersects → honored/kept → still P.
    root_good = await resolve_run_scope_root(
        definition,
        run_inputs={"folder_id": p},
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    assert root_good == p


# ── shape guards: str|None, and fetch_visible_folders consulted once ─────────
async def test_returns_str_or_none_and_fetches_once(monkeypatch):
    """The helper returns str | None (NEVER a set) and gates the override with one fetch."""
    author = str(uuid4())
    override = str(uuid4())
    calls = {"n": 0}

    async def _counting_fetch(supabase, user_id):
        calls["n"] += 1
        return [{"id": author, "parent_id": None}, {"id": override, "parent_id": None}]

    monkeypatch.setattr(scope_mod, "fetch_visible_folders", _counting_fetch)

    root = await resolve_run_scope_root(
        _def(author),  # no per-phase folder_scope → A4 branch not entered
        run_inputs={"folder_id": override},
        thread_folder_id=None,
        supabase=object(),
        user_id="u",
    )
    assert isinstance(root, str)
    assert not isinstance(root, set)
    assert calls["n"] == 1  # exactly one owner-reachability fetch when an override is present


# ── MessageCreate carries the optional per-run override ──────────────────────
def test_messagecreate_folder_id_optional():
    """MessageCreate.folder_id is an optional UUID; absence is the D-06 path."""
    default = MessageCreate(content="hi")
    assert default.folder_id is None

    fid = uuid4()
    with_override = MessageCreate(content="hi", folder_id=str(fid))
    assert with_override.folder_id == fid

    # malformed UUID → ValidationError (FastAPI surfaces this as a 422 at the door — V5)
    with pytest.raises(Exception):
        MessageCreate(content="hi", folder_id="not-a-uuid")
