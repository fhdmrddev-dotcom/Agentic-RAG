---
phase: 193-authoring-doors-template-placement
plan: 02
subsystem: workflows-library
tags: [AUTH-03, predicate, vocabulary, three-state, D-21, D-25]
requires: []
provides:
  - "templateAdmission() — the three-state template-admission predicate (soulData.ts)"
  - "TemplateAdmission union type"
  - "DefShape.assets — the bound-library-template read-shape"
  - "CARD_TEMPLATE_MARK / RUN_TEMPLATE_LABEL (libraryVocabulary.ts)"
affects:
  - "193-06 (WorkflowCard mark) and 193-07 (RunModal label) import all four"
tech-stack:
  added: []
  patterns:
    - "derive, do not re-implement (libraryFilter.ts header) — nothing here re-implements soulDeliverable/tierForDefinition"
    - "three-state union over boolean, because two consumers fall back opposite ways"
    - "port strings from the GENERATED build contract, compared byte-for-byte in code"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/workflows/soulData.test.ts
    - frontend/src/components/workflows/library/libraryVocabulary.ts
decisions:
  - "D-21 shipped as measured: llm_emit present AND no bound assets[kind=='template']"
  - "D-25 honoured: templateAdmission sits immediately after soulDeliverable, returns the three-state union"
  - "phases: [] reads unknown, never a positive no"
  - "an llm_emit phase with no emitter counts as render_template (Pydantic default)"
  - "the two AUTH-03 strings live in libraryVocabulary.ts, not doorVocabulary.ts"
metrics:
  duration: "~35 min"
  completed: 2026-08-13
---

# Phase 193 Plan 02: The Template-Admission Predicate + Its Two Words — Summary

AUTH-03's one genuinely new piece of logic ships as a **three-state** pure predicate
(`templateAdmission`) reading the signal that actually exists in the data — `phase_type ===
"llm_emit"` minus rows that already bind a library template — plus the two strings its
consumers will render, ported byte-for-byte from sketch 164's generated build contract.

## Worktree provenance

| | |
|---|---|
| bootstrap-worktree.sh | ran FIRST, `BOOTSTRAP OK` (junctions + env copies verified) |
| HEAD at spawn | `fda79214`, merge-base `3781a3fe` — **the wrong base** |
| corrective action | `git reset --hard 501b3c14`, then re-bootstrapped |
| **base SHA after correction** | **`501b3c141d5a8e2b5cffc57f7e1b7ddfadba3406`** |
| branch | `worktree-agent-a30cacdd70970219d` (allow-list assertion passed) |
| `GSD_VITEST_MAX_WORKERS` | `4`, exported in every shell that ran vitest or the gate |

⚠ **The Phase-192 fork failure reproduced exactly.** This worktree came up on a base whose
merge-base with the dispatched SHA was `3781a3fe`, not `501b3c14`. Every gate would have
been green on the wrong tree. The assertion caught it; the reset corrected it; the
bootstrap was re-run afterwards because `reset --hard` can disturb the junction set.

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | `DefShape.assets` + `templateAdmission()` (D-21/D-25) | `05b99ee4` | `soulData.ts` (+84) |
| 2 | Three-state coverage, bound arm driven RED | `3c7039ce` | `soulData.test.ts` (+124) |
| 3 | The two AUTH-03 strings, ported | `d81bc2d8` | `library/libraryVocabulary.ts` (+66) |

## What shipped

**`templateAdmission(def: DefShape | null | undefined): TemplateAdmission`** —
`soulData.ts:232`, declared immediately after `soulDeliverable` (`:172`), asserted by line
number rather than by eye. Five rules in order:

1. nullish `def`, or `phases` not an array → `unknown` (the wire did not say)
2. `phases.length === 0` → `unknown` (110 of 145 published rows — an unauthored stub)
3. no `llm_emit` phase whose `config.emitter ?? "render_template"` is `"render_template"` → `does-not-admit`
4. an emit phase exists but `assets[]` holds a `kind === "template"` entry → `does-not-admit`
5. otherwise → `admits`

