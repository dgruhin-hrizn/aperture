import type { generateText, LanguageModel, LanguageModelCallOptions } from 'ai'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { ProviderType } from './ai-capabilities/contracts.js'
import { COMPATIBLE_BASE_URL, OPENAI_BASE_URL, discoverEndpointModels, normalizeCompatibleBaseUrl } from './ai-model-discovery.js'
import { AsyncCache } from './asyncCache.js'

export const reasoningPresetSchema = z.enum(['quick', 'standard', 'expanded'])
export type ReasoningPreset = z.infer<typeof reasoningPresetSchema>
const reasoningLevelSchema = z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'on'])
type Level = z.infer<typeof reasoningLevelSchema>

export interface ReasoningConnection {
  provider: ProviderType
  model: string
  apiKey?: string
  baseUrl?: string
  reasoningPreset?: ReasoningPreset
}

type Profile = {
  quick?: Level
  expanded?: Level
  standard?: Level
  defaultLevel?: Level
  protocol?: 'ollama' | 'compatible' | 'compatible-toggle' | 'openrouter' | 'anthropic-budget' | 'gemini-budget'
}

const catalogCache = new AsyncCache<Profile | false>(5 * 60_000, 100)
const ollamaInfo = z.object({
  thinking: z.object({ values: z.array(z.union([z.string(), z.boolean()])), default: z.union([z.string(), z.boolean()]).optional() }).optional(),
})
const routerCatalog = z.object({
  data: z.array(z.object({ id: z.string(), supported_parameters: z.array(z.string()).optional() })).max(10000),
})
const openRouterCache = new AsyncCache<z.infer<typeof routerCatalog>['data']>(5 * 60_000, 1)

function level(value: unknown): Level | undefined {
  const parsed = reasoningLevelSchema.safeParse(value === true ? 'on' : value === false ? 'none' : value)
  return parsed.success ? parsed.data : undefined
}

function fromLevels(values: readonly unknown[], defaultValue?: unknown): Profile | undefined {
  const order = reasoningLevelSchema.options
  const levels = [...new Set(values.map(level).filter((value): value is Level => value !== undefined))]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const defaultLevel = level(defaultValue)
  const quick = levels[0]
  const expanded = levels.includes('high') ? 'high' : levels.at(-1)
  if (!quick || (quick === 'none' && levels.length === 1)) return undefined
  return {
    quick: quick === defaultLevel ? undefined : quick,
    expanded: expanded === defaultLevel || expanded === quick ? undefined : expanded,
    standard: levels.includes('medium') ? 'medium' : undefined,
    defaultLevel,
  }
}

