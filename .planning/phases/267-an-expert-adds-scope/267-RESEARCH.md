# Phase 267: An Expert Adds Scope - Research

**Researched:** 2026-09-25
**Base commit measured:** `92b5476be` (develop, HEAD at research time)
**Domain:** Expert scoping as run data (tool floor, scope composition), transcript system events, server overlays, an LLM summary service, chat composer/dialog UI
**Confidence:** HIGH on code paths, test impact and baselines, all read or run in this session. MEDIUM on the recommendations for the three open decisions (OQ-1..OQ-3).

## Summary

Most of the phase's design holds against the code. The core move is sound: `_resolve_thread_scoping` returns `effective_tools=None` for an Expert thread, so the Expert thread's advertised tools become **identical** to a plain thread's. Today 15 of the 28 chat tools are stripped (measured: `attach_skill_file, fetch_document_file, get_related_documents, query_documents_by_view, query_tables, recall, remember, save_skill, task, web_search, workspace_delete, workspace_diff, workspace_list, workspace_read, write_todos`). Registry inventory at base: **7 phase types / 1 emitter / 29 tools / 2 programmatic fns**. `render_template` is the one registered tool not in chat `get_tools()`.

Research **refutes one CONTEXT claim outright and qualifies four others.** The planner must resolve these before writing tasks:

1. **REFUTED — D-267-01 / D-267-03: "the Expert's `required_connections` add to it through the normal connector-tools path".** The normal path advertises only the connections the user switched on in the composer (`body.active_connector_ids`). An absent or empty list means **none** (`agent_loop.py:1640-1662`). With `effective_tools=None`, an Expert thread gets exactly what a plain thread gets. The union fence (Expert ⊇ plain) passes, but the "**plus its own**" half of PACK-21 / SC#1 is **not** delivered unless the Expert's connections are added explicitly. → **OQ-1.**
2. **NEW DEFECT — the authoring studio writes connection NAMES into `required_connections`.** The code is `ExpertAuthoringStudio.tsx:1114-1121`, which toggles `c.name`. The drafter writes `service_id` (`api/experts.py:321-324`). The resolver matches only `service_id` OR `capability` (`expert_service.py:531-547`). So a hand-picked connection is **always** stripped as "not connected", and PACK-22 built on that rule would show `Requires Notion — not connected` for a connected service. → **OQ-2.**
3. **QUALIFIED — D-267-14 "the same entitlement, access and install/connection gates as PATCH".** PATCH has **only** entitlement + access (`threads.py:716-751`). It **skips both** when `resolve_active_org_or_none` returns `None`, which is fail-open, and a shipped test pins that success path (`test_260_expert_chat_scoping.py:196-238`). There is no install or connection gate server-side (266 and D-267-07: UI gate only). → **OQ-3.**
4. **QUALIFIED — "no `if expert:` in the loop".** The actual fence is **stricter**. `test_260_expert_chat_scoping.py::test_agent_loop_closed_core_ast_invariant` fails on **any** `ast.Name`, `ast.Attribute` or function name containing `expert` anywhere in `agent_loop.py`. Every new constant or `RunContext` field that `agent_loop.py` touches must be **neutrally named** (e.g. `TRANSCRIPT_ONLY_KINDS`, not `EXPERT_EVENT_KINDS`).
5. **NOT IN SCOPE, BUT NOT ADDITIVE EITHER — the skill axis still replaces.** `skill_catalog_override` = the Expert's skills **only**, with no DB query (`agent_loop.py:1445-1459`, `run_producer.py:526-531`). SEED-303's own table lists Skills as "override catalog → wants additive". No D-267 decision covers it, so "only ever adds" is untrue on that axis. Route it with the operator (fold or seed); do not fix it silently. → **OQ-4.**
6. **CONFIRMED — D-267-21.** An invite on a brand-new chat is lost, and the first run is **unscoped** (full trace in §D-267-21).

**Primary recommendation:** five wave-sized plans (§Plan breakdown). Extract **one** pure scope function and **one** connection-state function first. Everything else (run, preview, event payload, overlay) reads those two, so the statement and the run cannot disagree. No migration is needed; the next free number would be **197**.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Tool floor (PACK-21) | API/Backend: `run_producer` resolves data | agent loop consumes data | Scoping stays DATA handed to the loop (D-260-05). The loop has no Expert branch (AST fence) |
| Expert connection tools (OQ-1) | API/Backend (`run_producer` → neutral `RunContext` field → connector block) | — | Grant surface (SEED-146): must be decided server-side, fail-closed |
| Connection status overlay (PACK-22) | API/Backend (`api/experts.py` overlay, org-bound SQL) | Browser: `expertCatalog.ts` selectors render it | The UI never decides readiness (266 T-266-26 precedent) |
| Transcript event (PACK-23) | API/Backend: `rename_thread` writes a `messages` row | Database: `messages` role CHECK already allows `system` | Persisted row, so it survives reload. Realtime is not used for messages |
| Event rendering | Browser (`MessageItem` → `ExpertEventCard`) | — | One kind check. Words from one vocabulary module |
| History exclusion (D-267-10) | API/Backend (`_reconstruct_history`) | — | One allowlist constant, one home |
| Handoff summary (PACK-24) | API/Backend service (`services/thread_handoff.py`) | provider gateway via `forced_emit` | A service, not a tool (red line). Not in `expert_service.py` (AST fence) |
| Handoff atomicity | Database (asyncpg txn via `get_user_pg_connection`, RLS as caller) | — | "Nothing was created" must be true on failure |
| Restricted-cost preview (PACK-25) | API/Backend (pure `compose_expert_scope` + RLS count) | Browser `ScopeLedger` | The same function feeds the run and the statement |
| New-thread-with-Expert gate (D-267-21) | API/Backend (`POST /threads`) | Browser (`createThread` carries the id) | A server gate, not only a client gate |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(Verbatim from `267-CONTEXT.md` `<decisions>`.)

#### Tool floor (PACK-21)
- **D-267-01: An Expert stops computing a tool list.** `run_producer._resolve_thread_scoping` hands the loop
  **no tool filter** for an Expert thread (`effective_tools = None`, the same value a plain thread gets). The
  thread keeps its normal tool set, and the Expert's `required_connections` add to it through the normal
  connector-tools path.
  - `EXPERT_CORE_TOOLS` / `EXPERT_DELIVERABLE_TOOLS` stop being a runtime filter. The planner decides whether to
    delete the constants or keep them only as documentation. A dead constant must not look live, so if one is
    kept its comment must say it is not read.
  - Rejected: widening `EXPERT_CORE_TOOLS` to all 29 tools. That is a second encoding of the tool set, which
    drifts. It is ROADMAP's own "how we'd know this failed" line.
- **D-267-02: `tool_floor_enabled` keeps its column, stops being read, and loses its studio toggle.** "Off" can no
  longer remove tools. The model and API field may remain for compatibility, and the planner decides how it is
  documented. No migration is needed for this.
- **D-267-03: Connector tools on Expert threads come back as a side effect.** Today the exact-match filter at
  `agent_loop.py:1696-1703` compares bare slugs (`hubspot`) against namespaced tool names (`hubspot__search`), so
  it drops every connector tool on an Expert thread. D-267-01 removes that filter. A fence test pins that an
  Expert thread's connector tools equal the plain thread's.
- **D-267-04: Proof has three parts:**
  1. **Union fence:** for the same context, the Expert thread's advertised tools ⊇ the plain thread's.
  2. **Inventory:** the 29-tool count, checked by AST and not by substring.
  3. **Live SC#10 cross-provider board:** 8 rows (the full native roster plus OpenRouter, derived from
     `MODEL_CAPABILITIES`). Each drives an Expert thread with a prompt that needs a previously stripped tool
     (`web_search` or `workspace_read`). A row may be marked blocked with its reason. No row may be left out.

  `max_tools` (Gemini 16) is applied only on the harness/sub-agent path (`apply_tool_budget`), never on chat, so
  an Expert thread now matches a plain chat thread (~28 tools). The board's Google row is the check.

#### Required connections (PACK-22)
- **D-267-05: Connection status is a server overlay on the Expert list/get responses**, following the 266
  `overlay_install_state` pattern in `api/experts.py`. Each required connection comes back as
  `{slug, name, connected}`.
  - The "is it connected" check is **extracted from `resolve_expert_bundle`**
    (`expert_service.py:527-558`, org-level `connector_connections` with `is_enabled AND status='active'`,
    matching `service_id` OR `capability`). The overlay and the resolver call that one function. ⛔ No second
    copy of the rule.
- **D-267-06: Invite and Start Chat are BLOCKED while any required connection is missing.** The reason is
  **visible at rest**: "Requires HubSpot — not connected". It appears on `ExpertCard`, on `ExpertDetailModal`,
  and on the `InviteExpertDialog` row. The gate extends the existing `inviteGate()` / `installView()` selectors
  in `expertCatalog.ts`, so there is one home for gate wording.
  - Admins (`experts:manage` / org-manage) see **"Connect HubSpot →"**, which navigates to the Connections page.
  - Members see **"Ask an org admin to connect HubSpot"**. Only admins can create connections
    (`api/connectors.py:476-485`), so a member never gets a button that does nothing.
- **D-267-07: The UI gate is the only gate (266 precedent).** The run-time behaviour stays as it is: a missing
  connection is stripped fail-closed in `resolve_expert_bundle`, and the run does not fail. `PATCH /threads`
  gains no refusal.
- **D-267-08: The connect link opens the Connections page, not a specific service.** A deep link to one service
  is deferred. `ConnectionsTab` takes no props today.

#### Swap / remove transcript event (PACK-23)
- **D-267-09: The event is a `messages` row with `role='system'` and discriminator
  `tool_calls[0].kind = 'expert_changed'`.** This is the existing system-row pattern (full-schema comment near
  :2204). The server writes it inside `PATCH /threads/{id}` (`rename_thread`, `api/threads.py:706-771`) when
  `active_expert_id` actually changes.
  - `GET /snapshot` and `GET /messages` currently `.neq("role","system")`. They are widened to let
    **this kind only** through, using an allowlist constant in one home.
  - `MessageResponse.role` and the frontend `role` type gain the case, typed narrowly.
  - Rejected: a new `thread_events` table, because it needs a migration and a second transcript source.
- **D-267-10: The event never reaches the model.** Providers treat persisted system rows differently today:
  Anthropic drops them, Google merges them into `system_instruction`, and OpenAI Responses keeps them inline. So
  history reconstruction filters out transcript-only kinds, using the same constant as D-267-09. The next turn's
  system prompt already carries the new Expert, so the model loses nothing.
  - ⚠ This touches `agent_loop.py` `_reconstruct_history` (G-5, honoured by construction: one kind check, no
    `if expert:`).
