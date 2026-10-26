"""Phase 296-06 Task 3 — chat markup and notice, eval round cap, follow-up files, wire typing,
worded delete refusal.

* **292.1-IN-01.** A DSML block after an UNCLOSED code fence was classified as code (the fence ran
  to the end of the text), so it was shown live and persisted raw. An unclosed fence is now code
  only up to the next tool-call opener at the start of a line.
* **292.1-IN-02.** The save-point log line previewed the start of the ANSWER; it now carries the
  length and the sha256 only. A markup-only answer replaced by ``FAILED_CALL_NOTICE`` at save is
  streamed as a delta, so the live text equals the reloaded text.
* **292.1-IN-04.** A skill eval run uses ``EVAL_MAX_TOOL_ROUNDS``, never the chat knob.
* **BUG-261024-04 (backend leads 1 and 2, measured).** Lead 1: a regenerated file is new by hash,
  and an unchanged prior-turn file is excluded by the run baseline. Lead 2: the per-run baseline
  re-seeded on every agent-loop iteration (the ToolContext is rebuilt each time) and overwrote an
  earlier iteration's meta with ``iteration: -1, url: None``.
* **289-IN-07 / 288-IN-01 / 291-IN-03.** ``confidence`` and ``auto_answered`` are typed on the
  wire; a partial Word placement returns its ``unplaced_sentences``.
* **293-DEL.** ``DELETE /workflows/{id}`` blocked by a publish trial run answers a worded 409.
"""
from __future__ import annotations

import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.structured_text_holdback import FAILED_CALL_NOTICE
from tests.unit.test_2921_cap_text_calls import (
    F1,
    F3,
    PREAMBLE,
    _bypass_settle,
    _deltas,
    _delta_texts,
    _drive,
    _loop_mod,
    _persisted_field,
)


# ── 292.1-IN-01: DSML after an unclosed fence ───────────────────────────────────────────────


UNCLOSED = "Here is the script:\n```python\nprint(1)\n"


def test_in01_dsml_after_an_unclosed_fence_is_detected_and_stripped():
    from app.services.text_tool_calls import detect_markup, settle, strip_markup

    text = UNCLOSED + F1
    assert detect_markup(text) == len(UNCLOSED)
    assert strip_markup(text) == UNCLOSED
    assert "DSML" not in settle(text, {"execute_code"}, buffer_has_calls=False).visible


def test_in01_dsml_inside_a_closed_fence_is_still_content():
    from app.services.text_tool_calls import detect_markup, strip_markup

    text = "Example:\n```\n" + F1 + "\n```\nDone."
    assert detect_markup(text) is None
    assert strip_markup(text) is text


def test_in01_an_unclosed_fence_with_no_markup_is_byte_identical():
    from app.services.text_tool_calls import detect_markup, strip_markup

    assert detect_markup(UNCLOSED + "more code\n") is None
    assert strip_markup(UNCLOSED) is UNCLOSED


# ── 292.1-IN-02: no answer preview in the log; the substituted notice is live ───────────────


@pytest.mark.asyncio
async def test_in02_the_save_point_log_carries_no_answer_preview(caplog):
    caplog.set_level(logging.WARNING, logger=_loop_mod.logger.name)
    with patch.object(_loop_mod, "settle", _bypass_settle):
        await _drive([_deltas([PREAMBLE + F3])])
    lines = [r.getMessage() for r in caplog.records if "text_tool_markup_at_save" in r.getMessage()]
    assert lines, "the save point must still log the removal"
    assert all("sha256=" in ln and "len=" in ln for ln in lines)
    assert not any("preview" in ln or PREAMBLE[:12] in ln for ln in lines)


@pytest.mark.asyncio
async def test_in02_a_markup_only_answer_streams_the_notice_it_is_saved_as():
    with patch.object(_loop_mod, "settle", _bypass_settle):
        run = await _drive([_deltas([F3])])
    assert _persisted_field(run["persisted"], "content") == FAILED_CALL_NOTICE
    assert FAILED_CALL_NOTICE in _delta_texts(run["emits"])


@pytest.mark.asyncio
async def test_in02_an_answer_with_prose_streams_no_notice():
    with patch.object(_loop_mod, "settle", _bypass_settle):
        run = await _drive([_deltas([PREAMBLE + F3])])
    assert _persisted_field(run["persisted"], "content") == PREAMBLE
    assert FAILED_CALL_NOTICE not in _delta_texts(run["emits"])


# ── 292.1-IN-04: the eval round cap is fixed ─────────────────────────────────────────────────


class _StopLoop(BaseException):
    """Stops the eval arm at the loop call (not an Exception, so the arm's handlers pass it)."""


