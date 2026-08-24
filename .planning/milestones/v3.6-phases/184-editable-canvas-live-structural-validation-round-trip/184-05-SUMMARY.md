---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 05
subsystem: workflows
tags: [serializer, round-trip-property, reference-identity, corpus-dump, shape-generator, source-purity, react-free, wave-1]

# Dependency graph
requires:
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential, pinned at 16 files / 424 tests / 0 failing"
  - phase: 184-02
    provides: "`definitionOps.renumber` — the ONE home for contiguous `[0..n-1]` renumbering, which is precisely why `fromCanvas` must not renumber"
  - phase: 183-read-only-canvas
    provides: "`toCanvas` + its total `(phase_index, slug)` comparator, `PhaseSpecJSON`, the shipped `canvasModel.purity.test.ts` guard block, and the `indexGap` `[0,1,3]` fixture"
provides:
  - "`canvasModel.fromCanvas` — the ONE client canvas→definition serializer: carry-through BY REFERENCE, no edge argument, no position read, never renumbers, fails safe on duplicate slugs"
  - "Three new source-purity guards over `fromCanvas`'s OWN source slice (no edge read / no renumber / no position read), each with a positive control, plus controls for the slice extractor and comment stripper they depend on"
  - "`scripts/dump-workflow-corpus.py` — the READ-ONLY, key-preserving-redacting one-off that produces the D-184-17 artifact"
  - "`__fixtures__/corpusDump.json` — the committed, provenance-bearing artifact (currently HONESTLY EMPTY — see the verification blocker)"
  - "`__fixtures__/shapeGenerator.ts` — 15 hand-authored shapes, no new dependency"
  - "`canvasModel.roundtrip.test.ts` — the R2 property (84 assertions), reference identity as the primary proof, falsified"
