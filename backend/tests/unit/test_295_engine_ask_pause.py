"""Phase 295 (RUN-01 / RUN-04, plan 295-03 Task 1) — an engine-owned ask pauses DURABLY.

D-01 / D-18 / D-37: the engine's citations gate (exhausted on 0 sources or 0 markers) and the
armed action-risk approval no longer block in-process on ``subscribe_for_response``. They:

  1. write ``pause_run`` (the run reads ``paused``; the claim lease is released, D-50),
  2. stash what the re-drive needs under ``workflow_phases.output._awaiting_answer`` (D-40),
  3. insert the durable prompt row — FAIL-CLOSED, because it is the only way back in (D-50),
  4. write ONE ``policy_applied`` audit with ``policy: "engine_ask_pause"`` and the finding,
  5. emit ``ask_user_prompt`` with ``timeout_seconds=None`` and the ``engine_pause`` payload,
  6. return ``PhaseOutcome("pause_run")`` so the shipped pause arm does the rest.

Every network dependency is replaced by a recorder (``feedback_mock_completeness``): the four
db functions engine_ask binds as module globals, ``app.utils.db.aexec`` (the prompt row),
``write_audit``, ``ctx.emit`` and ``subscribe_for_response`` (which must never be awaited).
The ORDER of the recorded events is the assertion, never a call count alone.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest

STEP_NAME = "Summarise the renewal terms"
FOLDER = "Contracts"
PHASE_ROW_ID = uuid4()
NEVER_SAY = (
    "citations_required", "markers", "validator", "gate", "Proceed anyway", "Abort",
    "Proven", "field_map", "aborted by user", "0/",
)


# ── fixtures ──────────────────────────────────────────────────────────────────────────────
def kb_phase(*, escalated: bool = False, slug: str = "summarise", name: str = STEP_NAME):
    """A detected KB step as the ENGINE runs it (effective_phase appends the citations gate)."""
    from app.models.harness import PhaseSpec
    from app.services.harness.grounding import effective_phase

    raw = PhaseSpec(
        slug=slug,
        phase_index=1,
        name=name,
        config={
            "phase_type": "llm_agent",
            "prompt": "Find the renewal terms and cite where you read them.",
            "available_tools": ["search_documents"],
        },
        validators=[],
        grounding_escalated=escalated,
    )
    return effective_phase(raw, total_phases=3)


def agent_output(*, citations=None, retrieval_error=None, text="The term renews yearly."):
    out = {"text": text, "sub_run_id": "sub-1", "citations": citations or [],
           "similarity_scores": []}
    if retrieval_error:
        out["retrieval_error"] = retrieval_error
    return out


class FakeSupabase:
    """``supabase.table("messages").insert(row)`` returns an object carrying ``row``."""

    def __init__(self):
        self.inserted: list[dict] = []

    def table(self, name):
        sb = self

        class _T:
            def insert(self, row):
                sb.inserted.append(row)
                return SimpleNamespace(row=row, table=name)

        return _T()


class Recorder:
    """One ordered log over every side effect the pause may cause."""

    def __init__(self, *, insert_raises: bool = False, active_slug: str = "summarise"):
        self.events: list[tuple] = []
        self.insert_raises = insert_raises
        self.active_slug = active_slug
        self.subscribed = 0
        self.body_calls = 0

    # db (engine_ask module globals)
    async def pause_run(self, pool, run_id):
        self.events.append(("pause_run", run_id))

    async def stash(self, pool, phase_id, awaiting):
        self.events.append(("stash", phase_id, awaiting))

    async def get_active_phase(self, pool, run_id):
        return {"id": PHASE_ROW_ID, "slug": self.active_slug, "status": "active",
                "output": None, "phase_index": 1}

    # app.utils.db.aexec — the prompt row
    async def aexec(self, builder):
        if self.insert_raises:
            raise RuntimeError("insert failed (planted)")
        self.events.append(("prompt_row", getattr(builder, "row", None)))
        return SimpleNamespace(data=[getattr(builder, "row", None)])

    async def write_audit(self, pool, run_id, **kw):
        self.events.append(("audit", kw.get("event_type"), kw.get("metadata")))

    async def emit(self, redis, stream_id, event, **kw):
        self.events.append(("emit", event, kw))

    async def subscribe(self, *a, **k):
        self.subscribed += 1
        return None

    async def kb_label(self, conn, definition):
        return FOLDER

    async def body(self, phase, accumulated, ctx):
        self.body_calls += 1
        self.events.append(("body",))
        return agent_output()

    def names(self) -> list[str]:
        return [e[0] if e[0] != "audit" and e[0] != "emit" else f"{e[0]}:{e[1]}" for e in self.events]

    def first(self, name):
        for e in self.events:
            if e[0] == name:
                return e
        return None

    def emits(self, event):
        return [e[2] for e in self.events if e[0] == "emit" and e[1] == event]


def make_ctx(rec: Recorder, *, golden: bool = False, definition=None, supabase=None):
    return SimpleNamespace(
        supabase=supabase if supabase is not None else FakeSupabase(),
        thread_id=str(uuid4()),
        current_user={"id": str(uuid4()), "email": "owner@example.com"},
        producer_run_id=uuid4(),
        emit=rec.emit,
        retry_feedback=None,
        is_golden_run=golden,
        definition=definition,
        folder_subtree_ids=None,
        inputs={},
    )


def patches(rec: Recorder, *, folders=None):
    """Every seam the durable pause reaches, as one ExitStack-able list."""
    from app.services import harness_engine
    from app.services.harness import engine_ask

    async def _folders(*a, **k):
        return list(folders or [])

    return [
        patch.object(engine_ask, "pause_run", rec.pause_run),
        patch.object(engine_ask, "stash_awaiting_answer", rec.stash),
        patch.object(engine_ask, "get_active_phase", rec.get_active_phase),
        patch.object(engine_ask, "write_audit", rec.write_audit),
        patch.object(engine_ask, "_emit", rec.emit),
        patch.object(engine_ask, "resolve_kb_label", rec.kb_label),
        patch.object(engine_ask, "permitted_folder_options", _folders),
        patch.object(harness_engine, "write_audit", rec.write_audit),
        patch.object(harness_engine, "_emit", rec.emit),
        patch.object(harness_engine, "_execute_phase", rec.body),
        patch("app.utils.db.aexec", rec.aexec),
        patch("app.services.ask_user_service.subscribe_for_response", rec.subscribe),
    ]


def run_with(rec, coro_factory, *, folders=None):
    from contextlib import ExitStack

    with ExitStack() as stack:
        for p in patches(rec, folders=folders):
            stack.enter_context(p)
        return asyncio.run(coro_factory())


def resolve_post(phase, output, ctx, rec, *, folders=None, failed_idx=None):
    """The engine's exhausted post-gate exit, called exactly as harness_engine calls it."""
    from app.services import harness_engine

    idx = len(phase.validators) - 1 if failed_idx is None else failed_idx
    return run_with(rec, lambda: harness_engine._resolve_failure_with_ask_user(
        phase, "citations_required: planted finding", 2, idx,
        run_id=uuid4(), pool=object(), redis=object(), ctx=ctx,
        _audit_user_id=uuid4(), produced_output=output, is_pre=False,
    ), folders=folders)


