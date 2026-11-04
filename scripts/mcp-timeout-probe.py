"""Phase 305-04 (D-43 / D-57; R-26; T-305-36) — how long will an MCP CLIENT wait for one tool call?

A STANDALONE probe, never imported or mounted by the app (``backend/app`` must not mention it).
It answers the one question 306 needs before it designs long-running tools: what does the installed
Claude Code do when a tool call takes 30, 90, 150 or 310 seconds over Streamable HTTP with JSON
responses (no progress channel)?

Two modes, run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/mcp-timeout-probe.py serve --port 8765
    backend/venv/Scripts/python scripts/mcp-timeout-probe.py drive --scratch <dir outside the repo> \
        --waits 30,90,150,310 --out .planning/phases/305-connect-claude-code-and-cursor/evidence/client-timeouts.txt

``serve`` starts a lowlevel SDK server (the app's own shape: ``mcp.server.Server``, stateless,
``json_response=True``) with ONE tool, ``wait_seconds(n)``, on ``127.0.0.1:<port>/mcp``, and logs
every call's start and finish to stderr. ``drive`` picks a free port, starts ``serve`` as a child
process, writes a ``--mcp-config`` file into ``--scratch``, and for each wait runs

    claude -p --strict-mcp-config --mcp-config <scratch>/probe.json \
        --allowedTools mcp__probe__wait_seconds "<ask for one wait_seconds(n) call>"

from inside ``--scratch`` (so no project instructions load), recording the wall time, the exit
code, whether the server saw the call finish, and what the client printed — classified as
``answered`` (the tool's text came back), ``backgrounded`` (the client said the call continues in
the background) or ``aborted`` (anything else: an error, a timeout, an empty reply). Then it stops
the server. It never touches the app, its database or its keys.

Exit codes: 0 every wait recorded · 2 harness error (no ``claude`` on PATH, the server did not start).
"""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import os
import pathlib
import shutil
import socket
import subprocess
import sys
import time

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]

DOCUMENTED = (
    "Claude Code documents (code.claude.com/docs/en/mcp, read in 305-RESEARCH R-26): MCP_TOOL_TIMEOUT "
    "defaults to about 28 h; an HTTP call with no response and no progress aborts after 5 min idle; a "
    "main-conversation call is moved to the background after 2 min (CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS)."
)


# ── serve ───────────────────────────────────────────────────────────────────────────────────


