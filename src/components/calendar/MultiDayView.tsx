import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { formatDate, parseDate, slotToTime, SLOT_COUNT, SLOTS_PER_HOUR, DEFAULT_SETTINGS, getTodayInTimezone, getNowInTimezone, adjustBlocksForTimezone, getVisibleBlocksForDay } from '@/types'
import { getSchedule, getSettings } from '@/lib/storage'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { useSwipe } from '@/hooks/useSwipe'
import type { SwipeConfig } from '@/hooks/useSwipe'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'

type Props = {
  baseDate: string
  days: 3 | 7
  onSelectDate?: (date: string) => void
  onNavigateDate?: (delta: number) => void
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

/** For 3-day view: generate 9 consecutive dates (3 buffer + 3 visible + 3 buffer) */
function getThreeDayDates(baseDateStr: string): string[] {
  const base = parseDate(baseDateStr)
  return Array.from({ length: 9 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + (i - 3)) // -3 to +5
    return formatDate(d)
  })
}

/** For week view: generate dates for prev/current/next week panels */
function getWeekDates(baseDateStr: string): string[] {
  const base = parseDate(baseDateStr)
  const sunday = new Date(base)
  sunday.setDate(base.getDate() - base.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return formatDate(d)
  })
}

function getWeekPanelDates(baseDateStr: string, delta: number): string[] {
  const d = parseDate(baseDateStr)
  d.setDate(d.getDate() + delta * 7)
  return getWeekDates(formatDate(d))
}

function loadZoomLevel(): number {
  const stored = getSettings().zoomLevel
  if (stored < 2 || stored > 12) return DEFAULT_SETTINGS.zoomLevel
  return stored
}

function DayColumn({
  dateStr,
  slotHeight,
  todayStr,
  onSelectDate,
}: {
  dateStr: string
  slotHeight: number
  todayStr: string
  onSelectDate?: (date: string) => void
}) {
  const isPast = dateStr < todayStr
  const isToday = dateStr === todayStr
  const schedule = getSchedule(dateStr)
  const tz = getSettings().timezoneOffset

  // 今日の場合: 現在時刻（1時間単位）より前は実際、以降は理想を表示
  let blocks: typeof schedule.idealBlocks
  if (isToday) {
    const now = getNowInTimezone(tz)
    const currentHourSlot = now.hours * SLOTS_PER_HOUR
    const idealBlocks = schedule.idealBlocks
    const actualBlocks = schedule.actualBlocks

    // 過去の実際ブロック（現在時刻より前に終わるもの）
    const pastActual = actualBlocks.filter(b => b.endTime <= currentHourSlot)
    // 未来の理想ブロック（現在時刻以降に始まるもの）
    const futureIdeal = idealBlocks.filter(b => b.startTime >= currentHourSlot)
    // 現在時刻をまたぐブロック: 実際があればそちら、なければ理想
    const crossActual = actualBlocks.filter(b => b.startTime < currentHourSlot && b.endTime > currentHourSlot)
    const crossIdeal = crossActual.length === 0
      ? idealBlocks.filter(b => b.startTime < currentHourSlot && b.endTime > currentHourSlot)
      : []

    blocks = [...pastActual, ...crossActual, ...crossIdeal, ...futureIdeal]
  } else {
    const side = isPast ? 'actual' : 'ideal'
    blocks = side === 'ideal' ? schedule.idealBlocks : schedule.actualBlocks
  }

  // Include cross-day blocks from previous days
  const visibleBlocks = getVisibleBlocksForDay(dateStr, blocks, dateStr)
  if (isToday) {
    const now = getNowInTimezone(tz)
    const currentHourSlot = now.hours * SLOTS_PER_HOUR
    // 今日の場合: 前日からの日跨ぎブロックも時間帯で分けて表示
    for (let delta = 1; delta <= 3; delta++) {
      const prevD = new Date(parseDate(dateStr))
      prevD.setDate(prevD.getDate() - delta)
      const prevDateStr = formatDate(prevD)
      const prevSched = getSchedule(prevDateStr)
      // 過去時間帯は実際、未来時間帯は理想
      const prevActualVisible = getVisibleBlocksForDay(dateStr, prevSched.actualBlocks, prevDateStr)
      const prevIdealVisible = getVisibleBlocksForDay(dateStr, prevSched.idealBlocks, prevDateStr)
      for (const b of prevActualVisible) {
        if (b.endTime <= currentHourSlot || (b.startTime < currentHourSlot && b.endTime > currentHourSlot)) {
          visibleBlocks.push(b)
        }
      }
      for (const b of prevIdealVisible) {
        if (b.startTime >= currentHourSlot) {
          visibleBlocks.push(b)
        }
        // 現在をまたぐ理想は、実際がなければ表示
        if (b.startTime < currentHourSlot && b.endTime > currentHourSlot) {
          const hasActualCross = prevActualVisible.some(a =>
            a.startTime < currentHourSlot && a.endTime > currentHourSlot
          )
          if (!hasActualCross) visibleBlocks.push(b)
        }
      }
    }
  } else {
    const side = isPast ? 'actual' : 'ideal'
    for (let delta = 1; delta <= 3; delta++) {
      const prevD = new Date(parseDate(dateStr))
      prevD.setDate(prevD.getDate() - delta)
      const prevDateStr = formatDate(prevD)
      const prevSched = getSchedule(prevDateStr)
      const prevBlocks = side === 'ideal' ? prevSched.idealBlocks : prevSched.actualBlocks
      visibleBlocks.push(...getVisibleBlocksForDay(dateStr, prevBlocks, prevDateStr))
    }
  }
  const adjustedBlocks = adjustBlocksForTimezone(visibleBlocks, tz)

  return (
    <div className="flex-1 border-r border-slate-200 last:border-r-0 min-w-0 relative">
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-slate-100"
          style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
        />
      ))}
      {adjustedBlocks.map((block) => {
        const top = block.startTime * slotHeight
        const height = Math.max(4, (block.endTime - block.startTime) * slotHeight - 1)
        return (
          <div
            key={block.id}
            className="absolute left-0.5 right-0.5 rounded px-0.5 text-white text-xs overflow-hidden cursor-pointer"
            style={{
              top: `${top}px`,
              height: `${height}px`,
              backgroundColor: block.color,
              minHeight: '4px',
            }}
            onClick={() => onSelectDate?.(dateStr)}
          >
            <div className="leading-tight break-words">{block.title || '（タイトルなし）'}</div>
          </div>
        )
      })}
      {isToday && <CurrentTimeIndicator slotHeight={slotHeight} />}
    </div>
  )
}

