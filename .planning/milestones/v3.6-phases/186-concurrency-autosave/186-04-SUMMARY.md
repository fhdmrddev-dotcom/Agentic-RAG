---
phase: 186-concurrency-autosave
plan: 04
subsystem: workflow-builder-store
tags: [frontend, zustand, undo, dirty-tracking, knowledge-base-binding, docblock-truth]
requires:
  - "builderStore's untracked-setter block and the D-184-03 dirty subscription (Phase 184)"
  - "DefinitionMeta's key-remapped mapped type, which already carries project_folder_id"
provides:
  - "setProjectFolder — the workflow-level KB binding action, which writes meta.project_folder_id AND arms `dirty` in one set()"
  - "a corrected D-184-05 source fence naming useDraftPersistence as the write's home"
  - "one enum for the save concept (ToolbarSaveState); the store's parallel SaveState is retired"
affects:
  - "186-08 (the promoted KB chip calls setProjectFolder; it owns the hasEdited half)"
  - "186-06 / 186-07 (must not contradict the reworded D-184-05 fence)"
tech-stack:
  added: []
  patterns:
    - "retarget-don't-delete for an invariant whose demonstrator is removed (Phase 177 count lesson)"
    - "write-and-arm in one set() so a guard cannot be forgotten at a second call site"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/components/workflows/builderStore.test.ts
    - frontend/src/components/workflows/CanvasToolbar.tsx
decisions:
  - "The store's saveState slot is RETIRED (the call 184-13 explicitly handed to Phase 186) — four reasons recorded as a tombstone in the source"
  - "The untracked-setter invariant is RETARGETED onto setChecking + markSaved, never deleted"
  - "setProjectFolder arms `dirty` explicitly rather than widening the D-184-03 subscription to watch `meta`"
metrics:
  duration: ~25 min
  tasks: 2
  files-modified: 3
  completed: 2026-08-01
---

# Phase 186 Plan 04: Store — KB binding arms the guard, and the unread save slot is retired

A `setProjectFolder` action that writes `meta.project_folder_id` and arms `dirty` in the
same `set()`, plus the retirement of a store slot that had zero production readers and was
a second, narrower spelling of an enum the app already owns.

## What was built

**Task 1 — the retirement.** Five sites left `builderStore.ts`: the `SaveState` type
export, the `saveState` field, its action signature, its initial value, and the
`setSaveState` setter. `SAVED_STILL_A_DRAFT` stayed (`CanvasToolbar` imports it and the
page re-exports it), and its docblock — which described the constant as living "next to the
`SaveState` type and the untracked `saveState` slot" — was reworded rather than deleted, so
it no longer names a symbol that is gone.

In place of the deleted field, a **tombstone comment** records the four reasons for the cut,
because "why was this removed" is a question that otherwise gets re-answered by re-adding
the thing: zero production readers; a strictly narrower spelling of the union the app
actually renders; a shape too flat to carry the *held* (two reasons) and *conflict* states
Phase 186 needs; and a module-level fence that forbids this store from naming the API
client, which rules out state whose only writer is a request.

`CanvasToolbar.tsx` got a **comment-only** edit. Its `ToolbarSaveState` docblock defined the
union as "wider than the store's `SaveState` by exactly one member" — a sentence with no
referent once the store's enum was gone. It now states that this is the one enum for the
concept, that the store mirrors nothing, and that a sixth reading is added there and nowhere
else. `CanvasToolbar.test.tsx` was not opened and stayed green.

**Task 2 — `setProjectFolder` (F14).** An untracked action that no-ops unless
`builderPhase === "drafted"` and otherwise writes `meta.project_folder_id` **and**
`dirty: true` in one `set()`. Its docblock states three things, each a trap that would
otherwise be re-opened:

- **why `dirty` is explicit** — the D-184-03 subscription arms on a change to the `phases`
  reference and nothing else, so a `meta`-only edit would be a real definition change that
  produced a new `definition` memo identity on the page (a save would even be scheduled)
  while `dirty` stayed false: no `beforeunload`, no leave prompt, a toolbar reading clean;
