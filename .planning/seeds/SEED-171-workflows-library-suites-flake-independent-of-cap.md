---
seed_id: SEED-171
title: SEVEN suites flake non-deterministically (was FOUR at planting, then five at 196-05, six at the Phase 237 baseline), independent of GSD_VITEST_MAX_WORKERS and of machine load, and not every failure is a timeout — the count gate cannot reach 0 failing on demand
created: 2026-08-17
planted_during: Phase 195 Wave 1 post-merge gate (orchestrator)
status: planted
status_note: |
  ── 2026-09-22 · Phase 262 plan 05 — AN EIGHTH SUITE, and it is a shape the seven do not cover:
  `frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx` fails ONLY in a WIDE run.
  Measured at `GSD_VITEST_MAX_WORKERS=2`, one byte-identical tree, four invocations:
    · alone (1 file / 15 cases)                      → 15 passed
    · 16-file group (167 cases)                      → 167 passed
    · full `vitest-count-gate.cjs` (8745 cases)      → `count gate OK`, 0 failing
    · 100-file `src/lib src/components/{layout,chat,experts} …` → RED, 3 times, SET VARIED:
        run A `1 failed` · run B `2 failed` · run C `1 failed`
  The two case names that appear are *"lands on Documents with NO prop"* and *"⭐ lands on Health
  when the CALLER asks for it"* — both `LibraryPage` MOUNT cases, never the suite's `App.tsx?raw`
  source-text cases.
  ⭐ **PROVEN INHERITED BY MEASUREMENT, NOT BY UNCHANGEDNESS.** The suite file is byte-unchanged by
  262-05, but that proves nothing on its own — the suite reads `App.tsx?raw` and 262-05 edits
  `App.tsx`. So the eight files this plan changed were checked out at the phase base `1623a4654`
  (explicit paths only — no blanket reset, no `git clean`), the SAME wide command was re-run, and it
  read `2 failed` with the SAME two case names. Restored afterwards; all eight `git hash-object`
  digests identical and `git diff --quiet -- frontend/` clean. ⛔ No gate was running during the
  swap.
  ⚠ **THE NEW FACT FOR THIS SEED: the count gate is NOT the worst case.** The gate was green on the
  same tree in the same session, so "the gate reached 0 failing" does not mean a wide ad-hoc vitest
  invocation will. A plan whose acceptance criterion is any green run — gate or not — has written a
  criterion it does not control.
priority: high
relates_to:
  - SEED-056 (vitest unit baseline cluster triage) — ⚠ **THIS IS THE SAME FAMILY, BUT THE DIAGNOSIS
    HERE IS DIFFERENT AND STRONGER.** 056 triaged a rot SET. This seed records that FOUR named suites
    fail NON-DETERMINISTICALLY, which no per-file baseline can absorb, because the failing set is
    never the same twice.
  - CLAUDE.md § "Parallel execution" rule 2 — the `GSD_VITEST_MAX_WORKERS` rule. ⚠ **Its stated
    causal model is REFUTED by the measurements below.** The rule says oversubscription causes the
    `STACK_TRACE_ERROR` timeouts and that capping fixes it. Capping does NOT fix it.
  - Phase 195 plan 195-02 — measured 8 gate runs and concluded cap 1 was clean. That conclusion was
    LUCK, not a fix; two cap-1 runs at wave close were red.
  - Phase 195 plan 195-08 — owns the CLAUDE.md numbers, and inherits the correction this seed records.
trigger_when: >
  Any phase needs `count gate OK` as a pass condition, OR anyone proposes to raise/lower
  `GSD_VITEST_MAX_WORKERS` as a remedy for red gate runs, OR `WorkflowsPage.test.tsx` /
  `WorkflowCard.test.tsx` / `WorkflowBuilderPage.session.test.tsx` / `WorkflowRunPage.test.tsx`
  are edited for any reason.
surface: Agentic-RAG
---

# The flake is in the suites, not in the cap

## What was measured (2026-08-17, Phase 195 Wave 1 close)

The tree at this point had **no production source change at all** — the entire phase to date had
touched six files: three `.planning/` documents, two test files (neither of them the failing ones),
and `scripts/vitest-count-gate.cjs`. `WorkflowsPage.tsx`, `WorkflowsPage.test.tsx`,
`WorkflowCard.tsx` and `WorkflowCard.test.tsx` were all **byte-identical to the phase's base commit
`f2eef045`**, at which 195-01 had measured `count gate OK … 0 failing`.

