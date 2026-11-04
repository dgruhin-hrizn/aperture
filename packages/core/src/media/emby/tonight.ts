import { query, queryOne } from '../../lib/db.js'
import { getMediaServerConfig } from '../../settings/systemSettings.js'
import { EmbyProvider } from './EmbyProvider.js'
import { getVisibleRecommendationItems } from './recommendationAccess.js'

interface TonightItem {
  id: string
  title: string
  detail: string | null
  posterUrl: string | null
  embyUrl: string
  minutes?: number
  progress?: number
  reason?: string | null
}

type TonightResult =
  | { status: 'unsupported' | 'sign-in' | 'stale-pick' }
  | { status: 'ready'; resume: TonightItem[]; picks: TonightItem[] }

interface ResumeItem {
  Id: string
  Type: 'Movie' | 'Episode'
  SeriesId?: string
  RunTimeTicks?: number
  UserData?: { PlaybackPositionTicks?: number }
}

interface CatalogItem {
  item_id: string
  title: string
  detail: string | null
  poster_url: string | null
}

interface Pick extends CatalogItem {
  media_type: 'movie' | 'series'
  year: number | null
  minutes: number | null
  reason: string | null
}

const ticksPerMinute = 60 * 10_000_000

function itemUrl(baseUrl: string, serverId: string, itemId: string): string {
  const url = new URL(baseUrl)
  url.pathname = url.pathname.replace(/\/+$/, '') + '/web/index.html'
  url.search = ''
  const params = new URLSearchParams({ id: itemId })
  if (serverId) params.set('serverId', serverId)
  url.hash = '!/item?' + params
  return url.toString()
}

function titleKey(pick: Pick): string {
  return `${pick.media_type}|${pick.title.toLowerCase()}|${pick.year ?? ''}`
}

