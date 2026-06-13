import { createContext } from 'react'

export interface UserRating {
  movieId?: string
  seriesId?: string
  rating: number
}

export interface UserRatingsContextValue {
  ratings: Map<string, number> // key: "movie-{id}" or "series-{id}", value: rating
  getRating: (type: 'movie' | 'series', id: string) => number | null
  setRating: (type: 'movie' | 'series', id: string, rating: number | null) => Promise<void>
  loading: boolean
  error: string | null
}

export const UserRatingsContext = createContext<UserRatingsContextValue | null>(null)
