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
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Calendar,
  Search,
  MoreVertical,
  Download,
  Upload,
} from 'lucide-react'

type AppMode = 'calendar' | 'todo'
type CalendarView = 'day' | 'three' | 'week'

const VIEW_CYCLE: CalendarView[] = ['day', 'three', 'week']
const VIEW_LABELS: Record<CalendarView, string> = {
  day: '1日',
  three: '3日',
  week: '1週間',
}

type Props = {
  mode: AppMode
  setMode: (mode: AppMode) => void
  calendarView: CalendarView | string
  setCalendarView: (view: CalendarView) => void
  currentDate: string
  setCurrentDate: (date: string) => void
}

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

  const navigateDate = (delta: number) => {
    const d = parseDate(currentDate)
    if (calendarView === 'day') {
      d.setDate(d.getDate() + delta)
    } else if (calendarView === 'three') {
      d.setDate(d.getDate() + delta * 3)
    } else {
      d.setDate(d.getDate() + delta * 7)
    }
    setCurrentDate(formatDate(d))
  }

  const cycleView = () => {
    const currentIdx = VIEW_CYCLE.indexOf(calendarView as CalendarView)
    const nextIdx = (currentIdx + 1) % VIEW_CYCLE.length
    setCalendarView(VIEW_CYCLE[nextIdx])
  }

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
    if (calendarView === 'day' || calendarView === 'three') {
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
    }
    return `${d.getFullYear()}/${d.getMonth() + 1}月`
  })()

  return (
    <>
      <header className="flex items-center justify-between px-2 py-2 bg-slate-800 text-white safe-area-top">
        {/* Left: view toggle */}
        <div className="flex items-center gap-1">
          {mode === 'calendar' && (
            <button
              className="px-4 py-1.5 text-sm rounded-md font-medium bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-500 transition-colors min-w-[72px]"
              onClick={cycleView}
            >
              {VIEW_LABELS[(calendarView as CalendarView)] ?? '1日'}
            </button>
          )}
        </div>

        {/* Center: date navigation */}
        {mode === 'calendar' && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-slate-700" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              className="text-sm font-medium min-w-[100px] text-center"
              onClick={goToToday}
            >
              {dateLabel}
            </button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-slate-700" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
