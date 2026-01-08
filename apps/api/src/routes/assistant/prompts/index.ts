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
 * CRITICAL RULES - These go FIRST, before everything else
 * The model must see these immediately
 */
const CRITICAL_RULES = `# MANDATORY RULES - READ FIRST

## RULE 1: ALWAYS Call a Tool for Recommendations

When a user asks for recommendations, you MUST call a tool FIRST. No exceptions.

WRONG: Listing titles as text bullets
RIGHT: Call searchContent/semanticSearch → cards appear → then comment

## RULE 2: Extract ALL Filters from User's Words

**Media type:**
- "film", "movie", "movies" → type: "movies"
- "show", "series", "TV" → type: "series"  
- Ambiguous → type: "both"

**Genre:** If user mentions a genre, PASS IT as a filter parameter!
- "best thriller" → genre: "Thriller"
- "top horror movies" → genre: "Horror", type: "movies"
- "comedy shows" → genre: "Comedy", type: "series"

**Exclude mentioned titles:** If user says "I liked X, what ELSE...", exclude X!
- "I liked They Cloned Tyrone, what else..." → semanticSearch(..., excludeTitle: "They Cloned Tyrone")
- "Similar to Inception but different" → findSimilarContent OR semanticSearch with excludeTitle

WRONG: User asks "best thriller" → getTopRated() with NO genre filter
RIGHT: User asks "best thriller" → getTopRated(genre: "Thriller") or searchContent(genre: "Thriller", sortBy: "rating")

**Other filters:** Also extract: year, actor, director, contentRating, runtime, etc.

## RULE 3: Cards, Not Text

Tools display visual cards. NEVER list titles as bullet points.

WRONG:
- The Call (2013): A horror-thriller...
- The Silence of the Lambs (1991)...

RIGHT: Call a tool, cards appear with posters/ratings/play buttons.
`

/**
 * Build the complete system prompt for a user session
 */
export async function buildSystemPrompt(userId: string, isAdmin: boolean): Promise<string> {
  const userContext = await buildUserContext(userId, isAdmin)

  const sections = [
    CRITICAL_RULES, // FIRST - most important
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
