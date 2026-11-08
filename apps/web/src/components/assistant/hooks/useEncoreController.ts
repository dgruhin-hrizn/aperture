import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { encoreViews, type EncoreControl, type EncoreView } from '../encoreContext'

export function useEncoreController(): EncoreControl {
  const [open, setOpen] = useState(false)
  const [view, selectView] = useState<EncoreView>('chat')
  const location = useLocation()
  const navigate = useNavigate()
  const openEncore = useCallback((next?: EncoreView) => {
    if (next) selectView(next)
    setOpen(true)
  }, [])
  const closeEncore = useCallback(() => setOpen(false), [])
  useEffect(() => {
    if (location.pathname !== '/encore') return
    const requested = new URLSearchParams(location.search).get('view')
    openEncore(encoreViews.find((value) => value === requested) ?? 'chat')
    void navigate('/dashboard', { replace: true })
  }, [location.pathname, location.search, navigate, openEncore])
  return useMemo(
    () => ({ open, view, openEncore, closeEncore, selectView }),
    [open, view, openEncore, closeEncore]
  )
}
