---
phase: 296-close-v4-7-debt
plan: 07
subsystem: workflow builder, team picture, describe door, governance seal, library (frontend)
tags: [builder, team-view, describe-door, governance, publish, a11y, vocabulary]
requires: ["296-03 (provider_error refusal, stand-in auto_answered note)", "296-04"]
provides:
  - "Team view is read-only (D-09): one controlled view pair on WorkflowCanvas"
  - "Generated drafts are saved on arrival (BUG-261024-02)"
  - "templateDraftBind.ts — the bind leaf extracted from useTemplateFirstDraft (move-only)"
  - "splitTemplateBind — keeps 296-06's unplaced_sentences out of definition.assets[]"
  - "Seal / gate row / attached-gate line claim a check only where the engine runs one (D-04 b)"
affects: [296-05 (count gate + backend gate owner), 296-06 (template bind response gains unplaced_sentences)]
tech-stack:
  added: []
  patterns: ["controlled-prop pair on the selectedSlug precedent", "snapshot ref taken at the press, read by an async follow-up"]
key-files:
  created:
    - frontend/src/components/workflows/templateDraftBind.ts
    - frontend/src/components/workflows/__tests__/teamAndVocab296.test.ts
    - frontend/src/components/workflows/__tests__/describeDoor296.test.tsx
    - frontend/src/components/workflows/__tests__/governanceLibraryPanel296.test.tsx
  modified:
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/TeamPicture.tsx
    - frontend/src/components/workflows/teamModel.ts
    - frontend/src/components/workflows/teamVocabulary.ts
    - frontend/src/components/workflows/library/libraryVocabulary.ts
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/useTemplateFirstDraft.ts
    - frontend/src/components/workflows/templateFirstVocabulary.ts
    - frontend/src/components/workflows/declaredInputsVocabulary.ts
    - frontend/src/components/workflows/DraftInputsFold.tsx
    - frontend/src/components/workflows/describeRefusalVocabulary.ts
    - frontend/src/components/workflows/DescribeTemplateRow.tsx
    - frontend/src/components/workflows/DescribeReferencesSection.tsx
    - frontend/src/components/workflows/TemplateAttachSection.tsx
    - frontend/src/components/workflows/GovernanceSection.tsx
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/lib/api/knowledge.ts
    - frontend/src/lib/api/workflows.ts
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "Escalated-step sentence (Claude's discretion, D-04 b): `Marked to prove its sources, but this step can't search your documents, so nothing is checked when it runs.`"
  - "isGrounded keeps the `already-set` seal (strict llm_emit citation policy is engine-enforced); only `escalated` is dropped. The plan's literal `=== \"detected\"` would have removed a true seal"
  - "290-IN-01: one shared comparePhaseOrder (phaseVocabulary) for canvas and team; a missing phase_index reads 0 on both"
  - "290-IN-02: STEP_UNTYPED lives in phaseVocabulary; libraryVocabulary re-exports it; teamVocabulary (a fenced zero-import leaf) drops its copy and teamModel reads the home"
  - "290-OBS-vocab: phaseVocabulary gets a module-local own() (not an import) so its zero-import fence holds"
  - "Bind-time unplaced sentences render in the drafted view's bind block (UnplacedSentencesNote exported from DescribeTemplateRow), because the bind runs after the pre-draft row is gone"
metrics:
  duration: "~2 h 50 min"
  completed: 2026-10-27
  tasks: 3
  files: 31
---

# Phase 296 Plan 07: Builder, team picture, describe door, governance seal and library — frontend debt Summary

This plan fixes the frontend half of W3, each behavioural row driven RED first. The Team view no longer edits anything: undo and redo do nothing, the step panel isn't shown, and Steps reopens it on the same step. A generated draft is now saved as soon as it arrives, so leaving without editing doesn't lose it. The team picture is keyboard-reachable and orders steps exactly as the canvas does. On the describe door, files are locked while the draft is being written, only what the model was actually sent gets attached, every attach failure is listed, and `Look it up` is shown as not available yet. The governance seal, the locked gate row and the attached-gate line now appear only where the engine actually runs a citations check. The library's publish line now shows the notes the practice run answered for the author.

