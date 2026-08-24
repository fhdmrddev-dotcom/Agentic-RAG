"""Phase 200.2 (RUN-05 / D-09 / D-10 / A-05) — the lazy citation route's wire fence.

``GET /workflow-runs/{workflow_run_id}/phases/{phase_slug}/citations`` fetches citation
passages for a single phase of a workflow run on demand.

This suite tests:
  1. Set equality over response keys: exactly {document_id, filename, chunk_index, passage}.
  2. Stripping of `similarity` and arbitrary planted internal keys (with non-vacuity check).
  3. String scalar tolerance: string-encoded JSON outputs (484/484 completed DB shape) decode cleanly.
  4. IDOR defense: foreign run vs nonexistent run return byte-identical 404 responses.
  5. Missing step vs empty citations degrade.
  6. Canvas off-switch non-discoverability: cold-off returns byte-identical 404.
  7. Canvas gate registration: path template present in CANVAS_GATED_PATHS.
  8. AST no-widening fence: no select("*") anywhere in api/workflow_runs.py.
  9. Model field fence: WorkflowRunCitationRead model_fields has exactly the four expected keys.
"""
import ast
import json
from pathlib import Path
from typing import Any

from app.api.workflow_runs import WorkflowRunCitationRead
from app.middleware.canvas_gate import CANVAS_GATED_PATHS
from tests.test_188_workflow_run_read import (
    _FakeSupabase,
    _cold_off,
    _flipped_on,
    _is_op_false,
)

_MODULE_PATH = Path("app/api/workflow_runs.py")
_OWNER_ID = "00000000-0000-0000-0000-0000000000a1"
_FOREIGN_USER_ID = "00000000-0000-0000-0000-0000000000f9"
_RUN_ID = "5c0d1e2f-0000-4000-8000-0000002002a0"
_FOREIGN_RUN_ID = "5c0d1e2f-0000-4000-8000-0000002002f0"
_NONEXISTENT_RUN_ID = "5c0d1e2f-0000-4000-8000-000000200299"
_THREAD_ID = "5c0d1e2f-0000-4000-8000-0000002002b0"
_DEF_ID = "5c0d1e2f-0000-4000-8000-0000002002c0"

_EXPECTED_CITATION_KEYS = {
    "document_id",
    "filename",
    "chunk_index",
    "passage",
}

_SENTINEL_KEY = "quantum_provenance_ledger_v9"

_SAMPLE_CITATIONS = [
    {
        "document_id": "doc-uuid-1",
        "filename": "annual_report.pdf",
        "chunk_index": 3,
        "passage": "Revenue increased by 14% year over year in fiscal year 2025.",
        "similarity": 0.94,
        "is_full_doc": False,
        "version_number": 1,
        _SENTINEL_KEY: "planted-secret-data",
    },
    {
        "document_id": "doc-uuid-2",
        "filename": "operations.docx",
        "chunk_index": 0,
        "passage": "Operating margins expanded to 28.5%.",
        "similarity": 0.88,
        "is_full_doc": True,
        "version_number": 2,
        _SENTINEL_KEY: "planted-secret-data-2",
    },
]


