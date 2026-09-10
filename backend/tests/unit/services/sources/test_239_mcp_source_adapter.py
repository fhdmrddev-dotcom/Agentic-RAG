"""Phase 239 (SRC-04 / D-239-01 … D-239-07) — the MCP source adapter.

⭐ **THE CLAIM THIS FILE EXISTS TO FALSIFY:** *adding an MCP file source adds ROWS, NOT CODE.*

MCP file servers do not agree on names — `list_directory` / `list_files` / `ls`,
`read_file` / `cat` / `get_file_contents`. Phase 239's binding constraint is that the variance
lives in `connector_connections.config["source_tools"]` as DATA, and that a SECOND, completely
different MCP file server works afterwards with no product change at all.

A test suite that only exercises `list_directory`/`read_file` would agree with the
implementation rather than with the claim, so the vocabulary is PARAMETRIZED here and one of
the three vocabularies (`ls`/`cat`) is a name this codebase does not contain.

⚠ EVERY CASE BELOW WAS DRIVEN RED at `d7b12947d`, before `mcp_source.py` existed:
`ModuleNotFoundError: No module named 'app.services.sources.adapters.mcp_source'`.
"""

from __future__ import annotations

import ast
import base64
import importlib
import json as jsonlib
from pathlib import Path
from typing import Any

import pytest

from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceConnectionDisabled,
    SourceFile,
    SourceHealth,
    SourceNode,
    SourceRegistry,
)
from app.services.sources.adapters.mcp_source import VIRTUAL_ROOT_ID

SERVER = "https://files.example.com/mcp"


# ── doubles ──────────────────────────────────────────────────────────────────────────────


class FakeMcp:
    """A recording stand-in for the `mcp_client` MODULE.

    ⚠ It records `(tool_name, arguments, secret, auth_scheme)` for every call, because the
    tool NAME is the thing under test: asserting on the returned files would pass even if the
    adapter had hard-coded `list_directory` and ignored the binding entirely.
    """

    def __init__(self, *, listing: Any = None, read: Any = None, tools: Any = None) -> None:
        self._listing = listing
        self._read = read
        self._tools = tools if tools is not None else [{"name": "list_directory"}]
        self.calls: list[dict[str, Any]] = []
        self.list_tools_calls: list[dict[str, Any]] = []
        self.raise_on_list_tools: Exception | None = None

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
        payload = self._read if "read" in tool_name or "cat" in tool_name or "content" in tool_name else self._listing
        if callable(payload):
            payload = payload(arguments)
        return payload if payload is not None else {"text": "", "content": [], "isError": False}

    async def list_tools(
        self,
        server_url: str,
        secret: str | None = None,
        timeout: float = 15.0,
        auth_scheme: str = "auto",
    ) -> list[dict[str, Any]]:
        self.list_tools_calls.append({"server_url": server_url, "secret": secret})
        if self.raise_on_list_tools:
            raise self.raise_on_list_tools
        return self._tools


def text_result(text: str) -> dict[str, Any]:
    """What `mcp_client.call_tool` returns for a server answering with `TextContent`."""
    return {
        "text": text,
        "content": [{"type": "text", "text": text}],
        "isError": False,
        "raw": {"content": [{"type": "text", "text": text}]},
    }


def json_listing(entries: list[dict[str, Any]]) -> dict[str, Any]:
    return text_result(jsonlib.dumps(entries))


def conn(**over: Any) -> dict[str, Any]:
    base = {
        "id": "conn-mcp-1",
        "org_id": "org-1",
        "name": "Filesystem",
        "service_id": "custom_mcp",
        "auth_type": "mcp",
        "mcp_server_url": SERVER,
        "config": {},
        "is_enabled": True,
    }
    base.update(over)
    return base


@pytest.fixture
def adapter():
    from app.services.sources.adapters.mcp_source import McpSourceAdapter

    return McpSourceAdapter()


@pytest.fixture(autouse=True)
def no_database(monkeypatch: pytest.MonkeyPatch):
    """⚠ THIS FIXTURE EXISTS BECAUSE A REAL SOCKET ESCAPED, and the escape was the adapter
    behaving CORRECTLY. `conn()` carries an `id` and an `org_id` exactly as every production
    caller does, so the adapter went to `connector_service.resolve_connection` for the
    credential and the suite hit Supabase — `[Errno 11001] getaddrinfo failed`.

    The default stub answers what an UNAUTHENTICATED MCP server's row answers: no secret. The
    one test that cares about the credential path installs its own.
    """

    class _NoCredential:
        secret = None
        auth_scheme = "auto"

    async def _resolve(connection_id: str, org_id: str, **_: Any):
        return _NoCredential()

    monkeypatch.setattr(
        "app.services.connector_service.resolve_connection", _resolve, raising=True
    )


@pytest.fixture
def patch_mcp(monkeypatch: pytest.MonkeyPatch):
    """Swap the adapter's `mcp_client` for a recorder and hand it back."""

    def _install(fake: FakeMcp) -> FakeMcp:
        monkeypatch.setattr(
            "app.services.sources.adapters.mcp_source.mcp_client", fake, raising=True
        )
        return fake

    return _install


# ── A. the binding is DATA ───────────────────────────────────────────────────────────────


class TestToolBindingIsData:
    """D-239-01. The whole phase, asserted at the only place it can be observed."""

    @pytest.mark.asyncio
    async def test_default_vocabulary_when_nothing_is_bound(self, adapter, patch_mcp):
        """`@modelcontextprotocol/server-filesystem` works with zero configuration."""
        fake = patch_mcp(FakeMcp(listing=json_listing([])))
        await adapter.list_files(conn(), folder_id="docs")
        assert fake.calls[0]["tool_name"] == "list_directory"

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "bound_list,bound_read",
        [
            ("list_directory", "read_file"),
            ("list_files", "get_file_contents"),
            # ⭐ A vocabulary this codebase does not contain, anywhere. If either name had to
            # be added to a conditional to make this row pass, the phase's claim is false.
            ("ls", "cat"),
        ],
    )
    async def test_a_second_server_with_a_different_vocabulary_is_just_a_ROW(
        self, adapter, patch_mcp, bound_list: str, bound_read: str
    ):
        fake = patch_mcp(FakeMcp(
            listing=json_listing([{"name": "a.pdf", "type": "file", "size": 3}]),
            read=text_result("hello"),
        ))
        c = conn(config={"source_tools": {"list_tool": bound_list, "read_tool": bound_read}})

        page = await adapter.list_files(c, folder_id="docs")
        assert [f.name for f in page.files] == ["a.pdf"]
        assert fake.calls[0]["tool_name"] == bound_list

        await adapter.read_file(c, "docs/a.pdf")
        assert fake.calls[-1]["tool_name"] == bound_read

    @pytest.mark.asyncio
    async def test_a_partial_binding_keeps_the_default_for_the_other_key(self, adapter, patch_mcp):
        """⚠ Per-KEY fallback, not all-or-nothing. A row naming only its reader must not lose
        its lister — that would make a half-configured connection silently unbrowsable."""
        fake = patch_mcp(FakeMcp(listing=json_listing([]), read=text_result("x")))
        c = conn(config={"source_tools": {"read_tool": "cat"}})

        await adapter.list_files(c, folder_id="d")
        assert fake.calls[-1]["tool_name"] == "list_directory"

        await adapter.read_file(c, "d/f.txt")
        assert fake.calls[-1]["tool_name"] == "cat"

    @pytest.mark.asyncio
    async def test_the_root_path_is_data_too(self, adapter, patch_mcp):
        """⚠ Servers disagree about what "the top" is: `""`, `/`, or an absolute allowed root.
        That is variance, so it is a ROW — a third string key in the same dict, never a branch."""
        fake = patch_mcp(FakeMcp(listing=json_listing([])))
        c = conn(config={"source_tools": {"root_path": "/srv/shared"}})
        await adapter.list_files(c, folder_id=None)
        assert fake.calls[0]["arguments"]["path"] == "/srv/shared"

    @pytest.mark.asyncio
    async def test_an_unbound_connection_addresses_the_servers_own_default_root(
        self, adapter, patch_mcp
    ):
        fake = patch_mcp(FakeMcp(listing=json_listing([])))
        await adapter.list_files(conn(), folder_id=None)
        assert fake.calls[0]["arguments"]["path"] == ""


