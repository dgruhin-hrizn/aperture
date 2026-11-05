import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { browserFixture, tick, wrap } from '../../../test/uiHarness'
import { useBrowseMovies } from './useBrowseMovies'
import { useBrowseSeries } from './useBrowseSeries'
import { useBrowsePeople } from './useBrowsePeople'
import { PAGE_SIZE } from '../constants'

let fixture: ReturnType<typeof browserFixture>, renderer: ReactTestRenderer | undefined
const originalFetch = globalThis.fetch
beforeEach(() => {
  fixture = browserFixture()
})
afterEach(async () => {
  await act(async () => renderer?.unmount())
  renderer = undefined
  fixture.restore()
  globalThis.fetch = originalFetch
})
const rows = (page = 1, prefix = '') =>
  Array.from({ length: PAGE_SIZE }, (_, i) => ({
    id: `${prefix}${(page - 1) * PAGE_SIZE + i}`,
    title: `${prefix}${i}`,
  }))
function mockData(url: string) {
  if (url.includes('filter-ranges'))
    return {
      year: { min: 1900, max: 2026 },
      runtime: { min: 0, max: 300 },
      seasons: { min: 1, max: 30 },
      rating: { min: 0, max: 10 },
    }
  return {
    genres: [],
    networks: [],
    collections: [],
    contentRatings: [],
    resolutions: [],
    countries: [],
  }
}
const saveSort = () => {}

test('People selected: hidden Movies/TV make zero requests and People does not refetch when rows arrive', async () => {
  const calls: string[] = []
  globalThis.fetch = async (input) => {
    const url = String(input)
    calls.push(url)
    return Response.json({ people: rows(), total: 150 })
  }
  function Probe() {
    useBrowseMovies({ tabIndex: 2, persistSortPreferences: saveSort })
    useBrowseSeries({ tabIndex: 2, persistSortPreferences: saveSort })
    useBrowsePeople({ tabIndex: 2, initialTabIsPeople: true })
    return null
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe)))
    await new Promise((resolve) => setTimeout(resolve, 15))
  })
  await act(tick)
  assert.equal(calls.length, 1)
  assert.match(calls[0], /^\/api\/discover\/people\?/)
})

test('People repeated intersections start one append and account changes abort obsolete pages', async () => {
  let current!: ReturnType<typeof useBrowsePeople>
  let resolvePage!: (response: Response) => void
  let pageSignal!: AbortSignal
  const pages: number[] = []
  globalThis.fetch = async (input, init) => {
    const page = Number(new URL(String(input), 'http://test').searchParams.get('page'))
    pages.push(page)
    if (page > 1) {
      pageSignal = init?.signal as AbortSignal
      return new Promise<Response>(resolve => { resolvePage = resolve })
    }
    return Response.json({ people: Array.from({ length: PAGE_SIZE }, (_, i) => ({ name: `First ${i}` })), total: 100 })
  }
  function Probe() { current = useBrowsePeople({ tabIndex: 2, initialTabIsPeople: true }); return null }
  await act(async () => { renderer = create(wrap(React.createElement(Probe))); await new Promise(resolve => setTimeout(resolve, 15)) })
  const observer = fixture.observers.filter(o => !o.disconnected).at(-1)!
  await act(async () => {
    observer.callback([{ isIntersecting: true } as IntersectionObserverEntry])
    observer.callback([{ isIntersecting: true } as IntersectionObserverEntry])
    await tick()
  })
  assert.deepEqual(pages, [1, 2])
  await act(async () => { renderer!.update(wrap(React.createElement(Probe), 'other-person-account')); await new Promise(resolve => setTimeout(resolve, 15)) })
  assert.equal(pageSignal.aborted, true)
  await act(async () => { resolvePage(Response.json({ people: [{ name: 'Old account' }], total: 100 })); await tick() })
  assert.equal(current.people.length, PAGE_SIZE)
  assert.equal(current.people[0].name, 'First 0')
  assert.ok(!current.people.some(p => p.name === 'Old account'))
})
for (const media of ['movies', 'series'] as const) {
  test(`${media}: appending page two preserves page one and does not restart first-page loading`, async () => {
    let current!: ReturnType<typeof useBrowseMovies> | ReturnType<typeof useBrowseSeries>
    const listCalls: number[] = []
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.startsWith(`/api/${media}?`)) {
        const page = Number(new URL(url, 'http://test').searchParams.get('page'))
        listCalls.push(page)
        return Response.json({ [media]: rows(page), total: 150 })
      }
      return Response.json(mockData(url))
    }
    const useBrowse = media === 'movies' ? useBrowseMovies : useBrowseSeries
    function Probe() {
      current = useBrowse({
        tabIndex: media === 'movies' ? 0 : 1,
        persistSortPreferences: saveSort,
      })
      return null
    }
    await act(async () => {
      renderer = create(wrap(React.createElement(Probe)))
      await new Promise((resolve) => setTimeout(resolve, 15))
    })
    await act(tick)
    const initialCount =
      media === 'movies'
        ? (current as ReturnType<typeof useBrowseMovies>).movies.length
        : (current as ReturnType<typeof useBrowseSeries>).series.length
    assert.equal(initialCount, PAGE_SIZE)
    const observer = fixture.observers.filter((o) => !o.disconnected).at(-1)!
    await act(async () => {
      observer.callback([{ isIntersecting: true } as IntersectionObserverEntry])
      await tick()
    })
    assert.equal(
      media === 'movies'
        ? (current as ReturnType<typeof useBrowseMovies>).movies.length
        : (current as ReturnType<typeof useBrowseSeries>).series.length,
      PAGE_SIZE * 2
    )
    assert.deepEqual(listCalls, [1, 2])
  })
}

