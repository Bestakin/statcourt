// Recent searches, persisted in the browser's localStorage so they survive
// page reloads. This is a real deployed app (not a sandboxed artifact), so
// localStorage is the right tool here — no backend needed for this.
const KEY = 'wnba-compare-recent'
const MAX_ITEMS = 6

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return [] // private browsing / storage disabled - fail quietly
  }
}

export function addRecentSearch(entry) {
  // entry: { id: string (for dedup), label: string, type: 'compare' | 'finder', state: object }
  try {
    const existing = getRecentSearches()
    const deduped = existing.filter((e) => e.id !== entry.id)
    const updated = [entry, ...deduped].slice(0, MAX_ITEMS)
    localStorage.setItem(KEY, JSON.stringify(updated))
    return updated
  } catch {
    return getRecentSearches()
  }
}
