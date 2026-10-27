---
phase: 290-the-card-and-the-team-picture
reviewed: 2026-10-21T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - frontend/src/components/workflows/teamModel.ts
  - frontend/src/components/workflows/teamVocabulary.ts
  - frontend/src/components/workflows/TeamPicture.tsx
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/library/stepLine.ts
  - frontend/src/components/workflows/library/StepChipLine.tsx
  - frontend/src/components/workflows/library/WorkflowCard.tsx
  - frontend/src/components/workflows/library/libraryVocabulary.ts
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/components/workflows/__fixtures__/teamFixtures.ts
  - frontend/src/components/workflows/teamModel.test.ts
  - frontend/src/components/workflows/teamVocabulary.test.ts
  - frontend/src/components/workflows/TeamPicture.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.team.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  - frontend/src/components/workflows/__tests__/WorkflowCanvas.headerPin.test.tsx
  - frontend/src/components/workflows/library/stepLine.test.ts
  - frontend/src/components/workflows/library/StepChipLine.test.tsx
  - frontend/src/components/workflows/library/WorkflowCard.test.tsx
  - frontend/src/components/workflows/library/librarySubtree.fences.test.ts
  - frontend/src/components/settings/__tests__/connectionVerbFence.test.ts
  - scripts/vitest-count-gate.cjs
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
fix_iteration: 1
fix_scope: [CR-01, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06]
fixed: [CR-01, WR-01, WR-03, WR-04, WR-05, WR-06]
deferred: [WR-02]
---

# Phase 290: Code Review Report

**Reviewed:** 2026-10-21
**Depth:** standard (for the six edited files, the tests and the gate script, only the hunks in `git diff 1f9673d25..HEAD`)
**Files Reviewed:** 22
**Status:** issues_found

## Summary

I reviewed the team-picture derivation (`teamModel.ts`), its vocabulary, its render (`TeamPicture.tsx`), the canvas mount, the card chip line (`stepLine.ts`, `StepChipLine.tsx`) and the changes to the card, the builder and the tests. I checked each claim about what the engine does against the backend: `models/harness.py` `ValidatorSpec`/`PhaseSpec`, `harness_engine._run_phase_with_gates`, `harness/engine_ask._parse_on_failure`, `harness/grounding.effective_phase` / `is_engine_citation_gate`, and the `skip_to` runtime guard.

What holds up:
- **SC#3 holds by construction.** The only line between a check and another step is a `jump`, and it is emitted only when the slug resolves.
- **D-18 is right.** The citations Check is added only for `detected`, which matches `effective_phase`, and its "redo 2 times, then ask you" matches Phase 295's `is_engine_citation_gate`.
- **Pre and post gates are worded right.** Pre gates do not redo, post gates do.
- **F-6 is right.** Keyboard reorder is gated in Team mode.
- **Author text stays text.** Everything author-supplied renders as JSX text or attribute values, with no HTML sink.
- **No crashes on malformed input.** Lookups use `own()` and the slug lookup is a `Map`.

The main defect is in the derived armed checkpoint. It reads only the stored `action_risk_armed` flag. The backend sets that flag to true on every `external_action` step, but the client does not. So a new or unsaved `external_action` step, and the phase's own 7-step stress fixture, show no checkpoint even though the engine will stop and ask. The failure words also differ from the engine for `on_failure` values the engine treats as `fail_run`. The fixtures pin that wrong text. The rest are a Team view that is not actually read-only, line geometry that can look like links the definition lacks, and an accessibility mismatch on the chip toggle.

## Fix outcomes (2026-10-22, gsd-code-fixer)

Scope: CR-01 and WR-01..WR-06. IN-01..IN-05 were left untouched by instruction.

| Finding | Outcome | Commit |
|---|---|---|
| CR-01 | fixed | `ed6803cb5` |
| WR-01 | fixed | `9f6e5ed38` |
| WR-02 | **deferred** (reason under the finding) | none |
| WR-03 | fixed: requires human verification (visual) | `3fcfaca4f` |
| WR-04 | fixed: requires human verification (visual) | `3fcfaca4f` |
| WR-05 | fixed | `e03ac0a8b` |
| WR-06 | fixed | `9e1e58b59` |

**Gates after the fixes:**
- Count gate: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, run from the repo root, printed `count gate OK — 493/493 pinned files present, no per-file decrease, 0 failing` (total 11382, failed 0). Each raised pin matches its actual: `teamModel.test.ts` 248, `TeamPicture.test.tsx` 42.
- Typecheck: `npx tsc -p tsconfig.app.json --noEmit` reported 63 errors. That is the pre-existing count, and none of the errors is in a touched file.

