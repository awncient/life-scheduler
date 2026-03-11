import { slotToTime, SLOT_COUNT } from '@/types'
import type { TimeBlock } from '@/types'
import { TimeBlockItem } from './TimeBlock'

type Props = {
  blocks: TimeBlock[]
  slotHeight: number
  onSlotTap: (slot: number) => void
  onBlockTap: (block: TimeBlock) => void
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
          style={{ top: `${h * 4 * slotHeight}px` }}
        >
          {slotToTime(h * 4)}
        </div>
      ))}
    </div>
  )
}

export function TimeGrid({ blocks, slotHeight, onSlotTap, onBlockTap, dimmed }: Props) {
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
          style={{ top: `${h * 4 * slotHeight}px` }}
        />
      ))}

      {/* Clickable slots */}
      {Array.from({ length: SLOT_COUNT }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 hover:bg-slate-50 active:bg-slate-100"
          style={{
            top: `${i * slotHeight}px`,
            height: `${slotHeight}px`,
          }}
          onClick={() => onSlotTap(i)}
        />
      ))}

      {/* Blocks */}
      {blocks.map((block) => (
        <TimeBlockItem
          key={block.id}
          block={block}
          slotHeight={slotHeight}
          onTap={onBlockTap}
        />
      ))}
    </div>
  )
}
