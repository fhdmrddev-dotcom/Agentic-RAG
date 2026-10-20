# Phase 287: Start From a Thread, Fork a Starter - Research

**Researched:** 2026-10-19
**Domain:** In-thread workflow launch (React + StreamsProvider + FastAPI kickoff preflight), launch-form required-field block, curated starter workflows as seeded data, fork isolation
**Confidence:** HIGH on code facts (every claim below carries a file:line read in this session or a driven script). MEDIUM on UX landing choices (no operator sketch exists, see C6). LOW only where tagged `[ASSUMED]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md is **autonomous-mode**: every decision below was taken by Claude on the recommended option, none is operator-ratified except the ROADMAP text. They are locked for planning unless this research shows the code contradicts them; the contradictions are in the next section so the planner can resolve them explicitly rather than inherit them.

### Locked Decisions (verbatim, abridged only where marked)

- **D-01:** The entry is a **"Run a workflow" control beside the composer**, opening a picker of the caller's **published** workflows (the same `/workflows/published` feed the Run modal uses; no new endpoint). Picking one runs the existing `ChatLaunchForm` when the workflow declares inputs, and starts immediately when it declares none.
- **D-02:** The picker and its launch logic live in **NEW modules** (a `ThreadWorkflowPicker` component and a `useStartWorkflowInThread` hook, names at the planner's discretion). The G-5 files take **at most ONE mount and ONE prop each**: ChatArea or MessageInput gets the mount, ChatLayout supplies one callback. No logic is added to those files.
- **D-03:** **No second launch form.** `ChatLaunchForm` is reused as-is apart from D-06. The collection step (`launchAsk` + the awaiting promise) is shared with `doRun`, not duplicated: extract the "collect declared inputs or return null" step so `doRun` and the in-thread start both call it. The extraction is behaviour-preserving and pinned first (`ChatLayout.launch.test.tsx` and `ChatLayoutLaunch.test.tsx` stay unedited).
- **D-04:** **The run attaches to the current thread.** The in-thread start calls `postMessage(currentThread.id, kickoff, { workflowDefinitionId, inputs })` and never `createThread`. It then follows the same landing as the existing path: read `active_workflow_run_id` from the thread anchor and open the run surface when the canvas flag is on, otherwise stay in the thread. The `workflow_runs.id` vs producer `runs.run_id` trap is real; the anchor read is the only correct source.
- **D-05:** **Disabled, with a reason, when the thread is workflow-locked** (`workflowLocked` already computed in ChatArea). The server 409 stays the authority; the control is a courtesy. The disabled state says why in words ("A workflow is already running in this thread").
- **D-06 (SC#2, takes the 214.1 re-open trigger):** **Required inputs are BLOCKED, not just marked.** One shared pure helper (`missingRequiredFields(fields, values)` returning the labels of empty required fields, trimmed-empty counts as empty) is called by the confirm control. On a miss the form stays open, nothing is posted, nothing is created, and a message names the field in plain words ("Recipient email is required"). The helper reads `required !== false`. Applied to **ChatLaunchForm and the library RunModal**. The **schedule form is deferred** and recorded as such. The doc paragraphs in `LaunchInputFields.tsx` that say "NO REQUIRED-NESS IS VALIDATED" are rewritten in the same commit.
- **D-07:** The agent still fills nothing (D-214-04 stands). The existing source fence on `ChatLaunchForm` keeps covering this, and the new picker/hook get the same stripped-source absence assertion with a positive control.
- **D-08:** **Starters stay data**: `is_system_global`, `published`, `definition.category='starter'` rows in `workflow_definitions`, shipped by a new numbered migration. No new phase type, no engine code.
- **D-09:** **Add at least 2 new starters to reach 5, built from existing phase types**, with real content (a real `business_requirement`, real prompts, a real emit phase). Candidates: *meeting-notes-to-actions*, *policy-change-impact*, *stakeholder-update-from-kb*. A starter that cannot be made to pass is dropped, not loosened.
- **D-10:** **"Passes the gauntlet" is shown by RUNNING it.** A test (backend, DB-free where possible) drives each starter's definition through the same publish validation the Builder uses and asserts the verdict per starter, with a **planted-defect counterfactual**. If the existing 3 do not pass today, that is a finding to fix in this phase. The list endpoint counts only starters that pass: a failing row is excluded from the shelf by a test, not by hand.
- **D-11:** **Starter content must not need a Storage upload the migration cannot place.** Prefer emit paths that do not require a seeded `.docx` template; if a template asset is unavoidable, extend `scripts/seed-starters.py` and record the operator step. Migration applied per project rule (SQL editor, never `db push/reset`), then `bash scripts/regenerate-full-schema.sh`. Cloud parity is an **operator step recorded in the phase summary**.
- **D-12 (SC#4):** **Fork isolation is proven by a test that edits the draft and re-reads the starter.** The fork INSERTs a new row owned by the caller (new id, new slug/version in the caller's namespace, `is_system_global=false`, `status='draft'`, `category` marker dropped so a user's copy never appears on the shelf), and the starter row and a second user's copy are byte-unchanged after the edit. If the existing fork path shares a row or copies the `starter` marker, fixing that is in scope.
- **D-13:** One click means one click: the starter card's Fork action creates the draft and opens it in the builder, no naming dialog in the way of the first fork. A name collision is resolved by the existing slug/version mechanics (`useWorkflowFork`), not a new dialog. The card shows what the starter produces in words the vocabulary already has (`libraryVocabulary`), added as data, not logic.
- **D-14:** SC#5 is a live drive: one native provider plus OpenRouter, with a **two-tool prompt** and a **parallel-thread row**. The remaining native roster rows are **recorded owed (blocked with reason), never silently omitted**. Per-request `model`+`provider` on `POST /threads/{id}/messages`, verdicts from `workflow_runs` / `workflow_phases`; no global setting mutated.
- **D-15 (G-4 failure scenarios):** the phase fails if, in a real browser as the user, (1) picking a workflow in an open thread leaves the thread list one longer, or the run shows under a different thread title; (2) pressing Run with an empty required field starts anything (run row, thread, message) or shows an id or generic error instead of the field's name; (3) forking a starter, editing the copy's name and a prompt, then re-opening the shelf shows the starter changed, or a second fork shows the first fork's edits. Chrome MCP drives all three.
- **D-16 (G-2 override, audited):** `/gsd:sketch` was not run; both surfaces were asserted to reuse shipped vocabulary. Recorded under `STATE.md -> Guardrail overrides`.

### Claude's Discretion
- Names of the new modules, the picker's exact placement within the composer area, and which two or more starter subjects ship.
- Whether `missingRequiredFields` lives beside `soulData.ts`'s `EntryInputField` or in `LaunchInputFields.tsx`.
- Whether the starter "what it produces" line is a vocabulary entry or comes from the definition's own `business_requirement`.

### Deferred Ideas (OUT OF SCOPE)
- Required-ness block on the **schedule form** (293 owns scheduled starts).
- Slash-command entry (`/run`) in the composer.
- Starter versioning/updates pushed to forks, and a community/org starter catalogue.
- Agent-suggested workflow (rejected by D-214-04's trust argument).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| START-01 | From inside a thread, start a workflow, fill its launch form, see the run attached to that thread | Q1 (server accepts a kickoff on a non-empty thread), Q2 (the only correct client path is `StreamsProvider.sendMessage`, which needs `inputs` plumbing), Q3 (mount point), Q4 (required block) |
| START-03 | Fork a starter in one click; at least 5 curated starters each passing the publish gauntlet | Q5 (static gauntlet is DB-free and driven; 3 new definitions verified), Q6 (fork is an INSERT; it is NOT one click today), Q7 (migration 210) |
</phase_requirements>

## Summary

The server side of START-01 already works: `preflight_workflow_kickoff` refuses only on a live anchor (409), the kill switch (403), the tier entitlement, and an unresolvable/foreign definition. It does not look at message count, title or mode, and `send_message` re-points the thread anchor via `create_workflow_run`. Auto-title only fires while `threads.title == "New Chat"`, so an already-titled thread keeps its title. So the "same thread" half of SC#1 needs **no backend change**.

The client side is where CONTEXT is wrong in a way that would ship a visibly broken feature. A raw `postMessage(thread.id, ...)` writes the user message and the run on the server, but the open `ChatArea` shows none of it: the message list is only refreshed by `loadMessages`/`reconcile`, the per-thread workflow lock is only reconciled in an effect keyed on `thread?.id` (ChatArea.tsx:372-442), and nothing subscribes to the new run's stream. The path that does all of that correctly (optimistic user bubble, zero assistant nodes for a harness kickoff, `harnessKickoffThreads` mark, lock seed, SSE subscribe, 409/403 rollback arms) is `StreamsProvider.sendMessage` (StreamsProvider.tsx:2616-3140), and it already special-cases `workflowDefinitionId`. Its only gap is that it does not forward `inputs` to `postMessage` (StreamsProvider.tsx:2749-2757; streamsStore.ts:333-349). That is a two-line widening, not a new mechanism.

Starters: the 3 shipped ones pass every static publish stage today (driven in this session), and three new template-less definitions also pass, each with planted-defect counterfactuals that fail. But "the gauntlet" has two LIVE stages (a real golden run and a judge) that cannot run DB-free or model-free, so D-10 must define precisely what a test proves and what a live drive proves. The fork is a plain INSERT (isolation holds by construction) but it goes through a mandatory name dialog (192.1-07 D-19), so "one click" in SC#4 and D-13 contradicts shipped, tested, operator-ratified behaviour.

**Primary recommendation:** Build the entry as one new component mounted once in `ChatArea` that calls `useStreamActions().sendMessage` (widened by one `inputs` field) and owns its own `ChatLaunchForm` instance; touch neither `ChatLayout` nor `doRun`. Stay in the thread after launch (the run line and panel are the run's doors). Ship three template-less starters ending in `llm_single` with citation + section validators, prove the static stages with a DB-free test, and resolve the fork-dialog contradiction explicitly before planning.

## CONTEXT.md Decisions the Code Contradicts (most valuable findings)

| # | Decision | What the code says | Severity | Recommended resolution |
|---|----------|--------------------|----------|------------------------|
| C1 | D-04: call raw `postMessage(currentThread.id, ...)` then read the anchor and navigate | Raw `postMessage` leaves the open thread stale: no user bubble, no lock, no stream. `StreamsProvider.sendMessage` is the attach path but drops `inputs`. It also **awaits the whole SSE stream** (`await subscribeToRun`, StreamsProvider.tsx:3031-3033), so "await send, then read the anchor, then navigate" cannot work. | BLOCKER if followed literally | Widen `sendMessage` opts by `inputs` (type at streamsStore.ts:333-349, one passthrough at StreamsProvider.tsx:2749-2757). Call it un-awaited (`void`). Do not navigate; stay in the thread (see C1b). |
| C1b | D-04: "open the run surface when the canvas flag is on" | The thread already carries the run's doors: `ThreadRunLine` is mounted by `MessageList.tsx:275`, the panel exposes open-run via `onOpenRun={canvasEnabled ? openRunSurface : undefined}` (ChatLayout, pinned by a regex at ChatLayout.launch.test.tsx:482). SC#1 says "the run appears attached to that same thread", which staying satisfies more literally than navigating away. | Design | Stay in thread. This also removes the `workflow_runs.id` vs `runs.run_id` trap entirely (nothing is navigated with an id). |
| C1c | D-02/D-03: ChatLayout supplies a callback; extract the collect step from `doRun` | Unnecessary if the picker owns a local `ChatLaunchForm` instance. `doRun` and `launchAsk` are untouched, so `ChatLayout.tsx` (G-5 firing, 1137 L) takes **zero** edits and the stripped-source fences at ChatLayout.launch.test.tsx:836-862 (`opts?.inputs === undefined`, `createThread(def.name)` order) cannot be disturbed. | Simplification | Skip the extraction. The ledger forecast ("one prop or one mount") is met with zero ChatLayout edits. |
| C2 | D-13: no naming dialog; fork is one click | Shipped fork is: card `⋯` menu item "Make my own copy" (`FORK_VERB`, libraryVocabulary.ts:82; WorkflowCardMenu.tsx:284-291) -> `ForkNameDialog` (field opens EMPTY by design, primary "Create my copy", only emptiness blocks) -> create. Operator-ratified in 192.1-07 (D-19/D-20) and pinned by `ForkNameDialog.test.tsx` and WorkflowCard docblocks. ROADMAP SC#4 says "One click". | Spec conflict | See Open Question 1. Recommended: keep the dialog (reverting a ratified, tested decision autonomously is the riskier error), define SC#4's "one click" as "one decision, no wizard", record the deviation, and flag it for the operator. The alternative (skip the dialog for `kind: "starter"` only, name = starter name) is a small change in `confirmFork`/`onForkStarter` but re-opens D-19 and its tests. |
| C3 | D-12: drop the `category` marker from the copy | `createFromStarter` says in code: "`def` may carry `category:"starter"` ... do NOT strip it from the fork body" (useWorkflowFork.ts:367-368), and `WorkflowDefinition.category` exists precisely so the round-trip does not 422 (harness.py:728-736). The local DB shows two non-global rows carrying `category='starter'` (`sc10-multitool-84c452`, `slack-connector-uat-190`). They are NOT on the shelf because the selector also requires `is_system_global = true` (db/workflows.py:871-872) and `create_workflow_definition` binds `is_system_global=false` literally (db/workflows.py:1030-1031). | Wrong premise, harmless | Do not strip. The isolation test should assert the real boundary: forked row has `is_system_global=false`, `created_by=caller`, new id, new slug, `status='draft'`, and `list_starter_workflows` still returns exactly the curated set. |
| C4 | D-10: "run the gauntlet" DB-free | Publish is stages 0-5 (publish_service.py docstring :4-16): load row, business_requirement, lint, interactive, grounding (2.6), **a real golden run on the project KB**, **an LLM judge verdict**, flip. Stages 3-4 need a DB, a provider key and minutes. Only stages 1, 2, 2.5, 2.6 are static. | Scope | Define "passes" as: static stages proven by test (below) AND stages 3-4 proven by one live golden run per NEW starter recorded in VERIFICATION. If a live run is not possible, record that row owed; never claim it. |
| C5 | D-11 + D-09: avoid `.docx` upload "if possible" | `llm_emit`'s **only** registered emitter is `render_template` (emitters.py:183-188), which needs a bound `.docx` in Storage. There is no template-less emit. The template-less route is `llm_agent -> llm_single` (the mig 061 `research_summarize` shape). Consequence: new starters answer **in chat** (`soulDeliverable` -> `kind: "chat"`), not as a file. | Design | Ship the new starters as chat-answer workflows; say so on the card via `soulDeliverable`, never fabricate a file deliverable. |
| C6 | D-01/D-16: "Run a workflow" control beside the composer; no new visual element | Sketch 011 (composer-and-mode.md D2) **removed the workflow picker from the composer by design**; its anti-pattern list says "do not re-add a 'pick workflow' composer affordance whose absence silently downgrades a send to a Deep turn" (composer-and-mode.md:171). The three-homes contract puts Library+Launch on the Workflows page (app-information-architecture.md D1). A G-2 override waives running the sketch, not the recorded contract. | Design risk | Keep D-01 (SC#1 requires an in-thread entry) but make it satisfy the anti-pattern by construction: it is an **action button, not a mode pill**; it holds no composer state; every launch posts `workflow_definition_id`; the server lock is the authority. Record the reason in STATE Guardrail overrides and put placement up for operator ratification after the fact. |
| C7 | D-03: "ChatLayout.launch.test.tsx and ChatLayoutLaunch.test.tsx stay unedited" vs D-06 | D-06 makes three cases in `ChatLayout.launch.test.tsx` red and one in `RunModal.test.tsx` (list in Q4). `ChatLayoutLaunch.test.tsx` is unaffected (its def declares only the reserved `kickoff_prompt`, so `launchInputFields` is empty). With C1c the extraction never happens, but the D-06 test edits do. | Spec self-conflict | The edits are deliberate and reasoned (Q4). Edit in place, never delete a case: `vitest-count-gate.cjs` pins `ChatLayout.launch.test.tsx: 17` (line 1724) and `RunModal.test.tsx: 40` (line 2279), no per-file decrease. |
| C8 | (silent in CONTEXT) what is the kickoff text | `MessageCreate.content` has no minimum length (message.py:52), but it is persisted as the **visible user message** (threads.py:1721-1726) and becomes `inputs.kickoff_prompt`, the first phase's user turn (threads.py:1936). `ChatLaunchForm` has no kickoff field; `RunModal` does. An empty content makes an empty user bubble. | Gap | See Open Question 2. Recommended: content = `Run ${def.name}` (honest, non-empty, never invented from the conversation). |
| C9 | D-09 implicit: starters could declare inputs to exercise the form | Declared `inputs` are consumed by `external_action` `ask` arguments, not interpolated into `llm_agent`/`llm_single` prompts (prompt interpolation covers only `{{prior_run.*}}`, phase_types.py:216-246). A starter declaring a required input that nothing reads would be a control that lies. | Design | Starters declare **no** `inputs`. SC#2 and G-4 scenario 2 are driven on a throwaway local published fixture row that declares a required input (Q8). |
| C10 | D-10: "list endpoint counts only starters that pass" | No code gates the list on any verdict; `list_starter_workflows` is a pure SQL predicate. The only mechanism is a test pinning the migration's set. | Wording | Pin the starter set in a test derived from the migration file (precedent: `test_269_starter_evidence_gate.py`), not from a runtime filter. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authoritative "may this thread start a workflow" | API / Backend (`preflight_workflow_kickoff`) | Browser (courtesy disable) | Server 409 is the lock; UI disable (D-05) is only a courtesy. |
| Required-field refusal (SC#2) | Browser (launch confirm controls) | API (not enforced today) | There is **no server predicate** for required launch inputs; 214.1's "second copy of a server predicate" argument is false for this case. Client block satisfies SC#2; server enforcement is optional hardening (Open Question 4). |
| Attaching a run to the open thread | Browser store (`StreamsProvider.sendMessage`) | API (`send_message`) | Only the provider owns the bucket, lock, kickoff mark and SSE subscription. |
| Starter content | Database (migration seed rows) | — | Extension Contract: data, not code. |
| Starter validity | API (static publish stages, pure functions) | Live provider (golden run + judge) | Static stages are pure; stages 3-4 are LIVE-only by design. |
| Fork isolation | Database (INSERT with server-bound `is_system_global=false`, `created_by`) | API route gates | Isolation is structural: a new row, never an UPDATE of a published row (immutability trigger). |

## Standard Stack

No new packages. Everything below is already in the repo.

### Core
| Library / module | Version | Purpose | Why standard |
|---|---|---|---|
| React + Vitest + Testing Library (frontend) | repo-pinned | UI + tests | Existing suites; do not add test infra. |
| FastAPI + asyncpg + pytest (`asyncio_mode = auto`, `testpaths = tests`) | repo-pinned | Backend + tests | backend/pytest.ini read. |
| `WorkflowDefinition`, `lint_workflow`, `grounding.grounding_verdicts`, `publish_service._interactive_phase_failures`, `grounding.business_requirement_missing` | in-tree | The static publish stages, called directly | Same functions `POST /workflows/validate` and `publish_workflow` call (workflows.py:885-947; publish_service.py:163-274). |

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|---|---|---|
| `StreamsProvider.sendMessage` + `inputs` field | raw `postMessage` + manual `loadMessages`/lock/`subscribe` | Re-implements ~500 lines of attach logic and its rollback arms in a new module; reject. |
| Template-less `llm_agent -> llm_single` starters | `llm_emit(render_template)` with new `.docx` assets | Needs Storage uploads a migration cannot place, extends `seed-starters.py`, and an operator step per environment. Only if a file deliverable is a product requirement. |

**Installation:** none. **Package Legitimacy Audit:** not applicable. This phase installs no external packages (slopcheck not run). **Packages removed / flagged:** none.

## Architecture Patterns

### System Architecture (in-thread start)

```
User in open thread T  (ChatArea mounts <ThreadWorkflowPicker thread=T locked=workflowLocked>)
   |
   | click "Run a workflow"  -> (lazy) listPublishedWorkflows()  [fetch on OPEN only, never on mount]
   v
 pick def D
   |-- launchInputFields(D.definition) empty? -----yes----> start(D, {})
   |                                                  
   '-- non-empty -> local <ChatLaunchForm fields=...>   (own state; cancel => nothing created)
            |  confirm -> missingRequiredFields(fields, values)
            |       non-empty -> form stays open, message names the field(s); NOTHING posted
            |       empty     -> start(D, values)
            v
 start(D, inputs) = actions.sendMessage(T.id, kickoffText, {workflowDefinitionId: D.id, inputs, surfaceId:"chat"})   [void, un-awaited]
   |
   v  StreamsProvider.sendMessage (existing, widened by `inputs`)
      optimistic user bubble; NO assistant node (harness gate :2708); harnessKickoffThreads mark
      -> POST /threads/T/messages {workflow_definition_id, inputs}
            server: preflight (409 live anchor / 403 kill switch / entitlement / def resolve)
                    INSERT user message; register_run_start; create_workflow_run(+anchor, atomic); title untouched
      -> setWorkflowLockForThread(T, harness)  -> composer locks, ThreadRunLine goes live
      -> subscribeToRun(run_id)   (awaited inside sendMessage until terminal)
   |
   v  errors: 409 lock -> rolled back + fixed banner; 403 -> amber blockedNotice node; other ApiError -> rollback + failedSendDrafts
