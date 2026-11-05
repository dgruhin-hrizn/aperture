import type { FastifyPluginAsync } from 'fastify'
import {
  getActiveEmbeddingModelId,
  getActiveEmbeddingTableName,
  getEmbeddingModelInstance,
  literalTitlePattern,
  MIN_TITLE_RELEVANCE,
  titleRelevance,
} from '@aperture/core'
import { queryViewerCatalog as query, withViewerCatalog } from '@aperture/core/encore'
import { embed } from 'ai'
import { requireAuth } from '../../plugins/auth.js'
import { searchSchemas, searchSchema, searchSuggestionsSchema, searchFiltersSchema } from './schemas.js'

type MediaType = 'movie' | 'series'
interface SearchInput {
  q: string
  type?: MediaType | 'all'
  genre?: string
  yearMin?: string
  yearMax?: string
  minRtScore?: string
  collection?: string
  network?: string
  limit?: string
  semantic?: string
}

interface SearchRow {
  id: string
  title: string
  original_title: string | null
  year: number | null
  genres: string[] | null
  overview: string | null
  poster_url: string | null
  community_rating: number | null
  rt_critic_score: number | null
  collection_name: string | null
  network: string | null
  text_rank: number
  fuzzy_similarity: number
  semantic_similarity: number | null
  combined_score: number
}

interface SearchEmbedding {
  modelId: string
  vector: string
  movieTable: string
  seriesTable: string
}

async function getQueryEmbedding(value: string): Promise<SearchEmbedding | null> {
  try {
    const [model, modelId, movieTable, seriesTable] = await Promise.all([
      getEmbeddingModelInstance(),
      getActiveEmbeddingModelId(),
      getActiveEmbeddingTableName('embeddings'),
      getActiveEmbeddingTableName('series_embeddings'),
    ])
    if (!modelId) return null
    const { embedding } = await embed({
      model, value, maxRetries: 0, abortSignal: AbortSignal.timeout(8000),
    })
    if (!embedding.length || !embedding.every(Number.isFinite)) return null
    return { modelId, vector: `[${embedding.join(',')}]`, movieTable, seriesTable }
  } catch {
    return null
  }
}

function boundedLimit(value: string | undefined, fallback: number, max: number) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback
}

