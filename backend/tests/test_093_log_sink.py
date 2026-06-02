"""Phase 093 D-20 — backend file log-sink: redaction + opt-in + idempotency.

Proves the ``logging_sink.install_file_log_sink`` contract:
  * opt-in — no ``LOG_FILE_PATH``/``BACKEND_LOG_FILE`` env var → returns None,
    installs NO root handler (byte-identical pre-093-06 console-only logging).
  * a RotatingFileHandler mirrors logging calls to the configured file when set.
  * secrets (sk-… keys, Authorization/Bearer values, JWT-shaped tokens, the live
    VALUES of provider key env vars) are REDACTED before reaching the file.
  * idempotent — two calls add exactly ONE sink handler.

Each test cleans up the sink handler it installs (fixture teardown) so the suite
stays isolated — no leaked handler bleeds the next test's log lines to disk.

asyncio_mode = auto (backend/pytest.ini); these are plain sync tests.
"""
from __future__ import annotations

import logging

import pytest

from app.services.logging_sink import install_file_log_sink


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def _sink_handlers() -> list[logging.Handler]:
    return [
        h
        for h in logging.getLogger().handlers
        if getattr(h, "_gsd_093_sink", False)
    ]


@pytest.fixture
def clean_sink(monkeypatch):
    """Ensure no env var leaks in, and remove any sink handler on teardown."""
    monkeypatch.delenv("LOG_FILE_PATH", raising=False)
    monkeypatch.delenv("BACKEND_LOG_FILE", raising=False)
    root = logging.getLogger()
    pre_level = root.level
    yield
    for handler in _sink_handlers():
        handler.close()
        root.removeHandler(handler)
    root.setLevel(pre_level)


def test_opt_in_no_env_returns_none_and_installs_no_handler(clean_sink):
    """Unset env var → None, and the root logger gains no sink handler."""
    before = len(logging.getLogger().handlers)
    result = install_file_log_sink()
    assert result is None
    assert _sink_handlers() == []
    assert len(logging.getLogger().handlers) == before


def test_installs_rotating_file_handler_when_env_set(clean_sink, tmp_path, monkeypatch):
    """LOG_FILE_PATH set → handler added, parent dir created, resolved path returned."""
    logfile = tmp_path / "logs" / "backend.log"
    monkeypatch.setenv("LOG_FILE_PATH", str(logfile))

    result = install_file_log_sink()

    assert result == str(logfile)
    assert logfile.parent.is_dir()
    assert len(_sink_handlers()) == 1

    logging.getLogger("test093").info("a clean diagnostic line: runs.usage missing")
    for h in _sink_handlers():
        h.flush()
    contents = _read(str(logfile))
    assert "runs.usage missing" in contents  # the signal the re-UAT greps for


def test_redacts_openai_style_key(clean_sink, tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    secret = "sk-abc123def456ghi789jkl012"
    logging.getLogger("test093").error("auth failed with key %s here", secret)
    for h in _sink_handlers():
        h.flush()

    contents = _read(str(tmp_path / "backend.log"))
    assert secret not in contents
    assert "REDACTED" in contents


def test_redacts_authorization_bearer_token(clean_sink, tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    token = "abcDEF1234567890token"
    logging.getLogger("test093").warning("Authorization: Bearer %s", token)
    for h in _sink_handlers():
        h.flush()

    contents = _read(str(tmp_path / "backend.log"))
    assert token not in contents
    assert "REDACTED" in contents


def test_redacts_jwt_shaped_token(clean_sink, tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payloadpart.signaturepart"
    logging.getLogger("test093").info("service token = %s", jwt)
    for h in _sink_handlers():
        h.flush()

    contents = _read(str(tmp_path / "backend.log"))
    assert jwt not in contents
    assert "REDACTED-JWT" in contents


def test_redacts_live_provider_env_value(clean_sink, tmp_path, monkeypatch):
    """A literal provider key env VALUE appearing in a log line is redacted."""
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    # A value that does NOT match the sk-/JWT shape — only the env-value pass catches it.
    env_value = "minimax-live-value-9f8e7d6c5b4a"
    monkeypatch.setenv("MINIMAX_API_KEY", env_value)
    install_file_log_sink()

    logging.getLogger("test093").error("calling minimax with %s", env_value)
    for h in _sink_handlers():
        h.flush()

    contents = _read(str(tmp_path / "backend.log"))
    assert env_value not in contents
    assert "REDACTED-KEY" in contents


def test_clean_record_is_not_mangled(clean_sink, tmp_path, monkeypatch):
    """A record with no secret pattern reaches the file verbatim (only redaction)."""
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    msg = "sub-agent fell back to gpt-4o (no model threaded)"
    logging.getLogger("test093").warning(msg)
    for h in _sink_handlers():
        h.flush()

    contents = _read(str(tmp_path / "backend.log"))
    assert msg in contents
    assert "REDACTED" not in contents


def test_idempotent_second_call_adds_no_second_handler(clean_sink, tmp_path, monkeypatch):
    logfile = tmp_path / "backend.log"
    monkeypatch.setenv("LOG_FILE_PATH", str(logfile))

    first = install_file_log_sink()
    second = install_file_log_sink()

    assert first == second == str(logfile)
    assert len(_sink_handlers()) == 1