# ── the predicate (D-51) ──────────────────────────────────────────────────────────────────
def test_is_engine_citation_gate_is_true_only_for_the_appended_spec():
    from app.models.harness import PhaseSpec
    from app.services.harness.grounding import effective_phase, is_engine_citation_gate

    eff = kb_phase()
    last = len(eff.validators) - 1
    assert is_engine_citation_gate(eff, last) is True
    assert is_engine_citation_gate(eff, None) is False

    # An author's own citations_required sits at a LOWER index (D-185-05).
    raw = PhaseSpec(
        slug="s", phase_index=0,
        config={"phase_type": "llm_agent", "prompt": "p", "available_tools": ["search_documents"]},
        validators=[{"kind": "citations_required", "config": {"mode": "retrieved_and_cited"}}],
    )
    both = effective_phase(raw, total_phases=1)
    assert len(both.validators) == 2
    assert is_engine_citation_gate(both, 0) is False
    assert is_engine_citation_gate(both, 1) is True

    # A non-KB step never carries the engine gate.
    plain = PhaseSpec(
        slug="n", phase_index=0,
        config={"phase_type": "llm_agent", "prompt": "p", "available_tools": ["execute_code"]},
        validators=[{"kind": "citations_required", "config": {"mode": "retrieved_and_cited"}}],
    )
    assert is_engine_citation_gate(effective_phase(plain, total_phases=1), 0) is False


