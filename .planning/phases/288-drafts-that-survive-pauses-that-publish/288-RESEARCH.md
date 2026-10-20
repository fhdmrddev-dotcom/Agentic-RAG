# Phase 288: Drafts That Survive, Pauses That Publish - Research

**Researched:** 2026-10-19
**Domain:** Builder draft-configuration persistence (React/zustand), publish-gauntlet lint (FastAPI/Python), run-surface "waiting on" field (FastAPI + React)
**Confidence:** HIGH (every claim below was read at file:line in this session unless tagged otherwise; nothing was driven in a browser, see Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AUTH-03: the draft keeps its configuration**

- **D-01 (split the card, do not widen the gate).** SEED-183's own finding stands: the card carries two classes of value. The **receipt** ("here is what I built") is past tense, reads a snapshot, and stays arrival-only (`showReceipt` is NOT widened; its setter count stays 1). The **decisions rows and the name field** read the definition as it is NOW and become a draft-lifetime surface. *Why:* persisting the receipt would make the AI narrate the author's later edits, the CR-01 shape hit five times already.
- **D-02 (graph column stays three children).** The persistent decisions surface lives INSIDE the existing `DraftArrivalCard` slot. After the author dismisses the arrival it collapses to a compact "Draft settings" row, it does not unmount. A fourth child strands the graph at 0 px (sketch 172 measured it). *Why:* structural, not a preference.
- **D-03 (rename works for the whole draft).** The name input stays reachable until publish, writing through `builderStore.setName` (the one write path; it never touches the slug). *Why:* today a name is editable during exactly one moment.
- **D-04 (a published workflow is not a draft).** The persistent surface renders only while the workflow is an unpublished draft. After publish it is gone, and the re-publish/tweak path is unchanged.
- **D-05 (no cross-draft bleed, proven first).** Success criterion 2 is driven in a browser BEFORE any fix is written: configure draft A, open draft B, return to A, and the reverse. If it reproduces, fix by keying builder state to the workflow id. If it does not, ship a regression test and say so. *Why:* the roadmap lists "two drafts overwrite each other" as a failure mode, and a fix for a bug nobody reproduced is a guess.
- **D-06 (hard reload counts).** "Survives" means navigate away and back AND a hard reload. The roadmap names "persists only until a hard reload" as the failure. Autosave is the mechanism; no new client store.

**AUTH-01: pauses publish and say who they wait on**

- **D-07 (prove, do not rebuild, publishing).** Publish a real `llm_human_input` workflow through the real gauntlet in the browser. Add what 200.3 left out: the publish verdict says, in words from the server, that the pause step was answered automatically during validation and has not been exercised (SEED-164 cost 1: "the claim narrows"). The shape check (prompt present, options well-formed) stays static and named.
- **D-08 (the gauntlet is taught the pause, never loosened).** Nothing is removed. Two refusals after this phase: the existing `on_failure == "ask_user"` validator refusal (kept, SEED-137 coupling), and a NEW named lint failure for a human-input step whose `timeout_seconds` is `<= 0` or above `ask_user_max_timeout_seconds` (today clamped silently). Both are driven RED against planted definitions, and the driving is recorded in the SUMMARY. *Why:* "unbounded wait" had no definition in code; this one is observable and testable. SEED-137 must be read before the gate is touched.
- **D-09 (the server says who, in words).** The run read gains one optional field describing the pause: the person it waits on (display name, falling back to email, falling back to the words "the person who started this run"), the step's own name, and the prompt's first line. Built from the durable pending-prompt row, NOT from SSE, so it is the same after reload. The client renders the sentence; it never builds it from an id. *Why:* the roadmap's failure mode is "waiting on shows an id or nothing".
- **D-10 (the viewer may not be the owner).** The sentence reads "Waiting on <name>" for everyone and appends "(you)" only when the viewer is that person. Phase 289 depends on this not assuming ownership.
- **D-11 (a pause that outlives its timer says so).** The pause is durable (Phase 200 D-10). When the answer window has passed, the line stays and says the run is still waiting and will continue when answered. It never says "expired" about a run that will in fact resume. Research confirms the current post-timeout state before the copy is written.
- **D-12 (no new phase type).** `llm_human_input` only. `external_action` approval and long-artifact review are other shapes (SEED-164 table) and stay out.

**Process and guardrails**

- **D-13 (G-2 skipped, audited).** The operator is away, so no sketch is made. The decisions surface reuses sketch 174's vocabulary; the waiting-on line reuses the existing `waiting` tone. Recorded under `STATE.md` guardrail overrides, as in 287.
- **D-14 (G-4 scenarios, defined by Claude, driven in Chrome).** S1: generate a draft, rename it, dismiss the arrival, navigate to the library and back, hard reload; name, decisions and node config all present. S2: two drafts, no bleed in either direction. S3: publish a pause workflow, start a run, see the waiting-on sentence with a real name, reload, still there, answer, run completes. S4: a planted unbounded wait is refused with a named reason.
- **D-15 (G-5, one touch per hot file).** `WorkflowBuilderPage.tsx`, `builderStore.ts`, `PublishGauntlet.tsx`, `publish_service.py`, `WorkflowRunPage.tsx`: at most one mount, prop, field or helper each; ledger rows and detail sections in the same commit. Read each file's section in `docs/HOT-FILE-LEDGER.md` before planning. 289 also edits `WorkflowRunPage.tsx`, so leave it smaller, not larger.
- **D-16 (UAT four axes, VALIDATION.md).** The phase touches run state and UI state, so the VALIDATION rows cover the full native roster plus OpenRouter, a multi-tool row, a parallel-thread row and a long-message row. Blocked rows are recorded with their reason, never dropped.
- **D-17 (plan count 3-5, G-8).** Suggested shape, planner may merge: (1) draft surface split plus bleed proof, (2) gauntlet: unbounded-wait lint plus the verdict row, (3) waiting-on server field plus run surface, (4) live proof. Plans 1 and 3 touch disjoint files and can share a wave.
- **D-18 (reported bugs).** No open `surface: Agentic-RAG` report is folded. `BUG-260610-01` (run nav timer reset and duplicate avatar) stays open: the timer half went to 200 and the avatar half is not this phase.

### Claude's Discretion
CONTEXT.md has no separate "Claude's Discretion" section; the whole file was taken autonomously. Free choices left to the planner: exact component/testid names, the field's wire shape (D-09 fixes content, not shape), and the plan merge in D-17.

### Deferred Ideas (OUT OF SCOPE)
- Notification when a run pauses (who is told, where).
- Batching several gaps into one ask.
- Long-artifact review as a separate phase type (SEED-164 case 4) and approval of an outward act (already `external_action`).
- Answerer other than the run's owner (assignees, org roles). 288 names the owner and does not invent routing.
- Duplicate-avatar half of BUG-260610-01.
- SEED-182 (composing moment) and SEED-184 (density language).
- Server-side enforcement of required launch inputs (carried from 287).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-03 | A draft's configuration does not vanish when the author navigates away. | Sections 1, 2: store is per-mount and the draft is server-persisted; the loss is only the card gate (`open={showReceipt}`) that hides the live `decisions` memo. |
| AUTH-01 | A workflow that pauses for a person can be published, and the run surface shows who it is waiting on. | Sections 3, 4: publish already admits `llm_human_input`; missing pieces are the timeout lint, an auto-answered verdict note, and a `waiting_on` field built from the `messages` prompt row. |
</phase_requirements>

## Summary

**Section 1 (bleed): cannot reproduce by reading.** The Builder store is created with `useState(() => createBuilderStore(...))` at `WorkflowBuilderPage.tsx:654`, per mount, and `useDraftPersistence` holds only `useRef`/`useState` (no module state, `hooks/useDraftPersistence.ts:485-553`). `WorkflowsPage` renders the Builder only in `pageView === "builder"`; the only way from draft A to draft B is `backToLibrary` then `onOpenDraft` (`WorkflowsPage.tsx:660-675`), which unmounts the whole tree. So the store, the write loop and the draft id cannot carry from A to B. D-05's "key the store to the workflow id" fix is NOT needed; ship a regression test plus the browser drive.

**Section 2 (what is lost): the card gate, nothing else.** The `decisions` memo (`WorkflowBuilderPage.tsx:1682-1707`) is already computed live from `meta`, `definition`, `boundFolderName`, `templateAsset`; the only snapshot inputs are `readiness` (optional, absent arm renders fine) and `receiptPhases` (receipt only). So decisions CAN be derived from the saved definition alone. The loss is `DraftArrivalCard`'s `if (!open) return null` (`DraftArrivalCard.tsx:296`).

**Section 3 (publish): already unblocked, but three gaps.** `_interactive_phase_failures` (`publish_service.py:1255`) admits `llm_human_input`; the golden run auto-answers (`human_input.py:135-147`). Gaps: (a) no `timeout_seconds` bound anywhere, (b) the success verdict carries no "auto-answered" note and `PublishVerdict` has no field for one, (c) the gauntlet's own "Pause" stage text still says the opposite (`PublishGauntlet.tsx:212`, mirrored in `landing/facts.ts:144`).

**Section 4 (waiting on): the "durable pending-prompt row" is not a table.** It is a `messages` row (`role='system'`, `tool_calls[0].kind='ask_user_prompt'`, `run_id`, `tool_call_id`, `prompt`, `options`, `timeout_seconds`, `draft`). It carries no phase slug and no person. After the answer window passes the run goes `paused`, the phase stays `active`, the prompt stays pending, and an answer re-drives the run. Before the window passes the run is `active` and the band says "Running" while the step waits.

**Primary recommendation:** one optional `waiting_on` object on `WorkflowRunRead` (server-composed sentence), one optional `DraftArrivalCard` prop that turns its `!open` branch into a collapsed "Draft settings" row (new `decisionsVocabulary` words, different testid), the timeout check inside `_interactive_phase_failures`, and an optional `auto_answered` list on the success `PublishVerdict`.

## Contradictions with CONTEXT.md (read these first)

| # | CONTEXT says | Measured | Consequence |
|---|---|---|---|
| C1 | D-05: fix "by keying builder state to the workflow id" if it reproduces | Store/loop are per-mount; the Builder cannot survive a draft switch (Section 1) | Expect "cannot reproduce". Ship regression test, no store change. `builderStore.ts` needs ZERO edits (286 forecast allowed one field). |
| C2 | D-09: "built from the durable pending-prompt row" | No table. It is a `messages` row with no phase slug and no person. `db/workflows.py:1744 get_pending_ask_user(pool, run_id)` does NOT exclude answered prompts (no NOT EXISTS) | Need a new unanswered-prompt read; step name must come from the active `llm_human_input` phase row + definition, not the prompt. |
| C3 | D-09: fall back to email | `profiles` RLS is own-row only (`full-schema.sql:8756`); the user-JWT client cannot read another person's profile; `auth.users.email` is not reachable via PostgREST | Email is only available for the viewer (`current_user["email"]`). Email fallback is safe only when viewer == owner; otherwise fall to "the person who started this run". Flag to operator (A2). |
| C4 | D-02: collapsed row "does not unmount" | `WorkflowBuilderPage.canvas.test.tsx:3922-3935` pins "dismissing takes the column down to TWO children" and several cases assert `draft-arrival-card` is null after dismiss (2530-2541) | D-02 retires the TWO-children pin on purpose; the null-after-dismiss cases survive if the collapsed row uses a DIFFERENT testid. Re-baseline deliberately, say so in the SUMMARY. |
| C5 | D-07/D-08 imply `reachability.lint_workflow` or `publish_service` as candidates | `lint_workflow` is pure/no-settings and every code must be in `LINT_CODES` (`test_182_severity_codes.py`); `_interactive_phase_failures` already imports settings lazily, is the "wait refusal" home, and is reused by `POST /workflows/validate` (`api/workflows.py:946`) | Put the timeout check in `_interactive_phase_failures`. |
| C6 | CONTEXT measured block: "Neither names a person, and the reading ... must be shown to survive reload" | Two states exist: `active` + pending ask (band reads "Running", only the node says waiting) and `paused` (band reads "Paused for your answer", `WorkflowRunPage.tsx:389-390`) | The line must cover both states, not only `paused`. |
| C7 | D-07 treats the gauntlet copy as fine | `PublishGauntlet.tsx:212` "human-pause phases can't validate synchronously" and `landing/facts.ts:144` are now FALSE (200.3 shipped). Only `GAUNTLET_STAGES.length` is tested (`landing/__tests__/facts.test.ts:51`), so nothing catches the drift | Reword both in the same commit. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Draft configuration persistence | API / Backend (autosave PATCH, `useDraftPersistence`) | Browser (zustand store, per mount) | The draft row is the source of truth; the browser holds a working copy only. |
| Persistent decisions/rename surface | Browser | — | Pure view over `meta`/`definition`; write path `store.setName`. |
| Timeout lint | API / Backend (`publish_service` + `/validate`) | Browser (renders PhaseRow) | Server owns the rule and the words; client renders `{phase, message}` entries. |
| Auto-answered note on publish verdict | API / Backend | Browser | D-07: words from the server. |
| Waiting-on sentence | API / Backend (run read) | Browser renders it verbatim | D-09: client never composes from an id. |
| Display name resolution | Database (`profiles`) via API pool | — | RLS blocks cross-user reads on the user-JWT client; pool read after ownership select. |

## Standard Stack

No new packages. Everything is existing code. **Package Legitimacy Audit: not applicable (no external packages installed).**

### Core (existing, reuse)
| Piece | Location | Purpose |
|---|---|---|
| `createBuilderStore` / `store.setName` | `builderStore.ts:367`, `:831` | Single write path for the name; gated on `builderPhase === "drafted"`. |
| `useDraftPersistence` | `hooks/useDraftPersistence.ts` | Autosave; carries `meta` (incl. `name`) via `selectDefinition` (`builderStore.ts:337`). |
| `DraftArrivalCard` + `DecisionsList` | `components/workflows/` | Existing slot and rows; `decisions` prop already built live. |
| `decisionsVocabulary.ts` | `components/workflows/` | The ONLY home for this card's words (fenced, see Pitfall 2). |
| `_interactive_phase_failures` | `publish_service.py:1255` | Named refusal; entries `{phase, message}` render as `PhaseRow` (`PublishGauntlet.tsx:329-340`). |
| `PublishVerdict` | `api/workflow_wire.py:295` | Wire model; undeclared keys are dropped by `response_model`. |
| `WorkflowRunRead` | `api/workflow_runs.py:300` | Wire model for the run read. |
| `readBand` / `band.sentence` | `WorkflowRunPage.tsx:~370, 1287` | Status sentence; `waiting` tone already exists (`:331, 347`). |

## Architecture Patterns

### System flow (new pieces marked +)

```
Library (WorkflowsPage) --open draft--> Builder mount (per-mount store, per-mount persistence)
   builder store meta.name/phases --autosave PATCH--> workflow_definitions (draft row)
   store --selectors--> decisions memo (live) --> DraftArrivalCard
        open (showReceipt, arrival only) -> full card (unchanged)
        +!open && drafted view          -> collapsed "Draft settings" row -> expands to DecisionsList (name input)
Publish: PublishGauntlet -> POST /publish -> publish_service
   lint -> _interactive_phase_failures [+timeout <=0 / > max] -> grounding -> golden run (pause auto-answers)
   -> judge -> flip ; success dict [+auto_answered: [{phase,message}]] -> PublishVerdict [+field] -> client note
Run: workflow_runs read (owner select) -> [+ pool: unanswered prompt + active llm_human_input phase + profiles.display_name]
   -> WorkflowRunRead.waiting_on {sentence, step_name, prompt_line, window_passed} -> band line (client renders verbatim)
```

### Pattern 1: collapsed row in the same slot (one optional prop)
**What:** `DraftArrivalCard` already is the graph column's middle child and already returns `null` when `!open`. Add ONE optional prop (e.g. `settingsRow?: boolean`) so the `!open` branch returns a single collapsed element instead of `null` when the page says the view is a draft. Expanded body is `<DecisionsList {...decisions} />` (already imported). The page passes the prop at the one existing `<DraftArrivalCard ...>` call (`WorkflowBuilderPage.tsx:2167`). No new child, no new hook, no `showReceipt` change.
**Gate (D-04):** needs no extra code: the Builder only ever holds draft rows (Tweak forks a new draft; D-183-04 says no published door) and `onGauntletPublished` calls `setPageView("library")` (`WorkflowsPage.tsx:812-818`). State this as "structural" and pin it with one test.
**Flag:** the whole slot lives in `graphColumn`, which exists only when `canvasEnabled` (`WorkflowBuilderPage.tsx:2094`). Flag-off has no card today and the row inherits that. `visual_workflow_canvas` defaults to "everyone" (`models/user_settings.py:1599`).

### Pattern 2: server-composed sentence, client renders verbatim
Follow `BlockedStep` / `blocked_step` (`workflow_wire.py:~320`): optional field, `None` renders the surface that shipped. **Declared, selected and populated in lockstep** (see the `WorkflowRunRead` docblock at `workflow_runs.py:322-330`: "an optional wire field with no producer typechecks perfectly and renders nothing").

### Anti-Patterns to Avoid
- **Widening `showReceipt`** or adding a second setter: pinned at one site (`useTemplateFirstDraft.test.tsx:751`, `canvas.test.tsx:2621`).
- **Reusing the card's past-tense words** ("What I decided for you", "N decisions I made for you", `decisionsVocabulary.ts:157-161, 301`) on a re-opened draft: that is the AI-narrates-later-edits shape. New neutral words are required.
- **A fourth graph-column child.**
- **Composing the waiting sentence client-side from `thread_id`/user id.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Draft survival across reload | A localStorage/sessionStorage mirror | Existing autosave (`useDraftPersistence`) | D-06; a second copy is the drift the store forbids. `name` already rides the definition. |
| Name write | A second setter | `store.getState().setName` via the existing `setWorkflowName` (`WorkflowBuilderPage.tsx:1632`) | One write path. |
| Timeout bound | A Pydantic `ge=1` on `LlmHumanInputPhaseConfig` | `_interactive_phase_failures` | A model bound surfaces as `definition_invalid` (stage "Valid"), not a named pause refusal, and would 422 on stored rows holding `0`. |
| Pending prompt read | Another table/migration | `messages` scan (pattern in `db/workflows.py:1744` / `api/panel.py:197-203`) plus NOT EXISTS | No new table is needed (CONTEXT: "no new table planned" holds). |
| Display name | Reading `auth.users` | `profiles.display_name` via pool; `current_user["email"]` for the owner-viewer only | RLS, and PostgREST cannot reach auth schema. |

## Runtime State Inventory
Not a rename/refactor phase. Omitted.

## Common Pitfalls

### Pitfall 1: Hook order in the page
`decisions` already sits ABOVE the describe screen's early return for a documented reason (`WorkflowBuilderPage.tsx:1650-1660`: more hooks than the previous render crashed 11 cases). Do not declare any new `useMemo`/`useState` below that return. The collapsed row needs no new hook: the prop is a constant or `draftId !== null`.

### Pitfall 2: DraftArrivalCard's own source fences
`DraftArrivalCard.test.tsx:461+` ("five charter clauses"): the component authors NO sentence (every user-visible string must be imported from `decisionsVocabulary`/`definitionOps`); only the component may be a module-scope function declaration; it may not import `@/lib/api`; suppression targets are enumerated. New copy ("Draft settings", the collapse/expand label) goes into `decisionsVocabulary.ts` (pinned by `decisionsVocabulary.test.ts`, count 22) and the fence's positive control imports list may need the new names. Count-gate pins: `DraftArrivalCard.test.tsx` 35, `DecisionsList.test.tsx` 54, `decisionsVocabulary.test.ts` 22 (`scripts/vitest-count-gate.cjs:2776-2778`). Per-file DECREASE fails the gate; additions are fine.

### Pitfall 3: `getWorkflowRun`/wire lockstep
Adding `waiting_on` needs: model field (`workflow_runs.py:300`), the producer in `read_workflow_run`'s return (`:~1010`), the TS type (`types/index.ts` + `lib/api/workflows.ts`), and a test that the key is NOT dropped. The `.select("*")`-style occurrence count fence (`test_214_failure_reason_seam.py`) means never type that literal, even in a comment.

### Pitfall 4: the existing prompt helper returns answered prompts
`db/workflows.py:1744` picks the latest prompt for the run regardless of response. Use a variant with `NOT EXISTS (... kind='ask_user_response' AND tool_call_id = ...)` (same shape as `api/panel.py:197-203`), scoped by `tool_calls->0->>'run_id' = $1::text`. A run with two `llm_human_input` steps would otherwise show the first, already-answered question.

### Pitfall 5: no phase slug on the prompt
Derive step name from the single `workflow_phases` row with `status='active'` whose definition spec is `llm_human_input` (the spine is linear, same reasoning as `WorkflowRunPage.tsx:789-811`). Name via the spec's `name` (cleaned: reuse `publish_service._clean_label` rules or the `nodeTitle` rule); never the slug (`test_publish_service.py:635 _FORBIDDEN_IN_COPY` forbids `llm_human_input`, `ask_user`, slug in refusal copy).

### Pitfall 6: privacy of the line for non-owners
The run read is owner-only today (`.eq("user_id", ...)` at `workflow_runs.py:~774`), so viewer == owner always. 289 will open it. The prompt first line is run content (it may quote draft text, `draft` field aside). Decide in 289 whether non-owners see `prompt_line`; build the field so `prompt_line` can be omitted independently.

### Pitfall 7: golden-run mock marker not persisted into any verdict
`_golden_run_mock: True` is written in the phase output (`human_input.py:146`) and is the only evidence a pause was auto-answered. Derive the note from the golden run's phase outputs (so a pause skipped by `skip_to_phase` is not claimed as answered), not from a static scan of the definition. Both are acceptable; the output read is more honest. Phase outputs may be a jsonb string scalar (38 of 43 failed rows): use `phase_output_object`.

### Pitfall 8: snapshot working-copy noise
`git status` shows three `seam286` `.snap` files modified. `git diff --ignore-space-at-eol` is empty: CRLF noise only. Do not treat as a baseline; and per project memory `git checkout --` is not a restore (autocrlf). Check numstat with `--ignore-space-at-eol`.

### Pitfall 9: cosmetic cross-draft state
`canvasNudge.ts` keeps a MODULE-level `sessionBucket` for drafts with no id (`readNudges`/`clearNudges`, lines 100-205). Two successive never-saved builds in one tab share y-offset nudges. Cosmetic only (slug -> dy), not configuration, and a generated draft gets an id on first save. Not SC#2; mention in the regression test comment, do not fix here.

## Code Examples

### Existing live `decisions` memo (no snapshot except `readiness`)
```tsx
// Source: frontend/src/pages/WorkflowBuilderPage.tsx:1682
const decisions = useMemo<DecisionsListProps>(() => ({
  folderName: boundFolderName,
  templateFilename: templateAsset?.filename ?? null,
  businessRequirement: typeof meta.business_requirement === "string" ? meta.business_requirement : "",
  name: typeof meta.name === "string" ? meta.name : "",
  deliverableStepSlug: terminalEmitSlug(definition),
  readiness,            // optional snapshot; absent arm renders no verdict node
  onChangeKb: focusKbPicker, onChangeRequirement: focusRequirementInput,
  onOpenStep: jumpToStep, onChangeName: setWorkflowName,
}), [/* ... */])
```

### Timeout check inside the existing refusal (shape only)
```python
# Source: backend/app/services/harness/publish_service.py:1255 (_interactive_phase_failures) - extend, do not replace
from app.config import settings  # function-local, as elsewhere in this module
for phase in definition.phases:
    cfg = getattr(phase, "config", None)
    if getattr(cfg, "phase_type", None) == "llm_human_input":
        t = cfg.timeout_seconds
        if t <= 0 or t > settings.ask_user_max_timeout_seconds:
            failures.append({"phase": slug, "message": <worded, no internal ids, names the allowed range>})
```
Existing entries keep their order and shape; the default 300 and the existing `test_seed164_human_input_passes_publish_gauntlet` (`findings == []`) stay green.

### Unanswered prompt for a run (new read, shape of existing helpers)
```sql
-- pattern: db/workflows.py:1744 + api/panel.py:197-203
SELECT m.tool_calls FROM messages m JOIN workflow_runs wr ON wr.thread_id = m.thread_id
WHERE wr.id = $1 AND m.role='system'
  AND m.tool_calls @> '[{"kind":"ask_user_prompt"}]'::jsonb
  AND m.tool_calls->0->>'run_id' = $1::text
  AND NOT EXISTS (SELECT 1 FROM messages r WHERE r.thread_id = m.thread_id AND r.role='system'
      AND r.tool_calls @> '[{"kind":"ask_user_response"}]'::jsonb
      AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id')
ORDER BY m.created_at DESC LIMIT 1
```

## Detailed Answers

### 1. Cross-draft bleed (SC#2): cannot-reproduce-by-reading
Evidence: store per mount `WorkflowBuilderPage.tsx:654`; docblock at `:648-653` says "never at module scope - a singleton would carry one workflow's undo history into the next"; `builderStore.ts:367` is a factory; `useDraftPersistence` has only refs/state; Builder mounted once in `WorkflowDoorSwitch.tsx:396` (no `key`, but not needed); host `WorkflowsPage` unmounts it on `backToLibrary`; the open-draft setter runs only from the library (`:660-675`). `useBuilderNameMaps` is per-mount. Nudges are keyed by `canvasNudgeKey(userId, draftId)`.
Residual risk worth driving: an in-flight autosave from A resolving after A unmounted (the loop holds its own `draftIdRef`, writes to A's id, cannot hit B). Drive it, expect no bleed.

**Browser steps (Chrome MCP, visible tab):**
1. Workflows, "Build a workflow", describe door, generate draft A. On the arrival card set the name `ALPHA-NAME` (`decision-name-input`), open any step, set a distinctive field (e.g. the prompt `ALPHA-PROMPT`). Wait for "Saved - still a draft".
2. `← Workflows` (builder-back). Open or generate draft B; set `BRAVO-NAME` / `BRAVO-PROMPT`. Wait for saved.
3. Back to library, reopen A: assert header/name/step prompt read ALPHA, never BRAVO. Reopen B: BRAVO. Repeat with the reverse order, and once with B opened while A's save is still "saving" (throttle or click back immediately after typing).
4. Hard reload on A (F5 on the builder reverts to the library, per no-router: `reference_app_has_no_router`), reopen both, repeat the assertions.
5. DB cross-check: SELECT `name`, `definition->'phases'` for both rows via the Supabase MCP read path.
Note "navigate away and back" in SC#1 is always library round trip here; the Builder is not restored on reload by design (no router), the draft is re-opened from the shelf.

### 2. What is lost on re-open, and the one-prop change
Lost: only visibility. `showReceipt` is set in exactly one place (`:827`) and `DraftArrivalCard` returns `null` when `!open` (`:296`). `receiptPhases` and `readiness` are generation snapshots and stay arrival-only. `nameContext` (`:741`, from `useBuilderNameMaps`) is live on mount, so folder/skill names resolve on re-open. `decisions` needs no snapshot: `readiness` undefined means the verdict node is absent (`DecisionsList.tsx:51`). Rename works immediately via `setName` (drafted-phase guard `builderStore.ts:833`); `name` persists because `selectDefinition` spreads `meta` into the PATCH body and the backend model carries `name` (`models/harness.py:515`).
Change: one optional prop on `DraftArrivalCard`; `!open` branch returns a single collapsed element (new testid, e.g. `draft-settings-row`, NOT `draft-arrival-card`) with a disclosure whose body is `<DecisionsList {...decisions} />`. Page: pass the prop at the existing call site (`:2167`). Graph column stays 3 children when the row renders; with no row (describe screen) nothing changes. Words: new entries in `decisionsVocabulary.ts` (heading neutral/present tense, plus keep `DECISION_EDIT_LIMIT_NOTE` which is already tense-neutral). Also: collapsed by default on re-open (seed question 3), expanded state is local `useState` inside the card like `decisionsOpen`.

### 3. Publish path
- Publishes today: yes. `_interactive_phase_failures` only refuses `on_failure == "ask_user"` validators (`publish_service.py:1273-1286`). Tests: `test_publish_service.py:456` (proceeds to golden run), `:588`, `:685` (`findings == []`); golden auto-answer `human_input.py:135-147`; `200.3-VERIFICATION.md` (unit-level, mocks). **No test drives a real golden run through a real `llm_human_input` end-to-end**; D-07's live proof is genuinely new evidence.
- Timeout lint: `_interactive_phase_failures`, which `/validate` also calls (`api/workflows.py:946`, code `interactive_phase`) so the canvas tray warns at author time for free. `LintError`/`LINT_CODES` untouched. Present behaviour: `min(timeout, 1800)` (`human_input.py:~113`), so `0`/negative means an immediate timeout then `pause_run`; `99999` is silently 1800. The engine's real indefinite wait (`timeout_seconds=None`) belongs to the armed checkpoint and cannot be set from `LlmHumanInputPhaseConfig` (`int`, no None).
- Rendering: block entries `{phase, message}` -> `renderFailure` -> `PhaseRow` under the "Pause" stage (`PublishGauntlet.tsx:329-340`, STAGES row `:212`, `codes: ["interactive_phase"]`). No client change needed for the refusal.
- Auto-answered note: success dict is `{published, version, golden_run_id}` (`publish_service.py:~523`); `PublishVerdict` (`workflow_wire.py:295`) has no carrier and the route does `PublishVerdict(**result)` (`api/workflows.py:1146`), so an undeclared key would be dropped or raise. Add one optional list field (suggest `auto_answered: list[{phase, message}]`, same entry shape as `named_failures` so `PhaseRow`-style rendering is reusable) populated from the golden run's phase outputs carrying `_golden_run_mock`. Client: one block beside `golden-no-send` (`PublishGauntlet.tsx:1150-1158`), gated on `isSuccess`; type in `lib/api/knowledge.ts:570`. Words from the server, composed without internal ids.
- SEED-137: status is `folded` into 187 (frontmatter `folded_into: 187`); the engine property is pinned by `tests/unit/test_187_armed_checkpoint_property.py`. It constrains this phase only as: keep the `on_failure == "ask_user"` refusal untouched and add nothing that lets an author-declared ask_user validator reach a published workflow. Its PRIMARY re-open trigger (relaxing `_interactive_phase_failures`) is touched by 288, so cite it in the SUMMARY and re-run `test_187_armed_checkpoint_property.py` + `test_185_engine_attachment.py` in the wave gate.
- SEED-164 cost 1 (claim narrows) is the origin of D-07; costs 2-4 are covered by D-07/D-08. Its open questions (notification, batching, durable pause > 30 min) are deferred, but note the 30-minute ceiling: the product says nothing at authoring time. The new lint message should state the allowed range, which tells authors the limit.

### 4. Waiting-on
- Prompt storage: `messages` row inserted by `_exec_llm_human_input` (`human_input.py:~188-215`): `role='system'`, `origin='harness'`, `user_id = ctx.current_user.id`, `tool_calls=[{kind:'ask_user_prompt', tool_call_id, prompt, options, timeout_seconds, run_id, draft}]`. Insert is best-effort (try/except logs only): if it fails the line has nothing to show; degrade to `waiting_on = None`, never invent.
- Run read: `read_workflow_run` (`workflow_runs.py:729`) selects `id, thread_id, definition_id, status, org_id, created_at, updated_at, claimed_at, definition_snapshot, metadata, model, ...`; user-JWT supabase client; **`user_id` is not selected** (add it to the explicit list; needed for the owner compare). A `pool = await deps.get_pg_pool()` is already obtained inside the cost try-block (`:~960`), so the prompt/profile reads can use a pool after the ownership select (belt-and-braces; must not 500 the pure read: wrap like the cost lookup).
- Display name: `profiles(id, display_name text null)` (`full-schema.sql:3447`), populated at signup from `raw_user_meta_data->>'display_name'` (trigger, `:562`). Chain: non-blank `display_name` -> (viewer is owner) `current_user["email"]` -> "the person who started this run". The sentence's "(you)" is `owner_id == current_user["id"]`, computed server side so the client stays dumb (D-10).
- Waiting derivation on the page: `asks` slice (owner-only `/ask_user/pending`, `api/panel.py:165`) feeds `waitsForYou`/`canvasReading` at `WorkflowRunPage.tsx:~777-822`; the band is `readBand(status)` and only `paused` words the wait. The new line renders next to `band.sentence` (`:1287`) from `run.waiting_on`, independent of the asks slice (so it also works for a non-owner).
- After the window: `HumanInputTimeout` -> `PhaseOutcome("pause_run")` -> `pause_run(pool, run_id)` + `policy_applied` audit + `run_paused` SSE (`harness_engine.py:2444-2455`). Run `status='paused'`, phase stays `active`, prompt stays pending (`/pending` still serves it, `_prompt_run_is_live` treats non-terminal as live), thread anchor kept. An answer re-drives via the claim/resume path (`api/runs.py:~600-660`, `wr.status='paused'` required) and the executor consumes the durable answer (`human_input.py:~150-176`). D-11 copy is therefore accurate: still waiting, resumes when answered. `window_passed` = `status == 'paused'`; `status == 'active'` with an unanswered prompt = inside the window.
- Proposed field (one optional object): `waiting_on: {sentence, step_name, prompt_line, window_passed} | None`. `sentence` is fully composed server side ("Waiting on Dana (you) to answer "Approve the draft"" / paused variant "Still waiting on Dana. The run continues as soon as they answer."). `None` for terminal runs, golden runs, no unanswered prompt, or any lookup failure.
- File list: `backend/app/api/workflow_runs.py` (model + select `user_id` + producer; hot, 289 forecast: keep it to one helper), a new tiny helper in `backend/app/db/workflows.py` (hot; ONE function, or put the read in a new small module to avoid growing it), `frontend/src/types/index.ts` + `frontend/src/lib/api/workflows.ts` (types), `frontend/src/pages/WorkflowRunPage.tsx` (ONE render beside `band.sentence`; consider a leaf component so the page gains no hook), tests in `backend/tests/test_188_workflow_run_read.py` (NOTE: outside `tests/unit`, so the 71-failure baseline gate does not run it; run it explicitly) and `WorkflowRunPage.test.tsx`.

### 5. Test inventory (will need deliberate re-baselining marked **R**)
Frontend:
- **R** `WorkflowBuilderPage.canvas.test.tsx:3922` "dismissing takes the column down to TWO children" (D-02 retires it; becomes THREE with the row). Cases at `2530-2541` stay green only if the row's testid is not `draft-arrival-card`. Count pin 128; add, never reduce.
- **R** `pages/__tests__/WorkflowBuilderPage.seam286.pin.test.tsx:322-323` snapshot `grid-flag-on` (opens `initial` draft-1 with the flag on, so the collapsed row enters `builder-grid.innerHTML`). `grid-flag-off` and the `header-*` snapshots must stay byte-identical (flag-off has no slot; `FLAG_OFF_HEADER_MARKUP` at `WorkflowBuilderPage.header.test.tsx:505` pins the header, untouched). Pins are in both count-gate knobs.
- `pages/__tests__/WorkflowRunPage.seam286.pin.test.tsx` 5 `innerHTML` snapshots: stay byte-identical iff `waiting_on` is absent from the fixtures (the line must render nothing when the field is absent).
- `WorkflowRunPage.test.tsx` (pin 148) has source `?raw` fences (`:260`, plus `StopControl.baseline.test.tsx:164`, `lib/__tests__/runStepCount.test.ts:43`, `MessageItem.inlineApproval.test.tsx:587`); `fmtElapsed(...)` text in the page source is pinned (do not move). Existing case `:2317` pins node label "Paused for your answer"; band test `:883`.
- `DraftArrivalCard.test.tsx` (35), `DecisionsList.test.tsx` (54), `decisionsVocabulary.test.ts` (22): fences in Pitfall 2.
- `PublishGauntlet.test.tsx` (83): its F18 test reads `stage="..."` literals out of `publish_service.py` (no new stage; none to add). If the "Pause" `what` text is reworded check for byte pins; `landing/facts.ts:144` mirrors it with no text parity test.
- `builderStore.test.ts` (77): untouched (no store change).
- `useTemplateFirstDraft.test.tsx:751` forbids `setShowReceipt` in that source: untouched.
Backend:
- `tests/unit/test_publish_service.py` (`:456`, `:588`, `:685`, F-3 copy fence `:635`): extend with timeout cases; default 300 must stay green.
- `tests/unit/test_182_validate.py` (the `/validate` interactive finding), `test_182_severity_codes.py` (untouched if no new `LintError`).
- `tests/test_188_workflow_run_read.py` (not in the baseline gate), `tests/test_200_human_gate_pause.py`, `tests/unit/test_187_armed_checkpoint_property.py`, `test_185_engine_attachment.py` (SEED-137 coupling).
- Baseline gate: `pytest tests/unit -q --continue-on-collection-errors` must stay <= 71 failed (zero headroom); frontend gate: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from repo root, re-derive, never quote; typecheck `npx tsc -p tsconfig.app.json --noEmit` with a set diff vs base.

### 6. Validation (nyquist_validation is false in config; this section answers the request)
**G-4 scenarios (D-14), each with a failure the operator would recognise:**
- S1: generate -> rename -> dismiss arrival -> library -> reopen -> hard reload -> reopen. Recognise failure: no Draft settings row, name field absent, name reverted, node field reverted. Evidence: screenshot + `document.querySelectorAll('[data-testid="decision-name-input"]').length` (SEED-183's mechanical check, was 0) + DB row.
- S2: Section 1 steps, both directions.
- S3: publish an `llm_human_input` workflow (real gauntlet, real provider golden run; shows the auto-answered note), start a run, wait: sentence shows the real display name and the step name (not an id/UUID/email the person never chose); reload; present; wait past the window (set `timeout_seconds` low, e.g. 30, which is legal) -> status "paused" wording; reload; present; answer; run completes. Note "(you)" appears for the owner.
- S4: planted unbounded waits (below), via the gauntlet UI AND `POST /workflows/validate`.
**Planting the RED definition:** create a draft via `POST /workflows` (or edit a draft row's JSON in the Supabase SQL editor, local DB, with approval for any write) with a phase `{"slug":"approve","phase_index":0,"config":{"phase_type":"llm_human_input","prompt":"Approve?","timeout_seconds":0}}` (also `-5`, `99999`, and `1801`); `business_requirement` set. Use `_interactive_definition_row(kind="llm_human_input")` (`test_publish_service.py:392`) as the template. Drive RED FIRST: before the lint exists, `0`/`99999` publish (`validate` returns no interactive finding); after, each is refused at stage "Pause" with a worded message, and `300`/`1800` still publish. Record in SUMMARY. Also keep the planted `on_failure:"ask_user"` validator case green-refused.
**UAT four axes (D-16, VALIDATION.md, derive roster from `MODEL_CAPABILITIES`, one newest registry-backed id per provider group: OpenAI, Anthropic, Google, DeepSeek, Zhipu/GLM, MiniMax, Moonshot/Kimi, plus OpenRouter):** drive each as a per-request `model`+`provider` on `POST /threads/{id}/messages`, read verdicts from `workflow_runs`/`workflow_phases`/`harness_audit`; the pause workflow's non-pause steps exercise provider emission. Multi-tool row (2+ tools in one prompt), parallel-thread row (thread A paused/streaming while B takes a prompt: the waiting line must belong to A's run only), long-message row (>=50 prior messages or >=5 KB prompt). Rows blocked by missing keys are recorded as blocked with reason.

## State of the Art

| Old | Current | When | Impact |
|-----|---------|------|--------|
| "interactive phases can't validate synchronously" (stage copy, STAGES `what`) | Golden run auto-answers a pause | 200.3, 2026-08-24 | Copy is stale in two files. |
| Pause = failure (`fail_phase`) | Pause = `paused` run, phase stays active, prompt pending | Phase 200 D-10 | D-11 copy must say "still waiting". |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | In-flight autosave from A cannot write to B (loop owns its own `draftIdRef`; not driven live) | Sec 1 | Low; the browser drive S2 covers it. |
| A2 | Showing a non-viewer's email is unwanted; fall to the generic phrase | Contradiction C3 | Operator may prefer email; one-line change. Needs confirmation before 289 opens the page. |
| A3 | Deriving the auto-answered note from `_golden_run_mock` in phase outputs is available after the golden run in `publish_workflow` (output persisted whole by `_persist_output`; not read live) | Sec 3 | If outputs are stripped, fall back to a static scan of `llm_human_input` phases. |
| A4 | Local stack is up for the live drives (54322, 6379, 8000 open at research time; 5173 closed, vite binds IPv6 only per memory) | Env | Operator/agent starts `npm run dev`; user starts backend per memory. |
| A5 | `workflow_runs.user_id` is selectable under the user-JWT client (the filter `.eq("user_id", ...)` already works) | Sec 4 | Trivial. |

## Open Questions

1. **Whether the cross-draft bleed reproduces in a real browser.** Reading says no. The S2 drive is the answer; if it reproduces, the cause is NOT the store (look at `WorkflowsPage` state, the nudge `sessionBucket`, or an in-flight save).
2. **Does `prompt_line` belong in the field for 289's non-owner viewers?** Deferred to 289; build it separable.
3. **Should the lint message surface the 30-minute ceiling to authors?** Recommended yes (states allowed range); wording is the planner's.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | frontend tests/gates | yes | v24.19.0 | none needed |
| backend venv | pytest | yes | `backend/venv/Scripts/python.exe` | none needed |
| Postgres (local Supabase) | live drives, planted definitions | port 54322 open | - | `scripts/start-local-infra.ps1` |
| Redis | ask_user pub/sub, run buffer | port 6379 open | - | `docker compose -f docker-compose.dev.yml up -d` |
| Backend (uvicorn) | S3/S4 | port 8000 open | - | operator starts it |
| Vite dev server | S1/S2 | port 5173 CLOSED (vite is IPv6-only, probe may be misleading) | - | start `npm run dev` |
| Chrome MCP | G-4 drives | not probed | - | operator drives |
| Provider keys for the roster | UAT rows | not probed | - | record blocked rows with reason |

## Validation Architecture
`workflow.nyquist_validation` is `false` in `.planning/config.json`; the formal section is skipped. Test infrastructure present: vitest (count gate) and pytest. Quick commands: `cd backend && venv/Scripts/python -m pytest tests/unit/test_publish_service.py tests/test_188_workflow_run_read.py -q`; frontend targeted: `cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/workflows/DraftArrivalCard.test.tsx src/components/workflows/DecisionsList.test.tsx`; full gates once per wave (see Section 5). Wave 0 gaps: none (all frameworks exist); new test files are additive.

## Security Domain

`security_enforcement` is true.

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V4 Access Control | yes | `waiting_on` is built only AFTER the id+user_id ownership select; profile/prompt reads are keyed by the run id from that row; failure degrades to `None`, never a 500 or a wider read. Pool reads bypass RLS so the WHERE is the boundary (same note as `pause_run`). |
| V5 Input Validation | yes | Lint on `timeout_seconds` (int already typed); prompt first line and display name must be scrubbed (strip control/format chars, clamp length) like `_clean_label` before composing a sentence; rendered as text, never HTML. |
| V8 Data Protection | yes | Do not expose a non-viewer's email (C3); `prompt_line` is run content. |

Threat patterns: ID/email disclosure via the sentence (mitigate: server composes, fallback phrase); prompt injection into the sentence (display name is user-controlled: scrub + clamp); an enumeration probe (keep 404-for-foreign-id single path, unchanged); gate loosening (the new lint only adds refusals; `ask_user` validator refusal untouched, SEED-137 tests re-run).

## Sources

### Primary (HIGH, read in this session)
- `288-CONTEXT.md`, `ROADMAP.md` Phase 288, `REQUIREMENTS.md` AUTH-01/AUTH-03
- `.planning/seeds/SEED-183`, `SEED-164`, `SEED-137`; `200.3-VERIFICATION.md`
- `docs/HOT-FILE-LEDGER.md` 286 forecast/seam sections for the five files (lines ~21832-22010)
- Code: `WorkflowBuilderPage.tsx` (654, 687, 741, 827, 1632-1707, 2094-2173), `builderStore.ts` (321-370, 831), `BuilderStoreProvider.tsx`, `DraftArrivalCard.tsx` (227-320, 536-575), `DecisionsList.tsx`, `decisionsVocabulary.ts`, `WorkflowsPage.tsx` (660-740, 812-820, 860-1000), `WorkflowDoorSwitch.tsx`, `useDraftPersistence.ts`, `canvasNudge.ts`, `PublishGauntlet.tsx` (196-262, 320-380, 1060-1200), `WorkflowRunPage.tsx` (370-420, 770-830, 1270-1300), `publish_service.py` (180-330, 330-620, 1255-1290), `human_input.py` (full), `harness_engine.py` (2397-2455), `db/workflows.py` (1744, 2176, 2247), `api/panel.py` (116-230), `api/runs.py` (590-660), `api/workflow_runs.py` (296-378, 722-1030), `api/workflow_wire.py` (295-320), `api/workflows.py` (925-955, 1090-1146), `models/harness.py` (128-135), `full-schema.sql` (profiles)
- Tests read: `test_publish_service.py` (389-460, 640-690, 1195-1260), `WorkflowBuilderPage.canvas.test.tsx` (2530-2630, 3886-3935), `DraftArrivalCard.test.tsx` (461-560), `WorkflowRunPage.test.tsx` (2299-2345), `WorkflowBuilderPage.seam286.pin.test.tsx`, `vitest-count-gate.cjs` pins

### Secondary / not verified
- Nothing in this document was driven in a browser or against the live DB this session; all "reproduces/does not" statements are by reading.

## Plan implications

1. **Plan A (draft surface, frontend only):** (a) S2 bleed drive first, record result; (b) one optional prop on `DraftArrivalCard` + one prop at the page call site + new neutral words in `decisionsVocabulary.ts`; (c) deliberate re-baselines: canvas `:3922` case, seam286 `grid-flag-on` snapshot; add a regression test "A then B then A: no bleed" and a "re-opened draft shows the row, not the arrival card" test; (d) `builderStore.ts` untouched (assert numstat empty); `showReceipt` setter count stays 1.
2. **Plan B (gauntlet, backend + one FE block):** timeout check in `_interactive_phase_failures`; drive RED first against planted `0` / `-5` / `99999`; optional `auto_answered` on success dict + `PublishVerdict` + TS type + one block in `PublishGauntlet.tsx` beside `golden-no-send`; reword the stale "Pause" stage text in `PublishGauntlet.tsx:212` AND `landing/facts.ts:144`; copy fence: no `llm_human_input`/`ask_user`/slug in messages; re-run SEED-137 tests.
3. **Plan C (waiting-on, backend + frontend):** unanswered-prompt read (new function, NOT the existing `get_pending_ask_user`), owner `user_id` added to the run select, profile read, field declared+produced+typed in lockstep, one render in `WorkflowRunPage.tsx` beside `band.sentence` (prefer a leaf component), covers both `active` and `paused`; fixtures without the field must leave the seam286 run snapshots byte-identical.
4. **Plan D (live proof, serialised if it mutates the local DB per CLAUDE.md rule 4):** S1-S4 in Chrome, UAT roster rows, VALIDATION.md, ledger rows and detail sections updated in the same commits as each hot-file touch, STATE.md guardrail overrides (G-2 skip).
5. Plans A and C touch disjoint files and can share a wave; B and C both touch `api/workflow_wire.py`/`api/workflows.py` family only through different models (disjoint) but both edit backend wire files: check `files_modified` for overlap before parallelising. Backend and frontend suites run targeted per task, full gates once per wave (G-8).
6. Run `node scripts/check-hot-file-ledger.cjs <phase-dir>` on the PLAN files; candidate rows needed or present: `WorkflowBuilderPage.tsx`, `PublishGauntlet.tsx`, `publish_service.py`, `WorkflowRunPage.tsx`, `workflow_runs.py`, `db/workflows.py`, `types/index.ts`, `lib/api/workflows.ts`, `lib/api/knowledge.ts`, `landing/facts.ts`, `DraftArrivalCard.tsx`, `DecisionsList.tsx`, `decisionsVocabulary.ts`, `human_input.py` (only if touched), `api/workflow_wire.py`, `reachability.py` (should NOT be touched).
7. Put the operator-confirmable items in the plan's checkpoint: A2 (email fallback for non-owners) and whether the lint message exposes the 30-minute ceiling.
8. Do not edit `reachability.py`, `builderStore.ts`, `SeedReceipt.tsx`, or `human_input.py`; if a plan finds a reason to, it is a scope signal.

## Metadata

**Confidence breakdown:**
- Standard stack / architecture: HIGH (all existing code, read at file:line)
- Bleed verdict: HIGH for the store/persistence path, MEDIUM until driven in a browser
- Waiting-on design: HIGH on storage and state machine, MEDIUM on the privacy call (A2)
- Pitfalls: HIGH (each cites the pinning test or source line)

**Research date:** 2026-10-19
**Valid until:** 2026-11-02 (hot files change fast; re-derive line numbers before editing)
