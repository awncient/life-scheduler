import { useRef, useState, useCallback } from 'react'
import type { TimeBlock as TimeBlockType } from '@/types'
import { slotToTime, SLOT_COUNT } from '@/types'

type Props = {
  block: TimeBlockType
  slotHeight: number
  onTap: (block: TimeBlockType) => void
  onDragEnd?: (block: TimeBlockType, newStartSlot: number) => void
}

export function TimeBlockItem({ block, slotHeight, onTap, onDragEnd }: Props) {
  const duration = block.endTime - block.startTime
  const [dragOffset, setDragOffset] = useState(0)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const hasMoved = useRef(false)

  const top = block.startTime * slotHeight + dragOffset
  const height = duration * slotHeight
  const timeLabel = `${slotToTime(block.startTime)}–${slotToTime(block.endTime)}`

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true
    hasMoved.current = false
    startY.current = e.clientY
    setDragOffset(0)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const dy = e.clientY - startY.current
    if (Math.abs(dy) > 4) hasMoved.current = true
    setDragOffset(dy)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false

    if (hasMoved.current && onDragEnd) {
      const slotDelta = Math.round(dragOffset / slotHeight)
      const newStart = Math.max(0, Math.min(SLOT_COUNT - duration, block.startTime + slotDelta))
      onDragEnd(block, newStart)
    }
    setDragOffset(0)
  }, [dragOffset, slotHeight, block, duration, onDragEnd])

  const handleClick = useCallback(() => {
    if (!hasMoved.current) {
      onTap(block)
    }
  }, [block, onTap])

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-white text-xs overflow-hidden cursor-grab select-none ${isDragging.current ? 'opacity-70 z-20' : ''}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: block.color,
        minHeight: '16px',
        touchAction: 'none',
      }}
      onClick={handleClick}
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
