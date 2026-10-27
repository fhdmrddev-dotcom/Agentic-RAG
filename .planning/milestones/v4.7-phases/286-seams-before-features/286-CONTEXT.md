# Phase 286: Seams Before Features - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Split the four workflow files that phases 287-293 will edit along the seams their ledger sections name, so later phases add to small files. **Behaviour is unchanged**: no route path, response shape, rendered DOM or import-time side effect moves. Requirement: REG-07. No new capability, no schema change, no migration.

Seeds sweep (`check-seeds-register.cjs --phase 286`): 0 matched. It declares no surfaces until plans exist, so re-run it after planning.

</domain>

<decisions>
## Implementation Decisions

### G-5 measurement (SC#1) - re-derived 2026-10-18, not copied from a row
Recipe: `git log --oneline -- f | wc -l`, the sed phase-bucket recipe with 6-digit quick tasks removed, `wc -l`. All of these fire G-5 (>= 3 phases). The roadmap's line counts had drifted.

| File | commits / phases / lines | Later phase that edits it | Disposition |
|---|---|---|---|
| `backend/app/api/workflows.py` | 44 / 22 / 2273 | 287, 291 | **EXTRACT** (owed since 214) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 57 / 22 / 2993 | 288 | **EXTRACT** |
| `frontend/src/pages/WorkflowRunPage.tsx` | 29 / 10 / 1679 | 288, 289 | **EXTRACT** |
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | 21 / 7 / 1661 | 290 | **EXTRACT** (seam named 3x, overdue) |
| `backend/app/services/harness_engine.py` | 61 / 24 / 3387 | 289 | honoured by construction (reason below) |
| `backend/app/services/harness/phase_types.py` | 56 / 28 / 3027 | 289 | honoured by construction |
| `backend/app/services/harness/publish_service.py` | 29 / 13 / 1942 | 288 | honoured by construction |
| `backend/app/api/workflow_runs.py` | 13 / 10 / 1108 | 289 | honoured by construction |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | 20 / 10 / 1372 | 288 | honoured by construction |
| `frontend/src/components/workflows/builderStore.ts` | 14 / 8 / 968 | 288 | honoured by construction |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | 31 / 9 / 1708 | 290 | honoured by construction |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | 8 / 6 / 723 | 290 | honoured by construction |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | 18 / 9 / 490 | 290 | honoured by construction |
| `frontend/src/components/workflows/library/libraryVocabulary.ts` | 11 / 5 / 766 | 290 | honoured by construction |
| `backend/app/services/workflow_authoring.py` | 17 / 11 / 1025 | 291 | honoured by construction |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | 8 / 4 / 684 | 291 | honoured by construction |
| `frontend/src/components/layout/ChatLayout.tsx` | 61 / 31 / 1137 | 287 | honoured by construction (`ChatLaunchForm` + `doRun` exist, reuse) |
| `frontend/src/pages/WorkflowsPage.tsx` | 45 / 18 / 1447 | 287 | honoured by construction |
| `frontend/src/components/workflows/RunReceipt.tsx` | 3 / 1 / 241 | 289 | does not fire |

"Honoured by construction" rows each get a written sentence in the ledger naming the expected change (one field, one prop, one gated node). The plan author states it per file; a row with no sentence fails SC#1.

**Ledger gap found:** `frontend/src/components/layout/ChatLaunchForm.tsx` has no row, so G-5 cannot fire on it (287 reuses it). Add a row and a `docs/HOT-FILE-LEDGER.md` section in the same commit (same-commit sync rule). Also a `ChatLaunchForm` path correction: it lives under `components/layout/`, not `components/chat/`.

### Which files get cut (Area 1)
- **D-01:** Extract exactly the 4 roadmap candidates. Every other firing file carries a written "honoured by construction" reason. `publish_service.py` is **not** cut here, even though 288 teaches the gauntlet about human pauses; revisit only if 288's plan shows a second concern.
- **D-02:** The 4 extractions are 4 plans, one per file, in parallel worktrees, with a ledger/gates wave last. Max 2 test-running agents (`GSD_VITEST_MAX_WORKERS=2`). Dispatch worktree agents one message at a time. Never `rm -rf` a worktree; use `scripts/teardown-worktree.sh`.

