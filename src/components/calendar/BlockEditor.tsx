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
import { MonthCalendar } from './MonthCalendar'
import { Copy, X, Trash2 } from 'lucide-react'

type SaveData = Omit<TimeBlock, 'id'> & { endDate?: string }

type Props = {
  open: boolean
  onClose: () => void
  block?: TimeBlock | null
  defaultStartSlot?: number
  date: string
  side: 'ideal' | 'actual'
  onSave: (data: SaveData) => void
  onUpdate?: (id: string, data: Partial<TimeBlock> & { endDate?: string }) => void
  onDelete?: (id: string) => void
  onCopyToActual?: (block: TimeBlock) => void
}

const DAY_NAMES_JP = ['日', '月', '火', '水', '木', '金', '土']

function formatDateLabel(dateStr: string): string {
  const d = parseDate(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日 (${DAY_NAMES_JP[d.getDay()]})`
}

function formatTimeLabel(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

type PickerState = null | 'startDate' | 'startTime' | 'endDate' | 'endTime'

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
  const [activePicker, setActivePicker] = useState<PickerState>(null)

  useEffect(() => {
    if (open) {
      if (block) {
        setTitle(block.title)
        const blockStartDate = block.startDate || date
        const blockEndDate = block.endDate || date
        setStartDate(blockStartDate)
        setEndDate(blockEndDate)
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
      setActivePicker(null)
    }
  }, [open, block, defaultStartSlot, date])

  const color = side === 'ideal' ? IDEAL_COLOR : ACTUAL_COLOR

  const startTimeStr = formatTimeLabel(startHours, startMinutes)
  const endTimeStr = formatTimeLabel(endHours, endMinutes)

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
      onUpdate(block.id, {
        title: finalTitle,
        startTime: start,
        endTime: end,
        color,
        startDate,
        endDate: isMultiDay ? endDate : undefined,
      })
    } else {
      onSave({
        title: finalTitle,
        startTime: start,
        endTime: end,
        color,
        ...(isMultiDay ? { endDate } : {}),
      })
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

  const togglePicker = (picker: PickerState) => {
    setActivePicker(activePicker === picker ? null : picker)
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
          {/* Title */}
          <div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タイトルを入力"
              className="h-14 text-lg"
              autoFocus
            />
          </div>

          {/* Start: date + time */}
          <div>
            <div className="text-xs text-slate-400 mb-1 ml-1">開始</div>
            <div className="flex gap-2">
              <button
                className={`flex-1 text-left px-4 border rounded-lg transition-colors ${
                  activePicker === 'startDate' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
                style={{ paddingTop: '0.85rem', paddingBottom: '0.85rem' }}
                onClick={() => togglePicker('startDate')}
              >
                <span className="font-medium text-base">{formatDateLabel(startDate)}</span>
              </button>
              <button
                className={`px-4 border rounded-lg transition-colors min-w-[90px] text-center ${
                  activePicker === 'startTime' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
                style={{ paddingTop: '0.85rem', paddingBottom: '0.85rem' }}
                onClick={() => togglePicker('startTime')}
              >
                <span className="font-medium text-base">{startTimeStr}</span>
              </button>
            </div>
            {activePicker === 'startDate' && (
              <div className="mt-2 border border-slate-200 rounded-lg p-3">
                <MonthCalendar
                  selectedDate={startDate}
                  onSelect={(d) => {
                    setStartDate(d)
                    if (d > endDate) setEndDate(d)
                    setActivePicker(null)
                  }}
                />
              </div>
            )}
            {activePicker === 'startTime' && (
              <div className="mt-2">
                <TimeDrumPicker
                  hours={startHours}
                  minutes={startMinutes}
                  onChange={(h, m) => { setStartHours(h); setStartMinutes(m) }}
                />
              </div>
            )}
          </div>

          {/* End: date + time */}
          <div>
            <div className="text-xs text-slate-400 mb-1 ml-1">終了</div>
            <div className="flex gap-2">
              <button
                className={`flex-1 text-left px-4 border rounded-lg transition-colors ${
                  activePicker === 'endDate' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
                style={{ paddingTop: '0.85rem', paddingBottom: '0.85rem' }}
                onClick={() => togglePicker('endDate')}
              >
                <span className="font-medium text-base">{formatDateLabel(endDate)}</span>
              </button>
              <button
                className={`px-4 border rounded-lg transition-colors min-w-[90px] text-center ${
                  activePicker === 'endTime' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
                style={{ paddingTop: '0.85rem', paddingBottom: '0.85rem' }}
                onClick={() => togglePicker('endTime')}
              >
                <span className="font-medium text-base">{endTimeStr}</span>
              </button>
            </div>
            {activePicker === 'endDate' && (
              <div className="mt-2 border border-slate-200 rounded-lg p-3">
                <MonthCalendar
                  selectedDate={endDate}
                  minDate={startDate}
                  onSelect={(d) => {
                    setEndDate(d)
                    setActivePicker(null)
                  }}
                />
              </div>
            )}
            {activePicker === 'endTime' && (
              <div className="mt-2">
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
