"""SEED-259 — tool NAMES were rows; tool ARGUMENT SHAPES were code. Both halves.

⭐ **THE FINDING THIS FILE EXISTS TO CLOSE.** Phase 239's SC#2 was driven live against GitHub
MCP as a second file server. Binding it took **zero code** — it appeared in the Library source
picker and `/browse` returned `200`. **And the listing came back EMPTY**, because
`mcp_source.py` sent a lone `{"path": …}` while `get_file_contents` requires
**`owner` + `repo` + `path`**.

Two separate defects were wearing one coat, and they are tested here as two separate things:

── ⛔ THE SAFETY HALF, WHICH IS THE URGENT ONE (`TestARefusalIsNeverAnEmptyListing`) ────────

**It failed as `HTTP 200` with an EMPTY LISTING, not as an error.** That is review finding
`HI-03`'s fail-open shape reproduced on a different path *after* `HI-03` itself was fixed, and
an empty-but-complete listing is exactly what the **`H-5` deletion guard consumes**: on a
watched folder, *"the source returns nothing"* is indistinguishable from *"everything was
deleted"*. So when a bound tool's `inputSchema` declares required arguments this connection
cannot supply, the adapter **refuses by name and sends nothing**.

⚠ This half must hold for a server misbound for reasons nobody predicted, which is why it is
driven off the server's OWN `inputSchema` rather than off any list of servers.

── THE CAPABILITY HALF (`TestTheArgumentMappingIsARow`) ─────────────────────────────────────

Which discovered argument carries the path, and static values for the server's other required
arguments, stored as **flat prefixed keys inside the existing `source_tools` dict**:

    {"list_tool": "get_file_contents", "read_tool": "get_file_contents",
     "arg_path": "path", "arg_static.owner": "fhdmrddev-dotcom",
     "arg_static.repo": "Agentic-RAG"}

⛔ **No nested field, no `McpConfig` shape change, no migration** — `SEED-239` records that ONE
malformed `config` row makes **every connection in the org** unreadable, because `_to_response`
validates inside a list comprehension.

⛔ **AND NO VENDOR ANYWHERE.** The mapping is a table of rows; `if server == "github"` is not.
`test_boundary_fence.py` holds that line and this file never crosses it — the GitHub case below
is a FIXTURE, exactly as `ls`/`cat` is a fixture in `test_239_mcp_source_adapter.py`.
"""

from __future__ import annotations

import json as jsonlib
from typing import Any

import pytest

SERVER = "https://mcp.example.com/mcp"


# ── doubles ──────────────────────────────────────────────────────────────────────────────


class ArgRecorder:
    """A stand-in for the `mcp_client` MODULE that records the ARGUMENTS, not the result.

    ⚠ `test_239_mcp_source_adapter.FakeMcp` routes its two canned payloads by sniffing the
    tool NAME for `read` / `cat` / `content` — which cannot express this file's central case,
    where `list_tool` and `read_tool` are **the same tool** (`get_file_contents` serves both on
    the real server that produced `SEED-259`). So this double routes on the CALL, never on the
    name, and every test states the payload it expects back.
    """

    def __init__(self, *, results: list[Any] | None = None, tools: Any = None) -> None:
        self._results = list(results or [])
        self._tools = tools if tools is not None else []
        self.calls: list[dict[str, Any]] = []
        self.list_tools_calls: list[str] = []

    async def call_tool(
        self,
        server_url: str,
        tool_name: str,
        arguments: dict[str, Any],
        secret: str | None = None,
        auth_scheme: str = "auto",
    ) -> dict[str, Any]:
        self.calls.append({
            "server_url": server_url,
            "tool_name": tool_name,
            "arguments": arguments,
            "secret": secret,
            "auth_scheme": auth_scheme,
        })
        if self._results:
            return self._results.pop(0)
        return {"text": "", "content": [], "isError": False}

    async def list_tools(
        self,
        server_url: str,
        secret: str | None = None,
        timeout: float = 15.0,
        auth_scheme: str = "auto",
    ) -> list[dict[str, Any]]:
        self.list_tools_calls.append(server_url)
        return self._tools


