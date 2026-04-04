/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

import { precacheAndRoute } from 'workbox-precaching'

// 新しいService Workerを即座に有効化（古いキャッシュに留まる問題を防ぐ）
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Workboxのプリキャッシュ
precacheAndRoute(self.__WB_MANIFEST)

// ===== Push通知受信ハンドラ =====

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json() as {
      blockId: string
      dateStr: string
      type: 'start' | 'end'
    }

    // タイトル等はサーバーから送られないため、通知テキストはシンプルに
    // （端末のlocalStorageにはService Workerから直接アクセスできないため、
    //   IndexedDBやclients APIを使う必要がある。ここではシンプルに汎用メッセージ）
    const typeLabel = data.type === 'start' ? '開始' : '終了'

    // クライアント（PWA画面）が開いている場合はメッセージを送って
    // ローカルストレージからタイトルを取得してもらう
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

        let title = ''
        let body = ''

        // 開いているクライアントからブロック情報を取得
        if (clients.length > 0) {
          const client = clients[0]
          const channel = new MessageChannel()

          const blockInfo = await new Promise<{ title: string; startTime: string; endTime: string } | null>((resolve) => {
            const timer = setTimeout(() => resolve(null), 2000)
            channel.port1.onmessage = (e) => {
              clearTimeout(timer)
              resolve(e.data)
            }
            client.postMessage(
              { type: 'GET_BLOCK_INFO', blockId: data.blockId, dateStr: data.dateStr },
              [channel.port2]
            )
          })

          if (blockInfo) {
            const blockTitle = blockInfo.title || '（タイトルなし）'
            if (data.type === 'start') {
              title = `${blockTitle} がまもなく開始`
              body = `${blockInfo.startTime}〜${blockInfo.endTime}`
            } else {
              title = `${blockTitle} がまもなく終了`
              body = `${blockInfo.startTime}〜${blockInfo.endTime}`
            }
          }
        }

        // クライアントから情報取得できなかった場合のフォールバック
        if (!title) {
          title = `予定の${typeLabel}通知`
          body = `${data.dateStr} の予定が${typeLabel === '開始' ? 'まもなく始まります' : 'まもなく終わります'}`
        }

        await self.registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `${data.blockId}-${data.type}`,
          data: { dateStr: data.dateStr, blockId: data.blockId },
        })
      })()
    )
  } catch (e) {
    console.error('Push handling error:', e)
  }
})

// 通知クリック → アプリを開く
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (clients.length > 0) {
        const client = clients[0]
        await client.focus()
      } else {
        await self.clients.openWindow('/')
      }
    })()
  )
})
