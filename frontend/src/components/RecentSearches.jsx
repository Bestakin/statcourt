import { useState, useEffect } from 'react'
import { getRecentSearches } from '../recentSearches'

export default function RecentSearches({ refreshKey, onRestore }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    setItems(getRecentSearches())
  }, [refreshKey])

  if (items.length === 0) return null

  return (
    <div className="max-w-3xl mx-auto mb-6">
      <div className="text-xs uppercase tracking-widest text-ink-muted font-body mb-2 px-1">
        Recent
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onRestore(item)}
            className="text-left text-sm text-ink-muted hover:text-ink-primary font-body px-3 py-1.5 rounded-md hover:bg-court-surface2 transition-colors flex items-center gap-2"
          >
            <span className="text-ball">✓</span> {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
