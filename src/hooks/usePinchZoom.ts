import { useRef, useCallback } from 'react'
import { usePinch } from '@use-gesture/react'
import { getSettings, saveSettings } from '@/lib/storage'

const MIN_ZOOM = 5
const MAX_ZOOM = 20

export function usePinchZoom(
  zoomLevel: number,
  setZoomLevel: (level: number) => void,
) {
  const initialZoom = useRef(zoomLevel)

  const bind = usePinch(
    ({ first, movement: [md], memo }) => {
      if (first) {
        initialZoom.current = zoomLevel
        return initialZoom.current
      }
      const base = (memo as number) ?? initialZoom.current
      const next = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base * (1 + md / 200))))
      setZoomLevel(next)
      return base
    },
    {
      scaleBounds: { min: 0.5, max: 2 },
      pointer: { touch: true },
    },
  )

  const persistZoom = useCallback(
    (level: number) => {
      const settings = getSettings()
      settings.zoomLevel = level
      saveSettings(settings)
    },
    [],
  )

  return { bind, persistZoom }
}