`DefShape` gained exactly one optional member, `assets?: Array<{ kind?; asset_id?; … }> | null`.
It was always reachable through the index signature and therefore always untyped; declaring
it follows `libraryFilter.ts`'s *DERIVE, DO NOT RE-IMPLEMENT* rule rather than narrowing at
the call site. Only `kind` is ever consumed — `asset_id` is declared because the live rows
carry it, and is never read, rendered or logged (threat T-193-07, `accept`, named not implicit).

**`CARD_TEMPLATE_MARK = "needs a template"`** and **`RUN_TEMPLATE_LABEL = "Template to fill"`**
— `libraryVocabulary.ts`, in a new AUTH-03 block placed in the D-14 slot (after the state
words, immediately before `CHANGED_PREFIX`, i.e. *whose it is · what it needs · when it
changed*). No consumer added; `193-06` and `193-07` import them.

## Proof, not assertion

**The port is byte-exact and was compared IN CODE, never by eye.** A throwaway node script
(scratchpad, not in the tree) parsed the `card.templateMark` / `run.templateLabel` rows out
of `.planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md` and compared
them to the values extracted from the module source:

```
CARD_TEMPLATE_MARK module="needs a template" contract="needs a template" byteEqual=true
RUN_TEMPLATE_LABEL module="Template to fill" contract="Template to fill" byteEqual=true
exit=0
```

**RED-first proof of the bound arm — the arm a green suite would otherwise never enter.**
Rule (4) was changed in production source from `return "does-not-admit"` to `return "admits"`.
Observed failures (real `AssertionError`s, not timeouts):

```
× one llm_emit phase + a BOUND library template → { … assets: [ { kind: 'template', … } ] }
  AssertionError: expected 'admits' to be 'does-not-admit' // Object.is equality
× answers a DIFFERENT question from soulDeliverable — why P1′ was rejected (D-21)
  AssertionError: expected 'admits' to be 'does-not-admit' // Object.is equality
Tests  2 failed | 31 passed (33)
```

| | md5 of `frontend/src/components/workflows/soulData.ts` |
|---|---|
| pre-plant | `41fc9d910252c65d48df61c0a5d7e426` |
| post-restore | `41fc9d910252c65d48df61c0a5d7e426` |

Restored **md5-identical**, and independently confirmed by `git status --short` on the file
returning empty against the committed blob. The suite is green again at 33/33.

**Case count read off the gate, never hand-counted:** `soulData.test.ts  17 → 33  (+16)`.

## Verification

