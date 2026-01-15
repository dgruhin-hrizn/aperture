-- Migration: AI Provider Configuration
-- This migration sets up per-function AI provider configuration and automatically
-- migrates existing OpenAI users to the new format.

-- The ai_config is stored as JSON in system_settings with the following structure:
-- {
--   "embeddings": { "provider": "openai", "model": "text-embedding-3-large" },
--   "chat": { "provider": "openai", "model": "gpt-4o-mini" },
--   "textGeneration": { "provider": "openai", "model": "gpt-4o-mini" }
-- }
-- API keys are stored separately as {provider}_api_key in system_settings

-- Automatically migrate existing OpenAI users to new ai_config format
DO $$
DECLARE
  v_openai_key TEXT;
  v_embed_model TEXT;
  v_text_model TEXT;
  v_chat_model TEXT;
  v_ai_config JSONB;
BEGIN
  -- Get existing OpenAI configuration
  SELECT value INTO v_openai_key FROM system_settings WHERE key = 'openai_api_key';
  SELECT value INTO v_embed_model FROM system_settings WHERE key = 'embedding_model';
  SELECT value INTO v_text_model FROM system_settings WHERE key = 'text_generation_model';
  SELECT value INTO v_chat_model FROM system_settings WHERE key = 'chat_assistant_model';
  
  -- Only migrate if OpenAI API key is configured
  IF v_openai_key IS NOT NULL AND v_openai_key != '' THEN
    -- Build the new configuration, defaulting all functions to OpenAI
    v_ai_config := jsonb_build_object(
      'embeddings', jsonb_build_object(
        'provider', 'openai',
        'model', COALESCE(v_embed_model, 'text-embedding-3-large')
      ),
      'chat', jsonb_build_object(
        'provider', 'openai',
        'model', COALESCE(v_chat_model, 'gpt-4o-mini')
      ),
      'textGeneration', jsonb_build_object(
        'provider', 'openai',
        'model', COALESCE(v_text_model, 'gpt-4o-mini')
      ),
      'migratedAt', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'migratedFrom', 'openai_api_key'
    );
    
    -- Insert or update the ai_config
    INSERT INTO system_settings (key, value, description)
    VALUES ('ai_config', v_ai_config::TEXT, 'Per-function AI provider configuration (migrated from OpenAI)')
    ON CONFLICT (key) DO UPDATE SET 
      value = v_ai_config::TEXT,
      description = 'Per-function AI provider configuration (migrated from OpenAI)',
      updated_at = NOW();
    
    RAISE NOTICE 'Migrated existing OpenAI configuration to ai_config format';
  ELSE
    RAISE NOTICE 'No existing OpenAI API key found - skipping migration';
  END IF;
END $$;

-- Add comment to track migration
COMMENT ON TABLE system_settings IS 'System settings including per-function AI provider configuration (ai_config)';

