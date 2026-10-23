---
phase: 295-runs-that-don-t-dead-end
plan: 06
subsystem: ui (chat panel, run page, ask_user card)
tags: [react, zustand, radix-select, ask_user, engine-pause]

requires:
  - phase: 295-05
    provides: "PendingAsk.engine_pause + EnginePause, AskUserAnswerBody.folder_id (types/index.ts)"
  - phase: 295-03 (parallel, wave 2)
    provides: "the server that sends engine_pause with server-built prompt/options and timeout_seconds null, and allow-lists choice_index + folder_id"
provides:
  - "frontend/src/components/panel/enginePause.ts: pure readEnginePause, needsFolder, answeredHeader, answeredReceipt, ENGINE_CHOICE_SEARCH, ENGINE_CHOICE_STOP, ANSWERED_RESUMED, ANSWERED_STOPPED"
  - "frontend/src/components/panel/AskFolderChoice.tsx: the server-bounded folder chooser leaf (FOLDER_CHOICE_LABEL / _PLACEHOLDER / _HELPER)"
  - "askDraftStore: AskDraft.folderId + setFolder(id, folderId)"
  - "PendingAskCard: one engine_pause read, one AskFolderChoice mount, folder-gated Send, folder_id on the answer, Answered · run stopped for a Stop"
affects: [295-07 (ledger rows for PendingAskCard.tsx, askDraftStore.ts, and the two new modules)]

tech-stack:
  added: []
  patterns:
    - "A G-5-firing card takes a new wire field through ONE pure helper module; the card's arms read only helper results"
    - "A receipt that depends on draft state is resolved at submit time, because a successful answer settles (clears) the draft"

key-files:
  created:
    - frontend/src/components/panel/enginePause.ts
    - frontend/src/components/panel/AskFolderChoice.tsx
    - frontend/src/components/panel/__tests__/enginePause.test.ts
    - frontend/src/components/panel/__tests__/AskFolderChoice.test.tsx
  modified:
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/stores/askDraftStore.ts
    - frontend/src/stores/__tests__/askDraftStore.test.ts
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.paused.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskStack.oneInput.test.tsx

key-decisions:
  - "295-06: answeredReceipt returns the words AFTER `You answered` (`Search another folder — <name>`), not the whole sentence, so the shipped bold receipt renders it unchanged; it is resolved at submit because markSettled drops the chosen folder with the draft"
  - "295-06: the literal `Answered · agent resumed` moved verbatim from PendingAskCard.tsx into enginePause.ts (ANSWERED_RESUMED); the card's count of it goes 2 -> 1"
  - "295-06: an ordinary ask whose option happens to read `Search another folder` or `Stop the run` is untouched: every new reading requires engine_pause to be present"

patterns-established:
  - "A Radix Select leaf fed only by a server-bounded prop, with a visible htmlFor label, for choices that must not widen access"

requirements-completed: [RUN-01, RUN-04]

duration: ~45min
completed: 2026-10-21
---

# Phase 295 Plan 06: The card answers the found-nothing pause

**The existing PendingAskCard now answers the found-nothing pause. It shows the server's prompt and choices word for word, adds a folder chooser that lists only the folders the server offered, reads "still waiting" with no clock in both homes, and records a Stop as `Answered · run stopped`.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-10-21T01:35Z
- **Completed:** 2026-10-21T02:20Z
- **Tasks:** 2, each with a TDD RED commit and a GREEN commit
- **Files modified:** 11 (`git diff --stat ea1347c4d HEAD`, before this SUMMARY)

## Accomplishments

- **The pure helper (`enginePause.ts`).** It has no React and no API import.
  - `readEnginePause` returns the pause, or null for an ordinary ask. It drops folder rows with no id or no real name.
  - `needsFolder` is true only while the server's search choice is selected on a pause that offered folders.
  - `answeredHeader` returns `Answered · run stopped` for a Stop on an engine pause. Every other answer keeps `Answered · agent resumed`.
  - `answeredReceipt` names the chosen folder.
- **The folder chooser (`AskFolderChoice.tsx`).** A leaf on the shadcn Select pattern, with no hook and no API import. It shows:
  - the visible label `Folder to search`, tied to the trigger with `htmlFor`;
  - the placeholder `Choose a folder…`;
  - the helper line `The step runs once more, searching only this folder. The workflow itself is not changed.`
  - Its rows come only from `engine_pause.folders`: names only, 16px of indent per depth level, nameless rows dropped.
