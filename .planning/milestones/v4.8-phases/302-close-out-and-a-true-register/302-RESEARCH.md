# Phase 302: Close-Out and a True Register - Research

**Researched:** 2026-10-30
**Domain:** Panel read-side fix (React), six small review findings (FastAPI/harness + React a11y), register bookkeeping
**Confidence:** HIGH. Every premise below was checked against code or the local DB. The one exception is the Moonshot recursion behaviour: the provider documents nothing, so that rests on the live 400 already recorded in 296.

## Summary

**FIX-01: the hypothesis holds, and the fix needs no backend change.** Sandbox outputs go to the `sandbox-outputs` bucket plus a `sandbox_files` row (`backend/app/services/sandbox_service.py:296-310`). That row has no `thread_id`, and nothing ever writes `workspace_files`. The panel reads only `workspace_files` (`GET /workspace/files`, `backend/app/api/workspace.py:499-562`, via `useWorkspaceFiles` at `frontend/src/providers/StreamsProvider.tsx:4650`). The chat's "Generated files" list comes from the thread's own messages. Live, it is `message.finalOutputFiles`, stamped from the `final_output_files` SSE event (`StreamsProvider.tsx:1128`). After a reload it is rebuilt from the persisted `execute_code` `tool_calls[].result.output_files` (`frontend/src/lib/api/threads.ts:155-180`). A local DB check of the repro thread `3586b900-243b-4f73-9614-e25020deeb48` (read-only) gave **0 `workspace_files` rows**, **both assistant messages' `tool_calls` contain `output_files`**, and there are 3 `code_executions` rows. So the panel can read the very messages the chat already holds (`useThreadMessages(threadId, "chat")`, the same call `useMessages.ts:91` makes). It derives the produced files in a new pure helper and downloads through the chat's own `downloadSandboxOutput` (`frontend/src/lib/api/documents.ts:341`). That keeps one home for the bytes, adds no endpoint, and needs no copy step.

**FIX-03 is built, and it was already driven live in 300.** `scheduleOutcomeLine` (`frontend/src/components/workflows/scheduleOutcomeVocabulary.ts:27-55`) maps every known `last_status` to a sentence and has a fallback for unknown values. `onRunNow` (`WorkflowScheduleModal.tsx:381-400`) marks only that row busy (`runningIds`). After the first load, "Loading…" never replaces the list (`listShown` ref at `:181-183` and `:208-211`). 300's G4-5 PASSED live (`300-HUMAN-UAT.md:59`) with **one unfixed finding, F-1**: right after Run now on a refused row, the refusal sentence shows **twice**, once as the outcome line and once as the Run-now result line. Git shows no commit touching the modal after `fd024ec01` (300-01). That ≤10-line fix is the only code FIX-03 still owes.

**FIX-06: all six findings are still present at HEAD.** Each one has a one-hunk fix and an existing test file to drive it RED. One finding (BE-IN-04) needs a design call. Turning the bare `ValueError` into "return the tool unchanged" would still fail the whole request, because Moonshot itself 400s on recursion. So the fix is **bounded unrolling with a typed leaf**, not a pass-through.

**REG-08: the gate is already clear.** `node scripts/check-seeds-register.cjs` returns `seeds register gate OK — 403/403 parsed, 0 duplicate ids` (exit 0). **No validator script for reported-bugs frontmatter exists** (`grep -rln reported-bugs scripts/ .github/workflows` finds nothing). Two register entries are already stale today: SEED-185 and SEED-281 (see F3, F4).

**Primary recommendation:** Keep the 3-plan shape from D-21. Plan 1 (FIX-01) is frontend-only: one new helper module, one new panel row component, and one hunk each in `FilesSection.tsx` and `WorkspacePanel.tsx`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| List a thread's produced files in the panel | Browser (derive from the thread's loaded messages) | — | The chat already holds them, so a second read path would be a second source of truth |
| Download a produced file | API (`GET /sandbox-outputs/{path}`, ownership fence + 60 s re-sign) | Browser (`downloadSandboxOutput`) | Already shipped and fenced. Reuse it as-is |
| Schedule-row words / Run now | Browser | API (`POST` trigger) | Built in 300 |
| Judge "by design" note freshness | API (harness) | — | Same predicate as the executor |
| Moonshot schema shaping | API (provider gateway, endpoint-keyed) | — | Provider-local, no other provider affected |
| 409 wording on in-thread start | Browser (`useStartWorkflowInThread`) | Provider lock arm (tag only) | The words live in the client copy |