def text_result(text: str) -> dict[str, Any]:
    return {
        "text": text,
        "content": [{"type": "text", "text": text}],
        "isError": False,
        "raw": {"content": [{"type": "text", "text": text}]},
    }


def json_listing(entries: list[dict[str, Any]]) -> dict[str, Any]:
    return text_result(jsonlib.dumps(entries))


def tool(name: str, *, params: tuple[str, ...], required: tuple[str, ...] | None) -> dict:
    """One entry in `discovered_tools`, in the shape `mcp_client.list_tools` sanitises to.

    ⚠ `required=None` means the server declared NO `required` array — which is legal JSON
    Schema and means *"nothing is mandatory"*, not *"everything is"*.
    """
    schema: dict[str, Any] = {
        "type": "object",
        "properties": {p: {"type": "string"} for p in params},
    }
    if required is not None:
        schema["required"] = list(required)
    return {"name": name, "description": "", "inputSchema": schema}


#: The real case from `SEED-259`, as a fixture. ⚠ THIS IS DATA, NOT A VENDOR ARM — nothing in
#: the shipped code may name it, and `test_boundary_fence.py` is what enforces that.
READER_NEEDING_THREE = tool(
    "get_file_contents", params=("owner", "repo", "path"), required=("owner", "repo", "path")
)

#: The reference `@modelcontextprotocol/server-filesystem` shape: one argument, and it is the
#: one the adapter has always sent. The NEGATIVE CONTROL for every refusal below.
READER_NEEDING_ONE = tool("read_file", params=("path",), required=("path",))
LISTER_NEEDING_ONE = tool("list_directory", params=("path",), required=("path",))


def conn(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "conn-mcp-259",
        "org_id": "org-1",
        "name": "Repo files",
        "service_id": "custom_mcp",
        "auth_type": "mcp",
        "mcp_server_url": SERVER,
        "config": {},
        "is_enabled": True,
        "secret": None,  # present, so no round trip to the resolver — see `_carries_a_credential`
    }
    base.update(over)
    return base


@pytest.fixture
def adapter():
    from app.services.sources.adapters.mcp_source import McpSourceAdapter

    return McpSourceAdapter()


@pytest.fixture
def patch_mcp(monkeypatch: pytest.MonkeyPatch):
    def _install(fake: ArgRecorder) -> ArgRecorder:
        monkeypatch.setattr(
            "app.services.sources.adapters.mcp_source.mcp_client", fake, raising=True
        )
        return fake

    return _install


# ── ⛔ A. the safety half: a refusal, never an empty listing ─────────────────────────────


