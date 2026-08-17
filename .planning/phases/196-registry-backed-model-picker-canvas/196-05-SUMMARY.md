---
phase: 196-registry-backed-model-picker-canvas
plan: 05
subsystem: workflow-authoring-canvas
tags: [ui, picker, model-registry, emit_tier, two-audience, source-fence, count-gate, AUTH-04]
requires:
  - phase: 196-04
    provides: "GET /models/registry + AuthorModelRow + getAuthorModelRegistry — the six-field author projection this plan consumes"
  - phase: 196-01
    provides: "emit_tier on model_capabilities_overrides (mig 120) — nullable, all 37 rows NULL today, which is why the read-time default is the dominant path"
  - phase: 154
    provides: "TechnicalNamesProvider — the ONE app-wide ⌥ reveal boolean the panel threads into showTechnical"
provides:
  - "frontend/src/components/workflows/modelFitness.ts — the tier→words mapping, the read-time default and the boundary guard"
  - "frontend/src/components/workflows/ModelField.tsx — the registry-only picker; pure function of props, no state, no effect, no fetch"
  - "frontend/src/hooks/useModelRegistry.ts — the ONE author-registry fetch, with a failure reading that is not an empty success"
  - "three suites adopted into the count gate (one TARGETS entry + three BASELINE pins)"
affects:
  - "196-08 (mounts all three — ModelField four times, useModelRegistry once above the panel)"
  - "196-09 (owes hot-file ledger rows — D-23; scripts/vitest-count-gate.cjs is ABSENT and FIRES at 16 phases)"
tech-stack:
  added: []
  patterns:
    - "runVocabulary.ts leaf discipline applied to a server enum: words here, derivation on the server, own-guarded lookup, docblock that does not spell the tokens its own fence forbids"
    - "no-write-on-open proved TWICE — behaviourally (call counts on both callbacks) and structurally (a ?raw source fence with an observed positive control)"
    - "a client fence worded as `no RUNTIME import of the api module` rather than as a grep for one export name — stronger, and it cannot trip the criterion it defends"
key-files:
  created:
    - frontend/src/components/workflows/modelFitness.ts
    - frontend/src/components/workflows/modelFitness.test.ts
    - frontend/src/components/workflows/ModelField.tsx
    - frontend/src/components/workflows/ModelField.test.tsx
    - frontend/src/hooks/useModelRegistry.ts
    - frontend/src/hooks/__tests__/useModelRegistry.test.ts
  modified:
    - scripts/vitest-count-gate.cjs
key-decisions:
  - "ModelField does NOT import the panel's FieldLabel and renders the same two-audience structure locally. FieldLabel is a private function in PhaseFormPanel.tsx; exporting it would have made the pair a genuine ESM cycle the moment 196-08 mounts the picker. The plan's <interfaces> assumed the primitive was importable — it is not."
  - "The client fence in ModelField.test.tsx forbids any RUNTIME import of `@/lib/api` instead of greping for the registry reader's name. The token grep would have tripped this plan's own acceptance criterion on the fence defending it (the 187-24 trap plan 196-04 hit three times)."
  - "The unknown-value caption sits OUTSIDE the <select>, in SelectField's caption position — a native <option> cannot host markup, which is also why fitness is expressed as <optgroup> grouping rather than a per-option suffix."
  - "modelFitness.ts resolves an unrecognised tier with hasOwnProperty, not `?? floor`: a plain object literal inherits `constructor`/`toString`, none of which is nullish, so a coalesce hands back a FUNCTION typed as the table's value type (the shipped phaseStatusFromDb bug)."
requirements-completed: [AUTH-04]
duration: 40min
completed: 2026-08-18
---

# Phase 196 Plan 05: The Registry-Backed Model Picker Summary

**Three new leaf files replace a free-text model box with a control that can only offer ids
the live registry knows — and that hedges what a run would inherit instead of asserting a
default the code does not implement.**

