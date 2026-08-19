---
phase: 199-the-component-map
plan: 06
subsystem: workflow-authoring
tags: [des-01, sketch-178, c4, density-ceiling, seed-184, model-registry, graded-governance, g5]
requires:
  - "199-01 — the node face (ordering only; no file shared, and none was touched)"
  - "frontend/src/hooks/useModelRegistry.ts — the three readings, shipped at Phase 196"
provides:
  - "frontend/src/components/workflows/FieldGuidance.tsx — the panel's density ceiling"
  - "ModelField `noAnswer` — the picker can finally say it could not read the registry"
affects:
  - "frontend/src/components/workflows/PhaseFormPanel.tsx"
  - "frontend/src/components/workflows/ModelField.tsx"
  - "frontend/src/pages/WorkflowBuilderPage.tsx"
tech-stack:
  added: []
  patterns:
    - "state that a hot file's own zero-hooks fence forbids is sited in the leaf, not the host"
    - "a removal is proved by INVERTING its assertion, never by deleting it"
    - "three readings render three different things; the discriminator is explicit, never emptiness"
key-files:
  created:
    - frontend/src/components/workflows/FieldGuidance.tsx
  modified:
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/ModelField.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/PhaseFormPanel.test.tsx
    - frontend/src/components/workflows/ModelField.test.tsx
    - frontend/src/components/workflows/GovernanceSection.test.tsx
decisions:
  - "DEC-199-06-01 — the ceiling's state lives in FieldGuidance.tsx, not in the panel, because the panel's suite pins useState/useMemo/useEffect at an ABSOLUTE ZERO over its own source"
  - "DEC-199-06-02 — the tool whitelist's 'you cannot add one by typing' LEFT the guidance channel: it is a refusal, not guidance"
  - "DEC-199-06-03 — the model picker's helper was CUT, not folded: it restated the control's own first option"
  - "DEC-199-06-04 — the failed-read arm reuses the SHIPPED degraded-read language and spends no colour; sheet c4's danger colour is a REPORTED disagreement"
  - "DEC-199-06-05 — WorkflowBuilderPage.tsx was added to the diff (outside files_modified) because without it the new arm is a capability nothing can reach"
metrics:
  duration: "~75 min"
  completed: "2026-08-19"
---

# Phase 199 Plan 06: The Phase Form Panel Summary

Sheet c4's density ceiling is real: seven always-visible helper sentences per form folded
behind one switch with every decision left at rest, and the model picker can now say *"we
couldn't load the list of models"* instead of vanishing.

## Worktree base assertion — ⚠ IT FIRED, THE FOURTH CONFIRMED INSTANCE IN THIS PHASE

Reported because the executor prompt asked for it explicitly, and because this is now four
for four rather than an anomaly:

```
dispatched base   a64802968ba53c9f95031d38eeca13150f5a959e
git merge-base    3781a3fe4690a9619e619f4cc412bd37a7dafc52   ← WRONG
```

The worktree forked from a tree that **predated the dispatched base and did not contain
Wave 1**. Corrected with the sanctioned `git reset --hard`, then re-verified: `merge-base ==
HEAD == a648029`, and `git log --grep=199-01` returns four commits, so `PhaseNodeCard.tsx`'s
re-presentation was present before any work began. Plans 199-01, 199-03, 199-04 and now
199-06 have all hit this. **It is not intermittent and it should stop being treated as such.**

## What shipped, in three commits

| Commit | Task |
|---|---|
| `d19a8b9b` | the pre-change inventory — measured before anything moved |
| `ffa95d74` | the density ceiling |
| `6264097e` | the picker's failed-read arm + the governance-refusal re-proof |

## Sheet c4 — a verdict per element, none silently dropped (SC#1)

