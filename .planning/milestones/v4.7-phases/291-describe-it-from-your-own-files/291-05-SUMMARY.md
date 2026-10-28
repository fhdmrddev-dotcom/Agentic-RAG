---
phase: 291-describe-it-from-your-own-files
plan: 05
subsystem: workflow-authoring-frontend
tags: [frontend, arrival-card, launch-form, close-out, sketch-291-A, auth-02]
requires:
  - "291-02: generate ok-arm removed[{lead, reason}] / fields[]; InputFieldSpec.origin / .note; could_not_generate:grounding_unavailable refusal"
  - "291-04: onDrafted(def, readiness, extras) with extras passed through; fieldTypeWord; surfaceClasses.ts; builderStore.addReferenceAssets"
provides:
  - "DraftArrivalCard: optional removed (one server-worded line per removal) and inputsFold props, one fold boolean"
  - "DraftInputsFold.tsx: DraftInputsFoldTrigger + DraftInputsFoldBody (rows in form order, native radio Ask the person / Look it up, Added by Syrel from origin only)"
  - "surfaceClasses.ts: FOLD_GLYPH / FOLD_LINE_CLASS / FOLD_ACTION_CLASS (moved byte-identical) + FOLD_BODY_CLASS"
  - "builderStore.setInputSource(key, source) — one action, no state field"
  - "soulData: launchInputFields skips kb_auto; entryInputFields carries source and appends inputOptionsHint to enum labels"
  - "TemplateAttachSection: FORM_FIELDS_HEADING for a bound .pdf; DecisionsList referenceNames sub-line (templateRowReferencesLine)"
  - "describeRefusalVocabulary: could_not_generate:grounding_unavailable words"
  - "SEED-369 planted; SEED-133 / SEED-157 shipped; SEED-051 partially-answered; spike todo completed"
affects:
  - "verify-work 291: G-4 S1-S7 rows in 291-VALIDATION.md; the todo re-opens if 291 fails verification"
tech-stack:
  added: []
  patterns:
    - "a callback's extra parameter is NAMED and spent in the same batch, pinned by a source fence (197-09)"
    - "a body id derived from an existing useId so a card without the new fold draws its old ids"
    - "a controlled switch driven by LIVE store inputs over a SNAPSHOT field list"
key-files:
  created:
    - frontend/src/components/workflows/DraftInputsFold.tsx
    - frontend/src/components/workflows/DraftInputsFold.test.tsx
    - .planning/seeds/SEED-369-steps-read-reference-files-at-run-time.md
    - .planning/todos/completed/spike-nl-workflow-authoring.md (moved from pending)
  modified:
    - frontend/src/components/workflows/surfaceClasses.ts
    - frontend/src/components/workflows/DraftArrivalCard.tsx
    - frontend/src/components/workflows/DraftArrivalCard.test.tsx
    - frontend/src/components/workflows/declaredInputsVocabulary.ts
    - frontend/src/components/workflows/decisionsVocabulary.ts
    - frontend/src/components/workflows/decisionsVocabulary.test.ts
    - frontend/src/components/workflows/DecisionsList.tsx
    - frontend/src/components/workflows/DecisionsList.test.tsx
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/workflows/soulData.test.ts
    - frontend/src/components/workflows/TemplateAttachSection.tsx
    - frontend/src/components/workflows/TemplateAttachSection.test.tsx
    - frontend/src/components/workflows/describeRefusalVocabulary.ts
    - frontend/src/components/workflows/describeRefusalVocabulary.test.ts
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/components/workflows/builderStore.test.ts
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/seeds/SEED-051-generalized-nl-workflow-authoring.md
    - .planning/seeds/SEED-157-template-first-authoring-ai-drafts-blind.md
    - .planning/seeds/SEED-133-nl-generation-ignores-grounding-degradation.md
    - .planning/phases/291-describe-it-from-your-own-files/deferred-items.md
