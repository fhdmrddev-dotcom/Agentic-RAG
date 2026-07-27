---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 09
subsystem: workflows
tags: [canvas-03, canvas-04, governance-rails, tool-whitelist, grounding-bundle, locked-gates, optional-prop-additivity, d-14, wave-5]

# Dependency graph
requires:
  - phase: 184-06
    provides: "`getGroundingBundle` + the `GroundingBundle` wire type (with `degraded` declared as THE honesty field) — consumed exactly as shipped; no second client was written"
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential, which is what makes 'the net-new suite did not absorb the shipped one' machine-checkable"
  - phase: 182-server-validation-seam
    provides: "`GET /workflows/grounding-bundle` — the server-owned registry that is the ONLY legitimate source of a tool whitelist"
  - phase: 103-04
    provides: "the shipped `PhaseFormPanel` — extended IN PLACE, never forked; its required `onClose`, its 44px collapsed rail and its per-type conditioning all survive untouched"
provides:
  - "`useGroundingBundle` / `GroundingBundleState` — the app's only caller of the palette route, with a non-empty `degraded` array resolving to `unavailable` and NEVER to `ready`"
  - "`PhaseFormPanel`'s optional `rails` prop — the D-14-safe seam whose ABSENCE renders today's panel"
  - "`PhaseFormRails` / `PhaseGateRow` — the rails contract 184-13 fills and Phase 185 extends with DATA, not layout"
  - "the bundle-sourced tool chip set (no free-text box, struck-through unregistered tools, an honest degraded sentence)"
  - "`PhaseFormPanel.rails.test.tsx` — 24 assertions, incl. the only place the flag-off panel surface is guarded"
affects: [184-13, 185]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A waiting state DERIVED from a prop plus the absence of an answer, rather than stored by a synchronous `setState` in an effect body — the lint rule and the honesty argument agree"
    - "A discriminated union that makes BOTH failure directions un-representable: a locked gate cannot carry a remove handler and a removable gate cannot lack one"
    - "A union member typed with the EMPTY TUPLE so a partial read cannot be widened into a complete one at the type level"
    - "A byte-identity guard expressed as a marker DIFFERENTIAL with a per-marker positive control, rather than as a stored snapshot artifact that would collide with a byte-unchanged gate"
    - "`import.meta.glob(..., {query: '?raw', eager: true})` as a directory-wide architectural scan — 'exactly one form component exists' asserted over every module, not over the ones the author remembered"

key-files:
  created:
    - frontend/src/hooks/useGroundingBundle.ts
    - frontend/src/hooks/useGroundingBundle.test.ts
    - frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx
  modified:
    - frontend/src/components/workflows/PhaseFormPanel.tsx

key-decisions:
  - "`idle` and `loading` are DERIVED, not stored — `react-hooks/set-state-in-effect` rejected the synchronous announce-loading `setState`, and deriving also makes a previously read palette survive a transient disable"
  - "`PhaseGateRow` is a discriminated union carrying `onRemove` on the unlocked branch only — the plan's flat `{label, locked: boolean}` would have shipped either a dead button or a row that says it is removable with nothing to press"
  - "`GroundingBundleState.ready.degraded` is the EMPTY TUPLE type, so 'a degraded bundle presented as a complete palette' is unconstructable rather than merely untested"
  - "The D-14 guard is a marker differential with a per-marker positive control, NOT a stored `outerHTML` snapshot — reasons enumerated in Deviation 6"
  - "`requirements.mark-complete` was deliberately NOT run — see the Requirements section"

patterns-established:
  - "Prove a server-sourced option set by MOVING the server's answer and watching the surface move with it — never by grepping for identifiers, which false-positives on every display-label map"
  - "A degraded read prints what the user already has: 'we could not load everything' must not be flattened into 'you have nothing', and a successful empty read is a DIFFERENT, separately asserted state"

requirements-completed: []  # CANVAS-03 and CANVAS-04 are this plan's frontmatter requirements and NEITHER is complete — no page passes `rails` yet, so a user can observe no difference. REQUIREMENTS.md deliberately untouched; see "Requirements".

# Metrics
duration: 22min
completed: 2026-07-27
---