## Performance

- **Duration:** ~40 min (bootstrap → task 3 commit)
- **Tasks:** 3/3
- **Files created:** 6 · **Files modified:** 1
- **Commits:** `01d37adb` · `0e9cf0a1` · `e9e2ecf6` · `0010274c` · `122e3b41`
- **Deleted files across the plan:** none (`git diff --diff-filter=D` empty)

## What shipped

| Layer | Change | Cases |
|---|---|---|
| Vocabulary | `modelFitness.ts` — the tier→words map, `EMIT_TIER_ORDER`, the read-time default AND the boundary guard | **18** |
| Presentation | `ModelField.tsx` — registry-only picker, pure function of props | **32** |
| Data | `useModelRegistry.ts` — the ONE author-registry fetch | **11** |
| Gate | 1 `TARGETS` entry + 3 `BASELINE` pins | — |

**61 cases total**, all three suites green together:
`Test Files 3 passed (3) · Tests 61 passed (61)`.

## The two label strings, verbatim, in both forms

The plan's `<output>` asks for these exactly:

- **Resolved** — `Use the run's model — today that would be deepseek-v4-flash`
- **Degraded** (`runDefaultModel === null`) — `Use the run's model`

The clause is appended by the component; the id is whatever the server resolved. The
degraded form carries no clause, no `today`, and no id. `grep -c 'gpt-5.4'` on the
component → **0**, and there is no `Effective:` footer anywhere (`grep -c` → **0**).

The apostrophe is ASCII `U+0027` (checked against the plan's own bytes with `od -c` before
the literal was written — a curly quote would have made the acceptance grep and the test
literal disagree invisibly). The two em dashes are `U+2014`, asserted by codepoint in
`modelFitness.test.ts`.

## The source fence, and its positive control — OBSERVED, not merely asserted

The inline-fixture control passes:

```
✓ SOURCE fence: no component state, no effect, by construction > POSITIVE CONTROL — the extractor really can find both tokens
✓ … > NON-VACUITY — the source really was loaded, and really is the picker
✓ … > the component source contains ZERO occurrences of either token
✓ … > …and it cannot fetch: the api client is reached ONLY as an erased type import
✓ … > POSITIVE CONTROL — the import fence really can find a runtime import
      Tests  5 passed | 27 skipped (32)
```

**And the fence was additionally driven RED against a real plant in production source**, which
the plan did not require but this repository's habit does. A `useState` + `useEffect` pair was
inserted into `ModelField`'s body:

```
AssertionError: expected 1 to be +0 // Object.is equality
      Tests  1 failed | 31 skipped (32)
```

The file was then restored and is **md5-identical** to its pre-plant state
(`66f8987cb7430ef9f15b07f6f118c73a` before and after; `git status --short` empty).

## The count gate — verdict line verbatim, and the per-file deltas

Run 1 (**before** the `BASELINE` pins, which is where the `actual` column comes from — the
plan forbids taking these numbers from any document, including itself):

```
  ModelField.test.tsx                           —      32     new
  modelFitness.test.ts                           —      18     new
  useModelRegistry.test.ts                       —      11     new
  -------------------------------------------------------------
  total                                      4123    4258    +135
  total 4258  ·  failed 1  ·  pinned total 4123
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 1 test(s) failed — the gate requires 0.
```

Runs 2 and 3 (**with** the pins, identical to each other):

```
  ModelField.test.tsx                          32      32       0
  modelFitness.test.ts                         18      18       0
  useModelRegistry.test.ts                     11      11       0
  -------------------------------------------------------------
  total                                      4184    4258     +74
  total 4258  ·  failed 0  ·  pinned total 4184
count gate OK — 87/87 pinned files present, no per-file decrease, 0 failing.
```

