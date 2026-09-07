"""Phase 239 (D-239-02 / SC#1) — a file surface is DETECTED, and the binding it writes is a ROW.

⭐ THE PROPERTY THESE TESTS MAKE EXECUTABLE is that connecting a second, differently-worded
MCP file server is **rows, not code**. `test_a_server_that_words_everything_differently_is_bound_by_its_own_names`
is the one that would red if somebody ever put `list_directory` into a conditional above
`services/sources/adapters/` — the vocabulary is discovered from the server's own `tools/list`
answer and written into `connector_connections.config["source_tools"]` as data.

⚠ EVERY VALUE WRITTEN MUST BE A NAME THE SERVER ACTUALLY OFFERED (TM-239-05). Two tests hold
that from opposite sides: `test_every_bound_name_was_offered_by_the_server` over the inference,
and `test_a_bound_name_the_server_does_not_offer_is_refused_on_update` over the write boundary a
hand-crafted PATCH would come through.

⚠ AND A NON-MCP CONNECTION MUST NEVER RECEIVE ONE. `base.CONFIG_PROTOCOL_MARKERS` resolves any
connection carrying a non-empty `source_tools` to `McpSourceAdapter`; writing the key onto a
capability row would therefore hand a Slack connection to the MCP adapter. The inference is
wired to the MCP arm of the discover ladder alone, and
`test_a_capability_connection_is_never_given_a_source_binding` is what keeps it there.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import connector_service
from app.services.connector_service import infer_source_tools

ORG = "11111111-1111-1111-1111-111111111111"
CONN = "22222222-2222-2222-2222-222222222222"


# ── the shapes real servers answer with ──────────────────────────────────────────────────

#: `@modelcontextprotocol/server-filesystem`, verbatim in name and shape.
REFERENCE_FILESYSTEM_TOOLS = [
    {
        "name": "list_directory",
        "description": "Get a detailed listing of all files and directories in a specified path.",
        "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}},
    },
    {
        "name": "read_file",
        "description": "Read the complete contents of a file from the file system.",
        "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}},
    },
    {
        "name": "write_file",
        "description": "Create a new file or completely overwrite an existing file.",
        "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}},
    },
]

#: A server that shares NOT ONE NAME with the one above. This is the phase's whole claim.
SHELL_FLAVOURED_TOOLS = [
    {"name": "ls", "description": "List the entries of a directory.", "inputSchema": {}},
    {"name": "cat", "description": "Print the contents of a file.", "inputSchema": {}},
]

NO_FILE_SURFACE_TOOLS = [
    {
        "name": "send_slack_message",
        "description": "Send a markdown message to a Slack channel.",
        "inputSchema": {"type": "object", "properties": {"channel": {"type": "string"}}},
    },
    {
        "name": "create_issue",
        "description": "Open a new issue on a repository.",
        "inputSchema": {"type": "object", "properties": {"title": {"type": "string"}}},
    },
]


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 1 · infer_source_tools — what a file surface LOOKS like
# ═══════════════════════════════════════════════════════════════════════════════════════════


def test_the_reference_filesystem_server_needs_no_typing_at_all():
    """CONTEXT §specifics: `list_directory` / `read_file` work out of the box, zero config."""
    assert infer_source_tools(REFERENCE_FILESYSTEM_TOOLS) == {
        "list_tool": "list_directory",
        "read_tool": "read_file",
    }


def test_the_plans_minimal_shape_binds_on_the_name_alone():
    """The plan's own acceptance criterion, verbatim — an EMPTY inputSchema still binds.

    The schema route is a second door, never a precondition; a server that documents nothing
    is still bound by the name it chose."""
    assert infer_source_tools(
        [{"name": "list_directory", "inputSchema": {}}, {"name": "read_file", "inputSchema": {}}]
    ) == {"list_tool": "list_directory", "read_tool": "read_file"}


def test_a_server_with_no_file_surface_binds_nothing():
    """The plan's second acceptance criterion. `None`, not `{}` — see `McpConfig.source_tools`:
    absent means nobody bound this connection to a file surface, empty means somebody looked
    and named nothing."""
    assert infer_source_tools([{"name": "send_slack_message", "inputSchema": {}}]) is None
    assert infer_source_tools(NO_FILE_SURFACE_TOOLS) is None
    assert infer_source_tools([]) is None


def test_a_server_that_words_everything_differently_is_bound_by_its_own_names():
    """⭐ ROWS, NOT CODE — the phase's headline claim, driven rather than asserted in prose.

    `ls` and `cat` appear nowhere in this product as code. If a future change hardcodes the
    reference server's vocabulary, THIS is the case that reds."""
    assert infer_source_tools(SHELL_FLAVOURED_TOOLS) == {"list_tool": "ls", "read_tool": "cat"}