def _setup_db(monkeypatch, phase_rows: list[dict[str, Any]], *, caller_id=_OWNER_ID) -> _FakeSupabase:
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _flipped_on(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": caller_id, "email": "caller@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    store = _FakeSupabase(
        {
            "workflow_runs": [
                {
                    "id": _RUN_ID,
                    "thread_id": _THREAD_ID,
                    "definition_id": _DEF_ID,
                    "status": "completed",
                    "created_at": "2026-08-20T09:59:00+00:00",
                    "updated_at": "2026-08-20T10:05:00+00:00",
                    "claimed_at": "2026-08-20T09:59:02+00:00",
                    "user_id": _OWNER_ID,
                },
                {
                    "id": _FOREIGN_RUN_ID,
                    "thread_id": _THREAD_ID,
                    "definition_id": _DEF_ID,
                    "status": "completed",
                    "created_at": "2026-08-20T09:59:00+00:00",
                    "updated_at": "2026-08-20T10:05:00+00:00",
                    "claimed_at": "2026-08-20T09:59:02+00:00",
                    "user_id": _FOREIGN_USER_ID,
                },
            ],
            "workflow_phases": phase_rows,
        }
    )
    app.dependency_overrides[get_user_supabase_client] = lambda: store
    return store


# ── 1) Happy Path & Allow-List Set Equality ───────────────────────────────────


def test_string_scalar_output_citations_return_exact_four_keys(client, monkeypatch):
    """Happy path: string scalar output (484/484 completed DB shape) carrying citations -> 200.

    Each citation entry carries exactly {document_id, filename, chunk_index, passage}.
    `similarity` and `quantum_provenance_ledger_v9` are absent from each entry and the whole body text.
    """
    raw_output_obj = {"citations": _SAMPLE_CITATIONS, "text": "Summary of report"}
    string_scalar_output = json.dumps(raw_output_obj)

    # Positive control: non-vacuity check on fake row before serialization
    assert _SENTINEL_KEY in string_scalar_output
    assert "similarity" in string_scalar_output

    phase_rows = [
        {
            "workflow_run_id": _RUN_ID,
            "slug": "gather-docs",
            "phase_index": 0,
            "status": "completed",
            "output": string_scalar_output,
        }
    ]

    _setup_db(monkeypatch, phase_rows)
    resp = client.get(
        f"/workflow-runs/{_RUN_ID}/phases/gather-docs/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2

    # Set equality over real response keys
    for entry in data:
        assert set(entry.keys()) == _EXPECTED_CITATION_KEYS
        assert "similarity" not in entry
        assert _SENTINEL_KEY not in entry
        assert "is_full_doc" not in entry
        assert "version_number" not in entry

    # Text search over the entire JSON string
    assert "similarity" not in resp.text
    assert _SENTINEL_KEY not in resp.text

    # Verify entry values
    assert data[0]["document_id"] == "doc-uuid-1"
    assert data[0]["filename"] == "annual_report.pdf"
    assert data[0]["chunk_index"] == 3
    assert "Revenue increased" in data[0]["passage"]

    assert data[1]["document_id"] == "doc-uuid-2"
    assert data[1]["filename"] == "operations.docx"
    assert data[1]["chunk_index"] == 0
    assert "Operating margins" in data[1]["passage"]


def test_dict_output_citations_supported(client, monkeypatch):
    """Dict-shaped output (if PostgREST decodes jsonb directly) is also supported."""
    phase_rows = [
        {
            "workflow_run_id": _RUN_ID,
            "slug": "gather-docs",
            "phase_index": 0,
            "status": "completed",
            "output": {"citations": _SAMPLE_CITATIONS},
        }
    ]

    _setup_db(monkeypatch, phase_rows)
    resp = client.get(
        f"/workflow-runs/{_RUN_ID}/phases/gather-docs/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    for entry in data:
        assert set(entry.keys()) == _EXPECTED_CITATION_KEYS


# ── 2) Empty & Degrade Cases ──────────────────────────────────────────────────


def test_empty_citations_or_missing_output_degrades_gracefully(client, monkeypatch):
    """Output without citations key, or output=None, returns 200 with empty list []."""
    phase_rows = [
        {
            "workflow_run_id": _RUN_ID,
            "slug": "no-citations-step",
            "phase_index": 0,
            "status": "completed",
            "output": json.dumps({"text": "Just text, no citations"}),
        },
        {
            "workflow_run_id": _RUN_ID,
            "slug": "null-output-step",
            "phase_index": 1,
            "status": "completed",
            "output": None,
        },
        {
            "workflow_run_id": _RUN_ID,
            "slug": "malformed-citations-step",
            "phase_index": 2,
            "status": "completed",
            "output": json.dumps(
                {
                    "citations": [
                        "not-a-dict",
                        {"missing_filename": "d1"},
                        {"document_id": "d1", "filename": "valid.pdf", "passage": "valid"},
                    ]
                }
            ),
        },
    ]

    _setup_db(monkeypatch, phase_rows)

    # Step with no citations key
    r1 = client.get(
        f"/workflow-runs/{_RUN_ID}/phases/no-citations-step/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )
    assert r1.status_code == 200
    assert r1.json() == []

    # Step with output=None
    r2 = client.get(
        f"/workflow-runs/{_RUN_ID}/phases/null-output-step/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )
    assert r2.status_code == 200
    assert r2.json() == []

    # Step with malformed citation entries (filters out invalid entries without raising)
    r3 = client.get(
        f"/workflow-runs/{_RUN_ID}/phases/malformed-citations-step/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )
    assert r3.status_code == 200
    assert len(r3.json()) == 1
    assert r3.json()[0]["filename"] == "valid.pdf"


def test_missing_phase_slug_returns_404(client, monkeypatch):
    """Requesting a phase slug that does not exist in the run returns 404."""
    phase_rows = [
        {
            "workflow_run_id": _RUN_ID,
            "slug": "existing-step",
            "phase_index": 0,
            "status": "completed",
            "output": None,
        }
    ]

    _setup_db(monkeypatch, phase_rows)
    resp = client.get(
        f"/workflow-runs/{_RUN_ID}/phases/nonexistent-step/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Phase not found"}


# ── 3) IDOR Defense ───────────────────────────────────────────────────────────


def test_foreign_run_and_nonexistent_run_return_byte_identical_404(client, monkeypatch):
    """IDOR defense: foreign-owned run id and nonexistent run id return byte-identical 404."""
    phase_rows = [
        {
            "workflow_run_id": _FOREIGN_RUN_ID,
            "slug": "gather-docs",
            "phase_index": 0,
            "status": "completed",
            "output": json.dumps({"citations": _SAMPLE_CITATIONS}),
        }
    ]

    _setup_db(monkeypatch, phase_rows)

    # Caller tries to access foreign run
    resp_foreign = client.get(
        f"/workflow-runs/{_FOREIGN_RUN_ID}/phases/gather-docs/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )
    # Caller tries to access nonexistent run
    resp_missing = client.get(
        f"/workflow-runs/{_NONEXISTENT_RUN_ID}/phases/gather-docs/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )

    assert resp_foreign.status_code == 404
    assert resp_missing.status_code == 404
    assert resp_foreign.content == resp_missing.content
    assert resp_foreign.json() == {"detail": "Run not found"}


# ── 4) Canvas Gate & Non-Discoverability ──────────────────────────────────────


def test_canvas_off_returns_byte_identical_not_found(client, monkeypatch):
    """With visual_workflow_canvas cold-off, returns byte-identical 404 even for the owner."""
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _cold_off(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": _OWNER_ID, "email": "owner@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    store = _FakeSupabase(
        {
            "workflow_runs": [
                {
                    "id": _RUN_ID,
                    "thread_id": _THREAD_ID,
                    "definition_id": _DEF_ID,
                    "status": "completed",
                    "user_id": _OWNER_ID,
                }
            ],
            "workflow_phases": [],
        }
    )
    app.dependency_overrides[get_user_supabase_client] = lambda: store

    resp = client.get(
        f"/workflow-runs/{_RUN_ID}/phases/gather-docs/citations",
        headers={"Authorization": f"Bearer {_OWNER_ID}"},
    )
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Not Found"}


def test_citations_path_is_registered_in_canvas_gated_paths():
    """The path template is in CANVAS_GATED_PATHS for OpenAPI filtering."""
    expected_path = "/workflow-runs/{workflow_run_id}/phases/{phase_slug}/citations"
    assert expected_path in CANVAS_GATED_PATHS


# ── 5) AST No-Widening & Model Structure Fences ───────────────────────────────


def _star_select_calls(source: str) -> int:
    """Count AST Call nodes where select('*') was passed."""
    count = 0
    for node in ast.walk(ast.parse(source)):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "select"
            and any(
                isinstance(a, ast.Constant) and a.value == "*" for a in node.args
            )
        ):
            count += 1
    return count


def test_no_star_select_calls_in_workflow_runs_module():
    """AST walk ensures no .select('*') exists in api/workflow_runs.py."""
    source = _MODULE_PATH.read_text(encoding="utf-8")
    assert len(source) > 1000
    assert _star_select_calls(source) == 0

    # Positive control: planted select('*') in dummy code is detected
    dummy_source = 'def query(db): return db.table("t").select("*")'
    assert _star_select_calls(dummy_source) == 1


def test_workflow_run_citation_read_has_exactly_four_fields():
    """Model structure fence: WorkflowRunCitationRead declares exactly 4 fields."""
    fields = set(WorkflowRunCitationRead.model_fields.keys())
    assert fields == _EXPECTED_CITATION_KEYS


# ── 6) Counterfactual Check (Recorded in comments) ───────────────────────────
# Driven counterfactual observation:
# When `phase_output_object` was replaced by a naive `isinstance(row.get("output"), dict)` check,
# `test_string_scalar_output_citations_return_exact_four_keys` immediately failed (RED)
# because string-scalar outputs returned `[]` instead of 2 citations.
# Restoring `phase_output_object` restores GREEN.
