"""Phase 305-02 (D-14 / D-15 / D-51; T-305-18 / T-305-27) — paging, chunking and cursors.

Pure units over ``app.mcp.results`` plus the one additive ``folder_id`` predicate in
``acting_member_reads.list_documents`` (driven against a fake connection that records the SQL and
the bound arguments — never interpolated).

* ``chunk(text, start, budget)`` cuts at most ``READ_BUDGET`` (8,000) characters, preferring the
  last blank line, then the last newline, then whitespace; it never cuts inside an unclosed
  ``[...]`` / ``(...)`` / ``[image: ...]`` token or a surrogate pair, and only hard-cuts a single
  token longer than the budget. The pieces concatenate back to the original text.
* the read cursor (base64url JSON ``{v, d, o}``) round-trips and every forgery decodes to ``None``
  (wrong document, bad bounds, not base64, wrong version) — the handler maps ``None`` to the same
  not-available sentence as a missing document.
* the list cursor (``{v, f, o}``) round-trips and a tampered one is ``None``.
"""
from __future__ import annotations

import base64
import json
import re
import uuid
from contextlib import asynccontextmanager

import pytest

from app.mcp import results as R

DOC = "5b0c1d2e-3f40-4a51-8b62-7c83d94ea5f6"
OTHER = "0a1b2c3d-4e5f-4061-8273-8495a6b7c8d9"


def _pieces(text: str, budget: int = R.READ_BUDGET) -> list[str]:
    out, start = [], 0
    while start < len(text):
        piece, end = R.chunk(text, start, budget)
        assert end > start, (start, end)
        assert piece == text[start:end]
        out.append(piece)
        start = end
    return out


# ── the chunker ─────────────────────────────────────────────────────────────────────────────


def test_the_budget_is_eight_thousand():
    assert R.READ_BUDGET == 8000


def test_twenty_thousand_chars_come_back_in_bounded_pieces_that_rejoin():
    para = ("Revenue grew in the northern region. " * 20).strip()
    text = "\n\n".join(f"{i}. {para}" for i in range(40))
    assert len(text) > 20000
    pieces = _pieces(text)
    assert len(pieces) >= 3
    assert all(len(p) <= 8000 for p in pieces)
    assert "".join(pieces) == text


def test_a_short_text_is_one_piece():
    piece, end = R.chunk("hello world", 0)
    assert (piece, end) == ("hello world", 11)


def test_the_cut_prefers_a_blank_line_then_a_newline_then_whitespace():
    blank = "a" * 50 + "\n\n" + "b b b " * 5 + "\n" + "c" * 20
    piece, end = R.chunk(blank, 0, 60)
    assert piece.endswith("\n\n"), repr(piece)

    newline = "a " * 20 + "\n" + "b" * 10 + " " + "c" * 60
    piece, _ = R.chunk(newline, 0, 60)
    assert piece.endswith("\n"), repr(piece)

    spaces = "word " * 30
    piece, _ = R.chunk(spaces, 0, 22)
    assert piece.endswith(" ") and len(piece) <= 22


@pytest.mark.parametrize("token", [
    "[the quarterly revenue statement for the north](https://example.com/a b)",
    "[image: a diagram of the warehouse loading bays]",
    "(see the appendix on page four of the board pack)",
])
def test_a_cut_never_lands_inside_a_bracket_token(token):
    for lead in range(1, 40):  # lead 0 has no cut point before the budget: the last-resort case
        text = ("x " * lead) + token + (" tail" * 30)
        budget = 2 * lead + len(token) // 2  # the budget ends INSIDE the token
        piece, end = R.chunk(text, 0, max(budget, 1))
        start_tok = text.index(token)
        assert not (start_tok < end < start_tok + len(token)), (lead, end, piece[-20:])
        assert "".join(_pieces(text, max(budget, 1))) == text


def test_a_cut_never_splits_a_surrogate_pair():
    pair = "😀"  # one astral character written as its two UTF-16 halves
    text = "a" * 9 + pair + "b" * 30
    piece, end = R.chunk(text, 0, 10)  # the budget ends between the two halves
    assert not ("\ud800" <= text[end - 1] <= "\udbff"), end
    assert "".join(_pieces(text, 10)) == text


def test_a_single_overlong_token_is_hard_cut_at_the_budget():
    text = "z" * 9000
    piece, end = R.chunk(text, 0)
    assert end == 8000 and len(piece) == 8000
    assert "".join(_pieces(text)) == text


def test_offsets_are_in_the_original_text():
    text = "alpha beta\n\n" * 1500
    piece, end = R.chunk(text, 12, 100)
    assert piece == text[12:end]


# ── the read cursor ─────────────────────────────────────────────────────────────────────────


def test_the_read_cursor_round_trips():
    c = R.encode_read_cursor(DOC, 8000)
    assert re.fullmatch(r"[A-Za-z0-9_-]+", c), c  # base64url, no padding
    assert R.decode_read_cursor(c, DOC, 20000) == 8000
    assert R.decode_read_cursor(c, DOC.upper(), 20000) == 8000