```

### Recommended Project Structure
```
frontend/src/components/chat/ThreadWorkflowPicker.tsx     # the single new mount; owns picker + local ChatLaunchForm
frontend/src/components/chat/useStartWorkflowInThread.ts  # list-on-open, collect, validate, sendMessage
frontend/src/components/workflows/soulData.ts             # + missingRequiredFields (pure) [discretion]
supabase/migrations/210_starter_workflows_v2.sql          # 3 template-less starters
scripts/apply_migration_210.py                            # throwaway local apply, precedent 207/208/209
backend/tests/unit/test_287_starter_static_gauntlet.py    # DB-free
```

### Pattern 1: Mount once in ChatArea's `inputBar`, not in MessageInput
**What:** `ChatArea.inputBar` is a fragment `<> {expertChangeError} <MessageInput .../> </>` (ChatArea.tsx:795-893). Add one sibling element above `<MessageInput>`, rendered only when `thread` exists. **Why not MessageInput:** its only slot, `scopeSlot`, renders inside the "Using:" chips row (MessageInput.tsx:521-538) which is for context chips, and a launch action there reads as a scope. MessageInput is 1007 L, G-5 firing. **When:** `thread != null`; hide on the welcome screen (no thread to attach to).
**Props to the picker:** `thread` (id + title), `locked={workflowLocked}` (already computed at ChatArea.tsx:226). No new prop on ChatArea, no ChatLayout edit.

### Pattern 2: Fetch on open, not on mount
Existing ChatArea/MessageItem suites fence "ZERO `getThreadWorkflow` calls on the Deep path" (MessageItem.tsx:236-247). A mount-time `listPublishedWorkflows()` in every chat would add a request to every thread view and trip those fences. Fetch when the control is opened.

### Pattern 3: Required-field block as one pure helper
```ts
// soulData.ts (pure leaf; NOT in LaunchInputFields.tsx, which has a fenced "exactly TWO imports / ONE export" shape,
// LaunchInputFields.test.tsx:271-298)
export function missingRequiredFields(fields: EntryInputField[], values: Record<string, string>): EntryInputField[] {
  return fields.filter((f) => f.required !== false && (values[f.key] ?? "").trim() === "")
}
```
The refusal names the field with the two-arm rule: authored `label` if present, else the bare `key` (never a fabricated friendly name; LaunchInputFields.tsx:13-26). Compose the sentence in ONE place. If it goes in `argumentVocabulary.ts`, the pin `FLAT_ID_COUNT = 20` / `COMPOSED_ID_COUNT = 5` (argumentVocabulary.test.ts:71-72) and the sketch table (:80-101) must be edited deliberately in the same commit; if it goes beside the helper in `soulData.ts` there is no pin to move (recommended).

### Anti-Patterns to Avoid
- **Raw `postMessage` for the in-thread start** (C1). The thread would look unchanged until reload.
- **`await`-ing `sendMessage` before doing anything else**: it resolves only at stream end.
- **Mount-time fetch** in `ChatArea` (Pattern 2).
- **Adding `required` to `LaunchInputFields`** (`input.required` must stay `false`: LaunchInputFields.test.tsx:259-269 asserts a non-blocking leaf; the block belongs in the confirm controls).
- **Block on `kickoff_prompt`/`folder_id`**: they are reserved and stripped (soulData.ts:261-281); `launchInputFields` already excludes them.
- **Putting a workflow-mode pill in the composer** (C6).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Attaching a run to an open thread | A second send path | `actions.sendMessage` (+`inputs`) | Owns optimistic bubble, harness gate, lock, SSE, 409/403/network arms. |
| The launch form | A second form | `ChatLaunchForm` + `LaunchInputFields` | Roadmap flag and D-03. |
| "Which workflows may I run" | New endpoint | `listPublishedWorkflows()` (`GET /workflows/published`) | Owner-or-global scoped by RLS-mirroring predicate (threads.ts:1885-1916). Includes global starters and, locally, the dev scaffolds; acceptable. |
| Static gauntlet verdicts | Re-implementing lint/grounding | Call `lint_workflow`, `grounding_verdicts`, `_interactive_phase_failures`, `business_requirement_missing` | One copy of every rule (workflows.py:885-947). |
| Fork | A new fork route | `useWorkflowFork` -> `createWorkflowDraft` | INSERT-only, server-bound invariants. |
| Starter storage placement | Migration SQL for bytes | avoid assets (C5); else `seed-starters.py --upload` | SQL cannot place Storage bytes. |

## Runtime State Inventory

Not a rename/refactor phase. Omitted. (Seeded rows are additive; no existing string changes.)

## Common Pitfalls

### Pitfall 1: Seed migration INSERT column name and `org_id`
**What goes wrong:** copying 094's INSERT (`is_global`, no `org_id`) fails: `is_global` was renamed to `is_system_global` in migration 111 (111_is_global_retirement_rename.sql:71), and `workflow_definitions.org_id` is `NOT NULL` (full-schema.sql:4185).
**How to avoid:** column list `(id, slug, version, name, status, definition, created_by, is_system_global)` with `created_by = '00000000-0000-0000-0000-000000000001'`. `org_id` is filled by `workflow_definitions_autofill_org_id` (BEFORE INSERT, `autofill_org_id_by_owner('created_by')`, full-schema.sql:6973) from the seed user's `org_members` row. Verified locally: seed user has exactly one membership (org `430bffc6-...`), and the 3 existing starters carry it. Add a guard that RAISEs a named exception if the seed user has no membership, so a bare box fails loudly with a cause instead of a bare NOT NULL error.
**Warning signs:** `null value in column "org_id"` on apply.

### Pitfall 2: Slug uniqueness is GLOBAL and `ON CONFLICT (id)` does not catch it
`UNIQUE(slug, version)` is global across users (094 header). A user in prod who already owns a draft/published `meeting-notes-to-actions` v1 makes the migration fail 23505 even with `ON CONFLICT (id) DO NOTHING`. **Mitigation:** before the operator pastes it into cloud, run a read-only check for the three slugs (Supabase MCP reads are free per CLAUDE.md; I did not have that tool in this session, so this check is OWED to the planner/executor). Pick slugs the 6-char fork suffix cannot collide with (forks are `<slug>-<6 chars>`).

### Pitfall 3: Published rows are immutable
`workflow_definitions_block_published` raises 23514 on UPDATE of a published row (094 header). Starter wording fixes after release need a NEW slug or version, never an UPDATE. Get the prompts right before applying; mention in the migration header.

### Pitfall 4: `seed-starters.py --validate-migration` crashes on asset-less starters
Its success print dereferences `d['assets'][0]['asset_id']` (scripts/seed-starters.py:208). A template-less starter has no `assets`; pointing the validator at 210 raises `KeyError`. The validator also asserts only `model_validate` + the D-143-4b transforms, **not** the publish stages. Either fix line 208 (`(d.get("assets") or [{}])[0].get(...)`) or do not run it against 210. Its `STARTERS` upload dict is hard-coded to 3 slugs, fine because 210 has no assets.

### Pitfall 5: A fresh box never gets starters (pre-existing parity gap)
`094_starter_workflows.sql` is NOT in the `docs/OPERATOR.md` Step-3 seed list (the 14 listed files, OPERATOR.md:198-224). CLAUDE.md's deployment-artifact rule requires a seed-bearing migration to update that list in the same commit (and `scripts/check-deploy-drift.sh` check 2 greps filenames from that doc, soft-warning on candidates above the highest listed). **Action:** add 210 (and decide whether to add 094, noting 094's assets need `seed-starters.py --upload`, which is why template-less 210 is simpler to ship). Update the "14" wording.

### Pitfall 6: `sendMessage` failure arms write the kickoff text into the composer
A non-409/403 `ApiError` stashes `content` in `failedSendDrafts` (StreamsProvider.tsx:3110-3116), which ChatArea prefills into the composer (ChatArea.tsx:876). With `content = "Run <name>"` a failed launch drops that sentence into the person's composer. Acceptable but note it; do not "fix" it in StreamsProvider (G-5, ⛔ ledger).

### Pitfall 7: Locked-thread double fire
The control disables on `workflowLocked` (harness-mode lock only, ChatArea.tsx:226). Between click and POST return the lock is not yet seeded, but `sendMessage` marks `harnessKickoffThreads` synchronously (StreamsProvider.tsx:2721-2723) and has its per-thread re-entrancy guard (`sendingThreadsRef`, :2624). Disable the control while the hook's own `starting` flag is true as well.

### Pitfall 8: Test-count gate and adoption
`scripts/vitest-count-gate.cjs` pins per-file counts; new test files are not counted until adopted into `TARGETS` ("sources not in TARGETS" lesson in project memory). Plan the adoption in the final wave with the ledger rows, and run `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root; never quote a number.

