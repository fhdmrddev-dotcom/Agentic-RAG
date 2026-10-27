"""Shared fakes for the Phase 293 inbound route suites (start, status read, file link).

The router is mounted on a FRESH ``FastAPI()`` with dependency overrides; it never enters
``app.main.app``'s lifespan (SEED-363: the real lifespan runs the boot sweep against the shared
local DB). Nothing here touches Postgres or Redis.
"""
from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI

from app import dependencies as deps
from app.api import inbound
from app.security.api_key_auth import ResolvedKey, resolve_api_key

KEY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OTHER_KEY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
ORG_ID = "44444444-4444-4444-8444-444444444444"
USER_ID = "33333333-3333-4333-8333-333333333333"
WF_ID = "11111111-1111-4111-8111-111111111111"
RUN_ID = "22222222-2222-4222-8222-222222222222"
THREAD_ID = "66666666-6666-4666-8666-666666666666"
FILE_ID = "77777777-7777-4777-8777-777777777777"

DEFINITION = {
    "name": "Weekly digest",
    "slug": "weekly-digest",
    "version": 1,
    "phases": [],
    "inputs": [
        {"key": "topic", "label": "Topic", "type": "text"},
        {"key": "notes", "label": "Notes", "type": "text", "required": False},
    ],
}


def make_key(**kw) -> ResolvedKey:
    base = dict(
        id=KEY_ID, org_id=ORG_ID, user_id=USER_ID, label="n8n-prod",
        workflows=[{"id": WF_ID, "name": "Weekly digest"}], expires_at=None,
    )
    base.update(kw)
    return ResolvedKey(**base)


class FakePool:
    """Answers by SQL shape; records every statement in ``calls`` (and in ``events``)."""

    def __init__(self, events: list | None = None):
        self.events = events if events is not None else []
        self.calls: list[tuple[str, tuple]] = []
        self.scope_row: dict | None = {"id": WF_ID}
        self.run_row: dict | None = None
        self.phase_rows: list[dict] = []
        self.file_rows: list[dict] = []
        self.key_row: dict | None = None
        self.display_name: str | None = "Sam Rivera"
        self.raise_on_files = False

    def _log(self, sql, args):
        self.calls.append((" ".join(sql.split()), args))
        self.events.append("db")

    async def fetchrow(self, sql, *args):
        self._log(sql, args)
        flat = " ".join(sql.split())
        if "FROM workflow_definitions" in flat:
            return self.scope_row
        if "FROM workflow_runs" in flat:
            return self.run_row
        if "FROM api_keys" in flat:
            return self.key_row
        raise AssertionError(f"unexpected fetchrow: {flat}")

    async def fetch(self, sql, *args):
        self._log(sql, args)
        flat = " ".join(sql.split())
        if "FROM workflow_phases" in flat:
            return self.phase_rows
        if "FROM workspace_files" in flat:
            if self.raise_on_files:
                raise RuntimeError("files table unavailable")
            return self.file_rows
        if "FROM harness_audit" in flat:
            return []
        raise AssertionError(f"unexpected fetch: {flat}")

    async def fetchval(self, sql, *args):
        self._log(sql, args)
        flat = " ".join(sql.split())
        if "FROM profiles" in flat:
            return self.display_name
        raise AssertionError(f"unexpected fetchval: {flat}")


class FakePipeline:
    def __init__(self, redis):
        self.redis, self.ops = redis, []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False

    def get(self, k):
        self.ops.append(("get", k))

    def delete(self, k):
        self.ops.append(("delete", k))

    # 293-REVIEW CR-02: the per-IP limiter and the refusal-audit throttle count with INCR+EXPIRE.
    def incr(self, k):
        self.ops.append(("incr", k))

    def expire(self, k, seconds):
        self.ops.append(("expire", k))

    async def execute(self):
        out = []
        for op, k in self.ops:
            if op == "get":
                out.append(self.redis.store.get(k))
            elif op == "incr":
                value = int(self.redis.store.get(k) or 0) + 1
                self.redis.store[k] = str(value)
                out.append(value)
            elif op == "expire":
                out.append(True)
            else:
                out.append(1 if self.redis.store.pop(k, None) is not None else 0)
        return out


class FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}
        self.sets: list[tuple[str, str, Any]] = []
        self.pipelines: list[dict] = []

    async def set(self, k, v, ex=None):
        self.sets.append((k, v, ex))
        self.store[k] = v

    # 296-06 (293-IN-01): the file route PEEKS at its token (a plain GET, no consume) before the
    # per-key limiter, and consumes it (GET + DEL in one MULTI) only after the limit passed.
    async def get(self, k):
        return self.store.get(k)

    def pipeline(self, transaction=True):
        self.pipelines.append({"transaction": transaction})
        return FakePipeline(self)


def build_app(*, key: ResolvedKey | None, pool: FakePool, redis: FakeRedis) -> FastAPI:
    app = FastAPI()
    app.include_router(inbound.router)
    if key is not None:
        app.dependency_overrides[resolve_api_key] = lambda: key
    app.dependency_overrides[deps.get_pg_pool] = lambda: pool
    app.dependency_overrides[deps.get_redis] = lambda: redis
    return app


def audit_spies(monkeypatch, events: list | None = None):
    """Patch both audit writers and the limiter on the route module; return the spies."""
    now = AsyncMock()
    later = MagicMock()
    events = events if events is not None else []

    async def _limit(_redis, *, key_id, kind):
        events.append(("limit", kind))

    limiter = AsyncMock(side_effect=_limit)
    monkeypatch.setattr(inbound, "audit_key_call_now", now)
    monkeypatch.setattr(inbound, "audit_key_call", later)
    monkeypatch.setattr(inbound, "enforce_key_limit", limiter)
    return now, later, limiter


def all_audits(now: AsyncMock, later: MagicMock) -> list[tuple[str, dict]]:
    """Every audit call as ``(action_type, kwargs)``, whichever writer took it."""
    out = []
    for c in now.await_args_list:
        out.append((c.args[1], c.kwargs))
    for c in later.call_args_list:
        out.append((c.args[2], c.kwargs))
    return out


def no_secret_in(audits) -> bool:
    blob = json.dumps([a[1] for a in audits], default=str)
    return "secret" not in blob and "key_hash" not in blob
