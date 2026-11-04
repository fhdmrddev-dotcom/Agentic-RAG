"""Phase 306-03 (D-01 / D-08 / D-26 / D-29 / D-30 / D-33 / D-36 / D-37) — the non-HTTP ask start.

``outside_ask`` is a thin start service: every step names a shared helper (model resolution, the
runs row, the producer, the title) and re-implements none. Fakes stand in for I/O only.

  · ask_scope    — the key's composed folders, or every folder the member sees in the key's org;
                   refused for a key that leaves out connected-app documents, and for an empty scope.
  · resolve_ask_model — load_user_settings -> apply_user_model_default -> resolve_run_model, in
                   order; ``model`` / ``provider`` are keyword-only overrides no MCP input reaches.
  · start_ask    — one thread (origin stamped at INSERT), one user message (the envelope), the runs
                   row in the key's org, the producer in a FRESH context carrying the allow-list and
                   the acting org, registered in RUN_TASKS; the title in the background.
  · wait_for_ask — ``asyncio.wait`` against an absolute deadline; the run is never cancelled.
  · read_ask     — one access statement, the cap-pause predicate BEFORE any status branch.
"""
from __future__ import annotations

import asyncio
import inspect
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.security.mcp_principal import McpPrincipal
from app.services import outside_ask as oa
from app.services import usage_sink
from app.services.outside_run_scope import ASK_TOOL_ALLOWLIST, current_allowlist

MODULE = Path(oa.__file__)
ORG = str(uuid.uuid4())
USER = str(uuid.uuid4())
KEY = str(uuid.uuid4())
F1, F2, F3 = (str(uuid.uuid4()) for _ in range(3))
FOLDERS = [
    {"id": F1, "parent_id": None, "name": "Policies"},
    {"id": F2, "parent_id": F1, "name": "HR"},
    {"id": F3, "parent_id": None, "name": "Finance"},
]


def _principal(*, folder_ids=None, include_external=True) -> McpPrincipal:
    return McpPrincipal(
        key_id=KEY, user_id=USER, org_id=ORG, folder_ids=folder_ids,
        tools=("search_documents", "ask_agent", "get_answer"), include_external=include_external,
        label="Claude Desktop",
    )


# ── ask_scope ─────────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def acting(monkeypatch):
    seen: dict = {}

    @asynccontextmanager
    async def _conn(*, user_id, org_id):
        seen["acting"] = (user_id, org_id)
        yield "conn"

    reads = AsyncMock(return_value=list(FOLDERS))
    monkeypatch.setattr(oa, "acting_member_connection", _conn)
    monkeypatch.setattr(oa, "list_acting_folders", reads)
    return SimpleNamespace(seen=seen, reads=reads)


@pytest.mark.asyncio
async def test_a_key_without_connected_app_documents_is_refused_before_any_read(acting):
    out = await oa.ask_scope(_principal(include_external=False))
    assert isinstance(out, oa.AskScopeRefusal)
    assert out.reason == "ask_needs_external"
    assert out.sentence == oa.ASK_NEEDS_EXTERNAL_SENTENCE
    assert "Include mail and synced sources" in out.sentence
    acting.reads.assert_not_awaited()


@pytest.mark.asyncio
async def test_an_all_folders_key_scopes_to_every_visible_folder(acting):
    out = await oa.ask_scope(_principal())
    assert set(out) == {F1, F2, F3}
    assert acting.seen["acting"] == (USER, ORG)
    acting.reads.assert_awaited_once_with("conn")


@pytest.mark.asyncio
async def test_a_narrowed_key_scopes_to_its_visible_subtrees(acting):
    out = await oa.ask_scope(_principal(folder_ids=(F1, str(uuid.uuid4()))))
    assert set(out) == {F1, F2}


@pytest.mark.asyncio
@pytest.mark.parametrize("folders,key", [([], None), (list(FOLDERS), (str(uuid.uuid4()),))])
async def test_an_empty_scope_is_refused(acting, folders, key):
    acting.reads.return_value = folders
    out = await oa.ask_scope(_principal(folder_ids=key))
    assert isinstance(out, oa.AskScopeRefusal)
    assert out.reason == "ask_no_folders"
    assert out.sentence == "This key can't see any folders, so there is nothing to ask about."


