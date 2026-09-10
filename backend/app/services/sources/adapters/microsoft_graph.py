"""Phase 238 (SRC-03 / D-238-01 … D-238-07) — Microsoft Graph source adapter (OneDrive).

Implements the Phase 232 `SourceAdapter` contract against Microsoft Graph v1.0. It is the
milestone's first independent test of the claim that *a watched source is DATA, not code*: if
this file needed the contract to change, the contract was wrong.

── ⭐ THE 302 DANCE, AND WHY IT LIVES ENTIRELY IN HERE ─────────────────────────────────────

`GET /me/drive/items/{id}/content` answers **302 Found** with a `Location` on a *different
host* (Microsoft's reference prints `https://b0mpua-by3301.files.1drv.com/...`), and
`egress.send_pinned_http` refuses redirects **by design** — `follow_redirects=False` is set
explicitly and the `redirected` reason code is raised. Those two facts are in tension, and the
tempting resolution — teach the shared binder to follow a redirect — would put a
provider-shaped flag on the ONE path every connector in the app shares.

So this adapter never calls `/content`. It does the two-step Microsoft documents:

  1. `GET …/me/drive/items/{id}?$select=…,@microsoft.graph.downloadUrl`   → `graph_read`
  2. `GET <that url>`                                                     → `graph_download`

⚠ Step 2 carries **no `Authorization` header**. The URL is preauthenticated and short-lived
(*"might expire within minutes"*), and it points at a host we can only suffix-pin — which is
exactly the call where an OAuth token should not be.

⛔ **`SourceAdapter` knows none of this.** No `follow_redirects`, no `site_id`, no hash enum.

── SharePoint ──────────────────────────────────────────────────────────────────────────────

Deferred to `SEED-256` — an ACCOUNT boundary, not a code one. SharePoint is the same API and
the same adapter pointed at `/sites/{id}/drive` instead of `/me/drive`; it is undrivable here
because a personal Microsoft account has no `/sites/` to address, and this project records a
row ⛔ blocked with its reason rather than claiming it.
"""

from __future__ import annotations

import json as jsonlib
import logging
import re
from typing import Any

from app.models.user_settings import source_max_file_bytes
from app.security.egress import send_pinned_http
from app.services.oauth_refresh_service import get_fresh_access_token
from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceAdapter,
    SourceFile,
    SourceHealth,
    SourceNode,
    SourceRegistry,
)

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

# ── ⚠ SEED-258: ~~`MAX_FILE_BYTES = 25 * 1024 * 1024  # the same ceiling google_drive.py
#    uses`~~ — REMOVED. That comment was TRUE and that is exactly the problem: it was true
#    because somebody kept it true by hand, across three files, while a fourth number in
#    `mcp_client` drifted away from all of them unnoticed. Sameness is now IDENTITY — one
#    operator setting, read through `source_max_file_bytes()`.
#    ⛔ Do not reintroduce a module constant here — that is the defect, not a convenience.

#: One `$select` for both listing calls. `parentReference` is what makes `SourceFile.path` a
#: real folder path instead of the `/<filename>` stand-in SEED-253 was planted about, and
#: `lastModifiedDateTime` is the VERSION key — nothing in this product reads a file hash
#: (D-238-03), so `file.hashes` is deliberately not selected.
SELECT_ITEM_FIELDS = (
    "id,name,size,file,folder,parentReference,lastModifiedDateTime,webUrl"
)

#: The virtual root. Drive shows two roots (My Drive / Shared Drives); OneDrive personal has
#: one. Shared/SharePoint drives would be siblings of this node, not a contract change.
VIRTUAL_ROOT_IDS = (None, "", "virtual_root", "onedrive")

#: `parentReference.path` arrives as `/drive/root:/Documents/Finance` or
#: `/drives/{drive-id}/root:/Documents/Finance`. Only the part after `root:` is a path a
#: person would recognise or write a rule against.
_PATH_PREFIX = re.compile(r"^/drives?/[^/]*/?root:|^/drive/root:")

#: Enum-ish codes only. Graph error MESSAGES quote the caller's own search text back, so a
#: message must never reach a log line or a raised string — the `_google_error_reason` rule.
_SAFE_CODE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")


