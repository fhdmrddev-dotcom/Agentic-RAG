"""Phase 298 (298-01, SC#2 / SC#4 server half) — every narrowed list, proven on REAL Postgres.

The subject is the user shape the phase exists for: U is a member of TWO orgs. The fixture DERIVES
the mig-106 trigger's ``LIMIT 1`` org (A) by running the trigger's own query and calls the other one
B — never assumed (Pitfall 3). A second member V of org B owns an ORG-SHARED folder there: the 296
G-4 leak arm (an org-shared folder of B must not list under A).

Seeded for U in EACH org: a folder, a Root document, an archived Root document, a draft and a
published workflow, a thread, and a run on that thread. Everything goes in with an explicit
``org_id`` so the seed is what the test says it is.

What is driven, with nothing about the read mocked — the real route handlers, called directly with a
request carrying ``X-Org-Id``, the REAL ``resolve_active_org_or_none`` (membership validated on an
RLS connection as U) and U's real GoTrue user-JWT PostgREST client (RLS enforced):

  * NON-VACUITY first: A ≠ B, and the no-header answer holds BOTH orgs' rows.
  * each list under A holds only A's rows, under B only B's, with no header today's union;
  * V's org-shared folder lists under B and NOT under A (and with no header, as today);
  * the summary total equals the documents list total under the same org (D-32);
  * a Root upload with ``X-Org-Id = B`` mints in B (D-07);
  * ``GET /org-items/elsewhere`` under A reports, for B, exactly what the B-narrowed lists return
    for U's OWN items (archived Root documents excluded, V's folder not counted);
  * the counts SQL executed as role ``anon`` returns nothing (or is refused) — no count leaks.

Handlers are called directly rather than over HTTP: auth/visibility dependencies are not this
plan's subject and the narrowing lives entirely inside the handler bodies.

Everything seeded is deleted in ``finally``. Skip-guarded on :54322 and :54321 — run with ``-rs``;
a skip is a SKIP, never a pass.
"""
from __future__ import annotations

import io
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import BackgroundTasks, Response, UploadFile
from starlette.datastructures import Headers

from app.api import documents as documents_api
from app.api import folders as folders_api
from app.api import library as library_api
from app.api import org_items as org_items_api
from app.api import threads as threads_api
from app.api import workflow_runs as runs_api
from app.api import workflows as workflows_api
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

TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"
BUCKET = "documents"


def _request(org) -> SimpleNamespace:
    headers = {"X-Org-Id": str(org)} if org else {}
    return SimpleNamespace(headers=headers, state=SimpleNamespace())


async def _seed(pool, *, uid: str, org: str, tag: str) -> dict:
    u, o = UUID(uid), UUID(org)
    folder = await pool.fetchval(
        "INSERT INTO public.folders (user_id, org_id, name) VALUES ($1, $2, $3) RETURNING id",
        u, o, f"298-{tag}-folder-{uuid4().hex[:6]}",
    )
    docs = []
    for archived in (False, True):
        docs.append(await pool.fetchval(
            "INSERT INTO public.documents (user_id, org_id, folder_id, filename, file_path, file_size,"
            " mime_type, status, archived_at) VALUES ($1, $2, NULL, $3, $4, 1, 'text/plain',"
            " 'completed', CASE WHEN $5 THEN now() ELSE NULL END) RETURNING id",
            u, o, f"298-{tag}-{'arch' if archived else 'root'}.txt",
            f"{uid}/298-{tag}-{uuid4().hex[:8]}.txt", archived,
        ))
    draft = await pool.fetchval(
        "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
        " VALUES ($1, $2, $3, $4, 'draft') RETURNING id",
        f"p298-{tag}-draft-{uuid4().hex[:8]}", f"298 {tag} draft", u, o,
    )
    published = await pool.fetchval(
        "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
        " VALUES ($1, $2, $3, $4, 'published') RETURNING id",
        f"p298-{tag}-pub-{uuid4().hex[:8]}", f"298 {tag} published", u, o,
    )
    thread = await pool.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, $3) RETURNING id",
        u, o, f"298 {tag} thread",
    )
    run = await pool.fetchval(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, org_id, user_id)"
        " VALUES ($1, $2, $3, $4) RETURNING id",
        thread, draft, o, u,
    )
    return {
        "folder": str(folder), "root_doc": str(docs[0]), "archived_doc": str(docs[1]),
        "draft": str(draft), "published": str(published), "thread": str(thread), "run": str(run),
    }


