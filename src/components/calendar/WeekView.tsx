import { useMemo } from 'react'
import { formatDate, parseDate, SLOT_COUNT, SLOTS_PER_HOUR, getTodayInTimezone, getNowInTimezone } from '@/types'
import { getSchedule, getSettings } from '@/lib/storage'

type Props = {
  baseDate: string
  onSelectDate: (date: string) => void
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function getWeekDates(baseDateStr: string): string[] {
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

export function WeekView({ baseDate, onSelectDate }: Props) {
  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate])
  const todayStr = getTodayInTimezone(getSettings().timezoneOffset)
  const slotHeight = getSettings().zoomLevel / 2

  return (
    <div className="flex flex-col h-full">
      {/* Header row for day labels + time label spacer */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="w-8 flex-shrink-0" />
        {weekDates.map((dateStr) => {
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
              {DAY_NAMES[d.getDay()]}<br />{d.getDate()}
            </div>
          )
        })}
      </div>

      {/* Scrollable grid area */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ height: `${SLOT_COUNT * slotHeight + slotHeight * SLOTS_PER_HOUR}px` }}>
          {/* Time labels（1:00〜23:00、00:00は非表示） */}
          <div className="relative flex-shrink-0 w-8 text-[9px] text-slate-400">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <div
                key={h}
                className="absolute right-0.5 -translate-y-1/2"
                style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
              >
                {h.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Day columns (no header — headers are sticky above) */}
          {weekDates.map((dateStr) => {
            const isPast = dateStr < todayStr
            const isToday = dateStr === todayStr
            const schedule = getSchedule(dateStr)
            const tz = getSettings().timezoneOffset

            let blocks: typeof schedule.idealBlocks
            if (isToday) {
              const now = getNowInTimezone(tz)
              const currentHourSlot = now.hours * SLOTS_PER_HOUR
              const pastActual = schedule.actualBlocks.filter(b => b.endTime <= currentHourSlot)
              const futureIdeal = schedule.idealBlocks.filter(b => b.startTime >= currentHourSlot)
              const crossActual = schedule.actualBlocks.filter(b => b.startTime < currentHourSlot && b.endTime > currentHourSlot)
              const crossIdeal = crossActual.length === 0
                ? schedule.idealBlocks.filter(b => b.startTime < currentHourSlot && b.endTime > currentHourSlot)
                : []
              blocks = [...pastActual, ...crossActual, ...crossIdeal, ...futureIdeal]
            } else {
              blocks = isPast ? schedule.actualBlocks : schedule.idealBlocks
            }

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
                      className="absolute left-0.5 right-0.5 rounded px-0.5 text-white text-xs overflow-hidden cursor-pointer"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: block.color,
                        minHeight: '4px',
                      }}
                      onClick={() => onSelectDate(dateStr)}
                    >
                      <div className="leading-tight break-words">{block.title || '（タイトルなし）'}</div>
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