| Run | Cap | Scope | failed | The failing set |
|---|---|---|---|---|
| Post-merge | **1** | full gate | **4** | `WorkflowsPage.test.tsx` — D-17 ×2, D-04 ×2 |
| Retry | **2** | full gate | **4** | `WorkflowsPage.test.tsx` — **LIB-01 + D-17 (a DIFFERENT pair)** · `WorkflowCard.test.tsx` ×2 |
| Isolated | **1** | `WorkflowsPage.test.tsx` alone | **2** | 53 passed / 55 — **flakes with nothing else running** |

Plus 195-02's own eight runs earlier the same day: cap 2 gave `0, 0, 3, 2, 8`; cap 1 gave `0, 0`.

**Every single failure across all eleven runs was `STACK_TRACE_ERROR`.**

## The four conclusions, and why each is load-bearing

1. **The cap is not the variable.** Cap 1 and cap 2 both produce clean runs and red runs on the same
   tree. CLAUDE.md's rule attributes these timeouts to worker oversubscription and prescribes a lower
   cap; the prescription does not work. ⚠ The rule is not *wrong to exist* — a cap still matters for
   two concurrent agents — but **"lower the cap" is not a remedy for a red gate**, and a plan that
   lowers the cap and gets green has learned nothing.
2. **Machine load is not the variable either.** The isolated run had one suite and nothing else on the
   box, and still failed 2 of 55.
3. **The failing SET is never the same twice.** This is what makes it unabsorbable by the gate's
   design: the gate pins per-file COUNTS (D-184-08) and requires **0 failing**. A per-file baseline
   can absorb a stable count; it cannot absorb a suite that fails a different two-to-eight cases each
   run. **There is no number to pin.**
4. **The grand total is invariant at 4044 across every run, and every per-file delta is ≥ 0.** The
   gate's *first* clause — no per-file decrease — has held in all eleven runs. Only the
   *zero-failing* clause trips.

## ⚠ AMENDMENT 2026-08-17 (Phase 195-03) — a THIRD file, and it is NOT a timeout

The two suites named above are not the whole set, and the failure mode is broader than
`STACK_TRACE_ERROR`. Phase 195-03's run 4 of 5 was red at **`failed 9`**, filenames captured from the
gate's persisted JSON **before** any re-run:

| File | Count | Error kind |
|---|---|---|
| `WorkflowsPage.test.tsx` | 6 | `STACK_TRACE_ERROR` |
| `WorkflowCard.test.tsx` | 2 | `STACK_TRACE_ERROR` |
| **`WorkflowBuilderPage.session.test.tsx`** | **1** | ⚠ **`AssertionError` — NOT a timeout** |

⚠ **The `AssertionError` matters more than the count.** Every failure recorded in the original
eleven runs was `STACK_TRACE_ERROR`, which made "slow suite near a timeout boundary" a clean
hypothesis. A genuine assertion failure on a byte-identical tree does not fit that shape, so **the
hypothesis in the next section is now known to be incomplete** rather than merely unproven.

**It also produced a false causal signal, which is the part worth not repeating.** Restoring the base
`fileIcon.tsx` made the case pass — which *looked* like causation. It was not: four consecutive
isolated runs with the modified file were **23/23 each**, so 7 of 8 samples were green and the file was
byte-identical to base in the merged result. ⚠ **A single "revert made it pass" observation is not
evidence against a flaky suite** — the sample size has to beat the flake rate before the direction of
causation means anything.

⚠ Note the count-gate script **already documents this exact file** at `:2401-2411` as a measured
parallel-load flake, with a standing instruction to re-run before declaring red. That instruction
covers the `pane click` case; whether this is the same case is **not yet checked**.

## ⚠ AMENDMENT 2 — 2026-08-17 (Phase 195 final gate) — a FOURTH file, and the timeout hypothesis is now clearly wrong

The phase-closing gate run read **`failed 1`**, captured from the persisted JSON before any re-run:

| File | Test | Error kind |
|---|---|---|
| **`src/pages/WorkflowRunPage.test.tsx`** | *"a reconcile leaves every visible node reading identical … when the tab wakes"* | ⚠ **`AssertionError: expected "vi.fn()" to be called at least once`** |

**Why this one is worth recording separately: it is the first flake in a file the phase TOUCHED**, so it
had to be cleared rather than assumed. It was, on evidence:

- **Isolated: `108 passed (108)`, twice consecutively.** Load-dependent, not a defect.
- **Per-file count `108/108`, delta 0** — nothing deleted.
- **The test predates the phase.** `git show f2eef045:…` finds it at the phase's base, and
  `git log -S` attributes it to **`345d85c5 test(188-08)`** — Phase 188. Phase 195 neither wrote nor
  edited it.
- Three earlier full-gate runs this phase read this same file at `108 / failed 0`.

