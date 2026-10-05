"""Phase 273 (I-3 / I-4 / Pitfall 4) — inline rows never ride a later turn.

`redact_artifact_args` is the agent loop's ONE persist-time hook. Every `show_artifact`
call's `args.rows` is replaced by a placeholder built from the 273-01 constants, stored or
refused, so no later turn re-sends hundreds of rows; and after redaction the id is still the
FIRST thing the model reads in the replayed tool result (I-3), on every provider path.

The tool-result strings are built here from the 273-01 result contract — this suite never
imports the 273-03 handler.
"""
from __future__ import annotations

import copy
import json

import pytest

from app.models.artifact import (
    REFUSED_STATUS,
    RESULT_ID_KEY,
    ROWS_PLACEHOLDER_NOT_STORED,
    ROWS_PLACEHOLDER_STORED,
)
from app.services.artifact_history import redact_artifact_args

ART_ID = "a_k3j9x0p2qd"


def _rows(n: int) -> list[list]:
    return [[f"2024-{i:04d}", i * 1.5] for i in range(n)]


def _stored_result(art_id: str = ART_ID, n: int = 120) -> str:
    return json.dumps({RESULT_ID_KEY: art_id, "label": "chart 1", "component": "chart", "row_count": n})


def _refused_result() -> str:
    return json.dumps({"status": REFUSED_STATUS, "reason": "1,240 rows (max 500); aggregate first"})


def _call(rows, result: str, **extra) -> dict:
    args = {"component": "chart", "title": "Revenue", "columns": [{"name": "month"}, {"name": "rev"}]}
    if rows is not _ABSENT:
        args["rows"] = rows
    return {
        "tool_call_id": extra.pop("tool_call_id", "call_0"),
        "name": "show_artifact",
        "args": args,
        "result": result,
        "status": "done",
        **extra,
    }


_ABSENT = object()


# ── redact_artifact_args ──────────────────────────────────────────────────────────────────────


def test_a_stored_call_is_replaced_by_a_reference_naming_the_id_and_count():
    out = redact_artifact_args([_call(_rows(120), _stored_result())])
    assert out[0]["args"]["rows"] == f"{ROWS_PLACEHOLDER_STORED}{ART_ID}, 120 rows>"
    assert out[0]["args"]["rows"] == "<stored in artifact a_k3j9x0p2qd, 120 rows>"


def test_a_refused_call_is_redacted_too_pitfall_4():
    out = redact_artifact_args([_call(_rows(1240), _refused_result())])
    assert out[0]["args"]["rows"] == "<not stored: refused, 1240 rows>"
    assert out[0]["args"]["rows"].startswith(ROWS_PLACEHOLDER_NOT_STORED)


def test_rows_that_were_not_a_list_become_not_stored():
    out = redact_artifact_args([_call("[[1, 2], [3, 4]]", _refused_result())])
    assert out[0]["args"]["rows"] == "<not stored>"


def test_a_list_whose_result_is_neither_stored_nor_refused_is_still_redacted():
    """A dispatch error result still persists status 'done' — its rows must not ride later turns."""
    out = redact_artifact_args([_call(_rows(7), "Tool execution failed: boom")])
    assert out[0]["args"]["rows"].startswith(ROWS_PLACEHOLDER_NOT_STORED)
    assert "7 rows" in out[0]["args"]["rows"]


def test_a_result_cut_at_2000_chars_still_yields_the_stored_reference():
    """The loop persists result[:2000]; the id is the FIRST key so the cut keeps it (I-3)."""
    long = json.dumps({RESULT_ID_KEY: ART_ID, "label": "table 1", "values": ["x" * 50] * 100})
    assert len(long) > 2000
    out = redact_artifact_args([_call(_rows(300), long[:2000])])
    assert out[0]["args"]["rows"] == f"<stored in artifact {ART_ID}, 300 rows>"


