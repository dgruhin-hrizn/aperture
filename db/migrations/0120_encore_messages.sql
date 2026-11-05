ALTER TABLE assistant_messages ADD COLUMN message_key TEXT;
ALTER TABLE assistant_messages ADD COLUMN parts JSONB;
UPDATE assistant_messages SET message_key = id::text;
ALTER TABLE assistant_messages ALTER COLUMN message_key SET NOT NULL;
CREATE UNIQUE INDEX assistant_messages_message_key ON assistant_messages(conversation_id, message_key);
ALTER TABLE assistant_conversations ADD COLUMN active_run_id UUID;
ALTER TABLE assistant_conversations ADD COLUMN run_expires_at TIMESTAMPTZ;