## Standard Stack

No new packages. Everything uses the existing React/vitest/FastAPI/pytest stack. **Package Legitimacy Audit: not applicable (zero installs).**

## Architecture Patterns

### FIX-01 data flow (as built, and the fix)

```
execute_code → sandbox_service.harvest → Storage "sandbox-outputs" + sandbox_files row (no thread_id)
            → tool result output_files[{filename,url:"/sandbox-outputs/<uid>/<exec>/<f>",size}]
            → persisted on messages.tool_calls ─┬─ live: SSE final_output_files → message.finalOutputFiles
                                                └─ reload: threads.ts:155 rebuilds finalOutputFiles
chat: MessageItem.tsx:1030 FinalOutputsPanel ← message.finalOutputFiles      (works)
panel: FilesSection.tsx:170 useWorkspaceFiles ← GET /workspace/files ← workspace_files  (0 rows → "No files yet")
FIX:  panel also reads useThreadMessages(threadId,"chat") → threadProducedFiles(messages) → rows → downloadSandboxOutput
```

### Recommended structure (G-5: new logic in new modules)
- `frontend/src/components/panel/threadProducedFiles.ts` (NEW, pure). It folds `messages[].finalOutputFiles` into one list, de-duplicated by `url` (falling back to `filename`) with the latest turn winning. That matters because a turn's final list is cumulative, so turn 2 can re-list turn 1's files. Read `finalOutputFiles` only, which is exactly what the chat renders. Never re-parse `tool_calls`: `threads.ts` already does that once.
- `frontend/src/components/panel/useThreadFiles.ts` (NEW hook, optional). It returns `{ workspace, produced, count }`, so `WorkspacePanel.tsx:357/422/466/631` changes one binding and `FilesSection.tsx:170` changes one binding.
- `frontend/src/components/panel/ProducedFileRow.tsx` (NEW). It renders the shared `FileRow` (`density="panel"`, trailing `download`/`spinner`) and calls `downloadSandboxOutput(file.url, file.filename)` with the same `DownloadError` handling `OutputFileCard.tsx:109-130` uses. Activation **downloads**. It does not drill into `FilePreview`, because `FilePreview` reads the workspace content route, which has no row for these files.
- `FilesSection.tsx` hunk: render produced rows after the workspace listbox, and change the `rows.length === 0` empty-state test (`:276`) to `workspace + produced === 0`. Keep the existing `role="listbox"` and its arrow-key index over workspace rows untouched. Put produced rows in a plain `role="list"` beneath it, so the listbox keyboard contract and its tests stay byte-stable.

### Anti-patterns
- Copying sandbox bytes into `workspace_files`. D-02 forbids it, and it would also widen `list_files_in_thread`, which the sandbox hydrator reads (`workspace.py:530-534`).
- A new backend endpoint that joins `sandbox_files`→`code_executions.thread_id`. It is possible (`code_executions` has `thread_id`), but it is a second source that can disagree with the chat.
- Sending produced rows through `FilePreview` or `onSelectFile`. The `WorkspaceFile` type and the content route don't apply to them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---|---|---|
| Produced-file download | New signed-URL route / blob fetch | `downloadSandboxOutput` + `GET /sandbox-outputs/{path}` (ownership fence `sandbox_outputs.py:46-70`) |
| Per-extension icon/row | New row markup | `FileRow` (`components/files/FileRow.tsx`, `panel` density) |
| Output-file extraction from history | A second `tool_calls` parser | `finalOutputFiles` already rebuilt in `threads.ts:155-180` |
| Schedule outcome words | Anything | `scheduleOutcomeLine` (built) |

## FIX-06: finding by finding (all still present)