def test_the_engine_gate_keeps_fail_run_in_grounding():
    eff = kb_phase()
    assert eff.validators[-1].on_failure == "fail_run"


def test_finding_from_output_reads_the_validator_keys():
    from app.services.harness.engine_ask import finding_from_output

    assert finding_from_output(agent_output(retrieval_error={"code": "x"})) == "outage"
    assert finding_from_output(agent_output(citations=[])) == "no_sources"
    assert finding_from_output(agent_output(citations=[{"doc": "d"}])) == "no_markers"
    assert finding_from_output(None) == "no_sources"


def test_is_locked_reads_the_stored_bit_not_grounding_cause():
    from app.services.harness.engine_ask import is_locked
    from app.services.harness.grounding import grounding_cause

    unlocked = kb_phase(escalated=False)
    locked = kb_phase(escalated=True)
    assert grounding_cause(unlocked) == "detected"
    assert grounding_cause(locked) == "detected"  # detection wins — D-36's reason
    assert is_locked(unlocked) is False
    assert is_locked(locked) is True


# ── the live pause (D-01 / D-18 / D-37 / D-40 / D-50) ─────────────────────────────────────
def test_a_live_no_sources_finding_pauses_durably_in_order():
    rec = Recorder()
    ctx = make_ctx(rec)
    folders = [{"id": str(uuid4()), "name": "Archive", "depth": 0}]
    outcome = resolve_post(kb_phase(), agent_output(citations=[]), ctx, rec, folders=folders)

    assert outcome is not None and outcome.kind == "pause_run", outcome
    order = rec.names()
    for a, b in [("pause_run", "stash"), ("stash", "prompt_row"),
                 ("prompt_row", "audit:policy_applied"),
                 ("audit:policy_applied", "emit:ask_user_prompt")]:
        assert order.index(a) < order.index(b), order
    assert rec.subscribed == 0, "an engine ask waited in-process"

    row = rec.first("prompt_row")[1]
    tc = row["tool_calls"][0]
    assert tc["kind"] == "ask_user_prompt"
    assert tc["timeout_seconds"] is None
    assert tc["options"] == ["Search another folder", "Continue without sources", "Stop the run"]
    assert tc["prompt"] == (
        f"Searched {FOLDER} and found nothing for “{STEP_NAME}”. How should the run continue?"
    )
    assert row["content"] == tc["prompt"]
    assert tc["draft"] == "The term renews yearly."
    assert tc["engine_pause"] == {
        "kind": "no_sources", "phase": "summarise", "continue_allowed": True,
        "locked": False, "folders": folders,
    }

    sse = rec.emits("ask_user_prompt")[0]
    assert sse["timeout_seconds"] is None
    assert sse["engine_pause"] == tc["engine_pause"]
    assert sse["options"] == tc["options"] and sse["prompt"] == tc["prompt"]
    assert sse["tool_call_id"] == tc["tool_call_id"]
    assert sse["draft"] == tc["draft"]

    audit = [e for e in rec.events if e[0] == "audit" and e[1] == "policy_applied"][0][2]
    assert audit["policy"] == "engine_ask_pause"
    assert audit["finding"] == "no_sources"
    assert audit["phase"] == "summarise"

    stash = rec.first("stash")
    assert stash[1] == PHASE_ROW_ID
    awaiting = stash[2]
    assert awaiting["tool_call_id"] == tc["tool_call_id"]
    assert awaiting["kind"] == "no_sources"
    assert awaiting["options"] == tc["options"]
    assert awaiting["continue_allowed"] is True and awaiting["locked"] is False
    assert awaiting["folder_option_ids"] == [folders[0]["id"]]
    assert awaiting["produced_output"]["text"] == "The term renews yearly."


