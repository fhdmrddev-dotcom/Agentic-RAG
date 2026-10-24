"""Phase 292.1 (BUG-261024-03, D-03 / D-06 / D-07 / D-10 / D-11 / D-17 / D-18 / D-24) — the pure
text-form tool-call module.

At the round cap a DeepSeek model wrote its tool call as DSML TEXT; the cap check read only the
structured buffer, so the markup became the answer and no Continue was offered. No DSML *parser*
existed (D-03) — only a deepseek-gated strip with the wrong opener literal (D-01 / D-02).

These tests drive ``app.services.text_tool_calls`` with no loop and no I/O:
  * ``parse_dsml`` over the MEASURED spellings F1 / F2 / F3 (292.1-RESEARCH.md §"Measured format
    set"), strict on the body (D-07 refusals);
  * ``detect_markup`` / ``strip_markup`` over F1-F6, never touching code (Pitfall 6);
  * ``TagHoldback`` at every 1-char split (D-11, I-2);
  * ``settle`` — the one post-drain classification the loop calls;
  * ``resolve_round_cap`` — the 15 / 8 defaults, now operator settings (D-17 / D-18).

The ASCII-lookalike case is re-homed here from ``test_openai_compat_dsml_strip.py``
(``test_ascii_pipe_lookalike_does_not_trigger``), whose deepseek-only strip this phase retires.
"""
from __future__ import annotations

import json
import re
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services import text_tool_calls as ttc
from app.services.structured_text_holdback import FAILED_CALL_NOTICE

# ── Planted fixtures (D-24), verbatim from 292.1-RESEARCH.md §"Planted fixtures" ────────────────

# F1 — production shape (one bar + space). Source: prod msg 4226d237
F1 = ('<｜DSML｜ calls>\n<｜DSML｜ invoke name="execute_code">\n'
      '<｜DSML｜ parameter name="code" string="true">\nimport matplotlib\n</｜DSML｜ parameter>\n'
      '<｜DSML｜ parameter name="description" string="true">Rendering chart</｜DSML｜ parameter>\n'
      '</｜DSML｜ invoke>\n</｜DSML｜ calls>')
# F2 — one bar, no space, block `tool_calls`. Shape: local msg 3d043068 (openrouter deepseek-v4-pro)
F2 = ('<｜DSML｜tool_calls>\n<｜DSML｜invoke name="grep">\n'
      '<｜DSML｜parameter name="pattern" string="true">probation</｜DSML｜parameter>\n'
      '</｜DSML｜invoke>\n</｜DSML｜tool_calls>')
# F3 — two-bar, with a string="false" JSON param. Source: local msg dcf1b29e
F3 = ('<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name="execute_code">\n'
      '<｜｜DSML｜｜parameter name="libraries" string="false">["fpdf2"]</｜｜DSML｜｜parameter>\n'
      '<｜｜DSML｜｜parameter name="code" string="true">print(1)</｜｜DSML｜｜parameter>\n'
      '</｜｜DSML｜｜invoke>\n</｜｜DSML｜｜tool_calls>')
# F4 — Qwen-style XML (caught + worded, NOT executed). Source: local msg 4f4551fc
F4 = ('<tool_call>\n<function=search_documents>\n<parameter=query>\n'
      'project updates completed this week\n</parameter>\n</function>\n</tool_call>')
# F5 — GLM-style XML. Shape: RESEARCH table row F5 (ollama glm-4.7-flash)
F5 = '<tool_call>search_documents<arg_key>query</arg_key><arg_value>RPA</arg_value></tool_call>'
# F6 — Gemma-style, args NOT JSON. Shape: RESEARCH table row F6 (ollama gemma4:e2b)
F6 = '<|tool_call>call:search_documents{query:RPA}<tool_call|>'
PREAMBLE = 'No matches for "notice". Call #8: searching for "probation\n\n'   # local msg 3d043068

