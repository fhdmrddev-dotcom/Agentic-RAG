---
phase: 239-any-mcp-server-with-files
reviewed: 2026-09-08T00:00:00Z
depth: standard
diff_base: 69a8da589
diff_head: dc021defc
files_reviewed: 14
files_reviewed_list:
  - backend/app/models/connector.py
  - backend/app/services/connector_service.py
  - backend/app/services/sources/__init__.py
  - backend/app/services/sources/base.py
  - backend/app/services/sources/adapters/mcp_source.py
  - backend/tests/unit/services/sources/test_239_mcp_source_adapter.py
  - backend/tests/unit/services/sources/test_boundary_fence.py
  - backend/tests/unit/services/sources/test_source_adapter_conformance.py
  - backend/tests/unit/test_239_mcp_config_source_tools.py
  - backend/tests/unit/test_239_mcp_source_discovery.py
  - backend/tests/unit/test_238_source_families_route.py
  - frontend/src/components/settings/ConnectionFormPanel.tsx
  - frontend/src/components/settings/ConnectionsTab.tsx
  - frontend/src/components/settings/connectionFormCopy.ts
  - frontend/src/components/settings/connectionsCopy.ts
  - frontend/src/components/settings/connectionRowVerdict.ts
  - frontend/src/components/sources/sourceCapability.ts
  - frontend/src/lib/api/org.ts
  - scripts/vitest-count-gate.cjs
findings:
  critical: 2
  high: 4
  medium: 7
  low: 6
  total: 19
status: issues_found
---

# Phase 239: Code Review Report

**Reviewed:** 2026-09-08
**Depth:** standard (source only; `.planning/` and `docs/` excluded)
**Range:** `69a8da589..dc021defc` on `develop`
**Status:** issues_found — 2 Critical, 4 High

## How to read this report

Every finding is marked **VERIFIED** (I executed code or read the exact lines and can state the
outcome) or **SUSPECTED** (reasoned from the code, not driven). Nine findings were driven against
the shipped modules in the project venv; the transcripts are quoted inline.

`.planning/` claims were treated as hypotheses. Two of them are refuted below (`ME-05`, `LO-01`).

---

## What I verified as SOUND (so the findings below are read against a real baseline)

These are not padding — each was a named risk in the review brief and each holds:

- **Egress funnels through `mcp_client`.** `grep` for `httpx|requests|urllib|aiohttp|socket` across
  `mcp_source.py` and `base.py` returns nothing but a docstring mention. The AST fence
  (`test_239_mcp_source_adapter.py:653`) refuses those imports *and* `app.security.egress`, and I
  read it — it walks `ast.Import`/`ast.ImportFrom` and would fire.
- **The boundary fence CAN fail.** `test_the_fence_can_actually_fire` plants
  `if "google" in service_id` and `provider == "onedrive"` and asserts both are caught. Not vacuous
  *for the shapes it covers* (but see `ME-05`/`ME-06` for what it does not cover).
- **The hint fence CAN fail.** `_hint_comparisons` handles `Compare`, `Subscript` and `.get("…")`,
  and `test_that_hint_fence_can_actually_fire` plants three positive controls plus a negative
  control. `readOnlyHint`/`annotations` genuinely decide nothing inside `mcp_source.py`.
- **Path traversal into local storage is closed.** `file_id` → `posixpath.basename(...)` in
  `read_file`, then `ingest_splice.py:228` builds `f"{user_id}/{document_id}/{_storage_safe(filename)}"`.
  A server-supplied `../../../etc/passwd` cannot escape the Storage prefix.
- **Recursive walk is cycle- and budget-bounded.** `preview_service.walk_source_files` seeds a
  `seen` set with the start folder and caps at `MAX_FOLDERS`; a self-referential MCP directory
  cannot loop.
- **A disabled connection is refused before the new protocol arm.** `base.py:294` raises
  `SourceConnectionDisabled` above the `_protocol_of` read at line 306. BUG-260907-03 is not
  re-opened for MCP.
- **SEED-239's org-wide 503 is closed for this key.** `source_tools` is declared on `McpConfig`
  (`connector.py:251`), so a source-bound row still matches the `ConnectorConfig` union and
  `_to_response`'s list comprehension cannot be poisoned by it.
- **All 221 backend tests in the touched suites pass** (`pytest tests/unit/services/sources
  tests/unit/test_239_* tests/unit/test_238_source_families_route.py -q` → `221 passed`).

