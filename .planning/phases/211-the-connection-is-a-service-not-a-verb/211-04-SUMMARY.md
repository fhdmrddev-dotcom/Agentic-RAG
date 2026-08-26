---
phase: 211-the-connection-is-a-service-not-a-verb
plan: 04
subsystem: frontend
tags: [connectors, workflows, node-form, render-gate, reachability, vocabulary]

requires:
  - phase: 211-01
    provides: "the static descriptor — `name` / `title` / `description` / `inputSchema` — that a first-party capability connection advertises, and the two-key-wider sanitizer that lets `title` reach the wire"
  - phase: 211-02
    provides: "`service_id` as a REQUIRED member of `ConnectorConnection`, the widened `McpDiscoveredTool` (`title` / `outputSchema`), migration 127's backfill of `discovered_tools` on both capability rows, and the capability arm of `POST /connections/{id}/discover`"
  - phase: 206.2
    provides: "the two-legged reachability guard, the `McpToolPicker` grant surface, and the shape axis this plan removes"
provides:
  - "an action card that renders for EVERY bound shape, whose tool list gates on `tools` and whose card gates on a bound connection"
  - "an un-gated Refresh affordance — the only caller of the discover route, now reachable on both shapes"
  - "one unscoped `listConnectorConnections()` read listing every connection in the org, of every shape"
  - "a node form that asks one question, then one question — no verb category anywhere"
  - "a step that writes exactly one of `capability` / `tool_name`, never both and never by default"
  - "leg (b) of the reachability guard re-pointed at the new chain, with POSITIVE CONTROL 2 INVERTED"
affects: [211-05, 212, 214]

tech-stack:
  added: []
  patterns:
    - "A conflated render gate is SPLIT into the decisions it was making, never re-pointed at a different single field — the card asks *are we bound?*, the list asks *is there a list?*"
    - "A repair affordance is never gated on the state it repairs; the empty list keeps the control that fills it"
    - "A control whose criterion has been inverted is INVERTED, never deleted — a green control over a false criterion reads as coverage"
    - "A `?raw` self-swept fence assembles BOTH its needle and its positive control at runtime; spelling either makes the fence count itself"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/McpToolPicker.tsx
    - frontend/src/components/workflows/McpToolPicker.test.tsx
    - frontend/src/components/workflows/ConnectionPicker.tsx
    - frontend/src/components/workflows/ConnectionPicker.test.tsx
    - frontend/src/components/workflows/ExternalActionSection.tsx
    - frontend/src/components/workflows/ExternalActionSection.test.tsx
    - frontend/src/components/workflows/externalShapeVocabulary.ts
    - frontend/src/components/workflows/McpToolPicker.reachability.test.tsx

decisions:
  - "BOTH `capability` and `shape` props were REMOVED from `ConnectionPicker` — nothing pre-selects any more, so keeping either would have been a parameter no call site could justify"
  - "`CONNECTION_PICKER_NO_MCP_NOTE` retired in favour of `noConnectionYetNote(\"\")`, which puts the shipped WR-04 `own()` fallback on the LIVE path rather than leaving it a dead safety net"
  - "`CONNECTION_PICKER_MCP_ALL_DISABLED` renamed to `CONNECTION_PICKER_ALL_DISABLED` — one list has one vocabulary"
  - "[Rule 2] a new `grantsEnforced` prop, because the executor reads `tool_grants` only inside its remote-server branch and the newly-rendering card would otherwise state a refusal that never happens"
  - "`service_id` is rendered VERBATIM in the option label; D-211-02 puts the curated presentation lookup in Phase 212 and inventing one here would be that phase's work without its review"
  - "AR-04's asymmetry is DISCHARGED on its own recorded re-open trigger — `data-empty-reason` now reaches every shape"
  - "The D-206.2-08 byte-identity baseline is RETIRED, not re-captured: three deliberate changes move those bytes, and re-capturing from new code turns a baseline into a statement about nothing"

metrics:
  duration: ~95min
  tasks: 3
  commits: 3
  completed: 2026-08-26

requirements-completed: [CONN-04, CONN-05]
---

# Phase 211 Plan 04: The Verb Stops Being an Axis Summary

**A first-party capability connection's own action is now reachable in the node form — the card gates on a bound connection instead of on a remote-server URL, one unscoped read lists every shape in one list, and the two radiogroups that made an author classify their intent before seeing a single connection are gone.**

## Performance

- **Duration:** ~95 min
- **Tasks:** 3 / 3
- **Files modified:** 8 · **Files created:** 0
- **Commits:** 3

## Commits

