---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 12
subsystem: frontend/workflow-vocabulary
tags: [vocab-01, sc5, d-187-15, d-187-16, corpus-sweep, pure-function, falsification-control]
requires:
  - "phaseVocabulary.nodeTitle(phase, ctx?) + NameContext — the 4-tier ladder landed by 187-04"
  - "canvasModel ToCanvasOptions.nameContext — the thread landed by 187-08"
  - "__fixtures__/canvasFixtures.ts ALL_FIXTURES — the checked-in corpus (Phase 183-05)"
  - "the TRANSCRIBED-NEVER-READ-LIVE header rule and the module's 'names a source' self-test"
provides:
  - "CanvasFixture.assets — the definition-level assets[], transcribed with their `kind`"
  - "AssetFixture — the two AssetRef fields a face resolution reads (filename + kind)"
  - "CORPUS_SKILL_ID / CORPUS_FOLDER_ID / PM_FOLDER_ID — the corpus's lookup subjects"
  - "phaseVocabulary.corpus.test.ts — the SC#5 check-1 and check-2 sweeps, 42 tests"
  - "materialConfigKey — D-187-15's narrowing, executable"
  - "preDerivedFace — the pre-187 two-tier ladder, kept as a falsification control"
affects:
  - "187-15 — the corpus test performs the `assets[] where kind === 'template'` FILTER 187-15 owes at the page; copy that shape, it is 3 lines"
  - "any future phase type — check 1's forbidden-token list is DERIVED from PHASE_TYPE_SENTENCES, so a 7th type is covered the day it is added"
  - "any future derived tier — add its field to materialConfigKey in the same edit, or check 2 silently stops measuring it"
tech-stack:
  added: []
  patterns:
    - "the acceptance bar extends the shipped corpus rather than transcribing a second one"
    - "a falsification control kept as a permanent test, not a temporarily-failing commit"
    - "forbidden-token lists DERIVED from the shipped vocabulary, never re-typed"
    - "word-boundary token matching, so a legitimate word containing a token does not false-positive"
    - "a sweep-coverage guard (afterAll over a visited Set) so describe.each cannot silently cover nothing"
key-files:
  created:
    - frontend/src/components/workflows/phaseVocabulary.corpus.test.ts
  modified:
    - frontend/src/components/workflows/__fixtures__/canvasFixtures.ts
decisions:
  - "NO new ALL_FIXTURES entry — a new entry writes a new projection snapshot block, and the plan's own gate is that this work moves no snapshot byte. Coverage rides on 5 template-bearing entries + 6 phases carrying skill_ref/folder_scope."
  - "The template asset is transcribed as `assets: [{filename, kind}]`, NOT pre-resolved to a filename. The lookup is a FILTER (`kind === 'template'`), and pre-resolving it into the fixture would delete the very step 187-15 owes."
  - "The two check-2 witnesses land on HAND-AUTHORED fixtures, because no real corpus row carries a skill_ref (measured: zero across supabase/migrations) and every real workflow's materially-different steps also differ in phase_type."
  - "TDD RED was observed by momentarily pointing the check-2 sweep at preDerivedFace (2 failed / 40 passed) rather than committing a knowingly-broken test — the implementation shipped in 187-04, so a fake RED would have been a comment."
metrics:
  duration: ~50 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 12: SC#5 made falsifiable over the corpus — Summary

SC#5's two checks are now automated as pure-function sweeps over the shipped fixture corpus, with
the one honest face collision documented with its measured shape instead of engineered away.

## What Was Built

**Task 1 — the corpus carries what the derived tier reads (`cb0ca5d9`).** The fixture module
deliberately omitted exactly the three fields D-187-04's ladder reads. All three are now transcribed,
each with its own `file:line`:

| Field | Where it landed | Cited source |
|---|---|---|
| `config.folder_scope` (single entry) | both phases of **both PM-pack** fixtures — the corpus's only REAL folder witness | `scripts/seed-pm-pack.py:361`, `:372` |
| `assets[]` with `kind: "template"` | the **3 curated starters** + the **2 PM-pack** entries | `migrations/094_starter_workflows.sql:97-101` / `:152-156` / `:207-211`; `scripts/seed-pm-pack.py:390-397` with filenames at `:108` / `:113` |
| `config.skill_ref` | `branching`'s `assess` — hand-authored, test-only | shape from `backend/app/models/harness.py:93` |
| `config.folder_scope` (same-type witness) | `indexGap`'s `stranded` — hand-authored, test-only | shape from `backend/app/models/harness.py:88` |