- **D-267-11: The consequence is a structured payload rendered from one vocabulary module.** The payload is
  before/after: Expert name, scope mode, folder names, and connections added or dropped. The frontend renders
  words such as "From your next message: … will be used / will no longer be used".
  - ⛔ Test that the words appear visibly **at rest** (266 UI-3 lesson: presence is not visibility).
  - The event survives reload because it is a persisted row read back by the snapshot.
- **D-267-12: Add, swap and remove all write an event, but only once the thread has ≥ 1 message.** An empty
  thread keeps the existing spotlight card (sketch 260 Variant A) as its announcement.

#### Ask a second Expert (PACK-24)
- **D-267-13: The entry point is the existing invite dialog.** When an Expert is already active, each other row
  offers **Swap here** and **Ask in a new chat**. There is no new top-level composer control (sketch 260 rule).
  - ⚠ **Wording superseded by D-267-27** (sketch pick): the buttons read "Replace <active>" / "New chat with
    <Expert> →". The behaviour is unchanged.
- **D-267-14: One server endpoint, `POST /threads/{id}/handoff {expert_id}`.** It writes an LLM summary of the
  source thread through a **service**, following the `services/thread_title.py` precedent. This is not a tool,
  so the red line holds. It then creates the new thread and sets its Expert **in one request**.
  - It runs the same entitlement, access and install/connection gates as `PATCH /threads`.
  - Doing it in one request is also the double-submit fix for this path (SEED-309 R265-262-04's shape).
- **D-267-15: The summary is the new thread's first message, `role='user'`, carrying a `handoff` marker.**
  - The UI renders it as a handoff card (source thread title plus the summary), not as a user bubble.
  - Every provider receives it identically as user content.
  - The planner picks where the marker lives (for example `tool_calls[0].kind='handoff'` or a metadata key), as
    long as it is one home.
- **D-267-16: The original thread keeps its Expert and gets an event, "Asked <Expert> in a new chat →", which
  opens the new thread.** The app has no router, so the link uses `selectThread`.
  - If the summary fails, the handoff is **refused with the reason**. It never creates a thread with no context
    (ROADMAP failure mode).

#### Restricted cost (PACK-25)
- **D-267-17: The scope composition moves into one pure function.** It is currently inline at
  `run_producer.py:502-516`: restricted = the Expert's folders only; biased = the thread subtree ∪ the Expert's
  folders. Both the run and a new preview read that function, so the statement and the retrieval cannot
  disagree.
  - The preview (planner picks the shape, for example
    `GET /threads/{id}/expert-scope-preview?expert_id=`) returns: `mode`, the Expert's folder names, and the
    excluded KB documents as a count plus up to 5 names.
  - "Excluded" means documents in the thread-folder subtree minus the Expert's folder set, when
    `scope_mode='restricted'` and `threads.folder_id` is set.
- **D-267-18: The statement shows on the restricted row in the invite dialog, before confirming.** Example:
  "HR Advisor reads HR Policies only. The 4 documents in this chat's folder will not be used." The PACK-23 event
  repeats it once the invite is made.
  - A restricted Expert opened from the catalog into a **new** thread (no folder) states only what it reads.
- **D-267-19: Only knowledge-base documents are counted.** The statement also says **chat attachments stay
  readable**. That is true once D-267-01 restores `workspace_read` / `workspace_list`, and restricted mode never
  applied to them.
- **D-267-20: Proof is a live drive.** The next run's retrieved chunks carry no folder from the excluded set, and
  the stated count matches the count read directly from the DB.

#### Also folded
- **D-267-21: An invite made on a brand-new chat, before the first message, is probably lost.**
  `MessageInput.tsx:171-198` PATCHes only `if (threadId)`. `ChatArea.handleSend` (:433-457) creates the thread
  without the Expert, and the hydration effect (:241-258) then clears it. The frontend `createThread(title,
  folderId)` has no Expert parameter, and `POST /threads` already accepts `active_expert_id` but runs **no**
  access or entitlement check (`threads.py:672`).
  - If research confirms the defect, fix it in this phase: `createThread` carries the Expert, and
    `POST /threads` gains the same gate `PATCH` has.
  - If it is refuted, record it and move on.

#### Guardrails and process
- **D-267-22: G-2, sketch first, operator picks.** A 2-variant HTML sketch of the four new states (required
  connection, cost statement, swap event, handoff card) is built before planning. The operator's pick is the
  acceptance bar. Load `sketch-findings-agentic-rag` first and reuse sketch 260's announcement / return-notice
  vocabulary.
- **D-267-23: G-5, honoured by construction** (operator). This phase modifies firing files: `tool_dispatcher.py`,
  `agent_loop.py`, `run_producer.py`, `api/threads.py`, `api/experts.py`, `ChatArea.tsx`, `MessageInput.tsx`,
  `MessageItem.tsx`, `InviteExpertDialog.tsx` and the catalog files.
  - Every change is additive or a removal, and none adds a branch keyed on Expert inside the loop.
  - Each touched file's ledger row is re-derived and updated **in the same commit** as its
    `docs/HOT-FILE-LEDGER.md` section.
  - The owed seams (`tool_dispatcher` / `agent_loop` prompt assembly) stay owed and are named, not taken.
- **D-267-24: Four of SEED-309's items fold in.** SEED-309 flips to `partially-answered` with the rest named:
  - **Folded:** R265-262-04 (Start Chat in-flight guard), R265-262-03 (a test of ChatLayout's real
    `onStartChat` wiring), R265-audit-fixes-03 (`rename_thread` org-role test) and R265-audit-fixes-06
    (chat-send entitlement refusal message test).
  - **Stay deferred:** R265-262-06, R265-audit-fixes-10 and -13. Re-open trigger: the next phase touching the
    grant/authoring surfaces.
- **D-267-25: G-8.** Target 4-5 wave-sized plans. The five requirements are not five plans.
- **D-267-26: G-4 lived-experience scenarios** are set with the operator at the sketch pick, before planning, and
  driven in Chrome at verification.

#### G-2 winner and G-4 scenarios (operator, 2026-09-25, at the sketch pick)
- **D-267-27: G-2 winner = sketch 267 Variant B, "Will / won't ledger"**
  (`.planning/sketches/267-an-expert-adds-scope/`). It is the acceptance bar for every new state:
  - `Brings` / `Missing` for connections.
  - `Will use` / `Won't use · N` (files named, attachments listed as *Will use*) for a restricted invite.
  - A timestamped event card with `Now` / `Dropped` lines for a swap or removal.
  - "Replace <active>" / "New chat with <Expert> →" in the dialog.
  - `Here` / `Open →` in the original thread after a handoff.

  ⛔ Both lists render from ONE structured payload, never two computed strings.
- **D-267-28: G-4 lived-experience scenarios, driven in Chrome at verification:**
  1. Invite Financial Analyzer into a thread and ask it to search the web and write a file. Both work.
  2. Swap to HR Advisor (restricted) in a folder-scoped chat, then reload. The event card and "Won't use · 4" are still
     there, and the next answer cites no excluded document.
  3. "New chat with Contract Reviewer". The new thread opens with a handoff card naming the first thread's facts, and
     the original thread keeps its Expert.

### Claude's Discretion
- The exact route shapes and response models (preview, handoff, overlay field names).
- The model and prompt used for the handoff summary (`thread_title.py` precedent), and its length cap.
- Whether `EXPERT_CORE_TOOLS` / `EXPERT_DELIVERABLE_TOOLS` are deleted or kept as marked documentation.
- The exact copy, within the shipped Expert vocabulary and the sketch the operator picks.

### Deferred Ideas (OUT OF SCOPE)
- A deep link to one service's connect form (`ConnectionsTab` takes no props).
- A server-side refusal in `PATCH /threads` for a missing required connection (D-267-07 keeps the UI gate only).
- `dispatch_tool` refusing tools that were never advertised. With no Expert filter it is moot here, but chat has
  no dispatch-side whitelist (`tool_dispatcher.py:1591-1595`). Note it for SEED-303.
- SEED-309 items R265-262-06, R265-audit-fixes-10 and R265-audit-fixes-13 (see D-267-24).
- SEED-303 S8 (clone-on-customise) stays open.
- Reviewed, not folded: the open `surface: Agentic-RAG` reported bugs (13) have no `affected_areas` overlap.

**Also locked:** `267-UI-SPEC.md` (approved). It fixes component names (`ScopeLedger`, `ExpertEventCard`, `HandoffCard`, `expertEventCopy.ts`, `CONNECTION_COPY`, `connectionGate`), the row-state matrix R1..R10, the test ids, and the exact copy.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACK-21 | An Expert's tools are the thread's normal tools **plus** its own, never fewer | §Tool floor (delete the filter data, 6 test files to re-drive). **OQ-1** (connections are not added by the normal path). Union fence + AST inventory. SC#10 roster derived below |
| PACK-22 | Missing `required_connections` named on card + invite, with a connect flow | `connection_states()` extraction (§Connection state). **OQ-2** (studio stores names). Overlay as a NEW key, not a mutation of `required_connections`. `can_connect` = `org:manage` ∧ `live_connectors` visible |
| PACK-23 | Swap/remove writes a transcript event naming its consequence, survives reload | `messages` role CHECK allows `system` (no migration). Allowlist constant. `_reconstruct_history` skip point. RLS-insert via user JWT. Explicit `org_id`. Existing `rename_thread` tests pin the exact `aexec` sequence |
| PACK-24 | "Ask a second Expert" opens a new thread with a handoff summary | `forced_emit` + Pydantic summary in `services/thread_handoff.py`. Model resolution via `resolve_run_model`. Atomic writes in one asyncpg txn. A user-role marker row is safe in every history reader |
| PACK-25 | A restricted invite states which thread documents it will not read | Pure `compose_expert_scope()` (byte-identical to `run_producer.py:502-516`). RLS count with retrieval's own filters (`is_latest`, `source_state`) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python `venv` (`backend/venv`). Raw SDK calls, **no LangChain/LangGraph**. **Pydantic for structured LLM output.**
- **RLS on every table.** A user-JWT client for request-scoped reads and writes. `run_in_threadpool` / `aexec` for any sync supabase-py call inside async handlers (D-v2.5-01).
- Stream chat via SSE. Stateless completions (history is ours).
- Migrations: numbered `supabase/migrations/<digits>_name.sql`, pasted into the SQL editor, then `bash scripts/regenerate-full-schema.sh`. **None is needed this phase** (next free: `197`).
- **Backend unit gate (MANDATORY):** `pytest tests/unit -q --continue-on-collection-errors`, ceiling **71 failed, 0 collection errors**, zero headroom.
- **Frontend typecheck:** `npx tsc -p tsconfig.app.json --noEmit` as a **set diff** (never `tsc --noEmit`, which checks 0 files).
- **Vitest count gate:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root. New suites are adopted into **both** knobs (`TARGETS` + `BASELINE`).
- **G-5:** `node scripts/check-hot-file-ledger.cjs 267`. Rows are added **at creation** for new files. Row + section are updated in the **same commit**. The disposition cell must be ≤ 200 chars.
- **G-8:** 3-5 plans. Per plan, run targeted suites; run full gates once per wave. Never cut the verifier, TDD RED drives, security review or migration discipline.
- **Extension Contract:** no new executor/emitter/programmatic fn/tool. `_TOOL_REGISTRY` stays at 29.
- **Provider-docs-first + SC#10 full native roster + OpenRouter**, derived from `MODEL_CAPABILITIES`. Rows may be blocked, never omitted.
- **Worktrees:** bootstrap first (`bash scripts/bootstrap-worktree.sh "$(pwd)"`). Teardown via script only. Serialize plans that mutate the local DB.
- **Supabase MCP:** reads are free, writes need per-action approval.
- **Realtime is a hint.** Reconcile by fetch.

## Tool floor (PACK-21): what exactly changes

**Today** (`run_producer.py:518-524`): `effective_tools = sorted(EXPERT_CORE_TOOLS ∪ [EXPERT_DELIVERABLE_TOOLS if tool_floor_enabled]) + resolved.effective_connections`.
**Filter** (`agent_loop.py:1696-1703`): keeps only schemas whose `function.name` is in that set. It runs **after** the connector block (`:1609-1693`), so it also drops every `service__tool` connector schema, because `effective_connections` are bare slugs.

**Change:** return `None` in the 2nd slot. **Keep the 5-tuple arity.** Five test sites unpack exactly five values (`test_260_expert_chat_scoping.py:84,127`, `test_261_expert_runtime_scoping.py:163,207`, `test_260_financial_analyzer_conversation.py:~374`, `test_261_expert_authoring_scenarios.py:~285`, plus 264/266 tests). If OQ-1 adds a connection-key carrier, add it as a **6th** element only with every unpack site updated in the same commit, or carry it on `ResolvedExpertBundle`/`RunContext` another way.

**The `RunContext.effective_tools` field + the `:1697` filter:** after 267 no producer sets it. Recommend **keeping the field** (default `None`; `test_260_expert_chat_scoping.py::test_run_context_carries_scoping_data` constructs it) with a comment "no producer since 267". Either keep the filter block as an inert seam or delete it together with that test. Either way, state it in the ledger row.

**Readers of the tool-floor names (complete grep, base commit):**

| Reader | What it does | 267 action |
|---|---|---|
| `tool_dispatcher.py:4746-4775` | defines both constants + module-scope `assert ⊆ _TOOL_REGISTRY` | delete (recommended) or mark "not read" |
| `tool_dispatcher.py:1434, 1591-1595, 1733, 2350` | comments citing the constants | correct. **`:1591` reason #1 becomes false** (`save_skill` IS advertised to Expert threads after 267) |
| `run_producer.py:518-524` | the only runtime reader | remove |
| `agent_loop.py:268, 1697-1703` | field + filter | inert (see above) |
| `expert_service.py:28,62,568` · `db/experts.py:88,115,139,376` · `models/expert.py:57,116` · `expert_authoring.py:73,140,306` | `tool_floor_enabled` carried through create/update/draft | keep the column (D-267-02). Fix the `Field(description=…)` text + drafter prompt line 140 ("so deliverable tools … are active") because it is now false |
| `ExpertAuthoringStudio.tsx:111,272,443,462,827-908,1504-1509` | state + toggle + preview indicator | remove the toggle block (`:890-908`) + indicator (`:1504-1509`). ⚠ This leaves imports unused → new `TS6133` in the tsc set diff. The file already has 3 base errors (`useMemo`, `HelpCircle`, `ExpertGrant`) |
| `lib/api/experts.ts:17,45,123` · `types/index.ts:35` | optional field | keep |

**Tests that pin the stripping (must be re-driven in the SAME plan, or the gate breaks):**

| File | Hazard |
|---|---|
| `tests/unit/test_261_expert_runtime_scoping.py:12` | **module-level import** of both constants → **collection error** if deleted. Tool-floor True/False tests (`:140-224`) |
| `tests/unit/test_261_expert_authoring_scenarios.py:31` | **module-level import** → collection error. Scenario asserts at `:297-300`. Its `rename_thread` scenario (`:573-600`) returns one `AsyncMock` for every `aexec` |
| `tests/unit/test_261_closed_core_inventory.py:9, 56-60` | **module-level import**. `len(EXPERT_CORE_TOOLS)==10` |
| `tests/unit/test_259_closed_core_inventory.py:103-110` | function-local import + len==10 |
| `tests/unit/test_260_financial_analyzer_conversation.py:343-390` | asserts `EXPERT_CORE_TOOLS ⊆ tools`, `"slack_notify" in tools` |
| `tests/unit/test_260_expert_chat_scoping.py:98-143` | asserts `"search_documents" in tools`, `"github__read" in tools` |
| `tests/unit/test_264_load_skill_born_for.py:407-429` | **source-token test**: the 12-line window above the `_sibling_filter` call must contain `EXPERT_CORE_TOOLS`, `not advertised`, `lint`. Correcting the (now false) comment breaks it, so update the test to the new reasoning in the same commit |
| `tests/unit/test_266_restricted_empty_scope_refuses.py:34` | builds `ResolvedExpertBundle(tool_floor_enabled=True)`. Harmless |

⚠ **Collection errors count against the gate's "0 collection errors" line.** The baseline reads `71 failed … (0 collection errors)`.

**Union fence (D-267-04 #1):** drive `run_agent_loop`'s tool assembly twice with an identical `ctx` except `effective_folder_ids`/`born_for_bundle_id`/`skill_catalog_override` set as `_resolve_thread_scoping` would set them. Assert `set(names_expert) ⊇ set(names_plain)`, **including** a stubbed armed connector whose `service__tool` schema must appear in both. A simpler equivalent: assert `_resolve_thread_scoping(...)[1] is None` for an Expert, plus an AST fence that no producer passes `effective_tools=` a non-None value. Recommend both: the behavioural half catches a re-introduced filter elsewhere. Drive RED by restoring the old tuple.

**Inventory (D-267-04 #2):** the existing `test_259_closed_core_inventory.py` checks `len(_TOOL_REGISTRY)==29` at import (runtime count, not AST), plus an AST check for `_handle_expert*` handlers. "By AST, not substring" is satisfied by these plus `test_255_extension_contract_guard.py`. The re-count is a run of those two files at base and head.

## Connection state (PACK-22) and OQ-1 / OQ-2

**Extraction (D-267-05).** Move the query + match at `expert_service.py:527-558` into one function, e.g.

```python
# backend/app/services/expert_service.py  (pure data; this file is AST-fenced: no LLM/agent_loop import, no while)
async def connection_states(pool, org_id: UUID | None, required: list[str]) -> list[ConnectionState]:
    """ONE rule: connected ⇔ an org row with is_enabled AND status='active' whose service_id OR capability == slug.
    name = the matching row's `name` (ANY status, e.g. a revoked 'Google Workspace'), else the slug."""
```

`resolve_expert_bundle` then keeps `effective_connections = [s.slug for s in states if s.connected]` and strips the rest (unchanged behaviour). The SQL must read **all** org rows (not just active ones) so a missing service can still be **named**. Measured locally: `google` is `status='revoked'`, named "Google Workspace". Two local Experts require `['google','microsoft']` / `['google','microsoft','notion']`, so they are ready-made PACK-22 fixtures ("Requires Google Workspace — not connected").

**Overlay (D-267-05).** Add to `_overlay_install_state_for_caller` (`api/experts.py:472-489`) **and** to the management arm (`:447-456`), so list (both arms) and `GET /experts/{id}` (`:540-542`) all carry it.
- ⛔ **Add a NEW key** (e.g. `connection_state: [{slug,name,connected}]`, `can_connect: bool`). **Do not replace `required_connections`**: it is `string[]` that the studio round-trips into `PATCH /experts/{id}` for org-authored bundles (266 could replace `knowledge_folder_ids` only because system bundles are not tenant-writable).
- `can_connect`: `_has_org_permission(request, current_user, active_org, "org:manage")` (the permission `POST /connections` requires, `api/connectors.py:476-485`) **AND** `live_connectors` visible. Factor a non-raising `feature_visible(request, user, feature)` out of `require_visible._dep` (`dependencies.py:645-659`) rather than re-encoding it. Ask it only when some row has a missing connection, so the common case costs no extra query (the 266 pattern).
- Client-side alternative (no server change): `useOrg().canManage` (`OrgProvider.tsx:50`) plus the effective-features probe. The UI-SPEC recommends the server flag (R-1). Either is fine, but **never** `experts:manage`.

**OQ-2 — the studio stores names (NEW DEFECT, HIGH confidence).** `ExpertAuthoringStudio.tsx:220` maps connections to `{id, name}` only, and `:1114-1121` stores `c.name`. The drafter stores `service_id` (`api/experts.py:321-324`, falling back to `name` only when `service_id` is null). `ConnectorConnection.service_id` is available (`lib/api/org.ts:539`). The `ExpertDetailModal.test.tsx:72` fixture uses `"Edgar MCP"`, a name. **Recommendation:** (a) the picker stores `service_id` (select/deselect by it, display by name). (b) Before deciding whether `connection_states` should also tolerate legacy **name** values, run a **read-only** production query (Supabase MCP reads are free): `select id, org_id, required_connections from expert_bundles where cardinality(required_connections)>0`. If prod holds names, either match `name` as a third key (and note it) or backfill with an approved write. Local data holds only `service_id`s.

**OQ-1 — Expert connections are not added by the "normal path" (REFUTES D-267-01 sentence 2 / D-267-03's implication).**
- Measured: `agent_loop.py:1659-1662` sets `allowed_ids = body.active_connector_ids or []`, and absent and empty both mean NONE (a deliberate 2026-08-31 grant-surface fix). No frontend code arms an Expert's connections (`grep required_connections frontend/src` → only display counts).
- **Options:**
  - **(a) server data union (recommended):** `_resolve_thread_scoping` carries the resolver's **already approved** `effective_connections` (active + enabled in the caller's org) as a neutrally named `RunContext` field, e.g. `scoped_connection_keys: tuple[str,...] | None`. The connector block admits `c` when `str(c.id) in allowed_ids or (c.service_id / c.capability in scoped_connection_keys)`. Posture (`tool_grants` deny/ask) still applies (`chat_tools.py:42-45`, ask enforced at dispatch). One home, and it covers **all three doors** (composer invite, catalog Start Chat, handoff thread).
  - **(b) client arms the chips on invite.** It is visible at rest in the "Using:" row, but it must be done in 3 doors, and a stale client can skip it.
  - **(c) accept parity.** The ledger then says "Brings: HubSpot, turn it on in Connectors". This contradicts SC#1's "plus the Expert's own".
- ⚠ (a) widens a **grant surface** (SEED-146: "EVERY capability is a WRITE"). Record the operator's choice as a decision before building. With (a), `ActiveConnectorChips` will not show Expert-supplied connections, so the event card's `Now` line and the ledger's `Brings` column become the visible statement. Say so in the UI or the chip row will disagree with the run.

## Transcript event (PACK-23): verified mechanics

- **Schema (no migration):** `messages_role_check` allows `'user','assistant','system'`. `tool_calls jsonb`. `content text NOT NULL`, so write a plain-text sentence too. `origin` defaults `'deep'`. `org_id NOT NULL`, filled by trigger `autofill_org_id_by_owner('user_id')`, **which takes `org_members … LIMIT 1`** (`full-schema.sql:54-84`). ⚠ **For a two-org user that can stamp the wrong org.** The dev account is in two orgs. **Set `org_id` explicitly from `threads.org_id`** on every row this phase writes.
- **RLS:** `"Users can insert their own messages"` = `org_id IN current_user_org_ids() AND auth.uid()=user_id`. `rename_thread` uses `get_user_supabase_client` (user JWT), so the insert passes as the caller. `messages` is in `supabase_realtime`, but **no frontend subscribes to `messages`** (only documents/folders), so nothing reacts. Show the event by **refetching the snapshot** after the PATCH resolves. The trigger `set_threads_updated_at` fires only on `threads` UPDATE; the PATCH already updates the thread, and inserting a message does not touch `threads`.
- **"Actually changes" needs a BEFORE read.** Today `rename_thread` updates first, then reads (`:753-770`). Read `active_expert_id, folder_id, org_id` **before** the update, compare, and write the event only when `before != after` **and** the thread has ≥ 1 `user`/`assistant` row (D-267-12). Consider asyncpg (`get_user_pg_connection`, a txn with RLS as caller) so the update and the event commit together.
- ⚠ **Existing tests pin the exact `aexec` sequence:** `test_260_expert_chat_scoping.py:209-238` uses `side_effect=[update, select]`, so an extra read raises `StopIteration`. `test_261_expert_authoring_scenarios.py:593` returns one object for every `aexec`. Re-drive both in the plan that edits `rename_thread`.
- **The allowlist constant (one home):** put it in `backend/app/models/message.py`, e.g. `TRANSCRIPT_EVENT_KINDS: frozenset[str] = frozenset({"expert_changed", "expert_handoff"})`. **The name must not contain "expert"** because `agent_loop.py` imports it (AST fence). Readers:
  1. `get_snapshot` (`threads.py:543-550`) and `get_messages` (`:863-870`). Replace `.neq("role","system")` with a Python filter through one helper: `rows = [m for m in rows if m["role"] != "system" or _kind(m) in TRANSCRIPT_EVENT_KINDS]`. That is safer than a PostgREST JSON-path `or_` and keeps the constant in one home. ⛔ It must stay an **allowlist**: `ask_user_prompt`/`ask_user_response`/`context_truncated`/`iteration_cap_paused` rows exist in the local DB (76/58/11/5) and must keep being excluded, or they would render as assistant bubbles (`MessageItem` has no system branch today) and hit `hasPendingAsk`.
  2. `_reconstruct_history` (`agent_loop.py:1004-1080`). Add, as the **first statement of the loop body**, `if msg.get("role") == "system" and _first_kind(msg) in TRANSCRIPT_EVENT_KINDS: continue`. Confirmed: system rows otherwise fall to the final `else` (`:1073-1079`) and reach the model as `{"role":"system"}`. `context_window.trim_messages_to_fit` runs on the reconstructed list, so it never sees them.
- **Other `messages` readers audited (none break):** `db/runs.py:147-172`, `api/panel.py:188-205`, `db/workflows.py:1715-1775,2279`, `harness_engine.py:240-280`, `harness/human_input.py` all filter by specific `kind` (`@>` jsonb). `knowledge_health.py:160-527` reads `source_refs`/`role='assistant'`/`role='user'` (the handoff user row is counted as a user query in gap analysis; minor, note it). `feedback.py:139` reads by id. `skill_catalog_filter._recently_loaded_skill_names` iterates `tool_calls` looking for `name=='load_skill'` (safe with `kind` rows). `eval_runner_service` reads its own eval threads.
- **Response types:** `MessageResponse.role` is `Literal["user","assistant"]` (`models/message.py:83`). Widen it to include `"system"`, or the snapshot 500s (BUG-260528-01). `ThreadSnapshotResponse.messages: list[MessageResponse]`. The frontend `Message.role` (`types/index.ts:174`) is the **only** narrow role type in `src` (grep). `Message.tool_calls` is typed `ToolCall[]`, so give the event payload its own TS type and narrow at the kind check.
- **Frontend consumers:** `MessageItem` treats any non-user row as assistant (`:273, :639-720`). It needs an **early return for the allowlisted system kind placed after the hooks** (Rules-of-hooks note at `:303`). `MessageList.tsx:197,235` use `role==="assistant"` (a trailing event row hides the floating chip). ⚠ **Mid-stream swap:** refetching the snapshot while a run streams can put the event row after the streaming temp row and break `isLastAssistant` (`MessageList.tsx:235`). Either apply the refetch only when not streaming (the run-end reconcile brings it in) or insert the row in `created_at` order. Also: the persisted assistant row is written at terminal time, so the order after reconcile is user → event → assistant, and "From your next message" stays true.
- **Payload** (write a Pydantic model; render from ONE shape): `{kind, at, from:{id,name,scope_mode}|null, to:{…}|null, now:{expert_folders:[name], thread_folder:{name,doc_count}|null, connections:[name]}, dropped:{…same}, excluded:{count, names[≤5]}|null}`. Compute `now`/`dropped`/`excluded` from `compose_expert_scope` + `connection_states`, **never** a second derivation. Snapshot the names at write time (UI-SPEC §5.6).
- **Phase 268 dependency:** ROADMAP says CHAT-08's folder-scope event is "the same shape, one mechanism". Keep the kind allowlist extensible and the payload's `now`/`dropped` generic (not Expert-specific field names), so 268 adds a kind rather than a second renderer.

## Handoff (PACK-24): verified mechanics

- **Thread-title precedent** (`services/thread_title.py`):
  - **Client.** Sync `get_llm_client(user_settings)`: an OpenAI-compatible client on the active provider's `base_url` for every provider (`openai_service.py:1251-1289`). It is called via `run_in_threadpool`.
  - **Model.** Single-model providers (`deepseek, moonshot, minimax, zhipu, ollama`) use the chat model. Multi-model providers use `provider_safe_utility_model(sub_agent_model)`, then `_SUB_AGENT_MODEL_DEFAULTS[provider]`, then `llm_model`.
  - **Tokens and reasoning.** `max_tokens` is 30 (160 for google). Reasoning is disabled via the `reasoning_off` capability (`extra_body.thinking.disabled` or `reasoning_effort:"none"`).
  - **Failure.** Any failure degrades to a derived title. It never raises.
  - **Uniformity.** It is provider-uniform only in the "cheap unstructured text" sense.
- **Recommendation for the summary:** mirror title's **model resolution** but use **`forced_emit`** (`services/forced_emit.py:344`) with a Pydantic model. `forced_emit` is the project's structured-output substrate: a per-`emit_tier` recovery ladder over the provider gateway, the same one `expert_authoring.generate_expert_draft` uses (`expert_authoring.py:363-374`, `strict=False`). It honours CLAUDE.md's "Pydantic for structured LLM outputs".
  ```python
  class HandoffSummary(BaseModel):
      items: list[constr(min_length=1, max_length=160)] = Field(min_length=3, max_length=6)
  ```
  - The emitter name (e.g. `"emit_handoff_summary"`) is a tool **name** passed to `forced_emit`. It is **not** an `EMITTER_REGISTRY` entry (that stays at 1). Keep it that way.
  - On `result["failure"]` or a validation failure → raise → the route answers a refusal (e.g. 502/422 with `detail="This chat could not be summarised."`). **No writes happen before the summary succeeds** (D-267-16).
  - Moonshot is `emit_tier: coerce` (the weakest). Put a handoff row on the SC#10 board.
- **Model/provider for the call:** accept optional `model`/`provider` in the handoff body (the composer's current pick, as `MessageCreate` does). Resolve through the same chain `send_message` uses: `load_user_settings` → `apply_user_model_default` → `override_provider` → `resolve_run_model(body=…, user_settings=…)` (`threads.py:1040-1060`, `run_model_resolution.py:217`). This keeps disabled-model fallback + provider inference identical. Call `load_user_settings` via `run_in_threadpool`.
- **Input:** the source thread's `user`/`assistant` rows (exclude `system`; exclude `reasoning_content`; exclude any `handoff` user rows' tool payload), newest-last, capped from the **end** (e.g. ~16-24k chars). Refuse when there are zero user/assistant rows (UI R8 never offers the button then).
- **Where it lives:** a NEW `backend/app/services/thread_handoff.py`.
  - ⛔ **Not** in `expert_service.py`: `test_259_closed_core_inventory.py::test_expert_service_is_pure_data_manifest_ast` fails on LLM-client imports, `agent_loop` imports, and `while` loops there.
  - ⛔ The filename must avoid `*expert*agent*|*expert*loop*|*expert*runtime*|*expert*executor*` (`test_no_expert_runtime_or_loop_modules_exist`).
  - Add its ledger row **at creation**.
- **Writes (atomic):** after the summary, one `get_user_pg_connection` transaction (RLS as caller, `dependencies.py:159-177`) that:
  1. INSERTs the thread `{user_id, org_id=<source thread org_id>, title, active_expert_id, folder_id?}`.
  2. INSERTs the handoff user row.
  3. INSERTs the source `expert_handoff` system row.

  Commit and return the new thread (`ThreadResponse`). Any failure rolls back, so "Nothing was created" is literally true. ⛔ Never hold the transaction open across the LLM call.
- **Marker location (D-267-15, discretion):** use **`tool_calls[0] = {"kind":"handoff", "source_thread_id", "source_title", "summary": [..]}`** on the `role='user'` row, with `content` = a plain-text rendering (header line + `- ` bullets).
  - It is safe in every history path: `_reconstruct_history` only special-cases `tool_calls` on **assistant** rows (`:1007-1012`). A user row with non-null `tool_calls` falls to the final `else` and is emitted as `{"role":"user","content":…}`. The `skill_catalog_filter` scan ignores it. The frontend mapper's `finalOutputFiles` loop checks `tc.name==="execute_code"` (safe).
  - The `messages.metadata` column **does not exist** (DDL `full-schema.sql:2176-2195`), so `tool_calls` is the only one-home option without a migration.
  - Keep `handoff` **out of** `TRANSCRIPT_EVENT_KINDS`: it is a user row the model must see.
- **Autotitle interplay:** `maybe_autotitle_thread` only titles threads whose title is exactly `"New Chat"` (`thread_title.py:258-262`). Setting `"{Expert} · {source title}"[:60]` server-side prevents a later overwrite.
- **Frontend flow:** the `startScopedChat` shape is the precedent (`startScopedChat.ts:56-80`): inject `handoff`, `refreshThreads`, `selectThread`, and refresh **before** select. `ChatArea` today receives **no** `selectThread`/`loadThreads`, so thread them from `ChatLayout` as optional props (`ChatLayout.tsx:823-843` mounts `ChatArea`). The source event's `Open →` also needs a way to open a thread by id plus a "deleted?" check. Pass an optional `onOpenThread(id): boolean` (or a resolver) ChatLayout → ChatArea → MessageList → MessageItem → `ExpertEventCard`. That is one optional prop per hot file.
- **Open question — folder inheritance:** should the new thread inherit the source `folder_id`? Neither CONTEXT nor the UI-SPEC says. Inheriting keeps a *biased* Expert's union scope, and matters for G-4 #3 ("naming the first thread's facts"). Recommend **inherit** and state it in the handoff event (→ OQ-5).

## Restricted-cost preview (PACK-25)

**Pure function (D-267-17), byte-identical to today's branch (`run_producer.py:473-516`):**

```python
# backend/app/services/expert_scope.py  (new leaf; ledger row at creation)
@dataclass(frozen=True)
class ExpertScope:
    effective_folder_ids: tuple[str, ...]
    scoped_folder_path: str | None
    excluded_folder_ids: tuple[str, ...]      # restricted ∧ thread_folder_id: subtree(thread) − expert set; else ()

def compose_expert_scope(*, scope_mode: str, thread_folder_id: str | None,
                         expert_folder_ids: list[str], visible_folders: list[dict]) -> ExpertScope: ...
```

- Keep run_producer's `_get_subtree` semantics exactly (`str(f.get("parent_id") or "") == root_id`) and the sorted-tuple outputs. Tests pin `folders == (FINANCIAL_FOLDER_ID,)`.
- `ExpertScopeUnavailable` (restricted ∧ zero folders) stays in `run_producer` (it raises; the pure function does not). The preview returns `expert_folders: []` so the UI can show the §9-D5 gate line.
- ⚠ The Expert's folder set **must** come from `resolve_expert_bundle`, not the bundle row. For first-party Experts the folders come from the org's `expert_installs` row (`expert_service.py:465-476`). The API overlay also rewrites `knowledge_folder_ids`, but the preview needs the access-checked, install-aware set.

**Counting "what retrieval would have read" (match `match_document_chunks`, `full-schema.sql:366-390`):** retrieval filters on:
- `org_id ∈ current_user_org_ids()`
- visibility: owner / `folder_is_org_shared(folder_id)` / `connection_doc_is_visible`
- `source_state IS NULL OR != 'source_disconnected'`
- `is_latest = true`
- `folder_id = ANY(p_folder_ids)`

The `documents` SELECT RLS policy (`full-schema.sql:7006`) is **the same visibility predicate**. So, on the **user-JWT client**:

```python
supabase.table("documents").select("id, filename", count="exact")
  .in_("folder_id", list(excluded_folder_ids)).eq("is_latest", True)
  .or_("source_state.is.null,source_state.neq.source_disconnected")
  .order("filename").limit(5)
```

That query gives `excluded_count` (exact) and up to 5 names from one response (UI-SPEC §5.3: heading and list from the same object). A document still ingesting has no chunks, so retrieval could not read it either. Count it or exclude it with `status='completed'`, but **state which** and make the D-267-20 DB check use the identical predicate. WR-03 (266): filename versioning can flip `is_latest` across folders, so `is_latest` is load-bearing here.

**Route shape (discretion):** `GET /threads/{id}/expert-scope-preview?expert_id=` needs a thread. The welcome state (no thread) and the catalog also need "states only what it reads". Recommend `GET /experts/{id}/scope-preview?thread_id=<optional>` (the router already carries `require_capability("experts")` + the validated active org). The thread branch verifies ownership under the user JWT. Either way, gate on thread ownership + `resolve_expert_bundle` access, and use `fetch_visible_folders(user_jwt_supabase, user_id)` for subtree + names.

## D-267-21: CONFIRMED (the invite on a brand-new chat is lost)

Exact order (all read in this session):
1. Welcome state (`thread === null`). The composer's invite calls `MessageInput.handleSelectExpert` (`:171-183`) → `onActiveExpertChange(expert)` → `ChatArea` `setActiveExpert(exp); setExpertInvited(true)` (`:541-545`). `threadId` is null, so **no PATCH**.
2. Send (or a spotlight tile → `handlePromptSelect` → `handleSend`). `handleSend` (`:433-468`) → `onCreateThread(scopeFolderId)` = `useThreads.newThread(folderId)` → `createThread("New Chat", folderId)` (`lib/api/threads.ts:23-34`). **No Expert in the body** → `POST /threads` inserts `active_expert_id` NULL.
3. `sendMessage` → `run_producer._resolve_thread_scoping` reads `active_expert_id = NULL` and returns all-`None` (`run_producer.py:417-418`). **The first run is unscoped.**
4. `ChatLayout` re-renders with the new thread. The hydration effect (`ChatArea.tsx:241-258`, deps `[thread?.id, thread?.active_expert_id]`) sees `null` → `setActiveExpert(null)`. The chip and spotlight vanish, and **no later PATCH ever happens**.

**Fix:**
- `createThread(title, folderId, activeExpertId?)` → `useThreads.newThread(folderId, expertId?)` → `ChatArea.handleSend` passes `activeExpert?.id`. `ChatArea.onCreateThread`'s type gains an optional 2nd arg; `ChatLayout` passes `newThread` directly, so the call stays compatible.
- `POST /threads` gains the **same** gate as PATCH through **one shared helper** (entitlement `experts` + `get_expert_service` access with `resolve_caller_role`). `create_thread` must add `request: Request`. No unit test calls `create_thread` directly (grep).
- Write the RED test first: a `ChatArea` test that invites in the welcome state, sends, and asserts `createThread` was called with the Expert id.

Related: `MessageInput.handleSelectExpert`/`handleDismissExpert` and `ChatArea.handleDismissExpert` **both** PATCH (two homes). Failures are `console.error` only, and `setThreadActiveExpert` throws a generic message that drops `entitlementRefusalMessage` (`lib/api/threads.ts:190-199`). Consolidate into one PATCH home in `ChatArea`, which then refetches for the event and surfaces refusals.

## SEED-309 folded items (D-267-24): exact targets

| Item | Source | Current code | What to build |
|---|---|---|---|
| **R265-262-04** Start Chat in-flight guard | `265-REVIEW-262.md:60` (double click → `{calls: 2, disabled: false}`) | `ExpertCard.tsx:148-150`, `ExpertDetailModal.tsx:278-283`, `ExpertCatalogPage.tsx:102-109` | Pending state from click until `onStartChat` settles. The button reads `Starting…`, is disabled, and has `aria-busy`. A second click is a no-op. Test: pending promise + `fireEvent.click` ×2 → 1 call, disabled true, re-enabled on reject (UI-SPEC §5.4/5.5) |
| **R265-262-03** ChatLayout real `onStartChat` wiring | `265-REVIEW-262.md:59` (plant `refreshThreads: async()=>{}` / drop `discardThread` → 14 files / 144 tests stayed green) | `ChatLayout.tsx:1033-1064` | Mount `ChatLayout` on the experts view (reuse `ChatLayout.launch.test.tsx` harness), start a chat. Assert `listThreads` is called **after** the PATCH and **before** selection. On PATCH reject, assert `DELETE /threads/{id}` is called. Drive RED with the review's own `sed` plant |
| **R265-audit-fixes-03** `rename_thread` org-role test | `265-REVIEW-audit-fixes.md:70` (replacing `resolve_caller_role` with `current_user.get("role")` kept 5 suites green) | `threads.py:733-738` | Patch `resolve_caller_role` → `("org-admin", set())` with a `current_user` that has **no** `role` key. Assert `get_expert_service` (or the shared helper) receives `caller_roles == ["org-admin"]`. Drive RED with the review's plant. If the helper is extracted, test the helper and the three callers' use of it |
| **R265-audit-fixes-06** chat-send entitlement message | `265-REVIEW-audit-fixes.md:73` (plant `entitlementRefusalMessage(body) ??` → `null ??` kept `entitlementRefusal.test.ts` 4/4 green) | `lib/api/threads.ts:581-589` (`postMessage`) | Mock `fetch` 403 with `{detail:{error:"entitlement_required",capability:"workflows",required_tier:"pro"}}`. Assert the `ApiError` message is `"Your plan doesn't include workflows. It is part of the Pro plan."` and `.status===403`. Add it to `src/lib/api/__tests__/entitlementRefusal.test.ts` (BASELINE pin 4 → 5+) |

## Cross-provider SC#10 board (derived, not re-typed)

One newest registry-backed model per `provider` group in `MODEL_CAPABILITIES` (base commit). Also check the Model Registry DB overrides (Phase 262: capabilities are data) before driving:

| # | Provider | Candidate (newest in registry) | emit_tier | Notes | Key in `backend/.env` |
|---|---|---|---|---|---|
| 1 | openai | `gpt-5.6-*` (sol/terra/luna; pick one, record which) | force_strict | check `api_surface` (Responses path, `openai_responses.py`) | set |
| 2 | anthropic | `claude-sonnet-5` | force | native SDK | set |
| 3 | google | `gemini-3.5-flash` | force | `max_tools: 16` is harness-only (verified: `apply_tool_budget` callers are `phase_types.py:556` only). The chat row proves ~28 tools reach Gemini | set |
| 4 | deepseek | `deepseek-v4-pro` | force | `strict_json_schema` inert | set |
| 5 | zhipu | `glm-5.2` | force | | set |
| 6 | minimax | `MiniMax-M3` | force | | set |
| 7 | moonshot | `kimi-k2.6` | **coerce** | weakest emission. Put a handoff-summary row here too | set |
| 8 | openrouter | `z-ai/glm-5.2` or `deepseek/deepseek-v4-pro` | force | `native_tools: False` (non-native tool path) | set |

(Key presence read from `backend/.env` names only; values never printed. Keys may also live in DB settings.)

**Method (Phase 185):** `POST /threads/{id}/messages` with a per-request `model` + `provider` (`MessageCreate` fields, `models/message.py:31-33`). No global setting changes. Read verdicts from `runs.model`/`runs.provider` + the persisted `messages.tool_calls` (tool names called). ⚠ **Memory `project_243_closed`: "a scoreboard with unverified attribution is worse than none".** Each row must cite the `runs` row proving which model served it before it counts. Prompt per row: needs `web_search` **and** `workspace_read`/`workspace_write` (G-4 #1). Recommended extra column: the handoff summary per provider (`forced_emit` rung + success).

## G-5 triples (re-derived at `92b5476be` with the CLAUDE.md recipe; 6-digit buckets excluded)

| File | commits / phases / lines | Ledger row? |
|---|---|---|
| backend/app/services/run_producer.py | 14 / 7 / 957 | yes |
| backend/app/services/agent_loop.py | 52 / 26 / 3501 | yes |
| backend/app/services/tool_dispatcher.py | **91 / 38 / 5243** (row reads `89/38/5169`: stale) | yes |
| backend/app/services/expert_service.py | 10 / 6 / 575 | yes |
| backend/app/api/experts.py | 13 / 5 / 764 | yes |
| backend/app/api/threads.py | **252 / 86 / 1794** (row `245/82/1679`: stale) | yes |
| backend/app/models/message.py | 18 / 11 / 134 | yes |
| backend/app/models/thread.py | 19 / 12 / 471 | yes |
| backend/app/models/expert.py | 5 / 3 / 131 | yes |
| backend/app/services/expert_authoring.py | 6 / 2 / 393 | yes |
| backend/app/services/thread_title.py | 4 / 3 / 311 | **NO ROW** (only needed if modified; importing it does not count) |
| frontend/src/components/chat/ChatArea.tsx | 78 / 39 / 889 | yes |
| frontend/src/components/chat/MessageInput.tsx | 37 / 18 / 975 | yes |
| frontend/src/components/chat/MessageItem.tsx | 76 / 34 / 1004 | yes |
| frontend/src/components/chat/MessageList.tsx | 23 / 10 / 366 | yes |
| frontend/src/components/chat/InviteExpertDialog.tsx | 3 / 3 / 231 | yes (G-5 fires, named seam: "per-row action block as one component") |
| frontend/src/types/index.ts | 91 / 71 / 1436 | yes |
| frontend/src/lib/api/threads.ts | 13 / 8 / 1746 | yes |
| frontend/src/lib/api/experts.ts | 7 / 4 / 367 | yes |
| frontend/src/hooks/useThreads.ts | 4 / 2 / 64 | yes |
| frontend/src/components/experts/catalog/expertCatalog.ts | 4 / 2 / 224 | yes |
| …/catalog/ExpertCard.tsx | 2 / 2 / 213 | yes |
| …/catalog/ExpertDetailModal.tsx | 3 / 2 / 438 | yes |
| …/catalog/ExpertCatalogPage.tsx | 6 / 3 / 338 | yes |
| frontend/src/components/experts/ExpertAuthoringStudio.tsx | 5 / 2 / 1548 | yes |
| frontend/src/components/layout/ChatLayout.tsx | 56 / 28 / 1102 | yes |
| scripts/vitest-count-gate.cjs | 252 / 56 / 6115 | gate-EXEMPT (`scripts/`) |

`node scripts/check-hot-file-ledger.cjs --files …` run at base: **every existing touched file has a row**. The **7 new files** named by the UI-SPEC/this research have none and need rows **at creation**: `services/expert_scope.py`, `services/thread_handoff.py`, `chat/ExpertEventCard.tsx`, `chat/HandoffCard.tsx`, `chat/expertEventCopy.ts`, `experts/ScopeLedger.tsx` (+ `thread_title.py` only if edited). Two rows are measurably stale (`tool_dispatcher.py`, `threads.py`). Re-derive in the commit that touches them.

## Baselines to freeze at the phase base (`92b5476be`)

| Gate | Command | Measured at base |
|---|---|---|
| Backend unit | `cd backend && venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider` | **71 failed, 5673 passed, 1 skipped, 2 xfailed, 2 xpassed**, 0 collection errors (254.9 s). **= ceiling, zero headroom.** The failed-set list is saved at research scratch. The planner must re-capture it as a **set** (`grep '^FAILED' … \| sed 's/ - .*//' \| sort`) and diff sets, never counts |
| Frontend typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit 2>&1 \| grep "error TS"` | **70 errors** (CLAUDE.md's "67" is stale). Relevant base members: `ExpertAuthoringStudio.tsx` ×3 (TS6133), `ChatAreaMode.test.tsx` ×4, `MessageInput.connectors.test.tsx` ×1, `MessageSkeleton.tsx` ×1, `OrgExpertsTab.tsx` ×3. Gate on the **set diff** |
| Vitest count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | **total 8828 · failed 3 · pinned total 8075** (exit 1). No missing pin, no per-file decrease. The 3 reds come from the gate JSON before any re-run, on a tree with an empty `frontend/` diff: `src/pages/WorkflowBuilderPage.canvas.test.tsx` ×1 (`STACK_TRACE_ERROR`; a SEED-171 named flake) and `src/components/library/__tests__/sketchComposition.test.tsx` ×2 (`STACK_TRACE_ERROR` + `Found multiple elements with the role "tab" and name "Documents"`). **Inherited, provably unmodified. Do not reach for the cap.** Phase acceptance must be per-file deltas plus in-scope suites, not "gate green" |
| Closed core | `pytest tests/unit/test_259_closed_core_inventory.py tests/unit/test_255_extension_contract_guard.py -q` | 7 phase types / 1 emitter / **29 tools** / 2 programmatic (imported and counted this session) |
| G-5 | `node scripts/check-hot-file-ledger.cjs 267` | clear for existing files. 7 `[no-row]` for new files until rows are added |

⚠ If a red appears: capture filenames from the gate's persisted JSON **before** re-running. Establish inherited vs new red by checking out the base, never by comparing to a number in prose (CLAUDE.md, SEED-171).

## Migrations

**None required.**
- `messages.role` CHECK already allows `system`.
- `tool_calls` is jsonb.
- `threads.active_expert_id` exists.
- `tool_floor_enabled` keeps its column (D-267-02).

Optional, not needed: a comment-only update to `COMMENT ON COLUMN messages.tool_calls` listing the new kinds. If done, use migration `197_…sql` + regenerate `full-schema.sql`. Recommend **skipping** it and documenting the kinds in `models/message.py` beside the constant. Next free number: **197** (`ls supabase/migrations | tail` → `196_documents_dedup_idx_org_scoped.sql`).

## Recommended plan breakdown (G-8: 5 plans, 3 waves)

| Plan | Wave | Scope | Files (source) |
|---|---|---|---|
| **267-01 Backend runtime core** | 1 | PACK-21 (delete constants, `None` tools, OQ-1 carrier if approved), D-267-17 pure fn, D-267-10 history skip, allowlist constant, `MessageResponse.role` widen, re-drive the 6-7 test files, union + inventory fences | `services/run_producer.py`, `services/tool_dispatcher.py`, `services/agent_loop.py`, `models/message.py`, NEW `services/expert_scope.py` |
| **267-02 Backend Expert overlay** | 1 | D-267-05 `connection_states` extraction, overlay `connection_state` + `can_connect` on list (both arms) + get, `tool_floor_enabled` doc text, drafter prompt line | `services/expert_service.py`, `api/experts.py`, `models/expert.py`, `services/expert_authoring.py` (+ `dependencies.py` if `feature_visible` is factored; ledger-check it) |
| **267-03 Backend thread surfaces** | 2 | shared Expert-assignment gate (PATCH + POST + handoff; R265-audit-fixes-03 test), D-267-21 server half, PATCH event writer (before-read, ≥ 1 message, explicit `org_id`), snapshot/messages allowlist, scope-preview route, handoff route + `thread_handoff.py` (`forced_emit`, `resolve_run_model`, atomic txn) | `api/threads.py`, `models/thread.py`, NEW `services/thread_handoff.py` (+ `api/experts.py` only if the preview lives there; then it must follow 267-02 in the same wave order) |
| **267-04 Frontend catalog + gate** | 2 (builds against 267-02's declared contract) | `CONNECTION_COPY` + `connectionGate`, `ScopeLedger`, card/modal/page states + Start Chat in-flight guard (R265-262-04), studio toggle removal + picker stores `service_id` (OQ-2), ChatLayout wiring test (R265-262-03), overlay types | `experts/catalog/expertCatalog.ts`, `ExpertCard.tsx`, `ExpertDetailModal.tsx`, `ExpertCatalogPage.tsx`, NEW `experts/ScopeLedger.tsx`, `experts/ExpertAuthoringStudio.tsx`, `lib/api/experts.ts`, `types/index.ts` (ExpertBundle only), count-gate knobs |
| **267-05 Frontend chat surfaces + live proof** | 3 | InviteExpertDialog R1-R10 (preview fetch, Replace/New chat, R9 lock), `ExpertEventCard` + `HandoffCard` + `expertEventCopy`, `MessageItem` system/handoff branches, one PATCH home + refetch in ChatArea, D-267-21 client half, handoff flow + `onOpenThread` chain, `role` type, R265-audit-fixes-06 test, count-gate adoption. Then the SC#10 8-row board + G-4 ×3 in Chrome + D-267-20 DB check | `chat/InviteExpertDialog.tsx`, `chat/MessageItem.tsx`, `chat/MessageList.tsx`, `chat/ChatArea.tsx`, `chat/MessageInput.tsx`, NEW `chat/ExpertEventCard.tsx`, `chat/HandoffCard.tsx`, `chat/expertEventCopy.ts`, `lib/api/threads.ts`, `hooks/useThreads.ts`, `types/index.ts` (Message), `layout/ChatLayout.tsx` |

Why 5 and not 4: 267-01 and 267-02 share no file and can run in parallel worktrees. Merging them loses a parallel lane. 267-04 and 267-05 must be serial because both touch `types/index.ts`. If the planner prefers 4, merge 267-02 into 267-01 (both are backend wave 1).

**Cross-plan seams (write side → read side, exact names to fix in the PLANs):**

| Seam | Written by | Read by |
|---|---|---|
| `TRANSCRIPT_EVENT_KINDS` (frozenset `{"expert_changed","expert_handoff"}`) in `backend/app/models/message.py` | 267-01 | 267-01 (`agent_loop._reconstruct_history`), 267-03 (snapshot/messages filter). Frontend mirror constant in `expertEventCopy.ts` (267-05) |
| `compose_expert_scope(...) -> ExpertScope{effective_folder_ids, scoped_folder_path, excluded_folder_ids}` in `services/expert_scope.py` | 267-01 | 267-01 (`run_producer`), 267-03 (preview + event payload) |
| `connection_states(pool, org_id, required) -> [ConnectionState{slug,name,connected}]` in `services/expert_service.py` | 267-02 | 267-02 (resolver + overlay), 267-03 (event `now/dropped.connections`) |
| Overlay keys `connection_state: [{slug,name,connected}]`, `can_connect: bool` on every Expert list/get row | 267-02 | 267-04 (`types/index.ts` `ExpertBundle`, `connectionGate`), 267-05 (dialog R3) |
| Event payload `tool_calls[0]` for `expert_changed` (Pydantic `ExpertChangedEvent`) | 267-03 | 267-05 (`ExpertEventCard` via `expertEventCopy`) |
| `expert_handoff` payload `{kind, target_thread_id, target_title, expert_name, stays_expert_name, at}` | 267-03 | 267-05 |
| Handoff user-row marker `tool_calls[0]={kind:"handoff", source_thread_id, source_title, summary:string[]}` | 267-03 | 267-05 (`HandoffCard`) |
| `POST /threads/{id}/handoff` body `{expert_id, model?, provider?}` → `ThreadResponse` | 267-03 | 267-05 (`lib/api/threads.ts`) |
| Preview route → `{mode, expert_folders:[{id,name}], thread_folder:{id,name}\|null, excluded_count, excluded_names[≤5]}` | 267-03 | 267-05 (`ScopeLedger` payload) |
| `POST /threads` accepts `active_expert_id` behind the gate; `createThread(title, folderId, activeExpertId?)` | 267-03 | 267-05 |
| `RunContext.<neutral name>` connection carrier (only if OQ-1 = a) | 267-01 | 267-01 (`agent_loop` connector block) |

## Common Pitfalls

1. **AST fence on the word "expert" in `agent_loop.py`.** Any Name, Attribute or function containing `expert` fails `test_agent_loop_closed_core_ast_invariant`. Use neutral names. Check with `pytest tests/unit/test_260_expert_chat_scoping.py -q` after every `agent_loop` edit.
2. **Collection errors from deleted constants.** Three test modules import them at module scope. Edit them in the same commit.
3. **A comment-token test pins a sentence that becomes false** (`test_264_load_skill_born_for.py:407-429`). Update the test's expected tokens alongside the comment.
4. **The `rename_thread` tests pin the `aexec` call sequence and the no-org success path.** Re-drive them. Decide OQ-3 explicitly.
5. **Snapshot widening must stay an allowlist.** Four other system kinds exist in real data and would render as assistant bubbles.
6. **Wrong `org_id` on inserted rows for multi-org users** (trigger `LIMIT 1`). Set it explicitly.
7. **Mutating `required_connections` in the overlay** would round-trip wrong data into org-authored Expert updates. Use a new key.
8. **The preview must use `resolve_expert_bundle`**, not the bundle row (install-sourced folders for first-party Experts).
9. **The handoff summary in `expert_service.py`** trips the pure-data AST fence. Also avoid forbidden filename patterns.
10. **An LLM call inside a DB transaction.** Summarize first, then do one short transaction.
11. **Mid-stream swap + snapshot refetch** can reorder the streaming row. Refetch only when not streaming, or insert by `created_at`.
12. **New vitest suites not adopted** into both `TARGETS` and `BASELINE` → invisible to the gate. The expert/chat suites are file-level entries (`vitest-count-gate.cjs:4454-4481`), and there is no bare `src/components/chat` directory entry.
13. **Removing the studio toggle leaves unused imports** → new TS6133 in the set diff.
14. **Presence vs content:** assert the rendered words at rest (`toBeVisible` + text), never only `data-testid` (UI-SPEC §8, 266 UI-3).
15. **The OQ-1 decision must be recorded.** Leaving the "plus its own" half silently unbuilt is exactly ROADMAP's "the Expert's own connections are stripped" failure in a new form.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Structured summary from an LLM | ad-hoc JSON parsing of a completion | `forced_emit` + Pydantic (`expert_authoring.py:363`) | per-provider rung ladder, narration recovery, token accounting |
| Model/provider choice for the summary | a new resolution chain | `apply_user_model_default` → `override_provider` → `resolve_run_model` | disabled-model fallback + provider inference identical to chat |
| Atomic multi-row write as the caller | sequential PostgREST calls + compensating deletes | `get_user_pg_connection` (a txn with RLS as caller) | "Nothing was created" becomes true by construction |
| Org permission check | reading `current_user["role"]` (does not exist) | `_has_org_permission` / `resolve_caller_role` | R265-audit-fixes-03 is exactly this bug class |
| Folder visibility / subtree | a new folder query | `fetch_visible_folders` + `compose_expert_scope` | the SEED-124 rule lives in one place |
| Tier refusal copy | a new string | `entitlementRefusalMessage` (`lib/api/_core.ts:50`) | the one reader of `entitlement_required` |

## Code Examples

```python
# _reconstruct_history — first statement of the loop body (neutral names only; AST fence)
from app.models.message import TRANSCRIPT_EVENT_KINDS   # frozenset({"expert_changed","expert_handoff"})
...
for msg in history_rows:
    _tc = msg.get("tool_calls")
    if msg.get("role") == "system" and isinstance(_tc, list) and _tc and isinstance(_tc[0], dict) \
            and _tc[0].get("kind") in TRANSCRIPT_EVENT_KINDS:
        continue   # transcript-only: rendered to people, never sent to a model (D-267-10)
```

```python
# api/threads.py — one allowlist helper for BOTH /snapshot and /messages (replaces .neq("role","system"))
def _visible_rows(rows: list[dict]) -> list[dict]:
    return [m for m in rows if m.get("role") != "system"
            or ((m.get("tool_calls") or [{}])[0] or {}).get("kind") in TRANSCRIPT_EVENT_KINDS]
```

## State of the Art

| Old | Current (after 267) | Impact |
|---|---|---|
| Expert = `EXPERT_CORE_TOOLS` (10) + deliverables (4) ∩ schema filter | Expert thread tools ≡ plain thread tools (+ Expert connections per OQ-1) | 15 tools return. Connector tools no longer dropped by the slug/namespace mismatch |
| `tool_floor_enabled` toggle | column kept, not read, toggle removed | the studio no longer offers a switch that does nothing |
| System rows invisible to the transcript (`.neq`) | allowlisted transcript kinds visible, never sent to the model | one mechanism for 267 + 268 events |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Option (a) for OQ-1 (server union of the Expert's approved connections) is acceptable on the grant surface | Connection state | Widens which connector tools a run advertises. Needs operator confirmation (SEED-146) |
| A2 | Production `expert_bundles.required_connections` holds `service_id`s like local | OQ-2 | If it holds names, PACK-22 marks connected services missing in prod. Run the read-only query |
| A3 | The handoff thread should inherit the source `folder_id` | Handoff | G-4 #3 may fail to name the first thread's facts from KB context if it does not |
| A4 | `forced_emit` with `strict=False` produces a valid 3-6 item list on all 8 roster rows | Handoff | A provider row may refuse every handoff. The SC#10 board catches this |
| A5 | "Newest" model picks in the roster table | SC#10 | Board coverage choice only. Record the chosen id per row |

## Open Questions (RESOLVED — operator rulings D-267-29..34, 2026-09-25; OQ-6 = D-267-07)

1. **OQ-1: How do an Expert's own connections reach the run?** Known: the normal path adds only chip-armed connections. Recommendation: (a) a server union of `effective_connections` via a neutrally named `RunContext` field, plus a visible statement (ledger `Brings` / event `Now`). Confirm with the operator before 267-01 is planned.
2. **OQ-2: The studio writes names.** Recommendation: fix the picker to `service_id` in 267-04. Decide legacy-name tolerance after a read-only prod query.
3. **OQ-3: No-active-org arm of the Expert gate.** Today PATCH skips the gate (fail-open), and a test pins it. Recommendation: the shared helper fails closed (403 "Choose an organization…") when the Expert id is set and no validated org exists. Re-drive `test_patch_thread_updates_and_clears_active_expert`. Clearing an Expert stays ungated. If the operator prefers the current behaviour, record it as a decision (the run-time resolver still fails closed and clears the id).
4. **OQ-4: The skill catalog is still a replacement** (`skill_catalog_override`). Recommendation: do **not** fix it in 267 (not in PACK-21's literal scope). Record it in SEED-303's status note as the remaining "adds, never replaces" arm with a trigger. The operator may choose to fold it.
5. **OQ-5: Does the handoff thread inherit `folder_id`?** Recommendation: yes, and say so on the handoff card/event.
6. **Install/connection gates on handoff (D-267-14 wording):** the server has none (D-267-07). The UI does not offer `New chat with …` on rows R2/R3. Recommendation: the handoff route runs the same shared gate (entitlement + access) and relies on the UI for install/connection, consistent with D-267-07. Optionally refuse a restricted Expert with zero folders using the `ExpertScopeUnavailable` sentence.

## Environment Availability

| Dependency | Required by | Available | Version / state | Fallback |
|---|---|---|---|---|
| Local Postgres (Supabase) | all backend work, D-267-20 DB check | ✓ | `:54322` listening. Queried this session | — |
| Redis | runs/streaming for live drives | ✓ | `:6379` listening | — |
| Backend uvicorn | live drives | ✓ | `:8000` listening (check for stale workers: memory `reference_stale_uvicorn_workers_hold_port_8000`) | operator restarts |
| Vite dev | Chrome G-4 | ✓ | `[::1]:5173` (IPv6 only; probe `localhost`) | — |
| Sandbox (`execute_code`) | G-4 #1 "write a file" (if via code) | ✓ | `SANDBOX_ENABLED=true`, `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` | `workspace_write` needs no sandbox |
| Web search (Tavily) | G-4 #1, SC#10 prompt | ✓ | `TAVILY_API_KEY` set | — |
| 8 provider keys | SC#10 board | ✓ (env names present) | OPENAI, ANTHROPIC, GOOGLE, DEEPSEEK, ZHIPU, MINIMAX, MOONSHOT, OPENROUTER all set | block a row with a reason, never omit it |
| Local fixtures | PACK-22 | ✓ | 2 Experts require `google` (revoked) + `microsoft`/`notion` (active) | — |
| Restricted Expert with folders + folder-scoped thread holding ~4 docs | G-4 #2 / PACK-25 | ✗ as of research ("HR Advisor" does not exist locally; Financial Analyzer is restricted with install folders) | — | author an "HR Advisor" (restricted) in the studio as UAT setup, or use Financial Analyzer in a folder-scoped thread |

**Missing with no fallback:** none. **Missing with fallback:** the HR Advisor fixture (create during UAT setup).

## Validation Architecture

(`workflow.nyquist_validation` is `false` in `.planning/config.json`. This section is included because the orchestrator asked for it.)

### Test Framework
| Property | Value |
|---|---|
| Backend | pytest (venv), `backend/tests/unit` |
| Frontend | vitest (`frontend/vitest.config.ts`) + Testing Library |
| Quick run (backend) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_267_*.py tests/unit/test_259_closed_core_inventory.py tests/unit/test_260_expert_chat_scoping.py -q -p no:cacheprovider` |
| Quick run (frontend) | `cd frontend && npx vitest run src/components/chat/__tests__/<file> src/components/experts --maxWorkers=2` |
| Full suite | backend unit gate + `npx tsc -p tsconfig.app.json --noEmit` set diff + `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (once per wave) |

### Phase Requirements → Test Map
| Req | Behavior | Type | Automated command (suggested file) | Exists? |
|---|---|---|---|---|
| PACK-21 | Expert scoping returns `effective_tools is None`; the union fence (Expert ⊇ plain incl. an armed `svc__tool`); inventory 29 | unit + AST | `pytest tests/unit/test_267_tool_floor_union.py test_259_closed_core_inventory.py -q` | ❌ Wave 0 (new) + re-drive 6 files |
| PACK-21 (OQ-1 a) | An Expert's approved connection is advertised without a chip; a revoked one is not; deny posture still hides it | unit | `pytest tests/unit/test_267_expert_connection_tools.py -q` | ❌ |
| PACK-21 live | 8-row SC#10 board, Expert thread needing `web_search` + `workspace_*` | manual/live | VALIDATION.md rows | ❌ |
| PACK-22 | `connection_states` names + connected rule. Overlay on list (both arms) + get. `can_connect` = `org:manage` ∧ visible | unit | `pytest tests/unit/test_267_connection_overlay.py -q` | ❌ |
| PACK-22 UI | `connectionGate` wording (1/2/3+ missing), admin vs member, words visible at rest on card/modal/dialog | vitest | `npx vitest run src/components/experts/catalog/__tests__/expertCatalog.test.ts …` | extend existing |
| PACK-23 | PATCH writes one event only on change and ≥ 1 message. Snapshot/messages allowlist (ask_user rows still excluded). `_reconstruct_history` skips the kind. Explicit `org_id` | unit | `pytest tests/unit/test_267_expert_changed_event.py -q` | ❌ |
| PACK-23 UI | `ExpertEventCard` renders Now/Dropped words at rest from payload. Survives remount from snapshot data | vitest | `npx vitest run src/components/chat/__tests__/ExpertEventCard.test.tsx` | ❌ |
| PACK-24 | Summary failure → refusal and **zero** rows written. Success → thread + user marker row + source event in one txn. The marker row reaches history as plain user content | unit | `pytest tests/unit/test_267_handoff.py -q` | ❌ |
| PACK-24 UI | R9 lock (dialog not dismissible, siblings aria-disabled), R10 refusal copy ending "Nothing was created.", refresh-before-select order, `HandoffCard` | vitest | `npx vitest run src/components/chat/__tests__/InviteExpertDialog.handoff.test.tsx` | ❌ |
| PACK-25 | `compose_expert_scope` byte-identical to the old inline branch (table of cases). Preview count == RLS DB count with the same predicate. Heading count from the same response | unit | `pytest tests/unit/test_267_expert_scope.py -q` | ❌ |
| PACK-25 live | The next run's retrieved chunks carry no excluded folder. The stated count == DB count | manual/live | D-267-20 drive | ❌ |
| D-267-21 | Welcome-state invite + send → `createThread(…, expertId)`. `POST /threads` gate refuses an ungranted Expert | vitest + unit | `ChatArea.expertNewThread.test.tsx` · `test_267_create_thread_gate.py` | ❌ |
| SEED-309 ×4 | see §SEED-309 table, each driven RED with the review's own plant | vitest/unit | as listed | ❌ |

### Sampling Rate
- **Per task commit:** the targeted suites above for the files touched.
- **Per wave merge:** full backend gate (≤ 71, same set), tsc set diff, vitest count gate.
- **Phase gate:** all three green + SC#10 board + G-4 ×3 in Chrome before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_267_*.py` (tool floor union, connection overlay, event, handoff, scope, create gate)
- [ ] Re-drive: `test_261_expert_runtime_scoping.py`, `test_261_expert_authoring_scenarios.py`, `test_261_closed_core_inventory.py`, `test_259_closed_core_inventory.py`, `test_260_financial_analyzer_conversation.py`, `test_260_expert_chat_scoping.py`, `test_264_load_skill_born_for.py`
- [ ] New vitest suites adopted into `TARGETS` + `BASELINE` in `scripts/vitest-count-gate.cjs`

## Security Domain

`security_enforcement: true`.

### Applicable ASVS Categories
| Category | Applies | Control |
|---|---|---|
| V2 Authentication | no (existing `get_current_user`) | — |
| V3 Session | no | — |
| V4 Access Control | **yes** | Thread ownership under the user JWT on every new route. Expert access via `get_expert_service`/`resolve_expert_bundle` with `resolve_caller_role` (never `current_user["role"]`). `POST /threads` + handoff gated like PATCH. `can_connect` from `org:manage`. Preview/document counts under RLS (`documents` SELECT policy) |
| V5 Input Validation | **yes** | Pydantic request models (`expert_id: UUID`, optional `model`/`provider: str`). `HandoffSummary` item caps. Server names rendered as React text only |
| V6 Cryptography | no | — |
| V8 Data Protection | yes | Excluded-document names come only from RLS-visible rows. Event payload snapshots names the caller could already see |
| V11 Business Logic | yes | One-request handoff (no double-create). Atomic txn. The event only on a real change |

### Threat Patterns
| Pattern | STRIDE | Mitigation |
|---|---|---|
| Assign an ungranted/cross-org Expert via `POST /threads` (today: no gate) | Elevation | shared gate helper, fail-closed (OQ-3) |
| IDOR on preview/handoff with another user's `thread_id` | Info disclosure | ownership select under the user JWT → 404 before any other read |
| Expert connection union widens tool grants (OQ-1 a) | Elevation | only resolver-approved (active + enabled, caller org) connections. `tool_grants` deny/ask unchanged. Operator decision recorded |
| Prompt injection carried into the handoff summary (from docs/tool output in the source thread) | Tampering | the summary is the user's own thread content. It is sent as a user row (not system). Items are length-capped. Rendered as text, never HTML |
| Transcript-event rows leaking into model context | Tampering/Info | `_reconstruct_history` skip + allowlist constant. Unit fence |
| Multi-org user's rows stamped with the wrong org (trigger `LIMIT 1`) | Tampering | explicit `org_id` from the thread row |
| Summary cost abuse (large threads) | DoS | input char cap from the end. One call per request. The UI in-flight lock |

## Sources

### Primary (HIGH: read or run this session at `92b5476be`)
- `backend/app/services/run_producer.py:378-547, 706-724, 879-899`
- `backend/app/services/agent_loop.py:240-282, 959-1082, 1360-1415, 1440-1470, 1590-1760`
- `backend/app/services/tool_dispatcher.py:1580-1600, 4730-4776` · `openai_service.py:1116-1170, 1251-1289`
- `backend/app/services/expert_service.py:1-80, 119-160, 396-586` · `api/experts.py:300-325, 415-545` · `expert_install_service.py:293-340`
- `backend/app/api/threads.py:1-232, 263-300, 510-771, 841-1060` · `models/message.py`, `models/thread.py`
- `backend/app/services/thread_title.py` (whole) · `forced_emit.py:344-420` · `expert_authoring.py:318-395` · `run_model_resolution.py:217-247`
- `backend/app/dependencies.py:159-177, 567-660, 856-900, 998-1045`
- `supabase/full-schema.sql:54-84, 366-390, 2176-2220, 5297-5349, 6621-7064`
- Frontend: `ChatArea.tsx:1-889`, `MessageInput.tsx:1-215, 500-530, 960-975`, `InviteExpertDialog.tsx`, `expertCatalog.ts:100-224`, `startScopedChat.ts`, `ChatLayout.tsx:823-843, 1025-1064`, `lib/api/threads.ts:23-199, 560-590`, `lib/api/_core.ts:40-70`, `types/index.ts:18-37, 170-260`, `useThreads.ts`, `OrgProvider.tsx:43-60`, `ExpertAuthoringStudio.tsx:205-225, 885-910, 1100-1140`, `MessageList.tsx:185-310`, `MessageItem.tsx:272-330, 620-720`
- Tests: `test_259_closed_core_inventory.py`, `test_260_expert_chat_scoping.py`, `test_260_financial_analyzer_conversation.py:340-390`, `test_261_expert_runtime_scoping.py:140-240`, `test_261_expert_authoring_scenarios.py:280-305, 540-600`, `test_264_load_skill_born_for.py:400-430`, `test_071_1_threadpool_sweep.py`
- Local DB queries (asyncpg, `DATABASE_URL`): `expert_bundles`, `connector_connections`, `messages` system-kind counts
- Planning: `267-CONTEXT.md`, `267-UI-SPEC.md`, `REQUIREMENTS.md`, `ROADMAP.md` §267/268, `SEED-303`, `SEED-309`, `265-REVIEW-262.md:59-60`, `265-REVIEW-audit-fixes.md:70,73`, `266-REVIEW.md`, `docs/EXTENSION-CONTRACT.md`, `docs/HOT-FILE-LEDGER.md` (sections listed)

### Secondary / Tertiary
- None. No external web sources were needed. No new packages are installed, so the Package Legitimacy Audit is not applicable.

## Metadata

**Confidence breakdown:**
- Code paths / tests / baselines: HIGH. Read and run directly.
- OQ-1..OQ-5 recommendations: MEDIUM. They are design calls that need operator confirmation (A1-A5).
- Provider behaviour of `forced_emit` for the summary on all 8 rows: MEDIUM. Proven for authoring, not for this schema. The SC#10 board is the check.

**Research date:** 2026-09-25 · **Valid until:** the next commit touching `run_producer.py`, `agent_loop.py`, `api/threads.py` or `api/experts.py`. Re-derive the triples and baselines at plan time, never copy them forward.
