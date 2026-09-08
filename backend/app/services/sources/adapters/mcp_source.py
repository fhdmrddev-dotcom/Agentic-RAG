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
reads them and falls back to the filesystem-server defaults **per key**, and `SourceRegistry`
resolves this adapter by PROTOCOL (`auth_type == "mcp"`, or the presence of a binding) rather
than by vendor.

⚠ **THIS PARAGRAPH USED TO CLAIM "nothing anywhere else in the codebase knows any tool name"
AND THAT WAS FALSE ON THE DAY IT WAS WRITTEN** (Phase 239 review, ME-05).
`connector_service.py` held `("list_directory", "list_dir", "list_files", "ls", "browse")` and
a matching reader tuple in a membership test, far above `adapters/`, for the whole of the
phase that wrote this sentence. Worse, `test_boundary_fence.py` could not have found it: that
module was not in `FENCED_MODULES` and the fence's literal set held vendor names only. **The
claim was enforced by nothing, so it was decoration.**

⭐ It is now TRUE BY CONSTRUCTION, which is a different thing from being asserted more firmly.
The vocabulary and the detector both moved into this file (see "THE TOOL VOCABULARY" below);
`connector_service.infer_source_tools` is a delegation holding no literal; and
`test_boundary_fence.py` gained `TOOL_LITERALS` + `TOOL_FENCED_MODULES`, driven RED by
planting `if name in ("list_directory", "ls")` into the shipped `connector_service.py` and
watching the fence name the line, then restoring the file md5-identical.

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
refuse at the same size (TM-239-03).

⚠ ~~But on THIS transport the real limit is upstream and much lower: `mcp_client.MAX_MCP_BODY_BYTES`
is **2 MB** … so a file over roughly **1.5 MB** is refused by the client before this ceiling can be
reached.~~ **RESOLVED 2026-09-08, and the original is struck through rather than deleted because the
note did its job.** It ended *"somebody raising the client's cap must find this note"* — somebody did.
`MAX_MCP_BODY_BYTES` is now **34 MB** (25 MB × 4/3 + envelope headroom), so **this ceiling is the one
users actually meet** and the refusal comes from here, in words, instead of as a transport error.
⛔ The two constants are now pinned IN RELATION, not independently, by
`tests/unit/services/sources/test_239_body_cap_admits_the_file_ceiling.py` — each was individually
defensible, which is exactly why pinning them separately would never have caught the disagreement.
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

#: The label the picker shows before anything has been fetched.
#:
#: ⛔ NOT `""`. The contract's conformance suite requires a non-empty `SourceNode.id`, and an
#: empty root id makes `browse(root)` indistinguishable from `browse(None)` — a picker walking
#: down from what it was handed would loop forever.
#:
#: ⚠ AND NOT `"virtual_root"` EITHER, WHICH IS WHAT IT WAS (review LO-06). Every id this
#: adapter emits is a PATH on the remote server, so the sentinel lived in the same namespace
#: as real data: a server whose root contained a directory literally called `virtual_root`
#: had it silently rewritten to `root_path` on browse — the folder the person clicked and a
#: different folder entirely were the same string. `mcp:root` cannot be produced by `_join`,
#: which only ever concatenates a folder path and an entry name.
#:
#: ⚠ NOT `"\x00virtual_root"`, which the review offered as the alternative: a NUL byte in a
#: value that reaches `connector_watches.source_folder_id` is a Postgres `22P05`, which is
#: the defect v3.7's UAT caught in a `.msg` subject line. A sentinel must survive the column
#: it is stored in.
#:
#: ⚠ NO MIGRATION IS OWED. `SEED-257` records that MCP sources could not be driven locally at
#: all, and this family has never shipped past `develop`, so no row can carry the old value.
#: Had one existed, the old string would have to stay in `VIRTUAL_ROOT_IDS` as a legacy arm.
VIRTUAL_ROOT_ID = "mcp:root"
VIRTUAL_ROOT_IDS = (None, "", VIRTUAL_ROOT_ID)

