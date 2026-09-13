---
phase: 244-the-chat-shell-and-the-composer
plan: 05
subsystem: frontend
tags: [react, composer, attachments, sketch-port, tdd, vitest, zustand, dom-order-fence]

# Dependency graph
requires:
  - phase: 244-02
    provides: ".pdf accepted, WORKSPACE_ACCEPT_ATTR as a ?raw-fenced constant, sandbox hydration, the attachment system-prompt line"
  - phase: 244-03
    provides: "MessageItem.tsx's inline approval mount (the arm this plan renders beside)"
  - phase: 100-workspace-templates
    provides: "POST /threads/{id}/workspace/files, uploadWorkspaceTemplate's err.detail throw, expiryCaption's three readings"
  - phase: 216
    provides: "the composer's + menu, ConnectorsFlyout and ActiveConnectorChips"
provides:
  - "A two-door + menu in the drawn order, with the one-item case structurally correct"
  - "ONE attachment chip covering pending / sent / expired, its words PORTED from sketch 236"
  - "The scope word `this chat only` rendered by the SENT message — D-244-22's build obligation"
  - "A refusal region with the rejected FILENAME, the server's verbatim 422 and a working dismiss"
  - "An association rule derived from persisted data — no migration, no backend field, no client stamp"
  - "Ledger rows + sections for three files that had none; four stale triples corrected"
