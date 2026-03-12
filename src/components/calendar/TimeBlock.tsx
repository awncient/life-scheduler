import { useRef, useState, useCallback } from 'react'
import type { TimeBlock as TimeBlockType } from '@/types'
import { slotToTime, SLOT_COUNT } from '@/types'

const LONG_PRESS_MS = 300

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
  const hasMoved = useRef(false)
  const elementRef = useRef<HTMLDivElement>(null)

  const top = block.startTime * slotHeight + dragOffset
  const height = duration * slotHeight
  const timeLabel = `${slotToTime(block.startTime)}–${slotToTime(block.endTime)}`

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    hasMoved.current = false
    startY.current = e.clientY
    pointerIdRef.current = e.pointerId
    setDragOffset(0)

    // Start long-press timer — only activate drag after hold
    longPressTimer.current = setTimeout(() => {
      setIsDragActive(true)
      // Capture pointer only after long press confirmed
      if (elementRef.current && pointerIdRef.current !== null) {
        elementRef.current.setPointerCapture(pointerIdRef.current)
      }
    }, LONG_PRESS_MS)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dy = e.clientY - startY.current

    // If finger moves before long-press triggers, cancel drag (allow scroll)
    if (!isDragActive) {
      if (Math.abs(dy) > 8) {
        cancelLongPress()
      }
      return
    }

    // Drag active: move the block
    hasMoved.current = true
    setDragOffset(dy)
  }, [isDragActive, cancelLongPress])

  const handlePointerUp = useCallback(() => {
    cancelLongPress()

    if (isDragActive && hasMoved.current && onDragEnd) {
      const slotDelta = Math.round(dragOffset / slotHeight)
      const newStart = Math.max(0, Math.min(SLOT_COUNT - duration, block.startTime + slotDelta))
      onDragEnd(block, newStart)
    } else if (!hasMoved.current && !isDragActive) {
      onTap(block)
    }

    setDragOffset(0)
    setIsDragActive(false)
    pointerIdRef.current = null
  }, [isDragActive, dragOffset, slotHeight, block, duration, onDragEnd, onTap, cancelLongPress])

  return (
    <div
      ref={elementRef}
      className={`absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-white text-xs overflow-hidden select-none ${
        isDragActive ? 'opacity-70 z-20 cursor-grabbing shadow-lg' : 'cursor-pointer'
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
