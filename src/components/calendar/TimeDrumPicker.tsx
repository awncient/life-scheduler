import { useRef, useEffect, useCallback } from 'react'

const ITEM_HEIGHT = 40
const VISIBLE_ITEMS = 5
const CENTER_INDEX = Math.floor(VISIBLE_ITEMS / 2)
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

  const count = items.length
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

  useEffect(() => {
    scrollToLogicalIndex(selectedIndex, false)
  }, [selectedIndex, scrollToLogicalIndex])

  const recenter = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const totalSingle = count * ITEM_HEIGHT
    const scroll = el.scrollTop
    if (scroll < totalSingle * 0.5 || scroll >= totalSingle * 2.5) {
      const indexInList = Math.round(scroll / ITEM_HEIGHT) % count
      const normalised = ((indexInList % count) + count) % count
      el.scrollTop = middleOffset + normalised * ITEM_HEIGHT
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

  const repeatedItems: { label: string; logicalIndex: number }[] = []
  for (let r = 0; r < REPEATS; r++) {
    for (let i = 0; i < items.length; i++) {
      repeatedItems.push({ label: items[i], logicalIndex: i })
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden touch-none"
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
              className={`flex items-center justify-center cursor-pointer select-none transition-colors text-base ${
                isSelected ? 'text-slate-900' : 'text-slate-400'
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
  const totalHeight = ITEM_HEIGHT * VISIBLE_ITEMS

  return (
    <div className="relative" style={{ height: totalHeight }}>
      {/* Full-width selection highlight */}
      <div
        className="absolute left-0 right-0 bg-slate-100 rounded-lg pointer-events-none"
        style={{ top: CENTER_INDEX * ITEM_HEIGHT, height: ITEM_HEIGHT, zIndex: 0 }}
      />
      {/* Two scrollable columns pushed toward center */}
      <div className="flex h-full relative items-stretch" style={{ zIndex: 1 }}>
        {/* Left half: tapping/scrolling here controls hours */}
        <div className="flex-1 flex justify-end">
          <div style={{ width: 56 }}>
            <DrumColumn
              items={HOURS}
              selectedIndex={hours}
              onChange={(i) => onChange(i, minutes)}
            />
          </div>
        </div>
        {/* Colon */}
        <div
          className="flex items-center justify-center text-base text-slate-400 pointer-events-none"
          style={{ width: 16, marginTop: CENTER_INDEX * ITEM_HEIGHT, height: ITEM_HEIGHT }}
        >
          :
        </div>
        {/* Right half: tapping/scrolling here controls minutes */}
        <div className="flex-1 flex justify-start">
          <div style={{ width: 56 }}>
            <DrumColumn
              items={MINUTES_5}
              selectedIndex={minuteIndex}
              onChange={(i) => onChange(hours, i * 5)}
            />
          </div>
        </div>
      </div>
      {/* Fade masks */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white to-transparent pointer-events-none" style={{ zIndex: 3 }} />
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" style={{ zIndex: 3 }} />
    </div>
  )
}