**Base sha:** `df799b87e68d18ecc5f9daf9f099d84c21382207` (develop, includes merged 296-01, 296-03, 296-04).

## Commits

| Task | RED (test) | refactor | GREEN (feat) |
|---|---|---|---|
| 1 Team view read-only, draft kept, team + vocab | `2548b6212` | — | `02b5053ac` |
| 2 Describe door | `a2568f789` | `1a449d44c` (move-only extraction) | `cd1aaefff` |
| 3 Governance, library, panel | `e074515f5` | — | `ef2832f46` |

## RED evidence (each measured before its fix)

| Row | RED assertion |
|---|---|
| 290-WR-02 / D-09 | Ctrl+Z under Team reverted the delete (`length 5`, expected 4); Ctrl+Y re-applied it (4, expected 5); `phase-form-close` was still in the DOM under Team |
| BUG-261024-02 | `mockCreate` was called **0** times after generation (expected 1) |
| 291-S1-copy a | receipt read `…Nothing is saved or published yet.` |
| 290-IN-01 | `[alpha(index 1), beta(no index)]`: the canvas ordered by slug (NaN fell through), the team picture by index 0 → the two orders differed |
| 290-IN-02 | `phaseVocabulary.STEP_UNTYPED` was undefined |
| 290-IN-03 | the figure label was `Team picture for    ` |
| 290-IN-04 | no `tabIndex` roving, no ids or `aria-controls`, arrows / Home / End did nothing, and there was no `role="tabpanel"` |
| 290-IN-05 | `team-plane` had `tabIndex -1`, no role and no label |
| 290-FU-canvas | an `external_action` step with `action_risk_armed: false` painted `armed: false` |
| 290-OBS-vocab | `nodeTitle` of a `constructor` phase_type returned a **function**; `derivedFaceOf` with `skill_ref: "constructor"` returned `Run the function Object()…`; a config-less phase threw `Cannot read properties of undefined (reading 'phase_type')` |
| 291-WR-01 | `composing` absent; a pick during composing landed; both sections rendered enabled; the bind uploaded `[a.pdf, b.pdf]` with b added after the press |
| 291-WR-02 | a reference whose read never answered was bound: `[a.pdf, b.pdf]`, expected `[a.pdf]` |
| 291-IN-08 | `bindFailures` undefined (only the last failure was kept) |
| 291-IN-03 | `UnplacedSentencesNote` did not exist; the hook dropped `unplaced_sentences` |
| 291-WR-06 UI | `Look it up` enabled, no note, no kb_auto warning; the explanation still promised a look-up |
| 291-IN-05 | a `covered_by: null` field rendered a dead radiogroup |
| 291-S1-copy b / c | `provider_error` read the generic sentence; `inputOptionsHint(["C","S","P"," "])` returned `(one of: C, S, P,  )` |
| BUG-261021-05 (b) | an escalated agent step was `grounded: true`, drew `canvas-node-seal`, showed `governance-attached`, and the page source carried `cause === "escalated"` |
| 288-F-4 / 291-S6-F7 | `onPublished` was called with `(3)` only; the strip had no `run-cta-note` |
| 291-S3-F2 / F3 | the row read the raw `topmostSubform[0].Page1[0].f1_01[0]`; Replace under a PDF accepted `.docx,.pptx,.xlsx` |
| 287-IN-02 | `requiredFieldsMessage([{key:"recipient", label:""}])` returned ` is required` |
| 286-S04-2 | comment-only; checked in G-4 / review, no test |

## Extraction verdict (useTemplateFirstDraft, "extraction FIRST")

