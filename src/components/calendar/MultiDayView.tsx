import { useState, useEffect, useMemo, useRef } from 'react'
import { formatDate, parseDate, SLOT_COUNT, SLOTS_PER_HOUR, DEFAULT_SETTINGS } from '@/types'
import { getSchedule, getSettings } from '@/lib/storage'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'

type Props = {
  baseDate: string
  days: number // 3 or 7
  onSelectDate: (date: string) => void
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function getDates(baseDateStr: string, days: number): string[] {
  if (days === 7) {
    const base = parseDate(baseDateStr)
    const dayOfWeek = base.getDay()
    const sunday = new Date(base)
    sunday.setDate(base.getDate() - dayOfWeek)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday)
      d.setDate(sunday.getDate() + i)
      return formatDate(d)
    })
  }
  const base = parseDate(baseDateStr)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i - 1)
    return formatDate(d)
  })
}

function loadZoomLevel(): number {
  const stored = getSettings().zoomLevel
  if (stored < 2 || stored > 12) return DEFAULT_SETTINGS.zoomLevel
  return stored
}

export function MultiDayView({ baseDate, days, onSelectDate }: Props) {
  const dates = useMemo(() => getDates(baseDate, days), [baseDate, days])
  const todayStr = formatDate(new Date())

  const [zoomLevel, setZoomLevel] = useState(loadZoomLevel)
  const { containerRef, persistZoom } = usePinchZoom(zoomLevel, setZoomLevel)
  const scale = days === 7 ? 0.5 : 1 / 1.5
  const slotHeight = zoomLevel * scale

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

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="w-8 flex-shrink-0" />
        {dates.map((dateStr) => {
          const d = parseDate(dateStr)
          const isToday = dateStr === todayStr
          return (
            <div
              key={dateStr}
              className={`flex-1 text-center text-[10px] py-1.5 border-r border-slate-200 last:border-r-0 cursor-pointer active:bg-slate-100 ${
                isToday ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'
              }`}
              onClick={() => onSelectDate(dateStr)}
            >
              {DAY_NAMES[d.getDay()]}<br />{d.getMonth() + 1}/{d.getDate()}
            </div>
          )
        })}
      </div>

      {/* Scrollable grid with pinch zoom */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="flex" style={{ height: `${SLOT_COUNT * slotHeight}px` }}>
          {/* Time labels */}
          <div className="relative flex-shrink-0 w-8 text-[9px] text-slate-400">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute right-0.5 -translate-y-1/2"
                style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
              >
                {h.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dates.map((dateStr) => {
            const isPast = dateStr < todayStr
            const schedule = getSchedule(dateStr)
            const blocks = isPast ? schedule.actualBlocks : schedule.idealBlocks
            const isToday = dateStr === todayStr

            return (
              <div key={dateStr} className="flex-1 border-r border-slate-200 last:border-r-0 min-w-0 relative">
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
                      onClick={() => onSelectDate(dateStr)}
                    >
                      <div className="truncate leading-tight">{block.title}</div>
                    </div>
                  )
                })}
                {/* Current time indicator */}
                {isToday && <CurrentTimeIndicator slotHeight={slotHeight} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
