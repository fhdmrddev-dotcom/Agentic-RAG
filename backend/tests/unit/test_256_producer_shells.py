"""Phase 256 / METER-05 (D-256-08) — the FOUR remaining producer shells.

Four ``finally:`` blocks mint a per-segment ``runs`` row, drive a real workflow, and
then terminalize that row with the LITERAL ``input_tokens=None, output_tokens=None``.
The segment's spend was measured the whole time — it sits on ``ctx.run_usage_box``,
which ``harness_engine.run_workflow`` sets once per run — and every one of these four
shells threw it away.

  | # | Site                                            | Writer                 |
  |---|-------------------------------------------------|------------------------|
  | 1 | ``api/runs.py`` ``_redrive_paused_workflow_run``  | ``finalize_run``       |
  | 2 | ``api/runs.py`` ``continue_run``                  | ``finalize_run``       |
  | 4 | ``publish_service._drive_golden_run``             | ``finalize_run``       |
  | 5 | ``scheduler_service._drive_run``                  | ⚠ ``finalize_run_terminal`` |

Site 3 (``harness_engine``'s boot-sweep resume) was closed by plan 256-01 and is pinned
by ``test_256_producer_shell_site3.py``; site 6 (the eval path) has a DIFFERENT shape and
is pinned by ``test_256_eval_usage_rollup.py``; site 7 (``run_reconciler``) is REGISTERED
rather than fixed — the process is gone, so a stranded run's count is genuinely unknowable
in memory (SEED-299).

⚠ THE REQUIREMENT'S OWN COUNT IS WRONG AND IS CORRECTED RATHER THAN INHERITED.
METER-05 names TWO finalize sites and ``256-PREFLIGHT.md`` §4 repeats "two";
``grep -rn "input_tokens=None" backend/app`` returns **seven** argument sites plus one
default parameter (D-256-08).

THE PROPERTIES, and two of them pull in opposite directions on purpose:

  1. A measured segment is WRITTEN — the values the box actually holds, not a
     re-derivation and not ``None``.
  2. An UNMEASURED segment stays ``None``/``None``. ⛔ **Never ``0``/``0``**: ``NULL``
     means *never measured* and ``0`` means *measured as zero*, and collapsing them makes
     an uninstrumented run indistinguishable from a free one (D-256-06). This is the case
     ``openai_compat.py`` makes COMMON rather than theoretical — six of eight providers
     only emit usage when a payload was seen.
  3. In that unmeasured case the missing-usage warning fires **BEFORE** the finalize
     call — the contract written verbatim into ``db/runs.py:93-99``, which all four sites
     currently violate. ⛔ ORDER is asserted, not merely co-occurrence.
  4. T-256-14 / T-073-04: the warning carries run/provider/model IDENTIFIERS ONLY. One
     shared literal across every site, so a log search finds them all at once and so the
     negative pin below cannot be made vacuous by a variant wording.
  5. Site 5 keeps ``finalize_run_terminal``. ⛔ A swap to the DB-only ``finalize_run``
     would leave the run in ``runs:active`` forever — a GHOST with a live Kill button
     (``scheduler_service.py:282-286``). A correctness regression disguised as a tidy-up.

⚠ GRAIN (D-256-03): the box holds the SEGMENT's spend and each shell is a per-segment
``runs`` row, so segment-onto-segment is correct here. The cumulative ``workflow_runs``
total is written by ``persist_run_usage`` at the phase boundary and is a DIFFERENT grain
— never sum the two tables, and no shell may start writing the workflow grain.

METHOD: every drive below runs the REAL shipped function. Only its collaborators are
replaced, and the mocked ``run_workflow`` / ``_resume_run`` SETS the box exactly as the
real one does (``harness_engine.py:1864``), so the code under test is the shell's own
``finally`` block and nothing else.
"""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


_WARNING_FORMAT = "runs.usage missing for run=%s provider=%s model=%s"

