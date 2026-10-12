"""Phase 275 (RET-02 / D-14 / D-15 / D-17 / D-32; revision B-1) — the ONE Python home of the hold check.

A legal hold is refused BY THE DATABASE on every delete path (migration 204: BEFORE DELETE triggers
on ``documents`` and ``folders``, a BEFORE TRUNCATE guard, ``ERRCODE 'PT409'``). This module adds
the part the database cannot: a readable reason, given BEFORE anything is touched. Every app delete
door calls it once, then deletes rows, then removes bytes (D-38) — so a refusal never costs a file.

⛔ THE CONTRACT.
  * One predicate, two callers. ``held_document_ids`` / ``held_folder_ids`` call the SQL functions
    ``retention_held_documents`` / ``retention_held_folders`` through the SERVICE ROLE (EXECUTE is
    granted to ``service_role`` only, revision W-5b). This module never restates what "held" means.
  * Folders FIRST (B-1). A held EMPTY folder, or a folder holding another owner's held document, is
    invisible to any id list the caller can build — so ``folder_ids`` are checked before documents.
  * No cost on the happy path. Nothing held → ``None``; the caller's org permission is looked up
    only when something is held.
  * Matter names reach org admins only (D-17). The caller's ``org:manage`` is read through
    ``app.dependencies._has_org_permission`` (as the CALLER, on a user-JWT connection). A failed
    lookup fails CLOSED to the member sentence — never to a name.
  * One 409 shape everywhere: ``{code: "legal_hold", title, message, held_count}``. A database
    refusal that races past the pre-check (``PT409`` from PostgREST or asyncpg) is mapped to the SAME
    shape by ``map_hold_refusal``, so a call site carries no ``except`` branch of its own.
  * Receipts are best-effort and LOGGED: one ``delete_refused`` receipt per held document, written
    through the service role. A failing write never masks the refusal.
  * Every supabase-py call runs through ``aexec`` (D-v2.5-01).

The sentences are ported from the sketch (``.planning/sketches/275-retention-legal-hold/index.html``)
and UI-SPEC §S8/§S10 (D-07). ``tests/unit/test_275_hold_guard.py`` fences them against the sketch.
"""
from __future__ import annotations

import logging
from contextlib import contextmanager
from datetime import date, datetime
from typing import Any, Iterator, Literal, Sequence

from fastapi import HTTPException

from app.utils.db import aexec

logger = logging.getLogger(__name__)

HoldKind = Literal["document", "folder", "watch_purge", "watch_delete", "disposition"]

# ── the ported sentences (sketch `retentionFor` / refusal box; UI-SPEC §S8, §S10) ──────────────
REFUSAL_TITLE = "Can't delete."
DOCUMENT_MEMBER = "This document is on legal hold. Ask an org admin if you think it should be released."
DOCUMENT_ADMIN = "This document is on legal hold (“{matter}”). Release the hold in Org admin → Retention first."
DOCUMENT_ADMIN_NO_MATTER = "This document is on legal hold. Release the hold in Org admin → Retention first."
FOLDER_COUNT = "This folder has {n} {noun} on legal hold. Nothing was deleted."
FOLDER_HELD = "This folder is on legal hold. Nothing was deleted."
WATCH_PURGE = "{n} of this watch's missing files are on legal hold. Nothing was purged."
WATCH_DELETE = "{n} of this watch's missing files are on legal hold. Nothing was deleted."
ADMIN_SUFFIX = " Release the hold in Org admin → Retention first."
MEMBER_SUFFIX = " Ask an org admin."
MEMBER_HOLD_LINE = "On legal hold. Ask an org admin."
ADMIN_HOLD_LINE = (
    "On legal hold — “{matter}”, placed by {placed_by} on {placed_at}. "
    "It can't be deleted or disposed of until the hold is released."
)
ADMIN_HOLD_LINE_BARE = "On legal hold. It can't be deleted or disposed of until the hold is released."

_PT409 = "PT409"


class HoldRefusal(Exception):
    """A delete refused because something is on legal hold. ``to_http()`` is the one 409 shape."""

    def __init__(self, *, kind: HoldKind, held_count: int | None, title: str, message: str) -> None:
        super().__init__(message)
        self.kind = kind
        self.held_count = held_count
        self.title = title
        self.message = message

    def to_http(self) -> HTTPException:
        return HTTPException(
            status_code=409,
            detail={
                "code": "legal_hold",
                "title": self.title,
                "message": self.message,
                "held_count": self.held_count,
            },
        )


