---
phase: 244-the-chat-shell-and-the-composer
plan: 06
subsystem: fullstack
tags: [fastapi, pydantic, react, connectors, workspace-files, tdd, vitest, pytest, dom-order-fence, g5-discharge]

# Dependency graph
requires:
  - phase: 244-02
    provides: "the workspace attachment contract — validate_upload's fourth category, WORKSPACE_ALLOWED_EXT, the sandbox hydration"
  - phase: 244-04
    provides: "LibraryPage.tsx's attention prop and the LibraryHeaderBar extraction (this plan is the page's second writer in the phase)"
  - phase: 244-05
    provides: "ChatAttachmentChip, composerCopy, the hoisted chips row — and the LIVE draft-editing defect this plan was required to close in one commit"
  - phase: 233
    provides: "import_single_file's folder_id parameter (D-233-01) — the seam this plan forwards into, already built"
  - phase: 216
    provides: "ConnectedFilePickerModal and the single-file import route"
provides:
  - "The composer's cloud door lands in THIS THREAD — a workspace_files row and no documents row at all"
  - "A thread-scoped route whose MODULE cannot reach the Library minter, so 'not in the KB' is structural"
  - "ONE workspace writer both doors call, so the cloud gate cannot drift from the local one"
  - "The Library's own single-file cloud door, taking its destination from the page's existing selection"
  - "A REQUIRED folder_id on the Library import — the refusal is the model's shape, not a branch"
  - "The fifth and last of D-244-27's ordered blocks, fenced by DOM order and driven RED"
  - "⭐ G-5: the useComposerAttachments seam 244-05 named and owed — MessageInput SHRANK 855 → 821"
affects: [SHELL-04, BUG-260905-01, chat composer, Library ingestion, connectors API, workspace API]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A refusal enforced by a REQUIRED model field, so FastAPI answers 422 before the handler runs"
    - "Module PLACEMENT as a security guarantee — a module that never imports the minter cannot mint"
    - "One extracted writer shared by two doors, pinned by counting its call sites in source"
    - "A picker that raises onConfirm and lets the CALLER decide what a pick means"
    - "Copy ported BY SHAPE (a builder) when the sketch's literal carries scenario data"

key-files:
  created:
    - frontend/src/components/chat/useComposerAttachments.ts
    - frontend/src/components/library/LibraryCloudImport.tsx
    - frontend/src/components/chat/__tests__/ConnectedFilePickerModal.thread.test.tsx
    - frontend/src/pages/__tests__/LibraryPage.cloudImport.test.tsx
    - backend/tests/unit/test_244_cloud_attach_is_thread_scoped.py
    - backend/tests/unit/test_244_import_destination_required.py
  modified:
    - backend/app/api/workspace.py
    - backend/app/models/workspace.py
    - backend/app/api/connectors.py
    - backend/app/models/connector.py
    - frontend/src/components/chat/ConnectedFilePickerModal.tsx
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/composerCopy.ts
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/lib/api/connectors.ts
    - frontend/src/lib/api/documents.ts
    - frontend/src/lib/api.ts
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/reported-bugs/BUG-260905-01-cloud-import-lives-in-chat-and-dumps-into-library-root.md
    - .planning/phases/244-the-chat-shell-and-the-composer/deferred-items.md

key-decisions:
  - "The thread-scoped route lives in workspace.py, not connectors.py — that module imports neither import_single_file nor ingest_splice, so 'the chat writes nothing to the KB' is structural rather than a promise"
  - "The persist tail was EXTRACTED to one writer both doors call, because two writers is how a second door quietly grows a laxer gate"
  - "Tasks were executed 3 → 1 → 2, not 1 → 2 → 3, so no commit exists where a shipped door is dead"
  - "The G-5 seam was TAKEN rather than deferred a third time: MessageInput shrank 855 → 821 WHILE gaining the cloud door"
  - "The picker raises onConfirm; the caller commits. It no longer decides what a pick means"
  - "The confirm word is a prop — Attach for the chat, Import here for the Library. Two consequences must not share one word"
  - "BUG-260905-01 stays `folded`, not `closed` — a green unit test is not a reproduction"

