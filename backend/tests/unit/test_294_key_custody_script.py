"""Phase 294-01 Task 4 (N5 / T-294-34) — ``scripts/local-provider-key-custody.py``.

The optional real-key swap for the live forced failures (VALIDATION F1 / F2 extra) saves a stored
provider key to a file OUTSIDE the repository and restores it afterwards. It may touch only the two
allowlisted columns, binds every value as ``$1``, never prints a value, warns when a value is not
an ``enc:v1:`` envelope, refuses a target inside the repo, and its DSN is hard-coded local.
"""
from __future__ import annotations

import importlib.util
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "local-provider-key-custody.py"
CIPHER = "enc:v1:FAKECIPHERTEXT294-never-printed"
PLAIN = "sk-or-PLAINTEXT294-never-printed"


def _load():
    spec = importlib.util.spec_from_file_location("local_provider_key_custody", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class _FakeConn:
    def __init__(self, value):
        self.value = value
        self.calls: list[tuple[str, str, tuple]] = []
        self.closed = False

    async def fetchval(self, sql, *args):
        self.calls.append(("fetchval", sql, args))
        return self.value

    async def execute(self, sql, *args):
        self.calls.append(("execute", sql, args))
        self.value = args[0]
        return "UPDATE 1"

    async def close(self):
        self.closed = True


@pytest.fixture
def custody(monkeypatch):
    mod = _load()
    conn = _FakeConn(CIPHER)

    async def _connect():
        return conn

    monkeypatch.setattr(mod, "_connect", _connect)
    return mod, conn


def test_the_dsn_is_hard_coded_local():
    mod = _load()
    assert mod.DSN == "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    src = SCRIPT.read_text(encoding="utf-8")
    assert "os.getenv" not in src and "os.environ" not in src


def test_save_writes_the_value_and_prints_nothing_of_it(custody, tmp_path, capsys):
    mod, conn = custody
    target = tmp_path / "or.key"
    assert mod.main(["save", "--column", "openrouter_api_key", "--to", str(target)]) == 0
    assert target.read_text(encoding="utf-8") == CIPHER
    (op, sql, args) = conn.calls[0]
    assert op == "fetchval"
    assert sql == "SELECT openrouter_api_key FROM public.app_settings WHERE id = $1"
    assert args == ("global",)
    out = capsys.readouterr()
    assert CIPHER not in out.out + out.err and "FAKECIPHER" not in out.out + out.err
    assert conn.closed


def test_restore_binds_the_value_as_a_parameter(custody, tmp_path, capsys):
    mod, conn = custody
    source = tmp_path / "oai.key"
    source.write_text(CIPHER, encoding="utf-8")
    assert mod.main(["restore", "--column", "openai_api_key", "--from", str(source)]) == 0
    (op, sql, args) = conn.calls[-1]
    assert op == "execute"
    assert sql == "UPDATE public.app_settings SET openai_api_key = $1 WHERE id = $2"
    assert args == (CIPHER, "global")
    out = capsys.readouterr()
    assert "FAKECIPHER" not in out.out + out.err


@pytest.mark.parametrize("column", ["rerank_api_key", "openrouter_api_key; DROP TABLE x", "llm_providers"])
def test_only_the_two_columns_are_accepted(custody, tmp_path, column):
    mod, conn = custody
    with pytest.raises(SystemExit) as exc:
        mod.main(["save", "--column", column, "--to", str(tmp_path / "x")])
    assert exc.value.code == 2
    assert conn.calls == []


def test_a_non_envelope_value_warns_without_printing_it(monkeypatch, tmp_path, capsys):
    mod = _load()
    conn = _FakeConn(PLAIN)

    async def _connect():
        return conn

    monkeypatch.setattr(mod, "_connect", _connect)
    assert mod.main(["save", "--column", "openrouter_api_key", "--to", str(tmp_path / "k")]) == 0
    out = capsys.readouterr()
    assert "enc:v1:" in out.err and "WARNING" in out.err
    assert "PLAINTEXT294" not in out.out + out.err


@pytest.mark.parametrize("rel", ["scratch-294.key", "backend/k.key", ".planning/k.key"])
def test_a_target_inside_the_repository_is_refused(custody, rel):
    mod, conn = custody
    with pytest.raises(SystemExit) as exc:
        mod.main(["save", "--column", "openai_api_key", "--to", str(ROOT / rel)])
    assert exc.value.code == 2
    assert conn.calls == []
    assert not (ROOT / rel).exists()


def test_restore_refuses_a_source_inside_the_repository(custody):
    mod, conn = custody
    with pytest.raises(SystemExit) as exc:
        mod.main(["restore", "--column", "openai_api_key", "--from", str(ROOT / "README.md")])
    assert exc.value.code == 2
    assert conn.calls == []
