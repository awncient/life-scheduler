import { useState, useMemo } from 'react'
import { slotToTime } from '@/types'
import { getAllSchedules } from '@/lib/storage'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

type SearchResult = {
  date: string
  title: string
  startTime: string
  side: 'ideal' | 'actual'
}

type Props = {
  open: boolean
  onClose: () => void
  onSelectDate: (date: string, scrollToSlot?: number) => void
}

export function SearchModal({ open, onClose, onSelectDate }: Props) {
  const [query, setQuery] = useState('')

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const schedules = getAllSchedules()
    const matches: SearchResult[] = []

    for (const s of schedules) {
      for (const block of s.idealBlocks) {
        if (block.title.toLowerCase().includes(q)) {
          matches.push({
            date: s.date,
            title: block.title,
            startTime: slotToTime(block.startTime),
            side: 'ideal',
          })
        }
      }
      for (const block of s.actualBlocks) {
        if (block.title.toLowerCase().includes(q)) {
          matches.push({
            date: s.date,
            title: block.title,
            startTime: slotToTime(block.startTime),
            side: 'actual',
          })
        }
      }
    }

    return matches.sort((a, b) => b.date.localeCompare(a.date))
  }, [query])

  const handleSelect = (r: SearchResult) => {
    const slot = Math.floor(parseInt(r.startTime.split(':')[0]) * 12 + parseInt(r.startTime.split(':')[1]) / 5)
    onSelectDate(r.date, slot)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ブロック検索</DialogTitle>
          <DialogDescription>スケジュールブロックをタイトルで検索します</DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="検索..."
          autoFocus
          className="mt-2"
        />

        <ScrollArea className="max-h-[50vh] mt-3">
          {results.length === 0 && query.trim() && (
            <div className="text-sm text-slate-400 text-center py-4">
              見つかりませんでした
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.date}-${r.title}-${r.startTime}-${i}`}
              className="flex items-center justify-between py-2.5 px-2 border-b border-slate-100 cursor-pointer active:bg-slate-50 rounded"
              onClick={() => handleSelect(r)}
            >
              <div>
                <div className="text-sm font-medium">{r.title || '（タイトルなし）'}</div>
                <div className="text-xs text-slate-400">
                  {r.date} {r.startTime} ({r.side === 'ideal' ? '理想' : '実際'})
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
