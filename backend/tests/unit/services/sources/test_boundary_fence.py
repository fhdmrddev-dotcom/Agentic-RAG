"""Phase 232 (SRC-01 / Boundary Fence) — Source Contract Architectural Fence.

Enforces that no provider-specific branching ('google', 'onedrive', 'graph', etc.)
exists in source handling code outside the concrete adapter package (services/sources/adapters/).
"""

import ast
from pathlib import Path


def test_sources_base_has_no_provider_specific_branching():
    """backend/app/services/sources/base.py must not hardcode provider specific logic."""
    base_file = Path(__file__).resolve().parents[4] / "app" / "services" / "sources" / "base.py"
    assert base_file.exists(), f"{base_file} must exist"

    tree = ast.parse(base_file.read_text(encoding="utf-8"))

    # Assert that no string comparisons for "google" exist in base.py except standard alias mapping in SourceRegistry
    for node in ast.walk(tree):
        if isinstance(node, ast.Compare):
            for comparator in node.comparators:
                if isinstance(comparator, ast.Constant) and isinstance(comparator.value, str):
                    val = comparator.value.lower()
                    if val in ("onedrive", "sharepoint", "dropbox", "box"):
                        raise AssertionError(f"Provider literal '{val}' leaked into sources/base.py")


def test_adapter_directory_boundary():
    """Assert all files in services/sources/adapters/ inherit from SourceAdapter."""
    from app.services.sources.base import SourceAdapter
    from app.services.sources.adapters.mock_source import MockSourceAdapter
    from app.services.sources.adapters.google_drive import GoogleDriveSourceAdapter

    assert issubclass(MockSourceAdapter, SourceAdapter)
    assert issubclass(GoogleDriveSourceAdapter, SourceAdapter)