def _raw(payload) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")


@pytest.mark.parametrize("cursor,length", [
    (lambda: R.encode_read_cursor(DOC, 10), 100),          # presented with ANOTHER document
    (lambda: _raw({"v": 1, "d": OTHER, "o": -1}), 100),     # negative offset
    (lambda: _raw({"v": 1, "d": OTHER, "o": 101}), 100),    # past the end
    (lambda: "not base64 at all!!", 100),
    (lambda: _raw({"v": 2, "d": OTHER, "o": 0}), 100),      # unknown version
    (lambda: _raw({"v": 1, "d": OTHER, "o": True}), 100),   # a bool is not an offset
    (lambda: _raw({"v": 1, "d": OTHER, "o": "5"}), 100),
    (lambda: _raw({"v": 1, "d": OTHER, "o": 5, "x": 1}), 100),  # extra keys
    (lambda: _raw([1, OTHER, 5]), 100),
    (lambda: "", 100),
    (lambda: "A" * 5000, 100),
])
def test_every_forged_read_cursor_is_none(cursor, length):
    assert R.decode_read_cursor(cursor(), OTHER, length) is None


def test_the_read_cursor_bounds_are_inclusive():
    assert R.decode_read_cursor(R.encode_read_cursor(DOC, 0), DOC, 100) == 0
    assert R.decode_read_cursor(R.encode_read_cursor(DOC, 100), DOC, 100) == 100


# ── the list cursor ─────────────────────────────────────────────────────────────────────────


def test_the_list_cursor_round_trips_for_a_folder_and_for_the_top_level():
    assert R.decode_list_cursor(R.encode_list_cursor(DOC, 50), DOC) == 50
    assert R.decode_list_cursor(R.encode_list_cursor(None, 100), None) == 100


@pytest.mark.parametrize("cursor", [
    lambda: R.encode_list_cursor(OTHER, 50),               # another folder
    lambda: R.encode_list_cursor(None, 50),                # the top level, presented for a folder
    lambda: _raw({"v": 1, "f": DOC, "o": -5}),
    lambda: _raw({"v": 9, "f": DOC, "o": 5}),
    lambda: _raw({"v": 1, "f": DOC, "o": 5})[:-3] + "%%%",
    lambda: "garbage",
])
def test_a_tampered_list_cursor_is_none(cursor):
    assert R.decode_list_cursor(cursor(), DOC) is None


# ── the folder_id predicate (one additive change in the 304 module) ────────────────────────


class _RecordingConn:
    def __init__(self):
        self.calls: list[tuple[str, tuple]] = []

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return []

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return 0


class _P:
    user_id = "7a1c9e44-0b2d-4c8e-a7f3-55d1e2c3b402"
    org_id = "2f0b7c1e-5d55-4e3c-9f4a-0d8a3b6c1e01"
    folder_ids = None
    include_external = False
    tools = ("list_documents",)


@pytest.fixture
def conn(monkeypatch):
    from app.services import acting_member_reads as reads

    c = _RecordingConn()

    @asynccontextmanager
    async def _acting(**kw):
        yield c

    monkeypatch.setattr(reads, "acting_member_connection", _acting)
    return c


def _document_sql(c: _RecordingConn) -> list[tuple[str, tuple]]:
    return [(s, a) for s, a in c.calls if "library_documents" in s]


async def test_a_folder_id_is_one_bound_predicate(conn):
    from app.services import acting_member_reads as reads

    fid = str(uuid.uuid4())
    page = await reads.list_documents(_P(), folder_id=fid.upper())
    assert page == {"items": [], "total": 0}
    calls = _document_sql(conn)
    assert len(calls) == 2  # the count and the page
    for sql, args in calls:
        m = re.search(r"d\.folder_id = \$(\d+)::uuid", sql)
        assert m, sql
        assert args[int(m.group(1)) - 1] == fid  # bound, normalised, never interpolated
        assert fid not in sql and fid.upper() not in sql
        assert "NOT (d.source_connection_id IS NOT NULL)" in sql  # the KeyScope still applies


async def test_root_only_is_folder_id_is_null(conn):
    from app.services import acting_member_reads as reads

    await reads.list_documents(_P(), root_only=True)
    for sql, _args in _document_sql(conn):
        assert "d.folder_id IS NULL" in sql, sql


async def test_a_malformed_folder_id_is_empty_before_any_sql(conn):
    from app.services import acting_member_reads as reads

    assert await reads.list_documents(_P(), folder_id="not-a-uuid") == {"items": [], "total": 0}
    assert conn.calls == []


async def test_the_defaults_keep_every_existing_caller_byte_identical(conn):
    from app.services import acting_member_reads as reads

    await reads.list_documents(_P())
    for sql, _args in _document_sql(conn):
        assert "folder_id = $" not in sql and "folder_id IS NULL" not in sql, sql