### Pitfall 9: Fork needs authoring visibility and the `workflows` tier
`POST /workflows` requires `require_visible("workflow_authoring")` and `require_capability("workflows")` (workflows.py:1166-1169); `GET /workflows/drafts` requires visibility too (:1206). A user without them gets a refused fork (surfaced as the existing `forkFailed` notice). The dev account passes; say so in the G-4 script and do not treat a refusal as a defect.

## Code Examples

### The widening of `sendMessage` (the only G-5 edits outside ChatArea)
```ts
// frontend/src/stores/streamsStore.ts, inside actions.sendMessage opts (currently :336-348): add
/** Phase 287 (START-01): the launch form's declared values for a harness kickoff. */
inputs?: Record<string, string>
// frontend/src/providers/StreamsProvider.tsx, postMessage call (currently :2749-2757): add one line
inputs: opts?.inputs,
```
`postMessage` already drops an empty map and omits the key (threads.ts:775-777), so a Deep send stays byte-identical. Add a ledger note: StreamsProvider "ONE passthrough field, 0 branches".

### Server: why a non-empty thread is accepted (no change needed)
```python
# backend/app/services/workflow_kickoff.py:147-182 — the only thread-state check is the anchor:
_existing_anchor = (thread_row or {}).get("active_workflow_run_id")
if _existing_anchor is not None:
    ... status = SELECT status FROM workflow_runs WHERE id = $1   # under the user's RLS
    if _anchor_status is not None and _anchor_status not in ("completed","failed","cancelled"):
        raise HTTPException(409, "Thread is workflow-locked — ...")
# stale/terminal anchor: NOT cleared here; create_workflow_run re-points it atomically.
```
Other guards inside `if body.workflow_definition_id is not None` (workflow_kickoff.py:184-312): kill switch 403, `enforce_entitlement(..., "workflows")`, definition resolve under `is_system_global OR created_by = me` (404), status in published/draft (draft only for its author), folder-scope subset (400), skill snapshot gate, template pin. `send_message` additionally runs `_require_thread_org` which refuses only an **Expert** thread outside its org (threads.py:1683). Kickoff writes: one `messages` row (role user, content = kickoff), a `runs` row + redis mirrors, a `workflow_runs` row, the thread anchor (`create_workflow_run`, threads.py:1888-1943). Title: `maybe_autotitle_thread` fires only if `threads.title == "New Chat"` (thread_title.py:268), so a titled thread keeps its title (G-4 scenario 1 "run shows under a different thread title" cannot happen via this path).

