import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getEmbeddingModelInstance, getActiveEmbeddingModelId, getActiveEmbeddingTableName } from '../lib/ai-provider.js'
import { embed } from 'ai'
import { computeConnectionReasons, type ConnectionReason, type ConnectionType } from './reasons.js'

const logger = createChildLogger('similarity')

// ============================================================================
// Types
// ============================================================================

export interface SimilarityItem {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  type: 'movie' | 'series'
  genres: string[]
  directors: string[]
  actors: Array<{ name: string; role?: string; thumb?: string }>
  collection_name: string | null
  network: string | null
  keywords: string[]
  studios: Array<{ name: string }>
}

export interface SimilarityConnection {
  item: SimilarityItem
  similarity: number
  reasons: ConnectionReason[]
}

export interface SimilarityResult {
  center: SimilarityItem
  connections: SimilarityConnection[]
}

export interface GraphNode {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  type: 'movie' | 'series'
  isCenter: boolean
}

export interface GraphEdge {
  source: string
  target: string
  similarity: number
  reasons: ConnectionReason[]
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type GraphSource = 'ai-movies' | 'ai-series' | 'watching' | 'top-movies' | 'top-series'

export interface SimilarityOptions {
  limit?: number
  includeCrossMedia?: boolean
  depth?: number // How many levels of connections to fetch (1 = direct only, 2 = include connections of connections)
  userId?: string // If provided, user preferences are applied (hide watched, full franchise mode)
}

// User similarity preferences
export interface SimilarityPreferences {
  fullFranchiseMode: boolean // Show entire franchise without limits
  hideWatched: boolean // Filter out already-watched content
}

/**
 * Fetch user's similarity graph preferences
 */
async function getUserSimilarityPreferences(userId: string): Promise<SimilarityPreferences> {
  const prefs = await queryOne<{
    similarity_full_franchise: boolean
    similarity_hide_watched: boolean
  }>(
    `SELECT similarity_full_franchise, similarity_hide_watched 
     FROM user_preferences WHERE user_id = $1`,
    [userId]
  )

  return {
    fullFranchiseMode: prefs?.similarity_full_franchise ?? false,
    hideWatched: prefs?.similarity_hide_watched ?? true, // Default to hiding watched
  }
}

/**
 * Get set of watched movie IDs for a user
 */
async function getUserWatchedMovieIds(userId: string): Promise<Set<string>> {
  const result = await query<{ movie_id: string }>(
    `SELECT DISTINCT movie_id FROM watch_history 
     WHERE user_id = $1 AND movie_id IS NOT NULL AND play_count > 0`,
    [userId]
  )
  return new Set(result.rows.map((r) => r.movie_id))
}

/**
 * Get set of watched series IDs for a user (any episode watched)
 */
async function getUserWatchedSeriesIds(userId: string): Promise<Set<string>> {
  const result = await query<{ series_id: string }>(
    `SELECT DISTINCT e.series_id 
     FROM watch_history wh
     JOIN episodes e ON e.id = wh.episode_id
     WHERE wh.user_id = $1 AND wh.episode_id IS NOT NULL AND wh.play_count > 0`,
    [userId]
  )
  return new Set(result.rows.map((r) => r.series_id))
}

// ============================================================================
// Movie Similarity
// ============================================================================

export async function getSimilarMovies(
  movieId: string,
  options: SimilarityOptions = {}
): Promise<SimilarityResult> {
  const { limit = 12 } = options

  // Get the source movie
  const sourceMovie = await queryOne<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    collection_name: string | null
    keywords: string[]
    studios: unknown
  }>(
    `SELECT id, title, year, poster_url, genres, directors, actors, 
            collection_name, keywords, studios
     FROM movies WHERE id = $1`,
    [movieId]
  )

  if (!sourceMovie) {
    throw new Error(`Movie not found: ${movieId}`)
  }

  const center: SimilarityItem = {
    id: sourceMovie.id,
    title: sourceMovie.title,
    year: sourceMovie.year,
    poster_url: sourceMovie.poster_url,
    type: 'movie',
    genres: sourceMovie.genres || [],
    directors: sourceMovie.directors || [],
    actors: parseActors(sourceMovie.actors),
    collection_name: sourceMovie.collection_name,
    network: null,
    keywords: sourceMovie.keywords || [],
    studios: parseStudios(sourceMovie.studios),
  }

  // Get the active embedding model
  const modelId = await getActiveEmbeddingModelId()
  if (!modelId) {
    logger.warn('No embedding model configured')
    return { center, connections: [] }
  }

  // Get the embedding table name
  const tableName = await getActiveEmbeddingTableName('embeddings')

  // Get the embedding for the source movie
  const embeddingResult = await queryOne<{ embedding: string }>(
    `SELECT embedding::text FROM ${tableName} WHERE movie_id = $1 AND model = $2`,
    [movieId, modelId]
  )

  if (!embeddingResult) {
    logger.warn({ movieId, modelId }, 'No embedding found for movie')
    return { center, connections: [] }
  }

