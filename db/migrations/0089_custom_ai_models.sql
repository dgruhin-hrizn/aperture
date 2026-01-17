-- Migration: Custom AI Models
-- Allows users to persist custom model names for Ollama and OpenAI-compatible providers

CREATE TABLE custom_ai_models (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,           -- 'ollama' or 'openai-compatible'
  function_type TEXT NOT NULL,      -- 'embeddings', 'chat', 'textGeneration', 'exploration'
  model_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, function_type, model_id)
);

-- Add constraint to ensure only supported providers
ALTER TABLE custom_ai_models
ADD CONSTRAINT custom_ai_models_provider_check
CHECK (provider IN ('ollama', 'openai-compatible'));

-- Add constraint to ensure only valid function types
ALTER TABLE custom_ai_models
ADD CONSTRAINT custom_ai_models_function_type_check
CHECK (function_type IN ('embeddings', 'chat', 'textGeneration', 'exploration'));

-- Index for efficient lookups
CREATE INDEX idx_custom_ai_models_provider_function
ON custom_ai_models(provider, function_type);

COMMENT ON TABLE custom_ai_models IS 'User-defined custom models for Ollama and OpenAI-compatible providers';
