"""Unit tests for SandboxSessionManager in app.services.sandbox_service."""
import sys
from unittest.mock import MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clear_state():
    """Clear module-level session dicts after each test."""
    from app.services.sandbox_service import _sessions, _last_used
    _sessions.clear()
    _last_used.clear()


def _make_mock_session():
    session = MagicMock()
    session.open.return_value = None
    session.close.return_value = None
    return session


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestGetOrCreate:
    def teardown_method(self):
        _clear_state()

    def test_get_or_create_new_session(self):
        """When thread_id not in sessions, creates a new session and calls open()."""
        mock_session = _make_mock_session()
        with patch("llm_sandbox.InteractiveSandboxSession", return_value=mock_session):
            from app.services.sandbox_service import sandbox_manager
            result = sandbox_manager.get_or_create("thread-abc")

        assert result is mock_session
        mock_session.open.assert_called_once()

    def test_get_or_create_existing_session(self):
        """When thread_id already in sessions, returns same session without calling open() again."""
        mock_session = _make_mock_session()
        with patch("llm_sandbox.InteractiveSandboxSession", return_value=mock_session):
            from app.services.sandbox_service import sandbox_manager
            first = sandbox_manager.get_or_create("thread-abc")
            second = sandbox_manager.get_or_create("thread-abc")

        assert first is second
        # open() called only once (on creation, not on retrieval)
        mock_session.open.assert_called_once()


class TestCloseSession:
    def teardown_method(self):
        _clear_state()

    def test_close_session(self):
        """Removes session from dict and calls session.close()."""
        mock_session = _make_mock_session()
        with patch("llm_sandbox.InteractiveSandboxSession", return_value=mock_session):
            from app.services.sandbox_service import sandbox_manager, _sessions
            sandbox_manager.get_or_create("thread-xyz")
            assert "thread-xyz" in _sessions

            sandbox_manager.close_session("thread-xyz")

        assert "thread-xyz" not in _sessions
        mock_session.close.assert_called_once()

    def test_close_session_nonexistent(self):
        """Closing a non-existent thread_id is a no-op — raises no error."""
        from app.services.sandbox_service import sandbox_manager
        # Should not raise
        sandbox_manager.close_session("does-not-exist")

    def test_close_session_error_swallowed(self):
        """If session.close() raises, error is caught and session is still removed."""
        mock_session = _make_mock_session()
        mock_session.close.side_effect = RuntimeError("docker error")

        with patch("llm_sandbox.InteractiveSandboxSession", return_value=mock_session):
            from app.services.sandbox_service import sandbox_manager, _sessions
            sandbox_manager.get_or_create("thread-err")
            assert "thread-err" in _sessions

            # Should NOT raise despite close() raising
            sandbox_manager.close_session("thread-err")

        assert "thread-err" not in _sessions


class TestCloseAll:
    def teardown_method(self):
        _clear_state()

    def test_close_all(self):
        """Closes all open sessions and empties the dict."""
        mock_a = _make_mock_session()
        mock_b = _make_mock_session()
        sessions_created = [mock_a, mock_b]

        with patch("llm_sandbox.InteractiveSandboxSession", side_effect=sessions_created):
            from app.services.sandbox_service import sandbox_manager, _sessions
            sandbox_manager.get_or_create("thread-1")
            sandbox_manager.get_or_create("thread-2")
            assert len(_sessions) == 2

            sandbox_manager.close_all()

        assert len(_sessions) == 0
        mock_a.close.assert_called_once()
        mock_b.close.assert_called_once()


class TestLazyImportGuard:
    def test_lazy_import_guard(self):
        """sandbox_service module can be imported without llm_sandbox at module level."""
        import importlib
        import app.services.sandbox_service as mod

        # Verify the module does NOT have a top-level 'InteractiveSandboxSession' name
        # (it should only be imported inside functions)
        assert not hasattr(mod, "InteractiveSandboxSession"), (
            "InteractiveSandboxSession should not be imported at module level"
        )
