/**
 * DayLog Push通知 クライアントライブラリ
 *
 * - PROキー検証・ローカル保存
 * - Push購読の登録
 * - 通知スケジュールの登録/削除
 * - すべてのタスク名はサーバーに送信しない
 */

const STORAGE_PREFIX = 'daylog:notify'

// Worker APIのベースURL（ビルド時に埋め込み）
const WORKER_BASE_URL = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '')

const PRO_KEY_KEY = `${STORAGE_PREFIX}:proKey`
const VALIDATED_KEY = `${STORAGE_PREFIX}:validated`
const SUBSCRIPTION_ID_KEY = `${STORAGE_PREFIX}:subscriptionId`
const VAPID_PUBLIC_KEY_KEY = `${STORAGE_PREFIX}:vapidPublicKey`

// ===== 認証状態の管理 =====

export function getWorkerUrl(): string {
  return WORKER_BASE_URL
}

export function getProKey(): string {
  return localStorage.getItem(PRO_KEY_KEY) || ''
}

function setProKey(key: string): void {
  localStorage.setItem(PRO_KEY_KEY, key)
}

export function isPremiumValidated(): boolean {
  return localStorage.getItem(VALIDATED_KEY) === 'true'
}

function setValidated(valid: boolean): void {
  localStorage.setItem(VALIDATED_KEY, valid ? 'true' : 'false')
}

export function getSubscriptionId(): string {
  return localStorage.getItem(SUBSCRIPTION_ID_KEY) || ''
}

function setSubscriptionId(id: string): void {
  localStorage.setItem(SUBSCRIPTION_ID_KEY, id)
}

function getVapidPublicKey(): string {
  return localStorage.getItem(VAPID_PUBLIC_KEY_KEY) || ''
}

function setVapidPublicKey(key: string): void {
  localStorage.setItem(VAPID_PUBLIC_KEY_KEY, key)
}

/** PRO機能を完全リセット */
export function resetPremium(): void {
  localStorage.removeItem(PRO_KEY_KEY)
  localStorage.removeItem(VALIDATED_KEY)
  localStorage.removeItem(SUBSCRIPTION_ID_KEY)
  localStorage.removeItem(VAPID_PUBLIC_KEY_KEY)
}

// ===== Worker APIとの通信 =====

async function workerFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = getWorkerUrl()
  if (!base) throw new Error('Worker URLが設定されていません')

  const headers = new Headers(options.headers)
  const proKey = getProKey()
  if (proKey) headers.set('X-Pro-Key', btoa(encodeURIComponent(proKey)))
  headers.set('Content-Type', 'application/json')

  return fetch(`${base}${path}`, { ...options, headers, mode: 'cors' })
}

// ===== PROキー検証 =====

export async function validateProKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await workerFetch('/validate', {
      method: 'POST',
      body: JSON.stringify({ key }),
    })

    const data = await res.json() as { valid?: boolean; vapidPublicKey?: string; error?: string }

    if (data.valid) {
      setProKey(key)
      setValidated(true)
      if (data.vapidPublicKey) setVapidPublicKey(data.vapidPublicKey)
      return { valid: true }
    }

    return { valid: false, error: data.error || '無効なキーです' }
  } catch (e) {
    return { valid: false, error: `通信エラー: ${e instanceof Error ? e.message : '不明なエラー'}` }
  }
}

// ===== Push購読登録 =====

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerPushSubscription(): Promise<{ success: boolean; error?: string }> {
  try {
    // Service Workerが利用可能か確認
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, error: 'このブラウザはプッシュ通知に対応していません' }
    }

    // 通知の許可を取得
    let permission: NotificationPermission
    try {
      permission = await Notification.requestPermission()
    } catch (e) {
      return { success: false, error: `通知許可の取得で失敗: ${e instanceof Error ? e.message : '不明'}` }
    }
    if (permission !== 'granted') {
      return { success: false, error: '通知の許可が必要です。ブラウザの設定から許可してください。' }
    }

    const vapidKey = getVapidPublicKey()
    if (!vapidKey) {
      return { success: false, error: 'VAPID公開鍵が取得できていません。キーの再認証を試してください。' }
    }

    // Service Worker登録を取得
    let registration: ServiceWorkerRegistration
    try {
      registration = await navigator.serviceWorker.ready
    } catch (e) {
      return { success: false, error: `Service Worker取得で失敗: ${e instanceof Error ? e.message : '不明'}` }
    }

    // Push購読を作成
    let subscription: PushSubscription
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })
    } catch (e) {
      return { success: false, error: `Push購読の作成で失敗: ${e instanceof Error ? e.message : '不明'}` }
    }

    const subJSON = subscription.toJSON()

    // Worker に登録
    let res: Response
    try {
      res = await workerFetch('/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
        }),
      })
    } catch (e) {
      return { success: false, error: `Workerへの送信で失敗: ${e instanceof Error ? e.message : '不明'}` }
    }

    const data = await res.json() as { subscriptionId?: string; error?: string }

    if (data.subscriptionId) {
      setSubscriptionId(data.subscriptionId)
      return { success: true }
    }

    return { success: false, error: data.error || '登録に失敗しました' }
  } catch (e) {
    return { success: false, error: `予期しないエラー: ${e instanceof Error ? `${e.name}: ${e.message}` : '不明'}` }
  }
}

