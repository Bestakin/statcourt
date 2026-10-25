import { useEffect, useState } from 'react'
import { getPlayerAwards } from '../awardsApi'
import { seasonLabel } from '../seasonLabel'

// Career awards for one player, e.g. "5x MVP". Tap a badge to see the years.
// When seasonYear is given, awards won in that exact season get an orange outline.
export default function AwardBadges({ playerId, seasonYear, align = 'left', league }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (!playerId) return
    const ctrl = new AbortController()
    setData(null)
    setOpen(null)
    getPlayerAwards(playerId, ctrl.signal)
      .then(setData)
      .catch(() => { /* awards are a bonus; stay quiet if unavailable */ })
    return () => ctrl.abort()
  }, [playerId])

  if (!data || data.awards.length === 0) return null

  const justify = align === 'right' ? 'justify-end' : 'justify-start'

  return (
    <div className="mt-2">
      <div className={`flex flex-wrap gap-1.5 ${justify}`}>
        {data.awards.map((a) => {
          const wonThisSeason = seasonYear && a.seasons.includes(seasonYear)
          return (
            <button
              key={a.award}
              onClick={() => setOpen(open === a.award ? null : a.award)}
              title={`${a.name}: ${a.seasons.map((y) => seasonLabel(league, y)).join(', ')}`}
              className={`text-[10px] font-body bg-court-surface2 border rounded-full px-2.5 py-1 transition-colors cursor-pointer hover:text-ink-primary ${
                wonThisSeason ? 'border-ball text-ball' : 'border-court-line text-ink-muted hover:border-ball'
              }`}
            >
              🏅 {a.count > 1 ? `${a.count}× ` : ''}{a.short}
            </button>
          )
        })}
      </div>
      {open && (
        <p className={`mt-1.5 text-[10px] font-body text-ink-faint ${align === 'right' ? 'text-right' : ''}`}>
          {data.awards.find((a) => a.award === open)?.name}:{' '}
          <span className="font-mono tabular">{data.awards.find((a) => a.award === open)?.seasons.map((y) => seasonLabel(league, y)).join(', ')}</span>
        </p>
      )}
    </div>
  )
}
