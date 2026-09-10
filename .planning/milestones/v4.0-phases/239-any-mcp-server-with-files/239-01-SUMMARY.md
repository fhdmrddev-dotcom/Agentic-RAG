---
phase: 239
plan: 239-01
title: McpSourceAdapter, protocol-level registry resolution, and conformance membership
status: complete
wave: 1
base_commit: 69a8da589
tasks_completed: 5
tasks_total: 5
requires:
  - SourceAdapter contract (Phase 232 / SRC-01)
  - mcp_client.call_tool / list_tools (Phase 206, egress fence)
  - connector_service.resolve_connection (credential seam)
provides:
  - McpSourceAdapter — any MCP server with a file surface, bound by a row
  - SourceRegistry protocol resolution (PROTOCOL_ADAPTERS / CONFIG_PROTOCOL_MARKERS)
  - McpConfig.source_tools (SEED-239 / TM-239-04 closed before it could fire)
  - GET /connectors/source-families now publishes mcp + custom_mcp, with no route edit
affects:
  - backend/app/services/watch_service.py (resolves MCP connections now)
  - backend/app/services/sources/preview_service.py
  - backend/app/api/connectors.py (browse + source-families, both by construction)
key-files:
  created:
    - backend/app/services/sources/adapters/mcp_source.py
    - backend/tests/unit/services/sources/test_239_mcp_source_adapter.py
    - backend/tests/unit/test_239_mcp_config_source_tools.py
  modified:
    - backend/app/models/connector.py
    - backend/app/services/sources/base.py
    - backend/app/services/sources/__init__.py
    - backend/tests/unit/services/sources/test_boundary_fence.py
    - backend/tests/unit/services/sources/test_source_adapter_conformance.py
    - docs/HOT-FILE-LEDGER.md
decisions:
  - D-239-01 honoured — tool names are data in config["source_tools"], never a branch
  - D-239-03 honoured as TWO DICTS, not an elif, per base.py's own recorded instruction
  - D-239-04's server half satisfied by registration alone — connectors.py untouched
  - D-239-06 derivation STOPS at None; a path hash would be a fabricated version
  - page_size is advisory for this family, and the whole atomic listing is returned (H-5)
migration: none — bindings ride the existing config JSONB; reserved migration 174 unused
---

# Phase 239 Plan 01: McpSourceAdapter and Universal Conformance — Summary

`McpSourceAdapter` reads any MCP server that exposes a file surface, and which tools it calls is
a **row** — `connector_connections.config["source_tools"]` — resolved through `SourceRegistry`
by protocol rather than by vendor, with `test_boundary_fence.py` still 100% green.

---

## ⚠ Read this first: the stated base commit was wrong, and the worktree HEAD was wrong too

Two facts, both reported rather than worked around:

1. **The worktree arrived at `1335b4b1a`** — *"Merge develop into master — ship v3.9 Connections"* —
   which is neither the phase base nor anywhere near `develop`.
2. **The stated base `4eac9ffb1` predates this plan's own existence.** `git ls-tree` at that
   commit lists only `239-CONTEXT.md` and `239-DISCUSSION-LOG.md`; `239-01-PLAN.md`,
   `239-02`, `239-03` and `239-RESEARCH.md` all arrive three commits later at `1c253bbd2`
   (*"docs(239): plan phase 239"*). Executing at the stated base would have meant executing a
   plan that was not in the tree.

**Resolved by resetting the agent branch to `develop`'s tip, `69a8da589`**, which contains
`4eac9ffb1` as an ancestor. The four intervening commits are **docs-only** —
`git diff --stat 25c650231..develop -- backend frontend scripts` is **empty** — so the backend
baseline measured at `25c650231` is still exactly valid at `69a8da589`. All work in this plan
sits on `69a8da589`.

---

## What shipped

### 1. `McpConfig.source_tools` (task 01) — an org-wide outage closed before it could fire

`{"source_tools": {"list_tool": …, "read_tool": …, "root_path": …}}` on the existing `config`
JSONB. **No migration; reserved migration 174 stays unused.**

