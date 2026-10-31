"""Phase 305-01 — the shared harness for the LIVE MCP suites.

``serve(workers=N)`` spawns a real ``uvicorn`` on a free port serving
``tests.fixtures.phase305.serve_app:app`` — the real ``app.main.app`` with ``RUN_BOOT_SWEEPS`` off,
so a test server never sweeps, re-drives or drains the SHARED local database (SEED-363). The
background loops that CLAIM shared work (ingest worker, scheduler, watch loop, retention sweep) are
switched off through their env vars; ``BACKEND_PUBLIC_URL`` is the server's own loopback address
and ``ENVIRONMENT`` is non-production, so ``/mcp`` mounts. Access lines carry ``%(process)d``
(``tests/fixtures/phase305/uvicorn_pid_log.json``). Teardown is unconditional and kills the WHOLE
process tree (on Windows the uvicorn workers are separate processes a parent kill leaves behind).

``McpWorld`` seeds one org, one GoTrue user who is a plain ``member`` of it, and mints real keys
through the app's own ``mint_key`` + ``create_api_key``. Everything is deleted in ``cleanup``.
⛔ No role-``anon`` statement anywhere (BUG-261031-01).
"""
from __future__ import annotations

import contextlib
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid4

import httpx

BACKEND = Path(__file__).resolve().parents[2]
LOG_CONFIG = BACKEND / "tests" / "fixtures" / "phase305" / "uvicorn_pid_log.json"
ACCESS_RE = re.compile(r'ACCESS pid=(\d+) \S+ - "(\w+) (\S+) HTTP/[\d.]+" (\d+)')

_OFF = {
    "INGEST_WORKER_ENABLED": "false",
    "SCHEDULER_PROCESS_ENABLED": "false",
    "WATCH_PROCESS_ENABLED": "false",
    "RETENTION_SWEEP_ENABLED": "false",
}


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _kill_tree(proc: subprocess.Popen) -> None:
    try:
        import psutil  # type: ignore
    except Exception:  # pragma: no cover - psutil is present in backend/venv
        psutil = None
    children = []
    if psutil is not None:
        try:
            children = psutil.Process(proc.pid).children(recursive=True)
        except Exception:
            children = []
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)
    for child in children:
        try:
            child.kill()
        except Exception:
            pass
    if psutil is not None:
        psutil.wait_procs(children, timeout=10)


@dataclass
class LiveServer:
    base_url: str
    port: int
    log_path: str
    proc: subprocess.Popen

    def log(self) -> str:
        with open(self.log_path, "rb") as fh:
            return fh.read().decode(errors="replace")

    def access(self) -> list[tuple[int, str, str, int]]:
        return [(int(p), m, path, int(s)) for p, m, path, s in ACCESS_RE.findall(self.log())]


@contextlib.contextmanager
def serve(*, workers: int, ready_timeout: float = 90.0):
    port = free_port()
    base_url = f"http://127.0.0.1:{port}"
    env = {k: v for k, v in os.environ.items() if k not in ("MOCK_LLM_MODE", "ENABLE_TEST_FIXTURES")}
    env.update(_OFF)
    env["BACKEND_PUBLIC_URL"] = base_url
    env["ENVIRONMENT"] = "development"
    env["PYTHONUNBUFFERED"] = "1"
    log_file = tempfile.NamedTemporaryFile(mode="w+b", prefix="uvicorn_305_", suffix=".log", delete=False)
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "tests.fixtures.phase305.serve_app:app",
         "--host", "127.0.0.1", "--port", str(port), "--workers", str(workers),
         "--log-config", str(LOG_CONFIG)],
        cwd=str(BACKEND), env=env, stdout=log_file, stderr=log_file,
    )
    server = LiveServer(base_url=base_url, port=port, log_path=log_file.name, proc=proc)
    try:
        deadline = time.monotonic() + ready_timeout
        ready = False
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                break
            try:
                if httpx.get(f"{base_url}/health", timeout=2.0).status_code == 200:
                    ready = True
                    break
            except httpx.HTTPError:
                pass
            time.sleep(0.5)
        if not ready:
            raise RuntimeError(f"uvicorn did not become ready on {base_url}:\n{server.log()[-3000:]}")
        if workers > 1:
            # Every worker must have finished its lifespan before the proof starts.
            deadline = time.monotonic() + ready_timeout
            while time.monotonic() < deadline and server.log().count("Application startup complete") < workers:
                time.sleep(0.5)
        yield server
    finally:
        _kill_tree(proc)
        log_file.close()
        with contextlib.suppress(OSError):
            os.unlink(log_file.name)


