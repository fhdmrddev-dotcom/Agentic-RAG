---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 06
subsystem: frontend
tags: [react, typescript, zustand, workflow-canvas, governance, grounding, vitest, frontend-only]

# Dependency graph
requires:
  - phase: 185-02
    provides: "PhaseSpec.grounding_escalated / PhaseSpec.action_risk_armed, the kb_tools wire key on GET /workflows/grounding-bundle, and grounding_cause()"
  - phase: 184-09
    provides: "useGroundingBundle — the app's only caller of the palette route, and its four-member honest state union"
  - phase: 184
    provides: "definitionOps (the ONE definition mutation home), builderStore (the ONE working-definition home), and fromCanvas's carry-through-by-reference invariant"
provides:
  - "GroundingBundle.kb_tools on the API client type — the mirrored wire key"
  - "GroundingBundleState.kbTools on BOTH the ready AND unavailable members (never on idle/loading)"
  - "PhaseSpecJSON.grounding_escalated? / PhaseSpecJSON.action_risk_armed? — the client's definition type now carries the two intents"
  - "definitionOps.setPhaseGovernance(phases, slug, patch) + the exported PhaseGovernancePatch type — the PhaseSpec-level immutable op"
  - "12 exported governance copy constants in definitionOps.ts — one const per user-visible sentence"
  - "builderStore.setGovernance(slug, patch) — the store action, lastEditKind 'config'"
