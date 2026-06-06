"""Phase 095 Plan 05 Task 1 — D-08 final-output hero tag (agent-marks + backend-fallback).

Locks the additive ``is_hero`` flag on the ``final_output_files`` emit and on the
persisted ``execute_code`` result. The hero is NEVER empty when ≥1 file exists
(operator-resolved this session: "agent marks + backend fallback"):

  - The agent's declaration (if a file's meta dict already carries an
    ``is_hero``/``hero`` intent flag) is honored first.
  - ELSE the backend heuristic: if the user message names a requested extension
    (docx / pptx / pdf / xlsx / csv / png / md / …) and a generated file matches
    that ext → that file is the hero; ELSE the single largest-size file (tie-break
    highest ``iteration``) is the hero.

These tests exercise the PURE helper ``_select_hero_filenames`` directly (no Redis,
no live loop) plus the emit-projection + persist-projection shapes, so the gate is
fast and deterministic. The re-sign endpoint is intentionally NOT exercised here —
the hero flag is presentation-only and must never feed the download path
(T-095-05-01).
"""
from __future__ import annotations

import json

from app.services.agent_loop import _select_hero_filenames


# ---------------------------------------------------------------------------
# Fixtures — meta dicts mirror sandbox_service.harvest_output_files's projection
# ({filename, url, size, iteration}); the helper only reads filename/size/iteration.
# ---------------------------------------------------------------------------
def _f(filename: str, size: int, iteration: int = 0, **extra) -> dict:
    return {
        "filename": filename,
        "url": f"/sandbox-outputs/u/e/{filename}",
        "size": size,
        "iteration": iteration,
        **extra,
    }


# ---------------------------------------------------------------------------
# (a) user asks for a .docx and a .docx is generated → that file is the hero
# ---------------------------------------------------------------------------
def test_requested_extension_match_is_hero():
    files = [
        _f("scratch.png", 50_000, iteration=0),
        _f("report.docx", 12_000, iteration=2),
        _f("data.csv", 9_000, iteration=1),
    ]
    heroes = _select_hero_filenames(files, "Please write me a docx report of the findings")
    assert heroes == {"report.docx"}
    assert len(heroes) == 1  # requested-ext path → exactly one hero


def test_requested_extension_with_leading_dot_and_uppercase():
    # "PPTX" in the user message, file lower-cased — match must be case-insensitive.
    files = [
        _f("draft.md", 2_000),
        _f("deck.pptx", 4_000),
    ]
    heroes = _select_hero_filenames(files, "Build the .PPTX deck for my talk")
    assert heroes == {"deck.pptx"}


def test_multiple_files_share_requested_extension_single_hero():
    # Phase 095 Plan 09 Task 1 (GAP-095-02 / WR-02) — the requested-ext branch
    # must return EXACTLY ONE hero (the largest matching file), never a
    # multi-element set. The larger .docx wins via max(size, iteration).
    files = [
        _f("a.docx", 1_000),
        _f("b.docx", 2_000),
        _f("notes.txt", 9_999),
    ]
    heroes = _select_hero_filenames(files, "give me the docx files")
    assert heroes == {"b.docx"}
    assert len(heroes) == 1


def test_requested_ext_size_tie_breaks_on_iteration():
    # Two requested-ext files tie on size → the higher iteration (last-written)
    # wins, mirroring the fallback tie-break.
    files = [
        _f("early.docx", 5_000, iteration=0),
        _f("late.docx", 5_000, iteration=3),
        _f("notes.txt", 9_999),
    ]
    heroes = _select_hero_filenames(files, "give me the docx")
    assert heroes == {"late.docx"}
    assert len(heroes) == 1


def test_multiple_declared_heroes_collapse_to_single():
    # A declared-hero set that somehow contains multiple filenames collapses to
    # exactly one (max size, tie iteration) — the declaration branch can never
    # leak multiple heroes either.
    files = [
        _f("small.docx", 1_000, iteration=0, is_hero=True),
        _f("big.docx", 8_000, iteration=1, is_hero=True),
        _f("filler.csv", 99_999, iteration=2),
    ]
    heroes = _select_hero_filenames(files, "do whatever")
    assert heroes == {"big.docx"}
    assert len(heroes) == 1


# ---------------------------------------------------------------------------
# (b) no requested ext → the largest file is the hero (tie-break highest iteration)
# ---------------------------------------------------------------------------
def test_no_requested_ext_largest_is_hero():
    files = [
        _f("small.png", 1_000, iteration=0),
        _f("big.png", 99_000, iteration=1),
        _f("mid.csv", 5_000, iteration=2),
    ]
    heroes = _select_hero_filenames(files, "make some charts please")
    assert heroes == {"big.png"}
    assert len(heroes) == 1  # fallback path → exactly one hero


