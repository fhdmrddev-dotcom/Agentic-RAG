"""Phase 298-03 (ORG-06 / D-19 / D-20 / D-33 / D-35) — the org move, proven on REAL Postgres.

The subject: U is a member of TWO orgs, A (the source) and B (the target). V is a second member of
A only — the owner of the rows U does NOT own. C is an org U is not in.

What is driven, nothing about the write mocked — ``org_move.preview_move`` / ``execute_move`` on a
real asyncpg pool against :54322:

  * NON-VACUITY first: U is in exactly A and B; A ≠ B.
  * each CLEAN kind moves in one transaction — a folder subtree (its documents, every org-stamped
    child row, a both-ends relationship; the moved root becomes top-level), a Root document with
    its version family, a draft (its past runs stay) — and writes EXACTLY ONE audit row under the
    source org naming the target. A generic information_schema post-condition: for every table
    carrying both ``document_id`` and ``org_id``, no row of a moved document is left in A.
  * EACH D-33 refusal class, seeded for real: the preview names it, the execute raises 409, and
    NOTHING changed org and NO audit row was written.
  * membership both ways (403), not found / not yours (the same 404), same org / bad id (422).
  * TOCTOU: a legal hold placed between a clean preview and the execute is caught inside the
    transaction, and nothing moves.

Everything seeded is deleted in ``finally``. Skip-guarded on :54322 and :54321 — run with ``-rs``;
a skip is a SKIP, never a pass. Run under the local-DB lock (it writes the local DB).
"""
from __future__ import annotations

import json
from uuid import UUID, uuid4

import pytest

from app.services import org_move
from app.services.org_move import MoveRefused
from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    create_org,
    drop_org,
    memberships,
    require_gotrue,
)
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg

# ── seeding ──────────────────────────────────────────────────────────────────


class World:
    def __init__(self, pool, uid, vid, a, b, c):
        self.pool, self.uid, self.vid = pool, uid, vid
        self.a, self.b, self.c = a, b, c
        self.u, self.v = UUID(uid), UUID(vid)

    async def name(self, org) -> str:
        return await self.pool.fetchval("SELECT name FROM public.organizations WHERE id = $1", UUID(org))

    async def folder(self, name="Q3 Contracts", *, owner=None, org=None, parent=None, shared=False):
        return await self.pool.fetchval(
            "INSERT INTO public.folders (user_id, org_id, name, parent_id, is_org_shared)"
            " VALUES ($1, $2, $3, $4, $5) RETURNING id",
            owner or self.u, UUID(org or self.a), f"{name}", parent, shared,
        )

    async def doc(
        self, filename="MSA.pdf", *, folder=None, owner=None, org=None, status="completed",
        content_hash=None, is_latest=True, version=1, archived=False, visibility="private",
    ):
        owner = owner or self.u
        return await self.pool.fetchval(
            "INSERT INTO public.documents (user_id, org_id, folder_id, filename, file_path, file_size,"
            " mime_type, status, content_hash, is_latest, version_number, archived_at, ingest_visibility)"
            " VALUES ($1, $2, $3, $4, $5, 1, 'text/plain', $6, $7, $8, $9,"
            " CASE WHEN $10 THEN now() ELSE NULL END, $11) RETURNING id",
            owner, UUID(org or self.a), folder, filename, f"{owner}/{uuid4().hex}/{filename}",
            status, content_hash or uuid4().hex, is_latest, version, archived, visibility,
        )

    async def children(self, doc, owner=None):
        owner = owner or self.u
        await self.pool.execute(
            "INSERT INTO public.document_chunks (document_id, user_id, content, chunk_index, org_id)"
            " VALUES ($1, $2, 'x', 0, $3)", doc, owner, UUID(self.a),
        )
        await self.pool.execute(
            "INSERT INTO public.document_images (document_id, user_id, image_index, org_id)"
            " VALUES ($1, $2, 0, $3)", doc, owner, UUID(self.a),
        )
        await self.pool.execute(
            "INSERT INTO public.document_tables (document_id, user_id, table_index, org_id)"
            " VALUES ($1, $2, 0, $3)", doc, owner, UUID(self.a),
        )
        await self.pool.execute(
            "INSERT INTO public.pdf_extraction_runs (document_id, user_id, engine, org_id)"
            " VALUES ($1, $2, 'pypdf', $3)", doc, owner, UUID(self.a),
        )
        await self.pool.execute(
            "INSERT INTO public.ingestion_jobs (document_id, user_id, org_id) VALUES ($1, $2, $3)",
            doc, owner, UUID(self.a),
        )

    async def draft(self, name="Contract review", *, definition=None, status="draft", system_global=False,
                    org=None):
        return await self.pool.fetchval(
            "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status, definition,"
            " is_system_global) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
            f"p298m-{uuid4().hex[:10]}", name, self.u, UUID(org or self.a), status,
            definition if definition is not None else {"phases": []}, system_global,
        )

    async def snapshot(self) -> dict:
        """Every org stamp this suite can move, plus the audit rows — what 'nothing changed' means."""
        users = [self.u, self.v]
        rows = {}
        for label, sql in (
            ("folder", "SELECT id, org_id, parent_id FROM public.folders WHERE user_id = ANY($1::uuid[])"),
            ("doc", "SELECT id, org_id, NULL::uuid AS parent_id FROM public.documents WHERE user_id = ANY($1::uuid[])"),
            ("wf", "SELECT id, org_id, NULL::uuid AS parent_id FROM public.workflow_definitions WHERE created_by = ANY($1::uuid[])"),
            ("chunk", "SELECT id, org_id, NULL::uuid AS parent_id FROM public.document_chunks WHERE user_id = ANY($1::uuid[])"),
        ):
            for r in await self.pool.fetch(sql, users):
                rows[(label, r["id"])] = (r["org_id"], r["parent_id"])
        rows["audit"] = await self.audit_count()
        return rows

    async def audit_count(self) -> int:
        return await self.pool.fetchval(
            "SELECT count(*) FROM public.audit_log WHERE user_id = $1 AND action_type = 'org.item.move'",
            self.u,
        )

    async def org_of(self, table, row_id):
        return str(await self.pool.fetchval(f"SELECT org_id FROM public.{table} WHERE id = $1", row_id))