async def _cleanup(pool, uid: str | None) -> None:
    if not uid:
        return
    u = UUID(uid)
    paths = [r["name"] for r in await pool.fetch(
        "SELECT name FROM storage.objects WHERE bucket_id = $1 AND name LIKE $2", BUCKET, f"{uid}/%",
    )]
    if paths:
        try:
            _admin().storage.from_(BUCKET).remove(paths)
        except Exception:
            pass
    for sql in (
        "DELETE FROM public.workflow_runs WHERE user_id = $1",
        "DELETE FROM public.threads WHERE user_id = $1",
        "DELETE FROM public.workflow_definitions WHERE created_by = $1",
        "DELETE FROM public.documents WHERE user_id = $1",  # ingestion_jobs cascade (mig 153)
        "DELETE FROM public.folders WHERE user_id = $1",
        "DELETE FROM public.audit_log WHERE user_id = $1",
    ):
        try:
            await pool.execute(sql, u)
        except Exception:
            pass


@pytest.fixture
async def subject(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org_x = org_y = uid = v_uid = None
    try:
        org_x = await create_org(pg_pool, "298-x")
        org_y = await create_org(pg_pool, "298-y")
        uid, tok = await users.create_signed_in_user(org_x, label="p298lists")
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
            UUID(org_y), UUID(uid),
        )
        assert await memberships(pg_pool, uid) == {org_x, org_y}, "U is not in exactly two orgs"
        org_a = str(await pg_pool.fetchval(TRIGGER_ORG_SQL, UUID(uid)))  # READ, never predicted
        org_b = org_y if org_a == org_x else org_x
        v_uid, _v_tok = await users.create_signed_in_user(org_b, label="p298v")
        shared = await pg_pool.fetchval(
            "INSERT INTO public.folders (user_id, org_id, name, is_org_shared)"
            " VALUES ($1, $2, $3, true) RETURNING id",
            UUID(v_uid), UUID(org_b), f"298-shared-{uuid4().hex[:6]}",
        )
        seed_a = await _seed(pg_pool, uid=uid, org=org_a, tag="a")
        seed_b = await _seed(pg_pool, uid=uid, org=org_b, tag="b")
        yield {
            "uid": uid, "tok": tok, "org_a": org_a, "org_b": org_b, "v_uid": v_uid,
            "shared_b": str(shared), "a": seed_a, "b": seed_b,
        }
    finally:
        await _cleanup(pg_pool, uid)
        await _cleanup(pg_pool, v_uid)
        await users.drop_all()
        await drop_org(pg_pool, org_x)
        await drop_org(pg_pool, org_y)


def _user(s) -> dict:
    return {"id": s["uid"]}


async def _folders(s, org):
    rows = await folders_api.list_folders(
        request=_request(org), current_user=_user(s), supabase=user_client(s["tok"])
    )
    return {str(r["id"]) for r in rows}


async def _documents(s, org, *, folder_id="root", include_archived=False):
    page = await documents_api.list_documents(
        limit=200, offset=0, folder_id=folder_id, include_archived=include_archived, status_=None,
        order="created_desc", kind=None, current_user=_user(s), supabase=user_client(s["tok"]),
        request=_request(org),
    )
    return {str(d["id"]) for d in page["documents"]}, page["total"]


async def _published(s, org):
    rows = await workflows_api.get_published_workflows(
        project_folder_id=None, scope=None, request=_request(org), current_user=_user(s)
    )
    return {str(r.id) for r in rows}