| Sheet element | Verdict | What was done |
|---|---|---|
| **COLLAPSED TO ESSENTIALS vs FULLY EXPANDED** | **BUILT** | `FieldGuidance.tsx` — one switch, default collapsed. |
| **Identity (name input)** | **ALREADY SHIPPED** | The panel header carries the step name; the sheet draws it as an inline title input. Presentation-only difference, not re-drawn. |
| **Model — "Failed to read registry"** | **BUILT** | `ModelField`'s `noAnswer` arm. |
| **Grounding — a control that visibly REFUSES** | **ALREADY SHIPPED, RE-PROVED** | `GovernanceSection` already strikes through, disables, and wires its reason by `aria-describedby`. Not rebuilt; re-asserted *inside the new ceiling* (below). |
| **Grounding states: not grounded / detected / locked** | **PARTIAL — reported** | `detected` and `locked` ship as the dial's causes. The sheet's *"+ Add source"* affordance does **not** exist here: this panel has no KB picker, and the shipped copy is explicit that *"this list is the real control"* — the tool chips are the door. Building an add-source control is a new capability, not a re-presentation. |
| **ARMED ACTION — the state** | **ALREADY SHIPPED** | `governance-arm`, its armed note and its pinned refusal. Fenced in; still at rest. |
| **ARMED ACTION — "Will overwrite 1,200 records"** | ⚠ **CANNOT-EXPRESS** | See below. |
| **TEMPLATES: none / attached / corrupt** | **PARTIAL — reported** | `TemplateAttachSection` ships `template-none`, `template-filename` and `template-fields-unavailable`. The third arm reads *"could not read"* rather than *"corrupt"*, which is the honest claim: the client cannot distinguish a corrupt file from an unreadable one. Not re-worded. |
| **"2 ISSUES DETECTED · Select a model · Connect a knowledge source"** | **ALREADY SHIPPED ELSEWHERE** | `ProblemsTray.tsx` (Phase 184-08), mounted by `WorkflowCanvas.tsx:1106`. **Deliberately not duplicated here** — plan 199-09 owns that surface. |
| **The 18 colour tokens** | **REPORTED — not used** | Wave 1 measured 15 of 18 compiling to nothing. This plan used **zero** sheet tokens; every class it added (`text-muted-foreground`, `border-border`, `text-foreground`, `focus:ring-primary`, `hover:bg-accent/40`) already resolves in `frontend/tailwind.config.js` and is already used elsewhere in the same file. |

## ⚠ CANNOT-EXPRESS reports, each in three parts

**1. The armed action's consequence line.**
- *What the sheet asks for:* `Will overwrite 1,200 records`, under the armed-action label.
- *What the component can do:* render `ACTION_RISK_ARMED_NOTE` — *"When this step is reached
  the run stops and waits for your answer."* It knows the step is armed and nothing else.
- *The gap:* **nothing in this product emits a record count.** Grepped `backend/app/models/harness.py`
  and `backend/app/services/harness/phase_types.py`: no `record_count`, no `rows_affected`, no
  equivalent. Every `external_action` capability (`send_email`, `create_ticket`, `post_message`)
  is a single act with no cardinality, and Phase 189 ships them as *recorded, not sent*. Drawing
  a number here would be the same fabricated precision the sketch README already names against
  sheet 3's `(4/12)`. **Not built. Not approximated.**

**2. A rendered HEIGHT is not measurable in this test environment.**
- *What the plan asks for:* *"record the rendered HEIGHT of the panel body"*, and publish the delta.
- *What the harness can do:* jsdom implements **no layout engine**. `offsetHeight` and
  `getBoundingClientRect().height` are a constant `0` for every element.
- *The gap:* a height delta computed here would be `0 − 0` and would **read as a passing
  measurement**. Substituted with the VOLUME OF RENDERED PROSE — deterministic, what a height
  is a proxy for anyway, and impossible to be zero by accident. The zero is asserted too, so
  the limitation is on the record rather than in a footnote.

