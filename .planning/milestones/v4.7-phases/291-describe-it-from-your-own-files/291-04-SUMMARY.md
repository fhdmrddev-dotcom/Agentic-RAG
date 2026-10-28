---
phase: 291-describe-it-from-your-own-files
plan: 04
subsystem: workflow-authoring-frontend
tags: [frontend, describe-door, react, sketch-291-B, auth-02]
requires:
  - "291-01: POST /workflows/describe/read, POST /workflows/{id}/reference, template door .pdf + anchors"
  - "291-02: GenerateRequest.form / .references; ok-result removed / fields"
provides:
  - "lib/api: readDescribeFile, uploadWorkflowReference, uploadWorkflowTemplate(id, file, anchors?) + DescribeReadResult / DescribeField / ReferenceAssetDescriptor / WordAnchor wire types"
  - "lib/api/knowledge: GenerateWorkflowBody.form / .references; GenerateResult ok-arm removed? / fields? (GenerateRemoved, GenerateField)"
  - "useTemplateFirstDraft: DescribeReadState; useTemplateRead(file, role, seed) -> {state, untickedKeys, toggleBlank, answer}; useReferenceReads(initial) -> {references, addFiles, removeAt, notice, anyReading}"
  - "useTemplateFirstDraft: onReferencesBound + initialReferences args; onDrafted(def, readiness, extras) with extras {removed, fields} untouched"
  - "builderStore.addReferenceAssets (one action, no state field)"
  - "surfaceClasses.ts: ROW/NOTE/FOOTING/FILENAME (moved byte-identical) + FACT/FIELD_GRID/PLACES_LIST"
  - "templateFirstVocabulary: every UI-SPEC Surface 1+2 const/formatter incl. fieldTypeWord (plan 05's arrival fold imports it)"
  - "DescribeTemplateRow extended (form slot arms); DescribeReferencesSection (new); both mounted on both doors"
affects:
  - "291-05: the arrival card spends onDrafted's third parameter (extras.removed / extras.fields) and imports fieldTypeWord"
tech-stack:
  added: []
  patterns:
    - "one per-file read routine reused at five fixed slots (constant hook order; a removed file frees its slot, nothing shifts or re-reads)"
    - "read results travel to /generate, never re-read bytes (Pitfall 11); each spread gated on its own arm, [] never sent for absent"
    - "first-save bind picks the door per reading: template, Word fillable copy (ticked anchors), or reference"
key-files:
  created:
    - frontend/src/components/workflows/DescribeReferencesSection.tsx
    - frontend/src/components/workflows/DescribeReferencesSection.test.tsx
    - frontend/src/components/workflows/surfaceClasses.ts
    - .planning/phases/291-describe-it-from-your-own-files/deferred-items.md
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/lib/api/knowledge.ts
    - frontend/src/lib/api/workflows.ts
    - frontend/src/components/workflows/useTemplateFirstDraft.ts
    - frontend/src/components/workflows/useTemplateFirstDraft.test.tsx
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/components/workflows/builderStore.test.ts
    - frontend/src/components/workflows/templateFirstVocabulary.ts
    - frontend/src/components/workflows/templateFirstVocabulary.test.ts
    - frontend/src/components/workflows/DescribeTemplateRow.tsx
    - frontend/src/components/workflows/DescribeTemplateRow.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.describe.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx
    - backend/tests/unit/test_workflow_authoring_requirement.py
    - scripts/vitest-count-gate.cjs
decisions:
  - "A deck (not_word) still binds through the TEMPLATE door, not the reference door: the reference door refuses .pptx/.xlsx, and a deck template is filled at run time by the shipped engine"
  - "Word blanks with every blank unticked bind as a reference (nothing to fill) and the slot's footing then says reference-only, so the footing and the bind agree"
  - "An unreadable/unreachable slot keeps the shipped template upload, except a .pdf, which is kept as a reference (the template door can only fill a PDF that has fields)"
  - "template_placeholders survives as a real no-form branch only: a template read the server's form caps would refuse (over 200 fields, a key with { } % < >, text over 250k) still drafts to its keys the shipped way"
  - "The client refuses a reference over 10 MB before sending (T-291-33) with REFS_REFUSED_FALLBACK; the server's cap stays authoritative"
  - "refsOverflow takes names as rest params so the vocabulary table's every-function-uses-its-argument sweep can call it with a number"
  - "The builder's CTA gains the reference wait through the hook's canDraft (disabled={!canDraft} unchanged); both doors' references section gets the door-wide anyReading, per UI-SPEC 'footing while any file is reading'"
