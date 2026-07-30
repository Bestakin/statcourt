import { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { findSeasons } from '../api'
import { addRecentSearch } from '../recentSearches'

const POSITIONS = ['G', 'F', 'C', 'G-F', 'F-G', 'F-C', 'C-F']

function buildApiFilters(v) {
  return {
    min_pts: v.minPts,
    min_reb: v.minReb,
    min_ast: v.minAst,
    min_ts_pct: v.minTsPctPercent ? Number(v.minTsPctPercent) / 100 : '',
    min_per: v.minPer,
    min_win_shares: v.minWinShares,
    position: v.position,
    team: v.team ? v.team.toUpperCase() : '',
    draft_year: v.draftYear,
    season_year: v.seasonYear,
  }
}

function buildLabel(v) {
  const parts = []
  if (v.minPts) parts.push(`PPG > ${v.minPts}`)
  if (v.minReb) parts.push(`RPG > ${v.minReb}`)
  if (v.minAst) parts.push(`APG > ${v.minAst}`)
  if (v.minTsPctPercent) parts.push(`TS% > ${v.minTsPctPercent}`)
  if (v.minPer) parts.push(`PER > ${v.minPer}`)
  if (v.minWinShares) parts.push(`WS > ${v.minWinShares}`)
  if (v.position) parts.push(`Pos: ${v.position}`)
  if (v.team) parts.push(`Team: ${v.team.toUpperCase()}`)
  if (v.seasonYear) parts.push(`Season ${v.seasonYear}`)
  if (v.draftYear) parts.push(`Drafted ${v.draftYear}`)
  return parts.length > 0 ? `Seasons: ${parts.join(', ')}` : 'All seasons'
}

export default function SeasonFinder({ onCompare, onClose, initialFilters, onSearched }) {
  const [minPts, setMinPts] = useState(initialFilters?.minPts ?? '25')
  const [advancedOpen, setAdvancedOpen] = useState(!!initialFilters?.advancedOpen)

  const [minReb, setMinReb] = useState(initialFilters?.minReb ?? '')
  const [minAst, setMinAst] = useState(initialFilters?.minAst ?? '')
  const [minTsPctPercent, setMinTsPctPercent] = useState(initialFilters?.minTsPctPercent ?? '') // shown to user as 0-100
  const [minPer, setMinPer] = useState(initialFilters?.minPer ?? '')
  const [minWinShares, setMinWinShares] = useState(initialFilters?.minWinShares ?? '')
  const [position, setPosition] = useState(initialFilters?.position ?? '')
  const [team, setTeam] = useState(initialFilters?.team ?? '')
  const [draftYear, setDraftYear] = useState(initialFilters?.draftYear ?? '')
  const [seasonYear, setSeasonYear] = useState(initialFilters?.seasonYear ?? '')

  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runSearch = async (rawValues) => {
    setLoading(true)
    setError(null)
    try {
      const data = await findSeasons(buildApiFilters(rawValues))
      setResults(data.results)

      const label = buildLabel(rawValues)
      addRecentSearch({
        id: `finder-${JSON.stringify(rawValues)}`,
        type: 'finder',
        label,
        state: rawValues,
      })
      onSearched && onSearched()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // If restoring a past search, run it once automatically on mount.
  useEffect(() => {
    if (initialFilters) {
      runSearch(initialFilters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = () => {
    runSearch({
      minPts, minReb, minAst, minTsPctPercent, minPer, minWinShares,
      position, team, draftYear, seasonYear,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">
          Season Finder
        </span>
        <button
          onClick={onClose}
          className="text-xs text-ink-faint hover:text-ink-primary transition-colors font-body"
        >
          Close ✕
        </button>
      </div>

      {/* Simple search - always visible */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-ink-muted font-body">PPG &gt;</span>
        <input
          type="number"
          value={minPts}
          onChange={(e) => setMinPts(e.target.value)}
          className="w-20 bg-court-surface2 border border-court-line rounded-md px-2 py-1.5 text-ink-primary font-mono text-sm outline-none focus:border-ball"
        />
        <button
          onClick={search}
          disabled={loading}
          className="px-4 py-1.5 rounded-md bg-ball text-court-bg text-xs uppercase tracking-widest font-semibold font-body hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="text-xs text-ink-faint hover:text-ink-primary transition-colors font-body underline underline-offset-2"
        >
          {advancedOpen ? 'Hide advanced filters' : 'Advanced filters'}
        </button>
      </div>

      {/* Advanced filters - collapsed by default */}
      {advancedOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-4 bg-court-surface2 rounded-md">
          <label className="flex flex-col gap-1 text-xs text-ink-muted font-body">
            RPG &gt;
            <input type="number" value={minReb} onChange={(e) => setMinReb(e.target.value)}
              className="bg-court-bg border border-court-line rounded px-2 py-1 text-ink-primary font-mono outline-none focus:border-ball" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted font-body">
            APG &gt;
            <input type="number" value={minAst} onChange={(e) => setMinAst(e.target.value)}
              className="bg-court-bg border border-court-line rounded px-2 py-1 text-ink-primary font-mono outline-none focus:border-ball" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted font-body">
            TS% &gt;
            <input type="number" value={minTsPctPercent} onChange={(e) => setMinTsPctPercent(e.target.value)}
              className="bg-court-bg border border-court-line rounded px-2 py-1 text-ink-primary font-mono outline-none focus:border-ball" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted font-body">
            PER &gt;
            <input type="number" value={minPer} onChange={(e) => setMinPer(e.target.value)}
              className="bg-court-bg border border-court-line rounded px-2 py-1 text-ink-primary font-mono outline-none focus:border-ball" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted font-body">
            Win Shares &gt;
            <input type="number" value={minWinShares} onChange={(e) => setMinWinShares(e.target.value)}
              className="bg-court-bg border border-court-line rounded px-2 py-1 text-ink-primary font-mono outline-none focus:border-ball" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted font-body">
            Position
            <select value={position} onChange={(e) => setPosition(e.target.value)}
              className="bg-court-bg border border-court-line rounded px-2 py-1 text-ink-primary font-body outline-none focus:border-ball">
              <option value="">Any</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted font-body">
            Team
            <input type="text" value={team} onChange={(e) => setTeam(e.target.value)} maxLength={3}
              placeholder="e.g. LVA"
              className="bg-court-bg border border-court-line rounded px-2 py-1 text-ink-primary font-mono uppercase outline-none focus:border-ball" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted font-body">
            Season
            <input type="number" value={seasonYear} onChange={(e) => setSeasonYear(e.target.value)}
              placeholder="Any"
              className="bg-court-bg border border-court-line rounded px-2 py-1 text-ink-primary font-mono outline-none focus:border-ball" />
          </label>
        </div>
      )}

      {/* Results */}
      {error && <p className="text-sm text-red-400 font-body mt-4">{error}</p>}

      {results && (
        <div className="mt-4">
          {results.length === 0 ? (
            <p className="text-sm text-ink-muted font-body">No seasons matched those filters.</p>
          ) : (
            <div className="space-y-1">
              {results.map((r) => (
                <div
                  key={`${r.player.id}-${r.season_year}`}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-court-surface2 transition-colors"
                >
                  <Avatar name={r.player.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink-primary font-body truncate">
                      {r.player.name} <span className="text-ink-faint">· {r.season_year}</span>
                    </div>
                    <div className="text-[10px] text-ink-faint font-mono tabular">
                      {r.pts} PPG · {r.reb} RPG · {r.ast} APG
                      {r.team_abbreviation ? ` · ${r.team_abbreviation}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => onCompare(r.player, r.season_year)}
                    className="text-xs text-ball hover:text-ink-primary font-body font-semibold shrink-0 px-3 py-1 rounded-md border border-ball hover:bg-ball hover:text-court-bg transition-colors"
                  >
                    Compare
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