---

## Critical

### CR-01: A destructive server tool can be bound as the file READER through the shipped UI, and the unattended watch loop then calls it on every file

**VERIFIED.**
**Files:**
- `backend/app/services/connector_service.py:528-563` (`reject_unoffered_source_tools`)
- `frontend/src/components/settings/ConnectionFormPanel.tsx:1694-1762` (the picker)
- `backend/app/services/sources/adapters/mcp_source.py:578-583` (`read_file` → `call_tool`)

**Issue.** `_MUTATION_WORDS` (line 419) refuses `write`/`delete`/`remove`/… **only inside
`infer_source_tools`**, the auto-detector. The *write boundary* — the function whose own docstring
says it is *"the door a hand-crafted PATCH comes through"* — checks only that the value is a name
the server **offered**, never that it is safe:

```python
for key, value in source_tools.items():
    if key == "root_path" or not value: continue
    if str(value) not in offered: raise ValueError(...)      # existence only
```

Driven against the shipped function:

```
offered = [read_file, delete_file, list_directory]
reject_unoffered_source_tools({"source_tools": {"read_tool": "delete_file"}}, offered)
  -> ACCEPTED
```

This is not an attacker-only path. `ConnectionFormPanel.tsx:1750-1754` renders **every discovered
tool name** as an `<option>` under the label *"File content tool"* — `delete_file` and `write_file`
included — with no filtering, and the JSX comment asserts *"the backend refuses one anyway
(`reject_unoffered_source_tools`)"*, which is false for this class.

**Failure scenario.** Operator (`org:manage`) connects a filesystem-ish MCP server, opens the File
source mapping card, and picks `delete_file` from the "File content tool" dropdown — a plausible
mis-click, since the dropdown is an unordered dump of the server's whole tool list. `McpConfig`
accepts it, `reject_unoffered_source_tools` accepts it, `McpSourceAdapter.check()` reports **ok**
(the tool exists on the server — `mcp_source.py:625`). The watch loop then calls
`adapter.read_file(conn, item.id)` for every new and every modified file
(`watch_service.py:315, 408`), i.e. `tools/call {"name": "delete_file", "arguments": {"path": …}}`
against every tracked file, unattended, on every cycle. Data loss on the connected server, with a
green "ok" health probe throughout.

**Fix.** Apply the mutation guard at the boundary, not only in the detector, and hide mutating
names from the picker:

```python
# connector_service.py, inside reject_unoffered_source_tools
if key in ("list_tool", "read_tool") and _looks_like_a_mutation(str(value)):
    raise ValueError(
        f"source_tools.{key} names {value!r}, whose name says it CHANGES something. "
        f"Refused rather than stored: this tool is invoked unattended by the watch loop "
        f"on every file in the folder."
    )
```

```tsx
// ConnectionFormPanel.tsx — offer only non-mutating names
{probeResult.filter(t => !looksLikeMutation(t.name)).map(tool => …)}
```

Both halves are needed; the server-side one is the boundary.

---

### CR-02: A server-authored `description` string decides which tool is auto-bound and invoked — the same trust class the TM-239-02 fence forbids, one module over and unfenced

**VERIFIED.**
**File:** `backend/app/services/connector_service.py:456-521` (`infer_source_tools`)

**Issue.** TM-239-02 is enforced structurally in `mcp_source.py`: a remote-authored `readOnlyHint`
or `annotations` value may never decide anything. But `infer_source_tools`'s **schema door**
(line 508: `elif params & _PATH_PARAMS and schema_test(haystack)`) builds its `haystack` from
`f"{name} {description}"` — and `description` is authored by the remote server, exactly as
`annotations` is. The only thing standing between a server-chosen name and an auto-binding is
`_MUTATION_WORDS`, a **substring deny-list**. This project's own recorded rule, quoted in
`mcp_client.list_tools` and in `test_boundary_fence.py`'s header, is that *"a list of what we
refuse cannot be made fail-closed"*.

Driven against the shipped function:

```python
hostile = [
  {"name": "purge_documents", "description": "Retrieve the contents of a file at the given path.",
   "inputSchema": {"properties": {"path": {...}}}},
  {"name": "enumerate_tree",  "description": "List the entries in a directory.",
   "inputSchema": {"properties": {"path": {...}}}},
]
infer_source_tools(hostile)
  -> {'list_tool': 'enumerate_tree', 'read_tool': 'purge_documents'}
```

