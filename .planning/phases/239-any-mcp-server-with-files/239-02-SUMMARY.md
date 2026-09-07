---
phase: 239
plan: 239-02
title: Tool-binding auto-detection on discovery, the source-families verification, and the UI binding picker
status: complete
wave: 2
base_commit: 90e2bbcd0
tasks_completed: 4
tasks_total: 4
requires:
  - McpConfig.source_tools (239-01)
  - McpSourceAdapter + PROTOCOL_ADAPTERS / CONFIG_PROTOCOL_MARKERS (239-01)
  - mcp_client.list_tools sanitizer (Phase 206/211 — byte-unchanged again)
provides:
  - infer_source_tools — a file surface detected from the server's own tools/list answer
  - reject_unoffered_source_tools — TM-239-05 at the PATCH write boundary
  - discover_connection_tools writes config["source_tools"] in the same UPDATE
  - the file-source binding picker in ConnectionFormPanel, over the server's own names
  - McpConnectionConfig.source_tools — the client mirror 239-01 did not add
affects:
  - backend/app/services/sources/base.py (CONFIG_PROTOCOL_MARKERS now has a producer)
  - frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx (two scoped queries)
key-files:
  created:
    - backend/tests/unit/test_239_mcp_source_discovery.py
    - frontend/src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx
  modified:
    - backend/app/services/connector_service.py
    - backend/tests/unit/test_238_source_families_route.py
    - frontend/src/components/settings/ConnectionFormPanel.tsx
    - frontend/src/components/settings/connectionFormCopy.ts
    - frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx
    - frontend/src/lib/api/org.ts
    - docs/HOT-FILE-LEDGER.md
  NOT_modified:
    - backend/app/api/connectors.py — D-239-04 was already satisfied; see F-1
decisions:
  - D-239-02 honoured — detection is a preference ORDER over names, never a branch
  - D-239-04 VERIFIED rather than implemented; the route was never touched
  - inference is wired to the MCP arm alone, because CONFIG_PROTOCOL_MARKERS would hijack
  - TM-239-05 enforced where it CAN be, and the residual gap named rather than papered over
migration: none — bindings ride the existing config JSONB; reserved migration 174 unused
---

# Phase 239 Plan 02: Tool-Binding Detection and the Binding Picker — Summary

Connecting an MCP server now **detects** which of its tools list a folder and read a file, writes
that as a **row** in `connector_connections.config["source_tools"]`, and shows it in Settings as
two dropdowns over **the server's own reported names** — so a person can see the guess and
correct it. `test_boundary_fence.py` stays 100% green and no tool name is a conditional above
`services/sources/adapters/`.

---

## Base commit — the worktree landed in the wrong place, exactly as wave 1 reported

The worktree arrived at **`1335b4b1a`** — *"Merge develop into master — ship v3.9 Connections"* —
which is the same wrong HEAD `239-01` was handed. Reset to the stated base **`90e2bbcd0`**
(`merge(239-01): McpSourceAdapter — any MCP file server bound by a row`), which is correct and
contains wave 1. All work here sits on it. **This is now two waves in a row; it is a hand-off
defect, not a plan defect, and it will keep happening to 239-03.**

---

## What shipped

### 1. `infer_source_tools` (task 01) — a file surface, detected without knowing the vendor

Two doors, and the second is what makes a server nobody has met usable on day one:

- **By name** — `list_directory` / `list_dir` / `list_files` / `ls` / `browse`, and
  `read_file` / `get_file_contents` / `view_file` / `cat` / `read`. **Ranked, not first-match.**
  A server may offer two listers; wire order is arbitrary, so a first-match binding would flip
  between two discoveries of the same server and silently re-point a watched source. The schema
  is not consulted on this door, so a server that documents nothing is still bound.
- **By schema** — an unrecognised name taking a path-ish parameter whose own wording says it
  lists a folder or reads a file's contents. `enumerate_folder_contents` / `fetch_document_bytes`
  bind with no name in common with anything in this repository.

Three properties that are not decoration:

- ⛔ **A mutating NAME is never a candidate for either role.** `write_file` accepts `path`, its
  description mentions files, and binding it as the reader would call a destructive tool on every
  ingest. Judged on the name, because that is the part a server cannot dress up.