#: The three files this plan repairs. Site 3 lives in ``harness_engine`` (plan 256-01).
_SUBJECT_FILES = (
    "app/api/runs.py",
    "app/services/harness/publish_service.py",
    "app/services/scheduler_service.py",
)


# ===========================================================================
# Shared recording harness
# ===========================================================================


class _Seq:
    """Records the ORDER of the two events this file cares about.

    A warning that fires AFTER the write is useless to the operator reading the
    column, so co-occurrence is not the property — sequence is.
    """

    def __init__(self) -> None:
        self.events: list[str] = []
        self.warn_calls: list[tuple] = []

    def warning(self, *args, **kwargs):  # stands in for logger.warning
        msg = args[0] if args else ""
        if isinstance(msg, str) and msg.startswith("runs.usage missing"):
            self.events.append("warning")
            self.warn_calls.append(args)

    def finalize(self):
        """Return an AsyncMock that records its position in the sequence."""
        seq = self

        async def _side_effect(*args, **kwargs):
            seq.events.append("finalize")

        return AsyncMock(side_effect=_side_effect)


class _Resp:
    def __init__(self, data):
        self.data = data
        self.count = None


class _Query:
    """Chainable supabase-py query stand-in. ``aexec`` calls ``.execute()``."""

    def __init__(self, table: str, rows: dict, updates: list):
        self._table = table
        self._rows = rows
        self._updates = updates
        self._payload = None

    def select(self, *a, **k):
        return self

    def insert(self, payload, *a, **k):
        self._payload = payload
        return self

    def update(self, payload, *a, **k):
        self._updates.append((self._table, payload))
        self._payload = payload
        return self

    def eq(self, *a, **k):
        return self

    def maybe_single(self, *a, **k):
        return self

    def single(self, *a, **k):
        return self

    def execute(self):
        if self._payload is not None and self._table == "threads":
            return _Resp([{"id": str(uuid.uuid4())}])
        return _Resp(self._rows.get(self._table))


class _Supabase:
    def __init__(self, rows: dict):
        self.rows = rows
        self.updates: list = []

    def table(self, name: str) -> _Query:
        return _Query(name, self.rows, self.updates)


def _box_setter(box):
    """A ``run_workflow`` / ``_resume_run`` stand-in that sets the box like the real one.

    ``harness_engine.run_workflow`` assigns ``ctx.run_usage_box = {}`` once per run
    (``harness_engine.py:1864``) and the executors fill it. ``box=None`` models the ctx
    that never reached the assignment at all.
    """

    async def _run(*args, **kwargs):
        ctx = None
        for cand in args:
            if hasattr(cand, "producer_run_id") or hasattr(cand, "run_id"):
                ctx = cand
        if ctx is not None and box is not None:
            try:
                ctx.run_usage_box = box
            except (AttributeError, TypeError):
                pass

    return _run


# ===========================================================================
# Site 1 — api/runs.py :: _redrive_paused_workflow_run (the ask_user re-drive)
# ===========================================================================


