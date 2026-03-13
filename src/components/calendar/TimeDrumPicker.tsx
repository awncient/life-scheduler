import { useRef, useEffect, useCallback } from 'react'

const ITEM_HEIGHT = 40
const VISIBLE_ITEMS = 5
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2)

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

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    const el = containerRef.current
    if (!el) return
    const target = index * ITEM_HEIGHT
    if (smooth) {
      el.scrollTo({ top: target, behavior: 'smooth' })
    } else {
      el.scrollTop = target
    }
  }, [])

  // Scroll to selected on mount and when selectedIndex changes
  useEffect(() => {
    scrollToIndex(selectedIndex, false)
  }, [selectedIndex, scrollToIndex])

  const snapToNearest = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const index = Math.round(el.scrollTop / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(items.length - 1, index))
    scrollToIndex(clamped)
    onChange(clamped)
  }, [items.length, onChange, scrollToIndex])

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
    // Apply momentum then snap
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

  const handleItemClick = useCallback((index: number) => {
    if (suppressClick.current) return
    scrollToIndex(index)
    onChange(index)
  }, [scrollToIndex, onChange])

  // Handle mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return
    el.scrollTop += e.deltaY
    // Debounce snap
    cancelAnimationFrame(animFrame.current)
    animFrame.current = requestAnimationFrame(() => {
      setTimeout(snapToNearest, 100)
    })
  }, [snapToNearest])

  const paddingTop = CENTER_INDEX * ITEM_HEIGHT
  const paddingBottom = (VISIBLE_ITEMS - CENTER_INDEX - 1) * ITEM_HEIGHT

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
          {items.map((item, i) => {
            const isSelected = i === selectedIndex
            return (
              <div
                key={i}
                className={`flex items-center justify-center cursor-pointer select-none transition-colors ${
                  isSelected ? 'text-slate-900 font-bold text-lg' : 'text-slate-400 text-base'
                }`}
                style={{ height: ITEM_HEIGHT }}
                onClick={() => handleItemClick(i)}
              >
                {item}
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
