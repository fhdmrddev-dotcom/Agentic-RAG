"""Phase 289 plan 03 (VIS-03) — the evidence read: pure composers + the org-scoped route.

No case here touches a database. The composers are pure; the route cases call the coroutine
directly with ``app.dependencies.get_pg_pool`` swapped for a fake pool that records every
``(sql, args)`` pair and answers by SQL substring (the ``test_214_argument_seams`` idiom), so no
app lifespan runs and no boot sweep can claim a live run on the shared local database.
"""
from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from app.models.harness import WorkflowDefinition
from app.services import run_evidence as ev

# ── fixtures ────────────────────────────────────────────────────────────────────────────


def _definition(*, version: int = 3, folder: str | None = None) -> dict:
    """A small but VALID definition: gather (agent, two validators) → approve (human) → write."""
    d = {
        "slug": "vendor-review",
        "version": version,
        "name": "Vendor review",
        "status": "published",
        "phases": [
            {
                "slug": "gather",
                "phase_index": 0,
                "name": "Gather the evidence",
                "config": {"phase_type": "llm_single", "prompt": "Gather."},
                "validators": [
                    {"kind": "citations_required", "config": {}},
                    {"kind": "regex_match", "config": {"pattern": "x"}},
                ],
            },
            {
                "slug": "approve",
                "phase_index": 1,
                "name": "Approve the shortlist",
                "config": {"phase_type": "llm_human_input", "prompt": "Approve?"},
                "validators": [],
            },
            {
                "slug": "write",
                "phase_index": 2,
                "name": "Write the memo",
                "config": {"phase_type": "llm_single", "prompt": "Write."},
                "validators": [],
            },
        ],
    }
    if folder is not None:
        d["project_folder_id"] = folder
    return d


def _full(d: dict) -> dict:
    """What ``create_workflow_run`` stores as the snapshot: every default filled in."""
    return WorkflowDefinition.model_validate(d).model_dump(mode="json")


DOC_A = "11111111-1111-4111-8111-111111111111"
DOC_B = "22222222-2222-4222-8222-222222222222"
DOC_HIDDEN = "33333333-3333-4333-8333-333333333333"

_CONF = {"level": "medium", "avg_similarity": 0.47, "disclaimer": None, "passages": 3}


def _phase_rows(*, answered: bool = True) -> list[dict]:
    gather_out = {
        "text": "Three vendors meet the bar.",
        "_measure": {"count": 3, "noun": "sources"},
        "confidence": _CONF,
        "citations": [
            {"document_id": DOC_A, "filename": "policy.pdf", "chunk_index": 4,
             "passage": "SECRET PASSAGE A", "similarity": 0.91},
            {"document_id": DOC_A, "filename": "policy.pdf", "chunk_index": 2,
             "passage": "SECRET PASSAGE A2", "similarity": 0.81},
            {"document_id": DOC_HIDDEN, "filename": "owner-private.docx", "chunk_index": 0,
             "passage": "SECRET PASSAGE H", "similarity": 0.7},
        ],
    }
    write_out = {
        "text": "Memo written.",
        "path": "outputs/vendor-memo.docx",
        "citations": [
            # the same (document, chunk) as step 1 — deduped into one location, cited by both
            {"document_id": DOC_A, "filename": "policy.pdf", "chunk_index": 4,
             "passage": "SECRET PASSAGE A", "similarity": 0.91},
            {"document_id": DOC_B, "filename": "pricing.xlsx", "chunk_index": 7,
             "passage": "SECRET PASSAGE B", "similarity": 0.5},
        ],
    }
    approve_out = {
        "text": "Approve the shortlist of three?",
        "answer": "Yes, go ahead" if answered else "",
        "tool_call_id": "tc-1",
    }
    return [
        # deliberately out of order: the composer orders by phase_index
        {"slug": "write", "phase_index": 2, "status": "completed",
         "started_at": "2026-10-19T10:03:00+00:00", "completed_at": "2026-10-19T10:04:00+00:00",
         "output": write_out},
        # the jsonb STRING SCALAR shape (484 of 484 completed rows on the live DB)
        {"slug": "gather", "phase_index": 0, "status": "completed",
         "started_at": "2026-10-19T10:00:00+00:00", "completed_at": "2026-10-19T10:01:00+00:00",
         "output": json.dumps(gather_out)},
        {"slug": "approve", "phase_index": 1, "status": "completed",
         "started_at": "2026-10-19T10:01:00+00:00", "completed_at": "2026-10-19T10:02:00+00:00",
         "output": json.dumps(approve_out)},
    ]


