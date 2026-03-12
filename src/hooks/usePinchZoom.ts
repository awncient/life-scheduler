import { useRef, useCallback, useEffect } from 'react'
import { saveSettings, getSettings } from '@/lib/storage'

const MIN_ZOOM = 2
const MAX_ZOOM = 12

export function usePinchZoom(
  zoomLevel: number,
  setZoomLevel: (level: number) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialDistance = useRef(0)
  const initialZoom = useRef(zoomLevel)
  const isPinching = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        isPinching.current = true
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        initialDistance.current = Math.hypot(dx, dy)
        initialZoom.current = zoomLevel
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching.current) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        if (initialDistance.current > 0) {
          const scale = dist / initialDistance.current
          // Use continuous float for smooth rendering
          const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom.current * scale))
          setZoomLevel(next)
        }
      }
    }

    const onTouchEnd = () => {
      if (isPinching.current) {
        isPinching.current = false
        initialDistance.current = 0
        // Snap to nearest 0.5 on release for clean grid
        setZoomLevel(Math.round(zoomLevel * 2) / 2)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [zoomLevel, setZoomLevel])

  const persistZoom = useCallback(
    (level: number) => {
      const settings = getSettings()
      settings.zoomLevel = Math.round(level * 2) / 2
      saveSettings(settings)
    },
    [],
  )

  return { containerRef, persistZoom }
}
