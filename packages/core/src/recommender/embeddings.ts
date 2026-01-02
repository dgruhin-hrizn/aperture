import OpenAI from 'openai'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
} from '../jobs/progress.js'
import { randomUUID } from 'crypto'

const logger = createChildLogger('embeddings')

interface Movie {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
}

interface EmbeddingResult {
  movieId: string
  embedding: number[]
  canonicalText: string
}

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/**
 * Build canonical text for embedding a movie
 */
export function buildCanonicalText(movie: Movie): string {
  const parts: string[] = []

  // Title and year
  if (movie.year) {
    parts.push(`${movie.title} (${movie.year})`)
  } else {
    parts.push(movie.title)
  }

  // Genres
  if (movie.genres && movie.genres.length > 0) {
    parts.push(`Genres: ${movie.genres.join(', ')}`)
  }

  // Overview (truncated if too long)
  if (movie.overview) {
    const maxOverviewLength = 500
    const overview =
      movie.overview.length > maxOverviewLength
        ? movie.overview.substring(0, maxOverviewLength) + '...'
        : movie.overview
    parts.push(overview)
  }

  return parts.join('. ')
}

/**
 * Generate embeddings for a batch of movies
 */
export async function embedMovies(movies: Movie[]): Promise<EmbeddingResult[]> {
  if (movies.length === 0) {
    return []
  }

  const client = getOpenAIClient()
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

  // Build canonical texts
  const textsWithIds = movies.map((movie) => ({
    movieId: movie.id,
    text: buildCanonicalText(movie),
  }))

  logger.info({ count: textsWithIds.length, model }, 'Generating embeddings')

  // OpenAI recommends batches of up to 2048 texts
  const batchSize = 100
  const results: EmbeddingResult[] = []

  for (let i = 0; i < textsWithIds.length; i += batchSize) {
    const batch = textsWithIds.slice(i, i + batchSize)
    const texts = batch.map((t) => t.text)

    const response = await client.embeddings.create({
      model,
      input: texts,
    })

    for (let j = 0; j < batch.length; j++) {
      results.push({
        movieId: batch[j].movieId,
        embedding: response.data[j].embedding,
        canonicalText: batch[j].text,
      })
    }

    logger.debug(
      { batch: Math.floor(i / batchSize) + 1, total: Math.ceil(textsWithIds.length / batchSize) },
      'Batch completed'
    )
  }

  return results
}

/**
 * Store embeddings in the database
 */
export async function storeEmbeddings(embeddings: EmbeddingResult[]): Promise<void> {
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

  for (const emb of embeddings) {
    // Convert embedding array to PostgreSQL vector format
    const vectorStr = `[${emb.embedding.join(',')}]`

    await query(
      `INSERT INTO embeddings (movie_id, model, embedding, canonical_text)
       VALUES ($1, $2, $3::vector, $4)
       ON CONFLICT (movie_id, model) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         canonical_text = EXCLUDED.canonical_text`,
      [emb.movieId, model, vectorStr, emb.canonicalText]
    )
  }

  logger.info({ count: embeddings.length }, 'Embeddings stored')
}

/**
 * Get movies that don't have embeddings yet
 */
export async function getMoviesWithoutEmbeddings(limit = 100): Promise<Movie[]> {
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

  const result = await query<Movie>(
    `SELECT m.id, m.title, m.year, m.genres, m.overview
     FROM movies m
     LEFT JOIN embeddings e ON e.movie_id = m.id AND e.model = $1
     WHERE e.id IS NULL
     LIMIT $2`,
    [model, limit]
  )

  return result.rows
}

export interface GenerateEmbeddingsResult {
  generated: number
  failed: number
  jobId: string
}

/**
 * Generate and store embeddings for all movies missing them
 */
