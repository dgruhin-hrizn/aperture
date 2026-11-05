import { useEffect, useRef, useState } from 'react'

export function useCarouselScroll(count: number, rtl: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ previous: false, next: false })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const extent = element.scrollWidth - element.clientWidth
      const offset = Math.max(0, Math.min(Math.abs(element.scrollLeft), extent))
      const next = { previous: offset > 2, next: extent - offset > 2 }
      setEdges((old) => (old.previous === next.previous && old.next === next.next ? old : next))
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(element)
    element.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      observer?.disconnect()
      element.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [count, rtl])
  function scroll(next: boolean) {
    const element = ref.current
    if (!element) return
    element.scrollBy({
      left: (element.clientWidth + 12) * (next ? 1 : -1) * (rtl ? -1 : 1),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }
  return { ref, edges, scroll }
}
