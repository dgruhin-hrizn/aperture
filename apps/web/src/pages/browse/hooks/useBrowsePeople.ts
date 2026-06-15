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
  peopleSearch: Dispatch<SetStateAction<string>>
  peopleSortBy: PeopleSortBy
  setPeopleSortBy: Dispatch<SetStateAction<PeopleSortBy>>
  peopleHasMore: boolean
  peopleTotal: number
  peopleLoadMoreRef: RefObject<HTMLDivElement | null>
}

export function useBrowsePeople({ tabIndex, initialTabIsPeople }: UseBrowsePeopleOptions): BrowsePeopleResult {
  const { t } = useTranslation()
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
  const peopleLoadMoreRef = useRef<HTMLDivElement | null>(null)

  const resetPeople = useCallback(() => {
    setPeople([])
    setPeoplePage(1)
    setPeopleHasMore(true)
  }, [])

  const fetchPeople = useCallback(
    async (page: number, append = false) => {
      if (append) {
        setPeopleLoadingMore(true)
      } else {
        setPeopleLoading(true)
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortBy: peopleSortBy,
        })
        if (peopleSearch) params.set('search', peopleSearch)

        const response = await fetch(`/api/discover/people?${params}`, { credentials: 'include' })
        if (!response.ok) {
          setPeopleError(t('browse.errors.loadPeople'))
          return
        }

        const data = (await response.json()) as PeopleResponse
        if (append) {
          setPeople((prev) => [...prev, ...data.people])
        } else {
          setPeople(data.people)
        }
        setPeopleTotal(data.total)
        setPeopleHasMore(
          data.people.length === PAGE_SIZE &&
            (append ? people.length + data.people.length : data.people.length) < data.total
        )
        setPeopleError(null)
      } catch {
        setPeopleError(t('browse.errors.connect'))
      } finally {
        setPeopleLoading(false)
        setPeopleLoadingMore(false)
      }
    },
    [people.length, peopleSearch, peopleSortBy, t]
  )

  useEffect(() => {
    if (tabIndex !== 2) return
    resetPeople()
    const debounce = setTimeout(() => {
      void fetchPeople(1, false)
    }, peopleSearch ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchPeople, peopleSearch, peopleSortBy, resetPeople, tabIndex])

  useEffect(() => {
    if (peopleObserverRef.current) {
      peopleObserverRef.current.disconnect()
    }

    if (!peopleHasMore || peopleLoading || peopleLoadingMore || tabIndex !== 2) return

    peopleObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && peopleHasMore && !peopleLoadingMore) {
          const nextPage = peoplePage + 1
          setPeoplePage(nextPage)
          void fetchPeople(nextPage, true)
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
    peopleLoadMoreRef,
  }
}
