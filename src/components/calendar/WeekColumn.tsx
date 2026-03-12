import type { TimeBlock } from '@/types'
import { SLOT_COUNT, SLOTS_PER_HOUR } from '@/types'
import { TimeBlockItem } from './TimeBlock'

type Props = {
  blocks: TimeBlock[]
  slotHeight: number
  label: string
  isToday: boolean
  onTap: () => void
}

export function WeekColumn({ blocks, slotHeight, label, isToday, onTap }: Props) {
  const totalHeight = SLOT_COUNT * slotHeight
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="flex-1 border-r border-slate-200 last:border-r-0 min-w-0">
      <div
        className={`text-center text-[10px] py-1.5 border-b border-slate-200 cursor-pointer active:bg-slate-100 ${
          isToday ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'
        }`}
        onClick={onTap}
      >
        {label}
      </div>
      <div className="relative" style={{ height: `${totalHeight}px` }}>
        {hours.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-slate-100"
            style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
          />
        ))}
        {blocks.map((block) => (
          <TimeBlockItem
            key={block.id}
            block={block}
            slotHeight={slotHeight}
            onTap={onTap}
          />
        ))}
      </div>
    </div>
  )
}
