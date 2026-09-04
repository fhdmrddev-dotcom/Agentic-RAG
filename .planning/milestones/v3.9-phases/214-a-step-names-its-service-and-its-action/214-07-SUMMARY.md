---
phase: 214-a-step-names-its-service-and-its-action
plan: 07
subsystem: workflow-authoring / external-action arguments
tags: [argument-editor, source-picker, escape-hatch-deleted, reachability, cross-language-fence, D-214-01, D-214-06, D-214-22]
requires:
  - "214-01 — backend/app/services/connectors/args.py::renderable_property (the predicate this plan mirrors) and ExternalActionPhaseConfig.arg_sources (the stored shape)"
  - "214-03 — frontend/src/components/workflows/argumentVocabulary.ts (every sentence on this surface)"
  - "214-04 — the builder panel's clamp(480px, 38%, 640px) track, which is the room the gutter needs"
provides:
  - "frontend/src/components/workflows/argumentModel.ts — the pure schema→rows derivation + the renderability mirror"
  - "frontend/src/components/workflows/ArgumentEditor.tsx — the section, one grid template computed once"
  - "frontend/src/components/workflows/ArgumentRow.tsx — one argument, one three-arm source picker"
  - "ConnectionPicker: arg_sources read/write seam, the body-arg mirror, and the editor's mount"
  - "the DELETION of MCP_TOOL_ARGS_LABEL and its free-form control, with nothing replacing them"
affects:
  - "214-09 / 214-12 — the ask_key an author types here must land in WorkflowDefinition.inputs[]"
  - "214-14 — the end-to-end seam test; its Python cold-flag case is the authoritative flag fence, not this plan's reachability case"
  - "214-15 — owns every BASELINE pin and the four hot-file ledger rows; the figures it needs are in this summary"
tech-stack:
  added: []
  patterns:
    - "a pure derivation leaf with ZERO imports, fenced cross-language against its Python twin via ?raw"
    - "one grid template computed by the SECTION and handed to every row, so label offsets are equal by construction"
    - "positional <select> option values so a stored slug never reaches the DOM"
    - "a deletion paid for with ABSENCE cases, never by removing the assertions"
    - "T3 reachability through the real mount chain, driven RED against a planted defect before it was trusted"
key-files:
  created:
    - frontend/src/components/workflows/argumentModel.ts
    - frontend/src/components/workflows/argumentModel.test.ts
    - frontend/src/components/workflows/ArgumentEditor.tsx
    - frontend/src/components/workflows/ArgumentRow.tsx
    - frontend/src/components/workflows/ArgumentEditor.test.tsx
  modified:
    - frontend/src/components/workflows/McpToolPicker.tsx
    - frontend/src/components/workflows/ConnectionPicker.tsx
    - frontend/src/components/workflows/ExternalActionSection.tsx
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/McpToolPicker.test.tsx
    - frontend/src/components/workflows/ConnectionPicker.test.tsx
    - frontend/src/components/workflows/ExternalActionSection.test.tsx
    - frontend/src/components/workflows/argumentVocabulary.test.ts
    - frontend/src/components/workflows/McpToolPicker.reachability.test.tsx
    - frontend/src/components/workflows/__tests__/connectionCardReachability.test.tsx
decisions:
  - "THE PLAN CONTRADICTED ITSELF ABOUT THE MOUNT POINT and the ⛔ real-mount-chain requirement won — ArgumentEditor is mounted by ConnectionPicker, so PhaseFormPanel gains no import and no JSX element. See the deviation below."
  - "The body-arg map is a CLIENT MIRROR living in ConnectionPicker (which is allowed to know a connection's shape), never in the editor (which must not branch on capability) — bound to phase_types.py by a cross-language fence with a 3-pair non-vacuity control on each side."
  - "An unrenderable property gets a row and NO control of any kind — no picker, no box. The author is told which argument; nothing is offered that the adapter would refuse."
  - "An upstream slug that resolves to no known step reads as ARG_NO_SOURCE rather than leaking the raw value into a sentence."
  - "McpToolPicker keeps `toolArgs` / `onChangeArgs` on its contract but no longer DESTRUCTURES them, with a re-open trigger — removing them would have edited a call site for no reviewable reason."
