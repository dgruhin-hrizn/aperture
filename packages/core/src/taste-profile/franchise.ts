/**
 * Franchise Detection and Preference Scoring
 *
 * Detects franchises from:
 * - Movie collection_name field
 * - Series title patterns (e.g., "Star Trek:", "Marvel's")
 * - Common franchise indicators
 *
 * Calculates preference scores based on:
 * - Items watched vs total in franchise
 * - Total engagement (episodes/movies)
 * - User ratings within franchise
 */

import { query } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { bulkUpdateFranchisePreferences, bulkUpdateGenreWeights } from './index.js'
import type { MediaType } from './types.js'

const logger = createChildLogger('franchise-detector')

// ============================================================================
// Franchise Detection Patterns
// ============================================================================

/**
 * Known franchise title prefixes/patterns
 */
const FRANCHISE_PATTERNS: Array<{ pattern: RegExp; franchiseName: string }> = [
  // Star Trek
  { pattern: /^Star Trek[:\s]/i, franchiseName: 'Star Trek' },
  { pattern: /^Star Trek$/i, franchiseName: 'Star Trek' },

  // Star Wars
  { pattern: /^Star Wars[:\s]/i, franchiseName: 'Star Wars' },
  { pattern: /^The Mandalorian$/i, franchiseName: 'Star Wars' },
  { pattern: /^The Book of Boba Fett$/i, franchiseName: 'Star Wars' },
  { pattern: /^Obi-Wan Kenobi$/i, franchiseName: 'Star Wars' },
  { pattern: /^Ahsoka$/i, franchiseName: 'Star Wars' },
  { pattern: /^Andor$/i, franchiseName: 'Star Wars' },
  { pattern: /^The Acolyte$/i, franchiseName: 'Star Wars' },
  { pattern: /^Skeleton Crew$/i, franchiseName: 'Star Wars' },

  // Marvel
  { pattern: /^Marvel['']s/i, franchiseName: 'Marvel' },
  { pattern: /^The Avengers/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Avengers[:\s]/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Iron Man/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Captain America/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Thor[:\s]/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Thor$/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Ant-Man/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Black Panther/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Spider-Man[:\s]/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Doctor Strange/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Guardians of the Galaxy/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^WandaVision$/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Loki$/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Hawkeye$/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Moon Knight$/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^She-Hulk/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Ms\. Marvel$/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Secret Invasion$/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Echo$/i, franchiseName: 'Marvel Cinematic Universe' },
  { pattern: /^Agatha All Along$/i, franchiseName: 'Marvel Cinematic Universe' },

  // DC
  { pattern: /^DC['']s/i, franchiseName: 'DC' },
  { pattern: /^Batman[:\s]/i, franchiseName: 'DC' },
  { pattern: /^The Batman$/i, franchiseName: 'DC' },
  { pattern: /^Superman[:\s]/i, franchiseName: 'DC' },
  { pattern: /^Justice League/i, franchiseName: 'DC' },
  { pattern: /^Wonder Woman/i, franchiseName: 'DC' },
  { pattern: /^Aquaman/i, franchiseName: 'DC' },
  { pattern: /^The Flash$/i, franchiseName: 'DC' },
  { pattern: /^Shazam/i, franchiseName: 'DC' },
  { pattern: /^Peacemaker$/i, franchiseName: 'DC' },

  // Stargate
  { pattern: /^Stargate[:\s]/i, franchiseName: 'Stargate' },
  { pattern: /^Stargate$/i, franchiseName: 'Stargate' },

  // Law & Order
  { pattern: /^Law & Order/i, franchiseName: 'Law & Order' },
  { pattern: /^Law and Order/i, franchiseName: 'Law & Order' },

  // NCIS
  { pattern: /^NCIS[:\s]/i, franchiseName: 'NCIS' },
  { pattern: /^NCIS$/i, franchiseName: 'NCIS' },

  // CSI
  { pattern: /^CSI[:\s]/i, franchiseName: 'CSI' },
  { pattern: /^CSI$/i, franchiseName: 'CSI' },

  // Chicago (One Chicago)
  { pattern: /^Chicago (Fire|P\.?D\.?|Med|Justice)/i, franchiseName: 'One Chicago' },

  // The Walking Dead
  { pattern: /^The Walking Dead/i, franchiseName: 'The Walking Dead' },
  { pattern: /^Fear the Walking Dead$/i, franchiseName: 'The Walking Dead' },
  { pattern: /^Tales of the Walking Dead$/i, franchiseName: 'The Walking Dead' },

  // Game of Thrones
  { pattern: /^Game of Thrones$/i, franchiseName: 'Game of Thrones' },
  { pattern: /^House of the Dragon$/i, franchiseName: 'Game of Thrones' },

  // Lord of the Rings
  { pattern: /^The Lord of the Rings/i, franchiseName: 'Lord of the Rings' },
  { pattern: /^The Hobbit/i, franchiseName: 'Lord of the Rings' },
  { pattern: /^The Rings of Power$/i, franchiseName: 'Lord of the Rings' },

  // Harry Potter
  { pattern: /^Harry Potter/i, franchiseName: 'Harry Potter' },
  { pattern: /^Fantastic Beasts/i, franchiseName: 'Harry Potter' },

  // Fast & Furious
  { pattern: /^Fast & Furious/i, franchiseName: 'Fast & Furious' },
  { pattern: /^The Fast and the Furious/i, franchiseName: 'Fast & Furious' },
  { pattern: /^Furious \d/i, franchiseName: 'Fast & Furious' },
  { pattern: /^F\d$/i, franchiseName: 'Fast & Furious' },

  // Mission Impossible
  { pattern: /^Mission: Impossible/i, franchiseName: 'Mission: Impossible' },

  // James Bond
  { pattern: /^James Bond/i, franchiseName: 'James Bond' },
  { pattern: /^007[:\s]/i, franchiseName: 'James Bond' },

  // Jurassic
  { pattern: /^Jurassic (Park|World)/i, franchiseName: 'Jurassic Park' },

  // Transformers
  { pattern: /^Transformers/i, franchiseName: 'Transformers' },

  // Pirates of the Caribbean
  { pattern: /^Pirates of the Caribbean/i, franchiseName: 'Pirates of the Caribbean' },

  // John Wick
  { pattern: /^John Wick/i, franchiseName: 'John Wick' },

  // The Conjuring
  { pattern: /^The Conjuring/i, franchiseName: 'The Conjuring' },
  { pattern: /^Annabelle/i, franchiseName: 'The Conjuring' },
  { pattern: /^The Nun/i, franchiseName: 'The Conjuring' },

  // Alien
  { pattern: /^Alien[:\s]/i, franchiseName: 'Alien' },
  { pattern: /^Aliens$/i, franchiseName: 'Alien' },
  { pattern: /^Prometheus$/i, franchiseName: 'Alien' },

  // Predator
  { pattern: /^Predator/i, franchiseName: 'Predator' },
  { pattern: /^Prey \(2022\)$/i, franchiseName: 'Predator' },

  // Terminator
  { pattern: /^Terminator/i, franchiseName: 'Terminator' },
  { pattern: /^The Terminator$/i, franchiseName: 'Terminator' },

  // Planet of the Apes
  { pattern: /Planet of the Apes/i, franchiseName: 'Planet of the Apes' },

  // X-Men
  { pattern: /^X-Men/i, franchiseName: 'X-Men' },
  { pattern: /^Logan$/i, franchiseName: 'X-Men' },
  { pattern: /^Deadpool/i, franchiseName: 'X-Men' },
  { pattern: /^The Wolverine$/i, franchiseName: 'X-Men' },

  // Toy Story / Pixar franchises
  { pattern: /^Toy Story/i, franchiseName: 'Toy Story' },
  { pattern: /^Cars \d?$/i, franchiseName: 'Cars' },
  { pattern: /^Finding (Nemo|Dory)$/i, franchiseName: 'Finding Nemo' },
  { pattern: /^The Incredibles/i, franchiseName: 'The Incredibles' },
  { pattern: /^Monsters, Inc/i, franchiseName: 'Monsters, Inc.' },
  { pattern: /^Monsters University$/i, franchiseName: 'Monsters, Inc.' },

  // Shrek
  { pattern: /^Shrek/i, franchiseName: 'Shrek' },
  { pattern: /^Puss in Boots/i, franchiseName: 'Shrek' },

  // How to Train Your Dragon
  { pattern: /^How to Train Your Dragon/i, franchiseName: 'How to Train Your Dragon' },

  // Despicable Me / Minions
  { pattern: /^Despicable Me/i, franchiseName: 'Despicable Me' },
  { pattern: /^Minions/i, franchiseName: 'Despicable Me' },

  // The Matrix
  { pattern: /^The Matrix/i, franchiseName: 'The Matrix' },

  // Rocky / Creed
  { pattern: /^Rocky/i, franchiseName: 'Rocky' },
  { pattern: /^Creed/i, franchiseName: 'Rocky' },

  // Indiana Jones
  { pattern: /^Indiana Jones/i, franchiseName: 'Indiana Jones' },
  { pattern: /^Raiders of the Lost Ark$/i, franchiseName: 'Indiana Jones' },

  // Back to the Future
  { pattern: /^Back to the Future/i, franchiseName: 'Back to the Future' },

  // Ghostbusters
  { pattern: /^Ghostbusters/i, franchiseName: 'Ghostbusters' },

  // Men in Black
  { pattern: /^Men in Black/i, franchiseName: 'Men in Black' },
  { pattern: /^MIB/i, franchiseName: 'Men in Black' },

  // Die Hard
  { pattern: /^Die Hard/i, franchiseName: 'Die Hard' },

  // Lethal Weapon
  { pattern: /^Lethal Weapon/i, franchiseName: 'Lethal Weapon' },

  // Beverly Hills Cop
  { pattern: /^Beverly Hills Cop/i, franchiseName: 'Beverly Hills Cop' },

  // Bad Boys
  { pattern: /^Bad Boys/i, franchiseName: 'Bad Boys' },

  // Ocean's
  { pattern: /^Ocean['']s/i, franchiseName: "Ocean's" },

  // The Hunger Games
  { pattern: /^The Hunger Games/i, franchiseName: 'The Hunger Games' },

  // Divergent
  { pattern: /^Divergent/i, franchiseName: 'Divergent' },
  { pattern: /^Insurgent$/i, franchiseName: 'Divergent' },
  { pattern: /^Allegiant$/i, franchiseName: 'Divergent' },

  // Maze Runner
  { pattern: /^Maze Runner/i, franchiseName: 'Maze Runner' },
  { pattern: /^The Maze Runner$/i, franchiseName: 'Maze Runner' },

  // Twilight
  { pattern: /^Twilight/i, franchiseName: 'Twilight' },
  { pattern: /^The Twilight Saga/i, franchiseName: 'Twilight' },

  // Fifty Shades
  { pattern: /^Fifty Shades/i, franchiseName: 'Fifty Shades' },

  // The Purge
  { pattern: /^The Purge/i, franchiseName: 'The Purge' },

  // Saw
  { pattern: /^Saw/i, franchiseName: 'Saw' },
  { pattern: /^Jigsaw$/i, franchiseName: 'Saw' },

  // Friday the 13th
  { pattern: /^Friday the 13th/i, franchiseName: 'Friday the 13th' },

  // A Nightmare on Elm Street
  { pattern: /Nightmare on Elm Street/i, franchiseName: 'A Nightmare on Elm Street' },

  // Halloween
  { pattern: /^Halloween/i, franchiseName: 'Halloween' },

  // Scream
  { pattern: /^Scream/i, franchiseName: 'Scream' },

  // Final Destination
  { pattern: /^Final Destination/i, franchiseName: 'Final Destination' },

  // Paranormal Activity
  { pattern: /^Paranormal Activity/i, franchiseName: 'Paranormal Activity' },

  // Insidious
  { pattern: /^Insidious/i, franchiseName: 'Insidious' },

  // The Exorcist
  { pattern: /^The Exorcist/i, franchiseName: 'The Exorcist' },

  // Godzilla / MonsterVerse
  { pattern: /^Godzilla/i, franchiseName: 'MonsterVerse' },
  { pattern: /^Kong[:\s]/i, franchiseName: 'MonsterVerse' },
  { pattern: /^Monarch/i, franchiseName: 'MonsterVerse' },

  // Pacific Rim
  { pattern: /^Pacific Rim/i, franchiseName: 'Pacific Rim' },

  // Cloverfield
  { pattern: /^Cloverfield/i, franchiseName: 'Cloverfield' },
  { pattern: /^10 Cloverfield Lane$/i, franchiseName: 'Cloverfield' },

  // Resident Evil
  { pattern: /^Resident Evil/i, franchiseName: 'Resident Evil' },

  // Underworld
  { pattern: /^Underworld/i, franchiseName: 'Underworld' },

  // The Mummy
  { pattern: /^The Mummy/i, franchiseName: 'The Mummy' },

  // Night at the Museum
  { pattern: /^Night at the Museum/i, franchiseName: 'Night at the Museum' },

  // National Treasure
  { pattern: /^National Treasure/i, franchiseName: 'National Treasure' },

  // The Chronicles of Narnia
  { pattern: /Chronicles of Narnia/i, franchiseName: 'The Chronicles of Narnia' },

  // Percy Jackson
  { pattern: /^Percy Jackson/i, franchiseName: 'Percy Jackson' },

  // Ice Age
  { pattern: /^Ice Age/i, franchiseName: 'Ice Age' },

  // Madagascar
  { pattern: /^Madagascar/i, franchiseName: 'Madagascar' },
  { pattern: /^Penguins of Madagascar$/i, franchiseName: 'Madagascar' },

  // Kung Fu Panda
  { pattern: /^Kung Fu Panda/i, franchiseName: 'Kung Fu Panda' },

  // Hotel Transylvania
  { pattern: /^Hotel Transylvania/i, franchiseName: 'Hotel Transylvania' },

  // The Secret Life of Pets
  { pattern: /^The Secret Life of Pets/i, franchiseName: 'The Secret Life of Pets' },

  // Sing
  { pattern: /^Sing \d?$/i, franchiseName: 'Sing' },
  { pattern: /^Sing$/i, franchiseName: 'Sing' },

  // Boss Baby
  { pattern: /^The Boss Baby/i, franchiseName: 'Boss Baby' },
  { pattern: /^Boss Baby/i, franchiseName: 'Boss Baby' },

  // Trolls
  { pattern: /^Trolls/i, franchiseName: 'Trolls' },

  // LEGO
  { pattern: /^The LEGO/i, franchiseName: 'LEGO' },
  { pattern: /^LEGO /i, franchiseName: 'LEGO' },

  // SpongeBob
  { pattern: /^SpongeBob/i, franchiseName: 'SpongeBob SquarePants' },
  { pattern: /^The SpongeBob/i, franchiseName: 'SpongeBob SquarePants' },
]

