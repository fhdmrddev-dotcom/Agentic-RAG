# Vitest count gate — measured history and corrections

Companion to **rule 2** of `CLAUDE.md` → `## Parallel execution — worktrees are ENABLED (MANDATORY rules)`,
which holds the **verdict**: the cap, the re-derive command, the gate's contract, the triage procedure, the
vacuous-typecheck warning and the planning consequence. This file holds the **measured history** behind it —
every dated correction recorded beside its original, the trajectory tables, the SEED-171 causal refutation
and the standing `sourceComposition` red.

Moved verbatim from CLAUDE.md on 2026-10-12 by Phase 277 (REG-04); nothing below was edited.

**Same-commit sync rule** (the `docs/SANDBOX-PACKAGES.md` / `docs/HOT-FILE-LEDGER.md` pattern): a change to
rule 2's verdict in `CLAUDE.md` and this file land in the **same commit**. A new correction is appended here,
beside its original — never written over it.

---

2. **Cap vitest workers in every run: `GSD_VITEST_MAX_WORKERS=2`.** ⚠ **This rule said `4` until
   2026-08-14, and the 4 was not wrong when written — it ROTTED, because the right cap is a
   function of how many test cases the gate executes, not a constant.** Both figures are kept so
   the drift is visible rather than overwritten.

   - **Why 4 was right at ~3400 gated cases:** two UNCAPPED concurrent vitest runs spawn ~16
     workers each on this 16-core box, and the oversubscription surfaces as bare timeouts in
     suites the plan never touched — `failed 6` and `failed 5` against a serial baseline of
     `failed 0`. Capped at 4 each, two concurrent runs agreed exactly (9 files / 23 tests
     failing, the known SEED-056 rot set, on both).
   - **Why 4 is wrong at 3600.** Phase 193 measured, on **one identical commit** (`STATE.md:136-140`):
     cap 4 → `failed` **17**, then **4**, then **3**; UNCAPPED → **11**; **cap 2 → 0 and 0.** Every
     failure was a `STACK_TRACE_ERROR` timeout in a file no plan had touched — the signature of
     oversubscription, never of a real defect. Confirmed independently by quick task `260814-q5r`:
     a single run at cap 2 → **exit 0, `failed 0`, total 3604**.
   - ⚠ **THE `3604` ABOVE IS STALE AND THE CORRECTED FIGURE IS RECORDED BESIDE IT, NEVER OVER IT —
     this constant has now rotted TWICE and the second rot took ONE DAY.** Measured at Phase 193.2's
     close (2026-08-15, quiet tree, main working tree, no sibling agent): **`count gate OK` · total
     3918 · failed 0 · pinned total 3868 · 75/75 pinned files present.** The intermediate readings
     are published too, because the *rate* is the point: **3604** (`260814-q5r`, 2026-08-14) →
     **3892** (`193.2-01`, 2026-08-15, `+288` in one day as Phase 193.1's eleven plans landed) →
     **3895** → **3899** → **3907** → **3911** → **3918** across Phase 193.2's own plans. **A growing
     number is the gate WORKING, not the gate breaking** — its contract is *no per-file DECREASE* and
     *zero failing*, never a fixed grand total, so a plan that sees a bigger figure than this
     paragraph quotes has seen the correct current one. Re-derive with
     `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` and read the verdict line, never a
     summary. ⚠ **Cap 2 held `failed 0` on the first run here, but it is NOT deterministic:**
     `193.2-03` measured `failed` **4, 11 and 6** on three consecutive runs of a tree whose frontend
     diff was **EMPTY**, while `193.2-04` and `193.2-06` each read `failed 0` first time with a
     sibling agent active. **Capture failing filenames BEFORE re-running anything** — `193.2-02`
     recorded itself breaking that rule and could not afterwards prove its three cases were innocent.

   **So: use 2, and RE-MEASURE when the gated total grows again** rather than trusting this number
   the way this rule asked you to trust the last one. `scripts/vitest-count-gate.cjs` reads the env
   var; absent, single-run behaviour is unchanged. The cap now matters on a SINGLE run too, not
   only on parallel ones — that is what changed. Also still true: at THREE concurrent test-running
   agents the gate goes non-deterministic regardless of cap, so keep it to ≤ 2.
   This is very likely what Phases 190-16/17/18 saw and misattributed to `userEvent` delay.

   ---

   ### ⚠ CORRECTION 2026-08-17 (Phase 195, plan `195-08`) — THE NUMBERS **AND** THE CAUSAL CLAIM. Both originals are preserved above, never overwritten.

   **(a) THE NUMBERS ARE STALE AGAIN — the third rot, and it took TWO DAYS.** Re-derived on the main
   working tree, quiet, no sibling agent, verdict line read verbatim rather than summarised:

   ```
     total                                      4096    4170     +74
     total 4170  ·  failed 0  ·  pinned total 4096
   count gate OK — 83/83 pinned files present, no per-file decrease, 0 failing.
   ```

   | | this rule says above | **measured 2026-08-17** |
   |---|---|---|
   | grand total | 3918 | **4170** |
   | pinned total | 3868 | **4096** |
   | pinned files | 75/75 | **83/83** |

   Phase 195's own trajectory, published because the *rate* is the point and it has not slowed:
   `3972 / 3898 · 75/75` (wave 1 baseline) → `4044` (+5 suites adopted) → `4136 · 82/82` →
   `4147` → `4150` → **`4170 · 4096 · 83/83`**, identical on three separate runs.
   **A growing number is still the gate WORKING.** ⚠ **Eight of this phase's nine suites were
   UNGATED before it started** — `TARGETS` had no entry for `src/components/chat`, `src/lib` or
   `src/components/panel` at all, so a green gate said nothing about four fifths of the phase.
   **Adopting a suite raises the total; that is the desirable direction and must not be read as drift.**

   ---

   ### ⚠ CORRECTION 2026-08-19 (Phase 192.2, plan `192.2-06`) — THE FOURTH ROT, AND IT TOOK TWO DAYS. Both prior sets of figures are preserved above, never overwritten.

   Re-derived on the main working tree — quiet, no sibling agent, run from the **repo root**, verdict
   line read **verbatim** rather than summarised:

   ```
     total                                      4328    4594    +266
     total 4594  ·  failed 0  ·  pinned total 4328
   count gate OK — 92/92 pinned files present, no per-file decrease, 0 failing.
   ```

   | | correction (a) above said (2026-08-17) | **measured 2026-08-19** |
   |---|---|---|
   | grand total | 4170 | **4594** |
   | pinned total | 4096 | **4328** |
   | pinned files | 83/83 | **92/92** |

   ⚠ **READ THE DATES: `4170` was 2026-08-17 and this is 2026-08-19 — TWO DAYS, and `+424` cases.**
   The rot before this took ONE day; the one before that, two. **The rate has not slowed, which is
   exactly why this section publishes a trajectory rather than a number.** Phase 192.2's own arc, with
   every increment attributed so none can be quoted as another: `4455 · 4328 · 92/92` (wave-1 baseline
   — and note the **pinned** total was ALREADY 4328 there, so the `+139` that follows is entirely NEW
   TEST CASES, not newly-adopted pins) → `4506` (`+24` characterization pin, `+22` `cardFace`, `+5`
   fence sweeps) → `4574` (`+52` `runFacts`, `+11` `cardFace`, `+5` sweeps) → **`4594`** (`+15`
   `WorkflowCard.test.tsx`, `+5` the pin's re-baseline). **Each step closes with no residual**, and
   that arithmetic is what distinguishes GROWTH from DRIFT — an unexplained `+n` is the thing to
   worry about, never a bigger number.

   **A growing number is still the gate WORKING.** Its contract is *no per-file DECREASE* and *zero
   failing*, **never a fixed grand total** — so a plan that reads a bigger figure than this paragraph
   quotes has read the correct current one. Re-derive rather than doubt it:
   `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, **from the repo root**, and read the
   verdict line, never a summary.

   ⚠ **A DELIBERATE FILE DELETION IS THE ONE THING THAT CAN LEGITIMATELY DECREASE THE TOTAL — AND IT
   DID NOT HERE, WHICH IS ITSELF THE FINDING.** `192.2-06` deleted `frontend/src/dev/SketchLibraryCard.tsx`
   (244 L) and its route registration in `main.tsx`. **No pinned file decreased and 92/92 still resolve**,
   because **no gated suite ever covered `src/dev/` at all**. So the gate could never have told anyone
   that a dev-only surface had outlived its sketch — **the teardown obligation was carried by a note in
   a sketch README and by nothing executable.** A plan that deletes a source file must therefore say
   which side of the gate it was on; silence reads as *"unchanged"* and means *"unwatched"*.

   ⚠ **THE CAP WAS NEITHER ADJUSTED NOR NEEDED.** It held at `2` on every run across all six plans of
   the phase, and nothing red ever appeared — so SEED-171's triage procedure was never entered.
   **Recorded as an observation, not as proof of innocence:** two of SEED-171's five named flaky suites
   (`library/WorkflowCard.test.tsx`, `WorkflowsPage.test.tsx`) sat inside this phase's blast radius and
   were EDITED by it, and both were green on the first run of every invocation.

   ---

   ### ⚠ CORRECTION 2026-08-28 (Phase 214, plan `214-15`) — THE FIFTH ROT, AND IT TOOK NINE DAYS. Every prior set of figures is preserved above, never overwritten.

   Re-derived on the phase's merge base — quiet tree, **no sibling agent**, run from the **repo root**,
   verdict line read **verbatim** rather than summarised:

   ```
     total                                      5266    6355   +1089
     total 6355  ·  failed 0  ·  pinned total 5266
   count gate OK — 120/120 pinned files present, no per-file decrease, 0 failing.
   ```

   | | correction of 2026-08-19 said | **measured 2026-08-28** |
   |---|---|---|
   | grand total | 4594 | **6355** |
   | pinned total | 4328 | **5266** |
   | pinned files | 92/92 | **120/120** |

   ⚠ **READ THE DATES: `4594` was 2026-08-19 and this is 2026-08-28 — NINE DAYS, and `+1761` cases.**
   The four rots before this took one, two, two and two days; **the rate has not slowed, and the gap
   here is a gap in RE-DERIVATION, not in growth.** That is the point of publishing a trajectory rather
   than a number: **a plan that reads a bigger figure than this paragraph quotes has read the correct
   current one.** Re-derive rather than doubt it, always from the repo root.

   ⚠ **`+1089` OF THE GAP IS UNPINNED SUITES, NOT NEW CASES** — the grand total exceeds the pinned total
   by exactly the suites nobody has adopted. Phase 214's close pinned **twelve** of them from the gate's
   own printed `— N new` figures; **six more remain unpinned and are named in `SEED-222` rather than
   left silent.** ⚠ **`WorkflowScheduleModal.test.tsx` was believed to be in NEITHER knob and that was
   MEASURED FALSE at this close**: the `src/components/workflows` **directory** entry recurses into
   `__tests__/`, so the gate had been RUNNING it and GUARDING nothing. **TARGETS decides what runs;
   BASELINE decides what is guarded, and a suite can sit on the wrong side of exactly one of them.**

   ---

   ### ⚠ CORRECTION 2026-09-07 (Phase 238) — THE SIXTH ROT, AND IT TOOK TEN DAYS. Every prior set of figures is preserved above, never overwritten.

   Re-derived on a quiet tree with no sibling agent, from the **repo root**, verdict line read
   **verbatim**, before the phase's first edit:

   ```
     total 7816  ·  failed 0  ·  pinned total 7020
   count gate OK — 241/241 pinned files present, no per-file decrease, 0 failing.
   ```

   | | correction of 2026-08-28 said | **measured 2026-09-07** |
   |---|---|---|
   | grand total | 6355 | **7816** |
   | pinned total | 5266 | **7020** |
   | pinned files | 120/120 | **241/241** |

   ⚠ **The pinned-file count DOUBLED — `120` → `241` — and that is the most useful number here.**
   The five earlier rots were mostly new cases inside already-pinned files; this one is mostly
   **adoption**, which is the desirable direction and must not be read as drift. Phase 238's own
   close re-measured `7822 · 0 failed · 7026 · 242/242` — `+6`, exactly the one suite it added.

   **A growing number is still the gate WORKING.** Its contract is *no per-file DECREASE* and
   *zero failing*, never a fixed grand total. Re-derive rather than doubt it:
   `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the repo root.

   ---

   ### ⚠ CORRECTION 2026-09-21 (Phase 262) — THE SEVENTH ROT, AND IT TOOK FOURTEEN DAYS. Every prior set of figures is preserved above, never overwritten.

   Re-derived on a quiet tree, `GSD_VITEST_MAX_WORKERS=2`, verdict line read **verbatim**:

   ```
     total 8500  ·  failed 0  ·  pinned total 7746
   count gate OK — 297/297 pinned files present, no per-file decrease, 0 failing.
   ```

   | | correction of 2026-09-07 said | **measured 2026-09-21** |
   |---|---|---|
   | grand total | 7816 | **8500** |
   | pinned total | 7020 | **7746** |
   | pinned files | 241/241 | **297/297** |

   **A growing number is still the gate WORKING** — the contract is *no per-file DECREASE*
   and *zero failing*, never a fixed grand total. ⚠ **The cap was neither adjusted nor
   needed, for the FOURTH consecutive close.**

   ---

   ### ⚠ CORRECTION 2026-09-22 (Phase 264, plan `264-04`) — THE EIGHTH ROT, AND IT TOOK ONE DAY. Every prior set of figures is preserved above, never overwritten.

   ```
     total 8676  ·  failed 0  ·  pinned total 7935
   count gate OK — 316/316 pinned files present, no per-file decrease, 0 failing.
   ```

   | | correction of 2026-09-21 said | **measured 2026-09-22** |
   |---|---|---|
   | grand total | 8500 | **8676** |
   | pinned total | 7746 | **7935** |
   | pinned files | 297/297 | **316/316** |

   ⛔ **READ THIS ONE DIFFERENTLY FROM THE SEVEN ABOVE: Phase 264 touched ZERO frontend source**
   (`git diff --stat e9d6a9410..HEAD -- frontend/` is EMPTY, measured). So `+176 / +189 / +19` is
   **not this phase's growth** — it is 263's landing, and the number was already stale when 264
   started. ⭐ **A figure can rot without anybody editing the thing it measures**, which is why the
   rule is *re-derive*, never *check whether you changed anything first*. `GSD_VITEST_MAX_WORKERS=2`
   held at `2` with `failed 0` first try, for the FIFTH consecutive close.

   ⚠ **THE CAP WAS NEITHER ADJUSTED NOR NEEDED, for the third consecutive close** — `2`,
   `failed 0` on both invocations. ⚠ And a standing red that is NOT a cap problem and NOT this
   phase's: **`src/components/sources/sourceComposition.test.tsx` sits at ~~`16 failed | 33 passed`~~
   **`18 failed | 31 passed`** (re-measured 2026-09-08; the original is struck through, not
   deleted — a standing-red figure that ROTS is how an inherited red gets mistaken for a new one)
   in NEITHER knob, by a Phase 235 decision** — pinning a red suite turns the shared gate red,
   and pinning it with an allowance makes a gate that cannot fail. It is invisible to the verdict
   line above, which is exactly why it is named here.

   ⚠ **AND THE CORRECTION ITSELF ROTTED BACK — measured 2026-09-16 (Phase 252). Both figures stand;
   neither is deleted, because the OSCILLATION is the finding.** Re-measured on a quiet tree,
   `GSD_VITEST_MAX_WORKERS=2`: **`16 failed | 33 passed (49)`** — the ORIGINAL, struck-through
   number, not the 2026-09-08 replacement. Confirmed independently by 252-03's executor, which
   proved it inherited by **measurement rather than by unchangedness**: the suite mounts a component
   that plan touched, so it checked those four source files out at the phase base (explicit paths
   only — no blanket reset, no `git clean`), re-ran, read an identical 16/33, and restored.
   ⭐ **The lesson is not "16 is right".** It is that this figure is **not stable**, so *"it matches
   what CLAUDE.md says"* proves an inherited red no more than *"it does not"* proves a new one.
   ⛔ **Establish inherited-vs-new by checking out the base and re-running — never by comparing
   against a number written here.**

   ---

   ⚠ **THE CAP WAS NEITHER ADJUSTED NOR NEEDED, for the second consecutive close.** It held at `2`,
   `failed 0` on every invocation, and **none of SEED-171's five cap-independent flaky suites went red
   — although three of them (`WorkflowsPage.test.tsx`, `WorkflowBuilderPage.canvas.test.tsx`,
   `WorkflowRunPage.test.tsx`) sat inside this phase's blast radius and were EDITED by it.** Recorded as
   an observation, never as proof of innocence: **one green sample of a flaky suite proves nothing.**

   ---

   **(b) ⚠ THE CAUSAL CLAIM ABOVE IS REFUTED, AND THIS IS THE CORRECTION THAT MATTERS —
   ADJUSTING THE CAP IS MEASURED NOT TO FIX THESE FAILURES.** The paragraphs above attribute every
   `STACK_TRACE_ERROR` to worker oversubscription and present the cap as the remedy. **Across ~15 gate
   runs in Phase 195 that model did not hold.** Full evidence: **`.planning/seeds/SEED-171-workflows-library-suites-flake-independent-of-cap.md`.**

   - **Cap 1 and cap 2 each produced clean runs AND red runs on byte-identical trees.** Plan `195-02`
     measured 8 runs and concluded cap 1 was clean; **that conclusion was luck** — two cap-1 runs at
     the wave close were red.
   - **One suite flakes in ISOLATION, with nothing else on the box.** Oversubscription cannot explain
     a single suite failing alone.
   - **The failing SET is never the same twice, so there is no number to pin** and no per-file
     baseline can absorb it.
   - ⚠ **NOT EVERY FAILURE IS A TIMEOUT.** One was a plain `AssertionError: expected 1 to be +0`,
     which breaks the "slow suite near a timeout boundary" hypothesis outright. **The
     `STACK_TRACE_ERROR` signature is therefore NOT a reliable tell for "not a real defect"** — that
     inference appears above and should not be relied on alone.
   - **THREE suites are involved**, and they are named so a red run can be triaged in one step:
     `src/pages/WorkflowsPage.test.tsx` · `src/components/workflows/library/WorkflowCard.test.tsx` ·
     `src/pages/WorkflowBuilderPage.session.test.tsx`.
     ⚠ **CORRECTED 2026-08-18 (Phase 196) — THE SET IS FIVE, NOT THREE, and the original three are kept
     above rather than overwritten.** SEED-171 gained a fourth at Phase 195's close
     (`src/pages/WorkflowRunPage.test.tsx`) and a **fifth** at `196-05`:
     **`src/pages/WorkflowBuilderPage.canvas.test.tsx`**, which failed a suite's own POSITIVE CONTROL with
     `AssertionError: expected 0 to be greater than 0` on a tree where the plan's whole diff was four
     newly-CREATED leaf files. ⚠ **THREE of the five now fail with `AssertionError`, not
     `STACK_TRACE_ERROR`** — so the signature above is confirmed NOT to be a reliable tell for *"not a real
     defect"*, on two independent data points rather than one.
     ⚠ **AND RED DOES NOT ALWAYS MEAN FLAKE.** `196-08` hit **`failed 249`** and every one was REAL: nine
     `WorkflowBuilderPage`-mounting suites threw at mount because their `@/lib/api` mock factories did not
     declare a newly-added export. **What separated the two cases was the PROCEDURE, not the colour** —
     filenames from the gate's own persisted JSON before any re-run, each checked against
     `git diff --numstat`, cap untouched.

   **⚠ KEEP THE CAP RULE — `GSD_VITEST_MAX_WORKERS=2` STANDS.** A cap still matters for two concurrent
   agents, and nothing here refutes that. **What is corrected is what the cap CLAIMS TO FIX.** So:

   > **If a gate run reds, do NOT reach for the cap.** Capture the failing filenames from the gate's
   > **own persisted JSON report** *before* re-running anything, check the named file against
   > `git diff --numstat <your base> HEAD` and `git status --short`, and if it is **byte-unchanged and
   > one of SEED-171's three**, record it as an observation and move on. ⚠ **One green sample of a
   > flaky suite is NOT proof of innocence** — say "provably unmodified", never "fine".

   ⚠ **THE FRONTEND TYPECHECK GATE IS VACUOUS AS USUALLY RUN — measured 2026-09-08 (Phase 239-08).**
`frontend/tsconfig.json` is `{"files": [], "references": [...]}`, a solution-style config, so
**`npx tsc --noEmit` type-checks ZERO files and exits 0 no matter what is broken.** It was quoted as
evidence repeatedly across Phase 239 and proved nothing; it reported green over a change carrying
**24 real `TS6133` errors**. ⛔ **Use `npx tsc -p tsconfig.app.json --noEmit`**, and measure a
**set diff** — the app config reports **67 errors at base**, so "zero errors" is not a reachable
criterion here and a plan that writes one has written a criterion that cannot pass.
⚠ This project already knew: the v3.3 close recorded *"`tsc -b` != `--noEmit`"*. **A fact in a
register nobody re-reads is the same as no fact** — which is this file's own recurring finding, now
paid for a second time.

⚠ **A CONSEQUENCE FOR PLANNING, not just for triage:** `count gate OK` is **not reliably reachable
   on demand**, so a plan whose acceptance criterion is *"the gate is green"* has written a criterion
   that can fail for reasons no plan controls. Pair it with the per-file deltas and the explicitly-run
   in-scope suites, which are deterministic.