metrics:
  duration: ~2h10m
  completed: 2026-08-28
  tasks: 3
  commits: 4
  files: 15
---

# Phase 214 Plan 07: The Argument Form and Its Source Summary

The hand-written arguments object is gone — deleted, with **nothing replacing it** — and in its
place every declared argument of a bound action draws its own field with a visible three-arm
source picker, derived from the same `inputSchema` the publish gate and the executor read.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `3769d99de` | `argumentModel.ts` — the pure derivation + the cross-language renderability fence (26 cases) |
| 2 | `496707ddb` | `ArgumentEditor.tsx` / `ArgumentRow.tsx` — the fifteen sketch invariants asserted (30 cases) |
| 3 | `7361ace20` | the JSON surface deleted, both clears extended, the panel's props shed, reachability proven |
| 3 | `f0e8d2f52` | the removal docblock was counting itself — the 187-24 trap, fifth firing this phase |

## The three things the plan asked this summary to record

### 1 · The `BASELINE` figures, and their PROVENANCE — which is not the gate

**The full count gate was NOT run, deliberately.** The dispatch instruction for this worktree is
explicit (*"Do NOT run the full `scripts/vitest-count-gate.cjs` — the orchestrator owns it
post-merge"*) and two sibling agents were live. CLAUDE.md's own measurement is that
`count gate OK` is **not reliably reachable on demand**, so a figure read here would have been
worth less than one read at the merge. The figures below come from **scoped
`GSD_VITEST_MAX_WORKERS=2 npx vitest run <path>` invocations**, read from vitest's own
`Tests N passed` line — the same thing a `BASELINE` pin counts, but not the gate's own output,
and that difference is the thing `214-15` should check.

| file | pin in `vitest-count-gate.cjs` | actual at my base | **actual now** | delta | note |
|---|---|---|---|---|---|
| `argumentModel.test.ts` | — | — | **26** | NEW | needs a pin |
| `ArgumentEditor.test.tsx` | — | — | **33** | NEW | needs a pin |
| `McpToolPicker.test.tsx` | 29 | 39 | **40** | **+1** | −2 JSON cases, +3 absence cases |
| `ConnectionPicker.test.tsx` | 58 | 58 | **63** | **+5** | the `arg_sources` block |
| `ExternalActionSection.test.tsx` | 25 | 30 | **36** | **+6** | the fences extended to the new leaves |
| `argumentVocabulary.test.ts` | — (owed from `214-03`) | 44 | **44** | 0 | assertions replaced in place |

⚠ **EVERY DELTA IS ATTRIBUTED AND THERE IS NO RESIDUAL** — that arithmetic is what separates
GROWTH from DRIFT. ⭐ **`McpToolPicker.test.tsx` does NOT decrease**, which is the criterion the
plan singles out: a deleted feature and a deleted assertion look identical in a count, so the
deletion is paid for in kind. **No pinned file decreased anywhere.**

⚠ **This plan did NOT edit `scripts/vitest-count-gate.cjs`.** `214-15` owns every pin, in one
commit, once every new file exists. Both new suites live under `src/components/workflows`, which
is already a **directory** entry in `TARGETS`, so they RUN the moment they exist — they are
merely unpinned, and an unpinned file is not lightly guarded, it is unguarded (188-12).

### 2 · `PhaseFormPanel.tsx`'s measured diff

```
git diff --numstat e08f4367f -- frontend/src/components/workflows/PhaseFormPanel.tsx
7	2	frontend/src/components/workflows/PhaseFormPanel.tsx
```

**9 changed lines total, against the plan's ceiling of ≤ 12.** The whole content is: **−3 props**
from the `:1473` call site, one two-line comment saying why, and the `400px` prose sentence
truthed. ⚠ **There is NO added import and NO added JSX element** — see the deviation below, which
is the one place this plan departs from its own written shape.

For the other three sources, since a net figure is the honest way to read a deletion:

| file | added / removed | shape |
|---|---|---|
| `McpToolPicker.tsx` | 21 / 65 | **net −44** — a NET DELETION, the strongest form of the G-5 claim |
| `ExternalActionSection.tsx` | 18 / 15 | a net prop-contract REDUCTION (three props out, a docblock in) |
| `ConnectionPicker.tsx` | 186 / 4 | ⚠ **the honest outlier — see the G-5 note below** |

### 3 · `discover_connection_tools`, RE-VERIFIED

PATTERNS flagged `connector_service.py:880` as un-re-verified and told this plan not to cite it
unchecked. Measured at execute time:

```
grep -n "def discover_connection_tools" backend/app/services/connector_service.py
864:async def discover_connection_tools(
```

**`backend/app/services/connector_service.py:864`.** The cited `:880` was wrong by 16 lines. The
client half (`discoverConnectorTools`) is `frontend/src/lib/api/connectors.ts:257`. **No new route
was added**; `ArgumentEditor`'s `ARG_SCHEMA_UNKNOWN_NEXT` reaches this one.

## ⚠ Measured surprises

### 1 · The escape-hatch fence fired FIVE times — every one on MY OWN PROSE

This is 214-03's *"a bare-identifier sweep reds on eight PROMISES"* finding, recurring, and it is
worth recording because it fired **in the turn the prose was authored** rather than at review:

| # | file | the word | the sentence it was in |
|---|---|---|---|
| 1 | `argumentModel.ts` | `key/value` | *"never returns … a key/value pair"* |
| 2 | `ArgumentEditor.tsx` | `textarea` | *"the only way … was a textarea labelled with…"* |
| 3 | `ArgumentEditor.tsx` | `advanced` | *"not even 'for advanced tools'"* |
| 4 | `ArgumentRow.tsx` | `advanced` | *"no 'Advanced' disclosure"* |
| 5 | `ExternalActionSection.tsx` | the three prop names | the docblock recording what came out |

⭐ **Each one was a sentence PROMISING the absence of the thing it named**, and each was caught by
the fence written to forbid it. **The remedy was to re-word, never to weaken the fence** — the
reasons survive in full, only the literals moved. #5 in particular would have made the plan's own
acceptance grep read `1` where it must read `0`, i.e. **a passing implementation reported as a
failure by its own documentation**.

⚠ **A GENERAL LESSON, STATED SO THE NEXT PLAN DOES NOT REDISCOVER IT:** a source-text fence over a
file makes that file's *documentation* part of the swept set. Anything that must be absent from
the CODE must also be absent from the PROSE, or the prose has to describe it without naming it.

### 2 · ⚠ `PhaseFormPanel.tsx` CANNOT carry a blanket no-`textarea` fence, and never could

Sketch invariant #1 asks for *"a `?raw` source fence over `PhaseFormPanel` + `McpToolPicker` + the
new argument component"* sweeping for `textarea` / `json` / `advanced` / key-value. **Driven as
written that is unsatisfiable:** `PhaseFormPanel.tsx` measures **11 hits**, and every one is a
legitimate shipped prompt field —

```
477:  textarea?: boolean          488:  {props.textarea ? (        490:  <textarea
1116, 1143, 1201, 1276, 1340, 1381 …  the llm_* prompt fields
```

— plus `PhaseSpecJSON` in two type positions. A fence asserting zero would be **RED on a correct
tree forever**, which is the 214-03 failure mode exactly. **What shipped instead**, narrowed and
each half falsifiable:

- `MCP_TOOL_ARGS_LABEL` absent from the **whole `src` tree** (`argumentVocabulary.test.ts`, needle
  assembled at runtime, positive control first) — **0 hits, measured**;
- `McpToolPicker.tsx` carries **zero** `Textarea`, plus a rendered-DOM sweep over the whole card;
- the two new components + `argumentModel.ts` swept for all five needles in **source AND rendered
  DOM, across six distinct render states**;
- and the reachability case sweeps **the panel's own rendered HTML** for the same needles in the
  place a person actually stands — which is the property #1 was really after.

### 3 · ⭐ The reachability case was driven RED before it was trusted

`{bound !== undefined && boundAction !== "" && (` → `{false && …` in `ConnectionPicker.tsx`, then:

```
× ⭐ PhaseFormPanel → ExternalActionSection → ConnectionPicker → ArgumentEditor
× ⛔ and no free-form control appears anywhere on the panel for this step
TestingLibraryElementError: Unable to find an element by: [data-testid="argument-editor"]
Tests  2 failed | 1 passed | 30 skipped (33)
```

The plant was reverted and the suite re-read **33 passed**. ⚠ **The negative control (`llm_single`
→ no editor) stayed GREEN under the plant**, which is exactly right and is why it is not evidence
on its own. *A guard nobody has seen fire is not a guard.*

### 4 · The `off` gutter state needed `bodyArgKey: null`, and that is the D-214-03 rule working

My first gutter case asserted `data-arg-gutter="off"` on a default render and failed with
`expected 'on' to be 'off'`. **Not a defect:** the default fixture has a body key and an upstream
step, so the pre-set already sources one row. A test that had ignored this would have been
asserting the wrong baseline. Recorded because the failure *looked* like a layout bug for a
moment and was a correctness proof.

### 5 · `argumentVocabulary.test.ts`'s self-retiring exemption worked exactly as designed

214-03 declared `McpToolPicker.tsx` as its ONE escape-hatch offender with a companion case
asserting it **still offended**. The moment Task 3 deleted the label that case went red with the
message 214-03 wrote for it — *"no longer offends — remove it from DECLARED_OFFENDERS (214-07 has
landed)"*. The list is now `[]` and the sweep is **unconditional, with no category of exception**,
plus a tree-wide check that the identifier is gone from every non-test module under `workflows/`.

