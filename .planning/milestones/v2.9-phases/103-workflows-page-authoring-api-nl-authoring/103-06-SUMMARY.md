---
phase: 103-workflows-page-authoring-api-nl-authoring
plan: 06
subsystem: frontend
tags: [react, typescript, vite, vitest, workflows-page, project-filter, drafts-shelf, run-launch, tweak-fork, no-router, three-homes, additive-backend]

# Dependency graph
requires:
  - phase: 103-workflows-page-authoring-api-nl-authoring
    plan: "03"
    provides: the shared NAV_ITEMS const + the 'workflows' ActiveView + the api authoring fns (listDraftWorkflows/createWorkflowDraft) + deriveTier()/TIERS — consumed AS-IS
  - phase: 103-workflows-page-authoring-api-nl-authoring
    plan: "04"
    provides: WorkflowBuilderPage (the Build-card / Tweak destination) + its renderPublish? seam — hosted, not recreated
  - phase: 103-workflows-page-authoring-api-nl-authoring
    plan: "05"
    provides: PublishGauntlet with onPublished?(version) firing only on a verbatim PASS — mounted into the Builder's renderPublish seam for the auto-return-with-Run-CTA
provides:
  - "WorkflowsPage — the project-filtered browse + launch home: a live ?project_folder_id= filter rail, drafts-above-published shelves + the dashed Build-card, per-card essence (deriveTier badge + phase-type chain + entry input_keys), the Run modal (D-103-1), the Tweak v(N+1) fork (INSERT), and the Builder/gauntlet host (three-homes, no router)"
  - "ChatLayout 'workflows' render branch (additive — no chat regression) + doRun (the existing-kickoff launcher) + the mobile drawer consuming the shared NAV_ITEMS (triplication killed)"
  - "api.ts: listPublishedWorkflows(projectFolderId?, signal?) + the additive optional 'definition' on PublishedWorkflow + WorkflowDraftRow"
  - "backend (additive): GET /workflows/published + GET /workflows/drafts now return the definition JSONB so the card derives its tier + phase chain client-side"
affects:
  - "Phase 103 verify-work / secure-phase (the Workflows page surface lands here — WFAUTH-04 closes)"
  - "the composer Harness picker (D-103-B) is UNTOUCHED — it reads id/slug/name and ignores the additive definition field"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-homes, router-less: the Workflows page is a ChatLayout render branch (activeView==='workflows') that HOSTS the Builder + publish gauntlet as intra-page state ('library' | 'builder') — Run is the only way OUT (into a thread), never page-resident execution"
    - "Run reuses the EXISTING kickoff verbatim: createThread -> postMessage(workflow_definition_id) -> select+navigate('chat'). NO bespoke /workflows/{id}/run; active_workflow_run_id set server-side; threads.py byte-identical (Deep preserved)"
    - "Tweak = createWorkflowDraft INSERT with version=N+1, same slug, status 'draft' — the frozen published row is NEVER UPDATEd (the per-version immutability fork)"
    - "The strictness tier is DERIVED on every render from the real definition (citation_policy + the validator-kind union) via deriveTier — no stored label, no per-badge fetch"
    - "Additive-optional backend field delivery: list_published/list_draft also SELECT the definition JSONB and the route returns it as an optional dict — pre-103 picker/shelf callers ignore it (backward compatible), and it joins the /workflows router (never threads.py)"
    - "The single shared NAV_ITEMS now has its THIRD + final consumer (the mobile drawer) — the NAV_ITEMS_MOBILE triplicate is gone (NavPanel + drawer are the two live consumers)"

key-files:
  created:
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/WorkflowsPage.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/layout/ChatLayout.tsx
    - backend/app/api/workflows.py
    - backend/app/db/workflows.py

