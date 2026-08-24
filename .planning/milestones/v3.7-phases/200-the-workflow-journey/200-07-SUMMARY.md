---
phase: 200-the-workflow-journey
plan: 07
subsystem: ui
tags: [run-surface, run-receipt, phase-durations, declared-counts, d-06, d-07, d-09, fences, hot-file-ledger]
status: COMPLETE
completed_tasks: 3
total_tasks: 3

# Dependency graph
requires:
  - phase: 200-01
    provides: "the CHECKLIST §4 acceptance bar, §6 baselines, §6.6's two owed ledger rows (X-16)"
  - phase: 200-02
    provides: "started_at / completed_at / step_count / step_noun on the wire — ⚠ on three of four CLIENT mirrors, see the deviation"
  - phase: 200-05
    provides: "phaseDuration.ts (D-06's nine arms), receiptVocabulary.ts, RunReceipt.tsx — the last mounted NOWHERE"
  - phase: 200-06
    provides: "the canvas payload-label seam, deliberately left unwired for this plan"
provides:
  - "The run surface's panel half and page half rendering the SAME durations from the SAME resolver"
  - "RunReceipt MOUNTED — its first render in the product, on the run page and reachable from nowhere else"
  - "The product's FIRST honest total runtime: min(started_at) → max(completed_at) over the phase rows"
  - "The declared count reaching the live run canvas — 200-06's recorded hand-off, wired"
  - "A §4.2 MUST NOT RENDER fence driven RED against a plant in production source"
  - "Two ledger rows that were ABSENT for their files' entire lives (PhaseTimeline.tsx, phaseStatusMeta.ts)"
  - "phaseStatusMeta.ts's first dedicated suite, in both count-gate knobs"
affects: [chat-workspace-panel, workflow-run-surface, any future phase touching PhaseTimeline or phaseStatusMeta]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A frame re-read that is LATEST-WINS BY SEQUENCE, with abort scoped to the thread — because cancel-on-every-trigger dropped its own re-read against a fetch-derived slice"
    - "A characterization pin answered by MOVING the new atom rather than re-baselining the pin (199-03's precedent, applied to a positional status-atom inventory)"
    - "A superseded fence INVERTED to name its one permitted importer, never deleted"

key-files:
  created:
    - frontend/src/components/panel/phaseStatusMeta.test.ts
  modified:
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/components/panel/PhaseCard.test.tsx
    - frontend/src/components/panel/PhaseTimeline.tsx
    - frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx
    - frontend/src/components/panel/phaseStatusMeta.ts
    - frontend/src/components/workflows/RunReceipt.test.tsx
    - frontend/src/lib/api.ts
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/pages/WorkflowRunPage.test.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md

key-decisions:
  - "The total runtime is rendered ONCE, at the top of the receipt region, and deliberately NOT also in the page header — two UNLABELLED clocks one under the other is the duplicate-status defect an operator reported on this exact surface on 2026-08-06"
  - "The panel's new reading is sited in the IDENTITY COLUMN, not the status atom, because PhaseCard.test.tsx pins that atom's children POSITIONALLY across nine statuses — the pin passed unedited"
  - "PhaseTimeline's frame re-read is latest-wins by sequence rather than cancel-on-dep-change: the measured alternative dropped its own re-read and left a STALE READING"
  - "No `deliverableOf` is passed to the receipt — nothing on workflow_phases says which file a step produced, so a join would be a fabricated claim about WHICH step made WHAT"
  - "BUG-260610-01's status: open is NOT flipped; its duplicate-avatar half is live and the report has already been mis-indexed twice"

requirements-completed: [DES-02]

# Metrics
duration: ~3h
tasks: 3
commits: 3
files_created: 1
files_modified: 12
completed: 2026-08-20
---

# Phase 200 Plan 07: The Run Surface Summary

**The screen this whole phase exists for now says what a run actually did — a real total runtime
derived from the steps that really ran, a real duration per step, a count only where a step declared
one, and the receipt `200-05` built rendering in the product for the first time.**

## Base SHA

⚠ **The wrong-base fork fired again — the SEVENTH consecutive wave**, exactly as the dispatch
predicted.

| | SHA |
|---|---|
| worktree's actual fork point | `3781a3fe4690a9619e619f4cc412bd37a7dafc52` |
| **dispatched base (reset to)** | **`c9238cb0b26dacd8c54384e7e473df354dcc7e7e`** |