def test_a_no_markers_finding_never_offers_another_folder():
    rec = Recorder()
    outcome = resolve_post(
        kb_phase(), agent_output(citations=[{"doc": "d"}]), make_ctx(rec), rec,
        folders=[{"id": "f", "name": "Archive", "depth": 0}],
    )
    assert outcome.kind == "pause_run"
    tc = rec.first("prompt_row")[1]["tool_calls"][0]
    assert tc["options"] == ["Continue without sources", "Stop the run"]
    assert tc["prompt"] == (
        f"“{STEP_NAME}” answered without citing its sources in {FOLDER}. "
        "How should the run continue?"
    )
    assert tc["engine_pause"]["kind"] == "no_markers"
    assert tc["engine_pause"]["folders"] == []


def test_a_locked_step_never_offers_continue_and_says_why():
    rec = Recorder()
    outcome = resolve_post(
        kb_phase(escalated=True), agent_output(citations=[]), make_ctx(rec), rec,
        folders=[{"id": "f", "name": "Archive", "depth": 0}],
    )
    assert outcome.kind == "pause_run"
    tc = rec.first("prompt_row")[1]["tool_calls"][0]
    assert tc["options"] == ["Search another folder", "Stop the run"]
    assert "Continue without sources" not in tc["options"]
    assert tc["prompt"] == (
        f"Searched {FOLDER} and found nothing for “{STEP_NAME}”. This step is set to Must "
        "prove it, so it can't continue without sources. How should the run continue?"
    )
    assert tc["engine_pause"]["locked"] is True
    assert tc["engine_pause"]["continue_allowed"] is False


def test_when_only_stop_would_remain_the_step_fails_with_words_and_does_not_pause():
    rec = Recorder()
    outcome = resolve_post(
        kb_phase(escalated=True), agent_output(citations=[]), make_ctx(rec), rec, folders=[],
    )
    assert outcome.kind == "fail_run"
    assert outcome.reason == (
        f"Searched {FOLDER} and found nothing for “{STEP_NAME}”. No other folder is available "
        "to search, and this step is set to Must prove it, so the run stopped."
    )
    assert rec.first("pause_run") is None and rec.first("prompt_row") is None
    assert rec.emits("ask_user_prompt") == []


def test_a_failed_prompt_row_insert_fails_the_run_with_words_and_emits_nothing():
    rec = Recorder(insert_raises=True)
    outcome = resolve_post(kb_phase(), agent_output(citations=[]), make_ctx(rec), rec)
    assert outcome.kind == "fail_run"
    assert outcome.reason and "citations_required" not in outcome.reason
    assert STEP_NAME in outcome.reason
    assert rec.emits("ask_user_prompt") == []


def test_a_golden_run_fails_the_found_nothing_step_with_the_d07_sentence():
    rec = Recorder()
    outcome = resolve_post(kb_phase(), agent_output(citations=[]), make_ctx(rec, golden=True), rec)
    assert outcome.kind == "fail_run"
    assert outcome.reason == (
        f"Searched {FOLDER} and found nothing for “{STEP_NAME}” during the trial run, so it was "
        "stopped. Add documents to that folder, or point the step at a folder that has them."
    )
    assert "citations_required" not in outcome.reason
    assert rec.first("pause_run") is None and rec.first("prompt_row") is None


