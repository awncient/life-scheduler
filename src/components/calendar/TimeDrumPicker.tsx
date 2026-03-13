import { useRef, useEffect, useCallback } from 'react'

const ITEM_HEIGHT = 40
const VISIBLE_ITEMS = 5
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2)
// We repeat items 3 times for seamless circular scroll
const REPEATS = 3

type DrumColumnProps = {
  items: string[]
  selectedIndex: number
  onChange: (index: number) => void
}

function DrumColumn({ items, selectedIndex, onChange }: DrumColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startScroll = useRef(0)
  const velocity = useRef(0)
  const lastY = useRef(0)
  const lastTime = useRef(0)
  const animFrame = useRef(0)
  const suppressClick = useRef(false)
  const isRecenteringRef = useRef(false)

  const count = items.length
  // The "home" offset for the middle copy of the repeated list
  const middleOffset = count * ITEM_HEIGHT

  const scrollToLogicalIndex = useCallback((index: number, smooth = true) => {
    const el = containerRef.current
    if (!el) return
    const target = middleOffset + index * ITEM_HEIGHT
    if (smooth) {
      el.scrollTo({ top: target, behavior: 'smooth' })
    } else {
      el.scrollTop = target
    }
  }, [middleOffset])

  // On mount / selectedIndex change, jump to middle copy
  useEffect(() => {
    scrollToLogicalIndex(selectedIndex, false)
  }, [selectedIndex, scrollToLogicalIndex])

  /** Silently recenter to the middle copy without visual jump */
  const recenter = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const totalSingle = count * ITEM_HEIGHT
    const scroll = el.scrollTop
    // If we've scrolled into the first or last copy, jump to the equivalent in the middle
    if (scroll < totalSingle * 0.5 || scroll >= totalSingle * 2.5) {
      isRecenteringRef.current = true
      const indexInList = Math.round(scroll / ITEM_HEIGHT) % count
      const normalised = ((indexInList % count) + count) % count
      el.scrollTop = middleOffset + normalised * ITEM_HEIGHT
      isRecenteringRef.current = false
    }
  }, [count, middleOffset])

  const snapToNearest = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    recenter()
    const scroll = el.scrollTop
    const rawIndex = Math.round(scroll / ITEM_HEIGHT)
    const logicalIndex = ((rawIndex % count) + count) % count
    scrollToLogicalIndex(logicalIndex)
    onChange(logicalIndex)
  }, [count, onChange, scrollToLogicalIndex, recenter])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true
    suppressClick.current = false
    startY.current = e.touches[0].clientY
    startScroll.current = containerRef.current?.scrollTop ?? 0
    velocity.current = 0
    lastY.current = e.touches[0].clientY
    lastTime.current = Date.now()
    cancelAnimationFrame(animFrame.current)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    const dy = startY.current - e.touches[0].clientY
    if (Math.abs(dy) > 5) suppressClick.current = true
    const el = containerRef.current
    if (el) el.scrollTop = startScroll.current + dy

    const now = Date.now()
    const dt = now - lastTime.current
    if (dt > 0) {
      velocity.current = (lastY.current - e.touches[0].clientY) / dt
    }
    lastY.current = e.touches[0].clientY
    lastTime.current = now
  }, [])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
    const el = containerRef.current
    if (!el) { snapToNearest(); return }

    const v = velocity.current
    if (Math.abs(v) > 0.3) {
      const momentum = v * 150
      el.scrollTo({
        top: el.scrollTop + momentum,
        behavior: 'smooth',
      })
      setTimeout(snapToNearest, 200)
    } else {
      snapToNearest()
    }
  }, [snapToNearest])

  const handleItemClick = useCallback((logicalIndex: number) => {
    if (suppressClick.current) return
    scrollToLogicalIndex(logicalIndex)
    onChange(logicalIndex)
  }, [scrollToLogicalIndex, onChange])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return
    el.scrollTop += e.deltaY
    cancelAnimationFrame(animFrame.current)
    animFrame.current = requestAnimationFrame(() => {
      setTimeout(snapToNearest, 100)
    })
  }, [snapToNearest])

  const paddingTop = CENTER_INDEX * ITEM_HEIGHT
  const paddingBottom = (VISIBLE_ITEMS - CENTER_INDEX - 1) * ITEM_HEIGHT

  // Build the tripled items list
  const repeatedItems: { label: string; logicalIndex: number }[] = []
  for (let r = 0; r < REPEATS; r++) {
    for (let i = 0; i < count; i++) {
      repeatedItems.push({ label: items[i], logicalIndex: i })
    }
  }

  return (
    <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      {/* Selection highlight */}
      <div
        className="absolute left-0 right-0 bg-slate-100 rounded-lg z-0 pointer-events-none"
        style={{ top: CENTER_INDEX * ITEM_HEIGHT, height: ITEM_HEIGHT }}
      />
      {/* Scroll container */}
      <div
        ref={containerRef}
        className="relative z-10 overflow-hidden touch-none"
        style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div style={{ paddingTop, paddingBottom }}>
          {repeatedItems.map((item, i) => {
            const isSelected = item.logicalIndex === selectedIndex
            return (
              <div
                key={i}
                className={`flex items-center justify-center cursor-pointer select-none transition-colors ${
                  isSelected ? 'text-slate-900 font-bold text-lg' : 'text-slate-400 text-base'
                }`}
                style={{ height: ITEM_HEIGHT }}
                onClick={() => handleItemClick(item.logicalIndex)}
              >
                {item.label}
              </div>
            )
          })}
        </div>
      </div>
      {/* Top/bottom fade masks */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white to-transparent pointer-events-none z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none z-20" />
    </div>
  )
}

type Props = {
  hours: number
  minutes: number
  onChange: (hours: number, minutes: number) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'))

export function TimeDrumPicker({ hours, minutes, onChange }: Props) {
  const minuteIndex = Math.floor(minutes / 5)

  return (
    <div className="flex items-center justify-center gap-1">
      <div className="w-16">
        <DrumColumn
          items={HOURS}
          selectedIndex={hours}
          onChange={(i) => onChange(i, minutes)}
        />
      </div>
      <div className="text-xl font-bold text-slate-400">:</div>
      <div className="w-16">
        <DrumColumn
          items={MINUTES_5}
          selectedIndex={minuteIndex}
          onChange={(i) => onChange(hours, i * 5)}
        />
      </div>
    </div>
  )
}
