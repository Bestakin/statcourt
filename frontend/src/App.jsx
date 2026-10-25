import { useState, useEffect } from 'react'
import PlayerSearch from './components/PlayerSearch'
import StatBar from './components/StatBar'
import CompositePanel from './components/CompositePanel'
import AdvancedRadar from './components/AdvancedRadar'
import HighlightBadges from './components/HighlightBadges'
import EmptyStateCard from './components/EmptyStateCard'
import SimilarPlayers from './components/SimilarPlayers'
import PlayerDevelopment from './components/PlayerDevelopment'
import TeamHistory from './components/TeamHistory'
import DraftClassExplorer from './components/DraftClassExplorer'
import SeasonFinder from './components/SeasonFinder'
import GroupCompare from './components/GroupCompare'
import AwardsPage from './components/AwardsPage'
import TeamCompare from './components/TeamCompare'
import Logo from './components/Logo'
import AwardBadges from './components/AwardBadges'
import RecentSearches from './components/RecentSearches'
import { comparePlayers, getPlayer, getCareerAverages } from './api'
import { addRecentSearch } from './recentSearches'
import { seasonLabel } from './seasonLabel'

// Per-league season ranges, based on what we actually seeded. NBA's early
// BAA years (1947-49) aren't in the data - Basketball-Reference files
// those under a different league identifier, so 1950 is the real floor.
const LEAGUE_RANGES = {
  WNBA: { earliest: 1997, current: 2026 },
  NBA: { earliest: 1950, current: 2026 },
}

function SidePanel({ playerId, side, highlights, seasonYear, align, onJumpToSeason, mode, league }) {
  return (
    <div className="mt-1">
      {mode === 'season' && (side.status !== 'active' || !side.stats) ? (
        <EmptyStateCard status={side.status} name={side.player.name} year={seasonLabel(league, seasonYear)} align={align} />
      ) : null}
      {mode === 'career' && <HighlightBadges highlights={highlights} onJumpToSeason={onJumpToSeason} league={league} />}
      <AwardBadges playerId={playerId} seasonYear={mode === 'season' ? seasonYear : null} align={align} league={league} />
    </div>
  )
}

// Reads/writes p1, p2, year, league as URL query params so a comparison
// can be shared.
function readParamsFromURL() {
  const params = new URLSearchParams(window.location.search)
  return {
    p1: params.get('p1'),
    p2: params.get('p2'),
    year: params.get('year'),
    mode: params.get('mode'),
    league: params.get('league'),
  }
}

function writeParamsToURL({ p1, p2, year, mode, league }) {
  const params = new URLSearchParams()
  if (p1) params.set('p1', p1)
  if (p2) params.set('p2', p2)
  if (year) params.set('year', year)
  if (mode) params.set('mode', mode)
  if (league) params.set('league', league)
  const newUrl = `${window.location.pathname}?${params.toString()}`
  window.history.replaceState({}, '', newUrl)
}