// ============================================================================
// Main Detection Functions
// ============================================================================

/**
 * Detect franchise from title using patterns
 */
export function detectFranchiseFromTitle(title: string): string | null {
  for (const { pattern, franchiseName } of FRANCHISE_PATTERNS) {
    if (pattern.test(title)) {
      return franchiseName
    }
  }
  return null
}

export interface DetectionResult {
  updated: number
  newItems: string[]
}

export interface DetectionOptions {
  mode?: 'reset' | 'merge'
}

/**
 * Detect and update franchise preferences for a user
 */
export async function detectAndUpdateFranchises(
  userId: string,
  mediaType: MediaType,
  options: DetectionOptions = {}
): Promise<DetectionResult> {
  const { mode = 'reset' } = options
  logger.info({ userId, mediaType, mode }, 'Detecting franchises from watch history')

  const franchiseStats =
    mediaType === 'movie'
      ? await detectMovieFranchises(userId)
      : await detectSeriesFranchises(userId)

  if (franchiseStats.length === 0) {
    logger.info({ userId, mediaType }, 'No franchises detected')
    return { updated: 0, newItems: [] }
  }

  // Get existing franchises if in merge mode
  let existingFranchises: Set<string> = new Set()
  if (mode === 'merge') {
    const { getUserFranchisePreferences } = await import('./index.js')
    const existing = await getUserFranchisePreferences(userId, mediaType)
    existingFranchises = new Set(existing.map((f) => f.franchiseName))
  }

  // Convert stats to preference format
  const preferences = franchiseStats.map((stat) => ({
    franchiseName: stat.franchiseName,
    mediaType: mediaType as MediaType | 'both',
    preferenceScore: calculatePreferenceScore(stat),
    itemsWatched: stat.itemsWatched,
    totalEngagement: stat.totalEngagement,
  }))

  // Track new items
  const newItems: string[] = []

  // In merge mode, only include franchises that don't exist yet
  const preferencesToUpdate = mode === 'merge'
    ? preferences.filter((p) => {
        const isNew = !existingFranchises.has(p.franchiseName)
        if (isNew) newItems.push(p.franchiseName)
        return isNew
      })
    : preferences

  // In reset mode, all items are "new" for highlighting purposes
  if (mode === 'reset') {
    newItems.push(...preferences.map((p) => p.franchiseName))
  }

  // Update database
  const updated = preferencesToUpdate.length > 0
    ? await bulkUpdateFranchisePreferences(userId, preferencesToUpdate)
    : 0

  logger.info(
    { userId, mediaType, mode, detected: franchiseStats.length, updated, newItems: newItems.length },
    `Detected ${franchiseStats.length} franchises, updated ${updated}, new: ${newItems.length}`
  )

  return { updated, newItems }
}