affects: [184-06, 184-07, 184-10, 184-11, 184-12, 184-13, 185, 186, 188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A serializer whose correctness proof is OBJECT IDENTITY rather than deep equality — carry-through makes the entire dropped-field failure class unrepresentable instead of merely tested-for"
    - "Source guards scoped to ONE function's slice, with the comments stripped first, so a docblock is never forced to omit the identifier it is explaining"
    - "A one-off dump that writes an honestly EMPTY artifact when its source is unreachable, with the refusal reason recorded in-band, so 'not dumped' can never be misread as 'the corpus is empty'"
    - "Key-preserving redaction with an enum keep-list and a per-row slug ALIAS map, so redaction cannot destroy the shapes (duplicate slugs, resolvable branches) the property exists to exercise"

key-files:
  created:
    - frontend/src/components/workflows/canvasModel.roundtrip.test.ts
    - frontend/src/components/workflows/__fixtures__/shapeGenerator.ts
    - frontend/src/components/workflows/__fixtures__/corpusDump.json
    - scripts/dump-workflow-corpus.py
  modified:
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/canvasModel.purity.test.ts

key-decisions:
  - "`fromCanvas` takes NO `edges` argument (RESEARCH Q1) and a source guard proves its slice never names one — a future phase wanting edge-authored topology has to argue for it explicitly"
  - "The property compares against `[...phases].sort(byIndexThenSlug)`, never the raw input — `toCanvas` sorts, and the docblock says so before a reader can file the sort as a defect"
  - "Duplicate slugs fail SAFE by returning the source untouched (RESEARCH Q3) — losing a step on save is the worst failure available, so the fail-safe is lossless rather than best-effort"
  - "The three new source guards run over a COMMENT-STRIPPED slice, because otherwise `fromCanvas`'s docblock could not use the words `position`, `edges` or `phase_index` while explaining exactly those rules"
  - "The dump is EMPTY and says so in-band; no corpus data was fabricated, and the SPEC's drifted '95 / 40' numbers are asserted nowhere"

patterns-established:
  - "Falsify the identity claim, not just the shape: a shallow rebuild turns 13 `toBe` assertions red while every `toStrictEqual` backstop stays green — the observation that proves reference identity is the stronger claim"
  - "Never let a guard's own prose match the guard: three separate self-match traps were hit and fixed this plan (the read-only SQL grep, the serialized-form grep, and the member-access regex)"

requirements-completed: []  # CANVAS-02 is this plan's frontmatter requirement and is NOT complete. `requirements.mark-complete` was deliberately NOT run — see "Requirements".

# Metrics
duration: 33min
completed: 2026-07-27
---

# Phase 184 Plan 05: `fromCanvas` and the R2 Round-Trip Property Summary

**The one client serializer now exists and carries phases through BY REFERENCE, so every one of the ~20 config, 3 validator and 13 workflow-level fields `toCanvas` drops survives a save by construction rather than by diligence — proven as a reference-identity property over 15 hand-authored shapes plus the committed corpus, with the shipped `[0,1,3]` index gap and the duplicate-slug fail-safe pinned as regressions, and the rebuild failure mode falsified: a shallow copy turns 13 `toBe` assertions red while every `toStrictEqual` backstop stays green.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-07-27T09:52:00Z
- **Completed:** 2026-07-27T10:12:00Z
- **Tasks:** 3 (all `auto`, all committed atomically)
- **Files created:** 4 · **Files modified:** 2

## Task Commits

1. **Task 1: `fromCanvas` + three new source-purity guards** — `1a12a72d` (feat) — `canvasModel.ts`, `canvasModel.purity.test.ts` (69 → 79 tests)
2. **Task 2: the committed corpus dump + the shape generator** — `91614f4e` (feat) — `scripts/dump-workflow-corpus.py`, `__fixtures__/corpusDump.json`, `__fixtures__/shapeGenerator.ts`
3. **Task 3: `canvasModel.roundtrip.test.ts` — the R2 property** — `685d4e7f` (test) — 84 tests

No commit deletes a tracked file (`git diff --diff-filter=D` empty on all three).

---

## (a) The rebuild-vs-reference falsification — BOTH observations

R2's whole argument is that reference identity is a *strictly stronger* claim than deep equality. That is only worth asserting if a plausible-looking wrong implementation can satisfy the weaker claim and fail the stronger one. So the exact failure mode the plan names was planted.

**The probe** — the single `out.push(phase)` line replaced with a shallow rebuild, the filter and the fail-safe left intact so the identity claim is isolated:

```ts
if (phase !== undefined) out.push({ ...phase })   // FALSIFICATION PROBE — TEMPORARY
```

**Observation 1 — the `toBe` sweep FAILED, 13 of them, naming identity by message:**

```
Tests  13 failed | 71 passed (84)

× R2 round trip — every-field programmatic … > returns the SAME objects, in the SAME
  order, as the sorted source (reference identity)
AssertionError: expected { slug: 'only-programmatic', …(4) }
                to be   { slug: 'only-programmatic', …(4) }   // Object.is equality
… and 12 more, one per shape with at least one phase and distinct slugs
```

**Observation 2 — every `toStrictEqual` backstop stayed GREEN.** All 15 "deep-equals the sorted source" assertions passed under the probe, as did the whole corpus-meta block, the no-layout-key walk and the source-untouched checks. A deep-equality-only suite would have reported a fully green run on a serializer that had just replaced every phase object with a copy — and a copy is exactly what silently loses a field a future rebuild forgets to carry.

Two shapes did **not** go red, and both are informative rather than gaps:
- **`zero phases`** — there is no element to compare, so the per-element loop asserts nothing.
- **`duplicate-slug`** — it returns through the fail-safe branch (`[...source]`), which was never touched by the probe, so its phases stayed reference-identical.

**Restored —** `grep -c 'FALSIFICATION PROBE' canvasModel.ts` → **0**, `git diff` against the Task-1 commit shows `canvasModel.ts` byte-identical, and the suite is **84/84 green**.

---

## (b) The dump's `_provenance` block, verbatim

```json
{
  "dumped_at": "2026-07-27T06:01:44+00:00",
  "source": "postgresql://postgres:postgres@127.0.0.1:54322/postgres · public.workflow_definitions",
  "query": "SELECT id::text, slug, version, status, definition->'phases' AS phases FROM public.workflow_definitions ORDER BY slug, version",
  "row_count": 0,
  "note": "EMPTY BY HONESTY, NOT BY FACT. The local database was unreachable when this artifact was written, so NO shapes were read and none were invented. An empty definitions array here means 'not dumped', never 'the corpus is empty'. The hand-rolled shapeGenerator.ts carries the real coverage, so the round-trip property is meaningful without this file. Regenerate before phase verification: start the local stack, then run scripts/dump-workflow-corpus.py with the backend venv interpreter. Reason recorded in _provenance.unreachable_reason.",
  "rows_with_zero_phases": 0,
  "rows_with_duplicate_slugs": 0,
  "rows_with_index_gaps": 0,
  "max_phase_count": 0,
  "skip_to_phase_uses": 0,
  "unreachable_reason": "OperationalError: connection to server at \"127.0.0.1\", port 54322 failed: Connection refused (0x0000274D/10061)\n\tIs the server running on that host and accepting TCP/IP connections?"
}
```

**The artifact was produced by the script itself, not hand-written.** `backend/venv/Scripts/python.exe scripts/dump-workflow-corpus.py` was run, took its unreachable branch, and emitted the file above (exit 0). That matters: the fallback path is executed code with an observed output, not a promise about what the script would do.

### ⚠ VERIFICATION BLOCKER — the dump must be regenerated before `/gsd:verify-work`

- **What:** `frontend/src/components/workflows/__fixtures__/corpusDump.json` carries `row_count: 0` and an empty `definitions` array.
- **Why:** the local Supabase at **`postgresql://postgres:postgres@127.0.0.1:54322/postgres`** refused the connection (`ConnectionRefusedError` / WinError 10061) — Docker Desktop was not running. This was confirmed twice: a raw socket probe before Task 2, and psycopg2's own `OperationalError` during the dump.
- **Impact on this plan: none.** D-184-17 states plainly that the live corpus is 2-steps-modal and uses `skip_to_phase` zero times, so the generator is what earns R2. The property sweeps 15 generated shapes covering node counts 0/1/2/3/12, all six phase types, both branch outcomes, both index anomalies and the duplicate-slug fail-safe — and the corpus-meta block asserts exactly that coverage, so an empty dump cannot silently weaken the suite.
- **Operator action:** `supabase start`, then
  `backend/venv/Scripts/python.exe scripts/dump-workflow-corpus.py`, then commit the regenerated artifact. The suite picks it up with no code change — `describe.each` unions the dump's rows in automatically.
- **What was NOT done:** no corpus data was invented, no row counts were guessed, and the SPEC's known-drifted "95 definitions / 40 zero-phase" numbers are asserted **nowhere** in any file this plan touched (CONTEXT anti-drift note 1).

---

## (c) `canvasFixtures.ts` was NOT modified

`git status --porcelain frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` returned **empty** before Task 2's commit and returns empty now; the file appears in **no** commit of this plan (`git diff --name-only 1a12a72d~1 HEAD` does not list it). D-184-17 and CONTEXT anti-drift note 2 hold: the snapshot corpus and its acceptance guard — which forbids exactly the local-stack tokens a provenance block contains — ship untouched. The dump is a separate artifact in the same directory, and `shapeGenerator.ts` reuses only the `CanvasFixture` **type**.

The file *is* read from: `canvasModel.purity.test.ts` and `canvasModel.roundtrip.test.ts` both import the shipped `indexGap` fixture, because pinning the round trip against a `[0,1,3]` shape *already committed to this repo* is stronger than pinning it against one this plan authored.

---

## Import-path changes in this plan, enumerated (D-184-08)

**Two**, both in `canvasModel.purity.test.ts`, both **pure additions** — no existing import line was edited, so that file's diff is 141 insertions / **0 deletions**:

| # | Change | Why |
|---|---|---|
| 1 | **Added** `import { fromCanvas } from "./canvasModel"` as its own statement | The new function under test. Written as a second statement rather than widening the shipped `{ toCanvas, CANVAS_LAYOUT }` line, so `git diff` on this file shows added lines only and the "no existing assertion touched" claim is auditable mechanically |
| 2 | **Added** `import { indexGap } from "./__fixtures__/canvasFixtures"` as its own statement | Same reason; the shipped `{ ALL_FIXTURES, evalCoverage }` line is untouched |

**Assertion edits in pre-existing test files: ZERO.** Proof:

```
$ git diff --stat 1a12a72d~1 HEAD -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'
 .../workflows/canvasModel.purity.test.ts    | 141 +++++++++++++++++
 .../workflows/canvasModel.roundtrip.test.ts | 238 ++++++++++++++++++++++++
 2 files changed, 379 insertions(+)
```

Two test files, 379 insertions, **0 deletions**. One is net-new; the other gained only appended blocks. The 184-01 `soulData.test.ts` carve-out remains the only permitted assertion edit in phase 184 and stays **spent** — `soulData.test.ts` reported its pinned **14** on every gate run here.

---

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run src/components/workflows/canvasModel.roundtrip.test.ts` | 0 failures | **84 passed** |
| `npx vitest run src/components/workflows … + the 3 gating suites` | 0 failures | **20 files / 752 tests passed, 0 failed** |
| `node scripts/vitest-count-gate.cjs` | exit 0, all 16 pinned held | **exit 0** on every task; 752 total, **0 failing**, 16/16 present, **no per-file decrease** |
| Pinned-file deltas | 0 everywhere | **0 everywhere except `canvasModel.purity.test.ts` 69 → 79 (+10, an ALLOWED increase)**; new rows: `canvasModel.roundtrip.test.ts` 84, plus 184-02/03/04's `definitionOps` 171 / `PhaseNodeCard` 30 / `builderStore` 33 |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (the `develop` differential) | **33** — equal to baseline, and zero of the 33 names a file this plan touched |
| `npx vite build` | exit 0 | **exit 0**, built in 4.04 s |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** |
| `npx eslint` on all four touched/created source files | clean | **zero problems** |
| `grep -icE '<row-mutating SQL verbs>' scripts/dump-workflow-corpus.py` | 0 | **0** (see Deviation 2) |
| `python scripts/dump-workflow-corpus.py --help` | exit 0 | **exit 0** on the *global* interpreter, which has no `psycopg2` — the import is lazy by design |
| `corpusDump.json` `_provenance.row_count === definitions.length` | true | **true** (0 === 0), asserted both by the plan's node one-liner and by a suite assertion |
| Redaction grep on `corpusDump.json` | 0 | **0** — no tenant, owner or authoring column, no long prompt body, no skill storage prefix |
| `git status --porcelain … canvasFixtures.ts` | empty | **empty** |
| `git diff --name-only -- supabase/migrations \| wc -l` | 0 (R3 — slot 114 stays RESERVED) | **0** |
| `git diff --name-only -- backend/ \| wc -l` | 0 (frontend + scripts only) | **0** |
| `grep -c 'JSON.stringify' canvasModel.roundtrip.test.ts` | 0 | **0** (see Deviation 3) |
| `generatedShapes()` shape count | ≥ 12 | **15**, with names covering `skip`, `gap`, `duplicate-slug`, `deep` and all six phase types — asserted in the suite, not by inspection |
| REQUIREMENTS.md | untouched, all 5 phase REQ-IDs Pending | **untouched** |
| Deletions in any commit | none | **none** |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The "never reads an edge" regex fired on `fromCanvas`'s own parameter**

- **Found during:** Task 1, the first run of the new guard
- **Issue:** the guard as specified forbids `.source` / `.target` member access in the slice. Written as `/\.(source|target)\b/` it matched **`[...source]`** — the fail-safe's spread of `fromCanvas`'s own `source` PARAMETER, where the leading `.` is the third dot of the spread operator and no member is read at all. The guard was red on correct code. The tempting "fix" — renaming the parameter, or dropping the spread — would have bent the implementation around a defective regex.
- **Fix:** the regex now requires the dot to follow an identifier or a closing bracket (`/[A-Za-z0-9_$\])]\.(source|target)\b/`), which is what "member access" actually means. The comment above it records the false positive by name so nobody re-broadens it, and a second positive control (`edge.target`) was added alongside the first.
- **Files modified:** `frontend/src/components/workflows/canvasModel.purity.test.ts`
- **Committed in:** `1a12a72d`

---

**2. [Rule 1 - Bug] The dump script's docstring matched its own read-only grep**

- **Found during:** Task 2
- **Issue:** the acceptance criterion is a case-insensitive grep for the three row-mutating SQL verbs followed by a space, and it must return 0. The docstring quoted that grep command verbatim as evidence of the guarantee — so the file matched itself and the criterion returned **1**. This is D-ITEM-183-02's trap in its purest form: prose that can only pass by omitting what it is about.
- **Fix:** the docstring now names the check by CONCEPT ("the three row-mutating SQL verbs followed by a space") and explains *why* it does not spell them, so a reader learns both the rule and the reason. It also records the second, independent guarantee the plan did not ask for: the connection is opened `readonly=True`, so the server would refuse a write even if one were somehow attempted.
- **Files modified:** `scripts/dump-workflow-corpus.py`
- **Verification:** the grep returns **0**
- **Committed in:** `91614f4e`

---

**3. [Rule 1 - Bug] The round-trip suite's docblock matched its own serialized-form grep** (the same trap, third instance)

- **Found during:** Task 3
- **Issue:** the acceptance criterion greps the round-trip file for the JSON serializer's name and expects 0. The docblock explained "no serialized comparison here" by naming it, so the grep returned **1** — again passing prose, failing check.
- **Fix:** the paragraph now states the rule without writing the identifier, and says explicitly that it is left unwritten so the grep can return zero without the paragraph lying. Three self-match traps in one plan is worth carrying forward as a pattern, not three coincidences.
- **Files modified:** `frontend/src/components/workflows/canvasModel.roundtrip.test.ts`
- **Committed in:** `685d4e7f`

---

**4. [Rule 3 - Blocking] `Record<string, unknown>` loses its index signature when spread with a known key**

- **Found during:** Task 3, the workflow-level assertion
- **Issue:** `const after = { ...before, phases: roundTrip(phases) }` — where `before` is `Record<string, unknown>` — infers as `{ phases: PhaseSpecJSON[] }`, dropping the index signature. The subsequent key walk then failed with `TS7053: Element implicitly has an 'any' type…`, pushing the differential from 33 to **34**. This is a sibling of 184-04's Deviation 3 (`Omit` collapsing against an index signature): the same class of surprise, surfacing far from its cause.
- **Fix:** the binding is annotated `const after: Record<string, unknown> = …`, with a comment naming the cause so nobody removes the annotation as redundant. Casting the index expression or reaching for `any` would have hidden it.
- **Files modified:** `frontend/src/components/workflows/canvasModel.roundtrip.test.ts`
- **Verification:** `tsc` back to **33**
- **Committed in:** `685d4e7f`

---

**5. [Rule 2 - Missing Critical] The dump's provenance note names the redaction rule by concept, not by column name**

- **Found during:** Task 2
- **Issue:** the plan's suggested note text lists the excluded columns literally. The plan's OWN redaction acceptance grep scans the artifact for those exact tokens and must return 0 — so the recommended note would have failed the recommended check.
- **Fix:** the artifact's note describes the exclusions in concept terms ("no tenant, owner or authoring-account columns — none of those are selected at all"), while the **script's docstring** — which the redaction grep does not scan, and which is the right home for implementation detail — names every excluded column literally. The reader loses nothing; the artifact carries no tenant-identifying token.
- **Files modified:** `scripts/dump-workflow-corpus.py`
- **Committed in:** `91614f4e`

---

**6. [Rule 2 - Missing Critical] The source guards run over a COMMENT-STRIPPED slice**

- **Found during:** Task 1
- **Issue:** the plan scopes the three guards to `fromCanvas`'s source slice. Applied to the raw slice they would forbid `fromCanvas`'s own explanation from using the words `position`, `edges` or `phase_index` — while those three words ARE the rules being explained. CONTEXT anti-drift note 4 calls this out by name: a guard that only passes by making a comment lie is broken.
- **Fix:** a two-step extraction — `sliceFrom` (declaration → next top-level `export`, or EOF) then `stripComments` — so the guards test CODE. Both helpers carry their own positive controls: the extractor is proven to stop at the next export on a synthetic two-export source, and the stripper is proven to remove a planted `.position` from a comment while keeping one in code. A third control asserts the real slice contains `fromCanvas` and neither `toCanvas`'s declaration nor its `CANVAS_LAYOUT.PITCH_X` literal.
- **Files modified:** `frontend/src/components/workflows/canvasModel.purity.test.ts`
- **Committed in:** `1a12a72d`

---

**7. [Rule 2 - Missing Critical] `requirements.mark-complete` was NOT run**

- **Found during:** post-plan state updates
- **Issue:** this plan's frontmatter names `requirements: [CANVAS-02]`. The verb flips it to **Complete** off the frontmatter alone, as it did in 184-01 (reverted) and was avoided in 184-02/03/04. CANVAS-02 is *"a user can add, move, connect and delete phase-nodes…"* — **no affordance ships here.** This plan adds a serializer and its proof; nothing on the canvas changed and no user can observe a difference.
- **Fix:** the verb was not invoked. `.planning/REQUIREMENTS.md` is untouched; all five phase REQ-IDs (`VALID-02`, `VALID-03`, `CANVAS-02`, `CANVAS-03`, `CANVAS-04`) remain **Pending**. The orchestrator marks them at phase end when the behaviour is observable.
- **Files modified:** none

---

**Total deviations:** 7 (3 bugs, 1 blocking, 3 missing-critical)
**Impact on plan:** none expands scope. The file set is exactly the six in `files_modified`. Deviations 1–3 are all the same class — a guard whose own prose or whose over-broad pattern makes it fire on correct code — and each was fixed by making the guard mean what it says rather than by bending the code around it. Deviations 5 and 6 are the plan's intent implemented correctly rather than literally. Deviation 7 prevents a false completion claim in a planning artifact.

---

## Design decisions worth carrying forward

- **The proof is identity, so the implementation cannot be "improved" into a bug.** Any future contributor who replaces the carry-through with a rebuild — however faithful — turns 13 assertions red immediately, with `Object.is equality` in the message. The falsification above is the evidence that this is true, not a hope.
- **The comparator is quoted, not re-derived.** `byIndexThenSlug` in the round-trip suite is character-for-character `canvasModel.ts:220-223` (and therefore `definitionOps.orderPhases`). Three copies now exist for three different reasons, and each names the others; if a fourth appears, that is the moment to extract.
- **The sort trap is documented before it is encountered.** The single sentence "`toCanvas` SORTS" appears at the top of the sweep and in the purity file's behaviour block, because without it a correct property reads as a defect on the first unsorted definition anyone tries.
- **Redaction has a keep-list, not just a deny-list.** Blanket-redacting every string would have erased `phase_type` — the config union's discriminator — and with it every unit of coverage the dump exists to provide. The keep-list is enum-ish values only; phase slugs are aliased through a per-row map so a duplicate stays duplicated and a resolvable branch stays resolvable.
- **An unreachable source produces an artifact, not an absence.** The empty dump is committed WITH its refusal reason, so `git log` shows when the corpus was last really read and a reader can never mistake "not dumped" for "nothing there".
- **`generatedShapes()` returns fresh objects per call.** A shared module constant would make "the same object" true for an uninteresting reason and quietly weaken the identity proof.

## Requirements

**CANVAS-02 is NOT complete, and `.planning/REQUIREMENTS.md` was deliberately left untouched.** This plan ships the serializer CANVAS-02's save path will run through, and its proof. No canvas affordance was added; the canvas is still read-only. The orchestrator marks all five phase REQ-IDs at phase end (Phase 182's VALID-01 precedent).

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-05-01 (info disclosure — `corpusDump.json`) | mitigate | **CLOSED for the artifact as committed, and by construction for a future one.** ~~The committed file contains zero definition rows.~~ *(Superseded 2026-07-28 by the security audit: `cb7d9244` later regenerated the corpus, so the committed file now carries **108 rows** — and it was re-verified redacted, with 0 `org_id`/`user_id`/`created_by`, all 111 UUIDs synthetic and every prompt reduced to a placeholder. The claim below is what holds; the "zero rows" wording described a superseded artifact, and the phase does NOT owe a regen.)* The redaction grep returns 0. The script's redaction is key-preserving with a one-character placeholder for free text, stable synthetic UUIDs for identifier-shaped values, and a per-row alias map for phase slugs; the five sensitive columns are never selected, so they cannot leak even through a bug in the redactor |
| T-184-05-02 (tampering — the dump script) | mitigate | **CLOSED.** Read-only by construction: one SELECT, five columns, `conn.set_session(readonly=True)`, no `--apply` path, and the row-mutating-verb grep returns 0. It connects to the live LOCAL DB directly — never `supabase db push` / `db reset` |
| T-184-05-03 (tampering — `fromCanvas` output) | mitigate | **CLOSED.** Carry-through cannot add or rename a key, so `extra="forbid"` cannot be tripped by the serializer; a no-layout-key walk over the round-tripped payload runs on every shape in the sweep, and the workflow-level assertion pins the key SET. The duplicate-slug fail-safe means a phase can never be silently dropped on save — asserted for both the length and the per-element identity |
| T-184-05-04 (DoS — hostile shapes) | mitigate | **CLOSED.** Index gaps, duplicate indices, duplicate slugs, an unresolvable branch, a 12-deep chain, a zero-phase draft and one fully-populated phase per config-union member are all in the sweep. Nothing throws; the property fails loudly rather than the app failing quietly |
| T-184-05-SC (supply chain — npm installs) | accept | **Honoured — this plan installed nothing.** `frontend/package.json` and the lockfile appear in none of the three commits. `psycopg2` is already used by shipped scripts and lives in the backend venv |

## Scope Fence Compliance

- **Frontend + `scripts/` only.** `git diff --name-only -- backend/ supabase/migrations` returns **0** lines across all three commits. Slot 114 stays RESERVED.
- **No env var, no dependency, no migration, no cloud parity owed.**
- **The dump script lives in `scripts/`, never under `backend/`** — a scratch `.py` inside the uvicorn `--reload` watch tree wedges the dev server on Windows.
- **`__fixtures__/canvasFixtures.ts` untouched** (D-184-17 / its acceptance guard).
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed anywhere.

## Issues Encountered

- **Three self-matching guards in one plan** (Deviations 2, 3 and the class Deviation 6 pre-empts). The pattern is now unmistakable: any acceptance criterion expressed as "grep this file for token X and expect 0" will be tripped by the very docblock that explains the rule. The fix is always the same — name the CONCEPT in prose, put the literal token where the grep does not look (a sibling file, or a comment the guard strips) — and it is worth applying pre-emptively when authoring the next such criterion.
- **`Record<string, unknown>` spread loses its index signature** (Deviation 4), the sibling of 184-04's `Omit` collapse. Both surface as a confusing error far from the cause. Annotate the binding.
- **The local stack being down is not a blocker for this plan, but it IS one for the artifact.** Recorded above as an explicit verification blocker rather than quietly deferred.
- **`PublishGauntlet.test.tsx` continues to flake under a fully-parallel `npm test`** while passing 24/24 in the targeted run and in the gate. Named, not fixed — a harness-load artifact, and out of this plan's scope.

## User Setup Required

**One, and it is the verification blocker above:** start the local stack and regenerate `corpusDump.json` before `/gsd:verify-work`:

```
supabase start
backend/venv/Scripts/python.exe scripts/dump-workflow-corpus.py
```

Then commit the regenerated artifact. No env var, no migration, no dependency, no cloud step.

## Next Phase Readiness

- **184-10 can add `commitCanvasNodes` to the builder store.** `fromCanvas` is the function it was waiting on, and its contract is now pinned by 84 assertions plus three source guards. The store still has no positional field, so a nudge cannot reach the payload.
- **184-07's `canvasNudge` inherits a hard boundary.** The round-trip property walks every round-tripped payload for `position` / `x` / `y` / `layout` keys, so a nudge that leaked into the definition fails this suite, not just the store's.
- **185 and 189 add DATA to phases, not new serializer code.** Carry-through means a new config field needs no change to `fromCanvas` at all — that is the point of the shape — and the generator gains one shape rather than the serializer gaining a branch.
- **The `edges` door is deliberately shut and labelled.** A future phase authoring topology from drawn connections must change the signature AND delete a named guard, which is exactly the explicit argument RESEARCH Q1 asked for.
- **The zero-assertion-edit gate is still armed and the 184-01 carve-out is still spent.** This plan consumed none of it.
- **Carried forward from 184-01:** the live in-app five-surface icon sweep remains a phase-verification G-4 row (needs Docker up — the same prerequisite as the dump regeneration, so both can be done in one pass).

## Self-Check: PASSED

- `frontend/src/components/workflows/canvasModel.ts` — FOUND
- `frontend/src/components/workflows/canvasModel.purity.test.ts` — FOUND
- `frontend/src/components/workflows/canvasModel.roundtrip.test.ts` — FOUND
- `frontend/src/components/workflows/__fixtures__/shapeGenerator.ts` — FOUND
- `frontend/src/components/workflows/__fixtures__/corpusDump.json` — FOUND
- `scripts/dump-workflow-corpus.py` — FOUND
- Commit `1a12a72d` — FOUND
- Commit `91614f4e` — FOUND
- Commit `685d4e7f` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
