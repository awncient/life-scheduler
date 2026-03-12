import { useState, useEffect } from 'react'
import { SLOTS_PER_HOUR } from '@/types'

type Props = {
  slotHeight: number
}

function getCurrentSlotFraction(): number {
  const now = new Date()
  return now.getHours() * SLOTS_PER_HOUR + now.getMinutes() / 5
}

export function CurrentTimeIndicator({ slotHeight }: Props) {
  const [slotFraction, setSlotFraction] = useState(getCurrentSlotFraction)

  useEffect(() => {
    const interval = setInterval(() => {
      setSlotFraction(getCurrentSlotFraction())
    }, 60_000) // update every minute
    return () => clearInterval(interval)
  }, [])

  const top = slotFraction * slotHeight

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
        <div className="flex-1 h-[2px] bg-red-500" />
      </div>
    </div>
  )
}