`purge` is not in `_MUTATION_WORDS` (nor are `truncate`, `overwrite`… wait, `overwrite` contains
`write`; but `purge`, `drop`, `clear`, `destroy`, `trash`, `empty`, `exec`, `rm` are all absent).

**Failure scenario.** An org connects an MCP server that is compromised, or simply hostile from the
start (the product's headline claim is *"any MCP server"*). The server publishes
`purge_documents` with a read-flavoured description. The operator presses **Refresh actions** —
one click, no other action. `discover_connection_tools` (line 1379) writes
`config["source_tools"] = {"read_tool": "purge_documents"}` into the row. Every subsequent preview,
import and watch cycle invokes `purge_documents` on files chosen by the same server's listing.
The server has chosen which of its own tools this app will run, unattended, using a field the
adapter's fence explicitly says a server may not decide with.

**Fix.** Two changes, either of which alone is insufficient:

1. Do not auto-bind by description at all — restrict auto-binding to the **exact known-name** door
   (`if lowered in known`), and leave the schema door to *propose* a value the operator must
   confirm in the picker before it is written to `config`.
2. If the schema door stays, make the safety test an **allow-list of shapes** rather than a
   deny-list of words: require the tool's `inputSchema` to declare *only* path-ish parameters, and
   require the name itself to match `^[a-z_]*(list|read|get|cat|browse|ls)[a-z_]*$`.

Also extend the `_hint_comparisons` fence in `test_239_mcp_source_adapter.py` to cover
`connector_service.infer_source_tools`, so `description` gains the same structural treatment
`annotations` has. Today the fence covers exactly one file and the detector lives in another.

---

## High

### HI-01: `✓ Ready as source` is printed on every `custom_mcp` row regardless of whether the server has any file surface — and the same predicate puts them all in the Library picker

**VERIFIED.**
**Files:**
- `frontend/src/components/sources/sourceCapability.ts:91`
- `frontend/src/components/settings/connectionsCopy.ts:281`
- `frontend/src/components/sources/ConnectedSourceSection.tsx:66`, `CreateWatchModal.tsx:71`

**Issue.** `isSourceCapable` short-circuits on an exact `service_id` match against the published
family list **before** it ever consults the protocol/`source_tools` evidence:

```ts
if (families.includes((c.service_id || "").toLowerCase())) return true
```

The registry registers `McpSourceAdapter` under **both** `"mcp"` and `"custom_mcp"`
(`mcp_source.py:467-468`), so the route publishes:

```
['custom_mcp', 'google', 'google_workspace', 'mcp', 'microsoft', 'microsoft_graph']
```

and `"custom_mcp"` is precisely the **default `service_id` every by-URL MCP connection is created
with** (`McpAuthDoor.tsx:164`, `servicesCatalog.ts:144`).

**Failure scenario.** A person pastes a Linear / Sentry / Jira MCP URL into *Custom MCP Server*.
The row is created with `service_id: "custom_mcp"`, `auth_type: "static_key"`,
`discovered_tools: []`, no `source_tools`. `isSourceCapable` returns `true`,
`connectionRowVerdict` returns `source-only`, and the row prints **`✓ Ready as source`** on a
server that has never been contacted and has no file surface at all. Simultaneously it appears in
`ConnectedSourceSection` and `CreateWatchModal` as a watchable source — the *"dead control in a
dropdown"* the whole `/source-families` route exists to eliminate. Clicking through produces a 502
from `browse()`, because the adapter sends the default `list_directory` to a server that has no
such tool.

**The guard cannot see this.** `sourceCapability.test.ts` has a case named
*"⛔ AN `mcp_server_url` ALONE IS NOT A SOURCE CLAIM"* — but its fixture is
`service_id: "mcp.acme.internal"`, a value the product never writes. `"custom_mcp"` appears in the
`FAMILIES` array of both suites and is **never used as a row's `service_id` in any negative case**.
The test is written around the one fixture that avoids the defect.

**Fix.** Source capability for a protocol family must be proven, not inherited from the service id.
Either drop `@SourceRegistry.register("custom_mcp")` (the protocol arm already resolves these rows
once they carry a binding), or exclude protocol keys from the exact-id arm:

```ts
const PROTOCOL_KEYS = new Set(["mcp", "custom_mcp"])
const id = (c.service_id || "").toLowerCase()
if (!PROTOCOL_KEYS.has(id) && families.includes(id)) return true
return protocolOf(c) !== null && families.includes(protocolOf(c)!)
```

and add the negative case the suite is missing:

```ts
it("⛔ a custom_mcp row with no binding is NOT a source — it is the DEFAULT service_id", () => {
  const row = conn({ service_id: "custom_mcp", auth_type: "static_key",
                     mcp_server_url: "https://mcp.acme/mcp" })
  expect(isSourceCapable(row, MCP_FAMILIES)).toBe(false)
})
```

---

### HI-02: Saving an MCP-over-OAuth connection silently DELETES its `source_tools` binding — the exact wipe class this phase reasoned about, on the arm it did not fix

**VERIFIED by code trace.**
**Files:**
- `frontend/src/components/settings/connectionFormCopy.ts:724-727` (mcp arm — fixed) vs `758-776`
  (oauth arm — not fixed)
- `frontend/src/components/settings/connectionFormCopy.ts:641-643` (`draftFromConnection` capability)
- `frontend/src/components/settings/ConnectionFormPanel.tsx:1054-1058` (save sends whole config)
- `backend/app/services/connector_service.py:1250` (whole-column REPLACE)

**Issue.** `sourceToolsFromDraft` is called from **one** arm of `configFromDraft`:

```ts
if (draft.capability === "mcp") {
  const sourceTools = sourceToolsFromDraft(draft)
  return sourceTools ? { headers: {}, source_tools: sourceTools } : { headers: {} }
}
…
if (draft.capability === "oauth") {
  const oauthConfig: Record<string, unknown> = {}
  if (draft.customClientId?.trim()) oauthConfig.custom_client_id = …
  return oauthConfig          // ⛔ no source_tools, no headers
}
```

But `store_oauth_tokens` sets `auth_type = "oauth_byo"` on the connection row after an MCP OAuth
round trip (`connector_service.py:1764`), and `draftFromConnection` maps that to
`capability: "oauth"` **before** it looks at `mcp_server_url`:

```ts
capability: connection.auth_type === "oauth_byo"
  ? "oauth"
  : (connection.mcp_server_url ? "mcp" : …)
```

So every MCP server connected by OAuth — which is the flow the *Custom MCP Server* door pushes you
into whenever the server advertises OAuth — lands on the arm that drops `source_tools`.

**Failure scenario.** Connect an OAuth MCP file server. Press *Refresh actions*; discovery detects
and stores `source_tools`. Later, rename the connection and press Save. `handleSave` sends
`config: configFromDraft(draft)` = `{custom_client_id: "…"}`; `update_connection` replaces the whole
`config` column; `source_tools` is gone. If the row's `service_id` is anything but `custom_mcp`,
`_protocol_of` now returns `None`, `SourceRegistry.get_adapter` returns `None`, and
`watch_service` raises `NotImplementedError` for a folder that synced fine an hour earlier. The
Settings row simultaneously stops saying *Ready as source*. Nothing reports why.

**Compounding:** the File source mapping card renders only under
`capability === "mcp"` (`ConnectionFormPanel.tsx:1694`), so for these same rows the binding is
**invisible and unrecoverable in the UI** — the only repair is a hand-crafted PATCH.

**Fix.** Carry the binding on every arm that can describe an MCP row, and gate the picker on the
same fact:

```ts
if (draft.capability === "oauth") {
  const oauthConfig: Record<string, unknown> = {}
  if (draft.customClientId?.trim()) oauthConfig.custom_client_id = draft.customClientId.trim()
  const sourceTools = sourceToolsFromDraft(draft)
  if (sourceTools) oauthConfig.source_tools = sourceTools
  return oauthConfig
}
```

```tsx
{(capability === "mcp" || (capability === "oauth" && Boolean(connection?.mcp_server_url)))
  && probeResult && probeResult.length > 0 && ( … )}
```

⚠ **The same arm also drops `headers`, and the `mcp` arm drops `custom_client_id`** — a rename of a
*static-key* MCP row wipes the RFC 7591 client id, which is Phase 222's defect one field over. That
half is pre-existing, not introduced here, but it is three lines from the code this phase edited
and the phase's own comment (`connectionFormCopy.ts:491`) states the rule it violates.

---

### HI-03: A listing this app cannot parse is reported as an EMPTY, COMPLETE listing — and the H-5 deletion guard consumes exactly that

**VERIFIED.**
**Files:**
- `backend/app/services/sources/adapters/mcp_source.py:322-352` (`_parse_listing`)
- `backend/app/services/sources/adapters/mcp_source.py:530-536` (`next_page_token=None`)
- `backend/app/services/watch_service.py:268-278` (`listing.complete = True`)

**Issue.** `McpToolResultError`'s docstring says ignoring an error is *"the worst defect available
on this path: a listing error becomes an EMPTY listing (which is what the H-5 deletion guard
consumes)"* — and then the parser catches only the `isError` **field**. Any 200 response whose body
this parser does not recognise falls through both the structured door and the line door and returns
`[]`. Driven:

```
_parse_listing({"isError": False, "text": '{"status":"denied","reason":"no access to /docs"}'}, "/docs")
  -> []
_parse_listing({"isError": False, "text": 'permission denied'}, "/docs")
  -> []
```

`list_files` always returns `next_page_token=None`, so `watch_service`'s loop sets
`listing.complete = True` on the first pass. An unparsed refusal therefore produces the one state
H-5 is designed to fail closed on: *complete, and zero files*.

**Failure scenario.** An MCP server changes its listing format in a minor release, or answers a
permission problem as prose with `isError: false` (common — the field is optional in practice).
The next watch tick sees a complete listing with zero files, marks **every** tracked item `missing`
and stamps `source_state` on every document minted from that folder. The run reports success. When
the format is fixed, every item is re-read and re-minted through the `restored` arm.

**Fix.** Distinguish *"the server said there is nothing here"* from *"I did not understand the
answer"*, and let only the first be complete:

```python
def _parse_listing(result, folder_path) -> list[_Entry]:
    ...
    entries = _structured_entries(payload)
    if entries is not None:
        return [_entry_from_item(i, folder_path) for i in entries]

    lines = [l for l in text.splitlines() if l.strip()]
    parsed = [...]
    if lines and not parsed:
        raise McpToolResultError(
            "The server answered this listing in a shape this app does not understand, so "
            f"nothing was read: {text[:200]!r}"
        )
    return parsed
```

An empty `text` with no lines is still legitimately an empty folder; a non-empty body that yielded
zero entries is not.

---

### HI-04: `root_path` can only ever be set by a hand-crafted PATCH, so the virtual root always resolves to `path: ""`

**VERIFIED.**
**Files:**
- `backend/app/services/sources/adapters/mcp_source.py:233`, `:100-108` (`wire_path`)
- `frontend/src/components/settings/connectionFormCopy.ts:584` — *"`sourceRootPath` has no control"*
- `backend/app/services/connector_service.py:513-518` — `infer_source_tools` returns only
  `list_tool`/`read_tool`

**Issue.** `_Binding.root_path` defaults to `""`, `infer_source_tools` never produces it, and the
Settings panel renders no control for it (`grep sourceRootPath` returns only the draft plumbing).
So `browse(folder_id="virtual_root")` and `list_files(folder_id=None)` both send
`{"path": ""}` to the bound lister.

**Failure scenario.** A person connects `@modelcontextprotocol/server-filesystem` — the server the
adapter's defaults are written for. The picker shows *Files* (the virtual root, minted with no
round trip). They click it. The adapter calls `list_directory(path: "")`, which is not one of the
server's allowed directories, and the browse returns a 502. There is no field anywhere in the
product to supply the root, and no diagnostic naming the empty path. `SEED-257` records that MCP
sources could not be driven locally at all, so this was never exercised end-to-end.