Three constants (`CORPUS_SKILL_ID`, `CORPUS_FOLDER_ID`, `PM_FOLDER_ID`) carry the ids; the first two
reuse the exact literals `canvasModel.purity.test.ts:283-284` already sweeps this corpus with, so two
suites cannot disagree about one id. The header's "WHAT IS TRANSCRIBED" paragraph — which still
claimed these fields were omitted — was rewritten; a comment naming an omission the module no longer
makes is the same defect as a false docblock.

**No live database was read.** Every value comes from a migration, a seed script or a model file. The
plan's measured claim (*"each starter holds exactly one `{kind: "template", filename: "<slug>.docx"}`"*)
was re-derived from **migration 094 itself** rather than inherited from the plan's `:54322` reading.

**Task 2 — the two sweeps (`46ba6915`).** `phaseVocabulary.corpus.test.ts`, 42 tests, zero components
mounted:

- **Check 1** — for every phase of every fixture, `nodeTitle(phase, ctx)` contains neither that
  phase's own `slug` nor any of the six raw `phase_type` tokens. Matching is **word-boundary and
  case-insensitive**, so a face reading `"Check with you"` would be caught for a phase slugged
  `check`, while a legitimate word merely containing a token is not a false positive. The forbidden
  list is `Object.keys(PHASE_TYPE_SENTENCES)` — derived, so a seventh phase type is covered the day
  it is added. Failures surface as an array of `fixture / slug / offending face`, diagnosable from the
  diff without a re-run.
- **Check 2**, narrowed per **D-187-15** — no two phases in one fixture whose `materialConfigKey`
  differs may share a face. The key is `[phase_type, skill_ref, sole folder_scope, template
  applicability]`: exactly the fields the derived tier reads, and deliberately **not** `prompt` /
  `model` / `max_steps` / `temperature`, because a tier reading those would be fabricating a name.
- **The documented exception** — three named tests assert `plan_execute_verify`'s `plan` and `verify`
  render one face, that their material keys are **equal** (which is why it is not a violation), and
  that the seed shape is still two bare `llm_single` steps with no `name`, no `skill_ref` and no
  `folder_scope`. `git status --porcelain backend/tests/conftest.py` is **empty** — the seed was not
  edited to fit the test.
- **A sweep-coverage guard** — check 1 records every `(fixture, phase)` it visits and an `afterAll`
  asserts the count equals the corpus total (36). A `describe.each` that silently covers nothing fails
  here (T-187-12-03).

## SC#5 check 2 on HEAD vs after the derived tier — the precise count

The SPEC says *"this check FAILS on HEAD today"*. Re-stated as a count over named members rather than
as a slogan, and kept executable as `preDerivedFace` (the shipped pre-187 two-tier ladder, reproduced
exactly):

| Resolution | Corpus members violating check 2 | Which |
|---|---|---|
| **Pre-187 two-tier** (`name` → type sentence) | **2 of 15** | `branching (synthetic skip_to_phase)` — `assess` + `draft` both render `"Write it up"`; `non-contiguous phase_index [0,1,3]` — `second` + `stranded` both render `"Write it up"` |
| **Shipped four-tier + the corpus name context** | **0 of 15** | — |

**Observed, not asserted.** The main check-2 sweep was momentarily pointed at `preDerivedFace` and run:
**2 failed / 40 passed**, with exactly the two messages above. It was then restored and re-run green.
Both states are pinned permanently by the falsification-control describe block, so the check cannot
quietly become vacuous.

**The honest scope of that result, stated so nobody reads more into it.** Both violating members are
the two **hand-authored** fixtures this plan extended. That is a measurement of the corpus, not a
weakness of the check: inside every *real* transcribed workflow (4 seeds, 3 starters, PM pack), every
step that differs materially also differs in `phase_type`, and the six type sentences are distinct —
so the real corpus at this scale could never have exhibited the collision, and a check sweeping only
it would have measured nothing. A test records exactly this (`records that no REAL transcribed member
has a materially-different pair at all`). The corpus is 15 fixtures / 36 phases, max 5 phases per
workflow; the SPEC's own *"do not over-claim it"* is quoted in the file's docblock.

