"""Phase 275-03 (RET-02 / RET-03 / SC#3 / D-03 / D-08 / D-11 / D-12 / D-19 / D-25 / D-34; B-NEW-1, W-4)
— the retention engine against the LIVE local database (migrations 204 + 205).

What this proves, each with a positive control so "nothing happened" can never pass vacuously:

* **Preview == sweep (Pitfall 14).** The dry run of every policy, then the sweep, on the same
  fixture: the archive set and the queued-delete / queued-review sets are IDENTICAL.
* **The sweep archives on its own and only queues deletes (D-08).** Every document still exists
  after the sweep; every version of an archived family is archived (D-25).
* **Fail closed.** A held family is skipped, a private document is never covered (D-34, and Preview
  counts it), an org-B document is never touched by an org-A policy, and an incomplete org (a folder
  cycle) disposes NOTHING and writes one ``sweep_incomplete`` receipt (SC#3).
* **Confirm (D-03 / D-12).** A hold placed between the sweep and the confirm drops exactly that
  document with a ``did_not_delete`` receipt naming the hold time; the others lose every version row
  and their chunks; the receipt keeps the document name after the row is gone; file bytes are removed
  only for what was deleted; a ``workspace_files`` row linked to a deleted document survives with its
  link set NULL.
* **Keep (D-11) and un-archive (D-19, B-NEW-1).** A kept family is not proposed again; an un-archived
  family is not re-archived; after its policy is REMOVED an archived family still un-archives, is
  retrievable again, gets no skip marker, and its receipt names the removed policy.
* **W-4.** No disposition receipt has a NULL ``policy_name``.

⛔ Cleanup RELEASES holds first (275-01's pattern). Run with the local-DB lock held. Skip-guarded on
:54322 — a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest

from app.db import retention as rdb
from app.services.retention import disposition
from app.services.retention.load import IncompleteEvaluation, load_snapshot
from tests.integration._rls_harness import requires_pg
from tests.integration.test_275_hold_triggers import _cover_doc, _folder, _hold, _purge

pytestmark = requires_pg

NOW = datetime.now(timezone.utc)
OLD = NOW - timedelta(days=10)
YESTERDAY = NOW - timedelta(days=1)
ACTOR = "Amira Sato"
DISPOSITION_ACTIONS = ("archived", "queued_delete", "queued_review", "deleted", "did_not_delete", "kept", "unarchived")


class _Storage:
    """Records ``storage.from_(bucket).remove(paths)``."""

    def __init__(self):
        self.removed: list[str] = []
        outer = self

        class _Bucket:
            def remove(self, paths):
                outer.removed.extend(paths)

        class _S:
            def from_(self, bucket):
                assert bucket == "documents"
                return _Bucket()

        self.storage = _S()


async def _doc(pool, *, owner, org, folder, name, created, latest=True, version=1, metadata=None):
    did = uuid4()
    await pool.execute(
        "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, file_size, mime_type, "
        "status, is_latest, version_number, chunk_count, metadata, created_at) "
        "VALUES ($1,$2,$3,$4,$5,$6,100,'text/markdown','completed',$7,$8,1,$9::jsonb,$10)",
        did, UUID(str(owner)), UUID(str(org)), folder, name, f"{owner}/{did}.md", latest, version,
        metadata or {}, created,
    )
    return did


async def _policy(pool, *, org, name, folder=None, type_norm=None, clock="date_added", s1=(1, "days", "archive"), s2=None):
    pid = uuid4()
    await pool.execute(
        "INSERT INTO public.retention_policies (id, org_id, name, scope_kind, folder_id, document_type_norm, clock, "
        "stage1_value, stage1_unit, stage1_action, stage2_value, stage2_unit, stage2_action, revision, previewed_revision) "
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,1)",
        pid, UUID(str(org)), name, "folder" if folder else "class", folder, type_norm, clock,
        s1[0], s1[1], s1[2], s2[0] if s2 else None, s2[1] if s2 else None, s2[2] if s2 else None,
    )
    return pid


async def _embedding_dim(pool) -> int:
    return int(await pool.fetchval(
        "SELECT atttypmod FROM pg_attribute WHERE attrelid = 'public.document_chunks'::regclass AND attname = 'embedding'"
    ))


@pytest.fixture
async def world(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    m = uuid4().hex[:8]
    docs: list = []
    folders: list = []
    extra: dict = {"threads": [], "files": []}
    try:
        ar = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-03-ar-{m}")
        dl = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-03-dl-{m}")
        sh = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-03-sh-{m}")
        pv = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"275-03-pv-{m}", shared=False)
        bf = await _folder(pg_pool, owner=b["uid"], org=b["org_id"], name=f"275-03-b-{m}")
        folders += [ar, dl, sh, pv, bf]
        A = dict(owner=a["uid"], org=a["org_id"])

        x1 = await _doc(pg_pool, **A, folder=ar, name=f"x1-{m}.md", created=OLD)
        x2 = await _doc(pg_pool, **A, folder=ar, name=f"x2-{m}.md", created=YESTERDAY)
        x3 = await _doc(pg_pool, **A, folder=ar, name=f"x3-{m}.md", created=NOW)
        x4a = await _doc(pg_pool, **A, folder=ar, name=f"x4-{m}.md", created=OLD - timedelta(days=5), latest=False, version=1)
        x4b = await _doc(pg_pool, **A, folder=ar, name=f"x4-{m}.md", created=OLD, latest=True, version=2)
        x5 = await _doc(pg_pool, **A, folder=ar, name=f"x5-{m}.md", created=OLD)
        y1 = await _doc(pg_pool, **A, folder=dl, name=f"y1-{m}.md", created=OLD)
        y2 = await _doc(pg_pool, **A, folder=dl, name=f"y2-{m}.md", created=OLD)
        y3 = await _doc(pg_pool, **A, folder=dl, name=f"y3-{m}.md", created=OLD)
        z1 = await _doc(pg_pool, **A, folder=sh, name=f"z1-{m}.md", created=OLD, metadata={"document_type": "Contract"})
        v1 = await _doc(pg_pool, **A, folder=pv, name=f"v1-{m}.md", created=OLD)
        bdoc = await _doc(pg_pool, owner=b["uid"], org=b["org_id"], folder=bf, name=f"b-{m}.md", created=OLD,
                          metadata={"document_type": "Contract"})
        docs += [x1, x2, x3, x4a, x4b, x5, y1, y2, y3, z1, v1, bdoc]

        # y1 carries a chunk and a thread attachment that links to it (mig 203: ON DELETE SET NULL)
        dim = await _embedding_dim(pg_pool)
        chunk = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.document_chunks (id, document_id, user_id, org_id, content, chunk_index, embedding) "
            "VALUES ($1,$2,$3,$4,'275-03 chunk',0,$5::text::public.vector)",
            chunk, y1, UUID(a["uid"]), UUID(a["org_id"]), "[" + ",".join(["0.01"] * dim) + "]",
        )
        thread = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.threads (id, user_id, org_id, title) VALUES ($1,$2,$3,'275-03')",
            thread, UUID(a["uid"]), UUID(a["org_id"]),
        )
        wf = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.workspace_files (id, thread_id, path, created_by, org_id, library_document_id) "
            "VALUES ($1,$2,'notes/y1.md',$3,$4,$5)",
            wf, thread, UUID(a["uid"]), UUID(a["org_id"]), y1,
        )
        extra["threads"].append(thread)
        extra["files"].append(wf)

        p_arc = await _policy(pg_pool, org=a["org_id"], name=f"Archive then delete {m}", folder=ar,
                              s1=(1, "days", "archive"), s2=(2, "days", "delete"))
        p_del = await _policy(pg_pool, org=a["org_id"], name=f"Expired drafts {m}", folder=dl, s1=(1, "days", "delete"))
        p_rev = await _policy(pg_pool, org=a["org_id"], name=f"Contracts review {m}", type_norm="contract",
                              s1=(1, "days", "review"))
        p_priv = await _policy(pg_pool, org=a["org_id"], name=f"Private folder {m}", folder=pv, s1=(1, "days", "archive"))

        hold = await _hold(pg_pool, org=a["org_id"], name=f"Halden v. Crane {m}")
        await _cover_doc(pg_pool, hold=hold, doc=x5, org=a["org_id"])

        yield {
            "a": a, "b": b, "m": m, "ar": ar, "dl": dl, "sh": sh, "pv": pv,
            "x1": x1, "x2": x2, "x3": x3, "x4a": x4a, "x4b": x4b, "x5": x5, "y1": y1, "y2": y2, "y3": y3,
            "z1": z1, "v1": v1, "bdoc": bdoc, "chunk": chunk, "wf": wf,
            "p_arc": p_arc, "p_del": p_del, "p_rev": p_rev, "p_priv": p_priv, "folders": folders,
        }
    finally:
        for wf in extra["files"]:
            try:
                await pg_pool.execute("DELETE FROM public.workspace_files WHERE id = $1", wf)
            except Exception:
                pass
        for t in extra["threads"]:
            try:
                await pg_pool.execute("DELETE FROM public.threads WHERE id = $1", t)
            except Exception:
                pass
        await _purge(pg_pool, orgs=[a["org_id"], b["org_id"]], docs=docs, folders=folders)


async def _policy_row(pool, pid) -> dict:
    return dict(await pool.fetchrow("SELECT * FROM public.retention_policies WHERE id = $1", pid))


async def _preview_sets(pool, org, pids) -> dict:
    sets = {"archive": set(), "queue_delete": set(), "queue_review": set()}
    privates = {}
    for pid in pids:
        row = await _policy_row(pool, pid)
        pv = await disposition.preview_draft(pool, org, row, editing_policy_id=str(pid), now=NOW)
        for k in sets:
            sets[k] |= set(pv["sets"][k])
        privates[pid] = pv["private_not_covered"]
    return {"sets": sets, "private": privates}


async def _archived(pool, org) -> set:
    return {str(r["id"]) for r in await pool.fetch(
        "SELECT id FROM public.documents WHERE org_id = $1 AND archived_at IS NOT NULL", UUID(str(org)))}


async def _queue(pool, org, kind) -> set:
    return {str(r["latest_document_id"]) for r in await pool.fetch(
        "SELECT latest_document_id FROM public.retention_queue WHERE org_id = $1 AND kind = $2", UUID(str(org)), kind)}


async def _receipts(pool, org, action=None) -> list:
    sql = "SELECT * FROM public.retention_receipts WHERE org_id = $1"
    args = [UUID(str(org))]
    if action:
        sql += " AND action = $2"
        args.append(action)
    return [dict(r) for r in await pool.fetch(sql + " ORDER BY created_at", *args)]


async def _exists(pool, did) -> bool:
    return bool(await pool.fetchval("SELECT EXISTS (SELECT 1 FROM public.documents WHERE id = $1)", did))


# ── Preview == sweep, and the sweep only archives and queues ─────────────────────────────────

async def test_preview_equals_sweep_and_the_sweep_only_archives_and_queues(pg_pool, world):
    w = world
    org = w["a"]["org_id"]
    pids = [w["p_arc"], w["p_del"], w["p_rev"], w["p_priv"]]
    preview = await _preview_sets(pg_pool, org, pids)

    # the expected sets, named so a wrong fixture cannot pass by matching itself
    s = lambda *k: {str(w[x]) for x in k}  # noqa: E731
    assert preview["sets"]["archive"] == s("x1", "x2", "x4b")
    assert preview["sets"]["queue_delete"] == s("x1", "x4b", "y1", "y2", "y3")
    assert preview["sets"]["queue_review"] == s("z1")
    assert preview["private"][w["p_priv"]] == 1, "D-34: Preview reports the private document it cannot cover"

    result = await disposition.run_org_sweep(pg_pool, org, now=NOW)
    assert result.status == "ok", result

    archived = await _archived(pg_pool, org)
    assert archived == s("x1", "x2", "x4a", "x4b"), "every version of an archived family (D-25)"
    assert {x for x in archived if x != str(w["x4a"])} == preview["sets"]["archive"], "Pitfall 14"
    assert await _queue(pg_pool, org, "delete") == preview["sets"]["queue_delete"], "Pitfall 14"
    assert await _queue(pg_pool, org, "review") == preview["sets"]["queue_review"], "Pitfall 14"

    for key in ("x1", "x2", "x3", "x4a", "x4b", "x5", "y1", "y2", "y3", "z1", "v1"):
        assert await _exists(pg_pool, w[key]), f"D-08: the sweep deleted {key}"
    assert str(w["x5"]) not in archived, "a held family is skipped"
    assert str(w["v1"]) not in archived, "a private document is never covered"

    row = await pg_pool.fetchrow("SELECT archived_policy_id, archived_policy_name, retrievable FROM public.documents WHERE id = $1", w["x2"])
    assert row["archived_policy_id"] == w["p_arc"] and row["archived_policy_name"].startswith("Archive then delete")
    assert row["retrievable"] is False

    # an org-A policy never touches an org-B document
    b = w["b"]["org_id"]
    assert not await _archived(pg_pool, b)
    assert not await pg_pool.fetchval("SELECT count(*) FROM public.retention_queue WHERE org_id = $1", UUID(b))

    rec = await _receipts(pg_pool, org)
    by = lambda a: [r for r in rec if r["action"] == a]  # noqa: E731
    assert len(by("archived")) == 3 and len(by("queued_delete")) == 5 and len(by("queued_review")) == 1
    assert all(r["actor_name"] == "Nightly sweep" and r["policy_name"] for r in by("archived") + by("queued_delete"))

    # idempotent: a second sweep proposes nothing new
    again = await disposition.run_org_sweep(pg_pool, org, now=NOW)
    assert again.status == "ok" and not again.archived and not again.queued_delete and not again.queued_review
    assert len(await _receipts(pg_pool, org)) == len(rec)


# ── Confirm: late hold dropped, every version deleted, receipts outlive the rows ─────────────

async def test_confirm_deletes_every_version_drops_a_late_hold_and_the_receipt_outlives_the_row(pg_pool, world):
    w = world
    org = w["a"]["org_id"]
    assert (await disposition.run_org_sweep(pg_pool, org, now=NOW)).status == "ok"

    # a hold placed AFTER the sweep, BEFORE the confirm
    late = await _hold(pg_pool, org=org, name=f"Kessler dispute {w['m']}")
    await _cover_doc(pg_pool, hold=late, doc=w["y2"], org=org)

    with pytest.raises(disposition.ConfirmRefused):
        await disposition.confirm_batch(
            pg_pool, org, w["p_del"], delete_ids=[str(w["y1"]), str(w["y2"]), str(w["y3"])], typed_count=2,
            actor_id=w["a"]["uid"], actor_name=ACTOR,
        )
    assert await _exists(pg_pool, w["y1"]), "a wrong typed count deletes nothing"

    storage = _Storage()
    out = await disposition.confirm_batch(
        pg_pool, org, w["p_del"], delete_ids=[str(w["y1"]), str(w["y2"]), str(w["y3"])], typed_count=3,
        actor_id=w["a"]["uid"], actor_name=ACTOR, now=NOW, storage=storage,
    )
    assert {d["document_id"] for d in out["deleted"]} == {str(w["y1"]), str(w["y3"])}
    assert [d["document_id"] for d in out["did_not_delete"]] == [str(w["y2"])]
    assert out["did_not_delete"][0]["reason"] == "held" and out["did_not_delete"][0]["held_since"]

    assert not await _exists(pg_pool, w["y1"]) and not await _exists(pg_pool, w["y3"])
    assert await _exists(pg_pool, w["y2"]), "the late hold dropped y2 at confirm"
    assert not await pg_pool.fetchval("SELECT count(*) FROM public.document_chunks WHERE id = $1", w["chunk"])
    link = await pg_pool.fetchrow("SELECT library_document_id FROM public.workspace_files WHERE id = $1", w["wf"])
    assert link is not None and link["library_document_id"] is None, "workspace_files survives, link nulled"

    deleted = await _receipts(pg_pool, org, "deleted")
    assert {r["document_name"] for r in deleted} == {f"y1-{w['m']}.md", f"y3-{w['m']}.md"}
    assert all(r["actor_name"] == ACTOR and r["policy_name"].startswith("Expired drafts") for r in deleted)
    dnd = await _receipts(pg_pool, org, "did_not_delete")
    assert len(dnd) == 1 and dnd[0]["detail"]["reason"] == "held" and dnd[0]["detail"]["held_since"]
    assert set(storage.removed) == {f"{w['a']['uid']}/{w['y1']}.md", f"{w['a']['uid']}/{w['y3']}.md"}, "bytes only for deleted rows"

    # a two-version family: confirming its latest deletes BOTH rows (D-12, D-25)
    out2 = await disposition.confirm_batch(
        pg_pool, org, w["p_arc"], delete_ids=[str(w["x4b"])], typed_count=1,
        actor_id=w["a"]["uid"], actor_name=ACTOR, now=NOW, storage=_Storage(),
    )
    assert out2["deleted"] and out2["deleted"][0]["rows"] == 2
    assert not await _exists(pg_pool, w["x4a"]) and not await _exists(pg_pool, w["x4b"])

    # W-4: every disposition receipt names its policy
    missing = await pg_pool.fetchval(
        "SELECT count(*) FROM public.retention_receipts WHERE org_id = $1 AND action = ANY($2::text[]) AND policy_name IS NULL",
        UUID(org), list(DISPOSITION_ACTIONS),
    )
    assert missing == 0


# ── Keep (D-11) ──────────────────────────────────────────────────────────────────────────────

async def test_a_kept_family_is_not_proposed_again(pg_pool, world):
    w = world
    org = w["a"]["org_id"]
    await disposition.run_org_sweep(pg_pool, org, now=NOW)
    out = await disposition.confirm_batch(
        pg_pool, org, w["p_del"], delete_ids=[], keep_ids=[str(w["y1"])], typed_count=0,
        actor_id=w["a"]["uid"], actor_name=ACTOR, now=NOW,
    )
    assert [k["document_id"] for k in out["kept"]] == [str(w["y1"])]
    assert await pg_pool.fetchval(
        "SELECT reason FROM public.retention_skips WHERE org_id = $1 AND policy_id = $2", UUID(org), w["p_del"]) == "kept"
    await disposition.run_org_sweep(pg_pool, org, now=NOW)
    assert str(w["y1"]) not in await _queue(pg_pool, org, "delete"), "D-11: never re-proposed nightly"
    assert {str(w["y2"]), str(w["y3"])} <= await _queue(pg_pool, org, "delete"), "positive control"
    kept = await _receipts(pg_pool, org, "kept")
    assert len(kept) == 1 and kept[0]["actor_name"] == ACTOR and kept[0]["policy_name"]


# ── Un-archive (D-19), including after the policy is removed (B-NEW-1) ──────────────────────

async def test_unarchive_skips_until_change_and_still_works_after_the_policy_is_removed(pg_pool, world):
    w = world
    org = w["a"]["org_id"]
    await disposition.run_org_sweep(pg_pool, org, now=NOW)

    res = await disposition.unarchive_family(pg_pool, org, w["x2"], actor_id=w["a"]["uid"], actor_name=ACTOR)
    assert res["skip_written"] is True
    assert (await pg_pool.fetchrow("SELECT retrievable FROM public.documents WHERE id = $1", w["x2"]))["retrievable"] is True
    await disposition.run_org_sweep(pg_pool, org, now=NOW)
    assert str(w["x2"]) not in await _archived(pg_pool, org), "D-19: not re-archived until something changes"

    policy_name = (await _policy_row(pg_pool, w["p_arc"]))["name"]
    assert await rdb.delete_policy(pg_pool, org, w["p_arc"], actor_id=w["a"]["uid"], actor_name=ACTOR)
    row = await pg_pool.fetchrow("SELECT archived_policy_id, archived_policy_name FROM public.documents WHERE id = $1", w["x1"])
    assert row["archived_policy_id"] is None and row["archived_policy_name"] == policy_name, "B-NEW-1 snapshot"

    res2 = await disposition.unarchive_family(pg_pool, org, w["x1"], actor_id=w["a"]["uid"], actor_name=ACTOR)
    assert res2["skip_written"] is False and res2["policy_name"] == policy_name
    after = await pg_pool.fetchrow(
        "SELECT archived_at, archived_policy_id, archived_policy_name, retrievable FROM public.documents WHERE id = $1", w["x1"])
    assert after["archived_at"] is None and after["archived_policy_name"] is None and after["retrievable"] is True
    receipts = await _receipts(pg_pool, org, "unarchived")
    assert [r["policy_name"] for r in receipts] == [policy_name, policy_name]

    with pytest.raises(disposition.DispositionError):
        await disposition.unarchive_family(pg_pool, org, w["x1"], actor_id=w["a"]["uid"], actor_name=ACTOR)
    with pytest.raises(disposition.NotFound):
        await disposition.unarchive_family(pg_pool, w["b"]["org_id"], w["x2"], actor_id=w["a"]["uid"], actor_name=ACTOR)


# ── Incomplete disposes nothing (SC#3) ──────────────────────────────────────────────────────

async def test_an_incomplete_org_disposes_nothing(pg_pool, world):
    w = world
    org = w["a"]["org_id"]
    c1 = await _folder(pg_pool, owner=w["a"]["uid"], org=org, name=f"275-03-c1-{w['m']}")
    c2 = await _folder(pg_pool, owner=w["a"]["uid"], org=org, name=f"275-03-c2-{w['m']}", parent=c1)
    w["folders"] += [c1, c2]
    await pg_pool.execute("UPDATE public.folders SET parent_id = $2 WHERE id = $1", c1, c2)  # a parent cycle
    try:
        with pytest.raises(IncompleteEvaluation):
            await load_snapshot(pg_pool, org)
        with pytest.raises(IncompleteEvaluation):
            await disposition.preview_draft(pg_pool, org, await _policy_row(pg_pool, w["p_del"]), editing_policy_id=str(w["p_del"]))
        result = await disposition.run_org_sweep(pg_pool, org, now=NOW)
        assert result.status == "incomplete" and "cycle" in (result.error or "")
        assert not await _archived(pg_pool, org)
        assert not await _queue(pg_pool, org, "delete") and not await _queue(pg_pool, org, "review")
        rec = await _receipts(pg_pool, org)
        assert [r["action"] for r in rec] == ["sweep_incomplete"]
    finally:
        await pg_pool.execute("UPDATE public.folders SET parent_id = NULL WHERE id = ANY($1::uuid[])", [c1, c2])
    # positive control: the same org, the cycle broken, sweeps normally
    assert (await disposition.run_org_sweep(pg_pool, org, now=NOW)).status == "ok"
    assert await _archived(pg_pool, org)