_ORG_TABLES_IN_DELETE_ORDER = (
    "workflow_runs", "workflow_schedules", "api_keys", "threads", "checked_queries",
    "document_views", "classification_rules", "expert_installs", "expert_bundles",
    "retention_queue", "retention_receipts", "legal_hold_documents", "legal_hold_folders",
    "connector_watch_items", "connector_watches", "connector_connections",
    "document_relationships", "document_chunks", "document_images", "document_tables",
    "pdf_extraction_runs", "ingestion_jobs", "documents", "retention_policies", "legal_holds",
    "folders", "workflow_definitions", "audit_log",
)


async def _cleanup(pool, orgs, users):
    orgs = [UUID(o) for o in orgs if o]
    users = [UUID(u) for u in users if u]
    # Holds first: a held document/folder refuses its own delete (mig 204).
    for sql in (
        "DELETE FROM public.legal_hold_documents WHERE org_id = ANY($1::uuid[])",
        "DELETE FROM public.legal_hold_folders WHERE org_id = ANY($1::uuid[])",
        "UPDATE public.legal_holds SET released_at = now() WHERE org_id = ANY($1::uuid[]) AND released_at IS NULL",
    ):
        try:
            await pool.execute(sql, orgs)
        except Exception:
            pass
    for table in _ORG_TABLES_IN_DELETE_ORDER:
        try:
            await pool.execute(f"DELETE FROM public.{table} WHERE org_id = ANY($1::uuid[])", orgs)
        except Exception:
            pass
    for sql in (
        "DELETE FROM public.workflow_runs WHERE user_id = ANY($1::uuid[])",
        "DELETE FROM public.threads WHERE user_id = ANY($1::uuid[])",
        "DELETE FROM public.workflow_definitions WHERE created_by = ANY($1::uuid[])",
        "DELETE FROM public.documents WHERE user_id = ANY($1::uuid[])",
        "DELETE FROM public.folders WHERE user_id = ANY($1::uuid[])",
        "DELETE FROM public.expert_bundles WHERE created_by = ANY($1::uuid[])",
        "DELETE FROM public.audit_log WHERE user_id = ANY($1::uuid[])",
    ):
        try:
            await pool.execute(sql, users)
        except Exception:
            pass


