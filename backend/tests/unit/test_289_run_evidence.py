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


# ── 295-05 (RUN-01 / D-04): the unsourced mark on the phase log ────────────────────────────

_STORED_BY = "aaaaaaaa-0000-4000-8000-0000000002a5"


def _unsourced_rows() -> list[dict]:
    return [
        {"slug": "gather", "phase_index": 0, "status": "completed", "output": json.dumps(
            {"text": "Kept as produced.",
             "unsourced": {"continued_by": _STORED_BY, "at": "2026-10-20T12:30:00+00:00"}})},
        {"slug": "write", "phase_index": 2, "status": "completed",
         "output": {"text": "Memo written."}},
    ]


def test_the_owner_reads_the_mark_with_their_own_name():
    log = ev.compose_phase_log(_unsourced_rows(), _definition(), True, "Dana", "kb")
    assert log[0]["unsourced"] == {"continued_by": "Dana (you)",
                                   "at": "2026-10-20T12:30:00+00:00"}
    assert log[1]["unsourced"] is None
    assert _STORED_BY not in json.dumps(log)


def test_a_colleague_reads_the_mark_without_a_name():
    log = ev.compose_phase_log(_unsourced_rows(), _definition(), False, "Dana", "kb")
    assert log[0]["unsourced"]["continued_by"] == "the person who started this run"
    assert "Dana" not in json.dumps(log[0]["unsourced"])
    assert _STORED_BY not in json.dumps(log)


def test_an_owner_with_no_name_reads_the_fallback_words_without_you():
    log = ev.compose_phase_log(_unsourced_rows(), _definition(), True,
                               "the person who started this run", "kb")
    assert log[0]["unsourced"]["continued_by"] == "the person who started this run"


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


def test_a_wall_clock_timeout_is_not_reported_as_checks_that_ran():
    """289-REVIEW WR-03: the engine writes `gate_failed` with `error: wall_clock_timeout ...` when
    the phase hung BEFORE its gates ran. It carries no `timing`, so it read as a post-gate
    failure and `checked` listed every post validator on the phase, none of which ran.
    """
    snap = _full(_definition())
    steps = {"gather": 1, "approve": 2, "write": 3}
    audit = [
        {"event_type": "gate_failed",
         "metadata": json.dumps({"phase": "gather", "attempt": 0,
                                 "error": "wall_clock_timeout after 300s"}),
         "created_at": "2026-10-19T10:01:00+00:00"},
    ]
    out = ev.compose_verdicts(audit, snap, steps)
    assert len(out) == 1
    assert out[0]["checked"] == [], "no validator ran, so none may be named as checked"
    assert out[0]["kind"] == "gate_timed_out"
    assert out[0]["result"] == "recorded", "a timeout is not a check that failed"
    assert out[0]["step_n"] == 1
    assert "300s" not in json.dumps(out)


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


# ════════════════════════════════════════════════════════════════════════════════════════
# The route (D-05 / D-06 / R-05 / W3a) — called as a coroutine against a fake pool.
# ════════════════════════════════════════════════════════════════════════════════════════

OWNER = "aaaaaaaa-0000-4000-8000-000000000001"
COLLEAGUE = "aaaaaaaa-0000-4000-8000-000000000002"
OUTSIDER = "aaaaaaaa-0000-4000-8000-000000000003"
ORG = "bbbbbbbb-0000-4000-8000-000000000001"
OTHER_ORG = "bbbbbbbb-0000-4000-8000-000000000002"
RUN_DONE = "cccccccc-0000-4000-8000-000000000001"
RUN_ACTIVE = "cccccccc-0000-4000-8000-000000000002"
RUN_PAUSED = "cccccccc-0000-4000-8000-000000000003"
RUN_MISSING = "cccccccc-0000-4000-8000-0000000000ff"
THREAD = "dddddddd-0000-4000-8000-000000000001"
DEF_ID = "eeeeeeee-0000-4000-8000-000000000001"
FOLDER = "ffffffff-0000-4000-8000-000000000001"
FILE_ID = "99999999-0000-4000-8000-000000000001"
PRIVATE_FOLDER_NAME = "Owner's Private Folder"
OWNER_EMAIL = "dana@example.com"

_TERMINAL = ("completed", "failed", "cancelled")


