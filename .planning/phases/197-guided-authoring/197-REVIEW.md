---
phase: 197-guided-authoring
reviewed: 2026-08-18T11:00:04Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/components/workflows/DraftArrivalCard.tsx
  - frontend/src/components/workflows/DecisionsList.tsx
  - frontend/src/components/workflows/decisionsVocabulary.ts
  - frontend/src/components/workflows/builderStore.ts
  - frontend/src/components/workflows/soulData.ts
  - frontend/src/components/workflows/useTemplateFirstDraft.ts
  - frontend/src/lib/api.ts
  - backend/app/services/workflow_authoring.py
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
  - frontend/src/components/workflows/DraftArrivalCard.test.tsx
  - frontend/src/components/workflows/DecisionsList.test.tsx
  - frontend/src/components/workflows/decisionsVocabulary.test.ts
  - frontend/src/components/workflows/soulData.test.ts
  - frontend/src/components/workflows/builderStore.test.ts
  - frontend/src/components/workflows/useTemplateFirstDraft.test.tsx
  - backend/tests/unit/test_workflow_authoring_requirement.py
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
status: issues_found
---

# Phase 197: Code Review Report

**Reviewed:** 2026-08-18T11:00:04Z
**Depth:** standard
**Files Reviewed:** 18 — 9 source, 9 test (diffed against `52e6bcdb`)
**Status:** issues_found

## Summary

The phase's own headline risk — **snapshot vs live conflation** — was hunted first and hardest,
and the structural half of it is genuinely well built. `receiptPhases` and `readiness` are page
state written in exactly one place; `grep -Ec "s\.readiness"` really is 0; the `decisions` memo
really is recomputed from `meta` on every render with no mirror; `undefined` really does travel
end-to-end with no `?? {}` anywhere on the hop (verified in `api.ts`, `useTemplateFirstDraft.ts`,
`WorkflowBuilderPage.tsx` and `DecisionsList.tsx` independently). The hook-order hazard called
out in the brief is clean: every hook this phase adds (`useRef` ×2, `useCallback` ×3, `useMemo`
×1, `useState` ×1) sits at lines 769–1770, well above the pre-draft early return at `:1900`.
`slug` is never written — `setName` touches exactly one `meta` key and `builderStore.test.ts`
asserts that over `selectDefinition()`'s output (the PATCH body), not over `meta`. The backend
readiness derivation imports the one shipped predicate and leaks nothing: one status token plus
one fixed server constant, on the success path only.

The test suites are, by this project's standards, unusually honest. I looked specifically for the
Phase 192.1 failure class — fences that sweep an empty set, regexes that return `""` under a
`not.toContain`, positive controls that do not control — and did not find one. Every negative
fence in `DecisionsList.test.tsx`, `DraftArrivalCard.test.tsx` and `decisionsVocabulary.test.ts`
carries a live positive control in the same block, several of which plant the *exact* failure
shape (the affirmative detector's word-boundary bug is kept as a live assertion; the suppression
sweep proves it can see a content handle; `addedKeys` is proved against a planted stray key). No
test finding is raised, and that is a measurement, not a courtesy.

**What the phase did not close is the other direction of the same conflation it fenced.** The
readiness verdict is correctly held as a snapshot, but it is rendered as a present-tense
instruction directly beneath a **live** answer, and nothing recomputes or retires it when the
author answers that row — which is the one interaction the card exists to invite. That is CR-01
below, and it is reproducible in three clicks. A second, smaller defect follows from the phase's
new ability to clear the workflow name (WR-01).

---

## Critical Issues

### CR-01: The readiness verdict goes stale the moment the author answers row 3 — a snapshot rendered as a present-tense instruction beside a live answer

**File:** `frontend/src/components/workflows/DecisionsList.tsx:180-184`, rendered at `:245-251`
**Also:** `frontend/src/pages/WorkflowBuilderPage.tsx:797` (state), `:886` (the only write)

**Issue:**

`requirementVerdict` is a pure function of the `readiness` prop and of nothing else:

```tsx
const requirementVerdict =
  readiness !== undefined && readiness.business_requirement.status === "missing"
    ? readiness.business_requirement.message
    : null
```