This is not a convenience field. Every config model in `app/models/connector.py` is
`extra='forbid'`, and `_to_response` validates rows **inside a list comprehension** — so the
first source-bound connection would have made **every connection in the org** unreadable (503,
*"Nothing is wrong with them — this page could not read them"*). That is the exact defect
Phase 222 shipped into the live database one key over, and SEED-239 records it.

### 2. `McpSourceAdapter` (task 03) — `backend/app/services/sources/adapters/mcp_source.py`

`browse` · `list_files` · `read_file` · `check`, all delegating to `mcp_client`.

- **Three wire shapes, one parser:** `structuredContent`, a JSON string, and the reference
  filesystem server's `[DIR] name` / `[FILE] name (1024 bytes)` lines.
- **Three content-block shapes:** `TextContent`, base64 `EmbeddedResource` (`blob` or `text`),
  and `image`/`audio` `data`. A server-stated `mimeType` always wins.
- **`isError` is honoured.** A listing error raises rather than becoming an empty listing (which
  is what the H-5 deletion guard consumes); a read error raises rather than becoming the sentence
  *"Error: permission denied"* minted as a document and later answered out of the knowledge base.
- **Empty content is refused**, never returned as `b""` — an unreadable file and a legitimately
  empty one must not look alike.
- **`check` verifies the BOUND TOOLS exist on the server** and names the missing one. A probe that
  only counted tools would answer "ok" for the most likely misconfiguration on this surface, and
  send somebody hunting their credentials.

### 3. Protocol-level resolution (task 04) — `base.py`, as DATA

```python
PROTOCOL_ADAPTERS: dict[str, str] = {"mcp": "mcp"}
CONFIG_PROTOCOL_MARKERS: dict[str, str] = {"source_tools": "mcp"}
```

An MCP server has no canonical `service_id` — it is whatever the person typed — so an
exact-key registry could never resolve an arbitrary one. **This is two dicts and not an `elif`
by direct instruction from this module's own history:** the note over the deleted
`_ensure_registered` says *"make the routing DATA (a dict keyed by service_id) rather than
control flow"*, written after a provider-keyed branch sat inside the contract for two phases.

Strictly a fallback **below** the exact lookup (so a first-party family is never hijacked) and
**below** the `is_enabled` gate (an arm above it would have re-opened BUG-260907-03 for exactly
the family being added). Both pinned by name.

### 4. Conformance membership + ledger (task 05)

`TestMcpSourceAdapterConformance` joins by registering a fixture and nothing else — the same bar
Phase 238 set. The contract expressed a whole **protocol** without changing.

---

## RED evidence

Every behavioural change was driven RED first, and the output is quoted rather than summarised.

| Gate | RED, verbatim |
|---|---|
| `McpConfig.source_tools` | `ValidationError: 1 validation error for McpConfig` · `source_tools` · `Extra inputs are not permitted [type=extra_forbidden, input_value={'list_tool': 'list_dir', 'read_tool': 'cat'}, input_type=dict]` — then **5 failed / 2 passed**, including the whole-list org-outage case |
| `McpSourceAdapter` | **34 errors + 2 failures**, all reading `ModuleNotFoundError: No module named 'app.services.sources.adapters.mcp_source'` — exactly the signature task 02's acceptance criterion names |
| Protocol resolution | **6 failed**, six distinct reasons: `assert 'mcp' in ['google', 'google_workspace', 'microsoft', 'microsoft_graph', 'mock_source']`; three `isinstance(None, McpSourceAdapter)`; `AttributeError: module 'app.services.sources.base' has no attribute 'PROTOCOL_ADAPTERS'`; `mcp_source is not eagerly imported by app/services/sources/__init__.py` |

### ⭐ Both structural fences were driven RED against defects planted in the shipped file

A fence proven only against a test string proves the scanner, not the file. So `mcp_source.py`
itself was edited, both fences run, and the file restored:

```
planted: import httpx                                      -> assert 'httpx' not in {…, 'httpx', …}
planted: config.get("annotations").get("readOnlyHint")      -> assert not [(216, 'readOnlyHint'), (216, 'annotations')]
2 failed, 5 passed
```