patterns-established:
  - "A RED that is explainable without reference to the defect proves as little as a green — re-drive the plant"
  - "A LINE count is not an OCCURRENCE count; grep -n misled a fence in this plan"
  - "`git checkout -- <file>` restores from the INDEX, which destroys an unstaged rewrite"

requirements-completed: []

# Metrics
duration: ~190min
completed: 2026-09-12
---

# Phase 244 Plan 06: The Two Doors, Un-inverted — Summary

**A file picked from cloud storage in the chat now lives in that chat and nowhere else, and the
Library finally has the cloud door it was supposed to have all along — one that asks which folder,
and refuses rather than guessing.**

## Performance

- **Duration:** ~190 min
- **Tasks:** 3 of 3, each TDD (`test(244-06)` RED → `feat(244-06)` GREEN)
- **Files:** 22 (6 created, 16 modified)
- **Base:** `efcaa65e0` (waves 1 + 2 + 3 merged), asserted before the first edit — the worktree
  spawned on `master`'s tip (`2f2142316`) and was reset, exactly as the orchestrator warned

## Task Commits

| Task | RED | GREEN |
| ---- | --- | ----- |
| 3 — the composer's cloud door means THIS CONVERSATION | `86a1cd045` | `556fc413c` |
| 1 — the import route asks where the file goes | `e7b10ddf6` | `52cdc7583` |
| 2 — the Library gets the door | `204f44ff2` | `89b40f0c2` |

**TDD gate compliance:** every task has a `test(244-06)` commit preceding its `feat(244-06)`
commit, in that order, in `git log`. No `refactor` commit was needed — the extraction rode inside
Task 3's GREEN, for the reason below.

### ⚠ The tasks were executed 3 → 1 → 2, and that is a deliberate deviation

The plan orders them 1 → 2 → 3. Executed in that order, **Task 1's commit would leave the shipped
chat cloud door broken** — the route starts requiring a body the composer does not send — and Task 2
would need the select-then-confirm modal Task 3 builds. Reordering removes both problems:

| after | state of the tree |
|---|---|
| **T3** | the composer no longer calls `importCloudFile` at all; the modal is rebuilt |
| **T1** | `importCloudFile` now requires a destination — and has **zero callers**, so nothing is broken |
| **T2** | the Library becomes its only caller, passing the body |

⛔ **There is no commit in history where a door a person can click is dead.**

## What shipped

### The chat half — `BUG-260905-01`'s *"anything in the chat should stay temporarily in that thread"*

- **A new route, `POST /threads/{id}/workspace/files/from-connection`.** It fetches the provider's
  bytes through the existing `fetch_cloud_file` seam and writes a `workspace_files` row under the
  same 24h TTL read gate a local attach gets. ⛔ **No `documents` row is minted at all.**
- ⭐ **The placement IS the guarantee.** It lives in `workspace.py`, which imports neither
  `import_single_file` nor `ingest_splice`. A module that never imports the minter cannot mint on
  *any* path — a property a future edit trips over, rather than a promise in a docstring. Fenced on
  the source, comment-stripped, and driven RED against a planted import.
- **The persist tail was extracted to `_persist_workspace_upload`**, which both doors call.
  `upload_template` keeps only the genuinely multipart-specific pre-read `file.size` check (WR-04).
  ⛔ Two writers is how a second door quietly grows a laxer gate; the provider's untrusted bytes and
  untrusted filename meet the *same* `validate_upload`, the same 10 MB cap and the same sanitiser.

### The composer — and the arm that was live until this commit

- `ConnectedFilePickerModal` **rebuilt** around select-then-confirm, with a source line and a
  cancel→confirm footer, in sketch 236's drawn order. It **no longer decides what a pick means**:
  it raises `onConfirm` and the caller commits.
- ⛔ **`MessageInput.tsx:850`'s `onFileImported` — which appended `Attached file: <name>` into the
  person's draft — is GONE, in the SAME COMMIT as the re-point.** `244-05` left it live on purpose
  so the cloud door would not be dead in between; this closes the obligation exactly as written.
  `useComposerAttachments` cannot reach `setValue` at all, which is the structural half.

### The Library half — *"the import should be from the Library, not from the chat"*

