/**
 * Job to refresh personalized assistant suggestions for all users
 */
import { query, queryOne } from '../../../lib/db.js'
import { createChildLogger } from '@aperture/core'
import { createJobProgress, setJobStep, updateJobProgress, completeJob, failJob } from '@aperture/core'

const logger = createChildLogger('assistant-suggestions-job')

interface UserRow {
  id: string
}

interface WatchHistoryItem {
  title: string
  type: string
}

interface RecommendationItem {
  title: string
  type: string
}

interface TasteProfile {
  taste_synopsis: string | null
}

/**
 * Generate personalized suggestions for a single user
 */
async function generateSuggestionsForUser(userId: string): Promise<string[]> {
  const suggestions: string[] = []

  try {
    // Get recent watch history (last 5 movies)
    const recentWatched = await query<WatchHistoryItem>(
      `SELECT m.title, 'movie' as type FROM watch_history wh
       JOIN movies m ON m.id = wh.movie_id
       WHERE wh.user_id = $1 AND wh.media_type = 'movie'
       ORDER BY wh.last_played_at DESC NULLS LAST
       LIMIT 5`,
      [userId]
    )

    // Get recent series watched (via episode watch history)
    const recentSeries = await query<WatchHistoryItem>(
      `SELECT DISTINCT ON (s.id) s.title, 'series' as type 
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN series s ON s.id = e.series_id
       WHERE wh.user_id = $1 AND wh.media_type = 'episode'
       ORDER BY s.id, wh.last_played_at DESC NULLS LAST
       LIMIT 3`,
      [userId]
    )

    // Get top recommendations (join through recommendation_runs to get user's recs)
    const recommendations = await query<RecommendationItem>(
      `SELECT m.title, 'movie' as type FROM recommendation_candidates rc
       JOIN recommendation_runs rr ON rr.id = rc.run_id
       JOIN movies m ON m.id = rc.movie_id
       WHERE rr.user_id = $1 AND rc.is_selected = true
       ORDER BY rc.final_score DESC
       LIMIT 3`,
      [userId]
    )

    // Get user's taste profile
    const tasteProfile = await queryOne<TasteProfile>(
      `SELECT taste_synopsis FROM user_preferences WHERE user_id = $1`,
      [userId]
    )

    // Build personalized suggestions
    
    // Always include these universal suggestions
    suggestions.push('What should I watch tonight?')
    suggestions.push('Show me my top picks')

    // Add "something like X" based on recent watch
    if (recentWatched.rows.length > 0) {
      const randomRecent = recentWatched.rows[Math.floor(Math.random() * recentWatched.rows.length)]
      suggestions.push(`Find me something like ${randomRecent.title}`)
    }

    if (recentSeries.rows.length > 0) {
      const randomSeries = recentSeries.rows[Math.floor(Math.random() * recentSeries.rows.length)]
      suggestions.push(`Shows similar to ${randomSeries.title}`)
    }

    // Add recommendation-based suggestion
    if (recommendations.rows.length > 0) {
      const topRec = recommendations.rows[0]
      suggestions.push(`Tell me about ${topRec.title}`)
    }

    // Add taste-based suggestions if we have a taste profile
    if (tasteProfile?.taste_synopsis) {
      const genreKeywords = ['sci-fi', 'horror', 'comedy', 'drama', 'thriller', 'action', 'romance', 'documentary', 'animation', 'fantasy']
      const foundGenre = genreKeywords.find(g => 
        tasteProfile.taste_synopsis?.toLowerCase().includes(g)
      )
      if (foundGenre) {
        suggestions.push(`Best ${foundGenre} in my library`)
      }
    }

    // Add variety suggestions
    const varietySuggestions = [
      'What are my most watched genres?',
      'Recommend something I haven\'t seen',
      'What\'s highly rated in my library?',
      'Find me a hidden gem',
      'What directors do I watch most?',
      'Show me movies from the 90s',
      'What comedy movies do I have?',
    ]
    
    // Pick 1-2 random variety suggestions
    const shuffledVariety = varietySuggestions.sort(() => Math.random() - 0.5)
    suggestions.push(shuffledVariety[0])
    if (shuffledVariety[1] && suggestions.length < 6) {
      suggestions.push(shuffledVariety[1])
    }

    // Shuffle and limit to 5 suggestions
    return suggestions.sort(() => Math.random() - 0.5).slice(0, 5)
  } catch (err) {
    logger.error({ err, userId }, 'Failed to generate suggestions for user')
    // Return default suggestions on error
    return [
      'What should I watch tonight?',
      'Show me my top picks',
      'Find me something like Inception',
      'What sci-fi movies do you recommend?',
    ]
  }
}

/**
 * Refresh suggestions for all active users
 */
export async function refreshAssistantSuggestions(jobId: string): Promise<{ usersProcessed: number; errors: number }> {
  // Create job progress with 2 steps: load users, generate suggestions
  createJobProgress(jobId, 'refresh-assistant-suggestions', 2)
  setJobStep(jobId, 0, 'Loading users', 0)
  
  let usersProcessed = 0
  let errors = 0

  try {
    // Get all users
    const users = await query<UserRow>(
      `SELECT id FROM users WHERE is_enabled = true`
    )

    const totalUsers = users.rows.length
    logger.info({ totalUsers }, 'Refreshing suggestions for users')
    
    setJobStep(jobId, 1, 'Generating suggestions', totalUsers)

    for (let i = 0; i < users.rows.length; i++) {
      const user = users.rows[i]
      
      try {
        const suggestions = await generateSuggestionsForUser(user.id)
        
        // Upsert suggestions for this user
        await query(
          `INSERT INTO assistant_suggestions (user_id, suggestions, generated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             suggestions = $2,
             generated_at = NOW(),
             updated_at = NOW()`,
          [user.id, JSON.stringify(suggestions)]
        )
        
        usersProcessed++
      } catch (err) {
        logger.error({ err, userId: user.id }, 'Failed to generate suggestions for user')
        errors++
      }

      updateJobProgress(jobId, i + 1, totalUsers)
    }

    completeJob(jobId, {
      usersProcessed,
      errors,
      totalUsers,
    })

    logger.info({ usersProcessed, errors, totalUsers }, 'Assistant suggestions refresh complete')
    return { usersProcessed, errors }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    throw err
  }
}