The four bound witnesses that prove the maps are wired rather than inert:
`branching/assess → "Run the pricing policy check"`, `indexGap/stranded → "Search Supplier
Contracts"`, `pm-weekly-status-report/retrieve → "Search PM Demo Project (sample data)"`,
`risk-register/emit → "Fill risk-register.docx"`. Plus the never-fabricate floor asserted directly:
with an empty context the skill-bound step falls to `"Write it up"` and the face does not contain the
id.

## Verification

| Gate | Bar | Result |
|---|---|---|
| `phaseVocabulary.corpus.test.ts` | passes, 0 failed | **42 passed, 0 failed** (net-new) |
| Plan's 4-file verification set | 0 failed | **731 passed, 0 failed** |
| The 8-file vocabulary set **+ the corpus file** | ≥ 863 with net-new on top | **1022 passed, 0 failed** (9 files) |
| `canvasModel.{fixtures,roundtrip,test,purity}` | unchanged | **809 → 809 passed**, identical before and after Task 1 |
| `git status --porcelain .../__snapshots__` | empty | **empty** |
| `git status --porcelain backend/tests/conftest.py` | empty | **empty** |
| `grep -cE "render\(\|@testing-library"` on the corpus test | 0 | **0** |
| `grep -c "conftest.py:867-890"` | ≥ 1 | **1** |
| `grep -c "function materialConfigKey"` | 1 | **1** |
| `grep -c skill_ref` / `folder_scope` / `"template"` on the fixture | ≥ 1 / ≥ 1 / ≥ 3 | **8 / 17 / 8** |
| `grep -cE "read live\|psycopg2\|fetch\("` on the fixture | 0 | **0** |
| `npx eslint` on both files | clean | **clean** |
| `npx tsc -b` | see Deviations | **33 errors, 0 in `components/workflows`**, identical before and after |

## Deviations from Plan

### 1. [Rule 1 — a criterion that would have forced a worse design] The template asset is transcribed, not pre-resolved

- **Plan text:** add the template *"as a definition-level field on the fixture entry … so the corpus
  test can build the `NameContext.templateFilename` from it"*, with the acceptance grep
  `grep -c '"template"' … ≥ 3`.
- **Conflict:** a field holding only the resolved filename (`templateFilename: "risk-register.docx"`)
  satisfies the sentence but makes the grep unsatisfiable without stuffing the literal `"template"`
  into a comment or a citation string — which is gaming a grep, and the first attempt at it produced
  **invalid TypeScript** (nested unescaped double quotes inside a `source` string).
- **Resolution:** transcribe the asset properly — `assets?: readonly AssetFixture[]` with
  `{ filename, kind: "template" | "reference" }` — and let the corpus test apply the real
  `kind === "template"` **filter**. This is strictly better evidence: the filter is exactly the piece
  **187-15 still owes at the page**, and pre-resolving it into the fixture would have deleted the step
  under test. The grep is then satisfied by real values (8 occurrences), not by prose.
- **Commit:** `cb0ca5d9`.

### 2. [Rule 3 — two acceptance criteria in tension] No new `ALL_FIXTURES` entry was added

- The plan permits *"add at least two fixture entries — or extend two existing ones"*, but also gates
  on `git status --porcelain .../__snapshots__` being **empty**. A new entry necessarily writes a new
  projection snapshot block, so the two cannot both hold.
- Resolved in favour of the snapshot gate: both new witnesses **extend existing hand-authored
  fixtures**. Config fields are inert in the projection (the fixtures suite passes no context), so the
  snapshot is byte-identical and the corpus still gained the skill and folder tiers. Recorded in the
  `ALL_FIXTURES` docblock so the next reader does not "helpfully" add an entry.

### 3. [Rule 1 — TDD shape] RED observed as a live flip, not as a broken commit

- Task 2 is `tdd="true"`, but the implementation under test (`derivedFace` / the 4-tier `nodeTitle`)
  shipped in **187-04**, so a test file written against it passes on first run — as it did (42/42).