- ⛔ **`annotations` / `readOnlyHint` are read by nothing.** A server that says `readOnlyHint:
  true` about `delete_file` is exactly the case the fence exists for, and it is a test.
- ⚠ **`None`, never `{}`.** `CONFIG_PROTOCOL_MARKERS` keys off a NON-EMPTY `source_tools`, so an
  empty mapping would declare an intent nobody expressed. A **half**-detection IS returned — the
  adapter's defaults apply per key.

### 2. The write (task 01) — one UPDATE, two columns, and one arm only

`discover_connection_tools` now writes `config` beside `discovered_tools` in the same statement.

- ⛔ **THE MCP ARM AND NOWHERE ELSE.** `CONFIG_PROTOCOL_MARKERS` resolves ANY connection whose
  config carries a non-empty `source_tools` to `McpSourceAdapter` — so writing the key from the
  capability arm would hand a first-party **Slack** row to the MCP adapter because a static
  descriptor happened to be named `read_file`, and the adapter would then call a tool over a
  `server_url` that does not exist. This is a Rule-2 addition: the plan's action text says
  *"after tools are discovered"* without naming an arm.
- ⚠ **A binding somebody chose is never overwritten.** Refresh is a one-click control.
- ⚠ **The config is MERGED, not replaced.** Dropping `custom_client_id` here would log an
  OAuth-registered MCP connection out on its next refresh — Phase 222's key, one field over in
  the same model.
- ⚠ **The `_project` pin survives**, and there is a test for it: a write on the user-JWT client
  without it is refused `42501` and surfaces as a 502 after the server already answered.

### 3. `reject_unoffered_source_tools` (task 01) — TM-239-05 at the write boundary

The picker offers only discovered names and the detector returns only discovered names, **but
neither is a boundary**: `PATCH /connectors/connections/{id}` accepts a whole `config`, and these
values are interpolated into a JSON-RPC `params.name`. So `update_connection` now refuses a
`source_tools` value the row's `discovered_tools` does not contain, **before** the write — the
config write is a whole-column replace, so a refusal arriving afterwards would already have
discarded the row's binding (the rule `_sanitize_tool_grants` states about itself).

⚠ **It fires ONLY against a row that HAS a discovered list, and that limit is deliberate.** A
connection bound before its first discovery has nothing to check against; refusing there would
make it impossible to configure a server before contacting it — a fence that fires on the honest
case and not the dishonest one. **The residual gap is covered at the point of USE**:
`McpSourceAdapter.check` (239-01) verifies the bound tools exist on the server and names the
missing one.

### 4. `/connectors/source-families` (task 02) — VERIFIED, not built. See F-1.

### 5. The binding picker (tasks 03/04) — `ConnectionFormPanel`

A `File source mapping` block, gated on `capability === "mcp"` and a non-empty `probeResult`, with
two `<select>`s whose options are exactly the server's reported names plus an empty option that
names the **consequence** (`"Not set — the adapter will try list_directory"`) rather than the
absence. Read-only audiences get static text, not a `disabled` control — the shipped 185 rule.

⭐ **The case that mattered most was not in the plan.** `configFromDraft` rebuilds `config` whole
and `update_connection` writes that column whole, so **a panel that did not carry the binding
deleted an auto-detected file source every time somebody edited the connection's NAME** — with a
200 and no receipt. Driven RED (`expected undefined to deeply equal { list_tool: 'ls', … }`) and
closed by three flat draft fields, **including `root_path`, which nothing edits**: a key the
draft forgets is a key the next rename removes.

---

## RED evidence — quoted, not summarised

### Task 01 — `test_239_mcp_source_discovery.py`

```
tests\unit\test_239_mcp_source_discovery.py:28: in <module>
    from app.services.connector_service import infer_source_tools
E   ImportError: cannot import name 'infer_source_tools' from 'app.services.connector_service'
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
```

GREEN: `21 passed, 1 warning in 1.06s`.

⚠ **This RED is a COLLECTION error, which is a weaker signal than 21 individual failures** — one
missing symbol masks every other claim in the file. Recorded rather than dressed up; the frontend
half below is the stronger drive.