# ── B. browse ────────────────────────────────────────────────────────────────────────────


class TestBrowse:
    @pytest.mark.asyncio
    async def test_the_root_is_a_label_and_costs_no_round_trip(self, adapter, patch_mcp):
        fake = patch_mcp(FakeMcp(listing=json_listing([])))
        page = await adapter.browse(conn(), folder_id=None)

        assert isinstance(page, BrowsePage)
        assert fake.calls == [], "browsing the root must not contact the server"
        assert len(page.items) == 1
        root = page.items[0]
        assert isinstance(root, SourceNode)
        assert root.kind == "folder" and root.has_children is True
        # ⛔ NOT `""`. The contract's own conformance suite requires a non-empty id, and an
        # empty one would make `browse(root)` indistinguishable from `browse(None)` — an
        # infinite loop in any picker that walks down from what it was handed.
        assert root.id and root.id.strip()

    @pytest.mark.asyncio
    async def test_the_root_label_is_the_connection_the_person_named(self, adapter, patch_mcp):
        patch_mcp(FakeMcp())
        page = await adapter.browse(conn(name="Team Fileshare"), folder_id=None)
        assert page.items[0].name == "Team Fileshare"

    @pytest.mark.asyncio
    async def test_browsing_the_virtual_root_lists_the_configured_root_path(
        self, adapter, patch_mcp
    ):
        fake = patch_mcp(FakeMcp(listing=json_listing([
            {"name": "docs", "type": "directory"},
            {"name": "a.pdf", "type": "file", "size": 1},
        ])))
        root_id = (await adapter.browse(conn(), folder_id=None)).items[0].id

        page = await adapter.browse(conn(), folder_id=root_id)
        assert fake.calls[0]["arguments"]["path"] == ""
        assert [n.name for n in page.items] == ["docs"], "files must not appear in a folder browse"
        assert page.items[0].parent_id == root_id

    @pytest.mark.asyncio
    async def test_browse_returns_only_folders_and_sets_parent_id(self, adapter, patch_mcp):
        fake = patch_mcp(FakeMcp(listing=json_listing([
            {"name": "reports", "path": "docs/reports", "type": "directory"},
            {"name": "notes.md", "path": "docs/notes.md", "type": "file", "size": 12},
        ])))
        page = await adapter.browse(conn(), folder_id="docs")

        assert fake.calls[0]["arguments"] == {"path": "docs"}
        assert [(n.id, n.name, n.parent_id) for n in page.items] == [
            ("docs/reports", "reports", "docs")
        ]

    @pytest.mark.asyncio
    async def test_a_single_shot_listing_never_invents_a_cursor(self, adapter, patch_mcp):
        """⚠ MCP `list_directory` is ATOMIC — the spec defines no cursor for it. `None` is the
        contract-conformant answer (`next_page_token: str | None`), and minting a fake token
        would make `watch_service`'s loop re-issue a call that returns the same page forever."""
        patch_mcp(FakeMcp(listing=json_listing([{"name": "d", "type": "directory"}])))
        page = await adapter.browse(conn(), folder_id="docs")
        assert page.next_page_token is None


# ── C. list_files and the version key ────────────────────────────────────────────────────