key-decisions:
  - "The card's tier badge + phase chain need the FULL definition, but the published/drafts list rows were id/slug/name(/version) only AND there is no GET-single-definition route. Resolved (deviation Rule 3) the lowest-cost contract-honoring way: ADDITIVELY return the definition JSONB from the existing GET /workflows/published + GET /workflows/drafts (joins the /workflows router, NEVER threads.py; Deep byte-identical) — keeping deriveTier purely client-side (the def is delivered, the badge is computed)."
  - "asyncpg returns the definition JSONB column as a raw JSON string (no pool codec — db/workflows.py:278); the route decodes it via a defensive _coerce_definition (mirrors publish_service.py:103-109): a string is json.loads-ed, a dict passes through, anything unparseable degrades to None (the client tolerates a missing definition)."
  - "The workflow's citation_policy for deriveTier is taken from the strictest llm_emit phase's config.citation_policy (default 'draft' when no emit phase declares one — no per-phase citation gate); the validator-kind set is the union across all phases. Both are read from the def, never a stored tier."
  - "'Unbound (no project)' is not expressible as a server folder-id filter, so it fetches the full owner-scoped list and narrows client-side to defs with no project_folder_id; 'All projects' omits the param; a real folder id is the live ?project_folder_id= re-query (narrows-only, T-098-09)."
  - "doRun lives in ChatLayout (it owns the thread state); the page passes it up via the onLaunch prop. The new thread is surfaced via loadThreads() + selectThread() (the public useThreads API) — no new useThreads seam was needed."

patterns-established:
  - "Net-new-failure proof (SEED-056): added 1 test file (+11 GREEN) + modified 2 pre-existing source files (api.ts/ChatLayout.tsx) with no behavior-changing edit to any tested path. HEAD = 17 failed / 710 in the SAME 7 documented-rot files (MessageItem / Plan04.frontend[095] / useMessages / StreamsProvider.dedup / streamsProvider / streamsProvider_075_9_clientkey / model-info) — byte-identical to Plan 04/05's 17-failure baseline. Net-new failures = 0."

requirements-completed: [WFAUTH-04]

# Metrics
duration: 10min
completed: 2026-06-14
---

# Phase 103 Plan 06: Workflows Page + Run Launch + Nav Render Branch Summary

**The project-filtered browse + launch home that closes REQ-7 / WFAUTH-04, exactly as the locked sketch-021-A + 023-A contract demands: `WorkflowsPage` (a live `?project_folder_id=` filter rail, Drafts-above-Published shelves with the dashed Build-card, per-card essence — icon+name+vN, a client-derived `deriveTier()` badge, the 6-glyph phase-type chain, `entry needs <input_keys>` — a draft that CANNOT Run, published Run + Tweak, the D-103-1 Run modal with a read-only folder chip + ONE textarea + a hint enabled-on-empty, the Tweak→`v(N+1)` INSERT fork that never touches the frozen row, and the page hosting the Builder + publish gauntlet with the auto-return-to-library-with-a-Run-CTA on a gauntlet PASS — all three-homes, no router) plus the ChatLayout `"workflows"` render branch (additive — no chat regression), the `doRun` launcher that REUSES the existing kickoff (`createThread → postMessage(workflow_definition_id)`, no bespoke run route, `threads.py` byte-identical), and the mobile drawer consuming the shared `NAV_ITEMS` (the triplicate killed) — 11 vitest cases GREEN, `tsc -b` clean on all 4 edited files, net-new failures = 0 (17 = 17 documented rot), no react-router.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-14 10:55 UTC
- **Completed:** 2026-06-14 11:06 UTC
- **Tasks:** 2 (both TDD: implementation + GREEN test)
- **Files changed:** 6 (2 created frontend + 2 modified frontend + 2 modified backend additive)

## Accomplishments

