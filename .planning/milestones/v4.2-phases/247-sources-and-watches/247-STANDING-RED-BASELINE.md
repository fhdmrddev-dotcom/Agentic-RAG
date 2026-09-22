# 247 — the standing-red baseline, as a SET

**Measured by:** Claude (reviewer), 2026-09-14, plan-gate review.
**Tree:** `frontend/` and `backend/` **byte-identical** to `247-PREFLIGHT.md`'s base `987e7a685` —
verified with `git diff --name-only 987e7a685..HEAD -- frontend backend`, which returns **empty**.
Every commit since that base touches only `.planning/`, `.agent-bus/` and `scripts/`.

**Command:** `CI=1 npx vitest run src/components/sources/sourceComposition.test.tsx`, from `frontend/`.

---

## Why this file exists

`247-PREFLIGHT.md` §3 pins the contract as:

> **Result: 17 failed | 32 passed (49 total)** … The failure count must remain strictly at
> **17 failed | 32 passed** (no regression).

⛔ **That number does not reproduce, and a criterion that cannot pass is not a contract.** Four
distinct readings of this one suite now exist, and the last three were taken minutes apart on an
unmodified tree:

| Reading | Source |
|---|---|
| 16 failed / 33 passed | `CLAUDE.md`, original |
| **18 failed / 31 passed** | `CLAUDE.md`, re-measured 2026-09-08 (recorded there as a correction, original struck through, not deleted) |
| **17 failed / 32 passed** | `247-PREFLIGHT.md` §3, 2026-09-14, at `987e7a685` |
| **16 failed / 33 passed ×3** | this review, 2026-09-14, three consecutive runs, same tree |

The total is **49** in all four. The failing count moves between **16 and 18**.

⭐ **It is not flaky WITHIN a session** — three consecutive runs here returned an identical 16/33.
It does not reproduce **ACROSS** runners or sessions. That is the worse property for a gate: a plan
measures a stable number, writes it down as a contract, and the next runner fails it having changed
nothing.

⚠ **This is the same class as `SEED-274`**, planted the same day for the backend ceiling (71 / 72 /
72 / 77 on one tree, against a gate CLAUDE.md declares to have *zero headroom*). **Two gates in this
project are pinned to an integer over a value that moves.** The remedy is identical and it is not a
bigger number.

---

## The contract that survives — the failing SET

**16 failing tests, captured from vitest's own JSON reporter**, sorted:

| # | Failing test |
|---|---|
| 1 | `§3 every block the sketch draws` · rail renders the **`badge`** block |
| 2 | `§3 every block the sketch draws` · rail renders the **`pop-item`** block |
| 3 | `§3 every block the sketch draws` · rail renders the **`popover`** block |
| 4 | `§3 every block the sketch draws` · sources renders the **`fail-reason`** block |
| 5 | `§3 every block the sketch draws` · sources renders the **`history`** block |
| 6 | `§3 every block the sketch draws` · sources renders the **`instance-statement`** block |
| 7 | `§3 every block the sketch draws` · sources renders the **`quiet-fold`** block |
| 8 | `§3 every block the sketch draws` · sources renders the **`run`** block |
| 9 | `§3 every block the sketch draws` · sources renders the **`tab-health`** block |
| 10 | `§3 every block the sketch draws` · sources renders the **`tab-ingestion`** block |
| 11 | `§4 every named control` · rail offers the **`badge`** control |
| 12 | `§4 every named control` · rail offers the **`open-health`** control |
| 13 | `§4 every named control` · sources offers the **`report-source`** control |
| 14 | `§4 every named control` · sources offers the **`toggle-quiet`** control |
| 15 | `§5 the counts that must hold` · a collapsed history shows 3 `run` rows; expanded … |
| 16 | `§5 the counts that must hold` · ⭐ the reader-off statement appears EXACTLY ONCE, never per row |

### The contract to use instead of a count

> **No test OUTSIDE this 16-name set may fail.** A run reading 17 or 18 failed is acceptable **only
> if every extra name is already in this table** — i.e. it is one of the ±2 that moves between
> runners. A failing name **not** in this table is a real regression and blocks the plan.

That is checkable, survives a different runner, and still catches an actual break — which the
integer does not.

⚠ **Capture the set BEFORE any re-run.** This project has already recorded a plan that broke that
rule and could afterwards not prove its own cases were innocent (`193.2-02`).

---

## What is NOT claimed here

- ⛔ **No opinion on whether these 16 should be fixed.** They are inherited by a Phase 235 decision
  (pinning a red suite turns the shared gate red; pinning it with an allowance makes a gate that
  cannot fail). That decision stands and 247 is not its re-opening.
- ⛔ **No claim that 16 is the "true" number.** The point of this file is that **there is no true
  number** — there is a true set, and it is above.
- This suite is in **neither** count-gate knob, so none of this is visible to
  `scripts/vitest-count-gate.cjs`. It is invisible to the verdict line, which is exactly why it
  needs a written baseline.