- **The draft store.** One optional field, `folderId`, and one action, `setFolder`. Clear and settle drop the folder. `EMPTY_DRAFT` stays one frozen reference with no folder key.
- **The card.** Changes:
  - one read of `ask.engine_pause`;
  - one gated `<AskFolderChoice>` mount beneath the chips;
  - Send Answer stays disabled until a folder is chosen;
  - `folder_id` is sent only for the search choice;
  - the answered header comes from the helper.

  The clock, the wait-line arms and the retirement logic are byte-unchanged. An engine pause arrives with `timeout_seconds: null`, and the shipped `!hasDeadline` arm already draws no clock and shows `NO_DEADLINE_WAITING_LINE`.

## Task Commits

1. **Task 1 RED:** `0fd19dec4` test(295-06): pin the engine-pause helper and the folder chooser
2. **Task 1 GREEN:** `4e31b8cec` feat(295-06): the engine-pause helper and the server-bounded folder chooser (D-03)
3. **Task 2 RED:** `a178ba613` test(295-06): pin the found-nothing card in both homes
4. **Task 2 GREEN:** `68f80ebff` feat(295-06): the card answers the found-nothing pause (D-02, D-37)

## TDD Gate Compliance

Each task has a `test(...)` commit followed by a `feat(...)` commit. These RED results were seen before GREEN:

- **Task 1:** 3 files failed. Two could not resolve their module (`enginePause`, `AskFolderChoice`), and 4 store cases failed with `s.setFolder is not a function`. 7 passed.
- **Task 2:** 3 failed / 88 passed. The 3 drivers were: the folder answer (chooser absent, no `folder_id`), the Stop header (read `agent resumed`), and the chooser following the panel into the chat card.
- **Fences, green at base by design:** the D-37 no-clock cases (both homes, the armed approval, 10 fake minutes), the locked-prompt DOM sweep, the continue receipt and the ordinary-ask case. A null deadline was already handled by the shipped no-deadline arm, so these pin the reading rather than drive it. The test file says so in its own header.

## G-5 record

Triples are `commits / phases / lines`, re-derived with the CLAUDE.md recipe (six-digit buckets excluded). Each row shows base → after this plan's commits. Ledger rows are written by 295-07.

| File | Triple base → after | Counts base → after | Touch |
|---|---|---|---|
| `frontend/src/components/panel/PendingAskCard.tsx` | 19/10/1052 → 20/11/1080 | `useState[(<]` **7 → 7** (`grep -c "useState("` 2 → 2) · `useEffect(` **3 → 3** · `useLayoutEffect(` 1 → 1 · `if (` / `else if (` 23 → 23 · JSX/logic ` && (` 8 → 10 · ` ? ` 16 → 18 · `<AskFolderChoice` 0 → 1 · `readEnginePause(` 0 → 1 · literal `Answered · agent resumed` 2 → 1 (moved verbatim into `enginePause.ts` as `ANSWERED_RESUMED`) | One field read (`readEnginePause(ask)`, plus `needsFolder` over the same field), one leaf mount, and one store selector (`setFolder`). The added conditionals: the mount gate (`&& (`), the Send gate `(!wantsFolder \|\| !!folderId)` (`&& (`), `folder_id` only for the search choice (` ? `), and the folder-receipt argument (` ? `). The header became a helper call. No new `useState`, `useEffect` or `useRef`. |
| `frontend/src/stores/askDraftStore.ts` | 1/1/128 → 2/2/136 | actions (`set((s)`) 6 → 7 · interface fields on `AskDraft` 2 → 3 | One optional field (`folderId`) and one action (`setFolder`). The GC subscriber, `EMPTY_DRAFT`, `markSettled` and `clearDraft` are unchanged; they drop the folder because it lives on the draft. |
| `frontend/src/components/panel/enginePause.ts` | new → 1/1/102 | n/a | Pure leaf module, not hot. |
| `frontend/src/components/panel/AskFolderChoice.tsx` | new → 1/1/70 | useState 0 · useEffect 0 | Leaf, not hot. |

`PendingAskStack` was not touched: the field rides the prompt, so both homes read it with no derivation.

## Verification

- **Targeted suites** (`GSD_VITEST_MAX_WORKERS=2`):
  - `PendingAskCard.test.tsx`, `PendingAskCard.paused.test.tsx`, `PendingAskCard.retired.baseline.test.tsx`, `PendingAskStack.oneInput.test.tsx`, `enginePause.test.ts`, `AskFolderChoice.test.tsx` and `askDraftStore.test.ts`: **7 files, 126 passed**.
