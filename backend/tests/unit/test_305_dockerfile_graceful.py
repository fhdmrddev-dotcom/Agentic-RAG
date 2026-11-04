"""Phase 305 / D-48 / T-305-22 — the image's CMD bounds graceful shutdown.

sse-starlette 3.0.3 (forced by the official ``mcp`` SDK) no longer ends open
streams when uvicorn receives its exit signal (upstream sysid/sse-starlette
#149). Without ``--timeout-graceful-shutdown`` uvicorn waits on every open chat
stream until Docker's SIGKILL, and the lifespan shutdown hooks (drainer stop,
``set_app_shutting_down``) never run. This test reads the CMD the image ships
and pins the flag inside the SAME ``exec uvicorn`` string, next to the
multi-worker default it must not displace.
"""

from __future__ import annotations

import re
from pathlib import Path

DOCKERFILE = Path(__file__).resolve().parents[2] / "Dockerfile"


def _cmd_lines() -> list[str]:
    text = DOCKERFILE.read_text(encoding="utf-8")
    return [ln for ln in text.splitlines() if ln.lstrip().startswith("CMD")]


def test_exactly_one_cmd_line():
    assert len(_cmd_lines()) == 1, _cmd_lines()


def test_cmd_carries_graceful_timeout_in_the_exec_string():
    (cmd,) = _cmd_lines()
    exec_strings = re.findall(r'"(exec uvicorn[^"]*)"', cmd)
    assert len(exec_strings) == 1, cmd
    exec_string = exec_strings[0]
    assert "--timeout-graceful-shutdown 5" in exec_string, exec_string
    assert "--workers ${WORKER_COUNT:-2}" in exec_string, exec_string


def test_graceful_timeout_stays_below_the_compose_stop_grace():
    """The container must outlive the graceful window plus the shutdown hooks."""
    compose = (DOCKERFILE.parents[1] / "docker-compose.prod.yml").read_text(encoding="utf-8")
    m = re.search(r"stop_grace_period:\s*(\d+)s", compose)
    assert m, "docker-compose.prod.yml backend has no stop_grace_period"
    assert int(m.group(1)) > 5