**3. The sheet's danger colour for a failed registry read.**
- *What the sheet asks for:* the failed-read row in `error-container` / `error`.
- *What the component can do:* render the sentence in the shipped muted treatment.
- *The gap:* `error` and `error-container` are two of the 15 sheet tokens that compile to
  nothing here — but that is **not** the reason. The reason is that the SHIPPED language for
  exactly this situation sits **two fields up on the same form**: `ToolWhitelistRail`'s
  degraded arm says *"We couldn't load the tools this step is allowed to use. Nothing is
  offered here rather than a list that would be wrong."* in plain muted text, spending no
  colour. Two adjacent failed-read reports in different colours would be the real
  inconsistency. **The shipped language wins and the disagreement is reported** (SEED-155).

## The FENCED-IN atom list — written down BEFORE anything moved

Committed in `d19a8b9b`, one commit before the ceiling existed. Every entry is asserted
PRESENT at the collapsed reading, on a governed `llm_agent` step where they co-exist:

`rail-governance` · `governance-dial-loose` · `governance-dial-strict` · `governance-why` ·
`governance-refusal` · `governance-tool-control` · `governance-attached` · `governance-arm` ·
`governance-armed-note` · `rail-gates` · `rail-order` — plus, on the deliverable,
`rail-template` and `name-check`, and the per-option citation caption *"Every claim must be
cited…"*.

Two atoms were moved OUT of the guidance channel after this list was written, because the
list is what made the distinction visible:

- **The tool whitelist's `"you cannot add one by typing."`** — the only helper in the panel
  that is not a restatement of its own label. It states a REFUSAL, and a refusal behind a
  fold is one a person meets by being surprised. Now always on screen, as `tools-no-typing`.
- **The model picker's `"Leave blank to use the run's model."`** — cut outright rather than
  folded. It restated the control's own first option (*"Use the run's model"*), which is the
  one case where the purpose provably survives with no disclosure at all, because the
  surviving copy is inside the thing the person is already reading.

**The rule in one line, recorded in `FieldGuidance.tsx`:** a sentence that restates its own
label is guidance; a sentence that states what the product will or will not do is not.

## The measured subtraction (SC#3)

`llm_agent` and `llm_emit`, at full density, with rails, governed and armed:

| | helper lines | helper chars | total prose chars |
|---|---|---|---|
| **agent — BEFORE** | 7 | 342 | 1632 |
| **agent — at rest** | **0** | **0** | **1381** (`−251`) |
| **agent — fully open** | 5 | 234 | 1618 (`−14`) |
| **emit — BEFORE** | 7 | 339 | 1684 |
| **emit — at rest** | **0** | **0** | **1363** (`−321`) |

The BEFORE figures are **preserved verbatim in the test file** as `DENSITY_BEFORE`, and the
delta is COMPUTED against them rather than asserted blind — a pin overwritten to make red go
green is a pin that will never fail again. **Fully open is still below BEFORE**, because two
of the seven sentences left the guidance channel permanently and the switch cannot undo that.

**Zero assertions deleted.** `git diff` over all three test files against the base shows
exactly ONE removed `expect(` line, and it is the inversion itself — `getByText("Leave blank
to use the run's model.")` rewritten in place as `queryByText(...).not.toBeInTheDocument()`,
with a new assertion beside it proving the surviving copy is in the control.

## T-199-06-02 — the refusal did NOT degrade into a disablement

The threat this change carried was never that the dial breaks; it is that a control which
visibly REFUSES quietly becomes one that is merely DISABLED, because its reason went behind
a click. Four cases in `GovernanceSection.test.tsx` drive it **inside the real ceiling
provider, at the collapsed reading**:

- a **source fence** proving the section reads no guidance context at all (built needles, plus
  a positive control) — so the ceiling has **no mechanism** by which to reach it;
- the refusal is real DOM text, character-identical to `GROUNDING_LOCK_REFUSAL`;
- the **round trip** is asserted: control → `aria-describedby` → the visible sentence, with
  `title` still absent (the 184-07 lesson) and `line-through` still applied;
