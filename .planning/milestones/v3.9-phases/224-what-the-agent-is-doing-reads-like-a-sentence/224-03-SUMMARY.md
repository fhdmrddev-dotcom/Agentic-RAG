# Plan 224-03: Docked Approval Card with Local Countdown — Summary

## 1. Overview & Objectives
Plan 224-03 implemented **Winner A** from Sketch 226 (`226-the-card-you-can-reach-and-its-clock`), resolving `BUG-260902-04` (D-224-02).
Previously, tool approval cards were rendered only inline in the chat transcript. If an agent generated lengthy output or if the viewport was scrolled away, the operator had to hunt for the approval prompt or miss it entirely until the call timed out.

With Plan 224-03:
1. Active pending approval requests dock directly above `MessageInput` in `ChatArea.tsx` (`data-testid="docked-tool-approval"`). They remain permanently in view regardless of transcript scroll depth.
2. A live countdown clock is anchored locally to `timeoutSeconds` (`120.0`s) and `expiresAt` received on the wire from the backend (`tool_dispatcher.py`). Anchoring duration from receipt time eliminates client-server clock skew.
3. As the clock ticks down, the card provides clear visual feedback:
   - High time: tabular countdown display (`1m 59s remaining`).
   - Low time (<= 15s): animated pulsing alert.
   - Timed out (0s): display shifts to `"Approval timed out"` and action buttons (`Allow Action`, `Reject`, `Always allow`) are disabled.
4. When the operator makes a decision (or when the stream completes), the docked card cleanly unmounts from above the input box and permanently settles in the transcript as a historic receipt (`Approved`, `Always allowed`, or `Rejected`).
5. `MessageItem.tsx` guards against rendering duplicate active buttons while the card is docked in `ChatArea.tsx`.

---

## 2. Key Changes Made

### A. Wire Types & Event Dispatch
- [`frontend/src/types/index.ts`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/types/index.ts):
  - Updated `Message.toolApproval` to include `expiresAt?: string`, `timeoutSeconds?: number`, and `decision?: "allow" | "reject" | "always"`.
- [`frontend/src/lib/api/threads.ts`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/lib/api/threads.ts):
  - Added `expiresAt` and `timeoutSeconds` to `StreamCallbacks.onToolApprovalRequired`.
  - Mapped `expires_at` and `timeout_seconds` in `subscribeToRun` SSE parser.

### B. Countdown & Lifecycle in `ChatToolApprovalCard.tsx`
- [`frontend/src/components/chat/ChatToolApprovalCard.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/chat/ChatToolApprovalCard.tsx):
  - Added `expiresAt`, `timeoutSeconds`, and `decision` to `ToolApprovalRequest`.
  - Added `targetEpochMs` state computed on mount from `timeoutSeconds` or `expiresAt`.
  - Added 1-second interval timer updating `secondsRemaining`.
  - Added `approval-countdown` badge beside `"Approval Required"` in the header with Clock icon.
  - Disabled action buttons (`Allow Action`, `Reject`, `Always allow`) when `secondsRemaining === 0` (`disabled={submitting || isTimedOut}`).
  - Synchronized `settled` state with `approval.decision` so settled state persists cleanly.

### C. Docked Mounting in `ChatArea.tsx` & Transcript Guard in `MessageItem.tsx`
- [`frontend/src/components/chat/ChatArea.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/chat/ChatArea.tsx):
  - Derived `pendingApproval` from latest stream message where `toolApproval` has no decision recorded.
  - Mounted docked container (`data-testid="docked-tool-approval"`) above `{inputBar}`.
  - Dispatched `onDecision` to record decision and unmount the docked card.
- [`frontend/src/components/chat/MessageItem.tsx`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/chat/MessageItem.tsx):
  - Gated inline rendering: `{message.toolApproval && (message.toolApproval.decision || !isStreaming) && <ChatToolApprovalCard ... />}`.
  - Strictly preserved G-5 hot-file contract: exactly 829 lines, 4 states, 0 effects.

---

## 3. Verification & Measurements

1. **Vitest Unit Suite**:
   - `src/components/chat/__tests__/ToolApproval.test.tsx`:
     - **24 tests passed** (19 existing + 5 new tests):
       - `renders ticking countdown clock when timeoutSeconds is provided`
       - `renders ticking countdown clock when expiresAt is provided`
       - `disables action buttons and shows timed out copy when deadline has passed`
       - `gracefully renders standard card when expiresAt and timeoutSeconds are omitted`
       - `renders initial settled state when approval carries a decision`
   - `src/components/chat/__tests__/ChatArea.model.test.tsx` + `ChatAreaBanner.test.tsx`:
     - **9 tests passed** (2 + 7).
2. **TypeScript Compilation**:
   - `npx tsc -p tsconfig.app.json`: Exactly 66 errors (0 new errors introduced).
3. **Hot-File Ledger Compliance**:
   - `MessageItem.tsx`:
     - Measured lines: **829**
     - Hooks: **4 useState, 0 useEffect**
4. **Browser Subagent Visual Acceptance Drive**:
   - Driven in Chromium browser via `browser_subagent`.
   - Recording saved: `docked_card_drive_1788382176354.webp`.
   - Verified docked positioning above `MessageInput`, live countdown clock, low-time pulse (15s), timed out button disabling (0s), and seamless resolution into the transcript upon clicking `Allow Action`.

---

## 4. Commits
- [`2fa3d36d5`](file:///c:/Vibe%20Apps/Agentic%20RAG/frontend/src/components/chat/ChatToolApprovalCard.tsx): `feat(224-03): docked approval card with local countdown`