### DB-free static gauntlet (driven this session; use as the test body)
```python
# tests/unit/test_287_starter_static_gauntlet.py  (imports inside bodies, Phase 102 posture)
from app.models.harness import WorkflowDefinition
from app.services.harness import grounding, publish_service
from app.services.harness.reachability import lint_workflow
from app.services.openai_service import get_tools, CHAT_ONLY_TOOLS
from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

TOOLS = ({t["function"]["name"] for t in get_tools(None)} - CHAT_ONLY_TOOLS) | EXTERNAL_ACTION_CAPABILITIES

async def static_verdict(raw: dict) -> dict:
    wd = WorkflowDefinition.model_validate(raw)           # shape tier (extra='forbid')
    return {
        "business_requirement_missing": grounding.business_requirement_missing(wd),
        "lint": [(e.code, e.message) for e in lint_workflow(wd)],
        "interactive": publish_service._interactive_phase_failures(wd),
        "grounding": [v["code"] for v in await grounding.grounding_verdicts(
            wd, supabase=None, user_id="u", tool_names=TOOLS, skill_ids=set())],
    }
```
`supabase=None` is safe **only** because starters carry no `folder_scope` (rule 1 reads folders only when a phase declares one); assert that in the test (the existing `--validate-migration` already asserts no KB scope). **Derive the starter set from the migration files** (`094` + `210`), never a constant, with a collapse guard (>= 5 total) and a bijection to the slugs the list predicate would return.

