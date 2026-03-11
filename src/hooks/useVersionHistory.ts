import { useState, useEffect, useCallback } from 'react'
import type { IdealSnapshot } from '@/types'
import { getSnapshots } from '@/lib/storage'

export function useVersionHistory(date: string) {
  const [snapshots, setSnapshots] = useState<IdealSnapshot[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setSnapshots(getSnapshots(date))
    setSelectedId(null)
  }, [date])

  const refresh = useCallback(() => {
    setSnapshots(getSnapshots(date))
  }, [date])

  const selectedSnapshot = snapshots.find((s) => s.id === selectedId) ?? null

  return {
    snapshots,
    selectedId,
    selectedSnapshot,
    setSelectedId,
    refresh,
  }
}
