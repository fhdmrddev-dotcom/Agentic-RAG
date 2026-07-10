---
phase: 124-workflow-studio-ux-soul-strict-loose
reviewed: 2026-06-26T21:26:07Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - frontend/src/components/workflows/soulData.ts
  - frontend/src/components/workflows/WorkflowSoul.tsx
  - frontend/src/components/workflows/PhaseSpine.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/components/workflows/soulData.test.ts
  - frontend/src/components/workflows/WorkflowSoul.test.tsx
  - frontend/src/components/workflows/PhaseSpine.test.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
  - frontend/src/pages/WorkflowsPage.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
  - frontend/src/components/workflows/PublishGauntlet.test.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 124: Code Review Report

**Reviewed:** 2026-06-26T21:26:07Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 124 is a pure-frontend re-skin that introduces a shared "workflow soul"
presentation layer (`soulData.ts` + `WorkflowSoul.tsx` + `PhaseSpine.tsx`) at three
scales (card / run / pub), and the strict↔loose "two doors" authoring entry
(`WorkflowDoorSwitch.tsx`). The invariants the orchestrator flagged hold well:

- **XSS:** verified clean. Every user/LLM-authored string (`business_requirement`,
  phase names, input keys, deliverable label) renders as an escaped React text child.
  No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval` anywhere in the changed
  files (only comments asserting their absence).
- **Single shared tier derivation:** verified. `tierForDefinition` was extracted
  VERBATIM from the old page-private `WorkflowsPage` helpers (confirmed against the
  pre-phase git blob); all three soul sizes consume the one `soulData` copy. No
  divergent re-derivation. The TIER CONSISTENCY test pins card/run/pub equality.
- **G-5 red line:** verified. `git diff` confirms `PhaseTimeline.tsx` and
  `PhaseCard.tsx` are NOT in the change set; the run-surface soul is an additive
  sibling gated to `showTimeline`, and `WorkspacePanel` never threads a soul atom
  into the live timeline (source-grep test guards this).

The headline defect is not in the soul layer but in the wiring of the new two-door
shell: the "Describe & run" (loose) door's primary CTA is a dead-end at its only
production call site, dropping the user's typed business requirement on the floor.
The 30 changed-file tests all pass, but none exercise the WorkflowsPage→DoorSwitch
describe-draft integration — so the gap is green at the unit level. This is exactly
the lived-experience UAT gap the project's G-4 guardrail warns about.

## Critical Issues

### CR-01: The loose "Describe & run" door is a dead-end — the user's typed requirement is silently dropped

**File:** `frontend/src/pages/WorkflowsPage.tsx:238-249` (call site) · `frontend/src/components/workflows/WorkflowDoorSwitch.tsx:146-152` (handler)

**Issue:**
`WorkflowDoorSwitch` exposes an `onDescribeDraft?` prop and invokes it
optional-chained when the describe-box CTA is clicked:

```tsx
// WorkflowDoorSwitch.tsx:146-152
onClick={() => {
  onDescribeDraft?.(describe)   // <-- no-op when the prop is undefined
  setDoor("govern")
}}
```

But the ONLY production mount of `WorkflowDoorSwitch` — in `WorkflowsPage.tsx:238`
— never passes an `onDescribeDraft` handler (`grep onDescribeDraft WorkflowsPage.tsx`
returns nothing). So the real-app flow is:

1. User picks "Describe & run", types their business requirement into `describe-box`.
2. Clicks "Draft the workflow" → `onDescribeDraft?.(describe)` is a no-op (prop
   undefined) → `setDoor("govern")` mounts a FRESH `WorkflowBuilderPage` (no
   `initial`), which boots to its own EMPTY describe screen.
3. The text the user just typed is gone; they must retype it in the Builder.

This breaks the headline two-doors feature and the locked decision D-05 ("nothing
lost by picking the fast path"). The 124-02-PLAN.md Task 2 `<action>` explicitly
required wiring this handler into WorkflowsPage ("wire it into `WorkflowsPage.tsx`
… an `onDescribeDraft` handler (the describe-CTA → draft action)"); the component
prop was added but the page never supplied the handler.

The `WorkflowDoorSwitch.test.tsx:111-122` test passes ONLY because it injects its
own `onDescribeDraft={onDescribeDraft}` mock — it proves the component contract in
isolation while the integration gap goes uncovered. No WorkflowsPage test drives
the describe-door CTA, so the suite is green on a non-functional door.

**Fix:** Pass a handler from `WorkflowsPage` that forwards the describe text into
the existing draft/generate path so it survives the door switch. Minimal honest
wiring — seed the Builder's describe box (or kick off generate) with the text:

```tsx
// WorkflowsPage.tsx — pass the describe text through to the Builder/generate path
<WorkflowDoorSwitch
  def={builderInitial?.definition as DefShape | undefined}
  initialDoor={builderInitial ? "govern" : "both"}
  initial={/* ...unchanged... */}
  onDescribeDraft={(describe) => {
    // forward to the EXISTING draft/generate path so the typed requirement is
    // not lost when the loose door hands off to the govern door
    setBuilderInitial(/* seed a fresh-build initial carrying the describe text */)
    // or call the generate/draft seam the Builder's empty screen already owns
  }}
  renderPublish={/* ...unchanged... */}