class TestListFiles:
    @pytest.mark.asyncio
    async def test_structured_json_entries_map_onto_SourceFile(self, adapter, patch_mcp):
        patch_mcp(FakeMcp(listing=json_listing([
            {
                "name": "Design.pdf",
                "path": "docs/Design.pdf",
                "type": "file",
                "size": 2048,
                "modified_at": "2026-09-01T12:00:00Z",
            },
            {"name": "sub", "path": "docs/sub", "type": "directory"},
        ])))
        page = await adapter.list_files(conn(), folder_id="docs")

        assert isinstance(page, FilePage)
        assert len(page.files) == 1, "a directory entry is not a file"
        f = page.files[0]
        assert isinstance(f, SourceFile)
        assert f.id == "docs/Design.pdf"
        assert f.name == "Design.pdf"
        assert f.mime_type == "application/pdf"
        assert f.size == 2048
        assert f.modified_at == "2026-09-01T12:00:00Z"
        assert f.path == "docs/Design.pdf"

    @pytest.mark.asyncio
    async def test_a_structured_result_object_is_read_as_well_as_a_json_string(
        self, adapter, patch_mcp
    ):
        """MCP 2025-06-18 lets a server answer with `structuredContent`. A server that does is
        not a different server family — it is the same listing, one key over."""
        patch_mcp(FakeMcp(listing={
            "text": "",
            "content": [],
            "isError": False,
            "raw": {"structuredContent": {"entries": [
                {"name": "a.txt", "type": "file", "size": 4},
            ]}},
        }))
        page = await adapter.list_files(conn(), folder_id="docs")
        assert [f.name for f in page.files] == ["a.txt"]

    @pytest.mark.asyncio
    async def test_line_based_text_listings_are_parsed(self, adapter, patch_mcp):
        """`@modelcontextprotocol/server-filesystem` answers `list_directory` in exactly this
        shape — plain lines, no JSON at all."""
        patch_mcp(FakeMcp(listing=text_result(
            "[DIR] subfolder\n"
            "[FILE] report.pdf (1024 bytes)\n"
            "[FILE] notes.md\n"
        )))
        page = await adapter.list_files(conn(), folder_id="docs")

        assert [f.name for f in page.files] == ["report.pdf", "notes.md"]
        assert page.files[0].size == 1024
        assert page.files[0].id == "docs/report.pdf"
        assert page.files[1].size is None

    @pytest.mark.asyncio
    async def test_a_line_based_DIR_entry_is_a_folder_in_browse_and_absent_from_files(
        self, adapter, patch_mcp
    ):
        patch_mcp(FakeMcp(listing=text_result("[DIR] subfolder\n[FILE] a.txt (2 bytes)\n")))
        browsed = await adapter.browse(conn(), folder_id="docs")
        assert [n.name for n in browsed.items] == ["subfolder"]

    @pytest.mark.asyncio
    async def test_version_falls_back_to_SIZE_when_the_server_states_no_time(
        self, adapter, patch_mcp
    ):
        """⭐ D-239-06, and it is NOT cosmetic. `watch_service` compares
        `str(item.modified_at or "")` and its modification branch is
        `if item_mod and existing_ver and item_mod != existing_ver` — so an EMPTY version means
        a file is *never* seen to change, silently, forever. A size-derived version is derived
        from something that actually moves when the file does."""
        patch_mcp(FakeMcp(listing=json_listing([
            {"name": "a.txt", "type": "file", "size": 1024},
        ])))
        page = await adapter.list_files(conn(), folder_id="docs")
        assert page.files[0].modified_at == "size:1024"

    @pytest.mark.asyncio
    async def test_a_real_timestamp_always_wins_over_the_fallback(self, adapter, patch_mcp):
        patch_mcp(FakeMcp(listing=json_listing([
            {"name": "a.txt", "type": "file", "size": 1024, "mtime": "2026-01-02T03:04:05Z"},
        ])))
        page = await adapter.list_files(conn(), folder_id="docs")
        assert page.files[0].modified_at == "2026-01-02T03:04:05Z"

    @pytest.mark.asyncio
    async def test_with_neither_time_nor_size_the_version_is_ABSENT_not_fabricated(
        self, adapter, patch_mcp
    ):
        """⚠ THE ARM THAT MUST NOT GUESS. A hash of the PATH is deterministic, looks exactly
        like a version, and never changes — so it would report "unchanged" for every future
        edit while appearing to work. That is SEED-253's fabrication failure one column over.
        `None` is the honest answer: nothing was measured, so nothing is claimed."""
        patch_mcp(FakeMcp(listing=json_listing([{"name": "a.txt", "type": "file"}])))
        page = await adapter.list_files(conn(), folder_id="docs")
        assert page.files[0].modified_at is None

    @pytest.mark.asyncio
    async def test_a_listing_larger_than_page_size_comes_back_WHOLE(self, adapter, patch_mcp):
        """⚠ H-5. `SourceListing.complete` is only true when the walk ends with no cursor and
        no errors — so silently truncating an atomic listing at `page_size` would make
        `complete=True` a lie, and the deletion guard reads that flag."""
        entries = [{"name": f"f{i}.txt", "type": "file", "size": i + 1} for i in range(75)]
        patch_mcp(FakeMcp(listing=json_listing(entries)))
        page = await adapter.list_files(conn(), folder_id="docs", page_size=30)
        assert len(page.files) == 75
        assert page.next_page_token is None

    @pytest.mark.asyncio
    async def test_path_is_a_real_path_and_never_a_bare_filename(self, adapter, patch_mcp):
        """SEED-253's contract-level invariant, asserted for this family too."""
        patch_mcp(FakeMcp(listing=text_result("[FILE] a.txt (2 bytes)\n")))
        page = await adapter.list_files(conn(), folder_id="docs/reports")
        assert page.files[0].path == "docs/reports/a.txt"

    @pytest.mark.asyncio
    async def test_a_server_error_result_is_raised_not_returned_as_a_listing(
        self, adapter, patch_mcp
    ):
        """⚠ `isError` is a FIELD, not an exception. Ignoring it turns
        "Error: ENOENT, no such directory" into a zero-file listing — and a zero-file listing
        is what the H-5 deletion guard consumes."""
        patch_mcp(FakeMcp(listing={
            "text": "Error: ENOENT: no such file or directory",
            "content": [{"type": "text", "text": "Error: ENOENT"}],
            "isError": True,
            "raw": {},
        }))
        with pytest.raises(ValueError):
            await adapter.list_files(conn(), folder_id="nope")


# ── D. read_file ─────────────────────────────────────────────────────────────────────────


class TestReadFile:
    @pytest.mark.asyncio
    async def test_text_content_decodes_to_utf8_bytes(self, adapter, patch_mcp):
        patch_mcp(FakeMcp(read=text_result("# Notes\nhello wörld\n")))
        filename, raw, mime = await adapter.read_file(conn(), "docs/notes.md")

        assert filename == "notes.md"
        assert raw == "# Notes\nhello wörld\n".encode("utf-8")
        assert mime == "text/markdown"

    @pytest.mark.asyncio
    async def test_a_base64_embedded_resource_decodes_and_its_mime_type_wins(
        self, adapter, patch_mcp
    ):
        blob = b"%PDF-1.7 binary content"
        patch_mcp(FakeMcp(read={
            "text": "",
            "content": [{
                "type": "resource",
                "resource": {
                    "uri": "file:///docs/spec.pdf",
                    "mimeType": "application/pdf",
                    "blob": base64.b64encode(blob).decode("ascii"),
                },
            }],
            "isError": False,
            "raw": {},
        }))
        filename, raw, mime = await adapter.read_file(conn(), "docs/spec.pdf")

        assert filename == "spec.pdf"
        assert raw == blob
        assert mime == "application/pdf"

    @pytest.mark.asyncio
    async def test_an_image_content_block_decodes_too(self, adapter, patch_mcp):
        blob = b"\x89PNG\r\n\x1a\n"
        patch_mcp(FakeMcp(read={
            "text": "",
            "content": [{
                "type": "image",
                "data": base64.b64encode(blob).decode("ascii"),
                "mimeType": "image/png",
            }],
            "isError": False,
            "raw": {},
        }))
        filename, raw, mime = await adapter.read_file(conn(), "img/logo.png")
        assert raw == blob and mime == "image/png"

    @pytest.mark.asyncio
    async def test_a_payload_over_the_ceiling_is_REFUSED(self, adapter, patch_mcp):
        """TM-239-03. The ceiling is checked on the DECODED payload, matching
        `google_drive.py` and `microsoft_graph.py`."""
        # SEED-258: the ceiling is a SETTING now, so read it rather than re-typing 25 MB.
        # The unconfigured/default resolution is still exactly the shipped 25 MB.
        from app.models.user_settings import source_max_file_bytes

        ceiling = source_max_file_bytes()
        assert ceiling == 25 * 1024 * 1024
        patch_mcp(FakeMcp(read=text_result("A" * (ceiling + 1))))
        with pytest.raises(ValueError, match="too large|exceed"):
            await adapter.read_file(conn(), "docs/huge.txt")

    @pytest.mark.asyncio
    async def test_the_ceiling_is_measured_AFTER_base64_decoding(self, adapter, patch_mcp):
        """⚠ Base64 INFLATES by 4/3, so a check on the encoded string would refuse a payload
        that is legal once decoded — and, worse, would pass a decoded payload 33% over."""
        from app.models.user_settings import source_max_file_bytes

        ceiling = source_max_file_bytes()
        patch_mcp(FakeMcp(read={
            "text": "",
            "content": [{"type": "resource", "resource": {
                "mimeType": "application/octet-stream",
                "blob": base64.b64encode(b"B" * (ceiling + 1)).decode("ascii"),
            }}],
            "isError": False,
            "raw": {},
        }))
        with pytest.raises(ValueError, match="too large|exceed"):
            await adapter.read_file(conn(), "docs/huge.bin")

    @pytest.mark.asyncio
    async def test_an_error_result_never_becomes_file_CONTENT(self, adapter, patch_mcp):
        """⛔ THE WORST FAILURE ON THIS PATH. `isError` ignored means the sentence
        "Error: permission denied" is minted as a document, embedded, and answered out of the
        knowledge base as though the file said it."""
        patch_mcp(FakeMcp(read={
            "text": "Error: EACCES: permission denied",
            "content": [{"type": "text", "text": "Error: EACCES: permission denied"}],
            "isError": True,
            "raw": {},
        }))
        with pytest.raises(ValueError):
            await adapter.read_file(conn(), "docs/secret.txt")

    @pytest.mark.asyncio
    async def test_an_empty_result_is_refused_rather_than_returned_as_zero_bytes(
        self, adapter, patch_mcp
    ):
        """⚠ Zero bytes is a VALID file and an UNREADABLE file, and they must not look alike:
        an unreadable file arriving as `b""` is minted as an empty document and looks synced."""
        patch_mcp(FakeMcp(read={"text": "", "content": [], "isError": False, "raw": {}}))
        with pytest.raises(ValueError):
            await adapter.read_file(conn(), "docs/nothing.txt")


