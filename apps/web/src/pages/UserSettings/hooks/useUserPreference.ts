import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface UseUserPreferenceOptions<T> {
  fetchUrl: string
  parse: (data: Record<string, unknown>) => T
  enabled?: boolean
}

interface SaveUserPreferenceOptions<T> {
  saveUrl: string
  method?: 'PATCH' | 'PUT' | 'POST'
  buildBody: (value: T) => Record<string, unknown>
  successMessageKey?: string
}

export function useUserPreference<T>(
  options: UseUserPreferenceOptions<T>,
  saveOptions?: SaveUserPreferenceOptions<T>
) {
  const { t } = useTranslation()
  const { fetchUrl, parse, enabled = true } = options
  const [value, setValue] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchValue = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(fetchUrl, { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>
        setValue(parse(data))
      }
    } catch {
      // Optional load failures may degrade gracefully
    } finally {
      setLoading(false)
    }
  }, [enabled, fetchUrl, parse])

  const saveValue = useCallback(
    async (nextValue: T) => {
      if (!saveOptions) return false
      setSaving(true)
      setError(null)
      setSuccess(null)
      try {
        const response = await fetch(saveOptions.saveUrl, {
          method: saveOptions.method ?? 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(saveOptions.buildBody(nextValue)),
        })
        if (response.ok) {
          setValue(nextValue)
          if (saveOptions.successMessageKey) {
            setSuccess(t(saveOptions.successMessageKey))
            window.setTimeout(() => setSuccess(null), 3000)
          }
          return true
        }
        const err = (await response.json().catch(() => ({}))) as { error?: string }
        setError(err.error || t('userSettings.errSavePreference'))
        return false
      } catch {
        setError(t('userSettings.errConnectServer'))
        return false
      } finally {
        setSaving(false)
      }
    },
    [saveOptions, t]
  )

  const patchValue = useCallback(
    async (partial: Partial<T>, merge: (current: T, partial: Partial<T>) => T) => {
      if (value === null) return false
      return saveValue(merge(value, partial))
    },
    [saveValue, value]
  )

  return {
    value,
    setValue,
    loading,
    saving,
    error,
    setError,
    success,
    setSuccess,
    fetchValue,
    saveValue,
    patchValue,
  }
}