// ===== 通知が利用可能か =====

export function isNotificationReady(): boolean {
  return isPremiumValidated() && !!getSubscriptionId()
}

// ===== 通知スケジュールの管理 =====

export type NotifyConfig = {
  startEnabled: boolean
  startMinutesBefore: number
  endEnabled: boolean
  endMinutesBefore: number
}

const NOTIFY_CONFIG_PREFIX = `${STORAGE_PREFIX}:config`

/** ブロックの通知設定をローカルに保存 */
export function getBlockNotifyConfig(blockId: string, dateStr: string): NotifyConfig | null {
  const key = `${NOTIFY_CONFIG_PREFIX}:${dateStr}:${blockId}`
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as NotifyConfig
  } catch {
    return null
  }
}

export function saveBlockNotifyConfig(blockId: string, dateStr: string, config: NotifyConfig): void {
  const key = `${NOTIFY_CONFIG_PREFIX}:${dateStr}:${blockId}`
  localStorage.setItem(key, JSON.stringify(config))
}

export function deleteBlockNotifyConfig(blockId: string, dateStr: string): void {
  const key = `${NOTIFY_CONFIG_PREFIX}:${dateStr}:${blockId}`
  localStorage.removeItem(key)
}

/** スロット番号(0-287) + 日付文字列 + 分前オフセット → ISO8601 */
function slotToISO(dateStr: string, slot: number, minutesBefore: number, timezoneOffset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const totalMinutes = slot * 5 - minutesBefore
  const date = new Date(Date.UTC(y, m - 1, d))
  // タイムゾーンを考慮してUTCに変換
  date.setUTCMinutes(date.getUTCMinutes() + totalMinutes - timezoneOffset)
  return date.toISOString()
}

/** ブロック保存/更新時に通知スケジュールをWorkerに送信 */
export async function syncNotificationSchedule(
  blockId: string,
  dateStr: string,
  startSlot: number,
  endSlot: number,
  config: NotifyConfig,
  timezoneOffset: number
): Promise<{ success: boolean; error?: string }> {
  const subscriptionId = getSubscriptionId()
  if (!subscriptionId) return { success: false, error: '購読IDが見つかりません。通知を再度有効にしてください。' }

  const base = getWorkerUrl()
  if (!base) return { success: false, error: `Worker URLが空です` }

  const notifications: Array<{ type: 'start' | 'end'; notifyAt: string }> = []

  if (config.startEnabled) {
    notifications.push({
      type: 'start',
      notifyAt: slotToISO(dateStr, startSlot, config.startMinutesBefore, timezoneOffset),
    })
  }

  if (config.endEnabled) {
    notifications.push({
      type: 'end',
      notifyAt: slotToISO(dateStr, endSlot, config.endMinutesBefore, timezoneOffset),
    })
  }

  // まずWorkerへの疎通確認
  try {
    await fetch(`${base}/health`, { mode: 'cors' })
  } catch (e) {
    return { success: false, error: `Worker疎通失敗 (${base}/health): ${e instanceof Error ? e.message : '不明'}` }
  }

  try {
    const headers = new Headers()
    const proKey = getProKey()
    if (proKey) headers.set('X-Pro-Key', btoa(encodeURIComponent(proKey)))
    headers.set('Content-Type', 'application/json')

    const res = await fetch(`${base}/schedule`, {
      method: 'POST',
      headers,
      mode: 'cors',
      body: JSON.stringify({
        subscriptionId,
        blockId,
        dateStr,
        notifications,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      return { success: false, error: data.error || `サーバーエラー (${res.status})` }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: `スケジュール送信失敗 (${base}/schedule): ${e instanceof Error ? e.message : '不明'}` }
  }
}

/** ブロック削除時に通知スケジュールも削除 */
export async function deleteNotificationSchedule(
  blockId: string,
  dateStr: string
): Promise<void> {
  const subscriptionId = getSubscriptionId()
  if (!subscriptionId) return

  try {
    await workerFetch(
      `/schedule?subscriptionId=${subscriptionId}&blockId=${blockId}&dateStr=${dateStr}`,
      { method: 'DELETE' }
    )
  } catch (e) {
    console.error('通知スケジュール削除エラー:', e)
  }

  deleteBlockNotifyConfig(blockId, dateStr)
}