- **REQ-7 d/e/g/h — `WorkflowsPage.tsx` (the library + launch home).** A project-folder filter rail (All projects / each project / Unbound) issuing the live `listPublishedWorkflows(projectFolderId)` re-query on select. Drafts-above-Published shelves: the Drafts shelf leads with the dashed **Build a workflow** build-card (opens the Builder) then the caller's own `listDraftWorkflows()` cards — each draft shows **Open✎ + Publish…** but **NEVER a Run** (D12 — publish is the test); the Published shelf renders the filtered cards each with **Run + Tweak**. Per-card essence: icon + name + `vN`, a **client-derived `deriveTier()` badge** (computed on every render from `citation_policy` + the validator-kind union — no stored label, no per-badge fetch), the **6-glyph phase-type chain** (⚙ ✎ 🤖 ⛓ ☺ ◆), and `entry needs <input_keys>`. Honest **net-new violet flags** (D14) mark the draft-CRUD affordances + the Workflows nav entry; only `GET /workflows/published` wears the live-green chip.
- **REQ-7 a/b/c/f/i — Run-from-page launch (`doRun`, in ChatLayout).** The Run button opens the **D-103-1 modal**: a **read-only folder chip** (the bound project-folder NAME, never a path — test-asserts no `/` or `\`), **ONE textarea** ("What should this run work on?"), and a **HINT line** for the declared `input_keys`; the Run button is **ENABLED even on empty input**. Confirm → `props.onLaunch(def, kickoff)` → ChatLayout's `doRun`: `createThread(def.name)` → `postMessage(thread.id, kickoff, {workflowDefinitionId})` → `loadThreads()` → `selectThread()` → `onNavigate("chat")`. This **REUSES the existing kickoff** (NO bespoke `/workflows/{id}/run`); `active_workflow_run_id` is set server-side atomically and the thread enters harness mode (`GET /threads/{id}/workflow → harness` is the real-run proof — not a view-only switch).
- **REQ-7 g — Tweak forks `v(N+1)` (INSERT, never UPDATE).** `onTweak(wf)` calls `createWorkflowDraft({ ...def, slug, version: N+1, status: "draft" })` (an INSERT) then opens the new draft in the Builder. The frozen published row is **never UPDATEd** (test-asserts the INSERT args + that `updateWorkflowDraft` was NOT called).
- **REQ-7 (sketch 023-A) — the Builder/gauntlet host + auto-return-with-Run-CTA.** The Build-card and Tweak set the page view to `"builder"` and render `<WorkflowBuilderPage renderPublish={...}/>` (Plan 04) in place; the Builder's Publish mounts `<PublishGauntlet onPublished={(version) => { setPageView("library"); setRunCta(...); refetch }}/>` (Plan 05) — on a verbatim PASS the view **auto-returns to the library** + surfaces a **Run CTA** on the new version. Three-homes, no router.
- **REQ-7 — ChatLayout wiring (additive, no chat regression).** The `activeView === "workflows"` render branch lands **BEFORE** the trailing `: <KnowledgeHealthPage/>` else — the existing chat + documents/skills/settings render paths are untouched. The **mobile drawer now consumes the shared `NAV_ITEMS`** (incl. the Workflows home + its distinct `Workflow` icon); the local `NAV_ITEMS_MOBILE` array + its 4 dead icon imports (`FileText`/`Activity`/`Zap`/`Settings`) are gone — NavPanel (Plan 03) + this drawer are now the two live consumers, finishing the triplication kill.
- **api.ts seam.** `listPublishedWorkflows(projectFolderId?, signal?)` appends `?project_folder_id=` (narrows-only, T-098-09; the existing no-arg `ChatArea` caller keeps working). `PublishedWorkflow` + `WorkflowDraftRow` gain an additive optional `definition?: WorkflowDefinitionJSON | null` so the card derives the tier + chain client-side.

## Task Commits

Each task was committed atomically:

1. **Task 1: Workflows page — filter rail + shelves + Build-card + Run/Tweak + the api/backend def-delivery seam** — `3adcb0ae` (feat) — 11 vitest cases.
2. **Task 2: ChatLayout 'workflows' render branch + doRun launch + shared NAV_ITEMS drawer** — `a2eb5650` (feat).

## Files Created/Modified

- `frontend/src/pages/WorkflowsPage.tsx` (NEW, ~640 lines) — the project-filtered library + drafts shelf + Build-card + Run modal + Tweak + the Builder host.
- `frontend/src/pages/WorkflowsPage.test.tsx` (NEW) — 11 cases.
- `frontend/src/lib/api.ts` — `listPublishedWorkflows(projectFolderId?, signal?)` + the additive optional `definition` on `PublishedWorkflow` + `WorkflowDraftRow`.
- `frontend/src/components/layout/ChatLayout.tsx` — the `"workflows"` render branch + `doRun` + the shared-`NAV_ITEMS` mobile drawer (the `NAV_ITEMS_MOBILE` triplicate + 4 dead icon imports removed).
- `backend/app/api/workflows.py` — `_coerce_definition` helper + the additive optional `definition` field on `PublishedWorkflow` + `DraftRow` + the two list handlers' per-row decode.
- `backend/app/db/workflows.py` — `list_published_workflows` + `list_draft_workflows` also `SELECT ... definition`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The card's `deriveTier` badge + phase chain need the full definition, which no endpoint served — additively delivered it from the existing `/workflows` list routes.**
- **Found during:** Task 1 (wiring the per-card `deriveTier()` badge + phase-type chain).
- **Issue:** `deriveTier(citation_policy, validatorKinds)` and the phase chain need the **full `WorkflowDefinition`**, but `GET /workflows/published` returned `{id, slug, name}` only, `GET /workflows/drafts` returned `{id, slug, version, name}` only, and there is **NO `GET /workflows/{id}` single-definition route** (the `get_definition` DB helper exists but is unexposed). The card genuinely could not render its essence (a blocking issue), and the plan's `files_modified` was frontend-only.
- **Fix:** Extended the EXISTING list routes additively — `list_published_workflows` / `list_draft_workflows` now also `SELECT definition`, and `GET /workflows/published` / `GET /workflows/drafts` return it as an **optional** `dict` (decoded from the raw-JSON-string JSONB via a defensive `_coerce_definition` mirroring `publish_service.py`). This joins the `/workflows` router (the CONTEXT-sanctioned integration point), **NEVER `threads.py`** (`git diff a131f05a -- threads.py anthropic_service.py` = empty); the pre-103 picker (`PublishedWorkflow` id/slug/name) + drafts-shelf (`DraftRow` id/slug/version/name) callers ignore the extra field (backward compatible — validated). deriveTier stays purely client-side (the def is delivered; the badge is computed, never a stored tier).
- **Files modified:** `backend/app/api/workflows.py`, `backend/app/db/workflows.py`, `frontend/src/lib/api.ts` (the optional types).
- **Verification:** `PublishedWorkflow`/`DraftRow` validate WITH and WITHOUT the field; `_coerce_definition` round-trips a string/dict/None/non-dict; the draft-crud unit tests still collect; the tier badge renders STRICT vs LOOSE client-side with `listPublishedWorkflows` as the only fetch (test-asserted).
- **Committed in:** `3adcb0ae` (Task 1).

**2. [Rule 1 - Bug] Three tsc errors in my own new/edited code (the runtime was correct).**
- **Found during:** Task 2 (`tsc -p tsconfig.app.json --noEmit` after the ChatLayout wiring).
- **Issue:** (a) I imported `sendMessage` from `@/lib/api`, but the exported send fn is `postMessage` (TS2305). (b) Unused `useMemo` import in `WorkflowsPage.tsx` (TS6133). (c) A leftover unused `mockCreate` in the test's hoisted mock set (TS6133).
- **Fix:** Imported + called `postMessage` (signature matches: `postMessage(threadId, content, {workflowDefinitionId})`); dropped the unused `useMemo` import; removed `mockCreate` from the test's `vi.hoisted` set.
- **Files modified:** `ChatLayout.tsx`, `WorkflowsPage.tsx`, `WorkflowsPage.test.tsx` (all my own same-wave code).
- **Verification:** `tsc -p tsconfig.app.json --noEmit` reports ZERO errors in any of my 4 edited files; 11/11 tests GREEN.
- **Committed in:** `a2eb5650` (the `postMessage` fix in Task 2) + `3adcb0ae` (the WorkflowsPage/test fixes were folded into Task 1 before its commit).

**Total deviations:** 1 Rule-3 blocking fix (additive def delivery from the existing `/workflows` routes — the only backend touch, threads.py byte-identical) + 1 cluster of 3 tsc-correctness bugs in my own code. No scope expansion beyond what REQ-7 d/h require (a card that shows its derived tier + chain).

## Known Stubs

- **None that affect the plan's goal.** The PublishGauntlet's "open the golden run" link (`href="#"`, a Plan-05 placeholder) is documented in 103-05's SUMMARY as the run-surface's job, not this plan's — it is unchanged here. The Workflows page is fully functional: real `listPublishedWorkflows`/`listDraftWorkflows`/`createWorkflowDraft` data, a real `doRun` launch, a real Tweak fork.

## Threat Surface (plan threat_model)

All six registered threats are mitigated (test-asserted where applicable):
- **T-103-06-01** (launch a workflow you can't see) → the Run list comes from owner-scoped `GET /workflows/published`; the kickoff route owner-checks the definition server-side; the client only passes a served id.
- **T-103-06-02** (the project filter widens visibility) → `listPublishedWorkflows` AND-appends the project filter to the owner-scope clause server-side (narrows-only, T-098-09); the value is `encodeURIComponent`-bound on the wire and a positional `$N` param server-side.
- **T-103-06-03** (Tweak UPDATEs the frozen row) → Tweak = `createWorkflowDraft` INSERT with `version=N+1` (test-asserts the INSERT args + that `updateWorkflowDraft` was NOT called); the DB trigger 23514s a published UPDATE anyway.
- **T-103-06-04** (Run switches the view but never kicks off a run) → `doRun` calls `postMessage` with `workflow_definition_id` → the backend sets `active_workflow_run_id` atomically; the proof is `GET /threads/{id}/workflow → harness`.
- **T-103-06-05** (a bespoke `/workflows/{id}/run` route is introduced) → `doRun` reuses `createThread` + `postMessage` (grep-asserted: no bespoke run route in code); `threads.py` byte-identical.
- **T-103-06-06** (a draft is run, bypassing the gauntlet) → a draft card exposes NO Run affordance (Open + Publish only); test-asserts no `published-run` inside a `draft-card`.

No NEW security-relevant surface beyond the plan's threat_model. The one additive backend change (returning the `definition` JSONB from the already-owner-scoped list routes) widens the response BODY of an existing owner-scoped read, not its scope — a caller only sees definitions they were already entitled to list.

## Test Results

- **Plan target suite** (`WorkflowsPage.test.tsx`): **11 passed**, exit 0 — filter re-query (All-projects no param + project select with the id), drafts-above-published DOM order, dashed build-card opens the Builder, no-Run-on-drafts / Run-on-published, client-derived STRICT-vs-LOOSE tier with no extra fetch, the Run modal (folder-chip name not path + one textarea + hint), Run-enabled-on-empty, Run calls `onLaunch(def, kickoff)`, Tweak `createWorkflowDraft(version=N+1, slug, status 'draft')` INSERT (never UPDATE), Tweak opens the Builder.
- **`tsc -p tsconfig.app.json --noEmit`:** ZERO errors in any of the 4 edited files (`WorkflowsPage.tsx`/`.test.tsx`, `ChatLayout.tsx`, `api.ts`); the rot errors reported are all pre-existing in untouched files (SEED-056).
- **Net-new vitest failures = 0 (base-checkout proven):** HEAD = **17 failed / 710 total in 7 files** — the SAME documented-rot set as Plan 04/05's baseline (MessageItem / Plan04.frontend[095] / useMessages / StreamsProvider.dedup / streamsProvider / streamsProvider_075_9_clientkey / model-info), none of which is a file I created or whose tested behavior I changed. My additions are purely additive (+11 GREEN). Delta = 0 new failures.
- **No-router / existing-kickoff-reuse / no-chat-regression contracts:** `grep -rn "react-router\|useNavigate" frontend/src` empty; no code path calls a bespoke `/workflows/{id}/run`; `doRun` uses `createThread` + `postMessage(workflowDefinitionId)`; `git diff a131f05a -- threads.py anthropic_service.py` empty (Deep byte-identical); the `"workflows"` branch is additive before the KnowledgeHealthPage else.
- **Backend additive change:** models validate with/without the field; `_coerce_definition` handles string/dict/None/non-dict; draft-crud unit tests collect (4 tests) — the additive `definition` field does not break the membership-based assertions.

## Self-Check: PASSED

- Both created files exist on disk: `frontend/src/pages/WorkflowsPage.tsx`, `frontend/src/pages/WorkflowsPage.test.tsx` (verified).
- Both task commits exist in git history: `3adcb0ae`, `a2eb5650` (verified; no file deletions in either commit).
- Plan target suite GREEN (11/11); `tsc` clean on all 4 edited files; net-new failures = 0 (17 = 17 documented rot); the no-router / existing-kickoff-reuse / shared-NAV_ITEMS / no-chat-regression / threads.py-byte-identical contracts all honored and grep/test-asserted; the page hosts the Builder + gauntlet with the auto-return-with-Run-CTA.

---
*Phase: 103-workflows-page-authoring-api-nl-authoring*
*Completed: 2026-06-14*
