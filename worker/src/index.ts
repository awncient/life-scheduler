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
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
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

/** X-Pro-Keyヘッダからキーを取得（Base64+URIエンコード対応） */
function decodeProKey(raw: string): string {
  try {
    return decodeURIComponent(atob(raw))
  } catch {
    // エンコードされていない場合はそのまま返す
    return raw
  }
}

/**
 * リクエストbodyからPROキーを検証する共通ヘルパー。
 * iOS Safari PWA でCORS preflightを回避するため、
 * PROキーはヘッダーではなくbodyの _proKey フィールドに含めて送信される。
 */
async function parseBodyAndAuth(request: Request, env: Env): Promise<{ body: Record<string, unknown>; error?: Response }> {
  const text = await request.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return { body: {}, error: error('不正なリクエスト形式です') }
  }

  const rawKey = body._proKey as string | undefined
  if (!rawKey) return { body, error: error('PROキーが必要です', 401) }

  const hash = await hashKey(decodeProKey(rawKey))
  if (hash !== env.PRO_KEY_HASH) return { body, error: error('無効なキーです', 401) }

  return { body }
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

async function importVapidPrivateKey(base64UrlPrivateKey: string, base64UrlPublicKey: string): Promise<CryptoKey> {
  // VAPID公開鍵は65バイト（uncompressed point: 0x04 + x(32) + y(32)）
  const pubBytes = base64UrlDecode(base64UrlPublicKey)
  const x = base64UrlEncode(pubBytes.slice(1, 33))
  const y = base64UrlEncode(pubBytes.slice(33, 65))

  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: base64UrlPrivateKey,
      x,
      y,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string,
  expiration: number
): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: expiration,
    sub: subject,
  })))

  const signingInput = `${header}.${payload}`

  const privateKey = await importVapidPrivateKey(privateKeyBase64, publicKeyBase64)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  )

  // ECDSA signature を DER から raw (r || s) に変換
  const sig = base64UrlEncode(new Uint8Array(signature))

  return `${signingInput}.${sig}`
}

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlDecode(p256dhBase64)
  const authSecret = base64UrlDecode(authBase64)
  const payloadBytes = new TextEncoder().encode(payload)

  // サーバー側のECDH鍵ペアを生成
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  ) as CryptoKeyPair

  // サーバー公開鍵をraw形式でエクスポート
  const serverPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey) as ArrayBuffer
  )

  // クライアント公開鍵をインポート
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // ECDH共有秘密
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      serverKeyPair.privateKey,
      256
    ) as ArrayBuffer
  )

  // ソルト生成
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // auth_info = "WebPush: info\0" + clientPublicKey + serverPublicKey
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\0'),
    ...clientPublicKeyBytes,
    ...serverPublicKeyBytes,
  ])

  // PRK = HMAC-SHA-256(auth_secret, shared_secret)
  const hmacKey = await crypto.subtle.importKey(
    'raw', authSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, sharedSecret))

  // HKDF-Expand で IKM を導出
  const ikm = await hkdfExpand(prk, authInfo, 32)

  // CEK と Nonce を導出
  const cekInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
  ])
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: nonce\0'),
  ])

  // PRK2 = HMAC-SHA-256(salt, ikm)
  const saltKey = await crypto.subtle.importKey(
    'raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const prk2 = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm))

  const cek = await hkdfExpand(prk2, cekInfo, 16)
  const nonce = await hkdfExpand(prk2, nonceInfo, 12)

  // パディング (1バイトのデリミタ \x02 + ゼロパディング)
  const paddedPayload = new Uint8Array(payloadBytes.length + 1)
  paddedPayload.set(payloadBytes)
  paddedPayload[payloadBytes.length] = 2 // デリミタ

  // AES-128-GCM で暗号化
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  )

  // aes128gcm ヘッダー: salt(16) + rs(4) + idlen(1) + keyid(65)
  const rs = 4096
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKeyBytes.length)
  header.set(salt, 0)
  header[16] = (rs >> 24) & 0xff
  header[17] = (rs >> 16) & 0xff
  header[18] = (rs >> 8) & 0xff
  header[19] = rs & 0xff
  header[20] = serverPublicKeyBytes.length
  header.set(serverPublicKeyBytes, 21)

  // ヘッダー + 暗号文を結合
  const result = new Uint8Array(header.length + ciphertext.byteLength)
  result.set(header, 0)
  result.set(new Uint8Array(ciphertext), header.length)

  return { encrypted: result.buffer, salt }
}

