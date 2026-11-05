import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
export function usePaneScroll(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const { key } = useLocation(),
    navigation = useNavigationType(),
    positions = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return
    const element = ref.current
    element.scrollTop = navigation === 'POP' ? (positions.current.get(key) ?? 0) : 0
    const saved = positions.current
    return () => {
      saved.set(key, element.scrollTop)
      if (saved.size > 100) saved.delete(saved.keys().next().value!)
    }
  }, [ref, enabled, key, navigation])
}