// ============================================================================
// Movie Franchise Detection
// ============================================================================

interface FranchiseStats {
  franchiseName: string
  itemsWatched: number
  totalEngagement: number
  totalInLibrary: number
  avgRating: number | null
  hasHighEngagement: boolean
}

/**
 * Detect franchises from movie watch history
 */
async function detectMovieFranchises(userId: string): Promise<FranchiseStats[]> {
  // Get user's excluded library IDs
  const { getUserExcludedLibraries } = await import('../lib/libraryExclusions.js')
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  
  // Build library exclusion clause
  const libraryExclusionClause = excludedLibraryIds.length > 0
    ? `AND (m.provider_library_id IS NULL OR m.provider_library_id NOT IN (${excludedLibraryIds.map((_, i) => `$${i + 2}`).join(', ')}))`
    : ''
  
  // Get watched movies with their collection_name
  const watchedResult = await query<{
    collection_name: string | null
    title: string
    play_count: number
    user_rating: number | null
  }>(
    `SELECT m.collection_name, m.title, wh.play_count, ur.rating as user_rating
     FROM watch_history wh
     JOIN movies m ON m.id = wh.movie_id
     LEFT JOIN user_ratings ur ON ur.movie_id = m.id AND ur.user_id = wh.user_id
     WHERE wh.user_id = $1 AND wh.media_type = 'movie'
     ${libraryExclusionClause}`,
    [userId, ...excludedLibraryIds]
  )

  // Group by franchise
  const franchiseMap = new Map<
    string,
    { items: number; engagement: number; ratings: number[]; titles: string[] }
  >()

  for (const row of watchedResult.rows) {
    // Try collection_name first, then title pattern
    let franchise = row.collection_name
    if (!franchise) {
      franchise = detectFranchiseFromTitle(row.title)
    }

    if (!franchise) continue

    const existing = franchiseMap.get(franchise) || {
      items: 0,
      engagement: 0,
      ratings: [],
      titles: [],
    }
    existing.items++
    existing.engagement += row.play_count || 1
    if (row.user_rating) existing.ratings.push(row.user_rating)
    existing.titles.push(row.title)
    franchiseMap.set(franchise, existing)
  }

  // Get total items per franchise in library
  const libraryTotals = await getLibraryFranchiseTotals('movie')

  // Build stats
  const stats: FranchiseStats[] = []
  for (const [franchiseName, data] of franchiseMap) {
    const totalInLibrary = libraryTotals.get(franchiseName) || data.items
    const avgRating =
      data.ratings.length > 0
        ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
        : null

    stats.push({
      franchiseName,
      itemsWatched: data.items,
      totalEngagement: data.engagement,
      totalInLibrary,
      avgRating,
      hasHighEngagement: data.engagement >= 3, // Watched at least 3 movies or rewatched
    })
  }

  // Sort by engagement
  stats.sort((a, b) => b.totalEngagement - a.totalEngagement)

  return stats
}

