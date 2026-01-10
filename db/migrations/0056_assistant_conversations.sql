-- Migration: 0056_assistant_conversations
-- Description: Store AI assistant conversation history per user

CREATE TABLE assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assistant_conversations_user_id ON assistant_conversations(user_id);
CREATE INDEX idx_assistant_conversations_updated_at ON assistant_conversations(user_id, updated_at DESC);
CREATE INDEX idx_assistant_messages_conversation_id ON assistant_messages(conversation_id);
CREATE INDEX idx_assistant_messages_created_at ON assistant_messages(conversation_id, created_at ASC);

-- Comments
COMMENT ON TABLE assistant_conversations IS 'Stores AI assistant chat conversations per user';
COMMENT ON TABLE assistant_messages IS 'Stores messages within assistant conversations';
COMMENT ON COLUMN assistant_conversations.title IS 'Auto-generated title from first user message';


