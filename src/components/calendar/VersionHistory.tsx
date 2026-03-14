import { useState, useEffect, useRef } from 'react'
import type { IdealSnapshot, TimeBlock } from '@/types'
import { SLOT_COUNT, SLOTS_PER_HOUR, DEFAULT_SETTINGS, slotToTime, getTodayInTimezone, getNowInTimezone } from '@/types'
import { getSnapshots, saveSnapshots, getSchedule, getSettings } from '@/lib/storage'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trash2 } from 'lucide-react'

type Props = {
  date: string
  onBack: () => void
}

function loadZoomLevel(): number {
  const stored = getSettings().zoomLevel
  if (stored < 2 || stored > 12) return DEFAULT_SETTINGS.zoomLevel
  return stored
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function blocksEqual(a: TimeBlock[], b: TimeBlock[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].startTime !== b[i].startTime || a[i].endTime !== b[i].endTime || a[i].title !== b[i].title) return false
  }
  return true
}

export function VersionHistoryView({ date, onBack }: Props) {
  const [snapshots, setSnapshots] = useState<IdealSnapshot[]>([])
  const [zoomLevel, setZoomLevel] = useState(loadZoomLevel)
  const { containerRef: pinchRef, persistZoom } = usePinchZoom(zoomLevel, setZoomLevel)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Share the ref between pinch zoom and scroll container
  const setRefs = (el: HTMLDivElement | null) => {
    (pinchRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    ;(scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
  }

  const slotHeight = zoomLevel
  const settings = getSettings()
  const todayStr = getTodayInTimezone(settings.timezoneOffset)
  const isToday = date === todayStr

  useEffect(() => {
    persistZoom(zoomLevel)
  }, [zoomLevel, persistZoom])

  useEffect(() => {
    setSnapshots(getSnapshots(date))
  }, [date])

  // Scroll to right (latest) on mount + 今日なら現在時刻が画面上から1/3の位置に
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth

    if (isToday) {
      const now = getNowInTimezone(settings.timezoneOffset)
      const currentSlot = now.hours * SLOTS_PER_HOUR + now.minutes / 5
      const currentPos = currentSlot * slotHeight
      const viewHeight = el.clientHeight
      el.scrollTop = Math.max(0, currentPos - viewHeight / 3)
    }
  }, [snapshots, isToday, slotHeight])

  const currentBlocks = getSchedule(date).idealBlocks

  // Deduplicate: if last snapshot matches current blocks, don't show "最新" separately
  const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const showCurrent = !lastSnapshot || !blocksEqual(lastSnapshot.blocks, currentBlocks)

  const columns = [
    ...snapshots.map((s) => ({
      id: s.id,
      label: formatSavedAt(s.savedAt),
      blocks: s.blocks,
      isDeletable: true,
    })),
    ...(showCurrent ? [{
      id: '__current__',
      label: '最新',
      blocks: currentBlocks,
      isDeletable: false,
    }] : []),
  ]

  // Mark the last column as "latest" for highlighting
  if (columns.length > 0) {
    const last = columns[columns.length - 1]
    if (!showCurrent && last.id !== '__current__') {
      // The last snapshot IS the current — mark it as latest
      columns[columns.length - 1] = { ...last, label: `${last.label}（最新）`, isDeletable: false }
    }
  }

  const handleDelete = (snapshotId: string) => {
    if (!window.confirm('この履歴を削除しますか？')) return
    const updated = snapshots.filter((s) => s.id !== snapshotId)
    saveSnapshots(date, updated)
    setSnapshots(updated)
  }

  const totalHeight = SLOT_COUNT * slotHeight + slotHeight * SLOTS_PER_HOUR

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium">理想の履歴 — {date}</div>
      </div>

      {columns.length === 0 || (columns.length <= 1 && snapshots.length === 0 && !showCurrent) ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          履歴がありません
        </div>
      ) : (
        /* Scrollable area — uses two layers: sticky time labels + scrollable columns */
        <div className="flex-1 flex overflow-hidden">
          {/* Sticky time labels column */}
          <div className="flex-shrink-0 w-10 flex flex-col">
            {/* Header spacer */}
            <div className="h-[30px] border-b border-slate-200 bg-white" />
            {/* Time labels that scroll vertically with main content */}
            <div className="flex-1 overflow-hidden" id="time-labels-scroll">
              <div className="relative" style={{ height: `${totalHeight}px` }}>
                {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                  <div
                    key={h}
                    className="absolute right-1 -translate-y-1/2 text-[10px] text-slate-400"
                    style={{ top: `${h * SLOTS_PER_HOUR * slotHeight}px` }}
                  >
                    {slotToTime(h * SLOTS_PER_HOUR)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable columns area */}
          <div
            ref={setRefs}
            className="flex-1 overflow-auto"
            onScroll={(e) => {
              // Sync vertical scroll with time labels
              const labelsEl = document.getElementById('time-labels-scroll')
              if (labelsEl) {
                labelsEl.scrollTop = e.currentTarget.scrollTop
              }
            }}
          >
            {/* Column headers — explicit bg on every column to prevent transparency */}
            <div className="flex sticky top-0 z-10 border-b border-slate-200">
              {columns.map((col, idx) => {
                const isLast = idx === columns.length - 1
                return (
                  <div
                    key={col.id}
                    className={`flex-shrink-0 w-28 text-center text-[10px] py-1.5 border-r border-slate-200 ${
                      isLast ? 'bg-slate-800 text-white font-bold' : 'bg-white text-slate-600'
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
                )
              })}
            </div>

            {/* Grid */}
            <div className="flex relative" style={{ height: `${totalHeight}px` }}>
              {columns.map((col, idx) => {
                const isLast = idx === columns.length - 1
                return (
                  <div
                    key={col.id}
                    className={`flex-shrink-0 w-28 border-r border-slate-200 relative ${
                      isLast ? 'bg-slate-50' : ''
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
                      const height = Math.max(4, (block.endTime - block.startTime) * slotHeight - 1)
                      return (
                        <div
                          key={block.id}
                          className="absolute left-0.5 right-0.5 rounded px-1 text-white text-xs overflow-hidden"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            backgroundColor: block.color,
                            minHeight: '4px',
                          }}
                        >
                          <div className="leading-tight break-words">{block.title || '（タイトルなし）'}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {isToday && <CurrentTimeIndicator slotHeight={slotHeight} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