metrics:
  duration: "~2h45m"
  completed: 2026-10-22
  tasks: 3
  files: 23
---

# Phase 291 Plan 04: The describe door with files (sketch 291-describe-files B) Summary

Both describe doors now take one form or template and up to five references. Each file is read through `POST /workflows/describe/read` before drafting, and the door shows what it yielded in the server's own words: the PDF field grid with type words, the Word "Where each answer goes" list with a native tick per placed blank, and the couldn't-place / cut-short / scan / no-fields / copy-refused lines. The draft is written from the read results (`form` + `references` on `/generate`, never the bytes again). At the first autosave, the PDF form, the Word fillable copy (ticked anchors only) and every reference are stored with the draft.

## What was built

**Task 1: wiring (TDD; RED `d4a8717dc`, GREEN `eb340f966`)**

API client:
- `readDescribeFile(file, role, signal)` sends FormData with `file` and `role`, a Bearer header and no Content-Type. A network failure becomes `WorkflowTemplateUploadError("network", null)`; a refusal relays the server's `detail`.
- `uploadWorkflowReference(id, file)`.
- `uploadWorkflowTemplate(id, file, anchors?)` appends one `anchors` JSON part only when anchors are given. Without them the request has exactly the one `file` part, as before (tested).
- Wire types are added to both domain modules and to the barrel.

`useTemplateFirstDraft.ts`:
- `DescribeReadState` has four arms: idle, loading, `read{result}`, and `unavailable{reason, detail}`. A 422 maps to `unreadable` and keeps the server sentence; anything else maps to `unreachable` with detail `null`.
- One private per-file routine, `useDescribeRead`, keeps the File-identity, abort-on-replace, seed and frozen-idle/loading rules.
  - `useTemplateRead(file, role="form", seed)` wraps it and adds the blank ticks. Ticks live in the answer, so a new file starts with every blank ticked.
  - `useReferenceReads(initial)` calls the same routine at five fixed slots. It handles overflow, duplicates, 422 removal with the server sentence, a client 10 MB cap, and slot reuse without re-reads.
- `canDraft` and the auto-draft one-shot both wait for the slot and every reference. `onDraft` is a no-op while anything is reading.
- `onDraft` sends `form` (only the ticked placed fields for blanks) and `references` (read references only). It never sends `[]`. With no files the body is byte-identical to before (asserted as the exact JSON string).
- `onDrafted(def, readiness, {removed, fields})` passes the extras through by identity; an absent value stays absent.
- `bindHeldTemplate` picks the door for the slot's reading, then binds every reference. The reference descriptors go to `onReferencesBound` in one batch. A failure names its file and never throws.

`builderStore.ts`: one action, `addReferenceAssets`. It de-duplicates by `asset_id`, keeps the template entry, arms dirty, does nothing outside drafted or for an empty list, and is untracked.

**Task 2: words and components (TDD; RED `d3c8d7562`, GREEN `3c85e402a`)**
- `templateFirstVocabulary.ts` holds every UI-SPEC Surface 1+2 constant and formatter, verbatim.
  - `fieldTypeWord` maps text, number, date and file to themselves. An enum whose options are exactly yes/no (case-insensitive) reads `yes / no`; any other enum reads `choice of n`.
  - A vitest sweep with positive controls checks every constant and every formatter output for banned words, machine codes and any claim that steps read references at run time.