### `backend/app/api/workflows.py` split shape (Area 2)
- **D-03:** Do **not** move patched handlers. 25 files patch `app.api.workflows.<name>` (44 sites: `get_pg_pool` x25, `create_workflow_definition` x7, `update_workflow_definition` x4, `assert_phase_models_registered` x3, `get_definition` x2, `write_operator_audit`, `get_redis`, `delete_workflow_definition`). A moved handler would stop seeing those patches, and fixing them means editing tests in the same commit as the move. Draft CRUD, `publish_workflow`, delete and cascade handlers stay in `workflows.py` with their imports.
- **D-04:** Move out to sibling modules, all mounted on the **same** `/workflows` router so paths are unchanged: the Pydantic models (`PublishedWorkflow`, `DraftRow`, `Verdict`, `ValidateResponse`, palette models, `PublishRequest`, `BlockedStep`, `PublishVerdict`, `DeletePreview`, `GenerateRequest`, template models), pure helpers (`_severity`, `_coerce_definition`, `_iso_or_none`, `_caller_uuid`), the validate/palette builders, and the **unpatched clusters**: template door (`read_template_placeholders`, `upload_workflow_template`, `get_workflow_template_placeholders`, ~330 L) and `generate_workflow` (~100 L). The planner verifies each moved handler is unpatched by grepping tests before moving it.
- **D-05:** Target: file lands near 1,200-1,400 lines. Expect to re-export moved model names from `workflows.py` so any `from app.api.workflows import X` still resolves.
- **D-06:** The template-door invariants travel with it unchanged: injects no Supabase client and no pool (cross-tenant class unreachable by construction), the `..` fence, the zip-bomb cap, corrupt file = 422 never "no placeholders".
- **D-07:** Route proof is `app.openapi()` captured on the unmoved base and diffed byte-for-byte after (paths, methods, response_model, dependencies, operation ids).

### Frontend seams (Area 3)
- **D-08 (Card):** Extract the `...` overflow menu together with its armed-delete state machine into `WorkflowCardMenu.tsx`. It is the only local state on the card. Keep the `DropdownMenuItem` structure the WR-03 five-role sweep over `role="menu"` depends on; keep `onSchedule` handing up the row `id` (not slug) and `onRunLog` the slug. `WorkflowCard.baseline.test.tsx` (29 cases) must stay green with an empty numstat.
- **D-09 (RunPage):** Extract the run read + its poll into a hook (`useWorkflowRun` or similar). The poll is currently sited after `isTerminal` is derived (CR-01) and the terminal-edge refetch (`:1146`) depends on that ordering; the hook must return what the page derives from, and the page must keep deriving `isTerminal` from the value the poll wrote. Elapsed anchor (`:1077`) stays unless trivially movable. Four identifiers must never appear as tokens in this file including comments (see ledger section, invariant 8); `StopControl.baseline.test.tsx` imports it `?raw`.
- **D-10 (Builder):** Its named seam (save/concurrency) was already taken in 186-07 (`useDraftPersistence`). Cut two things instead: (a) the id-to-name lookup cluster (`folderNames`, `skillNames`, `connectionNames`, `mcpServerUrls`, `toolReadOnly` and their effects) into one hook; (b) the exported copy constants (`EMPTY_DRAFT_INVITATION`, `SAVING_PUBLISH_WAIT`, `UNBOUND_KB_INVITATION`, `REQUIREMENT_*`, `UNSAVED_LEAVE_PROMPT` and friends) into a leaf module, **re-exported from the page** so every test import and `?raw` fence still resolves. `FLAG_OFF_HEADER_MARKUP` and the byte-exact band literals must not move. 288's draft-persistence work then lands beside `useDraftPersistence` in a smaller page.
- **D-11:** Known `?raw` importers of these files: `StopControl.baseline.test.tsx`, `MessageItem.inlineApproval.test.tsx`, `runLogTone.mirror.test.ts`, `runStepCount.test.ts`. The planner enumerates the full list before moving any text, and treats "a fence reds after the move" as a finding to explain, not a test to edit.

