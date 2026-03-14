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
  const pinchCenterY = useRef(0)
  const initialScrollTop = useRef(0)

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

        // ピンチ中心のY座標（コンテナ内相対位置）
        const centerClientY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        pinchCenterY.current = centerClientY - rect.top
        initialScrollTop.current = el.scrollTop
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
          const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom.current * scale))

          // ピンチ中心のコンテンツ上の位置を維持する
          const contentY = initialScrollTop.current + pinchCenterY.current
          const ratio = next / initialZoom.current
          const newContentY = contentY * ratio
          const newScrollTop = newContentY - pinchCenterY.current

          setZoomLevel(next)

          // 次フレームでスクロール位置を補正
          requestAnimationFrame(() => {
            el.scrollTop = Math.max(0, newScrollTop)
          })
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
