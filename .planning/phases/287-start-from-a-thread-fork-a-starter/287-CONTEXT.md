# Phase 287: Start From a Thread, Fork a Starter - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning
**Mode:** autonomous. The operator left the session ("I will leave you") and asked for discuss → research → plan → execute end to end. Every decision below was taken by Claude on the recommended option, and each carries its reason so the operator can overturn it. Nothing here is operator-ratified except the ROADMAP text.

<domain>
## Phase Boundary

Two capabilities, nothing else (START-01, START-03):

1. **Start from a thread (START-01).** In an open thread the user picks a published workflow, fills the launch form the workflow declares, and starts it. The run attaches to THAT thread (no new thread). An empty required input is refused with a plain message naming the field, and nothing starts.
2. **Fork a starter (START-03).** At least 5 curated starters are listed, each demonstrably passing the publish gauntlet. One click creates the user's own draft copy, opened in the builder; editing it never changes the starter or anyone else's copy.

Out of scope: inbound/scheduled starts (293), new phase types, a second launch form, any new authoring door, the run page (289).

Seeds sweep (`check-seeds-register.cjs --phase 287`): the script fatals with "no phase directory matches" until the directory exists; re-run after planning. Routed by hand now: **SEED-232 folded** (the form exists, the door does not), **SEED-084 folded** (fork-a-starter library). Both get `status: folded` + `status_note` in this commit.
</domain>

<measured>
## What the code already has (measured 2026-10-19, not inferred)

- `ChatLaunchForm` (214-12) exists; `ChatLayout.doRun` is its only mount and has ONE caller (`WorkflowsPage`). `doRun` ALWAYS calls `createThread(def.name)` first, so reusing it as-is would start the run in a NEW thread, which is the exact failure SC#1 names.
- `postMessage(threadId, content, { workflowDefinitionId, inputs, folderId })` already carries the kickoff. The backend preflight (`workflow_kickoff.preflight_workflow_kickoff`, called from `threads.py` ~1691) is keyed by `thread_id` and rejects only when an anchor is already live (409 "Thread is workflow-locked"). Whether it accepts a kickoff on a thread that already has messages is a RESEARCH question, not an assumption.
- **Required-ness is a MARK, never a block**, by a recorded decision in `LaunchInputFields.tsx` (214.1-01). Its re-open trigger is verbatim: *"the next phase that touches a launcher's confirm control takes the block."* 287 is that phase. `EntryInputField.required` already reads `true` when absent.
- `GET /workflows/starters` and `list_starter_workflows` exist (Phase 143). Selector: `status='published' AND is_system_global AND definition->>'category'='starter'`. Migration `094_starter_workflows.sql` seeded **3** (`risk-register`, `weekly-status-report`, `compliance-gap-report`), each `llm_agent(search_documents) -> llm_emit(render_template)` with `.docx` assets uploaded by `scripts/seed-starters.py` (a SQL migration cannot place Storage bytes).
- Fork exists: `useWorkflowFork` (192.1-03), by-slug draft index, two fork handlers, `onForked` callback to the builder. Starter cards, `StarterTemplatePicker`, `libraryFork.ts` exist. The ROADMAP's "fork" claim must be verified against SC#4 (isolation), not assumed from this.
- Latest migration is `209`. A new seed migration is `210_*`.
- G-5 firing files this phase may touch (read their ledger section first): `ChatLayout.tsx` 61/31/1137 (forecast: "287 reuses ChatLaunchForm + doRun; one prop or one mount"), `ChatArea.tsx` 93/43/1186, `MessageInput.tsx` 41/20/1007, `WorkflowsPage.tsx` 45/18/1447 (forecast: "starters are data, fork reuses its hook; one prop"), `ChatLaunchForm.tsx` 1/1/157.
</measured>

<decisions>
## Implementation Decisions

