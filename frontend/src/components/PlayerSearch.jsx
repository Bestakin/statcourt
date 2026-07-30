import { useState, useEffect, useRef } from 'react'
import { searchPlayers } from '../api'
import Avatar from './Avatar'
import TeamBadge from './TeamBadge'

export default function PlayerSearch({ label, selectedPlayer, onSelect, align = 'left', seasonTeam, onDraftYearClick }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchPlayers(query)
        setResults(data.slice(0, 8))
      } catch (err) {
        console.error(err)
        setResults([])
      }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  if (selectedPlayer) {
    const displayTeam = seasonTeam || selectedPlayer.team_abbreviation
    return (
      <div
        key={selectedPlayer.id}
        className={`flex flex-col gap-3 animate-fade-in items-start text-left ${align === 'right' ? 'sm:items-end sm:text-right' : ''}`}
      >
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">{label}</span>
        <div className={`flex items-center gap-3 ${align === 'right' ? 'sm:flex-row-reverse' : ''}`}>
          <Avatar name={selectedPlayer.name} size={64} />
          <div>
            <div className="font-display text-2xl md:text-[1.7rem] text-ink-primary leading-tight">
              {selectedPlayer.name}
            </div>
            <div className={`flex items-center gap-2 mt-1 ${align === 'right' ? 'sm:flex-row-reverse' : ''}`}>
              {displayTeam && <TeamBadge abbr={displayTeam} />}
              <span className="text-sm text-ink-muted font-body">
                {selectedPlayer.position || '—'} · Drafted{' '}
                {selectedPlayer.draft_year && onDraftYearClick ? (
                  <button
                    onClick={() => onDraftYearClick(selectedPlayer.draft_year)}
                    className="underline underline-offset-2 hover:text-ball transition-colors"
                  >
                    {selectedPlayer.draft_year}
                  </button>
                ) : (
                  selectedPlayer.draft_year ?? '—'
                )}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onSelect(null)}
          className="text-xs text-ball hover:text-ink-primary transition-colors font-body underline underline-offset-2"
        >
          Change player
        </button>
      </div>
    )
  }

  return (
    <div className={`relative w-full max-w-xs ${align === 'right' ? 'sm:ml-auto' : ''}`}>
      <span className="text-xs uppercase tracking-widest text-ink-muted font-body block mb-2">{label}</span>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search a player…"
        className="w-full bg-court-surface border border-court-line rounded-md px-4 py-2.5 text-ink-primary placeholder-ink-faint font-body focus:border-ball outline-none"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-court-surface2 border border-court-line rounded-md overflow-hidden shadow-lg">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => { onSelect(p); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-court-line/50 text-left transition-colors"
              >
                <Avatar name={p.name} size={32} />
                <span className="font-body text-sm text-ink-primary">{p.name}</span>
                <span className="ml-auto text-xs text-ink-faint font-mono">{p.draft_year ?? '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