  // Find similar movies using vector similarity
  const similarMovies = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    collection_name: string | null
    keywords: string[]
    studios: unknown
    similarity: number
  }>(
    `SELECT m.id, m.title, m.year, m.poster_url, m.genres, m.directors, 
            m.actors, m.collection_name, m.keywords, m.studios,
            1 - (e.embedding <=> $1::halfvec) as similarity
     FROM ${tableName} e
     JOIN movies m ON m.id = e.movie_id
     WHERE m.id != $2 AND e.model = $3
     ORDER BY e.embedding <=> $1::halfvec
     LIMIT $4`,
    [embeddingResult.embedding, movieId, modelId, limit]
  )

  const connections: SimilarityConnection[] = similarMovies.rows.map((row) => {
    const target: SimilarityItem = {
      id: row.id,
      title: row.title,
      year: row.year,
      poster_url: row.poster_url,
      type: 'movie',
      genres: row.genres || [],
      directors: row.directors || [],
      actors: parseActors(row.actors),
      collection_name: row.collection_name,
      network: null,
      keywords: row.keywords || [],
      studios: parseStudios(row.studios),
    }

    return {
      item: target,
      similarity: row.similarity,
      reasons: computeConnectionReasons(center, target),
    }
  })

  logger.debug({ movieId, connectionCount: connections.length }, 'Found similar movies')
  return { center, connections }
}

// ============================================================================
// Series Similarity
// ============================================================================

export async function getSimilarSeries(
  seriesId: string,
  options: SimilarityOptions = {}
): Promise<SimilarityResult> {
  const { limit = 12 } = options

  // Get the source series
  const sourceSeries = await queryOne<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    network: string | null
    keywords: string[]
    studios: unknown
  }>(
    `SELECT id, title, year, poster_url, genres, directors, actors, 
            network, keywords, studios
     FROM series WHERE id = $1`,
    [seriesId]
  )

  if (!sourceSeries) {
    throw new Error(`Series not found: ${seriesId}`)
  }

  const center: SimilarityItem = {
    id: sourceSeries.id,
    title: sourceSeries.title,
    year: sourceSeries.year,
    poster_url: sourceSeries.poster_url,
    type: 'series',
    genres: sourceSeries.genres || [],
    directors: sourceSeries.directors || [],
    actors: parseActors(sourceSeries.actors),
    collection_name: null,
    network: sourceSeries.network,
    keywords: sourceSeries.keywords || [],
    studios: parseStudios(sourceSeries.studios),
  }

  // Get the active embedding model
  const modelId = await getActiveEmbeddingModelId()
  if (!modelId) {
    logger.warn('No embedding model configured')
    return { center, connections: [] }
  }

  // Get the embedding table name
  const tableName = await getActiveEmbeddingTableName('series_embeddings')

  // Get the embedding for the source series
  const embeddingResult = await queryOne<{ embedding: string }>(
    `SELECT embedding::text FROM ${tableName} WHERE series_id = $1 AND model = $2`,
    [seriesId, modelId]
  )

  if (!embeddingResult) {
    logger.warn({ seriesId, modelId }, 'No embedding found for series')
    return { center, connections: [] }
  }

  // Find similar series using vector similarity
  const similarSeries = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    network: string | null
    keywords: string[]
    studios: unknown
    similarity: number
  }>(
    `SELECT s.id, s.title, s.year, s.poster_url, s.genres, s.directors, 
            s.actors, s.network, s.keywords, s.studios,
            1 - (e.embedding <=> $1::halfvec) as similarity
     FROM ${tableName} e
     JOIN series s ON s.id = e.series_id
     WHERE s.id != $2 AND e.model = $3
     ORDER BY e.embedding <=> $1::halfvec
     LIMIT $4`,
    [embeddingResult.embedding, seriesId, modelId, limit]
  )

  const connections: SimilarityConnection[] = similarSeries.rows.map((row) => {
    const target: SimilarityItem = {
      id: row.id,
      title: row.title,
      year: row.year,
      poster_url: row.poster_url,
      type: 'series',
      genres: row.genres || [],
      directors: row.directors || [],
      actors: parseActors(row.actors),
      collection_name: null,
      network: row.network,
      keywords: row.keywords || [],
      studios: parseStudios(row.studios),
    }

    return {
      item: target,
      similarity: row.similarity,
      reasons: computeConnectionReasons(center, target),
    }
  })

  logger.debug({ seriesId, connectionCount: connections.length }, 'Found similar series')
  return { center, connections }
}

// ============================================================================
// Multi-Level Similarity Graph with Bubble Breaking
// ============================================================================

import {
  analyzeBubble,
  findDiverseContent,
  createAIDiverseReason,
  validateConnection,
  getValidationCacheStats,
} from './diverse.js'

// Constants for bubble breaking
const BUBBLE_THRESHOLD = 0.5 // 50% from same collection triggers AI escape

// Dynamic collection size limits - handles large franchises like James Bond (26) and Marvel
const COLLECTION_SIZE_CACHE = new Map<string, number>()

/**
 * Calculate dynamic limit for a collection based on its size.
 * Small collections (≤5): allow all
 * Medium collections (6-15): allow 50%, min 3
 * Large collections (>15): allow 30%, min 5, max 8
 */
function getDynamicCollectionLimit(collectionSize: number): number {
  if (collectionSize <= 5) return collectionSize // Allow all from small collections
  if (collectionSize <= 15) return Math.max(3, Math.floor(collectionSize * 0.5)) // 50% of medium
  return Math.min(8, Math.max(5, Math.floor(collectionSize * 0.3))) // 30% of large, capped at 8
}

/**
 * Get a multi-level similarity graph for a single item.
 * At depth=1, shows direct connections.
 * At depth=2+, uses smart exclusion to break out of franchise bubbles.
 * Falls back to AI suggestions when stuck in a tight bubble.
 * 
 * If userId is provided, applies user preferences:
 * - fullFranchiseMode: Show entire franchise without collection limits
 * - hideWatched: Filter out already-watched content
 */
