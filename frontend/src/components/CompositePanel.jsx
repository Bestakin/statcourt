import { useState } from 'react'
import useCountUp from '../hooks/useCountUp'

export default function CompositePanel({ composite, name1, name2 }) {
  const hasData = composite && composite.categories.length > 0
  const animated1 = useCountUp(hasData ? composite.overall_player_1 : 0)
  const animated2 = useCountUp(hasData ? composite.overall_player_2 : 0)
  const [showInfo, setShowInfo] = useState(false)

  if (!hasData) return null

  const { categories, winner } = composite

  return (
    <div className="mt-8 pt-6 border-t border-court-line">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-widest text-ink-muted font-body">
          Who had the better season?
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
          Based on advanced statistics. Not an official WNBA metric.
        </p>
      )}

      <div className="flex items-center justify-center gap-4 my-4">
        <span className="font-display text-3xl text-ball tabular font-mono">
          {animated1.toFixed(1)}
        </span>
        <span className="text-ink-faint font-display text-sm">
          {winner === 1 ? `${name1} edges it` : winner === 2 ? `${name2} edges it` : 'Dead even'}
        </span>
        <span className="font-display text-3xl text-accent2 tabular font-mono">
          {animated2.toFixed(1)}
        </span>
      </div>

      <div className="space-y-3">
        {categories.map((c) => {
          const p1Display = Math.round(c.player_1_score)
          const p2Display = 100 - p1Display
          return (
            <div key={c.category}>
              <div className="flex justify-between text-xs font-body text-ink-muted mb-1">
                <span className="tabular">{p1Display}%</span>
                <span className="uppercase tracking-widest text-[10px]">{c.category}</span>
                <span className="tabular">{p2Display}%</span>
              </div>
              <div className="h-1.5 w-full bg-court-line rounded-sm overflow-hidden flex">
                <div className="h-full bg-ball" style={{ width: `${p1Display}%` }} />
                <div className="h-full bg-accent2" style={{ width: `${p2Display}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
