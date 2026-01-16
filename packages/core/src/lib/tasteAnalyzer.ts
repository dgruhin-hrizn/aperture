/**
 * Embedding-Powered Taste Analyzer
 * 
 * Analyzes user watch history using embeddings to extract abstract taste patterns.
 * Output is designed for AI consumption without specific movie/show titles.
 */

import { query } from './db.js'
import { createChildLogger } from './logger.js'
import { getActiveEmbeddingTableName, getActiveEmbeddingModelId } from './ai-provider.js'
import { getUserExcludedLibraries } from './libraryExclusions.js'

const logger = createChildLogger('taste-analyzer')

export interface GenreDistribution {
  genre: string
  percentage: number
  count: number
}

export interface DecadeDistribution {
  decade: string
  percentage: number
  count: number
}

export interface ViewingPatterns {
  totalWatched: number
  avgPlayCount: number
  rewatchRate: number // % of movies watched more than once
  favoriteRate: number // % marked as favorite
  completionRate?: number // for series: % of started shows finished
}

export interface TasteDiversity {
  score: number // 0-1, how spread out their taste is
  description: string // "focused", "balanced", "eclectic"
}

export interface ThemeAffinity {
  theme: string
  strength: number // 0-1
}

export interface AbstractTasteProfile {
  genres: GenreDistribution[]
  decades: DecadeDistribution[]
  viewingPatterns: ViewingPatterns
  diversity: TasteDiversity
  themes: ThemeAffinity[]
  emotionalPreferences: string[]
  storytellingStyles: string[]
}

/**
 * Analyze a user's movie taste using embeddings
 */
export async function analyzeMovieTaste(userId: string): Promise<AbstractTasteProfile> {
  logger.info({ userId }, 'Analyzing movie taste with embeddings')
  
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  
  // Get genre distribution
  const genres = await getGenreDistribution(userId, 'movie', excludedLibraryIds)
  
  // Get decade distribution
  const decades = await getDecadeDistribution(userId, 'movie', excludedLibraryIds)
  
  // Get viewing patterns
  const viewingPatterns = await getMovieViewingPatterns(userId, excludedLibraryIds)
  
  // Calculate taste diversity from embeddings
  const diversity = await calculateTasteDiversity(userId, 'movie', excludedLibraryIds)
  
  // Infer themes from genre combinations
  const themes = inferThemesFromGenres(genres)
  
  // Infer emotional preferences
  const emotionalPreferences = inferEmotionalPreferences(genres, viewingPatterns)
  
  // Infer storytelling styles
  const storytellingStyles = inferStorytellingStyles(genres, decades)
  
  return {
    genres,
    decades,
    viewingPatterns,
    diversity,
    themes,
    emotionalPreferences,
    storytellingStyles,
  }
}

/**
 * Analyze a user's series taste using embeddings
 */
export async function analyzeSeriesTaste(userId: string): Promise<AbstractTasteProfile> {
  logger.info({ userId }, 'Analyzing series taste with embeddings')
  
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  
  // Get genre distribution
  const genres = await getGenreDistribution(userId, 'series', excludedLibraryIds)
  
  // Get decade distribution  
  const decades = await getDecadeDistribution(userId, 'series', excludedLibraryIds)
  
  // Get viewing patterns
  const viewingPatterns = await getSeriesViewingPatterns(userId, excludedLibraryIds)
  
  // Calculate taste diversity
  const diversity = await calculateTasteDiversity(userId, 'series', excludedLibraryIds)
  
  // Infer themes from genre combinations
  const themes = inferThemesFromGenres(genres)
  
  // Infer emotional preferences
  const emotionalPreferences = inferEmotionalPreferences(genres, viewingPatterns)
  
  // Infer storytelling styles
  const storytellingStyles = inferStorytellingStyles(genres, decades)
  
  return {
    genres,
    decades,
    viewingPatterns,
    diversity,
    themes,
    emotionalPreferences,
    storytellingStyles,
  }
}