export async function getSimilarWithDepth(
  itemId: string,
  itemType: 'movie' | 'series',
  options: SimilarityOptions = {}
): Promise<GraphData> {
  const { limit = 6, depth = 1, userId } = options

  // Fetch user preferences if userId provided
  const prefs: SimilarityPreferences = userId
    ? await getUserSimilarityPreferences(userId)
    : { fullFranchiseMode: false, hideWatched: false }

  // Get watched content IDs if hiding watched
  const watchedIds: Set<string> = prefs.hideWatched && userId
    ? itemType === 'movie'
      ? await getUserWatchedMovieIds(userId)
      : await getUserWatchedSeriesIds(userId)
    : new Set()

  logger.debug(
    { userId, fullFranchiseMode: prefs.fullFranchiseMode, hideWatched: prefs.hideWatched, watchedCount: watchedIds.size },
    'Similarity graph preferences'
  )

  // Calculate max nodes based on depth - prevents exponential explosion
  // depth=1: just center + limit = ~13 nodes
  // depth=2: ~25 nodes  
  // depth=3: ~45 nodes (max for usable visualization)
  const maxNodes = depth === 1 ? limit + 1 : depth === 2 ? 25 : 45

  const nodes: Map<string, GraphNode> = new Map()
  const edges: GraphEdge[] = []
  const seenEdges = new Set<string>()
  const processedIds = new Set<string>()

  // Track collection counts for smart exclusion (skipped in fullFranchiseMode)
  const collectionCounts = new Map<string, number>()
  // Cache collection sizes for dynamic limits
  const collectionSizes = new Map<string, number>()

  // Track all items added for bubble analysis
  const allItems: SimilarityItem[] = []

  // Track full SimilarityItem data by ID for validation
  const itemsById = new Map<string, SimilarityItem>()

  // Helper to get collection size (cached)
  const getCollectionSize = async (collectionName: string): Promise<number> => {
    if (collectionSizes.has(collectionName)) {
      return collectionSizes.get(collectionName)!
    }
    // Check global cache first
    if (COLLECTION_SIZE_CACHE.has(collectionName)) {
      const size = COLLECTION_SIZE_CACHE.get(collectionName)!
      collectionSizes.set(collectionName, size)
      return size
    }
    // Query database for collection size
    const table = itemType === 'movie' ? 'movies' : 'series'
    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${table} WHERE collection_name = $1`,
      [collectionName]
    )
    const size = parseInt(result?.count || '1', 10)
    collectionSizes.set(collectionName, size)
    COLLECTION_SIZE_CACHE.set(collectionName, size) // Cache globally
    return size
  }

  // Helper to check if we can add from a collection (dynamic limits)
  // In fullFranchiseMode, no limits are applied
  const canAddFromCollection = async (collectionName: string | null): Promise<boolean> => {
    if (prefs.fullFranchiseMode) return true // Full franchise mode bypasses limits
    if (!collectionName) return true
    const count = collectionCounts.get(collectionName) || 0
    const collectionSize = await getCollectionSize(collectionName)
    const maxAllowed = getDynamicCollectionLimit(collectionSize)
    return count < maxAllowed
  }

  // Helper to check if item is watched (for filtering)
  const isWatched = (itemId: string): boolean => {
    return watchedIds.has(itemId)
  }

  // Helper to increment collection count
  const trackCollection = (collectionName: string | null) => {
    if (collectionName) {
      collectionCounts.set(
        collectionName,
        (collectionCounts.get(collectionName) || 0) + 1
      )
    }
  }

  // Helper to add a node (respects hideWatched preference)
  const addNode = (item: SimilarityItem, isCenter = false) => {
    // Never filter out the center node, but filter others if hideWatched is enabled
    if (!isCenter && prefs.hideWatched && isWatched(item.id)) {
      return false // Don't add watched items
    }
    if (!nodes.has(item.id)) {
      nodes.set(item.id, {
        id: item.id,
        title: item.title,
        year: item.year,
        poster_url: item.poster_url,
        type: item.type,
        isCenter,
      })
      allItems.push(item)
      itemsById.set(item.id, item) // Track full item data for validation
      return true
    }
    return false
  }

  // Helper to add an edge
  const addEdge = (sourceId: string, conn: SimilarityConnection) => {
    const edgeKey = [sourceId, conn.item.id].sort().join('-')
    if (!seenEdges.has(edgeKey)) {
      seenEdges.add(edgeKey)
      edges.push({
        source: sourceId,
        target: conn.item.id,
        similarity: conn.similarity,
        reasons: conn.reasons,
      })
      return true
    }
    return false
  }

  // Helper to add an AI-diverse edge
  const addAIDiverseEdge = (sourceId: string, item: SimilarityItem, centerTitle: string) => {
    const edgeKey = [sourceId, item.id].sort().join('-')
    if (!seenEdges.has(edgeKey)) {
      seenEdges.add(edgeKey)
      edges.push({
        source: sourceId,
        target: item.id,
        similarity: 0.5, // Default similarity for AI suggestions
        reasons: [createAIDiverseReason(centerTitle)],
      })
      return true
    }
    return false
  }

  // Get the center item's similarity data
  const centerResult =
    itemType === 'movie'
      ? await getSimilarMovies(itemId, { limit })
      : await getSimilarSeries(itemId, { limit })

  // Add center node
  addNode(centerResult.center, true)
  trackCollection(centerResult.center.collection_name)
  processedIds.add(centerResult.center.id)

  // Track items at each level for deeper exploration
  let currentLevelIds: Array<{ id: string; type: 'movie' | 'series' }> = []

  // Add first level connections (no exclusion yet - show actual similar items)
  for (const conn of centerResult.connections) {
    const added = addNode(conn.item)
    if (added) {
      trackCollection(conn.item.collection_name)
      addEdge(centerResult.center.id, conn)
      currentLevelIds.push({ id: conn.item.id, type: conn.item.type })
    }
  }

  // Process additional levels based on depth WITH smart exclusion
  for (let currentDepth = 2; currentDepth <= depth; currentDepth++) {
    // Stop if we've hit the max nodes cap
    if (nodes.size >= maxNodes) {
      logger.info({ currentDepth, nodeCount: nodes.size, maxNodes }, 'Stopping expansion - max nodes reached')
      break
    }

    const nextLevelIds: Array<{ id: string; type: 'movie' | 'series' }> = []
    // Reduce connections per node as we go deeper
    const levelLimit = Math.max(2, Math.floor(limit / currentDepth))
    let addedAtThisLevel = 0

    for (const { id, type } of currentLevelIds) {
      // Stop if we've hit the max nodes cap
      if (nodes.size >= maxNodes) break
      
      if (processedIds.has(id)) continue
      processedIds.add(id)

      try {
        // Request more items so we can filter
        const result =
          type === 'movie'
            ? await getSimilarMovies(id, { limit: levelLimit * 3 })
            : await getSimilarSeries(id, { limit: levelLimit * 3 })

        let addedForThisNode = 0
        for (const conn of result.connections) {
          // Stop if we've hit the max nodes cap
          if (nodes.size >= maxNodes) break
          if (addedForThisNode >= levelLimit) break

          // Skip the original center node
          if (conn.item.id === itemId) continue

          // Skip if already in graph
          if (nodes.has(conn.item.id)) continue

          // SMART EXCLUSION: Skip if collection is over-represented (dynamic limits based on franchise size)
          if (!(await canAddFromCollection(conn.item.collection_name))) {
            logger.debug(
              { title: conn.item.title, collection: conn.item.collection_name },
              'Skipping - collection over-represented'
            )
            continue
          }

          // CONNECTION VALIDATION: Title patterns, genre gate, collection chains
          // Find the full source item for validation
          const sourceItem = itemsById.get(id)
          if (sourceItem) {
            const validation = await validateConnection(sourceItem, conn.item, { useAI: true })
            if (!validation.isValid) {
              logger.debug(
                { 
                  source: sourceItem.title, 
                  target: conn.item.title, 
                  reason: validation.reason,
                  cached: validation.fromCache
                },
                'Connection rejected by validation'
              )
              continue
            }
          }

          const added = addNode(conn.item)
          if (added) {
            trackCollection(conn.item.collection_name)
            if (addEdge(id, conn)) {
              addedForThisNode++
              addedAtThisLevel++
              if (!processedIds.has(conn.item.id)) {
                nextLevelIds.push({ id: conn.item.id, type: conn.item.type })
              }
            }
          }
        }
      } catch (error) {
        // Skip items without embeddings
        logger.debug({ id, type, error }, 'Skipping item without embedding')
      }
    }

    // BUBBLE DETECTION: Check if we're still stuck
    const bubbleAnalysis = analyzeBubble(allItems, BUBBLE_THRESHOLD)

    if (bubbleAnalysis.isBubbled && addedAtThisLevel < 2) {
      logger.info(
        {
          depth: currentDepth,
          dominantCollection: bubbleAnalysis.dominantCollection,
          percentage: Math.round(bubbleAnalysis.collectionPercentage * 100),
          addedAtLevel: addedAtThisLevel,
        },
        'Bubble detected - triggering AI escape'
      )

      // AI ESCAPE: Get diverse recommendations
      try {
        const diverseResult = await findDiverseContent(
          centerResult.center,
          allItems,
          { limit: Math.max(4, limit - addedAtThisLevel), type: itemType }
        )

        for (const item of diverseResult.items) {
          if (nodes.has(item.id)) continue

          const added = addNode(item)
          if (added) {
            trackCollection(item.collection_name)

            // Connect to center with AI diverse edge
            addAIDiverseEdge(centerResult.center.id, item, centerResult.center.title)
            nextLevelIds.push({ id: item.id, type: item.type })
          }
        }

        logger.info(
          { addedFromAI: diverseResult.items.length },
          'Added diverse content from AI'
        )
      } catch (error) {
        logger.error({ error }, 'AI escape failed')
      }
    }

    currentLevelIds = nextLevelIds
  }

  logger.debug(
    {
      itemId,
      itemType,
      depth,
      nodeCount: nodes.size,
      edgeCount: edges.length,
      collectionDistribution: Object.fromEntries(collectionCounts),
    },
    'Built multi-level similarity graph with bubble breaking'
  )

  return {
    nodes: Array.from(nodes.values()),
    edges,
  }
}

// ============================================================================
// Graph Data for Explore Page
// ============================================================================

export async function getGraphForSource(
  source: GraphSource,
  userId: string,
  options: SimilarityOptions = {}
): Promise<GraphData> {
  const { limit = 20, includeCrossMedia = false } = options
  const connectionsPerNode = 3 // How many connections to show per center node

  let centerItems: SimilarityItem[] = []

  switch (source) {
    case 'ai-movies':
      centerItems = await getUserAIMovies(userId, limit)
      break
    case 'ai-series':
      centerItems = await getUserAISeries(userId, limit)
      break
    case 'watching':
      centerItems = await getUserWatchingSeries(userId, limit)
      break
    case 'top-movies':
      centerItems = await getTopPicksMovies(limit)
      break
    case 'top-series':
      centerItems = await getTopPicksSeries(limit)
      break
    default:
      throw new Error(`Unknown graph source: ${source}`)
  }

  if (centerItems.length === 0) {
    return { nodes: [], edges: [] }
  }

  // Build graph with center nodes and their connections
  const nodes: Map<string, GraphNode> = new Map()
  const edges: GraphEdge[] = []
  const seenEdges = new Set<string>()

  // Add center nodes
  for (const item of centerItems) {
    nodes.set(item.id, {
      id: item.id,
      title: item.title,
      year: item.year,
      poster_url: item.poster_url,
      type: item.type,
      isCenter: true,
    })
  }

  // Get connections for each center node
  for (const centerItem of centerItems) {
    let result: SimilarityResult

    if (centerItem.type === 'movie') {
      result = await getSimilarMovies(centerItem.id, { limit: connectionsPerNode * 2 })
    } else {
      result = await getSimilarSeries(centerItem.id, { limit: connectionsPerNode * 2 })
    }

    // Add connections (limit per node, prioritize connections to other center nodes)
    const sortedConnections = result.connections.sort((a, b) => {
      // Prioritize connections to other center nodes
      const aIsCenter = nodes.has(a.item.id) && nodes.get(a.item.id)!.isCenter
      const bIsCenter = nodes.has(b.item.id) && nodes.get(b.item.id)!.isCenter
      if (aIsCenter && !bIsCenter) return -1
      if (!aIsCenter && bIsCenter) return 1
      return b.similarity - a.similarity
    })

    let addedConnections = 0
    for (const conn of sortedConnections) {
      if (addedConnections >= connectionsPerNode) break

      // Skip cross-media if not enabled
      if (!includeCrossMedia && conn.item.type !== centerItem.type) continue

      // Create edge key to avoid duplicates
      const edgeKey = [centerItem.id, conn.item.id].sort().join('-')
      if (seenEdges.has(edgeKey)) continue
      seenEdges.add(edgeKey)

      // Add target node if not exists
      if (!nodes.has(conn.item.id)) {
        nodes.set(conn.item.id, {
          id: conn.item.id,
          title: conn.item.title,
          year: conn.item.year,
          poster_url: conn.item.poster_url,
          type: conn.item.type,
          isCenter: false,
        })
      }

      // Add edge
      edges.push({
        source: centerItem.id,
        target: conn.item.id,
        similarity: conn.similarity,
        reasons: conn.reasons,
      })

      addedConnections++
    }
  }

  logger.debug(
    { source, userId, nodeCount: nodes.size, edgeCount: edges.length },
    'Built graph for source'
  )

  return {
    nodes: Array.from(nodes.values()),
    edges,
  }
}

// ============================================================================
// Semantic Search
// ============================================================================

export interface SemanticSearchOptions {
  type?: 'movie' | 'series' | 'both'
  limit?: number
}

export interface SemanticSearchResult {
  query: string
  results: Array<{
    item: SimilarityItem
    similarity: number
  }>
}

/**
 * Semantic search across library content using natural language queries.
 * 
 * This function embeds the search query using OpenAI and searches the
 * pre-computed content embeddings to find semantically similar items.
 * 
 * Example queries:
 * - "Psychological thrillers with twist endings"
 * - "Family-friendly animated movies"
 * - "Dark sci-fi series about AI"
 * 
 * Cost: ~$0.000003 per search (one embedding generation)
 */
export async function semanticSearch(
  searchQuery: string,
  options: SemanticSearchOptions = {}
): Promise<SemanticSearchResult> {
  const { type = 'both', limit = 20 } = options

  if (!searchQuery.trim()) {
    return { query: searchQuery, results: [] }
  }

  logger.info({ searchQuery, type, limit }, 'Performing semantic search')

  // Get the active embedding model
  const modelId = await getActiveEmbeddingModelId()
  if (!modelId) {
    logger.warn('No embedding model configured for semantic search')
    return { query: searchQuery, results: [] }
  }

  // Generate embedding for the search query
  const model = await getEmbeddingModelInstance()

  const { embedding: queryEmbedding } = await embed({
    model,
    value: searchQuery,
  })

  const embeddingVector = `[${queryEmbedding.join(',')}]`

  const results: Array<{ item: SimilarityItem; similarity: number }> = []

  // Search movies
  if (type === 'movie' || type === 'both') {
    const movieLimit = type === 'both' ? Math.ceil(limit / 2) : limit
    const movieTableName = await getActiveEmbeddingTableName('embeddings')
    
    const movieResults = await query<{
      id: string
      title: string
      year: number | null
      poster_url: string | null
      genres: string[]
      directors: string[]
      actors: unknown
      collection_name: string | null
      keywords: string[]
      studios: unknown
      similarity: number
    }>(
      `SELECT m.id, m.title, m.year, m.poster_url, m.genres, m.directors, 
              m.actors, m.collection_name, m.keywords, m.studios,
              1 - (e.embedding <=> $1::halfvec) as similarity
       FROM ${movieTableName} e
       JOIN movies m ON m.id = e.movie_id
       WHERE e.model = $2
       ORDER BY e.embedding <=> $1::halfvec
       LIMIT $3`,
      [embeddingVector, modelId, movieLimit]
    )

    for (const row of movieResults.rows) {
      results.push({
        item: {
          id: row.id,
          title: row.title,
          year: row.year,
          poster_url: row.poster_url,
          type: 'movie',
          genres: row.genres || [],
          directors: row.directors || [],
          actors: parseActors(row.actors),
          collection_name: row.collection_name,
          network: null,
          keywords: row.keywords || [],
          studios: parseStudios(row.studios),
        },
        similarity: row.similarity,
      })
    }
  }

  // Search series
  if (type === 'series' || type === 'both') {
    const seriesLimit = type === 'both' ? Math.floor(limit / 2) : limit
    const seriesTableName = await getActiveEmbeddingTableName('series_embeddings')
    
    const seriesResults = await query<{
      id: string
      title: string
      year: number | null
      poster_url: string | null
      genres: string[]
      directors: string[]
      actors: unknown
      network: string | null
      keywords: string[]
      studios: unknown
      similarity: number
    }>(
      `SELECT s.id, s.title, s.year, s.poster_url, s.genres, s.directors, 
              s.actors, s.network, s.keywords, s.studios,
              1 - (e.embedding <=> $1::halfvec) as similarity
       FROM ${seriesTableName} e
       JOIN series s ON s.id = e.series_id
       WHERE e.model = $2
       ORDER BY e.embedding <=> $1::halfvec
       LIMIT $3`,
      [embeddingVector, modelId, seriesLimit]
    )

    for (const row of seriesResults.rows) {
      results.push({
        item: {
          id: row.id,
          title: row.title,
          year: row.year,
          poster_url: row.poster_url,
          type: 'series',
          genres: row.genres || [],
          directors: row.directors || [],
          actors: parseActors(row.actors),
          collection_name: null,
          network: row.network,
          keywords: row.keywords || [],
          studios: parseStudios(row.studios),
        },
        similarity: row.similarity,
      })
    }
  }

  // Sort combined results by similarity
  results.sort((a, b) => b.similarity - a.similarity)

  // If searching both types, limit total to requested limit
  const finalResults = results.slice(0, limit)

  logger.info(
    { searchQuery, resultCount: finalResults.length, types: type },
    'Semantic search completed'
  )

  return { query: searchQuery, results: finalResults }
}

/**
 * Build graph data from semantic search results.
 * Uses AI to find structured connections with proper types matching our legend.
 */
export async function buildGraphFromSemanticSearch(
  searchResults: SemanticSearchResult,
  options: { useAI?: boolean } = {}
): Promise<GraphData> {
  const { useAI = true } = options

  if (searchResults.results.length === 0) {
    return { nodes: [], edges: [] }
  }

  const nodes: Map<string, GraphNode> = new Map()
  const edges: GraphEdge[] = []
  const seenEdges = new Set<string>()
  const connectedNodes = new Set<string>()

  // Add all search results as nodes
  const items = searchResults.results.map(r => r.item)
  for (const item of items) {
    nodes.set(item.id, {
      id: item.id,
      title: item.title,
      year: item.year,
      poster_url: item.poster_url,
      type: item.type,
      isCenter: true,
    })
  }

  // Helper to add edge without duplicates
  const addEdge = (sourceId: string, targetId: string, similarity: number, reasons: ConnectionReason[]) => {
    const edgeKey = [sourceId, targetId].sort().join('-')
    if (!seenEdges.has(edgeKey) && sourceId !== targetId) {
      seenEdges.add(edgeKey)
      edges.push({ source: sourceId, target: targetId, similarity, reasons })
      connectedNodes.add(sourceId)
      connectedNodes.add(targetId)
    }
  }

  // Use AI to find structured connections
  let aiSucceeded = false
  if (useAI && items.length >= 2) {
    try {
      const aiConnections = await findAIConnections(searchResults.query, items)

      // Add AI-discovered connections with proper types
      for (const conn of aiConnections) {
        const sourceItem = items[conn.from]
        const targetItem = items[conn.to]
        
        if (sourceItem && targetItem) {
          addEdge(sourceItem.id, targetItem.id, 0.85, [{
            type: conn.type,
            value: conn.reason,
          }])
        }
      }

      aiSucceeded = aiConnections.length > 0
      logger.info(
        { query: searchResults.query, aiConnections: aiConnections.length, edges: edges.length },
        'Built graph with AI-structured connections'
      )
    } catch (error) {
      logger.warn({ error }, 'AI connection finding failed')
    }
  }

  // If AI failed or returned no connections, use embedding similarity for all items
  if (!aiSucceeded && items.length >= 2) {
    logger.info({ query: searchResults.query }, 'Using embedding similarity fallback')
    
    // Connect items based on embedding similarity
    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const item = items[i]
      try {
        const similarResult = item.type === 'movie'
          ? await getSimilarMovies(item.id, { limit: 20 })
          : await getSimilarSeries(item.id, { limit: 20 })
        
        // Find connections to other search results
        for (const conn of similarResult.connections) {
          if (nodes.has(conn.item.id) && conn.item.id !== item.id && conn.similarity >= 0.55) {
            addEdge(item.id, conn.item.id, conn.similarity, [{ type: 'similarity' }])
          }
        }
      } catch {
        // Skip if no embedding
      }
    }
  }

  // Find any unconnected nodes and connect them via embedding similarity
  const unconnectedNodes = items.filter(item => !connectedNodes.has(item.id))
  
  if (unconnectedNodes.length > 0) {
    logger.debug({ unconnectedCount: unconnectedNodes.length }, 'Connecting orphan nodes via embeddings')
    
    for (const item of unconnectedNodes) {
      // Find the most similar connected node
      let bestMatch: { id: string; similarity: number } | null = null
      
      try {
        const similarResult = item.type === 'movie' 
          ? await getSimilarMovies(item.id, { limit: 30 })
          : await getSimilarSeries(item.id, { limit: 30 })
        
        // Find the best match among our search results (prefer already-connected nodes)
        for (const conn of similarResult.connections) {
          if (nodes.has(conn.item.id) && conn.item.id !== item.id) {
            if (!bestMatch || conn.similarity > bestMatch.similarity) {
              bestMatch = { id: conn.item.id, similarity: conn.similarity }
            }
          }
        }
        
        if (bestMatch) {
          addEdge(item.id, bestMatch.id, bestMatch.similarity, [{ type: 'similarity' }])
        }
      } catch {
        // If embedding lookup fails, connect to first available node
        const firstConnectedNode = items.find(i => i.id !== item.id && connectedNodes.has(i.id))
        if (firstConnectedNode) {
          addEdge(item.id, firstConnectedNode.id, 0.6, [{ type: 'similarity' }])
        }
      }
    }
  }

  // If still no edges (unlikely), create a simple chain
  if (edges.length === 0 && items.length >= 2) {
    logger.warn('No connections found, creating fallback chain')
    for (let i = 0; i < items.length - 1; i++) {
      addEdge(items[i].id, items[i + 1].id, 0.7, [{ type: 'similarity' }])
    }
  }

  logger.info(
    { query: searchResults.query, nodeCount: nodes.size, edgeCount: edges.length },
    'Built semantic search graph'
  )

  return {
    nodes: Array.from(nodes.values()),
    edges,
  }
}

/**
 * AI-generated connection between two items
 */
interface AIConnection {
  from: number  // Index of source item
  to: number    // Index of target item
  type: ConnectionType
  reason: string  // Brief explanation
}

/**
 * Use AI to find connections between search results.
 * Returns structured JSON with connection types matching our legend.
 */
async function findAIConnections(
  searchQuery: string,
  items: SimilarityItem[]
): Promise<AIConnection[]> {
  const { getChatModelInstance } = await import('../lib/ai-provider.js')
  const { generateText } = await import('ai')
  
  let model
  try {
    model = await getChatModelInstance()
  } catch (error) {
    logger.warn({ error }, 'No chat model available for AI connections')
    return []
  }
  
  // Limit items to avoid token limits
  const limitedItems = items.slice(0, 15)
  
  // Build compact numbered item list
  const itemList = limitedItems.map((i, idx) => 
    `${idx}. ${i.title} (${i.year || '?'})`
  ).join('\n')
  
  const connectionCount = Math.min(limitedItems.length * 2, 25)
  
  const prompt = `Find ${connectionCount} connections between these "${searchQuery}" results:

${itemList}

Types: director, actor, genre, keyword, studio, similarity

Return JSON array only:
[{"from":0,"to":1,"type":"genre","reason":"romantic comedies"}]`

  try {
    const { text } = await generateText({
      model,
      prompt,
      maxOutputTokens: 1500,
      temperature: 0.4,
    })

    if (!text || text.trim().length === 0) {
      logger.warn({ searchQuery }, 'AI returned empty response for connections')
      return []
    }

    // Parse JSON response
    // Extract JSON from response (handle markdown code blocks, extra text)
    let jsonStr = text.trim()
    
    // Remove markdown code blocks
    if (jsonStr.includes('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) {
        jsonStr = match[1].trim()
      }
    }
    
    // Try to find JSON array in response
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      jsonStr = arrayMatch[0]
    }
    
    const connections = JSON.parse(jsonStr) as AIConnection[]
    
    // Validate and filter connections
    const validTypes: ConnectionType[] = ['director', 'actor', 'genre', 'keyword', 'studio', 'similarity']
    const validConnections = connections.filter(conn => {
      return (
        typeof conn.from === 'number' &&
        typeof conn.to === 'number' &&
        conn.from >= 0 && conn.from < limitedItems.length &&
        conn.to >= 0 && conn.to < limitedItems.length &&
        conn.from !== conn.to &&
        validTypes.includes(conn.type as ConnectionType)
      )
    })

    logger.info(
      { searchQuery, totalConnections: validConnections.length, itemCount: limitedItems.length },
      'AI found connections'
    )
    
    return validConnections.map(conn => ({
      ...conn,
      // Map back to original items array indices if we limited
      from: conn.from,
      to: conn.to,
    }))
  } catch (error) {
    logger.error({ error, searchQuery }, 'Failed to get AI connections')
    return []
  }
}

/**
 * Add edges based on embedding similarity between search results.
 * Lower threshold to ensure connectivity between items that matched the same search.
 */
async function addEmbeddingSimilarityEdges(
  searchResults: SemanticSearchResult,
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  seenEdges: Set<string> = new Set()
): Promise<void> {
  // Lower threshold since items matched the same semantic search
  const minSimilarity = 0.60

  for (const result of searchResults.results) {
    const sourceItem = result.item

    let similarResult: SimilarityResult
    try {
      if (sourceItem.type === 'movie') {
        similarResult = await getSimilarMovies(sourceItem.id, { limit: 30 })
      } else {
        similarResult = await getSimilarSeries(sourceItem.id, { limit: 30 })
      }
    } catch {
      continue
    }

    for (const conn of similarResult.connections) {
      if (!nodes.has(conn.item.id)) continue
      if (conn.item.id === sourceItem.id) continue

      const edgeKey = [sourceItem.id, conn.item.id].sort().join('-')
      if (seenEdges.has(edgeKey)) continue
      seenEdges.add(edgeKey)

      if (conn.similarity >= minSimilarity) {
        edges.push({
          source: sourceItem.id,
          target: conn.item.id,
          similarity: conn.similarity,
          reasons: [{ type: 'similarity' }],
        })
      }
    }
  }
}

// ============================================================================
// Data Source Helpers
// ============================================================================

async function getUserAIMovies(userId: string, limit: number): Promise<SimilarityItem[]> {
  const result = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    collection_name: string | null
    keywords: string[]
    studios: unknown
  }>(
    `SELECT m.id, m.title, m.year, m.poster_url, m.genres, m.directors, 
            m.actors, m.collection_name, m.keywords, m.studios
     FROM recommendation_candidates rc
     JOIN recommendation_runs rr ON rc.run_id = rr.id
     JOIN movies m ON rc.movie_id = m.id
     WHERE rr.user_id = $1 
       AND rr.media_type = 'movie'
       AND rr.status = 'completed'
       AND rc.is_selected = true
       AND rc.movie_id IS NOT NULL
     ORDER BY rr.created_at DESC, rc.rank
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: row.year,
    poster_url: row.poster_url,
    type: 'movie' as const,
    genres: row.genres || [],
    directors: row.directors || [],
    actors: parseActors(row.actors),
    collection_name: row.collection_name,
    network: null,
    keywords: row.keywords || [],
    studios: parseStudios(row.studios),
  }))
}

