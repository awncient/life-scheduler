import { useState, useRef, useEffect, useCallback } from 'react'
import { getDiary, saveDiary } from '@/lib/storage'

const AUTOSAVE_DELAY_MS = 500

type Props = {
  date: string
}

/**
 * 自由記述の日記ページ（iOSメモ帳風）。
 * - 入力のたびに少し待ってから自動保存（保存ボタンなし）
 * - 日付切り替え・画面切り替え・アプリを閉じるときは即保存
 * 日付ごとに作り直す想定（呼び出し側で key={date} を付ける）。
 */
export function DiaryView({ date }: Props) {
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
