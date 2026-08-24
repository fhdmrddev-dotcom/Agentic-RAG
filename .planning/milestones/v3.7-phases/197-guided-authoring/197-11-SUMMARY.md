---
phase: 197-guided-authoring
plan: 11
subsystem: tooling
tags: [phase-close, count-gate, g-5-ledger, same-commit-sync, numstat, uat-owed, auth-02]

# Dependency graph
requires:
  - phase: 197-01
    provides: "the phase base SHA as a literal, the four numstat criteria, the two exclusions, and the six ledger triples measured before any source byte moved"
  - phase: 197-10
    provides: "the final source state — the pins had to be taken AFTER it landed, which is why this plan is alone in wave 7"
provides:
  - "Three BASELINE pins for the suites this phase created — 111 cases that were deletable with the gate green until this commit"
  - "Nine ledger rows re-derived from git in one batch pass, plus a TENTH file found absent at seven phases"
  - "The phase's close-out record: every declared criterion run and quoted, every decline given a written trigger, every owed UAT row named"
affects: [phase-close, verify-work, 198]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A phase's ledger obligation is derived from its REAL diff, not from its plan's files_modified list — the list is itself a scan list and can be incomplete the same way the table can"
    - "A declared exclusion that is measurably NOT consumed is a better outcome than one that is, and is worth recording as such"

key-files:
  created:
    - ".planning/phases/197-guided-authoring/197-11-SUMMARY.md"
  modified:
    - "scripts/vitest-count-gate.cjs (+44 / -0)"
    - "CLAUDE.md (+11 / -6)"
    - "docs/HOT-FILE-LEDGER.md (+110 / -1)"

key-decisions:
  - "soulData.ts was added to the ledger as a G-5-FIRING row although the plan did not name it — found by diffing the phase's real source changes against the plan's nine-file list"
  - "scripts/vitest-count-gate.cjs's own row was re-derived AFTER its own commit landed, because a triple taken before it would have been wrong by one commit within the same task"
  - "The Task-1 acceptance criterion `grep -c ... == 3` is recorded as MEASURED 9 and NOT met as literally written, with the reason, rather than reformulated into a pass"

patterns-established:
  - "Re-derive a hot-file row AFTER the commit that changes the file, not before — the self-staling this ledger documents about three other files now has a fourth instance"

requirements-completed: [AUTH-02]

# Metrics
duration: 71min
completed: 2026-08-18
---

# Phase 197 Plan 11: Phase-Close Mechanics — Gate Pins, Ledger Re-derivation, Close-out Record Summary

**111 previously-ungated cases pinned, ten ledger rows re-derived from git in one batch pass — one of
which belongs to a file that fires G-5 at seven phases and had no row anywhere — and every criterion
this phase declared run one last time and quoted verbatim, including the nine UAT rows it is closing
without.**

## Performance

- **Duration:** ~71 min
- **Tasks:** 3
- **Commits:** 2 task commits + this SUMMARY
- **Dispatched base:** `202dba497a21be65cae1f9c3c329d5820289144e` — ⚠ the worktree forked from the
  WRONG base for the **tenth time out of ten** this phase (`git merge-base` returned
  `3781a3fe4690a9619e619f4cc412bd37a7dafc52`) and was corrected by the mandated `git reset --hard`
  before anything was read. **For this plan specifically that was load-bearing**: every number below
  is a pin or a `git log` derivation, and at the wrong base they would all have been
  correct-looking figures for a tree that is not the one shipping.
