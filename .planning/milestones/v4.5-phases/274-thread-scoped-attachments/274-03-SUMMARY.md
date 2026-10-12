---
phase: 274-thread-scoped-attachments
plan: 03
subsystem: frontend / chat attachments + Library promote
tags: [chat, attachment, promote, library, folder-picker, listbox, a11y, copy-port, phase-274, att-01, att-03]
requires:
  - "274-02 wire contract (promote / promote-preview / library-links) — built against it, not yet merged with it"
  - "shipped: folderPathOf (scopeCopy.ts), fileIcon, formatBytes, useCitationNavOptional, getAuthHeaders"
provides:
  - "lib/attachmentLifetime.ts — WORKSPACE_UPLOAD_PREFIX, attachmentDisplayName, isThreadLifeAttachment"
  - "lib/api/attachments.ts — promoteAttachment, getPromotePreview, getLibraryLinks, PromoteError + wire types"
  - "components/attachments/saveToLibraryCopy.ts — the port of sketch 274 COPY.js + flagged netNew"
  - "components/attachments/FolderPathListbox.tsx — the no-Root searchable full-path listbox"
  - "components/attachments/SaveToLibraryDialog.tsx — the ONE Save-to-Library dialog"
affects:
  - "274-04 mounts SaveToLibraryDialog on the chip and the panel row, and makes ChatAttachmentChip.attachmentDisplayName delegate to lib/attachmentLifetime"
  - "274-05 lockstep-fences WORKSPACE_UPLOAD_PREFIX and the wire names against the backend"
tech-stack:
  added: []
  patterns:
    - "?raw sketch-port fence (composerCopy precedent) with non-vacuity first"
    - "hand-wired APG combobox/listbox (LinkTargetCombobox precedent), always expanded"
    - "reqRef latest-wins preview (ScopePicker precedent)"
key-files:
  created:
    - frontend/src/lib/attachmentLifetime.ts
    - frontend/src/lib/api/attachments.ts
    - frontend/src/components/attachments/saveToLibraryCopy.ts
    - frontend/src/components/attachments/FolderPathListbox.tsx
    - frontend/src/components/attachments/SaveToLibraryDialog.tsx
    - frontend/src/lib/__tests__/attachmentLifetime.test.ts
    - frontend/src/lib/__tests__/attachmentsApi.test.ts
    - frontend/src/components/attachments/__tests__/saveToLibraryCopy.test.ts
    - frontend/src/components/attachments/__tests__/FolderPathListbox.test.tsx
    - frontend/src/components/attachments/__tests__/SaveToLibraryDialog.test.tsx
    - .planning/phases/274-thread-scoped-attachments/274-BASELINES-FRONTEND.md
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api/documents.ts
    - frontend/src/components/chat/useComposerAttachments.ts
    - frontend/src/components/chat/__tests__/ComposerAttach.composition.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "Folder paths are /-joined everywhere in the dialog (folderPathOf), in the list AND in the sentences, so a person reads one spelling of a path; the sketch drew ' › ' in the list"
  - "Open it on the already screen also calls onSaved (the link exists either way); dismissing the already screen behaves as Done, as the sketch's scrim does"
  - "A preview that reports promotable:false with a refusal shows it in the refusal slot and disables confirm; a preview ERROR stays silent (advisory only)"
  - "Two net-new strings beyond the plan's list: netNew.unknownFolder ('your Library', when the existing copy's folder is top-level or not visible) and netNew.saveFailed (a non-refusal failure has no server sentence)"
  - "netNew.noFolderMatches uses the sketch's drawn wording 'No folder matches.' (index.html, outside COPY.js), not the plan's 'No folders match.'"
metrics:
  duration: "~40 min"
  completed: 2026-10-05
  tasks: 2
  files: 16
---

# Phase 274 Plan 03: Thread-life opt-in, attachment API client and the ONE Save-to-Library dialog — Summary

The composer now uploads chat attachments as thread-life (`?lifetime=thread`) while the panel and
workflow doors send byte-identical requests. The cloud attach carries `X-Org-Id`. One module owns
the lifetime and display-name rule. The promote, preview and library-links clients speak 274-02's
contract. The Save-to-Library dialog exists once, with a no-Root searchable full-path folder
listbox, a version warning before confirm, an already screen that says where the copy lives, and
the minter's refusal shown verbatim.

## What was built

