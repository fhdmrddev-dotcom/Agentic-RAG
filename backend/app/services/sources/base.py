"""Phase 232 (SRC-01 / D-232-04) — The Source Contract Abstraction.

Defines the unified SourceAdapter contract that every source family (Google Drive,
Microsoft Graph, MCP, Mock Source) implements as a thin adapter. Adding a family
is data and registration, never an ingest path.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)


@dataclass
class SourceNode:
    """A navigable hierarchical node in an external source (folder or drive)."""

    id: str
    name: str
    kind: str = "folder"  # "folder" | "drive"
    drive_id: str | None = None
    has_children: bool = True
    parent_id: str | None = None


@dataclass
class SourceFile:
    """A file metadata item available in an external source."""

    id: str
    name: str
    mime_type: str
    size: int | None = None
    modified_at: str | None = None
    drive_id: str | None = None
    icon_url: str | None = None
    web_view_url: str | None = None
    path: str | None = None


@dataclass
class BrowsePage:
    """A paginated page of hierarchical nodes (folders/drives)."""

    items: list[SourceNode] = field(default_factory=list)
    next_page_token: str | None = None


@dataclass
class FilePage:
    """A paginated page of files for listing and batch inspection."""

    files: list[SourceFile] = field(default_factory=list)
    next_page_token: str | None = None


@dataclass
class SourceListing:
    """Aggregated listing resulting from an exhaustive folder traversal loop (SRC-06 / H-5)."""

    files: list[SourceFile] = field(default_factory=list)
    complete: bool = False  # Fails closed. ONLY True when loop completes with next_page_token IS None and 0 errors.
    error: str | None = None


@dataclass
class SourceHealth:
    """Health check diagnostic result for a source connection."""

    ok: bool = True
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)


class SourceAdapter(ABC):
    """Abstract contract for an external document source family."""

    @abstractmethod
    async def browse(
        self,
        connection: Any,
        folder_id: str | None = None,
        page_token: str | None = None,
    ) -> BrowsePage:
        """Browse the folder tree hierarchy of a connected source."""

    @abstractmethod
    async def list_files(
        self,
        connection: Any,
        folder_id: str | None = None,
        recursive: bool = False,
        page_token: str | None = None,
        query: str | None = None,
        page_size: int = 30,
    ) -> FilePage:
        """List files available inside a folder (for preview/batch sync)."""

    @abstractmethod
    async def read_file(
        self,
        connection: Any,
        file_id: str,
    ) -> tuple[str, bytes, str]:
        """Download a single file's raw content.

        Returns (filename, content_bytes, mime_type).
        """

    @abstractmethod
    async def check(
        self,
        connection: Any,
    ) -> SourceHealth:
        """Verify that connection credentials, scopes, and endpoints are reachable."""


T = TypeVar("T", bound=type[SourceAdapter])


class SourceRegistry:
    """Registry for source family adapters, keyed by service_id."""

    _adapters: dict[str, type[SourceAdapter]] = {}

    @classmethod
    def register(cls, service_id: str) -> Callable[[T], T]:
        """Decorator to register an adapter class for a service_id."""

        def decorator(adapter_cls: T) -> T:
            normalized = service_id.strip().lower()
            cls._adapters[normalized] = adapter_cls
            return adapter_cls

        return decorator

    @classmethod
    def _ensure_registered(cls, service_id: str) -> None:
        if "google" in service_id or "workspace" in service_id:
            try:
                import app.services.sources.adapters.google_drive  # noqa: F401
            except Exception:
                pass
        elif "mock" in service_id:
            try:
                import app.services.sources.adapters.mock_source  # noqa: F401
            except Exception:
                pass

    @classmethod
    def get_adapter(cls, connection_or_service_id: Any) -> SourceAdapter | None:
        """Resolve an instantiated SourceAdapter for a connection or service_id string."""
        if not connection_or_service_id:
            return None

        if isinstance(connection_or_service_id, str):
            service_id = connection_or_service_id.strip().lower()
        else:
            service_id = getattr(connection_or_service_id, "service_id", "") or (
                connection_or_service_id.get("service_id", "")
                if isinstance(connection_or_service_id, dict)
                else ""
            )
            service_id = str(service_id).strip().lower()

        cls._ensure_registered(service_id)

        # Direct match or canonical alias match
        adapter_cls = cls._adapters.get(service_id)
        if not adapter_cls:
            # Handle standard aliases (e.g. google_workspace -> google)
            if "google" in service_id or "workspace" in service_id:
                adapter_cls = cls._adapters.get("google") or cls._adapters.get("google_workspace")

        if adapter_cls:
            return adapter_cls()
        return None

    @classmethod
    def is_source_supported(cls, service_id: str) -> bool:
        """Check if an adapter is registered for the service_id."""
        normalized = service_id.strip().lower()
        if normalized in cls._adapters:
            return True
        if "google" in normalized or "workspace" in normalized:
            return "google" in cls._adapters or "google_workspace" in cls._adapters
        return False

    @classmethod
    def list_supported_services(cls) -> list[str]:
        """List all canonically registered service IDs."""
        return sorted(list(cls._adapters.keys()))
