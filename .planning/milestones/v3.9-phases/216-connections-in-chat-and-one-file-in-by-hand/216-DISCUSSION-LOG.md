# Phase 216: Discussion Log

**Date:** 2026-08-30
**Participants:** Operator, Gemini

## Summary of Decisions

1. **Connector Discovery & Control in Chat (`CHAT-05`, `CHAT-06`):**
   - Operator provided design reference from Claude.ai showing `+` menu on chat input with a "Connectors" flyout containing toggle switches per service.
   - Operator noted that users often don't remember all available tools, making a toggle flyout and visible active chips superior to relying solely on `@` mentions.
   - Decided on Hybrid approach: `+` menu with connector toggles + dismissible chips above input + optional `@` mention autocomplete.

2. **Chat Approval Moment (`CHAT-07`, `GRANT-03`):**
   - Inline interactive cards in assistant message stream displaying real service mark, tool name, formatted parameters, and `[Allow]` / `[Reject]` action buttons.

3. **Single File Attachment (`ATTACH-01`):**
   - "Import from Connected Source" option in chat `+` menu opening cloud file picker for single-document ingestion without automatic background synchronization.

4. **Starter Prompts (`CAT-04`):**
   - Contextual prompt chips on Chat empty state and "Try in Chat" button on Settings connection cards.