⚠ **Two of the four files now fail with `AssertionError`, not `STACK_TRACE_ERROR`** (this one and
`WorkflowBuilderPage.session.test.tsx`). The "slow suite near a per-test timeout" hypothesis below
explains the timeouts and **cannot explain these**. The common factor across all four is
**concurrent-load sensitivity in async/effect-driven assertions** — `vi.fn()` expected-to-have-been-called,
visibility/wake reconciles, and similar — which is a different defect class from a timeout and probably
needs a different fix.

**The flaky set is now FOUR:** `WorkflowsPage.test.tsx` · `WorkflowCard.test.tsx` ·
`WorkflowBuilderPage.session.test.tsx` · `WorkflowRunPage.test.tsx`.

⚠ **The procedural lesson is the durable one.** This failure was in a file the phase had just modified,
which is exactly the case where "it's probably the known flake" is most tempting and most dangerous.
What cleared it was four cheap, specific checks — isolate twice, read the per-file delta, `git show`
the base, `git log -S` the authorship — not a re-run. **Keep that sequence; it is the difference
between dismissing a flake and dismissing a regression.**

## ⚠ AMENDMENT 3 — 2026-08-18 (Phase 196, plan `196-05`) — a FIFTH file, and a SECOND `AssertionError` in a suite the plan could not have reached

`196-05`'s run 1 of 3 was red at **`failed 1`**. The filename was recovered from the gate's **own
persisted JSON report** (`vitest-count-gate-44152-1787007892092.json`), and the cap was **never touched**
(`GSD_VITEST_MAX_WORKERS=2` on every run in that plan).

| File | Test | Error kind |
|---|---|---|
| **`src/pages/WorkflowBuilderPage.canvas.test.tsx`** | *"184-11 — with the flag OFF the panel receives NO rails key (D-14)"* → its own **POSITIVE CONTROL** | ⚠ **`AssertionError: expected 0 to be greater than 0`** |

**Why it is clearable on evidence rather than on assumption:** the file appears in **neither**
`git diff --numstat <plan base>..HEAD` (four files, all *created* by that plan) **nor**
`git status --short` at the time of the run — and nothing the plan created is imported by it. All
three new modules were leaves, and the mount that would connect them to `WorkflowBuilderPage` did not
exist until plan `196-08`, two waves later.

⚠ **THREE of the five files now fail with `AssertionError`, not `STACK_TRACE_ERROR`.** This is the
second independent data point for Amendment 2's finding, and it should settle the triage rule:
**the `STACK_TRACE_ERROR` signature is NOT a reliable tell for *"not a real defect"*.** The failing
assertion here is a suite's own **positive control** — a case whose whole job is to prove the extractor
can find what it looks for — which is about as far from a timeout signature as this set has produced.

**The flaky set is now FIVE:** `WorkflowsPage.test.tsx` · `WorkflowCard.test.tsx` ·
`WorkflowBuilderPage.session.test.tsx` · `WorkflowRunPage.test.tsx` ·
**`WorkflowBuilderPage.canvas.test.tsx`**.

⚠ **A PROCESS SLIP FROM THE SAME RUN, RECORDED BECAUSE IT WAS ONE.** `196-05` re-ran the gate **before**
extracting the failing filename, which is exactly what the triage protocol forbids. Nothing was lost —
the gate persists a JSON report per run and run 1's file was still on disk — but **the recovery worked by
luck of retention, not by design.** Keep capturing the filenames first.

⚠ **AND THE CONVERSE, from plan `196-08` in the same phase, because this seed must not be read as
"red always means flake": a gate run at `failed 249` was REAL.** Nine `WorkflowBuilderPage`-mounting
suites threw at mount because their `@/lib/api` mock factories did not declare a newly-added export.
What distinguished it was **exactly the correct triage** — filenames from the persisted JSON before any
re-run, each checked against the diff, the cap left alone — and the diff was **not** empty for the
cause. *The procedure is what separates the two cases; the colour of the run is not.*

---

## The shape of the defect, on the evidence available

`WorkflowsPage.test.tsx` takes **92.67 s for one file** (83.64 s of it test time) at cap 1 in
isolation. The failures are `STACK_TRACE_ERROR`, which is what vitest emits when it cannot serialise
an error — commonly accompanying a timeout. A suite this slow sitting near a per-test timeout boundary
would fail a *randomly varying* subset on each run, which is exactly the observed signature.

⚠ **This is a HYPOTHESIS consistent with the measurements, not a diagnosis.** Nothing here has
identified the actual slow operation, and no timeout value has been read or changed. Do not record it
as the cause without doing that work.

## Why this matters beyond one red run