- A knowingly-broken RED commit would have been theatre. Instead the check-2 sweep was **momentarily
  pointed at `preDerivedFace`** and observed **2 failed / 40 passed** with the two expected pair
  messages, then restored and re-run green. The 187-08 precedent (*"a test that has never failed is a
  comment"*), and the state is now pinned permanently rather than living only in this summary.

### 4. [Rule 1 — inherited claim, already logged] `npx tsc -b` does not exit 0

- Both tasks carry *"`npx tsc -b` exits 0"*. Re-measured at this plan's HEAD: **exit 2, 33 `error TS`
  lines, zero in `src/components/workflows/`**. Identical count before and after this plan, so the
  delta is provably zero. Already logged as `D-ITEM-01` in the phase's `deferred-items.md` by 187-04;
  nothing new is added there — this plan re-measured rather than inheriting the number.

### 5. [Out of scope — recorded, not fixed] The directory-wide vitest run has 7–8 flaky failures

- `npx vitest run src/components/workflows src/pages/WorkflowBuilderPage` → **1946 passed / 7–8
  failed**, varying between two runs at the same commit. Owners: `PublishGauntlet.test.tsx` (4–5),
  `WorkflowCanvas.test.tsx` (the axe test), `WorkflowBuilderPage.canvas.test.tsx` (one flag-ON control).
- **All three are 100% green in isolation** — measured this session: **46 / 35 / 88 passed, 0 failed**.
  This reproduces 187-CONTEXT's correction verbatim (*"42–49 across 11 files, flaky at the same commit;
  `WorkflowCanvas.test.tsx` and `PublishGauntlet.test.tsx` are 100% green in isolation … gate on the
  two isolated named sets, never on the full frontend suite"*). None of the three imports either file
  this plan touched. Not chased, per the scope boundary; already tracked as SEED-056.

## Known Stubs

None. Every export is used and every check is exercised.

One item is **handed forward, not stubbed**: `ctx.templateFilename` still has no production producer.
This plan drives it through the pure function directly and says so in the test's own docblock — a user
cannot yet reach a template-named face on the canvas, because `WorkflowCanvas` receives `phases`, not
the `WorkflowDefinition`. **187-15 owes that resolution at the page, and `contextFor()` in
`phaseVocabulary.corpus.test.ts` is the 3-line shape to copy.**

## Threat Flags

None. No network surface, auth path, file access or schema — two test-scope files.

| Threat | Disposition |
|---|---|
| T-187-12-01 tampering with the acceptance bar | mitigated — every new field carries a `file:line`; the module's own "names a source" test is green; `git status` on `conftest.py` is empty, and a named test asserts the seed's shape is unchanged |
| T-187-12-02 an over-claimed SC#5 result | mitigated — the HEAD-vs-after count is stated over **named members** (2 of 15 → 0 of 15), the corpus size is quoted in the file docblock, and a test records that no *real* member has a materially-different pair at all |
| T-187-12-03 the corpus silently shrinking | mitigated — `≥ 15 fixtures / ≥ 36 phases` asserted, every SC#5-named member asserted present by name, and an `afterAll` guard on the visited-phase count |
| T-187-12-04 live DB reads in a fixture | mitigated — `grep -cE "read live\|psycopg2\|fetch\("` returns **0**; every value cites a checked-in artifact |

## For the Next Plan

- **`contextFor(fixture)` is the shape 187-15 needs** — `assets.find(a => a.kind === "template")?.filename`
  passed as `NameContext.templateFilename` on the `nameContext` prop 187-08 added.
- **Adding a derived tier means editing `materialConfigKey` in the same commit.** If a new tier reads a
  field the key does not, check 2 stops measuring it and goes quietly green.
- **Do not add an `ALL_FIXTURES` entry casually** — it writes a snapshot block. Extend an existing
  hand-authored fixture unless a genuinely new topology is needed.
- **`preDerivedFace` is a control, not dead code.** It is the only thing proving check 2 can fail.
- **Do not gate acceptance on `tsc -b` exiting 0** — `deferred-items.md` D-ITEM-01.

## Self-Check: PASSED

- `frontend/src/components/workflows/phaseVocabulary.corpus.test.ts` — FOUND (created)
- `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` — FOUND (modified)
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-12-SUMMARY.md` — FOUND (created)
- commits `cb0ca5d9`, `46ba6915` — both FOUND in `git log`
