---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 14
subsystem: frontend/workflow-builder
tags: [vocab-03, req-6, d-187-14, sketch-151-c, template-door, source-fence, icon-convention-4]
requires:
  - "STARTER_DOOR_LINE / _HEADING / _NOTE + starterSeedSentence + StarterChoiceJSON — plan 187-10's four Req-6 exports"
  - "listStarterWorkflows (api.ts:1363) — the shipped, un-gated GET /workflows/starters client"
  - "PhaseSpine (Phase 124) — the shipped horizontal glyph-dot spine, the ONE 3D phase-mark resolver's consumer"
  - "useTechnicalNamesOptional — the shipped fail-closed ⌥ reveal accessor"
  - "the StepTypePicker hand-rolled panel idiom (Escape / click-outside / `if (!open) return null` / role=menu)"
provides:
  - "StarterTemplatePicker — the template door (Req 6), a self-contained surface: its own trigger, open state, dismissal and fetch"
  - "StarterTemplatePickerProps — { onChoose(seedSentence), className? } — the contract 187-15 mounts against"
  - "STARTER_DOOR_LOADING / _UNAVAILABLE / _EMPTY — the three fetch-outcome sentences 187-10 did not ship"
  - "StarterTemplatePicker.test.tsx — 40 tests: the seed-the-box behaviour plus the single-forward-path SOURCE fence"
affects:
  - "187-15 (the page mount) — imports StarterTemplatePicker, owns the ONE mount line, the `canvasEnabled` gate and where the sentence lands (`setDescribe`)"
tech-stack:
  added: []
  patterns:
    - "a self-contained surface, not a leaf: the component owns its trigger + panel + state + fetch so the page gains ONE line (D-187-14)"
    - "a narrowed rather than dropped purity fence — exactly ONE api symbol, asserted as a flat count"
    - "the no-second-forward-path property proved twice: behaviourally (toHaveBeenCalledTimes(0) over an ENUMERATED mock) and at the source (?raw grep)"
    - "the event PHASE is a recorded decision with its own falsification test, never an inheritance"
    - "containment checked against the ROOT (trigger + panel) so capture cannot fight the trigger's own toggle"
    - "expected sentences are produced by calling the formatter IN the test, never typed"
key-files:
  created:
    - frontend/src/components/workflows/StarterTemplatePicker.tsx
    - frontend/src/components/workflows/StarterTemplatePicker.test.tsx
  modified:
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/definitionOps.test.ts
decisions:
  - "CAPTURE phase chosen deliberately and for a DIFFERENT reason than StepTypePicker's — not required here (no d3-zoom plane on the describe screen) but immune to any future stopPropagation; its only cost is removed by checking containment against the root"
  - "The three missing fetch-outcome sentences were added to definitionOps rather than authored in the component (187-10's own handoff rule), and 'we could not look' is kept apart from 'there are none'"
  - "The technical token under the ⌥ reveal is the starter's SLUG — the StepTypePicker row shape verbatim"
  - "A FAILED fetch may retry on the next open; a SUCCESSFUL one never re-fetches"
  - "The row spine is rendered by the shipped PhaseSpine, so no glyph map is read here — not merely un-redeclared"
metrics:
  duration: ~50 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 14: The template door — Summary

The Builder's first screen gains **one quiet line**, and picking a template **fills the describe
box** with the starter's own plain-language sentence — leaving you on the same screen, with the text
still editable and nothing generated. There is still exactly one way a workflow comes into
existence.

## What Was Built

**Task 1 — the door (`0aa673ad`).** `frontend/src/components/workflows/StarterTemplatePicker.tsx`,
356 lines. It is deliberately **not** a leaf in the `GovernanceSection` / `StepTypePicker` sense: it
owns its trigger, its `open` state, its dismissal **and its fetch**, because D-187-14 says the page
gains one mount line and nothing else. `WorkflowBuilderPage.tsx` is untouched by this plan (verified
by an empty `git status --porcelain`).

```ts
export interface StarterTemplatePickerProps {
  onChoose: (seedSentence: string) => void   // the ONLY thing it writes
  className?: string                          // placement only
}
```

