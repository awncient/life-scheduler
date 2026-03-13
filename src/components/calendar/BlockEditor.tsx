import { useState, useEffect } from 'react'
import type { TimeBlock } from '@/types'
import { slotToTime, timeToSlot, SLOTS_PER_HOUR, SLOT_COUNT, IDEAL_COLOR, ACTUAL_COLOR, parseDate } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TimeDrumPicker } from './TimeDrumPicker'
import { Copy, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

type SaveData = Omit<TimeBlock, 'id'> & { endDate?: string }

type Props = {
  open: boolean
  onClose: () => void
  block?: TimeBlock | null
  defaultStartSlot?: number
  date: string
  side: 'ideal' | 'actual'
  onSave: (data: SaveData) => void
  onUpdate?: (id: string, data: Partial<TimeBlock>) => void
  onDelete?: (id: string) => void
  onCopyToActual?: (block: TimeBlock) => void
}

const DAY_NAMES_JP = ['日', '月', '火', '水', '木', '金', '土']

function formatDateLabel(dateStr: string): string {
  const d = parseDate(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日（${DAY_NAMES_JP[d.getDay()]}）`
}

export function BlockEditor({
  open,
  onClose,
  block,
  defaultStartSlot = 0,
  date,
  side,
  onSave,
  onUpdate,
  onDelete,
  onCopyToActual,
}: Props) {
  const isEdit = !!block
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(date)
  const [endDate, setEndDate] = useState(date)
  const [startHours, setStartHours] = useState(0)
  const [startMinutes, setStartMinutes] = useState(0)
  const [endHours, setEndHours] = useState(1)
  const [endMinutes, setEndMinutes] = useState(0)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  useEffect(() => {
    if (open) {
      if (block) {
        setTitle(block.title)
        setStartDate(date)
        setEndDate(date)
        const st = slotToTime(block.startTime)
        const et = slotToTime(block.endTime)
        const [sh, sm] = st.split(':').map(Number)
        const [eh, em] = et.split(':').map(Number)
        setStartHours(sh)
        setStartMinutes(sm)
        setEndHours(eh)
        setEndMinutes(em)
      } else {
        setTitle('')
        setStartDate(date)
        setEndDate(date)
        const st = slotToTime(defaultStartSlot)
        const et = slotToTime(Math.min(defaultStartSlot + SLOTS_PER_HOUR, SLOT_COUNT))
        const [sh, sm] = st.split(':').map(Number)
        const [eh, em] = et.split(':').map(Number)
        setStartHours(sh)
        setStartMinutes(sm)
        setEndHours(eh)
        setEndMinutes(em)
      }
      setShowStartPicker(false)
      setShowEndPicker(false)
    }
  }, [open, block, defaultStartSlot, date])

  const color = side === 'ideal' ? IDEAL_COLOR : ACTUAL_COLOR

  const startTimeStr = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`
  const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`

  const isMultiDay = startDate !== endDate
  const isValidRange = isMultiDay
    ? startDate < endDate || (startDate === endDate && timeToSlot(startTimeStr) < timeToSlot(endTimeStr))
    : timeToSlot(startTimeStr) < timeToSlot(endTimeStr)

  const handleSave = () => {
    if (!isValidRange) return
    const finalTitle = title.trim() || '（タイトルなし）'
    const start = timeToSlot(startTimeStr)
    const end = timeToSlot(endTimeStr)

    if (isEdit && onUpdate && block) {
      // Editing existing block: single-day only (keep simple)
      onUpdate(block.id, { title: finalTitle, startTime: start, endTime: end, color })
    } else if (isMultiDay) {
      // Multi-day: pass endDate to parent for splitting
      onSave({ title: finalTitle, startTime: start, endTime: end, color, endDate })
    } else {
      onSave({ title: finalTitle, startTime: start, endTime: end, color })
    }
    onClose()
  }

  const handleDelete = () => {
    if (isEdit && onDelete && block && window.confirm('この予定を削除しますか？')) {
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
        <DialogDescription className="sr-only">
          {side === 'ideal' ? '理想（予定）' : '実際（記録）'}のブロック{isEdit ? '編集' : '追加'}
        </DialogDescription>

        {/* Top bar */}
        <div className="flex items-center justify-between -mt-1 mb-3">
          <button
            className="rounded-sm opacity-70 hover:opacity-100 p-1"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-xs font-medium text-slate-500">
            {side === 'ideal' ? '理想（予定）' : '実際（記録）'}
          </span>
          {isEdit ? (
            <button
              className="rounded-sm opacity-70 hover:opacity-100 text-red-500 p-1"
              onClick={handleDelete}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-7" />
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タイトルを入力"
              autoFocus
            />
          </div>

          {/* Start date + time */}
          <div>
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              onClick={() => { setShowStartPicker(!showStartPicker); setShowEndPicker(false) }}
            >
              <span className="text-slate-500 text-sm">開始</span>
              <span className="font-medium text-sm">
                {formatDateLabel(startDate)}&ensp;{startTimeStr}
              </span>
              {showStartPicker ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {showStartPicker && (
              <div className="mt-2 space-y-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    if (e.target.value > endDate) setEndDate(e.target.value)
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <TimeDrumPicker
                  hours={startHours}
                  minutes={startMinutes}
                  onChange={(h, m) => { setStartHours(h); setStartMinutes(m) }}
                />
              </div>
            )}
          </div>

          {/* End date + time */}
          <div>
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              onClick={() => { setShowEndPicker(!showEndPicker); setShowStartPicker(false) }}
            >
              <span className="text-slate-500 text-sm">終了</span>
              <span className="font-medium text-sm">
                {formatDateLabel(endDate)}&ensp;{endTimeStr}
              </span>
              {showEndPicker ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {showEndPicker && (
              <div className="mt-2 space-y-2">
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <TimeDrumPicker
                  hours={endHours}
                  minutes={endMinutes}
                  onChange={(h, m) => { setEndHours(h); setEndMinutes(m) }}
                />
              </div>
            )}
          </div>

          {!isValidRange && (
            <p className="text-xs text-red-500">終了日時は開始日時より後に設定してください</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="flex-1" disabled={!isValidRange}>
              {isEdit ? '更新' : '追加'}
            </Button>
          </div>

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
