import { useState } from 'react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'

// Advanced stats have wildly different natural ranges (PER ~0-30, TS% ~0-1,
// USG% ~0-35, Win Shares ~-2 to 12), so plotting raw values on one radar
// would let PER/USG dominate visually. Instead we plot each player's %
// share of the two players' combined value per stat (same scale-invariant
// approach as the composite score), so every axis is fairly 0-100 for both.
function share(a, b) {
  if (a == null || b == null) return [50, 50]
  const total = a + b
  if (total === 0) return [50, 50]
  return [(a / total) * 100, (b / total) * 100]
}

const STAT_DEFS = [
  { key: 'per', label: 'PER' },
  { key: 'ts_pct', label: 'TS%' },
  { key: 'usg_pct', label: 'USG%' },
  { key: 'win_shares', label: 'Win Shares' },
]

export default function AdvancedRadar({ stats1, stats2, name1, name2 }) {
  const [showInfo, setShowInfo] = useState(false)

  if (!stats1 || !stats2) return null

  const data = STAT_DEFS.map(({ key, label }) => {
    const [s1, s2] = share(stats1[key], stats2[key])
    return { stat: label, [name1]: Math.round(s1), [name2]: Math.round(s2) }
  })

  return (
    <div className="mt-8 pt-6 border-t border-court-line">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">
          Advanced Profile
        </span>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-ink-faint hover:text-ink-primary text-xs leading-none"
          aria-label="More info"
        >
          ⓘ
        </button>
      </div>
      {showInfo && (
        <p className="text-[10px] text-ink-faint font-body text-right mb-1">
          PER · True Shooting · Usage · Win Shares — share of combined total
        </p>
      )}
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={data} outerRadius="78%">
          <PolarGrid stroke="#2A4363" />
          <PolarAngleAxis
            dataKey="stat"
            tick={{ fill: '#8FA0B3', fontSize: 13, fontFamily: 'Inter' }}
          />
          <Radar name={name1} dataKey={name1} stroke="#FF7A1A" fill="#FF7A1A" fillOpacity={0.35} animationDuration={400} />
          <Radar name={name2} dataKey={name2} stroke="#4FC3F7" fill="#4FC3F7" fillOpacity={0.35} animationDuration={400} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 -mt-2">
        <span className="flex items-center gap-1.5 text-xs font-body text-ink-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-ball inline-block" /> {name1}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-body text-ink-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-accent2 inline-block" /> {name2}
        </span>
      </div>
    </div>
  )
}