def test_an_outage_still_fails_with_its_shipped_reason():
    """D-06 — the outage finding keeps the shipped ``_route_on_failure`` reason, byte for byte."""
    from app.services.harness.engine_ask import _route_on_failure

    rec = Recorder()
    phase = kb_phase()
    idx = len(phase.validators) - 1
    outcome = resolve_post(
        phase, agent_output(retrieval_error={"code": "outage"}), make_ctx(rec), rec,
    )
    expected = _route_on_failure(phase, "citations_required: planted finding", 2, idx)
    assert outcome == expected
    assert rec.events == []


def test_an_author_citations_gate_keeps_its_own_disposition():
    """Only the APPENDED gate pauses. An author's fail_run citations gate at a lower index
    routes through ``_route_on_failure`` exactly as before."""
    from app.models.harness import PhaseSpec
    from app.services.harness.engine_ask import _route_on_failure
    from app.services.harness.grounding import effective_phase

    raw = PhaseSpec(
        slug="summarise", phase_index=1, name=STEP_NAME,
        config={"phase_type": "llm_agent", "prompt": "p", "available_tools": ["search_documents"]},
        validators=[{"kind": "citations_required", "on_failure": "fail_run",
                     "config": {"mode": "retrieved_and_cited"}}],
    )
    phase = effective_phase(raw, total_phases=3)
    rec = Recorder()
    outcome = resolve_post(phase, agent_output(citations=[]), make_ctx(rec), rec, failed_idx=0)
    assert outcome == _route_on_failure(phase, "citations_required: planted finding", 2, 0)
    assert rec.events == []


def test_no_prompt_or_option_contains_a_never_say_token():
    """A sweep over every combination the composer can produce (UI-SPEC A.2)."""
    from app.services.harness.engine_ask import compose_engine_choices

    for finding in ("no_sources", "no_markers"):
        for locked in (False, True):
            for folders in ([], [{"id": "f", "name": "Archive", "depth": 0}]):
                prompt, options = compose_engine_choices(
                    finding, step_label=STEP_NAME, folder_label=FOLDER,
                    locked=locked, folders=folders,
                )
                for text in (prompt, *options):
                    for token in NEVER_SAY:
                        assert token not in text, (finding, locked, folders, text, token)


# ── the armed approval (D-18) ─────────────────────────────────────────────────────────────
def test_a_live_armed_wait_is_the_same_durable_pause():
    from app.models.harness import PhaseSpec
    from app.services import harness_engine
    from app.services.harness.engine_ask import _ACTION_RISK_FINDING_PREFIX

    phase = PhaseSpec(
        slug="send", phase_index=1, name="Send the notice",
        config={"phase_type": "programmatic", "fn": "noop"}, action_risk_armed=True,
    )
    rec = Recorder(active_slug="send")
    ctx = make_ctx(rec)
    sentence = 'Step 2 of 3, "Send the notice", is about to run.'
    outcome = run_with(rec, lambda: harness_engine._resolve_failure_with_ask_user(
        phase, _ACTION_RISK_FINDING_PREFIX + sentence, 0, None,
        run_id=uuid4(), pool=object(), redis=object(), ctx=ctx,
        _audit_user_id=uuid4(), is_pre=True, is_action_risk=True,
    ))
    assert outcome is not None and outcome.kind == "pause_run"
    assert rec.subscribed == 0
    order = rec.names()
    assert order.index("pause_run") < order.index("prompt_row") < order.index(
        "emit:ask_user_prompt"
    )
    tc = rec.first("prompt_row")[1]["tool_calls"][0]
    assert tc["options"] == ["Approve this step", "Do not run it"]
    assert tc["prompt"] == sentence
    assert tc["timeout_seconds"] is None
    assert tc["engine_pause"]["kind"] == "action_risk"
    assert tc["engine_pause"]["folders"] == []
    assert rec.emits("ask_user_prompt")[0]["timeout_seconds"] is None


