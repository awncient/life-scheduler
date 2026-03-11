// ===== スケジュールブロック =====
export type TimeBlock = {
  id: string
  title: string
  startTime: number // 0〜95（0:00=0, 0:15=1, ..., 23:45=95）
  endTime: number   // 同上（startTime < endTime）
  color: string     // 表示色（例: "#4A90D9"）
}

// ===== 1日のスケジュール =====
export type DaySchedule = {
  date: string          // "2026-03-11" (YYYY-MM-DD)
  idealBlocks: TimeBlock[]
  actualBlocks: TimeBlock[]
}

// ===== 理想列のバージョン管理 =====
export type IdealSnapshot = {
  id: string
  date: string          // 対象日 "2026-03-11"
  savedAt: string       // ISO8601 保存日時
  blocks: TimeBlock[]   // その時点のidealBlocksのコピー
}

// ===== TODO関連 =====
export type YearlyGoal = {
  year: number
  content: string
}

export type MonthlyTodo = {
  year: number
  month: number // 1〜12
  content: string
}

// ===== アプリ設定 =====
export type AppSettings = {
  zoomLevel: number // スロット高さ (px/15min) 15〜60, default: 30
}

// ===== エクスポート用ルート =====
export type AppData = {
  version: 1
  schedules: DaySchedule[]
  idealSnapshots: IdealSnapshot[]
  yearlyGoals: YearlyGoal[]
  monthlyTodos: MonthlyTodo[]
  settings: AppSettings
}

// ===== ユーティリティ =====
export const SLOT_COUNT = 96 // 24h × 4

export function slotToTime(slot: number): string {
  const h = Math.floor(slot / 4)
  const m = (slot % 4) * 15
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 4 + Math.floor(m / 15)
}

export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function generateId(): string {
  return crypto.randomUUID()
}

export const DEFAULT_COLORS = [
  '#4A90D9', '#E74C3C', '#2ECC71', '#F39C12',
  '#9B59B6', '#1ABC9C', '#E67E22', '#3498DB',
]

export const DEFAULT_SETTINGS: AppSettings = {
  zoomLevel: 30,
}
