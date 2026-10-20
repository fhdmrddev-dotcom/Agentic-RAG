---
phase: 281-a-refusal-names-its-cause
plan: 02
subsystem: workflow-authoring / describe door
tags: [describe-door, refusal, vocabulary, technical-names, seed-221, copy-fence, tdd]
requirements: [FIX-10]
dependency_graph:
  requires: []
  provides:
    - "describeRefusalVocabulary.ts: refusalKey / describeRefusal / REFUSAL_FOR_KEY / REFUSAL_FALLBACK / REQUEST_FAILED_KEY"
    - "server: additive reason_code (no_service_chosen | service_not_allowed | action_not_allowed) on the three connection_not_allowed returns"
    - "client wire: GenerateResult ok:false gains reason_code?: string | null"
  affects:
    - "281-04 (runs the merged-tree vitest count gate and owns the S-7 pytest run if it skipped here)"
    - "G-4 scenario C (D-19): describe-door refusal, technical names OFF/ON"
tech_stack:
  added: []
  patterns:
    - "one leaf vocabulary table beside doorVocabulary.ts; door word imported, never retyped"
    - "two-audience reveal: sentence always, code + server detail in mono only under showTechnical"
key_files:
  created:
    - frontend/src/components/workflows/describeRefusalVocabulary.ts
    - frontend/src/components/workflows/describeRefusalVocabulary.test.ts
  modified:
    - backend/app/services/workflow_authoring.py
    - backend/tests/unit/test_214_describe_vocabulary.py
    - backend/tests/integration/test_214_argument_seams.py
    - frontend/src/lib/api/knowledge.ts
    - frontend/src/components/workflows/useTemplateFirstDraft.ts
    - frontend/src/components/workflows/useTemplateFirstDraft.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
decisions:
  - "Server sub-reason key is `reason_code` (the api/connectors.py precedent); values are module constants CONNECTION_REFUSAL_* imported by tests"
  - "The page reduces the receipt line to 'Nothing was saved.' — the table's next step replaces 'Adjust your description and try again.' (D-11: one next step)"
  - "The technical line joins technical and technicalDetail with ' · ' in one mono span"
  - "S-7's evidence regex strips ANSI colour codes first — measured: with colour on, 'Tests N passed' never matched"
metrics:
  duration: "~75 min"
  completed: 2026-10-14
  tasks: 3
  files: 13
---

# Phase 281 Plan 02: The describe door says why, in words Summary

A describe-door refusal now reaches the author as one plain sentence and one next step from a single new table (`describeRefusalVocabulary.ts`). The server adds a `reason_code` field that tells the three `connection_not_allowed` situations apart without changing any existing field. The raw code and the slug-bearing server detail appear only under the existing technical-names reveal. S-7 is inverted, so it now fails if a code ever reaches the screen as the message.

## Base

- **Base actually seen at spawn:** `a248672f0f4d977133e781b01ac3d92bb6a9c591` (the `master` merge commit, NOT develop). `git merge-base HEAD 95c62fc83` returned `60ce3797c`, so the worktree was reset to the expected base.
- **PHASE_BASE:** `95c62fc83c61d3867a10a77bff177b5eb14e64d5` (develop, `docs(281): begin phase execution — STATE`), confirmed after the reset.
- **tsc base set:** `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-281/tsc_base_95c62fc83.txt`, 103 lines, all pre-existing errors in files this plan does not touch. Plans 03/04 diff against this file as a set.

## Commits

| Task | Gate | Commit | Message |
|---|---|---|---|
| 1 | RED | `dc7b34f7b` | test(281-02): failing pins for the describe refusal table + server reason_code |
| 1 | GREEN | `fa08ee6f1` | feat(281-02): one table turns every describe refusal code into a sentence and a next step |
| 2 | RED | `9f4458c81` | test(281-02): the describe refusal renders a sentence, not a code (RED) |
| 2 | GREEN | `57a668c06` | fix(281-02): the describe door shows the refusal in words, the code only on reveal |
| 3 | RED drive | `29d8e364b` | test(281-02): invert S-7 — the screen shows the sentence, never the code (RED drive) |

## RED evidence