### Task 02 — the source-families pin, driven RED against a defect planted in the shipped file

A pin of an already-true property is worth nothing unless it can fail. So
`_NEVER_OFFERED_SOURCE_FAMILIES` was widened to `{"mock_source", "mcp"}` **in
`backend/app/api/connectors.py` itself**:

```
>       assert "mcp" in families, (
E       assert 'mcp' in ['custom_mcp', 'google', 'google_workspace', 'microsoft', 'microsoft_graph']
FAILED tests/unit/test_238_source_families_route.py::test_the_mcp_protocol_families_are_published
1 failed, 5 passed, 1 warning in 10.87s
```

Restored and verified byte-identical: **md5 `6bcf0272be2620e823e367ed57df6464`** before and after,
with `git status --short` empty for that path. GREEN: `27 passed` across both backend suites.

### Tasks 03/04 — `ConnectionFormPanel.sourceTools.test.tsx`

First RED: **`11 failed | 3 passed (14)`**. ⚠ **Three of those greens were VACUOUS** — negative
assertions (*"shows nothing before discovery"*, *"never offers it on a capability row"*) that a
tree without the feature satisfies trivially. Two were given **positive controls** in the same
RED commit, which converted them:

```
 Test Files  1 failed (1)
      Tests  13 failed | 1 passed (14)
```

Each failure carried its own distinct reason, not one load error. The four shapes:

```
TestingLibraryElementError: Unable to find an element by: [data-testid="connection-source-tools"]
AssertionError: expected '"""Phase 239 (SRC-04 / D-239-01 …' to contain 'DEFAULT_LIST_TOOL = "undefined"'
AssertionError: expected undefined to deeply equal { list_tool: 'ls', …(2) }      ← ⭐ THE WIPE
AssertionError: expected { headers: {} } to deeply equal { headers: {}, source_tools: { …(3) } }
```

The one genuine pre-existing green is *"omits source_tools entirely when nothing is bound"* —
`configFromDraft` already returned `{ headers: {} }`, so it pins a property rather than driving
one. Said plainly rather than counted as a drive.

GREEN: **`14 passed (14)`**.

---

## Measured gate results — verdict lines verbatim

