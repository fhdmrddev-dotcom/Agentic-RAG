"""Phase 267 (D-267-17 / PACK-25) — the ONE composition of an Expert's knowledge scope.

Two readers depend on this module, and that is the whole point of it existing:

* the RUN — ``run_producer._resolve_thread_scoping`` hands ``effective_folder_ids`` and
  ``scoped_folder_path`` to the loop as data;
* the STATEMENT — the invite-dialog preview and the transcript event (267-02) tell the user which
  folders the Expert reads and which it will NOT read (``excluded_folder_ids``).

Because both read one function, the sentence a user is shown and the retrieval the run performs
cannot disagree. ⛔ Never re-derive a scope anywhere else; import this.

``compose_expert_scope`` is PURE: plain data in, a frozen value out. It performs no I/O, imports no
database or LLM client, and never raises. ``ExpertScopeUnavailable`` (a restricted Expert with zero
folders — 266 CR-01) stays in ``run_producer``, which is the caller that must refuse the run.

The body was MOVED byte-for-byte from ``run_producer.py:480-516`` (phase base ``785c03274``);
``tests/unit/test_267_expert_scope.py`` keeps a verbatim copy of the old branch and compares every
case against it.

⚠ MEASURED CHARACTERIZATION, MOVED UNCHANGED (D-267-35): a **BIASED** Expert on a thread with
**NO folder** narrows retrieval to the Expert's folders only — "biased" behaves as a filter there,
not a boost. This module preserves that exactly. It is stated to the user as
``Dropped: All your documents`` and routed to SEED-303 as an open arm (re-open trigger: the first
phase that gives "biased" real ranking semantics, after the SEED-224 retrieval extraction).

Plan 267-02 adds the one async helper that STATES a scope beside this function, so the run and the
statement share one module; the pure function stays separately testable.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExpertScope:
    """The composed scope. Every tuple is sorted.

    ``excluded_folder_ids`` is the thread-folder subtree minus the Expert's folders, and is
    non-empty ONLY for a ``restricted`` Expert on a folder-scoped thread; ``()`` otherwise.
    """

    effective_folder_ids: tuple[str, ...]
    scoped_folder_path: str | None
    excluded_folder_ids: tuple[str, ...]


def compose_expert_scope(
    *,
    scope_mode: str,
    thread_folder_id: str | None,
    expert_folder_ids: list[str],
    visible_folders: list[dict],
) -> ExpertScope:
    """Compose an Expert's knowledge scope from plain data. Pure; never raises; no I/O.

    ``visible_folders`` is ``fetch_visible_folders(...)``'s result — the caller fetches it, so the
    SEED-124 visibility rule keeps its one home.

    - ``restricted``: the Expert's folders only. On a folder-scoped thread, the thread subtree
      minus the Expert's folders is reported as ``excluded_folder_ids``.
    - ``biased`` + a thread folder: the thread subtree ∪ the Expert's folders.
    - ``biased`` + no thread folder: the Expert's folders only (characterization, D-267-35).
    """
    all_folders = visible_folders
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
    excluded_folder_ids: tuple[str, ...] = ()

    if scope_mode == "restricted":
        # Strict isolation (S5 / D-v4.3-01): exclusive to expert folders
        effective_folder_ids = tuple(sorted(set(expert_folder_ids)))
        if expert_folder_ids:
            scoped_folder_path = _get_path(expert_folder_ids[0]) or None
        if thread_folder_id:
            # D-267-17: what the thread's own folder would have given retrieval, and this
            # Expert will not read. Only ever a statement — the run above already reads
            # effective_folder_ids alone.
            excluded_folder_ids = tuple(
                sorted(set(_get_subtree(str(thread_folder_id))) - set(expert_folder_ids))
            )
    else:
        # Union Scope (default, S4 / D-v4.3-01): thread folder + expert folders
        if thread_folder_id:
            thread_subfolder_ids = _get_subtree(str(thread_folder_id))
            effective_folder_ids = tuple(sorted(set(thread_subfolder_ids).union(expert_folder_ids)))
            scoped_folder_path = _get_path(str(thread_folder_id)) or None
        else:
            effective_folder_ids = tuple(sorted(set(expert_folder_ids)))
            if expert_folder_ids:
                scoped_folder_path = _get_path(expert_folder_ids[0]) or None

    return ExpertScope(
        effective_folder_ids=effective_folder_ids,
        scoped_folder_path=scoped_folder_path,
        excluded_folder_ids=excluded_folder_ids,
    )
