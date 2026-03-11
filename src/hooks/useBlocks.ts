import { useState, useCallback, useEffect } from 'react'
import type { TimeBlock, DaySchedule } from '@/types'
import { generateId } from '@/types'
import { getSchedule, saveSchedule, getSnapshots, saveSnapshots } from '@/lib/storage'

export function useBlocks(date: string) {
  const [schedule, setSchedule] = useState<DaySchedule>(() => getSchedule(date))

  useEffect(() => {
    setSchedule(getSchedule(date))
  }, [date])

  const saveAndSnapshot = useCallback(
    (updated: DaySchedule, snapshotIdeal: boolean) => {
      saveSchedule(updated)
      setSchedule(updated)

      if (snapshotIdeal) {
        const snaps = getSnapshots(date)
        snaps.push({
          id: generateId(),
          date,
          savedAt: new Date().toISOString(),
          blocks: structuredClone(updated.idealBlocks),
        })
        saveSnapshots(date, snaps)
      }
    },
    [date],
  )

  // Ideal blocks
  const addIdealBlock = useCallback(
    (block: Omit<TimeBlock, 'id'>) => {
      const updated = {
        ...schedule,
        idealBlocks: [...schedule.idealBlocks, { ...block, id: generateId() }],
      }
      saveAndSnapshot(updated, true)
    },
    [schedule, saveAndSnapshot],
  )

  const updateIdealBlock = useCallback(
    (id: string, updates: Partial<TimeBlock>) => {
      const updated = {
        ...schedule,
        idealBlocks: schedule.idealBlocks.map((b) =>
          b.id === id ? { ...b, ...updates } : b,
        ),
      }
      saveAndSnapshot(updated, true)
    },
    [schedule, saveAndSnapshot],
  )

  const deleteIdealBlock = useCallback(
    (id: string) => {
      const updated = {
        ...schedule,
        idealBlocks: schedule.idealBlocks.filter((b) => b.id !== id),
      }
      saveAndSnapshot(updated, true)
    },
    [schedule, saveAndSnapshot],
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

  return {
    schedule,
    addIdealBlock,
    updateIdealBlock,
    deleteIdealBlock,
    addActualBlock,
    updateActualBlock,
    deleteActualBlock,
  }
}