**Follow-up, not fixed here:** `canvasModel.ts`'s armed detour reads the stored `action_risk_armed` flag only, so the same gap as CR-01 exists on the Steps canvas. That code predates 290, and the shared `actionRiskArmed` helper was left unchanged by instruction. A later phase should give the canvas the same always-armed rule (`ARM_PINNED_TYPES` / the `harness.py` D-04 validator).

## Critical Issues

### CR-01: An `external_action` step without a stored `action_risk_armed` shows no checkpoint, though the engine always stops and asks

**File:** `frontend/src/components/workflows/teamModel.ts:269` (also `__fixtures__/teamFixtures.ts:32`, `teamModel.test.ts:269-273`)

**Issue:** `derivedGates` adds the armed Check only when `actionRiskArmed(phase)` is true, which means `phase.action_risk_armed === true` (`phaseVocabulary.ts:512`). The engine does not read the stored flag alone. `PhaseSpec`'s D-04 model validator (`backend/app/models/harness.py:633-642`) sets `action_risk_armed = True` on every `external_action` phase during `model_validate`. The engine runs from that validated definition, so it pauses before every `external_action` body.

The client never writes the flag for a new step. `minimalPhaseFor` (`definitionOps.ts:1051-1060`) returns only `slug`, `phase_index` and `config`. `GovernanceSection.tsx:136-141` already documents this gap and covers it with `ARM_PINNED_TYPES`, but the team picture does not use that rule. The builder hands the picture its in-memory phases, unsaved edits included, and the store never reloads phases from the server after a save.

What a user sees:
- On a draft whose only gate would be the checkpoint, the picture says **"Nothing checks this work."** (`absence: "none"`). The step's own role line says "Stops for your approval before it acts outside", so the picture contradicts itself. This is the failure D-17 exists to prevent.
- The phase's own stress fixture shows it. `vendorRiskReview`'s `notify` step is an `external_action` with no flag. `teamModel.test.ts:269` asserts "three gates" for it, so the suite pins the wrong picture: the engine runs four.

`canvasModel.ts`'s armed detour has the same gap. That code predates this phase; it is named here only so the fix covers both.

**Fix:** Use one armed rule, the same one GovernanceSection already applies, in both the team model and the canvas:
```ts
// phaseVocabulary.ts (or GovernanceSection.tsx, exported):
export const ARM_PINNED_TYPES: readonly string[] = ["external_action"]
export function actionRiskEffective(phase: PhaseSpecJSON): boolean {
  return actionRiskArmed(phase) || ARM_PINNED_TYPES.includes(phase.config?.phase_type ?? "")
}
// teamModel.ts derivedGates:
if (actionRiskEffective(phase)) { gates.push({ … derived: "armed", source: armed
  ? `phases[${original}].action_risk_armed = true`
  : `phases[${original}].config.phase_type = "external_action" (always armed)` }) }
```
Then change the stress assertion to four gates and add a test with an unflagged `external_action` step.

**Outcome: fixed (`ed6803cb5`).** The fix is in `teamModel.ts` only, which stays a pure leaf. It does not change `phaseVocabulary.ts`, does not import `GovernanceSection.tsx`, and leaves the canvas detour alone. `teamModel.ts` keeps `ARMED_TYPES = ["external_action"]`, with a docblock that points at `ARM_PINNED_TYPES` (`GovernanceSection.tsx:142`) and the `PhaseSpec` D-04 validator (`harness.py:633-642`). `derivedGates` arms a step when the stored flag is true or the type is in that list. A step armed by type has the source `phases[i].config.phase_type = "external_action" (the engine always arms it)`. The `vendorRiskReview` assertion now reads four gates (`gate-5-armed` on `notify`). New cases cover an unflagged or `false` external_action, which still draws the armed Check; a positive control for another type; and a `?raw` fence that fails if the two lists stop matching. Pin: `teamModel.test.ts` 243 -> 246.

## Warnings

### WR-01: Failure words show an unknown `on_failure` value word for word, but the engine stops the run

**File:** `frontend/src/components/workflows/teamModel.ts:236-238` (pinned by `teamModel.test.ts:375` and `teamFixtures.ts:178`)