**SUSPECTED half:** I cannot verify what the reference server returns for `path: ""` without
network access. What is verified is that the value is `""`, that no UI writes it, and that no
inference produces it.

**Fix.** Add the third control to the File source mapping card (a plain text input bound to
`draft.sourceRootPath`), and make the empty root a named refusal rather than an empty string:

```python
if folder_id in VIRTUAL_ROOT_IDS and not self.root_path:
    raise ValueError(
        "This connection has no root folder set, so there is no path to list. Set the root "
        "path in Settings → the connection → File source mapping."
    )
```

---

## Medium

### ME-01: The source path invokes MCP tools with no consultation of `tool_grants` — a tool set to `deny` is still callable as the reader

**VERIFIED by trace.** `mcp_source.py:479, 578, 613` call `mcp_client.call_tool` /
`list_tools` directly. `mcp_client.call_tool` (`mcp_client.py:396-434`) performs destination
validation and nothing else; the approval posture / grant gate lives in `tool_dispatcher`, above
the agent path only.
**Failure scenario.** An operator sets `tool_grants = {"read_file": "deny"}` on a connection —
a deliberate, recorded refusal. The Settings row still lets `read_file` be bound as `read_tool`,
and the watch loop calls it on every file. The grant reads as configured and grants nothing, which
is exactly the state `_sanitize_tool_grants` raises `ValueError` to prevent one column over.
**Fix.** Either consult the grant in `_resolve_binding` (refuse a binding whose tool is `deny`), or
state explicitly in `McpConfig.source_tools` that source reads are a *separate* permission surface
from action grants — and say so in the picker copy. Today neither is true and neither is stated.