**A gate that cannot be made green on demand stops functioning as a gate.** The failure mode is not
that it blocks work — it is that everyone learns the red is "just the flake", and a *real* regression
in a *different* suite then arrives wearing the same clothes. The eleven runs above are the only thing
currently separating the two, and that separation cost roughly forty minutes of wall-clock to
establish for a single wave.

## What a fix would have to do

- Identify the actual slow operation in `WorkflowsPage.test.tsx` (92 s for 55 cases is ~1.7 s/case —
  find what is being awaited).
- Decide deliberately between: making the suite fast, raising its timeout with a recorded reason, or
  **removing it from the gate with its reason written down** — the last being legitimate, and far
  better than a permanently-red gate nobody reads.
- ⚠ Whatever is chosen, **correct CLAUDE.md's causal claim in the same commit**, because the current
  text sends the next reader to adjust the cap, which is measured not to work.

## Interim contract (what Phase 195 actually did)

Wave 1 was marked complete with the red gate **stated, not hidden**, on this evidence: no production
source changed; no per-file count decreased; all five Phase-195 suites green
(`OutputFileCard.baseline` 21/21, `WorkflowRunPage` 105/105, `fileIcon` 11/11, `FilesSection` 11/11,
`MessageItem.finalOutputs` 11/11); and the failing set traced to two suites the phase never touched.

**Later plans in Phase 195 verify on per-file counts plus their own suites, NOT on a green grand
verdict.** Any plan that reports `count gate OK` should say which run number it was, and any plan that
reports red must name the failing files before re-running.


---

## ⚠ THE SET IS SEVEN, NOT FIVE — measured 2026-08-29 (BUG-260829-01)

Two more suites produced `STACK_TRACE_ERROR` under a full count-gate run on a tree where each
was **provably unmodified** (`git diff --numstat HEAD` and `git status --short` both empty for
the suite AND its component):

| suite | in this phase's diff? | verdict |
|---|---|---|
| `src/components/workflows/PhaseNode.test.tsx` | **no — provably unmodified** | new member |
| `src/components/workflows/PublishGauntlet.test.tsx` | ⚠ its COMPONENT was modified | see below |

⭐ **THE FAILING SET CHANGED BETWEEN TWO CONSECUTIVE RUNS OF THE SAME TREE**, which is this
seed's own signature restated: run 1 was `PhaseNode` ×1; run 2 was `WorkflowBuilderPage.canvas`
×2 + `PhaseNode` ×3 + `PublishGauntlet` ×2; run 3 was **`count gate OK`, 0 failing**. Nothing
was edited between them.

⚠ **`PublishGauntlet.test.tsx` COULD NOT BE CALLED INNOCENT BY THE USUAL TEST**, because
`PublishGauntlet.tsx` WAS in that change's diff. It was cleared by a different method, recorded
here as the procedure to reuse: **three consecutive isolated runs passed (3/3), and a
counterfactual with the change stashed also passed** — so the suite passes with and without the
edit in isolation, and fails only under full-gate load. That is membership in this class, not a
defect in the change.

⚠ **AND THE COUNTERFACTUAL COST MORE THAN IT SHOULD HAVE.** `git stash push -- <one file>`
followed by `git stash pop` popped a **year-old unrelated stash** and put 13 files into conflict
across `.claude/`, `backend/app/config.py` and `frontend/package-lock.json`. Nothing was lost —
every conflicted file was restored to HEAD and the ancient stash's content discarded — but the
lesson is cheap to record and expensive to relearn: **on a repo with a pre-existing stash, and
with a sibling agent committing to the same branch, do not use `stash push`/`pop` as a
counterfactual.** Copy the file aside, or read the prior version with `git show HEAD:<path>`.

---

## Sighting — 2026-08-31, Phase 221-01 close

**`src/pages/WorkflowBuilderPage.canvas.test.tsx`**, the fifth suite on this list, failed its
own POSITIVE CONTROL again:

```
WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
  POSITIVE CONTROL — with the flag ON the very same read finds the key
AssertionError: expected 0 to be greater than 0
```

⚠ **Byte-for-byte the assertion and the message recorded at `196-05`.** Same suite, same test,
same expectation. That is now two independent sightings of one control, thirteen days apart.

**Triage, in the order CLAUDE.md requires:**

| step | result |
|---|---|
| filenames captured from the gate's own persisted JSON **before any re-run** | ✅ |
| `git diff --numstat <phase base> HEAD` over the suite and its subjects | **empty — untouched** |
| `git status --short` over `src/pages/` and `src/components/workflows/` | **clean** |
| second gate run | **same suite, same test, same message** |
| the suite ALONE, nothing else on the box | **154/154 passed** |
| cap touched | **no** — it held at 2 throughout |

