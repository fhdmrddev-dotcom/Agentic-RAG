"""Phase 280 (D-05 / D-26, CR-01 of BUG-261005-01) — a folder files a document only into its own org.

The defect driven here: ``mint_document_row``'s folder check selected ``id, user_id`` and compared
``user_id`` only. For ``/upload`` (``org_id=None``) the document's org is then stamped by
``autofill_org_id_by_owner`` — ``SELECT org_id FROM org_members WHERE user_id = … LIMIT 1`` with NO
``ORDER BY`` — so a two-org person uploading into a folder of their OTHER org gets a document whose
``org_id`` differs from its folder's. A caller that passes ``org_id`` (import / watch shape) could
likewise file a document of org A into a folder of org B.

The subject is a fresh GoTrue user who is a member of TWO orgs (A, B) and owns a folder in each
non-default org, plus a folder in a third org C they are NOT a member of. The trigger's pick is READ,
never predicted (Pitfall 3). Every refusal must be byte-identical to a nonexistent folder's
``404 "Folder not found"`` — no existence oracle (D-05 / T-280-13).

Skip-guarded on :54322 and :54321. Everything seeded is deleted in ``finally`` and proven by SQL.
"""
from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.services.ingest_splice import async_mint_document_row
from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    _admin,
    create_org,
    drop_org,
    memberships,
    require_gotrue,
    user_client,
)
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg

EMAIL_MARK = "p280cr"
MIME = "text/plain"


async def _seed_folder(pool, *, uid: str, org_id: str, label: str) -> str:
    folder_id = uuid4()
    await pool.execute(
        "INSERT INTO public.folders (id, user_id, org_id, name) VALUES ($1, $2, $3, $4)",
        folder_id, UUID(uid), UUID(org_id), f"280-cr01-{label}-{folder_id.hex[:6]}",
    )
    got = await pool.fetchval("SELECT org_id FROM public.folders WHERE id = $1", folder_id)
    assert str(got) == org_id, "the seeded folder's org did not land"
    return str(folder_id)


@pytest.fixture
async def two_org_subject(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org_a = org_b = org_c = uid = None
    try:
        org_a = await create_org(pg_pool, "280-cr01-a")
        org_b = await create_org(pg_pool, "280-cr01-b")
        org_c = await create_org(pg_pool, "280-cr01-c")
        uid, tok = await users.create_signed_in_user(org_a, label=EMAIL_MARK)
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
            UUID(org_b), UUID(uid),
        )
        assert await memberships(pg_pool, uid) == {org_a, org_b}, "subject is not in exactly A and B"
        # The trigger's pick — READ, never predicted (Pitfall 3).
        pick = str(await pg_pool.fetchval(
            "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1", UUID(uid)
        ))
        other = org_b if pick == org_a else org_a
        yield {
            "uid": uid, "tok": tok, "pick": pick, "other": other, "org_c": org_c,
            "f_pick": await _seed_folder(pg_pool, uid=uid, org_id=pick, label="pick"),
            "f_other": await _seed_folder(pg_pool, uid=uid, org_id=other, label="other"),
            "f_nonmember": await _seed_folder(pg_pool, uid=uid, org_id=org_c, label="c"),
        }
    finally:
        if uid:
            await pg_pool.execute("DELETE FROM public.documents WHERE user_id = $1", UUID(uid))
            await pg_pool.execute("DELETE FROM public.folders WHERE user_id = $1", UUID(uid))
        await users.drop_all()
        for org in (org_a, org_b, org_c):
            await drop_org(pg_pool, org)
        if uid:
            left = await pg_pool.fetchval(
                "SELECT (SELECT count(*) FROM public.documents WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.folders WHERE user_id = $1)"
                " + (SELECT count(*) FROM auth.users WHERE id = $1)",
                UUID(uid),
            )
            assert left == 0, f"cleanup left {left} rows behind for {uid}"


def _raw(tag: str) -> bytes:
    return f"phase-280 cr-01 {tag} {uuid4().hex}".encode()


async def _mint(client, uid, *, folder_id, org_id=None, on_conflict="raise", tag="x"):
    return await async_mint_document_row(
        raw=_raw(tag), filename=f"280-cr01-{tag}-{uuid4().hex[:6]}.txt", mime_type=MIME,
        user_id=uid, supabase=client, folder_id=folder_id, org_id=org_id, on_conflict=on_conflict,
    )