| ID | Present at | Smallest fix | RED test (existing file) | Accept? |
|---|---|---|---|---|
| BE-IN-01 | `harness/validator_kinds.py:250-262`. `recording_by_design` is sync and reads `feature_audience("live_connectors")` with no `ensure_settings_fresh()`. The executor awaits it first (`phase_types.py:2750`, test `!= "everyone"` at `:2763`) | Add one async predicate `live_connectors_fully_on()` (await `ensure_settings_fresh()` then `feature_audience(...) == "everyone"`) in a small module, e.g. `harness/live_connectors.py`. Both the executor (`:2750-2763`) and `recording_by_design` call it. `recording_by_design` becomes `async` and its one caller, `_validate_llm_judge_rubric` (`:639`, already async), awaits it at `:700` | `backend/tests/unit/test_296_judge_note_and_tasks.py`: monkeypatch the cache stale-on vs fresh-off, and assert the judge's `by_design` agrees with the executor | No. One shared predicate is cheap |
| BE-IN-03 | `harness/publish_service.py:1564-1585`. The loop stands in for every `definition.inputs`, including `source="kb_auto"`/`"template_derived"` and `type="file"`/`"kb_auto"` (`models/harness.py:656-658`). The note is built at `:586` and `:1596` | In `golden_run_inputs`, `continue` (no stand-in, not listed) when `getattr(spec,"source","user") != "user"` or `type in ("file","kb_auto")`. Overlay and `launch_kickoff` already skip these | `backend/tests/unit/test_296_golden_inputs_and_lint.py`: a definition with one `kb_auto` and one `file` input → `stood_in == []` and `stand_in_note(...) is None` | No |
| BE-IN-04 | `provider_gateway/schema_moonshot.py:61-66` raises `ValueError` on a cycle, inside `openai_compat.py:456` (`moonshot_tools`, endpoint-keyed) | **Bounded unroll with a typed leaf.** On a re-entry into `name` beyond depth 1, emit `{"type": defs[name].get("type","object"), "description": <def description or name>}` (drop nested `$ref`), and `logger.warning` naming the tool + def. No exception escapes `moonshot_tools`. Other providers stay byte-unchanged (the caller is gated on the `"moonshot"` endpoint) | `backend/tests/unit/test_296_moonshot_schema.py:102-111` currently asserts `pytest.raises(ValueError)`. **Rewrite that test first** (RED): a self-referencing `Node` → result has no `$ref`/`$defs`, terminates in a typed leaf, `moonshot_tools` returns without raising, and a non-recursive tool in the same list is unchanged | No (see Pitfall 3 for why "return unchanged" is wrong) |
| FE-IN-01 | `chat/useStartWorkflowInThread.ts:29` maps every 409 → `startLocked`. Non-lock 409s on this path: paused (`workflow_kickoff.py:178-185`), workflow in another org (`item_org_guard.py:38-47`, 299), Expert/thread org (`threads.py:1836` → `_require_thread_org`). The provider's lock arm **replaces** the error with its own fixed ApiError (`StreamsProvider.tsx:3261-3285`, prefix const `:204`). Other 409s are stored raw, with `message` = the server sentence (`:3326-3340`) | Lock arm: `Object.assign` a `code: "workflow_locked"` onto the constructed ApiError (one expression in the hot file). `failureFor`: `"locked"` only when `code === "workflow_locked"`. Every other 409 → new kind `"refused"` that shows the server's sentence. All three are person-worded server sentences ("…paused, waiting for your answer. Answer it in the panel…", "This workflow is in {org}. Switch to {org}…", "Switch to this chat's organization…"). Record this in the `failureFor` header as the **second recorded exception**, beside 298's `folder_in_other_org` | `frontend/src/components/chat/__tests__/useStartWorkflowInThread.test.tsx`: a 409 ApiError with the paused sentence and no code → message is the paused sentence, kind ≠ `locked`. One with `code:"workflow_locked"` → `startLocked` | No. If the planner refuses to touch StreamsProvider, the fallback is to compare `err.message` to the exported banner constant. That is prose-keyed and weaker |
| FE-IN-04 | `workflows/DescribeTemplateRow.tsx:476-481`: the checkbox has `disabled` but not `{...lockedBy}` (defined `:332`, spread on siblings `:363`, `:379`) | Spread `{...lockedBy}` on the `<input type="checkbox">` | `frontend/src/components/workflows/DescribeTemplateRow.test.tsx`: disabled + `disabledNoteId` → each blank checkbox has `aria-describedby` = that id | No |
| FE-IN-06 | `workflows/TeamPicture.tsx:467` (region `aria-label={teamFigureLabel(name)}`) and `:487` (figure, same label). Label from `teamVocabulary.ts:56` | Add `teamRegionLabel(name)` = `` `Team picture for ${name}, scrollable` `` to `teamVocabulary.ts`. The region uses it and the figure keeps its own. (Alternative: region `aria-labelledby` the figure caption.) | `frontend/src/components/workflows/TeamPicture.test.tsx`: the region's accessible name ≠ the figure's | No |