/**
 * Detect franchises from series watch history
 */
async function detectSeriesFranchises(userId: string): Promise<FranchiseStats[]> {
  // Get user's excluded library IDs
  const { getUserExcludedLibraries } = await import('../lib/libraryExclusions.js')
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  
  // Build HAVING clause for library exclusion (since we're using GROUP BY)
  const libraryExclusionClause = excludedLibraryIds.length > 0
    ? `HAVING MAX(s.provider_library_id) IS NULL OR MAX(s.provider_library_id) NOT IN (${excludedLibraryIds.map((_, i) => `$${i + 2}`).join(', ')})`
    : ''
  
  // Get watched series with episode counts
  const watchedResult = await query<{
    title: string
    episodes_watched: number
    user_rating: number | null
  }>(
    `SELECT s.title, 
            COUNT(DISTINCT wh.episode_id) as episodes_watched,
            MAX(ur.rating) as user_rating
     FROM watch_history wh
     JOIN episodes e ON e.id = wh.episode_id
     JOIN series s ON s.id = e.series_id
     LEFT JOIN user_ratings ur ON ur.series_id = s.id AND ur.user_id = wh.user_id
     WHERE wh.user_id = $1 AND wh.media_type = 'episode'
     GROUP BY s.id, s.title
     ${libraryExclusionClause}`,
    [userId, ...excludedLibraryIds]
  )

  // Group by franchise
  const franchiseMap = new Map<
    string,
    { items: number; engagement: number; ratings: number[]; titles: string[] }
  >()

  for (const row of watchedResult.rows) {
    const franchise = detectFranchiseFromTitle(row.title)
    if (!franchise) continue

    const episodesWatched = parseInt(String(row.episodes_watched), 10)

    const existing = franchiseMap.get(franchise) || {
      items: 0,
      engagement: 0,
      ratings: [],
      titles: [],
    }
    existing.items++
    existing.engagement += episodesWatched
    if (row.user_rating) existing.ratings.push(row.user_rating)
    existing.titles.push(row.title)
    franchiseMap.set(franchise, existing)
  }

  // Get total items per franchise in library
  const libraryTotals = await getLibraryFranchiseTotals('series')

  // Build stats
  const stats: FranchiseStats[] = []
  for (const [franchiseName, data] of franchiseMap) {
    const totalInLibrary = libraryTotals.get(franchiseName) || data.items
    const avgRating =
      data.ratings.length > 0
        ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
        : null

    stats.push({
      franchiseName,
      itemsWatched: data.items,
      totalEngagement: data.engagement,
      totalInLibrary,
      avgRating,
      hasHighEngagement: data.engagement >= 50, // Watched at least 50 episodes
    })
  }

  // Sort by engagement
  stats.sort((a, b) => b.totalEngagement - a.totalEngagement)

  return stats
}