`readiness` is page state assigned in exactly one place — the `onDrafted` handler
(`WorkflowBuilderPage.tsx:886`). Nothing clears it, nothing recomputes it, and no live value
participates in the expression. Meanwhile the answer rendered immediately **above** it in the same
`<li>` (`decisions.businessRequirement`, `WorkflowBuilderPage.tsx:1749-1750`) is read live off
`meta.business_requirement` and follows the header input in the same beat — which is pinned by
`canvas.test.tsx`'s *"⭐ LIVE — row 3's answer follows the header's requirement input immediately"*.

So the two halves of one row are wired to two different clocks. The sentence the snapshot half
renders is not past-tense; it is the gate's imperative, verbatim
(`grounding.py:1001-1004`): *"Add the Business requirement — one line saying what this workflow
must deliver — before publishing."* That is a claim about **now**, backed by a value about
**then**. The phase's own charter names this exact hazard from the other side
(`SeedReceipt.tsx:147-172`); this is the mirror of it.

**Concrete failure scenario (reproducible, no fixtures required):**

1. Generate a draft from a description whose emit does not carry a `business_requirement`. The
   server answers `readiness.business_requirement = {status: "missing", message: …}` and the card's
   row 3 shows the absence sentence plus the gate's verdict. Correct so far.
2. The author clicks row 3's own **Change** action. The seam focuses
   `business-requirement-input` — this is the card's advertised purpose, *"each answerable in
   place"*.