decisions:
  - "The removed-line prop is typed structurally ({lead, reason}) in DraftArrivalCard because the card's fence 3 forbids the API module in any form, type imports included"
  - "The inputs fold's body id is derived from the card's existing heading useId, not a new useId, so a card without the fold draws exactly its old ids"
  - "DraftInputsFoldProps carries a bodyId the card owns (the trigger's aria-controls and the body's id must agree across two components)"
  - "setInputSource treats an unchanged source as a no-op, so clicking the selected segment never arms a save"
  - "DeclaredInputsEditor measured NOT to drop file-derived members (it casts and spreads, never narrows), so no reported bug was filed"
  - "could_not_generate:removed_powers_broke_draft (291-02) still reads the generic refusal; recorded in deferred-items.md, not fixed (outside the plan, and Task 3 may not edit source)"
metrics:
  duration: "~1h45m"
  completed: 2026-10-23
  tasks: 3
  files: 29
---

# Phase 291 Plan 05: The draft arrives honest about what the files did Summary

When the server's guard removed something a file asked for, the arrival card now says so on its face in the server's words (sketch 291-draft-removed winner A): one `⊘ Removed: …` line per removal under the step-count heading, with no colour. When the draft was built to a form's fields, a new inputs fold leads the card's footer strip. It lists every field in the form's order with its type word and an Ask the person / Look it up switch, and a flip writes the live definition through the autosave. The launch form never asks for a Look-it-up input, and a fixed-choice input says which answers it takes ("Country (one of: US, CA, MX)", "Agree (yes or no)"). After a reload, a bound PDF's fields read under "What this form asks for", and the decisions template row names the references with the sentence that steps don't read them when the workflow runs. The degraded-registry refusal reads as words. The phase's registers are closed out.

## What was built

**Task 1: the arrival card (TDD; RED `3f99dfed3`, GREEN `d8b64cb1e`)**
- `surfaceClasses.ts` received `FOLD_GLYPH`, `FOLD_LINE_CLASS` and `FOLD_ACTION_CLASS`, moved byte-identical out of `DraftArrivalCard.tsx`, plus `FOLD_BODY_CLASS`: the shipped fold-body literal, extracted unchanged. Both existing card fold bodies now use it.
- `DraftArrivalCard.tsx` (FIRING) gained exactly what the ledger allows:
  - an optional `removed` prop and an optional `inputsFold` prop;
  - one fold boolean, `inputsOpen`.
  - The inputs body id is derived from the heading's existing `useId` (`${headingId}-inputs`), so a card without the fold draws exactly the ids it drew before.
  - Removed lines render only when `removed` has entries. With it absent or `[]`, the card's normalised `innerHTML` equals today's (tested).
- `DraftInputsFold.tsx` (new) exports only two components, `DraftInputsFoldTrigger` and `DraftInputsFoldBody`. Its rows:
  - follow the server's field order and use `fieldTypeWord` (291-04's formatter, reused);
  - each asked field gets a native `role="radiogroup"` with two `sr-only` radios inside label segments; a step-covered field reads "Written by a step" instead;
  - "Added by Syrel, not the AI…" appears only when `origin === "server_added"`;
  - explained extra inputs follow the fields, with `inputExtraNote(filename, note)` in place of the type word.
- The UI-SPEC 3b words are in `declaredInputsVocabulary.ts`, verbatim. `REMOVED_GLYPH` is in `decisionsVocabulary.ts`.

**Task 2: wiring, launch, reload (TDD; RED `848323148`, GREEN `616f28eaf`)**
- `WorkflowBuilderPage.tsx` (FIRING):
  - `onDrafted: (def, verdict, extras) => {…; setArrivalExtras(extras)}`: ONE new snapshot `useState`, written in the same batch as `setShowReceipt`.
  - `arrivalInputsFold` is a memo over the snapshot's `fields`, the LIVE `meta.inputs`, the held form's filename and `store.setInputSource`.
  - The single `DraftArrivalCard` mount gains `removed` and `inputsFold`.
  - `referenceNames` comes from `meta.assets[kind=reference]` and is passed to the decisions list.
  - A canvas source fence reds if the third parameter is deleted.
