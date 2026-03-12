import { useState, useEffect, useCallback } from 'react'
import type { IdealSnapshot } from '@/types'
import { getSnapshots, saveSnapshots } from '@/lib/storage'

export function useVersionHistory(date: string) {
  const [snapshots, setSnapshots] = useState<IdealSnapshot[]>([])

  useEffect(() => {
    setSnapshots(getSnapshots(date))
  }, [date])

  const refresh = useCallback(() => {
    setSnapshots(getSnapshots(date))
  }, [date])

  const deleteSnapshot = useCallback(
    (id: string) => {
      const updated = snapshots.filter((s) => s.id !== id)
      saveSnapshots(date, updated)
      setSnapshots(updated)
    },
    [date, snapshots],
  )

  return {
    snapshots,
    refresh,
    deleteSnapshot,
  }
}