@pytest.fixture
async def w(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    a = b = c = uid = vid = None
    try:
        a = await create_org(pg_pool, "298m-a")
        b = await create_org(pg_pool, "298m-b")
        c = await create_org(pg_pool, "298m-c")
        uid, _tok = await users.create_signed_in_user(a, label="p298move")
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
            UUID(b), UUID(uid),
        )
        vid, _vtok = await users.create_signed_in_user(a, label="p298movev")
        assert await memberships(pg_pool, uid) == {a, b}, "U is not in exactly A and B"
        assert a != b and await memberships(pg_pool, vid) == {a}
        yield World(pg_pool, uid, vid, a, b, c)
    finally:
        await _cleanup(pg_pool, [a, b, c], [uid, vid])
        await users.drop_all()
        for org in (a, b, c):
            await drop_org(pg_pool, org)


async def _preview(w, kind, item, to=None):
    return await org_move.preview_move(w.pool, user_id=w.uid, kind=kind, item_id=str(item), to_org_id=to or w.b)


async def _execute(w, kind, item, to=None):
    return await org_move.execute_move(w.pool, user_id=w.uid, kind=kind, item_id=str(item), to_org_id=to or w.b)


async def _assert_refused(w, kind, item, fragment):
    """The preview names the refusal, the execute raises 409, and NOTHING changed."""
    before = await w.snapshot()
    preview = await _preview(w, kind, item)
    assert any(fragment in s for s in preview.refusals), preview.refusals
    with pytest.raises(MoveRefused) as e:
        await _execute(w, kind, item)
    assert e.value.status == 409, e.value.sentence
    assert await w.snapshot() == before, "a refused move changed a row or wrote a receipt"
    return preview


# ── the audit type exists (Task 1, live half) ────────────────────────────────


async def test_the_move_audit_type_inserts_inside_a_rolled_back_transaction(w):
    from app.services.audit_service import assert_action_types_synced

    await assert_action_types_synced(w.pool)
    async with w.pool.acquire() as con:
        tr = con.transaction()
        await tr.start()
        try:
            await con.execute(
                "INSERT INTO public.audit_log (user_id, action_type, metadata, org_id)"
                " VALUES ($1, 'org.item.move', '{}'::jsonb, $2)", w.u, UUID(w.a),
            )
        finally:
            await tr.rollback()
    assert await w.audit_count() == 0


# ── clean moves ──────────────────────────────────────────────────────────────


