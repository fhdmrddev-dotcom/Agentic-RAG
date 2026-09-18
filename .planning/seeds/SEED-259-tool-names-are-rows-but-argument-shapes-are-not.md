---
seed_id: SEED-259
title: SC#2 driven on a real second MCP server — tool NAMES are rows, but tool ARGUMENT SHAPES are not, and a server whose reader needs three arguments returns an empty listing with HTTP 200
created: 2026-09-08
planted_during: Phase 239 SC#2, driven live against GitHub MCP as the second file server
status: answered
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: answered  # OPERATOR RULED 2026-09-08 — OPTION 2 (argument mapping as data), with OPTION 1 shipping alongside as the safety half

  The prose that followed the token, byte-for-byte:
  # OPERATOR RULED 2026-09-08 — OPTION 2 (argument mapping as data), with OPTION 1 shipping alongside as the safety half

  Mapped `answered` -> `answered`. Reason: clean 1:1.
priority: high
surface: Agentic-RAG
relates_to:
  - Phase 239 (SRC-04) — SC#2 is what produced this; it is the criterion's ANSWER, not a side note
  - Phase 232 — the source contract this measures; ROADMAP 239 says a shortfall is a finding AGAINST that contract
  - SEED-257 — why no local server could be used, which is why this was found so late
  - `backend/app/services/sources/adapters/mcp_source.py:822`, `:956` — the single-argument call
  - review finding HI-03 — the fail-open shape this reproduces on a different path
trigger_when: >
  ANY of, and the first is immediate: (a) Phase 239's SC#2 is scored — this seed IS the evidence and
  the criterion cannot be marked met without ruling on it; (b) a THIRD MCP file server is connected
  and its reader takes anything other than a lone `path`; (c) Phase 240 (mail) or any later SRC-
  family reuses `McpSourceAdapter`; (d) anyone proposes per-server argument mapping — read the
  "rows, not code" fence first, because a mapping table IS rows and a branch is NOT.
---

# SEED-259 — the contract carries names, not shapes

## What was driven, 2026-09-08

Phase 239's SC#2: *"a person can add a second, different MCP file server afterwards with no change
to the product at all."* Driven live against **GitHub MCP** (`api.githubcopilot.com`), already
connected and authenticated, as the second server after the reference filesystem vocabulary.

**Bound entirely through the UI:** `list_tool = get_file_contents`, `read_tool = get_file_contents`,
root `fhdmrddev-dotcom/Agentic-RAG`. **`git log` between the two servers is EMPTY and the tree was
clean** — `91e8cc4ba` before and after.

## The half that PASSED, and it is not a small half

- The binding saved and persisted as **data on the connection row**.
- **GitHub appeared in the Library's "From a connected source" picker**, where it had never been —
  the picker previously offered only Google Workspace and Microsoft 365.
- `GET /connectors/connections/{id}/browse` **fired and returned `200`**.
- **Zero code.** Registration, protocol resolution, capability derivation, the picker and the browse
  route all worked for a family nobody wrote a line for.

## The half that FAILED, and it is the finding

**The listing came back EMPTY.** *"GitHub · 0 documents · 0 chunks · 0 jobs · 0 folders"*, `Add 0`.

**Cause, verified in both directions rather than inferred:**

- `mcp_source.py:822` sends `{"path": folder_path}` and `:956` sends `{"path": file_id}` — **a lone
  `path`, always.**
- GitHub MCP's `get_file_contents` requires **three separate arguments**: `owner`, `repo`, `path`.
  Confirmed by invoking the same tool directly against the same server.

⭐ **So the contract carries tool NAMES as data and tool ARGUMENT SHAPES as code.** Phase 239 proved
the first half — `list_directory` vs `ls` vs `get_file_contents` genuinely is a row. It did not
prove the second, and nothing in the phase ever exercised it, because `SEED-257` records that no
MCP file server could be driven locally at all.

⚠ **This is NOT a defect introduced by Phase 239.** It is the boundary of what Phase 232's contract
can express, made visible by the first real test. ROADMAP 239's own instruction covers exactly this:
*"If this phase was not small, that is recorded as a finding against Phase 232's contract — naming
the specific thing the contract could not express."* **The specific thing is: a tool's argument
shape.**

