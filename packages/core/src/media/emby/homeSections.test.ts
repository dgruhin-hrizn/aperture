import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EmbyProvider } from './EmbyProvider.js'
import { addEmbyHomePin, EmbyHomeConflict, removeEmbyHomePin } from './homeSections.js'

test('pin and unpin target only the new section and preserve existing sections', async (t) => {
  const provider = new EmbyProvider('http://emby.test')
  const original = [
    { Id: 'resume', SectionType: 'resume', CustomName: 'Continue Watching', IncludeNextUpInResume: true },
    { Id: 'manual', SectionType: 'playlist', ParentId: 'other', CustomName: 'My manual shelf' },
  ]
  let sections = structuredClone(original)
  const deletes: string[][] = []
  t.mock.method(provider, 'getUsers', async () => [])
  t.mock.method(provider, 'fetch', async (endpoint: string, token: string, options?: RequestInit) => {
    assert.equal(token, 'owner-session')
    if (endpoint.startsWith('/Items?')) return { Items: [{ Id: 'managed' }] }
    if (endpoint === '/Users/owner/HomeSections/Delete') {
      const { Ids } = JSON.parse(String(options?.body))
      deletes.push(Ids)
      sections = sections.filter((section) => !Ids.includes(section.Id))
      return
    }
    assert.equal(endpoint, '/Users/owner/HomeSections')
    if (options?.method === 'POST') {
      sections.push({ Id: 'new-section', ...JSON.parse(String(options.body)) })
      return
    }
    return structuredClone(sections)
  })

  const sectionId = await addEmbyHomePin(provider, 'owner-session', 'admin-key', 'owner', 'managed', 'AI Picks')
  assert.equal(sectionId, 'new-section')
  assert.deepEqual(sections.slice(0, -1), original)
  await assert.rejects(
    addEmbyHomePin(provider, 'owner-session', 'admin-key', 'owner', 'managed', 'AI Picks'),
    EmbyHomeConflict
  )
  await removeEmbyHomePin(provider, 'owner-session', 'owner', 'managed', sectionId)
  await removeEmbyHomePin(provider, 'owner-session', 'owner', 'managed', sectionId)
  assert.deepEqual(deletes, [['new-section']])
  assert.deepEqual(sections, original)
})

test('unpin refuses to delete a section repointed to another playlist', async (t) => {
  const provider = new EmbyProvider('http://emby.test')
  t.mock.method(provider, 'fetch', async (endpoint: string, _token: string, options?: RequestInit) => {
    assert.equal(endpoint, '/Users/owner/HomeSections')
    assert.equal(options, undefined)
    return [{ Id: 'new-section', SectionType: 'playlist', ParentId: 'unrelated' }]
  })
  await assert.rejects(
    removeEmbyHomePin(provider, 'owner-session', 'owner', 'managed', 'new-section'),
    EmbyHomeConflict
  )
})