**Note:** SEED-391 `trigger_paths` lists `WorkflowCanvas.tsx` for FE-IN-06, but the code lives in `TeamPicture.tsx`/`teamVocabulary.ts`. Correct the seed's paths in REG-08.

## FIX-03: what is and isn't true

| SC clause | Status | Evidence |
|---|---|---|
| Launch failure worded in plain language | ✅ built | `scheduleOutcomeVocabulary.ts:30` `launch_failed` → "Didn't start. Press Run now to see why."; unknown → `UNDESCRIBED`; spaced value = server sentence. Tests: `__tests__/scheduleOutcomeVocabulary.test.ts`, `__tests__/WorkflowScheduleModal.test.tsx` (35 cases) |
| Run now updates only that row | ✅ built + driven live | `WorkflowScheduleModal.tsx:381-400` (`runningIds`), `:181-183`/`:208-211` (quiet refresh, `aria-busy`); 300 G4-5 PASS (`300-HUMAN-UAT.md:59`) |
| **Not yet true** | ❌ F-1 | A refused Run now shows the same sentence twice (outcome line S6a + Run-now result S6d). Fix: suppress the row's Run-now result line when its text equals the refreshed outcome line's text, or drop the result once the refreshed `last_status` carries it. Add a RED case to `WorkflowScheduleModal.test.tsx`. `/gsd:fast`-sized (G-3), can live inside plan 3 |

## REG-08: register inventory (state at research time → what it should read)

| Item | Now | Should read after 302 | Why |
|---|---|---|---|
| BUG-261027-01 | folded → 302 | `closed`, `verified_closed_by: "302 …G-4 row 1"` only if G-4 row 1 passes live; else stays `folded` + `status_note` | FIX-01 |
| BUG-261027-02 | closed (299) | unchanged | ✅ |
| BUG-261027-03 | folded → 300 | `closed`, `verified_closed_by: "300 G4-5 PASS 2026-10-29 + 302 F-1 fix"` once F-1 is fixed and re-driven; else `folded` noting F-1 | 300 is human_needed overall, but **this bug's own row is already PASSED live**. D-13's "never closed ahead of UAT" is satisfied for this bug (see F5) |
| BUG-261027-04, -05; BUG-260828-05, -06 | folded → 300 | `folded` + `status_note` naming the owed 300 row (FIX-05 8-row re-run; G4-8 real mailbox) | 300 VER `human_needed`, UAT `partial` |
| BUG-261029-01 | folded → 301 | `folded` + note: owed 301 HUMAN-UAT §2 G4-4 keyboard path (D-16) | 301 `human_needed` |
| SEED-185 | **folded → 297** | **`shipped`** (297 VER passed; 299 VER passed, UAT complete) | Its own note says "flip to shipped only when 299 closes too". **299 has closed**, so the seed is stale (F3) |
| SEED-015, -178, -312 | shipped (299) | unchanged | ✅ |
| SEED-313 | partially-answered → 298 | unchanged + note: 298 G-4 owed (UAT `owed`) | |
| SEED-317, -389 | folded → 298 | `folded` + note naming 298 G4-1/G4-5 owed | 298 VER `human_needed` |
| SEED-281 | folded → "300, 301" | correct premises (D-14): **`:50` "There is no app-owned mailer"**, false since 300 D-21; **`:106-107`/`:124` "unanswered `ask_user` resolves to `fail_run`"**, false: an unanswered run waits. Record the excluded pause kinds (tool-round cap, chat `ask_user`). Status stays `folded` until 300/301 close | F4 |
| SEED-391 | folded → 302 | `answered`/`shipped` per the TEMPLATE enum once the six land. Fix `trigger_paths` (`TeamPicture.tsx`, `teamVocabulary.ts`, `schema_moonshot.py`, `StreamsProvider.tsx`) | |
| SEED-392…396 | planted | unchanged (found in v4.8, routed, valid) | gate OK |
| **NEW** bug: built images can't send invite email | — | file `folded`, `folded_into: "300"`, note: fixed in code by 300 D-21 (`300-CONTEXT.md:120`, `:185`); real-mail row G4-1 owed, Resend deferred (`300-HUMAN-UAT.md:43`) | D-15a. No live check exists, so not `closed` |
| **NEW** bug: `*.vercel.app` previews can't open the app | — | file `open`. Evidence: `frontend/vercel.json:5-14` redirects `/app` on **any host not starting `app.`** to `https://app.:host/app`, so a preview host becomes `app.<preview>.vercel.app`, which does not exist. Secondary hypothesis: the preview origin is not in `FRONTEND_URL` (CORS), per `docs/DEPLOYMENT-LESSONS.md:80` (a list naming only `superrag.cloud` + `agentic-rag-rho.vercel.app`). Source of the deferral: `297-RESEARCH.md:172`, `297-04-PLAN.md:214` | D-15b |

