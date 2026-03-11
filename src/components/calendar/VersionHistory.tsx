import type { IdealSnapshot } from '@/types'

type Props = {
  snapshots: IdealSnapshot[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function VersionHistory({ snapshots, selectedId, onSelect }: Props) {
  if (snapshots.length === 0) {
    return (
      <div className="text-xs text-slate-400 text-center py-2">
        履歴がありません
      </div>
    )
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-1">
      <button
        className={`flex-shrink-0 text-xs px-2 py-1 rounded border ${
          selectedId === null
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-600 border-slate-300'
        }`}
        onClick={() => onSelect(null)}
      >
        最新
      </button>
      {snapshots.map((snap) => (
        <button
          key={snap.id}
          className={`flex-shrink-0 text-xs px-2 py-1 rounded border ${
            selectedId === snap.id
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-600 border-slate-300'
          }`}
          onClick={() => onSelect(snap.id)}
        >
          {formatSavedAt(snap.savedAt)}
        </button>
      ))}
    </div>
  )
}
