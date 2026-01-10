/**
 * User context builder
 * 
 * Builds dynamic context about the current user:
 * - Taste profile (movie + series synopses)
 * - Recent watch history
 * - Role information
 */
import { query, queryOne } from '../../../../lib/db.js'

interface TasteProfile {
  taste_synopsis: string | null
  series_taste_synopsis: string | null
}

interface RecentWatch {
  title: string
  year: number | null
  media_type: string
}

export async function buildUserContext(userId: string, isAdmin: boolean): Promise<string> {
  // Fetch taste profile
  const tasteProfile = await queryOne<TasteProfile>(
    `SELECT taste_synopsis, series_taste_synopsis FROM user_preferences WHERE user_id = $1`,
    [userId]
  )

  // Fetch recent watches (last 10)
  const recentWatches = await query<RecentWatch>(
    `SELECT 
       COALESCE(m.title, s.title) as title,
       COALESCE(m.year, s.year) as year,
       wh.media_type
     FROM watch_history wh
     LEFT JOIN movies m ON m.id = wh.movie_id
     LEFT JOIN episodes e ON e.id = wh.episode_id
     LEFT JOIN series s ON s.id = e.series_id
     WHERE wh.user_id = $1
     ORDER BY wh.last_played_at DESC NULLS LAST
     LIMIT 10`,
    [userId]
  )

  const movieTaste = tasteProfile?.taste_synopsis || 'No movie taste profile available yet.'
  const seriesTaste = tasteProfile?.series_taste_synopsis || 'No series taste profile available yet.'

  const recentList =
    recentWatches.rows.length > 0
      ? recentWatches.rows
          .map((w) => `- ${w.title} (${w.year || 'N/A'}) [${w.media_type}]`)
          .join('\n')
      : 'No recent watches recorded.'

  const role = isAdmin ? 'Admin' : 'User'

  return `## Current User
- **Role**: ${role}
- **Movie Taste**: ${movieTaste}
- **TV Taste**: ${seriesTaste}

## Recent Watches
${recentList}`
}


