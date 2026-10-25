import { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { GroupResults } from './GroupCompare'
import { listTeams, compareTeams } from '../teamApi'

// NBA starts-data is only reliable from 1981-82 on (season_year 1982); WNBA from its first season.
const RANGES = { WNBA: { earliest: 1997, current: 2026 }, NBA: { earliest: 1982, current: 2027 } }
const label = (league, y) => (league === 'NBA' ? `${y - 1}-${String(y).slice(-2)}` : String(y))
const n1 = (v) => (v == null ? '—' : v.toFixed(1))

function SeasonSlider({ title, colorClass, league, range, value, onChange }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <span className={`text-xs uppercase tracking-widest font-body shrink-0 ${colorClass}`}>{title}</span>
      <input type="range" min={range.earliest} max={range.current} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-ball" />
      <span className="font-mono tabular text-lg text-ball font-semibold w-20 text-right">{label(league, value)}</span>
    </div>
  )
}

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
            {t.name ? `${t.name} (${t.abbreviation})` : t.abbreviation}{t.usable ? '' : ' — data not reliable'}
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

function Fives({ data, league }) {
  const byA = Object.fromEntries(data.a.players.map((p) => [p.player_id, p]))
  const byB = Object.fromEntries(data.b.players.map((p) => [p.player_id, p]))
  const rows = Math.max(data.five_a.length, data.five_b.length)
  const titleA = `${data.name_a || data.team_a} · ${label(league, data.season_year)}`
  const titleB = `${data.name_b || data.team_b} · ${label(league, data.season_year_b)}`
  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mb-1">
        <div className="text-xs uppercase tracking-widest text-ball font-body">{titleA}</div>
        <div className="text-xs uppercase tracking-widest text-sky-400 font-body sm:text-right">{titleB}</div>
      </div>
      <div className="text-[11px] text-ink-muted font-body mb-3">The five players with the most starts</div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
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
  const [split, setSplit] = useState(false)        // compare two different seasons
  const [yearA, setYearA] = useState(range.current)
  const [yearB, setYearB] = useState(range.current)
  const [teamsA, setTeamsA] = useState([])
  const [teamsB, setTeamsB] = useState([])
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [teamsError, setTeamsError] = useState(null)
  const yb = split ? yearB : yearA

  useEffect(() => {
    setTeamA(''); setTeamB(''); setData(null); setError(null)
    setYearA((y) => Math.min(Math.max(y, range.earliest), range.current))
    setYearB((y) => Math.min(Math.max(y, range.earliest), range.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league])

  const loadTeams = (year, setTeams, setTeam) => {
    const ctl = new AbortController()
    setTeamsError(null)
    listTeams(league, year, ctl.signal)
      .then((res) => {
        setTeams(res.teams)
        const ok = new Set(res.teams.filter((t) => t.usable).map((t) => t.abbreviation))
        setTeam((t) => (ok.has(t) ? t : ''))
      })
      .catch((e) => { if (e.name !== 'AbortError') { setTeams([]); setTeamsError(e.message) } })
    return () => ctl.abort()
  }
  useEffect(() => loadTeams(yearA, setTeamsA, setTeamA), [league, yearA]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => loadTeams(yb, setTeamsB, setTeamB), [league, yb]) // eslint-disable-line react-hooks/exhaustive-deps

  const ready = teamA && teamB && !(teamA === teamB && yearA === yb)
  useEffect(() => {
    if (!ready) { setData(null); setError(null); return }
    const ctl = new AbortController()
    setLoading(true); setError(null)
    compareTeams({ league, year: yearA, yearB: yb, a: teamA, b: teamB }, ctl.signal)
      .then(setData)
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setData(null) } })
      .finally(() => setLoading(false))
    return () => ctl.abort()
  }, [league, yearA, yb, teamA, teamB, ready])

  const sameSeason = yearA === yb
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">Team Comparison · {league}</span>
        <button onClick={onClose} className="text-xs text-ink-faint hover:text-ink-primary transition-colors font-body">Close ✕</button>
      </div>

      <div className="border-t border-b border-court-line mb-6">
        {split ? (
          <>
            <SeasonSlider title="Team A season" colorClass="text-ball" league={league} range={range} value={yearA} onChange={setYearA} />
            <SeasonSlider title="Team B season" colorClass="text-sky-400" league={league} range={range} value={yearB} onChange={setYearB} />
          </>
        ) : (
          <SeasonSlider title="Season" colorClass="text-ink-muted" league={league} range={range} value={yearA} onChange={setYearA} />
        )}
        <div className="pb-3 flex justify-center">
          <button onClick={() => { if (!split) setYearB(yearA); setSplit(!split) }}
            className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-body transition-colors ${
              split ? 'bg-ball text-court-bg font-semibold' : 'bg-court-surface2 text-ink-muted hover:text-ink-primary'
            }`}>
            {split ? 'Different seasons: on' : 'Compare different seasons'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <TeamSelect title="Team A" colorClass="text-ball" value={teamA} onChange={setTeamA} teams={teamsA} otherValue={sameSeason ? teamB : ''} />
        <TeamSelect title="Team B" colorClass="text-sky-400" value={teamB} onChange={setTeamB} teams={teamsB} otherValue={sameSeason ? teamA : ''} />
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
          <Fives data={data} league={league} />
          <GroupResults data={data} hidePlayers
            nameA={`${data.team_a}${sameSeason ? '' : ' ' + label(league, data.season_year)}`}
            nameB={`${data.team_b}${sameSeason ? '' : ' ' + label(league, data.season_year_b)}`} />
          <p className="text-xs text-ink-muted font-body mt-5 leading-relaxed">{data.note}</p>
        </div>
      )}
    </div>
  )
}
