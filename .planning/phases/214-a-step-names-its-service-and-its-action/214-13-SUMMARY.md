---
phase: 214-a-step-names-its-service-and-its-action
plan: 13
subsystem: workflow-authoring-vocabulary
tags: [step-06, describe-door, connections, grants, governed-refusal, sketch-217, enforcement]
requires:
  - "214-02 (the `allowed_connection_ids` request type on GenerateWorkflowBody)"
  - "214-03 (doorVocabulary's twelve sketch-217 ids + the colour ruling)"
  - "214-05 (the publish gate this constraint precedes)"
provides:
  - "frontend/src/components/workflows/DescribeServicePicker.tsx — the connected-services picker, at the GRANT grain"
  - "frontend/src/components/workflows/describeServiceMatch.ts — the whole-word catalog match + its unanchored fallback"
  - "the second arm on WorkflowDoorSwitch's one refusal mechanism, with the precedence rule implemented"
  - "backend `allowed_connection_ids` — a prompt paragraph AND a post-emit refusal on the emitted definition"
  - "the new honest error code `connection_not_allowed`"
affects:
  - "214-14 (S-7 must drive `connection_not_allowed` to a rendered builder error; S-x seam audit must claim two undeclared path files — see below)"
  - "214-15 (owes BASELINE pins for two new suites + a re-pin of two edited ones; owes 4 ledger rows)"
tech-stack:
  added: []
  patterns:
    - "the DescribeKbPicker shape: four states held apart, one api symbol, parent owns the choice"
    - "spread-conditional on `!== undefined` so an absent field stays absent from the wire"
    - "the fallback IS the deliverable — null on every doubt, never a best guess"
    - "a hand-counted constant re-derived by a test in the same commit that wrote it"
key-files:
  created:
    - frontend/src/components/workflows/DescribeServicePicker.tsx
    - frontend/src/components/workflows/DescribeServicePicker.test.tsx
    - frontend/src/components/workflows/describeServiceMatch.ts
    - frontend/src/components/workflows/describeServiceMatch.test.ts
    - backend/tests/unit/test_214_describe_vocabulary.py
  modified:
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/useTemplateFirstDraft.ts
    - backend/app/api/workflows.py
    - backend/app/services/workflow_authoring.py
decisions:
  - "the refusal's predicate is NOT CONNECTED, never NOT TICKED — the governed sentence says `is not connected`, and a connected-but-unticked service would make it lie"
  - "the catalog is Phase 212's shipped presentation registry, not the author's connections — a catalog built from their connections could never contain the thing being refused"
  - "the frontend grant predicate MIRRORS grants.py's inheritance rather than reusing McpToolPicker's narrower isToolGranted, which does not inherit"
  - "the describe door ALWAYS sends allowed_connection_ids, including `[]`; `undefined` is reserved for mounts that carry no picker"
  - "the anchor's colour is asserted at the class list plus a real tailwind.config resolve — jsdom compiles no utilities, so a computed-style read would have been vacuous"
metrics:
  duration: ~3 h (interrupted by a provider session limit and resumed)
  completed: 2026-08-28
  tasks: 3
  commits: 3
  files: 12
---

# Phase 214 Plan 13: The Door That Knows Your Services — Summary

The describe door now asks which services a workflow may use **before** the AI drafts, refuses
by name when the author's prose names a service they have not connected, and — the half that
matters — **enforces the ticked set on the definition the model actually emitted** rather than
merely asking it nicely in the prompt.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `10112f833` | `DescribeServicePicker` — connected services as the generator's vocabulary, at the GRANT grain |
| 2 | `962124010` | `describeServiceMatch` + the door's second refusal arm + the colour ruling + the argued re-baseline |
| 3 | `9f4dc0c62` | the backend constraint, enforced on the emitted definition, threaded door → Builder → hook → wire |

## ⭐ The finding that matters: a prompt cannot deliver D-214-20's claim, and the code now says so twice

`workflow_authoring.py` already recorded, about its own interactive-step clause, that *"a prompt
clause reduces how often the model composes such a step; **it can never guarantee absence**."*
D-214-20 claims **structural impossibility**. Those two sentences cannot both be satisfied by a
prompt, so this plan ships **both halves and labels which is which**:

- `_render_vocabulary_block(...)` — the reduction. A paragraph naming the ticked connections and
  their granted actions, or a **forbid frame** when nothing was ticked (an empty list and a
  prohibition are different statements to a model; rendering *"connected services:"* followed by
  nothing invites the model to fill the gap).
