# Phase 195: Show the Deliverable - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

A workflow run's produced file is **reachable from the run surface** and **reads the same as
every other file in the app**.

⚠ **The ROADMAP flagged this phase "first task is measurement." That measurement was DONE at
discuss-phase, and it changed the phase's shape.** SEED-148 records the wire question as
"explicitly unmeasured" and frames the phase as possibly-backend. It is not. Measured 2026-08-17
against source + the live local DB:

| Question | Measured answer |
|---|---|
| Does a workflow run emit output files onto the wire at all? | **YES.** `llm_emit` → `_handle_render_template` persists a real workspace file (`ws_write_file`, thread-scoped) and emits `workspace_file_written` on the PRODUCER stream (`backend/app/services/tool_dispatcher.py:3550-3578`). `_ProducerStreamCtx` (`harness/phase_types.py:1161-1192`) exists specifically to re-point the stream id so the card appears mid-run. |
| Is the file really there? | **YES.** 86 `workspace_files` rows; real 37-40 KB `.docx` deliverables on workflow-run threads through 2026-08-16. |
| Does the run surface show it? | **YES, since Phase 188-10** (`783daab5`, *"the deliverable region — listed and downloadable, never previewed"*). `WorkflowRunPage.tsx` reads `useWorkspaceFiles(run.thread_id)` (`:432`) and renders `data-testid="run-deliverables"` (`:1020-1085`). |

⇒ **This is NOT a plumbing phase. It is a CONSOLIDATION + SCOPING phase.** SC#1 is measured
already-satisfied; the real work is SC#2 (RUN-03 — there are four file presentations today, and the
run page's own shipped region is one of them) and SC#3 (whose named pattern was retired).

⚠ **`BUG-260816-05`'s capability table is WRONG on one row** — it records *"see produced output
files | canvas run surface ❌"*. Measured, the run surface has listed and downloaded them since
Phase 188. Corrected here beside the original rather than over it; the report's file half is still
correctly routed to this phase.

**In scope:** the run surface's deliverable region; one shared file row consumed by all three file
surfaces; correcting the two stale records this phase depends on.
**Out of scope:** run-level file attribution (no migration), the ask-responder mount, chat gaining
any NEW file affordance, emit-path reliability, in-app preview of Office documents.

</domain>

<decisions>
## Implementation Decisions

### Scoping — what counts as "the deliverable"

- **D-01: KEEP the thread-scoped read. No `run_id` on `workspace_files`, no migration.**
  Measured: a run is near-1:1 with a thread (**226 runs / 222 distinct threads**; only 2 threads
  carry more than one run), and the files-per-workflow-run-thread histogram is
  **0 files → 161 threads · 1 file → 60 · 20 files → 1**. So thread-scope is exact for **60 of 61**
  file-bearing runs and visibly wrong for one — which is a *chat* thread (19 matplotlib chart PNGs +
  a manifest from `execute_code`) that also ran a workflow.
  ⚠ **`run_claim` LOOKS like the attribution field and IS NOT.** It is **100% NULL across all 86
  rows** and belongs to Phase 141 (COLL-02) template-asset context isolation
  (`backend/app/services/template_asset_service.py:189-310`). Do not repurpose it. `kind` is
  likewise NULL on 84/86 rows.
  ⚠ Rejected explicitly: a `created_at`-between-`started_at`/`finished_at` time-window filter — it
  is an inference, not a fact, and a concurrent agent run on the same thread lands inside the window.

- **D-02: The region is LABELLED AS THE RUN'S WORKSPACE, not as "what this run produced."**
  D-01 means the list can contain files this run did not make. The copy must not claim otherwise.
  This is the honesty half of D-01 and is binding — a label that overstates the scope re-creates the
  exact class of lie the run-surface work exists to remove.

- **D-03: ONE uniform list — inputs and outputs read identically.** The template the user supplied
  and the deliverable it filled sit in the same list with no grouping and no `kind` distinction.
  (Your DB shows `/Northwind-QBR-Template.docx` written by the render path itself, so the two are not
  even reliably separable by name.) Matches what `FilesSection` already does in the panel.