F1_TRUNCATED = F1.replace("</｜DSML｜ invoke>", "")
F3_TWO_INVOKES = (
    '<｜｜DSML｜｜tool_calls>\n'
    '<｜｜DSML｜｜invoke name="search_documents">\n'
    '<｜｜DSML｜｜parameter name="query" string="true">revenue</｜｜DSML｜｜parameter>\n'
    '</｜｜DSML｜｜invoke>\n'
    '<｜｜DSML｜｜invoke name="execute_code">\n'
    '<｜｜DSML｜｜parameter name="code" string="true">print(2)</｜｜DSML｜｜parameter>\n'
    '</｜｜DSML｜｜invoke>\n</｜｜DSML｜｜tool_calls>'
)

_ID = re.compile(r"^call_[0-9a-f]{24}$")


def _split(text: str, n: int) -> list[str]:
    return [text[i : i + n] for i in range(0, len(text), n)]


# ── Test 1 (D-06): the measured DSML spellings parse ────────────────────────────────────────────


def test_f1_production_spelling_parses_with_verbatim_string_values():
    r = ttc.parse_dsml(F1, {"execute_code"})
    assert r.found and r.ok
    assert r.preamble == ""
    assert len(r.calls) == 1
    call = r.calls[0]
    assert set(call) == {"id", "name", "arguments"}
    assert _ID.match(call["id"]), call["id"]
    assert call["name"] == "execute_code"
    # string="true" whitespace is preserved verbatim (vendor: "spaces are not stripped")
    assert json.loads(call["arguments"]) == {"code": "\nimport matplotlib\n", "description": "Rendering chart"}


def test_f2_one_bar_no_space_parses_and_keeps_the_preamble():
    r = ttc.parse_dsml(PREAMBLE + F2, {"grep"})
    assert r.found and r.ok
    assert r.preamble == PREAMBLE
    assert [c["name"] for c in r.calls] == ["grep"]
    assert json.loads(r.calls[0]["arguments"]) == {"pattern": "probation"}


def test_f3_two_bars_decodes_string_false_as_json():
    r = ttc.parse_dsml(F3, {"execute_code"})
    assert r.found and r.ok
    args = json.loads(r.calls[0]["arguments"])
    assert args["libraries"] == ["fpdf2"]
    assert args["code"] == "print(1)"


# ── Test 2 (D-06): two invokes in one block, in order ───────────────────────────────────────────


def test_two_invokes_parse_to_two_entries_in_order():
    r = ttc.parse_dsml(F3_TWO_INVOKES, {"search_documents", "execute_code"})
    assert r.ok
    assert [c["name"] for c in r.calls] == ["search_documents", "execute_code"]
    assert r.calls[0]["id"] != r.calls[1]["id"]


# ── Test 3 (D-07): what cannot be parsed EXACTLY is refused whole ──────────────────────────────


@pytest.mark.parametrize(
    "text,offered",
    [
        (PREAMBLE + F1_TRUNCATED, {"execute_code"}),            # truncated: no invoke closer
        (PREAMBLE + F1, {"search_documents"}),                  # name not offered this run
        (PREAMBLE + F1.replace("execute_code", "rm_rf"), {"execute_code"}),  # unknown name
        (PREAMBLE + F3.replace('["fpdf2"]', "[fpdf2"), {"execute_code"}),   # bad JSON, never repaired
    ],
    ids=["truncated", "not-offered", "unknown", "bad-json"],
)
def test_unparseable_blocks_queue_nothing_and_keep_the_preamble(text, offered):
    r = ttc.parse_dsml(text, offered)
    assert r.found is True
    assert r.ok is False
    assert r.calls == []
    assert r.preamble == PREAMBLE


def test_a_block_with_no_invoke_is_refused():
    r = ttc.parse_dsml("<｜DSML｜ calls>\n</｜DSML｜ calls>", {"execute_code"})
    assert r.found and not r.ok and r.calls == []


# ── Test 4 (re-homed from test_openai_compat_dsml_strip): ASCII lookalikes never trigger ────────


def test_ascii_pipe_lookalike_is_not_dsml_and_not_stripped():
    ascii_block = F1.replace("｜", "|")
    r = ttc.parse_dsml(ascii_block, {"execute_code"})
    assert r.found is False and r.calls == []
    assert ttc.detect_markup(ascii_block) is None
    assert ttc.strip_markup(ascii_block) == ascii_block
    text = "run `cat a | grep b` and <DSML> stays too"
    assert ttc.strip_markup(text) == text