**Taken, move-only, in its own commit (`1a449d44c`).** `bindPlanFor` and the post-draft bind loop moved word for word to `templateDraftBind.ts` as `bindDraftFiles(definitionId, subject, sinks)`. `bindHeldTemplate` became a thin wrapper that passes the same refs and the same setters. Every describe, template, door and builder suite stayed green without edits: 31 files and 1273 tests, with the typecheck set unchanged. The Task 2 features landed afterwards, in `cd1aaefff`. No override is needed for this file.

## Hook counts

| File | useState | useEffect |
|---|---|---|
| `WorkflowBuilderPage.tsx` | 16 → **17** (one `canvasView`) | 6 → 6 |
| `WorkflowCanvas.tsx` | 8 → 8 (the local state stays as the uncontrolled fallback) | 2 → 2 |
| `WorkflowsPage.tsx` | 16 → 16 (`runCta` gained a field) | unchanged |
| `useTemplateFirstDraft.ts` | 9 → 10 across the file (two arrays replace the one last-failure state) | +1 (the composing ref mirror) |

## G-5 record

Every touched non-test file had its triple re-derived with the CLAUDE.md recipe. Each also got a `296-07` paragraph in its own `### … — Phase 296 (296-07)` section of `docs/HOT-FILE-LEDGER.md`, with the previous scan-list and CLAUDE.md cells kept verbatim. Its FIRING cell was updated (≤ 80 chars). Both gates exit 0 across all 28 non-test files:

- `check-hot-file-ledger.cjs --files …`: 28 watched.
- `check-claude-md-size.cjs`: CLAUDE.md at 101,270 chars.

- **New rows (D-26):**
  - `definitionOps.ts` (absent its entire life at 5 phases);
  - `GovernanceSection.tsx` (now at 3 phases);
  - `NodeCornerMarks.tsx`. It was **not modified**: the seal reads `grounded`, which was narrowed upstream. The row is added so G-5 can see the file.
  - `templateDraftBind.ts` (young).
- **Now FIRE at 3 phases (CLAUDE.md rows added):**
  - `templateFirstVocabulary.ts`, `declaredInputsVocabulary.ts`, `describeRefusalVocabulary.ts`;
  - `DescribeTemplateRow.tsx`, `TemplateAttachSection.tsx`;
  - `GovernanceSection.tsx`, `NodeCornerMarks.tsx`.
- **Stale rows corrected:**
  - `phaseVocabulary.ts`: the row read `16 / 6 / 990`; measured `17 / 7` at base.
  - `canvasModel.ts`: the row read `13 / 6 / 752`; measured `14 / 7` at base.
  - `TeamPicture.tsx`: the row read `1 / 1 / 470`.

## Guardrail overrides for STATE.md

- **G-5 `WorkflowCanvas.tsx` (FIRES, verdict "extraction FIRST next", ⛔):** D-09 adds one controlled prop pair to a file whose verdict is extraction-first, by operator decision. The pair is `view` / `onViewChange`, on the `selectedSlug` precedent. 290-IN-04 also spread `teamViewPanelProps("steps")` onto the two Steps bodies (the plane and the empty draft) so the tablist controls a real tabpanel. useState 8 → 8. The extraction is still owed before the next concern.
- **G-5 `WorkflowBuilderPage.tsx` (FIRES, ⛔), audited reading: six touches in 296-07.**
  1. One `canvasView` state, passed as the canvas's controlled pair.
  2. `teamShown`, which gates the undo/redo early return and the `PhaseFormPanel` mount (its grid track is `0px` while Team shows).
  3. `void persistence.saveNow()` in `onDrafted`.
  4. The figure-label expression, which imports `UNTITLED_WORKFLOW`.
  5. The describe-door lock hint plus `disabled` on both sections, and the bind block as one map over `bindFailureLines` plus `UnplacedSentencesNote`.
  6. `gatesFor` narrowed to `detected`, plus one `declaredInputs` key on the template object.

  useState 16 → 17, useEffect 6 → 6. The plan forecast five touches; the sixth is the composing hint and disabled props that 291-WR-01 required.
