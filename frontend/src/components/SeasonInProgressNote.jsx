// Seasons that are still being played. Edit this when a season finishes or a new one starts.
// Keys are the league, values the season_year as stored (NBA 2027 = the 2026-27 season).
const IN_PROGRESS = { NBA: 2027 }

const label = (league, y) => (league === 'NBA' ? `${y - 1}-${String(y).slice(-2)}` : String(y))

export default function SeasonInProgressNote({ league, seasonYear }) {
  if (IN_PROGRESS[league] !== seasonYear) return null
  return (
    <p className="mb-3 text-center text-[11px] font-body text-ink-muted border border-court-line rounded-md px-3 py-2">
      The {label(league, seasonYear)} season is still in progress. These numbers cover the games played so far and will
      keep changing, so early-season stats can look extreme.
    </p>
  )
}
