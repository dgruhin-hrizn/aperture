import type { FastifyInstance } from 'fastify'
import {
  addEmbyHomePin,
  EmbyHomeConflict,
  EmbyProvider,
  getEmbyHomeSections,
  getMediaServerConfig,
  removeEmbyHomePin,
} from '@aperture/core'
import { query, queryOne, transaction } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'

const endpoint = '/api/recommendations/me/emby-home'

async function getContext(userId: string) {
  const config = await getMediaServerConfig()
  if (config.type !== 'emby' || !config.baseUrl || !config.apiKey) return null
  const owner = await queryOne<{ provider_user_id: string; provider_access_token: string | null }>(
    "SELECT provider_user_id, provider_access_token FROM users WHERE id = $1 AND provider = 'emby' AND NOT provider_disabled",
    [userId]
  )
  if (!owner) return null
  if (!owner.provider_access_token) throw new EmbyHomeConflict('Sign in to Aperture with Emby to manage your Emby Home.')
  const provider = new EmbyProvider(config.baseUrl)
  const { Id: serverId } = await provider.fetch<{ Id: string }>('/System/Info/Public', '')
  if (!serverId) throw new Error('Emby server ID is unavailable')
  return { provider, apiKey: config.apiKey, serverId, userId: owner.provider_user_id, token: owner.provider_access_token }
}

export async function registerEmbyHomeHandlers(fastify: FastifyInstance) {
  fastify.get(endpoint, { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Sign in to Aperture first.' })
    try {
      const { id } = request.user
      const hasOutputs = await queryOne(
        `SELECT 1 FROM emby_recommendation_playlists WHERE user_id = $1
         UNION ALL SELECT 1 FROM emby_home_pins WHERE user_id = $1 LIMIT 1`, [id]
      )
      if (!hasOutputs) return { shelves: [] }
      const context = await getContext(id)
      if (!context) return { shelves: [] }
      const { provider, token, serverId, userId } = context
      const home = await getEmbyHomeSections(provider, token, userId)
      const { rows } = await query<{ playlist_id: string; name: string; section_id: string | null; managed: boolean }>(
        `WITH pins AS (
           SELECT * FROM emby_home_pins WHERE user_id = $1 AND server_id = $2 AND provider_user_id = $3
         )
         SELECT COALESCE(p.provider_playlist_id, pins.playlist_id) AS playlist_id,
                COALESCE(p.name, pins.name) AS name, pins.section_id, p.provider_playlist_id IS NOT NULL AS managed
         FROM (SELECT * FROM emby_recommendation_playlists WHERE user_id = $1) p
         FULL JOIN pins ON pins.playlist_id = p.provider_playlist_id
         ORDER BY name`,
        [id, serverId, userId]
      )
      const shelves = rows.flatMap((row) => {
        const sections = home.filter((section) => section.SectionType === 'playlist' && section.ParentId === row.playlist_id)
        const pinned = sections.some((section) => section.Id === row.section_id)
        return pinned || row.managed
          ? [{ playlistId: row.playlist_id, name: row.name, pinned, canPin: row.managed && !sections.length }]
          : []
      })
      return { shelves }
    } catch (err) {
      if (err instanceof EmbyHomeConflict) return reply.code(409).send({ error: err.message })
      request.log.warn({ err }, 'Could not load Emby Home shelves')
      return reply.code(502).send({ error: 'Could not read Emby Home. Verify the server supports home sections and your Emby session is active.' })
    }
  })

  const schema = {
    params: {
      type: 'object' as const,
      required: ['playlistId'],
      properties: { playlistId: { type: 'string' as const, minLength: 1, maxLength: 100 } },
    },
  }

  for (const method of ['PUT', 'DELETE'] as const) {
    fastify.route<{ Params: { playlistId: string } }>({
      method,
      url: `${endpoint}/:playlistId`,
      preHandler: requireAuth,
      schema,
      handler: async (request, reply) => {
        if (!request.user) return reply.code(401).send({ error: 'Sign in to Aperture first.' })
        const id = request.user.id
        const { playlistId } = request.params
        try {
          const context = await getContext(id)
          if (!context) return reply.code(409).send({ error: 'Emby Home requires an Emby account.' })
          const { provider, apiKey, token, serverId, userId } = context
          await transaction(async (client) => {
            await client.query("SELECT pg_advisory_xact_lock(hashtextextended('emby-home:' || $1, 0))", [id])
            const key = [id, serverId, userId, playlistId]
            const { rows: [pin] } = await client.query<{ section_id: string }>(
              'SELECT section_id FROM emby_home_pins WHERE user_id = $1 AND server_id = $2 AND provider_user_id = $3 AND playlist_id = $4', key
            )
            if (method === 'DELETE') {
              if (!pin) return
              await removeEmbyHomePin(provider, token, userId, playlistId, pin.section_id)
              await client.query(
                'DELETE FROM emby_home_pins WHERE user_id = $1 AND server_id = $2 AND provider_user_id = $3 AND playlist_id = $4', key
              )
              return
            }
            const { rows: [playlist] } = await client.query<{ name: string }>(
              'SELECT name FROM emby_recommendation_playlists WHERE user_id = $1 AND provider_playlist_id = $2',
              [id, playlistId]
            )
            if (!playlist) throw new EmbyHomeConflict('Only your Aperture-managed playlists can be pinned.')
            if (pin) {
              const home = await getEmbyHomeSections(provider, token, userId)
              const section = home.find((row) => row.Id === pin.section_id)
              if (section) {
                if (section.SectionType === 'playlist' && section.ParentId === playlistId) return
                throw new EmbyHomeConflict('The original shelf was changed in Emby. Manage it directly in Emby Home settings.')
              }
            }
            const sectionId = await addEmbyHomePin(provider, token, apiKey, userId, playlistId, playlist.name)
            await client.query(
              `INSERT INTO emby_home_pins (user_id, server_id, provider_user_id, playlist_id, section_id, name)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (user_id, server_id, provider_user_id, playlist_id)
               DO UPDATE SET section_id = EXCLUDED.section_id, name = EXCLUDED.name`,
              [...key, sectionId, playlist.name]
            )
          })
          return reply.code(204).send()
        } catch (err) {
          if (err instanceof EmbyHomeConflict) return reply.code(409).send({ error: err.message })
          request.log.warn({ err }, 'Could not update Emby Home shelf')
          return reply.code(502).send({ error: 'Could not update Emby Home. Refresh before trying again.' })
        }
      },
    })
  }
}