def serve(port: int) -> int:
    import uvicorn
    from mcp import types
    from mcp.server import Server
    from mcp.server.transport_security import TransportSecuritySettings

    def log(msg: str) -> None:
        print(f"[probe {time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)

    tool = types.Tool(
        name="wait_seconds",
        title="Wait",
        description="Waits n seconds, then answers 'waited n seconds'. A timeout probe.",
        input_schema={"type": "object", "properties": {"n": {"type": "integer", "minimum": 0,
                                                              "maximum": 900}},
                      "required": ["n"], "additionalProperties": False},
        annotations=types.ToolAnnotations(read_only_hint=True, destructive_hint=False,
                                          idempotent_hint=True, open_world_hint=False),
    )

    async def on_list_tools(ctx, params):
        return types.ListToolsResult(tools=[tool])

    async def on_call_tool(ctx, params: types.CallToolRequestParams):
        n = int((params.arguments or {}).get("n", 0))
        started = time.monotonic()
        log(f"CALL START n={n}")
        try:
            await asyncio.sleep(n)
        except BaseException:
            log(f"CALL CANCELLED n={n} after {time.monotonic() - started:.1f}s")
            raise
        log(f"CALL FINISH n={n} after {time.monotonic() - started:.1f}s")
        return types.CallToolResult(content=[types.TextContent(type="text", text=f"waited {n} seconds")])

    server = Server("probe", on_list_tools=on_list_tools, on_call_tool=on_call_tool)
    app = server.streamable_http_app(
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    log(f"serving on http://127.0.0.1:{port}/mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", timeout_keep_alive=900)
    return 0


# ── drive ───────────────────────────────────────────────────────────────────────────────────


def _free_port() -> int:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for_port(port: int, seconds: float = 30.0) -> bool:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        with contextlib.suppress(OSError), socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
        time.sleep(0.3)
    return False


def _as_text(value) -> str:
    """``TimeoutExpired.stdout``/``.stderr`` are BYTES even under ``text=True`` (305-REVIEW-04
    IN-04-03), so a killed run's partial output is decoded here rather than crashing the probe."""
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value


def _classify(stdout: str, n: int) -> str:
    text = stdout.lower()
    if f"waited {n} seconds" in text:
        return "answered"
    if "background" in text:
        return "backgrounded"
    return "aborted"


def drive(scratch: str, waits: list[int], out: str | None) -> int:
    claude = shutil.which("claude")
    if claude is None:
        print("harness error: no `claude` on PATH")
        return 2
    scratch_dir = pathlib.Path(scratch).resolve()
    if REPO_ROOT.resolve() in scratch_dir.parents:
        print("harness error: --scratch must be outside the repository")
        return 2
    scratch_dir.mkdir(parents=True, exist_ok=True)
    version = subprocess.run([claude, "--version"], capture_output=True, text=True).stdout.strip()
    port = _free_port()
    server_log = scratch_dir / "probe-server.log"
    with open(server_log, "w", encoding="utf-8") as log_fh:
        proc = subprocess.Popen([sys.executable, str(pathlib.Path(__file__).resolve()), "serve",
                                 "--port", str(port)], stdout=log_fh, stderr=log_fh)
        try:
            if not _wait_for_port(port):
                print("harness error: the probe server did not start")
                return 2
            config = scratch_dir / "probe.json"
            config.write_text(json.dumps({"mcpServers": {"probe": {
                "type": "http", "url": f"http://127.0.0.1:{port}/mcp"}}}), encoding="utf-8")
            rows = []
            for n in waits:
                prompt = (f"Call the probe tool wait_seconds exactly once with n={n}. Do not call any "
                          f"other tool. When it returns, reply with the tool's text only. If the call "
                          f"fails or is moved to the background, reply with what you were told, verbatim.")
                t0 = time.monotonic()
                try:
                    res = subprocess.run(
                        # the prompt FIRST: --mcp-config and --allowedTools are variadic and would
                        # swallow a trailing prompt as one more value
                        [claude, "-p", prompt, "--strict-mcp-config", f"--mcp-config={config}",
                         "--allowedTools=mcp__probe__wait_seconds"],
                        capture_output=True, text=True, cwd=str(scratch_dir), timeout=n + 600,
                        encoding="utf-8", errors="replace",
                    )
                    rc, stdout, stderr = res.returncode, res.stdout, res.stderr
                except subprocess.TimeoutExpired as exc:
                    rc, stdout, stderr = "killed", _as_text(exc.stdout), _as_text(exc.stderr)
                wall = time.monotonic() - t0
                log_fh.flush()
                server_text = server_log.read_text(encoding="utf-8", errors="replace")
                finished = f"CALL FINISH n={n} " in server_text
                started = f"CALL START n={n}" in server_text
                stdout, stderr = _as_text(stdout), _as_text(stderr)
                outcome = _classify(stdout, n)
                reply = " ".join((stdout or "").split())[:200]
                rows.append({"n": n, "outcome": outcome, "wall_s": round(wall, 1), "exit": rc,
                             "server_started": started, "server_finished": finished, "reply": reply,
                             "stderr": " ".join((stderr or "").split())[:200]})
                print(f"wait {n:>3}s: {outcome:<12} wall {wall:7.1f}s exit {rc} "
                      f"server start={started} finish={finished} | {reply} | stderr: "
                      f"{rows[-1]['stderr']}", flush=True)
        finally:
            proc.terminate()
            with contextlib.suppress(subprocess.TimeoutExpired):
                proc.wait(timeout=10)
            if proc.poll() is None:
                proc.kill()
    lines = [
        "Phase 305-04 — MCP client timeout probe (D-43 / D-57, R-26), recorded for Phase 306",
        f"client: {version}  ·  transport: Streamable HTTP, stateless, JSON responses (no progress)",
        f"driven: claude -p --strict-mcp-config --mcp-config <scratch>/probe.json "
        f"--allowedTools mcp__probe__wait_seconds  ·  probe server: scripts/mcp-timeout-probe.py",
        "",
    ]
    for r in rows:
        lines.append(
            f"wait {r['n']:>3} s | outcome {r['outcome']:<12} | wall {r['wall_s']:>6} s | "
            f"exit {r['exit']} | server saw start {r['server_started']}, finish {r['server_finished']} | "
            f"client said: {r['reply'] or '(nothing)'}"
        )
    lines += ["", DOCUMENTED]
    text = "\n".join(lines) + "\n"
    if out:
        pathlib.Path(out).write_text(text, encoding="utf-8")
    print(text)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="mode", required=True)
    s = sub.add_parser("serve")
    s.add_argument("--port", type=int, required=True)
    d = sub.add_parser("drive")
    d.add_argument("--scratch", required=True)
    d.add_argument("--waits", default="30,90,150,310")
    d.add_argument("--out", default=None)
    args = ap.parse_args()
    if args.mode == "serve":
        return serve(args.port)
    return drive(args.scratch, [int(x) for x in args.waits.split(",") if x.strip()], args.out)


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    sys.exit(main())