- **G-5 `useTemplateFirstDraft.ts`:** extraction taken FIRST (move-only). No override.
- **Files outside `files_modified`, each a recorded deviation:**
  - `DescribeReferencesSection.tsx`: the WR-01 lock.
  - `TemplateAttachSection.tsx`: the WR-01-adjacent bind split, plus S3-F2/F3, which live in this file and not in `PhaseFormPanel.tsx`.
  - Test amendments in `WorkflowsPage.test.tsx`, `DraftArrivalCard.test.tsx`, `DraftInputsFold.test.tsx`, `describeRefusalVocabulary.test.ts`, `phaseVocabulary.test.ts`, `teamModel.test.ts`, `teamVocabulary.test.ts`, `definitionOps.test.ts`, `WorkflowBuilderPage.preDraft.baseline.test.tsx`, `WorkflowBuilderPage.declaredInputs.test.tsx`, `WorkflowBuilderPage.session.test.tsx` and `GovernanceSection.test.tsx`.
- **Plan-end vitest count gate: NOT run**, by orchestrator instruction ("296-05 does"). It is owed to 296-05.

## Deviations from Plan

### Auto-fixed issues

1. **[Rule 1 - Bug] `isGrounded` keeps `already-set`** (Task 3). The plan said to narrow it to `=== "detected"`. That would also have removed the seal from a strict-policy `llm_emit`, whose check the engine does run. `canvasModel.test.ts` and five starter fixture snapshots caught it. The fix uses `cause !== null && cause !== "escalated"`, and `gatesFor` stays `detected`-only, as specified. Commit `ef2832f46`.
2. **[Rule 2 - Missing critical] Bind response split before `assets[]`** (Task 2). 296-06 adds `unplaced_sentences` to the template bind response, and `definition.assets[]` is `extra='forbid'`. Writing the raw response (as `TemplateAttachSection` did) would make every later save of that draft refuse. The fix adds `splitTemplateBind` in `lib/api/workflows.ts`, imported by domain path so barrel mocks are unaffected, and uses it in both callers. Commit `cd1aaefff`.
3. **[Rule 3 - Blocking] S3-F2 / S3-F3 live in `TemplateAttachSection.tsx`**, not in `PhaseFormPanel.tsx`. The `What this form asks for` rows and the Replace input both live there. `PhaseFormPanel.tsx` changed only to carry one optional `declaredInputs` type key through to it. The acceptance grep `.pdf,.docx,.pptx,.xlsx` therefore matches `TemplateAttachSection.tsx` (1), not `PhaseFormPanel.tsx` (0).
4. **[Rule 3] The WR-01 lock needed `DescribeReferencesSection.tsx`.** The plan named the template row only.
5. **[Rule 3] `bindFailureLines` lives in `templateDraftBind.ts`, not the vocabulary.** `templateFirstVocabulary.test.ts` fences that table to strings and string-returning functions. The vocabulary holds `referencesBindFailedMessage` and the words; the leaf composes the lines.
6. **[Rule 3] `teamVocabulary.ts` drops `TEAM_STEP_UNTYPED` instead of re-exporting it.** Its suite fences it as a zero-import leaf. `teamModel.ts` reads `phaseVocabulary.STEP_UNTYPED`.
7. **[Rule 3] `phaseVocabulary.ts` uses a module-local `own()`**, not an import of `ownProperty.ts`, because its suite fences "zero imports". The inline-form case in `phaseVocabulary.test.ts` was amended in place.
8. **Test id `governance-escalated-no-check`.** `governanceVocabulary.test.ts` sweeps string literals for the never-say word "Unchecked", and the first spelling of this test id tripped it.
9. **Superseded pins amended deliberately.** Each amended pin carries its reason in the test body:
   - The arrival is now the create: `declaredInputs` and `session` suites.
   - The two composing DOM captures now carry exactly the lock delta. They are applied by a function, not re-captured, so any other drift still reds.
   - `Look it up` is disabled: the fold, card and canvas suites now flip in the other direction. A click on a disabled radio still flips the DOM `checked` in jsdom with no store write, so the old direction would have passed vacuously.
   - Escalated no longer seals or gates: canvasModel, GovernanceSection and the canvas page, each noting "D-04 amended (b), 296".
   - The refusal table lists six sub-reasons.
   - The receipt copy.
   - `STEP_UNTYPED` has one home.