#: `[DIR] name` / `[FILE] name (1234 bytes)` — the shape `list_directory` actually answers in.
_LINE = re.compile(r"^\s*\[(?P<kind>DIR|FILE)\]\s+(?P<name>.+?)\s*$", re.IGNORECASE)
_SIZE_SUFFIX = re.compile(r"^(?P<name>.*?)\s*\((?P<size>[\d,_]+)\s*bytes?\)$", re.IGNORECASE)

#: Every spelling of "this entry is a directory" — both as a wire-format `type` value and as
#: a word inside a tool's NAME. ⚠ This is a DATA table about a WIRE FORMAT, not a table of
#: servers: it names no vendor and grows by one string, never by one branch.
#:
#: ⚠ ONE SPELLING, BECAUSE THERE WERE TWO (review LO-04). `connector_service.py` carried
#: `("directory", "directories", "folder", "folders")` under this same name while this set
#: read `{"dir", "directory", "folder"}` — same name, same concept, different membership, so
#: `type: "folders"` was a directory to one reader and a file to the other. This is the union
#: of the two, and it is now the only one.
_DIR_WORDS = frozenset({"dir", "dirs", "directory", "directories", "folder", "folders"})
_TIME_KEYS = ("modified_at", "modifiedAt", "modified", "mtime", "lastModified", "last_modified")
_NAME_KEYS = ("name", "filename", "basename")
_PATH_KEYS = ("path", "uri", "full_path", "fullPath")


# ── ⭐ THE TOOL VOCABULARY, AND WHY EVERY TOOL NAME IN THIS PRODUCT LIVES IN THIS ONE FILE ─
#
# ⚠ **THIS MODULE'S OPENING CLAIM — "nothing anywhere else in the codebase knows any tool
# name" — WAS FALSE ON THE DAY IT WAS WRITTEN** (Phase 239 review, ME-05).
# `connector_service.py` held `("list_directory", "list_dir", "list_files", "ls", "browse")`
# in a membership test, far ABOVE `services/sources/adapters/`, and `test_boundary_fence.py`
# structurally could not see it: that module was not in `FENCED_MODULES`, and the fence's
# literal set held vendor names only — never a tool name. An invariant enforced by nothing is
# a hope with a docstring.
#
# ⭐ SO THE VOCABULARY MOVED HERE RATHER THAN THE SENTENCE BEING SOFTENED. Detection IS
# vocabulary, and vocabulary is what this file is; `connector_service.infer_source_tools` is
# now a delegation that holds no tool literal at all. `test_boundary_fence.py` gained a
# `TOOL_LITERALS` scan across every source-path module above `adapters/`, with a positive
# control, so the next name to leak upward fails by line number instead of by review.


#: Lister names, IN PREFERENCE ORDER. The order is the point: a server may offer two, wire
#: order is arbitrary, and a binding that took the first match would flip between two
#: discoveries of the same server and silently re-point a watched source.
#:
#: ⚠ `list_directory_with_sizes` IS FIRST, AND THAT ORDERING IS THE WHOLE OF ME-02.
#: `list_directory` answers `[FILE] name` — no size, no timestamp — so `_version` returns
#: `None` for every entry, so `watch_service`'s `if item_mod and existing_ver and …` branch
#: can NEVER run: the folder ingests once and then reports `checked · 0 changes` forever while
#: its files are edited daily. The reference server offers BOTH tools; preferring the one that
#: states sizes is what makes modification detection possible at all on this family.
_LIST_TOOL_NAMES: tuple[str, ...] = (
    "list_directory_with_sizes",
    "list_directory",
    "list_dir",
    "list_files",
    "ls",
    "browse",
)

#: Reader names, IN PREFERENCE ORDER.
_READ_TOOL_NAMES: tuple[str, ...] = (
    "read_file", "get_file_contents", "view_file", "cat", "read",
)