## Deviations from Plan

### 1 · ⭐ `[Rule 4-adjacent — a plan-internal contradiction, resolved and reported]` The mount point

**The plan specifies two mutually exclusive mount points**, and this is the one place the
implementation departs from a written acceptance criterion. Both statements, verbatim:

| where | what it says |
|---|---|
| `key_links` + Task 3 AC | *"from `PhaseFormPanel.tsx` to `ArgumentEditor.tsx` via one import plus one line inside the existing card-outside StepCardSection"*; *"the diff contains exactly one added `import` line and exactly one added JSX element"* |
| Task 3 `<action>` | *"Mount `ArgumentEditor` from `ConnectionPicker` — the only child on this surface holding a store reference — passing the parsed `tool_args`, the `arg_sources`, the selected tool's `inputSchema`, the upstream phase list and the two change handlers"* |
| Task 3 ⛔ | *"Render through the real mount chain — `PhaseFormPanel` → `ExternalActionSection` → `ConnectionPicker` → `ArgumentEditor` — with none of the intermediate components stubbed"* |

**The mount-from-`ConnectionPicker` reading won, on two counts of evidence and one mechanical
one.** Two of the three statements describe it; and the third is **impossible without a
regression**:

> `ArgumentEditor` needs the bound connection's `discovered_tools` to find the action's
> `inputSchema`. Mounted from the panel it would need its OWN `listConnectorConnections()` — a
> second network read duplicating `ConnectionPicker`'s. ⚠ **`ExternalActionSection.test.tsx` and
> `PhaseFormPanel.rails.test.tsx` both render their subject with no store and no provider, and
> `ConnectionPicker`'s guard is on the EFFECT precisely so they open no request.** A panel-level
> mount with a fetch would have given two shipped suites an unmocked network call they never
> asked for — the defect that file's own docblock exists to prevent.

