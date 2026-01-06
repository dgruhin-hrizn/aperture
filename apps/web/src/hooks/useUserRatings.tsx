import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'

interface UserRating {
  movieId?: string
  seriesId?: string
  rating: number
}

interface UserRatingsContextValue {
  ratings: Map<string, number> // key: "movie-{id}" or "series-{id}", value: rating
  getRating: (type: 'movie' | 'series', id: string) => number | null
  setRating: (type: 'movie' | 'series', id: string, rating: number | null) => Promise<void>
  loading: boolean
  error: string | null
}

const UserRatingsContext = createContext<UserRatingsContextValue | null>(null)

export function UserRatingsProvider({ children }: { children: ReactNode }) {
  const [ratings, setRatings] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all user ratings on mount
  useEffect(() => {
    const fetchRatings = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/ratings', { credentials: 'include' })
        if (!response.ok) {
          throw new Error('Failed to fetch ratings')
        }
        const data = await response.json()
        
        const ratingsMap = new Map<string, number>()
        for (const rating of data.ratings as UserRating[]) {
          if (rating.movieId) {
            ratingsMap.set(`movie-${rating.movieId}`, rating.rating)
          } else if (rating.seriesId) {
            ratingsMap.set(`series-${rating.seriesId}`, rating.rating)
          }
        }
        setRatings(ratingsMap)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch user ratings:', err)
        setError(err instanceof Error ? err.message : 'Failed to load ratings')
      } finally {
        setLoading(false)
      }
    }

    fetchRatings()
  }, [])

  const getRating = useCallback(
    (type: 'movie' | 'series', id: string): number | null => {
      return ratings.get(`${type}-${id}`) ?? null
    },
    [ratings]
  )

  const setRating = useCallback(
    async (type: 'movie' | 'series', id: string, rating: number | null): Promise<void> => {
      const key = `${type}-${id}`
      const endpoint = type === 'movie' ? `/api/ratings/movie/${id}` : `/api/ratings/series/${id}`
      
      try {
        if (rating === null) {
          // Delete rating
          const response = await fetch(endpoint, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (!response.ok) {
            throw new Error('Failed to delete rating')
          }
          setRatings((prev) => {
            const next = new Map(prev)
            next.delete(key)
            return next
          })
        } else {
          // Create/update rating
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ rating }),
          })
          if (!response.ok) {
            throw new Error('Failed to save rating')
          }
          setRatings((prev) => {
            const next = new Map(prev)
            next.set(key, rating)
            return next
          })
        }
      } catch (err) {
        console.error('Failed to update rating:', err)
        throw err
      }
    },
    []
  )

  return (
    <UserRatingsContext.Provider value={{ ratings, getRating, setRating, loading, error }}>
      {children}
    </UserRatingsContext.Provider>
  )
}

export function useUserRatings() {
  const context = useContext(UserRatingsContext)
  if (!context) {
    throw new Error('useUserRatings must be used within a UserRatingsProvider')
  }
  return context
}

