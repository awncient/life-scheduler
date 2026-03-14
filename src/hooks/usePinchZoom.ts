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
  const zoomRef = useRef(zoomLevel)
  const pendingZoom = useRef<number | null>(null)
  const rafId = useRef(0)

  // zoomRefを常に最新に保つ
  zoomRef.current = zoomLevel

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
        initialZoom.current = zoomRef.current
        pendingZoom.current = null

        // ピンチ中心のY座標（コンテナ内相対位置）
        const centerClientY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        pinchCenterY.current = centerClientY - rect.top
        initialScrollTop.current = el.scrollTop
      }
    }

    const applyZoom = () => {
      rafId.current = 0
      if (pendingZoom.current === null) return

      const nextZoom = pendingZoom.current
      pendingZoom.current = null
      const prevZoom = zoomRef.current

      if (Math.abs(nextZoom - prevZoom) < 0.01) return

      // ズーム変更前のピンチ中心のコンテンツ上の位置
      const contentY = el.scrollTop + pinchCenterY.current
      // 新しいズームでの同じコンテンツ位置
      const ratio = nextZoom / prevZoom
      const newScrollTop = contentY * ratio - pinchCenterY.current

      // ステートを更新（これが再レンダーをトリガー）
      setZoomLevel(nextZoom)
      // zoomRefを即座に更新（次のRAFで正しい値を使うため）
      zoomRef.current = nextZoom

      // 次フレームでスクロール位置を補正（レンダー後）
      requestAnimationFrame(() => {
        el.scrollTop = Math.max(0, newScrollTop)
      })
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
          // 0.5単位にスナップ（レンダー回数を減らす）
          const snapped = Math.round(clampedZoom * 2) / 2

          pendingZoom.current = snapped

          // RAFが未予約の場合のみ予約（1フレームに1回だけ更新）
          if (!rafId.current) {
            rafId.current = requestAnimationFrame(applyZoom)
          }
        }
      }
    }

    const onTouchEnd = () => {
      if (isPinching.current) {
        isPinching.current = false
        initialDistance.current = 0

        // 未処理のRAFをキャンセル
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
          rafId.current = 0
        }

        // 最終値を適用
        if (pendingZoom.current !== null) {
          const finalZoom = pendingZoom.current
          pendingZoom.current = null

          const contentY = el.scrollTop + pinchCenterY.current
          const ratio = finalZoom / zoomRef.current
          const newScrollTop = contentY * ratio - pinchCenterY.current

          setZoomLevel(finalZoom)
          zoomRef.current = finalZoom

          requestAnimationFrame(() => {
            el.scrollTop = Math.max(0, newScrollTop)
          })
        }
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
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [setZoomLevel])

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
