# WIRE — the run surface + the run panel parts

**Scope:** every row marked `FE-WIRING` in `AUDIT-run-arrival-connections.md`'s
`run-surface.html` (9) and `run-panel-parts.html` (6) sections, plus `PORT-canvas.md`'s one
real gap. No backend work. Reference is the two SHEETS; `200-CHECKLIST.md` and `index.html`'s
`JOURNEY` array were **not** consulted.

**Tally: DONE 13 · BLOCKED 3 · NOT TAKEN 0** (15 audit rows + the canvas port's `live` seam,
which is split — page half DONE, canvas half BLOCKED).

Base: `060ab74d`. Commits: `0cf55f41`, `7a46467a`, `f771abff`.

---

## The headline finding: `run-panel-parts` is **NOT** entirely a mounting problem

The dispatch's premise was that every part is already built and simply needs mounting. Half of
that is true and the other half is not, and the difference is what shaped the whole plan.

`PhaseTimeline` takes `threadId` **as a prop** and has since Phase 094. `PendingAskCard` takes
`ask` + `reconcile` + `runIsOver` **as props**. Those two really were pure mounting problems.

**`WorkspacePanel` — the shell — is not.** It resolves its thread from the globally-viewed-thread
selector, a zustand singleton whose only production writer is `ChatArea`. Mounting the shell on
the run page therefore requires either

- **(a)** the page writing chat state, which `WorkflowRunPage.tsx`'s own CR-02 docblock
  **explicitly refuses** — *"opening a run writes no chat state, the same rule this surface
  already keeps from the reading side by never resolving the globally-viewed thread"*, and which
  is why that surface arms its SSE subscription by calling the store `reconcile` **directly**
  rather than through `setViewingThread`; or
- **(b)** re-parameterising the shell **and five children** (`FilesSection`, `TodosSection`,
  `PendingAskStack`, `TemplateUpload`, `BatchResultList`) to take an explicit thread — a
  cross-surface change whose blast radius is **chat**.

⚠ **And the shell would have brought the previewer with it** (rule 4). `FilesSection` drills into
`FilePreview` on row activation; there is no flag to suppress it. So mounting the shell would have
smuggled the previewer onto the run surface behind a section header, exactly as the dispatch
warned.

**How it was resolved:** mount the two PARTS, not the shell.
`FilesSection` is never mounted, so **the no-previewer fence holds by construction** — no
suppression flag was added, no cross-surface prop was added, and chat is byte-unchanged. The run
page already holds `asks` / `reconcileAsks` (fetched since F5 for the `waiting-for-you` reading),
so the panel opens **no new request**.

---

## `run-surface.html` — 9 FE-WIRING rows

| # | Row | Verdict |
|---|---|---|
| 1 | Centre **transcript region** | **BLOCKED** |
| 2 | Transcript line — completed/emphasised | **BLOCKED** |
| 3 | Transcript line — in-flight/dim | **DONE** (reaches the run surface; not as a transcript line) |
| 4 | Transcript line — violet attention flag | **DONE** (reaches the run surface; not as a transcript line) |
| 5 | Transcript line — active with spinner | **DONE** (reaches the run surface; not as a transcript line) |
| 6 | **Right-hand panel** on the run surface | **DONE** |
| 7 | Step node — needs review, raised card in a spine | **DONE** |
| 8 | Violet left indicator bar on the active step | **DONE** |
| 9 | **"Approve" button inline in the spine** | **DONE**, with a recorded refusal |

### 1 · 2 — the centre transcript: **BLOCKED**, and it is a composition decision, not a wiring gap

`getMessages(threadId)` ships and the page holds `run.thread_id`, so the *data* is reachable. The
blocker is what the sheet does with it: it draws the transcript as the **CENTRE** of the run
surface, in the slot the shipped page gives to `WorkflowCanvas`.

Three things make that a decision rather than a wiring task:

1. **`WorkflowCanvas` was ported into that exact slot structure-for-structure, in this same phase,
   by a sibling agent** (`PORT-canvas.md`, four commits). Replacing it is undoing that work.
2. **Adding the transcript *beside* it gives the page FOUR readings of one run** — canvas,
   transcript, `RunReceipt` (which is already *"the same spine above, re-read in the PAST
   TENSE"*), and the deliverables list. The surface's own history is a warning here: the run band
   was made `sr-only` in 2026-08-06 precisely because the page showed its status **twice**, one
   line under the other, and the operator reported it.
3. **The sheet's per-line `mm:ss` gutter is `BE-NEEDED` on the same sheet** (`ToolCall.startedAt`
   is a client `Date.now()`, *"undefined for tool calls loaded from DB"*). So the transcript the
   sheet draws cannot be rendered as drawn from this page's data anyway.

