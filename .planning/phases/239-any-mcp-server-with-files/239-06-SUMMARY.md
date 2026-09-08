---
phase: 239-any-mcp-server-with-files
plan: "06"
kind: seed-answer
answers: SEED-259
scope: backend
subsystem: sources · mcp · connections
base: 0b9568c26
head: (this commit)
tdd: true
tags: [mcp, source-contract, argument-mapping, fail-closed, h-5, rows-not-code, tdd-red]
frontend_owed: true
---

# Phase 239 Plan 06 — `SEED-259` answered: argument mapping as data, with the refusal that ships first

Tool NAMES were rows. Tool ARGUMENT SHAPES were code. Both are rows now, and a bound tool this
connection cannot call is **refused by name instead of answered with an empty listing**.

---

## ⚠ Read this first: the worktree landed on the wrong base, for the FIFTH time running

`git rev-parse HEAD` in the fresh worktree read **`1335b4b1a`** — *"Merge develop into master —
ship v3.9 Connections"* — not the `0b9568c26` the brief names. The brief predicted four
occurrences; this is the fifth. Reset with `git reset --hard 0b9568c26` before any read, and
every measurement below is from that base. **This is not a flake to keep absorbing** — five
consecutive worktrees landing on an old master merge is a defect in whatever creates them, and
a plan that did not check would have built against a tree missing all of Phase 238 and 239.

---

## What shipped

### Deliverable 1 — the safety half, and it went in first

**When a bound tool's `inputSchema` declares required arguments the adapter cannot supply, the
call is refused BY NAME, pre-flight, and nothing is sent.**

- `_required_params` / `_required_by_tool` read `inputSchema.required` off `discovered_tools` —
  **already discovered, already stored** (`mcp_client.list_tools` sanitises it into that column),
  so this needed no new data anywhere.
- `_Binding.refuse_if_underspecified(tool, role)` runs **before** `mcp_client.call_tool` in both
  `_list` (browse + list_files) and `read_file`.
- The message names **the tool, the role, and every argument it cannot supply**, in the plain
  style the empty-root refusal already uses, and it says how to fix it.
- **`check()` reports it too**, off the **LIVE** `tools/list` rather than the cached column. It
  previously answered `ok=True` for a tool that exists and cannot be called — a green health
  probe over a dead source, the same class of misconfiguration as the "server does not offer this
  tool" arm it already refused.

**Why this was the urgent half:** the observed failure was `HTTP 200` + an empty listing, which
is review finding `HI-03`'s fail-open shape reproduced on a different path *after* `HI-03` was
fixed. `watch_service` stamps `listing.complete = True` on a first pass with no page token, so an
empty-but-complete listing is exactly what the **`H-5` deletion guard** consumes — *"the source
returns nothing"* and *"everything was deleted"* are the same bytes. Raising instead is verified
to be safe: `watch_service` sets `listing_complete=False` when the listing throws, which
suppresses every `missing` transition.

**It is driven off the server's own schema, never off a list of servers**, so it holds for a
server misbound for reasons nobody predicted —
`test_the_refusal_holds_for_a_server_NOBODY_PREDICTED` uses a vocabulary (`enumerate` /
`bucket` / `prefix`) that appears nowhere in this repository.

### Deliverable 2 — the mapping

Two flat prefixed key families **inside the existing `source_tools` dict**:

| Key | Meaning | Default |
|---|---|---|
| `arg_path` | the NAME of the argument that carries the path | `"path"` |
| `arg_static.<name>` | a fixed value for the server's required argument `<name>` | — |

The real case from the seed, end to end and driven
(`test_THE_REAL_SEED_259_CASE_lists_AND_reads`):

```json
{"list_tool": "get_file_contents", "read_tool": "get_file_contents",
 "arg_path": "path", "arg_static.owner": "fhdmrddev-dotcom", "arg_static.repo": "Agentic-RAG"}
```

→ `{"owner": "fhdmrddev-dotcom", "repo": "Agentic-RAG", "path": "/"}` on the wire, a **real
listing**, and a real read. Unmapped → a **named refusal**.

