/**
 * Admin: TMDb genre rows for Discovery "Popular by genre" horizontal strips.
 */
import type { FastifyInstance } from 'fastify'
import {
  getGenreStripMovieRows,
  getGenreStripSeriesRows,
  setGenreStripMovieRows,
  setGenreStripSeriesRows,
  getMovieGenresList,
  getTVGenresList,
  getTmdbConfigurationCountries,
  appLocaleToTmdbLanguage,
  GENRE_STRIP_MAX_ROWS,
  GENRE_STRIP_MAX_GENRES_PER_ROW,
  GENRE_STRIP_MAX_ROW_LIMIT,
  validateGenreStripRows,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'

export function registerDiscoveryGenreStripsSettingsHandlers(fastify: FastifyInstance) {
  /**
   * TMDb movie + TV genre lists for admin pickers (localized).
   */
  fastify.get<{
    Querystring: { locale?: string }
  }>('/api/settings/discovery-genre-strips/genre-options', { preHandler: requireAdmin }, async (request, reply) => {
    const locale = typeof request.query.locale === 'string' ? request.query.locale : 'en'
    const language = appLocaleToTmdbLanguage(locale)
    const [movieList, tvList] = await Promise.all([
      getMovieGenresList({ language }),
      getTVGenresList({ language }),
    ])
    return reply.send({
      movieGenres: movieList.map((g) => ({ id: g.id, name: g.name })),
      tvGenres: tvList.map((g) => ({ id: g.id, name: g.name })),
    })
  })

  /**
   * ISO 3166-1 countries for Discover `with_origin_country` (localized names).
   */
  fastify.get<{
    Querystring: { locale?: string }
  }>('/api/settings/discovery-genre-strips/country-options', { preHandler: requireAdmin }, async (request, reply) => {
    const locale = typeof request.query.locale === 'string' ? request.query.locale : 'en'
    const language = appLocaleToTmdbLanguage(locale)
    const list = await getTmdbConfigurationCountries({ language })
    return reply.send({
      countries: list.map((c) => ({
        iso: c.iso_3166_1,
        name: c.english_name,
        nativeName: c.native_name,
      })),
    })
  })

  fastify.get('/api/settings/discovery-genre-strips', { preHandler: requireAdmin }, async (_request, reply) => {
    const [movieGenreRows, seriesGenreRows] = await Promise.all([
      getGenreStripMovieRows(),
      getGenreStripSeriesRows(),
    ])
    return reply.send({ movieGenreRows, seriesGenreRows })
  })

  fastify.patch<{
    Body: { movieGenreRows?: unknown; seriesGenreRows?: unknown }
  }>('/api/settings/discovery-genre-strips', { preHandler: requireAdmin }, async (request, reply) => {
    const { movieGenreRows, seriesGenreRows } = request.body || {}
    if (movieGenreRows !== undefined) {
      const rows = validateGenreStripRows(movieGenreRows)
      if (!rows) {
        return reply.status(400).send({
          error: `movieGenreRows must be an array of rows with genreIds (max ${GENRE_STRIP_MAX_GENRES_PER_ROW} per row) and optional limit (${GENRE_STRIP_MAX_ROW_LIMIT} max); up to ${GENRE_STRIP_MAX_ROWS} rows`,
        })
      }
      await setGenreStripMovieRows(rows)
    }
    if (seriesGenreRows !== undefined) {
      const rows = validateGenreStripRows(seriesGenreRows)
      if (!rows) {
        return reply.status(400).send({
          error: `seriesGenreRows must be an array of rows with genreIds (max ${GENRE_STRIP_MAX_GENRES_PER_ROW} per row) and optional limit (${GENRE_STRIP_MAX_ROW_LIMIT} max); up to ${GENRE_STRIP_MAX_ROWS} rows`,
        })
      }
      await setGenreStripSeriesRows(rows)
    }
    const [movie, series] = await Promise.all([getGenreStripMovieRows(), getGenreStripSeriesRows()])
    return reply.send({ movieGenreRows: movie, seriesGenreRows: series })
  })
}