@pytest.mark.parametrize("rows", [None, _ABSENT])
def test_a_by_reference_call_without_rows_is_unchanged(rows):
    tc = _call(rows, _stored_result())
    tc["args"]["from_artifact"] = "chart 1"
    out = redact_artifact_args([tc])
    assert out[0] == tc


def test_non_artifact_entries_are_the_same_objects():
    other = {"tool_call_id": "c1", "name": "search_documents", "args": {"query": "q", "rows": [1]},
             "result": "[]", "status": "done"}
    out = redact_artifact_args([other])
    assert out[0] is other


def test_the_input_list_and_its_dicts_are_not_mutated():
    calls = [
        _call(_rows(12), _stored_result(n=12), thought_signature="sig-abc"),
        {"tool_call_id": "c2", "name": "web_search", "args": {"q": "x"}, "result": "", "status": "done"},
        _call(_rows(900), _refused_result(), tool_call_id="call_1"),
    ]
    before = copy.deepcopy(calls)
    out = redact_artifact_args(calls)
    assert calls == before
    assert out is not calls
    assert len(out) == len(calls)
    assert [o["tool_call_id"] for o in out] == ["call_0", "c2", "call_1"]


def test_thought_signature_and_every_other_args_key_survive():
    tc = _call(_rows(5), _stored_result(n=5), thought_signature="sig-xyz")
    tc["args"]["transform"] = None
    out = redact_artifact_args([tc])[0]
    assert out["thought_signature"] == "sig-xyz"
    assert {k: v for k, v in out["args"].items() if k != "rows"} == {
        k: v for k, v in tc["args"].items() if k != "rows"
    }
    assert out["result"] == tc["result"]
    assert out["tool_call_id"] == tc["tool_call_id"]
    assert out["status"] == "done"


def test_an_empty_list_and_a_none_args_entry_do_not_raise():
    assert redact_artifact_args([]) == []
    weird = {"tool_call_id": "c", "name": "show_artifact", "args": None, "result": "", "status": "done"}
    assert redact_artifact_args([weird])[0] is weird


# ── I-3: the id survives history, first in the replayed result, on every converter ───────────


def _persisted_row() -> dict:
    redacted = redact_artifact_args([_call(_rows(120), _stored_result(), thought_signature="sig-1")])
    return {
        "role": "assistant",
        "content": "Here is the revenue chart.",
        "tool_calls": redacted,
    }


def _history() -> list[dict]:
    from app.services.agent_loop import _reconstruct_history

    return _reconstruct_history(
        [{"role": "user", "content": "chart revenue"}, _persisted_row(), {"role": "user", "content": "thanks"}]
    )


def test_reconstructed_tool_result_starts_with_the_artifact_id():
    msgs = _history()
    tool_msgs = [m for m in msgs if m["role"] == "tool"]
    assert len(tool_msgs) == 1
    content = tool_msgs[0]["content"]
    assert content.startswith('{"artifact_id": "a_') or content.startswith('{"artifact_id":"a_')


def test_reconstructed_call_arguments_carry_the_reference_and_no_row_values():
    msgs = _history()
    announce = next(m for m in msgs if m["role"] == "assistant" and m.get("tool_calls"))
    arguments = announce["tool_calls"][0]["function"]["arguments"]
    assert "<stored in artifact" in arguments
    assert "2024-0001" not in arguments
    assert announce["tool_calls"][0]["thought_signature"] == "sig-1"


def test_the_rebuilt_history_converts_on_google_anthropic_and_responses():
    from app.services.anthropic_service import _convert_messages_to_anthropic
    from app.services.google_service import _convert_messages_to_google
    from app.services.provider_gateway.openai_responses import _to_responses_input

    msgs = [{"role": "system", "content": "sys"}, *_history()]
    contents, _system = _convert_messages_to_google(msgs)
    assert contents
    assert _convert_messages_to_anthropic(msgs)
    assert _to_responses_input(msgs)
