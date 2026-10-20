---
phase: 294-decision-engine-rerank-and-citation-check
plan: 04
subsystem: settings
tags: [settings, rerank, ui, egress, sketch-294-B, security]

requires:
  - phase: 294-01
    provides: "rerank_engines/registry.py (EngineId Literal, ACCEPTED_PROVIDER_IDS, ENGINES default models and capability flags)"
provides:
  - "PUT /settings refuses a rerank_provider outside ACCEPTED_PROVIDER_IDS (400, nothing saved)"
  - "frontend/src/components/settings/rerankEngines.ts: RERANK_ENGINES, engineFor(), RerankEngineFacts, RerankEngineId, RerankKeySource"
  - "frontend/src/components/settings/RerankEngineBlock.tsx: the sketch 294 B card body"
  - "SettingsPage Reranking card = Enabled switch + ONE RerankEngineBlock mount"
affects: [294-05 chat-side citation-check reason line, 294-05 live drive / G-4 rows]

tech-stack:
  added: []
  patterns:
    - "?raw parity fence over a backend registry: ids, default models AND capability flags read from registry.py source"
    - "roving-tabindex radio cards without local state (focus moved through the DOM in onKeyDown)"

key-files:
  created:
    - backend/tests/unit/test_294_settings_engine_allowlist.py
    - frontend/src/components/settings/rerankEngines.ts
    - frontend/src/components/settings/RerankEngineBlock.tsx
    - frontend/src/components/settings/__tests__/rerankEngines.parity.test.ts
    - frontend/src/components/settings/__tests__/RerankEngineBlock.test.tsx
  modified:
    - backend/app/api/settings.py
    - frontend/src/pages/SettingsPage.tsx
    - docs/HOT-FILE-LEDGER.md

key-decisions:
  - "294-04: 'Keep at most N passages per search' binds to retrieval_top_k (OQ1); the old Top-N becomes 'Score the best M candidates first' bound to rerank_top_n (the pool)"
  - "294-04: key status booleans come from the hydrated s.providers[*].has_key (OpenRouter, OpenAI) and rerankApiKey !== '' (Cohere); no key value is read or sent"
  - "294-04: a Model text field is kept below the numbers (not in sketch B) so a custom model stays settable; the card shows the stored model on the selected card, else the engine default"
  - "294-04: the legacy 'api' id selects the Cohere card on render and is only rewritten when the operator clicks a card"

requirements-completed: []  # DEC-01's share only; REQUIREMENTS.md stays Pending until plan 05 (orchestrator owns it)

duration: 45min
completed: 2026-10-20
---

# Phase 294 Plan 04: Settings rerank engine picker Summary

**The Reranking card now shows four engine cards (On this server, Jev via OpenRouter, OpenAI Decisions, Cohere) from one fact table pinned to the backend registry. Each card says which saved key it uses, where the text goes, what the engine costs and what it can do. PUT /settings refuses any engine id the server does not know.**

## Worktree base

The worktree started on `be7f4177a` (master), not the plan base. It was reset with `git reset --hard cbec70d41` before any work, as instructed. That also dropped a worktree-local modification to `.claude/settings.local.json`, which had nothing to do with this plan. `git log --oneline -1` confirmed `cbec70d41` before Task 1.

## Accomplishments

- **Task 1 (T-294-21 / T-294-22):** `update_settings` wraps the existing `rerank_provider` write in a closed-set refusal (+11 lines, the same shape as the `hnsw_iterative_scan` arm). It imports `ACCEPTED_PROVIDER_IDS` from `app.services.rerank_engines.registry`. An unknown id gets a 400 that lists the four engines in plain language, and `save_app_settings` is never called. The legacy `api` id is still accepted. A GET test plants OpenRouter, OpenAI and Cohere key values and shows that none of them, and no fragment of them, appears in the response body.
- **Task 2 (D-01 / D-02 / D-05 / D-20a):** `rerankEngines.ts` is the only place engine facts live. `RerankEngineBlock.tsx` renders sketch 294 B:
  - a 2x2 `radiogroup` of `role="radio"` cards that arrow keys can reach;
  - under the cards, the keep-at-most and pool numbers;
  - the red missing-key line;
  - the amber egress notice, which adds the cited-sentences clause only for Jev and OpenAI Decisions;
  - a note when hybrid search is off;
  - a line saying the choice applies to every knowledge-base search, including workflow steps;
  - an organisation-wide scope line ("Saved for the whole organisation" after a save).

  When the switch is off, the cards are hidden and one line says no engine is called. The block has no fetch, no `useState` and no `useEffect`.