# ── resolve_ask_model ─────────────────────────────────────────────────────────────────────────


def test_the_overrides_are_keyword_only_and_default_none():
    params = inspect.signature(oa.resolve_ask_model).parameters
    for name in ("model", "provider"):
        assert params[name].kind is inspect.Parameter.KEYWORD_ONLY
        assert params[name].default is None


@pytest.fixture
def model_chain(monkeypatch):
    order: list[str] = []
    base = SimpleNamespace(llm_model="gpt-4o", active_provider="openai")

    def _load(user_id):
        order.append(f"load:{user_id}")
        return base

    async def _default(request, current_user, settings):
        order.append(f"default:{current_user['id']}")
        assert settings is base
        return settings

    async def _resolve(*, body, user_settings):
        order.append(f"resolve:{body.model}:{body.provider}")
        return "gpt-4o", "openai", None, body, user_settings

    monkeypatch.setattr(oa, "load_user_settings", _load)
    monkeypatch.setattr(oa, "apply_user_model_default", _default)
    monkeypatch.setattr(oa, "resolve_run_model", _resolve)
    monkeypatch.setattr(oa, "override_provider", lambda s, p: SimpleNamespace(llm_model=s.llm_model, active_provider=p))
    return order


@pytest.mark.asyncio
async def test_the_member_effective_model_is_resolved_in_order(model_chain):
    out = await oa.resolve_ask_model(_principal(), "ENVELOPE")
    assert model_chain == [f"load:{USER}", f"default:{USER}", "resolve:None:None"]
    assert (out.model, out.provider) == ("gpt-4o", "openai")
    assert out.body.content == "ENVELOPE"
    assert out.body.agent_mode == "default"


@pytest.mark.asyncio
async def test_an_override_sets_the_body_before_resolution(model_chain):
    out = await oa.resolve_ask_model(_principal(), "ENVELOPE", model="claude-sonnet-5", provider="anthropic")
    assert model_chain[-1] == "resolve:claude-sonnet-5:anthropic"
    assert out.settings.active_provider == "anthropic"


# ── start_ask ─────────────────────────────────────────────────────────────────────────────────


class _Table:
    def __init__(self, name, log, ids):
        self.name, self.log, self.ids = name, log, ids
        self._row = None

    def insert(self, row):
        self._row = row
        return self

    def execute(self):
        self.log.append((self.name, self._row))
        return SimpleNamespace(data=[{"id": self.ids[self.name], **self._row}])


class _Supabase:
    def __init__(self, ids):
        self.log: list = []
        self.ids = ids

    def table(self, name):
        return _Table(name, self.log, self.ids)


@pytest.fixture
def start_world(monkeypatch):
    tid, mid = str(uuid.uuid4()), str(uuid.uuid4())
    sb = _Supabase({"threads": tid, "messages": mid})
    w = SimpleNamespace(thread_id=tid, sb=sb, producer_calls=[], title_calls=[], registered=[], finalized=[])
    monkeypatch.setattr(oa, "get_service_role_supabase", lambda org_id: (w.__setattr__("sb_org", org_id), sb)[1])
    monkeypatch.setattr(oa, "get_pg_pool", AsyncMock(return_value="pool"))

    async def _register(**kw):
        w.registered.append(kw)

    async def _finalize(**kw):
        w.finalized.append(kw)

    monkeypatch.setattr(oa, "register_run_start", _register)
    monkeypatch.setattr(oa, "finalize_run_terminal", _finalize)

    w.release = asyncio.Event()

    async def _producer(run_id, **kw):
        from app.security.acting_org import current_acting_org

        w.producer_calls.append({
            "run_id": run_id, **kw,
            "allow": current_allowlist(), "acting_org": current_acting_org(),
            "usage_sink": usage_sink._sink.get(),
        })
        await w.release.wait()

    monkeypatch.setattr("app.services.run_producer.run_producer", _producer)

    async def _title(**kw):
        w.title_calls.append(kw)
        await asyncio.sleep(10)  # a slow title must never delay start_ask's return

    monkeypatch.setattr(oa, "maybe_autotitle_thread", _title)
    return w


