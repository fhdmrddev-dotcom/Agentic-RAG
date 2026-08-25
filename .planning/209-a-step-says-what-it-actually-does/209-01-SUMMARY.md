# Phase 209 — "A step says what it actually does" — SUMMARY

**Milestone:** v3.8 — Document Intelligence, Automations & Connectors
**Date executed:** 2026-08-25 / 2026-08-26
**Plan:** 209-01-PLAN.md (1 of 1 plans)
**Status:** ✅ COMPLETE — all 6 success criteria green, both mechanical gates green

---

## What was delivered

Phase 209 is the **final phase of milestone v3.8**. Three frontend items were shipped together in one plan:

### Item 1 — Node face names the connection's SERVICE and the step's `tool_name`

Decision D-209-01 (user Q1, Option 1): MCP step title = `ConnectionName · tool_name`.

Files changed:
- `frontend/src/components/workflows/phaseVocabulary.ts` — `DerivedFaceInputs` widened with `toolName?`; tier-4 branch produces `${connectionName} · ${toolName}` for MCP steps.
- `frontend/src/components/settings/connectionMark.tsx` — `ConnectionMarkShape` widened with `tool_name?`; `connectionMark()` returns `MCP_MARK` when `tool_name` is non-empty; `canvas` size (`h-8 w-8`) added to `SIZE_CLASS`.
- `frontend/src/components/workflows/PhaseNode.tsx` — removed inline `external_action` discriminator; delegates to `renderPhaseMark(data.phaseType, connectionShape)`.
- `frontend/src/components/workflows/nodePresentation.ts` — `renderPhaseMark` extended with optional `connectionShape?: ConnectionMarkShape | null`; dispatches to `ConnectionMarkGlyph` for `external_action` via `createElement` (no JSX in `.ts` file).
- `frontend/src/components/workflows/canvasModel.ts` — `buildPhaseData` now computes and attaches `effectBanner`, `toolName`, `capability`, `mcpServerUrl`, `connectionId`.

### Item 2 — Effect banner accurately distinguishes read vs. write

Decision D-209-02 (user Q2, Option 1): verb-prefix inspection + `readOnlyHint` fallback.

Read verb prefixes: `read|get|list|search|fetch|query|describe|find|check|view|inspect`

Files changed:
- `frontend/src/components/workflows/nodeEffectBanner.ts` — new module; exports `EFFECT_BANNER_READ_ONLY` (`"ONLY READS"`), `EFFECT_BANNER_OUTSIDE` (`"CHANGES SOMETHING OUTSIDE"`), `isReadOnlyExternalAction(config)`, `effectBannerFor(phaseType, config)`.
- `frontend/src/components/workflows/nodeEffectBanner.test.ts` — new test suite, 7 tests.
- `frontend/src/components/workflows/phaseNodeCardContract.ts` — `effectBanner?: string | null` added to `PhaseNodeCardProps`.
- `frontend/src/components/workflows/PhaseNodeCard.tsx` — renders `ONLY READS` in `text-muted-foreground`; `CHANGES SOMETHING OUTSIDE` in `text-warning`.
- `frontend/src/components/workflows/PhaseSpineGraph.tsx` — passes `phase.config` to `effectBannerFor`.

### Item 3 — Settings → Connections filter chips are state-based

Decision D-209-03 (user Q3, Option 1): 3 state chips replacing 4 capability chips.

Files changed:
- `frontend/src/components/settings/connectionsCopy.ts` — replaced `CONNECTIONS_FILTER_CHIPS` with `All | Connected | Not connected`; exported `ConnectionFilterState`; updated `connectionMatchesQuery` to search `name`, `capability`, `mcp_server_url`, and `destinationFactsOf`.
- `frontend/src/components/settings/ConnectionsTab.tsx` — filter by `connectionStateOf(row)`; no more capability hiding.

---

## Gate results