- `LibraryCloudImport` mounts **beside the existing upload button** and takes its destination from
  the page's own selection. ⛔ No second folder picker, ⛔ no second permission rule
  (`canUploadToFolder` arrives as a prop), ⛔ no forked file-picker vocabulary.
- ⛔ **It never refuses silently.** Every unavailable state renders its REASON as text, in a stated
  priority order (`noConnection` → `needsDestination` → `notYourFolder`), because a person with no
  connection cannot be helped by being told to pick a folder.
- **The refusal is the model's SHAPE.** `ConnectionFileImportRequest.folder_id` is a required `str`
  on `_StrictBase`, so FastAPI answers 422 **before the handler runs**. The hand-rolled
  `if not body.folder_id` was the rejected arm, and its absence is fenced.

## Measured verification

| Gate | Result |
| ---- | ------ |
| **Count gate** (`GSD_VITEST_MAX_WORKERS=2`, repo root, verdict read verbatim) | ⭐ `count gate OK` — **total 8189 · failed 0 · pinned total 7419 · 271/271 pinned files present, no per-file decrease** |
| Count-gate arithmetic | `8172 → 8189` = **+17**, exactly this plan's two suites (9 + 8). Pinned `7402 → 7419`, the same `+17`. Files `269 → 271`. **No residual.** |
| **Backend** (`pytest tests/unit -q --continue-on-collection-errors`) | **71 failed / 4621 passed / 2 xfailed / 2 xpassed / 0 collection errors** — exactly the v4.0 ceiling. `+19` passed = this plan's two backend suites (10 + 9) |
| Backend failing **SET** | **Identical by node id**, diffed as a set and not a count. ⚠ The one diff line is an artifact of the BASE capture: a `RuntimeWarning` was interleaved into `test_truncates_to_20_rows_with_note`'s line with no separator. Same test |
| **Typecheck** (`tsc -p tsconfig.app.json --noEmit`) | **67 errors**, the base count, and the error SET is unchanged — the only delta is two pre-existing `TS6133`s on `LibraryPage.tsx` whose LINE NUMBERS moved by 3 (my import block). No error names any file this plan created |
| `check-hot-file-ledger.cjs 244` | ⭐ **`ledger gate OK`** — it exited **1** at this plan's base naming `ConnectedFilePickerModal.tsx`, the last of C-8's nine. **The phase's ledger gate could not reach exit 0 without this plan, and now does** |
| `check-claude-md-size.cjs` | OK — **95,721 chars, 63.8% of limit** |
| Migrations | **none** — `git diff --name-only efcaa65e0..HEAD` contains nothing under `supabase/migrations/` (D-244-01, ROADMAP) |

