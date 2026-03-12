import { useState, useRef } from 'react'
import { parseDate, formatDate } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { SearchModal } from '@/components/calendar/SearchModal'
import { downloadJSON, readJSONFile, importData } from '@/lib/export-import'
import {
  ListChecks,
  Calendar,
  Search,
  MoreVertical,
  Download,
  Upload,
} from 'lucide-react'

type AppMode = 'calendar' | 'todo'
type CalendarView = 'day' | 'three' | 'week'

type Props = {
  mode: AppMode
  setMode: (mode: AppMode) => void
  calendarView: CalendarView | string
  setCalendarView: (view: CalendarView) => void
  currentDate: string
  setCurrentDate: (date: string) => void
}

const DAY_NAMES_JP = ['日', '月', '火', '水', '木', '金', '土']

export function Header({
  mode,
  setMode,
  calendarView,
  setCalendarView,
  currentDate,
  setCurrentDate,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const goToToday = () => {
    setCurrentDate(formatDate(new Date()))
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await readJSONFile(file)
      if (window.confirm('インポートすると既存データに上書きされます。続行しますか？')) {
        importData(data)
        window.location.reload()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'インポートに失敗しました')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const dateLabel = (() => {
    const d = parseDate(currentDate)
    if (calendarView === 'day') {
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${DAY_NAMES_JP[d.getDay()]}）`
    }
    if (calendarView === 'three') {
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
    }
    return `${d.getFullYear()}/${d.getMonth() + 1}月`
  })()

  const viewButtons: { key: CalendarView; label: string }[] = [
    { key: 'day', label: '1日' },
    { key: 'three', label: '3日' },
    { key: 'week', label: '週' },
  ]

  return (
    <>
      <header className="flex items-center justify-between px-2 py-2 bg-slate-800 text-white safe-area-top">
        {/* Left: view toggle */}
        <div className="flex items-center gap-1">
          {mode === 'calendar' && (
            <div className="flex bg-slate-700 rounded-md p-0.5">
              {viewButtons.map(({ key, label }) => (
                <button
                  key={key}
                  className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                    calendarView === key
                      ? 'bg-white text-slate-800'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  onClick={() => setCalendarView(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: date display (tap to go to today) */}
        {mode === 'calendar' && (
          <button
            className="text-sm font-medium min-w-[100px] text-center"
            onClick={goToToday}
          >
            {dateLabel}
          </button>
        )}

        {mode === 'todo' && (
          <div className="text-sm font-medium">TODO</div>
        )}

        {/* Right: search, mode toggle, menu */}
        <div className="flex items-center gap-1">
          {mode === 'calendar' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-slate-700" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-slate-700"
            onClick={() => setMode(mode === 'calendar' ? 'todo' : 'calendar')}
          >
            {mode === 'calendar' ? (
              <ListChecks className="h-4 w-4" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-slate-700" onClick={() => setMenuOpen(true)}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Menu bottom sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>メニュー</SheetTitle>
            <SheetDescription>データの管理</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                downloadJSON()
                setMenuOpen(false)
              }}
            >
              <Download className="h-4 w-4" />
              JSONエクスポート
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              JSONインポート
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </SheetContent>
      </Sheet>

      {/* Search modal */}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectDate={(date) => {
          setCurrentDate(date)
          setCalendarView('day')
          setSearchOpen(false)
        }}
      />
    </>
  )
}
