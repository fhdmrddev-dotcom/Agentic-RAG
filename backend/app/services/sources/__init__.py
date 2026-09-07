"""Source Contract and Adapters package (Phase 232 / SRC-01 / SRC-02).

Provides the unified SourceAdapter contract and registry for external document sources
(Google Drive, Microsoft Graph/OneDrive, Mock Source, and any MCP server since Phase 239).

⚠ THIS IMPORT LIST IS LOAD-BEARING, NOT TIDINESS. `@SourceRegistry.register` only fires when
its module is imported, and this eager list is precisely what let Phase 238 delete
`_ensure_registered`'s lazy, provider-keyed import from inside the contract. An adapter left
out here is unregistered and therefore unresolvable — `watch_service` raises
`NotImplementedError` for a perfectly good connection, and `api/connectors.py` answers an
empty browse. `test_the_eager_import_is_what_registers_it` pins it.
"""

from app.services.sources.adapters import (  # noqa: F401
    google_drive,
    mcp_source,
    microsoft_graph,
    mock_source,
)
from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceAdapter,
    SourceConnectionDisabled,
    SourceFile,
    SourceHealth,
    SourceNode,
    SourceRegistry,
)

__all__ = [
    "BrowsePage",
    "FilePage",
    "SourceAdapter",
    "SourceConnectionDisabled",
    "SourceFile",
    "SourceHealth",
    "SourceNode",
    "SourceRegistry",
]