def test_a_name_nobody_anticipated_is_still_bound_by_its_SCHEMA():
    """The second door: an unrecognised name whose schema and description say what it does.

    This is the case that decides whether a server nobody has met is usable on day one or
    needs somebody to type two tool names into Settings."""
    inferred = infer_source_tools(
        [
            {
                "name": "enumerate_folder_contents",
                "description": "Returns every file and directory under the given directory.",
                "inputSchema": {"type": "object", "properties": {"directory": {"type": "string"}}},
            },
            {
                "name": "fetch_document_bytes",
                "description": "Read the contents of a single file at the given path.",
                "inputSchema": {"type": "object", "properties": {"file_path": {"type": "string"}}},
            },
        ]
    )
    assert inferred == {
        "list_tool": "enumerate_folder_contents",
        "read_tool": "fetch_document_bytes",
    }


def test_half_a_file_surface_still_binds_the_half_that_exists():
    """`McpConfig.source_tools` says the adapter's defaults apply PER KEY, so a row carrying
    only `read_tool` still gets the default lister. A half-detection must therefore be
    written, not discarded."""
    inferred = infer_source_tools(
        [{"name": "read_file", "inputSchema": {}}, {"name": "send_slack_message", "inputSchema": {}}]
    )
    assert inferred == {"read_tool": "read_file"}
    assert "list_tool" not in inferred, (
        "a key nobody detected must be ABSENT, never an empty string — the adapter falls back "
        "per key and an empty string is a tool name the server does not have"
    )


def test_the_choice_does_not_depend_on_the_order_the_server_listed_its_tools():
    """⚠ A server may offer TWO listers. Tool order over the wire is arbitrary, so a binding
    that took the first match would flip between two discoveries of the same server and
    silently re-point a watched source. The preference order is ours, and it is fixed."""
    a = {"name": "list_directory", "inputSchema": {}}
    b = {"name": "list_files", "inputSchema": {}}
    assert infer_source_tools([a, b]) == infer_source_tools([b, a])


def test_every_bound_name_was_offered_by_the_server():
    """⛔ TM-239-05, from the inference side. These values are interpolated into a JSON-RPC
    `params.name` by `mcp_client.call_tool`; a name this function invented would reach the
    transport. Nothing may be returned that is not in the list handed in."""
    for tools in (REFERENCE_FILESYSTEM_TOOLS, SHELL_FLAVOURED_TOOLS):
        inferred = infer_source_tools(tools) or {}
        offered = {t["name"] for t in tools}
        assert set(inferred.values()) <= offered, (
            f"{set(inferred.values()) - offered} was never offered by the server"
        )


def test_a_malformed_tools_answer_is_survived_rather_than_raised():
    """Discovery must not be turned into a 502 by a server that answers oddly — the sanitizer
    upstream already drops nameless entries, but this helper is not entitled to assume it."""
    assert infer_source_tools([None, 7, "read_file", {}, {"name": ""}]) is None  # type: ignore[list-item]
    assert infer_source_tools(
        [{"name": "read_file", "inputSchema": None, "description": None}]  # type: ignore[list-item]
    ) == {"read_tool": "read_file"}


def test_a_write_tool_is_never_mistaken_for_a_read_tool():
    """⛔ `write_file` accepts `path` and its description mentions a file. Binding it as the
    READ tool would make the adapter call a mutating tool on every ingest — the one mistake on
    this surface that is not merely wrong but destructive."""
    inferred = infer_source_tools(
        [
            {
                "name": "write_file",
                "description": "Create a new file or completely overwrite an existing file.",
                "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}},
            },
            {
                "name": "delete_file",
                "description": "Remove a file at the given path from the filesystem.",
                "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}},
            },
        ]
    )
    assert inferred is None


def test_a_server_hint_never_widens_anything():
    """⛔ Phase 239 out-of-scope rule: `readOnlyHint` / annotations are informational only.

    A tool the detector rejects on its own name and schema must stay rejected however the
    server decorates it — a server that says `readOnlyHint: true` about `delete_file` is
    exactly the case this fence exists for."""
    hinted = [
        {
            "name": "delete_file",
            "description": "Remove a file at the given path.",
            "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}},
            "annotations": {"readOnlyHint": True},
        }
    ]
    assert infer_source_tools(hinted) is None


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 2 · discover_connection_tools — the binding is WRITTEN, on the MCP arm and nowhere else
# ═══════════════════════════════════════════════════════════════════════════════════════════


