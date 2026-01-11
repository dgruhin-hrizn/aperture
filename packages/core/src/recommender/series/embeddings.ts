import { createChildLogger } from '../../lib/logger.js'
import { getOpenAIClient } from '../../lib/openai.js'
import { query, queryOne } from '../../lib/db.js'
import {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
} from '../../jobs/progress.js'
import { getEmbeddingModel, getOpenAIApiKey, type EmbeddingModel } from '../../settings/systemSettings.js'
import { randomUUID } from 'crypto'

const logger = createChildLogger('embeddings-series')

interface SeriesForEmbedding {
  id: string
  title: string
  year: number | null
  endYear: number | null
  genres: string[]
  overview: string | null
  tagline: string | null
  status: string | null
  network: string | null
  directors: string[] | null // Showrunners/Creators
  actors: Array<{ name: string; role?: string }> | null
  studios: Array<{ id?: string; name: string }> | null
  contentRating: string | null
  tags: string[] | null
  productionCountries: string[] | null
  awards: string | null
  totalSeasons: number | null
  totalEpisodes: number | null
}

interface EpisodeForEmbedding {
  id: string
  seriesId: string
  seriesTitle: string
  seasonNumber: number
  episodeNumber: number
  title: string
  overview: string | null
  year: number | null
  directors: string[] | null
  writers: string[] | null
  guestStars: Array<{ name: string; role?: string }> | null
}

interface SeriesEmbeddingResult {
  seriesId: string
  embedding: number[]
  canonicalText: string
}

interface EpisodeEmbeddingResult {
  episodeId: string
  embedding: number[]
  canonicalText: string
}

/**
 * Build canonical text for embedding a TV series
 *
 * This creates a rich semantic representation that captures:
 * - Core identity (title, year range, genres)
 * - Creative DNA (showrunners, network, lead actors)
 * - Thematic content (overview, tagline, tags)
 * - Context (rating, country, awards, status)
 */
export function buildSeriesCanonicalText(series: SeriesForEmbedding): string {
  const sections: string[] = []

  // === SECTION 1: Core Identity ===
  // Title and year range establish the series' identity
  let titleLine = series.title
  if (series.year) {
    if (series.endYear && series.endYear !== series.year) {
      titleLine += ` (${series.year}-${series.endYear})`
    } else if (series.status === 'Continuing') {
      titleLine += ` (${series.year}-present)`
    } else {
      titleLine += ` (${series.year})`
    }
  }
  sections.push(titleLine)

  // Series type indicator
  if (series.status) {
    sections.push(`${series.status} TV Series`)
  } else {
    sections.push('TV Series')
  }

  // Tagline often captures the tone/theme
  if (series.tagline) {
    sections.push(`"${series.tagline}"`)
  }

  // === SECTION 2: Classification ===
  // Genres are primary classification
  if (series.genres && series.genres.length > 0) {
    sections.push(`Genres: ${series.genres.join(', ')}`)
  }

  // Content rating indicates target audience
  if (series.contentRating) {
    sections.push(`Rated ${series.contentRating}`)
  }

  // === SECTION 3: Creative DNA ===
  // Network influences style (HBO vs Netflix vs Network TV)
  if (series.network) {
    sections.push(`Network: ${series.network}`)
  }

  // Showrunners/Creators (stored as directors)
  if (series.directors && series.directors.length > 0) {
    sections.push(`Created by ${series.directors.join(', ')}`)
  }

  // Studios
  if (series.studios && series.studios.length > 0) {
    const topStudios = series.studios.slice(0, 2).map((s) => s.name)
    sections.push(`Studio: ${topStudios.join(', ')}`)
  }

  // Lead actors (top 4 for series)
  if (series.actors && series.actors.length > 0) {
    const leadActors = series.actors.slice(0, 4).map((a) => {
      if (a.role) {
        return `${a.name} as ${a.role}`
      }
      return a.name
    })
    sections.push(`Starring ${leadActors.join(', ')}`)
  }

  // === SECTION 4: Thematic Content ===
  // Overview is the primary semantic content
  if (series.overview) {
    const maxOverviewLength = 1000
    const overview =
      series.overview.length > maxOverviewLength
        ? series.overview.substring(0, maxOverviewLength) + '...'
        : series.overview
    sections.push(overview)
  }

  // Tags capture thematic elements
  if (series.tags && series.tags.length > 0) {
    sections.push(`Themes: ${series.tags.join(', ')}`)
  }

  // === SECTION 5: Context ===
  // Series scope (seasons/episodes)
  if (series.totalSeasons && series.totalEpisodes) {
    sections.push(`${series.totalSeasons} seasons, ${series.totalEpisodes} episodes`)
  } else if (series.totalSeasons) {
    sections.push(`${series.totalSeasons} seasons`)
  }

  // Production country affects style
  if (series.productionCountries && series.productionCountries.length > 0) {
    const countries = series.productionCountries.slice(0, 2)
    sections.push(`From ${countries.join(', ')}`)
  }

  // Awards signal quality
  if (series.awards) {
    const awardsText =
      series.awards.length > 150 ? series.awards.substring(0, 150) + '...' : series.awards
    sections.push(`Awards: ${awardsText}`)
  }

  return sections.join('. ')
}