def _graph_error_reason(body: bytes | str | None) -> str:
    """Return `` (code)`` built ONLY from Graph's machine-readable `error.code`, else `""`.

    ⚠ `error.message` is excluded on purpose: it echoes the request, including any search
    term a person typed. This mirrors `google_drive._google_error_reason` rather than
    inventing a second convention.
    """
    try:
        data = jsonlib.loads(body) if body else {}
        err = data.get("error") or {}
        parts: list[str] = []
        for candidate in (err.get("code"), (err.get("innerError") or {}).get("code")):
            if isinstance(candidate, str) and _SAFE_CODE.match(candidate) and candidate not in parts:
                parts.append(candidate)
        return f" ({' / '.join(parts)})" if parts else ""
    except Exception:  # noqa: BLE001
        return ""


def _folder_path(item: dict[str, Any]) -> str | None:
    """The item's own folder path, or `None` when Graph did not say.

    ⚠ Returns `None` rather than a guess. SEED-253's whole finding is that a fabricated path
    is worse than an absent one: absent means a folder-shaped rule does not match, fabricated
    means it matches the FILENAME and the rule looks alive while doing the wrong thing.
    """
    parent = item.get("parentReference") or {}
    raw = parent.get("path")
    if not isinstance(raw, str) or not raw:
        return None
    stripped = _PATH_PREFIX.sub("", raw).rstrip("/")
    return stripped or ""