class _FakeParams(dict):
    def set(self, key, value):
        clone = _FakeParams(self)
        clone[key] = value
        return clone


class _FakeBuilder:
    def __init__(self, sink):
        self._sink = sink
        self.request = SimpleNamespace(params=_FakeParams())

    def update(self, payload):
        self._sink.append(payload)
        return self

    def eq(self, *_args):
        return self

    def execute(self):
        return SimpleNamespace(data=[{}])


class _FakeClient:
    """Records every UPDATE payload, and the projection each write was pinned to."""

    def __init__(self):
        self.writes: list[dict] = []
        self.builders: list[_FakeBuilder] = []

    def table(self, _name):
        builder = _FakeBuilder(self.writes)
        self.builders.append(builder)
        return builder


def _resolved(**overrides):
    base = dict(
        connection_id=CONN,
        org_id=ORG,
        capability=None,
        name="an mcp server",
        config={},
        secret_ciphertext=None,
        mcp_server_url="https://mcp.example.com/mcp",
        service_id="custom_mcp",
        auth_scheme="auto",
    )
    base.update(overrides)
    return SimpleNamespace(secret=None, **base)


@pytest.fixture
def wired(monkeypatch):
    """Fake the resolver and the socket; everything between them stays real."""

    def _wire(tools, **resolved_overrides):
        client = _FakeClient()

        async def _fake_resolve(connection_id, org_id, **_kw):
            return _resolved(**resolved_overrides)

        async def _fake_list_tools(server_url, secret=None, auth_scheme="auto", **_kw):
            return tools

        monkeypatch.setattr(connector_service, "resolve_connection", _fake_resolve)
        monkeypatch.setattr("app.services.mcp_client.list_tools", _fake_list_tools)
        return client

    return _wire


@pytest.mark.asyncio
async def test_discovery_writes_the_detected_binding_onto_the_row(wired):
    client = wired(REFERENCE_FILESYSTEM_TOOLS)

    await connector_service.discover_connection_tools(CONN, org_id=ORG, supabase=client)

    written = {k: v for payload in client.writes for k, v in payload.items()}
    assert [t["name"] for t in written["discovered_tools"]] == [
        "list_directory",
        "read_file",
        "write_file",
    ]
    assert written["config"]["source_tools"] == {
        "list_tool": "list_directory",
        "read_tool": "read_file",
    }


@pytest.mark.asyncio
async def test_discovery_never_overwrites_a_binding_a_person_chose(wired):
    """⛔ The plan's own failure mode: *"Discovery overwrites an existing user-specified tool
    mapping."* Somebody who mapped a custom server by hand must not have it silently
    re-pointed the next time they press Refresh."""
    chosen = {"list_tool": "browse_workspace", "read_tool": "fetch_doc"}
    client = wired(REFERENCE_FILESYSTEM_TOOLS, config={"source_tools": dict(chosen)})

    await connector_service.discover_connection_tools(CONN, org_id=ORG, supabase=client)

    for payload in client.writes:
        assert payload.get("config", {}).get("source_tools", chosen) == chosen


@pytest.mark.asyncio
async def test_the_rest_of_the_config_survives_the_binding_write(wired):
    """The config column is written whole. A discovery that dropped `custom_client_id` would
    log an OAuth-registered MCP connection out on the next refresh."""
    client = wired(REFERENCE_FILESYSTEM_TOOLS, config={"custom_client_id": "abc-123", "headers": {}})

    await connector_service.discover_connection_tools(CONN, org_id=ORG, supabase=client)

    written = {k: v for payload in client.writes for k, v in payload.items()}
    assert written["config"]["custom_client_id"] == "abc-123"
    assert written["config"]["headers"] == {}
    assert written["config"]["source_tools"]["read_tool"] == "read_file"


@pytest.mark.asyncio
async def test_a_server_with_no_file_surface_gets_no_binding_written(wired):
    """A key written as `{}` is not harmless: `base.CONFIG_PROTOCOL_MARKERS` keys off
    `source_tools`, so an empty mapping still declares an intent nobody expressed."""
    client = wired(NO_FILE_SURFACE_TOOLS)

    await connector_service.discover_connection_tools(CONN, org_id=ORG, supabase=client)

    for payload in client.writes:
        assert "source_tools" not in payload.get("config", {})