## ⛔ The dangerous part, which is separate from the shortfall

**The failure presented as `HTTP 200` with an empty listing, not as an error.**

That is review finding **HI-03's exact shape** — *"a listing this app cannot parse is reported as an
EMPTY, COMPLETE listing"* — reproduced on a different path after HI-03 itself was fixed. And an
empty-but-complete listing is **precisely what the `H-5` deletion guard consumes**: on a watched
folder, "the source now returns nothing" is indistinguishable from "everything was deleted".

⚠ **Nothing was lost here** — this was a browse, not a watch cycle, and no watch was created. But a
misbound server that silently reads as empty is one `Add Watched Folder` away from being a
deletion signal. **This half should be treated as more urgent than the shortfall itself.**

## Options, deliberately unranked

| # | Option | Note |
|---|---|---|
| 1 | **Refuse rather than return empty** when a bound tool's `inputSchema` has required arguments the adapter cannot supply. Schema is already discovered and already stored | Closes the dangerous half without deciding the feature question. ⚠ Also the only option that helps if a server is misbound for some OTHER reason |
| 2 | **Argument mapping as data** — store per-connection which discovered field takes the path, plus static values for the rest (`owner`, `repo`) | ⭐ **Still "rows, not code"**, and it is the option that would make SC#2 true rather than partly true. A mapping table is rows; a `if server == "github"` branch is not |
| 3 | **Scope the claim honestly** — the contract fits servers whose file tools take a single path, and say so | Cheapest, and legitimate IF stated. It narrows SRC-04's wording, which is an operator call |
| 4 | Do nothing | ⛔ Leaves option 1's fail-open live |

## How we would know this was answered badly

- SC#2 is marked met citing "GitHub appeared in the picker" and not mentioning the empty listing.
- A per-vendor branch appears above `adapters/` — the exact fence Phase 239 exists to hold.
- The empty-listing path is left returning 200 while a watch can be created on it.
- A third server is connected and this is rediscovered from scratch.

---

## ✅ ANSWERED 2026-09-08 — operator ruled: **OPTION 2, argument mapping as data**

The operator chose **option 2**: store per-connection which discovered argument takes the path, plus
static values for the server's other required arguments (`owner`, `repo`, …). ⭐ **This keeps the
"rows, not code" fence intact** — a mapping table is rows; `if server == "github"` is not. It is the
only option that makes SC#2 *true* rather than narrowing what SC#2 claims.

⚠ **OPTION 1 SHIPS ALONGSIDE, AND FIRST — raised by claude at the ruling and not overridden.**
Option 2 makes a CORRECTLY-bound server work. It does nothing for a MISbound one, which still
returns `200` + an empty listing and still feeds the `H-5` deletion guard. **The two options answer
different questions**, and the safety one must not be left open on the assumption the feature covers
it:

- **Option 1 (safety):** when a bound tool's `inputSchema` declares required arguments the adapter
  cannot supply, **refuse by name** instead of returning an empty listing. The schema is already
  discovered and already stored, so this needs no new data. ⛔ It must also hold for a server
  misbound for reasons nobody predicted — which is the whole point of a fail-closed default.
- **Option 2 (capability):** the mapping itself.

⛔ **Option 3 is explicitly REJECTED by this ruling** — the claim is not being narrowed. SRC-04 keeps
its wording, and SC#2 stays open until a second server actually lists and reads.

~~**Not yet scheduled at the time of writing.** Sequencing, plan count and whether this is an insert
phase or folded into a later SRC phase are the next decisions.~~

---

## ⭐ BACKEND BUILT 2026-09-08 — `239-06`. **Both halves. SC#2 still NOT met.**

Full evidence: **`.planning/phases/239-any-mcp-server-with-files/239-06-SUMMARY.md`**.

