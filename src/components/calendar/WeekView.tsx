import { useMemo } from 'react'
import { formatDate, parseDate } from '@/types'
import { getSchedule } from '@/lib/storage'
import { getSettings } from '@/lib/storage'
import { WeekColumn } from './WeekColumn'

type Props = {
  baseDate: string
  onSelectDate: (date: string) => void
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function getWeekDates(baseDateStr: string): string[] {
  const base = parseDate(baseDateStr)
  const dayOfWeek = base.getDay() // 0=Sun
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
  const todayStr = formatDate(new Date())
  const slotHeight = getSettings().zoomLevel / 2 // Smaller for week view

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-auto">
        {weekDates.map((dateStr) => {
          const d = parseDate(dateStr)
          const isPast = dateStr < todayStr
          const schedule = getSchedule(dateStr)
          const blocks = isPast ? schedule.actualBlocks : schedule.idealBlocks
          const label = `${DAY_NAMES[d.getDay()]}\n${d.getDate()}`

          return (
            <WeekColumn
              key={dateStr}
              blocks={blocks}
              slotHeight={slotHeight}
              label={label}
              isToday={dateStr === todayStr}
              onTap={() => onSelectDate(dateStr)}
            />
          )
        })}
      </div>
    </div>
  )
}