| Task | Commit | Subject |
| --- | --- | --- |
| 1 | `f2c7c661` | `feat(211-04): the action card renders for EVERY bound shape` |
| 2 | `1635b07b` | `feat(211-04): one unscoped read — every shape in one list` |
| 3 | `5ec507ec` | `feat(211-04): the browse axis goes — one question, then one question` |

## Gate numbers, verbatim

**tsc (`-p tsconfig.app.json` — the flag is load-bearing; a bare `--noEmit` checks ZERO files):**

| | count | note |
| --- | --- | --- |
| baseline at this plan's base | **39** | the orchestrator's measured figure, not the plan's stale `34` |
| this plan's own error | **1** | `src/components/workflows/McpToolPicker.test.tsx` — the fixture lacked 211-02's REQUIRED `service_id` |
| after Task 1 | **38** | closed by SATISFYING the contract (`service_id: "atlassian"`), never by softening it to `service_id?` |
| after Tasks 2 and 3 | **38** | unchanged — no new error introduced by the rewrite |

The remaining 38 include 211-03's four settings-file errors, which are that plan's to close.

**In-scope suites, all four green:**

```
 Test Files  4 passed (4)
      Tests  140 passed (140)
```

**Whole `src/components/workflows` directory:**

```
 Test Files  85 passed (85)
      Tests  4287 passed (4287)
```

**The whole-tree count gate, verdict line read verbatim rather than summarised:**

```
  ConnectionPicker.test.tsx                    58      58       0
  McpToolPicker.test.tsx                       29      39     +10
  ExternalActionSection.test.tsx               25      30      +5
  McpToolPicker.reachability.test.tsx          11      13      +2
  total                                      5180    5781    +601
  total 5781  ·  failed 0  ·  pinned total 5180
count gate OK — 114/114 pinned files present, no per-file decrease, 0 failing.
```

⚠ **THE GRAND TOTAL FELL AGAINST THE PLAN'S RECORDED BASELINE, AND IT IS THIS PLAN'S DOING —
recorded here rather than left for someone to notice.** `211-04-PLAN.md`'s `<interfaces>` block
records `total 5793`; today reads **5781**. The arithmetic, so the drop is attributable rather
than mysterious:

| suite | before | after | delta |
| --- | ---: | ---: | ---: |
| `ExternalActionSection.test.tsx` | 59 | 30 | **−29** |
| `McpToolPicker.test.tsx` | 29 | 39 | +10 |
| `McpToolPicker.reachability.test.tsx` | 11 | 13 | +2 |
| `ConnectionPicker.test.tsx` | 58 | 58 | 0 |
| **net** | | | **−17** |

The `−29` is the deliberate half: 206.2 and 189 between them spent twenty-nine cases DRIVING two
radiogroups this plan deletes, and a case that drives a control which no longer exists is not
coverage. **Every per-file PIN is met or exceeded** (58/58, 39/29, 30/25, 13/11), which is the
gate's actual contract — *no per-file decrease and zero failing, never a fixed grand total.* The
residual between `5793 − 17 = 5776` and the measured `5781` is other plans' work landing on the
base since the plan was written, and is not attributable to this one.

## Task 1 — the render-gate split (`f2c7c661`)

### The RED, verbatim, driven against HEAD's early return

Required by the plan's `<output>`. The legacy-empty case was written and run BEFORE any source
edit, against `if (!connection?.mcp_server_url) return null`:

```
 FAIL  src/components/workflows/McpToolPicker.test.tsx > 211-04 · the action card renders for EVERY bound shape (D-211-12) > ⭐ LEGACY + EMPTY LIST — the card, the sentence AND an enabled Refresh control
TestingLibraryElementError: Unable to find an element by: [data-testid="mcp-tool-picker"]

Ignored nodes: comments, script, style
<body>
  <div />
</body>
 ❯ src/components/workflows/McpToolPicker.test.tsx:606:19
    604|     // no backfill, still produces today.
    605|     render(<McpToolPicker connection={legacyConnection} toolName="" />)
    606|     expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
       |                   ^

 Test Files  1 failed (1)
      Tests  1 failed | 38 skipped (39)
```

The full RED run of the block read **`Tests 10 failed | 29 passed (39)`** — the ten new cases, and
not one of the twenty-nine shipped ones.

### The three gates, and the one that is deliberately absent