**Register gates:** `node scripts/check-seeds-register.cjs` (exit 0 = clear; it is clear today). **There is no reported-bugs validator.** D-17's "frontmatter valid" must be a hand check against `.planning/reported-bugs/TEMPLATE.md` keys (`id, title, reported, surface, severity, status ∈ {open,folded,deferred,external-noted,closed}, affected_areas, folded_into, verified_closed_by, related_seeds, re_open_trigger, reproduces_on`). Suggest a short `node -e` YAML key check in the plan's verify step, not a new script (a new script would be a new capability).

## Common Pitfalls

1. **Counting only `workspace_files` for panel visibility.** `WorkspacePanel.tsx:422` (`files.length > 0 ||` gates PanelEmpty vs content), `:466` (section count), and `:631` (`filesCount`) all read the workspace list. If only FilesSection changes, the panel can stay in its no-activity state and still read "FILES 0". The combined count must feed all three.
2. **De-duplication.** Each turn's `finalOutputFiles` is cumulative for that turn. Without a url-keyed de-dupe, turn 2 re-lists turn 1's charts. The legacy `http…` signed URLs stored pre-067.2 decay after 1 h; `OutputFileCard` already renders those "dead", so mirror it.
3. **BE-IN-04 "return unchanged" still fails the request.** Moonshot's live 400 is "detected infinite recursion without termination condition" (`schema_moonshot.py:3-6`). It already refused a *non-cyclic* `$ref`, so an un-inlined cyclic ref will 400 the whole request. Dropping the tool silently hides a connector tool the person asked for. Bounded unrolling keeps the tool usable.
4. **FE-IN-01 lock detection.** `failureFor` receives the provider's *replacement* ApiError for the lock ("This thread is running a workflow — cancel it to send a Deep message."), not the server's "Thread is workflow-locked" detail. Keying on the server prefix in the hook would never match.
5. **StreamsProvider G-5** (45 phases). The FE-IN-01 hunk there must be the single `Object.assign` expression, with no new state.
6. **Count-gate pins.** New test cases in pinned files (`FilesSection.test.tsx`, `WorkspacePanel.test.tsx`, `useStartWorkflowInThread.test.tsx`, `WorkflowScheduleModal.test.tsx`, `TeamPicture.test.tsx`, `DescribeTemplateRow.test.tsx`) need pin bumps in `scripts/vitest-count-gate.cjs` in the same commit.
7. **The `F-1/V-05` raw-source fence** in `WorkspacePanel.test.tsx` sweeps `panel/` sources for certain spellings (see ledger). New panel modules must not spell the forbidden names, even in comments.

## G-5 / hot-file ledger