### ME-02: The default binding produces NO version for the reference server's own listing format, so modification detection is silently disabled forever

**VERIFIED.** `_version(None, None)` returns `None` for every entry parsed from the `[FILE] name`
line shape, which is what `_parse_line` (`mcp_source.py:314-326`) exists to handle:

```
_parse_listing({"isError": False, "text": "[FILE] report.pdf\n[DIR] sub\n"}, "/docs")
  -> [_Entry(name='report.pdf', …, size=None, modified_at=None), …]
```

`watch_service.py:407` reads `if item_mod and existing_ver and item_mod != existing_ver`, so a
`None` version means the modification branch can never run.
**Failure scenario.** A watched MCP folder ingests once and then reports `checked · 0 changes`
forever while its files are edited daily. The module's own docstring (`_version`, line 371) names
this exact outcome — *"a folder that syncs once and then freezes while looking healthy"* — and then
ships defaults that produce it.
**Fix.** Prefer a lister that states sizes when the server offers one (`list_directory_with_sizes`
belongs in `_LIST_TOOL_NAMES` ahead of `list_directory`), and surface `version: null` on the watch
run receipt as an explicit *"this source states no version — changes cannot be detected"* line
rather than as silence. Note also that `size:N` cannot see a same-size edit, which the docstring
does not acknowledge.