Restored and verified byte-identical: `md5 f70f93083bb81e266483df6c68dc5f7e` before and after.

---

## Measured gate results — verdict lines verbatim, not summaries

**Targeted suite (`backend/tests/unit/services/sources` + the config fence):**

```
194 passed, 1 warning in 8.33s
```

Baseline on the untouched tree at `69a8da589` was `129 passed`; `tests/unit/services/sources`
alone now reads `187 passed`.

**Backend baseline gate — `pytest tests/unit -q --continue-on-collection-errors`:**

```
71 failed, 4091 passed, 2 xfailed, 2 xpassed, 50 warnings in 400.69s (0:06:40)
```

**The SET was diffed, not the count** — a matching count is exactly the failure mode
`feedback_capture_the_set_never_a_tail` records:

```
baseline: 71   after: 71
NEW (mine): none
FIXED/gone: none
IDENTICAL
```

The baseline file's lines carry truncated `- ImportE…` suffixes and interleaved warning text, so
both sides were normalised to bare node IDs before comparison. Zero new failures; the ceiling
holds with its zero headroom intact.

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

**Boundary fence:** `9 passed` — 100% green, as required.

**vitest: not run, and the reason is MEASURED rather than assumed.** `git diff --stat
69a8da589 HEAD` names **zero** frontend files — but
`reference_frontend_suites_import_backend_source_raw` records that *"frontend untouched ⇒ gate
unaffected"* is unsound in general, because some frontend suites import backend `.py` via `?raw`
and are therefore red-able by a pure backend diff.

So the actual `?raw` backend surface was enumerated (`grep -rn "\.py?raw" frontend/src`) — nine
files:

`api/documents.py` · `api/sources.py` · `security/egress.py` · `services/harness/phase_types.py`
· `services/harness/publish_service.py` · `services/sources/failure_cause.py` ·
`services/connectors/smtp_adapter.py` · `services/connectors/args.py` · `models/harness.py`

**None of this plan's four backend files is on that list**, so no frontend suite can observe this
diff.

⚠ **My own first draft of this paragraph was wrong and is corrected rather than quietly fixed:** I
wrote that `?raw` finds *"no reference to `sources/`"*. It does —
`services/sources/failure_cause.py` is imported by `sourceHealthVocabulary.test.ts`. I did not
modify that file, so the conclusion stands; the reasoning that produced it did not, which is
exactly why the list is enumerated above instead of asserted.

---

## Ledger triples — re-derived from git, never copied forward

| File | row read | **re-derived at `657ef4c9a`** | drift |
|---|---|---|---|
| `backend/app/services/sources/adapters/mcp_source.py` | *(no row — gate failed)* | **2 / 1 / 643** | new |
| `backend/app/services/sources/base.py` | 6 / 3 / 198 | **9 / 5 / 336** | +3 commits, **+2 phases**, +138 L |
| `backend/app/services/sources/__init__.py` | 2 / 1 / 26 — `no (1 phase)` | **5 / 3 / 40** | +3 commits, **+2 phases**; it now **FIRES** |
| `backend/app/models/connector.py` | 18 / 10 / 676 | **22 / 13 / 732** | +4 commits, **+3 phases**, +56 L |
| `backend/app/services/mcp_client.py` | 4 / 2 / 407 — `no (2 phases)` | **7 / 5 / 480** | +3 commits, **+3 phases**; it has **FIRED since Phase 222** |

Rows and their detail sections were updated in the **same commit**. ⚠ `base.py` had a row since
Phase 238 and **never had a section at all** — pre-existing drift, closed here.

⚠ **`mcp_client.py` is not in this plan's `files_modified` and I updated its row anyway.** Its
row was *present and WRONG* — it told an auditor the guardrail did not fire on a file that has
been over the threshold for five phases, which CLAUDE.md explicitly calls worse than an absent
row. It is also this plan's entire egress dependency. Recorded as a deliberate one-row deviation.

---

## Deviations from plan — reported, not worked around

### 1. ⚠ The base commit and the worktree HEAD were both wrong

