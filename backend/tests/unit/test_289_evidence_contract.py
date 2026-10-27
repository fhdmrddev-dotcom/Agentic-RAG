"""Phase 289 (I1): the evidence read's field names match the shared contract fixture.

Plans 03 (backend) and 04 (frontend) ran in parallel against the contract block in
289-03-PLAN.md. This suite pins the backend half: every object path of ``RunEvidenceRead``
(walked recursively through ``model_fields``, unwrapping ``Optional`` and ``list``) must carry
exactly the field names the fixture lists. ``runEvidence.contract.test.ts`` pins the TS half
against the SAME file, so a field renamed on either side fails one of the two.

A failure here means the backend departed from the contract: fix the model, never the fixture.
"""

from __future__ import annotations

import json
import types
import typing
from pathlib import Path

from pydantic import BaseModel

from app.api.workflow_run_evidence import RunEvidenceRead
from app.services.harness.phase_confidence import confidence_for_wire

_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "phase289" / "run_evidence_contract.json"


def _paths() -> dict[str, list[str]]:
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))["paths"]


def _nested_model(annotation) -> tuple[type[BaseModel] | None, bool]:
    """Unwrap Optional / X | None / list[X] down to a BaseModel; report whether a list was crossed."""
    is_list = False
    seen = 0
    while seen < 6:
        seen += 1
        if isinstance(annotation, type) and issubclass(annotation, BaseModel):
            return annotation, is_list
        origin = typing.get_origin(annotation)
        args = [a for a in typing.get_args(annotation) if a is not type(None)]
        if origin in (list, typing.List):
            is_list = True
            annotation = args[0] if args else None
            continue
        if origin in (typing.Union, types.UnionType) and len(args) == 1:
            annotation = args[0]
            continue
        return None, is_list
    return None, is_list


def _walk(model: type[BaseModel], prefix: str, out: dict[str, list[str]]) -> None:
    out[prefix] = sorted(model.model_fields)
    for name, field in model.model_fields.items():
        nested, is_list = _nested_model(field.annotation)
        if nested is None:
            continue
        child = name if prefix == "$" else f"{prefix}.{name}"
        _walk(nested, child + ("[]" if is_list else ""), out)


def _backend_paths() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    _walk(RunEvidenceRead, "$", out)
    return out


def test_fixture_names_every_object_path_of_the_contract():
    assert set(_paths()) == {
        "$", "run", "run.started_by",
        # 293-03 (START-04 / D-22): how the run started, {kind, label, actor_name}.
        "run.origin",
        "definition", "definition.phases[]", "definition_changed",
        "deliverable", "phase_log[]", "phase_log[].confidence", "phase_log[].human_input",
        # 295-05 (RUN-01 / D-04): the unsourced mark, {continued_by: <words>, at: <ISO>}.
        "phase_log[].unsourced",
        "verdicts[]", "sources[]",
    }


def test_295_the_run_carries_end_reason_and_the_log_carries_unsourced():
    """295-05 (D-22 / D-04): both fields are declared on the wire models, not merely fixtured."""
    from app.api.workflow_run_evidence import RunEvidenceLogEntry, RunEvidenceRun

    assert "end_reason" in RunEvidenceRun.model_fields
    assert RunEvidenceRun.model_fields["end_reason"].default is None
    assert "unsourced" in RunEvidenceLogEntry.model_fields
    assert RunEvidenceLogEntry.model_fields["unsourced"].default is None


def test_run_evidence_read_matches_the_contract_fixture_path_by_path():
    backend = _backend_paths()
    fixture = _paths()
    assert set(backend) == set(fixture), (
        f"object paths differ: only backend {sorted(set(backend) - set(fixture))}, "
        f"only fixture {sorted(set(fixture) - set(backend))}"
    )
    for path, names in fixture.items():
        assert backend[path] == sorted(names), f"{path}: backend {backend[path]} != contract {sorted(names)}"


def test_the_wire_confidence_keys_match_the_contract():
    stored = {"level": "medium", "avg_similarity": 0.47, "disclaimer": None, "passages": 6}
    wire = confidence_for_wire(stored, "x")
    assert wire is not None
    assert sorted(wire) == sorted(_paths()["phase_log[].confidence"])


def test_a_renamed_field_is_caught_by_the_walk():
    """Non-vacuity: the comparison sees a rename, so a green run is not a walk that compared nothing."""

    class _Renamed(BaseModel):
        cited_by: list[int] = []
        document_id: str | None = None
        file_name: str | None = None  # renamed from `filename`
        locations: list[int] = []
        masked: bool = False

    assert sorted(_Renamed.model_fields) != sorted(_paths()["sources[]"])
    assert len(_backend_paths()) == len(_paths())