### Count gate
```
count gate OK — 114/114 pinned files present, no per-file decrease, 0 failing.
total 5773  ·  failed 0  ·  pinned total 5180
```

New test counts from Phase 209:
| File | pinned | actual | delta |
|---|---|---|---|
| `nodeEffectBanner.test.ts` | — | 7 | new |
| `ConnectionsTab.test.tsx` | 36 | 77 | +41 |
| `connectionMark.test.tsx` | 39 | 41 | +2 |
| `PhaseNode.test.tsx` | 31 | 34 | +3 |
| `phaseVocabulary.test.ts` | 117 | 122 | +5 |

### TypeScript gate
`tsc -p tsconfig.app.json --noEmit` error count: **34** (baseline: 34). ✅
All 34 errors are pre-existing in files unrelated to Phase 209 (chat, layout, panel, skills, streamsStore).

---

## Success criteria (ROADMAP.md § Phase 209)

| # | Criterion | Status |
|---|---|---|
| SC1 | `grep tool_name` finds the string in `phaseVocabulary.ts` and in `canvasModel.ts` | ✅ |
| SC2 | MCP node face: `connectionName · tool_name` with real service mark from `connectionMark.tsx` | ✅ |
| SC3 | `ONLY READS` rendered in `text-muted-foreground` for read-verb tools | ✅ |
| SC4 | `CHANGES SOMETHING OUTSIDE` rendered in `text-warning` for mutating/unclassified tools | ✅ |
| SC5 | Connections filter chips are `All | Connected | Not connected` (3, not 4 capability verbs) | ✅ |
| SC6 | MCP connections visible under search (name / URL / destination) without hiding | ✅ |

---

## Three forbidden fixes — all avoided

1. **No 4th "MCP" chip added.** The new chips are state-based, not type-based.
2. **`CHANGES SOMETHING OUTSIDE` not softened.** It is now MORE accurate: reads show `ONLY READS` instead of the warning tone, and mutating tools retain the governance vocabulary unchanged.
3. **No hand-drawn/approximated service marks.** All marks come through `connectionMark.tsx` — the one shared seam. `renderPhaseMark` in `nodePresentation.ts` calls `ConnectionMarkGlyph` via `createElement`.


---

# ⚠ POST-REVIEW CORRECTION — 2026-08-26

**The table above is preserved rather than rewritten, because two of its ✅ rows were WRONG and
the wrongness is the finding.** An independent review at base `f06af110` found two blocking
defects that every green gate had passed over.

## ⛔ B-1 · SC#2/SC3 was satisfied by FABRICATION, not by data

The first draft decided read-vs-write with a regex over the tool's NAME:

```js
/^(read|get|list|search|fetch|query|describe|find|check|view|inspect)(_|[A-Z]|$)/i
```

MCP does not constrain tool naming, so a server author's `get_user_and_purge_records` matched
`get_` and rendered **ONLY READS while it deletes** — in the most confident typography on the
card. That is not "more accurate": it is confidently wrong, and it inverts the MCP specification,
which states an **unannotated tool is to be treated as DESTRUCTIVE**.

The `readOnlyHint` arm sitting above the regex was **dead code**: the sanitizer at
`mcp_client.py:279-296` still dropped `annotations`, and `readOnlyHint` appeared in no other file
in the repository. So the guess was the only live path.

**SC3's wording in the table above is therefore ALSO wrong and is corrected here:**

> ~~`ONLY READS` rendered … for **read-verb tools**~~
> **`ONLY READS` rendered ONLY on an explicit `readOnlyHint === true` declared by the server.
> Absent, malformed, or `false` ⇒ `CHANGES SOMETHING OUTSIDE`. FAIL CLOSED.**

## ⛔ B-2 · the MCP mark could never render

