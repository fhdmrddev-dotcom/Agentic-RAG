---
seed_id: SEED-259
title: SC#2 driven on a real second MCP server — tool NAMES are rows, but tool ARGUMENT SHAPES are not, and a server whose reader needs three arguments returns an empty listing with HTTP 200
created: 2026-09-08
planted_during: Phase 239 SC#2, driven live against GitHub MCP as the second file server
status: planted
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
