import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { getPlayerSeasonHistory } from '../api'

const STAT_OPTIONS = [
  { key: 'pts', label: 'PPG' },
  { key: 'reb', label: 'RPG' },
  { key: 'ast', label: 'APG' },
  { key: 'per', label: 'PER' },
  { key: 'win_shares', label: 'Win Shares' },
]

function CustomTooltip({ active, payload, label, name1, name2 }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-court-surface2 border border-court-line rounded-md px-3 py-2 text-xs font-body">
      <div className="text-ink-muted mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }} className="tabular font-mono">
          {p.dataKey}: {p.value ?? '—'}
        </div>
      ))}
    </div>
  )
}

export default function PlayerDevelopment({ player1, player2 }) {
  const [history1, setHistory1] = useState(null)
  const [history2, setHistory2] = useState(null)
  const [stat, setStat] = useState('pts')

  useEffect(() => {
    if (!player1 || !player2) return
    setHistory1(null)
    setHistory2(null)
    Promise.all([
      getPlayerSeasonHistory(player1.id),
      getPlayerSeasonHistory(player2.id),
    ]).then(([h1, h2]) => {
      setHistory1(h1)
      setHistory2(h2)
    }).catch((err) => console.error('Could not load season history:', err))
  }, [player1, player2])

  const chartData = useMemo(() => {
    if (!history1 || !history2) return []
    const years = new Set([
      ...history1.map((s) => s.season_year),
      ...history2.map((s) => s.season_year),
    ])
    const byYear1 = Object.fromEntries(history1.map((s) => [s.season_year, s[stat]]))
    const byYear2 = Object.fromEntries(history2.map((s) => [s.season_year, s[stat]]))

    return [...years].sort().map((year) => ({
      season_year: year,
      [player1.name]: byYear1[year] ?? null,
      [player2.name]: byYear2[year] ?? null,
    }))
  }, [history1, history2, stat, player1, player2])

  if (!history1 || !history2) return null

  return (
    <div className="mt-8 pt-6 border-t border-court-line">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">
          Player Development
        </span>
        <div className="flex gap-1">
          {STAT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStat(opt.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-body transition-colors ${
                stat === opt.key
                  ? 'bg-ball text-court-bg font-semibold'
                  : 'bg-court-surface2 text-ink-muted hover:text-ink-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#2A4363" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="season_year"
            tick={{ fill: '#8FA0B3', fontSize: 11, fontFamily: 'Inter' }}
            axisLine={{ stroke: '#2A4363' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#8FA0B3', fontSize: 11, fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip name1={player1.name} name2={player2.name} />} />
          <Line
            type="monotone" dataKey={player1.name} stroke="#FF7A1A"
            strokeWidth={2} dot={{ r: 3 }} connectNulls={false} animationDuration={400}
          />
          <Line
            type="monotone" dataKey={player2.name} stroke="#4FC3F7"
            strokeWidth={2} dot={{ r: 3 }} connectNulls={false} animationDuration={400}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-1">
        <span className="flex items-center gap-1.5 text-xs font-body text-ink-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-ball inline-block" /> {player1.name}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-body text-ink-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-accent2 inline-block" /> {player2.name}
        </span>
      </div>
    </div>
  )
}