- both binding door words and the arming label are present at rest.

## T-199-06-01 — a failed read cannot call a known model unknown

`ModelField`'s `noAnswer` return is **the first statement after the hook**, and its POSITION
is the mitigation: every line below it reads `models`. Driven, not described — the case
passes the FULL row fixture *and* a stored value that IS in it, and asserts the
`(current) — not in the registry` caption is absent, no combobox exists, and the resolved run
default did not leak. A positive control proves the retention branch really can print that
caption, so the zero is a measurement.

The three readings render three different things, asserted pairwise-distinct on `innerHTML`:

| reading | on screen |
|---|---|
| `unavailable` | *"We couldn't load the list of models…"*, **no control at all** |
| `loading` | *"Loading the list of models…"* — and emphatically **not** the failed sentence |
| `ready` + `models: []` | **keeps its control** (the inherit option) plus *"This workspace offers no models for this step."* |

A failed read is **not a wipe**: what the step already names is still printed, sourced from
the STORED `value`, which is exactly what makes that line true without any row arriving.

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] `WorkflowBuilderPage.tsx` was edited, though `files_modified` did not name it

- **Found during:** Task 3.
- **Issue:** the caller spreads `modelPicker` **only** on `kind === "ready"`. Widening
  `ModelField` without touching it would have shipped a capability that **nothing in the
  application can ever reach** — a textbook stub, green in its own suite, invisible in the
  product. The plan's own must-have says *"the model picker CAN say it could not read the
  registry"*, and a capability no caller feeds does not satisfy it.
- **Fix:** the non-ready arm now passes the reading. `+24 / −6` on a 2678-line file; no other
  behaviour touched. The shipped `196-08` comment that named this file as owing the widening
  is **corrected in place and kept**, never overwritten.
- **Commit:** `6264097e`.

### 2. [Rule 3 — blocking] a new file, `FieldGuidance.tsx`, was created

- **Found during:** Task 2.
- **Issue:** `PhaseFormPanel.test.tsx` asserts an **ABSOLUTE ZERO** of `useState` /
  `useMemo` / `useEffect` over the panel's own `?raw` source, explicitly *"not 'no increase'
  — zero"*. A disclosure switch is state. Putting it in the panel meant re-baselining that
  pin, which the executor brief forbids outright and which would have permanently defanged
  the guard.
- **Fix:** the state lives in the leaf; the panel gains an import and one gated line — which
  is exactly what this file's hot-file ledger row *instructs*. **The zero-hooks pin was
  neither touched nor re-baselined and still passes.**
- **Commit:** `ffa95d74`.

### 3. [Rule 1 — bug caught by our own new fence] the inventory was measuring an UNARMED step

- **Found during:** Task 1, on the fence's first run.
- **Issue:** `action_risk_armed` is a `PhaseSpec`-level field, not a config key, so
  `phaseOf(config)` left it false and `governance-armed-note` never rendered — meaning "full
  density" was silently missing an atom.
- **Fix:** passed as `extra`; recorded in a comment so the next reader knows the fence caught it.

### 4. [Rule 1 — the 187-24 trap, twice]

- Two source fences went red because a **comment naming the needle is counted by the fence
  that greps for it**. Both needles are now assembled from fragments, in the component and in
  the test, with the incident recorded beside each.
- One count assertion reads `3` rather than `2` because `noAnswer`'s docblock deliberately
  cross-references `REGISTRY_EMPTY` by name. **Recorded as a `3`, not "fixed" by loosening the
  other two to `>= 2`** — with the real claim (no sentence spelled twice) asserted underneath.

## Hot-file ledger — re-derived, not trusted (⚠ the row is STALE)

| File | ledger row says | **measured 2026-08-19, after this plan** |
|---|---|---|
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | `19 / 9 / 1216` | **`21 / 11 / 1289`** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | `47 / 14 / 2656` | **`48 / 17 / 2678`** |
| `frontend/src/components/workflows/ModelField.tsx` | `1 / 1 / 236` | **`3 / 2 / 370`** |

