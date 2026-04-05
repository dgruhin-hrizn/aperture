/**
 * Language defaults (admin) and supported locales (public).
 */
import type { FastifyInstance } from 'fastify'
import {
  APP_LOCALE_OPTIONS,
  getSystemLanguageDefaults,
  setSystemLanguageDefaults,
  type AppLocaleCode,
} from '@aperture/core'
import { requireAdmin, requireAuth } from '../../../plugins/auth.js'
import {
  getLanguageDefaultsSchema,
  supportedLocalesSchema,
  updateLanguageDefaultsSchema,
} from '../schemas.js'

export function registerLanguageDefaultsHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/locales — public (for login page / pickers)
   */
  fastify.get('/api/settings/locales', { schema: supportedLocalesSchema }, async (_request, reply) => {
    return reply.send({
      locales: APP_LOCALE_OPTIONS.map((o: { code: string; label: string }) => ({
        code: o.code,
        label: o.label,
      })),
    })
  })

  /**
   * GET /api/settings/language-defaults — authenticated
   */
  fastify.get(
    '/api/settings/language-defaults',
    { preHandler: requireAuth, schema: getLanguageDefaultsSchema },
    async (_request, reply) => {
      const defaults = await getSystemLanguageDefaults()
      return reply.send(defaults)
    }
  )

  /**
   * PATCH /api/settings/language-defaults — admin
   */
  fastify.patch<{
    Body: { defaultUiLanguage?: string; defaultAiLanguage?: string }
  }>(
    '/api/settings/language-defaults',
    { preHandler: requireAdmin, schema: updateLanguageDefaultsSchema },
    async (request, reply) => {
      const body = request.body || {}
      const patch: {
        defaultUiLanguage?: AppLocaleCode
        defaultAiLanguage?: AppLocaleCode
      } = {}
      if (body.defaultUiLanguage !== undefined) {
        patch.defaultUiLanguage = body.defaultUiLanguage as AppLocaleCode
      }
      if (body.defaultAiLanguage !== undefined) {
        patch.defaultAiLanguage = body.defaultAiLanguage as AppLocaleCode
      }
      const updated = await setSystemLanguageDefaults(patch)
      return reply.send(updated)
    }
  )
}