⚠ **A suite that fails IN ISOLATION-adjacent conditions and passes alone, on an unchanged
tree, is the shape this seed exists to name.** Worker oversubscription cannot explain a single
suite failing while every other file in the same run passes.

⚠ **Recorded as an observation, never as innocence.** The suite is *provably unmodified* by
Phase 221; that is a different claim from *fine*. **One green sample of a flaky suite proves
nothing**, and 154/154 in isolation is exactly one green sample.

**The standing consequence, restated because this sighting demonstrates it:** `count gate OK`
is **not reliably reachable on demand**, so a phase whose acceptance criterion is *"the gate is
green"* has written a criterion that can fail for reasons no plan controls. 221-01's
deterministic evidence is the per-file figures and the explicitly-run in-scope suites —
settings 367/367, `tsc` 66 = baseline, backend `70 failed / 3287 passed` with 70 the untouched
baseline.

---

## ⚠ SIGHTING 2026-09-02 (Phase 223 reviewer check) — THE SET IS **SEVEN**, AND THE FAILING TESTS SHARE A *KIND*

Two full gate runs on the **same tree**, minutes apart, no sibling agent, `GSD_VITEST_MAX_WORKERS=2`,
run from the repo root. **Filenames were captured from the gate's own persisted JSON BEFORE either
re-run**, per this seed's procedure.

| run | failed | file | the failing tests |
|---|---|---|---|
| 1 | **4** | `frontend/src/components/workflows/library/ForkNameDialog.test.tsx` | reset-on-open · trimmed-empty check · Cancel creates nothing · **aXe structural** |
| 2 | **2** | `frontend/src/components/workflows/WorkflowCanvas.test.tsx` | **aXe** on a rendered canvas · **aXe** on the empty state |

**Different file on each run.** Both **byte-unchanged** since the phase base (`git diff --numstat`
returns empty for the component and its suite). Phase 223's entire frontend diff is five files —
`ChatArea.tsx`, `MessageInput.tsx`, `MessageInput.connectors.test.tsx`, `lib/api/threads.ts`,
`types/index.ts` — and **neither flaky file is among them**. `ForkNameDialog.test.tsx` then passed
**25/25 in isolation**.

⚠ **Say "provably unmodified", never "fine".** One green isolation run is not proof of innocence, and
this seed's own history is that a suite cleared on one sample went red later.

**The flaky set is now SEVEN:** `WorkflowsPage.test.tsx` · `WorkflowCard.test.tsx` ·
`WorkflowBuilderPage.session.test.tsx` · `WorkflowRunPage.test.tsx` ·
`WorkflowBuilderPage.canvas.test.tsx` · **`library/ForkNameDialog.test.tsx`** ·
**`WorkflowCanvas.test.tsx`**.

### ⭐ THE NEW FINDING IS NOT THE TWO FILES — IT IS THAT THE FAILING TESTS SHARE A KIND

Across **both** runs, **every** failure was either an **`axe` accessibility assertion** or a
**dialog-render assertion**. Three of the six were literally named *"no aXe violations"*.

That is a sharper hypothesis than *"these files are flaky"*, and it is falsifiable: **`axe` runs are
the slowest, most CPU-bound work in the whole suite** — a full accessibility tree walk over a rendered
DOM — so under worker contention they are the tests most likely to cross a timeout boundary first.
It predicts that the *identity* of the flaky file is close to irrelevant, and that what actually
predicts a red run is **how many `axe` assertions a run happens to schedule concurrently**.

⚠ **This does NOT resurrect the cap hypothesis this seed refuted.** The cap was `2` on both runs and
both went red; §CORRECTION (b) stands. What is proposed is a *different* mechanism for the same
refractory symptom, and it is stated as a hypothesis rather than a finding **because it has not been
driven** — nobody has yet run the gate with the `axe` assertions excluded to see whether red
disappears. That experiment is the cheapest next step and it has not been done.

### Consequence for a reviewer, restated

A red count gate is **not** evidence against the phase under review until the failing filenames have
been checked against that phase's real diff. Here the check took one `git diff --numstat` and cleared
223 outright. **The gate's deterministic half — per-file figures, the explicitly-run in-scope suites,
`tsc`, and the backend baseline — is what actually carried the verdict:** `tsc` **66** = baseline,
backend **70 failed** = baseline exactly, 13 in-scope unit tests green, and the live audit suite
**5 passed / 0 skipped**.


---

## 2026-09-06 — A SIXTH SUITE, AND THE FIRST ONE OUTSIDE THE WORKFLOWS FAMILY

