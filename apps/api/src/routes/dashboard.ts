import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth, type SessionUser } from '../plugins/auth.js'

interface DashboardStats {
  moviesWatched: number
  seriesWatched: number
  ratingsCount: number
  watchTimeMinutes: number
}

interface DashboardRecommendation {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  genres: string[]
  matchScore: number | null
}

interface DashboardTopPick {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  genres: string[]
  rank: number
  popularityScore: number
}

interface DashboardRecentWatch {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  lastWatched: Date
  playCount: number
}

interface DashboardRecentRating {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  posterUrl: string | null
  rating: number
  ratedAt: Date
}

interface DashboardResponse {
  stats: DashboardStats
  recommendations: DashboardRecommendation[]
  topPicks: DashboardTopPick[]
  recentWatches: DashboardRecentWatch[]
  recentRatings: DashboardRecentRating[]
}

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/dashboard
   * Get aggregated dashboard data for the current user
   */
  fastify.get<{ Reply: DashboardResponse }>(
    '/api/dashboard',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.user as SessionUser

      // Run all queries in parallel for performance
      const [
        statsResult,
        movieRecsResult,
        seriesRecsResult,
        topMoviesResult,
        topSeriesResult,
        recentMovieWatchesResult,
        recentSeriesWatchesResult,
        recentRatingsResult,
      ] = await Promise.all([
        // Stats query
        queryOne<{
          movies_watched: string
          series_watched: string
          ratings_count: string
          watch_time_minutes: string
        }>(`
          SELECT 
            COALESCE((
              SELECT COUNT(DISTINCT movie_id) 
              FROM watch_history 
              WHERE user_id = $1 AND movie_id IS NOT NULL
            ), 0) as movies_watched,
            COALESCE((
              SELECT COUNT(DISTINCT e.series_id) 
              FROM watch_history wh
              JOIN episodes e ON e.id = wh.episode_id
              WHERE wh.user_id = $1 AND wh.episode_id IS NOT NULL
            ), 0) as series_watched,
            COALESCE((
              SELECT COUNT(*) FROM user_ratings WHERE user_id = $1
            ), 0) as ratings_count,
            COALESCE((
              SELECT COALESCE(SUM(m.runtime_minutes), 0)
              FROM watch_history wh
              JOIN movies m ON m.id = wh.movie_id
              WHERE wh.user_id = $1 AND wh.movie_id IS NOT NULL
            ), 0) as watch_time_minutes
        `, [user.id]),

        // Movie recommendations (top 12)
        query<{
          movie_id: string
          title: string
          year: number | null
          poster_url: string | null
          genres: string[]
          final_score: number | null
        }>(`
          SELECT 
            rc.movie_id,
            m.title,
            m.year,
            m.poster_url,
            m.genres,
            rc.final_score
          FROM recommendation_candidates rc
          JOIN recommendation_runs rr ON rr.id = rc.run_id
          JOIN movies m ON m.id = rc.movie_id
          WHERE rr.user_id = $1 
            AND rr.status = 'completed' 
            AND rr.media_type = 'movie'
            AND rc.is_selected = true
            AND rc.movie_id IS NOT NULL
          ORDER BY rr.created_at DESC, rc.selected_rank ASC
          LIMIT 12
        `, [user.id]),

        // Series recommendations (top 12)
        query<{
          series_id: string
          title: string
          year: number | null
          poster_url: string | null
          genres: string[]
          final_score: number | null
        }>(`
          SELECT 
            rc.series_id,
            s.title,
            s.year,
            s.poster_url,
            s.genres,
            rc.final_score
          FROM recommendation_candidates rc
          JOIN recommendation_runs rr ON rr.id = rc.run_id
          JOIN series s ON s.id = rc.series_id
          WHERE rr.user_id = $1 
            AND rr.status = 'completed' 
            AND rr.media_type = 'series'
            AND rc.is_selected = true
            AND rc.series_id IS NOT NULL
          ORDER BY rr.created_at DESC, rc.selected_rank ASC
          LIMIT 12
        `, [user.id]),

        // Top movies (top 12)
        query<{
          movie_id: string
          title: string
          year: number | null
          poster_url: string | null
          genres: string[]
          popularity_score: number
          rank: number
        }>(`
          WITH movie_popularity AS (
            SELECT 
              m.id as movie_id,
              m.title,
              m.year,
              m.poster_url,
              m.genres,
              COUNT(DISTINCT wh.user_id) as unique_viewers,
              SUM(wh.play_count) as play_count,
              ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT wh.user_id) DESC, SUM(wh.play_count) DESC) as rank
            FROM movies m
            JOIN watch_history wh ON wh.movie_id = m.id
            WHERE wh.last_played_at > NOW() - INTERVAL '30 days'
            GROUP BY m.id, m.title, m.year, m.poster_url, m.genres
            HAVING COUNT(DISTINCT wh.user_id) >= 1
          )
          SELECT 
            movie_id,
            title,
            year,
            poster_url,
            genres,
            (unique_viewers * 0.6 + play_count * 0.4)::float as popularity_score,
            rank::int
          FROM movie_popularity
          ORDER BY rank
          LIMIT 12
        `, []),

        // Top series (top 12)
        query<{
          series_id: string
          title: string
          year: number | null
          poster_url: string | null
          genres: string[]
          popularity_score: number
          rank: number
        }>(`
          WITH series_popularity AS (
            SELECT 
              s.id as series_id,
              s.title,
              s.year,
              s.poster_url,
              s.genres,
              COUNT(DISTINCT wh.user_id) as unique_viewers,
              SUM(wh.play_count) as play_count,
              ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT wh.user_id) DESC, SUM(wh.play_count) DESC) as rank
            FROM series s
            JOIN episodes e ON e.series_id = s.id
            JOIN watch_history wh ON wh.episode_id = e.id
            WHERE wh.last_played_at > NOW() - INTERVAL '30 days'
            GROUP BY s.id, s.title, s.year, s.poster_url, s.genres
            HAVING COUNT(DISTINCT wh.user_id) >= 1
          )
          SELECT 
            series_id,
            title,
            year,
            poster_url,
            genres,
            (unique_viewers * 0.6 + play_count * 0.4)::float as popularity_score,
            rank::int
          FROM series_popularity
          ORDER BY rank
          LIMIT 12
        `, []),

        // Recent movie watches (3)
        query<{
          movie_id: string
          title: string
          year: number | null
          poster_url: string | null
          last_played_at: Date
          play_count: number
        }>(`
          SELECT 
            m.id as movie_id,
            m.title,
            m.year,
            m.poster_url,
            wh.last_played_at,
            wh.play_count
          FROM watch_history wh
          JOIN movies m ON m.id = wh.movie_id
          WHERE wh.user_id = $1 AND wh.movie_id IS NOT NULL
          ORDER BY wh.last_played_at DESC
          LIMIT 3
        `, [user.id]),

        // Recent series watches (3)
        query<{
          series_id: string
          title: string
          year: number | null
          poster_url: string | null
          last_played_at: Date
          total_plays: number
        }>(`
          SELECT 
            s.id as series_id,
            s.title,
            s.year,
            s.poster_url,
            MAX(wh.last_played_at) as last_played_at,
            SUM(wh.play_count)::int as total_plays
          FROM watch_history wh
          JOIN episodes e ON e.id = wh.episode_id
          JOIN series s ON s.id = e.series_id
          WHERE wh.user_id = $1 AND wh.episode_id IS NOT NULL
          GROUP BY s.id, s.title, s.year, s.poster_url
          ORDER BY MAX(wh.last_played_at) DESC
          LIMIT 3
        `, [user.id]),

        // Recent ratings (5)
        query<{
          id: string
          movie_id: string | null
          series_id: string | null
          rating: number
          updated_at: Date
          title: string
          year: number | null
          poster_url: string | null
        }>(`
          (
            SELECT 
              ur.id,
              ur.movie_id,
              NULL::uuid as series_id,
              ur.rating,
              ur.updated_at,
              m.title,
              m.year,
              m.poster_url
            FROM user_ratings ur
            JOIN movies m ON m.id = ur.movie_id
            WHERE ur.user_id = $1 AND ur.movie_id IS NOT NULL
          )
          UNION ALL
          (
            SELECT 
              ur.id,
              NULL::uuid as movie_id,
              ur.series_id,
              ur.rating,
              ur.updated_at,
              s.title,
              s.year,
              s.poster_url
            FROM user_ratings ur
            JOIN series s ON s.id = ur.series_id
            WHERE ur.user_id = $1 AND ur.series_id IS NOT NULL
          )
          ORDER BY updated_at DESC
          LIMIT 5
        `, [user.id]),
      ])

      // Build stats
      const stats: DashboardStats = {
        moviesWatched: parseInt(statsResult?.movies_watched || '0', 10),
        seriesWatched: parseInt(statsResult?.series_watched || '0', 10),
        ratingsCount: parseInt(statsResult?.ratings_count || '0', 10),
        watchTimeMinutes: parseInt(statsResult?.watch_time_minutes || '0', 10),
      }

      // Build recommendations (interleave movies and series)
      const movieRecs = movieRecsResult.rows.map((r) => ({
        id: r.movie_id,
        type: 'movie' as const,
        title: r.title,
        year: r.year,
        posterUrl: r.poster_url,
        genres: r.genres || [],
        matchScore: r.final_score ? Math.round(r.final_score * 100) : null,
      }))
      const seriesRecs = seriesRecsResult.rows.map((r) => ({
        id: r.series_id,
        type: 'series' as const,
        title: r.title,
        year: r.year,
        posterUrl: r.poster_url,
        genres: r.genres || [],
        matchScore: r.final_score ? Math.round(r.final_score * 100) : null,
      }))
      // Interleave: movie, series, movie, series, ...
      const recommendations: DashboardRecommendation[] = []
      const maxLen = Math.max(movieRecs.length, seriesRecs.length)
      for (let i = 0; i < maxLen; i++) {
        if (movieRecs[i]) recommendations.push(movieRecs[i])
        if (seriesRecs[i]) recommendations.push(seriesRecs[i])
      }

      // Build top picks (interleave movies and series)
      const topMovies = topMoviesResult.rows.map((r) => ({
        id: r.movie_id,
        type: 'movie' as const,
        title: r.title,
        year: r.year,
        posterUrl: r.poster_url,
        genres: r.genres || [],
        rank: r.rank,
        popularityScore: r.popularity_score,
      }))
      const topSeries = topSeriesResult.rows.map((r) => ({
        id: r.series_id,
        type: 'series' as const,
        title: r.title,
        year: r.year,
        posterUrl: r.poster_url,
        genres: r.genres || [],
        rank: r.rank,
        popularityScore: r.popularity_score,
      }))
      const topPicks: DashboardTopPick[] = []
      const maxTopLen = Math.max(topMovies.length, topSeries.length)
      for (let i = 0; i < maxTopLen; i++) {
        if (topMovies[i]) topPicks.push(topMovies[i])
        if (topSeries[i]) topPicks.push(topSeries[i])
      }

      // Build recent watches (interleave and sort by date)
      const recentMovieWatches = recentMovieWatchesResult.rows.map((r) => ({
        id: r.movie_id,
        type: 'movie' as const,
        title: r.title,
        year: r.year,
        posterUrl: r.poster_url,
        lastWatched: r.last_played_at,
        playCount: r.play_count,
      }))
      const recentSeriesWatches = recentSeriesWatchesResult.rows.map((r) => ({
        id: r.series_id,
        type: 'series' as const,
        title: r.title,
        year: r.year,
        posterUrl: r.poster_url,
        lastWatched: r.last_played_at,
        playCount: r.total_plays,
      }))
      const recentWatches: DashboardRecentWatch[] = [
        ...recentMovieWatches,
        ...recentSeriesWatches,
      ].sort((a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime()).slice(0, 6)

      // Build recent ratings
      const recentRatings: DashboardRecentRating[] = recentRatingsResult.rows.map((r) => ({
        id: r.movie_id || r.series_id || r.id,
        type: r.movie_id ? 'movie' as const : 'series' as const,
        title: r.title,
        year: r.year,
        posterUrl: r.poster_url,
        rating: r.rating,
        ratedAt: r.updated_at,
      }))

      return reply.send({
        stats,
        recommendations,
        topPicks,
        recentWatches,
        recentRatings,
      })
    }
  )
}

export default dashboardRoutes

