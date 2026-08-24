# Phase 195: Show the Deliverable - Research

**Researched:** 2026-08-17
**Domain:** Frontend consolidation (React 19 + TS + Tailwind) — collapsing four shipped file presentations into one, on an already-working data path
**Confidence:** HIGH (every load-bearing claim is file:line, command output, or a live-DB query run in this session)

---

## Findings that change the plan

Eleven findings. Nine are new information CONTEXT does not carry; two narrow or correct a CONTEXT
claim. **No CONTEXT decision is refuted** — D-01 through D-20 all survive measurement, and the
D-01 DB histogram reproduced *exactly*. What changes is the **blast radius** and the **order of work**.

| # | Finding | Planning consequence |
|---|---|---|
| **F1** | ⚠ **A SHIPPED SOURCE FENCE ASSERTS THE EXACT DUPLICATION THIS PHASE EXISTS TO REMOVE.** `WorkflowRunPage.test.tsx:1467-1468` reads `expect(codeOf(pageSource)).toMatch(/function formatBytes/)` and `.toMatch(/function iconFor/)`. Extracting either one turns this case RED. | The fence must be **REWRITTEN IN PLACE and INVERTED**, with the original quoted verbatim (the `194.1-07` `<StopControl` precedent, `StopControl.baseline.test.tsx:513-573`). It must NOT be deleted — the suite is pinned at **102 EXACT** with zero slack, so a deletion forces a pin LOWERING, which needs plan authorisation. Inverting inside the same `it()` keeps the count at 102 and needs no pin edit. |
| **F2** | ⚠ **The same fence CONSTRAINS THE ARCHITECTURE, not just the diff.** Two RAW-source absence arms bind: `expect(pageSource).not.toMatch(/useViewingThread/)` (`:1464`) and `expect(pageSource).not.toMatch(/FilePreview/)` (`:1478`). | The shared row **MUST be purely presentational**: it may not call `useViewingThread()` and may not import or name `FilePreview`. D-09's "parameterise the activation" is therefore **a callback prop**, never a preview import. This is the single strongest architectural constraint in the phase and it is mechanically enforced today. |
| **F3** | **The D-02 relabel REDS two live test cases.** The literal `"What this run produced"` appears in exactly three places: `WorkflowRunPage.tsx:122` (the const) and `WorkflowRunPage.test.tsx:897` **and `:1023`**. | The relabel is a **three-file-location** edit, not one. `:1023` is inside the *"claims NEITHER while the first read is still in flight"* case (D-15's third arm) — so the D-02 and D-15 tasks touch the same test case and should be ONE plan, not two. |
| **F4** | **D-02 and D-15 look contradictory and are NOT — record the reasoning so no plan "fixes" the empty copy.** `COPY_NO_FILES_TERMINAL = "This run produced no files."` is a *run-scope* claim on a *thread-scope* list. It is nonetheless TRUE: run ⊆ thread, so an empty thread-scoped list entails the run produced nothing. The overclaim only bites in the **non-empty** direction. | D-02 changes **only the heading**. The two empty-state strings ship byte-identical (D-15) and `:1489-1490`'s "each written exactly once" fence stays green. A plan that also rewords the empty copy breaks D-15 in the name of D-02. |
| **F5** | ⚠ **`OutputFileCard`'s `supersedes` "Replaces: …" subline has ZERO test coverage anywhere in the tree.** `grep -rn "supersedes\|Replaces:" src --include=*.test.*` returns 19 hits, **all** in `relationships/` / `useDraftPersistence` / `SkillTunerPage` — none about this component. The `data-variant` attribute is likewise uncovered (`grep` → 0). The dead-link half IS covered (`MessageItem.finalOutputs.test.tsx:111-124`). | **D-08 is protected on ONE of its two named states.** Wave 0 owes a **characterization plant** for `supersedes` against the PRE-change component, or the "byte-identical survival" claim rests on nothing. This is verbatim the Phase-194 `ActiveRunsTray.test.tsx` lesson — VALIDATION said "extend", the file did not exist. |
| **F6** | **`OutputFileCard` has TWO call sites, not one.** `MessageItem.tsx:158` and `chat/tool-bodies/ExecuteCodeBody.tsx:358`. | Keeping `OutputFileCard`'s **public prop shape byte-identical** leaves BOTH untouched → `MessageItem.tsx` (29 phases, *extraction due*) is never opened → **D-14's decline is honoured structurally rather than by discipline**, and no `MessageItem` ledger update is owed. A plan that widens `OutputFileCard`'s props instead opens a 29-phase G-5 file. |
| **F7** | ⚠ **D-12's SORT KEY IS ABSENT ON EXACTLY THE FILE D-12 EXISTS TO SURFACE.** The live SSE builds the file from `id/path/version/size_bytes/mime_type` only — **no `created_at`** (`lib/api.ts:845-851`) — and the store **APPENDS** a new path at the end (`StreamsProvider.tsx:2947-2954` `[...prev, merged]`). The list route orders by **`path`** and only *then* supplies `created_at` (`backend/app/api/workspace.py:326-330`). | A naive `created_at DESC` places the **just-produced live deliverable LAST** (undefined key) until the next reconcile. The comparator must treat a **missing `created_at` as newest**, and BOTH regimes (live-appended vs reconciled) need their own pinned case. Do **not** fix this by teaching the SSE to stamp `created_at` — that edits `StreamsProvider.tsx` (33 phases). |
| **F8** | ⚠ **The run page's id-less row is a SILENT dead row** — a non-interactive `<div>` with no copy (`WorkflowRunPage.tsx:1074-1088`). That is the exact ❌ pattern `OutputFileCard`'s D-08 dead state was built to remove (`BUG-260523-03`; the design record sanctions `.dl-btn.dead`, `chat-tool-card-unification.md:167`). | Unifying **CHANGES run-page behaviour** (an improvement): the id-less row gains *"Download unavailable — this file has no link"*. Its fence `expect(region.querySelectorAll("button")).toHaveLength(0)` (`:991`) **survives only because `OutputFileCard`'s dead affordance is a `<span aria-disabled>`, not a `<button>`** (`OutputFileCard.tsx:107-117`). State this in the plan or the fence looks like luck. |
| **F9** | ⚠ **THERE IS A FIFTH FILE PRESENTATION AND CONTEXT DOES NOT NAME IT.** `panel/SeamCard.tsx:72-80` renders a `workspace_write` chip with a hardcoded `<FileText className="h-3.5 w-3.5">` — **no extension mapping at all** — plus `· v{version}`. Its own docblock (`:10`) claims it *"reuses OutputFileCard's chip shape"*, which is **FALSE** (it imports neither `fileIcon` nor `formatBytes`). | **Declare it OUT of scope explicitly**, the way D-05 handles `lib/fileIcons.tsx`. It is a chip in a run receipt, not a file row: no size, no download, no icon map to unify. Naming it converts a future SC#2 dispute ("you left a fifth one") into a recorded boundary. |
| **F10** | **Adopting `fileIcon()` is a VISIBLE change to the panel and the run page, and the two design records disagree about it.** `fileIcon()` renders a **stacked, hex-coloured Lucide glyph + a mono `.EXT` ribbon** (`lib/fileIcon.tsx:90-104`), used at **30 px** in chat. Both other surfaces render a flat **16 px monochrome** glyph on a theme token (`text-panel-muted-foreground` — a deliberate Phase 088-05 AA decision). `chat-tool-card-unification.md:274` forbids the flat form (*"❌ Solid color+text icon tiles… Use a real file icon (…colored extension ribbon)"*); `file-browser-and-diff.md:31-38` specifies the panel row at `padding:8px 9px` / `text-xs` / `meta 10px` with no such icon. | This is the phase's one genuinely open visual question and D-18 declined a sketch. **Recommendation: two additive optional params on `fileIcon()`** (`sizePx` already exists; add `tone: "category" \| "muted"` and `ribbon?: boolean`). At `{sizePx:16, tone:"muted", ribbon:false}` the panel renders its shipped glyph; chat keeps `{sizePx:30}`. That is the ONLY construction satisfying *"exactly ONE icon path"* **and** both surfaces' shipped contrast decisions. It does mean editing `fileIcon.tsx`, which CONTEXT's `<code_context>` said *"needs consumers, not changes"* — a 105-line, 1-phase, 1-consumer module, so the cost is near zero, but the note should be corrected rather than silently contradicted. |
| **F11** | ✅ **CONTEXT's `ChatLayout.launch.test.tsx` warning is NARROWER than stated — and the live hazard is elsewhere.** That fence's tag sweep runs over `codeOf(chatLayoutSource)`, which **strips block and line comments** before indexing (`ChatLayout.launch.test.tsx:455-460`; the 188-07/188-08 resolution). Prose spelling `<ChatArea>` cannot break it. Only its final case uses RAW source, and its needles are `PostMessageResponse` / `res.run_id` — in `ChatLayout.tsx`, a file this phase does not touch. | The 187-24 hazard for **this** phase is real but lives in three RAW-source predicates, all of which the phase's own edits can trip: `StopControl.baseline.test.tsx:597` counts `/<StopControl/g` on **raw** `WorkflowRunPage.tsx` expecting exactly **1**; `WorkflowRunPage.test.tsx:1463` forbids `FilesSection` in raw page source; `:1478` forbids `FilePreview`. **A docblock in `WorkflowRunPage.tsx` explaining the extraction must not write those four tokens.** Name components in WORDS there. |

**One stale record found that is NOT in scope and should not be fixed here:**
`backend/app/services/tool_dispatcher.py:3570` comments *"VERBATIM reuse of the `workspace_file_written` event **so OutputFileCard renders it***". `OutputFileCard` never renders that event — the panel's `FilesSection` does, via `useWorkspaceFiles`. The phase writes no Python (D-07 / `<code_context>`); record it as a seed-worthy observation, not a task.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `195-CONTEXT.md` `<decisions>`. **All twenty survived verification; see
§ "CONTEXT premise verification" for the evidence per decision.**

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

- **D-16: CONTEXT records SC#1 as MEASURED ALREADY-SATISFIED, and the phase's FIRST task is to
  prove it on a LIVE RUN before changing anything.** The baseline must be a fact, not an inherited
  claim — this project's standing lesson (`188.1`: "a baseline only proves something if it PREDATES
  the change"; "don't inherit unmeasured claims"). If the live run refutes it, scope grows and that
  is the honest order.

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

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **RUN-02** | *A workflow that produces a file shows that file to the user when the run finishes, from the run surface.* | **Already satisfied in shipped source** — the deliverable region at `WorkflowRunPage.tsx:1022-1094` (`data-testid="run-deliverables"`), fed by `useWorkspaceFiles(run?.thread_id)` (`:429-433`) and downloaded via `downloadWorkspaceFile(runThreadId, fileId, baseName(path))` (`:552-557`), with 102 passing cases in `WorkflowRunPage.test.tsx`. § "The D-16 live baseline" gives the procedure that PROVES it on a live run before anything changes; § "Findings F3/F4" gives the one real change owed (D-02's honest heading). Empirical proof the data exists: 15 published `llm_emit` workflows have produced files; `northwind-qbr-fa65a43c` produced a 38-40 KB `.docx` on **6** completed runs through 2026-08-16. |
| **RUN-03** | *Where a produced file is shown, it reuses the shipped output-file presentation rather than a second one.* | § "The five presentations, prop by prop" maps every current surface at prop level; § "The recommended shared row" gives a concrete `asChild`-based construction (Radix Slot, already a dependency, `className` merging verified in `node_modules/@radix-ui/react-slot/dist/*.mjs:91-93`) that collapses icon path + `formatBytes` + row markup to one each while preserving three different a11y root elements and three activations; § "Findings F1/F2/F8/F9/F10" names every fence and design record the collapse touches. |
</phase_requirements>

---

## Summary

Phase 195 is a **frontend consolidation on a working data path**. The wire, the persist, the read
hook, the download seam and the run-surface region all shipped — measured, not assumed. What has
NOT shipped is *one* presentation: the same file row is hand-written **five** times across the app
(CONTEXT names four; § F9 finds the fifth), with three independent icon mappings, three copies of
`formatBytes` — one of them commented *"copied verbatim from OutputFileCard.tsx:24-28 … keep
byte-for-byte identical"* — and three different root elements with three different a11y contracts.

The hard part is not the extraction. It is that **the run page's own test suite contains a source
fence asserting the duplication exists** (`toMatch(/function formatBytes/)`, `toMatch(/function
iconFor/)`), plus two RAW-source absence arms that silently dictate the shared row's architecture:
it may not read `useViewingThread` and may not name `FilePreview`. Those two absences, taken
together with the panel's need for a preview activation and the chat card's need for an `<a
href download>`, force a specific construction — **a purely presentational row whose wrapper element
is supplied by the caller** — and rule out the obvious "one component with an `activation` enum"
shape. Radix `Slot` (`asChild`) is already a dependency and already used in `ui/button.tsx`, so this
costs nothing new.

Two measurement gaps matter more than anything stylistic. First, `OutputFileCard`'s `supersedes`
subline — one of the two states D-08 declares must survive byte-identical — **has zero test coverage
anywhere in the repository**, so the survival claim currently rests on nothing; Wave 0 owes a
characterization plant against the pre-change component. Second, D-12's `created_at DESC` sort key
is **absent from the live SSE payload**, and the store appends new paths at the end — so a naive
descending sort puts the just-produced deliverable *last*, which is the exact inverse of the
decision's intent.

**Primary recommendation:** Wave 0 = prove SC#1 on a live `northwind-qbr-fa65a43c` run and plant
the three missing characterization fences (`supersedes`, the run page's silent dead row, the D-12
two-regime sort). Wave 1 = ship `components/files/` (`fileRowUtils.ts` + `FileRow.tsx` with
`asChild`) and add its TARGETS **and** BASELINE entries in the same commit. Wave 2 = convert the
three surfaces in one plan each, keeping `OutputFileCard`'s public props byte-identical so
`MessageItem.tsx` and `ExecuteCodeBody.tsx` are never opened. Wave 3 = D-02's relabel (three
locations), D-11's two record corrections (nine sites, not four), and the D-17 ledger sync.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render a file row (icon, name, size, subline, affordance) | **Browser / Client** | — | Pure presentation. No data fetch, no auth, no persistence. This is the whole of RUN-03. |
| Resolve which files belong to a run | **API / Backend** (already shipped) | Browser (thread-scope read) | `GET /threads/{tid}/workspace/files` (`workspace.py:305-335`) with RLS + `_verify_thread_ownership`. D-01 declines to add run attribution, so the tier boundary is unchanged. |
| Order the list newest-first | **Browser / Client** | — | D-12 makes this explicitly client-side. Backend orders by `path` (`workspace.py:330`) and this phase does not change it. § F7 is why the client comparator needs two regimes. |
| Download the bytes | **API / Backend** (already shipped) | Browser (blob + programmatic `<a download>`) | `downloadSandboxOutput` / `downloadWorkspaceFile` (`lib/api.ts:1575`, `:1644`). Bearer-authed fetch → blob → `<a download>` click, because a raw anchor 401s. Both throw `DownloadError` with an identical status contract. |
| Preview a file | **Browser / Client** (panel only) | — | `FilePreview`, panel-only. D-09 keeps it out of chat and the run page, and `WorkflowRunPage.test.tsx:1478` mechanically enforces the absence. |
| Emit the deliverable onto the wire | **API / Backend** (already shipped) | — | `_handle_render_template` → `ws_write_file` → `emit(… 'workspace_file_written' …)` (`tool_dispatcher.py:3553-3578`). **Read-only for this phase; the phase writes no Python.** |
| Persist run↔file attribution | **— (declined)** | — | D-01. `run_claim` is 100% NULL and belongs to Phase 141 template-asset isolation; there is no attribution tier and none is added. |

---

## The five presentations, prop by prop (R1)

**Verified by reading all five files in full this session.** Everything below is `[VERIFIED: source]`.

### Element, identity and activation

| | `OutputFileCard` (chat) | `FilesSection` (panel) | `WorkflowRunPage` (run) | `SeamCard` chip (§F9) | `lib/fileIcons.tsx` |
|---|---|---|---|---|---|
| Root element | `<a href download target=_blank>` (`:144-149`) — **or** a plain `<div data-dead="true">` when `url` is missing (`:92-97`) | `<div role="option" aria-selected tabIndex>` inside `<div role="listbox">` (`:212-229`) | `<ul role="list"><li><button type=button>` (`:1040-1053`) — **or** a plain `<li><div>` when `id` is missing (`:1074-1081`) | `<span class="inline-flex">` (`:73`) | n/a — a helper |
| Identity | `{ filename: string; url?: string }` | `WorkspaceFile` — key is `f.id ?? f.path` (`:91-93`) | `WorkspaceFile` — key is `fileId ?? file.path` (`:1046`) | `payload.path` (untyped chip) | filename string |
| Activation | `handleClick` → `e.preventDefault()` → `downloadSandboxOutput(file.url!, file.filename)` (`:122-141`) | `openFile` → `setSelected(file)` → **full-replace with `<FilePreview>`** (`:148-153`, `:191-193`); + `Enter`/`Space`, `ArrowUp`/`ArrowDown` roving (`:164-188`) | `onDownload` → `downloadWorkspaceFile(runThreadId, fileId, baseName(file.path))` (`:548-560`) | none — inert | n/a |
| a11y contract | anchor; `aria-disabled={downloading}` | `role=listbox`/`option` + roving `tabIndex` + arrows; axe-clean cases at `FilesSection.test.tsx:102,107` | `aria-label={`Download ${name} (${size})`}`, `title={file.path}`; **`aria-hidden` on both glyphs** | `aria-hidden` glyph | n/a |
| Consumers | **TWO**: `MessageItem.tsx:158`, `tool-bodies/ExecuteCodeBody.tsx:358` | ONE: `WorkspacePanel.tsx:464` | inline | inline | `health/GovernanceRow`, `health/HealthDocumentRow`, `ingestion/DocumentList`, `metadata/DocumentDetailPanel` |

### Icon, label, meta, extras

| | chat | panel | run | SeamCard |
|---|---|---|---|---|
| Icon | `fileIcon(file.filename, 30)` — **hex-coloured Lucide glyph + stacked mono `.EXT` ribbon**, `flex-col`, `aria-hidden` (`lib/fileIcon.tsx:90-104`) | inline `iconFor(file)` (`:52-71`) → bare `<Icon className="h-4 w-4 text-panel-muted-foreground">` | own `iconFor(file)` (`:170-188`, **mime/ext logic identical to the panel's**) → `<Icon className="h-4 w-4 text-muted-foreground">` | hardcoded `<FileText className="h-3.5 w-3.5">` — **no mapping at all** |
| Visible label | `file.filename`, `font-mono truncate text-foreground/80`, `text-xs` | **`file.path`** (full path), `font-mono text-[13px] text-foreground/90` | **`baseName(file.path)`**, `font-mono text-[11px] text-foreground/90`, full path in `title` | `payload.path`, `font-mono text-[13px]` |
| Size | `formatBytes(file.size)` **only when `size != null`** (`:177-179`) | `formatBytes(file.size_bytes)` always (`:266`) | `formatBytes(file.size_bytes)` always (`:1044`) | **none** |
| Extra meta | — | `` · v{version} `` when `version != null` (`:267`) | — | `` · v{version} `` |
| Trailing affordance | `<Download className="w-3.5 h-3.5 text-primary">` **or** `<Loader2 … animate-spin>` while downloading (`:180-184`) | **none** | `<Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden>` (`:1061`) | none |
| Subline / badges | `supersedes` → *"Replaces: {x}"* `text-[10px] text-muted-foreground` (`:166-172`, and again in the dead branch `:101-105`) | `kind === "template_input"` → **"Template" badge + live expiry caption** (amber `< 1h`) (`:246-262`) | — | — |
| Error surfacing | **in-row**, `text-red-400 text-[10px]`, red border, **auto-clears after 3 s** (`:136-137`, `:173-175`) | none | **section-level**, `data-testid="run-download-error"`, **does not auto-clear** (`:1091-1095`) | — |
| Dead state | `data-dead="true"` + `<span aria-disabled="true" title="Download unavailable — this file has no link">` with red tokens (`:92-119`) | n/a | ⚠ **silent** non-interactive `<div>` — no copy, no cue (`:1074-1088`) — see §F8 | n/a |
| Other | inert `data-variant` (`:96`, `:151`); `is_hero` accepted and never read (`:52-57`) | fresh-write `animate-fileFlash` (`:234`); `<TemplateUpload/>` above the list (`:203`, `:211`) | `<h2>` heading + three-way empty state (`:1027-1040`) | — |

### The two download seams — verified signatures

```ts
// frontend/src/lib/api.ts:1566-1573
export class DownloadError extends Error {
  readonly status: number | "network"
  constructor(status: number | "network", message: string)   // .name = "DownloadError"
}

// :1575 — chat / sandbox outputs
export async function downloadSandboxOutput(relativeUrl: string, filename: string): Promise<void>
//   URL: relativeUrl.startsWith("/") ? API_BASE + relativeUrl : relativeUrl
//   401 → "Session expired — please refresh the page and try again."
//   404 → "File not found."     (missing-and-IDOR collapsed, mirrors sandbox_outputs.py:48-67)
//   other non-2xx → "Download failed — try again."   |  network → status "network", same copy

// :1644 — panel / run page / workspace deliverables
export async function downloadWorkspaceFile(threadId: string, fileId: string, filename: string): Promise<void>
//   URL: `${API_BASE}/threads/${threadId}/workspace/files/${fileId}/raw`
//   IDENTICAL status/message contract (verified line by line, :1657-1675)
```

**Both return `Promise<void>` and throw the same `DownloadError` shape.** ⇒ The discriminated source
can share ONE error handler; only the call differs. `[VERIFIED: source]`

### `fileIcon` vs `fileIcons` — no accidental coupling

```
$ grep -rn 'from "@/lib/fileIcon"'  frontend/src   →  1 hit:  components/chat/OutputFileCard.tsx:5
$ grep -rn 'lib/fileIcons'          frontend/src   →  4 hits: health/GovernanceRow.tsx:16
                                                              health/HealthDocumentRow.tsx:13
                                                              ingestion/DocumentList.tsx:21
                                                              metadata/DocumentDetailPanel.tsx:37
```

**CONFIRMED: zero overlap.** `fileIcon` (singular, 105 L, exports `fileIcon(filename, sizePx?)`) has
exactly one consumer. `fileIcons` (plural, 61 L, exports `getFileIcon(filename)`) has four, all on
the documents/health side, none touching a phase-195 surface. `fileIcons.tsx` can be left alone with
zero risk of transitive coupling. `[VERIFIED: grep]`

---

## The recommended shared row (R1 deliverable)

### Why one component with an `activation` prop does NOT work

Three independent blockers, each measured:

1. **Three different root elements are each load-bearding.** The chat card must stay an `<a href
   download>` so right-click *"Save link as"* has a real target (a recorded D-067.3-R2-03 trade-off,
   `OutputFileCard.tsx:145`). The panel row must stay `role="option"` inside `role="listbox"` with
   roving `tabIndex` — two axe cases pin it (`FilesSection.test.tsx:102,107`). The run row must stay
   a `<button>` inside `<li>` inside `<ul role="list">` — pinned by
   `WorkflowRunPage.test.tsx:968-971` (`[role="list"]` non-null, `li` count) and `:950-953`
   (`querySelectorAll("button")` length **exactly 1**, with an exact `aria-label`).
2. **`WorkflowRunPage.test.tsx:1478` forbids the token `FilePreview` in raw page source.** If the row
   owned the preview activation it would import `FilePreview`; even a docblock in the page explaining
   that would RED the fence.
3. **`:1464` forbids the token `useViewingThread` in raw page source.** So the row cannot be a
   hook-reading component — the panel must keep its own `useViewingThread()` call at the SECTION
   level.

### The construction that does work — `asChild` via Radix `Slot`

`@radix-ui/react-slot@^1.2.4` is already in `package.json:27` and already used by
`components/ui/button.tsx:2`. **`className` and `style` merging verified** in the installed package
(`node_modules/@radix-ui/react-slot/dist/*.mjs:91-93` handles both propNames explicitly), so the row
can own its layout classes while the caller supplies the element. `[VERIFIED: node_modules source]`

```ts
// frontend/src/components/files/fileRowUtils.ts  — the ONE helper module (pure, no React)

/** The D-05 discriminated source. `unavailable` is the third arm the two live
 *  surfaces already have and CONTEXT's two-arm shape omits: chat when `url` is
 *  absent (OutputFileCard.tsx:91) and the run page when `id` is absent
 *  (WorkflowRunPage.tsx:1045). Making it explicit is what lets ONE row render
 *  the dead state instead of two surfaces disagreeing about it (see §F8). */
export type FileSource =
  | { kind: "sandbox";   url: string }
  | { kind: "workspace"; threadId: string; fileId: string }
  | { kind: "unavailable" }

/** The ONE copy. Byte-identical to OutputFileCard.tsx:25-29 / FilesSection.tsx:38-42
 *  / WorkflowRunPage.tsx:154-158 — all three are already identical, so this is a
 *  hoist and never a re-derivation. */
export function formatBytes(bytes: number): string

/** The ONE copy. Was WorkflowRunPage.tsx:161-163. */
export function baseName(path: string): string

/** The ONE download dispatcher. Both seams share DownloadError's status contract
 *  (verified lib/api.ts:1600-1618 vs :1657-1675), so one catch serves both. */
export function downloadFrom(src: FileSource, filename: string): Promise<void>

/** D-12's comparator. ⚠ TWO REGIMES, see §F7: a live-appended file carries NO
 *  `created_at` (lib/api.ts:845-851) and is by construction the newest, so a
 *  missing key sorts FIRST. Both arms need their own pinned case. */
export function byNewestFirst(a: { created_at?: string }, b: { created_at?: string }): number
```

```tsx
// frontend/src/components/files/FileRow.tsx  — the ONE row markup
export interface FileRowProps {
  /** Whether to render the caller's element instead of the default <div>.
   *  The wrapper stays per-surface (three a11y contracts); the CLASSES and the
   *  CHILDREN live only here, which is what makes "ONE row markup" literal. */
  asChild?: boolean
  children?: ReactNode          // the wrapper element when asChild

  /** The visible label. Callers derive it: `filename` (chat), `file.path`
   *  (panel — full path is the shipped label), `baseName(file.path)` (run). */
  name: string
  /** Size cell. OMITTED renders no cell — OutputFileCard's `size?` case. */
  sizeBytes?: number
  /** Appended after the size, e.g. " · v2". Panel only. */
  metaSuffix?: string
  /** D-08: the "Replaces: …" subline. */
  supersedes?: string
  /** Chat's in-row error line. */
  errorText?: string | null
  /** Trailing affordance. "dead" renders the D-08 <span aria-disabled> — NOT a
   *  <button>, which is why WorkflowRunPage.test.tsx:991's `0 buttons` survives. */
  trailing?: "download" | "spinner" | "dead" | "none"
  /** Rendered BEFORE the affordance — the panel's Template badge + expiry caption. */
  trailingSlot?: ReactNode
  /** § F10: the ONE icon path, parameterised so a 384px panel row and a 30px
   *  chat glyph are the same code. */
  icon?: { sizePx?: number; tone?: "category" | "muted"; ribbon?: boolean }
  /** D-08's inert data-variant, preserved verbatim. */
  variant?: "hero" | "working"
  className?: string
}
```

Then **three thin adapters**, each ~30-50 lines:

| Surface | Adapter shape | Why it satisfies the constraints |
|---|---|---|
| chat | `OutputFileCard` keeps its **public props byte-identical** (`{file:{filename,url?,size?,supersedes?,is_hero?}, variant?}`) and renders `<FileRow asChild …><a href={resolveOutputUrl(url)} download onClick={handleClick}/></FileRow>` | § F6: `MessageItem.tsx` and `ExecuteCodeBody.tsx` are **never opened** ⇒ D-14 honoured structurally, no `MessageItem` ledger update owed, D-13's "no new chat affordance" is true by construction. |
| panel | `FilesSection` keeps `useViewingThread()`, the listbox, roving tabindex, arrows, the flash, `TemplateUpload` and the badge. Each row: `<FileRow asChild trailing="none" trailingSlot={badge} metaSuffix={verSuffix} …><div role="option" aria-selected tabIndex onClick={openFile} onKeyDown={…}/></FileRow>` | Preview activation is injected by the SECTION, so the row never names `FilePreview`. All 11 shipped cases keep passing. |
| run | `WorkflowRunPage` keeps the `<h2>`, the three-way empty state, the `<ul role="list"><li>`, `onDownload` and the section-level error. Each row: `<FileRow asChild …><button type="button" onClick title={file.path} aria-label={`Download ${name} (${size})`}/></FileRow>` — and `trailing="dead"` when `file.id` is absent | Empty-state strings stay in the page ⇒ `:1489-1490` green. Exactly one `<button>` per row ⇒ `:951` green. Zero buttons on the id-less row (the dead affordance is a `<span>`) ⇒ `:991` green. No `useViewingThread`, no `FilePreview`, no `FilesSection` token ⇒ `:1464`/`:1463`/`:1478` green. |

**SC#2 accounting at close:** ONE `formatBytes` (`fileRowUtils.ts`), ONE icon path (`lib/fileIcon.tsx`
with the § F10 params), ONE row markup + classes (`FileRow.tsx`), ONE download dispatcher. Three
wrapper elements remain — deliberately, because they are three different a11y contracts, and each is
pinned by a shipped test that would red if collapsed.

---

## Runtime State Inventory

Included because the phase is a refactor. **Every category answered explicitly.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None — verified.** No schema change, no data migration. `workspace_files` is read-only for this phase (`select` at `workspace.py:326`). ⚠ Two schema facts worth carrying: **`workspace_files` has NO `version` column** (verified via `information_schema.columns` — versions live in `workspace_file_versions` and the API/write-result supplies `version`), and **zero rows carry `kind='template_input'`** (`select kind, count(*)` → `NULL: 84, 'agent': 2`), so `FilesSection`'s Template-badge branch is unexercised by all current workflow data. | none |
| Live service config | **None — verified.** No n8n/Datadog/Tailscale/Cloudflare surface. Frontend-only phase. | none |
| OS-registered state | **None — verified.** No Task Scheduler / pm2 / systemd artefact. | none |
| Secrets/env vars | **None new.** `VITE_API_BASE_URL` is read by `OutputFileCard.tsx:13` (with the recorded reason: `API_BASE` is not exported from `lib/api.ts`). If the extraction moves `resolveOutputUrl` into `components/files/`, the env read moves with it — **same var, same value, no `.env` change, and `deploy/onebox.env.example` needs no edit.** | none (verify the var name is unchanged) |
| Build artifacts | **None.** No `pyproject.toml`, no egg-info, no Docker tag, no `SANDBOX_IMAGE` change. `docs/SANDBOX-PACKAGES.md` and `scripts/check-deploy-drift.sh` are untouched. | none |

**Cross-cutting rename check:** the phase creates a new directory `frontend/src/components/files/`
(verified absent today: `ls` → *No such file or directory*). No file is renamed or deleted, so no
import-path sweep is owed beyond the three adapters' own imports.

---

## Test fences this phase will break (R2) — exhaustive

### Every `?raw` sweep target in the repository

```
$ grep -rhoE '(from|import\()\s*"[^"]+\?raw"' frontend/src --include=*.test.tsx --include=*.test.ts \
    | grep -oE '"[^"]+\?raw"' | sort -u        # → 95 distinct targets
```

Of the 95, **exactly four** are relevant, and **three of the four in-scope source files are swept by
nothing at all**:

| Target | Swept by | Relevance to Phase 195 |
|---|---|---|
| `@/pages/WorkflowRunPage.tsx?raw` | `chat/__tests__/StopControl.baseline.test.tsx:164` | ⚠ **LIVE HAZARD** — see below |
| `./WorkflowRunPage?raw` | `pages/WorkflowRunPage.test.tsx:161` | ⚠ **FOUR fences; two INVERT** — see below |
| `@/lib/api?raw` | `pages/WorkflowBuilderPage.header.test.tsx` | Only if a plan edits `lib/api.ts`. **No plan should** — both download helpers are consumed as-is. |
| `@/providers/StreamsProvider.tsx?raw`, `@/stores/streamsStore.ts?raw` | `__tests__/providers/StreamsProvider.stopping.test.ts` | Only if a plan implements D-12 in the store/provider. **§ F7 recommends against that** — sort in the shared row / a pure util instead. |
| `OutputFileCard.tsx` · `FilesSection.tsx` · `fileIcon.tsx` · `MessageItem.tsx` | **NOTHING** | ✅ No source-grep fence exists over three of the four in-scope files. Their protection is behavioural only — which is why § F5's coverage gap matters. |

### `StopControl.baseline.test.tsx` — 15 cases, UNGATED

Three predicates over raw `WorkflowRunPage.tsx`. All quoted verbatim:

| Line | Predicate | Effect of Phase 195 | Disposition |
|---|---|---|---|
| `:577-583` | `expect(src.length).toBeGreaterThan(20000)` · `expect(src).toContain("WorkflowRunPage")` · `expect(src.endsWith("\n")).toBe(true)` | **SAFE.** Measured: the file is **60 279 chars / 1101 lines**. Removing the region + `iconFor` + `formatBytes` + `baseName` (~125 lines ≈ 5 000 chars) leaves ~55 000 — **50 000 chars of headroom.** | keeps satisfying |
| `:595-599` | `expect((src.match(/<StopControl/g) ?? []).length).toBe(1)` — **RAW, no comment stripping** | ⚠ **HAZARD.** A docblock in `WorkflowRunPage.tsx` that writes `<StopControl` (e.g. explaining what stayed) makes this **2** and REDS. | keeps satisfying **IF** the new docblock names the component in WORDS |
| `:602-605` | positive control: planted second occurrence must count 2 | SAFE | keeps satisfying |
| — | ✅ **Note the line-count pin was already REMOVED** by 194.1-07, with the original quoted (`:530-533`) and the reason recorded (*"a pin in an ungated suite is a pin nothing checks"*). **Do not reintroduce one.** | — | — |

### `WorkflowRunPage.test.tsx` — 102 cases, GATED and pinned at 102 EXACT

`codeOf(source)` at `:1758`+ strips comments for the `code`-scoped arms; the `pageSource`-scoped arms
are **RAW**.

| Line | Predicate (verbatim) | Verdict | Disposition |
|---|---|---|---|
| `:1467` | `expect(codeOf(pageSource)).toMatch(/function formatBytes/)` | ⚠ **INVERTS** | **REWRITE IN PLACE**, original quoted. The 194.1-07 pattern. |
| `:1468` | `expect(codeOf(pageSource)).toMatch(/function iconFor/)` | ⚠ **INVERTS** | **REWRITE IN PLACE**, original quoted. |
| `:1463` | `expect(pageSource).not.toMatch(new RegExp(PANEL_LIST))` where `PANEL_LIST = ["Files","Section"].join("")` — **RAW** | ⚠ HAZARD | keeps satisfying **IF** no docblock writes `FilesSection`. The prohibition itself is still correct: mounting the panel section here would write chat's viewed thread. |
| `:1464` | `expect(pageSource).not.toMatch(new RegExp(VIEWED))` where `VIEWED = ["useViewing","Thread"].join("")` — **RAW** | **ARCHITECTURAL CONSTRAINT** | keeps satisfying — the shared row must not call the hook. |
| `:1478` | `expect(pageSource).not.toMatch(new RegExp(PREVIEWER))` where `PREVIEWER = ["File","Preview"].join("")` — **RAW** | **ARCHITECTURAL CONSTRAINT** (D-09's mechanical enforcement) | keeps satisfying — preview activation injected by the panel only. |
| `:1489-1490` | each empty-state copy appears **exactly once** in `codeOf(pageSource)` | **CONSTRAINT** | keeps satisfying — the empty state must STAY in the page; the shared unit is a ROW, not a list. |
| `:1428-1429` | `not.toMatch(/muted-foreground-dim/)` · `not.toMatch(/--panel-/)` | SAFE (page source only) | keeps satisfying. ⚠ But it names the real risk § F10 raises: the shared row must not hardcode panel-scoped tokens. |
| `:1450-1455` | `useWorkspaceFiles(` **×1** · `useWorkspaceFiles(run?.thread_id` · `downloadWorkspaceFile(` **×1** · `const runThreadId = run?.thread_id` · `downloadWorkspaceFile(runThreadId` | **CONSTRAINT** | keeps satisfying **only if** the download call stays in the page. If the row calls `downloadFrom()` instead, `downloadWorkspaceFile(` drops to **0** in page source and **`toHaveLength(1)` REDS.** ⇒ **Either keep `onDownload` in the page (recommended — the section-level error already lives there) or invert this arm too.** |
| `:897` and `:1023` | `expect(region.textContent).toContain("What this run produced")` | ⚠ **BOTH RED on D-02** | update both, same commit as the const |
| `:918` | `expect(row.getAttribute("title")).toBe(DELIVERABLE.path)` | CONSTRAINT | `title` = full path, on the control |
| `:950-953` | `expect(buttons).toHaveLength(1)` · `expect(buttons[0].getAttribute("aria-label")).toBe("Download renewal-letter.docx (18.4 KB)")` | CONSTRAINT | exactly one control per row; aria-label format preserved verbatim |
| `:968-971` | `[role="list"]` non-null · `li` count === 2 | CONSTRAINT | keep `<ul role="list"><li>` |
| `:991` | id-less row → `expect(region.querySelectorAll("button")).toHaveLength(0)` | ⚠ **SURVIVES BY A HAIR** | see § F8 — OutputFileCard's dead affordance is a `<span aria-disabled>`, not a button. **State this reasoning in the plan.** |
| `:945-949` | no `iframe`/`embed`/`object`/`[data-testid*='preview']` in the region | CONSTRAINT | D-09 |

**Rewrite-in-place vs keeps-satisfying, summarised:** **two** cases must be rewritten in place and
inverted (`:1467`, `:1468`), **two** must be updated for new copy (`:897`, `:1023`), **one** may need
inverting depending on where the download call lands (`:1450-1455`), and **nine** merely need the new
code to keep satisfying them. **Zero cases should be deleted** — the pin is exact.

---

## Existing coverage and the count gate (R3)

### Measured this session — five suites, run individually at `--maxWorkers=2`, all green

| Suite | Cases | In `TARGETS`? | In `BASELINE`? |
|---|---|---|---|
| `src/pages/WorkflowRunPage.test.tsx` | **102** | ✅ yes | ✅ **pinned 102 — EXACT, zero slack** |
| `src/components/panel/__tests__/FilesSection.test.tsx` | **11** | ❌ **no** | ❌ no |
| `src/__tests__/components/MessageItem.finalOutputs.test.tsx` | **11** | ❌ **no** | ❌ no |
| `src/lib/__tests__/fileIcon.test.tsx` | **11** | ❌ **no** | ❌ no |
| `src/components/chat/__tests__/StopControl.baseline.test.tsx` | **15** | ❌ **no** | ❌ no |
| **no `OutputFileCard.test.tsx` exists** | **0** | — | — |

### What covers each in-scope surface today

| Surface | Coverage | Gaps that matter |
|---|---|---|
| `OutputFileCard` | **Indirect only**, via `MessageItem.finalOutputs.test.tsx` (11 cases): anchor + `download` attr when `url` present (`:51`); the flat 095.1 list with `is_hero` ignored (`:82`); **the dead-link state — `[data-dead='true']` + `getByText("Download unavailable")` (`:111-124`)** | ⚠ **`supersedes` / "Replaces:" — ZERO coverage repo-wide.** ⚠ `data-variant` — ZERO. ⚠ The in-row `downloadError` + 3 s auto-clear — ZERO. ⚠ `resolveOutputUrl`'s `API_BASE` prepend — ZERO. |
| `FilesSection` | **11 dedicated cases** (`FilesSection.test.tsx`): listbox + one option per file; `formatBytes · v{version}` meta; click-to-preview full-replace; Enter-opens; `‹ Files` back; axe populated + axe empty; Template badge absent for an agent file (D-11); badge + `/expires in \d+h/`; amber near-expiry; per-extension icon for docx/pptx/xlsx | Arrow-key roving — not covered. The `animate-fileFlash` fresh-write — not covered. |
| `run-deliverables` | **The strongest of the three**: `WorkflowRunPage.test.tsx:893-1032` — heading; name+size+title; run-thread-not-viewed-thread ×2; download args; no-preview + positive control; two-row list; failed download surfaced; **id-less row shown as a fact with 0 controls**; all three empty-state arms | The D-12 ordering — **not covered at all** (no sort exists yet). |
| `fileIcon` | 11 dedicated cases | Nothing about the two new params § F10 proposes. |

### The count gate — `TARGETS` verbatim

`scripts/vitest-count-gate.cjs:2116-2510`. Stripped of its (extensive) comments, the array is
**exactly 21 entries**:

```
src/components/workflows                                        ← the ONLY directory entry
src/pages/WorkflowBuilderPage.test.tsx
src/pages/WorkflowBuilderPage.canvas.test.tsx
src/components/admin/revertByteIdentical.test.tsx
src/pages/WorkflowBuilderPage.header.test.tsx
src/pages/WorkflowBuilderPage.describe.test.tsx
src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx
src/components/panel/__tests__/PhaseReconcile.test.tsx
src/components/panel/__tests__/PhaseTimeline.test.tsx
src/lib/phaseState.test.ts
src/pages/WorkflowRunPage.test.tsx                              ← ✅ the only Phase-195 suite inside
src/components/layout/ChatLayout.launch.test.tsx
src/components/panel/__tests__/WorkspacePanel.test.tsx
src/hooks/useDraftPersistence.test.tsx
src/components/settings/__tests__/ConnectionsTab.test.tsx
src/components/settings/__tests__/ConnectionFormPanel.test.tsx
src/pages/WorkflowsPage.test.tsx
src/pages/__tests__/RunModal.test.tsx
src/pages/__tests__/RunModal.a11y.test.tsx
src/pages/__tests__/PublishedCardDelete.test.tsx
src/pages/WorkflowBuilderPage.session.test.tsx
```

The script states the consequence itself, verbatim at `:952-954`:

> `src/components/panel/__tests__/` is reached by **THREE NAMED FILES** and has no directory entry,
> and **`src/components/chat` has no entry at all** (`194.1-BASELINE.md` §2) — so a new suite would
> land **UNGATED** and the phase's single most important case would be the one nothing runs in CI.
> *A falsification that does not run has falsified nothing.*

**Gated vs ungated, for every location this phase is likely to write a test:**

| Likely test location | Gated? | Consequence |
|---|---|---|
| `src/pages/WorkflowRunPage.test.tsx` | ✅ **YES**, pinned **102 EXACT** | Additions print `+N` and are allowed. A **deletion** REDS the gate and needs a same-commit pin lowering with plan authorisation. **Prefer inverting in place.** |
| `src/components/files/__tests__/FileRow.test.tsx` (**new**) | ❌ NO by default | ⚠ **Needs BOTH knobs, in the SAME COMMIT that creates the file.** An entry pointing at a not-yet-existing path makes the gate **ERROR (exit 2)**, not fail. Nothing under `src/components/files` is reachable from any existing entry. |
| `src/components/panel/__tests__/FilesSection.test.tsx` | ❌ NO | The panel directory is file-level (three named files). **Adopting it is the honest move** — 11 cases, green today, so it imports zero rot. Requires TARGETS + BASELINE = 11 read from the gate's own `actual`. |
| `src/components/chat/**` (any `OutputFileCard` suite) | ❌ NO — **the directory has no entry of any kind** | A new `OutputFileCard.test.tsx` would be invisible. **Recommendation:** put the § F5 `supersedes` characterization in `src/__tests__/components/MessageItem.finalOutputs.test.tsx` (also ungated) **and** adopt that file into both knobs, OR create `src/components/files/__tests__/` and cover the states through `FileRow` there — the latter is gated by the entry the phase already owes. |
| `src/lib/__tests__/fileIcon.test.tsx` | ❌ NO — `src/lib/` is reached only by the named `phaseState.test.ts` | If § F10's params ship, this suite grows. Adopt it (11 cases, green) or accept it stays ungated. |

**Commands the plan must carry:**

```bash
# The gate (gated suites only). Contract: no per-file DECREASE + zero failing.
cd frontend && GSD_VITEST_MAX_WORKERS=2 node ../scripts/vitest-count-gate.cjs

# ⚠ The UNGATED suites — the gate will NOT run these; run them explicitly, every plan.
cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run --maxWorkers=2 \
  src/components/panel/__tests__/FilesSection.test.tsx \
  src/__tests__/components/MessageItem.finalOutputs.test.tsx \
  src/lib/__tests__/fileIcon.test.tsx \
  src/components/chat/__tests__/StopControl.baseline.test.tsx \
  src/components/files/__tests__/          # once it exists

# Typecheck. A bare `tsc --noEmit` checks ZERO files here.
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

### Fresh baselines measured in this session (2026-08-17, quiet tree, no sibling agent)

| Measurement | Value | Note |
|---|---|---|
| Count gate | **`count gate OK` · total 3972 · failed 0 · pinned total 3898 · 75/75 pinned files present** | ⚠ **`CLAUDE.md` says `3918 / 0 / 3868` — STALE by +54 / +30.** Exactly the rot that document warns about. Re-derive; do not quote. |
| `tsc -p tsconfig.app.json` | **33 errors** | **UNMOVED** from the 194.1 baseline. `[VERIFIED: command]` |
| Five in-scope suites, together | 5 files / **150** tests / 0 failing (10.0 s) | `[VERIFIED: command]` |

---

## The D-16 live baseline (R4) — how SC#1 is proved BEFORE anything changes

### The workflow to use, chosen on evidence not memory

Queried the live DB this session. Of **162** published definitions, **18** contain an `llm_emit`
phase (⚠ the phase type lives at `phase.config.phase_type`, **not** `phase.type` — a `phase.type`
query returns 0 and looks like an absence). Ranked by runs that actually produced a file:

| Verdict | Slug | runs_with_files | Evidence |
|---|---|---|---|
| ✅ **USE — first choice** | **`northwind-qbr-fa65a43c` v1** | **6** | Six `completed` runs on 2026-08-15/16, each writing one 38 367-39 660 B `/Northwind-QBR-Template.docx`. Phase 193.2's shipped template workflow; the operator's own recent vehicle. |
| ✅ USE — alternates | `pm-weekly-status-report` v1 (11) · `compliance-gap-report-1u9vcs` v1 (8) · `risk-register-fill-101uat` v1 (5) · `northwind-qbr-q3-2026-f0f9033f` v1 (2) | 2-11 | all published, all with real `.docx` output |
| ⛔ **AVOID** | **`compliance-gap-report` v1 · `pm-risk-register` v1 · `risk-register` v1** | **0** | The bare-slug system/seed definitions. **Zero of their runs has ever produced a file** — these are the SEED-bound-template rows that render *"could not read"*. Empirically confirmed, not inferred from memory. |

**A pre-existing read-only baseline row, usable today with zero risk** (proves the *terminal* half of
SC#1 without launching anything):

```
run_id     833e8e85-92a2-451b-9af7-7cd085355ff7
thread_id  1189a1a3-b836-4e7a-8aca-a021f1175e4a
status     completed          definition  northwind-qbr-fa65a43c v1
file       id=d4598e01-a45b-430a-b30b-05ef7e9a3852
           path=/Northwind-QBR-Template.docx   size_bytes=39660
           mime=application/vnd.openxmlformats-officedocument.wordprocessingml.document
           kind=NULL   created_at=2026-08-16 08:40:32.464150+00
```

### The procedure — cheapest honest form

**The operator drives the browser.** `take_screenshot` times out in this environment; read DOM
geometry via `evaluate_script` instead. **Do NOT locate the row by `getElementById`** (192.1 D-27) —
a machine check that bypasses the human's task has not verified the human's task.

1. **Capture the pre-state (agent, no browser).** Record the current `workspace_files` row count
   (**86**) and the count for the target thread. Command:
   ```bash
   backend/venv/Scripts/python.exe -c "import psycopg2;c=psycopg2.connect(host='127.0.0.1',port=54322,dbname='postgres',user='postgres',password='postgres');cur=c.cursor();cur.execute('select count(*) from workspace_files');print(cur.fetchone())"
   ```
   ⚠ **This step must land in a commit that PREDATES any source change** (the 188.1 lesson).
2. **Terminal arm, read-only, right now.** Operator opens the existing run above from the Workflows
   library run receipt (or the thread's run line), and confirms: the deliverable region renders, the
   row shows `Northwind-QBR-Template.docx` and `38.7 KB`, and clicking it downloads a file that
   **opens in Word**. Evidence: the run id, the `workspace_files.id`, and the **downloaded file's
   byte size on disk — which must equal 39 660**.
3. **Live arm.** Operator launches `northwind-qbr-fa65a43c` from the Workflows page, stays on the run
   surface, and watches the region go from *"No files yet — this run hasn't written anything."* →
   a populated row **mid-run** (that transition is what `_ProducerStreamCtx` exists for,
   `harness/phase_types.py:1161-1192`). Then downloads and **opens** it.
4. **Evidence to capture:** the new `run_id` + `thread_id`; the new `workspace_files` row (`id`,
   `path`, `size_bytes`, `created_at`); the DOM readback for the region:
   ```js
   // NOT getElementById — query the way a person finds it
   const region = document.querySelector('[data-testid="run-deliverables"]');
   const btn = region?.querySelector('button');
   ({ heading: region?.querySelector('h2')?.textContent,
      rows: region.querySelectorAll('li').length,
      label: btn?.getAttribute('aria-label'),
      title: btn?.getAttribute('title'),
      rect: btn?.getBoundingClientRect() })
   ```
   plus the downloaded file's on-disk byte size, and whether Word opened it.
5. **The three-surface side-by-side (D-20's second half).** Same thread, three places: chat
   (`OutputFileCard` in the run's message), panel (`FilesSection`), run page. Capture the row's
   rendered text + the icon element shape from each — this is also the § F10 evidence.

### What a REFUTATION looks like, and what it would cost

| Observation | Meaning | Scope consequence |
|---|---|---|
| Region renders but the row is **absent** on a terminal run whose `workspace_files` row exists | the read or the render is broken, not the wire | **SC#1 unsatisfied** ⇒ +1 plan on `useWorkspaceFiles` / the reconcile keying. Still frontend. |
| Row renders, download **404s or yields 0 bytes** | `downloadWorkspaceFile` or the `/raw` route is broken for inline `.docx` | +1 plan, possibly **backend** — would break the "no Python" premise. Highest-cost refutation. |
| Downloaded file opens **corrupt** in Word | the inline-bytes path str-decodes (the exact bug `:1636-1641`'s comment says `/raw` was built to avoid) | **backend** ⇒ escalate; this is a data-integrity defect, not a presentation phase. |
| Row appears only **after** the run goes terminal, never mid-run | the producer-stream re-point is not reaching this surface | Log as an observation. RUN-02 says *"when the run finishes"* — so this does **not** refute SC#1; seed it. |
| The region shows a file from a **prior** run on the same thread | D-01's known blind spot, live | Does **not** refute SC#1. It is exactly what D-02's relabel exists to stop overstating. Strengthens D-02. |

---

## Hot-file ledger obligations (R5) — re-derived, not read

**Recipe applied verbatim** (`git log --oneline | wc -l` · the `sed` bucket pipeline with six-digit
dated quick-task buckets and non-numeric buckets subtracted · `wc -l`). Run 2026-08-17, this session.

| File | CONTEXT D-17 recorded | **Re-derived now** | Drift | Buckets returned (subtractions noted) |
|---|---|---|---|---|
| `frontend/src/pages/WorkflowRunPage.tsx` | 12 / 3 / 1101 | **12 / 3 / 1101** | **none** | `188 188.1 194.1` — zero quick-task buckets |
| `frontend/src/components/chat/OutputFileCard.tsx` | 7 / 6 / 187 | **7 / 6 / 187** | **none** | `075.2 075.4 075.7 095 095.1 155` — zero quick-task buckets |
| `frontend/src/components/panel/FilesSection.tsx` | 6 / 3 / 277 | **6 / 3 / 277** | **none** | `087 088 100` — zero quick-task buckets |
| `frontend/src/components/chat/MessageItem.tsx` | 57 / 29 / 856 | **57 / 29 / 856** | **none** | 32 buckets returned; **3 subtracted as dated quick tasks (`260328`, `260405`, `260630`)** ⇒ 29 |
| `frontend/src/components/chat/RunCard.tsx` | 21 / 9 / 608 | **21 / 9 / 608** | **none** | `075.7 075.8 076.1 076.2 095 095.1 128 155 194` — zero quick-task buckets |
| `frontend/src/lib/fileIcon.tsx` | 1 / 1 / 105 | **1 / 1 / 105** | **none** | `095` — zero quick-task buckets |
| `frontend/src/lib/fileIcons.tsx` *(not in D-17)* | — | **1 / 1 / 61** | new | `038` — out of scope, recorded so a reader can tell "checked" from "not checked" |

**ZERO DRIFT on all six.** D-17's figures were measured correctly and no commit has landed on any of
these files since. `[VERIFIED: git]`

### What the same-commit sync rule owes

`CLAUDE.md` § "Hot-file ledger" table ↔ `docs/HOT-FILE-LEDGER.md` sections. Verified against both
files this session (`grep` on `CLAUDE.md`'s table; `grep -n "^## "` on the ledger, 555 L, 31 sections
plus a `## Young files — tracked, G-5 does not fire yet` list at `:537`).

| File | `CLAUDE.md` row | `docs/HOT-FILE-LEDGER.md` section | G-5 after 195 |
|---|---|---|---|
| `frontend/src/pages/WorkflowRunPage.tsx` | **UPDATE** — currently `12 / 3 / 1101 \| **FIRES** \| at threshold — honoured by construction (194.1)`; 195 makes it the **4th** phase, so re-derive at close and rewrite the disposition | **UPDATE** — section exists at `:523`. Its closing sentence already names the seam and predicts this: *"the run read + its poll, the phase/spec join, the elapsed anchor, **the deliverable list** and the canvas mount are five concerns in one 1101-line component"* — **195 takes exactly one of the five it names.** Record it as the seam TAKEN, beside the prediction, never over it. | **FIRES** — honoured by construction (the extraction IS RUN-03) |
| `frontend/src/components/chat/OutputFileCard.tsx` | **ADD** — `7 / 6 / 187 \| **FIRES** \| honoured by construction (195)` | **ADD** a full section (G-5 fires at 6 phases ⇒ a section is owed, not a young-file bullet) | **FIRES** (6 ≥ 3) — honoured by construction |
| `frontend/src/components/panel/FilesSection.tsx` | **ADD** — `6 / 3 / 277 \| **FIRES** \| honoured by construction (195)` | **ADD** a full section (3 phases = at the threshold, exactly `WorkflowRunPage`'s 194.1 situation) | **FIRES** at threshold — honoured by construction |
| `frontend/src/components/files/FileRow.tsx` *(new)* | **ADD** — `1 / 1 / N \| no (1 phase) \| young — owes a detail section the moment it reaches a 3rd phase` | **ADD a bullet** to `## Young files` (`:537`), matching `StopControl.tsx` / `ThreadRunLine.tsx` / `ActiveRunsTray.tsx`. **Not** a full section — G-5 does not fire at 1 phase. | no (1 phase) |
| `frontend/src/components/files/fileRowUtils.ts` *(new)* | **ADD** — same young-row shape | **ADD a bullet** | no (1 phase) |
| `frontend/src/lib/fileIcon.tsx` | **ADD (recommended, optional)** — `2 / 2 / N \| no (2 phases) \| young — becomes the ONE icon path for four surfaces` | **ADD a bullet** to `## Young files` | no (2 phases) — but **the ledger's own standing lesson** (`WorkflowsPage.tsx` escaping G-5 for ten phases purely by not being written down) argues for the row now |
| `frontend/src/components/chat/MessageItem.tsx` | **no change owed** | **no change owed** | ⚠ **Only true if `OutputFileCard`'s public props stay byte-identical (§ F6).** If a plan widens them, `MessageItem.tsx` (29 phases, *extraction due*) is opened and **G-5 fires on a file whose obligation is UNDISCHARGED** — a refactor recommendation would then be owed FIRST. **State this as a scope fence.** |
| `frontend/src/components/chat/RunCard.tsx` | **no change owed** (D-14 declines) | **no change owed** | untouched |
| `frontend/src/components/panel/SeamCard.tsx` | none — 195 does not touch it (§ F9) | none | n/a |

⚠ **A row without a section, or a section without a row, is drift.** Two ADDs need full sections, three-to-four need young-file bullets, one section needs an UPDATE. **Nine ledger edits across two files, in the same commit as the code.**

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`. This section is what
> `/gsd:plan-phase` turns into `195-VALIDATION.md`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **vitest 4.1.0** + `@testing-library/react` + `jsdom` (+ `vitest-axe` for the panel a11y cases) |
| Config file | `frontend/vitest.config.ts` (+ `frontend/vite.config.ts` aliases; `?raw` is a Vite loader, so `node:fs` is never used — `tsconfig.app.json` carries no node types on purpose) |
| Quick run command | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run --maxWorkers=2 <files>` |
| Full suite command | `cd frontend && GSD_VITEST_MAX_WORKERS=2 node ../scripts/vitest-count-gate.cjs` **plus** the explicit ungated command in § "The count gate" — the gate alone does **not** cover this phase |
| Typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — **baseline 33, measured unmoved** |

⚠ **`GSD_VITEST_MAX_WORKERS=2` is mandatory** and matters on a SINGLE run, not only parallel ones
(`CLAUDE.md` § Parallel execution, re-measured at Phase 193.2). **Capture failing filenames BEFORE
re-running anything.**

### Phase Requirements → Test Map

| Req | Behaviour | Test type | Automated command | File exists? |
|---|---|---|---|---|
| RUN-02 | A terminal run's produced file is listed, named, sized and downloadable from the run surface | unit (RTL) | `npx vitest run src/pages/WorkflowRunPage.test.tsx -t "the deliverable is listed and downloadable"` | ✅ exists, 102 cases |
| RUN-02 | The region's label does not claim run-scope it cannot deliver (D-02) | unit | same file, the two heading cases at `:897` / `:1023` | ✅ exists — **both must be updated** |
| RUN-02 | The three-way empty state survives the conversion (D-15) | unit | same file, `describe("… the two empty states say different true things")` (3 cases) | ✅ exists |
| RUN-02 | Newest-first ordering, **both regimes** (D-12) | unit | `npx vitest run src/components/files/__tests__/` | ❌ **Wave 0** |
| RUN-02 | End-to-end on a live run: launch → watch → download → **open the file** (D-20) | **manual, operator-driven** | — (see § "The D-16 live baseline"; G-4 lived experience — wire + screenshot explicitly insufficient) | ❌ Wave 0 + phase close |
| RUN-03 | Exactly ONE `formatBytes`, ONE icon path, ONE row markup, ONE download dispatcher | unit + **source sweep** | `npx vitest run src/components/files/__tests__/FileRow.sweep.test.ts` | ❌ **Wave 0** |
| RUN-03 | `OutputFileCard`'s dead-link state survives byte-identical (D-08) | unit | `npx vitest run src/__tests__/components/MessageItem.finalOutputs.test.tsx -t "dead-link"` | ✅ exists (`:111-124`) |
| RUN-03 | `OutputFileCard`'s `supersedes` subline survives byte-identical (D-08) | unit | — | ❌ **ZERO COVERAGE — Wave 0 characterization** |
| RUN-03 | The panel keeps listbox/option + roving tabindex + preview activation + Template badge | unit | `npx vitest run src/components/panel/__tests__/FilesSection.test.tsx` | ✅ exists, 11 cases (**ungated**) |
| RUN-03 | Chat gains no NEW file affordance (D-13) while its presentation converts (D-07) | **source sweep** | `npx vitest run src/components/files/__tests__/FileRow.sweep.test.ts -t "chat capability"` | ❌ **Wave 0** |
| RUN-03 | The run page still names neither `FilesSection`, `FilePreview` nor `useViewingThread` | source fence | `npx vitest run src/pages/WorkflowRunPage.test.tsx -t "neither mounts the panel"` | ✅ exists — **two arms invert** |

### The plants — what each fence must be driven RED against

**This project shipped 5 inert fences in 193.2, 4 in 193.1, 3 in 192.1 and 5 in 190. Every one was
caught by PLANTING, none by reading.** Each plant below is a real edit to **production source**,
restored md5-identical afterwards. Where `assert` short-circuiting means one plant cannot exercise
every clause, the plant count is stated (194-10 needed six where two were named; 194-12 needed
eleven, and found one plant that produces a SKIP rather than a RED).

| # | Claim | Observable proof | **Plant(s) in REAL production source** | Plants needed |
|---|---|---|---|---|
| **P1** | D-15's three-way empty state survives unchanged | The three existing cases at `WorkflowRunPage.test.tsx:1000-1032` | ⚠ **THREE plants, not one — the three arms are mutually exclusive so a single plant leaves two clauses unproven.** (a) swap `isTerminal ? COPY_NO_FILES_TERMINAL : COPY_NO_FILES_LIVE` to always-terminal (`:1035`) → must red the LIVE case; (b) always-live → must red the TERMINAL case; (c) **delete the `filesLoading ? null :` guard (`:1032`)** → must red the *"claims NEITHER while in flight"* case. **(c) is the one most likely to be inert**, because the assertion is a `not.toContain` and passes trivially if the fixture's loading flag is unset — **verify the fixture actually sets `setFiles([], true)`** (`:1025`) | **3** |
| **P2** | D-08's dead-link state survives byte-identical | `[data-dead='true']` present **and** the exact string *"Download unavailable"* | ⚠ **TWO plants — the existing case at `MessageItem.finalOutputs.test.tsx:111-124` asserts both with two separate `expect`s, and the FIRST short-circuits the second.** (a) remove `data-dead="true"` (`OutputFileCard.tsx:96`) → must red on the attribute clause; (b) keep the attribute, change the copy to *"No link"* (`:116`) → must red on the text clause. **(b) is the arm a naive single plant misses.** | **2** |
| **P3** | D-08's `supersedes` subline survives byte-identical | *"Replaces: {name}"* rendered, in **both** the live and the dead branch | ⚠ **NO FENCE EXISTS. Wave 0 must author it, then plant.** **THREE plants**, because the subline is written **twice** in the component: (a) delete the live-branch block (`:168-172`) → must red; (b) delete the **dead-branch** block (`:101-105`) → must red **independently** — a fence rendering only a `url`-bearing fixture cannot see (b); (c) change the literal `"Replaces: "` → must red on the copy. | **3** |
| **P4** | D-12's client-side newest-first sort | Rendered row order | ⚠ **THREE plants** — and the second is the one § F7 exists for. (a) remove the `.sort()` call entirely → must red; (b) invert the comparator to ASC → must red; (c) ⚠ **feed a fixture whose newest row has `created_at: undefined`** (the live-SSE regime, `lib/api.ts:845-851`) and plant a comparator that sorts `undefined` LAST → **must red**. Without (c) the fence proves only the reconciled regime, which is not the one the deliverable arrives in. **Positive control required:** a two-row fixture where BOTH orders differ, or the fence passes on a one-row list forever. | **3** |
| **P5** | D-02's label makes no run-scope claim | The rendered `<h2>` text | ⚠ **TWO plants + a NEGATIVE sweep.** (a) revert the const to `"What this run produced"` → must red; (b) ⚠ a **word-level sweep** is needed, not a string equality: a fence asserting `toBe(newCopy)` passes on *any* wrong copy that happens to be the new one, so add `expect(heading).not.toMatch(/this run (produced|made|created)/i)` and plant three different overclaiming strings against it. **Do NOT sweep the whole region's `textContent`** — `COPY_NO_FILES_TERMINAL` legitimately contains *"This run produced no files."* (§ F4), and a region-wide sweep would red on correct code. | **2 + sweep** |
| **P6** | SC#2: exactly ONE icon path / ONE `formatBytes` / ONE row markup | `?raw` source sweep over the three converted files **plus** the new module | ⚠ **FOUR plants minimum, one per swept file, because a single-file plant leaves the other three arms unproven.** (a) re-add `function formatBytes` to `WorkflowRunPage.tsx` → must red; (b) re-add it to `FilesSection.tsx` → must red; (c) re-add an inline `iconFor` to either → must red; (d) add a second `<a className="flex items-center gap-2.5 …">` row in `OutputFileCard.tsx` → must red. ⚠ **Sweep `codeOf(source)`, NOT raw** — these three files carry docblocks that legitimately discuss `formatBytes` and `iconFor` by name (the 187-24 lesson), and a raw sweep reds on its own explanation. ⚠ **Length + identity guard on every `?raw` import** (`expect(src.length).toBeGreaterThan(N)`, `expect(src).toContain("<uniqueSymbol>")`) — 192.1 measured a renamed module swept against the **empty string** and passing green. | **4 + guards** |
| **P7** | D-13/D-07 distinction: presentation converts, chat capability does not | (i) `MessageItem.tsx` and `ExecuteCodeBody.tsx` are **byte-unchanged**; (ii) `OutputFileCard`'s public prop shape is unchanged; (iii) no new interactive element in the chat rows | ⚠ **THREE plants.** (a) `git diff --numstat <base> HEAD -- src/components/chat/MessageItem.tsx src/components/chat/tool-bodies/ExecuteCodeBody.tsx` must be **EMPTY** — plant a one-character edit and prove the check fails (the 194.1 `REQUIREMENTS.md` byte-identity precedent); (b) add a fourth optional prop to `OutputFileCardProps` → a source fence pinning the prop set must red; (c) add a second `<button>` inside a chat row → a rendered-DOM control count must red. ⚠ **(a) is a `git` assertion, not a vitest one** — it belongs in the plan's verification steps, and note that a `numstat`-empty check **passes trivially when the base SHA is wrong**, so the base must be asserted, not assumed. | **3** |
| **P8** | The run page's shipped absences hold after the conversion | `WorkflowRunPage.test.tsx:1463/1464/1478` | ⚠ **THREE plants, and each must be shown to red SEPARATELY** — the three needles are assembled from parts (`["Files","Section"].join("")`) precisely so the test file's own source cannot satisfy them, and each arm is a distinct `expect`. Plant (a) `import { FilesSection } …`, (b) `const t = useViewingThread()`, (c) `import { FilePreview } …` into `WorkflowRunPage.tsx`, one at a time. The existing positive controls at `:1470-1471` / `:1482` already prove the needles match the shapes they forbid — **keep them**. | **3** |
| **P9** | `<StopControl` still appears exactly once in `WorkflowRunPage.tsx` (the 194.1 fence the refactor must not disturb) | `StopControl.baseline.test.tsx:595-599` | ⚠ **This is the fence most likely to break for a reason unrelated to its subject** (§ F11). No new plant is owed — its positive control exists at `:602-605`. **But the plan must assert it green after every `WorkflowRunPage.tsx` edit**, because the suite is **UNGATED** and the gate will never tell anyone. | 0 (assert green) |
| **P10** | ⚠ **The count-gate delta is real** | Gate verdict line | The gate is not a fence and needs no plant, but ⚠ **a `TARGETS` entry pointing at a path that does not exist yet makes the gate ERROR (exit 2), not fail** — so the new-suite entries land in the **same commit that creates the file**, never before. And ⚠ **a BASELINE number must be read from the gate's own printed `actual` column across two agreeing runs**, never hand-counted from `it(` literals. | 0 (procedure) |

**Plant total: 26 across 10 claims** — where a naive reading of the claims would name 10. Every one
must be observed RED against production source and the file restored md5-identical.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit -p tsconfig.app.json` (must stay **33**) + the touched
  suite(s) at `--maxWorkers=2`.
- **Per wave merge:** the count gate **plus** the explicit ungated command. ⚠ Both — the gate alone
  covers only `WorkflowRunPage.test.tsx` out of this phase's five suites.
- **Phase gate:** gate green (no per-file decrease, 0 failing) + the ungated set green + `tsc` at 33
  + D-20's operator UAT **driven, with the downloaded file opened**.

### Wave 0 Gaps

- [ ] **The live SC#1 baseline, in a commit that PREDATES any source change** — covers RUN-02, D-16.
      The one thing whose value is destroyed by doing it later.
- [ ] `src/components/files/__tests__/FileRow.test.tsx` — the shared row's own behaviour; **needs
      `TARGETS` + `BASELINE` entries in the creating commit**.
- [ ] `src/components/files/__tests__/FileRow.sweep.test.ts` — the SC#2 "one of each" source sweep
      (P6) with length + identity guards on every `?raw` import.
- [ ] **`supersedes` characterization against the PRE-change `OutputFileCard`** (P3) — the only D-08
      state with zero coverage. Must be authored and driven RED before the conversion.
- [ ] **The run page's silent-dead-row characterization** (§ F8) — capture today's behaviour (a row
      with no control and no copy) before it changes, so the improvement is a measured delta rather
      than an unrecorded one.
- [ ] **The D-12 two-regime ordering fence** (P4), including the `created_at: undefined` arm.
- [ ] `FilesSection.test.tsx` / `MessageItem.finalOutputs.test.tsx` / `fileIcon.test.tsx` adoption
      into both gate knobs (11 / 11 / 11, all green today ⇒ zero rot imported) — or a recorded
      decision to leave them ungated, with the reason. **A decline with no recorded reason is
      indistinguishable from an oversight.**

---

## Common Pitfalls

### Pitfall 1: Deleting an inverting fence instead of rewriting it
**What goes wrong:** `WorkflowRunPage.test.tsx` is pinned at **102 EXACT** with zero slack. Deleting
the two inverting cases drops it to 100 and REDS the gate with `[count-decrease]`.
**Why it happens:** a red assertion looks like dead code once the duplication is gone.
**How to avoid:** invert inside the same `it()`, quote the original in a comment block (the
`194.1-07` / `StopControl.baseline.test.tsx:513-573` pattern). No pin edit needed.
**Warning sign:** any plan whose diff shows a net-negative `it(` count in a gated file.

### Pitfall 2: A docblock that reds a raw source fence
**What goes wrong:** four tokens are forbidden in raw `WorkflowRunPage.tsx`: `<StopControl` (must
count exactly 1), `FilesSection`, `useViewingThread`, `FilePreview`. A comment explaining the
extraction naturally wants to write all four.
**How to avoid:** name components in WORDS in that file — the convention `ChatLayout.tsx:790-792`
already documents for itself.
**Warning sign:** `StopControl.baseline.test.tsx` reds after a `WorkflowRunPage.tsx`-only edit — and
because that suite is **ungated**, nothing will tell you unless the plan runs it explicitly.

### Pitfall 3: Trusting the count gate to cover this phase
**What goes wrong:** `src/components/chat` has **no `TARGETS` entry at all**; the panel directory is
reached by three named files that do not include `FilesSection.test.tsx`; `src/lib/` is reached only
by `phaseState.test.ts`. A new suite under `components/files/` is invisible by default. The grand
total reads **identically** before and after.
**How to avoid:** run the explicit ungated command every plan, and add both knobs in the creating commit.
**Warning sign:** a plan reporting "gate green, +0" after adding tests. That is the symptom, not the reassurance.

### Pitfall 4: Sweeping raw source where comments discuss the thing being swept
**What goes wrong:** all three converted files carry docblocks naming `formatBytes` and `iconFor` —
`FilesSection.tsx:36-37` literally says *"Copied verbatim from OutputFileCard.tsx:24-28"*. A raw
sweep for `formatBytes` reds on the very sentence documenting its removal.
**How to avoid:** `codeOf(source)` (strip `/* */` and `//`) before indexing, and **test the stripper
first** — `ChatLayout.launch.test.tsx:465-482` is the shipped model, including a case proving the raw
source really does carry the token more times than the code does.
**Warning sign:** a fence that passes on the pre-change tree.

### Pitfall 5: A `?raw` import that resolves to the empty string
**What goes wrong:** every `not.toContain` passes; the suite reports green while measuring nothing.
192.1 measured a renamed module swept against the empty string and passing.
**How to avoid:** `expect(src.length).toBeGreaterThan(N)` **and** an identity assertion
(`expect(src).toContain("<a symbol unique to that file>")`) on every `?raw` import.
**Warning sign:** a new sweep that goes green on its first run without a plant.

### Pitfall 6: Widening `OutputFileCard`'s props "just a little"
**What goes wrong:** it has two call sites; widening opens `MessageItem.tsx` (**29 phases**,
*extraction due*, obligation **undischarged**) and G-5 then demands a refactor recommendation FIRST.
**How to avoid:** keep the public prop shape byte-identical and re-implement the body. D-05 already
forbids the widening; § F6 is why it is also a guardrail trap.
**Warning sign:** `MessageItem.tsx` appearing in any plan's `files_modified`.

### Pitfall 7: "Fixing" the empty-state copy in D-02's name
**What goes wrong:** `"This run produced no files."` looks like the same overclaim as the heading. It
is not (§ F4), D-15 says it ships unchanged, and `:1489-1490` pins each string exactly once.
**How to avoid:** D-02 touches the heading only. Record the run ⊆ thread reasoning in the plan.
**Warning sign:** a diff touching `COPY_NO_FILES_TERMINAL` or `COPY_NO_FILES_LIVE`.

### Pitfall 8: Sorting by `created_at` without handling its absence
See § F7 and P4. **The just-produced deliverable is precisely the row with no `created_at`.**

### Pitfall 9: Unifying the fifth presentation by accident
`SeamCard.tsx:72-80` renders a `workspace_write` file chip whose docblock falsely claims to reuse
`OutputFileCard`'s shape. It is out of scope (§ F9). **Name it in the plan** so a reviewer cannot
read its survival as SC#2 unmet — the same service D-05 does for `lib/fileIcons.tsx`.

### Pitfall 10: Assuming the phase-type key is `type`
`workflow_definitions.definition` is a **jsonb string scalar** on 214 of 242 rows
(`jsonb_typeof(definition)` → `string`), so `definition->'phases'` returns **NULL** — and inside a
parsed phase the type lives at `config.phase_type`, **not** `config.type`. Both mistakes return
**0 rows / 0 matches** and read as an absence. Cost me two wrong queries this session.

---

## Code Examples

### The two shipped download seams — identical error contract (`lib/api.ts`)

```ts
// :1596-1618 (sandbox)                        // :1657-1675 (workspace)
if (!res.ok) {                                 if (!res.ok) {
  if (res.status === 401) throw new              if (res.status === 401) throw new
    DownloadError(401, "Session expired — …")      DownloadError(401, "Session expired — …")
  if (res.status === 404) throw new              if (res.status === 404) throw new
    DownloadError(404, "File not found.")          DownloadError(404, "File not found.")
  throw new DownloadError(res.status,            throw new DownloadError(res.status,
    "Download failed — try again.")                 "Download failed — try again.")
}                                              }
```
⇒ one shared catch serves both. `[VERIFIED: source]`

### The dead affordance is a `<span>`, not a `<button>` — why `:991` survives

```tsx
// OutputFileCard.tsx:107-117
<span
  className={cn("flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium flex-shrink-0",
    "border-red-500/40 bg-red-500/10 text-red-400 cursor-not-allowed")}
  aria-disabled="true"
  title="Download unavailable — this file has no link"
>
  <Download className="w-3 h-3" />
  Download unavailable
</span>
```

### The fence that inverts, verbatim (`WorkflowRunPage.test.tsx:1457-1472`)

```ts
it("neither mounts the panel's file list nor names it — it reads the viewed thread", () => {
  const PANEL_LIST = ["Files", "Section"].join("")
  const VIEWED = ["useViewing", "Thread"].join("")
  expect(pageSource).not.toMatch(new RegExp(PANEL_LIST))
  expect(pageSource).not.toMatch(new RegExp(VIEWED))
  // ...and the mirrored pieces really are here.
  expect(codeOf(pageSource)).toMatch(/function formatBytes/)   // ← INVERTS
  expect(codeOf(pageSource)).toMatch(/function iconFor/)       // ← INVERTS
  expect("import { FilesSection } from './FilesSection'").toMatch(new RegExp(PANEL_LIST))
  expect("const threadId = useViewingThread()").toMatch(new RegExp(VIEWED))
})
```

### The live-SSE regime that has no `created_at` (`lib/api.ts:845-851`)

```ts
callbacks.onWorkspaceFileWritten({
  id: parsed.id as string | undefined,
  path: parsed.path as string,
  version: parsed.version as number | undefined,
  size_bytes: parsed.size_bytes as number,
  mime_type: parsed.mime_type as string,
})            // ← no created_at, no kind, no expires_at
```
…appended at the end by the store (`StreamsProvider.tsx:2947-2954`):
```ts
const updated = idx === -1 ? [...prev, merged] : prev.map((f, i) => (i === idx ? merged : f))
```

---

## CONTEXT premise verification (R7)

| Premise | Verdict | Evidence |
|---|---|---|
| **D-01** 86 `workspace_files` rows | ✅ **CONFIRMED** | `select count(*) from workspace_files` → **86** |
| **D-01** `run_claim` 100% NULL | ✅ **CONFIRMED** | `count(run_claim)` → **0** of 86 |
| **D-01** `kind` NULL on 84/86 | ✅ **CONFIRMED** | `select kind, count(*) group by kind` → `NULL: 84`, `'agent': 2`. ⚠ **Zero `'template_input'` rows** — `FilesSection`'s badge branch is unexercised by all current data. |
| **D-01** 226 runs / 222 distinct threads | ✅ **CONFIRMED exactly** | `select count(*), count(distinct thread_id) from workflow_runs` → **(226, 222)** |
| **D-01** only 2 threads carry >1 run | ✅ **CONFIRMED** | `having count(*)>1` → **2** |
| **D-01** histogram 0→161 · 1→60 · 20→1 | ✅ **CONFIRMED exactly** | per-thread file-count histogram over `distinct thread_id from workflow_runs` → `[(0,161),(1,60),(20,1)]` |
| **D-03** deliverable and template are not separable by name | ✅ **CONFIRMED** | the six newest `.docx` rows are **all** `/Northwind-QBR-Template.docx`, 38 367-39 698 B, 2026-08-15/16 |
| **D-05** `OutputFileCard` renders a url-less file as dead | ✅ **CONFIRMED** | `OutputFileCard.tsx:91-119`; covered by `MessageItem.finalOutputs.test.tsx:111-124` |
| **D-05** `fileIcon` has exactly one consumer | ✅ **CONFIRMED** | `grep` → `OutputFileCard.tsx:5` only |
| **D-05** `fileIcons.tsx` is uncoupled | ✅ **CONFIRMED** | 4 consumers, all documents/health |
| **D-05** the presentation count is FOUR | ⚠ **EXTENDED to FIVE** | `panel/SeamCard.tsx:72-80` — § F9. Not a refutation; an omission. |
| **D-10** `variant` inert, `is_hero` unread | ✅ **CONFIRMED** | `OutputFileCard.tsx:58-63` (docblock) — `variant` reaches only `data-variant`; `is_hero` is accepted at `:52-56` and referenced nowhere in the body |
| **D-11** ROADMAP SC#3 still names the hero split | ✅ **CONFIRMED** | `.planning/ROADMAP.md:589` — *"Multiple produced files are handled with the shipped hero/working split, not a new pattern."* |
| **D-11** the sketch record still names 016-A as winner | ✅ **CONFIRMED and BROADER than CONTEXT records** | **NINE sites** in `chat-tool-card-unification.md`, not four: `:5`, **`:61` (§C heading, "winner: A, Hero block")**, `:63-69` (the prescription + *"the agent flags the hero (D-08)"*), `:83-84` (*"Why Hero block won"*), **`:101` (the build-once inventory row `OutputFileCard` (+Hero/Working))**, `:160-166` (the `.hero` CSS + `.your` "★ Your file"), **`:242` (`<div class="hero">` in the HTML fragment)**, `:272-273` (the ❌ anti-pattern), **`:286` (`016-output-files-hero` (winner: **A — Hero block**))**. **D-11's scope is larger than its wording — the correction must be an enumerated set, not a note at §C.** |
| **D-12** ordering is not a backend property | ✅ **CONFIRMED — and the sort key is missing on live rows** | `workspace.py:330` `.order("path")`; store does not sort; SSE carries no `created_at` (§ F7) |
| **D-13/D-14** `RunCard`'s badge parses `output_files` from `tool_calls` | ✅ **CONFIRMED** (CONTEXT cites `:181-186`; the reduce block is `RunCard.tsx:179-189`) | `if (parsed.output_files) return sum + parsed.output_files.length`. An emit returns `path`/`output_file` (`phase_types.py` `_exec_llm_emit`), so the badge reads **0**. |
| **D-14** `ThreadRunLine` has zero file references | ⚠ **CONFIRMED in substance, imprecise in letter** | `grep -c "output_files"` → **0**. `grep -in "file"` → **2**, both the phrase *"in this file"* inside docblocks. **No file data, no file UI.** The decision is unaffected. |
| **D-15** 161 of 222 runs hit the empty path | ✅ **CONFIRMED** | the histogram's `0 → 161` bucket |
| **D-17** all six triples | ✅ **CONFIRMED, ZERO DRIFT** | § "Hot-file ledger obligations" |
| `ChatLayout.tsx:775-795` is why the run view lists files itself | ✅ **CONFIRMED** | `:781-786` verbatim: *"The message list, the composer and the workspace panel all live inside the `activeView === "chat" ?` branch above… and the reason the run surface renders its own deliverable list (Plan 10)."* |
| The `ChatLayout` fence breaks on prose spelling a tag | ⚠ **NARROWED** | The tag sweep runs over `codeOf(chatLayoutSource)` (`:456-482`), which strips both comment forms and is itself tested. **Prose cannot break the tag arms.** Only `:516-517` uses raw source, with needles `PostMessageResponse` / `res.run_id`, in a file this phase does not touch. § F11 relocates the live hazard. |
| Backend: emit persists thread-scoped + emits `workspace_file_written` | ✅ **CONFIRMED** | `tool_dispatcher.py:3553-3578` — `ws_write_file(thread_id=…)` then `emit(… 'workspace_file_written', id/path/version/size_bytes/mime_type)` |
| SC#1 already satisfied in source | ✅ **CONFIRMED in source; PENDING on a live run by design (D-16)** | `WorkflowRunPage.tsx:429-433` + `:1022-1094` + 102 green cases. § "The D-16 live baseline" is the procedure. |

---

## Standard Stack

No new dependency. Everything below is already installed and already in use.

### Core

| Library | Version | Purpose | Why standard |
|---|---|---|---|
| `react` | 19.x | the row component | in use |
| `@radix-ui/react-slot` | **^1.2.4** (`package.json:27`) | `asChild` — one row markup, three caller-supplied elements | **Already used by `components/ui/button.tsx:2`**; `className`/`style` merging verified in the installed dist (`:91-93`). The only construction that satisfies § F2's two absence fences. |
| `lucide-react` | in use | glyphs | all four presentations already use it |
| `clsx` + `tailwind-merge` via `cn` (`lib/utils`) | in use | class composition | every row already uses `cn` |
| `vitest` | **4.1.0** | tests | `--reporter=basic` was removed in vitest 4; the gate uses `--reporter=json` only |
| `@testing-library/react` | in use | RTL | all three surfaces' suites |
| `vitest-axe` | in use | panel a11y | `FilesSection.test.tsx:102,107` |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| `asChild` / Slot | A `render`-prop or a `Component`/`as` polymorphic prop | Works, but `as` polymorphism in TS needs generic prop plumbing (`ComponentPropsWithoutRef<T>`) that makes the row harder to read for one benefit — and Slot is already the repo's established idiom. |
| One `FileRow` with `asChild` | `FileRowBody` (interior only) + three per-surface wrappers | Simpler and Slot-free, **but the wrapper's layout classes then live in three files** — which fails "ONE row markup". Acceptable fallback if Slot's prop merging surprises at implementation time; record the downgrade if taken. |
| Additive params on `fileIcon()` (§ F10) | A second icon component for compact surfaces | Fails "exactly ONE icon path" — the SC#2 criterion. |
| Additive params on `fileIcon()` | Ship the 30 px coloured+ribbon glyph everywhere | Visibly changes the ~384 px panel row and the 220 px-capped run region, and discards Phase 088-05's panel-scoped AA contrast decision. Needs the sketch D-18 declined. |
| Client sort in `FileRow`'s caller | Sort in `streamsStore` / `StreamsProvider` | Opens a 33-phase G-5 file and trips the `StreamsProvider.tsx?raw` sweep. Decline. |
| Client sort | Change `workspace.py` to `ORDER BY created_at DESC` | Backend work — breaks the "no Python" premise, and D-12 explicitly wants it client-side and pinned. |

**Installation:** none. `## Package Legitimacy Audit` is **not applicable** — this phase installs
zero external packages. No `slopcheck` run is owed.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node + npm | vitest, tsc, the gate | ✅ | vitest 4.1.0 resolved and run this session | — |
| `frontend/node_modules` | everything | ✅ | `@radix-ui/react-slot` dist read directly | worktrees: `bash scripts/bootstrap-worktree.sh "$(pwd)"` **first** |
| Local Supabase Postgres @ `127.0.0.1:54322` | the D-01 re-verification + the D-16 baseline evidence | ✅ | reachable; 8 queries run this session | ⚠ if refused, check the **Windows port-reservation trap** (`CLAUDE.md`) before suspecting Supabase |
| `psycopg2` | DB queries | ✅ **only inside the venv** | `backend/venv/Scripts/python.exe` | ⚠ **bare `python -c "import psycopg2"` FAILS** (`ModuleNotFoundError`) — always use the venv interpreter |
| Backend uvicorn + Redis | the live D-16/D-20 run | ⚠ **NOT PROBED** — the operator starts the backend | — | the operator brings infra up: `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1` |
| A connected browser (Chrome MCP) | D-20's lived-experience rows | ⚠ **NOT PROBED** | — | ⚠ Phase 194's eight UAT rows went undriven because `list_connected_browsers` → `[]` for the whole phase. **Probe it at Wave 0, not at phase close.** `take_screenshot` times out — read DOM geometry via `evaluate_script`. |
| Microsoft Word (or any `.docx` reader) | D-20's *"open the downloaded file"* | ⚠ **NOT PROBED** | — | **No fallback that satisfies D-20.** If absent, the row is ⛔ with the reason recorded — never silently omitted. |

**Missing dependencies with no fallback:** a connected browser and a `.docx` reader for D-20. Both
are operator-side and both must be confirmed **before** planning commits to a driven-UAT close.

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|---|---|---|---|
| hero/working output-file split (sketch 016-A) | ONE quiet uniform row; `variant` inert, `is_hero` written-but-unread | **Phase 095.1, D-095.1-06** | D-10. ROADMAP SC#3 and the design record both still describe the old approach ⇒ D-11 corrects nine sites. |
| the run surface had no file list | the deliverable region, listed and downloadable, never previewed | **Phase 188-10 (`783daab5`)** | SC#1 already satisfied; the phase is consolidation. |
| `fmtElapsed` lived in `WorkflowRunPage.tsx` | hoisted verbatim to `lib/fmtElapsed.ts`, byte-proved by `lib/__tests__/runStepCount.test.ts` | **Phase 194.1-06** | **The precedent to imitate**: a hoist whose byte-identity is proved by comparing against a `git show`-captured constant. |
| the run surface had no Stop | `<StopControl variant="page">`, exactly one mount, source-fenced | **Phase 194.1-07** | The fence the refactor must not disturb (P9); also the **rewrite-in-place-and-quote-the-original** precedent for P/F1. |

**Deprecated / outdated:**
- `chat-tool-card-unification.md`'s hero material — **contradicted by shipped code since 095.1**; D-11 corrects it.
- ROADMAP Phase 195 SC#3 — names a retired pattern; D-11 rewrites it beside the original.
- `tool_dispatcher.py:3570`'s *"so OutputFileCard renders it"* — wrong component (it is `FilesSection`). **Observation only; the phase writes no Python.**
- `CLAUDE.md`'s `3918 / 0 / 3868` gate figure — **stale, measured 3972 / 0 / 3898 today.**
- CONTEXT `<code_context>`'s *"`fileIcon.tsx` … needs consumers, not changes"* — § F10 argues for two additive optional params. **Correct the note if the recommendation is taken.**

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| **A1** | Radix `Slot` merges `className` in a way that lets `FileRow` own the layout classes while the caller supplies the element | § The recommended shared row | **LOW.** The dist source explicitly branches on `propName === "className"` and `=== "style"` (`node_modules/@radix-ui/react-slot/dist/*.mjs:91-93`), and `ui/button.tsx` already relies on it. If merge order surprises, fall back to the `FileRowBody` + explicit-className construction (recorded as an alternative). |
| **A2** | `fileIcon()` at `{sizePx:16, ribbon:false, tone:"muted"}` renders visually equivalent to the panel's and run page's current 16 px monochrome glyph | § F10 | **MEDIUM.** Reasoned from the source, **not rendered and compared.** If it differs, the panel and run rows change height/appearance and D-18's declined sketch becomes a real gap. **Mitigation: capture a rendered-DOM/`getBoundingClientRect` comparison in Wave 0**, before the conversion. |
| **A3** | The extraction removes roughly 125 lines from `WorkflowRunPage.tsx`, leaving it far above the 20 000-char fence | § StopControl fence | **VERY LOW.** Measured 60 279 chars today; the estimate has ~50 000 chars of margin. |
| **A4** | Keeping `OutputFileCard`'s public prop shape identical leaves `MessageItem.tsx` and `ExecuteCodeBody.tsx` byte-unchanged | § F6 | **LOW.** Both call sites pass only `file` (`MessageItem.tsx:158`, `ExecuteCodeBody.tsx:358`). Proved by P7(a)'s `git diff --numstat` assertion, not by belief. |
| **A5** | `FilesSection.test.tsx` (11) / `MessageItem.finalOutputs.test.tsx` (11) / `fileIcon.test.tsx` (11) import zero rot into the gate if adopted | § Wave 0 gaps | **VERY LOW.** All three measured green individually this session. Re-measure at adoption and read BASELINE from the gate's `actual`. |
| **A6** | The `run_claim` field belongs to Phase 141 / COLL-02 template-asset isolation | D-01 | **MEDIUM — inherited from CONTEXT, not re-verified.** I confirmed it is 100% NULL; I did **not** read `template_asset_service.py:189-310`. The decision (do not repurpose it) holds either way on the NULL measurement alone. |
| **A7** | The `.docx` deliverable, once downloaded, opens correctly in Word | § D-16 refutation table | **MEDIUM.** Never machine-verifiable; it is exactly why D-20 requires the human to open the file. A corrupt download would be a **backend** defect and would break this phase's "no Python" premise. |
| **A8** | A browser will be reachable for D-20 | § Environment Availability | **MEDIUM-HIGH RISK.** Phase 194's eight UAT rows went entirely undriven for exactly this reason. **Probe at Wave 0.** |

**None of these assumptions is load-bearing for a locked decision** — every D-01…D-20 premise was
verified by command, query or file:line above.

---

## Open Questions (RESOLVED)

> **All four resolved by the plan set** (`b2c3674f`), verified by the plan-checker at
> `## VERIFICATION PASSED`. Each carries its resolving plan inline below. Recorded here rather than
> left implicit, because this project's Dimension-11 convention is that an unmarked open question is
> indistinguishable from an unanswered one.

1. **Does the panel row visibly change when it adopts `fileIcon()`?** (A2)
   **RESOLVED: 195-03** — the answer is **YES, and it is accepted as a DECISION rather than a no-op.**
   Adopting `fileIcon` changes four glyph categories on the panel and run page
   (`FileSpreadsheet→Table`, `FileCode→Code`, `FileImage→Image`, `File→FileText`), and `EXT_MAP` omitted
   **nine** extensions the panel's MIME-first `iconFor` covered. `195-03` extends the map and adds a
   `mimeType` input so no extension regresses; `fileIcon` gains `tone: "inherit"` (⚠ **not** `"muted"` —
   a single `"muted"` value would hardcode either the panel token or the page token, and the page is
   fenced against panel-scoped tokens). The residual delta is **surfaced to the operator at UAT
   (195-08 U3), not decided for them** — which is the narrow-question path D-18 left open when it
   declined a sketch.
   - *Known:* `fileIcon()` renders a stacked hex-coloured glyph + `.EXT` ribbon; the panel renders a
     flat 16 px `text-panel-muted-foreground` glyph chosen for AA contrast in Phase 088-05. The chat
     design record forbids the flat form; the panel design record specifies a compact row and says
     nothing about colour.
   - *Unclear:* the rendered pixel delta at `{sizePx:16, ribbon:false, tone:"muted"}`.
   - **Recommendation:** Wave 0 captures a rendered-DOM comparison of all three rows on the same
     fixture (this is also D-20's side-by-side evidence). If the delta is visible, surface it to the
     operator as a one-line decision rather than re-opening G-2 — D-18 declined a sketch for good
     reasons and this is narrower than a sketch.

2. **Where does the download CALL live — the page or the row?**
   **RESOLVED: 195-03** — **the call stays in each surface**, exactly as this section recommended, and
   the `fileRowUtils.ts` docblock records why. ⚠ **The planner went further and DECLINED the
   `downloadFrom(src, filename)` dispatcher this section sketched**, on a measured ground this section
   did not state: `WorkflowRunPage.test.tsx:1450-1455` pins `downloadWorkspaceFile(runThreadId` at
   exactly one occurrence, and that is a **TENANCY** property — download from the RUN's thread, never
   the viewed one — not a style rule. Routing the call through a shared util would have forced
   inverting a fence guarding a real security property. RUN-03 asks for one *presentation*; that is
   what ships.
   - *Known:* `WorkflowRunPage.test.tsx:1450-1455` pins `downloadWorkspaceFile(` at **exactly one**
     occurrence in page source, and pins `downloadWorkspaceFile(runThreadId`. The section-level
     error (`data-testid="run-download-error"`, no auto-clear) already lives in the page, while chat's
     error lives in-row and auto-clears after 3 s.
   - *Unclear:* whether the shared `downloadFrom(src, filename)` dispatcher is called by the row or by
     each surface.
   - **Recommendation:** **keep the call in each surface** (row takes `onActivate`). It keeps that
     fence green with no inversion, preserves both error placements verbatim (D-08 for chat, the
     shipped section error for the run page), and keeps the row purely presentational — which § F2's
     two absence fences already require.

3. **Adopt the three ungated suites into the gate, or record the decline?**
   **RESOLVED: 195-02 task 3 — ADOPT, and five suites rather than three.** ⚠ Beyond the three named
   here, `StopControl.baseline.test.tsx` is adopted too: it **greps raw `WorkflowRunPage.tsx`** and was
   ungated, and the ledger's own recorded lesson is *"a pin in an ungated suite is a pin nothing
   checks."* No decline is recorded because none is taken.
   - *Known:* all three are green (11/11/11); the script's own rule is that a decline needs a stated
     reason, because *"a decline with no recorded reason is indistinguishable from an oversight."*
   - **Recommendation:** adopt `FilesSection.test.tsx` (the phase converts that file, so its
     protection is load-bearing) and the new `components/files/` entry. For `fileIcon.test.tsx` and
     `MessageItem.finalOutputs.test.tsx`, adopt only if § F5's `supersedes` fence lands in the latter;
     otherwise record the decline with its reason.

4. **Does `SeamCard`'s chip need its false docblock corrected?**
   **RESOLVED: 195-08 — as a SEED, not a task**, exactly as recommended below. Touching `SeamCard.tsx`
   would invite the very sweep § F9 exists to prevent, so the fifth presentation is recorded as a
   **boundary** and its false docblock as a seeded follow-up carrying a concrete re-open trigger.
   - *Known:* `SeamCard.tsx:10` claims it *"reuses OutputFileCard's chip shape"*; it imports neither
     `fileIcon` nor `formatBytes`.
   - **Recommendation:** a one-line comment correction is a legitimate G-3 `/gsd:fast` candidate, or a
     seed. **Not a task in this phase** — touching it invites the sweep § F9 exists to prevent.

---

## Sources

### Primary (HIGH confidence)
- **Live local Postgres @ `127.0.0.1:54322`**, 8 queries this session via `backend/venv/Scripts/python.exe` + `psycopg2`: `workspace_files` counts / `run_claim` / `kind` / schema; `workflow_runs` counts + distinct threads + >1-run threads; the files-per-thread histogram; recent file-producing runs joined to definitions; published `llm_emit` definitions ranked by runs-with-files; `information_schema.columns`.
- **Read in full:** `frontend/src/components/chat/OutputFileCard.tsx` (187 L) · `frontend/src/components/panel/FilesSection.tsx` (277 L) · `frontend/src/lib/fileIcon.tsx` (105 L).
- **Read in relevant part:** `frontend/src/pages/WorkflowRunPage.tsx` (:110-200, :415-460, :540-575, :1005-1100) · `frontend/src/pages/WorkflowRunPage.test.tsx` (:161, :893-1035, :1425-1492) · `frontend/src/components/chat/__tests__/StopControl.baseline.test.tsx` (:505-625) · `frontend/src/components/layout/ChatLayout.launch.test.tsx` (:395-525) · `frontend/src/components/layout/ChatLayout.tsx` (:770-800) · `frontend/src/lib/api.ts` (:460-480, :836-856, :1560-1700) · `frontend/src/providers/StreamsProvider.tsx` (:934-952, :2940-2975, :3660-3680) · `frontend/src/types/index.ts` (:896-920) · `frontend/src/components/chat/RunCard.tsx` (:172-195) · `frontend/src/components/panel/SeamCard.tsx` (:60-95) · `frontend/src/components/panel/__tests__/FilesSection.test.tsx` · `frontend/src/__tests__/components/MessageItem.finalOutputs.test.tsx` · `scripts/vitest-count-gate.cjs` (:1-120, :919, :945-965, :2113-2510) · `backend/app/api/workspace.py` (:305-348) · `backend/app/services/tool_dispatcher.py` (:3545-3585).
- **Commands run:** `git log --oneline` + the `sed` bucket pipeline + `wc -l` on 7 files · `wc -c -l` on 4 files · `npx tsc --noEmit -p tsconfig.app.json` (→ 33) · `GSD_VITEST_MAX_WORKERS=2 node ../scripts/vitest-count-gate.cjs` (→ OK, 3972/0/3898, 75/75) · `npx vitest run` per-file ×5 (→ 102/11/11/11/15) · exhaustive `?raw` target enumeration · `grep` consumer maps for `fileIcon`/`fileIcons`/`OutputFileCard`/`FilesSection`/`supersedes`/`data-variant`.
- **Project records:** `195-CONTEXT.md` · `195-DISCUSSION-LOG.md` · `.planning/ROADMAP.md` § Phase 195 (:580-591) · `.planning/REQUIREMENTS.md` (RUN-01/02/03, the deferred table :114) · `.planning/STATE.md` frontmatter `stopped_at` (bounded read) · `CLAUDE.md` · `docs/HOT-FILE-LEDGER.md` (:229-260, :523-535, :537-555) · `.planning/config.json`.
- **Design records** (via `Skill("sketch-findings-agentic-rag")` references): `chat-tool-card-unification.md` (:5, :61-101, :158-170, :242, :268-276, :286) · `file-browser-and-diff.md` (:1-40, :103-108) · `icon-convention.md` (checked — carries **no** file-icon rule).
- **Dependency source:** `frontend/node_modules/@radix-ui/react-slot/dist/*.mjs` (:91-93 — `className`/`style` merge).

### Secondary (MEDIUM confidence)
- `195-CONTEXT.md`'s attribution of `run_claim` to Phase 141 / COLL-02 (`template_asset_service.py:189-310`) — the NULL measurement is mine; the provenance is inherited (A6).
- The `is_hero` write-side backend claim — read only through `OutputFileCard`'s and `MessageItem`'s docblocks, not in Python source. Out of scope either way.

### Tertiary (LOW confidence)
- None. **No claim in this document rests on WebSearch, and no external documentation lookup was needed** — every question was answerable from this repository, its installed dependencies, and the live local database.

---

## Metadata

**Confidence breakdown:**
- **Standard stack — HIGH.** Zero new dependencies; `@radix-ui/react-slot`'s version and merge behaviour read from the installed package.
- **Architecture — HIGH.** The construction is not chosen on taste: three shipped fences (`:1463`, `:1464`, `:1478`) and three a11y contracts pinned by shipped tests eliminate the alternatives mechanically.
- **Pitfalls — HIGH.** Ten pitfalls, nine measured in this repository (six as live fences, two as stale records, one as a query I got wrong twice this session).
- **Validation architecture — HIGH on the fences that exist and their exact predicates; MEDIUM on plant counts** (26 estimated across 10 claims — the true number is knowable only by driving them, and this project's history says the estimate is more likely low than high).
- **CONTEXT verification — HIGH.** Every load-bearing premise re-measured; the DB histogram reproduced exactly; zero ledger drift.
- **The one MEDIUM-risk unknown** is A2 / open question 1 — whether adopting `fileIcon()` visibly changes the panel and run rows. It is cheap to settle in Wave 0 and expensive to discover at UAT.

**Research date:** 2026-08-17
**Valid until:** **~7 days.** Three figures rot fast and are stated with their commands so they can be re-derived rather than quoted: the count-gate total (**3972**, already +54 on `CLAUDE.md`'s), the `WorkflowRunPage.test.tsx` count (**102**, pinned exact), and the six hot-file triples. The DB measurements rot on the next workflow run.
