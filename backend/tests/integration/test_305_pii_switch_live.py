"""Phase 305-04 (GUARD-03; D-34 / D-35 / D-36 / D-41(4) / D-56; T-305-10 / T-305-24 / T-305-32) — the
org's PII redaction switch, live.

A real minted MCP key on the real ``/mcp`` path in-process (``phase305_mcp_client``), in the 304
two-org world, with a Root document whose chunk and stored text carry an email and a phone number.

* switch OFF (the column default): the search returns both verbatim;
* an org ADMIN turns it ON through the real ``PUT /org/api-keys/pii-redaction`` (the real
  ``get_active_org_id`` + ``require_org_manage`` on a user-JWT connection; only the token check is
  overridden) — exactly one ``settings.update`` / ``pii_redaction`` audit row lands in the org;
* switch ON: the same search returns ``[email removed]`` and ``[phone removed]`` in BOTH
  ``structuredContent`` and the text block, and the passage's ``document_id`` and link are
  unchanged and ``read_document`` with that id still answers (D-41(4) / T-305-32);
* a read whose chunk boundary splits the phone masks it in BOTH chunks, and the cursor still pages;
* a redactor that raises: the call returns the withheld sentence and its audit row's outcome is
  ``redaction_blocked``;
* the column is not UPDATE-able by ``authenticated`` (catalog check as postgres — ⛔ BUG-261031-01:
  no statement as ``anon``, and nothing here calls ``current_user_org_ids()`` as anon).

The world's org column is flipped back in ``finally``. Run with ``-rs``: a skip is NOT RUN.
"""
from __future__ import annotations

from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

from app import dependencies as deps
from app.api import api_keys as route
from app.mcp import read_tools, results
from app.services import outbound_guard
from tests.integration._271_gotrue_users import _admin
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    patch_search,
    search_settings,
    world,
)
from tests.integration.phase305_mcp_client import mcp_session

pytestmark = requires_pg

EMAIL = "jane.doe@example.com"
PHONE = "+44 20 7946 0958"


def _boundary_text() -> str:
    """Stored text whose first 8,000-char chunk is cut INSIDE the phone number: the last
    whitespace before the budget is the space after ``+44``."""
    pad = ("revenue grew in the northern region " * 300)[:7990] + " "
    text = pad + "call " + PHONE + " before noon about the invoice.\n" + "closing notes " * 40
    assert text.index(PHONE) + 3 == 7999
    first, end = results.chunk(text, 0)
    assert end == 8000 and first.endswith("+44 "), (end, first[-20:])
    return text


@pytest_asyncio.fixture
async def pii_world(world, monkeypatch):
    w = world
    patch_search(monkeypatch, w)
    monkeypatch.setattr(read_tools, "load_user_settings", lambda _uid: search_settings())
    monkeypatch.setattr(route, "get_service_role_supabase", lambda org: _admin())
    did = await w.doc("pii_doc", w.u, w.x, filename=f"Contact sheet {EMAIL}.txt")
    await w.chunk("pii_doc", w.u, w.x, words=f"Reach Jane on {PHONE} or {EMAIL} today.", rank=0)
    await w.pool.execute("UPDATE public.documents SET full_markdown = $1 WHERE id = $2",
                         _boundary_text(), UUID(did))
    admin_id, _tok = await w.users.create_signed_in_user(w.x, role="org-admin", label="p30504a")
    w.pii_admin = admin_id
    assert await w.pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM public.org_members m JOIN public.role_permissions rp"
        " ON rp.role = m.role WHERE m.org_id = $1 AND m.user_id = $2 AND rp.permission_key = 'org:manage')",
        UUID(w.x), UUID(admin_id),
    ), "the admin fixture user cannot manage the org"
    try:
        yield w
    finally:
        await w.pool.execute(
            "UPDATE public.organizations SET pii_redaction_enabled = false WHERE id = $1", UUID(w.x))


async def _put_switch(w, enabled: bool, *, as_user: str) -> httpx.Response:
    app = FastAPI()
    app.include_router(route.org_router)

    async def _user():
        return {"id": as_user, "email": "p30504@test.local"}

    app.dependency_overrides[deps.get_current_user] = _user
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.put("/org/api-keys/pii-redaction", json={"enabled": enabled},
                                headers={"X-Org-Id": w.x})


async def _search(call, w):
    reply = await call.tool("search_knowledge_base", {"query": w.tok_x, "limit": 10})
    assert not reply.is_error, reply.text
    passage = next(p for p in reply.structured["passages"] if p["document_id"] == w.docs["pii_doc"])
    return reply, passage


