import { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { getSimilarPlayers } from '../api'

export default function SimilarPlayers({ playerId, playerName, onSelectPlayer }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    if (!playerId) return
    setData(null)
    setError(null)
    getSimilarPlayers(playerId, 5)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [playerId])

  if (error) return null // small sample size etc — fail quietly, not a core feature
  if (!data) return null

  return (
    <div className="mt-8 pt-6 border-t border-court-line">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">
          Most Similar to {playerName}
        </span>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-ink-faint hover:text-ink-primary text-xs leading-none"
          aria-label="More info"
        >
          ⓘ
        </button>
      </div>
      {showInfo && (
        <p className="text-[10px] text-ink-faint font-body text-right mb-2">
          Based on standardized career statistics.
        </p>
      )}
      <div className="space-y-2 mt-2">
        {data.results.map((r) => (
          <button
            key={r.player.id}
            onClick={() => onSelectPlayer && onSelectPlayer(r.player)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-court-surface2 transition-colors text-left"
          >
            <span className="font-mono tabular text-sm text-ball font-semibold w-12 shrink-0">
              {r.similarity_pct.toFixed(0)}%
            </span>
            <Avatar name={r.player.name} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink-primary font-body truncate">{r.player.name}</div>
              <div className="text-xs text-ink-faint font-mono tabular">
                {r.ppg} PPG · {r.rpg} RPG · {r.apg} APG
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
