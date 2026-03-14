import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { formatDate, parseDate, getTodayInTimezone, IDEAL_COLOR, ACTUAL_COLOR } from '@/types'
import { getSchedule, getSettings } from '@/lib/storage'

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

type Props = {
  open: boolean
  currentDate: string
  onSelectDate: (date: string) => void
  onClose: () => void
}

/** 指定月のカレンダー週データを生成 */
function getMonthWeeks(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const startDow = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(formatDate(new Date(year, month, d)))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
}

/** 日付にデータがあるかチェック */
function getDayDots(dateStr: string): { hasIdeal: boolean; hasActual: boolean } {
  const schedule = getSchedule(dateStr)
  return {
    hasIdeal: schedule.idealBlocks.length > 0,
    hasActual: schedule.actualBlocks.length > 0,
  }
}

/** 月ボタンバーで表示する月リスト生成（前後12ヶ月） */
function generateMonthList(centerYear: number, centerMonth: number) {
  const items: { year: number; month: number; label: string }[] = []
  for (let offset = -24; offset <= 24; offset++) {
    const d = new Date(centerYear, centerMonth + offset, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    items.push({ year: y, month: m, label: `${m + 1}月` })
  }
  return items
}

export function HeaderCalendar({ open, currentDate, onSelectDate, onClose }: Props) {
  const selected = parseDate(currentDate)
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

  const todayStr = getTodayInTimezone(getSettings().timezoneOffset)

  // open時に現在日付の月にリセット
  useEffect(() => {
    if (open) {
      const d = parseDate(currentDate)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [open, currentDate])

  const weeks = useMemo(() => getMonthWeeks(viewYear, viewMonth), [viewYear, viewMonth])

  // 月ボタンリスト
  const monthList = useMemo(() => generateMonthList(viewYear, viewMonth), [viewYear, viewMonth])
  const monthBarRef = useRef<HTMLDivElement>(null)

  // 月バーの現在月を中央にスクロール
  useEffect(() => {
    if (!open || !monthBarRef.current) return
    const el = monthBarRef.current
    const activeBtn = el.querySelector('[data-active="true"]') as HTMLElement | null
    if (activeBtn) {
      const scrollLeft = activeBtn.offsetLeft - el.clientWidth / 2 + activeBtn.clientWidth / 2
      el.scrollTo({ left: scrollLeft, behavior: 'instant' })
    }
  }, [open, viewYear, viewMonth])

  // カレンダーのスワイプで月移動
  const calendarRef = useRef<HTMLDivElement>(null)
  const swipeStartX = useRef(0)
  const swiping = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX
    swiping.current = true
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    swiping.current = false
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    if (Math.abs(dx) > 50) {
      if (dx < 0) {
        // 左スワイプ → 次の月
        setViewMonth(prev => {
          if (prev === 11) { setViewYear(y => y + 1); return 0 }
          return prev + 1
        })
      } else {
        // 右スワイプ → 前の月
        setViewMonth(prev => {
          if (prev === 0) { setViewYear(y => y - 1); return 11 }
          return prev - 1
        })
      }
    }
  }, [])

  const handleMonthSelect = useCallback((year: number, month: number) => {
    setViewYear(year)
    setViewMonth(month)
  }, [])

  const handleDateTap = useCallback((dateStr: string) => {
    onSelectDate(dateStr)
    onClose()
  }, [onSelectDate, onClose])

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out bg-white border-b border-slate-200"
      style={{
        maxHeight: open ? 400 : 0,
        opacity: open ? 1 : 0,
      }}
    >
      <div className="px-4 pt-2 pb-1">
        {/* 月ヘッダー */}
        <div className="text-center text-sm font-semibold text-slate-700 mb-2">
          {viewYear}年{viewMonth + 1}月
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-0.5">
          {DAY_NAMES.map((name, i) => (
            <div key={name} className={`text-center text-[11px] py-0.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
              {name}
            </div>
          ))}
        </div>

        {/* カレンダーグリッド */}
        <div
          ref={calendarRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((dateStr, di) => {
                if (!dateStr) return <div key={di} className="py-1" />

                const isToday = dateStr === todayStr
                const isSelected = dateStr === currentDate
                const day = parseDate(dateStr).getDate()
                const dots = getDayDots(dateStr)

                return (
                  <button
                    key={di}
                    className="flex flex-col items-center py-1 relative"
                    onClick={() => handleDateTap(dateStr)}
                  >
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors ${
                        isToday
                          ? 'text-white font-bold'
                          : isSelected
                            ? 'bg-slate-200 font-semibold text-slate-900'
                            : 'text-slate-700'
                      }`}
                      style={isToday ? { backgroundColor: ACTUAL_COLOR } : undefined}
                    >
                      {day}
                    </div>
                    {/* データドット（今日でも選択日でもない場合のみ） */}
                    {!isToday && (
                      <div className="flex gap-0.5 mt-0.5 h-1.5">
                        {dots.hasIdeal && (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: IDEAL_COLOR }} />
                        )}
                        {dots.hasActual && (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACTUAL_COLOR }} />
                        )}
                      </div>
                    )}
                    {isToday && <div className="h-1.5 mt-0.5" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 月ボタンバー */}
      <div
        ref={monthBarRef}
        className="flex items-center gap-1 px-2 py-2 overflow-x-auto border-t border-slate-100"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {monthList.map((item, i) => {
          const isCurrentView = item.year === viewYear && item.month === viewMonth
          // 年の変わり目の前に年ラベルを挿入
          const showYearLabel = i === 0 || (i > 0 && monthList[i - 1].year !== item.year)

          return (
            <div key={`${item.year}-${item.month}`} className="flex items-center gap-1 flex-shrink-0">
              {showYearLabel && (
                <span className="text-xs font-semibold text-slate-500 px-1">
                  {item.year}
                </span>
              )}
              <button
                data-active={isCurrentView}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                  isCurrentView
                    ? 'text-white'
                    : 'text-slate-600 border border-slate-300 hover:bg-slate-100'
                }`}
                style={isCurrentView ? { backgroundColor: ACTUAL_COLOR } : undefined}
                onClick={() => handleMonthSelect(item.year, item.month)}
              >
                {item.label}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
