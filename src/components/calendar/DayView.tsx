import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { TimeBlock } from '@/types'
import { SLOT_COUNT, SLOTS_PER_HOUR, DEFAULT_SETTINGS, IDEAL_COLOR, ACTUAL_COLOR, formatDate, parseDate, getNowInTimezone, getTodayInTimezone, adjustBlocksForTimezone, getVisibleBlocksForDay } from '@/types'
import { useBlocks } from '@/hooks/useBlocks'
import { getSchedule, getSchedule as getStoredSchedule, saveSchedule as saveStoredSchedule, getSettings } from '@/lib/storage'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { useSwipe } from '@/hooks/useSwipe'
import { TimeGrid, TimeLabels } from './TimeGrid'
import { BlockEditor } from './BlockEditor'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'
import { Button } from '@/components/ui/button'
import { History } from 'lucide-react'
import {
  type NotifyConfig,
  saveBlockNotifyConfig,
  getBlockNotifyConfig,
  syncNotificationSchedule,
  deleteNotificationSchedule,
  isNotificationReady,
} from '@/lib/notify'

type Props = {
  date: string
  onOpenHistory?: () => void
  onNavigateDate?: (delta: number) => void
  scrollToSlot?: number | null
}

function loadZoomLevel(): number {
  const stored = getSettings().zoomLevel
  if (stored < 2 || stored > 12) return DEFAULT_SETTINGS.zoomLevel
  return stored
}

function offsetDateStr(dateStr: string, delta: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + delta)
  return formatDate(d)
}

/** Read-only block rendering for side panels */
function ReadOnlyBlocks({ blocks, slotHeight }: { blocks: TimeBlock[]; slotHeight: number }) {
  return (
    <>
      {blocks.map((block, i) => {
        const top = block.startTime * slotHeight
        const height = Math.max(16, (block.endTime - block.startTime) * slotHeight - 1)
        return (
          <div
            key={`${block.id}-${i}`}
            className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-white text-xs overflow-hidden"
            style={{
              top: `${top}px`,
              height: `${height}px`,
              backgroundColor: block.color,
              paddingLeft: '4px',
              paddingRight: '2px',
              minHeight: '16px',
            }}
          >
            <div className="font-medium leading-tight break-words">{block.title || '（タイトルなし）'}</div>
          </div>
        )
      })}
    </>
  )
}

/** Hour grid lines */
function HourLines({ slotHeight }: { slotHeight: number }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  return (
    <>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-slate-200"
          style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
        />
      ))}
    </>
  )
}

/**
 * Get visible blocks for a date, including cross-day blocks from nearby days.
 * Checks current day + previous day for blocks that extend into dateStr.
 */
function getEffectiveBlocks(dateStr: string, side: 'ideal' | 'actual'): TimeBlock[] {
  const schedule = getSchedule(dateStr)
  const ownBlocks = side === 'ideal' ? schedule.idealBlocks : schedule.actualBlocks

  // Blocks stored on this day
  const result = getVisibleBlocksForDay(dateStr, ownBlocks, dateStr)

  // Check previous days for cross-day blocks extending into this day
  for (let delta = 1; delta <= 3; delta++) {
    const prevDateStr = offsetDateStr(dateStr, -delta)
    const prevSchedule = getSchedule(prevDateStr)
    const prevBlocks = side === 'ideal' ? prevSchedule.idealBlocks : prevSchedule.actualBlocks
    const overflow = getVisibleBlocksForDay(dateStr, prevBlocks, prevDateStr)
    result.push(...overflow)
  }

  return result
}