**Targeted suites re-run and quoted:** `ConnectedFilePickerModal.thread.test.tsx` **9 passed** ·
`LibraryPage.cloudImport.test.tsx` **8 passed** · `ComposerAttach.composition.test.tsx` +
`MessageInput.connectors.test.tsx` + `ChatAttachmentChip.states.test.tsx` **38 passed** ·
the whole of `src/components/chat` + `MessageItem.test.tsx` **40 files / 435 passed** ·
`LibraryPage.tabAttention.test.tsx` (244-04's) **still green** · backend
`-k "connector or import_service or preview or workspace"` **239 passed**.

## Falsifications — every fence was driven RED against a planted defect

⛔ A fence nobody has seen fire is a presence assertion wearing a costume. Every file was restored
**md5-identical** after each plant.

| Fence | Plant | RED output | md5 restored |
| ----- | ----- | ---------- | ------------ |
| Modal Test 1 — the Library minter is not called from the chat | `importCloudFile` re-added to the composer's cloud callback | `expected "vi.fn()" to not be called at all, but actually been called 1 times` | `f50eb09abe2356c465d1a3cc48904f7d` |
| Modal Test 2 — the draft is byte-unchanged | the `Attached file: …` append restored | `expected 'what does this say about pricing\nAtt…' to be 'what does this say about pricing'` | same commit |
| Modal Test 7 — the ordered block | the cancel/confirm footer MOVED above the file list | `expected false to be true` | `4d9613e752594050a5f4e227086539db` |
| Modal Test 7 — single-select by COUNT | the list made range-selecting | `expected 2 to be 1` | same |
| Backend case 2 — no reach to the minter | `import_single_file` imported into `workspace.py` | `'import_single_file' appears in app/api/workspace.py — the CHAT's cloud door now has reach to the Library minter` | `3355f9cf9646876b52d2808f9efc4a77` |
| Backend case 5 — the exception ordering | the `SourceConnectionDisabled` arm moved BELOW the broad handler | `a control we applied reported as the provider's fault` / `assert 502 != 502` | same |
| Import route case 5 — the same ordering, on `connectors.py` | same plant | `assert 502 != 502` | `3aae759417cf5c4f75273b14b2a4fef8` |
| Import route cases 3 + 6b — the destination is REQUIRED | `folder_id` weakened to `str \| None = None` | `assert 200 == 422` and `` `folder_id` has a default `` | restored |
| Import route cases 1–4 (the RED drive) | the shipped route, unmodified | `assert 200 == 422` with body `{"id":"doc-1",…,"status":"processing"}` — **the minter RAN and the file landed at root** | n/a |
| Library door, all 8 cases | the shipped page, unmodified | `Unable to find an element by: [data-testid="library-cloud-import"]` ×6 + two source fences | n/a |

## ⚠ Findings — four of them cost real time and are recorded rather than tidied away

### 1. ⛔ `git checkout -- <file>` RESTORES FROM THE INDEX, AND THAT DESTROYED A FINISHED REWRITE

Restoring `ConnectedFilePickerModal.tsx` after a plant, I used `git checkout -- <file>` — the one
blanket-free form the executor charter explicitly sanctions. **It restored the file to the INDEX,
which still held the SHIPPED pre-rebuild version**, because the rebuild had never been staged. The
whole select-then-confirm rewrite was gone in one command.

It was recoverable — the file was rewritten from the content in this session and verified
**md5-identical** (`4d9613e752594050a5f4e227086539db`) to the pre-plant state — but the recovery was
luck, not design.

⛔ **The rule this yields: for a falsification plant, plant with an EDIT and revert with the inverse
EDIT.** Never reach for git to undo a plant on a file whose current content is not in the index.
Every subsequent plant in this plan used the edit/inverse-edit pair, and every one restored clean.

### 2. ⛔ A RED CAN BE RED FOR THE WRONG REASON — and it happened here exactly as wave 3 predicted

The first plant for the ordered-block fence **duplicated** the footer above the list instead of
moving it. The case went red with `Found multiple elements by: [data-testid="cloud-cancel"]` —
which is a failure **explainable without any reference to the reordering defect**. The plant was
re-done as a real move and the case then fired `expected false to be true`, which is the ordered
predicate actually failing.

⚠ This is `244-05`'s finding one level over (*"a plant that does not REACH the code proves
nothing"*) and the tell is identical: **if you can explain the red without mentioning the defect,
the plant has not driven the fence.**

### 3. ⛔ A LINE COUNT IS NOT AN OCCURRENCE COUNT

A source fence pinned `.folder_id` reads on `LibraryPage.tsx` at **5**, taken from `grep -n`'s five
matching LINES. The true figure is **7** — one line carries three occurrences
(`counts[d.folder_id] = (counts[d.folder_id] ?? 0) + 1`). The fence went red with
`expected 7 to be 5` on a correct implementation.

⚠ This is the same shape as `capture the SET, never a tail`, which this project already records:
**a count derived from the wrong unit is confidently wrong.** Corrected in the test body beside the
original, not over it.

### 4. ⚠ 11 SUITES WENT RED UNDER CONCURRENCY AND EVERY ONE WAS GREEN IN ISOLATION

Running `src/pages/__tests__` + `src/components/library` + `src/__tests__/library` together produced
**11 failures** across `LibraryPage.initialTab`, `LibraryPage.test`, `HealthTiles`,
`sketchComposition` and `SettingsPage.changedFields`. The procedure was followed: **filenames
captured before any re-run**, each checked against the diff, **the cap never touched**.

Every one was green run alone, and the full count gate read `failed 0`. ⭐ **The discriminator that
settled it is worth keeping:** these suites all MOUNT `LibraryPage`, and this plan added a component
to it that calls `listConnectorConnections` — which is precisely the `196-08` incomplete-mock-factory
failure mode. **But that failure is DETERMINISTIC** (the component throws at mount whenever the
export is missing), so a suite that is green alone cannot be suffering from it. The concurrency
signature plus green-in-isolation is what separates the two, not the colour.

⚠ Recorded as an observation, never as proof of innocence — one green sample proves nothing.

## Decisions made inside this plan

### ⭐ The G-5 seam was TAKEN, and the file SHRANK while gaining a feature

`244-05` grew `MessageInput.tsx` `643 → 855`, **refused** to write *"honoured by construction"*,
named the seam (`useComposerAttachments` + `ComposerChipsRow`) and recorded the rule: *"the next
plan whose `files_modified` names this file must propose the extraction FIRST."* This plan's
`files_modified` names it, so the rule bound.

| | before (`244-05`) | after (`244-06`) |
|---|---|---|
| lines | 855 | **821** |
| `useState` in this file | 6 | **4** |
| the cloud door | a callback that EDITED the person's draft | a 3-line delegate to the hook |

⚠ **The measurement that matters is the SIGN, not the size.** `-34` lines is small; what makes it a
discharge is that **the cloud door was added in the same commit and the file still went down**. A
third consecutive growth on a 15-phase file was the outcome the guardrail exists to prevent.

⛔ **Half the seam is STILL OWED and is named again rather than quietly dropped:**
`ComposerChipsRow`. Moving the chips row is a *layout* change whose blast radius runs through
`ComposerAttach.composition.test.tsx`'s DOM-order fences, and mixing it into a commit that also
re-points a door would make a red impossible to attribute. Re-open trigger recorded in
`deferred-items.md` item 5.

### The modal became generic, and the confirm word became a prop

One picker, two doors. `onConfirm` is raised and the caller commits — the composer attaches to the
thread, the Library imports into the selected folder. ⛔ The confirm word is **`Attach`** for the
chat (`D-244-23`: *"the confirm button is the last moment before the file exists"*) and
**`Import here`** for the Library. Two consequences — a file that lives in one conversation for 24
hours, and a permanent KB document — **must not share one word**, and it is fenced from both sides.

### `cloudSub` was ported BY SHAPE, not as a literal

The sketch writes `cloudSub: "From Google Drive · Meridian Supply"`, but `Meridian Supply` is the
authored connection name in `COPY.scenario` — fixture data, which `composerCopy`'s own docblock
already excludes from the port. The two nouns became parameters, and the fence became a
**reconstruction**: `COPY.a.cloudSub("Google Drive", "Meridian Supply")` must equal the sketch's
literal verbatim. That is the same treatment `REFUSE_TYPE` and `agentReadLine` already get.

### The provider noun comes from `service_id`, never the display name

The modal's source line reads `From Google Drive · <connection>`, and the provider half is derived
from `service_id`. ⛔ Reading a provider out of a connection's NAME is the fourth-leak shape Phase
238 measured in `import_service.fetch_cloud_file`, where a Microsoft connection someone had typed
*"Google migration"* into was read by the Google Drive adapter, with an OAuth token minted for
Microsoft. That mistake is not repeated in a cosmetic label.

### A quieter fix rode along, named rather than absorbed

`importCloudFile`'s failure path read `readConnectorReasonCode`, which parses only the CODED refusal
shape — so the server's plain-string `detail` was **dropped** and every caller saw the hard-coded
`"Failed to import cloud file"` instead of the sentence the server sent. That is the `probeMcpServer`
finding one function over. It reads `readConnectorFailure` now, so `S-4` (*the refusal is the
server's own words*) actually holds on this path. **Without this, Task 2's case 4 could not pass**,
which is how it was found.

## Hot-file ledger — what changed, and what is now owed

**Rows ADDED (absent, not new):**

| File | triple | note |
|---|---|---|
| `frontend/src/components/chat/ConnectedFilePickerModal.tsx` | `3 / 2 / 336` | ⚠ **absent for its ENTIRE LIFE**, and the ledger GATE is what found it — C-8's last `[no-row]` |
| `frontend/src/components/chat/useComposerAttachments.ts` | `1 / 1 / 158` | at creation |
| `frontend/src/components/library/LibraryCloudImport.tsx` | `1 / 1 / 194` | at creation |

**Stale triples CORRECTED — six**, each recorded beside its original:

| File | was | now |
|---|---|---|
| `backend/app/api/workspace.py` | `11 / 6 / 654` | `13 / 7 / 757` — ⚠ **stale ONE PLAN later, the fastest rot this ledger has recorded** |
| `frontend/src/pages/LibraryPage.tsx` | `45 / 14 / 955` | `46 / 15 / 970` — ⚠ also one plan later, the **fourth** consecutive stale reading |
| `frontend/src/components/chat/MessageInput.tsx` | `30 / 15 / 855` | `31 / 15 / 821` |
| `backend/app/api/connectors.py` | `41 / 19 / 2091` | `42 / 20 / 2102` |
| `backend/app/models/connector.py` | `24 / 13 / 772` | `25 / 14 / 800` |
| `frontend/src/lib/api/connectors.ts` | `16 / 10 / 718` | `17 / 11 / 740` |
| `frontend/src/components/chat/composerCopy.ts` | `1 / 1 / 93` | `2 / 1 / 103` |

⛔ **`backend/app/api/connectors.py`'s extraction is OWED for a THIRD landing running** —
`2051 → 2071 → 2091 → 2102`. This plan's eleven lines are honoured by construction *for those eleven
lines*, which is narrower than "the file is fine". The FOURTH landing must propose the split first;
recorded in `deferred-items.md` item 4.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] `importCloudFile` dropped the server's plain-string refusal**
- **Found during:** Task 2 (case 4 could not pass)
- **Issue:** the failure path read `readConnectorReasonCode`, which parses only `{reason_code,
  message}` — so a FastAPI `detail` sent as a bare string became the hard-coded client string.
- **Fix:** `readConnectorFailure`, matching `postPreview`. Also `encodeURIComponent` on both ids.
- **Commit:** `89b40f0c2`

**2. [Rule 2 — Missing critical] The new workspace route had no disabled-connection arm**
- **Found during:** Task 3
- **Issue:** the first draft caught everything broadly, so a connection WE had disabled would have
  read as a 502 *"failed to download cloud file"* — the `BUG-260907-03` failure mode, on a new door.
- **Fix:** an ordered `except SourceConnectionDisabled` arm answering **409** with
  `reason_code: connection_disabled`, driven RED by moving it below the broad handler.
- **Commit:** `556fc413c`

### Scope decisions recorded rather than silently taken

- **`backend/app/api/workspace.py` and `backend/app/models/workspace.py` are NOT in the plan's
  `files_modified`** and were modified. The plan's Task 3 says *"if the cleanest route needs a small
  backend addition, it is a thread-scoped workspace write, never a Library write; state the route
  you used"* — this is that route. It lives in `workspace.py` rather than `connectors.py` **because
  the placement is the guarantee**: `workspace.py` imports neither the minter nor the splice, and
  `connectors.py` imports both. Both files' ledger rows are updated in the same commit.
- **`backend/tests/unit/test_244_cloud_attach_is_thread_scoped.py` is NOT in `files_modified`** and
  was created — it is the backend half of Task 3, which the plan framed as frontend-only.
- **`frontend/src/components/chat/useComposerAttachments.ts` and
  `frontend/src/components/library/LibraryCloudImport.tsx` are NOT in `files_modified`** and were
  created. The first discharges `244-05`'s named G-5 debt (which the plan's own execution_context
  required be proposed first); the second exists so `LibraryPage.tsx` gained a MOUNT rather than a
  `listConnectorConnections` effect on a 15-phase file.
