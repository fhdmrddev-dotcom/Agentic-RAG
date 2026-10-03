"""Phase 271 (SC#5, FIND-01, P-04) — the two-org fence for ``POST /document-search``, on the REAL RLS path.

What this proves, and what it refuses to prove vacuously:

  * The ROUTE coroutine (``app.api.document_search.search``) is called with a supabase-py
    client built from the ANON key and a GoTrue-issued access token — the
    ``get_user_supabase`` shape — so the whole path runs: the Pydantic request model → the
    core → PostgREST at :54321 evaluating RLS as ``authenticated``. Never the service role
    (T-271-19).
  * Two disjoint orgs (A, B), each holding an org-shared folder with one ``is_latest``
    document whose name carries the SAME run marker, so the name condition alone can match
    either org's row and only visibility can separate them. Org B's document also has an
    OLDER version (``is_latest=false``) carrying the marker.
  * The fence SUBJECT S is a fresh user whose ONLY membership is org A — asserted from
    ``org_members`` before any search runs. A two-org subject would legitimately see both
    rows and prove nothing (the dev account is in two orgs).
  * POSITIVE CONTROL: T is a fresh NON-owner member of org B only; the SAME request returns
    B's row to T, so "0 rows" can never be the query being broken. O is B's owner, the
    control for the older-version leg (P-03: Older versions are the caller's OWN rows).
  * Every org column is written explicitly and proven to have landed (the 266 shape);
    everything seeded — users, orgs, folders, documents — is deleted in ``finally``.

Skip-guarded on :54322 (``requires_pg``) and :54321 (``require_gotrue``). A skip is a SKIP.
"""
from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.api.document_search import search
from app.models.document_search import DocumentSearchRequest
from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    memberships,
    require_gotrue,
    user_client,
)
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg

RESULT_KEYS = {"documents", "total", "older_matches", "sort", "offset", "limit"}


async def _seed_shared_doc(pool, *, org_id: str, owner_uid: str, marker: str) -> dict:
    """One org-shared folder + one latest document (+ an older version) in ``org_id``."""
    folder_id, doc_id, old_id = uuid4(), uuid4(), uuid4()
    name = f"271-fence-{marker}.md"
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) "
        "VALUES ($1, $2, $3, $4, true)",
        folder_id, UUID(owner_uid), UUID(org_id), f"271-fence-{marker}",
    )
    for did, latest, ver in ((old_id, False, 1), (doc_id, True, 2)):
        await pool.execute(
            "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, "
            "file_size, mime_type, status, is_latest, version_number) "
            "VALUES ($1, $2, $3, $4, $5, $6, 100, 'text/markdown', 'completed', $7, $8)",
            did, UUID(owner_uid), UUID(org_id), folder_id, name, f"{owner_uid}/{did}.md",
            latest, ver,
        )
    got = await pool.fetch(
        "SELECT d.org_id AS d_org, f.org_id AS f_org FROM public.documents d "
        "JOIN public.folders f ON f.id = d.folder_id WHERE d.id = ANY($1::uuid[])",
        [doc_id, old_id],
    )
    assert len(got) == 2
    assert {str(r["d_org"]) for r in got} | {str(r["f_org"]) for r in got} == {org_id}
    return {"folder_id": str(folder_id), "doc_id": str(doc_id), "old_id": str(old_id)}


async def _cleanup(pool, seeded: dict | None) -> None:
    if not seeded:
        return
    for sql, arg in (
        ("DELETE FROM public.documents WHERE id = ANY($1::uuid[])",
         [UUID(seeded["doc_id"]), UUID(seeded["old_id"])]),
        ("DELETE FROM public.folders WHERE id = $1", UUID(seeded["folder_id"])),
    ):
        try:
            await pool.execute(sql, arg)
        except Exception:
            pass


async def _find(uid: str, token: str, **body) -> dict:
    out = await search(
        body=DocumentSearchRequest(**body),
        current_user={"id": uid},
        supabase=user_client(token),
    )
    assert set(out) == RESULT_KEYS, f"unexpected response keys {sorted(out)}"
    return out


def _ids(out: dict) -> set[str]:
    ids = [str(d["id"]) for d in out["documents"]]
    assert len(ids) == len(set(ids)), "a document appeared twice"
    return set(ids)


@pytest.fixture
async def fence(pg_pool, two_orgs_two_users):
    require_gotrue()
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    marker = uuid4().hex[:10]
    users = GoTrueUsers(pg_pool)
    seeded_a = seeded_b = None
    try:
        s_uid, s_tok = await users.create_signed_in_user(a["org_id"], label="fence-s")
        t_uid, t_tok = await users.create_signed_in_user(b["org_id"], label="fence-t")
        o_uid, o_tok = await users.create_signed_in_user(b["org_id"], label="fence-o")
        seeded_a = await _seed_shared_doc(pg_pool, org_id=a["org_id"], owner_uid=a["uid"],
                                          marker=marker)
        seeded_b = await _seed_shared_doc(pg_pool, org_id=b["org_id"], owner_uid=o_uid,
                                          marker=marker)
        yield {
            "org_a": a["org_id"], "org_b": b["org_id"], "marker": marker,
            "s": (s_uid, s_tok), "t": (t_uid, t_tok), "o": (o_uid, o_tok),
            "a": seeded_a, "b": seeded_b,
        }
    finally:
        await _cleanup(pg_pool, seeded_a)
        await _cleanup(pg_pool, seeded_b)
        await users.drop_all()


