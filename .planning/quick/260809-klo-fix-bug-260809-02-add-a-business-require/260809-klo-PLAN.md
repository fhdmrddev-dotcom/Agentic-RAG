---
quick_id: 260809-klo
type: execute
mode: quick
title: "BUG-260809-02 — a business_requirement control on the canvas Builder"
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/workflows/builderStore.ts
  - frontend/src/components/workflows/builderStore.test.ts
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
autonomous: true
requirements: [BUG-260809-02]
closes_bug: BUG-260809-02

must_haves:
  truths:
    - "On the canvas Builder (flag ON), an author can type a one-line business requirement without leaving the drafted view."
    - "The typed value reaches the existing PATCH payload as `definition.business_requirement` and survives a reload of the same draft."
    - "The flag-OFF Builder header is byte-identical to what shipped — `FLAG_OFF_HEADER_MARKUP` passes UNEDITED."
    - "Typing a requirement clears the server's `business_requirement` verdict and un-blocks Publish, with no client-side validation rule added."
  artifacts:
    - path: "frontend/src/components/workflows/builderStore.ts"
      provides: "`setBusinessRequirement` — a meta write that arms `dirty` in ONE `set()`"
      contains: "setBusinessRequirement"
    - path: "frontend/src/pages/WorkflowBuilderPage.tsx"
      provides: "The header requirement control, gated on `canvasEnabled`"
      contains: "builder-business-requirement"
  key_links:
    - from: "frontend/src/pages/WorkflowBuilderPage.tsx"
      to: "builderStore.setBusinessRequirement"
      via: "onChange on the header input"
      pattern: "setBusinessRequirement"
    - from: "frontend/src/components/workflows/builderStore.ts"
      to: "useDraftPersistence PATCH body"
      via: "selectDefinition({meta, phases}) — meta spread carries the field with ZERO change to the write path"
      pattern: "selectDefinition"
---

<objective>
BUG-260809-02: a workflow authored on the canvas can never be published, because no UI
anywhere writes `business_requirement` and the publish gauntlet's stage 1 refuses without it.

Purpose: close the one authoring door of three that cannot populate a publish-required field.
Output: one control in the Builder header, one store action behind it, and RED-first tests
that guard the BEHAVIOUR (the value reaches the save payload), not the presence of a DOM node.

**This is narrower than the bug report assumed.** Three of the four things a fix would
normally need already exist and were measured, not inferred:

1. **The store already round-trips the field.** `builderStore.ts:333` destructures
   `{ phases, ...initialMeta }`, `selectDefinition` (`builderStore.ts:293-295`) is literally
   `{ ...state.meta, phases: state.phases }`, and `useDraftPersistence.ts:619` calls exactly
   that to build the PATCH body. So a write into `meta` rides the shipped save path with
   **zero change to the write loop**, and satisfies the "PATCH takes a COMPLETE
   WorkflowDefinition" constraint by construction.
2. **The author-time WARNING already ships, end to end.** `workflows.py:712-721` emits
   `{code:"business_requirement", phase:null, message:"a workflow must declare exactly one
   business_requirement before publish"}`; `workflows.py:527` puts that code in
   `_INCOMPLETE_CODES` so its severity is `incomplete`; `verdictModel.groupVerdicts` routes
   `phase:null` into `workflowWide` (`verdictModel.ts:268`); `ProblemsTray` renders it
   (pinned in `ProblemsTray.test.tsx:133-148`); and `blockedReason`
   (`WorkflowBuilderPage.tsx:1134-1136`) surfaces it verbatim on the disabled Publish.
   **Nothing needs building here — do not build a second warning.**
3. ⚠ **A measured correction to the orchestrator's fact #2.** The fixture at
   `WorkflowCanvas.composition.test.tsx:83` uses the code `missing_business_requirement`,
   which **the backend never emits** — the real code is `business_requirement`
   (`workflows.py:715`, registered at `workflows.py:516` and `:527`). That fixture is an
   invented string in a test, NOT evidence about the shipped tray. The suites that use the
   REAL code are `ProblemsTray.test.tsx:137` and `verdictModel.test.ts:47`. Do not touch
   `WorkflowCanvas.composition.test.tsx` — it is out of scope and its fixture code is only
   ever compared against itself.

