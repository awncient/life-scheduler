import { useState, useEffect, useCallback, useRef } from 'react'
import type { TimeBlock } from '@/types'
import { SLOT_COUNT, SLOTS_PER_HOUR, DEFAULT_SETTINGS, IDEAL_COLOR, ACTUAL_COLOR, formatDate } from '@/types'
import { useBlocks } from '@/hooks/useBlocks'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { getSettings } from '@/lib/storage'
import { TimeGrid, TimeLabels } from './TimeGrid'
import { BlockEditor } from './BlockEditor'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'
import { Button } from '@/components/ui/button'
import { History } from 'lucide-react'

type Props = {
  date: string
  onOpenHistory?: () => void
}

function loadZoomLevel(): number {
  const stored = getSettings().zoomLevel
  if (stored < 2 || stored > 12) return DEFAULT_SETTINGS.zoomLevel
  return stored
}

export function DayView({ date, onOpenHistory }: Props) {
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

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null)
  const [editorSide, setEditorSide] = useState<'ideal' | 'actual'>('ideal')
  const [defaultSlot, setDefaultSlot] = useState(0)

  const didScroll = useRef(false)
  const isToday = date === formatDate(new Date())

  useEffect(() => {
    persistZoom(zoomLevel)
  }, [zoomLevel, persistZoom])

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (didScroll.current) return
    const el = containerRef.current
    if (!el) return
    const now = new Date()
    const currentSlot = now.getHours() * SLOTS_PER_HOUR + Math.floor(now.getMinutes() / 5)
    const currentPos = currentSlot * slotHeight
    const viewHeight = el.clientHeight
    el.scrollTop = Math.max(0, currentPos - viewHeight / 3)
    didScroll.current = true
  }, [slotHeight, containerRef])

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

  return (
    <div className="flex flex-col h-full">
      {/* Column headers */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1 text-center text-xs font-medium text-slate-600 py-2 border-r border-slate-200">
          <div className="flex items-center justify-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm mr-0.5" style={{ backgroundColor: IDEAL_COLOR }} />
            理想
            {onOpenHistory && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onOpenHistory}
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 text-center text-xs font-medium text-slate-600 py-2">
          <div className="flex items-center justify-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm mr-0.5" style={{ backgroundColor: ACTUAL_COLOR }} />
            実際
          </div>
        </div>
      </div>

      {/* Time grids */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
      >
        <div className="flex relative" style={{ height: `${totalHeight}px` }}>
          <TimeLabels slotHeight={slotHeight} />
          <div className="flex-1 border-r border-slate-200 relative">
            <TimeGrid
              blocks={schedule.idealBlocks}
              slotHeight={slotHeight}
              onSlotTap={(slot) => handleSlotTap('ideal', slot)}
              onBlockTap={(block) => handleBlockTap('ideal', block)}
              onBlockDragEnd={(block, newStart) => handleBlockDragEnd('ideal', block, newStart)}
              onCopyToActual={copyToActual}
            />
            {/* Current time indicator spans both columns */}
            {isToday && <CurrentTimeIndicator slotHeight={slotHeight} />}
          </div>
          <div className="flex-1 relative">
            <TimeGrid
              blocks={schedule.actualBlocks}
              slotHeight={slotHeight}
              onSlotTap={(slot) => handleSlotTap('actual', slot)}
              onBlockTap={(block) => handleBlockTap('actual', block)}
              onBlockDragEnd={(block, newStart) => handleBlockDragEnd('actual', block, newStart)}
            />
            {isToday && <CurrentTimeIndicator slotHeight={slotHeight} />}
          </div>
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
