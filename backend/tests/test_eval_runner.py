"""Phase 133 Plan 03 (EVAL-02) — eval runner SERVICE-level tests.

Proves the two load-bearing behaviors of the bounded background eval job
(``backend/app/services/eval_runner_service.py::run_eval_job``):

  1. ``test_two_results_per_case`` (SC#1): driving the job over 2 owned test cases
     persists EXACTLY 4 ``eval_results`` rows — one ``with_skill`` + one
     ``without_skill`` per case. The WITH arm injects the skill_VERSION snapshot
     into ``RunContext.skill_catalog_override`` (D-03/D-10); the WITHOUT arm injects
     ``()`` (D-04). Both arms are driven by the SAME mocked ``run_agent_loop`` so no
     real (paid) LLM call is made.
  2. ``test_sse_vocabulary`` (SC#2/D-05): the XADDs to ``run:{run_id}`` are
     ``eval_case_started`` / ``eval_case_done`` per arm and a single ``eval_complete``,
     in order — and NO chat terminal type (``done``/``error``) appears BEFORE the
     run's single closing terminal. The inner loop's own ``done``/``error`` terminals
     are swallowed by the NO-OP emit the service hands ``run_agent_loop`` (they would
     otherwise break ``replay_tail_consumer`` on completion #1).

No live LLM / no live DB: ``run_agent_loop`` is patched to return a fake
``AgentLoopResult``; supabase is a small in-memory recording fake honoring the
chained insert/update/delete surface the job touches; redis is the shared
in-memory ``_FakeRedis``; the asyncpg pool is an ``AsyncMock`` (``finalize_run``).
"""
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

OWNER = {"id": "00000000-0000-0000-0000-000000000001", "email": "owner@example.com"}
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}

SKILL_ID = str(uuid4())
SKILL_VERSION_ID = str(uuid4())

# The LATEST skill_version SNAPSHOT (D-03/D-10) — the WITH arm injects THIS into
# the catalog, NOT the live skills row. name/description are the only fields the
# agent-loop catalog note needs.
SKILL_VERSION = {
    "id": SKILL_VERSION_ID,
    "name": "pdf-builder",
    "description": "Builds polished PDF reports from structured data.",
    "version_number": 3,
}

CASES = [
    {"id": str(uuid4()), "prompt": "Make me a one-page PDF summary.",
     "expected_behavior": "Produces a one-page PDF summary of the input."},
    {"id": str(uuid4()), "prompt": "Turn this table into a PDF.",
     "expected_behavior": "Renders the given table as a PDF."},
]

# A fake graded ``JudgeVerdict.model_dump()`` (Phase 134) — the shape ``_judge_eval_answer``
# returns on a real verdict. The existing SC#1/SC#2 tests drive COMPLETED arms, which now
# hit the D-04 grading gate; mocking ``_judge_eval_answer`` keeps them hermetic (no live
# judge / forced_emit call — the whole suite is "no live LLM / no live DB").
_FAKE_VERDICT_PASS = {
    "overall_passed": True,
    "overall_score": 90,
    "grounded_in_evidence": True,
    "answers_business_requirement": True,
    "did_the_work_not_delegated": True,
    "criteria": [],
    "summary": "The answer meets the expected behavior.",
}


# ── A tiny in-memory async fake Redis (copied from the tuner route tests) ─────────
class _FakeRedis:
    """Records XADD entries per stream + supports the zadd/zrem/set/get/expire/eval
    surface the eval job touches. Async methods so ``await redis.xadd(...)`` works."""

    def __init__(self):
        self.streams: dict[str, list] = {}
        self.kv: dict[str, str] = {}
        self.zsets: dict[str, dict] = {}

    async def xadd(self, key, fields, *a, **k):
        self.streams.setdefault(key, []).append(fields)
        return f"{len(self.streams[key])}-0"

    async def zadd(self, key, mapping, *a, **k):
        self.zsets.setdefault(key, {}).update(mapping)
        return len(mapping)

    async def zrem(self, key, *members):
        z = self.zsets.get(key, {})
        for m in members:
            z.pop(m, None)
        return 1

    async def zscore(self, key, member):
        return self.zsets.get(key, {}).get(member)

    async def set(self, key, value, *a, **k):
        if k.get("nx") and key in self.kv:
            return None
        self.kv[key] = value
        return True

    async def get(self, key):
        return self.kv.get(key)

    async def delete(self, *keys):
        n = 0
        for key in keys:
            if key in self.kv:
                del self.kv[key]
                n += 1
        return n

    async def eval(self, script, numkeys, *keys_and_args):
        # CAS compare-and-delete (the _RELEASE_IF_OWNED Lua): delete KEYS[1] IFF
        # its value == ARGV[1]. Emulate exactly.
        keys = list(keys_and_args[:numkeys])
        args = list(keys_and_args[numkeys:])
        key = keys[0]
        expected = args[0]
        if self.kv.get(key) == expected:
            del self.kv[key]
            return 1
        return 0

    async def expire(self, key, ttl):
        return True

    async def exists(self, key):
        """1 if a stream/kv key is present (the stream route's buffer-present probe)."""
        return 1 if (key in self.streams or key in self.kv) else 0

    async def xread(self, streams, count=None, block=None):
        """Non-destructive XREAD over the in-memory streams. Entry ids are positional
        ('1-0','2-0',...); ``last_id`` '0' returns the whole backlog, an advanced id returns
        only newer entries. The replay_tail_consumer returns at the first terminal in the
        backlog (so the live-tail BLOCK path is never reached in these tests)."""
        out = []
        for key, last in (streams or {}).items():
            entries = self.streams.get(key, [])
            try:
                last_idx = int(str(last).split("-")[0])
            except (ValueError, IndexError):
                last_idx = 0
            new = [(f"{i + 1}-0", fields) for i, fields in enumerate(entries) if (i + 1) > last_idx]
            if new:
                out.append((key, new))
        return out

    def events_on(self, stream_key):
        """Return the parsed payloads (dicts) XADD'd to a stream, in order."""
        return [json.loads(f["data"]) for f in self.streams.get(stream_key, [])]


