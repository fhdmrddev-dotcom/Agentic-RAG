"""Phase 232 (SRC-01 / D-232-04) — The Source Contract Abstraction.

Defines the unified SourceAdapter contract that every source family (Google Drive,
Microsoft Graph, MCP, Mock Source) implements as a thin adapter. Adding a family
is data and registration, never an ingest path.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)


@dataclass
class SourceNode:
    """A navigable hierarchical node in an external source (folder or drive)."""

    id: str
    name: str
    kind: str = "folder"  # "folder" | "drive"
    drive_id: str | None = None
    has_children: bool = True
    parent_id: str | None = None


@dataclass
class SourceFile:
    """A file metadata item available in an external source."""

    id: str
    name: str
    mime_type: str
    size: int | None = None
    modified_at: str | None = None
    drive_id: str | None = None
    icon_url: str | None = None
    web_view_url: str | None = None
    # Stand-in path: no adapter currently populates it (production falls back to '/<filename>').
    # Real adapter folder-path resolution is deferred to SEED-253 (forcing function: Phase 238 Graph adapter).
    path: str | None = None


@dataclass
class BrowsePage:
    """A paginated page of hierarchical nodes (folders/drives)."""

    items: list[SourceNode] = field(default_factory=list)
    next_page_token: str | None = None


@dataclass
class FilePage:
    """A paginated page of files for listing and batch inspection."""

    files: list[SourceFile] = field(default_factory=list)
    next_page_token: str | None = None
    #: Carried up into `SourceListing.deletions_detectable` by the traversal loop. Default True
    #: so every existing adapter is untouched; a family that cannot prove deletion says so here.
    deletions_detectable: bool = True


@dataclass
class SourceListing:
    """Aggregated listing resulting from an exhaustive folder traversal loop (SRC-06 / H-5)."""

    files: list[SourceFile] = field(default_factory=list)
    complete: bool = False  # Fails closed. ONLY True when loop completes with next_page_token IS None and 0 errors.
    error: str | None = None
    #: Whether absence from THIS listing is evidence a thing was deleted at source.
    #:
    #: ⛔ ADDED AFTER PHASE 240's CODE REVIEW (WR-03), and it is a real contract change — this
    #:    file's byte-identical hash was that phase's headline evidence, so the change is
    #:    recorded rather than slipped in.
    #:
    #: ⚠ `complete` AND THIS ARE DIFFERENT QUESTIONS. `complete` asks *"did I see everything?"*;
    #:   this asks *"does not-seeing-it mean it is gone?"* A listing can be perfectly complete
    #:   and still prove nothing about deletion — when a family's folders are LABELS rather than
    #:   containers, a thing leaving one is filing, not removal, and the two are indistinguishable
    #:   from the listing alone.
    #:
    #: ⚠ DEFAULT True so every existing adapter keeps its behaviour untouched. A family opts OUT
    #:   by saying so in its own listing — never by a provider branch in `watch_service`, which
    #:   is the shape that has already produced six two-paths disagreements in this codebase.
    #:
    #: ⚠ THE CONCRETE CASE THAT FORCED IT IS DELIBERATELY NOT NAMED HERE. `test_240_contract_
    #:   unchanged` forbids provider vocabulary in this module and FIRED on the first draft of
    #:   this very comment — correctly. The example lives with the adapter that needs it.
    deletions_detectable: bool = True


@dataclass
class SourceHealth:
    """Health check diagnostic result for a source connection."""

    ok: bool = True
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)


def clamp_read_cap(max_bytes: int | None) -> int:
    """The ONE rule for turning a caller's requested read cap into an enforced one.

    Phase 244-08 (T-244-06-07). ``None`` means *"whatever the operator allows"*; a number
    means *"no more than this, and still no more than the operator allows"*. A caller can
    therefore only ever tighten.

    ⛔ ONE HOME, not one copy per adapter. `source_max_file_bytes()` exists because three
    families each held their own ceiling and agreed only by luck; a clamp re-derived per
    adapter would reinstate exactly that, one level down.

    ⚠ A zero or negative request is read as "nothing usable was asked for", not as "refuse
    every file" — the same polarity `source_max_file_bytes()` itself uses for a bad stored
    value. A caller that wants to refuse everything does not express it as a cap.

    ⚠ The settings import is FUNCTION-LOCAL deliberately: this module is the source contract
    and must stay importable without dragging the settings stack (and its DB read) behind it.
    """
    from app.models.user_settings import source_max_file_bytes

    ceiling = source_max_file_bytes()
    if max_bytes is None or int(max_bytes) <= 0:
        return ceiling
    return min(int(max_bytes), ceiling)


class SourceAdapter(ABC):
    """Abstract contract for an external document source family."""

    @abstractmethod
    async def browse(
        self,
        connection: Any,
        folder_id: str | None = None,
        page_token: str | None = None,
    ) -> BrowsePage:
        """Browse the folder tree hierarchy of a connected source."""

    @abstractmethod
    async def list_files(
        self,
        connection: Any,
        folder_id: str | None = None,
        recursive: bool = False,
        page_token: str | None = None,
        query: str | None = None,
        page_size: int = 30,
    ) -> FilePage:
        """List files available inside a folder (for preview/batch sync)."""

    @abstractmethod
    async def read_file(
        self,
        connection: Any,
        file_id: str,
        max_bytes: int | None = None,
    ) -> tuple[str, bytes, str]:
        """Download a single file's raw content.

        Returns (filename, content_bytes, mime_type).

        ``max_bytes`` — Phase 244-08 (T-244-06-07). A caller that will REFUSE a body above its
        own ceiling says so here, so the refusal happens at the transport instead of after the
        bytes are resident. The chat's cloud door accepts 10 MB and used to ask for the whole
        25 MB source ceiling, then throw 15 MB away.

        ⛔ IT MAY ONLY TIGHTEN. Every implementation clamps against
        ``source_max_file_bytes()`` — the operator's ceiling is the maximum a caller can be
        given, never a default a caller can talk its way past. Use ``clamp_read_cap`` below
        rather than re-deriving the rule per adapter; three copies agreeing by luck is the
        exact shape `source_max_file_bytes()` itself was created to end.

        ⚠ OPTIONAL, DEFAULT ``None`` — every existing caller (the Library import, the watch
        loop, the preview service) keeps the operator ceiling and is byte-identical.
        """

    @abstractmethod
    async def check(
        self,
        connection: Any,
    ) -> SourceHealth:
        """Verify that connection credentials, scopes, and endpoints are reachable."""


class SourceConnectionDisabled(Exception):
    """A source operation was attempted on a connection the operator has switched OFF.

    ── ⛔ THE DEFECT THIS EXISTS TO CLOSE (BUG-260907-03, driven live 2026-09-07) ────────────

    *Disable* stopped the scheduled watch loop and **nothing else**. Driven against a real
    personal OneDrive at ``is_enabled = False``, ``browse()`` minted a fresh OAuth token from
    the stored refresh token and returned six real folders from ``graph.microsoft.com``.
    Browse, preview and import were all unguarded — so a person who switched a connection off
    still had their credential used against the provider, and new documents could still enter
    the Library through it.

    ``grep -rn is_enabled`` found exactly **one** check in the codebase — ``watch_service.py``,
    which pauses the loop — and **none** in ``api/connectors.py`` or under ``services/sources/``.

    ⛔ **It was never Graph-specific.** The unguarded code is the shared source path; Google
    Drive had the identical hole from Phase 232. Phase 238 surfaced it only because the
    disconnect row was driven for the first time — and the success criterion it sat under
    (*"behaves identically to Drive"*) was **satisfied the whole time**, because both families
    were equally wrong.

    ── ⭐ WHY THE CHECK LIVES IN THE REGISTRY AND NOT IN THE ROUTES ──────────────────────────

    Four production callers resolve an adapter, and the obvious fix — an ``is_enabled`` check in
    each — is the fix that fails on the fifth. Every source operation already funnels through
    ``SourceRegistry.get_adapter(connection)``, so refusing there covers browse, list, read and
    check, **and every caller nobody has written yet**.

    ⚠ ``reason_code`` reuses ``connection_disabled`` from ``services/sources/failure_cause.py``
    rather than inventing a second vocabulary, so one surface can word this one way.
    """

    reason_code = "connection_disabled"

    def __init__(self, connection_id: str | None = None) -> None:
        self.connection_id = connection_id
        super().__init__(
            "This connection is disabled, so nothing was read from it. Enable it to use this "
            "source again."
        )


T = TypeVar("T", bound=type[SourceAdapter])


#: Phase 239 (D-239-03) — TRANSPORT PROTOCOL -> the registry key its adapter registered under.
#:
#: ⭐ WHY THIS EXISTS AT ALL, AND WHY IT IS A DICT. Drive and OneDrive resolve by `service_id`
#: because each is one service with one name. **An MCP server has no such name** — `service_id`
#: is whatever the person setting it up typed, and the next person will type something else. A
#: registry keyed only on exact ids can therefore never resolve an arbitrary MCP server, and the
#: milestone's binding constraint (*a source is DATA, not code*) would be false at the last step:
#: connecting a new server would mean registering a new key, which is a code change.
#:
#: ⛔ IT IS A DICT AND NOT AN `elif` BY DIRECT INSTRUCTION FROM THIS MODULE'S OWN HISTORY. The
#: note above the deleted `_ensure_registered` says it in as many words — *"make the routing DATA
#: (a dict keyed by service_id) rather than control flow"* — after a provider-keyed branch sat
#: inside the contract module for two phases. A second protocol is a ROW here; the moment it is a
#: branch, this file has repeated its own recorded mistake.
#:
#: ⚠ `mcp` IS A TRANSPORT, NOT A VENDOR, which is why `test_boundary_fence.py` stays green with
#: it here. It is a first-class member of `AuthType` alongside `static_key` and `oauth_byo` — the
#: same category of word as `https`, not the same category as `onedrive`.
PROTOCOL_ADAPTERS: dict[str, str] = {"mcp": "mcp"}

#: A `config` KEY that proves the row speaks a protocol, for rows written before `auth_type`
#: carried it. Also data, for the same reason. ⚠ A marker must be a key only ONE protocol can
#: write — `source_tools` is declared on `McpConfig` and nowhere else — or this table starts
#: guessing, and a wrong adapter reading a real connection is `watch_service`'s deleted Drive
#: fallback all over again: a wrong-source sync that looks like a working one.
CONFIG_PROTOCOL_MARKERS: dict[str, str] = {"source_tools": "mcp"}


def _connection_config(connection: Any) -> dict[str, Any]:
    """`config` as a plain mapping, whatever shape the caller had.

    `watch_service` hands a raw DB dict and `api/connectors.py` a `ConnectorConnectionResponse`
    whose `config` is a pydantic MODEL. Reading only dicts here would resolve every watch and
    no browse — one rule applied on one path out of two, which is indistinguishable from the
    rule being absent for anyone using the other.
    """
    config = (
        connection.get("config")
        if isinstance(connection, dict)
        else getattr(connection, "config", None)
    )
    if isinstance(config, dict):
        return config
    dump = getattr(config, "model_dump", None)
    return dump() if callable(dump) else {}


def _protocol_of(connection: Any) -> str | None:
    """Which transport this row speaks, or `None` — by DECLARATION, never by name-matching."""
    auth_type = (
        connection.get("auth_type")
        if isinstance(connection, dict)
        else getattr(connection, "auth_type", None)
    )
    protocol = str(auth_type or "").strip().lower()
    if protocol in PROTOCOL_ADAPTERS:
        return protocol

    config = _connection_config(connection)
    for marker, marked_protocol in CONFIG_PROTOCOL_MARKERS.items():
        if config.get(marker):
            return marked_protocol
    return None


class SourceRegistry:
    """Registry for source family adapters, keyed by service_id."""

    _adapters: dict[str, type[SourceAdapter]] = {}

    @classmethod
    def register(cls, service_id: str) -> Callable[[T], T]:
        """Decorator to register an adapter class for a service_id."""

        def decorator(adapter_cls: T) -> T:
            normalized = service_id.strip().lower()
            cls._adapters[normalized] = adapter_cls
            return adapter_cls

        return decorator

    # ⚠ `_ensure_registered` USED TO LIVE HERE AND WAS DELETED IN PHASE 238 (D-238-09.1).
    #
    # It lazily imported an adapter module chosen by `"google" in service_id` /
    # `"mock" in service_id` — provider branching **inside the contract**, in the one module
    # whose whole claim is that a source family is DATA. It was also redundant:
    # `app/services/sources/__init__.py` imports every adapter eagerly, so by the time any
    # caller can reach this class the registry is already populated.
    #
    # It is recorded rather than quietly removed because it is Phase 238's SC#4 finding. Adding
    # Microsoft Graph would have meant adding a third `elif` here — which is exactly the
    # "adding a source family is a code change" outcome the milestone's binding constraint
    # forbids, hiding in the file that forbids it. The boundary fence could not have caught it
    # either: the shipped test refused the literals `onedrive|sharepoint|dropbox|box` and
    # explicitly permitted `google`, so it would have flagged the SECOND offender while the
    # FIRST sat three lines away. Both are fixed together.
    #
    # ⛔ Do not reintroduce a lazy import keyed on a provider name. If a future adapter must be
    # optional (a heavy dependency, say), make the IMPORT LIST data — never the lookup.

    @classmethod
    def get_adapter(cls, connection_or_service_id: Any) -> SourceAdapter | None:
        """Resolve an instantiated SourceAdapter for a connection or service_id string."""
        if not connection_or_service_id:
            return None

        protocol: str | None = None

        if isinstance(connection_or_service_id, str):
            # A bare id carries no connection context, so there is nothing to judge. This arm is
            # used by `watch_service` and by several suites; it stays permissive on purpose.
            service_id = connection_or_service_id.strip().lower()
        else:
            # ⛔ BUG-260907-03 — THE ONE PLACE A DISABLED CONNECTION IS REFUSED. See
            # `SourceConnectionDisabled` above for what was measured and why it lives here
            # rather than in each route.
            #
            # ⚠ ABSENT means "nobody said it was off", NOT "off". Every existing caller and
            # fixture omits the key, and defaulting to refused would turn a security fix into an
            # outage. Same reading `watch_service` already uses (`conn.get("is_enabled", True)`),
            # stated once here instead of once per caller.
            if isinstance(connection_or_service_id, dict):
                enabled = connection_or_service_id.get("is_enabled", True)
                conn_id = connection_or_service_id.get("id")
            else:
                enabled = getattr(connection_or_service_id, "is_enabled", True)
                conn_id = getattr(connection_or_service_id, "id", None)
            if enabled is False:
                raise SourceConnectionDisabled(str(conn_id) if conn_id else None)

            service_id = getattr(connection_or_service_id, "service_id", "") or (
                connection_or_service_id.get("service_id", "")
                if isinstance(connection_or_service_id, dict)
                else ""
            )
            service_id = str(service_id).strip().lower()

            # Phase 239 (D-239-03). Read here, USED only after the exact lookup below misses,
            # and deliberately below the `is_enabled` gate: a resolution arm placed above it
            # would re-open BUG-260907-03 for exactly the family being added.
            protocol = _protocol_of(connection_or_service_id)

        # An EXACT key lookup, and nothing else. Aliases are declared where aliases belong —
        # `@SourceRegistry.register("google_workspace")` sits on the adapter beside
        # `@SourceRegistry.register("google")`, so `google_workspace` resolves here by being
        # registered rather than by being pattern-matched. An unregistered id returns None,
        # which is the honest answer and the one every caller already handles.
        adapter_cls = cls._adapters.get(service_id)

        # …and only then, the TRANSPORT the row declared. ⚠ STRICTLY A FALLBACK: an exact
        # `service_id` always wins, so a first-party family that also carried a protocol marker
        # keeps its own adapter instead of being hijacked by a generic one.
        if adapter_cls is None and protocol:
            adapter_cls = cls._adapters.get(PROTOCOL_ADAPTERS[protocol])

        if adapter_cls:
            return adapter_cls()
        return None

    @classmethod
    def is_source_supported(cls, service_id: str) -> bool:
        """Check if an adapter is registered for the service_id."""
        return service_id.strip().lower() in cls._adapters

    @classmethod
    def list_supported_services(cls) -> list[str]:
        """List all canonically registered service IDs."""
        return sorted(list(cls._adapters.keys()))
