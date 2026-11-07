import { useEffect, useState } from 'react'
import type { ReasoningPreset } from '@aperture/core'
import type { FunctionConfig } from './aiProviderInfo'

export function useModelReasoning(
  enabled: boolean,
  fn: string,
  { provider, model, baseUrl, apiKey }: FunctionConfig,
  config: FunctionConfig | null
) {
  const key = JSON.stringify([fn, provider, model, baseUrl, apiKey])
  const [available, setAvailable] = useState<{ key: string; presets: ReasoningPreset[]; nativePresets?: ReasoningPreset[] }>()
  const [draft, setDraft] = useState<{ key: string; preset: ReasoningPreset }>()
  useEffect(() => {
    if (!enabled || !model) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetch('/api/settings/ai/reasoning', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: fn, provider, model, baseUrl: baseUrl || undefined, apiKey: apiKey || undefined }),
        signal: controller.signal,
      }).then(async (response) => {
        const data = response.ok ? (await response.json()) as { presets: ReasoningPreset[]; nativePresets?: ReasoningPreset[] } : null
        if (!controller.signal.aborted) setAvailable({ key, presets: data?.presets ?? [], nativePresets: data?.nativePresets })
      }).catch(() => {
        if (!controller.signal.aborted) setAvailable({ key, presets: [] })
      })
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, fn, provider, model, baseUrl, apiKey, key])

  const presets = enabled && available?.key === key ? available.presets : []
  const current = config?.provider === provider && config.model === model && (config.baseUrl || '') === (baseUrl || '') && !apiKey
    ? config.reasoningPreset
    : undefined
  const defaultPreset = fn !== 'chat' && presets.includes('quick') ? 'quick' : 'standard'
  const preferred = draft?.key === key ? draft.preset : current
  const preset = preferred && presets.includes(preferred) ? preferred : defaultPreset
  return {
    presets,
    preset,
    styleOnly: preset !== 'standard' && !available?.nativePresets?.includes(preset),
    savedPreset: presets.length > 1 ? preset : undefined,
    setPreset: (value: ReasoningPreset) => setDraft({ key, preset: value }),
  }
}
