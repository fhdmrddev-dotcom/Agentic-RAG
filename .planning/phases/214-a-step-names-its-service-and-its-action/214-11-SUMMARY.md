---
phase: 214-a-step-names-its-service-and-its-action
plan: 11
subsystem: run-surfaces
tags: [step-identity, STEP-04, STEP-05, D-214-16, D-214-23, SEED-206, BUG-260826-05, sketch-216]
requires:
  - "214-02 — the four wire fields (failure_reason / tool_name / capability / service_name) on both models and on `Phase`"
  - "214-08 — `StepIdentity`, and `connectionMark` at its `lib/` home"
  - "214-03 — `stepIdentityVocabulary`'s `FAILED_REASON_LABEL` / `FAILED_REASON_UNKNOWN`"
provides:
  - "the shared step identity mounted on all FIVE run surfaces, asserted per surface"
  - "`stepActionWords(capability)` — the ONE capability→words resolver"
  - "`stepMarkShape(capability, toolName)` — the ONE mark-shape builder, and the defect it closed"
  - "`WorkflowRunPage`'s `actionOf` / `serviceOf` / `shapeOf` resolver seam"
  - "a failed step showing the adapter's OWN sentence; the sentinel narrowed, not weakened"
affects:
  - "chat panel (PhaseCard / PhaseTimeline), chat RunCard, WorkflowRunPage + RunSpine + RunStepList, the approval pause"
tech-stack:
  added: []
  patterns:
    - "caller resolves, component renders (D-214-14) — extended to a third wire"
    - "one shared leaf per derivation, rather than the same derivation at each call site"
key-files:
  created:
    - frontend/src/components/workflows/stepActionWords.ts
    - frontend/src/components/workflows/StepIdentity.coverage.test.tsx
  modified:
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/components/panel/PhaseCard.test.tsx
    - frontend/src/components/panel/PhaseTimeline.tsx
    - frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
    - frontend/src/components/chat/RunCard.tsx
    - frontend/src/components/workflows/RunSpine.tsx
    - frontend/src/components/workflows/RunStepList.tsx
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/pages/WorkflowRunPage.test.tsx
decisions:
  - "D-11-A: the `where` diagnostic is RE-WORDED to name both sources; the sentence a person reads is byte-identical"
  - "D-11-B: a DB-backed reason renders VERBATIM rather than falling to generic gate copy (Rule 2 — the plan's own must_have was unmet by its literal instruction)"
  - "D-11-C: an MCP step renders NO identity on the four wire-fed surfaces — the client has no honest word for a server-defined tool id"
  - "D-11-D: `PhaseTimeline` does NOT import the element; its coverage is a runtime assertion, not a grep"
  - "D-11-E: on RunSpine/RunStepList the identity REPLACES the row title rather than sitting beside it"
metrics:
  duration: "~1h50m"
  completed: 2026-08-28
  tasks: 4
  commits: 4
---

# Phase 214 Plan 11: The mark and the action, on every run surface — Summary

The five run surfaces now say what a step does and what it runs through, through one shared
element they each receive props for; the panel's failure sentinel stops firing over reasons the
backend recorded, and a positive control caught the vendor marks being unreachable.

## What shipped

| Task | What | Commit |
|---|---|---|
| 1 | `classifyFailure` narrowed; `PhaseCard` mounts the identity; 14 new cases | `1844338` |
| 2 | `PhaseTimeline` (runtime-asserted), chat `RunCard`, the approval pause | `84471f8` |
| 2b | `WorkflowRunPage`'s resolver seam → `RunSpine` + `RunStepList` + the pause | `c90c18b` |
| 3 | the five-surface coverage suite — and the mark defect it found | `b3409d2` |

## The three findings

### 1 ⚠ Narrowing `raw` was NOT enough, and the RED came from the plan's own instruction

PATTERNS §3g and the plan both say *"`raw` is the ONE line that changes."* Making exactly that
change and running the suite produced three failures with one cause:

```
AssertionError: expected 'Why it stoppedValidation gate failed;…'
  to contain 'Channel #urgent-feedback-escalations …'
```