**No `McpConfig` field, no shape change, no migration.** Asserted, not merely intended:
`test_McpConfig_declares_NO_new_field_for_this` reads `McpConfig.model_fields`.

---

## The key names, and why these

I chose **`arg_path`** (the brief's own suggestion, taken literally) and **`arg_static.<name>`**.

- **They are deliberately disjoint namespaces.** The tempting design is one prefix — `arg_path`
  meaning *"the path argument"* and `arg_owner` meaning *"a static for `owner`"*. That collides
  the instant a server names its path argument something other than `path`: `arg_path` would then
  read as *"a static value for the argument called `path`"*. One typo pins every browse to one
  fixed directory, which is a COMPLETE listing of the wrong folder — the `H-5` deletion signal
  wearing a success. `arg_static.` is not a prefix of `arg_path`, so the two can never be read as
  each other.
- **Self-describing.** `arg_static.owner` says both that it is an argument and that it is a fixed
  value. Nothing else it could be.
- **Bounded by the ceilings that already exist.** `arg_static.` is 11 chars against the 64-char
  key ceiling ME-07 added; values inherit 512. Riding the declared `dict[str, str]` inherits the
  bound rather than adding a surface with none — half the argument for not adding a field.
- **Flat, because `SEED-239`.** A nested member would re-enter the territory where one malformed
  `config` row matches no member of the `ConnectorConfig` union and makes **every connection in
  the org** unreadable.

### The three safety decisions inside the mapping

1. **The path always wins.** `arguments()` writes `static_args` first and `path_arg` last, so
   `arg_static.path` can never shadow the address. Chosen over refusing the collision at the write
   boundary because it also holds for rows written before that boundary existed.
2. **An empty static value is SENT, not dropped.** `""` is a value somebody typed (a default
   branch, a bucket root). Dropping it would silently re-create the missing argument this phase
   refuses — and the refusal would then not fire, because the key IS present.
3. **`None` becomes `""`, never `"None"`.** `McpConfig` types the dict as `dict[str, str]`, but a
   row written before that field existed reaches the adapter unvalidated.

---

## The fence held, and it was driven

⛔ **No vendor name, server name or tool name entered a conditional anywhere.** The two new
constants live in `mcp_source.py` (which owns the vocabulary) and `connector_service.py` imports
them, so no tool-name literal was added above `adapters/`.

`reject_unoffered_source_tools` needed to learn that the new keys are not tool names, and it
learned it as an **ALLOW-LIST** (`root_path`, `arg_path`, `arg_static.*` exempt; **everything
else is still read as a tool name**). Written the other way round — *"check the keys I
recognise"* — `{"sneaky": "delete_file"}` would sail through as an unfamiliar role. That
inversion is the change's whole risk, so it carries its own cases, including a key that merely
*starts like* the prefix (`argosy_tool`).

⚠ An `arg_static.*` value that spells a destructive tool is **left alone on purpose** — it reaches
`params.arguments`, never `params.name`, so it invokes nothing, and refusing it would refuse a
repository legitimately called `delete-me`. That is **asserted**
(`test_a_mapping_key_is_never_read_as_a_TOOL_NAME` checks the recorded `tool_name` AND the
recorded `arguments`), not reasoned about.

---

## RED evidence, with hashes

### The suite was RED before the implementation existed

`backend/tests/unit/services/sources/test_259_argument_shapes_are_rows_too.py`
md5 **`e35655539261f8fb8e0bf9d9c3f48b13`**, committed alone at **`9efbb5db1`**, against the
shipped `mcp_source.py` at base `0b9568c26`:

```
15 failed, 17 passed, 1 warning in 1.34s
```

The 15 are the two deliverables. **The 17 passing are the negative controls and they are green on
purpose, before and after** — the reference server on a lone `path`, an optional argument, an
absent `required` array, a connection that never discovered anything, and the flat-shape/bounds
assertions on `McpConfig`. A suite where everything is red proves the module was missing; a suite
with working negative controls proves the fence discriminates.

⚠ **Two of the 32 had no RED value and I am naming them rather than counting them as evidence.**
`test_a_static_can_NEVER_shadow_the_path_argument` and
`test_the_mapping_satisfies_the_refusal_it_exists_to_answer` passed at base — the first because
`arg_static.path` was ignored entirely, the second because the fake returned a listing regardless
of arguments. Both are meaningful guards **after** the change and neither is proof of the change.

### The boundary fence was driven RED against the SHIPPED file

Planted into `backend/app/services/connector_service.py` (the shipped file, not a copy):

```python
if key in ("get_file_contents", "list_directory"):
    return False
```

```
E           line 474: 'get_file_contents' (matches 'get_file_contents')
E           line 474: 'list_directory' (matches 'list_directory')
1 failed, 17 passed
```

Restored and re-measured **md5-identical**: `801fd66ddc243fd8d8e3a5aa7ac7f440` before and after;
`18 passed` on the restored file.

### One test was wrong and it is recorded, not quietly fixed

`test_check_reads_the_server_LIVE_and_not_the_cached_list` failed on first GREEN. **The code was
right and my fixture was wrong**: the connection bound only `list_tool`, so `read_tool` fell back
to `read_file`, which the fake server does not offer — and the pre-existing *"this server does not
offer …"* arm fired first, correctly. Fixed by binding both roles; the reason is written into the
test body so the earlier, more specific check is not later mistaken for a gap.

---

## Gate verdicts, verbatim

**Targeted (from `backend/`, venv):**

```
$ pytest tests/unit/services/sources tests/unit/test_239_mcp_source_discovery.py tests/unit/test_239_mcp_config_source_tools.py -q
320 passed, 1 warning in 2.58s
```

(288 at base + 32 new. No pre-existing case in that set changed colour.)

**Full backend unit suite, this tree:**

```
$ pytest tests/unit -q --continue-on-collection-errors
71 failed, 4222 passed, 2 xfailed, 2 xpassed, 44 warnings in 164.49s (0:02:44)
```

**Full backend unit suite, base tree** — measured, not assumed. `git checkout 0b9568c26 --
backend/app` with the new suite `--ignore`d, then restored with `git checkout HEAD -- backend/app`:

```
71 failed, 4190 passed, 2 xfailed, 2 xpassed, 42 warnings in 128.75s (0:02:08)
```

**⭐ THE FAILING SET WAS DIFFED, NOT THE COUNT.** Both `FAILED` lists were captured to disk and
`diff`ed node-id by node-id:

```
FAILING SET IDENTICAL — 71 = 71, zero new, zero fixed
```

`4190 → 4222` is `+32`, exactly the new suite, with **no residual**. The ceiling is `71` with zero
headroom and it is untouched. (The 71 span 24 files; none is in `tests/unit/services/sources/`,
`test_239_*` or `test_259_*`.)

**Ledger and CLAUDE.md:**

```
$ node scripts/check-hot-file-ledger.cjs --files backend/app/services/sources/adapters/mcp_source.py backend/app/models/connector.py backend/app/services/connector_service.py
  scan list: 231 rows · subject: 3 files · watched: 3
ledger gate OK — every watched file has a row.

$ node scripts/check-claude-md-size.cjs
  CLAUDE.md                                   86122 chars   57.4% of limit  headroom   63878  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

---

## Ledger triples, re-derived in the commit that lands them

| File | row said | **re-derived** |
|---|---|---|
| `backend/app/services/sources/adapters/mcp_source.py` | `6 / 1 / 1022` | **`8 / 1 / 1259`** |
| `backend/app/models/connector.py` | `23 / 13 / 751` | **`24 / 13 / 772`** |
| `backend/app/services/connector_service.py` | `24 / 9 / 1749` | **`25 / 9 / 1772`** |

⚠ **`mcp_source.py`'s row has now been stale at EVERY close it has had** — `2/1/643` →
`6/1/1022` → `8/1/1259`. The ledger's own repeated finding, reproducing on the newest file in it.
It still does not fire G-5 (one phase). Both CLAUDE.md rows and all three
`docs/HOT-FILE-LEDGER.md` sections are updated in the same commit, per the sync rule.

---

## ⛔ What I did NOT do — silence would read as done

1. **No frontend.** The brief scopes this to backend and a frontend pass follows. **So today the
   mapping can only be set through `PATCH /connectors/connections/{id}` with a hand-written
   `config`** — Settings renders no control for `arg_path` or `arg_static.*`, exactly as
   `HI-04` records for `root_path`. Until that ships, `SEED-259`'s capability half is reachable by
   API only, and **SC#2 cannot be closed through the product**.
2. **Not driven against the live server.** The brief says I cannot reach it, and I did not. Every
   claim above is from unit drives with a recording double. `SEED-259` and SC#2 close on a real
   GitHub MCP binding, which is a UAT row somebody with the credential must run.
3. **A tool ABSENT from a non-empty `discovered_tools` is NOT refused at call time.** Only a tool
   whose schema is known and unsatisfiable is. Refusing on absence would break a working
   connection whose cache has not seen a newly-added tool; `check()` covers it against the live
   server. This is the same asymmetry `reject_unoffered_source_tools` already reasons about, and
   it is a deliberate residue, not an oversight — `test_a_tool_ABSENT_from_a_discovered_list_is_left_to_check`
   pins the behaviour so a future change to it is visible.
4. **A connection that has never discovered anything is NOT refused.** Same reasoning. **This is
   the honest limit of the safety half**: fail-closed applies where there is a schema to fail
   against.
5. **`infer_source_tools` does not detect argument mappings.** Auto-detecting which parameter is
   the path is a guess of the kind `CR-02` was filed about; the operator's picker stays the
   escape hatch. Worth doing later — the `_PATH_PARAMS` shape test already exists — but it is a
   product decision, not a bug fix.
6. **No router change.** An underspecified browse surfaces as the existing `502 "Cloud storage
   provider returned an error: <the refusal>"`, so the words reach the user but the status code
   says gateway rather than configuration. A `ValueError → 422` mapping on that route is a
   separate, wider change.
7. **`SEED-259`'s frontmatter still reads `status: answered`.** It is answered and now half-built;
   I did not flip it to `shipped`, because its own ruling says SC#2 stays open until a second
   server actually lists and reads, and that has not happened.
8. **No STATE.md / ROADMAP.md / VALIDATION.md edits.** SC#2 is still NOT met and I did not want a
   record that implies otherwise. What changed is that the shortfall is now *buildable through
   data* and the dangerous half is closed.
9. **Nothing pushed. `master`, `production` and `frontend/` untouched.**

---

## Anything that contradicts the brief

**Nothing material.** Three small notes, recorded because the brief asks:

- The brief says the refusal *"must hold for a server misbound for reasons nobody predicted —
  fail closed by default"*. **It does, for every server whose schema is known**, which is every
  server the product has contacted. It does **not** fire where no schema exists at all
  (items 3–4 above). That is a narrower fail-closed than the sentence reads, it is the same
  narrowing the neighbouring boundary already made for the same reason, and it is stated here
  rather than papered over.
- The brief's `arg_path` naming was adopted verbatim; the static half needed a name and
  `arg_static.<name>` was chosen for the collision reason above rather than the shorter
  `arg.<name>`.
- `mcp_source.py`'s module docstring claimed **"three optional string keys"**. That number was
  the defect in prose form — it is now corrected in place with the original struck through, per
  this repo's convention.

---

## Bus

`scripts/agent-bus.sh list --to claude` shows **5 open items** (`BUS-171`, `BUS-173`, `BUS-189`,
`BUS-192`, `BUS-196`). None is about `SEED-259` and none blocks this work; `BUS-196` is Gemini's
Phase 239 planning-complete notice, already answered by `BUS-197`. **Not touched by this plan** —
flagged so the queue is not mistaken for empty.