async def _drive_site1(box):
    from app.api import runs as runs_mod

    seq = _Seq()
    finalize = seq.finalize()
    pid = uuid.uuid4()
    run_id = uuid.uuid4()

    ctx = SimpleNamespace(producer_run_id=pid, provider="openai", model="gpt-5.5")
    if box is not None:
        # The ctx as it exists BEFORE the drive: no box yet. _resume_run sets it.
        pass

    pool = MagicMock()
    pool.fetchrow = AsyncMock(
        return_value={
            "run_id": run_id,
            "thread_id": uuid.uuid4(),
            "current_phase_id": None,
            "inputs": {},
            "org_id": None,
            "is_golden_run": False,
            "user_id": str(uuid.uuid4()),
        }
    )

    tasks: dict = {}

    with (
        patch("app.dependencies.get_pg_pool", AsyncMock(return_value=pool)),
        patch("app.db.workflows.claim_run", AsyncMock(return_value=True)),
        patch("app.db.workflows.resume_run", AsyncMock(return_value=None)),
        patch(
            "app.services.harness_engine._load_run_definition",
            AsyncMock(return_value=object()),
        ),
        patch(
            "app.services.harness_engine._build_resume_context",
            AsyncMock(return_value=ctx),
        ),
        patch(
            "app.services.harness_engine._resume_run",
            AsyncMock(side_effect=_box_setter(box)),
        ),
        patch("app.db.runs.finalize_run", finalize),
        patch.object(runs_mod, "RUN_TASKS", tasks),
        patch.object(runs_mod.logger, "warning", seq.warning),
    ):
        spawned = await runs_mod._redrive_paused_workflow_run(run_id, "tcid-1", MagicMock())
        assert spawned is True, "the re-drive must have been spawned for this drive to mean anything"
        # The shell runs in a background task — await it before reading the writer.
        for _ in range(50):
            live = [t for t in tasks.values() if not t.done()]
            if not live:
                break
            await asyncio.gather(*live, return_exceptions=True)
        await asyncio.sleep(0)

    assert finalize.await_count == 1, (
        f"site 1's shell must finalize exactly once; got {finalize.await_count}"
    )
    return finalize.await_args.kwargs, seq


# ===========================================================================
# Site 2 — api/runs.py :: continue_run (the harness continuation)
# ===========================================================================


async def _drive_site2(box):
    from app.api import runs as runs_mod
    from app.api import threads as threads_mod

    seq = _Seq()
    finalize = seq.finalize()
    run_id = uuid.uuid4()
    thread_id = str(uuid.uuid4())
    wf_run_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    supabase = _Supabase(
        {
            "runs": {
                "run_id": str(run_id),
                "status": "cap_paused",
                "thread_id": thread_id,
                "continues_used": 0,
                "org_id": None,
            },
            "threads": {"active_workflow_run_id": wf_run_id},
            "workflow_runs": {
                "id": wf_run_id,
                "continues_used": 0,
                "definition_id": str(uuid.uuid4()),
                "inputs": {},
            },
        }
    )

    definition = SimpleNamespace(project_folder_id=None, phases=[], name="wf")
    tasks: dict = {}

    with (
        patch("app.dependencies.get_pg_pool", AsyncMock(return_value=MagicMock())),
        patch(
            "app.services.harness_engine._load_run_definition",
            AsyncMock(return_value=definition),
        ),
        patch("app.db.workflows.get_active_phase", AsyncMock(return_value=None)),
        patch("app.db.runs.insert_run", AsyncMock(return_value=None)),
        patch("app.db.runs.finalize_run", finalize),
        patch("app.models.user_settings.load_user_settings", MagicMock(return_value=None)),
        patch(
            "app.services.sub_agent_models.resolve_workflow_ctx_model",
            MagicMock(return_value="gpt-5.5"),
        ),
        patch(
            "app.services.harness.scope.resolve_run_scope_root",
            AsyncMock(return_value=None),
        ),
        patch(
            "app.services.harness_engine.run_workflow",
            AsyncMock(side_effect=_box_setter(box)),
        ),
        patch.object(threads_mod, "RUN_TASKS", tasks),
        patch.object(runs_mod.logger, "warning", seq.warning),
    ):
        await runs_mod.continue_run(
            run_id=run_id,
            current_user={"id": user_id},
            supabase=supabase,
            service_supabase=supabase,
            redis=MagicMock(),
        )
        for _ in range(50):
            live = [t for t in tasks.values() if not t.done()]
            if not live:
                break
            await asyncio.gather(*live, return_exceptions=True)
        await asyncio.sleep(0)

    assert finalize.await_count == 1, (
        f"site 2's shell must finalize exactly once; got {finalize.await_count}"
    )
    return finalize.await_args.kwargs, seq


# ===========================================================================
# Site 4 — publish_service :: _drive_golden_run (a golden run is real money)
# ===========================================================================


