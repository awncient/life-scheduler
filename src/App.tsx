import { useState, useCallback, useEffect } from 'react'
import { formatDate, parseDate, getTodayInTimezone, slotToTime } from '@/types'
import { getSettings, getSchedule, getDiaryDates } from '@/lib/storage'
import { Header } from '@/components/layout/Header'
import { DayView } from '@/components/calendar/DayView'
import { MultiDayView } from '@/components/calendar/MultiDayView'
import { VersionHistoryView } from '@/components/calendar/VersionHistory'
import { TodoView } from '@/components/todo/TodoView'
import { SettingsView } from '@/components/settings/SettingsView'
import { DiaryView } from '@/components/diary/DiaryView'
import { ViewSwitchButton } from '@/components/layout/ViewSwitchButton'

type AppMode = 'calendar' | 'todo' | 'settings'
type CalendarView = 'day' | 'three' | 'week' | 'history' | 'diary'

export default function App() {
  const [mode, setMode] = useState<AppMode>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('day')
  const [currentDate, setCurrentDate] = useState(() => getTodayInTimezone(getSettings().timezoneOffset))
  const [scrollToSlot, setScrollToSlot] = useState<number | null>(null)

  const [prevMode, setPrevMode] = useState<'calendar' | 'todo'>('calendar')

  // Service Workerからのブロック情報リクエストに応答
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'GET_BLOCK_INFO' && event.ports[0]) {
        const { blockId, dateStr } = event.data
        const schedule = getSchedule(dateStr)
        const block = [...schedule.idealBlocks, ...schedule.actualBlocks].find(b => b.id === blockId)
        if (block) {
          event.ports[0].postMessage({
            title: block.title,
            startTime: slotToTime(block.startTime),
            endTime: slotToTime(block.endTime),
          })
        } else {
          event.ports[0].postMessage(null)
        }
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [])

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

  // 日記ページの左右フリック: 前日/翌日ではなく、日記が書かれている前後の日付へ飛ぶ
  const jumpDiary = useCallback((direction: -1 | 1) => {
    const dates = getDiaryDates()
    const target = direction < 0
      ? [...dates].reverse().find(d => d < currentDate)
      : dates.find(d => d > currentDate)
    if (target) setCurrentDate(target)
  }, [currentDate])

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
          onNavigateDate={navigateDate}
          onScrollToSlot={(slot) => setScrollToSlot(slot)}
        />
      )}
      <main className="flex-1 overflow-hidden">
        {mode === 'calendar' && calendarView === 'day' && (
          <DayView
            date={currentDate}
            onOpenHistory={() => setCalendarView('history')}
            onNavigateDate={navigateDate}
            scrollToSlot={scrollToSlot}
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
        {mode === 'calendar' && calendarView === 'diary' && (
          <DiaryView key={currentDate} date={currentDate} onSwipe={jumpDiary} />
        )}
        {mode === 'todo' && <TodoView />}
        {mode === 'settings' && (
          <SettingsView onBack={() => setMode(prevMode)} />
        )}
      </main>

      {/* 時系列（1日）⇄ 日記 の切り替えボタン */}
      {mode === 'calendar' && (calendarView === 'day' || calendarView === 'diary') && (
        <ViewSwitchButton
          inDiary={calendarView === 'diary'}
          onToggle={() => setCalendarView(calendarView === 'diary' ? 'day' : 'diary')}
        />
      )}
    </div>
  )
}