# ── A tiny in-memory recording fake supabase ─────────────────────────────────────
class _Result:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class _RecTable:
    """One chainable table builder that records insert payloads into a shared store
    (so the test can count ``eval_results`` inserts) and honors update/delete/eq."""

    def __init__(self, store: dict, name: str):
        self.store = store
        self.name = name
        self._op = None
        self._payload = None

    def insert(self, payload, *a, **k):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload, *a, **k):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self, *a, **k):
        self._op = "delete"
        return self

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def single(self, *a, **k):
        return self

    def maybe_single(self, *a, **k):
        return self

    def execute(self, *a, **k):
        if self._op == "insert" and self._payload is not None:
            self.store.setdefault(self.name, []).append(self._payload)
            return _Result([self._payload])
        return _Result([])


class _FakeSupabase:
    def __init__(self):
        self.store: dict[str, list] = {}

    def table(self, name):
        return _RecTable(self.store, name)


@pytest.fixture
def redis():
    return _FakeRedis()


@pytest.fixture
def supabase():
    return _FakeSupabase()


@pytest.fixture
def pool():
    """An asyncpg.Pool stand-in — finalize_run only calls ``pool.execute(...)``."""
    p = MagicMock()
    p.execute = AsyncMock(return_value=None)
    return p


@pytest.fixture
def fake_loop_result():
    """The fake ``AgentLoopResult`` the patched ``run_agent_loop`` returns — carries
    the completion text + token totals the eval service reads (no ``persist`` needed:
    the eval service NEVER calls it — eval_results is the durable record)."""
    return SimpleNamespace(
        full_content_final="A fake completion answer.",
        input_tokens_total=11,
        output_tokens_total=22,
    )


@pytest.mark.asyncio
async def test_eval_thread_marked_is_eval(supabase):
    """Phase 134.1 / BUG-260702-01: the ephemeral eval-execution thread is created with
    is_eval=True so list_threads (threads.py) hides it from the chat sidebar — evals run
    silently instead of polluting the user's conversation list. Guards the upstream contract
    the sidebar's .eq('is_eval', False) filter keys off."""
    from app.services import eval_runner_service

    tid = await eval_runner_service._create_eval_thread(supabase, OWNER["id"])
    threads = supabase.store.get("threads", [])
    assert len(threads) == 1, "exactly one eval-execution thread row is created per run"
    payload = threads[0]
    assert payload["id"] == tid
    assert payload["user_id"] == OWNER["id"]
    assert payload["is_eval"] is True


@pytest.mark.asyncio
async def test_two_results_per_case(redis, supabase, pool, fake_loop_result):
    """SC#1: 2 cases → exactly 4 eval_results rows (with_skill + without_skill each),
    and the WITH arm's catalog override comes from the version snapshot, the WITHOUT
    arm's is empty."""
    from app.services import eval_runner_service

    run_id = uuid4()
    captured_overrides: list = []

    async def _fake_run_agent_loop(ctx, **kwargs):
        captured_overrides.append(ctx.skill_catalog_override)
        return fake_loop_result

    with patch.object(eval_runner_service, "run_agent_loop", _fake_run_agent_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer",
                      new=AsyncMock(return_value=dict(_FAKE_VERDICT_PASS))):
        await eval_runner_service.run_eval_job(
            run_id=run_id,
            skill_id=SKILL_ID,
            skill_version=SKILL_VERSION,
            cases=CASES,
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            current_user=OWNER,
            user_settings=MagicMock(),
            redis=redis,
            supabase=supabase,
            pool=pool,
        )

    results = supabase.store.get("eval_results", [])
    assert len(results) == 4, f"expected 4 eval_results (2 per case), got {len(results)}"

    variants = sorted(r["variant"] for r in results)
    assert variants == ["with_skill", "with_skill", "without_skill", "without_skill"]

    # Every result is owner-stamped + provider-keyed.
    assert all(r["user_id"] == OWNER["id"] for r in results)
    assert all(r["provider"] == "anthropic" for r in results)

    # The WITH arm injected the version SNAPSHOT (name/description), the WITHOUT arm
    # injected the empty tuple () — proves D-03/D-04 + D-10 traceability.
    with_arms = [o for o in captured_overrides if o]
    without_arms = [o for o in captured_overrides if o == ()]
    assert len(with_arms) == 2 and len(without_arms) == 2
    assert all(o[0]["name"] == SKILL_VERSION["name"] for o in with_arms)
    assert all(o[0]["description"] == SKILL_VERSION["description"] for o in with_arms)

    # finalize_run closed the companion runs row (pool.execute called).
    assert pool.execute.await_count >= 1


@pytest.mark.asyncio
async def test_thread_reset_before_each_arm(redis, supabase, pool, fake_loop_result):
    """Baseline-contamination regression (found live 2026-07-04): run_agent_loop
    persists the WITH arm's messages to the shared eval thread, so the WITHOUT arm
    MUST get its own thread reset — otherwise the baseline reads the with-skill
    conversation as history (DeepSeek thinking-mode 400s on the replayed assistant
    turn; Gemini/GPT return an empty "already answered" response). Asserts the
    per-case sequence is reset → WITH arm → reset → WITHOUT arm, with each reset
    carrying that case's own prompt."""
    from app.services import eval_runner_service

    sequence: list[tuple[str, str]] = []
    real_reset = eval_runner_service._reset_thread_to_prompt

    async def _recording_reset(supabase_arg, thread_id, user_id, prompt):
        sequence.append(("reset", prompt))
        return await real_reset(supabase_arg, thread_id, user_id, prompt)

    async def _fake_run_agent_loop(ctx, **kwargs):
        arm = "with" if ctx.skill_catalog_override else "without"
        sequence.append(("arm", arm))
        return fake_loop_result

    with patch.object(eval_runner_service, "_reset_thread_to_prompt", _recording_reset), \
         patch.object(eval_runner_service, "run_agent_loop", _fake_run_agent_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer",
                      new=AsyncMock(return_value=dict(_FAKE_VERDICT_PASS))):
        await eval_runner_service.run_eval_job(
            run_id=uuid4(),
            skill_id=SKILL_ID,
            skill_version=SKILL_VERSION,
            cases=CASES,
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            current_user=OWNER,
            user_settings=MagicMock(),
            redis=redis,
            supabase=supabase,
            pool=pool,
        )

    expected = []
    for case in CASES:
        expected += [
            ("reset", case["prompt"]), ("arm", "with"),
            ("reset", case["prompt"]), ("arm", "without"),
        ]
    assert sequence == expected, (
        f"each arm must start from a bare-prompt thread; got {sequence}"
    )