async function getGenreDistribution(
  userId: string, 
  mediaType: 'movie' | 'series',
  excludedLibraryIds: string[]
): Promise<GenreDistribution[]> {
  let result: { rows: { genre: string; count: string }[] }
  
  if (mediaType === 'movie') {
    result = await query<{ genre: string; count: string }>(`
      SELECT unnest(m.genres) as genre, COUNT(*) as count
      FROM watch_history wh
      JOIN movies m ON m.id = wh.movie_id
      WHERE wh.user_id = $1 AND wh.media_type = 'movie'
        AND (CARDINALITY($2::text[]) = 0 OR m.provider_library_id::text != ALL($2::text[]))
      GROUP BY unnest(m.genres)
      ORDER BY count DESC
    `, [userId, excludedLibraryIds])
  } else {
    result = await query<{ genre: string; count: string }>(`
      SELECT unnest(s.genres) as genre, COUNT(DISTINCT e.series_id) as count
      FROM watch_history wh
      JOIN episodes e ON e.id = wh.episode_id
      JOIN series s ON s.id = e.series_id
      WHERE wh.user_id = $1 AND wh.media_type = 'episode'
        AND (CARDINALITY($2::text[]) = 0 OR s.provider_library_id::text != ALL($2::text[]))
      GROUP BY unnest(s.genres)
      ORDER BY count DESC
    `, [userId, excludedLibraryIds])
  }
  
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0)
  
  return result.rows.slice(0, 10).map(r => ({
    genre: r.genre,
    count: parseInt(r.count, 10),
    percentage: Math.round((parseInt(r.count, 10) / total) * 100),
  }))
}

async function getDecadeDistribution(
  userId: string,
  mediaType: 'movie' | 'series',
  excludedLibraryIds: string[]
): Promise<DecadeDistribution[]> {
  let result: { rows: { decade: string; count: string }[] }
  
  if (mediaType === 'movie') {
    result = await query<{ decade: string; count: string }>(`
      SELECT (FLOOR(m.year / 10) * 10)::TEXT || 's' as decade, COUNT(*) as count
      FROM watch_history wh
      JOIN movies m ON m.id = wh.movie_id
      WHERE wh.user_id = $1 AND wh.media_type = 'movie' AND m.year IS NOT NULL
        AND (CARDINALITY($2::text[]) = 0 OR m.provider_library_id::text != ALL($2::text[]))
      GROUP BY FLOOR(m.year / 10)
      ORDER BY count DESC
    `, [userId, excludedLibraryIds])
  } else {
    result = await query<{ decade: string; count: string }>(`
      SELECT (FLOOR(s.year / 10) * 10)::TEXT || 's' as decade, COUNT(DISTINCT e.series_id) as count
      FROM watch_history wh
      JOIN episodes e ON e.id = wh.episode_id
      JOIN series s ON s.id = e.series_id
      WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s.year IS NOT NULL
        AND (CARDINALITY($2::text[]) = 0 OR s.provider_library_id::text != ALL($2::text[]))
      GROUP BY FLOOR(s.year / 10)
      ORDER BY count DESC
    `, [userId, excludedLibraryIds])
  }
  
  const total = result.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0)
  
  return result.rows.slice(0, 5).map(r => ({
    decade: r.decade,
    count: parseInt(r.count, 10),
    percentage: Math.round((parseInt(r.count, 10) / total) * 100),
  }))
}

async function getMovieViewingPatterns(
  userId: string,
  excludedLibraryIds: string[]
): Promise<ViewingPatterns> {
  const result = await query<{
    total_watched: string
    avg_play_count: string
    rewatch_count: string
    favorite_count: string
  }>(`
    SELECT 
      COUNT(DISTINCT wh.movie_id) as total_watched,
      AVG(wh.play_count)::numeric(10,2) as avg_play_count,
      COUNT(CASE WHEN wh.play_count > 1 THEN 1 END) as rewatch_count,
      COUNT(CASE WHEN wh.is_favorite THEN 1 END) as favorite_count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1 AND wh.media_type = 'movie'
      AND (CARDINALITY($2::text[]) = 0 OR m.provider_library_id::text != ALL($2::text[]))
  `, [userId, excludedLibraryIds])
  
  const row = result.rows[0]
  const totalWatched = parseInt(row.total_watched, 10) || 0
  
  return {
    totalWatched,
    avgPlayCount: parseFloat(row.avg_play_count) || 1,
    rewatchRate: totalWatched > 0 ? Math.round((parseInt(row.rewatch_count, 10) / totalWatched) * 100) : 0,
    favoriteRate: totalWatched > 0 ? Math.round((parseInt(row.favorite_count, 10) / totalWatched) * 100) : 0,
  }
}