**What this costs:** `PhaseFormPanel.tsx` gains **no import and no JSX element**; its diff is the
−3 props plus prose (9 lines). The `key_links` pattern `ArgumentEditor` does **not** appear in
`PhaseFormPanel.tsx`, and it is not faked into a comment — a fence satisfied by its own prose is
the trap this phase records five firings of.

**What replaces the lost criterion, and it is strictly stronger:** the diff-shape check proved the
code was WRITTEN; ⭐ **the reachability case proves a person can REACH it**, through the real chain
with nothing stubbed, and it was **driven RED** first. That is the criterion the plan's own ⛔ and
its Phase-209 warning actually care about.

### 2 · `[Rule 3 - Blocking]` `argumentVocabulary.test.ts` had to change with the deletion

Not in `files_modified`, but 214-03 built it to red on exactly this event and its failure message
names this plan. Fixed inline: `DECLARED_OFFENDERS = []` plus a tree-wide absence sweep with a
positive control. Commit `7361ace20`.

### 3 · `[Rule 3 - Blocking]` two reachability suites constructed the removed props

`McpToolPicker.reachability.test.tsx` and `__tests__/connectionCardReachability.test.tsx` both
passed `onChange` / `onChangeShape` / `onPersist` to `ExternalActionSection`. ⚠ **The handlers were
NOT re-created as no-ops** — a stub for a seam that no longer exists is a fiction a file then
carries forward. Both call sites are now two props. Commit `7361ace20`.

