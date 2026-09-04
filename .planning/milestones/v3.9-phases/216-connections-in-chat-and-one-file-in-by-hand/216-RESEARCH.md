# Phase 216: Connections in Chat, and One File In by Hand — Research

**Gathered:** 2026-08-30
**Status:** Complete & validated

## 1. Executive Summary & Blast Radius

Phase 216 elevates connected services (Google Workspace, GitHub, Slack, Jira, Notion, custom MCP) into interactive platform assets accessible directly within chat threads.

### Requirements Mapped
- `CHAT-05`: Add connected service to a thread; agent chooses and executes granted tools.
- `CHAT-06`: View and toggle active connected services in a thread without starting a new thread.
- `CHAT-07`: Chat tool calls render with the service's mark, name, and tool name.
- `CAT-04`: Starter prompts for connected services on Chat empty state & Settings cards.
- `ATTACH-01`: Pick one named file from a connected cloud source (Google Drive) and attach/ingest it into the thread.

### Blast Radius & File Boundaries
1. **Frontend Chat Input & Composer:**
   - `frontend/src/components/chat/MessageInput.tsx` — Claude.ai-style `+` button, Connectors flyout menu with toggles, active connector chips bar, `@` mention popover.
   - `frontend/src/components/chat/ChatLayout.tsx` — Thread connector state synchronization.
   - `frontend/src/components/chat/ChatEmptyState.tsx` — Dynamic starter prompt pills for connected services.
2. **Frontend Tool Call & Approval Rendering:**
   - `frontend/src/components/chat/ToolCallPanel.tsx` & `MessageItem.tsx` — Branded tool rendering (`connectionMark.tsx`) and inline interactive approval cards with `[Allow]` / `[Reject]`.
   - `frontend/src/components/chat/ConnectedFilePickerModal.tsx` [NEW] — Single-file browser for Google Drive / cloud storage.
3. **Backend Agent Loop & Tool Dispatcher:**
   - `backend/app/services/agent_loop.py` — Dynamic injection of active connector tools into model tool definitions.
   - `backend/app/services/tool_dispatcher.py` — Dynamic connector tool execution and `ask` posture stream pause events.
   - `backend/app/api/threads.py` — Thread message creation with active connector IDs and approval response endpoints.
   - `backend/app/api/connectors.py` & `backend/app/services/connector_service.py` — Single-file browsing and fetch endpoints for connected cloud sources.

---

## 2. Technical Architecture & Data Flow

### A. Thread Connector Lifecycle
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as MessageInput (+ Menu)
    participant Chat as ChatLayout / Thread
    participant API as POST /threads/{id}/messages
    participant Loop as AgentLoop
    participant Disp as ToolDispatcher
    participant OAuth as OAuth Token Service

    User->>UI: Toggle Google Workspace [ON] in + Menu
    UI->>Chat: Add Google Workspace chip [🌐 Google Workspace ✕]
    User->>UI: Types "Search my drive for Q3 report" & sends
    UI->>API: Send message with active_connector_ids=[...]
    API->>Loop: Run agent with dynamically bound connector tools
    Loop->>Disp: Dispatch google_workspace__search_files
    Disp->>OAuth: Decrypt & refresh Google OAuth token
    Disp->>Disp: Execute API call against Google Drive
    Disp-->>Loop: Tool Result (wrapped in untrusted data tags)
    Loop-->>UI: Assistant stream with tool invocation & answer
```

### B. Tool Approval Moment in Chat Stream
```mermaid
sequenceDiagram
    autonumber
    participant Loop as AgentLoop
    participant Disp as ToolDispatcher
    participant Stream as SSE Stream
    participant UI as ToolCallPanel / MessageItem
    actor User

    Loop->>Disp: Dispatch google_workspace__create_document
    Disp->>Disp: Check grant posture -> "ask"
    Disp->>Stream: Emit `tool_approval_required` event {call_id, service, tool, args}
    Stream->>UI: Render inline Approval Card with [Allow] / [Reject]
    User->>UI: Click [Allow]
    UI->>Stream: POST /threads/{id}/tool-approval {call_id, decision: "allow"}
    Stream->>Disp: Resume execution with authorized grant
    Disp-->>Stream: Tool Result & Continue generation
```

---

## 3. Hot-File Ledger Review (G-5)

The following files touched by Phase 216 are monitored under the G-5 hot-file ledger:
- `frontend/src/components/chat/MessageInput.tsx` (25/13/478 L): Leaf extraction of `ConnectorsFlyoutMenu` and `ActiveConnectorChips` keeps `MessageInput.tsx` clean and concise.
- `frontend/src/components/chat/ToolCallPanel.tsx` (47/19/995 L): Leaf component `ChatToolApprovalCard.tsx` handles interactive approval rendering without inflating `ToolCallPanel.tsx`.
- `backend/app/services/agent_loop.py`: Dynamic tool builder extracted to helper `app/services/connectors/chat_tools.py` preserving clean separation.

---

## 4. Threat Model & Security Mitigations

1. **Prompt Injection Mitigation (`D-216-15`, `SEED-188`):**
   - External data retrieved from third-party tools (Google Drive, Gmail, Slack, Jira, web) contains untrusted user/attacker input.
   - All tool responses returned to the model are encapsulated within `<external_tool_result service="..." tool="...">...</external_tool_result>` isolation envelopes with explicit system instruction forbidding instructions inside tool output from overriding base instructions.
2. **Permission Fail-Closed (`GRANT-04`, `GRANT-05`):**
   - Any tool call not explicitly in `allow` posture is either paused for human confirmation (`ask`) or refused (`deny`).
   - All tool executions log structured audit receipts.
3. **Strict Single-File Ingestion Boundary (`ATTACH-01`):**
   - Cloud attachments are strictly single-file, user-initiated operations. No automatic crawlers or background sync loops (`SEED-209/210/211/212` preserved).
