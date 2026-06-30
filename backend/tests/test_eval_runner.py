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
    {"id": str(uuid4()), "prompt": "Make me a one-page PDF summary."},
    {"id": str(uuid4()), "prompt": "Turn this table into a PDF."},
]


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

    with patch.object(eval_runner_service, "run_agent_loop", _fake_run_agent_loop):
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

    with patch.object(eval_runner_service, "run_agent_loop", _fake_run_agent_loop):
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
