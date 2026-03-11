import type { DaySchedule, IdealSnapshot, YearlyGoal, MonthlyTodo, AppSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

const PREFIX = 'daylog'

function key(...parts: string[]): string {
  return `${PREFIX}:${parts.join(':')}`
}

function getJSON<T>(k: string): T | null {
  const raw = localStorage.getItem(k)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function setJSON<T>(k: string, value: T): void {
  localStorage.setItem(k, JSON.stringify(value))
}

// ===== Schedule =====

export function getSchedule(date: string): DaySchedule {
  return getJSON<DaySchedule>(key('schedule', date)) ?? {
    date,
    idealBlocks: [],
    actualBlocks: [],
  }
}

export function saveSchedule(schedule: DaySchedule): void {
  setJSON(key('schedule', schedule.date), schedule)
}

// ===== Snapshots =====

export function getSnapshots(date: string): IdealSnapshot[] {
  return getJSON<IdealSnapshot[]>(key('snapshots', date)) ?? []
}

export function saveSnapshots(date: string, snapshots: IdealSnapshot[]): void {
  setJSON(key('snapshots', date), snapshots)
}

// ===== Yearly Goals =====

export function getYearlyGoal(year: number): YearlyGoal {
  return getJSON<YearlyGoal>(key('yearly-goal', String(year))) ?? {
    year,
    content: '',
  }
}

export function saveYearlyGoal(goal: YearlyGoal): void {
  setJSON(key('yearly-goal', String(goal.year)), goal)
}

// ===== Monthly Todos =====

export function getMonthlyTodo(year: number, month: number): MonthlyTodo {
  return getJSON<MonthlyTodo>(key('monthly-todo', `${year}-${month}`)) ?? {
    year,
    month,
    content: '',
  }
}

export function saveMonthlyTodo(todo: MonthlyTodo): void {
  setJSON(key('monthly-todo', `${todo.year}-${todo.month}`), todo)
}

// ===== Settings =====

export function getSettings(): AppSettings {
  return getJSON<AppSettings>(key('settings')) ?? { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: AppSettings): void {
  setJSON(key('settings'), settings)
}

// ===== 全スケジュール取得（検索・エクスポート用） =====

export function getAllSchedules(): DaySchedule[] {
  const schedules: DaySchedule[] = []
  const schedulePrefix = key('schedule') + ':'
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(schedulePrefix)) {
      const s = getJSON<DaySchedule>(k)
      if (s) schedules.push(s)
    }
  }
  return schedules.sort((a, b) => a.date.localeCompare(b.date))
}

export function getAllSnapshots(): IdealSnapshot[] {
  const all: IdealSnapshot[] = []
  const snapshotPrefix = key('snapshots') + ':'
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(snapshotPrefix)) {
      const arr = getJSON<IdealSnapshot[]>(k)
      if (arr) all.push(...arr)
    }
  }
  return all
}

export function getAllYearlyGoals(): YearlyGoal[] {
  const goals: YearlyGoal[] = []
  const goalPrefix = key('yearly-goal') + ':'
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(goalPrefix)) {
      const g = getJSON<YearlyGoal>(k)
      if (g) goals.push(g)
    }
  }
  return goals
}

export function getAllMonthlyTodos(): MonthlyTodo[] {
  const todos: MonthlyTodo[] = []
  const todoPrefix = key('monthly-todo') + ':'
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(todoPrefix)) {
      const t = getJSON<MonthlyTodo>(k)
      if (t) todos.push(t)
    }
  }
  return todos
}
