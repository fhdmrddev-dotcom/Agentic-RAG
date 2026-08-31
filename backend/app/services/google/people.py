"""Search this account's own contacts.

⛔ READS ONLY — `contacts.readonly`, and only the account's OWN contacts. Not the
organisation directory (that is a separate scope and an admin decision), not "other
contacts" auto-collected from mail (`contacts.other.readonly`, deliberately not granted:
it is a shadow address book most people do not know they have).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.services.google._http import GoogleReadError, get_json

CAPABILITY = "contacts_read"
API = "https://people.googleapis.com/v1"

_FIELDS = "names,emailAddresses,phoneNumbers,organizations"

__all__ = ["search_contacts", "CAPABILITY"]


def _slim(person: dict) -> dict[str, Any]:
    def first(key: str, attr: str) -> str:
        items = person.get(key) or []
        for item in items:
            if isinstance(item, dict) and item.get(attr):
                return str(item[attr])
        return ""

    orgs = person.get("organizations") or []
    org = orgs[0] if orgs and isinstance(orgs[0], dict) else {}
    return {
        "name": first("names", "displayName"),
        "email": first("emailAddresses", "value"),
        "phone": first("phoneNumbers", "value"),
        "organization": str(org.get("name") or ""),
        "title": str(org.get("title") or ""),
    }


async def search_contacts(
    connection_id: str | UUID, query: str, limit: int = 10
) -> dict[str, Any]:
    """Find contacts by name, email or organisation.

    ⚠ THE QUERY IS REQUIRED AND THAT IS NOT A CONVENIENCE. `people.searchContacts` with
    an empty query returns nothing useful, and "list every contact I have" is a bulk
    export of personal data with no question behind it — a shape this connector should
    not offer at all, not one that should merely be capped.
    """
    q = str(query or "").strip()
    if not q:
        raise GoogleReadError(
            "search_contacts needs something to search for — a name, an email or an "
            "organisation. It does not list every contact."
        )
    data = await get_json(
        CAPABILITY,
        connection_id,
        f"{API}/people:searchContacts",
        {"query": q, "readMask": _FIELDS, "pageSize": str(max(1, min(int(limit or 10), 30)))},
        what="search_contacts",
    )
    people = [
        _slim(r["person"])
        for r in (data.get("results") or [])
        if isinstance(r, dict) and isinstance(r.get("person"), dict)
    ]
    return {
        "query": q,
        "contacts": people,
        "note": None if people else (
            "The search succeeded and matched no contact. Google's contact search warms "
            "a cache on first use, so a brand-new connection can legitimately return "
            "nothing on its very first call — try once more before concluding."
        ),
    }