**Issue:** For an `on_failure` value that is not `fail_run`, `retry`, `ask_user` or a `skip_to_phase:` prefix, the code sets `then = raw`. The engine's `_parse_on_failure` (`engine_ask.py:128-131`) sends every unknown value to `fail_run`. `on_failure` is a plain `str` on `ValidatorSpec`, and `reachability.py` lints only skip targets, so a typo can be saved and published. Two examples:
- `"ask-user"` reads "…then ask-user", but the run fails.
- `"skip_to:review"` reads "…then skip_to:review", but the run fails.

The `retryMatrix` fixture asserts `failRedoThen(2, "explode")`, so this divergence from D-19 ("failure words follow the engine") is pinned as correct.

**Fix:** `} else { then = FAIL_STOP }`. Keep the raw value only in the ⌥ ledger (`source`), and change the `retryMatrix` expectation to `failRedoThen(2, FAIL_STOP)`.

**Outcome: fixed (`9f6e5ed38`).** I traced `engine_ask._parse_on_failure` first. A skip target resolves to `skip_to_phase`, `ask_user` resolves to `ask_user`, and everything else, including `fail_run` and `retry`, resolves to `fail_run`. `failureWords` now follows that: a skip target, then `ask_user`, then `FAIL_STOP` for everything else. No new string was needed. The `retryMatrix` expectation is now `failRedoThen(2, FAIL_STOP)`, and a new case pins `explode`, `ask-user`, `skip_to:review` and `""` to "stop the run", with no raw text in the words. The raw value is not added to the gate's ledger `source`, which still names the kind. Only a resolvable jump line carries `on_failure` in its source, as before. Pin: `teamModel.test.ts` 246 -> 247.