- **why it is untracked** — `partialize` narrows the undo stack to `phases` plus the two
  edit discriminators, so undo restores STEPS, never the workflow's identity. A re-bind is
  undone by re-picking;
- **why it touches neither `suppressDirty` nor `temporalRef`** — those bracket a set that
  replaces the DOCUMENT. Binding a knowledge base is an edit to the document in hand.

## Test counts at the three required points

| Point | `builderStore.test.ts` | Note |
|---|---|---|
| Pre-task-1 | **47** | baseline |
| Post-task-1 | **47** | non-decreasing — the invariant was retargeted, no case deleted |
| Post-task-2 | **52** | strictly greater — the five F14 cases |

`CanvasToolbar.test.tsx` was 14 before and 14 after, with zero source edits
(`git diff --name-only` never listed it during Task 1).

## The F14 RED output (observed before the action existed)

```
 × binding writes meta.project_folder_id AND arms dirty in the same act
 × UNBINDING arms dirty too — clearing a binding is a definition edit as well
 × leaves the undo stack untouched — a re-bind is undone by re-picking, not by ⌘Z
 × carries no other meta field away with it
 × a non-drafted builder is a NO-OP — meta unchanged by reference, still clean

TypeError: store.getState(...).setProjectFolder is not a function   (×5)

Test Files  1 failed (1)
     Tests  5 failed | 47 passed (52)
```

After the action landed: `Tests 52 passed (52)`.

## The exact new wording of the D-184-05 fence

**186-06 and 186-07 must not contradict this.** Verbatim, from
`frontend/src/components/workflows/builderStore.ts`:

```
 * ── WHERE PERSISTENCE LIVES, AND WHY NOT HERE (D-184-05 → D-186-05) ───────────────
 *
 * Persistence. `draftIdRef` / `creatingRef` / the create-once-then-PATCH body and the
 * debounce that drives them are NOT here and must not move here.
 *
 * 184-05 phrased this as the page owning the write, which was true then and is not any
 * more: the same note promised that 186 would rewrite exactly that seam, and 186 did. The
 * write now lives in the `useDraftPersistence` hook (`frontend/src/hooks/useDraftPersistence.ts`,
 * D-186-05) — one home for the timer, the concurrency token, the hold conditions and the
 * honest refusal branches — and `WorkflowBuilderPage` composes it the way it already
 * composes `useLiveValidation`. Updated here rather than left standing, because a docblock
 * that describes a seam which has moved is the trap this codebase names elsewhere.
 *
 * THE RULE ITSELF IS UNCHANGED AND IS NOT NEGOTIABLE: this store owns the definition
 * STATE and nothing in this module may name the API client or open a request of any
 * kind. Which module holds the write is a detail; that it is never THIS one is the fence.
```

Two things about it that matter downstream:

1. The **prohibition wording is intact** — the `?raw` source fence in
   `builderStore.test.ts` still passes with its regexes unedited. Only the *description*
   moved; the *rule* did not.
2. It now names `frontend/src/hooks/useDraftPersistence.ts` as the write's home. If 186-06
   or 186-07 puts the write anywhere else, this docblock becomes false and must be changed
   in the same commit as the seam.

## Verification

| Check | Result |
|---|---|
| `npx vitest run builderStore.test.ts CanvasToolbar.test.tsx` | **66 passed** (52 + 14) |
| `npx tsc -b` error count | **33** == baseline; **0** naming a touched file |
| The 209 clean subset (7 files) | **214 passed** — non-decreasing (209 + the 5 F14 cases) |
| `git diff --name-only -- backend/ supabase/migrations WorkflowCanvas.tsx canvasNudge.ts` | **0 files** — the two read-only fences and the whole backend untouched |
| `grep -c "setProjectFolder" builderStore.ts` | **3** (≥ 3 required) |
| `grep -c "the page owns the WRITE" builderStore.ts` | **0** |
| `grep -c "useDraftPersistence" builderStore.ts` | **2** (≥ 1 required) |
| `grep -n "\bSaveState\b" builderStore.ts` | **0 hits** |
| `grep -rn "ToolbarSaveState" frontend/src` count | **8** — unchanged from baseline |
| `grep -c "SAVED_STILL_A_DRAFT" builderStore.ts` | **1** — unchanged from baseline |
| `?raw` fence block in `builderStore.test.ts` | no edit inside it (`git diff` verified) |
| Post-commit deletion check | no tracked file deleted by either commit |

