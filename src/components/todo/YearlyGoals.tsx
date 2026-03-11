import { useState, useEffect, useCallback } from 'react'
import { getYearlyGoal, saveYearlyGoal } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function YearlyGoals() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [content, setContent] = useState('')

  useEffect(() => {
    const goal = getYearlyGoal(year)
    setContent(goal.content)
  }, [year])

  const handleSave = useCallback(() => {
    saveYearlyGoal({ year, content })
  }, [year, content])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">年間目標</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear(year - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[50px] text-center">{year}年</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear(year + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <textarea
        className="w-full min-h-[120px] p-3 border border-slate-300 rounded-md text-sm resize-y focus:outline-none focus:ring-1 focus:ring-slate-400"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleSave}
        placeholder="今年やりたいことを自由に記述..."
      />
    </div>
  )
}
