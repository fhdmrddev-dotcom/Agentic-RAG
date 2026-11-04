"""Phase 306-04 (MCP-04; D-04..D-07 / D-05 / D-16 / D-19 / D-29 / D-33 / D-35 / D-36) — ask_agent and
get_answer over fakes of ``outside_ask`` and ``outside_admission``.

* ``ask_agent`` call order: ask_scope -> claim (only with an idempotency key) -> resolve_ask_model ->
  acquire -> start_ask -> bind -> wait_for_ask -> read_ask. The wait deadline is the handler's
  ENTRY time plus ``mcp_ask_wait_seconds`` (D-36).
* Refusals are ``HandlerRefusal`` (sentence + audit reason): the D-29 key, a full scope (the claim is
  dropped, nothing starts), Redis unavailable (fail closed). A start that raises releases the lease
  and drops the claim, then propagates (dispatch audits ``error``).
* Idempotency (D-05): ``Existing`` reads the first run (no second start), with a note when the
  question differs; ``Starting`` answers the "already being started" sentence.
* The lease is released from the run's done-callback (``on_done``), with the same lease.
* ``get_answer``: one refusal sentence for an unknown, foreign or malformed handle (T-306-07).
* ``dispatch``: a ``HandlerRefusal`` writes ``api_key.refused`` with its reason; an answered ask's row
  carries ``run_id``; one row per call on every path.
* ``render``: the UI-SPEC §Surface 4 text, verbatim (D-07).
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import replace

import pytest

from app.mcp import ask_tools, results, tools
from app.models.user_settings import _build_settings_from_row
from app.services import outside_admission as adm
from app.services import outside_ask as oa
from app.services import rate_limit
from tests.unit import _mcp305_harness as h
from tests.unit.phase293_inbound_fakes import FakeRedis

READ3 = ("search_knowledge_base", "list_documents", "read_document")
PRINCIPAL = replace(h.PRINCIPAL, tools=READ3 + ("ask_agent", "get_answer"), label="Laptop",
                    include_external=True)
RUN = uuid.UUID("44444444-4444-4444-8444-444444444444")
THREAD = uuid.UUID("55555555-5555-4555-8555-555555555555")
DOC = "66666666-6666-4666-8666-666666666666"
CHAT = f"https://app.example/app/chat/{THREAD}"
LINK = f"https://app.example/app/library/{DOC}"


def _read(status="answered", **kw) -> oa.AskRead:
    base = {"run_id": RUN, "thread_id": THREAD, "chat_link": CHAT}
    if status == "answered":
        base.update(answer="The answer.", citations=[{"document_id": DOC, "title": "Policy", "link": LINK}],
                    confidence_level="high", disclaimer=None)
    base.update(kw)
    return oa.AskRead(status=status, **base)


class World:
    def __init__(self):
        self.calls: list[str] = []
        self.scope: object = ("f1",)
        self.claim: object = adm.Claimed()
        self.claim_raises = False
        self.acquire: object = None
        self.acquire_raises = False
        self.start_raises: Exception | None = None
        self.finished = True
        self.read: object = _read()
        self.deadline: float | None = None
        self.scope_at: float | None = None
        self.on_done = None
        self.released: list[dict] = []
        self.acquired: list[dict] = []
        self.dropped = 0
        self.bound: list[str] = []
        self.read_ids: list = []
        self.budget = 7


@pytest.fixture
def world(monkeypatch):
    w = World()

    async def ask_scope(principal):
        w.calls.append("ask_scope")
        w.scope_at = asyncio.get_running_loop().time()
        await asyncio.sleep(0.05)
        return w.scope

    async def resolve_ask_model(principal, envelope, **kw):
        w.calls.append("resolve_ask_model")
        assert kw == {}, kw
        assert envelope.startswith('<external_input source="mcp" field="question">\n')
        return oa.AskModel(settings=None, model="m", provider="openai", body=None, notice=None)

    async def start_ask(principal, **kw):
        w.calls.append("start_ask")
        if w.start_raises is not None:
            raise w.start_raises
        w.on_done = kw["on_done"]
        assert kw["scope_folder_ids"] == w.scope
        loop = asyncio.get_running_loop()
        task = loop.create_task(asyncio.sleep(0))
        await task
        return oa.StartedAsk(run_id=RUN, thread_id=THREAD, task=task)

    async def wait_for_ask(started, *, deadline):
        w.calls.append("wait_for_ask")
        w.deadline = deadline
        return w.finished

    async def read_ask(pool, *, run_id, principal):
        w.calls.append("read_ask")
        w.read_ids.append(str(run_id))
        return w.read

    async def claim(redis, **kw):
        w.calls.append("claim")
        if w.claim_raises:
            raise adm.OutsideStartUnavailable()
        return w.claim

    async def acquire(redis, **kw):
        w.calls.append("acquire")
        w.acquired.append(kw)
        if w.acquire_raises:
            raise adm.OutsideStartUnavailable()
        return w.acquire or adm.Admitted(lease_id=kw["lease_id"])

    async def release(redis, **kw):
        w.calls.append("release")
        w.released.append(kw)

    async def bind(redis, **kw):
        w.calls.append("bind")
        w.bound.append(kw["run_id"])

    async def drop(redis, **kw):
        w.calls.append("drop")
        w.dropped += 1

    async def _pool():
        return object()

    async def _settings():
        return _build_settings_from_row({"mcp_ask_wait_seconds": w.budget})

    for name, fn in (("ask_scope", ask_scope), ("resolve_ask_model", resolve_ask_model),
                     ("start_ask", start_ask), ("wait_for_ask", wait_for_ask), ("read_ask", read_ask)):
        monkeypatch.setattr(oa, name, fn)
    for name, fn in (("claim", claim), ("acquire", acquire), ("release", release),
                     ("bind", bind), ("drop", drop)):
        monkeypatch.setattr(adm, name, fn)
    monkeypatch.setattr(ask_tools, "get_redis", lambda: FakeRedis())
    monkeypatch.setattr(ask_tools, "get_pg_pool", _pool)
    monkeypatch.setattr(ask_tools, "load_app_settings_async", _settings)
    import app.config as config

    monkeypatch.setattr(config, "primary_frontend_origin", lambda: "https://app.example")
    return w


def _args(question="What is the policy?", key=None):
    return results.AskArgs(question=question, idempotency_key=key)


# ── ask_agent ─────────────────────────────────────────────────────────────────────────────────


async def test_the_call_order_and_the_deadline_from_the_call_start(world):
    before = asyncio.get_running_loop().time()
    out = await ask_tools.ask_agent(PRINCIPAL, _args(key="k-1"))
    assert world.calls == ["ask_scope", "claim", "resolve_ask_model", "acquire", "start_ask", "bind",
                           "wait_for_ask", "read_ask"]
    t0 = world.deadline - world.budget
    assert before <= t0 <= world.scope_at, "the deadline must be measured from the handler's entry"
    assert isinstance(out, results.AskResult) and out.status == "answered"
    assert out.run_id == str(RUN)
    assert world.bound == [RUN]


async def test_without_an_idempotency_key_there_is_no_claim(world):
    await ask_tools.ask_agent(PRINCIPAL, _args())
    assert "claim" not in world.calls and "bind" not in world.calls and "drop" not in world.calls


async def test_an_unfinished_ask_returns_the_handle(world):
    world.finished = False
    world.read = _read("working")
    out = await ask_tools.ask_agent(PRINCIPAL, _args())
    assert out.status == "working" and out.run_id == str(RUN)
    assert results.render(out) == (
        f"Still working on it. Call get_answer with handle {RUN} in a few seconds."
    )


async def test_the_d29_key_is_refused_before_anything(world):
    world.scope = oa.AskScopeRefusal("ask_needs_external", oa.ASK_NEEDS_EXTERNAL_SENTENCE)
    out = await ask_tools.ask_agent(PRINCIPAL, _args(key="k"))
    assert out == results.HandlerRefusal(oa.ASK_NEEDS_EXTERNAL_SENTENCE, "ask_needs_external")
    assert world.calls == ["ask_scope"]


@pytest.mark.parametrize("scope", ["credential", "org", "provider"])
async def test_a_full_scope_drops_the_claim_and_starts_nothing(world, scope):
    world.acquire = adm.Full(scope=scope, retry_s=adm.ASK_RETRY_S)
    out = await ask_tools.ask_agent(PRINCIPAL, _args(key="k"))
    assert isinstance(out, results.HandlerRefusal)
    assert out.sentence == adm.MCP_FULL_SENTENCE[scope].format(retry=15)
    assert out.reason == f"admission:{scope}"
    assert "start_ask" not in world.calls and world.dropped == 1


async def test_the_acquire_names_the_resolved_provider(world):
    await ask_tools.ask_agent(PRINCIPAL, _args())
    (kw,) = world.acquired
    assert kw["provider"] == "openai"
    assert str(kw["org_id"]) == PRINCIPAL.org_id and str(kw["credential_id"]) == PRINCIPAL.key_id
    assert kw["ttl_s"] == adm.ASK_LEASE_TTL_S and kw["retry_s"] == adm.ASK_RETRY_S


@pytest.mark.parametrize("where", ["claim", "acquire"])
async def test_redis_unavailable_refuses_the_start(world, where):
    setattr(world, f"{where}_raises", True)
    out = await ask_tools.ask_agent(PRINCIPAL, _args(key="k"))
    assert out == results.HandlerRefusal(rate_limit.UNAVAILABLE_DETAIL, adm.UNAVAILABLE_REASON)
    assert "start_ask" not in world.calls


async def test_a_start_that_raises_releases_and_drops_then_propagates(world):
    world.start_raises = RuntimeError("spawn failed")
    with pytest.raises(RuntimeError):
        await ask_tools.ask_agent(PRINCIPAL, _args(key="k"))
    assert "release" in world.calls and world.dropped == 1
    assert world.released[0]["lease_id"] == world.acquired[0]["lease_id"]


async def test_the_same_key_and_question_reads_the_first_run(world):
    world.claim = adm.Existing(run_id=str(RUN), same_request=True)
    out = await ask_tools.ask_agent(PRINCIPAL, _args(key="k"))
    assert "start_ask" not in world.calls and "acquire" not in world.calls
    assert world.read_ids == [str(RUN)]
    assert out.status == "answered" and out.note is None


async def test_the_same_key_and_a_different_question_says_so(world):
    world.claim = adm.Existing(run_id=str(RUN), same_request=False)
    out = await ask_tools.ask_agent(PRINCIPAL, _args(key="k"))
    assert "start_ask" not in world.calls
    assert out.note == ask_tools.DIFFERENT_QUESTION_SENTENCE
    assert results.render(out).startswith(ask_tools.DIFFERENT_QUESTION_SENTENCE + "\n\n")


async def test_a_claim_still_starting_answers_the_sentence(world):
    world.claim = adm.Starting()
    out = await ask_tools.ask_agent(PRINCIPAL, _args(key="k"))
    assert out == ask_tools.ALREADY_STARTING_SENTENCE
    assert "start_ask" not in world.calls


async def test_on_done_releases_the_same_lease(world):
    await ask_tools.ask_agent(PRINCIPAL, _args())
    assert world.released == []
    await world.on_done()
    assert world.released[0]["lease_id"] == world.acquired[0]["lease_id"]
    assert world.released[0]["provider"] == "openai"


async def test_a_cap_paused_ask_says_it_needs_input(world):
    world.read = _read("needs_input")
    out = await ask_tools.ask_agent(PRINCIPAL, _args())
    assert out.status == "needs_input"
    assert results.render(out) == (
        "This question needs your input in the app before it can finish. "
        f"Open it in Syrel: {CHAT}"
    )


@pytest.mark.parametrize("status,sentence", [
    ("failed", "The agent couldn't finish this question. Open it in Syrel to see what happened: {link}"),
    ("timed_out", "The agent ran out of time on this question. Open it in Syrel: {link}"),
    ("stopped", "This question was stopped in the app. Open it in Syrel: {link}"),
])
async def test_the_end_states(world, status, sentence):
    world.read = _read(status)
    out = await ask_tools.ask_agent(PRINCIPAL, _args())
    assert results.render(out) == sentence.format(link=CHAT)


# ── get_answer ────────────────────────────────────────────────────────────────────────────────


async def test_get_answer_reads_the_handle(world):
    out = await ask_tools.get_answer(PRINCIPAL, results.GetAnswerArgs(handle=str(RUN)))
    assert out.status == "answered" and world.read_ids == [str(RUN)]


async def test_an_unknown_handle_is_the_one_refusal(world):
    world.read = None
    out = await ask_tools.get_answer(PRINCIPAL, results.GetAnswerArgs(handle=str(RUN)))
    assert out == ask_tools.NO_HANDLE_SENTENCE == "No question with that handle is available to this key."


async def test_a_malformed_handle_is_the_same_refusal_and_reads_nothing(world):
    out = await ask_tools.get_answer(PRINCIPAL, results.GetAnswerArgs(handle="not-a-uuid"))
    assert out == ask_tools.NO_HANDLE_SENTENCE and world.read_ids == []


async def test_get_answer_repeats_the_needs_input_sentence(world):
    world.read = _read("needs_input")
    out = await ask_tools.get_answer(PRINCIPAL, results.GetAnswerArgs(handle=str(RUN)))
    assert "needs your input in the app" in results.render(out) and CHAT in results.render(out)


async def test_get_answer_on_an_ask_finished_in_the_app_points_at_the_chat_only(world):
    """306-REVIEW CR-01: an answer produced by an in-app Continue never crosses to the key."""
    world.read = _read("answered_in_app")
    out = await ask_tools.get_answer(PRINCIPAL, results.GetAnswerArgs(handle=str(RUN)))
    assert out.status == "answered_in_app"
    text = results.render(out)
    assert text == (
        "This question was finished in the app, so its answer stays there. "
        f"Open it in Syrel to read it: {CHAT}"
    )
    assert "The answer." not in text and DOC not in text
    dumped = out.model_dump()
    assert dumped["answer"] is None and dumped["citations"] == []


# ── render (D-07) ─────────────────────────────────────────────────────────────────────────────


def _answered(**kw) -> results.AskResult:
    base = dict(status="answered", run_id=str(RUN), answer="The answer.", citations=[
        results.AskCitation(document_id=DOC, title="Policy", link=LINK),
        results.AskCitation(document_id="77777777-7777-4777-8777-777777777777", title="Handbook",
                            link="https://app.example/app/library/77777777-7777-4777-8777-777777777777"),
    ], confidence="medium", disclaimer="Check the source.", chat_link=CHAT)
    base.update(kw)
    return results.AskResult(**base)


def test_render_an_answer_with_sources():
    assert results.render(_answered()) == "\n".join([
        "The answer.",
        "",
        "Sources (2):",
        "[1] Policy",
        f"document_id: {DOC}",
        f"Open in Syrel: {LINK}",
        "[2] Handbook",
        "document_id: 77777777-7777-4777-8777-777777777777",
        "Open in Syrel: https://app.example/app/library/77777777-7777-4777-8777-777777777777",
        "",
        "Medium confidence. Check the source.",
        f"Open this chat in Syrel: {CHAT}",
    ])


def test_render_an_answer_with_no_sources_and_no_confidence():
    text = results.render(_answered(citations=[], confidence=None, disclaimer=None))
    assert text == "\n".join(["The answer.", "", "Sources: none cited.", "", f"Open this chat in Syrel: {CHAT}"])


async def test_the_answer_and_titles_are_defanged_and_citations_deduplicated(world):
    world.read = _read(answer="See ![x](https://evil.example/p.png) now.", citations=[
        {"document_id": DOC, "title": "![t](https://evil.example/q.png)", "link": LINK},
        {"document_id": DOC, "title": "Policy", "link": LINK},
    ], confidence_level="LOW-ish")
    out = await ask_tools.ask_agent(PRINCIPAL, _args())
    assert "![" not in out.answer and "[image: x]" in out.answer
    assert len(out.citations) == 1 and "![" not in out.citations[0].title
    assert out.confidence is None  # an unknown level is never guessed at


async def test_the_confidence_words_are_the_in_app_ones(world):
    for level, word in (("high", "High"), ("medium", "Medium"), ("low", "Low")):
        world.read = _read(confidence_level=level)
        out = await ask_tools.ask_agent(PRINCIPAL, _args())
        assert f"{word} confidence." in results.render(out)


# ── dispatch: the audit row (D-19 / D-26) ─────────────────────────────────────────────────────


@pytest.fixture
def rows(monkeypatch):
    return h.stub_accounting(monkeypatch)


async def _dispatch(name, arguments):
    from app.mcp.dispatch import dispatch

    return await dispatch(PRINCIPAL, name, arguments, redis=FakeRedis())


async def test_a_handler_refusal_is_audited_refused_with_its_reason(rows, monkeypatch):
    async def refuse(principal, args):
        return results.HandlerRefusal("Too many.", "admission:credential", {"retry_s": 15})

    monkeypatch.setitem(tools.REGISTERED, "ask_agent", replace(tools.REGISTERED["ask_agent"], handler=refuse))
    out = await _dispatch("ask_agent", {"question": "q"})
    assert out.is_error is True and out.content[0].text == "Too many."
    assert len(rows) == 1
    md = rows[0]["metadata"]
    assert rows[0]["action_type"] == "api_key.refused"
    assert md["reason"] == "admission:credential" and md["tool"] == "ask_agent"
    assert md["detail"] == {"retry_s": 15}


async def test_an_answered_ask_row_carries_its_run_id(rows, monkeypatch):
    async def answer(principal, args):
        return _answered()

    monkeypatch.setitem(tools.REGISTERED, "ask_agent", replace(tools.REGISTERED["ask_agent"], handler=answer))
    out = await _dispatch("ask_agent", {"question": "q"})
    assert out.is_error is not True
    assert out.content[0].text == results.render(_answered())
    (row,) = rows
    assert row["action_type"] == "api_key.read"
    assert row["metadata"]["run_id"] == str(RUN) and row["metadata"]["outcome"] == "ok"


async def test_a_refusal_sentence_row_carries_no_run_id(rows, monkeypatch):
    async def none(principal, args):
        return ask_tools.NO_HANDLE_SENTENCE

    monkeypatch.setitem(tools.REGISTERED, "get_answer", replace(tools.REGISTERED["get_answer"], handler=none))
    out = await _dispatch("get_answer", {"handle": "x"})
    assert out.is_error is True
    (row,) = rows
    assert row["metadata"]["outcome"] == "not_available" and "run_id" not in row["metadata"]


@pytest.mark.parametrize("name,arguments,outcome", [
    ("ask_agent", {"question": "q"}, "refusal"),
    ("ask_agent", {"question": "q"}, "answer"),
    ("ask_agent", {"question": "q"}, "raise"),
    ("ask_agent", {"question": ""}, "answer"),
    ("get_answer", {"handle": "x"}, "sentence"),
    ("get_answer", {}, "sentence"),
])
async def test_exactly_one_row_per_call_on_every_path(rows, monkeypatch, name, arguments, outcome):
    async def handler(principal, args):
        if outcome == "refusal":
            return results.HandlerRefusal("No.", "ask_needs_external")
        if outcome == "raise":
            raise RuntimeError("boom")
        if outcome == "sentence":
            return ask_tools.NO_HANDLE_SENTENCE
        return _answered()

    monkeypatch.setitem(tools.REGISTERED, name, replace(tools.REGISTERED[name], handler=handler))
    try:
        await _dispatch(name, arguments)
    except RuntimeError:
        pass
    assert len(rows) == 1, rows