def _ask_model():
    from app.models.message import MessageCreate

    body = MessageCreate(content="ENV", agent_mode="default", model="gpt-4o")
    return oa.AskModel(settings=SimpleNamespace(llm_model="gpt-4o"), model="gpt-4o", provider="openai", body=body, notice=None)


async def _start(world, **kw):
    return await oa.start_ask(
        _principal(), question="What is the policy?", envelope="ENV",
        scope_folder_ids=(F1, F2), ask_model=_ask_model(), redis="redis", **kw,
    )


@pytest.mark.asyncio
async def test_start_ask_inserts_one_thread_and_one_message_with_the_origin(start_world):
    started = await asyncio.wait_for(_start(start_world), timeout=2)
    threads = [r for t, r in start_world.sb.log if t == "threads"]
    messages = [r for t, r in start_world.sb.log if t == "messages"]
    assert threads == [{
        "user_id": USER, "org_id": ORG, "title": "New Chat",
        "origin_kind": "mcp", "origin_label": "Claude Desktop", "origin_ref": KEY,
    }]
    assert len(messages) == 1
    assert messages[0]["content"] == "ENV" and messages[0]["role"] == "user"
    assert messages[0]["thread_id"] == start_world.thread_id and messages[0]["org_id"] == ORG
    assert start_world.sb_org == ORG
    assert str(started.thread_id) == start_world.thread_id
    start_world.release.set()
    await started.task


@pytest.mark.asyncio
async def test_start_ask_registers_the_run_in_the_key_org(start_world):
    started = await _start(start_world)
    (reg,) = start_world.registered
    assert reg["org_id"] == ORG
    assert reg["run_id"] == started.run_id
    assert str(reg["user_id"]) == USER
    assert (reg["model"], reg["provider"]) == ("gpt-4o", "openai")
    assert reg["expert_id"] is None
    start_world.release.set()
    await started.task


@pytest.mark.asyncio
async def test_the_producer_runs_in_a_fresh_context_with_the_allowlist_and_the_acting_org(start_world):
    from app.services.run_producer import ThreadScoping
    from app.services.run_transport import RUN_TASKS

    with usage_sink.collecting() as collector:
        started = await _start(start_world)
        await asyncio.sleep(0)
        await asyncio.sleep(0)
    (call,) = start_world.producer_calls
    assert call["allow"] == ASK_TOOL_ALLOWLIST
    assert call["acting_org"] == ORG
    assert call["usage_sink"] is None  # the MCP request's collector does not ride along
    assert collector == []
    assert call["scoping"] == ThreadScoping([F1, F2], None, None, None, None)
    assert call["active_workflow_run_id"] is None
    assert call["kickoff_definition"] is None and call["kickoff_definition_id"] is None
    assert call["current_user"] == {"id": USER, "org_id": ORG}
    assert call["resolved_model"] == "gpt-4o" and call["resolved_provider"] == "openai"
    assert RUN_TASKS[started.run_id] is started.task
    assert current_allowlist() is None  # the caller stays an in-app context
    start_world.release.set()
    await started.task
    await asyncio.sleep(0)
    assert started.run_id not in RUN_TASKS


@pytest.mark.asyncio
async def test_on_done_is_awaited_once(start_world):
    done = AsyncMock()
    started = await _start(start_world, on_done=done)
    start_world.release.set()
    await started.task
    for _ in range(5):
        await asyncio.sleep(0)
    done.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_spawn_failure_finalizes_the_run_failed_and_reraises(start_world, monkeypatch):
    async def _boom(**_kw):
        raise RuntimeError("redis down")

    monkeypatch.setattr(oa, "register_run_start", _boom)
    with pytest.raises(RuntimeError):
        await _start(start_world)
    (fin,) = start_world.finalized
    assert fin["status"] == "failed" and fin["error"] == "spawn_failed"
    assert start_world.producer_calls == []


