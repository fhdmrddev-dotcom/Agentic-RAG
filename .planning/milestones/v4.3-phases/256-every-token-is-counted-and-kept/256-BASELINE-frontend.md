# Phase 256 — FRONTEND count-gate baseline at `772f53354`

**Captured:** 2026-09-18 · **Command:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`
(repo root) · **Discharges:** `256-CONTEXT.md` D-256-14

> ⛔ **THE HEADLINE IS NOT A NUMBER — IT IS THAT THERE ARE TWO.** Two runs, **byte-identical tree**,
> **different verdicts.** One green sample is not proof of innocence and one red sample is not proof
> of a defect. Both readings are published; neither is deleted.

---

## 1 · The two readings

| | **Run A** — 20:11 | **Run B** — 20:36 |
|---|---|---|
| grand total | 8414 | **8414** |
| pinned total | 7674 | **7674** |
| pinned files | 289 / 289 | **289 / 289** |
| **failed** | **3** | **0** |
| `numFailedTestSuites` | 4 | 0 |
| verdict line | `COUNT GATE VIOLATED (1 reason)` | `count gate OK` |

**The tree did not move between them.** `git log --since="2026-09-18 20:00" -- frontend/` returns
**nothing**, and `git status --short frontend/` is clean. The only commits in the window are
`a392a6389` (20:32, `.planning/`) and `33c0c1ea9` (20:33, `.planning/STATE.md`) — neither is inside
the gate's `TARGETS`.

⚠ **Every count except `failed` agrees exactly.** The gate's contract is *no per-file DECREASE* and
*zero failing*; Run A satisfied the first and failed the second. The `1 reason` was the failures,
not a decrease.

---

## 2 · Run A's failing SET — recovered, not re-run

⛔ **The wrapper that produced Run A kept only `done EXIT=1`** — the filenames were thrown away,
which is precisely the `feedback_capture_the_set_never_a_tail` failure. They were recovered from the
gate's **own persisted JSON report** (`os.tmpdir()/vitest-count-gate-<pid>-<ms>.json`, written by
`runVitest()` at `scripts/vitest-count-gate.cjs:5578`), read **before** anything was re-run — the
procedure CLAUDE.md prescribes verbatim.

```
WorkflowBuilderPage.canvas.test.tsx :: WorkflowBuilderPage canvas door — flag ON (D-183-01)
    clicking Canvas flips aria-selected and mounts the canvas; clicking Spine returns
sketchComposition.test.tsx :: sketch-composition fence — §2 positive controls
    the four shipped tab triggers render — the tab bar is already built
sketchComposition.test.tsx :: sketch-composition fence — §2 positive controls
    the page renders its heading — the mount harness works
```

**Run B's failing set is empty.**

### Reading the set

- **`WorkflowBuilderPage.canvas.test.tsx` is one of `SEED-171`'s FIVE named cap-independent flaky
  suites** (`WorkflowsPage.test.tsx` · `library/WorkflowCard.test.tsx` ·
  `WorkflowBuilderPage.session.test.tsx` · `WorkflowRunPage.test.tsx` ·
  `WorkflowBuilderPage.canvas.test.tsx`). It is in the register precisely because it does this.
- ⚠ **`sketchComposition.test.tsx` is NOT in that set — it is a SIXTH**, and it is named here rather
  than left silent. Both of its failures are the suite's **own POSITIVE CONTROLS** — *"the mount
  harness works"*, *"the tab bar is already built"*. A positive control failing means the **mount
  died**, not that an assertion was wrong; that is the identical signature `196-05` recorded when
  `WorkflowBuilderPage.canvas.test.tsx` failed its own positive control with
  `AssertionError: expected 0 to be greater than 0`.
- ⚠ `numFailedTestSuites` reads **4** while `numFailedTests` reads **3** — a fourth suite failed
  above the test level, so no assertion of its own was recorded. Named as an observation; not chased.

---

## 3 · What this phase may and may not conclude

- ⛔ **256 is a BACKEND-ONLY phase.** This baseline exists for exactly one purpose: to let a red
  frontend gate during the phase be proven **INHERITED** rather than caused. A verdict alone cannot
  do that — a SET can.
- ⛔ **Do NOT quote `failed 0` as "the frontend gate is green at base."** It is green on one sample
  and red on another, on the same bytes. The honest statement is: **`count gate OK` is not reliably
  reachable on demand at this base**, which is CLAUDE.md's own standing finding.
- ⛔ **Do NOT reach for the worker cap** if the gate reds during the phase. `GSD_VITEST_MAX_WORKERS=2`
  was set on **both** runs here, and SEED-171 refutes the cap as the remedy. Capture the filenames
  from the persisted JSON **first**, check each against `git diff --numstat 772f53354 HEAD`, and if a
  named file is byte-unchanged, record it as an observation and move on.
- ⛔ **Say "provably unmodified", never "fine."**

---

## 4 · ⚠ The published count-gate figures have ROTTED A SEVENTH TIME

CLAUDE.md's most recent correction (2026-09-07, Phase 238) records
**`total 7816 · pinned 7020 · 241/241`**. Measured here, eleven days later:

| | CLAUDE.md says (2026-09-07) | **measured 2026-09-18** |
|---|---|---|
| grand total | 7816 | **8414** |
| pinned total | 7020 | **7674** |
| pinned files | 241 / 241 | **289 / 289** |

**A growing number is the gate WORKING** — its contract is *no per-file decrease* and *zero failing*,
never a fixed grand total. `+48` pinned files is **adoption**, the desirable direction, and must not
be read as drift. ⛔ Recorded here rather than silently; whether CLAUDE.md's §"Parallel execution"
trajectory gains this row is an operator call, since that file is under a 150,000-character gate.

### The five newly-adopted suites this run reports as `new`

`PromptVariableChips.test.tsx` (3) · `RunHero.test.tsx` (18) · `automationFacts.test.ts` (11) ·
`nodeEffectBanner.test.ts` (8) · `toolReadOnlyMap.test.ts` (7). One pinned file moved:
`MessageInput.connectors.test.tsx` `5 → 9` (`+4`).

---

## 5 · Backend baseline, for the pair

**71 failing, set committed** at `256-BASELINE-backend-failing-set.txt` (71 lines, verified by
`grep -c`). That is the CLAUDE.md ceiling **with zero headroom**. ⛔ Diff the **set**, never the
count — a backend baseline was once published as 71 when the truth was 72.
