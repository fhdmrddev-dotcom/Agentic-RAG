---
phase: 193
slug: authoring-doors-template-placement
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-13
---

# Phase 193 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `193-RESEARCH.md` § G "Validation Architecture" (measured at `HEAD = 58a402bc`),
> amended by the operator's plan-time answers recorded as **D-21…D-25** in `193-CONTEXT.md`.
> The Per-Task Verification Map is filled by `/gsd:plan-phase` once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + `@testing-library/react`, jsdom. **Frontend only** — D-16 measured that AUTH-03 needs no backend change, and D-21 did not alter that. |
| **Config file** | `frontend/vitest.config.ts` (via `vite.config.ts`); setup `frontend/src/test/setup.ts` |
| **Quick run command** | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx src/components/workflows/library/WorkflowCard.test.tsx src/pages/__tests__/RunModal.test.tsx` |
| **Full suite command** | `cd frontend && GSD_VITEST_MAX_WORKERS=4 node ../scripts/vitest-count-gate.cjs` |
| **Typecheck command** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` |
| **Lint commands** | `cd frontend && npx eslint src/components/workflows/` · a11y: `npx eslint <paths> -c eslint.a11y.config.js` |
| **Estimated runtime** | count gate ~90 s · touched-suite quick run ~15–25 s |

⚠ **`npx tsc --noEmit` WITHOUT `-p tsconfig.app.json` checks ZERO files.** The root `tsconfig.json`
is a solution file. A task that writes the bare form has written a no-op gate. Recorded trap.

⚠ **`npm run build` runs `tsc -b`, which is NOT `-p … --noEmit`** (the v3.3 lesson). Use the project
flag for any typecheck gate.

⚠ **`GSD_VITEST_MAX_WORKERS=4` is mandatory in any worktree/parallel run** and is calibrated for
**TWO** concurrent runs. At three the gate goes non-deterministic — `192-05` measured
`failed 6 → 0 → 1 → 3` on a single commit.

---

## Measured baselines at `HEAD = 58a402bc` — the sticks everything is measured against

| Measurement | Value | Command |
|---|---|---|
| Typecheck errors (whole app) | **33** | `npx tsc --noEmit -p tsconfig.app.json 2>&1 \| grep -c "error TS"` |
| Lint on `src/components/workflows/` | **10** — all pre-existing, **none in the five touched files** | `npx eslint src/components/workflows/` |
| Count gate | **exit 0** · total **3437** · pinned total **3413** · fences **64/64** | `node scripts/vitest-count-gate.cjs` |
| `WorkflowDoorSwitch.tsx` | **385 L** / 8 commits / 6 phases | `wc -l` · `git log --oneline -- <file> \| wc -l` |
| `WorkflowCard.tsx` | **747 L** / 7 commits | same |
| `RunModal.tsx` | **430 L** | `wc -l` |
| `soulData.test.ts` | pinned **17** | count gate `pinned` map |
| `WorkflowCard.test.tsx` | pinned **80** | " |
| `RunModal.test.tsx` | pinned **32** · `RunModal.a11y.test.tsx` **16** | " |
| `WorkflowBuilderPage.header.test.tsx` | pinned **32** | " |
| `librarySubtree.fences.test.ts` | pinned **118** | " |

**Any regression above these is introduced by this phase.** The lint zero on the five touched files
is load-bearing: a new lint error inside them is 193's, even though the directory total is 10.

✅ **The two-knob trap does NOT fire on this phase — the first time in nine phases that is true.**
Both `TARGETS` and `BASELINE` in `scripts/vitest-count-gate.cjs` already cover every affected suite.
Verified in `193-RESEARCH.md` § E. **New suites still need their `BASELINE` entry in the same commit
that creates them** (the `librarySubtree.fences.test.ts:74-80` rule).

---

## ⚠ The landmine CONTEXT.md's canonical_refs never named

