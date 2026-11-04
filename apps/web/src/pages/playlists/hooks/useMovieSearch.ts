import { apiFetch } from '../../../lib/api'
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

  const search = useCallback(async (searchQuery: string, signal?: AbortSignal) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await apiFetch(
        `/api/movies?search=${encodeURIComponent(searchQuery)}&pageSize=10`,
        { signal }
      )
      if (response.ok) {
        const data = await response.json()
        if (!signal?.aborted) setResults(data.movies)
      }
    } catch {
      if (signal?.aborted) return
      console.error('Failed to search movies')
    } finally {
      if (!signal?.aborted) setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setIsSearching(false)
      return
    }
    const controller = new AbortController()

    const timer = setTimeout(() => {
      void search(query, controller.signal)
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
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
