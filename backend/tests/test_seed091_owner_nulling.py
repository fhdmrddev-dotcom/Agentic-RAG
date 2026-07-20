"""SEED-091 / D-164-05 (TEN-06) — owner-identity nulling on shared rows (PURE unit test).

Proves the serialize-time contract that closes SEED-091: a global / org-shared resource
(folder / skill / view) MUST null the seeding owner's ``user_id`` (and, for views, the
``folder_scope`` scope UUID) for a NON-owner reader — uniformly across all three surfaces.
RLS gates *rows*, not *columns*, so this is a projection concern proven at the Python seam,
not the DB (no live DB here — the three real serialize paths run against a no-DB fake client).

Coverage per surface (folders / skills / views):
  (a) non-owner reader of a global/system row -> ``user_id is None``
  (b) owner reader                            -> own ``user_id`` intact
  (c) non-global (private) row                -> untouched
  (d) views only                              -> ``folder_scope is None`` on the global non-owner read
Disjoint-set assertion style (the nulled row's id is in the "hidden-owner" set, the owner's is not),
mirroring tests/integration/test_115_tool_global_leak.py:258-274.

Frontend UI-contract (A5): ``frontend/src/types/index.ts`` — both ``Folder.user_id`` and
``Skill.user_id`` are currently the HARD-REQUIRED ``string`` (index.ts:451 / :495). The backend
now emits ``null`` for non-owner readers, so those two types are FLAGGED (see the flagging test
below + the plan SUMMARY "Frontend follow-up") to be loosened to ``string | null``. This plan is
backend-only ("no UI build") — a null owner is inert for the owner-gated ``user_id === me.id``
affordance checks, so the flag is a forward follow-up, not a blocker.
"""

import copy
import re
import warnings
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.api.skills import list_skills
from app.services.document_view_service import list_views
from app.utils.folder_utils import _null_foreign_global_owner

# Two disjoint principals: OWNER seeds the shared rows; CALLER is the non-owner reader.
OWNER = "11111111-1111-1111-1111-111111111111"
CALLER = "22222222-2222-2222-2222-222222222222"


