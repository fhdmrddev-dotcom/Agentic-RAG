"""Phase 267 (D-267-17 / PACK-25) — ``compose_expert_scope`` is the ONE composition of an Expert's
knowledge scope, and it is BYTE-IDENTICAL to the branch it replaced.

⛔ Byte-identity is PROVEN, not asserted by eye: ``_legacy_compose`` below is a verbatim copy of
``run_producer._resolve_thread_scoping``'s inline branch at the phase base (``785c03274``,
``run_producer.py:480-516``), and every case compares the new function's output to it.

The only NEW output is ``excluded_folder_ids`` — the thread-folder subtree a restricted Expert
will not read. It is ``()`` for every other case.
"""
from __future__ import annotations

import ast
import pathlib

import pytest

from app.services.expert_scope import ExpertScope, compose_expert_scope

APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"


# ── the base branch, VERBATIM (run_producer.py:480-516 @ 785c03274) ─────────────────────────────

def _legacy_compose(scope_mode, thread_folder_id, expert_folder_ids, all_folders):
    folder_map = {str(f["id"]): f for f in all_folders}

    def _get_subtree(root_id: str) -> list[str]:
        res = [root_id]
        for f in all_folders:
            if str(f.get("parent_id") or "") == root_id:
                res.extend(_get_subtree(str(f["id"])))
        return res

    def _get_path(fid: str) -> str:
        parts = []
        curr: str | None = fid
        while curr:
            f = folder_map.get(curr)
            if not f:
                break
            parts.append(f.get("name", ""))
            curr = str(f["parent_id"]) if f.get("parent_id") else None
        return ("/" + "/".join(reversed(parts))) if parts else ""

    scoped_folder_path: str | None = None

    if scope_mode == "restricted":
        effective_folder_ids = tuple(sorted(set(expert_folder_ids)))
        if expert_folder_ids:
            scoped_folder_path = _get_path(expert_folder_ids[0]) or None
    else:
        if thread_folder_id:
            thread_subfolder_ids = _get_subtree(str(thread_folder_id))
            effective_folder_ids = tuple(sorted(set(thread_subfolder_ids).union(expert_folder_ids)))
            scoped_folder_path = _get_path(str(thread_folder_id)) or None
        else:
            effective_folder_ids = tuple(sorted(set(expert_folder_ids)))
            if expert_folder_ids:
                scoped_folder_path = _get_path(expert_folder_ids[0]) or None

    return effective_folder_ids, scoped_folder_path


# ── fixtures ────────────────────────────────────────────────────────────────────────────────

T, T1, T2, T1A = "t-root", "t-child-1", "t-child-2", "t-grandchild"
E, E2, OTHER = "e-hr", "e-policies", "o-other"

FOLDERS = [
    {"id": T, "parent_id": None, "name": "Clients"},
    {"id": T1, "parent_id": T, "name": "Acme"},
    {"id": T2, "parent_id": T, "name": "Globex"},
    {"id": T1A, "parent_id": T1, "name": "2026"},
    {"id": E, "parent_id": None, "name": "HR Policies"},
    {"id": E2, "parent_id": E, "name": "Leave"},
    {"id": OTHER, "parent_id": None, "name": "Engineering"},
]

CASES = {
    "restricted_with_thread_folder": ("restricted", T, [E], FOLDERS),
    "restricted_no_thread_folder": ("restricted", None, [E], FOLDERS),
    "restricted_zero_expert_folders": ("restricted", T, [], FOLDERS),
    "restricted_two_expert_folders_unsorted": ("restricted", T, [E2, E], FOLDERS),
    "biased_with_nested_thread_folder": ("biased", T, [E], FOLDERS),
    "biased_no_thread_folder": ("biased", None, [E], FOLDERS),
    "biased_no_folders_at_all": ("biased", None, [], FOLDERS),
    "biased_expert_folder_inside_thread_subtree": ("biased", T, [T1], FOLDERS),
    "expert_folder_invisible": ("restricted", None, ["ghost"], FOLDERS),
    "biased_thread_folder_invisible": ("biased", "ghost-thread", [E], FOLDERS),
    "no_visible_folders": ("biased", T, [E], []),
}


def _new(scope_mode, thread_folder_id, expert_folder_ids, folders) -> ExpertScope:
    return compose_expert_scope(
        scope_mode=scope_mode,
        thread_folder_id=thread_folder_id,
        expert_folder_ids=list(expert_folder_ids),
        visible_folders=folders,
    )


@pytest.mark.parametrize("name", sorted(CASES))
def test_compose_is_byte_identical_to_the_base_branch(name):
    mode, thread_folder, expert_folders, folders = CASES[name]
    legacy = _legacy_compose(mode, thread_folder, list(expert_folders), folders)
    scope = _new(mode, thread_folder, expert_folders, folders)
    assert (scope.effective_folder_ids, scope.scoped_folder_path) == legacy