function DayHeader({
  dateStr,
  todayStr,
  onSelectDate,
}: {
  dateStr: string
  todayStr: string
  onSelectDate?: (date: string) => void
}) {
  const d = parseDate(dateStr)
  const isToday = dateStr === todayStr
  return (
    <div
      className={`flex-1 text-center text-[10px] py-1.5 border-r border-slate-200 last:border-r-0 cursor-pointer active:bg-slate-100 ${
        isToday ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'
      }`}
      onClick={() => onSelectDate?.(dateStr)}
    >
      {DAY_NAMES[d.getDay()]}<br />{d.getMonth() + 1}/{d.getDate()}
    </div>
  )
}

/** Swipe config for 3-day view: 9 columns, each 1/9 of total, show middle 3 */
const THREE_DAY_SWIPE: SwipeConfig = {
  baseOffset: '-33.333%',  // skip 3 buffer columns (3/9 = 1/3)
  stepFraction: 1 / 3,     // snap threshold relative to 1 day column width
  maxSteps: 3,             // allow swiping up to 3 days at once
}

/** Swipe config for week view: standard 3-panel */
const WEEK_SWIPE: SwipeConfig = {
  baseOffset: '-33.333%',
  stepFraction: 1,
}

export function MultiDayView({ baseDate, days, onSelectDate, onNavigateDate }: Props) {
  const todayStr = getTodayInTimezone(getSettings().timezoneOffset)

  const [zoomLevel, setZoomLevel] = useState(loadZoomLevel)
  const { containerRef, persistZoom } = usePinchZoom(zoomLevel, setZoomLevel)
  const slotHeight = zoomLevel
  const bottomPadding = slotHeight * SLOTS_PER_HOUR
  const totalHeight = SLOT_COUNT * slotHeight + bottomPadding

  const didScroll = useRef(false)

  useEffect(() => {
    persistZoom(zoomLevel)
  }, [zoomLevel, persistZoom])

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (didScroll.current) return
    const el = containerRef.current
    if (!el) return
    const offset = getSettings().timezoneOffset
    const now = getNowInTimezone(offset)
    const currentSlot = now.hours * SLOTS_PER_HOUR + Math.floor(now.minutes / 5)
    const currentPos = currentSlot * slotHeight
    const viewHeight = el.clientHeight
    el.scrollTop = Math.max(0, currentPos - viewHeight / 3)
    didScroll.current = true
  }, [slotHeight, containerRef])

  const handleNavigate = useCallback((delta: number) => {
    onNavigateDate?.(delta)
  }, [onNavigateDate])

  const swipeConfig = days === 3 ? THREE_DAY_SWIPE : WEEK_SWIPE
  const { swipeStyle } = useSwipe(containerRef, handleNavigate, `${days}-${baseDate}`, swipeConfig)

  if (days === 3) {
    return <ThreeDayLayout
      baseDate={baseDate}
      todayStr={todayStr}
      slotHeight={slotHeight}
      totalHeight={totalHeight}
      containerRef={containerRef}
      swipeStyle={swipeStyle}
      onSelectDate={onSelectDate}
    />
  }

  return <WeekLayout
    baseDate={baseDate}
    todayStr={todayStr}
    slotHeight={slotHeight}
    totalHeight={totalHeight}
    containerRef={containerRef}
    swipeStyle={swipeStyle}
    onSelectDate={onSelectDate}
  />
}

