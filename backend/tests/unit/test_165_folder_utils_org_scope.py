"""SEED-124 / D-165-04 + D-165-05 — org-scoped, fail-closed folder-visibility helpers (PURE unit).

The agent's KB browse/read tools (``ls`` / ``tree`` / ``read_document`` / ``fetch_document_file``)
run in the producer on the BYPASSRLS **service-role** client, so RLS never scopes them — the org
gate MUST live in ``folder_utils.py``. This proves, with a no-DB fake supabase (in-memory folders +
org_members), that:

  (a) CR-01 — a caller in a DISJOINT org does NOT see another org's ``is_org_shared`` folder;
  (b) a same-org member (and the owner) DO see the shared folder + its non-shared descendants;
  (c) fail-closed — a caller with NO org membership sees 0 shared folders (over-restrict);
  (d) ``is_in_global_subtree`` treats a folder as shared-visible only when the ``is_org_shared``
      ancestor's ``org_id`` is in the caller's org set;
  (WR-01, D-165-05) — the seeding owner ``user_id`` is nulled on the shared row AND its non-shared
      descendants for a non-owner reader.

No live DB — the helpers' ``aexec`` seam bottoms out at ``.execute()`` on the fake below. The live
two-org arbiter is ``test_v3_4_org_isolation.py::test_browse_tools_cross_org_leak_...`` (flipped in
plan 165-08). These helpers keep their ``(supabase, user_id)`` positional signatures — the exit-gate
test drives them as-is; org resolution happens INSIDE from ``user_id``.
"""

import copy

import pytest

from app.utils.folder_utils import (
    _null_foreign_global_owner,
    _resolve_caller_org_ids,
    fetch_visible_folders,
    get_globally_visible_folder_ids,
    is_in_global_subtree,
)

# ── Two disjoint orgs ───────────────────────────────────────────────────────────
# A owns a shared folder in org X with a NON-shared descendant; B is alone in org Y;
# C is a second (non-owner) member of org X; Z has no org membership at all.
ORG_X = "org-x"
ORG_Y = "org-y"
USER_A = "user-a"  # owner/seeder of the shared subtree (org X)
USER_B = "user-b"  # disjoint org Y — the CR-01 leak victim/attacker
USER_C = "user-c"  # second member of org X — SHOULD see A's shared subtree
USER_Z = "user-z"  # no org membership — fail-closed control

# f1 = A's org-shared root; f2 = A's NON-shared descendant of f1; f3 = B's private folder.
FOLDERS = [
    {"id": "f1", "user_id": USER_A, "parent_id": None, "is_org_shared": True, "org_id": ORG_X},
    {"id": "f2", "user_id": USER_A, "parent_id": "f1", "is_org_shared": False, "org_id": ORG_X},
    {"id": "f3", "user_id": USER_B, "parent_id": None, "is_org_shared": False, "org_id": ORG_Y},
]

ORG_MEMBERS = [
    {"user_id": USER_A, "org_id": ORG_X},
    {"user_id": USER_B, "org_id": ORG_Y},
    {"user_id": USER_C, "org_id": ORG_X},
]


# ── no-DB fake supabase client (folders + org_members tables) ────────────────────
class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, rows):
        self._rows = rows
        self._eqs: list[tuple] = []

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._eqs.append((col, val))
        return self

    def execute(self):
        rows = self._rows
        for col, val in self._eqs:
            rows = [r for r in rows if str(r.get(col)) == str(val)]
        # Deep-copy so code under test mutates its own copy, never the fixture rows.
        return _Result(copy.deepcopy(rows))


class _FakeSupabase:
    def __init__(self, folders, org_members):
        self._t = {"folders": folders, "org_members": org_members}

    def table(self, name):
        return _Query(list(self._t.get(name, [])))


def _sb(folders=None, org_members=None) -> _FakeSupabase:
    return _FakeSupabase(FOLDERS if folders is None else folders,
                         ORG_MEMBERS if org_members is None else org_members)


# ── (a) CR-01 — disjoint-org caller excludes the shared folder + subtree ─────────
@pytest.mark.asyncio
async def test_disjoint_org_caller_excludes_shared_folder():
    ids = set(await get_globally_visible_folder_ids(_sb(), USER_B))
    assert "f1" not in ids, "CR-01: user B (org Y) must NOT see user A's (org X) is_org_shared folder"
    assert "f2" not in ids, "CR-01: nor the non-shared descendant reached via A's shared ancestor"
    assert ids == set()


