"""Source Contract and Adapters package (Phase 232 / SRC-01 / SRC-02).

Provides the unified SourceAdapter contract and registry for external document sources
(Google Drive, Mock Source, Microsoft Graph in Phase 238, MCP in Phase 239).
"""

from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceAdapter,
    SourceFile,
    SourceHealth,
    SourceNode,
    SourceRegistry,
)

__all__ = [
    "BrowsePage",
    "FilePage",
    "SourceAdapter",
    "SourceFile",
    "SourceHealth",
    "SourceNode",
    "SourceRegistry",
]
