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

/** 前後の月を計算 */
function adjacentMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** 月ボタンバーで表示する月リスト生成（前後24ヶ月） */
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

/** 月カレンダーグリッド（単一月分） */
function MonthGrid({
  year,
  month,
  todayStr,
  currentDate,
  onDateTap,
}: {
  year: number
  month: number
  todayStr: string
  currentDate: string
  onDateTap: (dateStr: string) => void
}) {
  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month])

  return (
    <div>
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
                onClick={() => onDateTap(dateStr)}
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
  )
}

export function HeaderCalendar({ open, currentDate, onSelectDate, onClose }: Props) {
  const selected = parseDate(currentDate)
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

  const todayStr = getTodayInTimezone(getSettings().timezoneOffset)

  // スワイプ状態
  const containerRef = useRef<HTMLDivElement>(null)
  const swipeStartX = useRef(0)
  const swipeCurrentX = useRef(0)
  const isSwiping = useRef(false)
  const [translateX, setTranslateX] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // open時に現在日付の月にリセット
  useEffect(() => {
    if (open) {
      const d = parseDate(currentDate)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
      setTranslateX(0)
    }
  }, [open, currentDate])

  // 月ボタンリスト
  const monthList = useMemo(() => generateMonthList(viewYear, viewMonth), [viewYear, viewMonth])
  const monthBarRef = useRef<HTMLDivElement>(null)

  // open時のみ月バーの選択月を中央にスクロール
  const hasScrolledOnOpen = useRef(false)
  useEffect(() => {
    if (open) {
      hasScrolledOnOpen.current = false
    }
  }, [open])
  useEffect(() => {
    if (!open || !monthBarRef.current || hasScrolledOnOpen.current) return
    hasScrolledOnOpen.current = true
    const el = monthBarRef.current
    const activeBtn = el.querySelector('[data-active="true"]') as HTMLElement | null
    if (activeBtn) {
      const scrollLeft = activeBtn.offsetLeft - el.clientWidth / 2 + activeBtn.clientWidth / 2
      el.scrollTo({ left: scrollLeft, behavior: 'instant' })
    }
  }, [open, viewYear, viewMonth])

  // 前後の月
  const prev = adjacentMonth(viewYear, viewMonth, -1)
  const next = adjacentMonth(viewYear, viewMonth, 1)

  // スワイプハンドラー
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return
    swipeStartX.current = e.touches[0].clientX
    swipeCurrentX.current = e.touches[0].clientX
    isSwiping.current = true
  }, [isAnimating])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current || isAnimating) return
    swipeCurrentX.current = e.touches[0].clientX
    const dx = swipeCurrentX.current - swipeStartX.current
    setTranslateX(dx)
  }, [isAnimating])

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current || isAnimating) return
    isSwiping.current = false
    const dx = swipeCurrentX.current - swipeStartX.current
    const containerWidth = containerRef.current?.clientWidth ?? 300

    if (Math.abs(dx) > 50) {
      // スワイプ確定 — アニメーションで画面外にスライド
      const targetX = dx < 0 ? -containerWidth : containerWidth
      setTranslateX(targetX)
      setIsAnimating(true)

      setTimeout(() => {
        // アニメーション完了後に月を切り替えてリセット
        setIsAnimating(false)
        setTranslateX(0)
        if (dx < 0) {
          // 左スワイプ → 次の月
          setViewMonth(m => {
            if (m === 11) { setViewYear(y => y + 1); return 0 }
            return m + 1
          })
        } else {
          // 右スワイプ → 前の月
          setViewMonth(m => {
            if (m === 0) { setViewYear(y => y - 1); return 11 }
            return m - 1
          })
        }
      }, 250)
    } else {
      // スワイプキャンセル — 元に戻す
      setTranslateX(0)
    }
  }, [isAnimating])

  const handleDateTap = useCallback((dateStr: string) => {
    onSelectDate(dateStr)
    onClose()
  }, [onSelectDate, onClose])

  const handleMonthSelect = useCallback((year: number, month: number) => {
    setViewYear(year)
    setViewMonth(month)
  }, [])

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out bg-white border-b border-slate-200"
      style={{
        maxHeight: open ? 420 : 0,
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

        {/* カレンダーグリッド（3パネルスライド） */}
        <div
          ref={containerRef}
          className="overflow-hidden relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex"
            style={{
              transform: `translateX(calc(-33.333% + ${translateX}px))`,
              transition: isAnimating ? 'transform 250ms ease-out' : 'none',
              width: '300%',
            }}
          >
            {/* 前の月 */}
            <div style={{ width: '33.333%', flexShrink: 0 }}>
              <MonthGrid
                year={prev.year}
                month={prev.month}
                todayStr={todayStr}
                currentDate={currentDate}
                onDateTap={handleDateTap}
              />
            </div>
            {/* 現在の月 */}
            <div style={{ width: '33.333%', flexShrink: 0 }}>
              <MonthGrid
                year={viewYear}
                month={viewMonth}
                todayStr={todayStr}
                currentDate={currentDate}
                onDateTap={handleDateTap}
              />
            </div>
            {/* 次の月 */}
            <div style={{ width: '33.333%', flexShrink: 0 }}>
              <MonthGrid
                year={next.year}
                month={next.month}
                todayStr={todayStr}
                currentDate={currentDate}
                onDateTap={handleDateTap}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 月ボタンバー（境界線なし） */}
      <div
        ref={monthBarRef}
        className="flex items-center gap-2 px-2 py-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {monthList.map((item, i) => {
          const isCurrentView = item.year === viewYear && item.month === viewMonth
          const showYearLabel = i === 0 || (i > 0 && monthList[i - 1].year !== item.year)

          return (
            <div key={`${item.year}-${item.month}`} className="flex items-center gap-2 flex-shrink-0">
              {showYearLabel && (
                <span className="font-semibold text-slate-500" style={{ fontSize: 15 }}>
                  {item.year}
                </span>
              )}
              <button
                data-active={isCurrentView}
                className={`rounded-full font-medium transition-colors flex-shrink-0 ${
                  isCurrentView
                    ? 'font-bold'
                    : 'text-slate-600 border border-slate-300'
                }`}
                style={{
                  fontSize: 15,
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingTop: 6,
                  paddingBottom: 6,
                  ...(isCurrentView ? { backgroundColor: '#fce4ec', color: '#b71c1c' } : {}),
                }}
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
