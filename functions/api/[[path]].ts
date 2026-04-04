/**
 * Cloudflare Pages Function: /api/* → Worker へのプロキシ
 *
 * iOS Safari PWA で cross-origin fetch が失敗する問題を回避するため、
 * same-origin の /api/* パスでリクエストを受け、Worker に転送する。
 */

interface Env {
  WORKER_API_URL: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context

  const workerUrl = env.WORKER_API_URL
  if (!workerUrl) {
    return new Response(JSON.stringify({ error: 'WORKER_API_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // /api/schedule → https://worker.url/schedule
  const pathSegments = params.path as string[]
  const path = '/' + pathSegments.join('/')
  const targetUrl = workerUrl.replace(/\/$/, '') + path

  // リクエストをそのまま転送（Hostヘッダーは除外）
  const proxyHeaders = new Headers(request.headers)
  proxyHeaders.delete('host')

  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
  })

  try {
    const response = await fetch(proxyRequest)

    // レスポンスヘッダーをコピー（CORS不要 - same-originのため）
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    })
  } catch (e) {
    return new Response(JSON.stringify({
      error: 'Proxy fetch failed',
      detail: e instanceof Error ? e.message : String(e),
      targetUrl,
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