def test_a_golden_armed_step_still_auto_continues_and_runs_the_body():
    """189 D-19 is upstream of the helper and untouched: the body runs, nothing pauses."""
    from app.models.harness import PhaseSpec
    from app.services import harness_engine

    phase = PhaseSpec(
        slug="send", phase_index=0, name="Send the notice",
        config={"phase_type": "programmatic", "fn": "noop"}, action_risk_armed=True,
    )
    rec = Recorder(active_slug="send")
    outcome = run_with(rec, lambda: harness_engine._run_phase_with_gates(
        phase, {}, make_ctx(rec, golden=True),
        run_id=uuid4(), pool=object(), redis=object(), wall_clock=30,
        _audit_user_id=uuid4(), total_phases=1,
    ))
    assert outcome.kind == "completed"
    assert rec.body_calls == 1
    assert rec.first("pause_run") is None and rec.first("prompt_row") is None


# ── the db half (D-50 / D-40) ─────────────────────────────────────────────────────────────
class _SqlPool:
    def __init__(self):
        self.calls: list[tuple] = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "UPDATE 1"


def test_pause_run_releases_the_claim_lease_in_its_single_update():
    from app.db.workflows import pause_run

    pool = _SqlPool()
    asyncio.run(pause_run(pool, uuid4()))
    assert len(pool.calls) == 1
    sql = pool.calls[0][0]
    assert "UPDATE workflow_runs SET status = 'paused'" in sql
    assert "claimed_at = NULL" in sql
    assert "status NOT IN ('completed', 'failed', 'cancelled')" in sql


def test_stash_awaiting_answer_writes_one_nested_key_on_the_active_row_only():
    from app.db.workflows import stash_awaiting_answer
    from app.services.harness_engine import _is_llm_human_input

    pool = _SqlPool()
    awaiting = {"tool_call_id": "tc-1", "kind": "no_sources",
                "produced_output": {"text": "kept"}}
    phase_id = uuid4()
    asyncio.run(stash_awaiting_answer(pool, phase_id, awaiting))
    assert len(pool.calls) == 1
    sql, args = pool.calls[0]
    assert "UPDATE workflow_phases" in sql
    assert "_awaiting_answer" in sql
    assert "status = 'active'" in sql
    assert args[0] == phase_id
    assert args[1] is awaiting, "the dict is passed, never json.dumps (200.1 / D-200.1-01)"

    # D-40 no-leak (stash side): the top-level output gains ONE key and no `text`, so the
    # human-step predicate stays False and readers of output["text"] see nothing of it.
    stored = {"_awaiting_answer": awaiting}
    assert set(stored) == {"_awaiting_answer"} and "text" not in stored
    assert _is_llm_human_input({"config": {"phase_type": "llm_agent"}, "output": stored}) is False


# ── the /pending projection ───────────────────────────────────────────────────────────────
def test_pending_projects_engine_pause_additively():
    import inspect

    from app.api import panel

    src = inspect.getsource(panel)
    assert '"engine_pause": payload.get("engine_pause"),' in src
    assert src.index('"draft": payload.get("draft"),') < src.index(
        '"engine_pause": payload.get("engine_pause"),'
    )


