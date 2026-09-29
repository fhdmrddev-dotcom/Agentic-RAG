# Phase 267: An Expert Adds Scope - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning (G-2 picked: Variant B)
**Mode:** Autonomous smart-discuss. The operator accepted every recommended answer, chose "Sketch, I pick" for G-2,
chose "honour by construction" for G-5, and chose to fold 4 of SEED-309's 7 items.

<domain>
## Phase Boundary

Inviting an Expert **only ever adds** to what a thread can do (PACK-21). Whenever an Expert costs the user
something or changes the thread's scope, the product **says so before or as it happens**, never as a run-time
failure:

- **PACK-22:** a required connection that is not connected is named.
- **PACK-23:** a swap or removal writes a transcript event that names its consequence.
- **PACK-24:** "ask a second Expert" opens a new thread that carries a handoff summary.
- **PACK-25:** a `restricted` Expert states which documents it will not read.

⛔ **Red line (Extension Contract):** no new executor, emitter, programmatic function or tool. The closed-core
inventory (**7 phase types / 1 emitter / 29 tools**) is re-counted by AST against this phase's base commit.
Scoping stays **data handed to the loop**. There is no `if expert:` inside the loop (D-260-05).

Out of scope: per-Expert spend and mid-thread folder-scope change (Phase 268), the starter library (Phase 269),
and SEED-303 S8 clone-on-customise.

</domain>

<decisions>
## Implementation Decisions

### Tool floor (PACK-21)
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

### Required connections (PACK-22)
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

### Swap / remove transcript event (PACK-23)
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

### Ask a second Expert (PACK-24)
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

### Restricted cost (PACK-25)
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

### Also folded (found by the scout; research confirms whether it is real)
- **D-267-21: An invite made on a brand-new chat, before the first message, is probably lost.**
  `MessageInput.tsx:171-198` PATCHes only `if (threadId)`. `ChatArea.handleSend` (:433-457) creates the thread
  without the Expert, and the hydration effect (:241-258) then clears it. The frontend `createThread(title,
  folderId)` has no Expert parameter, and `POST /threads` already accepts `active_expert_id` but runs **no**
  access or entitlement check (`threads.py:672`).
  - If research confirms the defect, fix it in this phase: `createThread` carries the Expert, and
    `POST /threads` gains the same gate `PATCH` has.
  - If it is refuted, record it and move on.

### Guardrails and process
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

### G-2 winner and G-4 scenarios (operator, 2026-09-25, at the sketch pick)
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

### Research rulings (operator, 2026-09-25, after 267-RESEARCH.md)
- **D-267-29 (OQ-1): the Expert's own connections reach its runs through a SERVER UNION.** This corrects D-267-01
  sentence 2 and D-267-03, which the research refuted. A plain thread only advertises the connections the user switched
  on in the composer (`agent_loop.py:1640-1662`: an empty list means none).
  - `_resolve_thread_scoping` carries the resolver's **already approved** `effective_connections` (active and enabled in
    the caller's org) as a **neutrally named** `RunContext` field, for example `scoped_connection_keys`. The name must not
    contain "expert", because of the AST fence on `agent_loop.py`.
  - The connector block admits a connection when its id was switched on OR its `service_id` / `capability` is in that
    set.
  - Per-tool grant posture (deny/ask) still applies unchanged.
  - The ledger's `Brings` column and the event card's `Now` line are the visible statement, because the "Using:" chip row
    will not show these connections.
  - This widens a grant surface (SEED-146), with explicit operator approval.
- **D-267-30 (OQ-2): the authoring studio's connection picker stores `service_id`, not `name`.** This is a new defect
  (`ExpertAuthoringStudio.tsx:1114-1121`). A production read on 2026-09-25 (Supabase MCP, read-only) found **0**
  `expert_bundles` rows with any `required_connections`, so there is no legacy-name compatibility and no backfill.
- **D-267-31 (OQ-3): one shared, fail-closed Expert-binding gate.** PATCH /threads, POST /threads (D-267-21) and
  POST /threads/{id}/handoff all call one helper, which checks entitlement and access. **No validated active org means
  refuse, with a reason.** It replaces PATCH's fail-open skip, and `test_260_expert_chat_scoping.py:196-238`, which pins
  that skip, is rewritten.
- **D-267-32 (OQ-4): skills ADD, folded into 267.** The skill catalog of an Expert thread = the normal catalog ∪ the
  Expert's member skills, and never the Expert's alone. It uses the same seam as the tool floor
  (`run_producer.py:526-531` / `agent_loop.py:1445-1459`), is data handed to the loop, and has neutral names.
- **D-267-33 (OQ-5): the handoff thread inherits the source thread's `folder_id`.** The handoff event states it.
- **D-267-34: every `messages` row this phase writes (event, handoff) sets `org_id` explicitly from `threads.org_id`.**
  The autofill trigger picks `org_members … LIMIT 1`, which is wrong for a two-org user.