- **`frontend/src/lib/api/documents.ts` and `frontend/src/lib/api.ts`** were modified —
  `attachConnectionFileToThread`, the thread-scoped client the plan's own `key_links` names.
- **The tasks were executed 3 → 1 → 2** (see the table above). No commit leaves a shipped door dead.
- ⚠ **Task 3's backend fence was authored in the GREEN commit, not in the RED one.** The frontend
  RED was committed first and the backend route was designed alongside it, so
  `test_244_cloud_attach_is_thread_scoped.py` did not precede its implementation in `git log`.
  **It was driven RED by PLANT instead** — two plants, both quoted above, both restored
  md5-identical — which is this project's stronger standard, but it is a TDD ordering deviation and
  is stated as one rather than glossed.

## ⚠ Plan figures that did not hold, corrected beside the originals

| Plan said | Measured |
|---|---|
| `ConnectedFilePickerModal.tsx` is `2 / 1 / 235` | **`3 / 2 / 336`** — two phases (216, 232), and 336 lines after the rebuild |
| *"`grep -rn 'folder_id' frontend/src/pages/LibraryPage.tsx` shows no inline wire-shape literal"* | ⛔ **unsatisfiable on an untouched tree** — `folder_id` is a `Document` FIELD read there. The property meant (no `folder_id:` body KEY) holds and is fenced that way |
| `backend/app/api/workspace.py` ships **six** routes | **seven** after this plan (two POSTs, five GETs). Still **no DELETE** — the detach limit stands |
| Task 3 needs *"attributes plus a test"* | ⛔ already struck through in the plan at its revision pass, and confirmed: the modal composed in **none** of the drawn order, so this was an interaction-model change |
| Task 1 case 2 (no body) pins the requirement | ⚠ **it does not, alone.** Against a plant weakening the field, it stayed GREEN — FastAPI requires the body because the PARAMETER has no default. Cases 3 and 6b are what went red |