async def test_a_clean_folder_subtree_moves_in_one_audited_transaction(w):
    parent = await w.folder("Clients")  # stays in A
    root = await w.folder("Q3 Contracts", parent=parent)
    sub = await w.folder("Signed", parent=root)
    d1 = await w.doc("MSA.pdf", folder=root, is_latest=False, version=1)
    d1b = await w.doc("MSA.pdf", folder=root, version=2)
    d2 = await w.doc("NDA.pdf", folder=sub)
    for d in (d1, d1b, d2):
        await w.children(d)
    rel = await w.pool.fetchval(
        "INSERT INTO public.document_relationships (user_id, org_id, source_doc_id, target_doc_id, rel_type)"
        " VALUES ($1, $2, $3, $4, 'references') RETURNING id", w.u, UUID(w.a), d1b, d2,
    )

    preview = await _preview(w, "folder", root)
    assert preview.refusals == []
    assert (preview.counts.subfolders, preview.counts.documents, preview.counts.earlier_versions) == (1, 2, 1)
    assert preview.item_name == "Q3 Contracts"
    assert preview.from_org_name == await w.name(w.a) and preview.to_org_name == await w.name(w.b)

    await _execute(w, "folder", root)

    for f in (root, sub):
        assert await w.org_of("folders", f) == w.b
    assert await w.org_of("folders", parent) == w.a
    assert await w.pool.fetchval("SELECT parent_id FROM public.folders WHERE id = $1", root) is None
    assert await w.pool.fetchval("SELECT parent_id FROM public.folders WHERE id = $1", sub) == root
    for d in (d1, d1b, d2):
        assert await w.org_of("documents", d) == w.b
    assert await w.org_of("document_relationships", rel) == w.b
    # Generic post-condition over information_schema: no document-child row left in A.
    tables = [r["table_name"] for r in await w.pool.fetch(
        "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'document_id'"
        " INTERSECT SELECT table_name FROM information_schema.columns WHERE table_schema = 'public'"
        " AND column_name = 'org_id' INTERSECT SELECT table_name FROM information_schema.tables"
        " WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    )]
    assert set(org_move.DOCUMENT_CHILD_TABLES) <= set(tables)
    for t in tables:
        left = await w.pool.fetchval(
            f"SELECT count(*) FROM public.{t} WHERE document_id = ANY($1::uuid[]) AND org_id = $2",
            [d1, d1b, d2], UUID(w.a),
        )
        assert left == 0, f"{t} still holds {left} row(s) of a moved document in the source org"
    for t in org_move.DOCUMENT_CHILD_TABLES:
        assert await w.pool.fetchval(
            f"SELECT count(*) FROM public.{t} WHERE document_id = ANY($1::uuid[]) AND org_id = $2",
            [d1, d1b, d2], UUID(w.b),
        ) == 3, t
    rows = await w.pool.fetch(
        "SELECT org_id, metadata FROM public.audit_log WHERE user_id = $1 AND action_type = 'org.item.move'", w.u
    )
    assert len(rows) == 1
    assert str(rows[0]["org_id"]) == w.a
    meta = rows[0]["metadata"] if isinstance(rows[0]["metadata"], dict) else json.loads(rows[0]["metadata"])
    assert meta == {
        "kind": "folder", "item_id": str(root), "from_org": w.a, "to_org": w.b,
        "counts": {"subfolders": 1, "documents": 2, "earlier_versions": 1, "past_runs": 0},
    }


async def test_an_empty_folder_moves_and_counts_nothing(w):
    root = await w.folder("Empty")
    preview = await _execute(w, "folder", root)
    assert (preview.counts.subfolders, preview.counts.documents) == (0, 0)
    assert await w.org_of("folders", root) == w.b
    assert await w.audit_count() == 1


async def test_a_root_document_moves_with_its_version_family(w):
    old = await w.doc("MSA.pdf", is_latest=False, version=1)
    new = await w.doc("MSA.pdf", version=2)
    await w.children(new)
    other = await w.doc("Other.pdf")
    preview = await _preview(w, "document", new)
    assert preview.refusals == []
    assert (preview.counts.documents, preview.counts.earlier_versions) == (1, 1)
    await _execute(w, "document", new)
    assert await w.org_of("documents", old) == w.b
    assert await w.org_of("documents", new) == w.b
    assert await w.org_of("documents", other) == w.a
    for t in org_move.DOCUMENT_CHILD_TABLES:
        assert await w.pool.fetchval(
            f"SELECT count(*) FROM public.{t} WHERE document_id = $1 AND org_id = $2", new, UUID(w.b)
        ) == 1, t
    assert await w.audit_count() == 1


async def test_a_draft_moves_alone_and_its_past_runs_stay(w):
    draft = await w.draft("Brief")
    thread = await w.pool.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, 't') RETURNING id", w.u, UUID(w.a)
    )
    run = await w.pool.fetchval(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, org_id, user_id, status)"
        " VALUES ($1, $2, $3, $4, 'completed') RETURNING id", thread, draft, UUID(w.a), w.u,
    )
    preview = await _preview(w, "draft", draft)
    assert preview.refusals == [] and preview.counts.past_runs == 1
    await _execute(w, "draft", draft)
    assert await w.org_of("workflow_definitions", draft) == w.b
    assert await w.org_of("workflow_runs", run) == w.a
    assert await w.audit_count() == 1


async def test_a_draft_bound_to_a_folder_already_in_the_target_moves(w):
    fb = await w.folder("Acme KB", org=w.b)
    draft = await w.draft(definition={"project_folder_id": str(fb), "phases": []})
    assert (await _preview(w, "draft", draft)).refusals == []
    await _execute(w, "draft", draft)
    assert await w.org_of("workflow_definitions", draft) == w.b


# ── every D-33 refusal class (folder) ────────────────────────────────────────


async def test_refused_org_shared_subfolder(w):
    root = await w.folder()
    await w.folder("Team", parent=root, shared=True)
    await _assert_refused(w, "folder", root, "“Team” is shared with everyone in")


async def test_refused_legal_hold_on_the_folder(w):
    root = await w.folder()
    await w.doc(folder=root)
    hold = await w.pool.fetchval(
        "INSERT INTO public.legal_holds (org_id, name) VALUES ($1, 'Matter 298') RETURNING id", UUID(w.a)
    )
    await w.pool.execute(
        "INSERT INTO public.legal_hold_folders (hold_id, folder_id, org_id) VALUES ($1, $2, $3)", hold, root, UUID(w.a)
    )
    await _assert_refused(w, "folder", root, "is under a legal hold")