# ── E. check ─────────────────────────────────────────────────────────────────────────────


class TestCheck:
    @pytest.mark.asyncio
    async def test_a_reachable_server_reports_ok_with_its_tool_count(self, adapter, patch_mcp):
        fake = patch_mcp(FakeMcp(tools=[{"name": "list_directory"}, {"name": "read_file"}]))
        health = await adapter.check(conn())

        assert isinstance(health, SourceHealth)
        assert health.ok is True and health.error is None
        assert health.details["tools_count"] == 2
        assert fake.list_tools_calls[0]["server_url"] == SERVER

    @pytest.mark.asyncio
    async def test_a_failing_probe_returns_ok_False_and_raises_nothing(self, adapter, patch_mcp):
        fake = FakeMcp()
        fake.raise_on_list_tools = RuntimeError("connection refused")
        patch_mcp(fake)

        health = await adapter.check(conn())
        assert health.ok is False
        assert "connection refused" in (health.error or "")

    @pytest.mark.asyncio
    async def test_check_names_the_bound_tools_so_a_MISBINDING_is_visible(
        self, adapter, patch_mcp
    ):
        """⚠ A green check that only counted tools would say "ok" about a connection bound to
        a tool the server does not have — the most likely misconfiguration on this surface,
        and the one a person would then hunt in their credentials."""
        patch_mcp(FakeMcp(tools=[{"name": "list_directory"}, {"name": "read_file"}]))
        health = await adapter.check(conn(config={"source_tools": {"list_tool": "nope"}}))
        assert health.ok is False
        assert "nope" in (health.error or "")


# ── F. the security boundary ─────────────────────────────────────────────────────────────