def _run_row(run_id: str, status: str) -> dict:
    return {
        "id": uuid.UUID(run_id), "thread_id": uuid.UUID(THREAD),
        "definition_id": uuid.UUID(DEF_ID), "status": status, "org_id": uuid.UUID(ORG),
        "user_id": uuid.UUID(OWNER),
        "created_at": datetime(2026, 10, 19, 9, 59, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 10, 19, 10, 5, tzinfo=timezone.utc),
        "definition_snapshot": json.dumps(_full(_definition(folder=FOLDER))),
        "model": "gpt-5",
    }


class _FakePool:
    """Records every (sql, args); emulates the access WHERE so a miss is a real miss."""

    def __init__(self):
        self.calls: list[tuple[str, tuple]] = []
        self.runs = {
            RUN_DONE: _run_row(RUN_DONE, "completed"),
            RUN_ACTIVE: _run_row(RUN_ACTIVE, "active"),
            RUN_PAUSED: _run_row(RUN_PAUSED, "paused"),
        }
        self.members = {ORG: {OWNER, COLLEAGUE}, OTHER_ORG: {OUTSIDER}}

    def sqls(self) -> list[str]:
        return [s for (s, _a) in self.calls]

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_runs wr" in sql:
            run = self.runs.get(str(args[0]))
            viewer = str(args[1])
            if run is None or run["status"] not in _TERMINAL:
                return None
            if str(run["user_id"]) != viewer and viewer not in self.members.get(
                str(run["org_id"]), set()
            ):
                return None
            return dict(run)
        if "FROM workflow_definitions WHERE id" in sql:
            return {"slug": "vendor-review", "version": 3, "name": "Vendor review",
                    "status": "published", "definition": json.dumps(_definition(folder=FOLDER))}
        raise AssertionError(f"unexpected fetchrow: {sql}")

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_phases" in sql:
            return _phase_rows()
        if "FROM harness_audit" in sql:
            return [
                {"event_type": "gate_passed", "metadata": json.dumps({"phase": "gather"}),
                 "created_at": "2026-10-19T10:01:00+00:00"},
            ]
        if "SELECT version FROM workflow_definitions" in sql:
            return [{"version": 3}, {"version": 4}]
        raise AssertionError(f"unexpected fetch: {sql}")

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM profiles" in sql:
            return "Dana Owner"
        if "FROM organizations" in sql:
            return "Acme"
        if "FROM workspace_files" in sql:
            return uuid.UUID(FILE_ID)
        if "FROM folders" in sql:
            return PRIVATE_FOLDER_NAME
        raise AssertionError(f"unexpected fetchval: {sql}")


class _FakeConn:
    def __init__(self, readable: set[str], folder_name):
        self.readable = readable
        self.folder_name = folder_name
        self.calls: list[tuple[str, tuple]] = []

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return [{"id": i} for i in args[0] if i in self.readable]

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return self.folder_name


@pytest.fixture
def wire(monkeypatch):
    """Swap the pool and the RLS connection; return a handle for the case to steer."""
    import app.dependencies as deps

    state = {"pool": _FakePool(), "conn": _FakeConn({DOC_A, DOC_B}, None), "raise": False,
             "opened": []}

    async def _get_pool():
        return state["pool"]

    @asynccontextmanager
    async def _rls(request, current_user):
        state["opened"].append(current_user["id"])
        if state["raise"]:
            raise RuntimeError("RLS context failed")
        yield state["conn"]

    monkeypatch.setattr(deps, "get_pg_pool", _get_pool)
    monkeypatch.setattr(deps, "get_user_pg_connection", _rls)
    return state


async def _read(run_id: str, viewer: str, email: str = "someone@example.com"):
    from app.api.workflow_run_evidence import read_run_evidence

    return await read_run_evidence(
        workflow_run_id=uuid.UUID(run_id), current_user={"id": viewer, "email": email}
    )