@pytest.mark.parametrize("payload,expected", [
    ({"tool_call_id": "a", "engine_pause": {"kind": "no_sources"}}, {"kind": "no_sources"}),
    ({"tool_call_id": "b"}, None),
])
def test_pending_returns_engine_pause_or_none(payload, expected):
    """Drive the real /pending handler over one stored prompt row (connection seam faked)."""
    from contextlib import asynccontextmanager
    from datetime import datetime, timezone
    from unittest.mock import AsyncMock

    from app.api import panel

    class _Conn:
        async def fetch(self, sql, *args):
            return [{"id": uuid4(), "tool_calls": [{"kind": "ask_user_prompt", **payload}],
                     "created_at": datetime.now(timezone.utc)}]

    @asynccontextmanager
    async def _conn(_request, _user):
        yield _Conn()

    with patch.object(panel, "_verify_thread_ownership", AsyncMock(return_value=None)), \
         patch.object(panel, "get_user_pg_connection", _conn), \
         patch.object(panel, "_prompt_run_is_live", AsyncMock(return_value=True)):
        result = asyncio.run(panel.get_pending_ask_user(
            str(uuid4()), request=object(), current_user={"id": str(uuid4())}, supabase=object(),
        ))
    assert len(result) == 1
    assert result[0]["engine_pause"] == expected
    assert result[0]["tool_call_id"] == payload["tool_call_id"]


# ── SEED-137 re-expressed, the pause half (every row of test_187's CASES) ─────────────────
def _seed137_cases():
    from tests.unit.test_187_armed_checkpoint_property import CASES

    return CASES


@pytest.mark.parametrize("case", _seed137_cases(), ids=lambda c: c["id"])
def test_every_armed_case_pauses_durably_before_the_body(case):
    """For every author validator set in the SC#6 space: on a live run the FIRST drive writes
    ``pause_run`` and a prompt row carrying the armed sentence and the armed option pair, the
    body has not run, and the armed prompt was never awaited in-process. Rows an author's own
    gate routes away from the body (``reaches_body_without_arming=False``) never pause."""
    from contextlib import ExitStack
    from unittest.mock import AsyncMock

    from app.models.harness import PhaseSpec, ValidatorSpec
    from app.services import harness_engine
    from app.services.harness import engine_ask
    from app.services.harness.grounding import _approval_sentence, effective_phase
    from tests.unit.engine_ask_fakes import FakePool, World

    raw = PhaseSpec(
        slug="send-the-notice", phase_index=1, name="Send the renewal notice",
        config={"phase_type": "programmatic", "fn": "noop"}, action_risk_armed=True,
        validators=[ValidatorSpec(**v) for v in case["author_validators"]],
    )
    eff = effective_phase(raw, total_phases=4)
    sentence = _approval_sentence(raw, 4)
    world = World(raw.slug)
    body = {"n": 0}

    async def _body(phase, accumulated, ctx):
        body["n"] += 1
        return {"text": "the deliverable"}

    author = AsyncMock(return_value={"kind": "response", "response_text": "Proceed anyway"})
    with ExitStack() as stack:
        world.enter(stack, subscribe=False)
        stack.enter_context(patch.object(harness_engine, "_execute_phase", _body))
        stack.enter_context(patch.object(harness_engine, "write_audit", world.write_audit))
        stack.enter_context(patch.object(harness_engine, "_emit", world.emit))
        stack.enter_context(patch("app.services.ask_user_service.subscribe_for_response", author))
        outcome = asyncio.run(harness_engine._run_phase_with_gates(
            eff, {}, world.ctx(), run_id=uuid4(), pool=FakePool(), redis=object(),
            wall_clock=30, _audit_user_id=uuid4(), total_phases=4,
        ))

    armed_rows = [(o, r) for o, r in world.prompt_rows()
                  if r["tool_calls"][0]["prompt"] == sentence]
    if not case["reaches_body_without_arming"]:
        assert armed_rows == [] and body["n"] == 0
        assert outcome.kind in ("fail_run", "skip_to")
        return
    assert outcome.kind == "pause_run", (case["id"], outcome)
    assert body["n"] == 0, f"{case['id']}: the body ran before the person answered"
    assert len(armed_rows) == 1, case["id"]
    pause_order = next(e[1] for e in world.events if e[0] == "pause_run")
    assert pause_order < armed_rows[0][0]
    tc = armed_rows[0][1]["tool_calls"][0]
    assert tc["options"] == [engine_ask._ACTION_RISK_APPROVE_CHOICE, "Do not run it"]
    assert tc["timeout_seconds"] is None
    # the author's own gate (if any) still asked in-process; the ARMED prompt never did
    assert all(c.args[2] != tc["tool_call_id"] for c in author.await_args_list)