Driven results (this session, `backend/venv`):
- The 3 shipped starters (094): `br_missing False`, `lint []`, `interactive []`, `grounding []` for all three. They PASS the static stages today. No existing listed starter fails them.
- `POST /workflows/validate` stage (5) additionally yields `unbound_retrieval` (severity `incomplete`) for each starter's `retrieve` phase because starters deliberately omit `project_folder_id` (D-143-4b) and `search_documents` is a KB tool (`grounding_cause == "detected"`). Publish does NOT run that rule (workflows.py:949-983 comment). A forked starter opened in the Builder will therefore show an "incomplete" finding until the user binds a knowledge base. That is correct and honest; the G-4 fork drive should expect it.
- Planted counterfactuals all FAIL correctly: unregistered tool -> `grounding: [unregistered_tool]`; empty `business_requirement` -> `br_missing True`; `phase_index` gap -> `bad_index` + `orphan_phase` + `no_terminal`. Note `llm_human_input` is now PERMITTED by publish (publish_service.py:1266-1269); the interactive plant must use a validator with `on_failure: "ask_user"`.

### Three template-less starters that pass the static stages (driven)
Shape (2 phases, no connector, no `assets`, no `inputs`):
```json
{ "slug": "meeting-notes-to-actions", "version": 1, "name": "Meeting Notes to Actions",
  "status": "published", "category": "starter",
  "business_requirement": "List the decisions and action items from your meeting notes, each with an owner and a due date where the notes state one, and cite the note each came from.",
  "phases": [
    {"slug":"retrieve","phase_index":0,"name":"Find the evidence",
     "config":{"phase_type":"llm_agent","prompt":"Search the knowledge base for meeting notes and minutes. Gather every decision and action item with its owner, due date and the passage it came from.","available_tools":["search_documents"]},"validators":[]},
    {"slug":"write","phase_index":1,"name":"Write it up",
     "config":{"phase_type":"llm_single","prompt":"Write the meeting follow-up from the retrieved notes under the headings Decisions, Action items and Open questions. Cite each line with a marker like [1]. Leave an owner or due date out where the notes do not state one."},
     "validators":[
       {"kind":"citations_required","config":{"mode":"presence","min_markers":2},"on_failure":"retry","max_retries":2},
       {"kind":"structure_check","config":{"mode":"loose","sections":["Decisions","Action items","Open questions"]},"on_failure":"retry","max_retries":2}]}
  ] }
```
Same skeleton verified for `policy-change-impact` (sections: What changed / Who is affected / What to do next) and `stakeholder-update` (Progress / Risks / Next step). Citation marker regex is `\[\d+\]|\(doc[^)]*\)` (validator_kinds.py:229); `presence` mode counts markers in the text (validator_kinds.py:288-338). Do not set `mode: "retrieved_and_cited"` on the `llm_single` phase: that mode requires `output["citations"]`, which only agent steps produce (validator_kinds.py:306). Prompts above are drafts; the planner owns final wording ("real content", D-09). These pass STATIC stages only; the golden run + judge are not proven (C4).