export async function getEmbyTonight(userId: string, dismissId?: string): Promise<TonightResult> {
  const config = await getMediaServerConfig()
  const baseUrl = config.baseUrl
  if (config.type !== 'emby' || !baseUrl) return { status: 'unsupported' }
  const account = await queryOne<{ provider_user_id: string; provider_access_token: string | null }>(
    "SELECT provider_user_id, provider_access_token FROM users WHERE id = $1 AND provider = 'emby' AND NOT provider_disabled",
    [userId]
  )
  if (!account?.provider_access_token) return { status: 'sign-in' }

  const provider = new EmbyProvider(baseUrl)
  const { provider_user_id: embyId, provider_access_token: token } = account
  const params = new URLSearchParams({ IncludeItemTypes: 'Movie,Episode', EnableUserData: 'true', Limit: '30' })
  const [resumable, server] = await Promise.all([
    provider.fetch<{ Items: ResumeItem[] }>(`/Users/${encodeURIComponent(embyId)}/Items/Resume?${params}`, token),
    provider.fetch<{ Id: string }>('/System/Info/Public', ''),
  ])
  const resumeIds = resumable.Items.map((item) => item.Id)
  const [catalog, suggestions, snoozes] = await Promise.all([
    query<CatalogItem>(
      `SELECT m.provider_item_id AS item_id, m.title, NULL::text AS detail, m.poster_url
       FROM movies m WHERE m.provider_item_id = ANY($1::text[]) AND m.provider_library_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM strm_libraries sl WHERE sl.provider_library_id = m.provider_library_id)
       UNION ALL
       SELECT e.provider_item_id, s.title, e.title, COALESCE(s.poster_url, e.poster_url)
       FROM episodes e JOIN series s ON s.id = e.series_id
       WHERE e.provider_item_id = ANY($1::text[]) AND s.provider_library_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM strm_libraries sl WHERE sl.provider_library_id = s.provider_library_id)`,
      [resumeIds]
    ),
    query<Pick>(
      `WITH latest AS (
         SELECT DISTINCT ON (media_type) id, media_type
         FROM recommendation_runs
         WHERE user_id = $1 AND status = 'completed'
         ORDER BY media_type, created_at DESC, id DESC
       ), picked AS (
         SELECT m.provider_item_id AS item_id, m.title, m.year, m.poster_url,
                m.runtime_minutes AS minutes, m.provider_library_id, l.media_type,
                c.ai_explanation AS reason, c.selected_rank, c.final_score
         FROM latest l JOIN recommendation_candidates c ON c.run_id = l.id AND c.is_selected
         JOIN movies m ON c.movie_id = m.id AND l.media_type = 'movie'
         UNION ALL
         SELECT s.provider_item_id, s.title, s.year, s.poster_url,
                NULL::integer, s.provider_library_id, l.media_type,
                c.ai_explanation, c.selected_rank, c.final_score
         FROM latest l JOIN recommendation_candidates c ON c.run_id = l.id AND c.is_selected
         JOIN series s ON c.series_id = s.id AND l.media_type = 'series'
       )
       SELECT p.*, p.year::text AS detail
       FROM picked p JOIN users u ON u.id = $1
       WHERE u.is_enabled
         AND ((p.media_type = 'movie' AND u.movies_enabled) OR (p.media_type = 'series' AND u.series_enabled))
         AND p.provider_library_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM library_config lc WHERE lc.provider_library_id = p.provider_library_id AND NOT lc.is_enabled)
         AND NOT EXISTS (SELECT 1 FROM strm_libraries sl WHERE sl.provider_library_id = p.provider_library_id)
       ORDER BY selected_rank ASC NULLS LAST, final_score DESC, item_id`,
      [userId]
    ),
    query<{ title_key: string }>(
      'SELECT title_key FROM tonight_snoozes WHERE user_id = $1 AND expires_at > now()',
      [userId]
    ),
  ])

  const catalogById = new Map(catalog.rows.map((item) => [item.item_id, item]))
  const resume: TonightItem[] = []
  const inProgress = new Set<string>()
  for (const item of resumable.Items) {
    const media = catalogById.get(item.Id)
    const position = item.UserData?.PlaybackPositionTicks ?? 0
    if (!media || position <= 0) continue
    const key = item.SeriesId || item.Id
    if (inProgress.has(key)) continue
    inProgress.add(key)
    if (resume.length >= 4) continue
    const duration = item.RunTimeTicks ?? 0
    resume.push({
      id: media.item_id,
      title: media.title,
      detail: media.detail,
      posterUrl: media.poster_url,
      embyUrl: itemUrl(baseUrl, server.Id, item.Id),
      minutes: duration > position ? Math.ceil((duration - position) / ticksPerMinute) : undefined,
      progress: duration > 0 ? Math.min(100, position / duration * 100) : undefined,
    })
  }

  const hidden = new Set(snoozes.rows.map((row) => row.title_key))
  const requested = suggestions.rows.find((pick) => pick.item_id === dismissId)
  const pending = dismissId !== undefined && !(requested && hidden.has(titleKey(requested)))
  const limit = pending ? 4 : 3
  const candidates = suggestions.rows.filter((pick) => !inProgress.has(pick.item_id) && !hidden.has(titleKey(pick)))
  const selected: Pick[] = []
  const titles = new Set<string>()
  for (let offset = 0; offset < candidates.length && selected.length < limit; offset += 24) {
    const batch = candidates.slice(offset, offset + 24)
    const [movies, series] = await Promise.all([
      getVisibleRecommendationItems(provider, token, embyId, batch.filter((p) => p.media_type === 'movie').map((p) => p.item_id), 'Movie'),
      getVisibleRecommendationItems(provider, token, embyId, batch.filter((p) => p.media_type === 'series').map((p) => p.item_id), 'Series'),
    ])
    for (const pick of batch) {
      const key = titleKey(pick)
      if (titles.has(key) || !(pick.media_type === 'movie' ? movies : series).has(pick.item_id)) continue
      titles.add(key)
      selected.push(pick)
      if (selected.length === limit) break
    }
  }

  if (pending) {
    const index = selected.slice(0, 3).findIndex((pick) => pick.item_id === dismissId)
    if (index < 0) return { status: 'stale-pick' }
    const [dismissed] = selected.splice(index, 1)
    await query(
      `WITH expired AS (
         DELETE FROM tonight_snoozes
         WHERE user_id = $1 AND title_key <> $2 AND expires_at <= now()
       )
       INSERT INTO tonight_snoozes (user_id, title_key, expires_at)
       VALUES ($1, $2, now() + interval '12 hours')
       ON CONFLICT (user_id, title_key) DO UPDATE SET expires_at = EXCLUDED.expires_at
       WHERE tonight_snoozes.expires_at <= now()`,
      [userId, titleKey(dismissed)]
    )
  }

  const picks = selected.map((pick) => ({
    id: pick.item_id,
    title: pick.title,
    detail: pick.detail,
    posterUrl: pick.poster_url,
    embyUrl: itemUrl(baseUrl, server.Id, pick.item_id),
    minutes: pick.minutes ?? undefined,
    reason: pick.reason,
  }))

  return { status: 'ready', resume, picks }
}