| gate | keys on | why |
| --- | --- | --- |
| the CARD | `!connection?.id` | the component is only ever mounted after an author has chosen a connection, so *are we bound?* is the honest question |
| the TOOL LIST | `tools.length === 0` | unchanged from HEAD; `tools` already fell back to `connection?.discovered_tools ?? []`, so a legacy row's descriptor renders with no other change |
| the REFRESH control | audience only (`admin` / `no-provider`) | **NO shape condition was added.** This is what makes 211-02's capability arm of `discover_connection_tools` reachable at all — `handleDiscover` is that route's only caller in the entire product |

**The naive gate is refused in writing at the site.** `discovered_tools.length > 0 → else null`
reads like the honest form of D-211-12 and closes a loop with no way out: empty list → card
returns null → the Refresh control (which lives BELOW the early return) never renders → nothing
can populate the list. It would also regress the MCP path, where a brand-new connection
legitimately starts at `[]`.

### The shipped MCP-empty Discover case was NOT rewritten

Required by the plan's `<output>`, stated explicitly: **`discovers tools when Discover Tools
button is clicked` (the case that mounts `{...mockMcpConnection, discovered_tools: []}` and
asserts the Discover button is present and clickable) was NOT rewritten.** Its only change is the
expected CONSTANT — it asserts `toHaveTextContent(MCP_DISCOVER_BUTTON_LABEL)`, an imported
identifier, so the copy change moved the value under it and not one line of the assertion's shape.
The same is true of `MEMBER — the discover-shaped empty note is replaced`, which reads
`MCP_NO_TOOLS_ADMIN_ONLY` by name.

### Copy: values changed, identifiers and test ids did not

`git diff frontend/src/components/workflows/McpToolPicker.tsx | grep -cE '^[-+]\s*data-testid='`
→ **0**. (The looser `grep -cE '^[-+].*data-testid'` returns 1, and that one line is the new
docblock's PROSE promising the ids do not move.)

| identifier | before | after |
| --- | --- | --- |
| `MCP_TOOL_PICKER_HEADING` | `MCP Tool & Action` | `What this connection can do` |
| `MCP_DISCOVER_BUTTON_LABEL` | `Discover Tools` | `Refresh actions` |
| `MCP_DISCOVERING_LABEL` | `Discovering tools…` | `Refreshing…` |
| `MCP_TOOL_SELECT_LABEL` | `Select Tool` | `Action` |
| `MCP_TOOL_NONE_OPTION` | `— choose a tool —` | `— choose an action —` |
| `MCP_NO_TOOLS_DISCOVERED` | "…Click Discover Tools to fetch available actions from the remote server." | "No actions listed for this connection yet. Refresh to fetch what it offers." |
| `MCP_NO_TOOLS_ADMIN_ONLY` | "…fetched from this server yet…" | "No actions have been listed for this connection yet. Only an organisation admin can refresh them." |

The option LABEL is now `t.title || t.name` — the first consumer anywhere of the `title` key plan
211-01 widened the sanitizer for. `||` rather than `??` deliberately: the sanitizer omits the key
for a blank, but a `title: ""` arriving by any other route must still fall through to the name.

### D-211-10 untouched

`git diff --numstat frontend/src/components/workflows/toolReadOnlyMap.ts
frontend/src/components/workflows/toolReadOnlyMap.test.ts` prints **nothing**, and its 7 cases run
green inside the Task-1 verification command.

## Task 2 — one unscoped read (`1635b07b`)

### Was the `capability` prop kept or removed? — REMOVED, with both props

Required by the plan's `<output>`. **Both `capability` and `shape` were removed, and
`ConnectionPickerProps` was deleted entirely; the component now takes no props at all.**

The reason is that Task 2(c)'s condition — *"keep `capability` only if a call site still needs to
pre-select"* — is measurably false after Task 3: the section renders `<ConnectionPicker />` and
nothing pre-selects anything. Keeping the prop would have left a parameter no caller could
justify, and `requestKey` simplifies from `${shape}::${slug}::${capability}` to the slug alone,
because the step is now the only thing that can make a settled answer stale.

The single blocking consequence — `ExternalActionSection.tsx` passing the removed props — was
fixed inline in the same commit as a two-line touch (deviation Rule 3, below).

### What went, and what replaced it

- `listConnectorConnections(capability)` → `listConnectorConnections()`.
  `grep -c "listConnectorConnections(capability)"` → **0**. The server-side `?capability=`
  parameter and `api.ts`'s signature are UNCHANGED (211-02's recorded decision, RESEARCH Open
  Question 3) — this is a call-site change only, and `frontend/src/lib/` is byte-untouched.
- `rows.filter(row => Boolean(row.mcp_server_url))` → deleted.
  `grep -vE '^\s*(//|\*|/\*)' … | grep -c "row.mcp_server_url"` → **0**.
- `is_enabled` KEPT. The shipped comment explaining the ORDER of two filters is **rewritten**, not
  left describing a filter that no longer exists: `shapedCount` became `totalCount`, taken from
  the RAW response, and the comment now says what that count means.
- `bound?.mcp_server_url && <McpToolPicker …>` → `bound !== undefined && <McpToolPicker …>`.
  This was one of RESEARCH §A.6's eight readers and is the second half of the D-211-12 fix; the
  card gate in Task 1 alone would not have made a first-party row's card render, because its
  parent never mounted it.

### Each deleted `ConnectionPicker.test.tsx` case, with its replacement

| deleted (obsolete BY DESIGN) | replacement |
| --- | --- |
| `2 · NONE EXIST — the plain capability word, and NO link` (a three-capability loop over `noConnectionYetNote(capability)`) | `2 · NONE EXIST — one shape-neutral sentence, and NO link` + `2b · ROWS EXIST BUT ALL DISABLED` |
| the **12 generated** `the ${key} picker in state ${state} is byte-identical to 206.2-02's base` | §7's per-fixture structural cases (`${key} · UNBOUND` and `${key} · BOUND-FAILING`, now over FOUR fixtures including the MCP row) |
| marker `every bound capture holds the label, the — none — option and the 🔒 footer` | the `UNBOUND` structural cases, which assert the same three against a LIVE render |
| marker `the POST_MESSAGE capture named Slack's code-constant host` | `4b · the same 🔒 shape for a ticket and for Slack's code-constant host` (already live) + §10's `POSITIVE CONTROL — the four known shapes still name their destinations` |
| marker `every bound-failing capture holds the refusal wired by aria-describedby` | the `BOUND-FAILING` structural cases |
| marker `⚠ NO capability capture carries data-empty-reason — AR-04's asymmetry, at the baseline` | the asymmetry is DISCHARGED; `2 · NONE EXIST` and `2b` both assert the attribute is present and distinguishable |
| `POSITIVE CONTROL — the capability shape still passes its capability` | `⭐ THERE IS NO SECOND ARM — every render issues the same zero-argument read` (three configurations, every call asserted `[]`) |
| `SC#1b — neither shape lists the other's rows, from ONE org holding both` | `⭐ SC#3 — an MCP row and a capability row appear in the SAME list from ONE read` |
| `a provider-less render opens NO request in the MCP shape either` | folded into §1's single disconnected case — there is one shape of render now |
| `the MCP shape keeps the read-failure reading` | `the read failure reading survives — four facts stay four` |
| `no MCP row at all ⇒ data-empty-reason="none" and its own sentence` | `2 · NONE EXIST` |
| `MCP rows exist but every one is switched off ⇒ a DIFFERENT sentence` | `2b · ROWS EXIST BUT ALL DISABLED` |
| `the two sentences are really different, and neither is the capability sentence` | `the two sentences are really different, and both are distinguishable by reason` |
| `⚠ THE FILTER ORDER — a disabled SLACK row does NOT make the MCP shape say all-disabled` | `⚠ THE COUNT IS TAKEN BEFORE THE FILTER` — there is one filter now, so what is left to get wrong is counting after it |
| `NON-VACUITY CONTROL for AR-04 — the capability shape's empty node has NO such attribute` | obsolete: the asymmetry is gone, and its inverse is asserted in `2 · NONE EXIST` |
| `the WR-04 conversion changed no rendered word, and the inherited key now falls back` | `the WR-04 inherited-key read still falls back rather than stringifying a function`, which also pins the three capability words CONN-05 keeps |
| `NEGATIVE CONTROL — a bound CAPABILITY row mounts no tool picker` | **INVERTED** → `⭐ INVERTED — binding a CAPABILITY row NOW renders the card, over its own action list` |
| `` `api.ts` is not consulted for a new export `` (asserted BOTH call forms present) | `⭐ the read is UNSCOPED at source — no capability argument survives` |

