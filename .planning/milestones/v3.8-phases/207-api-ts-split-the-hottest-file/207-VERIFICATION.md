# Phase 207 — verification

**Date:** 2026-08-25 · **Commit:** `48ca158b`
**Verdict: 5 / 5 success criteria met, one with a declared deviation.**
**✅ The owed live smoke was DRIVEN on 2026-08-25 and passed — see the bottom of this file.**

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
- ⚠ ~~**Asserted, not driven:** that no runtime behaviour changed. **No application was launched and
  no browser drive was run for this phase.** The argument is structural — every block was emitted
  verbatim, the export set is identical, and 5,755 tests pass — but that is an argument, not an
  observation.~~ **✅ DISCHARGED 2026-08-25 — see *Live smoke* below.** The original is struck
  through rather than deleted, because the gap was real when it was written.

---

---

## ✅ Live smoke — DRIVEN 2026-08-25, discharging owed item 2

**Driver:** `scripts/smoke_phase_207_api_split.py` (committed, re-runnable). Headless Chromium against
the live backend and the live app, authenticated as the org admin through a Supabase magic link.

⚠ **Why an argument was not enough.** `tsc` type-checks; it does not RESOLVE modules the way Vite does
at runtime. A circular import between the 12 new modules, a barrel re-exporting a name no module
declares, or an `import.meta.env` read evaluated in a new order — **none of those is a type error, and
all of them are a blank page.**

### Result

```
backend calls observed : 56
HTTP >= 400            : 0
console errors         : 0
uncaught page errors   : 0
split-specific signatures: 0
SMOKE PASS — every surface called its api modules and got 200.
```

| Surface | api modules exercised | calls | verdict |
|---|---|---|---|
| Chat | `threads`, `settings` | 31 (initial load) | ✅ OK |
| Documents | `documents` | 11 | ✅ OK |
| Workflows | `workflows`, `schedules` | 4 | ✅ OK |
| Skills | `skills` | 2 | ✅ OK |
| Settings | `settings`, `admin`, `connectors` | 8 | ✅ OK |

`_core` is exercised by every row — every call goes through `getAuthHeaders`. The rendered body
carried **real database content** (thread names from actual runs), not a cached shell.

⚠ **THE FIRST RUN SCORED CHAT AS `NO-CALLS`, AND THE HARNESS WAS WRONG, NOT THE APP.** Chat is the
DEFAULT view and is already loaded, so clicking its nav re-selects an active view and issues nothing
new. It is now scored against the INITIAL-LOAD window — **a stronger reading, not a weaker one**: those
31 calls are the very first thing the split has to survive. Recorded because "adjust the test until it
is green" is the failure mode this correction most resembles, and the distinction is the evidence.

### ⚠ The smoke was DRIVEN RED before it was believed

Two real split failures were planted, each run, then restored **md5-identical** (`api.ts`
`7a85deac6a36`, `_core.ts` `9523d80ef697` — before and after), with the smoke green again afterwards:

| plant | caught? | how it presented |
|---|---|---|
| the barrel re-exports a symbol no module declares | ✅ exit 1 | `FATAL: the app rendered an EMPTY BODY` |
| a domain module path no longer resolves | ✅ exit 1 | `FATAL: the app rendered an EMPTY BODY` |

⭐ **Both plants took the WHOLE APP down, not one surface** — because every screen loads through this
module. **That is the measured blast radius of a barrel mistake, and it is exactly why this smoke was
owed rather than optional.**

---

## Owed

1. **An independent verification pass**, by a session that did not do the work.
2. ~~A live smoke of the app.~~ ✅ **DISCHARGED 2026-08-25** — driven above, and driven RED first.
3. **A guard for D-207-06** — nothing stops a symbol being exported from a module and forgotten in the
   barrel, which typechecks perfectly and is invisible to every consumer. ⚠ **The smoke does NOT cover
   this**: a forgotten export is a missing name, not a broken one, so nothing throws and the page
   renders. It stays owed.
