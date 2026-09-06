"""Phase 233 (PREV-01 / PREV-02 / PREV-03 / LIB-09) — The Preview: the diff pass.

⭐ **THE PREVIEW *IS* THE DIFF PASS.** There is exactly ONE classifier in this module, and it
runs twice: once with nothing written (the preview) and once for real (the confirm). A preview
built as its own code path is guaranteed to eventually disagree with the ingest, and the first
person to find the disagreement is a user. So `confirm_preview` calls `build_preview` rather than
re-deriving anything.

── TWO-TIER IDENTITY (D-1, and it lands HERE and nowhere earlier) ─────────────────────────────

**Tier 1, at preview time:** `(source_system, external_id, source_version)` compared for
**EQUALITY**. ⛔ It is **never** a hash and must never be described as one.

`PROJECT.md`'s *"a `content_hash` lookup, not a guess"* is FALSE for a list-only pass, measured
rather than assumed:

  * `documents.py:620` hashes raw **bytes** — which requires the download this preview exists to
    avoid;
  * Google Drive publishes **no** hash at all for native Docs / Sheets / Slides;
  * Microsoft Graph guarantees only `quickXorHash`, documents `sha256Hash` as unsupported, and
    populates hashes **after** the item has been downloaded.

So the honest label is *"Already here — matched by source file, not by content"*, and the reason
sentence says the bytes have not been compared. `test_preview_classifier.py` asserts that word
never appears in a `here` verdict.

**Tier 2, at splice:** the shipped `sha256` dedupe inside `mint_document_row`, unchanged. That is
what settles a file the preview could only say *"can't tell"* about — and when it does, the file
is neither imported again **nor embedded again**.

── WHERE TIER-1 IDENTITY LIVES (D-233-01) ─────────────────────────────────────────────────────

`documents.metadata.source = {"system": ..., "external_id": ..., "version": ...}` — a `jsonb`
column that already exists, so this phase ships **no migration**, exactly as the ROADMAP predicted.

`source_version` is Drive's `modifiedTime`, already returned by `SourceAdapter.list_files` as
`SourceFile.modified_at`. No second API call, and it is honest: it says the file MOVED, never that
the bytes differ.

── WHAT THIS MODULE MAY NOT DO ────────────────────────────────────────────────────────────────

⛔ `build_preview` writes **nothing**: no document row, no chunk, no ingestion job, no folder, and
no audit entry that reads like an import. Evaluating a routing rule is a **READ** — the suggested
folder is resolved by name, never minted. The `wrote` receipt it returns is four literal zeros,
and it is the same sentence the surface prints in its footer.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Literal

from supabase import Client

log = logging.getLogger(__name__)

Bucket = Literal["add", "here", "uns", "unk"]

#: The four buckets, in the order the surface renders them. ⚠ There is deliberately no fifth and
#: no way to remove one — SC#1 is met BY CONSTRUCTION, never by audit (D-233-04).
BUCKETS: tuple[Bucket, ...] = ("add", "here", "uns", "unk")

#: ⭐ `outcome` has exactly THREE values (D-233-05). There is deliberately no fourth, so SC#5's
#: *"silently in neither"* is **unrepresentable** rather than merely unlikely.
Outcome = Literal["added", "here", "refused"]

# Google's native editor types. They have no bytes until they are exported, and Drive publishes
# no content identity for any of them — so a list-only pass genuinely cannot tell.
GOOGLE_NATIVE_EXPORTABLE = {
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
}
GOOGLE_SHORTCUT = "application/vnd.google-apps.shortcut"
GOOGLE_NATIVE_PREFIX = "application/vnd.google-apps."

#: Mimes whose *type* is fine but whose *readability* is only knowable once opened.
OPAQUE_MIMES = {"application/octet-stream", ""}


@dataclass
class PreviewItem:
    """One source file, and the one verdict the preview is willing to state about it."""

    external_id: str
    name: str
    mime_type: str
    bucket: Bucket
    #: 3-4 words. This is what the row shows AT REST.
    fragment: str
    #: The full sentence. It lives BEHIND the row (a hover), never printed on it — but it must
    #: exist: a bucket labelled "can't tell" whose rows never say why is a shrug.
    reason: str
    size: int | None = None
    modified_at: str | None = None
    #: Where this file would land. `add` rows always carry one (SC#3).
    destination: str | None = None
    #: True when a routing rule suggested `destination` rather than the chosen folder.
    rule_suggested: bool = False
    web_view_url: str | None = None
    path: str | None = None


@dataclass
class SourcePreview:
    """The whole answer to "what would bringing this folder in actually do?"."""

    folder_id: str | None
    folder_name: str | None
    items: list[PreviewItem] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)
    total: int = 0
    #: True when the listing did not finish. ⚠ A partial listing may never be presented as a
    #: complete picture — that is the Onyx #1161 failure mode, one phase early.
    truncated: bool = False
    #: WHICH budget stopped the walk, so the surface says something true rather than "some files".
    stopped_by: str | None = None
    #: How many folders were read. `1` means the chosen folder had no sub-folders.
    folders_scanned: int = 1
    #: Whether sub-folders were walked at all — the screen must not imply a depth it did not go to.
    recursive: bool = True
    #: ⭐ The zero-write receipt. Four literal zeros, and the surface prints this sentence.
    wrote: dict[str, int] = field(
        default_factory=lambda: {"documents": 0, "chunks": 0, "jobs": 0, "folders": 0}
    )


@dataclass
class ConfirmOutcome:
    """What actually happened to one file — one of exactly three things."""

    external_id: str
    name: str
    outcome: Outcome
    #: Required when `outcome == "refused"`. ⛔ A refusal that is only a colour is a COUNT;
    #: SC#5 requires a NAMED one, and 230-B failed on exactly that.
    reason: str | None = None
    document_id: str | None = None


@dataclass
class ConfirmResult:
    outcomes: list[ConfirmOutcome] = field(default_factory=list)
    accounted: int = 0
    unaccounted: int = 0
    preview_said_added: int = 0
    actually_added: int = 0


# ── the classifier ─────────────────────────────────────────────────────────────────────────


def classify_source_file(
    *,
    name: str,
    mime_type: str,
    modified_at: str | None,
    external_id: str,
    known: dict[str, str | None],
    supported: set[str],
) -> tuple[Bucket, str, str]:
    """PURE. Return `(bucket, fragment, reason)` for one listed source file.

    `known` maps `external_id -> source_version` for files this connection has already placed in
    the Library. ⚠ It is a **source-file** index, not a content index — that distinction is the
    entire honesty claim of bucket 2, and the reason no verdict below uses the word this module's
    docstring refuses.

    Order matters. The first arm that fires wins, and the arms are ordered so that a file we
    genuinely cannot judge lands in `unk` rather than being optimistically counted as `add`.
    """
    mime = (mime_type or "").strip().lower()
    _, ext = os.path.splitext(name or "")
    ext = ext.lower()

    # 1. Tier 1: same source file, same version. Not a content claim.
    if external_id in known and known[external_id] is not None and known[external_id] == modified_at:
        return (
            "here",
            "same file, unchanged",
            "The same source file at the same version — unchanged since it was brought in. "
            "Matched by source file, not by content: the bytes have not been compared.",
        )

    # 2. A shortcut is a pointer. We can see the pointer, not the file.
    if mime == GOOGLE_SHORTCUT:
        return (
            "unk",
            "shortcut, target unread",
            "A shortcut. We can see the pointer, but not whether its target is reachable or "
            "readable — that is only knowable by following it.",
        )

    # 3. Native Docs / Sheets export cleanly, but Drive publishes no content identity for them,
    #    so whether anything material changed is genuinely unknowable from the listing.
    if mime in GOOGLE_NATIVE_EXPORTABLE:
        return (
            "unk",
            "native Google file",
            "A native Google document. Drive publishes no content identity for native files, so "
            "we cannot tell whether anything material changed without exporting it.",
        )

    # 4. Any other Google native type (Slides, Forms, Drawings, Sites…) has no export path here.
    if mime.startswith(GOOGLE_NATIVE_PREFIX):
        return (
            "uns",
            mime.rsplit(".", 1)[-1] or mime,
            f"{mime} — this kind of file has no readable export. Nothing is imported.",
        )

    # 5. No mime and no extension: the source will not say what this is.
    if mime in OPAQUE_MIMES and not ext:
        return (
            "unk",
            "no extension",
            "No extension and no declared type. The source will not say what this is, so we "
            "cannot tell whether it is readable until we open it.",
        )

    # 6. A PDF may be a scan. The type is supported; the CONTENT may hold no text at all, and
    #    that is only knowable on read. Being optimistic here is what makes a preview lie.
    if mime == "application/pdf" or ext == ".pdf":
        return (
            "unk",
            "may have no text",
            "A PDF. It may be image-only — we cannot know whether there is readable text in it "
            "until we open it.",
        )

    # 7. A type we can read.
    if mime in supported:
        return ("add", ext.lstrip(".").upper() or "file", "")

    # 8. Everything else is honestly out of scope.
    return (
        "uns",
        mime or (ext.lstrip(".") or "unknown type"),
        f"{mime or 'This file type'} — we cannot read this kind of file. Nothing is imported.",
    )


# ── walking a folder, and the budget that stops it ─────────────────────────────────────────

#: How far down the tree a preview will look. ⚠ Every one of these is a REFUSAL TO GUESS, not a
#: performance tweak: past any of them the preview stops and SAYS it stopped, because a partial
#: listing presented as a complete one is the failure this whole phase exists to prevent.
MAX_DEPTH = 5
MAX_FOLDERS = 200
MAX_FILES = 2000
MAX_PAGES_PER_FOLDER = 20


@dataclass
class WalkResult:
    files: list[Any] = field(default_factory=list)
    folders_visited: int = 0
    #: True when a budget stopped the walk, or a page token was left unfollowed.
    truncated: bool = False
    #: Which budget stopped it, so the surface can say something true rather than "some files".
    stopped_by: str | None = None


async def walk_source_files(
    *,
    adapter: Any,
    connection: Any,
    folder_id: str | None,
    folder_name: str | None = None,
    recursive: bool,
    page_size: int = 200,
) -> WalkResult:
    """List a folder — and, when asked, everything beneath it — under a hard budget.

    ── ⚠ WHY THIS LIVES HERE AND NOT IN THE ADAPTER ──────────────────────────────────────────

    `SourceAdapter.list_files` has taken a `recursive: bool = False` parameter since Phase 232,
    and **neither shipped adapter has ever read it** (`grep -rn recursive` returns three
    declarations and zero uses). So the preview looked one level deep while its signature said
    it could go deeper — which is how the operator ended up previewing a folder and being shown
    less than they meant.

    The walk is implemented **here, once**, on top of `browse()` + `list_files()`, rather than
    inside each adapter. That is the Phase 232 design claim honoured rather than quietly dropped:
    *adding a source family is data and registration, never an ingest path*. Microsoft Graph
    (238) and MCP (239) inherit recursion by existing, and there is exactly one budget to reason
    about instead of one per family.

    ── ⛔ THE BUDGET IS NOT A PERFORMANCE TWEAK ──────────────────────────────────────────────

    A recursive walk over a connected Drive is unbounded by nature — someone will point this at
    *My Drive* — and an unbounded preview is a request that never returns and a Drive API quota
    that does. So it stops, and **`truncated` plus `stopped_by` make the stop legible.** The
    surface must never present a budget-stopped listing as the whole folder; that is the same
    fence `SRC-06` puts on the watch loop one phase later, and the reason Onyx once deleted 976
    documents it believed were gone.
    """
    result = WalkResult()
    init_path = f"/{folder_name.strip('/')}" if folder_name and folder_name.strip('/') else ""
    queue: list[tuple[str | None, str, int]] = [(folder_id, init_path, 0)]
    # ⚠ THE START FOLDER IS SEEDED, and it was NOT in the first version — a test with a
    #   sub-folder linking back to its parent re-listed the parent and double-counted its files.
    #   Seeding here is what makes `seen` a visited-set rather than a queued-set.
    seen: set[str] = {folder_id} if folder_id else set()
    # ⚠ A Drive file can have MORE THAN ONE PARENT, so the same file is legitimately returned by
    #   two folders in one walk. Without this the preview counts it twice and the confirm then
    #   disagrees with it — SC#4, broken by arithmetic rather than by logic.
    seen_files: set[str] = set()

    while queue:
        current, current_path, depth = queue.pop(0)

        if result.folders_visited >= MAX_FOLDERS:
            result.truncated, result.stopped_by = True, "folders"
            break
        result.folders_visited += 1

        # ── files in this folder, paged ──
        page_token: str | None = None
        for _ in range(MAX_PAGES_PER_FOLDER):
            page = await adapter.list_files(
                connection=connection,
                folder_id=current,
                recursive=False,
                page_token=page_token,
                page_size=page_size,
            )
            for f in page.files:
                if f.id in seen_files:
                    continue
                seen_files.add(f.id)
                if getattr(f, "path", None) is None:
                    f.path = f"{current_path}/{f.name}" if current_path else f"/{f.name}"
                result.files.append(f)
            if len(result.files) >= MAX_FILES:
                del result.files[MAX_FILES:]
                result.truncated, result.stopped_by = True, "files"
                return result
            page_token = page.next_page_token
            if not page_token:
                break
        else:
            # ⚠ The loop ran out of PAGES with a token still in hand. The folder is bigger than
            #   we were willing to read, and saying so is the whole point of this branch.
            if page_token:
                result.truncated, result.stopped_by = True, "pages"

        if not recursive or depth >= MAX_DEPTH:
            if recursive and depth >= MAX_DEPTH:
                result.truncated, result.stopped_by = True, "depth"
            continue

        # ── sub-folders ──
        try:
            sub = await adapter.browse(connection, folder_id=current, page_token=None)
        except Exception:  # noqa: BLE001 — an unreadable branch truncates, it never fabricates
            log.warning("preview walk: could not browse %r; marking truncated", current, exc_info=True)
            result.truncated, result.stopped_by = True, "unreadable"
            continue

        for node in sub.items:
            # ⚠ Drive shortcuts and shared drives can point at a folder already queued. Without
            #   this the walk loops forever on a cycle nobody authored deliberately.
            if node.id in seen:
                continue
            seen.add(node.id)
            sub_path = f"{current_path}/{node.name}" if current_path else f"/{node.name}"
            queue.append((node.id, sub_path, depth + 1))

    return result


# ── the preview ────────────────────────────────────────────────────────────────────────────


def _conn_attr(connection: Any, key: str, default: Any = None) -> Any:
    if isinstance(connection, dict):
        return connection.get(key, default)
    return getattr(connection, key, default)


def _source_system(connection: Any) -> str:
    return str(_conn_attr(connection, "service_id", "") or "").strip().lower()


async def _known_source_files(
    *,
    connection_id: str,
    source_system: str,
    supabase: Client,
) -> dict[str, str | None]:
    """Build the tier-1 index: `external_id -> source_version`, for THIS connection only.

    ⚠ Scoped to the connection, not to the org. Two connections into the same Drive are two
    different placements, and conflating them would let one connection's import make another's
    preview claim a file is "already here" when this connection never placed it.
    """
    from starlette.concurrency import run_in_threadpool

    def _read() -> list[dict]:
        res = (
            supabase.table("documents")
            .select("metadata")
            .eq("source_connection_id", connection_id)
            .neq("status", "failed")
            .limit(5000)
            .execute()
        )
        return res.data or []

    if not connection_id:
        return {}

    try:
        rows = await run_in_threadpool(_read)
    except Exception:  # noqa: BLE001 — an unreadable index must not fabricate "already here"
        log.warning("tier-1 source index read failed; preview will claim nothing is here", exc_info=True)
        return {}

    known: dict[str, str | None] = {}
    for row in rows:
        src = (row.get("metadata") or {}).get("source") or {}
        if not isinstance(src, dict):
            continue
        if str(src.get("system", "")).strip().lower() != source_system:
            continue
        ext_id = src.get("external_id")
        if ext_id:
            known[str(ext_id)] = src.get("version")
    return known


async def _rule_destinations(
    *,
    user_id: str,
    supabase: Client,
) -> list[dict]:
    """Load enabled routing rules for watch scope. ⛔ A READ — no folder is minted, nothing is written."""
    try:
        from app.services import classification_rule_service

        rules = await classification_rule_service.list_rules(
            user_id, rule_scope="watch", supabase=supabase
        )
        return [r for r in rules if r.get("enabled")]
    except Exception:  # noqa: BLE001 — rules NEVER block a preview (mirror the ingest degrade)
        log.warning("preview rule load failed; destinations fall back to the chosen folder", exc_info=True)
        return []


def _suggest_destination(
    *,
    rules: list[dict],
    name: str,
    modified_at: str | None,
    supabase: Client,
    user_id: str,
    fallback: str | None,
    mime_type: str | None = None,
    size: int | None = None,
    path: str | None = None,
    source_system: str | None = None,
    source_connection_id: str | None = None,
) -> tuple[str | None, bool]:
    """Evaluate watch rules against the arrival metadata the preview ACTUALLY HAS (RULES-01 / SC#1 / SC#3).

    At preview time we know arrival properties: filename/title, mime/type, size, modified date,
    and source facts (source_system, source_connection_id) — and NOT extracted metadata.
    Evaluates ONLY rules where `rule_scope == 'watch'`. Extracted metadata rules (classification scope)
    are filtered out at query time and rejected at authoring time.
    """
    if not rules:
        return fallback, False

    watch_rules = [r for r in rules if r.get("rule_scope", "watch") == "watch" and r.get("enabled", True)]
    if not watch_rules:
        return fallback, False

    try:
        from app.api.classification_rules import WATCH_ALLOWED_FIELDS
        from app.services import classification_matcher
    except Exception:  # noqa: BLE001
        return fallback, False

    preview_metadata: dict[str, Any] = {
        "name": name,
        "title": name,
        "filename": name,
    }
    if mime_type:
        preview_metadata["mime"] = mime_type
        preview_metadata["type"] = mime_type
        preview_metadata["mime_type"] = mime_type
    if size is not None:
        preview_metadata["size"] = size
        preview_metadata["file_size"] = size
    if path:
        preview_metadata["path"] = path
        preview_metadata["source_path"] = path
    if source_system:
        preview_metadata["source_system"] = str(source_system).lower()
    if source_connection_id:
        preview_metadata["source_connection_id"] = str(source_connection_id)
    if modified_at:
        preview_metadata["date"] = modified_at[:10]

    for rule in watch_rules:
        try:
            if classification_matcher.match_metadata(
                rule.get("match_expr") or {}, preview_metadata, set(WATCH_ALLOWED_FIELDS)
            ):
                suggestion = classification_matcher.build_suggestion(rule, supabase, user_id)
                folder_name = suggestion.get("suggested_folder_name")
                if folder_name:
                    return (f"/{folder_name}", True)
        except Exception:  # noqa: BLE001 — first-match-wins, and a bad rule degrades one file
            continue
    return fallback, False


async def build_preview(
    *,
    connection: Any,
    folder_id: str | None,
    folder_name: str | None,
    user_id: str,
    supabase: Client,
    destination_folder_name: str | None = None,
    recursive: bool = True,
    page_size: int = 200,
) -> SourcePreview:
    """List a source folder and say exactly what bringing it in would do. ⛔ WRITES NOTHING.

    ⚠ `recursive` DEFAULTS TO TRUE, and that is the corrected behaviour rather than a new
    feature. Phase 233 shipped looking one level deep while `SourceAdapter.list_files` carried a
    `recursive` flag nothing read, so a person who pointed at a folder with sub-folders was shown
    less than they had selected and had no way to tell. The walk is budgeted and says when it
    stopped — see `walk_source_files`.
    """
    from app.api.documents import ALLOWED_MIME_TYPES
    from app.services.sources.base import SourceRegistry

    adapter = SourceRegistry.get_adapter(connection)
    if not adapter:
        return SourcePreview(
            folder_id=folder_id,
            folder_name=folder_name,
            counts={b: 0 for b in BUCKETS},
            recursive=recursive,
            folders_scanned=0,
        )

    connection_id = str(_conn_attr(connection, "id", "") or "")
    system = _source_system(connection)

    walk = await walk_source_files(
        adapter=adapter,
        connection=connection,
        folder_id=folder_id,
        folder_name=folder_name,
        recursive=recursive,
        page_size=page_size,
    )
    known = await _known_source_files(
        connection_id=connection_id, source_system=system, supabase=supabase
    )
    rules = await _rule_destinations(user_id=user_id, supabase=supabase)
    fallback = f"/{destination_folder_name}" if destination_folder_name else "/"

    items: list[PreviewItem] = []
    for f in walk.files:
        bucket, fragment, reason = classify_source_file(
            name=f.name,
            mime_type=f.mime_type,
            modified_at=f.modified_at,
            external_id=f.id,
            known=known,
            supported=set(ALLOWED_MIME_TYPES),
        )
        destination: str | None = None
        rule_suggested = False
        file_path = getattr(f, "path", None) or f"/{f.name}"
        if bucket == "add":
            destination, rule_suggested = _suggest_destination(
                rules=rules,
                name=f.name,
                modified_at=f.modified_at,
                supabase=supabase,
                user_id=user_id,
                fallback=fallback,
                mime_type=f.mime_type,
                size=f.size,
                path=file_path,
                source_system=system,
                source_connection_id=connection_id,
            )
        items.append(
            PreviewItem(
                external_id=f.id,
                name=f.name,
                mime_type=f.mime_type,
                bucket=bucket,
                fragment=fragment,
                reason=reason,
                size=f.size,
                modified_at=f.modified_at,
                destination=destination,
                rule_suggested=rule_suggested,
                web_view_url=f.web_view_url,
                path=file_path,
            )
        )

    counts = {b: sum(1 for i in items if i.bucket == b) for b in BUCKETS}
    return SourcePreview(
        folder_id=folder_id,
        folder_name=folder_name,
        items=items,
        counts=counts,
        total=len(items),
        truncated=walk.truncated,
        stopped_by=walk.stopped_by,
        folders_scanned=walk.folders_visited,
        recursive=recursive,
    )


# ── the confirm ────────────────────────────────────────────────────────────────────────────


async def confirm_preview(
    *,
    connection: Any,
    folder_id: str | None,
    folder_name: str | None,
    user_id: str,
    active_org: str,
    supabase: Client,
    background_tasks: Any,
    destination_folder_id: str | None = None,
    destination_folder_name: str | None = None,
    recursive: bool = True,
    only_external_ids: list[str] | None = None,
    page_size: int = 200,
) -> ConfirmResult:
    """Import what the preview said would be imported — and resolve every "can't tell".

    ⭐ It re-runs `build_preview`, so the counts the person confirmed against and the counts that
    happen come from the SAME classifier. SC#4 cannot be met by a second code path.

    Every file ends at exactly one of three outcomes, and `unaccounted` must be `0`.
    """
    from app.services.sources.import_service import import_single_file

    preview = await build_preview(
        connection=connection,
        folder_id=folder_id,
        folder_name=folder_name,
        user_id=user_id,
        supabase=supabase,
        destination_folder_name=destination_folder_name,
        recursive=recursive,
        page_size=page_size,
    )
    system = _source_system(connection)
    outcomes: list[ConfirmOutcome] = []
    added = 0

    # ⭐ A SUBSET IS A SUBSET OF WHAT THE PREVIEW SAID, never a second listing.
    #
    # The person ticks rows on a screen the preview produced, so the selection is filtered out of
    # `preview.items` here rather than re-derived from a fresh call. ⚠ That ordering is the whole
    # SC#4 guarantee: if the confirm listed the folder again and filtered THAT, a file added at the
    # source in between would silently join a set the person never saw.
    #
    # ⚠ `None` means "everything the preview showed" — an explicit EMPTY list means "nothing", and
    # the two must not collapse into each other.
    selected = set(only_external_ids) if only_external_ids is not None else None
    items = (
        preview.items if selected is None else [i for i in preview.items if i.external_id in selected]
    )

    for item in items:
        if item.bucket == "here":
            outcomes.append(
                ConfirmOutcome(external_id=item.external_id, name=item.name, outcome="here")
            )
            continue
        if item.bucket == "uns":
            outcomes.append(
                ConfirmOutcome(
                    external_id=item.external_id,
                    name=item.name,
                    outcome="refused",
                    reason=item.reason,
                )
            )
            continue

        # `add` and `unk` both get opened. `unk` is where tier 2 does its job: the export runs,
        # `mint_document_row` hashes the real bytes, and a match means the file is not imported
        # again AND not embedded again.
        try:
            doc = await import_single_file(
                connection=connection,
                file_id=item.external_id,
                user_id=user_id,
                active_org=str(active_org),
                background_tasks=background_tasks,
                supabase=supabase,
                folder_id=destination_folder_id,
                external_id=item.external_id,
                source_version=item.modified_at,
                source_system=system,
            )
        except Exception as exc:  # noqa: BLE001 — a refusal is NAMED, never a silent drop
            outcomes.append(
                ConfirmOutcome(
                    external_id=item.external_id,
                    name=item.name,
                    outcome="refused",
                    reason=str(exc)[:400] or "This file could not be read.",
                )
            )
            continue

        if doc.get("_already_here"):
            outcomes.append(
                ConfirmOutcome(
                    external_id=item.external_id,
                    name=item.name,
                    outcome="here",
                    document_id=str(doc.get("id")) if doc.get("id") else None,
                )
            )
        else:
            added += 1
            outcomes.append(
                ConfirmOutcome(
                    external_id=item.external_id,
                    name=item.name,
                    outcome="added",
                    document_id=str(doc.get("id")) if doc.get("id") else None,
                )
            )

    # ⚠ `unaccounted` is measured against what was ASKED FOR, not against the whole folder — a
    #   person who ticked 3 of 26 has not left 23 unaccounted, they declined them. Comparing to
    #   `preview.total` would report a shortfall on every partial import.
    asked = len(items)
    said_added = (
        preview.counts.get("add", 0)
        if selected is None
        else sum(1 for i in items if i.bucket == "add")
    )
    return ConfirmResult(
        outcomes=outcomes,
        accounted=len(outcomes),
        unaccounted=asked - len(outcomes),
        preview_said_added=said_added,
        actually_added=added,
    )