function nativeProfile({ provider, model, baseUrl }: ReasoningConnection): Profile | undefined {
  if (provider === 'openai' && (!baseUrl || baseUrl.replace(/\/+$/, '') === OPENAI_BASE_URL)) {
    if (/^gpt-(?:5\.[12456](?:-(?:mini|nano|sol|terra|luna))?|6(?:-(?:astra|sol|luna))?)(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) {
      return { quick: /^gpt-6-astra/.test(model) ? 'low' : 'none', standard: 'medium', expanded: 'high' }
    }
    if (/^gpt-6\.1-terra(?:$|-)/.test(model)) return { quick: 'none', standard: 'medium', expanded: 'high' }
    if (/^gpt-6\.1-sol(?:$|-)/.test(model)) return { quick: 'low', standard: 'medium', expanded: 'high' }
    if (/^gpt-5(?:$|-(?:mini|nano|\d{4}))/i.test(model)) return { quick: 'minimal', standard: 'medium', expanded: 'high' }
    if (/^o(?:1|3(?:-mini)?|4-mini)(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) return { quick: 'low', standard: 'medium', expanded: 'high' }
    if (/^(?:o1-(?:preview|mini)|o[13]-pro|gpt-5(?:\.\d+)?-pro)(?:$|-)/.test(model)) return { defaultLevel: 'high' }
  }
  if (provider === 'anthropic') {
    if (/^claude-(?:sonnet|opus|haiku)-4-5(?:$|-)/.test(model)) {
      return { quick: 'none', standard: 'medium', expanded: 'high', defaultLevel: 'none', protocol: 'anthropic-budget' }
    }
    if (/^claude-(?:sonnet|opus)-4-[6-9](?:$|-)|^claude-(?:sonnet|opus|haiku|fable)-5(?:$|[-.])/.test(model)) {
      return { quick: 'low', standard: 'medium', expanded: 'high' }
    }
  }
  if (provider === 'google') {
    if (/^gemini-2\.5-(?:flash|pro)(?:$|-)/.test(model)) {
      return { quick: model.includes('-pro') ? 'low' : 'none', standard: 'medium', expanded: 'high', protocol: 'gemini-budget' }
    }
    if (/^gemini-3(?:\.\d+)?-(?:pro|flash)(?:$|-)/.test(model) && !/-(?:image|tts|live)/.test(model)) {
      return { quick: 'low', standard: /^gemini-3-pro(?:$|-)/.test(model) ? undefined : 'medium', expanded: 'high' }
    }
  }
  if (provider === 'groq' && /^openai\/gpt-oss-(?:20b|120b)$/.test(model)) return { quick: 'low', standard: 'medium', expanded: 'high', defaultLevel: 'medium' }
  if (provider === 'deepseek') {
    if (/^deepseek-(?:flash|v4-(?:flash|pro))$/.test(model)) return { quick: 'low', standard: 'high', expanded: 'max', defaultLevel: 'high' }
    if (model === 'deepseek-reasoner') return { defaultLevel: 'high' }
  }
}

async function metadata(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(2500) })
  if (!response.ok) throw new Error('Reasoning metadata unavailable')
  return response.json()
}

export async function getReasoningProfile(config: ReasoningConnection): Promise<Profile | undefined> {
  const builtIn = nativeProfile(config)
  if (builtIn) return builtIn
  const { provider } = config
  if (provider !== 'ollama' && provider !== 'openai-compatible' && provider !== 'openrouter') return undefined
  const profile = await catalogCache.get(reasoningModelKey(config), async () =>
    (await discoverProfile(config).catch(() => undefined)) ?? false)
  return profile || undefined
}