async function searchMedia(type: MediaType, input: SearchInput, semantic: SearchEmbedding | null) {
  const movie = type === 'movie'
  const table = movie ? 'movies' : 'series'
  const title = input.q.trim()
  const params: unknown[] = [title, literalTitlePattern(title), boundedLimit(input.limit, 50, 100)]
  const add = (value: unknown) => `$${params.push(value)}`
  const filters: string[] = []
  if (input.genre) filters.push(`${add(input.genre)} = ANY(genres)`)
  if (input.yearMin) filters.push(`year >= ${add(Number(input.yearMin))}`)
  if (input.yearMax) filters.push(`year <= ${add(Number(input.yearMax))}`)
  if (Number(input.minRtScore) > 0) filters.push(`rt_critic_score >= ${add(Number(input.minRtScore))}`)
  if (movie && input.collection) filters.push(`collection_name = ${add(input.collection)}`)
  if (!movie && input.network) filters.push(`network = ${add(input.network)}`)
  const conditions = filters.length ? filters.join(' AND ') : 'TRUE'
  let semanticCandidates = 'SELECT NULL::uuid AS id, NULL::float8 AS semantic_similarity WHERE FALSE'
  if (semantic) {
    const vector = add(semantic.vector)
    semanticCandidates = `SELECT m.id, 1 - (e.embedding <=> ${vector}::halfvec) AS semantic_similarity
       FROM ${movie ? semantic.movieTable : semantic.seriesTable} e
       JOIN ${table} m ON m.id = e.${type}_id
       WHERE e.model = ${add(semantic.modelId)} AND ${conditions}
       ORDER BY e.embedding <=> ${vector}::halfvec
       LIMIT $3`
  }

  const result = await query<SearchRow>(
    `WITH text_query AS (
       SELECT websearch_to_tsquery('english', $1) AS terms
     ), lexical AS (
       SELECT id, relevance,
              COALESCE(ts_rank(search_vector, terms), 0) AS text_rank,
              GREATEST(similarity(title, $1), COALESCE(similarity(original_title, $1), 0)) AS fuzzy_similarity
       FROM ${table} CROSS JOIN text_query CROSS JOIN LATERAL (SELECT ${titleRelevance} AS relevance) match
       WHERE (${conditions}) AND (relevance >= ${MIN_TITLE_RELEVANCE} OR search_vector @@ terms)
       ORDER BY relevance DESC, text_rank DESC, fuzzy_similarity DESC, id
       LIMIT $3
     ), vectors AS (${semanticCandidates}), candidates AS (
       SELECT COALESCE(l.id, v.id) AS id,
              COALESCE(l.relevance, 0) AS relevance,
              COALESCE(l.text_rank, 0) AS text_rank,
              COALESCE(l.fuzzy_similarity, 0) AS fuzzy_similarity,
              v.semantic_similarity
       FROM lexical l FULL JOIN vectors v ON v.id = l.id
     )
     SELECT m.id, m.title, m.original_title, m.year, m.genres, m.overview, m.poster_url,
            m.community_rating, m.rt_critic_score,
            ${movie ? 'm.collection_name, NULL::text AS network' : 'NULL::text AS collection_name, m.network'},
            c.text_rank, c.fuzzy_similarity, c.semantic_similarity,
            c.relevance + c.text_rank * 0.35 + c.fuzzy_similarity * 0.25
              + GREATEST(COALESCE(c.semantic_similarity, 0), 0) * 0.4 AS combined_score
     FROM candidates c JOIN ${table} m ON m.id = c.id
     ORDER BY combined_score DESC, m.id
     LIMIT $3`,
    params
  )
  return result.rows.map((row) => ({ ...row, type, genres: row.genres ?? [] }))
}

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  for (const [name, schema] of Object.entries(searchSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  fastify.get<{ Querystring: SearchInput }>('/api/search', {
    preHandler: requireAuth, schema: searchSchema,
  }, async (request) => {
    const { q, type = 'all', genre, yearMin, yearMax, minRtScore, collection, network } = request.query
    if (q.trim().length < 2) return { results: [], total: 0, query: q, filters: { type } }
    const results = await withViewerCatalog(request.user!.id, async () => {
      const semantic = request.query.semantic === 'true' ? await getQueryEmbedding(q.trim()) : null
      const types: MediaType[] = type === 'all' ? ['movie', 'series'] : [type]
      const search = (embedding: SearchEmbedding | null) =>
        Promise.all(types.map((media) => searchMedia(media, request.query, embedding)))
      let rows
      try {
        rows = await search(semantic)
      } catch (err) {
        if (!semantic) throw err
        request.log.warn({ err }, 'Semantic search failed, using title and text matches')
        rows = await search(null)
      }
      return rows.flat()
        .sort((a, b) => b.combined_score - a.combined_score || a.id.localeCompare(b.id))
        .slice(0, boundedLimit(request.query.limit, 50, 100))
    })
    return {
      results, total: results.length, query: q,
      filters: {
        type, genre, minRtScore: minRtScore ? Number(minRtScore) : undefined, collection, network,
        year: yearMin || yearMax ? { min: yearMin ? Number(yearMin) : undefined, max: yearMax ? Number(yearMax) : undefined } : undefined,
      },
    }
  })

  fastify.get<{ Querystring: { q: string; limit?: string } }>('/api/search/suggestions', {
    preHandler: requireAuth, schema: searchSuggestionsSchema,
  }, async (request) => {
    const { q, limit } = request.query
    const title = q.trim()
    if (title.length < 2) return { suggestions: [] }

    const results = await withViewerCatalog(request.user!.id, () => query<{
      title: string; type: MediaType; year: number | null
    }>(
      `SELECT title, type, year FROM (
         SELECT title, 'movie' AS type, year, ${titleRelevance} AS relevance FROM movies
         UNION ALL
         SELECT title, 'series' AS type, year, ${titleRelevance} AS relevance FROM series
       ) matches
       WHERE relevance >= ${MIN_TITLE_RELEVANCE}
       ORDER BY relevance DESC, title, year, type
       LIMIT $3`,
      [title, literalTitlePattern(title), boundedLimit(limit, 10, 20)]
    ))
    return { suggestions: results.rows.map((r) => ({
      ...r, label: r.year ? `${r.title} (${r.year})` : r.title,
    })) }
  })

  fastify.get('/api/search/filters', {
    preHandler: requireAuth, schema: searchFiltersSchema,
  }, async (request) => withViewerCatalog(request.user!.id, async () => {
    const [genres, collections, networks, years] = await Promise.all([
      query<{ name: string; count: number }>(
        `SELECT genre AS name, COUNT(*)::int AS count FROM (
           SELECT unnest(genres) AS genre FROM movies
           UNION ALL
           SELECT unnest(genres) AS genre FROM series
         ) combined GROUP BY genre ORDER BY count DESC, name`
      ),
      query<{ name: string; count: number }>(
        `SELECT collection_name AS name, COUNT(*)::int AS count FROM movies
         WHERE collection_name IS NOT NULL GROUP BY collection_name ORDER BY count DESC, name`
      ),
      query<{ name: string; count: number }>(
        `SELECT network AS name, COUNT(*)::int AS count FROM series
         WHERE network IS NOT NULL GROUP BY network ORDER BY count DESC, name LIMIT 50`
      ),
      query<{ min: number | null; max: number | null }>(
        `SELECT MIN(year) AS min, MAX(year) AS max FROM (
           SELECT year FROM movies UNION ALL SELECT year FROM series
         ) combined`
      ),
    ])
    return {
      genres: genres.rows, collections: collections.rows, networks: networks.rows,
      yearRange: { min: years.rows[0]?.min ?? 1900, max: years.rows[0]?.max ?? new Date().getFullYear() },
    }
  }))
}

export default searchRoutes