**Added, with no shipped counterpart:** §12's five action-write cases (`tool_name` arm,
`capability` arm, no-default, never-both sweep, re-bind clear), `⭐ THE CLIENT-SIDE SHAPE FILTER
IS GONE — a URL-less row is still OFFERED`, `⚠ NO RAW WIRE ID reaches the DOM…`,
`optionLabelOf names the SERVICE and the NAME`, `⭐ A LEGACY ROW WITH AN EMPTY ACTION LIST still
gets its card and its Refresh`, and `⚠ THE GRANT SURFACE FOLLOWS THE SERVER'S GATE, not the card`.

### T6's key set grew by three, and the threat did not

`bind()` now emits `{connection_id, capability: undefined, tool_name: undefined, tool_args:
undefined}`. D-13 forbids a HOST, a port, an account or a token crossing into `definition`; the
three added keys are the step's OWN action fields. The sweep keeps its `secret|token|password|
host|base_url` regex, keeps its value check, and keeps **SET EQUALITY** — its in-line plant now
also proves a PARTIAL clear throws.

The reason the clear moved here is named: 206.2 put it on the shape control, and Task 3 deletes
that control, so **re-binding is the only remaining moment at which a step's shape can change.**
AR-05's hazard (a stranded `tool_name` silently turning a first-party step into a remote one) would
otherwise have evaporated with the control that used to answer it.

## Task 3 — the browse axis goes (`5ec507ec`)

### The five (in fact seven) `=== 3` assertions, each with its replacement

The shipped docblock singled out *"five shipped assertions pin the capability group's children at
exactly three"*. All seven occurrences are named, because a count that was wrong in the docblock
should not be carried forward:

| # | deleted assertion (file line at base) | replacement |
| --- | --- | --- |
| 1 | `:85` `expect(options()).toHaveLength(3)` in *nothing chosen: three unselected rows under the heading, plus the honest note* | `⭐ NEITHER deleted radiogroup exists` + `⚠ UNSET derives nothing and says so` (the honest note is still asserted) |
| 2 | `:107` `expect(options()).toHaveLength(3)` in *an UNRECOGNISED stored value selects NO row and fabricates nothing (T-189-39)* | `an UNRECOGNISED stored value derives NOTHING and fabricates nothing (T-189-39)` — the threat is kept, the control it drove is not |
| 3 | `:122` `expect(screen.getAllByTestId("external-action-option")).toHaveLength(3)` in *an INHERITED key selects no row either* | `an INHERITED key derives nothing either — constructor is not a capability` |
| 4 | `:134` same, in *the section RENDERS in every state it can reach* | `the section RENDERS in every state it can reach — never an empty branch`, now asserting the PICKER is present in each |
| 5 | `:181` `expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3)` in *is a single-choice group* | `⭐ NEITHER deleted radiogroup exists` — `queryAllByRole("radiogroup")` is now **0** |
| 6 | `:524` `expect(capabilityGroup.querySelectorAll('[role="radio"]')).toHaveLength(3)` in *THE TWO GROUPS ARE DISJOINT* | same — there are no groups to be disjoint |
| 7 | `:623` same, in *under UNSET and CAPABILITY the capability radiogroup is PRESENT — the five pins' reason* | `⭐ ONE QUESTION, THEN ONE QUESTION — the picker is the section's only control` |

