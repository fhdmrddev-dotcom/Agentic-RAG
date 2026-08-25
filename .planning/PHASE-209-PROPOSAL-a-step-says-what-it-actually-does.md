---
type: phase-proposal
proposed_number: 209
name: A step says what it actually does
created: 2026-08-25
proposed_by: operator, 2026-08-25 — after being shown the working MCP round trip in the browser
status: proposal — NOT registered in ROADMAP.md; awaiting the operator's go
requirements: CONN-02 (follow-up), CONN-03 (follow-up)
depends_on: Phase 206.2 (executed), Phase 206.3 (in progress — unrelated surface)
relates_to: [SEED-146, SEED-199, .planning/CONNECTIONS-MILESTONE-CANDIDATE.md]
size: small — one phase, frontend-only, no new dependency expected
---

# Phase 209 (proposed): A step says what it actually does

## Why this exists

The operator was shown the MCP round trip working end to end on 2026-08-25 — connection bound,
tools discovered live from `mcp.deepwiki.com`, permission granted and denied — and the reaction was
not *"this is broken"*. It was:

> *"I still see that it's a little bit complicated… in the canvas the step logo and the step label is
> still saying send an email… I did not see the real action. How it is really cool this MCP… on the
> connections tab we are still using this filter that is meaningless like Message or Ticket."*

**The plumbing is finished and the presentation is from the era when there were only three fixed
actions.** That is the entire content of this phase.

## Measured, at HEAD, 2026-08-25

| Claim | Verified how | Finding |
|---|---|---|
| The canvas node is generic | read `nodeEffectBanner.ts:40` | Its own docblock: *"The banner keys on `external_action`, the phase TYPE, and not on the resolved capability."* |
| The node cannot name the tool | `grep tool_name` over `nodeVocabulary.ts` + `canvasModel.ts` | **Zero hits.** The node face never reads `tool_name` — it *structurally cannot* say which tool runs |
| The filter chips exclude MCP | read `connectionsCopy.ts:154-156` | Chips are hard-bound to `send_email` / `create_ticket` / `post_message`. An MCP row has **no capability**, so it matches none — click *Email* and DeepWiki vanishes |
| The MCP step has no consequence sentence | wave-3 executor, flagged pre-emptively | `OutsideChangeLine` renders nothing without a capability |

⚠ **Two of these were FLAGGED BEFORE the operator saw them.** Plan `206.2-03`'s summary wrote:
*"An MCP step shows no consequence sentence… the canvas reads 'Reach outside' with
`CHANGES SOMETHING OUTSIDE` even for a read-only tool. Both carry re-open triggers. Without this
flag the first UAT round reports them as bugs."* The prediction was correct. **This phase is the
re-open those triggers asked for** — not a defect report.

## The reference the operator supplied

`screenshots/` (shared 2026-08-24, re-read 2026-08-25):

- **`Screenshot 2026-08-24 202011.png` — Claude.ai → Settings → Connectors.** Real service marks
  (Gmail, Slack, Google Calendar, Atlassian, ClickUp, GitHub, Figma), a **Popular** row, a
  `All / Connected / Not connected` filter that is about *state*, and `Type` + `Status` columns.
  ⚠ **Note what its filter is NOT:** it does not filter by *what the connector can do*. Ours does,
  and that is why ours breaks the moment a connection is not one of three verbs.
- **`Screenshot 2026-08-24 202036.png` — Claude.ai → Plugins directory.** Searchable, `Filter by` /
  `Sort by`, each entry an icon + name + one-line purpose. The catalog shape.
- **`…workflow-edit.webp` — xyOps.** ⭐ The canvas reference: **each node states its own identity on
  its face** (`CATEGORY`, `PLUGIN`, `TARGETS`, `TAGS`), every node carries its own glyph, and the
  edges are *typed* (`On Success` / `On Error` / `On Critical` / `On Continue`). Specific action
  nodes read **Send Email**, **Web Hook Discord**, **Create Ticket** — never "reach outside".

## Scope — three items, all frontend

1. **The node face names the real action.** An MCP step reads its connection's service and its
   `tool_name`, so the card says something like **"DeepWiki · read_wiki_structure"** with the MCP
   mark, not *"Reach outside"* with an envelope. Capability steps say *"Slack · post a message"*.
2. **The effect banner tells the truth.** `CHANGES SOMETHING OUTSIDE` on a **read-only** tool is
   wrong. A read tool reads. ⚠ **This is a governance string, not decoration** — it must become
   *more* accurate, never softer, and the wording change needs the same care as the Phase 185
   vocabulary it belongs to.
3. **The connections filter becomes about the connection, not the verb.** Follow the Claude.ai
   reference: filter by *state* (all / connected / not checked / disabled) and/or by *service*.
   An MCP connection must be findable.

## Explicitly OUT of scope — this is the milestone, not this phase

- A connector **catalog**, OAuth, "Connect" buttons, a directory of famous services. That is
  `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md` and it is a milestone.
- Typed edges (`On Success` / `On Error`) — that is `SEED-199`.
- Any backend change, any new dependency, any change to `frontend/src/lib/api.ts` (Phase 207).

## How we'd know this failed

- The node face reads `capability` and gains an MCP special-case, instead of reading the connection.
  A fifth shape then needs a fourth special-case.
- The effect banner becomes *vaguer* to accommodate read tools, instead of more precise. Losing
  `CHANGES SOMETHING OUTSIDE` on a step that really does change something outside would be a
  governance regression, not a copy improvement.
- The filter is fixed by adding a fourth **MCP** chip beside Email/Tickets/Messages — that repeats
  the original mistake one row down and breaks again at the fifth connection kind.
- ⚠ Service marks are approximated or drawn by hand. The icon convention forbids it, and
  `lib/connectionMark.tsx` + `lib/fileTypeMark.tsx` already exist as the one shared seam.

## Success criteria (draft — to be firmed at discuss-time)

1. A canvas node for an MCP step names its service and its tool, driven in a real browser.
2. A read-only tool does not claim to change something outside; a writing tool still does — both
   asserted, and the Phase 185 governance vocabulary is not weakened.
3. An MCP connection is findable through the Connections filter.
4. Marks come from the ONE shared map; no hand-drawn trademark; every slug verified to resolve.
5. The three shipped capability shapes render byte-identically.
6. Baselines unchanged: backend, `tsc -p tsconfig.app.json`, count gate with no per-file decrease.
