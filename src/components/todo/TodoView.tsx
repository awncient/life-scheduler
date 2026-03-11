import { YearlyGoals } from './YearlyGoals'
import { MonthlyTodos } from './MonthlyTodos'

export function TodoView() {
  return (
    <div className="flex flex-col gap-6 p-4 overflow-auto h-full">
      <YearlyGoals />
      <div className="border-t border-slate-200" />
      <MonthlyTodos />
    </div>
  )
}