### ME-03: A legitimately empty (0-byte) file is raised as an error, contradicting the comment three lines above it

**VERIFIED by reading.** `mcp_source.py:592-598`:

```python
if not payload:
    # ⚠ An empty file is legal; an UNREADABLE file arriving as b"" is not, and the
    # two must not look alike …
    raise McpToolResultError(f"The server returned no content for {filename!r} …")
```

The comment states the two must be distinguished; the code collapses them into the error arm. An
MCP `read_file` on a 0-byte file returns `content: [{"type":"text","text":""}]`, which decodes to
`b""`.
**Failure scenario.** A watched folder contains one empty `.md` placeholder. Every watch cycle
raises for that item, forever, and the run reports an error for a file that is exactly what it
appears to be.
**Fix.** Distinguish by whether any content block was present at all:

```python
payload, stated_mime, saw_a_block = _decode_content(result)
if not saw_a_block:
    raise McpToolResultError(f"The server returned no content blocks for {filename!r} …")
```

### ME-04: `_MUTATION_WORDS` substring matching is over-broad and silently removes legitimate readers from consideration

**VERIFIED.** `connector_service.py:419-423, 453-454`. Driven:

```
mutation?(list_assets)   = True     # "set" ⊂ "assets"
mutation?(get_asset)     = True
mutation?(read_dataset)  = True
mutation?(input_file)    = True     # "put" ⊂ "input"
mutation?(output_list)   = True
```

**Failure scenario.** A server whose lister is `list_assets` and whose reader is `read_dataset`
gets **no** auto-binding at all — both are filtered out before scoring — so the row silently falls
back to `list_directory`/`read_file`, which the server does not have. The person sees an empty
picker and a 502, with nothing naming the cause.
**Fix.** Match on whole tokens rather than substrings:

```python
_MUTATION_WORDS = frozenset({...})
def _looks_like_a_mutation(name: str) -> bool:
    return bool(_MUTATION_WORDS & set(re.split(r"[^a-z0-9]+", name.lower())))
```

