import type { ToolSet } from 'ai'
/**
 * AI Assistant Tools
 *
 * This module combines all tools and exports the factory function.
 */
import type { ToolContext } from '../types.js'
import { createLibraryTools } from './library.js'
import { createSearchTools } from './search.js'
import { createContentTools } from './content.js'
import { createHistoryTools } from './history.js'
import { createRecommendationTools } from './recommendations.js'
import { createPeopleTools } from './people.js'
import { createHelpTools } from './help.js'
import { createDiscoveryTools } from './discovery.js'

/**
 * Create all assistant tools with the given context
 */
export function createTools(ctx: ToolContext): ToolSet {
  return {
    ...createLibraryTools(ctx),
    ...createSearchTools(ctx),
    ...createContentTools(ctx),
    ...createHistoryTools(ctx),
    ...createRecommendationTools(ctx),
    ...createPeopleTools(ctx),
    ...createHelpTools(ctx),
    ...createDiscoveryTools(ctx),
  }
}