async def _refusal(coro) -> HTTPException:
    with pytest.raises(HTTPException) as exc:
        await coro
    return exc.value


async def _nonexistent_folder_refusal(client, uid) -> HTTPException:
    return await _refusal(_mint(client, uid, folder_id=str(uuid4()), tag="nofolder"))


def _same_refusal(got: HTTPException, ref: HTTPException) -> None:
    assert (got.status_code, got.detail, got.headers) == (ref.status_code, ref.detail, ref.headers), (
        f"refusal {got.status_code} {got.detail!r} is distinguishable from a nonexistent folder's "
        f"{ref.status_code} {ref.detail!r} — an existence oracle"
    )
    assert got.status_code == 404 and got.detail == "Folder not found"


async def _docs_of(pool, uid: str) -> int:
    return await pool.fetchval("SELECT count(*) FROM public.documents WHERE user_id = $1", UUID(uid))


# ---------------------------------------------------------------------------------------------


async def test_positive_control_folder_in_the_default_org_mints_there(pg_pool, two_org_subject):
    s = two_org_subject
    res = await _mint(user_client(s["tok"]), s["uid"], folder_id=s["f_pick"], tag="pick")
    org = await pg_pool.fetchval(
        "SELECT org_id FROM public.documents WHERE id = $1", UUID(str(res.document["id"]))
    )
    assert str(org) == s["pick"]


async def test_upload_into_a_folder_of_the_other_org_files_it_in_that_org(pg_pool, two_org_subject):
    """The /upload shape (user JWT, org_id=None) into a folder of the subject's NON-default org."""
    s = two_org_subject
    res = await _mint(user_client(s["tok"]), s["uid"], folder_id=s["f_other"], tag="other")
    org = await pg_pool.fetchval(
        "SELECT org_id FROM public.documents WHERE id = $1", UUID(str(res.document["id"]))
    )
    assert str(org) == s["other"], (
        f"CR-01: the document landed in org {org} while its folder is in org {s['other']} "
        f"(the trigger's LIMIT 1 pick is {s['pick']})"
    )


async def test_non_member_folder_refuses_like_a_missing_folder_user_jwt(pg_pool, two_org_subject):
    """User JWT: the folders SELECT policy already hides a non-member org's folder."""
    s = two_org_subject
    client = user_client(s["tok"])
    ref = await _nonexistent_folder_refusal(client, s["uid"])
    before = await _docs_of(pg_pool, s["uid"])
    got = await _refusal(_mint(client, s["uid"], folder_id=s["f_nonmember"], tag="c-user"))
    _same_refusal(got, ref)
    assert await _docs_of(pg_pool, s["uid"]) == before


async def test_non_member_folder_refuses_like_a_missing_folder_service_role(pg_pool, two_org_subject):
    """Service role with org_id=None: nothing but the minter stands between the folder and a
    misfiled insert (RLS is bypassed and the trigger stamps the owner's LIMIT 1 org)."""
    s = two_org_subject
    client = _admin()
    ref = await _nonexistent_folder_refusal(client, s["uid"])
    before = await _docs_of(pg_pool, s["uid"])
    got = await _refusal(_mint(client, s["uid"], folder_id=s["f_nonmember"], tag="c-svc"))
    _same_refusal(got, ref)
    assert await _docs_of(pg_pool, s["uid"]) == before


@pytest.mark.parametrize("client_kind,on_conflict", [("user", "raise"), ("service", "link")],
                         ids=["import_shape_user_jwt", "watch_shape_service_role"])
async def test_explicit_org_that_differs_from_the_folders_org_refuses(
    pg_pool, two_org_subject, client_kind, on_conflict,
):
    s = two_org_subject
    client = user_client(s["tok"]) if client_kind == "user" else _admin()
    ref = await _nonexistent_folder_refusal(client, s["uid"])
    before = await _docs_of(pg_pool, s["uid"])
    got = await _refusal(_mint(
        client, s["uid"], folder_id=s["f_other"], org_id=s["pick"], on_conflict=on_conflict,
        tag=f"mismatch-{client_kind}",
    ))
    _same_refusal(got, ref)
    assert await _docs_of(pg_pool, s["uid"]) == before