class TestARefusalIsNeverAnEmptyListing:
    """`SEED-259`'s urgent half, and the one that does not depend on the feature landing."""

    async def test_a_reader_needing_three_arguments_is_REFUSED_BY_NAME(self, adapter, patch_mcp):
        fake = patch_mcp(ArgRecorder())
        connection = conn(
            config={"source_tools": {"list_tool": "get_file_contents"}},
            discovered_tools=[READER_NEEDING_THREE],
        )

        with pytest.raises(ValueError) as caught:
            await adapter.list_files(connection, folder_id="src")

        message = str(caught.value)
        assert "get_file_contents" in message, "the refusal must name the TOOL"
        assert "owner" in message and "repo" in message, (
            "the refusal must name EVERY argument it cannot supply — 'this is misconfigured' "
            "sends somebody hunting through their credentials"
        )
        assert "path" not in message.split("requires")[-1].split(".")[0], (
            "`path` IS supplied, so naming it would send the reader after the wrong argument"
        )

    async def test_NOTHING_IS_SENT_when_the_binding_cannot_satisfy_the_tool(
        self, adapter, patch_mcp
    ):
        """⛔ The refusal is a PRE-FLIGHT. A call that goes out and comes back empty is the
        defect; refusing after sending it would leave the fail-open live on every server whose
        answer to a bad call is an empty body rather than an `isError`."""
        fake = patch_mcp(ArgRecorder())
        connection = conn(
            config={"source_tools": {"list_tool": "get_file_contents"}},
            discovered_tools=[READER_NEEDING_THREE],
        )

        with pytest.raises(ValueError):
            await adapter.list_files(connection, folder_id="src")

        assert fake.calls == [], "the underspecified call must never reach the server"

    async def test_browse_refuses_too_rather_than_answering_zero_folders(
        self, adapter, patch_mcp
    ):
        """A picker that lists nothing reads as *"this repository is empty"*."""
        patch_mcp(ArgRecorder())
        connection = conn(
            config={"source_tools": {"list_tool": "get_file_contents"}},
            discovered_tools=[READER_NEEDING_THREE],
        )
        with pytest.raises(ValueError):
            await adapter.browse(connection, folder_id="src")

    async def test_the_READER_is_checked_on_its_own_path(self, adapter, patch_mcp):
        """⚠ Per ROLE, not per connection. A row with a working lister and a broken reader
        must still BROWSE — refusing the browse would hide which of the two is wrong."""
        fake = patch_mcp(ArgRecorder(results=[json_listing([{"name": "a.md", "type": "file"}])]))
        connection = conn(
            config={
                "source_tools": {
                    "list_tool": "list_directory",
                    "read_tool": "get_file_contents",
                }
            },
            discovered_tools=[LISTER_NEEDING_ONE, READER_NEEDING_THREE],
        )

        files = await adapter.list_files(connection, folder_id="/docs")
        assert [f.name for f in files.files] == ["a.md"], "the LISTER is fine and must work"

        with pytest.raises(ValueError) as caught:
            await adapter.read_file(connection, file_id="/docs/a.md")
        assert "get_file_contents" in str(caught.value)
        assert len(fake.calls) == 1, "the read must not have been attempted"

    async def test_the_refusal_holds_for_a_server_NOBODY_PREDICTED(self, adapter, patch_mcp):
        """⭐ The point of driving this off `inputSchema` rather than off a list of servers:
        a vocabulary that appears nowhere in this repository is refused identically."""
        fake = patch_mcp(ArgRecorder())
        connection = conn(
            config={"source_tools": {"list_tool": "enumerate"}},
            discovered_tools=[
                tool("enumerate", params=("bucket", "prefix"), required=("bucket", "prefix"))
            ],
        )
        with pytest.raises(ValueError) as caught:
            await adapter.list_files(connection, folder_id="x")
        assert "bucket" in str(caught.value) and "prefix" in str(caught.value)
        assert fake.calls == []

    # ── the negative controls: a fence that refuses everything refuses nothing ───────────

    async def test_the_REFERENCE_SERVER_is_not_refused(self, adapter, patch_mcp):
        """⛔ The whole family works today on a lone `path`. Breaking that would trade one
        fail-open for a fail-closed that fires on every honest connection."""
        patch_mcp(ArgRecorder(results=[json_listing([{"name": "a.md", "type": "file"}])]))
        connection = conn(discovered_tools=[LISTER_NEEDING_ONE, READER_NEEDING_ONE])

        page = await adapter.list_files(connection, folder_id="/docs")
        assert [f.name for f in page.files] == ["a.md"]

    async def test_an_OPTIONAL_argument_is_not_a_missing_one(self, adapter, patch_mcp):
        """`required` is the contract; `properties` is the menu. A server offering `ref` and
        `page` as optional extras is fully satisfied by `path` alone."""
        patch_mcp(ArgRecorder(results=[json_listing([])]))
        connection = conn(
            config={"source_tools": {"list_tool": "get_file_contents"}},
            discovered_tools=[
                tool("get_file_contents", params=("path", "ref", "page"), required=("path",))
            ],
        )
        assert (await adapter.list_files(connection, folder_id="src")).files == []

    async def test_a_schema_declaring_NO_required_array_is_not_refused(self, adapter, patch_mcp):
        """An absent `required` is legal JSON Schema for *"nothing is mandatory"*. Reading it
        as *"everything is"* would refuse a server that asks for nothing at all."""
        patch_mcp(ArgRecorder(results=[json_listing([])]))
        connection = conn(
            config={"source_tools": {"list_tool": "ls"}},
            discovered_tools=[tool("ls", params=("path", "owner"), required=None)],
        )
        assert (await adapter.list_files(connection, folder_id="src")).files == []

    async def test_a_connection_that_never_DISCOVERED_anything_is_not_refused(
        self, adapter, patch_mcp
    ):
        """⚠ THE ASYMMETRY, STATED RATHER THAN ASSUMED — and it is the one
        `reject_unoffered_source_tools` already reasons about one module over: *"a connection
        bound before its first discovery has nothing to compare to, and refusing there would
        make it impossible to configure a server before contacting it."* No schema is not a
        bad schema. What covers that residue is `check()`, which reads the server LIVE."""
        patch_mcp(ArgRecorder(results=[json_listing([{"name": "a.md", "type": "file"}])]))
        connection = conn(config={"source_tools": {"list_tool": "get_file_contents"}})
        connection.pop("discovered_tools", None)

        page = await adapter.list_files(connection, folder_id="src")
        assert [f.name for f in page.files] == ["a.md"]

    async def test_a_tool_ABSENT_from_a_discovered_list_is_left_to_check(
        self, adapter, patch_mcp
    ):
        """⚠ NAMED, NOT SILENT. A stale cache that has not seen a newly-added tool must not
        stop a working connection; `McpSourceAdapter.check` is what names a truly missing
        binding, against the server's live `tools/list`."""
        patch_mcp(ArgRecorder(results=[json_listing([])]))
        connection = conn(
            config={"source_tools": {"list_tool": "brand_new_tool"}},
            discovered_tools=[LISTER_NEEDING_ONE],
        )
        assert (await adapter.list_files(connection, folder_id="src")).files == []

    async def test_check_reports_the_UNDERSPECIFIED_binding_instead_of_ok(
        self, adapter, patch_mcp
    ):
        """⭐ THE PROBE MUST DISCRIMINATE. `check` already refuses to say *ok* for a tool the
        server does not have; a tool it HAS but cannot be called correctly is the same class
        of misconfiguration and read `ok=True` — a green health probe over a dead source."""
        patch_mcp(ArgRecorder(tools=[READER_NEEDING_THREE]))
        connection = conn(
            config={
                "source_tools": {
                    "list_tool": "get_file_contents",
                    "read_tool": "get_file_contents",
                }
            }
        )

        health = await adapter.check(connection)
        assert health.ok is False
        assert "owner" in (health.error or "") and "repo" in (health.error or "")

    async def test_check_says_ok_once_the_arguments_ARE_mapped(self, adapter, patch_mcp):
        """The other arm of the same probe — otherwise the test above passes on a `check`
        that simply never says ok."""
        patch_mcp(ArgRecorder(tools=[READER_NEEDING_THREE]))
        connection = conn(
            config={
                "source_tools": {
                    "list_tool": "get_file_contents",
                    "read_tool": "get_file_contents",
                    "arg_path": "path",
                    "arg_static.owner": "fhdmrddev-dotcom",
                    "arg_static.repo": "Agentic-RAG",
                }
            }
        )
        health = await adapter.check(connection)
        assert health.ok is True, health.error

    async def test_check_reads_the_server_LIVE_and_not_the_cached_list(
        self, adapter, patch_mcp
    ):
        """⚠ The cache is what the pre-flight has; the probe has the truth. A row whose cache
        says one argument while the server now requires three must fail the PROBE."""
        patch_mcp(ArgRecorder(tools=[READER_NEEDING_THREE]))
        connection = conn(
            config={"source_tools": {"list_tool": "get_file_contents"}},
            discovered_tools=[
                tool("get_file_contents", params=("path",), required=("path",))
            ],
        )
        health = await adapter.check(connection)
        assert health.ok is False
        assert "owner" in (health.error or "")


