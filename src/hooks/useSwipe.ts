import { useState, useRef, useEffect, useCallback } from 'react'

const SNAP_THRESHOLD = 0.35
const ANIM_MS = 250
const DIR_THRESHOLD = 8

/**
 * Horizontal swipe hook for calendar navigation.
 * Coexists with usePinchZoom (ignores multi-touch).
 * Uses non-passive touchmove to preventDefault during horizontal swipe,
 * preventing vertical scroll while swiping horizontally.
 */
export function useSwipe(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onNavigate: (delta: number) => void,
  viewKey: string,
) {
  const [offsetX, setOffsetX] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const direction = useRef<'h' | 'v' | null>(null)
  const isDragging = useRef(false)
  const containerWidth = useRef(0)
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  // Reset on viewKey change (after navigation)
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
  }, [isAnimating, containerRef])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1 || isAnimating) return

    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    // Determine direction on first significant move
    if (direction.current === null) {
      if (Math.abs(dx) > DIR_THRESHOLD || Math.abs(dy) > DIR_THRESHOLD) {
        direction.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      return
    }

    if (direction.current !== 'h') return

    // Horizontal swipe: prevent vertical scrolling
    e.preventDefault()
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
    if (width === 0) {
      setOffsetX(0)
      return
    }

    const ratio = Math.abs(offsetX) / width

    if (ratio > SNAP_THRESHOLD) {
      // Animate to full width, then navigate
      const targetX = offsetX > 0 ? width : -width
      setIsAnimating(true)
      setOffsetX(targetX)

      setTimeout(() => {
        const delta = offsetX > 0 ? -1 : 1
        onNavigateRef.current(delta)
        // viewKey change will reset via useEffect
      }, ANIM_MS)
    } else {
      // Snap back
      setIsAnimating(true)
      setOffsetX(0)
      setTimeout(() => setIsAnimating(false), ANIM_MS)
    }
  }, [offsetX])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    // Non-passive so we can preventDefault during horizontal swipe
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd])

  const swipeStyle = {
    transform: `translateX(calc(-33.333% + ${offsetX}px))`,
    transition: isAnimating ? `transform ${ANIM_MS}ms ease-out` : 'none',
  }

  return { offsetX, isAnimating, swipeStyle }
}
