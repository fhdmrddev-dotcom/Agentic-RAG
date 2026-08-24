---
phase: 199-the-component-map
plan: 07
subsystem: ui
tags: [react, tailwind, workspace-panel, workflow-run-surface, files-section, pending-ask, design-system, stitch, characterization-pin, cross-surface]

requires:
  - phase: 178-stitch-component-map (sketch)
    provides: "sheet c8-run-panel — the ask card (open + resolved), the paused cue, the files section, the file preview (csv + json), the version diff, the empty panel; plus its README's own correction that the panel is NOT a workflow component"
  - phase: 199-02
    provides: "the re-presented panel spine (PhaseCard / PhaseTimeline) this panel mounts, so the shell was measured against its FINAL contents; and the Col-3 chat-receipt CANNOT-EXPRESS report this plan re-measures independently"
  - phase: 195-05/06
    provides: "the ONE shared file row (`components/files/FileRow`) + `fileRowUtils` behind both surfaces this plan touches"
provides:
  - "A verdict for every element of sheet c8 — BUILT, ALREADY-SHIPPED, REFUSED, DECLINED, OUT-OF-SCOPE-BY-SURFACE or CANNOT-EXPRESS, none silently dropped"
  - "The panel's honesty fix: a template whose expiry the wire did not carry now SAYS the expiry is unknown instead of rendering a blank span"
  - "The empty panel re-presented by SUBTRACTION: the decorative Inbox glyph is gone; the heading and the forward-looking hint stay"
  - "The run header's degrade path made honest: the generic word `Workflow` and the fabricated `v0` replaced by one sentinel-driven reading"
  - "A pre-change inventory of BOTH surfaces' resting atoms, as literals, so 'renders no more at rest' is measured rather than claimed"
  - "The chat-sized receipt-spine CANNOT-EXPRESS report, in three parts, with its two load-bearing halves RE-MEASURED rather than inherited"
  - "Four measured refutations: two shipped source claims, one plan key_link, and one of my own fences"
affects: [chat-surface, workspace-panel, workflow-run-surface, document-detail-panel, 199-verification]

tech-stack:
  added: []
  patterns:
    - "Subtraction proved by INVERSION: pin the atom PRESENT in one commit, invert it in the next. All FIVE test files are `+N / −0` against the dispatched base — zero assertions deleted across the whole plan"
    - "An honest-unknown is made unrepresentable by TOTALITY: `expiryCaption` returns `string`, never `string | null`, so the blank cannot come back"
    - "A count-zero fence is paired with a positive control driven against a REAL contrasting arm, not a plant — and that pairing caught a vacuous regex of my own on first run"

key-files:
  created:
    - .planning/phases/199-the-component-map/199-07-SUMMARY.md
  modified:
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/panel/PanelEmpty.tsx
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
    - frontend/src/components/panel/__tests__/FilesSection.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
    - frontend/src/pages/WorkflowRunPage.test.tsx

key-decisions:
  - "DEC-199-07-A — the sheet's per-file relative TIMESTAMP (`2m ago` / `--:--`) is REFUSED, and the honesty finding it carries is delivered on the time value the panel row ALREADY has. The shipped row renders no timestamp at all, so adding one is an addition at rest; and it would need either a FOURTH relative-time formatter (the third's own docblock forbids that by name) or a cross-surface import of `workflows/library/relativeBand` into `panel/` — which that module explicitly declines to serve a second audience. The blank it DOES render is the template expiry caption, and that is what was fixed."
  - "DEC-199-07-B — `expiryCaption` is now TOTAL (`string`). Absent reads `expiry unknown`, never `no expiry` (a KNOWN-NONE nobody claimed) and never amber (`isNearExpiry` stays false — an absence is not an emergency). Four readings, and the fourth is structural: a non-template row renders no caption at all."
  - "DEC-199-07-C — the empty panel loses its decorative `Inbox` glyph and KEEPS both words. Sheet c8 spends zero marks in both of its empty states. The sheet's own sentence is REFUSED: it names a workflow, and this shell is mounted by `ChatLayout` on every Deep thread, so a person doing plain Q&A would be told to wait for an execution that is never coming."
  - "DEC-199-07-D — the run header's definition-unavailable arm is driven by ONE sentinel read (the server's documented empty `workflow_name`) for BOTH the headline and the version chip. Two independent tests would let an honest title sit beside a fabricated `v0`. The chip is OMITTED rather than reworded: absence is the honest reading, a version is a claim."
  - "DEC-199-07-E — `byNewestFirst` is NOT applied to the panel's file list. It is the run surface's ordering by an explicit shipped decision (`WorkflowRunPage.tsx:471` — *'The panel's own list keeps its shipped path ordering; no decision authorises changing it'*), and reordering a `role=listbox` with roving focus while rows arrive live moves a row under the user's cursor. Recorded as a named candidate, not built."
  - "DEC-199-07-F — the sheet's two preview footers (`Showing first 50 rows` / `End of preview`) are REFUSED. The shipped preview never truncates silently: it renders in FULL to 2000 rows / 256 KB and then REFUSES with `File too large to preview`. Adopting the footer would require INTRODUCING truncation to earn the right to confess it."
  - "DEC-199-07-G — `WorkspacePanel.tsx` itself is BYTE-UNCHANGED. The shell needed nothing; every BUILT row landed in a leaf. Said out loud because a plan named after the panel shell that does not touch it looks like an omission and is a result."

