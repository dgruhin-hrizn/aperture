import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getOpenAIClient } from '../lib/openai.js'
import type { SimilarityItem, SimilarityConnection } from './index.js'
import type { ConnectionReason } from './reasons.js'

const logger = createChildLogger('similarity:diverse')

// ============================================================================
// Types
// ============================================================================

export interface BubbleAnalysis {
  isBubbled: boolean
  dominantCollection: string | null
  collectionPercentage: number
  uniqueCollections: number
}

export interface DiverseResult {
  items: SimilarityItem[]
  aiSuggested: boolean
}

export interface ConnectionValidation {
  isValid: boolean
  reason: string
  fromCache: boolean
}

// Common title patterns that cause false positive matches
const TITLE_PATTERNS = [
  /^return of /i,
  /^the return of /i,
  / returns?$/i,
  /^revenge of /i,
  /^rise of /i,
  /^attack of /i,
  /^battle of /i,
  /^escape from /i,
  /^journey to /i,
  / ii$/i,
  / iii$/i,
  / 2$/,
  / 3$/,
]

// ============================================================================
// Connection Validation (Title, Genre, Collection checks + AI validation)
// ============================================================================

/**
 * Validate if a connection between two items is legitimate.
 * Applies multiple filters to catch false positives.
 */
export async function validateConnection(
  source: SimilarityItem,
  target: SimilarityItem,
  options: { useAI?: boolean } = {}
): Promise<ConnectionValidation> {
  const { useAI = true } = options

  // 1. Title Pattern Filter - detect false positives from similar title patterns
  const titleIssue = detectTitlePatternMatch(source.title, target.title)
  if (titleIssue) {
    logger.debug(
      { source: source.title, target: target.title, issue: titleIssue },
      'Connection rejected: title pattern match'
    )
    return { isValid: false, reason: titleIssue, fromCache: false }
  }

  // 2. Genre Gate - require at least one shared genre
  const sharedGenres = findSharedGenres(source.genres, target.genres)
  if (sharedGenres.length === 0) {
    logger.debug(
      { source: source.title, target: target.title, sourceGenres: source.genres, targetGenres: target.genres },
      'Connection rejected: no shared genres'
    )
    return { isValid: false, reason: 'No shared genres', fromCache: false }
  }

  // 3. Collection Chain Prevention - don't connect unrelated franchises
  if (source.collection_name && target.collection_name) {
    const collectionsRelated = areCollectionsRelated(source.collection_name, target.collection_name)
    if (!collectionsRelated) {
      // Check cache first before calling AI
      const cached = await getCachedValidation(source.id, target.id)
      if (cached !== null) {
        return { isValid: cached.is_valid, reason: cached.reason || 'Cached result', fromCache: true }
      }

      // If AI validation is enabled and collections seem unrelated, verify with AI
      if (useAI) {
        const aiValidation = await validateWithAI(source, target)
        // Cache the result
        await cacheValidation(source.id, target.id, source.type, target.type, aiValidation.isValid, aiValidation.reason)
        return { ...aiValidation, fromCache: false }
      }

      // Without AI, reject unrelated collection chains
      return { isValid: false, reason: 'Unrelated collection chain', fromCache: false }
    }
  }

  return { isValid: true, reason: 'Passed all filters', fromCache: false }
}

/**
 * Detect if two titles match due to similar patterns rather than actual content
 */
function detectTitlePatternMatch(title1: string, title2: string): string | null {
  // Extract the pattern part and the unique part
  for (const pattern of TITLE_PATTERNS) {
    const match1 = title1.match(pattern)
    const match2 = title2.match(pattern)

    if (match1 && match2) {
      // Both titles have the same pattern - this might be a false positive
      // Remove the pattern and check if remaining parts are related
      const core1 = title1.replace(pattern, '').trim().toLowerCase()
      const core2 = title2.replace(pattern, '').trim().toLowerCase()

      // If the core parts are very different, this is likely a false positive
      if (core1 !== core2 && !core1.includes(core2) && !core2.includes(core1)) {
        return `Similar title pattern "${match1[0]}" but unrelated content`
      }
    }
  }

  return null
}