@pytest.mark.asyncio
@pytest.mark.parametrize("chat_cap", [3, 40])
async def test_in04_a_skill_eval_run_uses_its_own_round_cap(chat_cap):
    from app.models.user_settings import _build_settings_from_row
    from app.services import eval_runner_service as ers
    from app.services.text_tool_calls import resolve_round_cap

    settings_ = _build_settings_from_row({"chat_max_tool_rounds": chat_cap})
    seen = {}

    async def _loop(ctx, **_kw):
        seen["ctx"] = ctx
        raise _StopLoop()

    with patch.object(ers, "run_agent_loop", _loop):
        with pytest.raises(_StopLoop):
            await ers._run_arm_body(
                redis=MagicMock(), supabase=MagicMock(), run_id=uuid4(), thread_id=str(uuid4()),
                case={"prompt": "hi"}, variant="with", catalog_override=(), provider="openai",
                model="gpt-5.5", current_user={"id": str(uuid4())}, user_settings=settings_,
                user_id=str(uuid4()), test_case_id=uuid4(),
            )
    ctx = seen["ctx"]
    assert resolve_round_cap(ctx.user_settings, "default") == ers.EVAL_MAX_TOOL_ROUNDS
    assert settings_.chat_max_tool_rounds == chat_cap, "the owner's settings object is untouched"


def test_in04_the_eval_cap_keeps_todays_effective_default():
    from app.services import eval_runner_service as ers
    from app.services.text_tool_calls import ROUND_CAP_DEFAULTS

    assert ers.EVAL_MAX_TOOL_ROUNDS == ROUND_CAP_DEFAULTS["general"]


# ── BUG-261024-04: follow-up files (backend leads, measured) ────────────────────────────────


def _meta(name, url, iteration):
    return {"filename": name, "url": url, "size": 3, "iteration": iteration}


async def _cell(ctx, *, baseline: dict, harvest: tuple):
    from tests.unit.test_244_attachment_hydration import _sandbox_patched
    from app.services.tools import sandbox as sandbox_mod
    from app.services.tool_dispatcher import _handle_execute_code

    with _sandbox_patched([]):
        with (
            patch.object(sandbox_mod, "snapshot_output_baseline", lambda *_a, **_k: dict(baseline)),
            patch.object(sandbox_mod, "harvest_output_files", lambda *_a, **_k: harvest),
        ):
            await _handle_execute_code({"code": "print(1)"}, ctx)


@pytest.mark.asyncio
async def test_bug_261024_04_lead2_a_later_iteration_never_overwrites_an_earlier_files_meta():
    """One turn, two agent-loop iterations: the ToolContext is rebuilt, the run dicts are shared."""
    from tests.unit.test_244_attachment_hydration import _make_ctx

    run_files: dict = {}
    run_new: set = set()
    thread_id = str(uuid4())
    a1 = _meta("a.pdf", "https://signed/a1", 0)
    await _cell(_make_ctx(thread_id=thread_id, iteration=0, previous_files_in_run=run_files,
                          new_file_hashes_in_run=run_new),
                baseline={}, harvest=([a1], {"H1": a1}))
    # Iteration 2: a NEW ctx; the output folder still holds a.pdf, so the snapshot lists it.
    await _cell(_make_ctx(thread_id=thread_id, iteration=1, previous_files_in_run=run_files,
                          new_file_hashes_in_run=run_new),
                baseline={"H1": _meta("a.pdf", None, -1)}, harvest=([], {}))
    assert run_files["H1"]["url"] == "https://signed/a1"
    assert run_files["H1"]["iteration"] == 0
    assert run_new == {"H1"}


@pytest.mark.asyncio
async def test_bug_261024_04_lead1_a_follow_up_turn_lists_only_its_own_files():
    """Turn 2 regenerates a.pdf (new bytes, new hash) and leaves b.png alone: only a.pdf is new."""
    from tests.unit.test_244_attachment_hydration import _make_ctx

    run_files: dict = {}
    run_new: set = set()
    a2 = _meta("a.pdf", "https://signed/a2", 0)
    await _cell(_make_ctx(previous_files_in_run=run_files, new_file_hashes_in_run=run_new),
                baseline={"H1": _meta("a.pdf", None, -1), "H2": _meta("b.png", None, -1)},
                harvest=([a2], {"H3": a2, "H2": _meta("b.png", "https://signed/b", 0)}))
    assert run_new == {"H3"}
    final = [run_files[h]["filename"] for h in sorted(run_new)]
    assert final == ["a.pdf"]


# ── 289-IN-07 / 288-IN-01: typed wire fields ─────────────────────────────────────────────────


def _resolve(schema: dict, node: dict) -> dict:
    ref = node.get("$ref")
    if ref is None:
        return node
    return schema["$defs"][ref.rsplit("/", 1)[-1]]