Recorded by claude as **REVIEWER** while capturing the Phase 237 baseline **before any build work**
(base `0798d25ea724aa642779cda352fd65b2ccd42313`, `git diff --numstat HEAD -- frontend/` **EMPTY**).
This is a baseline observation, not a phase finding — which is exactly why it is trustworthy: no one
had changed anything.

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root:

```
  total 7787  ·  failed 3  ·  pinned total 6991
FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.
```

Failing set, taken from the gate's **own persisted JSON report** BEFORE anything was re-run:

| File | Test | Signature |
|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | canvas door — flag ON (D-183-01) | `STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the mount harness works" | `STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the four shipped tab triggers render" | `TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"` |

**`WorkflowBuilderPage.canvas.test.tsx` is already in this seed's set.** The new one is
**`src/components/library/__tests__/sketchComposition.test.tsx`**, and it is notable on three counts:

1. **It is the first named suite outside `workflows`/`pages`** — the family is wider than the seed's
   title claims. The title still says FOUR; the set is now **six**.
2. **Its second failure is a hard assertion, not a timeout** — `TestingLibraryElementError`,
   duplicate `role="tab"` named "Documents". This is the third independent data point that
   `STACK_TRACE_ERROR` is **not** a reliable tell for "not a real defect", and the first where the
   error text points at **DOM left over from a sibling test in the same worker** rather than at
   slowness. That is a cleanup/isolation smell, and it is the most actionable lead this seed has.
3. **Both failures are the suite's own POSITIVE CONTROLS** — the same shape as `196-05`. A suite
   whose positive control fails is asserting that its harness does not work, which is never a
   product claim.

**Re-run in isolation: `46 passed | 1 skipped (47)` — clean, and the pin (`"sketchComposition.test.tsx": 47`) is intact.**
⚠ Per this seed's own standing rule, that is recorded as **provably unmodified**, NOT as "fine" —
one green sample of a flaky suite is not proof of innocence.

### ⭐ REPRODUCED EXACTLY — 2026-09-10 (Phase 241, plan `241-03`)

The sighting above was a single observation. It is now a **reproduction**, and the value of this
entry changes accordingly: three cases, three signatures, **identical to the table above**, four
days later, on a different base and by a different plan.

```
  total 7940  ·  failed 3  ·  pinned total 7170
FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.
```

| File | Test | Signature |
|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | canvas door — flag ON (D-183-01) | `Error: STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the mount harness works" | `Error: STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the four shipped tab triggers render" | `TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"` |

Filenames taken from the gate's **own persisted JSON BEFORE anything was re-run**, as this seed
requires. Both files are **provably unmodified by `241-03`**: neither appears in
`git status --short` nor in `git diff --numstat <merge-base> HEAD`, whose entire frontend surface
is `SettingsPage.tsx`, `SettingsPage.test.tsx`, `SettingsPage.a11y.test.tsx` and a types-only edit
to `lib/api/skills.ts`. Neither failing suite imports any of them.

- **In isolation, together: `200 passed | 1 skipped (201)`.** Recorded as *provably unmodified*,
  never as "fine".
- **The very same gate had read `failed 0` ~20 minutes earlier** on this same worktree, before the
  frontend edits, and read `failed 0` again on the re-run after them. So on this tree the gate
  produced **green, red, green** across three runs at `GSD_VITEST_MAX_WORKERS=2`. **The cap was
  never touched.**
- ⚠ **The duplicate-`role="tab"`-named-"Documents" error recurring verbatim strengthens the
  strongest lead this seed has**: it is not slowness, it is DOM left over from a sibling test in
  the same worker. Two independent occurrences of the *same* leaked accessible name is a cleanup
  /isolation defect with a reproducible fingerprint — not a timeout.

### The consequence for any phase planning against this

**`count gate OK` was NOT reachable on this tree with zero source changes.** So a phase whose
acceptance criterion reads *"the gate is green"* has written a criterion that fails for reasons no
plan controls. **Diff the failing SET against a baseline set captured on the merge base** — never
compare counts, and never treat red as the builder's until the named file has been checked against
`git diff --numstat`.


---

## ⚠ A SEVENTH SUITE, MEASURED AT PHASE 240'S BASELINE (2026-09-09)

**`src/pages/__tests__/LibraryPage.test.tsx`** joins the list, and it was measured on the
cleanest possible tree: **the frontend diff since the phase's base commit was EMPTY**
(`git diff --stat 50f66ec39 HEAD -- frontend` printed nothing) and the count gate was already
RED.

