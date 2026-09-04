# Phase 216: Connections in Chat, and One File In by Hand - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Connected services (Google Workspace, GitHub, Notion, Slack, Jira, MCP servers) become platform assets directly usable in conversation threads:
1. Users discover, toggle, and manage active connectors in a thread via a Claude.ai-style `+` flyout menu and active chips bar.
2. The agent autonomously selects and executes granted tools for active connections in the thread.
3. Interactive approval cards appear inline in the chat stream when an external tool has an `ask` posture.
4. Users can pick and attach a single document/file from connected cloud storage (Google Drive / OneDrive) directly into the thread.
5. Freshly created connections expose starter prompts on the chat empty state and Settings card.

</domain>

<decisions>
## Implementation Decisions

### 1. Service Discovery & Thread Management (CHAT-05, CHAT-06)
- **D-216-01 (Claude.ai-Style Plus Menu):** The chat input bar features a `+` button that opens a menu containing a **Connectors** sub-flyout.
- **D-216-02 (Toggle Switch Per Connector):** The Connectors flyout displays all configured workspace connections with toggle switches (e.g. `Google Workspace [ON]`, `GitHub [ON]`, `Slack [OFF]`).
- **D-216-03 (Active Service Pills):** Active connectors appear as dismissible chips above/in the message input (e.g. `[ 🌐 Google Workspace ✕ ]`). Clicking `✕` disables that connector for the thread (`CHAT-06`).
- **D-216-04 (Autonomous Agent Dispatch):** When a connector is active in the thread, the agent loop dynamically registers its granted tools into the model context and autonomously decides when to invoke them.
- **D-216-05 (@-Mention Autocomplete):** Users can also type `@` in the prompt input to trigger a popover filter for quick mentioning, which auto-activates the connector chip.
- **D-216-06 (Connectors Navigation Links):** The Connectors menu includes `+ Add connector` and `Manage connectors` routing to `/settings` Connections tab.

### 2. Chat Approval Moment & Rendering (CHAT-07, GRANT-03)
- **D-216-07 (Inline Interactive Cards):** When an external tool call with `ask` posture is triggered, an interactive card is rendered directly in the assistant stream.
- **D-216-08 (Branded Presentation):** The card renders the connection's real service mark (from `connectionMark.tsx`), display name, and the specific tool name (e.g., `Google Workspace · create_document`).
- **D-216-09 (Formatted Arguments & Actions):** The card displays formatted JSON arguments and provides `[ Allow ]` and `[ Reject ]` buttons. Execution resumes immediately upon user action.

### 3. Single File Attachment from Connected Sources (ATTACH-01)
- **D-216-10 (Attachment Flyout Entry):** In the `+` menu under Connectors, entries like `"Add from Google Drive >"` or `"Import from Connected Source"` allow users to select files.
- **D-216-11 (Deliberate Human Selection):** Opens a file picker modal listing available documents from the active cloud connection. Selecting a file fetches and attaches/ingests that single document into the thread.
- **D-216-12 (No Background Sync):** Attachment is strictly human-initiated. No polling, background crawlers, or automatic sync loops (`SEED-209/210/211/212` fence preserved).

### 4. Starter Prompts on Connection (CAT-04)
- **D-216-13 (Chat Empty State Pills):** When a connection is created or active, contextual starter prompt pills appear on the Chat empty state (e.g. *"Search my Google Drive for recent PDFs"*).
- **D-216-14 (Settings Card 'Try in Chat'):** Connection cards in Settings expose a `"Try in Chat"` button that launches a new thread with that connector pre-enabled and a starter prompt pre-filled.

### 5. Security & Threat Model (Anti-Prompt-Injection)
- **D-216-15 (Untrusted Text Boundary):** Data returned from external tool reads (e.g. email contents, drive documents, web pages) is wrapped in isolation tags/markers so the model treats it as external data, mitigating indirect prompt injection (`SEED-188`).
- **D-216-16 (Audit Receipts in Chat):** All chat tool calls emit audit receipts naming service, tool, actor, and outcome (`GRANT-05`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing:**

- `.planning/REQUIREMENTS.md` §Chat surface & §Knowledge (`CHAT-05`, `CHAT-06`, `CHAT-07`, `CAT-04`, `ATTACH-01`)
- `.planning/ROADMAP.md` §Phase 216: Connections in Chat, and One File In by Hand
- `frontend/src/components/chat/MessageInput.tsx` — Chat input box & attachment menu mounting point
- `frontend/src/components/chat/ToolCallPanel.tsx` — Tool call rendering in chat stream
- `frontend/src/components/chat/ChatLayout.tsx` — Workspace and thread state provider
- `backend/app/services/agent_loop.py` — Dynamic tool registration and external action invocation
- `backend/app/services/tool_dispatcher.py` — Tool execution and grant checking

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/ui/connectionMark.tsx` — Renders official service marks for Google, GitHub, Slack, Jira, Notion, and custom MCP.
- `backend/app/services/connectors/grants.py` — Evaluates per-tool grants (`allow`, `ask`, `deny`).
- `backend/app/services/oauth_service.py` & `oauth_refresh_service.py` — Resolves and refreshes OAuth tokens for Google Workspace & Microsoft 365.
- `frontend/src/lib/api/connectors.ts` — Fetches user connector connections and tool capabilities.

### Established Patterns
- Inline stream card pause/resume via stream events.
- Hot-file ledger conventions on `ChatLayout.tsx`, `MessageInput.tsx`, `ToolCallPanel.tsx`, `MessageItem.tsx`.

</code_context>