/**
 * Build canonical text for embedding an episode
 *
 * This creates a focused representation that captures:
 * - Episode identity (series, season, episode number, title)
 * - Episode-specific content (overview, guest stars)
 * - Creative credits (director, writers)
 *
 * Episode embeddings complement series embeddings by capturing
 * individual storylines and guest appearances.
 */
export function buildEpisodeCanonicalText(episode: EpisodeForEmbedding): string {
  const sections: string[] = []

  // === SECTION 1: Episode Identity ===
  sections.push(`${episode.seriesTitle} - Season ${episode.seasonNumber}, Episode ${episode.episodeNumber}`)
  sections.push(`"${episode.title}"`)

  if (episode.year) {
    sections.push(`(${episode.year})`)
  }

  // === SECTION 2: Episode Content ===
  if (episode.overview) {
    // Episodes need more compact overviews since there are many
    const maxOverviewLength = 500
    const overview =
      episode.overview.length > maxOverviewLength
        ? episode.overview.substring(0, maxOverviewLength) + '...'
        : episode.overview
    sections.push(overview)
  }

  // === SECTION 3: Creative Credits ===
  if (episode.directors && episode.directors.length > 0) {
    sections.push(`Directed by ${episode.directors.join(', ')}`)
  }

  if (episode.writers && episode.writers.length > 0) {
    sections.push(`Written by ${episode.writers.join(', ')}`)
  }

  // === SECTION 4: Guest Stars ===
  if (episode.guestStars && episode.guestStars.length > 0) {
    const guests = episode.guestStars.slice(0, 5).map((g) => g.name)
    sections.push(`Guest starring ${guests.join(', ')}`)
  }

  return sections.join('. ')
}

/**
 * Generate embeddings for a batch of series
 */
export async function embedSeries(
  series: SeriesForEmbedding[],
  modelOverride?: EmbeddingModel
): Promise<SeriesEmbeddingResult[]> {
  if (series.length === 0) {
    return []
  }

  const client = await getOpenAIClient()
  const model = modelOverride || (await getEmbeddingModel())

  // Build canonical texts
  const textsWithIds = series.map((s) => ({
    seriesId: s.id,
    text: buildSeriesCanonicalText(s),
  }))

  logger.info({ count: textsWithIds.length, model }, 'Generating series embeddings')

  const batchSize = 100
  const results: SeriesEmbeddingResult[] = []

  for (let i = 0; i < textsWithIds.length; i += batchSize) {
    const batch = textsWithIds.slice(i, i + batchSize)
    const texts = batch.map((t) => t.text)

    const response = await client.embeddings.create({
      model,
      input: texts,
    })

    for (let j = 0; j < batch.length; j++) {
      results.push({
        seriesId: batch[j].seriesId,
        embedding: response.data[j].embedding,
        canonicalText: batch[j].text,
      })
    }

    logger.debug(
      { batch: Math.floor(i / batchSize) + 1, total: Math.ceil(textsWithIds.length / batchSize) },
      'Series batch completed'
    )
  }

  return results
}

/**
 * Generate embeddings for a batch of episodes
 */
