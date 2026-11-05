import { useCallback, useEffect, useState } from 'react'
import { assistantRequest } from './useConversations'
import type {
  EncoreMemory,
  EncorePlan,
  EncoreAction,
  EncoreCollection,
  EncoreCuration,
  CurationRun,
} from '@aperture/core/encore'
export interface Workbench {
  memories: EncoreMemory[]
  plans: EncorePlan[]
  actions: EncoreAction[]
  collections: EncoreCollection[]
  curations: EncoreCuration[]
  runs: CurationRun[]
}
export function useWorkbench() {
  const [data, setData] = useState<Workbench>({
    memories: [],
    plans: [],
    actions: [],
    collections: [],
    curations: [],
    runs: [],
  })
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const load = useCallback(async () => {
    setData(await assistantRequest<Workbench>('/api/assistant/workbench'))
  }, [])
  useEffect(() => {
    let live = true
    void assistantRequest<Workbench>('/api/assistant/workbench')
      .then((result) => {
        if (live) setData(result)
      })
      .catch((e) => {
        if (live) setError(String(e))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])
  const command = useCallback(
    async (name: string, input: unknown) => {
      setBusy(true)
      setError('')
      try {
        const result = await assistantRequest(`/api/assistant/workbench/${name}`, {
          method: 'POST',
          body: JSON.stringify(input),
        })
        await load()
        return result
      } catch (e) {
        setError(String(e))
        throw e
      } finally {
        setBusy(false)
      }
    },
    [load]
  )
  const approve = useCallback(
    async (id: string) => {
      setBusy(true)
      setError('')
      try {
        await assistantRequest(`/api/assistant/actions/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ approved: true }),
        })
        await load()
      } catch (e) {
        setError(String(e))
        await load()
      } finally {
        setBusy(false)
      }
    },
    [load]
  )
  const controlCuration = useCallback(
    async (id: string, operation: 'enable' | 'pause' | 'run' | 'delete') => {
      setBusy(true)
      setError('')
      try {
        await assistantRequest(`/api/assistant/curations/${id}/control`, {
          method: 'POST',
          body: JSON.stringify({ operation, approved: true }),
        })
        await load()
      } catch (e) {
        setError(String(e))
        throw e
      } finally {
        setBusy(false)
      }
    },
    [load]
  )
  return { controlCuration, data, loading, busy, error, command, approve, load }
}