See the section above. Not a plan defect so much as a hand-off defect, but it would have made the
plan unexecutable as stated.

### 2. ⚠ The plan's `browse` root option #1 is unimplementable against the shipped contract

Task 02 offers *"root folder returns root `SourceNode(id="", name="Root", …)`"*. **`id=""` fails
the conformance suite**, which asserts `isinstance(node.id, str) and len(node.id) > 0` — and it
is substantively wrong besides: an empty root id makes `browse(root)` indistinguishable from
`browse(None)`, so a picker walking down from what it was handed loops forever. Implemented as
`id="virtual_root"`, the sentinel `microsoft_graph.py` already uses, with the actual wire path
kept as data (`source_tools["root_path"]`, default `""`).

### 3. ⚠ D-239-06's suggested sha256 fallback was **refused**, deliberately

The plan says `f"size:{size}"` **or** sha256. At listing time there is no content to hash, so the
only available hash is of the **path** — which is deterministic, looks exactly like a version, and
**never changes**. It would report "unchanged" for every future edit while appearing to work:
SEED-253's fabrication failure one column over, and worse than absence because absence is legible.
Implemented as timestamp → `size:{n}` → **`None`**, with the reason written into the code.

### 4. ⚠ `≤ 380 lines` was not met — 643, and the split is published rather than argued

Measured with `tokenize` + `ast` across the family:

| file | total | code | docstring | comment | blank |
|---|---|---|---|---|---|
| `mcp_source.py` | **643** | **~335** | 166 | 38 | 104 |
| `microsoft_graph.py` | 369 | ~206 | 67 | 46 | 50 |
| `google_drive.py` | 399 | ~320 | 30 | 8 | 41 |

**Executable code is ~335 lines — inside the plan's own action budget of "target ≤ 350"** and
comparable to `google_drive.py`'s 320, for an adapter that parses three wire shapes and three
content-block types instead of one. The overrun is entirely the reasoning this project's
CLAUDE.md requires be recorded. I did not strip it to hit a total-line number.

### 5. Two files added that the plan does not list

- **`backend/tests/unit/test_239_mcp_config_source_tools.py`** — task 01's stated acceptance
  criteria are two `python -c` invocations, which are not a regression fence. TDD is on for this
  project, and SEED-239's outage mode had none. Mirrors the `test_222_mcp_config_client_id.py`
  precedent, including its lesson that a leaf-only test stayed green through the whole live outage.
- **A second boundary-fence check**, `test_every_registered_adapter_is_covered_by_the_list_above`,
  deriving the adapter set from the **registry** rather than from the hand-maintained tuple the
  plan asked me to append to. A hand-maintained list is the ledger-row failure mode one directory
  over.

### 6. Narrowed credential resolution mid-task, after a real socket escaped

The plan's `_get_mcp_params` reads `server_url` / `secret` / `config` off the connection. As first
written the adapter re-read the whole row through `connector_service.resolve_connection`, and
`[Errno 11001] getaddrinfo failed` surfaced in the test run — the adapter behaving **correctly**
against a realistic fixture. Narrowed to *credential only*, which is the seam `microsoft_graph.py`
already uses (`get_fresh_access_token(conn_id)` — a token, never a re-read). Every caller has just
fetched the row org-scoped; re-reading it would be the same row twice and would quietly move the
org-scoping decision into the adapter.

Presence, not truthiness, decides whether to resolve: `ResolvedConnection.secret` is legitimately
`None` for an unauthenticated server, so `if secret is None: re-resolve` would hit the database on
every call for exactly the rows with nothing to find. Pinned by
`test_an_already_resolved_connection_is_not_re_read`.

---

## Findings that contradict the plan or the CONTEXT

### ⭐ F-1 — D-239-04's server half is ALREADY DONE, by registration alone

CONTEXT lists *"`GET /connectors/source-families` publishes `mcp`"* as in-scope work.
`connectors.py:1986` is:

```python
"families": sorted(
    f for f in SourceRegistry.list_supported_services()
    if f not in _NEVER_OFFERED_SOURCE_FAMILIES
)
```