export async function embedEpisodes(
  episodes: EpisodeForEmbedding[],
  modelOverride?: EmbeddingModel
): Promise<EpisodeEmbeddingResult[]> {
  if (episodes.length === 0) {
    return []
  }

  const client = await getOpenAIClient()
  const model = modelOverride || (await getEmbeddingModel())

  // Build canonical texts
  const textsWithIds = episodes.map((e) => ({
    episodeId: e.id,
    text: buildEpisodeCanonicalText(e),
  }))

  logger.info({ count: textsWithIds.length, model }, 'Generating episode embeddings')

  const batchSize = 100
  const results: EpisodeEmbeddingResult[] = []

  for (let i = 0; i < textsWithIds.length; i += batchSize) {
    const batch = textsWithIds.slice(i, i + batchSize)
    const texts = batch.map((t) => t.text)

    const response = await client.embeddings.create({
      model,
      input: texts,
    })

    for (let j = 0; j < batch.length; j++) {
      results.push({
        episodeId: batch[j].episodeId,
        embedding: response.data[j].embedding,
        canonicalText: batch[j].text,
      })
    }

    logger.debug(
      { batch: Math.floor(i / batchSize) + 1, total: Math.ceil(textsWithIds.length / batchSize) },
      'Episode batch completed'
    )
  }

  return results
}

/**
 * Store series embeddings in the database
 */
export async function storeSeriesEmbeddings(
  embeddings: SeriesEmbeddingResult[],
  modelOverride?: EmbeddingModel
): Promise<void> {
  const model = modelOverride || (await getEmbeddingModel())

  for (const emb of embeddings) {
    const vectorStr = `[${emb.embedding.join(',')}]`

    await query(
      `INSERT INTO series_embeddings (series_id, model, embedding, canonical_text)
       VALUES ($1, $2, $3::halfvec, $4)
       ON CONFLICT (series_id, model) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         canonical_text = EXCLUDED.canonical_text`,
      [emb.seriesId, model, vectorStr, emb.canonicalText]
    )
  }

  logger.info({ count: embeddings.length }, 'Series embeddings stored')
}

/**
 * Store episode embeddings in the database
 */
export async function storeEpisodeEmbeddings(
  embeddings: EpisodeEmbeddingResult[],
  modelOverride?: EmbeddingModel
): Promise<void> {
  const model = modelOverride || (await getEmbeddingModel())

  for (const emb of embeddings) {
    const vectorStr = `[${emb.embedding.join(',')}]`

    await query(
      `INSERT INTO episode_embeddings (episode_id, model, embedding, canonical_text)
       VALUES ($1, $2, $3::halfvec, $4)
       ON CONFLICT (episode_id, model) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         canonical_text = EXCLUDED.canonical_text`,
      [emb.episodeId, model, vectorStr, emb.canonicalText]
    )
  }

  logger.info({ count: embeddings.length }, 'Episode embeddings stored')
}

/**
 * Get series that don't have embeddings yet (with full metadata)
 */
export async function getSeriesWithoutEmbeddings(
  limit = 100,
  modelOverride?: EmbeddingModel
): Promise<SeriesForEmbedding[]> {
  const model = modelOverride || (await getEmbeddingModel())

  // Check if any TV library configs exist
  const configCheck = await queryOne<{ count: string }>(
    "SELECT COUNT(*) FROM library_config WHERE collection_type = 'tvshows'"
  )
  const hasTvLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0

  const result = await query<{
    id: string
    title: string
    year: number | null
    end_year: number | null
    genres: string[]
    overview: string | null
    tagline: string | null
    status: string | null
    network: string | null
    directors: string[] | null
    actors: string | null
    studios: string | null
    content_rating: string | null
    tags: string[] | null
    production_countries: string[] | null
    awards: string | null
    total_seasons: number | null
    total_episodes: number | null
  }>(
    hasTvLibraryConfigs
      ? `SELECT s.id, s.title, s.year, s.end_year, s.genres, s.overview,
                s.tagline, s.status, s.network, s.directors, s.actors::text, s.studios::text,
                s.content_rating, s.tags, s.production_countries, s.awards,
                s.total_seasons, s.total_episodes
         FROM series s
         LEFT JOIN series_embeddings e ON e.series_id = s.id AND e.model = $1
         WHERE e.id IS NULL
           AND EXISTS (
             SELECT 1 FROM library_config lc
             WHERE lc.provider_library_id = s.provider_library_id
               AND lc.is_enabled = true
           )
         LIMIT $2`
      : `SELECT s.id, s.title, s.year, s.end_year, s.genres, s.overview,
                s.tagline, s.status, s.network, s.directors, s.actors::text, s.studios::text,
                s.content_rating, s.tags, s.production_countries, s.awards,
                s.total_seasons, s.total_episodes
         FROM series s
         LEFT JOIN series_embeddings e ON e.series_id = s.id AND e.model = $1
         WHERE e.id IS NULL
         LIMIT $2`,
    [model, limit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: row.year,
    endYear: row.end_year,
    genres: row.genres,
    overview: row.overview,
    tagline: row.tagline,
    status: row.status,
    network: row.network,
    directors: row.directors,
    actors: row.actors ? JSON.parse(row.actors) : null,
    studios: row.studios ? JSON.parse(row.studios) : null,
    contentRating: row.content_rating,
    tags: row.tags,
    productionCountries: row.production_countries,
    awards: row.awards,
    totalSeasons: row.total_seasons,
    totalEpisodes: row.total_episodes,
  }))
}