async function getSeriesViewingPatterns(
  userId: string,
  excludedLibraryIds: string[]
): Promise<ViewingPatterns> {
  const result = await query<{
    total_series: string
    total_episodes: string
    avg_play_count: string
    favorite_count: string
    completed_count: string
  }>(`
    WITH series_stats AS (
      SELECT 
        e.series_id,
        COUNT(DISTINCT wh.episode_id) as episodes_watched,
        s.total_episodes,
        AVG(wh.play_count) as avg_play,
        MAX(CASE WHEN wh.is_favorite THEN 1 ELSE 0 END) as has_favorite
      FROM watch_history wh
      JOIN episodes e ON e.id = wh.episode_id
      JOIN series s ON s.id = e.series_id
      WHERE wh.user_id = $1 AND wh.media_type = 'episode'
        AND (CARDINALITY($2::text[]) = 0 OR s.provider_library_id::text != ALL($2::text[]))
      GROUP BY e.series_id, s.total_episodes
    )
    SELECT 
      COUNT(*) as total_series,
      SUM(episodes_watched) as total_episodes,
      AVG(avg_play)::numeric(10,2) as avg_play_count,
      SUM(has_favorite) as favorite_count,
      COUNT(CASE WHEN total_episodes > 0 AND episodes_watched::float / total_episodes >= 0.75 THEN 1 END) as completed_count
    FROM series_stats
  `, [userId, excludedLibraryIds])
  
  const row = result.rows[0]
  const totalSeries = parseInt(row.total_series, 10) || 0
  
  return {
    totalWatched: totalSeries,
    avgPlayCount: parseFloat(row.avg_play_count) || 1,
    rewatchRate: 0, // Not as relevant for series
    favoriteRate: totalSeries > 0 ? Math.round((parseInt(row.favorite_count, 10) / totalSeries) * 100) : 0,
    completionRate: totalSeries > 0 ? Math.round((parseInt(row.completed_count, 10) / totalSeries) * 100) : 0,
  }
}

async function calculateTasteDiversity(
  userId: string,
  mediaType: 'movie' | 'series',
  excludedLibraryIds: string[]
): Promise<TasteDiversity> {
  // Calculate diversity based on embedding spread
  // Use standard deviation of embeddings to measure how varied their taste is
  
  const modelId = await getActiveEmbeddingModelId()
  if (!modelId) {
    return { score: 0.5, description: 'balanced' }
  }
  
  let avgDistance: number
  
  if (mediaType === 'movie') {
    const tableName = await getActiveEmbeddingTableName('embeddings')
    
    // Calculate average pairwise distance between watched movie embeddings
    const result = await query<{ avg_distance: string }>(`
      WITH user_embeddings AS (
        SELECT e.embedding
        FROM watch_history wh
        JOIN movies m ON m.id = wh.movie_id
        JOIN ${tableName} e ON e.movie_id = m.id AND e.model = $2
        WHERE wh.user_id = $1 AND wh.media_type = 'movie'
          AND (CARDINALITY($3::text[]) = 0 OR m.provider_library_id::text != ALL($3::text[]))
        LIMIT 100
      ),
      centroid AS (
        SELECT AVG(embedding) as center FROM user_embeddings
      )
      SELECT AVG(embedding <=> center)::numeric(10,4) as avg_distance
      FROM user_embeddings, centroid
    `, [userId, modelId, excludedLibraryIds])
    
    avgDistance = parseFloat(result.rows[0]?.avg_distance || '0.5')
  } else {
    const tableName = await getActiveEmbeddingTableName('series_embeddings')
    
    const result = await query<{ avg_distance: string }>(`
      WITH user_embeddings AS (
        SELECT DISTINCT se.embedding
        FROM watch_history wh
        JOIN episodes ep ON ep.id = wh.episode_id
        JOIN series s ON s.id = ep.series_id
        JOIN ${tableName} se ON se.series_id = s.id AND se.model = $2
        WHERE wh.user_id = $1 AND wh.media_type = 'episode'
          AND (CARDINALITY($3::text[]) = 0 OR s.provider_library_id::text != ALL($3::text[]))
        LIMIT 100
      ),
      centroid AS (
        SELECT AVG(embedding) as center FROM user_embeddings
      )
      SELECT AVG(embedding <=> center)::numeric(10,4) as avg_distance
      FROM user_embeddings, centroid
    `, [userId, modelId, excludedLibraryIds])
    
    avgDistance = parseFloat(result.rows[0]?.avg_distance || '0.5')
  }
  
  // Normalize to 0-1 scale (typical distances are 0.3-0.8)
  const normalizedScore = Math.min(1, Math.max(0, (avgDistance - 0.3) / 0.5))
  
  let description: string
  if (normalizedScore < 0.3) {
    description = 'focused'
  } else if (normalizedScore < 0.6) {
    description = 'balanced'
  } else {
    description = 'eclectic'
  }
  
  return { score: normalizedScore, description }
}