# ── no-DB fake supabase client ──────────────────────────────────────────────────
# Both list_skills (sync .execute()) and list_views (aexec -> run_in_threadpool(.execute))
# bottom out at a sync .execute() returning an object with .data — so ONE fake serves both.
class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *a, **k):
        return self

    def or_(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def execute(self):
        # Deep-copy so the code under test mutates its own copy, never the fixture rows.
        return SimpleNamespace(data=copy.deepcopy(self._rows))


class _FakeSupabase:
    def __init__(self, rows):
        self._rows = rows

    def table(self, _name):
        return _FakeQuery(self._rows)


# ── FOLDERS (the shared helper IS the folder serialize seam) ─────────────────────
def test_folders_null_foreign_global_owner():
    # Phase 165 (D-165-01): folders.is_global RENAMED -> is_org_shared; _null_foreign_global_owner's
    # predicate now reads is_org_shared (is_system branch unchanged). Rows updated in-place to match.
    rows = [
        {"id": "f-foreign-global", "user_id": OWNER, "is_org_shared": True},   # (a) shared, not owned
        {"id": "f-foreign-private", "user_id": OWNER, "is_org_shared": False}, # (c) non-shared -> untouched
        {"id": "f-own-global", "user_id": CALLER, "is_org_shared": True},      # (b) owner of a shared row
        {"id": "f-own-private", "user_id": CALLER, "is_org_shared": False},    # owner private -> untouched
    ]
    out = _null_foreign_global_owner(rows, CALLER)
    by_id = {r["id"]: r for r in out}

    assert by_id["f-foreign-global"]["user_id"] is None          # (a)
    assert by_id["f-own-global"]["user_id"] == CALLER            # (b)
    assert by_id["f-foreign-private"]["user_id"] == OWNER        # (c) rule fires only on global/system
    assert by_id["f-own-private"]["user_id"] == CALLER

    hidden = {r["id"] for r in out if r["user_id"] is None}
    visible = {r["id"] for r in out if r["user_id"] is not None}
    assert hidden == {"f-foreign-global"}
    assert hidden.isdisjoint(visible)


# ── SKILLS (drive the REAL list_skills endpoint over the no-DB fake) ─────────────
@pytest.mark.asyncio
async def test_skills_list_nulls_foreign_global_and_system_owner():
    rows = [
        {"id": "s-foreign-global", "user_id": OWNER, "name": "g", "is_global": True, "is_system": False},
        {"id": "s-foreign-system", "user_id": OWNER, "name": "sys", "is_global": False, "is_system": True},
        {"id": "s-own-global", "user_id": CALLER, "name": "og", "is_global": True, "is_system": False},
        {"id": "s-own-private", "user_id": CALLER, "name": "op", "is_global": False, "is_system": False},
    ]
    out = await list_skills(current_user={"id": CALLER}, supabase=_FakeSupabase(rows))
    by_id = {r["id"]: r for r in out}

    assert by_id["s-foreign-global"]["user_id"] is None          # (a) is_global, non-owner
    assert by_id["s-foreign-system"]["user_id"] is None          # is_system, non-owner (mig-109 surface)
    assert by_id["s-own-global"]["user_id"] == CALLER            # (b) owner of a global row
    assert by_id["s-own-private"]["user_id"] == CALLER           # (c) non-global -> untouched

    hidden = {r["id"] for r in out if r["user_id"] is None}
    visible = {r["id"] for r in out if r["user_id"] is not None}
    assert hidden == {"s-foreign-global", "s-foreign-system"}
    assert hidden.isdisjoint(visible)


@pytest.mark.asyncio
async def test_skills_owner_keeps_own_identity_on_global_and_system():
    """The seeding OWNER reading their OWN global/system skills still sees their user_id."""
    rows = [
        {"id": "s-global", "user_id": OWNER, "name": "g", "is_global": True, "is_system": False},
        {"id": "s-system", "user_id": OWNER, "name": "sys", "is_global": False, "is_system": True},
    ]
    out = await list_skills(current_user={"id": OWNER}, supabase=_FakeSupabase(rows))
    by_id = {r["id"]: r for r in out}

    assert by_id["s-global"]["user_id"] == OWNER
    assert by_id["s-system"]["user_id"] == OWNER
    assert all(r["user_id"] is not None for r in out)


# ── VIEWS (drive the REAL list_views service; folder_scope also nulled) ──────────
@pytest.mark.asyncio
async def test_views_list_nulls_user_id_and_folder_scope_for_non_owner():
    scope_foreign = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    scope_own = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    scope_owng = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    rows = [
        {"id": "v-foreign-global", "user_id": OWNER, "name": "fg",
         "filter_expr": {}, "folder_scope": scope_foreign, "is_global": True},
        {"id": "v-own-private", "user_id": CALLER, "name": "op",
         "filter_expr": {}, "folder_scope": scope_own, "is_global": False},
        {"id": "v-own-global", "user_id": CALLER, "name": "og",
         "filter_expr": {}, "folder_scope": scope_owng, "is_global": True},
    ]
    out = await list_views(CALLER, supabase=_FakeSupabase(rows))
    by_id = {r["id"]: r for r in out}

    # (a) + (d) non-owner reader of a global view -> user_id None AND folder_scope None
    assert by_id["v-foreign-global"]["user_id"] is None
    assert by_id["v-foreign-global"]["folder_scope"] is None
    # (b) owner reader -> own user_id + folder_scope intact
    assert by_id["v-own-global"]["user_id"] == CALLER
    assert by_id["v-own-global"]["folder_scope"] == scope_owng
    # (c) non-global row -> untouched
    assert by_id["v-own-private"]["user_id"] == CALLER
    assert by_id["v-own-private"]["folder_scope"] == scope_own

    hidden = {r["id"] for r in out if r["user_id"] is None}
    visible = {r["id"] for r in out if r["user_id"] is not None}
    assert hidden == {"v-foreign-global"}
    assert hidden.isdisjoint(visible)


@pytest.mark.asyncio
async def test_views_owner_read_keeps_scope():
    """OWNER reading their OWN global view keeps both user_id and folder_scope."""
    scope = "dddddddd-dddd-dddd-dddd-dddddddddddd"
    rows = [{"id": "v-own", "user_id": OWNER, "name": "og",
             "filter_expr": {}, "folder_scope": scope, "is_global": True}]
    out = await list_views(OWNER, supabase=_FakeSupabase(rows))
    assert out[0]["user_id"] == OWNER
    assert out[0]["folder_scope"] == scope


# ── FRONTEND UI-CONTRACT CHECK (A5) — locate + FLAG, do not silently pass ─────────
def test_frontend_owner_field_located_and_flagged():
    """Locate the folder + skill owner field in the frontend TS types and FLAG a
    hard-required (non-null) type. No frontend edit in this plan ("no UI build") — the
    finding is recorded here + in the SUMMARY as a forward follow-up (loosen to
    ``string | null``). Owner-gated affordances branch on ownership, so a null non-owned
    owner is inert for ``===`` checks; a ``.user_id`` method access would throw."""
    types_file = Path(__file__).resolve().parents[2] / "frontend" / "src" / "types" / "index.ts"
    assert types_file.exists(), f"frontend types file not found at {types_file}"
    text = types_file.read_text(encoding="utf-8")

    def _owner_type(interface_name: str) -> str:
        decl = f"export interface {interface_name} {{"
        idx = text.find(decl)
        assert idx != -1, f"interface {interface_name} not located in {types_file}"
        window = text[idx: idx + 400]  # user_id is the 2nd field of both interfaces
        m = re.search(r"\n\s*user_id\s*:\s*([^\n/;]+)", window)
        assert m, f"{interface_name}.user_id owner field not located"
        return m.group(1).strip()

    folder_t = _owner_type("Folder")   # located (evidence)
    skill_t = _owner_type("Skill")

    flagged = []
    for name, t in (("Folder", folder_t), ("Skill", skill_t)):
        is_nullable = "null" in t or t.endswith("?") or "?" in name  # `?:` optional or `| null`
        if not is_nullable:
            flagged.append((name, t))
            warnings.warn(
                f"SEED-091 follow-up: frontend {name}.user_id is `{t}` (hard-required non-null). "
                f"The backend now returns null for non-owner readers of global/system rows. "
                f"Loosen to `string | null` in frontend/src/types/index.ts.",
                stacklevel=2,
            )

    # The check's contract: LOCATE both owner fields (fail loudly if the type moved), then
    # FLAG hard-required ones (warning above + SUMMARY). It does NOT gate the backend green.
    assert folder_t and skill_t
    # Record the current state so a reviewer sees it explicitly (both are hard-required today).
    assert flagged == [("Folder", "string"), ("Skill", "string")], (
        "Frontend owner-field types changed — update the SEED-091 follow-up flag: "
        f"folder=`{folder_t}`, skill=`{skill_t}`"
    )