# ── B. the capability half: the mapping is a ROW ─────────────────────────────────────────


class TestTheArgumentMappingIsARow:
    """`SEED-259` option 2, as ruled by the operator on 2026-09-08."""

    async def test_the_PATH_ARGUMENT_is_a_row(self, adapter, patch_mcp):
        """A server that calls its path argument something else is a ROW, not a branch."""
        fake = patch_mcp(ArgRecorder(results=[json_listing([])]))
        connection = conn(
            config={"source_tools": {"list_tool": "ls", "arg_path": "filepath"}},
            discovered_tools=[tool("ls", params=("filepath",), required=("filepath",))],
        )

        await adapter.list_files(connection, folder_id="/docs")
        assert fake.calls[0]["arguments"] == {"filepath": "/docs"}

    async def test_the_default_path_argument_is_still_path(self, adapter, patch_mcp):
        """⚠ ABSENT MEANS THE DEFAULT, per key, exactly as `list_tool` / `read_tool` do. Every
        row that exists today carries no `arg_path` and must keep working byte-for-byte."""
        fake = patch_mcp(ArgRecorder(results=[json_listing([])]))
        await adapter.list_files(conn(), folder_id="/docs")
        assert fake.calls[0]["arguments"] == {"path": "/docs"}

    async def test_STATIC_ARGUMENTS_are_rows(self, adapter, patch_mcp):
        fake = patch_mcp(ArgRecorder(results=[json_listing([])]))
        connection = conn(
            config={
                "source_tools": {
                    "list_tool": "get_file_contents",
                    "arg_path": "path",
                    "arg_static.owner": "fhdmrddev-dotcom",
                    "arg_static.repo": "Agentic-RAG",
                }
            },
            discovered_tools=[READER_NEEDING_THREE],
        )

        await adapter.list_files(connection, folder_id="src")
        assert fake.calls[0]["arguments"] == {
            "owner": "fhdmrddev-dotcom",
            "repo": "Agentic-RAG",
            "path": "src",
        }

    async def test_THE_REAL_SEED_259_CASE_lists_AND_reads(self, adapter, patch_mcp):
        """⭐ The end state named in the ruling, driven end to end: the binding that returned
        *"0 documents · 0 chunks · 0 folders"* on 2026-09-08 now lists and reads.

        ⚠ `list_tool` and `read_tool` are THE SAME TOOL here, which is why this file carries
        its own double — the shipped one routes its payloads by sniffing the tool name."""
        fake = patch_mcp(
            ArgRecorder(
                results=[
                    json_listing([
                        {"name": "README.md", "type": "file", "path": "README.md"},
                        {"name": "backend", "type": "dir", "path": "backend"},
                    ]),
                    text_result("# Agentic RAG"),
                ]
            )
        )
        connection = conn(
            config={
                "source_tools": {
                    "list_tool": "get_file_contents",
                    "read_tool": "get_file_contents",
                    "root_path": "",
                    "arg_path": "path",
                    "arg_static.owner": "fhdmrddev-dotcom",
                    "arg_static.repo": "Agentic-RAG",
                }
            },
            discovered_tools=[READER_NEEDING_THREE],
        )

        page = await adapter.list_files(connection, folder_id="/")
        assert [f.name for f in page.files] == ["README.md"], "a REAL listing, not an empty one"

        name, payload, _mime = await adapter.read_file(connection, file_id="README.md")
        assert name == "README.md"
        assert payload == b"# Agentic RAG"

        assert [c["arguments"] for c in fake.calls] == [
            {"owner": "fhdmrddev-dotcom", "repo": "Agentic-RAG", "path": "/"},
            {"owner": "fhdmrddev-dotcom", "repo": "Agentic-RAG", "path": "README.md"},
        ]

    async def test_the_statics_reach_the_READ_call_too(self, adapter, patch_mcp):
        """One spelling of the rule for both roles — the `wire_path` lesson, one field over:
        two copies drift, and the drift is invisible until an import returns nothing."""
        fake = patch_mcp(ArgRecorder(results=[text_result("hi")]))
        connection = conn(
            config={
                "source_tools": {
                    "read_tool": "get_file_contents",
                    "arg_static.owner": "o",
                    "arg_static.repo": "r",
                }
            },
            discovered_tools=[READER_NEEDING_THREE],
        )
        await adapter.read_file(connection, file_id="a.md")
        assert fake.calls[0]["arguments"] == {"owner": "o", "repo": "r", "path": "a.md"}

    async def test_a_static_can_NEVER_shadow_the_path_argument(self, adapter, patch_mcp):
        """⛔ A static named the same thing as the path argument would pin every browse and
        every read to ONE fixed path — a listing that ignores the folder it was asked for.
        On a watched folder that is a *complete* listing of the wrong directory, which is the
        `H-5` deletion signal wearing a success. The path always wins."""
        fake = patch_mcp(ArgRecorder(results=[json_listing([])]))
        connection = conn(
            config={
                "source_tools": {
                    "arg_path": "path",
                    "arg_static.path": "/etc",
                }
            },
            discovered_tools=[LISTER_NEEDING_ONE],
        )
        await adapter.list_files(connection, folder_id="/docs")
        assert fake.calls[0]["arguments"] == {"path": "/docs"}

    async def test_the_mapping_satisfies_the_refusal_it_exists_to_answer(
        self, adapter, patch_mcp
    ):
        """The two halves meet: mapping the missing arguments makes the refusal stop firing —
        otherwise the safety half would be a wall with no door in it."""
        fake = patch_mcp(ArgRecorder(results=[json_listing([{"name": "a.md", "type": "file"}])]))
        connection = conn(
            config={
                "source_tools": {
                    "list_tool": "get_file_contents",
                    "arg_static.owner": "o",
                    "arg_static.repo": "r",
                }
            },
            discovered_tools=[READER_NEEDING_THREE],
        )
        page = await adapter.list_files(connection, folder_id="src")
        assert [f.name for f in page.files] == ["a.md"]
        assert fake.calls[0]["tool_name"] == "get_file_contents"

    async def test_a_mapping_key_is_never_read_as_a_TOOL_NAME(self, adapter, patch_mcp):
        """⛔ `arg_static.*` values are ARGUMENTS. They reach `params.arguments`, never
        `params.name`, so a value that happens to spell a destructive tool is a string sent to
        a server and not a tool this application invokes. Asserted rather than reasoned."""
        fake = patch_mcp(ArgRecorder(results=[json_listing([])]))
        connection = conn(
            config={
                "source_tools": {
                    "list_tool": "list_directory",
                    "arg_static.owner": "delete_everything",
                }
            },
            discovered_tools=[LISTER_NEEDING_ONE],
        )
        await adapter.list_files(connection, folder_id="/d")
        assert fake.calls[0]["tool_name"] == "list_directory"
        assert fake.calls[0]["arguments"]["owner"] == "delete_everything"

    async def test_an_empty_static_value_is_still_sent(self, adapter, patch_mcp):
        """⚠ `""` is a VALUE somebody typed, and some servers legitimately want one (a repo's
        default branch, a bucket root). Dropping it would silently re-create the missing
        argument this phase exists to refuse — and the refusal would then not fire, because
        the key IS present. Absent and empty are different, as they are for `source_tools`."""
        fake = patch_mcp(ArgRecorder(results=[json_listing([])]))
        connection = conn(
            config={"source_tools": {"list_tool": "ls", "arg_static.ref": ""}},
            discovered_tools=[tool("ls", params=("path", "ref"), required=("path", "ref"))],
        )
        await adapter.list_files(connection, folder_id="/d")
        assert fake.calls[0]["arguments"] == {"ref": "", "path": "/d"}


