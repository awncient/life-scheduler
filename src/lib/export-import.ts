import type { AppData } from '@/types'
import {
  getAllSchedules,
  getAllSnapshots,
  getAllYearlyGoals,
  getAllMonthlyTodos,
  getSettings,
  saveSchedule,
  saveSnapshots,
  saveYearlyGoal,
  saveMonthlyTodo,
  saveSettings,
} from './storage'

export function exportData(): AppData {
  return {
    version: 1,
    schedules: getAllSchedules(),
    idealSnapshots: getAllSnapshots(),
    yearlyGoals: getAllYearlyGoals(),
    monthlyTodos: getAllMonthlyTodos(),
    settings: getSettings(),
  }
}

export function downloadJSON(): void {
  const data = exportData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `daylog-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importData(data: AppData): void {
  for (const s of data.schedules) {
    saveSchedule(s)
  }

  // Group snapshots by date
  const snapshotsByDate = new Map<string, typeof data.idealSnapshots>()
  for (const snap of data.idealSnapshots) {
    const arr = snapshotsByDate.get(snap.date) ?? []
    arr.push(snap)
    snapshotsByDate.set(snap.date, arr)
  }
  for (const [date, snaps] of snapshotsByDate) {
    saveSnapshots(date, snaps)
  }

  for (const g of data.yearlyGoals) {
    saveYearlyGoal(g)
  }
  for (const t of data.monthlyTodos) {
    saveMonthlyTodo(t)
  }
  if (data.settings) {
    saveSettings(data.settings)
  }
}

export function readJSONFile(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as AppData
        if (data.version !== 1) {
          reject(new Error('Unsupported data version'))
          return
        }
        resolve(data)
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