# ── the MCP wire ──────────────────────────────────────────────────────────────────────────────
LEGACY = "2025-11-25"
MODERN = "2026-07-28"
ACCEPT = "application/json, text/event-stream"
MODERN_META = {
    "io.modelcontextprotocol/protocolVersion": MODERN,
    "io.modelcontextprotocol/clientInfo": {"name": "test-305-live", "version": "1"},
    "io.modelcontextprotocol/clientCapabilities": {},
}


def mcp_headers(key: str | None, *, era: str | None = None, method: str | None = None) -> dict:
    h = {"accept": ACCEPT, "content-type": "application/json"}
    if key is not None:
        h["authorization"] = f"Bearer {key}"
    if era is not None:
        h["mcp-protocol-version"] = era
    if era == MODERN and method:
        h["mcp-method"] = method
    return h


def initialize_body(rid: int = 1) -> dict:
    return {"jsonrpc": "2.0", "id": rid, "method": "initialize",
            "params": {"protocolVersion": LEGACY, "capabilities": {},
                       "clientInfo": {"name": "test-305-live", "version": "1"}}}


# ── the world ─────────────────────────────────────────────────────────────────────────────────


@dataclass
class McpWorld:
    pool: object
    org: str = ""
    user: str = ""
    user_token: str = ""
    users: object = None
    keys: list[str] = field(default_factory=list)

    async def mint(self, *, kind: str = "mcp", expires_in_days: int = 30) -> tuple[str, str]:
        """A real key for the user through the app's own mint + insert: ``(secret, key_id)``."""
        from app.db import api_keys as api_keys_db
        from app.security import api_key_auth
        from app.services.mcp_tool_catalogue import PRESETS

        minted = api_key_auth.mint_key(kind)
        mcp = kind == "mcp"
        row = await api_keys_db.create_api_key(
            self.pool,
            org_id=UUID(self.org),
            user_id=UUID(self.user),
            label=f"305-01 {kind} {uuid4().hex[:8]}",
            key_prefix=minted.key_prefix,
            key_hash=minted.key_hash,
            workflows=[] if mcp else [{"id": str(uuid4()), "name": "305-01 workflow"}],
            expires_at=(datetime.now(timezone.utc) + timedelta(days=expires_in_days)) if mcp else None,
            kind=kind,
            tools=list(PRESETS["read"].tools) if mcp else None,
        )
        key_id = str(row["id"])
        self.keys.append(key_id)
        return minted.secret, key_id

    async def audit_rows(self) -> list[dict]:
        rows = await self.pool.fetch(
            "SELECT action_type, metadata FROM public.audit_log WHERE user_id = $1 "
            "OR metadata->>'api_key_id' = ANY($2::text[]) ORDER BY created_at",
            UUID(self.user), self.keys,
        )
        return [dict(r) for r in rows]

    async def cleanup(self) -> None:
        p = self.pool
        for sql, arg in (
            ("DELETE FROM public.audit_log WHERE user_id = $1", UUID(self.user) if self.user else None),
            ("DELETE FROM public.api_keys WHERE user_id = $1", UUID(self.user) if self.user else None),
        ):
            if arg is not None:
                with contextlib.suppress(Exception):
                    await p.execute(sql, arg)
        if self.users is not None:
            with contextlib.suppress(Exception):
                await self.users.drop_all()
        if self.org:
            with contextlib.suppress(Exception):
                await p.execute("DELETE FROM public.organizations WHERE id = $1", UUID(self.org))


@contextlib.asynccontextmanager
async def mcp_world(pool):
    from tests.integration._271_gotrue_users import GoTrueUsers, create_org, require_gotrue

    require_gotrue()
    w = McpWorld(pool)
    try:
        w.org = await create_org(pool, "p305-01")
        w.users = GoTrueUsers(pool)
        w.user, w.user_token = await w.users.create_signed_in_user(w.org, role="member", label="p30501")
        yield w
    finally:
        await w.cleanup()