**What it needs:** an operator/orchestrator decision on whether the run surface's centre is the
canvas or a transcript — they cannot both be the centre. Rows 1 and 2 are held for that.

⚠ **Row 3, 4 and 5 are marked DONE and the qualifier is not decoration.** The CAPABILITY each row
names now renders on the run surface for the first time — the in-flight sub-step phrasing
(`SUBSTEP_META`), the awaiting-review state, and the active-with-spinner shape all arrive with the
mounted spine and ask card. **What does not exist is the sheet's transcript LINE placement**, which
is rows 1-2's blocked decision. A verifier reading `DONE` here should look in the right-hand
panel, not in a centre column.

### 6 — the right-hand panel: **DONE**

`WorkflowRunPage.tsx` — the canvas region is now a flex row: canvas (`flex-1`) + an
`<aside data-testid="run-panel" aria-label="Run steps">` at 320 px, `hidden lg:flex`. It carries
the ask stack (newest-first, the same ordering rule `PendingAskStack` keeps) above
`<PhaseTimeline threadId={run.thread_id} />`.

⚠ **The thread is the RUN's, asserted rather than assumed.** The suite's `VIEWED_THREAD_ID` decoy
is a live value in these tests, so a spine fed from the chat singleton would render somebody
else's steps while looking entirely correct. Pinned:
`expect(spine.getAttribute("data-threadid")).toBe(RUN_THREAD_ID)` **and** `.not.toBe(VIEWED_THREAD_ID)`.

