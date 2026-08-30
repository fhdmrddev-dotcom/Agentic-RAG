# Phase 216: Connections in Chat, and One File In by Hand — Validation Strategy

**Gathered:** 2026-08-30
**Status:** Complete & verified

## 1. Automated Verification Gauntlet

### Backend Suites
```bash
# 1. Dynamic connector chat tool generation and prompt injection defense
pytest backend/tests/unit/test_chat_connector_tools.py -v

# 2. Tool approval stream pause and resume
pytest backend/tests/unit/test_chat_tool_approval.py -v

# 3. Single-file connected cloud browser & fetcher
pytest backend/tests/unit/test_connector_file_import.py -v

# 4. Full end-to-end chat tool execution integration test
pytest backend/tests/integration/test_chat_connectors_e2e.py -v
```

### Frontend Suites & Typecheck
```bash
# 1. Frontend Typecheck
npx tsc --noEmit -p tsconfig.app.json

# 2. MessageInput + Connectors flyout menu + chips tests
npx vitest run src/components/chat/__tests__/MessageInput.connectors.test.tsx

# 3. ChatToolApprovalCard tests (inline approval render & actions)
npx vitest run src/components/chat/__tests__/ChatToolApprovalCard.test.tsx

# 4. ConnectedFilePickerModal tests (single-file cloud picker)
npx vitest run src/components/chat/__tests__/ConnectedFilePickerModal.test.tsx

# 5. Vitest Count Gate
node scripts/vitest-count-gate.cjs
```

---

## 2. Success Criteria & Verification Matrix

| Requirement | Description | Automated Test | Manual / Browser Verification |
|---|---|---|---|
| **CHAT-05** | Add connected service to thread; agent autonomously invokes granted tools | `test_chat_connectors_e2e.py` | Toggle Google Workspace ON, type "Search my drive for doc", observe model calling search tool |
| **CHAT-06** | See active connectors and toggle/dismiss them without restarting thread | `MessageInput.connectors.test.tsx` | Click `✕` on connector pill, verify service removed from thread context |
| **CHAT-07** | Branded tool call rendering with service icon and real tool name | `ChatToolApprovalCard.test.tsx` | Observe tool pill in stream showing Google icon and real tool name |
| **CAT-04** | Starter prompt pills on Chat empty state and Settings card | `ChatEmptyState.test.tsx` | Click starter prompt pill in empty state, verify new thread created with prefilled prompt |
| **ATTACH-01** | Single file attachment from connected cloud source | `ConnectedFilePickerModal.test.tsx` | Open `+` > "Add from Google Drive", pick a file, verify document attached to message |
