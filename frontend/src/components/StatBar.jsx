// Diverging comparison bar: two bars grow outward from a center line,
// proportional to each player's value relative to whichever is larger.
// This reads the comparison at a glance instead of requiring the viewer
// to cross-reference two separate numbers.
export default function StatBar({ label, value1, value2, unit = '' }) {
  const v1 = value1 ?? 0
  const v2 = value2 ?? 0
  const max = Math.max(v1, v2, 0.001)
  const pct1 = (v1 / max) * 100
  const pct2 = (v2 / max) * 100

  const fmt = (v) => (v === null || v === undefined ? '—' : `${v}${unit}`)

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
      <div className="flex items-center justify-end gap-2">
        <span className="font-mono tabular text-sm text-ink-primary">{fmt(value1)}</span>
        <div className="h-2 w-full max-w-[140px] bg-court-line rounded-sm overflow-hidden flex justify-end">
          <div
            className="h-full bg-ball rounded-sm transition-all duration-300"
            style={{ width: `${pct1}%` }}
          />
        </div>
      </div>

      <span className="text-[10px] uppercase tracking-widest text-ink-faint font-body w-16 text-center">
        {label}
      </span>

      <div className="flex items-center gap-2">
        <div className="h-2 w-full max-w-[140px] bg-court-line rounded-sm overflow-hidden">
          <div
            className="h-full bg-accent2 rounded-sm transition-all duration-300"
            style={{ width: `${pct2}%` }}
          />
        </div>
        <span className="font-mono tabular text-sm text-ink-primary">{fmt(value2)}</span>
      </div>
    </div>
  )
}
