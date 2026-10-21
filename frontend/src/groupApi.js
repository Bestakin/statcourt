const BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8005`

async function getJSON(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try { detail = (await res.json()).detail || detail } catch { /* keep default */ }
    throw new Error(detail)
  }
  return res.json()
}

export function searchPlayersForGroup(query, league, signal) {
  const q = new URLSearchParams({ search: query, league })
  return getJSON(`${BASE_URL}/players?${q}`, signal)
}

export function compareGroups({ a, b, mode, year }, signal) {
  const q = new URLSearchParams({ a: a.join(','), b: b.join(','), mode })
  if (mode === 'season') q.set('year', year)
  return getJSON(`${BASE_URL}/compare-groups?${q}`, signal)
}