import { useRef, useState, useCallback, useEffect } from 'react'
import type { TimeBlock as TimeBlockType } from '@/types'
import { slotToTime, SLOT_COUNT } from '@/types'

const LONG_PRESS_MS = 400
const MOVE_THRESHOLD = 8 // px — movement beyond this = scroll intent
const SLOTS_PER_15MIN = 3

type Props = {
  block: TimeBlockType
  slotHeight: number
  onTap: (block: TimeBlockType) => void
  onDragEnd?: (block: TimeBlockType, newStartSlot: number) => void
}

export function TimeBlockItem({ block, slotHeight, onTap, onDragEnd }: Props) {
  const duration = block.endTime - block.startTime
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragActive, setIsDragActive] = useState(false)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startY = useRef(0)
  const fingerMoved = useRef(false)    // any movement at all (even before long-press)
  const dragMoved = useRef(false)      // movement after drag activated
  const gestureDecided = useRef(false) // once decided scroll/drag, don't re-decide
  const elementRef = useRef<HTMLDivElement>(null)

  const top = block.startTime * slotHeight + dragOffset
  const height = duration * slotHeight
  const timeLabel = `${slotToTime(block.startTime)}–${slotToTime(block.endTime)}`

  // Snap drag offset to 15-min grid
  const snap15min = slotHeight * SLOTS_PER_15MIN

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    fingerMoved.current = false
    dragMoved.current = false
    gestureDecided.current = false
    startY.current = e.clientY
    pointerIdRef.current = e.pointerId
    setDragOffset(0)

    // Start long-press timer
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      if (!fingerMoved.current) {
        // Long press confirmed — enter drag mode
        gestureDecided.current = true
        setIsDragActive(true)
        if (elementRef.current && pointerIdRef.current !== null) {
          try {
            elementRef.current.setPointerCapture(pointerIdRef.current)
          } catch {
            // ignore if already released
          }
        }
      }
    }, LONG_PRESS_MS)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dy = e.clientY - startY.current

    if (!isDragActive) {
      // Before drag activated: if finger moves, it's a scroll gesture
      if (Math.abs(dy) > MOVE_THRESHOLD) {
        fingerMoved.current = true
        gestureDecided.current = true
        cancelLongPress()
        // Don't capture — let parent scroll container handle it
      }
      return
    }

    // Drag mode active: snap offset to 15-min grid
    dragMoved.current = true
    const snappedOffset = Math.round(dy / snap15min) * snap15min
    setDragOffset(snappedOffset)
  }, [isDragActive, cancelLongPress, snap15min])

  const handlePointerUp = useCallback(() => {
    cancelLongPress()

    if (isDragActive && dragMoved.current && onDragEnd) {
      // Committed drag — compute new slot snapped to 15min
      const slotDelta = Math.round(dragOffset / slotHeight)
      const snappedDelta = Math.round(slotDelta / SLOTS_PER_15MIN) * SLOTS_PER_15MIN
      const newStart = Math.max(0, Math.min(SLOT_COUNT - duration, block.startTime + snappedDelta))
      onDragEnd(block, newStart)
    } else if (!fingerMoved.current && !isDragActive) {
      // No movement at all, quick release → tap to edit
      onTap(block)
    }
    // If finger moved but drag wasn't active → scroll, do nothing

    setDragOffset(0)
    setIsDragActive(false)
    pointerIdRef.current = null
  }, [isDragActive, dragOffset, slotHeight, block, duration, onDragEnd, onTap, cancelLongPress])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => cancelLongPress()
  }, [cancelLongPress])

  return (
    <div
      ref={elementRef}
      className={`absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-white text-xs overflow-hidden select-none ${
        isDragActive ? 'opacity-80 z-20 cursor-grabbing shadow-lg ring-2 ring-white/50' : 'cursor-pointer'
      }`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: block.color,
        minHeight: '16px',
        touchAction: isDragActive ? 'none' : 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="font-medium truncate leading-tight">{block.title}</div>
      {height > slotHeight * 6 && (
        <div className="opacity-75 text-[10px] leading-tight">{timeLabel}</div>
      )}
    </div>
  )
}