function inferThemesFromGenres(genres: GenreDistribution[]): ThemeAffinity[] {
  const themes: ThemeAffinity[] = []
  const genreSet = new Set(genres.map(g => g.genre.toLowerCase()))
  const genreMap = new Map(genres.map(g => [g.genre.toLowerCase(), g.percentage]))
  
  // Check for cerebral/thought-provoking
  if (genreSet.has('science fiction') || genreSet.has('mystery') || genreSet.has('thriller')) {
    const strength = ((genreMap.get('science fiction') || 0) + (genreMap.get('mystery') || 0) + (genreMap.get('thriller') || 0)) / 100
    if (strength > 0.1) themes.push({ theme: 'cerebral & thought-provoking', strength: Math.min(1, strength) })
  }
  
  // Check for action
  if (genreSet.has('action') || genreSet.has('adventure')) {
    const strength = ((genreMap.get('action') || 0) + (genreMap.get('adventure') || 0)) / 100
    if (strength > 0.1) themes.push({ theme: 'high-octane action', strength: Math.min(1, strength) })
  }
  
  // Check for heartwarming
  if (genreSet.has('family') || genreSet.has('drama') || genreSet.has('romance')) {
    const strength = ((genreMap.get('family') || 0) + (genreMap.get('drama') || 0) + (genreMap.get('romance') || 0)) / 150
    if (strength > 0.1) themes.push({ theme: 'heartwarming & emotional', strength: Math.min(1, strength) })
  }
  
  // Check for dark/gritty
  if (genreSet.has('crime') || genreSet.has('thriller') || genreSet.has('horror')) {
    const strength = ((genreMap.get('crime') || 0) + (genreMap.get('thriller') || 0) + (genreMap.get('horror') || 0)) / 150
    if (strength > 0.1) themes.push({ theme: 'dark & gritty', strength: Math.min(1, strength) })
  }
  
  // Check for whimsical/fantastical
  if (genreSet.has('fantasy') || genreSet.has('animation')) {
    const strength = ((genreMap.get('fantasy') || 0) + (genreMap.get('animation') || 0)) / 100
    if (strength > 0.1) themes.push({ theme: 'whimsical & fantastical', strength: Math.min(1, strength) })
  }
  
  // Check for comedy
  if (genreSet.has('comedy')) {
    const strength = (genreMap.get('comedy') || 0) / 50
    if (strength > 0.2) themes.push({ theme: 'lighthearted & fun', strength: Math.min(1, strength) })
  }
  
  return themes.sort((a, b) => b.strength - a.strength).slice(0, 5)
}

function inferEmotionalPreferences(genres: GenreDistribution[], patterns: ViewingPatterns): string[] {
  const prefs: string[] = []
  const genreSet = new Set(genres.map(g => g.genre.toLowerCase()))
  
  if (genreSet.has('action') || genreSet.has('thriller')) prefs.push('thrills and excitement')
  if (genreSet.has('comedy')) prefs.push('laughter and levity')
  if (genreSet.has('drama') || genreSet.has('romance')) prefs.push('emotional depth')
  if (genreSet.has('horror')) prefs.push('tension and fear')
  if (genreSet.has('science fiction') || genreSet.has('mystery')) prefs.push('intellectual stimulation')
  if (genreSet.has('family') || genreSet.has('animation')) prefs.push('comfort and nostalgia')
  if (genreSet.has('documentary')) prefs.push('learning and discovery')
  
  if (patterns.rewatchRate > 30) prefs.push('comfort rewatching')
  if (patterns.favoriteRate > 20) prefs.push('strong emotional connections')
  
  return prefs.slice(0, 4)
}

