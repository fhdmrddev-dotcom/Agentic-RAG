"""Phase 239 (SRC-04 / D-239-01 … D-239-07) — the MCP file-source adapter.

Implements the Phase 232 `SourceAdapter` contract against **any** MCP server that exposes a
file surface, by delegating every byte to `mcp_client`.

── ⭐ THE POINT OF THIS FILE IS WHAT IS *NOT* IN IT ─────────────────────────────────────────

MCP file servers do not agree on names. `@modelcontextprotocol/server-filesystem` says
`list_directory` / `read_file`; others say `list_files`, `ls`, `cat`, `get_file_contents`. The
obvious implementation is a small table of known servers and an `elif` per dialect — and that
is precisely the outcome this milestone's binding constraint forbids, because it makes
*connecting a new server* a code change, a review, a deploy.

So the vocabulary is a **ROW**: `connector_connections.config["source_tools"]`, three optional
string keys (`list_tool`, `read_tool`, `root_path`), validated by `McpConfig`. This module
reads them and falls back to the filesystem-server defaults **per key**. Nothing anywhere else
in the codebase knows any tool name, and `SourceRegistry` resolves this adapter by PROTOCOL
(`auth_type == "mcp"`, or the presence of a binding) rather than by vendor.

⛔ **If you find yourself adding a server name, a tool name or a dialect check to a conditional
— here or, far worse, above `adapters/` — the claim is already false.** The parametrized rows
in `test_239_mcp_source_adapter.py` drive a vocabulary (`ls`/`cat`) that appears nowhere in
this repository except as data, so that failure is loud rather than theoretical.

── THE SECURITY BOUNDARY, AND WHY IT IS ENTIRELY SOMEBODY ELSE'S ────────────────────────────

`McpClient` validates the destination (`validate_mcp_destination`: RFC1918, loopback, cloud
metadata), rewrites the URL to the pinned IP against DNS rebinding while keeping the TLS SNI
hostname, refuses redirects, disables proxy env, and caps the response body. **This module
opens no socket of its own**, and `test_the_adapter_opens_NO_socket_of_its_own` refuses the
imports that would let it (TM-239-01).

⚠ **A SERVER-ADVERTISED HINT DECIDES NOTHING HERE** (TM-239-02). `readOnlyHint`,
`destructiveHint` and the rest of `annotations` are authored by the REMOTE end. They may be
shown to a person; they may never widen a permission or skip a confirmation. That is asserted
structurally — a behavioural test can only check the hints somebody thought to send, whereas
the fence refuses the *shape*, with a positive control.

── ⚠ THE 25 MB CEILING IS REAL CODE AND IS NOT THE BINDING CONSTRAINT ───────────────────────

`MAX_FILE_BYTES` matches `google_drive.py` and `microsoft_graph.py` so the three families
refuse at the same size (TM-239-03). But on THIS transport the real limit is upstream and much
lower: `mcp_client.MAX_MCP_BODY_BYTES` is **2 MB**, applied to the whole JSON-RPC response, and
base64 inflates a payload by 4/3 — so a file over roughly **1.5 MB** is refused by the client
before this ceiling can be reached. Recorded rather than quietly relied upon: a ceiling nobody
can reach is not a ceiling, and somebody raising the client's cap must find this note.
"""

from __future__ import annotations

import base64
import binascii
import json as jsonlib
import mimetypes
import posixpath
import re
from dataclasses import dataclass
from typing import Any

from app.services import mcp_client
from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceAdapter,
    SourceFile,
    SourceHealth,
    SourceNode,
    SourceRegistry,
)

#: The same ceiling `google_drive.py` and `microsoft_graph.py` use. See the module note above
#: for why the transport refuses long before this does.
MAX_FILE_BYTES = 25 * 1024 * 1024

#: `@modelcontextprotocol/server-filesystem`'s vocabulary, so the reference server works with
#: zero configuration. These are FALLBACKS for absent keys, applied per key — a row naming only
#: its reader keeps the default lister, because a half-configured connection that silently
#: stops browsing is worse than one that never started.
DEFAULT_LIST_TOOL = "list_directory"
DEFAULT_READ_TOOL = "read_file"

