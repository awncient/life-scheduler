import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { TimeBlock } from '@/types'
import { SLOT_COUNT, SLOTS_PER_HOUR, DEFAULT_SETTINGS, IDEAL_COLOR, ACTUAL_COLOR, formatDate, parseDate, getNowInTimezone, getTodayInTimezone } from '@/types'
import { useBlocks } from '@/hooks/useBlocks'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { useSwipe } from '@/hooks/useSwipe'
import { getSettings, getSchedule } from '@/lib/storage'
import { TimeGrid, TimeLabels } from './TimeGrid'
import { BlockEditor } from './BlockEditor'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'
import { Button } from '@/components/ui/button'
import { History } from 'lucide-react'

type Props = {
  date: string
  onOpenHistory?: () => void
  onNavigateDate?: (delta: number) => void
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
      {blocks.map((block) => {
        const top = block.startTime * slotHeight
        const height = (block.endTime - block.startTime) * slotHeight
        return (
          <div
            key={block.id}
            className="absolute left-0.5 right-0.5 rounded-sm px-1 text-white text-[10px] overflow-hidden"
            style={{
              top: `${top}px`,
              height: `${height}px`,
              backgroundColor: block.color,
              minHeight: '4px',
            }}
          >
            <div className="truncate leading-tight">{block.title}</div>
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

export function DayView({ date, onOpenHistory, onNavigateDate }: Props) {
  const {
    schedule,
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

  // Read-only data for side panels
  const prevDate = useMemo(() => offsetDateStr(date, -1), [date])
  const nextDate = useMemo(() => offsetDateStr(date, 1), [date])
  const prevSchedule = useMemo(() => getSchedule(prevDate), [prevDate])
  const nextSchedule = useMemo(() => getSchedule(nextDate), [nextDate])

  const handleSlotTap = (side: 'ideal' | 'actual', slot: number) => {
    setEditorSide(side)
    setEditingBlock(null)
    setDefaultSlot(slot)
    setEditorOpen(true)
  }

  const handleBlockTap = (side: 'ideal' | 'actual', block: TimeBlock) => {
    setEditorSide(side)
    setEditingBlock(block)
    setDefaultSlot(block.startTime)
    setEditorOpen(true)
  }

  const handleBlockDragEnd = useCallback(
    (side: 'ideal' | 'actual', block: TimeBlock, newStartSlot: number) => {
      if (side === 'ideal') {
        moveIdealBlock(block.id, newStartSlot)
      } else {
        moveActualBlock(block.id, newStartSlot)
      }
    },
    [moveIdealBlock, moveActualBlock],
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

  const handleSave = (data: Omit<TimeBlock, 'id'>) => {
    const color = editorSide === 'ideal' ? IDEAL_COLOR : ACTUAL_COLOR
    if (editorSide === 'ideal') addIdealBlock({ ...data, color })
    else addActualBlock({ ...data, color })
  }

  const handleUpdate = (id: string, data: Partial<TimeBlock>) => {
    if (editorSide === 'ideal') updateIdealBlock(id, data)
    else updateActualBlock(id, data)
  }

  const handleDelete = (id: string) => {
    if (editorSide === 'ideal') deleteIdealBlock(id)
    else deleteActualBlock(id)
  }

  const totalHeight = SLOT_COUNT * slotHeight

  /** Render a read-only day panel (for prev/next in swipe) */
  const renderReadOnlyPanel = (panelSchedule: typeof schedule) => (
    <div className="h-full flex" style={{ width: '33.333%', flexShrink: 0 }}>
      <TimeLabels slotHeight={slotHeight} />
      <div className="flex-1 flex relative">
        <div className="flex-1 border-r border-slate-200 relative">
          <HourLines slotHeight={slotHeight} />
          <ReadOnlyBlocks blocks={panelSchedule.idealBlocks} slotHeight={slotHeight} />
        </div>
        <div className="flex-1 relative">
          <HourLines slotHeight={slotHeight} />
          <ReadOnlyBlocks blocks={panelSchedule.actualBlocks} slotHeight={slotHeight} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Column headers — fixed height for both columns */}
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

      {/* Scrollable time grids — shared scroll container for all 3 panels */}
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
          {/* Prev day (read-only) */}
          {renderReadOnlyPanel(prevSchedule)}

          {/* Current day (interactive) */}
          <div className="h-full flex" style={{ width: '33.333%', flexShrink: 0 }}>
            <TimeLabels slotHeight={slotHeight} />
            <div className="flex-1 flex relative">
              <div className="flex-1 border-r border-slate-200 relative">
                <TimeGrid
                  blocks={schedule.idealBlocks}
                  slotHeight={slotHeight}
                  onSlotTap={(slot) => handleSlotTap('ideal', slot)}
                  onBlockTap={(block) => handleBlockTap('ideal', block)}
                  onBlockDragEnd={(block, newStart) => handleBlockDragEnd('ideal', block, newStart)}
                  onCopyToActual={copyToActual}
                />
              </div>
              <div className="flex-1 relative">
                <TimeGrid
                  blocks={schedule.actualBlocks}
                  slotHeight={slotHeight}
                  onSlotTap={(slot) => handleSlotTap('actual', slot)}
                  onBlockTap={(block) => handleBlockTap('actual', block)}
                  onBlockDragEnd={(block, newStart) => handleBlockDragEnd('actual', block, newStart)}
                />
              </div>
              {/* Single current time indicator spanning both columns */}
              {isToday && <CurrentTimeIndicator slotHeight={slotHeight} />}
            </div>
          </div>

          {/* Next day (read-only) */}
          {renderReadOnlyPanel(nextSchedule)}
        </div>
      </div>

      <BlockEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        block={editingBlock}
        defaultStartSlot={defaultSlot}
        side={editorSide}
        onSave={handleSave}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onCopyToActual={editorSide === 'ideal' ? copyToActual : undefined}
      />
    </div>
  )
}
