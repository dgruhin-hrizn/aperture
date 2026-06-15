// Main provider class
export { EmbyProvider } from './EmbyProvider.js'
export { EmbyProviderBase } from './base.js'

// Types and mappers
export * from './types.js'
export { mapEmbyItemToMovie, mapEmbyItemToSeries, mapEmbyItemToEpisode } from './mappers.js'

// Helper modules
export * from './fetchHelpers.js'
export * from './requestBuilders.js'
export * from './itemUpdates.js'
export * from './mapperHelpers.js'

// Module functions (for direct import if needed)
export * from './auth.js'
export * from './users.js'
export * from './libraries.js'
export * from './movies.js'
export * from './series.js'
export * from './favorites.js'
export * from './playlists.js'
