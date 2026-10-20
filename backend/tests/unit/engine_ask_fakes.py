"""Phase 295 (plan 295-03) — an in-memory durable world for the engine-ask pause and re-drive.

Import as ``from tests.unit.engine_ask_fakes import World`` (the ``decision_engine_fakes``
precedent). NOT a test module: nothing here is collected.

WHY IT EXISTS. Before 295 an engine-owned ask (the armed approval, the found-nothing citations
gate) blocked IN-PROCESS on ``subscribe_for_response``, so a suite could script an answer as a
return value. After D-01 / D-18 the ask is DURABLE: the run pauses, the question lives in a
prompt row, the produced output lives under ``workflow_phases.output._awaiting_answer``, and the
answer comes back on a RE-DRIVE through ``ctx.resume_answered_tool_call_id``. Re-expressing a
shipped property (SEED-137, T-185-04-01) against that shape needs the durable half modelled once
rather than four times, so every suite that re-points an armed assertion drives the same world.

Every seam is a module global ``engine_ask`` binds (``pause_run``, ``stash_awaiting_answer``,
``get_active_phase``, ``get_ask_user_response``, ``write_audit``, ``_emit``,
``resolve_kb_label``, ``permitted_folder_options``) plus ``app.utils.db.aexec`` (the prompt row)
and ``ask_user_service.subscribe_for_response`` (which an engine ask must never await).
"""
from __future__ import annotations

from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4


class FakeSupabase:
    """``supabase.table("messages").insert(row)`` hands ``aexec`` an object carrying ``row``."""

    def table(self, name):
        class _T:
            def insert(self, row):
                return SimpleNamespace(row=row, table=name)

        return _T()


class FakePool:
    """The only pool read the engine-ask path makes directly: the person's display name."""

    def __init__(self, display_name: str | None = "Fahad Murad"):
        self.display_name = display_name
        self.fetchval_calls: list[tuple] = []

    async def fetchval(self, sql, *args):
        self.fetchval_calls.append((sql, args))
        return self.display_name


class World:
    """The durable state of ONE run, shared across a pause and its re-drive.

    ``events`` is one ordered log, stamped by ``tick`` (pass a shared counter to interleave
    with a caller's own recorder). Kinds: ``pause_run``, ``stash``, ``prompt_row``, ``audit``,
    ``emit``, ``subscribe``.
    """

    def __init__(self, slug: str, *, tick=None, kb_label: str = "the knowledge base",
                 folders: list[dict] | None = None, insert_raises: bool = False):
        self.slug = slug
        self.active_output: dict | None = None
        self.answers: dict[str, dict] = {}
        self.events: list[tuple] = []
        self.kb_label = kb_label
        self.folders = list(folders or [])
        self.insert_raises = insert_raises
        self.phase_row_id = uuid4()
        self._n = 0
        self._tick = tick

    def tick(self) -> int:
        if self._tick is not None:
            return self._tick()
        self._n += 1
        return self._n

    # ── engine_ask module globals ────────────────────────────────────────────────────────
    async def pause_run(self, pool, run_id):
        self.events.append(("pause_run", self.tick()))

    async def stash_awaiting_answer(self, pool, phase_id, awaiting):
        self.active_output = {**(self.active_output or {}), "_awaiting_answer": awaiting}
        self.events.append(("stash", self.tick(), awaiting))

    async def get_active_phase(self, pool, run_id):
        return {"id": self.phase_row_id, "slug": self.slug, "status": "active",
                "output": self.active_output, "phase_index": 0}

    async def get_ask_user_response(self, pool, run_id, tool_call_id):
        return self.answers.get(str(tool_call_id))

    async def aexec(self, builder):
        if self.insert_raises:
            raise RuntimeError("prompt row insert failed (planted)")
        self.events.append(("prompt_row", self.tick(), getattr(builder, "row", None)))
        return SimpleNamespace(data=[getattr(builder, "row", None)])

    async def write_audit(self, pool, run_id, **kw):
        self.events.append(("audit", self.tick(), kw.get("event_type"), kw.get("metadata")))

    async def emit(self, redis, stream_id, event, **kw):
        self.events.append(("emit", self.tick(), event, kw))

    async def resolve_kb_label(self, conn, definition):
        return self.kb_label

    async def permitted_folder_options(self, *a, **k):
        return list(self.folders)

    async def subscribe_for_response(self, *a, **k):
        self.events.append(("subscribe", self.tick()))
        return None

    # ── reads over the log ───────────────────────────────────────────────────────────────
    def prompt_rows(self) -> list[tuple[int, dict]]:
        return [(e[1], e[2]) for e in self.events if e[0] == "prompt_row"]

    def prompt_tool_calls(self) -> list[dict]:
        return [row["tool_calls"][0] for _o, row in self.prompt_rows()]

    def latest_tool_call(self) -> dict:
        tcs = self.prompt_tool_calls()
        assert tcs, "no durable prompt row was written"
        return tcs[-1]

    def audits(self, event_type: str | None = None) -> list[dict]:
        return [
            {"event_type": e[2], "metadata": e[3]} for e in self.events
            if e[0] == "audit" and (event_type is None or e[2] == event_type)
        ]

    def emits(self, event: str) -> list[dict]:
        return [e[3] for e in self.events if e[0] == "emit" and e[2] == event]

    def count(self, kind: str) -> int:
        return sum(1 for e in self.events if e[0] == kind)

    # ── the person answers (what POST /ask_user_response persists) ───────────────────────
    def answer(self, response_text: str = "", choice_index=None, folder_id=None,
               tool_call_id: str | None = None) -> str:
        tcid = tool_call_id or self.latest_tool_call()["tool_call_id"]
        self.answers[str(tcid)] = {
            "response_text": response_text, "choice_index": choice_index, "folder_id": folder_id,
        }
        return tcid

    # ── wiring ───────────────────────────────────────────────────────────────────────────
    def ctx(self, **over):
        base = dict(
            supabase=FakeSupabase(),
            thread_id=str(uuid4()),
            current_user={"id": str(uuid4()), "email": "owner@example.com"},
            producer_run_id=uuid4(),
            emit=self.emit,
            retry_feedback=None,
            is_golden_run=False,
            definition=None,
            folder_subtree_ids=None,
            inputs={},
            resume_answered_tool_call_id=None,
        )
        base.update(over)
        return SimpleNamespace(**base)

    def patches(self, *, emit: bool = True, audit: bool = True, subscribe: bool = True):
        """The engine_ask seams. ``emit`` / ``audit`` / ``subscribe`` may be left to a caller's
        own recorder (pass False and patch them yourself)."""
        from app.services.harness import engine_ask

        out = [
            patch.object(engine_ask, "pause_run", self.pause_run),
            patch.object(engine_ask, "stash_awaiting_answer", self.stash_awaiting_answer),
            patch.object(engine_ask, "get_active_phase", self.get_active_phase),
            patch.object(engine_ask, "get_ask_user_response", self.get_ask_user_response),
            patch.object(engine_ask, "resolve_kb_label", self.resolve_kb_label),
            patch.object(engine_ask, "permitted_folder_options", self.permitted_folder_options),
            patch("app.utils.db.aexec", self.aexec),
        ]
        if emit:
            out.append(patch.object(engine_ask, "_emit", self.emit))
        if audit:
            out.append(patch.object(engine_ask, "write_audit", self.write_audit))
        if subscribe:
            out.append(
                patch("app.services.ask_user_service.subscribe_for_response",
                      self.subscribe_for_response)
            )
        return out

    def enter(self, stack: ExitStack, **kw) -> None:
        for p in self.patches(**kw):
            stack.enter_context(p)