# ── compose_definition (D-04) ───────────────────────────────────────────────────────────


def test_dict_and_string_scalar_snapshot_decode_identically():
    snap = _full(_definition())
    as_dict = ev.compose_definition(snap, None)
    as_scalar = ev.compose_definition(json.dumps(snap), None)
    assert as_dict == as_scalar
    assert as_dict["recorded"] is True
    assert as_dict["version"] == 3
    assert as_dict["phases"] == [
        {"n": 1, "slug": "gather", "name": "Gather the evidence", "phase_type": "llm_single"},
        {"n": 2, "slug": "approve", "name": "Approve the shortlist", "phase_type": "llm_human_input"},
        {"n": 3, "slug": "write", "name": "Write the memo", "phase_type": "llm_single"},
    ]
    assert as_dict["full"] == snap


def test_no_snapshot_says_recorded_false_and_uses_the_fallback_with_its_version():
    fallback = _definition(version=2)
    out = ev.compose_definition(None, json.dumps(fallback), fallback_version=2)
    assert out["recorded"] is False
    assert out["version"] == 2
    assert [p["slug"] for p in out["phases"]] == ["gather", "approve", "write"]
    assert out["full"] == fallback


def test_an_empty_recorded_snapshot_is_recorded_not_the_fallback():
    # `is None`, never truthiness: {} was RECORDED and found to hold nothing.
    out = ev.compose_definition({}, _definition(), fallback_version=3)
    assert out["recorded"] is True
    assert out["phases"] == []


# ── definition_changed (Pitfall 5) ──────────────────────────────────────────────────────


def test_a_newer_same_slug_version_is_a_change():
    snap = _full(_definition(version=3))
    out = ev.definition_changed(snap, [1, 2, 3, 5, 4], {"status": "published", "version": 3,
                                                       "definition": _definition()})
    assert out == {"changed": True, "current_version": 5}


def test_an_unedited_draft_is_not_a_change_after_normalisation():
    # The snapshot carries every default; the stored row carries only what was saved. Raw
    # dict equality would say "edited" on an untouched run.
    stored = _definition(version=3)
    snap = _full(stored)
    assert snap != stored
    out = ev.definition_changed(snap, [3], {"status": "draft", "version": 3,
                                            "definition": json.dumps(stored)})
    assert out == {"changed": False, "current_version": None}


def test_an_edited_draft_is_a_change():
    snap = _full(_definition(version=3))
    edited = _definition(version=3)
    edited["phases"][2]["name"] = "Write the memo (v2)"
    out = ev.definition_changed(snap, [3], {"status": "draft", "version": 3, "definition": edited})
    assert out["changed"] is True


def test_an_unvalidatable_definition_falls_back_to_the_version_rule():
    snap = {"slug": "old", "version": 1, "phases": "not-a-list"}
    out = ev.definition_changed(snap, [1], {"status": "draft", "version": 1,
                                            "definition": {"totally": "different"}})
    assert out == {"changed": False, "current_version": None}


# ── compose_phase_log (R-04 / R-05) ─────────────────────────────────────────────────────


def test_phase_log_orders_by_index_and_reads_the_string_scalar_rows():
    log = ev.compose_phase_log(_phase_rows(), _full(_definition()), True, "Dana", "Procurement KB")
    assert [r["n"] for r in log] == [1, 2, 3]
    assert [r["slug"] for r in log] == ["gather", "approve", "write"]
    gather = log[0]
    assert gather["name"] == "Gather the evidence"
    assert gather["phase_type"] == "llm_single"
    assert gather["output_text"] == "Three vendors meet the bar."
    assert (gather["step_count"], gather["step_noun"]) == (3, "sources")
    assert gather["confidence"] == {
        "level": "medium", "avg_similarity": 0.47, "disclaimer": None, "passages": 3,
        "kb_label": "Procurement KB",
    }
    assert gather["human_input"] is None
    assert log[2]["confidence"] is None


