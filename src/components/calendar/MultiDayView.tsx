import { useMemo } from 'react'
import { formatDate, parseDate, SLOT_COUNT, SLOTS_PER_HOUR } from '@/types'
import { getSchedule, getSettings } from '@/lib/storage'

type Props = {
  baseDate: string
  days: number // 3 or 7
  onSelectDate: (date: string) => void
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function getDates(baseDateStr: string, days: number): string[] {
  if (days === 7) {
    // Week: start from Sunday
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
  // 3-day: center on baseDate (yesterday, today, tomorrow)
  const base = parseDate(baseDateStr)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i - 1)
    return formatDate(d)
  })
}

export function MultiDayView({ baseDate, days, onSelectDate }: Props) {
  const dates = useMemo(() => getDates(baseDate, days), [baseDate, days])
  const todayStr = formatDate(new Date())
  const slotHeight = days === 7 ? getSettings().zoomLevel / 2 : getSettings().zoomLevel / 1.5

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

      {/* Scrollable grid */}
      <div className="flex-1 overflow-auto">
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
                  const height = (block.endTime - block.startTime) * slotHeight
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
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