async def test_subjects_are_single_org(pg_pool, fence):
    """Non-vacuity precondition, asserted from org_members: S ∈ {A}, T ∈ {B}, O ∈ {B}."""
    assert fence["org_a"] != fence["org_b"]
    assert await memberships(pg_pool, fence["s"][0]) == {fence["org_a"]}
    assert await memberships(pg_pool, fence["t"][0]) == {fence["org_b"]}
    assert await memberships(pg_pool, fence["o"][0]) == {fence["org_b"]}
    role = await pg_pool.fetchval(
        "SELECT role FROM public.org_members WHERE user_id = $1", UUID(fence["t"][0])
    )
    assert role == "member", "T must be a NON-owner member of org B"


async def test_same_request_s_sees_a_never_b_and_t_sees_b(pg_pool, fence):
    # Precondition FIRST, before any search call (a two-org S would be vacuous).
    assert await memberships(pg_pool, fence["s"][0]) == {fence["org_a"]}
    assert await memberships(pg_pool, fence["t"][0]) == {fence["org_b"]}
    body = {"name": f"271-fence-{fence['marker']}", "version": "latest"}

    s_out = await _find(*fence["s"], **body)
    t_out = await _find(*fence["t"], **body)

    s_ids, t_ids = _ids(s_out), _ids(t_out)
    a_doc, b_doc = fence["a"]["doc_id"], fence["b"]["doc_id"]
    assert b_doc not in s_ids, "LEAK: an org-A-only user found org B's document"
    assert s_ids == {a_doc}, f"S must find exactly its own org's shared row, got {s_ids}"
    assert s_out["total"] == 1
    # Positive control through the SAME request: the query is not broken.
    assert t_ids == {b_doc}, f"positive control: T must find exactly B's row, got {t_ids}"
    assert a_doc not in t_ids, "LEAK in the other direction (B sees A)"


async def test_rls_alone_fences_when_the_app_leg_is_widened(pg_pool, fence, monkeypatch):
    """The fence has TWO walls: the core's caller-scoped legs and RLS beneath them.

    Measured at 271-05: with the SERVICE-ROLE client (RLS off) S still does not see B,
    because the app legs alone exclude it — so the request above cannot, by itself, prove
    RLS. Here the app leg is WIDENED (the global-folder list is forced to name org B's
    folder) and the request still runs through S's real JWT: only RLS can stop it now.
    The plant was driven against the service-role client at 271-05 and DID return B's row
    (recorded in the SUMMARY), so this case is not vacuous.
    """
    from app.services import document_search_service as core

    assert await memberships(pg_pool, fence["s"][0]) == {fence["org_a"]}
    widened = [fence["a"]["folder_id"], fence["b"]["folder_id"]]

    async def _widened(_supabase, _uid):
        return list(widened)

    monkeypatch.setattr(core, "get_globally_visible_folder_ids", _widened)
    body = {"name": f"271-fence-{fence['marker']}", "version": "latest"}
    s_ids = _ids(await _find(*fence["s"], **body))
    t_ids = _ids(await _find(*fence["t"], **body))
    assert fence["b"]["doc_id"] not in s_ids, "LEAK: RLS did not stop a widened app leg"
    assert s_ids == {fence["a"]["doc_id"]}
    assert t_ids == {fence["b"]["doc_id"]}, "positive control under the same widening"


async def test_relationship_target_in_org_b_is_the_zero_shape_for_s(pg_pool, fence):
    """S picks org B's document as the relationship target → the SAME keys as an ordinary
    empty answer (no existence oracle). T picking the same id gets a non-error answer."""
    assert await memberships(pg_pool, fence["s"][0]) == {fence["org_a"]}
    b_doc = fence["b"]["doc_id"]
    rel = {"relationship": {"verb": "supersedes", "document_id": b_doc}}

    s_rel = await _find(*fence["s"], **rel)
    s_empty = await _find(*fence["s"], name=f"no-such-document-{uuid4().hex}")
    assert s_rel["documents"] == [] and s_rel["total"] == 0 and s_rel["older_matches"] == 0
    assert set(s_rel) == set(s_empty), "the unreadable-target answer has a different shape"
    assert {k: v for k, v in s_rel.items()} == {k: v for k, v in s_empty.items()}, (
        "the unreadable-target answer must be indistinguishable from an ordinary empty one"
    )

    t_rel = await _find(*fence["t"], **rel)  # readable for T: no error, the ordinary shape
    assert isinstance(t_rel["total"], int)


async def test_older_version_of_b_is_never_returned_to_s(pg_pool, fence):
    assert await memberships(pg_pool, fence["s"][0]) == {fence["org_a"]}
    body = {"name": f"271-fence-{fence['marker']}", "version": "older"}

    s_out = await _find(*fence["s"], **body)
    o_out = await _find(*fence["o"], **body)

    assert fence["b"]["old_id"] not in _ids(s_out), "LEAK: S got org B's older version"
    assert _ids(s_out) == set(), "S owns no older version carrying the marker"
    # Positive control: B's owner gets B's older version through the same request.
    assert _ids(o_out) == {fence["b"]["old_id"]}
    assert all(d["is_latest"] is False for d in o_out["documents"])
