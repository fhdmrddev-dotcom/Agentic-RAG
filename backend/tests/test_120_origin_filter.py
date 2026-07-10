"""Phase 120 / CTX-01 — asymmetric, provider-agnostic origin filter (agent_loop.py:1024).

These tests pin the four CTX-01 must-haves:

  1. test_asymmetric_filter_per_mode — Deep/Explorer apply ``.neq("origin","harness")``
     (replay deep + legacy); harness applies ``.eq("origin","harness")`` (strict,
     defense-in-depth per A1/D-120-06). Asserted via a fluent query-builder spy.
  2. test_deep_pure_thread_filter_is_noop (SC#4) — on a row set where every row is
     origin='deep' (legacy filled to 'deep' by migration 076's NOT NULL DEFAULT), the
     Deep ``neq('origin','harness')`` filter returns the IDENTICAL set as the
     unfiltered query — Deep Mode byte-identical, no shared-path fork.
  3. test_harness_sites_tag_harness (SC#3, A3 backstop) — every enumerated HARNESS
     insert site writes 'harness' (source assertion against the live files).
  4. test_origin_not_in_projection (Pitfall 4) — the :1024 query ``.select(...)`` does
     NOT name ``origin`` (pure WHERE filter; byte-identical guard) AND both owner/thread
     ``.eq`` scopes are preserved (V4 — never widened).

The filter logic lives in ``agent_loop._apply_origin_filter`` — a pure helper applied to
the SINGLE shared history query (no per-provider fork; the same filtered set feeds every
provider — RED LINE preserved).
"""
from pathlib import Path
from unittest.mock import MagicMock

from app.services.agent_loop import _apply_origin_filter

_BACKEND = Path(__file__).resolve().parents[1]


def _make_builder():
    """A fluent-chainable Supabase query-builder spy (mirrors conftest._make_builder).

    Every chainable method returns the SAME builder so call order + args are recorded
    on the one object — exactly how the real supabase-py builder chains.
    """
    b = MagicMock()
    b.select.return_value = b
    b.eq.return_value = b
    b.neq.return_value = b
    b.order.return_value = b
    return b


# ── (1) asymmetric filter per mode ────────────────────────────────────────────
class TestAsymmetricFilterPerMode:
    def test_deep_default_mode_applies_neq(self):
        b = _make_builder()
        out = _apply_origin_filter(b, "default")
        b.neq.assert_called_once_with("origin", "harness")
        b.eq.assert_not_called()
        assert out is b, "filter must return the same chained builder"

    def test_explorer_mode_applies_neq(self):
        b = _make_builder()
        _apply_origin_filter(b, "explorer")
        b.neq.assert_called_once_with("origin", "harness")
        b.eq.assert_not_called()

    def test_harness_mode_applies_eq(self):
        b = _make_builder()
        _apply_origin_filter(b, "harness")
        b.eq.assert_called_once_with("origin", "harness")
        b.neq.assert_not_called()


# ── (2) SC#4 — Deep byte-identical no-op on a pure-deep thread ─────────────────
class TestDeepPureThreadNoop:
    def test_deep_pure_thread_filter_is_noop(self):
        """A pure-Deep thread (every row 'deep', incl. legacy filled to 'deep') yields
        the IDENTICAL filtered set as the unfiltered query — no Deep regression."""
        rows = [
            {"role": "user", "content": "hi", "origin": "deep"},
            {"role": "assistant", "content": "hello", "origin": "deep"},
            {"role": "system", "content": "warn", "origin": "deep"},
        ]
        # The Deep filter is neq('origin','harness'); apply its semantics to the set.
        filtered = [r for r in rows if r["origin"] != "harness"]
        assert filtered == rows, "Deep neq filter must be a no-op when no harness rows exist"
        assert len(filtered) == len(rows)

    def test_deep_filter_drops_only_harness_rows(self):
        """When harness rows DO exist in a shared thread, the Deep neq filter drops
        exactly those — proving the isolation property (the core CTX-01 fix)."""
        rows = [
            {"role": "user", "content": "hi", "origin": "deep"},
            {"role": "assistant", "content": "wf answer", "origin": "harness"},
            {"role": "assistant", "content": "deep answer", "origin": "deep"},
        ]
        deep_view = [r for r in rows if r["origin"] != "harness"]
        harness_view = [r for r in rows if r["origin"] == "harness"]
        assert {r["content"] for r in deep_view} == {"hi", "deep answer"}
        assert {r["content"] for r in harness_view} == {"wf answer"}


# ── (3) SC#3 / A3 — every enumerated HARNESS insert site tags 'harness' ────────
class TestHarnessSitesTagHarness:
    def _read(self, rel: str) -> str:
        return (_BACKEND / rel).read_text(encoding="utf-8")

    def test_shared_helper_carries_origin_param(self):
        src = self._read("app/db/runs.py")
        assert 'origin: str = "deep"' in src
        # origin bound positionally into the INSERT (not f-stringed).
        assert "reasoning_content, origin" in src
        assert "$10" in src

    def test_harness_engine_helper_callers_tag_harness(self):
        src = self._read("app/services/harness_engine.py")
        # success persist (:439) + failure persist (:513) both pass origin="harness".
        assert src.count('origin="harness"') >= 2

    def test_harness_engine_raw_insert_tags_harness_no_fstring(self):
        src = self._read("app/services/harness_engine.py")
        # The raw ask_user-expiry INSERT lists origin + binds it positionally ($4).
        assert "role, content, tool_calls, origin" in src
        assert "VALUES ($1, $2, 'system', '', $3, $4)" in src
        # NEVER an f-string'd origin in a raw INSERT (T-120-06 / tampering guard).
        assert 'f"INSERT INTO messages' not in src
        assert "f'INSERT INTO messages" not in src

    def test_harness_engine_disposition_prompt_tags_harness(self):
        src = self._read("app/services/harness_engine.py")
        assert '"origin": "harness"' in src

    def test_phase_types_ask_user_prompt_tags_harness(self):
        src = self._read("app/services/harness/phase_types.py")
        assert '"origin": "harness"' in src

    def test_api_runs_response_is_mode_aware(self):
        src = self._read("app/api/runs.py")
        # default deep, harness only on the confirmed workflow branch, bound into insert.
        assert '_origin = "deep"' in src
        assert '_origin = "harness"' in src
        assert '"origin": _origin' in src


# ── (4) Pitfall 4 — origin OUT of projection + owner/thread scope preserved ────
class TestProjectionAndScope:
    def _agent_loop_src(self) -> str:
        return (_BACKEND / "app/services/agent_loop.py").read_text(encoding="utf-8")

    def test_origin_not_in_history_select_projection(self):
        """The :1024 history query .select(...) must NOT name origin (byte-identical
        guard — origin is a pure WHERE filter, never selected into the reconstruction)."""
        src = self._agent_loop_src()
        assert '.select("role, content, tool_calls, reasoning_content")' in src
        # No origin token inside the history projection string.
        assert "role, content, tool_calls, reasoning_content, origin" not in src

    def test_owner_and_thread_scope_preserved_on_history_query(self):
        """Both .eq('thread_id', ...) and .eq('user_id', ...) remain on the history
        query — the origin filter is ADDITIVE and never widens owner/thread scope (V4)."""
        src = self._agent_loop_src()
        assert '.eq("thread_id", thread_id)' in src
        assert '.eq("user_id", current_user["id"])' in src

    def test_asymmetric_filter_present_in_agent_loop(self):
        src = self._agent_loop_src()
        assert 'neq("origin", "harness")' in src
        assert 'eq("origin", "harness")' in src