def test_format_tool_evidence_renders_execute_code_receipt():
    """SEED-100 judge-evidence channel: a production-shaped messages.tool_calls entry
    (execute_code with a JSON-string result carrying output_files) renders as a
    receipts line naming the file + size + exit code — the ground truth the judge
    needs to grade artifact-producing skills (the ~90%-fail blind spot)."""
    from app.services.eval_runner_service import _format_tool_evidence

    receipt = json.dumps({
        "status": "completed", "exit_code": 0, "duration_ms": 121,
        "output_files": [{"filename": "mock_page.docx", "url": "/x", "size": 36916}],
        "stdout": "/sandbox/output/mock_page.docx\n", "stderr": "",
    })
    block = _format_tool_evidence([[{
        "name": "execute_code", "args": {"code": "..."}, "result": receipt,
        "status": "done", "tool_call_id": "call_1",
    }]])
    assert "execute_code" in block
    assert "exit_code=0" in block
    assert "mock_page.docx (36916 bytes)" in block

    # Non-file tools surface a bounded result head; the whole block is capped.
    block2 = _format_tool_evidence([[{"name": "search_documents", "result": "top chunk: " + "x" * 500}]])
    assert block2.startswith("search_documents")
    assert len(block2) < 400


@pytest.mark.asyncio
async def test_judge_receives_tool_evidence_block(redis, supabase, pool, fake_loop_result):
    """The D-04 grading gate appends the arm's runtime tool receipts to what the judge
    grades (answer + TOOL EVIDENCE block), while eval_results.output stays the PURE
    model answer. Without evidence the judge previously saw ONLY full_content_final —
    artifact-producing arms failed as 'unverifiable claims' on every provider."""
    from app.services import eval_runner_service

    judged_answers: list[str] = []

    async def _fake_judge(*, answer, expected_behavior, user_settings):
        judged_answers.append(answer)
        return dict(_FAKE_VERDICT_PASS)

    with patch.object(eval_runner_service, "run_agent_loop",
                      new=AsyncMock(return_value=fake_loop_result)), \
         patch.object(eval_runner_service, "_gather_tool_evidence",
                      new=AsyncMock(return_value="execute_code #1: status=completed exit_code=0 files=[mock_page.docx (36916 bytes)]")), \
         patch.object(eval_runner_service, "_judge_eval_answer", new=_fake_judge):
        await eval_runner_service.run_eval_job(
            run_id=uuid4(),
            skill_id=SKILL_ID,
            skill_version=SKILL_VERSION,
            cases=[CASES[0]],
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            current_user=OWNER,
            user_settings=MagicMock(),
            redis=redis,
            supabase=supabase,
            pool=pool,
        )

    assert len(judged_answers) == 2, "both arms graded"
    for answer in judged_answers:
        assert answer.startswith("A fake completion answer."), "the model answer leads"
        assert "TOOL EVIDENCE" in answer, "runtime receipts reach the judge"
        assert "mock_page.docx (36916 bytes)" in answer

    # The persisted output is the PURE model answer — evidence never pollutes the row.
    results = supabase.store.get("eval_results", [])
    assert all(r["output"] == "A fake completion answer." for r in results)


@pytest.mark.asyncio
async def test_arm_heartbeat_keeps_buffer_warm(redis, supabase, pool, fake_loop_result):
    """BUG-260702-03 (b): a slow arm pulses eval_heartbeat onto the run buffer while
    run_agent_loop is in flight — the NO-OP emit otherwise leaves the stream silent for
    the arm's whole 40-70s duration, tripping the replay-tail consumer's ~30s Redis
    XREAD socket timeout and killing the live client mid-run. Interval patched tiny;
    the pulse must also STOP with the arm (cancelled in the finally) — no heartbeat
    may land after the closing terminal."""
    import asyncio as _asyncio

    from app.services import eval_runner_service

    run_id = uuid4()

    async def _slow_loop(ctx, **kwargs):
        await _asyncio.sleep(0.08)
        return fake_loop_result

    with patch.object(eval_runner_service, "EVAL_HEARTBEAT_SECONDS", 0.01), \
         patch.object(eval_runner_service, "run_agent_loop", _slow_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer",
                      new=AsyncMock(return_value=dict(_FAKE_VERDICT_PASS))):
        await eval_runner_service.run_eval_job(
            run_id=run_id,
            skill_id=SKILL_ID,
            skill_version=SKILL_VERSION,
            cases=CASES[:1],
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            current_user=OWNER,
            user_settings=MagicMock(),
            redis=redis,
            supabase=supabase,
            pool=pool,
        )

    events = [json.loads(f["data"]) for f in redis.streams.get(f"run:{run_id}", [])]
    types = [e["type"] for e in events]
    beats = [t for t in types if t == "eval_heartbeat"]
    assert len(beats) >= 2, f"expected >=2 heartbeats from the slow arm, got {len(beats)} ({types})"
    # Pulse stops with the arm: nothing lands after the single closing terminal.
    assert "done" in types, f"missing closing terminal in {types}"
    assert "eval_heartbeat" not in types[types.index("done"):], (
        f"heartbeat leaked past the terminal: {types}"
    )