The plan's `<execution_context>` cites `fe40ce1c` as the planning SHA; per the dispatch that is a
known stale pointer and this base contains waves 1–6. `bash scripts/bootstrap-worktree.sh` ran
second → `BOOTSTRAP OK`.

---

## `run-surface`: **13 / 13 atoms** — no miss

Per `200-CHECKLIST.md` §4, cited by row id. ⚠ **`ALREADY-SHIPPED` is not a pass in this phase**, so
both `VERIFY` rows below were **driven**, not grepped.

### §4.1 MUST RENDER — 6/6

| id | verdict | evidence |
|---|---|---|
| **RS-MR-01** | ✅ BUILT | The step's own declared `{count, noun}`, on **both** halves. The panel card renders it beside the reading; the page forwards it into `NodeRunState` so it reaches the **live run canvas** — `200-06`'s recorded hand-off, wired. Driven with `zzqx`, a noun no vocabulary in this tree contains, so a substitution anywhere on the path is visible rather than plausible. |
| **RS-MR-02** | ✅ BUILT | A real per-step duration from the new `started_at`/`completed_at`, on both halves, resolved by the ONE `phaseDuration.ts`. Asserted as exact strings (`12s`, `48s`), not shapes. |
| **RS-MR-03** | ✅ BUILT | `min(started_at) → max(completed_at)` across the phase rows — **the product's first honest total runtime**. Driven at `Ran 1m 00s` over a fixture whose span (60s) is deliberately **not** any single row's duration (12s / 48s), so a span computed from one row reads differently and is caught. |
| **RS-MR-04** | ✅ BUILT | D-06's six arms **plus the two measurement added** (`200-05`'s `unfinished` and wave 3's `paused`) — **EIGHT readings asserted as EIGHT distinct strings** in one case, which is the property a per-arm loop cannot show. |
| **RS-MR-05** | ✅ BUILT | `RunReceipt` **mounted**, on this page and reachable from nowhere else. Its first render in the product. |
| **RS-MR-06** | ✅ **VERIFIED — DRIVEN** | The Phase-195 deliverable listing rendered with a real `.docx` row, its basename visible, **exactly one control** in the region, and that control a download with its accessible name. Not a source read. |

### §4.2 MUST NOT RENDER — 7/7