async def test_refused_legal_hold_on_an_ancestor(w):
    parent = await w.folder("Clients")
    root = await w.folder(parent=parent)
    hold = await w.pool.fetchval(
        "INSERT INTO public.legal_holds (org_id, name) VALUES ($1, 'Matter 298b') RETURNING id", UUID(w.a)
    )
    await w.pool.execute(
        "INSERT INTO public.legal_hold_folders (hold_id, folder_id, org_id) VALUES ($1, $2, $3)", hold, parent, UUID(w.a)
    )
    await _assert_refused(w, "folder", root, "is under a legal hold")


async def test_refused_watched_folder(w):
    root = await w.folder()
    conn = await w.pool.fetchval(
        "INSERT INTO public.connector_connections (org_id, created_by, name, service_id)"
        " VALUES ($1, $2, 'Drive 298', 'google_drive') RETURNING id", UUID(w.a), w.u,
    )
    await w.pool.execute(
        "INSERT INTO public.connector_watches (org_id, user_id, connection_id, source_folder_id, source_folder_name,"
        " library_folder_id) VALUES ($1, $2, $3, 'ext', 'Ext', $4)", UUID(w.a), w.u, conn, root,
    )
    await _assert_refused(w, "folder", root, "is kept in sync from a connected source")


async def test_refused_retention_policy_on_a_subtree_folder(w):
    root = await w.folder()
    sub = await w.folder("Signed", parent=root)
    await w.pool.execute(
        "INSERT INTO public.retention_policies (org_id, name, scope_kind, folder_id, clock, stage1_value,"
        " stage1_unit, stage1_action) VALUES ($1, 'Keep 298', 'folder', $2, 'date_added', 1, 'years', 'review')",
        UUID(w.a), sub,
    )
    await _assert_refused(w, "folder", root, "has a retention policy in")


async def _class_policy(w):
    return await w.pool.fetchval(
        "INSERT INTO public.retention_policies (org_id, name, scope_kind, document_type_norm, clock, stage1_value,"
        " stage1_unit, stage1_action) VALUES ($1, $2, 'class', $3, 'date_added', 1, 'years', 'review') RETURNING id",
        UUID(w.a), f"Class 298 {uuid4().hex[:6]}", f"t298{uuid4().hex[:6]}",
    )


async def test_refused_pending_retention_decision(w):
    root = await w.folder()
    d = await w.doc(folder=root)
    policy = await _class_policy(w)
    await w.pool.execute(
        "INSERT INTO public.retention_queue (org_id, policy_id, family_key, latest_document_id, kind,"
        " policy_revision, fingerprint) VALUES ($1, $2, 'k', $3, 'review', 1, 'fp')", UUID(w.a), policy, d,
    )
    await _assert_refused(w, "folder", root, "is waiting on a retention decision")


async def test_refused_retention_history(w):
    root = await w.folder()
    d = await w.doc(folder=root)
    await w.pool.execute(
        "INSERT INTO public.retention_receipts (org_id, action, document_id) VALUES ($1, 'delete_refused', $2)",
        UUID(w.a), d,
    )
    await _assert_refused(w, "folder", root, "retention history")


async def test_refused_archived_document(w):
    root = await w.folder()
    await w.doc(folder=root, archived=True)
    await _assert_refused(w, "folder", root, "archived by a retention policy")


async def test_refused_subfolder_not_owned(w):
    root = await w.folder()
    await w.folder("Theirs", owner=w.v, parent=root)
    await _assert_refused(w, "folder", root, "holds 1 folder you don't own")


async def test_refused_document_not_owned(w):
    root = await w.folder()
    await w.doc("Theirs.pdf", folder=root, owner=w.v)
    await _assert_refused(w, "folder", root, "holds 1 document you don't own")


async def test_refused_bound_chats(w):
    root = await w.folder()
    for _ in range(2):
        await w.pool.execute(
            "INSERT INTO public.threads (user_id, org_id, title, folder_id) VALUES ($1, $2, 't', $3)",
            w.u, UUID(w.a), root,
        )
    p = await _assert_refused(w, "folder", root, "2 chats in")
    assert any("use “Q3 Contracts”. Moving it would cut them off from it." in s for s in p.refusals)


