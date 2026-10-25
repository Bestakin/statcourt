// NBA seasons straddle two calendar years. The database stores the ENDING year (2016 = the 2015-16 season),
// so we show NBA seasons as "2015-16". WNBA seasons sit inside one calendar year and stay as-is.
export function seasonLabel(league, year) {
  if (year === '' || year == null) return ''
  const y = Number(year)
  if (league !== 'NBA' || !Number.isFinite(y)) return String(year)
  return `${y - 1}-${String(y).slice(-2)}`
}
