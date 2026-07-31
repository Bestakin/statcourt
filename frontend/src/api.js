// Use whatever host the frontend itself is being served from (localhost
// during normal dev, or your PC's LAN IP when testing from a phone/tablet
// on the same network) rather than hardcoding 'localhost', which only
// resolves correctly on the same machine running the dev server.
const BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8005`

async function request(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

export function searchPlayers(query) {
  const params = query ? `?search=${encodeURIComponent(query)}` : ''
  return request(`/players${params}`)
}

export function getPlayer(id) {
  return request(`/players/${id}`)
}

export function getCareerAverages(id) {
  return request(`/players/${id}/career`)
}

export function getSimilarPlayers(id, limit = 5) {
  return request(`/players/${id}/similar?limit=${limit}`)
}

export function getPlayerSeasonHistory(id) {
  return request(`/players/${id}/stats`)
}

export function getDraftClass(year) {
  return request(`/draft-classes/${year}`)
}

export function getDraftYears() {
  return request('/draft-years')
}

export function findSeasons(filters) {
  const params = new URLSearchParams()
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