@pytest.mark.asyncio
async def test_sse_vocabulary(redis, supabase, pool, fake_loop_result):
    """SC#2/D-05: the run buffer carries ONLY eval_* progress (eval_case_started /
    eval_case_done / eval_complete) until the single closing terminal — NO chat
    terminal type leaks mid-run (the inner loop's done/error are swallowed by the
    NO-OP emit)."""
    from app.services import eval_runner_service

    run_id = uuid4()

    async def _fake_run_agent_loop(ctx, **kwargs):
        # Deliberately drive the passed emit/emit_terminal: prove they are NO-OPs and
        # never reach the shared run buffer (a real emit would XADD a 'done' here).
        emit = kwargs.get("emit")
        emit_terminal = kwargs.get("emit_terminal")
        if emit is not None:
            await emit("done", content="leaked-terminal-should-be-swallowed")
        if emit_terminal is not None:
            await emit_terminal("done")
        return fake_loop_result

    with patch.object(eval_runner_service, "run_agent_loop", _fake_run_agent_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer",
                      new=AsyncMock(return_value=dict(_FAKE_VERDICT_PASS))):
        await eval_runner_service.run_eval_job(
            run_id=run_id,
            skill_id=SKILL_ID,
            skill_version=SKILL_VERSION,
            cases=CASES,
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            current_user=OWNER,
            user_settings=MagicMock(),
            redis=redis,
            supabase=supabase,
            pool=pool,
        )

    events = redis.events_on(f"run:{run_id}")
    types = [e["type"] for e in events]

    # The eval-domain vocabulary is present and ordered.
    assert "eval_case_started" in types
    assert "eval_case_done" in types
    assert "eval_complete" in types
    assert types.index("eval_case_started") < types.index("eval_case_done")

    # eval_complete is the LAST eval_* event (after every per-case event).
    eval_idxs = [i for i, t in enumerate(types) if t.startswith("eval_")]
    assert types[eval_idxs[-1]] == "eval_complete"

    # NO chat terminal type appears BEFORE eval_complete — the inner loop's swallowed
    # 'done'/'error' never reached the shared buffer. The run closes with exactly one
    # terminal AFTER eval_complete.
    complete_idx = types.index("eval_complete")
    assert "done" not in types[:complete_idx]
    assert "error" not in types[:complete_idx]
    # Exactly one terminal, and it is the final entry.
    terminals = [t for t in types if t in ("done", "error")]
    assert terminals == ["done"]
    assert types[-1] == "done"