- **Task 1 RED:** backend, 3 failed / 17 passed in `test_214_describe_vocabulary.py`: the three arm tests failed on the missing `reason_code` constants (`test_an_external_action_on_an_unpicked_connection_is_refused`, `test_a_picked_connection_with_an_UNGRANTED_tool_is_refused`, `test_an_empty_allowed_list_refuses_ANY_external_action`). Frontend: both `describeRefusalVocabulary.test.ts` and `WorkflowDoorSwitch.test.tsx` failed to resolve `./describeRefusalVocabulary`.
- **Task 1 GREEN:** backend 47 passed (`test_214_describe_vocabulary`, `test_2141_describe_declares_inputs`, `test_103_nl_generate`, `test_187_authoring_step_names`); vitest 157 passed over 3 files.
- **Task 2 RED:** 8 failed / 79 passed over `useTemplateFirstDraft.test.tsx` and `WorkflowBuilderPage.test.tsx`. That is 3 hook cases (the re-pinned thrown case and 2 new cases) plus 5 page cases (the re-pinned `could_not_generate` case and 4 new cases).
- **Task 2 GREEN:** 360 passed over the six-file Task 2 verify list.
- **Task 3:** the inverted S-7 passes as soon as it is written, because Task 2 already landed the implementation. The plan's RED gate for this task is therefore the planted-revert drive below. There is no separate `feat` commit for Task 3, because it changes no implementation.

## Planted drives (each restored sha256-identical)

- **Copy fence (Task 1):** I appended `export const PLANTED = "Services this workflow may use"` to `describeRefusalVocabulary.ts`. The `it.each` sweep then went RED (`./describeRefusalVocabulary.ts carries none of the 24 governed words` gave `expected [ 'SERVICES_LABEL/plain' ] to deeply equal []`). I restored the file from a temp copy; its sha256 before and after is `d821ad082228b7b2…` both times.
- **S-7 inversion (Task 3):** I edited a temp copy of `WorkflowBuilderPage.tsx` and called the test function directly. That path is DB-free: it only reads files and runs vitest.
  - Plant A, `{refusal.sentence}` replaced with `{errorMessage}`: the static half fails with "the builder prints the stored refusal key raw again — SEED-221's defect, back on screen".
  - Plant B, `{refusal.sentence}` replaced with `{refusal.technical}`: the static half passes, and the **run half** fails with "the refusal render suites did not pass". This proves the vitest leg can fire on its own.
  - After each plant the sha256 was `d06237f34d8368c6a3336d5cccb824e81248e3a3621f6890d41a082640326695`, identical to before. After restore the test PASSED.

## Probe arithmetic (WorkflowBuilderPage.tsx, PHASE_BASE -> HEAD)

| Probe | Base | Head |
|---|---|---|
| `grep -cE "useState[(<]"` | 21 | 21 |
| `grep -c "useEffect("` | 7 | 7 |
| `grep -c "fetch("` | 0 | 0 |
| `grep -c "Couldn't generate —"` | 1 | 0 |
| `grep -c "describeRefusal("` | 0 | 1 |
| `grep -c "dangerouslySetInnerHTML"` | 0 | 0 |

Hook: `grep -c "setErrorState(refusalKey("` gives 1, and `grep -c REQUEST_FAILED_KEY` gives 3. Server: `grep -c '"reason_code"'` gives 3, and zero lines were removed from `workflow_authoring.py`, so every `detail` is byte-identical. The new table: `wc -c` 8782 (at least 1000), `SERVICES_LABEL` appears 5 times, and the literal `Services this workflow may use` appears 0 times. `git diff 95c62fc83 -- doorVocabulary.ts builderStore.ts` is empty.

## Deliberate re-pins (each carries the "Phase 281 (D-11/D-12, SEED-221)" comment)

1. **`WorkflowBuilderPage.test.tsx`, the ok:false honest-error case:** the mock was the free text `"could not generate"`. It is now the real code `could_not_generate`, and the case asserts the table's sentence and the absence of the code.
2. **`WorkflowBuilderPage.preDraft.baseline.test.tsx`:**
   - `errorPayload.error` changes from free text to `could_not_generate`.
   - The `flagOff:error` / `flagOn:error` baselines were **re-captured from a run, twice, and the two runs were md5-identical.** A script checked that each new string's prefix up to `<div data-testid="generate-error"` is byte-equal to the old one, so only the error block moved (3312 to 3294 chars, and 3729 to 3711).
   - The three-arms test now expects the sentence and next step and NOT the code or detail. Its old lines (`toContain(errorPayload.error / .detail)`) asserted the defect.
   - `CAPTURE_SHA` is left as is: it records the original 193.1 capture.
