"""Phase 275 code-review fix pass (275-REVIEW-backend.md B-WR-04 / B-WR-05 / B-WR-07) — the confirm
path against the LIVE local database.

* **B-WR-04** — a family that fails mid-batch (a non-hold error) no longer turns the whole confirm
  into a 500 with silent deletions: every family already committed has its bytes removed right
  after its own commit, the failed family is reported (and still exists), and the deleted receipt
  carries the file paths so a failed byte removal can be found and retried.
* **B-WR-05** — a queued family that is missing from the confirm snapshot (it was renamed into
  another family) is DROPPED with a ``did_not_delete`` receipt, never deleted unseen; the other
  family it now shares a key with is untouched.
* **B-WR-07** — a review row's "Archive" re-checks the policy revision and the family, like Delete:
  after a rule edit, nothing is archived and the row is dropped with a receipt.

⛔ Cleanup RELEASES holds first (275-01's pattern). Run with the local-DB lock held. Skip-guarded on
:54322 — a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest

from app.services.retention import disposition
from tests.integration._rls_harness import open_user_conn, requires_pg
from tests.integration.test_275_disposition import _doc, _policy, _Storage
from tests.integration.test_275_hold_triggers import _folder, _purge

pytestmark = requires_pg

NOW = datetime.now(timezone.utc)
OLD = NOW - timedelta(days=10)
ACTOR = "Amira Sato"


@pytest.fixture
async def world(pg_pool, two_orgs_two_users):
    a = two_orgs_two_users["a"]
    m = uuid4().hex[:8]
    docs: list = []
    folders: list = []
    try:
        dl = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"206-dl-{m}")
        rv = await _folder(pg_pool, owner=a["uid"], org=a["org_id"], name=f"206-rv-{m}")
        folders += [dl, rv]
        yield {"a": a, "m": m, "docs": docs, "folders": folders, "dl": dl, "rv": rv}
    finally:
        await _purge(pg_pool, orgs=[a["org_id"]], docs=docs, folders=folders)


async def _exists(pool, doc) -> bool:
    return bool(await pool.fetchval("SELECT EXISTS (SELECT 1 FROM public.documents WHERE id = $1)", doc))


async def _receipts(pool, org, action):
    return [dict(r) for r in await pool.fetch(
        "SELECT * FROM public.retention_receipts WHERE org_id = $1 AND action = $2", UUID(str(org)), action,
    )]


class _FailingPool:
    """The real pool, except that the ``fail_on``-th ``acquire()`` raises a connection error."""

    def __init__(self, pool, fail_on: int):
        self._pool = pool
        self._n = 0
        self._fail_on = fail_on

    def acquire(self):
        self._n += 1
        if self._n == self._fail_on:
            raise ConnectionResetError("the connection to the database was lost")
        return self._pool.acquire()

    def __getattr__(self, name):
        return getattr(self._pool, name)


async def test_wr04_a_mid_batch_failure_is_a_partial_result_and_committed_bytes_still_go(pg_pool, world):
    a, m = world["a"], world["m"]
    A = dict(owner=a["uid"], org=a["org_id"])
    first = await _doc(pg_pool, **A, folder=world["dl"], name=f"a-{m}.md", created=OLD)
    second = await _doc(pg_pool, **A, folder=world["dl"], name=f"b-{m}.md", created=OLD)
    world["docs"] += [first, second]
    pid = await _policy(pg_pool, org=a["org_id"], name=f"del-{m}", folder=world["dl"], s1=(1, "days", "delete"))
    result = await disposition.run_org_sweep(pg_pool, a["org_id"])
    assert sorted(result.queued_delete) == sorted([str(first), str(second)]), result

    storage = _Storage()
    # acquire #1 is the confirm snapshot; #2 is the first family's transaction; #3 fails.
    out = await disposition.confirm_batch(
        _FailingPool(pg_pool, fail_on=3), a["org_id"], pid,
        delete_ids=[str(first), str(second)], typed_count=2,
        actor_id=a["uid"], actor_name=ACTOR, storage=storage,
    )
    assert [d["document_id"] for d in out["deleted"]] == [str(first)], out
    assert [f["document_id"] for f in out["failed"]] == [str(second)], out
    assert not await _exists(pg_pool, first)
    assert await _exists(pg_pool, second), "the failed family must still exist"
    assert storage.removed == [f"{a['uid']}/{first}.md"], "the committed family's bytes were not removed"
    deleted = await _receipts(pg_pool, a["org_id"], "deleted")
    assert len(deleted) == 1 and deleted[0]["detail"].get("file_paths") == [f"{a['uid']}/{first}.md"]


async def test_wr05_a_family_missing_from_the_snapshot_is_dropped_never_deleted(pg_pool, world):
    a, m = world["a"], world["m"]
    A = dict(owner=a["uid"], org=a["org_id"])
    queued = await _doc(pg_pool, **A, folder=world["dl"], name=f"q-{m}.md", created=OLD, version=2)
    bystander = await _doc(pg_pool, **A, folder=world["dl"], name=f"keep-{m}.md", created=NOW)
    world["docs"] += [queued, bystander]
    pid = await _policy(pg_pool, org=a["org_id"], name=f"del-{m}", folder=world["dl"], s1=(1, "days", "delete"))
    result = await disposition.run_org_sweep(pg_pool, a["org_id"])
    assert result.queued_delete == [str(queued)], result

    # The owner renames the queued document onto the bystander's name: it stays the latest row
    # (version 2), so the fingerprint the queue row carries still matches.
    async with open_user_conn(pg_pool, a["uid"]) as conn:
        await conn.execute("UPDATE public.documents SET filename = $2 WHERE id = $1", queued, f"keep-{m}.md")

    out = await disposition.confirm_batch(
        pg_pool, a["org_id"], pid, delete_ids=[str(queued)], typed_count=1,
        actor_id=a["uid"], actor_name=ACTOR, storage=_Storage(),
    )
    assert out["deleted"] == [], out
    assert [d["reason"] for d in out["did_not_delete"]] == ["changed"], out
    assert await _exists(pg_pool, bystander), "B-WR-05: a family that was never proposed was deleted"
    assert await _exists(pg_pool, queued)
    assert len(await _receipts(pg_pool, a["org_id"], "did_not_delete")) == 1
    assert not await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM public.retention_queue WHERE policy_id = $1)", pid,
    ), "the stale queue row must be dropped"


async def test_wr07_archive_on_a_review_row_rechecks_the_policy_revision(pg_pool, world):
    a, m = world["a"], world["m"]
    A = dict(owner=a["uid"], org=a["org_id"])
    doc = await _doc(pg_pool, **A, folder=world["rv"], name=f"r-{m}.md", created=OLD)
    world["docs"].append(doc)
    pid = await _policy(pg_pool, org=a["org_id"], name=f"rev-{m}", folder=world["rv"], s1=(1, "days", "review"))
    result = await disposition.run_org_sweep(pg_pool, a["org_id"])
    assert result.queued_review == [str(doc)], result

    # The rule is edited (and previewed) after the sweep: the review row no longer stands.
    await pg_pool.execute(
        "UPDATE public.retention_policies SET stage1_value = 30, revision = 2, previewed_revision = 2 WHERE id = $1", pid,
    )
    out = await disposition.confirm_batch(
        pg_pool, a["org_id"], pid, delete_ids=[], archive_ids=[str(doc)], typed_count=0,
        actor_id=a["uid"], actor_name=ACTOR, storage=_Storage(),
    )
    assert out["archived"] == [], out
    assert await pg_pool.fetchval("SELECT archived_at IS NULL FROM public.documents WHERE id = $1", doc), \
        "B-WR-07: archived under a rule that no longer applies"
    assert [s["reason"] for s in out["skipped"]] == ["changed"], out
    receipts = await _receipts(pg_pool, a["org_id"], "did_not_delete")
    assert len(receipts) == 1 and receipts[0]["detail"].get("decision") == "archive"


async def test_wr07_control_an_unchanged_review_row_still_archives(pg_pool, world):
    a, m = world["a"], world["m"]
    A = dict(owner=a["uid"], org=a["org_id"])
    doc = await _doc(pg_pool, **A, folder=world["rv"], name=f"r2-{m}.md", created=OLD)
    world["docs"].append(doc)
    pid = await _policy(pg_pool, org=a["org_id"], name=f"rev2-{m}", folder=world["rv"], s1=(1, "days", "review"))
    await disposition.run_org_sweep(pg_pool, a["org_id"])
    out = await disposition.confirm_batch(
        pg_pool, a["org_id"], pid, delete_ids=[], archive_ids=[str(doc)], typed_count=0,
        actor_id=a["uid"], actor_name=ACTOR, storage=_Storage(),
    )
    assert [x["document_id"] for x in out["archived"]] == [str(doc)], out
    assert await pg_pool.fetchval("SELECT archived_at IS NOT NULL FROM public.documents WHERE id = $1", doc)