# ════════════════════════════════════════════════════════════════════════════════
# Phase 134 Plan 02 (EVAL-03) — the HONEST verdict engine: inline grading of both arms
# against expected_behavior, an honest not_measured / judge_error state, the with-skill
# rollup, and the load-bearing judge-provider-independence + Deep-byte-identical guards.
# The judge is mocked in every unit test (no live provider call — the suite is hermetic).
# ════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_completed_arm_graded(redis, supabase, pool, fake_loop_result):
    """EVAL-03: a completed, non-empty arm is graded inline — persisted with
    verdict_state=='graded' and non-null verdict_passed/score/reason/judge_model, in the
    SAME insert (D-05/D-06). The judge fn is mocked (no live forced_emit shot)."""
    from app.services import eval_runner_service

    run_id = uuid4()

    async def _completed_loop(ctx, **kwargs):
        return fake_loop_result

    judge = AsyncMock(return_value=dict(_FAKE_VERDICT_PASS))
    with patch.object(eval_runner_service, "run_agent_loop", _completed_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer", judge):
        await eval_runner_service.run_eval_job(
            run_id=run_id, skill_id=SKILL_ID, skill_version=SKILL_VERSION, cases=CASES,
            provider="anthropic", model="claude-haiku-4-5-20251001",
            current_user=OWNER, user_settings=MagicMock(),
            redis=redis, supabase=supabase, pool=pool,
        )

    results = supabase.store.get("eval_results", [])
    completed = [r for r in results if r["status"] == "completed"]
    assert completed, "expected at least one completed arm to grade"
    for r in completed:
        assert r["verdict_state"] == "graded", f"completed arm not graded: {r['verdict_state']}"
        assert r["verdict_passed"] is not None
        assert r["verdict_score"] is not None
        assert r["verdict_reason"] is not None
        assert r["judge_model"] is not None  # resolve_judge_model recorded the judge (D-03)
    # Every completed arm was graded EXACTLY once (both arms of both cases — D-02).
    assert judge.await_count == len(completed)


@pytest.mark.asyncio
async def test_errored_arm_not_measured(redis, supabase, pool):
    """EVAL-03 SC#1 / D-04: an arm whose completion RAISES (status='failed', empty output)
    is persisted with verdict_state=='not_measured' + verdict_passed IS NULL, and the judge
    fn is NEVER called — the honesty gate, not just the persisted state. This is exactly how
    the deferred cross-provider baseline bugs (BUG-260701-01 / -260630-01) surface honestly
    (D-11) instead of as a fabricated score."""
    from app.services import eval_runner_service

    run_id = uuid4()

    async def _raising_loop(ctx, **kwargs):
        raise RuntimeError("provider 400 — the baseline arm broke on a newer model")

    judge = AsyncMock(return_value=dict(_FAKE_VERDICT_PASS))
    with patch.object(eval_runner_service, "run_agent_loop", _raising_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer", judge):
        await eval_runner_service.run_eval_job(
            run_id=run_id, skill_id=SKILL_ID, skill_version=SKILL_VERSION, cases=CASES,
            provider="anthropic", model="claude-haiku-4-5-20251001",
            current_user=OWNER, user_settings=MagicMock(),
            redis=redis, supabase=supabase, pool=pool,
        )

    results = supabase.store.get("eval_results", [])
    # All 4 arms (2 cases × 2 arms) still persist despite the raise (D-06 — partials readable).
    assert len(results) == 4, f"expected 4 persisted rows, got {len(results)}"
    for r in results:
        assert r["verdict_state"] == "not_measured", f"errored arm mis-stated: {r['verdict_state']}"
        assert r["verdict_passed"] is None, "an errored arm must carry a NULL verdict_passed"
        assert r["verdict_score"] is None
    # THE honesty gate: the judge is NEVER called for an errored/empty arm (D-04).
    assert judge.await_count == 0, "the judge must not run on an errored/empty arm (D-04)"


@pytest.mark.asyncio
async def test_rollup_counts(redis, supabase, pool, fake_loop_result):
    """EVAL-03 / D-07 / OQ3: over a 2-case run where the two WITH-skill arms grade 1 pass /
    1 fail, the eval_runs rollup is passed_count==1, measured_count==2 — the without-skill
    verdicts do NOT count toward the denominator. verdict_summary is the non-authoritative
    default (not all measured passed → 'fail'; Phase 136 owns the real threshold)."""
    from app.services import eval_runner_service

    run_id = uuid4()

    async def _completed_loop(ctx, **kwargs):
        return fake_loop_result

    async def _fake_judge(*, answer, expected_behavior, user_settings):
        # Branch on the case (both arms of a case share expected_behavior; only the WITH
        # arm counts): case 1 → pass, case 2 → fail.
        v = dict(_FAKE_VERDICT_PASS)
        v["overall_passed"] = expected_behavior == CASES[0]["expected_behavior"]
        return v

    upd = AsyncMock()
    with patch.object(eval_runner_service, "run_agent_loop", _completed_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer", _fake_judge), \
         patch.object(eval_runner_service, "_update_eval_run_status", upd):
        await eval_runner_service.run_eval_job(
            run_id=run_id, skill_id=SKILL_ID, skill_version=SKILL_VERSION, cases=CASES,
            provider="anthropic", model="claude-haiku-4-5-20251001",
            current_user=OWNER, user_settings=MagicMock(),
            redis=redis, supabase=supabase, pool=pool,
        )

    assert upd.await_count >= 1, "the finalize rollup update never ran"
    kw = upd.await_args.kwargs  # the LAST call is the success finalize
    assert kw["measured_count"] == 2, f"with-skill measured; got {kw.get('measured_count')}"
    assert kw["passed_count"] == 1, f"one with-skill pass; got {kw.get('passed_count')}"
    # Non-authoritative default (OQ2): not every measured with-skill case passed → 'fail'.
    assert kw["verdict_summary"] == "fail"


@pytest.mark.asyncio
async def test_judge_provider_independent(redis, supabase, pool, fake_loop_result):
    """EVAL-03 / D-03 / T-134-07 / Pitfall 1 (the 133 306dd2d4 bug class): the judge shot is
    routed with an EXPLICIT provider= equal to the JUDGE model's registry provider (the
    independent resolve_judge_model model), NOT user_settings.active_provider (the
    provider-under-test). ``forced_emit`` is patched at its SOURCE module
    (app.services.forced_emit.forced_emit) because _judge_eval_answer imports it
    function-locally — patching eval_runner_service.forced_emit would AttributeError."""
    from app.config import get_model_capability, settings as app_settings
    from app.services import eval_runner_service
    from app.services.harness.validator_kinds import JudgeVerdict, resolve_judge_model

    run_id = uuid4()

    async def _completed_loop(ctx, **kwargs):
        return fake_loop_result

    fake_emitted = JudgeVerdict(
        overall_passed=True, overall_score=88, grounded_in_evidence=True,
        answers_business_requirement=True, did_the_work_not_delegated=True,
        criteria=[], summary="ok",
    )
    forced = AsyncMock(return_value={"emitted": fake_emitted, "failure": None})

    # The INDEPENDENT judge provider we EXPECT (derived from resolve_judge_model, not the run).
    expected_judge_provider = (get_model_capability(resolve_judge_model(app_settings)) or {}).get("provider")

    # provider-under-test = openai; its active_provider differs from the judge provider.
    us = SimpleNamespace(active_provider="openai")

    with patch.object(eval_runner_service, "run_agent_loop", _completed_loop), \
         patch("app.services.forced_emit.forced_emit", forced):  # SOURCE module (function-local import)
        await eval_runner_service.run_eval_job(
            run_id=run_id, skill_id=SKILL_ID, skill_version=SKILL_VERSION, cases=CASES,
            provider="openai", model="gpt-5",
            current_user=OWNER, user_settings=us,
            redis=redis, supabase=supabase, pool=pool,
        )

    assert forced.await_count >= 1, "the judge forced_emit shot never ran"
    for call in forced.await_args_list:
        prov = call.kwargs.get("provider")
        assert prov == expected_judge_provider, \
            f"judge routed to {prov!r}, not the independent judge provider {expected_judge_provider!r}"
        assert prov != us.active_provider, "judge must NEVER route to the provider-under-test (D-03)"


def test_deep_mode_byte_identical_guard():
    """D-13: Phase 134 reuses the judge READ-ONLY via a forced_emit call — NO agent_loop.py
    edit, Deep Mode stays byte-identical, and RunContext.skill_catalog_override stays an
    additive default-OFF field (None = the DB-query path). The dedicated catalog-override
    coverage lives in test_agent_loop_catalog_override.py (133); this re-affirms the red line."""
    import dataclasses
    import subprocess
    from pathlib import Path

    from app.services.agent_loop import RunContext

    # (1) skill_catalog_override remains additive + default-off (None → Deep byte-identical).
    fields = {f.name: f for f in dataclasses.fields(RunContext)}
    assert "skill_catalog_override" in fields, "the additive override field vanished"
    assert fields["skill_catalog_override"].default is None, "skill_catalog_override must default OFF (None)"

    # (2) agent_loop.py is byte-unchanged — the judge is a forced_emit call, not a loop edit.
    repo_root = Path(__file__).resolve().parents[2]  # backend/tests/ -> repo root
    r = subprocess.run(
        ["git", "diff", "--quiet", "backend/app/services/agent_loop.py"],
        cwd=str(repo_root),
    )
    assert r.returncode == 0, "agent_loop.py must stay byte-identical this phase (D-13)"


# ================================================================================
# Phase 137.1 Plan 02 (EVAL-05e / EVAL-05d) — two additive per-arm signals captured in
# the SAME _persist_result insert (D-06), with ZERO new LLM calls: per-arm wall-clock
# duration_ms measured around the run_agent_loop await, and the judge's advisory
# case_feedback lifted from the SAME forced JudgeVerdict emission. Neither may touch the
# with-skill rollup denominator (advisory / orthogonal). Plus the D-02 skill-less
# smoke-sweep persist: a caseless arm (test_case_id=None) persists SQL NULL, never "None".
# The judge is mocked in every unit test (no live provider call — the suite stays hermetic).
# ================================================================================


@pytest.mark.asyncio
async def test_completed_arm_persists_duration_ms(redis, supabase, pool, fake_loop_result):
    """EVAL-05e: every completed arm persists a non-null integer duration_ms — the
    wall-clock of the run_agent_loop await (time.monotonic). The loop is given a small
    real delay so the measured value is provably > 0, proving the timer WRAPS the await
    (not a hardcoded 0). The with-skill rollup denominator is UNAFFECTED by the timer."""
    import asyncio as _asyncio

    from app.services import eval_runner_service

    run_id = uuid4()

    async def _slow_loop(ctx, **kwargs):
        await _asyncio.sleep(0.05)  # ~50ms of real wall-clock the timer must capture
        return fake_loop_result

    upd = AsyncMock()
    with patch.object(eval_runner_service, "run_agent_loop", _slow_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer",
                      new=AsyncMock(return_value=dict(_FAKE_VERDICT_PASS))), \
         patch.object(eval_runner_service, "_update_eval_run_status", upd):
        await eval_runner_service.run_eval_job(
            run_id=run_id, skill_id=SKILL_ID, skill_version=SKILL_VERSION, cases=CASES,
            provider="anthropic", model="claude-haiku-4-5-20251001",
            current_user=OWNER, user_settings=MagicMock(),
            redis=redis, supabase=supabase, pool=pool,
        )

    results = supabase.store.get("eval_results", [])
    assert len(results) == 4, f"expected 4 persisted rows, got {len(results)}"
    for r in results:
        dm = r.get("duration_ms")
        assert isinstance(dm, int), f"duration_ms must be a non-null int, got {dm!r}"
        assert dm >= 20, f"the timer must wrap the ~50ms await; got {dm}ms"

    # Rollup denominator is UNTOUCHED by duration (an orthogonal per-arm signal).
    kw = upd.await_args.kwargs
    assert kw["measured_count"] == 2, f"duration changed measured_count: {kw.get('measured_count')}"
    assert kw["passed_count"] == 2, f"duration changed passed_count: {kw.get('passed_count')}"


@pytest.mark.asyncio
async def test_timed_out_arm_still_persists_duration_ms(redis, supabase, pool):
    """EVAL-05e: the timer lives in a `finally`, so a timed_out / failed arm STILL persists
    a duration_ms — never crashes. The judge is never called on an errored arm (D-04), so
    the row stays not_measured; the wall-clock it DID burn is still recorded."""
    import asyncio as _asyncio

    from app.services import eval_runner_service

    async def _timing_out_loop(ctx, **kwargs):
        await _asyncio.sleep(0.03)
        raise _asyncio.TimeoutError("per-call timeout")

    judge = AsyncMock(return_value=dict(_FAKE_VERDICT_PASS))
    with patch.object(eval_runner_service, "run_agent_loop", _timing_out_loop), \
         patch.object(eval_runner_service, "_judge_eval_answer", judge):
        await eval_runner_service.run_eval_job(
            run_id=uuid4(), skill_id=SKILL_ID, skill_version=SKILL_VERSION, cases=CASES,
            provider="anthropic", model="claude-haiku-4-5-20251001",
            current_user=OWNER, user_settings=MagicMock(),
            redis=redis, supabase=supabase, pool=pool,
        )

    results = supabase.store.get("eval_results", [])
    assert len(results) == 4, f"all arms persist despite timeout, got {len(results)}"
    for r in results:
        assert r["status"] == "timed_out"
        assert isinstance(r.get("duration_ms"), int), "timed_out arm must still carry a duration_ms"
    assert judge.await_count == 0, "the judge must not run on a timed_out arm (D-04)"


@pytest.mark.asyncio
async def test_persist_null_case_id_is_sql_null(supabase):
    """D-02 / mig 085: a caseless smoke-sweep arm calls _persist_result with test_case_id=None.
    The persisted row must carry test_case_id as SQL NULL (Python None) — NEVER the string
    "None" (the mig-085 NOT NULL relaxation persists the skill-less sweep honestly; the FK
    stays enforced only when the column is non-NULL)."""
    from app.services import eval_runner_service

    await eval_runner_service._persist_result(
        supabase,
        run_id=uuid4(),
        test_case_id=None,
        user_id=OWNER["id"],
        variant="with_skill",
        provider="anthropic",
        model="claude-haiku-4-5-20251001",
        output="engine smoke ok",
        status="completed",
        error=None,
        input_tokens=1,
        output_tokens=2,
    )

    rows = supabase.store.get("eval_results", [])
    assert len(rows) == 1
    assert rows[0]["test_case_id"] is None, (
        f"caseless sweep arm must persist SQL NULL, got {rows[0]['test_case_id']!r}"
    )


# ════════════════════════════════════════════════════════════════════════════════
# Plan 04 — ROUTE / integration tests (evals.py): cross-user 404, durable readout
# after the Redis buffer expires, and reattach via the companion public.runs row.
# ════════════════════════════════════════════════════════════════════════════════
import httpx  # noqa: E402
import pytest  # noqa: E402,F811
from httpx import ASGITransport  # noqa: E402

from app.dependencies import (  # noqa: E402
    get_current_user,
    get_pg_pool,
    get_redis,
    get_supabase,
)

SKILL_VERSION_ROW = {
    "id": SKILL_VERSION_ID,
    "skill_id": SKILL_ID,
    "user_id": OWNER["id"],
    "name": SKILL_VERSION["name"],
    "description": SKILL_VERSION["description"],
    "version_number": 3,
}


# ── A filtering in-memory supabase that honors .eq() chains (route reads need real
#    owner-scoping so the 404 / durable-readout assertions are meaningful) ─────────
class _FilterTable:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self._op = "select"
        self._payload = None
        self._filters = []
        self._in_filters = []
        self._order = None
        self._desc = False
        self._limit = None
        self._single = False

    def select(self, *a, **k):
        self._op = "select"
        return self

    def insert(self, payload, *a, **k):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload, *a, **k):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self, *a, **k):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._filters.append((col, str(val)))
        return self

    def in_(self, col, values):
        # Membership filter — mirrors PostgREST/supabase-py .in_(col, [...]): a row
        # matches when its stringified column value is in the provided value set.
        self._in_filters.append((col, [str(v) for v in values]))
        return self

    def order(self, col, desc=False, **k):
        self._order = col
        self._desc = desc
        return self

    def limit(self, n, *a, **k):
        self._limit = n
        return self

    def maybe_single(self, *a, **k):
        self._single = True
        return self

    def single(self, *a, **k):
        self._single = True
        return self

    def _matched(self):
        out = []
        for r in self.store.get(self.name, []):
            if not all(str(r.get(c)) == v for c, v in self._filters):
                continue
            if not all(str(r.get(c)) in vals for c, vals in self._in_filters):
                continue
            out.append(r)
        return out

    def execute(self, *a, **k):
        if self._op == "insert":
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            self.store.setdefault(self.name, []).extend(rows)
            return _Result(rows)
        if self._op == "update":
            rows = self._matched()
            for r in rows:
                r.update(self._payload)
            return _Result(rows)
        if self._op == "delete":
            rows = self._matched()
            self.store[self.name] = [r for r in self.store.get(self.name, []) if r not in rows]
            return _Result(rows)
        # select
        out = self._matched()
        if self._order:
            out = sorted(out, key=lambda r: r.get(self._order) or 0, reverse=self._desc)
        if self._limit is not None:
            out = out[: self._limit]
        if self._single:
            return _Result(out[0] if out else None)
        return _Result(out)


class _FilterSupabase:
    def __init__(self, store=None):
        self.store = store if store is not None else {}

    def table(self, name):
        return _FilterTable(self.store, name)


def _override(app, *, user, supabase, redis_obj, pool=None):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: supabase
    app.dependency_overrides[get_redis] = lambda: redis_obj
    if pool is not None:
        app.dependency_overrides[get_pg_pool] = lambda: pool


def _clear_overrides(app):
    for dep in (get_current_user, get_supabase, get_redis, get_pg_pool):
        app.dependency_overrides.pop(dep, None)


@pytest.mark.asyncio
async def test_results_persist_after_buffer_expiry(redis, pool):
    """SC#3: after a run completes, with the ``run:{run_id}`` Redis buffer GONE/expired, GET
    /skills/{id}/evals/runs/{run_id} STILL returns the full eval_results set — the readout is
    a durable DB read, independent of the ephemeral buffer."""
    from app.main import app

    run_id = str(uuid4())
    # A completed run + its 4 persisted results, owner-stamped — already in the DB.
    store = {
        "eval_runs": [{
            "id": run_id, "skill_id": SKILL_ID, "skill_version_id": SKILL_VERSION_ID,
            "user_id": OWNER["id"], "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001", "status": "completed",
            "case_count": 2, "error": None, "created_at": "2026-06-30T00:00:00Z",
            "completed_at": "2026-06-30T00:01:00Z",
        }],
        "eval_results": [
            {"id": str(uuid4()), "eval_run_id": run_id, "test_case_id": CASES[0]["id"],
             "user_id": OWNER["id"], "variant": v, "provider": "anthropic",
             "model": "claude-haiku-4-5-20251001", "output": "x", "status": "completed",
             "error": None, "input_tokens": 1, "output_tokens": 2,
             "created_at": f"2026-06-30T00:00:0{i}Z"}
            for i, v in enumerate(["with_skill", "without_skill", "with_skill", "without_skill"])
        ],
    }
    sb = _FilterSupabase(store)

    # The Redis buffer for this run is ABSENT (TTL-expired) — nothing in redis.streams.
    assert f"run:{run_id}" not in redis.streams

    _override(app, user=OWNER, supabase=sb, redis_obj=redis, pool=pool)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/skills/{SKILL_ID}/evals/runs/{run_id}",
                headers={"Authorization": "Bearer test"},
            )
    finally:
        _clear_overrides(app)

    assert resp.status_code == 200, f"got {resp.status_code} body={resp.text}"
    body = resp.json()
    assert body["eval_run"]["status"] == "completed"
    # The durable readout is NON-EMPTY despite the buffer being gone (SC#3).
    assert len(body["eval_results"]) == 4
    assert {r["variant"] for r in body["eval_results"]} == {"with_skill", "without_skill"}


