import { useState, useRef, useEffect } from 'react'
import type { TimeBlock } from '@/types'
import { SLOT_COUNT } from '@/types'
import { useBlocks } from '@/hooks/useBlocks'
import { useVersionHistory } from '@/hooks/useVersionHistory'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { getSettings } from '@/lib/storage'
import { TimeGrid, TimeLabels } from './TimeGrid'
import { BlockEditor } from './BlockEditor'
import { VersionHistory } from './VersionHistory'
import { Button } from '@/components/ui/button'
import { History } from 'lucide-react'

type Props = {
  date: string
}

export function DayView({ date }: Props) {
  const {
    schedule,
    addIdealBlock,
    updateIdealBlock,
    deleteIdealBlock,
    addActualBlock,
    updateActualBlock,
    deleteActualBlock,
  } = useBlocks(date)

  const { snapshots, selectedId, selectedSnapshot, setSelectedId, refresh } =
    useVersionHistory(date)

  const [zoomLevel, setZoomLevel] = useState(() => getSettings().zoomLevel)
  const { bind, persistZoom } = usePinchZoom(zoomLevel, setZoomLevel)
  const slotHeight = zoomLevel // px per 15min slot

  const [showVersions, setShowVersions] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null)
  const [editorSide, setEditorSide] = useState<'ideal' | 'actual'>('ideal')
  const [defaultSlot, setDefaultSlot] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)

  // Persist zoom on change
  useEffect(() => {
    persistZoom(zoomLevel)
  }, [zoomLevel, persistZoom])

  // Refresh version history when blocks change
  useEffect(() => {
    refresh()
  }, [schedule.idealBlocks, refresh])

  const displayIdealBlocks = selectedSnapshot
    ? selectedSnapshot.blocks
    : schedule.idealBlocks

  const handleSlotTap = (side: 'ideal' | 'actual', slot: number) => {
    if (selectedSnapshot) return // don't allow editing while previewing
    setEditorSide(side)
    setEditingBlock(null)
    setDefaultSlot(slot)
    setEditorOpen(true)
  }

  const handleBlockTap = (side: 'ideal' | 'actual', block: TimeBlock) => {
    if (selectedSnapshot) return
    setEditorSide(side)
    setEditingBlock(block)
    setDefaultSlot(block.startTime)
    setEditorOpen(true)
  }

  const handleSave = (data: Omit<TimeBlock, 'id'>) => {
    if (editorSide === 'ideal') {
      addIdealBlock(data)
    } else {
      addActualBlock(data)
    }
  }

  const handleUpdate = (id: string, data: Partial<TimeBlock>) => {
    if (editorSide === 'ideal') {
      updateIdealBlock(id, data)
    } else {
      updateActualBlock(id, data)
    }
  }

  const handleDelete = (id: string) => {
    if (editorSide === 'ideal') {
      deleteIdealBlock(id)
    } else {
      deleteActualBlock(id)
    }
  }

  const totalHeight = SLOT_COUNT * slotHeight

  return (
    <div className="flex flex-col h-full">
      {/* Column headers */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="w-10 flex-shrink-0" />
        <div className="flex-1 text-center text-xs font-medium text-slate-600 py-2 border-r border-slate-200">
          <div className="flex items-center justify-center gap-1">
            理想
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowVersions(!showVersions)}
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 text-center text-xs font-medium text-slate-600 py-2">
          実際
        </div>
      </div>

      {/* Version history */}
      {showVersions && (
        <div className="border-b border-slate-200 bg-slate-50 py-2 px-2">
          <VersionHistory
            snapshots={snapshots}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      )}

      {/* Time grids */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto touch-none"
        {...bind()}
      >
        <div className="flex" style={{ height: `${totalHeight}px` }}>
          <TimeLabels slotHeight={slotHeight} />
          <div className="flex-1 border-r border-slate-200 relative">
            <TimeGrid
              blocks={displayIdealBlocks}
              slotHeight={slotHeight}
              onSlotTap={(slot) => handleSlotTap('ideal', slot)}
              onBlockTap={(block) => handleBlockTap('ideal', block)}
              dimmed={!!selectedSnapshot}
            />
          </div>
          <div className="flex-1 relative">
            <TimeGrid
              blocks={schedule.actualBlocks}
              slotHeight={slotHeight}
              onSlotTap={(slot) => handleSlotTap('actual', slot)}
              onBlockTap={(block) => handleBlockTap('actual', block)}
            />
          </div>
        </div>
      </div>

      {/* Block editor dialog */}
      <BlockEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        block={editingBlock}
        defaultStartSlot={defaultSlot}
        onSave={handleSave}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  )
}