#: The label the picker shows before anything has been fetched. Shared with
#: `microsoft_graph.py` so a client that already handles one virtual root handles this one.
#:
#: ⛔ NOT `""`. The contract's conformance suite requires a non-empty `SourceNode.id`, and an
#: empty root id makes `browse(root)` indistinguishable from `browse(None)` — a picker walking
#: down from what it was handed would loop forever.
VIRTUAL_ROOT_ID = "virtual_root"
VIRTUAL_ROOT_IDS = (None, "", VIRTUAL_ROOT_ID)

#: `[DIR] name` / `[FILE] name (1234 bytes)` — the shape `list_directory` actually answers in.
_LINE = re.compile(r"^\s*\[(?P<kind>DIR|FILE)\]\s+(?P<name>.+?)\s*$", re.IGNORECASE)
_SIZE_SUFFIX = re.compile(r"^(?P<name>.*?)\s*\((?P<size>[\d,_]+)\s*bytes?\)$", re.IGNORECASE)

#: Every spelling of "this entry is a directory" seen across the servers surveyed in
#: 239-RESEARCH. ⚠ This is a DATA table about a WIRE FORMAT, not a table of servers: it names
#: no vendor and grows by one string, never by one branch.
_DIR_WORDS = frozenset({"dir", "directory", "folder"})
_TIME_KEYS = ("modified_at", "modifiedAt", "modified", "mtime", "lastModified", "last_modified")
_NAME_KEYS = ("name", "filename", "basename")
_PATH_KEYS = ("path", "uri", "full_path", "fullPath")


class McpToolResultError(ValueError):
    """The server answered, and what it said was an error.

    ⛔ `isError` is a FIELD on a 200 response, not an exception. Ignoring it is the worst
    defect available on this path: a listing error becomes an EMPTY listing (which is what the
    H-5 deletion guard consumes), and a read error becomes the sentence *"Error: permission
    denied"* minted as a document, embedded, and later answered out of the knowledge base as
    though the file had said it.
    """


@dataclass(frozen=True)
class _Binding:
    """Everything this adapter needs about a connection, resolved once per operation."""

    server_url: str
    secret: str | None
    auth_scheme: str
    list_tool: str
    read_tool: str
    root_path: str

    def wire_path(self, folder_id: str | None) -> str:
        """The path this server understands for `folder_id`.

        ⚠ ONE spelling of this rule, used by both `browse` and `list_files`. Two copies drift,
        and the drift is invisible: a virtual-root id translated in one method and not the
        other sends the literal string `"virtual_root"` to a filesystem server, which answers
        an honest ENOENT that reads as *"the folder is gone"*.
        """
        return self.root_path if folder_id in VIRTUAL_ROOT_IDS else str(folder_id)


# ── reading a connection, whatever shape it arrives in ───────────────────────────────────


def _attr(connection: Any, key: str, default: Any = None) -> Any:
    """One accessor for the three shapes a connection legitimately arrives in.

    `watch_service` hands a raw DB dict, `api/connectors.py` a `ConnectorConnectionResponse`,
    and the resolver a `ResolvedConnection`. Reading them three different ways is how a check
    ends up applied on two paths out of three.
    """
    if isinstance(connection, dict):
        value = connection.get(key, default)
    else:
        value = getattr(connection, key, default)
    return default if value is None else value


def _config_dict(connection: Any) -> dict[str, Any]:
    """`config` as a plain dict — it is a `McpConfig` model on the response path."""
    cfg = _attr(connection, "config", None)
    if cfg is None:
        return {}
    if isinstance(cfg, dict):
        return cfg
    dump = getattr(cfg, "model_dump", None)
    return dump() if callable(dump) else {}


def _carries_a_credential(connection: Any) -> bool:
    """Whether this object is a `ResolvedConnection` — i.e. already holds the secret.

    ⚠ Asked as PRESENCE, never as truthiness. `ResolvedConnection.secret` is legitimately
    `None` for an unauthenticated MCP server, so `if secret is None: re-resolve` would send a
    resolved connection back to the database on every single call — and, worse, would do it
    for exactly the rows where there is nothing to find.
    """
    if isinstance(connection, dict):
        return "secret" in connection
    return hasattr(connection, "secret")