affects: [244-06, SHELL-04, chat composer, workspace_files, MessageItem, StreamsProvider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ORDERED-BLOCK composition fences asserted with compareDocumentPosition, never query order"
    - "Copy PORTED from a sketch's COPY.js and fenced ?raw as key:\"value\" pairs"
    - "Comment-STRIPPED source fences — prose about code is not code"
    - "zustand selectors that must return Object.is-comparable values (a joined string, not an object)"
    - "Pure store-read hooks beside the fetching ones, so a per-row consumer adds no traffic"

key-files:
  created:
    - frontend/src/components/chat/ChatAttachmentChip.tsx
    - frontend/src/components/chat/composerCopy.ts
    - frontend/src/components/chat/__tests__/ChatAttachmentChip.states.test.tsx
    - frontend/src/components/chat/__tests__/ComposerAttach.composition.test.tsx
  modified:
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/ActiveConnectorChips.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/chat/__tests__/MessageItem.capPaused.test.tsx
    - frontend/src/components/chat/__tests__/MessageItem.cancelledRun.test.tsx
    - frontend/src/components/chat/__tests__/MessageItem.continueButton.test.tsx
    - frontend/src/components/chat/__tests__/MessageItem.retry.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/phases/244-the-chat-shell-and-the-composer/deferred-items.md

key-decisions:
  - "The chips row was HOISTED into MessageInput, not slotted into ActiveConnectorChips — that component returns null on empty, so a slot would vanish the attachment chip for a person with no connector (D-244-26's one-item case)"
  - "Association is DERIVED from workspace_files.created_at x message.created_at, never a field stamped at send time: a client-only field passes every test and fails the requirement the next day"
  - "usePrecedingUserTurns returns a JOINED STRING, not an object — a zustand selector compares with Object.is and MessageItem is React.memo'd per row"
  - "ConnectorsFlyout was NOT re-labelled to carry the sketch's word: its header is asserted verbatim by a shipped suite, and breaking a guard to make a guard pass is not a trade"
  - "types/index.ts was NOT touched (0 0) — formatBytes already answers the size label"
  - "MessageInput's extraction is OWED and NAMED, not taken: an extraction in the same commit as a feature mis-attributes the refactor's blast radius"

patterns-established:
  - "A RED can be red for the WRONG REASON and prove as little as a green — re-drive it once the harness is right"
  - "Adding an export to a module covered by PARTIAL mock factories is a blast radius, and tsc cannot see it"
  - "A source fence over code must strip comments first, or a docblock explaining the rule trips the rule"

requirements-completed: []

# Metrics
duration: ~150min
completed: 2026-09-12
---

# Phase 244 Plan 05: The Composer's Local Attach Door — Summary

**A person picks a file off their hard drive from the composer's `+`, sees a chip that says
`this chat only · 24h` before they send — and that sentence rides into the transcript, where it is
still true tomorrow.**

## Performance

- **Duration:** ~150 min
- **Tasks:** 3 of 3, each TDD (`test(244-05)` RED commit → `feat(244-05)` GREEN commit)
- **Files:** 17 (4 created, 13 modified)
- **Base:** `a43a32ec0` (waves 1 + 2 merged), asserted before the first edit

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 1 — the chip: one component, three states, ported copy | `e0011095f` | `3b7f55231` |
| 2 — the `+` menu, the hoisted chips row, the server's refusal | `7efec924f` | `31e0d999f` |
| 3 — the scope word survives into the transcript | `ee8f57a33` | `ab6e07453` |
| 3b — D-244-23's forbidden word, fenced on the rendered menu | — | `a4f3959df` |

**TDD gate compliance:** every task has a `test(244-05)` commit preceding its `feat(244-05)`
commit, in that order, in `git log`. No `refactor` commit was needed.

## What shipped

- **Two doors in the drawn order** — `Attach a file` → `From cloud storage` (still
  `hasCloudStorage`-gated) → `Tools and connectors`. ⚠ The divider previously wrapped the cloud
  item **alone**, so hiding it left a dangling rule; the border belongs to the group now, and the
  group is never empty because the local door is never gated. **D-244-26's one-item case is fixed
  structurally, not by a second condition.**
- **ONE chip, three states.** `pending` (icon · name · size · scope · TTL · remove), `sent`
  (read-only, **still carrying `this chat only`**), `expired` (struck through,
  `No longer available`, with the WHY as its `title`). `expired` is **derived** from `expires_at`
  using `FilesSection.expiryCaption` — **imported, not re-derived**, so the panel and the chat
  cannot disagree about what an absent value means.
- **A refusal region with three atoms in document order** — the rejected FILENAME → the server's
  verbatim 422 → a dismiss control labelled `OK`. All three are drawn in the approved mockup
  (`index.html` § `refuseHTML`), so none was available to rule out.
- **The scope word in the transcript**, above the user's text, plus the agent's one-line
  `Read <file>` pointer.
- **`composerCopy.ts`**, a port of `COPY.a` + `COPY.shared` + `COPY.engine`, fenced `?raw` against
  the sketch's own `COPY.js` as `key: "value"` pairs. ⛔ `COPY.b` is deliberately **not** ported.

## Measured verification

| Gate | Result |
|---|---|
| **Count gate** (`GSD_VITEST_MAX_WORKERS=2`, repo root) | ⭐ `count gate OK` — **total 8172 · failed 0 · pinned total 7402 · 269/269** |
| Count-gate arithmetic | `8143 → 8172` = **+29**, exactly this plan's two suites (10 + 19). **No residual.** Pinned `7373 → 7402`, the same `+29` |
| ⚠ The two INHERITED SEED-171 reds | **GREEN on this run** (`failed 0`). ⛔ Recorded as an observation, never as proof of innocence — one green sample of a flaky suite proves nothing |
| **Backend** (`pytest tests/unit -q --continue-on-collection-errors`) | **71 failed / 4602 passed / 2 xfailed / 2 xpassed** — exactly the v4.0 ceiling, unchanged |
| **Typecheck** (`tsc -p tsconfig.app.json --noEmit`) | **67 errors**, identical to the base count. No error names any file this plan created; the two naming `MessageInput.tsx` / `MessageInput.connectors.test.tsx` are pre-existing `TS6133`s on lines this plan did not author |
| `check-hot-file-ledger.cjs 244` | The three files this plan owns now have rows. The one remaining `[no-row]` is `ConnectedFilePickerModal.tsx` — **244-06's, by the C-8 ownership map** |
| `check-claude-md-size.cjs` | OK — **94,830 chars, 63.2% of limit** |
| Migrations | **none** — `git diff --name-only` over the whole plan contains zero `.py`, zero `.sql` and nothing under `supabase/migrations/` |

**Shipped suites re-run and quoted:** `MessageInput.connectors.test.tsx` **9 passed** (BASELINE 5,
no decrease) · `FilesSection.test.tsx` **28 passed** (pinned 22) · **fifteen** `MessageItem` suites
**124 passed**.

## Falsifications — every fence was driven RED against a planted defect

⛔ A fence nobody has seen fire is a presence assertion wearing a costume. Every file was restored
**md5-identical** after each plant.

| Fence | Plant | RED output | md5 restored |
|---|---|---|---|
| Chip Test 2 — the SENT chip carries the scope word | scope span gated on `pending` | `AssertionError: expected null not to be null` | `c83330e2bb38628b9f431e6f85d3011e` |
| Composition Test 4 — the hoisted row | **the FORBIDDEN arm actually built**: a `children` slot inside `ActiveConnectorChips`, container + label restored | `Unable to find an element by: [data-testid="chat-attachment-chip"]` | `75ac2afcd28bf03920e8c2bcd9c6b0ed` · `f45dfe40c32361955a171c44ac36b01a` |
| Composition Tests 6b / 6c — the refusal's atoms | a SENTENCE-ONLY refusal (filename + dismiss deleted) | `expected null not to be null` · `expected <div role="alert" …> to be null` | `f45dfe40c32361955a171c44ac36b01a` |
| Composition Tests 10 / 11 — the sent chip | the chip block deleted from the user row | `Unable to find an element by: [data-testid="chat-attachment-chip"]` ×2 | `bab2a9868f07b37d2e29766d95574eed` |
| Composition Test 12 — the agent pointer | the pointer block deleted | `Unable to find an element by: [data-testid="agent-read-pointer"]` | `bab2a9868f07b37d2e29766d95574eed` |
| Composition 12b / 12c / 12d — the association edges | the detach / `kind` / upper-bound conditions deleted | `expected <span …> to be null` ×3, each on its own removed condition | `0b092b18f2cf83756f1d2213c9f36306` |

## ⚠ Findings — three of them cost real time and are recorded rather than tidied away

### 1. ⛔ A RED CAN BE RED FOR THE WRONG REASON, AND THEN IT PROVES AS LITTLE AS A GREEN

Task 3's first RED for Tests 10/11/12 looked textbook: three cases failing with
`Unable to find an element by: [data-testid="chat-attachment-chip"]`. **It was not the build's
absence that made them fail — it was the harness.** The suite seeded the store through
`useStreamsStore.getState().actions.replaceWorkspaceFilesForThread(...)`, and `streamsStore.ts`
**initialises `actions` as NO-OP STUBS** that only `StreamsProvider` replaces **on mount**. These
suites render chat components bare, so the seeding silently did nothing; the cases would have gone
red over a perfectly correct implementation.

**Found by the build staying red after it was written**, not by reading the store. Seeding moved to
`useStreamsStore.setState` and **every plant in Task 3 was re-driven from scratch** against the
fixed harness — which is the row set in the table above.

⚠ This is the exact shape of wave 1's *"a falsification plant that does not MOUNT proves nothing"*,
one level up: **a plant that does not REACH the code proves nothing either.** The tell is the same
in both cases — the assertion fails for a reason you can explain without reference to the defect.

### 2. ⛔ ADDING AN EXPORT TO A MODULE COVERED BY PARTIAL MOCK FACTORIES IS A BLAST RADIUS — AND `tsc` CANNOT SEE IT

`MessageItem` gained two `@/providers/StreamsProvider` reads. **Four shipped suites went red at
MOUNT** — `MessageItem.capPaused` / `.cancelledRun` / `.continueButton` / `.retry` — because each
mocks that module with a factory declaring only `useWorkflowLockForThread`, leaving the new hooks
`undefined`.

This is the **`196-08` failure mode verbatim** (*"nine `WorkflowBuilderPage`-mounting suites threw
at mount because their `@/lib/api` mock factories did not declare a newly-added export"*), which
CLAUDE.md already records — and it fired again, on a different module, in a different phase.
⛔ **The fix is to DECLARE the exports in each factory**, never to make the component tolerate
`undefined` hooks: that would hide the next one.

⭐ **And it was RED, not FLAKE, and the procedure is what said so** — the failing files were
captured before any re-run, each was checked against `git diff --numstat`, and the cap was never
touched.

### 3. ⛔ PROSE ABOUT CODE IS NOT CODE — in BOTH directions

- **Direction A (this plan):** `ChatAttachmentChip.states.test.tsx` Test 6 went red on a *correct*
  implementation, because `not.toContain("dangerouslySetInnerHTML")` matched **the docblock
  sentence explaining why the file has none**.
- **Direction B (244-02's finding, the mirror):** *"a source fence that reads prose can be made to
  LIE by its own docstring."*
- ⚠ **And the self-refuting claim:** the chip's first docblock asserted *"`grep -c 'this chat only'`
  on this file is 0"* — **which it was not, because the assertion contained the sentence.**

All three collapse to one rule, now executable: **strip comments before asserting on source, and
anchor on a non-vacuity marker first** so an over-eager stripper cannot make the case pass over
nothing. Test 5a does exactly that.

## Decisions made inside this plan

### The chips-row ruling — HOIST, and the wrong arm is measurably wrong

D-244-26 says the chip is *"a sibling of the connector chip, not a new region"*. Three arms existed;
a `children` slot inside `ActiveConnectorChips` is the obvious one and it is **wrong for a measured
reason**: that component `return null`s when nothing is armed, so the attachment chip would
**vanish for a person with no connector** — the exact one-item case the decision orders checked.
The row container, its `Using:` label and `data-testid="active-connector-chips"` moved into
`MessageInput`; the component is bare chips now. ⭐ The ruling has an executable form (Test 4,
driven RED against the forbidden arm **actually built**, not simulated).

### The association rule — derived from persisted data, stated and fenced

> **An upload belongs to the FIRST user message sent at or after it.** For user message `M` with
> predecessor user message `P`: `P.created_at < file.created_at <= M.created_at` (unbounded below
> if `M` is first), the file is `kind === "template_input"`, and it is not detached.

⛔ **Why not a field stamped at send time:** it would satisfy every test in this repository and
**fail the requirement the next day**, because a database-loaded message carries no such field —
and *"reopening the chat tomorrow, the transcript still says `this chat only`"* **is** the
requirement D-244-22 chose variant A for. ⛔ **Why not a backend field:** D-244-01 and the ROADMAP
both say `Migrations: none expected`.

**Boundary choices, both deliberate:** the upper bound is INCLUSIVE so a file and a message written
in the same millisecond associate rather than falling to the next message (the file's `created_at`
is Postgres-stamped, an optimistic message's is client-stamped — skew is real here); the lower
bound is EXCLUSIVE so one file cannot land on two rows. An UNPARSEABLE predecessor is **not**
treated as "no predecessor" — that would widen the window and hand the row every earlier attachment
in the thread.

**The edge case the plan asked to fence** — *an attachment uploaded then removed before send must
appear on no row* — is Test 12b, driven RED. Two further edges are fenced beside it: an
agent-written workspace file (12c) and a still-pending upload (12d).

### ⚠ Remove is a DETACH, not a DELETE — and the limit is stated, not hidden

**Measured:** `backend/app/api/workspace.py` ships **six** routes — one `POST /files` and five GETs
— and **no DELETE**. So removing a chip cannot un-upload the file: the bytes stay in
`workspace_files` inside the 24h read gate and are still hydrated into `/sandbox/attachments/` by
`244-02`. What removal can honestly mean is *this file is not part of the message I am about to
send*, carried by a session-scoped detach registry.

⛔ **Its limit:** after a hard reload, within the TTL, a detached file falls back inside the window
and re-associates with the next sent message. ⛔ **Do not close this with a persisted client-side
hide** — that would claim the bytes are gone when they are not, which is the one dishonesty this
whole surface exists to remove. **Re-open trigger:** any plan adding
`DELETE /threads/{id}/workspace/files/{file_id}`. Recorded in `deferred-items.md`.

### ⛔ `ConnectorsFlyout` was NOT re-labelled, and the cost is recorded

Sketch 236's third item is `Tools and connectors`. The shipped flyout **inlines** the connectors
panel rather than being a door, and its own header reads `Connectors` — asserted as an **exact
full-string match** by `MessageInput.connectors.test.tsx` (BASELINE 5). Renaming a shipped surface
so a NEW fence can pass is **breaking a guard to make a guard**. A section label above the flyout
carries the sketch's word instead, and the resulting double heading is logged in
`deferred-items.md` with `244-06` named as its natural home.

## G-2 disposition, stated explicitly (D-244-18)

⭐ **G-2 is DISCHARGED for this surface and fires on nothing else in this phase.** Sketch 236,
winner **A — Scope on the chip** (operator, 2026-09-11), was the acceptance bar and the
`index.html` mockup was read for every block. ⛔ `SHELL-05`'s signal is **not** sketched because it
already shipped (Phase 235 plan 09, F-1); `SHELL-01/02/03` are bug fixes on shipped surfaces with
named causes and need none. Said plainly rather than sketching everything or nothing.

## Hot-file ledger — what changed, and what is now OWED

**Rows ADDED (absent, not new):** `ActiveConnectorChips.tsx` (`2 / 2 / 82` — absent its **entire
life**), `ChatAttachmentChip.tsx` (`1 / 1 / 144`, at creation), `composerCopy.ts` (`1 / 1 / 93`, at
creation).

**Stale triples CORRECTED — four of them**, each recorded beside its original:

| File | was | now |
|---|---|---|
| `FilesSection.tsx` | `8 / 5 / 334` | `10 / 6 / 363` |
| `MessageInput.tsx` | `29 / 14 / 643` | `30 / 15 / 855` |
| `MessageItem.tsx` | `70 / 34 / 803` | `71 / 37 / 904` |
| `StreamsProvider.tsx` | ⚠ `90 / 36 / 4380` in the detail file and `90 / 36 / 4435` in CLAUDE.md — **two different figures for one file in two registers** | `94 / 38 / 4528` |

⛔ **`MessageInput.tsx` GREW `643 → 855` and A SEAM IS NOW OWED — this is NOT "honoured by
construction" and saying so would be the rot this ledger exists to stop.** The named seam is
written into the ledger: `useComposerAttachments(threadId)` + a `ComposerChipsRow` container.
⚠ **It was not taken here deliberately** — an extraction in the same commit as a feature
mis-attributes the refactor's blast radius to the feature. **The next plan whose `files_modified`
names this file must propose the extraction FIRST** (the `retrieval_service.py` / SEED-224 rule).

✅ `MessageItem.tsx`'s 227-03 discharge is **still intact, measured not asserted**: `useState`
3 → 3, `useEffect` 0 → 0, `Props` 5 → 5. Two pure store reads, no fetch, no prop.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] Four suites red at mount on incomplete `StreamsProvider` mock factories**
- **Found during:** Task 3
- **Issue:** `MessageItem.capPaused` / `.cancelledRun` / `.continueButton` / `.retry` each mock
  `@/providers/StreamsProvider` with a factory declaring only `useWorkflowLockForThread`; the two
  new hooks resolved `undefined` and the component threw at mount (15 cases red).
- **Fix:** declared `useWorkspaceFilesSnapshot` and `usePrecedingUserTurns` in each factory, with
  the `196-08` reference written into the comment. No case count changed.
- **Commit:** `ab6e07453`

**2. [Rule 1 — Bug] A real layout regression on the user row, caught by a shipped fence**
- **Found during:** Task 3
- **Issue:** the first draft replaced the user row's `flex justify-end` with
  `flex flex-col items-end`; `src/__tests__/components/MessageItem.test.tsx`'s *"aligns user message
  to the right (justify-end)"* went red.
- **Fix:** the outer row is byte-unchanged; stacking moved into a new inner wrapper.
- **Commit:** `ab6e07453`

**3. [Rule 1 — Bug] A source fence tripped by its own subject's docblock**
- **Found during:** Task 1
- **Issue:** `not.toContain("dangerouslySetInnerHTML")` matched the chip docblock's explanation of
  why the file has none; and the docblock's `grep -c` claim was self-refuting.
- **Fix:** a `code()` helper strips comments before every source assertion, anchored on a
  non-vacuity marker; the docblock no longer contains the sentence it is about.
- **Commit:** `3b7f55231`

### Scope decisions recorded rather than silently taken

- **`frontend/src/providers/StreamsProvider.tsx` is NOT in the plan's `files_modified`** and was
  modified. Two exported **selectors**, no state and no effect. The alternative — reading
  `useStreamsStore` directly from `MessageItem` — violates D-068-03; the other alternative,
  threading an array prop from `MessageList`, breaks `MessageItem`'s `React.memo`. Its ledger row
  is updated in the same commit.
- **`frontend/src/components/panel/FilesSection.tsx` is NOT in `files_modified`** and was modified:
  **two `export` keywords, zero body change**, so the chip IMPORTS `expiryCaption` rather than
  duplicating its three readings — which the plan's own action text required.
- **Four `MessageItem.*.test.tsx` suites are NOT in `files_modified`** and were modified — mock
  factory declarations only, deviation 1 above.
- **`frontend/src/types/index.ts` was NOT touched** (`git diff --numstat` → no entry). The plan
  allowed at most one optional field; none was needed, because `lib/formatBytes` already answers
  the size label.

## ⚠ Plan figures that did not hold, corrected beside the originals

| Plan said | Measured |
|---|---|
| *"`grep -c 'workspaceAllowedExt' docs/HOT-FILE-LEDGER.md` is exactly **1**"* | **6** at base, because the string appears in five prose sentences. ⛔ The criterion as written could not pass on an untouched tree. **The property it means** — *exactly one SCAN-LIST ROW names the file* — holds: `grep -c '^| \[`…workspaceAllowedExt.ts`\]'` = **1**, no `[duplicate-row]` |
| *"`MessageItem.tsx` … a 69/33-phase hot file"* | **71 / 37 / 904** |
| *"`MessageInput.tsx` measured 29/14/643 at discuss"* | correct at discuss; **30 / 15 / 855** after this plan |
| The plan's execution_context expects base `1ff80a1da` **or a descendant** | base asserted at **`a43a32ec0`**, a descendant with waves 1+2 merged, per the orchestrator's instruction |

⛔ This is the fourth plan in the phase to find a plan figure wrong by measurement (244-01, 244-02,
244-04, and now this one). **The rate has not slowed.**

## Known Stubs

**None.** Every surface this plan renders is wired to real data: the chip reads a real
`WorkspaceFile` row, the refusal renders the server's own thrown message, the menu's local door
performs a real upload through the shipped client, and the transcript chip is derived from the
thread's persisted workspace files.

## What this plan does NOT close

⛔ **`SHELL-04` does not close here.** Its driven rows — including the **8-row cross-provider
board** for D-244-02's system-prompt line — are in `244-VALIDATION.md`. This plan shipped the
surface and its fences; **no browser UAT was driven**, and G-4's lived-experience rows are owed.

⛔ **The cloud door is `244-06`'s.** This plan only re-labelled and re-ordered the menu item that
opens `ConnectedFilePickerModal`; it did not touch the modal or the cloud client.

⚠ **`244-06` MUST replace `ConnectedFilePickerModal.onFileImported`** (`MessageInput.tsx`), which
still appends `Attached file: …` into the composer draft — the arm D-244-02 rejects. **This plan
deliberately left it live rather than half-removing it**, because removing the text edit without
the cloud re-point would leave the cloud door doing nothing at all. ⛔ The two behaviours must not
both ship: **244-06 removes the text edit in the same commit as the re-point.**

## Self-Check: PASSED

Created files verified present:
- `frontend/src/components/chat/ChatAttachmentChip.tsx` — FOUND
- `frontend/src/components/chat/composerCopy.ts` — FOUND
- `frontend/src/components/chat/__tests__/ChatAttachmentChip.states.test.tsx` — FOUND
- `frontend/src/components/chat/__tests__/ComposerAttach.composition.test.tsx` — FOUND
- `.planning/phases/244-the-chat-shell-and-the-composer/244-05-SUMMARY.md` — FOUND

Commits verified in `git log a43a32ec0..HEAD`:
`e0011095f` · `3b7f55231` · `7efec924f` · `31e0d999f` · `ee8f57a33` · `ab6e07453` · `a4f3959df`
— all seven FOUND, RED preceding GREEN in each pair.
