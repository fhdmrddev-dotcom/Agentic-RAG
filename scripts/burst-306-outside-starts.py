"""Phase 306-05 (D-21; Pitfall 10; BUG-261031-03 / -04) — a burst of >= 30 concurrent OUTSIDE starts.

A STANDALONE driver, never imported by the app (``backend/app`` must not mention it). 305's burst
found two bugs every suite missed (a pool deadlock and a lost audit row), so a burst is part of
every MCP verification now. This one fires MCP ``ask_agent`` calls and ``/inbound`` workflow starts
AT ONCE against a RUNNING backend, then records what each one got:

  answered            the ask came back with an answer inside the wait budget
  handle              the ask came back as a handle (still working)
  started             an /inbound start or an MCP run_workflow got a run id
  refused-admission   the in-flight admission said full (MCP tool error / HTTP 429 + Retry-After)
  limited             the per-key per-minute limit said no
  unavailable         admission or the limiter could not answer (fail closed: 503 / the sentence)
  error               anything else (the status and the first 200 characters, never a secret)

While it runs it samples ``pg_stat_activity`` (SELECT only, once a second): connections by state,
and the count ``idle in transaction`` — the BUG-261031-03 shape. It writes ONE evidence JSON under
``.planning/phases/306-ask-the-agent-and-run-workflows/evidence/`` with the outcome counts, each
call's time, the samples and the admission knobs in force (read, never written).

Environment (secrets come from the environment ONLY and are never printed):

  SYREL_MCP_KEY        an MCP key (``srl_mcp_…``) granting ask_agent, Include mail and synced sources
  SYREL_WORKFLOW_KEY   a workflow key (``srl_live_…``) listing SYREL_WORKFLOW_ID
  SYREL_WORKFLOW_ID    a published workflow that key may start (declared input ``topic``)
  SYREL_API_BASE       the backend's base URL (default http://localhost:8000)

    backend/venv/Scripts/python scripts/burst-306-outside-starts.py --dry-run --count 30
    backend/venv/Scripts/python scripts/burst-306-outside-starts.py --count 30 --inbound-share 0.33

Exit codes: 0 the plan printed / the burst recorded · 2 harness error (fewer than 30 starts, a
missing env var, the backend unreachable).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import pathlib
import sys
import time
from collections import Counter
from datetime import datetime, timezone

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

EVIDENCE = REPO_ROOT / ".planning" / "phases" / "306-ask-the-agent-and-run-workflows" / "evidence"
MIN_STARTS = 30
ENV_VARS = ("SYREL_MCP_KEY", "SYREL_WORKFLOW_KEY", "SYREL_WORKFLOW_ID", "SYREL_API_BASE")
DEFAULT_BASE = "http://localhost:8000"
PROTOCOL = "2025-11-25"
QUESTION = "In one sentence: what do my documents say about onboarding? (burst {i})"

_ACTIVITY_SQL = (
    "SELECT state, count(*) AS n FROM pg_stat_activity WHERE datname = current_database() GROUP BY state"
)


def plan(count: int, inbound_share: float) -> tuple[int, int]:
    starts = int(round(count * inbound_share))
    return count - starts, starts


def _print_plan(asks: int, starts: int, base_set: bool) -> None:
    print(f"PLAN mcp_asks={asks}")
    print(f"PLAN inbound_starts={starts}")
    print("PLAN fired at once (asyncio.gather), each call timed; pg_stat_activity sampled every second (SELECT only)")
    for name in ENV_VARS:
        state = "set" if os.environ.get(name) else ("default " + DEFAULT_BASE if name == "SYREL_API_BASE" else "unset")
        print(f"PLAN env {name}: {state}")
    if not base_set:
        print("PLAN the backend must be running; nothing is fired in --dry-run")


# ── live ────────────────────────────────────────────────────────────────────────────────────


def _classify_mcp(status: int, body: dict) -> str:
    if status != 200:
        return "error"
    if "error" in body:
        return "error"
    result = body.get("result") or {}
    text = "".join(c.get("text", "") for c in result.get("content") or [])
    if result.get("isError"):
        if "already in progress" in text or "busy with other outside requests" in text:
            return "refused-admission"
        if "too many" in text.lower() and "last minute" in text:
            return "limited"
        if "unavailable" in text.lower():
            return "unavailable"
        return "error"
    status_word = (result.get("structuredContent") or {}).get("status")
    return "handle" if status_word in ("working", "starting") else "answered"


def _classify_inbound(status: int) -> str:
    return {201: "started", 429: "refused-admission", 503: "unavailable"}.get(status, "error")


async def _mcp_ask(client, secret: str, i: int) -> dict:
    headers = {"accept": "application/json, text/event-stream", "content-type": "application/json",
               "authorization": f"Bearer {secret}", "mcp-protocol-version": PROTOCOL}
    t = time.perf_counter()
    r = await client.post("/mcp", headers=headers, json={
        "jsonrpc": "2.0", "id": i, "method": "tools/call",
        "params": {"name": "ask_agent", "arguments": {"question": QUESTION.format(i=i)}},
    })
    body = json.loads(r.content) if r.content else {}
    return {"kind": "mcp_ask", "i": i, "status": r.status_code, "seconds": round(time.perf_counter() - t, 3),
            "outcome": _classify_mcp(r.status_code, body)}


async def _inbound_start(client, secret: str, workflow_id: str, i: int) -> dict:
    t = time.perf_counter()
    r = await client.post(f"/inbound/workflows/{workflow_id}/runs",
                          headers={"authorization": f"Bearer {secret}"},
                          json={"inputs": {"topic": f"burst {i}"}})
    outcome = _classify_inbound(r.status_code)
    rec = {"kind": "inbound_start", "i": i, "status": r.status_code,
           "seconds": round(time.perf_counter() - t, 3), "outcome": outcome,
           "retry_after": r.headers.get("retry-after")}
    if outcome == "error":
        rec["first_200"] = r.text[:200]
    return rec


async def _sampler(stop: asyncio.Event, samples: list) -> None:
    import asyncpg

    from app.config import settings

    conn = await asyncpg.connect(settings.postgres_dsn)
    try:
        while not stop.is_set():
            rows = await conn.fetch(_ACTIVITY_SQL)
            samples.append({"t": round(time.perf_counter(), 3),
                            "by_state": {str(r["state"]): int(r["n"]) for r in rows}})
            try:
                await asyncio.wait_for(stop.wait(), timeout=1.0)
            except asyncio.TimeoutError:
                pass
    finally:
        await conn.close()


async def _knobs() -> dict:
    from app.models.user_settings import load_app_settings_async

    s = await load_app_settings_async()
    return {k: getattr(s, k, None) for k in ("outside_inflight_per_key", "outside_inflight_per_org",
                                               "outside_inflight_per_provider", "mcp_ask_wait_seconds",
                                               "api_key_starts_per_minute")}


async def _live(args, asks: int, starts: int) -> int:
    import httpx

    mcp_key = os.environ.get("SYREL_MCP_KEY")
    wf_key = os.environ.get("SYREL_WORKFLOW_KEY")
    wf_id = os.environ.get("SYREL_WORKFLOW_ID")
    base = os.environ.get("SYREL_API_BASE") or DEFAULT_BASE
    missing = [n for n, v in (("SYREL_MCP_KEY", mcp_key if asks else "x"),
                              ("SYREL_WORKFLOW_KEY", wf_key if starts else "x"),
                              ("SYREL_WORKFLOW_ID", wf_id if starts else "x")) if not v]
    if missing:
        print(f"missing env: {', '.join(missing)}", file=sys.stderr)
        return 2
    stop, samples = asyncio.Event(), []
    sampler = asyncio.create_task(_sampler(stop, samples))
    t0 = time.perf_counter()
    async with httpx.AsyncClient(base_url=base, timeout=httpx.Timeout(args.timeout)) as client:
        calls = [_mcp_ask(client, mcp_key, i) for i in range(asks)]
        calls += [_inbound_start(client, wf_key, wf_id, asks + i) for i in range(starts)]
        results = await asyncio.gather(*calls, return_exceptions=True)
    stop.set()
    await sampler
    records = [r if isinstance(r, dict) else {"outcome": "error", "exception": type(r).__name__}
               for r in results]
    counts = Counter(r["outcome"] for r in records)
    record = {
        "at": datetime.now(timezone.utc).isoformat(), "base": base, "mcp_asks": asks,
        "inbound_starts": starts, "wall_seconds": round(time.perf_counter() - t0, 3),
        "outcomes": dict(counts), "calls": records, "pg_stat_activity": samples,
        "max_idle_in_transaction": max((s["by_state"].get("idle in transaction", 0) for s in samples), default=0),
        "knobs": await _knobs(),
    }
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    out = EVIDENCE / f"burst-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out.write_text(json.dumps(record, indent=2, default=str), encoding="utf-8")
    print(f"outcomes {dict(counts)}; max idle in transaction {record['max_idle_in_transaction']}")
    print(f"evidence -> {out.relative_to(REPO_ROOT)}")
    return 0


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--dry-run", action="store_true", help="print the plan; fire nothing")
    parser.add_argument("--count", type=int, default=MIN_STARTS, help=f"total starts (at least {MIN_STARTS})")
    parser.add_argument("--inbound-share", type=float, default=1 / 3,
                        help="the share of the starts sent to /inbound (the rest are MCP asks)")
    parser.add_argument("--timeout", type=float, default=120.0, help="seconds per call")
    args = parser.parse_args(argv)
    if args.count < MIN_STARTS:
        print(f"a burst is at least 30 starts (D-21); got {args.count}", file=sys.stderr)
        return 2
    if not 0.0 <= args.inbound_share <= 1.0:
        print("--inbound-share is between 0 and 1", file=sys.stderr)
        return 2
    asks, starts = plan(args.count, args.inbound_share)
    _print_plan(asks, starts, bool(os.environ.get("SYREL_API_BASE")))
    if args.dry_run:
        return 0
    # Settings (the sampler's DSN, the knobs) read backend/.env relative to the working directory.
    os.chdir(REPO_ROOT / "backend")
    return asyncio.run(_live(args, asks, starts))


if __name__ == "__main__":
    sys.exit(main())