async def _drafts(s, org):
    rows = await workflows_api.list_drafts(request=_request(org), current_user=_user(s))
    return {str(r.id) for r in rows}


async def _threads(s, org):
    rows = await threads_api.list_threads(
        request=_request(org), current_user=_user(s), supabase=user_client(s["tok"])
    )
    return {str(r["id"]) for r in rows}


async def _runs(s, org):
    page = await runs_api.list_workflow_runs(
        slug=None, limit=200, offset=0, request=_request(org), current_user=_user(s),
        supabase=user_client(s["tok"]),
    )
    return {str(r.id) for r in page.runs}


async def test_non_vacuity_two_orgs_and_the_union_without_a_header(pg_pool, subject):
    s = subject
    assert s["org_a"] != s["org_b"]
    assert str(await pg_pool.fetchval(TRIGGER_ORG_SQL, UUID(s["uid"]))) == s["org_a"]
    # Today's answer with no header holds BOTH orgs' rows (and V's shared folder) — so the
    # narrowed answers below are the header's doing, not an empty seed.
    assert {s["a"]["folder"], s["b"]["folder"], s["shared_b"]} <= await _folders(s, None)
    docs, _ = await _documents(s, None)
    assert {s["a"]["root_doc"], s["b"]["root_doc"]} <= docs
    assert {s["a"]["published"], s["b"]["published"]} <= await _published(s, None)
    assert {s["a"]["draft"], s["b"]["draft"]} <= await _drafts(s, None)
    assert {s["a"]["thread"], s["b"]["thread"]} <= await _threads(s, None)
    assert {s["a"]["run"], s["b"]["run"]} <= await _runs(s, None)


@pytest.mark.parametrize("here,there", [("a", "b"), ("b", "a")])
async def test_each_list_holds_only_the_active_orgs_rows(pg_pool, subject, here, there):
    s = subject
    org = s[f"org_{here}"]
    mine, theirs = s[here], s[there]

    folders = await _folders(s, org)
    assert mine["folder"] in folders and theirs["folder"] not in folders

    docs, _ = await _documents(s, org)
    assert mine["root_doc"] in docs and theirs["root_doc"] not in docs
    assert mine["archived_doc"] not in docs  # the list default hides archived

    published = await _published(s, org)
    assert mine["published"] in published and theirs["published"] not in published
    drafts = await _drafts(s, org)
    assert mine["draft"] in drafts and theirs["draft"] not in drafts
    threads = await _threads(s, org)
    assert mine["thread"] in threads and theirs["thread"] not in threads
    runs = await _runs(s, org)
    assert mine["run"] in runs and theirs["run"] not in runs


async def test_system_globals_stay_in_the_published_feed_for_every_org(pg_pool, subject):
    s = subject
    globals_ = {str(r["id"]) for r in await pg_pool.fetch(
        "SELECT id FROM public.workflow_definitions WHERE is_system_global AND status = 'published'"
    )}
    if not globals_:
        pytest.skip("no published system-global workflow in this database — arm not exercisable")
    for org in (s["org_a"], s["org_b"], None):
        assert globals_ <= await _published(s, org)


async def test_an_org_shared_folder_of_b_lists_under_b_and_not_under_a(pg_pool, subject):
    """The 296 G-4 leak arm: restrict_org_ids narrows the org-shared arm too."""
    s = subject
    assert s["shared_b"] in await _folders(s, s["org_b"])
    assert s["shared_b"] not in await _folders(s, s["org_a"])
    children_a = await folders_api.list_children(
        folder_id=s["shared_b"], request=_request(s["org_a"]), current_user=_user(s),
        supabase=user_client(s["tok"]),
    )
    assert children_a == []


async def test_a_non_member_header_is_todays_answer(pg_pool, subject):
    s = subject
    stranger = str(uuid4())
    assert await _folders(s, stranger) == await _folders(s, None)
    assert await _threads(s, stranger) == await _threads(s, None)


