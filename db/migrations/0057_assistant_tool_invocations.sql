-- Migration: 0057_assistant_tool_invocations
-- Description: Add tool_invocations column to persist Tool UI state in conversations

ALTER TABLE assistant_messages
ADD COLUMN tool_invocations JSONB;

COMMENT ON COLUMN assistant_messages.tool_invocations IS 'Stores AI tool invocations and results for rendering Tool UI components';


