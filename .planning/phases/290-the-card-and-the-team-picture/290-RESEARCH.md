# Phase 290: The Card and the Team Picture - Research

**Researched:** 2026-10-21
**Domain:** Frontend read-only projection (React 19 + Tailwind) over the workflow definition JSONB; library card composition; workflow canvas header
**Confidence:** HIGH for code facts (each one read in this session, with file:line). MEDIUM for the five copy corrections, which need operator confirmation before they become locked words.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Measured before deciding (2026-10-21)
- **The card's acceptance bar moved after VIS-04 was written.** VIS-04 and SEED-155 point at sketch 163, which drew labelled chips and a smaller purpose line. A later approved sketch, **179 C**, shipped in 192.2 (2026-08-19). It cut the purpose sentence and the phase glyphs from the resting card on purpose. The card today has a 3 px run-outcome gutter, line 1 with the name and version, and line 2 with run truth and state. So "the description no longer dominates" is already true. Only the chips are new.
- **Production definitions are small** (Supabase MCP read on `workflow_definitions`, no writes): 29 definitions; 7 have steps, all with 2-3 steps; **0** have `llm_batch_agents`, **0** an `llm_judge_rubric` gate, **0** a `skip_to_phase`. Most real team pictures will be the orchestrator plus 2-3 steps with no judge. The sketch's 7-step "Vendor risk review" is the stress case, not the common case. Planning and UAT must cover both.

#### The card (VIS-04)
- **D-01:** Keep the 179 C card exactly as shipped. Add **one third line** of labelled step chips under line 2. Render it **only when the definition has at least one step**. Never draw an empty chip row.
- **D-02:** The purpose or description stays off the resting card (179 C stands). VIS-04's "description no longer dominates" is met by the shipped card. The UAT records that as a measurement, not as new work.
- **D-03:** Overflow: show **the first 3 steps in run order, then a `+N more` chip**. The line never wraps. `+N more` names the remaining steps **in visible words**, not only in `title=`, because touch has no hover (SEED-155 item 1, the D-14 hover problem).
- **D-04:** Chip words are the **type sentence**, `PHASE_TYPE_SENTENCES` in `phaseVocabulary.ts` (e.g. "Work out how to do it"), with the `PHASE_GLYPHS` glyph. **Never the author's step name and never `PHASE_TYPE_LABELS`** (that map is the ⌥ technical-names vocabulary). Settled by sketch 290-card-chip-line, winner B (2026-10-21): author names run to 54 characters and truncate to stubs on a card. Never type ids, never literals in the card. Any new string is a vocabulary **entry** in `libraryVocabulary.ts` (the 286 forecast: data, no logic).
- **D-05 (G-2):** ✅ DONE 2026-10-21: `.planning/sketches/290-card-chip-line/`, winner **B** (bordered pills, glyph + type sentence, `→`, first 3 + `+N more` that expands in place). It is the SC#1 screenshot bar. Original decision: **Sketch the chip line before planning.** It is a small sketch that **renders the real card component** (or its generated build contract) with the chip line added. SEED-155's rule is that a sketch of a surface that consumes an existing component must render that component, not redraw it. The operator approves it, and it becomes the screenshot bar for SC#1. Sketch 163's hand-drawn chips are reference only, not the bar.

#### Where the team picture opens (VIS-01)
- **D-06:** **One entry point:** a `Steps | Team` switch in the workflow builder header, as sketch 290 has it. At most **one gated mount** in `WorkflowCanvas.tsx` (286 forecast). The picture is a separate read-only view, never a second canvas. There is no entry from the library card or the run page in this phase.
- **D-07:** **Anyone who can open the workflow can see its team**, including starters and another person's published workflow in read-only mode. It reads only the definition the viewer already holds, so it grants no new access and needs no new API.

