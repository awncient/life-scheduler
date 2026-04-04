/**
 * DayLog Push Notification Worker
 *
 * エンドポイント:
 *   POST /validate     - PROキー検証
 *   POST /subscribe    - Push購読登録
 *   POST /schedule     - 通知スケジュール登録/更新
 *   DELETE /schedule    - 通知スケジュール削除
 *   Cron Trigger       - 毎分実行、送信すべき通知をチェックして送信
 */

export interface Env {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  PRO_KEY_HASH: string
}

// ===== ユーティリティ =====

function cors(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Pro-Key')
  return new Response(response.body, { ...response, headers })
}

function json(data: unknown, status = 200): Response {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status)
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateId(): string {
  return crypto.randomUUID()
}

// ===== Web Push（VAPID署名 + 暗号化） =====

/**
 * Web Push の送信
 * Cloudflare Workers は Node.js の crypto モジュールがないため、
 * Web Crypto API を使って VAPID 署名を行う簡易実装
 */

function base64UrlEncode(data: Uint8Array): string {
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importVapidPrivateKey(base64Key: string): Promise<CryptoKey> {
  const rawKey = base64UrlDecode(base64Key)
  return crypto.subtle.importKey(
    'pkcs8',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  expiration: number
): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: expiration,
    sub: subject,
  })))

  const signingInput = `${header}.${payload}`

  const privateKey = await importVapidPrivateKey(privateKeyBase64)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  )

  // ECDSA signature を DER から raw (r || s) に変換
  const sig = base64UrlEncode(new Uint8Array(signature))

  return `${signingInput}.${sig}`
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  env: Env
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint)
    const audience = `${url.protocol}//${url.host}`
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60 // 12時間

    const jwt = await createVapidJwt(
      audience,
      env.VAPID_SUBJECT,
      env.VAPID_PRIVATE_KEY,
      expiration
    )

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
      },
      body: new TextEncoder().encode(payload),
    })

    if (response.status === 410 || response.status === 404) {
      // 購読が無効になっている → DBから削除
      return false
    }

    return response.ok
  } catch (e) {
    console.error('Push send failed:', e)
    return false
  }
}

// ===== ルートハンドラー =====

/** POST /validate - PROキー検証 */
async function handleValidate(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { key?: string }
  if (!body.key) return error('キーが必要です')

  const hash = await hashKey(body.key)
  if (hash !== env.PRO_KEY_HASH) {
    return error('無効なキーです', 401)
  }

  return json({ valid: true, vapidPublicKey: env.VAPID_PUBLIC_KEY })
}

/** POST /subscribe - Push購読登録 */
async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  const proKey = request.headers.get('X-Pro-Key')
  if (!proKey) return error('PROキーが必要です', 401)
  const hash = await hashKey(proKey)
  if (hash !== env.PRO_KEY_HASH) return error('無効なキーです', 401)

  const body = await request.json() as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return error('不正な購読情報です')
  }

  const id = generateId()

  // UPSERT: 同じendpointなら更新
  await env.DB.prepare(`
    INSERT INTO push_subscriptions (id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `).bind(id, body.endpoint, body.keys.p256dh, body.keys.auth).run()

  // 登録されたIDを返す（既存の場合はそのIDを返す）
  const row = await env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE endpoint = ?'
  ).bind(body.endpoint).first<{ id: string }>()

  return json({ subscriptionId: row?.id ?? id })
}

