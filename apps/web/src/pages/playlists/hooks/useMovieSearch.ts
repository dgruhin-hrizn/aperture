import { useState, useCallback, useEffect } from 'react'
import type { Movie } from '../types'

interface UseMovieSearchOptions {
  enabled?: boolean
  debounceMs?: number
}

export function useMovieSearch(options: UseMovieSearchOptions = {}) {
  const { enabled = true, debounceMs = 300 } = options
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Movie[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(
        `/api/movies?search=${encodeURIComponent(searchQuery)}&pageSize=10`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data = await response.json()
        setResults(data.movies)
      }
    } catch {
      console.error('Failed to search movies')
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const timer = setTimeout(() => {
      search(query)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, search, enabled, debounceMs])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  return {
    query,
    setQuery,
    results,
    isSearching,
    clear,
  }
}