So the whole gap is **the input**.
</objective>

<placement_decision>
## The control goes in the Builder header's `identityGroup`, gated on `canvasEnabled`

`WorkflowBuilderPage.tsx:1771-1781`, as a sibling of `kbAffordance` (`:1706-1769`).

**Four measured reasons, in order of force:**

1. **The exact precedent already shipped, for the same bug shape.** D-186-15
   (`WorkflowBuilderPage.tsx:1676-1704`) fixed BUG-260731-03 — *"a definition-level field
   choosable only on the pre-draft describe screen, so of the four ways into this Builder,
   two never offered the choice at all"* — by promoting the KB chip into a control **in this
   exact group, under this exact `canvasEnabled` gate**. `business_requirement` is the same
   field class with the same failure. A second, different answer to one question is drift.

2. **It is the only surface present in BOTH graph views.** `activeGraphView`
   (`:640`) swaps only `graphChild` (`:1550-1599`); the header renders above the grid on both
   branches. A control in `graphColumn` would ride the flag-on wrapper's
   `grid-rows-[auto_auto_minmax(0,1fr)]` (`:1605`), permanently stealing a third auto row from
   the flow — which is the *exact* complaint 184.1 was built to fix (`BuilderHeaderBar.tsx:4-7`:
   *"275 px of chrome above a 288 px canvas"*).

3. **`identityGroup` is already "what workflow is this."** Name (`:1773`), `draft` badge
   (`:1776`), KB binding (`:1779`). The purpose is that same category — and per the sketch
   findings it is the *hero* of the workflow soul (`workflow-soul-and-two-doors.md:7`:
   *"the soul = purpose (`business_requirement` — surfaced nowhere in the product before this)"*).
   The drafted Builder currently surfaces it **nowhere at all**; `WorkflowSoul` is not mounted
   on this page.

4. **It adds no band.** R12 permits ONE bottom region and publish stays in the header it
   already has (141-B, `WorkflowBuilderPage.tsx:1798-1801`). This adds a child to an existing
   flex group and nothing else.

**Why the `canvasEnabled` gate is mandatory, not stylistic.**
`WorkflowBuilderPage.header.test.tsx:305` pins the flag-off `<header>` **byte for byte**,
including `<div class="flex min-w-0 items-center gap-2">` containing exactly two spans. An
unconditional control breaks the v3.6 revert switch — the milestone's hard gate #1 (D-181-01).

**And the gate costs this bug nothing.** The canvas door does not exist with the flag off:
the `[≣ Spine][⬡ Canvas]` strip renders only under `canvasEnabled` (`:1604`) and
`activeGraphView` is pinned to `"spine"` otherwise (`:640`). BUG-260809-02 was reported
against the canvas, which requires the flag ON. So a flag-gated control covers 100% of the
reported surface. *Accepted residual, recorded not hidden:* with the flag OFF the field stays
unreachable — but the two flag-off entry paths (NL generate, starter fork) both populate it
already, which is precisely what the bug report's own live-cloud draft census measured
(BUG-260809-02, "Measured against live cloud").

**G-5 hot-file ledger check — does NOT fire.** `WorkflowBuilderPage.tsx` is not a ledger row.
The two ledger rows on this surface are untouched: `WorkflowCanvas.tsx` (satisfied at 188.1)
and `PhaseFormPanel.tsx` (G-5 honoured by construction at 185) receive **zero** diff.

**Glyph.** Use `✎` — the describe screen's own glyph on this same page
(`WorkflowBuilderPage.tsx:1452`). Explicitly **NOT** `✦`, despite the sketch's `req-star`
(`workflow-authoring.md:409`): `✦` is the shipped Working badge (`WorkingBadge.tsx:44`) and
`icon-convention.md:94-96` refuses it for canvas-adjacent surfaces because it *"sits on the
verdict mark's coordinates."*
</placement_decision>