/** POST /schedule - 通知スケジュール登録/更新 */
async function handleSchedule(request: Request, env: Env): Promise<Response> {
  const proKey = request.headers.get('X-Pro-Key')
  if (!proKey) return error('PROキーが必要です', 401)
  const hash = await hashKey(proKey)
  if (hash !== env.PRO_KEY_HASH) return error('無効なキーです', 401)

  const body = await request.json() as {
    subscriptionId: string
    blockId: string
    dateStr: string
    notifications: Array<{
      type: 'start' | 'end'
      notifyAt: string // ISO8601
    }>
  }

  if (!body.subscriptionId || !body.blockId || !body.dateStr) {
    return error('必須パラメータが不足しています')
  }

  // 既存の同ブロックのスケジュールを削除
  await env.DB.prepare(`
    DELETE FROM notification_schedules
    WHERE subscription_id = ? AND block_id = ? AND date_str = ?
  `).bind(body.subscriptionId, body.blockId, body.dateStr).run()

  // 新しいスケジュールを挿入
  if (body.notifications && body.notifications.length > 0) {
    const stmt = env.DB.prepare(`
      INSERT INTO notification_schedules (id, subscription_id, block_id, date_str, type, notify_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const batch = body.notifications.map(n =>
      stmt.bind(generateId(), body.subscriptionId, body.blockId, body.dateStr, n.type, n.notifyAt)
    )

    await env.DB.batch(batch)
  }

  return json({ ok: true })
}

/** DELETE /schedule - 通知スケジュール削除 */
async function handleDeleteSchedule(request: Request, env: Env): Promise<Response> {
  const proKey = request.headers.get('X-Pro-Key')
  if (!proKey) return error('PROキーが必要です', 401)
  const hash = await hashKey(proKey)
  if (hash !== env.PRO_KEY_HASH) return error('無効なキーです', 401)

  const url = new URL(request.url)
  const subscriptionId = url.searchParams.get('subscriptionId')
  const blockId = url.searchParams.get('blockId')
  const dateStr = url.searchParams.get('dateStr')

  if (!subscriptionId || !blockId || !dateStr) {
    return error('必須パラメータが不足しています')
  }

  await env.DB.prepare(`
    DELETE FROM notification_schedules
    WHERE subscription_id = ? AND block_id = ? AND date_str = ?
  `).bind(subscriptionId, blockId, dateStr).run()

  return json({ ok: true })
}

// ===== Cron Handler =====

async function handleCron(env: Env): Promise<void> {
  const now = new Date().toISOString()

  // 送信すべき通知を取得（未送信 & 予定時刻が過ぎている）
  const rows = await env.DB.prepare(`
    SELECT ns.id, ns.block_id, ns.date_str, ns.type,
           ps.endpoint, ps.p256dh, ps.auth, ps.id as sub_id
    FROM notification_schedules ns
    JOIN push_subscriptions ps ON ns.subscription_id = ps.id
    WHERE ns.sent = 0 AND ns.notify_at <= ?
    LIMIT 100
  `).bind(now).all()

  if (!rows.results || rows.results.length === 0) return

  const sentIds: string[] = []
  const invalidSubIds: string[] = []

  for (const row of rows.results) {
    const payload = JSON.stringify({
      blockId: row.block_id,
      dateStr: row.date_str,
      type: row.type,
    })

    const success = await sendPushNotification(
      {
        endpoint: row.endpoint as string,
        p256dh: row.p256dh as string,
        auth: row.auth as string,
      },
      payload,
      env
    )

    if (success) {
      sentIds.push(row.id as string)
    } else {
      // 410/404 → 購読が無効
      invalidSubIds.push(row.sub_id as string)
    }
  }

  // 送信済みマーク
  if (sentIds.length > 0) {
    const placeholders = sentIds.map(() => '?').join(',')
    await env.DB.prepare(
      `UPDATE notification_schedules SET sent = 1 WHERE id IN (${placeholders})`
    ).bind(...sentIds).run()
  }

  // 無効な購読を削除（CASCADE でスケジュールも削除される）
  if (invalidSubIds.length > 0) {
    const unique = [...new Set(invalidSubIds)]
    const placeholders = unique.map(() => '?').join(',')
    await env.DB.prepare(
      `DELETE FROM push_subscriptions WHERE id IN (${placeholders})`
    ).bind(...unique).run()
  }

  // 24時間以上前の送信済みスケジュールをクリーンアップ
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare(
    'DELETE FROM notification_schedules WHERE sent = 1 AND notify_at < ?'
  ).bind(oneDayAgo).run()
}

// ===== メインハンドラー =====

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }))
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      if (path === '/validate' && request.method === 'POST') {
        return handleValidate(request, env)
      }
      if (path === '/subscribe' && request.method === 'POST') {
        return handleSubscribe(request, env)
      }
      if (path === '/schedule' && request.method === 'POST') {
        return handleSchedule(request, env)
      }
      if (path === '/schedule' && request.method === 'DELETE') {
        return handleDeleteSchedule(request, env)
      }

      // Health check
      if (path === '/health') {
        return json({ status: 'ok' })
      }

      return error('Not Found', 404)
    } catch (e) {
      console.error('Worker error:', e)
      return error('Internal Server Error', 500)
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleCron(env)
  },
}