**The headline replacement is neither of those, and it is the one that matters:**
`⭐ NO role=radio carries any of the three category sentences, in ANY state` — SC#3's own wording,
driven over five prop states, asserted on the ACCESSIBLE NAME rather than a test id, because a
future control could reintroduce the offer under any id at all.

Other deleted behaviour cases in that file, each obsolete by design: the whole *choosing a
capability* block (3 cases) and the whole *the radiogroup behaves like one (WR-04)* block (9
cases) drove the deleted rows — replaced by `⭐ NEITHER capability NOR tool_name is written by
this component, in any state`, which pins the write having MOVED rather than disappeared; the four
*shape control* cases and the six *three derived states* cases that pressed segments — replaced by
the six derivation cases that read the same `data-shape` from props only; and `⚠ UNSET renders
BYTE-IDENTICALLY to today's empty-capability render` plus the two multi-key-patch blocks
(§9 and §10, 7 cases), which drove a control that is gone — the patch behaviour they asserted is
now driven end-to-end in `ConnectionPicker.test.tsx` §12 and in leg (b).

### The mirror and its fence are KEPT — that is the assertion

`grep -c "EXTERNAL_ACTION_CAPABILITIES" frontend/src/components/workflows/ExternalActionSection.tsx`
→ **3**. The D-23 cross-language block (§7 of the rewritten suite) is byte-unchanged apart from one
word in a case title, and `git diff --numstat frontend/src/components/workflows/phaseVocabulary.ts`
prints **nothing** — the node-face vocabulary stays.

A case was ADDED to stop the fence becoming a kept corpse:
`⚠ the mirror still has a LIVE consumer in the component — it is not a kept corpse`, asserting the
source contains `EXTERNAL_ACTION_CAPABILITIES.includes(capability)`. Retiring a guard while
"demoting" the thing it guards is this phase's named anti-pattern; *optional* and *closed* are
independent properties and this plan touches neither.