@pytest.mark.asyncio
async def test_reattach_via_runs_row(redis, pool):
    """SC#3: the companion ``public.runs`` row (same run_id) makes the eval run reattachable
    through the EXISTING ``GET /runs/{run_id}/stream`` (runs.py) — it owner-checks the runs
    row and replays the buffered ``eval_*`` events from since=0, zero new stream code."""
    from app.main import app

    run_id = str(uuid4())
    thread_id = str(uuid4())
    # The companion runs row the POST inserts (here pre-seeded to represent the live insert).
    store = {
        "runs": [{
            "run_id": run_id, "thread_id": thread_id, "user_id": OWNER["id"],
            "status": "completed", "error": None,
        }],
    }
    sb = _FilterSupabase(store)

    # Pre-fill the shared run buffer with the eval_* progress + the single closing terminal,
    # exactly as the background job would have (the events survive in the buffer until TTL).
    await redis.xadd(f"run:{run_id}", {"data": json.dumps({"type": "eval_case_started", "variant": "with_skill"})})
    await redis.xadd(f"run:{run_id}", {"data": json.dumps({"type": "eval_case_done", "variant": "with_skill", "status": "completed"})})
    await redis.xadd(f"run:{run_id}", {"data": json.dumps({"type": "eval_complete", "status": "completed"})})
    await redis.xadd(f"run:{run_id}", {"data": json.dumps({"type": "done"})})

    _override(app, user=OWNER, supabase=sb, redis_obj=redis, pool=pool)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/runs/{run_id}/stream?since=0",
                headers={"Authorization": "Bearer test"},
            )
    finally:
        _clear_overrides(app)

    assert resp.status_code == 200, f"got {resp.status_code} body={resp.text}"
    # The replayed SSE body carries the buffered eval_* vocabulary (reattach replays since=0).
    assert "eval_case_started" in resp.text
    assert "eval_complete" in resp.text


