# Phase 209: A step says what it actually does - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 209 delivers three frontend presentation and legibility improvements for workflows and connections:
1. **The node face names the connection's service and the step's `tool_name`:** An MCP step renders its connection's service name and its `tool_name` (e.g. `DeepWiki · read_wiki_structure`) with the connection's real mark from `connectionMark.tsx` rather than generic "Reach outside" with an envelope. Capability steps similarly name their service and action.
2. **The effect banner tells the truth:** A read-only tool stops claiming `CHANGES SOMETHING OUTSIDE`. It renders `ONLY READS` in dim tone for confirmed read tools (`read_*`, `get_*`, `list_*`, `search_*`, `fetch_*`, `query_*`, `describe_*`, `find_*` or `readOnlyHint === true`). Mutating or unclassified tools retain `CHANGES SOMETHING OUTSIDE` in the warning tone. Phase 185 governance vocabulary is strengthened, never softened.
3. **The Connections filter becomes about connection state:** The filter rail in Settings → Connections stops being three hard-coded verbs (`send_email`, `create_ticket`, `post_message`) that exclude MCP connections. Following the Claude.ai Connectors reference, it filters by connection state (`All`, `Connected`, `Not connected`), and search matches name, destination, host, and service.

### Forbidden Fixes
- Do NOT add a fourth "MCP" chip to the filter bar (repeats the flaw one row down).
- Do NOT make the effect banner vaguer to accommodate read tools.
- Do NOT hand-draw or approximate any service mark (use the shared `connectionMark.tsx` seam).
- Do NOT use `readOnlyHint` as the sole direction mechanism (DeepWiki lacks it; use prefix heuristics with hint fallback).

</domain>

<decisions>
## Implementation Decisions

### Node Face Identity & Title
- **D-209-01:** For `external_action` steps with `tool_name` (MCP shape), `derivedFace` formats the title as `<ConnectionName> · <tool_name>` (or `<tool_name>` if unbound / no connection name).
- **D-209-02:** For `external_action` steps with `capability` (Capability shape), `derivedFace` continues formatting the title with the resolved connection destination and verb.
- **D-209-03:** The canvas node icon well on `external_action` steps renders the connection's real mark from `connectionMark.tsx` (using MCP mark for MCP connections, Slack mark for Slack, Jira mark for Jira, Mail/Plug for email/neutral) rather than the generic external action phase glyph.

### Effect Banner Accuracy
- **D-209-04:** `nodeEffectBanner.ts` exports two banners: `EFFECT_BANNER_OUTSIDE = "CHANGES SOMETHING OUTSIDE"` (warning tone) and `EFFECT_BANNER_READ_ONLY = "ONLY READS"` (dim tone).
- **D-209-05:** Direction resolution logic inspects tool name prefixes (`read_`, `get_`, `list_`, `search_`, `fetch_`, `query_`, `describe_`, `find_`) and `readOnlyHint === true` when present. If detected as read-only, `effectBannerFor` returns `EFFECT_BANNER_READ_ONLY`. Mutating tools (`create_*`, `update_*`, `delete_*`, `post_*`, `send_*`, `patch_*`, `write_*`) or unannotated non-prefixed tools return `EFFECT_BANNER_OUTSIDE`. Non-external phases return `null`.

### Connections Tab Filter
- **D-209-06:** Filter chips in `connectionsCopy.ts` are updated to state-based chips:
  - `All` (`state: null`)
  - `Connected` (`state: "ready"`)
  - `Not connected` (`state: "not_connected"`, matching `not_checked`, `disabled`, `failed`)
- **D-209-07:** Text filter in `connectionMatchesQuery` searches `connection.name`, destination facts, and `mcp_server_url` (destination host).

### Totality, Purity & Icon Conventions
- **D-209-08:** `connectionMark.tsx` remains the single shared source of truth for connection marks with verified `@iconify-json/logos` slugs and the 3-ink contract (`self`, `fill`, `stroke`).
- **D-209-09:** All resolvers remain pure, total over malformed inputs, and free of prototype pollution vulnerabilities (inline `hasOwnProperty.call` guards).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Orientation & Proposals
- `.planning/ORIENTATION-260825-connections-and-canvas.md` — The connections map, live findings, and canvas grammar.
- `.planning/PHASE-209-PROPOSAL-a-step-says-what-it-actually-does.md` — The original proposal and live measurements at HEAD.
- `.planning/ROADMAP.md` § Phase 209 — Goal, failure modes, and 6 success criteria.

### Design Acceptance Bar
- `screenshots/Screenshot 2026-08-24 202011.png` — Claude.ai Connectors: State-based filter (`All`, `Connected`, `Not connected`), real service marks, status indicators.
- `screenshots/Screenshot 2026-08-24 202036.png` — Claude.ai Plugins directory: Catalog IA, search and filter patterns.
- `screenshots/68747470733a2f2f7069786c636f72652e636f6d2f696d616765732f626c6f672f78796f70732f776f726b666c6f772d656469742e77656270.webp` — xyOps workflow editor: Node face identity, specific action naming, glyph representation.

### Codebase Seams & Conventions
- `references/icon-convention.md` — Single source of truth for service marks, no hand-drawn approximations, verified slugs.
- `docs/HOT-FILE-LEDGER.md` — Invariants and history for `phaseVocabulary.ts`, `PhaseNodeCard.tsx`, `ConnectionsTab.tsx`, `connectionsCopy.ts`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/settings/connectionMark.tsx`: `ConnectionMarkGlyph`, `connectionMark`, `ConnectionMarkShape` with 3-ink contract and `@iconify-json/logos` imports.
- `frontend/src/components/workflows/nodeEffectBanner.ts`: Effect banner resolution and string constants.
- `frontend/src/components/workflows/phaseVocabulary.ts`: `derivedFace`, `derivedFaceOf`, `nodeTitle`, `NameContext`.
- `frontend/src/components/workflows/PhaseNodeCard.tsx`: Node card face rendering, effect banner styling, title layout.
- `frontend/src/components/workflows/PhaseNode.tsx`: NodeProps-to-slots adapter, icon well rendering.
- `frontend/src/components/settings/ConnectionsTab.tsx` & `connectionsCopy.ts`: Settings connection list, filter chips, search matcher.

### Established Patterns
- Pure vocabulary and derivation modules with totality over malformed author-supplied JSONB.
- Characterization baseline tests and `?raw` source fences guarding against drift and unverified refactors.
- Strict GSD gates: `tsc -p tsconfig.app.json` at 34, vitest count gate `OK 114/114, failed 0` with `GSD_VITEST_MAX_WORKERS=2`.

</code_context>

<specifics>
## Specific Ideas

- Ensure `DeepWiki · read_wiki_structure` renders cleanly without wrapping or ugly clipping.
- `ONLY READS` styled with `text-muted-foreground` or dim tone, matching the 9px bold wide-tracked geometry of `CHANGES SOMETHING OUTSIDE` (warning tone).
- Filter chips in Settings → Connections clearly reflect connection state without hiding valid MCP connections.

</specifics>

<deferred>
## Deferred Ideas

- Milestone "Connections & Open Platform": Full connectors catalog, OAuth flows, directory of 3rd party apps, inbound public API, chat approval model.
- Typed graph edges (`On Success`, `On Error`, `On Critical`) from xyOps grammar.

</deferred>

---

*Phase: 209-A step says what it actually does*
*Context gathered: 2026-08-26*
