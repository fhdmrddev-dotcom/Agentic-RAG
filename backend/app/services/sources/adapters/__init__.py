"""Source Adapters package.

Concrete implementations of SourceAdapter for external services.
"""

from app.services.sources.adapters.mock_source import MockSourceAdapter

__all__ = ["MockSourceAdapter"]