**Targeted backend (the plan's own command):**

```
27 passed, 1 warning in 4.90s
```

**Backend regression across the connector surface** (`test_190_connectors_api`,
`test_212_discover_seam`, `test_222_mcp_auth_discovery`, `test_connector_org_scope_and_refusals`,
`test_238_source_families_route`, `tests/unit/services/sources`):

```
243 passed, 1 warning in 15.66s
```

**Backend baseline gate — `pytest tests/unit -q --continue-on-collection-errors`:**

```
71 failed, 4113 passed, 2 xfailed, 2 xpassed, 44 warnings in 323.46s (0:05:23)
```

**The SET was diffed, not the count:**

```
base 71  ·  after 71
NEW (mine):  none
GONE:        none
IDENTICAL after normalising the baseline file's own truncation artefacts
```

⚠ **The raw diff showed two spurious lines in each direction and BOTH were artefacts of the
baseline FILE, not of the tree** — one node id carries a parametrize bracket containing a space
(`[async def upload_document(]`, truncated in the baseline at the first space) and one has
interleaved `RuntimeWarning` text glued onto it. Both sides were normalised (strip from `[` and
from `C:`) before comparison, and only then do the sets agree at 71/71. **Recorded because a
naive `comm` on this baseline file reports two false NEW failures**, which is exactly the shape
of evidence that gets a clean phase blamed.

`4091` (wave 1) → **`4113`** is `+22`: my 21 new discovery cases and 1 new source-families case.
The arithmetic closes with no residual.

**Frontend, all settings suites** (`src/components/settings`):

```
 Test Files  20 passed (20)
      Tests  462 passed (462)
```

**Frontend count gate** — `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the
repo root:

```
  total                                      7026    7822    +796
  total 7822  ·  failed 19  ·  pinned total 7026
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 19 test(s) failed — the gate requires 0.
```

**The gate was ALREADY RED at this plan's base** (the brief records 1 failing in
`WorkflowBuilderPage.session.test.tsx`), so this plan could not turn it green. What it can do is
show the 19 are not its own, and that was done by the procedure rather than by re-running until
green:

1. **Filenames were taken from the gate's OWN persisted JSON before anything was re-run.** Seven
   files: `WorkflowBuilderPage.canvas.test.tsx` · `WorkflowBuilderPage.session.test.tsx` ·
   `WorkflowsPage.test.tsx` · `PublishGauntlet.test.tsx` · `WorkflowCanvas.test.tsx` ·
   `library/__tests__/sketchComposition.test.tsx` · `workflows/library/WorkflowCard.test.tsx`.
2. **Every one is byte-unchanged by this plan.** `git diff --numstat 90e2bbcd0 HEAD` lists nine
   files and none of the seven is among them. **Four of the seven are SEED-171's named
   cap-independent flaky set.**
3. **The SET is not the same twice.** Running those seven alone gave
   `3 failed | 4 passed (7 files)` · `5 failed | 595 passed | 1 skipped (601)` — a different
   membership, with `canvas`, `PublishGauntlet`, `WorkflowCanvas` and `WorkflowCard` all green the
   second time.
4. ⚠ **Two of the five isolated failures are the suites' OWN POSITIVE CONTROLS** — *"the page
   renders its heading — the mount harness works"* and *"the four shipped tab triggers render —
   the tab bar is already built"*, both in `sketchComposition.test.tsx`, a file with no connection
   to this surface. Their durations were `5021 ms` / `5670 ms` / `5030 ms`, sitting on a timeout
   boundary.

**The worker cap was NOT touched** — it is measured not to fix these. ⚠ Stated the way SEED-171
requires: these seven are **provably unmodified**, not *"fine"*. One green sample of a flaky suite
proves nothing, and whether a sibling agent was running is not something this worktree can
observe.

### ⚠ F-7 — MY NEW 14-CASE SUITE IS IN NEITHER KNOB, AND THE TOTALS PROVE IT

`total 7822 · pinned total 7026` is **character-for-character what Phase 238's close recorded** in
CLAUDE.md (`7822 · 0 failed · 7026 · 242/242`). Adding a 14-case suite moved the grand total by
**zero**, which can only mean the gate never ran it: `ConnectionFormPanel.sourceTools.test.tsx`
does not appear anywhere in the gate's printed `running:` argv, and `src/components/settings` is
**not** a directory entry in `TARGETS` — the settings suites are listed one file at a time.
`+796` is therefore the unpinned-suite gap, exactly the shape Phase 214 measured as `+1089`, not
anything this plan added.

This is Phase 214's lesson arriving from the other side: **`TARGETS` decides what RUNS and
`BASELINE` decides what is GUARDED, and a suite can sit on the wrong side of both.** The two
assertions I repaired in `ConnectionFormPanel.test.tsx` ARE gated; the fourteen new ones are not,
so a future edit could delete every one of them and the gate would stay exactly as green as it is
now. **Owed: one `TARGETS` entry for this file.** Not taken here on purpose —
`scripts/vitest-count-gate.cjs` is a shared hot file (`167 / 38 / 4786`) and 239-03 will want the
same edit for `connectionRowVerdict`; two parallel waves editing one list is a merge conflict for
no gain. **It belongs in the phase-close commit alongside the CLAUDE.md table edit.**

**Hot-file ledger gate:**

```
hot-file ledger — 5 file(s) from the command line
  scan list: 230 rows · subject: 5 files · watched: 5
ledger gate OK — every watched file has a row.
EXIT=0
```

**CLAUDE.md size gate:**

```
CLAUDE.md                                   84958 chars   56.6% of limit  headroom   65042  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

**`tsc -p tsconfig.app.json --noEmit`:** see F-4 — the plan's acceptance criterion is unsatisfiable
at this base, and the honest measurement is a SET diff.

---

## Ledger triples — re-derived in the commit that landed them

Derived from git in this worktree at `ab679d471`, i.e. **after** every commit that touches these
files and **before** the docs-only commit that writes them — so wave 1's *"a triple went stale
within the hour"* cannot repeat here.

| File | `CLAUDE.md` row read | **PLAN.md predicted** | **re-derived** | drift vs the row |
|---|---|---|---|---|
| `backend/app/services/connector_service.py` | 21 / 7 / 1601 | 22 / 8 / 1630 | **23 / 9 / 1821** | +2 c, **+2 ph**, +220 L |
| `backend/app/api/connectors.py` | 33 / 16 / 1879 | 39 / 18 / 2060 | **39 / 18 / 2051** | +6 c, **+2 ph**, +172 L |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | 17 / 7 / 2376 | 22 / 9 / 2445 | **23 / 10 / 2512** | +6 c, **+3 ph**, +136 L |
| `frontend/src/components/settings/connectionFormCopy.ts` | 7 / 5 / 968 | *(not named)* | **15 / 8 / 1216** | +8 c, **+3 ph**, +248 L |
| `frontend/src/lib/api/org.ts` | 6 / 4 / 562 | *(not named)* | **10 / 8 / 618** | +4 c, **+4 ph**, +56 L |

⚠ **All three triples the PLAN.md predicted were wrong, and one of them was for a file the plan
also predicted would change and which did not.** That is the ledger's own repeated finding
arriving through a new door: a figure written at planning time is stale before execution starts.

⚠ **`CLAUDE.md`'s abridged G-5 FIRING table is deliberately NOT edited here** (three plans editing
one table produces three conflicting edits). `docs/HOT-FILE-LEDGER.md` — which is what the gate
reads — is fully updated, same commit, rows and sections together. **The five rows above are owed
one CLAUDE.md edit at phase close**, alongside wave 1's F-4 three (`sources/base.py`,
`sources/__init__.py`, `mcp_client.py`) and its new `mcp_source.py` row.