### Proof of "behaviour unchanged" (Area 4)
- **D-12:** Pins first. Each plan's first commit adds characterization pins on the UNMOVED tree: OpenAPI snapshot (backend), AST-identity check of every moved function against the phase base (`ast.dump` equality, with a non-vacuity check), DOM captures (Card in all states incl. menu open and armed-delete; RunPage; Builder header markup), and the list of `?raw` importers. The move commits must show an empty `git diff --numstat` on those pins.
- **D-13:** Any test edited in a move commit needs a written reason in that plan's SUMMARY. Default is "unedited".
- **D-14:** Gates (SC#3): closed core counts 7 / 1 / 30 before and after; `pytest tests/unit -q --continue-on-collection-errors` stays <= 71 failed with 0 collection errors; `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` shows no per-file decrease; `npx tsc -p tsconfig.app.json --noEmit` set diff against base is empty (bare `tsc --noEmit` checks zero files). Re-derive baselines at the phase base, do not quote.
- **D-15:** Ledger (SC#4): update each row in `CLAUDE.md` and its `docs/HOT-FILE-LEDGER.md` section in the same commit; add the `ChatLaunchForm.tsx` row; run `node scripts/check-claude-md-size.cjs` and `node scripts/check-hot-file-ledger.cjs 286`.
- **D-16:** Plans per G-8: 4 extraction plans + gates/ledger as the last wave (fold into plan 4 or a short 5th; planner justifies if above 5). Targeted suites per task, FULL gates once per wave. Verifier and TDD RED drives are not cut.

### Claude's Discretion
- Names of the new modules and hooks, and exact file boundaries inside the agreed seams.
- Which unpatched `workflows.py` helpers travel with which sibling module.
- Whether the Run page's elapsed anchor moves with the poll hook.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` -> "Phase 286: Seams Before Features" (goal, SC#1-4, "How we'd know this failed", flags)
- `.planning/REQUIREMENTS.md` -> REG-07

### Hot-file ledger (read the section for every file you touch)
- `docs/HOT-FILE-LEDGER.md` -> `backend/app/api/workflows.py` (line ~1006: five-way seam, three-library-feed `response_model` hazard, template-door fences)
- `docs/HOT-FILE-LEDGER.md` -> `frontend/src/pages/WorkflowBuilderPage.tsx` (line ~838: honoured x7, `FLAG_OFF_HEADER_MARKUP`, `useDraftPersistence`)
- `docs/HOT-FILE-LEDGER.md` -> `frontend/src/pages/WorkflowRunPage.tsx` (line ~2130: four remaining concerns, invariants 1-8)
- `docs/HOT-FILE-LEDGER.md` -> `frontend/src/components/workflows/library/WorkflowCard.tsx` (line ~768: cardFace precedent, characterization-pin-first ordering, overflow-menu seam)
- `CLAUDE.md` -> "Workflow guardrails" G-5, G-8; "Hot-file ledger"
- `scripts/check-hot-file-ledger.cjs`, `scripts/check-claude-md-size.cjs`, `scripts/vitest-count-gate.cjs`, `scripts/bootstrap-worktree.sh`, `scripts/teardown-worktree.sh`
- `docs/VITEST-COUNT-GATE.md`, `docs/PLANNING-PROPORTION.md`

### Precedents to copy
- 192.2-02 `cardFace.ts` extraction: pin committed one commit BEFORE the seam existed, `numstat` empty after.
- 193.1-05 `useTemplateFirstDraft.ts`: extraction shipped in an earlier wave than the feature it made room for.
- 278-03 `tool_dispatcher.py` split: gates covered `tests/unit` only while CI runs all of `tests/`. Run `backend/tests/` wholesale for the patched modules.

### Later phases that will land in these files
- `.planning/ROADMAP.md` -> Phases 287-293 (flags list the hot files each edits)
- `.planning/seeds/SEED-295-named-outcomes-and-forward-only-edges.md`, `SEED-086-visual-multi-agent-representation.md` (deferred, see below)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/hooks/useDraftPersistence.ts`: the Builder's save/concurrency seam, already taken (186-07); the model for how a hook composes into the page.
- `frontend/src/components/workflows/library/cardFace.ts`, `runFacts.ts`, `libraryVocabulary.ts`: the Card's decision logic is already out; only drawing + the menu remain.
- `frontend/src/components/workflows/useTemplateFirstDraft.ts`, `BuilderSaveRegion.tsx`, `DeclaredInputsEditor.tsx`: prior extractions from the Builder.
- `frontend/src/components/files/FileRow.tsx`: the RunPage deliverable list was already delegated here (195).

### Established Patterns
- Characterization pin first, extraction second, pin numstat empty (192.2-02, 193.1-05).
- Moved copy is re-exported from the original module so test imports and `?raw` fences resolve.
- Backend tests patch by module path (`app.api.workflows.get_pg_pool`): handlers that tests patch stay where the patched names are imported.

### Integration Points
- `backend/app/main.py:878` imports `app.api.workflows` and mounts its `router` (prefix `/workflows`); new sibling modules must not add a second prefix or a second `include_router` that changes ordering (route ordering decides `/published` vs `/{id}`).
- `GET /workflows/published` and `/starters` are `response_model`-declared: undeclared keys drop silently, so model moves must keep field sets identical (closed field-set fence `test_published_workflow_field_set_excludes_created_by`).

</code_context>

<specifics>
## Specific Ideas

- Operator confirmed: the four named files, parallel worktrees, pins first, patched handlers stay put.
- Route ordering matters in FastAPI: keep the declaration order of routes on the shared router identical (the OpenAPI diff will catch a reorder only if the schema reflects it, so also snapshot `router.routes` order).

</specifics>

<deferred>
## Deferred Ideas

- **Non-linear / parallel workflows** (operator remembered this discussion). Not this phase: behaviour-unchanged refactor. Recorded home is `SEED-295` (named outcomes + forward-only edges; `planted`, gated on a real authored-and-blocked branching workflow plus the operator's decision on what "published" certifies, Gate D2) and `SEED-086` (visual team picture, delivered as VIS-01 in Phase 290, which must not imply a DAG). Parallel fan-out already exists as `llm_batch_agents`. Seam design here must not bake in "phases are one linear list" beyond what the code already does. Seed files left byte-unchanged (status stays `planted`; trigger unchanged).
- Extracting `publish_service.py`, `harness_engine.py`, `phase_types.py`, `PublishGauntlet.tsx`, `WorkflowCanvas.tsx`: owed, not taken; revisit if 288/289 plans show a genuinely second concern.
- Full sub-router split of `workflows.py` (handlers moved, ~44 test patch sites rewritten): rejected for now; re-open if `workflows.py` is still > 1,500 lines after this phase and a later phase must edit it.

### Reviewed Todos (not folded)
None matched.

</deferred>

---

*Phase: 286-seams-before-features*
*Context gathered: 2026-10-18*