- `builderStore.ts`: one action, `setInputSource(key, source)`, and no state field. It spreads each entry and changes only `source`. An unknown key, an unchanged source and a non-array `inputs` are all no-ops. Untracked; it arms `dirty`.
- `soulData.ts`:
  - `DefShape.inputs` is widened (`source`, `type`, `enum_options`).
  - `entryInputFields` carries `source` only when present, and appends `inputOptionsHint` to an enum label; a label-less input uses its key.
  - `launchInputFields` gains `.filter((f) => f.source !== "kb_auto")`, so `missingRequiredFields` never blocks on a Look-it-up input at either launch door.
  - `LaunchInputFields.tsx` has an empty diff.
- `TemplateAttachSection.tsx`: one heading conditional (`FORM_FIELDS_HEADING` for a bound `.pdf`, case-insensitive).
- `DecisionsList.tsx`: one optional `referenceNames` prop. It renders `templateRowReferencesLine(names)` in the template row's existing secondary slot (`decision-template-references`).
- `describeRefusalVocabulary.ts`: `could_not_generate:grounding_unavailable` now reads "We couldn't read your folders, skills or tools just now, so the draft wasn't written." / "Try again in a moment." The code shows only under the reveal.

**Task 3: close-out (mechanical; `a404aa385`, `df3b1da51`, `659802b8a`, `8c45e010d`)**
- Seeds, frontmatter plus one dated note line each:
  - SEED-133 `shipped`;
  - SEED-157 `shipped`;
  - SEED-051 `partially-answered`, `partial: true`.
- `spike-nl-workflow-authoring.md` moved `pending/` → `completed/`, with its `status: completed` and the closing line. **verify-work re-opens it (moves it back to `pending/`) if 291 fails verification.**
- SEED-369 planted: steps read reference files at run time (D-32).
  - The id was allocated as max(existing SEED-NNN)+1; the prior max was SEED-368.
  - `trigger_paths` are `harness/phase_types.py` and `decisionsVocabulary.ts`.
  - The body notes that the powers set must be re-checked when run-time reading lands (A1 / D-34).
- `DraftInputsFold.test.tsx` was adopted in the count gate at 26.
- Ledger:
  - 30 scan-list rows re-derived from git with the CLAUDE.md recipe, six-digit buckets subtracted. Each has a dated "Phase 291" section in `docs/HOT-FILE-LEDGER.md` that keeps the replaced cells verbatim.
  - 15 CLAUDE.md FIRING rows updated, all cells ≤ 80 chars.
  - FIRING rows ADDED for `backend/app/api/workflow_wire.py` (3/3/517) and `DecisionsList.tsx` (5/3/429), because both crossed 3 phases at 291.

## Verification (every figure re-derived in this run)

- **Vitest count gate**, repo root, `GSD_VITEST_MAX_WORKERS=2`, full run: `count gate OK — 494/494 pinned files present, no per-file decrease, 0 failing.` (total 11674, failed 0). After adopting `DraftInputsFold.test.tsx` (26), the same persisted report (`C:\Users\fhdmr\AppData\Local\Temp\vitest-count-gate-71884-1792701353287.json`) was re-gated with `--json`: `count gate OK — 495/495 pinned files present, no per-file decrease, 0 failing.`

  Per-file deltas for every suite this plan touched (pinned → actual):

  | Suite | Pinned | Actual |
  |---|---|---|
  | `DraftArrivalCard.test.tsx` | 61 | 73 |
  | `DraftInputsFold.test.tsx` | — (new) | 26 |
  | `decisionsVocabulary.test.ts` | 24 | 28 |
  | `DecisionsList.test.tsx` | 54 | 76 |
  | `soulData.test.ts` | 58 | 68 |
  | `TemplateAttachSection.test.tsx` | 43 | 46 |
  | `builderStore.test.ts` | 77 | 89 |
  | `WorkflowBuilderPage.canvas.test.tsx` | 154 | 158 |
  | `describeRefusalVocabulary.test.ts` | — (unpinned since 281) | 22 |

  Neighbouring suites that read the changed modules: `RunModal.test.tsx` 55→56, `RunModal.a11y.test.tsx` 20→24, `LaunchInputFields.test.tsx` 20→20, `soulData.requiredFields.test.ts` 7→7, `declaredInputs.test.ts` 25→25, `DeclaredInputsEditor.test.tsx` 16→16, `WorkflowBuilderPage.draftSettings.test.tsx` 6→6, `WorkflowBuilderPage.seam286.pin.test.tsx` 11→11, `DescribeReferencesSection.test.tsx` 21→21.