### 4 · `[Rule 1 - Bug in my own change]` `McpToolPicker`'s node-count pin, RE-BASELINED 33 → 30

`BASE_DENIED_NODE_COUNT` pins *"a provider-less render adds ZERO NEW NODES"*. This plan deleted
three nodes deliberately, so the count moved **down by exactly three**. ⚠ **It is still an EQUALITY
against a constant, not a widened bound** — *a pin relaxed to make red go green is a pin that never
fails again* — and the delta is attributed in place. An edit that ADDS a node here is still red.

### 5 · `[Plan-directed, narrowed]` `grantsEnforced={false}` asserted the deleted surface

Its second assertion read `getByTestId("mcp-tool-args")`. Its real obligation is *the non-grant
surface survives a `grantsEnforced={false}` render*, and `mcp-tool-select` carries that just as
well. Replaced, not dropped.

### 6 · `[Rule 2]` `ConnectionPicker` gained a small re-discovery handler

`ARG_SCHEMA_UNKNOWN_NEXT` needs a live route or it is a dead control. `handleRediscover` calls the
existing `discoverConnectorTools` and writes the row back through the existing `adoptConnection`.
⚠ **Adding `discoverConnectorTools` to this file's imports is measured to be mock-safe**: every
suite that mounts `ConnectionPicker` already loads `McpToolPicker`, which imports the same name
from the same module, so no `@/lib/api` factory gains an obligation. (That is the check Phase 196
did not have when a red gate read `failed 249`.)

## ⚠ An observation this plan did NOT fix, named rather than silently left

**`McpToolPicker`'s own *Refresh actions* button writes only its LOCAL `localDiscoveredTools`**, so
after pressing it the newly-listed action appears in the `<select>` while `ConnectionPicker`'s
`bound.discovered_tools` — which is where the argument form reads the schema — is still stale. The
form then honestly says *"We do not know what this action needs"* and offers its own refresh, which
DOES adopt the row and resolves it. So the state is **degraded but honest and recoverable in one
click**, never wrong.

The one-line fix is `onConnectionUpdated?.({ ...connection, discovered_tools: result })` inside
that handler. It was **not** made: it is outside this task's blast radius (SCOPE BOUNDARY) and it
changes a shipped component's callback behaviour, which deserves its own review.
**RE-OPEN TRIGGER:** *the first phase whose `files_modified` names `McpToolPicker.tsx`, or the
first report of an action whose arguments will not appear after a refresh.*

## Threat register dispositions