(This is orthogonal to CR-02, which is about what the list *misses*; this is about what it
over-catches. Both are consequences of the same deny-list shape.)

### ME-05: The load-bearing claim *"nothing else in the codebase knows any tool name"* is FALSE, and the boundary fence structurally cannot see the violation

**VERIFIED — this contradicts a `.planning` claim and a shipped docstring.**
`mcp_source.py:19-20` states: *"Nothing anywhere else in the codebase knows any tool name."*
`connector_service.py:406-412` — which is **above** `services/sources/adapters/` — contains:

```python
_LIST_TOOL_NAMES = ("list_directory", "list_dir", "list_files", "ls", "browse")
_READ_TOOL_NAMES = ("read_file", "get_file_contents", "view_file", "cat", "read")
```

used in a membership test at line 507 (`if lowered in known`). `test_boundary_fence.py` cannot fire
on this for **two independent reasons**: `connector_service.py` is not in `FENCED_MODULES` (which
lists four modules, all under `services/sources/` plus `watch_service`), and `PROVIDER_LITERALS`
contains only vendor names — no tool name, no server name.

So the invariant the review brief calls the phase's load-bearing claim is enforced by nothing. The
functional escape hatch (the manual picker) means the *product* claim survives, but the *stated*
claim and its guard do not.
**Fix.** Either move the name tables into `adapters/` and expose the detector as an adapter
classmethod, or extend the fence: add `app/services/connector_service.py` to `FENCED_MODULES` with
an explicit, reasoned exemption for the preference-order tuples — and add a `TOOL_LITERALS` set so
a *new* tool name reaching a conditional anywhere above `adapters/` fails loudly. A named exemption
is auditable; an absence is not.

### ME-06: The boundary fence sees only `ast.Compare`, so `.startswith()`, `match`/`case` and dict subscripts are invisible to it

**VERIFIED by reading `_scan`** (`test_boundary_fence.py:85-101`). The positive control plants
`"google" in service_id` and `provider == "onedrive"` — both `Compare` nodes. `service_id.startswith("google")`,
`match service_id: case "google":` and `ADAPTERS["google"]` are `Call`, `Match` and `Subscript`
respectively and pass silently. Notably the sibling hint fence in the *same phase*
(`test_239_mcp_source_adapter.py:711-728`) already handles `Subscript` and `.get(...)`, so the
stronger shape exists in this diff and was not applied here.
**Fix.** Reuse the `_hint_comparisons` walker shape: add `ast.Call` where `func.attr` is
`startswith`/`endswith`/`get`, `ast.Subscript` slices, and `ast.match_case` patterns; then extend
`test_the_fence_can_actually_fire` with a planted `service_id.startswith("google")`.

### ME-07: `source_tools` values are unbounded strings, and `root_path` is exempt from every check

**VERIFIED.** `connector.py:251` declares `source_tools: dict[str, str] | None` with no length
bound, while `ServiceId` two hundred lines up carries `max_length=64` with the stated reason *"it
is NEW UNTRUSTED INPUT reaching a text column, so it gets a ceiling like every other constrained
type in this file."* `reject_unoffered_source_tools:556` skips `root_path` entirely:

```
reject_unoffered_source_tools({"source_tools": {"root_path": "../../../etc"}}, offered)
  -> accepted, unchecked
```

`root_path` is sent verbatim as `{"path": …}` to the server, so traversal is bounded only by the
remote server's own sandbox. That is arguably correct (it is *that* server's authorization
decision), but it is undocumented and unbounded.
**Fix.** `source_tools: dict[Annotated[str, Field(max_length=64)], Annotated[str, Field(max_length=512)]]`,
plus an explicit note in the model that `root_path` is deliberately unvalidated because path
authorization belongs to the remote server — a stated exemption, not a silent one.

---

## Low

### LO-01: A comment asserts an invariant that is false, next to the check that depends on it
`frontend/src/components/sources/sourceCapability.ts:60-64` states that for static-key MCP rows
*"the server resolves no adapter for them."* **Refuted** — driven against the shipped registry:

```
row = {service_id: "custom_mcp", auth_type: "static_key", config: {}}
SourceRegistry.get_adapter(row)  -> <McpSourceAdapter object>
```

The exact-key arm at `base.py:316` resolves it, because the adapter registers `"custom_mcp"`. Fix
the comment in the same change as `HI-01`.

