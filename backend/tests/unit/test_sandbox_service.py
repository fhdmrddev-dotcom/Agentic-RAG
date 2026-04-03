"""Unit tests for SandboxSessionManager in app.services.sandbox_service."""
import os
import sys
import tempfile
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


# ---------------------------------------------------------------------------
# harvest_output_files tests
# ---------------------------------------------------------------------------

class TestHarvestOutputFiles:
    def teardown_method(self):
        _clear_state()

    def test_harvest_files_uploads_and_inserts(self):
        """Given session with files in /sandbox/output/, harvest_output_files copies them,
        uploads to storage, inserts DB rows, and returns file list with signed URLs."""
        from app.services.sandbox_service import harvest_output_files

        mock_session = MagicMock()

        # Make copy_from_runtime actually write a file to the provided tmpdir
        def fake_copy(src, dest):
            os.makedirs(dest, exist_ok=True)
            with open(os.path.join(dest, "chart.png"), "wb") as f:
                f.write(b"fake-png-data")

        mock_session.copy_from_runtime.side_effect = fake_copy

        mock_supabase = MagicMock()
        storage_bucket = MagicMock()
        storage_bucket.upload.return_value = MagicMock()
        storage_bucket.create_signed_url.return_value = {"signedURL": "https://example.com/signed/chart.png"}
        mock_supabase.storage.from_.return_value = storage_bucket

        table_mock = MagicMock()
        table_mock.insert.return_value = table_mock
        table_mock.execute.return_value = MagicMock()
        mock_supabase.table.return_value = table_mock

        result = harvest_output_files(
            session=mock_session,
            execution_id="exec-123",
            user_id="user-456",
            supabase=mock_supabase,
        )

        assert len(result) == 1
        assert result[0]["filename"] == "chart.png"
        assert result[0]["url"] == "https://example.com/signed/chart.png"
        assert result[0]["size"] == len(b"fake-png-data")

        # Verify storage upload was called
        storage_bucket.upload.assert_called_once()
        upload_args = storage_bucket.upload.call_args
        assert upload_args[0][0] == "user-456/exec-123/chart.png"

        # Verify DB insert was called
        mock_supabase.table.assert_called_with("sandbox_files")
        table_mock.insert.assert_called_once()
        insert_args = table_mock.insert.call_args[0][0]
        assert insert_args["execution_id"] == "exec-123"
        assert insert_args["user_id"] == "user-456"
        assert insert_args["filename"] == "chart.png"
        assert insert_args["storage_path"] == "user-456/exec-123/chart.png"
        assert insert_args["file_size"] == len(b"fake-png-data")

    def test_harvest_files_empty_output(self):
        """When copy_from_runtime raises, returns empty list without error."""
        from app.services.sandbox_service import harvest_output_files

        mock_session = MagicMock()
        mock_session.copy_from_runtime.side_effect = Exception("no such directory")

        mock_supabase = MagicMock()

        result = harvest_output_files(
            session=mock_session,
            execution_id="exec-empty",
            user_id="user-456",
            supabase=mock_supabase,
        )

        assert result == []
        # Storage and DB should NOT be called
        mock_supabase.storage.from_.assert_not_called()
        mock_supabase.table.assert_not_called()

    def test_harvest_files_storage_path_format(self):
        """Storage path follows {user_id}/{execution_id}/{filename} exactly."""
        from app.services.sandbox_service import harvest_output_files

        mock_session = MagicMock()

        def fake_copy(src, dest):
            os.makedirs(dest, exist_ok=True)
            with open(os.path.join(dest, "output.csv"), "wb") as f:
                f.write(b"col1,col2\n1,2\n")

        mock_session.copy_from_runtime.side_effect = fake_copy

        mock_supabase = MagicMock()
        storage_bucket = MagicMock()
        storage_bucket.upload.return_value = MagicMock()
        storage_bucket.create_signed_url.return_value = {"signedURL": "https://example.com/signed/output.csv"}
        mock_supabase.storage.from_.return_value = storage_bucket

        table_mock = MagicMock()
        table_mock.insert.return_value = table_mock
        table_mock.execute.return_value = MagicMock()
        mock_supabase.table.return_value = table_mock

        result = harvest_output_files(
            session=mock_session,
            execution_id="exec-789",
            user_id="user-abc",
            supabase=mock_supabase,
        )

        # Verify exact path format
        upload_args = storage_bucket.upload.call_args[0]
        assert upload_args[0] == "user-abc/exec-789/output.csv"

        assert len(result) == 1
        assert result[0]["filename"] == "output.csv"

        # Verify create_signed_url called with path and 3600 expiry
        storage_bucket.create_signed_url.assert_called_once_with(
            "user-abc/exec-789/output.csv", 3600
        )