| Threat ID | Disposition | How |
|---|---|---|
| T-214-07-01 | **mitigated** | Two independent fences: the tree-wide exported-copy sweep in `argumentVocabulary.test.ts` (now with an EMPTY exemption list) and this plan's source + rendered-DOM sweep over six render states, needles assembled at runtime, positive control asserted FIRST. ⚠ Narrowed for `PhaseFormPanel` — see *Measured surprises §2*, where the literal wording is refuted by measurement. |
| T-214-07-02 | **mitigated** | `arg_sources` joins `ConnectionPicker`'s credential sweep (`secret\|token\|password\|host\|base_url`, host-shaped values, and URL-shaped `ask_key` / `upstream_slug`), driven with three planted offenders that each throw. Plan `214-01`'s model validator is the second layer, because a client gate is bypassable. |
| T-214-07-03 | **mitigated** | Fields derive ONLY from declared schema properties. The `send_email` fixture is EXTRACTED from `smtp_adapter.py` via `?raw` rather than typed, so the *"exactly `to`/`subject`/`body`, no `cc`"* case cannot be satisfied by a friendly fixture. Asserted in both the model suite and the editor suite. |
| T-214-07-04 | **mitigated** | Invariant #6 (a phase slug appears **zero** times in the rendered DOM while its authored name appears; option values are positional; an unresolvable slug reads as `ARG_NO_SOURCE`) and invariant #13 (no capability id anywhere), each with a non-vacuity control. Plus a source-level fence: neither new component spells a capability id at all. |
| T-214-07-05 | **mitigated** | `arg_sources` joins BOTH clears — with `tool_name` and on `bind`/unbind — asserted by two cases plus the SET-EQUALITY bind sweep, whose declared key list grew 4 → 5 so a SIXTH key still fails. |
| T-214-07-06 | **mitigated** | The picker always shows a source; a row with none reads `ARG_NO_SOURCE` with every arm unpressed. The pre-set body row states `ARG_PRESET_NOTE`, its select and all three radios assert `disabled === false`, and exactly one row is pre-set. |
| T-214-07-SC | **mitigated** | **Nothing was installed.** `package.json` is untouched; every control is a plain element or a shipped primitive. |

## G-5 disposition

Re-derived at this plan's close (`wc -l`; commit/phase counts are `214-15`'s to re-derive at merge,
since three of these files are edited by siblings in this same wave):

| File | ledger cell | lines now | verdict |
|---|---|---|---|
| `PhaseFormPanel.tsx` | 29 / 13 / 1561 | **1566** | **honoured by construction** — +7/−2, and the prop contract got SMALLER |
| `McpToolPicker.tsx` | 3 / 3 / 645 | **601** | **honoured — a NET DELETION of 44 lines**, the strongest form of the claim |
| `ExternalActionSection.tsx` | 4 / 3 / 498 | **179** | **honoured** — a net prop-contract reduction |
| `ConnectionPicker.tsx` | 5 / 3 / 651 | **888** | ⚠ **the honest outlier — argued, not waved through** |

⚠ **`ConnectionPicker.tsx` grew by 237 lines and that is more than *"one handler beside its
twin"*.** Stated plainly rather than buried: it gained three `useSyncExternalStore` reads in the
file's own shipped snapshot idiom, one derivation pair, one small handler, one mirror map and one
child mount — **and roughly two thirds of the added lines are docblocks**, including the mirror's
own fence rationale. It gained **no new fetch on the render path, no new context and no new store
subscription mechanism**. The extraction that file is owed is untouched and unobstructed.
**The seam remains the one its ledger section names**, and this plan makes it slightly more
attractive rather than less: the four store snapshots now form an obvious `usePhaseConfig(slug)`
hook. `214-15` owns the re-derive and the same-commit sync of all four rows, plus **three new young
rows** (`argumentModel.ts` 313 L, `ArgumentEditor.tsx` 226 L, `ArgumentRow.tsx` 362 L) so they are
never invisible to G-5 the way `libraryFilter.ts` was for four phases.

## Verification

