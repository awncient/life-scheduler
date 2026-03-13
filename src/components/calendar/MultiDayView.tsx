import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { formatDate, parseDate, slotToTime, SLOT_COUNT, SLOTS_PER_HOUR, DEFAULT_SETTINGS, getTodayInTimezone } from '@/types'
import { getSchedule, getSettings } from '@/lib/storage'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { useSwipe } from '@/hooks/useSwipe'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'

type Props = {
  baseDate: string
  days: 3 | 7
  onSelectDate?: (date: string) => void
  onNavigateDate?: (delta: number) => void
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function getDates(baseDateStr: string, days: number): string[] {
  if (days === 7) {
    // Week view: start from Sunday of the week containing baseDate
    const base = parseDate(baseDateStr)
    const sunday = new Date(base)
    sunday.setDate(base.getDate() - base.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday)
      d.setDate(sunday.getDate() + i)
      return formatDate(d)
    })
  }
  // 3-day view: baseDate is the first day
  const base = parseDate(baseDateStr)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return formatDate(d)
  })
}

function offsetBaseDate(baseDateStr: string, delta: number, days: number): string {
  const d = parseDate(baseDateStr)
  // 3-day: move 1 day at a time; week: move 7 days
  const step = days === 7 ? 7 : 1
  d.setDate(d.getDate() + delta * step)
  return formatDate(d)
}

function loadZoomLevel(): number {
  const stored = getSettings().zoomLevel
  if (stored < 2 || stored > 12) return DEFAULT_SETTINGS.zoomLevel
  return stored
}

function DayColumns({
  dates,
  slotHeight,
  todayStr,
  onSelectDate,
}: {
  dates: string[]
  slotHeight: number
  todayStr: string
  onSelectDate?: (date: string) => void
}) {
  return (
    <div className="flex h-full" style={{ width: '33.333%', flexShrink: 0 }}>
      {dates.map((dateStr) => {
        const isPast = dateStr < todayStr
        const schedule = getSchedule(dateStr)
        const blocks = isPast ? schedule.actualBlocks : schedule.idealBlocks
        const isToday = dateStr === todayStr

        return (
          <div
            key={dateStr}
            className="flex-1 border-r border-slate-200 last:border-r-0 min-w-0 relative"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-slate-100"
                style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
              />
            ))}
            {blocks.map((block) => {
              const top = block.startTime * slotHeight
              const height = Math.max(4, (block.endTime - block.startTime) * slotHeight - 1)
              return (
                <div
                  key={block.id}
                  className="absolute left-0.5 right-0.5 rounded px-0.5 text-white text-[8px] overflow-hidden cursor-pointer"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: block.color,
                    minHeight: '4px',
                  }}
                  onClick={() => onSelectDate?.(dateStr)}
                >
                  <div className="truncate leading-tight">{block.title}</div>
                </div>
              )
            })}
            {isToday && <CurrentTimeIndicator slotHeight={slotHeight} />}
          </div>
        )
      })}
    </div>
  )
}

function DayHeaders({
  dates,
  todayStr,
  onSelectDate,
}: {
  dates: string[]
  todayStr: string
  onSelectDate?: (date: string) => void
}) {
  return (
    <div className="flex" style={{ width: '33.333%', flexShrink: 0 }}>
      {dates.map((dateStr) => {
        const d = parseDate(dateStr)
        const isToday = dateStr === todayStr
        return (
          <div
            key={dateStr}
            className={`flex-1 text-center text-[10px] py-1.5 border-r border-slate-200 last:border-r-0 cursor-pointer active:bg-slate-100 ${
              isToday ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'
            }`}
            onClick={() => onSelectDate?.(dateStr)}
          >
            {DAY_NAMES[d.getDay()]}<br />{d.getMonth() + 1}/{d.getDate()}
          </div>
        )
      })}
    </div>
  )
}

export function MultiDayView({ baseDate, days, onSelectDate, onNavigateDate }: Props) {
  const todayStr = getTodayInTimezone(getSettings().timezoneOffset)

  const [zoomLevel, setZoomLevel] = useState(loadZoomLevel)
  const { containerRef, persistZoom } = usePinchZoom(zoomLevel, setZoomLevel)
  const scale = days === 7 ? 0.5 : 1 / 1.5
  const slotHeight = zoomLevel * scale
  const totalHeight = SLOT_COUNT * slotHeight

  const didScroll = useRef(false)

  useEffect(() => {
    persistZoom(zoomLevel)
  }, [zoomLevel, persistZoom])

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (didScroll.current) return
    const el = containerRef.current
    if (!el) return
    const now = new Date()
    const currentSlot = now.getHours() * SLOTS_PER_HOUR + Math.floor(now.getMinutes() / 5)
    const currentPos = currentSlot * slotHeight
    const viewHeight = el.clientHeight
    el.scrollTop = Math.max(0, currentPos - viewHeight / 3)
    didScroll.current = true
  }, [slotHeight, containerRef])

  const handleNavigate = useCallback((delta: number) => {
    onNavigateDate?.(delta)
  }, [onNavigateDate])

  const { swipeStyle } = useSwipe(containerRef, handleNavigate, `${days}-${baseDate}`)

  // Compute dates for prev/current/next panels
  const currentDates = useMemo(() => getDates(baseDate, days), [baseDate, days])
  const prevBaseDate = useMemo(() => offsetBaseDate(baseDate, -1, days), [baseDate, days])
  const nextBaseDate = useMemo(() => offsetBaseDate(baseDate, 1, days), [baseDate, days])
  const prevDates = useMemo(() => getDates(prevBaseDate, days), [prevBaseDate, days])
  const nextDates = useMemo(() => getDates(nextBaseDate, days), [nextBaseDate, days])

  return (
    <div className="flex flex-col h-full">
      {/* Sticky day headers — time label spacer + swipeable day headers */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1 overflow-hidden">
          <div className="flex" style={{ width: '300%', ...swipeStyle }}>
            <DayHeaders dates={prevDates} todayStr={todayStr} />
            <DayHeaders dates={currentDates} todayStr={todayStr} onSelectDate={onSelectDate} />
            <DayHeaders dates={nextDates} todayStr={todayStr} />
          </div>
        </div>
      </div>

      {/* Scrollable body — fixed time labels + swipeable day columns */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: `${totalHeight}px` }}>
          {/* Fixed time labels (HH:mm) */}
          <div className="relative flex-shrink-0 w-10 text-[10px] text-slate-400">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2"
                style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
              >
                {slotToTime(h * SLOTS_PER_HOUR)}
              </div>
            ))}
          </div>

          {/* Swipeable day columns */}
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full" style={{ width: '300%', ...swipeStyle }}>
              <DayColumns dates={prevDates} slotHeight={slotHeight} todayStr={todayStr} />
              <DayColumns dates={currentDates} slotHeight={slotHeight} todayStr={todayStr} onSelectDate={onSelectDate} />
              <DayColumns dates={nextDates} slotHeight={slotHeight} todayStr={todayStr} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