- **D-04: The 161 file-less runs are OUT OF SCOPE.** They are cancelled/failed runs or runs whose
  definition carries no `llm_emit` phase. Chasing "did an emit phase silently lose a file?" is
  emit-path reliability, a different phase. ⚠ Recorded as an ACCEPTED BLIND SPOT, not as a proven
  absence: this phase does not check whether any of the 161 had an emit phase.

### RUN-03 — one file presentation

- **D-05: EXTRACT ONE SHARED PRESENTATIONAL ROW.** Not "widen `OutputFileCard`", not "swap the icon
  only". The row takes a **discriminated source**:
  `{ kind: 'sandbox', url }` | `{ kind: 'workspace', threadId, fileId }`.

  ⚠ **THE BLOCKER THAT MAKES A NAIVE REUSE FAIL, AND IT IS NOT STYLISTIC.** `OutputFileCard`
  identifies a file as `{filename, url}` and downloads via `downloadSandboxOutput(relativeUrl,
  filename)` (`lib/api.ts:1575`). A workflow deliverable is a workspace file — `{id, path,
  size_bytes, mime_type}` — downloaded via `downloadWorkspaceFile(threadId, fileId, filename)`
  (`lib/api.ts:1644`). **It has no `url` at all**, and `OutputFileCard` treats a missing `url` as a
  DEAD FILE: red border, `aria-disabled`, *"Download unavailable — this file has no link"*
  (`OutputFileCard.tsx:92-119`). **Feeding workflow deliverables into `OutputFileCard` unchanged
  renders every one of them as a broken link.**

  The four presentations being collapsed:
  | Where | What it does today |
  |---|---|
  | `frontend/src/lib/fileIcon.tsx` | the DECLARED "one shared icon system" — consumed by `OutputFileCard` **only** |
  | `frontend/src/components/panel/FilesSection.tsx:19-26` | its own inline lucide map + a `formatBytes` commented *"copied verbatim from OutputFileCard"* |
  | `frontend/src/pages/WorkflowRunPage.tsx:170-188` | its own hand-rolled `iconFor()` + hand-rolled `<li><button>` rows |
  | `frontend/src/lib/fileIcons.tsx` (`getFileIcon`) | the documents/health side — **NOT in scope**, listed so the planner does not "unify" it by accident |

- **D-06: NEW NEUTRAL HOME — e.g. `frontend/src/components/files/FileRow.tsx`. NOT
  `components/chat/`.** A component three non-chat surfaces depend on living under `chat/` is the
  same mis-homing that produced this phase.

- **D-07: CONVERT ALL THREE surfaces in this phase** — `WorkflowRunPage`, `OutputFileCard`,
  `FilesSection` — so that when 195 closes there is exactly ONE file presentation. A follow-up
  seed is not acceptable here; SC#2 says "no second file UI", and leaving two is that.

- **D-08: `OutputFileCard`'s existing states MUST survive byte-identical** — the dead-link state
  (`data-dead="true"`, the red disabled affordance) and the `supersedes` "Replaces: …" subline. They
  each close a named prior bug (`BUG-260523-03`, 095-VALIDATION D-07). The extraction is a
  refactor of PRESENTATION, never a re-decision of behaviour.

- **D-09: 188-10's rule HOLDS — listed and downloadable, NEVER previewed.** The dominant workflow
  deliverable is `.docx`; `FilePreview` handles text/markdown, so an open affordance would mostly
  render "cannot preview". Office/PDF in-panel preview stays deferred (REQUIREMENTS deferred table,
  trigger: "fires once RUN-02 makes produced files visible" — that trigger FIRES with this phase and
  the answer is recorded as *not now*).
  ⚠ Note the asymmetry this creates and keep it deliberate: the panel's `FilesSection` row DOES open
  a preview on click. The shared row must therefore parameterise the ACTIVATION, not hardcode it.

### The many-files reading (SC#3)