async function getUserAISeries(userId: string, limit: number): Promise<SimilarityItem[]> {
  const result = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    network: string | null
    keywords: string[]
    studios: unknown
  }>(
    `SELECT s.id, s.title, s.year, s.poster_url, s.genres, s.directors, 
            s.actors, s.network, s.keywords, s.studios
     FROM recommendation_candidates rc
     JOIN recommendation_runs rr ON rc.run_id = rr.id
     JOIN series s ON rc.series_id = s.id
     WHERE rr.user_id = $1 
       AND rr.media_type = 'series'
       AND rr.status = 'completed'
       AND rc.is_selected = true
       AND rc.series_id IS NOT NULL
     ORDER BY rr.created_at DESC, rc.rank
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: row.year,
    poster_url: row.poster_url,
    type: 'series' as const,
    genres: row.genres || [],
    directors: row.directors || [],
    actors: parseActors(row.actors),
    collection_name: null,
    network: row.network,
    keywords: row.keywords || [],
    studios: parseStudios(row.studios),
  }))
}

async function getUserWatchingSeries(userId: string, limit: number): Promise<SimilarityItem[]> {
  const result = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    network: string | null
    keywords: string[]
    studios: unknown
  }>(
    `SELECT s.id, s.title, s.year, s.poster_url, s.genres, s.directors, 
            s.actors, s.network, s.keywords, s.studios
     FROM user_watching_series uws
     JOIN series s ON uws.series_id = s.id
     WHERE uws.user_id = $1
     ORDER BY uws.added_at DESC
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: row.year,
    poster_url: row.poster_url,
    type: 'series' as const,
    genres: row.genres || [],
    directors: row.directors || [],
    actors: parseActors(row.actors),
    collection_name: null,
    network: row.network,
    keywords: row.keywords || [],
    studios: parseStudios(row.studios),
  }))
}