class TestSecurityBoundary:
    @pytest.mark.asyncio
    async def test_the_stored_credential_IS_resolved_and_sent(
        self, adapter, patch_mcp, monkeypatch: pytest.MonkeyPatch
    ):
        """⚠ A credential silently dropped produces `401 invalid_token`, which reads as
        *"your credential is wrong"* and sends somebody to re-authorize — `mcp_client`'s own
        recorded lesson, one layer up."""
        fake = patch_mcp(FakeMcp(listing=json_listing([])))
        seen: list[tuple[str, str]] = []

        class _Resolved:
            secret = "tok-abc"
            auth_scheme = "bearer"

        async def _resolve(connection_id: str, org_id: str, **_: Any):
            seen.append((connection_id, org_id))
            return _Resolved()

        monkeypatch.setattr(
            "app.services.connector_service.resolve_connection", _resolve, raising=True
        )
        await adapter.list_files(conn(config={"source_tools": {"list_tool": "ls"}}), "docs")

        assert seen == [("conn-mcp-1", "org-1")], "the lookup is org-scoped, never by id alone"
        assert fake.calls[0]["secret"] == "tok-abc"
        assert fake.calls[0]["auth_scheme"] == "bearer", (
            "an explicitly resolved scheme must reach the transport — mcp_client's `auto` "
            "guess base64s a colon-bearing OAuth token into Basic and collects 401"
        )
        assert fake.calls[0]["tool_name"] == "ls", (
            "the binding comes from the row the CALLER already fetched org-scoped"
        )

    @pytest.mark.asyncio
    async def test_an_already_resolved_connection_is_not_re_read(
        self, adapter, patch_mcp, monkeypatch: pytest.MonkeyPatch
    ):
        """⚠ Presence, not truthiness. A `ResolvedConnection` for an UNAUTHENTICATED server
        legitimately carries `secret = None`; treating that as "not resolved yet" would send
        it back to the database on every call, for exactly the rows with nothing to find."""
        fake = patch_mcp(FakeMcp(listing=json_listing([])))

        async def _boom(*_: Any, **__: Any):
            raise AssertionError("a resolved connection must not be re-read")

        monkeypatch.setattr(
            "app.services.connector_service.resolve_connection", _boom, raising=True
        )
        await adapter.list_files(conn(secret=None, auth_scheme="bearer"), folder_id="docs")
        assert fake.calls[0]["secret"] is None
        assert fake.calls[0]["auth_scheme"] == "bearer"

    @pytest.mark.asyncio
    async def test_a_connection_with_no_server_url_is_refused_by_name(self, adapter, patch_mcp):
        fake = patch_mcp(FakeMcp(listing=json_listing([])))
        with pytest.raises(ValueError, match="mcp_server_url|server URL"):
            await adapter.list_files(conn(mcp_server_url=None), folder_id="docs")
        assert fake.calls == [], "nothing may be sent before the destination is known"

    def test_a_disabled_connection_never_reaches_this_adapter(self):
        """BUG-260907-03 — refused in the registry, so it covers browse, list, read and check
        and every caller nobody has written yet."""
        with pytest.raises(SourceConnectionDisabled):
            SourceRegistry.get_adapter(conn(is_enabled=False))

    def test_the_adapter_opens_NO_socket_of_its_own(self):
        """TM-239-01. Every byte leaves through `McpClient`, which enforces
        `validate_mcp_destination` (RFC1918, loopback, cloud metadata) and pins the resolved
        IP against DNS rebinding. A raw `httpx` here would bypass all of it."""
        import app.services.sources.adapters.mcp_source as mod

        source = Path(mod.__file__).read_text(encoding="utf-8")
        tree = ast.parse(source)
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
                if node.module.endswith("egress"):
                    imported.add("egress")

        for forbidden in ("httpx", "requests", "urllib", "aiohttp", "socket", "egress"):
            assert forbidden not in imported, (
                f"{forbidden!r} is imported by mcp_source.py — all MCP egress must funnel "
                "through mcp_client, which is where the SSRF fence lives"
            )

    def test_a_server_advertised_HINT_never_decides_anything(self):
        """TM-239-02. `readOnlyHint` and `annotations` are authored by the REMOTE server. They
        may be carried to a human, but a value the other end controls must never widen a
        permission or skip a confirmation — that is privilege escalation by press release.

        Asserted structurally rather than behaviourally: a behavioural test can only check the
        hints somebody thought to send, while this refuses the SHAPE."""
        import app.services.sources.adapters.mcp_source as mod

        findings = _hint_comparisons(Path(mod.__file__).read_text(encoding="utf-8"))
        assert not findings, (
            "mcp_source.py branches on a server-advertised hint: "
            + ", ".join(f"line {ln}: {lit!r}" for ln, lit in findings)
        )

    def test_that_hint_fence_can_actually_fire(self):
        """⭐ THE POSITIVE CONTROL. Without it the assertion above is *"we found nothing"*,
        which is indistinguishable from *"we looked for nothing"* — the exact defect the
        Phase 232 boundary fence shipped with."""
        planted = 'def f(t):\n    if t.get("annotations", {}).get("readOnlyHint") is True:\n        return 1\n'
        assert _hint_comparisons(planted), "the hint fence cannot detect what it exists to detect"
        assert _hint_comparisons('x = 1 if k == "readOnlyHint" else 2\n')
        assert _hint_comparisons('if "annotations" in tool: pass\n')
        # …and it does not fire on an ordinary listing key.
        assert _hint_comparisons('if k == "modified_at": pass\n') == []

    def test_that_the_fence_can_fire_on_the_CR_02_SHAPE_SPECIFICALLY(self):
        """⭐ THE POSITIVE CONTROL FOR `description`, PLANTED AS THE DEFECT ACTUALLY LOOKED.

        ⛔ Not a paraphrase — this is the shipped code CR-02 was written against, restored
        verbatim from `fe6da7122^`::

            haystack = f"{name} {description}".lower()

        with `description` fetched one line above it. The fix removed that read and explained
        itself in a docstring, and a docstring is not a guard: the whole of SEED-270 is that
        this project keeps enforcing invariants with prose and then shipping their violation
        green. So the fence must SEE the read, and this control is the proof that it does.

        ⚠ The `f"{name} {description}"` line itself is INVISIBLE to an AST fence — inside an
        f-string `description` is a `Name`, not a string constant. What is visible, and what
        is therefore the thing asserted, is the FETCH: `item.get("description")`,
        `item["description"]`, `k == "description"`. That is the entry point — a server-authored
        field cannot decide anything without first being read out of the server's own dict —
        so catching the fetch catches the class, and catching it is enough.
        """
        planted_get = (
            'def infer(item):\n'
            '    name = str(item.get("name") or "")\n'
            '    description = str(item.get("description") or "")\n'
            '    haystack = f"{name} {description}".lower()\n'
            '    return haystack\n'
        )
        assert _hint_comparisons(planted_get), (
            "the hint fence cannot see a server-authored `description` being read — which is "
            "exactly the field CR-02 let a hostile server choose our reader with"
        )
        assert _hint_comparisons('x = item["description"]\n')
        assert _hint_comparisons('if key == "description": pass\n')
        # ⚠ …and it still does not fire on a field the SERVER does not author. `filename`
        #   comes off a listing entry the same way `description` comes off a tool, so a fence
        #   that caught both would be catching "reads a dict", not "trusts the other end".
        assert _hint_comparisons('if k == "filename": pass\n') == []

    def test_NEITHER_MODULE_lets_a_server_authored_field_decide(self):
        """⛔ CR-02's own last paragraph, which the fix did not carry out.

        The review asked for the fence to *"cover `connector_service.infer_source_tools`, so
        `description` gains the same structural treatment `annotations` has"*. The fix moved
        the detector into `mcp_source.py` instead — a real improvement (ME-05), and it means
        the scanned file now holds the detector. But `description` was never added to the key
        set, so the fence still could not see the defect if it came back, in EITHER module.

        ⚠ BOTH MODULES ARE SCANNED, and the second one is the point rather than a belt-and-
        braces flourish: `connector_service.py` is where the defect actually lived, it is where
        discovery still runs (`discover_connection_tools` writes `config["source_tools"]`), and
        a fence that scans only the file the code was moved INTO would go green if it moved
        back out. Neither module reads a hint key today — verified before this fence was
        written, so it is not asserting an accident.
        """
        for module_name in _HINT_FENCED_MODULES:
            mod = importlib.import_module(module_name)
            findings = _hint_comparisons(Path(mod.__file__).read_text(encoding="utf-8"))
            assert not findings, (
                f"{module_name} branches on a field the REMOTE SERVER authors: "
                + ", ".join(f"line {ln}: {lit!r}" for ln, lit in findings)
            )


#: Keys a REMOTE MCP server controls. Matched in comparisons, membership tests and
#: subscripts, because `tool["annotations"]["readOnlyHint"]` reaching an `if` is the shape
#: TM-239-02 forbids and none of those is a `Compare` node.
#:
#: ⛔ `description` IS ONE OF THEM, AND ITS ABSENCE HERE WAS CR-02 (added 239-12). It is not
#: an MCP *hint* — it is a free-text sentence — and that is precisely why it was trusted while
#: `annotations` was fenced: the same trust class wearing a friendlier name. A server wrote
#: *"Retrieve the contents of a file at the given path."* on a tool called `purge_documents`
#: and this app bound it as the READER, then invoked it unattended on every file in the folder.
#: `readOnlyHint` never got to do anything that bad.
#:
#: ⚠ THE COST OF LISTING IT IS REAL AND IS ACCEPTED: neither fenced module may now read
#: `description` even to CARRY it to a human — `_hint_comparisons` cannot tell a display from
#: a decision. `annotations` has always carried that same cost here. If a future phase needs
#: to show a person what a server said about its own tool, it does that ABOVE these two
#: modules (the discovery cache already holds the raw list), or it adds a named exemption with
#: its reason in this file. An exemption that is argued is auditable; a key that was never
#: listed is not.
_HINT_KEYS = (
    "readonlyhint",
    "annotations",
    "destructivehint",
    "idempotenthint",
    "openworldhint",
    "description",
)