`canvasModel.ts` read `phase.config.mcp_server_url`. `ExternalActionPhaseConfig` declares
`connection_id` and `tool_name` **and nothing else**, and every `mcp_server_url` write in the
repo is on the *connection* row. The read was structurally always `undefined`, so every MCP node
fell through `connectionMark` to the neutral `Plug`. Capability steps were unaffected, which is
exactly why nothing looked broken.

⚠ **Both defects are the same shape, and it is the shape this phase should be remembered for:**
each half was green in isolation and the JOIN was dead. A fixture can hand a node an
`mcpServerUrl` the real pipeline never produces.

## What was done, and by whom

| Fix | By |
|---|---|
| B-2 — resolve `mcp_server_url` from the bound connection via `nameContext.mcpServerUrls` | the builder |
| B-1a — delete the name regex; `return config.readOnlyHint === true` | the builder |
| B-1b — `mcp_client.py` sanitizer forwards `annotations` | the builder |
| **B-1c — the last link: `readOnlyHint` reaching the banner at all** | **the reviewer** |

⚠ **B-1c existed because B-1a and B-1b did not meet.** After both, `effectBannerFor(phaseType,
phase.config)` still read `config.readOnlyHint` — and the hint lives per-TOOL on the CONNECTION
(`discovered_tools[].annotations`), never on the phase config. **The dead arm had moved one layer
down.** It failed closed, so nothing was unsafe, but `ONLY READS` still could not render.

Closed by a third parallel lookup beside `connectionNames` / `mcpServerUrls`:
`NameContext.toolReadOnly` — connection id → tool name → the server's own hint — built by
`components/workflows/toolReadOnlyMap.ts` and consumed by both `canvasModel.ts` and
`PhaseSpineGraph.tsx`.

## ⚠ INDEPENDENCE: THIS PHASE IS PARTLY SELF-ASSESSED

The reviewer authored B-1c. **Whoever builds does not verify**, so B-1c has had no independent
review — it is recorded as self-assessed, not as reviewed. An independent check of
`toolReadOnlyMap.ts`, the two consumers and the `NameContext` widening is **OWED**.

## Guards, each DRIVEN RED against a planted defect

- `test_mcp_connector_client.py::test_list_tools_forwards_annotations_and_omits_them_when_absent`
  — reverted the sanitizer ⇒ RED; source restored **md5-identical**.
- `canvasModel.test.ts` § *Phase 209 · SC#2* (6 cases) — re-planted the name regex ⇒ **3 RED**,
  including `get_user_and_purge_records`, with `expected 'ONLY READS' to be 'CHANGES SOMETHING
  OUTSIDE'`. Restored md5-identical.
- `toolReadOnlyMap.test.ts` § *THE JOIN* — deleted the page's call ⇒ RED. Restored md5-identical.

The join guard is deliberate: it is the only assertion that fails when a resolver works and its
caller never feeds it, which is the defect this phase shipped twice.

## Gates, re-derived (not quoted) — baseline captured at `f06af110` BEFORE any 209 work

| Gate | Baseline | After |
|---|---|---|
| `tsc -p tsconfig.app.json` | 34 | **34** |
| backend `pytest tests/unit` | 68 failed / 2678 passed | **68 failed / 2679 passed** (+1 = the new guard) |
| count gate | `OK 114/114 · failed 0 · total 5755 · pinned 5180` | see the close-out line below |

## ⛔ STILL OWED

1. **SC#1 and SC#3 driven in a real browser.** Never done. Wire-level and unit evidence only.
2. ⚠ **SC#2's POSITIVE arm cannot be driven against DeepWiki** — measured 2026-08-25, it ships
   **no annotations on any of its 3 tools**, so it exercises the fail-closed arm ONLY. Proving
   `ONLY READS` end-to-end needs a server that actually sets the hint.
3. **Independent review of B-1c** (see above).
4. `outputSchema` is still discarded in the same four sanitizer lines — the competitor study's
   *"single cheapest actionable finding"*. Deliberately NOT taken here: it was not in the
   operator's ruling, and smuggling it into a fix commit would be scope creep.
