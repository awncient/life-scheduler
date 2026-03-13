import { useState, useCallback } from 'react'
import { formatDate, parseDate, getTodayInTimezone } from '@/types'
import { getSettings } from '@/lib/storage'
import { Header } from '@/components/layout/Header'
import { DayView } from '@/components/calendar/DayView'
import { MultiDayView } from '@/components/calendar/MultiDayView'
import { VersionHistoryView } from '@/components/calendar/VersionHistory'
import { TodoView } from '@/components/todo/TodoView'
import { SettingsView } from '@/components/settings/SettingsView'

type AppMode = 'calendar' | 'todo' | 'settings'
type CalendarView = 'day' | 'three' | 'week' | 'history'

export default function App() {
  const [mode, setMode] = useState<AppMode>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('day')
  const [currentDate, setCurrentDate] = useState(() => getTodayInTimezone(getSettings().timezoneOffset))

  const [prevMode, setPrevMode] = useState<'calendar' | 'todo'>('calendar')

  const showHeader = mode !== 'settings' && !(mode === 'calendar' && calendarView === 'history')

  const navigateDate = useCallback((delta: number) => {
    setCurrentDate(prev => {
      const d = parseDate(prev)
      if (calendarView === 'week') {
        d.setDate(d.getDate() + delta * 7)
      } else {
        // day and three both step by 1 day
        d.setDate(d.getDate() + delta)
      }
      return formatDate(d)
    })
  }, [calendarView])

  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      {showHeader && (
        <Header
          mode={mode}
          setMode={(m) => {
            if (m === 'settings') {
              setPrevMode(mode as 'calendar' | 'todo')
            }
            setMode(m)
          }}
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
            onNavigateDate={navigateDate}
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
            onNavigateDate={navigateDate}
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
            onNavigateDate={navigateDate}
          />
        )}
        {mode === 'calendar' && calendarView === 'history' && (
          <VersionHistoryView
            date={currentDate}
            onBack={() => setCalendarView('day')}
          />
        )}
        {mode === 'todo' && <TodoView />}
        {mode === 'settings' && (
          <SettingsView onBack={() => setMode(prevMode)} />
        )}
      </main>
    </div>
  )
}
