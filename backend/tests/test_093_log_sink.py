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
import os
from pathlib import Path

import pytest

from app.services.logging_sink import install_file_log_sink


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def _sink_file() -> str:
    """The actual file the installed sink handler writes to (per-PID name).

    Reads ``.baseFilename`` off the single installed sink handler so redaction
    tests assert against the real on-disk file, not the hardcoded configured name
    (which the per-PID rename no longer matches). Asserts exactly one sink handler.
    """
    handlers = _sink_handlers()
    assert len(handlers) == 1, f"expected exactly one sink handler, got {len(handlers)}"
    return handlers[0].baseFilename  # type: ignore[attr-defined]


def _sink_handlers() -> list[logging.Handler]:
    return [
        h
        for h in logging.getLogger().handlers
        if getattr(h, "_gsd_093_sink", False)
    ]


@pytest.fixture
def clean_sink(monkeypatch):
    """Ensure no env var leaks in, and remove any sink handler on setup + teardown.

    main.py installs the sink at IMPORT time when the ambient backend/.env carries
    LOG_FILE_PATH (the operator sets it to activate the D-20 sink for a live re-UAT).
    That import-time handler is present before any test runs, so the opt-in
    assertion (`_sink_handlers() == []`) must strip pre-existing sink handlers on
    SETUP too — otherwise the test is non-hermetic and fails purely because the
    developer's .env happens to set the var. (WR-03 / gap-closure review.)
    """
    monkeypatch.delenv("LOG_FILE_PATH", raising=False)
    monkeypatch.delenv("BACKEND_LOG_FILE", raising=False)
    root = logging.getLogger()
    pre_level = root.level
    for handler in _sink_handlers():  # strip any import-time sink handler
        handler.close()
        root.removeHandler(handler)
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
    """LOG_FILE_PATH set → handler added, parent dir created, resolved path returned.

    The resolved path is the per-PID variant of the configured file (backend.log →
    backend.<pid>.log) so each multi-worker process owns its own rotation target
    (Windows WinError-32 fix). We assert on the ACTUAL sink file, not the bare
    configured name — its parent dir (the configured ``logs/``) is still created.
    """
    logfile = tmp_path / "logs" / "backend.log"
    monkeypatch.setenv("LOG_FILE_PATH", str(logfile))

    result = install_file_log_sink()

    # Per-PID filename: same parent + stem + suffix, with the pid inserted.
    assert result is not None
    resolved = Path(result)
    assert resolved.parent == logfile.parent
    assert resolved.name == f"backend.{os.getpid()}.log"
    assert logfile.parent.is_dir()
    assert len(_sink_handlers()) == 1

    logging.getLogger("test093").info("a clean diagnostic line: runs.usage missing")
    for h in _sink_handlers():
        h.flush()
    contents = _read(result)  # read the actual sink file the handler writes to
    assert "runs.usage missing" in contents  # the signal the re-UAT greps for


def test_redacts_openai_style_key(clean_sink, tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    secret = "sk-abc123def456ghi789jkl012"
    logging.getLogger("test093").error("auth failed with key %s here", secret)
    for h in _sink_handlers():
        h.flush()

    contents = _read(_sink_file())
    assert secret not in contents
    assert "REDACTED" in contents


def test_redacts_authorization_bearer_token(clean_sink, tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    token = "abcDEF1234567890token"
    logging.getLogger("test093").warning("Authorization: Bearer %s", token)
    for h in _sink_handlers():
        h.flush()

    contents = _read(_sink_file())
    assert token not in contents
    assert "REDACTED" in contents


def test_redacts_jwt_shaped_token(clean_sink, tmp_path, monkeypatch):
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payloadpart.signaturepart"
    logging.getLogger("test093").info("service token = %s", jwt)
    for h in _sink_handlers():
        h.flush()

    contents = _read(_sink_file())
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

    contents = _read(_sink_file())
    assert env_value not in contents
    assert "REDACTED-KEY" in contents


def test_redacts_url_embedded_credentials(clean_sink, tmp_path, monkeypatch):
    """WR-03 — scheme://user:PASSWORD@host: redact the password, keep host visible."""
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    redis_pw = "SuperSecretRedisPw123"
    pg_pw = "pgPassw0rdLongEnough"
    logging.getLogger("test093").error(
        "redis at rediss://default:%s@cache.example.com:6379 and "
        "postgres postgresql://app:%s@db.example.com:5432/prod",
        redis_pw, pg_pw,
    )
    for h in _sink_handlers():
        h.flush()

    contents = _read(_sink_file())
    assert redis_pw not in contents
    assert pg_pw not in contents
    assert "REDACTED" in contents
    # host/scheme remain for diagnostics
    assert "cache.example.com" in contents
    assert "db.example.com" in contents


def test_redacts_dynamic_secret_named_env_value(clean_sink, tmp_path, monkeypatch):
    """WR-03 — a NEW secret-named env var (not in the explicit list) is redacted via the suffix scan."""
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    rerank_value = "rerank-future-key-1a2b3c4d5e6f"
    monkeypatch.setenv("RERANK_API_KEY", rerank_value)  # NOT in _SECRET_ENV_VARS
    install_file_log_sink()

    logging.getLogger("test093").error("rerank call used %s", rerank_value)
    for h in _sink_handlers():
        h.flush()

    contents = _read(_sink_file())
    assert rerank_value not in contents
    assert "REDACTED-KEY" in contents


def test_unwritable_path_returns_none_and_does_not_raise(clean_sink, tmp_path, monkeypatch):
    """WR-02 — an unopenable LOG_FILE_PATH degrades to console-only (None), never crashes startup."""
    # Make the parent a FILE so os.makedirs(parent) raises (portable across OSes).
    blocker = tmp_path / "blocker"
    blocker.write_text("i am a file, not a dir")
    monkeypatch.setenv("LOG_FILE_PATH", str(blocker / "sub" / "backend.log"))

    result = install_file_log_sink()  # must NOT raise

    assert result is None
    assert _sink_handlers() == []


def test_clean_record_is_not_mangled(clean_sink, tmp_path, monkeypatch):
    """A record with no secret pattern reaches the file verbatim (only redaction)."""
    monkeypatch.setenv("LOG_FILE_PATH", str(tmp_path / "backend.log"))
    install_file_log_sink()

    msg = "sub-agent fell back to gpt-4o (no model threaded)"
    logging.getLogger("test093").warning(msg)
    for h in _sink_handlers():
        h.flush()

    contents = _read(_sink_file())
    assert msg in contents
    assert "REDACTED" not in contents


def test_idempotent_second_call_adds_no_second_handler(clean_sink, tmp_path, monkeypatch):
    logfile = tmp_path / "backend.log"
    monkeypatch.setenv("LOG_FILE_PATH", str(logfile))

    first = install_file_log_sink()
    second = install_file_log_sink()

    # Both calls resolve to the SAME per-PID file (the idempotency guard returns the
    # already-resolved path on the second call) — proves no second handler is added.
    assert first is not None
    assert first == second == _sink_file()
    assert Path(first).name == f"backend.{os.getpid()}.log"
    assert len(_sink_handlers()) == 1
