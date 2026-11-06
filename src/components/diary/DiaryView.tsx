import { useState, useRef, useEffect, useCallback } from 'react'
import { getDiary, saveDiary } from '@/lib/storage'

const AUTOSAVE_DELAY_MS = 500
// フリック判定: 横に十分動き、縦より明確に横方向で、素早い操作のときだけ
const SWIPE_MIN_DX = 70
const SWIPE_MAX_MS = 700

type Props = {
  date: string
  /** 左右フリック時に呼ばれる。-1: 前（右へフリック）/ 1: 次（左へフリック） */
  onSwipe?: (direction: -1 | 1) => void
}

/**
 * 自由記述の日記ページ（iOSメモ帳風）。
 * - 入力のたびに少し待ってから自動保存（保存ボタンなし）
 * - 日付切り替え・画面切り替え・アプリを閉じるときは即保存
 * 日付ごとに作り直す想定（呼び出し側で key={date} を付ける）。
 */
export function DiaryView({ date, onSwipe }: Props) {
  const [text, setText] = useState(() => getDiary(date).content)
  const latestText = useRef(text)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!dirty.current) return
    dirty.current = false
    saveDiary({ date, content: latestText.current })
  }, [date])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    latestText.current = value
    dirty.current = true
    setText(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS)
  }

  // アンマウント（日付切替・時系列へ戻る）やアプリ非表示時に取りこぼさず保存
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  // 左右フリックで前後の日記へ（passiveリスナーのみ。縦スクロールや文字入力は邪魔しない）
  const onSwipeRef = useRef(onSwipe)
  onSwipeRef.current = onSwipe
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    let startX = 0
    let startY = 0
    let startTime = 0
    let tracking = false

    const onStart = (e: TouchEvent) => {
      tracking = e.touches.length === 1
      if (!tracking) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startTime = Date.now()
    }
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      // 文字選択中のドラッグはフリックとして扱わない
      if (ta.selectionStart !== ta.selectionEnd) return
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (Date.now() - startTime > SWIPE_MAX_MS) return
      if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * 2) return
      onSwipeRef.current?.(dx > 0 ? -1 : 1)
    }
    const onCancel = () => {
      tracking = false
    }

    ta.addEventListener('touchstart', onStart, { passive: true })
    ta.addEventListener('touchend', onEnd, { passive: true })
    ta.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      ta.removeEventListener('touchstart', onStart)
      ta.removeEventListener('touchend', onEnd)
      ta.removeEventListener('touchcancel', onCancel)
    }
  }, [])

  // iOSではキーボードが出てもレイアウトビューポートが縮まないため、
  // 表示領域(visualViewport)に合わせて高さを詰め、入力中の行がキーボードに隠れないようにする
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const el = containerRef.current
      if (!el) return
      const keyboardOpen = window.innerHeight - vv.height > 100
      if (!keyboardOpen) {
        setHeight(null)
        return
      }
      const top = el.getBoundingClientRect().top
      setHeight(Math.max(120, vv.offsetTop + vv.height - top))
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full bg-white"
      style={{ height: height ?? '100%' }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        placeholder="今日はどんな一日でしたか？"
        aria-label="日記"
        // iOSはフォントサイズが16px未満だと入力時に画面が拡大されるため16px以上にする
        className="block w-full h-full resize-none border-0 outline-none bg-transparent text-slate-800 placeholder:text-slate-300"
        style={{
          fontSize: 17,
          lineHeight: 1.7,
          padding: '16px 20px',
          // 右下の切り替えボタンに末尾の文章が隠れないよう余白を確保
          paddingBottom: 96,
        }}
      />
    </div>
  )
}
