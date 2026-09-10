"""Phase 232 (SRC-01 / D-232-03) — Mock Source Adapter.

In-memory implementation of SourceAdapter that provides deterministic folder trees,
pagination tokens, and file payloads for testing and conformance verification.
Proves that a source family is data and registration, requiring no code outside this file.

Phase 238 (D-238-07 / SEED-253): every file here carries a REAL folder `path`. The fake is
the only adapter that can be made to state the contract unconditionally, so it is where the
"a path names a folder, never a filename" invariant is anchored.
"""

from __future__ import annotations

from typing import Any

from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceAdapter,
    SourceFile,
    SourceHealth,
    SourceNode,
    SourceRegistry,
)


@SourceRegistry.register("mock_source")
class MockSourceAdapter(SourceAdapter):
    """In-memory source adapter for tests and local development."""

    def __init__(self) -> None:
        self._folders: dict[str | None, list[SourceNode]] = {
            None: [
                SourceNode(id="mock-root", name="My Drive", kind="folder", has_children=True),
                SourceNode(id="mock-shared", name="Shared Drives", kind="folder", has_children=True),
            ],
            "mock-root": [
                SourceNode(id="folder-eng", name="Engineering", kind="folder", parent_id="mock-root", has_children=True),
                SourceNode(id="folder-prod", name="Product", kind="folder", parent_id="mock-root", has_children=True),
            ],
            "mock-shared": [
                SourceNode(
                    id="drive-team",
                    name="Team Operations",
                    kind="drive",
                    drive_id="drive-team",
                    parent_id="mock-shared",
                    has_children=True,
                ),
            ],
            "drive-team": [
                SourceNode(
                    id="folder-ops",
                    name="Q3 Runbooks",
                    kind="folder",
                    drive_id="drive-team",
                    parent_id="drive-team",
                    has_children=True,
                ),
            ],
            "folder-eng": [],
            "folder-prod": [],
            "folder-ops": [],
        }

        self._files: dict[str, list[SourceFile]] = {
            "folder-eng": [
                SourceFile(
                    id="file-eng-1",
                    name="architecture.pdf",
                    mime_type="application/pdf",
                    size=1024,
                    modified_at="2026-09-01T12:00:00Z",
                    path="/Engineering/architecture.pdf",
                ),
                SourceFile(
                    id="file-eng-2",
                    name="readme.txt",
                    mime_type="text/plain",
                    size=256,
                    modified_at="2026-09-02T12:00:00Z",
                    path="/Engineering/readme.txt",
                ),
            ],
            "folder-prod": [
                SourceFile(
                    id="file-prod-1",
                    name="roadmap.pdf",
                    mime_type="application/pdf",
                    size=2048,
                    modified_at="2026-09-03T12:00:00Z",
                    path="/Product/roadmap.pdf",
                ),
            ],
            "folder-ops": [
                SourceFile(
                    id="file-ops-1",
                    name="playbook.txt",
                    mime_type="text/plain",
                    size=512,
                    modified_at="2026-09-04T12:00:00Z",
                    drive_id="drive-team",
                    path="/Team Operations/Q3 Runbooks/playbook.txt",
                ),
            ],
        }

        self._file_contents: dict[str, tuple[str, bytes, str]] = {
            "file-eng-1": ("architecture.pdf", b"%PDF-1.4 Mock Architecture Content", "application/pdf"),
            "file-eng-2": ("readme.txt", b"Mock Engineering Readme Content", "text/plain"),
            "file-prod-1": ("roadmap.pdf", b"%PDF-1.4 Mock Roadmap Content", "application/pdf"),
            "file-ops-1": ("playbook.txt", b"Mock Operations Playbook Content", "text/plain"),
        }

    async def browse(
        self,
        connection: Any,
        folder_id: str | None = None,
        page_token: str | None = None,
    ) -> BrowsePage:
        """Return children nodes for a given folder id or virtual root."""
        # Normalize virtual root identifiers
        target_id = None if (folder_id is None or folder_id in ("root", "virtual_root", "")) else folder_id

        nodes = self._folders.get(target_id, [])

        # Support pagination testing
        if page_token == "mock-page-2":
            return BrowsePage(items=nodes[1:], next_page_token=None)

        if len(nodes) > 1 and page_token != "all":
            return BrowsePage(items=nodes[:1], next_page_token="mock-page-2")

        return BrowsePage(items=nodes, next_page_token=None)

    async def list_files(
        self,
        connection: Any,
        folder_id: str | None = None,
        recursive: bool = False,
        page_token: str | None = None,
        query: str | None = None,
        page_size: int = 30,
    ) -> FilePage:
        """List files in the requested folder."""
        if not folder_id:
            files = [f for sub in self._files.values() for f in sub]
        else:
            files = list(self._files.get(folder_id, []))

        if query:
            q = query.lower()
            files = [f for f in files if q in f.name.lower()]

        if page_size and len(files) > page_size:
            files = files[:page_size]

        return FilePage(files=files, next_page_token=None)

    async def read_file(
        self,
        connection: Any,
        file_id: str,
    ) -> tuple[str, bytes, str]:
        """Return mock file bytes and metadata."""
        if file_id in self._file_contents:
            return self._file_contents[file_id]

        # Generic fallback for testing arbitrary file IDs
        return f"mock_{file_id}.txt", f"Mock content for file {file_id}".encode("utf-8"), "text/plain"

    async def check(
        self,
        connection: Any,
    ) -> SourceHealth:
        """Verify connection health."""
        return SourceHealth(ok=True, details={"status": "mock_connected", "account": "test@example.com"})