### LO-02: `browse(None)` mints a plausible root before the binding is validated
`mcp_source.py:487-499` returns the virtual root **before** `_resolve_binding`, so a row with no
`mcp_server_url` shows a folder named after the connection and fails only on the next click.
Resolve the binding first, or state in the docstring that the root is deliberately unvalidated.

### LO-03: MCP conformance is a private class, not parametrized into the shared suite
`test_source_adapter_conformance.py` adds `TestMcpSourceAdapterConformance` alongside the existing
per-family classes rather than into a shared `@pytest.mark.parametrize` over adapters. A new
contract invariant added for the other three families will not apply to MCP, silently — the same
"list a reader maintains by hand" gap `test_every_registered_adapter_is_covered_by_the_list_above`
was written to close one file over.

### LO-04: `_DIR_WORDS` exists twice with different contents
`mcp_source.py:113` → `frozenset({"dir", "directory", "folder"})`;
`connector_service.py:426` → `("directory", "directories", "folder", "folders")`. Same name, same
concept, different membership (`dir` in one only). Rename one, or hoist to a shared constant.

### LO-05: Server-authored error text is reflected verbatim into the API response
`mcp_source.py:436-438` truncates to 300 chars and `api/connectors.py:2050` interpolates the
exception into `detail=f"Source provider browse returned an error: {exc}"`. Not XSS in React, but
an untrusted string reaching a client error surface; consider a fixed prefix plus the raw text in a
separate field the client renders as preformatted text.

### LO-06: A real folder named `virtual_root` is indistinguishable from the sentinel
`mcp_source.py:89` — `VIRTUAL_ROOT_IDS = (None, "", "virtual_root")`. A server whose root contains
a directory literally called `virtual_root` will have it silently rewritten to `root_path` on
browse. Use a namespaced sentinel (`"\x00virtual_root"` or `"mcp:root"`), which no filesystem path
can collide with.

---

## Informational (not findings)

- **`ConnectionsTab.test.tsx` baseline `36 → 102`** (`scripts/vitest-count-gate.cjs:1719`). The
  file now holds ~92 `it(`/`test(` declarations while this diff adds 8, so roughly **sixty cases
  were unguarded before this phase** and are guarded now. Correct direction, correct procedure
  (raised to the gate's own actual). Recorded because a `+66` jump reads like drift and is not.
- `239-02`'s two suites were in neither gate knob and are now in both
  (`vitest-count-gate.cjs:3247-3251, 4512-4518`). The reasoning recorded there is sound.
- `MAX_MCP_BODY_BYTES` (2 MB whole-response, ~1.5 MB after base64) and the SEED-171 frontend flake
  were excluded per the brief. I found nothing that makes either **worse** than stated.

---

## Summary

The security **transport** story is genuinely good: nothing in this diff opens a socket, the SSRF
fence is unbypassed, the disabled-connection gate is correctly ordered above the new protocol arm,
and both new AST fences have working positive controls. Storage-path traversal and recursive-walk
cycles are closed upstream.

The security **authorization** story is not. The phase built a careful structural fence against
one class of server-controlled input (`readOnlyHint`, `annotations`) in one file, and then let a
different server-controlled field (`description`) in a different file decide which remote tool this
application invokes unattended (**CR-02**) — while the write boundary that was supposed to be the
backstop checks only that a tool name exists, not that it is safe, and the Settings dropdown
cheerfully offers `delete_file` under the label *"File content tool"* (**CR-01**). Both are
one-guard-away fixes; both are currently absent.

The honesty story regressed in the direction TM-239-07 was written to prevent: `custom_mcp` is the
default `service_id` for every by-URL MCP connection *and* a registered family, so a
never-contacted Sentry MCP server prints **`✓ Ready as source`** and appears in the Library's watch
picker (**HI-01**). The suite that exists to prevent exactly this uses a fixture `service_id` the
product never writes.

Finally, the phase's load-bearing *"rows, not code"* claim is enforced by nothing: tool-name
literals sit in a membership test in `connector_service.py`, which is neither in `FENCED_MODULES`
nor covered by any tool-name literal set (**ME-05**). The product claim survives on the manual
picker; the stated invariant and its guard do not.

---

_Reviewed: 2026-09-08_
_Reviewer: Claude (gsd-code-reviewer), adversarial pass — sole review for this phase per `OV-239-01`_
_Depth: standard_