- **Task 3 (D-23):** SettingsPage replaces the Reranking body with one `<RerankEngineBlock>` mount (+26 / -27 lines). It adds no state, and hydrate and the save payload are unchanged. `ProviderPicker.tsx`, `config.py` and `user_settings.py` are not in the diff.

## Task Commits

1. Task 1 RED: `540b18bcb` test(294-04): add failing tests for the rerank engine allowlist
2. Task 1 GREEN: `699da687f` feat(294-04): refuse an unknown rerank engine id on PUT /settings (also updates the ledger row and section for settings.py)
3. Task 2 RED: `7e05985d3` test(294-04): add failing tests for the engine fact table and RerankEngineBlock
4. Task 2 GREEN: `e19a53ccb` feat(294-04): engine fact table and RerankEngineBlock (sketch 294 B)
5. Task 3: `c197f6c48` feat(294-04): Reranking card mounts RerankEngineBlock (also updates the ledger row and section for SettingsPage.tsx)

## TDD Gate Compliance

- **Task 1:** RED commit `540b18bcb` (5 refusal cases failed). GREEN commit `699da687f`.
  - The GET no-key case passed at RED. That is expected: it pins existing behaviour (SC#6), and `has_key` was already a boolean.
- **Task 2:** RED commit `7e05985d3`. Both suites failed to resolve their imports because neither module existed. The table had been drafted before the tests, so it was moved out of the tree for the RED run and the RED commit.
  - The parity fence was then shown to fire: renaming one id in the table turned 3 of 7 cases red. The file was restored afterwards.

## Verification

- **Backend:**
  - `pytest tests/unit/test_294_settings_engine_allowlist.py tests/unit/test_settings.py tests/unit/test_241_cr01_settings_write_without_migration.py`: 43 passed.
  - Wider check, every `*settings*` suite plus every `test_294_*` suite: 395 passed.
- **Frontend (`GSD_VITEST_MAX_WORKERS=2`, `--maxWorkers=2`):**
  - `RerankEngineBlock.test.tsx` and `rerankEngines.parity.test.ts`: 31 passed, including the NON-VACUITY case.
  - The same two files plus `SettingsPage.test.tsx`, `SettingsPage.a11y`, `SettingsPage.changedFields`, `SettingsPage.member283` and `SettingsPage.sourceCeiling`: 7 files, 111 passed.
  - The `changedFields` suite file was not modified, and its fixture keeps `rerank_provider: "api"`.
- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` gives 63 errors before and after the SettingsPage edit. The set diff, with line and column numbers stripped so the shift in SettingsPage does not count as a change, is empty: no new errors and none fixed.
  - The "before" run was at `e19a53ccb`. Every pre-existing file there is byte-identical to `cbec70d41`, and the two new modules had zero errors, so that error set equals the base set.
  - The three SettingsPage errors are already in the base set (`SettingsPage.test.tsx:88`, `SettingsPage.tsx` `web_search_enabled` and `FieldRow tooltip`).
- **Acceptance greps:**
  - In `RerankEngineBlock.tsx`: `useState|useEffect` 0; `0.042|gpt-6-luna|typesafe/jev` 0; `Text leaves your server.` 1; `Until you add it, search keeps today's order.` 1; `from "@/pages` 0.
  - In `settings.py`: the registry import appears once, with 11 added lines (the limit is 15).
  - In `SettingsPage.tsx`: `<RerankEngineBlock` appears once, and there are 0 added `useState(` calls.
- **Gates:**
  - `node scripts/check-hot-file-ledger.cjs .planning/phases/294-...`: OK.
  - `node scripts/check-claude-md-size.cjs`: OK.
  - `node scripts/check-landing-drift.cjs`: zero drift.
- The full vitest count gate and the full backend baseline were not run here. The orchestrator runs them once after the wave merges.

## Deviations from Plan

### Auto-fixed / added

**1. [Rule 2 - kept existing capability] Model text field kept in the block**
- **Found during:** Task 2.
- **Issue:** Sketch B has no Model row. Removing it would silently take away the operator's only way to set a non-default model, for example another local cross-encoder. Plan 01 reloads the local model when `rerank_model` changes, so that setting is live.
- **Fix:** a compact "Model" input (`aria-label="Model"`) below the two numbers, with its default shown as a placeholder. Its hint says what the backend's `resolve_model` actually does: "Empty, or a model this engine does not offer, uses the default shown on its card." The selected card shows the stored model when one is set; otherwise every card shows its default.
- **Files:** `RerankEngineBlock.tsx` and its test.
- **Commit:** `e19a53ccb`.

**2. [Copy] Key status wording**
- The OK state reads "✓ uses your saved <key>" on every hosted card, per the D-02 / D-20a wording. Sketch B's shorter "✓ <key>" was not used. The missing state reads "✕ <key> missing", as in the sketch.

**3. [Copy] One extra hint line under "Keep at most"**
- It says "The same number as Top-K chunks under Retrieval.", because the two controls are bound to the same state (OQ1). Without the hint, the Retrieval card's Top-K would change on its own and look like a bug.

None of these needed an architectural decision.

## Ledger and CLAUDE.md

- **`docs/HOT-FILE-LEDGER.md`:** the scan-list rows for `backend/app/api/settings.py` (now `44 / 23 / 1159`) and `frontend/src/pages/SettingsPage.tsx` (now `57 / 28 / 1662`) were updated in the same commit as each file's edit. Both disposition cells are under 200 characters. Each file also gained a dated "Phase 294 (294-04)" section, and the replaced cell text is kept verbatim in it.
- **CLAUDE.md FIRING table:** not edited. Agent instructions cannot authorise CLAUDE.md edits, so this was left alone. The cells are stale:

  | Row | CLAUDE.md now reads | Correct value | Last touch |
  |---|---|---|---|
  | `backend/app/api/settings.py` | `41 / 21 / 1048` | `44 / 23 / 1159` | 294-04 (one refusal arm) |
  | `frontend/src/pages/SettingsPage.tsx` | `53 / 27 / 1658` | `57 / 28 / 1662` | 294-04 (one mount) |

  The orchestrator or plan 05 should update them.
- **New files:** the `rerankEngines.ts` and `RerankEngineBlock.tsx` rows still read `0 / 0 / 0` (young, added at planning). As each row's own section says, plan 05 re-derives them on the merged tree.

## Known Stubs

None. Every card fact comes from the table, and every number and key status comes from live page state.

## Notes for plan 05

- **Imports for the chat-side reason line:** `import { engineFor, type RerankEngineFacts } from "@/components/settings/rerankEngines"`.
  - `engineFor(provider)` handles `"api"` and unknown ids (both resolve to Cohere).
  - Fields: `.shortName` (Local / Jev / OpenAI Decisions / Cohere), `.citationCheck`, `.keyName` ("OpenRouter key" / "OpenAI key" / "Cohere rerank key" / null).
- **Settings → Search state for VALIDATION precondition 6:** "Score the best [20] candidates first" is `rerank_top_n`, and "Keep at most [5] passages per search" is `retrieval_top_k`.
  - Setting Keep at most also changes Retrieval → Top-K chunks, because both are one setting.
- **Selectors for the live drive:**
  - The cards are `role="radio"` inside `role="radiogroup"` with aria-label "Reranking engine". Each card has `data-engine=<id>`.
  - The egress notice carries `data-egress`.
  - The missing-key line is `role="status"`.
- **G4-1 check (Jev with no OpenRouter key):** the Jev card shows "✕ OpenRouter key missing", and the red line reads "This engine can't run without your OpenRouter key. Until you add it, search keeps today's order."
- **Landing page copy is now stale:** `frontend/src/landing/components/TourSection.tsx:323` ("reranking on/off with API (Cohere) or local (sentence-transformers)") and `landing/scenes/SettingsScene.tsx:82-83` still describe the old two-option select. `check-landing-drift.cjs` passes because those strings are not in `facts.ts`. This was out of scope here, so the files were not changed. Fold it into plan 05 or a quick task.
- **New vitest suites for the count gate to adopt or pin:** `RerankEngineBlock.test.tsx` (24 cases) and `rerankEngines.parity.test.ts` (7 cases). The SettingsPage suites' case counts did not change.
- **Not run:** `graphify update .`. Leave it to the merged tree.

## Threat Flags

None. No new surface beyond the plan's threat register (T-294-21..24 were mitigated or accepted as planned).

## Self-Check: PASSED

- All 5 created files and 3 modified files are present on disk.
- Commits `540b18bcb`, `699da687f`, `7e05985d3`, `e19a53ccb` and `c197f6c48` are all in `git log cbec70d41..HEAD`.