@pytest.mark.asyncio
async def test_cross_user_404(redis, pool):
    """SC#4: OTHER_USER calling POST / GET-results / GET-list against OWNER's skill or run
    gets 404 (never 403) — every eval route gates on app-code .eq(user_id) + 404-not-403."""
    from app.main import app

    run_id = str(uuid4())
    # The skill + run belong to OWNER; OTHER_USER owns nothing here.
    store = {
        "skills": [{"id": SKILL_ID, "name": "pdf-builder", "description": "d",
                    "user_id": OWNER["id"]}],
        "skill_versions": [SKILL_VERSION_ROW],
        "skill_test_cases": [{"id": CASES[0]["id"], "skill_id": SKILL_ID,
                              "user_id": OWNER["id"], "prompt": "p", "order_index": 0}],
        "eval_runs": [{"id": run_id, "skill_id": SKILL_ID, "user_id": OWNER["id"],
                       "status": "completed"}],
    }
    sb = _FilterSupabase(store)

    _override(app, user=OTHER_USER, supabase=sb, redis_obj=redis, pool=pool)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            # 1. POST kickoff — owner gate 404s before any in-flight claim / spawn.
            post = await c.post(
                f"/skills/{SKILL_ID}/evals/runs",
                json={"provider": "anthropic", "model": "claude-haiku-4-5-20251001"},
                headers={"Authorization": "Bearer test"},
            )
            # 2. GET results — eval_runs read is owner-scoped → no row → 404.
            get_results = await c.get(
                f"/skills/{SKILL_ID}/evals/runs/{run_id}",
                headers={"Authorization": "Bearer test"},
            )
            # 3. GET list — owner-verify the skill first → 404.
            get_list = await c.get(
                f"/skills/{SKILL_ID}/evals/runs",
                headers={"Authorization": "Bearer test"},
            )
    finally:
        _clear_overrides(app)

    assert post.status_code == 404, f"POST expected 404; got {post.status_code} body={post.text}"
    assert get_results.status_code == 404, f"GET results expected 404; got {get_results.status_code}"
    assert get_list.status_code == 404, f"GET list expected 404; got {get_list.status_code}"