/** 3-day view: 5 individual day columns, viewport shows 3 at a time */
function ThreeDayLayout({
  baseDate,
  todayStr,
  slotHeight,
  totalHeight,
  containerRef,
  swipeStyle,
  onSelectDate,
}: {
  baseDate: string
  todayStr: string
  slotHeight: number
  totalHeight: number
  containerRef: React.RefObject<HTMLDivElement | null>
  swipeStyle: React.CSSProperties
  onSelectDate?: (date: string) => void
}) {
  // 5 dates: [baseDate-1, baseDate, baseDate+1, baseDate+2, baseDate+3]
  const allDates = useMemo(() => getThreeDayDates(baseDate), [baseDate])

  return (
    <div className="flex flex-col h-full">
      {/* Sticky day headers */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1 overflow-hidden">
          {/* 9 columns, each 1/3 viewport = total 9/3 = 3x viewport */}
          <div className="flex" style={{ width: `${(9 / 3) * 100}%`, ...swipeStyle }}>
            {allDates.map((dateStr) => (
              <DayHeader
                key={dateStr}
                dateStr={dateStr}
                todayStr={todayStr}
                onSelectDate={onSelectDate}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: `${totalHeight}px` }}>
          {/* Fixed time labels（1:00〜23:00、00:00は非表示） */}
          <div className="relative flex-shrink-0 w-10 text-[10px] text-slate-400">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2"
                style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
              >
                {slotToTime(h * SLOTS_PER_HOUR)}
              </div>
            ))}
          </div>

          {/* 9 day columns */}
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full" style={{ width: `${(9 / 3) * 100}%`, ...swipeStyle }}>
              {allDates.map((dateStr) => (
                <DayColumn
                  key={dateStr}
                  dateStr={dateStr}
                  slotHeight={slotHeight}
                  todayStr={todayStr}
                  onSelectDate={onSelectDate}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Week view: standard 3-panel (prev/current/next week) */
function WeekLayout({
  baseDate,
  todayStr,
  slotHeight,
  totalHeight,
  containerRef,
  swipeStyle,
  onSelectDate,
}: {
  baseDate: string
  todayStr: string
  slotHeight: number
  totalHeight: number
  containerRef: React.RefObject<HTMLDivElement | null>
  swipeStyle: React.CSSProperties
  onSelectDate?: (date: string) => void
}) {
  const currentDates = useMemo(() => getWeekDates(baseDate), [baseDate])
  const prevDates = useMemo(() => getWeekPanelDates(baseDate, -1), [baseDate])
  const nextDates = useMemo(() => getWeekPanelDates(baseDate, 1), [baseDate])

  const renderPanel = (dates: string[], clickable: boolean) => (
    <div className="flex h-full" style={{ width: '33.333%', flexShrink: 0 }}>
      {dates.map((dateStr) => (
        <DayColumn
          key={dateStr}
          dateStr={dateStr}
          slotHeight={slotHeight}
          todayStr={todayStr}
          onSelectDate={clickable ? onSelectDate : undefined}
        />
      ))}
    </div>
  )

  const renderHeaders = (dates: string[], clickable: boolean) => (
    <div className="flex" style={{ width: '33.333%', flexShrink: 0 }}>
      {dates.map((dateStr) => (
        <DayHeader
          key={dateStr}
          dateStr={dateStr}
          todayStr={todayStr}
          onSelectDate={clickable ? onSelectDate : undefined}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1 overflow-hidden">
          <div className="flex" style={{ width: '300%', ...swipeStyle }}>
            {renderHeaders(prevDates, false)}
            {renderHeaders(currentDates, true)}
            {renderHeaders(nextDates, false)}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: `${totalHeight}px` }}>
          <div className="relative flex-shrink-0 w-10 text-[10px] text-slate-400">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2"
                style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
              >
                {slotToTime(h * SLOTS_PER_HOUR)}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="flex h-full" style={{ width: '300%', ...swipeStyle }}>
              {renderPanel(prevDates, false)}
              {renderPanel(currentDates, true)}
              {renderPanel(nextDates, false)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
