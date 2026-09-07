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
    # Stand-in path: no adapter currently populates it (production falls back to '/<filename>').
    # Real adapter folder-path resolution is deferred to SEED-253 (forcing function: Phase 238 Graph adapter).
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

    # ⚠ `_ensure_registered` USED TO LIVE HERE AND WAS DELETED IN PHASE 238 (D-238-09.1).
    #
    # It lazily imported an adapter module chosen by `"google" in service_id` /
    # `"mock" in service_id` — provider branching **inside the contract**, in the one module
    # whose whole claim is that a source family is DATA. It was also redundant:
    # `app/services/sources/__init__.py` imports every adapter eagerly, so by the time any
    # caller can reach this class the registry is already populated.
    #
    # It is recorded rather than quietly removed because it is Phase 238's SC#4 finding. Adding
    # Microsoft Graph would have meant adding a third `elif` here — which is exactly the
    # "adding a source family is a code change" outcome the milestone's binding constraint
    # forbids, hiding in the file that forbids it. The boundary fence could not have caught it
    # either: the shipped test refused the literals `onedrive|sharepoint|dropbox|box` and
    # explicitly permitted `google`, so it would have flagged the SECOND offender while the
    # FIRST sat three lines away. Both are fixed together.
    #
    # ⛔ Do not reintroduce a lazy import keyed on a provider name. If a future adapter must be
    # optional (a heavy dependency, say), make the IMPORT LIST data — never the lookup.

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

        # An EXACT key lookup, and nothing else. Aliases are declared where aliases belong —
        # `@SourceRegistry.register("google_workspace")` sits on the adapter beside
        # `@SourceRegistry.register("google")`, so `google_workspace` resolves here by being
        # registered rather than by being pattern-matched. An unregistered id returns None,
        # which is the honest answer and the one every caller already handles.
        adapter_cls = cls._adapters.get(service_id)

        if adapter_cls:
            return adapter_cls()
        return None

    @classmethod
    def is_source_supported(cls, service_id: str) -> bool:
        """Check if an adapter is registered for the service_id."""
        return service_id.strip().lower() in cls._adapters

    @classmethod
    def list_supported_services(cls) -> list[str]:
        """List all canonically registered service IDs."""
        return sorted(list(cls._adapters.keys()))
