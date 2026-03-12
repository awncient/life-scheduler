import { useMemo } from 'react'
import { slotToTime, SLOT_COUNT, SLOTS_PER_HOUR } from '@/types'
import type { TimeBlock } from '@/types'
import { TimeBlockItem } from './TimeBlock'

type Props = {
  blocks: TimeBlock[]
  slotHeight: number
  onSlotTap: (slot: number) => void
  onBlockTap: (block: TimeBlock) => void
  onBlockDragEnd?: (block: TimeBlock, newStartSlot: number) => void
  onCopyToActual?: (block: TimeBlock, newStartSlot: number) => void
  dimmed?: boolean
}

type LayoutInfo = {
  block: TimeBlock
  col: number
  totalCols: number
}

/** Compute side-by-side layout for overlapping blocks (Google Calendar style) */
function computeLayout(blocks: TimeBlock[]): LayoutInfo[] {
  if (blocks.length === 0) return []

  // Sort by start time, then by duration (longer first)
  const sorted = [...blocks].sort((a, b) =>
    a.startTime !== b.startTime
      ? a.startTime - b.startTime
      : (b.endTime - b.startTime) - (a.endTime - a.startTime),
  )

  // Assign columns using a greedy approach
  const colEnds: number[] = [] // tracks the end slot of each column
  const assignments = new Map<string, { col: number; group: string[] }>()

  for (const block of sorted) {
    // Find first column where this block fits
    let col = -1
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= block.startTime) {
        col = c
        break
      }
    }
    if (col === -1) {
      col = colEnds.length
      colEnds.push(0)
    }
    colEnds[col] = block.endTime
    assignments.set(block.id, { col, group: [] })
  }

  // Now determine overlap groups: blocks that overlap each other share a group
  // and should know the total columns in their group
  const result: LayoutInfo[] = []

  for (const block of sorted) {
    const assignment = assignments.get(block.id)!
    // Find all blocks overlapping with this one
    let maxCol = assignment.col
    for (const other of sorted) {
      if (other.id === block.id) continue
      // Check overlap
      if (other.startTime < block.endTime && other.endTime > block.startTime) {
        const otherAssign = assignments.get(other.id)!
        maxCol = Math.max(maxCol, otherAssign.col)
      }
    }
    result.push({
      block,
      col: assignment.col,
      totalCols: maxCol + 1,
    })
  }

  return result
}

export function TimeLabels({ slotHeight }: { slotHeight: number }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="relative flex-shrink-0 w-10 text-[10px] text-slate-400">
      {hours.map((h) => (
        <div
          key={h}
          className="absolute right-1 -translate-y-1/2"
          style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
        >
          {slotToTime(h * SLOTS_PER_HOUR)}
        </div>
      ))}
    </div>
  )
}

export function TimeGrid({ blocks, slotHeight, onSlotTap, onBlockTap, onBlockDragEnd, onCopyToActual, dimmed }: Props) {
  const totalHeight = SLOT_COUNT * slotHeight
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const layout = useMemo(() => computeLayout(blocks), [blocks])

  return (
    <div
      className={`relative flex-1 ${dimmed ? 'opacity-50' : ''}`}
      style={{ height: `${totalHeight}px` }}
    >
      {/* Hour lines */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-slate-200"
          style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
        />
      ))}

      {/* Clickable hour zones */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0"
          style={{
            top: `${h * SLOTS_PER_HOUR * slotHeight}px`,
            height: `${SLOTS_PER_HOUR * slotHeight}px`,
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - rect.top
            const slotInHour = Math.floor(y / slotHeight)
            const snapped = Math.floor(slotInHour / 3) * 3
            onSlotTap(h * SLOTS_PER_HOUR + snapped)
          }}
        />
      ))}

      {/* Blocks with overlap layout */}
      {layout.map(({ block, col, totalCols }) => (
        <TimeBlockItem
          key={block.id}
          block={block}
          slotHeight={slotHeight}
          onTap={onBlockTap}
          onDragEnd={onBlockDragEnd}
          onCopyToActual={onCopyToActual}
          layoutCol={col}
          layoutTotalCols={totalCols}
        />
      ))}
    </div>
  )
}
