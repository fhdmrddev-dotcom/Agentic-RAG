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