### Entry point in the thread (START-01)
- **D-01:** The entry is a **"Run a workflow" control beside the composer**, opening a picker of the caller's **published** workflows (the same `/workflows/published` feed the Run modal uses; no new endpoint). Picking one runs the existing `ChatLaunchForm` when the workflow declares inputs, and starts immediately when it declares none. Reason: the user is already in the composer when the thought "I want to run this" arrives; a slash command or a header menu is a second discovery path to maintain.
- **D-02:** The picker and its launch logic live in **NEW modules** (a `ThreadWorkflowPicker` component and a `useStartWorkflowInThread` hook, names at the planner's discretion). The G-5 files take **at most ONE mount and ONE prop each**: ChatArea or MessageInput gets the mount, ChatLayout supplies one callback. No logic is added to those files. Reason: ChatArea, MessageInput and ChatLayout are all G-5 firing; their forecasts promise one prop or one mount.
- **D-03:** **No second launch form.** `ChatLaunchForm` is reused as-is apart from D-06. The collection step (`launchAsk` + the awaiting promise) is shared with `doRun`, not duplicated: extract the "collect declared inputs or return null" step so `doRun` and the in-thread start both call it. The extraction is behaviour-preserving and pinned first (`ChatLayout.launch.test.tsx` and `ChatLayoutLaunch.test.tsx` stay unedited).
- **D-04:** **The run attaches to the current thread.** The in-thread start calls `postMessage(currentThread.id, kickoff, { workflowDefinitionId, inputs })` and never `createThread`. It then follows the same landing as the existing path: read `active_workflow_run_id` from the thread anchor and open the run surface when the canvas flag is on, otherwise stay in the thread. The `workflow_runs.id` vs producer `runs.run_id` trap is real; the anchor read is the only correct source.
- **D-05:** **Disabled, with a reason, when the thread is workflow-locked** (`workflowLocked` already computed in ChatArea). The server 409 stays the authority; the control is a courtesy. The disabled state says why in words ("A workflow is already running in this thread"), same register as the composer placeholder.
- **D-06 (SC#2, takes the 214.1 re-open trigger):** **Required inputs are BLOCKED, not just marked.** One shared pure helper (`missingRequiredFields(fields, values)` returning the labels of empty required fields, trimmed-empty counts as empty) is called by the confirm control. On a miss the form stays open, nothing is posted, nothing is created, and a message names the field in plain words ("Recipient email is required"). The helper reads `required !== false`, matching the server's `InputFieldSpec.required = True` default. Applied to **ChatLaunchForm and the library RunModal** (both are launch confirm controls; refusing in one and not the other would make the same act behave two ways). The **schedule form is deferred** and recorded as such. The doc paragraphs in `LaunchInputFields.tsx` that say "NO REQUIRED-NESS IS VALIDATED" are rewritten in the same commit, since leaving them would make the file contradict itself.
- **D-07:** The agent still fills nothing (D-214-04 stands). The in-thread start reads nothing from the conversation. The existing source fence on `ChatLaunchForm` keeps covering this, and the new picker/hook get the same stripped-source absence assertion with a positive control.

### Starters (START-03)
- **D-08:** **Starters stay data**: `is_system_global`, `published`, `definition.category='starter'` rows in `workflow_definitions`, shipped by a new numbered migration. No new phase type, no engine code (Extension Contract).
- **D-09:** **Add at least 2 new starters to reach 5, built from existing phase types**, with real content (a real `business_requirement`, real prompts, a real emit phase), not fixtures. Candidate subjects, chosen for being grounded in a user's own knowledge base and needing no connector or external credential: *meeting-notes-to-actions*, *policy-change-impact*, *stakeholder-update-from-kb*. The planner picks two or more after reading what the gauntlet accepts. A starter that cannot be made to pass is dropped, not loosened.
- **D-10:** **"Passes the gauntlet" is shown by RUNNING it.** A test (backend, DB-free where possible) drives each starter's definition through the same publish validation the Builder uses and asserts the verdict per starter, with a **planted-defect counterfactual** (a starter with a deliberately broken phase must fail) so the test is not vacuous. If the existing 3 do not pass today, that is a finding to fix in this phase, because the count only includes passing starters. The list endpoint counts only starters that pass: a failing row is excluded from the shelf by a test, not by hand.
- **D-11:** **Starter content must not need a Storage upload the migration cannot place.** Prefer emit paths that do not require a seeded `.docx` template; if a template asset is unavoidable, extend `scripts/seed-starters.py` and record the operator step. The migration is applied per the project rule (paste into the SQL editor, never `db push/reset`), then `bash scripts/regenerate-full-schema.sh`. Cloud parity (paste into the cloud SQL editor) is an **operator step recorded in the phase summary**, not something Claude does.
- **D-12 (SC#4):** **Fork isolation is proven by a test that edits the draft and re-reads the starter.** The fork INSERTs a new row owned by the caller (new id, new slug/version in the caller's namespace, `is_system_global=false`, `status='draft'`, `category` marker dropped so a user's copy never appears on the shelf), and the starter row and a second user's copy are byte-unchanged after the edit. If the existing fork path shares a row or copies the `starter` marker, fixing that is in scope.
- **D-13:** One click means one click: the starter card's Fork action creates the draft and opens it in the builder, no naming dialog in the way of the first fork. A name collision is resolved by the existing slug/version mechanics (`useWorkflowFork`), not a new dialog. The card shows what the starter produces in words the vocabulary already has (`libraryVocabulary`), added as data, not logic.

### Proof (cross-provider, SC#5)
- **D-14:** SC#5 is a live drive: one native provider plus OpenRouter, with a **two-tool prompt** and a **parallel-thread row** (thread A streaming while thread B starts a workflow). The remaining native roster rows are **recorded owed (⛔ with reason), never silently omitted**. Operator is away, so the drive uses the local dev environment and per-request `model`+`provider` on `POST /threads/{id}/messages`, reading verdicts from `workflow_runs` / `workflow_phases`; no global setting is mutated. If a key is missing, the row is recorded ⛔ with the blocking reason.
- **D-15 (G-4 failure scenarios, written by Claude at scope time because the operator is away; the operator may replace them):** the phase fails if, in a real browser as the user,
  1. picking a workflow in an open thread leaves the thread list one longer, or the run shows up under a different thread title;
  2. pressing Run with an empty required field starts anything (a run row, a thread, a message) or shows an id or a generic error instead of the field's name;
  3. forking a starter, editing the copy's name and a prompt, then re-opening the shelf shows the starter changed, or a second fork shows the first fork's edits.
  Chrome MCP drives all three at verification; wire format plus a screenshot is not enough.
- **D-16 (G-2 override, audited):** the guardrail asks for `/gsd:sketch` of the in-thread entry and the starter picker before discuss. **It was not run:** the operator is away and asked for autonomous completion, and both surfaces reuse shipped vocabulary (the `RunModal`/`ChatLaunchForm` shell, the Starters shelf card, the composer toolbar) with no new visual element. Recorded under `STATE.md → Guardrail overrides`. The UI is built from the sketch-findings skill's existing contracts; the G-4 drive is the visual acceptance bar.

### Claude's Discretion
- Names of the new modules, the picker's exact placement within the composer area, and which two or more starter subjects ship.
- Whether `missingRequiredFields` lives beside `soulData.ts`'s `EntryInputField` or in `LaunchInputFields.tsx`.
- Whether the starter "what it produces" line is a vocabulary entry or comes from the definition's own `business_requirement`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` -> "Phase 287: Start From a Thread, Fork a Starter" (goal, SC#1-5, failure conditions, flags)
- `.planning/REQUIREMENTS.md` -> START-01, START-03
- `.planning/seeds/SEED-232-*.md` (entry point missing), `.planning/seeds/SEED-084-*.md` (starter library)
- `.planning/phases/286-seams-before-features/286-CONTEXT.md` (the seams 287 builds on; the ledger forecasts for 287)

### Code to read before touching
- `frontend/src/components/layout/ChatLaunchForm.tsx`, `ChatLayout.tsx` (`doRun`, `launchAsk`, lines ~325-495)
- `frontend/src/components/workflows/LaunchInputFields.tsx` (the 214.1-01 re-open trigger, lines 55-85), `soulData.ts` (`EntryInputField`, `launchInputFields`)
- `frontend/src/components/workflows/library/RunModal.tsx`, `useWorkflowFork.ts`, `libraryFork.ts`, `WorkflowCard.tsx`, `StarterTemplatePicker.tsx`
- `frontend/src/lib/api/threads.ts` (`postMessage`, ~733-770), `frontend/src/components/chat/ChatArea.tsx` (`workflowLocked`, ~170-230), `MessageInput.tsx`
- `backend/app/services/workflow_kickoff.py` (`preflight_workflow_kickoff`), `backend/app/api/threads.py` (~1670-1700)
- `backend/app/api/workflows.py` (`/starters`, `/published`), `backend/app/db/workflows.py` (`list_starter_workflows`), `supabase/migrations/094_starter_workflows.sql`, `scripts/seed-starters.py`
- `backend/app/services/harness/publish_service.py` (what "passes the gauntlet" means in code)

### Ledger (read each touched file's section; update rows + sections in the SAME commit)
- `docs/HOT-FILE-LEDGER.md` -> `ChatLayout.tsx`, `ChatArea.tsx`, `MessageInput.tsx`, `WorkflowsPage.tsx`, `ChatLaunchForm.tsx`, `WorkflowCard.tsx`, `workflows.py`, `db/workflows.py`
- `CLAUDE.md` -> G-2, G-4, G-5, G-8, UAT scoreboard recipe, "Supabase MCP" rule (reads free, writes gated)

### Skills
- `Skill("sketch-findings-agentic-rag")` before building the picker or the starter card
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatLaunchForm` + `LaunchInputFields` + `launchInputFields(def)`: the form, the shared leaf, the declared-fields projection.
- `useWorkflowFork` + `onForked`: the fork handlers and the single callback that threads the builder's concurrency token.
- `list_starter_workflows` / `GET /workflows/starters`: the shelf feed, already RUN-CARVE-OUT documented (do not gate).
- `getThreadWorkflow(threadId)`: the anchor read that yields the correct `workflow_runs.id`.

### Established Patterns
- Characterization pin first, extraction second (192.2-02, 193.1-05, 286).
- A cancelled launch creates nothing; a failed post-create launch cleans up its thread (WR-04). The in-thread path creates no thread, so it needs no orphan cleanup, only an error surface.
- Fences read stripped source with a positive control; a comment can neither satisfy nor break them.

### Integration Points
- ChatArea knows `thread` and `workflowLocked`; ChatLayout owns `doRun`, `launchAsk`, `canvasEnabled`, `onNavigate`, `setActiveRunId`.
- Route ordering: `/starters` is a static segment before `/{definition_id}`; keep it.
</code_context>

<specifics>
## Specific Ideas

- The control's label is the verb the user would say: **Run a workflow**. The picker lists name plus the one-line requirement the library card already shows.
- Empty-state of the picker (no published workflows): say so and point to the Workflows page, never a blank list.
</specifics>

<deferred>
## Deferred Ideas

- Required-ness block on the **schedule form** (293 owns scheduled starts; re-open when 293 touches that confirm control).
- Slash-command entry (`/run`) in the composer: a second discovery path, not needed for START-01.
- Starter versioning/updates pushed to forks, and a community/org starter catalogue: out of scope, belongs with the ecosystem direction.
- Agent-suggested workflow ("this looks like the risk register workflow"): rejected by D-214-04's trust argument; not revisited here.
</deferred>

---

*Phase: 287-start-from-a-thread-fork-a-starter*
*Context gathered: 2026-10-19 (autonomous)*
