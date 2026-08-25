# Phase 207 — verification

**Date:** 2026-08-25 · **Commit:** `48ca158b`
**Verdict: 5 / 5 success criteria met, one with a declared deviation.**

⚠ **THIS IS NOT AN INDEPENDENT PASS.** The executor and the verifier are the same session, which is
the weaker of the two shapes this repo uses — Phase 206.3 got an independent one and it found things.
Treat every ✅ below as *executor-verified with published evidence*, and see *Owed* at the bottom.

---

## Success criteria

| SC | Verdict | Evidence |
|---|---|---|
| **1 — `api.ts` under 500 lines, re-exports only** | ✅ MET | **412 lines.** A parse of the barrel with comments stripped finds **0** lines that are not an `export {` / `} from` / a bare name — printed as `non-re-export lines in api.ts: 0`. |
| **2 — every symbol still exported, asserted by DIFFING the list** | ✅ MET | **325 before, 325 after; `lost: none`, `gained: none`.** The before-set is parsed from the pre-split file (`/tmp/api.ts.before`), the after-set from the barrel's re-export clauses, and the check asserts there is no single-line `export {…} from` form it could have missed. ⚠ **`gained: none` is half the criterion** — `export *` would have leaked three previously-private helpers into the public surface, and a widened surface is a silent change too. |
| **3 — no call site outside `lib/` changes** | ✅ MET **in substance**, ⚠ **one line short of the literal** | `git status` over `frontend/src/` shows 6 entries; **the only two outside `lib/` are source-sweeping fences**, each `+1 / −1`, and each changed line is asserted mechanically to be the `?raw` sweep and nothing else. **Not one API call site changed.** See the deviation below. |
| **4 — count gate green, no per-file decrease; `vi.mock` census unchanged** | ✅ MET | `count gate OK — 114/114 pinned files present, no per-file decrease, 0 failing.` · `total 5755 · pinned total 5180` — identical to the handoff baseline. Census: **108 files / 118 call sites, path `@/lib/api` on all 118** — unchanged in count AND in path. |
| **5 — the ledger records the split as TAKEN, retiring the trigger** | ✅ MET | Row reads `✅ **SPLIT TAKEN (207)** — 12 domain modules under \`lib/api/\`, this path kept as a re-export barrel. The trigger is RETIRED, not re-declined`, triple re-derived to `182 / 105 / 412`. Narrative in `docs/HOT-FILE-LEDGER.md` in the same commit. |

Supporting baselines: `tsc -p tsconfig.app.json` → **34 errors = baseline**, with **zero inside
`lib/api/`**; the one error in `src/lib/api.test.ts` is pre-existing and that file is `git`-clean.

---

## The declared deviation on SC#3, stated rather than reinterpreted

SC#3 reads, verbatim: *"A `git diff --numstat` over the phase shows zero lines changed in any file
that imports from `@/lib/api`."*

- `frontend/src/pages/WorkflowBuilderPage.header.test.tsx` **does** import from `@/lib/api`
  (`:136`, `import type { EffectiveFeatures }`) **and it changed by one line.**
- That line is not the type import. It is the file's `@/lib/api?raw` **source sweep**, repointed
  because the source moved. The type import is untouched and still resolves through the barrel.

**I am not claiming the criterion was met as written.** It was missed by one line in one file. The
property behind it — *no consumer has to change because of how it calls the api* — holds completely,
and is asserted separately: both fence diffs are exactly `+1 / −1` and both changed lines match the
sweep, checked against `git diff -U0` rather than asserted.

**Why the alternative was worse:** leaving the fences pointed at the barrel meant either three red
suites forever, or lowering their non-vacuity thresholds — and two of those thresholds exist purely
to prove the sweep read something. A relaxed threshold leaves the fence green and blind.

---

## What was driven, and what was only asserted

- ✅ **Driven:** the 8 fence failures were observed RED, then observed green (117/117) after
  repointing. The two scanner bugs were both surfaced by `tsc` (196 errors, then 1) and re-measured
  to 34 after each fix.
- ✅ **Driven:** the full count gate, twice — red at `failed 8` before the fences were repointed,
  `failed 0` after.
- ⚠ **Asserted, not driven:** that no runtime behaviour changed. **No application was launched and no
  browser drive was run for this phase.** The argument is structural — every block was emitted
  verbatim, the export set is identical, and 5,755 tests pass — but that is an argument, not an
  observation.

---

## Owed

1. **An independent verification pass**, by a session that did not do the work.
2. **A live smoke of the app.** The split touches the module every screen loads through; a single
   real page load would convert the structural argument into an observation. ⚠ *Recorded as owed, not
   quietly skipped.*
3. **A guard for D-207-06** — nothing stops a symbol being exported from a module and forgotten in the
   barrel, which typechecks perfectly and is invisible to every consumer.