# Phase 184 Plan 09: The Step Inspector and the Governance Rails Summary

**Governance is now legible as three rails inside the shipped 400 px inspector — locked order that carries no control because `phase_index` IS the order, a tool whitelist whose options are the server's array and nothing else (change the mocked bundle, the options change; there is no free-text box to type a tool into), and 🔒 rows whose DOM subtree contains zero `button` / `[role="button"]` / `input` beside `○` rows that carry exactly one — and a flag-off user's panel is provably unchanged, because every rail branch is gated on an OPTIONAL prop whose absence is asserted to introduce none of the seven strings the rails add, each of those seven proven to render when the prop IS supplied.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 3 (all `auto`, all committed atomically)
- **Files created:** 3 · **Files modified:** 1
- **Assertions added:** 12 (`useGroundingBundle.test.ts`) + 24 (`PhaseFormPanel.rails.test.tsx`) = **36**, all net-new; **zero** existing assertions edited

## Task Commits

1. **Task 1: `useGroundingBundle` — the palette's only caller, honest about degraded** — `cdea3289` (feat) — `useGroundingBundle.ts` (new, 149 L) + `useGroundingBundle.test.ts` (new, 12 assertions)
2. **Task 2: the optional `rails` prop — order and gates** — `c8f3943e` (feat) — `PhaseFormPanel.tsx` (+145, 0 deletions)
3. **Task 3: the bundle-sourced tool rail + the D-14 / R11 proof suite** — `6800b6a7` (feat) — `PhaseFormPanel.tsx` (+~190 / −1) + `PhaseFormPanel.rails.test.tsx` (new, 24 assertions)

No commit deletes a tracked file (`git diff --diff-filter=D` empty across all three). `package.json` and the lockfile appear in none of them.

---

## (a) THE `onClose`-REQUIRED PROBE — the observed error, verbatim