async function getTopPicksMovies(limit: number): Promise<SimilarityItem[]> {
  // Get top picks config to see what list/method is being used
  const result = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    collection_name: string | null
    keywords: string[]
    studios: unknown
  }>(
    `SELECT m.id, m.title, m.year, m.poster_url, m.genres, m.directors, 
            m.actors, m.collection_name, m.keywords, m.studios
     FROM movies m
     WHERE m.community_rating IS NOT NULL
     ORDER BY m.community_rating DESC, m.year DESC NULLS LAST
     LIMIT $1`,
    [limit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: row.year,
    poster_url: row.poster_url,
    type: 'movie' as const,
    genres: row.genres || [],
    directors: row.directors || [],
    actors: parseActors(row.actors),
    collection_name: row.collection_name,
    network: null,
    keywords: row.keywords || [],
    studios: parseStudios(row.studios),
  }))
}

async function getTopPicksSeries(limit: number): Promise<SimilarityItem[]> {
  const result = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    directors: string[]
    actors: unknown
    network: string | null
    keywords: string[]
    studios: unknown
  }>(
    `SELECT s.id, s.title, s.year, s.poster_url, s.genres, s.directors, 
            s.actors, s.network, s.keywords, s.studios
     FROM series s
     WHERE s.community_rating IS NOT NULL
     ORDER BY s.community_rating DESC, s.year DESC NULLS LAST
     LIMIT $1`,
    [limit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: row.year,
    poster_url: row.poster_url,
    type: 'series' as const,
    genres: row.genres || [],
    directors: row.directors || [],
    actors: parseActors(row.actors),
    collection_name: null,
    network: row.network,
    keywords: row.keywords || [],
    studios: parseStudios(row.studios),
  }))
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

// Re-export types and reasons
export {
  computeConnectionReasons,
  getPrimaryConnectionType,
  CONNECTION_COLORS,
  type ConnectionReason,
  type ConnectionType,
} from './reasons.js'

// Re-export diverse functions
export {
  analyzeBubble,
  findDiverseContent,
  createAIDiverseReason,
  validateConnection,
  getValidationCacheStats,
  type BubbleAnalysis,
  type DiverseResult,
  type ConnectionValidation,
} from './diverse.js'