# ── Test 5 (D-10, Pitfall 6): clean answers are byte-identical ──────────────────────────────────


@pytest.mark.parametrize(
    "text",
    [
        "Revenue rose every month. The chart above shows it.",
        "If a < b and b > c then nothing follows.",
        "<div class=\"x\"><p>Hello</p></div>",
        "Qwen writes calls like this:\n```\n<tool_call>\n<function=search_documents>\n</function>\n</tool_call>\n```\nDone.",
        "The `<tool_call>` tag and `<|tool_call>` tag are model formats.",
    ],
    ids=["prose", "less-than", "html", "fenced-example", "inline-code"],
)
def test_clean_text_is_returned_byte_identical(text):
    assert ttc.detect_markup(text) is None
    out = ttc.strip_markup(text)
    assert out == text and len(out) == len(text)
    assert out is text


# ── Test 6 (D-24): markup-only and markup-with-preamble, every measured family ─────────────────


@pytest.mark.parametrize("block", [F1, F2, F3, F4, F5, F6], ids=["F1", "F2", "F3", "F4", "F5", "F6"])
def test_markup_only_and_with_preamble_strip_to_the_preamble(block):
    assert ttc.detect_markup(block) == 0
    assert ttc.strip_markup(block) == ""
    assert ttc.detect_markup(PREAMBLE + block) == len(PREAMBLE)
    assert ttc.strip_markup(PREAMBLE + block) == PREAMBLE


def test_truncated_markup_strips_to_end_of_text():
    assert ttc.strip_markup(PREAMBLE + F1_TRUNCATED) == PREAMBLE
    assert ttc.strip_markup(PREAMBLE + F4[:30]) == PREAMBLE


def test_markup_opener_data_is_one_tuple_of_the_measured_set():
    assert isinstance(ttc.MARKUP_OPENERS, tuple)
    for vendor_form_with_zero_hits in ("<function_calls>", "<minimax:tool_call>", "[TOOL_CALLS]", "<|python_tag|>"):
        assert vendor_form_with_zero_hits not in ttc.MARKUP_OPENERS


# ── Test 7 (D-11, I-2): the live holdback at every 1-char split ─────────────────────────────────


@pytest.mark.parametrize("block", [F1, F4], ids=["F1", "F4"])
def test_holdback_releases_only_the_preamble_at_every_split(block):
    text = PREAMBLE + block
    hb = ttc.TagHoldback()
    released = "".join(hb.feed(c) for c in _split(text, 1))
    assert released == PREAMBLE
    assert hb.released == PREAMBLE
    assert "｜DSML｜" not in released and "<tool_call>" not in released
    held = hb.finish()
    assert released + held == text
    assert hb.finish() == ""


@pytest.mark.parametrize("n", [1, 2, 3, 7, 50])
@pytest.mark.parametrize(
    "text",
    ["If a < b then b > a, and <div> is HTML.", "Ends with a lone <", "Plain prose with no tags at all."],
    ids=["lt", "trailing-lt", "plain"],
)
def test_holdback_with_no_opener_releases_byte_identical(text, n):
    hb = ttc.TagHoldback()
    released = "".join(hb.feed(c) for c in _split(text, n))
    assert released + hb.finish() == text


def test_a_trailing_lt_is_held_until_the_next_chunk_disambiguates():
    hb = ttc.TagHoldback()
    assert hb.feed("if a <") == "if a "
    assert hb.feed(" b then") == "< b then"


def test_split_dsml_opener_is_held_across_chunks():
    hb = ttc.TagHoldback()
    out = "".join(hb.feed(c) for c in ["Hi ", "<", "｜", "DSML", "｜ ca", "lls>", "\n<｜DSML｜ invoke"])
    assert out == "Hi "


# ── Test 8 (settle): the one post-drain classification ──────────────────────────────────────────