### `externalShapeVocabulary.ts`

Three constants deleted; the `ExternalActionShape` type and §(a)'s four-places refusal argument
kept. `grep -rc "EXTERNAL_SHAPE_CAPABILITY_LABEL|EXTERNAL_SHAPE_GROUP_LABEL|EXTERNAL_SHAPE_MCP_LABEL"
frontend/src/ | grep -v ":0$"` prints **nothing**, and that absence is itself asserted by a new
whole-`src` sweep case with a non-vacuity guard and a positive control.

### Leg (b) — re-pointed, never deleted

`grep -c "external-action-shape-option" McpToolPicker.reachability.test.tsx` → **0**;
`grep -c "?raw"` → **6**; the self-`?raw` no-prop-constructed assertion is unchanged and green.

| deleted / changed reachability case | replacement |
| --- | --- |
| helper `pressMcpShape()` (pressed the second of exactly two segments) | helper `bindRow(id)` — render, wait for the ONE unscoped read, bind on `connection-picker-select`. Still constructs no prop; the id comes from the WIRE RESPONSE |
| `POSITIVE CONTROL — strip the server URL from the WIRE ROW and the whole surface disappears` | `POSITIVE CONTROL — an EMPTY wire response yields the empty reading and no card`. **Re-falsified, not deleted:** the old form relied on the client-side shape filter Task 2 removes, so under the new model that row IS offered and the assertion became UNFALSIFIABLE. Leg (b) without a falsification is the vacuous leg (a) the file warns about |
| `POSITIVE CONTROL 2 — on the CAPABILITY shape a bound row mounts NO tool picker` | **INVERTED** — see the verbatim texts below |
| `the CAPABILITY shape still calls the read WITH its capability — both arms, one file` | `⭐ the read is issued with NO ARGUMENT — SEED-200's line, now on the ONLY arm`, which asserts EVERY call is `[]`, not just the first |
| `CROSS-SHAPE NEGATIVE — the MCP shape lists no capability row` | `⭐ CROSS-SHAPE — both shapes are in the SAME list, from ONE read` (three rows, one call) |
| `⚠ the capability shape's exclusion of an MCP row is the SERVER's, and that is stated not assumed` | same pair as above — there is no exclusion to attribute |

**Added:** `⭐ THE LEGACY-EMPTY ROW — card, sentence and Refresh, through the production chain`
(VALIDATION.md's Wave-0 fixture obligation: `capability` set, no server URL, `discovered_tools:
[]`, reached by operating controls), `⭐ THE ACTION WRITE LANDS IN THE FIELD THE EXECUTOR READS`,
`⭐ NO VERB IS OFFERED AS A CATEGORY ANYWHERE IN THE CHAIN (SC#3)`, and
`⚠ THE OLD SHAPE HELPER CANNOT COME BACK`.

### POSITIVE CONTROL 2 — the OLD and the NEW, verbatim

**OLD (shipped at 206.2, and GREEN against the defect):**

```
  it("POSITIVE CONTROL 2 — on the CAPABILITY shape a bound row mounts NO tool picker", async () => {
    // The other half of the same falsification: the chain reaches a BOUND connection and the
    // tool picker still does not appear, because the mount is conditional on the row's own
    // server URL rather than on having got this far.
    renderChain([SLACK_ROW], "post_message")
    const select = (await screen.findByTestId("connection-picker-select")) as HTMLSelectElement
    fireEvent.change(select, { target: { value: "conn-slack" } })
    await waitFor(() =>
      expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "bound"),
    )
    expect(screen.queryByTestId("mcp-tool-picker")).not.toBeInTheDocument()
  })
```

**NEW:**

```
  it("⭐ POSITIVE CONTROL 2 (INVERTED) — a bound CAPABILITY row DOES mount the card", async () => {
    renderChain([SLACK_ROW], "post_message")
    await bindRow("conn-slack")
    await waitFor(() =>
      expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "bound"),
    )
    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    const toolSelect = screen.getByTestId("mcp-tool-select") as HTMLSelectElement
    // …and it lists the row's OWN action, by the descriptor's own words.
    expect(Array.from(toolSelect.options).map((o) => o.value)).toContain("post_message")
    expect(screen.getByText("Post message")).toBeInTheDocument()
  })
```

Its own comment now records what it used to prove and why that stopped being the contract. The
case's justification — *"the mount is conditional on the row's own server URL rather than on having
got this far"* — was a plain-language statement of the defect, sitting inside a green test.

`SLACK_ROW` gained a one-element `discovered_tools` in the descriptor's real shape (`name`
`post_message`, `title` `Post message`, `inputSchema.required` `["text"]`), which is the wire shape
migration 127 §2b writes and which the orchestrator verified on the live local database.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 — missing critical functionality] The grant surface would have stated a refusal that never happens**