@pytest.mark.asyncio
async def test_post_applies_provider_override_to_user_settings(redis, pool):
    """SC#4 cross-provider routing regression (found in live UAT 2026-06-30):

    The gateway dispatch inside ``run_agent_loop`` routes on
    ``user_settings.active_provider`` (+ its credentials), NOT ``ctx.resolved_provider``.
    The POST MUST therefore apply the eval's chosen provider/model as a per-run
    override onto the effective settings (mirrors threads.py:1059-1096 /
    Phase 075.3 D-075.3-08). Before the fix, a non-default provider's model was sent
    to the DEFAULT provider's SDK -> 404 ("model does not exist"). This asserts the
    job receives user_settings whose active_provider / llm_model / credentials are the
    eval's anthropic target, NOT the openai default. (The mock-provider service tests
    never exercised real routing, so this gap was invisible to them.)
    """
    from app.main import app
    from app.models.user_settings import LLMProvider, UserEffectiveSettings

    store = {
        "skills": [{"id": SKILL_ID, "name": "pdf-builder", "description": "d",
                    "user_id": OWNER["id"]}],
        "skill_versions": [SKILL_VERSION_ROW],
        "skill_test_cases": [{"id": CASES[0]["id"], "skill_id": SKILL_ID,
                              "user_id": OWNER["id"], "prompt": "p", "order_index": 0}],
    }
    sb = _FilterSupabase(store)

    # Default effective settings: active_provider=openai, BUT an anthropic provider
    # (with its own key/base_url) is available in the providers list — exactly the
    # shape override_provider needs to switch credentials.
    default_settings = UserEffectiveSettings.model_construct(
        llm_api_key="sk-openai-default",
        llm_base_url="https://api.openai.com/v1",
        llm_model="gpt-5.4-mini",
        available_models=["gpt-5.4-mini"],
        active_provider="openai",
        providers=[
            LLMProvider(id="anthropic", name="Anthropic",
                        base_url="https://api.anthropic.com/v1",
                        api_key="sk-ant-test", models=["claude-haiku-4-5-20251001"]),
        ],
    )

    # AsyncMock records call_args at CALL time (when create_task builds the coro),
    # so the captured kwargs are available even before the spawned task runs its body.
    job_mock = AsyncMock()

    _override(app, user=OWNER, supabase=sb, redis_obj=redis, pool=pool)
    with patch("app.models.user_settings.load_user_settings", return_value=default_settings), \
         patch("app.api.evals.eval_runner_service.run_eval_job", new=job_mock):
        try:
            async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                resp = await c.post(
                    f"/skills/{SKILL_ID}/evals/runs",
                    json={"provider": "anthropic", "model": "claude-haiku-4-5-20251001"},
                    headers={"Authorization": "Bearer test"},
                )
        finally:
            _clear_overrides(app)

    assert resp.status_code == 202, f"POST expected 202; got {resp.status_code} body={resp.text}"
    assert job_mock.call_args is not None, "run_eval_job was not spawned"
    us = job_mock.call_args.kwargs.get("user_settings")
    assert us is not None, "run_eval_job was not spawned with user_settings"
    # The override switched the ACTIVE provider + its credentials to anthropic (the bug fix).
    assert us.active_provider == "anthropic", f"active_provider not overridden: {us.active_provider}"
    assert us.llm_model == "claude-haiku-4-5-20251001", f"llm_model not pinned: {us.llm_model}"
    assert us.llm_api_key == "sk-ant-test", "credentials not switched to the anthropic provider"
