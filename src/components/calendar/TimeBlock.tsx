import type { TimeBlock as TimeBlockType } from '@/types'
import { slotToTime } from '@/types'

type Props = {
  block: TimeBlockType
  slotHeight: number
  onTap: (block: TimeBlockType) => void
}

export function TimeBlockItem({ block, slotHeight, onTap }: Props) {
  const top = block.startTime * slotHeight
  const height = (block.endTime - block.startTime) * slotHeight
  const timeLabel = `${slotToTime(block.startTime)}–${slotToTime(block.endTime)}`

  return (
    <div
      className="absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-white text-xs overflow-hidden cursor-pointer active:opacity-80"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: block.color,
        minHeight: '16px',
      }}
      onClick={() => onTap(block)}
    >
      <div className="font-medium truncate leading-tight">{block.title}</div>
      {height > slotHeight * 2 && (
        <div className="opacity-75 text-[10px] leading-tight">{timeLabel}</div>
      )}
    </div>
  )
}
