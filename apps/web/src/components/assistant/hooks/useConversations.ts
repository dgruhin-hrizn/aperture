import { useState, useEffect, useCallback, useRef } from 'react'
import type { UIMessage } from 'ai'

export interface Conversation { id: string; title: string; updated_at: string }
export async function assistantRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers } })
  if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error ?? `HTTP ${res.status}`) }
  return res.status === 204 ? undefined as T : res.json()
}
const base = '/api/assistant/conversations'

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<{ conversation: Conversation; messages: UIMessage[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const version = useRef(0)
  const refresh = useCallback(async () => {
    const data = await assistantRequest<{ conversations: Conversation[] }>(base)
    setConversations(data.conversations)
    return data.conversations
  }, [])
  const select = useCallback(async (id: string) => {
    const current = ++version.current
    setBusy(true); setError('')
    try {
      const data = await assistantRequest<{ conversation: Conversation; messages: UIMessage[] }>(`${base}/${id}`)
      if (current === version.current) setActive(data)
    } catch (e) { if (current === version.current) setError(String(e)) }
    finally { if (current === version.current) setBusy(false) }
  }, [])
  const create = useCallback(async () => {
    setBusy(true); setError('')
    try {
      const data = await assistantRequest<{ conversation: Conversation }>(base, { method: 'POST', body: '{}' })
      await refresh(); await select(data.conversation.id)
    } catch (e) { setError(String(e)); setBusy(false) }
  }, [refresh, select])
  const remove = useCallback(async (id: string) => {
    setBusy(true); setError('')
    try {
      await assistantRequest(`${base}/${id}`, { method: 'DELETE' })
      const next = await refresh()
      if (active?.conversation.id === id) {
        setActive(null)
        if (next[0]) await select(next[0].id)
        else await create()
      }
    } catch (e) { setError(String(e)) }
    finally { setBusy(false) }
  }, [active?.conversation.id, refresh, select, create])
  const rename = useCallback(async (id: string, title: string) => {
    setError('')
    try { await assistantRequest(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }); await refresh() }
    catch (e) { setError(String(e)) }
  }, [refresh])
  const invalidate = useCallback(() => { version.current++ }, [])
  useEffect(() => {
    let mounted = true
    void refresh().then(async (items) => {
      if (!mounted) return
      if (items[0]) await select(items[0].id)
      else await create()
    }).catch((e) => { if (mounted) setError(String(e)) })
    return () => { mounted = false; invalidate() }
  }, [refresh, select, create, invalidate])
  return { conversations, active, busy, error, refresh, select, create, remove, rename }
}