def test_289_in07_run_confidence_is_typed_on_the_wire():
    from app.api.workflow_runs import WorkflowRunPhaseRead

    schema = WorkflowRunPhaseRead.model_json_schema()
    options = schema["properties"]["confidence"].get("anyOf") or [schema["properties"]["confidence"]]
    typed = [_resolve(schema, o) for o in options if o.get("type") != "null"]
    assert typed and typed[0].get("title") == "RunEvidenceConfidence"
    assert {"level", "kb_label"} <= set(typed[0]["properties"])


def test_288_in01_auto_answered_items_are_typed_on_the_wire():
    from app.api.workflow_wire import PublishVerdict

    schema = PublishVerdict.model_json_schema()
    items = _resolve(schema, schema["properties"]["auto_answered"]["items"])
    assert items.get("title") == "AutoAnsweredNote"
    assert set(items["properties"]) == {"phase", "message"}
    assert items["required"] == ["message"]
    v = PublishVerdict(published=True, auto_answered=[{"phase": None, "message": "m"}])
    assert v.model_dump()["auto_answered"] == [{"phase": None, "message": "m"}]


# ── 291-IN-03: a partial Word placement says what it could not place ────────────────────────


def _bind_upload(made):
    from app.api import workflow_authoring_doors as doors

    upload = MagicMock()
    upload.filename = "letter.docx"
    upload.size = 100
    upload.read = AsyncMock(return_value=b"PK\x03\x04-docx-bytes")
    storage = MagicMock()
    sb = MagicMock()
    sb.storage.from_.return_value = storage

    async def _ritp(func, *args, **kwargs):
        return func(*args, **kwargs)

    zf = MagicMock()
    zf.__enter__.return_value.infolist.return_value = [SimpleNamespace(file_size=10)]
    patches = [
        patch.object(doors, "get_pg_pool", AsyncMock(return_value=MagicMock())),
        patch.object(doors, "_owned_slug_or_404", AsyncMock(return_value="slug")),
        patch.object(doors, "validate_upload", MagicMock()),
        patch.object(doors, "run_in_threadpool", _ritp),
        patch.object(doors.zipfile, "ZipFile", MagicMock(return_value=zf)),
        patch.object(doors.describe_files, "make_fillable_copy", MagicMock(return_value=made)),
        patch.object(doors, "_parse_word_anchors", MagicMock(return_value=[MagicMock()])),
    ]
    return doors, upload, sb, patches


async def _bind(made):
    from contextlib import ExitStack

    doors, upload, sb, patches = _bind_upload(made)
    with ExitStack() as stack:
        for p in patches:
            stack.enter_context(p)
        return await doors.upload_workflow_template(
            uuid4(), file=upload, anchors='[{"x": 1}]',
            current_user={"id": str(uuid4())}, supabase=sb,
        )


@pytest.mark.asyncio
async def test_291_in03_a_partial_placement_returns_its_unplaced_sentences():
    made = SimpleNamespace(refused=None, copy=b"copy", placed=["a", "b"],
                           unplaced=[("anchor-3", "The signature blank could not be found.")])
    ref = await _bind(made)
    assert ref.unplaced_sentences == ["The signature blank could not be found."]


@pytest.mark.asyncio
async def test_291_in03_a_full_placement_returns_an_empty_list():
    made = SimpleNamespace(refused=None, copy=b"copy", placed=["a", "b", "c"], unplaced=[])
    ref = await _bind(made)
    assert ref.unplaced_sentences == []


@pytest.mark.asyncio
async def test_291_in03_none_placed_keeps_the_422():
    from fastapi import HTTPException

    made = SimpleNamespace(refused=None, copy=None, placed=[],
                           unplaced=[("a", "The date blank could not be found.")])
    with pytest.raises(HTTPException) as ei:
        await _bind(made)
    assert ei.value.status_code == 422
    assert "None of the ticked blanks could be placed" in ei.value.detail


# ── 293-DEL: a delete blocked by a publish trial run answers in words ───────────────────────


DEL_SENTENCE = (
    "This workflow can't be deleted yet: a run record from an earlier publish attempt still "
    "points to it. Nothing was deleted."
)


@pytest.mark.asyncio
async def test_293_del_a_delete_blocked_by_a_trial_run_is_a_worded_409():
    import asyncpg
    from fastapi import HTTPException

    from app.api import workflows as wf

    raw = 'update or delete on table "workflow_definitions" violates foreign key constraint "workflow_runs_definition_id_fkey"'
    with (
        patch.object(wf, "get_pg_pool", AsyncMock(return_value=MagicMock())),
        patch.object(wf, "delete_workflow_definition",
                     AsyncMock(side_effect=asyncpg.exceptions.ForeignKeyViolationError(raw))),
    ):
        with pytest.raises(HTTPException) as ei:
            await wf.delete_draft(uuid4(), current_user={"id": str(uuid4())})
    assert ei.value.status_code == 409
    assert ei.value.detail == DEL_SENTENCE
    assert "foreign key" not in ei.value.detail and "fkey" not in ei.value.detail
