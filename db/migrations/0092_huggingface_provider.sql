-- Migration: Add HuggingFace as a supported AI provider
-- Allows using HuggingFace Inference API models through custom model configuration

DO $$ BEGIN RAISE NOTICE '[0092] Adding huggingface to custom_ai_models provider constraint...'; END $$;

-- Update the provider check constraint to include huggingface
ALTER TABLE custom_ai_models
DROP CONSTRAINT IF EXISTS custom_ai_models_provider_check;

ALTER TABLE custom_ai_models
ADD CONSTRAINT custom_ai_models_provider_check
CHECK (provider IN ('ollama', 'openai-compatible', 'openrouter', 'huggingface'));

DO $$ BEGIN RAISE NOTICE '[0092] HuggingFace provider support added!'; END $$;