### WR-02: The Team view says "View only" but the definition can still change underneath it

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:1154-1160, 1269-1284`; `frontend/src/pages/WorkflowBuilderPage.tsx:841, 942-971`

**Issue:** F-6 gated only the ⌥←/⌥→ handler. Two other edit paths stay live while Team is showing:
1. **Undo and redo.** The builder's ⌘Z / Ctrl+Y listener is gated only on `activeGraphView === "canvas"`, so in Team view it still steps the store's history and clears the canvas notice. The Steps toolbar and save reading are unmounted by the Team early return, so nothing on screen shows that an edit was undone or redone.
2. **The side panel.** `panelOpen = selectedSlug !== null`, and selection survives the switch to Team (by design, to restore Steps). So the editable PhaseFormPanel stays open next to a header that now reads "👁 View only".

**Fix:** Pass the view up, or expose `onViewChange`, so the builder can gate its undo effect with `|| teamShown`. Either clear the selection or collapse the panel while Team is showing; or, if editing next to the picture is intended, change the header so it does not say "View only".

**Outcome: DEFERRED. Not fixed, by the orchestrator's budget rule.** The fix cannot be one more condition in `WorkflowCanvas.tsx`. That file is G-5-firing, and 290-03 already spent its budget on six items (`290-03-SUMMARY.md`). The fix needs all of the following:
1. A way for the builder to learn the canvas's view. The view is local `useState` in the canvas. The candidates are an `onViewChange` field on the `team` prop plus the call in the switch handler, or making the view a controlled prop, which would replace item 2 and break `WorkflowCanvas.team.test.tsx`'s uncontrolled arm. A callback alone also goes stale: the canvas resets to `steps` when it remounts (for example after a graph-view switch), and the builder's copy would still say `team` unless an unmount effect or a reset in the builder corrects it.
2. In `WorkflowBuilderPage.tsx`, which also fires G-5 and is marked ⛔: a new state, `|| teamShown` on the undo/redo effect, and `&& !teamShown` on `panelOpen`.
3. A design choice that belongs to the operator (G-2 / G-4). Clearing the selection breaks UI-SPEC §"What Team does" ("selection, unsaved edits and scroll position are not lost"). The alternative the reviewer names, keeping the editor and changing the header so it does not say "View only", changes UI-SPEC's locked header line.

Re-open trigger: the next phase that lists `WorkflowCanvas.tsx` in `files_modified`. Lift `view` into the builder as part of that file's G-5 refactor, then gate undo/redo and the panel in the builder. Until then, Team view reflects every undo or redo and every panel edit as it happens, because the picture re-derives from the same in-memory phases, but nothing on screen marks those edits as unsaved.

### WR-03: Lines run behind translucent cards, so they look like links between gates

**File:** `frontend/src/components/workflows/TeamPicture.tsx:146-154, 204, 379`

**Issue:** The SVG sits behind the content (`absolute inset-0`, earlier in the DOM than the `relative` `<ol>`).
- Each gate line runs from its gate's top straight up to the step (`M cx gate.top V step.bottom`). The second and later gates' lines therefore pass behind every gate card above them.
- A jump's last segment runs up the target column to the target step's bottom (`V to.bottom`), so it crosses the target's own gate cards at the same x as their check lines.

Gate cards use translucent fills (`bg-muted/40`, `bg-accent-violet/10`), so the dashed strokes show through. A second check reads as joined to the first, and a jump line overlaps the target's check lines. That is the G-4 failure "a line appears between two steps" in a weaker form: the drawing implies links the derivation does not emit.

**Fix:** Give gate and step cards opaque backgrounds, for example `bg-card` with a tinted inner layer or `bg-[color-mix(...)]`. Alternatively, route gate lines along a left-edge rail (`x = card.left + 8`) and end jump lines at the target column's lowest gate rather than at the step.

**Outcome: fixed: requires human verification (visual) (`3fcfaca4f`, together with WR-04).** I routed the lines rather than making the cards opaque. Opaque cards would still leave dashes in the 8px gaps between cards, and those would read as gate-to-gate links. The gate list is now indented `GATE_INDENT` (16px). Each gate line leaves its card's left edge into its own rail inside the indent and runs up to its step's bottom edge. A later gate's rail sits further out, so it never touches an earlier gate's stub. A jump leaves its check's right edge into the column gutter, runs down to its lane, across, up the target column's gutter, and into the target step's right edge. It never crosses a gate card. Unchanged: one `<path>` per `lines[]` item, and `data-line-kind` / `data-line-source` / `data-line-from` / `data-line-to`. A new planted-layout suite stubs `getBoundingClientRect` and asserts that no segment of any line passes through any card on `crowded`, `vendorRiskReview` and `branching`. It was driven RED against the pre-fix render (3 failed) and restored md5-identical before the fix was committed. UI-SPEC lines 235-236 are struck through, with the correction beside them. A live look in the browser (G-4) is still owed.

### WR-04: Every jump uses the same horizontal y, so two jumps can become one ambiguous line

**File:** `frontend/src/components/workflows/TeamPicture.tsx:148-151`

**Issue:** Every jump runs horizontally at `lowestGate + JUMP_DROP`, and every label sits at `y + 4`. Two jumps whose column ranges overlap, for example step 1 → step 4 and step 2 → step 3, draw on the same horizontal segment with labels stacked on top of each other. A reader cannot tell which check goes to which step, so the picture can suggest a source/target pair the definition does not have. This is rare in production (0 skips today), but the 7-step stress shape is the stated bar.

**Fix:** Give each jump its own lane, `y = lowestGate + JUMP_DROP + lane * 14`, and grow `pb-14` by the number of lanes. Give each label its lane's y.

**Outcome: fixed: requires human verification (visual) (`3fcfaca4f`).** Each jump gets its own lane: `y = lowestGate + JUMP_DROP + lane * LANE_GAP`. `LANE_GAP` is 22, not 14, because a label 14px below its lane would overlap the next lane's line. Each jump also gets its own gutter offset, cycled over 4/8/12px, so a column that is both a source and a target never shares a vertical run. Each label sits under its own lane. The step row's bottom padding is now `56 + (jumps - 1) * 22` (inline), where it was `pb-14`. The `crowded` fixture has three jumps, including the overlapping 1->4 and 1->3 / 2->3 ranges. Its tests assert that no two jumps share a stretch of line (the final run into a shared target step may meet at that step), that there are three distinct lanes, and that every gate in a step has its own rail. Pin: `TeamPicture.test.tsx` 36 -> 42.

### WR-05: The collapsed chip toggle's accessible name does not contain its visible text

**File:** `frontend/src/components/workflows/library/StepChipLine.tsx:99-101`

**Issue:** The visible text is `+3 more`, but `aria-label` replaces the name with `Show 3 more steps`. That fails WCAG 2.5.3 Label in Name: a voice-control user who says "click plus 3 more" gets no match. axe's `label-content-name-mismatch` rule is experimental and off by default, so the suite's axe runs cannot catch this.

**Fix:** Make the name start with the visible text, `aria-label={\`${stepLineMore(n)} steps\`}` ("+3 more steps"), or drop `aria-label` and add a visually hidden " steps" suffix inside the button.

**Outcome: fixed (`e03ac0a8b`).** `stepLineMoreLabel(n)` in `libraryVocabulary.ts` now builds on `stepLineMore(n)`, so it reads `+1 more step` / `+N more steps` and always starts with the visible text. There is no `title=`, and the singular stays its own branch. `StepChipLine.test.tsx` asserts the role name `+4 more steps` and that the name starts with the button's text. `stepLine.test.ts` asserts the exact strings and the starts-with property for 1, 4 and 12. UI-SPEC lines 149 and 175 are corrected, with the old wording named. No case count changed.

### WR-06: `max_retries` values the engine accepts give the wrong redo count

**File:** `frontend/src/components/workflows/teamModel.ts:213-217`

**Issue:** `ValidatorSpec.max_retries: int = 2` has no `ge=0`, and Pydantic v2's lax mode accepts strings that hold an integer. The engine stops redoing as soon as `attempt >= max_retries`, with `attempt` starting at 0. Two cases go wrong:
- **Negative value (`-1`).** The engine does no redo; the picture says "redo the step (up to 2 times)".
- **String value (`"3"`).** The engine redoes 3 times; the picture says 2.

Hand-edited or imported rows reach the picture unchanged, because the builder reads raw JSONB.

**Fix:** Copy the engine's coercion. Negative integers should mean 0 (`retries === 0` already gives the outcome-only sentence), and a string holding an integer should be parsed. Otherwise show the default, with the raw value in the ledger source.

**Outcome: fixed (`9e1e58b59`).** I traced the backend first. `harness_engine` stops redoing at `exhausted = identical or attempt >= phase_max_retries` with no upper cap. I then measured `ValidatorSpec(max_retries=…)` directly in the backend venv:

| Input | Pydantic reads |
|---|---|
| `-1` | `-1` |
| `"3"`, `" 3 "`, `"3.0"`, `3.0` | `3` |
| `"+2"` | `2` |
| `"1_0"` | `10` |
| `True` | `1` |
| `"-2"` | `-2` |
| `3.5`, `""`, `None`, `"0x3"` | ValidationError |

`retriesOf` in `teamModel.ts` copies that coercion and clamps negatives to 0, which gives the outcome-only sentence. Absent values and values Pydantic refuses read as the default 2: a refused value fails validation, so the engine never runs that definition. A 15-row case pins every input above. The raw value is not added to the ledger `source`, so the gate source format is unchanged. Pin: `teamModel.test.ts` 247 -> 248.

## Info

### IN-01: The card and the picture break `phase_index` ties differently
**File:** `library/stepLine.ts:72` vs `teamModel.ts:174-176`
**Issue:** The chip line keeps array order on ties (stable sort). The picture sorts ties by slug. The engine's `sorted(rows, key=phase_index)` is stable, which matches the card. Ties occur only on unsaved or invalid drafts, but then the two views can number the steps differently.
**Fix:** Drop the slug tie-break in `orderSteps`, or share one comparator.

### IN-02: "A step with no type" lives in two vocabulary files
**File:** `libraryVocabulary.ts` `STEP_LINE_UNTYPED`, `teamVocabulary.ts:147` `TEAM_STEP_UNTYPED`
**Issue:** It is the same meaning with two homes, which goes against the one-vocabulary rule D-15 applies to step words.
**Fix:** Have one module import the other's entry, or move the floor into `phaseVocabulary.ts`.

### IN-03: The builder types a fallback name inline and can produce an empty figure label
**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:2080`
**Issue:** `"Untitled workflow"` is a string written inline, not taken from the vocabulary. `meta.slug ?? …` returns `""` for an empty slug, which gives the label "Team picture for ". A name made only of spaces passes the `length > 0` check.
**Fix:** Use `meta.name?.trim() || meta.slug?.trim() || TEAM_UNTITLED` (a new vocabulary entry).

### IN-04: The Steps | Team tablist has no arrow-key navigation and no tabpanel
**File:** `TeamPicture.tsx:73-98`
**Issue:** The pattern matches the house `builder-view-toggle`, but `role="tab"` normally implies roving tabindex, arrow keys and an `aria-controls` tabpanel. This applies to the house pattern as a whole, not only to this phase.

### IN-05: Keyboard users may not be able to scroll the plane horizontally
**File:** `TeamPicture.tsx:360`
**Issue:** 7 steps need a minimum width of about 992 px. With the side panel open, the plane scrolls horizontally, and by design (D-06) it contains nothing focusable. Browsers that do not make scroll containers focusable automatically (Safari) leave keyboard users unable to scroll it.
**Fix:** Add `tabIndex={0}` and an `aria-label` to the `team-plane` scroller (a scroll region, not an interactive node), or confirm the browser support you rely on.

---

_Reviewed: 2026-10-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
