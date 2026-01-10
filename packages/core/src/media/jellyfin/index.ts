// Main provider class
export { JellyfinProvider } from './JellyfinProvider.js'
export { JellyfinProviderBase } from './base.js'

// Types and mappers
export * from './types.js'
export {
  mapJellyfinItemToMovie,
  mapJellyfinItemToSeries,
  mapJellyfinItemToEpisode,
} from './mappers.js'

// Module functions (for direct import if needed)
export * from './auth.js'
export * from './users.js'
export * from './libraries.js'
export * from './movies.js'
export * from './series.js'
export * from './playlists.js'