/**
 * Find shared genres between two items
 */
function findSharedGenres(genres1: string[], genres2: string[]): string[] {
  const set1 = new Set(genres1.map(g => g.toLowerCase()))
  return genres2.filter(g => set1.has(g.toLowerCase()))
}

/**
 * Check if two collections are related (same franchise, studio universe, etc.)
 */
function areCollectionsRelated(collection1: string, collection2: string): boolean {
  const c1 = collection1.toLowerCase()
  const c2 = collection2.toLowerCase()

  // Same collection
  if (c1 === c2) return true

  // Extract franchise name (e.g., "Star Wars" from "Star Wars Collection")
  const franchise1 = c1.replace(/\s*collection$/i, '').trim()
  const franchise2 = c2.replace(/\s*collection$/i, '').trim()

  // Same franchise
  if (franchise1 === franchise2) return true

  // Check for related franchises (e.g., "LEGO Star Wars" relates to "Star Wars")
  if (franchise1.includes(franchise2) || franchise2.includes(franchise1)) return true

  // Known related franchises
  const relatedGroups = [
    ['star wars', 'lego star wars', 'ewok'],
    ['star trek'],
    ['marvel', 'avengers', 'iron man', 'captain america', 'thor', 'spider-man', 'x-men'],
    ['dc', 'batman', 'superman', 'justice league', 'wonder woman'],
    ['lord of the rings', 'hobbit', 'middle-earth'],
    ['harry potter', 'fantastic beasts', 'wizarding world'],
    ['disney princess', 'frozen', 'tangled', 'moana'],
    ['pixar', 'toy story', 'cars', 'finding nemo', 'incredibles'],
  ]

  for (const group of relatedGroups) {
    const inGroup1 = group.some(f => franchise1.includes(f))
    const inGroup2 = group.some(f => franchise2.includes(f))
    if (inGroup1 && inGroup2) return true
  }

  return false
}

// ============================================================================
// AI Validation with Caching
// ============================================================================

/**
 * Use AI to validate if a connection makes sense
 */
async function validateWithAI(
  source: SimilarityItem,
  target: SimilarityItem
): Promise<{ isValid: boolean; reason: string }> {
  try {
    const client = await getOpenAIClient()

    const prompt = `Are these two movies thematically related enough to recommend together?

Movie 1: "${source.title}" (${source.year || 'unknown'})
- Genres: ${source.genres.join(', ') || 'unknown'}
- Collection: ${source.collection_name || 'none'}

Movie 2: "${target.title}" (${target.year || 'unknown'})
- Genres: ${target.genres.join(', ') || 'unknown'}
- Collection: ${target.collection_name || 'none'}

Answer with ONLY "YES" or "NO" followed by a brief reason (max 10 words).
Example: "YES - both epic space adventures" or "NO - completely different genres and themes"`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0,
    })

    const content = response.choices[0]?.message?.content || ''
    const isValid = content.toUpperCase().startsWith('YES')
    const reason = content.replace(/^(YES|NO)\s*[-–—:.]?\s*/i, '').trim() || (isValid ? 'AI approved' : 'AI rejected')

    logger.info(
      { source: source.title, target: target.title, isValid, reason },
      'AI validated connection'
    )

    return { isValid, reason }
  } catch (error) {
    logger.error({ error }, 'AI validation failed, defaulting to reject')
    return { isValid: false, reason: 'AI validation error' }
  }
}

/**
 * Check cache for existing validation
 */
async function getCachedValidation(
  sourceId: string,
  targetId: string
): Promise<{ is_valid: boolean; reason: string | null } | null> {
  // Check both directions (source->target and target->source)
  const result = await queryOne<{ is_valid: boolean; reason: string | null }>(
    `SELECT is_valid, reason FROM similarity_validation_cache
     WHERE (source_id = $1 AND target_id = $2) OR (source_id = $2 AND target_id = $1)`,
    [sourceId, targetId]
  )
  return result || null
}

/**
 * Cache a validation result
 */
