import { createCurationTools } from './curationTools.js'
import { asSchema, type ToolSet } from 'ai'
import { queryOne } from '../lib/db.js'
import { getCatalogScope } from './access.js'
import { encoreCatalogScope, type CatalogScope } from './scopedDb.js'
import { ENCORE_SCOPES, requireEncoreScope, type EncoreScope } from './permissions.js'
import { createTools } from './tools/index.js'
import { createWorkTools } from './workTools.js'
import { createConsultantTools } from './consultantTools.js'
import type { ToolContext } from './types.js'

const profileTools = new Set([
  'getWatchHistory',
  'getUserRatings',
  'getTopStudios',
  'getMyRecommendations',
  'getTasteProfile',
  'getLibraryStats',
  'getContentDetails',
  'getFranchises',
  'getFranchiseProgress',
  'getUnwatched',
  'findSimilarContent',
  'semanticSearch',
])
const unscoped = new Set([
  'getSystemHelp',
  'discoverTitles',
  'getReleaseSchedule',
  'getFilmography',
  'getTasteProfile',
  'getExternalTitleDetails',
])
const curationNames = new Set([
  'listCurations',
  'prepareCuration',
  'updateCuration',
  'pauseCuration',
  'controlCuration',
])
const workScopes: Record<string, EncoreScope> = {
  listMemories: 'profile:read',
  rememberPreference: 'memory:write',
  forgetMemory: 'memory:write',
  getNextEpisodes: 'profile:read',
  createWatchPlan: 'plans:write',
  listWatchPlans: 'plans:write',
  updateWatchPlan: 'plans:write',
  deleteWatchPlan: 'plans:write',
  proposePlaylist: 'playlists:write',
  proposeHomeRow: 'home:write',
  listManagedCollections: 'playlists:write',
  cancelEncoreAction: 'playlists:write',
  executeEncoreAction: 'playlists:write',
  reconcilePlaylist: 'playlists:write',
}
const needsCatalog = new Set([
  'getNextEpisodes',
  'createWatchPlan',
  'updateWatchPlan',
  'proposePlaylist',
  'executeEncoreAction',
])
export function encoreToolScope(name: string): EncoreScope {
  if (curationNames.has(name)) return 'curation:write'
  if (workScopes[name]) return workScopes[name]
  return name === 'getReleaseSchedule'
    ? 'schedules:read'
    : profileTools.has(name)
      ? 'profile:read'
      : 'library:read'
}

/** One implementation and permission boundary for native chat, HTTP MCP and local bridges. */
export function createEncoreTools(
  ctx: ToolContext,
  scopes: readonly EncoreScope[] = ENCORE_SCOPES
): ToolSet {
  let catalog: Promise<CatalogScope> | undefined
  const definitions = {
    ...createTools(ctx),
    ...createConsultantTools(ctx),
    ...createWorkTools(ctx, scopes),
    ...createCurationTools(ctx, scopes),
  }
  const allowed = (name: string) =>
    (!curationNames.has(name) ||
      ['curation:write', 'playlists:write', 'library:read', 'profile:read'].every((scope) =>
        scopes.includes(scope as EncoreScope)
      )) &&
    (!needsCatalog.has(name) || scopes.includes('library:read')) &&
    scopes.includes(encoreToolScope(name)) &&
    (name === 'getTasteProfile' || !profileTools.has(name) || scopes.includes('library:read'))
  return Object.fromEntries(
    Object.entries(definitions)
      .filter(([name]) => allowed(name))
      .map(([name, definition]) => {
        const execute = definition.execute
        return [
          name,
          {
            ...definition,
            execute: execute
              ? async (input: unknown, options: Parameters<NonNullable<typeof execute>>[1]) => {
                  requireEncoreScope(scopes, encoreToolScope(name))
                  const user = await queryOne<{ is_enabled: boolean; provider_disabled: boolean }>(
                    'SELECT is_enabled, provider_disabled FROM users WHERE id = $1',
                    [ctx.userId]
                  )
                  if (!user?.is_enabled || user.provider_disabled)
                    throw new Error('This Aperture account is disabled')
                  const validated = await asSchema(definition.inputSchema).validate?.(input)
                  if (validated && !validated.success) throw new Error('Invalid tool arguments')
                  const args = validated?.success ? validated.value : input
                  if (
                    typeof args === 'object' &&
                    args &&
                    'limit' in args &&
                    args.limit !== undefined &&
                    (typeof args.limit !== 'number' ||
                      !Number.isInteger(args.limit) ||
                      args.limit < 1 ||
                      args.limit > 50)
                  )
                    throw new Error('Limit must be between 1 and 50')
                  if (
                    curationNames.has(name) ||
                    unscoped.has(name) ||
                    (workScopes[name] && !needsCatalog.has(name))
                  )
                    return execute(args, options)
                  catalog ??= getCatalogScope(ctx.userId, options.abortSignal).catch((error) => {
                    catalog = undefined
                    throw error
                  })
                  return encoreCatalogScope.run(await catalog, () => execute(args, options))
                }
              : undefined,
          },
        ]
      })
  )
}
