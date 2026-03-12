import { useRef, useEffect } from 'react'

const SWIPE_THRESHOLD = 50
const SWIPE_VELOCITY_THRESHOLD = 0.3

export function useSwipeNavigation(onNavigate: (delta: number) => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)
  const isHorizontal = useRef<boolean | null>(null)

  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      startTime.current = Date.now()
      isHorizontal.current = null
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const dx = e.touches[0].clientX - startX.current
      const dy = e.touches[0].clientY - startY.current

      // Determine direction on first significant movement
      if (isHorizontal.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (isHorizontal.current !== true) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX.current
      const dt = (Date.now() - startTime.current) / 1000
      const velocity = Math.abs(dx) / dt

      if (Math.abs(dx) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
        const delta = dx > 0 ? -1 : 1
        onNavigateRef.current(delta)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return containerRef
}
