import { useEffect, useState } from 'react'
export interface MobileViewport {
  height: number
  top: number
  keyboard: boolean
}
/** Follow the visible viewport on browsers where keyboards do not resize layout. */
export function useMobileViewport(enabled: boolean) {
  const [viewport, setViewport] = useState<MobileViewport | null>(null)
  useEffect(() => {
    if (!enabled) {
      setViewport(null)
      return
    }
    let baseline = window.innerHeight
    const root = document.documentElement
    const previousHeight = root.style.getPropertyValue('--ap-viewport-height'),
      previousTop = root.style.getPropertyValue('--ap-viewport-top')
    const visual = window.visualViewport
    const update = () => {
      const target = document.activeElement
      const editing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute('contenteditable') === 'true'
      const height = visual?.height ?? window.innerHeight
      if (!editing) baseline = window.innerHeight
      // Pinch zoom is navigation, not a software keyboard; preserve browser zoom behavior.
      const zoomed = Boolean(visual && Math.abs(visual.scale - 1) > 0.05)
      const next = {
        height: zoomed ? window.innerHeight : Math.round(height),
        top: zoomed ? 0 : Math.round(visual?.offsetTop ?? 0),
        keyboard: !zoomed && editing && baseline - height > 120,
      }
      root.style.setProperty('--ap-viewport-height', `${next.height}px`)
      root.style.setProperty('--ap-viewport-top', `${next.top}px`)
      setViewport((previous) =>
        previous?.height === next.height &&
        previous.top === next.top &&
        previous.keyboard === next.keyboard
          ? previous
          : next
      )
    }
    const rotate = () => {
      baseline = window.innerHeight
      update()
    }
    visual?.addEventListener('resize', update)
    visual?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', rotate)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    update()
    return () => {
      if (previousHeight) root.style.setProperty('--ap-viewport-height', previousHeight)
      else root.style.removeProperty('--ap-viewport-height')
      if (previousTop) root.style.setProperty('--ap-viewport-top', previousTop)
      else root.style.removeProperty('--ap-viewport-top')
      visual?.removeEventListener('resize', update)
      visual?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', rotate)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [enabled])
  return viewport
}