`classifyFailure` classifies its raw text into a **closed taxonomy**, and anything unrecognised
falls to `gate_failed`, whose copy is **fixed**. So the sentinel correctly stopped firing — and a
run whose reason really was *"Channel #urgent-feedback-escalations not found or bot lacks
permission to post."* rendered *"Validation gate failed; run halted."* That is `BUG-260826-05`
with different wrong words, and the plan's own must_have — *"a failed step shows the adapter's
OWN sentence, not a generic one"* (sketch 216 #12) — would have shipped unmet with every gate
green.

**Fix (Deviation Rule 2):** one new arm, `fromRecord`, sited **below** the typed markers so a
recorded reason carrying `wall_clock_timeout` or `max_steps` is still classified exactly as a
live one would be. What reaches it is a sentence no marker claimed. The live path is
byte-identical: `fromRecord` is false whenever `phase.error` is populated.

Why it is safe to render this one verbatim when the others are not: `phase.error` is free text
off a live event and the closed taxonomy is what makes it safe; `failureReason` is
`workflow_phases.output["_failure_reason"]`, written by `fail_phase` as the step's own recorded
reason. Replacing it with generic copy discards the only true statement on the card.

### 2 ⚠ EVERY Slack, Jira and SMTP step drew the MCP logo — found by a positive control, by nothing else

The four surfaces originally passed the wire row's two fields straight through as the mark's
shape: `{ capability, tool_name }`. `connectionMark`'s ladder tests **`tool_name` before
`capability`**, and `214-02` sets `tool_name` from `config.tool_name` on **native** steps too —
so every native step resolved to `MCP_MARK`.

**Every absence assertion beside it passed happily against the wrong mark.** What caught it was
the one case asserting a *presence*: `POSITIVE CONTROL — a KNOWN vendor really does draw its own
brand fills`.

```
AssertionError: expected '<path d="M184.913 14.498c11.45 11.45 …' to match /fill="#/i
```

This is byte-for-byte the defect `connectionMark.tsx`'s own arm-0 comment records from the
operator's *"GitHub is still showing MCP logo, notion and others"* report — *the marks were
correct and unreachable, which is the worst of both.*

**Fix:** `stepMarkShape(capability, toolName)` is now the ONE builder, and all four surfaces
route through it. The rule it encodes is the mark module's own: **a capability is the ADAPTER
fact, and the adapter decides the wire** — a native step names its capability and nothing else;
an MCP step carries no capability and is identified by its tool; a step with neither takes the
named neutral.

### 3 The derivation was written twice before it was written once

The first cut of Task 2 resolved the capability inline in `PhaseCard` and again in
`PendingAskStack` — and the second copy was **already subtly different**, reaching the table
through a bracket index where the first used `own()`. That is D-214-16's own sentence arriving
as a defect rather than as a principle. Hence `stepActionWords.ts`: the element was made shared
for exactly this reason, so is this.

## Decisions taken

**D-11-A — the `where` clause (the plan required this be decided, not left open).**
Re-worded: `error field was empty` → `error field and failure reason were both empty`. It became
literally false the moment a second source was read, and a reader who saw it would check
`error`, find it empty, and conclude the sentinel had fired correctly while a populated
`failureReason` sat unread. **The sentence a person reads is untouched** — `grep -c` is 1 and its
diff is 0 lines; `stepIdentityVocabulary.test.ts`'s `?raw` character-identity pin passes
unedited. No test asserted the `where` string (checked: the only other occurrence is sketch 010,
superseded for this surface by 216).

**D-11-C — an MCP step renders no identity on the four wire-fed surfaces.**
An MCP row carries `capability = null` and a server-defined `tool_name` (`read_wiki_structure`,
`ask_question`) for which this product has authored no phrase. Invariant #4 forbids that id on a
run surface and PATTERNS §4d's floor forbids fabricating one. The **backend** composes a human
sentence for the pause (`214-06`) because it can read the MCP server's tool titles; the client
cannot. ⚠ Recorded as a consequence rather than hidden: closing this needs a tool *title* on the
wire, not a client-side guess.

**D-11-D — `PhaseTimeline` does not import the element.** It mounts `PhaseCard`, which does, so
the identity arrives as a consequence of one component existing. A second mount would be the
second home D-214-16 exists to prevent. The plan's grep criterion would have been satisfied by
the docblock explaining this (the 187-24 trap); the claim is instead asserted at **runtime**, with
an `llm_single` row in the same render as the negative control.