### Required-field refusal in the two confirm controls
```tsx
// ChatLaunchForm.submit (ChatLaunchForm.tsx:92-96) and RunModal.handleRun (RunModal.tsx:235-257)
const missing = missingRequiredFields(fields, values)
if (missing.length > 0) { setRefusal(requiredMessage(missing)); return }   // nothing posted
```
`ChatLaunchForm` FORM_CODE is fenced: it must not contain `messages`, `assistant`, `lastMessage`, `generate`, `useThreads`, `@/lib/api` and must contain `useState<Record<string, string>>({})` (ChatLayout.launch.test.tsx:800-830). The refusal sentence must not use those words. `RunModal` already has an inline error region (`run-upload-error`, role=alert, RunModal.tsx:519) and a `launchError` state fed by a rejected `onRun`; add a distinct testid for the field refusal so the 422 verbatim path stays distinguishable.

## State of the Art

| Old | Current | When | Impact |
|---|---|---|---|
| Composer Harness picker | Workflows-page-only launch | Phase 094 (sketch 011) | D-01 re-adds an in-thread door; see C6. |
| Requiredness shown, not enforced | Enforced at confirm | This phase | Rewrites docblocks at LaunchInputFields.tsx:55-81, ChatLaunchForm.tsx:85-91, RunModal.tsx:119-120 and :625-628. |
| Starters as `.docx` template-fill | + chat-answer starters | This phase | Cards must say "answer in chat" via `soulDeliverable`. |

**Deprecated/outdated:** the 094 header's `is_global` column (renamed in 111).

## Test commands (targeted; Nyquist section omitted because `workflow.nyquist_validation` is `false` in `.planning/config.json`)

