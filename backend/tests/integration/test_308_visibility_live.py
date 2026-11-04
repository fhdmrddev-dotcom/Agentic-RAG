"""Phase 308-03 (D-03 / D-25 / D-26; T-308-08 / T-308-09; SC#3) — an event reaches only an owner who
can still see the item and is still allowed to act, LIVE.

Driven against the local database (127.0.0.1:54322) with the drainer's REAL defaults: liveness is
``principal_still_allowed`` (kind ``webhook``) and visibility is the app's own RLS on an acting-member
connection. Only ``send`` (a counting fake) and the audit writer (a counter) are replaced.

* a document private to member B, with endpoints for A and B in the same org: no delivery row for A
  at all (the log can never reveal it), one for B;
* a document moved to another org after fan-out: ``skipped_not_visible`` at send, nothing sent;
* member A removed from the org after fan-out: ``skipped_owner_gone``, the endpoint off with reason
  ``owner_removed``, NO notice, nothing sent — and the same when A is removed BEFORE fan-out;
* a run of member B never reaches A's endpoint.

Committed rows, pinned to the year 2000, removed in ``finally`` with a zero-leftover assertion (the
``test_308_drainer_once_live`` world). Run under the local-DB lock, with ``-rs``.
"""
from __future__ import annotations

from tests.integration._rls_harness import requires_pg
from tests.integration.test_308_db_live import requires_225
from tests.integration.test_308_drainer_once_live import NOW, CountingAudit, CountingSend, world

pytestmark = [requires_pg, requires_225]


async def test_a_private_document_reaches_only_the_member_who_can_see_it():
    async with world() as w:
        ep_a = await w.endpoint(w.alice, url="https://hooks.example.com/a", events=("document.ingested",))
        ep_b = await w.endpoint(w.bob, url="https://hooks.example.com/b", events=("document.ingested",))
        doc = await w.doc(w.bob)
        assert await w.complete_doc(doc), "non-vacuity: 225's trigger wrote one event"
        send = CountingSend()
        await w.drainer(send).tick(now=NOW)
        assert await w.deliveries(ep_a) == [], "D-03: no delivery row for an owner who cannot see it"
        (row_b,) = await w.deliveries(ep_b)
        assert row_b["status"] == "sent"
        assert [c[0] for c in send.calls] == ["https://hooks.example.com/b"]


async def test_a_document_in_an_org_shared_folder_reaches_both_members():
    """The positive arm of the same rule: visibility is the app's, not "owner only"."""
    async with world() as w:
        ep_a = await w.endpoint(w.alice, url="https://hooks.example.com/a", events=("document.ingested",))
        ep_b = await w.endpoint(w.bob, url="https://hooks.example.com/b", events=("document.ingested",))
        folder = await w.pool.fetchval(
            "INSERT INTO public.folders (name, user_id, org_id, is_org_shared) VALUES ('308-03 shared', $1, $2, true)"
            " RETURNING id", w.bob, w.org,
        )
        assert await w.pool.fetchval("SELECT public.folder_is_org_shared($1)", folder), "non-vacuity: org-shared"
        doc = await w.doc(w.bob)
        await w.pool.execute("UPDATE public.documents SET folder_id = $2 WHERE id = $1", doc, folder)
        assert await w.complete_doc(doc)
        send = CountingSend()
        await w.drainer(send).tick(now=NOW)
        assert len(await w.deliveries(ep_a)) == 1 and len(await w.deliveries(ep_b)) == 1
        assert len(send.calls) == 2
        await w.pool.execute("DELETE FROM public.documents WHERE id = $1", doc)
        await w.pool.execute("DELETE FROM public.folders WHERE id = $1", folder)


async def test_a_document_moved_to_another_org_after_fan_out_is_skipped_not_visible():
    async with world() as w:
        ep_b = await w.endpoint(w.bob, events=("document.ingested",))
        doc = await w.doc(w.bob)
        assert await w.complete_doc(doc)
        send = CountingSend()
        d = w.drainer(send)
        assert await d._fan_out(now=NOW) == 1
        (pending,) = await w.deliveries(ep_b)
        assert pending["status"] == "pending"
        elsewhere = next(o for o in w.orgs if o != w.org)  # a personal org of this file's own
        await w.pool.execute("UPDATE public.documents SET org_id = $2 WHERE id = $1", doc, elsewhere)
        await d._send_pass(now=NOW)
        (row,) = await w.deliveries(ep_b)
        assert row["status"] == "skipped_not_visible"
        assert send.calls == []


async def test_an_owner_removed_after_fan_out_is_skipped_and_the_endpoint_turned_off_without_a_notice():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        assert await w.finish(await w.run(w.alice))
        send, audit = CountingSend(), CountingAudit()
        d = w.drainer(send, audit=audit)
        assert await d._fan_out(now=NOW) == 1
        await w.pool.execute("DELETE FROM public.org_members WHERE org_id = $1 AND user_id = $2", w.org, w.alice)
        await d._send_pass(now=NOW)
        (row,) = await w.deliveries(ep)
        assert row["status"] == "skipped_owner_gone"
        endpoint = await w.endpoint_row(ep)
        assert endpoint["enabled"] is False and endpoint["disabled_reason"] == "owner_removed"
        assert await w.notices(ep) == [], "D-25 / D-48: no notice to a removed person"
        assert send.calls == []
        assert [c["reason"] for c in audit.calls] == ["owner_removed"]


async def test_an_owner_removed_before_fan_out_gets_a_skipped_row_and_no_send():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        assert await w.finish(await w.run(w.alice))
        await w.pool.execute("DELETE FROM public.org_members WHERE org_id = $1 AND user_id = $2", w.org, w.alice)
        send = CountingSend()
        await w.drainer(send).tick(now=NOW)
        (row,) = await w.deliveries(ep)
        assert row["status"] == "skipped_owner_gone"
        endpoint = await w.endpoint_row(ep)
        assert endpoint["enabled"] is False and endpoint["disabled_reason"] == "owner_removed"
        assert await w.notices(ep) == [] and send.calls == []


async def test_a_run_of_member_b_never_reaches_member_as_endpoint():
    async with world() as w:
        ep_a = await w.endpoint(w.alice, url="https://hooks.example.com/a")
        run_b = await w.run(w.bob)
        assert await w.finish(run_b) is None, "only another member subscribes: the trigger writes nothing"
        ep_b = await w.endpoint(w.bob, url="https://hooks.example.com/b")
        assert await w.finish(await w.run(w.bob))
        send = CountingSend()
        await w.drainer(send).tick(now=NOW)
        assert await w.deliveries(ep_a) == []
        (row_b,) = await w.deliveries(ep_b)
        assert row_b["status"] == "sent"
        assert [c[0] for c in send.calls] == ["https://hooks.example.com/b"]
