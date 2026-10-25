import { useState, useEffect, useRef } from 'react'
import Avatar from './Avatar'
import { seasonLabel } from '../seasonLabel'
import { searchPlayersForGroup, compareGroups } from '../groupApi'

const RANGES = { WNBA: { earliest: 1997, current: 2026 }, NBA: { earliest: 1950, current: 2026 } }
const MAX = 5

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const num1 = (v) => (v == null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1))

// ---------- one diverging row: A value | label | B value, with a share bar ----------
function Row({ label, a, b, fmt = num1, sub }) {
  const hasBoth = a != null && b != null && a + b > 0
  const aShare = hasBoth ? (a / (a + b)) * 100 : 50
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono tabular text-lg text-ink-primary w-24 text-left">{fmt(a)}</span>
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body text-center">{label}</span>
        <span className="font-mono tabular text-lg text-ink-primary w-24 text-right">{fmt(b)}</span>
      </div>
      {sub && (
        <div className="flex justify-between text-[11px] text-ink-muted font-mono tabular">
          <span>{sub[0]}</span><span>{sub[1]}</span>
        </div>
      )}
      <div className="flex h-1.5 mt-1.5 rounded-full overflow-hidden bg-court-surface2">
        {hasBoth && (
          <>
            <div className="bg-ball transition-all duration-300" style={{ width: `${aShare}%` }} />
            <div className="bg-sky-400 transition-all duration-300" style={{ width: `${100 - aShare}%` }} />
          </>
        )}
      </div>
    </div>
  )
}

function PlayerCards({ side, align }) {
  return (
    <div className={`space-y-2 ${align === 'right' ? 'sm:text-right' : ''}`}>
      {side.players.map((p) => (
        <div key={p.player_id}
          className={`flex items-center gap-3 ${align === 'right' ? 'sm:flex-row-reverse' : ''}`}>
          <Avatar name={p.name} size={32} />
          <div className="min-w-0">
            <div className="text-sm text-ink-primary font-body truncate">{p.name}</div>
            <div className="text-[11px] text-ink-muted font-mono tabular">
              {p.games} {p.games === 1 ? 'game' : 'games'} · {num1(p.per_game.pts)} pts / {num1(p.per_game.reb)} reb / {num1(p.per_game.ast)} ast
              {p.share_of_group_pts != null ? ` · scored ${p.share_of_group_pts}% of the group’s points` : ''}
            </div>
          </div>
        </div>
      ))}
      {side.excluded.map((msg) => (
        <p key={msg} className="text-[11px] text-ink-muted font-body italic">Not counted — {msg}</p>
      ))}
    </div>
  )
}

const VIEWS = [
  { key: 'combined_per_game', label: 'Combined per game',
    help: 'Adds up each player’s own per-game average. It’s a sum of individual averages, not a prediction of how they’d perform together.' },
  { key: 'per_player_game', label: 'Avg per player',
    help: 'Total production ÷ total games played by the group’s players: the average line of one player in one game.' },
  { key: 'season_totals', label: 'Totals',
    help: 'Exact totals added together across everyone in the group.' },
]