- **Snapshots:** none were re-captured. Vitest rewrote five `.snap` files with LF line endings and no content change (`git diff --ignore-cr-at-eol` is empty). Each was restored by path and not committed.
- **Targeted suites per task:**
  - Task 1: 3 files, 125/125.
  - Task 2: 9 files, 586/586.
  - The broader dependents sweep (`src/components/workflows`, `src/pages`, panel and others): 185 files, 7449 passed, 3 failed. All 3 failures were in `WorkflowsPage.test.tsx` (the 200-row search, the pending re-query marker, the is_mine cross-check). That file and the modules it renders are byte-unchanged in this plan except `soulData.ts`. Re-run alone: 59/59. It also read 59/59 inside the full count gate's run. Recorded as load-sensitive, not as proven innocent.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit` in `frontend/`): 63 errors in 28 files at HEAD.
  - The error-file SET is identical (`diff` empty) to 291-04's recorded set.
  - The frontend tree at that recording is byte-identical to base `2712f4b69`: `git diff --stat c2a088e4f 2712f4b69 -- frontend/` is empty. So it is the base set.
  - The one file in this plan's area, `WorkflowDoorSwitch.tsx` (`renderPublish` typing), carries the same pre-existing error. Both lists: `src/__tests__/hooks/useFolders.test.ts, src/__tests__/hooks/useMessages.test.ts, src/__tests__/providers/streamsProvider_state01b_403.test.tsx, src/components/chat/__tests__/ChatAreaMode.test.tsx, src/components/chat/__tests__/MessageInput.connectors.test.tsx, src/components/chat/MessageSkeleton.tsx, src/components/experts/ExpertAuthoringStudio.tsx, src/components/layout/__tests__/ChatLayoutLaunch.test.tsx, src/components/layout/NavPanel.test.tsx, src/components/library/__tests__/IngestionTab.test.tsx, src/components/library/__tests__/ViewCardGrid.test.tsx, src/components/library/indexing/FoldersIndexTable.tsx, src/components/org/OrgExpertsTab.tsx, src/components/panel/__tests__/FilesSection.test.tsx, src/components/panel/FilePreview.test.tsx, src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx, src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx, src/components/settings/ConnectionFormPanel.tsx, src/components/settings/MemorySection.tsx, src/components/skills/SkillFormDialog.tsx, src/components/workflows/WorkflowDoorSwitch.tsx, src/lib/api.test.ts, src/lib/api.ts, src/pages/LibraryPage.tsx, src/pages/SettingsPage.test.tsx, src/pages/SettingsPage.tsx, src/providers/OrgProvider.test.tsx, src/stores/streamsStore.ts`.
- **ESLint** over every touched source file: clean. The one error reported on `WorkflowBuilderPage.tsx:312` (`useCanvasGate` export, react-refresh) is pre-existing at base `:311`.
- **Backend unit gate**: `70 failed, 8897 passed, 1 skipped, 2 xfailed, 2 xpassed, 45 warnings in 518.16s`, with 0 collection errors. That is ≤ the 71 ceiling. `git diff --stat 2712f4b69 HEAD -- backend/` is empty, so every failure is inherited by construction.
- **Recount suites**: `test_259_closed_core_inventory.py` + `test_255_extension_contract_guard.py` = 13 passed (the 7 / 1 / 30 and 17 inventories hold). Both files are byte-unchanged since base.
- **Extension contract**: `extension contract gate OK — all 17 files conform to closed-core contract (0 violations).`
- **Size gate**: `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` (CLAUDE.md 97,990 chars).
- **Ledger gate**: `ledger gate OK — every watched file has a row.`
- **Seeds register**, verbatim:
  - `seeds register gate OK — 376/376 parsed, 0 duplicate ids, 376/376 carry all 5 required keys.`
  - Unswept, both figures and never summed: `130 carry no trigger_when at all · 113 carry prose but no structured trigger`.
