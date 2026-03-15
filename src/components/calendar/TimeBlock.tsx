import { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react'
import type { TimeBlock as TimeBlockType } from '@/types'
import { slotToTime, SLOT_COUNT } from '@/types'

const LONG_PRESS_MS = 400
const MOVE_THRESHOLD = 8
const SLOTS_PER_15MIN = 3
const COPY_THRESHOLD_PX = 60

type Props = {
  block: TimeBlockType
  slotHeight: number
  onTap: (block: TimeBlockType) => void
  onDragEnd?: (block: TimeBlockType, newStartSlot: number) => void
  onCopyToActual?: (block: TimeBlockType, newStartSlot: number) => void
  layoutCol?: number
  layoutTotalCols?: number
}

export function TimeBlockItem({ block, slotHeight, onTap, onDragEnd, onCopyToActual, layoutCol = 0, layoutTotalCols = 1 }: Props) {
  const duration = block.endTime - block.startTime
  const [dragOffset, setDragOffset] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [isDragActive, setIsDragActive] = useState(false)

  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const startY = useRef(0)
  const startX = useRef(0)
  const fingerMoved = useRef(false)
  const dragMoved = useRef(false)
  const dragActiveRef = useRef(false)
  const dragOffsetRef = useRef(0)
  const dragXRef = useRef(0)
  const elementRef = useRef<HTMLDivElement>(null)

  // Keep refs for callbacks
  const blockRef = useRef(block)
  blockRef.current = block
  const onTapRef = useRef(onTap)
  onTapRef.current = onTap
  const onDragEndRef = useRef(onDragEnd)
  onDragEndRef.current = onDragEnd
  const onCopyRef = useRef(onCopyToActual)
  onCopyRef.current = onCopyToActual

  const top = block.startTime * slotHeight + dragOffset
  const height = Math.max(16, duration * slotHeight - 1)
  const timeLabel = `${slotToTime(block.startTime)}–${slotToTime(block.endTime)}`
  const snap15min = slotHeight * SLOTS_PER_15MIN

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  useEffect(() => {
    const el = elementRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      fingerMoved.current = false
      dragMoved.current = false
      dragActiveRef.current = false
      dragOffsetRef.current = 0
      dragXRef.current = 0
      startY.current = touch.clientY
      startX.current = touch.clientX
      setDragOffset(0)
      setDragX(0)

      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null
        if (!fingerMoved.current) {
          dragActiveRef.current = true
          setIsDragActive(true)
        }
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      const dy = touch.clientY - startY.current
      const dx = touch.clientX - startX.current

      if (!dragActiveRef.current) {
        if (Math.abs(dy) > MOVE_THRESHOLD || Math.abs(dx) > MOVE_THRESHOLD) {
          fingerMoved.current = true
          cancelLongPress()
        }
        return
      }

      // Drag active — prevent scroll, update position
      e.preventDefault()
      e.stopPropagation()
      dragMoved.current = true
      const snappedY = Math.round(dy / snap15min) * snap15min
      dragOffsetRef.current = snappedY
      dragXRef.current = dx
      setDragOffset(snappedY)
      setDragX(dx)
    }

    const onTouchEnd = () => {
      cancelLongPress()
      const b = blockRef.current

      if (dragActiveRef.current && dragMoved.current) {
        // Check for copy-to-actual (drag right)
        if (onCopyRef.current && dragXRef.current > COPY_THRESHOLD_PX) {
          // Copy at dragged Y position, snapped to 15min
          const slotDelta = Math.round(dragOffsetRef.current / slotHeight)
          const snappedDelta = Math.round(slotDelta / SLOTS_PER_15MIN) * SLOTS_PER_15MIN
          const dur = b.endTime - b.startTime
          const newStart = Math.max(0, Math.min(SLOT_COUNT - dur, b.startTime + snappedDelta))
          onCopyRef.current(b, newStart)
        } else if (onDragEndRef.current) {
          const slotDelta = Math.round(dragOffsetRef.current / slotHeight)
          const snappedDelta = Math.round(slotDelta / SLOTS_PER_15MIN) * SLOTS_PER_15MIN
          const dur = b.endTime - b.startTime
          const newStart = Math.max(0, Math.min(SLOT_COUNT - dur, b.startTime + snappedDelta))
          onDragEndRef.current(b, newStart)
        }
      } else if (!fingerMoved.current && !dragActiveRef.current) {
        onTapRef.current(b)
      }

      dragOffsetRef.current = 0
      dragXRef.current = 0
      setDragOffset(0)
      setDragX(0)
      setIsDragActive(false)
      dragActiveRef.current = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      cancelLongPress()
    }
  }, [slotHeight, snap15min, cancelLongPress])

  // Desktop: simple click
  const handleClick = useCallback(() => {
    onTap(block)
  }, [block, onTap])

  const showCopyHint = isDragActive && dragX > 40

  // 時間ラベルがはみ出すかどうかを測定
  const [showTimeLabel, setShowTimeLabel] = useState(true)
  const timeLabelRef = useRef<HTMLDivElement>(null)
  const blockContainerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = blockContainerRef.current
    const label = timeLabelRef.current
    if (!container || !label) {
      setShowTimeLabel(false)
      return
    }
    // ラベルの下端がコンテナの下端を超えるかチェック
    const containerBottom = container.clientHeight
    const labelBottom = label.offsetTop + label.offsetHeight
    setShowTimeLabel(labelBottom <= containerBottom)
  }, [height, slotHeight, block.title])

  return (
    <div
      ref={(el) => {
        (elementRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        ;(blockContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      }}
      className={`absolute rounded px-1 py-0.5 text-xs overflow-hidden select-none ${
        isDragActive ? 'opacity-80 z-20 cursor-grabbing shadow-lg ring-2 ring-white/50' : 'cursor-pointer'
      } ${showCopyHint ? 'ring-blue-400' : ''}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: isDragActive ? '2px' : `${(layoutCol / layoutTotalCols) * 100}%`,
        width: isDragActive ? 'calc(100% - 4px)' : `${(1 / layoutTotalCols) * 100}%`,
        paddingLeft: '4px',
        paddingRight: '2px',
        backgroundColor: block.color,
        color: '#ffffff',
        minHeight: '16px',
        transform: isDragActive ? `translateX(${dragX}px)` : undefined,
        zIndex: isDragActive ? 20 : layoutCol + 1,
      }}
      onClick={handleClick}
    >
      <div className="font-medium leading-tight break-words">{block.title || '（タイトルなし）'}</div>
      <div
        ref={timeLabelRef}
        className="opacity-60 text-[10px] leading-tight"
        style={{ visibility: showTimeLabel ? 'visible' : 'hidden', position: showTimeLabel ? 'relative' : 'absolute' }}
      >
        {timeLabel}
      </div>
      {showCopyHint && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded text-[10px] font-bold text-white">
          実際にコピー
        </div>
      )}
    </div>
  )
}