@pytest.mark.parametrize("arm", ["project", "phase", "kb_auto", "output", "double_encoded"])
async def test_refused_a_workflow_binding_a_subtree_folder(w, arm):
    root = await w.folder()
    sub = await w.folder("Signed", parent=root)
    fid = str(sub)
    definition = {
        "project": {"project_folder_id": fid, "phases": []},
        "phase": {"phases": [{"key": "p", "config": {"folder_scope": [fid]}}]},
        "kb_auto": {"phases": [], "inputs": [{"key": "kb", "folder_scope": [fid]}]},
        "output": {"phases": [], "output_target_folder": fid},
        "double_encoded": json.dumps({"project_folder_id": fid, "phases": []}),
    }[arm]
    await w.draft("Contract review", definition=definition)
    await _assert_refused(w, "folder", root, "The workflow “Contract review” uses “Q3 Contracts”.")


async def test_refused_expert_install(w):
    root = await w.folder()
    bundle = await w.pool.fetchval(
        "INSERT INTO public.expert_bundles (created_by, name, slug, org_id) VALUES ($1, 'E', $2, $3) RETURNING id",
        w.u, f"e298-{uuid4().hex[:8]}", UUID(w.a),
    )
    await w.pool.execute(
        "INSERT INTO public.expert_installs (org_id, expert_bundle_id, folder_id, corpus_version)"
        " VALUES ($1, $2, $3, 'v1')", UUID(w.a), bundle, root,
    )
    await _assert_refused(w, "folder", root, "An Expert installed in")


async def test_refused_classification_rule(w):
    root = await w.folder()
    await w.pool.execute(
        "INSERT INTO public.classification_rules (user_id, org_id, name, match_expr, suggest_folder_id)"
        " VALUES ($1, $2, 'r', '{}'::jsonb, $3)", w.u, UUID(w.a), root,
    )
    await _assert_refused(w, "folder", root, "A classification rule in")


async def test_refused_saved_view(w):
    root = await w.folder()
    await w.pool.execute(
        "INSERT INTO public.document_views (user_id, org_id, name, folder_scope) VALUES ($1, $2, 'Invoices', $3)",
        w.u, UUID(w.a), root,
    )
    await _assert_refused(w, "folder", root, "The saved view “Invoices” looks inside “Q3 Contracts”.")


async def test_refused_recall_check(w):
    root = await w.folder()
    d = await w.doc(folder=root)
    await w.pool.execute(
        "INSERT INTO public.checked_queries (org_id, user_id, question, expected_document_id)"
        " VALUES ($1, $2, 'q?', $3)", UUID(w.a), w.u, d,
    )
    await _assert_refused(w, "folder", root, "A recall check expects a document in")


async def test_refused_document_still_processing(w):
    root = await w.folder()
    await w.doc(folder=root, status="processing")
    await _assert_refused(w, "folder", root, "is still processing")


async def test_refused_version_family_crossing_the_subtree(w):
    root = await w.folder()
    await w.doc("MSA.pdf", folder=root, version=2)
    await w.doc("MSA.pdf", folder=None, is_latest=False, version=1)
    await _assert_refused(w, "folder", root, "“MSA.pdf” has earlier versions outside this folder")


async def test_refused_relationship_with_one_end_staying(w):
    root = await w.folder()
    inside = await w.doc("MSA.pdf", folder=root)
    outside = await w.doc("Annex.pdf")
    await w.pool.execute(
        "INSERT INTO public.document_relationships (user_id, org_id, source_doc_id, target_doc_id, rel_type)"
        " VALUES ($1, $2, $3, $4, 'references')", w.u, UUID(w.a), inside, outside,
    )
    await _assert_refused(w, "folder", root, "“MSA.pdf” is linked to a document that stays in")


async def test_refused_same_content_already_in_the_target(w):
    root = await w.folder()
    await w.doc("MSA.pdf", folder=root, content_hash="h298collide")
    await w.doc("Copy.pdf", org=w.b, content_hash="h298collide")
    p = await _assert_refused(w, "folder", root, "“MSA.pdf” is already in")
    target = await w.name(w.b)
    assert f"“MSA.pdf” is already in {target}." in p.refusals


