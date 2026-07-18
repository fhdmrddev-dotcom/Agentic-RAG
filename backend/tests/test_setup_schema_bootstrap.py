"""Phase 158 — WR-05: the /setup/schema-bootstrap endpoint's guide-fallback covers ANY runner
failure, not only a privilege error.

D-10/D-18 contract: the "run it for me" auto-runner is a SHOULD; the copy-guide is the MUST.
Whenever the auto-runner can't complete, the operator must get the guide — NEVER a 500. The
endpoint used to catch only ``SchemaBootstrapPrivilegeError``, so a non-privilege
``asyncpg.PostgresError`` (which ``run_schema_bootstrap`` re-raises) propagated to a 500 with no
guide. These tests drive the handler directly (the ASGI token gate is proven elsewhere).
"""
import app.api.setup as setup_api
from app.api.setup import BindBody
from app.services.setup_service import SchemaBootstrapPrivilegeError


async def _run_with_failing_runner(monkeypatch, raise_exc):
    """schema_bootstrap with a reachable-but-schema-absent probe + a runner that raises."""
    async def _probe(dsn):
        return {"state": "up", "schema_present": False}

    async def _boom(*a, **k):
        raise raise_exc

    monkeypatch.setattr(setup_api, "probe_submitted_postgres", _probe)
    monkeypatch.setattr(setup_api, "_load_schema_artifacts", lambda: ("SELECT 1;", []))
    monkeypatch.setattr(setup_api, "run_schema_bootstrap", _boom)
    return await setup_api.schema_bootstrap(
        BindBody(postgres_dsn="postgresql://u:p@localhost:5432/db")
    )


async def test_schema_bootstrap_privilege_error_falls_back_to_guide(monkeypatch):
    """WR-05 (regression baseline): a privilege error still yields the guide fallback."""
    result = await _run_with_failing_runner(
        monkeypatch, SchemaBootstrapPrivilegeError("InsufficientPrivilegeError")
    )
    assert result["ok"] is False
    assert result["fallback"] == "guide"
    assert result["seed_sequence"], "the guide must carry the seed sequence"


async def test_schema_bootstrap_nonprivilege_error_falls_back_to_guide(monkeypatch):
    """WR-05: a NON-privilege runner error must ALSO fall back to the copy-guide, NEVER 500.
    Before the fix the endpoint only caught SchemaBootstrapPrivilegeError, so any other error
    (a generic asyncpg PostgresError, an OSError, …) propagated → 500 with no guide fallback."""
    result = await _run_with_failing_runner(monkeypatch, RuntimeError("some non-privilege failure"))
    assert result["ok"] is False
    assert result["fallback"] == "guide"
    assert result["seed_sequence"], "the guide must carry the seed sequence"


async def test_schema_bootstrap_missing_artifacts_falls_back_to_guide(monkeypatch):
    """WR-05 (companion): unreadable schema artifacts (the shipped backend/-context container has
    no supabase/ dir) also degrade to the guide, never a 500."""
    async def _probe(dsn):
        return {"state": "up", "schema_present": False}

    def _missing():
        raise FileNotFoundError("supabase/full-schema.sql not bundled in the image")

    monkeypatch.setattr(setup_api, "probe_submitted_postgres", _probe)
    monkeypatch.setattr(setup_api, "_load_schema_artifacts", _missing)
    result = await setup_api.schema_bootstrap(
        BindBody(postgres_dsn="postgresql://u:p@localhost:5432/db")
    )
    assert result["ok"] is False
    assert result["fallback"] == "guide"