def refusal_for(
    kind: HoldKind,
    *,
    held_count: int | None,
    can_manage: bool,
    matters: Sequence[str] = (),
) -> HoldRefusal:
    """Build the refusal for ``kind``. A member's sentence never carries a matter (D-17)."""
    suffix = ADMIN_SUFFIX if can_manage else MEMBER_SUFFIX
    if kind == "folder":
        if held_count:
            noun = "document" if held_count == 1 else "documents"
            message = FOLDER_COUNT.format(n=held_count, noun=noun) + suffix
        else:
            message = FOLDER_HELD + suffix
    elif kind in ("watch_purge", "watch_delete"):
        template = WATCH_PURGE if kind == "watch_purge" else WATCH_DELETE
        n = held_count if held_count else "Some"
        message = template.format(n=n) + ("" if can_manage else MEMBER_SUFFIX)
    else:  # document / disposition
        if not can_manage:
            message = DOCUMENT_MEMBER
        elif matters:
            message = DOCUMENT_ADMIN.format(matter="”, “".join(matters))
        else:
            message = DOCUMENT_ADMIN_NO_MATTER
    return HoldRefusal(kind=kind, held_count=held_count, title=REFUSAL_TITLE, message=message)


def hold_line_for(*, can_manage: bool, matter: str | None, placed_by: str | None, placed_at: Any) -> str:
    """The S8 Retention-section hold line. A member's line is EXACTLY the D-17 sentence."""
    if not can_manage:
        return MEMBER_HOLD_LINE
    when = _format_day(placed_at)
    if matter and placed_by and when:
        return ADMIN_HOLD_LINE.format(matter=matter, placed_by=placed_by, placed_at=when)
    return ADMIN_HOLD_LINE_BARE


# ── the two predicates, through the service role ─────────────────────────────────────────────

async def held_document_ids(service_supabase, document_ids: Sequence[str]) -> dict[str, list[dict]]:
    """``{document_id: [hold, …]}`` for every requested document an ACTIVE hold covers.

    Each hold dict carries ``hold_id, name, created_by_name, created_at, held_since, org_id``.
    Matter names are returned to the CALLER of this function; whether they reach a person is the
    caller's ``can_manage`` decision (D-17).
    """
    ids = _unique(document_ids)
    if not ids:
        return {}
    resp = await aexec(service_supabase.rpc("retention_held_documents", {"p_document_ids": ids}))
    rows = _rows(resp)
    if not rows:
        return {}
    hold_ids = _unique(str(r["hold_id"]) for r in rows)
    holds_resp = await aexec(
        service_supabase.table("legal_holds")
        .select("id, org_id, name, created_by_name, created_at")
        .in_("id", hold_ids)
    )
    holds = {str(h["id"]): h for h in _rows(holds_resp)}
    out: dict[str, list[dict]] = {}
    for r in rows:
        h = holds.get(str(r["hold_id"]), {})
        out.setdefault(str(r["document_id"]), []).append({
            "hold_id": str(r["hold_id"]),
            "name": h.get("name"),
            "created_by_name": h.get("created_by_name"),
            "created_at": h.get("created_at"),
            "held_since": r.get("held_since"),
            "org_id": str(h["org_id"]) if h.get("org_id") else None,
        })
    return out


async def held_folder_ids(service_supabase, folder_ids: Sequence[str]) -> list[str]:
    """Every requested folder that is covered by an active hold (itself or an ancestor) or directly
    holds a held document — a held EMPTY folder included (B-1). Ids only; never a name."""
    ids = _unique(folder_ids)
    if not ids:
        return []
    resp = await aexec(service_supabase.rpc("retention_held_folders", {"p_folder_ids": ids}))
    return _unique(str(r["folder_id"]) for r in _rows(resp))


# ── the guard ────────────────────────────────────────────────────────────────────────────────