async def test_the_switch_masks_search_results_and_ids_and_links_still_work(pii_world, monkeypatch):
    w = pii_world
    did = w.docs["pii_doc"]
    secret = await w.mint(include_external=True)

    async with mcp_session(monkeypatch, secret) as call:
        reply, p = await _search(call, w)
    assert EMAIL in p["passage"] and PHONE in p["passage"] and EMAIL in p["title"]
    assert EMAIL in reply.text

    member = await _put_switch(w, True, as_user=w.u)
    assert member.status_code == 403  # a plain member cannot flip it
    r = await _put_switch(w, True, as_user=w.pii_admin)
    assert r.status_code == 200 and r.json() == {"enabled": True}, r.text
    assert await w.pool.fetchval(
        "SELECT pii_redaction_enabled FROM public.organizations WHERE id = $1", UUID(w.x)) is True
    audits = await w.pool.fetch(
        "SELECT action_type, metadata, user_id FROM public.audit_log WHERE org_id = $1"
        " AND metadata->>'event' = 'pii_redaction'", UUID(w.x))
    assert len(audits) == 1, audits
    assert audits[0]["action_type"] == "settings.update"
    assert audits[0]["metadata"]["enabled"] is True and str(audits[0]["user_id"]) == w.pii_admin

    async with mcp_session(monkeypatch, secret) as call:
        reply, p = await _search(call, w)
        read = await call.tool("read_document", {"document_id": p["document_id"]})
    assert "[email removed]" in p["passage"] and "[phone removed]" in p["passage"]
    assert EMAIL not in p["passage"] and "7946" not in p["passage"]
    assert p["title"] == "Contact sheet [email removed].txt"
    assert EMAIL not in reply.text and "7946 0958" not in reply.text
    assert "[email removed]" in reply.text and "[phone removed]" in reply.text
    assert p["document_id"] == did and p["link"] == results.doc_link(did)
    assert did in reply.text and results.doc_link(did) in reply.text
    assert not read.is_error, read.text
    assert read.structured["document_id"] == did and read.structured["link"] == results.doc_link(did)


async def test_a_phone_split_by_the_read_chunk_boundary_is_masked_in_both_chunks(pii_world, monkeypatch):
    w = pii_world
    did = w.docs["pii_doc"]
    await w.pool.execute("UPDATE public.organizations SET pii_redaction_enabled = true WHERE id = $1",
                         UUID(w.x))
    async with mcp_session(monkeypatch, await w.mint()) as call:
        first = await call.tool("read_document", {"document_id": did})
        assert not first.is_error, first.text
        cursor = first.structured["next_cursor"]
        assert cursor and first.structured["end"] == 8000
        second = await call.tool("read_document", {"document_id": did, "cursor": cursor})
    assert not second.is_error, second.text
    one, two = first.structured["text"], second.structured["text"]
    assert one.endswith("call [phone removed]"), one[-40:]
    assert two.startswith("[phone removed] before noon"), two[:40]
    for body in (one, two, first.text, second.text):
        assert "+44" not in body and "7946" not in body and "0958" not in body
    assert second.structured["offset"] == 8000  # the redacted cursor still paged


async def test_a_redactor_that_raises_withholds_and_audits_redaction_blocked(pii_world, monkeypatch):
    w = pii_world
    await w.pool.execute("UPDATE public.organizations SET pii_redaction_enabled = true WHERE id = $1",
                         UUID(w.x))

    class _Boom:
        name = "boom"

        def spans(self, text):
            raise RuntimeError("recognizer blew up")

    monkeypatch.setattr(outbound_guard, "DEFAULT", _Boom())
    secret = await w.mint(label="305-04 withheld")
    key_id = str(await w.pool.fetchval(
        "SELECT id FROM public.api_keys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", UUID(w.u)))
    async with mcp_session(monkeypatch, secret) as call:
        reply = await call.tool("search_knowledge_base", {"query": w.tok_x})
    assert reply.is_error and reply.text == outbound_guard.WITHHELD_SENTENCE
    assert reply.structured is None
    assert EMAIL not in reply.raw.decode() and "7946" not in reply.raw.decode()
    rows = await w.pool.fetch(
        "SELECT action_type, metadata FROM public.audit_log WHERE metadata->>'api_key_id' = $1", key_id)
    assert len(rows) == 1, rows
    assert rows[0]["action_type"] == "api_key.read"
    assert rows[0]["metadata"]["outcome"] == "redaction_blocked"
    assert rows[0]["metadata"]["tool"] == "search_knowledge_base"


async def test_the_switch_column_is_outside_the_authenticated_update_grant(pg_pool):
    # Catalog read as postgres — never a statement as anon (BUG-261031-01).
    can = await pg_pool.fetchval(
        "SELECT has_column_privilege('authenticated', 'public.organizations',"
        " 'pii_redaction_enabled', 'UPDATE')")
    assert can is False
    default = await pg_pool.fetchval(
        "SELECT column_default FROM information_schema.columns WHERE table_schema = 'public'"
        " AND table_name = 'organizations' AND column_name = 'pii_redaction_enabled'")
    assert default == "false"
