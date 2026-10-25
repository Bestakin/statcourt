import { useState, useEffect } from 'react'
import TeamBadge, { WNBA_TEAM_NAMES, NBA_TEAM_NAMES } from './TeamBadge'
import { getPlayerSeasonHistory } from '../api'
import { seasonLabel } from '../seasonLabel'

const CURRENT_YEAR = 2026

function computeStints(history) {
  const withTeam = history.filter((s) => s.team_abbreviation).sort((a, b) => a.season_year - b.season_year)
  if (withTeam.length === 0) return []
  const stints = [{ team: withTeam[0].team_abbreviation, start: withTeam[0].season_year, end: withTeam[0].season_year }]
  for (let i = 1; i < withTeam.length; i++) {
    const s = withTeam[i]
    const last = stints[stints.length - 1]
    if (s.team_abbreviation === last.team) last.end = s.season_year
    else stints.push({ team: s.team_abbreviation, start: s.season_year, end: s.season_year })
  }
  return stints
}

function StintRow({ stint, isLast, playerStillActive, league }) {
  const names = league === 'NBA' ? NBA_TEAM_NAMES : WNBA_TEAM_NAMES
  const fullName = names[stint.team] || stint.team
  const endLabel = isLast && playerStillActive ? 'Present' : seasonLabel(league, stint.end)
  const sep = league === 'NBA' ? ' to ' : '–'
  const yearRange = stint.start === stint.end && !(isLast && playerStillActive)
    ? seasonLabel(league, stint.start)
    : `${seasonLabel(league, stint.start)}${sep}${endLabel}`
  return (
    <div className="flex items-center gap-3 py-1.5">
      <TeamBadge abbr={stint.team} league={league} />
      <span className="text-sm text-ink-primary font-body">{fullName}</span>
      <span className="text-xs text-ink-faint font-mono tabular ml-auto">{yearRange}</span>
    </div>
  )
}

export default function TeamHistory({ player }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    if (!player) return
    setHistory(null)
    getPlayerSeasonHistory(player.id).then(setHistory).catch((err) => console.error('Could not load team history:', err))
  }, [player])

  if (!history) return null
  const stints = computeStints(history)
  if (stints.length === 0) return null
  const playerStillActive = player.last_active_year >= CURRENT_YEAR

  return (
    <div>
      <span className="text-xs uppercase tracking-widest text-ink-muted font-body block mb-2">{player.name}'s Team History</span>
      <div className="divide-y divide-court-line/50">
        {stints.map((stint, i) => (
          <StintRow
            key={`${stint.team}-${stint.start}`}
            stint={stint}
            isLast={i === stints.length - 1}
            playerStillActive={playerStillActive}
            league={player.league}
          />
        ))}
      </div>
    </div>
  )
}