async def test_the_summary_agrees_with_the_documents_list_under_each_org(pg_pool, subject):
    s = subject
    for org in (s["org_a"], s["org_b"], None):
        summary = await library_api.get_library_summary(_request(org), _user(s))
        _ids, total = await _documents(s, org, folder_id=None, include_archived=True)
        assert summary.total == total, f"org {org}: summary {summary.total} != list {total}"
    a = await library_api.get_library_summary(_request(s["org_a"]), _user(s))
    both = await library_api.get_library_summary(_request(None), _user(s))
    assert 0 < a.total < both.total


async def test_a_root_upload_mints_in_the_active_org(pg_pool, subject):
    s = subject
    raw = f"phase-298 root upload {uuid4().hex}".encode()
    body = await documents_api.upload_document(
        response=Response(), background_tasks=BackgroundTasks(),
        file=UploadFile(file=io.BytesIO(raw), filename="298-root.txt",
                        headers=Headers({"content-type": "text/plain"})),
        folder_id=None, engines=None, current_user=_user(s), supabase=user_client(s["tok"]),
        service_supabase=_admin(), request=_request(s["org_b"]),
    )
    org = await pg_pool.fetchval("SELECT org_id FROM public.documents WHERE id = $1", UUID(str(body["id"])))
    assert str(org) == s["org_b"], f"Root upload landed in {org}, expected B (trigger's A = {s['org_a']})"
    docs, _ = await _documents(s, s["org_b"])
    assert str(body["id"]) in docs


async def test_elsewhere_under_a_reports_bs_own_items_as_the_b_lists_return_them(pg_pool, subject):
    s = subject
    out = await org_items_api.get_elsewhere_counts(request=_request(s["org_a"]), current_user=_user(s))
    rows = {o.org_id: o for o in out.orgs}
    assert set(rows) == {s["org_b"]}, f"elsewhere named {set(rows)}; only B is another member org"
    b = rows[s["org_b"]]
    uid = s["uid"]

    own_folders = [
        f for f in await folders_api.list_folders(
            request=_request(s["org_b"]), current_user=_user(s), supabase=user_client(s["tok"])
        ) if str(f["user_id"]) == uid
    ]
    page = await documents_api.list_documents(
        limit=200, offset=0, folder_id="root", include_archived=False, status_=None,
        order="created_desc", kind=None, current_user=_user(s), supabase=user_client(s["tok"]),
        request=_request(s["org_b"]),
    )
    own_root = [d for d in page["documents"] if str(d["user_id"]) == uid]
    workflows = (await _published(s, s["org_b"]) | await _drafts(s, s["org_b"])) - {
        str(r["id"]) for r in await pg_pool.fetch(
            "SELECT id FROM public.workflow_definitions WHERE is_system_global"
        )
    }
    assert (b.folders, b.root_documents, b.workflows, b.threads, b.runs) == (
        len(own_folders), len(own_root), len(workflows),
        len(await _threads(s, s["org_b"])), len(await _runs(s, s["org_b"])),
    )
    # and the seed, stated plainly: V's shared folder and the archived document are not counted
    assert (b.folders, b.root_documents, b.workflows, b.threads, b.runs) == (1, 1, 2, 1, 1)
    assert b.org_name.startswith("phase-271-298-")


async def test_elsewhere_without_a_header_is_empty(pg_pool, subject):
    out = await org_items_api.get_elsewhere_counts(request=_request(None), current_user=_user(subject))
    assert out.orgs == []


async def test_the_counts_sql_as_anon_leaks_nothing(pg_pool, subject):
    """D-22 / BUG-260911-01 class: the counts SQL run as ``anon`` (rolled back)."""
    import asyncpg

    async with pg_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute("SET LOCAL ROLE anon")
            try:
                rows = await conn.fetch(org_items_api.ELSEWHERE_SQL, UUID(subject["org_a"]))
            except asyncpg.exceptions.InsufficientPrivilegeError:
                rows = []
            assert rows == [], f"anon read {len(rows)} org rows"
        finally:
            await tx.rollback()