async def assert_none_held(
    request,
    current_user: dict,
    document_ids: Sequence[str],
    *,
    kind: HoldKind,
    folder_ids: Sequence[str] | None = None,
    service_supabase=None,
) -> None:
    """Return ``None`` when nothing is held; otherwise raise the 409 (``HTTPException``).

    Call it BEFORE any row delete or storage removal. ``folder_ids`` (the whole subtree, for a
    folder delete) are checked first; then ``document_ids``.
    """
    sb = service_supabase if service_supabase is not None else _service_client()

    held_folders = await held_folder_ids(sb, folder_ids or ())
    held = await held_document_ids(sb, document_ids)
    if not held_folders and not held:
        return None

    org_id = next((h["org_id"] for hs in held.values() for h in hs if h.get("org_id")), None)
    if org_id is None and held_folders:
        org_id = await _folder_org(sb, held_folders)
    can_manage = await _can_manage(request, current_user, org_id)

    await _write_refusal_receipts(sb, held, current_user, org_id=org_id, kind=kind)

    matters = _unique(h["name"] for hs in held.values() for h in hs if h.get("name"))
    raise refusal_for(
        kind, held_count=len(held), can_manage=can_manage, matters=matters,
    ).to_http()


@contextmanager
def map_hold_refusal(
    *, kind: HoldKind, can_manage: bool = False, held_count: int | None = None,
) -> Iterator[None]:
    """Turn a database hold refusal (``PT409``) raised inside the block into the same 409.

    The member sentence unless ``can_manage``; a trigger message carries no matter name, so none is
    added here. Every other exception propagates unchanged.
    """
    try:
        yield
    except Exception as exc:
        if not is_hold_refusal(exc):
            raise
        if held_count is None and kind in ("document", "disposition"):
            held_count = 1
        raise refusal_for(kind, held_count=held_count, can_manage=can_manage).to_http() from exc


def is_hold_refusal(exc: BaseException) -> bool:
    """True for a PostgREST ``APIError`` or an asyncpg error carrying SQLSTATE ``PT409``."""
    if getattr(exc, "sqlstate", None) == _PT409:
        return True
    if getattr(exc, "code", None) == _PT409:
        return True
    first = exc.args[0] if getattr(exc, "args", None) else None
    return isinstance(first, dict) and first.get("code") == _PT409


# ── helpers ──────────────────────────────────────────────────────────────────────────────────

def _service_client():
    from app.dependencies import get_supabase  # function-local: dependencies imports widely

    return get_supabase()


async def _can_manage(request, current_user: dict, org_id: str | None) -> bool:
    if not org_id:
        return False
    from app import dependencies as deps  # read at call time (tests patch the seam)

    try:
        return bool(await deps._has_org_permission(request, current_user, org_id, "org:manage"))
    except Exception:  # fail CLOSED: the member sentence, never a matter name
        logger.warning("hold_guard: org:manage lookup failed for org %s; using the member refusal", org_id)
        return False


async def _folder_org(sb, folder_ids: Sequence[str]) -> str | None:
    try:
        resp = await aexec(sb.table("folders").select("id, org_id").in_("id", list(folder_ids)))
    except Exception:
        logger.warning("hold_guard: could not read the org of held folders %s", list(folder_ids))
        return None
    rows = _rows(resp)
    return str(rows[0]["org_id"]) if rows and rows[0].get("org_id") else None


async def _write_refusal_receipts(sb, held: dict[str, list[dict]], current_user: dict, *, org_id, kind) -> None:
    """One ``delete_refused`` receipt per held document. Best-effort and logged, never raising."""
    if not held or not org_id:
        return
    try:
        names_resp = await aexec(sb.table("documents").select("id, filename").in_("id", list(held)))
        names = {str(r["id"]): r.get("filename") for r in _rows(names_resp)}
        rows = []
        for doc_id, holds in held.items():
            first = holds[0]
            rows.append({
                "org_id": first.get("org_id") or org_id,
                "action": "delete_refused",
                "document_id": doc_id,
                "document_name": names.get(doc_id),
                "hold_id": first.get("hold_id"),
                "hold_name": first.get("name"),
                "actor_id": current_user.get("id"),
                "actor_name": current_user.get("email"),
                "detail": {"door": kind},
            })
        await aexec(sb.table("retention_receipts").insert(rows))
    except Exception as exc:
        logger.warning("hold_guard: delete_refused receipt write failed (%s); the refusal stands", exc)


def _rows(resp) -> list[dict]:
    data = getattr(resp, "data", None) if resp is not None else None
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    return []


def _unique(values) -> list[str]:
    seen: dict[str, None] = {}
    for v in values or ():
        if v is not None:
            seen.setdefault(str(v), None)
    return list(seen)


def _format_day(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if isinstance(value, (datetime, date)):
        return f"{value.day} {value.strftime('%b')} {value.year}"
    return None
