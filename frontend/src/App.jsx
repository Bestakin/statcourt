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
import RecentSearches from './components/RecentSearches'
import { comparePlayers, getPlayer, getCareerAverages } from './api'
import { addRecentSearch } from './recentSearches'

const CURRENT_YEAR = 2026
const EARLIEST_YEAR = 1997

function SidePanel({ side, highlights, seasonYear, align, onJumpToSeason, mode }) {
  return (
    <div className="mt-1">
      {mode === 'season' && (side.status !== 'active' || !side.stats) ? (
        <EmptyStateCard status={side.status} name={side.player.name} year={seasonYear} align={align} />
      ) : null}
      {mode === 'career' && <HighlightBadges highlights={highlights} onJumpToSeason={onJumpToSeason} />}
    </div>
  )
}

// Reads/writes p1, p2, year as URL query params so a comparison can be shared.
function readParamsFromURL() {
  const params = new URLSearchParams(window.location.search)
  return {
    p1: params.get('p1'),
    p2: params.get('p2'),
    year: params.get('year'),
    mode: params.get('mode'),
  }
}

function writeParamsToURL({ p1, p2, year, mode }) {
  const params = new URLSearchParams()
  if (p1) params.set('p1', p1)
  if (p2) params.set('p2', p2)
  if (year) params.set('year', year)
  if (mode) params.set('mode', mode)
  const newUrl = `${window.location.pathname}?${params.toString()}`
  window.history.replaceState({}, '', newUrl)
}

export default function App() {
  const [player1, setPlayer1] = useState(null)
  const [player2, setPlayer2] = useState(null)
  const [seasonYear, setSeasonYear] = useState(CURRENT_YEAR)
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
    const { p1, p2, year, mode: urlMode } = readParamsFromURL()
    if (urlMode === 'career' || urlMode === 'season') setMode(urlMode)
    if (year) setSeasonYear(Number(year))

    if (p1 && p2) {
      Promise.all([getPlayer(p1), getPlayer(p2)])
        .then(([p1Data, p2Data]) => {
          setPlayer1(p1Data)
          setPlayer2(p2Data)
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
      p1: player1?.id, p2: player2?.id, year: seasonYear, mode,
    })
  }, [player1, player2, seasonYear, mode, hydrating])

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
          : `${player1.name} vs ${player2.name} (${seasonYear})`
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
  const [showCareerInfo, setShowCareerInfo] = useState(false)
  const [finderInitialFilters, setFinderInitialFilters] = useState(null)

  const compareFromFinder = (player, year) => {
    setPlayer1(player)
    setMode('season')
    setSeasonYear(year)
    setShowSeasonFinder(false)
  }

  const restoreRecentSearch = (item) => {
    if (item.type === 'compare') {
      Promise.all([getPlayer(item.state.p1), getPlayer(item.state.p2)])
        .then(([p1Data, p2Data]) => {
          setPlayer1(p1Data)
          setPlayer2(p2Data)
          setMode(item.state.mode)
          setSeasonYear(item.state.year)
        })
        .catch((err) => console.error('Could not restore recent comparison:', err))
    } else if (item.type === 'finder') {
      setFinderInitialFilters(item.state)
      setShowSeasonFinder(true)
    }
  }

  return (
    <div className="min-h-screen bg-court-bg px-6 py-10 md:py-16">
      <header className="max-w-3xl mx-auto text-center mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-ball font-body mb-3">WNBA Stat Compare</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink-primary font-semibold">Head to Head</h1>
        <p className="text-ink-muted font-body mt-3">
          Line up any two players, any season since they entered the league.
        </p>
        <button
          onClick={() => setShowSeasonFinder(!showSeasonFinder)}
          className="mt-4 text-xs text-ball hover:text-ink-primary transition-colors font-body underline underline-offset-2"
        >
          🔍 {showSeasonFinder ? 'Hide Season Finder' : 'Explore seasons instead → Season Finder'}
        </button>
      </header>

      <RecentSearches refreshKey={recentRefresh} onRestore={restoreRecentSearch} />

      {showSeasonFinder && (
        <div className="max-w-3xl mx-auto bg-court-surface border border-court-line rounded-xl p-6 md:p-10 mb-6">
          <SeasonFinder
            onCompare={compareFromFinder}
            onClose={() => { setShowSeasonFinder(false); setFinderInitialFilters(null) }}
            initialFilters={finderInitialFilters}
            onSearched={() => setRecentRefresh((n) => n + 1)}
          />
        </div>
      )}

      <main className="max-w-3xl mx-auto bg-court-surface border border-court-line rounded-xl p-6 md:p-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 mb-8">
          <PlayerSearch
            label="Player 1" selectedPlayer={player1} onSelect={setPlayer1} align="left"
            seasonTeam={mode === 'season' ? comparison?.player_1?.stats?.team_abbreviation : null}
            onDraftYearClick={(year) => setDraftExplorer({ slot: 1, year })}
          />
          <span className="font-display text-2xl text-ink-faint shrink-0 my-1 sm:my-0 sm:mt-8">VS</span>
          <PlayerSearch
            label="Player 2" selectedPlayer={player2} onSelect={setPlayer2} align="right"
            seasonTeam={mode === 'season' ? comparison?.player_2?.stats?.team_abbreviation : null}
            onDraftYearClick={(year) => setDraftExplorer({ slot: 2, year })}
          />
        </div>

        <DraftClassExplorer
          year={draftExplorer?.year}
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
              min={EARLIEST_YEAR}
              max={CURRENT_YEAR}
              value={seasonYear}
              onChange={(e) => setSeasonYear(Number(e.target.value))}
              className="flex-1 accent-ball"
            />
            <span className="font-mono tabular text-lg text-ball font-semibold w-14 text-right">{seasonYear}</span>
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
              <SidePanel side={comparison.player_1} highlights={career1?.highlights} seasonYear={seasonYear} align="left" onJumpToSeason={jumpToSeason} mode={mode} />
              <div className="text-right">
                <SidePanel side={comparison.player_2} highlights={career2?.highlights} seasonYear={seasonYear} align="right" onJumpToSeason={jumpToSeason} mode={mode} />
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
              <p className="text-center text-ink-faint font-body py-6 text-sm">
                Pick a season where both players were active to see stat comparisons.
              </p>
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
