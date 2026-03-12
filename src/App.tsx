import { useState } from 'react'
import { formatDate } from '@/types'
import { Header } from '@/components/layout/Header'
import { DayView } from '@/components/calendar/DayView'
import { MultiDayView } from '@/components/calendar/MultiDayView'
import { VersionHistoryView } from '@/components/calendar/VersionHistory'
import { TodoView } from '@/components/todo/TodoView'

type AppMode = 'calendar' | 'todo'
type CalendarView = 'day' | 'three' | 'week' | 'history'

export default function App() {
  const [mode, setMode] = useState<AppMode>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('day')
  const [currentDate, setCurrentDate] = useState(() => formatDate(new Date()))

  const showHeader = !(mode === 'calendar' && calendarView === 'history')

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
        {mode === 'calendar' && calendarView === 'day' && (
          <DayView
            date={currentDate}
            onOpenHistory={() => setCalendarView('history')}
          />
        )}
        {mode === 'calendar' && calendarView === 'three' && (
          <MultiDayView
            baseDate={currentDate}
            days={3}
            onSelectDate={(date) => {
              setCurrentDate(date)
              setCalendarView('day')
            }}
          />
        )}
        {mode === 'calendar' && calendarView === 'week' && (
          <MultiDayView
            baseDate={currentDate}
            days={7}
            onSelectDate={(date) => {
              setCurrentDate(date)
              setCalendarView('day')
            }}
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