def _armed_two_drives(answer: dict | None):
    """Pause a live armed step, optionally answer the card, re-drive. Returns
    ``(first, second, world, body_calls)``."""
    from contextlib import ExitStack

    from app.models.harness import PhaseSpec
    from app.services import harness_engine
    from tests.unit.engine_ask_fakes import FakePool, World

    phase = PhaseSpec(
        slug="send", phase_index=0, name="Send the notice",
        config={"phase_type": "programmatic", "fn": "noop"}, action_risk_armed=True,
    )
    world = World("send")
    ctx = world.ctx()
    body = {"n": 0}

    async def _body(_p, _a, _c):
        body["n"] += 1
        return {"text": "done"}

    run_id, user, pool = uuid4(), uuid4(), FakePool()

    def _once():
        return asyncio.run(harness_engine._run_phase_with_gates(
            phase, {}, ctx, run_id=run_id, pool=pool, redis=object(), wall_clock=30,
            _audit_user_id=user, total_phases=1,
        ))

    with ExitStack() as stack:
        world.enter(stack)
        stack.enter_context(patch.object(harness_engine, "_execute_phase", _body))
        stack.enter_context(patch.object(harness_engine, "write_audit", world.write_audit))
        stack.enter_context(patch.object(harness_engine, "_emit", world.emit))
        first = _once()
        tcid = world.latest_tool_call()["tool_call_id"]
        if answer is not None:
            world.answer(answer.get("response_text", ""), answer.get("choice_index"))
        ctx.resume_answered_tool_call_id = tcid
        second = _once()
    return first, second, world, body["n"]


@pytest.mark.xfail(strict=True, reason="consume lands in 295-03 Task 2")
def test_armed_approve_runs_body_exactly_once():
    """The exact approve label, consumed on the re-drive: the body runs exactly once, the
    armed ask is skipped once (no second prompt row), and ONE approval receipt is written."""
    from app.services.harness.engine_ask import _ACTION_RISK_APPROVE_CHOICE

    first, second, world, body_calls = _armed_two_drives(
        {"response_text": _ACTION_RISK_APPROVE_CHOICE, "choice_index": 0}
    )
    assert first.kind == "pause_run"
    assert second.kind == "completed"
    assert body_calls == 1
    assert world.count("prompt_row") == 1
    receipts = world.audits("validator_ask_user_approved")
    assert len(receipts) == 1
    assert receipts[0]["metadata"]["choice"] == _ACTION_RISK_APPROVE_CHOICE


@pytest.mark.xfail(strict=True, reason="consume lands in 295-03 Task 2")
def test_a_decline_consumed_on_the_redrive_fails_naming_the_person_and_the_step():
    first, second, world, body_calls = _armed_two_drives(
        {"response_text": "Do not run it", "choice_index": 1}
    )
    assert first.kind == "pause_run"
    assert second.kind == "fail_run"
    assert body_calls == 0
    assert "Fahad Murad" in second.reason and "Send the notice" in second.reason
    assert "The run is waiting here" not in second.reason
    assert world.audits("validator_ask_user_approved") == []


@pytest.mark.xfail(strict=True, reason="consume lands in 295-03 Task 2")
def test_a_redrive_with_no_durable_answer_stays_paused_and_runs_nothing():
    first, second, world, body_calls = _armed_two_drives(None)
    assert first.kind == "pause_run"
    assert second.kind == "pause_run"
    assert body_calls == 0
    assert world.count("prompt_row") == 1, "a re-drive must never re-ask the same question"
