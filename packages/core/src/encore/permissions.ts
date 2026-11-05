export const ENCORE_SCOPES = ['library:read', 'profile:read', 'schedules:read', 'memory:write', 'plans:write', 'playlists:write', 'home:write', 'curation:write'] as const
export type EncoreScope = typeof ENCORE_SCOPES[number]
export const ENCORE_READ_SCOPES = ['library:read', 'profile:read', 'schedules:read'] as const
export function requireEncoreScope(scopes: readonly string[], required: EncoreScope) {
  if (!scopes.includes(required)) throw new Error(`This connection requires ${required}`)
}