async function discoverProfile({ provider, model, apiKey, baseUrl }: ReasoningConnection): Promise<Profile | undefined> {
  if (provider === 'ollama') {
    const base = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '')
    const { thinking } = ollamaInfo.parse(await metadata(`${base}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    }))
    const profile = thinking && fromLevels(thinking.values.filter(value => typeof value === 'boolean' || ['low', 'medium', 'high'].includes(value)), thinking.default)
    return profile && { ...profile, protocol: 'ollama' }
  }
  if (provider === 'openrouter') {
    const models = await openRouterCache.get('catalog', async () =>
      routerCatalog.parse(await metadata('https://openrouter.ai/api/v1/models')).data)
    const entry = models.find((item) => item.id === model)
    if (entry?.supported_parameters?.includes('reasoning')) return { quick: 'low', standard: 'medium', expanded: 'high', protocol: 'openrouter' }
    return undefined
  }
  if (provider !== 'openai-compatible') return undefined
  const models = await discoverEndpointModels(provider, 'textGeneration', normalizeCompatibleBaseUrl(baseUrl || COMPATIBLE_BASE_URL), apiKey, false, 2500)
  const advertised = models.find((item) => item.id === model)?.capabilities.reasoning
  const profile = advertised && fromLevels(advertised.levels, advertised.defaultLevel)
  return profile && {
    ...profile,
    protocol: advertised?.levels.every(value => typeof value === 'boolean') ? 'compatible-toggle' : 'compatible',
  }
}

export function reasoningModelKey({ provider, model, baseUrl, apiKey }: ReasoningConnection): string {
  return createHash('sha256').update(JSON.stringify([provider, model, baseUrl ?? '', apiKey ?? ''])).digest('hex')
}

export async function reasoningPresets(config: ReasoningConnection): Promise<ReasoningPreset[]> {
  const profile = await getReasoningProfile(config)
  return [
    ...(profile?.quick ? ['quick' as const] : []),
    'standard',
    ...(profile?.expanded ? ['expanded' as const] : []),
  ]
}

export class UnsupportedReasoningPreset extends Error {
  constructor() { super('This model does not support the selected reasoning preset.') }
}

export async function validateReasoningPreset(config: ReasoningConnection, embeddings = false) {
  const preset = config.reasoningPreset
  if (preset && preset !== 'standard' && (embeddings || !(await reasoningPresets(config)).includes(preset))) {
    throw new UnsupportedReasoningPreset()
  }
}

type CallOptions = Pick<LanguageModelCallOptions, 'reasoning' | 'temperature'> & {
  providerOptions?: Parameters<typeof generateText>[0]['providerOptions']
  maxOutputTokens: number
}

export async function reasoningCall(
  config: ReasoningConnection,
  visibleTokens: number,
  { temperature, quickDefault = false, override, styleFallback = false }: { temperature?: number; quickDefault?: boolean; override?: ReasoningPreset; styleFallback?: boolean } = {}
): Promise<{ options: CallOptions; preset: ReasoningPreset; ollamaThinking?: boolean; tokenOverhead?: number }> {
  const explicit = override ?? config.reasoningPreset
  // Generic endpoints without an opted-in preset keep their original request and avoid a metadata round trip.
  const profile = !explicit && ['openai-compatible', 'openrouter'].includes(config.provider)
    ? undefined : await getReasoningProfile(config)
  const wanted = explicit ?? (quickDefault && profile?.quick ? 'quick' : 'standard')
  const selected = wanted === 'quick' ? profile?.quick : wanted === 'expanded' ? profile?.expanded : explicit ? profile?.standard : undefined
  if (override && wanted !== 'standard' && !selected && !styleFallback) throw new UnsupportedReasoningPreset()
  const preset = selected || styleFallback ? wanted : 'standard'
  const thinking = Boolean(profile && (selected ?? profile.defaultLevel) !== 'none')
  const headroom = thinking ? (preset === 'expanded' ? 4096 : preset === 'quick' ? 768 : 2048) : 0
  const options: CallOptions = {
    maxOutputTokens: visibleTokens + headroom,
    ...(temperature !== undefined && (!thinking || !['openai', 'anthropic', 'deepseek'].includes(config.provider)) && { temperature }),
  }
  if (!selected) return { options, preset }
  if (profile?.protocol === 'anthropic-budget' && thinking) {
    options.providerOptions = { anthropic: { thinking: { type: 'enabled', budgetTokens: headroom } } }
    // The Anthropic SDK adds the manual budget to the requested visible-output limit.
    options.maxOutputTokens = visibleTokens
    return { options, preset, tokenOverhead: headroom }
  }
  if (profile?.protocol === 'gemini-budget') {
    options.providerOptions = { google: { thinkingConfig: { thinkingBudget: headroom } } }
    return { options, preset }
  }
  if (profile?.protocol === 'ollama' && (selected === 'none' || selected === 'on')) {
    return { options, preset, ollamaThinking: selected === 'on' }
  }
  if (profile?.protocol === 'compatible-toggle') {
    options.providerOptions = { 'openai-compatible': { enable_thinking: selected === 'on' } }
  } else if (profile?.protocol === 'compatible') {
    options.providerOptions = { openaiCompatible: { reasoningEffort: selected } }
  } else if (profile?.protocol === 'openrouter') {
    options.providerOptions = { openrouter: { reasoning: { effort: selected }, provider: { require_parameters: true } } }
  } else if (selected !== 'on') {
    options.reasoning = selected
    if (config.provider === 'openai') options.providerOptions = { openai: { reasoningSummary: null } }
  }
  return { options, preset }
}

export interface ReasonedModel {
  model: LanguageModel
  options: CallOptions
  preset: ReasoningPreset
  modelKey: string
  tokenOverhead?: number
}