@SourceRegistry.register("microsoft")
@SourceRegistry.register("microsoft_graph")
class MicrosoftGraphSourceAdapter(SourceAdapter):
    """Source adapter for OneDrive over Microsoft Graph."""

    # ── plumbing ─────────────────────────────────────────────────────────────────────────

    async def _get_auth_token(self, connection: Any) -> str:
        conn_id = getattr(connection, "id", None) or (
            connection.get("id") if isinstance(connection, dict) else None
        )
        if not conn_id:
            raise ValueError("Connection has no valid id to obtain access token.")

        token = await get_fresh_access_token(conn_id)
        if not token:
            raise ValueError("Cannot access OneDrive: Connection has no valid OAuth token.")
        return token

    @staticmethod
    def _headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    @staticmethod
    def _children_url(folder_id: str | None) -> str:
        if folder_id in VIRTUAL_ROOT_IDS:
            return f"{GRAPH_API_BASE}/me/drive/root/children"
        return f"{GRAPH_API_BASE}/me/drive/items/{folder_id}/children"

    async def _get_page(
        self,
        *,
        token: str,
        url: str,
        page_token: str | None,
        page_size: int,
        what: str,
    ) -> dict[str, Any]:
        """One page of a Graph collection, following the contract's cursor convention.

        ⭐ D-238-05 — Graph's cursor is `@odata.nextLink`, a FULL URL, where Drive's is an
        opaque token. The contract's `next_page_token: str | None` swallows it whole: we hand
        the URL back and re-issue it verbatim here. `graph_read`'s suffix pin still validates
        the host on the way out, so an absolute cursor is no weaker than a relative one — and
        `base.py` did not have to learn a second cursor shape.
        """
        params: dict[str, str] | None = None
        if page_token is not None:
            # ⛔ BUG-260910-04 / 238-REVIEW WR-02 — REFUSE AN UNRECOGNISED CURSOR. NEVER GUESS.
            #
            #   This branch used to fall through to the page-1 `params` below when the prefix
            #   did not match, with no `else: raise`. An uppercase host, a `beta` base, or a
            #   Drive-shaped opaque token arriving here therefore **silently restarted the
            #   listing at page 1**, and BOTH downstream readings of that are silent:
            #     · `walk_source_files` re-reads page 1 to `MAX_PAGES_PER_FOLDER` and reports
            #       `truncated=True, stopped_by="pages"` — "this folder is too big" about a
            #       folder that is not;
            #     · `watch_service` trips its `seen_tokens` cycle detector and sets
            #       `listing.complete = False` (so deletions correctly fail CLOSED) — **but the
            #       run still reports `success`.** A watched folder larger than one page stops
            #       importing at ~200 files, forever, while the UI says the sync worked.
            #
            # ⭐ WHY REFUSING IS THE SAFE SIDE, and this is the whole argument: `graph_read`'s
            #   suffix pin validates the host on the way OUT, so re-issuing an unexpected cursor
            #   cannot reach a foreign host — egress would refuse it loudly. Restarting reaches
            #   the RIGHT host and returns the WRONG data, which is the failure with no alarm.
            #   Given a choice between a loud wrong-host refusal and a silent wrong-data
            #   success, take the noise.
            #
            # ⚠ Case-insensitive on purpose: the host is case-insensitive per RFC 3986 §3.2.2,
            #   so an uppercase host is a LEGAL variation Graph may emit and must not be a
            #   refusal. The path segment after it is not, hence comparing the whole prefix.
            if not page_token.lower().startswith(f"{GRAPH_API_BASE.lower()}/"):
                raise ValueError(
                    f"Refusing to re-issue an unrecognised pagination cursor for {what}: "
                    f"{page_token[:60]!r}"
                    f"{'...' if len(page_token) > 60 else ''}. It does not begin with "
                    f"{GRAPH_API_BASE}/, and silently restarting the listing would return "
                    "page 1 as though it were the next page."
                )
            url = page_token
        else:
            params = {"$select": SELECT_ITEM_FIELDS, "$top": str(max(1, min(page_size, 200)))}

        resp = await send_pinned_http(
            "graph_read",
            "GET",
            url,
            params=params,
            headers=self._headers(token),
            timeout=15.0,
            max_bytes=1024 * 1024,
        )
        if resp.status_code != 200:
            reason = _graph_error_reason(resp.body)
            logger.error("Microsoft Graph %s failed (%s)%s", what, resp.status_code, reason)
            raise ValueError(f"Failed to {what}: HTTP {resp.status_code}{reason}")
        return jsonlib.loads(resp.body)

    # ── the contract ─────────────────────────────────────────────────────────────────────

    async def browse(
        self,
        connection: Any,
        folder_id: str | None = None,
        page_token: str | None = None,
    ) -> BrowsePage:
        """Browse the OneDrive folder tree."""
        if folder_id in (None, "", "virtual_root"):
            # No HTTP: the root is a label, and spending a round trip to learn a constant is
            # how a picker feels slow before it has done anything.
            return BrowsePage(
                items=[SourceNode(id="onedrive", name="OneDrive", kind="folder", has_children=True)],
                next_page_token=None,
            )

        token = await self._get_auth_token(connection)
        data = await self._get_page(
            token=token,
            url=self._children_url(folder_id),
            page_token=page_token,
            page_size=100,
            what="browse OneDrive folder",
        )

        items = [
            SourceNode(
                id=item.get("id", ""),
                name=item.get("name", ""),
                kind="folder",
                has_children=bool((item.get("folder") or {}).get("childCount", 1)),
                parent_id=folder_id,
            )
            for item in data.get("value", [])
            if item.get("folder") is not None
        ]
        return BrowsePage(items=items, next_page_token=data.get("@odata.nextLink"))

    async def list_files(
        self,
        connection: Any,
        folder_id: str | None = None,
        recursive: bool = False,
        page_token: str | None = None,
        query: str | None = None,
        page_size: int = 30,
    ) -> FilePage:
        """List the non-folder children of a OneDrive folder, or search the drive."""
        token = await self._get_auth_token(connection)

        if query:
            # ⚠ `search(q=…)` rather than `$filter=startswith(name,…)`: `$filter` on `name` is
            # not supported uniformly across drive kinds, and a filter that silently returns
            # nothing reads to a person as "no results" rather than "unsupported".
            safe = query.replace("'", "''")
            url = f"{GRAPH_API_BASE}/me/drive/root/search(q='{safe}')"
        else:
            url = self._children_url(folder_id)

        data = await self._get_page(
            token=token,
            url=url,
            page_token=page_token,
            page_size=page_size,
            what="list OneDrive files",
        )

        files: list[SourceFile] = []
        for item in data.get("value", []):
            if item.get("folder") is not None or item.get("file") is None:
                continue
            folder = _folder_path(item)
            name = item.get("name", "")
            files.append(
                SourceFile(
                    id=item.get("id", ""),
                    name=name,
                    mime_type=(item.get("file") or {}).get("mimeType") or "application/octet-stream",
                    size=item.get("size") if isinstance(item.get("size"), int) else None,
                    # THE VERSION KEY (D-238-03). No hash is read anywhere in this product.
                    modified_at=item.get("lastModifiedDateTime"),
                    web_view_url=item.get("webUrl"),
                    # SEED-253: a REAL folder path, or None. Never `/<filename>`.
                    path=f"{folder}/{name}" if folder is not None else None,
                )
            )
        return FilePage(files=files, next_page_token=data.get("@odata.nextLink"))

    async def read_file(
        self,
        connection: Any,
        file_id: str,
    ) -> tuple[str, bytes, str]:
        """Download a file — the documented two-step, and never `/content` (D-238-01)."""
        token = await self._get_auth_token(connection)

        # ⚠⚠ NO `$select` HERE, AND THAT IS THE OPPOSITE OF WHAT MICROSOFT DOCUMENTS.
        # Measured against a live personal OneDrive on 2026-09-07, four variants, same item:
        #
        #   $select=<all fields>,@microsoft.graph.downloadUrl   -> annotation ABSENT
        #   $select=id,name,size,file,@microsoft.graph.downloadUrl -> annotation ABSENT
        #   ?select=id,@microsoft.graph.downloadUrl               -> annotation ABSENT
        #     ^ this is Microsoft's OWN example, verbatim, from
        #       learn.microsoft.com/graph/api/driveitem-get-content
        #   no $select at all                                     -> annotation PRESENT
        #
        # ANY projection suppresses the instance annotation. The docs are wrong (or the
        # consumer endpoint does not honour them), so the request asks for the whole item.
        #
        # ⛔ DO NOT "optimise" this by adding a $select back. It costs a slightly larger
        # response and it is the difference between every download working and none of them
        # working. The unit suite could not catch this — its fake returned the annotation
        # unconditionally, so it agreed with the implementation rather than with Graph. A
        # test now pins the ABSENCE of $select, which is the only part a double can check.
        meta_resp = await send_pinned_http(
            "graph_read",
            "GET",
            f"{GRAPH_API_BASE}/me/drive/items/{file_id}",
            headers=self._headers(token),
            timeout=30.0,
            max_bytes=256 * 1024,
        )
        if meta_resp.status_code != 200:
            reason = _graph_error_reason(meta_resp.body)
            raise ValueError(f"Failed to fetch file metadata: HTTP {meta_resp.status_code}{reason}")

        meta = jsonlib.loads(meta_resp.body)
        filename = meta.get("name") or f"file_{file_id}"
        mime_type = (meta.get("file") or {}).get("mimeType") or "application/octet-stream"
        download_url = meta.get("@microsoft.graph.downloadUrl")

        if not isinstance(download_url, str) or not download_url:
            # A named failure rather than a fall-back to `/content`, which would be refused as
            # `redirected` and read as an egress bug instead of a missing field.
            raise ValueError(
                "Graph returned no @microsoft.graph.downloadUrl for this item — refusing to "
                "fall back to /content, which answers a redirect this app does not follow."
            )

        # ⚠ NO Authorization header. The URL is preauthenticated, and it is the one call here
        # whose host is only suffix-pinned. `graph_download`'s allow-list is the fence, and any
        # EgressRefused it raises propagates — an unreadable file must never become empty bytes.
        dl_resp = await send_pinned_http(
            "graph_download",
            "GET",
            download_url,
            headers={"Accept": "*/*"},
            timeout=60.0,
            max_bytes=source_max_file_bytes(),
        )
        if dl_resp.status_code != 200:
            raise ValueError(f"Failed to download file content: HTTP {dl_resp.status_code}")

        return filename, dl_resp.body, mime_type

    async def check(
        self,
        connection: Any,
    ) -> SourceHealth:
        """Verify token freshness and that the drive is reachable."""
        try:
            token = await self._get_auth_token(connection)
            resp = await send_pinned_http(
                "graph_read",
                "GET",
                f"{GRAPH_API_BASE}/me/drive",
                params={"$select": "id,driveType,owner"},
                headers=self._headers(token),
                timeout=10.0,
                max_bytes=64 * 1024,
            )
            if resp.status_code != 200:
                reason = _graph_error_reason(resp.body)
                return SourceHealth(ok=False, error=f"HTTP {resp.status_code}{reason}")

            data = jsonlib.loads(resp.body)
            user = ((data.get("owner") or {}).get("user")) or {}
            return SourceHealth(
                ok=True,
                details={
                    "display_name": user.get("displayName"),
                    "email": user.get("email") or user.get("userPrincipalName"),
                    "drive_type": data.get("driveType"),
                },
            )
        except Exception as exc:  # noqa: BLE001
            return SourceHealth(ok=False, error=str(exc))
