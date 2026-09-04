"""Read-only Google surfaces, all on ONE `connector_connections` row.

Gmail · Sheets · Docs · Calendar · Contacts. Drive stays in `services/cloud_storage.py`
because it is also the composer file picker's module — a shared consumer this package
does not have, and a move with its own blast radius. That is a decision, not an oversight.

⚠ EVERY SURFACE HAS ITS OWN EGRESS KEY, AND THEY ALL RESOLVE TO googleapis.com. The key
therefore buys no HOST separation — it buys that a spec DECLARES exactly one key, so a
Calendar tool cannot reach Gmail and a Gmail tool cannot reach Sheets. That property is
grep-able (`SERVICE_TOOL_SPECS`, one grep per key) and a shared `google_read` would have
destroyed it the moment the second scope was added.

⛔ NOTHING HERE WRITES. Every module is scoped `*.readonly`, so the token is structurally
incapable of mutating anything regardless of what a caller asks for. Writes are a
different scope, a different consent screen and a separate decision — deferred on
2026-08-31 ("reads first, decide after"). A write added to this package would need its
own scope, and adding one silently is the thing this note exists to prevent.
"""

from __future__ import annotations

from app.services.google._http import GoogleReadError

__all__ = ["GoogleReadError"]
