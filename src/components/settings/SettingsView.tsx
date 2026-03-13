import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { downloadJSON, readJSONFile, importData } from '@/lib/export-import'
import { getSettings, saveSettings } from '@/lib/storage'
import { Download, Upload, ExternalLink, ArrowLeft } from 'lucide-react'

const TIMEZONE_OPTIONS = [
  { label: 'UTC-12:00（ベーカー島）', value: -720 },
  { label: 'UTC-11:00（米領サモア）', value: -660 },
  { label: 'UTC-10:00（ハワイ）', value: -600 },
  { label: 'UTC-09:30（マルキーズ諸島）', value: -570 },
  { label: 'UTC-09:00（アラスカ）', value: -540 },
  { label: 'UTC-08:00（太平洋標準時）', value: -480 },
  { label: 'UTC-07:00（山岳部標準時）', value: -420 },
  { label: 'UTC-06:00（中部標準時）', value: -360 },
  { label: 'UTC-05:00（東部標準時）', value: -300 },
  { label: 'UTC-04:00（大西洋標準時）', value: -240 },
  { label: 'UTC-03:30（ニューファンドランド）', value: -210 },
  { label: 'UTC-03:00（ブラジリア）', value: -180 },
  { label: 'UTC-02:00（中央大西洋）', value: -120 },
  { label: 'UTC-01:00（アゾレス諸島）', value: -60 },
  { label: 'UTC+00:00（ロンドン）', value: 0 },
  { label: 'UTC+01:00（中央ヨーロッパ）', value: 60 },
  { label: 'UTC+02:00（東ヨーロッパ）', value: 120 },
  { label: 'UTC+03:00（モスクワ）', value: 180 },
  { label: 'UTC+03:30（テヘラン）', value: 210 },
  { label: 'UTC+04:00（ドバイ）', value: 240 },
  { label: 'UTC+04:30（カブール）', value: 270 },
  { label: 'UTC+05:00（カラチ）', value: 300 },
  { label: 'UTC+05:30（インド）', value: 330 },
  { label: 'UTC+05:45（ネパール）', value: 345 },
  { label: 'UTC+06:00（ダッカ）', value: 360 },
  { label: 'UTC+06:30（ヤンゴン）', value: 390 },
  { label: 'UTC+07:00（バンコク）', value: 420 },
  { label: 'UTC+08:00（北京・シンガポール）', value: 480 },
  { label: 'UTC+08:45（ユークラ）', value: 525 },
  { label: 'UTC+09:00（日本標準時 JST）', value: 540 },
  { label: 'UTC+09:30（オーストラリア中部）', value: 570 },
  { label: 'UTC+10:00（オーストラリア東部）', value: 600 },
  { label: 'UTC+10:30（ロードハウ島）', value: 630 },
  { label: 'UTC+11:00（ソロモン諸島）', value: 660 },
  { label: 'UTC+12:00（ニュージーランド）', value: 720 },
  { label: 'UTC+12:45（チャタム諸島）', value: 765 },
  { label: 'UTC+13:00（トンガ）', value: 780 },
  { label: 'UTC+14:00（ライン諸島）', value: 840 },
]

type Props = {
  onBack: () => void
}

export function SettingsView({ onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState(() => getSettings())

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await readJSONFile(file)
      if (window.confirm('インポートすると既存データに上書きされます。続行しますか？')) {
        importData(data)
        window.location.reload()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'インポートに失敗しました')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOffset = Number(e.target.value)
    const updated = { ...settings, timezoneOffset: newOffset }
    setSettings(updated)
    saveSettings(updated)
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-slate-800 text-white safe-area-top">
        <button onClick={onBack} className="p-1 rounded hover:bg-slate-700 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-medium">設定</h1>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* 基準時刻 */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">基準時刻（タイムゾーン）</h2>
          <select
            value={settings.timezoneOffset}
            onChange={handleTimezoneChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {TIMEZONE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            現在時刻の表示や「今日」の判定に使用されます。
          </p>
        </section>

        {/* データの管理 */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">データの管理</h2>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => downloadJSON()}
            >
              <Download className="h-4 w-4" />
              JSONエクスポート
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              JSONインポート
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </section>

        {/* 投げ銭 */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">開発を応援する</h2>
          <p className="text-xs text-gray-500 mb-3">
            このアプリが役に立っていたら、ぜひ応援をお願いします！
          </p>
          <a
            href="https://crenoumenatory.booth.pm/items/8077092"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="justify-start gap-2 w-full">
              <ExternalLink className="h-4 w-4" />
              投げ銭する（BOOTH）
            </Button>
          </a>
        </section>
      </div>
    </div>
  )
}
