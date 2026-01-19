import type { FastifyPluginAsync } from 'fastify'
import { requireAuth, type SessionUser } from '../plugins/auth.js'
import {
  getSimilarMovies,
  getSimilarSeries,
  getSimilarWithDepth,
  getGraphForSource,
  semanticSearch,
  buildGraphFromSemanticSearch,
  CONNECTION_COLORS,
  getValidationCacheStats,
  type GraphSource,
} from '@aperture/core'

const similarityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/similarity/movie/:id
   * Get similar movies for a given movie
   * 
   * Query params:
   * - limit: Max connections (default: 12)
   * - depth: How many levels (1 = direct, 2 = spider out) (default: 1)
   * 
   * User preferences are automatically applied:
   * - fullFranchiseMode: Show entire franchise without limits
   * - hideWatched: Filter out already-watched content
   */
  fastify.get<{
    Params: { id: string }
    Querystring: { limit?: string; depth?: string }
  }>('/api/similarity/movie/:id', { preHandler: requireAuth, schema: { tags: ["similarity"] } }, async (request, reply) => {
    const { id } = request.params
    const currentUser = request.user as SessionUser
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 12
    const depth = request.query.depth ? parseInt(request.query.depth, 10) : 1

    try {
      // If depth > 1, return graph data for multi-level view
      if (depth > 1) {
        const graphData = await getSimilarWithDepth(id, 'movie', { limit, depth, userId: currentUser.id })
        return reply.send(graphData)
      }
      
      const result = await getSimilarMovies(id, { limit })
      return reply.send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message })
      }
      throw error
    }
  })

  /**
   * GET /api/similarity/series/:id
   * Get similar series for a given series
   * 
   * Query params:
   * - limit: Max connections (default: 12)
   * - depth: How many levels (1 = direct, 2 = spider out) (default: 1)
   * 
   * User preferences are automatically applied:
   * - fullFranchiseMode: Show entire franchise without limits
   * - hideWatched: Filter out already-watched content
   */
  fastify.get<{
    Params: { id: string }
    Querystring: { limit?: string; depth?: string }
  }>('/api/similarity/series/:id', { preHandler: requireAuth, schema: { tags: ["similarity"] } }, async (request, reply) => {
    const { id } = request.params
    const currentUser = request.user as SessionUser
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 12
    const depth = request.query.depth ? parseInt(request.query.depth, 10) : 1

    try {
      // If depth > 1, return graph data for multi-level view
      if (depth > 1) {
        const graphData = await getSimilarWithDepth(id, 'series', { limit, depth, userId: currentUser.id })
        return reply.send(graphData)
      }
      
      const result = await getSimilarSeries(id, { limit })
      return reply.send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message })
      }
      throw error
    }
  })

  /**
   * GET /api/similarity/graph/:source
   * Get graph data for a specific source (explore page)
   *
   * Sources:
   * - ai-movies: User's AI recommended movies
   * - ai-series: User's AI recommended series
   * - watching: User's currently watching series
   * - top-movies: Top picks movies
   * - top-series: Top picks series
   */
  fastify.get<{
    Params: { source: string }
    Querystring: { limit?: string; crossMedia?: string }
  }>('/api/similarity/graph/:source', { preHandler: requireAuth, schema: { tags: ["similarity"] } }, async (request, reply) => {
    const { source } = request.params
    const currentUser = request.user as SessionUser

    const validSources: GraphSource[] = [
      'ai-movies',
      'ai-series',
      'watching',
      'top-movies',
      'top-series',
    ]

    if (!validSources.includes(source as GraphSource)) {
      return reply.status(400).send({
        error: `Invalid source. Must be one of: ${validSources.join(', ')}`,
      })
    }

    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20
    const includeCrossMedia = request.query.crossMedia === 'true'

    try {
      const result = await getGraphForSource(source as GraphSource, currentUser.id, {
        limit,
        includeCrossMedia,
      })
      return reply.send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      fastify.log.error({ error, source, userId: currentUser.id }, 'Failed to get graph data')
      return reply.status(500).send({ error: message })
    }
  })

  /**
   * GET /api/similarity/search
   * Semantic search across library content
   *
   * Query params:
   * - q: Search query (required) e.g., "Psychological thrillers with twist endings"
   * - type: Filter by type - 'movie', 'series', or 'both' (default: 'both')
   * - limit: Max results (default: 20)
   * - graph: If 'true', return graph data with connections (default: 'false')
   * - hideWatched: If 'true', exclude previously watched content (default: 'false')
   */
  fastify.get<{
    Querystring: { q?: string; type?: string; limit?: string; graph?: string; hideWatched?: string }
  }>('/api/similarity/search', { preHandler: requireAuth, schema: { tags: ["similarity"] } }, async (request, reply) => {
    const { q: searchQuery, type, limit: limitStr, graph, hideWatched: hideWatchedStr } = request.query
    const currentUser = request.user as SessionUser

    if (!searchQuery || !searchQuery.trim()) {
      return reply.status(400).send({ error: 'Search query (q) is required' })
    }

    const validTypes = ['movie', 'series', 'both']
    const searchType = (type && validTypes.includes(type) ? type : 'both') as
      | 'movie'
      | 'series'
      | 'both'
    const limit = limitStr ? parseInt(limitStr, 10) : 20
    const returnGraph = graph === 'true'
    const hideWatched = hideWatchedStr === 'true'

    try {
      const searchResult = await semanticSearch(searchQuery, {
        type: searchType,
        limit,
        hideWatched,
        userId: currentUser.id,
      })

      if (returnGraph) {
        // Build graph with connections between results
        const graphData = await buildGraphFromSemanticSearch(searchResult)
        return reply.send({
          query: searchResult.query,
          resultCount: searchResult.results.length,
          graph: graphData,
        })
      }

      return reply.send(searchResult)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      fastify.log.error({ error, searchQuery, type }, 'Semantic search failed')
      return reply.status(500).send({ error: message })
    }
  })

  /**
   * GET /api/similarity/colors
   * Get the color scheme for connection types
   */
  fastify.get('/api/similarity/colors', { preHandler: requireAuth, schema: { tags: ["similarity"] } }, async (_request, reply) => {
    return reply.send(CONNECTION_COLORS)
  })

  /**
   * GET /api/similarity/validation-cache/stats
   * Get statistics about the AI validation cache
   */
  fastify.get('/api/similarity/validation-cache/stats', { preHandler: requireAuth, schema: { tags: ["similarity"] } }, async (_request, reply) => {
    const stats = await getValidationCacheStats()
    return reply.send(stats)
  })
}

export default similarityRoutes