/>
```

If full generate-on-describe is genuinely out of scope for 124, the loose door must
not present a "Draft the workflow" button that silently discards input — either
deep-link the text into the Builder's textarea or remove the dead CTA until the
sink exists. Shipping a primary CTA that drops user input is a data-loss defect.

## Warnings

### WR-01: The describe-door soul preview can never reflect a fresh build's typed input

**File:** `frontend/src/components/workflows/WorkflowDoorSwitch.tsx:181-187` · `frontend/src/pages/WorkflowsPage.tsx:240`

**Issue:** The describe door renders `<WorkflowSoul def={def} scale="card" />` under
a "This workflow's soul" heading (D-05 frames it as "the soul PREVIEW of the current
draft/definition"). For a FRESH build, `WorkflowsPage` passes
`def={builderInitial?.definition}` which is `undefined` (builderInitial is null), so
the preview is permanently stuck on the honest empty-states ("draft · purpose not
declared yet" / "produces: answer in chat") even as the user types a full
description into the adjacent box. The preview never live-updates from the
`describe` textarea. Combined with CR-01, the entire describe door is decorative for
the fresh-build case — it shows an empty soul and then throws the text away.

**Fix:** Derive a live preview `def` from the in-progress `describe` text (e.g.
`{ business_requirement: describe }`) so the soul preview reflects what the user is
typing, or drop the "current draft/definition" framing for the fresh-build state so
the preview isn't promising a reflection it can't deliver.

### WR-02: Duplicate input keys produce duplicate React keys in the needs list

**File:** `frontend/src/components/workflows/WorkflowSoul.tsx:77-82`

**Issue:** The needs atom maps over `needs` (the resolved `input_keys`) using the
key string itself as the React `key`:

```tsx
needs.map((k, i) => (
  <span key={k}>  // <-- collides if input_keys contains duplicates
```

`input_keys` comes from user/LLM-authored definition JSONB, which can contain
duplicate keys (the resolver in `soulData.entryInputKeys` does not de-duplicate).
Duplicate React keys trigger a console warning and can cause reconciliation glitches
on re-render. The PhaseSpine has the same pattern but guards it with `?? i`
(`key={p.slug ?? i}`); the needs list has no index fallback.

**Fix:** Use a positional key (`key={`${k}-${i}`}` or `key={i}`) since the list is
static per-render and order-stable, or de-duplicate in `entryInputKeys`.

### WR-03: RunSoul re-fetches the full published list on every harness-thread view (no cache, no slug filter)

**File:** `frontend/src/components/panel/WorkspacePanel.tsx:103-138`

**Issue:** `RunSoul` calls `getThreadWorkflow` then `listPublishedWorkflows(undefined,
…)` on every `threadId` change for any harness run, and discards all rows except the
one matching `frame.definition_slug`. This refetches the entire owner-scoped
published catalog purely to recover one definition the library page already loaded.
On accounts with many published workflows this is a redundant full-list round trip
per panel mount / thread switch. (Performance is out of v1 scope, but this is also a
correctness fragility: the soul shows nothing until BOTH sequential fetches resolve,
and a slow list fetch leaves the "This workflow" section blank with no loading
affordance.) The honest empty-state fallback masks transient failures, which can
read as "draft · purpose not declared yet" for a fully-published workflow during the
fetch window.

**Fix:** Prefer a by-slug/by-id lookup if the API offers one, or render a brief
loading state instead of the empty-state during the in-flight window so a published
workflow isn't momentarily presented as an undeclared draft. At minimum, document
that the empty-state is reached on both "no match" and "fetch pending".

### WR-04: `definition_name` from the run frame is available but unused — RunSoul ignores a cheaper source

**File:** `frontend/src/components/panel/WorkspacePanel.tsx:117-127`

**Issue:** `getThreadWorkflow` returns a `ThreadWorkflowState` that already carries
`definition_name` (and `definition_slug`), as the test fixture in
`WorkspacePanel.test.tsx:204` shows. `RunSoul` uses only `definition_slug` to do a
second full-list fetch, then derives the soul from `match?.definition`. If the
published-list fetch fails or the slug no longer matches (a since-unpublished or
renamed workflow), the soul collapses entirely to the empty-state even though the
run frame already knew the workflow's name. This is a missed graceful-degradation
opportunity: the run header could at least show the real workflow identity from the
frame instead of "draft · purpose not declared yet".

**Fix:** Fall back to a minimal `def` built from the run frame's
`definition_name` when the published match is absent, so a live harness run never
renders its own workflow as an undeclared draft.

## Info

### IN-01: `RunSoul` is defined inline in WorkspacePanel rather than extracted

**File:** `frontend/src/components/panel/WorkspacePanel.tsx:103-145`

**Issue:** `RunSoul` (a ~45-line component with its own effect, AbortController, and
two-step async fetch) lives inside `WorkspacePanel.tsx`, a file already noted in the
project hot-file ledger. Extracting it to its own module (`RunSoul.tsx`) would keep
the panel file focused and make the by-id read independently testable. Not a defect
— just a maintainability nudge on a hot file.

**Fix:** Extract `RunSoul` and its `useEffect` into `components/panel/RunSoul.tsx`.

### IN-02: The pub-scale soul label "{name} · file" is a soft honesty claim

**File:** `frontend/src/components/workflows/soulData.ts:132-134`

**Issue:** `soulDeliverable` builds `${name} · file` when a terminal `llm_emit` phase
exists. The comment correctly notes the emitter does not expose a guaranteed static
deliverable name, and the test deliberately does not hard-assert the exact string
(A1 — confirmed at UAT). This is acceptable per the locked decision, but the "· file"
suffix asserts a file output for ANY workflow with an `llm_emit` phase even though an
emit phase's actual artifact type isn't read here. The label is honest-enough (it
says "file") but not derived from the real output spec. Flagging for the UAT
confirmation the code comment defers to — verify the label against sketch 046-A.

**Fix:** None required if UAT confirms the label matches 046-A; otherwise derive the
suffix from the emit phase's real output kind.

### IN-03: PhaseSpine's index-digit-stripping test is coupled to fixture size

**File:** `frontend/src/components/workflows/PhaseSpine.test.tsx:61`

**Issue:** The "STRIPS phase-index numbers" test asserts `text` does not match
`/\b[0-3]\b/` — a regex scoped to the specific 4-phase fixture. A future fixture with
5+ phases, or a phase name containing a digit (e.g. "Q3 review", "Phase 2 audit"),
would make this assertion either miss a regression or false-fail. It tests the
fixture, not the invariant.

**Fix:** Assert on the absence of the rendered index more directly — e.g. confirm no
`data-phase-index` attribute and that `spine-dot-*` text content equals only the
glyph — rather than a digit-character blacklist over the whole subtree.

---

_Reviewed: 2026-06-26T21:26:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