3. **`WorkflowBuilderPage.canvas.test.tsx`, the "honest generate failure produces no receipt" case:** the mock is now the real code, and the case asserts the sentence and the absence of the code.
4. **`useTemplateFirstDraft.test.tsx`:** the two ok:false cases now use the real code, and the store holds `refusalKey(...)`. The thrown case now also asserts `errorMessage === REQUEST_FAILED_KEY`.
5. **`WorkflowDoorSwitch.test.tsx`:** the length of `SWEPT_SOURCES` goes from 6 to 7, with a dated comment and a docblock entry.

Count-gate rule: `git diff 95c62fc83 -- frontend/src` removes 0 `it(` / `test(` lines and adds 21. Per-file counts at HEAD:

| File | Tests |
|---|---|
| canvas | 154 |
| preDraft.baseline | 22 |
| WorkflowBuilderPage.test | 20 |
| describeRefusalVocabulary.test | 15 (new) |
| doorVocabulary.test | 60 |
| useTemplateFirstDraft.test | 67 |
| WorkflowDoorSwitch.test | 82 |

## tsc set diff

`npx tsc -p tsconfig.app.json --noEmit` at HEAD wrote `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-281/tsc_new_281-02.txt`, 103 lines. `comm -13 <(sort -u base) <(sort -u new)` is **empty**, so this plan adds no new typecheck error lines.

## S-7 pytest run

`pytest tests/integration/test_214_argument_seams.py -k S7 -q -rs` was run under the local-DB lock, which I took at 2026-10-14T19:05:33Z after 281-01's wave gate released it and gave back after the run. Result: **2 passed, 18 deselected**, with Postgres reachable, so neither case SKIPPED. Both S-7 cases passed: the backend half, which also sees 3 `reason_code` returns, and the inverted render case, which ran the vitest leg.

## Ledger gate

`node scripts/check-hot-file-ledger.cjs 281` reported `ledger gate OK`: 537 rows, 43 subject files, 17 watched. `workflow_authoring.py`, `WorkflowBuilderPage.tsx`, `useTemplateFirstDraft.ts` and `knowledge.ts` are honoured by construction:
- `workflow_authoring.py`: three constants and three additive keys.
- `WorkflowBuilderPage.tsx`: one import and one inline computation, with the probes unchanged.
- `useTemplateFirstDraft.ts`: one import and two call-site swaps.
- `knowledge.ts`: one optional field.

The new leaf adds no row of its own; 281-04 owns any ledger prose update.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] S-7's `Tests N passed` evidence regex could not match coloured vitest output**
- **Found during:** Task 3 (the planted-revert drive)
- **Issue:** when vitest prints with colour, the summary reads `Tests ESC[22m ESC[1mESC[32m35 passed`. The plan's required regex `Tests\s+\d+\s+passed` then fails even on a green run. S-1 avoids this only because it has a looser fallback.
- **Fix:** strip ANSI codes (`re.sub(r"\x1b\[[0-9;]*m", "", out)`) before the regex, with a comment recording the measurement.
- **Files modified:** backend/tests/integration/test_214_argument_seams.py
- **Commit:** `29d8e364b`

**2. [Strengthening] S-7 was driven with TWO plants, not one**
- The plan's single plant (`{refusal.sentence}` replaced with `{errorMessage}`) fails on the static assertion before the vitest leg runs, so it never proves that the RUN half can fire. Plant B, rendering the technical string where the sentence goes, passes every static check and is caught only by the run half.

**3. [Discretion] the hook's ok:false re-pin edited the existing free-text error to a real code.** The plan names those cases (~:426-474) as re-pins. A free-text `error` still passes through `refusalKey` unchanged, so leaving it would have pinned nothing new.

Nothing else: no file outside `files_modified` was edited, and STATE.md and ROADMAP.md are untouched.

## Known Stubs

None.

## Threat Flags

None. T-281-07, -09, -10 and -11 are mitigated as planned:
- **T-281-07:** the detail and the code render only under `showTechnical`, and vitest asserts they are absent when the reveal is off.
- **T-281-09:** everything renders as React text children.
- **T-281-10:** no next step names Settings or any door that does not exist.
- **T-281-11:** an unknown code keeps its raw key under the reveal, and a thrown server sentence renders as is.

## Self-Check: PASSED

- All 5 commits are present in `git log` (dc7b34f7b, fa08ee6f1, 9f4458c81, 57a668c06, 29d8e364b).
- Both new files exist.
- STATE.md and ROADMAP.md show no diff against 95c62fc83.
