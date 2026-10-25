import { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { GroupResults } from './GroupCompare'
import { listTeams, compareTeams } from '../teamApi'

// NBA starts-data is only reliable from 1981-82 on (season_year 1982); WNBA from its first season.
const RANGES = { WNBA: { earliest: 1997, current: 2026 }, NBA: { earliest: 1982, current: 2026 } }
const label = (league, y) => (league === 'NBA' ? `${y - 1}-${String(y).slice(-2)}` : String(y))
const n1 = (v) => (v == null ? '—' : v.toFixed(1))

function TeamSelect({ title, colorClass, value, onChange, teams, otherValue }) {
  return (
    <div>
      <div className={`text-xs uppercase tracking-widest font-body mb-2 ${colorClass}`}>{title}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-court-surface border border-court-line rounded-md px-3 py-2 text-sm text-ink-primary font-body focus:border-ball outline-none">
        <option value="">Choose a team…</option>
        {teams.map((t) => (
          <option key={t.abbreviation} value={t.abbreviation}
            disabled={!t.usable || t.abbreviation === otherValue}>
            {t.abbreviation}{t.usable ? '' : ' — data not reliable'}
          </option>
        ))}
      </select>
    </div>
  )
}

function FiveCell({ f, line, align }) {
  if (!f) return <div />
  return (
    <div className={`flex items-center gap-3 min-w-0 ${align === 'right' ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
      <Avatar name={f.name} size={32} />
      <div className="min-w-0">
        <div className="text-sm text-ink-primary font-body truncate">{f.name}</div>
        <div className="text-[11px] text-ink-muted font-mono tabular">
          {f.games_started} {f.games_started === 1 ? 'start' : 'starts'} · {f.games_played} gp
          {line ? ` · ${n1(line.per_game.pts)} pts / ${n1(line.per_game.reb)} reb / ${n1(line.per_game.ast)} ast` : ''}
        </div>
      </div>
    </div>
  )
}

function Fives({ data, nameA, nameB }) {
  const byA = Object.fromEntries(data.a.players.map((p) => [p.player_id, p]))
  const byB = Object.fromEntries(data.b.players.map((p) => [p.player_id, p]))
  const rows = Math.max(data.five_a.length, data.five_b.length)
  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mb-2">
        <div className="text-xs uppercase tracking-widest text-ball font-body">{nameA} · most starts</div>
        <div className="text-xs uppercase tracking-widest text-sky-400 font-body sm:text-right">{nameB} · most starts</div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 relative">
            <FiveCell f={data.five_a[i]} line={data.five_a[i] && byA[data.five_a[i].player_id]} align="left" />
            <FiveCell f={data.five_b[i]} line={data.five_b[i] && byB[data.five_b[i].player_id]} align="right" />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-muted font-body mt-3">
        Players are lined up by games started (1st most starts vs 1st most starts), not by position.
      </p>
    </div>
  )
}

export default function TeamCompare({ league, onClose }) {
  const range = RANGES[league] || RANGES.WNBA
  const [year, setYear] = useState(range.current)
  const [teams, setTeams] = useState([])
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [teamsError, setTeamsError] = useState(null)

  useEffect(() => {
    setTeamA(''); setTeamB(''); setData(null); setError(null)
    setYear((y) => Math.min(Math.max(y, range.earliest), range.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league])

  useEffect(() => {
    const ctl = new AbortController()
    setTeamsError(null)
    listTeams(league, year, ctl.signal)
      .then((res) => {
        setTeams(res.teams)
        const ok = new Set(res.teams.filter((t) => t.usable).map((t) => t.abbreviation))
        setTeamA((t) => (ok.has(t) ? t : ''))
        setTeamB((t) => (ok.has(t) ? t : ''))
      })
      .catch((e) => { if (e.name !== 'AbortError') { setTeams([]); setTeamsError(e.message) } })
    return () => ctl.abort()
  }, [league, year])

  const ready = teamA && teamB && teamA !== teamB
  useEffect(() => {
    if (!ready) { setData(null); setError(null); return }
    const ctl = new AbortController()
    setLoading(true); setError(null)
    compareTeams({ league, year, a: teamA, b: teamB }, ctl.signal)
      .then(setData)
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setData(null) } })
      .finally(() => setLoading(false))
    return () => ctl.abort()
  }, [league, year, teamA, teamB, ready])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">Team Comparison · {league}</span>
        <button onClick={onClose} className="text-xs text-ink-faint hover:text-ink-primary transition-colors font-body">Close ✕</button>
      </div>

      <div className="flex items-center gap-4 mb-6 border-t border-b border-court-line py-3">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body shrink-0">Season</span>
        <input type="range" min={range.earliest} max={range.current} value={year}
          onChange={(e) => setYear(Number(e.target.value))} className="flex-1 accent-ball" />
        <span className="font-mono tabular text-lg text-ball font-semibold w-20 text-right">{label(league, year)}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <TeamSelect title="Team A" colorClass="text-ball" value={teamA} onChange={setTeamA} teams={teams} otherValue={teamB} />
        <TeamSelect title="Team B" colorClass="text-sky-400" value={teamB} onChange={setTeamB} teams={teams} otherValue={teamA} />
      </div>

      {teamsError ? (
        <p className="text-center text-red-400 font-body py-6 text-sm">{teamsError}</p>
      ) : !ready ? (
        <p className="text-center text-ink-faint font-body py-6 text-sm">
          Pick two teams to compare their five players with the most games started.
          {league === 'NBA' ? ' NBA seasons start at 1981-82, the first year starts were recorded.' : ''}
        </p>
      ) : error ? (
        <p className="text-center text-red-400 font-body py-6 text-sm">{error}</p>
      ) : !data ? (
        <p className="text-center text-ink-muted font-body py-6 text-sm">Loading…</p>
      ) : (
        <div className={`transition-opacity duration-200 ${loading ? 'opacity-60' : 'opacity-100'}`}>
          <Fives data={data} nameA={data.team_a} nameB={data.team_b} />
          <GroupResults data={data} nameA={data.team_a} nameB={data.team_b} hidePlayers />
          <p className="text-xs text-ink-muted font-body mt-5 leading-relaxed">{data.note}</p>
        </div>
      )}
    </div>
  )
}
