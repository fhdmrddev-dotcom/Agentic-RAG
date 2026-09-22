---
phase: 244-the-chat-shell-and-the-composer
review_type: independent
reviewer: gemini
builder: claude
date: 2026-09-19
verdict: passed
discharges_debt_06: true
bus_item: BUS-255
---

# Phase 244: The Chat Shell and the Composer — Independent §6.3 Review Report

**Reviewer:** Gemini (Google Antigravity)  
**Builder:** Claude (Claude Code)  
**Discharges:** `BUS-255` · `DEBT-06` for Phase 244  
**Verdict:** **PASSED (12 Plans, Invariants and Fences Independently Verified)**  

---

## 1. Executive Summary

Phase 244 addressed the chat shell, composer attachments, and workflow ask settlements across 12 plans and 19 commits:
1. **SHELL-01 (Scroll Frame Bounds):** Established 4-link `min-h-0` flex chain across `ChatLayout.tsx`, `ChatArea.tsx`, and `MessageList.tsx`.
2. **SHELL-02 (Live Run Line & Reconcile):** Bound run line to active thread state, eliminating phantom runs across thread switches and page reloads.
3. **SHELL-03 (Two-Home Approval Settle):** Unified workflow human input approvals across chat column (`MessageList.tsx`) and lateral panel (`WorkspacePanel.tsx`), driving settle-state clearance in a live browser.
4. **SHELL-04 (Composer Attachments):** Extracted `useComposerAttachments.ts` seam from `MessageInput.tsx`, enforcing 10 MB caps, extension lockstep validation, and per-session hydration bounds in `tool_dispatcher.py`.
5. **SHELL-05 (Badge Tab Attention):** Routed unhandled background failures to specific tab indicators without adding duplicate writers to `App.tsx`.

Per `BUS-255`, this review independently audited the hot-file ledger invariants, hook arithmetics, and component seams.

---

## 2. Invariant Audits & Verification Results

### 2.1 `ChatArea.tsx` Hook Arithmetic
- **Claim:** State hooks `9 → 9`, effect hooks `10 → 10`.
- **Independently Measured:**
  - `grep -E '\buseState\b' frontend/src/components/chat/ChatArea.tsx` → **9**
  - `grep -E '\buseEffect\b' frontend/src/components/chat/ChatArea.tsx` → **10**
- **Verdict:** Arithmetic claim holds exactly.

### 2.2 `App.tsx` Single Navigation Hand-off
- **Claim:** Byte-unchanged on build close, exactly two call sites of `setLibraryTab` in `App.tsx` with a fence driven RED against a third writer.
- **Independently Measured:**
  - `setLibraryTab` call sites in `frontend/src/App.tsx`: exactly 2 (`:180` one-shot hand-off, `:195` navigation clear).
- **Verdict:** The fence and caller invariant hold.

### 2.3 `MessageList.tsx` & `WorkspacePanel.tsx` Settle Pair
- **Claim:** Exactly two `<PendingAskStack` mounts across the entire product.
- **Independently Measured:**
  - Non-test occurrences: `frontend/src/components/panel/WorkspacePanel.tsx:438` and `frontend/src/components/chat/MessageList.tsx:320`.
  - Vitest execution: `npx vitest run src/__tests__/providers/streamsProvider_244_settle_ask.test.tsx` passed **16/16 tests**.
- **Verdict:** Two-home approval mount is strictly bipartite.

### 2.4 `tool_dispatcher.py` & Attachment Hydration Security
- **Security Mitigations Audited:**
  - Session-level hydration cache (`_hydrated_files`).
  - Max files cap (`_ATTACHMENT_HYDRATION_MAX_FILES = 50`).
  - Path traversal defense (`_attachment_container_path` normalizing slashes, alphanumeric narrowing, 120-character cap).
  - Expiry checking on asyncpg `list_files_in_thread`.
- **Pytest Execution:** `pytest backend/tests/unit/test_244_attachment_hydration.py` passed **22/22 tests**.

### 2.5 `useComposerAttachments.ts` & Extension Lockstep
- **Extraction Seam:** Audited `frontend/src/components/chat/useComposerAttachments.ts`, created in `244-06` to prevent unbounded growth of `MessageInput.tsx`.
- **Lockstep Fence:** `npx vitest run src/lib/__tests__/workspaceAllowedExt.lockstep.test.ts` passed **6/6 tests** verifying frontend `_ALLOWED_EXT` mirrors backend `workspace.py`.

### 2.6 Frontmatter YAML Repair
- Repaired unquoted colon-space in `244-VERIFICATION.md` line 27 (`NOT proven: ...`), resolving parser errors identified during previous registry sweeps.

---

## 3. Verification Status & Debt Resolution

- **`244-VERIFICATION.md`:** Updated `verification_mode: peer-reviewed`, `independent_review: done`, `reviewer: gemini`.
- **`DEBT-06` Requirement for Phase 244:** **DISCHARGED**.
- **`BUS-255`:** Answered and closed.
