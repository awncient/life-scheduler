// ===== スケジュールブロック =====
export type TimeBlock = {
  id: string
  title: string
  startTime: number // 0〜287（5分刻み: 0:00=0, 0:05=1, ..., 23:55=287）
  endTime: number   // 同上
  color: string     // 表示色（例: "#4A90D9"）
  timezoneOffset?: number // 作成時のUTCオフセット（分）
  startDate?: string // ブロックの開始日 (YYYY-MM-DD)。日跨ぎブロック用
  endDate?: string   // ブロックの終了日 (YYYY-MM-DD)。未設定=同日
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
  zoomLevel: number // スロット高さ (px/5min) 2〜12, default: 5
  timezoneOffset: number // UTCからのオフセット（分）。例: JST=540, UTC=0。デフォルトはブラウザのローカル
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
export const SLOTS_PER_HOUR = 12 // 5分刻み
export const SLOT_COUNT = 24 * SLOTS_PER_HOUR // 288

export function slotToTime(slot: number): string {
  const h = Math.floor(slot / SLOTS_PER_HOUR)
  const m = (slot % SLOTS_PER_HOUR) * 5
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * SLOTS_PER_HOUR + Math.floor(m / 5)
}

/** Round time string to nearest 5 minutes */
export function roundTo5Min(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const rounded = Math.round(m / 5) * 5
  const finalM = rounded === 60 ? 0 : rounded
  const finalH = rounded === 60 ? h + 1 : h
  return `${finalH.toString().padStart(2, '0')}:${finalM.toString().padStart(2, '0')}`
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

/** 設定されたタイムゾーンオフセットで「今」の時・分を返す */
export function getNowInTimezone(offsetMinutes: number): { hours: number; minutes: number } {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000
  const adjusted = new Date(utcMs + offsetMinutes * 60_000)
  return { hours: adjusted.getHours(), minutes: adjusted.getMinutes() }
}

/** 設定されたタイムゾーンオフセットで「今日」のYYYY-MM-DD文字列を返す */
export function getTodayInTimezone(offsetMinutes: number): string {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000
  const adjusted = new Date(utcMs + offsetMinutes * 60_000)
  return formatDate(adjusted)
}

/**
 * ブロックのスロットをタイムゾーン差分で調整する。
 * 例: JSTで作成(+540)→HST(-600)に変更 → diff = -600 - 540 = -1140分 = -228スロット
 * 0〜287の範囲にクランプし、範囲外のブロックはnullを返す。
 */
export function adjustBlockForTimezone(
  block: TimeBlock,
  currentOffset: number,
): TimeBlock | null {
  if (block.timezoneOffset == null) return block // レガシーデータはそのまま
  const diffMinutes = currentOffset - block.timezoneOffset
  if (diffMinutes === 0) return block
  const diffSlots = diffMinutes / 5
  const newStart = block.startTime + diffSlots
  const newEnd = block.endTime + diffSlots
  // 完全に範囲外なら非表示
  if (newEnd <= 0 || newStart >= SLOT_COUNT) return null
  return {
    ...block,
    startTime: Math.max(0, Math.round(newStart)),
    endTime: Math.min(SLOT_COUNT, Math.round(newEnd)),
  }
}

/** ブロック配列をタイムゾーン調整して返す */
export function adjustBlocksForTimezone(blocks: TimeBlock[], currentOffset: number): TimeBlock[] {
  const result: TimeBlock[] = []
  for (const b of blocks) {
    const adjusted = adjustBlockForTimezone(b, currentOffset)
    if (adjusted) result.push(adjusted)
  }
  return result
}

/**
 * 指定日に表示すべきブロックの「見た目のstartTime/endTime」を返す。
 * 日跨ぎブロック（endDateが設定されている）を考慮:
 * - 開始日: startTime ~ 288
 * - 中間日: 0 ~ 288
 * - 終了日: 0 ~ endTime
 * sourceDate/sourceIdを付与して元ブロックを追跡可能にする。
 */
export function getVisibleBlocksForDay(
  dateStr: string,
  blocks: TimeBlock[],
  scheduleDate: string,
): TimeBlock[] {
  const result: TimeBlock[] = []
  for (const block of blocks) {
    const blockStart = block.startDate || scheduleDate
    const blockEnd = block.endDate || scheduleDate

    if (dateStr < blockStart || dateStr > blockEnd) continue

    let visibleStart = 0
    let visibleEnd = SLOT_COUNT

    if (dateStr === blockStart) visibleStart = block.startTime
    if (dateStr === blockEnd) visibleEnd = block.endTime

    if (visibleStart < visibleEnd) {
      result.push({
        ...block,
        startTime: visibleStart,
        endTime: visibleEnd,
        // Preserve original data for editing
        startDate: blockStart,
        endDate: blockEnd !== blockStart ? blockEnd : undefined,
      })
    }
  }
  return result
}

export const IDEAL_COLOR = '#34b870' // 緑（やや鮮やか、白文字映え）
export const ACTUAL_COLOR = '#e8546a' // ローズ（やや鮮やか、白文字映え）

export const DEFAULT_SETTINGS: AppSettings = {
  zoomLevel: 5,
  timezoneOffset: -(new Date().getTimezoneOffset()), // ブラウザのローカルタイムゾーン
}
