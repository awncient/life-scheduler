import { useState } from 'react'
import { parseDate, getTodayInTimezone } from '@/types'
import { getSettings } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { SearchModal } from '@/components/calendar/SearchModal'
import {
  ListChecks,
  Calendar,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type AppMode = 'calendar' | 'todo' | 'settings'
type CalendarView = 'day' | 'three' | 'week'

type Props = {
  mode: AppMode
  setMode: (mode: AppMode) => void
  calendarView: CalendarView | string
  setCalendarView: (view: CalendarView) => void
  currentDate: string
  setCurrentDate: (date: string) => void
  onNavigateDate?: (delta: number) => void
  onScrollToSlot?: (slot: number) => void
}

const DAY_NAMES_JP = ['日', '月', '火', '水', '木', '金', '土']

export function Header({
  mode,
  setMode,
  calendarView,
  setCalendarView,
  currentDate,
  setCurrentDate,
  onNavigateDate,
  onScrollToSlot,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)

  const goToToday = () => {
    setCurrentDate(getTodayInTimezone(getSettings().timezoneOffset))
  }

  const dateLabel = (() => {
    const d = parseDate(currentDate)
    if (calendarView === 'day') {
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${DAY_NAMES_JP[d.getDay()]}）`
    }
    if (calendarView === 'three') {
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
    }
    return `${d.getFullYear()}/${d.getMonth() + 1}月`
  })()

  const viewCycle: CalendarView[] = ['day', 'three', 'week']
  const viewLabels: Record<CalendarView, string> = { day: '1日', three: '3日', week: '週' }

  const cycleView = () => {
    const idx = viewCycle.indexOf(calendarView as CalendarView)
    const next = viewCycle[(idx + 1) % viewCycle.length]
    setCalendarView(next)
  }

  return (
    <>
      <header className="flex items-center justify-between px-2 py-2 bg-slate-800 text-white safe-area-top">
        {/* Left: view cycle button */}
        <div className="flex items-center gap-1">
          {mode === 'calendar' && (
            <button
              className="px-4 py-1 text-sm rounded-md font-medium bg-slate-700 text-white active:bg-slate-600 transition-colors min-w-[48px]"
              onClick={cycleView}
            >
              {viewLabels[calendarView as CalendarView] ?? '1日'}
            </button>
          )}
        </div>

        {/* Center: date display with nav arrows */}
        {mode === 'calendar' && (
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded hover:bg-slate-700 active:bg-slate-600 transition-colors"
              onClick={() => onNavigateDate?.(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              className="text-sm font-medium min-w-[100px] text-center px-1"
              onClick={goToToday}
            >
              {dateLabel}
            </button>
            <button
              className="p-1 rounded hover:bg-slate-700 active:bg-slate-600 transition-colors"
              onClick={() => onNavigateDate?.(1)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {mode === 'todo' && (
          <div className="text-sm font-medium">TODO</div>
        )}

        {/* Right: search, mode toggle, menu */}
        <div className="flex items-center gap-1">
          {mode === 'calendar' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-slate-700" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-slate-700"
            onClick={() => setMode(mode === 'calendar' ? 'todo' : 'calendar')}
          >
            {mode === 'calendar' ? (
              <ListChecks className="h-4 w-4" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-slate-700" onClick={() => setMode('settings')}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Search modal */}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectDate={(date, scrollToSlot) => {
          setCurrentDate(date)
          setCalendarView('day')
          setSearchOpen(false)
          if (scrollToSlot != null) {
            // Delay to let DayView mount with new date
            setTimeout(() => onScrollToSlot?.(scrollToSlot), 100)
          }
        }}
      />
    </>
  )
}
