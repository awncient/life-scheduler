import { useState, useEffect } from 'react'
import { SLOTS_PER_HOUR, getNowInTimezone } from '@/types'
import { getSettings } from '@/lib/storage'

type Props = {
  slotHeight: number
}

function getCurrentSlotFraction(): number {
  const offset = getSettings().timezoneOffset
  const now = getNowInTimezone(offset)
  return now.hours * SLOTS_PER_HOUR + now.minutes / 5
}

export function CurrentTimeIndicator({ slotHeight }: Props) {
  const [slotFraction, setSlotFraction] = useState(getCurrentSlotFraction)

  useEffect(() => {
    const interval = setInterval(() => {
      setSlotFraction(getCurrentSlotFraction())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const top = slotFraction * slotHeight

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="relative h-0">
        <div className="absolute w-2.5 h-2.5 rounded-full bg-red-500 -top-[5px] -left-[5px]" />
        <div className="absolute left-0 right-0 h-[2px] bg-red-500 -top-[1px]" />
      </div>
    </div>
  )
}