⛔ **This is the sixth plan-figure correction in the phase** (244-01, 244-02, 244-04, 244-05, and two
distinct ones here). **The rate has not slowed.**

## Known Stubs

**None.** Every surface this plan renders is wired to real data: the Library door posts a real
request with a real folder id, the modal lists real cloud files through the shipped client, both
refusal regions render the server's own thrown message, and the composer's cloud pick performs a
real thread-scoped upload.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-endpoint | `backend/app/api/workspace.py` | `POST /threads/{id}/workspace/files/from-connection` is net-new surface not in the plan's `<threat_model>`. Its dispositions: **auth** — `_verify_thread_ownership` (404 on non-owner, D-062-12 absence-not-refusal) plus `get_active_org_id` for the connection lookup; **content** — the provider's bytes and filename go through the SAME `validate_upload` + 10 MB cap + sanitiser the local door uses, with no second gate; **egress** — reuses `fetch_cloud_file`, which is already behind `app.security.egress` and the adapter registry; **privilege** — it writes only `workspace_files` for a thread the caller owns, and cannot reach `documents` because the module does not import the minter. A cross-org or unknown `connection_id` reads as **404**, never 403. |

## What this plan does NOT close

⛔ **`SHELL-04` does not close here**, and neither does `BUG-260905-01`. All three halves the
operator reported are built and fenced, but **no browser UAT was driven** and the
**8-row cross-provider board** in `244-VALIDATION.md` is owed, as are G-4's lived-experience rows.
`BUG-260905-01`'s `status:` therefore stays **`folded`** and `verified_closed_by:` stays **empty** —
⚠ `status:` frontmatter IS the index, and flipping it on a passing unit test is exactly how a bug
that still reproduces stops being looked for.

⚠ **Solo running (D-244-21): this is a SELF-VERIFICATION, not a review.** No independent reviewer
saw this code.

## Self-Check: PASSED

Created files verified present:
- `frontend/src/components/chat/useComposerAttachments.ts` — FOUND
- `frontend/src/components/library/LibraryCloudImport.tsx` — FOUND
- `frontend/src/components/chat/__tests__/ConnectedFilePickerModal.thread.test.tsx` — FOUND
- `frontend/src/pages/__tests__/LibraryPage.cloudImport.test.tsx` — FOUND
- `backend/tests/unit/test_244_cloud_attach_is_thread_scoped.py` — FOUND
- `backend/tests/unit/test_244_import_destination_required.py` — FOUND
- `.planning/phases/244-the-chat-shell-and-the-composer/244-06-SUMMARY.md` — FOUND

Commits verified in `git log efcaa65e0..HEAD`:
`86a1cd045` · `556fc413c` · `e7b10ddf6` · `52cdc7583` · `204f44ff2` · `89b40f0c2` — all six FOUND,
RED preceding GREEN in each pair.

⛔ **STATE.md and ROADMAP.md were NOT modified** — the orchestrator owns those writes.