| Area | Command (repo root unless noted) |
|---|---|
| Backend static gauntlet (new) | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_287_starter_static_gauntlet.py -q` |
| Backend neighbours | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_182_publish_grounding_stage.py tests/unit/test_publish_service.py tests/unit/test_214_publish_arg_gate.py -q` |
| Live-DB starter shelf | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_starter_workflows.py -q` (skips cleanly if :54322 is down) |
| Backend gate (mandatory, ceiling 71 failed, 0 collection errors) | `cd backend && node ../scripts/check-backend-unit-baseline.cjs` (hold the local-DB lock file first) |
| Frontend launch suites | `cd frontend && npx vitest run src/components/layout/ChatLayout.launch.test.tsx src/components/layout/__tests__/ChatLayoutLaunch.test.tsx src/pages/__tests__/RunModal.test.tsx src/pages/__tests__/RunModal.a11y.test.tsx src/components/workflows/LaunchInputFields.test.tsx src/components/workflows/argumentVocabulary.test.ts` |
| Frontend chat/provider | `cd frontend && npx vitest run src/components/chat src/providers` (+ any new `ThreadWorkflowPicker` test) |
| Fork | `cd frontend && npx vitest run src/components/workflows/library` |
| Typecheck (the bare `tsc --noEmit` checks ZERO files) | `cd frontend && npx tsc -p tsconfig.app.json --noEmit`, set-diff against base |
| Count gate (once, final wave) | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root |
| Ledger / size / seeds | `node scripts/check-hot-file-ledger.cjs .planning/phases/287-start-from-a-thread-fork-a-starter`; `node scripts/check-claude-md-size.cjs`; `node scripts/check-seeds-register.cjs --phase 287` (run now: 0 plan files, 366/366 parsed, gate OK, nothing matched) |

### Existing tests that D-06 makes red (deliberate, reasoned edits; rewrite in place, never delete)
1. `ChatLayout.launch.test.tsx:604-618` "opens the form and creates NO thread until it is confirmed": clicks `chat-launch-confirm` with both fields empty (`DEF_WITH_INPUTS` declares `to` and `subject` with no `required` key, so both read required; fixture at :153-157). Fill both fields before confirm.
2. `ChatLayout.launch.test.tsx:673-687` "an untouched field sends an empty string": the premise ("no required-ness is validated at any launcher") is now false for a required field. Rewrite as: empty required field is REFUSED with its name and nothing is posted (createThread/postMessage at zero); add the sibling case where the untouched field is explicitly `required: false` and DOES send `""` with the key present (keeps the wire fact "absent and empty are different" alive).
3. `ChatLayout.launch.test.tsx:749-761` Test Run door: confirms with nothing typed and asserts `postMessage` called with `""`. Fill fields first.
4. `pages/__tests__/RunModal.test.tsx:425-438` "an untouched field sends an EMPTY STRING ... no required-ness is validated here" (`declaredInputsPublished`, :318-337, declares `to` / `subject_line` with no required flag). Same rewrite as (2).
Unaffected: `ChatLayoutLaunch.test.tsx` (reserved key only), `RunModal.test.tsx:403-423` (fills both), `LaunchInputFields.test.tsx:259-269` (the LEAF still must not block; update only its comment, :260-262 now claims the confirm is not blocked).
Count-gate pins to respect: `ChatLayout.launch.test.tsx: 17`, `RunModal.test.tsx: 40` (vitest-count-gate.cjs:1724, :2279).

### SC#5 / G-4 live-drive prerequisites
- Frontend dev server: `http://localhost:5173/` (Vite binds IPv6 only; probe with `curl http://localhost:5173/`, never a 127.0.0.1 TCP probe). Probed now: 200.
- Backend: the operator starts uvicorn in a visible terminal (`python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload` from `backend` with the venv); do NOT start it as a background task. Probed now: :8000 answers (`/healthz` is 404, so use another route; stale-worker check: `Get-NetTCPConnection -LocalPort 8000 -State Listen` must show ONE PID created today).
- Local Postgres :54322 is up (queried this session). Take `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock` (noclobber) before a baseline or a migration apply.
- Login (dev only): `fhdmrd@gmail.com` (operator) and `fhdmrd.automation@gmail.com` (non-operator), per `reference_local_dev_app.md`.
- Provider keys: names in `backend/.env.example` are OPENAI, ANTHROPIC, GOOGLE, OPENROUTER, DEEPSEEK, MOONSHOT, MINIMAX, ZHIPU (lines 137-146). **Which are set in `backend/.env` is unknown: reading that file was denied in this session.** The executor must establish key presence by a means that does not print values (for example the Settings UI / model registry state) and record absent providers as blocked with reason, never omit.
- Chrome: prefer claude-in-chrome; a hidden tab makes screenshots time out and Radix dialogs linger, so read verdicts from DOM text, network log and SQL counts.
- G-4 scenario 2 needs a workflow that declares a REQUIRED input. The shipped starters declare none (C9). Create a throwaway local published row for the dev owner via direct SQL/asyncpg (workflow rows are test data) with `inputs:[{key,label,type:"text",required:true}]`, then drive the picker on it. The picker lists `/workflows/published`, which excludes drafts.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Local Postgres :54322 | migration apply, shelf test, live drives | yes | queried (asyncpg) | — |
| backend venv (asyncpg, pytest, app imports) | static gauntlet test | yes | driven this session | — |
| Vite dev server :5173 | G-4 drive | yes (200) | — | operator starts |
| uvicorn :8000 | live drives | yes (answering) | — | operator starts in a visible terminal |
| Storage bucket `workspace-files` seed objects | existing 3 starters | yes (3 `.docx` under `00000000-...-01/_library/`) | — | n/a for template-less 210 |
| Provider keys | SC#5 | unknown (`.env` unreadable) | — | record blocked rows |
| Docker / psql CLI | — | denied per project memory | — | asyncpg/psycopg2 via backend venv |
| Supabase MCP (prod reads) | slug-collision pre-check | not available to this agent | — | planner/executor runs the read-only check |
| ctx7 / Context7 | — | not used; no external library docs were needed (all findings are in-repo) | — | — |

## Security Domain

`security_enforcement` is enabled (absent/true in config).

| ASVS category | Applies | Control |
|---|---|---|
| V4 Access control | yes | Server preflight resolves the definition under `is_system_global OR created_by = me`; draft runnable by author only (workflow_kickoff.py:221-244). Fork route gated by visibility + tier. The picker adds no new route, so it adds no new authority. |
| V5 Input validation | yes | `MessageCreate.inputs: dict[str, str]` (message.py:97), reserved keys stripped server-side (message.py:27; threads.py:1933-1938). Client block (D-06) is UX, not the trust boundary. |
| V2/V3/V6 | no | no auth/session/crypto change |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Agent fills launch inputs from conversation | Tampering / EoP | D-214-04 stands: the picker reads nothing from messages; add the stripped-source absence assertion with positive control (D-07), same needles as ChatLayout.launch.test.tsx:800-818, assembled from parts. |
| Direct API call skipping the client block | Tampering | Residual: no server predicate for required launch inputs. Optional hardening in `preflight_workflow_kickoff` (Open Question 4); not required by SC#2. |
| Cross-user leak via fork | Info disclosure | INSERT-only, `is_system_global=false`/`created_by` bound server-side (db/workflows.py:1030-1037); drafts list/PATCH owner-scoped. Prove with a two-user test. |
| Starter prompt injection | Tampering | Starters are operator-authored data in immutable published rows; user KB content flows only through retrieval, as for any workflow. |
| Seed migration run by wrong role | EoP | Seed rows set `is_system_global=true`; RLS forbids users self-setting it (094 header), so only a SQL-editor migration can. Cloud apply is an operator action. |

## Validation of the fork (SC#4) — what the test must assert
Backend, live-DB (skip-guard like `test_starter_workflows.py`): (1) create a draft through `create_workflow_definition` from a starter's definition with a fresh slug; assert new id, `status='draft'`, `is_system_global=false`, `created_by=caller`, `org_id` autofilled; (2) PATCH the draft's name and a prompt via the real update path; (3) re-read the starter row and a second user's fork: byte-equal (compare `definition::text`, `name`, `updated_at`); (4) `list_starter_workflows` returns the same slug set before and after, and excludes the fork. Frontend (`useWorkflowFork` tests exist): assert the create payload has a new slug and `status: "draft"` and that the typed name is the one sent. Isolation is structural, so the test is a regression pin, not a discovery; but D-12 says prove it, so prove it.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Staying in the thread after launch (not navigating to the run surface) is acceptable for SC#1 and G-4 | C1b | If the operator expects the run page on launch (as the Workflows page does), add a post-POST anchor read and `openRunSurface`; needs a ChatLayout prop and store subscription. |
| A2 | Keeping `ForkNameDialog` is preferable to honouring "one click" literally | C2 | Operator may have wanted the dialog gone for starters; small change in `onForkStarter`/`confirmFork` plus test edits. |
| A3 | Kickoff text `Run <workflow name>` is acceptable as the user message and first-phase prompt | C8 | Starters ignore the kickoff, but a workflow whose first prompt depends on kickoff text gets a generic line. |
| A4 | A new chat-answer starter satisfies "real, gauntlet-passing starter" even though it has no file emit | C5 | If the operator wants file deliverables, templates + Storage + operator steps are required. |
| A5 | The golden run + judge would pass the three new starters on a populated KB | C4 | Unproven: only static stages are driven. A weak judge verdict drops that starter (D-09: dropped, not loosened). |
| A6 | Provider keys for SC#5 exist locally | Test commands | Rows recorded blocked with reason. |

