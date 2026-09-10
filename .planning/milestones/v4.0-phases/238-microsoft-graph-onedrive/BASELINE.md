# Phase 238 — Baselines, captured BEFORE the first edit

**Captured:** 2026-09-07, quiet tree, no sibling agent, before any file was touched.

⚠ **This file was written at the phase CLOSE, not at its start.** The *measurements* below are
genuine and were taken before the first edit — the raw captures are in the session scratchpad and
their figures are quoted verbatim in every commit that followed. What is retrospective is the
file, not the numbers. Said plainly because a baseline written afterwards is exactly the kind of
artifact that could be back-fitted to whatever happened, and this one was not.

## Backend

```
pytest tests/unit -q --continue-on-collection-errors      (backend/, venv)

71 failed, 3971 passed, 2 xfailed, 2 xpassed, 45 warnings, 0 collection errors
```

**Exactly at the CLAUDE.md ceiling of 71. Zero headroom.**

⭐ **Captured as a NAME SET, not a count** — all 71 `FAILED` node ids extracted and sorted to
`backend-baseline-failset.txt`. Every later gate run in this phase was diffed with `comm -13`
against that set rather than compared by number, because **a count hides a swap**: 71 failing
tests where one is new and one is fixed reads identically to 71 unchanged.

That discipline paid: the phase ran the full gate five times and the name-set diff was **empty in
both directions every time**, which a count alone could never have established.

| When | Result | New failures |
|---|---|---|
| baseline | 71 failed / 3971 passed | — |
| after 238-02 | 71 failed / 4010 passed | none |
| final tree | 71 failed / 4015 passed | none |
| after import-path fix | 71 failed / 4016 passed | none |
| after disable guard | 71 failed / 4026 passed | none |

## Frontend

```
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs      (from the repo root)

  total 7816  ·  failed 0  ·  pinned total 7020
count gate OK — 241/241 pinned files present, no per-file decrease, 0 failing.
```

Close: `total 7822 · failed 0 · pinned total 7026 · 242/242` — **+6, exactly the one suite this
phase added** (`sourceCapability.test.ts`).

⚠ **CLAUDE.md's figures were stale by a sixth rot** — its last correction (2026-08-28) records
`6355 / 5266 / 120`. Corrected in place at this phase's close, beside the old figures rather than
over them. The **pinned-file count doubled** (120 → 241), so this rot is adoption, not drift.

```
npx tsc -p tsconfig.app.json --noEmit      ->  66 errors   (the Phase 232 baseline; unchanged at close)
```

## Known red, inherited and NOT this phase's

⚠ **`src/components/sources/sourceComposition.test.tsx` — `16 failed | 33 passed`.** In **neither**
count-gate knob by a Phase 235 decision: pinning a red suite turns the shared gate red, and
pinning it with an allowance makes a gate that cannot fail. Red before this phase, red after;
nothing in it asserts anything 238 touched.

## Guardrails at the start

```
node scripts/check-hot-file-ledger.cjs 238   ->  5 files with NO row (all added; 4 absent for their entire lives)
node scripts/check-claude-md-size.cjs        ->  81,332 chars, 54.2% of limit
node scripts/check-gap-closure-rounds.cjs    ->  G-7 clear, 0 gap-closure plans
```
