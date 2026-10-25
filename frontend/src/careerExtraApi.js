const BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8005`

export async function getCareerExtra(playerId, signal) {
  const res = await fetch(`${BASE_URL}/career-extra?player_id=${playerId}`, { signal })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}
