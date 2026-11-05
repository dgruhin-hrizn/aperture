import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EmbyProvider } from './EmbyProvider.js'
import { getVisibleRecommendationItems } from './recommendationAccess.js'

test('checks an episode against the user library without an Emby ParentId override', async (t) => {
  const provider = new EmbyProvider('http://emby.test')
  t.mock.method(provider, 'fetch', async (endpoint: string) => {
    const params = new URL(endpoint, 'http://emby.test').searchParams
    assert.equal(params.get('UserId'), 'viewer')
    assert.equal(params.get('Ids'), '1,2,3')
    assert.equal(params.has('ParentId'), false)
    return {
      Items: [
        { Id: '1', SeriesId: 'series', Path: '/media/allowed.mkv' },
        { Id: '2', SeriesId: 'other-series', Path: '/media/wrong-series.mkv' },
        { Id: '4', SeriesId: 'series', Path: '/media/unrequested.mkv' },
      ],
    }
  })
  const visible = await getVisibleRecommendationItems(provider, 'test', 'viewer', ['1', '2', '3'], 'Episode', 'series')
  assert.deepEqual([...visible.keys()], ['1'])
})