export async function generateMissingEmbeddings(
  existingJobId?: string
): Promise<GenerateEmbeddingsResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'generate-embeddings', 3)

  try {
    // Step 1: Check OpenAI configuration
    setJobStep(jobId, 0, 'Checking OpenAI configuration')

    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

    if (!apiKey) {
      addLog(jobId, 'error', '❌ OPENAI_API_KEY is not configured!')
      addLog(jobId, 'info', '💡 Add OPENAI_API_KEY to your .env.local file to enable AI embeddings')
      completeJob(jobId, { generated: 0, failed: 0, skipped: true })
      return { generated: 0, failed: 0, jobId }
    }

    addLog(jobId, 'info', `🤖 Using OpenAI model: ${model}`)

    // Step 2: Count movies needing embeddings
    setJobStep(jobId, 1, 'Counting movies without embeddings')

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM movies m
       LEFT JOIN embeddings e ON e.movie_id = m.id AND e.model = $1
       WHERE e.id IS NULL`,
      [model]
    )

    const totalNeeded = parseInt(countResult.rows[0]?.count || '0', 10)

    if (totalNeeded === 0) {
      addLog(jobId, 'info', '✅ All movies already have embeddings!')
      completeJob(jobId, { generated: 0, failed: 0 })
      return { generated: 0, failed: 0, jobId }
    }

    addLog(jobId, 'info', `🎬 Found ${totalNeeded} movies needing embeddings`)

    // Step 3: Generate embeddings in batches
    setJobStep(jobId, 2, 'Generating embeddings', totalNeeded)

    let totalGenerated = 0
    let totalFailed = 0
    const batchSize = 25 // Smaller batches for better progress feedback
    let batch: Movie[]

    do {
      batch = await getMoviesWithoutEmbeddings(batchSize)

      if (batch.length > 0) {
        addLog(jobId, 'info', `🧠 Processing batch of ${batch.length} movies...`)

        // Log some movie titles
        const movieTitles = batch.slice(0, 3).map((m) => `${m.title} (${m.year || 'N/A'})`)
        addLog(
          jobId,
          'debug',
          `  Including: ${movieTitles.join(', ')}${batch.length > 3 ? '...' : ''}`
        )

        try {
          // Generate embeddings
          const embeddings = await embedMovies(batch)

          // Store them
          await storeEmbeddings(embeddings)

          totalGenerated += embeddings.length
          updateJobProgress(
            jobId,
            totalGenerated,
            totalNeeded,
            `Generated ${totalGenerated}/${totalNeeded}`
          )

          addLog(
            jobId,
            'info',
            `✅ Batch complete: ${embeddings.length} embeddings generated (${totalGenerated}/${totalNeeded} total)`
          )

          // Estimate cost
          const estimatedTokens = batch.reduce((sum, m) => {
            const text = buildCanonicalText(m)
            return sum + Math.ceil(text.length / 4) // Rough token estimate
          }, 0)
          addLog(jobId, 'debug', `  Estimated tokens: ~${estimatedTokens}`, { estimatedTokens })
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error'
          addLog(jobId, 'error', `❌ Batch failed: ${error}`)
          totalFailed += batch.length

          // Continue with next batch
          if (error.includes('rate_limit')) {
            addLog(jobId, 'warn', '⏳ Rate limited - waiting 60 seconds...')
            await new Promise((resolve) => setTimeout(resolve, 60000))
          } else if (error.includes('insufficient_quota')) {
            addLog(jobId, 'error', '💳 OpenAI quota exceeded - stopping job')
            break
          }
        }
      }
    } while (batch.length > 0)

    const finalResult = { generated: totalGenerated, failed: totalFailed, jobId }
    completeJob(jobId, finalResult)

    addLog(
      jobId,
      'info',
      `🎉 Embedding generation complete: ${totalGenerated} generated, ${totalFailed} failed`
    )

    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    throw err
  }
}

/**
 * Get embedding for a specific movie
 */
export async function getMovieEmbedding(movieId: string): Promise<number[] | null> {
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

  const result = await queryOne<{ embedding: string }>(
    `SELECT embedding::text FROM embeddings WHERE movie_id = $1 AND model = $2`,
    [movieId, model]
  )

  if (!result) {
    return null
  }

  // Parse PostgreSQL vector format [x,y,z,...] to number array
  const vectorStr = result.embedding.replace(/[[\]]/g, '')
  return vectorStr.split(',').map(Number)
}

/**
 * Compute average embedding from multiple embeddings (for taste profile)
 */
export function averageEmbeddings(embeddings: number[][], weights?: number[]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot average empty embeddings array')
  }

  const dimensions = embeddings[0].length
  const result = new Array(dimensions).fill(0)

  // Normalize weights if provided
  const normalizedWeights = weights
    ? weights.map((w) => w / weights.reduce((a, b) => a + b, 0))
    : embeddings.map(() => 1 / embeddings.length)

  for (let i = 0; i < embeddings.length; i++) {
    const weight = normalizedWeights[i]
    for (let d = 0; d < dimensions; d++) {
      result[d] += embeddings[i][d] * weight
    }
  }

  // Normalize the result vector
  const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let d = 0; d < dimensions; d++) {
      result[d] /= magnitude
    }
  }

  return result
}