async def _drive_site4(box):
    from app.services.harness import publish_service as ps

    seq = _Seq()
    finalize = seq.finalize()
    supabase = _Supabase({"threads": None})
    definition = SimpleNamespace(
        name="wf", project_folder_id=None, inputs=[], phases=[],
    )

    with (
        patch.object(
            ps, "_resolve_publish_supabase", AsyncMock(return_value=(supabase, None)),
        ),
        patch("app.models.user_settings.load_user_settings", MagicMock(return_value=None)),
        patch(
            "app.services.sub_agent_models.resolve_workflow_ctx_model",
            MagicMock(return_value="gpt-5.5"),
        ),
        patch(
            "app.db.workflows.create_workflow_run",
            AsyncMock(return_value=uuid.uuid4()),
        ),
        patch("app.db.workflows.load_run_phases", AsyncMock(return_value=[])),
        patch("app.db.runs.insert_run", AsyncMock(return_value=None)),
        patch("app.db.runs.finalize_run", finalize),
        patch(
            "app.services.harness_engine.run_workflow",
            AsyncMock(side_effect=_box_setter(box)),
        ),
        patch.object(ps.logger, "warning", seq.warning),
    ):
        await ps._drive_golden_run(
            definition_id=uuid.uuid4(),
            definition=definition,
            golden_input="the golden question",
            user_id=uuid.uuid4(),
            pool=MagicMock(),
            redis=MagicMock(),
            supabase=supabase,
        )

    assert finalize.await_count == 1, (
        f"site 4's shell must finalize exactly once; got {finalize.await_count}"
    )
    return finalize.await_args.kwargs, seq


# ===========================================================================
# Site 5 — scheduler_service :: _drive_run (the ODD one: finalize_run_terminal)
# ===========================================================================


async def _drive_site5(box, *, ctx_is_none: bool = False):
    from app.services import scheduler_service as sched

    seq = _Seq()
    finalize_terminal = seq.finalize()
    pid = uuid.uuid4()
    ctx = SimpleNamespace(producer_run_id=pid, provider="openai", model="gpt-5.5")

    build = (
        AsyncMock(side_effect=RuntimeError("resume-context build failed"))
        if ctx_is_none
        else AsyncMock(return_value=ctx)
    )

    with (
        patch("app.db.schedules.record_schedule_outcome", AsyncMock(return_value=None)),
        patch("app.services.harness_engine._build_resume_context", build),
        patch(
            "app.services.harness_engine.run_workflow",
            AsyncMock(side_effect=_box_setter(box)),
        ),
        patch(
            "app.services.run_lifecycle.finalize_run_terminal", finalize_terminal,
        ),
        patch("app.services.run_lifecycle.mirror_run_active", AsyncMock(return_value=None)),
        patch.object(sched.logger, "warning", seq.warning),
    ):
        await sched._drive_run(
            run_id=uuid.uuid4(),
            schedule_id=uuid.uuid4(),
            thread_id=uuid.uuid4(),
            owner_id=uuid.uuid4(),
            org_id=None,
            inputs={},
            definition=object(),
            pool=MagicMock(),
            redis=MagicMock(),
        )

    return finalize_terminal, seq


_SITES = {
    "site1_ask_user_redrive": _drive_site1,
    "site2_continuation": _drive_site2,
    "site4_publish_golden_run": _drive_site4,
    "site5_scheduled_run": lambda box: _drive_site5(box),
}


async def _kwargs_and_seq(name, box):
    if name == "site5_scheduled_run":
        finalize, seq = await _drive_site5(box)
        assert finalize.await_count == 1, (
            f"site 5's shell must finalize exactly once; got {finalize.await_count}"
        )
        return finalize.await_args.kwargs, seq
    return await _SITES[name](box)