- **Phase base SHA** (`197-01`'s literal, substituted everywhere below):
  `52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07`

---

## Task 1 — The three new suites are gated

### The counts came from the gate's own `actual` column, never from a source grep

All three files live under `frontend/src/components/workflows/`, which is already a **DIRECTORY
entry** in `TARGETS`, so the gate had been executing them since the day they landed — it just had no
pin for them, and printed them as `new`. That placement was chosen at plan time precisely to avoid
the two-knob path `src/pages` forces, and it held: **no `TARGETS` entry was added.**

The pre-pin run, verbatim:

```
  DecisionsList.test.tsx                        —      54     new
  DraftArrivalCard.test.tsx                     —      35     new
  decisionsVocabulary.test.ts                   —      22     new
  -------------------------------------------------------------
  total                                      4217    4447    +230
  total 4447  ·  failed 0  ·  pinned total 4217
--------------------------------------------------------------
count gate OK — 89/89 pinned files present, no per-file decrease, 0 failing.
```

### The post-pin verdict, verbatim, beside `197-01`'s starting figure

```
  total                                      4328    4447    +119
  total 4447  ·  failed 0  ·  pinned total 4328
--------------------------------------------------------------
count gate OK — 92/92 pinned files present, no per-file decrease, 0 failing.
```

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` → **exit 0**, measured separately.

| | `197-01`, at the phase base | **this plan, at phase close** | delta |
|---|---|---|---|
| grand total | **4291** | **4447** | **+156** |
| failed | 0 | **0** | — |
| pinned total | **4217** | **4328** | **+111** |
| pinned files | **89/89** | **92/92** | **+3** |

**The pinned-file fraction went up by exactly 3**, which is the whole of this task. **A growing total
is the gate WORKING, not the gate breaking** — its contract is *no per-file DECREASE* and *zero
failing*, never a fixed grand total. The `+156` grand-total growth is Phase 197's own cases arriving;
the `+111` pinned growth is those of them that were previously deletable with the gate green.

### The gate did not red, so the RED-triage procedure was not exercised

Both full runs returned `count gate OK` first time. **That is reported as luck, not as a property** —
CLAUDE.md's own correction (2026-08-17 / SEED-171) records that `count gate OK` is *not reliably
reachable on demand*, and `197-09` in this very phase hit `failed 1` on run 1 and clean on run 2. **No
re-run was needed and no cap was touched.** The `196-08` trigger (249 real failures from a missing
runtime export in `@/lib/api` mock factories) **did not fire, and that was a prediction under test**:
`197-01` argued a type-only change to `api.ts` could not fire it. `failed 0` confirms it — see the
`api.ts` ledger note.

### ⚠ ONE ACCEPTANCE CRITERION IS NOT MET AS LITERALLY WRITTEN, AND IS RECORDED AS SUCH

The plan's first criterion reads:

> `grep -c "decisionsVocabulary.test.ts\|DecisionsList.test.tsx\|DraftArrivalCard.test.tsx" scripts/vitest-count-gate.cjs` returns `3`.

**Measured: `9`.** It is **not** met as written, and it is recorded that way rather than reformulated
into a pass. The reason is the criterion's formulation, not the work: `grep -c` counts matching
**lines**, and this script's house style names a pinned file repeatedly in the comment block that
justifies its number. **The criterion is falsified by the file's own shipped precedent** —
`grep -c "PhaseCard.test.tsx"` measures **6** and `grep -c "SeedReceipt.test.tsx"` measures **2**, both
of which are single pins written in the same style. A criterion of this shape would fail on every pin
in the file.

The substantive check it was reaching for **does** hold, measured with a key-line pattern:

```
$ grep -nE '^\s*"(decisionsVocabulary\.test\.ts|DecisionsList\.test\.tsx|DraftArrivalCard\.test\.tsx)": [0-9]+,' scripts/vitest-count-gate.cjs
2111:  "decisionsVocabulary.test.ts": 22,
2112:  "DecisionsList.test.tsx": 54,
2113:  "DraftArrivalCard.test.tsx": 35,
$ ... | wc -l
3
```

Exactly three BASELINE keys, and `git diff` shows **one hunk**, headed `@@ -2067,6 +2067,50 @@ const
BASELINE = {` — so the additions are provably inside the BASELINE map and nowhere near `TARGETS`.

### What each pin guards, recorded in the file beside the number

- **`decisionsVocabulary.test.ts` (22)** — ⚠ only **row 3** may claim a publish requirement, because
  only row 3's sentence arrives on the wire from `grounding.py`'s stage-1
  `business_requirement_missing`. Verified as a true leaf (imports nothing).
- **`DecisionsList.test.tsx` (54)** — ⚠ **three arms, never two.** An absent readiness renders no
  verdict node; a boolean cannot express D-20.
- **`DraftArrivalCard.test.tsx` (35)** — ⚠ the suppression list must name the receipt's four
  frame/duplicate handles (`seed-receipt`, `-heading`, `-dismiss`, `-close`) and **none** of its four
  content handles. Verified against `RECEIPT_SUPPRESSION_CLASS` in source: ten rules, all ten on
  those four handles.

---

## Task 2 — Ten ledger rows re-derived in one batch pass

Every triple below was produced by CLAUDE.md's own three-command recipe in a single scripted pass,
with **six-digit dated quick-task buckets subtracted**. No cell was trusted; each was re-derived.

### The six G-5 rows the plan named

| File | `197-01` / the table said | **re-derived at close** | drift | dated buckets subtracted |
|---|---|---|---|---|
| `frontend/src/lib/api.ts` | 170 / 97 / 6154 | **171 / 98 / 6174** | +1 / +1 / +20 | `260405` `260814` |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 42 / 13 / 2398 | **47 / 14 / 2656** | **+5 / +1 / +258** | `260809` `260814` |
| `backend/app/api/workflows.py` | 36 / 18 / 1984 | **36 / 18 / 1984** | none — **NOT MODIFIED** | `260814` |
| `backend/app/services/harness/grounding.py` | 18 / 5 / 1252 | **18 / 5 / 1252** | none — **NOT MODIFIED** | `260814` |
| `frontend/src/components/workflows/builderStore.ts` | 11 / 5 / 837 | **12 / 6 / 907** | +1 / +1 / +70 | `260809` |
| `backend/app/services/workflow_authoring.py` | 12 / 6 / 572 | **13 / 7 / 625** | +1 / +1 / +53 | — |

⚠ **`197-01` measured zero drift on all six and said so explicitly as a warning rather than a
comfort:** *"most of these six will be touched during wave 2, so today's zero is not tomorrow's."*
**Four of six moved.** `WorkflowBuilderPage.tsx` went stale by **5 commits / 1 phase / 258 lines
inside a single phase**, which is the same self-staling this ledger already documents about
`WorkflowsPage.tsx`, `WorkflowCard.tsx` and `WorkflowRunPage.tsx`.

**Every contradicted figure is recorded BESIDE its replacement in both files, never over it** — the
convention that is the only reason this ledger's rot is auditable at all.

### The two `NOT MODIFIED` rows, with the measured reason

`git diff --numstat 52e6bcdb…07 HEAD -- backend/app/api/workflows.py backend/app/services/harness/grounding.py`
→ **EMPTY.**

- **`backend/app/api/workflows.py`** — the phase put a **new key on the `/generate` wire** and this
  file learned nothing. Verified from source: the route is
  `@router.post("/generate", dependencies=[Depends(require_visible("workflow_authoring"))])` with
  **no `response_model`**, and its body ends `return result`, passing the service dict straight
  through.
- **`backend/app/services/harness/grounding.py`** — the predicate already had exactly **one** home,
  so the phase added a second **CONSUMER**, not a second copy: `workflow_authoring.py` imports
  `business_requirement_missing` and `BUSINESS_REQUIREMENT_MISSING_MESSAGE` function-locally.

**A measured non-touch is a stronger statement than silence**, which is why both are written out with
their commands rather than left as absences a future reader must re-derive.

### ⚠ THE FINDING: a file firing G-5 at SEVEN phases had no row in either artifact

`frontend/src/components/workflows/soulData.ts` measures **`9 commits / 7 phases / 373 L`** (buckets
`124 · 127 · 183 · 184 · 189 · 193 · 197`, no dated tasks). **Phase 197 modified it (+97 lines) and it
had no row in `CLAUDE.md` and no section in `docs/HOT-FILE-LEDGER.md`.**

**The plan's own nine-file list did not name it either.** It was found by diffing the phase's *real*
source changes against that list — which is the only method that finds this class of miss, because
**a plan's `files_modified` is itself a scan list and can be incomplete in exactly the same way the
table can.** That is the identical failure `backend/app/config.py` suffered for the project's entire
life, `WorkflowsPage.tsx` for ten phases and `ChatArea.tsx` for twenty-eight. It is now a
G-5-**FIRING** row with a full section naming its invariant (`templateAdmission` has three states;
`unknown` is not `does-not-admit`; a boolean cannot express D-20) and its seam.

### Rows added or corrected beyond the plan's list

| File | Triple | Why |
|---|---|---|
| `frontend/src/components/workflows/soulData.ts` | **9 / 7 / 373** | ⚠ **G-5 FIRES, was ABSENT** — the finding above |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | **5 / 2 / 630** | young; ⚠ it was **NAMED inside another file's section with no row of its own**, which is drift under the same-commit sync rule |
| `scripts/vitest-count-gate.cjs` | 100 / 16 / 3215 → **101 / 17 / 3259** | it is in this plan's `files_modified` and carries a row; buckets subtracted: `260807` `260808` `260814` |

⚠ **The `vitest-count-gate.cjs` row was re-derived AFTER its own Task-1 commit landed**, deliberately:
a triple taken before it would have been wrong by one commit before the same task finished. **This
row also carries a correction to its own warning.** It says *"raising a pin necessarily deletes one
line, so a `grep -c '^-[^-]'` expecting 0 is WRONG"* — true for a **RAISE**, and **it does not
generalise to an ADD**. This phase's edit is `+44 / -0`: three keys added for suites that had never
been pinned, so there was no old number to delete.

### The three young rows for the files this phase created

`decisionsVocabulary.ts` **1 / 1 / 226** · `DecisionsList.tsx` **1 / 1 / 329** ·
`DraftArrivalCard.tsx` **1 / 1 / 338** — each listed **immediately** rather than at its third phase,
each with its binding invariant and its seam, because `WorkflowsPage.tsx` escaped G-5 for ten phases
purely by not being written down.

### The same-commit sync rule, verified rather than asserted

Every one of the **eleven** paths was grepped in **both** files after the edit; all eleven present in
both; `git diff --stat` shows `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` changed together in the same
commit (`73ecb3fe`, `122 insertions(+), 7 deletions(-)` across the two).

### The size gate

```
  CLAUDE.md                                   69191 chars   46.1% of limit  headroom   80809  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

**Exit 0.** `66,918 → 69,191` chars (`+2,273`). **The 120,000 warn band was NOT entered** — 50,809
chars of headroom remain below it, and 80,809 below the hard 150,000 limit. No split is scheduled.
Measured with the gate, never with `wc`.

---

## Task 3 — Every declared criterion, run one last time and quoted

### 1. The four standing numstat deletion criteria — ALL PASS

```
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
       frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
       frontend/src/components/workflows/SeedReceipt.tsx \
       backend/app/services/harness/publish_service.py
                                                              [no output — exit 0]
```

**Empty output on all four.** Not merely *zero deletions* — **zero insertions too**, on all four
paths, across the whole phase.

| # | Path | Decision | Required | **Measured** |
|---|---|---|---|---|
| 1 | `WorkflowBuilderPage.preDraft.baseline.test.tsx` | D-05 · SC#2 · SC#3 | deletions = 0 | **`0 0`** ✅ |
| 2 | `WorkflowDoorSwitch.baseline.test.tsx` | D-05 · SC#2 · SC#3 | deletions = 0 | **`0 0`** ✅ |
| 3 | `SeedReceipt.tsx` | D-02 | **`0 0`** | **absent from the diff** ✅ |
| 4 | `publish_service.py` | D-11 · D-20 | **`0 0`** | **absent from the diff** ✅ |

Criteria 1 and 2 *permitted* insertions and took none — **the fast door was not asked for anything
new, and the pre-draft screen is byte-unchanged.** Criterion 3 proves D-02 structurally: the arrival
card **composed** `SeedReceipt` instead of widening it. Criterion 4 proves D-11/D-20: **the publish
gauntlet learned nothing new** — the rows READ the gate, they never taught it.

### 2. The two declared EXCLUSIONS — reported, and NEITHER WAS CONSUMED

```
$ git diff --numstat 52e6bcdb…07 HEAD -- frontend/src/pages/WorkflowBuilderPage.header.test.tsx scripts/vitest-count-gate.cjs
156     0       frontend/src/pages/WorkflowBuilderPage.header.test.tsx
44      0       scripts/vitest-count-gate.cjs
```

**Zero deletions on both.** This is a genuine finding rather than bookkeeping: `197-01` declared two
exclusions in advance so that correct work could not be blocked by a naive check, **and the phase
then needed neither.**

- **Exclusion 1 — `WorkflowBuilderPage.header.test.tsx`:** `197-10` took **BRANCH A** and forced **no
  third re-capture** of `FLAG_OFF_HEADER_MARKUP`. Band 3's own note said the phase that wrote it
  expected no third re-capture; **it got none.** `+156 / -0` is four new cases and nothing removed.
- **Exclusion 2 — `scripts/vitest-count-gate.cjs`:** `+44 / -0`, because **adding** a pin is not
  **raising** one. The exclusion remains correct to keep declared for the next phase that raises a
  pin; it was simply not needed here.

⚠ **Declaring an exclusion that turns out to be unnecessary is the better outcome, and it is recorded
as a decision rather than dropped**, so a future plan neither deletes the exclusion nor assumes it
must fire.

### 3. Frontend typecheck — at baseline, unmoved

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json | grep -cE '^src/.*error TS'
33
```

**33 errors**, exactly `197-01`'s recorded baseline. The pass condition is *unchanged*, not zero; all
33 are pre-existing and none is in this phase's scope. The `-p tsconfig.app.json` is load-bearing — a
bare `--noEmit` checks zero files here.

### 4. Backend pytest — the whole tree, per `197-01`'s standing instruction

```
$ cd backend && venv/Scripts/python.exe -m pytest tests -q
211 failed, 4060 passed, 29 skipped, 5 xfailed, 9 xpassed, 266 warnings, 1 error in 385.21s (0:06:25)
```

| | `197-01` baseline (whole tree) | **at phase close** | delta |
|---|---|---|---|
| failed | 212 | **211** | **−1** |
| passed | 4041 | **4060** | **+19** |
| skipped | 33 | 29 | −4 |
| xfailed / xpassed | 5 / 9 | 5 / 9 | — |
| error | 1 | **1** | — |

**Reported as a delta, not as an absolute judgement**, exactly as the plan instructs. Failures went
**down by one** and passes **up by nineteen** — consistent with the phase's own new backend suite
(`test_workflow_authoring_requirement.py`, 515 lines) landing green. The `1 error` is the same
pre-existing one `197-01` identified: `tests/integration/test_077_cross_cancel.py` erroring **at
setup** because it needs live Redis — not a failing assertion.

⚠ **Scope discipline honoured:** this is `backend/tests` (whole), **not** `backend/tests/unit`.
`197-01` measured that mixing the two scopes would manufacture a phantom 148-test swing.

### 5. Deploy-artifact drift

```
RESULT: PASS — the one-box deploy artifacts are in sync.
```

**Exit 0.** Two non-blocking `WARN`s, **both pre-existing and neither caused by this phase**: the
seed-like migrations above `#089` in the OPERATOR.md Step-3 review list, and `docker compose` being
unavailable in this sandbox (CI runs the authoritative parse; the structural fallback passed). This
phase adds **no env var, no seeded migration, no bundled service and no sandbox-image tag change**, so
`PASS` is the expected result — **recorded rather than assumed.**

### 6. Migrations — none, as expected

```
$ git diff --name-only 52e6bcdb…07 HEAD -- supabase/migrations/
                                                              [empty]
```

**No migration was added anywhere in Phase 197.** The phase stayed additive-optional as designed —
the wire gained an **optional** key on an existing success return and no schema moved.

**Bonus check, since it costs one command:** `git diff --diff-filter=D --name-only <base> HEAD` is
**empty** — **no file was deleted anywhere in the entire phase.**

---

## The reported-bugs touchpoint — CHECKED AND EMPTY

```
$ grep -c "folded_into: 197" .planning/reported-bugs/*.md | grep -v ":0"
                                                              [no output]
```

**Zero reports carry `folded_into: 197`.** This is recorded as a **checked-and-empty result, never as
an unrun check** — the distinction this project has been bitten by, because *"a bug's `status:`
frontmatter IS the index"* and prose inside a record is invisible to the routing scan.

Two reports read as though they might be owed here, and `197-CONTEXT.md`'s C-2/C-3 corrections explain
why they are not. **Both were verified from frontmatter, not from the CONTEXT prose:**

| Report | `status` | `folded_into` | Verdict |
|---|---|---|---|
| `BUG-260809-02` (canvas builder cannot set business requirement) | `closed` | `quick-260809-klo` | **C-2 confirmed** — closed by a quick task, not owed to 197 |
| `BUG-260815-01` (template-first drafts cannot be published) | `closed` | `"193.2"` | **C-3 confirmed** — closed by 193.2, not owed to 197 |

⚠ **A THIRD report exists that neither C-2 nor C-3 covers, and it is named rather than left silent:**
`BUG-260815-06` (*structural gate refusal names nothing actionable*) is `status: open`,
`folded_into: null`, `surface: Agentic-RAG` — **considered at `/gsd:discuss-phase 197` and
DELIBERATELY NOT FOLDED**, with its re-open trigger already written into its own frontmatter:

> *"it shares SEED-163's root but is repair on the PUBLISH surface, while 197's SC#1 asks for the
> author to be ASKED, not better refused. Status stays `open` and `folded_into` stays null on
> purpose. Re-open at: the next phase touching the publish gauntlet's refusal copy, OR a second
> report of an author stuck on an unexplained refusal."*

That is a correctly-recorded decline, and it is surfaced here so the phase's close-out names it rather
than the scan's emptiness implying nothing was considered.

---

## EVERY DECISION THIS PHASE DECLINED, EACH WITH A WRITTEN RE-OPEN TRIGGER

**Take it or name it, never neither.** A deferral without a trigger is a deletion.

| # | Declined | Re-open trigger |
|---|---|---|
| 1 | **C-1 / the AI mark on row 4** — no definition-level provenance field was added for the name | **Any phase that adds a definition-level provenance field for another reason** |
| 2 | **The `frontend/src/lib/api.ts` seam** — the hottest file in the repository (171 / 98 / 6174) took a type-only `+21 / -1` | **The next phase that adds a RUNTIME export to that file, or a second concern to it** — and it must budget one mock line per mounting suite in the same commit |
| 3 | **Moving `REQUIREMENT_INVITATION` / `REQUIREMENT_AI_MARK_*` out of the page** | **The next phase touching the header affordance copy** |
| 4 | **`template_asset_id`** — allowlisted, not wired | **The next phase that takes up template binding** (`AUTH-03`'s surface) |
| 5 | **D-04 dismissal remembered across a reload** — the card's dismissal is caller-owned and not persisted | **An author reporting the card returns after a reload they dismissed it on** |
| 6 | **`BUG-260815-06`** (added by this plan, not in the plan's list of five) | **The next phase touching the publish gauntlet's refusal copy, OR a second report of an author stuck on an unexplained refusal** |
| 7 | **The `soulData.ts` extraction** (added by this plan) — the row was created, the seam named, the refactor NOT taken | **G-5 fires at 7 phases: the next phase whose `files_modified` names it owes a refactor recommendation FIRST** |
| 8 | **The `backend/app/api/workflows.py` extraction** — still due at 18 phases, and 197 added no argument either way because it added no concern | **The next phase that adds a second concern to that route module** |

---

## ⚠ THE OWED G-4 UAT ROWS — NAMED, NOT ASSUMED

**All nine rows `U1`–`U9` in `197-VALIDATION.md` are OWED to the operator.** They live there, the
operator drives them, and **this plan neither authored nor drove any of them.** Closing a phase with
owed manual UAT rows is legitimate; **claiming everything ran would not be.**

| Row | What it proves | Status |
|---|---|---|
| **U1 — the arrival moment** ⭐ | ONE card of about four lines, graph still the biggest thing; and below ~900 px | ⚠ **OWED — the phase CANNOT close it in code.** jsdom applies no CSS, so the suppression is proved by SOURCE assertion only. Inherited from `197-08`, re-flagged by `197-09` |
| U2 — the fast door still feels fast | Both doors ask for nothing new | OWED (the numstat criteria are the mechanical half; the *feel* is not) |
| U3 — a decision is answerable and sticks | Header agrees instantly; answer survives a reload | OWED |
| **U4 — the requirement row, on ≥ 2 providers** ⭐ | Durable on one, one-run-parameters on another, fixable in the row | ⚠ **OWED — MUST NOT be scored on one provider** |
| **U5 — row and header do not contradict** ⭐ | Card and header strip give ONE answer | ⚠ **OWED — the exact defect sketch 174 shipped**, caught only by looking. `197-10` named it owed |
| **U6 — the name row is the name's first honest display** ⭐ | What I typed is what I see, not `northwind-qbr-fa65a43c` | ⚠ **OWED.** `197-10` named it owed |
| U7 — dismissal is an offer, not a wall | ✕ removes the card, graph takes the space | OWED |
| U8 — the deliverable row leads somewhere real | Option (ii) only | OWED |
| U9 — legibility of the 11 px controls | Inherits 193.2-09's owed sliver | OWED |

### The 4-axis obligation, restated verbatim — including its ⛔ rows and their reasons

| Axis | Obligation | Status |
|---|---|---|
| **Cross-provider (a)** | **U4 is a generation-quality row: ≥ 2 providers minimum — anthropic + openai**, the two the **0/5-vs-5/5** contrast was measured on (`193.2-FREQUENCY.md` §6c); google recommended as a third | ⚠ OWED |
| **Cross-provider (b)** | The surface must be shown **provider-independent** — one row proving the five questions and five verdicts are byte-identical across a provider switch. That is the honest proof of D-09's *"no provider call"* | ⚠ OWED |
| **Multi-tool** | ⛔ **NOT APPLICABLE — no tool call on this path.** Recorded, never silently omitted | ⛔ recorded |
| **Parallel-thread** | ⛔ **NOT APPLICABLE — authoring is not a run.** Recorded, never silently omitted | ⛔ recorded |
| **Long-message** | ⚠ **APPLICABLE, worth one row** — a very long describe text yields a long `business_requirement` and a long name; does row 3's/row 4's 240 px truncated input become unusable? A real failure mode | ⚠ OWED |

**The roster was DERIVED from `MODEL_CAPABILITIES`, never re-typed** (measured this session, run
against the shipping registry):

```
provider groups: 8   models: 61
  openai       n=17   anthropic  n=7   google     n=7   deepseek  n=2
  moonshot     n=3    minimax    n=8   zhipu      n=8   openrouter n=9
```

This matches `197-VALIDATION.md`'s measured *"8 provider groups / 61 models"* exactly. **Prefer a
registry-backed id per provider** — an id absent from the registry resolves
`capability_source=inferred` and silently loses `emit_tier`, so the row would measure a weaker
configuration than the one that ships. **Rows may be blocked, never silently omitted:** a provider
with no key is recorded ⛔ with the reason and the blocking id.

**Recommended first row to drive: `U5`.** It is cheapest (one screen, no provider setup), it is the
exact defect sketch 174 shipped, and `197-10` and `197-09` both left it owed.

---

## Debts inherited from the two waves before this one — carried, not quietly dropped

- **`197-09` closed with ONE acceptance criterion recorded FAILED** — its suite's "zero deletions",
  measured **28** — rather than reinterpreted into a pass. **This plan holds itself to the same
  standard** and records its own Task-1 `grep -c == 3` criterion as **NOT met as literally written**
  (measured 9) with the reason, instead of quietly substituting the check that does pass. Note that
  `197-09`'s failed criterion was **plan-local**, not one of the four standing D-05 criteria — all
  four of those pass with `0 0`. Measured at the phase base, `WorkflowBuilderPage.canvas.test.tsx`
  reads `681 30`.
- **`197-09` was RECOVERED after a host machine crash, not re-run**, and its SUMMARY says at the top
  which parts are reconstruction. That disclosure stands and is not re-litigated here.
- **`197-10` recorded a Rule 3 deviation** — it edited `WorkflowBuilderPage.canvas.test.tsx`, not in
  its `files_modified`, to retire a `197-09` scope fence that had fired as designed. Declared,
  preserved verbatim inside the replacement comment rather than deleted.
- **`197-10` claims RED-first for 2 of its 4 new cases, not 4** — the other two are regression fences
  that pass on both sides of the change, and it said so itself. **Carried forward unaltered.**
- **`197-10` flagged the `WorkflowBuilderPage.tsx` ledger row as stale and correctly declined to fix
  it** mid-wave, because the ledger is a shared artifact. **That debt is discharged by this plan** —
  and the decline is recorded in the ledger as *the pattern to copy, not an omission to criticise.*

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] The plan's nine-file ledger list is incomplete against the phase's real diff, and one of the missing files FIRES G-5**

- **Found during:** Task 2
- **Issue:** The plan enumerates six G-5 files plus three new ones. The phase's actual source diff
  against the base SHA contains **two more non-test source files**:
  `frontend/src/components/workflows/soulData.ts` (`+97`) and
  `frontend/src/components/workflows/useTemplateFirstDraft.ts` (`+37 / -2`). `soulData.ts` measures
  **`9 / 7 / 373`** — **it FIRES G-5 at seven phases and had no row in `CLAUDE.md` and no section in
  `docs/HOT-FILE-LEDGER.md`.** Writing only the plan's nine would have shipped a close-out claiming
  the ledger was re-derived while leaving a seven-phase hot file invisible to its own guardrail —
  the precise failure this plan exists to prevent, and the one `backend/app/config.py` suffered for
  the project's entire life.
- **Fix:** Derived the ledger obligation from `git diff --numstat <base> HEAD` over `frontend backend
  scripts` rather than from the plan's list. Added a full G-5-FIRING row + section for `soulData.ts`
  (invariant and seam named) and a young row + section for `useTemplateFirstDraft.ts` — which was
  additionally in **drift**, being NAMED inside `WorkflowBuilderPage.tsx`'s section while having no
  row of its own.
- **Files modified:** `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
- **Verification:** all eleven paths grepped in both files → present in both; size gate exit 0
- **Committed in:** `73ecb3fe`

**2. [Rule 2 — Missing Critical] `scripts/vitest-count-gate.cjs` is in this plan's own `files_modified` and carries a ledger row the plan did not ask to update**

- **Found during:** Task 2
- **Issue:** Task 1 modified a file that has a G-5-firing row (`100 / 16 / 3215`). Leaving it would
  have made this plan the author of a stale row **in the same commit that fixed five others** — and
  the row belongs to *the file that enforces the guardrails*.
- **Fix:** Re-derived it to **`101 / 17 / 3259`** *after* the Task-1 commit landed, and corrected its
  own warning: *"raising a pin necessarily deletes one line"* is true for a **raise** and does **not**
  generalise to an **add** — this phase's edit is `+44 / -0`.
- **Files modified:** `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
- **Verification:** `git log`/`wc -l` recipe re-run post-commit; both files updated in `73ecb3fe`
- **Committed in:** `73ecb3fe`

**No Rule 1, Rule 3 or Rule 4 deviations.** No package was installed; no architectural change arose.

---

## Threat register outcome

| Threat ID | Disposition | Evidence |
|---|---|---|
| **T-197-31** (a stale or absent ledger row) | **mitigated — and it found a real one** | Ten rows re-derived in one batch pass with the ledger's own recipe; four of six named rows had drifted; contradicted figures recorded beside their replacements; detail file synced in the same commit; **and `soulData.ts` was found absent at seven phases** |
| **T-197-32** (an unrun check recorded as a passing one) | **mitigated** | Every criterion quoted verbatim from its own command output. The reported-bugs scan is recorded as **checked-and-empty** with both C-corrections verified from frontmatter, plus a third declined report named. ⚠ One acceptance criterion is recorded **NOT met as literally written** rather than reformulated |
| **T-197-33** (an ungated new suite silently losing cases) | **mitigated** | Three BASELINE pins, all three counts read from the gate's own `actual` column on the run that had no pin for them. One-knob placement verified by reading `TARGETS`, not by belief |
| **T-197-34** (a declined decision evaporating) | **mitigated** | **Eight** declines recorded with written re-open triggers — the plan's five plus three this plan added |
| **T-197-SC** (npm/pip installs) | **accept — vacuous with reason** | **No package was installed and none was proposed.** The Package Legitimacy Gate is recorded as *skipped because the set is empty*, never as *run against an empty set* |

**Threat flags:** none. This plan crossed no trust boundary, opened no route, touched no schema and
added no runtime code path. Its entire source diff is one comment-and-constants block in a build
script.

---

## Task Commits

| Task | Commit | Files |
|---|---|---|
| 1 — pin the three new suites | `8b31518d` (test) | `scripts/vitest-count-gate.cjs` (`+44 / -0`) |
| 2 — re-derive the ledger in one batch pass | `73ecb3fe` (docs) | `CLAUDE.md` (`+11 / -6`), `docs/HOT-FILE-LEDGER.md` (`+110 / -1`) |
| 3 — run every declared criterion | *(no source change by design)* | this SUMMARY |

**No modification to `STATE.md` or `ROADMAP.md`** — the orchestrator owns those writes after the wave
merges.

---

## Next Phase Readiness

**Phase 197's mechanical obligations are closed. What is genuinely owed is manual and it is named.**

1. **Drive the nine G-4 rows.** Start with **U5**. `U1`, `U4`, `U5` and `U6` are the four the phase
   cannot honestly close without.
2. **Eight declined decisions carry live triggers** — the `api.ts` one is the sharpest: the next
   runtime export there owes a refactor recommendation first *and* one mock line per mounting suite.
3. **Two G-5 extractions are DUE, not honoured:** `backend/app/api/workflows.py` (18 phases) and now
   `frontend/src/components/workflows/soulData.ts` (7 phases).
4. ⚠ **Re-derive the ledger again at the next phase's close.** `197-01` recorded zero drift and warned
   it would not last; **four of six rows moved inside one phase.** Today's numbers are not tomorrow's.

---

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| SUMMARY exists | `ls .planning/phases/197-guided-authoring/197-11-SUMMARY.md` | FOUND |
| Task 1 commit exists | `git log --oneline` | FOUND `8b31518d` |
| Task 2 commit exists | `git log --oneline` | FOUND `73ecb3fe` |
| Three pins present as BASELINE keys | `grep -nE '^\s*"(decisionsVocabulary...)": [0-9]+,'` | **3** (lines 2111-2113) |
| No `TARGETS` entry added | `git diff` hunk header | one hunk, `@@ … const BASELINE = {` |
| Count gate green | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | **exit 0**, `92/92`, total 4447, pinned 4328, failed 0 |
| Size gate clear | `node scripts/check-claude-md-size.cjs` | **exit 0**, 69,191 chars, 46.1% |
| Ledger sync | eleven paths grepped in both files | all present in both |
| Both ledger files in one commit | `git diff --stat` | `CLAUDE.md` + `docs/HOT-FILE-LEDGER.md` together |
| Four numstat criteria | `git diff --numstat <base> HEAD -- <4 paths>` | **empty — `0 0` on all four** |
| No migration added | `git diff --name-only <base> HEAD -- supabase/migrations/` | empty |
| No file deleted in the phase | `git diff --diff-filter=D --name-only <base> HEAD` | empty |
| Deploy drift | `bash scripts/check-deploy-drift.sh` | **exit 0**, `RESULT: PASS` |
| Typecheck at baseline | `npx tsc --noEmit -p tsconfig.app.json` | **33** = baseline |
| Backend delta reported | `pytest tests -q` | 211 failed / 4060 passed (−1 / +19) |

⚠ **One acceptance criterion is recorded as NOT MET AS LITERALLY WRITTEN** (Task 1's
`grep -c … == 3`, measured **9**), with its falsification by the file's own shipped precedent, and the
substantive check that does hold quoted beside it. It is left recorded that way rather than
reinterpreted into a pass — the standard `197-09` set in this phase.

---
*Phase: 197-guided-authoring*
*Completed: 2026-08-18*
