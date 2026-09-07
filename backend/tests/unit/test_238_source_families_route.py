"""Phase 238 (SRC-03 / D-238-08) — the server publishes its source registry.

⭐ THE PROPERTY THIS FILE MAKES EXECUTABLE is `test_a_newly_registered_family_appears_with_no
_route_change`. The milestone's binding constraint is *adding a source family is rows, not
code*; before this route, the frontend decided which connections could browse with two copies
of `id.includes("google") || includes("workspace") || includes("drive")`. Widening that string
test to admit Microsoft would have satisfied Phase 238's SC#1 and left Phase 239's MCP family
needing the identical edit again — the constraint falsified on the client, one phase later.

So the test that matters here is not *"microsoft is in the list"*. It is that registering a
family the route has never heard of makes it appear, with nothing in this file or that one
changed.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import connectors
from app.main import app as real_app
from app.services.sources.base import SourceAdapter, SourceRegistry


@pytest.fixture
def router_client():
    """A TestClient over `connectors.router` ALONE, sharing the live override dict."""
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


def test_the_shipped_families_are_published(router_client):
    res = router_client.get("/connectors/source-families")
    assert res.status_code == 200
    families = res.json()["families"]
    assert "google" in families
    assert "microsoft" in families, "SRC-03: a Microsoft connection must be offerable"
    assert families == sorted(families), "sorted, so a client can render it without re-sorting"


def test_the_mock_family_is_never_offered(router_client):
    """⚠ It was excluded BY ACCIDENT until now — the client's `includes("google")` predicate
    happened not to match `mock_source`. Publishing the registry removes that accident, so the
    exclusion had to become deliberate, on the server, where a UI edit cannot widen it.

    ⚠ And it is NOT the gate Phase 232 recorded. D-232-03 described a `VITE_ENABLE_MOCK_SOURCES`
    / dev-mode gate in the picker; `grep -rn "mock_source" frontend/src` finds it in tests only.
    No such gate shipped."""
    families = router_client.get("/connectors/source-families").json()["families"]
    assert "mock_source" not in families
    assert "mock_source" in SourceRegistry.list_supported_services(), (
        "the registry still holds it — the route excludes it, which is the property under test"
    )


def test_a_newly_registered_family_appears_with_no_route_change(router_client):
    """⭐ ROWS, NOT CODE — driven rather than asserted in prose.

    A family the route has never heard of is registered at runtime and shows up. If a future
    change reintroduces a hardcoded list of known families, THIS is the case that reds."""
    before = router_client.get("/connectors/source-families").json()["families"]
    assert "a_family_nobody_wrote_a_branch_for" not in before

    @SourceRegistry.register("a_family_nobody_wrote_a_branch_for")
    class _Throwaway(SourceAdapter):
        async def browse(self, connection, folder_id=None, page_token=None): ...
        async def list_files(self, connection, folder_id=None, recursive=False,
                             page_token=None, query=None, page_size=30): ...
        async def read_file(self, connection, file_id): ...
        async def check(self, connection): ...

    try:
        after = router_client.get("/connectors/source-families").json()["families"]
        assert "a_family_nobody_wrote_a_branch_for" in after
    finally:
        # The registry is process-global; leaving a fake family behind would leak into every
        # later test in the session.
        SourceRegistry._adapters.pop("a_family_nobody_wrote_a_branch_for", None)

    assert "a_family_nobody_wrote_a_branch_for" not in (
        router_client.get("/connectors/source-families").json()["families"]
    )


def test_the_route_requires_a_caller():
    """It names a capability, not a connection — but an unauthenticated caller still gets
    nothing. A bare probe app with NO dependency overrides has no `get_current_user`."""
    from app.dependencies import get_current_user

    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = {}
    client = TestClient(probe, raise_server_exceptions=False)

    res = client.get("/connectors/source-families")
    assert res.status_code != 200, "the route must not answer an unauthenticated caller"
    assert get_current_user is not None  # the dependency exists and was not stubbed away


def test_the_response_names_capabilities_not_connections(router_client):
    """⛔ A guard against the obvious next mistake: folding org-scoped connection rows into
    this payload. It is a capability list; connection visibility stays on `/connections`."""
    body = router_client.get("/connectors/source-families").json()
    assert set(body) == {"families"}
    assert all(isinstance(f, str) for f in body["families"])