/** HKDF-Expand (RFC 5869) */
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    'raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  // T(1) = HMAC-Hash(PRK, info || 0x01)
  const input = new Uint8Array(info.length + 1)
  input.set(info, 0)
  input[info.length] = 1
  const output = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, input))
  return output.slice(0, length)
}

/** Push送信結果 */
type PushResult = 'ok' | 'gone' | 'error'

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  env: Env
): Promise<PushResult> {
  try {
    const url = new URL(subscription.endpoint)
    const audience = `${url.protocol}//${url.host}`
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60 // 12時間

    const jwt = await createVapidJwt(
      audience,
      env.VAPID_SUBJECT,
      env.VAPID_PRIVATE_KEY,
      env.VAPID_PUBLIC_KEY,
      expiration
    )

    // RFC 8291 に準拠してペイロードを暗号化
    const { encrypted } = await encryptPayload(
      payload,
      subscription.p256dh,
      subscription.auth
    )

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': encrypted.byteLength.toString(),
        'TTL': '86400',
      },
      body: encrypted,
    })

    // 410/404 = 購読が明示的に無効化された
    if (response.status === 410 || response.status === 404) {
      console.log(`Push subscription gone (${response.status}): ${subscription.endpoint.substring(0, 60)}`)
      return 'gone'
    }

    if (response.ok) {
      return 'ok'
    }

    // その他のエラー（403, 400等）はログに記録するが購読は削除しない
    const body = await response.text().catch(() => '')
    console.error(`Push send failed (${response.status}): ${subscription.endpoint.substring(0, 60)} - ${body.substring(0, 200)}`)
    return 'error'
  } catch (e) {
    console.error('Push send exception:', e)
    return 'error'
  }
}

// ===== ルートハンドラー =====

/** POST /validate - PROキー検証 */
async function handleValidate(request: Request, env: Env): Promise<Response> {
  const { body, error: authError } = await parseBodyAndAuth(request, env)
  // validateは _proKey がなくても body.key で認証を試みる（後方互換）
  if (!body.key && authError) return authError

  const key = (body.key || '') as string
  if (!key) return error('キーが必要です')

  const hash = await hashKey(key)
  if (hash !== env.PRO_KEY_HASH) {
    return error('無効なキーです', 401)
  }

  return json({ valid: true, vapidPublicKey: env.VAPID_PUBLIC_KEY })
}

/** POST /subscribe - Push購読登録 */
async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  const { body, error: authError } = await parseBodyAndAuth(request, env)
  if (authError) return authError

  const keys = body.keys as { p256dh?: string; auth?: string } | undefined
  if (!body.endpoint || !keys?.p256dh || !keys?.auth) {
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
  `).bind(id, body.endpoint as string, keys!.p256dh, keys!.auth).run()

  // 登録されたIDを返す（既存の場合はそのIDを返す）
  const row = await env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE endpoint = ?'
  ).bind(body.endpoint).first<{ id: string }>()

  return json({ subscriptionId: row?.id ?? id })
}

/** POST /schedule - 通知スケジュール登録/更新 */
async function handleSchedule(request: Request, env: Env): Promise<Response> {
  const { body, error: authError } = await parseBodyAndAuth(request, env)
  if (authError) return authError

  if (!body.subscriptionId || !body.blockId || !body.dateStr) {
    return error('必須パラメータが不足しています')
  }

  // 購読が存在するか確認
  const sub = await env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE id = ?'
  ).bind(body.subscriptionId as string).first()
  if (!sub) {
    return error('購読が見つかりません。通知を再度有効にしてください。', 404)
  }

  // 既存の同ブロックのスケジュールを削除
  await env.DB.prepare(`
    DELETE FROM notification_schedules
    WHERE subscription_id = ? AND block_id = ? AND date_str = ?
  `).bind(body.subscriptionId as string, body.blockId as string, body.dateStr as string).run()

  const notifications = body.notifications as Array<{ type: string; notifyAt: string }> | undefined
  // 新しいスケジュールを挿入
  if (notifications && notifications.length > 0) {
    const stmt = env.DB.prepare(`
      INSERT INTO notification_schedules (id, subscription_id, block_id, date_str, type, notify_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const batch = notifications.map(n =>
      stmt.bind(generateId(), body.subscriptionId as string, body.blockId as string, body.dateStr as string, n.type, n.notifyAt)
    )

    await env.DB.batch(batch)
  }

  return json({ ok: true })
}