Run `node scripts/check-hot-file-ledger.cjs` against a scratch PLAN listing the likely files. Result: **every existing file has a row** (`FilesSection.tsx`, `WorkspacePanel.tsx`, `AppViewSwitch.tsx`, `FileRow.tsx`, `fileRowUtils.ts`, `documents.ts`, `OutputFileCard.tsx`, `useStartWorkflowInThread.ts`, `composerCopy.ts`, `DescribeTemplateRow.tsx`, `TeamPicture.tsx`, `teamVocabulary.ts`, `WorkflowScheduleModal.tsx`, `scheduleOutcomeVocabulary.ts`, `validator_kinds.py`, `publish_service.py`, `schema_moonshot.py`, `openai_compat.py`, `StreamsProvider.tsx`). **NEW modules will need rows in the same commit**: `panel/threadProducedFiles.ts`, `panel/useThreadFiles.ts`, `panel/ProducedFileRow.tsx`, `harness/live_connectors.py` (or whatever names are chosen). FIRING files touched: `WorkspacePanel.tsx`, `FilesSection.tsx`, `StreamsProvider.tsx`, `publish_service.py`, `validator_kinds.py`, `phase_types.py` (if the executor is repointed at the shared predicate), `useStartWorkflowInThread.ts`, `composerCopy.ts`, `openai_compat.py` (probably untouched; the change stays in `schema_moonshot.py`). Each takes one hunk, honoured by construction. **`backend/app/api/workspace.py` is NOT touched** (D-04 listed it, but no backend change is needed).

## Findings vs CONTEXT (amendments)

- **F1 (D-02/D-04):** No backend change is needed. `workspace.py` drops out of scope. The source is the thread's loaded messages (`finalOutputFiles`), not an API. Amend D-04's file list.
- **F2 (D-03):** The panel's mount is `frontend/src/components/layout/AppViewSwitch.tsx:308`, rendered inside `ChatLayout` (`ChatLayout.tsx:14`). "Lands in chat first" still holds; the mount-site name is wrong.
- **F3 (REG-08):** SEED-185 is stale. It reads `folded → 297`, but its own flip condition (299 closed) is met: 299 VER passed, UAT complete. It should read `shipped`.
- **F4 (D-14):** SEED-281's false premises sit at `:50` (mailer) and `:106-107`, `:124` (expiry fails the run). Correct them beside the originals (struck through, not deleted, per project convention).
- **F5 (D-05/D-13):** BUG-261027-03's live drive has **already passed** (300 G4-5), and F-1 is the only defect left. D-05's "302 drives it live" should be scoped to the F-1 fix plus a re-drive of G4-5. D-13's blanket "300 items stay folded" should not keep this one folded once that re-drive passes.
- **F6 (D-08):** The research decision is **bounded unrolling**, not a per-tool skip or pass-through (Pitfall 3). This rewrites an existing test (`test_296_moonshot_schema.py:102`) that currently pins the `ValueError`. That rewrite is the RED step.
- **F7 (D-09):** "Wording by cause" needs the lock arm in `StreamsProvider.tsx` to tag a code. Otherwise the hook cannot tell the lock 409 from the others without comparing prose. It also adds a second recorded "server sentence" exception to the `failureFor` header.
- **F8 (D-17):** No reported-bugs frontmatter validator exists. Verify by hand or with an inline key check, and do not add a script.
- **F9 (SEED-391):** `trigger_paths` names `WorkflowCanvas.tsx`, but FE-IN-06 lives in `TeamPicture.tsx`/`teamVocabulary.ts`. Fix this when flipping the seed.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | `GET /threads/{id}/messages` returns the full history unpaged (no `.limit(` found near the route; client sends no paging params, `threads.ts:186`) | Long-message axis: the panel would miss old files. Verify on the ≥50-message G-4 row |
| A2 | Moonshot accepts a bounded-depth typed leaf (`{"type":"object","description":…}`) where recursion was cut | The tool still 400s. The live Moonshot row is ⛔ (account suspended, 296), so this is unit-tested only |
| A3 | De-duping by `url` is right across turns (the same filename re-written in a later execution gets a new `execution_id` path, so both versions list) | Duplicate-looking names. Acceptable, and it matches the chat |

## Open Questions

1. Should produced rows sit in the same listbox (one arrow-key sequence) or below it? The recommendation is below it, in a plain list, to keep the listbox contract and tests stable. The planner decides, and the G-4 drive confirms.
2. Is `harness/live_connectors.py` worth a new module, or does `ensure_settings_fresh()` inline in `recording_by_design` (made async) satisfy D-06? D-06 says "one shared predicate", so the recommendation is the module.

## Environment Availability

