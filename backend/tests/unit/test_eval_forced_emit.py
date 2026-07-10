"""Phase 122 (MP-03 / D-122-06 / SC#3) — STRUCTURE-ONLY test for the --forced-emit
scoreboard matrix in ``scripts/eval_cross_provider.py``.

This test proves ONLY that the writer / axis-scoring / localhost-gate are correct — it
injects a FAKE forced_emit result (a known rung outcome) and asserts the scoring + the
dated json/md artifact + the DOCUMENTED-clears-the-gate contract. It NEVER makes a live
provider call and needs NO API keys.

The LIVE proof is the operator run (``scripts/eval_cross_provider.py --forced-emit``,
D-122-06) — CI/keys-in-secrets are explicitly rejected (cost + flakiness). This is the
fake-gateway analog of ``test_103_forced_emit_strict.py``: structure, not providers.

``eval_cross_provider.py`` is a SCRIPT (lives under ``scripts/``, not an importable
package), so it is loaded via ``importlib`` from the repo root.
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys

import pytest

# ── load the script module (it is not on the import path) ──────────────────────
_REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
_SCRIPT = _REPO_ROOT / "scripts" / "eval_cross_provider.py"


def _load_ecp():
    """Import scripts/eval_cross_provider.py as a module (cached on sys.modules)."""
    if "ecp_under_test" in sys.modules:
        return sys.modules["ecp_under_test"]
    spec = importlib.util.spec_from_file_location("ecp_under_test", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["ecp_under_test"] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


ecp = _load_ecp()


# ── fake forced_emit RESULT dicts (the ladder's output shape) ──────────────────
# Mirrors forced_emit's success/failure dict: emitted / emit_rung / forced / failure.


def _won_on_top_rung(rung: str) -> dict:
    """A result that won on the tier's TOP rung (no recovery needed)."""
    return {
        "emitted": object(),  # any non-None stands for a validated emission
        "emit_rung": rung,
        "forced": rung != "coerce",
        "recovered_from_narration": False,
        "truncated": False,
        "failure": None,
    }


def _won_on_lower_rung(rung: str) -> dict:
    """A result that won on a LOWER rung after a higher rung failed (recovery DID fire)."""
    return {
        "emitted": object(),
        "emit_rung": rung,
        "forced": rung != "coerce",
        "recovered_from_narration": rung == "coerce",
        "truncated": False,
        "failure": None,
    }


def _honest_fail(reason: str = "model_failed_to_emit") -> dict:
    """The honest-fail floor: emitted None + a non-None failure reason (never silent)."""
    return {
        "emitted": None,
        "emit_rung": None,
        "forced": False,
        "recovered_from_narration": False,
        "truncated": False,
        "failure": reason,
    }


# ── 1. axis scoring ────────────────────────────────────────────────────────────


def test_axis_scoring_force_pass_on_top_rung():
    """A force_strict-tier model that won on its TOP rung (strict_force) scores
    force=PASS (and recovery=PASS — no recovery was needed)."""
    axes = ecp.score_forced_emit_axes(_won_on_top_rung("strict_force"), "force_strict")
    assert axes["force"] == "PASS"
    assert axes["trigger"] == "PASS"
    assert axes["recovery"] == "PASS"
    assert axes["honest_fail"] == "PASS"


def test_axis_scoring_recovery_pass_on_lower_rung():
    """A force_strict-tier model whose strict rung 400'd but recovered via coerce
    scores recovery=PASS and force=FAIL (it did NOT win on the declared top rung)."""
    axes = ecp.score_forced_emit_axes(_won_on_lower_rung("coerce"), "force_strict")
    assert axes["recovery"] == "PASS"
    assert axes["force"] == "FAIL"  # won on coerce, not the strict_force top rung
    assert axes["trigger"] == "PASS"


def test_axis_scoring_force_pass_for_coerce_tier():
    """For a coerce-tier model, the TOP rung IS coerce — winning on coerce is force=PASS
    (the declared top rung), not a recovery."""
    axes = ecp.score_forced_emit_axes(_won_on_top_rung("coerce"), "coerce")
    assert axes["force"] == "PASS"
    assert axes["recovery"] == "PASS"


def test_axis_scoring_honest_fail_pass_on_clean_failure():
    """When nothing won, a clean _failure (emitted None + a failure reason) scores
    honest_fail=PASS and trigger=PASS (the model was reached, it failed to emit)."""
    axes = ecp.score_forced_emit_axes(_honest_fail("model_failed_to_emit"), "force")
    assert axes["honest_fail"] == "PASS"
    assert axes["trigger"] == "PASS"
    assert axes["force"] == "FAIL"
    assert axes["recovery"] == "FAIL"


def test_axis_scoring_trigger_fail_on_provider_error():
    """A provider_error on EVERY rung (the model was never reached) scores trigger=FAIL
    but honest_fail=PASS (the ladder still returned a clean, non-silent failure)."""
    axes = ecp.score_forced_emit_axes(_honest_fail("provider_error"), "force")
    assert axes["trigger"] == "FAIL"
    assert axes["honest_fail"] == "PASS"


# ── 2. the dated artifact writer (json + md twin) ──────────────────────────────


