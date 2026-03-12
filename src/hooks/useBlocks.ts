import { useState, useCallback, useEffect } from 'react'
import type { TimeBlock, DaySchedule } from '@/types'
import { generateId, SLOT_COUNT } from '@/types'
import { getSchedule, saveSchedule, getSnapshots, saveSnapshots } from '@/lib/storage'

const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

function isStructuralChange(
  prev: TimeBlock[],
  next: TimeBlock[],
): boolean {
  if (prev.length !== next.length) return true
  const prevIds = new Set(prev.map((b) => b.id))
  const nextIds = new Set(next.map((b) => b.id))
  // Added or removed blocks
  if (prev.some((b) => !nextIds.has(b.id))) return true
  if (next.some((b) => !prevIds.has(b.id))) return true
  // Time changes (not title/color)
  for (const nb of next) {
    const pb = prev.find((b) => b.id === nb.id)
    if (pb && (pb.startTime !== nb.startTime || pb.endTime !== nb.endTime)) return true
  }
  return false
}

function createOrUpdateSnapshot(date: string, blocks: TimeBlock[]): void {
  const snaps = getSnapshots(date)
  const now = Date.now()

  // If latest snapshot is within 10 min, replace it
  if (snaps.length > 0) {
    const latest = snaps[snaps.length - 1]
    const latestTime = new Date(latest.savedAt).getTime()
    if (now - latestTime < SNAPSHOT_INTERVAL_MS) {
      snaps[snaps.length - 1] = {
        ...latest,
        savedAt: new Date().toISOString(),
        blocks: structuredClone(blocks),
      }
      saveSnapshots(date, snaps)
      return
    }
  }

  // Otherwise create new snapshot
  snaps.push({
    id: generateId(),
    date,
    savedAt: new Date().toISOString(),
    blocks: structuredClone(blocks),
  })
  saveSnapshots(date, snaps)
}

export function useBlocks(date: string) {
  const [schedule, setSchedule] = useState<DaySchedule>(() => getSchedule(date))

  useEffect(() => {
    setSchedule(getSchedule(date))
  }, [date])

  const saveWithOptionalSnapshot = useCallback(
    (updated: DaySchedule, prevIdealBlocks: TimeBlock[]) => {
      saveSchedule(updated)
      setSchedule(updated)

      if (isStructuralChange(prevIdealBlocks, updated.idealBlocks)) {
        createOrUpdateSnapshot(date, updated.idealBlocks)
      }
    },
    [date],
  )

  // Ideal blocks
  const addIdealBlock = useCallback(
    (block: Omit<TimeBlock, 'id'>) => {
      const prev = schedule.idealBlocks
      const updated = {
        ...schedule,
        idealBlocks: [...prev, { ...block, id: generateId() }],
      }
      saveWithOptionalSnapshot(updated, prev)
    },
    [schedule, saveWithOptionalSnapshot],
  )

  const updateIdealBlock = useCallback(
    (id: string, updates: Partial<TimeBlock>) => {
      const prev = schedule.idealBlocks
      const updated = {
        ...schedule,
        idealBlocks: prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      }
      saveWithOptionalSnapshot(updated, prev)
    },
    [schedule, saveWithOptionalSnapshot],
  )

  const deleteIdealBlock = useCallback(
    (id: string) => {
      const prev = schedule.idealBlocks
      const updated = {
        ...schedule,
        idealBlocks: prev.filter((b) => b.id !== id),
      }
      saveWithOptionalSnapshot(updated, prev)
    },
    [schedule, saveWithOptionalSnapshot],
  )

  const moveIdealBlock = useCallback(
    (id: string, newStartSlot: number) => {
      const prev = schedule.idealBlocks
      const block = prev.find((b) => b.id === id)
      if (!block) return
      const duration = block.endTime - block.startTime
      const newEnd = Math.min(newStartSlot + duration, SLOT_COUNT)
      const updated = {
        ...schedule,
        idealBlocks: prev.map((b) =>
          b.id === id ? { ...b, startTime: newStartSlot, endTime: newEnd } : b,
        ),
      }
      saveWithOptionalSnapshot(updated, prev)
    },
    [schedule, saveWithOptionalSnapshot],
  )

  // Actual blocks
  const addActualBlock = useCallback(
    (block: Omit<TimeBlock, 'id'>) => {
      const updated = {
        ...schedule,
        actualBlocks: [...schedule.actualBlocks, { ...block, id: generateId() }],
      }
      saveSchedule(updated)
      setSchedule(updated)
    },
    [schedule],
  )

  const updateActualBlock = useCallback(
    (id: string, updates: Partial<TimeBlock>) => {
      const updated = {
        ...schedule,
        actualBlocks: schedule.actualBlocks.map((b) =>
          b.id === id ? { ...b, ...updates } : b,
        ),
      }
      saveSchedule(updated)
      setSchedule(updated)
    },
    [schedule],
  )

  const deleteActualBlock = useCallback(
    (id: string) => {
      const updated = {
        ...schedule,
        actualBlocks: schedule.actualBlocks.filter((b) => b.id !== id),
      }
      saveSchedule(updated)
      setSchedule(updated)
    },
    [schedule],
  )

  const moveActualBlock = useCallback(
    (id: string, newStartSlot: number) => {
      const block = schedule.actualBlocks.find((b) => b.id === id)
      if (!block) return
      const duration = block.endTime - block.startTime
      const newEnd = Math.min(newStartSlot + duration, SLOT_COUNT)
      const updated = {
        ...schedule,
        actualBlocks: schedule.actualBlocks.map((b) =>
          b.id === id ? { ...b, startTime: newStartSlot, endTime: newEnd } : b,
        ),
      }
      saveSchedule(updated)
      setSchedule(updated)
    },
    [schedule],
  )

  return {
    schedule,
    addIdealBlock,
    updateIdealBlock,
    deleteIdealBlock,
    moveIdealBlock,
    addActualBlock,
    updateActualBlock,
    deleteActualBlock,
    moveActualBlock,
  }
}