@pytest.mark.asyncio
async def test_owner_reads_the_full_record(wire):
    out = await _read(RUN_DONE, OWNER, OWNER_EMAIL)
    body = json.loads(out.model_dump_json())
    assert body["run"]["viewer_is_owner"] is True
    assert body["run"]["started_by"] == {"name": "Dana Owner", "email": OWNER_EMAIL,
                                         "is_you": True}
    assert body["run"]["thread_id"] == THREAD
    assert body["run"]["org_name"] == "Acme"
    assert body["run"]["status"] == "completed"
    assert body["definition"]["recorded"] is True and body["definition"]["version"] == 3
    assert body["definition_changed"] == {"changed": True, "current_version": 4}
    assert body["deliverable"] == {"kind": "file", "name": "vendor-memo.docx",
                                   "file_id": FILE_ID}
    assert not any(s["masked"] for s in body["sources"])
    assert {s["filename"] for s in body["sources"]} == {
        "policy.pdf", "owner-private.docx", "pricing.xlsx",
    }
    # R-05: the owner's label comes from the pool, and every confidence carries it
    assert body["kb_label"] == PRIVATE_FOLDER_NAME
    confs = [p["confidence"] for p in body["phase_log"] if p["confidence"]]
    assert confs and all(c["kb_label"] == PRIVATE_FOLDER_NAME for c in confs)
    from app.services.harness.phase_confidence import confidence_for_wire
    assert confs[0] == confidence_for_wire(_CONF, PRIVATE_FOLDER_NAME)
    assert body["phase_log"][1]["human_input"]["question"] == "Approve the shortlist of three?"
    assert body["verdicts"][0]["checked"] == ["citations_required", "regex_match"]
    assert wire["opened"] == []  # the RLS check never runs for the owner
    assert set(body) == {"run", "definition", "definition_changed", "kb_label", "deliverable",
                         "phase_log", "verdicts", "sources"}


@pytest.mark.asyncio
async def test_a_colleague_reads_a_minimised_record(wire):
    out = await _read(RUN_DONE, COLLEAGUE, "colleague@example.com")
    text = out.model_dump_json()
    body = json.loads(text)
    assert body["run"]["viewer_is_owner"] is False
    assert body["run"]["started_by"] == {"name": "Dana Owner", "email": None, "is_you": False}
    assert body["run"]["thread_id"] is None
    assert OWNER_EMAIL not in text and THREAD not in text
    assert body["deliverable"] == {"kind": "file", "name": "vendor-memo.docx", "file_id": None}
    # R-01: the document outside the colleague's RLS view is masked
    masked = [s for s in body["sources"] if s["masked"]]
    assert masked == [{"masked": True, "document_id": None, "filename": None,
                       "locations": [], "cited_by": [1]}]
    assert "owner-private.docx" not in text and DOC_HIDDEN not in text
    # R-04
    approve = body["phase_log"][1]
    assert approve["human_input"] == {"answered": True, "question": None, "answer": None,
                                      "answered_by": None}
    assert approve["output_text"] is None
    assert "Yes, go ahead" not in text
    # 289-REVIEW CR-01 (T-289-31 now MITIGATED for masked citations): step 1 cites the
    # document the colleague cannot read, so its output is withheld behind the fixed sentence;
    # step 3 cites only readable documents, so it keeps its output.
    assert body["phase_log"][0]["output_text"] == ev.WITHHELD_OUTPUT_SENTENCE
    assert "Three vendors meet the bar." not in text
    assert body["phase_log"][2]["output_text"] == "Memo written."
    # (confidence's own `avg_similarity` is the step's aggregate, not a citation's score)
    assert "SECRET PASSAGE" not in text and '"similarity"' not in text
    assert '"passage"' not in text
    # the RLS check ran once, as the colleague, over the cited ids only
    assert wire["opened"] == [COLLEAGUE]
    (rls_sql, rls_args), _label = wire["conn"].calls
    assert "documents" in rls_sql
    assert sorted(rls_args[0]) == sorted([DOC_A, DOC_HIDDEN, DOC_B])
    # no owner-only reads on the pool
    pool_sql = " ".join(wire["pool"].sqls())
    assert "FROM workspace_files" not in pool_sql


@pytest.mark.asyncio
async def test_a_masked_documents_content_never_reaches_the_colleague_through_output_text(wire):
    """289-REVIEW CR-01: the step that cited a private document synthesised its content.

    Masking the source row but shipping the step's output would print the private title (and
    what the document says) one row above the masked source. The owner still reads it whole.
    """
    secret_title = "Q4 Layoff Plan - CONFIDENTIAL"
    rows = _phase_rows()
    gather = next(r for r in rows if r["slug"] == "gather")
    obj = json.loads(gather["output"])
    obj["text"] = f"Per {secret_title}, three vendors meet the bar."
    gather["output"] = json.dumps(obj)

    async def _fetch(sql, *args, _orig=wire["pool"].fetch):
        if "FROM workflow_phases" in sql:
            wire["pool"].calls.append((sql, args))
            return rows
        return await _orig(sql, *args)

    wire["pool"].fetch = _fetch

    colleague = json.loads((await _read(RUN_DONE, COLLEAGUE)).model_dump_json())
    colleague_text = json.dumps(colleague)
    assert secret_title not in colleague_text
    assert colleague["phase_log"][0]["output_text"] == ev.WITHHELD_OUTPUT_SENTENCE
    # a step with no masked citation keeps its output
    assert colleague["phase_log"][2]["output_text"] == "Memo written."

    owner = json.loads((await _read(RUN_DONE, OWNER, OWNER_EMAIL)).model_dump_json())
    assert owner["phase_log"][0]["output_text"] == f"Per {secret_title}, three vendors meet the bar."


