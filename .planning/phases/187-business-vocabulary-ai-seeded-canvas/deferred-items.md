# Phase 187 — deferred items (out-of-scope discoveries)

Logged by executors during execution. Not fixed in the plan that found them.

---

## D-ITEM-01 — `npx tsc -b` is NOT clean at HEAD (33 pre-existing errors)

**Found by:** plan 187-04, task 1 (2026-08-02)
**Status:** deferred — out of scope, zero delta from this phase so far

`187-RESEARCH.md:1769` and every 187 plan's acceptance criteria state *"`npx tsc -b`
exits 0"*. **Measured: it exits 2 with 33 `error TS` lines.** The claim was inherited,
never run. (The v3.3 lesson it cites — `tsc -b` ≠ `--noEmit` — is real; the *clean*
part is not.)

**Zero of the 33 errors are in `src/components/workflows/`.** Owners:

| Area | Sample |
|---|---|
| `src/pages/SettingsPage.tsx` / `.test.tsx` | `SettingsUpdate` missing `web_search_enabled`; `FullAppSettings` optional-vs-required drift |
| `src/providers/OrgProvider.test.tsx` | `OrgPermissions.can_manage_sso` missing from a test fixture |
| `src/providers/StreamsProvider.tsx` | unused `getActiveRuns` (TS6133) |
| `src/stores/streamsStore.ts` | `StateCreator` / `viewedThreadId: null` widening |

**How 187 plans should read the criterion:** treat it as *"`tsc -b` produces no NEW
error, and none inside the files the plan touches"* — measure the count before and
after (`npx tsc -b 2>&1 | grep -c 'error TS'`) rather than gating on exit 0, which
cannot pass today for reasons no 187 plan owns.

**Re-open trigger:** a dedicated frontend type-hygiene phase, or the first 187 plan
that touches `SettingsPage` / `StreamsProvider` / `streamsStore` and can fix its own
row cheaply.

---

## D-ITEM-02 — `scripts/vitest-count-gate.cjs` fails on WHOLE-GLOB concurrency flake

**Found by:** plan 187-16, post-task-2 verification (2026-08-02)
**Status:** deferred — out of scope, not caused by 187-16

The count gate runs the whole Wave-0 blast radius in one vitest invocation and reports
`failing-tests`. Measured on two consecutive runs of the same tree: **8 failed, then 7
failed** — a differing count with no edit between them, which is the signature of
cross-file interference, not a deterministic break.

| File | Failing cases |
|---|---|
| `PublishGauntlet.test.tsx` | 5 (the form / verdict / judge-wall block) |
| `WorkflowCanvas.test.tsx` | 2 (`has no axe violations …`) |

**Evidence it is not 187-16's:** both files pass ISOLATED; both pass run together; both
pass run together **with** `SeedReceipt.test.tsx` (128 passed). The 5-file consumer set
named in 187-16's verification is 447 passed / 0 failed. Per-file counts only grew
(`SeedReceipt.test.tsx` 33 → 47, `definitionOps.test.ts` 223 → 227), and neither file is
in the gate's `BASELINE` map, so no pin moved.

**How 187 plans should read it:** the plan-level verification blocks already say to run
the consumer set ISOLATED "never the full frontend suite, which is measured flaky at
42–49". The gate's `failing-tests` reason inherits that flake; its per-file COUNT
reasons remain trustworthy and are the part D-184-08 actually pins.

**Re-open trigger:** a test-infra phase that isolates the `axe` and `PublishGauntlet`
suites (e.g. `poolOptions.threads.singleThread` or per-file environments), or the first
plan whose own changes make the gate red in isolation.
## D-ITEM-187-20-01 — PublishGauntlet.test.tsx parallel-run flake (found by plan 187-20)

`node scripts/vitest-count-gate.cjs` exits 1 with a single `[failing-tests]` reason. Two cases
in `frontend/src/components/workflows/PublishGauntlet.test.tsx` fail only under the full
parallel blast-radius run:

- `the 4 HTTP outcomes each render distinctly`
- `named_failures key-detection: a MIXED list (lint dict + bare string) renders the lint row (lowercase code) AND the bare string as a block — the verdict is a block, never a pass`

PROVED PRE-EXISTING, not assumed: the four files plan 187-20 edits were restored to
`debced07~1` and the gate re-run — total 2075, failed 1, same two cases. The file passes
GREEN in isolation and the failure count varies run to run (2, then 1). It imports nothing
from `definitionOps` or `SeedReceipt`.