- **Option 1 (safety) SHIPPED and it went in first**, as the ruling requires. A bound tool whose
  `inputSchema` declares required arguments the connection cannot supply is **refused by name,
  pre-flight, sending nothing** — on browse, on list, on read, and `check()` reports it too,
  against the **live** `tools/list` rather than the cached column. Driven off the server's own
  schema, so it holds for a vocabulary that appears nowhere in this repository.
- **Option 2 (mapping) SHIPPED as rows**: `arg_path` names the argument carrying the path,
  `arg_static.<name>` supplies a fixed value for each other required argument — **flat prefixed
  keys inside the existing `source_tools` dict**. No `McpConfig` field, no nested member, no
  migration, so `SEED-239`'s org-wide-outage shape stays off the table.
- ⛔ **No vendor arm anywhere.** `test_boundary_fence.py` was driven RED by planting
  `if key in ("get_file_contents", "list_directory")` into the shipped `connector_service.py` and
  restored md5-identical. The write boundary exempts the two new key families **by ALLOW-LIST** —
  an unknown key is still read as a tool name and still refused.

### ⛔ Why this seed is NOT `shipped`, and what it now waits on

**Its own ruling says SC#2 stays open until a second server actually lists and reads, and that
has not happened.** Two things stand between here and there, both named rather than assumed:

1. **The mapping has no UI.** Backend only, by scope. `arg_path` / `arg_static.*` can be set only
   through `PATCH /connectors/connections/{id}` — the same gap `HI-04` records for `root_path`.
   Until a frontend pass ships, **the capability is unreachable through the product.**
2. **Nothing was driven against the live server.** Every claim is from unit drives with a
   recording double. The end state (`get_file_contents` + `owner`/`repo` → a real listing) is a
   UAT row owed by somebody holding the credential.

⚠ **And one honest limit on the safety half**: it fires where a schema is KNOWN. A connection
that has never discovered anything, or a bound tool absent from a non-empty cache, is not refused
at call time — `check()` covers that against the live server. Same asymmetry
`reject_unoffered_source_tools` already carries, for the same reason (refusing there fires on the
honest case and not the dishonest one), pinned by a test so a future change to it is visible.

**`re_open_trigger` (replaces the original `trigger_when` for what remains):** ~~the frontend pass
that gives `arg_path` / `arg_static.*` a control, OR~~ the first live drive of a second MCP file
server — whichever comes first. Either one is where SC#2 is scored.

---

## ⭐ FRONTEND BUILT 2026-09-08 — `239-07`. **The first half of that trigger has FIRED.**

Full evidence: **`.planning/phases/239-any-mcp-server-with-files/239-07-SUMMARY.md`**.

The *File source mapping* card now carries the mapping, so **item 1 of `239-06`'s "what I did NOT
do" is closed**: `arg_path` and `arg_static.*` are no longer API-only, and a person can set them
without hand-crafting a `PATCH`.

- **`arg_path` is a PICKER over the server's own declared argument names**, not a text box — the
  names are already in `discovered_tools[].inputSchema` and already stored. It degrades to free
  text only where the server published no schema, because a one-option `<select>` is a dead end.
- **One row per required argument the path does not carry**, derived from that same schema. A
  stored static the server no longer asks for still renders, because the column is rewritten
  WHOLE and a row off the screen is a row deleted on the next save.
- **`239-06`'s refusal is said BEFORE somebody hits it**, naming every unfilled argument.
- ⛔ **An unfilled row is OMITTED rather than written empty.** A deliberate divergence from
  `_static_args`, which keeps `""`: every derived row starts empty here, so writing them would
  make the key PRESENT for every argument nobody supplied and leave `refuse_if_underspecified`
  with nothing to say — opening the panel would have disabled the safety half in one press.
- ⛔ **No vendor name and no argument default**, fenced by a `?raw` scan of both shipped files
  and by a fixture vocabulary that appears nowhere else in this repository.

### ⛔ Why this seed is STILL NOT `shipped`

**Its own ruling says SC#2 stays open until a second server actually lists and reads, and that has
still not happened.** Item 2 of `239-06`'s list is untouched: nothing has been driven against a
live server. The remaining trigger is that drive, and it is a UAT row owed by somebody holding the
credential.
