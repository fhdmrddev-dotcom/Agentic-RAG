---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 11
subsystem: phase-closure
status: TASKS-1-2-COMPLETE — BLOCKED AT THE TASK-3 OPERATOR GATE
tags: [govern-01, govern-02, govern-03, vocabulary, req-6, req-7, d-185-02, g-5, d-185-17, fences, checkpoint-pending]
requires:
  - "185-05 (the honest armed wait — the last backend wave)"
  - "185-09 (the corner seal — the canvas mark whose vocabulary this sweeps)"
  - "185-10 (the detour edge — the last canvas wave; its growth is what makes WorkflowCanvas.tsx fire G-5)"
  - "185-08 (the word-badge deletion — the retired strings criterion 14 asserts are gone)"
  - "185-06 (the twelve governance copy constants — the required half's home)"
provides:
  - "frontend/src/components/workflows/governanceVocabulary.test.ts — criteria 14 and 15 as 30 falsifiable assertions instead of a grep run once by hand"
  - "185-VALIDATION.md's Per-Task Verification Map — 31 tasks across 11 plans, each with its criterion and automated command"
  - "the four phase-level fences, with verbatim output, recorded in VALIDATION rather than asserted in prose"
  - "the G-5 honoured-by-construction record on PhaseFormPanel.tsx, with a measured diff-stat as its evidence"
  - "CLAUDE.md hot-file ledger rows for WorkflowCanvas.tsx (FIRES), PhaseNodeCard.tsx and PhaseFormPanel.tsx"
affects:
  - "any future phase editing workflow copy — the banned/required vocabulary is now machine-enforced and will red on a violation"
  - "Phase 188 inherits the WorkflowCanvas.tsx G-5 extraction, now on the ledger where discuss-phase reads it"
  - "Phase 188 also inherits the deliberately-unclosed global timeout-advances-silently behaviour"
tech-stack:
  added: []
  patterns:
    - "S7 — the ?raw / import.meta.glob source sweep with a non-vacuity guard and fragment-assembled needles"
    - "tokenize-not-grep — scoping a source guard with the TypeScript PARSER rather than a comment-stripping regex (the frontend analogue of 185-03's backend tokenize guard)"
    - "drift lock — search for the VALUE of the exported constant, then pin the constant to the binding phrase, so the guard cannot drift from the copy it guards"
key-files:
  created:
    - frontend/src/components/workflows/governanceVocabulary.test.ts
    - .planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/185-11-SUMMARY.md
  modified:
    - .planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/185-VALIDATION.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - CLAUDE.md
decisions:
  - "The vocabulary match is scoped to string literals, template chunks and JSX text via ts.createSourceFile, never to comments. Two real hits exist in this tree and both are correct prose about engineering facts, not copy: definitionOps.ts:362 spells out why *Traceable* is deferred to the review moment, and WorkflowBuilderPage.tsx:18 records that one-shot emission is proven by spike-097. A file-wide grep flags both. The parser was chosen over a comment-stripping regex so a `//` inside a string literal cannot fool the scoping — proven by a control."
  - "The required half searches for the VALUE of each exported constant rather than a retyped literal, and a separate DRIFT LOCK pins each constant to its binding phrase. Either half alone is weak: presence alone is near-vacuous because definitionOps.ts is itself in the sweep, and a pin alone does not prove the copy ships. Together, rewording the constant reds the lock and deleting it breaks the import."
  - "nyquist_compliant stays FALSE, deliberately, and the missing task is named in the frontmatter note. 30 of 31 tasks carry an automated command; the 31st is the blocking checkpoint that owns criteria 17 and 22, which have no automatable proof (jsdom computes no paint; a cross-provider scoreboard needs four live providers). It flips to true when task 11-3's rows are recorded."
  - "The four fences are measured over the PHASE range 59c32a06..HEAD, not as the plan's bare working-tree-vs-HEAD form. The bare form is trivially 0 on a clean tree and proves nothing about a phase; both readings were run and both are 0, and VALIDATION records the phase-wide command so a re-run is reproducible."
  - "roadmap.update-plan-progress was NOT run and the ROADMAP row was hand-written instead. The verb counts SUMMARY files on disk; with this file present it would have written 11/11 for a phase blocked at a human gate."