| Run | Context | Result for this file |
|---|---|---|
| Gate run, cap 2 | full `TARGETS` set, no sibling agent | **7 failed** |
| Isolated, cap 2 | this file alone | **1 failed / 16 passed** — `Test timed out in 5000ms` |
| Gate run, cap 2, later same session | full set, after ~40 files of frontend work | **0 failed** |

⭐ **Three runs, three different answers, on a file nobody had touched.** That is this seed's
whole claim restated on a new suite: **the failing SET is never the same twice**, so no per-file
baseline can absorb it and no cap setting makes `count gate OK` reachable on demand.

⚠ **The same baseline run also reported two suites as `[missing-file]`** —
`WorkflowBuilderPage.canvas.test.tsx` (pinned 128) and `WorkflowsPage.test.tsx` (pinned 59) —
i.e. they did not run at all. Both are already on this list. A pinned suite that does not RUN is
a distinct failure shape from one that runs red, and it is worth naming because the gate's
`[missing-file]` message reads like a deleted file rather than a suite that timed out on import.

⚠ **The cap was NOT adjusted, per this seed's own standing instruction.** Phase 240 captured the
failing filenames from the gate's persisted JSON **before** re-running anything, checked each
against `git diff --numstat`, found every one byte-unchanged, and moved on. The phase's final gate
run read **`count gate OK` — 7914 total · 7149 pinned · 247/247 · 0 failing**, which is the same
tree that had been red twice.

⛔ **"Provably unmodified", never "fine."**

---

## ⭐ THIRD REPRODUCTION OF THE `sketchComposition` PAIR — 2026-09-11 (Phase 243 baseline)

Recorded by claude while capturing the Phase 243 baseline **before any build work** — base
`96adfd668`, `git diff --numstat HEAD -- frontend` **EMPTY**, `git status --porcelain -- frontend`
**EMPTY**, cap `2`, repo root, no sibling agent.

```
  total 7170  7940  +770
  total 7940  ·  failed 2  ·  pinned total 7170
FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
```

Failing set, from the gate's own persisted JSON before anything was re-run — **byte-for-byte the
pair this seed already records at 2026-09-06 and 2026-09-10**:

| File | Test | Signature |
|---|---|---|
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the mount harness works" | `Error: STACK_TRACE_ERROR` at `:317` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the four shipped tab triggers render" | `TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"` |

Isolated re-run: **`46 passed | 1 skipped (47)`** in 6.36 s. ⚠ Recorded as **provably unmodified**,
never as "fine".

### ⭐ THE NEW EVIDENCE: the two failures are ONE failure, and the leak now has its mechanism

The 2026-09-06 entry called the duplicate accessible name *"DOM left over from a sibling test in
the same worker"* and named it *"the most actionable lead this seed has"*. **This run supplies the
missing causal step, and it is cheap to state:**

- Failure #1 is a **timeout** at `sketchComposition.test.tsx:317`, so its `afterEach` cleanup never
  runs and its render tree stays mounted.
- Failure #2 is the **very next test**, which then finds **two** `role="tab"` nodes named
  "Documents" — because it is querying two mounted copies of the page.

So `failed 2` **overstates the finding**: there is one root failure and one cascade. That matters
for this seed's central claim — *the failing set is never the same twice* — because it means the
set's apparent SIZE partly tracks cascade depth, not the number of independent flakes.

⚠ **And the product is exonerated structurally, not by inference:** `grep -rn "TabsTrigger"
pages/LibraryPage.tsx components/library/*.tsx` shows the Library's five tabs declared **once**;
the only other `TabsTrigger` block is `IngestionTab.tsx`'s four **sub**-tabs (`Add files`,
`In progress`, `Needs attention`, `History`), none named "Documents". **There is no duplicate-tab
defect to chase.**

### ⛔ A REGISTER-DRIFT FINDING, and it cost a wrong classification in this very session

**`CLAUDE.md` says *"`SEED-171`'s five cap-independent flaky suites"*. This seed says SEVEN.**

Phase 243's baseline was first written from CLAUDE.md's list and therefore classified
`sketchComposition.test.tsx` as *"a sixth file, not in SEED-171"* — when it has been in this seed
since 2026-09-06 with **this exact failing pair recorded verbatim**. The error was caught and
struck through (not deleted) in `243-BASELINE.md`, but it is the fourth-order version of this
project's standing finding: **an index that summarises a register goes stale, and an agent that
trusts the index instead of the register mis-classifies a known flake as a new one.**

⚠ **CLAUDE.md's "five" is FLAGGED HERE, NOT SILENTLY FIXED** — Phase 243 does not own that file's
guardrail prose, and a phase quietly editing another phase's register is how corrections lose their
authorship. The next phase that touches CLAUDE.md's `SEED-171` sentence should re-derive the count
from this seed rather than increment it.

