---
phase: 183-read-only-canvas
plan: 02
subsystem: frontend
tags: [workflows, canvas, vocabulary, parity-test, cross-language-fixture, tsconfig]

# Dependency graph
requires:
  - phase: 183-read-only-canvas
    plan: 01
    provides: the recorded 33-signature `tsc -b` baseline this plan's tsc gate is read against
  - phase: 103-workflow-studio
    provides: "`PhaseSpineGraph.tsx` — the donor for the read shapes, the labels, and the (defective) parse"
  - phase: 124-workflow-soul
    provides: "`soulData.PHASE_GLYPHS` — the glyph map this module imports-not-redeclares"
  - phase: 091-harness
    provides: "`backend/app/services/harness/reachability.py parse_skip_target` — the authoritative parse"
provides:
  - "`frontend/src/components/workflows/phaseVocabulary.ts` — THE one shared phase vocabulary (11 exported symbols)"
  - "`parseSkipTarget` with the corrected backend prefix-length slice semantics (C-1)"
  - "`frontend/src/components/workflows/__fixtures__/skipParseCases.json` — the ONE canonical 12-row case table both languages read"
  - "`backend/tests/unit/test_183_skip_parse_parity.py` — the Python half of the parity pin (13 tests)"
  - "`resolveJsonModule: true` in `frontend/tsconfig.app.json` — JSON fixtures now compile"
  - "`src/components/workflows/__fixtures__/` — net-new home for cross-language shared fixtures"