patterns-established:
  - "Pattern: a plan's own `key_links` are claims to VERIFY. One of this plan's two was measured FALSE (see below) and its declared grep would have matched only a docblock — a fence that confirms a link while finding nothing but prose."
  - "Pattern: where jsdom cannot measure (no layout), assert the ZERO on the record, discharge the claim with a stated class-level surrogate, and name the real check as an owed G-4 UAT row. Never let `0 <= 380` read as a passing width check."

requirements-completed: [DES-01]

duration: ~65min
completed: 2026-08-19
---

# Phase 199 Plan 07: The Run Panel (sheet c8) Summary

**Sheet `c8-run-panel` reconciled element by element against the shipped cross-surface panel and the workflow run surface, with three BUILT rows — an unknown file time that now SAYS so instead of blanking, an empty panel that spends no decorative mark, and a run header that stops printing a plausible-but-wrong workflow name and a fabricated `v0` — every other element carrying a written verdict, and the chat-sized receipt spine reported as CANNOT-EXPRESS with its missing value re-measured rather than inherited.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 3 / 3
- **Files modified:** 7 (3 source, 4 test)
- **Commits:** 3

| Commit | What |
|---|---|
| `a1a443db` | `test(199-07)` — both surfaces' resting atoms pinned as literals, before anything moved |
| `bd78fd4d` | `fix(199-07)` — the unknown expiry says so; the empty panel spends no mark; the ask card's receipt fenced |
| `7bd23a09` | `fix(199-07)` — the run header stops printing a plausible wrong workflow |

## ⚠ The base-drift hazard fired again — SIX for six

`git merge-base HEAD c6371d9b` returned **`3781a3fe`**, a tree predating the dispatched base and containing none of Waves 1-2's work. The prompt's assertion caught it and `git reset --hard c6371d9b` corrected it; `199-02`'s commits and its SUMMARY were then verified present before Task 1 began. **This is now the DEFAULT behaviour of this dispatch path on every observed run of this phase, not an intermittent fault.**

---

## The reconciliation table — every element of sheet c8, one verdict