- **Found during:** Task 1, while making the action card render for a first-party connection.
- **Issue:** `phase_types.py`'s grant gate (`grants.get(tool_name) is True` → `tool_refused`) lives
  INSIDE its remote-server branch, so `tool_grants` is not consulted at all on the capability path.
  The card's `MCP_GRANT_DENIED_WARNING` reads *"This tool is not granted permission on this
  connection. Execution will be refused by policy at run time."* — false for a first-party
  connection, whose backfilled `tool_grants` is `{}`.
- **Why it is this plan's obligation and not a pre-existing one:** before Task 1 the card never
  rendered for such a row, so the sentence could not appear on one. **Making the card render is
  what created the sentence.**
- **Fix:** one new optional prop, `grantsEnforced` (default `true`, so every shipped MCP call site
  and every shipped assertion is byte-unmoved, including the `BASE_DENIED_NODE_COUNT = 33`
  no-provider pin). `ConnectionPicker` passes `Boolean(bound.mcp_server_url)`. The badge, the
  switch, the write-state, the scope note and the member sentence appear and disappear together —
  leaving the badge while removing the switch would stage the lie without its explanation.
- **⚠ Why the decision is made in the PARENT:** D-211-12 and this plan's acceptance criterion
  require `McpToolPicker` to make no rendering decision from the endpoint at all (0 live
  occurrences, source-fenced). The caller is permitted to know a connection's shape; the leaf is
  not. So the shape decides a WRITE-side fact one level up and the leaf renders the consequence.
- **Files:** `McpToolPicker.tsx`, `ConnectionPicker.tsx` · **Commits:** `f2c7c661`, `1635b07b`
- **Guarded by:** `⚠ grantsEnforced=false — no badge, no switch, no scope note, no refusal
  sentence` + `NON-VACUITY — the DEFAULT still renders the whole grant surface` +
  `⚠ THE GRANT SURFACE FOLLOWS THE SERVER'S GATE, not the card` (both arms, one case).

**2. [Rule 3 — blocking issue] `ExternalActionSection.tsx` touched two lines inside Task 2**

- **Issue:** removing `ConnectionPicker`'s `capability` and `shape` props broke the section's two
  mount expressions, so the tree did not compile between Task 2 and Task 3.
- **Fix:** `<ConnectionPicker capability={selected} />` and `<ConnectionPicker shape="mcp" />` both
  became `<ConnectionPicker />` in commit `1635b07b`; Task 3 then removed the surrounding
  radiogroups. Recorded because Task 2's `files` list named only the picker and its suite.