# ===========================================================================
# 1. A measured segment is written — at every site
# ===========================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("site", list(_SITES))
async def test_a_measured_segment_is_written_not_dropped(site):
    kwargs, _seq = await _kwargs_and_seq(site, {"input_tokens": 1234, "output_tokens": 567})
    assert kwargs["input_tokens"] == 1234, (
        f"{site} dropped the measured input tokens — the box held 1234"
    )
    assert kwargs["output_tokens"] == 567, (
        f"{site} dropped the measured output tokens — the box held 567"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("site", list(_SITES))
async def test_a_partially_measured_segment_keeps_the_missing_half_none(site):
    """⛔ No ``or 0``, no default. An absent key stays ``None`` to the column."""
    kwargs, _seq = await _kwargs_and_seq(site, {"input_tokens": 77})
    assert kwargs["input_tokens"] == 77
    assert kwargs["output_tokens"] is None, (
        f"{site}: an absent output_tokens key must reach the column as NULL — a 0 "
        "here would claim the segment produced nothing, which is a different fact"
    )


# ===========================================================================
# 2. An unmeasured segment stays NULL — never 0 — and says so FIRST
# ===========================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("site", list(_SITES))
async def test_an_empty_box_writes_none_and_never_zero(site):
    kwargs, _seq = await _kwargs_and_seq(site, {})
    assert kwargs["input_tokens"] is None, f"{site} wrote {kwargs['input_tokens']!r}, not None"
    assert kwargs["output_tokens"] is None, f"{site} wrote {kwargs['output_tokens']!r}, not None"


@pytest.mark.asyncio
@pytest.mark.parametrize("site", list(_SITES))
async def test_a_ctx_with_no_box_at_all_writes_none(site):
    """``getattr(ctx, "run_usage_box", None) or {}`` — the absent-box case."""
    kwargs, _seq = await _kwargs_and_seq(site, None)
    assert kwargs["input_tokens"] is None
    assert kwargs["output_tokens"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("site", list(_SITES))
async def test_the_missing_usage_warning_fires_before_the_finalize(site):
    """The ``db/runs.py:93-99`` contract — and ORDER is the property, not co-occurrence."""
    _kwargs, seq = await _kwargs_and_seq(site, {})
    assert seq.events == ["warning", "finalize"], (
        f"{site}: expected the missing-usage warning BEFORE the finalize call; "
        f"recorded sequence was {seq.events}"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("site", list(_SITES))
async def test_the_warning_carries_the_shipped_literal_with_identifier_args(site):
    _kwargs, seq = await _kwargs_and_seq(site, {})
    assert len(seq.warn_calls) == 1, (
        f"{site}: expected exactly one missing-usage warning, got {len(seq.warn_calls)}"
    )
    args = seq.warn_calls[0]
    assert args[0] == _WARNING_FORMAT, (
        f"{site} used a VARIANT wording ({args[0]!r}); five sites sharing one literal "
        "is what makes the T-073-04 pin meaningful and a log search complete"
    )
    # T-256-14 / T-073-04 — identifiers only. No token VALUE may ride the log line.
    for arg in args[1:]:
        assert not isinstance(arg, int), (
            f"{site} passed an int ({arg!r}) to the missing-usage warning — the "
            "arguments are run/provider/model IDENTIFIERS only"
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("site", list(_SITES))
async def test_no_warning_when_the_segment_was_measured(site):
    """The vacuity control: a warning that fires always says nothing."""
    _kwargs, seq = await _kwargs_and_seq(site, {"input_tokens": 5, "output_tokens": 5})
    assert seq.events == ["finalize"], (
        f"{site}: a measured segment must NOT emit the missing-usage warning; "
        f"recorded sequence was {seq.events}"
    )


# ===========================================================================
# 3. Site 5's two standing invariants
# ===========================================================================


@pytest.mark.asyncio
async def test_site5_tolerates_a_none_ctx_and_does_not_raise():
    """⛔ The existing ``if ctx is not None`` guard must not be broken by this change."""
    finalize, _seq = await _drive_site5(None, ctx_is_none=True)
    assert finalize.await_count == 0, (
        "with no ctx there is no producer shell to finalize — the guard at "
        "scheduler_service.py:279 owns that, and reading the box must not bypass it"
    )


def test_site5_still_calls_finalize_run_terminal_not_finalize_run():
    """⛔ The DB-only writer would leave the run in ``runs:active`` as a GHOST."""
    import inspect

    from app.services import scheduler_service as sched

    src = inspect.getsource(sched._drive_run)
    assert "finalize_run_terminal(" in src, (
        "site 5's writer was swapped away from finalize_run_terminal — a finished "
        "scheduled run would show in the Control Room as permanently active with a "
        "live Kill button (scheduler_service.py:282-286)"
    )
    assert "await finalize_run(" not in src, (
        "site 5 must not call the DB-only finalize_run — see scheduler_service.py:282-286"
    )


# ===========================================================================
# 4. Source-level fences over the three files this plan repairs
# ===========================================================================


def _read(rel: str) -> str:
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[2]
    return (root / rel).read_text(encoding="utf-8")


@pytest.mark.parametrize("rel", _SUBJECT_FILES)
def test_no_producer_shell_hardcodes_a_null_usage(rel):
    assert "input_tokens=None" not in _read(rel), (
        f"{rel} still hardcodes input_tokens=None — a shell is throwing away a "
        "number the box was holding all along (METER-05 / D-256-08)"
    )


@pytest.mark.parametrize("rel", _SUBJECT_FILES)
def test_no_token_read_uses_a_default_or_an_or_zero(rel):
    """D-256-06 / T-256-15 — ``NULL`` and ``0`` are different facts."""
    text = _read(rel)
    for forbidden in (
        '.get("input_tokens", 0)',
        ".get('input_tokens', 0)",
        '.get("output_tokens", 0)',
        ".get('output_tokens', 0)",
        'input_tokens") or 0',
        'output_tokens") or 0',
    ):
        assert forbidden not in text, (
            f"{rel} collapses an unmeasured token count to 0 via {forbidden!r}; NULL "
            "means never measured and 0 means measured as zero (D-256-06)"
        )


@pytest.mark.parametrize("rel", _SUBJECT_FILES)
def test_the_warning_format_string_leaks_no_token_values(rel):
    """T-256-14 / T-073-04 — asserted at the CALL SITE, not only in the constant."""
    text = _read(rel)
    assert _WARNING_FORMAT in text, f"{rel} does not carry the shipped warning literal"
    start = 0
    while True:
        idx = text.find(_WARNING_FORMAT, start)
        if idx == -1:
            break
        window = text[idx : idx + 400]
        for leak in ("tokens=", "value=", "usage_dict"):
            assert leak not in window, (
                f"{rel}: the missing-usage warning must carry IDENTIFIERS ONLY "
                f"(T-073-04); found {leak!r} near the call"
            )
        start = idx + 1


def test_the_warning_literal_appears_once_per_shell():
    """One literal per site — two in runs.py (two shells), one in each other file."""
    assert _read("app/api/runs.py").count(_WARNING_FORMAT) == 2
    assert _read("app/services/harness/publish_service.py").count(_WARNING_FORMAT) == 1
    assert _read("app/services/scheduler_service.py").count(_WARNING_FORMAT) == 1


def test_no_shell_started_writing_the_workflow_grain():
    """T-256-16 / D-256-03 — a segment shell must never write the cumulative total."""
    text = _read("app/api/runs.py")
    assert "persist_run_usage" not in text, (
        "a producer shell reached for the workflow_runs cumulative writer; the two "
        "grains must never be summed (D-256-03)"
    )
    for rel in _SUBJECT_FILES[1:]:
        assert "persist_run_usage" not in _read(rel), (
            f"{rel} reached for the workflow_runs cumulative writer (D-256-03)"
        )
