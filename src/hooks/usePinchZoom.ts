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
  const initialZoom = useRef(0)
  const isPinching = useRef(false)
  const pinchCenterY = useRef(0)
  const initialScrollTop = useRef(0)
  const lastScale = useRef(1)
  const zoomRef = useRef(zoomLevel)

  // Keep zoomRef in sync
  zoomRef.current = zoomLevel

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Find the scrollable content child (first child of the scroll container)
    const getContentEl = () => el.firstElementChild as HTMLElement | null

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        isPinching.current = true
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        initialDistance.current = Math.hypot(dx, dy)
        initialZoom.current = zoomRef.current
        lastScale.current = 1

        // ピンチ中心のY座標（コンテナ内相対位置）
        const centerClientY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        pinchCenterY.current = centerClientY - rect.top
        initialScrollTop.current = el.scrollTop

        // CSSトランスフォーム用にtransformOriginを設定
        const contentEl = getContentEl()
        if (contentEl) {
          const originY = el.scrollTop + pinchCenterY.current
          contentEl.style.transformOrigin = `center ${originY}px`
          contentEl.style.willChange = 'transform'
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching.current) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        if (initialDistance.current > 0) {
          const rawScale = dist / initialDistance.current
          const targetZoom = initialZoom.current * rawScale
          const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom))
          const visualScale = clampedZoom / initialZoom.current

          lastScale.current = visualScale

          // CSSトランスフォームで即座にビジュアルフィードバック（リレンダーなし）
          const contentEl = getContentEl()
          if (contentEl) {
            contentEl.style.transform = `scaleY(${visualScale})`

            // スクロール位置をピンチ中心に合わせて補正
            const contentY = initialScrollTop.current + pinchCenterY.current
            const newContentY = contentY * visualScale
            const newScrollTop = newContentY - pinchCenterY.current
            el.scrollTop = Math.max(0, newScrollTop)
          }
        }
      }
    }

    const onTouchEnd = () => {
      if (isPinching.current) {
        isPinching.current = false
        initialDistance.current = 0

        // CSSトランスフォームをリセット
        const contentEl = getContentEl()
        if (contentEl) {
          contentEl.style.transform = ''
          contentEl.style.transformOrigin = ''
          contentEl.style.willChange = ''
        }

        // 最終的なズームレベルをReactステートに反映（0.5単位にスナップ）
        const finalZoom = initialZoom.current * lastScale.current
        const snapped = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, finalZoom)) * 2) / 2

        // スクロール位置を補正
        const ratio = snapped / zoomRef.current
        const contentY = el.scrollTop + pinchCenterY.current
        const newContentY = contentY * ratio
        const newScrollTop = newContentY - pinchCenterY.current

        setZoomLevel(snapped)

        requestAnimationFrame(() => {
          el.scrollTop = Math.max(0, newScrollTop)
        })
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
  }, [setZoomLevel]) // zoomLevelを依存から除外 — refで参照

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
