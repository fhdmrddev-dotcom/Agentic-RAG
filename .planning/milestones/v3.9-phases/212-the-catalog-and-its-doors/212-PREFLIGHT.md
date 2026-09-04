---
type: preflight-review
phase: 212
phase_name: "The Catalog and Its Doors"
builder: gemini
reviewer: claude
reviewed_at: 2026-08-27
tree_state: clean at `a239b693` — reviewed BEFORE any 212 execution commit
plans_reviewed: [212-01, 212-02, 212-03, 212-04, 212-05]
---

# Phase 212 — pre-flight review

**What this is.** `AGENTS.md §3.1`: on an ordinary phase Gemini builds and Claude reviews —
`NNN-PREFLIGHT.md` **before** execution, then a driven check after. Phase 212 stayed Gemini's on the
operator's `BUS-012` ruling; `212-01`'s egress work is his too.

⚠ **This is a review, not a replan.** Every item below is a finding with the command or file that
produced it. What to do about each is the builder's call.

⚠ **The Phase 204 lesson is the reason this file has a §1.** That pre-flight caught three gaps and
**missed both defects that reached the operator — and both were SEAMS between parallel plans, each
side individually green.** So §1 is the cross-plan seam audit and it comes first.

**Severity key:** ⛔ blocking · ⚠ major · ▪ minor · ✅ verified-good.

---

## 1 · Cross-plan seam audit

### ⛔ S-1 — `discoverConnectorTools` ALREADY EXISTS, with a different signature and a live caller

`212-02-03` says *"Implement `discoverConnectorTools(payload: McpDiscoverRequest):
Promise<McpDiscoverResponse>`"*. That function is already shipped:

```
frontend/src/lib/api/connectors.ts:219
  export async function discoverConnectorTools(id: string): Promise<McpDiscoveredTool[]>
    → POST /connectors/connections/{id}/discover        (a SAVED connection, by id)
```

and it has a live consumer:

```
frontend/src/components/workflows/McpToolPicker.tsx:39
  import type { ConnectorConnection, McpDiscoveredTool } from "@/lib/api"
frontend/src/components/workflows/McpToolPicker.tsx:210-232
  const [localDiscoveredTools, setLocalDiscoveredTools] = useState<McpDiscoveredTool[] | null>(...)
```

**Two different operations are being given one name.** The shipped one discovers from a connection
that already exists; `212-01`'s new `POST /api/connectors/discover-tools` discovers from a URL
*before* anything is saved. Writing the new one over the old one either **breaks `McpToolPicker`**
(shipped in 206.2, its G-5 row honoured by construction at 211) or shadows it silently.

`212-05`'s barrel test would not catch this — a barrel that re-exports one symbol of the right name
passes either way.

### ⚠ S-2 — the type `DiscoveredTool` does not exist

`212-02-03` types the response as `tools: DiscoveredTool[]`. `grep -rn "DiscoveredTool" frontend/src`
returns **only `McpDiscoveredTool`**, already exported from `@/lib/api` and already consumed. No plan
lists `frontend/src/types/index.ts` in `files_modified`, so nothing creates `DiscoveredTool`.

### ⚠ S-3 — the discover-tools wire contract is written, typed and consumed in three different plans, and NO test mocks neither side

This is the Phase 204 shape exactly.

| | plan | wave | owns |
|---|---|---|---|
| writes | `212-01` | 1 | `POST /api/connectors/discover-tools` → `{server_url, tools, count}` |
| types | `212-02` | 2 | `McpDiscoverResponse { server_url, tools, count }` |
| consumes | `212-03` | 3 | `discoveredPreview`, the schema viewer |

`212-01-03`'s tests mock the frontend away. `212-03-03`'s tests mock `discoverConnectorTools` away.
**Neither plan owns a test that exercises both sides of the join**, and `212-05` adds a barrel test,
not an integration test. Phase 204 shipped a spend cap that never armed with **106 tests green**
because each wave mocked the other's side; the columns were `inputs` vs `metadata` and nothing looked
at both.

Name the exact key on both sides — `server_url`, `tools`, `count` — and confirm they match in one
test that mocks neither.

### ▪ S-4 — `starterPrompts` is authored and consumed by nothing

`212-02-01` has each catalog entry declare `starterPrompts`. No plan reads them. `CAT-04` (starter
prompts) is **not** in this phase's requirement set and the ROADMAP puts it in Phase 216, with the
stated reason that *"a starter prompt is only truthful once the agent can act on it"*. Built, gated,
green and unreachable is the Phase 118 / Phase 200 shape.

---

## 2 · Security and reachability

### ⚠ SEC-1 — the new egress endpoint carries no `require_visible("live_connectors")`

Every existing connector **write** carries the kill switch, per endpoint and never on the router:

```
backend/app/api/connectors.py:391, 427, 469, 493
  dependencies=[Depends(require_visible("live_connectors"))],  # D-26 — per endpoint, never on the router
  current_user: dict = Depends(require_org_manage),