Registering the adapter is therefore sufficient, and the route was **not touched**. Measured:

```
['custom_mcp', 'google', 'google_workspace', 'mcp', 'microsoft', 'microsoft_graph', 'mock_source']
```

→ the endpoint now publishes `custom_mcp` and `mcp`. **This is the milestone's claim landing one
layer up and it should be recorded as evidence, not quietly consumed.** Whichever plan owns
D-239-04 should verify rather than implement — and should check `_NEVER_OFFERED_SOURCE_FAMILIES`
(currently `{"mock_source"}`) is still the intended exclusion set.

### ⚠ F-2 — TM-239-03's 25 MB ceiling cannot fire on this transport

`MAX_FILE_BYTES = 25 MB` is implemented and matches Drive and Graph, as required. But
`mcp_client.MAX_MCP_BODY_BYTES` is **2 MB** on the whole JSON-RPC response, and base64 inflates
by 4/3 — so a file over roughly **1.5 MB** is refused upstream and the adapter's ceiling is
unreachable as configured. **A ceiling nobody can reach is not a ceiling.** Both numbers are
written into the module docstring and the ledger section so whoever raises the client cap finds
the note. The practical consequence is larger than the threat-model line suggests: **MCP file
sources currently cannot import a file over ~1.5 MB at all**, which is a product limit worth an
explicit decision rather than a discovery during UAT.

### ⚠ F-3 — the `mcp_client` sanitizer allow-list did not need widening

The phase's out-of-scope rule (*widen if needed, never remove or raw-spread*) was **never
exercised**. `mcp_client.py` is **byte-unchanged** by this plan: the adapter reads tool NAMES to
verify a binding, and names are already forwarded by `tools/list`. Recorded because "we widened it
carefully" and "we never needed to" are different claims.

### ⚠ F-4 — three files newly FIRE G-5 and are absent from CLAUDE.md's abridged FIRING table

`sources/base.py` (5 phases), `sources/__init__.py` (3, at threshold) and `mcp_client.py` (5) all
fire and none appears in CLAUDE.md's *G-5-FIRING* table. **I did not edit CLAUDE.md**: it is not in
this plan's `files_modified`, the enforcing gate reads `docs/HOT-FILE-LEDGER.md` (which is fully
updated), and plans 239-02/239-03 will want the same table — three concurrent edits to one table
is a merge conflict for no gain. **Named here so the phase close can add all three in one edit.**

### ⚠ F-5 — the brief's other three stale rows are still stale, on purpose

`connector_service.py` (`22/8/1613`), `api/connectors.py` (`39/18/2051`) and `security/egress.py`
(`13/5/982`) were flagged stale in my brief. I touched none of them and left their rows alone —
they belong to the plans that do touch them (239-02 / 239-03). Named so they are not lost.

### ⚠ F-6 — `page_size`, `recursive` and `query` are not honoured by this family

Stated plainly rather than accepted as silent no-ops:

- **`page_size` is advisory** and the whole listing is returned. `list_directory` is atomic, and
  slicing it client-side would trade H-5's real `SourceListing.complete` guarantee for a cosmetic
  one while letting the directory change mid-walk. Bounded in practice by `mcp_client`'s 2 MB cap.
- **`recursive` is not implemented here** — `preview_service.walk_source_files` already performs
  the recursive walk one folder at a time through `browse`, so recursion here would walk twice.
- **`query` is not implemented** — the MCP spec defines no search primitive. A server that has one
  has it under a name only its row knows, which is a future fourth key in `source_tools`.

---

## Threat model disposition