## Open Questions

1. **Fork dialog vs "one click"** (C2). What we know: ROADMAP SC#4 and CONTEXT D-13 say one click; shipped, ratified 192.1-07 behaviour is menu -> name dialog -> create. Unclear: operator intent. Recommendation: keep the dialog, record the deviation prominently in the summary, ask at the next operator touchpoint. Planner must not silently pick; state the choice in PLAN as a decision with this reason.
2. **Kickoff text for the in-thread start** (C8). Options: fixed `Run <name>`; or a "Start with" text field in the picker (a second form-like surface). Recommendation: fixed text now; the person can add detail after launch only if the workflow asks (ask_user).
3. **Static vs live proof of "passes the gauntlet"** (C4). Recommendation: static stages by test for all 5; golden run + judge by a live drive for the 3 NEW starters on the dev KB, recorded in VERIFICATION; the 3 old ones are already published in prod, note them as previously gauntlet-exempt (seeded by SQL, never run through publish).
4. **Server-side required-input enforcement** (V5). Not required by SC#2. If wanted: refuse in `preflight_workflow_kickoff` when a declared non-reserved required key is missing/blank. Risk: `scheduler_service` and other doors do not go through this preflight, and tests assert `test_147` makes exactly ONE DB call on refusal. Recommendation: do not add in 287.
5. **Picker content**: `/workflows/published` includes global starters and (locally) the dev scaffolds `research_summarize` etc. Acceptable; decide whether to hide `category:'starter'` rows from the in-thread picker. Recommendation: leave them in (they are runnable, SC#1 says "pick a workflow").

## Plan shape suggestion (G-8: 3-5 plans; DB-mutating work serialised)

1. **Required-field block** (frontend only): `missingRequiredFields` + sentence in `soulData.ts`, `ChatLaunchForm` + `RunModal` confirm controls, docblock rewrites (LaunchInputFields.tsx, ChatLaunchForm.tsx, RunModal.tsx x2, soulData.ts:195-196 "never a block"), the 4 deliberate test edits. Wave 1.
2. **Starters** (backend/DB): migration 210 (3 template-less starters + seed-user membership guard + commented VERIFY block), `scripts/apply_migration_210.py` (clone of 209: loopback-only DSN, `--dry-run`, `--apply` twice for idempotency, `--verify-only`), static gauntlet test with counterfactuals and set derived from 094+210, `seed-starters.py` line 208 fix, `docs/OPERATOR.md` seed list + `check-deploy-drift.sh` pass, `regenerate-full-schema.sh`. Wave 1 (parallel to 1; it alone mutates the local DB).
3. **In-thread entry** (frontend): `inputs` passthrough (streamsStore.ts + StreamsProvider.tsx), `ThreadWorkflowPicker` + `useStartWorkflowInThread`, one mount in `ChatArea`, absence fence with positive control, tests. Wave 2 (needs 1 for the block).
4. **Fork proof + proof + close** : isolation test, card line from `soulDeliverable`/`business_requirement` (discretion), ledger rows AND sections in the same commit (ChatArea, StreamsProvider, streamsStore, soulData, ChatLaunchForm, RunModal, LaunchInputFields if touched, WorkflowCard/useWorkflowFork only if the dialog decision changes them), count-gate adoption, then the live G-4/SC#5 drive as VALIDATION rows (not PLAN tasks). Wave 3.

## Sources

### Primary (HIGH — read in this session)
- backend/app/services/workflow_kickoff.py:124-314; backend/app/api/threads.py:1625-2029; backend/app/services/thread_title.py:224-270
- frontend/src/providers/StreamsProvider.tsx:2616-2760, 3020-3135, 3636-3760; frontend/src/stores/streamsStore.ts:320-380; frontend/src/hooks/useMessages.ts; frontend/src/lib/api/threads.ts:715-800, 1719, 1871-1929
- frontend/src/components/chat/ChatArea.tsx:150-230, 367-442, 540-590, 780-893; MessageInput.tsx:455-560; layout/ChatLayout.tsx:290-495, 840-880, 1110-1135; layout/ChatLaunchForm.tsx; workflows/LaunchInputFields.tsx; workflows/soulData.ts:176-310; workflows/library/RunModal.tsx; useWorkflowFork.ts; libraryFork.ts; ForkNameDialog.tsx; WorkflowCardMenu.tsx
- backend/app/services/harness/publish_service.py:1-340, 935-1290; grounding.py:942-1045; reachability.py:297-464; validator_kinds.py:229-509; emitters.py; backend/app/api/workflows.py:498-533, 814-995, 1150-1200; backend/app/db/workflows.py:777-880, 1009-1040; backend/app/models/harness.py:484-683, message.py
- supabase/migrations/094, 061, 111 (rename), full-schema.sql (workflow_definitions DDL :4175, autofill trigger :6973); scripts/seed-starters.py, apply_migration_209.py, check-deploy-drift.sh; docs/OPERATOR.md:196-242
- .claude/skills/sketch-findings-agentic-rag/references/composer-and-mode.md, app-information-architecture.md; docs/HOT-FILE-LEDGER.md (ChatLayout / WorkflowsPage / StreamsProvider / ChatArea 286-forecast and 279-close sections)
- Driven scripts (backend venv, local DB read-only): starter rows + storage objects; static gauntlet over the 3 shipped and 3 candidate starters plus 4 planted defects.

### Secondary / Tertiary
None used. No web search or Context7: the domain is entirely in-repo.

## Metadata

**Confidence breakdown:**
- Server kickoff behaviour: HIGH (read end to end).
- Client attach path (C1): HIGH for the facts; MEDIUM on the stay-in-thread UX judgement (A1).
- Static gauntlet + starter definitions: HIGH (driven). Live gauntlet outcome: LOW (not run).
- Fork behaviour: HIGH. Sketch/UX conflicts: MEDIUM.
- Migration/parity: HIGH on schema facts; prod slug collision UNVERIFIED (no MCP).

**Research date:** 2026-10-19. **Valid until:** ~2026-10-26 (fast-moving hot files; ledger rows change every phase, re-derive triples with the ledger recipe before planning).