# ── C. the write boundary — a mapping key must not smuggle a tool name ───────────────────


class TestTheWriteBoundaryKnowsAKeyFromAToolName:
    """`reject_unoffered_source_tools` refuses every value in `source_tools` that is not an
    offered, non-destructive tool NAME. Argument keys are not tool names — and the exemption
    must be an ALLOW-LIST, or the new keys become the hole they were added beside."""

    @staticmethod
    def _reject(source_tools: dict, offered: list[dict] | None):
        from app.services.connector_service import reject_unoffered_source_tools

        reject_unoffered_source_tools({"source_tools": source_tools}, offered)

    def test_the_argument_keys_are_accepted_though_they_name_no_tool(self):
        self._reject(
            {
                "list_tool": "get_file_contents",
                "arg_path": "path",
                "arg_static.owner": "fhdmrddev-dotcom",
                "arg_static.repo": "Agentic-RAG",
            },
            [READER_NEEDING_THREE],
        )

    def test_a_static_value_naming_a_DESTRUCTIVE_tool_is_still_only_an_argument(self):
        """It never reaches `params.name` (proved in the adapter test above), so refusing it
        here would refuse a repository legitimately called `delete-me`."""
        self._reject(
            {"list_tool": "list_directory", "arg_static.repo": "delete_me"},
            [LISTER_NEEDING_ONE],
        )

    def test_an_UNKNOWN_key_is_still_read_as_a_tool_name_and_still_refused(self):
        """⛔ FAIL-CLOSED BY ALLOW-LIST. If the exemption were a deny-list of known tool-role
        keys, `{"sneaky": "delete_file"}` would sail through as *"not a role I recognise"* —
        the boundary this function calls *"the door a hand-crafted PATCH comes through"*."""
        with pytest.raises(ValueError):
            self._reject({"sneaky": "delete_file"}, [LISTER_NEEDING_ONE])
        with pytest.raises(ValueError):
            self._reject({"sneaky": "some_unoffered_tool"}, [LISTER_NEEDING_ONE])

    def test_a_TOOL_role_is_still_checked_beside_the_new_keys(self):
        """The new keys must not widen anything for the keys that were already checked."""
        with pytest.raises(ValueError) as caught:
            self._reject(
                {"read_tool": "delete_file", "arg_static.owner": "o"}, [READER_NEEDING_THREE]
            )
        assert "delete_file" in str(caught.value)

        with pytest.raises(ValueError):
            self._reject(
                {"read_tool": "not_offered", "arg_path": "path"}, [READER_NEEDING_THREE]
            )

    def test_a_key_that_merely_STARTS_LIKE_the_prefix_is_not_exempt(self):
        """⚠ The prefix match must be the prefix, not a substring — `argosy_tool` is a key
        nobody declared and must fall to the tool-name arm like any other unknown."""
        with pytest.raises(ValueError):
            self._reject({"argosy_tool": "delete_file"}, [LISTER_NEEDING_ONE])