test('new movie search aborts its predecessor and ignores a late older result', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let current!: ReturnType<typeof useBrowseMovies>
  let oldSignal!: AbortSignal, oldFinish!: (response: Response) => void
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (!url.startsWith('/api/movies?')) return Response.json(mockData(url))
    const search = new URL(url, 'http://test').searchParams.get('search')
    if (search === 'old') {
      oldSignal = init!.signal!
      return new Promise((resolve) => {
        oldFinish = resolve
      })
    }
    return Response.json({ movies: rows(1, search || 'initial'), total: 50 })
  }
  function Probe() {
    current = useBrowseMovies({ tabIndex: 0, persistSortPreferences: saveSort })
    return null
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe)))
    await tick()
  })
  await act(async () => {
    t.mock.timers.tick(1)
    await tick()
  })
  await act(async () => current.setMovieSearch('old'))
  await act(async () => {
    t.mock.timers.tick(300)
    await tick()
  })
  await act(async () => current.setMovieSearch('new'))
  await act(async () => {
    t.mock.timers.tick(300)
    await tick()
  })
  assert.equal(oldSignal.aborted, true)
  await act(async () => {
    oldFinish(Response.json({ movies: rows(1, 'old'), total: 50 }))
    await tick()
  })
  assert.equal(current.movies[0].id, 'new0')
})

for (const media of ['movies', 'series'] as const) {
  test(`${media}: waits for saved sort initialization and avoids a default-sort fetch`, async () => {
    const listCalls: URL[] = []
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.startsWith(`/api/${media}?`)) {
        listCalls.push(new URL(url, 'http://test'))
        return Response.json({ [media]: rows(), total: PAGE_SIZE })
      }
      return Response.json(mockData(url))
    }
    const useBrowse = media === 'movies' ? useBrowseMovies : useBrowseSeries
    function Probe({ ready }: { ready: boolean }) {
      useBrowse({
        tabIndex: media === 'movies' ? 0 : 1,
        ready,
        initialSort: ready ? { sortBy: 'releaseDate', sortOrder: 'desc' } : undefined,
        persistSortPreferences: saveSort,
      })
      return null
    }
    await act(async () => {
      renderer = create(wrap(React.createElement(Probe, { ready: false })))
      await tick()
    })
    assert.equal(listCalls.length, 0)
    await act(async () => {
      renderer!.update(wrap(React.createElement(Probe, { ready: true })))
      await tick()
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    assert.equal(listCalls.length, 1)
    assert.equal(listCalls[0].searchParams.get('sortBy'), 'releaseDate')
    assert.equal(listCalls[0].searchParams.get('sortOrder'), 'desc')
  })
}
