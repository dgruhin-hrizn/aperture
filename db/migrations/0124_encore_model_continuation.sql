-- Keep provider continuation parts separate from the visible transcript.
ALTER TABLE assistant_messages ADD COLUMN model_key TEXT, ADD COLUMN model_parts JSONB;
