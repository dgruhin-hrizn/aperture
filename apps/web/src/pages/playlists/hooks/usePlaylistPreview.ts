import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { apiJson } from '../../../lib/api'

export function usePlaylistPreview<T>(path: string, enabled = true) {
  const userId = useAuth().user?.id
  const identity = `${userId}:${path}`
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ identity: string; items: T[]; total: number } | null>(null)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '250px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, identity])
  useEffect(() => {
    const changed = () => setRevision((n) => n + 1)
    window.addEventListener('aperture:playlist-changed', changed)
    return () => window.removeEventListener('aperture:playlist-changed', changed)
  }, [])
  useEffect(() => {
    if (!userId || !enabled || !visible) return
    const controller = new AbortController()
    setPending(true)
    void apiJson<{ items: T[]; total: number }>(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ identity, items: data.items, total: data.total })
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [userId, identity, path, enabled, visible, revision])
  return {
    ref,
    items: state?.identity === identity ? state.items : [],
    total: state?.identity === identity ? state.total : null,
    loading: enabled && (!visible || pending),
  }
}