⚠ **Two fences went RED on the first draft and both were RIGHT.** The mount docblock explained why
it does **not** mount the panel file list, the previewer or the viewed-thread selector — and in
explaining, it **named all three**. Both fences sweep this file's `?raw` source, and **a source
fence cannot tell prose from code**. Reworded to describe the mechanisms without spelling them;
**neither fence was re-baselined**, because the code genuinely does none of those things. (Same
class as `PORT-canvas.md`'s *"sibling ids are now described, never spelled"*.)

### 7 · 8 — needs-review raised card, violet active bar: **DONE**

Both are `PhaseCard`'s, reached through the mounted `PhaseTimeline`. Nothing in either component
was edited — they were only ever unreachable from this surface.

### 9 — "Approve" in the spine: **DONE**, and here is what was deliberately NOT built

The ask card now renders on the run surface, and its `options[]` render as a `role="radiogroup"`
of chips. An ask authored with `options: ["Approve this step", "Do not run it"]` — the shipped
test fixture, verbatim — now puts an Approve control on the run surface. That is the row.

⚠ **No hardcoded "Approve" label was added to the submit button, and that is a refusal rather than
an omission.** The shipped primary is `Send Answer`. Renaming it `Approve` would make **every**
ask on **every** surface claim approval semantics, including free-text asks that approve nothing.
The word belongs to the ask's author, not to the card.

⚠ **`runIsOver` is the page's own `isTerminal`, not `PendingAskStack`'s two-hook derivation.** This
surface holds the run row itself, which is the stronger source. Pinned both ways: an `active` run
reads `false`, a `cancelled` one reads `true` — a stopped run must not offer a control that would
post into it.

---

## `run-panel-parts.html` — 6 FE-WIRING rows

| # | Row | Verdict |
|---|---|---|
| 1 | "Reason" field label (visible) | **DONE** |
| 2 | "Approve" primary button | **DONE**, with the refusal above |
| 3 | Per-row relative time (`2m ago`) | **DONE** |
| 4 | Per-row `time unknown` (dimmed absent arm) | **DONE** |
| 5 | Copy control on the preview | **DONE** |
| 6 | Line-number gutter in the diff | **DONE** |

### 1 — the free-text label is visible

It shipped `sr-only`, so assistive tech was told what the box was for and **a sighted user was
told nothing** — the same asymmetry `PORT-canvas.md` found on the plane's end cap.

⚠ **TWO ARMS, both honest.** With options present, the choice is the answer and this box is the
supporting sentence beside it — the sheet's `Reason`, which is what it draws it next to. With **no**
options (the D3 no-options case) this box **is** the answer, and calling it a reason would mislabel
the only control on the card. The shipped `Type an answer` is kept verbatim for that arm.
Still `htmlFor`-tied, so the accessible name **is** the visible text.

⚠ **A pin moved and was re-baselined IN PLACE, never to hide anything.**
`PendingAskCard.retired.baseline.test.tsx`'s exact line pin: `630` → `650`. Both prior figures
(`487`, `630`) and the reason are kept beside it. `+20 lines, NINETEEN of them the reasoning
comment` — the code change is a **single JSX line**. The three retirement-sentence fences that pin
sits beside are **untouched and all three passed on the same run**, which is what says the edit did
not disturb what that file actually guards. The pin stays EXACT rather than relaxed to a range.

### 3 · 4 — the row's age, and the NAMED absence

`fileAgeLabel(createdAt, now)` in `fileRowUtils.ts`; an optional `age` prop on `FileRow`; wired
from **both** callers (the panel list and the run page's deliverables).

⚠ **NO FOURTH RELATIVE-TIME FORMATTER.** `relativeChanged.ts` opens by counting the three
spellings already in this repository and stating that a new one which does not say why the
existing ones cannot serve reads as drift. So `fileAgeLabel` **calls** `relativeBand`, for the two
reasons that module's own docblock uses to separate its audiences: a file row is read **once, in
passing** (the long-form register, not the compact `4mo ago` instrument-table one), and
`relativeBand` **returns `null` for an absent instant rather than inventing a phrase** — which is
exactly the contract this row needs and is the half the two compact spellings do not have. The
file list and the library card can now never disagree about what *"last week"* means.

⚠ **THE ABSENCE ARM IS LOAD-BEARING, NOT COSMETIC.** A live SSE deliverable carries **no**
`created_at` at all, and `byNewestFirst` sorts exactly that row **FIRST** — so the top row of a
live run's file list is precisely the row that renders the word. It reads `time unknown`, dimmed:
never a dash, never an empty cell, never a fabricated `just now`. Same shape the panel already
keeps one field along (*"the word is `expiry unknown`, never `no expiry`"*).

⚠ **`age` is OPTIONAL and omitting it renders NO cell — a THIRD state.** `undefined` = this surface
does not show a time; a phrase = the instant, worded; `TIME_UNKNOWN` = the wire said nothing.
Folding the first into the third would push *"time unknown"* onto surfaces that never asked for a
clock, and it keeps every pre-existing caller byte-identical.

⚠ **ONE instant per render, hoisted in both callers.** 100+ rows each taking the `Date.now()`
default can straddle a band boundary mid-render, and two rows stamped a millisecond apart reading
a band apart is a difference a person notices and cannot explain. Same rule `WorkflowsPage.tsx`
follows for `cardFace(row, now)`.

### 5 — the copy control

`grep -rn "clipboard"` across the panel and chat trees returned **0**: no preview and no code block
had any way to get text out except selecting it by hand.

⚠ **It renders over the four INLINE arms ONLY.** The `default` (no-preview) arm returns early
before the wrapper — an offer to copy *"the content"* there would copy nothing.

⚠ **THE FAILURE ARM IS NOT OPTIONAL.** `navigator.clipboard` is undefined outside a secure context
and its write **rejects** when the document is not focused. A control that silently no-ops there is
worse than no control: the person walks away believing they hold the text. So the guard is
explicit, the promise is caught, the button reports `Copy failed`, and a `role="status"` region
carries the outcome to a screen reader.

⚠ **A test-harness trap worth not rediscovering: `userEvent.setup()` INSTALLS ITS OWN
`navigator.clipboard` stub.** A spy planted *before* `setup()` is silently replaced, and the
assertion then measures user-event rather than the component. Measured, not predicted — the first
draft read `expected "vi.fn()" to be called with [ 'the whole file' ]` and the failure-arm cases
read `expected 'Copied' to contain 'Copy failed'`. Plant **after** `setup()`; the reason is written
into the test.

### 6 — the diff line-number gutter

`DiffLine` gained `oldLine?` / `newLine?`; `DiffLines` renders an 8-px right-aligned
`aria-hidden` cell before the existing sign gutter, showing `newLine ?? oldLine`.

⚠ **THE NUMBERS WERE ALWAYS ON THE WIRE.** They sit in the `@@` hunk headers this component already
renders verbatim; the parser classified the header and never read it. **No backend change was owed
and none was made.**

⚠ **TWO COUNTERS, ADVANCING INDEPENDENTLY, and that is the whole reason both are carried.** A
context line exists on both sides; a deletion has **no** position in the after-file (giving it one
would point a reader at whatever now occupies that slot); an addition has none in the before-file.
After one deletion and two additions the sides have diverged — the fixture's trailing context line
is `oldLine 14 / newLine 15`, and a single counter cannot say that.

⚠ **A MISSING OR CORRUPT HUNK HEADER LEAVES EVERY FOLLOWING LINE UNNUMBERED.** Not counted from 1,
not guessed. A plausible-looking wrong line number is worse than a blank gutter, because a reader
would use it to find the line in the real file. The hunk regex deliberately **does not capture the
counts** — lines are counted as they are walked, so a header whose count disagrees with the body it
carries cannot make the gutter disagree with the text beside it.

---

## `PORT-canvas.md`'s one real gap — the marching "running" connector

**Page half: DONE. Canvas half: BLOCKED by dispatch rule 8.**

`NodeRunState` gained `live?: boolean` (`runVocabulary.ts`), resolved by the page in the same
object it already builds:

```ts
live: reading === "running"
```

⚠ **IT IS `reading === "running"`, NOT `!isTerminal` AND NOT `status !== "done"`.** A step
`waiting-for-you` is stopped dead awaiting a human; a step `not-started` has not been reached.
Animating either would be **motion asserting progress that is not happening** — the fabricated-figure
defect told in movement instead of in type. Reading it off the SAME `reading` the label is worded
from is what keeps the moving line and the printed sentence from ever disagreeing. Both negative
arms are pinned, plus a dedicated `waiting-for-you` case.

**What remains, and why I did not do it:** the connector's stroke delta and CSS class must be
merged in `WorkflowCanvas.tsx`'s `edgePayloads` + `edges` memos — and **dispatch rule 8 assigns
that file to a sibling agent**. This is the mirror image of the canvas author's own constraint
(*"the page is `WorkflowRunPage.tsx`, which this dispatch must not edit"*). The seam now exists and
is supplied on every render; the canvas owner needs ~8 lines:

```ts
// inside the edgePayloads memo (which is ALREADY above `settledNodes`, so the anti-blink
// fence is satisfied) — carry the flag on the same object:
out[node.id] = { count, noun, live: state.live === true }
// inside the edges memo, on the FLOW arm only:
...(payload?.live ? { animated: true, style: { ...EDGE_STYLE[kind], ...MARCHING_DELTA } } : {})
```

⚠ **No reading word and no value import of `runVocabulary` is needed** — `state.live === true` is a
boolean read, which is exactly what D-188-01/02 permit.
⚠ **`=== true`, never truthiness** — the field is optional and an absent one must paint the resting
connector.
⚠ **The WORD stays on the card, not on the line.** `runReadingLabel` is its one home; the sheet only
puts it on the edge because its nodes carry no run line.

---

## Verification

- `npx tsc -p tsconfig.app.json --noEmit` → **33 errors across 19 files — exactly the pre-existing
  set**, re-counted after every commit. **None is in a file this dispatch touched.** (Three of them
  live in `FilesSection.test.tsx` and three in `FilePreview.test.tsx`, both of which I edited a
  sibling of but not the file itself — `git diff --numstat` on both is empty, checked.)
- `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/files src/components/panel src/pages/WorkflowRunPage.test.tsx`
  → **20 files / 562 tests, `failed 0`.**
- Per-file: `WorkflowRunPage.test.tsx` **137 → 144** (+7, no case removed);
  `FileRow.test.tsx` +5; `fileRowUtils.test.ts` +4; `VersionDiff.test.tsx` 15 → 24 (+9);
  `FilePreview.test.tsx` 3 → 8 (+5). Every increment is attributed; the arithmetic closes with no
  residual.
- ⚠ **The cap was never adjusted.** `WorkflowRunPage.test.tsx` is one of SEED-171's five flaky
  suites; it read `failed 0` on every invocation here — recorded as an **observation, not as proof
  of innocence**. Its **one red run was REAL and not flake**: mounting `PhaseTimeline` took the
  whole suite down (`117 failed / 20 passed / 102 errors`) because the file's
  `@/providers/StreamsProvider` mock factory did not declare `useTasks`. That is `196-08`'s failure
  mode arriving again; filenames were read before any re-run and the cap was left at 2.
- `scripts/vitest-count-gate.cjs` was **not run and not edited** (rule 7). Every per-file figure
  above is an INCREASE, which is the gate's desirable direction.

## Not touched (rules 7 · 8)

`CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`, `scripts/vitest-count-gate.cjs`; `PhaseSpineGraph.tsx`,
`WorkflowCanvas.tsx`, `PhaseNodeCard.tsx`, `PhaseFormPanel.tsx`; every library/publish file.
`WorkspacePanel.tsx` was **read and deliberately left unmodified** — see the headline finding.

## Owed to the ledger (rule 7 — batched by the orchestrator, not written here)

Four files this dispatch modified carry G-5-relevant history and their rows will move:

| File | Note for the batch |
|---|---|
| `frontend/src/pages/WorkflowRunPage.tsx` | row read `16 / 6 / 1329`; gained the panel mount + the `live` supply. **Four of its five named seams still remain** |
| `frontend/src/components/panel/PendingAskCard.tsx` | row read `10 / 5 / 629`; now **650 segments**. Its exact line pin is re-baselined in place |
| `frontend/src/components/panel/PhaseTimeline.tsx` | row warns *"a change here LANDS IN CHAT FIRST"* — ⚠ **this dispatch inverts that for the first time**: it now has a SECOND mount, on the run page, and it was **not edited** to get there |
| `frontend/src/components/files/FileRow.tsx` · `fileRowUtils.ts` | both listed `1 / 1`; each gains a phase. `fileRowUtils.ts` is **no longer a true leaf** — it now imports `relativeBand` from the library subtree |