3. The author types a requirement. `meta.business_requirement` updates, row 3's **answer** updates
   in the same beat, `useLiveValidation` re-runs, and the Publish control's `blockedReason`
   **un-blocks** (pinned by `canvas.test.tsx:3449`, *"the SERVER's requirement verdict … un-blocks
   on the SERVER's answer"*).
4. **Row 3 now reads:** answer = *"Produce a board-ready renewal brief every Monday."*, verdict =
   *"Add the Business requirement … before publishing."* — on one row, on one screen, with the
   Publish button beside it saying the opposite.

That is two different answers to one question on one screen, which is the drift this page's own
rule at `WorkflowBuilderPage.tsx:2085` forbids by name, and it is a **false statement rendered to
the user**: the publish gauntlet will not refuse this draft.

**The inverse arm is reachable too, and is the more dangerous one.** Generation returns
`{status: "present"}` → no verdict node. The author then *clears* the requirement (row 3's answer
flips to `DECISION_REQUIREMENT_NONE`, *"No requirement was written for this workflow."*). The
verdict stays absent — so the card renders "there is no requirement" and says nothing at all about
the gate that is now going to refuse the publish. Absence-is-not-a-pass was fenced on the **wire**
(three cases, correctly) and left unfenced on the **edit**.

**Why no test caught it:** the LIVE fence and the three verdict arms are disjoint. Every verdict
case uses `draftAndArrive()` and asserts before any edit; the LIVE row-3 case runs on the default
mock, which carries no `readiness` key at all, so the verdict node is `null` in both readings and
the staleness is invisible.

**Fix (either is sound; the second is the smaller diff):**

*(a) Read the live verdict that already exists.* `useLiveValidation` already re-derives the same
server predicate on every definition change and already relays its message verbatim through
`blockedReason`. Deriving the row's verdict from that, and keeping `readiness` only as the
arrival-instant seed, gives the row one clock:

```tsx
// WorkflowBuilderPage.tsx — one answer per question, and it is the LIVE one
readiness:
  typeof meta.business_requirement === "string" && meta.business_requirement.trim() !== ""
    ? undefined            // the premise the snapshot was taken under no longer holds
    : readiness,
```

*(b) Retire the snapshot when its premise dies.* Minimal, local to the leaf, and keeps the wire
contract untouched:

```tsx
// DecisionsList.tsx
// The verdict is a SNAPSHOT of one generation; the requirement beside it is LIVE. Render the
// snapshot only while the definition still matches the premise the server judged, otherwise the
// row narrates a state the author has already left.
const verdictStillApplies = businessRequirement.trim() === ""
const requirementVerdict =
  verdictStillApplies &&
  readiness !== undefined &&
  readiness.business_requirement.status === "missing"
    ? readiness.business_requirement.message
    : null
```

Whichever is taken, add the two cases the fences are missing: *after* a live edit that supplies a
requirement, `decision-verdict-requirement` must be gone; and (option (a) only) after a live edit
that clears one, it must appear.

---

## Warnings

### WR-01: Clearing the workflow name persists `name: ""`, which the shipped library surfaces render as a blank title — and no server rule refuses it

**File:** `frontend/src/components/workflows/builderStore.ts:823-827` (the write),
`frontend/src/components/workflows/DecisionsList.tsx:255-268` (the field),
`frontend/src/pages/WorkflowBuilderPage.tsx:2426-2427` (the display fallback that hides it)

**Issue:**

Row 4 forwards the raw value with no trim and no empty check, `setName` writes it through, and
`builderStore.test.ts` pins that deliberately (*"forwards an EMPTY value rather than swallowing
it"*, *"writes whitespace and the empty string THROUGH"*). The stated justification, repeated in
three docblocks, is *"the server owns emptiness (`grounding.py`)"*. **That justification is
verifiably wrong for this field.** `grounding.py`'s emptiness rule is
`business_requirement_missing` and applies to the requirement only. Nothing anywhere refuses an
empty workflow **name**:

- `WorkflowDefinition.name` is a bare `str` (`backend/app/models/harness.py:522`) — no
  `min_length`, no validator, so `""` validates.
- `publish_service.py` never reads `definition.name` except to title a golden run (`:971`).
  `_clean_label` (`:628`) is for `PhaseSpec.name`, a different field.
- `update_workflow_definition` writes `SET name = $3` from `definition.name`
  (`backend/app/db/workflows.py:764`, `:776`), so the empty string lands in the
  `workflow_definitions.name` **column** on the very next autosave (~1 s; `dirty` is armed in the
  same `set()`).

The Builder header then masks the damage by design: `identityLabel`'s non-empty check falls back
to the slug, so the author sees `vendor-brief` and nothing tells them the workflow now has no
name. `setName` is untracked, so `⌘Z` cannot bring it back either.

**Concrete failure scenario:**

1. Author selects the name in row 4 and presses Backspace. Autosave PATCHes `name: ""`.
2. Builder header shows the slug (fallback), so nothing looks wrong.
3. Author navigates to Workflows. `WorkflowCard.tsx:592` renders `{row.name}` with **no fallback**
   → the card's title is empty.
4. Re-opening the draft: `WorkflowsPage.tsx:574` builds the breadcrumb as
   `` `Edit · ${draft.name ?? draft.slug} v${draft.version}` `` — `??` does not catch `""`, so the
   breadcrumb reads `Edit ·  v1`.

The author now has an unidentifiable row in the library and no indication of what they did.

**Fix.** Do *not* add a client-side trim in `setName` — that would be the second copy of a server
predicate the store correctly refuses. Apply the same **display fallback** pattern
`identityLabel` already establishes on the Builder page, at the two render sites that lack it:

```tsx
// WorkflowCard.tsx:592
<span className={NAME_CLASSES}>{row.name?.trim() ? row.name : row.slug}</span>

// WorkflowsPage.tsx:574
label: `Edit · ${draft.name?.trim() ? draft.name : draft.slug} v${draft.version}`,
```

And correct the three docblocks that assert *"the server owns emptiness"* for the name — the
honest statement is that **nothing** owns emptiness for this field, and that is an accepted cost,
not a delegation.

---

## Info

### IN-01: `readiness.business_requirement` is read without a guard — the one unguarded member access in a file built on defensive ladders

**File:** `frontend/src/components/workflows/DecisionsList.tsx:181-182`

**Issue:** `readiness !== undefined && readiness.business_requirement.status === "missing"` guards
the whole object but not its member. A response where `readiness` is present and
`business_requirement` is absent — a future gauntlet refactor that renames or splits the key, or a
partial payload from a gateway — throws `TypeError: Cannot read properties of undefined (reading
'status')` inside render. There is no error boundary on this subtree, so the Builder page unmounts
on a drafted workflow the author has unsaved edits in. The wire type forbids the shape, but
`generateWorkflow` is a bare `as GenerateResult` cast (`api.ts:4166`) — nothing validates it at
runtime. This is inconsistent with the same subtree's own posture: `terminalEmitSlug` and
`templateAdmission` both carry explicit arm-per-reason ladders for exactly this class of wire
silence.

**Fix:**

```tsx
const requirementVerdict =
  readiness?.business_requirement?.status === "missing"
    ? readiness.business_requirement.message
    : null
```

Note this is *not* a `?? {}` default and does not collapse the three arms — absent object, absent
member and `present` all still resolve to `null` and render identically, which is the property the
suite already pins.

### IN-02: `aria-controls` on both fold buttons points at ids that do not exist while collapsed

**File:** `frontend/src/components/workflows/DraftArrivalCard.tsx:259` and `:302`

**Issue:** `aria-controls={groundingBodyId}` / `{decisionsBodyId}` are rendered unconditionally,
but the elements carrying those ids (`:277`, `:320`) are mounted only when the corresponding fold
is open. In the arrival state — both folds closed, which is the card's default and the state most
authors will meet it in — both buttons reference non-existent ids. Screen readers that resolve
`aria-controls` (NVDA/JAWS in browse mode) report a dangling reference or announce nothing for the
relationship; the ARIA APG disclosure pattern expects the controlled element to exist.
`aria-expanded` carries the state correctly, so the failure is degraded announcement rather than
lost function.

**Fix:** either render the body always and hide it (`hidden` attribute), or drop `aria-controls`
and rely on `aria-expanded` plus DOM adjacency, which is the APG-sanctioned fallback:

```tsx
aria-expanded={groundingOpen}
{...(groundingOpen ? { "aria-controls": groundingBodyId } : {})}
```

### IN-03: `nameFieldId` is generated and assigned but never referenced

**File:** `frontend/src/components/workflows/DecisionsList.tsx:170`, consumed only at `:258`

**Issue:** `const nameFieldId = useId()` exists to associate a control with a label, but the row's
accessible name comes from `aria-label={DECISION_NAME_FIELD_LABEL}` and no `<label htmlFor>` or
`aria-labelledby` anywhere references the id. The hook call and the `id` attribute are dead weight
— harmless at runtime, but a later reader will reasonably assume a label exists somewhere and go
looking for it. Either drop both, or use the id as it was intended and drop the `aria-label`
(a visible label would also be the better a11y outcome, though the row's 128 px label column is
already serving that role visually and is *not* associated with the field — which is arguably the
real gap here).

---

## What was checked and found sound (recorded so a later reader does not re-litigate it)

- **Hook order on `WorkflowBuilderPage.tsx`** — the early return for the pre-draft screen is at
  `:1900`. Every hook this phase adds is at `:769`–`:1770`. Clean.
- **`slug` is never written** — `setName` writes one `meta` key; `selectDefinition`'s added-key set
  is exactly `["name"]`, proved against a planted stray key. The identity expression at `:2426`
  reads only.
- **Absence travels as absence** — no `?? {}`, no `|| {}`, no boolean coercion on any of the five
  hops (`workflow_authoring.py` → route → `api.ts` cast → `useTemplateFirstDraft` → page state →
  `DecisionsList`). Verified by reading each hop, not by trusting the greps.
- **`graphColumn` child count** — still three elements (`builder-view-toggle`, the card,
  `graphChild`); the card renders `null` when dismissed, taking it to two with the graph last.
  Asserted as a number with a positive control that can report four.
- **The focus seams have live targets** — the card mounts only under `canvasEnabled`
  (`graphColumn`, `:2089`), and both refs sit inside `canvasEnabled` affordances that render in
  both graph views. There is no flag state in which a row's action is a dead control.
- **Backend readiness leaks nothing** — one status token plus one imported constant, derived after
  the slug mint, absent from all four failure returns. `_readiness_message_constant` is compared by
  **identity**, so a re-typed copy would red.
- **XSS** — no `dangerouslySetInnerHTML` anywhere in the phase's diff; the server sentence, the
  requirement, the filename and the name all render as plain React text children, each with a
  dedicated escaping case in `DecisionsList.test.tsx:485` and `:516`.
- **Tests** — no vacuous fence found. Every negative carries a live positive control in the same
  block; several plant the precise historical failure (`countOccurrences("")` → 0, the affirmative
  detector's lost word boundary, the suppression sweep's ability to see a content handle,
  `addedKeys` against a stray key, the absent-verdict assertion proved capable of firing).

---

_Reviewed: 2026-08-18T11:00:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
