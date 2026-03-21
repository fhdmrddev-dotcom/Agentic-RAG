"""
Shared pytest fixtures for backend tests.

Environment variables must be set before importing app modules because
pydantic-settings reads them at class instantiation time.
"""
import os

# Patch env before any app import so pydantic-settings doesn't fail
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("LLM_API_KEY", "test-llm-api-key")
os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGSMITH_PROJECT", "test-project")

from unittest.mock import MagicMock  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def _make_execute_result():
    """A simple result object with a .data attribute."""
    r = MagicMock()
    r.data = []
    return r


def _make_builder(execute_result):
    """A fluent-chainable Supabase query builder mock."""
    b = MagicMock()
    b.select.return_value = b
    b.insert.return_value = b
    b.update.return_value = b
    b.delete.return_value = b
    b.eq.return_value = b
    b.neq.return_value = b
    b.in_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.single.return_value = b
    b.maybe_single.return_value = b
    b.is_.return_value = b
    b.or_.return_value = b
    b.execute.return_value = execute_result
    b.execute.side_effect = None
    return b


def _make_supabase(builder, execute_result):
    """Top-level Supabase client mock."""
    sb = MagicMock()
    sb.table.return_value = builder
    sb.rpc.return_value = builder

    storage_bucket = MagicMock()
    storage_bucket.upload.return_value = MagicMock()
    storage_bucket.remove.return_value = MagicMock()
    sb.storage.from_.return_value = storage_bucket
    return sb


# Module-level singletons shared across tests (reset in autouse fixture)
_execute_result = _make_execute_result()
_builder = _make_builder(_execute_result)
_supabase = _make_supabase(_builder, _execute_result)

mock_user_data = {"id": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}

# ── Import app AFTER env vars are set ─────────────────────────────────────────

from app.main import app  # noqa: E402
from app.dependencies import get_current_user, get_supabase  # noqa: E402

app.dependency_overrides[get_current_user] = lambda: mock_user_data
app.dependency_overrides[get_supabase] = lambda: _supabase


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_mocks():
    """
    Reset all mocks before each test to prevent state leakage.
    Critically, this clears side_effect so one test's side_effect list
    doesn't cause StopIteration in the next test.
    """
    # Reset the execute result
    _execute_result.reset_mock()
    _execute_result.data = []

    # Reset the builder: clear call counts, side_effect, and return_value
    _builder.reset_mock()
    _builder.select.return_value = _builder
    _builder.insert.return_value = _builder
    _builder.update.return_value = _builder
    _builder.delete.return_value = _builder
    _builder.eq.return_value = _builder
    _builder.neq.return_value = _builder
    _builder.in_.return_value = _builder
    _builder.order.return_value = _builder
    _builder.limit.return_value = _builder
    _builder.single.return_value = _builder
    _builder.maybe_single.return_value = _builder
    _builder.is_.return_value = _builder
    _builder.or_.return_value = _builder
    _builder.execute.side_effect = None
    _builder.execute.return_value = _execute_result

    # Reset top-level supabase mock
    _supabase.reset_mock()
    _supabase.table.return_value = _builder
    _supabase.rpc.return_value = _builder

    yield

    # Post-test cleanup (optional, belt-and-suspenders)
    _builder.execute.side_effect = None


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_user():
    return mock_user_data


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def mock_execute_result():
    """Expose the shared execute result mock for per-test data configuration."""
    return _execute_result


@pytest.fixture
def mock_builder():
    """Expose the shared builder mock for side_effect configuration."""
    return _builder