### 1 · The ask card → `panel/PendingAskCard.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 1 | Yes/No card — a tinted `Approve` beside a plain `Reject` | ⚠ **REFUSED — the sheet hard-codes a semantics the wire does not carry** | `PendingAsk.options` is a free-text `string[]` authored by the model. A two-option ask ALREADY renders as this card; painting option 2 as the affirmative would be the client inventing a recommendation out of array order |
| 2 | Multi-choice radios | **ALREADY-SHIPPED** | `role="radiogroup"` of `role="radio"` buttons, `aria-checked`, re-click to deselect |
| 3 | Free-text + Submit | **ALREADY-SHIPPED, and STRONGER** | the sheet draws three MUTUALLY EXCLUSIVE card types; the shipped card renders free-text **always** (D3 — the no-options trap), so an `ask_user` with zero choices can never leave a person with no way to answer |
| 4 | **ANSWERED — a receipt carrying its decision, not a form left on screen** | **ALREADY-SHIPPED · now FENCED** | the shipped answered arm is the question + `✓ Answered · agent resumed` + `You answered <b>X</b>`, and it was TRUE AND UNGUARDED — the shipped case asserts the three texts that ARE there and nothing about what must NOT be. `T-199-07-01` is now a live fence: **zero** interactive elements, **GONE not disabled**, with the same selector driven against the PENDING arm as a positive control |
| 5 | The answered card's `14:20` timestamp | ⚠ **REFUSED** | an addition at rest, and one with no reader. The answered arm is OPTIMISTIC — the `ask_user_response` SSE removes the prompt and unmounts the card — so a time would be visible for a second or two and could never be re-read |
| 6 | The `or` divider between choices and free-text | **ALREADY-SHIPPED** | rendered only when both surfaces are present |
| 7 | *(the sheet draws no such thing)* the shipped countdown / expired / retired arms | ⚠ **FLAGGED, NOT CUT** | three honest arms the sheet has no vocabulary for (D5 timeout, the 404 "run no longer active", and 194.1's `Retired`). The sheet drawing fewer states is not an argument for shipping fewer |

### 2 · The paused cue

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 8 | Amber pulsing dot + `Awaiting Human` + a raised-hand mark | ⚠ **OUT-OF-SCOPE-BY-SURFACE** | measured: `PausedRunCue` is mounted at **`components/chat/MessageItem.tsx:534`** and nowhere else. `MessageItem.tsx` is one of the three files this plan is forbidden to modify, so this is **recorded, not built** |

### 3 · The files section → `panel/FilesSection.tsx` (+ `files/FileRow.tsx`)

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 9 | Row = per-extension icon + mono name + right-aligned meta | **ALREADY-SHIPPED** | and shipped as ONE row shared with the run page and chat since Phase 195 — so the sheet's file-row language is already one language across every surface it is drawn on |
| 10 | **"an unknown file time SAYS so instead of blanking"** (the sheet's `--:--`) | ✅ **BUILT — the honesty row** | see below. Delivered on the time value the panel row ACTUALLY carries |
| 11 | A per-file relative timestamp (`2m ago`) as a second meta line | ⚠ **REFUSED** — DEC-199-07-A | an addition at rest, and unreachable without a FOURTH relative-time formatter or a cross-surface import the owning module declines by name |
| 12 | **"Unknown sorts first"** | **ALREADY-SHIPPED on the RUN surface · DECLINED for the panel** | `byNewestFirst` (`fileRowUtils.ts`) sorts a missing `created_at` FIRST and is applied at `WorkflowRunPage.tsx:473`. It is applied **nowhere** in the panel — DEC-199-07-E |
| 13 | Files-empty state (`No outputs generated yet`, dashed frame) | **ALREADY-SHIPPED · wording REFUSED** | shipped: `No files yet.` ⚠ The sheet's word is **wrong for this list**: it also holds uploaded **templates**, which are INPUTS. "No outputs" would be false about a list showing a template |
| 14 | Template badge + expiry caption | *(not drawn by the sheet)* — **FLAGGED, KEPT** | D-02's ephemeral-template cue. The sheet has no template concept at all |

### 4 · The file preview → `panel/FilePreview.tsx` · `CsvTablePreview.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 15 | Header = filename + a per-type affordance (`fullscreen` / `content_copy`) | **PARTIALLY ALREADY-SHIPPED · the affordances REFUSED** | shipped header is `‹ Files` + the truncating full path. The two icons are additions at rest, and the one case that genuinely needs width already has a user-initiated `⤢` on the DIFF (file-browser-and-diff.md D4) |
| 16 | CSV rendered as a table | **ALREADY-SHIPPED** | `CsvTablePreview` |
| 17 | **`Showing first 50 rows`** | ⚠ **REFUSED — DEC-199-07-F** | measured: the shipped preview **never truncates silently**. It renders in FULL to `MAX_ROWS = 2000` / 256 KB, then REFUSES outright with `File too large to preview`. Adopting the footer means INTRODUCING truncation in order to earn the right to confess it — strictly less honest |
| 18 | JSON/text rendered as mono `<pre>` | **ALREADY-SHIPPED** | with the mandatory graceful fallback (`No preview available · Download`) for bucket/binary/null-url, which the sheet does not draw |
| 19 | **`End of preview`** | ⚠ **REFUSED** | same as 17 — the inline path renders the whole file |

### 5 · The version diff → `panel/VersionDiff.tsx` · `DiffLines.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 20 | Unified in-column diff, fixed sign gutter, `+`/`−` tone, left accent | **ALREADY-SHIPPED** | and with the Unicode minus `−`, not an ASCII hyphen (UI-SPEC) |
| 21 | Hunk context | **ALREADY-SHIPPED** | `DiffLineKind` carries a `hunk` member rendered in the primary tone |
| 22 | **Per-line NUMBERS in a left gutter** | ⚠ **REFUSED** | measured: `DiffLine` is `{ kind, text, sign? }` — **no line number exists on the model.** Deriving one means re-parsing the hunk header and counting, i.e. a second derivation of a value the hunk header already prints, added at rest on the narrowest column in the app |
| 23 | *(the sheet draws no such thing)* the shipped 500-line truncation notice | ⚠ **FLAGGED, KEPT** | the diff is the one place the app DOES truncate, and it says so. Cutting it to match the sheet would remove the honesty the sheet's own footers were reaching for |

### 6 · The empty panel → `panel/PanelEmpty.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 24 | ONE calm centered state, never four empty headers | **ALREADY-SHIPPED** | D3's short-circuit; pinned in Task 1 (`button[aria-expanded]` count is **0**) |
| 25 | *(negative space)* the sheet spends **zero marks** in both empty states | ✅ **BUILT — the subtraction** | the decorative `Inbox` glyph REMOVED. DEC-199-07-C |
| 26 | The sheet's sentence, `Workflow results will appear here during execution.` | ⚠ **REFUSED — and this is the sheet's title-error made concrete** | this shell is mounted by `ChatLayout` on EVERY thread. A person doing plain Q&A would be told to wait for an execution that is never coming |
| 27 | **380px discipline** | **HELD BY CONSTRUCTION · but NOT MEASURABLE HERE** | see the jsdom note below |

---

## The three BUILT rows

### 1. An unknown file time SAYS so — the sheet's own headline finding

Sketch 178's entire one-line verdict on this sheet is: *"The run panel keeps discipline at 380px, and an unknown file time says so instead of blanking."*

The shipped panel row renders **no timestamp at all**, so nothing there could blank — and adding one is the addition DEC-199-07-A refuses. But the row DOES carry one time-derived value, and **it blanked**:

- `expiryCaption(expiresAt?)` returned `null` when `expires_at` was absent, and the caption `<span>` was rendered unconditionally inside the `isTemplate` branch. A template row whose expiry the wire did not carry rendered an **EMPTY span beside its "Template" badge**.
- ⚠ **The comment on that arm named a caller that structurally cannot reach it** — *"agent file → no badge (D-11)"*. An agent file is not a template, so it renders no trailing slot at all. The ONLY row that ever took the `null` arm was the one that blanked.
- `WorkspaceFile.expires_at` is **optional on the wire** (`types/index.ts:918`), so the arm is reachable, and **none of this file's 24 shipped cases covered it**.

Now TOTAL — three readings plus a structural fourth:

| reading | renders |
|---|---|
| ABSENT — the wire did not say | **`expiry unknown`** |
| KNOWN-PAST | `expired` |
| KNOWN-FUTURE | `expires in 3h` / `expires in 30m` (amber under 1h) |
| *(structural)* not a template | **nothing at all** — there is nothing to say |

Never `no expiry` (a KNOWN-NONE nobody claimed) and never amber. **RED-driven**: three of the four new cases fail against a planted blank return; the fourth (the structural one) correctly stays green either way, which is the property it exists to pin.

### 2. The empty panel spends no decorative mark

`<Inbox/>` removed. The heading and the forward-looking hint stay — the hint is the atom sheet c8 *agrees* with, and *"text is noise — cut it, BUT THE PURPOSE MUST SURVIVE THE CUT."* Proved by inverting Task 1's `toHaveLength(1)` to `toHaveLength(0)` — the line is edited, never deleted.

### 3. The run header stops printing a plausible wrong workflow — ⚠ **TWO SHIPPED CLAIMS MEASURED FALSE**

`WorkflowRunRead`'s docblock records the server's degrade path verbatim: *"if the definition row cannot be read, the server returns `workflow_name: ""` / `workflow_version: 0` / `definition: null` rather than 404ing. Treat an empty `workflow_name` as 'definition unavailable', **never render the empty string**."* And `WorkflowRunPage`'s own `specs` memo asserts *"the header says so by way of the empty name."*

**Measured at HEAD — and pinned in Task 1 before a byte moved — neither was true.** The header rendered:

- `{run?.workflow_name || "Workflow"}` → the generic word **`Workflow`**, a plausible-looking DEFAULT; and
- `v{run?.workflow_version}` → **`v0`**, a fabricated version number that looks exactly like a real one.

Neither is the empty string, **so the letter of the rule was kept while its whole point was lost.** A plausible wrong value is worse than a blank — a blank at least invites a question.

Now: ONE sentinel read drives BOTH atoms (so an honest title can never sit beside a fabricated version); the headline reads **"We couldn't read this workflow's details"** in this file's own voice (`COPY_BROKEN_HEAD` = *"We couldn't load this run."*), scoped to the WORKFLOW's details because the run itself is fine; and the version chip is **omitted**, because absence is honest and a version is a claim. The false clause in the `specs` docblock is corrected **beside** its original, never over it.

---

## ⚠ CANNOT-EXPRESS — the chat-sized receipt spine (the three parts)

*This plan's flagship report. It built nothing here: `git diff --numstat` against the dispatched base names seven files and **none is under `frontend/src/components/chat/`**.*

### 1. What the sheet asks for

Sketch 178's spine sheet draws a third column at chat width: a compact **execution trace** — one row per step (`Retrieve`, `Extract`, `Analyze`, `Branch`, `Judge`, `Draft`), each carrying a **mono per-step duration** (`00:03`, `00:12`, `14:22`), on a continuous thin spine, closed by a **`Total Runtime 15:41`** footer. Sheet c8's own contribution to the same idea is the ANSWERED ask card's `14:20` — the same instinct, one atom wide: *say when this happened*.

### 2. What the shipped surfaces can do today

- **The panel owns the ONE spine, and it is the only one.** Measured over the tree: `PhaseTimeline` / `PhaseCard` are mounted in **zero** files under `components/chat/` and in **zero** places on `WorkflowRunPage.tsx` (its single textual occurrence is a comment). The chat↔panel split (D-094-UNIFY / workflow-run-surface.md D1) is deliberate and intact.
- **Chat renders a RUN-LEVEL elapsed figure, honestly** — `chat/RunCard.tsx` ticks from a stable baseline, freezes at a true terminal, and gates the whole segment so a finished run with no persisted end-time shows **no duration at all** rather than a current-clock fabrication.
- **The panel spine has the rows, and no timing on any of them.**
- **This plan's own ask card cannot say when it was answered either** — the answered arm is optimistic and unmounts on the response SSE, so even a `Date.now()` at submit would be a number nobody could re-read.

### 3. The gap — the missing value, RE-MEASURED here rather than inherited

`199-02` reported this for sheet c3 Col 3. Per the project's own rule about not inheriting unmeasured claims, its two load-bearing halves were re-derived independently in this plan:

| Candidate source | Measured **here** | Verdict |
|---|---|---|
| `Phase` (`types/index.ts:1018-1082`) | `slug · phaseIndex · phaseType · status · attempt · error · subAgents · pendingAsk · emitSubStep · emitFailure` | ✅ **confirmed: no timing field of any kind** |
| `WorkflowRunPhase` (`lib/api.ts:4178-4183`) — the durable per-phase feed | `slug · phase_index · status · phase_type` | ✅ **confirmed: no timestamps** |
| `WorkflowRunRead` (`lib/api.ts:4215-4220`) | `created_at · claimed_at · updated_at` — and its own docblock states *"`workflow_runs` has no `started_at` and no `completed_at`"* | **RUN level only** |

**So the gap is exactly one BACKEND hop**, and this phase's scope fence forbids it outright: a per-phase start instant must either be added to `workflow_phases` and written by the phase-activation path, or exposed by a read route over `harness_audit`'s `phase_started` / `phase_completed` rows. ⚠ **The trap `199-02` named is confirmed by the same reading**: `workflow_phases.created_at` exists, and it is written for every phase row at RUN creation — a duration derived from it is cumulative-from-run-start and **would look right while being wrong**.

- **Routing:** a named future phase on the run-receipt / run-honesty surface — **NOT** a gap-closure round of 199 (G-7: new user-facing capability is a phase, not a gap).
- **Re-open trigger:** *the first commit that puts per-phase timing on the wire* — `started_at`/`completed_at` on `workflow_phases`, or a read route over `harness_audit`.
- ⚠ **The placement caveat that must survive the deferral, and it is this plan's own headline:** a receipt built on the chat surface **lands in chat first**, and so does anything built into the panel. Whoever builds it UATs it in CHAT, not only on the workflow surface.

---

## ⚠ THE CROSS-SURFACE BLAST RADIUS — a panel change lands in CHAT FIRST

Stated plainly, as this plan's must_have requires, and **measured rather than quoted**:

```
WorkspacePanel — every non-prose occurrence in frontend/src (excluding tests):
  components/layout/ChatLayout.tsx:6    import { WorkspacePanel, type PanelState }
  components/layout/ChatLayout.tsx:673  <WorkspacePanel
  … 30+ further occurrences, every one of them a COMMENT
```

- **`ChatLayout.tsx` is the ONE mount. There is no mount in any workflow page.**
- `components/metadata/DocumentDetailPanel.tsx` reuses the panel's sheet shape, so the shell already spans a **third** surface.
- `PausedRunCue` — sheet c8's element #8 — renders in `components/chat/MessageItem.tsx:534`.

**Consequence for this plan's two panel changes** (`PanelEmpty`, `FilesSection`):

| Change | Where a person meets it FIRST |
|---|---|
| the empty panel loses its glyph | **CHAT** — every Deep thread with no workspace activity, which is the common case |
| `expiry unknown` on a template row | **CHAT** — the template-fill flow starts from the chat composer's upload affordance |

### ⚠ OWED VERIFICATION (G-4), and it cannot be discharged on the workflow surface

| # | Row | Surface | Why it is owed |
|---|---|---|---|
| U1 | Open a Deep thread with no workspace activity; the panel's empty state reads as calm and complete without its glyph | **CHAT** | the only place this state renders |
| U2 | Upload a template whose `expires_at` the wire does not carry; the row reads `expiry unknown` in the muted tone, beside the Template badge | **CHAT** | jsdom asserts the class, not the rendered colour |
| U3 | **The real 380px measurement** — the panel at its shipped width with a long-path template row: the name truncates, the badge/caption/size group does not wrap or overflow | **CHAT**, at ~1024px and at ≥1440px | **jsdom runs no layout** — `getBoundingClientRect().width` is `0`, so a `width <= 380` assertion would read `0 <= 380` and pass against a panel that overflowed catastrophically. The zero is asserted **on the record** in `WorkspacePanel.test.tsx`, and the class-level surrogate (the shell declares no width of its own; the name cell is `min-w-0 flex-1 truncate`; every sibling is `flex-shrink-0`) is what is actually checked |
| U4 | A run whose definition cannot be read: the header says so and shows no version | **WORKFLOW RUN PAGE** | the one owed row that does NOT live in chat |

---

## Deviations from Plan

### Measured FALSE — recorded, not worked around

**1. [plan `key_links[1]`] `FilesSection.tsx → fileRowUtils.ts` via `pattern: "fileRowUtils|formatBytes"` — the link does not exist as written, and the declared grep would have been VACUOUS.**

- **Measured:** `grep -n "fileRowUtils\|formatBytes\|baseName\|byNewestFirst" frontend/src/components/panel/FilesSection.tsx` returns **two hits, both inside a docblock**. The file imports no helper from `fileRowUtils` and calls none of them.
- **The real edge is one hop longer and deliberately so:** `FilesSection → components/files/FileRow → fileRowUtils`. Phase 195's F2 boundary puts the PRESENTATION in the shared row and leaves activation, the viewed-thread read and the download call with the caller.
- **Why it matters rather than being pedantry:** the plan's own declared pattern would have matched this file's PROSE and reported the link confirmed. That is a fence that passes while defending nothing — the exact failure this phase keeps finding.
- **Resolution:** recorded, and **no code was moved to make the sentence true.** Routing the panel through `formatBytes` directly would duplicate what the shared row already does.

**2. [`WorkflowRunPage.tsx` `specs` docblock + `WorkflowRunRead` docblock] the header did NOT "say so by way of the empty name".** Both claims are quoted, pinned as they behaved, and corrected beside their originals — see BUILT row 3.

**3. [`FilesSection.tsx:86` comment] *"agent file → no badge (D-11)"* names a caller that structurally cannot reach that arm.** Corrected in place, with the real caller named.

**4. [MY OWN FENCE] a `\b`-anchored regex over `container.textContent` was VACUOUS, and the positive control is what caught it.**

- **Found during:** Task 3, first run.
- **Issue:** `expect(container.textContent).not.toMatch(/\bv\d/)` on the degrade arm. `textContent` concatenates with no separator, so the page reads `…renewalsv4…` / `…detailsv0…` — there is no word boundary before `v`, and the needle could not match **even when the chip was on screen**. The assertion would have reported the fix working forever, including if the fix were reverted.
- **How it surfaced:** the paired positive control (`toMatch(/\bv4\b/)` against a HEALTHY run) went RED on the first run. It was written to prove the needle could fire, and it proved it could not.
- **Fix:** both re-scoped to element queries (`queryByText(/^v\d+$/)` / `getByText(/^v\d+$/)`), which cannot be defeated by concatenation. Recorded in the test file itself.
- **Commit:** `7bd23a09`

### Evaluated and DECLINED with reasons (Rule 4 territory, resolved by declining)

**5. `byNewestFirst` on the panel's file list** — DEC-199-07-E. A shipped comment records the scoping decision explicitly, and the panel list is a `role="listbox"` with roving index-based focus: reordering it as files arrive live moves a row under the user's cursor.

**6. Cutting the empty panel's HINT paragraph, or its HEADING.** The heading is asserted in four places and cutting it would DELETE assertions — the "re-baseline a pin to turn red green" trap. The hint is the atom the sheet keeps. Both declined; only the unasserted decorative glyph was spent.

**7. `components/panel/__tests__/FilesSection.test.tsx` carries THREE pre-existing `TS2304: Cannot find name 'WorkspaceFile'` errors at HEAD** (the file uses the type name without importing it). A one-line import would fix them and take the tree from 33 → 30. **Declined**: the baseline is a shared measurement a sibling agent and the orchestrator compare against mid-wave, and the errors are outside this plan's BUILT rows. **My new fixture is built by SPREAD precisely so it names no type and adds no fourth error.** Logged for a future sweep.

---

## Verification

| Gate | Result |
|---|---|
| `git diff --stat -- backend supabase` | **EMPTY** — asserted at every task |
| `git status --short` — files under `components/layout/`, `components/chat/`, `components/metadata/` | **ZERO** |
| `npx tsc --noEmit -p tsconfig.app.json` | **33**, unmoved at every task (baseline, Task 1, Task 2, Task 3) |
| The five in-scope suites | 233 → **240** (Task 1) → 287 across 15 panel files (Task 2) → **112** in `WorkflowRunPage.test.tsx` (Task 3), **0 failing throughout** |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | **`count gate OK` — 96/96 pinned files present, no per-file decrease, 0 failing · total 4848 · pinned total 4543** |
| **Zero assertions deleted** | `git diff --numstat <base> HEAD` → `WorkspacePanel.test.tsx 100/0` · `FilesSection.test.tsx 114/0` · `PendingAskCard.test.tsx 60/0` · `WorkflowRunPage.test.tsx 113/0`. **All four `+N/−0`** |
| RED proof | the three absent-arm expiry cases fail against a planted blank return; the ask-card zero-control fence is paired with a live positive control on the pending arm |

### The count-gate arithmetic closes with no residual

Prompt baseline: **total 4836 · pinned total 4543 · 96/96**. Measured at close: **total 4848 · pinned total 4543 · 96/96 · failed 0**.

`+12`, fully attributed by the gate's own per-file table: `WorkflowRunPage.test.tsx 108 → 112 (+4)` · `WorkspacePanel.test.tsx 58 → 62 (+4)` · `FilesSection.test.tsx 22 → 26 (+4)`.

⚠ **I authored FOURTEEN cases, and the gate can see TWELVE.** The two it cannot see are exactly the ones the plan warned about: **`src/components/panel/__tests__/PendingAskCard.test.tsx` is NOT in the gate's `TARGETS`**, so a decrease there is invisible. Its count is therefore recorded explicitly, as the plan's verification block requires: **43 tests, 1 file, 0 failing** (41 before this plan). The `2`-case discrepancy is not drift — it is the gate's blind spot, measured.

The gate also printed unrelated growth (`PhaseTimeline.test.tsx +11`, `WorkflowSoul.test.tsx +10`, `CanvasToolbar.test.tsx +4`, `WorkflowCard.baseline.test.tsx new 29`). **None of it is mine and the proof is mechanical**: `git diff --numstat` against the dispatched base names seven files and none of those four is among them. That is pre-existing pin staleness at the base commit.

### The cap was neither adjusted nor needed

`GSD_VITEST_MAX_WORKERS=2` held on **every** invocation (9 runs), with a sibling agent active. **Exactly one red run occurred and it was REAL** — my own positive control, in a file `git diff --numstat` shows I had just edited, failing on a genuine defect in my assertion. SEED-171's triage procedure was entered and terminated correctly at step 2 (the named file WAS modified), and **the cap was never touched**.

⚠ **Recorded as an observation, not as proof of innocence:** `src/pages/WorkflowRunPage.test.tsx` is SEED-171's fourth named flaky suite and sits at the centre of this plan's blast radius. Across its runs here it produced one failure, which was mine and reproducible. Its other 111 cases were green on the first run of every invocation — **provably unmodified in the parts I did not touch**, not "fine".

---

## ⚠ Hot-file ledger — three rows owed, ONE of which does not exist

Re-derived with CLAUDE.md's own recipe, from git, at this plan's close:

| File | ledger says | **measured now** | G-5 |
|---|---|---|---|
| `frontend/src/components/panel/FilesSection.tsx` | `7 / 4 / 298` | **`8 / 5 / 334`** (087, 088, 100, 195, 199) | **FIRES** |
| `frontend/src/pages/WorkflowRunPage.tsx` | `14 / 4 / 1156` | **`15 / 5 / 1197`** (188, 188.1, 194.1, 195, 199) | **FIRES** |
| `frontend/src/components/panel/PanelEmpty.tsx` | ⚠ **NO ROW AT ALL** | **`4 / 4 / 52`** (087, 088, 100, 199) | ⚠ **FIRES — and has been invisible to its own guardrail for its entire life** |

⚠ **`PanelEmpty.tsx` is the finding.** It sits at **four phases**, one over the G-5 threshold, and it has never appeared in the audit scan list — so G-5 could not have fired on it at any count. That is the identical failure Phase 196 found eleven times over and Phase 192.2 found four more, and it is exactly what the table's completeness rule exists to prevent. Its ONE binding invariant, stated so a row can carry it: **the heading is asserted in four places and the hint is the atom sheet c8 keeps — this component's copy is not free to shrink further.**

**I have NOT edited `CLAUDE.md` or `docs/HOT-FILE-LEDGER.md`, and that is a decision rather than an omission.** Both are shared artifacts and a sibling agent is executing concurrently in this wave; `197-10` set the precedent of flagging a stale ledger row and declining to edit a shared artifact mid-wave. The same-commit sync rule is **owed to the orchestrator at wave close**, with the three rows above ready to paste.

---

## Known Stubs

None. This plan added no component, no data source and no placeholder. Its whole source diff is `+107 / −13` across three files and is entirely removal, one honest-string constant, and one gate on a sentinel the server already documents.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema was touched — `git diff --stat -- backend supabase` being EMPTY at every task is the mechanical proof. The plan's three registered threats are dispositioned:

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-199-07-01 (Spoofing · `PendingAskCard.tsx`) | ✅ **mitigated — and it was previously TRUE BUT UNGUARDED** | the resolved card is now fenced at **zero** interactive elements (`button, input, textarea, select, [role=radio], [contenteditable]`), asserted **GONE not disabled** — a second assertion pins zero `[disabled]`/`[aria-disabled]` so a future arm cannot satisfy the first by marking a control dead. The needle is proved live by the same selector finding >0 on the pending arm |
| T-199-07-02 (Tampering · preview consumers) | **mitigated** | zero `dangerouslySetInnerHTML` introduced anywhere in the panel subtree; no preview file was modified at all |
| T-199-07-03 (Information disclosure · cross-surface shell) | **mitigated, and STATED rather than discovered** | `git status --short` shows no file under `components/layout/`, `components/chat/` or `components/metadata/`; the blast radius is written out above with its owed chat-surface UAT rows named |

## Self-Check: PASSED

- `frontend/src/components/panel/FilesSection.tsx` — FOUND
- `frontend/src/components/panel/PanelEmpty.tsx` — FOUND
- `frontend/src/pages/WorkflowRunPage.tsx` — FOUND
- `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx` — FOUND
- `frontend/src/components/panel/__tests__/FilesSection.test.tsx` — FOUND
- `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx` — FOUND
- `frontend/src/pages/WorkflowRunPage.test.tsx` — FOUND
- commits `a1a443db`, `bd78fd4d`, `7bd23a09` — FOUND
