---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 07
subsystem: workflows
tags: [localstorage, browser-local-preference, zero-migration, step-type-picker, refusal, plain-language, 3d-marks, accessibility, source-fence, react-19]

# Dependency graph
requires:
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential"
  - phase: 184-02
    provides: "`definitionOps.allowedTypesAt` (with its corrected strictly-after boundary) + `STRANDING_REASON` + `PHASE_TYPE_ORDER` — every row and every refusal sentence the picker renders"
  - phase: 184-03
    provides: "`nodePresentation.renderPhaseMark` + `ICON_TINT`/`DEFAULT_TINT` — the 3D mark and the one type-tint table"
  - phase: 184-04
    provides: "`builderStore` — the tracked store the nudge is structurally absent from"
  - phase: 183-read-only-canvas
    provides: "`phaseVocabulary.PHASE_TYPE_SENTENCES` / `PHASE_TYPE_SUBTITLES` (D-183-06) and `useTechnicalNamesOptional`'s shipped fail-closed usage"
provides:
  - "`canvasNudge.ts` — the browser-local, user+draft-scoped cosmetic `dy` map; the ONLY module in the canvas editing surface that touches browser storage"
  - "R3's zero-migration half made structural: the `dy` cannot reach the definition or a request body, and slot 114 stays RESERVED"
  - "`StepTypePicker.tsx` — the plain-language `＋` menu with 3D marks and R10b's inline disabled reason"
  - "R10 proven for the picker: a client SHAPE refusal that provably never consults the server verdict seam"