- `--phase 291` fires 16 seeds: SEED-177, 185, 188, 198, 284, 291, 295, 300, 305, 339, 340, 347, 350, 359, 368 and 369. Most fire through broad globs (`frontend/src/components/**`, `frontend/src/pages/**`). Routing them is a discuss-phase action, not close-out bookkeeping, so none were re-routed here. SEED-368's own trigger is "Phase 291 verifies"; it was read only.
- **Acceptance greps**, all holding:
  - `<DraftArrivalCard` appears 1×.
  - `onDrafted: (def, verdict, extras)` is 1 line.
  - `dangerouslySetInnerHTML` appears 0× in the leaf and 0× in the card.
  - The leaf has no `export const` and no lowercase `export function`.
  - `py-5 pl-8` appears 0× in the card outside comments.
  - `innerHTML` appears 3× in the card test.
  - `kb_auto` appears 2× in `soulData.ts`.
  - `builderStore.ts` adds one action and no state field.
  - `LaunchInputFields.tsx` diff is empty.

## TDD Gate Compliance

- **Task 1:** `test(291-05)` `3f99dfed3` was RED with 15 failing (the DraftInputsFold suite failed to import, so all of its cases were red). It was followed by `feat(291-05)` `d8b64cb1e`, at 125/125.
- **Task 2:** `test(291-05)` `848323148` was RED with 24 failing across 7 files. It was followed by `feat(291-05)` `616f28eaf`, at 586/586.
- **Coverage-only addition at GREEN:** two sweep entries (`inputOptionsHint`, `templateRowReferencesLine`) were added to the DraftInputsFold banned-word sweep in Task 2's GREEN commit, because those formatters only exist from that commit. No asserted behaviour changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The card's own fences had to be re-pointed for the plan's move and the removed lines**
- **Found during:** Task 1
- **Issue:**
  - `FOLD_GLYPH_ATOM` read the glyph out of the card's source by regex. Moving it to `surfaceClasses.ts`, as the plan instructs, would have made that regex match nothing.
  - Fence 4 pinned the card's only `.map(` to `appliedPairs`, and the removed lines are a second map over the card's own prop.
- **Fix:**
  - The atom is now imported from `surfaceClasses`. Its case asserts that the card imports all four names and re-declares none.
  - Fence 4 names `removed` explicitly, so a third mapped expression is still red.
  - Both changes carry their reasons in the test file and landed in the RED commit.
- **Commit:** 3f99dfed3

**2. [Rule 3 - Blocking] The removed-line prop type is structural, not `GenerateRemoved`**
- **Found during:** Task 1
- **Issue:** the card's fence 3 forbids `@/lib/api` in any form, type imports included.
- **Fix:** `removed?: readonly { lead: string; reason: string }[]`, the same shape as `GenerateRemoved`.
- **Commit:** d8b64cb1e

**3. [Plan wording] `DraftInputsFoldProps` carries `bodyId`**
- **Reason:** the trigger's `aria-controls` and the body's `id` must agree across two separate components, and the card owns that id. The card's prop is `Omit<DraftInputsFoldProps, "open" | "onToggle" | "bodyId">`.

**4. [Measured, no change] DeclaredInputsEditor does not drop file-derived members**
- **What the plan asked:** measure whether it does, and file a reported bug only if it does.
- **Measurement:**
  - `DeclaredInputsEditor.tsx:87-90` reads `meta.inputs` with a type cast, never a narrowing.
  - `patch` (`:128`) spreads `{ ...i, ...change }`, and `remove` / `add` keep the other entries as they are.
  - `type`, `enum_options`, `source`, `origin` and `note` therefore survive an edit made through the editor.
- **Result:** no bug was filed.
- **Remaining limitation:** the editor's own UI still shows every input as plain text (`DeclaredInput.type` is pinned to `"text"` for inputs it CREATES), so it cannot change a file-derived input's type.

**5. [Files outside `files_modified`]**
- `scripts/vitest-count-gate.cjs`: the adoption the plan's gate list instructs.
- `.planning/phases/291-describe-it-from-your-own-files/deferred-items.md`: one finding, below.

## Deferred Issues