async def _resolve_binding(connection: Any) -> _Binding:
    """Resolve the destination, the credential and the tool binding for one operation.

    ⚠ THE CREDENTIAL IS NOT ON THE CONNECTION OBJECT AND MUST NOT BE ASSUMED ABSENT.
    `ConnectorConnectionResponse` deliberately carries no secret, so browsing an authenticated
    MCP server from a response object would send **no `Authorization` header** and collect a
    `401 invalid_token` — which reads as *"your credential is wrong"* and sends somebody to
    re-authorize a credential that was fine. `mcp_client` records that exact misdiagnosis one
    layer down.

    ⭐ THE RESOLVER IS ASKED FOR THE CREDENTIAL AND NOTHING ELSE, which is exactly the seam
    `microsoft_graph.py` uses (`get_fresh_access_token(conn_id)` — a token, never a re-read of
    the row). Every caller on this path — `api/connectors.py`, `watch_service`,
    `preview_service`, `import_service` — has just fetched the row org-scoped and hands it in;
    re-reading `config` and `mcp_server_url` out of a second query would be the same row
    fetched twice, and would quietly move the org-scoping decision from the caller into here.
    """
    server_url = _attr(connection, "mcp_server_url", "")
    config = _config_dict(connection)
    secret: str | None = _attr(connection, "secret")
    auth_scheme = _attr(connection, "auth_scheme", "auto") or "auto"

    if not _carries_a_credential(connection):
        conn_id = _attr(connection, "id") or _attr(connection, "connection_id")
        org_id = _attr(connection, "org_id")
        if conn_id and org_id:
            # Function-local, for the reason `connector_service.create_connection` states: the
            # service reaches the connector registry, and the source path keeps that out of
            # the cold import graph until a connection is actually used.
            from app.services import connector_service

            resolved = await connector_service.resolve_connection(
                str(conn_id), org_id=str(org_id)
            )
            secret = resolved.secret
            auth_scheme = getattr(resolved, "auth_scheme", "auto") or "auto"

    if not server_url:
        raise ValueError(
            "This connection has no mcp_server_url, so there is no server to read from."
        )

    tools = config.get("source_tools") or {}
    if not isinstance(tools, dict):
        # A malformed binding is refused by name rather than coerced to the defaults, which
        # would read to a person as "the server is missing files" instead of "this row is
        # wrong". `McpConfig` refuses the shape on write; this covers a row written before it.
        raise ValueError("This connection's source_tools binding is not a set of tool names.")

    return _Binding(
        server_url=str(server_url),
        secret=secret,
        auth_scheme=str(auth_scheme),
        list_tool=str(tools.get("list_tool") or DEFAULT_LIST_TOOL),
        read_tool=str(tools.get("read_tool") or DEFAULT_READ_TOOL),
        root_path=str(tools.get("root_path") or ""),
    )


# ── parsing what a server said ───────────────────────────────────────────────────────────


@dataclass(frozen=True)
class _Entry:
    name: str
    path: str
    is_dir: bool
    size: int | None
    modified_at: str | None


def _as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, str):
        cleaned = value.replace(",", "").replace("_", "").strip()
        if cleaned.isdigit():
            return int(cleaned)
    return None


