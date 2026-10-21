import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import { getAwardCatalog, getAwardHistory } from '../awardsApi'

// Year-by-year winners for each award in the chosen league.
// onPick(playerId, seasonYear) drops a winner into the Head-to-Head view.
export default function AwardsPage({ league, onPick, onClose }) {
  const [catalog, setCatalog] = useState([])
  const [award, setAward] = useState(null)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setCatalog([]); setAward(null); setHistory(null); setError(null)
    getAwardCatalog(league, ctrl.signal)
      .then((c) => { setCatalog(c); if (c.length) setAward(c[0].key) })
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message) })
    return () => ctrl.abort()
  }, [league])

  useEffect(() => {
    if (!award) return
    const ctrl = new AbortController()
    setLoading(true); setError(null)
    getAwardHistory(league, award, ctrl.signal)
      .then(setHistory)
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message) })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [league, award])

  const info = catalog.find((c) => c.key === award)

  // Count wins per player so repeat winners are easy to spot.
  const wins = {}
  history?.winners.forEach((w) => { wins[w.player_name] = (wins[w.player_name] || 0) + 1 })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl text-ink-primary">Awards · {league}</h2>
        <button onClick={onClose} className="text-xs text-ball hover:text-ink-primary font-body underline underline-offset-2">
          ← Back to Head to Head
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {catalog.map((c) => (
          <button
            key={c.key}
            onClick={() => setAward(c.key)}
            className={`px-3 py-1 rounded-full text-[11px] font-body transition-colors ${
              award === c.key ? 'bg-ball text-court-bg font-semibold' : 'bg-court-surface2 text-ink-muted hover:text-ink-primary'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {info && (
        <p className="text-[11px] text-ink-faint font-body mb-3">
          {info.count} winners · {info.first_season}–{info.last_season}. Tap “Compare” to load a winner into Head to Head for that season.
        </p>
      )}

      {error && <p className="text-red-400 font-body text-sm py-4">{error}</p>}
      {loading && !history && <p className="text-ink-muted font-body text-sm py-4">Loading…</p>}

      {history && (
        <ul className="divide-y divide-court-line border border-court-line rounded-lg overflow-hidden">
          {history.winners.map((w) => (
            <li key={`${w.season_year}-${w.player_name}`} className="flex items-center gap-3 px-3 py-2 bg-court-surface2/40">
              <span className="font-mono tabular text-sm text-ball w-12 shrink-0">{w.season_year}</span>
              <Avatar name={w.player_name} size={24} />
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm text-ink-primary truncate">
                  {w.player_name}
                  {wins[w.player_name] > 1 && (
                    <span className="ml-2 text-[10px] text-ink-faint">{wins[w.player_name]}× winner</span>
                  )}
                  {w.is_tie && <span className="ml-2 text-[10px] text-ink-faint">(tie)</span>}
                </p>
                {w.team_abbreviation && <p className="text-[10px] text-ink-faint font-mono">{w.team_abbreviation}</p>}
              </div>
              {w.player_id && (
                <button
                  onClick={() => onPick(w.player_id, w.season_year)}
                  className="text-[10px] text-ball border border-ball rounded-md px-2 py-1 font-body hover:bg-ball hover:text-court-bg transition-colors shrink-0"
                >
                  Compare
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