async function cacheValidation(
  sourceId: string,
  targetId: string,
  sourceType: string,
  targetType: string,
  isValid: boolean,
  reason: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO similarity_validation_cache (source_id, target_id, source_type, target_type, is_valid, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (source_id, target_id) DO UPDATE SET is_valid = $5, reason = $6, created_at = NOW()`,
      [sourceId, targetId, sourceType, targetType, isValid, reason]
    )
    logger.debug({ sourceId, targetId, isValid }, 'Cached validation result')
  } catch (error) {
    logger.error({ error }, 'Failed to cache validation')
  }
}

/**
 * Get cache statistics
 */
export async function getValidationCacheStats(): Promise<{
  totalEntries: number
  validCount: number
  invalidCount: number
}> {
  const result = await queryOne<{
    total: string
    valid: string
    invalid: string
  }>(
    `SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_valid) as valid,
      COUNT(*) FILTER (WHERE NOT is_valid) as invalid
     FROM similarity_validation_cache`
  )

  return {
    totalEntries: parseInt(result?.total || '0', 10),
    validCount: parseInt(result?.valid || '0', 10),
    invalidCount: parseInt(result?.invalid || '0', 10),
  }
}

// ============================================================================
// Bubble Detection
// ============================================================================

/**
 * Analyze if a set of items forms a "bubble" (too many from same collection)
 */
export function analyzeBubble(
  items: SimilarityItem[],
  threshold = 0.6
): BubbleAnalysis {
  if (items.length === 0) {
    return {
      isBubbled: false,
      dominantCollection: null,
      collectionPercentage: 0,
      uniqueCollections: 0,
    }
  }

  // Count items per collection
  const collectionCounts = new Map<string, number>()
  let itemsWithCollection = 0

  for (const item of items) {
    const collection = item.collection_name
    if (collection) {
      collectionCounts.set(collection, (collectionCounts.get(collection) || 0) + 1)
      itemsWithCollection++
    }
  }

  // Find dominant collection
  let dominantCollection: string | null = null
  let maxCount = 0

  for (const [collection, count] of collectionCounts) {
    if (count > maxCount) {
      maxCount = count
      dominantCollection = collection
    }
  }

  const collectionPercentage = items.length > 0 ? maxCount / items.length : 0

  return {
    isBubbled: collectionPercentage >= threshold,
    dominantCollection,
    collectionPercentage,
    uniqueCollections: collectionCounts.size,
  }
}

// ============================================================================
// AI-Powered Diverse Recommendations
// ============================================================================

/**
 * Use AI to suggest thematically related but different movies/series.
 * Only called when smart exclusion fails to break out of a bubble.
 */
export async function findDiverseContent(
  centerItem: SimilarityItem,
  existingItems: SimilarityItem[],
  options: { limit?: number; type?: 'movie' | 'series' } = {}
): Promise<DiverseResult> {
  const { limit = 10, type = 'movie' } = options

  // Build exclusion list (titles to avoid)
  const excludeTitles = existingItems.map((item) => item.title).slice(0, 15)
  const excludeCollections = [
    ...new Set(existingItems.map((item) => item.collection_name).filter(Boolean)),
  ]

  logger.info(
    {
      centerTitle: centerItem.title,
      excludeCount: excludeTitles.length,
      excludeCollections,
    },
    'Finding diverse content via AI'
  )

  try {
    const client = await getOpenAIClient()

    const prompt = `Given the ${type} "${centerItem.title}" (${centerItem.year || 'unknown year'}), which has these characteristics:
- Genres: ${centerItem.genres.join(', ') || 'unknown'}
- Keywords: ${centerItem.keywords.slice(0, 5).join(', ') || 'unknown'}
${centerItem.collection_name ? `- Part of: ${centerItem.collection_name}` : ''}

Suggest ${limit} thematically similar ${type}s that would appeal to fans but are from DIFFERENT franchises/collections.
Look for movies with similar themes, tone, or appeal (e.g., space operas, hero's journey, epic adventures).

EXCLUDE these titles and their franchises:
${excludeTitles.join(', ')}
${excludeCollections.length > 0 ? `\nALSO EXCLUDE any movies from: ${excludeCollections.join(', ')}` : ''}

Return ONLY the movie titles, one per line, without numbers or explanations.
Focus on well-known, popular films that are likely to be in a home media library.`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content || ''
    const suggestedTitles = parseTitles(content)

    logger.debug({ suggestedTitles }, 'AI suggested titles')

    // Match suggestions to library
    const matches = await matchTitlesToLibrary(suggestedTitles, type)

    logger.info(
      { 
        suggestedCount: suggestedTitles.length, 
        matchedCount: matches.length,
        matchedTitles: matches.map(m => m.title),
      },
      'AI diverse content matched to library'
    )

    return {
      items: matches,
      aiSuggested: true,
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get AI diverse suggestions')
    return {
      items: [],
      aiSuggested: false,
    }
  }
}

/**
 * Parse AI response into list of titles
 */
function parseTitles(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.match(/^\d+\./)) // Remove numbered lines
    .map((line) => line.replace(/^[-•*]\s*/, '')) // Remove bullet points
    .filter((title) => title.length > 1 && title.length < 100)
}

/**
 * Match AI-suggested titles to movies in the library using fuzzy matching
 */
async function matchTitlesToLibrary(
  titles: string[],
  type: 'movie' | 'series'
): Promise<SimilarityItem[]> {
  if (titles.length === 0) return []

  const table = type === 'movie' ? 'movies' : 'series'
  const items: SimilarityItem[] = []

  for (const title of titles) {
    // Try exact match first, then fuzzy
    const result = await query<{
      id: string
      title: string
      year: number | null
      poster_url: string | null
      genres: string[]
      directors: string[]
      actors: unknown
      collection_name: string | null
      network: string | null
      keywords: string[]
      studios: unknown
    }>(
      `SELECT 
        id, title, year, poster_url, genres, directors, actors,
        ${type === 'movie' ? 'collection_name' : 'NULL as collection_name'},
        ${type === 'series' ? 'network' : 'NULL as network'},
        keywords,
        studios
       FROM ${table}
       WHERE LOWER(title) = LOWER($1)
          OR title ILIKE $2
          OR SIMILARITY(LOWER(title), LOWER($1)) > 0.5
       ORDER BY 
         CASE WHEN LOWER(title) = LOWER($1) THEN 0 ELSE 1 END,
         SIMILARITY(LOWER(title), LOWER($1)) DESC
       LIMIT 1`,
      [title, `%${title}%`]
    )

    if (result.rows.length > 0) {
      const row = result.rows[0]
      items.push({
        id: row.id,
        title: row.title,
        year: row.year,
        poster_url: row.poster_url,
        type,
        genres: row.genres || [],
        directors: row.directors || [],
        actors: parseActors(row.actors),
        collection_name: row.collection_name,
        network: row.network,
        keywords: row.keywords || [],
        studios: parseStudios(row.studios),
      })
    }
  }

  return items
}

/**
 * Create AI diverse connection reason
 */
export function createAIDiverseReason(suggestedFor: string): ConnectionReason {
  return {
    type: 'ai_diverse',
    value: `AI suggested for fans of ${suggestedFor}`,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseActors(actors: unknown): Array<{ name: string; role?: string; thumb?: string }> {
  if (!actors) return []
  if (Array.isArray(actors)) {
    return actors.map((a) => {
      if (typeof a === 'string') return { name: a }
      if (typeof a === 'object' && a !== null) {
        return {
          name: (a as Record<string, unknown>).name as string,
          role: (a as Record<string, unknown>).role as string | undefined,
          thumb: (a as Record<string, unknown>).thumb as string | undefined,
        }
      }
      return { name: String(a) }
    })
  }
  return []
}

function parseStudios(studios: unknown): Array<{ name: string }> {
  if (!studios) return []
  if (Array.isArray(studios)) {
    return studios.map((s) => {
      if (typeof s === 'string') return { name: s }
      if (typeof s === 'object' && s !== null) {
        return { name: (s as Record<string, unknown>).name as string || String(s) }
      }
      return { name: String(s) }
    })
  }
  return []
}