- **Acceptance greps:**
  - `@/lib/api` in `AskFolderChoice.tsx` / `enginePause.ts`: nothing.
  - The four folder pickers and `listFolders` in `AskFolderChoice.tsx`: nothing.
  - `'"Search another folder"'` in `enginePause.ts`: **1**.
  - `<AskFolderChoice` in the card: **1**.
- **Frontend typecheck:** `tsc -p tsconfig.app.json --noEmit` reports 63 errors at base and 63 at HEAD. The sets are identical after normalising line numbers (`diff` is empty).
- **Vitest count gate:** one run, from the worktree root, `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`.
  - Verdict: `count gate OK — 480/480 pinned files present, no per-file decrease, 0 failing`.
  - Total 10964 against a pinned total of 10176.
  - `WorkflowBuilderPage.canvas.test.tsx` (SEED-171) was green in this run. It is provably unmodified: `git diff --numstat ea1347c4d HEAD` does not list it. That is one green sample of a flaky suite, an observation and not proof.
  - **Follow-up for 295-07:** the two new suites, `enginePause.test.ts` and `AskFolderChoice.test.tsx`, ran but are in neither count-gate knob. An unpinned suite is unguarded, so they should be adopted alongside the ledger rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `answeredReceipt` returns the receipt's VALUE, and the card resolves it at submit**
- **Found during:** Task 2 design, reading `handleSubmit`.
- **Issue:** The plan has `answeredReceipt(ask, label, folderId)` return the whole sentence `You answered Search another folder — <name>`, called from the answered arm. But a successful answer calls `markSettled`, which deletes the draft, and the chosen folder with it. By the time the answered arm renders, the folder cannot be looked up, so the receipt would have fallen back to `You answered Search another folder` with no folder named. Storing it would have needed new state, which is over the G-5 budget.
- **Fix:** `answeredReceipt` returns the words after `You answered` (`Search another folder — <name>`). The card computes it in `handleSubmit`, before the settle, and passes it to the existing `setAnsweredValue`. The shipped `You answered <b>{answeredValue}</b>` then renders it with the shipped bold styling. The person reads exactly the UI-SPEC A.4 sentence; the card test asserts the full `textContent`.
- **Files modified:** `enginePause.ts`, `PendingAskCard.tsx`
- **Commits:** `4e31b8cec`, `68f80ebff`

**2. [Rule 3 - Blocking] The indent test reads px, not `calc()`**
- **Issue:** jsdom rewrote `calc(2rem + 16px)` as `calc(16px + 2rem)`, so the RED test's literal could never match.
- **Fix:** The item's left padding is `32 + 16 × depth` px. 32px is `SelectItem`'s own `pl-8`, which leaves room for the check mark. The test asserts `32px`, `48px` and `64px`. This was adjusted in the GREEN commit.
- **Commit:** `4e31b8cec`

**3. [Expected] `PendingAskCard.retired.baseline.test.tsx` line pin 1053 → 1081**
- That suite pins the card's exact line count, so that its `?raw` sweep is known to read the right file. It was re-baselined in place with a dated note, following the file's convention. The three retirement-sentence fences are untouched and green.
- **Commit:** `68f80ebff`

### Not done, by design

- **No sketch (D-30).** G-2 was skipped, as audited by the orchestrator in STATE.md. The card reuses PendingAskCard's live-answer layout and the shadcn Select pattern the Library's move dialog draws, and imports none of the folder pickers.

## Known Stubs

None. Every new reading takes a real wire field (`engine_pause`, declared by 295-05 and populated by 295-03). Every test drives a non-empty fixture through the real card.

## Threat Flags

None beyond the plan's threat register.
- **T-295-06-01:** the leaf renders only `engine_pause.folders` and imports no folder API. Tests assert both the rendered list and the absent imports.
- **T-295-06-02:** prompt and options render verbatim, and the client adds no choice. The locked-prompt test sweeps the whole DOM.
- **T-295-06-03:** every server string is a React text child.
- **T-295-06-04:** a null deadline draws no clock. There is a fake-timer test in both homes.

## Self-Check: PASSED

- FOUND: `frontend/src/components/panel/enginePause.ts`, `frontend/src/components/panel/AskFolderChoice.tsx`, `frontend/src/components/panel/__tests__/enginePause.test.ts`, `frontend/src/components/panel/__tests__/AskFolderChoice.test.tsx`
- FOUND commits: `0fd19dec4`, `4e31b8cec`, `a178ba613`, `68f80ebff`
