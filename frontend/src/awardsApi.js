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

export function getAwardCatalog(league, signal) {
  return getJSON(`${BASE_URL}/awards/catalog?league=${encodeURIComponent(league)}`, signal)
}

export function getAwardHistory(league, award, signal) {
  const q = new URLSearchParams({ league, award })
  return getJSON(`${BASE_URL}/awards?${q}`, signal)
}

export function getPlayerAwards(playerId, signal) {
  return getJSON(`${BASE_URL}/players/${playerId}/awards`, signal)
}