**Task 1: the wire layer (D-05, D-21, D-27, SC#1)**
- `uploadWorkspaceTemplate(threadId, file, lifetime = "template")`: only `"thread"` appends
  `?lifetime=thread`. `TemplateUpload.tsx`, `ChatLayout.tsx` and `lib/api.ts` are byte-unchanged
  against PHASE_BASE (D-21, measured with `git diff`).
- `useComposerAttachments`: the one edit, `uploadWorkspaceTemplate(threadId, f, "thread")`.
- `WorkspaceFile.expires_at?: string | null`, with the three readings commented.
- `lib/attachmentLifetime.ts`: `WORKSPACE_UPLOAD_PREFIX = /^[0-9a-f]{8}-/`, `attachmentDisplayName`
  (last segment, prefix stripped, never empty), `isThreadLifeAttachment` (true only for
  `template_input` with `expires_at === null`; an absent value is not thread-life).
- `attachConnectionFileToThread` builds its headers with the shared auth builder, so it now sends
  `X-Org-Id`. Body and error unwrapping are unchanged (two cases pin that).
- `lib/api/attachments.ts`: the wire types with contract field names, `PromoteError { status }`,
  and the three clients. Errors unwrap a string or `{message}` detail verbatim, and a non-JSON
  body falls back to a short sentence (never raw HTML). Not re-exported through `lib/api.ts`.

**Task 2: the copy port, the listbox, the dialog (D-09, D-10, D-12, D-13, D-14, D-15)**
- `saveToLibraryCopy.ts` ports `engine`, `shared` (builders by shape) and `a` (product keys only).
  `b`, `c` and `scenario` are not ported, and the docblock says why. Net-new strings sit under
  `netNew`, each with the decision it came from. The fence reads the sketch's `COPY.js` and
  `ingest_splice.py` with `?raw`. It checks all 23 ported strings as `key: "value"` and checks
  that no net-new value appears in the sketch.
- `FolderPathListbox.tsx`: an always-expanded APG combobox. The `role=combobox` input has
  `aria-controls` and `aria-activedescendant`, the `role=listbox` holds `role=option` items with
  `aria-selected`, and ArrowUp/ArrowDown wrap and Enter chooses. Options are sorted by full path,
  with parents muted and the leaf bold, inside a `max-h-64` scrolling list. There is no Root and
  no sentinel, typing never clears a pick, and the component commits nothing.
- `SaveToLibraryDialog.tsx` follows the Build Contract order. Confirm stays disabled until a pick
  (and also when folders failed to load or the preview refused). It makes one preview per pick,
  and only the latest renders. The version warning shows only for `duplicate_of: null` and
  `next_version > 1`. A `saved` answer calls `onSaved` and closes. An `already` answer shows the
  already screen: its title, `alreadyBody(<existing path>)`, a folder chip, `alreadyDiffFolder`
  only when the folders differ, Done, and Open it (only when a document navigator exists). A
  `PromoteError` keeps the pick screen and puts `refuseLead` plus the server sentence in
  `role="alert"`. No JSX string literals are used, and nothing reads `Attach` or `Import`.
- Count gate: `src/components/attachments` (directory) and the two `src/lib/__tests__` files went
  into `TARGETS`. Five new pins were added: 11, 14, 7, 11 and 12, which is 55 cases.
  `ComposerAttach.composition.test.tsx` went from 19 to 22, made of 21 at base plus `10c`.

## Verification

- Targeted: the five plan suites plus `FilesSection.test.tsx` and `ChatLayout.launch.test.tsx`:
  112/112 pass (Task 1). `src/components/attachments` 30/30, the two lib suites 25/25, and
  ComposerAttach 22/22 (Task 2).
- TDD gates: `test(274-03)` `9f4daa567` came before `feat(274-03)` `e64f6dd2c`, and
  `test(274-03)` `8a2c8afeb` came before `feat(274-03)` `8bada42db`. Every RED was run and
  failed first. The lib and attachments suites failed at import, and ComposerAttach `10c` failed
  on a missing `"thread"` argument.
- Hot-file ledger: `node scripts/check-hot-file-ledger.cjs .planning/phases/274-thread-scoped-attachments`
  printed `ledger gate OK — every watched file has a row.` (exit 0).
- tsc set-diff (`npx tsc -p tsconfig.app.json --noEmit`): 66 errors at base and 70 now. All four
  new errors are the TS2345s the plan allows, caused by widening `expires_at` at the
  `expiryCaption(` / `isNearExpiry(` call sites. 274-04 closes them by widening the two
  signatures:
  - `src/components/chat/ChatAttachmentChip.tsx:73` — `expiryCaption(file.expires_at)`
  - `src/components/chat/ChatAttachmentChip.tsx:191` — `expiryCaption(file.expires_at)`
  - `src/components/panel/FilesSection.tsx:327` — `isNearExpiry(file.expires_at)`
  - `src/components/panel/FilesSection.tsx:332` — `expiryCaption(file.expires_at)`
  There are no errors in any file this plan created.
- Full count gate, cap 2, run from the worktree root, first try, verdict quoted exactly:
  ```
    total                                      9136    9889    +753
    total 9889  ·  failed 0  ·  pinned total 9136
  count gate OK — 418/418 pinned files present, no per-file decrease, 0 failing.
  ```
  The pinned total rose 9078 → 9136, which is +58: the five new pins (55) plus ComposerAttach's
  +3. Every new suite reads pinned = measured.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 2 - Correctness] Two net-new strings beyond the plan's list**