metrics:
  duration: "~25 min"
  tasks: "2 of 3 (task 3 is a blocking checkpoint:human-verify — NOT executed)"
  completed: 2026-07-30
---

# Phase 185 Plan 11: Close the Phase — Vocabulary Sweep, Fences and Guardrail Records Summary

**The phase's cross-cutting acceptance criteria stopped being greps run once by hand and became a
test plus a recorded fence table — and the phase is now parked, honestly, at the one gate that
cannot be automated.**

Tasks 1 and 2 are complete and committed. **Task 3 was NOT executed.** It is a
`checkpoint:human-verify` with `gate="blocking"`, and no operator has been asked. Nothing in this
plan marks the phase, the plan, or any requirement complete.

---

## What shipped

### Task 1 — the vocabulary sweep, as a test (`3864d962`)

`frontend/src/components/workflows/governanceVocabulary.test.ts`, **30 tests**, sweeping the 24
non-test modules of `src/components/workflows` plus `src/pages/WorkflowBuilderPage.tsx` through the
house `?raw` / `import.meta.glob` idiom.

| Assertion family | Criterion | What it asserts |
|---|---|---|
| retired badge strings | 14 | the three Req 6 strings deleted in `185-08` appear **0** times |
| banned words | 15 (banned half) | *Proven* · *Ungoverned* · *Unchecked* · *Not applicable* · *N/A* · *traceable* appear **0** times in user-visible strings |
| required phrases | 15 (required half) | *Must prove it* · *Free to think* · *Nothing to prove here* each appear **≥ 1** time, pinned to their exported constants |
| overclaim guard | D-185-02 | *every value traceable* and *everything it says is checked* appear **0** times |

**Three scoping decisions, each stated in the file's own docblock:**

1. **Test files are excluded from the sweep.** A suite asserting a banned string is absent must be
   allowed to name it, or it is its own first offender.
2. **The match is scoped to string literals, template chunks and JSX text — never comments —
   using the TypeScript parser.** This is not a convenience. A file-wide grep over this tree returns
   two hits, and both are correct prose: `definitionOps.ts:362` explains why *Traceable* is deferred
   to the review moment, and `WorkflowBuilderPage.tsx:18` records that one-shot emission is proven
   by spike-097. The parser was chosen over a comment-stripping regex so that a `//` inside a string
   literal cannot fool the scoping — there is a control that plants exactly that and proves the
   string IS caught.
3. **Every searched token is assembled from parts**, so no banned word is a contiguous literal
   anywhere in the file and nobody else's whole-`frontend/src` grep trips on the guard that forbids
   it.

**Anchoring:** word boundaries as explicit alphanumeric lookarounds (not `\b`) and case-insensitive.
Case-insensitive is the stricter reading — a mid-sentence lowercase *proven* is exactly as banned.
The plan named two false-positive risks and both have controls: `Must prove it` does not trip the
past participle, and identifier-shaped strings (`waitsForYou`, `min/avg`, `unCheckedIn`,
`provenance`) trip nothing.

**Non-vacuity:** 4 guards — more than 10 swept files, both roots reached (`./definitionOps.ts` and
`../../pages/WorkflowBuilderPage.tsx`), no test file in the corpus, and more than 100 extracted
user-visible strings.

### Task 2 — the fences and the guardrail records (`007b7e77`)

`185-VALIDATION.md` gained the filled Per-Task Verification Map, the ticked Wave-0 list, the
recorded fence table, the L-3 preamble on the SC#10 scoreboard, and a frontmatter note explaining
why `nyquist_compliant` is still `false`. `STATE.md` and `CLAUDE.md` gained the guardrail records.

---

## The four fences — verbatim output

Base for every phase-wide diff: **`59c32a06`** (`docs(185): operator ratifies D-185-17` — the last
commit before any 185 code), **48 commits** back from the reading.

### Fence 1 — criterion 2, no migration

```
$ git diff --stat 59c32a06..HEAD -- supabase/migrations
$ git diff --stat -- supabase/migrations
```

Both produce **no output — 0 files**, on the phase range and on the working tree.

Live head confirmed still **113**, and confirmed by a **live column read**, not by the CLI's
tracking table:

```
$ backend/venv/Scripts/python  (psycopg2 → 127.0.0.1:54322)
113 applied live (public.sso_configs exists): True
sso_configs columns: ['id', 'org_id', 'email_domain', 'provider_id', 'attribute_mapping',
                      'created_at', 'updated_at', 'status', 'approved_by', 'approved_at']
$ ls supabase/migrations/ | grep -E "^11[4-9]|^1[2-9][0-9]"
  none — 113 is the repo head
```

`status` / `approved_by` / `approved_at` are 113's firming columns, so 113 is applied.
**Recorded for the next executor:** `supabase_migrations.schema_migrations` tops out at **`036`**
and is **NOT** a usable head signal in this project — migrations are applied by pasting into the
Supabase SQL editor, which registers no row. Use a live column read.

### Fence 2 — criterion 11 / D-14, the Deep chat path

```
$ git diff --stat 59c32a06..HEAD -- backend/app/services/agent_loop.py \
    backend/app/services/tool_dispatcher.py backend/app/services/openai_service.py \
    backend/app/services/anthropic_service.py
```

**No output — 0 files.** The Deep chat path is byte-identical across the whole phase.

### Fence 2b — criterion 20, the harness phase executor types

```
$ git diff --stat 59c32a06..HEAD -- backend/app/services/harness/phase_types.py
```

**No output — 0 files.** `_exec_llm_human_input` is unchanged.

### Fence 3 — criterion 21 / G-5, `PhaseFormPanel.tsx`

```
$ git diff --stat 59c32a06..HEAD -- frontend/src/components/workflows/PhaseFormPanel.tsx
 .../src/components/workflows/PhaseFormPanel.tsx    | 29 +++++++++++++++++-----
 1 file changed, 23 insertions(+), 6 deletions(-)
```

**23 insertions / 6 deletions**, split by reading the diff hunk by hunk:

| Portion | Insertions | Deletions |
|---|---|---|
| docblock prose only | 16 | 6 |
| type / prop declarations (`kbTools?: readonly string[]`, `onGovernanceChange?`) | 2 | 0 |
| the `GovernanceSection` import | 1 | 0 |
| **render body** — 1 destructure line + the 3-line `{rails && <GovernanceSection … />}` mount | **4** | 0 |

Criterion 21 asked for **≤ ~4** render-body lines and got **exactly 4**. `GovernanceSection.tsx` is
the own-component half: the dial, its refusal copy and the arming switch all live there.

### Fence 4 — Req 6, the retired grounding symbols

```
$ grep -rn "groundingFor\|GROUNDINGS" frontend/src | wc -l
0
```

**This fence caught a real defect in Task 1's own output** — see deviation 1.

---

## Falsification — all three families observed RED against the real tree, then reverted

The plan's acceptance asks for a positive control per assertion family. Each family was falsified by
planting into a **real** shipped file (`definitionOps.ts`), observing red, and reverting; the
synthetic in-file controls stay in the suite as permanent tripwires.

**Plant 1 — banned-absent.** Added `export const FALSIFY_PLANT = "This step is proven."`

```
 ❯ src/components/workflows/governanceVocabulary.test.ts (30 tests | 1 failed)
      × Proven appears 0 times in user-visible strings
 AssertionError: expected [ './definitionOps.ts' ] to deeply equal []
 - []
 + [ "./definitionOps.ts" ]
 Tests  1 failed | 29 passed (30)
```

Note that lowercase *proven* was caught — the case-insensitive reading is live, and the assertion
names the offending file rather than just failing.

**Plant 2 — overclaim-absent.** Changed the plant to `"This gate makes every value traceable."`

```
      × traceable appears 0 times in user-visible strings
      × every value traceable appears 0 times in the workflow tree
      × the shipped attached-gate sentence claims retrieved-and-pointed-at, not coverage
 AssertionError: expected [ './definitionOps.ts' ] to deeply equal []   (×3)
 Tests  3 failed | 27 passed (30)
```

**Three guards bit on one plant** — the banned word and the overclaim phrase are independently
enforced, which is the property the D-185-02 lock wants.

**Plant 3 — required-present.** Reworded `GOVERNANCE_SEAL_LABEL` to `"Shows where it looked"`.