/**
 * Get episodes that don't have embeddings yet
 */
export async function getEpisodesWithoutEmbeddings(
  limit = 100,
  modelOverride?: EmbeddingModel
): Promise<EpisodeForEmbedding[]> {
  const model = modelOverride || (await getEmbeddingModel())

  const result = await query<{
    id: string
    series_id: string
    series_title: string
    season_number: number
    episode_number: number
    title: string
    overview: string | null
    year: number | null
    directors: string[] | null
    writers: string[] | null
    guest_stars: string | null
  }>(
    `SELECT e.id, e.series_id, s.title as series_title,
            e.season_number, e.episode_number, e.title,
            e.overview, e.year, e.directors, e.writers, e.guest_stars::text
     FROM episodes e
     JOIN series s ON s.id = e.series_id
     LEFT JOIN episode_embeddings ee ON ee.episode_id = e.id AND ee.model = $1
     WHERE ee.id IS NULL
     LIMIT $2`,
    [model, limit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    seriesId: row.series_id,
    seriesTitle: row.series_title,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    title: row.title,
    overview: row.overview,
    year: row.year,
    directors: row.directors,
    writers: row.writers,
    guestStars: row.guest_stars ? JSON.parse(row.guest_stars) : null,
  }))
}

export interface GenerateSeriesEmbeddingsResult {
  seriesGenerated: number
  episodesGenerated: number
  failed: number
  jobId: string
}

/**
 * Generate and store embeddings for all series and episodes missing them
 */
