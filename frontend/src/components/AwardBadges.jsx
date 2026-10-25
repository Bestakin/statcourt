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
  const textAlign = align === 'right' ? 'text-right' : ''
  const tag = `text-[9px] uppercase tracking-widest font-body text-ink-faint mb-1 ${textAlign}`
  const label = seasonYear ? seasonLabel(league, seasonYear) : null
  const wonNow = seasonYear ? data.awards.filter((a) => a.seasons.includes(seasonYear)) : []

  return (
    <div className="mt-2">
      {seasonYear && (
        <div className="mb-2">
          <div className={tag}>Won in {label}</div>
          {wonNow.length > 0 ? (
            <div className={`flex flex-wrap gap-1.5 ${justify}`}>
              {wonNow.map((a) => (
                <span
                  key={a.award}
                  title={`${a.name}, ${label}`}
                  className="text-[10px] font-body font-semibold bg-ball text-court-bg border border-ball rounded-full px-2.5 py-1"
                >
                  🏅 {a.short}
                </span>
              ))}
            </div>
          ) : (
            <p className={`text-[10px] font-body text-ink-faint ${textAlign}`}>No major awards this season</p>
          )}
        </div>
      )}
      <div className={tag}>Career awards{seasonYear ? ' (all seasons)' : ''}</div>
      <div className={`flex flex-wrap gap-1.5 ${justify}`}>
        {data.awards.map((a) => (
          <button
            key={a.award}
            onClick={() => setOpen(open === a.award ? null : a.award)}
            title={`${a.name}: ${a.seasons.map((y) => seasonLabel(league, y)).join(', ')}`}
            className="text-[10px] font-body bg-court-surface2 border border-court-line text-ink-muted hover:border-ball hover:text-ink-primary rounded-full px-2.5 py-1 transition-colors cursor-pointer"
          >
            🏅 {a.count > 1 ? `${a.count}× ` : ''}{a.short}
          </button>
        ))}
      </div>
      {open && (
        <p className={`mt-1.5 text-[10px] font-body text-ink-faint ${textAlign}`}>
          {data.awards.find((a) => a.award === open)?.name}:{' '}
          <span className="font-mono tabular">{data.awards.find((a) => a.award === open)?.seasons.map((y) => seasonLabel(league, y)).join(', ')}</span>
        </p>
      )}
    </div>
  )
}