---

## Deviations from plan — reported, not worked around

### 1. Two files were modified that the plan does not list, and both were required for correctness

- **`frontend/src/components/settings/connectionFormCopy.ts`.** The plan says the selects
  *"bind to `draft.config.source_tools.list_tool`"* — **`ConnectionDraft` has no `config` field
  at all**; it is a flat, all-string shape by explicit design, and `configFromDraft` /
  `draftFromConnection` are the two ends of the round trip. Holding the binding in component
  state instead would have left `configFromDraft` still rebuilding the config **without** it,
  which is THE WIPE above. Three flat fields were added, matching the module's stated shape.
- **`frontend/src/lib/api/org.ts`.** `McpConnectionConfig` had no `source_tools`, so the payload
  would not type-check. ⚠ **This is the exact drift the field one line up records happening to
  itself** — *"THIS MIRROR WAS MISSED WHEN THE SERVER MODEL GAINED THE FIELD"*, written about
  `custom_client_id`. Wave 1 added `source_tools` to `McpConfig` and did not mirror it; closed
  here with the same warning attached.

### 2. `frontend/.../__tests__/ConnectionFormPanel.test.tsx` — two assertions repaired, and I broke them

Two shipped cases used a bare `getByText("github_search")` / `getByText("add_issue_comment")`.
**The binding picker renders every discovered name as an `<option>`, so both became ambiguous:**
`Found multiple elements with the text: github_search`. Scoped to
`within(getByTestId("connection-discovered-tools"))`, which is what they always meant. **Named
plainly: this was a regression I introduced in an existing suite, caught by running the whole
`src/components/settings` directory rather than only my own file.**

### 3. The plan's `discover_connection_tools(connection_id, user_id)` signature does not exist

The shipped signature is `(connection_id, org_id, supabase=None)`. `user_id` would be the D-14
tenant-scoping mistake in miniature. Implemented against the real one.

### 4. `"browse"` and `"read"` are kept in the name lists, and they are the weakest entries

The plan names both. `browse` is a plausible name for a **web**-fetch tool, and `read` is generic.
They sit LAST in their preference orders, so any better-named tool wins, and the mutation guard
plus the schema/description gates carry the rest. **Left as the plan wrote them and flagged rather
than silently narrowed** — narrowing a detector is a behaviour change that belongs to whoever has
a real server that trips it.

---

## Findings that contradict the plan or the CONTEXT

### ⭐ F-1 — D-239-04 confirmed already done. `api/connectors.py` was NOT touched.

Wave 1's F-1 said so; this plan verified it rather than trusting it. Measured directly:

