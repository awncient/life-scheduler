import { useState, useCallback } from 'react'
import { formatDate, parseDate } from '@/types'
import { Header } from '@/components/layout/Header'
import { DayView } from '@/components/calendar/DayView'
import { MultiDayView } from '@/components/calendar/MultiDayView'
import { SwipeableCalendar } from '@/components/calendar/SwipeableCalendar'
import { VersionHistoryView } from '@/components/calendar/VersionHistory'
import { TodoView } from '@/components/todo/TodoView'

type AppMode = 'calendar' | 'todo'
type CalendarView = 'day' | 'three' | 'week' | 'history'

function offsetDate(dateStr: string, delta: number, view: CalendarView): string {
  const d = parseDate(dateStr)
  if (view === 'day') d.setDate(d.getDate() + delta)
  else if (view === 'three') d.setDate(d.getDate() + delta * 3)
  else if (view === 'week') d.setDate(d.getDate() + delta * 7)
  return formatDate(d)
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('day')
  const [currentDate, setCurrentDate] = useState(() => formatDate(new Date()))

  const showHeader = !(mode === 'calendar' && calendarView === 'history')

  const navigateDate = useCallback((delta: number) => {
    setCurrentDate(prev => offsetDate(prev, delta, calendarView))
  }, [calendarView])

  const goToDayView = useCallback((date: string) => {
    setCurrentDate(date)
    setCalendarView('day')
  }, [])

  const renderCalendarView = useCallback((delta: number) => {
    const dateForDelta = offsetDate(currentDate, delta, calendarView)

    if (calendarView === 'day') {
      return (
        <DayView
          date={dateForDelta}
          onOpenHistory={delta === 0 ? () => setCalendarView('history') : undefined}
        />
      )
    }
    if (calendarView === 'three') {
      return (
        <MultiDayView
          baseDate={dateForDelta}
          days={3}
          onSelectDate={delta === 0 ? goToDayView : undefined}
        />
      )
    }
    if (calendarView === 'week') {
      return (
        <MultiDayView
          baseDate={dateForDelta}
          days={7}
          onSelectDate={delta === 0 ? goToDayView : undefined}
        />
      )
    }
    return null
  }, [currentDate, calendarView, goToDayView])

  const isSwipeable = mode === 'calendar' && (calendarView === 'day' || calendarView === 'three' || calendarView === 'week')

  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      {showHeader && (
        <Header
          mode={mode}
          setMode={setMode}
          calendarView={calendarView}
          setCalendarView={(v) => setCalendarView(v as CalendarView)}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
        />
      )}
      <main className="flex-1 overflow-hidden">
        {isSwipeable && (
          <SwipeableCalendar
            viewKey={`${calendarView}-${currentDate}`}
            onNavigate={navigateDate}
            renderView={renderCalendarView}
          />
        )}
        {mode === 'calendar' && calendarView === 'history' && (
          <VersionHistoryView
            date={currentDate}
            onBack={() => setCalendarView('day')}
          />
        )}
        {mode === 'todo' && <TodoView />}
      </main>
    </div>
  )
}