- **`could_not_generate:removed_powers_broke_draft` reads the GENERIC refusal on the describe door.**
  - 291-02 returns this code with a server sentence written for a person (`describe_draft_guards.py:396`).
  - With no table row, `describeRefusal` shows "The model couldn't produce a usable draft." That blames the model for what the powers guard did, and the server's sentence shows only under the reveal.
  - The UI-SPEC says this refusal renders the server's sentence.
  - It was not fixed here: it is outside the plan, which scoped only `grounding_unavailable`, and Task 3 may not edit source.
  - Size: one row, or one key routed the way `ENTITLEMENT_REFUSED_KEY` is (G-3 `/gsd:fast`). Logged in `deferred-items.md`.
- **Still open and inherited (291-04's entry):** `backend/tests/integration/test_214_argument_seams.py::test_S7`.

## Known Stubs

None:
- The removed lines render the server's list.
- The inputs fold renders the server's fields over the live definition inputs.
- The reference sub-line renders the saved assets.
- When no form file is held at arrival, the fold's filename falls back to the bound template asset's filename, then to `""`. In practice `fields` is only returned when a form was attached.

## Threat Flags

None beyond the plan's threat model:
- **T-291-40:** removed lines, labels and notes are rendered as React text. XSS cases are in the card, leaf and DecisionsList suites, and `dangerouslySetInnerHTML` appears 0×.
- **T-291-41:** the added-by mark comes only from `origin === "server_added"`, and a case proves an `ai_proposed` input never carries it.
- **T-291-42:** a `kb_auto` input is skipped at launch, at both doors, through `missingRequiredFields`.
- **T-291-45:** the options hint is a pure formatter, capped at 12, rendered as a text label.
- **T-291-43:** `templateRowReferencesLine` states that steps don't read references at run time, and SEED-369 owns changing it.

## Notes for the orchestrator, verifier and code review

- **G-4 is owed.** S1-S7 are already authored as rows in `291-VALIDATION.md` (lines 73-80), with the evidence each needs, and are run at verify-work. Owed UI-SPEC captures:
  - the 375px capture of the card with one removed line;
  - the inputs fold open, with a server-added row;
  - S3 after a reload: "What this form asks for" on the rail and "Read first: …" on Draft settings → template row.
- **`useTemplateFirstDraft.ts` overshot its 286 forecast** (+537 / −118 at 291-04, against "one more upload kind"). The ledger now says "extraction FIRST next".
- Two files crossed G-5 at 291 and got FIRING rows: `workflow_wire.py` and `DecisionsList.tsx`.
- **SEED-369 allocation:** it was allocated in this worktree as max+1 (368+1). If another branch plants a seed before this merges, re-derive the id at merge.
- **Not done here:** `graphify update .` was not run inside the worktree, and STATE.md / ROADMAP.md were not edited (the orchestrator owns them).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 3f99dfed3 | test(291-05): failing arrival-card tests |
| 1 GREEN | d8b64cb1e | feat(291-05): removed lines and inputs fold on the arrival card |
| 2 RED | 848323148 | test(291-05): failing wiring/launch/reload tests |
| 2 GREEN | 616f28eaf | feat(291-05): arrival extras, kb_auto launch skip, post-reload homes |
| 3 seeds + todo | a404aa385 | docs(291-05): route SEED-051/157/133 and close the NL-authoring spike todo |
| 3 new seed | df3b1da51 | docs(291-05): plant SEED-369 — steps read reference files at run time (D-32) |
| 3 gate | 659802b8a | test(291-05): adopt DraftInputsFold suite in the count gate |
| 3 ledger + CLAUDE.md | 8c45e010d | docs(291-05): ledger, seeds, todo close-out — re-derived triples for every 291 file |

## Self-Check: PASSED

- Created files present: `DraftInputsFold.tsx`, `DraftInputsFold.test.tsx`, `SEED-369-steps-read-reference-files-at-run-time.md`, `todos/completed/spike-nl-workflow-authoring.md` (and `todos/pending/` no longer holds it).
- All 8 commits in the table are in `git log 2712f4b69..HEAD`.
- Count gate OK (0 failing, 495/495 after adoption); tsc error-file set identical to base; backend 70 failed (<= 71), 0 collection errors; ledger, CLAUDE.md size, seeds and extension-contract gates all exit 0.