| Check | Required | Observed |
|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` (baseline, before any edit) | — | **33** |
| `tsc` after the `DefShape` widening | 33 | **33** — unmoved |
| `tsc` at plan end | 33 | **33** |
| `eslint src/components/workflows/soulData.ts` | 0/0 | **0/0** |
| `eslint src/components/workflows/library/libraryVocabulary.ts` | 0/0 | **0/0** |
| `eslint src/components/workflows/` | ≤ 10 | **10** (all pre-existing, none in the two touched files) |
| `vitest run soulData.test.ts` | pass, ≥ 17 | **33 passed / 0 failed** |
| `vitest run library/librarySubtree.fences.test.ts` | pass | **118 passed** (F5 + T-192-04 green over the edited module) |
| `vitest run src/components/workflows/library/` | pass | **8 files / 420 passed** |
| `node ../scripts/vitest-count-gate.cjs` | exit 0, `failed 0`, no `[count-decrease]` | **exit 0** · `total 3453 · failed 0 · pinned total 3413` · 64/64 pinned files present |
| `grep -c "export type TemplateAdmission"` | 1 | **1** |
| `grep -c "boolean"` in the function body | 0 | **0** |
| `templateAdmission` declared AFTER `soulDeliverable` | yes | `:232` > `:172` |
| `grep -c "dangerouslySetInnerHTML"` in `libraryVocabulary.ts` | 0 | **0** |

## The cost of D-21, restated plainly

**The card mark will be visible on exactly ONE published row in the local library —
`ephemeral-template-fill-101uat`.** That is not a defect of the implementation; it is the
measured consequence of the only predicate that is honest on all 145 rows. Scoring:
**1 admits / 34 does-not-admit / 110 unknown**. The 16 rows the simpler predicate would have
marked all bind a library template, so `_exec_llm_emit`'s Branch 1 returns unconditionally and
the run-time upload is unreachable code on them — the mark would be false and the label would
promise what the engine discards.

⚠ **SC#3's G-4 UAT row MUST be driven against `ephemeral-template-fill-101uat`.** A scoreboard
that drives any other published row cannot see this feature at all and would report a false
negative with every gate green.

The `unknown` arm is the load-bearing one: 110 of 145 published rows (76 %) carry `phases: []`,
a stub nobody authored. Without that arm, D-17 would strip the shipped WFIN-01 upload control
from three-quarters of the library.

## Deviations from Plan

**None.** The plan executed exactly as written. Three notes that are records, not deviations:

1. The worktree base correction above is the documented protocol firing, not a plan change.
2. `eslint src/components/workflows/` reports 10 problems. All ten pre-date this plan (the
   tail one is `StepTypePicker.test.tsx:1219`), the plan's own bar is `≤ 10`, and per the
   scope-boundary rule they are not mine to fix.
3. The count gate reports increases on `ExternalActionSection.test.tsx` (+9) and
   `PhaseTimeline.test.tsx` (+4) that this plan did not author — inherited drift on the base.
   Per the plan's own instruction, **the pin was NOT raised here**; `193-11` owns the sweep,
   and a count increase is drift rather than a gate failure.

## Corrections recorded in code (inherited claims that measure false)

- **D-13's cited enforcement is wrong and is corrected at the string's own docblock.** D-13
  justifies the plain-text ruling by citing the 188.2 two-badge ceiling and its
  `@ts-expect-error` control. That control guards the CANVAS `PhaseNodeCard`; **there is no
  badge ceiling of any kind under `library/`.** The ruling STANDS on SEED-155 / UAT U8 — a
  sketch that drew a chip the card could not render — and the docblock says so, explicitly
  forbidding any future claim that a typecheck enforces it.
- **The build contract's own signal does not exist in the data.** The contract, the sketch
  README and CONTEXT's `<canonical_refs>` all describe the fill signal as *"admits
  `render_template` in the phase tool whitelist"*; that field matches **0 of 223** live
  definitions. The correction is stated at the top of the predicate's docblock rather than
  quietly worked around, so the next reader sees what was believed and what changed it.

## Known Stubs

None. Both exported strings are complete values, and the predicate has no placeholder arm.
The two strings have no consumer yet **by design** — `193-06` and `193-07` own that, and the
plan explicitly forbids adding one here.

## Threat Flags

None. No new network surface, no auth path, no file access, no schema change. The only new
trust-boundary read is `definition.assets[].kind`, which is registered in the plan's own
threat model as T-193-07 (`accept`) and is never rendered or interpolated — the predicate
returns a **closed union**, so no definition-derived string can reach the DOM through it.

## Self-Check: PASSED

- `frontend/src/components/workflows/soulData.ts` — FOUND (255 L)
- `frontend/src/components/workflows/soulData.test.ts` — FOUND (408 L)
- `frontend/src/components/workflows/library/libraryVocabulary.ts` — FOUND (514 L)
- commit `05b99ee4` — FOUND
- commit `3c7039ce` — FOUND
- commit `d81bc2d8` — FOUND
- `.planning/STATE.md` / `.planning/ROADMAP.md` — **not modified** (orchestrator owns them);
  no `gsd-sdk query state.*`, `requirements.mark-complete` or `roadmap.*` verb was invoked.