⚠ **The `PhaseFormPanel.tsx` row was stale by 2 commits / 2 phases / 73 lines before this plan
even started**, which is this ledger's own recurring finding. **G-5 fires and is HONOURED BY
CONSTRUCTION for the fourth time**: the panel's whole share of this plan is an import, a
one-line hook read inside `FieldLabel`, a hoisted string constant, one wrapping element and a
widened `Pick`. No override is recorded.

⚠ **`ModelField.tsx` is at 2 phases and will FIRE on the next one.** Its ledger cell reads
*"⚠ it cannot express 'I could not read the registry'"* — **that is now false and the cell
owes an update in the same commit as its detail section** (same-commit sync rule).

⚠ **`FieldGuidance.tsx` (118 L, 1 phase) has no ledger row.** Below the G-5 threshold, but
`WorkflowsPage.tsx` escaped G-5 for ten phases purely by not being written down, so it is
named here: **the ONE home for the panel's guidance disclosure; its default context value is
`true`, and that direction is load-bearing — `false` would make a dropped provider look like a
successful subtraction.**

## Gates

| Gate | Result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | **33** — unmoved from the dispatched baseline; **ZERO** under `components/workflows/` or `WorkflowBuilderPage` |
| count gate (repo root, `GSD_VITEST_MAX_WORKERS=2`) | **`count gate OK` — 96/96 pinned present, no per-file decrease, `failed 0`, total 4805 · pinned total 4543** |
| `git diff --stat -- backend supabase` | **EMPTY** at every task |
| in-scope suites | `PhaseFormPanel` · `PhaseFormPanel.rails` · `ModelField` · `modelFitness` · `GovernanceSection` · `TemplateAttachSection` · `ExternalActionSection` — all green |
| downstream suites | six `WorkflowBuilderPage.*` (280) + `WorkflowCanvas` ×2 + `definitionOps` + `librarySubtree.fences` + `useDraftPersistence` — all green |
| `STATE.md` / `ROADMAP.md` | **not modified** |

⚠ **The count gate went green on the first run and SEED-171's triage was never entered.**
Recorded as an observation, not as proof of innocence. Three files carry `+n` that are **not
mine** and predate my base: `PhaseTimeline.test.tsx +11`, `WorkflowSoul.test.tsx +10`,
`WorkflowCard.baseline.test.tsx new`. The gate's contract is *no per-file DECREASE* and *zero
failing*; both hold, and a larger total is the gate working.

## Files needing no change — measured, and that IS the finding

`ExternalActionSection.tsx` and `TemplateAttachSection.tsx` are both in the plan's
`files_modified` and **neither was touched**. Grepped: **neither renders a single
`field-help` node.** `ExternalActionSection` speaks entirely through
`EXTERNAL_CAPABILITY_SENTENCES` on its radio rows; `TemplateAttachSection` speaks entirely
through conditional arms. **The density problem was 100% inside the panel's own field
primitives**, which is worth knowing before the next surface adopts them.

## Known Stubs

None. Every arm added here is reachable from the shipped caller: `WorkflowBuilderPage` now
feeds `loading` and `unavailable` from the live hook, and the ceiling's switch renders on
every mount of the panel.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema changed. The two
mitigations the plan registered (`T-199-06-01`, `T-199-06-02`) are driven by tests named in
this summary; `T-199-06-03` is discharged by the `FENCED_IN` list being committed one commit
before anything moved.

## Self-Check: PASSED

- `frontend/src/components/workflows/FieldGuidance.tsx` — FOUND
- `.planning/phases/199-the-component-map/199-06-SUMMARY.md` — FOUND
- `d19a8b9b` · `ffa95d74` · `6264097e` — all FOUND in `a648029..HEAD`
- `git diff --stat a648029 HEAD -- backend supabase .planning/STATE.md .planning/ROADMAP.md` — EMPTY