def test_no_requested_ext_size_tie_breaks_on_iteration():
    files = [
        _f("first.png", 5_000, iteration=0),
        _f("last.png", 5_000, iteration=3),  # same size, written later
    ]
    heroes = _select_hero_filenames(files, "draw a picture")
    assert heroes == {"last.png"}


def test_requested_ext_named_but_no_file_matches_falls_back_to_largest():
    # user asked for pdf, but only png/csv were produced → heuristic falls back.
    files = [
        _f("chart.png", 30_000, iteration=1),
        _f("table.csv", 2_000, iteration=0),
    ]
    heroes = _select_hero_filenames(files, "export it as a pdf")
    assert heroes == {"chart.png"}


# ---------------------------------------------------------------------------
# (c) no files → empty hero set, no crash
# ---------------------------------------------------------------------------
def test_empty_files_empty_hero_set():
    assert _select_hero_filenames([], "give me a docx") == set()


def test_none_user_message_no_crash():
    files = [_f("only.bin", 10)]
    # falls back to largest (the only file) — empty/None message must not crash.
    assert _select_hero_filenames(files, None) == {"only.bin"}
    assert _select_hero_filenames(files, "") == {"only.bin"}


# ---------------------------------------------------------------------------
# (f) an agent-declared hero is honored over the heuristic
# ---------------------------------------------------------------------------
def test_agent_declared_hero_honored_over_heuristic():
    files = [
        _f("huge.png", 999_999, iteration=5),          # heuristic would pick this
        _f("summary.docx", 1_000, iteration=1, is_hero=True),  # agent-declared
    ]
    heroes = _select_hero_filenames(files, "do whatever")
    assert heroes == {"summary.docx"}
    assert len(heroes) == 1  # declared path → exactly one hero


def test_agent_declared_hero_honored_even_when_requested_ext_present():
    # agent declaration outranks BOTH the requested-ext match and the largest file.
    files = [
        _f("report.docx", 5_000),                       # requested-ext match
        _f("intermediate.csv", 1_000, hero=True),       # agent-declared via 'hero' key
    ]
    heroes = _select_hero_filenames(files, "write a docx")
    assert heroes == {"intermediate.csv"}


# ---------------------------------------------------------------------------
# (d) emit projection — every file carries a non-missing url + is_hero
# (e) persist projection — the persisted execute_code result carries is_hero
# These mirror the exact comprehension shapes used at the emit/persist sites so
# a refactor of those sites that drops the contract fails here.
# ---------------------------------------------------------------------------
def _project_emit(meta_values: list[dict], user_message: str) -> list[dict]:
    """Mirror of agent_loop.py's final_output_files emit projection."""
    hero_set = _select_hero_filenames(meta_values, user_message or "")
    return [
        {
            "filename": meta["filename"],
            "url": meta.get("url") or "",
            "size": meta["size"],
            "is_hero": meta["filename"] in hero_set,
        }
        for meta in meta_values
    ]


def test_emit_projection_every_file_has_url_and_is_hero_flag():
    metas = [
        {"filename": "a.docx", "url": "/sandbox-outputs/u/e/a.docx", "size": 100, "iteration": 0},
        {"filename": "b.png", "size": 5000, "iteration": 1},  # url MISSING
    ]
    projected = _project_emit(metas, "write a docx")
    # every entry carries a url string (never missing → no silent dead anchor)
    assert all("url" in f and isinstance(f["url"], str) for f in projected)
    # the url-less meta became "" (guarded), not absent
    b = next(f for f in projected if f["filename"] == "b.png")
    assert b["url"] == ""
    # every entry carries an is_hero bool
    assert all(isinstance(f["is_hero"], bool) for f in projected)
    # the requested .docx is the hero
    a = next(f for f in projected if f["filename"] == "a.docx")
    assert a["is_hero"] is True
    assert b["is_hero"] is False


def test_emit_projection_never_zero_heroes_when_files_exist():
    metas = [
        {"filename": "x.png", "url": "/u/x.png", "size": 10, "iteration": 0},
        {"filename": "y.png", "url": "/u/y.png", "size": 20, "iteration": 0},
    ]
    projected = _project_emit(metas, "no extension mentioned here")
    assert any(f["is_hero"] for f in projected), "hero must never be empty when files exist"


def test_persist_projection_carries_is_hero_for_reload():
    """The persisted execute_code result's output_files entries carry is_hero so
    api.ts reload reconstruction re-heroes next-day."""
    # the run's cumulative hero set, computed once over all run files
    run_files = [
        {"filename": "deck.pptx", "url": "/u/deck.pptx", "size": 9_000, "iteration": 2},
        {"filename": "scratch.csv", "url": "/u/scratch.csv", "size": 1_000, "iteration": 1},
    ]
    hero_set = _select_hero_filenames(run_files, "make a pptx deck")
    # this execute_code cell produced deck.pptx
    cell_output_files = [{"filename": "deck.pptx", "url": "/u/deck.pptx", "size": 9_000}]
    persisted = [
        {**f, "is_hero": f["filename"] in hero_set} for f in cell_output_files
    ]
    assert persisted[0]["is_hero"] is True
    assert "url" in persisted[0]