Not fixed: outside plan 187-20 scope. Owner: whichever phase next touches PublishGauntlet,
or a dedicated flake-hunt. The gate reports no `[count-decrease]`, no `[missing-file]` and
no `[total-below-baseline]`, so it is not masking a coverage loss.

---

## D-ITEM-187-23-01 — `GROUNDING_WHY_ESCALATED` carries the SAME second-person claim WR-11 just removed from the receipt row

**Found by:** plan 187-23, task 1 (2026-08-03)
**Status:** deferred — the plan's action says "Change nothing else in this file"

```
frontend/src/components/workflows/definitionOps.ts:475
export const GROUNDING_WHY_ESCALATED = "Because you turned this on by hand."
```

This is the *panel's* why-line for the grounding dial, not the receipt row. Plan 187-23
retired the identical claim from `seedReceiptStepReason("escalated")` because the input
(`grounding_escalated`, a boolean) records **that** the lock is authored and never **who**
authored it — and because a model emission can carry that bit (measured: it is in
`WF_SCHEMA`, `model_validate`s, and is returned verbatim by `POST /generate`). The same
argument applies verbatim to this constant: on a model-emitted escalation the panel tells a
user who clicked nothing that they turned the lock on by hand.

It is **not** identical in context — the panel line renders beside the dial the author is
operating, so on the ordinary path the reader has just done the act — which is why it is a
weaker case than the receipt row and was scoped out rather than swept in.

**Re-open trigger:** the next plan that touches the grounding dial's copy or
`PhaseFormPanel`'s governance section, or any plan that adds a governance-provenance bit of
the `name_seeded_by_ai` shape (which would make the second person legitimate again, gated).

---

## D-ITEM-187-23-02 — bare `npx tsc --noEmit` in `frontend/` is a VACUOUS check

**Found by:** plan 187-23, task 1 (2026-08-03)
**Status:** informational — affects how every 187 plan's typecheck criterion must be read

`frontend/tsconfig.json` is a SOLUTION file: `{"files": [], "references": [...]}`. So
`npx tsc --noEmit` from `frontend/` checks **zero files** and exits 0 with no output — it
cannot reproduce D-ITEM-01's 33 errors and cannot detect a new one either.

Measured at HEAD, 2026-08-03:

```
$ npx tsc --noEmit                      → exit 0, 0 error lines   (vacuous)
$ npx tsc --noEmit -p tsconfig.app.json → exit 2, 33 error lines  (the real baseline)
```

**How to read the criterion:** `npx tsc --noEmit -p tsconfig.app.json` is the command that
means what the plans intend. (Plan 187-22 already used this form.) The recorded project
lesson `tsc -b` ≠ `--noEmit` still holds; this is a second, separate trap in the same area.

---

## D-ITEM-187-24-01 — `groundingCauseOf` reads `phase.config` UNGUARDED, against its own module's totality contract

**Found by:** plan 187-24, task 1 (2026-08-03)
**Status:** deferred — widening it would change a shipped export's behaviour, which
threat-register entry `T-187-R4-13` accepted its risk on the explicit basis that 187-24's
change to `phaseVocabulary.ts` is purely additive

```
frontend/src/components/workflows/phaseVocabulary.ts
  groundingCauseOf:  const rawTools = phase.config.available_tools      ← unguarded
  nodeTitle:         const type = phase.config?.phase_type ?? ""        ← guarded
  derivedFaceOf:     const config = phase.config ?? { phase_type: "" }  ← guarded
```

The module's header states *"every exported resolver is TOTAL … the definition JSONB is
author-supplied and a projection must not crash on it"*. Two of the three phase-shaped
resolvers honour that on `config` itself; `groundingCauseOf` does not, and 187-24's new
`intersectingKbToolOf` deliberately MIRRORS it rather than diverging (a defensive guard on
one of two functions called one line apart is unreachable theatre — round-2 WR-04's finding,
re-confirmed here).

`PhaseSpecJSON.config` is typed REQUIRED, so this is only reachable from a hand-edited or
legacy JSONB row that TypeScript never saw. Not a live defect; a totality gap with a stated
contract behind it.

**Re-open trigger:** the next plan that may change a shipped `phaseVocabulary` export's
behaviour — add `phase.config ?? { phase_type: "" }` to `groundingCauseOf` and
`intersectingKbToolOf` in the same commit, so the two keep reading identically, and extend
the WR-14 agreement table with a config-less phase.

