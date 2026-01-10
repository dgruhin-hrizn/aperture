/**
 * Helper functions for the AI Assistant
 */
export { getMediaServerInfo, buildPlayLink } from './mediaServer.js'
export { getOpenAIClient } from './openai.js'

// Re-export from new prompts module
export { buildSystemPrompt, ASSISTANT_NAME } from '../prompts/index.js'
