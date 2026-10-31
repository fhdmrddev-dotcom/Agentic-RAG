"""Phase 306-05 (D-20 / D-21 / D-37 / D-38; T-306-34) — the verification tools, dry-run.

* ``scripts/uat-306-ask-roster.py --dry-run`` prints EXACTLY one row per provider in the 8-row roster
  (the seven native providers + OpenRouter), each model id read from ``MODEL_CAPABILITIES`` at run
  time — never retyped — plus the two prompts it would send. A provider with no registry-backed id
  is printed ⛔ with its reason, never dropped; Moonshot carries its known blocker.
* ``scripts/burst-306-outside-starts.py --dry-run --count 30`` prints its plan (how many MCP asks,
  how many /inbound starts, the env vars it reads) and exits 0. It names env vars, never values.
* The app never imports either script (T-306-34).

Both scripts are RUN here only with ``--dry-run``: a live roster or burst spends provider money and
needs a running backend, so those rows are OWED in 306-VALIDATION.md (the 305-04 pattern).
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
ROSTER = REPO / "scripts" / "uat-306-ask-roster.py"
BURST = REPO / "scripts" / "burst-306-outside-starts.py"
PROVIDERS = ("openai", "anthropic", "google", "deepseek", "zhipu", "minimax", "moonshot", "openrouter")


def _run(script: Path, *args: str, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(script), *args], cwd=REPO, capture_output=True, text=True,
        encoding="utf-8", timeout=120, env={**os.environ, **(env or {})},
    )


def _rows(out: str) -> list[str]:
    return [ln for ln in out.splitlines() if ln.startswith("ROW ")]


def test_the_roster_dry_run_prints_one_row_per_provider():
    r = _run(ROSTER, "--dry-run")
    assert r.returncode == 0, r.stderr
    rows = _rows(r.stdout)
    providers = [ln.split()[2] for ln in rows]
    assert sorted(providers) == sorted(PROVIDERS), rows
    assert len(rows) == 8


def test_every_roster_id_is_read_from_the_registry():
    from app.config import MODEL_CAPABILITIES

    r = _run(ROSTER, "--dry-run")
    assert len(_rows(r.stdout)) == 8, r.stdout + r.stderr
    for ln in _rows(r.stdout):
        if "⛔" in ln and "no registry-backed id" in ln:
            continue
        ids = re.findall(r"model=(\S+)", ln)
        assert ids, ln
        for mid in ids:
            assert mid in MODEL_CAPABILITIES, (mid, ln)
            assert MODEL_CAPABILITIES[mid]["provider"] == ln.split()[2], ln


def test_the_roster_names_both_anthropic_candidates_and_the_moonshot_blocker():
    out = _run(ROSTER, "--dry-run").stdout
    anthropic = next(ln for ln in _rows(out) if ln.split()[2] == "anthropic")
    assert "claude-opus-" in anthropic, anthropic
    moonshot = next(ln for ln in _rows(out) if ln.split()[2] == "moonshot")
    assert "BUG-261024-01" in moonshot
    openrouter = next(ln for ln in _rows(out) if ln.split()[2] == "openrouter")
    assert "STRUCTURED" in openrouter


def test_the_roster_prints_the_two_prompts_and_writes_nothing():
    r = _run(ROSTER, "--dry-run")
    assert "PROMPT power:" in r.stdout and "PROMPT benign:" in r.stdout
    assert "execute_code" in r.stdout  # the power-tool request names a tool outside the allow-list
    assert "wrote" not in r.stdout.lower()


def test_the_roster_without_a_key_refuses_to_run_live():
    r = _run(ROSTER)
    assert r.returncode == 2, (r.returncode, r.stdout, r.stderr)
    assert "--key-id" in (r.stderr + r.stdout)


def test_the_burst_dry_run_prints_its_plan():
    secret = "srl_mcp_" + "x" * 40
    r = _run(BURST, "--dry-run", "--count", "30", env={"SYREL_MCP_KEY": secret})
    assert r.returncode == 0, r.stderr
    assert "PLAN mcp_asks=" in r.stdout and "PLAN inbound_starts=" in r.stdout
    asks = int(re.search(r"PLAN mcp_asks=(\d+)", r.stdout).group(1))
    starts = int(re.search(r"PLAN inbound_starts=(\d+)", r.stdout).group(1))
    assert asks + starts >= 30
    for env in ("SYREL_MCP_KEY", "SYREL_WORKFLOW_KEY", "SYREL_API_BASE"):
        assert env in r.stdout
    assert secret not in r.stdout + r.stderr, "a secret is never printed"


def test_the_burst_refuses_fewer_than_thirty_starts():
    r = _run(BURST, "--dry-run", "--count", "10")
    assert r.returncode == 2
    assert "at least 30" in r.stderr, r.stderr


@pytest.mark.parametrize("needle", ["uat-306", "burst-306", "uat_306", "burst_306"])
def test_the_app_never_references_the_scripts(needle):
    hits = [p for p in (REPO / "backend" / "app").rglob("*.py") if needle in p.read_text(encoding="utf-8")]
    assert hits == []