@pytest.mark.parametrize(
    "text,offered,name",
    [(F1, {"execute_code"}, "execute_code"), (PREAMBLE + F2, {"grep"}, "grep"), (F3, {"execute_code"}, "execute_code")],
    ids=["F1", "F2", "F3"],
)
def test_settle_parsed(text, offered, name):
    s = ttc.settle(text, offered, buffer_has_calls=False)
    assert s.kind == "parsed"
    assert [c["name"] for c in s.calls] == [name]
    assert s.visible == text[: text.index("<")]
    assert s.markup_len > 0
    assert re.fullmatch(r"[0-9a-f]{64}", s.markup_sha256)
    assert len(s.markup_preview) <= 200


@pytest.mark.parametrize(
    "block", [F1_TRUNCATED, F4, F5, F6], ids=["F1-truncated", "F4", "F5", "F6"]
)
def test_settle_unparseable(block):
    s = ttc.settle(PREAMBLE + block, {"execute_code", "search_documents"}, buffer_has_calls=False)
    assert s.kind == "unparseable"
    assert s.calls == []
    assert s.visible == PREAMBLE
    assert "｜DSML｜" not in s.visible and "tool_call" not in s.visible


def test_settle_none_returns_the_content_untouched():
    text = "If a < b, see `<tool_call>`."
    s = ttc.settle(text, {"execute_code"}, buffer_has_calls=False)
    assert s.kind == "none" and s.calls == [] and s.visible is text and s.markup_len == 0


def test_settle_with_structured_calls_only_strips_never_double_dispatches():
    s = ttc.settle(PREAMBLE + F1, {"execute_code"}, buffer_has_calls=True)
    assert s.kind == "stripped"
    assert s.calls == []
    assert s.visible == PREAMBLE


def test_preview_is_bounded_on_a_large_block():
    big = F1.replace("import matplotlib", "x = 1\n" * 4000)
    s = ttc.settle(big, {"execute_code"}, buffer_has_calls=False)
    assert s.markup_len > 20000
    assert len(s.markup_preview) <= 200


def test_the_failed_call_notice_is_reused_not_redefined():
    assert ttc.FAILED_CALL_NOTICE is FAILED_CALL_NOTICE


# ── Test 9 (D-17 / D-18): the round-cap resolver ────────────────────────────────────────────────


def test_round_cap_defaults_are_15_general_and_8_explorer():
    assert ttc.ROUND_CAP_DEFAULTS == {"general": 15, "explorer": 8}
    assert ttc.resolve_round_cap(SimpleNamespace(), "general") == 15
    assert ttc.resolve_round_cap(SimpleNamespace(), "explorer") == 8
    assert ttc.resolve_round_cap(SimpleNamespace(), None) == 15


def test_round_cap_ignores_non_int_and_bool():
    assert ttc.resolve_round_cap(MagicMock(), "general") == 15
    assert ttc.resolve_round_cap(MagicMock(), "explorer") == 8
    assert ttc.resolve_round_cap(SimpleNamespace(chat_max_tool_rounds=True), "general") == 15
    assert ttc.resolve_round_cap(SimpleNamespace(chat_max_tool_rounds="4"), "general") == 15


def test_round_cap_clamps_and_reads_the_named_attributes():
    assert ttc.resolve_round_cap(SimpleNamespace(chat_max_tool_rounds=1), "general") == 2
    assert ttc.resolve_round_cap(SimpleNamespace(chat_max_tool_rounds=51), "general") == 50
    assert ttc.resolve_round_cap(SimpleNamespace(chat_max_tool_rounds=4), "general") == 4
    assert ttc.resolve_round_cap(SimpleNamespace(explorer_max_tool_rounds=5), "explorer") == 5
    # each mode reads its OWN knob
    assert ttc.resolve_round_cap(SimpleNamespace(explorer_max_tool_rounds=5), "general") == 15
    assert ttc.resolve_round_cap(SimpleNamespace(chat_max_tool_rounds=4), "explorer") == 8
    assert (ttc.ROUND_CAP_MIN, ttc.ROUND_CAP_MAX) == (2, 50)


def test_no_failed_call_notice_text_is_interpolated_here():
    # the notice is one sentence and never carries markup
    assert "<" not in FAILED_CALL_NOTICE
