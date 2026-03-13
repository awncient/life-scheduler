import { useState, useMemo } from 'react'
import { formatDate, parseDate, getTodayInTimezone } from '@/types'
import { getSettings } from '@/lib/storage'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

type Props = {
  selectedDate: string
  onSelect: (date: string) => void
  minDate?: string
}

export function MonthCalendar({ selectedDate, onSelect, minDate }: Props) {
  const selected = parseDate(selectedDate)
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

  const todayStr = getTodayInTimezone(getSettings().timezoneOffset)

  const weeks = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startDow = firstDay.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const cells: (string | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(formatDate(new Date(viewYear, viewMonth, d)))
    }
    while (cells.length % 7 !== 0) cells.push(null)

    const rows: (string | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7))
    }
    return rows
  }, [viewYear, viewMonth])

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goNext = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button className="p-1 rounded hover:bg-slate-100" onClick={goPrev}>
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <span className="text-sm font-semibold text-slate-700">
          {viewYear}年{viewMonth + 1}月
        </span>
        <button className="p-1 rounded hover:bg-slate-100" onClick={goNext}>
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {/* Day names header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-xs text-slate-400 py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Date grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((dateStr, di) => {
            if (!dateStr) return <div key={di} />
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const isDisabled = minDate ? dateStr < minDate : false
            const day = parseDate(dateStr).getDate()

            return (
              <button
                key={di}
                disabled={isDisabled}
                className={`py-2 text-sm text-center rounded-full transition-colors ${
                  isSelected
                    ? 'bg-blue-500 text-white font-bold'
                    : isToday
                      ? 'bg-blue-100 text-blue-600 font-semibold'
                      : isDisabled
                        ? 'text-slate-300'
                        : 'text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => onSelect(dateStr)}
              >
                {day}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
