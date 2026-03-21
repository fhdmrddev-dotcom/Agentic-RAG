-- Add tool_calls column to messages for persisting agentic tool use
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_calls JSONB;
