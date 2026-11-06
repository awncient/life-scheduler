import { BookOpen, Clock } from 'lucide-react'

type Props = {
  /** 現在日記ページを表示しているか */
  inDiary: boolean
  onToggle: () => void
}

/** 画面右下の「時系列 ⇄ 日記」切り替えボタン（どちらの画面でも同じ位置） */
export function ViewSwitchButton({ inDiary, onToggle }: Props) {
  const label = inDiary ? '時系列に戻る' : '日記を書く'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onToggle}
      className="fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg active:bg-slate-600 transition-colors"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      {inDiary ? <Clock className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
    </button>
  )
}