### Not done or partial (recorded)

- **291-S3-F2 page-text fallback.** A raw field name that no declared input fills still shows raw. The placeholders route returns names only, so page-text labels need a backend change. Deferred.
- **291-IN-08's second half** (the inputs fold's filename reads the live template file) was not changed. Files are now locked while composing and the bind uses the snapshot, so the two can only diverge by a post-draft pick, which the drafted view does not offer.
- **The SeedReceipt still lists a hand-escalated step** with its shipped reason (`it was set to must prove it by hand`). That is a statement about the author's setting, and no SeedReceipt test pinned a seal. Worth a look in G-4.

## Plan-end gates

- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): the set diff against base is **empty**, at 62 errors before and 62 after, all inherited.
- **Targeted suites:** every row's suite plus the whole of `src/pages/WorkflowBuilderPage*`, `src/pages/WorkflowsPage*`, `src/components/workflows/**` and `src/lib/**`.
  - Result: 186 files, 6838 tests, 0 failures from this plan.
  - One measured flake: `WorkflowsPage.test.tsx` hit 3–4 timeouts (about 5–8 s each) **only** when run inside that 186-file batch. Those cases were "D-08 paraphrase", the two "D-17" cases and "D-04 is_mine".
  - The same file passes alone (152/152 with `PublishGauntlet.test.tsx`). It failed the same way after Task 2, before `WorkflowsPage.tsx` was touched. It is load-dependent, not caused by this plan.
- **Vitest count gate:** not run, by orchestrator instruction. Owed to 296-05.

## Threat surface

- **T-296-36:** mitigated by the D-04 (b) narrowing.
- **T-296-37:** mitigated by the onDraft snapshot, the sent-only references and the locked sections.
- **T-296-38:** mitigated. `auto_answered` notes, unplaced sentences and failure names all render as React text children.
- **T-296-39:** mitigated by the `teamShown` gates.

No new network endpoint, auth path or schema surface was added.

## Known Stubs

None.

## Self-Check: PASSED

- Created files exist:
  - `templateDraftBind.ts`
  - `__tests__/teamAndVocab296.test.ts`
  - `__tests__/describeDoor296.test.tsx`
  - `__tests__/governanceLibraryPanel296.test.tsx`
- All 7 commits are in `git log df799b87e..HEAD`: `2548b6212`, `02b5053ac`, `1a449d44c`, `a2568f789`, `cd1aaefff`, `e074515f5`, `ef2832f46`.
- Acceptance greps:
  - `"A step with no type"` appears 1 time in non-test source.
  - `onViewChange` appears 3 times in the canvas and 1 time in the page.
  - The saved-draft receipt string appears 1 time.
  - The tabpanel string appears 2 times.
  - The lock hint appears 1 time.
  - The look-up note appears 1 time.
  - `provider_error` appears 3 times.
  - `unplaced_sentences` appears 5 times.
  - `cause === "escalated"` appears 0 times in the page.
  - "nothing is checked when it runs" appears 1 time.
  - `auto_answered` appears 1 time in `WorkflowsPage.tsx`.
  - `.pdf,.docx,.pptx,.xlsx` appears 1 time, in `TemplateAttachSection.tsx` (see deviation 3).
  - `label?.trim() || f.key` appears 1 time.