async def test_refused_same_name_already_in_the_target(w):
    root = await w.folder()
    await w.doc("MSA.pdf", folder=root)
    await w.doc("MSA.pdf", org=w.b)
    await _assert_refused(w, "folder", root, "A document named “MSA.pdf” is already in")


async def test_refused_documents_shared_with_the_org_through_a_connection(w):
    root = await w.folder()
    await w.doc(folder=root, visibility="org")
    await _assert_refused(w, "folder", root, "shared with everyone in")


async def test_a_folder_with_many_blockers_states_every_one(w):
    root = await w.folder()
    await w.folder("Team", parent=root, shared=True)
    await w.doc(folder=root, status="pending")
    await w.pool.execute(
        "INSERT INTO public.threads (user_id, org_id, title, folder_id) VALUES ($1, $2, 't', $3)",
        w.u, UUID(w.a), root,
    )
    p = await _preview(w, "folder", root)
    assert len(p.refusals) == 3
    assert "shared with everyone" in p.refusals[0] and "chat" in p.refusals[1] and "processing" in p.refusals[2]


# ── the Root document kind ───────────────────────────────────────────────────


async def test_refused_root_document_with_a_version_in_a_folder(w):
    f = await w.folder()
    await w.doc("MSA.pdf", folder=f, is_latest=False, version=1)
    root_doc = await w.doc("MSA.pdf", version=2)
    await _assert_refused(w, "document", root_doc, "“MSA.pdf” has a version inside a folder")


async def test_refused_root_document_on_legal_hold(w):
    d = await w.doc("MSA.pdf")
    hold = await w.pool.fetchval(
        "INSERT INTO public.legal_holds (org_id, name) VALUES ($1, 'Matter 298d') RETURNING id", UUID(w.a)
    )
    await w.pool.execute(
        "INSERT INTO public.legal_hold_documents (hold_id, document_id, org_id) VALUES ($1, $2, $3)", hold, d, UUID(w.a)
    )
    await _assert_refused(w, "document", d, "“MSA.pdf” is under a legal hold")


async def test_refused_root_document_already_in_the_target(w):
    d = await w.doc("MSA.pdf", content_hash="h298doc")
    await w.doc("MSA copy.pdf", org=w.b, content_hash="h298doc")
    await _assert_refused(w, "document", d, "“MSA.pdf” is already in")


# ── the draft kind ───────────────────────────────────────────────────────────


async def test_refused_published_workflow(w):
    pub = await w.draft("Brief", status="published")
    await _assert_refused(w, "draft", pub, "is published, and published workflows can't move")


async def test_refused_system_global_workflow(w):
    sg = await w.draft("Starter", system_global=True)
    await _assert_refused(w, "draft", sg, "is a starter workflow everyone shares")


async def test_refused_draft_with_a_live_run(w):
    draft = await w.draft("Brief")
    thread = await w.pool.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, 't') RETURNING id", w.u, UUID(w.a)
    )
    await w.pool.execute(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, org_id, user_id, status)"
        " VALUES ($1, $2, $3, $4, 'active')", thread, draft, UUID(w.a), w.u,
    )
    await _assert_refused(w, "draft", draft, "“Brief” has 1 run in progress")


async def test_refused_draft_with_a_schedule(w):
    draft = await w.draft("Brief")
    await w.pool.execute(
        "INSERT INTO public.workflow_schedules (org_id, workflow_id, user_id, name, interval_seconds)"
        " VALUES ($1, $2, $3, 's', 3600)", UUID(w.a), draft, w.u,
    )
    await _assert_refused(w, "draft", draft, "“Brief” has 1 schedule in")


async def test_refused_draft_listed_by_an_api_key(w):
    draft = await w.draft("Brief")
    await w.pool.execute(
        "INSERT INTO public.api_keys (org_id, user_id, label, key_prefix, key_hash, workflows)"
        " VALUES ($1, $2, 'k', 'sk_298', $3, $4)",
        UUID(w.a), w.u, uuid4().hex, [{"id": str(draft), "name": "Brief"}],
    )
    await _assert_refused(w, "draft", draft, "An API key in")