export async function generateMissingSeriesEmbeddings(
  existingJobId?: string,
  includeEpisodes = true
): Promise<GenerateSeriesEmbeddingsResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'generate-series-embeddings', includeEpisodes ? 4 : 3)

  try {
    // Step 1: Check OpenAI configuration
    setJobStep(jobId, 0, 'Checking OpenAI configuration')

    const apiKey = await getOpenAIApiKey()
    const model = await getEmbeddingModel()

    if (!apiKey) {
      addLog(jobId, 'error', '❌ OPENAI_API_KEY is not configured!')
      completeJob(jobId, { seriesGenerated: 0, episodesGenerated: 0, failed: 0 })
      return { seriesGenerated: 0, episodesGenerated: 0, failed: 0, jobId }
    }

    addLog(jobId, 'info', `🤖 Using OpenAI model: ${model}`)

    // Step 2: Count series needing embeddings
    setJobStep(jobId, 1, 'Counting series without embeddings')

    const seriesCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM series s
       LEFT JOIN series_embeddings e ON e.series_id = s.id AND e.model = $1
       WHERE e.id IS NULL`,
      [model]
    )

    const totalSeriesNeeded = parseInt(seriesCountResult.rows[0]?.count || '0', 10)
    addLog(jobId, 'info', `📺 Found ${totalSeriesNeeded} series needing embeddings`)

    // Step 3: Generate series embeddings
    setJobStep(jobId, 2, 'Generating series embeddings', totalSeriesNeeded)

    let seriesGenerated = 0
    let totalFailed = 0
    const batchSize = 25

    if (totalSeriesNeeded > 0) {
      let batch: SeriesForEmbedding[]

      do {
        batch = await getSeriesWithoutEmbeddings(batchSize)

        if (batch.length > 0) {
          addLog(jobId, 'info', `🧠 Processing batch of ${batch.length} series...`)

          try {
            const embeddings = await embedSeries(batch)
            await storeSeriesEmbeddings(embeddings)

            seriesGenerated += embeddings.length
            updateJobProgress(
              jobId,
              seriesGenerated,
              totalSeriesNeeded,
              `Generated ${seriesGenerated}/${totalSeriesNeeded}`
            )

            addLog(
              jobId,
              'info',
              `✅ Batch complete: ${embeddings.length} series embeddings generated`
            )
          } catch (err) {
            const error = err instanceof Error ? err.message : 'Unknown error'
            addLog(jobId, 'error', `❌ Series batch failed: ${error}`)
            totalFailed += batch.length

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
    }

    // Step 4: Generate episode embeddings (if enabled)
    let episodesGenerated = 0

    if (includeEpisodes) {
      setJobStep(jobId, 3, 'Counting episodes without embeddings')

      const episodeCountResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM episodes e
         LEFT JOIN episode_embeddings ee ON ee.episode_id = e.id AND ee.model = $1
         WHERE ee.id IS NULL`,
        [model]
      )

      const totalEpisodesNeeded = parseInt(episodeCountResult.rows[0]?.count || '0', 10)
      addLog(jobId, 'info', `📺 Found ${totalEpisodesNeeded} episodes needing embeddings`)

      if (totalEpisodesNeeded > 0) {
        let batch: EpisodeForEmbedding[]
        const episodeBatchSize = 50 // Larger batches for episodes since they're simpler

        do {
          batch = await getEpisodesWithoutEmbeddings(episodeBatchSize)

          if (batch.length > 0) {
            if (episodesGenerated % 500 === 0) {
              addLog(jobId, 'info', `🧠 Processing batch of ${batch.length} episodes...`)
            }

            try {
              const embeddings = await embedEpisodes(batch)
              await storeEpisodeEmbeddings(embeddings)

              episodesGenerated += embeddings.length

              if (episodesGenerated % 500 === 0) {
                updateJobProgress(
                  jobId,
                  episodesGenerated,
                  totalEpisodesNeeded,
                  `Generated ${episodesGenerated}/${totalEpisodesNeeded} episodes`
                )
                addLog(
                  jobId,
                  'info',
                  `✅ Progress: ${episodesGenerated} episode embeddings generated`
                )
              }
            } catch (err) {
              const error = err instanceof Error ? err.message : 'Unknown error'
              addLog(jobId, 'error', `❌ Episode batch failed: ${error}`)
              totalFailed += batch.length

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
      }
    }

    const finalResult = { seriesGenerated, episodesGenerated, failed: totalFailed, jobId }
    completeJob(jobId, finalResult)

    addLog(
      jobId,
      'info',
      `🎉 Series embedding generation complete: ${seriesGenerated} series, ${episodesGenerated} episodes, ${totalFailed} failed`
    )

    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    throw err
  }
}

/**
 * Get embedding for a specific series
 */
export async function getSeriesEmbedding(seriesId: string): Promise<number[] | null> {
  const model = await getEmbeddingModel()

  const result = await queryOne<{ embedding: string }>(
    `SELECT embedding::text FROM series_embeddings WHERE series_id = $1 AND model = $2`,
    [seriesId, model]
  )

  if (!result) {
    return null
  }

  const vectorStr = result.embedding.replace(/[[\]]/g, '')
  return vectorStr.split(',').map(Number)
}

/**
 * Get embedding for a specific episode
 */
export async function getEpisodeEmbedding(episodeId: string): Promise<number[] | null> {
  const model = await getEmbeddingModel()

  const result = await queryOne<{ embedding: string }>(
    `SELECT embedding::text FROM episode_embeddings WHERE episode_id = $1 AND model = $2`,
    [episodeId, model]
  )

  if (!result) {
    return null
  }

  const vectorStr = result.embedding.replace(/[[\]]/g, '')
  return vectorStr.split(',').map(Number)
}

/**
 * Get all episode embeddings for a series (for computing series taste from episodes)
 */
export async function getSeriesEpisodeEmbeddings(
  seriesId: string
): Promise<Array<{ episodeId: string; embedding: number[] }>> {
  const model = await getEmbeddingModel()

  const result = await query<{ episode_id: string; embedding: string }>(
    `SELECT ee.episode_id, ee.embedding::text
     FROM episode_embeddings ee
     JOIN episodes e ON e.id = ee.episode_id
     WHERE e.series_id = $1 AND ee.model = $2`,
    [seriesId, model]
  )

  return result.rows.map((row) => ({
    episodeId: row.episode_id,
    embedding: row.embedding.replace(/[[\]]/g, '').split(',').map(Number),
  }))
}