@pytest.mark.asyncio
async def test_the_title_uses_the_raw_question_in_the_background(start_world):
    started = await asyncio.wait_for(_start(start_world), timeout=2)  # the slow title did not block
    await asyncio.sleep(0)
    (title,) = start_world.title_calls
    assert title["first_message"] == "What is the policy?"
    assert title["title_fn"] is oa.generate_thread_title
    start_world.release.set()
    await started.task


# ── wait_for_ask ──────────────────────────────────────────────────────────────────────────────


def _started(task):
    return oa.StartedAsk(run_id=uuid.uuid4(), thread_id=uuid.uuid4(), task=task)


@pytest.mark.asyncio
async def test_wait_returns_true_when_the_run_finishes_in_time():
    loop = asyncio.get_running_loop()
    task = asyncio.create_task(asyncio.sleep(0.01))
    assert await oa.wait_for_ask(_started(task), deadline=loop.time() + 2) is True


@pytest.mark.asyncio
async def test_wait_returns_false_past_the_deadline_and_never_cancels():
    loop = asyncio.get_running_loop()
    task = asyncio.create_task(asyncio.sleep(0.2, result="finished"))
    assert await oa.wait_for_ask(_started(task), deadline=loop.time() + 0.02) is False
    assert not task.cancelled()
    assert await task == "finished"


@pytest.mark.asyncio
async def test_a_passed_deadline_returns_false_at_once():
    loop = asyncio.get_running_loop()
    task = asyncio.create_task(asyncio.sleep(0.2))
    t0 = loop.time()
    assert await oa.wait_for_ask(_started(task), deadline=t0 - 5) is False
    assert loop.time() - t0 < 0.1
    task.cancel()


# ── read_ask ──────────────────────────────────────────────────────────────────────────────────


class _Pool:
    def __init__(self, run_row, message_row=None):
        self.run_row, self.message_row = run_row, message_row
        self.calls: list = []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM public.runs r" in sql:
            return self.run_row
        if "FROM public.messages" in sql:
            return self.message_row
        raise AssertionError(sql)


def _run_row(status, continues_used=0):
    return {
        "run_id": uuid.uuid4(), "status": status, "message_id": uuid.uuid4(), "thread_id": uuid.uuid4(),
        "continues_used": continues_used,
    }


@pytest.fixture
def paused(monkeypatch):
    flag = SimpleNamespace(value=False, calls=[])

    async def _paused(conn, run_id, *, org_id=None):
        flag.calls.append((run_id, org_id))
        return flag.value

    monkeypatch.setattr(oa, "run_is_cap_paused", _paused)
    monkeypatch.setattr(oa, "primary_frontend_origin", lambda: "https://app.example.com")
    return flag


@pytest.mark.asyncio
async def test_no_row_is_none(paused):
    pool = _Pool(None)
    assert await oa.read_ask(pool, run_id=uuid.uuid4(), principal=_principal()) is None
    sql, args = pool.calls[0]
    for clause in ("r.user_id = $2", "t.origin_kind = 'mcp'", "t.origin_ref = $3", "t.org_id = $4", "r.parent_run_id IS NULL",
                   "continues_used"):
        assert clause in sql
    assert [str(a) for a in args[1:]] == [USER, KEY, ORG]


@pytest.mark.asyncio
@pytest.mark.parametrize("status,expected", [
    ("streaming", "working"), ("failed", "failed"), ("timed_out", "timed_out"), ("cancelled", "stopped"),
])
async def test_the_status_words(paused, status, expected):
    row = _run_row(status)
    out = await oa.read_ask(_Pool(row), run_id=row["run_id"], principal=_principal())
    assert out.status == expected
    assert out.chat_link == f"https://app.example.com/app/chat/{row['thread_id']}"
    assert out.answer is None


@pytest.mark.asyncio
async def test_a_cap_paused_run_reads_needs_input_even_when_completed(paused):
    paused.value = True
    row = _run_row("completed")
    pool = _Pool(row, {"content": "partial"})
    out = await oa.read_ask(pool, run_id=row["run_id"], principal=_principal())
    assert out.status == "needs_input"
    assert out.answer is None
    assert paused.calls == [(row["run_id"], uuid.UUID(ORG))]
    assert not [c for c in pool.calls if "FROM public.messages" in c[0]]