#: The modules in which a server-authored field may not decide anything. Two, not one — see
#: `test_NEITHER_MODULE_lets_a_server_authored_field_decide` for why the second is load-bearing.
_HINT_FENCED_MODULES: tuple[str, ...] = (
    "app.services.sources.adapters.mcp_source",
    "app.services.connector_service",
)


def _hint_comparisons(source: str) -> list[tuple[int, str]]:
    findings: list[tuple[int, str]] = []
    for node in ast.walk(ast.parse(source)):
        operands: list[ast.expr] = []
        if isinstance(node, ast.Compare):
            operands = [node.left, *node.comparators]
        elif isinstance(node, ast.Subscript):
            operands = [node.slice]
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get":
            operands = list(node.args[:1])
        for operand in operands:
            if isinstance(operand, ast.Constant) and isinstance(operand.value, str):
                if operand.value.strip().lower() in _HINT_KEYS:
                    findings.append((getattr(node, "lineno", 0), operand.value))
    return findings


# ── G. protocol-level resolution (D-239-03) ──────────────────────────────────────────────


class TestProtocolResolution:
    """⭐ MCP IS A PROTOCOL, NOT A VENDOR, AND THAT DISTINCTION IS THE WHOLE MECHANISM.

    Google Drive and OneDrive resolve by `service_id` because each is one service with one
    name. An MCP server has no such name — `service_id` is whatever the person typed, and the
    next person will type something else. Resolving on *"the row speaks MCP"* is what lets an
    arbitrary server work with no registration, and it is why `test_boundary_fence.py` stays
    100% green: `mcp` is a transport, exactly as `https` is.
    """

    def test_the_registry_publishes_the_protocol(self):
        from app.services.sources.base import SourceRegistry

        assert "mcp" in SourceRegistry.list_supported_services()
        assert SourceRegistry.is_source_supported("mcp") is True

    def test_both_registered_keys_resolve(self):
        from app.services.sources.adapters.mcp_source import McpSourceAdapter
        from app.services.sources.base import SourceRegistry

        for key in ("mcp", "custom_mcp"):
            assert isinstance(SourceRegistry.get_adapter(key), McpSourceAdapter), key

    def test_a_server_NOBODY_REGISTERED_resolves_by_its_auth_type(self):
        """⭐ THE ROW THAT PROVES THE CLAIM. `wibble_files_v2` is not in the registry, is not
        in this codebase, and never will be — and it resolves, because the row says `mcp`."""
        from app.services.sources.adapters.mcp_source import McpSourceAdapter
        from app.services.sources.base import SourceRegistry

        adapter = SourceRegistry.get_adapter(
            {"id": "c1", "service_id": "wibble_files_v2", "auth_type": "mcp"}
        )
        assert isinstance(adapter, McpSourceAdapter)

    def test_a_row_predating_auth_type_resolves_by_its_BINDING(self):
        """A connection carrying a file binding is, by construction, a file source. This arm
        covers a row written before `auth_type` was set on it."""
        from app.services.sources.adapters.mcp_source import McpSourceAdapter
        from app.services.sources.base import SourceRegistry

        adapter = SourceRegistry.get_adapter({
            "id": "c2",
            "service_id": "something_bespoke",
            "config": {"source_tools": {"list_tool": "ls", "read_tool": "cat"}},
        })
        assert isinstance(adapter, McpSourceAdapter)

    def test_a_pydantic_config_is_read_the_same_way_as_a_dict(self):
        """`api/connectors.py` hands a `ConnectorConnectionResponse`, whose `config` is a
        MODEL. A resolution that only understood dicts would work in `watch_service` and fail
        on every browse — two paths, one rule."""
        from app.models.connector import ConnectorConnectionResponse
        from app.services.sources.adapters.mcp_source import McpSourceAdapter
        from app.services.sources.base import SourceRegistry

        row = ConnectorConnectionResponse.model_validate({
            "id": "c3",
            "org_id": "org-1",
            "name": "Filesystem",
            "service_id": "totally_unknown",
            "auth_type": "mcp",
            "mcp_server_url": SERVER,
            "config": {"source_tools": {"list_tool": "ls"}},
        })
        assert isinstance(SourceRegistry.get_adapter(row), McpSourceAdapter)

    def test_an_exact_service_id_still_wins(self):
        """⚠ The protocol arm is a FALLBACK. A first-party family that also carried an MCP-ish
        marker must keep its own adapter, or this becomes a hijack."""
        from app.services.sources.adapters.google_drive import GoogleDriveSourceAdapter
        from app.services.sources.base import SourceRegistry

        adapter = SourceRegistry.get_adapter(
            {"id": "c4", "service_id": "google", "auth_type": "mcp"}
        )
        assert isinstance(adapter, GoogleDriveSourceAdapter)

    def test_an_ordinary_unregistered_row_still_resolves_to_NOTHING(self):
        """⚠ THE NEGATIVE HALF. A fallback that answers for everything is not a fallback — it
        is `watch_service`'s deleted Drive default, which read a Microsoft connection with the
        Google adapter and looked like a working sync."""
        from app.services.sources.base import SourceRegistry

        assert SourceRegistry.get_adapter(
            {"id": "c5", "service_id": "unknown_provider", "auth_type": "static_key"}
        ) is None
        assert SourceRegistry.get_adapter("unknown_provider") is None

    def test_a_disabled_MCP_row_is_refused_BEFORE_the_protocol_arm(self):
        """⚠ ORDER MATTERS. A new resolution arm placed above the `is_enabled` gate would
        re-open BUG-260907-03 for exactly the family being added."""
        from app.services.sources.base import SourceConnectionDisabled, SourceRegistry

        with pytest.raises(SourceConnectionDisabled):
            SourceRegistry.get_adapter(
                {"id": "c6", "service_id": "wibble", "auth_type": "mcp", "is_enabled": False}
            )

    def test_the_protocol_map_is_DATA_and_not_a_branch(self):
        """`base.py`'s own note over the deleted `_ensure_registered` asks for exactly this:
        *"make the routing DATA (a dict keyed by service_id) rather than control flow"*.
        Adding a second protocol must be a row in one of these two dicts."""
        from app.services.sources import base

        assert isinstance(base.PROTOCOL_ADAPTERS, dict)
        assert base.PROTOCOL_ADAPTERS["mcp"] == "mcp"
        assert base.CONFIG_PROTOCOL_MARKERS["source_tools"] == "mcp"

    def test_the_eager_import_is_what_registers_it(self):
        """⚠ A decorator only fires on import. `sources/__init__.py` importing every adapter
        eagerly is why `_ensure_registered`'s lazy provider-keyed import could be deleted — so
        an adapter left out of that list is unregistered and unresolvable, and `watch_service`
        raises `NotImplementedError` for a perfectly good connection."""
        import importlib

        pkg = importlib.import_module("app.services.sources")
        assert getattr(pkg, "mcp_source", None) is not None, (
            "mcp_source is not eagerly imported by app/services/sources/__init__.py"
        )


# ── H. Phase 239 review, gap-closure round 1 ─────────────────────────────────────────────