/** POST /schedule/delete - 通知スケジュール削除 */
async function handleDeleteSchedule(request: Request, env: Env): Promise<Response> {
  const { body, error: authError } = await parseBodyAndAuth(request, env)
  if (authError) return authError

  const subscriptionId = body.subscriptionId as string
  const blockId = body.blockId as string
  const dateStr = body.dateStr as string

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
  const goneSubIds: string[] = []

  for (const row of rows.results) {
    const payload = JSON.stringify({
      blockId: row.block_id,
      dateStr: row.date_str,
      type: row.type,
    })

    const result = await sendPushNotification(
      {
        endpoint: row.endpoint as string,
        p256dh: row.p256dh as string,
        auth: row.auth as string,
      },
      payload,
      env
    )

    if (result === 'ok') {
      sentIds.push(row.id as string)
    } else if (result === 'gone') {
      // 410/404のみ購読を削除（明示的に無効化された場合のみ）
      goneSubIds.push(row.sub_id as string)
    } else {
      // 'error': 一時的なエラーの可能性があるため、sent=0のままにして次回リトライ
      console.log(`Push delivery failed for schedule ${row.id}, will retry next cron`)
    }
  }

  // 送信済みマーク
  if (sentIds.length > 0) {
    const placeholders = sentIds.map(() => '?').join(',')
    await env.DB.prepare(
      `UPDATE notification_schedules SET sent = 1 WHERE id IN (${placeholders})`
    ).bind(...sentIds).run()
  }

  // 明示的に無効な購読のみ削除（CASCADE でスケジュールも削除される）
  if (goneSubIds.length > 0) {
    const unique = [...new Set(goneSubIds)]
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

/** 絶対にクラッシュしない安全なレスポンス生成 */
function safeErrorResponse(e: unknown): Response {
  try {
    const msg = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e)
    return new Response(JSON.stringify({ error: 'Worker exception', detail: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch {
    return new Response('Internal Server Error', { status: 500 })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // CORS preflight
      if (request.method === 'OPTIONS') {
        return cors(new Response(null, { status: 204 }))
      }

      const url = new URL(request.url)
      const path = url.pathname

      if (path === '/validate' && request.method === 'POST') {
        return await handleValidate(request, env)
      }
      if (path === '/subscribe' && request.method === 'POST') {
        return await handleSubscribe(request, env)
      }
      if (path === '/schedule' && request.method === 'POST') {
        return await handleSchedule(request, env)
      }
      if (path === '/schedule/delete' && request.method === 'POST') {
        return await handleDeleteSchedule(request, env)
      }

      // Health check（バージョン確認用）
      if (path === '/health') {
        return json({ status: 'ok', version: '2024-04-04-v3' })
      }

      // デバッグ用: DB状態確認（PROキー必須）
      if (path === '/debug/status' && request.method === 'GET') {
        const rawKey = request.headers.get('X-Pro-Key')
        if (!rawKey) return error('PROキーが必要です', 401)
        const hash = await hashKey(decodeProKey(rawKey))
        if (hash !== env.PRO_KEY_HASH) return error('無効なキーです', 401)

        const subs = await env.DB.prepare('SELECT id, endpoint, created_at FROM push_subscriptions').all()
        const schedules = await env.DB.prepare('SELECT id, subscription_id, block_id, date_str, type, notify_at, sent FROM notification_schedules ORDER BY notify_at').all()
        const now = new Date().toISOString()
        return json({ now, subscriptions: subs.results, schedules: schedules.results })
      }

      // デバッグ用: 手動で通知送信テスト（PROキー必須、全購読に送信）
      if (path === '/debug/test-push' && request.method === 'POST') {
        const rawKey = request.headers.get('X-Pro-Key')
        if (!rawKey) return error('PROキーが必要です', 401)
        const hash = await hashKey(decodeProKey(rawKey))
        if (hash !== env.PRO_KEY_HASH) return error('無効なキーです', 401)

        const subs = await env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions').all()
        if (!subs.results || subs.results.length === 0) {
          return json({ error: '購読が見つかりません' })
        }

        const testPayload = JSON.stringify({
          blockId: 'test',
          dateStr: new Date().toISOString().split('T')[0],
          type: 'start',
        })

        const results = []
        for (const sub of subs.results) {
          try {
            const result = await sendPushNotification(
              {
                endpoint: sub.endpoint as string,
                p256dh: sub.p256dh as string,
                auth: sub.auth as string,
              },
              testPayload,
              env
            )
            results.push({ id: sub.id, endpoint: (sub.endpoint as string).substring(0, 60) + '...', result })
          } catch (e) {
            results.push({ id: sub.id, endpoint: (sub.endpoint as string).substring(0, 60) + '...', success: false, error: e instanceof Error ? e.message : '不明' })
          }
        }
        return json({ results })
      }

      return error('Not Found', 404)
    } catch (e) {
      console.error('Worker error:', e)
      return safeErrorResponse(e)
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleCron(env)
  },
}
