"""296 review BE-WR-05 — ``run-296-board.py`` refuses a non-local API host or Supabase host.

* The board's write modes POST threads, workflow definitions and live provider runs to
  ``kit.base_url()`` (``EVAL_BASE_URL``). No guard checked that host, so an ``EVAL_BASE_URL``
  left pointing at staging/prod received real runs carrying a token minted for the local user.
* ``conc_probe.assert_localhost_only`` was a substring ``search`` for ``localhost|127.0.0.1``, so
  ``https://<prod>.supabase.co/?x=localhost`` passed it.

The pins: both checks read the PARSED host and accept exactly localhost / 127.0.0.1 / ::1, and
``main()`` refuses a non-local ``EVAL_BASE_URL`` before it opens the DB or makes any request.
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys

import pytest

_SCRIPTS = pathlib.Path(__file__).resolve().parents[3] / "scripts"


def _load(name: str, file: str):
    if str(_SCRIPTS) not in sys.path:
        sys.path.insert(0, str(_SCRIPTS))
    spec = importlib.util.spec_from_file_location(name, _SCRIPTS / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


@pytest.fixture(scope="module")
def board():
    return _load("run_296_board_under_test", "run-296-board.py")


LOCAL = ["http://127.0.0.1:54321", "http://localhost:8000", "http://[::1]:8000", "http://LOCALHOST:8000/"]
REMOTE = [
    "https://abcd.supabase.co/?x=localhost",
    "https://abcd.supabase.co/localhost",
    "https://127.0.0.1.attacker.example",
    "https://localhost.attacker.example:8000",
    "https://user:127.0.0.1@prod.example.com",
    "https://api.example.com",
    "",
]


@pytest.mark.parametrize("url", REMOTE)
def test_supabase_guard_refuses_a_non_local_host(board, monkeypatch, url):
    monkeypatch.setenv("SUPABASE_URL", url)
    with pytest.raises(SystemExit):
        board.kit.assert_localhost_only()


@pytest.mark.parametrize("url", LOCAL)
def test_supabase_guard_accepts_a_local_host(board, monkeypatch, url):
    monkeypatch.setenv("SUPABASE_URL", url)
    board.kit.assert_localhost_only()


def _drive_main(board, monkeypatch, base_url):
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:54321")
    monkeypatch.setenv("EVAL_BASE_URL", base_url)
    monkeypatch.setattr(board.kit, "load_env", lambda: None)
    monkeypatch.setattr(board.b273, "_assert_local_db", lambda: None)

    class _Reached(Exception):
        pass

    def _connect():
        raise _Reached("main() reached the DB")

    monkeypatch.setattr(board.kit, "connect_db", _connect)
    monkeypatch.setattr(sys, "argv", ["run-296-board.py", "--first-step"])
    return _Reached


@pytest.mark.parametrize("url", [u for u in REMOTE if u])
def test_main_refuses_a_non_local_eval_base_url_before_any_db_or_request(board, monkeypatch, url):
    reached = _drive_main(board, monkeypatch, url)
    with pytest.raises(SystemExit) as exc:
        try:
            board.main()
        except reached:
            pytest.fail(f"EVAL_BASE_URL={url!r} was not refused before the DB was opened")
    assert exc.value.code not in (0, None)


@pytest.mark.parametrize("url", ["http://127.0.0.1:8000", "http://localhost:8000", "http://[::1]:8000"])
def test_main_accepts_a_local_eval_base_url(board, monkeypatch, url):
    reached = _drive_main(board, monkeypatch, url)
    with pytest.raises(reached):
        board.main()