| id | verdict | how it is PROVED |
|---|---|---|
| **RS-MNR-01** | ✅ FENCED | A count slot may hold `{integer} {noun}` or **not exist**. Prose in it (N-8's own `Summarized meeting notes`) is a violation the predicate names. |
| **RS-MNR-02** | ✅ FENCED + **STRUCTURAL** | Two halves. The fence forbids a `so far` reading on a terminal run, on a non-`running` arm, and on any row whose outcome says it never ran. Structurally, the panel's tick is **gated on the run being live** so a terminal run re-renders nothing, and `phaseDuration`'s `unfinished` arm carries an `active` row under a terminal run. Both driven. |
| **RS-MNR-03** | ✅ FENCED | A bare `0`, every dash form and an empty slot are violations; **a declared `0 sources` PASSES**, and that positive arm is asserted — suppressing it would delete a real finding, the mirror-image error of inventing one. |
| **RS-MNR-04** | ✅ FENCED | `never ran (skipped)` vs `time not recorded` proved different on **both** halves, and on the panel **in one render** rather than two — two separate renders can each be "correct" while a single list still collapses them, and a list is what a person reads. The boolean a careless implementation would use is built in the case and **shown to collapse them**. |
| **RS-MNR-05** | ✅ **REPORTED**, with its trigger | See the REPORT register below. Its **absence is asserted**, not merely stated. |
| **RS-MNR-06** | ✅ FENCED | Ligature names in **both** shapes — containment for the snake_case forms, whole-leaf equality for the bare ones (`add`, `check`, `person` are ordinary English and a containment needle on them fires on honest copy). |
| **RS-MNR-07** | ✅ **VERIFIED — the fence STANDS, unedited** | `git diff -U0 -- WorkflowRunPage.test.tsx \| grep -c '<the fence title>'` → **0**; `grep -c FilePreview WorkflowRunPage.tsx` → **0**. Plus an independent statement that the **new** surface opened no file-content path: the receipt renders zero deliverable slots, with a positive control proving it *can* render that slot — so the absence is a decision, not a missing feature. |

---

## The fence was DRIVEN RED against a plant in PRODUCTION SOURCE

Binding constraint 8 asked for it, and it paid.

| step | result |
|---|---|
| pre-plant checksum | `md5 051e4ee71625b2f6b6602cf3a9358804` (`RunReceipt.tsx`) |
| plant | the count slot's conditional replaced by an unconditional render falling back to an em-dash, plus `<span>check_circle</span>` — **in `RunReceipt.tsx` itself**, not a fixture |
| fence verdict | **RED**, `expected [ 'RS-MNR-03', 'RS-MNR-06' ] to strictly equal []` on **both** real-render cases (terminal and live) |
| restore | `git checkout --` → `md5 051e4ee71625b2f6b6602cf3a9358804`, **identical**, `git diff --numstat` **empty** |

**Two PERMANENT controls are committed**, and the positive one is asserted **before** any absence
claim:

- a planted violation of **each of the four row ids** — including one smuggled into a **link's**
  `aria-label`, the exact shape `199-03` proved a button-only scan walks straight past — found, all
  four, as an exact set equality rather than a count;
- the **honest shipped copy**, silent: a declared `0 sources`, a live `12s so far` on the running
  arm, `never ran (skipped)`, `time not recorded`, `no finish time recorded` and a real download's
  accessible name.

⚠ **Non-vacuity is asserted before contents on the real renders too** — the predicate is shown to
have found the slots it reads (`> 0` time slots, `> 0` count slots, `> 10` leaves) before a clean
result is allowed to mean *nothing wrong* rather than *nothing there*. **Wave 3 shipped a fence that
was reached and wrote nothing**, and that is the failure this guards.

### ⚠ The 187-24 trap fired THREE times in this plan, each caught by its own grep

Not once, and the repetition is the finding rather than the incident:

1. `PhaseCard.tsx`'s own comment explaining the forbidden zero-coalesce **contained it**, so the
   acceptance grep read `1` instead of `0`;
2. a new test comment **re-typed the shipped previewer fence's title**, so the *"the fence is
   unedited"* diff-grep read `1`;
3. (pre-empted) the ligature needle set was split into two shapes before it could fire on
   `no finish time recorded`.

Every one was **reworded, never loosened**. A guard whose own explanation defeats it is a guard that
eventually gets its explanation deleted instead.

---

## The two things this plan INHERITED, and what happened to each

### 1. The receipt was mounted — and `200-05`'s own fence went RED, correctly

`RunReceipt` was **exported and mounted nowhere** at `200-05`'s close: pinned, suited, and never
once rendered in the product. Mounting it here made `200-05`'s `is MOUNTED NOWHERE` case fail —
**which is the fence working at the exact moment its invariant was deliberately superseded**, not a
fence that rotted. `200-05`'s own docblock predicted this edit in as many words.

It is **INVERTED, not deleted** (the `192.2-05` method, and `200-05`'s own `BS-MNR-01` precedent one
file over): the sweep now pins the importer list at **exactly one named file**, and names the two
run-less surfaces explicitly. A **second** mount — above all on the builder, where a past-tense claim
about a draft would be fabricated — reddens it again. A removed assertion proves nothing afterwards.

### 2. `WorkflowRunPage.tsx:721`'s one-line supply — wired

`200-06` shipped the seam, the relay and the render for the canvas payload label and recorded, in
writing, that the production supply line belonged here. It is one field pair forwarded into the
`NodeRunState` the page already builds. **The page declares; nothing downstream counts.** A declared
`0` forwards as `0`; an absence forwards as an absence.

⚠ **`200-06`'s second inheritance was checked rather than assumed**, as its SUMMARY asked: none of
its five canvas additions is gated on `editable`, so the run-page mount really does gain the payload
label, `data-connection-state`, the legend, edge hover/selection and the theme-following plane. The
run page's canvas mount is unchanged by this plan apart from the two new fields.

---

## Deviations from Plan

### 1. `[Rule 3 — blocking]` The client mirror of transport 3 was missing all four fields

**Found during:** Task 1, reading the plan's `<interfaces>` block against the source.

**Issue.** The plan states *"Both transports now carry these (200-02)"*. **Measured, only one client
mirror did.** `200-02` widened the **backend** `WorkflowPhaseState` (`backend/app/models/thread.py:122-125`)
and the **frontend** `WorkflowRunPhase` (`api.ts:4183-4211`) — but **not** `api.ts`'s
`WorkflowPhaseState`, the client mirror of `GET /threads/{id}/workflow`. So the wire had been
sending `started_at` / `completed_at` / `step_count` / `step_noun` to the chat panel since `200-02`,
and the panel could not declare them.

This is exactly the failure `200-02`'s own SUMMARY says the four-transport widening exists to
prevent, verbatim: *"widening only the other model would ship a run page with durations and a chat
panel without them."* The Python half was right and its client half was not.

**Fix.** Four optional fields added to `api.ts`'s `WorkflowPhaseState`, with the semantics stated
once on the sibling interface. ⚠ **A TYPE, not a runtime export** — see the D-15 proof below.

**Files:** `frontend/src/lib/api.ts`. **Commit:** `4f4bc172`.

### 2. `[Rule 1 — bug]` The frame re-read cancelled itself, and a starved read here is a STALE READING

**Found during:** Task 1, driving the fetch-authoritative case.

**Issue.** The obvious implementation — one effect keyed on `[threadId, phaseSignature]` with a
per-effect `cancelled` flag — **dropped its own re-read.** `PhaseTimeline`'s slice is *itself*
fetch-derived (`usePhases` mounts `usePanelReconcile`, whose fetcher REPLACES the whole slice), so a
settling reconcile changes the signature and tears down the effect that is at that moment awaiting
the answer. **Observed: four reads issued, the frame still holding the first one's payload.**

That is not a test artefact. In a churny moment it starves the read indefinitely — and a starved
read here does not render a blank, it renders a **stale duration**, which is the single failure mode
this whole screen exists to remove.

**Fix.** The abort is scoped to the **thread** (where cancelling really is right — a previous
thread's answer must never land); staleness is settled by a **monotonic sequence**, so a later
request always wins and an earlier one arriving late is discarded rather than cancelling anybody.

**Files:** `frontend/src/components/panel/PhaseTimeline.tsx`. **Commit:** `4f4bc172`.

### 3. `[measurement]` A test-harness fact worth not rediscovering

`streamsStore.ts:477` declares **every** store action as a **no-op stub**; the real bodies are
registered by `StreamsProvider`'s mount effect (`StreamsProvider.tsx:1541`). So
`useStreamsStore.getState().actions.replacePhasesForThread(...)` **silently does nothing** unless a
provider is mounted — and `PhaseTimeline.test.tsx`'s shipped cases that call it work only because an
earlier `replayFixture` in the same file happened to mount one. The two new cases that drive a live
transition mount the provider **themselves** rather than inheriting a mount from whichever test ran
first. Recorded in the suite at the helper.

### 4. `[siting]` `RS-MR-03`'s total runtime is rendered ONCE, and not in the page header

`RS-MR-03`'s source note cites the screen's `00:42` *"in the header"*. **The figure is rendered at
the top of the receipt region instead**, and this is a decision rather than a shortfall:

- the page header **already** carries an elapsed figure, anchored on `created_at → updated_at` and
  **labelled in words** (*from when it was queued*);
- the two measure **different things** — one includes queue time, the other is the steps that really
  ran — so both are honest **only while each says which**;
- two **unlabelled** clocks one under the other is precisely the duplicate-status defect an operator
  reported **on this exact surface on 2026-08-06**, which is why the run band is `sr-only` today.

A case asserts the two figures are distinct and that the header names its own anchor. **This is a
deviation to explain, not a quiet edit** — `200-CHECKLIST.md` may not be edited by a later plan.

### 5. `[correction]` The plan's premise about `BUG-260610-01`'s timer half is REFUTED

The plan says the shipped elapsed *"is anchored at component MOUNT (`:845-877`), which is exactly
why navigating away and back restarts it"*, and instructs this plan to re-anchor it.

⚠ **Measured, that is not what the code does.** F3 and F6 had already moved the anchor to
`claimed_at ?? created_at` — **both server timestamps** — so the header figure was remount-stable
before this plan touched anything. Re-anchoring it would have been a change with no defect behind it.

**What this plan actually adds is a SECOND figure** — the phase-derived span — also server-anchored.
So the honest claim is that **both** figures are structurally remount-proof, and **both** are
asserted that way (render → unmount → re-render with identical props ⇒ identical readings, with a
non-vacuity arm so *"unchanged"* is not *"empty twice"*). Asserting one and assuming the other is
what this correction exists to avoid.

⚠ **`BUG-260610-01`'s `status: open` is NOT flipped**, and it is **not in this plan's diff**
(`git diff --numstat -- .planning/reported-bugs/` → empty). Its duplicate-avatar half is live, has
survived two folds (174, 194.1), and a `folded` status would hide it from the routing scan for a
third time.

### 6. `[recorded]` `--reporter=basic` was dropped from every command

Binding constraint 12: it is a startup error on vitest 4.1.0. The plan's `<verify>` blocks carry it;
no command run here used it.

---

## Baselines — measured, with every increment attributed

### The vitest count gate

| when | verdict |
|---|---|
| §6.1 (wave 1) | `total 4970 · failed 0 · pinned 4543 · 96/96` |
| wave 6's close | `total 5135 · failed 0 · pinned 4755 · 101/101` |
| **at this plan's close** | **`count gate OK` — `total 5184 · failed 0 · pinned total 4824 · 102/102 pinned files present, no per-file decrease, 0 failing`** |

**Every increment attributed, with no residual** — which is what distinguishes growth from drift:

| source | grand total | pinned total |
|---|---|---|
| `WorkflowRunPage.test.tsx` — 25 new cases (**+4 pre-existing slack de-slacked**) | +25 | +29 (pin 108 → 137) |
| `PhaseCard.test.tsx` — 9 new cases (**+5 slack**) | +9 | +14 (pin 27 → 41) |
| `PhaseTimeline.test.tsx` — 7 new cases (**+11 slack**) | +7 | +18 (pin 17 → 35) |
| `phaseStatusMeta.test.ts` — new, pinned in its creating commit | +8 | +8 |
| **total** | **+49 → 5184** ✅ | **+69 → 4824** ✅ |

⚠ **TWENTY of that pin raise is DE-SLACKING, not new coverage**, and it is closed in the same commit
that adds the new cases. `PhaseTimeline.test.tsx` was running **28** against a pin of **17** on the
unmodified tree — an owed re-pin carried since **190-12**, which recorded it at `17 / 21` and
deliberately did not take it. Eleven cases there, five in `PhaseCard.test.tsx` and four in
`WorkflowRunPage.test.tsx` were **deletable with this gate green**. The gate's own §187-29
correction is why that matters: *"a pinned TOTAL rising proves nothing about the NEW cases, because
slack inside an already-listed file absorbs them."*

**All four pins read EXACT** on the closing run (`137 137 0`, `41 41 0`, `35 35 0`, `8 8 0`).

⚠ **The two-knob trap, ELEVENTH occurrence.** `phaseStatusMeta.test.ts` needed **both** entries, and
that was **measured, not assumed**: `src/components/panel` is reached by four NAMED files and by no
directory entry, so on the run after the suite existed but before its `TARGETS` line did, **the
gate's own printed run command did not contain it and the file never appeared in the output at all.**

⚠ **THE GATE NEVER REDDED** across this plan, so `SEED-171`'s triage procedure was never entered and
the worker cap was never touched. **Recorded as an observation, not as proof of innocence** —
`WorkflowRunPage.test.tsx` is one of the five and is this plan's primary suite; it read `failed 0`
on every invocation, and **one green sample of a flaky suite is not proof of anything.**

### Backend, typecheck, CLAUDE.md

| Gate | §6 baseline | measured at this plan's close | verdict |
|---|---|---|---|
| `pytest tests/unit -q` | `62 failed / 2350 passed` | **`62 failed, 2350 passed, 2 xfailed, 2 xpassed`** | **unmoved** |
| `tsc -p tsconfig.app.json --noEmit` | `33 errors / 19 files` | **33 / 19** | **unmoved**, and **zero in any file this plan touched** |
| `check-claude-md-size.cjs` | — | **98,113 chars · 65.4% · exit 0** | OK |

⚠ One new typecheck error was introduced and **fixed before the commit** — a `.map(toPhase)` whose
inferred element type widened `status` to `string`. Caught by the `33 / 19` criterion, which is
exactly why the criterion is a pair of numbers rather than the word "clean".

### D-15 — proven by grep over the REAL diff, never by quoting the decision

```
git diff -U0 c9238cb0 HEAD -- frontend/src/lib/api.ts \
  | grep -E '^\+' | grep -E '^\+\s*export\s+(const|function|class|let|var|enum)\b'
⇒ EMPTY
```

`api.ts` is **`+28 / −0`** and the whole change is **four optional fields on an existing interface**
— a TYPE, fully erased at build. **The 197 decline HOLDS and its re-open trigger did not fire**;
`196-08`'s mock-factory failure mode measurably cannot fire from this diff.

---

## Hot-file ledger — two rows ADDED because they were ABSENT, three refreshed

Every triple **re-derived from git**, never copied. `⚠ Quick-task buckets: CHECKED, none exist` on
both new rows.

| file | ledger read | **re-derived 2026-08-20** |
|---|---|---|
| `frontend/src/components/panel/PhaseTimeline.tsx` | ⚠ **ABSENT from BOTH** | **`8 / 6 / 370`** — FIRES |
| `frontend/src/components/panel/phaseStatusMeta.ts` | ⚠ **ABSENT from BOTH** | **`3 / 3 / 236`** — FIRES, **exactly at threshold** |
| `frontend/src/pages/WorkflowRunPage.tsx` | `15 / 5 / 1197` | **`16 / 6 / 1329`** |
| `frontend/src/components/panel/PhaseCard.tsx` | `12 / 8 / 543` | **`13 / 9 / 623`** |
| `frontend/src/lib/api.ts` | `174 / 99 / 6357` | **`176 / 100 / 6430`** |

⚠ **`PhaseTimeline.tsx` had NO row at any count, for its entire life** — so G-5 could never have
fired on it, at five phases or at fifty. That is the identical failure `WorkflowsPage.tsx` suffered
for ten phases and `config.py` for the project's whole life.

⚠ **`phaseStatusMeta.ts` CROSSED the threshold in the very commit that adds its row.** §6.6 measured
it at `2 / 2 / 206` and classified it `no (2 phases)`; it is `3 / 3 / 236` now. That is the second
time in this one phase (`FlowEdge.tsx` did the same at `200-06`) and it is precisely why the
ledger's rule is *list it below the threshold anyway* — **a file escapes G-5 by not being written
down.**

⚠ **THIS PHASE HAS NOW FOUND A LEDGER CELL STALE AT EVERY SINGLE CLOSE — five waves out of five**,
and twice the same cell was stale in **two documents at once** (`CLAUDE.md` and `200-CHECKLIST.md`
§6.6, the latter re-derived by `200-01` only hours earlier in the same phase). The recipe is the
artefact; the cell is not.

Row + section landed in the **same commit** as the modification (`a382956b` carries `CLAUDE.md`,
`docs/HOT-FILE-LEDGER.md` and `scripts/vitest-count-gate.cjs` together).

---

# ═══ THE PHASE'S CLOSING REPORT — all four screens ═══

This is the phase's final plan, so the report below is the phase's, not this plan's. Verdicts for
§1–§3 are read from their owning plans' SUMMARYs; §4's are this plan's.

## N/N per screen

| § | Screen | owning plan | MUST RENDER | MUST NOT RENDER | **verdict** |
|---|---|---|---|---|---|
| §1 | `step-panel` | `200-04` | 7/7 (one PARTIAL) | 7/7 | **13 / 14 — the miss NAMED** |
| §2 | `builder-spine` | `200-05` | 6/6 | 6/6 | **12 / 12** |
| §3 | `builder-canvas` | `200-06` | 5/5 (one PARTIAL) | 5/5 | **9 / 10 — the miss NAMED** |
| §4 | `run-surface` | `200-07` | 6/6 | 7/7 | **13 / 13** |
| | **TOTAL** | | **24** | **25** | **47 / 49 — two PARTIALs, both named, zero silent** |

**Against §5.2's census exactly:** 24 MUST RENDER + 25 MUST NOT RENDER = **49**. No atom was dropped,
none was silently reinterpreted, and **every deviation from the checklist's wording is recorded in
its plan's SUMMARY** — the rule that makes `N/N` mean something.

## The two PARTIALs, named rather than aggregated away

| id | screen | what is missing | **Re-open trigger** |
|---|---|---|---|
| **`SP-MR-03`** | `step-panel` | The **per-folder lock state**. It is **not on the wire** — `kb_folder_ids` is a bare `string[]` of ids and the only lock this product has is the STEP's grounding lock. Inventing a per-folder one would be the fabricated claim `199-05` refused. **Reported, not faked.** | *a phase that scopes per-folder lock state onto the wire* |
| **`BC-MR-04`** | `builder-canvas` | The **second half** — the node's 62 px filled icon-well disc is not re-toned. Measured before deciding: **3** `CARD_HTML_BASELINE` captures contain that markup byte-for-byte, plus **11** further `radial-gradient` assertions across two suites. Re-toning means re-baselining a **characterization pin**, and `199-03`'s precedent is to WITHDRAW rather than re-baseline. Every mark `200-06` *did* draw is line vocabulary. | *the next phase that opens `PhaseNodeCard.tsx` or `NodeIconWell.tsx` for a visual reason* — it should carry the re-tone and the baseline splice together |

## REPORTed atoms — three in-screen + six register rows, each with its trigger

⚠ **Nothing here was quietly promoted into a build.** A later plan that finds itself building one of
these has grown a capability inside a phase that did not scope one — the G-7 failure mode, in
miniature.

| id | § | what | **Trigger** |
|---|---|---|---|
| **`SP-MNR-05`** | §1 | recorded with its own needle control | as recorded in `200-04-SUMMARY.md` |
| **`SP-MNR-06`** | §1 | recorded with its own needle control | as recorded in `200-04-SUMMARY.md` |
| **`RS-MNR-05`** / **`RS-3b`** | §4 / §5 | the **sub-step execution trace**. The sketch draws **EIGHT** `00:0x` trace lines for a **FIVE**-step run; several are sub-step events whose substrate is `harness_audit` / `EmitSubStep` — a **second backend concern**, deliberately not stacked here. Building it would have made ROADMAP SC#5's *"the extraction changes no behaviour beyond the human-gate fix"* unprovable. ⚠ **Its ABSENCE is asserted, not merely stated**: three phase rows ⇒ three receipt rows, no invented line, no `mm:ss` stamp. | *the phase that scopes `harness_audit` / `EmitSubStep` as a client transport* |
| **`SP-4`** | §5 | `Locked by Alex M.` — lock attribution. ⚠ N-7: the SCREEN draws the person-less form and **that form ships**, so nothing is missing from the render; what is missing is the attribution. | *a phase that scopes lock ownership* |
| **`SP-5`** | §5 | `Will overwrite 1,200 records` — a preflight row count is a **capability**, not a label | *the connections / approval milestone* — `SEED-146`, sequenced with `SEED-144` / `SEED-145` |
| **`RS-1`** | §5 | ⚠ **this screen has NO `now` capture** — `JOURNEY["run-surface"].now` is literally `null`, so §4's acceptance is **the proposal alone**. No "before" was invented and no comparison was claimed. | *a run that can be driven for capture* — after `200-02` + `200-07` land, a real 1440×900 capture pairs the screen and `now-08` joins `200-journey-now/` |
| **`FAN-OUT`** | §5 | the fan-out router — the spine is **LINEAR by recorded decision** | *a deliberate revisit of the linear-spine commitment* |
| **`X-6 ROW`** | §5 | the one driven browser row owed by `BUG-260807-01` + `BUG-260808-01`. **Not a repair — the code fix already landed.** ⚠ The fixture is **seeded and ready** (`200-06`) | *`200-06`'s UAT* — the slug must be swung **both ways** before either report is closed |

`RS-3b` and `RS-1` are recorded as **executable cases** in `WorkflowRunPage.test.tsx`, not as SUMMARY
prose: prose in a summary is read once; a case is re-read on every gate run.

## ⛔ OWED DRIVEN UAT ROWS — the phase's whole list, in one place

**Stated as a DECISION, never as a claim that everything ran.** None of these is asserted anywhere in
this phase's suites; every one needs a live run, a real browser or a real process restart.

| # | Row | Owed by | Why it cannot be automated |
|---|---|---|---|
| 1 | **The elapsed continues across a real route change** — start a workflow, navigate away and back | `200-07` / `BUG-260610-01` | needs a live run + a real route change. Both figures are asserted remount-stable in jsdom; a route change is not a remount |
| 2 | **Light mode on BOTH canvas mounts**, including a toggle made in `ChatLayout` while a workflow surface is open | `200-06` / `BUG-260813-01` | a forked `useTheme` passes on first load and fails exactly here |
| 3 | **Answer-after-pause resumes without a restart** — walk away past 300 s, return and answer | `200-03` / SC#4 / D-10 | no automated path drives real Redis pub/sub **plus** a real engine re-drive |
| 4 | **The BOOT sweep still re-drives a paused run after a process restart** | `200-03` | no automated case restarts a process |
| 5 | **The `constructor`-slug canvas row**, swung BOTH ways — flips `BUG-260807-01` **and** `BUG-260808-01` | `200-06` / X-6 | needs the seeded fixture (**ready**: `zz-200-06-fixture-constructor` + its control) and a computed-style read |
| 6 | **G-4 lived-experience** on `200-05`'s three subtractions and six built atoms — jsdom applies no CSS, so the badge's uppercase, the header's two-line shape and the node face's rhythm are DOM-asserted only | `200-05` | CSS is not applied under jsdom |
| 7 | ⚠ **The four UAT scoreboard axes** — **cross-provider (the FULL native roster + OpenRouter, 8 rows, derived from `MODEL_CAPABILITIES`, blocked rows recorded ⛔ with reason and blocking id, NEVER omitted)**, multi-tool, parallel-thread, long-message | the phase | needs live runs against real providers |
| 8 | **`RS-1`'s NOW capture** — a real 1440×900 photograph of the run surface | `200-07` | there is nothing to capture until a run can be driven |

⚠ **Row 7 is the one most easily under-delivered.** CLAUDE.md's roster rule is explicit that testing
four providers and calling it *cross-provider* is what every scoreboard in this project has silently
done. Derive the roster by grouping `MODEL_CAPABILITIES` on `provider`; never re-type it.

## Cross-surface consequences the NEXT phase inherits

1. ⚠ **THE PANEL CHANGES LAND IN CHAT FIRST.** `WorkspacePanel` has exactly **one** production mount
   — `ChatLayout.tsx:673` — and **no workflow page mounts it at all.** Everything this plan did to
   `PhaseTimeline` / `PhaseCard` / `phaseStatusMeta` renders in the **chat workspace panel**, so UAT
   driven only against a workflow surface **will miss all of it**. This is the second phase running
   to inherit this property (`200-06`'s ThemeProvider was the first).
2. **The panel now issues a durable-row read per phase-status transition.** Bounded by construction
   (one read per transition, not a poll), latest-wins, aborted on thread change — but it is a new
   fetch on the chat surface and a reviewer should know it exists.
3. **The receipt is live.** Any change to `receiptVocabulary.ts` or `phaseDuration.ts` now has a
   **visible** consumer for the first time; before this commit both were pinned but unrendered.

## Threat Flags

None. No new network endpoint, no new auth path, no new file-access pattern, no schema change. The
new slug-keyed lookups route through `own()` over plain literals (T-200-07-03), no figure is invented
(T-200-07-01), the terminal-run arm removes the dead clock (T-200-07-02), **no file-content path was
opened** (T-200-07-04), the fetch stays authoritative (T-200-07-05), and both invisible hot files
gained rows (T-200-07-06). **No package was installed** (T-200-07-SC) — `package.json` and the
lockfile are untouched.

## Known Stubs

None. Every element added renders from a real server-supplied fact or renders nothing by design.
There is no placeholder text and no hardcoded empty value flowing to a surface — the four absences
this plan ships (`pending`, `skipped`, an undeclared count, a row the fetch has not mentioned) are
each an explicit arm with a recorded reason, not a stub.

## Commits

| # | hash | what |
|---|---|---|
| 1 | `4f4bc172` | Task 1 — the panel half: D-06's arms + D-07's count, the missing client mirror, the latest-wins frame read, `phaseStatusMeta`'s first suite |
| 2 | `a6889bf9` | Task 2 — the receipt MOUNTED, the phase-derived total runtime, the count's supply line into the canvas, D-17 driven |
| 3 | `a382956b` | Task 3 — the §4.2 fence (driven RED), the REPORT rows, the two owed ledger rows + three refreshed, the four pins |

## Self-Check: PASSED

- **File created — FOUND:** `frontend/src/components/panel/phaseStatusMeta.test.ts`.
- **This SUMMARY — FOUND:** `.planning/phases/200-the-workflow-journey/200-07-SUMMARY.md`.
- **Commits — all three resolve in `git log --all`:** `4f4bc172`, `a6889bf9`, `a382956b`.
- **No file deletions across the plan:** `git diff --diff-filter=D --name-only c9238cb0 HEAD` → empty.
- **`STATE.md` and `ROADMAP.md` — NOT modified** (the orchestrator owns those writes).
- **`.planning/reported-bugs/` — NOT modified**: `git diff --numstat` over that directory is empty,
  so `BUG-260610-01`'s `status: open` is provably untouched.
- **No untracked files left behind.**