def test_restricted_with_thread_folder_reads_only_the_expert_folders():
    scope = _new("restricted", T, [E], FOLDERS)
    assert scope.effective_folder_ids == (E,)
    assert scope.scoped_folder_path == "/HR Policies"


def test_restricted_zero_folders_is_empty_and_never_raises():
    """``ExpertScopeUnavailable`` stays in run_producer — the pure function never raises."""
    scope = _new("restricted", T, [], FOLDERS)
    assert scope.effective_folder_ids == ()
    assert scope.scoped_folder_path is None


def test_biased_with_thread_folder_is_subtree_union_expert_set():
    scope = _new("biased", T, [E], FOLDERS)
    assert scope.effective_folder_ids == tuple(sorted({T, T1, T2, T1A, E}))
    assert scope.scoped_folder_path == "/Clients"


def test_biased_with_no_thread_folder_narrows_to_the_expert_folders_CHARACTERIZATION():
    """⚠ CHARACTERIZATION PIN of shipped behaviour (D-267-35), not an endorsement of it.

    A BIASED Expert on a thread with NO folder narrows retrieval to the Expert's folders only —
    "biased" reads as a filter here, not a boost. Kept by operator ruling D-267-35 (266's live
    proof depends on the focus) and STATED to the user as ``Dropped: All your documents``.
    Routed to SEED-303 as an open arm. A change here is a retrieval change, not a refactor.
    """
    scope = _new("biased", None, [E], FOLDERS)
    assert scope.effective_folder_ids == (E,)
    assert scope.scoped_folder_path == "/HR Policies"
    assert scope.excluded_folder_ids == ()


def test_an_expert_folder_absent_from_visible_folders_has_no_path():
    scope = _new("restricted", None, ["ghost"], FOLDERS)
    assert scope.effective_folder_ids == ("ghost",)
    assert scope.scoped_folder_path is None


def test_outputs_are_sorted_tuples():
    scope = _new("restricted", T, [E2, E], FOLDERS)
    assert isinstance(scope.effective_folder_ids, tuple)
    assert list(scope.effective_folder_ids) == sorted(scope.effective_folder_ids)
    assert isinstance(scope.excluded_folder_ids, tuple)
    assert list(scope.excluded_folder_ids) == sorted(scope.excluded_folder_ids)


# ── excluded_folder_ids (the NEW output) ─────────────────────────────────────────────────────

def test_restricted_on_a_folder_scoped_thread_excludes_the_whole_thread_subtree():
    scope = _new("restricted", T, [E], FOLDERS)
    assert scope.excluded_folder_ids == tuple(sorted({T, T1, T2, T1A}))


def test_an_expert_folder_inside_the_thread_subtree_is_not_excluded():
    scope = _new("restricted", T, [T1], FOLDERS)
    assert T1 not in scope.excluded_folder_ids
    assert scope.excluded_folder_ids == tuple(sorted({T, T2, T1A}))


@pytest.mark.parametrize("thread_folder", [T, None])
def test_biased_excludes_nothing(thread_folder):
    assert _new("biased", thread_folder, [E], FOLDERS).excluded_folder_ids == ()


def test_restricted_without_a_thread_folder_excludes_nothing():
    assert _new("restricted", None, [E], FOLDERS).excluded_folder_ids == ()


def test_scope_is_frozen():
    scope = _new("restricted", T, [E], FOLDERS)
    with pytest.raises(Exception):
        scope.effective_folder_ids = ()  # type: ignore[misc]


# ── purity fences ────────────────────────────────────────────────────────────────────────────

_FORBIDDEN_IMPORT_ROOTS = ("openai", "anthropic", "litellm", "supabase", "asyncpg", "google")


def _module_tree() -> ast.Module:
    path = APP_DIR / "services" / "expert_scope.py"
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def test_module_imports_no_llm_client_no_db_client_and_not_the_loop():
    offenders: list[str] = []
    for node in ast.walk(_module_tree()):
        if isinstance(node, ast.Import):
            names = [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            names = [node.module or ""]
        else:
            continue
        for n in names:
            if n.split(".")[0] in _FORBIDDEN_IMPORT_ROOTS or n == "app.services.agent_loop":
                offenders.append(f"{node.lineno}: {n}")
    assert offenders == [], offenders


def test_compose_expert_scope_is_a_plain_function():
    fn = next(
        n
        for n in ast.walk(_module_tree())
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == "compose_expert_scope"
    )
    assert isinstance(fn, ast.FunctionDef), "compose_expert_scope must not be async — it does no I/O"
    awaits = [n for n in ast.walk(fn) if isinstance(n, ast.Await)]
    assert awaits == []


def test_compose_runs_with_no_client_in_scope():
    """Called with plain data and nothing else — no supabase, no pool, no request."""
    scope = compose_expert_scope(
        scope_mode="restricted", thread_folder_id=None, expert_folder_ids=[E], visible_folders=[]
    )
    assert scope == ExpertScope(effective_folder_ids=(E,), scoped_folder_path=None, excluded_folder_ids=())