**A growing total is the gate WORKING.** Against the wave-2 close (`total 4197 · pinned 4123
· 84/84`) this plan takes the grand total to **4258**, the pinned total to **4184** and the
pinned-file count to **87/87** — `+61` pinned cases, exactly this plan's three suites, and
`+3` pinned files. The three `— new` rows in run 1 are the proof the suites RAN before they
were pinned, which is the `TARGETS`-vs-`BASELINE` distinction the script records as a rule.

⚠ **`ModelField.test.tsx` is pinned at 32, not the 31 its first green run measured.** The
+1 landed in task 3, when the client fence was rewritten (see Deviations). The pin was set
from the gate's own column after that rewrite, so the number in the script and the number on
disk were never out of step.

## SEED-171 triage — the one failing test in run 1

**`frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx`**

```
WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
  POSITIVE CONTROL — with the flag ON the very same read finds the key
AssertionError: expected 0 to be greater than 0
```

**That file is provably unmodified by this plan.** It appears in neither
`git diff --numstat 3dd4844e..HEAD` (four files, all created by this plan) nor
`git status --short` at the time of the run, and nothing this plan created is imported by it
— all three new modules are leaves, and the mount that would connect them to
`WorkflowBuilderPage` is plan 196-08's, not written yet.

Two things are recorded rather than smoothed over:

1. ⚠ **It is NOT one of SEED-171's three named suites.** SEED-171 names
   `WorkflowsPage.test.tsx`, `library/WorkflowCard.test.tsx` and
   `WorkflowBuilderPage.session.test.tsx`. This is a **fourth** file, and the failure is a
   plain `AssertionError`, not a `STACK_TRACE_ERROR` — matching SEED-171's own correction
   that the timeout signature is not a reliable tell. Whether this widens SEED-171's set or
   is a distinct flake is **not established by one observation** and is left as one.
2. ⚠ **The cap was NOT touched.** Every run in this plan used `GSD_VITEST_MAX_WORKERS=2`.

**One green sample is not proof of innocence** — runs 2 and 3 read `failed 0`, and that is
recorded as an observation, not as a clearance.

⚠ **A PROCESS SLIP, RECORDED BECAUSE IT WAS ONE:** I re-ran the gate before extracting the
failing filename, which is exactly what CLAUDE.md's triage protocol forbids. Nothing was
lost — the gate persists its JSON report per run and the first run's file was still on disk
(`vitest-count-gate-44152-1787007892092.json`), so the failure above was recovered from run
1's own report rather than from the re-run. The rule holds anyway: the recovery worked by
luck of retention, not by design.

## Verification