**D-11-E — on `RunSpine` / `RunStepList` the identity replaces the row title.** The sheet draws
one name slot per row; printing the authored title *and* the action states the same step twice on
one line, which is the duplication the 200.2 re-port removed from that very column. It renders
**inside** the shipped `spine-title` / `step-title` elements, so every structural pin still reads
them. The panel card keeps both (heading above, identity below) — which is what the sketch draws.

**Chat `RunCard`'s shape is deliberately empty.** A chat agent's tools run in process, so there is
no service and no vendor whose mark could be borrowed. ⛔ `{ tool_name: tc.name }` would hit the
MCP arm and paint the MCP logo on `execute_code`. One identity per card, on the step in flight —
not one per tool row, since `ToolCallPanel` already owns per-tool detail. A tool with no authored
phrase (`toolLabel` returns the raw id) renders **nothing**, which excludes future tools in the
safe direction by construction.

## `RunTranscript` — untouched, and that is the decision

`grep -c "StepIdentity" RunTranscript.tsx` = **0**, and
`git diff -- WorkflowRunPage.test.tsx | grep -c 'not.toContain("RunTranscript")'` = **0**. The
Phase 200.2 pin was not edited, though this plan held write access to the file containing it.

⚠ **Its G-5 row is stale and now FIRES** — re-derived `7 / 3 / 652` against a ledger cell reading
`no (2 phases)`. This plan does not modify it; recorded so `214-15` corrects the cell. **A G-5 row
on an unmounted component is itself worth reporting.**

## Measurements

**tsc:** `34` at base → `34` at close (`-p tsconfig.app.json`). It read **36** mid-flight: the
suite's local `RunLike` mirror had gone stale against `214-02`'s wire widening, so a fixture
carrying real wire fields was a typecheck error while the product handled them fine. Widened
(Rule 3), back to 34.

**Per-file deltas — none decreased:**

| Suite | pin / base | close | Δ |
|---|---|---|---|
| `PhaseCard.test.tsx` | 41 | **55** | +14 |
| `__tests__/PhaseTimeline.test.tsx` | 35 | **38** | +3 |
| `WorkflowRunPage.test.tsx` | 148 (gate) · 169 (at my base) | **173** | +4 |
| `StepIdentity.coverage.test.tsx` | — | **23** | **NEW** |

⭐ **For `214-15` to pin: `StepIdentity.coverage.test.tsx` = 23 cases.** It lives under the
`src/components/workflows/` `TARGETS` entry, so it is gated the moment it exists; this plan did
not edit `scripts/vitest-count-gate.cjs`. Note `WorkflowRunPage.test.tsx`'s gate pin (148) is
already below the tree's figure at my base (169) — waves 1/2 grew it; I decreased nothing.

**Final verification run — 24 files, 684 tests, 0 failing:**
`src/components/panel` · `WorkflowRunPage.test.tsx` · `StepIdentity.coverage.test.tsx` ·
`StepIdentity.test.tsx` · `stepIdentityVocabulary.test.ts` · `RunSpine.test.tsx` ·
`RunStepList.test.tsx` · `RunCard.test.tsx` · `RunCard.timer.test.tsx`.

**Fences, all measured:**

| Criterion | Result |
|---|---|
| `grep -c "Failure reason not captured by the backend"` in `PhaseCard.tsx` | **1**, diff 0 lines |
| `git diff PhaseCard.tsx \| grep -c "^[-+].*reason_unknown"` | **0** |
| `connectionMark` / `CONNECTION_MARK` across `components/panel` + `components/chat` | **0** |
| `fetch(` / `useQuery` / `listConnections` on the four panel/chat surfaces | **0** |
| the same on `RunSpine` + `RunStepList` | **0** |
| `grep -c "serviceOf\|actionOf"` in `WorkflowRunPage.tsx` | **8** (≥ 2) |
| `grep -c "StepIdentity"` on all five surface modules | ≥ 1 each |

## SEED-171 / flake

**None observed.** `WorkflowRunPage.test.tsx` — one of SEED-171's five known-flaky suites and in
this plan's `files_modified` — was green on the **first** run of every invocation (169, then 173,
then 173). The worker cap stayed at `2` throughout and was never touched. No red run occurred, so
the capture-before-re-run procedure was never entered.

