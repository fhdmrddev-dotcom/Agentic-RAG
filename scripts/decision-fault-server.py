"""Dev-only decision-engine fault server (Phase 294-01 Task 4, D-22 enabler, T-294-31).

Lets the live drive force every engine failure through the REAL app with ONE base URL and ONE
backend restart: point ``DECISION_ENGINE_FAULT_BASE_URL`` at this server (with
``ENVIRONMENT=local|development|dev|test`` in ``backend/.env``), restart the backend once, then
switch the failure at runtime::

    backend/venv/Scripts/python scripts/decision-fault-server.py --port 8765
    curl -X POST http://127.0.0.1:8765/_mode/429      # every following request answers 429
    curl http://127.0.0.1:8765/_mode                  # {"mode": "429"}

Modes: ``ok`` (a valid vendor-shaped answer: probabilities 0.9 / 0.05 alternating, so the prune
runs), ``401``, ``slow`` (sleeps ``--slow-seconds``, default 12 s, past every engine timeout, then
answers ok), ``429``, ``500``, ``malformed`` (a non-JSON 200), ``refusal`` (every answer a
refusal) and ``missing`` (the first answer dropped). The vendor shape is chosen by the path suffix:
``/api/alpha/decisions`` → Jev, ``/v1/decisions`` → OpenAI Decisions.

⛔ Binds 127.0.0.1 ONLY (there is no host option). ``/_mode`` is served only to a loopback client.
⛔ It never logs or echoes request headers or bodies: the access log is method, path and status.
   When the backend honours the override it sends a DUMMY bearer token, never a stored key —
   ``backend/tests/unit/test_294_fault_base_guard.py`` drives that through this server.
Stdlib only.
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable

BIND_HOST = "127.0.0.1"
MODES = ("ok", "401", "slow", "429", "500", "malformed", "refusal", "missing")
_LOOPBACK_CLIENTS = ("127.0.0.1", "::1")
JEV_PATH = "/api/alpha/decisions"
OPENAI_PATH = "/v1/decisions"


class FaultServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port: int, *, slow_seconds: float, mode: str):
        super().__init__((BIND_HOST, port), _Handler)
        self._mode = mode
        self._lock = threading.Lock()
        self.slow_seconds = slow_seconds
        # Test hook: called with (headers, body) for every decision request. None in normal use,
        # and nothing it receives is ever logged.
        self.observer: Callable[[Any, bytes], None] | None = None

    @property
    def mode(self) -> str:
        with self._lock:
            return self._mode

    def set_mode(self, mode: str) -> None:
        with self._lock:
            self._mode = mode


def _answers(path: str, body: dict, mode: str) -> dict:
    """A vendor-shaped decision response for ``ok`` / ``refusal`` / ``missing``."""
    if path.endswith(JEV_PATH):
        names = list((body.get("questions") or {}).keys())
        answers: dict[str, Any] = {}
        for i, name in enumerate(names):
            if mode == "missing" and i == 0:
                continue
            if mode == "refusal":       # Jev has no refusal type: an invalid answer is its nearest
                answers[name] = {"type": "refusal"}
            else:
                answers[name] = {"type": "noul", "noul": 0.9 if i % 2 == 0 else 0.05}
        return {"id": "fault-gen", "model": body.get("model"), "provider": "fault-server",
                "answers": answers, "usage": {"input_tokens": 10 * len(names), "output_tokens": 0, "cost": 0.0}}
    questions = body.get("questions") or []
    out = []
    for i, q in enumerate(questions):
        name = q.get("name") if isinstance(q, dict) else None
        if mode == "missing" and i == 0:
            continue
        if mode == "refusal":
            out.append({"type": "refusal", "name": name})
        else:
            out.append({"type": "predicate", "name": name, "probability": 0.9 if i % 2 == 0 else 0.05})
    return {"id": "fault-dec", "answers": out,
            "usage": {"input_tokens": 10 * len(out), "output_tokens": 0, "total_tokens": 10 * len(out)}}


class _Handler(BaseHTTPRequestHandler):
    server: FaultServer
    protocol_version = "HTTP/1.1"

    # ── never log headers or bodies ──────────────────────────────────────────────────────────
    def log_request(self, code: int | str = "-", size: int | str = "-") -> None:
        sys.stderr.write(f"{self.command} {self.path.split('?', 1)[0]} {code}\n")

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 — stdlib signature
        return

    def _send(self, status: int, payload: bytes, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _json(self, status: int, obj: Any) -> None:
        self._send(status, json.dumps(obj).encode("utf-8"))

    def _loopback(self) -> bool:
        return self.client_address[0] in _LOOPBACK_CLIENTS

    def do_GET(self) -> None:  # noqa: N802 — stdlib naming
        if self.path == "/_mode" and self._loopback():
            self._json(200, {"mode": self.server.mode})
            return
        self._json(404, {"error": {"code": 404, "message": "not found"}})

    def do_POST(self) -> None:  # noqa: N802 — stdlib naming
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if self.path.startswith("/_mode/"):
            if not self._loopback():
                self._json(403, {"error": {"code": 403, "message": "loopback only"}})
                return
            mode = self.path[len("/_mode/"):]
            if mode not in MODES:
                self._json(400, {"error": {"code": 400, "message": f"unknown mode; one of {list(MODES)}"}})
                return
            self.server.set_mode(mode)
            self._json(200, {"mode": mode})
            return
        if not (self.path.endswith(JEV_PATH) or self.path.endswith(OPENAI_PATH)):
            self._json(404, {"error": {"code": 404, "message": "not found"}})
            return
        observer = self.server.observer
        if observer is not None:
            observer(self.headers, raw)
        mode = self.server.mode
        if mode in ("401", "429", "500"):
            self._json(int(mode), {"error": {"code": int(mode), "message": f"forced {mode}"}})
            return
        if mode == "malformed":
            self._send(200, b"<html>forced malformed body</html>", "text/html")
            return
        if mode == "slow":
            time.sleep(self.server.slow_seconds)
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except ValueError:
            self._json(400, {"error": {"code": 400, "message": "request body is not JSON"}})
            return
        self._json(200, _answers(self.path, body, "ok" if mode == "slow" else mode))


def build_server(port: int = 8765, *, slow_seconds: float = 12.0, mode: str = "ok") -> FaultServer:
    if mode not in MODES:
        raise ValueError(f"unknown mode {mode!r}")
    return FaultServer(port, slow_seconds=slow_seconds, mode=mode)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Dev-only decision-engine fault server (127.0.0.1 only).")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--slow-seconds", type=float, default=12.0)
    parser.add_argument("--mode", choices=MODES, default="ok")
    args = parser.parse_args(argv)
    server = build_server(args.port, slow_seconds=args.slow_seconds, mode=args.mode)
    host, port = server.server_address[:2]
    sys.stderr.write(f"decision fault server on http://{host}:{port} (mode {args.mode}); "
                     f"POST /_mode/<{'|'.join(MODES)}> to switch\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
