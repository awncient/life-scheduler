import { useState, useEffect } from 'react'
import type { TimeBlock } from '@/types'
import { slotToTime, timeToSlot, roundTo5Min, SLOTS_PER_HOUR, SLOT_COUNT, IDEAL_COLOR, ACTUAL_COLOR } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  block?: TimeBlock | null
  defaultStartSlot?: number
  side: 'ideal' | 'actual'
  onSave: (data: Omit<TimeBlock, 'id'>) => void
  onUpdate?: (id: string, data: Partial<TimeBlock>) => void
  onDelete?: (id: string) => void
  onCopyToActual?: (block: TimeBlock) => void
}

export function BlockEditor({
  open,
  onClose,
  block,
  defaultStartSlot = 0,
  side,
  onSave,
  onUpdate,
  onDelete,
  onCopyToActual,
}: Props) {
  const isEdit = !!block
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('00:00')
  const [endTime, setEndTime] = useState('01:00')

  useEffect(() => {
    if (open) {
      if (block) {
        setTitle(block.title)
        setStartTime(slotToTime(block.startTime))
        setEndTime(slotToTime(block.endTime))
      } else {
        setTitle('')
        setStartTime(slotToTime(defaultStartSlot))
        setEndTime(slotToTime(Math.min(defaultStartSlot + SLOTS_PER_HOUR, SLOT_COUNT)))
      }
    }
  }, [open, block, defaultStartSlot])

  const handleTimeChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(roundTo5Min(e.target.value))
  }

  const color = side === 'ideal' ? IDEAL_COLOR : ACTUAL_COLOR

  const handleSave = () => {
    const start = timeToSlot(startTime)
    const end = timeToSlot(endTime)
    if (start >= end) return
    const finalTitle = title.trim() || '（タイトルなし）'

    if (isEdit && onUpdate && block) {
      onUpdate(block.id, { title: finalTitle, startTime: start, endTime: end, color })
    } else {
      onSave({ title: finalTitle, startTime: start, endTime: end, color })
    }
    onClose()
  }

  const handleDelete = () => {
    if (isEdit && onDelete && block) {
      onDelete(block.id)
      onClose()
    }
  }

  const handleCopyToActual = () => {
    if (block && onCopyToActual) {
      onCopyToActual(block)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ブロック編集' : 'ブロック追加'}</DialogTitle>
          <DialogDescription>
            {side === 'ideal' ? '理想（予定）' : '実際（記録）'}のブロック
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-slate-700">タイトル</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 朝の勉強"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">開始</label>
              <Input
                type="time"
                value={startTime}
                step={300}
                onChange={handleTimeChange(setStartTime)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">終了</label>
              <Input
                type="time"
                value={endTime}
                step={300}
                onChange={handleTimeChange(setEndTime)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="flex-1">
              {isEdit ? '更新' : '追加'}
            </Button>
            {isEdit && (
              <Button variant="destructive" onClick={handleDelete}>
                削除
              </Button>
            )}
          </div>

          {/* Copy to actual — only for ideal blocks in edit mode */}
          {isEdit && side === 'ideal' && onCopyToActual && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleCopyToActual}
            >
              <Copy className="h-4 w-4" />
              実際欄にコピー
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