@pytest.mark.asyncio
async def test_rls_failure_withholds_every_citing_steps_output(wire):
    """Fail closed (R-01): when every source is masked, every citing step's output is too."""
    wire["raise"] = True
    body = json.loads((await _read(RUN_DONE, COLLEAGUE)).model_dump_json())
    assert body["phase_log"][0]["output_text"] == ev.WITHHELD_OUTPUT_SENTENCE
    assert body["phase_log"][2]["output_text"] == ev.WITHHELD_OUTPUT_SENTENCE


@pytest.mark.asyncio
async def test_colleague_label_hidden_folder_reads_the_default_words(wire):
    # (i) the viewer cannot read the folder: their RLS connection returns nothing for it,
    # while the pool WOULD answer the private name.
    wire["conn"] = _FakeConn({DOC_A, DOC_B}, None)
    out = await _read(RUN_DONE, COLLEAGUE)
    text = out.model_dump_json()
    body = json.loads(text)
    assert body["kb_label"] == "the knowledge base"
    confs = [p["confidence"] for p in body["phase_log"] if p["confidence"]]
    assert confs and all(c["kb_label"] == "the knowledge base" for c in confs)
    assert PRIVATE_FOLDER_NAME not in text
    assert not any("FROM folders" in s for s in wire["pool"].sqls())


@pytest.mark.asyncio
async def test_colleague_rls_failure_masks_everything_and_uses_the_default_words(wire):
    # (ii)
    wire["raise"] = True
    out = await _read(RUN_DONE, COLLEAGUE)
    body = json.loads(out.model_dump_json())
    assert body["kb_label"] == "the knowledge base"
    assert body["sources"] and all(s["masked"] for s in body["sources"])
    assert not any("FROM folders" in s for s in wire["pool"].sqls())


@pytest.mark.asyncio
async def test_colleague_label_readable_folder_reads_its_name(wire):
    # (iii)
    wire["conn"] = _FakeConn({DOC_A, DOC_B}, "Shared Procurement")
    out = await _read(RUN_DONE, COLLEAGUE)
    assert out.kb_label == "Shared Procurement"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("run_id", "viewer"),
    [
        (RUN_DONE, OUTSIDER),     # another org
        (RUN_MISSING, OWNER),     # does not exist
        (RUN_ACTIVE, COLLEAGUE),  # not terminal, non-owner
        (RUN_PAUSED, COLLEAGUE),  # not terminal, non-owner
        (RUN_ACTIVE, OWNER),      # D-06: the owner keeps the live surface for an active run
    ],
)
async def test_every_miss_is_the_same_404_from_one_query(wire, run_id, viewer):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await _read(run_id, viewer)
    assert exc.value.status_code == 404
    assert exc.value.detail == "Run not found"
    calls = wire["pool"].calls
    assert len(calls) == 1, "nothing may be read before the access row is found"
    sql = calls[0][0]
    assert "FROM workflow_runs wr" in sql
    assert "wr.id = $1" in sql
    assert "wr.status IN ('completed', 'failed', 'cancelled')" in sql
    assert "org_members" in sql and "wr.user_id = $2" in sql
    assert wire["opened"] == []


@pytest.mark.asyncio
async def test_the_404_bodies_are_identical(wire):
    from fastapi import HTTPException

    seen = []
    for run_id, viewer in [(RUN_DONE, OUTSIDER), (RUN_MISSING, OWNER), (RUN_PAUSED, COLLEAGUE)]:
        with pytest.raises(HTTPException) as exc:
            await _read(run_id, viewer)
        seen.append((exc.value.status_code, exc.value.detail, exc.value.headers))
    assert len(set(seen)) == 1


def test_the_route_is_canvas_gated_and_mounted():
    from app.main import app
    from app.middleware.canvas_gate import CANVAS_GATED_PATHS

    path = "/workflow-runs/{workflow_run_id}/evidence"
    assert path in CANVAS_GATED_PATHS
    routes = [r for r in app.routes if getattr(r, "path", None) == path]
    assert len(routes) == 1 and routes[0].methods == {"GET"}
