import { useState } from 'react'
import type { TimeBlock } from '@/types'
import { slotToTime, timeToSlot, DEFAULT_COLORS } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  open: boolean
  onClose: () => void
  block?: TimeBlock | null
  defaultStartSlot?: number
  onSave: (data: Omit<TimeBlock, 'id'>) => void
  onUpdate?: (id: string, data: Partial<TimeBlock>) => void
  onDelete?: (id: string) => void
}

export function BlockEditor({
  open,
  onClose,
  block,
  defaultStartSlot = 0,
  onSave,
  onUpdate,
  onDelete,
}: Props) {
  const isEdit = !!block
  const [title, setTitle] = useState(block?.title ?? '')
  const [startTime, setStartTime] = useState(slotToTime(block?.startTime ?? defaultStartSlot))
  const [endTime, setEndTime] = useState(
    slotToTime(block?.endTime ?? Math.min(defaultStartSlot + 4, 96)),
  )
  const [color, setColor] = useState(block?.color ?? DEFAULT_COLORS[0])

  const handleSave = () => {
    const start = timeToSlot(startTime)
    const end = timeToSlot(endTime)
    if (!title.trim() || start >= end) return

    if (isEdit && onUpdate && block) {
      onUpdate(block.id, { title: title.trim(), startTime: start, endTime: end, color })
    } else {
      onSave({ title: title.trim(), startTime: start, endTime: end, color })
    }
    onClose()
  }

  const handleDelete = () => {
    if (isEdit && onDelete && block) {
      onDelete(block.id)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ブロック編集' : 'ブロック追加'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'スケジュールブロックを編集します' : '新しいスケジュールブロックを追加します'}
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
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">終了</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">カラー</label>
            <div className="flex gap-2 mt-1">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-7 h-7 rounded-full border-2 ${
                    color === c ? 'border-slate-800 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