`frontend/src/pages/WorkflowBuilderPage.header.test.tsx:304` holds a **byte-exact `innerHTML`
literal of the entire `doorGroup` band** — class lists, the `ml-auto`, the judge badge's `title`.

- **Wave 1 must keep it green with ZERO edits.** It predates this phase by nine phases, so an
  unedited pass is a *stronger* move-proof than any baseline 193 could author for itself.
- **Wave 2 will red it twice** (variant D's copy, then the D-04/D-22 restack). Both re-captures are
  legitimate and must be stated as such in the SUMMARY, never quietly absorbed.
- Three further suites outside `components/workflows/` also assert door copy. **All four belong in
  `files_modified`** or the phase will discover them at merge.

---

## Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | File exists? |
|---|---|---|---|---|
| AUTH-01 | **Wave 1:** the COPY strings render byte-identically after the move to `doorVocabulary.ts` | characterization | `vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx` | ❌ **Wave 0** — no DOM baseline exists |
| AUTH-01 | **Wave 1:** `WorkflowBuilderPage.header.test.tsx:304`'s band literal stays green **with zero edits** | characterization | `vitest run src/pages/WorkflowBuilderPage.header.test.tsx` | ✅ pinned 32 |
| AUTH-01 | Every one of the **21** ids (D-23 adds `strip.labelGovern`) is exported from `doorVocabulary.ts` and **equals column D exactly** | unit | new `doorVocabulary.test.ts` | ❌ **Wave 0** |
| AUTH-01 | **D-24 fence (a):** no door COPY literal survives outside `doorVocabulary.ts` | source fence (`?raw`) | extend `WorkflowDoorSwitch.test.tsx` (the `?raw` idiom already ships at `:22`) | ✅ file exists |
| AUTH-01 | **D-24 fence (b):** `DoorHeaderStrip.tsx` does not import back from `WorkflowDoorSwitch.tsx` (the 188.1 ESM-cycle shape) | source fence | new `DoorHeaderStrip.test.tsx` | ❌ **Wave 0** |
| AUTH-01 | D-12: the hint composes **three separate fragments**, `<b>` markup owned by the component | unit | `WorkflowDoorSwitch.test.tsx` | ✅ |
| AUTH-01 | D-05: `DoorHeaderStrip` renders in **both** variants; `ml-auto` present **iff not** `inline` | unit | new `DoorHeaderStrip.test.tsx` | ❌ **Wave 0** |
| AUTH-01 | D-04: the return control carries **no border class**; a divider sits between it and the label; the judge badge keeps the far edge | unit | `DoorHeaderStrip.test.tsx` | ❌ **Wave 0** |
| AUTH-01 | **D-22:** the describe band's return control is demoted too, and carries **no divider** | unit | `WorkflowDoorSwitch.test.tsx` | ❌ **Wave 0** |
| AUTH-03 | **D-21/D-25:** `templateAdmission` returns all **three** states over: emit + unbound / emit + bound `assets[kind=="template"]` / no emit / `undefined` / `null` / `{}` / `{phases: []}` / non-array `phases` | unit (pure) | `vitest run src/components/workflows/soulData.test.ts` | ✅ pinned 17 |
| AUTH-03 | **D-25:** an `llm_emit` phase with **no `emitter` key** admits (the Pydantic default) — the shipped `RunModal.test.tsx` fixtures at `:70-96` omit it | unit | `soulData.test.ts` | ✅ |
| AUTH-03 | **D-21:** a **bound** emit row returns `does-not-admit`, not `admits` — the 16-row correction | unit | `soulData.test.ts` | ✅ |
| AUTH-03 | D-15: the card renders the mark **only** on `"admits"`; `"does-not-admit"` and `"unknown"` are **indistinguishable** | unit | `WorkflowCard.test.tsx` | ✅ pinned 80 |
| AUTH-03 | D-14: the mark's slot asserted **by child order**, never by class name; the provenance node stays at DOM position 2 | unit | `WorkflowCard.test.tsx` (`identityParts()` at `:632`) | ✅ |
| AUTH-03 | D-20: the modal hides the block **only** on `"does-not-admit"`; `"unknown"` renders it exactly as today | unit | `RunModal.test.tsx` | ✅ pinned 32 |
| AUTH-03 | D-19: `run-provenance` is **byte-exact** and travels with the control | unit + fence | `RunModal.test.tsx` | ✅ |
| AUTH-03 | **The `launchError` hazard:** a non-template launch failure is still VISIBLE when the template block is hidden | unit | `RunModal.test.tsx` | ❌ **Wave 0** — no such case today |
| AUTH-03 | D-18's label is a **text node**, not a `<label htmlFor>` bound to a hidden input | a11y | `vitest run src/pages/__tests__/RunModal.a11y.test.tsx` | ✅ pinned 16 |
| both | No `title=` and no raw-HTML escape hatch anywhere in `library/` | fence | `vitest run .../library/librarySubtree.fences.test.ts` | ✅ pinned 118 |

---

## Sampling Rate

- **Per task commit:** the quick run above **plus** `npx tsc --noEmit -p tsconfig.app.json` (**33**).
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=4 node scripts/vitest-count-gate.cjs` — exit 0, no
  per-file decrease, `tsc` **33**, `eslint src/components/workflows/` **≤ 10** and **0 in the five
  touched files**.
- **Phase gate:** full suite green **and** the G-4 rows below driven, before `/gsd:verify-work`.

---

## Wave 0 Gaps

- [ ] `WorkflowDoorSwitch` characterization baseline — whole-`innerHTML` captures per RESEARCH § F.2,
      taken on the **UNMOVED** tree, in a commit that modifies **no source file**. ⚠ **A baseline
      only proves something if it PREDATES the change** (the 188.1 lesson) — this is why D-08's wave
      split is load-bearing rather than cosmetic.
- [ ] `frontend/src/components/workflows/doorVocabulary.test.ts` — all **21** ids present, each
      **exact-match** against column D. A `toContain` on a fragment is a vacuous fence
      (`libraryVocabulary`'s own header rule).
- [ ] `frontend/src/components/workflows/DoorHeaderStrip.test.tsx` — both `inline` values, the
      `ml-auto` conditional, the D-04 shape, the D-24(b) cycle fence.
- [ ] One new `RunModal.test.tsx` case for the **non-template launch-failure visibility** hazard.
- [ ] `soulData.test.ts` cases for the bound-vs-unbound arm of D-21.
- [ ] `BASELINE` entries in `scripts/vitest-count-gate.cjs` for every new suite, **in the same commit
      that creates it**.
- [ ] **No framework install needed.**

⚠ **Every D-24 fence must be driven RED against a real plant in a real file, and its SCOPE verified
— *could it fire?*** The 192.1 security audit found three fences where the property held with
**nothing defending it**, one of which swept against the empty string and passed green.

---

## Manual-only — the G-4 rows this phase owes

➡ **The drivable artifact is [`193-UAT.md`](./193-UAT.md)** — authored by `193-10` Task 3, driven by
`193-11`. It carries these same eight rows (none invented, none renumbered, none dropped), each
expanded into a recipe with its target named, its `fail:` conditions written **before** the drive,
and an empty result field. **Status at authoring: `0 driven · 0 passed · 0 failed · 8 owed`.** The
table below stays as the SCOPE of what is owed; the UAT file is how it gets driven.

**Three of the four deliverables have NO mockup**: the D-04/D-22 restack (`164/README.md:149-157`
says so) and both AUTH-03 surfaces (`build.cjs:23` — *"a PROPOSAL, not a generated dump"*). Those are
exactly where sketch→build drift survives, and they must be driven **by looking**.

| Row | What | Why it cannot be automated |
|---|---|---|
| **U1** | Show the chooser to someone who has not seen the Builder. Ask, **before** they click, what each door will do. Record their words **verbatim**. | **SC#1 is a prediction by a human.** No assertion can measure it. This is the row the whole phase exists for. |
| **U2** | Count the perceived choices on the chooser and inside each open door. | **SC#2** — "the number of perceived choices does not increase". A structural count cannot see perception. |
| **U3** | With `visual_workflow_canvas` **OFF** (standalone band) and again **ON** (merged row), compare the restacked strip against D-04's ASCII. Does the return control read as an *escape* rather than a peer? | **No mockup exists.** Pixel/weight judgement, **both `inline` values**. |
| **U3b** | Same judgement on the **describe** door's band (D-22). Does it agree with the govern one? | D-22 was decided at plan time and has no mockup on either side. |
| **U4** | ⚠ **Drive this against `ephemeral-template-fill-101uat` — it is the ONLY published row that admits.** Open the Run modal there and on a row that does not admit. Is `Template to fill` findable without being told? Is the control's absence *unremarkable* rather than *broken-looking*? | **SC#3.** The sketch draws neither state, and **a row picked at random cannot see this feature at all.** |
| **U5** | Read a card carrying `· needs a template` beside one that does not. Does the mark read as *a requirement of you*, or as *a description of the workflow*? | This is the D-21 escalation checked at the surface. If it reads as a description, the mark says nothing the *Makes a file* chip does not. |
| **U6** | Open the **govern** door after variant D lands. Does the header label agree with the door card that opened it? | The 21st-string finding. **D-23 is what makes a PASS possible here** — under the declined option this row was expected to FAIL. |
| **U7** | Trigger a launch failure on a workflow whose template block is hidden. **Is the error visible?** | The `launchError` hazard end-to-end — the WR-03 class of defect Phase 192's gap round had to repair on this same surface. |

**Driving notes (do not re-derive):** `take_screenshot` **times out** on this setup — read DOM
geometry via `evaluate_script`. `computer` clicks can deliver zero events; `hover` /
`left_click_drag` work. **No row may locate its target by `getElementById` on a known id** (D-27 —
the rule Phase 192's re-drive broke and 192.1 restored).

---

## Per-Task Verification Map

Filled by `193-10` Task 3 at the phase's close, from each plan's own `<verify><automated>` blocks —
**quoted, not paraphrased**. One line per plan, all eleven, so a reader can re-run any plan's gate
without opening it.

⚠ **Every command here was authored with `GSD_VITEST_MAX_WORKERS=4`, and that cap is CORRECTED ON
MEASUREMENT below** (see the note under the table). The commands are quoted as the plans wrote them;
the cap to actually use is `2`.

| Plan | Automated verification (verbatim from the plan) |
|---|---|
| `193-01` | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` · `… npx vitest run src/pages/__tests__/RunModal.test.tsx` |
| `193-02` | `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 \| grep -c "error TS"` · `… npx vitest run src/components/workflows/soulData.test.ts` · `… npx vitest run src/components/workflows/library/librarySubtree.fences.test.ts` |
| `193-03` | `… npx vitest run src/pages/WorkflowBuilderPage.header.test.tsx src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx src/components/workflows/WorkflowDoorSwitch.test.tsx` · `… npx vitest run src/components/workflows/DoorHeaderStrip.test.tsx` · `cd frontend && GSD_VITEST_MAX_WORKERS=4 node ../scripts/vitest-count-gate.cjs` |
| `193-04` | `node -e "const k=Object.keys(require('./.planning/sketches/164-telling-the-doors-apart/dom.generated.json'));if(!k.includes('govern'))process.exit(1);console.log(k.join(','))"` · `node .planning/sketches/164-telling-the-doors-apart/build.cjs && node …/assemble.cjs && grep -c "strip.labelGovern" …/BUILD-CONTRACT.generated.md` · `grep -c "strip.labelGovern" …/README.md` |
| `193-05` | `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 \| grep -c "error TS"` · `… npx vitest run …WorkflowDoorSwitch.baseline.test.tsx …WorkflowBuilderPage.header.test.tsx …WorkflowBuilderPage.describe.test.tsx …WorkflowDoorSwitch.test.tsx …DoorHeaderStrip.test.tsx` · `… npx vitest run src/components/workflows/doorVocabulary.test.ts src/components/workflows/WorkflowDoorSwitch.test.tsx` |
| `193-06` | `… npx vitest run src/components/workflows/library/librarySubtree.fences.test.ts` · `… npx vitest run src/components/workflows/library/WorkflowCard.test.tsx` |
| `193-07` | `… npx vitest run src/components/workflows/library/librarySubtree.fences.test.ts` · `… npx vitest run src/pages/__tests__/RunModal.test.tsx` · `… npx vitest run src/pages/__tests__/RunModal.test.tsx src/pages/__tests__/RunModal.a11y.test.tsx` |
| `193-08` | `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 \| grep -c "error TS"` · `… npx vitest run src/components/workflows/doorVocabulary.test.ts` · `… npx vitest run …WorkflowDoorSwitch.baseline.test.tsx …WorkflowDoorSwitch.test.tsx …WorkflowBuilderPage.header.test.tsx …WorkflowBuilderPage.describe.test.tsx …WorkflowBuilderPage.canvas.test.tsx` |
| `193-09` | `cd frontend && npx eslint src/components/workflows/DoorHeaderStrip.tsx -c eslint.a11y.config.js` · `… npx eslint src/components/workflows/WorkflowDoorSwitch.tsx -c eslint.a11y.config.js` · `… npx vitest run …DoorHeaderStrip.test.tsx …WorkflowDoorSwitch.test.tsx …WorkflowDoorSwitch.baseline.test.tsx …WorkflowBuilderPage.header.test.tsx` |
| `193-10` | `cd frontend && GSD_VITEST_MAX_WORKERS=4 node ../scripts/vitest-count-gate.cjs` · `grep -c "^#### Phase 193:" .planning/ROADMAP.md && grep -c "WorkflowDoorSwitch.tsx" CLAUDE.md` · `grep -c "ephemeral-template-fill-101uat" .planning/phases/193-authoring-doors-template-placement/193-UAT.md` |
| `193-11` | `grep -c "result:" …/193-UAT.md` · `grep -c "result: *$" …/193-UAT.md` · `node scripts/check-gap-closure-rounds.cjs 193` |

⚠ **`GSD_VITEST_MAX_WORKERS=4` IS THE WRONG CAP FOR THE FULL GATE ON THIS BOX, AND IT IS CORRECTED
HERE ON MEASUREMENT RATHER THAN INHERITED.** The line at the head of this file — *"`=4` is mandatory
in any worktree/parallel run"* — was calibrated at ~3400 gated cases for TWO concurrent agents. The
gate now executes **3557**. Measured on the identical tree `f2c29778` during this phase:

| Cap | Runs | `failed` |
|---|---|---|
| `4` | three | **17, then 4, then 3** |
| uncapped (~16 workers) | one | **11** |
| **`2`** | two | **0 and 0** |

Every failure was `STACK_TRACE_ERROR` — vitest's timeout signature, never an assertion; every
failing test lived in a file no plan had touched; and each such suite passed **in isolation** at
full green counts. Fewer workers reduced timeouts monotonically, so the binding resource is
**per-worker headroom against the 5000 ms per-test limit**, not core count. `193-10` reproduced the
same shape at this HEAD: cap 2 gave `failed 4` on its first run (all four `STACK_TRACE_ERROR` in
`WorkflowsPage.test.tsx`, which then ran `52 passed (52)` alone) and `failed 0` on the two runs
after. **Use `GSD_VITEST_MAX_WORKERS=2` for the full count gate; `=4` remains fine for the
single-suite quick runs above.**
