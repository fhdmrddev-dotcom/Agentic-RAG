"""Sandbox Docker container re-attach verification (Phase 077 D-077-04/05/06).

Tests that SandboxSessionManager.get_or_create(thread_id):
  1. Creates a new container with name ``sandbox-{thread_id[:12]}`` on first call
  2. Re-attaches to the SAME container when _sessions dict is cleared (worker bounce)
  3. Falls back to fresh creation when no container exists (normal cold start)

Requires: Docker daemon running, SANDBOX_ENABLED=true in environment.
Does NOT require Redis or Postgres.

The test exercises the production code path in
``backend/app/services/sandbox_service.py`` -- specifically the
``_find_existing_container`` logic added in Plan 01 (D-077-05) and the
``get_or_create`` re-attach branch.
"""

from __future__ import annotations

import os
from unittest.mock import patch
from uuid import uuid4

import pytest


# ---------------------------------------------------------------------------
# Docker + SANDBOX_ENABLED availability guards
# ---------------------------------------------------------------------------

def _docker_available() -> bool:
    """Check if Docker daemon is reachable."""
    try:
        import docker

        client = docker.from_env()
        client.ping()
        return True
    except Exception:
        return False


DOCKER_AVAILABLE = _docker_available()

pytestmark = [
    pytest.mark.skipif(
        not DOCKER_AVAILABLE,
        reason="Docker daemon not reachable; skipping sandbox re-attach tests",
    ),
    pytest.mark.skipif(
        os.environ.get("SANDBOX_ENABLED", "false").lower() != "true",
        reason="SANDBOX_ENABLED not true; skipping sandbox tests",
    ),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _container_exists(container_name: str) -> bool:
    """Check if a Docker container with the given name exists."""
    import docker
    from docker.errors import NotFound

    try:
        client = docker.from_env()
        client.containers.get(container_name)
        return True
    except NotFound:
        return False


def _get_container_id(container_name: str) -> str | None:
    """Get the full container ID for a named container, or None."""
    import docker
    from docker.errors import NotFound

    try:
        client = docker.from_env()
        container = client.containers.get(container_name)
        return container.id
    except NotFound:
        return None


def _remove_container(container_name: str) -> None:
    """Force-remove a Docker container by name. No-op if not found."""
    import docker
    from docker.errors import NotFound

    try:
        client = docker.from_env()
        container = client.containers.get(container_name)
        container.remove(force=True)
    except NotFound:
        pass
    except Exception as e:
        print(f"Warning: failed to remove container {container_name}: {e}")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def unique_thread_id():
    """Generate a unique thread_id for test isolation."""
    return str(uuid4())


@pytest.fixture(autouse=True)
def _mock_evict_expired():
    """Bypass _evict_expired to avoid importing app.config.settings.

    The _evict_expired method imports ``app.config.settings`` which requires
    a full .env / Pydantic Settings load. We mock it to a no-op since
    TTL eviction is not under test here -- container re-attach is.
    """
    with patch(
        "app.services.sandbox_service.SandboxSessionManager._evict_expired",
        return_value=None,
    ):
        yield


@pytest.fixture
def sandbox_cleanup(unique_thread_id):
    """Ensure sandbox container and session state are cleaned up after test."""
    yield
    # Post-test cleanup
    from app.services.sandbox_service import (
        _last_used,
        _sessions,
        sandbox_manager,
    )

    container_name = f"sandbox-{unique_thread_id[:12]}"

    # Close session if it exists in the manager
    try:
        sandbox_manager.close_session(unique_thread_id)
    except Exception:
        pass

    # Clear module-level dicts
    _sessions.pop(unique_thread_id, None)
    _last_used.pop(unique_thread_id, None)

    # Force-remove the Docker container
    _remove_container(container_name)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_reattach_to_existing_container(unique_thread_id, sandbox_cleanup):
    """After clearing _sessions (simulating worker bounce), get_or_create
    finds the existing Docker container and re-attaches to it.

    The container ID should be the SAME before and after the _sessions clear,
    proving that the _find_existing_container logic works correctly.
    """
    from app.services.sandbox_service import (
        _last_used,
        _sessions,
        sandbox_manager,
    )

    container_name = f"sandbox-{unique_thread_id[:12]}"

    # Step 1: Create a new sandbox session (creates a new Docker container)
    sandbox_manager.get_or_create(unique_thread_id)

    # Step 2: Verify session exists in memory
    assert unique_thread_id in _sessions, (
        "Expected thread_id in _sessions after get_or_create"
    )

    # Step 3: Get the original container ID from Docker
    original_container_id = _get_container_id(container_name)
    assert original_container_id is not None, (
        f"Container {container_name} should exist after get_or_create"
    )

    # Step 4: Simulate worker bounce -- clear in-memory state
    del _sessions[unique_thread_id]
    _last_used.pop(unique_thread_id, None)

    # Step 5: Verify session is gone from memory
    assert unique_thread_id not in _sessions, (
        "Expected thread_id NOT in _sessions after simulated bounce"
    )

    # Step 6: Call get_or_create again (should re-attach to existing container)
    sandbox_manager.get_or_create(unique_thread_id)

    # Step 7: Verify session is back in memory
    assert unique_thread_id in _sessions, (
        "Expected thread_id in _sessions after re-attach"
    )

    # Step 8: Verify it's the SAME container (same container ID)
    reattached_container_id = _get_container_id(container_name)
    assert reattached_container_id is not None, (
        f"Container {container_name} should still exist after re-attach"
    )
    assert reattached_container_id == original_container_id, (
        f"Container ID mismatch: original={original_container_id[:12]}, "
        f"re-attached={reattached_container_id[:12]}. "
        f"Re-attach should reuse the SAME container, not create a new one."
    )


def test_fresh_creation_when_no_container(unique_thread_id, sandbox_cleanup):
    """When no Docker container exists for the thread_id, get_or_create
    creates a fresh one with the correct name convention.
    """
    import docker
    from docker.errors import NotFound

    from app.services.sandbox_service import _sessions, sandbox_manager

    container_name = f"sandbox-{unique_thread_id[:12]}"

    # Step 1: Verify no container exists yet
    assert not _container_exists(container_name), (
        f"Container {container_name} should not exist before test"
    )

    # Step 2: Create fresh session
    sandbox_manager.get_or_create(unique_thread_id)

    # Step 3: Verify container now exists and is running
    client = docker.from_env()
    try:
        container = client.containers.get(container_name)
        assert container.status == "running", (
            f"Expected container status='running', got '{container.status}'"
        )
    except NotFound:
        pytest.fail(
            f"Container {container_name} should exist after fresh get_or_create"
        )

    # Step 4: Verify session is in memory
    assert unique_thread_id in _sessions, (
        "Expected thread_id in _sessions after fresh creation"
    )


def test_find_existing_container_returns_none_for_missing():
    """_find_existing_container returns None when no container exists."""
    from app.services.sandbox_service import sandbox_manager

    nonexistent_thread_id = str(uuid4())
    result = sandbox_manager._find_existing_container(nonexistent_thread_id)
    assert result is None, (
        f"Expected None for nonexistent container, got {result}"
    )


def test_find_existing_container_returns_id_for_running(
    unique_thread_id, sandbox_cleanup
):
    """_find_existing_container returns the container ID when a running
    container with the expected name exists.
    """
    import docker

    from app.services.sandbox_service import sandbox_manager

    container_name = f"sandbox-{unique_thread_id[:12]}"

    # Create a container manually using Docker SDK (not via sandbox_manager)
    client = docker.from_env()
    container = client.containers.run(
        "python:3.11-slim",
        command="sleep 600",
        name=container_name,
        detach=True,
        remove=False,
    )

    try:
        # Verify _find_existing_container finds it
        found_id = sandbox_manager._find_existing_container(unique_thread_id)
        assert found_id is not None, (
            f"Expected to find container {container_name}, got None"
        )
        assert found_id == container.id, (
            f"Container ID mismatch: expected={container.id[:12]}, got={found_id[:12]}"
        )
    finally:
        # Cleanup the manually created container
        try:
            container.remove(force=True)
        except Exception:
            pass