| Dependency | Needed by | Available | Note |
|---|---|---|---|
| Local Supabase 54322 | FIX-01 G-4, DB evidence | ✓ (read via `backend/venv` asyncpg) | `psql` is NOT on PATH, so use the venv python |
| Backend venv / pytest | FIX-06 BE tests, baseline gate | ✓ | ceiling 71 failed |
| Chrome MCP | G-4 rows 1-3 | assumed ✓ | operator starts backend |
| Moonshot key | BE-IN-04 live row | ✗ | ⛔ account suspended (296); unit-tested only |

## Validation Architecture

(`workflow.nyquist_validation` is `false` in `.planning/config.json`; this section is included because the orchestrator asked for it.)

| Property | Value |
|---|---|
| Frameworks | vitest (frontend), pytest (backend) |
| Quick FE | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run <files>` |
| Quick BE | `cd backend && venv/Scripts/python -m pytest tests/unit/<file> -q` |
| Wave gates | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root); `node scripts/check-backend-unit-baseline.cjs` (≤71 failed); `npx tsc -p tsconfig.app.json --noEmit` set-diff vs base |

| Req | Behavior | Test | File |
|---|---|---|---|
| FIX-01 | helper folds + de-dupes `finalOutputFiles` across turns | unit | NEW `panel/__tests__/threadProducedFiles.test.ts` |
| FIX-01 | FilesSection lists produced rows when workspace is empty; no "No files yet" | component | `panel/__tests__/FilesSection.test.tsx` (mock `useThreadMessages`) |
| FIX-01 | panel count / non-empty state counts produced files | component | `panel/__tests__/WorkspacePanel.test.tsx` |
| FIX-01 | row activation calls `downloadSandboxOutput(url, filename)` | component | NEW `panel/__tests__/ProducedFileRow.test.tsx` |
| FIX-03 | refused Run now shows the sentence once | component | `workflows/__tests__/WorkflowScheduleModal.test.tsx` |
| FIX-06 | six RED-first cases | unit/component | files named in the FIX-06 table |
| REG-08 | register clear | script | `node scripts/check-seeds-register.cjs` |
| G-4 (manual) | D-19 rows 1-3; D-20 four-axis for FIX-01 (8-row roster derived from `MODEL_CAPABILITIES`, Moonshot ⛔) | Chrome MCP + DB | VALIDATION/UAT file |

Wave 0 gaps: the three NEW test files above. Everything else extends existing files.

## Security Domain

| ASVS | Applies | Control |
|---|---|---|
| V4 Access control | yes | Produced-file download reuses `GET /sandbox-outputs/{path}`: first path segment must equal the caller id, plus a `sandbox_files` row check, then a 60 s re-sign (`sandbox_outputs.py:46-90`). The panel adds no new route. The list derives from messages the user can already read (RLS on `messages`) |
| V5 Input validation | yes | Moonshot: externally authored MCP schemas now degrade per tool instead of raising. Log the tool name and def name only, never the schema body |
| V7 Errors | yes | FE-IN-01 shows server sentences that are authored for the person. None of them leaks ids or other-org names beyond what `item_org_guard` already decides (it names the org only when visible) |

Threats: T1 (Info disclosure) a produced row pointing at another user's path → blocked by the fence above, with no change. T2 (DoS) a recursive schema forcing unbounded expansion → bounded depth caps it.

## Sources

- Code: file:line citations throughout (HEAD `a59b62bdf`); local DB read-only query of thread `3586b900…`.
- [Kimi tool-calls guide](https://platform.kimi.ai/docs/guide/use-kimi-api-to-complete-tool-calls): no mention of `$ref`/`$defs`/recursion (fetched 2026-10-30).
- [Kimi response_format guide](https://platform.kimi.ai/docs/guide/response_format): MFJS applies under strict mode. `$ref` support varies by model (k2.7-code stable; k2.6 unstable). Recursion is not documented. Validator: `github.com/moonshotai/walle`.
- `.planning/milestones/v4.7-phases/296-close-v4-7-debt/296-REVIEW.md:277-485`; `300-HUMAN-UAT.md:21-60`; `297-RESEARCH.md:172`.

## Metadata
- Stack/patterns: HIGH (code read directly). Moonshot behaviour: MEDIUM-LOW (docs silent, live 400 is the only primary evidence). Register inventory: HIGH (frontmatter read).
- Valid until: next commit touching the named files, or 7 days.