export function GroupResults({ data, nameA = 'Group A', nameB = 'Group B' }) {
  const A = data.a.totals
  const B = data.b.totals
  // Combined and Totals add players up, so they favour the bigger group; Avg per player and the
  // pooled percentages stay comparable. Default to the fair view whenever the sizes differ.
  const sizesDiffer = A.players !== B.players
  const [view, setView] = useState(sizesDiffer ? 'per_player_game' : 'combined_per_game')
  useEffect(() => {
    setView(sizesDiffer ? 'per_player_game' : 'combined_per_game')
  }, [sizesDiffer])
  const isCareer = data.mode === 'career'
  const stats = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK'], ['tov', 'TOV']]

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-ball font-body mb-2">{nameA}</div>
          <PlayerCards side={data.a} align="left" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-sky-400 font-body mb-2 sm:text-right">{nameB}</div>
          <PlayerCards side={data.b} align="right" />
        </div>
      </div>

      {sizesDiffer && (
        <p className="text-xs text-ink-primary/80 font-body bg-court-surface2 rounded-md px-3 py-2 mb-4">
          {nameA} has {A.players} {A.players === 1 ? 'player' : 'players'} and {nameB} has {B.players}.
          “Combined per game” and “Totals” add players up, so they favour the bigger group. “Avg per player” and
          the shooting percentages are comparable, so that’s where this view starts.
        </p>
      )}

      {(A.uneven_games || B.uneven_games) && (
        <p className="text-xs text-ink-primary/80 font-body bg-court-surface2 rounded-md px-3 py-2 mb-4">
          Heads up: one player in {A.uneven_games && B.uneven_games ? 'each group' : A.uneven_games ? nameA : nameB} played
          far fewer games than the others. “Combined per game” assumes everyone plays together, so check “Avg per
          player” or “Totals” for a fairer picture.
        </p>
      )}

      <div className="flex justify-center gap-2 mb-2 flex-wrap">
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)} title={v.help}
            className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-body transition-colors ${
              view === v.key ? 'bg-ball text-court-bg font-semibold' : 'bg-court-surface2 text-ink-muted hover:text-ink-primary'
            }`}>
            {v.key === 'season_totals' && isCareer ? 'Career totals' : v.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted font-body text-center mb-2 px-2">
        {VIEWS.find((v) => v.key === view).help.replace('Exact totals', isCareer ? 'Exact career totals' : 'Exact season totals')}
      </p>
      <div className="border-t border-court-line mt-3 pt-2">
        {stats.map(([k, label]) => (
          <Row key={k} label={label} a={A[view][k]} b={B[view][k]} />
        ))}
      </div>

      <div className="text-xs uppercase tracking-widest text-ink-muted font-body text-center mt-6 mb-1">
        Shooting (made ÷ attempted, all players pooled)
      </div>
      <div className="border-t border-court-line pt-2">
        <Row label="FG%" a={A.fg_pct} b={B.fg_pct} fmt={pct} sub={[`${A.fg}/${A.fga}`, `${B.fg}/${B.fga}`]} />
        <Row label="3P%" a={A.fg3_pct} b={B.fg3_pct} fmt={pct}
          sub={[A.fg3a != null ? `${A.fg3}/${A.fg3a}` : '', B.fg3a != null ? `${B.fg3}/${B.fg3a}` : '']} />
        <Row label="FT%" a={A.ft_pct} b={B.ft_pct} fmt={pct} sub={[`${A.ft}/${A.fta}`, `${B.ft}/${B.fta}`]} />
        <Row label="eFG%" a={A.efg_pct} b={B.efg_pct} fmt={pct} />
        <Row label="TS%" a={A.ts_pct} b={B.ts_pct} fmt={pct} />
      </div>

      {stats.some(([k]) => A[view][k] == null || B[view][k] == null) && (
        <p className="text-xs text-ink-muted font-body mt-3">
          “—” means that stat wasn’t officially tracked in that era (steals, blocks and turnovers only appear in the
          record books from the mid-1970s).
        </p>
      )}

      <p className="text-xs text-ink-muted font-body mt-5 leading-relaxed">
        Percentages are rebuilt from total makes ÷ total attempts across everyone in the group, never an average of
        individual percentages. eFG% and TS% are derived from those totals. There is no group “score” here, just the
        numbers, side by side. A longer bar means a bigger number, not necessarily a better one (for turnovers, lower is better).
      </p>
    </div>
  )
}

// ---------- player picker for one side ----------
function GroupPicker({ title, accent, colorClass, players, onChange, league, takenIds }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const ctl = new AbortController()
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const data = await searchPlayersForGroup(query.trim(), league, ctl.signal)
        setResults(data.filter((p) => !takenIds.includes(p.id)).slice(0, 6))
      } catch (e) {
        if (e.name !== 'AbortError') setResults([])
      }
    }, 250)
    return () => { clearTimeout(timer.current); ctl.abort() }
  }, [query, league, takenIds])

  const full = players.length >= MAX
  return (
    <div className="relative">
      <div className={`text-xs uppercase tracking-widest font-body mb-2 ${colorClass}`}>
        {title} · {players.length} {players.length === 1 ? 'player' : 'players'}
        <span className="text-ink-muted normal-case tracking-normal ml-2">
          {players.length < 2 ? `add at least ${2 - players.length} more` : players.length < MAX ? `add up to ${MAX - players.length} more` : 'group is full'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {players.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5 bg-court-surface2 border border-court-line rounded-full pl-1 pr-2 py-0.5">
            <Avatar name={p.name} size={20} />
            <span className="text-xs text-ink-primary font-body">{p.name}</span>
            <button onClick={() => onChange(players.filter((x) => x.id !== p.id))}
              className="text-ink-faint hover:text-ink-primary text-xs leading-none" aria-label={`Remove ${p.name}`}>✕</button>
          </span>
        ))}
      </div>
      {!full && (
        <>
          <input type="text" value={query} placeholder="Add a player…"
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            className="w-full bg-court-surface border border-court-line rounded-md px-3 py-2 text-sm text-ink-primary placeholder-ink-faint font-body focus:border-ball outline-none" />
          {open && results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-court-surface2 border border-court-line rounded-md overflow-hidden shadow-lg">
              {results.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { onChange([...players, p]); setQuery(''); setResults([]); setOpen(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-court-line/50 text-left transition-colors">
                    <Avatar name={p.name} size={24} />
                    <span className="text-sm text-ink-primary font-body">{p.name}</span>
                    <span className="ml-auto text-xs text-ink-faint font-mono">{p.draft_year ?? '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function GroupCompare({ league, onClose }) {
  const range = RANGES[league] || RANGES.WNBA
  const [sideA, setSideA] = useState([])
  const [sideB, setSideB] = useState([])
  const [mode, setMode] = useState('season')
  const [year, setYear] = useState(range.current)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // switching league invalidates both groups
  useEffect(() => {
    setSideA([]); setSideB([]); setData(null); setError(null)
    setYear((y) => Math.min(Math.max(y, range.earliest), range.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league])

  const ready = sideA.length >= 2 && sideB.length >= 2
  useEffect(() => {
    if (!ready) { setData(null); setError(null); return }
    const ctl = new AbortController()
    setLoading(true); setError(null)
    compareGroups({ a: sideA.map((p) => p.id), b: sideB.map((p) => p.id), mode, year }, ctl.signal)
      .then(setData)
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setData(null) } })
      .finally(() => setLoading(false))
    return () => ctl.abort()
  }, [sideA, sideB, mode, year, ready])

  const allIds = [...sideA, ...sideB].map((p) => p.id)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">Group Comparison · {league}</span>
        <button onClick={onClose} className="text-xs text-ink-faint hover:text-ink-primary transition-colors font-body">Close ✕</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <GroupPicker title="Group A" colorClass="text-ball" players={sideA} onChange={setSideA} league={league} takenIds={allIds} />
        <GroupPicker title="Group B" colorClass="text-sky-400" players={sideB} onChange={setSideB} league={league} takenIds={allIds} />
      </div>

      <div className="flex justify-center gap-2 mb-4">
        {['season', 'career'].map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-body transition-colors ${
              mode === m ? 'bg-ball text-court-bg font-semibold' : 'bg-court-surface2 text-ink-muted hover:text-ink-primary'
            }`}>
            {m === 'season' ? 'Single Season' : 'Career'}
          </button>
        ))}
      </div>

      {mode === 'season' && (
        <div className="flex items-center gap-4 mb-6 border-t border-b border-court-line py-3">
          <span className="text-xs uppercase tracking-widest text-ink-muted font-body shrink-0">Season</span>
          <input type="range" min={range.earliest} max={range.current} value={year}
            onChange={(e) => setYear(Number(e.target.value))} className="flex-1 accent-ball" />
          <span className="font-mono tabular text-lg text-ball font-semibold w-24 text-right">{seasonLabel(league, year)}</span>
        </div>
      )}

      {!ready ? (
        <p className="text-center text-ink-faint font-body py-6 text-sm">
          Add at least 2 players to each group to compare them.
        </p>
      ) : error ? (
        <p className="text-center text-red-400 font-body py-6 text-sm">{error}</p>
      ) : !data ? (
        <p className="text-center text-ink-muted font-body py-6 text-sm">Loading…</p>
      ) : (
        <div className={`transition-opacity duration-200 ${loading ? 'opacity-60' : 'opacity-100'}`}>
          <GroupResults data={data} />
        </div>
      )}
    </div>
  )
}