export default function App() {
  const [league, setLeague] = useState('WNBA')

  const [player1, setPlayer1] = useState(null)
  const [player2, setPlayer2] = useState(null)
  const [seasonYear, setSeasonYear] = useState(LEAGUE_RANGES.WNBA.current)
  const [mode, setMode] = useState('season') // 'season' | 'career'

  const [comparison, setComparison] = useState(null)
  const [career1, setCareer1] = useState(null)
  const [career2, setCareer2] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hydrating, setHydrating] = useState(true)

  const [recentRefresh, setRecentRefresh] = useState(0)

  // On first load, try to restore a shared comparison from the URL.
  useEffect(() => {
    const { p1, p2, year, mode: urlMode, league: urlLeague } = readParamsFromURL()
    if (urlMode === 'career' || urlMode === 'season') setMode(urlMode)
    if (urlLeague === 'WNBA' || urlLeague === 'NBA') setLeague(urlLeague)
    if (year) setSeasonYear(Number(year))

    if (p1 && p2) {
      Promise.all([getPlayer(p1), getPlayer(p2)])
        .then(([p1Data, p2Data]) => {
          setPlayer1(p1Data)
          setPlayer2(p2Data)
          // Trust the restored player's own league over the URL param,
          // in case they ever disagree.
          if (p1Data.league) setLeague(p1Data.league)
        })
        .catch((err) => console.error('Could not restore shared comparison:', err))
        .finally(() => setHydrating(false))
    } else {
      setHydrating(false)
    }
  }, [])

  // Keep the URL in sync whenever the selection changes, so the current
  // view is always shareable via the address bar.
  useEffect(() => {
    if (hydrating) return
    writeParamsToURL({
      p1: player1?.id, p2: player2?.id, year: seasonYear, mode, league,
    })
  }, [player1, player2, seasonYear, mode, league, hydrating])

  // Switching league starts a fresh comparison - old player IDs belong to
  // a different pool and would be confusing to leave selected. Also reset
  // the season slider to the new league's current year, since a year that
  // was valid for one league's range might not be for the other's.
  const switchLeague = (newLeague) => {
    if (newLeague === league) return
    setLeague(newLeague)
    setPlayer1(null)
    setPlayer2(null)
    setComparison(null)
    setCareer1(null)
    setCareer2(null)
    setSeasonYear(LEAGUE_RANGES[newLeague].current)
  }

  useEffect(() => {
    if (hydrating || !player1 || !player2) return
    setLoading(true)
    setError(null)

    const tasks = [comparePlayers(player1.id, player2.id, seasonYear)]
    if (mode === 'career') {
      tasks.push(getCareerAverages(player1.id), getCareerAverages(player2.id))
    }

    Promise.all(tasks)
      .then(([compareData, c1, c2]) => {
        setComparison(compareData)
        if (mode === 'career') {
          setCareer1(c1)
          setCareer2(c2)
        }

        // Record this comparison for the Recent Searches panel.
        const label = mode === 'career'
          ? `${player1.name} vs ${player2.name} (Career)`
          : `${player1.name} vs ${player2.name} (${seasonLabel(league, seasonYear)})`
        addRecentSearch({
          id: `compare-${player1.id}-${player2.id}-${mode}-${mode === 'season' ? seasonYear : ''}`,
          type: 'compare',
          label,
          state: { p1: player1.id, p2: player2.id, year: seasonYear, mode },
        })
        setRecentRefresh((n) => n + 1)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [player1, player2, seasonYear, mode, hydrating])

  const bothActive = comparison?.player_1.status === 'active' && comparison?.player_2.status === 'active'
  const s1 = comparison?.player_1.stats
  const s2 = comparison?.player_2.stats

  const seasonStatRows = [
    { key: 'pts', label: 'PTS' },
    { key: 'reb', label: 'REB' },
    { key: 'ast', label: 'AST' },
    { key: 'stl', label: 'STL' },
    { key: 'blk', label: 'BLK' },
    { key: 'tov', label: 'TOV' },
  ]

  const careerStatRows = [
    { key: 'ppg', label: 'PPG' },
    { key: 'rpg', label: 'RPG' },
    { key: 'apg', label: 'APG' },
    { key: 'spg', label: 'SPG' },
    { key: 'bpg', label: 'BPG' },
  ]

  const jumpToSeason = (year) => {
    setMode('season')
    setSeasonYear(year)
  }

  const [draftExplorer, setDraftExplorer] = useState(null) // { slot: 1|2, year } | null

  const selectFromDraftClass = (player) => {
    if (draftExplorer?.slot === 1) setPlayer1(player)
    else if (draftExplorer?.slot === 2) setPlayer2(player)
    setDraftExplorer(null)
  }

  const [showSeasonFinder, setShowSeasonFinder] = useState(false)
  const [showGroups, setShowGroups] = useState(false)
  const [showAwards, setShowAwards] = useState(false)
  const [showTeams, setShowTeams] = useState(false)
  const [showCareerInfo, setShowCareerInfo] = useState(false)
  const [finderInitialFilters, setFinderInitialFilters] = useState(null)

  const compareFromFinder = (player, year) => {
    setPlayer1(player)
    setMode('season')
    setSeasonYear(year)
    setShowSeasonFinder(false)
  }

  // Awards page -> Head to Head: load the winner into the first free slot and jump to their award season.
  const pickFromAwards = (playerId, year) => {
    getPlayer(playerId)
      .then((p) => {
        if (!player1) setPlayer1(p)
        else if (!player2 && p.id !== player1.id) setPlayer2(p)
        else setPlayer2(p)
        if (p.league) setLeague(p.league)
        setMode('season')
        setSeasonYear(year)
        setShowAwards(false)
      })
      .catch((err) => console.error('Could not load award winner:', err))
  }

  const restoreRecentSearch = (item) => {
    if (item.type === 'compare') {
      Promise.all([getPlayer(item.state.p1), getPlayer(item.state.p2)])
        .then(([p1Data, p2Data]) => {
          setPlayer1(p1Data)
          setPlayer2(p2Data)
          setMode(item.state.mode)
          setSeasonYear(item.state.year)
          // Derive league from the restored player's own row, rather than
          // needing to have stored it separately in the recent-search state.
          if (p1Data.league) setLeague(p1Data.league)
        })
        .catch((err) => console.error('Could not restore recent comparison:', err))
    } else if (item.type === 'finder') {
      // Unlike a comparison, a Season Finder search isn't tied to any
      // specific player, so its league has to be explicitly stored and
      // restored rather than derived.
      if (item.state.league) setLeague(item.state.league)
      setFinderInitialFilters(item.state)
      setShowSeasonFinder(true)
    }
  }

  const range = LEAGUE_RANGES[league]

  return (
    <div className="min-h-screen bg-court-bg px-6 py-10 md:py-16">
      <header className="max-w-3xl mx-auto text-center mb-12">
        <div className="flex justify-center mb-4">
          <Logo variant="basketball" size={48} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl text-ink-primary font-semibold">Head to Head</h1>
        <p className="text-ink-muted font-body mt-3">
          Line up any two {league} players, any season since they entered the league.
        </p>

        {/* League toggle */}
        <div className="flex justify-center gap-2 mt-5">
          {['WNBA', 'NBA'].map((l) => (
            <button
              key={l}
              onClick={() => switchLeague(l)}
              className={`px-5 py-1.5 rounded-full text-xs uppercase tracking-widest font-body font-semibold transition-colors ${
                league === l
                  ? 'bg-ball text-court-bg'
                  : 'bg-court-surface2 text-ink-muted hover:text-ink-primary'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSeasonFinder(!showSeasonFinder)}
          className="mt-4 text-xs text-ball hover:text-ink-primary transition-colors font-body underline underline-offset-2"
        >
          🔍 {showSeasonFinder ? 'Hide Season Finder' : 'Explore seasons instead → Season Finder'}
        </button>
        <button
          onClick={() => { setShowGroups(!showGroups); setShowAwards(false); setShowTeams(false) }}
          className="mt-2 block mx-auto text-xs text-ball hover:text-ink-primary transition-colors font-body underline underline-offset-2"
        >
          👥 {showGroups ? '← Back to Head to Head' : 'Compare groups of players → Group Comparison'}
        </button>
        <button
          onClick={() => { setShowAwards(!showAwards); setShowGroups(false); setShowTeams(false) }}
          className="mt-2 block mx-auto text-xs text-ball hover:text-ink-primary transition-colors font-body underline underline-offset-2"
        >
          🏅 {showAwards ? '← Back to Head to Head' : 'Year-by-year winners → Awards'}
        </button>
        <button
          onClick={() => { setShowTeams(!showTeams); setShowGroups(false); setShowAwards(false) }}
          className="mt-2 block mx-auto text-xs text-ball hover:text-ink-primary transition-colors font-body underline underline-offset-2"
        >
          🏀 {showTeams ? '← Back to Head to Head' : 'Compare two teams → Team Comparison'}
        </button>
      </header>

      <RecentSearches refreshKey={recentRefresh} onRestore={restoreRecentSearch} />

      {/* group-mode-layout: always mounted so picks survive switching back and forth; hidden when off */}
      <div className={`max-w-3xl mx-auto bg-court-surface border border-court-line rounded-xl p-6 md:p-10 mb-6 ${showGroups ? '' : 'hidden'}`}>
        <GroupCompare league={league} onClose={() => setShowGroups(false)} />
      </div>

      {showAwards && (
        <div className="max-w-3xl mx-auto bg-court-surface border border-court-line rounded-xl p-6 md:p-10 mb-6">
          <AwardsPage league={league} onPick={pickFromAwards} onClose={() => setShowAwards(false)} />
        </div>
      )}

      {showTeams && (
        <div className="max-w-3xl mx-auto bg-court-surface border border-court-line rounded-xl p-6 md:p-10 mb-6">
          <TeamCompare league={league} onClose={() => setShowTeams(false)} />
        </div>
      )}

      {showSeasonFinder && (
        <div className="max-w-3xl mx-auto bg-court-surface border border-court-line rounded-xl p-6 md:p-10 mb-6">
          <SeasonFinder
            league={league}
            onCompare={compareFromFinder}
            onClose={() => { setShowSeasonFinder(false); setFinderInitialFilters(null) }}
            initialFilters={finderInitialFilters}
            onSearched={() => setRecentRefresh((n) => n + 1)}
          />
        </div>
      )}

      <main className={`max-w-3xl mx-auto bg-court-surface border border-court-line rounded-xl p-6 md:p-10 ${showGroups || showAwards || showTeams ? 'hidden' : ''}`}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 mb-8">
          <PlayerSearch
            label="Player 1" selectedPlayer={player1} onSelect={setPlayer1} align="left"
            league={league}
            seasonTeam={mode === 'season' ? comparison?.player_1?.stats?.team_abbreviation : null}
            onDraftYearClick={(year) => setDraftExplorer({ slot: 1, year })}
          />
          <span className="font-display text-2xl text-ink-faint shrink-0 my-1 sm:my-0 sm:mt-8">VS</span>
          <PlayerSearch
            label="Player 2" selectedPlayer={player2} onSelect={setPlayer2} align="right"
            league={league}
            seasonTeam={mode === 'season' ? comparison?.player_2?.stats?.team_abbreviation : null}
            onDraftYearClick={(year) => setDraftExplorer({ slot: 2, year })}
          />
        </div>

        <DraftClassExplorer
          year={draftExplorer?.year}
          league={league}
          onSelectPlayer={selectFromDraftClass}
          onClose={() => setDraftExplorer(null)}
        />

        {/* Season / Career toggle */}
        <div className="flex justify-center gap-2 mb-6">
          {['season', 'career'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-body transition-colors ${
                mode === m
                  ? 'bg-ball text-court-bg font-semibold'
                  : 'bg-court-surface2 text-ink-muted hover:text-ink-primary'
              }`}
            >
              {m === 'season' ? 'Single Season' : 'Career'}
            </button>
          ))}
        </div>

        {mode === 'season' && (
          <div className="flex items-center gap-4 mb-8 border-t border-b border-court-line py-4">
            <span className="text-xs uppercase tracking-widest text-ink-muted font-body shrink-0">Season</span>
            <input
              type="range"
              min={range.earliest}
              max={range.current}
              value={seasonYear}
              onChange={(e) => setSeasonYear(Number(e.target.value))}
              className="flex-1 accent-ball"
            />
            <span className="font-mono tabular text-lg text-ball font-semibold w-24 text-right">{seasonLabel(league, seasonYear)}</span>
          </div>
        )}

        {!player1 || !player2 ? (
          <p className="text-center text-ink-faint font-body py-8">
            Select two players to compare their stats.
          </p>
        ) : hydrating || (loading && !comparison) ? (
          <p className="text-center text-ink-muted font-body py-8">Loading…</p>
        ) : error ? (
          <p className="text-center text-red-400 font-body py-8">{error}</p>
        ) : comparison ? (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <SidePanel playerId={player1.id} side={comparison.player_1} highlights={career1?.highlights} seasonYear={seasonYear} align="left" onJumpToSeason={jumpToSeason} mode={mode} league={league} />
              <div className="text-right">
                <SidePanel playerId={player2.id} side={comparison.player_2} highlights={career2?.highlights} seasonYear={seasonYear} align="right" onJumpToSeason={jumpToSeason} mode={mode} league={league} />
              </div>
            </div>

            {mode === 'career' ? (
              <div className="mt-4">
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <span className="text-xs uppercase tracking-widest text-ink-muted font-body">
                    Career Comparison
                  </span>
                  <button
                    onClick={() => setShowCareerInfo(!showCareerInfo)}
                    className="text-ink-faint hover:text-ink-primary text-xs leading-none"
                    aria-label="More info"
                  >
                    ⓘ
                  </button>
                </div>
                {showCareerInfo && (
                  <p className="text-center text-ink-faint font-body text-[10px] mb-3">
                    Career averages are weighted by games played
                    ({career1?.seasons_played ?? 0} vs {career2?.seasons_played ?? 0} seasons).
                  </p>
                )}
                {careerStatRows.map((row) => (
                  <StatBar
                    key={row.key}
                    label={row.label}
                    value1={career1?.[row.key]}
                    value2={career2?.[row.key]}
                  />
                ))}
              </div>
            ) : bothActive ? (
              <div>
                <div className="mt-4">
                  {seasonStatRows.map((row) => (
                    <StatBar
                      key={row.key}
                      label={row.label}
                      value1={s1?.[row.key]}
                      value2={s2?.[row.key]}
                    />
                  ))}
                </div>
                <CompositePanel
                  composite={comparison.composite}
                  name1={player1.name}
                  name2={player2.name}
                />
                <AdvancedRadar
                  stats1={s1}
                  stats2={s2}
                  name1={player1.name}
                  name2={player2.name}
                />
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-ink-faint font-body text-sm mb-3">
                  A season comparison isn't available because one or both players weren't active during the selected season. Switch to Career to compare their full careers.
                </p>
                <button
                  onClick={() => setMode('career')}
                  className="text-xs text-ball hover:text-ink-primary font-body font-semibold px-4 py-1.5 rounded-md border border-ball hover:bg-ball hover:text-court-bg transition-colors"
                >
                  Compare full careers instead →
                </button>
              </div>
            )}

            <div key={`similar-${player1.id}-${player2.id}`} className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in">
              <SimilarPlayers playerId={player1.id} playerName={player1.name} onSelectPlayer={setPlayer1} />
              <SimilarPlayers playerId={player2.id} playerName={player2.name} onSelectPlayer={setPlayer2} />
            </div>

            <div>
              <PlayerDevelopment player1={player1} player2={player2} />
            </div>

            <div key={`history-${player1.id}-${player2.id}`} className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-court-line animate-fade-in">
              <TeamHistory player={player1} />
              <TeamHistory player={player2} />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
