import { useState, useEffect, useCallback } from 'react'
import { getMonthlyTodo, saveMonthlyTodo } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function MonthlyTodos() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [content, setContent] = useState('')

  useEffect(() => {
    const todo = getMonthlyTodo(year, month)
    setContent(todo.content)
  }, [year, month])

  const handleSave = useCallback(() => {
    saveMonthlyTodo({ year, month, content })
  }, [year, month, content])

  const navigate = (delta: number) => {
    let m = month + delta
    let y = year
    if (m > 12) {
      m = 1
      y++
    } else if (m < 1) {
      m = 12
      y--
    }
    setYear(y)
    setMonth(m)
  }

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-700">月別TODO</h2>
      <div className="flex items-center justify-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-slate-400">
          {prevYear}/{prevMonth}月
        </span>
        <span className="text-sm font-medium mx-2">
          {year}/{month}月
        </span>
        <span className="text-xs text-slate-400">
          {nextYear}/{nextMonth}月
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <textarea
        className="w-full min-h-[200px] p-3 border border-slate-300 rounded-md text-sm resize-y focus:outline-none focus:ring-1 focus:ring-slate-400"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleSave}
        placeholder="今月やりたいことを自由に記述..."
      />
    </div>
  )
}