#: ⛔ A tool whose NAME says it CHANGES something is never a candidate for either role — and
#: is refused at the write boundary too (`connector_service.reject_unoffered_source_tools`),
#: which is the half that was missing. The one mistake on this surface that is not merely
#: wrong but destructive is binding `write_file` or `delete_file` as the READER: it accepts
#: `path`, and `watch_service` calls the reader on every file in the folder, unattended, on
#: every cycle.
#:
#: ⚠ MATCHED AS WHOLE TOKENS, NEVER AS SUBSTRINGS (review ME-04). The substring form was
#: measured to refuse `list_assets` (`set` ⊂ `assets`), `get_asset`, `read_dataset`,
#: `input_file` (`put` ⊂ `input`) and `output_list` — so a server whose lister is
#: `list_assets` and whose reader is `read_dataset` got NO binding at all, silently fell back
#: to defaults that server does not have, and answered 502 with nothing naming the cause.
_MUTATION_WORDS: frozenset[str] = frozenset({
    "write", "overwrite", "create", "delete", "remove", "rename", "move", "copy",
    "upload", "put", "append", "edit", "update", "modify", "mkdir", "rmdir", "rm",
    "unlink", "send", "post", "patch", "set", "save", "insert", "purge", "drop",
    "clear", "destroy", "trash", "truncate", "exec", "execute", "kill", "revoke",
})

_CAMEL_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")
_NOT_ALNUM = re.compile(r"[^a-z0-9]+")


def _tokens(name: str) -> frozenset[str]:
    """`readFile`, `read_file` and `read-file` all -> `{"read", "file"}`.

    ⚠ camelCase is split BEFORE lower-casing, or `readFile` collapses to the single token
    `readfile` and every whole-token rule below silently stops applying to half the servers
    in existence — including, for `deleteFile`, the destructive half.
    """
    spaced = _CAMEL_BOUNDARY.sub(" ", str(name))
    return frozenset(t for t in _NOT_ALNUM.split(spaced.lower()) if t)


def looks_like_a_mutation(name: str) -> bool:
    """Whether this tool's own NAME says it changes something.

    ⭐ THE NAME — not the description, not the annotations. It is the part a server cannot
    make safe by decorating it, and it is the exact string that reaches `params.name` on the
    wire. Public because the write boundary in `connector_service` needs it: a guard that
    lives only in the auto-detector is not a boundary (review CR-01).
    """
    return bool(_tokens(name) & _MUTATION_WORDS)


#: Parameter names that mean "somewhere on a file surface".
_PATH_PARAMS: frozenset[str] = frozenset(
    {"path", "directory", "dir", "dir_path", "folder", "folder_path", "file_path", "filepath"}
)

#: ⛔ Parameter names that mean "here is the new content". A tool that ACCEPTS content
#: WRITES it, whatever it calls itself — a SHAPE signal, which is the kind a server cannot
#: author its way around the way it can author a description.
_WRITE_PARAMS: frozenset[str] = frozenset(
    {"content", "contents", "data", "body", "payload", "text", "bytes",
     "source", "destination", "dest", "new_path", "newpath", "target"}
)

_LIST_WORDS: frozenset[str] = frozenset(
    {"list", "ls", "enumerate", "browse", "contents", "entries", "walk", "index"}
)
_READ_WORDS: frozenset[str] = frozenset(
    {"read", "fetch", "get", "cat", "contents", "download", "retrieve", "view", "open", "load"}
)
_FILE_WORDS: frozenset[str] = frozenset(
    {"file", "files", "document", "documents", "doc", "docs"}
)

#: The rank given to a tool matched by SHAPE rather than by name — below every known name, so
#: a server offering both `read_file` and something shape-matched still binds the known one.
_SCHEMA_RANK: int = len(_LIST_TOOL_NAMES) + len(_READ_TOOL_NAMES) + 1


