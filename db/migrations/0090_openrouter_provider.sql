-- Migration: Add OpenRouter support to custom AI models
-- OpenRouter allows access to many models through a single API

-- Update the provider constraint to include 'openrouter'
ALTER TABLE custom_ai_models
DROP CONSTRAINT IF EXISTS custom_ai_models_provider_check;

ALTER TABLE custom_ai_models
ADD CONSTRAINT custom_ai_models_provider_check
CHECK (provider IN ('ollama', 'openai-compatible', 'openrouter'));
