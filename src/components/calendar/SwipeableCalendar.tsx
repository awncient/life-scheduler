import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'

type Props = {
  /** Unique key for the current view (e.g. date string) — changes trigger re-center */
  viewKey: string
  onNavigate: (delta: number) => void
  renderView: (delta: number) => ReactNode
}

const SNAP_THRESHOLD = 0.35 // 35% of width to trigger navigation

export function SwipeableCalendar({ viewKey, onNavigate, renderView }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [offsetX, setOffsetX] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const direction = useRef<'h' | 'v' | null>(null)
  const isDragging = useRef(false)
  const containerWidth = useRef(0)
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  // Reset offset when viewKey changes (after navigation completes)
  useEffect(() => {
    setOffsetX(0)
    setIsAnimating(false)
  }, [viewKey])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1 || isAnimating) return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    direction.current = null
    isDragging.current = false
    containerWidth.current = containerRef.current?.offsetWidth ?? 0
  }, [isAnimating])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1 || isAnimating) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    if (direction.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        direction.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      return
    }

    if (direction.current !== 'h') return

    isDragging.current = true
    setOffsetX(dx)
  }, [isAnimating])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || direction.current !== 'h') {
      isDragging.current = false
      return
    }

    isDragging.current = false
    const width = containerWidth.current
    const ratio = Math.abs(offsetX) / width

    if (ratio > SNAP_THRESHOLD) {
      // Navigate: animate to full width, then trigger navigation
      const targetX = offsetX > 0 ? width : -width
      setIsAnimating(true)
      setOffsetX(targetX)

      // After animation completes, trigger the actual navigation
      setTimeout(() => {
        const delta = offsetX > 0 ? -1 : 1
        onNavigateRef.current(delta)
        // viewKey change will reset offsetX via the useEffect above
      }, 250)
    } else {
      // Snap back
      setIsAnimating(true)
      setOffsetX(0)
      setTimeout(() => setIsAnimating(false), 250)
    }
  }, [offsetX])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return (
    <div ref={containerRef} className="relative h-full overflow-hidden">
      <div
        className="flex h-full"
        style={{
          width: '300%',
          transform: `translateX(calc(-33.333% + ${offsetX}px))`,
          transition: isAnimating ? 'transform 250ms ease-out' : 'none',
        }}
      >
        <div className="w-1/3 h-full flex-shrink-0 overflow-hidden">
          {renderView(-1)}
        </div>
        <div className="w-1/3 h-full flex-shrink-0 overflow-hidden">
          {renderView(0)}
        </div>
        <div className="w-1/3 h-full flex-shrink-0 overflow-hidden">
          {renderView(1)}
        </div>
      </div>
    </div>
  )
}