```

`212-01-02` specifies only *"protected by `require_org_admin` (or `require_org_manage`)"* and names
no `require_visible`. **`/discover-tools` opens a socket to an operator-supplied address**, which is
at least as write-shaped as the four endpoints that do carry it. As planned it would sit **outside
the kill switch Phase 210 shipped three days ago**, and `main.py:782` records the invariant as
*"per-endpoint `require_visible("live_connectors")` on the writes ONLY (never router-level)"*.

### ⚠ SEC-2 — two security must_haves contain an "or"

`212-01` `must_haves.truths`:

- *"sets `trust_env=False`, **`follow_redirects=False` (or validated redirect hop)**"*
- *"protected by **`require_org_admin` (or `require_org_manage`)**"*

A must_have with an escape hatch is satisfiable both ways, and one of those ways ships a redirect
follower on the SSRF boundary. `egress.send_pinned_http` — the sibling path that already passed a
credential/egress review — sets `follow_redirects=False` flatly (`egress.py:647`). The ROADMAP names
*"redirect chasing"* as a named threat for this door.

### ⚠ REACH-1 — the cloud banner points org admins at a route only operators can open

`212-04-02`: *"If `isOrgAdmin` is true, render direct action button/link to Control Room (`/admin` →
Feature Visibility) to flip `live_connectors`."*

`/admin` is **router-level `require_operator`** (`backend/app/api/admin.py:3` — *"Every route here
inherits the router-level `require_operator` gate"*), and Phase 146's gate is a **byte-identical
404**. An org admin who is not an operator follows that link into a 404 that cannot explain itself.
`isOrgAdmin` and *is an operator* are different predicates.

This is the SC#3 half of `BUG-260810-01`, so the arm that fails is the one the bug was filed for.

---

## 3 · Against the approved sketch

The operator ruled on `BUS-013`: the sketch
(`.planning/sketches/203-the-catalog-at-density/index.html`) is the G-2 bar, and where it and
`212-UI-SPEC.md` disagree, **the sketch wins**. Two plan items disagree with it.

### ⚠ SKETCH-1 — Popular as a separate card grid vs Popular inside the list

`212-04-01`: *"Render the top 'Popular Services' card grid … Render the main searchable directory
list **below** the popular section."*

The sketch renders Popular as a **group header inside the same list** every other service lives in.
ROADMAP SC#3 words it the same way: *"connects one of the curated Popular services in one click,
**from the same list every other service lives in**."* A grid above a list is two surfaces.

### ⚠ SKETCH-2 — an "available tools badge" on a service that is not connected is a number we cannot know

`212-04-01`: *"showing each service's … configured instances count badge … **available tools badge**
…"*.

For a catalog service with **zero** configured connections there are no discovered tools — nothing
has been contacted. Live counts today are `1, 1, 3` (`discovered_tools` on the three real rows). The
design system's honesty rule is *"Never draw a number the system cannot know"*, and the measurement
pack §7.1 records the real figures precisely so a flattering badge cannot slip in.

### ▪ SKETCH-3 — provenance vs state

Not a plan defect; a regression risk the sketch exists to prevent. The Stitch density render put
`Uncurated` **in the State column** in place of `Connected`, so a reader could not tell whether
`deepwiki` was connected. Sketch §3 is a four-row matrix holding the two axes apart. A row that
collapses them has regressed.

---

## 4 · Gates

### ⚠ GATE-1 — the two new frontend test files are planned UNGATED, and `212-05` asserts they are not

New suites created by this phase:

- `frontend/src/components/settings/__tests__/servicesCatalog.test.ts` (`212-02`)
- `frontend/src/lib/__tests__/apiBarrel.test.ts` (`212-05`)

**No plan lists `scripts/vitest-count-gate.cjs` in `files_modified`**, and `212-05-03` verifies:

> *"`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` → verify OK, **116/116 pinned
> files**, 0 failed."*

`116/116` is the baseline measured on the untouched tree. Written that way the criterion **passes
precisely because the new suites were never pinned**. Measurement pack §1.3: `src/components/settings/`
is pinned FILE-LEVEL only — four entries, no bare-directory entry — so a new file there is invisible
to the gate until added to `TARGETS` by hand. `src/lib/` has one pinned entry across twelve domain
modules.

Both suites would pass, and neither would be watched.

### ▪ GATE-2 — `tsc <= 34` and `rot set <= 68` are the right shape

`212-05-03`'s thresholds match the re-derived baselines (`34`, `68 failed / 2788 passed`). ✅
One note: `212-05-03` says *"0 connector failures"* — correct and checkable, since all six
connector/MCP test files are green at HEAD (measurement pack §1.4), so a red there is caused.

---

## 5 · Ledger

### ✅ LEDGER-1 — `212-05-02` re-derives the four stale rows

The four G-5 rows this phase touches are all understated in `CLAUDE.md` today
(`ConnectionsTab.tsx` `8/3/1223` → measured `9/4/1218`; `ConnectionFormPanel.tsx` `5/3/1758` →
`7/4/1889`; `connectionsCopy.ts` `4/3/541` → `6/5/571`; `connectionFormCopy.ts` `4/3/759` →
`5/4/966`). `212-05-02` re-derives from git rather than editing the cells. Correct.

### ▪ LEDGER-2 — `SettingsPage.tsx` / `ModelPillRow.tsx` rows are a bonus, not a discharge

`212-05-02` adds ledger rows for both. **Neither appears in any plan's `files_modified`**, so the
recorded re-open trigger — *"the next phase whose `files_modified` names either of them"* — has **not
fired**. Adding the rows closes a real blind spot (`SettingsPage.tsx` measures `34 / 21 / 1426` and
has been invisible to G-5 for its whole life) and is worth doing. It should read as *closing a known
gap*, not as *discharging a trigger*, or the next auditor will believe a trigger fired that did not.

### ▪ LEDGER-3 — new files owe rows at their third phase

`servicesCatalog.ts` and `catalogCopy.ts` are created here at 1 phase. `connectionRefusalCopy.ts`
(`1 / 1 / 567`), `lib/api/connectors.ts`, and the three under `backend/app/services/connectors/`
have neither a `CLAUDE.md` row nor a detail section today.

---

## 6 · Verified good

- ✅ **`outputSchema` is really in the sanitizer.** `212-01`'s claim that discovery sanitizes with
  `title, description, inputSchema, outputSchema` checks out — Phase 211 (D-211-09) widened the
  allow-list, `mcp_client.py:306-328`. The list is **widened, not removed**, which is the rule.
- ✅ **Filter chips are state-only in both `212-04` and its tests**, and `212-04-03` asserts the
  *absence* of verb chips rather than only the presence of the three. `CAT-03` and `SEED-207` hold.
- ✅ **`212-03`'s grant merge defaults newly discovered tools to ungranted** — fail-closed, and it
  preserves existing decisions, which is `CONN-07` and the *"do not regress the per-tool grain"*
  instruction.
- ✅ **Wave shape is sound.** `212-01` has `depends_on: []` and is unblocked now; `212-03` and
  `212-04` correctly both depend on `212-02` and can run in parallel.
- ✅ **`212-01` fixes `mcp_client.py:220` properly** — threadpooled validation, the
  `PinnedDestination` actually consumed for the IP-literal rewrite, `Host` preserved for SNI. That is
  the shape `egress.send_pinned_http` already uses and it closes the D-v2.5-01 violation the ROADMAP
  names.

---

## 7 · What I could not check

- **Nothing was driven.** This is a read of five plans against the tree at `a239b693`; no code exists
  yet.
- **The cloud install was not measured.** `BUG-260810-01` reproduces on `production` at `5d5ea200`;
  everything here is local, on an install whose `live_connectors` is flipped to `everyone` against a
  cold default of `off`.
- **The `Sends to` tension is unresolved and is not a defect.** The locked column prints a host with
  the always-on 🔒 (024-A) while the catalog language says a person adds Slack without learning what
  a protocol is. Both are deliberate. Named in the sketch §6 as a question for the builder.

---

## 8 · After execution

Per `AGENTS.md §3.1` I owe a **driven** check, not a re-read: the gate verdicts read verbatim rather
than summarised, the seam in §1 exercised end to end, and every new surface in §2 reached in a
browser rather than asserted. `/code-review ultra` remains the operator's independent gate on
`212-01` and is the real one there.

Two items from Phase 211 are still owed and unrelated to this phase:
`/code-review ultra review-210-211-base`, and 211's five per-shape UAT rows (row 3, SMTP, ⛔ blocked —
no such connection exists on this install).