def test_failure_reason_is_stripped_to_none():
    rows = [
        {"slug": "gather", "phase_index": 0, "status": "failed", "output":
         json.dumps({"_failure_reason": "   "})},
        {"slug": "write", "phase_index": 1, "status": "failed", "output":
         json.dumps({"_failure_reason": "Gate failed: no citations"})},
    ]
    log = ev.compose_phase_log(rows, _definition(), True, "Dana", "the knowledge base")
    assert log[0]["failure_reason"] is None
    assert log[1]["failure_reason"] == "Gate failed: no citations"


def test_human_input_owner_sees_question_answer_and_who():
    log = ev.compose_phase_log(_phase_rows(), _definition(), True, "Dana", "the knowledge base")
    approve = log[1]
    assert approve["human_input"] == {
        "answered": True,
        "question": "Approve the shortlist of three?",
        "answer": "Yes, go ahead",
        "answered_by": "Dana",
    }


def test_human_input_non_owner_gets_only_whether_it_was_answered():
    log = ev.compose_phase_log(_phase_rows(), _definition(), False, "Dana", "the knowledge base")
    approve = log[1]
    assert approve["human_input"] == {
        "answered": True, "question": None, "answer": None, "answered_by": None,
    }
    assert approve["output_text"] is None
    # accepted risk T-289-31: a non-human step's output still travels to a colleague
    assert log[0]["output_text"] == "Three vendors meet the bar."
    blob = json.dumps(log)
    assert "Approve the shortlist of three?" not in blob
    assert "Yes, go ahead" not in blob


def test_an_unanswered_human_step_says_so():
    log = ev.compose_phase_log(_phase_rows(answered=False), _definition(), True, "Dana", "kb")
    assert log[1]["human_input"]["answered"] is False
    assert log[1]["human_input"]["answered_by"] is None


# ── compose_verdicts (R-03) ─────────────────────────────────────────────────────────────


def test_verdicts_map_checks_and_records_and_drop_the_judge():
    snap = _full(_definition())
    steps = {"gather": 1, "approve": 2, "write": 3}
    audit = [
        # write_audit double-encodes metadata: a jsonb STRING SCALAR
        {"event_type": "gate_passed", "metadata": json.dumps({"phase": "gather"}),
         "created_at": "2026-10-19T10:01:00+00:00"},
        {"event_type": "gate_failed", "metadata": {"phase": "write", "attempt": 1,
                                                   "error": "PRIVATE ERROR TEXT"},
         "created_at": "2026-10-19T10:03:30+00:00"},
        {"event_type": "judge_verdict", "metadata": {"phase": "write", "verdict": "pass"},
         "created_at": "2026-10-19T10:05:00+00:00"},
        {"event_type": "emit_validated", "metadata": json.dumps({"phase_slug": "write"}),
         "created_at": "2026-10-19T10:04:00+00:00"},
        {"event_type": "policy_applied", "metadata": {"policy": "human_gate_pause",
                                                      "phase": "approve"},
         "created_at": "2026-10-19T10:02:00+00:00"},
        {"event_type": "run_completed", "metadata": {}, "created_at": "2026-10-19T10:06:00+00:00"},
    ]
    out = ev.compose_verdicts(audit, snap, steps)
    assert [v["kind"] for v in out] == [
        "gate_passed", "gate_failed", "emit_validated", "policy_applied",
    ]
    assert out[0] == {"step_n": 1, "phase_slug": "gather", "kind": "gate_passed",
                      "result": "passed", "checked": ["citations_required", "regex_match"],
                      "at": "2026-10-19T10:01:00+00:00"}
    assert out[1]["result"] == "failed"
    assert out[1]["checked"] == []  # `write` declares no validators
    assert out[2]["result"] == "passed" and out[2]["step_n"] == 3
    assert out[3]["result"] == "recorded" and out[3]["checked"] == []
    assert "PRIVATE ERROR TEXT" not in json.dumps(out)
    assert not any(v["kind"] == "judge_verdict" for v in out)