- **D-267-35 (planner finding, operator 2026-09-25): a BIASED Expert on a thread with NO folder keeps narrowing
  retrieval to the Expert's folders, and this is STATED, not fixed.** Examples of such threads: a catalog Start Chat, or
  a handoff from an unscoped thread.
  - Why it is kept: 266's live proof (a fresh catalog chat citing `$124.5M`) depends on this focus.
  - How it is stated: the event card and the ledger say `Dropped: All your documents`.
  - It is routed to SEED-303 as an open arm with a re-open trigger: the first phase that gives "biased" real ranking
    semantics (a boost, not a filter), after the SEED-224 `retrieval_service.py` extraction.
  - Rejected: "search everything", because the Expert loses focus and 266's grounded answer may regress. Rejected:
    "all documents plus a boost", because it is a retrieval change that is bigger than 267.

### Claude's Discretion
- The exact route shapes and response models (preview, handoff, overlay field names).
- The model and prompt used for the handoff summary (`thread_title.py` precedent), and its length cap.
- Whether `EXPERT_CORE_TOOLS` / `EXPERT_DELIVERABLE_TOOLS` are deleted or kept as marked documentation.
- The exact copy, within the shipped Expert vocabulary and the sketch the operator picks.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `run_producer._resolve_thread_scoping` (:383). The tool list is built at :518-524 and scope is composed at
  :502-516. `ExpertScopeUnavailable` guards an empty restricted scope (:465-470, CR-01 in 266). This is the one
  seam where scoping becomes data.
- `expert_service.resolve_expert_bundle`. Its connection check (:527-558) and its `stripped_details` output are
  read by nothing today.
- `api/experts.py` `overlay_install_state` (:458-489), the pattern for a server overlay.
- `components/experts/catalog/expertCatalog.ts` `inviteGate()` / `installView()` (:164-224), the one home of gate
  wording.
- `messages.role='system'` plus the `tool_calls[0].kind` discriminator. Existing kinds are `context_truncated`,
  `iteration_cap_dropped_tool_calls` and `ask_user_prompt`/`ask_user_response`. The writer is at
  `agent_loop.py:1942-1948`.
- `services/thread_title.py`, the precedent for an LLM call over a thread (a service, not a tool).
- `startScopedChat.ts:56-80` (create → set Expert → refresh → select → navigate; `discardThread` on failure).
- `ChatLayout.tsx:838`, the existing `onOpenConnections={() => onNavigate("connections")}` door.

### Established Patterns
- Scoping is resolved as DATA handed to the loop (`RunContext.effective_tools`, the effective folder ids). No
  `if expert:` inside the loop.
- The UI gate is the only gate for install state (266). The run-time path fails closed and quietly.
- Realtime is a hint. Reconcile by fetch.
- Where the words are the deliverable, assert that they render visibly **at rest**.

### Integration Points
- `agent_loop.py:1696-1703`, the schema filter that D-267-01 makes unreachable for Expert threads.
- `agent_loop.py` `_reconstruct_history` (:984-1082), where the transcript-only kind filter goes.
- `api/threads.py` `rename_thread` (:706-771), where the event is written. `POST /threads` (:672) takes the D-267-21
  gate. The snapshot and messages reads (:548, :868) get the allowlist.
- `models/message.py:83` / `frontend/src/types/index.ts:174`, the role types.
- `MessageItem.tsx`, which gets the new event row and handoff card renderers. The closest pattern is the notices at
  :639/:657.
- `InviteExpertDialog.tsx` (props :22-27), which gets the Swap / Ask-in-new-chat actions, the requires-connection
  state and the cost statement.

</code_context>

<specifics>
## Specific Ideas

- SEED-303 S5 wording: "HR Advisor reads HR Policies only; the 4 documents in this chat's folder will not be used."
- SEED-303 S7 wording: "Requires HubSpot — not connected".
- SEED-303 S2: a swap appears "in the transcript as an event with its consequence named, in the run-honesty
  pattern", not only as a chip changing.
- Sketch 260 Variant A: a calm system announcement on invite and a "timeline return notice" on dismiss. Reuse
  that vocabulary.
- `render_template` is harness-only and never offered in chat (`openai_service.get_tools`). Its presence in
  `EXPERT_DELIVERABLE_TOOLS` was a no-op on chat, and the planner corrects the comment wherever the constant
  survives.
- An Expert thread whose `workspace_read` was stripped was still told about its attached files
  (`agent_loop.py:1726-1736`). D-267-01 makes that note true again.

</specifics>

<deferred>
## Deferred Ideas

- A deep link to one service's connect form (`ConnectionsTab` takes no props).
- A server-side refusal in `PATCH /threads` for a missing required connection (D-267-07 keeps the UI gate only).
- `dispatch_tool` refusing tools that were never advertised. With no Expert filter it is moot here, but chat has
  no dispatch-side whitelist (`tool_dispatcher.py:1591-1595`). Note it for SEED-303.
- SEED-309 items R265-262-06, R265-audit-fixes-10 and R265-audit-fixes-13 (see D-267-24).
- SEED-303 S8 (clone-on-customise) stays open.

### Reviewed, not folded
- The open `surface: Agentic-RAG` reported bugs (13) have no `affected_areas` overlap with the Expert
  scope/tool/invite domain. None were folded.

</deferred>