```
registry : ['custom_mcp', 'google', 'google_workspace', 'mcp', 'microsoft', 'microsoft_graph', 'mock_source']
published: ['custom_mcp', 'google', 'google_workspace', 'mcp', 'microsoft', 'microsoft_graph']
excluded : ['mock_source']
```

`list_source_families` derives from `SourceRegistry.list_supported_services()`, so registering the
adapter was sufficient. `_NEVER_OFFERED_SOURCE_FAMILIES` is still `{"mock_source"}` and is
confirmed to be the intended exclusion set. **The route is now pinned by a test that was driven
RED against a planted exclusion**, so the property cannot silently regress.

⚠ **`test_238_source_families_route.py`'s own headline claim — *"a newly registered family appears
with no route change"* — has now happened for real, one phase later, on a family the route has
genuinely never heard of.** That is the milestone's *rows-not-code* constraint landing a layer up.

### ⚠ F-2 — TM-239-05 cannot be enforced completely, and the shortfall is named

The plan's mitigation reads *"Arbitrary strings not present in discovered tools are rejected."*
**Taken literally that is unimplementable**: on CREATE there are no discovered tools, so the rule
would reject every legitimate first binding. Implemented as *"refused when the row HAS a
discovered list"*, with `McpSourceAdapter.check` covering the rest at the point of use. **A
threat-model line that cannot be implemented as written should be corrected in the register rather
than reported as `mitigated` unqualified.**

### ⚠ F-3 — the plan's stated frontend acceptance criterion is unsatisfiable at this base

Task 03 asks for `npx tsc -p frontend/tsconfig.app.json --noEmit` to **exit 0**. On the untouched
base commit it exits **2 with 80 errors**, none of them this plan's. So the honest instrument is a
SET diff, which was done by checking the three base file versions back out, re-running, and
comparing file+error-code multisets:

```
26,28d25
<       7 src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx: error TS2305
<       6 src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx: error TS2339
<       1 src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx: error TS2353
```

**The ONLY difference is 14 errors REMOVED — my own test file's, resolved by the implementation.
Zero added.** Every pre-existing error is byte-identical between base and after, including five on
`ConnectionFormPanel.tsx` itself (`auth_type` / `status` not declared on
`ConnectorConnectionCreate` / `ConnectorConnectionUpdate`), which are **not** mine and are worth a
seed: the panel sends two fields the client types say do not exist.

### ⚠ F-4 — `mcp_client.py` is byte-unchanged again, and the sanitizer needed no widening

The phase's out-of-scope rule (*widen if needed, never remove or raw-spread*) was **not
exercised**. Detection reads `name`, `description` and `inputSchema`, all three already forwarded
by the existing ALLOW-LIST. Recorded because *"we widened it carefully"* and *"we never needed
to"* are different claims — this is the second wave in a row it holds.

### ⚠ F-5 — the ~1.5 MB import ceiling (wave 1's F-2) is untouched and still binding

`MAX_MCP_BODY_BYTES` is 2 MB on the whole JSON-RPC response and base64 inflates 4/3, so an MCP
file source still cannot import a file over roughly 1.5 MB and TM-239-03's 25 MB ceiling still
cannot fire. **Nothing here changed it, deliberately** — it is an operator product decision, and
this plan stopped at the boundary as instructed.

### ⚠ F-6 — auto-detection has no UI receipt, and that is a real gap this plan does not close

Discovery writes the binding server-side; the panel re-seeds from `connection.discovered_tools`
and `connection.config` only when it **re-opens** (`seededKeyRef`), and `handleDiscoverTools` sets
`probeResult` in memory without re-reading the row. So **pressing Refresh actions populates the
binding in the database and the two dropdowns still read "Not set" until the panel is reopened.**
The value is correct in both places and nothing is lost; what is missing is the receipt. Named
rather than fixed because the repair belongs with `handleDiscoverTools`'s reload seam, which is
239-03's surface (`ConnectionsTab` / the row verdict).

---

## Threat model disposition