| check | result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | **34 errors** — the measured baseline, unchanged across all four commits |
| `npx vitest run src/components/workflows` (cap 2) | **91 files · 4504 passed · 0 failed** |
| the six builder-page suites (cap 2) | **6 files · 316 passed · 0 failed** — first run, no re-run needed |
| `npx eslint src/components/workflows/` | `react-refresh/only-export-components` **14 → 14**; **0** in either new component |
| `grep -rn "MCP_TOOL_ARGS_LABEL" frontend/src \| wc -l` | **0** |
| `grep -c "Textarea" McpToolPicker.tsx` | **0** |
| `grep -c "onChangeArgs" McpToolPicker.tsx` | **3** — the prop survived |
| `grep -c "arg_sources" ConnectionPicker.tsx` | **6** (two clears + the write handler + the read + the mount) |
| `grep -c "onChangeShape\|onPersist" ExternalActionSection.tsx` | **0** (and `onChange` is 0 too) |
| `grep -rn "400px" frontend/src \| grep -v components/settings \| grep -v handleSpike \| wc -l` | **0** — the phase-wide sweep is clean |
| `grep -c "^import" argumentModel.ts` | **0** — a zero-import leaf |
| `git diff --numstat` on `PhaseFormPanel.tsx` | **7 / 2** — 9 changed lines, ceiling 12 |

⚠ **SEED-171 was never entered.** The cap held at `2` on every invocation and nothing red ever
appeared that was not caused by this plan's own diff, so no triage was needed. Recorded as an
observation, not as proof of innocence: `WorkflowBuilderPage.session.test.tsx` and
`WorkflowBuilderPage.canvas.test.tsx` — two of SEED-171's five — sat in the blast radius and were
green on the first run of every invocation. **One green sample of a flaky suite is not innocence.**

## Known Stubs

**None.** Every surface this plan ships is wired to a real seam:

- the source picker writes real `arg_sources` through `patchConfig` + `flushHistory`;
- the value control writes real `tool_args`;
- the leftover remove control really removes the key;
- `ARG_SCHEMA_UNKNOWN_NEXT` calls the existing discovery route and adopts the response.

⚠ **One promise is deliberately made here and kept elsewhere, which is not a stub but must not be
forgotten:** `ARG_ASK_KEY_HINT` says *"This becomes a field on every way of starting this
workflow."* That is made true by plans **`214-09`** and **`214-12`**; the seam is the typed key
landing in `WorkflowDefinition.inputs[]`. Until they land, an `ask` key is stored honestly and the
publish gate (`214-05`) refuses a step whose `ask_key` no `inputs[]` entry declares — so the
failure mode is a REFUSAL at publish, never a silent no-send.

## Self-Check: PASSED

All five created files present on disk (`argumentModel.ts`, `argumentModel.test.ts`,
`ArgumentEditor.tsx`, `ArgumentRow.tsx`, `ArgumentEditor.test.tsx`); all four commits
(`3769d99de`, `496707ddb`, `7361ace20`, `f0e8d2f52`) resolve in `git log`.

⚠ **One accidental write outside the worktree was caught and removed:** a `--outputFile` for a
one-off JSON reporter run resolved to `C:/Vibe Apps/Agentic RAG/scratch-214-07.json` — the MAIN
repo root, not this worktree (issue #3099's exact shape, from a relative `../../../../` rather
than from `git rev-parse --show-toplevel`). Deleted immediately; `git status` in this worktree is
clean and the operator's tree carries nothing from it. Recorded because the guard that would have
prevented it is a habit, not a hook.

## What this plan did NOT do

- **No `scripts/vitest-count-gate.cjs` edit** — `214-15` owns every pin for this phase, in one commit.
- **No hot-file ledger row and no `docs/HOT-FILE-LEDGER.md` section** — `214-15` owns all seven rows under the same-commit sync rule.
- **No `STATE.md` / `ROADMAP.md` write** — the orchestrator owns those after the wave.
- **No backend change of any kind.** `args.py`, `phase_types.py` and the adapters are byte-unchanged; this plan only READS them, through `?raw`, to fence its client mirrors against them.
