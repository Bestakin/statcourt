import { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { getDraftClass } from '../api'

export default function DraftClassExplorer({ year, onSelectPlayer, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!year) return
    setData(null)
    setError(null)
    getDraftClass(year)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [year])

  if (!year) return null

  return (
    <div className="mt-8 pt-6 border-t border-court-line">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">
          {year} Draft Class
        </span>
        <button
          onClick={onClose}
          className="text-xs text-ink-faint hover:text-ink-primary transition-colors font-body"
        >
          Close ✕
        </button>
      </div>
      <p className="text-[10px] text-ink-faint font-body italic mb-3">
        Ordered by career games played, we don't have actual draft pick order, this isn't it.
      </p>

      {error ? (
        <p className="text-sm text-red-400 font-body">{error}</p>
      ) : !data ? (
        <p className="text-sm text-ink-muted font-body">Loading…</p>
      ) : data.count === 0 ? (
        <p className="text-sm text-ink-muted font-body">No players found for {year}.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {data.players.map((dp, i) => (
            <button
              key={dp.player.id}
              onClick={() => onSelectPlayer(dp.player)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-court-surface2 transition-colors text-left"
            >
              <span className="text-xs font-mono text-ink-faint w-5 shrink-0 tabular">{i + 1}</span>
              <Avatar name={dp.player.name} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-primary font-body truncate">{dp.player.name}</div>
                <div className="text-[10px] text-ink-faint font-mono tabular">
                  {dp.career_ppg != null ? `${dp.career_ppg} PPG · ` : ''}{dp.career_games} GP
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