def _schema_params(input_schema: Any) -> set[str]:
    """The parameter names a tool declares — total over every malformed shape a server sends.

    ⚠ Never raises. This runs inside discovery, and a server that answers oddly must not turn
    a refresh into a 502 — `discover_tools`'s blanket handler would call it a bad gateway.
    """
    if not isinstance(input_schema, dict):
        return set()
    properties = input_schema.get("properties")
    if not isinstance(properties, dict):
        return set()
    return {str(key).lower() for key in properties}


def infer_source_tools(tools: list[dict[str, Any]] | None) -> dict[str, str] | None:
    """Which of these tools LIST a directory and READ a file? Returns names, never behaviour.

    ── ⛔ WHY `description` IS NOT READ, WHICH IS THE WHOLE OF CR-02 ──────────────────

    This function used to build its haystack from ``f"{name} {description}"``.
    ``description`` is authored by the REMOTE SERVER — exactly as ``annotations`` and
    ``readOnlyHint`` are, and those are refused *structurally* by a fence in this same file
    (TM-239-02). The same trust class, one module over, unfenced. Driven against the shipped
    code before this change::

        {"name": "purge_documents",
         "description": "Retrieve the contents of a file at the given path.",
         "inputSchema": {"properties": {"path": {…}}}}
            ->  {"read_tool": "purge_documents"}

    One press of **Refresh actions** wrote that onto the row, and every later preview, import
    and watch cycle then invoked ``purge_documents`` on every file the same server listed.
    **The server chose which of its own tools this application runs, unattended, with a
    sentence.** So the detector now judges the NAME and the SCHEMA SHAPE and nothing else:
    the name because it is the string that actually reaches ``params.name``, the schema
    because a tool that accepts ``content`` writes it whatever it says about itself.

    Two doors, and the second is what makes a server nobody has met usable on day one:

      1. **By name** — `list_directory` / `ls`, `read_file` / `cat`. Exact and ranked.
      2. **By shape** — an unrecognised name that takes a path-ish parameter, accepts NO
         content parameter, and whose OWN NAME says it lists a directory or reads a file.
         An ALLOW-LIST of shapes rather than a deny-list of words: a name this app cannot
         recognise binds NOTHING and falls to the operator's picker in Settings, which is
         the designed escape hatch and is fail-closed.

    ⛔ EVERY VALUE RETURNED IS A NAME THAT WAS HANDED IN (TM-239-05). These are interpolated
    into a JSON-RPC ``params.name`` by ``mcp_client.call_tool``; a name this function invented
    would reach the transport with nothing in between.

    ⚠ ``None``, NOT ``{}``, when nothing is found — and the difference is load-bearing.
    ``sources.base.CONFIG_PROTOCOL_MARKERS`` resolves any connection carrying a non-empty
    ``source_tools`` to ``McpSourceAdapter``, so an empty mapping would declare an intent
    nobody expressed. ``McpConfig.source_tools`` records the same distinction: absent means
    nobody bound this connection to a file surface; empty means somebody looked and named
    nothing.

    ⚠ A HALF-DETECTION IS RETURNED, not discarded. The adapter's defaults apply PER KEY, so a
    row carrying only ``read_tool`` still gets the default lister. A key nobody detected is
    ABSENT rather than an empty string, which would be a tool name the server does not have.
    """
    candidates: list[tuple[str, set[str], frozenset[str]]] = []
    for item in tools or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name or looks_like_a_mutation(name):
            continue
        candidates.append((name, _schema_params(item.get("inputSchema")), _tokens(name)))

    def _is_a_listing(tokens: frozenset[str]) -> bool:
        return bool(tokens & _DIR_WORDS) and bool(tokens & _LIST_WORDS)

    def _is_a_read(tokens: frozenset[str]) -> bool:
        # ⚠ A reader must NOT advertise directories. `enumerate_folder_contents` says
        # "contents" and would otherwise match both roles; the directory word is what
        # separates the tool that walks a folder from the one that opens a document.
        if tokens & _DIR_WORDS:
            return False
        return bool(tokens & _READ_WORDS) and bool(tokens & _FILE_WORDS)

    def _best(pool, known: tuple[str, ...], shape_test) -> str | None:
        scored: list[tuple[int, str]] = []
        for name, params, tokens in pool:
            lowered = name.lower()
            if lowered in known:
                scored.append((known.index(lowered), name))
            elif params & _PATH_PARAMS and not (params & _WRITE_PARAMS) and shape_test(tokens):
                scored.append((_SCHEMA_RANK, name))
        # The name is the tie-break, so two shape-matched tools resolve identically whatever
        # order the server listed them in.
        return min(scored, key=lambda pair: (pair[0], pair[1]))[1] if scored else None

    list_tool = _best(candidates, _LIST_TOOL_NAMES, _is_a_listing)
    remaining = [c for c in candidates if c[0] != list_tool]
    read_tool = _best(remaining, _READ_TOOL_NAMES, _is_a_read)

    inferred = {
        key: value
        for key, value in (("list_tool", list_tool), ("read_tool", read_tool))
        if value
    }
    return inferred or None


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
    grants = _attr(connection, "tool_grants", None)

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
            if grants is None:
                grants = getattr(resolved, "tool_grants", None)

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

    binding = _Binding(
        server_url=str(server_url),
        secret=secret,
        auth_scheme=str(auth_scheme),
        list_tool=str(tools.get("list_tool") or DEFAULT_LIST_TOOL),
        read_tool=str(tools.get("read_tool") or DEFAULT_READ_TOOL),
        root_path=str(tools.get("root_path") or ""),
    )
    _refuse_denied_tools(binding, grants)
    return binding


