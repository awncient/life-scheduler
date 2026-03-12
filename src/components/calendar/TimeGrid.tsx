import { slotToTime, SLOT_COUNT, SLOTS_PER_HOUR } from '@/types'
import type { TimeBlock } from '@/types'
import { TimeBlockItem } from './TimeBlock'

type Props = {
  blocks: TimeBlock[]
  slotHeight: number
  onSlotTap: (slot: number) => void
  onBlockTap: (block: TimeBlock) => void
  onBlockDragEnd?: (block: TimeBlock, newStartSlot: number) => void
  onCopyToActual?: (block: TimeBlock) => void
  dimmed?: boolean
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
            // Snap to 15-min boundary (every 3 slots of 5min)
            const snapped = Math.floor(slotInHour / 3) * 3
            onSlotTap(h * SLOTS_PER_HOUR + snapped)
          }}
        />
      ))}

      {/* Blocks */}
      {blocks.map((block) => (
        <TimeBlockItem
          key={block.id}
          block={block}
          slotHeight={slotHeight}
          onTap={onBlockTap}
          onDragEnd={onBlockDragEnd}
          onCopyToActual={onCopyToActual}
        />
      ))}
    </div>
  )
}
