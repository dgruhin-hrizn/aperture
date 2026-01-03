// Re-export all channel functions from modular structure
export type { Channel, ChannelRecommendation } from './types.js'
export { weightedRandomSample } from './utils.js'
export { generateChannelRecommendations } from './recommendations.js'
export {
  updateChannelPlaylist,
  createSharedPlaylist,
  processAllChannels,
} from './playlists.js'
export { writeChannelStrm } from './strm.js'
export {
  generateAIPreferences,
  generateAIPlaylistName,
  generateAIPlaylistDescription,
} from './ai.js'