export function DayView({ date, onOpenHistory, onNavigateDate, scrollToSlot }: Props) {
  const {
    schedule,
    refresh,
    addIdealBlock,
    updateIdealBlock,
    deleteIdealBlock,
    addActualBlock,
    updateActualBlock,
    deleteActualBlock,
    moveIdealBlock,
    moveActualBlock,
  } = useBlocks(date)

  const [zoomLevel, setZoomLevel] = useState(loadZoomLevel)
  const { containerRef, persistZoom } = usePinchZoom(zoomLevel, setZoomLevel)
  const slotHeight = zoomLevel

  const handleNavigate = useCallback((delta: number) => {
    onNavigateDate?.(delta)
  }, [onNavigateDate])

  const { swipeStyle } = useSwipe(containerRef, handleNavigate, date)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null)
  const [editorSide, setEditorSide] = useState<'ideal' | 'actual'>('ideal')
  const [defaultSlot, setDefaultSlot] = useState(0)

  const didScroll = useRef(false)
  const timezoneOffset = getSettings().timezoneOffset
  const isToday = date === getTodayInTimezone(timezoneOffset)

  useEffect(() => {
    persistZoom(zoomLevel)
  }, [zoomLevel, persistZoom])

  // Auto-scroll to current time only on initial mount
  useEffect(() => {
    if (didScroll.current) return
    const el = containerRef.current
    if (!el) return
    const now = getNowInTimezone(timezoneOffset)
    const currentSlot = now.hours * SLOTS_PER_HOUR + Math.floor(now.minutes / 5)
    const currentPos = currentSlot * slotHeight
    const viewHeight = el.clientHeight
    el.scrollTop = Math.max(0, currentPos - viewHeight / 3)
    didScroll.current = true
  }, [slotHeight, containerRef])

  // 検索結果からの遷移時: 対象ブロックが画面中央に来るようスクロール
  useEffect(() => {
    if (scrollToSlot == null) return
    const el = containerRef.current
    if (!el) return
    const targetPos = scrollToSlot * slotHeight
    const viewHeight = el.clientHeight
    el.scrollTop = Math.max(0, targetPos - viewHeight / 2)
  }, [scrollToSlot, slotHeight, containerRef])

  // Read-only data for side panels
  const prevDate = useMemo(() => offsetDateStr(date, -1), [date])
  const nextDate = useMemo(() => offsetDateStr(date, 1), [date])

  // Effective blocks including cross-day overflow
  const visibleIdealBlocks = useMemo(
    () => adjustBlocksForTimezone(getEffectiveBlocks(date, 'ideal'), timezoneOffset),
    [date, schedule, timezoneOffset],
  )
  const visibleActualBlocks = useMemo(
    () => adjustBlocksForTimezone(getEffectiveBlocks(date, 'actual'), timezoneOffset),
    [date, schedule, timezoneOffset],
  )

  const handleSlotTap = (side: 'ideal' | 'actual', slot: number) => {
    setEditorSide(side)
    setEditingBlock(null)
    setDefaultSlot(slot)
    setEditorOpen(true)
  }

  const handleBlockTap = (side: 'ideal' | 'actual', block: TimeBlock) => {
    setEditorSide(side)
    // Restore original times for the editor (not the clipped visible times)
    const editBlock: TimeBlock = {
      ...block,
      startTime: block._origStartTime ?? block.startTime,
      endTime: block._origEndTime ?? block.endTime,
    }
    setEditingBlock(editBlock)
    setDefaultSlot(editBlock.startTime)
    setEditorOpen(true)
  }

  const handleBlockDragEnd = useCallback(
    (side: 'ideal' | 'actual', block: TimeBlock, newStartSlot: number) => {
      if (side === 'ideal') {
        moveIdealBlock(block.id, newStartSlot)
        // 通知スケジュールも更新
        if (isNotificationReady()) {
          const duration = block.endTime - block.startTime
          const newEndSlot = Math.min(newStartSlot + duration, SLOT_COUNT)
          const blockDate = block._sourceScheduleDate || date
          const cfg = getBlockNotifyConfig(block.id, blockDate)
          if (cfg) {
            syncNotificationSchedule(block.id, blockDate, newStartSlot, newEndSlot, cfg, timezoneOffset)
          }
        }
      } else {
        moveActualBlock(block.id, newStartSlot)
      }
    },
    [moveIdealBlock, moveActualBlock, date, timezoneOffset],
  )

  const copyToActual = useCallback(
    (block: TimeBlock, newStartSlot?: number) => {
      const start = newStartSlot ?? block.startTime
      const duration = block.endTime - block.startTime
      addActualBlock({
        title: block.title,
        startTime: start,
        endTime: start + duration,
        color: ACTUAL_COLOR,
      })
    },
    [addActualBlock],
  )

  const handleSave = (data: Omit<TimeBlock, 'id'> & { endDate?: string }, notifyConfig?: NotifyConfig) => {
    const color = editorSide === 'ideal' ? IDEAL_COLOR : ACTUAL_COLOR
    const blockData = {
      ...data,
      color,
      startDate: date,
      endDate: data.endDate,
    }

    let newBlock: TimeBlock | undefined
    if (editorSide === 'ideal') {
      newBlock = addIdealBlock(blockData)
    } else {
      newBlock = addActualBlock(blockData)
    }

    // 通知スケジュールの同期
    if (notifyConfig && newBlock && isNotificationReady()) {
      saveBlockNotifyConfig(newBlock.id, date, notifyConfig)
      syncNotificationSchedule(
        newBlock.id, date, data.startTime, data.endTime, notifyConfig, timezoneOffset
      )
    }
  }

  const handleUpdate = (id: string, data: Partial<TimeBlock> & { endDate?: string }, notifyConfig?: NotifyConfig) => {
    const sourceDate = editingBlock?._sourceScheduleDate || date
    const key = editorSide === 'ideal' ? 'idealBlocks' : 'actualBlocks' as const
    const newStartDate = data.startDate || sourceDate

    // ブロックの開始日が保存先と異なる場合、ブロックを正しいスケジュールに移動する
    if (newStartDate !== sourceDate) {
      // 元のスケジュールからブロックを削除
      const oldSchedule = getStoredSchedule(sourceDate)
      const removedBlock = oldSchedule[key].find((b: TimeBlock) => b.id === id)
      oldSchedule[key] = oldSchedule[key].filter((b: TimeBlock) => b.id !== id)
      saveStoredSchedule(oldSchedule)

      // 新しいスケジュールにブロックを追加
      const newSchedule = getStoredSchedule(newStartDate)
      const updatedBlock = { ...(removedBlock || editingBlock!), ...data }
      newSchedule[key] = [...newSchedule[key], updatedBlock]
      saveStoredSchedule(newSchedule)
      refresh()
    } else if (sourceDate !== date) {
      // ブロックは別の日のスケジュールに保存されているが、開始日は変わらない
      const sourceSchedule = getStoredSchedule(sourceDate)
      sourceSchedule[key] = sourceSchedule[key].map((b: TimeBlock) =>
        b.id === id ? { ...b, ...data } : b,
      )
      saveStoredSchedule(sourceSchedule)
      refresh()
    } else {
      if (editorSide === 'ideal') updateIdealBlock(id, data)
      else updateActualBlock(id, data)
    }

    // 通知スケジュールの同期
    if (isNotificationReady() && editorSide === 'ideal') {
      const blockDate = newStartDate
      if (notifyConfig) {
        saveBlockNotifyConfig(id, blockDate, notifyConfig)
        const startSlot = data.startTime ?? editingBlock?.startTime ?? 0
        const endSlot = data.endTime ?? editingBlock?.endTime ?? 0
        syncNotificationSchedule(id, blockDate, startSlot, endSlot, notifyConfig, timezoneOffset)
      } else {
        // 通知設定なし → サーバーからも削除
        deleteNotificationSchedule(id, blockDate)
      }
    }
  }

  const handleDelete = (id: string) => {
    const sourceDate = editingBlock?._sourceScheduleDate || date
    if (sourceDate !== date) {
      // ブロックは別の日のスケジュールに保存されている — そこから削除
      const sourceSchedule = getStoredSchedule(sourceDate)
      const key = editorSide === 'ideal' ? 'idealBlocks' : 'actualBlocks' as const
      sourceSchedule[key] = sourceSchedule[key].filter((b: TimeBlock) => b.id !== id)
      saveStoredSchedule(sourceSchedule)
      refresh()
    } else {
      if (editorSide === 'ideal') deleteIdealBlock(id)
      else deleteActualBlock(id)
    }

    // 通知スケジュールも削除
    if (isNotificationReady() && editorSide === 'ideal') {
      deleteNotificationSchedule(id, sourceDate)
    }
  }

  const bottomPadding = slotHeight * SLOTS_PER_HOUR // 1時間分の余白を24時以降に追加
  const totalHeight = SLOT_COUNT * slotHeight + bottomPadding

  /** Render a read-only day panel (for prev/next in swipe) */
  const renderReadOnlyPanel = (panelDate: string) => {
    const idealBlocks = adjustBlocksForTimezone(getEffectiveBlocks(panelDate, 'ideal'), timezoneOffset)
    const actualBlocks = adjustBlocksForTimezone(getEffectiveBlocks(panelDate, 'actual'), timezoneOffset)
    return (
      <div className="h-full flex" style={{ width: '33.333%', flexShrink: 0 }}>
        <TimeLabels slotHeight={slotHeight} />
        <div className="flex-1 flex relative">
          <div className="flex-1 border-r border-slate-200 relative">
            <HourLines slotHeight={slotHeight} />
            <ReadOnlyBlocks blocks={idealBlocks} slotHeight={slotHeight} />
          </div>
          <div className="flex-1 relative">
            <HourLines slotHeight={slotHeight} />
            <ReadOnlyBlocks blocks={actualBlocks} slotHeight={slotHeight} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Column headers */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1 flex items-center justify-center text-xs font-medium text-slate-600 py-2 border-r border-slate-200 min-h-[36px]">
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: IDEAL_COLOR }} />
          理想
          {onOpenHistory && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1"
              onClick={onOpenHistory}
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center text-xs font-medium text-slate-600 py-2 min-h-[36px]">
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: ACTUAL_COLOR }} />
          実際
        </div>
      </div>

      {/* Scrollable time grids */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div
          className="flex"
          style={{
            width: '300%',
            height: `${totalHeight}px`,
            ...swipeStyle,
          }}
        >
          {renderReadOnlyPanel(prevDate)}

          {/* Current day (interactive) */}
          <div className="h-full flex" style={{ width: '33.333%', flexShrink: 0 }}>
            <TimeLabels slotHeight={slotHeight} />
            <div className="flex-1 flex relative">
              <div className="flex-1 border-r border-slate-200 relative">
                <TimeGrid
                  blocks={visibleIdealBlocks}
                  slotHeight={slotHeight}
                  onSlotTap={(slot) => handleSlotTap('ideal', slot)}
                  onBlockTap={(block) => handleBlockTap('ideal', block)}
                  onBlockDragEnd={(block, newStart) => handleBlockDragEnd('ideal', block, newStart)}
                  onCopyToActual={copyToActual}
                />
              </div>
              <div className="flex-1 relative">
                <TimeGrid
                  blocks={visibleActualBlocks}
                  slotHeight={slotHeight}
                  onSlotTap={(slot) => handleSlotTap('actual', slot)}
                  onBlockTap={(block) => handleBlockTap('actual', block)}
                  onBlockDragEnd={(block, newStart) => handleBlockDragEnd('actual', block, newStart)}
                />
              </div>
              {isToday && <CurrentTimeIndicator slotHeight={slotHeight} />}
            </div>
          </div>

          {renderReadOnlyPanel(nextDate)}
        </div>
      </div>

      <BlockEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        block={editingBlock}
        defaultStartSlot={defaultSlot}
        date={date}
        side={editorSide}
        onSave={handleSave}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onCopyToActual={editorSide === 'ideal' ? copyToActual : undefined}
      />
    </div>
  )
}
