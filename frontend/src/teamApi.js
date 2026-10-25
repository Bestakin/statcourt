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

export function listTeams(league, year, signal) {
  const q = new URLSearchParams({ league, year })
  return getJSON(`${BASE_URL}/teams?${q}`, signal)
}

export function compareTeams({ league, year, a, b }, signal) {
  const q = new URLSearchParams({ league, year, a, b })
  return getJSON(`${BASE_URL}/compare-teams?${q}`, signal)
}