async def test_refused_draft_bound_to_a_folder_outside_the_target(w):
    fa = await w.folder("Q3 Contracts")
    draft = await w.draft("Brief", definition={"project_folder_id": str(fa), "phases": []})
    p = await _assert_refused(w, "draft", draft, "Its knowledge base “Q3 Contracts” is in")
    assert p.refusals[0] == (
        f"Its knowledge base “Q3 Contracts” is in {await w.name(w.a)}. "
        f"Pick a folder from {await w.name(w.b)} first, then move it."
    )


# ── membership, not found, bad input ─────────────────────────────────────────


async def test_a_target_org_the_caller_is_not_in_is_a_403_whether_or_not_it_exists(w):
    root = await w.folder()
    before = await w.snapshot()
    for target in (w.c, str(uuid4())):
        for call in (org_move.preview_move, org_move.execute_move):
            with pytest.raises(MoveRefused) as e:
                await call(w.pool, user_id=w.uid, kind="folder", item_id=str(root), to_org_id=target)
            assert (e.value.status, e.value.sentence) == (403, org_move.TARGET_NOT_MEMBER)
    assert await w.snapshot() == before


async def test_a_source_org_the_caller_left_is_a_403(w):
    stranded = await w.folder("Old", org=w.c)  # legacy: U's own folder in an org U is not in
    before = await w.snapshot()
    for call in (org_move.preview_move, org_move.execute_move):
        with pytest.raises(MoveRefused) as e:
            await call(w.pool, user_id=w.uid, kind="folder", item_id=str(stranded), to_org_id=w.b)
        assert (e.value.status, e.value.sentence) == (403, org_move.SOURCE_NOT_MEMBER)
    assert await w.snapshot() == before


@pytest.mark.parametrize("kind", ["folder", "document", "draft"])
async def test_missing_and_not_yours_read_the_same_404(w, kind):
    theirs = {
        "folder": lambda: w.folder("Theirs", owner=w.v),
        "document": lambda: w.doc("Theirs.pdf", owner=w.v),
        "draft": None,
    }[kind]
    if theirs is None:
        theirs_id = await w.pool.fetchval(
            "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
            " VALUES ($1, 'Theirs', $2, $3, 'draft') RETURNING id", f"p298m-{uuid4().hex[:10]}", w.v, UUID(w.a),
        )
    else:
        theirs_id = await theirs()
    before = await w.snapshot()
    sentences = set()
    for item in (theirs_id, uuid4()):
        for call in (org_move.preview_move, org_move.execute_move):
            with pytest.raises(MoveRefused) as e:
                await call(w.pool, user_id=w.uid, kind=kind, item_id=str(item), to_org_id=w.b)
            assert e.value.status == 404
            sentences.add(e.value.sentence)
    assert sentences == {org_move.NOT_FOUND}
    assert await w.snapshot() == before


async def test_moving_into_the_org_it_is_already_in_is_a_422(w):
    root = await w.folder()
    with pytest.raises(MoveRefused) as e:
        await _execute(w, "folder", root, to=w.a)
    assert e.value.status == 422 and "is already in" in e.value.sentence
    assert await w.audit_count() == 0


async def test_a_bad_id_or_kind_is_a_422_without_a_lookup(w):
    for kwargs in (
        {"kind": "folder", "item_id": "nope", "to_org_id": w.b},
        {"kind": "folder", "item_id": str(uuid4()), "to_org_id": "nope"},
        {"kind": "thread", "item_id": str(uuid4()), "to_org_id": w.b},
    ):
        with pytest.raises(MoveRefused) as e:
            await org_move.execute_move(w.pool, user_id=w.uid, **kwargs)
        assert e.value.status == 422


# ── TOCTOU ───────────────────────────────────────────────────────────────────


async def test_a_hold_placed_after_the_preview_is_caught_inside_the_transaction(w):
    root = await w.folder()
    await w.doc(folder=root)
    assert (await _preview(w, "folder", root)).refusals == []
    hold = await w.pool.fetchval(
        "INSERT INTO public.legal_holds (org_id, name) VALUES ($1, 'Matter 298t') RETURNING id", UUID(w.a)
    )
    await w.pool.execute(
        "INSERT INTO public.legal_hold_folders (hold_id, folder_id, org_id) VALUES ($1, $2, $3)", hold, root, UUID(w.a)
    )
    before = await w.snapshot()
    with pytest.raises(MoveRefused) as e:
        await _execute(w, "folder", root)
    assert e.value.status == 409 and "legal hold" in e.value.sentence
    assert await w.snapshot() == before