#### What the picture draws (sketch 290 winner A, org chart)
- **D-08:** Layout is **A, the org chart**: the orchestrator at the top branches to every step in run order, and judges and checks hang under the step they grade. Variants B and C are rejected.
- **D-09:** **The orchestrator is the engine, not a phase.** **No step-to-step lines are drawn**: there is no field for a step-to-step link, and every step reads all earlier outputs through `accumulated_outputs`. The picture must make "steps don't talk to each other" read as true, not as a broken diagram (sketch question 2).
- **D-10:** `⤳` is drawn **only** for `on_failure: skip_to_phase:<slug>`. It runs from the check that owns the `on_failure` to the target step. `retry` is written in words, never drawn as a loop.
- **D-11:** **One pure derivation feeds the picture** (the sketch's `model()`). It lists every drawn line with its source path in the definition. That list is the SC#3 test surface: a planted workflow with no worker-to-worker link must produce zero such lines, asserted on rendered content, not only on testids.

#### Small and judge-less teams
- **D-12:** **A 1-step workflow shows an honest single node.** The switch works, and the picture shows the orchestrator plus the one step with a line in words, e.g. "One step, so there is no team to coordinate." No invented worker (SC#4). The final copy belongs to the sketch and UI-SPEC.
- **D-13:** **Absence is said once, in words.** With no gate the line is "Nothing checks this work". With only non-judge checks it is "Checked by rule, not by a judge". Final copy belongs to UI-SPEC, and the strings go in the vocabulary file.
- **D-14:** An `llm_batch_agents` step is drawn as **up to N seats**, from `max_parallel_agents`, labelled "up to N at once". The field is a cap, and how many actually ran is only known in a run. This shape appears in no production definition today, so the planted fixtures must cover it.

#### Role and gate words
- **D-15:** **Step roles reuse the shipped step words** from `phaseVocabulary.ts`, the same words the chips use (D-04). The sketch's proposed corner words (`fixed step / writer / agent / team / you / producer / outside`) are **not adopted**. There is one vocabulary and no second copy to drift.
- **D-16:** **Gates read "Judge" or "Check".** A `ValidatorSpec.kind == "llm_judge_rubric"` gate is a **Judge** and every other kind is a **Check**. These two words are vocabulary entries. The ⌥ Technical names reveal shows the real kind (`llm_judge_rubric`, `regex_match`, …) by swapping the subtitle, per the existing convention. Judges and checks get **no new glyph** (icon convention §4, X-2).

### Claude's Discretion
- Where the pure derivation lives (a new leaf next to `canvasModel.ts` or `soulData.ts`). It must be a value-only module: no React, no API import, the `cardFace.ts` pattern.
- How the chip line is fed into the card. It must stay within the ledger budget ("ONE optional prop", 286 forecasts for `PhaseSpineGraph.tsx` / `PhaseNodeCard.tsx`) and must not edit `WorkflowSoul.tsx`'s card contract unless the planner justifies it. `WorkflowSoul scale="card"` is also consumed by `WorkflowDoorSwitch.tsx`, and `PhaseSpine scale="card"` by `StarterTemplatePicker.tsx`, so a change there changes those surfaces too.
- Plan count: target 3-5 (G-8).

#### Folded seeds
- **SEED-155**, card half only: one chip line, sketched first. Status `folded` with `partial: true`. The toolbar and the counter pill stay open on the seed.
- **SEED-086**, authoring moment only. Status `folded` with `partial: true`. The live run view stays open on the seed.

### Deferred Ideas (OUT OF SCOPE)
- **LibraryToolbar rework** (filled Create button, full-width search, chips row) and the **counter pill** sized for `43 share this name`: stay open on SEED-155.
- **Live "who is working now" run view**: stays open on SEED-086 (its second moment).
- **Team picture from the run page or the library card ⋯ menu**: not in this phase (D-06). It would be a new entry point.
- **Publish-gauntlet judge in the picture**: excluded by sketch 290 (it belongs to the definition's history, not the running team).
- Reviewed, not folded: BUG-260610-01 (run nav timer) and BUG-260815-06 (gauntlet refusal copy) touch workflow UI but not the card or the team picture. Both stay open.

### UI-SPEC §11 resolved items (operator, 2026-10-21; treated as locked)
1. **Reachability: canvas-only.** The team picture is reachable wherever the canvas is on (`visual_workflow_canvas` audience `everyone` in production and as the cold default since Phase 214).
2. **Derived gates are drawn as Checks** (the engine-added `citations_required` gate and the armed action-risk checkpoint). **See Finding F-2 below: "returns a cause" must be narrowed to `=== "detected"` to match the engine.**
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-04 | The workflow library card matches its approved sketch: labelled phase chips, and the description no longer dominates. (SEED-155) | §"The card today" (row order, child-order pins, the seam286 snapshot that will move); F-1 (the F1 `title` fence); `row.def.phases` already on the wire, no backend change (§"Where the card gets its phases"); the chip-line component pattern; test map rows V4-1..V4-7 |
| VIS-01 | A multi-agent workflow can be viewed as a truthful picture of orchestrator, workers and judge, with no edges the schema does not have. (SEED-086) | §"Schema truth" (every field the derivation reads, with backend file:line); F-2..F-6 (derived-gate, failure-word, judge-criteria and fence corrections); the pure `teamPicture.ts` pattern; the WorkflowCanvas single-branch pattern and the keyboard-handler pitfall; test map rows V1-1..V1-9 |
</phase_requirements>

## Summary

Phase 290 is two frontend-only, read-only projections over a definition the client already holds. **No backend change, no migration, no new API and no new package are needed.** That is verified: `PublishedWorkflow.definition` and `DraftRow.definition` both carry the whole JSONB (`backend/app/api/workflows.py:295,386`, populated at `:475,:549,:1232`), and the library row already exposes it as `row.def` (`library/libraryRow.ts:80`, cast by `defOf` at `library/libraryFilter.ts:58`). The builder already passes `phases`, `kbTools` and `nameContext` to `WorkflowCanvas` (`WorkflowBuilderPage.tsx:2052-2075`), and the run page mounts `WorkflowCanvas` without any team prop (`WorkflowRunPage.tsx:1470-1478`).

The approved UI-SPEC is detailed and mostly right. Cross-checking it against the engine and against the repo's own fences found **six things that would fail or mislead if built as written**. (1) The chip `title={words}` attribute is forbidden by the library-subtree F1 fence. (2) The derived citations gate exists only when the grounding cause is `detected`, not for every cause. (3) Every post-timing gate retries up to `max_retries` before its `on_failure` routes, and since Phase 295 the engine's own citations gate pauses and asks the person. So "If it fails: stop the run" is false for most gates. (4) The judge's authored text lives in `config.criteria`, not `config.rubric`. (5) `"Must cite its sources"` is a retired string that `governanceVocabulary.test.ts` sweeps for, and that test reads every module in `components/workflows/`, including the planned `teamVocabulary.ts`. (6) The canvas's window-level `⌥←/⌥→` reorder handler stays live while Team is shown, so the "read-only" picture could reorder steps.

Measured base state: the 20 in-scope vitest files are green at HEAD `0f575c92c` (**1051 passed**). The frontend typecheck (`tsc -p tsconfig.app.json`) reports **63 errors at base, none in any file this phase touches**. The two snapshot files in `git status` differ from HEAD **only in line endings** (worktree CRLF, blob LF, zero content diff), and Phase 290 does not change what they pin.

**Primary recommendation:** Build one value-only derivation (`teamPicture.ts`) and one value-only chip-line resolver (`library/stepLine.ts`), both test-first. Mount each with one call: one `<StepChipLine>` block between `row-answer` and `row-identity` in the card, and one optional `team` prop plus one early-return branch in `WorkflowCanvas`. Apply corrections F-1..F-6 to the copy and derivation before writing code. Split the work into 4 plans: 2 parallel in wave 1, then canvas wiring, then a closing ledger and count-gate plan (the 286-05 precedent).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chip line on the library card (VIS-04) | Browser / Client | — | Pure render of `row.def.phases`, already delivered by `/workflows/published`, `/starters`, `/drafts`. No request. |
| `+N more` expand/collapse | Browser / Client | — | Local per-card UI state. Not persisted (UI-SPEC §1.3). |
| Team derivation (steps, gates, lines) | Browser / Client (pure module) | — | A total function of the in-memory phases plus `kbTools` (already fetched by the builder via the grounding bundle). It must mirror engine rules (`grounding.effective_phase`, the retry loop) without calling the server. |
| Engine truth the picture mirrors | API / Backend | — | `grounding.py:1367 effective_phase`, `harness_engine.py:696/1120/1161` retry loop, `engine_ask.py:103 _parse_on_failure`. **Read-only reference. Nothing in the backend changes.** |
| `Steps | Team` switch + mount | Browser / Client | — | One optional prop on `WorkflowCanvas`. The builder passes it and the run page does not. |
| Access control (who may see a team) | API / Backend (existing) | — | Unchanged. The viewer can only open definitions the existing endpoints return (D-07). No new surface. |

## Project Constraints (from CLAUDE.md)

- No LangChain or LangGraph (not relevant here; no LLM call in this phase).
- **Frontend typecheck is VACUOUS as usually run.** Use `npx tsc -p tsconfig.app.json --noEmit` and **set-diff** the error list against base. Measured base: **63 errors, 0 in target files.**
- **Vitest count gate:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root. The contract is no per-file DECREASE and 0 failing. Never quote a total, re-derive it. If a run reds, capture failing files from the gate's own JSON report before re-running.
- **≤ 2 concurrent test-running agents.** Worktrees must be bootstrapped (`bash scripts/bootstrap-worktree.sh "$(pwd)"`) and torn down with `scripts/teardown-worktree.sh`, never `rm -rf`.
- **G-5 / hot-file ledger:** `node scripts/check-hot-file-ledger.cjs <phase>` fails when `files_modified` names a source file with no ledger row. **`__fixtures__/` files are NOT exempt** (only `__tests__/` and `*.test.*`), verified by running the gate. The CLAUDE.md FIRING-table verdict cell cap is **80 chars**. The docs scan-list cap is **200**. A row and its section are updated in the **same commit**.
- **G-8:** target 3-5 plans. Run targeted suites per task and full gates once per wave. Never cut the verifier, TDD RED drives, security review or code review.
- **G-4:** user-visible UI, so the operator-defined failure scenarios (UI-SPEC §6) are driven with Chrome MCP at verification, with a screenshot **and** a rendered-text read. UAT rows go in VALIDATION.md (or the verify-work UAT file), **never in PLAN.md tasks**.
- **G-2:** done (both sketches approved).
- **Assert rendered CONTENT, not presence** (G-8 lesson). Testids alone do not pass a row.
- Backend unit baseline gate (71 failed ceiling): **not triggered.** No backend file is modified. Record "backend untouched" rather than running it, or run it once at the close if the planner wants a belt.
- The cross-provider UAT roster rule does **not** apply (no streaming, agent loop or provider routing touched).
- Supabase MCP: reads are free and writes need per-action approval. This phase needs no cloud write.
- Do not stage the two pre-existing `*.seam286.pin.test.tsx.snap` working-tree changes (EOL-only; see §"The seam286 snapshots").

## Standard Stack

### Core (all already installed; nothing new)
| Library | Version (package.json) | Purpose | Why |
|---------|---------|---------|--------------|
| react | ^19.2.4 | Render | House framework |
| tailwindcss tokens | (tailwind.config.js) | `primary`, `accent-violet`, `accent-violet-text`, `warning`, `muted`, `border`, `card` | UI-SPEC colour contract; both themes |
| lucide-react | installed | Chrome icons only | House chrome set |
| `lib/phaseGlyph.tsx` `phaseGlyph(type)` | in-repo | 3D phase-type marks, own-property guarded (`:106-121`) | The single phase-type icon source (icon-convention §2) |
| vitest | ^4.1.0 (ran v4.1.0) | Tests | House runner, jsdom env, `src/setupTests.ts` |
| vitest-axe | installed (`setupTests.ts:6`) | `toHaveNoViolations` | Use for the picture's `<figure>`/`<ol>`/`<ul>` semantics |
| @xyflow/react | ^12.11.2 | **NOT used by the picture** | D-06/§3.8: no second canvas, no xyflow instance |

### Supporting in-repo helpers (reuse, never re-implement)
| Helper | Location | Signature | Use |
|---|---|---|---|
| `PHASE_TYPE_SENTENCES` | `phaseVocabulary.ts:211` | `Record<string,string>` (7 keys) | Chip words and step role row |
| `PHASE_TYPE_SUBTITLES` | `phaseVocabulary.ts:228` | `Record<string,string>` | Role row when the title already equals the sentence |
| `PHASE_TYPE_LABELS` | `phaseVocabulary.ts:249` | `Record<string,string>` | ⌥ only (via `technicalTitle`) |
| `nodeTitle` | `phaseVocabulary.ts:290` | `(phase: PhaseSpecJSON, ctx?: NameContext) => string` | Step title. Total: reads `phase.config?.phase_type` |
| `technicalTitle` | `phaseVocabulary.ts:305` | `(phase) => string` | ⌥ subtitle. ⚠ **NOT total:** reads `phase.config.phase_type` unguarded and does a bracket read |
| `SKIP_PREFIX`, `parseSkipTarget` | `phaseVocabulary.ts:104,122` | `(onFailure: string\|null\|undefined) => string\|null` | ⤳ only. Parity-pinned with backend `reachability.parse_skip_target` via `__fixtures__/skipParseCases.json` |
| `groundingCauseOf` | `phaseVocabulary.ts:465` | `(phase, kbTools: readonly string[]) => "detected"\|"already-set"\|"escalated"\|null` | Derived citations gate. ⚠ reads `phase.config.*` unguarded, so it throws on a config-less phase |
| `actionRiskArmed` | `phaseVocabulary.ts:512` | `(phase) => boolean` (`=== true`) | Derived armed check. The same function the canvas detour uses (`canvasModel.ts:388,410`) |
| `own<T>` | `ownProperty.ts:82` | `(table: Record<string,T>, key: string) => T\|undefined` | **Every** keyed lookup (`PHASE_TYPE_SENTENCES`, `GATE_KIND_WORDS`, …): the WR-04 prototype guard |
| `GOVERNANCE_SEAL_LABEL` | `definitionOps.ts:505` | `"Must prove it"` | Derived grounding check words (reuse, never re-spell) |
| `GOVERNANCE_GATE_ROW_LABEL` | `definitionOps.ts:560` | `"Must prove it — retrieved sources, pointed at in the answer"` | Candidate words for the derived citations check (see F-5) |
| `TechnicalNamesToggle` + `useTechnicalNamesOptional` | `components/admin/TechnicalNamesToggle.tsx`, `providers/TechnicalNamesProvider` | — | Already in the canvas header (`WorkflowCanvas.tsx:1274`). Canvas exposes `showTechnical` (`:687`) |
| Canvas fixtures | `__fixtures__/canvasFixtures.ts` | `researchSummarize`, `planExecuteVerify`, `literatureReview`, `docQaHuman`, `riskRegister`, `singlePhase`, `emptyDraft`, `branching`, `unresolvableSkip`, `indexGap` | Reuse as-is for team-picture tests. **Import, never edit** (they feed many suites) |

### Alternatives considered
| Instead of | Could use | Tradeoff |
|---|---|---|
| Separate `library/stepLine.ts` (pure) + `library/StepChipLine.tsx` | One `StepChipLine.tsx` with an internal helper | Fewer ledger rows and subtree-fence entries, but the overflow math is then only testable through render. Recommend the two-file split. |
| Measured SVG line layer (`getBoundingClientRect` + `ResizeObserver`) | Pure CSS borders in the grid (bus = border-top of the step row; drops = pseudo-elements) | CSS avoids measurement and jsdom zero-rect problems for handoff and gate lines. The ⤳ jump still needs geometry across columns. Recommend measured SVG for all lines, one layer, with `data-line-*` attributes carrying the truth for tests. |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck was not run: there was nothing to check.

| Package | Registry | Disposition |
|---|---|---|
| (none) | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Measured Facts the Planner Must Use

### Hot-file triples (re-derived 2026-10-21 with the CLAUDE.md recipe, 6-digit buckets dropped)

| File | Triple now | Ledger row says | G-5 | 286 forecast / binding note |
|---|---|---|---|---|
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | **22 / 8 / 1354** | 22 / 8 / 1354 ✓ | FIRES | Seam taken (286-04). *"the card is drawing only; 290 adds faces, not state."* Card `useState` count is **0**. ⚠ *"Phase 290's re-skin is linted more strictly than every earlier phase here"* (React Compiler lint now covers the card) |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | **31 / 9 / 1708** | 31 / 9 / 1708 ✓ | FIRES | *"Expected change in Phase 290, honoured by construction: the team picture is a separate read-only view (VIS-01: never a second canvas); at most one gated mount here. A change larger than that — a new branch, a new hook, a second concern — is the signal to propose this file's extraction FIRST."* |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | **59 / 24 / 2808** | 59 / 24 / 2808 ✓ | FIRES | 288-01 last touch. 286-05: *"the next concern added should name its seam first"*; `useState` = 15. 290 adds **one prop at the existing `<WorkflowCanvas` call**, no state |
| `frontend/src/components/workflows/library/libraryVocabulary.ts` | **11 / 5 / 766** | 11 / 5 / 766 ✓ | FIRES | *"chip labels added as vocabulary entries (data), no logic."* Invariant: **exact-match assertions only** (prefix-sharing words make `toContain` vacuous) |
| `frontend/src/components/workflows/phaseVocabulary.ts` | **17 / 7 / 1055** | ⚠ STALE: `16 / 6 / 990` | FIRES | **Do not edit in 290.** Invariant: map reads go through `hasOwnProperty.call` (WR-04). `EXTERNAL_CAPABILITY_SENTENCES` has exactly three keys (cross-language fence) |
| `frontend/src/components/workflows/soulData.ts` | **13 / 11 / 523** | 13 / 11 / 523 ✓ | FIRES | **Do not edit.** `PHASE_GLYPHS` key set is asserted identical to `phaseGlyph.PHASE_GLYPH_MARKS` |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | 8 / 6 / 723 | ✓ | FIRES | Forecast said one optional prop for chips. **UI-SPEC §9 says NOT touched**, which is correct: chips are on the library card, not the graph |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | 18 / 9 / 490 | ✓ | FIRES | **Not touched** (UI-SPEC §9) |
| `frontend/src/pages/WorkflowRunPage.tsx` | 33 / 13 / 1594 | ✓ | FIRES | **Not touched.** It mounts `WorkflowCanvas` at `:1470` with no team prop |
| `frontend/src/components/workflows/library/cardFace.ts` | 3 / 1 / 207 | ✓ | no | Pattern only. Not edited |

⚠ The `phaseVocabulary.ts` row is stale. Phase 290 does not edit that file, so G-5 does not oblige a re-derive. If the closing plan touches its section anyway, record `17 / 7 / 1055` beside the old value.

### New files need ledger rows (verified by running the gate)
`node scripts/check-hot-file-ledger.cjs --files …` reports `[no-row]` for every planned new source file, **including** `__fixtures__/teamFixtures.ts`. Each needs a scan-list row (`young (created 290-0N)`) and a section in `docs/HOT-FILE-LEDGER.md`, both in the same commit.

### The card today (child order inside the `min-w-0 flex-1` column, `WorkflowCard.tsx:1062-1270`)
`[0]` name row (mark, `face.lead`, version) → `[1]` `data-testid="row-answer"` (`:1090`) → `[2]` `data-testid="row-identity"` (`:1205`) → `[3]` folder chip (conditional `folderName &&`) → `[4]` `row-match-reason` (conditional `matchReasons.length > 0`). Inserting `row-steps` between `[1]` and `[2]` shifts identity, folder and match on cards **with steps only**.

**Child-order pins that move (same commit, by decision):** `WorkflowCard.test.tsx:787-796` (length 4 → 5, `[2]` → `[3]`), `:806-807` (3 → 4), `:1048-1052`, `:1578` (`children[2]`), `:2073` (length), `:2130-2135` (5 → 6). The `DEF` fixture at `WorkflowCard.test.tsx:119` carries phases, so every case using it sees the chip line. `NO_EMIT_DEF` (1 phase) and `EMPTY_PHASES_DEF` (`phases: []`, `:142`) exist and cover 1 chip and no row.

**Pins that stay green unchanged:** the D-06 emoji sweep (`WorkflowCard.test.tsx:2004-2020`) scans `textContent` for U+1F300-1FAFF. Glyphs are SVG components with no text, and `→` is U+2192, so it stays green. The "D-03 six CUT atoms" pins (`WorkflowCard.baseline.test.tsx:159-171,376,440`) forbid testids `soul-purpose/needs/spine/tier/output`. **The chip line must use `row-steps` and must NOT reuse `PhaseSpine`**, which emits `soul-spine`.

### The seam286 snapshots (the two files in `git status`)
- `frontend/src/pages/__tests__/__snapshots__/WorkflowBuilderPage.seam286.pin.test.tsx.snap` and `.../WorkflowRunPage.seam286.pin.test.tsx.snap`: **the working-tree change is line-endings only.** Every line is CRLF in the worktree and the HEAD blob has 0 CRs. `git diff` prints no content hunk, only the autocrlf warning. **Do not stage or "fix" them.**
- What they pin: the builder pin has 4 snapshots, `header-flag-on/off` and `grid-flag-on/off`. The grid-flag-on capture shows the **Spine** view (`builder-view-spine aria-selected="true"`), because `graphView` defaults to `"spine"` (`WorkflowBuilderPage.tsx:666`). `WorkflowCanvas` is not mounted in any capture. The run pin has 5 load-screen snapshots and none contains the canvas header. **Phase 290 changes neither**, provided the canvas header is byte-identical when the `team` prop is absent.
- ⚠ **A different pin DOES move:** `library/__tests__/WorkflowCard.seam286.pin.test.tsx`. Its `DEF` has one `llm_agent` phase (`:53-55`), so the 5 resting-card `outerHTML` snapshots (`:150-154`) will gain a one-chip `row-steps` block. That is a deliberate fence edit. Update only that `.snap`, show in the commit that the `.snap` diff is exactly the inserted block, and record it as a "tests edited" entry (the 286 D-13 habit).

### Where the card gets its phases
`row.def: DefShape | undefined` (`libraryRow.ts:80`). `DefShape.phases?: Array<{slug?, phase_index?, name?, config?: {phase_type?, …}, validators?}> | null` (`soulData.ts:89-95`). ⚠ **`phase_type` lives at `phase.config.phase_type`, not `phase.phase_type`.** `defOf` is an unchecked cast, so `def.phases` can be any JSON. Guard with `Array.isArray`. No backend change.

### Schema truth the team derivation must mirror (backend, read 2026-10-21)
| Fact | Source |
|---|---|
| `ValidatorSpec.kind` ∈ `json_schema, regex_match, workspace_file_exists, programmatic, citations_required, freshness, structure_check, output_file_valid, llm_judge_rubric, action_risk_approval` | `models/harness.py:498-503` |
| `on_failure: str = "fail_run"` (`fail_run \| retry \| skip_to_phase:<slug> \| ask_user`); `max_retries: int = 2`; `timing: "pre"\|"post" = "post"` | `models/harness.py:505-507` |
| `max_parallel_agents: int = 5` (only on `llm_batch_agents`) | `models/harness.py:118` |
| **Every POST gate retries up to the failing validator's `max_retries` before `on_failure` routes, for EVERY disposition** | `harness_engine.py:696, 1120, 1161-1189` |
| `retry` and `fail_run` route identically on exhaustion (fail the run); unknown values fail safe to `fail_run` | `engine_ask.py:103-131` |
| PRE gates do not enter the retry loop | `harness_engine.py:706-724` |
| `skip_to_phase` jumps the cursor (`i = target_i`), forward **or backward**; a missing target **fails the run** at runtime | `harness_engine.py:1989-2030` |
| Engine appends **exactly one** gate, `citations_required` (`on_failure="fail_run"`, `max_retries=2`, `config.mode="retrieved_and_cited"`), **only when `grounding_cause(phase) == "detected"`** (`available_tools ∩ KB_TOOLS`) | `grounding.py:1367-1435`, `KB_TOOLS` at `:1092` |
| **Phase 295 (on `develop`, not yet in production):** when that engine gate fails after retries, the run **pauses and asks the person** (`engine_pause`), except on a retrieval outage (fails) and in a publish golden run (fails) | `engine_ask.py:356-372, 944-947`; `grounding.py:1192 is_engine_citation_gate` |
| The armed approval is a pre-body checkpoint keyed on `phase.action_risk_armed`, not a validator in the list; `external_action` is structurally armed at the model | `grounding.py:1215-1228`, `models/harness.py:555, 633-642`, `engine_ask.py:373-394` |
| The judge's author text is **`config.criteria`** (the rubric core is fixed server-side) | `validator_kinds.py:621-652` |
| `escalated` alone attaches **no** runtime gate; it only narrows the pause choices of a detected step (`is_locked`) | `engine_ask.py:740-746, 948` |

## Corrections to the Approved UI-SPEC (found by measurement)

These are drift findings. Each comes with a recommended resolution. F-1, F-4 and F-6 are mechanical and need no operator call. F-2, F-3 and F-5 change user-visible words, so confirm them with the operator (see Open Questions) before they are locked.

- **F-1: `title={words}` on chips is forbidden.** `library/librarySubtree.fences.test.ts:270-311` (F1, *"no hover-only explanation anywhere in the library subtree"*) parses every listed `library/*` module and fails on any JSX `title` attribute. `WorkflowCard.tsx` is on the list (`:88`). **Drop the `title` attribute.** The words are already visible text, so nothing is lost. Do not dodge the fence by putting the chip component outside `library/`: add the new module(s) to `LIBRARY_SUBTREE_PATHS` in the creating commit. The length pin `toHaveLength(15)` at `:171` moves to 16 or 17, and the suite count moves by 5 `it.each` sweeps per module (gate pin `librarySubtree.fences.test.ts: 133`).
- **F-2: derived citations check only for `detected`.** UI-SPEC §3.5 says *"a step where `groundingCauseOf` returns a cause"*. The engine appends the gate **only** for `detected` (`grounding.py:1424`). An `already-set` emit enforces citations inside the step, and `escalated` alone attaches nothing. **Use `groundingCauseOf(phase, kbTools) === "detected"`.** Pre-existing drift to record, not fix: the builder panel's `gatesFor` shows a locked gate row for `escalated` too (`WorkflowBuilderPage.tsx:436-445`), and the canvas seal marks escalated steps "Must prove it", but the engine attaches no gate for an escalated non-KB step. The picture should tell the engine's truth. Recommend filing a `BUG-` report (surface Agentic-RAG) rather than folding it.
- **F-3: failure words must follow the retry loop.** Every post gate retries up to `max_retries` before routing (`harness_engine.py:1161`). So `fail_run` → "stop the run" omits the retries, and `failRetry(n)` omits what happens after. The engine's own citations gate now **asks you** after its retries (Phase 295). Recommended composition: `If it fails: redo the step (up to N times), then <stop the run | ask you | ⤳ jump to step N>`. Drop the redo clause when N = 0 and for `timing: "pre"`. For the derived citations check: `redo the step (up to 2 times), then ask you`. `retry` is still never drawn as a loop (D-10 holds).
- **F-4: judge text is `config.criteria`.** UI-SPEC §3.3 reads `config.rubric`, which comes from the sketch fixture. The engine reads `config.criteria` (`validator_kinds.py:646`), and no frontend code authors either key. **Render `config.criteria` when it is a non-empty string, otherwise render nothing** (no placeholder).
- **F-5: `"Must cite its sources"` is a retired string.** It is `RETIRED_BADGE_STRINGS[0]` in `governanceVocabulary.test.ts:131-135`, which sweeps **every** non-test `components/workflows/*.{ts,tsx}` module plus `WorkflowBuilderPage.tsx` (`:65-86`). `teamVocabulary.ts` in that directory would turn criterion 14 RED. The same suite bans the words `Proven`, `Ungoverned`, `Unchecked`, `Not applicable`, `N/A` and `traceable`, plus the two overclaim phrases (`:138-151`). **Pick new words for `GATE_KIND_WORDS.citations_required`.** Recommended: reuse `GOVERNANCE_GATE_ROW_LABEL`'s tail (`retrieved sources, pointed at in the answer`) or `"Must point at the documents it used"`. Run that suite as part of the plan's verify step.
- **F-6: the ⌥←/⌥→ reorder handler stays armed in Team mode.** `WorkflowCanvas.tsx:1143-1200` registers a **window** keydown listener whenever `editable && selectedSlug !== null`, and calls `onCommitNodes` (a definition write). Hooks run regardless of which JSX branch returns, so a selected step plus ⌥→ while viewing Team would **reorder the workflow**. **Gate the effect:** add `|| teamShown` to its early return and to its deps. This is the one additional conditional the budget must spend. Test it with a fireEvent keydown in Team mode asserting `onCommitNodes` is not called (positive control: the same keydown in Steps mode does call it).

Smaller divergences to settle in the plan, all with a recommended answer:
- **Run order tie-break.** `canvasModel.ts:600` sorts by `phase_index`, then `slug`. `PhaseSpine.tsx:39` uses a stable sort by `phase_index` (array order on ties). UI-SPEC says "ties keep array order". **Recommend:** the team picture uses canvasModel's comparator, so Steps and Team never disagree on a malformed draft. The card uses the stable `phase_index` sort. Ties only arise on unsaved or invalid drafts, because publish lint rejects them.
- **Totality.** `technicalTitle` and `groundingCauseOf` throw when `phase.config` is absent. The derivation must check `phase.config` is an object before calling either, and fall back to the raw floors. `max_parallel_agents` must pass `Number.isInteger(n) && n > 0` or fall back to 5. Seat dots are `min(N, 8)`.
- **"Scroll position is not lost" (UI-SPEC §2) is not achievable as stated if the plane unmounts.** `<ReactFlow fitView>` (`WorkflowCanvas.tsx:1513`) re-fits on remount. Selection and unsaved edits survive because the page holds them. **Recommend:** accept the re-fit (the same thing that happens when the Canvas tab is opened) and correct the wording in VALIDATION. Keeping the plane mounted but hidden is possible, but React Flow then measures a 0-size pane.
- **Unresolvable jump target:** the engine fails the run (`harness_engine.py:1999-2016`). Recommend `FAIL_JUMP_MISSING` read `jump to a step this workflow doesn't have, so the run stops`.
- **Workflow name for the `<figure aria-label>`:** `identityLabel` is declared at `WorkflowBuilderPage.tsx:2527`, **after** `graphChild` (`:2041`), so referencing it there is a TDZ error. Pass an inline expression from `meta` (`typeof meta.name === "string" && meta.name ? meta.name : meta.slug ?? …`), or move nothing and name the figure from the prop the builder computes inline.
- **Two-level tabs.** The builder already has a `Spine | Canvas` tablist (`builder-view-toggle`, `WorkflowBuilderPage.tsx:2099-2140`, default Spine). The `Steps | Team` tablist inside the canvas header is therefore reached in two clicks (Canvas → Team). This follows §11.1 (canvas-only). Keep `aria-label="Show steps or team"` distinct from `"Graph view"` so the two tablists are distinguishable to a screen reader.

## Architecture Patterns

### System Architecture Diagram

```
 Library page                                  Builder page (Canvas tab selected)
 ─────────────                                 ───────────────────────────────────
 GET /workflows/{published,starters,drafts}    in-memory `phases` (incl. unsaved edits)
        │ definition JSONB (already on wire)          │            kbTools (grounding bundle, already fetched)
        ▼                                             ▼                 │
 libraryFilter.defOf → row.def                 <WorkflowCanvas phases kbTools nameContext team={{workflowName}}>
        │                                             │
        ▼                                             ├─ header: [mode pill + hint] … [Steps|Team tablist] [⌥ toggle]
 stepLine.ts  resolveStepLine(def)                    │        (tablist rendered ONLY when `team` prop present)
   · Array.isArray guard                              │
   · stable sort by phase_index                       ├─ view === "steps" → existing plane (unchanged bytes)
   · words = own(PHASE_TYPE_SENTENCES,type) ?? type   │
   · shown = first 3, rest = N                        └─ view === "team"  → ONE early-return branch
        │  null when 0 steps                                    │  (keyboard reorder effect gated off)
        ▼                                                       ▼
 <StepChipLine line={…}/>  (own useState: expanded)     teamPicture.ts  deriveTeam(phases, kbTools, nameCtx)
   · <ol aria-label> chips (glyph + words)                 · steps[] (order = canvasModel comparator)
   · → joiners aria-hidden                                 · gates[] = validators[] + derived(detected) + derived(armed)
   · +N more / Show less (aria-expanded)                   · lines[] = handoff ×N, judge/check ×gates, jump only if
        │                                                     parseSkipTarget(on_failure) ∈ slugs
        ▼                                                  · absence: none | noJudge | oneStep | empty
 WorkflowCard: ONE block between row-answer                    │
 and row-identity (absent when null)                           ▼
                                                        <TeamPicture model showTechnical workflowName/>
                                                          · <figure> > orchestrator <p>, steps <ol>, gates nested <ul>
                                                          · SVG line layer aria-hidden, one <path> per lines[] item,
                                                            data-line-kind / data-line-source
                                                          · caption; ⌥ → ledger (every line + source + LEDGER_NO_LINKS)
```

### Recommended Project Structure (new files only)
```
frontend/src/components/workflows/
├── teamPicture.ts            # pure derivation (no React, no @/lib/api) — the D-11 surface
├── teamVocabulary.ts         # every team-picture string; imports step words, never copies them
├── TeamPicture.tsx           # render + line layer + ⌥ ledger; read-only, no focusables
├── __fixtures__/teamFixtures.ts   # planted stress/malformed/batch-20/7-step fixtures (needs a ledger row)
└── library/
    ├── stepLine.ts           # pure: def → {chips, more} | null   (joins LIBRARY_SUBTREE_PATHS)
    └── StepChipLine.tsx      # render + expanded state            (joins LIBRARY_SUBTREE_PATHS)
```

### Pattern 1: Value-only derivation that cannot invent a step-to-step line
**What:** `deriveTeam` builds `lines[]` in exactly three loops: one handoff per step, one gate line per gate, and a jump only when the skip target resolves. There is no other code path that produces a line whose `from` and `to` are both steps.
**When:** the D-11/SC#3 surface. Tests assert on `lines[]` and on the rendered `data-line-kind` set.
```typescript
// Shape sketch, not final code. Every lookup goes through own(); every config read is typeof-guarded.
export type LineKind = "handoff" | "judge" | "check" | "jump"
export interface TeamLine { kind: LineKind; from: string; to: string; source: string }

export function deriveTeam(phases: readonly PhaseSpecJSON[], kbTools: readonly string[], ctx?: NameContext): TeamModel {
  const ordered = [...phases].sort(byIndexThenSlug)            // canvasModel.ts:600 comparator
  const slugToNumber = new Map(ordered.map((p, i) => [p.slug, i + 1]))
  const lines: TeamLine[] = []
  ordered.forEach((p, i) => {
    lines.push({ kind: "handoff", from: "orchestrator", to: `step-${i}`, source: `phases[${i}].phase_index = ${p.phase_index}` })
    const validators = Array.isArray(p.validators) ? p.validators : []
    validators.forEach((v, k) => {
      const judge = v?.kind === "llm_judge_rubric"
      lines.push({ kind: judge ? "judge" : "check", from: `gate-${i}-${k}`, to: `step-${i}`, source: `phases[${i}].validators[${k}].kind = "${String(v?.kind)}"` })
      const target = parseSkipTarget(typeof v?.on_failure === "string" ? v.on_failure : undefined)
      const targetNumber = target === null ? undefined : slugToNumber.get(target)
      if (targetNumber !== undefined) {
        lines.push({ kind: "jump", from: `gate-${i}-${k}`, to: `step-${targetNumber - 1}`, source: `phases[${i}].validators[${k}].on_failure = "${v.on_failure}"` })
      }
    })
    // derived gates: config is an object AND groundingCauseOf(...) === "detected"  (F-2); actionRiskArmed(p)
  })
  // ...
}
```
Note: `source` strings are rendered as **text / attribute values via React**, never as HTML.

### Pattern 2: The card block, one mount, no card state
**What:** the card calls `resolveStepLine(row.def)` (pure) and renders `{line && <StepChipLine line={line} />}` between `row-answer` and `row-identity`. The toggle `useState` lives in `StepChipLine`, so the card's `useState` count stays 0 (ledger: "290 adds faces, not state").
**Why:** within the "one block, one value" budget (UI-SPEC §9). Each card has its own instance, so the state is per card and resets on remount (§1.3).
**Strings:** `STEP_LINE_LABEL`, `STEP_LINE_JOINER`, `stepLineMore(n)`, `stepLineMoreLabel(n)`, `STEP_LINE_LESS` are added to `libraryVocabulary.ts`. Chip words are read from `PHASE_TYPE_SENTENCES` via `own()`. An unknown type echoes the raw string, and an unknown type gets no glyph (`phaseGlyph` returns null).

### Pattern 3: One optional prop, one branch in `WorkflowCanvas`
```tsx
// WorkflowCanvasProps gains ONE optional member:
team?: { workflowName: string }
// One local state for the switch:
const [view, setView] = useState<"steps" | "team">("steps")
const teamShown = team !== undefined && view === "team"
// keyboard reorder effect: if (!editable || selectedSlug === null || teamShown) return   (F-6)
// header: the tablist renders ONLY when `team` is present → prop-absent header is byte-identical
// ONE early return, placed BEFORE the `nodes.length === 0` early return (so 0-step Team works):
if (teamShown) return (<section aria-label=…>{header}<TeamPicture … /></section>)
```
This spends **one prop, one `useState`, one early return, one extra effect condition and one mount**. That is honoured by construction if the planner states each item in the ledger section. Anything more (a second hook, a memo for the model in the canvas, more branches) means the derivation belongs in `TeamPicture`, which computes `useMemo(() => deriveTeam(...))` itself. **Recommend: `TeamPicture` owns the memo**, so the canvas gains no `useMemo`.

### Anti-Patterns to Avoid
- **Porting the sketch's `model()` HTML building.** `290-team-picture/index.html:197-248` builds markup with template strings for `innerHTML`. Render as JSX text only. `dangerouslySetInnerHTML` is fenced in the library subtree, so add the same negative fence for `TeamPicture.tsx` / `teamPicture.ts` / `teamVocabulary.ts`.
- **Bracket reads on presentation maps** (`PHASE_TYPE_LABELS[type] ?? type` returns `Object.prototype.constructor` for a type named `constructor`). Use `own()`. Do not call `technicalTitle` on untrusted input without a config guard. Compose `${own(PHASE_TYPE_LABELS,t) ?? t} · ${slug}` in the leaf if needed, but only if a test proves `technicalTitle` cannot be reused safely. The default is to reuse it behind the guard.
- **Reusing `PhaseSpine scale="card"` or `WorkflowSoul` for the chip line.** It changes `StarterTemplatePicker.tsx` / `WorkflowDoorSwitch.tsx` and re-emits the cut `soul-spine` testid.
- **Putting team strings in `phaseVocabulary.ts`** (G-5 firing) or copying step sentences into `teamVocabulary.ts` (D-15: one vocabulary).
- **Drawing a gate for `already-set` or `escalated`** (F-2), drawing `retry` as a loop (D-10), or drawing a jump for an unresolvable slug.
- **A node that is focusable or clickable in the picture** (§3.8). Do not wrap step nodes in `<button>`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| skip target parse | a `split(":")` | `parseSkipTarget` | Cross-language parity fixture. The old split-on-last-colon copy was wrong (C-1) |
| grounding detection | a KB-tool intersection | `groundingCauseOf(…) === "detected"` + `kbTools` prop | One rule, one home (D-182-06). The server owns the list |
| armed reading | `phase.action_risk_armed` inline | `actionRiskArmed` | The canvas detour reads the same function |
| safe map read | `MAP[key] ?? fallback` | `own()` (`ownProperty.ts:82`) | WR-04, found eight times in this tree |
| phase glyph | an icon switch, emoji | `phaseGlyph(type)` | Single source, own-guarded, bundled 3D SVG |
| step title | name fallback logic | `nodeTitle(phase, nameContext)` | The same face as the Steps view, and total |
| governance words | re-typed "Must prove it" | `GOVERNANCE_SEAL_LABEL` / `GOVERNANCE_GATE_ROW_LABEL` | Re-spelling breaks the "composed, never re-typed" rule and risks the retired-string sweep |
| fixtures | new 3-step seeds | `__fixtures__/canvasFixtures.ts` exports | Already transcribed from the real seed SQL |
| ⌥ state | a new context read in the picture | pass `showTechnical` from the canvas (`:687`) | One reader |

**Key insight:** every honesty rule this picture needs already has a tested home. The risk in this phase is a second copy of a rule, not a missing one.

## Common Pitfalls

### Pitfall 1: Words that read right on the sketch and lie at runtime
**What goes wrong:** "If it fails: stop the run" on a gate that actually retries twice, or on the engine gate that now asks you (F-3). "Must prove it" drawn on an escalated step the engine never gates (F-2).
**How to avoid:** derive the words from `(timing, max_retries, on_failure, isEngineGate)`. Pin one test per disposition, plus pre-timing and `max_retries: 0`.
**Warning sign:** a failure-words test that only covers `fail_run` and `retry`.

### Pitfall 2: A green fence over the wrong file set
**What goes wrong:** a new `library/` module not added to `LIBRARY_SUBTREE_PATHS` is swept by nothing, and every fence stays green (recorded three times in that file).
**How to avoid:** add it in the creating commit. Move the length pin and the gate pin.

### Pitfall 3: The retired-string sweep reds the vocabulary leaf
**What goes wrong:** `teamVocabulary.ts` ships `"Must cite its sources"` and `governanceVocabulary.test.ts` criterion 14 fails (F-5).
**How to avoid:** run `governanceVocabulary.test.ts` in the vocabulary task's verify step.

### Pitfall 4: The "read-only" view writes the definition
**What goes wrong:** the window keydown reorder handler fires while Team is shown (F-6).
**How to avoid:** gate the effect, plus a test with a positive control.

### Pitfall 5: Header bytes move on the run page or flag paths
**What goes wrong:** a wrapper `<div>` or a reordered `<span className="flex-1" />` changes the canvas header for every consumer.
**How to avoid:** render the tablist only when `team` is present. Commit a characterization `outerHTML` pin of the canvas section (editable and read-only, prop absent) **before** editing, and show `git diff --numstat <pin-commit> HEAD -- <pin>` empty at the end (the 286 pattern).

### Pitfall 6: jsdom zero rects and a missing ResizeObserver
**What goes wrong:** `getBoundingClientRect` is all zeros in jsdom and `ResizeObserver` is not defined globally (only `mockReactFlow()` installs it, `test-utils/mockReactFlow.ts:51`). A line layer that throws or skips rendering on zero geometry fails tests.
**How to avoid:** guard `typeof ResizeObserver !== "undefined"`. Always render one SVG element per `lines[]` item with its `data-line-kind`/`data-line-source` (geometry may be degenerate). Assert the **set** in jsdom and the **geometry** in G-4 Chrome UAT.

### Pitfall 7: Snapshot churn mistaken for regression
**What goes wrong:** `WorkflowCard.seam286.pin` changes (expected) and the pages seam286 snaps show as modified (EOL-only, pre-existing).
**How to avoid:** update only the card pin's `.snap`. Leave the pages snaps unstaged. Verify with `git diff --ignore-cr-at-eol`.

### Pitfall 8: Overflow chip clipped at 375 px
**What goes wrong:** `+N more` sits inside the clipped track.
**How to avoid:** it lives outside the `overflow-hidden` track with `flex-none` (§1.2). Pin the DOM structure (the button is not a descendant of the track). Verify width only in Chrome UAT, because jsdom has no layout.

### Pitfall 9: React Compiler lint now covers the card
**What goes wrong:** impure reads during render get flagged (the ledger notes `Date.now()` already needed a suppression).
**How to avoid:** keep `stepLine.ts` pure. Run `npx eslint src/components/workflows/library src/components/workflows/TeamPicture.tsx src/components/workflows/WorkflowCanvas.tsx` per task.

## Code Examples

### Chip words and order (pure, total)
```typescript
// library/stepLine.ts (shape)
import { own } from "@/components/workflows/ownProperty"
import { PHASE_TYPE_SENTENCES } from "@/components/workflows/phaseVocabulary"
import type { DefShape } from "@/components/workflows/soulData"

export interface StepChip { type: string; words: string }
export interface StepLine { chips: StepChip[]; shown: StepChip[]; more: number }
export const STEP_LINE_VISIBLE = 3

export function resolveStepLine(def: DefShape | null | undefined): StepLine | null {
  const phases = Array.isArray(def?.phases) ? def!.phases! : []
  if (phases.length === 0) return null
  const ordered = [...phases].sort((a, b) => (a?.phase_index ?? 0) - (b?.phase_index ?? 0)) // PhaseSpine idiom
  const chips = ordered.map((p) => {
    const type = typeof p?.config?.phase_type === "string" ? p.config.phase_type : ""
    return { type, words: own(PHASE_TYPE_SENTENCES, type) ?? type }
  })
  return { chips, shown: chips.slice(0, STEP_LINE_VISIBLE), more: Math.max(0, chips.length - STEP_LINE_VISIBLE) }
}
```

### Failure words (F-3), composed in the leaf from vocabulary entries
```typescript
// teamPicture.ts (shape). Strings come from teamVocabulary.ts.
function failureWords(v: { on_failure?: unknown; max_retries?: unknown; timing?: unknown }, engineGate: boolean, slugToNumber: Map<string, number>) {
  const retries = Number.isInteger(v.max_retries) && (v.max_retries as number) >= 0 ? (v.max_retries as number) : 2
  const pre = v.timing === "pre"
  const raw = typeof v.on_failure === "string" ? v.on_failure : "fail_run"
  const target = parseSkipTarget(raw)
  const then =
    engineGate ? FAIL_ASK
    : target !== null ? (slugToNumber.has(target) ? failJump(slugToNumber.get(target)!) : FAIL_JUMP_MISSING)
    : raw === "ask_user" ? FAIL_ASK
    : raw === "fail_run" || raw === "retry" ? FAIL_STOP
    : raw                                   // honest floor for an unknown value
  return pre || retries === 0 ? then : failRedoThen(retries, then)
}
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| The engine citations gate failed the run on exhaustion | It pauses durably and asks the person (outage and golden run still fail) | Phase 295 (develop, 2026-10-21, not yet in production) | The derived check's words must say "ask you" (F-3) |
| The armed approval was a synthesized `action_risk_approval` validator | An explicit pre-body checkpoint keyed on `action_risk_armed` | D-187-01 | Draw the derived armed check from `actionRiskArmed`, not from `validators[]` |
| Card purpose sentence + glyph-dot spine | 179 C card (no purpose, no spine) | 192.2 | The chip line is the only addition; do not resurrect `soul-spine` |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The operator will accept retry-aware failure words (F-3) over the UI-SPEC's shorter ones | Corrections F-3 | Copy rework in one leaf. If rejected, the picture states something the engine does not do |
| A2 | The operator will accept detected-only derived citations checks (F-2), so escalated non-KB steps read "Nothing checks this work" while the canvas seal still says "Must prove it" | F-2 | The two surfaces disagree visibly. The alternative is to repeat the seal's drift in the picture |
| A3 | Replacement words for `citations_required` (F-5) are acceptable to the operator | F-5 | Copy change only |
| A4 | Accepting a React Flow re-fit when returning from Team to Steps is acceptable | Smaller divergences | If not, keeping the plane mounted but hidden needs extra canvas code (budget) |
| A5 | A strict-default `llm_emit` (backend default `citation_policy="strict"`, `models/harness.py:169`) enforcing citations inside the step should NOT count as a "check" for the absence line | Open Q2 | "Nothing checks this work." could read as false on emit workflows |

## Open Questions

1. **Failure words (F-3) and the derived-gate scope (F-2): confirm the copy.**
   - Known: the engine retries every post gate first, and after 295 its citations gate asks.
   - Unclear: the operator's preferred phrasing.
   - Recommendation: lock `If it fails: redo the step (up to N times), then stop the run / ask you / ⤳ jump to step N`, detected-only, before Plan 01 writes the vocabulary.
2. **Does an `llm_emit` step's own citation policy count as "checks this work"?**
   - Known: the emit refuses uncited values when the policy is strict (the backend default). That is not a validator and not an engine-appended gate. The frontend's `already-set` reading only fires on an explicit `"strict"`, while the backend defaults to strict, which is another drift.
   - Recommendation: do not draw it as a gate. Keep `Nothing checks this work.` but have the UAT read it on a real 2-3 step production-shaped emit workflow with the operator present. If it reads as false, add one derived "the file must cite where each value came from"-style Check for `llm_emit`, avoiding the retired strings.
3. **The escalated-seal drift (F-2 side note).** Record it as a reported bug (`surface: Agentic-RAG`) at plan time. Do not fold it into 290.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | vitest, tsc, gates | ✓ | v24.19.0 | — |
| vitest | tests | ✓ | 4.1.0 | — |
| TypeScript | typecheck | ✓ | ~5.9.3 (63 base errors, 0 in scope) | — |
| Local Supabase + backend + Vite dev | G-4 Chrome UAT (operator starts backend) | not probed (operator-started) | — | Fixture-planted drafts via the builder UI |
| Chrome MCP | G-4 | session-dependent | — | Operator drives the browser |
| `gsd-sdk` | commit | ✓ | — | — |

**Missing with no fallback:** none for build/test. **UAT note:** the 7-step stress workflow and the batch/judge/skip fixtures exist in **no** production definition, and the local DB holds 4-6 step drafts at most (sketch 290 data). They must be planted as local drafts for the G-4 drive. That **mutates the local DB**, so that UAT step is serial and runs at verification, not in a parallel plan (worktree rule 4).

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`, so this section is advisory: it is the test map the planner's tasks should satisfy. G-4 UAT rows still belong in VALIDATION.md / the verify-work UAT file.

### Test Framework
| Property | Value |
|---|---|
| Framework | vitest 4.1.0, jsdom, `src/setupTests.ts` (vitest-axe matchers) |
| Config | `frontend/vitest.config.ts` |
| Quick run | `cd frontend && npx vitest run <files> --maxWorkers=2` |
| Full gate | repo root: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |
| Base | the 20 in-scope files are green at `0f575c92c` (1051 passed, run this session) |

### Phase Requirements → Test Map
| ID | Behaviour | Type | Command | Exists? |
|---|---|---|---|---|
| V4-1 | 0 steps / no def / non-array `phases` → no `row-steps` node; card composes byte-identically to today | unit (render) | `npx vitest run src/components/workflows/library/StepChipLine.test.tsx` | ❌ new |
| V4-2 | 1 / 2 / 3 steps → that many chips, exact words from `PHASE_TYPE_SENTENCES`, no `+N more` | unit | same | ❌ |
| V4-3 | 4-7 steps → 3 chips + `+N more` with accessible name `Show N more steps`; press → all N named in visible words + `Show less`, `aria-expanded` flips | unit (userEvent) | same | ❌ |
| V4-4 | Never `phase.name`, never `PHASE_TYPE_LABELS`, never slug or type id (except unknown-type floor); `constructor` type → raw echo, no glyph | unit | `npx vitest run src/components/workflows/library/stepLine.test.ts` | ❌ |
| V4-5 | Child order: `row-steps` is `children[2]` on step cards; pins in `WorkflowCard.test.tsx` moved by decision | unit (edit) | `npx vitest run src/components/workflows/library/WorkflowCard.test.tsx` | ✅ edit |
| V4-6 | Library subtree fences cover the new modules (F1 `title`, raw HTML, page import, F6, F7) | fence | `npx vitest run src/components/workflows/library/librarySubtree.fences.test.ts` | ✅ edit |
| V4-7 | seam286 card pin `.snap` diff equals the inserted block only | snapshot (edit) | `npx vitest run src/components/workflows/library/__tests__/WorkflowCard.seam286.pin.test.tsx -u` then inspect diff | ✅ edit |
| V1-1 | `deriveTeam` on `researchSummarize`/`literatureReview`/`docQaHuman`/`singlePhase` → **0** lines with `kind === "jump"` and 0 lines whose from/to are both steps | unit | `npx vitest run src/components/workflows/teamPicture.test.ts` | ❌ |
| V1-2 | `branching` → exactly 1 jump, `gate-1-0 → step-3`, source `phases[1].validators[0].on_failure = "skip_to_phase:escalate"`; `unresolvableSkip` → 0 jumps + `FAIL_JUMP_MISSING` words | unit | same | ❌ |
| V1-3 | Derived check only when `groundingCauseOf === "detected"`; none for already-set/escalated; armed check from `actionRiskArmed` | unit | same | ❌ |
| V1-4 | Failure words per disposition × timing × `max_retries` (incl. 0, pre, engine gate → ask) | unit | same | ❌ |
| V1-5 | Totality: no `config`, unknown type, unknown kind, non-array validators, `max_parallel_agents` 0/-1/"5"/20 → no throw, honest floors, 8 dots + `up to 20 at once` | unit | same | ❌ |
| V1-6 | Rendered line set equals `lines[]` (`data-line-kind`/`data-line-source`); no `data-line-kind="jump"` and no ⤳ label text on a no-skip workflow | render | `npx vitest run src/components/workflows/TeamPicture.test.tsx` | ❌ |
| V1-7 | 1 step → orchestrator + 1 step + `TEAM_ONE_STEP`, nothing else; 0 steps → empty state, no orchestrator; absence lines said once | render | same | ❌ |
| V1-8 | ⌥ on → technical subtitles, raw kinds, criteria hidden, ledger with every line + `LEDGER_NO_LINKS`; axe: `toHaveNoViolations` | render + a11y | same | ❌ |
| V1-9 | Canvas: switch absent without `team` (run page path) and header outerHTML byte-identical to the pre-change pin; Team replaces the plane; ⌥→ in Team does NOT call `onCommitNodes` (control: Steps does) | render | `npx vitest run src/components/workflows/WorkflowCanvas.team.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` | ❌ new + ✅ existing |
| V1-10 | Vocabulary sweeps: no retired or banned words in `teamVocabulary.ts` | fence | `npx vitest run src/components/workflows/governanceVocabulary.test.ts` | ✅ |
| G-4 | UI-SPEC §6 scenarios 1-5, Chrome MCP screenshot + text read, dark + light, 375 px, real 2-3 step workflow + 7-step planted draft | manual (UAT) | VALIDATION / UAT file | — |

### Sampling Rate
- **Per task:** the targeted files above, plus `npx tsc -p tsconfig.app.json --noEmit` set-diffed against the 63 base errors, plus eslint on touched files.
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root).
- **Phase gate:** count gate OK (or per-file deltas plus in-scope suites green, as CLAUDE.md allows), ledger gate clear, CLAUDE.md size gate clear, then G-4.

### Wave 0 Gaps
- [ ] Canvas header characterization pin (prop absent; editable and read-only), committed before any `WorkflowCanvas.tsx` edit.
- [ ] `__fixtures__/teamFixtures.ts`: 7-step stress (all 7 types, 1 judge with `criteria`, 2 checks, 1 skip), batch-20, malformed, grounded 3-step (`search_documents` in `available_tools`), armed `external_action`. **Needs a ledger row.**
- [ ] Count-gate pins for the new suites and raised pins for the edited ones (`WorkflowCard.test.tsx` 128, `librarySubtree.fences.test.ts` 133, `WorkflowCard.seam286.pin.test.tsx` 21, `WorkflowCanvas.test.tsx` 105), adopted in the closing plan.

## Security Domain

`security_enforcement: true`. ASVS L1. Read-only client view with no new request, so the threat surface is untrusted definition content rendered into the DOM.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | unchanged |
| V3 Session Management | no | unchanged |
| V4 Access Control | yes (no change) | The picture reads only the definition the viewer already holds (D-07). No new endpoint, so existing RLS / owner predicates stand. Verify that **no** `@/lib/api` import exists in `teamPicture.ts`, `teamVocabulary.ts`, `stepLine.ts` (source fence) |
| V5 Input Validation / Output Encoding | **yes** | React JSX text and attribute escaping only; no `dangerouslySetInnerHTML`; `typeof`/`Array.isArray`/`Number.isInteger` guards; `own()` for every keyed read |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---|---|---|
| Stored XSS via author-supplied `name`, `slug`, `criteria`, unknown `kind`/`on_failure`, rendered in nodes, ledger and `data-line-source` | Tampering / Elevation | JSX text and attribute values only. Negative source fence for `dangerouslySetInnerHTML` / `innerHTML` over the new modules. A planted `<img onerror>` name test asserts it renders as literal text |
| Prototype-key lookup (`phase_type: "constructor"`, `kind: "__proto__"`) rendering a function or nothing | Tampering / DoS | `own()` everywhere. A test plants `constructor` and asserts the raw-string floor |
| Render blow-up from author numbers (`max_parallel_agents: 1e9`) or very long names | DoS | Seat dots `min(N, 8)`. Words state N. CSS clamps (2-line / 3-line) and horizontal scroll, never unbounded loops over N |
| Unbounded step counts | DoS (low) | Same as the shipped canvas: O(steps + validators) render. No nested N² work (resolve slug → number via one `Map`) |
| Information disclosure via the ⌥ ledger (slugs, kinds, criteria of someone else's published workflow) | Info disclosure | Low: the viewer can already open that definition read-only in the builder (D-07). No new field leaves the client |
| A read-only view mutating state (keyboard reorder) | Tampering (integrity) | F-6 effect gate + test |

## Recommended Plan Split (G-8: 4 plans, 3 waves)

| Plan | Wave | Scope | `files_modified` |
|---|---|---|---|
| **290-01** Team derivation + vocabulary (TDD) | 1 | RED first: `teamPicture.test.ts` over existing `canvasFixtures` + new `teamFixtures`. Then `deriveTeam` (F-2, F-3, F-4, totality) and `teamVocabulary.ts` (F-5 words). Also commits the **canvas header characterization pin** (test-only, so it does not touch `WorkflowCanvas.tsx` source and is safe to parallelize) | `frontend/src/components/workflows/teamPicture.ts` (new), `…/teamVocabulary.ts` (new), `…/__fixtures__/teamFixtures.ts` (new), `…/teamPicture.test.ts` (new), `…/teamVocabulary.test.ts` (new), `…/WorkflowCanvas.headerPin.test.tsx` (new) |
| **290-02** The card chip line (VIS-04) | 1 | RED first: `stepLine.test.ts`, `StepChipLine.test.tsx`. Pure resolver + component (no `title=`, F-1). Five vocab entries. ONE block in the card. Subtree list 15 → 17 + length pin. Child-order pin moves. Card seam286 `.snap` update (recorded) | `library/stepLine.ts` (new), `library/StepChipLine.tsx` (new), `library/libraryVocabulary.ts`, `library/WorkflowCard.tsx`, `library/librarySubtree.fences.test.ts`, `library/WorkflowCard.test.tsx`, `library/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap`, `library/stepLine.test.ts` (new), `library/StepChipLine.test.tsx` (new) |
| **290-03** Team picture render + canvas switch (VIS-01) | 2 (after 01) | `TeamPicture.tsx` (figure/ol/ul, SVG line layer with data attributes, ⌥ ledger, absence lines, axe). `WorkflowCanvas.tsx`: one optional `team` prop, tablist only when present, one early return before the empty-draft return, keyboard-effect gate (F-6). `WorkflowBuilderPage.tsx`: one prop at the existing call (inline name, avoiding the `identityLabel` TDZ). The header pin from 01 stays numstat-empty | `…/TeamPicture.tsx` (new), `…/TeamPicture.test.tsx` (new), `…/WorkflowCanvas.tsx`, `…/WorkflowCanvas.team.test.tsx` (new), `frontend/src/pages/WorkflowBuilderPage.tsx` |
| **290-04** Close-out: ledger, count gate, docs | 3 | Scan-list rows + sections for all 7 new source/fixture files; CLAUDE.md FIRING-table cells (≤ 80 chars) for `WorkflowCard.tsx`, `WorkflowCanvas.tsx`, `WorkflowBuilderPage.tsx`, `libraryVocabulary.ts` with re-derived triples; count-gate BASELINE pins (new suites + raised edits); full gates (count, ledger, CLAUDE.md size, tsc set diff); seeds SEED-155 / SEED-086 `partial` routing; file the escalated-seal BUG report | `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`, `scripts/vitest-count-gate.cjs`, `.planning/seeds/SEED-155-…md`, `.planning/seeds/SEED-086-…md`, `.planning/reported-bugs/BUG-…md` (new) |

Why 4 and not 3: the 286 precedent (286-05) shows that putting ledger and count-gate edits in every parallel plan causes merge conflicts in `docs/HOT-FILE-LEDGER.md` and `scripts/vitest-count-gate.cjs` across worktrees. A closing plan owns them once. Plans 01 and 02 share no file and neither mutates the local DB, so they are safe in parallel (≤ 2 test-running agents). The G-4 UAT, which plants local drafts and so mutates the DB, runs at `/gsd:verify-work`, serially.

⚠ **The ledger gate will report `[no-row]` for the new files until 290-04 lands.** That is expected mid-phase. If the planner prefers the gate clear at every wave, each creating plan can add its own rows, at the cost of the merge-conflict risk above. If so, rows must be inserted at distinct, alphabetically sorted positions.

## Sources

### Primary (HIGH, read in this session)
- `frontend/src/components/workflows/library/WorkflowCard.tsx` (`:257-300` imports, `:946-1000` identity parts, `:1040-1270` rows)
- `frontend/src/components/workflows/library/{libraryRow.ts:80, libraryFilter.ts:58, librarySubtree.fences.test.ts:82-311, WorkflowCard.test.tsx, WorkflowCard.baseline.test.tsx, __tests__/WorkflowCard.seam286.pin.test.tsx}`
- `frontend/src/components/workflows/{phaseVocabulary.ts, soulData.ts:57-97, ownProperty.ts:82, definitionOps.ts:489-575, canvasModel.ts:600, PhaseSpine.tsx:37-41, WorkflowCanvas.tsx:533-700,1143-1200,1243-1277,1387-1520, governanceVocabulary.test.ts:60-182, WorkflowCanvas.test.tsx:85-112,940-1000,1395-1500, __fixtures__/canvasFixtures.ts}`
- `frontend/src/lib/phaseGlyph.tsx:96-121`; `frontend/src/pages/WorkflowBuilderPage.tsx:436-445,666,850,2041-2140,2527`; `frontend/src/pages/WorkflowRunPage.tsx:1470-1478`
- `backend/app/models/harness.py:110-170,484-642`; `backend/app/services/harness/grounding.py:1092-1435`; `backend/app/services/harness/engine_ask.py:100-200,340-400,725-760,935-965`; `backend/app/services/harness_engine.py:636-724,1110-1190,1985-2030`; `backend/app/services/harness/validator_kinds.py:621-652`; `backend/app/api/workflows.py:178-300,386,475,549,1232`
- `docs/HOT-FILE-LEDGER.md` (sections at `:421-560`, `:3730-3775`, `:5973-6020`, `:6750`, `:22474-22720`); `scripts/check-hot-file-ledger.cjs`; `scripts/vitest-count-gate.cjs` (BASELINE pins)
- `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md` §4; `.planning/sketches/290-card-chip-line/README.md`; `.planning/sketches/290-team-picture/index.html:161-248`
- Commands run: hot-file triples (recipe), `check-hot-file-ledger.cjs --files …`, `tsc -p tsconfig.app.json` (63), vitest over 20 in-scope files (1051 passed), `git diff`/CR counts on the two snapshot files

### Secondary / Tertiary
- None. No web sources were needed: this phase is in-repo projection work with no new library.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new dependencies; every helper read at file:line)
- Architecture: HIGH (mount points, props and budgets read directly; the run page and builder call sites confirmed)
- Pitfalls: HIGH for the fence conflicts F-1/F-5/F-6 (fence source read). MEDIUM for the copy corrections F-2/F-3, where the engine behaviour is verified but the wording is an operator decision

**Research date:** 2026-10-21
**Valid until:** 2026-11-04 (fast-moving: Phase 295 is unpushed and touches the gate semantics F-3 depends on; re-check `engine_ask.py` if 295 changes before 290 executes)