def _refuse_denied_tools(binding: _Binding, tool_grants: Any) -> None:
    """⛔ ME-01 — A TOOL SET TO `deny` WAS STILL CALLABLE AS THE SOURCE READER.

    The source path calls `mcp_client.call_tool` directly; the approval posture lives in
    `tool_dispatcher`, which sits above the AGENT path only. So an operator could set
    `tool_grants = {"read_file": "deny"}` — a deliberate, recorded refusal — and the watch
    loop would go on calling `read_file` on every file in the folder. A grant that reads as
    configured and grants nothing is exactly the state `_sanitize_tool_grants` raises to
    prevent one column over.

    ── ⚠ AN ABSENT KEY IS NOT A DENY HERE, AND THE ASYMMETRY IS STATED RATHER THAN ASSUMED ──

    `phase_types.py` GATE 6 denies a tool with no grant, because an agent asking to run
    something nobody authorised should be refused. A SOURCE binding is the opposite shape: it
    was chosen by a person in Settings (or detected and shown to them), it reads and never
    writes, and every MCP row that exists today carries no grants at all — so deny-by-default
    here would silently break every working source rather than close a hole. **What is honoured
    is an EXPLICIT deny**, which is the only thing a person ever actually expressed.

    This is a real difference in posture between two surfaces that share a column, and the
    review was right that it was neither implemented nor written down. It is now both.
    """
    if not isinstance(tool_grants, dict):
        return
    for role, tool in (("list_tool", binding.list_tool), ("read_tool", binding.read_tool)):
        posture = tool_grants.get(tool)
        if isinstance(posture, str) and posture.strip().lower() == "deny":
            raise ValueError(
                f"This connection is bound to {tool!r} as its {role}, and {tool!r} is set to "
                f"'deny' on this connection. Refused rather than called: a denial that the "
                f"source path ignored would read as configured and grant nothing. Either "
                f"change the grant, or bind a different tool in Settings."
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
        # ⭐ AN EXPLICIT EMPTY CONTAINER IS AN ANSWER. `{"entries": []}` or `[]` is the server
        # SAYING there is nothing here, which is legitimately a complete, empty listing.
        return [_entry_from_item(item, folder_path) for item in entries]

    lines = [line for line in text.splitlines() if line.strip()]
    parsed: list[_Entry] = []
    for line in lines:
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

    # ⛔ HI-03 — THE FAIL-OPEN IN A GUARD WHOSE ENTIRE PURPOSE IS TO FAIL CLOSED.
    #
    # `McpToolResultError`'s own docstring calls this "the worst defect available on this
    # path: a listing error becomes an EMPTY listing (which is what the H-5 deletion guard
    # consumes)" — and then this parser caught only the `isError` FIELD. Anything else the
    # parser did not recognise fell through both doors and returned `[]`. Driven::
    #
    #     _parse_listing({"isError": False, "text": "permission denied"}, "/docs")  ->  []
    #
    # `list_files` always answers `next_page_token=None`, so `watch_service` stamps
    # `listing.complete = True` on the first pass. An unparsed refusal therefore produces the
    # exact state H-5 exists to refuse — **complete, and zero files** — and the next tick
    # marks every tracked item `missing`, stamps `source_state` on every document minted from
    # that folder, and REPORTS SUCCESS.
    #
    # ⚠ THE DISTINCTION IS BETWEEN TWO SILENCES: "the server said there is nothing here" and
    # "I did not understand the answer". Only the first may be complete. An empty body is
    # still a legitimately empty folder; a body with content that yielded no entries is not.
    if lines and not parsed:
        raise McpToolResultError(
            "The server answered this listing in a shape this app does not understand, so "
            "nothing was read. Refused rather than reported as an empty folder: an empty "
            "listing is what the deletion guard consumes, and it would mark every file in "
            f"this folder as missing. The server said: {text[:200]!r}"
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


def _decode_content(result: dict[str, Any]) -> tuple[bytes, str | None, bool]:
    """D-239-07 — the payload, the MIME type the SERVER stated, and WHETHER IT SENT ANYTHING.

    ⚠ Size is checked on the DECODED bytes. Base64 inflates by 4/3, so a check on the encoded
    string would refuse a legal payload and — the direction that matters — admit one a third
    over the ceiling.

    ⭐ THE THIRD RETURN VALUE IS ME-03, AND IT IS THE DIFFERENCE BETWEEN TWO ZEROES.
    `read_file` used to raise on `not payload`, three lines under a comment stating that *"an
    empty file is legal; an UNREADABLE file arriving as b'' is not, and the two must not look
    alike"* — the comment named the requirement and the code collapsed both into the error
    arm. An MCP `read_file` on a 0-byte file answers
    `content: [{"type": "text", "text": ""}]`, which decodes to `b""`, so a watched folder
    holding one empty `.md` placeholder raised for that item on EVERY cycle, forever, for a
    file that was exactly what it appeared to be. `saw_a_block` says whether the server sent
    a content block at all, which is the fact the two cases actually differ on.
    """
    blocks = result.get("content")
    chunks: list[bytes] = []
    stated_mime: str | None = None
    saw_a_block = False

    if isinstance(blocks, list):
        for block in blocks:
            if not isinstance(block, dict):
                continue
            kind = str(block.get("type") or "")
            if kind == "text":
                saw_a_block = True
                chunks.append(str(block.get("text") or "").encode("utf-8"))
            elif kind == "resource":
                resource = block.get("resource")
                if not isinstance(resource, dict):
                    continue
                saw_a_block = True
                stated_mime = stated_mime or _first_str(resource, ("mimeType", "mime_type"))
                if isinstance(resource.get("blob"), str):
                    chunks.append(_b64(resource["blob"]))
                elif isinstance(resource.get("text"), str):
                    chunks.append(resource["text"].encode("utf-8"))
            elif kind in ("image", "audio") and isinstance(block.get("data"), str):
                saw_a_block = True
                stated_mime = stated_mime or _first_str(block, ("mimeType", "mime_type"))
                chunks.append(_b64(block["data"]))
            _guard(chunks)

    if not chunks:
        text = str(result.get("text") or "")
        if text:
            saw_a_block = True
            chunks.append(text.encode("utf-8"))
            _guard(chunks)

    return b"".join(chunks), stated_mime, saw_a_block


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
        try:
            return _parse_listing(result, folder_path)
        except McpToolResultError as exc:
            # ⚠ HI-04, AS A DIAGNOSIS RATHER THAN AS A VERDICT — and the distinction is
            # deliberate, because only half of that finding is verified.
            #
            # VERIFIED: `root_path` defaults to `""`, `infer_source_tools` never produces it,
            # and the Settings panel renders NO CONTROL for it — so the virtual root always
            # resolves to `{"path": ""}` and the only way to set one is a hand-crafted PATCH.
            # SUSPECTED: that `""` is what the server refuses. `SEED-257` records that MCP
            # sources cannot be driven locally at all, so nobody has seen the answer, and two
            # shipped tests assert the opposite claim — that an empty path addresses the
            # server's own default root. Refusing the empty root outright would pick one
            # unverified belief over another AND break every server that is rooted at `""`.
            #
            # So the empty path is NAMED at the moment it plausibly caused a failure, and
            # nothing is refused on a guess. ⛔ THE UI CONTROL IS STILL OWED — see
            # `239-04-SUMMARY.md`; it is a frontend change and it belongs to nobody's scope yet.
            if not folder_path:
                raise McpToolResultError(
                    f"{exc} — and the path sent was EMPTY, because this connection has no "
                    "root folder set. Most MCP file servers scope reads to an allow-list of "
                    "absolute directories and refuse an empty path. The root folder is "
                    "`source_tools.root_path` on the connection."
                ) from exc
            raise

    # ── the contract ─────────────────────────────────────────────────────────────────────

    async def browse(
        self,
        connection: Any,
        folder_id: str | None = None,
        page_token: str | None = None,
    ) -> BrowsePage:
        """Browse the server's folder tree."""
        # ⚠ LO-02 — THE BINDING IS RESOLVED FIRST, EVEN THOUGH THE ROOT IS A CONSTANT.
        # This used to return the root before any validation, so a row with no
        # `mcp_server_url` (or a malformed `source_tools`) rendered a folder named after the
        # connection and failed only on the NEXT click — the failure was attributed to the
        # folder rather than to the row. Resolving costs no round trip to the SERVER; it
        # validates the row and, at most, re-reads it when the caller handed in an object
        # that carries no credential.
        binding = await _resolve_binding(connection)

        if folder_id in (None, ""):
            # No round trip to the server: the root is a label, and spending a call to learn
            # a constant is how a picker feels slow before it has done anything.
            binding_name = str(_attr(connection, "name", "") or "Files")
            return BrowsePage(
                items=[SourceNode(
                    id=VIRTUAL_ROOT_ID, name=binding_name, kind="folder", has_children=True
                )],
                next_page_token=None,
            )

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

        payload, stated_mime, saw_a_block = _decode_content(result)
        filename = posixpath.basename(str(file_id).replace("\\", "/").rstrip("/")) or str(file_id)

        if not saw_a_block:
            # ⚠ An empty file is legal; an UNREADABLE file arriving as `b""` is not, and the
            # two must not look alike — a silent `b""` is minted as an empty document and
            # reads as a successful sync forever after.
            #
            # ⭐ ME-03: the test is now "did the server send a content block?", not "are the
            # bytes empty?". A 0-byte file sends a block whose text is `""`; a server that
            # answered nothing at all sends no block. The comment above stated exactly this
            # requirement while the code three lines under it collapsed both into the error.
            raise McpToolResultError(
                f"The server returned no content blocks for {filename!r}, so nothing was "
                f"imported. (A 0-byte file is not this case — that arrives as an empty "
                f"content block and is imported as the empty file it is.)"
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