function inferStorytellingStyles(genres: GenreDistribution[], decades: DecadeDistribution[]): string[] {
  const styles: string[] = []
  const genreSet = new Set(genres.map(g => g.genre.toLowerCase()))
  
  if (genreSet.has('action') || genreSet.has('thriller')) styles.push('fast-paced')
  if (genreSet.has('drama')) styles.push('character-driven')
  if (genreSet.has('science fiction') || genreSet.has('fantasy')) styles.push('world-building')
  if (genreSet.has('mystery') || genreSet.has('thriller')) styles.push('plot-twisting')
  if (genreSet.has('documentary')) styles.push('informative')
  if (genreSet.has('comedy')) styles.push('witty dialogue')
  
  // Check decade preferences
  const recentDecades = decades.filter(d => parseInt(d.decade) >= 2010)
  const classicDecades = decades.filter(d => parseInt(d.decade) < 2000)
  
  if (recentDecades.reduce((sum, d) => sum + d.percentage, 0) > 60) {
    styles.push('modern cinematography')
  }
  if (classicDecades.reduce((sum, d) => sum + d.percentage, 0) > 30) {
    styles.push('classic storytelling')
  }
  
  return styles.slice(0, 4)
}

/**
 * Format taste profile as a prompt for AI consumption
 */
export function formatTasteProfileForAI(profile: AbstractTasteProfile, mediaType: 'movie' | 'series'): string {
  const lines: string[] = []
  
  lines.push(`=== VIEWER TASTE ANALYSIS (${mediaType.toUpperCase()}) ===`)
  lines.push('')
  
  // Genre breakdown
  lines.push('GENRE PREFERENCES:')
  for (const g of profile.genres.slice(0, 6)) {
    lines.push(`  - ${g.genre}: ${g.percentage}%`)
  }
  lines.push('')
  
  // Era preferences
  lines.push('ERA PREFERENCES:')
  for (const d of profile.decades.slice(0, 4)) {
    lines.push(`  - ${d.decade}: ${d.percentage}%`)
  }
  lines.push('')
  
  // Viewing behavior
  lines.push('VIEWING BEHAVIOR:')
  lines.push(`  - Total ${mediaType === 'movie' ? 'movies' : 'series'} watched: ${profile.viewingPatterns.totalWatched}`)
  if (mediaType === 'movie') {
    lines.push(`  - Rewatch rate: ${profile.viewingPatterns.rewatchRate}% (${profile.viewingPatterns.rewatchRate > 25 ? 'comfort rewatcher' : 'variety seeker'})`)
  } else {
    lines.push(`  - Completion rate: ${profile.viewingPatterns.completionRate}% (${(profile.viewingPatterns.completionRate || 0) > 50 ? 'completionist' : 'sampler'})`)
  }
  lines.push(`  - Favorite rate: ${profile.viewingPatterns.favoriteRate}% (${profile.viewingPatterns.favoriteRate > 15 ? 'emotionally engaged' : 'casual viewer'})`)
  lines.push('')
  
  // Taste diversity
  lines.push('TASTE PROFILE:')
  lines.push(`  - Diversity: ${profile.diversity.description} (${Math.round(profile.diversity.score * 100)}% spread)`)
  lines.push('')
  
  // Themes
  if (profile.themes.length > 0) {
    lines.push('THEMATIC AFFINITIES:')
    for (const t of profile.themes) {
      lines.push(`  - ${t.theme}: ${Math.round(t.strength * 100)}% affinity`)
    }
    lines.push('')
  }
  
  // Emotional preferences
  if (profile.emotionalPreferences.length > 0) {
    lines.push(`SEEKS: ${profile.emotionalPreferences.join(', ')}`)
  }
  
  // Storytelling styles
  if (profile.storytellingStyles.length > 0) {
    lines.push(`PREFERS: ${profile.storytellingStyles.join(', ')} storytelling`)
  }
  
  lines.push('')
  lines.push('=== END ANALYSIS ===')
  
  return lines.join('\n')
}