@pytest.mark.asyncio
async def test_a_capability_connection_is_never_given_a_source_binding(monkeypatch):
    """⛔ THE HIJACK. `SourceRegistry` resolves ANY connection whose config carries a non-empty
    `source_tools` to `McpSourceAdapter` (`CONFIG_PROTOCOL_MARKERS`). A capability descriptor
    that happened to be named `read_file` would therefore hand a first-party connection to the
    MCP adapter, which would then call a tool over a server URL that does not exist.

    Inference belongs to the MCP arm alone."""
    client = _FakeClient()

    async def _fake_resolve(connection_id, org_id, **_kw):
        return _resolved(mcp_server_url=None, capability="post_message", service_id="slack")

    monkeypatch.setattr(connector_service, "resolve_connection", _fake_resolve)
    monkeypatch.setattr(
        "app.services.connectors.descriptors.static_descriptors_for_capability",
        lambda capability, service_id=None: [
            {"name": "read_file", "description": "Read a file.", "inputSchema": {}},
            {"name": "list_directory", "description": "List a directory.", "inputSchema": {}},
        ],
    )

    await connector_service.discover_connection_tools(CONN, org_id=ORG, supabase=client)

    for payload in client.writes:
        assert "config" not in payload, (
            "the capability arm wrote a config — a non-MCP row must never be handed to the "
            "MCP source adapter by a descriptor that merely shares a name"
        )


@pytest.mark.asyncio
async def test_the_binding_write_keeps_the_projection_pin(wired):
    """⚠ MEASURED IN LIVE UAT 2026-08-25 and recorded in this function's own comment: a write
    on the user-JWT client that omits `_project` is refused `42501` and surfaces as a 502
    *"MCP tool discovery failed"* after the server already answered correctly. A second
    column on that write must not lose the pin."""
    client = wired(REFERENCE_FILESYSTEM_TOOLS)

    await connector_service.discover_connection_tools(CONN, org_id=ORG, supabase=client)

    assert client.builders, "no write happened at all"
    for builder in client.builders:
        assert "select" in builder.request.params, "the projection pin was dropped"


@pytest.mark.asyncio
async def test_the_row_is_written_once_not_twice(wired):
    """One UPDATE, two columns. A second round trip would be a second chance to fail halfway
    and leave a cached tool list with no binding beside it."""
    client = wired(REFERENCE_FILESYSTEM_TOOLS)

    await connector_service.discover_connection_tools(CONN, org_id=ORG, supabase=client)

    assert len(client.writes) == 1, f"expected one UPDATE, saw {len(client.writes)}"


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 3 · TM-239-05 at the WRITE BOUNDARY — the door a hand-crafted PATCH comes through
# ═══════════════════════════════════════════════════════════════════════════════════════════


def test_a_bound_name_the_server_does_not_offer_is_refused_on_update():
    """⛔ TM-239-05. The UI only ever offers discovered names and the detector only ever picks
    them — but neither is a boundary. `PATCH /connectors/connections/{id}` accepts a whole
    `config`, and these values are interpolated into a JSON-RPC `params.name`.

    ⚠ It is refused ONLY against a row that HAS a discovered list. A connection bound before
    its first discovery has nothing to check against, and refusing there would make it
    impossible to configure a server before contacting it — a fence that fires on the honest
    case and not the dishonest one."""
    from app.services.connector_service import reject_unoffered_source_tools

    discovered = [{"name": "list_directory"}, {"name": "read_file"}]

    reject_unoffered_source_tools(
        {"source_tools": {"list_tool": "list_directory", "read_tool": "read_file"}}, discovered
    )

    with pytest.raises(ValueError) as caught:
        reject_unoffered_source_tools(
            {"source_tools": {"read_tool": "exfiltrate_everything"}}, discovered
        )
    assert "exfiltrate_everything" in str(caught.value), (
        "the refusal must name the tool, so somebody reading it knows what to fix"
    )


def test_a_connection_with_nothing_discovered_yet_can_still_be_bound():
    from app.services.connector_service import reject_unoffered_source_tools

    reject_unoffered_source_tools({"source_tools": {"read_tool": "anything"}}, [])
    reject_unoffered_source_tools({"source_tools": {"read_tool": "anything"}}, None)


def test_a_config_carrying_no_binding_is_left_entirely_alone():
    from app.services.connector_service import reject_unoffered_source_tools

    reject_unoffered_source_tools({"headers": {}}, [{"name": "read_file"}])
    reject_unoffered_source_tools({}, [{"name": "read_file"}])
