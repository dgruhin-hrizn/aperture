import { useEffect, useRef, useState } from 'react'

/** Do not start media-server requests or TMDb fallbacks for offscreen portraits. */
export function useVisibleImage() {
  const imageRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const element = imageRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { imageRef, visible }
}
