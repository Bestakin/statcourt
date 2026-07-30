// A colored chip for the team abbreviation. Deliberately not using official
// team colors/logos — we'd have to guarantee accuracy for 15+ franchises
// and hotlinking official logos carries trademark risk for a public deploy.
// This still gives the "team identity at a glance" feel from a color dot,
// without either problem.
const PALETTE = ['#FF7A1A', '#C99A4B', '#3E8E7E', '#5B7FDB', '#D65D8A', '#7A6BC9', '#4FA8D8', '#E0A63E']

function colorForTeam(abbr) {
  let hash = 0
  for (let i = 0; i < abbr.length; i++) {
    hash = abbr.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

// Best-effort abbreviation -> full name map for the hover tooltip. WNBA
// franchises have relocated/renamed over the decades (e.g. Detroit Shock ->
// Tulsa Shock -> Dallas Wings), so this covers current teams plus common
// recent ones — an unmapped historical abbreviation just falls back to
// showing itself, rather than guessing wrong.
export const TEAM_NAMES = {
  // Current franchises
  ATL: 'Atlanta Dream', CHI: 'Chicago Sky', CON: 'Connecticut Sun',
  DAL: 'Dallas Wings', GSV: 'Golden State Valkyries', IND: 'Indiana Fever',
  LAS: 'Los Angeles Sparks', LVA: 'Las Vegas Aces', MIN: 'Minnesota Lynx',
  NYL: 'New York Liberty', PHO: 'Phoenix Mercury', SEA: 'Seattle Storm',
  WAS: 'Washington Mystics',
  // Historical/relocated franchises (best-effort, not exhaustive across 30 seasons)
  SAS: 'San Antonio Stars (now Las Vegas Aces)',
  TUL: 'Tulsa Shock (now Dallas Wings)',
  DET: 'Detroit Shock (now Dallas Wings, via Tulsa)',
  ORL: 'Orlando Miracle (now Connecticut Sun)',
  UTA: 'Utah Starzz (now Las Vegas Aces)',
  CLE: 'Cleveland Rockers (defunct, 2003)',
  CHA: 'Charlotte Sting (defunct, 2007)',
  HOU: 'Houston Comets (defunct, 2008)',
  SAC: 'Sacramento Monarchs (defunct, 2009)',
  MIA: 'Miami Sol (defunct, 2002)',
  POR: 'Portland Fire (defunct, 2002)',
}

export default function TeamBadge({ abbr }) {
  if (!abbr) return null
  const color = colorForTeam(abbr)
  const fullName = TEAM_NAMES[abbr] || abbr
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted cursor-default"
      title={fullName}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {abbr}
    </span>
  )
}