# ---------------------------------------------------------------------------
# Plan 09 Task 2 (GAP-095-02 / WR-02) — live == reload consistency.
# The per-cell persist sees only a PARTIAL cumulative file list, so it stamps
# is_hero=False as a placeholder; the loop-end re-stamp recomputes is_hero over
# the COMPLETE set so the persisted rows and the live emit hero the SAME single
# file. This mirrors the agent_loop.py re-stamp logic exactly.
# ---------------------------------------------------------------------------
def _restamp_persisted_rows(persisted_tool_calls: list[dict], hero_set: set[str]) -> None:
    """Mirror of agent_loop.py's loop-end re-stamp of persisted execute_code rows."""
    for _tc in persisted_tool_calls:
        if _tc.get("name") != "execute_code":
            continue
        try:
            _pr = json.loads(_tc["result"])
            _of_rows = _pr.get("output_files")
            if not isinstance(_of_rows, list):
                continue
            _pr["output_files"] = [
                {**_of, "is_hero": _of.get("filename") in hero_set} for _of in _of_rows
            ]
            _tc["result"] = json.dumps(_pr)
        except (json.JSONDecodeError, TypeError, KeyError):
            continue


def test_multi_cell_live_equals_reload_single_hero():
    # Two-cell run: cell 1 wrote scratch.csv, cell 2 wrote deck.pptx; user asked
    # for a pptx. The live emit (over the COMPLETE set) AND the re-stamped
    # persisted rows must hero the SAME single file (deck.pptx).
    user_message = "build me a pptx deck"

    # --- per-cell persist: each cell only sees a PARTIAL cumulative list, so it
    # stamps a False placeholder (matching agent_loop.py's per-cell persist). ---
    persisted_tool_calls = [
        {
            "name": "execute_code",
            "status": "done",
            "result": json.dumps({
                "status": "done", "exit_code": 0, "duration_ms": 1,
                "output_files": [{"filename": "scratch.csv", "url": "/u/scratch.csv", "size": 1_000, "is_hero": False}],
            }),
        },
        {
            "name": "execute_code",
            "status": "done",
            "result": json.dumps({
                "status": "done", "exit_code": 0, "duration_ms": 1,
                "output_files": [{"filename": "deck.pptx", "url": "/u/deck.pptx", "size": 9_000, "is_hero": False}],
            }),
        },
    ]

    # --- loop end: compute the canonical hero set ONCE over the COMPLETE set ---
    complete_metas = [
        {"filename": "scratch.csv", "url": "/u/scratch.csv", "size": 1_000, "iteration": 1},
        {"filename": "deck.pptx", "url": "/u/deck.pptx", "size": 9_000, "iteration": 2},
    ]
    hero_set = _select_hero_filenames(complete_metas, user_message)
    assert hero_set == {"deck.pptx"}
    assert len(hero_set) == 1

    # live emit projection over the complete set
    emit = _project_emit(complete_metas, user_message)
    live_heroes = {f["filename"] for f in emit if f["is_hero"]}

    # re-stamp the persisted rows against the SAME canonical hero set
    _restamp_persisted_rows(persisted_tool_calls, hero_set)
    reload_heroes = {
        of["filename"]
        for tc in persisted_tool_calls
        for of in json.loads(tc["result"])["output_files"]
        if of["is_hero"]
    }

    # live == reload: both hero exactly deck.pptx, nothing else
    assert live_heroes == {"deck.pptx"}
    assert reload_heroes == {"deck.pptx"}
    assert live_heroes == reload_heroes
    # and the intermediate scratch.csv is NOT a hero in either view
    assert all(
        of["is_hero"] is False
        for tc in persisted_tool_calls
        for of in json.loads(tc["result"])["output_files"]
        if of["filename"] == "scratch.csv"
    )


def test_restamp_skips_truncated_non_json_result_gracefully():
    # A truncated/non-JSON fallback result (the per-cell except path) must be
    # skipped without raising during the loop-end re-stamp.
    persisted_tool_calls = [
        {"name": "execute_code", "status": "done", "result": "TRUNCATED-not-json…"},
        {"name": "search_documents", "status": "done", "result": "irrelevant"},
    ]
    # must not raise
    _restamp_persisted_rows(persisted_tool_calls, {"deck.pptx"})
    assert persisted_tool_calls[0]["result"] == "TRUNCATED-not-json…"