---

### ⚠ THE REGISTER-DRIFT PREDICTION FIRED A SECOND TIME — Phase 244, plan `244-15` (2026-09-12)

The section above closes by naming the exact failure mode *"an agent that trusts the index instead of
the register mis-classifies a known flake as a new one"*, and records that Phase 243 did it once.
**It happened again, unprompted, twenty-four hours later, and the recurrence is the finding.**

`244-15`'s post-merge count gate read `failed 3` on its first run. The executor did the procedure
**correctly** — filenames captured from the gate's own persisted JSON *before* any re-run, cap
untouched at `2`, each name checked against an empty `git diff --numstat` against the base, both green
in isolation, second full run `failed 0` with identical totals. **Nothing about the method was wrong.**

What was wrong was the classification, and it came from CLAUDE.md rather than from here:

| Suite it named | It reported | This register says |
|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | "one of the seed's five" | listed (added `196-05`) |
| `src/components/library/__tests__/sketchComposition.test.tsx` | "**a sixth suite**, in a directory none of the five share" | **listed since 2026-09-06**, with its failing pair recorded verbatim |

⛔ **There is no sixth suite, and there was no eighth.** Both names were already here. The count has
been **SEVEN** in this file since the Phase 237 baseline; **CLAUDE.md still says "five" in three
places** (`§ Parallel execution` rule 2, lines ~239 / ~315, plus a "three" at ~361 preserved from the
original planting). An executor reading the index and not the register arrives at "sixth" by correct
arithmetic on a stale premise.

⭐ **What this escalates:** the first occurrence was caught in review and struck through in
`243-BASELINE.md`. This one reached an orchestrator as *"new evidence for SEED-171, not folded in"* —
i.e. it was about to be written into a register as a new datum. **The cost of the stale index is now
measured twice, and the second time it nearly grew the register by a row that was already in it.**

⚠ **STILL FLAGGED, STILL NOT SILENTLY FIXED, and now for a second recorded reason.** `244-15` is a
G-7-overridden gap-closure plan (see `STATE.md → Guardrail overrides`); a closure round may not
quietly rewrite another phase's guardrail prose, and the seed's own rule above says the count must be
**re-derived from this file**, never incremented from the index. The re-open trigger is unchanged and
now has two data points behind it:

> **The next phase that touches CLAUDE.md's `SEED-171` sentence re-derives the suite count from this
> file.** Until it does, expect a third misclassification — the mechanism is intact.

---

## 2026-09-15 (Phase 250 code-review fixes, WR-04) — THE SET IS SEVEN, and two of the new ones are NOT workflow pages

Two consecutive full-gate runs on the **same tree**, minutes apart, filenames read from each run's
own persisted JSON **before** the next was started (the procedure this seed exists to enforce).
The working diff was three files — `TodosSection.tsx`, `TodosSection.test.tsx`,
`scripts/vitest-count-gate.cjs` — and **none of the four suites below is one of them.**

| Run | failed | Suites |
|---|---|---|
| 1 | **3** | `WorkflowBuilderPage.canvas.test.tsx` ×1 · `src/components/library/__tests__/sketchComposition.test.tsx` ×2 |
| 2 | **3** | `WorkflowBuilderPage.session.test.tsx` ×1 · `src/pages/__tests__/LibraryPage.test.tsx` ×2 |

⭐ **The COUNT held at 3 across both runs while the SET rotated completely — zero overlap.** That
is this seed's central claim reproduced in the cleanest form yet: *the failing set is never the
same twice, so there is no number to pin and no per-file baseline can absorb it.* It also means a
`failed 3` reading that MATCHES a recorded baseline can still be a different three suites —
`250-GATE-BASELINE.md` recorded run 1's exact pair, and run 2 matched its count while sharing none
of its names. **Comparing the count to a baseline is not comparing the set.**

⚠ **Two of the four are outside the workflow surface**, which the previous five all shared:

- **`src/components/library/__tests__/sketchComposition.test.tsx`** — failed its own **§2 POSITIVE
  CONTROLS** (*"the page renders its heading — the mount harness works"*, *"the four shipped tab
  triggers render"*), the `196-05` signature.
- **`src/pages/__tests__/LibraryPage.test.tsx`** — never previously named here.

**The flaky set is now SEVEN:** the five above · **`sketchComposition.test.tsx`** ·
**`LibraryPage.test.tsx`**.

⛔ **Recorded as an OBSERVATION, never as proof of innocence.** All four are provably unmodified by
the change that was in the tree; that is not the same as proving the change is fine, and one green
sample of a flaky suite proves nothing either. The cap was `2` throughout and was neither adjusted
nor blamed.