def test_every_verdict_kind_is_classified_once():
    assert set(ev.VERDICT_KINDS) == {
        "gate_passed", "gate_failed", "emit_validated", "emit_rejected", "emit_integrity_failed",
        "validator_ask_user_approved", "policy_applied", "action_risk_pending", "tool_refused",
        "external_action_sent", "circuit_breaker_tripped",
    }
    assert "judge_verdict" not in ev.VERDICT_KINDS


# ── compose_sources (R-01) ──────────────────────────────────────────────────────────────


def test_sources_dedupe_across_steps_and_never_ship_a_passage():
    steps = {"gather": 1, "approve": 2, "write": 3}
    out = ev.compose_sources(_phase_rows(), steps, None)
    assert out == [
        {"masked": False, "document_id": DOC_A, "filename": "policy.pdf",
         "locations": [2, 4], "cited_by": [1, 3]},
        {"masked": False, "document_id": DOC_HIDDEN, "filename": "owner-private.docx",
         "locations": [0], "cited_by": [1]},
        {"masked": False, "document_id": DOC_B, "filename": "pricing.xlsx",
         "locations": [7], "cited_by": [3]},
    ]
    blob = json.dumps(out)
    assert "SECRET PASSAGE" not in blob
    assert "similarity" not in blob and "passage" not in blob


def test_a_document_the_viewer_cannot_read_is_masked():
    steps = {"gather": 1, "approve": 2, "write": 3}
    out = ev.compose_sources(_phase_rows(), steps, {DOC_A, DOC_B})
    hidden = out[1]
    assert hidden == {"masked": True, "document_id": None, "filename": None,
                      "locations": [], "cited_by": [1]}
    assert "owner-private.docx" not in json.dumps(out)
    assert DOC_HIDDEN not in json.dumps(out)
    assert out[0]["masked"] is False and out[0]["filename"] == "policy.pdf"


def test_an_empty_readable_set_masks_everything():
    steps = {"gather": 1, "approve": 2, "write": 3}
    out = ev.compose_sources(_phase_rows(), steps, set())
    assert all(s["masked"] for s in out)
    assert all(s["filename"] is None and s["document_id"] is None for s in out)
    assert [s["cited_by"] for s in out] == [[1, 3], [1], [3]]


# ── compose_deliverable (R-02) ──────────────────────────────────────────────────────────


def test_a_file_deliverable_carries_its_basename_and_the_owner_id_only():
    rows = _phase_rows()
    assert ev.deliverable_path(rows) == "outputs/vendor-memo.docx"
    owner = ev.compose_deliverable(rows, True, "f-123")
    assert owner == {"kind": "file", "name": "vendor-memo.docx", "file_id": "f-123"}
    colleague = ev.compose_deliverable(rows, False, "f-123")
    assert colleague == {"kind": "file", "name": "vendor-memo.docx", "file_id": None}


def test_a_text_deliverable_and_none():
    rows = [{"slug": "a", "phase_index": 0, "status": "completed",
             "output": json.dumps({"text": "The answer."})}]
    assert ev.compose_deliverable(rows, True, None) == {"kind": "text", "name": None,
                                                          "file_id": None}
    rows = [{"slug": "a", "phase_index": 0, "status": "failed",
             "output": json.dumps({"text": "partial"})}]
    assert ev.compose_deliverable(rows, True, None) == {"kind": "none", "name": None,
                                                          "file_id": None}


# ── started_by (A-06) ───────────────────────────────────────────────────────────────────


def test_started_by_owner_and_colleague():
    assert ev.started_by("Dana", "dana@example.com", True) == {
        "name": "Dana", "email": "dana@example.com", "is_you": True,
    }
    assert ev.started_by(None, "dana@example.com", True)["name"] == "dana@example.com"
    assert ev.started_by("Dana", "dana@example.com", False) == {
        "name": "Dana", "email": None, "is_you": False,
    }
    assert ev.started_by(None, "dana@example.com", False) == {
        "name": "the person who started this run", "email": None, "is_you": False,
    }
    hostile = ev.started_by("Dana‮\nEvil", None, False)
    assert "‮" not in hostile["name"] and "\n" not in hostile["name"]