/**
 * Get total items per franchise in the library
 */
async function getLibraryFranchiseTotals(
  mediaType: MediaType
): Promise<Map<string, number>> {
  const totals = new Map<string, number>()

  if (mediaType === 'movie') {
    // Get all movies with collection_name
    const result = await query<{ collection_name: string; count: number }>(
      `SELECT collection_name, COUNT(*) as count
       FROM movies
       WHERE collection_name IS NOT NULL
       GROUP BY collection_name`,
      []
    )

    for (const row of result.rows) {
      totals.set(row.collection_name, parseInt(String(row.count), 10))
    }

    // Also detect from titles
    const titleResult = await query<{ title: string }>(
      `SELECT title FROM movies WHERE collection_name IS NULL`,
      []
    )

    for (const row of titleResult.rows) {
      const franchise = detectFranchiseFromTitle(row.title)
      if (franchise) {
        totals.set(franchise, (totals.get(franchise) || 0) + 1)
      }
    }
  } else {
    // Get all series
    const result = await query<{ title: string }>(`SELECT title FROM series`, [])

    for (const row of result.rows) {
      const franchise = detectFranchiseFromTitle(row.title)
      if (franchise) {
        totals.set(franchise, (totals.get(franchise) || 0) + 1)
      }
    }
  }

  return totals
}

