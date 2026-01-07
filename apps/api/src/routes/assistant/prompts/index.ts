/**
 * System Prompt Assembler
 *
 * This module assembles the complete system prompt from modular pieces.
 * Each section is kept in its own file for maintainability.
 *
 * Prompt Structure:
 * 1. Identity - Who the assistant is
 * 2. User Context - Dynamic user-specific info (taste, history, role)
 * 3. Rules - How to behave
 *    a. Formatting - Output format rules
 *    b. Tools - Tool selection guidance
 *    c. Behavior - Conversational style
 * 4. Admin Context - Admin-only capabilities (if applicable)
 */

import { IDENTITY, ASSISTANT_NAME } from './identity.js'
import {
  FORMATTING_RULES,
  TOOL_SELECTION_RULES,
  BEHAVIOR_RULES,
  ANTIPATTERNS,
} from './rules/index.js'
import { buildUserContext, ADMIN_CONTEXT } from './context/index.js'

export { ASSISTANT_NAME }

/**
 * Build the complete system prompt for a user session
 */
export async function buildSystemPrompt(userId: string, isAdmin: boolean): Promise<string> {
  const userContext = await buildUserContext(userId, isAdmin)

  const sections = [
    IDENTITY,
    userContext,
    FORMATTING_RULES,
    TOOL_SELECTION_RULES,
    BEHAVIOR_RULES,
    ANTIPATTERNS,
  ]

  // Add admin context only for admins
  if (isAdmin) {
    sections.push(ADMIN_CONTEXT)
  }

  return sections.join('\n\n')
}

/**
 * Get just the static rules (useful for testing/debugging)
 */
export function getStaticRules(): string {
  return [IDENTITY, FORMATTING_RULES, TOOL_SELECTION_RULES, BEHAVIOR_RULES, ANTIPATTERNS].join(
    '\n\n'
  )
}

/**
 * Get admin context (useful for testing)
 */
export function getAdminContext(): string {
  return ADMIN_CONTEXT
}