def test_artifact_written_twin_with_cells(tmp_path, monkeypatch):
    """emit_forced_emit_scoreboard writes BOTH a .json and a .md twin with the
    PASS/FAIL/DOCUMENTED cells (mirrors the capability-table shape)."""
    monkeypatch.setattr(ecp, "_eval_artifact_dir", lambda: tmp_path)

    cells = [
        ecp._build_forced_emit_cell(
            "openai", "gpt-5.4-mini", "easy",
            _won_on_top_rung("strict_force"), "force_strict", gated=True,
        ),
        ecp._build_forced_emit_cell(
            "deepseek", "deepseek-v4-flash", "hard",
            _won_on_lower_rung("coerce"), "force", gated=True,
        ),
    ]
    ecp.emit_forced_emit_scoreboard(cells, full_matrix=True)

    from datetime import date
    stamp = date.today().isoformat()
    json_path = tmp_path / f"forced-emit-scoreboard-{stamp}.json"
    md_path = tmp_path / f"forced-emit-scoreboard-{stamp}.md"
    assert json_path.exists()
    assert md_path.exists()

    import json
    written = json.loads(json_path.read_text(encoding="utf-8"))
    assert len(written) == 2
    assert written[0]["provider"] == "openai"
    assert written[0]["axes"]["force"] == "PASS"
    assert set(written[0]["axes"].keys()) == set(ecp.FORCED_EMIT_AXES)
    # The md twin carries the table header + a PASS/FAIL token.
    md = md_path.read_text(encoding="utf-8")
    assert "| provider | difficulty | tier | trigger | force | recovery" in md
    assert "PASS" in md


def test_artifact_not_written_on_partial_run(tmp_path, monkeypatch):
    """A partial run (full_matrix=False) writes NOTHING — a single-provider re-run must
    never clobber a full scoreboard from the same day (mirrors emit_capability_table)."""
    monkeypatch.setattr(ecp, "_eval_artifact_dir", lambda: tmp_path)
    ecp.emit_forced_emit_scoreboard(
        [ecp._build_forced_emit_cell(
            "openai", "gpt-5.4-mini", "easy",
            _won_on_top_rung("strict_force"), "force_strict", gated=True,
        )],
        full_matrix=False,
    )
    assert list(tmp_path.glob("forced-emit-scoreboard-*")) == []


# ── 3. the localhost hard-gate ─────────────────────────────────────────────────


def test_localhost_gate_raises_systemexit_on_cloud_url(monkeypatch):
    """assert_localhost_only() raises SystemExit when SUPABASE_URL is a cloud URL —
    the eval must NEVER drive against production (Tampering, T-122-03-01)."""
    monkeypatch.setenv("SUPABASE_URL", "https://abcdefgh.supabase.co")
    with pytest.raises(SystemExit):
        ecp.assert_localhost_only()


def test_localhost_gate_allows_localhost(monkeypatch):
    """The gate ALLOWS a localhost SUPABASE_URL (no raise)."""
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:54321")
    ecp.assert_localhost_only()  # must not raise


# ── 4. DOCUMENTED clears the gate ──────────────────────────────────────────────


def test_documented_axis_clears_the_gate():
    """A cell whose FAILing axis is marked DOCUMENTED (a known-limitation row whose
    declared emit_tier already reflects reality) CLEARS the gate — _cell_gate_ok True."""
    cell = ecp._build_forced_emit_cell(
        "deepseek", "deepseek-v4-flash", "hard",
        _won_on_lower_rung("coerce"), "force", gated=True,
        documented=[{
            "axis": "force",
            "note": "deepseek 400s on the additionalProperties confidence schema; "
                    "recovers via coerce — declared tier 'force' reflects this",
            "evidence": "BUG-260615-01",
        }],
    )
    # force was FAIL (won on coerce, not the top rung) but is DOCUMENTED -> clears.
    assert cell["axes"]["force"] == "DOCUMENTED"
    assert ecp._cell_gate_ok(cell) is True


def test_undocumented_fail_fails_the_gate():
    """A FAIL axis with NO documented note FAILS the cell (the gate is honest — a real
    regression is not silently cleared)."""
    cell = ecp._build_forced_emit_cell(
        "openai", "gpt-5.4-mini", "hard",
        _honest_fail("provider_error"), "force_strict", gated=True,
    )
    # trigger=FAIL (provider_error, never reached) and NOT documented -> fails.
    assert cell["axes"]["trigger"] == "FAIL"
    assert ecp._cell_gate_ok(cell) is False


# ── 5. live-input shape guards (122 live-UAT regression) ───────────────────────
# The structure tests above mock the forced_emit RESULT, so they never exercised the
# real tool fixtures / system prompt against a provider — exactly the blind spot
# code-review WR-04 named. The 122 live operator run found TWO input defects the mocks
# hid: the EASY/HARD tool defs omitted the openai-compat-required ``type: "function"``
# wrapper (→ openai/deepseek/moonshot/zhipu/minimax 400 "missing tools[0].type", read
# as a cross-provider emission failure), and an EMPTY ``system_prompt`` 400'd anthropic's
# forced rung ("cache_control cannot be set for empty text blocks"), masking its true
# forced-emit capability behind a coerce descent. These guards pin both input shapes.


def test_forced_emit_tools_carry_type_function():
    """Every tool in _forced_emit_schemas() MUST carry ``type: "function"`` — the
    openai-compat tools API rejects a bare ``{"function": {...}}`` with a 400
    ("missing tools[0].type"), which masquerades as a cross-provider emission failure."""
    schemas = ecp._forced_emit_schemas()
    assert set(schemas) >= {"easy", "hard"}
    for difficulty, spec in schemas.items():
        for tool in spec["tools"]:
            assert tool.get("type") == "function", (
                f"{difficulty} tool missing type=function (openai-compat 400 trap)"
            )
            assert tool["function"]["name"] == spec["emitter"]


def test_forced_emit_system_prompt_is_non_empty():
    """The forced shot MUST send a non-empty system prompt — an empty system text block
    400s anthropic's forced rung (cache_control on empty block), masking its true
    forced-emit capability behind a coerce descent."""
    assert ecp._FORCED_EMIT_SYSTEM.strip(), "forced-emit system prompt must be non-empty"
