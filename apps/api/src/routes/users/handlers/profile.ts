import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { 
  getTasteSynopsis, 
  getSeriesTasteSynopsis,
  getMediaServerProvider,
  getMediaServerConfig,
  getMediaServerApiKey
} from '@aperture/core'

export function registerProfileHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/:id/watch-history
   * Get user's watch history with pagination
   */
  fastify.get<{ 
    Params: { id: string }
    Querystring: { page?: string; pageSize?: string; sortBy?: string }
  }>(
    '/api/users/:id/watch-history',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
      const sortBy = request.query.sortBy || 'recent' // recent, plays, title

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Get total count (only from enabled libraries)
      const countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND lc.is_enabled = true`,
        [id]
      )
      const total = parseInt(countResult?.count || '0', 10)

      // Build ORDER BY clause
      let orderBy = 'wh.last_played_at DESC NULLS LAST'
      if (sortBy === 'plays') {
        orderBy = 'wh.play_count DESC, wh.last_played_at DESC NULLS LAST'
      } else if (sortBy === 'title') {
        orderBy = 'm.title ASC'
      }

      const offset = (page - 1) * pageSize

      const result = await query(
        `SELECT 
           wh.movie_id,
           wh.play_count,
           wh.is_favorite,
           wh.last_played_at,
           m.title,
           m.year,
           m.poster_url,
           m.genres,
           m.community_rating,
           m.overview
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND lc.is_enabled = true
         ORDER BY ${orderBy}
         LIMIT $2 OFFSET $3`,
        [id, pageSize, offset]
      )

      return reply.send({ 
        history: result.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      })
    }
  )

  /**
   * GET /api/users/:id/series-watch-history
   * Get user's series watch history with pagination (grouped by series)
   */
  fastify.get<{ 
    Params: { id: string }
    Querystring: { page?: string; pageSize?: string; sortBy?: string }
  }>(
    '/api/users/:id/series-watch-history',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
      const sortBy = request.query.sortBy || 'recent' // recent, plays, title

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Get total count of distinct series watched (only from enabled libraries)
      const countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(DISTINCT s.id) as count 
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.episode_id
         JOIN series s ON s.id = e.series_id
         LEFT JOIN library_config lc ON lc.provider_library_id = s.provider_library_id
         WHERE wh.user_id = $1 
           AND wh.episode_id IS NOT NULL
           AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)`,
        [id]
      )
      const total = parseInt(countResult?.count || '0', 10)

      // Build ORDER BY clause
      let orderBy = 'MAX(wh.last_played_at) DESC NULLS LAST'
      if (sortBy === 'plays') {
        orderBy = 'SUM(wh.play_count) DESC, MAX(wh.last_played_at) DESC NULLS LAST'
      } else if (sortBy === 'title') {
        orderBy = 's.title ASC'
      }

      const offset = (page - 1) * pageSize

      // Group by series to get aggregate watch data
      const result = await query(
        `SELECT 
           s.id as series_id,
           s.title,
           s.year,
           s.poster_url,
           s.genres,
           s.community_rating,
           s.overview,
           COUNT(DISTINCT e.id) as episodes_watched,
           (SELECT COUNT(*) FROM episodes WHERE series_id = s.id) as total_episodes,
           SUM(wh.play_count)::int as total_plays,
           MAX(wh.last_played_at) as last_played_at,
           BOOL_OR(wh.is_favorite) as is_favorite
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.episode_id
         JOIN series s ON s.id = e.series_id
         LEFT JOIN library_config lc ON lc.provider_library_id = s.provider_library_id
         WHERE wh.user_id = $1 
           AND wh.episode_id IS NOT NULL
           AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)
         GROUP BY s.id, s.title, s.year, s.poster_url, s.genres, s.community_rating, s.overview
         ORDER BY ${orderBy}
         LIMIT $2 OFFSET $3`,
        [id, pageSize, offset]
      )

      return reply.send({ 
        history: result.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      })
    }
  )

  /**
   * GET /api/users/:id/preferences
   * Get user's preferences
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/preferences',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const prefs = await queryOne(
        `SELECT * FROM user_preferences WHERE user_id = $1`,
        [id]
      )

      return reply.send({ preferences: prefs || null })
    }
  )

  /**
   * GET /api/users/:id/stats
   * Get user's stats (watched count, favorites, recommendations)
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Get watched count (from enabled libraries only)
      const watchedResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND lc.is_enabled = true`,
        [id]
      )

      // Get favorites count (from enabled libraries only)
      const favoritesResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND wh.is_favorite = true AND lc.is_enabled = true`,
        [id]
      )

      // Get recommendations count from latest run
      const recsResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM recommendation_candidates rc
         JOIN recommendation_runs rr ON rr.id = rc.run_id
         JOIN movies m ON m.id = rc.movie_id
         LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE rr.user_id = $1 
           AND rc.is_selected = true
           AND rr.id = (SELECT id FROM recommendation_runs WHERE user_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1)
           AND (
             NOT EXISTS (SELECT 1 FROM library_config)
             OR lc.is_enabled = true
             OR m.provider_library_id IS NULL
           )`,
        [id]
      )

      return reply.send({
        watchedCount: parseInt(watchedResult?.count || '0', 10),
        favoritesCount: parseInt(favoritesResult?.count || '0', 10),
        recommendationsCount: parseInt(recsResult?.count || '0', 10),
      })
    }
  )

  /**
   * GET /api/users/:id/taste-profile
   * Get user's AI-generated taste synopsis
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/taste-profile',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Users can only get their own taste profile unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const profile = await getTasteSynopsis(id)
        return reply.send(profile)
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get taste profile')
        return reply.status(500).send({ error: 'Failed to generate taste profile' })
      }
    }
  )

  /**
   * POST /api/users/:id/taste-profile/regenerate
   * Force regenerate user's taste synopsis (streaming)
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/taste-profile/regenerate',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Users can only regenerate their own taste profile unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const { streamTasteSynopsis } = await import('@aperture/core')
        
        // Set up SSE headers for streaming
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        const generator = streamTasteSynopsis(id)
        let stats = null

        // Stream text chunks
        for await (const chunk of generator) {
          if (typeof chunk === 'string') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`)
          }
        }

        // Get the final return value (stats)
        const result = await generator.next()
        if (result.value) {
          stats = result.value
        }

        // Send completion event with stats
        reply.raw.write(`data: ${JSON.stringify({ type: 'done', stats })}\n\n`)
        reply.raw.end()
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to regenerate taste profile')
        // If headers already sent, just end the stream
        if (reply.raw.headersSent) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate' })}\n\n`)
          reply.raw.end()
        } else {
          return reply.status(500).send({ error: 'Failed to regenerate taste profile' })
        }
      }
    }
  )

  // =========================================================================
  // Series Taste Profile
  // =========================================================================

  /**
   * GET /api/users/:id/series-taste-profile
   * Get user's AI-generated series taste synopsis
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/series-taste-profile',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Users can only get their own taste profile unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const profile = await getSeriesTasteSynopsis(id)
        return reply.send(profile)
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get series taste profile')
        return reply.status(500).send({ error: 'Failed to generate series taste profile' })
      }
    }
  )

  /**
   * POST /api/users/:id/series-taste-profile/regenerate
   * Force regenerate user's series taste synopsis (streaming)
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/series-taste-profile/regenerate',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Users can only regenerate their own taste profile unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const { streamSeriesTasteSynopsis } = await import('@aperture/core')
        
        // Set up SSE headers for streaming
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        const generator = streamSeriesTasteSynopsis(id)
        let stats = null

        // Stream text chunks
        for await (const chunk of generator) {
          if (typeof chunk === 'string') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`)
          }
        }

        // Get the final return value (stats)
        const result = await generator.next()
        if (result.value) {
          stats = result.value
        }

        // Send completion event with stats
        reply.raw.write(`data: ${JSON.stringify({ type: 'done', stats })}\n\n`)
        reply.raw.end()
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to regenerate series taste profile')
        // If headers already sent, just end the stream
        if (reply.raw.headersSent) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate' })}\n\n`)
          reply.raw.end()
        } else {
          return reply.status(500).send({ error: 'Failed to regenerate series taste profile' })
        }
      }
    }
  )

  // =========================================================================
  // Watch Statistics
  // =========================================================================

  /**
   * GET /api/users/:id/watch-stats
   * Get comprehensive watch statistics for visualizations
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/watch-stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        // Genre distribution for movies
        const genreResult = await query<{ genre: string; count: string }>(
          `WITH watched_movies AS (
             SELECT m.genres
             FROM watch_history wh
             JOIN movies m ON m.id = wh.movie_id
             LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
             WHERE wh.user_id = $1 
               AND wh.movie_id IS NOT NULL
               AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)
           )
           SELECT g.genre, COUNT(*) as count
           FROM watched_movies wm, unnest(wm.genres) as g(genre)
           GROUP BY g.genre
           ORDER BY count DESC
           LIMIT 15`,
          [id]
        )

        const totalGenreCount = genreResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0)
        const genreDistribution = genreResult.rows.map(r => ({
          genre: r.genre,
          count: parseInt(r.count),
          percentage: totalGenreCount > 0 ? Math.round((parseInt(r.count) / totalGenreCount) * 100) : 0
        }))

        // Watch timeline (monthly activity for last 12 months)
        const timelineResult = await query<{ month: string; movies: string; episodes: string }>(
          `WITH months AS (
             SELECT generate_series(
               date_trunc('month', NOW() - INTERVAL '11 months'),
               date_trunc('month', NOW()),
               '1 month'::interval
             ) as month
           ),
           movie_counts AS (
             SELECT date_trunc('month', wh.last_played_at) as month, COUNT(*) as count
             FROM watch_history wh
             JOIN movies m ON m.id = wh.movie_id
             LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
             WHERE wh.user_id = $1 
               AND wh.movie_id IS NOT NULL
               AND wh.last_played_at >= NOW() - INTERVAL '12 months'
               AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)
             GROUP BY date_trunc('month', wh.last_played_at)
           ),
           episode_counts AS (
             SELECT date_trunc('month', wh.last_played_at) as month, COUNT(*) as count
             FROM watch_history wh
             WHERE wh.user_id = $1 
               AND wh.episode_id IS NOT NULL
               AND wh.last_played_at >= NOW() - INTERVAL '12 months'
             GROUP BY date_trunc('month', wh.last_played_at)
           )
           SELECT 
             to_char(m.month, 'Mon YYYY') as month,
             COALESCE(mc.count, 0) as movies,
             COALESCE(ec.count, 0) as episodes
           FROM months m
           LEFT JOIN movie_counts mc ON mc.month = m.month
           LEFT JOIN episode_counts ec ON ec.month = m.month
           ORDER BY m.month ASC`,
          [id]
        )

        const watchTimeline = timelineResult.rows.map(r => ({
          month: r.month,
          movies: parseInt(r.movies),
          episodes: parseInt(r.episodes)
        }))

        // Decade distribution
        const decadeResult = await query<{ decade: string; count: string }>(
          `SELECT 
             CONCAT(FLOOR(m.year / 10) * 10, 's') as decade,
             COUNT(*) as count
           FROM watch_history wh
           JOIN movies m ON m.id = wh.movie_id
           LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
           WHERE wh.user_id = $1 
             AND wh.movie_id IS NOT NULL
             AND m.year IS NOT NULL
             AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)
           GROUP BY FLOOR(m.year / 10) * 10
           ORDER BY FLOOR(m.year / 10) * 10 DESC`,
          [id]
        )

        const decadeDistribution = decadeResult.rows.map(r => ({
          decade: r.decade,
          count: parseInt(r.count)
        }))

        // Rating distribution (rounded to nearest 0.5)
        const ratingResult = await query<{ rating: string; count: string }>(
          `SELECT 
             ROUND(m.community_rating * 2) / 2 as rating,
             COUNT(*) as count
           FROM watch_history wh
           JOIN movies m ON m.id = wh.movie_id
           LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
           WHERE wh.user_id = $1 
             AND wh.movie_id IS NOT NULL
             AND m.community_rating IS NOT NULL
             AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)
           GROUP BY ROUND(m.community_rating * 2) / 2
           ORDER BY rating ASC`,
          [id]
        )

        const ratingDistribution = ratingResult.rows.map(r => ({
          rating: parseFloat(r.rating).toFixed(1),
          count: parseInt(r.count)
        }))

        // Totals
        const totalsResult = await queryOne<{ 
          total_movies: string
          total_episodes: string
          total_runtime: string
          total_plays: string
          favorites: string
        }>(
          `SELECT 
             (SELECT COUNT(*) FROM watch_history wh
              JOIN movies m ON m.id = wh.movie_id
              LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
              WHERE wh.user_id = $1 AND wh.movie_id IS NOT NULL
                AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)) as total_movies,
             (SELECT COUNT(*) FROM watch_history wh
              WHERE wh.user_id = $1 AND wh.episode_id IS NOT NULL) as total_episodes,
             (SELECT COALESCE(SUM(m.runtime_minutes), 0) FROM watch_history wh
              JOIN movies m ON m.id = wh.movie_id
              LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
              WHERE wh.user_id = $1 AND wh.movie_id IS NOT NULL
                AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)) as total_runtime,
             (SELECT COALESCE(SUM(wh.play_count), 0) FROM watch_history wh
              JOIN movies m ON m.id = wh.movie_id
              LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
              WHERE wh.user_id = $1 AND wh.movie_id IS NOT NULL
                AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)) as total_plays,
             (SELECT COUNT(*) FROM watch_history wh
              JOIN movies m ON m.id = wh.movie_id
              LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
              WHERE wh.user_id = $1 AND wh.is_favorite = true AND wh.movie_id IS NOT NULL
                AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)) as favorites`,
          [id]
        )

        // Top actors (from JSONB actors column) - with thumbnails
        // Get media server base URL for constructing person image URLs
        const { getMediaServerConfig } = await import('@aperture/core')
        const mediaServerConfig = await getMediaServerConfig()
        const mediaServerBaseUrl = mediaServerConfig.baseUrl || ''

        const actorsResult = await query<{ name: string; count: string }>(
          `WITH watched_movies AS (
             SELECT m.actors
             FROM watch_history wh
             JOIN movies m ON m.id = wh.movie_id
             LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
             WHERE wh.user_id = $1 
               AND wh.movie_id IS NOT NULL
               AND m.actors IS NOT NULL 
               AND jsonb_array_length(m.actors) > 0
               AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)
           )
           SELECT actor->>'name' as name, COUNT(*) as count
           FROM watched_movies wm, jsonb_array_elements(wm.actors) as actor
           WHERE actor->>'name' IS NOT NULL AND actor->>'name' != ''
           GROUP BY actor->>'name'
           ORDER BY count DESC
           LIMIT 10`,
          [id]
        )

        // Construct person image URLs using Emby/Jellyfin API format: /Persons/{Name}/Images/Primary
        const topActors = actorsResult.rows.map(r => ({
          name: r.name,
          thumb: mediaServerBaseUrl 
            ? `${mediaServerBaseUrl}/Persons/${encodeURIComponent(r.name)}/Images/Primary`
            : null,
          count: parseInt(r.count)
        }))

        // Top directors
        const directorsResult = await query<{ name: string; count: string }>(
          `WITH watched_movies AS (
             SELECT m.directors
             FROM watch_history wh
             JOIN movies m ON m.id = wh.movie_id
             LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
             WHERE wh.user_id = $1 
               AND wh.movie_id IS NOT NULL
               AND m.directors IS NOT NULL 
               AND array_length(m.directors, 1) > 0
               AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)
           )
           SELECT d.name, COUNT(*) as count
           FROM watched_movies wm, unnest(wm.directors) as d(name)
           GROUP BY d.name
           ORDER BY count DESC
           LIMIT 10`,
          [id]
        )

        // Construct person image URLs for directors using Emby/Jellyfin API format
        const topDirectors = directorsResult.rows.map(r => ({
          name: r.name,
          thumb: mediaServerBaseUrl 
            ? `${mediaServerBaseUrl}/Persons/${encodeURIComponent(r.name)}/Images/Primary`
            : null,
          count: parseInt(r.count)
        }))

        // Top studios (from movies) - studios is now JSONB with {id, name}
        // Joins with studios_networks table to get TMDB logo data
        const studiosResult = await query<{ 
          id: string | null
          name: string
          count: string
          logo_path: string | null
          logo_local_path: string | null
        }>(
          `WITH watched_movies AS (
             SELECT m.studios
             FROM watch_history wh
             JOIN movies m ON m.id = wh.movie_id
             LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
             WHERE wh.user_id = $1 
               AND wh.movie_id IS NOT NULL
               AND m.studios IS NOT NULL 
               AND jsonb_array_length(m.studios) > 0
               AND (NOT EXISTS (SELECT 1 FROM library_config) OR lc.is_enabled = true)
           ),
           all_studios AS (
             SELECT jsonb_array_elements(wm.studios) as studio_obj
             FROM watched_movies wm
           ),
           studio_counts AS (
             SELECT 
               studio_obj->>'id' as id,
               studio_obj->>'name' as name,
               COUNT(*) as count
             FROM all_studios
             WHERE studio_obj->>'name' IS NOT NULL
             GROUP BY studio_obj->>'id', studio_obj->>'name'
             ORDER BY count DESC
             LIMIT 10
           )
           SELECT 
             sc.id,
             sc.name,
             sc.count,
             sn.logo_path,
             sn.logo_local_path
           FROM studio_counts sc
           LEFT JOIN studios_networks sn ON sn.name = sc.name AND sn.type = 'studio'
           ORDER BY sc.count DESC`,
          [id]
        )

        // Construct studio image URLs - prefer local path, then TMDB, then Emby
        const topStudios = studiosResult.rows.map(r => {
          let thumb: string | null = null
          if (r.logo_local_path) {
            // Use local uploaded logo
            thumb = `/api/uploads/${r.logo_local_path}`
          } else if (r.logo_path) {
            // Use TMDB logo directly
            thumb = `https://image.tmdb.org/t/p/w185${r.logo_path}`
          } else if (mediaServerBaseUrl && r.id) {
            // Fall back to Emby/Jellyfin
            thumb = `${mediaServerBaseUrl}/Items/${r.id}/Images/Thumb`
          }
          return {
            name: r.name,
            thumb,
            count: parseInt(r.count)
          }
        })

        // Top networks (from series) - get the first studio ID matching the network name
        // Joins with studios_networks table to get TMDB logo data
        const networksResult = await query<{ 
          id: string | null
          name: string
          count: string
          logo_path: string | null
          logo_local_path: string | null
        }>(
          `WITH network_data AS (
             SELECT DISTINCT 
               s.id as series_id,
               s.network as name,
               -- Get the ID of the first studio that matches the network name
               (SELECT studio->>'id' 
                FROM jsonb_array_elements(s.studios) AS studio 
                WHERE studio->>'name' = s.network 
                LIMIT 1) as network_id
             FROM watch_history wh
             JOIN episodes e ON e.id = wh.episode_id
             JOIN series s ON s.id = e.series_id
             WHERE wh.user_id = $1 
               AND wh.episode_id IS NOT NULL
               AND s.network IS NOT NULL
               AND s.network != ''
           ),
           network_counts AS (
             SELECT 
               name,
               MAX(network_id) as id,
               COUNT(DISTINCT series_id) as count
             FROM network_data
             GROUP BY name
             ORDER BY count DESC
             LIMIT 10
           )
           SELECT 
             nc.id,
             nc.name,
             nc.count,
             sn.logo_path,
             sn.logo_local_path
           FROM network_counts nc
           LEFT JOIN studios_networks sn ON sn.name = nc.name AND sn.type = 'network'
           ORDER BY nc.count DESC`,
          [id]
        )

        // Construct network image URLs - prefer local path, then TMDB, then Emby
        const topNetworks = networksResult.rows.map(r => {
          let thumb: string | null = null
          if (r.logo_local_path) {
            // Use local uploaded logo
            thumb = `/api/uploads/${r.logo_local_path}`
          } else if (r.logo_path) {
            // Use TMDB logo directly
            thumb = `https://image.tmdb.org/t/p/w185${r.logo_path}`
          } else if (mediaServerBaseUrl && r.id) {
            // Fall back to Emby/Jellyfin
            thumb = `${mediaServerBaseUrl}/Items/${r.id}/Images/Thumb`
          }
          return {
            name: r.name,
            thumb,
            count: parseInt(r.count)
          }
        })

        // Series genre distribution for comparison
        const seriesGenreResult = await query<{ genre: string; count: string }>(
          `WITH watched_series AS (
             SELECT DISTINCT s.id, s.genres
             FROM watch_history wh
             JOIN episodes e ON e.id = wh.episode_id
             JOIN series s ON s.id = e.series_id
             WHERE wh.user_id = $1 
               AND wh.episode_id IS NOT NULL
           )
           SELECT g.genre, COUNT(*) as count
           FROM watched_series ws, unnest(ws.genres) as g(genre)
           GROUP BY g.genre
           ORDER BY count DESC
           LIMIT 10`,
          [id]
        )

        const seriesGenreDistribution = seriesGenreResult.rows.map(r => ({
          genre: r.genre,
          count: parseInt(r.count)
        }))

        // Unique series watched
        const uniqueSeriesResult = await queryOne<{ count: string }>(
          `SELECT COUNT(DISTINCT e.series_id) as count
           FROM watch_history wh
           JOIN episodes e ON e.id = wh.episode_id
           WHERE wh.user_id = $1 AND wh.episode_id IS NOT NULL`,
          [id]
        )

        return reply.send({
          genreDistribution,
          watchTimeline,
          decadeDistribution,
          ratingDistribution,
          totalMovies: parseInt(totalsResult?.total_movies || '0'),
          totalEpisodes: parseInt(totalsResult?.total_episodes || '0'),
          totalWatchTimeMinutes: parseInt(totalsResult?.total_runtime || '0'),
          totalPlays: parseInt(totalsResult?.total_plays || '0'),
          totalFavorites: parseInt(totalsResult?.favorites || '0'),
          totalSeries: parseInt(uniqueSeriesResult?.count || '0'),
          topActors,
          topDirectors,
          topStudios,
          topNetworks,
          seriesGenreDistribution
        })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get watch stats')
        return reply.status(500).send({ error: 'Failed to get watch statistics' })
      }
    }
  )

  // ============================================================
  // Watch History Management - Mark items as unwatched
  // ============================================================

  /**
   * Helper to check if user can manage watch history
   */
  async function canManageWatchHistory(userId: string, currentUser: SessionUser): Promise<boolean> {
    // Admins can always manage watch history
    if (currentUser.isAdmin) return true
    
    // Check if user has the permission enabled
    const user = await queryOne<{ can_manage_watch_history: boolean }>(
      `SELECT can_manage_watch_history FROM users WHERE id = $1`,
      [userId]
    )
    return user?.can_manage_watch_history ?? false
  }

  /**
   * DELETE /api/users/:id/watch-history/movies/:movieId
   * Mark a movie as unwatched (removes from Emby and Aperture)
   */
  fastify.delete<{ 
    Params: { id: string; movieId: string }
  }>(
    '/api/users/:id/watch-history/movies/:movieId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, movieId } = request.params
      const currentUser = request.user as SessionUser

      // Check ownership or admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Check permission
      if (!(await canManageWatchHistory(id, currentUser))) {
        return reply.status(403).send({ error: 'Watch history management is not enabled for this user' })
      }

      try {
        // Get movie's provider_item_id and user's provider_user_id
        const movie = await queryOne<{ provider_item_id: string }>(
          `SELECT provider_item_id FROM movies WHERE id = $1`,
          [movieId]
        )
        if (!movie) {
          return reply.status(404).send({ error: 'Movie not found' })
        }

        const user = await queryOne<{ provider_user_id: string }>(
          `SELECT provider_user_id FROM users WHERE id = $1`,
          [id]
        )
        if (!user?.provider_user_id) {
          return reply.status(400).send({ error: 'User has no media server association' })
        }

        // Mark as unplayed in media server
        const provider = await getMediaServerProvider()
        const apiKey = await getMediaServerApiKey()

        if (!apiKey) {
          return reply.status(500).send({ error: 'Media server API key not configured' })
        }

        await provider.markMovieUnplayed(apiKey, user.provider_user_id, movie.provider_item_id)

        // Remove from Aperture database
        await query(
          `DELETE FROM watch_history WHERE user_id = $1 AND movie_id = $2`,
          [id, movieId]
        )

        fastify.log.info({ userId: id, movieId }, 'Movie marked as unwatched')
        return reply.send({ success: true, message: 'Movie marked as unwatched' })
      } catch (error) {
        fastify.log.error({ error, userId: id, movieId }, 'Failed to mark movie as unwatched')
        return reply.status(500).send({ error: 'Failed to mark movie as unwatched' })
      }
    }
  )

  /**
   * DELETE /api/users/:id/watch-history/episodes/:episodeId
   * Mark a single episode as unwatched
   */
  fastify.delete<{ 
    Params: { id: string; episodeId: string }
  }>(
    '/api/users/:id/watch-history/episodes/:episodeId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, episodeId } = request.params
      const currentUser = request.user as SessionUser

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (!(await canManageWatchHistory(id, currentUser))) {
        return reply.status(403).send({ error: 'Watch history management is not enabled for this user' })
      }

      try {
        const episode = await queryOne<{ provider_item_id: string }>(
          `SELECT provider_item_id FROM episodes WHERE id = $1`,
          [episodeId]
        )
        if (!episode) {
          return reply.status(404).send({ error: 'Episode not found' })
        }

        const user = await queryOne<{ provider_user_id: string }>(
          `SELECT provider_user_id FROM users WHERE id = $1`,
          [id]
        )
        if (!user?.provider_user_id) {
          return reply.status(400).send({ error: 'User has no media server association' })
        }

        const provider = await getMediaServerProvider()
        const apiKey = await getMediaServerApiKey()

        if (!apiKey) {
          return reply.status(500).send({ error: 'Media server API key not configured' })
        }

        await provider.markEpisodeUnplayed(apiKey, user.provider_user_id, episode.provider_item_id)

        await query(
          `DELETE FROM watch_history WHERE user_id = $1 AND episode_id = $2`,
          [id, episodeId]
        )

        fastify.log.info({ userId: id, episodeId }, 'Episode marked as unwatched')
        return reply.send({ success: true, message: 'Episode marked as unwatched' })
      } catch (error) {
        fastify.log.error({ error, userId: id, episodeId }, 'Failed to mark episode as unwatched')
        return reply.status(500).send({ error: 'Failed to mark episode as unwatched' })
      }
    }
  )

  /**
   * DELETE /api/users/:id/watch-history/series/:seriesId/seasons/:seasonNumber
   * Mark all episodes in a season as unwatched
   */
  fastify.delete<{ 
    Params: { id: string; seriesId: string; seasonNumber: string }
  }>(
    '/api/users/:id/watch-history/series/:seriesId/seasons/:seasonNumber',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, seriesId, seasonNumber } = request.params
      const currentUser = request.user as SessionUser

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (!(await canManageWatchHistory(id, currentUser))) {
        return reply.status(403).send({ error: 'Watch history management is not enabled for this user' })
      }

      try {
        const series = await queryOne<{ provider_item_id: string }>(
          `SELECT provider_item_id FROM series WHERE id = $1`,
          [seriesId]
        )
        if (!series) {
          return reply.status(404).send({ error: 'Series not found' })
        }

        const user = await queryOne<{ provider_user_id: string }>(
          `SELECT provider_user_id FROM users WHERE id = $1`,
          [id]
        )
        if (!user?.provider_user_id) {
          return reply.status(400).send({ error: 'User has no media server association' })
        }

        const provider = await getMediaServerProvider()
        const apiKey = await getMediaServerApiKey()

        if (!apiKey) {
          return reply.status(500).send({ error: 'Media server API key not configured' })
        }

        const { markedCount } = await provider.markSeasonUnplayed(
          apiKey,
          user.provider_user_id,
          series.provider_item_id,
          parseInt(seasonNumber)
        )

        // Remove all episodes from this season from watch history
        await query(
          `DELETE FROM watch_history 
           WHERE user_id = $1 
             AND episode_id IN (
               SELECT id FROM episodes 
               WHERE series_id = $2 AND season_number = $3
             )`,
          [id, seriesId, parseInt(seasonNumber)]
        )

        fastify.log.info({ userId: id, seriesId, seasonNumber, markedCount }, 'Season marked as unwatched')
        return reply.send({ success: true, message: `${markedCount} episodes marked as unwatched` })
      } catch (error) {
        fastify.log.error({ error, userId: id, seriesId, seasonNumber }, 'Failed to mark season as unwatched')
        return reply.status(500).send({ error: 'Failed to mark season as unwatched' })
      }
    }
  )

  /**
   * DELETE /api/users/:id/watch-history/series/:seriesId
   * Mark all episodes in a series as unwatched
   */
  fastify.delete<{ 
    Params: { id: string; seriesId: string }
  }>(
    '/api/users/:id/watch-history/series/:seriesId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, seriesId } = request.params
      const currentUser = request.user as SessionUser

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (!(await canManageWatchHistory(id, currentUser))) {
        return reply.status(403).send({ error: 'Watch history management is not enabled for this user' })
      }

      try {
        const series = await queryOne<{ provider_item_id: string }>(
          `SELECT provider_item_id FROM series WHERE id = $1`,
          [seriesId]
        )
        if (!series) {
          return reply.status(404).send({ error: 'Series not found' })
        }

        const user = await queryOne<{ provider_user_id: string }>(
          `SELECT provider_user_id FROM users WHERE id = $1`,
          [id]
        )
        if (!user?.provider_user_id) {
          return reply.status(400).send({ error: 'User has no media server association' })
        }

        const provider = await getMediaServerProvider()
        const apiKey = await getMediaServerApiKey()

        if (!apiKey) {
          return reply.status(500).send({ error: 'Media server API key not configured' })
        }

        const { markedCount } = await provider.markSeriesUnplayed(
          apiKey,
          user.provider_user_id,
          series.provider_item_id
        )

        // Remove all episodes of this series from watch history
        await query(
          `DELETE FROM watch_history 
           WHERE user_id = $1 
             AND episode_id IN (SELECT id FROM episodes WHERE series_id = $2)`,
          [id, seriesId]
        )

        fastify.log.info({ userId: id, seriesId, markedCount }, 'Series marked as unwatched')
        return reply.send({ success: true, message: `${markedCount} episodes marked as unwatched` })
      } catch (error) {
        fastify.log.error({ error, userId: id, seriesId }, 'Failed to mark series as unwatched')
        return reply.status(500).send({ error: 'Failed to mark series as unwatched' })
      }
    }
  )

  // ============================================================================
  // Library Exclusions
  // ============================================================================

  /**
   * GET /api/users/:id/accessible-libraries
   * Get libraries accessible to the user (excluding Aperture-created ones)
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/accessible-libraries',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Users can only access their own settings unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const { getUserAccessibleLibraries } = await import('@aperture/core')
        const libraries = await getUserAccessibleLibraries(id)
        return reply.send({ libraries })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get accessible libraries')
        return reply.status(500).send({ error: 'Failed to get accessible libraries' })
      }
    }
  )

  /**
   * PUT /api/users/:id/excluded-libraries
   * Set the libraries to exclude from watch history
   */
  fastify.put<{
    Params: { id: string }
    Body: { excludedLibraryIds: string[] }
  }>(
    '/api/users/:id/excluded-libraries',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const { excludedLibraryIds } = request.body
      const currentUser = request.user as SessionUser

      // Users can only modify their own settings unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (!Array.isArray(excludedLibraryIds)) {
        return reply.status(400).send({ error: 'excludedLibraryIds must be an array' })
      }

      try {
        const { setUserExcludedLibraries } = await import('@aperture/core')
        await setUserExcludedLibraries(id, excludedLibraryIds)
        return reply.send({ success: true })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to set excluded libraries')
        return reply.status(500).send({ error: 'Failed to set excluded libraries' })
      }
    }
  )

  /**
   * PATCH /api/users/:id/excluded-libraries/:libraryId
   * Toggle a single library's exclusion status
   */
  fastify.patch<{
    Params: { id: string; libraryId: string }
    Body: { excluded: boolean }
  }>(
    '/api/users/:id/excluded-libraries/:libraryId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, libraryId } = request.params
      const { excluded } = request.body
      const currentUser = request.user as SessionUser

      // Users can only modify their own settings unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (typeof excluded !== 'boolean') {
        return reply.status(400).send({ error: 'excluded must be a boolean' })
      }

      try {
        const { toggleLibraryExclusion } = await import('@aperture/core')
        await toggleLibraryExclusion(id, libraryId, excluded)
        return reply.send({ success: true, libraryId, excluded })
      } catch (error) {
        fastify.log.error({ error, userId: id, libraryId }, 'Failed to toggle library exclusion')
        return reply.status(500).send({ error: 'Failed to toggle library exclusion' })
      }
    }
  )
}