// ============================================================================
// Preference Score Calculation
// ============================================================================

/**
 * Calculate preference score (-1 to 1) from franchise stats
 *
 * Factors:
 * - Completion rate (items watched / total in library)
 * - Engagement intensity (high episode count)
 * - User ratings (if available)
 */
function calculatePreferenceScore(stats: FranchiseStats): number {
  let score = 0

  // Base score from completion rate (0 to 0.4)
  const completionRate = stats.itemsWatched / Math.max(stats.totalInLibrary, 1)
  score += completionRate * 0.4

  // High engagement bonus (0 to 0.3)
  if (stats.hasHighEngagement) {
    score += 0.3
  } else if (stats.totalEngagement >= 2) {
    score += 0.15
  }

  // Rating bonus/penalty (0 to 0.3)
  if (stats.avgRating !== null) {
    // Normalize rating to 0-1 (assuming 1-10 scale, adjust for 1-5)
    const normalizedRating = stats.avgRating > 5 ? stats.avgRating / 10 : stats.avgRating / 5
    // Convert to -0.15 to +0.3 range
    score += (normalizedRating - 0.5) * 0.6
  }

  // Clamp to -1 to 1
  return Math.max(-1, Math.min(1, score))
}

/**
 * Get franchise name for an item (movie or series)
 */