@pytest.mark.asyncio
async def test_a_completed_run_reads_the_answer_with_citations_by_document(paused, monkeypatch):
    monkeypatch.setattr("app.mcp.results.doc_link", lambda d: f"https://app.example.com/app/library/{d}")
    d1, d2 = str(uuid.uuid4()), str(uuid.uuid4())
    row = _run_row("completed")
    msg = {
        "content": "Fridays are remote.",
        "source_refs": [
            {"document_id": d1, "filename": "Policy.pdf", "chunk_index": 1},
            {"document_id": d1, "filename": "Policy.pdf", "chunk_index": 4},
            {"document_id": d2, "filename": "HR.docx", "chunk_index": 0},
        ],
        "confidence_level": "high",
        "confidence_avg_similarity": 0.82,
        "confidence_disclaimer": None,
    }
    out = await oa.read_ask(_Pool(row, msg), run_id=row["run_id"], principal=_principal())
    assert out.status == "answered"
    assert out.answer == "Fridays are remote."
    assert out.citations == [
        {"document_id": d1, "title": "Policy.pdf", "link": f"https://app.example.com/app/library/{d1}"},
        {"document_id": d2, "title": "HR.docx", "link": f"https://app.example.com/app/library/{d2}"},
    ]
    assert out.confidence_level == "high"
    assert out.disclaimer is None


# ── read_ask: a run finished by an in-app Continue (306-REVIEW CR-01; D-10 / D-30 / D-33) ─────────
#
# A Continue keeps the same run_id and re-resolves scope WITHOUT the key's folder wall, so the
# answer it produced may draw on folders the key cannot read. The key gets the chat link only.


def _secret_message():
    return {
        "content": "Secret from outside the folder.",
        "source_refs": [{"document_id": str(uuid.uuid4()), "filename": "Outside.pdf", "chunk_index": 0}],
        "confidence_level": "high",
        "confidence_avg_similarity": 0.9,
        "confidence_disclaimer": None,
    }


@pytest.mark.asyncio
async def test_a_continued_run_reads_answered_in_app_and_never_reads_the_message(paused):
    row = _run_row("completed", continues_used=1)
    pool = _Pool(row, _secret_message())
    out = await oa.read_ask(pool, run_id=row["run_id"], principal=_principal())
    assert out.status == "answered_in_app"
    assert out.answer is None
    assert out.citations == []
    assert out.confidence_level is None and out.disclaimer is None
    assert out.chat_link == f"https://app.example.com/app/chat/{row['thread_id']}"
    assert not [c for c in pool.calls if "FROM public.messages" in c[0]]


@pytest.mark.asyncio
async def test_an_uncontinued_run_still_reads_its_answer_and_citations(paused, monkeypatch):
    monkeypatch.setattr("app.mcp.results.doc_link", lambda d: f"https://app.example.com/app/library/{d}")
    row = _run_row("completed", continues_used=0)
    msg = _secret_message()
    out = await oa.read_ask(_Pool(row, msg), run_id=row["run_id"], principal=_principal())
    assert out.status == "answered"
    assert out.answer == "Secret from outside the folder."
    assert [c["document_id"] for c in out.citations] == [msg["source_refs"][0]["document_id"]]


@pytest.mark.asyncio
async def test_a_continued_run_that_cap_paused_again_reads_needs_input(paused):
    paused.value = True
    row = _run_row("completed", continues_used=1)
    pool = _Pool(row, _secret_message())
    out = await oa.read_ask(pool, run_id=row["run_id"], principal=_principal())
    assert out.status == "needs_input"
    assert not [c for c in pool.calls if "FROM public.messages" in c[0]]


# ── static ────────────────────────────────────────────────────────────────────────────────────


def test_the_module_never_cancels_and_never_copies_the_request_context():
    src = MODULE.read_text(encoding="utf-8")
    assert "wait_for(" not in src
    assert "copy_context" not in src
    assert src.count("context=outside_run_context(ASK_TOOL_ALLOWLIST)") == 1
    for word in ("httpx", "fastapi"):
        assert word not in src