class TestAnUnparsedListingIsNeverReportedAsAnEmptyOne:
    """⛔ HI-03 — THE FAIL-OPEN IN A GUARD WHOSE WHOLE PURPOSE IS TO FAIL CLOSED.

    `McpToolResultError`'s docstring names this as *"the worst defect available on this
    path"*, and then `_parse_listing` caught only the `isError` FIELD. Everything else the
    parser did not recognise fell through both doors and returned `[]` — and because
    `list_files` always answers `next_page_token=None`, `watch_service` stamps
    `listing.complete = True` on the first pass. **Complete, and zero files** is precisely the
    state the H-5 deletion guard exists to refuse: every tracked item goes `missing`, every
    document minted from that folder gets a `source_state`, and the run reports success.
    """

    def test_a_prose_refusal_with_isError_false_is_NOT_an_empty_folder(self):
        from app.services.sources.adapters.mcp_source import (
            McpToolResultError,
            _parse_listing,
        )

        with pytest.raises(McpToolResultError, match="does not understand"):
            _parse_listing({"isError": False, "text": "permission denied"}, "/docs")

    def test_an_unrecognised_JSON_shape_is_NOT_an_empty_folder(self):
        from app.services.sources.adapters.mcp_source import (
            McpToolResultError,
            _parse_listing,
        )

        with pytest.raises(McpToolResultError, match="does not understand"):
            _parse_listing(
                {"isError": False, "text": '{"status":"denied","reason":"no access to /docs"}'},
                "/docs",
            )

    def test_a_GENUINELY_empty_folder_is_still_empty_and_still_complete(self):
        """⭐ THE CONTROL THAT KEEPS THE FIX FROM BEING A DIFFERENT FAIL-CLOSED BUG. The
        distinction is between two silences — *"the server said there is nothing here"* and
        *"I did not understand the answer"* — and only the first may be complete."""
        from app.services.sources.adapters.mcp_source import _parse_listing

        assert _parse_listing({"isError": False, "text": ""}, "/docs") == []
        assert _parse_listing({"isError": False, "text": "   \n\n  "}, "/docs") == []
        assert _parse_listing({"isError": False, "text": "[]"}, "/docs") == []
        assert _parse_listing({"isError": False, "text": '{"entries": []}'}, "/docs") == []

    def test_a_PARTIALLY_understood_listing_is_kept_rather_than_refused(self):
        """A trailing `Total: 1 file` summary line must not throw away the file above it."""
        from app.services.sources.adapters.mcp_source import _parse_listing

        entries = _parse_listing(
            {"isError": False, "text": "[FILE] a.txt (10 bytes)\nTotal: 1 file\n"}, "/docs"
        )
        assert [e.name for e in entries] == ["a.txt"]

    @pytest.mark.asyncio
    async def test_the_unparsed_listing_reaches_the_CALLER_rather_than_the_watch_loop(
        self, adapter, patch_mcp
    ):
        """The unit above proves the parser; this proves nothing swallows it on the way out —
        which is the half that actually protects the deletion guard."""
        from app.services.sources.adapters.mcp_source import McpToolResultError

        patch_mcp(FakeMcp(listing=text_result("permission denied")))
        with pytest.raises(McpToolResultError):
            await adapter.list_files(conn(config={"source_tools": {"root_path": "/srv"}}),
                                     folder_id="docs")


class TestAnEmptyFileIsAFileAndNotAnError:
    """⚠ ME-03 — the code contradicted the comment three lines above it.

    That comment says *"an empty file is legal; an UNREADABLE file arriving as b'' is not, and
    the two must not look alike"*. The code then collapsed both into the error arm, so a
    watched folder holding one empty `.md` placeholder raised for that item on every cycle,
    forever, for a file that was exactly what it appeared to be.
    """

    @pytest.mark.asyncio
    async def test_a_zero_byte_file_is_imported_as_the_empty_file_it_is(
        self, adapter, patch_mcp
    ):
        patch_mcp(FakeMcp(read=text_result("")))
        filename, payload, mime = await adapter.read_file(conn(), "docs/placeholder.md")
        assert filename == "placeholder.md"
        assert payload == b""
        assert mime == "text/markdown"

    @pytest.mark.asyncio
    async def test_a_server_that_sent_NO_CONTENT_BLOCK_is_still_refused(
        self, adapter, patch_mcp
    ):
        """⭐ THE CONTROL. The fix must not make an unreadable file look like an empty one —
        that is the same collapse in the other direction, and it is the one that mints a
        silent `b""` as a document and reads as a successful sync forever after."""
        from app.services.sources.adapters.mcp_source import McpToolResultError

        patch_mcp(FakeMcp(read={"text": "", "content": [], "isError": False, "raw": {}}))
        with pytest.raises(McpToolResultError, match="no content blocks"):
            await adapter.read_file(conn(), "docs/ghost.md")


class TestTheRootIsNotAPathAServerCanReturn:
    """⚠ LO-06 — the sentinel used to live in the same namespace as real data."""

    def test_the_sentinel_cannot_be_produced_by_joining_a_folder_and_a_name(self):
        from app.services.sources.adapters.mcp_source import VIRTUAL_ROOT_ID, _join

        assert _join("", VIRTUAL_ROOT_ID) != VIRTUAL_ROOT_ID or ":" in VIRTUAL_ROOT_ID
        assert ":" in VIRTUAL_ROOT_ID, (
            "the sentinel must carry a character `_join` never introduces, or a server whose "
            "root holds a folder of that name has it silently rewritten to root_path"
        )
        assert "\x00" not in VIRTUAL_ROOT_ID, (
            "a NUL reaches connector_watches.source_folder_id and is a Postgres 22P05 — the "
            "defect v3.7 UAT caught in a .msg subject line"
        )

    @pytest.mark.asyncio
    async def test_a_real_folder_called_virtual_root_is_addressed_as_itself(
        self, adapter, patch_mcp
    ):
        """The defect, driven end to end — AND AT THE EMPTY ROOT, WHICH IS THE ONLY PLACE IT
        IS REACHABLE. That is the whole reason LO-06 and HI-04 are the same story: `_join`
        only yields the bare name `virtual_root` when the folder path is `""`, and HI-04
        establishes that the folder path is ALWAYS `""` today, because nothing can set a root.

        ⚠ This case was written first with `root_path="/srv"` and it PASSED against the old
        sentinel — the id was `/srv/virtual_root` either way, so it proved nothing. A test
        that cannot fail on the defect is not evidence of the fix.

        Under the old sentinel: the folder's id was the literal `virtual_root`, `wire_path`
        matched it against `VIRTUAL_ROOT_IDS`, and clicking the folder listed `root_path`
        instead — the folder shown and the folder read were different folders.
        """
        fake = patch_mcp(FakeMcp(listing=json_listing([
            {"name": "virtual_root", "type": "directory"},
        ])))
        c = conn()  # no root_path — the state every MCP row is in today (HI-04)
        page = await adapter.browse(c, folder_id=VIRTUAL_ROOT_ID)
        assert [n.id for n in page.items] == ["virtual_root"]

        await adapter.browse(c, folder_id=page.items[0].id)
        assert fake.calls[-1]["arguments"]["path"] == "virtual_root", (
            "the sentinel swallowed a real folder: this browse listed the root instead"
        )