# ── D. the shape stays flat, so one bad row cannot 503 the org ───────────────────────────


class TestTheKeysRideTheExistingDictAndChangeNoShape:
    """⛔ `SEED-239`: `McpConfig` is `extra='forbid'` and `_to_response` validates inside a
    list comprehension, so ONE row that no member of the `ConnectorConfig` union matches makes
    **every connection in the org** unreadable. A nested member for this mapping would put
    that failure back on the table; flat prefixed keys in a `dict[str, str]` cannot."""

    @staticmethod
    def _cfg(source_tools: dict):
        from app.models.connector import McpConfig

        return McpConfig(source_tools=source_tools)

    def test_the_mapping_validates_as_the_existing_field(self):
        cfg = self._cfg({
            "list_tool": "get_file_contents",
            "arg_path": "path",
            "arg_static.owner": "fhdmrddev-dotcom",
        })
        assert cfg.source_tools["arg_static.owner"] == "fhdmrddev-dotcom"

    def test_McpConfig_declares_NO_new_field_for_this(self):
        from app.models.connector import McpConfig

        assert "arg_path" not in McpConfig.model_fields
        assert "argument_mapping" not in McpConfig.model_fields
        assert "source_args" not in McpConfig.model_fields

    def test_source_tools_is_still_a_FLAT_string_to_string_mapping(self):
        """A nested object here would reach `mcp_client.call_tool` before anything could
        refuse it — the reason the field's own docstring calls `dict[str, str]` a CONSTRAINT."""
        import pydantic

        with pytest.raises(pydantic.ValidationError):
            self._cfg({"arg_static": {"owner": "o"}})

    def test_the_new_keys_are_bounded_by_the_ceilings_that_already_exist(self):
        """Review ME-07's bound applies to these keys because they ARE those keys — which is
        half the argument for riding the same dict rather than adding a field with none."""
        import pydantic

        with pytest.raises(pydantic.ValidationError):
            self._cfg({"arg_static." + "x" * 60: "o"})  # 71 > max_length 64
        with pytest.raises(pydantic.ValidationError):
            self._cfg({"arg_static.owner": "o" * 513})  # > max_length 512

    def test_a_row_carrying_the_mapping_still_resolves_to_the_MCP_adapter(self):
        """`CONFIG_PROTOCOL_MARKERS` keys off `source_tools` being non-empty; a row that
        carries only argument mapping is still a row somebody bound to a file surface."""
        from app.services.sources.base import SourceRegistry

        adapter = SourceRegistry.get_adapter(
            conn(service_id="unregistered", auth_type="static_key",
                 config={"source_tools": {"arg_static.owner": "o"}})
        )
        assert adapter is not None
