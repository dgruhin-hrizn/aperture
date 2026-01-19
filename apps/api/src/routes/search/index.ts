import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../../lib/db.js'
import { requireAuth } from '../../plugins/auth.js'
import { embed } from 'ai'
import { getEmbeddingModel, getOpenAIApiKey, getActiveEmbeddingTableName } from '@aperture/core'
import { createOpenAI } from '@ai-sdk/openai'
import { searchSchemas, searchSchema, searchSuggestionsSchema, searchFiltersSchema } from './schemas.js'

interface SearchResult {
  id: string
  type: 'movie' | 'series'
  title: string
  original_title: string | null
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
  rt_critic_score: number | null
  collection_name: string | null
  network: string | null
  // Search scoring
  text_rank: number
  fuzzy_similarity: number
  semantic_similarity: number | null
  combined_score: number
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
  filters: {
    genre?: string
    year?: { min?: number; max?: number }
    minRtScore?: number
    collection?: string
    network?: string
    type?: 'movie' | 'series' | 'all'
  }
}

async function getQueryEmbedding(queryText: string): Promise<number[] | null> {
  try {
    const model = await getEmbeddingModel()
    const apiKey = await getOpenAIApiKey()
    
    if (!apiKey) {
      // OpenAI not configured, skip semantic search
      return null
    }
    
    const openai = createOpenAI({ apiKey })

    const { embedding } = await embed({
      model: openai.embedding(model),
      value: queryText,
    })

    return embedding
  } catch {
    return null
  }
}

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(searchSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * GET /api/search
   * Unified search combining full-text, fuzzy, and semantic search
   */
  fastify.get<{
    Querystring: {
      q: string
      type?: 'movie' | 'series' | 'all'
      genre?: string
      yearMin?: string
      yearMax?: string
      minRtScore?: string
      collection?: string
      network?: string
      limit?: string
      semantic?: string // 'true' to enable semantic search
    }
    Reply: SearchResponse
  }>('/api/search', { preHandler: requireAuth, schema: searchSchema }, async (request, reply) => {
    const {
      q: searchQuery,
      type = 'all',
      genre,
      yearMin,
      yearMax,
      minRtScore,
      collection,
      network,
      limit: limitStr,
      semantic: semanticStr,
    } = request.query

    if (!searchQuery || searchQuery.trim().length < 2) {
      return reply.send({
        results: [],
        total: 0,
        query: searchQuery || '',
        filters: { type: type as 'movie' | 'series' | 'all' },
      })
    }

    const limit = Math.min(parseInt(limitStr || '50', 10), 100)
    const useSemantic = semanticStr === 'true'
    const queryLower = searchQuery.toLowerCase().trim()

    // Build filter conditions
    const movieFilters: string[] = []
    const seriesFilters: string[] = []
    const movieParams: unknown[] = []
    const seriesParams: unknown[] = []

    // tsquery for full-text search - convert query to tsquery format
    const tsqueryStr = queryLower
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => `${w}:*`)
      .join(' & ')

    // Genre filter
    if (genre) {
      movieFilters.push(`$${movieParams.length + 1} = ANY(genres)`)
      movieParams.push(genre)
      seriesFilters.push(`$${seriesParams.length + 1} = ANY(genres)`)
      seriesParams.push(genre)
    }

    // Year filter
    if (yearMin) {
      movieFilters.push(`year >= $${movieParams.length + 1}`)
      movieParams.push(parseInt(yearMin, 10))
      seriesFilters.push(`year >= $${seriesParams.length + 1}`)
      seriesParams.push(parseInt(yearMin, 10))
    }
    if (yearMax) {
      movieFilters.push(`year <= $${movieParams.length + 1}`)
      movieParams.push(parseInt(yearMax, 10))
      seriesFilters.push(`year <= $${seriesParams.length + 1}`)
      seriesParams.push(parseInt(yearMax, 10))
    }

    // RT score filter
    if (minRtScore) {
      const rtScore = parseInt(minRtScore, 10)
      if (rtScore > 0) {
        movieFilters.push(`rt_critic_score >= $${movieParams.length + 1}`)
        movieParams.push(rtScore)
        seriesFilters.push(`rt_critic_score >= $${seriesParams.length + 1}`)
        seriesParams.push(rtScore)
      }
    }

    // Collection filter (movies only)
    if (collection) {
      movieFilters.push(`collection_name = $${movieParams.length + 1}`)
      movieParams.push(collection)
    }

    // Network filter (series only)
    if (network) {
      seriesFilters.push(`network = $${seriesParams.length + 1}`)
      seriesParams.push(network)
    }

    const movieWhereClause = movieFilters.length > 0 ? ' AND ' + movieFilters.join(' AND ') : ''
    const seriesWhereClause = seriesFilters.length > 0 ? ' AND ' + seriesFilters.join(' AND ') : ''

    // Get semantic embedding for query if enabled
    let queryEmbedding: number[] | null = null
    let movieEmbeddingTable = 'embeddings_1536' // default fallback
    let seriesEmbeddingTable = 'series_embeddings_1536' // default fallback
    if (useSemantic) {
      queryEmbedding = await getQueryEmbedding(searchQuery)
      // Get the correct embedding table names based on configured model
      try {
        movieEmbeddingTable = await getActiveEmbeddingTableName('embeddings')
        seriesEmbeddingTable = await getActiveEmbeddingTableName('series_embeddings')
      } catch {
        // Fall back to defaults if no embedding model configured
      }
    }

    const allResults: SearchResult[] = []

    // Search movies - gracefully handle missing search_vector or enrichment data
    if (type === 'all' || type === 'movie') {
      const movieQuery = queryEmbedding
        ? `
          WITH text_search AS (
            SELECT id, title, original_title, year, genres, overview, poster_url,
                   community_rating, rt_critic_score, collection_name,
                   COALESCE(ts_rank(search_vector, to_tsquery('english', $1)), 0) as text_rank,
                   similarity(title, $2) as fuzzy_sim
            FROM movies
            WHERE (title % $2 OR original_title % $2 OR (search_vector IS NOT NULL AND search_vector @@ to_tsquery('english', $1)))
            ${movieWhereClause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 2}`)}
          ),
          semantic_search AS (
            SELECT e.movie_id as id,
                   1 - (e.embedding <=> $${movieParams.length + 3}::halfvec) as semantic_sim
            FROM ${movieEmbeddingTable} e
            WHERE e.movie_id IN (SELECT id FROM text_search)
          )
          SELECT t.*, COALESCE(s.semantic_sim, 0) as semantic_similarity
          FROM text_search t
          LEFT JOIN semantic_search s ON t.id = s.id
          ORDER BY (t.text_rank * 0.3 + t.fuzzy_sim * 0.3 + COALESCE(s.semantic_sim, 0) * 0.4) DESC
          LIMIT $${movieParams.length + 4}
        `
        : `
          SELECT id, title, original_title, year, genres, overview, poster_url,
                 community_rating, rt_critic_score, collection_name,
                 COALESCE(ts_rank(search_vector, to_tsquery('english', $1)), 0) as text_rank,
                 similarity(title, $2) as fuzzy_sim,
                 0 as semantic_similarity
          FROM movies
          WHERE (title % $2 OR original_title % $2 OR (search_vector IS NOT NULL AND search_vector @@ to_tsquery('english', $1)))
          ${movieWhereClause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 2}`)}
          ORDER BY (COALESCE(ts_rank(search_vector, to_tsquery('english', $1)), 0) * 0.4 + similarity(title, $2) * 0.6) DESC
          LIMIT $${movieParams.length + 3}
        `

      const movieQueryParams = queryEmbedding
        ? [tsqueryStr, queryLower, ...movieParams, `[${queryEmbedding.join(',')}]`, limit]
        : [tsqueryStr, queryLower, ...movieParams, limit]

      const movieResults = await query<{
        id: string
        title: string
        original_title: string | null
        year: number | null
        genres: string[]
        overview: string | null
        poster_url: string | null
        community_rating: number | null
        rt_critic_score: number | null
        collection_name: string | null
        text_rank: number
        fuzzy_sim: number
        semantic_similarity: number
      }>(movieQuery, movieQueryParams)

      for (const row of movieResults.rows) {
        const textScore = row.text_rank || 0
        const fuzzyScore = row.fuzzy_sim || 0
        const semanticScore = row.semantic_similarity || 0
        const combinedScore = queryEmbedding
          ? textScore * 0.3 + fuzzyScore * 0.3 + semanticScore * 0.4
          : textScore * 0.4 + fuzzyScore * 0.6

        allResults.push({
          id: row.id,
          type: 'movie',
          title: row.title,
          original_title: row.original_title,
          year: row.year,
          genres: row.genres || [],
          overview: row.overview,
          poster_url: row.poster_url,
          community_rating: row.community_rating,
          rt_critic_score: row.rt_critic_score,
          collection_name: row.collection_name,
          network: null,
          text_rank: textScore,
          fuzzy_similarity: fuzzyScore,
          semantic_similarity: semanticScore > 0 ? semanticScore : null,
          combined_score: combinedScore,
        })
      }
    }

    // Search series - gracefully handle missing search_vector or enrichment data
    if (type === 'all' || type === 'series') {
      const seriesQuery = queryEmbedding
        ? `
          WITH text_search AS (
            SELECT id, title, original_title, year, genres, overview, poster_url,
                   community_rating, rt_critic_score, network,
                   COALESCE(ts_rank(search_vector, to_tsquery('english', $1)), 0) as text_rank,
                   similarity(title, $2) as fuzzy_sim
            FROM series
            WHERE (title % $2 OR original_title % $2 OR (search_vector IS NOT NULL AND search_vector @@ to_tsquery('english', $1)))
            ${seriesWhereClause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 2}`)}
          ),
          semantic_search AS (
            SELECT e.series_id as id,
                   1 - (e.embedding <=> $${seriesParams.length + 3}::halfvec) as semantic_sim
            FROM ${seriesEmbeddingTable} e
            WHERE e.series_id IN (SELECT id FROM text_search)
          )
          SELECT t.*, COALESCE(s.semantic_sim, 0) as semantic_similarity
          FROM text_search t
          LEFT JOIN semantic_search s ON t.id = s.id
          ORDER BY (t.text_rank * 0.3 + t.fuzzy_sim * 0.3 + COALESCE(s.semantic_sim, 0) * 0.4) DESC
          LIMIT $${seriesParams.length + 4}
        `
        : `
          SELECT id, title, original_title, year, genres, overview, poster_url,
                 community_rating, rt_critic_score, network,
                 COALESCE(ts_rank(search_vector, to_tsquery('english', $1)), 0) as text_rank,
                 similarity(title, $2) as fuzzy_sim,
                 0 as semantic_similarity
          FROM series
          WHERE (title % $2 OR original_title % $2 OR (search_vector IS NOT NULL AND search_vector @@ to_tsquery('english', $1)))
          ${seriesWhereClause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 2}`)}
          ORDER BY (COALESCE(ts_rank(search_vector, to_tsquery('english', $1)), 0) * 0.4 + similarity(title, $2) * 0.6) DESC
          LIMIT $${seriesParams.length + 3}
        `

      const seriesQueryParams = queryEmbedding
        ? [tsqueryStr, queryLower, ...seriesParams, `[${queryEmbedding.join(',')}]`, limit]
        : [tsqueryStr, queryLower, ...seriesParams, limit]

      const seriesResults = await query<{
        id: string
        title: string
        original_title: string | null
        year: number | null
        genres: string[]
        overview: string | null
        poster_url: string | null
        community_rating: number | null
        rt_critic_score: number | null
        network: string | null
        text_rank: number
        fuzzy_sim: number
        semantic_similarity: number
      }>(seriesQuery, seriesQueryParams)

      for (const row of seriesResults.rows) {
        const textScore = row.text_rank || 0
        const fuzzyScore = row.fuzzy_sim || 0
        const semanticScore = row.semantic_similarity || 0
        const combinedScore = queryEmbedding
          ? textScore * 0.3 + fuzzyScore * 0.3 + semanticScore * 0.4
          : textScore * 0.4 + fuzzyScore * 0.6

        allResults.push({
          id: row.id,
          type: 'series',
          title: row.title,
          original_title: row.original_title,
          year: row.year,
          genres: row.genres || [],
          overview: row.overview,
          poster_url: row.poster_url,
          community_rating: row.community_rating,
          rt_critic_score: row.rt_critic_score,
          collection_name: null,
          network: row.network,
          text_rank: textScore,
          fuzzy_similarity: fuzzyScore,
          semantic_similarity: semanticScore > 0 ? semanticScore : null,
          combined_score: combinedScore,
        })
      }
    }

    // Sort combined results by score
    allResults.sort((a, b) => b.combined_score - a.combined_score)

    // Limit results
    const finalResults = allResults.slice(0, limit)

    return reply.send({
      results: finalResults,
      total: finalResults.length,
      query: searchQuery,
      filters: {
        type: type as 'movie' | 'series' | 'all',
        genre,
        year: yearMin || yearMax ? { min: yearMin ? parseInt(yearMin, 10) : undefined, max: yearMax ? parseInt(yearMax, 10) : undefined } : undefined,
        minRtScore: minRtScore ? parseInt(minRtScore, 10) : undefined,
        collection,
        network,
      },
    })
  })

  /**
   * GET /api/search/suggestions
   * Get search suggestions for autocomplete
   */
  fastify.get<{
    Querystring: {
      q: string
      limit?: string
    }
  }>('/api/search/suggestions', { preHandler: requireAuth, schema: searchSuggestionsSchema }, async (request, reply) => {
    const { q: searchQuery, limit: limitStr } = request.query

    if (!searchQuery || searchQuery.trim().length < 2) {
      return reply.send({ suggestions: [] })
    }

    const limit = Math.min(parseInt(limitStr || '10', 10), 20)
    const queryLower = searchQuery.toLowerCase().trim()

    // Get matching titles using trigram similarity
    const results = await query<{
      title: string
      type: 'movie' | 'series'
      year: number | null
      similarity: number
    }>(
      `(
        SELECT title, 'movie' as type, year, similarity(title, $1) as similarity
        FROM movies
        WHERE title % $1
        ORDER BY similarity DESC
        LIMIT $2
      )
      UNION ALL
      (
        SELECT title, 'series' as type, year, similarity(title, $1) as similarity
        FROM series
        WHERE title % $1
        ORDER BY similarity DESC
        LIMIT $2
      )
      ORDER BY similarity DESC
      LIMIT $2`,
      [queryLower, limit]
    )

    return reply.send({
      suggestions: results.rows.map((r) => ({
        title: r.title,
        type: r.type,
        year: r.year,
        label: r.year ? `${r.title} (${r.year})` : r.title,
      })),
    })
  })

  /**
   * GET /api/search/filters
   * Get available filter options
   */
  fastify.get('/api/search/filters', { preHandler: requireAuth, schema: searchFiltersSchema }, async (_request, reply) => {
    // Get unique genres from both movies and series
    const genreResults = await query<{ genre: string; count: string }>(
      `SELECT genre, SUM(count)::text as count FROM (
        SELECT unnest(genres) as genre, COUNT(*) as count FROM movies GROUP BY 1
        UNION ALL
        SELECT unnest(genres) as genre, COUNT(*) as count FROM series GROUP BY 1
      ) combined
      GROUP BY genre
      ORDER BY SUM(count) DESC`
    )

    // Get collections
    const collectionResults = await query<{ name: string; count: string }>(
      `SELECT collection_name as name, COUNT(*) as count
       FROM movies WHERE collection_name IS NOT NULL
       GROUP BY collection_name
       ORDER BY COUNT(*) DESC`
    )

    // Get networks
    const networkResults = await query<{ network: string; count: string }>(
      `SELECT network, COUNT(*) as count
       FROM series WHERE network IS NOT NULL
       GROUP BY network
       ORDER BY COUNT(*) DESC
       LIMIT 50`
    )

    // Get year range
    const yearRange = await queryOne<{ min_year: number; max_year: number }>(
      `SELECT 
         MIN(LEAST(COALESCE(m.min_year, s.min_year), COALESCE(s.min_year, m.min_year))) as min_year,
         MAX(GREATEST(COALESCE(m.max_year, s.max_year), COALESCE(s.max_year, m.max_year))) as max_year
       FROM 
         (SELECT MIN(year) as min_year, MAX(year) as max_year FROM movies WHERE year IS NOT NULL) m,
         (SELECT MIN(year) as min_year, MAX(year) as max_year FROM series WHERE year IS NOT NULL) s`
    )

    return reply.send({
      genres: genreResults.rows.map((r) => ({ name: r.genre, count: parseInt(r.count, 10) })),
      collections: collectionResults.rows.map((r) => ({ name: r.name, count: parseInt(r.count, 10) })),
      networks: networkResults.rows.map((r) => ({ name: r.network, count: parseInt(r.count, 10) })),
      yearRange: yearRange
        ? { min: yearRange.min_year, max: yearRange.max_year }
        : { min: 1900, max: new Date().getFullYear() },
    })
  })
}

export default searchRoutes
