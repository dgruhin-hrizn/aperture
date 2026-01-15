-- Migration: Fix AI Config API Keys
-- Fixes ai_config entries that were created without API keys by migration 0075.
-- This adds the openai_api_key to each function's config if:
-- 1. The ai_config exists and was migrated from openai
-- 2. The function configs don't have apiKey set
-- 3. The openai_api_key still exists in system_settings

DO $$
DECLARE
  v_openai_key TEXT;
  v_ai_config JSONB;
  v_needs_fix BOOLEAN := FALSE;
BEGIN
  -- Get the OpenAI API key
  SELECT value INTO v_openai_key FROM system_settings WHERE key = 'openai_api_key';
  
  -- Get current ai_config
  SELECT value::JSONB INTO v_ai_config FROM system_settings WHERE key = 'ai_config';
  
  -- Only proceed if we have both an API key and an ai_config
  IF v_openai_key IS NOT NULL AND v_openai_key != '' AND v_ai_config IS NOT NULL THEN
    
    -- Check if any function config is missing the apiKey
    IF (v_ai_config->'embeddings' IS NOT NULL AND v_ai_config->'embeddings'->>'apiKey' IS NULL) OR
       (v_ai_config->'chat' IS NOT NULL AND v_ai_config->'chat'->>'apiKey' IS NULL) OR
       (v_ai_config->'textGeneration' IS NOT NULL AND v_ai_config->'textGeneration'->>'apiKey' IS NULL) THEN
      v_needs_fix := TRUE;
    END IF;
    
    IF v_needs_fix THEN
      -- Add apiKey to each function config that uses openai and is missing it
      IF v_ai_config->'embeddings' IS NOT NULL AND 
         v_ai_config->'embeddings'->>'provider' = 'openai' AND
         v_ai_config->'embeddings'->>'apiKey' IS NULL THEN
        v_ai_config := jsonb_set(v_ai_config, '{embeddings,apiKey}', to_jsonb(v_openai_key));
      END IF;
      
      IF v_ai_config->'chat' IS NOT NULL AND 
         v_ai_config->'chat'->>'provider' = 'openai' AND
         v_ai_config->'chat'->>'apiKey' IS NULL THEN
        v_ai_config := jsonb_set(v_ai_config, '{chat,apiKey}', to_jsonb(v_openai_key));
      END IF;
      
      IF v_ai_config->'textGeneration' IS NOT NULL AND 
         v_ai_config->'textGeneration'->>'provider' = 'openai' AND
         v_ai_config->'textGeneration'->>'apiKey' IS NULL THEN
        v_ai_config := jsonb_set(v_ai_config, '{textGeneration,apiKey}', to_jsonb(v_openai_key));
      END IF;
      
      -- Update the ai_config
      UPDATE system_settings 
      SET value = v_ai_config::TEXT,
          updated_at = NOW()
      WHERE key = 'ai_config';
      
      RAISE NOTICE 'Fixed ai_config: added missing API keys';
    ELSE
      RAISE NOTICE 'ai_config already has API keys - no fix needed';
    END IF;
  ELSE
    RAISE NOTICE 'No ai_config or openai_api_key found - skipping fix';
  END IF;
END $$;