- `surfaceClasses.ts` (a `.ts` file, because of the `react-refresh` lint rule) received the four shipped row constants byte-identical. It also adds the named FACT, FIELD_GRID and PLACES_LIST classes, so no new markup types an off-grid literal.
- `DescribeTemplateRow.tsx` was extended in place:
  - New arms: form (exact), suggested (text or scan, with the cut-short sentence), blanks (native checkboxes, a real-DOM `· stays blank`, couldn't-place rows from the server with no checkbox), none (D-02), not_word for decks only, scan unreadable, copy refused, and PDF unavailable.
  - It keeps one `role="status"` region and exactly one footing. Counts come from the rendered rows: for blanks, the ticked placed rows. The PDF grid shows 8 fields, then a `Show all n` button with `aria-expanded`.
- `DescribeReferencesSection.tsx` is new and presentational, with no fetch.
  - It uses ROW_CLASSES exactly and puts one `role="status"` around the list.
  - Each row shows 📎, the filename, a `Remove file` button whose aria-label names the file, and a reading line (muted for an explanation, foreground for a fact).
  - At 5 of 5 the input is disabled and `aria-describedby` points at `REFS_FULL`.
  - It also renders the notice line, the reading footing, and the powers/keep lines (only while a file is held).

**Task 3: mounts and gates (`3a92fcf69`, gate adoption `c2a088e4f`)**
- Fast door (`WorkflowDoorSwitch.tsx`):
  - `useReferenceReads()` runs beside the slot read, and the ticks go to the row.
  - The rule and the section sit directly after the template row, then the existing rule and the starter shelf.
  - `canDraft` gains `!referenceReads.anyReading`.
  - Read references and the slot's unticks cross the handoff as seeds, through one conditional spread.
- Govern door (`WorkflowBuilderPage.tsx`):
  - New `initialReferences` prop.
  - `onReferencesBound` calls `addReferenceAssets` and then `saveNow`, reached through an arrow like `onTemplateBound`.
  - The rule and the section follow the row, outside the pinned CTA group and outside the canvas flag. The `onDrafted` handler is untouched (plan 05 names the third parameter).

## Verification

- Targeted suites (the plan's three verify lists plus the touched page/door suites and `TemplateAttachSection`): 13 files, **866 passed, 0 failed**.
- **tsc error-file SET** (`npx tsc -p tsconfig.app.json --noEmit`): HEAD has 28 files and 63 errors; base `73107e648` (throwaway worktree, torn down with `teardown-worktree.sh`, source venv/node_modules intact) also has 28 files and 63 errors. The sets are **identical** (`diff` empty). The three in-scope files on the list (`WorkflowDoorSwitch.tsx` renderPublish typing, `lib/api.ts` IndexSummary/FolderIndexRow, `lib/api.test.ts`) carry the same errors at base, shifted by the inserted lines. Both lists:
  `src/__tests__/hooks/useFolders.test.ts, src/__tests__/hooks/useMessages.test.ts, src/__tests__/providers/streamsProvider_state01b_403.test.tsx, src/components/chat/__tests__/ChatAreaMode.test.tsx, src/components/chat/__tests__/MessageInput.connectors.test.tsx, src/components/chat/MessageSkeleton.tsx, src/components/experts/ExpertAuthoringStudio.tsx, src/components/layout/__tests__/ChatLayoutLaunch.test.tsx, src/components/layout/NavPanel.test.tsx, src/components/library/__tests__/IngestionTab.test.tsx, src/components/library/__tests__/ViewCardGrid.test.tsx, src/components/library/indexing/FoldersIndexTable.tsx, src/components/org/OrgExpertsTab.tsx, src/components/panel/__tests__/FilesSection.test.tsx, src/components/panel/FilePreview.test.tsx, src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx, src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx, src/components/settings/ConnectionFormPanel.tsx, src/components/settings/MemorySection.tsx, src/components/skills/SkillFormDialog.tsx, src/components/workflows/WorkflowDoorSwitch.tsx, src/lib/api.test.ts, src/lib/api.ts, src/pages/LibraryPage.tsx, src/pages/SettingsPage.test.tsx, src/pages/SettingsPage.tsx, src/providers/OrgProvider.test.tsx, src/stores/streamsStore.ts`.
- **Vitest count gate**, run from the repo root at `GSD_VITEST_MAX_WORKERS=2` this session: `count gate OK — 493/493 pinned files present, no per-file decrease, 0 failing.` (total 11604). After adopting `DescribeReferencesSection.test.tsx` (21), the same persisted report re-gated with `--json`: `count gate OK — 494/494 pinned files present, no per-file decrease, 0 failing.`
  Per-file, as pinned → actual:

  | Suite | Pinned | Actual |
  |---|---|---|
  | `DescribeTemplateRow.test.tsx` | 42 | 154 |
  | `templateFirstVocabulary.test.ts` | 21 | 69 |
  | `useTemplateFirstDraft.test.tsx` | 58 | 106 |
  | `builderStore.test.ts` | 77 | 84 |
  | `WorkflowDoorSwitch.test.tsx` | 44 | 82 |
  | `WorkflowDoorSwitch.baseline.test.tsx` | 17 | 19 |
  | `WorkflowBuilderPage.describe.test.tsx` | 30 | 30 |
  | `WorkflowBuilderPage.preDraft.baseline.test.tsx` | 22 | 22 |
  | `WorkflowBuilderPage.canvas.test.tsx` | 154 | 154 |
  | `WorkflowBuilderPage.seam286.pin.test.tsx` | 11 | 11 |

  The seam286 pin is green and unchanged. Vitest rewrote its `.snap` with LF endings only (no content diff), and that was restored rather than committed.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/291-describe-it-from-your-own-files` exits 0 (`ledger gate OK`).
- Backend: `test_workflow_authoring_requirement.py` passes (47) after deleting the two allowlist entries.
- Acceptance greps all hold:
  - `<DescribeReferencesSection` appears 1× in each door; `<DraftArrivalCard` still appears 1× in the builder.
  - `dangerouslySetInnerHTML` and `role="alert"` each appear 0×.
  - `template_placeholders` appears 1× in the hook, in the no-form branch.
  - `injection` appears 2× in the vocabulary test.
  - The diff of `useTemplatePlaceholders.ts` and `useDraftPersistence.ts` against base is empty.
  - `builderStore.ts` gains one action and no state field.

## TDD Gate Compliance

- Task 1: `test(291-04)` `d4a8717dc` failed 64 of 190, then `feat(291-04)` `eb340f966`.
- Task 2: `test(291-04)` `d3c8d7562` failed 159 of 215 (the new section suite failed to import), then `feat(291-04)` `3c85e402a`.
- Three tests in the Task 1 RED commit called `renderHook(() => useTemplateRead(fileNamed(…)))`, which creates a new File on every render and so re-reads forever. They were corrected in the GREEN commit to hoist the file. The claim each test makes is unchanged.
- The four reference-notice formatters landed in Task 1's GREEN commit, because the hook needs them. Their Task 2 vocabulary cases therefore already passed at Task 2 RED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A deck would have been bound through a door that refuses decks**
- **Found during:** Task 1
- **Issue:** the plan's bind list sends `not_word` through the reference upload. The reference door's allowlist is `.pdf .docx .txt .md` (291-01), so every `.pptx`/`.xlsx` template would have failed to bind. The shipped behaviour bound it as a template.
- **Fix:** `not_word` keeps the template door. A test pins it.
- **Commit:** eb340f966

**2. [Rule 3 - Blocking] `template_placeholders` needed a real branch**
- **Found during:** Task 1
- **Issue:** once `form` is always sent on a read, `template_placeholders` would be dead code. The backend fence `test_every_accepted_request_field_is_either_sent_or_allowlisted_with_a_reason` strips comments, so that field would then red as "accepted but never sent".
- **Fix:** the no-form branch is real. A template read that the server's `form` caps would refuse (more than 200 fields, a key containing `{ } % < >`, or text over 250k) still sends its keys the shipped way. A test with 201 fields pins it.
- **Commit:** eb340f966

**3. [Rule 3 - Blocking] 291-02's handoff: allowlist entries deleted**
- **Issue:** `form` and `references` were in `ACCEPTED_BUT_NEVER_SENT`. That file is outside `files_modified`.
- **Fix:** both entries were deleted in the commit that wires the send, with a dated note. The test passes.
- **Files:** backend/tests/unit/test_workflow_authoring_requirement.py
- **Commit:** eb340f966

**4. [Rule 3 - Blocking] Barrel exports and mock factories**
- **Issue:** the hook imports from `@/lib/api`, so the barrel (`frontend/src/lib/api.ts`, not in `files_modified`) needed the new runtime and type exports. Two whole-module mock factories (`WorkflowDoorSwitch.test.tsx`, `WorkflowBuilderPage.describe.test.tsx`) then threw "No readDescribeFile export".
- **Fix:** the exports were added. Both factories now point `readDescribeFile` at the existing spy and declare `uploadWorkflowReference`. Their cases were re-pointed to the new answer shape and to `form` on the wire, with `template_placeholders` asserted absent. No case was deleted.
- **Commits:** eb340f966, 3a92fcf69

**5. [Rule 3 - Blocking] Declared re-captures and pins whose subject moved, all with written reasons in the test files**
- **Re-captures:**
  - `WorkflowDoorSwitch.baseline.test.tsx`: the 8th re-capture. The two CHOOSER rows are byte-identical. The four moved rows each grew by exactly +1378, with zero `delete` opcodes. Every `replace` is a `useId` character or a word of the slot's label, types note or filter.
  - `WorkflowBuilderPage.preDraft.baseline.test.tsx`: six rows, +1378 each. The arm markers were checked before writing.
  - Both were captured from the comparison render itself and agreed byte for byte across two runs. A first probe that rendered twice per test shifted every later `useId` and was discarded.
- **Other pins whose subject moved:**
  - The door's resting inventory gains one control (`describe-reference-input`), and two atoms now read as the door's own label and types note.
  - The "second gating term" source check now names the door's own in-flight pair, plus the reference term.
  - The `onDrafted` signature fence now pins all three parameters.
  - The hook's arity assertions changed from 2 to 3.
  - The canvas suite's 900-character adjacency fence fired on a comment I added. I moved the comment below the raise rather than widening the window.

**6. [Plan wording] Five more files outside `files_modified`**
- `scripts/vitest-count-gate.cjs`: the adoption the plan itself instructs.
- The four suites above (`WorkflowDoorSwitch.test.tsx`, `WorkflowDoorSwitch.baseline.test.tsx`, `WorkflowBuilderPage.describe.test.tsx`, `WorkflowBuilderPage.preDraft.baseline.test.tsx`), which reddened on the mounts and the copy.

## Deferred Issues

- `backend/tests/integration/test_214_argument_seams.py::test_S7_…` is RED and is inherited from 291-02: it expects 3 `"reason_code":` and finds 4. It is RED at base `73107e648`, it is outside the unit gate, and 291-04 changed no backend source. It is logged in `deferred-items.md`.

## Known Stubs

None. Every arm renders a real read result, and every reference is bound.

## Threat Flags

None beyond the plan's threat model:
- T-291-30: React text only. Grep-gated 0 `dangerouslySetInnerHTML` and 0 `role="alert"`. XSS cases cover filenames, labels and Word lines.
- T-291-31 and T-291-34: the banned-word and run-time-claim sweep.
- T-291-32: binds happen only after the row exists, through the single host writer.
- T-291-33: a client limit of 5 references and 10 MB.

## Notes for the orchestrator

- **Line counts:** `useTemplateFirstDraft.ts` is +537 / −118. `WorkflowBuilderPage.tsx` (FIRING) is +37: one prop, one hook-argument pair, one mount. `WorkflowDoorSwitch.tsx` (FIRING) is +33 / −4: one hook, one mount, one handoff spread.
- **Stale hot-file triples:** the ledger triples for these files and the new `surfaceClasses.ts` / `DescribeReferencesSection.tsx` were not re-derived here; that is the phase-close ledger pass.
- **G-4 UAT is owed.** UI-SPEC's 375px capture of the door with 1 form and 2 references has not been driven in Chrome; that is phase verification.
- `graphify update .` was not run inside the worktree.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | d4a8717dc | test(291-04): failing describe-door wiring tests |
| 1 GREEN | eb340f966 | feat(291-04): describe door reads files and forwards them |
| 2 RED | d3c8d7562 | test(291-04): failing door component tests |
| 2 GREEN | 3c85e402a | feat(291-04): form slot arms and references section |
| 3 | 3a92fcf69 | feat(291-04): mount the references section on both doors |
| gate | c2a088e4f | test(291-04): adopt DescribeReferencesSection suite in the count gate |

## Self-Check: PASSED

- The four created files are present: `DescribeReferencesSection.tsx`, `DescribeReferencesSection.test.tsx`, `surfaceClasses.ts` and `deferred-items.md`.
- All six commits in the table are in `git log`.
- The targeted suites pass (866/866). The tsc error-file set at HEAD is identical to base. The count gate reads OK with 0 failing, and the ledger gate exits 0.