- `netNew.unknownFolder` ("your Library"). `alreadyBody(path)` needs a place to name when the
  existing copy sits at the Library's top level or in a folder this person cannot see, because
  `folderPathOf` returns null there. Without it the sentence would read "already in null".
- `netNew.saveFailed`. A network failure is not a `PromoteError` and has no server sentence to
  show verbatim.

**2. [Sketch over plan] `noFolderMatches` wording.** The plan listed "No folders match." The
sketch's `index.html` draws "No folder matches." inline, outside `COPY.js`. The drawn wording is
the acceptance bar, so the flag stays `netNew` and the docblock names its source.

**3. [Visual] The path separator in the list.** The sketch draws `Suppliers › Meridian › Pricing`.
The plan says paths come from `folderPathOf`, which joins with `/`, and the dialog's sentences use
the same string. The list renders `Suppliers/Meridian/` muted and `Pricing` bold, so the list and
the version-warning sentence spell the path the same way. If the operator prefers ` › `, it is a
one-line change in `FolderPathListbox` and must also change the sentences.

**4. [Rule 2] The preview refusal is shown.** The plan said a preview error is silent, and it is.
A successful preview that reports `promotable: false` with a `refusal` sentence is now shown in the
refusal slot and disables confirm. The minter's 403 stays the authority on confirm.

**5. Open it also calls `onSaved`.** The plan's behaviour said "`Open it` → openDocument then
close". The link exists either way, so `onSaved(result)` runs before navigating. This way 274-04's
store records the already-mark however the person leaves the screen. Dismissing the already
screen (Escape or overlay) behaves as Done, as the sketch's scrim does.

### Base-gate contamination (recorded, not a deviation in code)
The base count gate ran about 11 minutes in the background. Task 1's RED case `10c` was written
while it ran, so the base verdict reads `failed 1`, and that one failure is `10c` itself (taken from
the persisted JSON before any re-run). At the true base the gate is `failed 0`. The details are in
`274-BASELINES-FRONTEND.md`.

## Transitional state (stated by the plan, still true)
After this merges and before 274-04 does, a composer attachment uploads with `expires_at: null`, and
the shipped chip reads it as `expiry unknown`. 274-04 removes that reading (D-07). No release
happens in between.

## Known Stubs
None. The dialog is fully wired to the client functions. It is not mounted yet: 274-04 mounts it,
by design (D-09).

## Threat Flags
None. Every new network call uses the shared auth headers (T-274-19). Folder names, filenames and
server sentences render as React text nodes, and `components/attachments/` has no
`dangerouslySetInnerHTML` (T-274-20). There is no Root option, and the body is `{folder_id}` only
(T-274-21). The preview uses latest-wins, and the result screen renders the POST answer (T-274-22).

## Commits
- `9f4daa567` test(274-03): failing tests for thread-life opt-in, lifetime rule and attachment API client
- `e64f6dd2c` feat(274-03): thread-life opt-in, one lifetime rule, org header on cloud attach, attachment API client
- `8a2c8afeb` test(274-03): failing tests for the copy port, the no-Root listbox and the dialog
- `8bada42db` feat(274-03): the copy port, the no-Root folder listbox and the ONE Save-to-Library dialog

## Self-Check: PASSED

- All 5 created source modules, 5 suites and `274-BASELINES-FRONTEND.md` are present and committed.
- Commits `9f4daa567`, `e64f6dd2c`, `8a2c8afeb`, `8bada42db` are on the branch, test before feat for each task.
- STATE.md / ROADMAP.md were not modified (the orchestrator owns them).