export async function getItemFranchise(
  itemId: string,
  mediaType: MediaType
): Promise<string | null> {
  if (mediaType === 'movie') {
    const result = await query<{ collection_name: string | null; title: string }>(
      `SELECT collection_name, title FROM movies WHERE id = $1`,
      [itemId]
    )
    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return row.collection_name || detectFranchiseFromTitle(row.title)
  } else {
    const result = await query<{ title: string }>(
      `SELECT title FROM series WHERE id = $1`,
      [itemId]
    )
    if (result.rows.length === 0) return null

    return detectFranchiseFromTitle(result.rows[0].title)
  }
}

// ============================================================================
// Genre Detection and Weight Calculation
// ============================================================================

interface GenreStats {
  genre: string
  itemsWatched: number
  totalEngagement: number
  avgRating: number | null
  hasFavorites: boolean
}

/**
 * Detect and update genre weights for a user based on watch history
 */
export async function detectAndUpdateGenres(
  userId: string,
  mediaType: MediaType,
  options: DetectionOptions = {}
): Promise<DetectionResult> {
  const { mode = 'reset' } = options
  logger.info({ userId, mediaType, mode }, 'Detecting genres from watch history')

  const genreStats =
    mediaType === 'movie'
      ? await detectMovieGenres(userId)
      : await detectSeriesGenres(userId)

  if (genreStats.length === 0) {
    logger.info({ userId, mediaType }, 'No genres detected')
    return { updated: 0, newItems: [] }
  }

  // Get existing genres if in merge mode
  let existingGenres: Set<string> = new Set()
  if (mode === 'merge') {
    const { getUserGenreWeights } = await import('./index.js')
    const existing = await getUserGenreWeights(userId)
    existingGenres = new Set(existing.map((g) => g.genre))
  }

  // Convert stats to genre weight format
  // Weight range: 0 (avoid) to 2 (boost), default 1 (neutral)
  const genreWeights = genreStats.map((stat) => ({
    genre: stat.genre,
    weight: calculateGenreWeight(stat, genreStats),
  }))

  // Track new items
  const newItems: string[] = []

  // In merge mode, only include genres that don't exist yet
  const weightsToUpdate = mode === 'merge'
    ? genreWeights.filter((g) => {
        const isNew = !existingGenres.has(g.genre)
        if (isNew) newItems.push(g.genre)
        return isNew
      })
    : genreWeights

  // In reset mode, all items are "new" for highlighting purposes
  if (mode === 'reset') {
    newItems.push(...genreWeights.map((g) => g.genre))
  }

  // Update database
  const updated = weightsToUpdate.length > 0
    ? await bulkUpdateGenreWeights(userId, weightsToUpdate)
    : 0

  logger.info(
    { userId, mediaType, mode, detected: genreStats.length, updated, newItems: newItems.length },
    `Detected ${genreStats.length} genres, updated ${updated}, new: ${newItems.length}`
  )

  return { updated, newItems }
}

/**
 * Detect genres from movie watch history
 */
async function detectMovieGenres(userId: string): Promise<GenreStats[]> {
  // Get user's excluded library IDs
  const { getUserExcludedLibraries } = await import('../lib/libraryExclusions.js')
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  
  // Build library exclusion clause
  const libraryExclusionClause = excludedLibraryIds.length > 0
    ? `AND (m.provider_library_id IS NULL OR m.provider_library_id NOT IN (${excludedLibraryIds.map((_, i) => `$${i + 2}`).join(', ')}))`
    : ''
  
  const result = await query<{
    genres: string[]
    play_count: number
    user_rating: number | null
    is_favorite: boolean
  }>(
    `SELECT m.genres, wh.play_count, ur.rating as user_rating, wh.is_favorite
     FROM watch_history wh
     JOIN movies m ON m.id = wh.movie_id
     LEFT JOIN user_ratings ur ON ur.movie_id = m.id AND ur.user_id = wh.user_id
     WHERE wh.user_id = $1 AND wh.media_type = 'movie'
     ${libraryExclusionClause}`,
    [userId, ...excludedLibraryIds]
  )

  return aggregateGenreStats(result.rows)
}

/**
 * Detect genres from series watch history
 */