# ── (b)+(d) — same-org member sees the shared folder AND its non-shared descendant ─
@pytest.mark.asyncio
async def test_same_org_member_sees_shared_subtree():
    ids = set(await get_globally_visible_folder_ids(_sb(), USER_C))
    assert ids == {"f1", "f2"}, "same-org non-owner sees the shared root + its subtree descendant"


# ── (b) positive control — the owner still sees their own shared subtree ─────────
@pytest.mark.asyncio
async def test_owner_sees_own_shared_subtree():
    visible = {f["id"] for f in await fetch_visible_folders(_sb(), USER_A)}
    assert {"f1", "f2"} <= visible, "owner A retains visibility of their own shared subtree"
    assert "f3" not in visible, "owner A does not gain B's disjoint-org private folder"
    # get_globally_visible_folder_ids reports NON-owned shared folders — owned rows are excluded.
    assert set(await get_globally_visible_folder_ids(_sb(), USER_A)) == set()


# ── (c) fail-closed — a caller with no resolvable org set sees 0 shared folders ───
@pytest.mark.asyncio
async def test_empty_org_set_sees_zero_shared():
    assert await _resolve_caller_org_ids(_sb(), USER_Z) == set()
    assert set(await get_globally_visible_folder_ids(_sb(), USER_Z)) == set()
    visible = {f["id"] for f in await fetch_visible_folders(_sb(), USER_Z)}
    assert visible == set(), "fail-closed: no org membership -> over-restrict, never over-share"


# ── (d) direct — is_in_global_subtree honors org_id membership on the shared ancestor ─
def test_is_in_global_subtree_honors_org_membership():
    folder_map = {f["id"]: f for f in FOLDERS}
    assert is_in_global_subtree("f1", folder_map, {}, {ORG_X}) is True
    assert is_in_global_subtree("f2", folder_map, {}, {ORG_X}) is True   # descendant of shared f1
    assert is_in_global_subtree("f1", folder_map, {}, {ORG_Y}) is False  # ancestor in wrong org
    assert is_in_global_subtree("f2", folder_map, {}, {ORG_Y}) is False
    assert is_in_global_subtree("f1", folder_map, {}, set()) is False    # fail-closed (no org)


@pytest.mark.asyncio
async def test_resolve_caller_org_ids_returns_membership_set():
    assert await _resolve_caller_org_ids(_sb(), USER_A) == {ORG_X}


# ── (WR-01, D-165-05) — owner-nulling broadens to non-shared subtree descendants ──
def test_null_foreign_owner_broadens_to_subtree_descendants():
    """A non-owner reader of a shared subtree sees user_id == null on the shared row AND on its
    non-shared descendant (the id set from get_globally_visible_folder_ids carries descendants)."""
    rows = copy.deepcopy(FOLDERS)
    non_owned_visible = {"f1", "f2"}  # what get_globally_visible_folder_ids returns for USER_C
    out = _null_foreign_global_owner(rows, USER_C, non_owned_visible)
    by_id = {r["id"]: r for r in out}
    assert by_id["f1"]["user_id"] is None    # org-shared row, non-owned -> nulled
    assert by_id["f2"]["user_id"] is None    # NON-shared descendant, non-owned -> nulled (WR-01)
    assert by_id["f3"]["user_id"] == USER_B  # B's private, not in the visible set -> untouched

    hidden = {r["id"] for r in out if r["user_id"] is None}
    visible = {r["id"] for r in out if r["user_id"] is not None}
    assert hidden == {"f1", "f2"}
    assert hidden.isdisjoint(visible)


def test_null_foreign_owner_without_set_keeps_shared_row_only_rule():
    """Skills / views callers pass NO visible set: only is_org_shared/is_system rows get nulled —
    the original (pre-WR-01) behavior is preserved for the no-subtree callers."""
    rows = copy.deepcopy(FOLDERS)
    out = _null_foreign_global_owner(rows, USER_C)  # no visible_non_owned_ids
    by_id = {r["id"]: r for r in out}
    assert by_id["f1"]["user_id"] is None     # is_org_shared, non-owner -> nulled
    assert by_id["f2"]["user_id"] == USER_A   # non-shared descendant NOT nulled without the set
    assert by_id["f3"]["user_id"] == USER_B   # untouched