## Deviations from Plan

### 1. [Acceptance-criterion scope] `grep -rn "setSaveState" frontend/src` is 5, not 0

- **Found during:** Task 1 verification.
- **Issue:** The criterion reads *"returns **0** hits"*, but the plan's own executor note
  in the same task says of `WorkflowBuilderPage.tsx`: *"**Leave it** — 186-07 owns that
  file and corrects it there. Do not open it here."* That file declares its **own**
  `const [saveState, setSaveState] = useState<…>` at `:542` and calls it at `:1166`,
  `:1170`, `:1184`, `:1187` — a page-local React state setter that merely shares a name
  with the store action, not a reference to it.
- **Resolution:** The plan's explicit instruction wins over the over-broad grep. The
  **store's** `setSaveState` is gone repo-wide (0 references); the 5 remaining hits are all
  the page's own `useState` setter, all in the file 186-07 owns. No backend or page file
  was opened.
- **Verification for 186-07:** after that plan lands, the grep should reach 0 naturally —
  the page's local save state is exactly what `useDraftPersistence` replaces.

### 2. [Wording] Three docblock sentences were re-tightened so the literal greps hold

- **Found during:** Task 1 verification.
- **Issue:** The first draft of the new docblocks *named* the retired and surviving symbols
  in prose (`SaveState`, `ToolbarSaveState`, `SAVED_STILL_A_DRAFT`), which pushed
  `grep -c "SAVED_STILL_A_DRAFT" builderStore.ts` from 1 → 2, `ToolbarSaveState` repo-wide
  from 8 → 10, and left one `\bSaveState\b` hit in `builderStore.ts` where the criterion
  demands zero.
- **Fix:** the same facts are now stated by description rather than by identifier — "the
  toolbar's own union, in `CanvasToolbar.tsx`, which carries a fifth `"dirty"` reading",
  "the locked-save-wording docblock one screen up", "the untracked save slot it used to sit
  beside". The docblocks lost no information and all three counts returned to baseline.
- **Note for future plans:** a count-must-be-unchanged criterion over a symbol name also
  constrains *prose that mentions it*. Worth knowing before writing the comment, not after.

No Rule 1 / Rule 2 / Rule 4 deviations. No auth gates. No packages installed.

## Known Stubs

None. `setProjectFolder` is fully wired at the store level; its **call site** (the promoted
header chip) is 186-08's, which is the plan's declared boundary — not a stub left behind
here. `hasEdited` is deliberately *not* flipped by this action; that half is 186-08's and
the reasoning is recorded in the action's own docblock.

## Threat surface

No new network endpoint, auth path, file access or schema surface. The one boundary this
plan touches — *builder store → network* — is **still none by construction**: the shipped
`?raw` source fence and the whole-suite zero-call `fetch` spy are unedited and green, and
`setProjectFolder` writes state only.

- **T-186-04-01** (tampering with the no-network fence) — mitigated: fence regexes
  unchanged, `git diff` shows no edit inside the fence `describe`.
- **T-186-04-02** (silent loss of a KB binding) — mitigated: the write and the `dirty` arm
  are one `set()`; F14 asserts both halves, in both directions (bind and unbind).
- **T-186-04-03** (assertion loss during retirement) — mitigated: 47 → 47 → 52, recorded.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | `699aede7` | `refactor(186-04): retire the store's unread saveState slot` |
| 2 | `34f17db8` | `feat(186-04): setProjectFolder — write the KB binding and arm dirty in one act (F14)` |

## Self-Check: PASSED

- `frontend/src/components/workflows/builderStore.ts` — FOUND
- `frontend/src/components/workflows/builderStore.test.ts` — FOUND
- `frontend/src/components/workflows/CanvasToolbar.tsx` — FOUND
- commit `699aede7` — FOUND in `git log`
- commit `34f17db8` — FOUND in `git log`
