"""The ONE reader of ``ENVIRONMENT`` (A-IN-11), shared since Phase 294.

``settings.environment`` (pydantic settings, which also load ``backend/.env``), stripped and
lowercased, read per call — never cached at import, so a test or a restart sees the current value.
Every gate that decides on the deployment environment calls this, and each keeps its OWN allowlist
of values, because the gates want different things:

* ``app.api.api_docs`` — the docs explorer is OPEN for unset / local / development / dev / test.
* ``app.services.rerank_engines.resolve_endpoint`` — the dev-only decision-engine fault path is
  honoured ONLY for an EXPLICIT local / development / dev / test; unset does not qualify (294 N1).

⛔ Never ``os.getenv("ENVIRONMENT")``: that misses ``backend/.env`` and is the A-IN-11 defect.
"""
from __future__ import annotations

from app.config import settings


def current_environment() -> str:
    """``settings.environment`` normalised (stripped, lowercased); ``""`` when unset."""
    return (settings.environment or "").strip().lower()