async function detectSeriesGenres(userId: string): Promise<GenreStats[]> {
  // Get user's excluded library IDs
  const { getUserExcludedLibraries } = await import('../lib/libraryExclusions.js')
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  
  // Build HAVING clause for library exclusion (since we're using GROUP BY)
  const libraryExclusionClause = excludedLibraryIds.length > 0
    ? `HAVING MAX(s.provider_library_id) IS NULL OR MAX(s.provider_library_id) NOT IN (${excludedLibraryIds.map((_, i) => `$${i + 2}`).join(', ')})`
    : ''
  
  const result = await query<{
    genres: string[]
    episodes_watched: number
    user_rating: number | null
    has_favorites: boolean
  }>(
    `SELECT s.genres,
            COUNT(DISTINCT wh.episode_id) as episodes_watched,
            MAX(ur.rating) as user_rating,
            BOOL_OR(wh.is_favorite) as has_favorites
     FROM watch_history wh
     JOIN episodes e ON e.id = wh.episode_id
     JOIN series s ON s.id = e.series_id
     LEFT JOIN user_ratings ur ON ur.series_id = s.id AND ur.user_id = wh.user_id
     WHERE wh.user_id = $1 AND wh.media_type = 'episode'
     GROUP BY s.id, s.genres
     ${libraryExclusionClause}`,
    [userId, ...excludedLibraryIds]
  )

  return aggregateGenreStats(
    result.rows.map((row) => ({
      genres: row.genres,
      play_count: parseInt(String(row.episodes_watched), 10),
      user_rating: row.user_rating,
      is_favorite: row.has_favorites,
    }))
  )
}

/**
 * Aggregate genre statistics from watch data
 */
function aggregateGenreStats(
  rows: Array<{
    genres: string[]
    play_count: number
    user_rating: number | null
    is_favorite: boolean
  }>
): GenreStats[] {
  const genreMap = new Map<
    string,
    { items: number; engagement: number; ratings: number[]; favorites: number }
  >()

  for (const row of rows) {
    const genres = row.genres || []
    for (const genre of genres) {
      if (!genre) continue

      const existing = genreMap.get(genre) || {
        items: 0,
        engagement: 0,
        ratings: [],
        favorites: 0,
      }
      existing.items++
      existing.engagement += row.play_count || 1
      if (row.user_rating) existing.ratings.push(row.user_rating)
      if (row.is_favorite) existing.favorites++
      genreMap.set(genre, existing)
    }
  }

  const stats: GenreStats[] = []
  for (const [genre, data] of genreMap) {
    const avgRating =
      data.ratings.length > 0
        ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
        : null

    stats.push({
      genre,
      itemsWatched: data.items,
      totalEngagement: data.engagement,
      avgRating,
      hasFavorites: data.favorites > 0,
    })
  }

  // Sort by engagement
  stats.sort((a, b) => b.totalEngagement - a.totalEngagement)

  return stats
}

/**
 * Calculate genre weight based on relative engagement
 *
 * The weight is relative to other genres the user has watched:
 * - Top genres get boosted (up to 2.0)
 * - Average genres stay neutral (1.0)
 * - Rarely watched genres stay at default (1.0)
 *
 * Ratings also influence the weight.
 */
function calculateGenreWeight(stat: GenreStats, allStats: GenreStats[]): number {
  if (allStats.length === 0) return 1.0

  // Calculate average engagement across all genres
  const avgEngagement =
    allStats.reduce((sum, s) => sum + s.totalEngagement, 0) / allStats.length

  // Base weight from relative engagement
  // Range: 0.8 to 1.4 based on how much above/below average
  let weight = 1.0
  if (avgEngagement > 0) {
    const relativeEngagement = stat.totalEngagement / avgEngagement
    // Clamp relative engagement to 0.5x to 2x average
    const clamped = Math.max(0.5, Math.min(2, relativeEngagement))
    // Map to 0.8 - 1.4 range
    weight = 0.8 + (clamped - 0.5) * 0.4
  }

  // Rating adjustment: +/- 0.3 based on average rating
  if (stat.avgRating !== null) {
    const normalizedRating = stat.avgRating > 5 ? stat.avgRating / 10 : stat.avgRating / 5
    // Convert 0-1 rating to -0.3 to +0.3 adjustment
    weight += (normalizedRating - 0.5) * 0.6
  }

  // Favorites bonus: +0.2 if user has favorited items in this genre
  if (stat.hasFavorites) {
    weight += 0.2
  }

  // Clamp to 0 to 2 range
  return Math.max(0, Math.min(2, weight))
}

