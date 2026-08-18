---
phase: 197-guided-authoring
plan: 01
subsystem: testing
tags: [characterization-baseline, vitest, count-gate, numstat, g-5-ledger, d-05]

# Dependency graph
requires:
  - phase: 193.1
    provides: "WorkflowBuilderPage.preDraft.baseline.test.tsx — the six-row whole-container capture of the GOVERN door's pre-draft describe screen"
  - phase: 193
    provides: "WorkflowDoorSwitch.baseline.test.tsx — the LOOSE door's half of the same capture"
  - phase: 187
    provides: "WorkflowBuilderPage.describe.test.tsx FLAG_OFF_DESCRIBE_MARKUP — the CTA-group byte pin that predates this phase by ten"
provides:
  - "The phase base SHA as a 40-char hex literal, so every later wave's numstat criterion has a fixed left-hand side"
  - "Three pre-change baseline verdicts, quoted verbatim, proving the D-05 fence was green BEFORE any source byte moved"
  - "Four gate baselines (count gate, tsc, backend pytest) measured on this tree rather than inherited"
  - "Six re-derived G-5 ledger triples for the files this phase touches"
  - "Four standing numstat deletion criteria + two named exclusions, as runnable commands"
affects: [197-02, 197-03, 197-04, 197-05, 197-06, 197-07, 197-08, 197-09, 197-10, 197-11, wave-merge, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measurement-only wave-0 plan: files_modified is empty by design; the deliverable is a recorded criterion"
    - "A red line expressed as a runnable `git diff --numstat <base-sha> HEAD -- <path>` command, not a judgement"

key-files:
  created:
    - ".planning/phases/197-guided-authoring/197-01-SUMMARY.md"
  modified: []

key-decisions:
  - "The D-05 fence is the SHIPPED 193.1/193 baselines, not a new capture — a capture taken now would postdate this phase's own context"
  - "The four numstat criteria run at every wave merge AND at phase close, not only once"
  - "WorkflowBuilderPage.header.test.tsx and scripts/vitest-count-gate.cjs are EXPLICIT exclusions from the zero-deletion rule"

patterns-established:
  - "Record the base SHA as a literal, never as a description — this project's numbers have rotted three times, once in a single day"
  - "Every inherited figure is re-derived with its own command beside it in the SUMMARY"

requirements-completed: [AUTH-02]

# Metrics
duration: 39min
completed: 2026-08-18
---

# Phase 197 Plan 01: D-05 Red Line + Pre-Change Baselines Summary

**The phase base SHA, three green pre-draft baseline verdicts, four re-measured gate baselines, six re-derived G-5 triples and four runnable zero-deletion numstat criteria — recorded before a single source byte changed.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-08-18T10:12:00Z
- **Completed:** 2026-08-18T10:51:00Z
- **Tasks:** 3
- **Source files modified:** 0 (by design — `files_modified: []`)

---

## THE PHASE BASE SHA

```
52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07
```

`git rev-parse HEAD`, run in this worktree after the dispatched-base assertion. This is the
**literal** left-hand side of every numstat criterion below. Do not re-derive it, do not describe
it — substitute it.

Subject line of that commit:
`docs(state): 197 PLANNED — 11 plans, checker passed, three upstream claims measured false`

---

## Task 1 — The three shipped pre-draft baselines, GREEN at the base SHA

Command, run from `frontend/`, one invocation, cap honoured:

```bash
GSD_VITEST_MAX_WORKERS=2 npx vitest run \
  src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
  src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
  src/pages/WorkflowBuilderPage.describe.test.tsx
```

**Verdict, verbatim:**

```
 RUN  v4.1.0 C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-a25259e72fdf56965/frontend

 Test Files  3 passed (3)
      Tests  69 passed (69)
   Start at  10:13:42
   Duration  46.54s (transform 25.69s, setup 8.35s, import 32.46s, tests 3.12s, environment 60.59s)
```

**failed 0.** All three suites named in the plan are covered by that one run:

| # | Suite | Door | What it fences |
|---|---|---|---|
| 1 | `frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx` | GOVERN | six whole-container captures (flagOff/flagOn × empty/composing/error) of the `describeScreen`; the only `/generate` caller in the app |
| 2 | `frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` | LOOSE / fast | the near-identical second pre-draft screen; its CTA is a HANDOFF and makes no network call |
| 3 | `frontend/src/pages/WorkflowBuilderPage.describe.test.tsx` | GOVERN | `FLAG_OFF_DESCRIBE_MARKUP` at `:307` — a byte-exact literal of the CTA GROUP ALONE, captured in Phase 187 wave 1 |

⚠ **Both screens contain the literal splice anchor `<div className="flex flex-col items-center gap-3">`**
(`WorkflowDoorSwitch.tsx:300` and `WorkflowBuilderPage.tsx:1579`). The class string cannot tell
them apart, so a later plan that splices "at the CTA group" can land on the wrong one. Suite 1
disambiguates by IMPORT and by pinning `starter-door-trigger`, a node that exists ONLY on the
GOVERN screen.

### Why no new capture was authored

The plan is explicit and this executor obeyed it: **no second baseline file was created.** The
shipped fence predates this phase by four phases (193 / 193.1 / 187). A capture taken today would
postdate `197-CONTEXT.md` and would manufacture the exact *"a capture and the assertion that guards
it drift apart"* condition the fence's own docblock (`:250-262`) names — the file deliberately has
ONE `capture` helper so the captured strings and the asserting `expect`s cannot diverge.

### The deletion history of the fence — "exactly once, deliberately"

`git log --numstat --format='%h %ad %s' --date=short -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx`

| commit | date | ins | **del** | subject |
|---|---|---|---|---|
| `f434d43c` | 2026-08-18 | 3 | **0** | `feat(196-08): AUTH-04 is real — four free-text model boxes become four gated pickers` |
| `0a2742a3` | 2026-08-15 | 54 | **6** | `test(193.1-08): both re-captures DECLARED — and the plan's "two rows" is measured as four` |
| `02606a08` | 2026-08-15 | 120 | **0** | `feat(193.1-07): the wire AND the bind, in ONE commit — D-19 is indivisible` |
| `517ad56d` | 2026-08-14 | 61 | **0** | `test(193.1-01): pin the /generate request body as a KEY SET before the wire grows` |
| `594fdc8d` | 2026-08-14 | 438 | **0** | `test(193.1-01): capture the pre-draft describe screen on the UNMOVED tree` |

Five commits, **6 deletions total, all in one commit — and that commit's own subject contains the
word `DECLARED`.** That is the precedent the D-05 criterion below encodes: deletions are not
forbidden, they are *declared, dated and reasoned in the plan that makes them*. A silent deletion
is the failure mode.

`git status --short` after this task: **empty.** No file under `frontend/`, `backend/` or
`scripts/` was touched.

---

## Task 2 — The four gate baselines, RE-DERIVED. Every number below was measured on this tree.

### 1. The vitest count gate

```bash
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs
```

**Verdict, verbatim — the last four lines of its own output, not a summary:**

```
  total                                      4217    4291     +74
  total 4291  ·  failed 0  ·  pinned total 4217
--------------------------------------------------------------
count gate OK — 89/89 pinned files present, no per-file decrease, 0 failing.
```

| | `197-RESEARCH.md` §"How to read the count gate" | **measured 2026-08-18 at the base SHA** |
|---|---|---|
| grand total | 4291 | **4291** |
| failed | 0 | **0** |
| pinned total | 4217 | **4217** |
| pinned files | 89/89 | **89/89** |

**No drift — and that is the expected result, not a lucky one.** Phase 196 closed at exactly these
figures and nothing has been committed to `frontend/` since. This is the one circumstance in which
an inherited number and a measured number *should* agree; it was still re-derived rather than
copied, because the only way to know which case you are in is to run the command.

⚠ **A green gate is NOT reliably reachable on demand** (CLAUDE.md CORRECTION 2026-08-17 / SEED-171).
This run came back clean on the second attempt; the first attempt did not fail a test, it died in
its reporter — see the deviation below. **Later waves must not read "the base was green" as "green
is guaranteed."**

### 2. Frontend typecheck

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json      # exit 2
```

**33 errors.** Counted with `grep -cE '^src/.*error TS'` over the captured output.

⚠ **The `-p tsconfig.app.json` is load-bearing** — a bare `tsc --noEmit` checks ZERO files in this
repo and would have recorded a meaningless `0`. Matches the inherited baseline of **33** exactly.
All 33 are pre-existing and none is in this phase's scope.

### 3. Backend pytest — ⚠ TWO scopes, and the plan's command is NOT the one the inherited figure came from

This is a real finding, not bookkeeping. The plan's `<action>` names
`backend/venv/Scripts/python.exe -m pytest backend/tests/unit -q` and tells the executor to compare
against RESEARCH's **`211 failed / 4046 passed`**. **Those two are different scopes and are not
comparable**, which was proved by running both:

| scope | command | measured summary line | collected |
|---|---|---|---|
| **`tests/unit` — the plan's literal command** | `venv/Scripts/python.exe -m pytest tests/unit -q` | `63 failed, 2274 passed, 2 xfailed, 2 xpassed, 33 warnings in 435.97s (0:07:15)` | 2337 |
| **`tests` — where the inherited figure comes from** ⭐ | `venv/Scripts/python.exe -m pytest tests -q` | `212 failed, 4041 passed, 33 skipped, 5 xfailed, 9 xpassed, 266 warnings, 1 error in 811.58s (0:13:31)` | **4301** (`--collect-only`) |

`211 + 4046 = 4257`, which can only come from a **4301-test** collection — so the STATE.md/RESEARCH
baseline is the **whole `backend/tests`** tree, integration included. Against that comparable scope
the tree measures **212 failed / 4041 passed**: failures **+1**, passing **−5**. Both figures are
recorded here so a later wave can pick the row matching whatever command it runs, instead of
comparing a unit-only number against a whole-tree one and reporting a 148-test "improvement" that
never happened.

The `1 error` is `tests/integration/test_077_cross_cancel.py::test_cross_worker_cancel_via_zombie_heal`
— an **error at setup**, i.e. an integration test that needs live Redis, not a failing assertion.

**⭐ Standing instruction for every later plan in this phase: run `backend/tests` (whole), not
`backend/tests/unit`,** if you intend to compare against the 211/4046 lineage. This phase's own
backend surface (`workflow_authoring.py`, `grounding.py`, `workflows.py`) has unit tests in
`tests/unit` **and** publish/grounding coverage that the whole-tree run reaches.

### 4. The six G-5 ledger triples

Re-derived with the ledger's own three commands, **subtracting six-digit dated quick-task buckets**
from the phase count exactly as CLAUDE.md instructs:

```bash
git log --oneline -- <file> | wc -l                                    # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l  # phases (then subtract 6-digit)
wc -l <file>                                                           # lines
```

| File | **measured (c / p / l)** | `197-CONTEXT.md` says | drift | dated buckets subtracted |
|---|---|---|---|---|
| `frontend/src/lib/api.ts` | **170 / 97 / 6154** | 170 / 97 / 6154 | none | `260405` `260814` |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | **42 / 13 / 2398** | 42 / 13 / 2398 | none | `260809` `260814` |
| `backend/app/api/workflows.py` | **36 / 18 / 1984** | 36 / 18 / 1984 | none | `260814` |
| `backend/app/services/harness/grounding.py` | **18 / 5 / 1252** | 18 / 5 / 1252 | none | `260814` |
| `frontend/src/components/workflows/builderStore.ts` | **11 / 5 / 837** | 11 / 5 / 837 | none | `260809` |
| `backend/app/services/workflow_authoring.py` | **12 / 6 / 572** | 12 / 6 / 572 | none | — |

**All six agree, and all six FIRE G-5.** ⚠ The zero-drift result is *this measurement's* finding, not
a licence to skip the next one: `WorkflowRunPage.tsx`'s row went stale **the same day** it was
written, and five of the ledger's rows were found wrong when it was last re-derived in bulk. Each of
these six goes stale on the **next commit that touches it**, which in this phase means most of them
go stale during wave 2. **Re-derive at phase close; do not copy this table forward.**

⚠ **`frontend/src/lib/api.ts` at 97 phases is the hottest file in the repository** and is the one
row `197-CONTEXT.md` records as *not* covered by construction. D-13 widens the `/generate` response
type it reads. Per Phase 196's measured lesson: **D-13 adds a TYPE, not a runtime export**, so it
should not trigger the `196-08` failure mode (249 real failures from `@/lib/api` mock factories
missing a newly-added runtime export) — but any plan that adds a **runtime** export to `api.ts`
must budget one mock line per mounting suite.

---

## Task 3 — THE FOUR STANDING NUMSTAT CRITERIA

⚠ **These are the phase's red line. They are RUNNABLE COMMANDS, not judgements anyone has to
make.** The rule they encode is lifted verbatim from the fence file itself
(`WorkflowBuilderPage.preDraft.baseline.test.tsx:60-67`):

> *"a diff against these strings is a BEHAVIOUR CHANGE TO EXPLAIN, never a test to update.
> Re-capturing them to make a red run green deletes the only evidence anybody has that the pre-draft
> screen still renders what it rendered. `git diff --numstat` on this file must show ZERO DELETIONS
> through the extraction wave; the first wave that intentionally changes a rendered node re-captures
> ONCE, DECLARED in its own plan with a date and a reason, never quietly absorbed."*

### The four commands — copy these, the base SHA is already substituted

```bash
# ── D-05 / ROADMAP SC#2 / SC#3 — THE FAST DOOR STAYS FAST ────────────────────────────
# The GOVERN door's pre-draft describe screen. Six whole-container captures.
git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
  -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx
# REQUIRED: deletions column == 0

# The LOOSE / fast door's half of the same fence.
git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
  -- frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
# REQUIRED: deletions column == 0

# ── D-02 — A NEW SIBLING SURFACE, NOT A WIDENED SeedReceipt ──────────────────────────
git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
  -- frontend/src/components/workflows/SeedReceipt.tsx
# REQUIRED: 0 insertions AND 0 deletions — the file must not appear in the output at all

# ── D-11 / D-20 — THE PUBLISH GAUNTLET LEARNS NOTHING NEW ────────────────────────────
git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
  -- backend/app/services/harness/publish_service.py
# REQUIRED: 0 insertions AND 0 deletions — the file must not appear in the output at all
```

### The criteria table — what each defends, and its disposition

| # | Path | Decision defended | Required | Why |
|---|---|---|---|---|
| 1 | `frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx` | **D-05** · SC#2 · SC#3 | **deletions = 0** (insertions allowed) | D-05's falsifiable form: *the pre-draft describe screen is byte-unchanged — zero new controls, zero new required input, zero new gates.* Guidance must not turn "Describe & run" into the strict door. Insertions are fine (a wave may ADD a row to the capture table); a deletion means a captured string was rewritten to make a red run green |
| 2 | `frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` | **D-05** · SC#2 · SC#3 | **deletions = 0** (insertions allowed) | The LOOSE door is the door SC#3 is actually about (*a user can still get a one-shot draft*). ⚠ Both screens carry the same splice anchor `<div className="flex flex-col items-center gap-3">`, so a plan that splices "at the CTA group" can land on the wrong door — this fence is what catches it |
| 3 | `frontend/src/components/workflows/SeedReceipt.tsx` | **D-02** | **`0 0`** — must not appear in the diff at all | `SeedReceipt` is a **governance** receipt, not a general "here is what I decided" receipt. Its docblock binds it hard and each clause is enforced by a source fence with a positive control (*"authors no sentence of its own"*, *"declares no predicate of its own"*, *"imports nothing from the API client, names no route and opens no request"*). This phase **composes** it beside a new sibling; widening its charter would cost exactly the guarantees that make it checkable |
| 4 | `backend/app/services/harness/publish_service.py` | **D-11** · **D-20** | **`0 0`** — must not appear in the diff at all | D-11: answering the rows **IS** how you become publish-ready, *with the gate learning nothing new*. D-20 narrows D-11's reach to **row 3 only** — measured from source, stage 1 `business_requirement_missing` (`grounding.py:1007`) is the ONLY definition-level predicate; nothing anywhere refuses a publish for a missing KB binding, template, name or deliverable. The rows READ this source (D-12); they never teach it |

### Starting state — all four, run now at the base SHA

```bash
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
       frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
       frontend/src/components/workflows/SeedReceipt.tsx \
       backend/app/services/harness/publish_service.py
                                                                   [no output — exit 0]
```

**Empty output on all four rows: 0 deletions, 0 insertions.** Trivially true — nothing has been
edited — and recorded precisely *because* it is trivially true now. A later wave comparing against
this line knows the starting point was clean rather than assuming it.

### ⚠ THE TWO EXCLUSIONS — name them, so a later executor cannot mistake one for the other

**These are two different literals with two different dispositions in this phase, and a plan that
conflates them will either block itself or waive the wrong one.**

**EXCLUSION 1 — `frontend/src/pages/WorkflowBuilderPage.header.test.tsx` is NOT under a
zero-deletion criterion.** It holds `FLAG_OFF_HEADER_MARKUP`, whose **band 3** is the `<header>`
hosting `identityGroup`. D-19 makes the drafted header render `meta.name ?? meta.slug` — one
expression at `WorkflowBuilderPage.tsx:2203`, which sits *inside* band 3 and forces a re-capture.
Plan **`197-10`** performs that re-capture as a **declared, dated, one-time act with its own task**,
never a silent edit folded into another. ⚠ **Band 3's own note (`:2181-2184`) says the phase that
wrote it expects NO THIRD re-capture — this phase is the third, and it says so out loud.** The
D-05 fence above pins the **pre-draft** screen and is structurally blind to the **drafted** header;
they are not the same literal and the exclusion is not a loophole in D-05.

**EXCLUSION 2 — `scripts/vitest-count-gate.cjs` is NOT under a zero-deletion criterion.** Raising a
per-file pin **necessarily deletes the line carrying the old number**. A check of the form
`grep -c '^-[^-]'` expecting `0` on that file is therefore **wrong by construction** and will fire
on correct work. The gate's contract is *no per-file DECREASE in the count* and *zero failing* — it
is not a contract about the deletions in the gate script's own diff.

### The standing instruction

**Run all four commands at EVERY WAVE MERGE and again at PHASE CLOSE** — not once. A non-zero
deletion on any of the four rows is a **behaviour change to explain**, never a test to update. The
correct response is to open the wave's plan and either (a) explain the behaviour change and declare
the re-capture there with a date and a reason, or (b) revert the source change. Silently absorbing
the deletion destroys the only evidence that the fast door is still fast.

---

## Task Commits

1. **Task 1: the three shipped pre-draft baselines, green at the base SHA** — `4f3298c4` (test)
2. **Task 2: the four gate baselines + six ledger triples, re-derived** — `2789c8fa` (test)
3. **Task 3: the four standing numstat criteria + two exclusions** — `ba94ef92` (docs)

## Files Created/Modified

- `.planning/phases/197-guided-authoring/197-01-SUMMARY.md` — created; the phase's evidence record

**No source file was modified.** Proof, run at the end of the plan:

```bash
$ git status --short
                                                                   [empty]
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD
343     0       .planning/phases/197-guided-authoring/197-01-SUMMARY.md
```

**One path in the whole diff, and it is a planning document.** `files_modified: []` is genuinely
empty — verified, not asserted.

## Accomplishments

- The phase base SHA is a **literal** every later wave substitutes, rather than a description each
  re-derives (and possibly re-derives differently).
- The D-05 fence is proved green **BEFORE** any source byte moved — 188.1's binding lesson, honoured
  rather than quoted.
- The phase's single largest triage hazard is now bounded: `WorkflowBuilderPage.canvas.test.tsx` is
  BOTH one of SEED-171's five flaky suites AND a suite this phase extends, so a red run on it is
  only interpretable against a verdict taken now. That verdict exists.
- **A scope error in the plan's own backend baseline command was caught by measurement** — see
  Deviations.

## Decisions Made

- **No second baseline capture was authored.** The shipped 193/193.1/187 fence predates this phase by
  four phases; a capture taken today would postdate `197-CONTEXT.md` and manufacture the
  drift condition the fence's own docblock names. This was the plan's instruction and it is recorded
  as a decision because the tempting alternative (a fresh, phase-local capture) looks more rigorous
  and is strictly weaker.
- **The backend baseline is recorded at BOTH scopes**, with `backend/tests` (whole) flagged as the
  comparable one, rather than silently substituting the plan's narrower command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] The plan's backend baseline command measures a different scope than the figure it says to compare against**

- **Found during:** Task 2
- **Issue:** The plan's `<action>` item 3 names `pytest backend/tests/unit -q` and directs the
  executor to compare against `197-RESEARCH.md`'s inherited **`211 failed / 4046 passed`**.
  `211 + 4046 = 4257`, but `backend/tests/unit` collects only **2337**. Recording the unit-only
  number under a heading that invites comparison with the whole-tree number would have written a
  **rotted baseline into the artifact whose entire purpose is to prevent rotted baselines** — and
  the first later wave to run `pytest backend/tests` would have read a 148-test "regression" or a
  1767-test "improvement", neither of which happened.
- **Fix:** Ran BOTH scopes and recorded both summary lines verbatim, with `--collect-only` (4301)
  proving which one the inherited figure came from, plus a standing instruction naming
  `backend/tests` as the comparable scope.
- **Files modified:** none (the SUMMARY only)
- **Verification:** `pytest tests -q` → `212 failed, 4041 passed, 33 skipped, 5 xfailed, 9 xpassed,
  266 warnings, 1 error`; `pytest tests -q --collect-only` → `4301 tests collected`
- **Committed in:** `2789c8fa`

**2. [Rule 3 — Blocking] The count gate's first run died in its JSON reporter with `ENOSPC`, not on a test failure**

- **Found during:** Task 2
- **Issue:** First invocation exited **2** with
  `Error: ENOSPC: no space left on device, write` inside `JsonReporter.writeReport`, followed by
  `FATAL: the vitest report at …json is not valid JSON: Unexpected end of JSON input`. **The suites
  themselves ran; the reporter could not write its ~1.5 MB report.** Volume `C:` was at **99% used
  / 7.2 GB free** at that moment, with a concurrent `tsc` and a concurrent `pytest` on the box.
- **Fix:** ⚠ **The cap was NOT touched** (CLAUDE.md CORRECTION 2026-08-17 — reaching for the cap on a
  red gate is the refuted move). The failure was diagnosed as an environment condition rather than a
  gate or test defect, the box was allowed to quiesce, and the gate was re-run **alone**. Free space
  had recovered to **30 GB** by then, confirming transient pressure. The re-run returned
  `count gate OK — 89/89 pinned files present, no per-file decrease, 0 failing`.
- **Files modified:** none — no operator file was deleted to reclaim space
- **Verification:** `df -h /c` before (`7.2G avail`) and after (`30G avail`); the clean verdict line
  quoted in Task 2
- **Committed in:** `2789c8fa`

⚠ **Recorded rather than swept, because the failure MODE is worth knowing:** an `ENOSPC` in the
reporter looks like a gate failure and reads as exit code 2, but it carries **no test verdict at
all**. There were ~2.3 GB of stale `vitest-count-gate-*.json` reports accumulated in the OS temp
directory from prior runs; **none was deleted** — reclaiming operator disk space is an operator
action, not an executor's.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both strengthen the artifact this plan exists to produce. Deviation 1 in
particular would have poisoned every later wave's backend comparison — precisely the class of error
this plan was written to prevent. No scope creep: no source file was touched.

## Issues Encountered

None beyond the two deviations above. All three baseline suites and the count gate were green at the
base SHA on a clean tree.

## Next Phase Readiness

**Ready. Every later plan in this phase can now run the D-05 criterion without re-deriving anything.**

Standing obligations this plan hands forward:

1. **Run the four numstat commands at every wave merge and at phase close.** They are copy-pasteable
   above with the base SHA already substituted.
2. **`197-10` owes a DECLARED, DATED re-capture** of `FLAG_OFF_HEADER_MARKUP` band 3 — and must state
   that it is the **third** re-capture of a literal whose own note expects no third.
3. **Use `backend/tests` (whole), not `backend/tests/unit`,** for any comparison against the
   211/4046 lineage. Current measured baseline: **212 failed / 4041 passed / 1 error**.
4. **Re-derive the six ledger triples at phase close.** Zero drift today; most of these six will be
   touched during wave 2, so today's zero is not tomorrow's.
5. ⚠ **`count gate OK` is not reliably reachable on demand.** A plan whose acceptance criterion is
   "the gate is green" has written a criterion that can fail for reasons no plan controls. Pair it
   with per-file deltas and the explicitly-run in-scope suites, which are deterministic.

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| SUMMARY exists | `ls -la .planning/phases/197-guided-authoring/197-01-SUMMARY.md` | FOUND (27,364 bytes) |
| Task 1 commit exists | `git log --oneline` | FOUND `4f3298c4` |
| Task 2 commit exists | `git log --oneline` | FOUND `2789c8fa` |
| Task 3 commit exists | `git log --oneline` | FOUND `ba94ef92` |
| Base SHA present as a 40-char literal | `grep -c '52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07'` | 7 occurrences |
| No source file modified | `git diff --numstat <base> HEAD` | one path, and it is this SUMMARY |
| Working tree clean | `git status --short` | empty |

## Threat Flags

None. This plan crossed no trust boundary, installed no package, and modified no source file.
`T-197-BASE` (Repudiation, the phase's own evidence trail) is **mitigated as planned** — the base
SHA, three baseline verdicts and four gate baselines are recorded as literals with their commands
beside them. `T-197-SC` (Tampering, package installs) remains **vacuous-with-reason**: no package
was installed and none was proposed.

---
*Phase: 197-guided-authoring*
*Completed: 2026-08-18*