At rest: one text button carrying `STARTER_DOOR_LINE`, `aria-haspopup="menu"`,
`aria-expanded="false"`. Opened: a hand-rolled `role="menu"` panel — heading, note, and one
`role="menuitem"` row per curated starter (its phase spine, its name, its seed sentence, and its
slug only under the ⌥ reveal).

Five properties are load-bearing rather than stylistic:

- **`onChoose(starterSeedSentence(starter))` is the whole of the interaction.** No definition is
  constructed, no request is made, nothing is navigated to. The module does not *name* a create,
  update, delete, publish, generate or validate seam — in code **or in prose**, because the fence
  that proves it is a flat grep (the 187-13 `delay` lesson: a comment is exactly where *"we could
  fork here later"* gets written down).
- **The API client contributes EXACTLY ONE symbol.** This component breaks the no-fetch leaf rule
  because the starters are server data, so the fence is narrowed rather than dropped:
  `listStarterWorkflows` and nothing else, asserted as a flat count. The route is a documented
  un-gated **RUN CARVE-OUT** over rows that are already world-readable (`is_system_global`,
  mig-056), so no visibility gate is added here and no scope is widened.
- **Fetch on FIRST OPEN, not on mount**, `AbortController`-scoped and aborted on unmount. A
  **successful** list is fetched once no matter how often the panel toggles; a **failure** is
  allowed one more try on the next open — the request is idempotent and read-only, and a door that
  stays broken for the rest of the session over one blip is worse than a second GET.
- **A failed fetch invents nothing.** The imported sentence and **zero rows** — no cached list, no
  remembered rows, no fabricated starter. And `STARTER_DOOR_UNAVAILABLE` is kept apart from
  `STARTER_DOOR_EMPTY`: *"we could not look"* and *"there are none"* are different facts, and a
  surface that says the first when it means the second is lying quietly.
- **A starter is its phase SPINE, never a category icon** (icon-convention §4, finding #36). The
  spine is rendered by the shipped `PhaseSpine`, so no glyph map is read here — not merely
  un-redeclared. ⚠ Measured and deliberately **not** "fixed": all three starters share the identical
  spine (`llm_agent` → `llm_emit`), so the spine is **orientation** and the **name** identifies the
  row. That is recorded in the source so a later reader does not invent a per-workflow mark.

**The click-outside phase is a decision, with its own test.** `StepTypePicker` uses CAPTURE because
it must — the d3-zoom plane `stopPropagation()`s on mousedown (measured: 0 bubble hits, 1 capture
hit). The describe screen has no such plane, so bubbling would work **today**. Capture is chosen
anyway: it is the only phase immune to a future handler between the target and `window` swallowing
the press, and the failure that produced is the worst a menu has — it becomes inescapable except by
picking something. Capture's only cost (firing before the trigger's own React click handler) is
removed by checking containment against the **ROOT (trigger + panel)** rather than the panel alone.
Both halves have a test.

**Task 2 — the suite (`866ff647`).** `StarterTemplatePicker.test.tsx`, 626 lines, **40 tests** in
nine blocks: at-rest, opening, choosing, dismissal, honest failure, totality, the ⌥ reveal, the
source fence, and the whole-suite network tripwire.

The single-forward-path property is proved **twice, in two different kinds**:

| Kind | Mechanism |
|---|---|
| Behavioural | The `vi.hoisted` api mock **enumerates** `createWorkflowDraft`, `updateWorkflowDraft`, `deleteWorkflowDraft`, `publishWorkflow`, `generateWorkflow`, `validateWorkflow`, `listPublishedWorkflows` and asserts each `toHaveBeenCalledTimes(0)` after a row is chosen — enumerating rather than omitting is what turns "it did not fork" from an absence into an observation. A control test plants a call and observes the assertion go red. |
| Source | A `?raw` fence asserts the module **names** none of those symbols, imports from `@/lib/api` exactly once, carries no `@radix-ui`/`popover`, holds no store reference, declares no `PHASE_GLYPHS`, contains `if (!open) return null` and no `dangerouslySetInnerHTML`. Every pattern has a planted positive control. |

The fixture is the **measured** shape from `187-RESEARCH.md` §"The template door" — exactly three
curated starters, 2 phases each (`llm_agent` → `llm_emit`), one template `.docx` asset each, none
carrying a phase `name` — with one row's `business_requirement` set to `null` so the documented
fallback is exercised rather than assumed. **Every expected sentence is produced by calling
`starterSeedSentence` in the test**, never typed, so a copy change moves both sides at once.

## Measured Results

| Measurement | Bar | Result |
|---|---|---|
| `StarterTemplatePicker.test.tsx` | passes, 0 failed | **40 passed** |
| `StarterTemplatePicker + StepTypePicker + definitionOps` | 0 failed | **299 passed** |
| Plan verification set (+ `soulData`) | 0 failed | **313 passed** |
| `StepTypePicker.test.tsx` count | unchanged | **36** (HEAD 36) |
| `definitionOps.test.ts` count | — | **223** (HEAD 222, +1 guard) |
| `npx tsc -b` — total / in `components/workflows` | no NEW error (D-ITEM-01) | **33 / 0** — identical to HEAD |
| `npx eslint` on all four files | clean | **0 problems** |
| `grep -cE "from ['\"]@/lib/api['\"]"` | 1 | **1**, symbol = `listStarterWorkflows` |
| `grep -cE "createWorkflowDraft\|updateWorkflowDraft\|setDrafted\|useNavigate\|navigate\("` | 0 | **0** |
| `grep -ciE "@radix-ui\|popover"` | 0 | **0** |
| `grep -c "PHASE_GLYPHS"` | 0 | **0** |
| `grep -c "STARTER_DOOR"` | ≥ 3 | **13** |
| `grep -c "if (!open) return null"` | ≥ 1 | **1** |
| `git diff --stat -- frontend/package.json frontend/package-lock.json` | empty | **empty** |
| `git status --porcelain WorkflowBuilderPage.tsx WorkflowsPage.tsx` | empty | **empty** |

## TDD Gate Compliance

Task 2 is `tdd="true"`, but the plan's own ordering builds the component in Task 1 and tests it in
Task 2, so a natural RED-before-GREEN was not available for the feature itself. Falsification was
therefore **observed rather than asserted**, in four separate ways — the Phase-185 lesson (*observe
falsification RED first*) discharged on the properties that matter:

1. **The suite's own first run was RED: 1 failed / 39 passed.** The failure was a defect in the
   "does not fall back to a remembered list" test itself (recorded under Deviations), not in the
   component. A suite green on its first run has usually not been watched.
2. **Mutation A — seed the raw `starter.name` instead of the formatter**
   (`onChoose(starterSeedSentence(starter))` → `onChoose(starter.name)`): **2 failed / 38 passed.**
   The third fixture row has a null `business_requirement`, so its name *is* its seed — the mutation
   passes that row and fails the other two, which is exactly what a fixture with a fallback case is
   for.
3. **Mutation B — a failure reported as "there are none"**
   (`setState({ kind: "failed" })` → `setState({ kind: "ready", rows: [] })`): **2 failed /
   38 passed.** That is the honesty distinction the two sentences exist to keep.
4. **Mutation C — the closed panel renders hidden DOM** (`if (!open) return null` →
   `if (false) return null`): **9 failed / 31 passed.**

All three mutations were reverted in place (`git diff --stat` empty) and the file re-verified green
before the commit.

Commits are `feat(...)` then `test(...)` rather than a `test → feat` pair; the observations above
are the gate, matching plans 187-02, 187-10 and 187-13's shape in this phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] The door's failure/loading/empty sentences did not exist**
- **Found during:** Task 1.
- **Issue:** The plan requires *"if the request fails, the panel says so plainly using an imported
  sentence"* and *"every user-visible string is an imported `definitionOps` identifier"*. Plan
  187-10 shipped four Req-6 exports (`STARTER_DOOR_LINE` / `_HEADING` / `_NOTE` +
  `starterSeedSentence`) and **no sentence for any of the three non-success fetch outcomes**. The
  component could not satisfy both instructions as written.
- **Fix:** three new exports in `definitionOps.ts` — `STARTER_DOOR_LOADING`,
  `STARTER_DOOR_UNAVAILABLE`, `STARTER_DOOR_EMPTY` — which is 187-10's own stated handoff rule
  (*"if you need a new sentence, add it here — a sentence inside a component is a sentence nobody
  can test for drift"*). They are kept as three distinct facts rather than collapsed: a loading
  panel that shows nothing is not an answer to the question the user just asked, and reporting a
  failure as "there are none" is a surface asserting something it does not know.
- **Files modified:** `frontend/src/components/workflows/definitionOps.ts`
- **Commit:** `0aa673ad`

**2. [Rule 2 — Missing critical] The new sentences would have escaped every shipped copy guard**
- **Found during:** Task 1, immediately after Deviation 1.
- **Issue:** `definitionOps.test.ts` carries three guards over Phase-187 copy — the overclaim word
  class (`safe` / `approved` / `proven`), the unshipped-glyph check (`✦` / `✓`), and a
  non-empty-and-distinct assertion. All three read from **hand-maintained arrays**. Three new
  exported sentences added outside those arrays would be three sentences with no drift protection
  at all, which is the exact hole the guards exist to close.
- **Fix:** the three constants were added to `PHASE_187_COPY` and to the distinctness array, plus
  one new character-identity test that also asserts `STARTER_DOOR_UNAVAILABLE !== STARTER_DOOR_EMPTY`
  so the honesty distinction is pinned rather than merely intended. Count 222 → **223**.
- **Files modified:** `frontend/src/components/workflows/definitionOps.test.ts`
- **Commit:** `0aa673ad`

**3. [Rule 1 — Bug] The docblock named `setDrafted`, which is itself a fence violation**
- **Found during:** Task 1 acceptance greps.
- **Issue:** `grep -cE "…|setDrafted|…"` returned **1** — from the component's own prose
  (*"no store reference, no `setDrafted`, no router"*). This is 187-13's `/delay/i` finding
  repeating: a strong flat-grep fence and explanatory prose that names the forbidden thing cannot
  both stand.
- **Fix:** the strong fence stays and the prose was reworded to say the property without naming any
  symbol — *"it holds no store reference, sets no draft state and mounts no router — and it does not
  NAME any of them either, in code or in prose, because the source fence … is a flat grep."* The
  reason is recorded in-source so nobody re-introduces the name to be helpful. Count is now **0**.
- **Files modified:** `frontend/src/components/workflows/StarterTemplatePicker.tsx`
- **Commit:** `0aa673ad`

**4. [Rule 1 — Bug] The "no remembered list" test rendered a second picker over a live first one**
- **Found during:** Task 2, first run (the RED).
- **Issue:** the test rendered a second `StarterTemplatePicker` while the first was still mounted
  and then resolved by `screen.findAllByTestId`, which searches the whole document body. The
  assertion was reading an ambiguous node, so it would have proven nothing whichever way it landed.
- **Fix:** unmount the first picker before mounting the second, and assert against the single
  resulting panel. The test now measures what it claims to — that a fresh mount shows the server's
  answer and nothing carried over.
- **Files modified:** `frontend/src/components/workflows/StarterTemplatePicker.test.tsx`
- **Commit:** `866ff647`

**5. [Rule 3 — Blocking] The stopPropagation stand-in tripped `jsx-a11y/no-static-element-interactions`**
- **Found during:** Task 2 lint.
- **Issue:** the capture-phase test copies `StepTypePicker.test.tsx`'s `<div onMouseDown={stop}>`
  pane stand-in, which the repo's eslint config rejects as a non-native interactive element.
- **Fix:** the stand-in is a native `<button type="button">`. Only `mouseDown` is fired at it, so the
  behaviour under test is unchanged, and the stand-in is no longer itself an a11y violation the
  linter has to be argued out of.
- **Files modified:** `frontend/src/components/workflows/StarterTemplatePicker.test.tsx`
- **Commit:** `866ff647`

### Decisions taken inside Claude's discretion

**6. The ⌥ reveal shows the starter's SLUG.** The plan's instruction is conditional (*"**if** the
rows show any technical token"*). Unlike 187-13's receipt, this row genuinely has one — the slug is
the row's technical identifier — so the condition fires and it is read through the shipped
`useTechnicalNamesOptional()?.showTechnical ?? false` accessor, exactly the `StepTypePicker` row
shape. A test asserts that with no provider mounted, no slug reaches the DOM at all.

**7. A failed fetch may retry on the next open; a successful one never re-fetches.** The plan says
"fetch on open" and the acceptance criterion is "opening fetches the starters once". Both hold for
the success path (asserted: open → Escape → open = 1 call). The failure branch clears the
once-only latch, because the request is idempotent and read-only and the alternative is a door that
stays broken for the rest of the session over one network blip. Recorded in-source.

**8. `PhaseSpine` is reused rather than a spine being drawn here.** The plan asks for marks "built
from the shared `PHASE_GLYPHS` map via the shipped resolver". Reusing the shipped spine component
is one notch stronger than importing the resolver: this file reads **no** glyph vocabulary at all,
so `grep -c PHASE_GLYPHS` is 0 for a structural reason rather than a disciplined one. `PhaseSpine`
is total over a malformed or absent definition (a totality test covers three malformed rows), and
the `definition as DefShape` narrowing is the shipped `WorkflowsPage.tsx:761` / `:1015` read.

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-187-14-01 (EoP — starter exposure) | accepted, as planned | The picker calls only the shipped `GET /workflows/starters`, a documented un-gated RUN CARVE-OUT over `is_system_global` published rows (world-readable by mig-056). The source fence asserts `@/lib/api` is imported exactly once and names `listStarterWorkflows`; nothing widens scope and no query parameter is added. |
| T-187-14-02 (EoP — a second forward path) | mitigated | Proved twice. Behavioural: seven enumerated create/update/delete/publish/generate/validate/list symbols each `toHaveBeenCalledTimes(0)` after a row is chosen, with a planted-call control proving the assertion bites, plus the same zero-check on the failure path. Source: the module names none of them, nor `useNavigate` / `navigate(` / `setDrafted`. |
| T-187-14-03 (Input validation / XSS) | mitigated | `starter.name` and the seed sentence render as plain React text children; the seed value leaves through `onChoose` as a string. `grep -c dangerouslySetInnerHTML` = **0**, fenced at the source with a positive control. |
| T-187-14-04 (Tampering — a fabricated list on failure) | mitigated | A rejected `listStarterWorkflows` renders `STARTER_DOOR_UNAVAILABLE` and **zero** `menuitem`s; a separate test proves an earlier successful list is not carried into a fresh mount; a third keeps the failure sentence distinct from the empty-but-successful one. Falsification observed (Mutation B → 2 failed). |
| T-187-14-05 (DoS — stale focus trap / unbounded fetch) | mitigated | `open === false` renders no panel DOM (asserted: no `role=menu`/`menuitem`, exactly one `button` — the trigger). The fetch fires on first open, not on mount (asserted at zero calls after render), is `AbortController`-scoped, and is aborted on unmount. Falsification observed (Mutation C → 9 failed). |
| T-187-14-06 (Tampering — glyph vocabulary drift) | mitigated | `grep -c PHASE_GLYPHS` = **0**; the spine comes from the shipped `PhaseSpine`, asserted structurally (two `[data-phase-type]` dots per row, `llm_agent` + `llm_emit`) and marked `aria-hidden`. No category icon is invented. |

## Known Stubs

None. Every branch of the component is implemented and exercised.

**One surface is intentionally unwired — that is the plan's shape, not a stub.**
`StarterTemplatePicker` has no mount until plan 187-15 (D-187-14: the page gains one gated mount
line and nothing else). `WorkflowBuilderPage.tsx` and `WorkflowsPage.tsx` are both untouched by this
plan, verified by an empty `git status --porcelain` — so the Workflows-page curated fork is
unchanged and keeps its library home.

## Threat Flags

None. No new network surface, auth path, file access pattern or schema. The one route read is a
shipped, un-gated, world-readable RUN CARVE-OUT that already had a client; this plan adds no
endpoint, no parameter and no gate.

## For plan 187-15 — what the mount owes

1. **ONE line, and it is `canvasEnabled`-gated.** 187-05's carry-forward is the binding fact:
   `describeScreen` is constructed on **both** `visual_workflow_canvas` branches, so an ungated door
   ships to flag-OFF users. This component carries **no** flag gate of its own — deliberately, since
   the flag is the page's knowledge, not the picker's.
2. **The byte pin may not be protecting you.** `WorkflowBuilderPage.describe.test.tsx` pins the CTA
   flex column resolved by walking up from `describe-hint`. A door mounted as a **sibling** of that
   column will not trip it. Mount it inside the pinned region, or widen the region deliberately —
   and either way re-run `describe + header + canvas` (baseline **122 passed**).
3. **The seam is `setDescribe`, not `initialDescribe`.** `initialDescribe` is an *upstream* hand-off
   prop from the Phase-124 door and is not settable from inside the page
   (187-RESEARCH §"The template door"). `onChoose` hands you a plain string; put it in the
   describe box and do nothing else — the CTA becomes enabled because the box is non-empty, which is
   the shipped `canDraft` behaviour and needs no new wiring.
4. **Do not add a second path on the way past.** The whole of Req 6 is that picking a template
   produces text. If the mount adds an "and draft it now" convenience, it re-creates the second
   forward path this plan spent its budget removing — and the source fence lives in the component,
   so the page would not catch it.
5. **`className` is placement only.** The component owns `relative` positioning and opens its panel
   upward (`bottom-full`); pass margin/alignment, not layout that fights it.
6. **Do not gate acceptance on `tsc -b` exiting 0** — `deferred-items.md` D-ITEM-01; read it as *no
   new error, none in the touched files* (**33 / 0** here, identical to HEAD).

## Verification

```
npx vitest run StarterTemplatePicker.test.tsx                             → 40 passed
npx vitest run StarterTemplatePicker + StepTypePicker + definitionOps     → 299 passed, 0 failed
npx vitest run  … + soulData        (the plan's verification set)         → 313 passed, 0 failed
npx tsc -b                                                                → 33 errors, 0 in
                                                                            components/workflows
                                                                            (identical to HEAD —
                                                                             D-ITEM-01)
npx eslint (all four touched files)                                       → 0 problems
git diff --stat -- frontend/package.json frontend/package-lock.json       → empty
git status --porcelain WorkflowBuilderPage.tsx WorkflowsPage.tsx          → empty
```

Falsification, observed and reverted: raw name instead of the formatter → **2 failed**; a failure
reported as "there are none" → **2 failed**; the closed panel rendering hidden DOM → **9 failed**.

**The wider sweep's failures are not this plan's.** `npx vitest run src/components/workflows
src/pages/WorkflowBuilderPage` shows 4–5 failures across `PublishGauntlet.test.tsx` and
`WorkflowBuilderPage.session.test.tsx`. Both are **100% green in isolation** (46 passed / 23
passed), and the identical set of failures reproduces with this plan's suite **excluded**
(`--exclude "**/StarterTemplatePicker.test.tsx"` → the same 5 failures). Cross-file flake, measured
rather than assumed — consistent with SEED-056 and with 187-CONTEXT's correction of the
project-memory rot figure.

## Self-Check: PASSED

- `frontend/src/components/workflows/StarterTemplatePicker.tsx` — FOUND (created, 356 L)
- `frontend/src/components/workflows/StarterTemplatePicker.test.tsx` — FOUND (created, 626 L)
- `frontend/src/components/workflows/definitionOps.ts` — FOUND (modified, +22)
- `frontend/src/components/workflows/definitionOps.test.ts` — FOUND (modified, +20)
- commit `0aa673ad` — FOUND in `git log`
- commit `866ff647` — FOUND in `git log`
- `git diff --diff-filter=D HEAD~2 HEAD` — empty; neither commit deleted a file