**3. [Rule 1 — bug in this plan's own fences] The 187-24 trap fired THREE times, and was narrowed rather than papered over each time**

A `?raw` self-swept fence makes any spelled-out literal part of the source being swept.

| where | what tripped | narrowing |
| --- | --- | --- |
| `McpToolPicker.tsx` | a comment quoting the old gate verbatim made `grep -c "if (!connection?.mcp_server_url)"` return 1 | the comment now describes the field without naming it, and says why |
| `McpToolPicker.reachability.test.tsx` | the helper-name sweep matched its own POSITIVE CONTROL string, then the test-id sweep matched a legitimate NEGATIVE query, then the docblock | both needles AND both positive controls assembled at runtime; the id-level negative moved to `queryAllByRole("radio")`, which is the stronger claim |
| `ExternalActionSection.test.tsx` | the whole-`src` axis sweep matched its own docblock and its own positive control | identifiers assembled at runtime; the docblock quotes the VALUES instead |

No `checkpoint` was reached; no package was installed; no architectural decision was owed.

## Deferred / carried forward, named not fixed

**⚠ `backend/app/services/harness/phase_types.py:2460` — THIS PLAN MAKES IT MORE REACHABLE, and
saying so is the point.**

```python
if not getattr(connection, "mcp_server_url", None) and getattr(connection, "capability", capability) != capability:
```

Untouched by this plan (that file is in no 211 plan's `files_modified`, and this plan's must_have
promises the executor's two-shape branch stays byte-unmodified). It was already recorded in
`211-02-SUMMARY.md`. What is NEW is the reachability:

- migration 127's `connector_connections_shape_is_not_ambiguous` is
  `CHECK (NOT (capability IS NOT NULL AND mcp_server_url IS NOT NULL))` — it forbids BOTH being
  set and **permits both being NULL**.
- Before this plan such a row could reach no picker at all: the capability arm's `?capability=`
  query excluded it and the MCP arm's client-side shape filter dropped it.
- **After this plan the read is unscoped and the shape filter is gone, so a capability-less,
  URL-less connection is listed, bindable, and lands on that predicate** — where the `getattr`
  default does not fire on `None`, the branch is True, and the step records-and-sends-nothing with
  a sentence (*"the bound connection is for a different capability"*) that is itself inaccurate.
- Whether such a row can be CREATED is 211-03's territory (the settings form), which is why this is
  flagged rather than acted on.
- **Re-open trigger:** *the first plan whose `files_modified` names `phase_types.py`, or the first
  observed `external_action` step recording that sentence against a service-shaped connection.*

**Named debt inside this plan's own files:** `ExternalActionSection` still ACCEPTS `onChange`,
`onChangeShape` and `onPersist` and calls none of them. Removing them would edit
`PhaseFormPanel.tsx`, which is outside this plan's `files_modified` and therefore outside its
review; an unused optional prop is a smaller debt than an unreviewed edit to a 2,800-line panel on
the hot-file ledger. Recorded in the interface with a re-open trigger (*the first phase whose
`files_modified` names `PhaseFormPanel.tsx`*) and asserted by a test that the trigger is written
down.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change was introduced;
`git diff --numstat frontend/src/components/settings/ frontend/src/lib/ backend/` prints nothing.

The plan's register was honoured as written: T-211-14b (React escapes; no `dangerouslySetInnerHTML`
anywhere in these files; the raw-wire-id rule kept and asserted), T-211-15b (`own()` retained and
source-fenced; `noConnectionYetNote`'s guard is now on the LIVE path), T-211-16 (`toolReadOnlyMap`
byte-untouched, 7 cases green), T-211-17b (one action field per write, asserted by set equality
plus a never-both sweep over a whole session), T-211-18 (the mirror, its `?raw` fence and leg (b)
all kept; leg (b) re-pointed), T-211-22 (both empty states pinned against the REAL empty-array
shape, on both shapes, at the leaf AND through the production chain), T-211-23 (POSITIVE CONTROL 2
inverted; POSITIVE CONTROL re-falsified; both old and new quoted above).

## Known Stubs

None. `grep -nE "TODO|FIXME|placeholder|coming soon|not available"` over the four source files
returns one hit — the shipped `placeholder='{ "key": "value" }'` on the arguments textarea, which
is an input affordance rather than a stub.

## Observations — a red run that was NOT this plan's

On one full-directory run (between Tasks 2 and 3, with the sibling 211-03 agent active) the gate
read **`Tests 20 failed | 4267 passed`**. The CLAUDE.md procedure was followed before any re-run:
filenames captured first, then checked against `git diff --numstat <base> HEAD` and
`git status --short`.

- **1 failure was REAL and mine** — the reachability fence tripping its own 187-24 trap. Fixed.
- **19 were in 8 files this plan has never touched**, each **provably unmodified** (absent from the
  diff): `FlowEdge.test.tsx`, `PhaseNode.test.tsx`, `StepTypePicker.test.tsx`,
  `WorkflowCanvas.test.tsx`, `WorkflowCanvas.editing.test.tsx`,
  `WorkflowCanvas.composition.test.tsx`, `library/ForkNameDialog.test.tsx`,
  `library/WorkflowCard.test.tsx`. Run in isolation they gave **8 passed / 485 tests**, and the
  full directory has since read **85 passed / 4287** twice.
- `library/WorkflowCard.test.tsx` is one of SEED-171's five named suites. **The cap was neither
  adjusted nor needed** — `GSD_VITEST_MAX_WORKERS=2` on every run.
- ⚠ Stated as an OBSERVATION, not as proof of innocence: those eight are **provably unmodified**
  by this plan, and one green sample of a flaky suite is not the same as *fine*.

## Self-Check

- Files claimed modified: all 8 present on disk and in `git diff --numstat` against the dispatched
  base `4871f384`.
- Commits claimed: `f2c7c661`, `1635b07b`, `5ec507ec` — all three resolve in `git log`.
- No file deletions: `git diff --diff-filter=D --name-only 4871f384 HEAD` prints nothing.
- No edits to `frontend/src/components/settings/**`, `frontend/src/lib/**`, `backend/**`,
  `STATE.md` or `ROADMAP.md`.

## Self-Check: PASSED
