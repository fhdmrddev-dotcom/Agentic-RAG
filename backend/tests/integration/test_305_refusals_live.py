"""Phase 305-01 (D-08 / D-09 / D-50 / T-305-01 / T-305-03) — identical refusals through the REAL app.

A real ``uvicorn`` (one worker, boot sweeps off) serves the real app. Real keys are minted in the
local DB for a real GoTrue member, then presented to ``POST /mcp``:

* no ``Authorization`` header, the member's REAL app session JWT (from GoTrue), a well-formed but
  never-minted ``srl_mcp_`` key, a REVOKED key, an EXPIRED key, and a WORKFLOW key (wrong kind) all
  get byte-identical responses — status, body and every header except ``date``;
* an org that switched MCP off gets HTTP 403 with the 304 sentence;
* the edge writes no audit row: every row that appears is the core's own ``api_key.refused`` for an
  attributable key (revoked / expired / switched off), and the unattributable presentations
  (no header, JWT, unknown, workflow-prefixed) add none.

Driven RED against the plan base (before 305-01 Task 4), where ``/mcp`` did not exist: every call
was a 404 with FastAPI's ``{"detail":"Not Found"}`` body, so the 401 and 403 arms all failed.
⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

import httpx
import pytest

from tests.integration import _305_live as live

UNKNOWN_KEY = "srl_mcp_" + "Z" * 43


@pytest.fixture(scope="module")
def server():
    with live.serve(workers=1) as srv:
        yield srv


def _post(base: str, auth: str | None) -> httpx.Response:
    headers = {"accept": live.ACCEPT, "content-type": "application/json"}
    if auth is not None:
        headers["authorization"] = auth
    with httpx.Client(base_url=base, timeout=30) as c:
        return c.post("/mcp", headers=headers, json=live.initialize_body())


def _fingerprint(r: httpx.Response):
    headers = sorted((k.lower(), v) for k, v in r.headers.raw if k.lower() != b"date")
    return r.status_code, r.content, headers


async def test_every_refusal_is_one_identical_401(server, pg_pool):
    async with live.mcp_world(pg_pool) as w:
        _good, _ = await w.mint()
        revoked, revoked_id = await w.mint()
        expired, expired_id = await w.mint()
        workflow_key, _ = await w.mint(kind="workflow")
        await pg_pool.execute("UPDATE public.api_keys SET revoked_at = now() WHERE id = $1::uuid", revoked_id)
        await pg_pool.execute(
            "UPDATE public.api_keys SET expires_at = now() - interval '1 day' WHERE id = $1::uuid", expired_id
        )

        before = len(await w.audit_rows())
        unattributable = {
            "no header": None,
            "app session jwt": f"Bearer {w.user_token}",
            "unknown key": f"Bearer {UNKNOWN_KEY}",
            "workflow key": f"Bearer {workflow_key}",
        }
        prints = {}
        for label, auth in unattributable.items():
            prints[label] = _fingerprint(_post(server.base_url, auth))
        after_unattributable = await w.audit_rows()
        assert len(after_unattributable) == before, (
            "an unattributable refusal wrote an audit row", after_unattributable[before:]
        )

        for label, auth in (("revoked", f"Bearer {revoked}"), ("expired", f"Bearer {expired}")):
            prints[label] = _fingerprint(_post(server.base_url, auth))
        rows = (await w.audit_rows())[before:]

    first = prints["no header"]
    assert first[0] == 401, first
    assert (b"www-authenticate", b"Bearer") in first[2]
    for label, fp in prints.items():
        assert fp == first, f"{label!r} differs from the one 401:\n{fp!r}\nvs\n{first!r}"
    # Only the core's own throttled refusal rows, for the two attributable keys.
    assert all(r["action_type"] == "api_key.refused" for r in rows), rows
    reasons = {(r["metadata"] or {}).get("reason") for r in rows}
    assert reasons <= {"revoked", "expired"}, reasons


async def test_an_org_that_switched_mcp_off_gets_the_403_sentence(server, pg_pool):
    from app.security.principal_liveness import MCP_OFF_ORG_SENTENCE

    async with live.mcp_world(pg_pool) as w:
        key, _ = await w.mint()
        ok = _post(server.base_url, f"Bearer {key}")
        assert ok.status_code == 200, ok.text
        await pg_pool.execute("UPDATE public.organizations SET mcp_enabled = false WHERE id = $1::uuid", w.org)
        r = _post(server.base_url, f"Bearer {key}")
        rows = await w.audit_rows()
    assert r.status_code == 403, r.text
    assert r.json() == {"error": "mcp_off", "error_description": MCP_OFF_ORG_SENTENCE}
    assert all(row["action_type"] in ("api_key.refused",) for row in rows), rows