| id | disposition | how |
|---|---|---|
| TM-239-05 untrusted tool name | **mitigated, with F-2 recorded** | Detection returns only names handed in (pinned). The picker offers only `probeResult` names. `reject_unoffered_source_tools` refuses an unoffered name on PATCH when the row has a discovered list, BEFORE the whole-column write. Residual: a row with no discovery yet — covered at use by `McpSourceAdapter.check` |
| TM-239-06 config leak via the picker | **mitigated** | `source_tools` carries tool NAMES only. Asserted as a key set (`["list_tool", "read_tool"]`) plus a negative sweep for `http`, `://`, `secret`, `token`, `Bearer` and the fixture's own host |
| (new, not in the register) adapter hijack | **mitigated** | Inference runs on the MCP arm only; the picker renders on `capability === "mcp"` only. Both pinned, the UI one with a positive control |
| (out-of-scope rule) server hints | **honoured** | `annotations` / `readOnlyHint` are read by nothing; a `readOnlyHint: true` `delete_file` is a test case |

No new endpoint, no new auth path, no schema change.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema change was added; the one new
refusal narrows an existing write.

---

## Commits

| # | hash | message |
|---|---|---|
| 1 | `66f0cfee2` | `test(239-02): RED — a file surface is detected, and a Slack row never is` |
| 2 | `faa4ce2bb` | `feat(239-02): a file surface is DETECTED on discovery, and stored as a row` |
| 3 | `0bd616b76` | `test(239-02): pin that /source-families publishes mcp — verified, not built` |
| 4 | `a7bb87173` | `test(239-02): RED — the binding a person can see, and the rename that deletes it` |
| 5 | `502872577` | `feat(239-02): the file-source binding, visible and correctable in Settings` |
| 6 | `ab679d471` | `test(239-02): scope two tool-name assertions to the grants block` |
| 7 | `b7d773f5b` | `docs(239-02): five ledger triples, all stale — one by six phases` |

TDD gate sequence present twice: `test` #1 precedes `feat` #2; `test` #4 precedes `feat` #5.

---

## Self-Check: PASSED

| Check | Result |
|---|---|
| Created files exist | `test_239_mcp_source_discovery.py`, `ConnectionFormPanel.sourceTools.test.tsx`, this SUMMARY — all **FOUND** |
| All seven commits exist | **7/7 FOUND** via `git log --oneline --all` |
| TDD gate sequence | `test` → `feat` twice (#1→#2, #4→#5) |
| Backend failing SET vs baseline | **IDENTICAL** after normalising the baseline file's own artefacts — 71 = 71, zero new |
| Passed-count arithmetic | `4091 → 4113` = `+22`, exactly my 21 + 1 new cases, no residual |
| `test_boundary_fence.py` | `9 passed` — 100% green |
| `check-hot-file-ledger.cjs` | `EXIT=0` over all five files |
| `check-claude-md-size.cjs` | `EXIT=0` — 84,958 chars, 56.6% |
| Planted-defect restore | `api/connectors.py` md5 identical, `git status` empty for that path |
| `tsc` set diff | **14 errors removed, 0 added** |
| Count-gate triage | 7 files, **all provably byte-unchanged**; set non-deterministic across two runs |
| ⚠ New frontend suite is gated | **NO — see F-7.** Grand total unmoved at 7822, which is what proved it |
| ⚠ Backend RED signal quality | **Weaker than it looks** — a collection error, not 21 individual failures |

⚠ **The two rows carrying ⚠ are the useful ones.** A 14-case suite that the shared gate cannot see
is a fence with no teeth, and I found that out only because the grand total refused to move.

---

## Known Stubs

None. Every control on the new surface is wired to real data (`probeResult` from the server) and
every value it produces reaches `config` on save.

---

## What this plan does NOT deliver

- **No live drive against a real MCP file server.** Everything here is a unit result against
  doubles. The reference filesystem server is *local stdio* and `validate_mcp_destination` refuses
  loopback and RFC1918 by design, so a live row needs a remotely-hosted MCP file server — still a
  UAT prerequisite, not a code gap.
- **No refresh receipt** — see F-6.
- **`connectionRowVerdict.ts`'s `"source-only"` verdict (D-239-08 / BUG-260907-01) is 239-03's.**
- **No G-4 lived-experience UAT.** This surface is user-visible; the owed row is *"connect an MCP
  file server, press Refresh actions, reopen the panel, and read the binding"* — which is also the
  row that would surface F-6 to an operator.