## The 187-24 trap fired three times, and each is recorded

The carry-forward warned it; it still fired. Each time the fix was to reword the **prose**, never
to relax the fence:

1. `git diff … grep -c "reason_unknown"` read **1** — the only hit was my own comment saying the
   branch was untouched. Reworded to not spell the token.
2. The `connectionMark` sweep read **3** — two comments plus one genuine `import type`. The
   comments were reworded, and the type import was replaced by reaching **through** the element
   (`StepIdentityProps["shape"]`), which is also the honest dependency.
3. `PhaseTimeline.tsx`'s `grep -c "StepIdentity"` is satisfied by the docblock that explains why
   it must *not* import the element — so the grep is not the evidence; the runtime case is.

## Deviations from Plan

**1. [Rule 2 — missing critical functionality] A recorded reason rendered as generic gate copy**
- **Found during:** Task 1, from RED produced by the plan's own prescribed change
- **Issue:** the closed taxonomy's `gate_failed` default replaced the adapter's sentence
- **Fix:** one new arm below the typed markers; live path byte-identical
- **Files:** `PhaseCard.tsx` · **Commit:** `1844338`

**2. [Rule 1 — bug] The MCP mark drawn on every native-capability step**
- **Found during:** Task 3, by a positive control; every absence assertion beside it passed
- **Fix:** `stepMarkShape()` as the one builder, four surfaces routed through it
- **Files:** `stepActionWords.ts`, `PhaseCard.tsx`, `PendingAskCard.tsx`, `WorkflowRunPage.tsx`
- **Commit:** `b3409d2`

**3. [Rule 3 — blocking] `RunLike`'s local phases mirror stale against the 214-02 wire**
- **Fix:** four optional fields added, matching the file's own stated reason for the prior five
- **Files:** `WorkflowRunPage.test.tsx` · **Commit:** `b3409d2`

**4. [Rule 2 — structural] The capability derivation written twice, the second copy already wrong**
- **Fix:** `stepActionWords.ts` — one shared leaf · **Commit:** `84471f8`

**5. [Not a deviation — a required re-derivation]** `PendingAskCard.retired.baseline.test.tsx`
carries a deliberate exact line-count pin whose own docblock instructs re-derivation in the same
commit. `650 → 737`, superseded in place with both earlier figures kept. Its three
retirement-sentence fences are untouched and passed on the same run.

## Findings for the phase, not for this plan

- ⚠ **`stepIdentityVocabulary`'s six pause sentences are authored and NOT consumed.**
  `grep -c "ASK_PAUSED" PendingAskCard.tsx` = **0**; the card still renders its own `Needs you`.
  My first positive control asserted the vocabulary and failed — a test passing against copy the
  product does not show would have been worse. `ASK_PAUSED` / `ASK_NOTHING_SENT` /
  `ASK_WILL_SEND` / `ASK_APPROVE` / `ASK_DECLINE` / `ASK_NOT_RECORDED` await a pause-copy re-skin,
  which is a decision rather than a coverage task. **A vocabulary nothing imports is invisible to
  every surface fence.**
- ⚠ **`RunTranscript.tsx` measures `7 / 3 / 652` against a ledger cell of `no (2 phases)`** — it
  now FIRES G-5, on a component with no mount in the product.
- ⚠ **`PendingAskCard.tsx` re-derived at execute time: `13 / 7 / 736`** (the plan's g5 table left
  this one to be measured). Fires. Honoured by construction — three optional props, one gated
  element, and a resolution block reading rows the stack already held.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired data source was introduced. Every
`null` arm in this plan is a **rendered decision** (the action alone, or no element at all), each
asserted in both polarities.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. T-214-11-01 is
covered by a case seeding a `<script>`-bearing reason and asserting it renders escaped;
T-214-11-06 is unchanged — this plan added identity and **no receipt field** (D-213-14 stands).

## Self-Check: PASSED

Created files verified present:
- `frontend/src/components/workflows/stepActionWords.ts` — FOUND
- `frontend/src/components/workflows/StepIdentity.coverage.test.tsx` — FOUND

Commits verified in `git log`: `1844338` · `84471f8` · `c90c18b` · `b3409d2` — all FOUND.