class TestTheRootIsValidatedBeforeItIsOffered:
    """⚠ LO-02 — `browse(None)` minted a plausible root before the binding was validated, so a
    row with no `mcp_server_url` rendered a folder named after the connection and failed only
    on the next click. The failure then reads as *"that folder is broken"* rather than
    *"this connection is not configured"*."""

    @pytest.mark.asyncio
    async def test_a_row_with_no_server_url_does_not_mint_a_root(self, adapter, patch_mcp):
        fake = patch_mcp(FakeMcp())
        with pytest.raises(ValueError, match="mcp_server_url|server to read from"):
            await adapter.browse(conn(mcp_server_url=None), folder_id=None)
        assert fake.calls == [], "still no round trip — the refusal is local"

    @pytest.mark.asyncio
    async def test_a_row_with_a_malformed_binding_does_not_mint_a_root(self, adapter, patch_mcp):
        patch_mcp(FakeMcp())
        with pytest.raises(ValueError, match="source_tools"):
            await adapter.browse(conn(config={"source_tools": "read_file"}), folder_id=None)

    @pytest.mark.asyncio
    async def test_a_valid_row_still_costs_no_round_trip_to_the_server(self, adapter, patch_mcp):
        fake = patch_mcp(FakeMcp())
        page = await adapter.browse(conn(), folder_id=None)
        assert fake.calls == [], "browsing the root must not contact the server"
        assert len(page.items) == 1


class TestTheEmptyRootIsNamedWhenItPlausiblyCausedTheFailure:
    """⚠ HI-04, AND ONLY THE VERIFIED HALF OF IT.

    VERIFIED: `root_path` defaults to `""`, `infer_source_tools` never produces it, and
    Settings renders no control for it — so the virtual root always resolves to `path: ""`
    and the only way to set one is a hand-crafted PATCH.
    SUSPECTED: that `""` is what a server refuses. `SEED-257` records that MCP sources cannot
    be driven locally at all, and two shipped tests in this file assert the opposite claim.
    So the empty path is NAMED when a listing fails, and nothing is refused on a guess.
    ⛔ The Settings control is still owed and is a frontend change — see `239-04-SUMMARY.md`.
    """

    @pytest.mark.asyncio
    async def test_a_failed_listing_at_an_empty_root_names_the_empty_root(
        self, adapter, patch_mcp
    ):
        from app.services.sources.adapters.mcp_source import McpToolResultError

        patch_mcp(FakeMcp(listing={
            "text": "Access denied - path outside allowed directories",
            "content": [], "isError": True, "raw": {},
        }))
        with pytest.raises(McpToolResultError, match="no root folder set"):
            await adapter.list_files(conn(), folder_id=None)

    @pytest.mark.asyncio
    async def test_a_failed_listing_at_a_REAL_root_does_not_blame_the_root(
        self, adapter, patch_mcp
    ):
        """⭐ The control: a configured root must not be accused of being absent."""
        from app.services.sources.adapters.mcp_source import McpToolResultError

        patch_mcp(FakeMcp(listing={
            "text": "Access denied", "content": [], "isError": True, "raw": {},
        }))
        with pytest.raises(McpToolResultError) as caught:
            await adapter.list_files(
                conn(config={"source_tools": {"root_path": "/srv"}}), folder_id=None
            )
        assert "no root folder set" not in str(caught.value)



class TestAToolSetToDenyIsNotCallableAsTheSourceReader:
    """⛔ ME-01 — the source path invoked MCP tools with no consultation of `tool_grants`.

    `mcp_source` calls `mcp_client.call_tool` directly; the approval posture lives in
    `tool_dispatcher`, above the AGENT path only. So an operator could set
    `read_file: "deny"` — a deliberate, recorded refusal — and the watch loop went on calling
    `read_file` on every file in the folder. A grant that reads as configured and grants
    nothing is the state `_sanitize_tool_grants` raises to prevent one column over.
    """

    @pytest.mark.asyncio
    async def test_a_denied_READER_is_refused_before_a_byte_leaves(self, adapter, patch_mcp):
        fake = patch_mcp(FakeMcp())
        c = conn(
            config={"source_tools": {"read_tool": "cat"}},
            tool_grants={"cat": "deny"},
        )
        with pytest.raises(ValueError, match="set to 'deny'"):
            await adapter.read_file(c, "docs/a.txt")
        assert fake.calls == [], "the refusal must precede the transport, not follow it"

    @pytest.mark.asyncio
    async def test_a_denied_LISTER_is_refused_too(self, adapter, patch_mcp):
        fake = patch_mcp(FakeMcp(listing=json_listing([])))
        c = conn(
            config={"source_tools": {"list_tool": "ls", "root_path": "/srv"}},
            tool_grants={"ls": "deny"},
        )
        with pytest.raises(ValueError, match="set to 'deny'"):
            await adapter.list_files(c, folder_id="/srv")
        assert fake.calls == []

    @pytest.mark.asyncio
    async def test_ask_and_allow_are_NOT_a_refusal(self, adapter, patch_mcp):
        """⭐ The control. Only an explicit `deny` refuses — `ask` is a posture for the agent's
        interactive path and would make an unattended watch loop unrunnable."""
        patch_mcp(FakeMcp(read=text_result("hello")))
        for posture in ("ask", "allow"):
            c = conn(
                config={"source_tools": {"read_tool": "cat"}},
                tool_grants={"cat": posture},
            )
            name, payload, _ = await adapter.read_file(c, "docs/a.txt")
            assert payload == b"hello", posture

    @pytest.mark.asyncio
    async def test_a_row_with_NO_grants_at_all_still_reads(self, adapter, patch_mcp):
        """⚠ THE ASYMMETRY, PINNED. `phase_types.py` GATE 6 denies a tool with no grant; this
        surface does not, and the difference is deliberate — every MCP row that exists today
        carries no grants, so deny-by-default here would break every working source rather
        than close a hole. If this test ever has to change, the posture changed with it."""
        patch_mcp(FakeMcp(read=text_result("hello")))
        _, payload, _ = await adapter.read_file(conn(), "docs/a.txt")
        assert payload == b"hello"

    @pytest.mark.asyncio
    async def test_a_grant_on_a_DIFFERENT_tool_denies_nothing(self, adapter, patch_mcp):
        patch_mcp(FakeMcp(read=text_result("hello")))
        c = conn(
            config={"source_tools": {"read_tool": "cat"}},
            tool_grants={"delete_file": "deny"},
        )
        _, payload, _ = await adapter.read_file(c, "docs/a.txt")
        assert payload == b"hello"
