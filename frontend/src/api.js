// Use whatever host the frontend itself is being served from (localhost
// during normal dev, or your PC's LAN IP when testing from a phone/tablet
// on the same network) rather than hardcoding 'localhost', which only
// resolves correctly on the same machine running the dev server.
//
// In production, the frontend and backend are deployed on two different
// domains, so we can't guess the backend's address from window.location
// the way we do for local dev. VITE_API_URL (set in Render's environment
// variables) takes priority; the dynamic-hostname fallback is only used
// when that's not set, i.e. local dev or phone/LAN testing.
const BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8005`

async function request(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

export function getLeagues() {
  return request('/leagues')
}

export function searchPlayers(query, league = 'WNBA') {
  const params = new URLSearchParams({ league })
  if (query) params.set('search', query)
  return request(`/players?${params.toString()}`)
}

export function getPlayer(id) {
  return request(`/players/${id}`)
}

export function getCareerAverages(id) {
  return request(`/players/${id}/career`)
}

export function getSimilarPlayers(id, limit = 5) {
  // No league param here on purpose - the backend derives it from the
  // target player's own row, so there's no way to accidentally request
  // a mismatched pool.
  return request(`/players/${id}/similar?limit=${limit}`)
}

export function getPlayerSeasonHistory(id) {
  return request(`/players/${id}/stats`)
}

export function getDraftClass(year, league = 'WNBA') {
  return request(`/draft-classes/${year}?league=${league}`)
}

export function getDraftYears(league = 'WNBA') {
  return request(`/draft-years?league=${league}`)
}

export function findSeasons(filters, league = 'WNBA') {
  const params = new URLSearchParams({ league })
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, value)
    }
  })
  return request(`/season-finder?${params.toString()}`)
}

export function comparePlayers(player1Id, player2Id, seasonYear) {
  return request(`/compare?p1=${player1Id}&p2=${player2Id}&year=${seasonYear}`)
}
