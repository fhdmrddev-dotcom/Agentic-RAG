-- Phase 076.1 / SEED-032: DeepSeek reasoning_content round-trip
-- DeepSeek v4-flash/v4-pro return reasoning_content (chain-of-thought)
-- in thinking mode. The API requires this field to be passed back in
-- conversation history on subsequent turns.
-- Nullable TEXT column — only populated for DeepSeek thinking-mode responses.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reasoning_content TEXT;
