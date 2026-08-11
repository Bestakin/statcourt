const PALETTE = ['#FF7A1A', '#C99A4B', '#3E8E7E', '#5B7FDB', '#D65D8A', '#7A6BC9', '#4FA8D8', '#E0A63E']

function colorForTeam(abbr) {
  let hash = 0
  for (let i = 0; i < abbr.length; i++) hash = abbr.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

// Several city abbreviations are shared between the NBA and WNBA (IND, DAL,
// MIN, CHI, ATL, PHO...) - a single flat dictionary caused real bugs where
// e.g. an NBA player on IND showed "Indiana Fever" (the WNBA team) instead
// of "Indiana Pacers". These MUST stay as two separate dictionaries, picked
// by the player's own league, not merged.
export const WNBA_TEAM_NAMES = {
  ATL: 'Atlanta Dream', CHI: 'Chicago Sky', CON: 'Connecticut Sun',
  DAL: 'Dallas Wings', GSV: 'Golden State Valkyries', IND: 'Indiana Fever',
  LAS: 'Los Angeles Sparks', LVA: 'Las Vegas Aces', MIN: 'Minnesota Lynx',
  NYL: 'New York Liberty', PHO: 'Phoenix Mercury', SEA: 'Seattle Storm',
  WAS: 'Washington Mystics',
  SAS: 'San Antonio Stars (now Las Vegas Aces)', TUL: 'Tulsa Shock (now Dallas Wings)',
  DET: 'Detroit Shock (now Dallas Wings, via Tulsa)', ORL: 'Orlando Miracle (now Connecticut Sun)',
  UTA: 'Utah Starzz (now Las Vegas Aces)', CLE: 'Cleveland Rockers (defunct, 2003)',
  CHA: 'Charlotte Sting (defunct, 2007)', HOU: 'Houston Comets (defunct, 2008)',
  SAC: 'Sacramento Monarchs (defunct, 2009)', MIA: 'Miami Sol (defunct, 2002)',
  POR: 'Portland Fire (defunct, 2002)',
}

// Current NBA franchises. Not exhaustive for every historical relocation
// across 79 seasons (that's a much longer list than WNBA's) - unmapped
// abbreviations fall back to showing the raw abbreviation, same pattern
// as WNBA's fallback.
export const NBA_TEAM_NAMES = {
  ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BRK: 'Brooklyn Nets', CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers',
  LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans',
  NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic',
  PHI: 'Philadelphia 76ers', PHO: 'Phoenix Suns', POR: 'Portland Trail Blazers',
  SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors',
  UTA: 'Utah Jazz', WAS: 'Washington Wizards',
  // Common historical/relocated franchises
  SEA: 'Seattle SuperSonics (now Oklahoma City Thunder)',
  NJN: 'New Jersey Nets (now Brooklyn Nets)',
  VAN: 'Vancouver Grizzlies (now Memphis Grizzlies)',
  NOH: 'New Orleans Hornets (now Charlotte/New Orleans Pelicans)',
  CHO: 'Charlotte Hornets', CHH: 'Charlotte Hornets (original franchise)',
  SDC: 'San Diego Clippers (now LA Clippers)',
  KCK: 'Kansas City Kings (now Sacramento Kings)',
  SYR: 'Syracuse Nationals (now Philadelphia 76ers)',
  FTW: 'Fort Wayne Pistons (now Detroit Pistons)',
  MNL: 'Minneapolis Lakers (now Los Angeles Lakers)',
  ROC: 'Rochester Royals (now Sacramento Kings)',
  STL: 'St. Louis Hawks (now Atlanta Hawks)',
}

export default function TeamBadge({ abbr, league = 'WNBA' }) {
  if (!abbr) return null
  const color = colorForTeam(abbr)
  const names = league === 'NBA' ? NBA_TEAM_NAMES : WNBA_TEAM_NAMES
  const fullName = names[abbr] || abbr
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted cursor-default" title={fullName}>
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {abbr}
    </span>
  )
}
