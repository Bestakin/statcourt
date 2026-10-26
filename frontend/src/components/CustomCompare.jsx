import { useState, useEffect } from 'react'
import { getCareerExtra } from '../careerExtraApi'

// Every stat the page already holds. `season` / `career` are the field names in each
// response; null means that mode doesn't carry the stat (shown as "unavailable", never 0).
const METRICS = [
  { id: 'pts', label: 'Points', short: 'PTS', season: 'pts', career: 'ppg', kind: 'num' },
  { id: 'reb', label: 'Rebounds', short: 'REB', season: 'reb', career: 'rpg', kind: 'num' },
  { id: 'ast', label: 'Assists', short: 'AST', season: 'ast', career: 'apg', kind: 'num' },
  { id: 'stl', label: 'Steals', short: 'STL', season: 'stl', career: 'spg', kind: 'num' },
  { id: 'blk', label: 'Blocks', short: 'BLK', season: 'blk', career: 'bpg', kind: 'num' },
  { id: 'tov', label: 'Turnovers (fewer is better)', short: 'TOV', season: 'tov', career: 'x:tov', kind: 'num', lower: true },
  { id: 'fg', label: 'Field goal %', short: 'FG%', season: 'fg_pct', career: 'fg_pct', kind: 'pct' },
  { id: 'fg3', label: '3-point %', short: '3P%', season: 'fg3_pct', career: 'fg3_pct', kind: 'pct' },
  { id: 'ft', label: 'Free throw %', short: 'FT%', season: 'ft_pct', career: 'ft_pct', kind: 'pct' },
  { id: 'ts', label: 'True shooting %', short: 'TS%', season: 'ts_pct', career: null, kind: 'pct' },
  { id: 'min', label: 'Minutes per game', short: 'MIN', season: 'minutes', career: 'x:min', kind: 'num' },
  { id: 'per', label: 'Player efficiency rating', short: 'PER', season: 'per', career: null, kind: 'num' },
  { id: 'usg', label: 'Usage %', short: 'USG%', season: 'usg_pct', career: null, kind: 'pct' },
  { id: 'ws', label: 'Win shares', short: 'WS', season: 'win_shares', career: null, kind: 'num' },
  { id: 'gp', label: 'Games played', short: 'GP', season: 'games_played', career: 'games_played', kind: 'int' },
]
const MAX_PICKS = 5
const DEFAULT_PICKS = ['pts', 'reb', 'ast']

// Picked stats live in the address (?stats=pts,reb,ast) so a shared or saved link reopens with them.
// "none" means the user cleared everything on purpose. Only the stats key is touched.
function readPicked() {
  try {
    const raw = new URLSearchParams(window.location.search).get('stats')
    if (!raw) return DEFAULT_PICKS
    if (raw === 'none') return []
    const ids = [...new Set(raw.split(',').filter((id) => METRICS.some((m) => m.id === id)))].slice(0, MAX_PICKS)
    return ids.length ? ids : DEFAULT_PICKS
  } catch { return DEFAULT_PICKS }
}
function writePicked(ids) {
  try {
    const params = new URLSearchParams(window.location.search)
    params.set('stats', ids.length ? ids.join(',') : 'none')
    window.history.replaceState(window.history.state, '', window.location.pathname + '?' + params.toString().replace(/%2C/g, ','))
  } catch { /* the address bar is a convenience; picking still works without it */ }
}

// Percentages arrive either as fractions (0.512) or already as percents (51.2); show both as 51.2.
const toShown = (kind, v) => {
  if (v == null || Number.isNaN(Number(v))) return null
  const x = Number(v)
  if (kind === 'int') return Math.round(x)
  if (kind === 'pct') return Math.round((Math.abs(x) <= 1 ? x * 100 : x) * 10) / 10
  return Math.round(x * 10) / 10
}
const fmt = (kind, shown) => (shown == null ? null : kind === 'int' ? String(shown) : shown.toFixed(1) + (kind === 'pct' ? '%' : ''))

