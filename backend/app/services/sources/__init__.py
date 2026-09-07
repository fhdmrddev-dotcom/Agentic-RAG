"""Source Contract and Adapters package (Phase 232 / SRC-01 / SRC-02).

Provides the unified SourceAdapter contract and registry for external document sources
(Google Drive, Microsoft Graph/OneDrive, Mock Source; MCP in Phase 239).
"""

from app.services.sources.adapters import google_drive, microsoft_graph, mock_source  # noqa: F401
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