affects: [184-08, 184-10, 184-11, 184-12, 184-13, 185, 186, 188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A storage module whose per-user key scoping is asserted by a two-user isolation test rather than only documented — and falsified by removing the user segment"
    - "A refusal rendered CHARACTER-IDENTICAL to the pure module's constant, which is what proves the component authored none of its own"
    - "A no-durable-state fallback (module-level session bucket) whose proof is `localStorage.length` unchanged — absence measured, not asserted"
    - "A source fence deliberately NOT written when it would force an honest docblock to omit the thing it is about (the D-ITEM-183-02 trap, avoided at authoring time)"

key-files:
  created:
    - frontend/src/components/workflows/canvasNudge.ts
    - frontend/src/components/workflows/canvasNudge.test.ts
    - frontend/src/components/workflows/StepTypePicker.tsx
    - frontend/src/components/workflows/StepTypePicker.test.tsx
  modified: []

key-decisions:
  - "The resolved nudge key is `agentic-rag.canvas-nudge.v1.<user_id>.<draft_id>` — one flat key per user per draft, so 'Tidy up' is a single `removeItem` on exactly this workflow and can never sweep a neighbour"
  - "A session with NO resolvable user id takes the same in-memory path as an unsaved draft: without a user segment the only available key would be unscoped, which is precisely the leak the per-user scoping exists to prevent"
  - "`streamsCache`'s evict-half-and-retry quota policy was deliberately NOT copied — that policy exists because chat scrollback is large; evicting another feature's data to store a five-number offset map is the wrong trade"
  - "Nudges made before a draft's first save are NOT migrated into the newly-minted key — recorded as accepted behaviour rather than solved with a write path that invents durable state"
  - "The picker asserts the refusal boundary on BOTH sides (index 2 enabled, index 3 refused) so 184-02's corrected strictly-after rule is visible in the suite rather than assumed"
  - "No `-auth-token` source fence was written on `canvasNudge.ts`: it would have forced the docblock to omit the very read it explains reusing"

patterns-established:
  - "Falsify a storage module's isolation claim by deleting the scoping segment — 5 assertions turned red, which is what makes the other 26 evidence"
  - "Falsify a 'nothing is ever hidden' claim by filtering the refused rows out — 6 assertions turned red, including the six-row count the R10b assertions depend on"
  - "Choose a test fixture whose slugs cannot collide with the plain-language vocabulary: a 'no slug rendered' assertion using the slug `deliver` would have failed on the sentence 'Produce the deliverable', and one using `search` would have passed for the wrong reason"

requirements-completed: []  # CANVAS-02 and VALID-02 are this plan's frontmatter requirements and NEITHER is complete. Both leaf modules are UNMOUNTED — 184-12 wires them. REQUIREMENTS.md deliberately untouched; the orchestrator marks all 5 at phase end.

# Metrics
duration: 35min
completed: 2026-07-27
---

# Phase 184 Plan 07: canvasNudge + StepTypePicker Summary

**The cosmetic vertical offset now lives in ONE browser-local module keyed `agentic-rag.canvas-nudge.v1.<user_id>.<draft_id>` that adds ZERO migration files, cannot reach the definition or a request body, and persists literally nothing for a draft with no id — and the `＋` menu now offers all six step types in plain language with their 3D marks, rendering a refused choice DISABLED with a sentence it did not author and provably never asks the server for.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-27T10:30:00Z
- **Completed:** 2026-07-27T11:05:00Z
- **Tasks:** 3 (all `auto`, all committed atomically)
- **Files created:** 4 · **Files modified:** 0

## Task Commits

1. **Task 1: `canvasNudge.ts` — the browser-local, user+draft-scoped `dy` map** — `2128dda3` (feat) — `canvasNudge.ts` (205 L) + `canvasNudge.test.ts` (31 tests)
2. **Task 2: `StepTypePicker.tsx` — plain language, 3D marks, inline refusal** — `782c4de9` (feat) — `StepTypePicker.tsx` (207 L)
3. **Task 3: `StepTypePicker.test.tsx` — R10b's component half and the zero-network proof** — `51e8bdca` (test) — 34 tests

## The resolved nudge key shape, and the migration count

**`<output>` requires both to be stated explicitly.**

- **Resolved key:** `agentic-rag.canvas-nudge.v1.<user_id>.<draft_id>` — asserted verbatim
  (`canvasNudgeKey("u1","d1")` → `agentic-rag.canvas-nudge.v1.u1.d1`), with the prefix pinned to
  `"agentic-rag.canvas-nudge.v1"` in the same test. One flat key per user per draft, holding the
  whole slug → `dy` map, so "Tidy up" is one `removeItem` on exactly this workflow.
- **Migration files added by this plan: ZERO.** `git diff --name-only 2128dda3~1 HEAD -- supabase/migrations`
  returns **0 lines**. Slot 114 (`workflow_layouts`) stays **RESERVED, not spent**, and the written
  promotion trigger is carried verbatim in the module docblock: promote when *either* a nudge must
  survive across devices, *or* a layout is deliberately shared between editors. **Neither is true today.**

## Accomplishments

- **R3's "zero server state" is structural, not observed.** `canvasNudge.ts` imports neither the builder
  store, the canvas model nor the API client (asserted by a `?raw` fence with planted-literal controls),
  and a whole-suite request spy recorded **0 calls** across 31 tests. A `dy` has no path into the
  definition JSONB or an outgoing body even by accident, which is why Phase 186 / CONCUR-01's *"a
  cosmetic drag never mints a version"* is true by construction here rather than being a live code path.
- **T-184-07-01 closed by test, not by intent.** Two users on one origin resolve to two keys and never see
  each other's map; `clearNudges` on one draft leaves a sibling draft AND the other user's key intact.
  Removing the user segment from the key turned **5** of those assertions red (below).
- **The unsaved draft persists nothing, measured.** `localStorage.length` is **unchanged** after a
  `writeNudge(null, …)`, and the set of keys under the prefix is empty — so there is no orphan-key bucket
  to garbage-collect. The same path covers a session with no resolvable user id.
- **R10b landed with the refusal visible.** Past the deliverable all six rows carry `aria-disabled="true"`
  **and** `disabled`, the reason is real DOM text (never a `title`), `aria-describedby` resolves to that
  exact node, and a click on a refused row does not call `onChoose`. Six rows render at **every** tested
  index — empty, start, end, either side of the deliverable, out of range, negative.
- **The picker provably authored no reason of its own.** The rendered sentence is asserted
  character-identical to `definitionOps.STRANDING_REASON`; a fence proves the file names no server route,
  imports no API client and opens no request; the suite's spy recorded **0** calls.
- **Nothing shipped can regress.** Neither module is mounted — 184-12 wires them — so all three commits are
  additive-only. `git diff --diff-filter=D` across the whole plan reports **0** deletions.

## Files Created

- **`frontend/src/components/workflows/canvasNudge.ts`** (205 L) — exports `CANVAS_NUDGE_KEY_PREFIX`,
  `canvasNudgeKey`, `readNudges`, `writeNudge`, `clearNudges` and the `NudgeMap` type. Owns **all**
  storage access for the cosmetic nudge; reuses the shipped `getCurrentUserIdSync()` rather than
  re-deriving the auth read.
- **`frontend/src/components/workflows/canvasNudge.test.ts`** (398 L, 31 tests) — key namespace, round
  trip, two-user isolation, two-draft isolation + scoped Tidy-up, the zero-key unsaved draft, the
  defensive read (corrupt / non-numeric / non-object / throwing), the quota discipline, the source fence
  with controls, and the whole-suite request spy.
- **`frontend/src/components/workflows/StepTypePicker.tsx`** (207 L) — exports `StepTypePicker` and
  `StepTypePickerProps`. A leaf: `phases` + `index` in, `onChoose(type)` / `onDismiss()` out. No store
  reference, no placement, no phase creation, no slug field.
- **`frontend/src/components/workflows/StepTypePicker.test.tsx`** (379 L, 34 tests) — the six-row and
  order proofs, R10b on both sides of the boundary, the no-editable-slug scan, dismissal + keyboard, the
  provider-less ⌥ reveal, the 3D-mark-is-an-element proof, the source fence with six planted controls,
  and the whole-suite spy.

## (a) Both new tripwires FALSIFIED before being trusted

This plan added two brand-new claims. An assertion that has only ever passed is not evidence, so each was
made to fail on purpose and then restored.

### Falsification 1 — the per-user key scoping (T-184-07-01)

The user segment was temporarily dropped from `canvasNudgeKey` (`…v1.<draft_id>` instead of
`…v1.<user_id>.<draft_id>`):

```
Tests  5 failed | 26 passed (31)

× canvasNudge — user scoping > does not show user A's nudges to user B on the same draft
× canvasNudge — user scoping > keeps the two users' entries under two distinct keys
× canvasNudge — draft scoping and Tidy up > never touches another user's key
    AssertionError: expected {} to deeply equal { search: -30 }
```

→ user B read user A's layout, and "Tidy up" wiped the other user's entry. **Restored —** 31/31 green.
The **26 that stayed green** are as informative as the 5 that went red: every round-trip, defensive-read,
quota and unsaved-draft assertion is independent of the key's user segment, so the probe isolated exactly
the claim T-184-07-01 makes.

### Falsification 2 — the whole-suite request spies

A planted `globalThis.fetch("/probe")` was added to each suite:

```
canvasNudge      → AssertionError: expected "spy" to not be called at all … Number of calls: 1
StepTypePicker   → AssertionError: expected "spy" to not be called at all … Number of calls: 1
```

→ both spies are live wrappers under jsdom, not vacuous no-ops. Removed; 31/31 and 34/34 green.

### Falsification 3 — R10b's "nothing is ever hidden"

`allowedTypesAt`'s output was temporarily filtered to drop refused rows — the exact silent-omission
failure sketch 139-C says teaches nothing:

```
Tests  6 failed | 28 passed (34)

× disables every choice past the deliverable and shows the reason in the DOM
× renders the reason CHARACTER-IDENTICAL to definitionOps' sentence (it authors none)
× wires the row to its visible reason via aria-describedby
× does NOT call onChoose when a refused row is clicked
× renders exactly six rows: with deliverable, after it
× renders exactly six rows: out of range
```

→ the six-row count and every R10b assertion are genuinely load-bearing. **Restored —** 34/34 green.

## (b) ZERO assertions in pre-existing test files were edited

**Stated explicitly: this plan edited ZERO assertions in any pre-existing test file, and made ZERO
import-path-only changes.**

```
$ git diff --stat 2128dda3~1 HEAD -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'
 .../src/components/workflows/canvasNudge.test.ts   | 398 +++++++++++++++++++++
 1 file changed, 398 insertions(+)
```

That listing covers the first two commits; `StepTypePicker.test.tsx` (379 insertions / 0 deletions) is the
only test file in the third. **Both are net-new**, no pre-existing test file appears in any diff, so the
enumerable set of import-path-only changes is **empty**. The 184-01 carve-out (`soulData.test.ts`'s glyph
map) remains the only permitted assertion edit in phase 184 and stays **spent** — it reported its pinned
**14** on every gate run of this plan.

## (c) Count-gate result, per commit

`node scripts/vitest-count-gate.cjs` was run after each task's changes were complete and before its commit.

| Commit | Task | Result | Total | Failed | Per-file decreases | 16 pinned files |
|---|---|---|---|---|---|---|
| `2128dda3` | 1 | **exit 0** | 783 (+31) | 0 | **none — every delta 0** | 16/16 present |
| `782c4de9` | 2 | **exit 0** | 783 | 0 | **none — every delta 0** | 16/16 present |
| `51e8bdca` | 3 | **exit 0** | 817 (+34) | 0 | **none — every delta 0** | 16/16 present |

The pinned table on the final run, in full: `canvasModel.fixtures.test.ts` 100 · `canvasModel.purity.test.ts`
69 (actual 79, a 184-05 increase — allowed) · `phaseVocabulary.test.ts` 42 · `WorkflowCanvas.test.tsx` 31 ·
`canvasModel.test.ts` 26 · `PublishGauntlet.test.tsx` 24 · `WorkflowBuilderPage.canvas.test.tsx` 22 ·
`PhaseFormPanel.test.tsx` 19 · `WorkflowBuilderPage.test.tsx` 15 · `PhaseSpineGraph.test.tsx` 14 ·
`soulData.test.ts` 14 · `WorkflowDoorSwitch.test.tsx` 13 · `PhaseSpine.test.tsx` 11 · `deriveTier.test.ts`
9 · `WorkflowSoul.test.tsx` 8 · `revertByteIdentical.test.tsx` 7 — **all delta 0 or better**. The gate's JSON
report was written under the OS temp dir on every run, never inside a reload-watched tree.

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run src/components/workflows/canvasNudge.test.ts` | 0 failures | **31 passed**, exit 0 |
| `npx vitest run src/components/workflows/StepTypePicker.test.tsx` | 0 failures | **34 passed**, exit 0 |
| The full plan set (`src/components/workflows` + both Builder suites + `revertByteIdentical`) | 0 failures | **22 files / 817 tests passed**, exit 0 |
| `node scripts/vitest-count-gate.cjs` | exit 0, no per-file decrease | **exit 0** on all three commits |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (the `develop` differential) | **33** — equal to baseline, on every task |
| `npx vite build` | exit 0 | **exit 0** |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** |
| `git diff --name-only -- supabase/migrations \| wc -l` | 0 | **0** — slot 114 RESERVED |
| `git diff --name-only -- backend/ \| wc -l` | 0 | **0** |
| `grep -c 'localStorage' WorkflowBuilderPage.tsx` | 0 | **0** — the shipped guard's 22 assertions pass unmodified |
| `grep -nE 'from "@/(lib/api\|components/workflows/(builderStore\|canvasModel))"' canvasNudge.ts` | no matches | **no matches** |
| `canvasNudgeKey("u1","d1")` | `agentic-rag.canvas-nudge.v1.u1.d1` | **exact** |
| `localStorage.length` after `writeNudge(null, …)` | unchanged | **unchanged**, 0 keys under the prefix |
| The quota test | no throw, one `console.warn` | **no throw, exactly 1 warn** |
| `grep -nE 'fetch\(\|workflows/validate\|from "@/lib/api"' StepTypePicker.tsx` | no matches | **no matches** |
| `grep -c 'renderPhaseMark' StepTypePicker.tsx` | ≥ 1, no hardcoded glyph fallback | **3**, and the source fence asserts no local glyph map |
| `grep -cE '<input\|<textarea\|contenteditable' StepTypePicker.tsx` | 0 | **0**; the rendered DOM scan also reports 0 |
| `grep -cE 'would (strand\|come after)' StepTypePicker.tsx` | 0 | **0** — no reason string is authored here |
| `useTechnicalNamesOptional` vs `…Context` | Optional only | **2 vs 0** |
| `grep -cE '@xyflow\|mockReactFlow\|ReactFlowProvider' StepTypePicker.test.tsx` | 0 | **0** |
| Both `fetch` spies | exactly 0 calls | **0** and **0** |
| Deletions in any commit | none | **none** across all three |
| `.planning/REQUIREMENTS.md` | untouched | **untouched** — all 5 phase REQ-IDs still Pending |
| `npx eslint` on all four files | clean | **zero problems** |

## Decisions Made

- **One flat key per user per draft** rather than one per-user object keyed by draft id. "Tidy up" then
  becomes a single `removeItem` scoped to exactly one document, with no read-modify-write that could
  drop a sibling draft's entry under a race.
- **A session with no resolvable user id takes the unsaved-draft path.** Falling back to an unscoped key
  would reintroduce precisely the cross-user leak the per-user scoping exists to prevent, so the honest
  answer is "keep it in memory".
- **`streamsCache`'s evict-half-and-retry was not copied.** That policy exists because chat scrollback is
  large. A map of at most five numbers is not what filled the quota, and evicting another feature's data
  to store a vertical offset is the wrong trade. `console.warn` + silent fall-through is the whole policy.
- **A write that could never be read is not performed.** A non-finite `dy` or an empty slug is ignored
  rather than stored — `readNudges` would drop it on the way out anyway, and storing it is how a store
  starts lying about what it holds.
- **The picker's reason is rendered, not re-derived.** Asserting it character-identical to
  `STRANDING_REASON` is what makes "the picker authors no refusal of its own" a fact rather than a comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's R10b test case names the wrong insertion index; the shipped boundary is strictly-after**

- **Found during:** Task 3
- **Issue:** The plan's Task-3 action text says *"on a definition whose `llm_emit` deliverable sits at
  position 2, inserting at index **2 or later**"* renders the stranding choices disabled. That is the
  **superseded** at-or-after boundary. 184-02 Deviation 1 corrected `allowedTypesAt` to refuse **strictly
  after** the last deliverable, because inserting AT the deliverable's position places the new step
  *before* it — the deliverable shifts down one and stays terminal — so refusing that slot would decline
  the most natural authoring act while stating a reason that is false about the edit refused. The critical
  constraints for this plan say the picker **INHERITS** that boundary. Written to the plan's literal text,
  the test would have asserted a behaviour the shipped module does not have and gone red.
- **Fix:** the suite asserts the boundary on **both** sides — at index **2** all six rows render enabled
  with no reason node, at index **3** all six render disabled with the reason. A docblock paragraph names
  184-02-SUMMARY.md Deviation 1 so a reader does not mistake this for the plan being ignored.
- **Files modified:** `frontend/src/components/workflows/StepTypePicker.test.tsx`
- **Verification:** both cases green; the omission falsification above turns the index-3 case red, proving
  it is live
- **Committed in:** `51e8bdca`

**2. [Rule 1 - Bug] The "no slug is rendered" assertion needed a fixture whose slugs cannot collide with the vocabulary**

- **Found during:** Task 3
- **Issue:** As first written the assertion checked that the rendered menu contains neither `deliver` nor
  `search`, using the natural fixture slugs. `deliver` is a **substring of the plain-language sentence
  "Produce the deliverable"**, so the assertion fails for a reason that has nothing to do with slugs; and
  `search` would have passed only because the shipped `llm_agent` subtitle capitalises it — i.e. passed
  for the wrong reason, which is the failure class this phase's positive-control discipline exists to
  catch.
- **Fix:** a dedicated two-phase fixture with slugs (`zx-first-step`, `zx-second-step`) that cannot appear
  in any vocabulary string. The comment records why, so nobody "simplifies" it back to realistic slugs.
- **Files modified:** `frontend/src/components/workflows/StepTypePicker.test.tsx`
- **Committed in:** `51e8bdca`

### Honesty corrections applied while writing (not defects — anti-drift discipline)

**3. [Rule 2 - Missing Critical] A source fence was deliberately NOT written, because it would have forced the docblock to lie**

- **Found during:** Task 1
- **Issue:** The natural G-5 fence on `canvasNudge.ts` is *"this module does not name the auth-token
  storage key"* — proving the auth read is imported rather than re-derived. But the module's docblock
  explains, correctly, that *"a second copy of the auth-token read is exactly the fork the G-5 discipline
  retires."* The fence would have made that sentence unwritable. That is D-ITEM-183-02's *"a guard that
  only passes by making a comment lie"* — the trap 184-03 hit four times and 184-05 three more.
- **Fix:** the fence is `not.toMatch(/function getCurrentUserIdSync/)` — it forbids a **second
  declaration**, which is the real invariant, and leaves the explanatory prose intact. The test carries an
  inline comment stating what was deliberately not fenced and why, and a positive control proves the
  regex matches a planted declaration.
- **Files modified:** `frontend/src/components/workflows/canvasNudge.test.ts`
- **Committed in:** `2128dda3`

---

**Total deviations:** 3 (2 bugs, 1 missing-critical)
**Impact on plan:** none expands scope. The file set is exactly the four in `files_modified`. Deviation 1
is the only behavioural difference from the plan text and it is the plan's own stated inheritance rule
applied correctly. Deviations 2 and 3 are the plan's intent implemented honestly rather than literally.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-07-01 (info disclosure — key namespace) | mitigate | **CLOSED.** The key is `…v1.<user_id>.<draft_id>`, reusing the shipped `getCurrentUserIdSync()`. Three assertions cover it (two users never see each other's map; two distinct keys exist; Tidy-up never touches the other user's key) and **all three were falsified** by removing the user segment. A session with no user id keeps the map in memory rather than writing an unscoped key |
| T-184-07-02 (tampering — `dy` reaching the definition) | mitigate | **CLOSED.** A `?raw` fence proves `canvasNudge.ts` imports neither the builder store, the canvas model nor the API client, names no server route and opens no request, each with a planted-literal control; a whole-suite spy recorded **0** calls. `git diff -- supabase/migrations` is **0 lines**; slot 114 RESERVED |
| T-184-07-03 (DoS — quota / private mode) | mitigate | **CLOSED.** Six assertions: a corrupt entry, a non-numeric value, a non-object value, a throwing read, a throwing `setItem` and a throwing `removeItem` all resolve without throwing. The throwing-read case plants a session entry first, so passing proves the module's OWN catch fired rather than the no-key fallback standing in for it. The quota case asserts exactly one `console.warn` |
| T-184-07-04 (repudiation — a client refusal read as a server verdict) | mitigate | **CLOSED.** The picker authors no reason: the rendered sentence is asserted character-identical to `definitionOps.STRANDING_REASON`, and `grep -cE 'would (strand\|come after)'` on the component returns **0**. A `?raw` fence (no request call, no route name, no API import) plus a 0-call spy prove it never consults the server seam. D-182-06 intact |
| T-184-07-05 (tampering — rendered reason / title text) | mitigate | **CLOSED.** Plain React text children only; `grep -c 'dangerouslySetInnerHTML' StepTypePicker.tsx` → **0** |
| T-184-07-SC (supply chain — npm installs) | accept | **Honoured — this plan installed nothing.** `frontend/package.json` and the lockfile are absent from all three commits |

## Scope Fence Compliance

- **Frontend only.** All three commits touch exactly four files, all under `frontend/src/components/workflows/`.
  Nothing under `backend/`, `scripts/` or `supabase/`.
- **No migration, no env var, no dependency.** `zundo` remains the phase's only net-new package (184-04).
- **No production caller wired.** `WorkflowBuilderPage.tsx` and `WorkflowCanvas.tsx` are untouched, so no
  shipped surface can regress from this plan; 184-12 mounts both modules.
- **`__fixtures__/canvasFixtures.ts` untouched** (D-184-17 / its acceptance guard). Every shape both suites
  need is hand-authored inline.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed anywhere. No
  scratch file written inside `frontend/` or `backend/` — the two falsification probes were applied in
  place and reverted in place, each verified by grep afterwards.

## Known Stubs

**None.** Both modules are complete implementations of their contracts. They are **unmounted**, which is
different from stubbed: `184-12` wires `StepTypePicker` to the `＋` affordance and `canvasNudge` to the
drag-stop handler, and the plan's own objective states this ("Neither module is mounted yet — 184-12 wires
them — so this plan cannot regress a shipped surface").

## Issues Encountered

- **The plan text carries the superseded refusal boundary** (Deviation 1). Flagged prominently because
  **184-12 consumes the same function** and any plan text written before 184-02 shipped will say
  "at or after". The shipped rule is `index > lastEmitPosition`.
- **A "no slug rendered" assertion can pass for the wrong reason** (Deviation 2). Any future assertion of
  the form *"this vocabulary string does not appear"* must use tokens that cannot be substrings of the
  plain-language sentences — `deliver`, `write`, `search`, `prepare` and `ask` are all slug bases
  `slugForType` generates AND fragments of the shipped vocabulary.
- **`PublishGauntlet.test.tsx` remains slow** (13.4 s in the plan-set run) but passed 24/24 here and
  reported its pinned 24 with 0 failing on every gate run. Named, not fixed — the load-dependent flake
  184-04 recorded.

## User Setup Required

None. No external service, no env var, no migration, no dependency, no operator step.

## Next Phase Readiness

- **184-12 has both leaves and their contracts.** `StepTypePicker` takes `{ phases, index, open, onChoose,
  onDismiss }` and nothing else — the caller derives the slug with `slugForType`, builds the phase with
  `minimalPhaseFor`, inserts with `insertPhaseAt` and opens `PhaseFormPanel` on the result. `canvasNudge`
  takes a `draftId` the page already holds; the page must never touch storage itself (its shipped guard
  forbids it).
- **The `＋` affordance's own rules stay with 184-12**, not here: always visible under 1024 px and on
  touch, hover-revealed above it, and an empty draft gets the named "Add your first step" invitation per
  U-1 rather than a bare `＋`. The picker renders "Add a step at the end" / "Add a step before step N"
  and owns no placement.
- **D-184-10's drag half is 184-12's wiring.** `resolveDrop` (184-02) already splits the axes purely;
  `writeNudge` is the `dy` sink. The pointer-drag itself remains a **live G-4 UAT row** — d3-drag is
  unusable in jsdom, so the gesture is exercised by testing `resolveDrop` directly plus a manual pass.
- **Phase 185 lands on `allowedTypesAt`'s row shape.** `TypeChoice` already carries a per-type reason
  slot; a graded-governance dial adds data to the row, not a new return shape, and the picker renders
  whatever reason it is handed.
- **Phase 186's seam is untouched.** No persistence code was read or written by this plan.
- **The zero-assertion-edit gate is still armed and the 184-01 carve-out is still spent.** This plan
  consumed none of it.

## Self-Check: PASSED

- `frontend/src/components/workflows/canvasNudge.ts` — FOUND
- `frontend/src/components/workflows/canvasNudge.test.ts` — FOUND
- `frontend/src/components/workflows/StepTypePicker.tsx` — FOUND
- `frontend/src/components/workflows/StepTypePicker.test.tsx` — FOUND
- Commit `2128dda3` — FOUND
- Commit `782c4de9` — FOUND
- Commit `51e8bdca` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
