import { useState, useEffect, useRef } from 'react'
import type { IdealSnapshot } from '@/types'
import { SLOT_COUNT, SLOTS_PER_HOUR } from '@/types'
import { getSnapshots, saveSnapshots, getSchedule } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trash2 } from 'lucide-react'

type Props = {
  date: string
  onBack: () => void
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function VersionHistoryView({ date, onBack }: Props) {
  const [snapshots, setSnapshots] = useState<IdealSnapshot[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const slotHeight = 8 // compact for overview

  useEffect(() => {
    setSnapshots(getSnapshots(date))
  }, [date])

  // Scroll to right (latest) on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [snapshots])

  const currentBlocks = getSchedule(date).idealBlocks

  // All columns: snapshots + current
  const columns = [
    ...snapshots.map((s) => ({
      id: s.id,
      label: formatSavedAt(s.savedAt),
      blocks: s.blocks,
      isDeletable: true,
    })),
    {
      id: '__current__',
      label: '最新',
      blocks: currentBlocks,
      isDeletable: false,
    },
  ]

  const handleDelete = (snapshotId: string) => {
    if (!window.confirm('この履歴を削除しますか？')) return
    const updated = snapshots.filter((s) => s.id !== snapshotId)
    saveSnapshots(date, updated)
    setSnapshots(updated)
  }

  const totalHeight = SLOT_COUNT * slotHeight

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium">理想の履歴 — {date}</div>
      </div>

      {columns.length <= 1 && snapshots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          履歴がありません
        </div>
      ) : (
        /* Scrollable area */
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          {/* Column headers */}
          <div className="flex sticky top-0 z-10 bg-white border-b border-slate-200">
            <div className="w-8 flex-shrink-0" />
            {columns.map((col) => (
              <div
                key={col.id}
                className={`flex-shrink-0 w-28 text-center text-[10px] py-1.5 border-r border-slate-200 ${
                  col.id === '__current__' ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'
                }`}
              >
                <div>{col.label}</div>
                {col.isDeletable && (
                  <button
                    className="mt-0.5 text-red-400 hover:text-red-600"
                    onClick={() => handleDelete(col.id)}
                  >
                    <Trash2 className="h-3 w-3 inline" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex" style={{ height: `${totalHeight}px` }}>
            {/* Time labels */}
            <div className="relative flex-shrink-0 w-8 text-[9px] text-slate-400">
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="absolute right-0.5 -translate-y-1/2"
                  style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
                >
                  {h.toString().padStart(2, '0')}
                </div>
              ))}
            </div>

            {/* Snapshot columns */}
            {columns.map((col) => (
              <div
                key={col.id}
                className={`flex-shrink-0 w-28 border-r border-slate-200 relative ${
                  col.id === '__current__' ? 'bg-slate-50' : ''
                }`}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-100"
                    style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
                  />
                ))}
                {col.blocks.map((block) => {
                  const top = block.startTime * slotHeight
                  const height = (block.endTime - block.startTime) * slotHeight
                  return (
                    <div
                      key={block.id}
                      className="absolute left-0.5 right-0.5 rounded px-1 text-white text-[8px] overflow-hidden"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: block.color,
                        minHeight: '4px',
                      }}
                    >
                      <div className="truncate leading-tight">{block.title}</div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
