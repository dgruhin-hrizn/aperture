export interface Channel {
  id: string
  ownerId: string
  name: string
  description: string | null
  genreFilters: string[]
  textPreferences: string | null
  exampleMovieIds: string[]
  isPinnedRow: boolean
  playlistId: string | null
  isActive: boolean
}

export interface ChannelRecommendation {
  movieId: string
  providerItemId: string
  title: string
  year: number | null
  score: number
}

