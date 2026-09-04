"""ultrareview merged_bug_002 — the circuit-breaker sentences could never render.

Phase 210 added honest shutoff copy to `RunHero.tsx` ("Stopped: Token budget exceeded
(used X of Y tokens)"). It was unreachable in production for TWO independent reasons,
and the phase's own unit tests passed anyway because they hand-built the response object
instead of going through the serializer:

  1. `WorkflowRunRead` never declared `metadata`, and the route's `.select()` never
     fetched the column — so FastAPI's `response_model` dropped it SILENTLY. The
     frontend's `run.metadata?.circuit_breaker` was `undefined` on every run.
  2. The duration literal DRIFTED: the breaker emits ``max_duration_exceeded`` and the
     frontend checked ``duration_budget_exceeded``, a string that exists nowhere in the
     backend.

Driven RED 2026-08-27. This is the third recurrence in this phase of one shape — two
sides each green, the join dead — after the dict-key mismatch (P-3) and the
object-identity mismatch (R-1).
"""
from app.api.workflow_runs import WorkflowRunRead
from app.services.circuit_breaker import (
    REASON_MAX_DURATION,
    REASON_TOKEN_BUDGET,
    TRIP_METADATA_KEY,
)


def test_workflow_run_read_declares_metadata():
    """response_model drops every field the model does not name. This is that field."""
    assert "metadata" in WorkflowRunRead.model_fields, (
        "WorkflowRunRead has no `metadata` field, so FastAPI silently drops the "
        "circuit-breaker payload and the honest shutoff sentence can never render"
    )


def test_metadata_survives_serialisation():
    """A real trip payload must still be there after the model round-trips it."""
    trip = {
        "reason": REASON_TOKEN_BUDGET,
        "cumulative_tokens": 502_100,
        "max_tokens": 500_000,
    }
    run = WorkflowRunRead(
        id="00000000-0000-0000-0000-000000000001",
        thread_id="00000000-0000-0000-0000-000000000002",
        definition_id="00000000-0000-0000-0000-000000000003",
        workflow_name="w", workflow_slug="w", workflow_version=1,
        status="cancelled",
        metadata={TRIP_METADATA_KEY: trip},
    )
    dumped = run.model_dump()
    assert dumped.get("metadata", {}).get(TRIP_METADATA_KEY) == trip


def test_the_route_selects_the_metadata_column():
    """A declared field the query never fetches is still always None."""
    import inspect
    from app.api import workflow_runs

    src = inspect.getsource(workflow_runs.read_workflow_run)
    assert "definition_snapshot, metadata" in src, (
        "the run route's .select() does not fetch `metadata`, so the declared field "
        "is always None no matter what the database holds"
    )


def test_the_frontend_duration_literal_matches_the_breaker():
    """The one string that drifted. Pinned on the backend side so a rename is caught here."""
    from pathlib import Path

    hero = Path(__file__).resolve().parents[3] / "frontend/src/components/workflows/RunHero.tsx"
    text = hero.read_text(encoding="utf-8")
    assert REASON_MAX_DURATION in text, (
        f"RunHero.tsx does not check {REASON_MAX_DURATION!r} — the breaker's real literal"
    )
    assert 'cb.reason === "duration_budget_exceeded"' not in text, (
        "RunHero.tsx still CHECKS 'duration_budget_exceeded', which the backend never emits"
    )
    assert REASON_TOKEN_BUDGET in text
