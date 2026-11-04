/** Local-only UI smoke fixture. Never connects to an API, database, or media server. */
import { createServer, loadConfigFromFile } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webRoot = fileURLToPath(new URL('..', import.meta.url))
const uid = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const basePrefs = () => ({
  sidebarCollapsed: false,
  viewModes: { browse: 'grid', recommendations: 'grid' },
  browseSort: { movies: { sortBy: 'year', sortOrder: 'desc' } },
  dismissedAdminRelease: '0.7.11',
  dismissedUserRelease: '0.7.11',
  effectiveUiLanguage: 'en',
  effectiveAiLanguage: 'en',
  welcomeDismissed: true,
})
const prefs = { [uid]: basePrefs(), [otherId]: basePrefs() }
const patches = []
let active = uid
let failPreferences = 0
const user = () =>
  active
    ? {
        id: active,
        username: active === uid ? 'Gru' : 'Sample',
        displayName: active === uid ? 'Gru' : 'Sample',
        isAdmin: active === uid,
        provider: 'emby',
        providerUserId: 'fixture',
        isEnabled: true,
        canManageWatchHistory: true,
        avatarUrl: null,
      }
    : null
const movies = ['Arrival', 'Blade Runner 2049', 'Interstellar', 'Her'].map((title, i) => ({
  id: `movie-${i}`,
  title,
  year: [2016, 2017, 2014, 2013][i],
  poster_url: '/AI_MOVIE_PICKS.png',
  backdrop_url: null,
  genres: ['Science Fiction', 'Drama'],
  overview: 'A sample library title used for isolated interface checks.',
  community_rating: 8.2,
  runtime_minutes: 116,
  tmdb_id: null,
}))
const series = ['Severance', 'Slow Horses', 'The Bear'].map((title, i) => ({
  ...movies[i],
  id: `series-${i}`,
  title,
  total_seasons: 3,
  total_episodes: 24,
  poster_url: '/AI_SERIES_PICKS.png',
}))
const recs = (list) => ({
  recommendations: list.map((item, i) => ({
    [list === movies ? 'movie_id' : 'series_id']: item.id,
    [list === movies ? 'movie' : 'series']: item,
    rank: i + 1,
    final_score: 0.96 - i / 20,
    similarity_score: 0.9,
    novelty_score: 0.7,
    rating_score: 0.8,
    diversity_score: 0.6,
  })),
  run: {
    id: 'sample-run',
    created_at: new Date().toISOString(),
    selected_count: list.length,
    total_candidates: 100,
  },
})
const config = {
  maxCandidates: 100,
  selectedCount: 12,
  recentWatchLimit: 50,
  repeatCooldownDays: 180,
  similarityWeight: 0.4,
  noveltyWeight: 0.2,
  ratingWeight: 0.2,
  diversityWeight: 0.2,
}
const fixture = {
  name: 'appearance-fixture',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const p = url.pathname
      if (!p.startsWith('/api/') && !p.startsWith('/_qa/')) return next()
      const send = (data, status = 200) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      }
      let body = {}
      if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
        let raw = ''
        for await (const part of req) raw += part
        try {
          body = raw ? JSON.parse(raw) : {}
        } catch {
          return send({ error: 'Invalid JSON' }, 400)
        }
      }
      if (p === '/_qa/locale') {
        if (active) {
          prefs[active].uiLanguage = body.locale
          prefs[active].effectiveUiLanguage = body.locale
        }
        return send({ ok: true })
      }
      if (p === '/_qa/state') return send({ active, prefs, patches })
      if (p === '/_qa/fail-preferences') {
        failPreferences = body.count ?? 1
        return send({ ok: true })
      }
      if (p === '/api/setup/status')
        return send({
          needsSetup: false,
          isAdmin: true,
          canAccessSetup: true,
          configured: { mediaServer: true, openai: true },
        })
      if (p === '/api/auth/check') return send({ authenticated: !!active, user: user() })
      if (p === '/api/auth/logout') {
        active = null
        return send({ ok: true })
      }
      if (p === '/api/auth/login') {
        active = body.username === 'Gru' ? uid : otherId
        return send({ user: user() })
      }
      if (p === '/api/auth/login-options') return send({ allowPasswordlessLogin: true })
      if (p === '/api/auth/me/preferences') {
        if (failPreferences > 0) {
          failPreferences--
          return send({ error: 'Simulated unavailable preferences' }, 503)
        }
        if (!active) return send({ error: 'Not signed in' }, 401)
        if (req.method === 'PATCH') {
          patches.push({ userId: active, body })
          prefs[active] = { ...prefs[active], ...body }
          if ('uiLanguage' in body) prefs[active].effectiveUiLanguage = body.uiLanguage || 'en'
        }
        return send(prefs[active])
      }
      if (p === '/api/dashboard')
        return send({
          stats: {
            moviesWatched: 148,
            seriesWatched: 32,
            ratingsCount: 96,
            watchTimeMinutes: 14580,
          },
          recommendations: [
            ...movies.map((m) => ({
              ...m,
              type: 'movie',
              posterUrl: m.poster_url,
              matchScore: 96,
            })),
            ...series.map((s) => ({
              ...s,
              type: 'series',
              posterUrl: s.poster_url,
              matchScore: 90,
            })),
          ],
          topPicks: [],
          recentWatches: [],
          recentRatings: [],
        })
      if (p === `/api/recommendations/${active}`) return send(recs(movies))
      if (p === `/api/recommendations/${active}/series`) return send(recs(series))
      if (p === '/api/recommendations/me/emby-home')
        return send({
          shelves: [
            { playlistId: 'fixture', name: 'AI Picks – Movies', pinned: false, canPin: true },
          ],
        })
      if (p === '/api/recommendations/me/tonight')
        return send({
          status: 'ready',
          resume: series
            .slice(0, 2)
            .map((s) => ({
              id: s.id,
              title: s.title,
              detail: 'S1 · E3',
              posterUrl: s.poster_url,
              embyUrl: '#',
              minutes: 23,
              progress: 60,
            })),
          picks: movies
            .slice(0, 3)
            .map((m) => ({
              id: m.id,
              title: m.title,
              detail: String(m.year),
              posterUrl: m.poster_url,
              embyUrl: '#',
              minutes: m.runtime_minutes,
              reason: 'A thoughtful story based on your saved recommendations.',
            })),
        })
      if (p === '/api/jobs/active') return send({ jobs: [] })
      if (p === '/api/ratings') return send({ ratings: [] })
      if (p.includes('email-settings'))
        return send({ email: '', emailLocked: false, emailNotificationsEnabled: false })
      if (p === '/api/settings/locales')
        return send({
          locales: [
            { code: 'en', label: 'English' },
            { code: 'fr', label: 'Français' },
            { code: 'ar', label: 'العربية' },
          ],
        })
      if (p === '/api/settings/language-defaults')
        return send({ defaultUiLanguage: 'en', defaultAiLanguage: 'en' })
      if (p === '/api/trakt/status') return send({ connected: false, isConfigured: false })
      if (p === '/api/settings/watching') return send({ enabled: true })
      if (p === '/api/watching' || p.startsWith('/api/watching/'))
        return send({ series: [], watching: [], stats: {} })
      if (p === '/api/settings/embedding-model')
        return send({
          currentModel: 'fixture',
          availableModels: [],
          movieCount: 4,
          embeddingsByModel: {},
        })
      if (p === '/api/settings/recommendations')
        return send({ movie: config, series: config, updatedAt: new Date().toISOString() })
      if (p === '/api/settings/libraries')
        return send({
          libraries: ['Movies', 'Series', 'Anime'].map((name, i) => ({
            id: `source-${i}`,
            providerLibraryId: String(15528 + i),
            name,
            collectionType: i ? 'tvshows' : 'movies',
            isEnabled: true,
          })),
        })
      if (p === '/api/settings/user')
        return send({
          userId: active,
          libraryName: 'AI Picks – Movies',
          seriesLibraryName: 'AI Picks – Series',
        })
      if (p === '/api/settings/media-server/config')
        return send({ type: 'emby', baseUrl: 'http://example.invalid', apiKeyConfigured: true })
      if (p === '/api/settings/media-server/security')
        return send({ allowPasswordlessLogin: false })
      if (p === '/api/setup/output-config')
        return send({ strmRoot: '/aperture/strm', mediaRoot: '/media' })
      if (p === '/api/settings/user/ai-explanation')
        return send({ userPreference: null, effectiveValue: true })
      if (p === '/api/settings/tmdb') return send({ isConfigured: false })
      if (p.includes('similarity-graph')) return send({ enabled: true, nodes: [], edges: [] })
      // Unknown API paths stop here; nothing can fall through to a real service.
      return send({ error: `No fixture for ${p}` }, 404)
    })
  },
}
const loaded = await loadConfigFromFile({}, path.join(webRoot, 'vite.config.ts'))
const configFile = loaded.config
configFile.root = webRoot
configFile.server = { port: 3460, strictPort: true, host: '127.0.0.1' }
configFile.plugins = [...configFile.plugins, fixture]
const server = await createServer({ ...configFile, configFile: false })
await server.listen()
console.log('Isolated appearance fixture: http://127.0.0.1:3460/settings?tab=preferences')