| Check | Result |
|---|---|
| `vitest run modelFitness.test.ts` | **18 passed** |
| `vitest run ModelField.test.tsx` | **32 passed** |
| `vitest run useModelRegistry.test.ts` | **11 passed** |
| The three together | **3 files / 61 passed** |
| `node scripts/vitest-count-gate.cjs` (×2, with pins) | **count gate OK · 4258 · failed 0 · 87/87** |
| `npx tsc --noEmit -p tsconfig.app.json` | **33 errors across 19 files — IDENTICAL to the wave-1/wave-2 baseline; ZERO in any file this plan touched** |
| `npx eslint` on all six new files | **clean, 0 problems** |
| Source fence driven RED against a real plant, then restored | **md5-identical** |
| `git diff --name-only` contains `SettingsPage.tsx` or `ModelPillRow.tsx` (SC#3) | **NO — five paths total, none of them either** |

⚠ **`npx tsc --noEmit -p tsconfig.app.json` does NOT exit 0, and this plan's acceptance
criteria asking for exit 0 are unreachable on this tree.** Wave 1 recorded the same 33-error
baseline before this phase began and plan 196-04 recorded it again. The honest bar is
per-file and it is clean: `tsc … | grep -E 'ModelField|modelFitness'` → **no output**, and
`src/hooks/useModelRegistry.ts` likewise. The total was **33 before and 33 after** every one
of this plan's three tasks.

### The mechanical fences from the plan's acceptance criteria

| Grep | Target | Required | Measured |
|---|---|---|---|
| `from "react"\|useState\|useEffect\|useMemo\|JSX\|tsx` | `modelFitness.ts` | 0 | **0** |
| `useState\|useEffect` (comments included) | `ModelField.tsx` | 0 | **0** |
| `<input\|type="text"\|contentEditable` | `ModelField.tsx` | 0 | **0** |
| `Effective model:\|Effective:` | `ModelField.tsx` | 0 | **0** |
| `@lobehub/icons` | `ModelField.tsx` | 0 | **0** |
| `gpt-5.4` | `ModelField.tsx` | 0 | **0** |
| `vi.mock` (loose, not only the strict call) | `ModelField.test.tsx` | 0 | **0** |
| `getAuthorModelRegistry` | `frontend/src/components/` | 0 | **0** |
| `getAuthorModelRegistry` | `useModelRegistry.ts` | ≥ 1 | **3** |
| `Use the run's model` · `(current)` · `not in the registry` · the full caption | `ModelField.tsx` | present | **all four** |

Two of these read non-zero on a first draft and were fixed by REWORDING PROSE, never by
waiving the criterion — see Deviations.

## Deviations from Plan

### 1. [Rule 3 — Blocking] `FieldLabel` is not importable, and exporting it would create an ESM cycle

- **Found during:** Task 2, while composing with the panel's primitives.
- **Issue:** the plan's `<interfaces>` instructs *"ModelField renders its own `<select>` and
  reuses `FieldLabel`"* and lists `<FieldLabel htmlFor={id} …>` among four things to copy.
  **`FieldLabel` and `InfoHint` are private `function` declarations inside
  `PhaseFormPanel.tsx`** (`:239`, `:262`) — neither is exported, and the file has no
  companion module. Grep confirms exactly one definition tree-wide.
- **Why the obvious fix is wrong:** adding `export` is one token and lint-clean, but
  `PhaseFormPanel.tsx` is about to import `ModelField` (plan 196-08's whole job), so an
  import back the other way makes the pair a **genuine ESM cycle**. It would resolve today
  (hoisted function declarations) and be fragile forever — and `modelFitness.ts`'s own
  docblock claims a cycle is impossible by construction, which would read poorly beside a
  sibling that just created one. Extracting `FieldLabel` into its own module is the right
  architecture but is a real refactor of a G-5 hot file, outside `files_modified`, and
  collides with 196-08's capped diff.
- **Fix:** `ModelField` renders the same two-audience structure locally — the `<label
  htmlFor>` with its grey qualifier and its ⓘ (`tabIndex`/`role="button"`/`aria-label`/`title`,
  the panel's exact a11y contract), then the always-visible `data-testid="field-help"`
  paragraph. The component's docblock states why the import is absent and that a change to
  the panel's label must be mirrored; the rendered assertions in the suite (accessible name
  via `getByRole("combobox", { name: /ai model/i })`) pin the structure rather than leaving a
  copy-confession with no guard.
- **⚠ Recommended for 196-08 or 196-09:** extract `FieldLabel` + `InfoHint` into
  `frontend/src/components/workflows/FieldLabel.tsx` and have both files import it. That is
  the only move that removes the duplication without creating the cycle, and it is a
  `PhaseFormPanel.tsx` edit, which is 196-08's file to touch, not this plan's.
- **Files:** `frontend/src/components/workflows/ModelField.tsx`
- **Commit:** `0010274c`

### 2. [Rule 3 — Blocking] Two acceptance greps failed on PROSE and on a fence's own needle

- **Found during:** Task 2 and Task 3 acceptance checks.
- **Issue A:** `grep -c 'vi.mock' ModelField.test.tsx` returned **1**. The strict criterion
  (`vi.mock("@/lib/api")`) already read 0, but the hit was in the docblock paragraph
  *explaining why the stub must not be there* — the 187-24 trap, which plan 196-04 hit three
  times in one afternoon.
- **Issue B:** `grep -rc 'getAuthorModelRegistry' frontend/src/components/` returned **1**,
  from the source fence's own needle string inside `ModelField.test.tsx`.
- **Fix A:** the paragraph was reworded to name the concept without the literal token
  ("the api client module is deliberately not stubbed"), and now says explicitly that a grep
  for that call over the file must come back empty — so the prose defends the fence instead
  of tripping it. Loose grep now **0**.
- **Fix B:** ⚠ **the fence was made STRONGER rather than merely quieter.** It now asserts
  *no RUNTIME import of `@/lib/api` at all* — `occurrences(src, 'from "@/lib/api"') === 1`
  plus `src` contains the exact erased `import type` line, plus zero `fetch(` and zero
  `await `. A token grep forbade one function and waved through the module's other ~200
  exports; this forbids the whole surface, spells no forbidden token, and gained its own
  positive control (a runtime-import fixture the needle finds, and a type-import fixture it
  distinguishes). That is the +1 case that took the file 31 → 32.
- **Files:** `frontend/src/components/workflows/ModelField.test.tsx`
- **Commits:** `e9e2ecf6`, `122e3b41`

### 3. [Rule 2 — Missing critical] The hook aborts with a flag, not an `AbortController`

- **Found during:** Task 3, modelling on `useTemplatePlaceholders`.
- **Issue:** the sibling hook passes `controller.signal` into its client call.
  **`getAuthorModelRegistry` accepts no signal** (plan 196-04 shipped it with none), so
  copying the shape verbatim would have produced an `AbortController` that aborts nothing —
  ceremony that reads as discipline.
- **Fix:** a `cancelled` flag with the same post-await guard, and a comment stating plainly
  that there is no request to abort and that what the guard prevents is a state update after
  unmount. A case asserts an answer landing after unmount updates nothing and logs no error.
- **Commit:** `122e3b41`

### Correction to the plan's `<interfaces>`, not a deviation

The plan cites `PhaseFormPanel.tsx:336-376` for `SelectField` and `:876-884` for the field
being replaced. Both are accurate on this tree (`SelectField` at `:337-376`, the `llm_single`
`AI model` mount at `:876-884`). Recorded because the plan's own instruction — *"re-open
every file, line numbers rot"* — is what made it worth checking, and this time nothing had.

## What this plan did NOT do, and cannot prove

- **It mounts nothing.** The four `TextField` mounts in `PhaseFormPanel.tsx` are still
  free-text; plan 196-08 replaces them. **AUTH-04 is not observable by a user until then** —
  everything here is a component that exists and is proved correct in isolation.
- ⚠ **"A `coerce` model is distinguishable BEFORE selection" is proved as MARKUP, never as
  HUMAN EXPERIENCE.** A render test proves the `<optgroup>` boundaries exist and that the two
  tiers carry different labels. It cannot prove a person notices. That is G-4 row **U-A2** in
  `196-VALIDATION.md` and is not discharged by this plan being green.
- **The fitness grouping was never seen by an operator.** G-2 fired and was declined on D-21
  (the picker idiom ships twice already), so the acceptance bar was the shipped components —
  which is a defensible bar for the `<select>` and its `(current)` idiom, and a weaker one for
  the `<optgroup>` grouping, which neither shipped picker has.

## G-5 / D-23 note — one touched file is ABSENT from the hot-file ledger, and it FIRES

Triple RE-DERIVED at close with CLAUDE.md's own recipe (three six-digit quick-task buckets —
`260807`, `260808`, `260814` — excluded from the 19 raw buckets), never copied forward:

| File | commits / phases / lines | In ledger? | G-5 |
|---|---|---|---|
| `scripts/vitest-count-gate.cjs` | **98 / 16 / 3110** | **NO** | ⚠ **FIRES** |

⚠ **This is the `WorkflowsPage.tsx` failure mode again, on the file that enforces the
guardrails.** Sixteen phases have edited the gate script — `184 · 184.1 · 185 · 187 · 188 ·
188.1 · 188.2 · 189 · 190 · 192 · 192.1 · 193 · 193.1 · 194.1 · 195 · 196` — and it has no
ledger row, so it has been invisible to its own guardrail for its entire life. It is also
3110 lines, the great majority of them the comment register that makes each pin auditable.
**Plan 196-09 owes it a row AND a `docs/HOT-FILE-LEDGER.md` detail section under the
same-commit sync rule, with the figures re-derived at that close** — the ledger's own most
repeated finding is that a triple written at a phase's close is stale by the next commit, and
this one will be stale the moment 196-07 edits the same file.

**G-5 is honoured by construction for this plan regardless:** the gate edit is **purely
additive** — one `TARGETS` entry, three `BASELINE` keys and their comment blocks. `git diff`
shows the only `-` lines are the three replaced by the reworded fence in `ModelField.test.tsx`;
the script itself lost nothing (`438 insertions(+), 3 deletions(-)` across the whole task-3
commit, and all three deletions are in the test file).

The six files CREATED by this plan are at 0 phases and owe a ledger row the moment they reach
a third. `frontend/src/components/workflows/ModelField.tsx` is the one to watch: it is the
surface 196-08 mounts four times and the one a fitness or icon change would return to.

## Known Stubs

None. No placeholder values and no unwired data source: `useModelRegistry` talks to the route
plan 196-04 shipped, `ModelField` renders whatever rows it is handed, and `modelFitness`
holds real words for a real column. The picker is not mounted yet — that is plan 196-08's
deliverable and therefore scope, not a stub. `showFitness` and `showTechnical` are optional
props with no caller yet for the same reason; both arms are exercised by the suite.

## Threat Flags

None. No new network egress (the component cannot reach the client module at all — fenced),
no new file access, no schema change. The one trust boundary this plan sits on — server
payload → rendered option and optgroup labels — is already enumerated in the plan's
`<threat_model>` as `T-196-XSS / accept`, and the disposition is unchanged: labels are React
text children of `<option>` and `<optgroup label>`, there is no `dangerouslySetInnerHTML`
anywhere in the component, and `T-196-LEAK-UI` is honoured structurally — the props type is
`AuthorModelRow` (six fields), never `ModelRegistryRow`, so `deprecated_reason` is
unreachable from this surface.

`T-196-TAMP1` and `T-196-TAMP2` are both **mitigate** and both discharged: TAMP1 by the
behavioural zero-call cases on two stored values plus the source fence with its observed
control, TAMP2 by the explicit blur-idempotence case. `T-196-HONEST` is discharged by the
two greps (`Effective:` → 0, `gpt-5.4` → 0) plus the two label cases. `T-196-SC` — no
packages installed by this plan.

## Self-Check: PASSED

- `frontend/src/components/workflows/modelFitness.ts` — FOUND
- `frontend/src/components/workflows/modelFitness.test.ts` — FOUND
- `frontend/src/components/workflows/ModelField.tsx` — FOUND
- `frontend/src/components/workflows/ModelField.test.tsx` — FOUND
- `frontend/src/hooks/useModelRegistry.ts` — FOUND
- `frontend/src/hooks/__tests__/useModelRegistry.test.ts` — FOUND
- commits `01d37adb`, `0e9cf0a1`, `e9e2ecf6`, `0010274c`, `122e3b41` — all FOUND in `git log`
- TDD gate sequence present in log order: `test(196-05)` → `feat(196-05)` for task 1, and
  `test(196-05)` → `feat(196-05)` for task 2
- `.planning/STATE.md` / `.planning/ROADMAP.md` — deliberately **UNTOUCHED** (orchestrator-owned;
  `git diff --name-only` against the base names five paths, none under `.planning/` except
  this summary)