```
      × DRIFT LOCK — each binding phrase still lives in its named exported constant
 AssertionError: expected 'Shows where it looked' to be 'Must prove it' // Object.is equality
 Expected: "Must prove it"
 Received: "Shows where it looked"
 Tests  1 failed | 29 passed (30)
```

Only the drift lock reds, which is correct and is the point: the presence check alone would have
stayed green (it searches for the constant's CURRENT value, which still ships), so the lock is what
carries the required half's teeth.

**All three reverted.** `git diff -- frontend/src/components/workflows/definitionOps.ts` is empty,
and the suite is back to **30 passed**.

---

## Gates

| Gate | Result |
|---|---|
| `npx vitest run src/components/workflows/governanceVocabulary.test.ts` | **30 passed** (5.27 s cold) |
| `npx tsc -b` | **33 errors — exactly the pre-185 baseline**, and **0** naming any file this plan touched |
| `node scripts/vitest-count-gate.cjs` | passes the VALIDATION posture — see below |
| `git diff --stat -- frontend/src backend/app` (task 2) | **0 files** — this plan changed no application source |
| `git diff --stat 59c32a06..HEAD -- supabase/migrations` | **0 files**, live head **113** |

**Count gate:** no `[count-decrease]` (every one of the 16 pinned files reports delta ≥ 0), no
`[total-below-baseline]`, no `[missing-file]`. Total **1628 → 1658**, exactly **+30** — the new file
and nothing else. `governanceVocabulary.test.ts` reports `new` and was correctly **NOT** added to
`BASELINE`. The only reason raised is `[failing-tests] 8`, the KNOWN pre-existing block recorded in
`185-VALIDATION.md` §"Count-gate posture", and all 8 are in **two files this plan never opened**:

| File | Failures | VALIDATION's recorded reading |
|---|---|---|
| `PublishGauntlet.test.tsx` | 6 | 10 |
| `WorkflowCanvas.test.tsx` | 2 | 4 |

Both are below their recorded churn band, and `WorkflowCanvas.test.tsx` passes **35/35 in
isolation** — its 2 failures are an axe timeout under parallel load, not a correctness regression.
Failures across the phase fell **34 → 8** while the total rose **1497 → 1658**.

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] Task 1's own docblock tripped Task 2's fence 4 (the D-ITEM-183-02 self-matching trap)**

- **Found during:** Task 2, fence 4 — the fence the plan says must return 0 returned **2**.
- **Issue:** both hits were in the file I had just written. `governanceVocabulary.test.ts` named the
  deleted symbol in two docblocks while explaining what it guards. This is exactly the trap the plan
  warns about and that cost `185-09` and `185-10` three false positives each — and the plan's own
  instruction to assemble tokens from parts was written for the *searched* tokens, so I applied it
  there and not to the prose.
- **Fix:** reworded both docblocks to describe the deleted derivation without spelling its symbol
  names, and added a sentence saying why. **The guard was not weakened** — no assertion changed, the
  suite is still 30/30, and fence 4 now returns **0**.
- **Files modified:** `frontend/src/components/workflows/governanceVocabulary.test.ts`
- **Commit:** amended into `3864d962` (the pre-amend hash was `3f83f199`).

**2. [Rule 2 — missing critical record] Added a third ledger row for `PhaseFormPanel.tsx`**

- **Found during:** Task 2, writing the CLAUDE.md ledger.
- **Issue:** the plan named two rows (`WorkflowCanvas.tsx`, `PhaseNodeCard.tsx`) and put the
  `PhaseFormPanel.tsx` G-5 record in STATE.md only. But CLAUDE.md's own guardrail protocol says
  *"the orchestrator must scan PLAN.md `files_modified` against this ledger"* — against the LEDGER,
  not against STATE.md. Recording the fire only in STATE.md means the next phase that opens the
  panel never sees it at the place the protocol actually reads.
- **Fix:** added the row, carrying the measured 23/6 split and the instruction to keep the shape.
- **Files modified:** `CLAUDE.md`
- **Commit:** `007b7e77`

**3. [Rule 2 — honest record] Hand-wrote the ROADMAP progress row instead of running the SDK verb**

