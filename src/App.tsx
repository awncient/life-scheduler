import { useState, useCallback, useRef, useEffect } from 'react'
import { formatDate, parseDate } from '@/types'
import { Header } from '@/components/layout/Header'
import { DayView } from '@/components/calendar/DayView'
import { MultiDayView } from '@/components/calendar/MultiDayView'
import { VersionHistoryView } from '@/components/calendar/VersionHistory'
import { TodoView } from '@/components/todo/TodoView'

type AppMode = 'calendar' | 'todo'
type CalendarView = 'day' | 'three' | 'week' | 'history'

const SWIPE_THRESHOLD = 60

export default function App() {
  const [mode, setMode] = useState<AppMode>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('day')
  const [currentDate, setCurrentDate] = useState(() => formatDate(new Date()))

  const showHeader = !(mode === 'calendar' && calendarView === 'history')

  // Swipe navigation
  const swipeRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const isHorizontal = useRef<boolean | null>(null)

  const navigateDate = useCallback((delta: number) => {
    setCurrentDate(prev => {
      const d = parseDate(prev)
      if (calendarView === 'day') {
        d.setDate(d.getDate() + delta)
      } else if (calendarView === 'three') {
        d.setDate(d.getDate() + delta * 3)
      } else if (calendarView === 'week') {
        d.setDate(d.getDate() + delta * 7)
      }
      return formatDate(d)
    })
  }, [calendarView])

  useEffect(() => {
    const el = swipeRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      isHorizontal.current = null
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isHorizontal.current !== null) return
      const dx = Math.abs(e.touches[0].clientX - startX.current)
      const dy = Math.abs(e.touches[0].clientY - startY.current)
      if (dx > 10 || dy > 10) {
        isHorizontal.current = dx > dy * 1.5
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (isHorizontal.current !== true) return
      const dx = e.changedTouches[0].clientX - startX.current
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        // swipe right = go back (delta -1), swipe left = go forward (delta +1)
        navigateDate(dx > 0 ? -1 : 1)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [navigateDate])

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
      <main ref={swipeRef} className="flex-1 overflow-hidden">
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