- **D-10: ONE UNIFORM QUIET LIST. No hero. Follow shipped code, not the stale criterion.**

  ⚠ **SC#3 AS WRITTEN CANNOT BE SATISFIED — IT NAMES A RETIRED PATTERN.** Phase 095.1
  (D-095.1-06) **REVERSED** the hero/working split by an operator-approved CONTEXT decision:
  `OutputFileCard`'s `variant` prop is *"INERT … no longer changes the rendered shape — every row
  renders the one quiet uniform style"* (`OutputFileCard.tsx:59-66`) and `is_hero` is
  *"written-but-unread"* (`:54-57`, `MessageItem.tsx:144`). The backend still WRITES `is_hero`;
  nothing reads it.
  Scale reality: **60 of 61 file-bearing runs have exactly ONE file.** Reviving a hero signal for a
  case that occurs once — and inventing a hero flag on the workspace-file path, which has none —
  would be building a pattern for a population of one.

- **D-11: CORRECT BOTH STALE RECORDS, BESIDE THE ORIGINAL — NEVER OVER IT.**
  1. `.planning/ROADMAP.md` Phase 195 **SC#3** — rewrite to name the shipped uniform row, with the
     original text preserved and the 095.1 reversal cited as the reason.
  2. `.claude/skills/sketch-findings-agentic-rag/references/chat-tool-card-unification.md` — record
     the 095.1 reversal. **It still lists sketch 016-A "Hero block" as the WINNER** (§C, §"Output
     files — hero + working", the `.hero` CSS at :163-166) and lists *"a flat, index-ordered output
     list with no hero"* under ❌ anti-patterns (:272). The reversal was never recorded there.
  ⚠ **This is the reason the correction is in scope rather than tidy-up.** A design record and a
  success criterion that both point at retired code are the "a record that is present and WRONG
  answers the auditor and STOPS the audit" failure this project keeps meeting in the hot-file
  ledger. Left alone, the next UI phase builds a hero block from the skill.

- **D-12: ORDERING — newest first (`created_at` DESC).** Puts the just-produced deliverable above
  the template it filled without needing the attribution D-01 declined. Must be a CLIENT-SIDE sort
  pinned by a test — not an unstated backend property.

### Surface reach

- **D-13: THE RUN SURFACE STAYS THE ONLY HOME. Chat gains NO new file affordance.**
  RUN-02 is scoped *"from the run surface"*, and `BUG-260816-05` records the operator's own words
  naming the canvas specifically. The panel already covers the chat side by thread scope.
  ⚠ **D-07 and D-13 are COMPATIBLE and MUST NOT BE CONFLATED.** D-07 re-implements
  `OutputFileCard` on top of the shared row with **zero behaviour change in chat**. D-13 says chat
  gains no NEW capability. A planner reading only one of them will get the blast radius wrong.

- **D-14: `RunCard`'s blind file badge is NOT fixed here — it gets a seed.** Measured: the badge
  derives its count by parsing `output_files` out of `tool_calls` (`RunCard.tsx:181-186`), and a
  workflow emit returns `path`, never `output_files` — so it reads **0** for a real deliverable.
  `ThreadRunLine.tsx` (Phase 194.1's chat run receipt) has **zero** file references at all.
  Fixing it would open `RunCard` (9 phases) and `MessageItem` (29 phases, extraction due) inside a
  phase already converting three files. Recorded as a MEASURED LIE that this phase declines, not as
  an unknown.

- **D-15: THE EMPTY STATES SHIP EXACTLY AS THEY ARE.** The three-way honesty on
  `WorkflowRunPage.tsx:1030-1040` — `"No files yet — this run hasn't written anything."` (live) /
  `"This run produced no files."` (terminal) / **nothing at all while the first read is in flight**
  — is deliberate and correct. **161 of 222 runs hit this path, making it the most-seen state on the
  surface.** It must survive the D-05 conversion unchanged, and that survival should be PINNED by a
  test rather than assumed.

### SC#1 — already satisfied, but PROVE IT FIRST

- **D-16: CONTEXT records SC#1 as MEASURED ALREADY-SATISFIED, and the phase's FIRST task is to
  prove it on a LIVE RUN before changing anything.** The baseline must be a fact, not an inherited
  claim — this project's standing lesson (`188.1`: "a baseline only proves something if it PREDATES
  the change"; "don't inherit unmeasured claims"). If the live run refutes it, scope grows and that
  is the honest order.

### Guardrails

- **D-17: G-5 FIRES, and TWO of the files are INVISIBLE TO THE LEDGER.** Triples re-derived from
  git on 2026-08-17 with the CLAUDE.md recipe (six-digit dated quick-task buckets subtracted), not
  read off the table:

  | File | commits / phases / lines | Ledger status |
  |---|---|---|
  | `frontend/src/pages/WorkflowRunPage.tsx` | 12 / 3 / 1101 | present, *at threshold* — 195 makes it the 4th phase |
  | `frontend/src/components/chat/OutputFileCard.tsx` | 7 / **6** / 187 | ⚠ **ABSENT from the hot-file ledger** |
  | `frontend/src/components/panel/FilesSection.tsx` | 6 / **3** / 277 | ⚠ **ABSENT from the hot-file ledger** |
  | `frontend/src/components/chat/MessageItem.tsx` | 57 / 29 / 856 | present — *extraction due* |
  | `frontend/src/components/chat/RunCard.tsx` | 21 / 9 / 608 | present |
  | `frontend/src/lib/fileIcon.tsx` | 1 / 1 / 105 | not hot |

  **G-5 is HONOURED BY CONSTRUCTION: the extraction (D-05) IS the requirement (RUN-03), and it
  ships as the phase's structural first move rather than after a feature.** No guardrail override is
  requested — the fifth consecutive phase to decline one.
  **OWED IN THIS PHASE (same-commit sync rule):** ledger ROWS in `CLAUDE.md` **and** matching
  sections in `docs/HOT-FILE-LEDGER.md` for `OutputFileCard.tsx` and `FilesSection.tsx`, plus an
  updated `WorkflowRunPage.tsx` row, plus a row for the new `FileRow` component. A row without a
  section, or a section without a row, is drift.

- **D-18: G-2 fires and is DELIBERATELY DECLINED — no sketch.** RUN-03 exists specifically to forbid
  new file UI, and the presentation is already shipped and design-reviewed. The single genuinely-open
  visual question (what many files read like post-095.1) was decided in discussion instead — D-10.
  Recorded as a decision so it reads as a choice, not an omission.

- **D-19: G-7 is not in play** — 195 has run zero gap-closure rounds.

### Acceptance evidence (G-4 — lived experience, DRIVEN not owed)

- **D-20:** Launch a real template workflow → watch it on the run surface → click the produced
  `.docx` → **open the downloaded file**. Plus a side-by-side confirming chat, panel and run page
  render the SAME row. Wire format + screenshot are explicitly insufficient (192, 193.1 and 194 each
  recorded that lesson). ⚠ **Do NOT locate the row by `getElementById`** — D-27 from 192.1; a machine
  check that bypasses the human's task does not verify it.

### Claude's Discretion

- The exact component/file name and prop shape of the shared row (`FileRow` is a suggestion, not a
  lock) — provided D-05's discriminated source, D-06's neutral home and D-08's state preservation hold.
- Whether the shared row is one component with an activation prop or a thin wrapper per surface,
  provided there is exactly ONE icon path, ONE `formatBytes` and ONE row markup when the phase closes.
- The exact wording of D-02's honest region label.
- Test placement and how the count-gate delta is re-measured (see `<code_context>`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` § "Phase 195: Show the Deliverable" — goal, SC#1-3, the measurement flag.
  ⚠ **SC#3 is stale and is corrected BY this phase — see D-11.**
- `.planning/REQUIREMENTS.md` :81-83 — RUN-02, RUN-03, and RUN-02's operator-confirmation note.
- `.planning/seeds/SEED-148-workflow-output-files-not-surfaced.md` — the origin.
  ⚠ **Its §"Three questions to answer before building" Q1 is ANSWERED (yes, the file is on the wire —
  see `<domain>`), and its "grep returns nothing" measurement predates Phase 188-10.** Read it for
  the "what must not be rebuilt" list, not for current state.
- `.planning/reported-bugs/BUG-260816-05-canvas-run-surface-cannot-answer-human-step.md` —
  its `re_open_trigger` names `/gsd:discuss-phase 195` explicitly. **File half folded here; ask-responder
  half stays Phase 198 / NODE-02.** ⚠ Its capability table's *"see produced output files ❌"* row is
  refuted by measurement.

### The shipped file presentation (RUN-03's "must not be rebuilt" set)
- `frontend/src/lib/fileIcon.tsx` — the declared ONE shared per-extension icon module.
- `frontend/src/components/chat/OutputFileCard.tsx` — the chat card; **read :54-66 (inert `variant`,
  unread `is_hero`) and :92-119 (the dead-link state) before designing the shared row.**
- `frontend/src/components/panel/FilesSection.tsx` — the panel list; its own icon map + copied `formatBytes`.
- `frontend/src/pages/WorkflowRunPage.tsx` :123-135, :170-188, :420-445, :1015-1090 — the existing
  deliverable region, its hand-rolled `iconFor`, and the comment recording why the page lists files itself.
- `frontend/src/components/layout/ChatLayout.tsx` :775-795 — why the run view renders its own
  deliverable list (no panel, no composer on that side of the branch).
- `frontend/src/lib/api.ts` :1575 (`downloadSandboxOutput`), :1644 (`downloadWorkspaceFile`) — the two
  download seams the discriminated source must cover.

### Design record — ⚠ CONTAINS A KNOWN-STALE CLAIM
- `.claude/skills/sketch-findings-agentic-rag/references/chat-tool-card-unification.md` §C,
  §"Output files — hero + working", :272 — records sketch **016-A Hero block as the winner** and a
  no-hero list as an anti-pattern. **CONTRADICTED BY SHIPPED CODE since Phase 095.1. Corrected by
  this phase (D-11). Do not build from it unamended.**
- Load via `Skill("sketch-findings-agentic-rag")`, not by reading the manifest.

### Backend — the emit → file path (read-only for this phase)
- `backend/app/services/tool_dispatcher.py` :3200-3230, :3550-3590 — `_handle_render_template`
  persist + the `workspace_file_written` emit.
- `backend/app/services/harness/phase_types.py` :1161-1192 (`_ProducerStreamCtx`), :1530-1600
  (`_exec_llm_emit` success path returning `output_file` / `path`).
- `backend/app/services/template_asset_service.py` :189-310 — what `run_claim` actually is.

### Project rules
- `CLAUDE.md` § "Workflow guardrails" (G-2, G-4, G-5, G-7) and § "Hot-file ledger" — the re-derive
  recipe and the same-commit sync rule.
- `docs/HOT-FILE-LEDGER.md` — the per-file detail sections owed by D-17.
- `CLAUDE.md` § "Parallel execution" — `GSD_VITEST_MAX_WORKERS=2`, worktree bootstrap.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/fileIcon.tsx`** — already the intended single icon source; needs consumers, not changes.
- **`useWorkspaceFiles(threadId)`** (`StreamsProvider`) — already wired on the run page and reconciled
  on (re)connect; the deliverable data path is DONE. `WorkflowRunPage.tsx:420-431` carries a comment
  recording that the reconcile is keyed on the SSE factory's `threadId` — read it before touching.
- **`downloadWorkspaceFile(threadId, fileId, filename)`** — the working download seam for
  deliverables; the run page already calls it (`:552-557`).
- **`OutputFileCard`'s dead-link + `supersedes` states** — behaviour to preserve verbatim (D-08).

### Established Patterns
- **A run is 1:1 with a thread** (`WorkflowRunPage.tsx:129`) — measured 226 runs / 222 threads. This
  is what makes D-01 defensible.
- **The run view renders no message list, no composer and no panel** — a structural property of
  `ChatLayout`'s branch, pinned by a source fence in `ChatLayout.launch.test.tsx`.
  ⚠ **That fence measures that certain JSX TAGS appear only before the split point, so prose that
  spells a tag name breaks a real measurement** (the 187-24 lesson, hit three times in Phase 188).
  Comments and docblocks in these files name components in WORDS on purpose.
- **`StopControl.baseline.test.tsx` imports `WorkflowRunPage.tsx?raw`** and greps the source. A
  refactor of that file can break source-level fences that have nothing to do with files — check
  before assuming a failure is yours.

### Integration Points
- `WorkflowRunPage.tsx` `run-deliverables` section → the new shared row (the primary conversion).
- `OutputFileCard.tsx` and `FilesSection.tsx` → the same row, behaviour unchanged (D-07/D-08).
- No backend integration point. **This phase writes no Python and ships no migration.**

### Gate + measurement notes
- Frontend count gate: re-derive with `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`
  and read the VERDICT line. The contract is *no per-file DECREASE* + *zero failing* — **a larger
  grand total is the gate working.** The last recorded reading was `3918 / failed 0 / 75 pinned`;
  treat that as stale on sight and re-measure. **Capture failing filenames BEFORE re-running anything.**
- `tsc` baseline was **33** unmoved at Phase 194.1; verify with `-p tsconfig.app.json` (a bare
  `tsc --noEmit` checks ZERO files here).

</code_context>

<specifics>
## Specific Ideas

- The operator's own words for this surface, recorded in `BUG-260816-05` (2026-08-16):
  > *"overall in the canvas when I run a workflow I should be able to … watch it and see in the
  > future files it produced, the human in the loop, the everything completely it should be
  > functional in the canvas"*
  This phase takes the **files** clause only. The bar is that the canvas is a place work can be
  *finished*, not merely watched — and the acceptance test (D-20) is finishing it: download the
  file and open it.

- Recorded from SEED-148 and adopted: *"Any plan that proposes a new card component should be
  challenged."* The shared row in D-05 is an EXTRACTION of what exists, not a new card. A plan that
  authors a novel file card has misread this phase.

</specifics>

<deferred>
## Deferred Ideas

- **Run-level file attribution** (a real `run_id` on `workspace_files`, written by the emit and
  `execute_code` persist paths). Deferred by D-01. **Re-open trigger:** a workflow-run thread that is
  ALSO an agent chat becomes common (today: 1 of 222), or any user reports unrelated files shown as a
  run's output.
- **`RunCard`'s file badge reads 0 for a workflow deliverable** and `ThreadRunLine` shows no file at
  all (D-14). A measured lie, deliberately not fixed here. **Re-open trigger:** any phase opening
  `RunCard.tsx` or `MessageItem.tsx`, or a user reporting "chat says my workflow made nothing."
  → file as a seed during planning.
- **`is_hero` is still WRITTEN by the backend and read by nothing** (since 095.1). Retiring the write
  is a backend cleanup outside this phase. **Re-open trigger:** any phase touching
  `harvest_output_files` or `final_output_files`.
- **Office/PDF in-panel preview** — REQUIREMENTS' deferred table says its trigger *"fires once RUN-02
  makes produced files visible."* **The trigger FIRES with this phase and the answer is recorded as
  NOT NOW** (D-09), so the deferral is renewed knowingly rather than by silence.
- **The ask-responder mount on the run surface** (`BUG-260816-05`'s second half) — stays Phase 198 /
  NODE-02. It is new user-facing capability; G-7's rule that a closure round may never add one applies
  by analogy to a phase scoped to files.
- **`BUG-260813-01`** (workflow canvas stays dark in light mode; `colorMode` hardcoded) — overlaps
  because `WorkflowRunPage` embeds `WorkflowCanvas`, but was NOT folded. Stays `open`.
- **`lib/fileIcons.tsx` / `getFileIcon`** (documents + health surfaces) — a fifth file-icon path,
  explicitly NOT unified here. Naming it prevents an accidental sweep. **Re-open trigger:** a
  documents-surface phase touching file presentation.

### Reviewed Todos (not folded)
None — no `todo.match-phase` matches for this phase.

</deferred>

---

*Phase: 195-Show the Deliverable*
*Context gathered: 2026-08-17*