| id | disposition | how |
|---|---|---|
| TM-239-01 SSRF / egress bypass | **mitigated** | All egress via `mcp_client` (`validate_mcp_destination`, IP pinning + SNI, no redirects, `trust_env=False`). A structural fence refuses `httpx`/`requests`/`urllib`/`aiohttp`/`socket`/`egress` imports in the adapter — **driven RED against a planted `import httpx`** |
| TM-239-02 privilege escalation via untrusted annotations | **mitigated** | No hint reaches a comparison, membership test, subscript or `.get()`. Fenced structurally with a positive control — **driven RED against a planted `readOnlyHint` branch in the shipped file** |
| TM-239-03 DoS / memory exhaustion | **mitigated, with F-2 recorded** | `MAX_FILE_BYTES` 25 MB on the **decoded** payload, checked incrementally per content block. ⚠ The binding limit is `mcp_client`'s 2 MB — see F-2 |
| TM-239-04 schema validation crash (SEED-239) | **mitigated** | `McpConfig.source_tools` declared; driven RED including the whole-list outage shape, not just the leaf |

No new threat surface was introduced beyond the plan's register — no new endpoint, no new auth
path, no schema change.

---

## Commits

| # | hash | message |
|---|---|---|
| 1 | `d7b12947d` | `feat(239-01): McpConfig accepts source_tools — the binding is a ROW` |
| 2 | `7ba6b464b` | `test(239-01): RED — McpSourceAdapter contract, before the module exists` |
| 3 | `c79623d79` | `feat(239-01): McpSourceAdapter — any MCP file server, bound by a row` |
| 4 | `2e2f0da76` | `feat(239-01): resolve MCP by PROTOCOL, as data, never by vendor` |
| 5 | `23d02fce7` | `test(239-01): MCP joins the conformance suite; four ledger rows were STALE` |
| 6 | `657ef4c9a` | `style(239-01): drop a noqa that could never have applied` |

TDD gate sequence present: `test(...)` at #2 precedes `feat(...)` at #3.

---

## What this plan does NOT deliver (and nobody should read it as delivering)

- **No live drive against a real MCP file server.** Every result here is a unit result against
  doubles. `@modelcontextprotocol/server-filesystem` is a *local stdio* server, and
  `validate_mcp_destination` refuses loopback and RFC1918 by design — so a live row needs a
  remotely-hosted MCP file server, and that is a UAT prerequisite, not a code gap.
- **No UI.** Auto-detection of file tools on discovery (D-239-02), the override picker, and
  `connectionRowVerdict.ts`'s `"source-only"` verdict for BUG-260907-01 (D-239-08) are plans
  239-02 / 239-03.
- **The second-server claim is proven in TEST, not in the wild.** The parametrized `ls`/`cat`
  vocabulary appears nowhere in this repository as code, and the conformance fixture asserts the
  invoked tool name — which is strong evidence. It is not the same as somebody connecting a real
  second server, and the phase's SC should be closed on the latter.

---

## Self-Check: PASSED

Every claim above was verified rather than asserted, and **two were found wrong and corrected**:

| Check | Result |
|---|---|
| Created files exist | `mcp_source.py`, `test_239_mcp_source_adapter.py`, `test_239_mcp_config_source_tools.py`, this SUMMARY — all **FOUND** |
| Commits exist, in the claimed order | all six **FOUND** via `git log 69a8da589..HEAD`; `test(...)` precedes `feat(...)` |
| Ledger triple for `mcp_source.py` | ⚠ **was WRONG** — row read `1 / 1 / 644`, re-derived `2 / 1 / 643`. Commit #6 changed the file after the row was written. Row, section and this SUMMARY all corrected, and the miss is recorded in the section itself |
| Code/prose split | ⚠ **re-measured** after the same commit: `~335` code (not `~339`), `166` doc, `38` comment, `104` blank |
| `?raw` backend surface | ⚠ **my reasoning was wrong**, conclusion unchanged — see the gates section |
| Backend failing SET vs baseline | **IDENTICAL**, 71 = 71, zero new |
| `check-hot-file-ledger.cjs` | `EXIT=0` over all five files |
| `check-claude-md-size.cjs` | `EXIT=0` — 84,958 chars, 56.6% of limit |
| `test_boundary_fence.py` | `9 passed` |

⚠ **The ledger miss is the most useful line in this table.** A triple went stale *within a single
plan, inside an hour*, because a later commit in the same wave touched the file after the row was
written. That is this ledger's most-repeated finding reproduced in miniature, by me, in the very
commit that was supposed to fix four other people's stale rows.
