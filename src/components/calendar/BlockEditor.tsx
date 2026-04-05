import { useState, useEffect, useRef, useCallback } from 'react'
import type { TimeBlock } from '@/types'
import { slotToTime, timeToSlot, SLOTS_PER_HOUR, SLOT_COUNT, IDEAL_COLOR, ACTUAL_COLOR, parseDate } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TimeDrumPicker } from './TimeDrumPicker'
import { MonthCalendar } from './MonthCalendar'
import { Copy, Trash2, Bell } from 'lucide-react'
import {
  isNotificationReady,
  getBlockNotifyConfig,
  type NotifyConfig,
} from '@/lib/notify'

type SaveData = Omit<TimeBlock, 'id'> & { endDate?: string }

type Props = {
  open: boolean
  onClose: () => void
  block?: TimeBlock | null
  defaultStartSlot?: number
  date: string
  side: 'ideal' | 'actual'
  onSave: (data: SaveData, notifyConfig?: NotifyConfig) => void
  onUpdate?: (id: string, data: Partial<TimeBlock> & { endDate?: string }, notifyConfig?: NotifyConfig) => void
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

function AutoExpandTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(56, el.scrollHeight)}px`
  }, [])

  useEffect(() => {
    resize()
  }, [value, resize])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-lg px-3 py-3 border border-slate-200 rounded-md resize-none overflow-hidden focus:outline-none focus:border-blue-400"
      style={{ minHeight: 56 }}
      rows={1}
      autoFocus
    />
  )
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

  // 通知設定（PRO機能）
  const proReady = isNotificationReady()
  const [startNotify, setStartNotify] = useState(false)
  const [startMinBefore, setStartMinBefore] = useState(5)
  const [endNotify, setEndNotify] = useState(false)
  const [endMinBefore, setEndMinBefore] = useState(5)

  useEffect(() => {
    if (open) {
      if (block) {
        setTitle(block.title === '（タイトルなし）' ? '' : block.title)
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

        // 通知設定の読み込み
        if (proReady) {
          const cfg = getBlockNotifyConfig(block.id, blockStartDate)
          if (cfg) {
            setStartNotify(cfg.startEnabled)
            setStartMinBefore(cfg.startMinutesBefore)
            setEndNotify(cfg.endEnabled)
            setEndMinBefore(cfg.endMinutesBefore)
          } else {
            setStartNotify(false)
            setStartMinBefore(5)
            setEndNotify(false)
            setEndMinBefore(5)
          }
        }
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
        setStartNotify(false)
        setStartMinBefore(5)
        setEndNotify(false)
        setEndMinBefore(5)
      }
      setActivePicker(null)
    }
  }, [open, block, defaultStartSlot, date, proReady])

  const color = side === 'ideal' ? IDEAL_COLOR : ACTUAL_COLOR

  const startTimeStr = formatTimeLabel(startHours, startMinutes)
  const endTimeStr = formatTimeLabel(endHours, endMinutes)

  const isMultiDay = startDate !== endDate
  const isValidRange = isMultiDay
    ? startDate < endDate || (startDate === endDate && timeToSlot(startTimeStr) < timeToSlot(endTimeStr))
    : timeToSlot(startTimeStr) < timeToSlot(endTimeStr)

  const handleSave = () => {
    if (!isValidRange) return
    const finalTitle = title.trim()
    const start = timeToSlot(startTimeStr)
    const end = timeToSlot(endTimeStr)

    const notifyConfig: NotifyConfig | undefined = proReady && (startNotify || endNotify)
      ? { startEnabled: startNotify, startMinutesBefore: startMinBefore, endEnabled: endNotify, endMinutesBefore: endMinBefore }
      : undefined

    if (isEdit && onUpdate && block) {
      onUpdate(block.id, {
        title: finalTitle,
        startTime: start,
        endTime: end,
        color,
        startDate,
        endDate: isMultiDay ? endDate : undefined,
      }, notifyConfig)
    } else {
      onSave({
        title: finalTitle,
        startTime: start,
        endTime: end,
        color,
        ...(isMultiDay ? { endDate } : {}),
      }, notifyConfig)
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

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      // タイトルに入力がある場合は確認ダイアログを表示
      if (title.trim().length > 0) {
        if (!window.confirm('入力内容が破棄されます。よろしいですか？')) return
      }
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogDescription className="sr-only">
          {side === 'ideal' ? '理想（予定）' : '実際（記録）'}のブロック{isEdit ? '編集' : '追加'}
        </DialogDescription>

        {/* Top bar */}
        <div className="flex items-center justify-between mb-3" style={{ paddingTop: 3, paddingBottom: 3, marginLeft: 5, marginRight: 5 }}>
          <button
            className="text-blue-500 text-sm font-medium px-2 py-1"
            onClick={onClose}
          >
            キャンセル
          </button>
          <span className="text-xs font-medium text-slate-500">
            {side === 'ideal' ? '理想（予定）' : '実際（記録）'}
          </span>
          <div className="flex items-center gap-3">
            {isEdit && (
              <button
                className="text-red-500 p-1"
                onClick={handleDelete}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
            <button
              className={`text-sm font-semibold px-2 py-1 ${isValidRange ? 'text-blue-500' : 'text-slate-300'}`}
              onClick={handleSave}
              disabled={!isValidRange}
            >
              {isEdit ? '更新' : '保存'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Title — auto-expanding textarea */}
          <div>
            <AutoExpandTextarea
              value={title}
              onChange={setTitle}
              placeholder="タイトルを入力"
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

          {/* 通知設定（PRO） */}
          {proReady && side === 'ideal' && (
            <div style={{ marginTop: '1.5rem' }} className="border border-slate-200 rounded-lg p-3 space-y-5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Bell className="h-3.5 w-3.5" />
                通知設定
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-700">開始前に通知</label>
                <div className="flex items-center gap-2">
                  <select
                    value={startMinBefore}
                    onChange={(e) => setStartMinBefore(Number(e.target.value))}
                    disabled={!startNotify}
                    className="border border-slate-200 rounded px-2 py-1 text-sm bg-white disabled:opacity-40"
                  >
                    {[0, 1, 3, 5, 10, 15, 30].map(m => (
                      <option key={m} value={m}>{m}分前</option>
                    ))}
                  </select>
                  <button
                    className={`w-10 h-6 rounded-full transition-colors ${startNotify ? 'bg-green-500' : 'bg-slate-300'}`}
                    onClick={() => setStartNotify(!startNotify)}
                    type="button"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${startNotify ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }} className="flex items-center justify-between">
                <label className="text-sm text-slate-700">終了前に通知</label>
                <div className="flex items-center gap-2">
                  <select
                    value={endMinBefore}
                    onChange={(e) => setEndMinBefore(Number(e.target.value))}
                    disabled={!endNotify}
                    className="border border-slate-200 rounded px-2 py-1 text-sm bg-white disabled:opacity-40"
                  >
                    {[0, 1, 3, 5, 10, 15, 30].map(m => (
                      <option key={m} value={m}>{m}分前</option>
                    ))}
                  </select>
                  <button
                    className={`w-10 h-6 rounded-full transition-colors ${endNotify ? 'bg-green-500' : 'bg-slate-300'}`}
                    onClick={() => setEndNotify(!endNotify)}
                    type="button"
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${endNotify ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isValidRange && (
            <p className="text-xs text-red-500">終了日時は開始日時より後に設定してください</p>
          )}

          {isEdit && side === 'ideal' && onCopyToActual && (
            <Button
              variant="outline"
              style={{ marginTop: '1.5rem' }}
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