affects: [183-04, 183-05, 183-06, 184-editable-canvas, 185-graded-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "one shared JSON fixture parametrized by BOTH a vitest `it.each` and a pytest `parametrize` — executable cross-language parity instead of a prose claim"
    - "module docblocks state the CURRENT extraction state literally and name the plan that performs the cut, never asserting an extraction that has not happened"
    - "total resolvers over author-supplied JSONB: `?? raw` echo, never a bare map read, never a cast into a narrower enum"

key-files:
  created:
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/phaseVocabulary.test.ts
    - frontend/src/components/workflows/__fixtures__/skipParseCases.json
    - backend/tests/unit/test_183_skip_parse_parity.py
  modified:
    - frontend/tsconfig.app.json

key-decisions:
  - "C-1 shipped: `parseSkipTarget` slices `skip_to_phase:` by LENGTH, so `skip_to_phase:a:b` → `a:b` (was `b` via `lastIndexOf`)"
  - "The glyph map is imported from soulData, never re-declared — asserted by a `?raw` grep, not by convention"
  - "`v.kind` is compared as a plain string and NEVER cast to `ValidatorKind` — the backend declares nine kinds, `deriveTier` narrows to five, so a cast would be a lie"
  - "The grounding badge reuses the shipped `deriveTier` strictness glyphs 🔒 / ◐ / ○ so the app speaks ONE strictness language"
  - "`resolveJsonModule` was turned on as a named, deliberate one-line change — it is additive and there was no pre-existing `.json` import in `frontend/src` to regress"

patterns-established:
  - "`__fixtures__/` beside the suites that read it is the home for shared test data"
  - "a shared-table control carries a truncation guard in BOTH languages, so neither half can be silently weakened"

requirements-completed: [CANVAS-01]

# Metrics
duration: 8min
completed: 2026-07-25
---

# Phase 183 Plan 02: The Shared Phase Vocabulary Summary

**One shared `phaseVocabulary` module now owns the definition read shapes, the `skip_to_phase` parse,
the node-title resolution and the two derived badge signals — with the parse corrected to the
backend's real prefix-slice semantics and pinned by a 12-row JSON case table that a vitest `it.each`
and a pytest `parametrize` both read from disk.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-25T20:04:33Z
- **Completed:** 2026-07-25T20:12:40Z
- **Tasks:** 3 of 3
- **Files modified:** 5 (4 created, 1 modified)

## The exported symbol list (verbatim — plans 183-04, 183-05 and 183-06 import from here)

From `frontend/src/components/workflows/phaseVocabulary.ts`:

| Symbol | Kind | Signature / value |
|---|---|---|
| `ValidatorJSON` | interface | `{ kind?: string; on_failure?: string; [k: string]: unknown }` |
| `PhaseConfigJSON` | interface | `{ phase_type: string; [k: string]: unknown }` |
| `PhaseSpecJSON` | interface | `{ slug; phase_index; name?: string \| null; config: PhaseConfigJSON; validators?: ValidatorJSON[] }` |
| `SKIP_PREFIX` | const | `"skip_to_phase:"` |
| `parseSkipTarget` | function | `(onFailure: string \| null \| undefined) => string \| null` |
| `PHASE_TYPE_SENTENCES` | const | `Record<string, string>` — the 6 plain-language business sentences |
| `PHASE_TYPE_SUBTITLES` | const | `Record<string, string>` — the 6 supporting lines |
| `PHASE_TYPE_LABELS` | const | `Record<string, string>` — the ⌥ Technical-names vocabulary (verbatim from `PhaseSpineGraph.tsx:34-41`) |
| `nodeTitle` | function | `(phase: PhaseSpecJSON) => string` |
| `technicalTitle` | function | `(phase: PhaseSpecJSON) => string` |
| `Grounding` | interface | `{ mode: "strict" \| "flag" \| "open"; words: string; glyph: string }` |
| `groundingFor` | function | `(phase: PhaseSpecJSON) => Grounding` |
| `waitsForYou` | function | `(phase: PhaseSpecJSON) => boolean` |

Eleven of these were named in the plan's artifact contract; `Grounding` and `groundingFor` complete
the D-183-07 slot-1 pair. Nothing else is exported.

The locked strings (183-04/05/06 must render these, not re-invent them):

| `phase_type` | sentence (`nodeTitle` default face) | subtitle | technical label |
|---|---|---|---|
| `programmatic` | Prepare the inputs | A fixed step the server runs | Server step |
| `llm_single` | Write it up | Writes one piece in one pass | AI write step |
| `llm_agent` | Work out how to do it | Searches and decides its own next move | AI agent step |
| `llm_batch_agents` | Work on the parts together | Several assistants work in parallel | Parallel agents |
| `llm_human_input` | Check with you | Pauses here until you answer | Needs you |
| `llm_emit` | Produce the deliverable | Fills your template and produces the file | Deliverable |

Grounding faces: `strict` → 🔒 "Must cite its sources"; `flag` → ◐ "Flags uncited claims";
`open` → ○ "No sources needed".

## The shared case table

`frontend/src/components/workflows/__fixtures__/skipParseCases.json` — **12 rows** (the plan's floor,
and the guard in both languages asserts `>= 12`, so it can grow but not shrink):

| `on_failure` | `expected` |
|---|---|
| `skip_to_phase:escalate` | `escalate` |
| **`skip_to_phase:a:b`** | **`a:b`** — the C-1 correction |
| `skip_to_phase:` | `null` |
| `skip_to_phase:   ` | `null` |
| `skip_to_phase:  gather  ` | `gather` |
| `fail_run` | `null` |
| `ask_user` | `null` |
| `retry` | `null` |
| `""` | `null` |
| `null` | `null` |
| `skip_to_phase` | `null` |
| `SKIP_TO_PHASE:gather` | `null` |

Read by `phaseVocabulary.test.ts` (an `it.each` over the loaded rows) and by
`backend/tests/unit/test_183_skip_parse_parity.py` (a `pytest.mark.parametrize` over the same file,
resolved via `Path(__file__).resolve().parents[3]`). Neither suite declares a literal case list.

## Accomplishments

- **The C-1 defect is fixed at the source and cannot silently return.** The old
  `PhaseSpineGraph.parseSkipTarget` split on `lastIndexOf(":")` while its docblock claimed backend
  parity; the new module slices by `SKIP_PREFIX.length` and a `?raw` grep asserts the string
  `lastIndexOf` appears nowhere in it.
- **The parity claim is executable in two languages off ONE table.** Deliberately corrupting the
  `a:b` row made **both** suites fail (pytest: 2 failed / 11 passed; vitest: 2 failed) — confirmed,
  then reverted. That mutation check is the evidence the control is load-bearing rather than
  decorative.
- **Every resolver is total.** Unknown `phase_type` echoes the raw type; unknown/absent
  `citation_policy` (including `partial`, `draft` and a future value) resolves to `open`; an unknown
  validator kind such as `regex_match` is ignored without a cast; a missing `validators` array
  defaults to `[]`; a malformed `on_failure` returns `null`. All asserted, none throw.
- **No consumer was repointed** — `PhaseSpineGraph.tsx` is byte-unchanged, exactly as the plan
  requires. 183-04 performs the hard cut.
- **The module's docblock tells the truth about its own state.** It says explicitly that the
  duplicate still exists and names 183-04 as the cut — the opposite of `soulData.ts`'s header, which
  asserted an extraction that had not happened and is precisely how this drift survived two phases.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1a | Failing spec for the shared module (TDD RED) | `e578f478` | test |
| 1b | `phaseVocabulary.ts` — the one shared module (TDD GREEN) | `92127b39` | feat |
| 2 | Shared C-1 case table + `resolveJsonModule` + the TS parity block | `875e7601` | test |
| 3 | The Python half of the parity control | `a2ee7c52` | test |

No REFACTOR commit — the GREEN implementation needed no cleanup pass.

## Files Created/Modified

- `frontend/src/components/workflows/phaseVocabulary.ts` — **220 lines**, net-new. Docblock,
  3 read shapes moved verbatim, `SKIP_PREFIX`, `parseSkipTarget`, 3 vocabulary maps, `nodeTitle`,
  `technicalTitle`, `Grounding` + `groundingFor`, `waitsForYou`.
- `frontend/src/components/workflows/phaseVocabulary.test.ts` — **40 tests**, 7 describe blocks
  including the parity block and the house `?raw` purity block.
- `frontend/src/components/workflows/__fixtures__/skipParseCases.json` — net-new directory + the
  12-row table with a `note` naming `reachability.py:89-98` as authoritative.
- `backend/tests/unit/test_183_skip_parse_parity.py` — **13 tests** (12 parametrized rows + the
  truncation guard). The ONLY file this phase adds under `backend/`, and it is a test.
- `frontend/tsconfig.app.json` — **+1 / −0** (`git diff --numstat` = `1 0`): `"resolveJsonModule": true`.

## Decisions Made

- **A separate file, not a fold into `soulData.ts`.** `soulData`'s own docblock scopes it to the
  three "soul" sizes, and it already carries a demonstrably-stale extraction claim — appending a
  second concern to it would compound both problems. `phaseVocabulary.ts` sits beside `soulData.ts` /
  `deriveTier.ts`, matching the existing one-file-per-concern split.
- **`Grounding` is a frozen 3-entry table (`GROUNDINGS`), not three inline object literals.**
  `groundingFor` always returns one of three exact references, mirroring how `deriveTier` returns
  `TIERS.*` references — a derived reference cannot drift from the derivation the way a re-built
  literal can.
- **`citation_policy` is read off the loose `PhaseConfigJSON` index signature and compared as a
  string.** No cast to `CitationPolicy`, no import from `deriveTier` — the values are compared, and
  everything unrecognised falls through to `open`. That is what makes the function total over a
  future enum value.
- **C-8 recorded in a comment rather than enforced:** `citation_policy` exists only on `llm_emit`
  configs, so a non-emit phase reaches `strict` only via a `citations_required` validator. That is
  intended (a gate is a property of the phase that carries it), so no phase-type guard was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The purity grep forbade the literal token the docblock wanted to use**

- **Found during:** Task 1 (first GREEN run — 26 passed / 1 failed)
- **Issue:** The plan required both (a) a docblock explaining that Phase 185 owns the authored
  grounding field and (b) an acceptance criterion of `grep -c "grounding_mode" … == 0`. Writing the
  field name in backticks in prose satisfied (a) and broke (b). This is a real signal, not a nuisance
  one: the guard exists so a future reader cannot find the string in the module and conclude the
  field is supported here.
- **Fix:** the two docblock mentions now read "a stored grounding-mode field" / "an authored
  grounding-mode field" — the concept survives, the searchable token does not.
- **Files modified:** `frontend/src/components/workflows/phaseVocabulary.ts`
- **Verification:** `grep -c grounding_mode` → `0`; suite 27/27 green at that point.
- **Committed in:** `92127b39` (Task 1 GREEN commit)

### Acceptance criteria executed with a stated adjustment

**1. `tsc -b exits 0` → executed as the plan-01 differential.** Both Task 1 and Task 2 name
`npx tsc -b` exiting 0. Per D-ITEM-183-01 that is unachievable at baseline (`develop` is red with 33
pre-existing signatures across ~20 unrelated files). Executed as the inherited differential: the
signature count is **still exactly 33** after all three tasks, and `grep -cE
"phaseVocabulary|skipParseCases"` over the full `tsc -b` output is **0** — this plan added no type
error. The Task-2-specific half of that criterion *is* absolutely verifiable and was verified:
`grep -c TS2732` over the output is **0**, proving the JSON-import error class the `resolveJsonModule`
change targets is genuinely gone. `npx vite build` remains a hard gate and **exits 0**.

**2. `grep -c "skipParseCases.json" backend/tests/…` returns 2, not 1.** The criterion's intent —
"and no Python literal case list exists in the file" — holds exactly: there is one code reference
(the `Path` join) and one prose reference (the docblock naming the shared table). No case data is
duplicated in Python. Removing the docblock mention to hit a literal `1` would have made the file
*less* navigable for no correctness gain.

**Total deviations:** 1 auto-fixed (Rule 3, inside this plan's own new file) + 2 acceptance criteria
executed with stated, evidenced adjustments. No scope creep; no file outside the plan's
`files_modified` list was touched.

## Issues Encountered

- **A guard and a docblock can genuinely conflict.** The `grounding_mode` collision is worth
  remembering for 183-04/05/06: any `?raw` prohibition grep also binds the module's own prose. Name
  forbidden concepts in hyphenated English, not in the forbidden token.
- **Nothing else.** No test flakiness, no toolchain surprise, no path arithmetic error — the pytest
  found the frontend fixture on the first run.

## Verification Results

| Gate | Result |
|---|---|
| `npx vitest run src/components/workflows/phaseVocabulary.test.ts` | **40 passed / 40** ✅ |
| `npx vitest run … -t "parity"` | **20 passed**, 20 skipped ✅ (≥ 12 required) |
| `venv/Scripts/python -m pytest tests/unit/test_183_skip_parse_parity.py -q` | **13 passed** ✅ (≥ 13 required) |
| Mutation check (corrupt the `a:b` row) | pytest **2 failed**, vitest **2 failed** → reverted, both green ✅ |
| `npx tsc -b` | 33 signatures — **identical to the plan-01 baseline, 0 new, 0 from our files** ⚠️ D-ITEM-183-01 |
| `grep -c TS2732` over `tsc -b` output | **0** ✅ (the `resolveJsonModule` fix is proven) |
| `npx vite build` | **exit 0** ✅ |
| `npx vitest run src/components/workflows` | **144 passed / 1 failed** — the known `soulData.test.ts` glyph RED only; baseline was 104/1, so **+40 passing, no new failing name, no count drop** ✅ |
| `git status --porcelain backend/app` | empty ✅ |
| `git status --porcelain …/PhaseSpineGraph.tsx` | empty ✅ (this plan adds; 183-04 subtracts) |
| `grep -c lastIndexOf \| "const PHASE_GLYPHS" \| grounding_mode \| @/lib/api` | `0 / 0 / 0 / 0` ✅ |
| `grep -cE "getBoundingClientRect\|offsetHeight\|offsetWidth\|document\.\|window\."` | **0** ✅ (no DOM read, no layout) |
| `git diff --numstat frontend/tsconfig.app.json` | `1 0` ✅ exactly one added line |
| shared table row count | **12** ✅ |

## Threat Model Compliance

- **T-183-01 (Tampering — authored `name`/`slug` through the title resolvers):** mitigated as
  planned. Both resolvers return plain strings; the module builds no markup and contains no
  `dangerouslySetInnerHTML`. Render-time escaping stays the consumer's job (183-06).
- **T-183-06 (DoS — malformed definition JSONB):** mitigated and *asserted*. Totality is covered by
  8 explicit never-throws / unknown-input assertions across `nodeTitle`, `technicalTitle`,
  `groundingFor` and `parseSkipTarget`.
- **T-183-07 (Tampering — client parse diverging from server adjacency):** mitigated by the shared
  table plus the two-language parity tests, and the mutation check proves the mitigation actually
  fires.
- **ASVS conclusion INTACT.** The single backend file added is a test
  (`backend/tests/unit/test_183_skip_parse_parity.py`); `git status --porcelain backend/app` is
  empty. The "this conclusion is VOID / `/gsd:secure-phase` applies" condition did **not** trigger.

## Known Stubs

None. Every export is fully implemented and exercised by a green assertion. The module has no
consumer yet **by design** — plan 183-04 performs the repoint, and the plan explicitly forbids doing
it here.

## User Setup Required

None — no dependency, no env var, no migration, no cloud parity owed.

## Next Phase Readiness

**Ready.** Hand-offs, explicitly:

- **183-04 (the hard cut)** — delete `PhaseSpineGraph.tsx`'s local `PHASE_GLYPHS`,
  `PHASE_TYPE_LABELS`, `ValidatorJSON` / `PhaseConfigJSON` / `PhaseSpecJSON`, `parseSkipTarget` and
  `nodeTitle`, and re-export or re-point them at this module. `PhaseFormPanel.tsx:39` imports
  `PhaseSpecJSON` **from `PhaseSpineGraph`**, so either keep a re-export there or update that import
  in the same commit. `PhaseSpineGraph.test.tsx:110-111` still asserts the OLD `lastIndexOf`
  semantics (`a:b` → `b`) and must be updated to `a:b` → `a:b`. Also update this module's docblock
  paragraph "STATE OF THE EXTRACTION" once the cut lands — leaving it stale would repeat the exact
  `soulData.ts` failure it calls out.
- **183-05 / 183-06** — import `nodeTitle`, `technicalTitle`, `groundingFor`, `waitsForYou`,
  `PHASE_TYPE_SUBTITLES` and `parseSkipTarget` from here. Do not re-derive any of them; the `?raw`
  purity block is the tripwire.
- **185 (graded governance)** — `groundingFor` is the seam to replace with the authored field. Its
  return type `Grounding` is already the shape a graded dial can widen.
- **All 183 plans** — `tsc -b` remains a differential against 33; `vite build` remains exit-0.

No blockers.

## Self-Check: PASSED

Files verified present on disk:

- FOUND: `frontend/src/components/workflows/phaseVocabulary.ts`
- FOUND: `frontend/src/components/workflows/phaseVocabulary.test.ts`
- FOUND: `frontend/src/components/workflows/__fixtures__/skipParseCases.json`
- FOUND: `backend/tests/unit/test_183_skip_parse_parity.py`
- FOUND: `frontend/tsconfig.app.json` (contains `"resolveJsonModule": true`)

Commits verified in `git log`:

- FOUND: `e578f478` — test(183-02): add failing spec for the shared phaseVocabulary module
- FOUND: `92127b39` — feat(183-02): add phaseVocabulary — the one shared phase-vocabulary module
- FOUND: `875e7601` — test(183-02): add the shared C-1 skip-parse case table and the TS parity block
- FOUND: `a2ee7c52` — test(183-02): add the Python half of the skip-parse parity control

---
*Phase: 183-read-only-canvas*
*Completed: 2026-07-25*
