import { useAuth } from '../../../hooks/useAuth'
import { apiFetch } from '../../../lib/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { PAGE_SIZE } from '../constants'
import type { BrowsePerson } from '../types'

type PeopleSortBy = 'name' | 'credits'

interface UseBrowsePeopleOptions {
  tabIndex: number
  initialTabIsPeople: boolean
}

interface PeopleResponse {
  people: BrowsePerson[]
  total: number
}

interface BrowsePeopleResult {
  people: BrowsePerson[]
  peopleLoading: boolean
  peopleLoadingMore: boolean
  peopleError: string | null
  peopleSearch: string
  setPeopleSearch: Dispatch<SetStateAction<string>>
  peopleSortBy: PeopleSortBy
  setPeopleSortBy: Dispatch<SetStateAction<PeopleSortBy>>
  peopleHasMore: boolean
  peopleTotal: number
  reloadPeople: () => void
  peopleLoadMoreRef: RefObject<HTMLDivElement | null>
}

export function useBrowsePeople({
  tabIndex,
  initialTabIsPeople,
}: UseBrowsePeopleOptions): BrowsePeopleResult {
  const { t } = useTranslation()
  const { user } = useAuth()
  const appendRequest = useRef<symbol | null>(null)
  const [people, setPeople] = useState<BrowsePerson[]>([])
  const [peopleLoading, setPeopleLoading] = useState(() => initialTabIsPeople)
  const [peopleLoadingMore, setPeopleLoadingMore] = useState(false)
  const [peopleError, setPeopleError] = useState<string | null>(null)
  const [peopleSearch, setPeopleSearch] = useState('')
  const [peopleSortBy, setPeopleSortBy] = useState<PeopleSortBy>('name')
  const [peoplePage, setPeoplePage] = useState(1)
  const [peopleHasMore, setPeopleHasMore] = useState(true)
  const [peopleTotal, setPeopleTotal] = useState(0)
  const peopleObserverRef = useRef<IntersectionObserver | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const peopleLoadMoreRef = useRef<HTMLDivElement | null>(null)

  const resetPeople = useCallback(() => {
    setPeople([])
    setPeoplePage(1)
    setPeopleHasMore(true)
  }, [])

  const fetchPeople = useCallback(
    async (page: number, append = false, signal?: AbortSignal) => {
      if (signal?.aborted) return
      if (append && appendRequest.current) return
      const token = Symbol()
      if (append) {
        appendRequest.current = token
        setPeopleLoadingMore(true)
      } else {
        setPeopleLoading(true)
        setPeopleError(null)
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortBy: peopleSortBy,
        })
        if (peopleSearch) params.set('search', peopleSearch)

        const response = await apiFetch(`/api/discover/people?${params}`, {
          credentials: 'include',
          signal,
        })
        if (signal?.aborted) return
        if (!response.ok) {
          setPeopleError(t('browse.errors.loadPeople'))
          return
        }

        const data = (await response.json()) as PeopleResponse
        if (signal?.aborted) return
        setPeoplePage(page)
        if (append) {
          setPeople((prev) => [...prev, ...data.people])
        } else {
          setPeople(data.people)
        }
        setPeopleTotal(data.total)
        setPeopleHasMore(data.people.length === PAGE_SIZE && page * PAGE_SIZE < data.total)
        setPeopleError(null)
      } catch {
        if (signal?.aborted) return
        setPeopleError(t('browse.errors.connect'))
      } finally {
        if (appendRequest.current === token) appendRequest.current = null
        if (!signal?.aborted) {
          setPeopleLoading(false)
          setPeopleLoadingMore(false)
        }
      }
    },
    [peopleSearch, peopleSortBy, t]
  )

  useEffect(() => {
    if (tabIndex !== 2) return
    const controller = new AbortController()
    requestRef.current = controller
    appendRequest.current = null
    resetPeople()
    setPeopleLoading(true)
    setPeopleLoadingMore(false)
    const debounce = setTimeout(
      () => {
        void fetchPeople(1, false, controller.signal)
      },
      peopleSearch ? 300 : 0
    )
    return () => {
      clearTimeout(debounce)
      controller.abort()
    }
  }, [fetchPeople, peopleSearch, peopleSortBy, resetPeople, tabIndex, user?.id])

  const reloadPeople = useCallback(() => {
    if (tabIndex === 2) void fetchPeople(1, false, requestRef.current?.signal)
  }, [fetchPeople, tabIndex])

  useEffect(() => {
    if (peopleObserverRef.current) {
      peopleObserverRef.current.disconnect()
    }

    if (!peopleHasMore || peopleLoading || peopleLoadingMore || tabIndex !== 2) return

    peopleObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && peopleHasMore && !peopleLoadingMore) {
          const nextPage = peoplePage + 1
          void fetchPeople(nextPage, true, requestRef.current?.signal)
        }
      },
      { threshold: 0.1 }
    )

    if (peopleLoadMoreRef.current) {
      peopleObserverRef.current.observe(peopleLoadMoreRef.current)
    }

    return () => {
      if (peopleObserverRef.current) {
        peopleObserverRef.current.disconnect()
      }
    }
  }, [fetchPeople, peopleHasMore, peopleLoading, peopleLoadingMore, peoplePage, tabIndex])

  return {
    people,
    peopleLoading,
    peopleLoadingMore,
    peopleError,
    peopleSearch,
    setPeopleSearch,
    peopleSortBy,
    setPeopleSortBy,
    peopleHasMore,
    peopleTotal,
    reloadPeople,
    peopleLoadMoreRef,
  }
}