- **Found during:** Task 2, state updates.
- **Issue:** `gsd-sdk query roadmap.update-plan-progress` counts SUMMARY files on disk. With this
  file present it would have written **11/11** for a phase blocked at a human gate, and the existing
  row still said *"Remaining: 185-11"*, which stops being true the moment this SUMMARY lands. Both
  readings are wrong.
- **Fix:** hand-edited the row to say **10/11**, that `185-11` is part-done with tasks 1-2 shipped,
  that task 3 is a blocking checkpoint that has not run, and that GOVERN-01/02/03 stay `Pending`.
  The Wave-6 checkbox in the plan list stays **unticked**.
- **Files modified:** `.planning/ROADMAP.md` (a 5th file, not in the plan's `files_modified`)
- **Commit:** `007b7e77`

### Deliberate non-execution

- **`gsd-sdk query requirements.mark-complete` — NOT run.** GOVERN-01 / GOVERN-02 / GOVERN-03 remain
  `Pending` in `REQUIREMENTS.md` (verified: lines 109-111). The operator UAT that would justify
  Complete has not run.
- **`gsd-sdk query state.advance-plan` — NOT run.** Both verbs write false completion records in
  this project.

### Plan-vs-tree notes (no code change forced)

- **The plan's fence commands are written bare** (`git diff --stat -- supabase/migrations`), which
  compares the working tree to HEAD and is trivially 0 on any clean tree — it proves nothing about a
  phase. Both readings were run; the phase-wide `59c32a06..HEAD` form is what VALIDATION records, so
  a re-run is reproducible and meaningful.
- **`REQUIREMENTS.md:36` (GOVERN-01) itself contains the banned overclaim** *"every value
  traceable"*. That is outside the swept tree and no conflict — and it is precisely D-185-02's
  point: the requirement's original wording overclaims what the engine can compute on free prose,
  and the shipped copy (`GROUNDING_ATTACHED_GATE`) deliberately does not.

---

## Threat Flags

None. This plan changed no application source — `git diff --stat -- frontend/src backend/app`
reports 0 files for Task 2, and Task 1 added a test file only. The plan's own threat register
records `none crossed`, and RESEARCH's Package Legitimacy Audit found this phase installs nothing;
no legitimacy checkpoint was required and none was raised.

## Known Stubs

None.

---

## ⛔ What is still owed — Task 3, the blocking operator gate

**The phase is NOT complete.** Every automated gate is green and every fence is recorded, but the
phase's stated acceptance bar is the G-4 lived-experience gate and it has not been driven. All rows
are authored in `185-VALIDATION.md` and must be recorded there, not re-authored:

- **4 × G-4 lived-experience scenarios** — watch a step lock in front of you · the seal survives a
  live run · arm it and walk away · the detour reads as a detour
- **2 × other manual-only** — the greyscale render (criterion 17) and the before/after screenshot
  diff on ordinary flow edges (D-185-18)
- **8 × SC#10 scoreboard** — OpenAI / Anthropic / Google / OpenRouter + multi-tool +
  parallel-thread + long-message + the negative row

`nyquist_compliant` stays `false` until those land. Expect one behaviour change during UAT that is
**not** a bug: a detected step whose golden run retrieves nothing now **blocks publish** (D-185-11's
publish half), and a red Google row is most likely the gate working as designed (RESEARCH L-3).

---

## Self-Check: PASSED

Files claimed created — verified present on disk:

- `FOUND: frontend/src/components/workflows/governanceVocabulary.test.ts`
- `FOUND: .planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/185-11-SUMMARY.md`

Commits claimed — verified in `git log`:

- `FOUND: 3864d962` — `test(185-11): the graded-governance vocabulary sweep, as a falsifiable test`
- `FOUND: 007b7e77` — `docs(185-11): the four phase-level fences and the guardrail records`

Acceptance greps re-run at write time:

- `grep -c "WorkflowCanvas.tsx" CLAUDE.md` → **1** (≥ 1 required)
- `grep -c "honoured-by-construction\|honoured by construction" .planning/STATE.md` → **1** (≥ 1 required)
- `grep -c "pending planner output" 185-VALIDATION.md` → **0** (no placeholder remains)
- `git diff --stat -- frontend/src backend/app` → **0 files**
- `grep -n "GOVERN-0" .planning/REQUIREMENTS.md` → all three still `Pending`