affects: [185-07-canvas-seal, 185-08-detour-edge-and-vocabulary-deletion, 185-09, 185-10, 188-run-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-predicts / server-enforces: the safety-defining list has ONE home (server) and the client duplicates only the set intersection, so a wrong client read is a display bug by construction"
    - "Caller-owned narrow write op: a field that is a sibling of `validators` gets its own op rather than widening a config-only patch type — growing it into a general PhaseSpec writer is a typecheck error"
    - "Banned-vocabulary guards assembled from string fragments, with a live positive control, so a grep of the guard file cannot itself satisfy or break the guard (the D-ITEM-183-02 trap)"

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useGroundingBundle.ts
    - frontend/src/hooks/useGroundingBundle.test.ts
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/definitionOps.test.ts
    - frontend/src/components/workflows/canvasModel.roundtrip.test.ts
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/components/workflows/builderStore.test.ts

key-decisions:
  - "kbTools rides on BOTH answer members of the hook's state union, and on neither waiting member — a degraded folder/skill read must not un-mark a locked step, while idle/loading stay data-free so their frozen module-scope identity survives"
  - "The read is `bundle.kb_tools ?? []` rather than `bundle.kb_tools` — a server that has not yet shipped the field degrades to marking nothing rather than to `undefined.length` at a render site"
  - "The D-185-02 honesty rule is stated in the section docblock WITHOUT quoting the emit-path phrases it forbids, because the plan's own acceptance grep requires those phrases to be absent from the file"
  - "setGovernance's lastEditKind is \"config\", decided rather than copied: arming changes no run order, no node count and no phase_index"
  - "PhaseSpecJSON's two booleans are `?: boolean` (absent-or-true/false), mirroring `name?: string | null`, while the BACKEND spells them `bool = False` — the client read shape is deliberately looser than the model, as it already is for every other field"

patterns-established:
  - "Reference identity as the proof that a write landed at the right LEVEL: `expect(out[0].config).toBe(input[0].config)` is a stronger statement than any key-set comparison that the spread did not go one layer down"

requirements-completed: []

# Metrics
duration: 22min
completed: 2026-07-29
---

# Phase 185 Plan 06: The Client Half of the Governance Data Summary

**The client can now compute `available_tools ∩ kb_tools` locally from a server-supplied list on every honest palette reading, carries the two `PhaseSpec` intents in its own definition type with round-trip reference identity proven, and has a complete four-layer caller-owned write chain plus twelve one-home governance sentences — with zero backend files and zero migrations touched.**

## THE NAMES PLANS 07 / 08 / 09 / 10 MUST USE

All final, all exported, all consumed verbatim downstream:

| What | Verbatim name | Where |
|---|---|---|
| The wire field on the API client type | **`GroundingBundle.kb_tools`** (`string[]`) | `frontend/src/lib/api.ts:3438` |
| The hook's KB list | **`kbTools`** (`string[]`) — on the `ready` AND `unavailable` members | `GroundingBundleState`, `frontend/src/hooks/useGroundingBundle.ts` |
| The two client intents | **`grounding_escalated?: boolean`** · **`action_risk_armed?: boolean`** | `PhaseSpecJSON`, `frontend/src/components/workflows/phaseVocabulary.ts` |
| The pure write op | **`setPhaseGovernance(phases, slug, patch)`** | `frontend/src/components/workflows/definitionOps.ts` |
| The op's patch type | **`PhaseGovernancePatch`** (exported `type`) | same file |
| The store action | **`setGovernance(slug, patch)`** | `frontend/src/components/workflows/builderStore.ts` |

### The twelve copy constants — all exported from `definitionOps.ts`

| Constant | Value |
|---|---|
| `GROUNDING_DIAL_LOOSE_LABEL` | `"○ Free to think"` |
| `GROUNDING_DIAL_STRICT_LABEL` | `"⛨ Must prove it"` |
| `GROUNDING_NOTHING_TO_PROVE` | `"Nothing to prove here"` |
| `GROUNDING_WHY_DETECTED` | `"Because this step reads your documents."` |
| `GROUNDING_WHY_ESCALATED` | `"Because you turned this on by hand."` |
| `GROUNDING_ALREADY_SET_NOTE` | `"This step already has to cite its sources — that comes from its citation policy above, not from this dial."` |
| `GROUNDING_TOOL_LIST_IS_THE_CONTROL` | `"Switching any of them on is what makes this step have to prove itself — this list is the real control."` |
| `GROUNDING_ATTACHED_GATE` | `"Before this step is accepted it must have actually retrieved something from your documents, and point at what it used. A step that answers without opening a file fails."` |
| `GROUNDING_LOCK_REFUSAL` | `"Reading your files is what this step is for, so it has to show where its answers came from. You can switch off the document tools below — but that does not loosen the step, it stops it opening your files at all."` |
| `GOVERNANCE_GATE_ROW_LABEL` | `"Must prove it — retrieved sources, pointed at in the answer"` |
| `ACTION_RISK_ARM_LABEL` | `"Stop and ask me first"` |
| `ACTION_RISK_ARMED_NOTE` | `"When this step is reached the run stops and waits for your answer. It will not continue on its own."` |

**The component authors NO sentence of its own.** Import the constant and let the suite assert
character-identity, exactly as `StepTypePicker` does against `STRANDING_REASON`.

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-29T15:17:53Z
- **Completed:** 2026-07-29T15:39:40Z
- **Tasks:** 3
- **Files modified:** 9 (0 created)

## Accomplishments

- **The KB list is DATA on every honest reading of the palette.** `kbTools` sits on both the `ready` and
  the `unavailable` members of `GroundingBundleState` and on neither waiting member. That split is the
  whole point: the server serves `kb_tools` **outside every try/except** in `assemble_grounding_bundle`
  (185-02), so a PostgREST blip on the folder or skill registry must not silently un-mark a locked step —
  and it does not, because the degraded branch carries the full five names. `idle` and `loading` stay
  field-free so their module-scope `IDLE` / `LOADING` constants remain identity-comparable across renders,
  which the new test asserts structurally (`Object.keys(state)` is exactly `["kind"]`).
- **No frontend `KB_TOOLS` constant exists, and the shipped fence proves it.** The hook file's `?raw`
  source guard (`HARDCODED_TOOL_ARRAY`) already forbids a two-or-more tool-id array literal in the module,
  and it still passes. The new `CHANGE THE MOCK, CHANGE THE KB LIST` test moves the server's answer from
  five names to six and watches the hook follow with no frontend edit — the exact drift scenario D-182-06
  was written against, exercised rather than asserted.
- **The two intents round-trip with reference identity, and no serializer code was owed for it.**
  `fromCanvas` hands back the SAME `PhaseSpecJSON` objects `toCanvas` was given
  (`canvasModel.ts:358-369`), so SPEC acceptance criterion 3 holds by construction. The new
  `canvasModel.roundtrip.test.ts` case makes it executable: two governed phases, `toBe` per element, plus
  the readable backstop that both booleans survive as `true` and neither leaked a layout key.
- **`setPhaseGovernance` cannot write into `config`, and the test proves it by reference.** The op spreads
  at `{ ...p, ...patch }` — PhaseSpec level — and the assertion that pins it is
  `expect(out[0].config).toBe(governed[0].config)`. A spread that landed one layer down would produce a
  new config object and fail on `Object.is`, which no key-set comparison could claim as strongly.
  `PhaseConfigPatch` was **not** widened (D-185-10), and `PhaseGovernancePatch` admits only the two
  booleans, so growing this into a general `PhaseSpec` writer is a typecheck error (T-185-06-02).
- **Every governance sentence has exactly one home, and the vocabulary lock is executable.** Twelve
  exported consts, a section docblock stating both binding rules, and eight guard tests including a
  banned-term sweep with a **live positive control** (each banned word is planted into a sentence and the
  check finds it). The banned terms and the emit-path phrases are assembled from string fragments so a
  grep of the test file cannot itself satisfy the guard — the D-ITEM-183-02 trap this phase has hit
  repeatedly.
- **D-185-02 is honoured in the copy AND enforced by a test.** `GROUNDING_ATTACHED_GATE` claims
  *retrieved-and-pointed-at*, never the deliverable path's stronger every-leaf claim, and a test asserts
  the two emit-path signature phrases are absent from the constant while `"retrieved"` and
  `"point at what it used"` are present.
- **The write chain is three of its four layers deep.** `definitionOps.setPhaseGovernance` →
  `builderStore.setGovernance` exists and is guarded exactly as `patchConfig` is. Only the page
  `useCallback` and the `PhaseFormPanel` prop are still missing — those belong to the surface plan.
- **This plan rendered nothing and deleted nothing.** `groundingFor()` still ships untouched; 185-08 owns
  its removal.

## Task Commits

1. **Task 1: Read the server's KB tool list, on both honest readings of the palette** — `e1ed4011` (feat)
2. **Task 2: The two booleans on `PhaseSpecJSON` and the governance copy constants** — `65438580` (feat)
3. **Task 3: The store action** — `10aababe` (feat)

## Files Created/Modified

- `frontend/src/lib/api.ts` — `GroundingBundle.kb_tools` immediately after `tools`, with a comment naming
  D-185-09 and the client-predicts/server-enforces framing. **Exactly one occurrence of the wire key**, as
  the acceptance grep requires. `getGroundingBundle` unchanged — it returns the response untouched.
- `frontend/src/hooks/useGroundingBundle.ts` — a new module-docblock paragraph explaining why `kbTools`
  rides on both answer members; the field on `ready` and `unavailable` with per-member notes; three
  assignment sites (`bundle.kb_tools ?? []` twice, `[]` on the unreachable branch).
- `frontend/src/hooks/useGroundingBundle.test.ts` — `bundleOf` gains `kb_tools`; a `SERVER_KB_TOOLS`
  fixture; **5 new tests** (ready-by-identity, degraded-still-five, unreachable-empty,
  change-the-mock-change-the-list, and the waiting-readings-carry-no-field structural check).
- `frontend/src/components/workflows/phaseVocabulary.ts` — the two optional booleans on `PhaseSpecJSON`
  under a Phase 185 comment block carrying three clauses: additive-optional, intent-only (D-185-07), and
  the carry-through-by-reference note explaining why criterion 3 costs no serializer code.
- `frontend/src/components/workflows/definitionOps.ts` — `PhaseGovernancePatch` + `setPhaseGovernance`
  beside `patchPhaseConfig`; the `// ── Phase 185 governance vocabulary ──` section with its two-rule
  docblock and the twelve constants.
- `frontend/src/components/workflows/definitionOps.test.ts` — **17 new tests** across two describes:
  9 for the op (named-slug-only, other-phases-`toBe`, never-into-config, no-renumber, other-PhaseSpec-keys
  preserved, both-booleans-at-once, unknown-slug no-op, `false` is expressible, no-mutation, TOTALITY) and
  8 for the vocabulary lock.
- `frontend/src/components/workflows/canvasModel.roundtrip.test.ts` — **1 new test**: two governed phases
  survive `toCanvas` → `fromCanvas` with `toBe` reference identity per element.
- `frontend/src/components/workflows/builderStore.ts` — the `setGovernance` type member with the D-185-10
  note, and the implementation with a docblock stating why `lastEditKind` is `"config"`.
- `frontend/src/components/workflows/builderStore.test.ts` — **6 new tests**, including the two no-ops
  asserting `editSeq` unchanged and the two-flicks-one-undo coalescing contract.

## Decisions Made

- **`bundle.kb_tools ?? []` rather than `bundle.kb_tools`.** The type says the field is required, but the
  hook parses a network payload, not a compiler-checked object. A server that has not yet shipped the
  field (a stale backend during a rolling deploy) degrades to marking nothing, which is the safe direction
  — the run-time gate is unconditional and server-side either way. Reading it bare would put `undefined`
  into a `string[]` slot and crash the first `.includes()` at a render site.
- **The two client booleans are `?: boolean`, not `boolean`.** `PhaseSpecJSON` is documented as the
  Builder's LOOSE read shape ("the Builder refines the real definition"), and every pre-185 definition in
  hand carries them absent. The backend model spells them `bool = False` for the D-185-08 reason that
  absence must be unambiguous *in the model*; the client read shape is deliberately the looser one, as it
  already is for `name` and `validators`.
- **The D-185-02 honesty rule is stated without quoting what it forbids.** The plan's Task-2 action text
  asked the docblock to name the emit-path phrases; the plan's own acceptance criterion required
  `grep -c "every value traceable\|everything it says is checked"` to return **0** on the same file. The
  criterion wins — a guard that can only pass by making a neighbouring docblock lie is the exact trap this
  phase keeps recording. The docblock therefore explains the structured-leaf-set reason in its own words,
  and the *test* pins the absence using fragment-assembled needles.
- **The banned-vocabulary guard lives in the test, not in a grep script.** It reads the exported constants
  themselves, so it keeps working when 185-07/08 add a thirteenth sentence, and it carries a positive
  control proving it can go red.
- **`lastEditKind: "config"` for `setGovernance`.** Recorded in a comment at the call site. Arming a
  checkpoint or escalating grounding changes no run order, no node count and no `phase_index` — there is
  nothing a `"structural"` entry exists to record — and a person setting both dials during one visit to a
  step should not owe two undos to get back.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's path for the store is wrong; the file is not under `src/stores/`**

- **Found during:** Task 3 (and pre-read during Task 1)
- **Issue:** `185-06-PLAN.md`'s `files_modified` and every task reference name
  `frontend/src/stores/builderStore.ts`. That file does not exist. `frontend/src/stores/` contains exactly
  one file, `streamsStore.ts`. The builder store lives at
  `frontend/src/components/workflows/builderStore.ts` (572 lines), which is where 184 Wave 0 put it and
  where `BuilderStoreProvider.tsx` imports it from. `185-PATTERNS.md` §12 quotes the correct line numbers
  but under the wrong path too, so the error is inherited, not local.
- **Fix:** Edited the real file. No file was created at the plan's path — creating a second store there
  would have been the drift the phase's own one-home rule forbids.
- **Files modified:** `frontend/src/components/workflows/builderStore.ts`,
  `frontend/src/components/workflows/builderStore.test.ts`
- **Commit:** `10aababe`
- **Downstream note:** plans 07-10 and the phase VALIDATION map should read
  `frontend/src/components/workflows/builderStore.ts` wherever `frontend/src/stores/builderStore.ts`
  appears.

**2. [Rule 3 - Blocking] The plan's Task-1 instruction to create `useGroundingBundle.test.ts` was moot**

- **Found during:** Task 1
- **Issue:** The plan offered "or create `useGroundingBundle.test.ts` if none exists". It exists — 184-09
  shipped it with 12 tests, a `?raw` source fence and a spread-the-real-module API mock.
- **Fix:** Extended the shipped suite in its own posture rather than adding a second file. `bundleOf` was
  widened with `kb_tools: []` so every existing test still compiles against the now-required field.
- **Files modified:** `frontend/src/hooks/useGroundingBundle.test.ts`
- **Commit:** `e1ed4011`

No Rule 1 or Rule 2 fix was needed, no Rule 4 question arose, no package was installed, and no
architectural change was made.

## Authentication Gates

None.

## Verification Evidence

| Check | Result |
|---|---|
| `grep -c "kb_tools" frontend/src/lib/api.ts` | **1** ✅ (criterion: 1) |
| `grep -c "kbTools" frontend/src/hooks/useGroundingBundle.ts` | **7** ✅ (criterion: ≥ 3) |
| `kbTools` inside the `idle` / `loading` members | **absent** — verified by reading, and pinned by a test asserting `Object.keys(state) === ["kind"]` on both |
| The degraded-reason test asserts `kbTools.length === 5` | ✅ green |
| `grep -c "grounding_escalated?: boolean"` / `"action_risk_armed?: boolean"` in `phaseVocabulary.ts` | **1** / **1** ✅ |
| `grep -c "export const GROUNDING_\|export const GOVERNANCE_\|export const ACTION_RISK_"` in `definitionOps.ts` | **12** ✅ |
| `grep -riE "\b(Proven\|Ungoverned\|Unchecked\|Not applicable\|N/A)\b" definitionOps.ts` | **0 matches** ✅ |
| `grep -c "every value traceable\|everything it says is checked" definitionOps.ts` | **0** ✅ (D-185-02) |
| `grep -c "setPhaseGovernance" definitionOps.ts` | **2** ✅ (criterion: ≥ 1) |
| `config:` inside `setPhaseGovernance`'s body | **0** — the body is one `.map` with `{ ...p, ...patch }`; pinned by a `toBe` assertion on the target's `config` |
| `grep -c "setGovernance" builderStore.ts` | **2** ✅ (type member + implementation) |
| `lastEditKind: "structural"` inside `setGovernance`'s body | **0** ✅ |
| `npx vitest run src/hooks` | **52 passed / 0 failed** ✅ |
| `npx vitest run definitionOps.test.ts canvasModel.roundtrip.test.ts` | **706 passed / 0 failed** ✅ |
| `npx vitest run builderStore.test.ts definitionOps.test.ts` | **236 passed / 0 failed** ✅ |
| `npx vitest run src/components/workflows src/hooks` | **1460 passed / 12 failed** — all 12 pre-existing (see below) |
| `npx tsc -b` (whole repo) | **33 errors, identical to the pre-plan baseline; 0 name any file in `files_modified`** ✅ |
| `npx vite build` | **exit 0**, built in 11.48s ✅ |
| `git diff --stat 7ded1eac..HEAD -- backend/ supabase/migrations` | **0 files** ✅ |

### Count gate

`node scripts/vitest-count-gate.cjs` — **total 1529 · failed 24 · pinned total 424**.

Applying `185-VALIDATION.md` §"Count-gate posture" rather than `exits 0`:

1. **No `[count-decrease]`** — every one of the 16 pinned files reports delta ≥ 0. ✅
2. **No `[total-below-baseline]`, no `[missing-file]`.** ✅ Total rose 1504 → 1529 (+25 net across the
   gate's target set).
3. **No NEW failing test in any file this plan touched.** ✅ The 24 failures land in
   `PublishGauntlet` (8), `WorkflowCanvas` (4), `WorkflowBuilderPage` (3), `StepTypePicker` (2),
   `WorkflowCanvas.composition` (2), `WorkflowCanvas.editing` (2), `WorkflowBuilderPage.canvas` (1),
   `PhaseFormPanel` (1), `PhaseSpineGraph` (1) — every one of them a file this plan never opened, and 24
   is **below** the 34/35/40 churn band the VALIDATION table recorded on an unchanged tree. All four
   files this plan touched (`definitionOps.test.ts`, `canvasModel.roundtrip.test.ts`,
   `builderStore.test.ts`, `useGroundingBundle.test.ts`) are fully green.
4. No pin was re-pinned — this plan adds tests only. (185-08 owns the one deliberate re-pin.)

`[failing-tests]` is the KNOWN pre-existing block (SEED-056, 40 rotted tests). Not chased — out of scope.

## Issues Encountered

**The frontend suite is not green, and was not green before this plan.** 12 failures in the
`src/components/workflows` + `src/hooks` scope, 24 across the count gate's wider target set — all in the
recorded SEED-056 rot set and all in files this plan did not touch. Already logged for the phase in
`185-VALIDATION.md` and `deferred-items.md`; nothing was added and nothing was fixed (executor scope
boundary).

**The plan's store path was wrong** — see Deviation 1. Cost about two minutes; recorded here so plans
07-10 do not repeat the lookup.

## Known Stubs

None. Every value this plan introduces is a real type field, a real pure function, a real store action or
a real string constant. No placeholder text, no empty array flowing to a UI, no TODO. Nothing renders yet
**by design** — this plan's own objective says so, and the surfaces that consume these names are plans
07-10.

## Threat Flags

None. No new network endpoint, no auth path, no file access pattern, no schema change at a trust boundary.

- **T-185-06-01** (client-side KB intersection, `accept by design`) — delivered as framed: the client
  reads `kb_tools` and does the intersection for DISPLAY. Nothing in this plan consults the client's read
  at run time; the `spec_by_slug` gate 185-03 landed is unconditional and server-side.
- **T-185-06-02** (`setPhaseGovernance` scope, `mitigate`) — delivered structurally. `PhaseGovernancePatch`
  is a closed two-key `Readonly<{...}>`; passing any third key is a typecheck error, and
  `PhaseConfigPatch` was not widened.
- **T-185-06-03** (copy constants, `accept`) — all twelve are static prose with zero interpolation of any
  user, org, document or tool value. Verified by reading: no template literal appears in the section.

## User Setup Required

None — frontend only, no environment variable, no migration. Live migration head stays at **113**.

## Next Phase Readiness

- **185-07 (canvas seal)** can read the two booleans off `PhaseSpecJSON` today and thread them through
  `buildPhaseData`. Remember `canvasModel.purity.test.ts:74-83`: node `data` must never alias the phase
  object — copy values, never spread `phase`.
- **185-08 (detour edge + vocabulary deletion)** inherits an untouched `groundingFor()`. Its re-pin of
  `phaseVocabulary.test.ts` (42) must land in the SAME commit as the deletion, with the number read from
  the gate's own output.
- **The surface plan owes exactly two layers.** The four-layer chain is
  page `useCallback` → `builderStore.setGovernance` → `definitionOps.setPhaseGovernance` → definition.
  Layers 2-4 exist. Layer 1 (a `useCallback` in `onPhaseChange`'s shape, closing over `selectedSlug` and
  `store`) and the new **caller-owned optional prop** on `PhaseFormPanel` are still to build. Keep the
  `{...(canvasEnabled ? { rails } : {})}` spread-conditional untouched — it is the D-14 mechanism.
- **`GOVERNANCE_GATE_ROW_LABEL` is ready for the client-synthesized `🔒` row** in `gatesFor()`
  (D-185-19 — nothing waits on `/validate`; `ValidateResponse` carries problems only).
- **The `already-set` and `detected` causes must be DERIVED at render time**, never read off a stored
  field. Only `grounding_escalated` exists in the client's type, and that is the whole of D-185-07.
- **Side effect the surface plans must expect** (carried from 185-02): the first save of any pre-185
  definition is not a zero-diff save — the backend's `model_dump(mode="json")` now writes
  `"grounding_escalated": false, "action_risk_armed": false` into every phase.

## Self-Check: PASSED

- `frontend/src/lib/api.ts` — FOUND
- `frontend/src/hooks/useGroundingBundle.ts` — FOUND
- `frontend/src/hooks/useGroundingBundle.test.ts` — FOUND
- `frontend/src/components/workflows/phaseVocabulary.ts` — FOUND
- `frontend/src/components/workflows/definitionOps.ts` — FOUND
- `frontend/src/components/workflows/definitionOps.test.ts` — FOUND
- `frontend/src/components/workflows/canvasModel.roundtrip.test.ts` — FOUND
- `frontend/src/components/workflows/builderStore.ts` — FOUND
- `frontend/src/components/workflows/builderStore.test.ts` — FOUND
- Commit `e1ed4011` — FOUND
- Commit `65438580` — FOUND
- Commit `10aababe` — FOUND

---
*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Completed: 2026-07-29*