- `_check_allowed_connections(...)` — the absence. It walks the **emitted** definition's
  `external_action` phases and returns `{"ok": False, "error": "connection_not_allowed"}` with
  **no `definition` key and no `readiness` key**.

Every enforcement case drives a model that emits an out-of-vocabulary step **anyway**, so the
tests measure the server rather than the prompt.

## The absent arm and the empty arm, held apart over ONE definition

`None` is *no preference* (today's behaviour, byte-identical); `[]` is the author's **decision**
that no external step may be emitted. The two are proven distinct rather than documented as
distinct: `test_an_empty_allowed_list_refuses_ANY_external_action` and
`test_absent_allowed_list_is_TODAYS_behaviour_exactly` run against a **byte-identical**
definition and reach opposite verdicts. Two source sweeps (`workflow_authoring.py` and
`api/workflows.py`) hold the collapsing expressions at zero, each with a positive control, and
the needles are **not spelled in either module's docblocks** — the 187-24 trap, which the plan
warned had already fired on this very field.

## ⚠ A hand-counted constant was wrong within minutes, and its own test caught it

The plan required the vocabulary block's length to be *"measured from the literal at runtime …
not hand-counted"*. I wrote the module comment as **236 and 178 characters** and wrote the
re-derivation test to assert them. **The test failed on its first run: the forbid frame is 237,
not 178.** Both homes were corrected to the measured value and both now record that the guard
fired in the commit that authored it. This is recorded rather than quietly fixed because it is
the entire argument for re-deriving instead of asserting — and because this module already
carries a WR-06 correction about a comment that credited a control with a mitigation it did not
deliver.

## ⚠ The re-baseline: argued, and the prediction that sent me looking was WRONG

Plan `214-03` handed this plan a re-baseline, warning that unifying the refusal's tone on the
warning token *"RE-BASELINES `WorkflowDoorSwitch.baseline.test.tsx`, WHICH PINS ALL SIX RESTING
STATES BYTE FOR BYTE."* **The BEFORE strings were extracted from git before any edit**, the
AFTER captured through a throwaway harness driving the same `doorCapture` shape, and the two
compared with `difflib.SequenceMatcher` opcode by opcode:

| row | before | after | delta | identical |
|---|---|---|---|---|
| CHOOSER_STANDALONE | 3218 | 3218 | +0 | **true** |
| CHOOSER_INLINE | 3367 | 3367 | +0 | **true** |
| DESCRIBE_STANDALONE | 5502 | 6228 | **+726** | false |
| DESCRIBE_INLINE | 5575 | 6301 | **+726** | false |
| GOVERN_STANDALONE | 3339 | 3339 | +0 | **true** |
| GOVERN_INLINE | 4091 | 4091 | +0 | **true** |

**Four of six are byte-identical, and the two that moved contain exactly ONE non-`equal` opcode
— an `insert`.** Zero `replace`, zero `delete`: nothing previously rendered was altered or
removed, and 726 bytes of new picker section arrive at one point in each.

⚠ **The colour ruling changed no capture at all.** `destructive` occurs **zero** times across
all six captures before the change and zero after, because the refusal never renders at rest.
The ruling *was* applied in full (the swap is real in `WorkflowDoorSwitch.tsx` and asserted in
`WorkflowDoorSwitch.test.tsx`) and it is simply invisible to this file. **Sketch 217 invariant
#1 is therefore confirmed by the diff rather than asserted** — and the thing that actually
forced the re-capture is the picker **mount**, not the colour.

## ⚠ Two measured traps worth not rediscovering

**1. The 196-08 mock-budget trap has a silent disguise.** `DescribeServicePicker` reads
`listConnectorConnections` inside the shipped best-effort `try/catch`. An undeclared export on a
suite's `@/lib/api` mock therefore does **not** throw the visible *"No export is defined"* —
it is **swallowed**, and the picker renders its *"we could not ask"* arm. A capture taken in
that state would have pinned an error arm as though it were the resting one. Measured, not
predicted: `WorkflowDoorSwitch.baseline.test.tsx`'s factory had no entry at all, while
`WorkflowDoorSwitch.test.tsx` already declared one from Phase 206.2 (my first edit created a
duplicate key, which I removed).

**2. The committed captures are RENDER-ORDER dependent.** They carry `for="_r_2_"` through
`for="_r_9_"`; `useId` numbers by render order within the file, so any render occurring after
the driver loop gets a different counter and can **never** equal a committed literal whatever
the markup does. Driven: my new positive-control case asserted equality first and failed on two
strings differing only in that id. **The byte-for-byte claim belongs to the driver loop and to
nowhere else** — the control now asserts refusing ≠ resting within one render, which is its
actual subject.

## The matcher: the fallback is the deliverable

`serviceAnchor` returns `null` on every doubt, and each is driven as a **subject**, not an edge
case — a naive `includes` passes the happy path and fails all five:

- a substring inside a longer word (`Notionally`, `Jirafe`, `unSlacked`)
- two different unconnected services in one description
- the same service named twice (two candidate spans is a coin toss dressed as a measurement)
- a service that IS connected (with a positive control proving the same text refuses when it is not)
- nothing named at all

`\b` is deliberately **not** used: a catalog name ending in a non-word character (`Node.js`)
inverts the assertion, so boundaries are checked on the neighbouring characters instead. A
regex-special name is escaped and matched literally, with both halves driven.

## Verification

| check | result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | **34 errors** — the measured baseline, unchanged across all three tasks |
| `DescribeServicePicker.test.tsx` | **20 passed** (plan asked ≥ 10) |
| `describeServiceMatch.test.ts` | **15 passed** |
| `WorkflowDoorSwitch.test.tsx` | **81 passed** (was 67 → `+11` refusal, `+3` key-link; **no residual**) |
| `WorkflowDoorSwitch.baseline.test.tsx` | **19 passed** (was 17 → `+2` invariant-#1 cases) |
| the nine scoped frontend suites together | **354 passed, 0 failed, 9 files** |
| `pytest tests/unit/test_214_describe_vocabulary.py` | **20 passed** (plan asked ≥ 6) |
| `pytest tests/unit -q -k "193_2 or authoring or 182"` | 171 passed, **1 failed** — see below |
| `pytest tests/unit` (full) | **67 failed / 3043 passed** vs the **68 / 3022** baseline |
| `grep -ciE "type=\"password\"\|token\|secret\|client_id"` on the picker | **0** |
| `grep -c "allowed_connection_ids or None\|... or []"` in `workflow_authoring.py` | **0** (swept by a test, with a positive control) |

⚠ **The backend arithmetic reconciles with NO residual, which is what makes it readable.**
Baseline `68F / 3022P` = 3090 total; now `67F / 3043P` = 3110 total. The `+20` is exactly this
plan's new file, and the remaining `68 → 67` is one previously-failing case now passing.

**`test_182_validate.py::test_interactive_phase_verdict_is_incomplete_and_per_node` is the one
red in the `-k` run, and it is PROVABLY UNMODIFIED** — absent from all three commits' diffs and
from the working tree (`git diff --numstat`, `git status --short`). Its failure is an
`interactive_phase` verdict missing from the `/validate` seam in `harness/grounding.py`, a file
this plan does not touch on any path. It is inside the inherited 68-failure baseline. ⚠ Said
precisely: **provably unmodified**, not "fine" — the worker cap was not touched and nothing was
re-run to make it green.

## The refusal's render path, named hop by hop (Task 3's acceptance criterion)

`connection_not_allowed` needs **no component change**, and that is a measurement rather than an
assumption:

`useTemplateFirstDraft.ts:580` — on `result.ok === false` calls
`store.getState().setErrorState(result.error, result.detail)` → `builderStore.ts:433-439` — sets
`builderPhase: "error"` + `errorMessage` + `errorDetail` → `WorkflowBuilderPage.tsx:2151` —
renders it.

The path is **agnostic about the code string**, which is why no plan's `files_modified` names a
component. ⛔ That is stated so it can be checked rather than believed: **plan `214-14`'s S-7
must drive this end to end.** A new `{"ok": False, "error": …}` code that reaches no screen is a
gate that refuses into a void, and *"it will be covered by the seam audit"* was this plan's first
answer while S-1..S-5 did not include it.

## Deviations from Plan

### `[Rule 2 — missing critical plumbing] TWO UNDECLARED PATH FILES: `WorkflowBuilderPage.tsx` and `useTemplateFirstDraft.ts``

- **Found during:** Task 3.
- **Issue:** The plan's `key_links` declare `WorkflowDoorSwitch.tsx → workflow_authoring.py` *"via
  the picked connection ids riding POST /workflows/generate"*. **`WorkflowDoorSwitch` makes no
  network call at all** — it hands off to the Builder, which owns the generate flow through
  `useTemplateFirstDraft`. Neither file appears in this plan's `files_modified`, nor in any
  sibling's. Without them the picker's set stops at the door and the declared key_link is
  unsatisfiable — the enforcement would be real but permanently unreachable from the UI.
- **Fix:** One additive optional prop per hop, on the shipped `initialProjectFolderId` (187-26)
  precedent — `initialAllowedConnectionIds?: string[]`. In the hook it is read through a **ref**
  rather than named in `onDraft`'s dependency list: an array prop has a new identity every
  render and the auto-draft effect depends on `onDraft`'s identity, so a dependency entry would
  turn the one-shot hand-off into a `/generate` loop (the file's own measured hazard).
- **Files modified:** `frontend/src/pages/WorkflowBuilderPage.tsx`,
  `frontend/src/components/workflows/useTemplateFirstDraft.ts`.
- **Commit:** `9f4dc0c62`.
- ⚠ **THIS IS A SCOPE NOTE THE PHASE CLOSE NEEDS, NOT AN INCIDENTAL.** It is precisely the
  finding `214-14`'s seam audit asks for — *"a path file no plan owns is named as a finding even
  when it needs no change"* — except that here both files **did** need a change. The DOM of both
  is unchanged (`WorkflowBuilderPage.describe.test.tsx` and `.preDraft.baseline.test.tsx` are
  green and unedited), and three driven cases prove the value reaches the wire.

### `[Plan-directed, corrected] the refusal's predicate is NOT CONNECTED, not NOT TICKED`

- **Found during:** Task 2.
- **Issue:** The plan specifies the matcher return a match *"that is **not** in the author's
  ticked set"*. But `DOOR_REFUSAL` is a governed, character-asserted sentence reading *"«service»
  is not connected"*. A service the author **has** connected but did not tick **is connected** —
  refusing it with those words would make a locked contract string say something false.
- **Fix:** The matcher takes `connectedServiceIds` (reported up by the picker from its own read,
  so there is no second fetch and no second source). The plan's stated criterion still holds by a
  strictly safer predicate: a ticked service is necessarily a connected one, so *"a match already
  in the ticked set produces no refusal"* is true here by construction.
- **Commit:** `962124010`.

### `[Plan-directed, narrowed] the anchor's colour is read as tokens, not as a computed style`

- **Issue:** The plan asks that invariant #11 be *"read from the computed style rather than the
  class name"*. **jsdom compiles no Tailwind**, so `getComputedStyle(el).textDecorationLine` is
  `""` for a utility class and a computed-style assertion would be **vacuous** — this exact
  hazard is recorded in the shipped source (*"fifteen of this sheet's colour tokens compile to
  nothing here and would render identically to an arm nobody painted"*). Injecting a stylesheet
  would have tested my own injection.
- **Fix, and it is weaker than asked — said plainly rather than dressed up:** the token is
  asserted at the class list (`underline`, `decoration-warning`, no `destructive`, with a
  positive control proving the destructive predicate fires), **and** `warning` is proved to
  RESOLVE in the real `tailwind.config.js` read through `?raw`. That second half is the shipped
  verification habit — 192.2 WR-01 measured `bg-warning` compiling to nothing across four
  surfaces because the key was missing while the CSS variable existed.
- **Commit:** `962124010`.

### `[Rule 3 — blocking] three small typecheck fixes in my own new test file`

Union-typed `onChange` in the picker suite's render helper (`TS2339` then `TS2322`), fixed
inline so no task closed above the 34-error baseline. Commits `10112f833`, `962124010`.

## Known Stubs

**One, and it is named with its owner rather than smoothed over.**

| Stub | File | Reason |
|---|---|---|
| `onOpenSettings` is unwired by any caller | `WorkflowDoorSwitch.tsx`, `DescribeServicePicker.tsx` | The app has **no url router** (`SEED-185`) and this shell owns no navigation. The refusal's `DOOR_REFUSAL_CONNECT` button and the picker's two next actions are the surfaces that need it. |

- **In the picker** the degradation is honest by construction: with no handler the next actions
  render as **statements** rather than controls, so the author still learns where to go and no
  affordance lies (the `DescribeKbPicker.onUploadDocuments` rule, followed).
- **In the refusal** it is weaker and must be said so: invariant #5 requires **exactly two**
  next actions, so `DOOR_REFUSAL_CONNECT` renders as a real button either way and, absent a
  handler, **its click is a no-op**. `DOOR_REFUSAL_REVISE` is fully real (it focuses the box).
- **Owner:** the caller that must supply the destination is `WorkflowsPage.tsx`, which **no plan
  in this phase owns**; `ChatLayout.tsx` (which holds `activeView`/`onNavigate`) belongs to
  sibling `214-12` and was deliberately not touched. **Re-open trigger:** the first phase whose
  `files_modified` names `WorkflowsPage.tsx`, or the first that gives the app a router.

## Threat register dispositions

| Threat ID | Disposition | How |
|---|---|---|
| T-214-13-01 | **mitigated** | Enforcement on the emitted definition (`_check_allowed_connections`), not the prompt. Three cases drive a model that emits the step anyway. |
| T-214-13-02 | **mitigated** | The check is on the **grant** grain via `is_tool_allowed` — gate 5.5's own predicate, imported not copied. A case drives three postures on one connection and asserts only `allow` survives. |
| T-214-13-03 | **mitigated** | Whole-word, case-insensitive, single-match-only, with the unanchored fallback. Five doubt cases, each of which fails a naive `includes`. |
| T-214-13-04 | **mitigated** | An `<img onerror>`-shaped describe text is driven through the door; the echo carries the literal characters and `querySelector("img")` is null. The raw-HTML fence is anchored on the **prop assignment** (the 214-03 remedy), with a positive control. |
| T-214-13-05 | **mitigated** | No credential field: `grep -ciE` on the picker is **0**, and the suite's fence anchors on attribute assignments rather than bare words — its own docblock says "credential" three times, which is the 187-24 trap seen from the other side. |
| T-214-13-06 | **mitigated** | Nothing is drafted on a refusal: the CTA is disabled, `mockGenerateWorkflow` is asserted uncalled, and the server response carries no `definition` and no `readiness` key. |
| T-214-13-07 | **mitigated** | Length re-derived from the literal by a test — **which caught my own hand-counted figure being wrong (178 vs 237) on its first run.** |
| T-214-13-SC | **mitigated** | Nothing installed; `package.json` and `requirements.txt` untouched. |

## What this plan did NOT do

- **No `scripts/vitest-count-gate.cjs` edit** — `214-15` owns every pin. It owes: two **new**
  `BASELINE` entries (`DescribeServicePicker.test.tsx` **20**, `describeServiceMatch.test.ts`
  **15**) and two **re-pins** (`WorkflowDoorSwitch.test.tsx` 67 → **81**,
  `WorkflowDoorSwitch.baseline.test.tsx` 17 → **19**). Both new suites live under
  `src/components/workflows`, already a directory entry in `TARGETS`, so they run today.
  ⚠ These are scoped-run figures, not the gate's own `— N new` column; prefer the gate's at merge.
- **No hot-file ledger row** — `214-15` owns them. Four are touched and all four are STALE:
  `WorkflowDoorSwitch.tsx` (cell `13 / 9 / 575`, measured `16 / 11 / 817` at plan time and now
  higher), `backend/app/api/workflows.py` (`38 / 19 / 2143`, re-derived `40 / 21 / 2192` in wave
  2), `backend/app/services/workflow_authoring.py` (`13 / 7 / 625`), plus
  `frontend/src/pages/WorkflowBuilderPage.tsx` (`51 / 17 / 2867`).
  **`api/workflows.py`'s *extraction due* disposition is NOT discharged here** and must not be
  written as `satisfied`.
- **No `STATE.md` / `ROADMAP.md` write** — the orchestrator owns those after the wave.
- **No full count gate** — the orchestrator owns it post-merge; three siblings were active.
- **No migration.** This phase's field rides an existing JSONB config; nothing schema-shaped moved.

## G-5 disposition

**`WorkflowDoorSwitch.tsx` — honoured by construction, and the argument is measurable rather
than asserted.** Both new concerns LEFT the file: the picker is its own component (the
`DescribeKbPicker` precedent, already established on this very screen) and the matcher is its own
zero-import pure module. What landed in the shell is **+11 lines** (`git diff --numstat`) —
two imports, one derived module-scope constant, two state hooks, one mount, one derived value and
**one ordered precedence check**, which is the only genuinely new logic and is deliberately
written as a comment-carrying branch rather than an incidental `||`.

**`workflow_authoring.py` — honoured by construction:** one keyword-only parameter on the
`template_placeholders` precedent, one prompt paragraph, one resolve and one post-emit loop. No
new provider call; the one/two-call budget (REQ-2 a/b) is asserted unchanged, including that a
**refusal does not retry**.

**`api/workflows.py` — honoured by construction:** one optional request field and one forwarded
argument. ⚠ Its **extraction obligation stays OWED**.

**`WorkflowBuilderPage.tsx` / `useTemplateFirstDraft.ts` — pass-through only**, +19 and +43
lines, all of it one prop and its documentation. Neither gains a rule.

## Self-Check: PASSED

All five created files present on disk; all three commits (`10112f833`, `962124010`,
`9f4dc0c62`) resolve in `git log`. The throwaway capture harness
(`__regen_tmp.test.tsx`) was deleted before the first commit and appears in no commit —
`git status` is clean.
