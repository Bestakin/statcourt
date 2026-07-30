const UNITS = { pts: 'PPG', reb: 'RPG', ast: 'APG', win_shares: ' WS' }

export default function HighlightBadges({ highlights, onJumpToSeason }) {
  if (!highlights || highlights.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {highlights.map((h) => (
        <button
          key={h.stat}
          onClick={() => onJumpToSeason && onJumpToSeason(h.season_year)}
          title={`Tap to jump to this season`}
          className="text-[10px] font-body bg-court-surface2 border border-court-line rounded-full px-2.5 py-1 text-ink-muted hover:border-ball hover:text-ink-primary transition-colors cursor-pointer"
        >
          🏆 {h.label.replace('Best ', '').replace(' Season', '')}: {h.value}{UNITS[h.stat] || ''} in {h.season_year}
        </button>
      ))}
    </div>
  )
}