<baselines>
Measured on this branch (`develop`) before any edit. A pre-existing failure is not this
task's regression; these are the numbers to compare against.

| Check | Command | Baseline |
|---|---|---|
| Blast-radius suites | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run src/pages/WorkflowBuilderPage.header.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/workflows/builderStore.test.ts src/components/workflows/ProblemsTray.test.tsx` | **4 files passed · 242 tests passed · 0 failed** (2026-08-09, 202 s) |
| Typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 \| grep -c "error TS"` | **33** (bare `--noEmit` checks ZERO files — the `-p` flag is load-bearing) |

The 242 decomposes exactly into the count-gate pins, which is the cross-check that the
baseline is real: `WorkflowBuilderPage.canvas.test.tsx` 128 (`vitest-count-gate.cjs:259`) +
`builderStore.test.ts` 52 (`:591`) + `WorkflowBuilderPage.header.test.tsx` 32 (`:817`) +
`ProblemsTray.test.tsx` 30 = 242.

`scripts/vitest-count-gate.cjs` is a count-**decrease** gate (`:229`: *"the count decrease
being the ONLY signal is the point"*), so **adding** tests to pinned files is safe and no pin
needs editing. Do not remove or rename any existing `it(` in these files.
</baselines>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@.planning/reported-bugs/BUG-260809-02-canvas-builder-cannot-set-business-requirement.md
@frontend/src/components/workflows/builderStore.ts
@frontend/src/pages/WorkflowBuilderPage.tsx

<interfaces>
Contracts the executor needs. Extracted from the codebase — no exploration required.

From `frontend/src/components/workflows/builderStore.ts`:
```ts
export type DefinitionMeta = {
  [K in keyof BuilderDefinition as K extends "phases" ? never : K]: BuilderDefinition[K]
}
export interface BuilderStoreState extends TrackedSlice {
  meta: DefinitionMeta
  builderPhase: BuilderPhase          // "empty" | "composing" | "drafted" | "error"
  dirty: boolean
  setProjectFolder: (id: string | null) => void   // THE TEMPLATE — copy its shape
  markSaved: () => void
}
export function selectDefinition(
  state: Pick<BuilderStoreState, "meta" | "phases">,
): BuilderDefinition          // === { ...state.meta, phases: state.phases }
```

`setProjectFolder`'s implementation, verbatim (`builderStore.ts:586-590`) — the shape the new
action mirrors, including WHY it writes `dirty` in the same `set()`:
```ts
setProjectFolder: (id) => {
  const s = get()
  if (s.builderPhase !== "drafted") return
  set({ meta: { ...s.meta, project_folder_id: id }, dirty: true })
},
```

From `frontend/src/pages/WorkflowBuilderPage.tsx`:
```ts
export interface BuilderDefinition {
  slug?: string; version?: number; status?: string
  business_requirement?: string            // :440 — ALREADY DECLARED
  project_folder_id?: string | null
  phases: PhaseSpecJSON[]
  [k: string]: unknown
}
export function useCanvasGate(): boolean                       // :239
export const UNBOUND_KB_INVITATION = "No knowledge base · searches everything"  // :329
const onFieldCommit: () => void                                // :1294 — dirty-gated saveNow
const [hasEdited, setHasEdited] = useState(false)              // :793
```

The KB control's `onChange` body (`:1716-1746`) is the call-site template: it calls the store
action, then `setHasEdited(true)`, and deliberately writes no second copy of the value.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: `setBusinessRequirement` on the builder store</name>
  <files>frontend/src/components/workflows/builderStore.ts, frontend/src/components/workflows/builderStore.test.ts</files>
  <behavior>
    Write these tests FIRST in `builderStore.test.ts` and observe them RED before touching
    `builderStore.ts`. Append them; edit no existing `it(`.

    - Test 1 (the load-bearing one): from a drafted store,
      `setBusinessRequirement("Summarise vendor risk.")` then
      `selectDefinition(store.getState())` returns an object whose `business_requirement`
      is `"Summarise vendor risk."` AND whose `phases` array is REFERENTIALLY UNCHANGED.
      (Phases-unchanged is what proves the write cannot truncate the PATCH body.)
    - Test 2: the same call sets `dirty` to `true` in the same tick — assert `dirty` is
      `false` immediately before and `true` immediately after, with no `markSaved()` between.
    - Test 3: it is UNTRACKED. Capture `store.temporal.getState().pastStates.length`, call
      `setBusinessRequirement` three times, assert the length is unchanged. Positive control
      in the SAME test: a following `addPhaseOfType(...)` DOES grow it — otherwise the
      assertion passes on a store where nothing tracks anything.
    - Test 4: the drafted guard. On a store built with `createBuilderStore(null)`
      (`builderPhase === "empty"`), `setBusinessRequirement("x")` leaves `meta` unchanged
      and `dirty` false.
    - Test 5: empty/whitespace is written THROUGH, not normalised away — `setBusinessRequirement("   ")`
      leaves `meta.business_requirement === "   "`. The server owns the emptiness rule
      (`grounding.py:894` is `not (definition.business_requirement or "").strip()`); a client
      that trimmed or nulled here would be a second copy of a server predicate, which D-182-06
      forbids.
  </behavior>
  <action>
    Add `setBusinessRequirement: (text: string) => void` to `BuilderStoreState`'s action block,
    declared immediately after `setProjectFolder` (`builderStore.ts:267`) so the two
    `meta`-writing siblings read together, and implement it in the factory immediately after
    `setProjectFolder`'s implementation (`:586-590`) as a structural mirror:
    the `builderPhase !== "drafted"` bail, then ONE `set({ meta: { ...s.meta, business_requirement: text }, dirty: true })`.

    Give it a docblock that states the three things a reader will otherwise re-litigate,
    each pointing at its evidence:
      - WHY `dirty` is armed in the same `set()` — same reason `setProjectFolder`'s docblock
        gives (`:558-565`): the dirty subscription (`:662-667`) watches the **`phases`**
        reference only, so a `meta`-only edit would otherwise schedule a save while the leave
        guard and the toolbar both read clean.
      - WHY it is untracked — `partialize` (`:602-606`) narrows the undo stack to `phases`
        plus the two discriminators, and the `meta` field's own docblock (`:183-187`) says an
        undo restores steps, never the workflow's identity. Typing a sentence must not flood
        the undo stack; native field-level undo still works inside the input because the
        `⌘Z` listener yields to `INPUT`/`TEXTAREA` (`WorkflowBuilderPage.tsx:742-744`).
      - WHY no trim/empty-check — see Test 5's reason above.

    This module still names no API client and opens no request (the fence at `:60-62`).
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; GSD_VITEST_MAX_WORKERS=4 npx vitest run src/components/workflows/builderStore.test.ts</automated>
  </verify>
  <done>`builderStore.test.ts` reports 52 + N passed with 0 failed (N = the tests added; the count-gate pin of 52 is a floor, not a ceiling). All five behaviours were observed RED before the implementation landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: the header requirement control, and the behaviour that it reaches the save payload</name>
  <files>frontend/src/pages/WorkflowBuilderPage.tsx, frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx</files>
  <behavior>
    Write these in `WorkflowBuilderPage.canvas.test.tsx` FIRST (it is the suite that already
    mocks the write path — `mockCreate` / `mockUpdate` at `:70-71`) and observe RED. Append;
    edit no existing `it(`.

    - Test 1 — **THE BEHAVIOUR GUARD, and the one this task exists for.** Flag ON, drafted
      Builder on a definition whose `business_requirement` is absent. Type into
      `builder-business-requirement`, let the autosave debounce elapse, and assert the
      argument actually handed to `updateWorkflowDraft` carries
      `business_requirement === <typed text>` **and** a `phases` array of the original
      length. Assert against the recorded call argument, never against a DOM value — a
      controlled input echoing its own prop proves nothing about the payload.
    - Test 2 — the reload round trip. Mount a fresh Builder with
      `initial.definition.business_requirement` set, and assert the control renders that
      value. This is what proves the field survives a reload, since Open seeds the store
      through the same `{ phases, ...initialMeta }` destructure.
    - Test 3 — the verdict clears and Publish un-blocks. With `/validate` stubbed to return
      `ok:false` + the single verdict `{code:"business_requirement", phase:null, severity:"incomplete", message:"a workflow must declare exactly one business_requirement before publish"}`,
      `publish-blocked-reason` reads that message VERBATIM and `publish-trigger` is disabled;
      after the stub flips to `ok:true` (the server's answer, not the client's), the blocked
      reason is gone. NO client-side rule may be added to make this pass — assert only that
      the server's answer is relayed.
    - Test 4 — the flag-OFF negative, with its positive control. With the flag OFF,
      `queryByTestId("builder-business-requirement")` is null; flag ON, it is present.
    - Test 5 — `hasEdited` is flipped by typing: after the first keystroke a `/validate`
      request is issued on a Builder that had issued none. (Guards the same call-site flip
      the KB picker makes at `:1732` — without it, a fresh Open + one requirement edit would
      leave the loop silent.)

    ⚠ `WorkflowBuilderPage.header.test.tsx` gets **NO edit**. Its byte-for-byte pin
    (`:302-306`) passing UNCHANGED is the evidence D-181-01 held. If it reds, the gate is
    wrong — fix the gate, never the pin.
  </behavior>
  <action>
    In `WorkflowBuilderPage.tsx`:

    1. Export a named placeholder constant beside `UNBOUND_KB_INVITATION` (`:329`), with a
       docblock in that constant's own shape. Suggested text:
       `export const REQUIREMENT_INVITATION = "What must this workflow deliver? · required to publish"`.
       Its docblock MUST carry the same fence `UNBOUND_KB_INVITATION`'s does (`:322-328`):
       this string is an INVITATION about configuration, never a verdict — it may never join
       `blockedReason`, never become a `Verdict`, never enter `verdicts` or `groupVerdicts`,
       never add a tray row and never mark a node. The server already owns this verdict
       (`workflows.py:712-721`) and its message is what `blockedReason` relays verbatim.

    2. Build `requirementAffordance`, gated exactly as `kbAffordance` is
       (`canvasEnabled ? … : null` — note the flag-OFF branch here is a plain `null`, with no
       display-only fallback, because the flag-off header currently shows nothing about the
       purpose and the byte pin at `:305` requires it keep showing nothing):
       - a chip span, `data-testid="builder-business-requirement"`, styled as `kbAffordance`'s
         wrapper (`:1707-1710`) so the two siblings read as one row;
       - `<span aria-hidden="true">✎</span>` (NOT `✦` — see the placement section);
       - a CONTROLLED `<input type="text">`, `data-testid="business-requirement-input"`,
         `aria-label="Business requirement — the one line this workflow must satisfy"`,
         `placeholder={REQUIREMENT_INVITATION}`,
         `value={typeof meta.business_requirement === "string" ? meta.business_requirement : ""}`,
         and Tailwind mirroring the KB select's `min-w-0 truncate bg-transparent … focus:ring-1 focus:ring-primary`
         with a wider cap (a sentence, not a folder name — `w-[240px]` is a reasonable
         starting width; the header already wraps via `BuilderHeaderBar.tsx:47`'s `flex-wrap`,
         so a narrow window drops it to a second line instead of squeezing the flow).
       - `onChange` does exactly two things, mirroring the KB call site (`:1716-1746`):
         `store.getState().setBusinessRequirement(e.target.value)` and `setHasEdited(true)`.
         Add the same call-site comment the KB picker carries for why `hasEdited` is flipped
         HERE rather than by widening the store subscription.
       - `onBlur={onFieldCommit}` — the dirty-gated commit that already exists at `:1294`.
         Do NOT write a second save path; do NOT call `persistence.saveNow()` directly.
       - **Value ownership:** the definition is the single source of truth. Keep no page-level
         `useState` mirror of this text. A second copy is the drift D-14 forbids, and it is
         the reason `boundFolderId` (`:1183-1188`) reads `meta` in the drafted view.

    3. Mount it in `identityGroup` (`:1771-1781`) as the last child, after `{kbAffordance}`.

    4. Add a docblock above `requirementAffordance` recording: that this closes
       BUG-260809-02; that it is the D-186-15 shape applied a second time and why (the
       placement section above, compressed); that the flag gate is what preserves the
       `:305` byte pin; and the accepted residual that the flag-off surface keeps the hole,
       which costs nothing because the canvas door does not exist with the flag off
       (`:604`, `:640`).

    Nothing in `WorkflowCanvas.tsx`, `PhaseFormPanel.tsx`, `useDraftPersistence.ts` or any
    backend file is opened. The write path is unchanged — `selectDefinition` spreads `meta`,
    so the field is already in the PATCH body the moment the store holds it.

    **XSS:** the value is authored text rendered only as a React `value` prop and, elsewhere,
    as a plain text child (`WorkflowSoul.tsx:60-71`, whose T-124-01 note already covers this).
    Never introduce `dangerouslySetInnerHTML`.
  </action>
  <verify>
    <automated>cd frontend &amp;&amp; GSD_VITEST_MAX_WORKERS=4 npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx src/pages/WorkflowBuilderPage.header.test.tsx src/pages/WorkflowBuilderPage.session.test.tsx src/pages/WorkflowBuilderPage.test.tsx src/components/workflows/builderStore.test.ts src/components/workflows/ProblemsTray.test.tsx</automated>
  </verify>
  <done>All six suites pass with 0 failed; `WorkflowBuilderPage.header.test.tsx` still reports 32 and its file was never edited; `npx tsc --noEmit -p tsconfig.app.json` still reports 33 errors (not 34).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| author → `meta.business_requirement` → PATCH body | free-text authored by the user crosses into a stored definition |
| stored `business_requirement` → judge rubric prompt | the stored text is woven into an LLM prompt at publish |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-klo-01 | Tampering (XSS) | the authored text wherever it renders | mitigate | Rendered only as a React `value` prop here, and as a plain auto-escaped text child at `WorkflowSoul.tsx:65-71`. No `dangerouslySetInnerHTML` is introduced; the T-124-01 note already fences that surface. |
| T-klo-02 | Elevation (prompt injection) | `publish_service.py:969` / `validator_kinds.py:554` weave the text into the judge rubric | accept | **Pre-existing and unchanged by this task** — the NL door (`WorkflowDoorSwitch.tsx:138`) and the seeded starters already populate this exact field through the exact same path. This adds a third writer of an existing field, not a new sink. Not this task's to fix; a cap or sanitiser here would diverge from the two shipped writers. |
| T-klo-03 | Information disclosure | the control leaking onto the flag-off surface | mitigate | The `canvasEnabled` gate, proven by `WorkflowBuilderPage.header.test.tsx:302-306`'s byte-for-byte pin passing UNEDITED, plus Task 2's Test 4 negative with its positive control. |
| T-klo-SC | Tampering | package installs | n/a | This task installs nothing — `files_modified` is four existing frontend files. |
</threat_model>

<verification>
1. `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run src/pages/WorkflowBuilderPage.header.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/workflows/builderStore.test.ts src/components/workflows/ProblemsTray.test.tsx`
   → **0 failed**, total ≥ 242 (baseline 242; the delta is exactly the tests added).
2. `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → **33** (unmoved).
3. `git diff --stat` names **exactly four** files. Any diff to `WorkflowCanvas.tsx`,
   `PhaseFormPanel.tsx`, `WorkflowBuilderPage.header.test.tsx`, `useDraftPersistence.ts` or
   anything under `backend/` is a scope breach — revert it.
4. `git diff frontend/src/pages/WorkflowBuilderPage.tsx | grep -c "dangerouslySetInnerHTML"` → **0**.
5. Manual, one pass on the live local app (`http://localhost:5173/`, `visual_workflow_canvas` ON):
   build a workflow from scratch on the canvas → type a requirement in the header →
   confirm the header reads `Saved · still a draft` → reload the page → the requirement is
   still there → `◆ Publish…` is no longer blocked on stage 1 ("Goal").
   This is the lived-experience row (G-4) and it is the one the bug was reported from.
</verification>

<success_criteria>
- A from-scratch canvas workflow can be given a `business_requirement` and reaches publish
  stage 2 — the exact path BUG-260809-02 says is impossible.
- The value is in the PATCH payload, proven by an assertion on the recorded
  `updateWorkflowDraft` argument, not by a DOM read.
- The flag-off header byte pin passes with its file unedited.
- No client-side validation rule was added; the server still owns every verdict (D-182-06).
- The bug report's frontmatter is updated: `status: closed`, `verified_closed_by: 260809-klo`.
</success_criteria>

<deferred>
## D-klo-DEF-01 — the blocking copy names an internal field

**Not folded in — it is a BACKEND change, and the constraint caps this task at a ≤ 10-line
frontend string fix.** Measured:

The sentence *"a workflow must declare exactly one business_requirement before publish"* is
authored in **two backend sites** — `backend/app/api/workflows.py:718` (the `/validate` seam)
and `backend/app/services/harness/publish_service.py:166-168` (`named_failures`, publish stage 1).
It reaches the UI **verbatim by design**: `blockedReason`'s own docblock
(`WorkflowBuilderPage.tsx:1120-1122`) says *"the FIRST verdict's `message`, VERBATIM … The
message is never rewritten and never mapped."* So the frontend has no legitimate one-line fix
— rewriting it there would install exactly the client-side message mapping D-182-06 forbids,
and would desynchronise `/validate`'s wording from the gauntlet's.

A correct fix edits both backend strings plus their assertions
(`PublishGauntlet.test.tsx:239` pins the `named_failures` text, and
`backend/tests/` pins the publish stage-1 prose), and must keep the two in lockstep. That is
a backend task, not this one.

**Re-open trigger:** the next phase that touches `publish_service.py`'s stage table OR
`workflows.py`'s `_ROUTE_ASSIGNED_CODES` block changes both strings in the same commit to
say what to do rather than name the field — e.g. *"this workflow still needs a one-line
description of what it must deliver."* If no such phase appears by the close of the
connections milestone, raise it as its own `/gsd:fast`.

**Why deferring is safe now:** with Task 2 landed, the author reading that sentence has the
control in the header directly above the Publish button they just pressed. The copy is
unhelpful; it is no longer a dead end.

## D-klo-DEF-02 — the other definition-level fields the bug report asks about

BUG-260809-02's routing note asks whether `project_folder_id`, `inputs`, `assets` and
`category` are similarly unreachable from the canvas. Measured for the first one only:
`project_folder_id` **is** reachable (D-186-15, `WorkflowBuilderPage.tsx:1706-1758`).
`inputs` / `assets` / `category` were **not** measured by this task and are out of scope.

**Re-open trigger:** the first workflow-authoring phase after this one runs the same
`grep -rn "<field>" frontend/src` filtered to `value=|onChange` for each of the three, and
either produces a control or records a measured reason it is not needed. Do not inherit this
paragraph as a finding — re-derive it.
</deferred>

<output>
On completion write `.planning/quick/260809-klo-fix-bug-260809-02-add-a-business-require/260809-klo-SUMMARY.md`
and update `.planning/reported-bugs/BUG-260809-02-canvas-builder-cannot-set-business-requirement.md`
frontmatter (`status: closed`, `verified_closed_by: 260809-klo`) — but only after verification
step 5 (the live reload + publish check) actually ran. A bug closed on a green unit suite
alone is the failure mode this project has recorded four times.
</output>
</content>
</invoke>