The plan requires the required-ness of `onClose` to be demonstrated rather than asserted. The probe removed it from ONE call site (`PhaseFormPanel.rails.test.tsx`'s own `renderPanel` helper — a file this plan owns, so no shipped assertion was touched and no scratch file was written into the watched tree):

```
src/components/workflows/PhaseFormPanel.rails.test.tsx(55,6): error TS2741:
  Property 'onClose' is missing in type
  '{ phase: PhaseSpecJSON; open: true; onChange: () => void; onPersist: () => void;
     rails: PhaseFormRails | undefined; }'
  but required in type 'PhaseFormPanelProps'.
```

**The error code is `TS2741`.** The probe was reverted from a byte-identical backup taken before it was applied; `grep -c "onClose={noop}"` reports **3** (its pre-probe value) and `npx tsc -b | grep -c "error TS"` is back to **33**. `onClose` is still declared without a `?`, and the docblock explaining why — *"a panel the user cannot close" is not a representable state* — is unchanged.

## (b) THE 44 px COLLAPSED RAIL AND THE <768 px BOTTOM SHEET — untouched, confirmed

Both were named by the operator's sketch-140 decision as things to preserve rather than rebuild, because a 400 px panel beside 248 px cards leaves room for roughly two steps at 900 px.

- **The 44 px collapsed rail** is the `if (!open || !phase)` early return and its `phase-form-rail` aside. `git diff` on `PhaseFormPanel.tsx` across both commits shows **no line in that branch added, removed or changed** — checked mechanically by filtering the diff for `phase-form-rail`, `writing-mode`, `select a step` and `44px`, which returns nothing. The rails cannot reach it: the early return fires **before** any rail branch, and a dedicated assertion renders the closed panel WITH a fully populated `rails` prop and asserts the resting rail is present and `[data-rail]` count is **0**.
- **The <768 px bottom sheet** is a PARENT concern by design — the panel's own docblock states it is layout-neutral and the parent grid owns the media query. This plan added no media query, no `position`, no width and no breakpoint; the shipped source fence *"the SOURCE is push (not overlay) — no position:absolute/fixed inset"* passes unmodified.

## (c) Assertion edits and import-path changes (D-184-08)

**Assertion edits in pre-existing test files: ZERO.**

```
$ git diff --stat -- frontend/src/components/workflows/PhaseFormPanel.test.tsx \
                     frontend/src/components/admin/revertByteIdentical.test.tsx
(empty)
```

`PhaseFormPanel.test.tsx` reports its pinned **19** on every gate run and `revertByteIdentical.test.tsx` its pinned **7**. The 184-01 `soulData.test.ts` carve-out remains **spent** and this plan consumed none of it; 184-08's two forced narrowings were in `PhaseNodeCard.test.tsx` and are unrelated to this file set.

**Import-path-only changes: ZERO.** Three net-new import STATEMENTS appear, all in or for net-new code: `useGroundingBundle.ts` imports `react` and `@/lib/api`; `PhaseFormPanel.rails.test.tsx` imports the panel, its two new types, `./PhaseFormPanel?raw` and `phaseVocabulary`. `PhaseFormPanel.tsx`'s own import block is **byte-unchanged** — the rails needed nothing it did not already have.

---

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run src/hooks/useGroundingBundle.test.ts` | 0 failures, exit 0 | **12 passed, exit 0** |
| `npx vitest run src/components/workflows/PhaseFormPanel.test.tsx` | 19, unmodified | **19 passed, file diff EMPTY** (after every task) |
| `npx vitest run src/components/workflows/PhaseFormPanel.rails.test.tsx` | 0 failures, exit 0 | **24 passed, exit 0** |
| `npx vitest run src/components/workflows … + the 3 gating suites` | 0 failures | **25 files / 901 tests passed, 0 failed, exit 0** |
| `node scripts/vitest-count-gate.cjs` | exit 0, all 16 pinned held | **exit 0** after every task; 901 total, **0 failing**, 16/16 present, **no per-file decrease**; `PhaseFormPanel.test.tsx` at exactly **19** |
| Pinned-file deltas | 0 everywhere | **0 everywhere** (the only non-zero is `canvasModel.purity.test.ts` 69 → 79, the increase 184-05 recorded) |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (the `develop` differential) | **33** after every task — equal to baseline; no error names a file this plan touched |
| `npx vite build` | exit 0 | **exit 0**, built in 3.73 s (NOT `npm run build`, per the plan) |
| `npx eslint` on all 4 files | clean | **zero problems** (after the `set-state-in-effect` finding was resolved by deriving — Deviation 1) |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged**, and no new snapshot artifact was created (Deviation 6) |
| `revertByteIdentical.test.tsx` | green at its pinned 7, unmodified | **7/7, unmodified** |
| `grep -c 'grounding_mode' PhaseFormPanel.tsx` | 0 | **0** — and the `?raw` fence's positive control passes |
| `grep -c 'rails?:' PhaseFormPanel.tsx` | ≥ 1, docblock contains "absent" and "today" | **1**; the docblock reads *"ABSENT ⇒ THIS PANEL RENDERS EXACTLY AS IT DOES TODAY, BYTE-FOR-BYTE"* |
| `grep -n 'rails?\.' PhaseFormPanel.tsx` | ≥ 1 (the key_links pattern) | **2 call sites** (`options={rails?.toolOptions}` on `llm_agent` and `llm_batch_agents`) + 1 docblock reference |
| `git diff --name-only -- backend/ supabase/migrations` | 0 | **0** across all three commits |
| `package.json` / lockfile in any commit | absent | **absent** |
| REQUIREMENTS.md | untouched, all 5 phase REQ-IDs Pending | **untouched** |
| Deletions in any commit | none | **none** |

### The acceptance criteria that needed reading rather than grepping

- **The four union members exist and are `kind`-discriminated** — `idle`, `loading`, `ready`, `unavailable`, with `reason: "degraded" | "unreachable"` on the last.
- **A non-empty `degraded` never yields `ready`** — asserted behaviourally (`kind` is `"unavailable"`, `reason` is `"degraded"`) AND made unconstructable at the type level, because `ready.degraded` is `readonly []` and `bundle.degraded` (a `string[]`) is not assignable to it.
- **`enabled: false` issues exactly 0 calls** — `expect(mockedBundle).not.toHaveBeenCalled()`, with the state asserted `toEqual({kind:"idle"})` so an extra invented field would fail.
- **The change-the-mock test moves nothing but the server's answer** — two mounts, identical props, different mocked `tools`; both arrays asserted exactly AND asserted different from each other.
- **The `?raw` fence's positive control passes and a label map is NOT flagged** — the fence is scoped to an ARRAY LITERAL of two or more tool ids and carries both a positive control (it finds a planted list) and a NEGATIVE one (it leaves `{ search_documents: "Search documents" }` alone), which is precisely the `friendlyToolName` shape that must survive.
- **A locked gate row has zero controls** — `querySelectorAll('button, [role="button"], input')` is **0**, checked on the row element itself; the unlocked sibling in the same render has exactly **1**, and clicking it fires the caller's handler once. The ⓘ `InfoHint` is deliberately absent from gate rows because it is `role="button"`.
- **The order rail's sentence is exact** — `"Runs as step 1 of 3 — steps run in order, one after another."` matched as a contiguous string (em dash included), and the rail asserted to contain zero `button`/`input`/`select`/`a`.
- **The struck-through tool is present, not hidden** — the `web_scrape` chip exists in the DOM with `line-through` in its class list and `data-unregistered="true"`, while a registered sibling in the same render is asserted NOT to carry `line-through` (the control that keeps the check meaningful).
- **The degraded branch renders zero options** — `queryAllByTestId("tool-option")` is **0** and `tools-rail` is absent entirely, alongside a sentence matching `/could ?n[o’']t load/i`.
- **The "exactly one form component" scan is real** — `import.meta.glob` over every `./*.{ts,tsx}` in the directory; the offender list is `[]`, and the positive control asserts the glob returned more than 5 modules AND that the regex does match `PhaseFormPanel.tsx` itself.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `react-hooks/set-state-in-effect` forced `idle`/`loading` to be DERIVED**

- **Found during:** Task 1, first eslint run
- **Issue:** the hook was written the obvious way — `setState({kind:"loading"})` synchronously in the effect body before the fetch. ESLint rejected it outright: *"Calling setState synchronously within an effect can trigger cascading renders … Avoid calling setState() directly within an effect"* (`react-hooks/set-state-in-effect`, error severity). The shipped `usePanelReconcile.ts:122` does exactly this and is NOT flagged, so copying the analog verbatim was not available either.
- **Fix:** only the server's ANSWER is stored. The two waiting readings fall out of `enabled` plus the absence of an answer: `return answer ?? (enabled ? LOADING : IDLE)`, with both frozen at module scope so the returned state is identity-stable across renders. This is better than the version the lint rejected for a reason beyond the lint: a previously read palette now SURVIVES a transient disable or a re-enable instead of being wiped back to a client-authored empty, which is 184-06's Deviation 6 arriving in a different hook.
- **Files modified:** `frontend/src/hooks/useGroundingBundle.ts`
- **Verification:** eslint clean; all 12 assertions pass unchanged, including `enabled:false ⇒ idle` and the abort-on-unmount case which still observes `loading` as the last rendered value
- **Committed in:** `cdea3289`

---

**2. [Rule 2 - Missing Critical] `PhaseGateRow` is a discriminated union, not `locked: boolean`**

- **Found during:** Task 2
- **Issue:** the plan's shape is `gates: Array<{ label: string; locked: boolean }>`, and the plan ALSO requires an unlocked row to carry exactly one removal control. Those two cannot both be honoured with that shape: with no handler in the contract, the `○` row's button either does nothing (a dead control on a governance surface — the exact "affordance that lies" failure this phase keeps guarding against) or the panel invents a write path it does not own, since a gate is a `validators` entry and this panel's only write seam (`onChange`) patches `config`.
- **Fix:** `PhaseGateRow = { label; locked: true } | { label; locked: false; onRemove: () => void }`. Both failure directions are now un-representable — a locked gate cannot carry a remove handler, and a removable gate cannot lack one — which is the idiom this very file established with its required `onClose`. The union reads structurally as `{label, locked}` at every call site that only displays, so the plan's shape is a floor rather than a ceiling.
- **Files modified:** `frontend/src/components/workflows/PhaseFormPanel.tsx`
- **Verification:** *"an UNLOCKED gate row has exactly one, and it fires the caller's handler"* asserts `toHaveBeenCalledTimes(1)`; its locked sibling in the same render asserts **0** controls
- **Committed in:** `c8f3943e`

---

**3. [Rule 2 - Missing Critical] A degraded read still prints what the step already names**

- **Found during:** Task 3
- **Issue:** implemented literally — "render a sentence and zero options" — a degraded bundle would have made the step's OWN stored `available_tools` disappear from the panel entirely. A user who opens a step during a registry blip would see their tools gone, which is a second, worse lie than the empty picker R11 exists to prevent: the empty picker says "you have nothing to choose from", the blank field says "you have nothing".
- **Fix:** the degraded branch renders the could-not-load sentence AND, when the step names tools, a plain line — *"This step currently names: …"* — using `friendlyToolName` for the labels. It is text, not a picker: `tool-option` count stays **0** and `tools-rail` is not rendered at all, so both halves of the plan's degraded criterion still hold exactly.
- **Files modified:** `frontend/src/components/workflows/PhaseFormPanel.tsx`
- **Verification:** two separate assertions — the zero-options one and *"a degraded read still prints what the step already names"*
- **Committed in:** `6800b6a7`

---

**4. [Rule 2 - Missing Critical] "We asked and the answer was none" is a DIFFERENT state from "we could not ask"**

- **Found during:** Task 3
- **Issue:** with a successful read whose `tools` array is genuinely empty, the rail would have rendered an empty `role="group"` — visually the empty-but-normal picker R11 names as the thing to avoid, arrived at from the other direction. The degraded branch cannot cover it, because this read SUCCEEDED.
- **Fix:** a third rendered state, `tools-empty`: *"This workspace offers no tools for this step."* It is a claim we are entitled to make (the server answered and named no failed registry), and it is asserted to be distinct from the degraded one in both directions.
- **Files modified:** `frontend/src/components/workflows/PhaseFormPanel.tsx`
- **Verification:** *"an EMPTY registry with a successful read is a different, honest state"* asserts `tools-empty` present and `tools-degraded` absent
- **Committed in:** `6800b6a7`

---

**5. [Rule 2 - Missing Critical] `ready.degraded` is the EMPTY TUPLE, so the spoof is unconstructable**

- **Found during:** Task 1
- **Issue:** the plan's `ready` member carries `degraded: string[]`, which is always `[]` in practice — but nothing stopped a future edit from constructing `{kind:"ready", …, degraded: bundle.degraded}` and reintroducing exactly the spoof T-184-09-02 exists to close, with every behavioural test still green because they only exercise the paths that exist today.
- **Fix:** `degraded: readonly []` on the `ready` member. `[]` is assignable; `bundle.degraded` is not. This is 184-06's fail-closed-BY-SHAPE idiom (its `degraded` member carries no `ok` field) applied to the inverse direction, and the docblock says so at the declaration.
- **Files modified:** `frontend/src/hooks/useGroundingBundle.ts`
- **Verification:** `tsc` holds at 33 with the ready construction using a literal; a deliberate local edit to pass `bundle.degraded` through produced a typecheck error
- **Committed in:** `cdea3289`

---

**6. [Rule 2 - Missing Critical] The D-14 guard is a MARKER DIFFERENTIAL, not a stored `outerHTML` snapshot**

- **Found during:** Task 3
- **Issue:** the plan says *"snapshot the container's `outerHTML`"*. Taken as a vitest snapshot, that writes a `__snapshots__` artifact — and this phase's Wave-0 gate is `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'`, which a new artifact sits awkwardly beside (it passes only because the file is untracked, which is worse, not better). `toMatchInlineSnapshot` avoids the directory but embeds ~5 KB of the `llm_agent` form into the test file, where it fails loudly on every unrelated label tweak and teaches the next author to press `-u` — the failure mode that makes a snapshot stop guarding anything.
- **Fix:** the property is encoded directly. Seven markers name everything the rails introduce (`data-rail`, `rail-order`, `rail-gates`, `tool-option`, and the three rail sentences); one test asserts NONE appears in a rails-absent render, and a dedicated **positive control** asserts EVERY one appears in a rails-present render — so the guard cannot pass by naming strings that never render. Beside it: the shipped free-text `available_tools` input is asserted present with the RAW ids and `type="text"`, the chip picker asserted absent, `[data-rail]` asserted **0**, and a fourth test asserts the two renders differ at all (so the prop is load-bearing rather than inert).
- **Files modified:** `frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx`
- **Verification:** 4 assertions in the D-14 describe block, all green; the canvas snapshot gate is untouched and still exits 0
- **Committed in:** `6800b6a7`

---

**7. [Rule 1 - Bug] The "no free-text box" assertion was written wrong the first time and went red**

- **Found during:** Task 3, first run (1 of 24 failed)
- **Issue:** the assertion was `expect(screen.queryByLabelText(/what this step can do/i)).not.toBeInTheDocument()`. It failed, and it was RIGHT to fail: the rail is a `role="group"` with `aria-label="What this step can do"`, which is a correctly named element, so the accessible name legitimately still resolves. Deleting the `aria-label` to make the assertion pass would have removed real accessibility to satisfy a badly worded guard — the "a guard that only passes by making something else lie" trap, arriving as an a11y regression instead of a docblock one.
- **Fix:** the assertion now says what it means: the element that answers to that name IS the rail, and its tag is neither `INPUT` nor `TEXTAREA`. The rail is separately asserted to contain zero `input`/`textarea` descendants, and no input anywhere in the panel carries the tool list as a value.
- **Files modified:** `frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx` (this plan's own net-new file — not a shipped assertion)
- **Committed in:** `6800b6a7`

---

**8. [Rule 2 - Missing Critical] `requirements.mark-complete` was NOT run**

- **Found during:** post-plan state updates
- **Issue:** this plan's frontmatter names `requirements: [CANVAS-03, CANVAS-04]`. The verb flips both to **Complete** off the frontmatter alone, as it did in 184-01 (reverted) and was avoided in 184-02 through 184-08. CANVAS-03 is *configure a selected node in a side panel* and CANVAS-04 is *governance expressed as visible rails* — and **no page passes `rails` yet.** The panel, the hook and every proof exist; a user can observe no difference until 184-13 composes the canvas region.
- **Fix:** the verb was not invoked. `.planning/REQUIREMENTS.md` is untouched; all five phase REQ-IDs (`VALID-02`, `VALID-03`, `CANVAS-02`, `CANVAS-03`, `CANVAS-04`) remain **Pending**. The orchestrator marks them at phase end when the behaviour is observable (Phase 182's VALID-01 precedent).
- **Files modified:** none

---

**Total deviations:** 8 (1 bug, 6 missing-critical, 1 blocking)
**Impact on plan:** none expands scope — the file set is exactly the four in `files_modified`. Deviation 1 is a lint rule deciding an implementation (and improving it); 2, 3, 4 and 5 are the plan's intent implemented correctly rather than literally; 6 replaces a mechanism with an equivalent that does not collide with another gate; 7 is a defect found and fixed inside this plan's own new file; 8 prevents a false completion claim in a planning artifact.

---

## Design decisions worth carrying forward

- **The lint rule was right, twice in three plans.** 184-08 had two file placements decided by `react-refresh/only-export-components`; this plan had a state shape decided by `react-hooks/set-state-in-effect`. In all three cases the rule pushed toward the better design, not merely a compliant one. Worth assuming, next time, that a React lint error is an architectural argument rather than an obstacle.
- **Two failure directions, one union.** A `locked: boolean` flag can express "locked with a remove button" and "removable with nothing to press". A discriminated union cannot express either. That is the same move `onClose: () => void` made in this file three phases ago, and it is now the second load-bearing invariant here that lives in the type system rather than in a test.
- **A "no X" guard needs to be worded as the property, not as the absence of a string.** The `?raw` tool fence is scoped to an array LITERAL and carries a negative control proving a label map survives it; the free-text guard names typability rather than the accessible name. Both were written the blunt way first and both would have forced something honest to change — a docblock in one case, an `aria-label` in the other. That is now roughly the ninth instance of D-ITEM-183-02 in this phase, and the tell is identical every time.
- **A byte-identity guard does not have to be a snapshot.** Seven markers plus a per-marker positive control encodes "the rails changed nothing when absent" more precisely than a 5 KB blob, and it cannot rot into a `-u` reflex. Reusable shape for any future optional-prop additivity claim.
- **The degraded surface has THREE states, not two.** "We could not ask", "we asked and the answer was none", and "here is the list" are three different sentences and a user can act on each differently. Collapsing the first two into one empty box is the specific lie CANVAS-04 was written about.
- **The panel fetches nothing.** `useGroundingBundle` lives at the page; the rails arrive as data. That is what lets `PhaseFormPanel.rails.test.tsx` render 24 cases with no provider, no mock of the API module and no `@xyflow` — and it is what makes Phase 185 an additive change to `rails.gates` rather than a re-layout.

## Requirements

**Neither CANVAS-03 nor CANVAS-04 is complete, and `.planning/REQUIREMENTS.md` was deliberately left untouched.**

- **CANVAS-03** — the panel is extended in place, no second form component exists (machine-checked over every module in the directory), `onClose` is still required (`TS2741` on removal), the 44 px rail and the bottom sheet both survive, and per-type conditioning is asserted unchanged WITH rails present. What is missing is the wiring: **no page passes `rails`**, so the canvas is not yet a third way in to anything.
- **CANVAS-04** — all three rails render, the whitelist is provably bundle-sourced, the locked gate is structurally undetachable and the degraded read says so. Same gap: nothing supplies the prop. **184-13 composes the canvas region and is where a user first sees any of this.**

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-09-01 (elevation of privilege — the tool whitelist source) | mitigate | **CLOSED.** The option set is `rails.toolOptions`, which is `useGroundingBundle`'s pass-through of `bundle.tools`, asserted by identity (`toBe`) at the hook and by option-set EQUALITY over two different arrays at the panel. No frontend tool list exists in either module: the hook carries a `?raw` fence scoped to array literals with a positive AND a negative control, and `friendlyToolName` survives untouched as the display-label map it always was |
| T-184-09-02 (spoofing — a degraded registry as a complete palette) | mitigate | **CLOSED BY CONSTRUCTION.** A non-empty `degraded` resolves to `kind:"unavailable"`, and the `ready` member's `degraded` is the EMPTY TUPLE type, so the widening that would reintroduce the spoof is a typecheck error rather than a code review question. At the surface, `"degraded"` renders a could-not-load sentence with **zero** `tool-option` elements and no `tools-rail` at all — and a successful empty read renders a THIRD, separately asserted state so the two are never conflated |
| T-184-09-03 (elevation of privilege — flag-off surface drift) | mitigate | **CLOSED.** The rails ride an optional prop; the 19 shipped panel assertions pass with an EMPTY file diff; and the rails-absent render is asserted to contain none of the seven strings the rails introduce, each proven to appear in the rails-present render. This is the surface `revertByteIdentical.test.tsx` cannot see (it never renders this component), which is why the guard is a new file — 184-VALIDATION.md records the reasoning |
| T-184-09-04 (tampering — governance the author can wire around) | mitigate | **CLOSED STRUCTURALLY.** A `locked: true` row's subtree contains zero `button`, zero `[role="button"]` and zero `input` — not a disabled control, none. The type system carries the other half: a locked row cannot be constructed with a remove handler, and a removable one cannot be constructed without |
| T-184-09-05 (tampering — scope creep into Phase 185's field) | mitigate | **CLOSED.** `grep -c 'grounding_mode' PhaseFormPanel.tsx` is **0**, with a `?raw` fence and a positive control pinning it. The gates array is DERIVED by the caller exactly as the shipped `groundingFor()` derives grounding today; no authored grounding field appears in the definition, the panel, the props or the store. D-183-07's two-badge vocabulary is untouched — the rails are panel content, not a third badge |
| T-184-09-SC (tampering — npm installs) | accept | **HONOURED — this plan installed nothing.** `package.json` and the lockfile appear in none of the three commits |

## Scope Fence Compliance

- **Frontend only.** `git diff --name-only -- backend/ supabase/migrations` returns **0** lines across all three commits. `GET /workflows/grounding-bundle` is consumed exactly as shipped; slot 114 stays RESERVED.
- **No env var, no dependency, no migration, no cloud parity owed.**
- **No second client for the bundle route.** 184-06's `getGroundingBundle` is the only one, and `useGroundingBundle` is its only caller.
- **Nothing is mounted.** `WorkflowCanvas.tsx`, `PhaseNode.tsx` and `WorkflowBuilderPage.tsx` are untouched; the canvas snapshot is byte-unchanged and all 31 + 22 shipped canvas assertions pass unmodified.
- **No third badge, no new colour beyond the existing tokens, no motion added** — the rails spend `border`/`muted`/`primary` tokens the app already ships.
- **`fireEvent` everywhere**, never `user-event` — the panel is outside the xyflow plane, but a second click driver in a suite this close to the canvas would invite the d3-drag landmine back by example (the shipped `PhaseFormPanel.test.tsx:378-380` reasoning).
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed anywhere. No scratch file written inside `frontend/` or `backend/` — the `onClose` probe was an in-place edit with its backup held outside the tree, reverted and grep-verified.

## Issues Encountered

- **`usePanelReconcile.ts` sets state synchronously in an effect and is not flagged; a structurally identical new hook is.** Whatever the rule's heuristic is, the shipped analog is no longer a safe template for a new in-hook fetch. Worth knowing before 184-13 or Phase 188 copies it.
- **A labelled `role="group"` answers to `getByLabelText`.** "There is no field with this name" is the wrong way to say "there is nothing to type into", and writing it the wrong way first cost one red test (Deviation 7). Say typability.
- **`lib/model-info.test.ts`** remains pre-existing SEED-056 rot; outside this plan's target set and not touched.
- **`PublishGauntlet.test.tsx`'s parallel-run flake** did not appear in any run of this plan; it reported its pinned 24 green on every gate invocation.

## User Setup Required

**None.** No env var, no migration, no dependency, no cloud step, no operator action.

Carried forward, unchanged: `__fixtures__/corpusDump.json` still needs regenerating against a running local Supabase before `/gsd:verify-work` (184-05's blocker), and the live in-app five-surface icon sweep remains a phase-verification G-4 row needing Docker up (184-01). Neither is a dependency of this plan.

## Next Phase Readiness

- **184-13 has everything it needs.** It calls `useGroundingBundle(canvasEnabled)` at the page, maps the result to `rails.toolOptions` (`state.kind === "ready" ? state.tools : state.kind === "unavailable" ? "degraded" : …`), derives `rails.gates` from `groundingFor()` exactly as the canvas cards already do, and passes `rails.order` from `phase_index`. The panel fetches nothing and the rails are pure data.
- **The `loading` and `idle` readings need a caller decision.** This plan deliberately did not choose what the rail shows before the first answer lands — `rails` is simply not supplied yet, and 184-13 owns whether an in-flight palette reads as the degraded sentence or as a brief absence. The hook's docblock states the four readings so the choice is made on purpose.
- **Phase 185 adds DATA, not layout.** A graded per-node grounding mode becomes a different `rails.gates` array from the caller — locked rows for Grounded/strict, none for Open/flexible — with no change to this panel. That is the seam sketch 140-A was chosen for, and `grounding_mode` is grep-asserted absent so 184 cannot have pre-empted it.
- **`PublishGauntlet`'s optional `blockedReason`** is the same additive-optional shape and can copy this prop's docblock wording verbatim, including the "absent ⇒ today" sentence that makes the D-14 mechanism legible at the declaration.
- **The zero-assertion-edit gate is intact for THIS plan** (four files, zero pre-existing assertions touched), but remains broken for phase 184 overall — 184-08 narrowed two Wave-0 seam assertions and enumerated them in its own section (b). A verifier should read that rather than assume the phase-level gate is green.

## Self-Check: PASSED

- `frontend/src/hooks/useGroundingBundle.ts` — FOUND
- `frontend/src/hooks/useGroundingBundle.test.ts` — FOUND
- `frontend/src/components/workflows/PhaseFormPanel.tsx` — FOUND
- `frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx` — FOUND
- Commit `cdea3289` — FOUND
- Commit `c8f3943e` — FOUND
- Commit `6800b6a7` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
