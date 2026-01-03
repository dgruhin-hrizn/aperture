import OpenAI from 'openai'
import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
} from '../../jobs/progress.js'
import { getEmbeddingModel, type EmbeddingModel } from '../../settings/systemSettings.js'
import { randomUUID } from 'crypto'

const logger = createChildLogger('embeddings')

interface Movie {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  // Extended metadata for richer embeddings
  tagline: string | null
  directors: string[] | null
  actors: Array<{ name: string; role?: string }> | null
  studios: string[] | null
  contentRating: string | null
  tags: string[] | null
  productionCountries: string[] | null
  awards: string | null
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
 *
 * This creates a rich semantic representation that captures:
 * - Core identity (title, year, genres)
 * - Creative DNA (directors, studios, lead actors)
 * - Thematic content (overview, tagline, tags)
 * - Context (rating, country, awards)
 *
 * The text is structured to emphasize elements that affect similarity:
 * movies with same directors/studios/actors should cluster together,
 * as should movies with similar themes and tones.
 */
export function buildCanonicalText(movie: Movie): string {
  const sections: string[] = []

  // === SECTION 1: Core Identity ===
  // Title and year establish the movie's identity
  const titleLine = movie.year ? `${movie.title} (${movie.year})` : movie.title
  sections.push(titleLine)

  // Tagline often captures the tone/theme brilliantly
  if (movie.tagline) {
    sections.push(`"${movie.tagline}"`)
  }

  // === SECTION 2: Classification ===
  // Genres are primary classification
  if (movie.genres && movie.genres.length > 0) {
    sections.push(`Genres: ${movie.genres.join(', ')}`)
  }

  // Content rating indicates target audience and content type
  if (movie.contentRating) {
    sections.push(`Rated ${movie.contentRating}`)
  }

  // === SECTION 3: Creative DNA ===
  // Directors have consistent styles (auteur theory)
  if (movie.directors && movie.directors.length > 0) {
    sections.push(`Directed by ${movie.directors.join(', ')}`)
  }

  // Studios have distinct styles (A24 vs Marvel vs Blumhouse)
  if (movie.studios && movie.studios.length > 0) {
    // Limit to top 2 studios to avoid noise
    const topStudios = movie.studios.slice(0, 2)
    sections.push(`Studio: ${topStudios.join(', ')}`)
  }

  // Lead actors (top 3) influence viewing choices significantly
  if (movie.actors && movie.actors.length > 0) {
    const leadActors = movie.actors.slice(0, 3).map((a) => a.name)
    sections.push(`Starring ${leadActors.join(', ')}`)
  }

  // === SECTION 4: Thematic Content ===
  // Overview is the primary semantic content - allow more text
  if (movie.overview) {
    // text-embedding-3-small handles 8191 tokens, so we can be generous
    const maxOverviewLength = 1000
    const overview =
      movie.overview.length > maxOverviewLength
        ? movie.overview.substring(0, maxOverviewLength) + '...'
        : movie.overview
    sections.push(overview)
  }

  // Tags capture thematic elements (e.g., "time travel", "heist", "dystopia")
  if (movie.tags && movie.tags.length > 0) {
    sections.push(`Themes: ${movie.tags.join(', ')}`)
  }

  // === SECTION 5: Context ===
  // Production country affects style, language, cultural context
  if (movie.productionCountries && movie.productionCountries.length > 0) {
    const countries = movie.productionCountries.slice(0, 2)
    sections.push(`From ${countries.join(', ')}`)
  }

  // Awards signal quality and recognition
  if (movie.awards) {
    // Truncate very long awards text
    const awardsText =
      movie.awards.length > 150 ? movie.awards.substring(0, 150) + '...' : movie.awards
    sections.push(`Awards: ${awardsText}`)
  }

  return sections.join('. ')
}

/**
 * Generate embeddings for a batch of movies
 */
export async function embedMovies(
  movies: Movie[],
  modelOverride?: EmbeddingModel
): Promise<EmbeddingResult[]> {
  if (movies.length === 0) {
    return []
  }

  const client = getOpenAIClient()
  const model = modelOverride || (await getEmbeddingModel())

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
export async function storeEmbeddings(
  embeddings: EmbeddingResult[],
  modelOverride?: EmbeddingModel
): Promise<void> {
  const model = modelOverride || (await getEmbeddingModel())

  for (const emb of embeddings) {
    // Convert embedding array to PostgreSQL vector format
    const vectorStr = `[${emb.embedding.join(',')}]`

    await query(
      `INSERT INTO embeddings (movie_id, model, embedding, canonical_text)
       VALUES ($1, $2, $3::halfvec, $4)
       ON CONFLICT (movie_id, model) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         canonical_text = EXCLUDED.canonical_text`,
      [emb.movieId, model, vectorStr, emb.canonicalText]
    )
  }

  logger.info({ count: embeddings.length }, 'Embeddings stored')
}

/**
 * Get movies that don't have embeddings yet (with full metadata)
 * Only includes movies from enabled libraries
 */
export async function getMoviesWithoutEmbeddings(
  limit = 100,
  modelOverride?: EmbeddingModel
): Promise<Movie[]> {
  const model = modelOverride || (await getEmbeddingModel())

  // Check if any library configs exist
  const configCheck = await queryOne<{ count: string }>('SELECT COUNT(*) FROM library_config')
  const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0

  const result = await query<{
    id: string
    title: string
    year: number | null
    genres: string[]
    overview: string | null
    tagline: string | null
    directors: string[] | null
    actors: string | null
    studios: string[] | null
    content_rating: string | null
    tags: string[] | null
    production_countries: string[] | null
    awards: string | null
  }>(
    hasLibraryConfigs
      ? `SELECT m.id, m.title, m.year, m.genres, m.overview,
                m.tagline, m.directors, m.actors::text, m.studios,
                m.content_rating, m.tags, m.production_countries, m.awards
         FROM movies m
         LEFT JOIN embeddings e ON e.movie_id = m.id AND e.model = $1
         WHERE e.id IS NULL
           AND EXISTS (
             SELECT 1 FROM library_config lc
             WHERE lc.provider_library_id = m.provider_library_id
               AND lc.is_enabled = true
           )
         LIMIT $2`
      : `SELECT m.id, m.title, m.year, m.genres, m.overview,
                m.tagline, m.directors, m.actors::text, m.studios,
                m.content_rating, m.tags, m.production_countries, m.awards
         FROM movies m
         LEFT JOIN embeddings e ON e.movie_id = m.id AND e.model = $1
         WHERE e.id IS NULL
         LIMIT $2`,
    [model, limit]
  )

  // Map database rows to Movie interface
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: row.year,
    genres: row.genres,
    overview: row.overview,
    tagline: row.tagline,
    directors: row.directors,
    actors: row.actors ? JSON.parse(row.actors) : null,
    studios: row.studios,
    contentRating: row.content_rating,
    tags: row.tags,
    productionCountries: row.production_countries,
    awards: row.awards,
  }))
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
    const model = await getEmbeddingModel()

    if (!apiKey) {
      addLog(jobId, 'error', '❌ OPENAI_API_KEY is not configured!')
      addLog(jobId, 'info', '💡 Add OPENAI_API_KEY to your .env.local file to enable AI embeddings')
      completeJob(jobId, { generated: 0, failed: 0, skipped: true })
      return { generated: 0, failed: 0, jobId }
    }

    addLog(jobId, 'info', `🤖 Using OpenAI model: ${model}`)

    // Step 2: Count movies needing embeddings (only from enabled libraries)
    setJobStep(jobId, 1, 'Counting movies without embeddings')

    // Check if any library configs exist
    const configCheck = await queryOne<{ count: string }>('SELECT COUNT(*) FROM library_config')
    const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0

    const countResult = await query<{ count: string }>(
      hasLibraryConfigs
        ? `SELECT COUNT(*) as count
           FROM movies m
           LEFT JOIN embeddings e ON e.movie_id = m.id AND e.model = $1
           WHERE e.id IS NULL
             AND EXISTS (
               SELECT 1 FROM library_config lc
               WHERE lc.provider_library_id = m.provider_library_id
                 AND lc.is_enabled = true
             )`
        : `SELECT COUNT(*) as count
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
  const model = await getEmbeddingModel()

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