def _first_str(item: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value is not None and not isinstance(value, (dict, list)):
            text = str(value).strip()
            if text:
                return text
    return None


def _is_directory(item: dict[str, Any]) -> bool:
    """Every spelling of the same fact, read as data."""
    for key in ("is_directory", "isDirectory", "is_dir", "directory"):
        value = item.get(key)
        if isinstance(value, bool):
            return value
    kind = item.get("type") or item.get("kind") or item.get("entry_type")
    if isinstance(kind, str):
        return kind.strip().lower() in _DIR_WORDS
    return False


def _structured_entries(payload: Any) -> list[dict[str, Any]] | None:
    """A list of entry objects out of whatever container the server wrapped them in."""
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("entries", "files", "items", "contents", "results", "children"):
            inner = payload.get(key)
            if isinstance(inner, list):
                return [item for item in inner if isinstance(item, dict)]
    return None


def _parse_line(line: str) -> tuple[str, bool, int | None] | None:
    """`[FILE] report.pdf (1024 bytes)` -> `("report.pdf", False, 1024)`."""
    match = _LINE.match(line)
    if not match:
        return None
    is_dir = match.group("kind").upper() == "DIR"
    name = match.group("name").strip()
    size: int | None = None
    sized = _SIZE_SUFFIX.match(name)
    if sized:
        name = sized.group("name").strip()
        size = _as_int(sized.group("size"))
    return (name, is_dir, size) if name else None


def _parse_listing(result: dict[str, Any], folder_path: str) -> list[_Entry]:
    """D-239-05 — one parser, three wire shapes, no vendor anywhere.

    Structured first (`structuredContent`, then a JSON string), because a server that states
    types and sizes should never be re-derived from prose. Line-based last, because that is
    what the reference filesystem server actually answers with.
    """
    if result.get("isError"):
        raise McpToolResultError(_error_text(result) or "The server refused to list this folder.")

    raw = result.get("raw")
    payload: Any = None
    if isinstance(raw, dict):
        payload = raw.get("structuredContent")

    text = str(result.get("text") or "")
    if payload is None and text.strip().startswith(("[", "{")):
        try:
            payload = jsonlib.loads(text)
        except ValueError:
            payload = None

    entries = _structured_entries(payload)
    if entries is not None:
        return [_entry_from_item(item, folder_path) for item in entries]

    parsed: list[_Entry] = []
    for line in text.splitlines():
        hit = _parse_line(line)
        if not hit:
            continue
        name, is_dir, size = hit
        parsed.append(
            _Entry(
                name=name,
                path=_join(folder_path, name),
                is_dir=is_dir,
                size=size,
                modified_at=_version(None, size),
            )
        )
    return parsed


def _entry_from_item(item: dict[str, Any], folder_path: str) -> _Entry:
    path = _first_str(item, _PATH_KEYS)
    name = _first_str(item, _NAME_KEYS) or (posixpath.basename(path.rstrip("/")) if path else "")
    if not path:
        path = _join(folder_path, name)
    size = _as_int(item.get("size") if item.get("size") is not None else item.get("bytes"))
    return _Entry(
        name=name,
        path=path,
        is_dir=_is_directory(item),
        size=size,
        modified_at=_version(_first_str(item, _TIME_KEYS), size),
    )


def _version(stated: str | None, size: int | None) -> str | None:
    """D-239-06 — the version key, and the one place it is allowed to be derived.

    ⭐ WHY A FALLBACK EXISTS AT ALL. `watch_service`'s modification branch reads
    `if item_mod and existing_ver and item_mod != existing_ver`, so an EMPTY version means the
    file is never seen to change — silently, forever. A server that states no timestamp would
    therefore give us a folder that syncs once and then freezes while looking healthy.

    ⛔ WHY IT STOPS AT `None`. The tempting third arm is a hash of the path, which is
    deterministic, looks exactly like a version, and NEVER CHANGES — so it would report
    "unchanged" for every future edit while appearing to work. That is SEED-253's fabrication
    failure one column over, and it is worse than absence because absence is legible. `size:`
    is derived from something that actually moves when the file does; when there is nothing
    that moves, nothing is claimed.
    """
    if stated:
        return stated
    if size is not None:
        return f"size:{size}"
    return None


def _join(folder_path: str, name: str) -> str:
    folder = (folder_path or "").rstrip("/")
    if not folder:
        return name
    return f"{folder}/{name}"


def _mime_for(name: str, *, from_text: bool) -> str:
    guessed, _ = mimetypes.guess_type(name)
    if guessed:
        return guessed
    return "text/plain" if from_text else "application/octet-stream"


def _error_text(result: dict[str, Any]) -> str:
    text = str(result.get("text") or "").strip()
    return text[:300]


def _decode_content(result: dict[str, Any]) -> tuple[bytes, str | None]:
    """D-239-07 — the payload and the MIME type the SERVER stated, or `None` for "it did not".

    ⚠ Size is checked on the DECODED bytes. Base64 inflates by 4/3, so a check on the encoded
    string would refuse a legal payload and — the direction that matters — admit one a third
    over the ceiling.
    """
    blocks = result.get("content")
    chunks: list[bytes] = []
    stated_mime: str | None = None

    if isinstance(blocks, list):
        for block in blocks:
            if not isinstance(block, dict):
                continue
            kind = str(block.get("type") or "")
            if kind == "text":
                chunks.append(str(block.get("text") or "").encode("utf-8"))
            elif kind == "resource":
                resource = block.get("resource")
                if not isinstance(resource, dict):
                    continue
                stated_mime = stated_mime or _first_str(resource, ("mimeType", "mime_type"))
                if isinstance(resource.get("blob"), str):
                    chunks.append(_b64(resource["blob"]))
                elif isinstance(resource.get("text"), str):
                    chunks.append(resource["text"].encode("utf-8"))
            elif kind in ("image", "audio") and isinstance(block.get("data"), str):
                stated_mime = stated_mime or _first_str(block, ("mimeType", "mime_type"))
                chunks.append(_b64(block["data"]))
            _guard(chunks)

    if not chunks:
        text = str(result.get("text") or "")
        if text:
            chunks.append(text.encode("utf-8"))
            _guard(chunks)

    return b"".join(chunks), stated_mime


def _b64(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("The server sent a binary payload this app could not decode.") from exc


def _guard(chunks: list[bytes]) -> None:
    if sum(len(c) for c in chunks) > MAX_FILE_BYTES:
        raise ValueError(
            f"This file is too large to import — it exceeds the {MAX_FILE_BYTES} byte ceiling."
        )


@SourceRegistry.register("mcp")
@SourceRegistry.register("custom_mcp")
class McpSourceAdapter(SourceAdapter):
    """Source adapter for any MCP server exposing a file surface."""

    async def _list(self, binding: _Binding, folder_id: str | None) -> list[_Entry]:
        folder_path = binding.wire_path(folder_id)
        result = await mcp_client.call_tool(
            binding.server_url,
            binding.list_tool,
            {"path": folder_path},
            secret=binding.secret,
            auth_scheme=binding.auth_scheme,
        )
        return _parse_listing(result, folder_path)

    # ── the contract ─────────────────────────────────────────────────────────────────────

    async def browse(
        self,
        connection: Any,
        folder_id: str | None = None,
        page_token: str | None = None,
    ) -> BrowsePage:
        """Browse the server's folder tree."""
        if folder_id in (None, ""):
            # No round trip: the root is a label, and spending a call to learn a constant is
            # how a picker feels slow before it has done anything.
            binding_name = str(_attr(connection, "name", "") or "Files")
            return BrowsePage(
                items=[SourceNode(
                    id=VIRTUAL_ROOT_ID, name=binding_name, kind="folder", has_children=True
                )],
                next_page_token=None,
            )

        binding = await _resolve_binding(connection)
        entries = await self._list(binding, folder_id)
        return BrowsePage(
            items=[
                SourceNode(
                    id=entry.path,
                    name=entry.name,
                    kind="folder",
                    has_children=True,  # nothing in a listing says otherwise; a lie either way
                    parent_id=folder_id,
                )
                for entry in entries
                if entry.is_dir
            ],
            # ⚠ `list_directory` is ATOMIC — the MCP spec defines no cursor for it. `None` is
            # the contract-conformant answer, and minting a token would make `watch_service`
            # re-issue a call that returns the same page forever.
            next_page_token=None,
        )

    async def list_files(
        self,
        connection: Any,
        folder_id: str | None = None,
        recursive: bool = False,
        page_token: str | None = None,
        query: str | None = None,
        page_size: int = 30,
        # noqa: ARG002 — see the note on `page_size` below.
    ) -> FilePage:
        """List the files in one folder.

        ⚠ `page_size` IS ADVISORY HERE AND THE WHOLE LISTING IS RETURNED, deliberately.
        The server answers a directory in ONE atomic response, so slicing it client-side would
        trade a real completeness guarantee for a cosmetic one: `SourceListing.complete` (H-5)
        is what the deletion guard reads, and re-listing per page lets the directory change
        underneath the walk. `mcp_client` already bounds the response at 2 MB, so "the whole
        listing" is bounded too.

        ⚠ `recursive` and `query` are NOT implemented here and are not silently accepted as
        no-ops by accident: `preview_service.walk_source_files` performs the recursive walk
        itself, one folder at a time, through `browse` — so recursion at this level would walk
        the tree twice. The MCP spec defines no search primitive; a server that has one has it
        under a name only its row knows, which is a future third key in `source_tools`.
        """
        binding = await _resolve_binding(connection)
        folder_path = binding.wire_path(folder_id)
        entries = await self._list(binding, folder_id)
        return FilePage(
            files=[
                SourceFile(
                    id=entry.path,
                    name=entry.name,
                    mime_type=_mime_for(entry.name, from_text=False),
                    size=entry.size,
                    modified_at=entry.modified_at,
                    # SEED-253: a REAL path, because this adapter addresses files BY path.
                    # It is never the `/<filename>` stand-in the seed was planted about.
                    path=_join(folder_path, entry.name) if folder_path else entry.path,
                )
                for entry in entries
                if not entry.is_dir
            ],
            next_page_token=None,
        )

    async def read_file(
        self,
        connection: Any,
        file_id: str,
    ) -> tuple[str, bytes, str]:
        """Read one file. Returns `(filename, content_bytes, mime_type)`."""
        binding = await _resolve_binding(connection)
        result = await mcp_client.call_tool(
            binding.server_url,
            binding.read_tool,
            {"path": file_id},
            secret=binding.secret,
            auth_scheme=binding.auth_scheme,
        )

        if result.get("isError"):
            # ⛔ NEVER fall through to the content. See `McpToolResultError`.
            raise McpToolResultError(
                _error_text(result) or "The server refused to read this file."
            )

        payload, stated_mime = _decode_content(result)
        filename = posixpath.basename(str(file_id).replace("\\", "/").rstrip("/")) or str(file_id)

        if not payload:
            # ⚠ An empty file is legal; an UNREADABLE file arriving as `b""` is not, and the
            # two must not look alike — a silent `b""` is minted as an empty document and
            # reads as a successful sync forever after.
            raise McpToolResultError(
                f"The server returned no content for {filename!r}, so nothing was imported."
            )

        return filename, payload, stated_mime or _mime_for(filename, from_text=True)

    async def check(
        self,
        connection: Any,
    ) -> SourceHealth:
        """Probe the server and verify the BOUND TOOLS actually exist on it.

        ⚠ A check that only counted tools would answer *"ok"* for a connection bound to a tool
        the server does not have — the most likely misconfiguration on this surface, and one a
        person would then go hunting for in their credentials. So the binding is verified
        against the server's own `tools/list`, and the missing NAME is in the message.
        """
        try:
            binding = await _resolve_binding(connection)
            tools = await mcp_client.list_tools(
                binding.server_url,
                secret=binding.secret,
                auth_scheme=binding.auth_scheme,
            )
            available = {
                str(t.get("name") or "") for t in tools if isinstance(t, dict)
            }
            missing = [t for t in (binding.list_tool, binding.read_tool) if t not in available]
            if missing:
                return SourceHealth(
                    ok=False,
                    error=(
                        "This connection is bound to "
                        + ", ".join(repr(t) for t in missing)
                        + ", which this server does not offer."
                    ),
                    details={"tools_count": len(available), "missing_tools": missing},
                )
            return SourceHealth(
                ok=True,
                details={
                    "tools_count": len(available),
                    "list_tool": binding.list_tool,
                    "read_tool": binding.read_tool,
                },
            )
        except Exception as exc:  # noqa: BLE001 — a health probe reports, it does not raise
            return SourceHealth(ok=False, error=str(exc))