// Career TOV / MIN come from /career-extra (games-weighted, with coverage). Everything else is already on the page.
export default function CustomCompare({ mode, id1, id2, name1, name2, season1, season2, career1, career2, seasonAvailable }) {
  const [picked, setPicked] = useState(readPicked)
  const [open, setOpen] = useState(false)
  const [extra, setExtra] = useState({ key: '', a: null, b: null, failed: false })
  const extraKey = `${id1}-${id2}`

  useEffect(() => {
    if (mode !== 'career' || !id1 || !id2) return
    const ctl = new AbortController()
    Promise.all([getCareerExtra(id1, ctl.signal), getCareerExtra(id2, ctl.signal)])
      .then(([a, b]) => setExtra({ key: extraKey, a, b, failed: false }))
      .catch((e) => { if (e.name !== 'AbortError') setExtra({ key: extraKey, a: null, b: null, failed: true }) })
    return () => ctl.abort()
  }, [mode, id1, id2, extraKey])
  const extraReady = extra.key === extraKey

  const src1 = mode === 'career' ? career1 : season1
  const src2 = mode === 'career' ? career2 : season2
  const usable = mode === 'career' ? !!(career1 && career2) : seasonAvailable && !!(season1 && season2)

  const toggle = (id) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= MAX_PICKS ? picked : [...picked, id]
    setPicked(next)
    writePicked(next)
  }

  const rows = picked.map((id) => {
    const m = METRICS.find((x) => x.id === id)
    const field = mode === 'career' ? m.career : m.season
    let a = null, b = null, na = null, nb = null, loading = false
    if (field && field.startsWith('x:')) {          // career extras: value + coverage note
      const k = field.slice(2)
      loading = !extraReady && !extra.failed
      const ma = extraReady ? extra.a?.[k] : null
      const mb = extraReady ? extra.b?.[k] : null
      a = ma ? toShown(m.kind, ma.value) : null
      b = mb ? toShown(m.kind, mb.value) : null
      const note = (x) => (x && x.value != null && x.covered_games < x.total_games
        ? `${x.covered_seasons} of ${x.total_seasons} seasons` : null)
      na = note(ma); nb = note(mb)
    } else {
      a = field && src1 ? toShown(m.kind, src1[field]) : null
      b = field && src2 ? toShown(m.kind, src2[field]) : null
    }
    let lead = null // 1, 2, 0 = tie, null = can't tell
    if (a != null && b != null) lead = a === b ? 0 : (m.lower ? a < b : a > b) ? 1 : 2
    return { m, a, b, na, nb, lead, loading }
  })
  const counted = rows.filter((r) => r.lead !== null)
  const w1 = counted.filter((r) => r.lead === 1).length
  const w2 = counted.filter((r) => r.lead === 2).length
  const ties = counted.filter((r) => r.lead === 0).length
  const missing = rows.length - counted.length

  return (
    <div className="mt-8 border-t border-court-line pt-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">Build your comparison</span>
        <button onClick={() => setOpen(!open)}
          className="text-xs text-ball hover:text-ink-primary font-body transition-colors">
          {open ? `${picked.length}/${MAX_PICKS} selected · Hide ▲` : `Choose stats (${picked.length}/${MAX_PICKS}) ▼`}
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2 mb-4">
          {METRICS.map((m) => {
            const on = picked.includes(m.id)
            const full = !on && picked.length >= MAX_PICKS
            const none = mode === 'career' ? !m.career : false
            return (
              <button key={m.id} onClick={() => toggle(m.id)} disabled={full}
                title={full ? `Pick up to ${MAX_PICKS}` : m.label + (none ? ' (not available in Career mode)' : '')}
                className={`px-3 py-1 rounded-full text-[11px] font-body transition-colors ${
                  on ? 'bg-ball text-court-bg font-semibold'
                    : full ? 'bg-court-surface2 text-ink-faint opacity-50 cursor-not-allowed'
                    : 'bg-court-surface2 text-ink-muted hover:text-ink-primary'
                } ${none && !on ? 'italic' : ''}`}>
                {m.short}
              </button>
            )
          })}
        </div>
      )}

      {!usable ? (
        <p className="text-center text-ink-faint font-body text-sm py-4">
          Pick two players who were both active in this season (or switch to Career) to build a comparison.
        </p>
      ) : picked.length === 0 ? (
        <p className="text-center text-ink-faint font-body text-sm py-4">Choose up to {MAX_PICKS} stats above.</p>
      ) : (
        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 text-[11px] uppercase tracking-widest font-body mb-1">
            <span className="text-ball truncate">{name1}</span>
            <span />
            <span className="text-sky-400 text-right truncate">{name2}</span>
          </div>
          {rows.map(({ m, a, b, na, nb, lead, loading }) => (
            <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 py-2 border-b border-court-line">
              <span className={`font-mono tabular text-lg ${lead === 1 ? 'text-ball font-semibold' : 'text-ink-primary'}`}>
                {fmt(m.kind, a) ?? <span className="text-ink-faint text-sm font-body">{loading ? '…' : 'unavailable'}</span>}
                {na && <span className="block text-[10px] font-body font-normal text-ink-faint">{na}</span>}
              </span>
              <span className="text-[11px] uppercase tracking-widest text-ink-muted font-body text-center w-16">
                {m.short}
                {lead === 0 && <span className="block normal-case tracking-normal text-ink-faint">tied</span>}
              </span>
              <span className={`font-mono tabular text-lg text-right ${lead === 2 ? 'text-sky-400 font-semibold' : 'text-ink-primary'}`}>
                {fmt(m.kind, b) ?? <span className="text-ink-faint text-sm font-body">{loading ? '…' : 'unavailable'}</span>}
                {nb && <span className="block text-[10px] font-body font-normal text-ink-faint">{nb}</span>}
              </span>
            </div>
          ))}
          <p className="text-[11px] text-ink-muted font-body mt-3 text-center">
            {counted.length === 0
              ? 'None of the chosen stats are available for both players here.'
              : `On the ${counted.length} chosen ${counted.length === 1 ? 'stat' : 'stats'} available for both: ${name1} leads ${w1}, ${name2} leads ${w2}${ties ? `, ${ties} tied` : ''}.`}
            {missing > 0 && ` ${missing} unavailable for one or both players, not counted.`}
            {' '}This is a tally of the stats you picked, not an overall winner.
          </p>
        </div>
      )}
    </div>
  )
}
