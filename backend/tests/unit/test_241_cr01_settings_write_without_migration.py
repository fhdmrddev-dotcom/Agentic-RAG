"""CR-01 — saving ANY Search setting must not 500 where migration 176 is unapplied.

⛔ WHAT THIS CATCHES, AND WHY IT WAS INVISIBLE.

Phase 241 claimed repeatedly — in migration 176's own header, in `241-03-SUMMARY.md`, and in a
`_build_settings_from_row({})` test — that the migration being "authored but not applied changes
NOTHING". **Every one of those claims is about READS.** `_build_settings_from_row` uses `.get()`,
so a missing column reads as the `config.py` default and the app is genuinely fail-soft.

The WRITE half was never checked. `SettingsPage.tsx` puts both new keys in the Search tab's payload
UNCONDITIONALLY, `api/settings.py` therefore always adds them to `updates`, and
`save_app_settings` composes ONE `UPDATE app_settings SET col=$1, …` over every key at once. On a
database without migration 176 that raises `UndefinedColumnError`, which `save_app_settings`
catches and reports as `False`, which `settings.py` turns into `HTTPException(500)`.

**The blast radius is the whole tab, not the two new knobs.** The reranker, the embedding model,
the retrieval threshold and `rrf_k` all ride the same UPDATE, so none of them can be saved either.
Cloud production has not had 176 applied (`241-04-SUMMARY.md`'s own OWED list, item 1), so this
ships as a 500 on the next deploy.

Measured against the real local database inside a rolled-back transaction before this fence was
written: dropping the two columns and issuing the exact UPDATE shape reproduces
`column "hnsw_ef_search" of relation "app_settings" does not exist`.

⚠ These tests are deliberately about the WRITE-GATE FUNCTION, not about mocking the whole route.
A route-level mock would pin the plumbing and could still pass with the gate deleted.
"""

import pytest

from app.services import retrieval_tuning


class TestHnswColumnGate:
    """The probe that decides whether the two knobs may ride the UPDATE."""

    def test_the_gate_function_exists(self):
        """⛔ RED before the fix: there is no write-side gate at all.

        This is the finding in one line — the read side degrades, the write side does not.
        """
        assert hasattr(retrieval_tuning, "app_settings_has_hnsw_columns"), (
            "no write-side column gate exists; api/settings.py adds hnsw_* to `updates` "
            "unconditionally, so one missing column 500s the entire Search tab"
        )

    @pytest.mark.asyncio
    async def test_gate_reports_false_when_the_columns_are_absent(self, monkeypatch):
        """A database without migration 176 must be recognised as such."""
        async def _no_columns(*_a, **_kw):
            return []
        monkeypatch.setattr(retrieval_tuning, "_fetch_hnsw_columns", _no_columns, raising=False)
        retrieval_tuning.reset_hnsw_column_cache()
        assert await retrieval_tuning.app_settings_has_hnsw_columns() is False

    @pytest.mark.asyncio
    async def test_gate_reports_true_only_when_BOTH_columns_are_present(self, monkeypatch):
        """⚠ BOTH, not either.

        A half-applied migration is not a state to guess at: one column present and the other
        absent still 500s the same UPDATE, so the gate must refuse the pair.
        """
        async def _one_column(*_a, **_kw):
            return ["hnsw_ef_search"]
        monkeypatch.setattr(retrieval_tuning, "_fetch_hnsw_columns", _one_column, raising=False)
        retrieval_tuning.reset_hnsw_column_cache()
        assert await retrieval_tuning.app_settings_has_hnsw_columns() is False

        async def _both(*_a, **_kw):
            return ["hnsw_ef_search", "hnsw_iterative_scan"]
        monkeypatch.setattr(retrieval_tuning, "_fetch_hnsw_columns", _both, raising=False)
        retrieval_tuning.reset_hnsw_column_cache()
        assert await retrieval_tuning.app_settings_has_hnsw_columns() is True

    @pytest.mark.asyncio
    async def test_gate_fails_CLOSED_when_the_probe_itself_errors(self, monkeypatch):
        """A probe that cannot answer must not let the write through.

        Returning True on an error would restore exactly the 500 this fence exists to prevent.
        """
        async def _boom(*_a, **_kw):
            raise RuntimeError("no pool")
        monkeypatch.setattr(retrieval_tuning, "_fetch_hnsw_columns", _boom, raising=False)
        retrieval_tuning.reset_hnsw_column_cache()
        assert await retrieval_tuning.app_settings_has_hnsw_columns() is False


class TestTheGateIsActuallyWiredIntoTheWritePath:
    """⚠ A gate nobody calls is not a gate.

    `241-REVIEW.md` WR-07 records this phase already shipping a fence that round-tripped a model
    and never called the function it claimed to guard. This class exists so that cannot repeat:
    it reads the route's source and asserts the gate is consulted BEFORE the two assignments.
    """

    def test_settings_route_consults_the_gate_before_assigning_either_key(self):
        import ast
        import inspect
        from app.api import settings as settings_mod

        src = inspect.getsource(settings_mod)
        tree = ast.parse(src)

        assigns = []   # line numbers where updates["hnsw_*"] is written
        gate_calls = []  # line numbers where the gate is awaited
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for t in node.targets:
                    if (isinstance(t, ast.Subscript)
                            and isinstance(t.value, ast.Name) and t.value.id == "updates"
                            and isinstance(t.slice, ast.Constant)
                            and isinstance(t.slice.value, str)
                            and t.slice.value.startswith("hnsw_")):
                        assigns.append(node.lineno)
            if isinstance(node, ast.Call):
                fn = node.func
                name = getattr(fn, "attr", None) or getattr(fn, "id", None)
                if name == "app_settings_has_hnsw_columns":
                    gate_calls.append(node.lineno)

        assert assigns, "expected updates['hnsw_*'] assignments in api/settings.py"
        assert gate_calls, (
            "api/settings.py never calls app_settings_has_hnsw_columns — the two knobs still "
            "ride the UPDATE unconditionally and one missing column 500s the whole Search tab"
        )
        assert min(gate_calls) < min(assigns), (
            "the column gate is consulted AFTER the assignments; it must gate them"
        )
