import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createOllama } from 'ai-sdk-ollama'
import { generateText, type LanguageModel } from 'ai'
import { reasoningCall, reasoningPresets, UnsupportedReasoningPreset } from './ai-reasoning.js'

async function requestBody(create: (fetch: typeof globalThis.fetch) => LanguageModel, options: Awaited<ReturnType<typeof reasoningCall>>['options']) {
  let body: Record<string, unknown> | undefined
  const model = create(async (_url, request) => {
    body = JSON.parse(String(request?.body))
    return new Response(JSON.stringify({ error: { message: 'fixture' } }), { status: 400 })
  })
  await assert.rejects(generateText({ model, prompt: 'Fixture', ...options, maxRetries: 0 }))
  assert.ok(body)
  return body
}

test('OpenAI sends only model-supported effort and preserves the legacy request', async () => {
  const legacy = { provider: 'openai', model: 'gpt-4.1-mini' } as const
  const modern = { provider: 'openai', model: 'gpt-6.1-sol' } as const
  const model = (id: string) => (fetch: typeof globalThis.fetch) => createOpenAI({ apiKey: 'fixture', fetch }).responses(id)
  const old = await reasoningCall(legacy, 50, { temperature: 0.3, quickDefault: true })
  assert.deepEqual(old.options, { maxOutputTokens: 50, temperature: 0.3 })
  assert.deepEqual(await reasoningPresets(legacy), ['standard'])
  assert.equal((await requestBody(model(legacy.model), old.options)).reasoning, undefined)
  const defaultCall = await reasoningCall(modern, 4000)
  assert.equal(defaultCall.options.reasoning, undefined)
  assert.equal(defaultCall.options.maxOutputTokens, 6048)
  const quick = await reasoningCall(modern, 4000, { override: 'quick' })
  const expanded = await reasoningCall(modern, 4000, { override: 'expanded' })
  const quickBody = (await requestBody(model(modern.model), quick.options)).reasoning as { effort: string; summary?: string | null }
  assert.equal(quickBody.effort, 'low')
  assert.equal(quickBody.summary ?? null, null)
  const expandedBody = (await requestBody(model(modern.model), expanded.options)).reasoning as { effort: string }
  assert.equal(expandedBody.effort, 'high')
  await assert.rejects(reasoningCall(legacy, 50, { override: 'expanded' }), UnsupportedReasoningPreset)
})

test('manual and adaptive Claude and Gemini requests leave room for visible output', async () => {
  const anthropic = (id: string) => (fetch: typeof globalThis.fetch) => createAnthropic({ apiKey: 'fixture', fetch })(id)
  const old = await reasoningCall({ provider: 'anthropic', model: 'claude-sonnet-4-5' }, 50, { override: 'expanded' })
  const oldBody = await requestBody(anthropic('claude-sonnet-4-5'), old.options)
  assert.deepEqual(oldBody.thinking, { type: 'enabled', budget_tokens: 4096 })
  assert.equal(oldBody.max_tokens, 50 + (old.tokenOverhead ?? 0))

  const adaptive = await reasoningCall({ provider: 'anthropic', model: 'claude-sonnet-4-6' }, 50, { override: 'expanded' })
  const adaptiveBody = await requestBody(anthropic('claude-sonnet-4-6'), adaptive.options)
  assert.equal((adaptiveBody.thinking as { type: string }).type, 'adaptive')
  assert.deepEqual(adaptiveBody.output_config, { effort: 'high' })

  const gemini = await reasoningCall({ provider: 'google', model: 'gemini-2.5-pro' }, 50, { quickDefault: true })
  const geminiBody = await requestBody(
    (fetch) => createGoogleGenerativeAI({ apiKey: 'fixture', fetch })('gemini-2.5-pro'),
    gemini.options
  )
  assert.deepEqual(geminiBody.generationConfig, { maxOutputTokens: 818, thinkingConfig: { thinkingBudget: 768 } })
})

test('local servers use their advertised controls and keep unrecognized endpoints usable', async (context) => {
  const ollama = { provider: 'ollama', model: 'gpt-oss', baseUrl: 'http://ollama-fixture.test' } as const
  const legacy = { provider: 'ollama', model: 'llama3', baseUrl: 'http://ollama-fixture.test' } as const
  const compatible = { provider: 'openai-compatible', model: 'test-reasoner', baseUrl: 'http://compatible-fixture.test/v1' } as const
  let requests = 0
  context.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    requests++
    if (String(input).includes('/api/show')) {
      const { model } = JSON.parse(String(init?.body))
      return Response.json(model === 'gpt-oss' ? { thinking: { values: ['high', 'low', 'medium'], default: 'medium' } } : {})
    }
    return Response.json({ data: [
      { id: 'test-reasoner', capabilities: { reasoning: { levels: [false, true], defaultLevel: false } } },
      { id: 'old-local' },
    ] })
  })
  assert.deepEqual(await reasoningPresets(ollama), ['quick', 'standard', 'expanded'])
  const high = await reasoningCall(ollama, 50, { override: 'expanded' })
  const highBody = await requestBody((fetch) => createOllama({ baseURL: ollama.baseUrl, fetch })(ollama.model), high.options)
  assert.equal(highBody.think, 'high')

  assert.deepEqual(await reasoningPresets(legacy), ['standard'])
  const expandedLegacy = await reasoningCall(legacy, 50, { override: 'expanded', styleFallback: true })
  assert.equal(expandedLegacy.preset, 'expanded')
  assert.deepEqual(expandedLegacy.options, { maxOutputTokens: 50 })
  assert.deepEqual((await reasoningCall(legacy, 50, { temperature: 0.3 })).options, { maxOutputTokens: 50, temperature: 0.3 })
  const requestCount = requests
  assert.deepEqual((await reasoningCall({ ...compatible, model: 'old-local' }, 50)).options, { maxOutputTokens: 50 })
  assert.equal(requests, requestCount)

  assert.deepEqual(await reasoningPresets(compatible), ['standard', 'expanded'])
  const expanded = await reasoningCall(compatible, 50, { override: 'expanded' })
  const body = await requestBody(
    (fetch) => createOpenAICompatible({ name: 'openai-compatible', baseURL: compatible.baseUrl, fetch })(compatible.model),
    expanded.options
  )
  assert.equal(body.enable_thinking, true)
  assert.equal(body.reasoning_effort, undefined)
})
