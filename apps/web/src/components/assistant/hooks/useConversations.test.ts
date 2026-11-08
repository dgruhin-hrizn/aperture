import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { assistantRequest, useConversations, type Conversation } from './useConversations'

const originalFetch = globalThis.fetch
let renderer: ReactTestRenderer | undefined

afterEach(async () => {
  await act(async () => renderer?.unmount())
  renderer = undefined
  globalThis.fetch = originalFetch
})

test('bodyless Encore requests omit JSON content type and accept empty deletion responses', async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(new Headers(options?.headers).has('content-type'), false)
    assert.equal(options?.credentials, 'include')
    return options?.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : Response.json({ plans: [] })
  }
  assert.deepEqual(await assistantRequest('/api/assistant/workbench'), { plans: [] })
  assert.equal(
    await assistantRequest('/api/assistant/conversations/owned', { method: 'DELETE' }),
    undefined
  )
})

test('JSON writes retain their payload and accept every supported custom header representation', async () => {
  for (const customHeaders of [
    { 'X-Test': 'retained' },
    new Headers({ 'X-Test': 'retained' }),
    [['X-Test', 'retained']],
  ] as HeadersInit[]) {
    globalThis.fetch = async (_url, options) => {
      const headers = new Headers(options?.headers)
      assert.equal(headers.get('content-type'), 'application/json')
      assert.equal(headers.get('x-test'), 'retained')
      assert.deepEqual(JSON.parse(String(options?.body)), { title: 'Film night' })
      return Response.json({ saved: true })
    }
    assert.deepEqual(
      await assistantRequest('/api/assistant/conversations/owned', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Film night' }),
        headers: customHeaders,
      }),
      { saved: true }
    )
  }
})

test('deleting inactive, active and last chats keeps history and the selected conversation consistent', async () => {
  const base = '/api/assistant/conversations'
  let conversations: Conversation[] = ['First chat', 'Second chat', 'Third chat'].map(
    (title, index) => ({ id: String(index), title, updated_at: new Date().toISOString() })
  )
  let state!: ReturnType<typeof useConversations>
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    if (options?.method === 'DELETE') {
      assert.equal(new Headers(options.headers).has('content-type'), false)
      conversations = conversations.filter((item) => `${base}/${item.id}` !== url)
      return new Response(null, { status: 204 })
    }
    if (options?.method === 'POST') {
      const conversation = { id: 'new', title: 'New Chat', updated_at: new Date().toISOString() }
      conversations.push(conversation)
      return Response.json({ conversation }, { status: 201 })
    }
    if (url === base) return Response.json({ conversations })
    const conversation = conversations.find((item) => `${base}/${item.id}` === url)
    assert.ok(conversation)
    return Response.json({ conversation, messages: [] })
  }
  function Consumer() {
    state = useConversations()
    return null
  }
  await act(async () => {
    renderer = create(React.createElement(Consumer))
  })
  assert.equal(state.active?.conversation.id, '0')
  await act(async () => {
    await state.remove('2')
  })
  assert.equal(state.active?.conversation.id, '0')
  assert.deepEqual(
    state.conversations.map((item) => item.id),
    ['0', '1']
  )
  await act(async () => {
    await state.remove('0')
  })
  assert.equal(state.active?.conversation.id, '1')
  await act(async () => {
    await state.remove('1')
  })
  assert.equal(state.active?.conversation.id, 'new')
  assert.deepEqual(
    state.conversations.map((item) => item.id),
    ['new']
  )
  assert.equal(state.error, '')
  assert.equal(state.busy, false)
})
